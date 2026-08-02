# 📊 Investsite — проект «Инвест-портфель»

Сайт-дашборд инвест-портфеля на Cloudflare Workers (бесплатный тариф).
Показывает в реальном времени портфели двух крипто-кошельков + страницу
«Горячие пулы» + бэкенд РФ-инструментов + лендинг-заглушку.

**Создан:** август 2026 · **Деплой:** Cloudflare Workers (бесплатный тариф)

## Сайты

| Сайт | URL | Что это |
|---|---|---|
| Дашборд портфеля | https://portfolio.leonidengel.workers.dev | общий donut по двум кошелькам, активы, кнопки DeBank/Krystal |
| Горячие пулы | https://portfolio.leonidengel.workers.dev/pools | топ-50 в каждой категории: Best Blue-chip / Best Stable Coin Pools (LP-пары из watchlist) + Fix (одиночные монеты — лендинг/стейкинг), APY за окна 24ч/7–180 дней |
| РФ-инструменты | `/api/rf` | 8 инструментов (акции/ОФЗ/паи) в JSON |
| Лендинг (заглушка) | https://lp.leonidengel.workers.dev | заглушка, допилим позже |

## Как это работает

- **Дашборд**: Worker отдаёт **статичную HTML-оболочку**, а браузер сам тянет
  `/api/data` и рисует donut/карточки. Так сделано из-за лимита бесплатного
  тарифа (10мс CPU/запрос): сборка большого HTML сервером не укладывается,
  а нативный JSON + клиентский рендер работают без проблем.
- **Данные кошельков:** Zerion API — портфели из `src/config.js` (WALLETS).
  Ключ: `credentials/zerion-key.txt`, секрет Cloudflare `ZERION_API_KEY`.
- **РФ-инструменты:** MOEX ISS API, per-security запросы, watchlist из
  `src/config.js` (RF_WATCHLIST). Кэш KV (`rf`), крон раз в час. Payload ~2KB.
- **Горячие пулы:** DefiLlama отдаёт весь дамп 10.9MB (не умеет фильтровать),
  парсинг которого не помещается в 10мс — поэтому тяжёлую работу делает
  **скрипт `scripts/sync-pools.mjs`** (Mac или GitHub Actions раз в час):
  качает дамп → фильтрует пары из watchlist (50+50+50 пулов) → считает средние
  APY из chart-истории → пишет готовые строки в KV (`poolsHtml`, `poolsJson:категория`).
  Worker только отдаёт их (0 CPU). Страница `/pools` — лёгкая оболочка, данные
  браузер тянет из `/api/pools?cat=...` по одной категории (все 150 пулов
  ~29KB не проходят лимит ответа ~19.5KB — чанкинг, как с дашбордом на `/dash.js`).
- **API:** `/api/data` (портфели), `/api/pools` (пулы), `/api/rf` (РФ),
  `/api/refresh` (обновить портфель + РФ).

## Кошельки (src/config.js → WALLETS)

- **Rabby wallet**: `0x8d95…` — источники: DeBank, Krystal
- **Tangem wallet**: `0x374d…` — источник: DeBank
- **Russian Stocks**: синтетический кошелёк — MOEX, 20 паёв фонда АКММ
  (Альфа Денежный рынок). Всё в РУБЛЯХ: `rfWalletSnapshot()` считает
  цена пая с INAV-доски × 20 (₽), для общего donut конвертирует через
  курс USDT→₽ (см. ниже)

## Курсы валют и индекс страха/жадности

- Верхний блок дашборда — 3 подблока: **Markets** | **All wallets + donut** | **Portfolio history**.
- **Markets**: ₿ BTC, Ξ ETH (в USD), ₮ USDT→₽, ₮ USDC→₽, $ USD→₽ / € EUR→₽ / £ GBP→₽
  (официальные курсы ЦБ РФ), индекс страха и жадности.
- Источник курсов: **CoinGecko** (BTC/ETH в USD + USDT/USDC→RUB, без ключа) +
  **ЦБ РФ** (cbr-xml-daily.ru) для USD/EUR/GBP. BestChange API публично недоступен
  (таймаут/геоблок), пары USDT/RUB удалены на Binance/Bybit/OKX/KuCoin/MEXC/WhiteBIT.
- Fallback: BTC/ETH — Coinbase spot; USDT→₽ — MOEX USD/RUB (USDT≈USD).
- F&G индекс: alternative.me. Кэш KV (`rates`), `/api/rates`.
- **Нетто-донат:** DeFi показывается за вычетом долга (borrowed), поэтому
  сумма «All wallets» ВСЕГДА равна сумме сегментов доната. Долг — отдельной
  красной строкой («💳 Debt») в самари и в карточке кошелька.
- **Portfolio history**: крон каждые 15 мин пишет точку стоимости в KV
  (`/api/history`), верхний блок рисует график (1–7 дней).

## Ручные активы (Russian Stocks)

- В карточке «Russian Stocks» есть кнопка **➕ Add asset**: добавляй золото,
  наличные, вклады и т.п. (символ, название, кол-во, цена в ₽).
- Хранятся в KV (`manual`), API: `GET/POST/DELETE /api/manual`.
- Считаются как позиции кошелька Russian Stocks (в рублях), попадают в donut.

## Горячие пулы — как обновляются

Парсинг дампа DefiLlama (10.9MB, ~40мс CPU) не помещается в 10мс бесплатного
тарифа Workers, поэтому пулы обновляет внешний скрипт:

```bash
node scripts/sync-pools.mjs   # вручную (wrangler уже авторизован на этом Mac)
```

**Автономно — GitHub Actions** (`.github/workflows/sync-pools.yml`):
- Репозиторий: **https://github.com/leonidengel/investsite** (публичный)
- Расписание: `17 * * * *` (раз в час, UTC) + ручной запуск (`workflow_dispatch`) + на push
- Секреты: `CLOUDFLARE_API_TOKEN` (шаблон «Edit Cloudflare Workers») и
  `CLOUDFLARE_ACCOUNT_ID` (оба уже заданы)

Список токенов для пулов: `src/config.js` → `POOL_BLUE_TOKENS` / `POOL_STABLE_TOKENS`.

## Быстрый старт для нового чата

```bash
cd /Users/leonidengel/Downloads/projects/portfolio.engels

# 1. Проверка авторизации Cloudflare (уже должна работать на этом Mac)
npx wrangler whoami

# 2. Деплой дашборда
npx wrangler deploy

# 3. Деплой лендинга
cd lp && npx wrangler deploy

# 4. Обновить пулы (после изменения watchlist/кода страницы)
node scripts/sync-pools.mjs
```

Подробнее об авторизации и ключах: **`credentials/README.md`**.
Структура файлов: **`STRUCTURE.md`**. Планы на будущее: **`PLANS.md`**.
