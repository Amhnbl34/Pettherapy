/* تنظیمات ظاهری کاربر (تم، اندازه‌ی فونت، حالت آرام) — قبل از رندر اجرا می‌شود تا پرش رنگ نداشته باشیم */
(function () {
  var P = { theme: 'auto', font: 'md', sound: true, calm: false };
  try { var s = JSON.parse(localStorage.getItem('pt_prefs') || '{}'); for (var k in s) P[k] = s[k]; } catch (e) { /* ignore */ }
  window.PREFS = P;
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme:dark)') : null;
  window.applyPrefs = function () {
    var d = document.documentElement, t = P.theme;
    if (t === 'auto') t = mq && mq.matches ? 'dark' : 'light';
    d.setAttribute('data-theme', t); d.setAttribute('data-font', P.font); d.classList.toggle('calm', !!P.calm);
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', t === 'dark' ? '#1c231e' : '#35483B');
  };
  window.savePrefs = function () { try { localStorage.setItem('pt_prefs', JSON.stringify(P)); } catch (e) { /* ignore */ } window.applyPrefs(); };
  window.applyPrefs();
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (P.theme === 'auto') window.applyPrefs(); });
})();
