/* Service Worker - Digital Display Masjid
 * Version 1.9.0 (Fase 10)
 * Menyimpan halaman dan font di TV agar bisa dibuka tanpa internet.
 * Data jadwal TIDAK ditangani di sini: data disimpan oleh index.html di localStorage.
 */

var VERSI = 'ddm-v1.9.0';
var CACHE_FONT = 'ddm-fonts';
var SHELL = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSI)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          if (k.indexOf('ddm-') === 0 && k !== VERSI && k !== CACHE_FONT) {
            return caches.delete(k);
          }
          return null;
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

/** Jaringan dulu (maksimal 5 detik), jika gagal pakai salinan tersimpan. */
function jaringanDulu(req) {
  var ambil = fetch(req).then(function (res) {
    if (res && res.ok) {
      var salinan = res.clone();
      caches.open(VERSI).then(function (cache) { cache.put(req, salinan); });
    }
    return res;
  });
  var batas = new Promise(function (_, tolak) {
    setTimeout(function () { tolak(new Error('timeout')); }, 5000);
  });
  return Promise.race([ambil, batas]).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (m) {
      if (m) return m;
      if (req.mode === 'navigate') {
        return caches.match('./index.html').then(function (h) { return h || Response.error(); });
      }
      return Response.error();
    });
  });
}

/** Font: pakai salinan tersimpan, sambil memperbarui di belakang layar. */
function salinanDulu(req) {
  return caches.open(CACHE_FONT).then(function (cache) {
    return cache.match(req).then(function (cached) {
      var ambil = fetch(req).then(function (res) {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          cache.put(req, res.clone());
        }
        return res;
      }).catch(function () { return cached || Response.error(); });
      return cached || ambil;
    });
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Data dari Apps Script: biarkan langsung ke jaringan (ditangani index.html)
  if (url.hostname === 'script.google.com' || url.hostname.slice(-17) === 'googleusercontent.com') return;

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(salinanDulu(req));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(jaringanDulu(req));
  }
});