# 📖 HANDBOOK — инструкция для разработчика/ИИ

Практическое руководство: как работать с проектом, где что менять, какие ловушки.
Рассчитан на **нового ИИ или человека**, который продолжает проект.

> Архитектура и потоки данных — см. `ARCHITECTURE.md`.
> Доступы и ключи — см. `ACCESS.md`.

---

## 1. TL;DR — как начать

```bash
cd /Users/leonidengel/Downloads/projects/portfolio.engels

# 1. Авторизация Cloudflare (уже настроена на этом Mac)
npx wrangler whoami   # → leonidengel1@gmail.com

# 2. Локальная проверка синтаксиса всех исходников
for f in src/*.js scripts/*.mjs; do node --check "$f" || echo "BROKEN: $f"; done

# 3. Деплой вручную (но обычно не нужно — см. про авто-деплой ниже)
npx wrangler deploy

# 4. Обновить пулы (после изменения кода пулов или watchlist)
node scripts/sync-pools.mjs
```

Живой сайт: **https://portfolio.leonidengel.workers.dev**
Пулы: **https://portfolio.leonidengel.workers.dev/pools**

---

## 2. Что где менять (шпаргалка)

| Задача | Файл + где именно |
|---|---|
| Добавить крипто-кошелёк | `src/config.js` → `WALLETS` (добавить `{id, name, address, sources}`) |
| Изменить РФ-паи/акции | `src/config.js` → `RF_WALLET.holdings` |
| Добавить токен в пулы | `src/config.js` → `POOL_BLUE_TOKENS` / `POOL_STABLE_TOKENS` |
| Порог TVL пулов | `src/pools.js` → `const MIN_TVL` (сейчас 40 000) |
| Сколько пулов в категории | `src/pools.js` → `const TOP_N` (сейчас 50) |
| Окна APY (7/30/... дней) | `src/pools.js` → `POOL_PERIODS` |
| Частота крона | `wrangler.toml` → `crons` (сейчас каждые 15 мин) |
| Новый API-endpoint | `src/index.js` → блок `if (url.pathname === "/api/...")` |
| Внешний вид дашборда | `src/dashboard.js` (HTML/CSS в `DASHBOARD_HTML`, JS в `DASHBOARD_JS` / `DASHBOARD_JS2`) |
| Источники курсов | `src/rates.js` → `fetchPx()` / `fetchCbr()` / `fetchMcap()` |
| Логика РФ-кошелька | `src/rf.js` → `rfWalletSnapshot(env)` |

---

## 3. ⚠️ ГЛАВНЫЕ ЛОВУШКИ (читай перед любым изменением)

### 3.1. Лимит ответа Worker'а ~18.9 KB (в БАЙТАХ, не символах)

**Самая частая причина сломанного деплоя.** Если клиентский JS (`/dash.js`,
`/dash2.js`) или HTML-страница превышает ~18 880 байт — Cloudflare **молча
обрежет** ответ, и в браузере будет `SyntaxError: Unexpected end of input`.

Проверять **всегда в байтах**:
```bash
node -e "import('./src/dashboard.js').then(m => {
  console.log('dash.js BYTES:', Buffer.byteLength(m.DASHBOARD_JS, 'utf8'));
  console.log('dash2.js BYTES:', Buffer.byteLength(m.DASHBOARD_JS2, 'utf8'));
  console.log('HTML BYTES:', Buffer.byteLength(m.DASHBOARD_HTML, 'utf8'));
})"
```
Держи запас от 18 880. Знаки ₿/₽/→/Ξ/€/£ весят 2–3 байта — строка в 19 000
символов может оказаться 19 500 байт.

**Если превысил:** переноси код в `DASHBOARD_JS2` (он грузится отдельным
`/dash2.js`). См. как уже сделано: `ratesHtml`, `donut`, `legend`, `histHtml`,
`manualHtml` живут в JS2 и вызываются из render в JS1 (JS2 грузится в `<head>`
сразу после JS1, поэтому к моменту `render()` после fetch функции уже доступны).

### 3.2. Шаблонные литералы: экранирование бэкслешей

Клиентский JS хранится **внутри** template-literal `` `...` `` в `dashboard.js`.
Поэтому:
- `\s` в regex клиента → пишешь `\\s` (иначе станет просто `s`)
- `\(` → `\\(`, `\d` → `\\d`
- `\"` → `"` или `'` (не экранируй кавычки обратным слешем внутри `` ` ``)
- `` ` `` (бэктик) внутри → экранируй `` \` ``
- `${` в клиентском коде (не для интерполяции) → `\${`

Если видишь в браузере странную ошибку парсинга regex или onerror-атрибута —
99% это потерянный бэкслеш.

### 3.3. `onclick` с параметрами-строками

`JSON.stringify("WETH-USDC")` даёт `"WETH-USDC"` с двойными кавычками. Внутри
HTML-атрибута `onclick="openPool("WETH-USDC",...)"` это ломает парсинг.
Решение — экранировать кавычки в `&quot;`:
```js
var q = function (v) { return JSON.stringify(v).replace(/"/g, "&quot;"); };
```

### 3.4. KV eventual consistency (~до 60 сек)

После `wrangler kv key delete`/`put --remote` старое значение может отдаваться
ещё около минуты. Если удалил кэш `rates`, а `/api/rates` всё равно старый —
**подожди 30–60 сек**, это не баг. Не пытайся «исправить» кодом.

### 3.5. CoinGecko /global рейт-лимитит IP Cloudflare

`api.coingecko.com/api/v3/global` (total market cap) часто отдаёт 429 с IP
Cloudflare. Поэтому `fetchMcap()` имеет fallback на Coinpaprika
(`api.coinpaprika.com/v1/global`). Не убирай fallback.

### 3.6. `dash.js` / `dash2.js` кэшируются CDN

После деплоя браузер может получать старый JS из CDN-кэша. Проверяй с
cache-buster: `curl "https://...workers.dev/dash.js?t=$(date +%s)"`. В HTML
уже стоит `cache-control: no-cache` на JS, но CDN иногда всё равно кэширует.

### 3.7. jsdom-тесты: подключай ОБА скрипта сразу

В реальном браузере `/dash.js` и `/dash2.js` грузятся в `<head>` синхронно до
любого fetch. В jsdom-тесте добавляй оба `<script>` **без await между ними** —
иначе `render()` из JS1 вызовется до загрузки JS2 и упадёт на `ratesHtml is not defined`.

---

## 4. Проверка изменений: чеклист

После любого изменения клиентского кода:

1. **Синтаксис:** `node --check` на каждом изменённом файле.
2. **Байт-размер:** см. §3.1 — все 3 файла (HTML, JS, JS2) под 18 880 байт.
3. **Локальный рендер (jsdom):** см. §5.
4. **Деплой + live-проверка** нужных endpoint'ов через curl.
5. **Коммит + push** (авто-деплой сработает сам — см. §6).

После изменения логики пулов (watchlist, MIN_TVL, классификация):
```bash
node scripts/sync-pools.mjs   # перегенерить данные в KV
```

---

## 5. Локальные тесты через jsdom

jsdom **не входит** в проект (нет package.json/deps). Ставим во временную папку:

```bash
mkdir -p /tmp/jsdom-test && cd /tmp/jsdom-test && npm init -y && npm install jsdom
```

Тест дашборда (подключаем оба скрипта, стабаем fetch):
```js
const { JSDOM } = require("/tmp/jsdom-test/node_modules/jsdom");
const mod = await import("file:///.../src/dashboard.js?t=" + Date.now());
let html = mod.DASHBOARD_HTML
  .replace('<script src="/dash.js"></script>', "")
  .replace('<script src="/dash2.js"></script>', "");
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://x/" ,
  beforeParse(window) {
    window.__errs = []; window.onerror = (m) => window.__errs.push(String(m));
    window.fetch = async (u) => {
      const s = String(u);
      if (s.includes("/api/data"))   return { json: async () => SNAP };
      if (s.includes("/api/rates"))  return { json: async () => RATES };
      if (s.includes("/api/history"))return { json: async () => HIST };
      return { json: async () => ({}) };
    };
  }});
const w = dom.window, doc = w.document;
const s1 = doc.createElement("script"); s1.textContent = mod.DASHBOARD_JS; doc.head.appendChild(s1);
const s2 = doc.createElement("script"); s2.textContent = mod.DASHBOARD_JS2; doc.head.appendChild(s2);
await new Promise(r => setTimeout(r, 800));
console.log("ошибки:", w.__errs);
console.log("подблоков:", doc.querySelectorAll(".comb-col").length);
```

> `?t=Date.now()` в импорте — **обязателен**, иначе Node кэширует старый модуль
> после правок файла, и тест будет проверять неактуальный код.

Аналогично для пулов — берём `.sync-out/pools.html` + стабаем `/api/pools?cat=`.

---

## 6. Деплой

### Автоматически (основной способ)

Push в `main` → GitHub Actions `deploy-worker.yml` сам деплоит Worker.
Смотреть: `gh run list --workflow=deploy-worker.yml` (нужен `gh`, см. ACCESS.md).

### Вручную (если CI недоступен или быстро проверить)

```bash
npx wrangler deploy                    # Worker «portfolio»
cd lp && npx wrangler deploy           # Worker «lp» (лендинг, вручную)
```

### Принудительное обновление данных

```bash
curl "https://portfolio.leonidengel.workers.dev/api/refresh"   # портфели+курсы
node scripts/sync-pools.mjs                                     # пулы (через wrangler → KV)
```

---

## 7. Частые задачи (рецепты)

### Добавить крипто-кошелёк
1. `src/config.js` → добавить в `WALLETS`: `{ id:"wallet-d", name:"...", address:"0x...", sources:[...] }`.
2. Push → авто-деплой. Крон через ≤15 мин подхватит.

### Добавить ручной актив (золото/вклад) в Russian Stocks
Через UI: карточка Russian Stocks → ➕ Add asset → символ/название/кол-во/цена ₽.
Или через API: `POST /api/manual` с `{symbol,name,units,priceRub}`.
Хранится в KV `manual`, считается в `rfWalletSnapshot()`.

### Изменить список токенов для пулов
1. `src/config.js` → `POOL_BLUE_TOKENS` / `POOL_STABLE_TOKENS`.
2. `node scripts/sync-pools.mjs` (или дождаться hourly CI).
3. Push (авто-деплой код не нужен, но синк данных — да).

### Сменить порог TVL или число пулов
`src/pools.js` → `MIN_TVL` / `TOP_N`, затем `node scripts/sync-pools.mjs`.

---

## 8. Если что-то сломалось

| Симптом | Вероятная причина | Что делать |
|---|---|---|
| `Loading portfolios…` висит | /dash.js обрезан (лимит байт) или ошибка в JS | проверить байт-размер (§3.1), `node --check` |
| `ratesHtml is not defined` | JS2 не загрузился до render | оба `<script>` в `<head>`, см. §3.7 |
| Курсы null в `/api/rates` | старый кэш KV / источники недоступны | удалить KV `rates`, подождать 60 сек |
| Пулы пустые/старые | sync-pools не запускался | `node scripts/sync-pools.mjs` |
| `error 1101` (CPU limit) | тяжёлая работа в Worker'е | вынести в sync-скрипт / CI |
| mcap = null | CoinGecko рейт-лимит | fallback Coinpaprika уже должен быть; проверить `fetchMcap()` |
| Zerion 429 | рейт-лимит | ретраи уже есть в `fetchWithRetry`; подождать |

---

## 9. Что НЕ делать

- ❌ Не коммить `credentials/` (она в .gitignore — проверяй `git status`).
- ❌ Не клади значения секретов в код/доки/репо (см. ACCESS.md).
- ❌ Не парсь дамп DefiLlama (10.9 MB) в Worker'е — только в sync-скрипте.
- ❌ Не собирай весь HTML дашборда на сервере — только статичная оболочка.
- ❌ Не меняй логику нетто-доната, не поняв зачем она (ARCHITECTURE.md §6).
- ❌ Не убирай ретраи/fallback'и у внешних вызовов.
