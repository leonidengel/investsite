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
│   ├── dashboard.js             ← HTML-оболочка + /dash.js + /dash2.js (график
│   │                              истории, ручные активы, курсы); браузер сам
│   │                              тянет /api/data, /api/rates, /api/history
│   ├── config.js                ← WALLETS (Rabby/Tangem + Russian Stocks),
│   │                              RF_WATCHLIST (8 бумаг), POOL_BLUE/STABLE
│   │                              TOKENS, карта сетей DefiLlama, палитра
│   ├── pools.js                 ← логика пулов для скрипта: классификация по
│   │                              watchlist (blue-chip/stable/fix), средние APY
│   │                              из chart, рендер оболочки страницы
│   ├── rates.js                 ← курсы (CoinGecko + Coinbase/MOEX fallback)
│   │                              и индекс страха и жадности, KV-кэш, /api/rates
│   └── rf.js                    ← РФ-инструменты: MOEX ISS, per-security, watchlist,
│                                  rfWalletSnapshot() — кошелёк Russian Stocks (₽)
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
- **Бесплатный тариф Workers = 10мс CPU/запрос + лимит ответа ~18.9KB.**
  Поэтому:
  - дашборд рендерится в браузере: HTML-оболочка + `/dash.js` + `/dash2.js`
    (клиентский код разбит на 2 файла, чтобы каждый был меньше лимита);
  - пулы рендерит внешний скрипт (`sync-pools.mjs`), worker отдаёт из KV
    оболочку `/pools` (без данных) + `/api/pools?cat=` по категориям;
  - история портфеля — крон пишет точку в KV каждые 15 мин, `/api/history`;
  - РФ — маленький watchlist, крон справляется сам.
- **Кэш/служебное** (`.wrangler/`, `.sync-out/`, `.DS_Store`) — не в Git
  (см. `.gitignore`).
- Код хостится на Cloudflare (через `wrangler deploy`), в Git-репозиторий
  не завязан — для миграции достаточно скопировать папку.
