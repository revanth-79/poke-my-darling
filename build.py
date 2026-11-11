"""Builds the installable app into docs/ (served by GitHub Pages).
Run from the repo root:  (cd fb && npm install) && python3 build.py"""
import base64, gzip, pathlib, subprocess, time
root = pathlib.Path(__file__).resolve().parent
src, out = root / 'src', root / 'docs'
order = ['core.js', 'g_common.js', 'ui.js', 'g_fight.js', 'g_duel.js', 'g_board.js', 'g_pool.js', 'g_words.js']
js = '\n'.join((src / f).read_text() for f in order) + '\nboot();\n'
b64 = base64.b64encode(gzip.compress((src / 'dict.txt').read_bytes(), 9)).decode()
subprocess.run(['npx', 'esbuild', 'fb.js', '--bundle', '--minify', '--format=iife', '--target=es2020', f'--outfile={out / "fb.js"}', '--log-level=error'], cwd=root / 'fb', check=True)
ver = time.strftime('%Y%m%d%H%M')
head = (src / 'head.html').read_text()
html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#160e1e">
<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Across Town">
<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icons/icon-192.png"><link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>:root{{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}}body{{margin:0;font:14px system-ui}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
{head}
</head><body>
<script type="text/plain" id="dictdata">{b64}</script>
<script src="firebase-config.js?v={ver}"></script>
<script src="fb.js?v={ver}"></script>
<script src="app.js?v={ver}"></script>
<script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {{}});</script>
</body></html>
'''
(out / 'index.html').write_text(html)
(out / 'app.js').write_text(js)
(out / 'sw.js').write_text('''// Network first, so updates arrive straight away; the cache only covers opening the app offline.
const CACHE = 'across-town-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
''')
print('built', ver, len(html), len(js))
