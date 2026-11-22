/* رابط جدید: انتخاب فروشگاه، صفحه‌ی تنظیمات، نصب PWA */
let _bip = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); _bip = e; if (location.hash == '#settings') drawSettings() });
addEventListener('appinstalled', () => { _bip = null; toast('برنامه نصب شد 🎉'); if (location.hash == '#settings') drawSettings() });
const isStandalone = () => matchMedia('(display-mode:standalone)').matches || navigator.standalone === true;
const money0 = (n) => (typeof money == 'function' ? money(n) : n + ' تومان');

/* ---- انتخاب فروشگاه (تمام‌صفحه) ---- */
function openStoreGate(cancelable) {
  closeStoreGate();
  const g = document.createElement('div'); g.id = 'storegate'; g.className = 'gate'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); g.setAttribute('aria-label', 'انتخاب فروشگاه');
  const cur = API.store ? API.store.id : 0;
  g.innerHTML = `${cancelable ? '<button class="gate-x" type="button" aria-label="بستن">✕</button>' : ''}<div class="gate-in"><div class="gate-paw">🐾</div><h2>کدوم فروشگاه؟</h2><p>(فقط مدیر) فروشگاهی که می‌خوای ببینی رو انتخاب کن؛ محصولات، موجودی و هزینه‌ی ارسال هر فروشگاه جداست.</p><div class="gate-list">${API.stores.map((s) => `<button type="button" class="gate-st${s.id == cur ? ' on' : ''}" data-id="${s.id}"><b>🏬 ${esc(s.name)}</b><small>${esc([s.city, s.address].filter(Boolean).join('، '))}</small><span>🚚 ارسال رایگان بالای ${money0(s.shipFree)} · هزینه‌ی ارسال ${s.shipFee ? money0(s.shipFee) : 'رایگان'}</span></button>`).join('')}</div></div>`;
  g.onclick = (e) => {
    if (e.target.closest('.gate-x')) return closeStoreGate();
    const b = e.target.closest('.gate-st'); if (!b) return;
    if (+b.dataset.id == cur) return closeStoreGate();
    try { localStorage.setItem('pt_store', b.dataset.id) } catch (_) { /* ignore */ }
    location.reload();
  };
  document.body.appendChild(g); document.body.classList.add('gating');
  const f = g.querySelector('.gate-st'); if (f) f.focus();
}
function closeStoreGate() { const g = $('#storegate'); if (g) g.remove(); document.body.classList.remove('gating') }
document.addEventListener('keydown', (e) => { if (e.key == 'Escape' && API.store) closeStoreGate() });
{
  const btn = $('#storeBtn');
  if (API.on && API.store) { $('#storeName').textContent = API.store.name; btn.hidden = !(curUser() && curUser().role == 'admin') || API.stores.length < 2; btn.onclick = () => openStoreGate(true) }
  if (API.on && API.needStore) openStoreGate(false);
}

/* ---- صفحه‌ی تنظیمات ---- */
function seg(k, items) { return `<div class="seg" data-k="${k}">${items.map(([v, t]) => `<button type="button" data-v="${v}" class="${PREFS[k] == v ? 'on' : ''}">${t}</button>`).join('')}</div>` }
function drawSettings() {
  const u = curUser(), st = API.store, multi = API.on && API.stores.length > 1;
  const staff = u && (u.role == 'admin' || u.role == 'manager');
  $('#setbox').innerHTML = `
  <div class="set-g"><h3>🎨 ظاهر</h3><small>تم رنگی</small>${seg('theme', [['auto', 'خودکار'], ['light', 'روشن'], ['dark', 'تاریک']])}<small>اندازه‌ی نوشته‌ها</small>${seg('font', [['sm', 'کوچک'], ['md', 'معمولی'], ['lg', 'بزرگ']])}</div>
  <div class="set-g"><h3>✨ تجربه‌ی استفاده</h3>
    <label class="sw"><input type="checkbox" data-t="sound" ${PREFS.sound ? 'checked' : ''}><span>صدای حیوان‌ها هنگام انتخاب دسته</span></label>
    <label class="sw"><input type="checkbox" data-t="calm" ${PREFS.calm ? 'checked' : ''}><span>حالت آرام (بدون انیمیشن و افکت)</span></label></div>
  ${API.on ? `<div class="set-g"><h3>🏬 فروشگاه</h3><p class="set-p">${st ? `الان در <b>${esc(st.name)}</b> خرید می‌کنی${st.city ? ' (' + esc(st.city) + ')' : ''}.` : 'فروشگاهی انتخاب نشده.'}</p>${multi ? '<button type="button" class="btn2" data-act="store">تغییر فروشگاه</button>' : ''}</div>` : ''}
  <div class="set-g"><h3>📲 برنامه</h3>${isStandalone() ? '<p class="set-p">✅ پت‌تراپی به‌صورت برنامه نصب شده.</p>' : _bip ? '<button type="button" class="btn2" data-act="install">نصب پت‌تراپی روی دستگاه</button>' : '<p class="set-p">برای نصب، از منوی مرورگر گزینه‌ی «افزودن به صفحه‌ی اصلی» (Add to Home Screen) را بزن.</p>'}<p class="set-p" id="netst">${navigator.onLine ? '🟢 آنلاین' : '🔴 آفلاین — فقط صفحه‌های دیده‌شده در دسترس‌اند'}</p></div>
  <div class="set-g"><h3>👤 حساب</h3>${u ? `<p class="set-p">${esc(u.name)} · ${esc(u.mobile)}</p><a class="btn2 lk" href="#account">حساب من</a>${staff ? '<a class="btn2 lk" href="/admin">⚙️ پنل مدیریت</a>' : ''}` : '<a class="btn2 lk" href="#login">ورود / ثبت‌نام</a>'}</div>
  <button type="button" class="lnk" data-act="reset">بازگرداندن تنظیمات ظاهری به حالت پیش‌فرض</button>`;
}
$('#setbox').addEventListener('click', async (e) => {
  const sg = e.target.closest('.seg button');
  if (sg) { PREFS[sg.parentElement.dataset.k] = sg.dataset.v; savePrefs(); drawSettings(); return }
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act == 'store') openStoreGate(true);
  else if (a.dataset.act == 'install' && _bip) { _bip.prompt(); try { await _bip.userChoice } catch (_) { /* ignore */ } _bip = null; drawSettings() }
  else if (a.dataset.act == 'reset') { Object.assign(PREFS, { theme: 'auto', font: 'md', sound: true, calm: false }); savePrefs(); drawSettings(); toast('تنظیمات برگشت') }
});
$('#setbox').addEventListener('change', (e) => { const t = e.target.dataset.t; if (t) { PREFS[t] = e.target.checked; savePrefs() } });
addEventListener('online', () => { const n = $('#netst'); if (n) n.textContent = '🟢 آنلاین' }); addEventListener('offline', () => { const n = $('#netst'); if (n) n.textContent = '🔴 آفلاین' });

/* ---- PWA ---- */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
authClass(); if (location.hash == '#settings') drawSettings();
