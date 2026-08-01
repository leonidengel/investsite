import { WALLETS, STABLECOIN_SYMBOLS } from "./config.js";
import { refreshRF, getRF } from "./rf.js";
import { DASHBOARD_HTML } from "./dashboard.js";

const KV_KEY = "snapshot";
// Ключи KV для страницы «Горячие пулы» (готовые строки, рендерит скрипт sync-pools)
const KV_POOLS_HTML = "poolsHtml";
const KV_POOLS_JSON = "poolsJson";

// ---------- Zerion API ----------
function zerionAuth(apiKey) {
  return "Basic " + btoa(apiKey + ":");
}

// Ретраи на 429 (рейт-лимит Zerion) с нарастающей паузой
async function fetchWithRetry(url, init, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;
    await new Promise((r) => setTimeout(r, 700 * (i + 1)));
  }
  return fetch(url, init);
}

async function zerionPortfolio(address, apiKey) {
  const url = `https://api.zerion.io/v1/wallets/${address}/portfolio?currency=usd&filter%5Bpositions%5D=no_filter`;
  const res = await fetchWithRetry(url, { headers: { Authorization: zerionAuth(apiKey) } });
  if (!res.ok) throw new Error(`Zerion portfolio ${res.status}`);
  const j = await res.json();
  const a = j.data?.attributes || {};
  return {
    total: a.total?.positions ?? 0,
    chains: a.positions_distribution_by_chain || {},
    types: a.positions_distribution_by_type || {},
    changes: a.changes || {},
  };
}

async function zerionPositions(address, apiKey) {
  const url = `https://api.zerion.io/v1/wallets/${address}/positions/?currency=usd&filter%5Bpositions%5D=no_filter`;
  const res = await fetchWithRetry(url, { headers: { Authorization: zerionAuth(apiKey) } });
  if (!res.ok) throw new Error(`Zerion positions ${res.status}`);
  const j = await res.json();
  return (j.data || [])
    .filter((p) => p.attributes?.flags?.displayable !== false) // отсекаем aToken-расписки и долговые токены
    .map((p) => {
      const a = p.attributes || {};
      const fi = a.fungible_info || {};
      const chain = p.relationships?.chain?.data?.id || a.chain?.id || "?";
      const type = a.position_type || a.type || "wallet";
      // Категория для donut: в DeFi / долг / стейблкоин / крипта
      const symbol = (fi.symbol || "?").toUpperCase();
      let cat;
      if (type === "loan" || type === "borrowed") cat = "borrowed";
      else if (type !== "wallet") cat = "defi";
      else cat = STABLECOIN_SYMBOLS.has(symbol) ? "stable" : "crypto";
      // LP-позиция: Zerion именует её «Uniswap V3 WETH/USDC Pool (#5680233)» —
      // по этому имени группируем две половины пары в одну позицию
      const posName = String(a.name || "");
      const isPoolPos = /Pool \(#\d+\)$/.test(posName);
      return {
        value: Number(a.value) || 0,
        symbol: fi.symbol || "?",
        name: isPoolPos ? posName : fi.name || fi.symbol || "?",
        icon: fi.icon?.url || "",
        chain,
        type,
        cat,
        protocol: a.protocol || "",
        pool: isPoolPos ? posName : null, // ключ группы LP-пары
        amount: a.quantity?.float ?? null, // количество токена в позиции
      };
    })
    .filter((p) => p.value > 0)
    .sort((x, y) => y.value - x.value);
}

// ---------- Обновление и кэш (портфель) ----------
async function refreshAll(env) {
  const apiKey = env.ZERION_API_KEY;
  if (!apiKey) {
    const empty = { updatedAt: new Date().toISOString(), error: "ZERION_API_KEY не задан", wallets: [] };
    await env.DATA.put(KV_KEY, JSON.stringify(empty));
    return empty;
  }
  const wallets = [];
  for (const w of WALLETS) {
    const [pf, pos] = await Promise.allSettled([
      zerionPortfolio(w.address, apiKey),
      zerionPositions(w.address, apiKey),
    ]);
    // Категории активов для donut: стейблы / крипта / в DeFi / долг
    const categories = { stable: 0, crypto: 0, defi: 0, borrowed: 0 };
    if (pos.status === "fulfilled") {
      for (const p of pos.value) categories[p.cat] = (categories[p.cat] || 0) + p.value;
    }
    wallets.push({
      id: w.id,
      name: w.name,
      address: w.address,
      sources: w.sources,
      ok: pf.status === "fulfilled",
      error: pf.status === "rejected" ? String(pf.reason?.message || pf.reason) : null,
      portfolio: pf.status === "fulfilled" ? pf.value : null,
      positions: pos.status === "fulfilled" ? pos.value : [],
      categories,
      posError: pos.status === "rejected" ? String(pos.reason?.message || pos.reason) : null,
      checkedAt: new Date().toISOString(),
    });
    await new Promise((r) => setTimeout(r, 250)); // разносим запросы, чтобы не ловить 429
  }
  const snapshot = { updatedAt: new Date().toISOString(), wallets };
  await env.DATA.put(KV_KEY, JSON.stringify(snapshot));
  return snapshot;
}

async function getSnapshot(env) {
  const raw = await env.DATA.get(KV_KEY);
  if (raw) return JSON.parse(raw);
  return refreshAll(env);
}

// Фоновое обновление РФ (из waitUntil, чтобы не тормозить ответ)
const RF_TTL = 60 * 60 * 1000;

async function ensureRF(env) {
  try {
    const snap = await getRF(env);
    const age = Date.now() - new Date(snap.updatedAt).getTime();
    if (age > RF_TTL || !Array.isArray(snap.items)) await refreshRF(env);
  } catch (e) {
    console.log("ensureRF:", e.message);
  }
}

// ---------- Страница «Горячие пулы» ----------
// Саму страницу рендерит скрипт scripts/sync-pools.mjs (тяжёлый парсинг дампа
// DefiLlama не помещается в 10мс CPU бесплатного тарифа) и кладёт готовый HTML
// в KV (poolsHtml). Здесь только заглушка, пока данные не синхронизированы.
function poolsFallback() {
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invest Portfolio — Горячие пулы</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; background:#f4f6fa; color:#1b2433;
         margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
  .box { background:#fff; border:1px solid #e4e8f0; border-radius:14px; padding:32px; max-width:460px; text-align:center; }
  h1 { font-size:20px; margin:0 0 8px; }
  p { color:#66718a; font-size:14px; line-height:1.5; margin:0 0 18px; }
  code { background:#eef2ff; color:#3b6ef5; padding:2px 8px; border-radius:6px; font-size:12px; }
  a { color:#3b6ef5; }
</style></head><body>
<div class="box">
  <h1>🔥 Горячие пулы</h1>
  <p>Данные ещё не синхронизированы. Запусти <code>node scripts/sync-pools.mjs</code>
     (или дождись GitHub Actions), и страница наполнится.</p>
  <p><a href="/">← На дашборд</a></p>
</div>
</body></html>`;
}

// ---------- Обработчики ----------
export default {
  async scheduled(_event, env) {
    await refreshAll(env); // портфель — каждые 15 мин
    await ensureRF(env); // РФ-инструменты (раз в час). Пулы обновляет sync-pools.mjs
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const json = (o) => Response.json(o);
    try {
      if (url.pathname === "/api/refresh") {
        const snap = await refreshAll(env);
        ctx.waitUntil(ensureRF(env));
        return json(snap);
      }
      if (url.pathname === "/api/data") {
        return json(await getSnapshot(env));
      }
      if (url.pathname === "/api/pools") {
        const raw = await env.DATA.get(KV_POOLS_JSON);
        if (!raw) return json({ error: "ещё не синхронизировано (запусти scripts/sync-pools.mjs)", updatedAt: null });
        return new Response(raw, { headers: { "content-type": "application/json; charset=utf-8" } });
      }
      if (url.pathname === "/api/rf") {
        const rf = await getRF(env);
        const cls = url.searchParams.get("class");
        const out = {
          updatedAt: rf.updatedAt,
          items: cls ? rf.items.filter((i) => i.klass === cls) : rf.items,
        };
        return json(out);
      }
      if (url.pathname === "/pools") {
        const raw = await env.DATA.get(KV_POOLS_HTML);
        if (!raw) return new Response(poolsFallback(), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
        return new Response(raw, { headers: { "content-type": "text/html; charset=utf-8" } });
      }
      // Дашборд: статичная оболочка, данные тянет сам браузер через /api/data
      return new Response(DASHBOARD_HTML, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } catch (e) {
      return new Response("Error: " + e.message, { status: 500 });
    }
  },
};
