# 🗂 Структура проекта investsite

```
portfolio.engels/
├── README.md                    ← ГЛАВНОЕ: что за проект, сайты, как деплоить
├── STRUCTURE.md                 ← этот файл
├── PLANS.md                     ← планы на будущее
├── .gitignore                   ← исключает credentials/ и служебное (для GitHub)
│
├── credentials/                 ← ВСЕ ключи и доступы (см. README внутри)
│   ├── README.md                ← индекс доступов, как авторизоваться
│   ├── zerion-key.txt           ← API-ключ Zerion (рабочий)
│   ├── cloudflare-token.txt     ← API-токен Cloudflare (НЕВАЛИДЕН)
│   └── wrangler/
│       └── config/
│           └── default.toml     ← OAuth-креды wrangler (рабочие)
│
├── wrangler.toml                ← конфиг worker «portfolio», cron */15, KV DATA
├── src/
│   ├── index.js                 ← Worker: Zerion API, крон, маршруты
│   │                              (/, /pools, /api/*) — тонкий, без рендера
│   ├── dashboard.js             ← статичная HTML-оболочка дашборда; браузер
│   │                              сам тянет /api/data и рисует donut+карточки
│   ├── config.js                ← WALLETS (Rabby/Tangem + Russian Stocks),
│   │                              RF_WATCHLIST (8 бумаг), POOL_BLUE/STABLE
│   │                              TOKENS, карта сетей DefiLlama, палитра
│   ├── pools.js                 ← логика пулов для скрипта: классификация по
│   │                              watchlist (blue-chip/stable/fix), средние APY
│   │                              из chart, рендер оболочки страницы
│   └── rf.js                    ← РФ-инструменты: MOEX ISS, per-security, watchlist,
│                                  rfWalletSnapshot() — кошелёк Russian Stocks
│
├── scripts/
│   └── sync-pools.mjs           ← качает дамп DefiLlama, фильтрует, считает APY,
│                                  рендерит страницу и пишет в KV (Mac / Actions)
│
├── .github/workflows/
│   └── sync-pools.yml           ← раз в час обновляет пулы (GitHub Actions)
│
└── lp/                          ← отдельный worker «lp» (лендинг)
    ├── wrangler.toml
    └── src/index.js             ← статичная заглушка (светлая тема)
```

## Замечания

- **Два независимых worker'а** (`portfolio` и `lp`) — свои `wrangler.toml`,
  деплоятся отдельно.
- **Бесплатный тариф Workers = 10мс CPU/запрос.** Поэтому:
  - дашборд рендерится в браузере (статичная оболочка + `/api/data`);
  - пулы рендерит внешний скрипт (`sync-pools.mjs`), worker отдаёт из KV
    оболочку `/pools` (без данных) + `/api/pools` (JSON, тянет браузер);
  - РФ — маленький watchlist, крон справляется сам.
- **Кэш/служебное** (`.wrangler/`, `.sync-out/`, `.DS_Store`) — не в Git
  (см. `.gitignore`).
- Код хостится на Cloudflare (через `wrangler deploy`), в Git-репозиторий
  не завязан — для миграции достаточно скопировать папку.
