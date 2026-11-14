/* 오프라인 보관용 서비스 워커. 파일을 고치면 CACHE 숫자를 올리세요. */
var CACHE = 'fx-v1';
var FILES = ['./', 'index.html', 'manifest.webmanifest', 'rates.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
var RATES_URL = new URL('rates.json', self.registration.scope).href;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* 환율 파일은 인터넷이 되면 항상 새로 받고, 안 되면 저장본을 씁니다. */
  if (url.pathname.endsWith('/rates.json')) {
    e.respondWith(
      fetch(req, { cache: 'no-store' }).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(RATES_URL, copy); });
        }
        return res;
      }).catch(function () {
        /* 오프라인: 저장본을 돌려주되 저장본이라는 표시를 붙입니다. */
        return caches.match(RATES_URL).then(function (hit) {
          var h = { 'Content-Type': 'application/json', 'X-Cache': 'offline' };
          if (!hit) return new Response('{}', { status: 200, headers: h });
          return hit.blob().then(function (b) { return new Response(b, { status: 200, headers: h }); });
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(req).catch(function () { return caches.match('index.html'); });
    })
  );
});
