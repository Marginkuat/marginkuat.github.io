// ══ MARGINKUAT — SERVICE WORKER ══
// Tujuan: bikin situs bisa dibuka & dipakai (termasuk kalkulator lot/risiko) walau internet
// terputus, dan bisa di-install ke home screen seperti aplikasi native.
//
// PENTING soal data: file ini HANYA meng-cache "app shell" (HTML/JS/CSS/ikon statis).
// Request ke Supabase (saldo, investor, dll) dan CoinGecko (harga live) TIDAK pernah
// di-cache di sini — selalu langsung ke server supaya data yang tampil selalu yang
// paling baru dan tidak ada risiko data basi/salah kelihatan seperti live.

const CACHE_VERSION = 'v1';
const CACHE_NAME = 'marginkuat-shell-' + CACHE_VERSION;

// Naikkan CACHE_VERSION (misal jadi 'v2') tiap kali kamu deploy perubahan besar ke
// index.html, biar service worker lama otomatis dibuang & yang baru dipakai.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './favicon-32.png',
  './favicon-16.png',
  './icon-192.png'
];

// ── INSTALL: simpan app shell ke cache ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.error('SW install gagal cache shell:', err))
  );
  self.skipWaiting(); // langsung aktif tanpa nunggu tab lama ditutup
});

// ── ACTIVATE: buang cache versi lama ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: strategi beda untuk halaman vs asset statis, dan skip total untuk API eksternal ──
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Jangan intercept sama sekali:
  // - request non-GET (POST/PATCH/DELETE ke Supabase, dll)
  // - request cross-origin (Supabase, CoinGecko, Disqus, Google Fonts)
  // Biarkan lewat langsung ke network seperti biasa, tanpa campur tangan SW.
  if (req.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Navigasi ke halaman (buka/refresh situs): network-first.
  // Kalau online → selalu ambil versi terbaru & update cache.
  // Kalau offline → fallback ke index.html yang tersimpan di cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Asset statis same-origin lain (manifest, ikon, favicon): cache-first,
  // fallback ke network kalau belum ada di cache, lalu simpan buat lain kali.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      });
    })
  );
});
