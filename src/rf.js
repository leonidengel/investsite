// src/rf.js
// РФ-инструменты (бэкенд-слой, UI пока не нужен) — только watchlist из config.js.
// Акции (TQBR), облигации (TQOB), паи фондов (INAV) по одному запросу на бумагу
// (MOEX ISS отдаёт ~1KB на инструмент) — на бесплатном тарифе Workers помещается
// с большим запасом, крон обновляет сам.

import { RF_WATCHLIST } from "./config.js";

const ISS = "https://iss.moex.com/iss";
const KV_RF = "rf"; // { updatedAt, items: [...] }

const base = "iss.meta=off&iss.only=securities,marketdata";

// URL одного инструмента по классу
function secUrl(secid, klass) {
  const c = "&securities.columns=SECID,SHORTNAME,ISIN,SECTYPE,PREVPRICE,BOARDID" +
    "&marketdata.columns=SECID,LAST,LASTCHANGEPRCNT,WAPRICE,VALUE,ISSUECAPITALIZATION,TRADINGSTATUS,UPDATETIME,BOARDID";
  const b = "&securities.columns=SECID,SHORTNAME,ISIN,MATDATE,COUPONVALUE,COUPONPERCENT,ACCRUEDINT,YIELDATPREVWAPRICE,BOARDID" +
    "&marketdata.columns=SECID,LAST,WAPRICE,VALUE,TRADINGSTATUS,UPDATETIME,BOARDID";
  const p = "&securities.columns=SECID,SHORTNAME,BOARDID" +
    "&marketdata.columns=SECID,LASTVALUE,CURRENTVALUE,LASTCHANGEPRC,MONTHCHANGEPRC,YEARCHANGEPRC,CAPITALIZATION,UPDATETIME,TRADEDATE,BOARDID";
  const path =
    klass === "stocks" ? `engines/stock/markets/shares/securities/${secid}` :
    klass === "bonds" ? `engines/stock/markets/bonds/securities/${secid}` :
    `engines/stock/markets/index/boards/INAV/securities/${secid}`;
  const cols = klass === "stocks" ? c : klass === "bonds" ? b : p;
  return `${ISS}/${path}.json?${base}${cols}`;
}

// Бумага может торговаться на нескольких досках — берём основную.
const MAIN_BOARD = { stocks: "TQBR", bonds: "TQOB", pifs: "INAV" };

function zip(columns, rows) {
  return (rows || []).map((r) => {
    const o = {};
    columns.forEach((c, i) => {
      if (i < r.length) o[c] = r[i];
    });
    return o;
  });
}

function rowForBoard(sec, md, board) {
  if (!sec.length) return null;
  let i = sec.findIndex((s, idx) => s.BOARDID === board && md[idx]);
  if (i === -1) i = 0;
  return [sec[i], md[i] || {}];
}

function changePct(apiVal, last, prev) {
  if (apiVal) return apiVal;
  if (last != null && prev) return +(((last - prev) / prev) * 100).toFixed(2);
  return apiVal ?? null;
}

async function fetchSecurity(item) {
  const res = await fetch(secUrl(item.secid, item.klass));
  if (!res.ok) throw new Error(`MOEX ${item.secid} ${res.status}`);
  const j = await res.json();
  const sec = zip(j.securities?.columns, j.securities?.data);
  const md = zip(j.marketdata?.columns, j.marketdata?.data);
  const [s, m] = rowForBoard(sec, md, MAIN_BOARD[item.klass]) || [null, null];
  if (!s) return { secid: item.secid, name: item.name, klass: item.klass, error: "not found" };

  const common = {
    secid: item.secid,
    name: item.name,
    klass: item.klass,
    isin: s.ISIN ?? null,
    last: m.LAST ?? m.LASTVALUE ?? m.CURRENTVALUE ?? null,
    trading: m.TRADINGSTATUS ?? null,
    updated: m.UPDATETIME ?? null,
  };
  if (item.klass === "stocks") {
    return {
      ...common,
      sectype: s.SECTYPE ?? null,
      prev: s.PREVPRICE ?? null,
      changePct: changePct(m.LASTCHANGEPRCNT, common.last, s.PREVPRICE),
      wap: m.WAPRICE ?? null,
      value: m.VALUE ?? null,
      cap: m.ISSUECAPITALIZATION ?? null,
    };
  }
  if (item.klass === "bonds") {
    return {
      ...common,
      matDate: s.MATDATE ?? null,
      coupon: s.COUPONVALUE ?? null,
      couponPct: s.COUPONPERCENT ?? null,
      accInt: s.ACCRUEDINT ?? null,
      yield: s.YIELDATPREVWAPRICE ?? null, // доходность к погашению
      wap: m.WAPRICE ?? null,
      value: m.VALUE ?? null,
    };
  }
  // pifs (INAV)
  return {
    ...common,
    lastValue: m.LASTVALUE ?? null,
    currentValue: m.CURRENTVALUE ?? null,
    changePct: m.LASTCHANGEPRC ?? null,
    monthPct: m.MONTHCHANGEPRC ?? null,
    yearPct: m.YEARCHANGEPRC ?? null,
    cap: m.CAPITALIZATION ?? null,
    tradeDate: m.TRADEDATE ?? null,
  };
}

export async function refreshRF(env) {
  const results = await Promise.all(
    RF_WATCHLIST.map((item) =>
      fetchSecurity(item)
        .catch((e) => ({ secid: item.secid, name: item.name, klass: item.klass, error: String(e.message || e) }))
    )
  );
  const snap = { updatedAt: new Date().toISOString(), items: results };
  await env.DATA.put(KV_RF, JSON.stringify(snap));
  return snap;
}

export async function getRF(env) {
  const raw = await env.DATA.get(KV_RF);
  if (raw) return JSON.parse(raw);
  return refreshRF(env);
}
