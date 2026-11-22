'use strict';
/* پنل مدیریت پت‌تراپی — admin (مدیر کل) و manager (مدیر فروشگاه) */
const $ = (s) => document.querySelector(s);
const fa = (n) => Number(n || 0).toLocaleString('fa-IR');
const money = (n) => fa(n) + ' تومان';
const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

async function api(m, u, b) {
  try {
    const r = await fetch(u, { method: m, headers: b ? { 'Content-Type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined, credentials: 'same-origin' });
    let d = {}; try { d = await r.json(); } catch (e) { /* no body */ }
    return { ok: r.ok, status: r.status, data: d };
  } catch (e) { return { ok: false, status: 0, data: { error: 'اتصال به سرور برقرار نشد' } }; }
}
let tmr;
function toast(t, err) { const e = $('#toast'); e.textContent = t; e.className = 'show' + (err ? ' err' : ''); clearTimeout(tmr); tmr = setTimeout(() => { e.className = ''; }, 2600); }

const ST = { reg: 'ثبت شده', prep: 'در حال آماده‌سازی', ship: 'ارسال شده', done: 'تحویل شده', can: 'لغو شده' };
const AN = { dog: '🐕 سگ', cat: '🐈 گربه', bird: '🦜 پرنده', rabbit: '🐰 جونده' };
const CT = { 1: 'غذا', 2: 'مکمل', 3: 'اسباب‌بازی', 4: 'لباس و اکسسوری' };
const ROLE = { user: 'کاربر', manager: 'مدیر فروشگاه', admin: 'مدیر کل' };

const S = { me: null, stores: [], filter: 0, stFilter: '', stats: null, products: [], orders: [], users: [], allStores: [], settings: null };
let tab = (location.hash || '#stats').slice(1);
const isAdmin = () => S.me && S.me.role === 'admin';
const q = () => (S.filter ? '?store=' + S.filter : '');
const storeName = (id) => { const s = (S.stores || []).find((x) => x.id === id); return s ? s.name : ''; };

function tabs() {
  const t = [['stats', '📊 داشبورد'], ['products', '📦 محصولات'], ['orders', '🧾 سفارش‌ها']];
  if (isAdmin()) t.push(['users', '👥 کاربران و نقش‌ها'], ['stores', '🏬 فروشگاه‌ها'], ['settings', '🛠 تنظیمات سایت']);
  return t;
}


function loginView() {
  $('#app').innerHTML = `<div class="card login"><div class="gate-paw">🐾</div><h2>ورود مدیر</h2><p class="muted">با ایمیل یا شناسه‌ی مدیر وارد شوید</p>
    <label>ایمیل یا شناسه</label><input id="l-id" autocomplete="username" dir="ltr" placeholder="admin">
    <label>رمز عبور</label><input id="l-pw" type="password" autocomplete="current-password" dir="ltr">
    <p class="msg" id="l-msg"></p><button class="btn" data-act="alogin" style="width:100%">ورود</button></div>`;
  $('#l-pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') alogin(); });
}
async function alogin() {
  const id = $('#l-id').value.trim(), password = $('#l-pw').value;
  if (!id || !password) { $('#l-msg').textContent = 'ایمیل/شناسه و رمز را وارد کنید'; return; }
  const r = await api('POST', '/api/admin/login', { id, password });
  if (!r.ok) { $('#l-msg').textContent = r.data.error || 'ورود ناموفق بود'; return; }
  boot();
}
async function logout() { await api('POST', '/api/logout'); S.me = null; boot(); }

async function boot() {
  const r = await api('GET', '/api/me');
  const u = r.data && r.data.user;
  if (!u) return loginView();
  const m = await api('GET', '/api/admin/me');
  if (!m.ok) { $('#app').innerHTML = '<div class="card"><h3>دسترسی ندارید</h3><p>این حساب مدیر نیست.</p><button class="btn ghost" data-act="logout">خروج و ورود با حساب دیگر</button></div>'; return; }
  S.me = m.data.user; S.stores = m.data.stores || []; S.settings = m.data.settings;
  $('#ttl').textContent = '👋 ' + (S.me.name || 'مدیر') + '، خوش اومدی';
  $('#out').hidden = false;
  const sel = $('#storeSel');
  if (S.stores.length > 1) {
    sel.hidden = false;
    sel.innerHTML = '<option value="0">همه‌ی فروشگاه‌ها</option>' + S.stores.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    sel.onchange = () => { S.filter = +sel.value; show(); };
  }
  if (!tabs().some((x) => x[0] === tab)) tab = 'stats';
  show();
}

async function show() {
  $('#app').innerHTML = '<div class="tabs">' + tabs().map(([k, t]) => `<button class="${k === tab ? 'on' : ''}" data-t="${k}">${t}</button>`).join('') + '</div><div id="body"><p class="muted">در حال بارگذاری…</p></div>';
  const body = $('#body'), cur = tab;
  const html = await ({ stats: vStats, products: vProducts, orders: vOrders, users: vUsers, stores: vStores, settings: vSettings })[tab]();
  if (cur === tab) { body.innerHTML = html; if (tab === 'products') pcards(); if (tab === 'settings') drawPrev(); }
}
function reload() { return show(); }

/* ---------- داشبورد ---------- */
async function vStats() {
  const r = await api('GET', '/api/admin/stats' + q()); if (!r.ok) return err(r);
  const s = r.data;
  const cards = [[fa(s.orders), 'کل سفارش‌ها'], [fa(s.pending), 'در انتظار بررسی'], [money(s.revenue), 'جمع فروش (بدون لغوشده‌ها)'], [money(s.revenue7), 'فروش ۷ روز اخیر'], [fa(s.products), 'محصول']];
  if (s.users != null) cards.push([fa(s.users), 'کاربر']);
  const max = Math.max(1, ...(s.byStore || []).map((x) => x.revenue));
  return '<div class="stats">' + cards.map(([b, t]) => `<div class="card"><b>${b}</b><small>${t}</small></div>`).join('') + '</div>'
    + ((s.byStore || []).length > 1 ? '<div class="card" style="margin-top:12px"><h3>🏬 فروش هر فروشگاه</h3>' + s.byStore.map((x) => `<div style="margin:10px 0"><div class="row"><span class="n">${esc(x.name)}</span><small>${fa(x.orders)} سفارش · ${money(x.revenue)}</small></div><div class="bar"><i style="width:${Math.round(x.revenue / max * 100)}%"></i></div></div>`).join('') + '</div>' : '')
    + '<div class="card" style="margin-top:12px"><h3>⚠️ موجودی کم</h3>' + (s.low.length ? s.low.map((p) => `<div class="row"><span class="n">${esc(p.name)}${S.stores.length > 1 ? ' <small>' + esc(p.storeName || '') + '</small>' : ''}</span><span class="tag warn">${fa(p.stock)} عدد</span></div>`).join('') : '<p>موردی نیست 👌</p>') + '</div>';
}
const err = (r) => `<div class="card"><p class="msg">${esc((r.data && r.data.error) || 'خطا در دریافت اطلاعات')}</p></div>`;

/* ---------- محصولات ---------- */
async function vProducts() {
  const r = await api('GET', '/api/admin/products' + q()); if (!r.ok) return err(r);
  S.products = r.data.products || [];
  return `<div class="row" style="margin-bottom:10px"><button class="btn" data-act="pedit" data-id="new">＋ محصول جدید</button><input id="psearch" placeholder="🔍 جستجوی محصول…" style="flex:1"></div><small class="muted" id="pcount"></small><div id="plist"></div>`;
}
function pcards() {
  const k = ($('#psearch') ? $('#psearch').value : '').trim(), multi = S.stores.length > 1;
  const list = S.products.filter((p) => !k || (p.name + ' ' + p.brand).includes(k));
  $('#pcount').textContent = fa(list.length) + ' محصول';
  $('#plist').innerHTML = list.map((p) => `<div class="card pc ${p.active ? '' : 'off'}" data-pid="${p.id}">
    <div class="row">${p.img ? `<img class="th" src="${esc(p.img)}" referrerpolicy="no-referrer" alt="" data-emoji="${esc(p.emoji)}">` : `<span class="th">${esc(p.emoji)}</span>`}
      <div class="n"><b>${esc(p.name)}</b><small>${esc(p.brand)} · ${AN[p.animal] || ''} · ${CT[p.cat] || ''}${multi ? ' · 🏬 ' + esc(p.storeName) : ''}${p.active ? '' : ' · مخفی'}</small></div></div>
    <div class="qrow"><label>قیمت (تومان)</label><input type="number" min="0" inputmode="numeric" value="${p.price}" data-price="${p.id}" dir="ltr"></div>
    <div class="qrow"><label>موجودی</label><div class="stk"><button class="btn ghost" data-act="stk" data-id="${p.id}:-1">−</button><b>${p.stock == null ? '∞' : fa(p.stock)}</b><button class="btn ghost" data-act="stk" data-id="${p.id}:1">＋</button></div></div>
    <div class="row"><button class="btn ghost" data-act="pedit" data-id="${p.id}" style="flex:1">ویرایش کامل</button><button class="btn red" data-act="pquickdel" data-id="${p.id}">🗑 حذف</button></div></div>`).join('') || '<div class="card">محصولی نیست.</div>';
}
async function pquick(id, patch) {
  const r = await api('PUT', '/api/admin/products/' + id, patch);
  if (!r.ok) { toast(r.data.error || 'خطا', true); return reload(); }
  const i = S.products.findIndex((x) => x.id == id); if (i >= 0) S.products[i] = r.data.product;
  toast('ذخیره شد ✅'); pcards();
}
function stk(v) { const [id, d] = v.split(':'), p = S.products.find((x) => x.id == id); if (!p) return; pquick(id, { stock: Math.max(0, (p.stock == null ? 0 : p.stock) + +d) }); }
async function pquickdel(id) {
  const p = S.products.find((x) => x.id == id); if (!p || !confirm('«' + p.name + '» برای همیشه حذف شود؟')) return;
  const r = await api('DELETE', '/api/admin/products/' + id);
  toast(r.ok ? 'حذف شد' : (r.data.error || 'خطا'), !r.ok); reload();
}
function pedit(id) {
  const isNew = id === 'new';
  const p = isNew ? { id: '', name: '', brand: '', animal: 'dog', cat: 1, price: 0, disc: 0, stock: 10, note: '', emoji: '🐾', img: '', active: true, storeId: S.filter || (S.stores[0] || {}).id } : S.products.find((x) => x.id == id);
  if (!p) return;
  const opt = (o, v) => Object.entries(o).map(([k, t]) => `<option value="${k}" ${k == v ? 'selected' : ''}>${t}</option>`).join('');
  dlg(`<h3>${isNew ? 'محصول جدید' : 'ویرایش محصول'}</h3><input type="hidden" id="f-id" value="${p.id}">
 ${isNew && S.stores.length > 1 ? `<label>فروشگاه</label><select id="f-store">${S.stores.map((s) => `<option value="${s.id}" ${s.id === p.storeId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>` : ''}
 <label>نام</label><input id="f-name" value="${esc(p.name)}">
 <div class="g2"><div><label>برند</label><input id="f-brand" value="${esc(p.brand)}" dir="ltr"></div><div><label>توضیح کوتاه (وزن/سایز)</label><input id="f-note" value="${esc(p.note)}"></div></div>
 <div class="g2"><div><label>حیوان</label><select id="f-animal">${opt(AN, p.animal)}</select></div><div><label>دسته</label><select id="f-cat">${opt(CT, p.cat)}</select></div></div>
 <div class="g2"><div><label>قیمت (تومان)</label><input id="f-price" type="number" min="0" value="${p.price}"></div><div><label>تخفیف ٪</label><input id="f-disc" type="number" min="0" max="90" value="${p.disc || 0}"></div></div>
 <div class="g2"><div><label>موجودی (خالی = نامحدود)</label><input id="f-stock" type="number" min="0" value="${p.stock == null ? '' : p.stock}"></div><div><label>ایموجی (اگر عکس نبود)</label><input id="f-emoji" value="${esc(p.emoji)}"></div></div>
 <label>عکس (لینک یا آپلود)</label><input id="f-img" dir="ltr" value="${esc(p.img)}" placeholder="https://… یا /uploads/…"><input id="f-file" type="file" accept="image/*" style="margin-top:6px">
 <label class="ck"><input type="checkbox" id="f-active" ${p.active ? 'checked' : ''}> نمایش در فروشگاه</label>
 <p class="msg" id="fm"></p><div class="row"><button class="btn" data-act="psave">ذخیره</button><button class="btn ghost" data-act="close">بستن</button>${isNew ? '' : '<button class="btn red" data-act="pdel" style="margin-inline-start:auto">حذف</button>'}</div>`);
}
async function psave() {
  const id = $('#f-id').value, st = $('#f-stock').value.trim();
  const b = { name: $('#f-name').value, brand: $('#f-brand').value, note: $('#f-note').value, animal: $('#f-animal').value, cat: +$('#f-cat').value, price: +$('#f-price').value, disc: +$('#f-disc').value || 0, stock: st === '' ? null : +st, emoji: $('#f-emoji').value, img: $('#f-img').value.trim(), active: $('#f-active').checked };
  if (!id) b.storeId = $('#f-store') ? +$('#f-store').value : (S.filter || (S.stores[0] || {}).id);
  const r = id ? await api('PUT', '/api/admin/products/' + id, b) : await api('POST', '/api/admin/products', b);
  if (!r.ok) return ($('#fm').textContent = r.data.error || 'خطا');
  $('#dlg').close(); toast('ذخیره شد ✅'); reload();
}
async function pdel() {
  if (!confirm('این محصول برای همیشه حذف شود؟')) return;
  const r = await api('DELETE', '/api/admin/products/' + $('#f-id').value);
  if (!r.ok) return ($('#fm').textContent = r.data.error || 'خطا');
  $('#dlg').close(); toast('حذف شد'); reload();
}
function upload(f) {
  if (!f) return;
  const im = new Image();
  im.onload = async () => {
    const s = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    $('#fm').textContent = 'در حال آپلود…';
    const r = await api('POST', '/api/admin/upload', { dataUrl: c.toDataURL('image/jpeg', 0.85) });
    if (r.ok) { $('#f-img').value = r.data.url; $('#fm').textContent = '✅ آپلود شد؛ ذخیره را بزنید'; } else $('#fm').textContent = r.data.error || 'خطا';
  };
  im.onerror = () => { $('#fm').textContent = 'این فایل عکس معتبر نیست'; };
  im.src = URL.createObjectURL(f);
}

/* ---------- سفارش‌ها ---------- */
async function vOrders() {
  const r = await api('GET', '/api/admin/orders' + q()); if (!r.ok) return err(r);
  S.orders = r.data.orders || [];
  const list = S.stFilter ? S.orders.filter((o) => o.st === S.stFilter) : S.orders, multi = S.stores.length > 1;
  const chips = '<div class="chips">' + [['', 'همه']].concat(Object.entries(ST)).map(([k, t]) => `<button class="${S.stFilter === k ? 'on' : ''}" data-act="stf" data-id="${k}">${t}${k ? ' (' + fa(S.orders.filter((o) => o.st === k).length) + ')' : ''}</button>`).join('') + '</div>';
  return chips + (list.map((o) => `<div class="card"><div class="row"><b class="n">سفارش #${o.id}${multi ? ' · 🏬 ' + esc(o.storeName) : ''}</b><span class="tag">${new Date(o.ts).toLocaleString('fa-IR')}</span></div><small class="muted">${esc(o.user.name || '')} · ${esc(o.user.mobile || '')} · کد پیگیری ${esc(o.tr)}</small><div class="items">${o.items.map((i) => esc(i.n) + ' × ' + fa(i.q)).join('، ')}</div><div>📍 ${esc(o.to.n)} (${esc(o.to.m)}) — ${esc(o.to.c)}، ${esc(o.to.a)}</div>${o.note ? `<div>📝 ${esc(o.note)}</div>` : ''}<div class="row wrapx" style="margin-top:8px"><b class="n">${money(o.grand)} · ${o.pm === 'online' ? 'آنلاین' : 'پرداخت در محل'}${o.code ? ' · کد ' + esc(o.code) : ''}</b><select data-st="${o.id}" data-cur="${o.st}" style="width:auto" ${o.st === 'can' ? 'disabled' : ''}>${Object.entries(ST).map(([k, v]) => `<option value="${k}" ${k === o.st ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>`).join('') || '<div class="card">سفارشی نیست.</div>');
}

/* ---------- کاربران و نقش‌ها (فقط مدیر کل) ---------- */
async function loadAllStores() { const r = await api('GET', '/api/admin/stores'); S.allStores = r.ok ? r.data.stores : []; return r; }
async function vUsers() {
  const [r] = await Promise.all([api('GET', '/api/admin/users'), loadAllStores()]); if (!r.ok) return err(r);
  S.users = r.data.users || [];
  return S.users.map((u) => `<div class="card row"><div class="n"><b>${esc(u.name)} ${u.role !== 'user' ? `<span class="tag ${u.role === 'admin' ? 'ok' : ''}">${ROLE[u.role]}</span>` : ''}</b><small>${esc(u.mobile)} ${u.email ? '· ' + esc(u.email) : ''} · ${fa(u.orders)} سفارش</small>${u.role === 'manager' ? `<small>🏬 ${(u.stores || []).map((id) => esc((S.allStores.find((s) => s.id === id) || {}).name || '؟')).join('، ')}</small>` : ''}</div><button class="btn ghost" data-act="urole" data-id="${u.id}">نقش</button><button class="btn ghost" data-act="upw" data-id="${u.id}">رمز جدید</button></div>`).join('');
}
function urole(id) {
  const u = S.users.find((x) => x.id == id); if (!u) return;
  dlg(`<h3>نقش «${esc(u.name)}»</h3><input type="hidden" id="u-id" value="${u.id}">
 <label>نقش</label><select id="u-role">${Object.entries(ROLE).map(([k, t]) => `<option value="${k}" ${k === (u.role || 'user') ? 'selected' : ''}>${t}</option>`).join('')}</select>
 <div id="u-stores" ${u.role === 'manager' ? '' : 'hidden'}><label>فروشگاه‌های زیر نظر او</label>${S.allStores.map((s) => `<label class="ck"><input type="checkbox" value="${s.id}" ${(u.stores || []).includes(s.id) ? 'checked' : ''}>${esc(s.name)}</label>`).join('')}</div>
 <p class="msg" id="fm"></p><div class="row"><button class="btn" data-act="usave">ذخیره</button><button class="btn ghost" data-act="close">بستن</button></div>`);
  $('#u-role').onchange = (e) => { $('#u-stores').hidden = e.target.value !== 'manager'; };
}
async function usave() {
  const stores = [...document.querySelectorAll('#u-stores input:checked')].map((x) => +x.value);
  const r = await api('PUT', '/api/admin/users/' + $('#u-id').value, { role: $('#u-role').value, stores });
  if (!r.ok) return ($('#fm').textContent = r.data.error || 'خطا');
  $('#dlg').close(); toast('نقش ذخیره شد ✅'); reload();
}
async function upw(id) {
  const pw = prompt('رمز جدید برای این کاربر (حداقل ۶ کاراکتر):'); if (!pw) return;
  const r = await api('POST', '/api/admin/users/' + id + '/password', { pw });
  toast(r.ok ? 'رمز تغییر کرد' : (r.data.error || 'خطا'), !r.ok);
}

/* ---------- فروشگاه‌ها (فقط مدیر کل) ---------- */
async function vStores() {
  const r = await loadAllStores(); if (!r.ok) return err(r);
  return '<div class="row" style="margin-bottom:10px"><button class="btn" data-act="sedit" data-id="new">＋ فروشگاه جدید</button></div>'
    + S.allStores.map((s) => `<div class="card row ${s.active ? '' : 'off'}"><div class="n"><b>${esc(s.name)}</b> <span class="tag">${esc(s.slug)}</span>${s.active ? '' : ' <span class="tag warn">غیرفعال</span>'}<small>${esc(s.city)} ${esc(s.address)} ${s.phone ? '· ' + esc(s.phone) : ''}</small><small>ارسال رایگان از ${money(s.shipFree)} · هزینه‌ی ارسال ${money(s.shipFee)}</small></div><button class="btn ghost" data-act="sedit" data-id="${s.id}">ویرایش</button></div>`).join('');
}
function sedit(id) {
  const isNew = id === 'new';
  const s = isNew ? { id: '', name: '', slug: '', city: '', address: '', phone: '', shipFree: 10000000, shipFee: 200000, active: true } : S.allStores.find((x) => x.id == id);
  if (!s) return;
  dlg(`<h3>${isNew ? 'فروشگاه جدید' : 'ویرایش فروشگاه'}</h3><input type="hidden" id="s-id" value="${s.id}">
 <div class="g2"><div><label>نام</label><input id="s-name" value="${esc(s.name)}"></div><div><label>شناسه‌ی لاتین</label><input id="s-slug" dir="ltr" value="${esc(s.slug)}" placeholder="مثلاً tehran"></div></div>
 <div class="g2"><div><label>شهر</label><input id="s-city" value="${esc(s.city)}"></div><div><label>تلفن</label><input id="s-phone" dir="ltr" value="${esc(s.phone)}"></div></div>
 <label>آدرس</label><input id="s-address" value="${esc(s.address)}">
 <div class="g2"><div><label>ارسال رایگان از (تومان)</label><input id="s-free" type="number" min="0" value="${s.shipFree}"></div><div><label>هزینه‌ی ارسال (تومان)</label><input id="s-fee" type="number" min="0" value="${s.shipFee}"></div></div>
 <label class="ck"><input type="checkbox" id="s-active" ${s.active ? 'checked' : ''}> فعال (در سایت نمایش داده شود)</label>
 <p class="msg" id="fm"></p><div class="row"><button class="btn" data-act="ssave">ذخیره</button><button class="btn ghost" data-act="close">بستن</button>${isNew ? '' : '<button class="btn red" data-act="sdel" style="margin-inline-start:auto">حذف</button>'}</div>`);
}
async function ssave() {
  const id = $('#s-id').value;
  const b = { name: $('#s-name').value, slug: $('#s-slug').value, city: $('#s-city').value, phone: $('#s-phone').value, address: $('#s-address').value, shipFree: +$('#s-free').value, shipFee: +$('#s-fee').value, active: $('#s-active').checked };
  const r = id ? await api('PUT', '/api/admin/stores/' + id, b) : await api('POST', '/api/admin/stores', b);
  if (!r.ok) return ($('#fm').textContent = r.data.error || 'خطا');
  await refreshStores(); $('#dlg').close(); toast('ذخیره شد ✅'); reload();
}
async function sdel() {
  if (!confirm('این فروشگاه و همه‌ی محصولاتش حذف شود؟')) return;
  const r = await api('DELETE', '/api/admin/stores/' + $('#s-id').value);
  if (!r.ok) return ($('#fm').textContent = r.data.error || 'خطا');
  await refreshStores(); $('#dlg').close(); toast('حذف شد'); reload();
}
async function refreshStores() { // فهرست فروشگاه‌ها در انتخابگر بالا را تازه کن
  const m = await api('GET', '/api/admin/me'); if (!m.ok) return;
  S.stores = m.data.stores || []; if (S.filter && !S.stores.some((s) => s.id === S.filter)) S.filter = 0;
  const sel = $('#storeSel'); sel.hidden = S.stores.length < 2;
  sel.innerHTML = '<option value="0">همه‌ی فروشگاه‌ها</option>' + S.stores.map((s) => `<option value="${s.id}" ${s.id === S.filter ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
}

/* ---------- تنظیمات سایت (فقط مدیر کل) ---------- */
const COL = [['dark', 'رنگ اصلی', 'دکمه‌ها، هدر و عنوان‌ها', '#35483b'], ['green', 'سبز ملایم', 'دسته‌ها و نشان‌ها', '#a8c99a'], ['cream', 'کرم', 'پس‌زمینه‌ی بخش‌ها', '#f4d8a8'], ['orange', 'رنگ تأکید', 'قیمت و دکمه‌های مهم', '#f29b72'], ['bg', 'پس‌زمینه‌ی سایت', 'پشت همه‌ی صفحه‌ها', '#fbf5e9'], ['card', 'کارت‌ها', 'کادر محصول و فرم‌ها', '#ffffff'], ['text', 'رنگ نوشته‌ها', 'متن اصلی سایت', '#35483b']];
const PRESETS = { 'سبز (اصلی)': { dark: '#35483b', green: '#a8c99a', cream: '#f4d8a8', orange: '#f29b72', bg: '#fbf5e9', card: '#ffffff', text: '#35483b' }, 'صورتی': { dark: '#7a2e4d', green: '#e8a5c0', cream: '#fbd9e4', orange: '#f2788f', bg: '#fff5f8', card: '#ffffff', text: '#4a1f31' }, 'آبی': { dark: '#1f4e79', green: '#9cc5e8', cream: '#d6e8f7', orange: '#f29b4a', bg: '#f3f8fd', card: '#ffffff', text: '#17324d' } };
async function vSettings() {
  const r = await api('GET', '/api/admin/settings'); if (!r.ok) return err(r);
  const s = S.settings = r.data.settings, sr = await api('GET', '/api/admin/stores'), all = (sr.data.stores || []).filter((x) => x.active), cl = s.colors || {};
  return `<div class="card"><h3>🏬 فروشگاه اصلی سایت</h3>
 <p class="muted">همه‌ی مشتری‌ها فقط همین فروشگاه را می‌بینند و نمی‌توانند فروشگاه را عوض کنند. فقط مدیر کل می‌تواند آن را تغییر بدهد.</p>
 <select id="t-main">${all.map((x) => `<option value="${x.id}" ${+s.mainStore === x.id || (!s.mainStore && x === all[0]) ? 'selected' : ''}>${esc(x.name)}${x.city ? ' — ' + esc(x.city) : ''}</option>`).join('')}</select></div>
 <div class="card"><h3>تنظیمات سایت</h3>
 <div class="g2"><div><label>نام سایت</label><input id="t-name" value="${esc(s.siteName)}"></div><div><label>شعار</label><input id="t-tag" value="${esc(s.tagline)}"></div></div>
 <div class="g2"><div><label>تلفن</label><input id="t-phone" dir="ltr" value="${esc(s.phone)}"></div><div><label>ایمیل</label><input id="t-mail" dir="ltr" value="${esc(s.email)}"></div></div>
 <label>آدرس</label><input id="t-addr" value="${esc(s.address)}">
 <label>متن بنر اعلان</label><input id="t-banner" value="${esc(s.banner)}" placeholder="مثلاً: ارسال رایگان تا پایان هفته">
 <label class="ck"><input type="checkbox" id="t-bon" ${s.bannerOn ? 'checked' : ''}> نمایش بنر در سایت</label>
 <label class="ck"><input type="checkbox" id="t-mnt" ${s.maintenance ? 'checked' : ''}> حالت تعمیر (ثبت سفارش موقتاً بسته می‌شود)</label></div>
 <div class="card"><h3>🎨 رنگ‌های سایت</h3><p class="muted">رنگ هر بخش سایت را انتخاب کن. در تم تاریک رنگ‌های خودش حفظ می‌شود.</p>
 <div class="chips">${Object.keys(PRESETS).map((k) => `<button type="button" data-act="preset" data-id="${esc(k)}">${esc(k)}</button>`).join('')}</div>
 ${COL.map(([k, t, h, d]) => `<div class="crow"><div class="n"><b>${t}</b><small class="muted">${h}</small></div><input type="color" id="c-${k}" data-def="${d}" value="${cl[k] || d}"></div>`).join('')}
 <div class="prev" id="cprev"><b>پیش‌نمایش</b><span class="pb">دکمه‌ی اصلی</span><span class="pc2">قیمت: ۱۲۰٬۰۰۰ تومان</span><span class="pg">دسته</span></div></div>
 <p class="msg" id="fm"></p><button class="btn" data-act="tsave" style="width:100%">ذخیره‌ی تنظیمات</button>`;
}
function readColors() { const o = {}; for (const [k, , , d] of COL) { const v = $('#c-' + k).value.toLowerCase(); if (v !== d) o[k] = v; } return o; }
function drawPrev() {
  const c = {}; COL.forEach(([k]) => { c[k] = $('#c-' + k).value; });
  const p = $('#cprev'); if (!p) return;
  p.style.cssText = `background:${c.bg};color:${c.text};border:1px solid ${c.green}`;
  p.querySelector('.pb').style.cssText = `background:${c.dark};color:#fff`; p.querySelector('.pc2').style.cssText = `background:${c.card};color:${c.orange};border:1px solid ${c.cream}`; p.querySelector('.pg').style.cssText = `background:${c.green};color:${c.text}`;
}
function preset(name) { const pr = PRESETS[name]; if (!pr) return; Object.entries(pr).forEach(([k, v]) => { $('#c-' + k).value = v; }); drawPrev(); }
async function tsave() {
  const r = await api('PUT', '/api/admin/settings', { siteName: $('#t-name').value, tagline: $('#t-tag').value, phone: $('#t-phone').value, email: $('#t-mail').value, address: $('#t-addr').value, banner: $('#t-banner').value, bannerOn: $('#t-bon').checked, maintenance: $('#t-mnt').checked, mainStore: +$('#t-main').value || 0, colors: readColors() });
  if (!r.ok) return ($('#fm').textContent = r.data.error || 'خطا');
  S.settings = r.data.settings; $('#ttl').textContent = '⚙️ مدیریت ' + S.settings.siteName; $('#fm').textContent = ''; toast('تنظیمات ذخیره شد ✅');
}

/* ---------- ابزارها و رویدادها ---------- */
function dlg(html) { $('#dlg').innerHTML = html; $('#dlg').showModal(); }
const ACT = { preset, alogin, logout, stk, pquickdel, pedit, psave, pdel, urole, usave, upw, sedit, ssave, sdel, tsave, close: () => $('#dlg').close(), stf: (v) => { S.stFilter = v; reload(); } };
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-t]');
  if (t) { tab = t.dataset.t; location.hash = tab; return show(); }
  const a = e.target.closest('[data-act]');
  if (a && ACT[a.dataset.act]) ACT[a.dataset.act](a.dataset.id);
});
document.addEventListener('change', async (e) => {
  const s = e.target.closest('[data-st]');
  if (s) {
    if (s.value === 'can' && !confirm('سفارش لغو شود؟ موجودی کالاها برمی‌گردد و این کار برگشت‌پذیر نیست.')) { s.value = s.dataset.cur; return; }
    const r = await api('PUT', '/api/admin/orders/' + s.dataset.st, { st: s.value });
    toast(r.ok ? 'وضعیت سفارش به‌روز شد' : (r.data.error || 'خطا'), !r.ok); reload(); return;
  }
  const pr = e.target.closest('[data-price]');
  if (pr) { const v = Math.round(+pr.value); if (!(v >= 0)) { toast('قیمت نامعتبر است', true); return reload(); } pquick(pr.dataset.price, { price: v }); return; }
  if (e.target.id === 'f-file') upload(e.target.files[0]);
});
document.addEventListener('input', (e) => { if (e.target.id === 'psearch') pcards(); if (e.target.id && e.target.id.startsWith('c-')) drawPrev(); });
document.addEventListener('error', (e) => { // عکس خراب → ایموجی
  const i = e.target; if (i.tagName === 'IMG' && i.dataset.emoji !== undefined) { const sp = document.createElement('span'); sp.className = 'th'; sp.textContent = i.dataset.emoji; i.replaceWith(sp); }
}, true);
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (S.me && h !== tab && tabs().some((x) => x[0] === h)) { tab = h; show(); } });
boot();
