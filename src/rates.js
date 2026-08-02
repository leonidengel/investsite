// src/rates.js — курсы валют и индекс страха и жадности для верхнего блока дашборда.
// Источники (без ключей):
//   - CoinGecko: BTC/ETH в USD и USDT→RUB одним запросом
//     (BestChange API недоступен публично — таймаут/геоблок; пары USDT/RUB
//      удалены на Binance/Bybit/OKX/KuCoin/MEXC/WhiteBIT)
//   - Fallback BTC/ETH: Coinbase spot (работает, без ключа)
//   - Fallback USDT→RUB: MOEX USD/RUB (курс доллара, USDT≈USD)
//   - alternative.me: индекс страха и жадности
// Кэш в KV (rates), обновляется по крону и при /api/refresh; /api/rates отдаёт
// кэш, если он свежий (< 5 мин), иначе обновляет на лету.

const KV_KEY = "rates";
const TTL_MS = 5 * 60 * 1000;

const UA = { "User-Agent": "Mozilla/5.0 (compatible; investsite/1.0)", Accept: "application/json" };

// fetch с ретраями на 429/5xx (CoinGecko любит рейт-лимитить)
async function fetchRetry(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: UA }).catch(() => null);
    if (r && (r.status === 200 || r.status === 404)) return r;
    await new Promise((res) => setTimeout(res, 1200 * (i + 1)));
  }
  return null;
}

// BTC/ETH в USD: CoinGecko, при неудаче — Coinbase spot
async function fetchPx() {
  const cg = await fetchRetry("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd,rub");
  let btcUsd = null, ethUsd = null, usdtRub = null;
  if (cg) {
    try {
      const j = await cg.json();
      btcUsd = j.bitcoin?.usd ?? null;
      ethUsd = j.ethereum?.usd ?? null;
      usdtRub = j.tether?.rub ?? null;
    } catch (e) {}
  }
  if (btcUsd == null || ethUsd == null) {
    const cb = await fetchRetry("https://api.coinbase.com/v2/prices/BTC-USD/spot");
    if (cb) {
      try { const j = await cb.json(); if (j.data?.amount) btcUsd = Number(j.data.amount); } catch (e) {}
    }
    const ce = await fetchRetry("https://api.coinbase.com/v2/prices/ETH-USD/spot");
    if (ce) {
      try { const j = await ce.json(); if (j.data?.amount) ethUsd = Number(j.data.amount); } catch (e) {}
    }
  }
  // USDT→RUB: если CoinGecko не дал — берём USD/RUB с MOEX (USDT≈USD)
  if (usdtRub == null) {
    const moex = await fetchRetry("https://iss.moex.com/iss/engines/currency/markets/selt/boards/CETS/securities/USD000UTSTOM.json?iss.meta=off&iss.only=marketdata&marketdata.columns=SECID,LAST");
    if (moex) {
      try {
        const j = await moex.json();
        const last = j.marketdata?.data?.[0]?.[1];
        if (last != null) usdtRub = Number(last);
      } catch (e) {}
    }
  }
  return { btcUsd, ethUsd, usdtRub };
}

export async function fetchRates() {
  const [px, fng] = await Promise.all([
    fetchPx(),
    fetchRetry("https://api.alternative.me/fng/?limit=1"),
  ]);
  const d = fng ? ((await fng.json().catch(() => ({})))?.data?.[0]) : null;
  return {
    btcUsd: px.btcUsd ?? null,
    ethUsd: px.ethUsd ?? null,
    usdtRub: px.usdtRub ?? null, // курс USDT → ₽ (для левого блока и РФ-конвертации)
    fng: d ? Number(d.value) : null,
    fngLabel: d ? d.value_classification : null,
    updatedAt: new Date().toISOString(),
  };
}

export async function refreshRates(env) {
  const rates = await fetchRates();
  await env.DATA.put(KV_KEY, JSON.stringify(rates));
  return rates;
}

export async function getRates(env) {
  const raw = await env.DATA.get(KV_KEY);
  if (raw) {
    const cached = JSON.parse(raw);
    if (Date.now() - new Date(cached.updatedAt).getTime() < TTL_MS) return cached;
  }
  try {
    return await refreshRates(env);
  } catch (e) {
    if (raw) return JSON.parse(raw); // стейл-кэш лучше, чем ничего
    throw e;
  }
}

// Курс USDT→RUB для конвертации РФ-активов в USD (один источник с дашбордом)
export async function getUsdtRub(env) {
  try {
    const r = await getRates(env);
    if (r.usdtRub) return r.usdtRub;
  } catch (e) { /* ниже фолбэк */ }
  return 90; // деградация: приблизительный курс, если API недоступен
}
