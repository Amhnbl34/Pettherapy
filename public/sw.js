/* Service Worker پت‌تراپی: اسکلت سایت آفلاین هم باز می‌شود؛ API همیشه از شبکه می‌آید.
   با هر تغییر فایل‌های استاتیک، عدد VERSION را بالا ببرید. */
const VERSION = 'pt-v1';
const SHELL = ['/', '/css/app.css', '/css/extra.css', '/js/prefs.js', '/js/data.js', '/js/core.js', '/js/home.js', '/js/learn-pics.js', '/js/shop.js', '/js/cart.js', '/js/router.js', '/js/auth.js', '/js/account.js', '/js/guide.js', '/js/patches.js', '/js/features.js', '/js/server-mode.js', '/js/ui.js', '/icons/icon.svg', '/manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/admin') || u.pathname === '/sw.js') return;
  // صفحه‌ها و کد: اول شبکه (همیشه تازه)، اگر آفلاین بود از کش
  if (r.mode === 'navigate' || /\.(js|css|webmanifest)$/.test(u.pathname)) {
    e.respondWith(fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(VERSION).then((c) => c.put(r, cp)); } return res; }).catch(() => caches.match(r).then((m) => m || caches.match('/'))));
    return;
  }
  // تصویر/صدا/آپلود: اول کش، بعد شبکه
  e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok && (res.type === 'basic')) { const cp = res.clone(); caches.open(VERSION).then((c) => c.put(r, cp)); } return res; })));
});
