#!/usr/bin/env node
// scripts/sync-pools.mjs
// Синхронизация «Горячих пулов»: качает дамп DefiLlama, фильтрует по watchlist,
// считает средние APY за окна, рендерит страницу и JSON, пишет в Cloudflare KV.
//
// Почему так: DefiLlama не фильтрует пулы на своей стороне (всегда отдаёт дамп
// 10.9MB), а его парсинг (~40мс CPU) не помещается в 10мс бесплатного тарифа
// Workers. Поэтому тяжёлая работа выполняется здесь (Mac / GitHub Actions),
// а Cloudflare только отдаёт готовые строки.
//
// Запуск локально:    node scripts/sync-pools.mjs
// В GitHub Actions:   .github/workflows/sync-pools.yml (тот же скрипт)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPoolsData, renderPoolsPage, renderApiJsonIndex, renderApiJsonCategory } from "../src/pools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, ".sync-out");
const YIELDS_URL = "https://yields.llama.fi/pools";
const SUBDOMAIN = "portfolio.leonidengel.workers.dev";

// Нормализация символов для сверки с DefiLlama (USDT0/USD₮0 → USDT и т.п.)
function normSym(s) {
  let t = String(s || "").toUpperCase();
  t = t.replace(/\.(E|B|W)$/, "");
  if (t === "USD₮0" || t === "USDT0") t = "USDT";
  return t;
}

// Карта ставок (APR/TVL) по протоколам наших позиций: лендинг по символу,
// DEX-пары по обоим порядкам. Сгруппирована по сетям — пишем отдельным KV-ключом
// на сеть (большой единый ответ не проходит через лимит бесплатного тарифа).
// Ключ внутри сети: "проект|символ" или "проект|PAIR:A-B".
const RATE_PROJECTS = new Set([
  "aave-v3", "aave-v4", "morpho-blue", "uniswap-v3", "uniswap-v4",
  "pancakeswap-amm-v3", "pancakeswap-amm",
]);
function buildRates(dump) {
  const byChain = {};
  const consider = (chain, key, apy, tvl, fee) => {
    if (!chain || !key) return;
    const m = byChain[chain] || (byChain[chain] = {});
    const prev = m[key];
    if (!prev || (tvl || 0) > (prev.t || 0)) {
      m[key] = { a: apy != null ? +Number(apy).toFixed(2) : null, t: Math.round(tvl || 0), f: fee || "" };
    }
  };
  for (const p of dump) {
    if (!RATE_PROJECTS.has(p.project)) continue;
    const apy = p.apyBase ?? p.apy ?? null;
    const tvl = p.tvlUsd || 0;
    const fee = p.poolMeta || ""; // комиссия пула («0.3%»)
    const sym = normSym(p.symbol);
    consider(p.chain, `${p.project}|${sym}`, apy, tvl, fee);
    const toks = String(p.symbol || "").split("-").filter(Boolean).map(normSym);
    if (toks.length === 2) {
      consider(p.chain, `${p.project}|PAIR:${toks[0]}-${toks[1]}`, apy, tvl, fee);
      consider(p.chain, `${p.project}|PAIR:${toks[1]}-${toks[0]}`, apy, tvl, fee);
    }
  }
  return byChain;
}

async function main() {
  console.log("[sync-pools] скачиваю дамп DefiLlama…");
  const res = await fetch(YIELDS_URL);
  if (!res.ok) throw new Error(`DefiLlama ${res.status}`);
  const dump = (await res.json()).data;
  console.log(`[sync-pools] пулов в дампе: ${dump.length}`);

  console.log("[sync-pools] классификация по watchlist + средние APY (чарты)…");
  const data = await buildPoolsData(dump);
  console.log(`[sync-pools] blue-chip: ${data.blueChip.length}, stable: ${data.stableCoin.length}, fix: ${data.fix.length}`);
  if (!data.blueChip.length && !data.stableCoin.length && !data.fix.length) throw new Error("не нашлось пулов по watchlist");

  const html = renderPoolsPage(data, SUBDOMAIN);
  // JSON по одному ключу на категорию: все 150 пулов (~29KB) не проходят
  // лимит ответа бесплатного тарифа, клиент тянет категории по отдельности.
  const cats = ["blueChip", "stableCoin", "fix"];
  const ratesByChain = buildRates(dump);
  fs.mkdirSync(OUT, { recursive: true });
  const htmlFile = path.join(OUT, "pools.html");
  const jsonFiles = {};
  for (const c of cats) {
    jsonFiles[c] = path.join(OUT, `pools-${c}.json`);
    fs.writeFileSync(jsonFiles[c], renderApiJsonCategory(c, data));
  }
  const idxFile = path.join(OUT, "pools-index.json");
  fs.writeFileSync(idxFile, renderApiJsonIndex(data));
  const totalBytes = Object.entries(ratesByChain).reduce((s, [, m]) => s + JSON.stringify(m).length, 0);
  console.log(`[sync-pools] рендер: html ${(html.length / 1024).toFixed(1)}KB, категории: ${cats.map((c) => `${c} ${(jsonFiles[c] ? fs.statSync(jsonFiles[c]).size / 1024 : 0).toFixed(1)}KB`).join(", ")}, rates по ${Object.keys(ratesByChain).length} сетям (${(totalBytes / 1024).toFixed(1)}KB всего)`);

  await putKV("poolsHtml", htmlFile);
  for (const c of cats) await putKV(`poolsJson:${c}`, jsonFiles[c]);
  await putKV("poolsIndex", idxFile);
  // Ставки: индекс + по одному ключу на сеть (большой единый ответ не проходит)
  const ratesIndexFile = path.join(OUT, "defirates-index.json");
  fs.writeFileSync(ratesIndexFile, JSON.stringify({ chains: Object.keys(ratesByChain).sort() }));
  await putKV("defiRates", ratesIndexFile);
  for (const [chain, m] of Object.entries(ratesByChain)) {
    const f = path.join(OUT, `defirates-${chain.replace(/[^a-z0-9-]/gi, "_")}.json`);
    fs.writeFileSync(f, JSON.stringify(m));
    await putKV(`defiRates:${chain}`, f);
  }
  console.log("[sync-pools] готово ✔");
}

// Пишем значение в KV через wrangler (нужна авторизация: локально OAuth,
// в Actions — секреты CLOUDFLARE_API_TOKEN и CLOUDFLARE_ACCOUNT_ID)
function putKV(key, file) {
  const args = ["--yes", "wrangler", "kv", "key", "put", "--binding", "DATA", key, "--path", file, "--remote"];
  console.log(`[sync-pools] KV write → ${key}`);
  execFileSync("npx", args, { cwd: ROOT, encoding: "utf8", stdio: "inherit" });
}

main().catch((e) => {
  console.error("[sync-pools] ОШИБКА:", e.message);
  process.exit(1);
});
