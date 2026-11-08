// Km Líquido: guarda o app no celular para abrir sem internet.
// Os dados não passam por aqui: o Firebase cuida deles e sincroniza sozinho.
const CACHE = 'km-liquido-9';
const APP = ['./', './index.html', './style.css', './calc.js', './app.js', './fb.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const guardar = (req, res) => { if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then((ca) => ca.put(req, c)); } return res; };
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  const doApp = u.origin === self.location.origin;
  const sdk = u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/');
  const fontes = u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (doApp) {
    // Rede primeiro (pega as atualizações); sem internet, usa a cópia guardada
    e.respondWith(fetch(req, { cache: 'no-cache' }).then((r) => guardar(req, r)).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))));
  } else if (sdk || fontes) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => guardar(req, res))));
  }
});
