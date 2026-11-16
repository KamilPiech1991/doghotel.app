// Uzupełnia dist/index.html o dane potrzebne do instalacji na telefonie (PWA)
// i tworzy 404.html, żeby odświeżenie podstrony działało na GitHub Pages.
import fs from 'node:fs';

const file = 'dist/index.html';
let html = fs.readFileSync(file, 'utf8');
const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
const head = `
    <link rel="manifest" href="${base}/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="${base}/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Psotelgracja" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="robots" content="noindex" />`;

html = html.replace(/<html[^>]*>/, '<html lang="pl">');
html = html.replace(/<title>.*?<\/title>/, '<title>Psotelgracja</title>');
html = html.replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />');
if (!html.includes('rel="manifest"')) html = html.replace('</head>', `${head}\n  </head>`);
fs.writeFileSync(file, html);
fs.copyFileSync(file, 'dist/404.html');
fs.writeFileSync('dist/.nojekyll', '');
console.log('PWA: index.html i 404.html gotowe');
