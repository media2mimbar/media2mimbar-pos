// Service worker POS: simpan file aplikasi supaya POS tetap terbuka tanpa sinyal.
// Data (katalog, antrean) tidak lewat sini; itu urusan IndexedDB di pos-data.js.
const VERSI = "__VERSI__";
const FILE = ["/pos", "/pos-app.js", "/pos-data.js", "/pos-struk.js", "/pos-qrcode.js", "/pos.webmanifest", "/pos-ikon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open("pos-" + VERSI).then((c) => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== "pos-" + VERSI).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || !FILE.includes(url.pathname)) return;
  // File aplikasi: ambil dari simpanan dulu (cepat dan jalan offline). Versi baru datang lewat VERSI.
  e.respondWith(caches.match(url.pathname).then((r) => r || fetch(e.request)));
});
