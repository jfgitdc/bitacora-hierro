// Service worker: permite abrir la app sin conexión.
// Cambia CACHE en cada versión nueva para que el celular descargue los archivos actualizados.
const CACHE = 'bitacora-v1.1.0';
const FB = 'https://www.gstatic.com/firebasejs/12.19.0/';
const SHELL = [
  './', './index.html', './styles.css', './app.js', './firebase-config.js',
  './catalogo-ejercicios.json', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  FB + 'firebase-app.js', FB + 'firebase-auth.js', FB + 'firebase-firestore.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Archivos de la propia app: primero la red (para recibir actualizaciones), si tarda o falla, la copia guardada.
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([fetch(req), timeout(3000)]);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') return cache.match('./index.html');
        throw err;
      }
    })());
    return;
  }

  // Librerías de Firebase (versión fija) y fuentes: primero la copia guardada.
  if (url.href.startsWith(FB) || url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }));
  }
  // Todo lo demás (Firestore, autenticación) pasa directo: Firebase maneja su propio modo sin conexión.
});
