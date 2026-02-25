// service-worker.js
const CACHE_VERSION = "my-ledger-v1";

// 你這個 App 需要的「外部資源」也一起快取，離線才不會白畫面
const APP_SHELL = [
  "./",
  "./index.html",
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone/babel.min.js",
  "https://cdn.tailwindcss.com",
  "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(APP_SHELL);
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => (k !== CACHE_VERSION ? caches.delete(k) : Promise.resolve())));
      self.clients.claim();
    })()
  );
});

// index.html：network-first（有網路就抓新版）
// 其他資源：cache-first（確保離線可開）
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;

  const isIndex =
    url.origin === location.origin &&
    (url.pathname === "/" || url.pathname.endsWith("/index.html"));

  if (isIndex) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_VERSION);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          const cached = await caches.match(req);
          return cached || caches.match("./index.html");
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_VERSION);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        return cached;
      }
    })()
  );
});