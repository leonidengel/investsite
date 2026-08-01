# 📊 Investsite — проект «Инвест-портфель»

Сайт-дашборд инвест-портфеля на Cloudflare Workers (бесплатный тариф).
Показывает в реальном времени портфели двух крипто-кошельков + страницу
«Горячие пулы» + бэкенд РФ-инструментов + лендинг-заглушку.

**Создан:** август 2026 · **Деплой:** Cloudflare Workers (бесплатный тариф)

## Сайты

| Сайт | URL | Что это |
|---|---|---|
| Дашборд портфеля | https://portfolio.leonidengel.workers.dev | общий donut по двум кошелькам, активы, кнопки DeBank/Krystal |
| Горячие пулы | https://portfolio.leonidengel.workers.dev/pools | топ-30 Best Blue-chip / Best Stable Coin Pools (пары из watchlist), APY за окна 7–180 дней |
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
  качает дамп → фильтрует пары из watchlist (30+30 пулов) → считает средние
  APY из chart-истории → пишет готовые строки в KV (`poolsHtml`, `poolsJson`).
  Worker только отдаёт их (0 CPU).
- **API:** `/api/data` (портфели), `/api/pools` (пулы), `/api/rf` (РФ),
  `/api/refresh` (обновить портфель + РФ).

## Кошельки (src/config.js → WALLETS)

- Кошелёк A: `0x8d95…` — источники: DeBank, Krystal
- Кошелёк B: `0x374d…` — источник: DeBank

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
