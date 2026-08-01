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
import { buildPoolsData, renderPoolsPage, renderApiJson } from "../src/pools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, ".sync-out");
const YIELDS_URL = "https://yields.llama.fi/pools";
const SUBDOMAIN = "portfolio.leonidengel.workers.dev";

async function main() {
  console.log("[sync-pools] скачиваю дамп DefiLlama…");
  const res = await fetch(YIELDS_URL);
  if (!res.ok) throw new Error(`DefiLlama ${res.status}`);
  const dump = (await res.json()).data;
  console.log(`[sync-pools] пулов в дампе: ${dump.length}`);

  console.log("[sync-pools] классификация по watchlist + средние APY (чарты)…");
  const data = await buildPoolsData(dump);
  console.log(`[sync-pools] blue-chip: ${data.blueChip.length}, stable: ${data.stableCoin.length}`);
  if (!data.blueChip.length && !data.stableCoin.length) throw new Error("не нашлось пулов по watchlist");

  const html = renderPoolsPage(data, SUBDOMAIN);
  const json = renderApiJson(data);
  fs.mkdirSync(OUT, { recursive: true });
  const htmlFile = path.join(OUT, "pools.html");
  const jsonFile = path.join(OUT, "pools.json");
  fs.writeFileSync(htmlFile, html);
  fs.writeFileSync(jsonFile, json);
  console.log(`[sync-pools] рендер: html ${(html.length / 1024).toFixed(1)}KB, json ${(json.length / 1024).toFixed(1)}KB`);

  await putKV("poolsHtml", htmlFile);
  await putKV("poolsJson", jsonFile);
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
