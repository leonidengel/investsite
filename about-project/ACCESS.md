# 🔐 ACCESS — доступы к проекту

Где какие доступы лежат и какие нужны. **Этот файл не содержит значений секретов** —
репозиторий публичный, а креды дают полный доступ к Cloudflare/Zerion.

> ⚠️ **Никогда не коммить значения ключей в репозиторий.** Папка `credentials/`
> уже в `.gitignore` — там они и должны оставаться. Перед push проверяй `git status`.

---

## Где лежат секреты (на этом Mac)

Папка **`credentials/`** в корне проекта (в `.gitignore`, в репо не попадает):

```
credentials/
├── README.md                    ← индекс доступов (локальный)
├── zerion-key.txt               ← API-ключ Zerion  ⚠️ секрет
├── cloudflare-token.txt         ← API-токен Cloudflare (cfat_...)  ⚠️ секрет
└── wrangler/config/default.toml ← OAuth-креды wrangler  ⚠️ секрет
```

Значения смотри **только** в этих файлах локально. Не копируй их в доки, код,
коммиты, чаты. Если нужно передать другому ИИ — укажи путь к файлу, пусть читает сам.

---

## 1. Cloudflare (хостинг + KV)

- **Аккаунт:** leonidengel1@gmail.com
- **Account ID:** `7beedd406ca090ad9f054c96b6ac468b`
- **Дашборд:** https://dash.cloudflare.com
- **Worker'ы:** `portfolio` (дашборд+пулы), `lp` (лендинг)
- **KV namespace:** binding `DATA`, id `4456a772c48d459c8470e322052c0c4c`
- **Домен деплоя:** `https://portfolio.leonidengel.workers.dev`

### Авторизация wrangler (2 способа)

**Способ 1 — уже настроена глобально** (на этом Mac):
```bash
npx wrangler whoami   # → leonidengel1@gmail.com
```
Креды лежат в `~/Library/Preferences/.wrangler/config/default.toml` (macOS) —
копия в `credentials/wrangler/config/default.toml`.

**Способ 2 — через токен** (для CI/скриптов):
- Файл: `credentials/cloudflare-token.txt` (формат `cfat_...`)
- Токен имеет права на Workers Scripts + KV Storage (проверено: видит `lp` и `portfolio`).
- `wrangler verify` на `/user/tokens/verify` выдаёт «Invalid API Token» — это
  **известная особенность** cfat_-токенов, на реальных API-вызовах всё работает.
- Если протух: дашборд Cloudflare → My Profile → API Tokens → создать новый
  с шаблоном «Edit Cloudflare Workers», обновить файл.

### Secret в Cloudflare (для Worker'а)

- `ZERION_API_KEY` — задан через `wrangler secret` (виден в `wrangler secret list`).
- Значение = содержимое `credentials/zerion-key.txt`.
- Задать/обновить: `npx wrangler secret put ZERION_API_KEY` (вставить ключ).

---

## 2. Zerion (данные портфелей)

- **Файл ключа:** `credentials/zerion-key.txt`
- **Тариф:** Developer (повышенные лимиты)
- **Secret Cloudflare:** `ZERION_API_KEY`
- **Документация:** https://developers.zerion.io/reference/getwalletportfolio
- Авторизация: `Basic base64(ключ + ":")` в заголовке `Authorization`.
- Лимиты: 429 при превышении → в коде есть ретраи (`fetchWithRetry`).

---

## 3. GitHub (репозиторий + CI)

- **Репозиторий:** https://github.com/leonidengel/investsite (публичный)
- **Владелец:** leonidengel
- **CLI:** `gh` (бинарник в `~/.local/bin/gh`, v2.97.0). Если нет в PATH:
  ```bash
  export PATH="$HOME/.local/bin:$PATH"
  gh auth status
  ```

### Секреты GitHub Actions (Settings → Secrets and variables → Actions)

| Секрет | Где используется | Значение = |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | deploy-worker.yml, sync-pools.yml | `credentials/cloudflare-token.txt` |
| `CLOUDFLARE_ACCOUNT_ID` | deploy-worker.yml, sync-pools.yml | `7beedd406ca090ad9f054c96b6ac468b` |

Обновить секрет: `gh secret set CLOUDFLARE_API_TOKEN` (вставить значение).
Посмотреть список: `gh secret list` (значения GitHub не отдаёт — это нормально).

---

## 4. Внешние API (ключи НЕ нужны)

Эти источники бесплатны и работают без авторизации:

| Источник | Endpoint | Зачем |
|---|---|---|
| CoinGecko | `api.coingecko.com/api/v3/...` | BTC/ETH/USDT/USDC, total mcap |
| Coinpaprika | `api.coinpaprika.com/v1/global` | fallback total mcap |
| Coinbase | `api.coinbase.com/v2/prices/...` | fallback BTC/ETH |
| MOEX ISS | `iss.moex.com/iss/...` | РФ-бумаги, USD/RUB |
| cbr-xml-daily.ru | `www.cbr-xml-daily.ru/daily_json.js` | курсы ЦБ РФ (USD/EUR/GBP) |
| alternative.me | `api.alternative.me/fng/` | Fear & Greed |
| DefiLlama | `yields.llama.fi/...` | дамп пулов + chart APY |
| Aave V3 RPC | per-chain endpoints | Health Factor (on-chain eth_call) |

> BestChange API **недоступен** публично (таймаут/геоблок). Пар USDT/RUB удалён
> на большинстве бирж. USDT→₽ берём с CoinGecko (+ fallback MOEX USD/RUB).

---

## 5. Безопасность

Эти креды дают **полный доступ** к аккаунту Cloudflare и данным Zerion.

- ❌ Не публикуй папку `credentials/`, не коммить её (она в .gitignore).
- ❌ Не вставляй значения ключей в код, доки, коммиты, чаты, issue.
- ❌ Не клади `credentials/wrangler/config/default.toml` в репо (там OAuth-токен).
- ✅ Перед `git add` проверяй `git status` — `credentials/` не должна светиться.
- ✅ Передача другому ИИ: укажи **путь** к файлу с секретом, пусть читает сам.

### Отозвать доступы (если скомпрометированы)

- **Cloudflare токен:** дашборд → My Profile → API Tokens → Roll/Delete.
- **wrangler OAuth:** дашборд → My Profile → API Tokens → OAuth apps → Revoke.
- **Zerion ключ:** https://developers.zerion.io → настройки → regenerate API key,
  затем `npx wrangler secret put ZERION_API_KEY` с новым значением.
- **GitHub секреты:** Settings → Secrets → обновить (старое значение перестанет работать в CI).
