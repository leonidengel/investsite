// src/dashboard.js
// Статичная HTML-оболочка дашборда (DASHBOARD_HTML) + клиентский JS (DASHBOARD_JS).
// Worker отдаёт их как есть (0 работы при запросе), браузер сам тянет /api/data
// и рисует всё. Клиентский JS вынесен в отдельный ответ /dash.js: суммарно HTML+JS
// больше лимита ответа бесплатного тарифа (~19.5KB), по отдельности — меньше.

export const DASHBOARD_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
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
  .cards { display:grid; grid-template-columns:repeat(2, 1fr); gap:16px; }
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
  .stats { display:flex; gap:16px; flex-wrap:wrap; margin:0 0 12px; font-size:12px; color:#66718a; }
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
  .lp-id { color:#8b93a7; font-size:10px; font-weight:400; }
  .lp-fee { color:#3b6ef5; font-size:11px; font-weight:600; }
  .lp-sub { color:#8b93a7; font-size:10px; }
  .lp-rate { align-self:center; color:#0e9f6e; font-size:11px; font-weight:600; white-space:nowrap; }
  .lp-total { font-weight:700; font-size:13px; align-self:center; }
  .lp-sec { font-size:10px; color:#8b93a7; text-transform:uppercase; letter-spacing:.5px; margin:8px 0 2px; }
  .lp-apy { font-size:11px; font-weight:600; color:#0e9f6e; white-space:nowrap; }
  .lp-apy.down { color:#dc2626; }
  .lp-hf { font-size:11px; font-weight:700; white-space:nowrap; align-self:center; }
  .hf-ok { color:#0e9f6e; }
  .hf-warn { color:#d97706; }
  .hf-bad { color:#dc2626; }
  .lp-toks { margin-top:8px; border-top:1px dashed #e4e8f0; }
  .lp-tok { display:flex; align-items:center; gap:8px; padding:5px 0; font-size:12px; }
  .lp-sym { width:70px; font-weight:600; flex-shrink:0; }
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

// Zerion-сеть/протокол → имена DefiLlama для сверки ставок (APR/TVL)
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
function setUpdated(iso) {
  LAST_UPDATED = iso;
  var el = document.getElementById("upd");
  if (el) el.textContent = timeAgo(iso);
}
function fmtUSD(v) {
  if (v == null || isNaN(v)) return "—";
  return "$" + v.toLocaleString("en-US", { maximumFractionDigits: v >= 1000 ? 0 : 2 });
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
  var cats = { stable:0, crypto:0, defi:0, borrowed:0 }, total = 0, num = 0, den = 0;
  snap.wallets.forEach(function(w){
    if (!w.ok || !w.portfolio) return;
    total += w.portfolio.total || 0;
    var c = w.categories || {};
    cats.stable += c.stable || 0;
    cats.crypto += c.crypto || 0;
    cats.defi += c.defi || 0;
    cats.borrowed += c.borrowed || 0;
    var pct = w.portfolio.changes && w.portfolio.changes.percent_1d;
    if (pct !== undefined && w.portfolio.total) { num += w.portfolio.total * pct; den += w.portfolio.total; }
  });
  var top = [
    { label:"Stablecoins", value:cats.stable, color:"#3ddc84" },
    { label:"Crypto", value:cats.crypto, color:"#7aa2ff" },
    { label:"In DeFi", value:cats.defi, color:"#ffb454" },
  ].filter(function(e){ return e.value > 0; });
  return { total: total, change: den ? num / den : undefined, top: top, cats: cats };
}
// Строка «в пулах vs на кошельке» (как у Krystal) + долг, если есть
function defiRow(c) {
  c = c || {};
  var defi = c.defi || 0, wallet = (c.stable || 0) + (c.crypto || 0), borrowed = c.borrowed || 0;
  var assets = defi + wallet;
  if (!assets) return "";
  var p = Math.round(defi / assets * 100);
  var html = '<div class="stats"><span class="stat">💰 In pools: <b>' + fmtUSD(defi) + '</b> (' + p + '%)</span>' +
    '<span class="stat">💼 Available: <b>' + fmtUSD(wallet) + '</b></span>';
  if (borrowed > 0) html += '<span class="stat debt">💳 Debt: <b>' + fmtUSD(borrowed) + '</b></span>';
  return html + '</div>';
}
function fmtAmount(v) {
  if (v == null || isNaN(v)) return "—";
  if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 1) return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return v.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
// Разбираем «PancakeSwap V3 USDT/USDe Pool (#7038688)» → { protocol, pair, id }
// Пара — последний сегмент с "/" перед " Pool (#id)". ВАЖНО: внутри внешнего
// шаблона-литерала бэкслеши удваиваются (\\\\ → \\ в клиенте).
function parsePool(name) {
  var m = name.match(/^(.*?)\\s+([^\\s/]+)\\/([^\\s/]+)\\s+Pool\\s+\\(#(\\d+)\\)$/);
  if (!m) return { protocol: name, pair: name, id: "" };
  return { protocol: m[1], pair: m[2] + "/" + m[3], id: "#" + m[4] };
}
// Группируем позиции: LP-пары (одинаковый pool) — одной карточкой; лендинг
// (Aave/Morpho, протокол + депозит/займ) — карточками как в DeBank; остальное — как есть.
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
// Карточка лендинга (Aave/Morpho) в стиле DeBank: депозиты + займы с APY и Health Factor
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
      '<div class="aval">' + fmtUSD(a.value) + '</div><div class="apct">' + pct.toFixed(1) + "%</div></div>";
  }).join("");
  return '<div class="card"><div class="head"><b>' + esc(w.name) + '</b> <span class="ok">' + (pf.total ? "OK" : "0 USD") + "</span>" +
    '<span class="time">' + timeAgo(w.checkedAt) + "</span></div>" +
    srcLinks(w, "top") +
    '<div class="url">' + esc(w.address) + " · " + shortAddr(w.address) + "</div>" +
    '<div class="total-row"><span class="total">' + fmtUSD(pf.total) + "</span> " + chgHtml(change) + "</div>" +
    defiRow(w.categories) +
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
      '<div class="total-row"><span class="total big">' + fmtUSD(c.total) + "</span> " + chgHtml(c.change) + "</div>" +
      defiRow(c.cats) +
      '<div class="chart-wrap">' + donut(c.top, 230, 30) + '<div class="legend">' + legend(c.top) + "</div></div></div>";
  }
  snap.wallets.forEach(function(w, i){ html += walletCard(w, i); });
  document.getElementById("cards").innerHTML = html || '<div class="loading">no data</div>';
}
document.getElementById("refresh").addEventListener("click", function(){
  fetch("/api/refresh").then(function(){ location.reload(); });
});
Promise.all([
  fetch("/api/data").then(function(r){ return r.json(); }),
]).then(function(arr){
  var snap = arr[0];
  // Собираем ключи ставок, которые реально нужны (LP-пары + лендинг по символам)
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
