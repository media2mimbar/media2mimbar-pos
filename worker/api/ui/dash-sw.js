// Service worker dashboard: halaman "/" langsung tampil dari simpanan browser, versi terbaru diambil di belakang
// dan dipakai pada kunjungan berikutnya. Permintaan lain (API, POS) tidak disentuh.
const SIMPANAN = "hikayat-dashboard";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname !== "/") return;
  e.respondWith((async () => {
    const cache = await caches.open(SIMPANAN);
    const lama = await cache.match("/");
    const baru = fetch(e.request).then((r) => {
      if (r.ok) cache.put("/", r.clone());
      return r;
    });
    if (!lama) return baru;
    e.waitUntil(baru.catch(() => {}));
    return lama;
  })());
});
