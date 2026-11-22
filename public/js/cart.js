// ===== سبد خرید کامل =====
let SHIP_FREE=10000000,SHIP_FEE=200000;
const CODES={PET10:['۱۰٪ تخفیف',x=>Math.round(x*.1)],WELCOME:['۵۰۰ هزار تومان تخفیف',()=>500000]};
if(API.on){SHIP_FREE=API.cfg.shipFree;SHIP_FEE=API.cfg.shipFee;for(const k in CODES)delete CODES[k];for(const [k,c] of Object.entries(API.cfg.codes||{}))CODES[k]=[c.label,c.pct?(x=>Math.round(x*c.pct/100)):(()=>c.amount)]}
let coupon='',step='cart',cmsg='',lastOrd=null;try{coupon=JSON.parse(localStorage.getItem('pt_coupon'))||''}catch(e){}
function curUser(){try{return me()}catch(e){return null}}
function ordersKey(){return 'pt_orders_'+((curUser()||{}).id||'guest')}
function mapOrder(o){o.date=new Date(o.ts).toLocaleDateString('fa-IR');o.items.forEach(it=>{it.i=idxOf(it.pid)});return o}
function loadHist(){if(API.on){hist=[];step='cart';if(curUser())api('GET','/api/orders').then(r=>{if(r.ok){hist=r.data.orders.map(mapOrder);try{upd()}catch(e){}if(location.hash=='#account')drawAcc()}});try{upd()}catch(e){}return}
 try{hist=JSON.parse(localStorage.getItem(ordersKey()))||[]}catch(e){hist=[]}step='cart';try{upd()}catch(e){}}
const fid=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
const ORD_ST={reg:['ثبت شده','#F4D8A8'],prep:['در حال آماده‌سازی','#FFE9A8'],ship:['ارسال شده','#B9E0DC'],done:['تحویل شده','#bfe3b4'],can:['لغو شده','#f6c4b8']};
const thumb=i=>{const p=P[i];return p[8]?`<img class="th" src="${p[8]}" alt="" referrerpolicy="no-referrer" onerror="this.outerHTML='<span class=&quot;e&quot;>${p[4]}</span>'">`:`<span class="e">${p[4]}</span>`};
function sums(){const sub=total(),dc=coupon&&CODES[coupon]?Math.min(sub,CODES[coupon][1](sub)):0,net=sub-dc,ship=!sub||net>=SHIP_FREE?0:SHIP_FEE;return{sub,dc,net,ship,grand:net+ship}}
function cartView(){const k=Object.keys(cart),S=sums();
 if(!k.length)return{b:'<p class="empty">سبد خرید شما خالی است 🛒<br>از دسته‌ها محصول اضافه کنید.</p>',f:''};
 const rem=Math.max(0,SHIP_FREE-S.net);
 const bar=`<div class="fs"><small>${rem?'تا ارسال رایگان '+money(rem)+' مونده 🚚':'🎉 ارسال سفارش شما رایگانه'}</small><div class="prog"><i style="width:${Math.min(100,S.net*100/SHIP_FREE)}%"></i></div></div>`;
 const rows=k.map(i=>{const p=P[i],q=cart[i];return `<div class="row">${thumb(i)}<div class="n"><b>${p[2]}</b><small>${p[5]} · ${p[6]||''}</small><small>${money(p[3])}</small></div><div class="rt2"><div class="q"><button data-d="1" data-i="${i}" aria-label="افزودن">+</button><b>${fa(q)}</b><button data-d="-1" data-i="${i}" aria-label="کم کردن">−</button></div><b class="lt">${money(p[3]*q)}</b><button class="rm" data-rm="${i}" aria-label="حذف">🗑</button></div></div>`}).join('');
 const an=P[k[0]][0],sug=P.map((p,i)=>[p,i]).filter(([p,i])=>p[0]==an&&!cart[i]).sort((x,y)=>x[0][3]-y[0][3]).slice(0,4);
 const sg=sug.length?`<h4 class="sh">پیشنهاد برای تو ✨</h4><div class="sug">${sug.map(([p,i])=>`<button data-add="${i}">${thumb(i)}<span>${p[2]}</span><b>${money(p[3])}</b><span>＋ افزودن</span></button>`).join('')}</div>`:'';
 const cp=`<div class="cp"><input id="cpi" placeholder="کد تخفیف (مثلاً PET10)" value="${esc(coupon)}" dir="ltr"><button id="cpa">اعمال</button></div><small class="cm">${cmsg}</small>`;
 const sm=`<div class="sm"><div><span>جمع کالاها (${fa(k.reduce((a,i)=>a+cart[i],0))} عدد)</span><span>${money(S.sub)}</span></div>${S.dc?`<div class="g"><span>تخفیف (${esc(coupon)})</span><span>−${money(S.dc)}</span></div>`:''}<div><span>هزینه ارسال</span><span>${S.ship?money(S.ship):'رایگان'}</span></div></div>`;
 return{b:bar+rows+sg+cp,f:sm+`<div class="total"><span>مبلغ قابل پرداخت</span><span>${money(S.grand)}</span></div><button class="pay" id="gock">ادامه و تکمیل سفارش</button><button class="lnk" id="clrc">خالی کردن سبد</button>`}}
function checkView(){const u=curUser()||{},S=sums(),ad=(u.addrs||[])[0]||{};
 return{b:`<h4 class="sh">اطلاعات تحویل</h4><div class="fm"><input id="co-n" placeholder="نام گیرنده" value="${esc(u.name||'')}"><input id="co-m" dir="ltr" placeholder="موبایل (۰۹۱۲...)" value="${esc(u.mobile||'')}"><input id="co-c" placeholder="شهر" value="${esc(ad.c||'')}"><textarea id="co-a" rows="3" placeholder="آدرس کامل">${esc(ad.a||'')}</textarea><textarea id="co-t" rows="2" placeholder="توضیحات (اختیاری)"></textarea></div><h4 class="sh">روش پرداخت</h4><label class="rd"><input type="radio" name="pm" value="cod" checked> پرداخت در محل</label>${API.on&&!API.online?'':'<label class="rd"><input type="radio" name="pm" value="online"> پرداخت آنلاین</label>'}<small class="cm" id="com" style="color:#c0392b"></small>`,f:`<div class="total"><span>مبلغ قابل پرداخت</span><span>${money(S.grand)}</span></div><button class="pay" id="plc">ثبت نهایی سفارش</button><button class="lnk" id="bkc">بازگشت به سبد</button>`}}
function doneView(){const o=lastOrd;return{b:`<div class="done"><div class="big">🎉</div><h3>سفارشت ثبت شد</h3><p>شماره سفارش #${fid(o.id)}<br>کد پیگیری: <b dir="ltr">${o.tr}</b><br>مبلغ: ${money(o.grand)}</p></div>`,f:'<button class="pay" data-goord="1">دیدن سفارش‌ها</button>'}}
function ordHtml(o){return `<div class="ord"><h4><span>سفارش #${fid(o.id)}</span><span class="stt" style="background:${ORD_ST[o.st||'reg'][1]}">${ORD_ST[o.st||'reg'][0]}</span></h4><small>${o.date}${o.tr?' · کد پیگیری <b dir="ltr">'+o.tr+'</b>':''}</small>${o.items.map(i=>`<div class="oi">${i.i!=null&&P[i.i]?thumb(i.i):''}<span>${i.n} × ${fa(i.q)}</span><span>${money(i.p*i.q)}</span></div>`).join('')}<div class="sm">${o.dc?`<div class="g"><span>تخفیف ${esc(o.code||'')}</span><span>−${money(o.dc)}</span></div>`:''}${o.grand!=null?`<div><span>ارسال</span><span>${o.ship?money(o.ship):'رایگان'}</span></div>`:''}</div><b>جمع: ${money(o.grand!=null?o.grand:o.items.reduce((s,i)=>s+i.p*i.q,0))}</b>${o.to?`<small style="display:block">📍 ${esc(o.to.c)}، ${esc(o.to.a)} · ${o.pm=='online'?'پرداخت آنلاین':'پرداخت در محل'}</small>`:''}<div class="oa"><button data-re="${o.id}">🔁 سفارش مجدد</button>${(o.st||'reg')=='reg'?`<button data-cn="${o.id}">لغو سفارش</button>`:''}</div></div>`}
function draw(){document.querySelectorAll('.dtabs .tab').forEach(t=>t.classList.toggle('on',t.dataset.t==tab));
 if(!Object.keys(cart).length&&step=='check')step='cart';
 const b=$('#dbody'),f=$('#dfoot');let r;
 if(tab=='cart')r=step=='done'&&lastOrd?doneView():step=='check'?checkView():cartView();
 else r={b:hist.length?hist.map(ordHtml).join(''):(curUser()?'<p class="empty">هنوز سفارشی ثبت نکرده‌اید.</p>':'<p class="empty">برای دیدن سفارش‌ها وارد حساب شوید.</p>'),f:''};
 b.innerHTML=r.b;f.innerHTML=r.f}
function orderAct(e){const re=e.target.closest('[data-re]'),cn=e.target.closest('[data-cn]');
 if(re){const o=hist.find(x=>x.id==re.dataset.re);if(o){o.items.forEach(i=>{if(i.i!=null&&P[i.i])cart[i.i]=(cart[i.i]||0)+i.q});save();step='cart';tab='cart';upd();op(true);toast('به سبد اضافه شد')}return true}
 if(cn&&API.on){api('POST','/api/orders/'+cn.dataset.cn+'/cancel').then(r=>{if(r.ok){const o=hist.find(x=>x.id==cn.dataset.cn);if(o)o.st='can';upd();if(location.hash=='#account')drawAcc();toast('سفارش لغو شد');refreshProducts()}else toast(r.data.error||'خطا')});return true}
 if(cn){const o=hist.find(x=>x.id==cn.dataset.cn);if(o&&(o.st||'reg')=='reg'){o.st='can';save();upd();if(location.hash=='#account')drawAcc();toast('سفارش لغو شد')}return true}
 return false}
function placeOrder(){if(API.on)return placeOrderApi();const u=curUser(),e=$('#com');
 const n=$('#co-n').value.trim(),m=dg($('#co-m').value.trim()),c=$('#co-c').value.trim(),ad=$('#co-a').value.trim(),t=$('#co-t').value.trim(),pm=document.querySelector('[name=pm]:checked').value;
 if(n.length<2)return e.textContent='نام گیرنده را وارد کنید';if(!/^09\d{9}$/.test(m))return e.textContent='شماره موبایل معتبر نیست';if(!c)return e.textContent='شهر را وارد کنید';if(ad.length<10)return e.textContent='آدرس را کامل‌تر بنویسید';
 const S=sums(),o={id:(hist[0]?hist[0].id:1000)+1,ts:Date.now(),date:new Date().toLocaleDateString('fa-IR'),items:Object.entries(cart).map(([i,q])=>({i:+i,n:P[i][2],p:P[i][3],q})),sub:S.sub,dc:S.dc,ship:S.ship,grand:S.grand,code:S.dc?coupon:'',to:{n,m,c,a:ad},pm,note:t,st:'reg',tr:'PT'+Math.random().toString(36).slice(2,8).toUpperCase()};
 hist.unshift(o);if(u&&!(u.addrs||[]).length){u.addrs=[{t:'خانه',c,a:ad}];saveUser(u)}
 cart={};coupon='';try{localStorage.setItem('pt_coupon','""')}catch(_){}save();step='done';lastOrd=o;upd()}
$('#dbody').onclick=e=>{const g=s=>e.target.closest(s);let x;
 if(x=g('[data-d]')){const i=x.dataset.i;cart[i]=(cart[i]||0)+ +x.dataset.d;if(cart[i]<=0)delete cart[i];save();upd();return}
 if(x=g('[data-rm]')){delete cart[x.dataset.rm];save();upd();return}
 if(x=g('[data-add]')){const i=x.dataset.add;cart[i]=(cart[i]||0)+1;save();upd();toast('به سبد اضافه شد');return}
 if(g('#cpa')){const c=$('#cpi').value.trim().toUpperCase();if(!c){coupon='';cmsg=''}else if(CODES[c]){coupon=c;cmsg='✅ '+CODES[c][0]+' اعمال شد'}else{coupon='';cmsg='کد معتبر نیست'}try{localStorage.setItem('pt_coupon',JSON.stringify(coupon))}catch(_){}draw();return}
 if(g('[data-goord]')){tab='hist';step='cart';draw();return}
 orderAct(e)};
$('#dfoot').onclick=e=>{const g=s=>e.target.closest(s);
 if(g('#gock')){if(!curUser()){op(false);toast('برای ثبت سفارش اول وارد شوید');location.hash='#login';return}step='check';draw();return}
 if(g('#clrc')){cart={};coupon='';save();upd();return}
 if(g('#bkc')){step='cart';draw();return}
 if(g('#plc'))placeOrder();
 if(g('[data-goord]')){tab='hist';step='cart';draw()}};
document.querySelectorAll('.dtabs .tab').forEach(t=>t.onclick=()=>{tab=t.dataset.t;draw()});
const op=v=>document.body.classList.toggle('open',v);
$('#menu').onclick=()=>op(true);$('#close').onclick=()=>op(false);$('#shade').onclick=()=>op(false);
document.addEventListener('keydown',e=>e.key=='Escape'&&op(false));
upd();
