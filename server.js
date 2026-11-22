'use strict';
/* ============================================================
   بک‌اند پت‌تراپی — بدون هیچ وابستگی (فقط Node.js 18 به بالا)
   اجرا:  node server.js   (یا npm start)
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const U = require('./lib/util');
U.loadEnv(path.join(__dirname, '.env'));
const DB = require('./lib/db');

const PORT = +process.env.PORT || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const PUBLIC = path.join(__dirname, 'public');
const UPLOADS = path.join(DATA_DIR, 'uploads');
const db = new DB(DATA_DIR);
const D = db.d;

/* ---------- تنظیمات فروشگاه ---------- */
const CONFIG = {
  shipFree: 10000000,   // ارسال رایگان برای سفارش بالاتر از این مبلغ (تومان)
  shipFee: 200000,      // هزینه‌ی ارسال در غیر این صورت
  online: false,        // پرداخت آنلاین (درگاه) هنوز وصل نیست
  codes: {              // کدهای تخفیف
    PET10: { label: '۱۰٪ تخفیف', pct: 10 },
    WELCOME: { label: '۵۰۰ هزار تومان تخفیف (فقط سفارش اول)', amount: 500000, firstOnly: true },
  },
};
const COLOR_KEYS = ['dark', 'green', 'cream', 'orange', 'bg', 'card', 'text'];
const DEFAULT_SETTINGS = {
  siteName: 'پت‌تراپی', tagline: 'سلامتی و راحتی برای فرشته‌هاتون', phone: '02155148777', email: 'petherapy@gmail.com',
  address: 'تهران، اسلامشهر، باغ‌فیض', banner: '', bannerOn: false, maintenance: false, mainStore: 0, colors: {},
};
const ANIMALS = ['dog', 'cat', 'bird', 'rabbit'];
const ORDER_ST = ['reg', 'prep', 'ship', 'done', 'can'];
const PET_KINDS = ['dog', 'cat', 'bird', 'rabbit'];

/* ---------- داده‌ی اولیه ---------- */
if (!D.products.length) {
  for (const p of require('./lib/seed-products.json')) D.products.push({ id: db.next('product'), ...p });
  db.flush();
  console.log('✔ ' + D.products.length + ' محصول اولیه ساخته شد');
}

/* ---------- مهاجرت دیتای قدیمی به ساختار چندفروشگاهی ---------- */
D.settings = { ...DEFAULT_SETTINGS, ...(D.settings || {}) };
if (!D.stores.length) {
  D.stores.push({ id: db.next('store'), slug: 'main', name: 'شعبه مرکزی', city: 'تهران', address: D.settings.address, phone: D.settings.phone, active: true, shipFree: CONFIG.shipFree, shipFee: CONFIG.shipFee, ts: Date.now() });
}
for (const p of D.products) if (!p.storeId) p.storeId = D.stores[0].id;
for (const o of D.orders) if (!o.storeId) o.storeId = D.stores[0].id;
db.flush();

/* ---------- ابزارها ---------- */
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = (msg, status = 400) => { throw new HttpError(status, msg); };
const send = (res, status, obj, headers = {}) => {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
};
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new HttpError(413, 'حجم درخواست زیاد است')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { const j = JSON.parse(Buffer.concat(chunks).toString('utf8')); resolve(j && typeof j === 'object' ? j : {}); }
      catch (e) { reject(new HttpError(400, 'JSON نامعتبر')); }
    });
    req.on('error', reject);
  });
}
const cookies = (req) => Object.fromEntries(String(req.headers.cookie || '').split(';').map((s) => s.trim().split('=')).filter((a) => a[0]).map(([k, ...v]) => [k, v.join('=')]));
const isHttps = (req) => process.env.COOKIE_SECURE === '1' || req.headers['x-forwarded-proto'] === 'https' || !!req.socket.encrypted;
const ip = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

function sessionUser(req) {
  const sid = cookies(req).pt_sid; if (!sid) return null;
  const h = U.sha(sid), now = Date.now();
  const s = D.sessions.find((x) => x.h === h && x.exp > now);
  return s ? D.users.find((u) => u.id === s.uid) || null : null;
}
function startSession(req, res, user) {
  const t = U.token();
  D.sessions = D.sessions.filter((s) => s.exp > Date.now());
  D.sessions.push({ h: U.sha(t), uid: user.id, exp: Date.now() + 30 * 864e5 });
  db.save();
  return 'pt_sid=' + t + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000' + (isHttps(req) ? '; Secure' : '');
}
const pubUser = (u) => ({ id: u.id, name: u.name, mobile: u.mobile, email: u.email || '', addrs: u.addrs || [], pets: u.pets || [], wish: u.wish || [], ts: u.ts, role: u.role || 'user', stores: u.stores || [] });
const pubStore = (s) => ({ id: s.id, slug: s.slug, name: s.name, city: s.city || '', address: s.address || '', phone: s.phone || '', shipFree: s.shipFree, shipFee: s.shipFee });
const pubSettings = () => ({ ...D.settings });
const pubProduct = (p) => ({ id: p.id, storeId: p.storeId, animal: p.animal, cat: p.cat, name: p.name, price: p.price, emoji: p.emoji, brand: p.brand, note: p.note, disc: p.disc, img: p.img, stock: p.stock });
const pubOrder = (o) => ({ id: o.id, storeId: o.storeId, ts: o.ts, items: o.items, sub: o.sub, dc: o.dc, ship: o.ship, grand: o.grand, code: o.code, to: o.to, pm: o.pm, note: o.note, st: o.st, tr: o.tr });

function needUser(ctx) { if (!ctx.user) bad('ابتدا وارد حساب شوید', 401); return ctx.user; }
function needAdmin(ctx) { const u = needUser(ctx); if (u.role !== 'admin') bad('دسترسی مدیر لازم است', 403); return u; }
// کارکنان: مدیر کل (admin) یا مدیر فروشگاه (manager)
function needStaff(ctx) { const u = needUser(ctx); if (u.role !== 'admin' && u.role !== 'manager') bad('دسترسی مدیر لازم است', 403); return u; }
// فهرست شناسه‌ی فروشگاه‌هایی که کاربر کارمند به آن‌ها دسترسی دارد (null = همه)
function scopeOf(u) { return u.role === 'admin' ? null : (u.stores || []); }
function inScope(u, storeId) { const s = scopeOf(u); return s === null || s.includes(storeId); }
function storeById(id) { return D.stores.find((s) => s.id === +id); }

function cleanAddrs(a) {
  if (!Array.isArray(a)) bad('آدرس‌ها نامعتبر است');
  return a.slice(0, 10).map((x) => ({ t: U.str(x && x.t, 30) || 'آدرس', c: U.str(x && x.c, 40), a: U.str(x && x.a, 300) })).filter((x) => x.c && x.a);
}
function cleanPets(a) {
  if (!Array.isArray(a)) bad('اطلاعات حیوان‌ها نامعتبر است');
  return a.slice(0, 20).map((x) => ({ n: U.str(x && x.n, 20), k: PET_KINDS.includes(x && x.k) ? x.k : 'dog', a: Math.max(0, Math.min(60, parseInt(x && x.a, 10) || 0)) })).filter((x) => x.n);
}

/* ---------- محاسبه‌ی سبد (سمت سرور؛ قیمت‌ها از کلاینت قبول نمی‌شود) ---------- */
function priceOf(p) { return p.disc ? Math.round(p.price * (100 - p.disc) / 100 / 1000) * 1000 : p.price; }
function buildOrder(user, body, store) {
  const items = Array.isArray(body.items) ? body.items.slice(0, 60) : [];
  if (!items.length) bad('سبد خرید خالی است');
  const merged = new Map();
  for (const it of items) {
    const pid = +it.pid, q = parseInt(it.q, 10);
    if (!Number.isInteger(pid) || !(q >= 1 && q <= 20)) bad('آیتم سبد نامعتبر است');
    merged.set(pid, (merged.get(pid) || 0) + q);
  }
  const lines = []; let sub = 0;
  for (const [pid, q] of merged) {
    const p = D.products.find((x) => x.id === pid && x.active && x.storeId === store.id);
    if (!p) bad('یکی از محصولات سبد در این فروشگاه موجود نیست؛ صفحه را تازه کنید', 409);
    if (p.stock != null && p.stock < q) bad('موجودی «' + p.name + '» فقط ' + p.stock + ' عدد است', 409);
    const price = priceOf(p); sub += price * q;
    lines.push({ p, pid, n: p.name, price, q });
  }
  const code = U.str(body.coupon, 20).toUpperCase();
  let dc = 0, usedCode = '';
  if (code) {
    const c = CONFIG.codes[code];
    if (!c) bad('کد تخفیف معتبر نیست');
    if (c.firstOnly && D.orders.some((o) => o.uid === user.id && o.st !== 'can')) bad('این کد فقط برای سفارش اول است');
    dc = Math.min(sub, c.pct ? Math.round(sub * c.pct / 100) : c.amount); usedCode = code;
  }
  const net = sub - dc, ship = net >= store.shipFree ? 0 : store.shipFee;
  return { lines, sub, dc, ship, grand: net + ship, code: usedCode };
}

/* ---------- مسیرها ---------- */
const routes = [];
const R = (method, pattern, fn, limit = 1e6) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn, limit });

R('GET', '/api/health', () => ({ ok: true }));
const publicConfig = (store) => ({ ...CONFIG, shipFree: store ? store.shipFree : CONFIG.shipFree, shipFee: store ? store.shipFee : CONFIG.shipFee });
const activeStores = () => D.stores.filter((x) => x.active);
const mainStore = () => { const a = activeStores(); return a.find((x) => x.id === +D.settings.mainStore) || a[0] || null; };
// مشتری همیشه فروشگاه اصلی سایت را می‌بیند؛ فقط مدیر کل می‌تواند فروشگاه دیگری را انتخاب کند
const siteStore = (user, want) => { const a = activeStores(); return user && user.role === 'admin' && want ? (a.find((x) => x.id === +want) || mainStore()) : mainStore(); };
R('GET', '/api/stores', (c) => ({ stores: (c.user && c.user.role === 'admin' ? activeStores() : [mainStore()].filter(Boolean)).map(pubStore) }));
R('GET', '/api/bootstrap', (c) => {
  const isAdm = c.user && c.user.role === 'admin', store = siteStore(c.user, +c.url.searchParams.get('store') || 0);
  const stores = isAdm ? activeStores() : (store ? [store] : []);
  return {
    stores: stores.map(pubStore), store: store ? pubStore(store) : null, needStore: !store,
    products: store ? D.products.filter((p) => p.active && p.storeId === store.id).map(pubProduct) : [],
    user: c.user ? pubUser(c.user) : null, config: publicConfig(store), settings: pubSettings(),
  };
});
R('GET', '/api/products', (c) => {
  const sid = +c.url.searchParams.get('store') || 0;
  return { products: D.products.filter((p) => p.active && (!sid || p.storeId === sid)).map(pubProduct) };
});

R('POST', '/api/register', (c) => {
  if (U.limited('reg:' + c.ip, 10, 36e5)) bad('تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره امتحان کنید', 429);
  const b = c.body, name = U.str(b.name, 60), mobile = U.normMobile(b.mobile), email = U.str(b.email, 120).toLowerCase(), pw = String(b.password || '');
  if (name.length < 2) bad('نام را وارد کنید');
  if (!U.isMobile(mobile)) bad('شماره موبایل معتبر نیست (مثل ۰۹۱۲۳۴۵۶۷۸۹)');
  if (email && !U.isEmail(email)) bad('ایمیل معتبر نیست');
  if (pw.length < 6 || pw.length > 100) bad('رمز عبور حداقل ۶ کاراکتر باشد');
  if (D.users.some((u) => u.mobile === mobile || (email && u.email === email))) bad('با این مشخصات قبلاً ثبت‌نام شده؛ وارد شوید', 409);
  const adminMobile = U.normMobile(process.env.ADMIN_MOBILE || '');
  const u = { id: db.next('user'), name, mobile, email, pw: U.hashPw(pw), role: adminMobile && adminMobile === mobile ? 'admin' : 'user', addrs: [], pets: [], wish: [], ts: Date.now() };
  D.users.push(u); db.save();
  return { status: 201, headers: { 'Set-Cookie': startSession(c.req, c.res, u) }, body: { user: pubUser(u) } };
});
R('POST', '/api/login', (c) => {
  if (U.limited('login:' + c.ip, 15, 10 * 6e4)) bad('تعداد تلاش‌ها زیاد است؛ ۱۰ دقیقه بعد دوباره امتحان کنید', 429);
  const id = U.normMobile(String(c.body.id || '').toLowerCase()), u = D.users.find((x) => x.mobile === id || (x.email && x.email === id));
  if (!u || !U.checkPw(c.body.password, u.pw)) bad('مشخصات یا رمز عبور اشتباه است', 401);
  return { headers: { 'Set-Cookie': startSession(c.req, c.res, u) }, body: { user: pubUser(u) } };
});
R('POST', '/api/admin/login', (c) => {
  if (U.limited('alogin:' + c.ip, 10, 10 * 6e4)) bad('تعداد تلاش‌ها زیاد است؛ ۱۰ دقیقه بعد دوباره امتحان کنید', 429);
  const raw = String(c.body.id || '').trim().toLowerCase(), mob = U.normMobile(raw);
  const u = D.users.find((x) => (x.email && x.email === raw) || (x.username && x.username === raw) || x.mobile === mob);
  if (!u || !U.checkPw(c.body.password, u.pw)) bad('ایمیل/شناسه یا رمز عبور اشتباه است', 401);
  if (u.role !== 'admin' && u.role !== 'manager') bad('این حساب دسترسی مدیریت ندارد', 403);
  return { headers: { 'Set-Cookie': startSession(c.req, c.res, u) }, body: { user: pubUser(u) } };
});
R('POST', '/api/logout', (c) => {
  const sid = cookies(c.req).pt_sid;
  if (sid) { D.sessions = D.sessions.filter((s) => s.h !== U.sha(sid)); db.save(); }
  return { headers: { 'Set-Cookie': 'pt_sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' }, body: { ok: true } };
});
R('GET', '/api/me', (c) => ({ user: c.user ? pubUser(c.user) : null }));
R('PUT', '/api/me', (c) => {
  const u = needUser(c), b = c.body;
  if ('name' in b) { const n = U.str(b.name, 60); if (n.length < 2) bad('نام را وارد کنید'); u.name = n; }
  if ('mobile' in b) {
    const m = U.normMobile(b.mobile); if (!U.isMobile(m)) bad('شماره موبایل معتبر نیست');
    if (D.users.some((x) => x.id !== u.id && x.mobile === m)) bad('این شماره برای حساب دیگری ثبت شده', 409); u.mobile = m;
  }
  if ('email' in b) {
    const e = U.str(b.email, 120).toLowerCase(); if (e && !U.isEmail(e)) bad('ایمیل معتبر نیست');
    if (e && D.users.some((x) => x.id !== u.id && x.email === e)) bad('این ایمیل برای حساب دیگری ثبت شده', 409); u.email = e;
  }
  if ('addrs' in b) u.addrs = cleanAddrs(b.addrs);
  if ('pets' in b) u.pets = cleanPets(b.pets);
  if ('wish' in b) { if (!Array.isArray(b.wish)) bad('نامعتبر'); u.wish = [...new Set(b.wish.map(Number).filter(Number.isInteger))].slice(0, 500); }
  db.save(); return { user: pubUser(u) };
});
R('POST', '/api/me/password', (c) => {
  const u = needUser(c);
  if (U.limited('pw:' + u.id, 10, 36e5)) bad('تعداد تلاش‌ها زیاد است', 429);
  if (!U.checkPw(c.body.old, u.pw)) bad('رمز فعلی اشتباه است');
  const pw = String(c.body.pw || ''); if (pw.length < 6 || pw.length > 100) bad('رمز جدید حداقل ۶ کاراکتر باشد');
  u.pw = U.hashPw(pw);
  const keep = cookies(c.req).pt_sid ? U.sha(cookies(c.req).pt_sid) : '';
  D.sessions = D.sessions.filter((s) => s.uid !== u.id || s.h === keep); // سایر دستگاه‌ها خارج می‌شوند
  db.save(); return { ok: true };
});

R('GET', '/api/orders', (c) => ({ orders: D.orders.filter((o) => o.uid === needUser(c).id).sort((a, b) => b.ts - a.ts).map(pubOrder) }));
R('POST', '/api/orders', (c) => {
  const u = needUser(c), b = c.body;
  if (U.limited('ord:' + u.id, 20, 36e5)) bad('تعداد سفارش‌ها در ساعت زیاد است', 429);
  const to = { n: U.str(b.to && b.to.n, 60), m: U.normMobile(b.to && b.to.m), c: U.str(b.to && b.to.c, 40), a: U.str(b.to && b.to.a, 300) };
  if (to.n.length < 2) bad('نام گیرنده را وارد کنید');
  if (!U.isMobile(to.m)) bad('شماره موبایل معتبر نیست');
  if (!to.c) bad('شهر را وارد کنید');
  if (to.a.length < 10) bad('آدرس را کامل‌تر بنویسید');
  const pm = b.pm === 'online' ? 'online' : 'cod';
  if (pm === 'online' && !CONFIG.online) bad('پرداخت آنلاین هنوز فعال نیست؛ «پرداخت در محل» را انتخاب کنید');
  if (D.settings.maintenance) bad('فروشگاه موقتاً در حال بروزرسانی است؛ کمی بعد سفارش دهید', 503);
  const store = siteStore(u, b.store);
  if (!store) bad('فروشگاه انتخاب‌شده معتبر نیست', 400);
  const o = buildOrder(u, b, store);
  for (const l of o.lines) if (l.p.stock != null) l.p.stock -= l.q; // کم کردن موجودی
  const order = {
    id: db.next('order'), uid: u.id, storeId: store.id, ts: Date.now(),
    items: o.lines.map((l) => ({ pid: l.pid, n: l.n, p: l.price, q: l.q })),
    sub: o.sub, dc: o.dc, ship: o.ship, grand: o.grand, code: o.code, to, pm, note: U.str(b.note, 300), st: 'reg',
    tr: 'PT' + U.token().slice(0, 6).toUpperCase(),
  };
  D.orders.push(order); db.save();
  return { status: 201, body: { order: pubOrder(order) } };
});
R('POST', '/api/orders/:id/cancel', (c) => {
  const u = needUser(c), o = D.orders.find((x) => x.id === +c.params.id && x.uid === u.id);
  if (!o) bad('سفارش پیدا نشد', 404);
  if (o.st !== 'reg') bad('این سفارش دیگر قابل لغو نیست');
  cancelOrder(o); return { order: pubOrder(o) };
});
function cancelOrder(o) {
  if (o.st === 'can') return;
  for (const it of o.items) { const p = D.products.find((x) => x.id === it.pid); if (p && p.stock != null) p.stock += it.q; }
  o.st = 'can'; db.save();
}

/* کوچولوی برتر (عکس و امتیاز) */
const IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
R('GET', '/api/pets', () => {
  const since = Date.now() - 30 * 864e5, pets = D.pets.filter((p) => p.ts > since).slice(-200);
  const ids = new Set(pets.map((p) => String(p.id)));
  return { pets: pets.map((p) => ({ id: String(p.id), name: p.name, img: p.img, day: p.day, ts: p.ts })), rates: D.rates.filter((r) => ids.has(String(r.pet))).map((r) => ({ pet: String(r.pet), uid: r.uid, star: r.star, day: r.day })) };
}, 1e6);
R('POST', '/api/pets', (c) => {
  const u = needUser(c), img = String(c.body.img || ''), name = U.str(c.body.name, 30) || 'کوچولوی ناشناس';
  if (!IMG_RE.test(img) || img.length > 400000) bad('عکس نامعتبر یا بزرگ است');
  const day = new Date().toDateString();
  if (D.pets.filter((p) => p.uid === u.id && p.ts > Date.now() - 864e5).length >= 5) bad('امروز بیشتر از ۵ عکس نمی‌شود فرستاد', 429);
  const p = { id: db.next('pet'), uid: u.id, name, img, day: U.str(c.body.day, 40) || day, ts: Date.now() };
  D.pets.push(p); db.save(); return { status: 201, body: { id: String(p.id) } };
}, 1e6);
R('POST', '/api/pets/:id/rate', (c) => {
  const u = needUser(c), star = parseInt(c.body.star, 10);
  if (!(star >= 1 && star <= 5)) bad('امتیاز نامعتبر است');
  if (!D.pets.some((p) => String(p.id) === c.params.id)) bad('عکس پیدا نشد', 404);
  D.rates = D.rates.filter((r) => !(String(r.pet) === c.params.id && r.uid === u.id));
  D.rates.push({ pet: c.params.id, uid: u.id, star, day: U.str(c.body.day, 40) || new Date().toDateString() });
  db.save(); return { ok: true };
});

/* ---------- مدیریت (مدیر کل = admin ، مدیر فروشگاه = manager) ---------- */
const ROLES = ['user', 'manager', 'admin'];
// فیلتر فروشگاه برای کارمند؛ پارامتر ?store= اختیاری است
function staffStores(c) {
  const u = needStaff(c), want = +c.url.searchParams.get('store') || 0, sc = scopeOf(u);
  if (want) { if (!inScope(u, want)) bad('به این فروشگاه دسترسی ندارید', 403); return [want]; }
  return sc === null ? D.stores.map((x) => x.id) : sc;
}
const adminProduct = (p) => ({ ...p, storeName: (storeById(p.storeId) || {}).name || '' });
R('GET', '/api/admin/me', (c) => {
  const u = needStaff(c), sc = scopeOf(u);
  return { user: pubUser(u), stores: D.stores.filter((s) => sc === null || sc.includes(s.id)), settings: D.settings };
});
R('GET', '/api/admin/stats', (c) => {
  const ids = staffStores(c), live = D.orders.filter((o) => ids.includes(o.storeId) && o.st !== 'can'), prods = D.products.filter((p) => ids.includes(p.storeId));
  const day = Date.now() - 7 * 864e5;
  return {
    users: c.user.role === 'admin' ? D.users.length : null, products: prods.length, orders: D.orders.filter((o) => ids.includes(o.storeId)).length,
    revenue: live.reduce((s, o) => s + o.grand, 0), revenue7: live.filter((o) => o.ts > day).reduce((s, o) => s + o.grand, 0),
    pending: D.orders.filter((o) => ids.includes(o.storeId) && o.st === 'reg').length,
    low: prods.filter((p) => p.active && p.stock != null && p.stock <= 5).map((p) => ({ id: p.id, name: p.name, stock: p.stock, storeId: p.storeId, storeName: (storeById(p.storeId) || {}).name })),
    byStore: D.stores.filter((s) => ids.includes(s.id)).map((s) => ({ id: s.id, name: s.name, orders: D.orders.filter((o) => o.storeId === s.id && o.st !== 'can').length, revenue: D.orders.filter((o) => o.storeId === s.id && o.st !== 'can').reduce((a, o) => a + o.grand, 0) })),
  };
});
R('GET', '/api/admin/products', (c) => { const ids = staffStores(c); return { products: D.products.filter((p) => ids.includes(p.storeId)).map(adminProduct) }; });
function cleanProduct(b, base = {}) {
  const p = { ...base };
  const set = (k, v) => { p[k] = v; };
  if ('name' in b || !base.id) { const v = U.str(b.name, 120); if (!v) bad('نام محصول لازم است'); set('name', v); }
  if ('brand' in b) set('brand', U.str(b.brand, 60)); else if (!base.id) set('brand', '');
  if ('animal' in b || !base.id) { if (!ANIMALS.includes(b.animal)) bad('حیوان نامعتبر است'); set('animal', b.animal); }
  if ('cat' in b || !base.id) { const v = +b.cat; if (![1, 2, 3, 4].includes(v)) bad('دسته نامعتبر است'); set('cat', v); }
  if ('price' in b || !base.id) { const v = Math.round(+b.price); if (!(v >= 0 && v <= 1e10)) bad('قیمت نامعتبر است'); set('price', v); }
  if ('disc' in b) { const v = Math.round(+b.disc || 0); if (!(v >= 0 && v <= 90)) bad('تخفیف باید بین ۰ تا ۹۰ باشد'); set('disc', v); } else if (!base.id) set('disc', 0);
  if ('stock' in b) { if (b.stock === null || b.stock === '') set('stock', null); else { const v = Math.round(+b.stock); if (!(v >= 0 && v <= 1e6)) bad('موجودی نامعتبر است'); set('stock', v); } } else if (!base.id) set('stock', 0);
  if ('note' in b) set('note', U.str(b.note, 40)); else if (!base.id) set('note', '');
  if ('emoji' in b) set('emoji', U.str(b.emoji, 8) || '🐾'); else if (!base.id) set('emoji', '🐾');
  if ('img' in b) { const v = U.str(b.img, 500); if (v && !/^(https?:\/\/|\/uploads\/)/.test(v)) bad('آدرس عکس باید با http یا /uploads شروع شود'); set('img', v); } else if (!base.id) set('img', '');
  if ('active' in b) set('active', !!b.active); else if (!base.id) set('active', true);
  return p;
}
R('POST', '/api/admin/products', (c) => {
  const u = needStaff(c), sid = +c.body.storeId || (D.stores.length === 1 ? D.stores[0].id : 0);
  if (!storeById(sid)) bad('فروشگاه را انتخاب کنید'); if (!inScope(u, sid)) bad('به این فروشگاه دسترسی ندارید', 403);
  const p = cleanProduct(c.body); p.id = db.next('product'); p.storeId = sid; D.products.push(p); db.save(); return { status: 201, body: { product: adminProduct(p) } };
});
function findProduct(c) {
  const u = needStaff(c), i = D.products.findIndex((x) => x.id === +c.params.id); if (i < 0) bad('محصول پیدا نشد', 404);
  if (!inScope(u, D.products[i].storeId)) bad('به این فروشگاه دسترسی ندارید', 403); return i;
}
R('PUT', '/api/admin/products/:id', (c) => { const i = findProduct(c); D.products[i] = cleanProduct(c.body, D.products[i]); db.save(); return { product: adminProduct(D.products[i]) }; });
R('DELETE', '/api/admin/products/:id', (c) => { const i = findProduct(c); D.products.splice(i, 1); db.save(); return { ok: true }; });
R('POST', '/api/admin/upload', (c) => {
  needStaff(c); const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(c.body.dataUrl || ''));
  if (!m) bad('فقط عکس jpeg/png/webp'); const buf = Buffer.from(m[2], 'base64'); if (buf.length > 1.5e6) bad('حجم عکس بیشتر از ۱٫۵ مگابایت است');
  const name = U.token().slice(0, 20) + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(UPLOADS, name), buf); return { url: '/uploads/' + name };
}, 2.5e6);
R('GET', '/api/admin/orders', (c) => {
  const ids = staffStores(c);
  return { orders: D.orders.filter((o) => ids.includes(o.storeId)).sort((a, b) => b.ts - a.ts).slice(0, 300).map((o) => { const u = D.users.find((x) => x.id === o.uid) || {}; return { ...pubOrder(o), storeName: (storeById(o.storeId) || {}).name || '', user: { name: u.name, mobile: u.mobile } }; }) };
});
R('PUT', '/api/admin/orders/:id', (c) => {
  const u = needStaff(c), o = D.orders.find((x) => x.id === +c.params.id); if (!o) bad('سفارش پیدا نشد', 404);
  if (!inScope(u, o.storeId)) bad('به این فروشگاه دسترسی ندارید', 403);
  const st = c.body.st; if (!ORDER_ST.includes(st)) bad('وضعیت نامعتبر است');
  if (o.st === 'can' && st !== 'can') bad('سفارش لغوشده را نمی‌شود دوباره فعال کرد');
  if (st === 'can') cancelOrder(o); else { o.st = st; db.save(); }
  return { order: pubOrder(o) };
});

/* کاربران و نقش‌ها: فقط مدیر کل */
R('GET', '/api/admin/users', (c) => {
  needAdmin(c);
  return { users: D.users.map((u) => ({ id: u.id, name: u.name, mobile: u.mobile, email: u.email, role: u.role || 'user', stores: u.stores || [], ts: u.ts, orders: D.orders.filter((o) => o.uid === u.id).length })) };
});
R('PUT', '/api/admin/users/:id', (c) => {
  const me = needAdmin(c), u = D.users.find((x) => x.id === +c.params.id); if (!u) bad('کاربر پیدا نشد', 404);
  const role = c.body.role; if (!ROLES.includes(role)) bad('نقش نامعتبر است');
  if (u.id === me.id && role !== 'admin') bad('نقش مدیر کل خودتان را نمی‌شود پایین آورد');
  let stores = [];
  if (role === 'manager') {
    stores = [...new Set((Array.isArray(c.body.stores) ? c.body.stores : []).map(Number).filter((id) => storeById(id)))];
    if (!stores.length) bad('برای مدیر فروشگاه حداقل یک فروشگاه انتخاب کنید');
  }
  u.role = role; u.stores = stores; db.save();
  return { user: { id: u.id, role: u.role, stores: u.stores } };
});
R('POST', '/api/admin/users/:id/password', (c) => {
  needAdmin(c); const u = D.users.find((x) => x.id === +c.params.id); if (!u) bad('کاربر پیدا نشد', 404);
  const pw = String(c.body.pw || ''); if (pw.length < 6) bad('رمز حداقل ۶ کاراکتر باشد');
  u.pw = U.hashPw(pw); D.sessions = D.sessions.filter((s) => s.uid !== u.id); db.save(); return { ok: true };
});

/* فروشگاه‌ها: فهرست برای کارمند (در محدوده‌ی خودش)، ساخت/ویرایش/حذف فقط مدیر کل */
R('GET', '/api/admin/stores', (c) => { const u = needStaff(c); return { stores: D.stores.filter((s) => inScope(u, s.id)) }; });
function cleanStore(b, base = {}) {
  const s = { ...base };
  if ('name' in b || !base.id) { const v = U.str(b.name, 60); if (v.length < 2) bad('نام فروشگاه را وارد کنید'); s.name = v; }
  if ('slug' in b || !base.id) {
    const v = U.str(b.slug, 30).toLowerCase().replace(/[^a-z0-9-]/g, '') || 'store' + Date.now().toString(36);
    if (D.stores.some((x) => x.id !== base.id && x.slug === v)) bad('این شناسه‌ی لاتین قبلاً استفاده شده', 409); s.slug = v;
  }
  if ('city' in b) s.city = U.str(b.city, 40); else if (!base.id) s.city = '';
  if ('address' in b) s.address = U.str(b.address, 200); else if (!base.id) s.address = '';
  if ('phone' in b) s.phone = U.normMobile(U.str(b.phone, 20)); else if (!base.id) s.phone = '';
  if ('shipFree' in b || !base.id) { const v = Math.round(+b.shipFree); if (!(v >= 0 && v <= 1e10)) bad('حداقل ارسال رایگان نامعتبر است'); s.shipFree = v; }
  if ('shipFee' in b || !base.id) { const v = Math.round(+b.shipFee); if (!(v >= 0 && v <= 1e9)) bad('هزینه‌ی ارسال نامعتبر است'); s.shipFee = v; }
  if ('active' in b) s.active = !!b.active; else if (!base.id) s.active = true;
  return s;
}
R('POST', '/api/admin/stores', (c) => {
  needAdmin(c); const b = { shipFree: CONFIG.shipFree, shipFee: CONFIG.shipFee, ...c.body };
  const s = cleanStore(b); s.id = db.next('store'); s.ts = Date.now(); D.stores.push(s); db.save(); return { status: 201, body: { store: s } };
});
R('PUT', '/api/admin/stores/:id', (c) => {
  needAdmin(c); const i = D.stores.findIndex((x) => x.id === +c.params.id); if (i < 0) bad('فروشگاه پیدا نشد', 404);
  const next = cleanStore(c.body, D.stores[i]);
  if (!next.active && D.stores.filter((x) => x.active && x.id !== next.id).length === 0) bad('حداقل یک فروشگاه باید فعال بماند');
  D.stores[i] = next; db.save(); return { store: next };
});
R('DELETE', '/api/admin/stores/:id', (c) => {
  needAdmin(c); const i = D.stores.findIndex((x) => x.id === +c.params.id); if (i < 0) bad('فروشگاه پیدا نشد', 404);
  const id = D.stores[i].id;
  if (D.orders.some((o) => o.storeId === id)) bad('این فروشگاه سفارش دارد؛ به‌جای حذف، غیرفعالش کنید', 409);
  if (D.stores.length === 1) bad('آخرین فروشگاه را نمی‌شود حذف کرد');
  D.products = D.products.filter((p) => p.storeId !== id); D.stores.splice(i, 1);
  for (const u of D.users) if (u.stores) u.stores = u.stores.filter((x) => x !== id);
  db.save(); return { ok: true };
});

/* تنظیمات سایت */
R('GET', '/api/admin/settings', (c) => { needStaff(c); return { settings: D.settings }; });
R('PUT', '/api/admin/settings', (c) => {
  needAdmin(c); const b = c.body, s = { ...D.settings };
  const txt = (k, n) => { if (k in b) s[k] = U.str(b[k], n); };
  txt('siteName', 40); txt('tagline', 120); txt('phone', 20); txt('address', 200); txt('banner', 200);
  if ('email' in b) { const e = U.str(b.email, 120).toLowerCase(); if (e && !U.isEmail(e)) bad('ایمیل معتبر نیست'); s.email = e; }
  if ('bannerOn' in b) s.bannerOn = !!b.bannerOn;
  if ('maintenance' in b) s.maintenance = !!b.maintenance;
  if ('mainStore' in b) { const id = +b.mainStore || 0; if (id && !activeStores().some((x) => x.id === id)) bad('این فروشگاه فعال نیست'); s.mainStore = id; }
  if ('colors' in b) {
    const out = {}, src = b.colors && typeof b.colors === 'object' ? b.colors : {};
    for (const k of COLOR_KEYS) if (src[k]) { const v = String(src[k]).trim(); if (!/^#[0-9a-fA-F]{6}$/.test(v)) bad('رنگ نامعتبر است'); out[k] = v.toLowerCase(); }
    s.colors = out;
  }
  if (!s.siteName) bad('نام سایت لازم است');
  D.settings = s; db.save(); return { settings: s };
});

/* ---------- فایل‌های استاتیک ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8' };
const gzCache = new Map();
function serveStatic(req, res, pathname) {
  let base = PUBLIC, rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html'; else if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
  if (rel.startsWith('/uploads/')) { base = UPLOADS; rel = rel.slice(8); }
  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base + path.sep) && file !== base) return false;
  let st; try { st = fs.statSync(file); } catch (e) { return false; }
  if (!st.isFile()) return false;
  const ext = path.extname(file).toLowerCase(), type = TYPES[ext] || 'application/octet-stream';
  const h = { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': base === UPLOADS ? 'public, max-age=604800, immutable' : (['.html', '.js', '.css', '.webmanifest'].includes(ext) ? 'no-cache' : 'public, max-age=86400') };
  if (ext === '.html' || ext === '.js' || ext === '.css' || ext === '.json' || ext === '.svg') h['X-Frame-Options'] = 'SAMEORIGIN';
  if (rel === '/sw.js') h['Service-Worker-Allowed'] = '/';
  const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '') && /text|json|javascript|svg|manifest/.test(type);
  if (gz) {
    const key = file + ':' + st.mtimeMs; let buf = gzCache.get(key);
    if (!buf) { buf = zlib.gzipSync(fs.readFileSync(file)); gzCache.clear(); gzCache.set(key, buf); }
    res.writeHead(200, { ...h, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding', 'Content-Length': buf.length }); res.end(req.method === 'HEAD' ? undefined : buf);
  } else { res.writeHead(200, { ...h, 'Content-Length': st.size }); if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res); }
  return true;
}

/* ---------- سرور ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x'), pathname = url.pathname;
    res.setHeader('Referrer-Policy', 'same-origin');
    if (pathname.startsWith('/api/')) {
      const route = routes.map((r) => ({ r, m: r.re.exec(pathname) })).find((x) => x.m && x.r.method === req.method);
      if (!route) {
        if (routes.some((r) => r.re.test(pathname))) return send(res, 405, { error: 'متد مجاز نیست' });
        return send(res, 404, { error: 'مسیر پیدا نشد' });
      }
      let body = {};
      const hasBody = (req.headers['content-length'] && req.headers['content-length'] !== '0') || req.headers['transfer-encoding'];
      if (req.method !== 'GET' && req.method !== 'DELETE' && hasBody) {
        if (!/application\/json/i.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'Content-Type باید application/json باشد' });
        body = await readBody(req, route.r.limit);
      }
      const ctx = { req, res, url, params: route.m.groups || {}, body, user: sessionUser(req), ip: ip(req) };
      const out = await route.r.fn(ctx);
      if (out && out.body !== undefined) return send(res, out.status || 200, out.body, out.headers || {});
      return send(res, 200, out || { ok: true });
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && serveStatic(req, res, pathname)) return;
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('پیدا نشد');
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e); send(res, 500, { error: 'خطای سرور' });
  }
});

(function seedAdmin() {
  const mobile = U.normMobile(process.env.ADMIN_MOBILE || '');
  if (mobile) {
    const byMobile = D.users.find((x) => U.normMobile(x.mobile || '') === mobile);
    if (byMobile && byMobile.role !== 'admin') {
      byMobile.role = 'admin';
      db.save();
      console.log('   ✔ حساب موجود با شماره ADMIN_MOBILE مدیر شد');
    }
  }

  const email = U.str(process.env.ADMIN_EMAIL || '', 120).toLowerCase(), username = U.str(process.env.ADMIN_USERNAME || '', 40).toLowerCase(), pw = String(process.env.ADMIN_PASSWORD || '');
  if (!(email || username) || pw.length < 6) return;
  let u = D.users.find((x) => (email && x.email === email) || (username && x.username === username));
  if (u) { if (u.role !== 'admin') { u.role = 'admin'; db.save(); } return; }
  D.users.push({ id: db.next('user'), name: process.env.ADMIN_NAME || 'مدیر', mobile: '', email, username, pw: U.hashPw(pw), role: 'admin', addrs: [], pets: [], wish: [], ts: Date.now() });
  db.save(); console.log('   ✔ حساب مدیر ساخته شد: ' + (username || email));
})();
server.listen(PORT, () => {
  console.log('🐾 پت‌تراپی روی http://localhost:' + PORT + ' بالا آمد');
  console.log('   پنل مدیریت: http://localhost:' + PORT + '/admin');
  if (!D.users.some((u) => u.role === 'admin')) console.log('   ⚠ هنوز مدیری وجود ندارد: ADMIN_MOBILE را در .env بگذارید یا  npm run make-admin 09123456789');
});
const stop = () => { try { db.flush(); } catch (e) { /* ignore */ } process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
module.exports = { server, db };
