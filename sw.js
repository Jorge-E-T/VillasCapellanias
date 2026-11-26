/* Service worker: lets the app open offline and be installed on phones.
   Network first: online you always get the newest files; offline the last copy is used.
   Records are never stored here; they stay encrypted in the browser's database. */
const CACHE = 'vc-shell-v2';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css', './vc.png',
  './js/utils.js', './js/store.js', './js/model.js', './js/charts.js', './js/importer.js', './js/sync.js', './js/forms.js',
  './js/pages.js', './js/pages-books.js', './js/reports.js', './js/settings.js', './js/app.js', './firebase-config.js',
  './lib/exceljs.min.js', './lib/firebase/firebase-app-compat.js', './lib/firebase/firebase-auth-compat.js', './lib/firebase/firebase-firestore-compat.js',
  './fonts/marcellus.woff2', './fonts/source-sans-3-400-normal.woff2', './fonts/source-sans-3-600-normal.woff2', './fonts/source-sans-3-700-normal.woff2', './fonts/source-sans-3-400-italic.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-64.png', './icons/vc-mark.png'
];
self.addEventListener('install', (e) => {
  // a missing file (e.g. vc.png not uploaded yet) must not stop the install
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return; // Firebase goes straight to the network
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
