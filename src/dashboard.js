// src/dashboard.js
// Статичная HTML-оболочка дашборда. Worker отдаёт её как есть (0 работы при
// запросе), а страница сама тянет /api/data и рендерит всё в браузере.
// Почему так: на бесплатном тарифе Workers (10мс CPU, свежий изолят на запрос)
// сборка большого HTML сервером не укладывается в лимит — а нативный JSON
// (fetch /api/data) и клиентский рендер работают без проблем.

export const DASHBOARD_HTML = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invest Portfolio — Дашборд</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         background:#f4f6fa; color:#1b2433; margin:0; padding:20px; }
  .wrap { max-width:1280px; margin:0 auto; }
  h1 { font-size:22px; margin:0 0 4px; }
  .sub { color:#66718a; font-size:13px; margin-bottom:20px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(380px,1fr)); gap:16px; }
  @media (max-width:640px) {
    body { padding:12px; }
    .cards { grid-template-columns:1fr; }
    h1 { font-size:19px; }
  }
  .card { background:#fff; border:1px solid #e4e8f0; border-radius:14px; padding:18px;
          box-shadow:0 1px 2px rgba(16,24,40,.04); }
  .card.comb { grid-column:1 / -1; margin-bottom:4px; }
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
  .lname { color:#5a6478; flex:1; }
  .lpct { color:#1b2433; font-weight:600; }
  .lval { color:#8b93a7; }
  h3.sec { font-size:12px; color:#66718a; margin:14px 0 8px; text-transform:uppercase; letter-spacing:.5px; }
  .arow { display:flex; align-items:center; gap:10px; padding:7px 0; border-top:1px solid #f0f2f7; font-size:12px; }
  .ic { width:22px; height:22px; border-radius:50%; flex-shrink:0; }
  .ph-ic { background:#eef2f7; color:#66718a; display:flex; align-items:center; justify-content:center; font-size:10px; }
  .aname { width:110px; flex-shrink:0; }
  .aname b { display:block; } .aname span { color:#8b93a7; font-size:10px; }
  .abar { flex:1; background:#eef1f6; height:6px; border-radius:3px; overflow:hidden; }
  .abar-fill { background:#3b6ef5; height:100%; border-radius:3px; }
  .aval { width:74px; text-align:right; color:#1b2433; font-weight:600; }
  .apct { width:48px; text-align:right; color:#8b93a7; }
  .srcs { display:flex; gap:8px; margin-top:14px; flex-wrap:wrap; }
  .src, .refresh { font-size:12px; color:#3b6ef5; text-decoration:none; border:1px solid #dbe3f7;
                   padding:6px 12px; border-radius:8px; background:#fff; cursor:pointer; font-family:inherit; }
  .src:hover, .refresh:hover { background:#f4f7ff; }
  .loading { color:#8b93a7; padding:40px; text-align:center; }
  .err-msg { color:#dc2626; }
</style></head><body>
<div class="wrap">
  <h1>📊 Инвест-портфель</h1>
  <div class="sub"><span id="sub"></span> · обновлено <span id="upd">…</span> · крон раз в 15 мин ·
    <button id="refresh" class="refresh">⟳ обновить сейчас</button>
    <a class="refresh" href="/pools">🔥 Горячие пулы</a></div>
  <div id="warn" class="warn" style="display:none"></div>
  <div class="cards" id="cards"><div class="loading">Загрузка…</div></div>
</div>
<script>
var COLORS = ["#7aa2ff","#3ddc84","#ffb454","#ff7a9c","#9b7aff","#5bd3c7","#e05f9e","#8bd450","#ff8a5c","#5c8aff","#d4d450","#b55cd4","#50d4b4","#ff5c5c","#4fd4e0"];
var TYPE_NAMES = { wallet:"кошелёк", deposit:"депозит", loan:"займ", borrowed:"займ", staked:"стейк", locked:"лок", vesting:"вестинг", reward:"награда" };
var CHAIN_NAMES = { ethereum:"Ethereum", arbitrum:"Arbitrum", optimism:"Optimism", base:"Base", polygon:"Polygon", bsc:"BNB Chain", "binance-smart-chain":"BNB Chain", monad:"Monad", avalanche:"Avalanche", solana:"Solana", fantom:"Fantom", linea:"Linea", zksync:"zkSync", mantle:"Mantle", gnosis:"Gnosis", celo:"Celo", xdai:"Gnosis", "avalanche-c":"Avalanche" };

function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
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
  return '<span class="chg ' + (up ? "up" : "down") + '">' + (up ? "▲" : "▼") + " " + Math.abs(change).toFixed(2) + "% за 24ч</span>";
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
  var chains = {}, total = 0, num = 0, den = 0;
  snap.wallets.forEach(function(w){
    if (!w.ok || !w.portfolio) return;
    total += w.portfolio.total || 0;
    var ch = w.portfolio.chains || {};
    Object.keys(ch).forEach(function(id){ chains[id] = (chains[id] || 0) + ch[id]; });
    var pct = w.portfolio.changes && w.portfolio.changes.percent_1d;
    if (pct !== undefined && w.portfolio.total) { num += w.portfolio.total * pct; den += w.portfolio.total; }
  });
  var arr = Object.keys(chains).map(function(id){ return { label: chainName(id), value: chains[id] }; })
    .sort(function(a,b){ return b.value - a.value; });
  var top = arr.slice(0, 8), rest = 0;
  for (var i = 8; i < arr.length; i++) rest += arr[i].value;
  if (rest > 0) top.push({ label: "Прочее", value: rest });
  top.forEach(function(e, i){ e.color = COLORS[i]; });
  return { total: total, change: den ? num / den : undefined, top: top };
}
function walletCard(w, wi) {
  if (!w.ok) {
    return '<div class="card"><div class="head"><b>' + esc(w.name) + '</b> <span class="err">ERR</span>' +
      '<span class="time">' + new Date(w.checkedAt).toLocaleString("ru-RU") + "</span></div>" +
      '<div class="url">' + esc(w.address) + "</div>" +
      '<div class="err-msg">' + esc(w.error) + "</div>" + srcLinks(w) + "</div>";
  }
  var pf = w.portfolio, change = pf.changes && pf.changes.percent_1d;
  var assets = w.positions.slice(0, 15);
  var assetsTotal = w.positions.reduce(function(s,a){ return s + a.value; }, 0) || 1;
  var rows = assets.map(function(a){
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
    '<span class="time">' + new Date(w.checkedAt).toLocaleString("ru-RU") + "</span></div>" +
    '<div class="url">' + esc(w.address) + " · " + shortAddr(w.address) + "</div>" +
    '<div class="total-row"><span class="total">' + fmtUSD(pf.total) + "</span> " + chgHtml(change) + "</div>" +
    '<h3 class="sec">Активы</h3>' + (rows || '<div class="err-msg">нет активов</div>') + srcLinks(w) + "</div>";
}
function srcLinks(w) {
  var links = (w.sources || []).map(function(s){
    return '<a class="src" href="' + esc(s.url) + '" target="_blank" rel="noopener">↗ ' + esc(s.name) + "</a>";
  }).join("");
  return links ? '<div class="srcs">' + links + "</div>" : "";
}
function render(snap) {
  document.getElementById("sub").textContent = location.hostname;
  document.getElementById("upd").textContent = new Date(snap.updatedAt).toLocaleString("ru-RU");
  var warn = document.getElementById("warn");
  if (snap.error) {
    warn.style.display = "block";
    warn.innerHTML = "⚠️ " + esc(snap.error) + " — задайте ключ через <code>wrangler secret put ZERION_API_KEY</code> и нажмите «обновить»";
  }
  var c = combined(snap), html = "";
  if (c.total) {
    html += '<div class="card comb"><div class="head"><b>Все кошельки</b> <span class="ok">OK</span>' +
      '<span class="time">' + new Date(snap.updatedAt).toLocaleString("ru-RU") + "</span></div>" +
      '<div class="total-row"><span class="total big">' + fmtUSD(c.total) + "</span> " + chgHtml(c.change) + "</div>" +
      '<div class="chart-wrap">' + donut(c.top, 230, 30) + '<div class="legend">' + legend(c.top) + "</div></div></div>";
  }
  snap.wallets.forEach(function(w, i){ html += walletCard(w, i); });
  document.getElementById("cards").innerHTML = html || '<div class="loading">нет данных</div>';
}
document.getElementById("refresh").addEventListener("click", function(){
  fetch("/api/refresh").then(function(){ location.reload(); });
});
fetch("/api/data").then(function(r){ return r.json(); }).then(render).catch(function(e){
  document.getElementById("cards").innerHTML = '<div class="loading">Ошибка загрузки: ' + esc(e.message) + "</div>";
});
</script>
</body></html>`;
