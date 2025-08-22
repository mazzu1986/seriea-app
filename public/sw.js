const CACHE = "v1";

self.addEventListener("install", (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Cache-first per asset statici
  if (url.origin === self.location.origin && (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icons/"))) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const cached = await c.match(e.request);
        if (cached) return cached;
        const res = await fetch(e.request);
        c.put(e.request, res.clone());
        return res;
      })
    );
    return;
  }

  // Network-first per API e pagine
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
