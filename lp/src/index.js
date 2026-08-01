// Лендинг-заглушка. Живёт на https://lp.leonidengel.workers.dev
// Позже допилим: контент, секции, формы.

const HTML = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invest Portfolio — Лендинг</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         background:#f4f6fa; color:#1b2433; margin:0; }
  .hero { text-align:center; padding:80px 20px 40px; }
  .hero h1 { font-size:44px; margin:0 0 12px; }
  .hero p { color:#66718a; font-size:18px; max-width:560px; margin:0 auto 28px; }
  .cta { display:inline-block; background:#3b6ef5; color:#fff; font-weight:600; text-decoration:none;
         padding:12px 28px; border-radius:10px; font-size:15px; }
  .ph-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:14px;
             max-width:960px; margin:40px auto 0; padding:0 20px 60px; }
  .ph { background:#fff; border:1px dashed #c9d3e8; border-radius:12px; padding:32px 20px;
        text-align:center; color:#8b93a7; }
  .ph b { color:#1b2433; display:block; margin-bottom:6px; }
  @media (max-width:640px) {
    .hero h1 { font-size:32px; }
  }
</style></head><body>
<section class="hero">
  <h1>Мой инвест-портфель</h1>
  <p>Лендинг проекта — скоро здесь будет вся ключевая информация, цифры и преимущества.</p>
  <a class="cta" href="https://portfolio.leonidengel.workers.dev">Смотреть дашборд</a>
</section>
<div class="ph-grid">
  <div class="ph"><b>Ключевые цифры</b>заглушка · будет позже</div>
  <div class="ph"><b>О проекте</b>заглушка · будет позже</div>
  <div class="ph"><b>Стратегия</b>заглушка · будет позже</div>
  <div class="ph"><b>Контакты</b>заглушка · будет позже</div>
</div>
</body></html>`;

export default {
  async fetch() {
    return new Response(HTML, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
};
