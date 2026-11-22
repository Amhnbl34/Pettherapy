// ===== توابع مخصوص حالت سرور =====
async function picLoad(){if(!API.on)return;const r=await api('GET','/api/pets');if(r.ok){pets=r.data.pets;rates=r.data.rates;UID=API.user?API.user.id:'me';drawPic()}}
async function refreshProducts(){const r=await api('GET','/api/products?store='+encodeURIComponent(SID));if(!r.ok)return;r.data.products.forEach(p=>{const ix=idxOf(p.id);if(ix!=null){P[ix][10]=p.stock;P[ix][3]=finalPrice(p);P[ix][7]=p.disc||0}});try{upd()}catch(e){}}
async function placeOrderApi(){const e=$('#com'),btn=$('#plc');
 const n=$('#co-n').value.trim(),m=dg($('#co-m').value.trim()),c=$('#co-c').value.trim(),ad=$('#co-a').value.trim(),t=$('#co-t').value.trim(),pm=document.querySelector('[name=pm]:checked').value;
 if(n.length<2)return e.textContent='نام گیرنده را وارد کنید';if(!/^09\d{9}$/.test(m))return e.textContent='شماره موبایل معتبر نیست';if(!c)return e.textContent='شهر را وارد کنید';if(ad.length<10)return e.textContent='آدرس را کامل‌تر بنویسید';
 btn.disabled=true;e.textContent='';
 const items=Object.entries(cart).filter(([i])=>P[i]).map(([i,q])=>({pid:P[i][9],q}));
 const r=await api('POST','/api/orders',{store:API.store?API.store.id:undefined,items,coupon,to:{n,m,c,a:ad},pm,note:t});btn.disabled=false;
 if(!r.ok){e.textContent=r.data.error||'ثبت سفارش ناموفق بود';if(r.status==401){API.user=null;refreshUser();location.hash='#login'}if(r.status==409)refreshProducts();return}
 const o=mapOrder(r.data.order);hist.unshift(o);const u=curUser();if(u&&!(u.addrs||[]).length){u.addrs=[{t:'خانه',c,a:ad}];saveUser(u)}
 cart={};coupon='';try{localStorage.setItem('pt_coupon','""')}catch(_){}save();step='done';lastOrd=o;upd();refreshProducts()}
if(API.on)$('#asub').onclick=async()=>{const pw=$('#pw').value;let r;
 if(amode=='up'){const n=$('#rn').value.trim(),m=dg($('#rm').value.trim()),e=$('#re').value.trim().toLowerCase();
  if(n.length<2)return amsg('نام را وارد کنید');if(!/^09\d{9}$/.test(m))return amsg('شماره موبایل معتبر نیست (مثل ۰۹۱۲۳۴۵۶۷۸۹)');if(e&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))return amsg('ایمیل معتبر نیست');if(pw.length<6)return amsg('رمز عبور حداقل ۶ کاراکتر باشد');
  r=await api('POST','/api/register',{name:n,mobile:m,email:e,password:pw})}
 else r=await api('POST','/api/login',{id:dg($('#li').value.trim().toLowerCase()),password:pw});
 if(!r.ok)return amsg(r.data.error||'خطا');
 API.user=r.data.user;(API.user.wish||[]).forEach(id=>{const ix=idxOf(id);if(ix!=null)wish[ix]=1});saveWish();
 $('#pw').value='';amsg('');refreshUser();picLoad();toast(helloText()+' 🐾');location.hash='#account'};
initPic();setMode('in');refreshUser();route();upd();bbar();
