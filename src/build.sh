cd "$(dirname "$0")/.."
mkdir -p public
{
echo '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#131c28"><title>Endurance — The Human Intelligence Experience</title><link rel="icon" href="assets/endurance-symbol-orange.png">'
echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
echo '<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">'
echo '<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script><script defer src="/_vercel/insights/script.js"></script>'
echo '<style>'; cat src/style.css; echo '</style></head><body data-theme="night" class="nav-clear">'
cat src/body.html
echo '<script>'; cat src/app.js; echo '</script></body></html>'
} > public/index.html
