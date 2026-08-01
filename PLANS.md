# 📋 План развития проекта (заметки для будущих сессий/чатов)

## Что уже сделано (август 2026)

- **Дашборд портфеля**: https://portfolio.leonidengel.workers.dev
  - Zerion API (ключ в `credentials/zerion-key.txt`, секрет `ZERION_API_KEY`)
  - 2 кошелька (`src/config.js` → WALLETS): A — 0x8d957c…, B — 0x374db5…
  - **Общий donut по двум кошелькам сверху** (диаграммы у кошельков убраны по запросу),
    итог по обоим, активы, изменение за 24ч, кнопки DeBank/Krystal
  - **Рендер в браузере**: worker отдаёт статичную оболочку (`src/dashboard.js`),
    браузер тянет `/api/data` и рисует. Причина — лимит 10мс CPU бесплатного тарифа
  - Крон каждые 15 мин, `/api/refresh`, `/api/data`
- **Горячие пулы**: https://portfolio.leonidengel.workers.dev/pools
  - Как Krystal, но данные DefiLlama и **только пары из watchlist** (15-20 токенов):
    топ-30 Best Blue-chip + топ-30 Best Stable Coin
  - Переключатель периодов APY: **24ч/7д/30д/60д/90д/120д/180д** (средние из
    chart-истории DefiLlama, `yields.llama.fi/chart/{id}`)
  - Обновляет **внешний скрипт** `scripts/sync-pools.mjs` (Mac вручную или
    GitHub Actions раз в час) → готовые строки в KV (`poolsHtml`, `poolsJson`)
  - Почему: DefiLlama не фильтрует, парсинг дампа 10.9MB (~40мс CPU) не помещается
    в 10мс бесплатного тарифа Workers
- **РФ-инструменты (бэкенд)**: `/api/rf?class=stocks|bonds|pifs`
  - Watchlist из `src/config.js` → RF_WATCHLIST: SBER, GAZP, LKOH, YDEX, ROSN,
    ОФЗ 26207, паи 2xEQT/2xOFZ
  - MOEX ISS per-security запросы (~1KB на бумагу), кэш KV (`rf`), крон раз в час
  - UI пока нет — добавим позже
- **Светлая адаптивная тема**: max-width 1280px по центру, 1 колонка на мобильном,
  таблица пулов со скроллом на телефоне
- **Лендинг-заглушка**: https://lp.leonidengel.workers.dev (светлая тема)
- **Auth Cloudflare**: `credentials/wrangler/config/default.toml` (OAuth)
- **Документация**: README/STRUCTURE/PLANS

## Известные ограничения (важно)

- **Бесплатный тариф Workers = 10мс CPU/запрос** (свежий изолят на запрос, V8 без
  JIT-разогрева). Нельзя: собирать большой HTML на сервере, парсить крупные JSON
  (десятки КБ+), тяжёлые вычисления. Нативные JSON-операции и маленькие payload'ы — ок.
  Обходы уже встроены: клиентский рендер дашборда, внешний скрипт пулов, watchlist РФ.
- Если понадобится больше — Workers Paid $5/мес (30с CPU): тогда можно вернуть
  серверный рендер и парсить пулы прямо в кроне.

## Ближайшие задачи от пользователя (в порядке)

1. **GitHub Actions для пулов** — завести репозиторий, секреты
   `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (инструкция в README),
   пуши — и пулы будут обновляться сами раз в час.
2. **UI для РФ-инструментов** — бэкенд готов (`/api/rf`): показать на сайте
   акции/облигации/паи (табличка или карточки).
3. **Лендинг** — наполнить контентом: о проекте, стратегия, ключевые цифры, контакты.

## Как деплоить (памятка)

```bash
cd /Users/leonidengel/Downloads/projects/portfolio.engels
npx wrangler deploy          # portfolio
cd lp && npx wrangler deploy # лендинг
node scripts/sync-pools.mjs  # обновить пулы (после изменений watchlist/кода)
```

Ключи: `wrangler secret bulk <json>` (например {"ZERION_API_KEY":"..."}).
