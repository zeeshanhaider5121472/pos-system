const CACHE = "pos-v1"; // bump this version when you deploy UI updates
const CORE = [
  "/",
  "/pos",
  "/products",
  "/customers",
  "/reports",
  "/settings",
  "/activation",
];
self.addEventListener("install", (e) => {
  e.waitUntil(
    Promise.allSettled(
      CORE.map((u) => caches.open(CACHE).then((c) => c.add(u))),
    ),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) =>
        Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin"))
    return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((h) => h || caches.match("/"))),
  );
});
