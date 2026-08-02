// src/dashboard.js
// Статичная HTML-оболочка дашборда (DASHBOARD_HTML) + клиентский JS (DASHBOARD_JS).
// Worker отдаёт их как есть (0 работы при запросе), браузер сам тянет /api/data
// и рисует всё. Клиентский JS вынесен в отдельный ответ /dash.js: суммарно HTML+JS
// больше лимита ответа бесплатного тарифа (~19.5KB), по отдельности — меньше.

export const DASHBOARD_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20x%3D%2223%22%20y%3D%225%22%20width%3D%2218%22%20height%3D%229%22%20rx%3D%223%22%20fill%3D%22%23d97706%22%2F%3E%3Cpath%20d%3D%22M23%209h18%22%20stroke%3D%22%2392400e%22%20stroke-width%3D%222.5%22%2F%3E%3Cpath%20d%3D%22M19%2014h26c3.5%207%206%2013.5%206%2019.5C51%2044%2043%2052%2032%2052S13%2044%2013%2033.5c0-6%202.5-12.5%206-19.5z%22%20fill%3D%22%23f59e0b%22%2F%3E%3Cpath%20d%3D%22M13%2033.5C13%2044%2021%2052%2032%2052c6%200%2011-2%2015-5-3-5-9-8-16-8-4%200-8%201-12%203.5z%22%20fill%3D%22%23d97706%22%2F%3E%3Ctext%20x%3D%2232%22%20y%3D%2242%22%20font-family%3D%22Arial%2CHelvetica%2Csans-serif%22%20font-size%3D%2221%22%20font-weight%3D%22700%22%20fill%3D%22%237c2d12%22%20text-anchor%3D%22middle%22%3E%24%3C%2Ftext%3E%3C%2Fsvg%3E">
<title>Invest Portfolio — Dashboard</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         background:#f4f6fa; color:#1b2433; margin:0; padding:20px; overflow-x:hidden;
         -webkit-tap-highlight-color:transparent; }
  svg { max-width:100%; height:auto; }
  .wrap { max-width:1280px; margin:0 auto; }
  h1 { font-size:22px; margin:0 0 4px; }
  .sub { color:#66718a; font-size:13px; margin-bottom:20px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .cards { display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; }
  @media (max-width:640px) {
    body { padding:12px; padding-top:max(12px, env(safe-area-inset-top)); padding-bottom:calc(12px + env(safe-area-inset-bottom)); }
    .cards { grid-template-columns:1fr; }
    .card.comb { grid-column:1; }
    h1 { font-size:19px; }
    .src, .refresh { padding:10px 14px; }
  }
  .spinner { width:30px; height:30px; border:3px solid #dbe3f7; border-top-color:#3b6ef5; border-radius:50%;
             animation:spin .8s linear infinite; margin:40px auto; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .loading-txt { color:#8b93a7; font-size:13px; text-align:center; margin-top:-20px; padding-bottom:40px; }
  .stats { display:flex; gap:14px; flex-wrap:wrap; margin:0 0 12px; font-size:12px; color:#66718a; }
  .stat b { color:#1b2433; }
  .stat.debt b { color:#dc2626; }
  .card { background:#fff; border:1px solid #e4e8f0; border-radius:14px; padding:18px;
          box-shadow:0 1px 2px rgba(16,24,40,.04); }
  .card.comb { grid-column:1 / -1; } /* top full-width summary block, wallets in 2 columns below */
  .head { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .ok { color:#0e9f6e; font-size:12px; font-weight:600; }
  .err { color:#dc2626; font-size:12px; font-weight:600; }
  .time { margin-left:auto; color:#8b93a7; font-size:11px; }
  .url { color:#8b93a7; font-size:11px; word-break:break-all; margin:6px 0 10px; }
  .warn { background:#fff7e6; border:1px solid #f0d9a8; color:#8a5a00; padding:10px 14px;
          border-radius:10px; margin-bottom:18px; font-size:13px; }
  .warn code { background:#fff0c7; padding:2px 6px; border-radius:4px; }
  .comb-cols { display:grid; grid-template-columns:1fr 1.2fr 1.4fr; margin-top:2px; }
  .comb-col { padding:0 18px; min-width:0; }
  .comb-col:first-child { padding-left:0; }
  .comb-col + .comb-col { border-left:1px solid #e4e8f0; }
  .rate { display:flex; justify-content:space-between; align-items:baseline; gap:10px; font-size:13px; padding:4px 0; }
  .rate span { color:#5a6478; }
  .rate b, .fng b { font-variant-numeric:tabular-nums; }
  .fng { display:flex; align-items:center; gap:8px; font-size:13px; margin-top:10px; padding-top:10px; border-top:1px dashed #e4e8f0; }
  .fng-dot { width:12px; height:12px; border-radius:50%; flex-shrink:0; }
  @media (max-width:640px) {
    .comb-cols { grid-template-columns:1fr; }
    .comb-col { padding:12px 0; }
    .comb-col + .comb-col { border-left:none; border-top:1px solid #e4e8f0; }
  }
  .total-row { display:flex; align-items:baseline; gap:12px; margin:2px 0 14px; }
  .total { font-size:24px; font-weight:700; }
  .total.big { font-size:30px; }
  .chg { font-size:12px; font-weight:600; }
  .chg.up { color:#0e9f6e; }
  .chg.down { color:#dc2626; }
  .chart-wrap { display:flex; gap:20px; align-items:center; flex-wrap:wrap; margin-bottom:6px; }
  .legend { flex:1; min-width:170px; }
  .li { display:flex; align-items:center; gap:8px; font-size:12px; padding:3px 0; }
  .dot { width:10px; height:10px; border-radius:3px; flex-shrink:0; }
  .lname { color:#5a6478; margin-right:4px; }
  .lpct { color:#1b2433; font-weight:600; }
  .lval { color:#8b93a7; }
  h3.sec { font-size:12px; color:#66718a; margin:14px 0 8px; text-transform:uppercase; letter-spacing:.5px; }
  .arow { display:flex; align-items:center; gap:10px; padding:7px 0; border-top:1px solid #f0f2f7; font-size:12px; }
  .lp { border:1px solid #e8ecf4; border-radius:10px; padding:10px 12px; margin:8px 0; background:#fafbff; }
  .lp-head { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .lp-main { flex:1; min-width:0; }
  .lp-pair b { font-size:13px; }
  .lp-id, .lp-sub { color:#8b93a7; font-size:10px; }
  .lp-id { font-weight:400; }
  .lp-fee { color:#3b6ef5; font-size:11px; font-weight:600; }
  .lp-apy { color:#0e9f6e; font-size:11px; font-weight:600; white-space:nowrap; }
  .lp-total { font-weight:700; font-size:13px; align-self:center; }
  .lp-sec { font-size:10px; color:#8b93a7; text-transform:uppercase; letter-spacing:.5px; margin:8px 0 2px; }
  .lp-apy.down { color:#dc2626; }
  .lp-hf { font-size:11px; font-weight:700; white-space:nowrap; align-self:center; }
  .hf-ok { color:#0e9f6e; }
  .hf-warn { color:#d97706; }
  .hf-bad { color:#dc2626; }
  .lp-toks { margin-top:8px; border-top:1px dashed #e4e8f0; }
  .lp-amt { flex:1; color:#66718a; font-variant-numeric:tabular-nums; }
  .lp-val { color:#1b2433; font-weight:600; font-variant-numeric:tabular-nums; }
  .ic { width:22px; height:22px; border-radius:50%; flex-shrink:0; }
  .ph-ic { background:#eef2f7; color:#66718a; display:flex; align-items:center; justify-content:center; font-size:10px; }
  .aname { width:110px; flex-shrink:0; }
  .aname b { display:block; } .aname span { color:#8b93a7; font-size:10px; }
  .abar { flex:1; background:#eef1f6; height:6px; border-radius:3px; overflow:hidden; }
  .abar-fill { background:#3b6ef5; height:100%; border-radius:3px; }
  .aval { width:74px; text-align:right; color:#1b2433; font-weight:600; }
  .apct { width:48px; text-align:right; color:#8b93a7; }
  .srcs { display:flex; gap:8px; margin-top:14px; flex-wrap:wrap; }
  .srcs.top { margin:2px 0 8px; justify-content:flex-end; }
  .src, .refresh { font-size:12px; color:#3b6ef5; text-decoration:none; border:1px solid #dbe3f7;
                   padding:6px 12px; border-radius:8px; background:#fff; cursor:pointer; font-family:inherit; }
  .src:hover, .refresh:hover { background:#f4f7ff; }
  .lp-tok { display:flex; align-items:center; gap:8px; padding:5px 0; font-size:12px; }
  .lp-sym { width:70px; font-weight:600; flex-shrink:0; }
  .loading { color:#8b93a7; padding:40px; text-align:center; }
  .err-msg { color:#dc2626; }
</style></head><body>
<div class="wrap">
  <h1>📊 Invest Portfolio</h1>
  <div class="sub"><span id="sub"></span> · updated <span id="upd">…</span> ·
    <button id="refresh" class="refresh">⟳ Refresh now</button>
    <a class="refresh" href="/pools">🔥 Hot Pools</a></div>
  <div id="warn" class="warn" style="display:none"></div>
  <div class="cards" id="cards"><div class="spinner"></div><div class="loading-txt">Loading portfolios…</div></div>
</div>
<script src="/dash.js"></script>
</body></html>`;

export const DASHBOARD_JS = `
var COLORS = ["#7aa2ff","#3ddc84","#ffb454","#ff7a9c","#9b7aff","#5bd3c7","#e05f9e","#8bd450","#ff8a5c","#5c8aff","#d4d450","#b55cd4","#50d4b4","#ff5c5c","#4fd4e0"];
var TYPE_NAMES = { wallet:"Wallet", deposit:"Deposit", loan:"Loan", borrowed:"Borrowed", staked:"Staked", locked:"Locked", vesting:"Vesting", reward:"Reward" };
var CHAIN_NAMES = { ethereum:"Ethereum", arbitrum:"Arbitrum", optimism:"Optimism", base:"Base", polygon:"Polygon", bsc:"BNB Chain", "binance-smart-chain":"BNB Chain", monad:"Monad", avalanche:"Avalanche", solana:"Solana", fantom:"Fantom", linea:"Linea", zksync:"zkSync", mantle:"Mantle", gnosis:"Gnosis", celo:"Celo", xdai:"Gnosis", "avalanche-c":"Avalanche" };

// Zerion → DefiLlama (для ставок APR/TVL)
var DL_CHAINS = { ethereum:"Ethereum", arbitrum:"Arbitrum", optimism:"OP Mainnet", base:"Base", polygon:"Polygon", "binance-smart-chain":"BSC", bsc:"BSC", avalanche:"Avalanche", fantom:"Fantom", linea:"Linea", mantle:"Mantle", monad:"Monad", solana:"Solana", scroll:"Scroll", blast:"Blast", sei:"Sei", zksync:"ZKsync Era", gnosis:"Gnosis", celo:"Celo" };
var DL_PROJ = { "Uniswap V3":"uniswap-v3", "Uniswap V4":"uniswap-v4", "PancakeSwap V3":"pancakeswap-amm-v3", "Aave V3":"aave-v3", "Aave V4":"aave-v4", "Aave V2":"aave-v3", "Morpho":"morpho-blue", "Morpho Blue":"morpho-blue" };
function normSymDL(s){ var t = String(s||"").toUpperCase(); t = t.replace(/\.(E|B|W)$/,""); if (t === "USD₮0" || t === "USDT0") t = "USDT"; return t; }
var RATES = {}; // ключ "Сеть~проект~символ" → { a: apy, t: tvl }
function dlChainOf(chainId){ return DL_CHAINS[chainId]; }
function rItem(chainId, protocol, sym){
  var c = dlChainOf(chainId), p = DL_PROJ[protocol];
  if (!c || !p) return null;
  return c + "~" + p + "~" + normSymDL(sym);
}
function rateFor(chainId, protocol, symbol){ var it = rItem(chainId, protocol, symbol); return it ? RATES[it] : null; }
function pairRate(chainId, protocol, sym1, sym2){
  var c = dlChainOf(chainId), p = DL_PROJ[protocol];
  if (!c || !p) return null;
  var a = normSymDL(sym1), b = normSymDL(sym2);
  return RATES[c + "~" + p + "~PAIR:" + a + "-" + b] || RATES[c + "~" + p + "~PAIR:" + b + "-" + a];
}
function fmtMoney(v) {
  if (v == null) return "—";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + Math.round(v);
}

function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function fngColor(v) {
  if (v == null) return "#8b93a7";
  if (v < 25) return "#dc2626";
  if (v < 45) return "#f97316";
  if (v < 55) return "#d97706";
  if (v < 75) return "#84cc16";
  return "#0e9f6e";
}
function ratesHtml(r) {
  var rows = "";
  if (r && r.btcUsd) rows += '<div class="rate"><span>₿ Bitcoin</span><b>' + fmtUSD(r.btcUsd) + "</b></div>";
  if (r && r.ethUsd) rows += '<div class="rate"><span>Ξ Ethereum</span><b>' + fmtUSD(r.ethUsd) + "</b></div>";
  if (r && r.usdtRub) rows += '<div class="rate"><span>₮ USDT → ₽</span><b>' + fmtRUB(r.usdtRub) + "</b></div>";
  var fng = (r && r.fng != null)
    ? '<div class="fng"><span class="fng-dot" style="background:' + fngColor(r.fng) + '"></span><b>' + r.fng + "</b> " + esc(r.fngLabel) + "</div>"
    : "";
  return '<div class="comb-col"><h3 class="sec">Markets</h3>' + rows + fng + "</div>";
}
// «обновлено X мин назад» (относительное время)
function timeAgo(iso) {
  var ms = Date.now() - new Date(iso).getTime();
  var min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return min + " min ago";
  var h = Math.floor(min / 60);
  if (h < 24) return h + " h " + (min % 60) + " min ago";
  return Math.floor(h / 24) + " days ago";
}
var LAST_UPDATED = null;
var MARKETS = null; // /api/rates: { btcUsd, ethUsd, usdtRub, fng, fngLabel }
function setUpdated(iso) {
  LAST_UPDATED = iso;
  var el = document.getElementById("upd");
  if (el) el.textContent = timeAgo(iso);
}
function fmtUSD(v) {
  if (v == null || isNaN(v)) return "—";
  return "$" + v.toLocaleString("en-US", { maximumFractionDigits: v >= 1000 ? 0 : 2 });
}
function fmtRUB(v) {
  if (v == null || isNaN(v)) return "—";
  return v.toLocaleString("ru-RU", { maximumFractionDigits: v >= 1000 ? 0 : 2 }) + " ₽";
}
function fmtPct(v) { return (Number(v) || 0).toFixed(1) + "%"; }
function shortAddr(a) { return a.slice(0,6) + "…" + a.slice(-4); }
function chainName(id) { return CHAIN_NAMES[id] || id; }
function chgHtml(change) {
  if (change === undefined || change === null) return "";
  var up = change >= 0;
  return '<span class="chg ' + (up ? "up" : "down") + '">' + (up ? "▲" : "▼") + " " + Math.abs(change).toFixed(2) + "% in 24h</span>";
}
function donut(entries, size, thickness) {
  var total = entries.reduce(function(s,e){ return s + e.value; }, 0);
  if (!total || !entries.length) return "";
  var r = (size - thickness) / 2, c = 2 * Math.PI * r, cx = size/2, cy = size/2, offset = 0, segs = "";
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i], frac = e.value / total, dash = frac * c;
    segs += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + e.color + '" stroke-width="' + thickness + '" stroke-dasharray="' + dash + " " + (c - dash) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 ' + cx + " " + cy + ')"/>';
    offset += dash;
  }
  var center = total >= 1000 ? "$" + Math.round(total).toLocaleString("en-US") : "$" + total.toFixed(2);
  return '<svg viewBox="0 0 ' + size + " " + size + '" width="' + size + '" height="' + size + '" style="flex-shrink:0">' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#eef1f6" stroke-width="' + thickness + '"/>' +
    segs +
    '<text x="' + cx + '" y="' + (cy - 3) + '" text-anchor="middle" fill="#1b2433" font-size="17" font-weight="700">' + center + "</text>" +
    '<text x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle" fill="#8b93a7" font-size="12">total</text></svg>';
}
function legend(entries) {
  var total = entries.reduce(function(s,e){ return s + e.value; }, 0) || 1;
  return entries.map(function(e){
    return '<div class="li"><span class="dot" style="background:' + e.color + '"></span>' +
      '<span class="lname">' + esc(e.label) + '</span>' +
      '<span class="lpct">' + fmtPct(e.value / total * 100) + '</span>' +
      '<span class="lval">' + fmtUSD(e.value) + "</span></div>";
  }).join("");
}
function combined(snap) {
  // Нетто-донат: DeFi показываем за вычетом долга (borrowed), чтобы верхняя
  // сумма «All wallets» ВСЕГДА равнялась сумме сегментов доната. Долг — отдельной
  // красной строкой в самари и в карточке кошелька.
  var cats = { stable:0, crypto:0, defi:0, borrowed:0 }, total = 0, num = 0, den = 0;
  snap.wallets.forEach(function(w){
    if (!w.ok || !w.portfolio) return;
    total += w.portfolio.totalUsd || w.portfolio.total || 0; // РФ-кошелёк: total в ₽, для доната totalUsd
    var c = w.categoriesUsd || w.categories || {};
    cats.stable += c.stable || 0;
    cats.crypto += c.crypto || 0;
    cats.defi += c.defi || 0;
    cats.borrowed += c.borrowed || 0;
    var base = w.portfolio.totalUsd || w.portfolio.total || 0;
    var pct = w.portfolio.changes && w.portfolio.changes.percent_1d;
    if (pct !== undefined && base) { num += base * pct; den += base; }
  });
  var defiNet = Math.max(cats.defi - cats.borrowed, 0);
  var top = [
    { label:"Stablecoins", value:cats.stable, color:"#3ddc84" },
    { label:"Crypto", value:cats.crypto, color:"#7aa2ff" },
    { label:"In DeFi (net)", value:defiNet, color:"#ffb454" },
  ].filter(function(e){ return e.value > 0; });
  // Верхняя сумма = сумма сегментов доната (stable + crypto + defi net), чтобы
  // «All wallets» ВСЕГДА совпадала с диаграммой. portfolio.total может
  // отличаться на копейки из-за округлений Zerion — не берём его в сумму.
  total = cats.stable + cats.crypto + defiNet;
  return { total: total, change: den ? num / den : undefined, top: top, cats: cats, defiNet: defiNet };
}
function defiRow(c, fmt) {
  fmt = fmt || fmtUSD;
  c = c || {};
  var defi = c.defi || 0, wallet = (c.stable || 0) + (c.crypto || 0), borrowed = c.borrowed || 0;
  var defiNet = Math.max(defi - borrowed, 0); // нетто: в пулах за вычетом долга
  var assets = defiNet + wallet;
  if (!assets && !borrowed) return "";
  var p = assets ? Math.round(defiNet / assets * 100) : 0;
  var html = '<div class="stats"><span class="stat">💰 In pools: <b>' + fmt(defiNet) + '</b> (' + p + '%)</span>' +
    '<span class="stat">💼 Available: <b>' + fmt(wallet) + '</b></span>';
  if (borrowed > 0) html += '<span class="stat debt">💳 Debt: <b>' + fmt(borrowed) + '</b></span>';
  return html + '</div>';
}
function fmtAmount(v) {
  if (v == null || isNaN(v)) return "—";
  if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 1) return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return v.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
function parsePool(name) {
  var m = name.match(/^(.*?)\\s+([^\\s/]+)\\/([^\\s/]+)\\s+Pool\\s+\\(#(\\d+)\\)$/);
  if (!m) return { protocol: name, pair: name, id: "" };
  return { protocol: m[1], pair: m[2] + "/" + m[3], id: "#" + m[4] };
}
var LP_TYPES = { deposit: 1, staked: 1, locked: 1, vesting: 1 };
var LEND_TYPES = { deposit: 1, staked: 1, locked: 1, vesting: 1, loan: 1, borrowed: 1 };
function groupPositions(pos) {
  var pools = {}, lend = {}, fees = {}, regular = [];
  pos.forEach(function(a){
    if (a.type === "reward" && a.pool) {
      fees[a.pool] = (fees[a.pool] || 0) + a.value; // unclaimed position fees
    } else if (a.pool && LP_TYPES[a.type]) {
      var g = pools[a.pool] || (pools[a.pool] = { name: a.pool, protocol: a.protocol, chain: a.chain, tokens: [], total: 0 });
      g.tokens.push(a);
      g.total += a.value;
    } else if (a.protocol && LEND_TYPES[a.type]) {
      var key = a.protocol + "|" + a.chain;
      var l = lend[key] || (lend[key] = { protocol: a.protocol, chain: a.chain, deposits: [], borrows: [], total: 0 });
      (a.type === "loan" || a.type === "borrowed" ? l.borrows : l.deposits).push(a);
      l.total += a.value;
    } else {
      regular.push(a);
    }
  });
  return {
    lp: Object.keys(pools).map(function(k){ return pools[k]; }),
    lend: Object.keys(lend).map(function(k){ return lend[k]; }),
    regular: regular,
    fees: fees,
  };
}
function lpCard(g, fees) {
  var pp = parsePool(g.name);
  var rate = pairRate(g.chain, g.protocol, g.tokens[0].symbol, g.tokens.length > 1 ? g.tokens[1].symbol : g.tokens[0].symbol);
  var pairHtml = esc(pp.pair.split("/").join(" / ")) + (rate && rate.f ? ' <span class="lp-fee">' + esc(rate.f) + "</span>" : "");
  var stats = [];
  if (rate && rate.a > 0) stats.push("APR " + rate.a.toFixed(1) + "%");
  if (rate && rate.t > 0) stats.push("TVL " + fmtMoney(rate.t));
  if (rate && rate.t > 0 && g.total > 0) stats.push("Share " + (g.total / rate.t * 100).toFixed(4) + "%");
  if (fees > 0) stats.push("Fees $" + fees.toFixed(2));
  var sub = esc(pp.protocol) + " · " + chainName(g.chain) + " · LP";
  if (stats.length) sub += " · " + stats.join(" · ");
  var tokens = g.tokens.map(function(t){
    var amt = t.amount != null ? fmtAmount(t.amount) : "—";
    var icon = t.icon
      ? '<img class="ic" src="' + esc(t.icon) + '" alt="" onerror="this.remove()"/>'
      : '<span class="ic ph-ic">' + esc(t.symbol.slice(0,1)) + "</span>";
    return '<div class="lp-tok">' + icon +
      '<span class="lp-sym">' + esc(t.symbol) + "</span>" +
      '<span class="lp-amt">' + amt + "</span>" +
      '<span class="lp-val">' + fmtUSD(t.value) + "</span></div>";
  }).join("");
  return '<div class="lp">' +
    '<div class="lp-head"><div class="lp-main"><div class="lp-pair"><b>' + pairHtml + '</b> <span class="lp-id">' + esc(pp.id) + "</span></div>" +
    '<div class="lp-sub">' + sub + "</div></div>" +
    '<div class="lp-total">' + fmtUSD(g.total) + "</div></div>" +
    '<div class="lp-toks">' + tokens + "</div></div>";
}
function lendingCard(l, health) {
  var row = function(a, borrow){
    var apy = rateFor(l.chain, l.protocol, a.symbol);
    var apyHtml = apy && apy.a > 0
      ? '<span class="lp-apy' + (borrow ? " down" : "") + '">' + apy.a.toFixed(2) + "%</span>"
      : "";
    var icon = a.icon
      ? '<img class="ic" src="' + esc(a.icon) + '" alt="" onerror="this.remove()"/>'
      : '<span class="ic ph-ic">' + esc(a.symbol.slice(0,1)) + "</span>";
    var amt = a.amount != null ? fmtAmount(a.amount) : "—";
    return '<div class="lp-tok">' + icon +
      '<span class="lp-sym">' + esc(a.symbol) + "</span>" +
      '<span class="lp-amt">' + amt + "</span>" + apyHtml +
      '<span class="lp-val">' + fmtUSD(a.value) + "</span></div>";
  };
  var hfHtml = "";
  if (health && health.hasDebt && /aave/i.test(l.protocol)) {
    var cls = health.hf >= 1.5 ? "hf-ok" : health.hf >= 1.1 ? "hf-warn" : "hf-bad";
    hfHtml = '<span class="lp-hf ' + cls + '">Health ' + health.hf.toFixed(2) + "</span>";
  }
  var html = '<div class="lp"><div class="lp-head"><div class="lp-main"><div class="lp-pair"><b>' + esc(l.protocol) + "</b></div>" +
    '<div class="lp-sub">' + chainName(l.chain) + "</div></div>" +
    hfHtml +
    '<div class="lp-total">' + fmtUSD(l.total) + "</div></div>";
  if (l.deposits.length) html += '<div class="lp-sec">Deposits</div>' + l.deposits.map(function(a){ return row(a, false); }).join("");
  if (l.borrows.length) html += '<div class="lp-sec">Borrows</div>' + l.borrows.map(function(a){ return row(a, true); }).join("");
  return html + "</div>";
}
function walletCard(w, wi) {
  var fmt = w.currency === "RUB" ? fmtRUB : fmtUSD; // Russian Stocks — в рублях
  if (!w.ok) {
    return '<div class="card"><div class="head"><b>' + esc(w.name) + '</b> <span class="err">ERR</span>' +
      '<span class="time">' + timeAgo(w.checkedAt) + "</span></div>" +
      srcLinks(w, "top") +
      '<div class="url">' + esc(w.address) + "</div>" +
      '<div class="err-msg">' + esc(w.error) + "</div></div>";
  }
  var pf = w.portfolio, change = pf.changes && pf.changes.percent_1d;
  var grouped = groupPositions(w.positions);
  var assetsTotal = w.positions.reduce(function(s,a){ return s + a.value; }, 0) || 1;
  var lpCards = grouped.lp.map(function(g){ return lpCard(g, grouped.fees[g.name] || 0); }).join("");
  var lendCards = grouped.lend.map(function(l){ return lendingCard(l, w.health); }).join("");
  var rows = grouped.regular.slice(0, 10).map(function(a){
    var pct = a.value / assetsTotal * 100;
    var icon = a.icon
      ? '<img class="ic" src="' + esc(a.icon) + '" alt="" onerror="this.remove()"/>'
      : '<span class="ic ph-ic">' + esc(a.symbol.slice(0,1)) + "</span>";
    var sub = [chainName(a.chain), TYPE_NAMES[a.type] || a.type, a.protocol].filter(Boolean).join(" · ");
    return '<div class="arow">' + icon +
      '<div class="aname"><b>' + esc(a.symbol) + "</b><span>" + esc(sub) + "</span></div>" +
      '<div class="abar"><div class="abar-fill" style="width:' + Math.max(pct, 0.4) + '%"></div></div>' +
      '<div class="aval">' + fmt(a.value) + '</div><div class="apct">' + pct.toFixed(1) + "%</div></div>";
  }).join("");
  return '<div class="card"><div class="head"><b>' + esc(w.name) + '</b> <span class="ok">' + (pf.total ? "OK" : "0") + "</span>" +
    '<span class="time">' + timeAgo(w.checkedAt) + "</span></div>" +
    srcLinks(w, "top") +
    '<div class="url">' + esc(w.address) + " · " + shortAddr(w.address) + "</div>" +
    '<div class="total-row"><span class="total">' + fmt(pf.total) + "</span> " + chgHtml(change) + "</div>" +
    defiRow(w.categories, fmt) +
    '<h3 class="sec">Assets</h3>' + (lpCards + lendCards + rows || '<div class="err-msg">no assets</div>') + "</div>";
}
function srcLinks(w, cls) {
  var links = (w.sources || []).map(function(s){
    return '<a class="src" href="' + esc(s.url) + '" target="_blank" rel="noopener">↗ ' + esc(s.name) + "</a>";
  }).join("");
  if (!links) return "";
  return '<div class="srcs' + (cls ? " " + cls : "") + '">' + links + "</div>";
}
function render(snap) {
  document.getElementById("sub").textContent = location.hostname;
  setUpdated(snap.updatedAt);
  var warn = document.getElementById("warn");
  if (snap.error) {
    warn.style.display = "block";
    warn.innerHTML = "⚠️ " + esc(snap.error) + " — set the key via <code>wrangler secret put ZERION_API_KEY</code> and press Refresh";
  }
  var c = combined(snap), html = "";
  if (c.total) {
    html += '<div class="card comb"><div class="head"><b>All wallets</b> <span class="ok">OK</span>' +
      '<span class="time">' + timeAgo(snap.updatedAt) + "</span></div>" +
      '<div class="comb-cols">' +
      ratesHtml(MARKETS) +
      '<div class="comb-col"><div class="total-row"><span class="total big">' + fmtUSD(c.total) + "</span> " + chgHtml(c.change) + "</div>" +
      defiRow(c.cats) + "</div>" +
      '<div class="comb-col"><div class="chart-wrap">' + donut(c.top, 230, 30) + '<div class="legend">' + legend(c.top) + "</div></div></div>" +
      "</div></div>";
  }
  snap.wallets.forEach(function(w, i){ html += walletCard(w, i); });
  document.getElementById("cards").innerHTML = html || '<div class="loading">no data</div>';
}
document.getElementById("refresh").addEventListener("click", function(){
  fetch("/api/refresh").then(function(){ location.reload(); });
});
Promise.all([
  fetch("/api/data").then(function(r){ return r.json(); }),
  fetch("/api/rates").then(function(r){ return r.json(); }).catch(function(){ return null; }),
]).then(function(arr){
  var snap = arr[0];
  MARKETS = arr[1];
  var want = {};
  var add = function(it){ if (it) want[it] = 1; };
  var pools = {};
  (snap.wallets || []).forEach(function(w){
    (w.positions || []).forEach(function(p){
      if (p.pool && LP_TYPES[p.type]) (pools[p.pool] = pools[p.pool] || []).push(p);
      if (p.protocol && DL_PROJ[p.protocol]) add(rItem(p.chain, p.protocol, p.symbol));
    });
  });
  Object.keys(pools).forEach(function(k){
    var t = pools[k];
    if (t.length < 2) return;
    var c = dlChainOf(t[0].chain), p = DL_PROJ[t[0].protocol];
    if (!c || !p) return;
    var a = normSymDL(t[0].symbol), b = normSymDL(t[1].symbol);
    add(c + "~" + p + "~PAIR:" + a + "-" + b);
    add(c + "~" + p + "~PAIR:" + b + "-" + a);
  });
  var q = Object.keys(want);
  if (!q.length) { render(snap); return; }
  return fetch("/api/defirates?q=" + encodeURIComponent(q.join(",")))
    .then(function(r){ return r.json(); })
    .then(function(m){
      RATES = m || {};
      render(snap);
    });
}).catch(function(e){
  document.getElementById("cards").innerHTML = '<div class="loading">Load error: ' + esc(e.message) + "</div>";
});
setInterval(function(){ if (LAST_UPDATED) setUpdated(LAST_UPDATED); }, 30000);
`;
