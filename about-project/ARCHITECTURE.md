# 📐 ARCHITECTURE — устройство Investsite

Подробное описание архитектуры проекта «Investsite» (дашборд инвест-портфеля).
Этот файл — **главная справка для разработчика/ИИ**: как всё устроено и почему так.

> Краткий обзор и быстрый старт — см. `HANDBOOK.md`.
> Доступы и ключи — см. `ACCESS.md`.

---

## 1. Что это

Веб-дашборд инвест-портфеля на **Cloudflare Workers (бесплатный тариф)**. Показывает:

- **Дашборд** (`/`): общий donut по 3 кошелькам (2 крипто + российские активы),
  курсы валют/индекс страха и жадности, история стоимости портфеля, карточки
  позиций с APR/Health Factor.
- **Горячие пулы** (`/pools`): топ-50 пулов в 3 категориях (Blue-chip / Stable / Fix),
  APY за окна 24ч/7–180 дней, детали пула по клику (график APY).

Деплой: **https://portfolio.leonidengel.workers.dev** (Worker `portfolio`) +
лендинг-заглушка на отдельном Worker `lp` (https://lp.leonidengel.workers.dev).

---

## 2. Стек

| Слой | Технология |
|---|---|
| Хостинг + вычисления | Cloudflare Workers (бесплатный тариф, 100к запросов/сутки) |
| Хранилище | Cloudflare KV (binding `DATA`), бесплатный лимит |
| Код | Vanilla JS (ES modules), без бандлера/фреймворка |
| Фронтенд | Статичный HTML + клиентский JS (без React/Vue) |
| CI/CD | GitHub Actions (авто-деплой worker + синк пулов) |
| Репозиторий | https://github.com/leonidengel/investsite (публичный) |

Внешних npm-зависимостей **нет** (только `wrangler` через npx). Deps в package.json
не нужны — это чистый Cloudflare Worker.

---

## 3. Структура файлов

```
portfolio.engels/
├── wrangler.toml                ← Worker «portfolio»: cron */15, KV DATA
├── src/
│   ├── index.js                 ← Точка входа Worker'а: роуты, крон, refresh
│   ├── dashboard.js             ← DASHBOARD_HTML + DASHBOARD_JS + DASHBOARD_JS2
│   │                              (оболочка дашборда + клиентский JS в 2 файлах)
│   ├── config.js                ← Кошельки, РФ-watchlist, токены пулов, палитра
│   ├── rates.js                 ← Курсы валют (CoinGecko/ЦБ) + F&G, KV-кэш
│   ├── rf.js                    ← РФ-инструменты (MOEX ISS) + кошелёк Russian Stocks
│   └── pools.js                 ← Логика пулов: классификация, средние APY, рендер
├── scripts/
│   └── sync-pools.mjs           ← ВНЕ-worker синк пулов (DefiLlama → KV)
├── .github/workflows/
│   ├── deploy-worker.yml        ← Авто-деплой при пуше в main
│   └── sync-pools.yml           ← Обновление пулов раз в час
├── lp/                          ← Отдельный Worker «lp» (лендинг-заглушка)
│   ├── wrangler.toml
│   └── src/index.js
├── credentials/                 ← ⚠️ СЕКРЕТЫ (в .gitignore, НЕ в репо!) → ACCESS.md
├── README.md, STRUCTURE.md, PLANS.md   ← устаревшие краткие доки
└── about-project/               ← ЭТА папка (развёрнутая документация)
```

### Роли модулей (что где менять)

| Хочешь изменить | Файл |
|---|---|
| Добавить/удалить кошелёк | `src/config.js` → `WALLETS` |
| Изменить РФ-активы (AKMMA и т.п.) | `src/config.js` → `RF_WALLET` |
| Список токенов для пулов | `src/config.js` → `POOL_BLUE_TOKENS` / `POOL_STABLE_TOKENS` |
| Новый API-endpoint | `src/index.js` → `fetch()` (секция маршрутов) |
| Логику расчёта курсов | `src/rates.js` |
| Логику РФ-кошелька | `src/rf.js` → `rfWalletSnapshot()` |
| Внешний вид дашборда | `src/dashboard.js` (HTML/CSS + DASHBOARD_JS / DASHBOARD_JS2) |
| Внешний вид пулов | `src/pools.js` → `renderPoolsPage()` |
| Порог TVL пулов | `src/pools.js` → `MIN_TVL` |
| Расписание крона | `wrangler.toml` → `[triggers] crons` |
| Расписание CI | `.github/workflows/*.yml` |

---

## 4. Критичное ограничение: бесплатный тариф Workers

Это **главное**, что диктует всю архитектуру. Два жёстких лимита:

### 4.1. CPU: 10 мс на запрос

Fresh isolate на каждый запрос, без JIT-разогрева. Парсинг тяжёлых JSON
(например, дамп DefiLlama 10.9 MB ≈ 40 мс CPU) **не помещается**. Поэтому:

- **Тяжёлую работу делает внешний скрипт** `scripts/sync-pools.mjs` (запускается
  на Mac или в GitHub Actions, не в Worker'е). Он пишет готовые строки в KV,
  Worker только отдаёт их (≈0 CPU).
- Сами данные портфеля/курсов Worker **собирает на лету** (Zerion/ЦБ отвечают
  быстро, JSON компактный, укладывается).

### 4.2. Размер ответа: ~18.9 KB

Эмпирически (проверено): тело ответа обрезается где-то между **18 880 и 19 139 байт**.
20000 → 19139 обрезанный. **Считать надо в байтах (UTF-8), а не символах** —
значки ₿/₽/→/Ξ весят 2–3 байта, и строка в 19000 символов может оказаться 19400 байт.

Поэтому клиентский код дашборда разбит на **два файла**:

| Файл | Размер | Содержимое |
|---|---|---|
| HTML-оболочка (`/`) | ~8 KB | разметка + CSS |
| `/dash.js` | ~17.1 KB | основная логика рендера |
| `/dash2.js` | ~10.8 KB | курсы, donut/legend, история, ручные активы |

И пулы по той же причине: страница `/pools` — лёгкая оболочка (~8 KB),
данные браузер тянет из `/api/pools?cat=blueChip|stableCoin|fix` **по одной
категории** (все 150 пулов одним JSON ≈ 29 KB — не проходят).

> ⚠️ **Правило: при любом изменении клиентского JS проверяй байт-размер через
> `Buffer.byteLength(code, 'utf8')` и держи запас от 18 880.** См. HANDBOOK.md §3.

---

## 5. Потоки данных

### 5.1. Дашборд (runtime, по запросу браузера)

```
Браузер → GET /                → HTML-оболочка (статика из dashboard.js)
Браузер → GET /dash.js         → DASHBOARD_JS (статика)
Браузер → GET /dash2.js        → DASHBOARD_JS2 (статика)
Браузер → GET /api/data        → snapshot из KV (портфели)
Браузер → GET /api/rates       → курсы из KV
Браузер → GET /api/history     → история стоимости из KV
Браузер → GET /api/defirates   → APR/TVL позиций (regex-извлечение из KV-чанков)
```

Всё рендерится **в браузере**. Worker на этих запросах делает почти ноль работы
(только чтение KV + отдача строки).

### 5.2. Обновление данных (крон каждые 15 мин)

`wrangler.toml` → `scheduled()` в `src/index.js`:

```
refreshAll(env)            → Zerion API (портфели) + rfWalletSnapshot (РФ) → KV snapshot
                            + saveHistoryPoint (точка истории {t,total,mcap} → KV history)
ensureRF(env)              → MOEX ISS (РФ-инструменты) → KV rf (раз в час по TTL)
refreshRates(env)          → CoinGecko/ЦБ/F&G → KV rates
```

`refreshAll` идёт в Zerion с ретраями на 429, позиции фильтруются
(`flags.displayable !== false` — иначе aToken-расписки двойят сумму).
Aave V3 Health Factor считается **on-chain** через `eth_call getUserAccountData`.

### 5.3. Пулы (внешний синк, раз в час)

GitHub Actions `.github/workflows/sync-pools.yml` → `scripts/sync-pools.mjs`:

```
fetch yields.llama.fi/pools (10.9 MB)
  → classifyPools (blue-chip / stable / fix по watchlist)
  → fetchChartMeans (средние APY 7/30/60/90/120/180d, с ретраями на 429)
  → renderPoolsPage (HTML-оболочка)
  → renderApiJsonCategory (JSON на категорию)
  → buildRates (APR/TVL по протоколам, по сетям)
  → wrangler kv key put --remote (всё в KV)
```

---

## 6. Кошельки и активы

В `src/config.js`:

| Кошелёк | Адрес / источник | Валюта карточки |
|---|---|---|
| **Rabby wallet** | `0x8d95…e2f1` (Zerion) | USD |
| **Tangem wallet** | `0x374d…577b` (Zerion) | USD |
| **Russian Stocks** | синтетический (MOEX), 20 паёв АКММ | **RUB** |

Russian Stocks — **не блокчейн**, считается в `rfWalletSnapshot()`:
- AKMMA: цена пая INAV × 20 → ₽ (показывается в рублях)
- Ручные активы (золото/наличные, добавляются через ➕ Add asset): units × priceRub → ₽
- Для общего donut (в USD) конвертируется через курс USDT→₽ (`valueUsd`, `categoriesUsd`)

### Нетто-донат (важная логика!)

Donut показывает **DeFi за вычетом долга**, чтобы сумма «All wallets» **всегда**
совпадала с суммой сегментов доната. Долг — отдельной красной строкой «💳 Debt».

Реализация в `combined()` (dashboard.js):
```js
const defiNet = Math.max(cats.defi - cats.borrowed, 0);
// верхняя сумма = stable + crypto + defiNet (= сумма сегментов)
```

---

## 7. Категории пулов

В `classifyPools()` (`src/pools.js`), фильтр: `tvlUsd ≥ MIN_TVL ($40K)`, не outlier, apy > 0:

| Категория | Условие |
|---|---|
| **blueChip** | LP-пара из 2 токенов watchlist, есть ≥1 blue-chip, не чисто стейбл |
| **stableCoin** | LP-пара из 2 стейблкоинов watchlist |
| **fix** | одиночная монета watchlist (лендинг/стейкинг) |

Топ-50 по APY в каждой. Нормализация символов: `USDC.E → USDC`, `USD₮0/USDT0 → USDT`.

---

## 8. KV-ключи (binding `DATA`)

| Ключ | Кто пишет | Что хранит |
|---|---|---|
| `snapshot` | крон (refreshAll) | портфели кошельков (для `/api/data`) |
| `rates` | крон (refreshRates) | курсы + F&G + mcap (TTL 5 мин в коде) |
| `rf` | крон (ensureRF, раз в час) | РФ-инструменты watchlist |
| `history` | крон (saveHistoryPoint) | массив `{t, total, mcap}[]`, cap 4000 точек |
| `manual` | `/api/manual` POST/DELETE | ручные активы Russian Stocks |
| `poolsHtml` | sync-pools.mjs | HTML-оболочка `/pools` |
| `poolsIndex` | sync-pools.mjs | `{updatedAt, cats:[...]}` для `/api/pools` |
| `poolsJson:blueChip` | sync-pools.mjs | JSON категории для `/api/pools?cat=` |
| `poolsJson:stableCoin` | sync-pools.mjs | — // — |
| `poolsJson:fix` | sync-pools.mjs | — // — |
| `defiRates` | sync-pools.mjs | индекс сетей ставок |
| `defiRates:{chain}` | sync-pools.mjs | APR/TVL по протоколам, на сеть |

> KV имеет **eventual consistency** (~до 60 сек). После `kv key delete`/`put`
> старое значение может отдаваться ещё около минуты. Это норма, не баг.

---

## 9. API-endpoints (`src/index.js`)

| Метод + путь | Что делает |
|---|---|
| `GET /` | HTML-оболочка дашборда |
| `GET /dash.js`, `/dash2.js` | клиентский JS |
| `GET /pools` | HTML-оболочка пулов (из KV `poolsHtml`) |
| `GET /api/data` | snapshot портфелей |
| `GET /api/rates` | курсы + F&G + mcap |
| `GET /api/history?days=7` | история стоимости (точки `{t,total,mcap}`) |
| `GET /api/pools` | индекс категорий `{updatedAt, cats}` |
| `GET /api/pools?cat=blueChip` | пулы одной категории |
| `GET /api/defirates?q=Сеть~проект~символ,...` | APR/TVL позиций (regex из KV-чанков) |
| `GET /api/rf?class=stocks` | РФ-инструменты (опционально по классу) |
| `GET /api/manual` | список ручных активов |
| `POST /api/manual` | добавить `{symbol,name,units,priceRub}` |
| `DELETE /api/manual?id=` | удалить ручной актив |
| `GET /api/refresh` | принудительно обновить портфели+курсы (фоном) |

---

## 10. Внешние API (все бесплатные, без ключей кроме Zerion)

| Источник | Что берём | Зачем | Лимиты/нюансы |
|---|---|---|---|
| **Zerion** (ключ) | портфели кошельков | основной данные | тариф Developer; нужен `ZERION_API_KEY`; 429 → ретраи |
| **CoinGecko** | BTC/ETH/USDT/USDC + total mcap | блок Markets | рейт-лимитит IP Cloudflare на `/global` → fallback Coinpaprika |
| **Coinpaprika** | total market cap | fallback mcap | работает с IP Cloudflare |
| **Coinbase** | BTC/ETH spot | fallback цен | — |
| **MOEX ISS** | РФ-бумаги + USD/RUB | Russian Stocks, fallback USDT→₽ | per-security запросы |
| **cbr-xml-daily.ru** | USD/EUR/GBP → ₽ | курсы ЦБ | зеркало ЦБ РФ |
| **alternative.me** | Fear & Greed | блок Markets | — |
| **DefiLlama yields** | дамп пулов + chart | горячие пулы | дамп 10.9 MB (вне Worker); 429 → ретраи |
| **Aave V3 (RPC)** | Health Factor | карточки лендинга | on-chain `eth_call` |

> BestChange API **публично недоступен** (таймаут/геоблок). Пары USDT/RUB
> удалены на Binance/Bybit/OKX/KuCoin/MEXC/WhiteBIT. Поэтому USDT→₽ берём с CoinGecko.

---

## 11. CI/CD (GitHub Actions)

| Workflow | Триггер | Что делает |
|---|---|---|
| `deploy-worker.yml` | push в main / вручную | `npx wrangler deploy` (деплой Worker'а) |
| `sync-pools.yml` | cron `17 * * * *` / push / вручную | `node scripts/sync-pools.mjs` (обновление пулов) |

Нужные секреты в GitHub (см. ACCESS.md): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

> Worker `lp` деплоится **вручную** (`cd lp && npx wrangler deploy`) — для него
> авто-деплоя нет, т.к. это статичная заглушка.

---

## 12. Архитектурные принципы (почему так)

1. **Клиентский рендеринг.** Worker отдаёт статику, браузер сам тянет JSON и рисует.
   Так Worker не тратит CPU на сборку HTML и не упирается в лимит ответа.

2. **Чанкинг всего тяжёлого.** Данные разбиты на куски < 18.9 KB: курсы — отдельно,
   история — отдельно, пулы — по категориям, ставки — по сетям.

3. **Внешний синк для тяжёлой работы.** Дамп DefiLlama парсится в CI, не в Worker'е.
   Worker — тонкий отдающий слой.

4. **Нетто-донат.** Долг вычитается из DeFi, чтобы верхняя сумма = донату.
   Долг показывается отдельно, не «прячется».

5. **Мультивалютность.** Russian Stocks в ₽, остальное в USD. Для donut всё
   приводится к USD через единый курс USDT→₽ (один источник, чтобы не было расхождений).

6. **Деградация, не падение.** Все внешние вызовы — с ретраями и fallback-источниками.
   Лучше стейл-кэш, чем ошибка.
