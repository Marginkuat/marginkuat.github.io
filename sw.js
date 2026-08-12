// ══════════════════════════════════════════
// SERVICE WORKER — MARGINKUAT
// Strategi: Network-First untuk halaman (HTML) supaya update situs
// SELALU langsung kepakai di semua HP begitu di-upload ke GitHub —
// tidak nyangkut di cache lama lagi.
// Aset statis (gambar/icon) tetap di-cache biar app tetap ringan & bisa
// dibuka offline, tapi versi cache-nya otomatis dibuang tiap ada update
// (lihat CACHE_VERSION di bawah — naikkan angkanya tiap kali situs di-deploy
// kalau suatu saat masih ada yang nyangkut).
// ══════════════════════════════════════════

const CACHE_VERSION = 'marginkuat-v2';
const STATIC_CACHE = CACHE_VERSION + '-static';

// Aset yang aman di-cache (jarang berubah)
const STATIC_ASSETS = [
  '/favicon-16.png',
  '/favicon-32.png',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
];

// ── INSTALL: langsung aktif, gak nunggu tab lama ditutup ──
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Kalau ada aset yang gagal di-cache (misal nama file beda), jangan sampai gagal total
      });
    })
  );
});

// ── ACTIVATE: hapus semua cache versi lama, ambil alih tab yang lagi kebuka ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH ──
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Cuma tangani GET request ke origin sendiri
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) {
    return;
  }

  // HTML / navigasi halaman → NETWORK-FIRST (selalu coba ambil versi terbaru dari server dulu)
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => res)
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Aset statis (gambar/icon/manifest) → cache-first, tapi tetap update cache di background
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const resClone = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(req, resClone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
