// ===== ورود و ثبت‌نام (نسخه آزمایشی؛ داده‌ها فقط در مرورگر ذخیره می‌شود) =====
const jget=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
const jset=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}};
const dg=t=>t.replace(/[۰-۹]/g,d=>d.charCodeAt(0)-1776);
async function hp(p,salt){try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+p));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){return'x'+btoa(unescape(encodeURIComponent(salt+p)))}}
const me=()=>{if(API.on)return API.user;const id=jget('pt_session',null);return id&&jget('pt_users',[]).find(u=>u.id==id)||null};
function refreshUser(){loadHist();const u=me(),b=$('#usr');b.href=u?'#account':'#login';b.setAttribute('aria-label',u?'حساب من':'ورود یا ثبت‌نام');
 b.innerHTML=u?`<span class="ua">${esc([...u.name][0]||'👤')}</span>`:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>'}
let amode='in';
function setMode(m){amode=m;document.querySelectorAll('[data-m]').forEach(t=>t.classList.toggle('on',t.dataset.m==m));$('#f-up').hidden=m!='up';$('#f-in').hidden=m!='in';$('#asub').textContent=m=='in'?'ورود':'ساخت حساب';$('#pw').autocomplete=m=='in'?'current-password':'new-password';amsg('')}
function amsg(t,ok){const e=$('#amsg');e.textContent=t;e.classList.toggle('ok',!!ok)}
document.querySelectorAll('[data-m]').forEach(t=>t.onclick=()=>setMode(t.dataset.m));
$('#asub').onclick=async()=>{const pw=$('#pw').value,us=jget('pt_users',[]);
 if(amode=='up'){const n=$('#rn').value.trim(),m=dg($('#rm').value.trim()),e=$('#re').value.trim().toLowerCase();
  if(n.length<2)return amsg('نام را وارد کنید');if(!/^09\d{9}$/.test(m))return amsg('شماره موبایل معتبر نیست (مثل ۰۹۱۲۳۴۵۶۷۸۹)');
  if(e&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))return amsg('ایمیل معتبر نیست');if(pw.length<6)return amsg('رمز عبور حداقل ۶ کاراکتر باشد');
  if(us.some(u=>u.mobile==m||(e&&u.email==e)))return amsg('با این مشخصات قبلاً ثبت‌نام شده؛ وارد شوید');
  const salt=Math.random().toString(36).slice(2),u={id:'u'+Date.now(),name:n,mobile:m,email:e,salt,h:await hp(pw,salt),ts:Date.now()};us.push(u);
  if(!jset('pt_users',us)||!jset('pt_session',u.id))return amsg('ذخیره نشد؛ مرورگر اجازه نمی‌دهد');
  }else{const id=dg($('#li').value.trim().toLowerCase()),u=us.find(x=>x.mobile==id||(x.email&&x.email==id));
  if(!u||u.h!=await hp(pw,u.salt))return amsg('مشخصات یا رمز عبور اشتباه است');jset('pt_session',u.id)}
 $('#pw').value='';amsg('');refreshUser();toast(helloText()+' 🐾');location.hash='#account'};
document.querySelectorAll('.box input').forEach(i=>i.addEventListener('keydown',e=>{if(e.key=='Enter')$('#asub').click()}));
$('#forgot').onclick=()=>amsg('بازیابی رمز بعداً اضافه می‌شود',true);
