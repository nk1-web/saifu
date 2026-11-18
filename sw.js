// ネットワーク優先・失敗時はキャッシュ。更新がすぐ反映され、オフラインでも開ける。
// OCR(Tesseract.js)の本体と言語データはCDNから取るので、一度使えば次回からはオフラインでも動く。
const CACHE = 'saifu-v2';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/store.js',
  'js/money.js',
  'js/fmt.js',
  'js/ui.js',
  'js/sheet.js',
  'js/icons.js',
  'js/categorize.js',
  'js/ocr.js',
  'js/editors.js',
  'js/stop.js',
  'js/charts.js',
  'js/views/home.js',
  'js/views/history.js',
  'js/views/plan.js',
  'js/views/savings.js',
  'js/views/settings.js',
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // 大きなOCR資材はキャッシュ優先（毎回ダウンロードしない）
  const heavy = /tesseract|tessdata|traineddata/.test(url.href);
  if (heavy) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, copy));
            }
            return res;
          })
      )
    );
    return;
  }
  const cacheable = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.host);
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && cacheable) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
