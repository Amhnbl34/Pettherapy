/* ویژگی‌های جدید که باید قبل از اجرای نهایی route() آماده باشند: مسیر تنظیمات، تنظیمات سایت، صدا، ورود تمام‌صفحه */
R.settings = 'p-settings'; TT.settings = 'تنظیمات';
{ const _sm = setMode; setMode = function (m) { _sm(m); const t = $('#auth-title'); if (t) t.textContent = m == 'in' ? 'به پت‌تراپی خوش اومدی' : 'ساخت حساب جدید' }; }
{ const _snd = snd; snd = function (a) { if (PREFS.sound) _snd(a) }; }
$('#pwEye').onclick = () => { const i = $('#pw'); i.type = i.type == 'password' ? 'text' : 'password' };

/* ورود: وقتی صفحه‌ی ورود دیده می‌شود، هدر و منوی پایین پنهان می‌شوند */
function authClass() { const l = $('#p-login'); document.body.classList.toggle('authing', !!l && !l.hidden) }
addEventListener('hashchange', () => { op(false); authClass(); if (location.hash == '#settings') drawSettings() });

/* اعمال تنظیمات سایت و فروشگاه (نام، شعار، تلفن، ایمیل، آدرس، بنر) */
const toFa = (t) => String(t).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
function replaceText(root, from, to) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const list = []; let n;
  while ((n = w.nextNode())) if (n.nodeValue.includes(from)) list.push(n);
  list.forEach((x) => { x.nodeValue = x.nodeValue.split(from).join(to) });
}
/* رنگ‌های سایت (از پنل مدیر) — فقط تم روشن؛ تم تاریک رنگ‌های خودش را دارد */
function applyColors(cl) {
  let st = document.getElementById('pt-colors');
  const names = { dark: '--dark', green: '--green', cream: '--cream', orange: '--orange', bg: '--bg', card: '--card', text: '--text' };
  const keys = Object.keys(cl || {}).filter((k) => names[k] && /^#[0-9a-f]{6}$/i.test(cl[k]));
  if (!keys.length) { if (st) st.remove(); return; }
  const lum = (h) => { const n = parseInt(h.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4) }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2] };
  let css = keys.map((k) => names[k] + ':' + cl[k]).join(';');
  if (cl.dark) css += ';--onDark:' + (lum(cl.dark) > .45 ? '#14201a' : '#ffffff');
  if (!st) { st = document.createElement('style'); st.id = 'pt-colors'; document.head.appendChild(st) }
  st.textContent = ':root{' + css + '}';
  if (cl.dark) { const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = cl.dark }
}
function applySite() {
  if (!API.on) return;
  const s = API.settings || {}, st = API.store || {};
  applyColors(s.colors);
  const name = s.siteName || 'پت‌تراپی', custom = name != 'پت‌تراپی';
  window.SITE_TITLE = custom ? name + ' | Petherapy' : 'Petherapy | پت‌تراپی';
  if (custom) $('#siteName').textContent = name;
  document.querySelectorAll('[data-site-name]').forEach((e) => (e.textContent = name));
  if (s.tagline) { document.querySelectorAll('[data-tagline]').forEach((e) => (e.textContent = s.tagline)); const t = document.querySelector('p.tag'); if (t) t.textContent = s.tagline }
  const phone = st.phone || s.phone, email = s.email, addr = st.address || s.address;
  if (phone) document.querySelectorAll('a[href^="tel:"]').forEach((a) => { a.href = 'tel:' + phone; a.textContent = toFa(phone) });
  if (email) document.querySelectorAll('a[href^="mailto:"]').forEach((a) => { a.href = 'mailto:' + email; a.textContent = email });
  if (addr) replaceText(document.body, 'تهران، اسلامشهر، باغ‌فیض', addr);
  if (st.name) replaceText(document.querySelector('footer'), 'شعبه مرکزی', st.name), replaceText($('#p-contact'), 'شعبه مرکزی', st.name);
  const b = $('#siteBanner');
  if (s.maintenance) { b.textContent = '🛠 فروشگاه در حال بروزرسانی است؛ ثبت سفارش موقتاً بسته است.'; b.className = 'site-banner warn'; b.hidden = false }
  else if (s.bannerOn && s.banner) { b.textContent = s.banner; b.className = 'site-banner'; b.hidden = false }
  else b.hidden = true;
}
applySite();

/* سلام با اسم هر کاربری که وارد شده */
function helloText() { const u = me(), n = u && u.name ? String(u.name).trim().split(/\s+/)[0] : ''; return n ? 'سلام ' + n + '، اینجا خوش اومدی' : 'خوش اومدی'; }
function drawHello() {
  const b = $('#hello'); if (!b) return;
  const u = me(); if (!u) { b.hidden = true; return; }
  b.textContent = '👋 ' + helloText(); b.hidden = false;
}
{ const _ru = refreshUser; refreshUser = function () { const r = _ru.apply(this, arguments); drawHello(); return r; }; }
drawHello();
