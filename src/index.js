import { WALLETS, STABLECOIN_SYMBOLS } from "./config.js";
import { refreshRF, getRF, rfWalletSnapshot } from "./rf.js";
import { getRates, refreshRates } from "./rates.js";
import { DASHBOARD_HTML, DASHBOARD_JS } from "./dashboard.js";

const KV_KEY = "snapshot";
// Ключи KV для страницы «Горячие пулы» (готовые строки, рендерит скрипт sync-pools)
const KV_POOLS_HTML = "poolsHtml";
const KV_POOLS_JSON = "poolsJson";
const KV_RATES = "defiRates"; // APR/TVL по протоколам (строит sync-pools.mjs из дампа DefiLlama)

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

// ---------- Aave V3 Health Factor (on-chain, как в DeBank) ----------
const AAVE_V3 = {
  arbitrum: { pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", rpc: "https://arb1.arbitrum.io/rpc" },
  base: { pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", rpc: "https://mainnet.base.org" },
  ethereum: { pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", rpc: "https://eth.llamarpc.com" },
};

async function aaveHealth(walletAddress, positions) {
  const aave = positions.find((p) => p.protocol === "Aave V3");
  if (!aave) return null;
  const cfg = AAVE_V3[aave.chain];
  if (!cfg) return null;
  const addr = walletAddress.slice(2).toLowerCase();
  const data = "0xbf92857c" + "0".repeat(24) + addr; // getUserAccountData(address)
  try {
    const res = await fetch(cfg.rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: cfg.pool, data }, "latest"] }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const hex = j.result;
    if (!hex || hex.length < 2 + 6 * 64) return null;
    const read = (i) => BigInt("0x" + hex.slice(2 + i * 64, 2 + (i + 1) * 64));
    const collateral = Number(read(0)) / 1e8;
    const debt = Number(read(1)) / 1e8;
    const hf = Number(read(5)) / 1e18;
    return { collateral, debt, hf, hasDebt: debt > 1 };
  } catch (e) {
    return null;
  }
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
    // Health Factor Aave V3 (on-chain) — только если есть Aave-позиции
    const health = pos.status === "fulfilled" ? await aaveHealth(w.address, pos.value) : null;
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
      health,
      posError: pos.status === "rejected" ? String(pos.reason?.message || pos.reason) : null,
      checkedAt: new Date().toISOString(),
    });
    await new Promise((r) => setTimeout(r, 250)); // разносим запросы, чтобы не ловить 429
  }
  // Синтетический РФ-кошелёк (MOEX: паи АКММ и т.п.) — в рублях, env для курса USDT→₽
  try {
    wallets.push(await rfWalletSnapshot(env));
  } catch (e) {
    wallets.push({
      id: "wallet-c", name: "Russian Stocks", address: "MOEX", sources: [],
      ok: false, error: String(e.message || e), portfolio: null, positions: [],
      categories: { stable: 0, crypto: 0, defi: 0, borrowed: 0 }, health: null,
      posError: null, checkedAt: new Date().toISOString(),
    });
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
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invest Portfolio — Hot Pools</title>
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
  <h1>🔥 Hot Pools</h1>
  <p>Data not synced yet. Run <code>node scripts/sync-pools.mjs</code>
     (or wait for GitHub Actions) and the page will fill in.</p>
  <p><a href="/">← Back to dashboard</a></p>
</div>
</body></html>`;
}

// ---------- Обработчики ----------
export default {
  async scheduled(_event, env) {
    await refreshAll(env); // портфель — каждые 15 мин
    await ensureRF(env); // РФ-инструменты (раз в час). Пулы обновляет sync-pools.mjs
    await refreshRates(env).catch((e) => console.log("rates:", e.message)); // курсы + страх/жадность
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const json = (o) => Response.json(o);
    try {
      if (url.pathname === "/api/refresh") {
        const snap = await refreshAll(env);
        ctx.waitUntil(Promise.all([ensureRF(env), refreshRates(env).catch(() => null)]));
        return json(snap);
      }
      if (url.pathname === "/api/data") {
        return json(await getSnapshot(env));
      }
      if (url.pathname === "/api/pools") {
        // Категории отдаём по одной (все 150 пулов ~29KB не проходят лимит ответа)
        const cat = url.searchParams.get("cat");
        if (cat) {
          const raw = await env.DATA.get(KV_POOLS_JSON + ":" + cat);
          if (!raw) return json({ error: "нет категории " + cat, updatedAt: null });
          return new Response(raw, { headers: { "content-type": "application/json; charset=utf-8" } });
        }
        const idx = await env.DATA.get("poolsIndex");
        if (!idx) return json({ error: "ещё не синхронизировано (запусти scripts/sync-pools.mjs)", updatedAt: null });
        return new Response(idx, { headers: { "content-type": "application/json; charset=utf-8" } });
      }
      if (url.pathname === "/api/defirates") {
        // Клиент запрашивает ТОЛЬКО нужные ключи: /api/defirates?q=Сеть~проект~символ,...
        // Извлекаем их regex'ом из чанка (KV-чтение 126KB — I/O, без парсинга всего).
        const q = url.searchParams.get("q") || "";
        if (!q) return json({});
        const want = {};
        for (const item of q.split(",")) {
          const parts = item.split("~");
          if (parts.length < 3) continue;
          const chain = decodeURIComponent(parts[0]);
          const key = decodeURIComponent(parts[1]) + "|" + decodeURIComponent(parts[2]);
          (want[chain] = want[chain] || []).push(key);
        }
        const out = {};
        for (const chain of Object.keys(want)) {
          const raw = await env.DATA.get(KV_RATES + ":" + chain);
          if (!raw) continue;
          const all = {};
          const re = /"([^"]+)":(\{[^}]+\})/g;
          let mm;
          while ((mm = re.exec(raw))) {
            try { all[mm[1]] = JSON.parse(mm[2]); } catch (e) { /* пропускаем */ }
          }
          for (const k of want[chain]) {
            if (all[k]) out[chain + "~" + k.replace("|", "~")] = all[k];
          }
        }
        return json(out);
      }
      if (url.pathname === "/api/rates") {
        try {
          return json(await getRates(env));
        } catch (e) {
          return json({ error: String(e.message || e), btcUsd: null, ethUsd: null, usdtRub: null, fng: null, fngLabel: null });
        }
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
      if (url.pathname === "/dash.js") {
        // Клиентский JS дашборда отдельным файлом (оболочка+JS вместе больше лимита ответа)
        return new Response(DASHBOARD_JS, {
          headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-cache" },
        });
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
