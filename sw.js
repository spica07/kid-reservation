/* 콘텐츠를 바꾸면 CACHE 숫자를 올린다. 데이터가 자주 바뀌어 네트워크 우선으로 받고, 끊겼을 때만 캐시를 쓴다. */
const CACHE = 'kr-cache-v2';
const ASSETS = [
  './', 'index.html', 'manifest.json', 'assets/css/app.css',
  'assets/js/schedule.js', 'assets/js/ics.js', 'assets/js/favorites.js', 'assets/js/app.js',
  'assets/data/programs.js', 'assets/data/public-programs.js',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/favicon-64.png', 'assets/icons/apple-touch-icon.png',
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request)));
});
