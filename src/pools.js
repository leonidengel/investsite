// src/pools.js — логика «Горячих пулов» + рендер страницы.
// ВАЖНО: этот модуль использует СКРИПТ scripts/sync-pools.mjs (запускается вне
// Cloudflare — на Mac или в GitHub Actions). Причина: DefiLlama не умеет
// фильтровать пулы и отдаёт весь дамп 10.9MB, парсинг которого (~40мс CPU)
// не помещается в лимит 10мс бесплатного тарифа Workers. Worker только
// отдаёт готовые строки (HTML/JSON), заранее записанные в KV скриптом.

import { POOL_BLUE_TOKENS, POOL_STABLE_TOKENS, poolChainName } from "./config.js";

// Доступные окна усреднения APY (в днях). 24ч = текущий APY пула.
export const POOL_PERIODS = [7, 30, 60, 90, 120, 180];
export const MIN_MEAN_POINTS = 5; // минимум дневных точек в окне, иначе «—»

const MIN_TVL = 500_000; // отсекаем мусор с копеечным TVL и «APY» 10000%
const TOP_N = 30; // по сколько пулов в каждой категории (watchlist, не весь рынок)

const BLUE = new Set(POOL_BLUE_TOKENS.map((t) => t.toUpperCase()));
const STABLE = new Set(POOL_STABLE_TOKENS.map((t) => t.toUpperCase()));

// Нормализация символов: убираем суффиксы мостов (USDC.E → USDC) и вариации
function norm(t) {
  let s = String(t).toUpperCase().trim();
  s = s.replace(/\.(E|B|W)$/, "");
  if (s === "USD₮0" || s === "USDT0") s = "USDT";
  return s;
}

function toks(p) {
  return (p.symbol || "").split(/[-+]/).map(norm).filter(Boolean);
}

// ---------- Классификация по watchlist ----------
// blue-chip: все токены из watchlist, есть хотя бы один blue-chip, не чистый стейбл
// stable: все токены — стейблкоины из watchlist
export function classifyPools(data) {
  const blue = [];
  const stable = [];
  for (const p of data) {
    if (p.outlier === true || (p.tvlUsd || 0) < MIN_TVL || (p.apy || 0) <= 0) continue;
    const t = toks(p);
    if (!t.length) continue;
    const hasBlue = t.some((x) => BLUE.has(x));
    const allWatch = t.every((x) => BLUE.has(x) || STABLE.has(x));
    const pureStable = t.every((x) => STABLE.has(x));
    if (allWatch && hasBlue && !pureStable) blue.push(p);
    else if (pureStable) stable.push(p);
  }
  const top = (l) => l.sort((a, b) => (b.apy || 0) - (a.apy || 0)).slice(0, TOP_N);
  return { blueChip: top(blue), stableCoin: top(stable) };
}

// Компактное представление пула для страницы/KV
export function compact(p) {
  return {
    id: p.pool,
    s: p.symbol,
    c: p.chain,
    pr: p.project,
    t: Math.round(p.tvlUsd || 0),
    a: +(p.apy || 0).toFixed(2),
    v: p.volumeUsd1d ? Math.round(p.volumeUsd1d) : null,
  };
}

// ---------- Средние APY за окна (из chart-истории) ----------
export function windowMeans(points) {
  const daily = {};
  for (const p of points) {
    if (p.apy == null) continue;
    daily[String(p.timestamp).slice(0, 10)] = p.apy;
  }
  const days = Object.entries(daily).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (!days.length) return null;
  const lastDay = days[days.length - 1][0];
  const cutoffDate = new Date(lastDay);
  if (isNaN(cutoffDate)) return null;
  const means = [];
  for (const w of POOL_PERIODS) {
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - w);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);
    const vals = days.filter(([d]) => d >= cutoffStr).map(([, v]) => v);
    means.push(vals.length < MIN_MEAN_POINTS ? null : +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2));
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() + w); // возвращаем к lastDay
  }
  return means;
}

export async function fetchChartMeans(poolId) {
  const res = await fetch(`https://yields.llama.fi/chart/${poolId}`);
  if (!res.ok) return null;
  const j = await res.json();
  if (j.status !== "success" || !Array.isArray(j.data)) return null;
  return windowMeans(j.data);
}

// Полная сборка: классификация → компакт → средние по каждому пулу
export async function buildPoolsData(dumpData, { withMeans = true, sleepMs = 150 } = {}) {
  const { blueChip, stableCoin } = classifyPools(dumpData);
  const attach = async (list) => {
    const out = [];
    for (const p of list) {
      const e = compact(p);
      if (withMeans) {
        e.m = await fetchChartMeans(p.pool);
        await new Promise((r) => setTimeout(r, sleepMs));
      }
      out.push(e);
    }
    return out;
  };
  return {
    updatedAt: new Date().toISOString(),
    blueChip: await attach(blueChip),
    stableCoin: await attach(stableCoin),
  };
}

// ---------- Рендер страницы /pools (HTML) ----------
// data: { updatedAt, blueChip: [...], stableCoin: [...] } — каждый пул с полем m (means)
export function renderPoolsPage(data, subdomain) {
  const prep = (list) =>
    list.map((p) => ({
      s: p.s,
      cn: poolChainName(p.c),
      pr: p.pr,
      ic: `https://icons.llamao.fi/icons/protocols/${encodeURIComponent(p.pr)}?style=square`,
      tvl: p.t,
      apy: p.a,
      vol: p.v,
      m: p.m,
    }));
  const payload = JSON.stringify({ updatedAt: data.updatedAt, blueChip: prep(data.blueChip), stableCoin: prep(data.stableCoin) }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invest Portfolio — Горячие пулы</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         background:#f4f6fa; color:#1b2433; margin:0; padding:20px; }
  .wrap { max-width:1200px; margin:0 auto; }
  h1 { font-size:22px; margin:0 0 4px; }
  .sub { color:#66718a; font-size:13px; margin-bottom:16px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .back { color:#3b6ef5; text-decoration:none; font-size:13px; }
  .toolbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:14px; }
  .tabs { display:flex; gap:8px; flex-wrap:wrap; }
  .tab { border:1px solid #dbe3f7; background:#fff; color:#3b6ef5; padding:8px 14px; border-radius:9px;
         font-size:13px; cursor:pointer; font-weight:600; }
  .tab.active { background:#3b6ef5; color:#fff; border-color:#3b6ef5; }
  .periods { display:flex; gap:4px; flex-wrap:wrap; margin-left:auto; }
  .per { border:1px solid #e4e8f0; background:#fff; color:#66718a; padding:6px 10px; border-radius:8px;
         font-size:12px; cursor:pointer; }
  .per.active { background:#eef2ff; color:#3b6ef5; border-color:#3b6ef5; font-weight:600; }
  .table-wrap { background:#fff; border:1px solid #e4e8f0; border-radius:14px; overflow:hidden; }
  .table-scroll { overflow-x:auto; }
  table { border-collapse:collapse; width:100%; min-width:760px; font-size:13px; }
  th { text-align:left; color:#8b93a7; font-size:11px; text-transform:uppercase; letter-spacing:.5px;
       padding:10px 14px; background:#f7f8fc; border-bottom:1px solid #e4e8f0; white-space:nowrap; }
  td { padding:10px 14px; border-bottom:1px solid #f0f2f7; vertical-align:middle; }
  tr:last-child td { border-bottom:none; }
  tr:hover td { background:#fafbff; }
  .rank { color:#8b93a7; font-size:12px; }
  .pool { display:flex; align-items:center; gap:10px; }
  .pool img { width:22px; height:22px; border-radius:6px; flex-shrink:0; }
  .pool b { font-size:13px; }
  .sub-lbl { color:#8b93a7; font-size:10px; font-weight:400; }
  .num { text-align:right; font-variant-numeric:tabular-nums; }
  .muted { color:#8b93a7; }
  .apy-val { font-weight:700; }
  .note { color:#8b93a7; font-size:11px; margin-top:12px; }
  @media (max-width:640px) {
    body { padding:12px; }
    h1 { font-size:19px; }
    .periods { margin-left:0; width:100%; }
  }
</style></head><body>
<div class="wrap">
  <h1>🔥 Горячие пулы</h1>
  <div class="sub"><a class="back" href="/">← Дашборд</a> · обновлено <span id="upd"></span> · данные DefiLlama Yields</div>
  <div class="toolbar">
    <div class="tabs">
      <button class="tab active" data-tab="blueChip">Best Blue-chip Pools</button>
      <button class="tab" data-tab="stableCoin">Best Stable Coin Pools</button>
    </div>
    <div class="periods" id="periods"></div>
  </div>
  <div class="table-wrap"><div class="table-scroll">
    <table>
      <thead><tr>
        <th>#</th><th>Пул</th><th>Сеть</th><th>Протокол</th>
        <th class="num">TVL</th><th class="num" id="apyHead">APY</th><th class="num">24ч объём</th>
      </tr></thead>
      <tbody id="rows"></tbody>
    </table>
  </div></div>
  <div class="note">Пары из основных токенов (watchlist), без мусорных пулов (TVL ≥ $0.5M, не outlier). APY за окно — среднее значение APY пула из истории DefiLlama за выбранный период; «—» если истории недостаточно.</div>
</div>
<script>
const DATA = ${payload};
const PERIODS = [7, 30, 60, 90, 120, 180];
const PERIOD_LABELS = ["24ч", ...PERIODS.map((d) => d + "д")];
let tab = "blueChip";
let period = "24h";
document.getElementById("upd").textContent = new Date(DATA.updatedAt).toLocaleString("ru-RU");

const periodsEl = document.getElementById("periods");
PERIOD_LABELS.forEach((lbl, i) => {
  const b = document.createElement("button");
  b.className = "per" + (i === 0 ? " active" : "");
  b.textContent = lbl;
  b.onclick = () => {
    period = i === 0 ? "24h" : PERIODS[i - 1];
    document.querySelectorAll(".per").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    render();
  };
  periodsEl.appendChild(b);
});

document.querySelectorAll(".tab").forEach((b) => {
  b.onclick = () => {
    tab = b.dataset.tab;
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    render();
  };
});

function valOf(p) {
  if (period === "24h") return p.apy;
  const idx = PERIODS.indexOf(period);
  const m = p.m;
  return m && m[idx] != null ? m[idx] : null;
}

function fmtMoney(v) {
  if (v == null) return "—";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + Math.round(v);
}

function render() {
  const list = DATA[tab];
  const idx = PERIODS.indexOf(period);
  const sorted = list
    .map((p) => ({ p, v: valOf(p) }))
    .sort((a, b) => {
      if (a.v == null && b.v == null) return 0;
      if (a.v == null) return 1;
      if (b.v == null) return -1;
      return b.v - a.v;
    });
  document.getElementById("apyHead").textContent = "APY · " + (period === "24h" ? "24ч" : period + "д");
  document.getElementById("rows").innerHTML = sorted
    .map(({ p, v }, i) => {
      const cur = p.apy != null ? p.apy.toFixed(1) + "%" : "—";
      const apyCell = v == null
        ? '<span class="muted">—</span><div class="sub-lbl">тек. ' + cur + '</div>'
        : '<span class="apy-val">' + v.toFixed(1) + '%</span><div class="sub-lbl">тек. ' + cur + '</div>';
      const vol = p.vol != null ? fmtMoney(p.vol) : '<span class="muted">—</span>';
      return '<tr><td class="rank">' + (i + 1) + "</td>" +
        '<td><div class="pool"><img src="' + p.ic + '" alt="" loading="lazy" onerror="this.remove()">' +
        "<b>" + p.s + "</b></div></td>" +
        '<td class="muted">' + p.cn + "</td>" +
        '<td class="muted">' + p.pr + "</td>" +
        '<td class="num">' + fmtMoney(p.tvl) + "</td>" +
        '<td class="num">' + apyCell + "</td>" +
        '<td class="num">' + vol + "</td></tr>";
    })
    .join("");
}
render();
</script>
</body></html>`;
}

// JSON для /api/pools (те же данные, компактно)
export function renderApiJson(data) {
  return JSON.stringify({
    updatedAt: data.updatedAt,
    blueChip: data.blueChip,
    stableCoin: data.stableCoin,
  });
}
