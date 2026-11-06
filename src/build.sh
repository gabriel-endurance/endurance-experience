cd "$(dirname "$0")/.."
# Pages are served by api/page.js (never from public/): the experience only to a valid session, the gate otherwise.
# <!--BOOT--> is replaced at request time with the session data.
mkdir -p site
page_head() {
echo '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#131c28"><meta name="robots" content="noindex"><title>Endurance — The Human Intelligence Experience</title><link rel="icon" href="assets/endurance-symbol-orange.png">'
echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
echo '<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">'
echo '<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script><script defer src="/_vercel/insights/script.js"></script>'
echo '<style>'; cat src/style.css; echo '</style><!--BOOT--></head>'
}
{
page_head
echo '<body data-theme="night" class="locked">'
cat src/gate.html
# gate script = shared core of app.js (up to the @core-end marker) + gate.js
echo '<script>'; awk '{print} /@core-end/{exit}' src/app.js; cat src/gate.js; echo '})();</script></body></html>'
} > site/gate.html
{
page_head
echo '<body data-theme="night" class="nav-clear">'
cat src/body.html
echo '<script>'; cat src/app.js; echo '</script></body></html>'
} > site/experience.html
