let sortBy='def',wish={};try{wish=JSON.parse(localStorage.getItem('pt_wish')||'{}')}catch(e){}
if(API.on){const w2={};for(const k in wish){const ix=idxOf(k);if(ix!=null)w2[ix]=1}wish=w2;if(API.user)(API.user.wish||[]).forEach(id=>{const ix=idxOf(id);if(ix!=null)wish[ix]=1})}
const SORTS=[['def','پیش‌فرض'],['cheap','ارزان‌ترین'],['exp','گران‌ترین']];
function renderShop(){shopTheme();
 $('#st').textContent='محصولات '+A[cur].n;
 $('#tabs').innerHTML=C.map((c,i)=>(i&&!P.some(p=>p[0]==cur&&p[1]==i))?'':`<button class="tab ${i==cat?'on':''}" data-i="${i}">${c}</button>`).join('');
 $('#tabs').onclick=e=>{const b=e.target.closest('.tab');if(b){cat=+b.dataset.i;renderShop()}};
 let tb=$('#tb');if(!tb){tb=document.createElement('div');tb.id='tb';tb.className='tb';$('#grid').before(tb);
  tb.onclick=e=>{const b=e.target.closest('.chip');if(b){sortBy=b.dataset.s;renderShop()}}}
 renderGrid();
}
// Product photos: search by exact brand and product name. The images load from the web,
// so the HTML stays lightweight while showing real product photography.
const PRODUCT_PHOTOS={
  0:'https://headsupfortails.com/cdn/shop/files/FOP_copy_772e7161-f262-488f-ba65-ea8085b9ff70.jpg?v=1766486782&width=900',
  11:'https://shop.hobbyuccelli.it/2390-large_default/omni-vit-polvere.jpg',
  12:'https://www.petcentral.ae/cdn/shop/collections/Filter_Petcentral_91_600x600.png?v=1757676725'
};
function productPhoto(p,i){
  if(!API.on&&PRODUCT_PHOTOS[i]) return PRODUCT_PHOTOS[i];
  const q=[p[5],p[2],'pet product package photo'].filter(Boolean).join(' ');
  return 'https://tse1.mm.bing.net/th?q='+encodeURIComponent(q)+'&w=640&h=640&c=7&rs=1&p=0';
}
P.forEach((p,i)=>{p[8]=p[8]||productPhoto(p,i)});
function renderGrid(){
 if(!$('#grid')||!cur)return;
 const L=P.map((p,i)=>[p,i]).filter(([p])=>p[0]==cur&&(cat==0||p[1]==cat));
 const old=([p,i])=>p[7]?Math.round(p[3]*100/(100-p[7])/1000)*1000:0;
 if(sortBy=='cheap')L.sort((x,y)=>x[0][3]-y[0][3]);
 else if(sortBy=='exp')L.sort((x,y)=>y[0][3]-x[0][3]);
 else if(sortBy=='rate')L.sort((x,y)=>y[0][6]-x[0][6]);
 else if(sortBy=='disc')L.sort((x,y)=>(y[0][7]||0)-(x[0][7]||0));
 const tb=$('#tb');
 if(tb)tb.innerHTML=`<span class="cn">${fa(L.length)} <small>کالا</small></span><span class="sl">مرتب‌سازی:</span><div class="sorts">${SORTS.map(([k,t])=>`<button class="chip ${k==sortBy?'on':''}" data-s="${k}">${t}</button>`).join('')}</div>`;
 $('#grid').innerHTML=L.length?L.map(([p,i])=>{const q=cart[i]||0;
  return `<article class="p"><div class="im">${p[7]?`<i class="off">٪${fa(p[7])}</i>`:''}<button class="hb ${wish[i]?'on':''}" data-w="${i}" aria-label="علاقه‌مندی">${wish[i]?'♥':'♡'}</button>${p[8]?`<img class="pimg" loading="lazy" referrerpolicy="no-referrer" src="${p[8]}" alt="${p[5]} ${p[2]}" onerror="this.onerror=null;this.src=BG['${p[0]}']">`:`<div class="e">${p[4]}</div>`}</div><div class="bd"><span class="br">${p[5]}</span><h3 class="nm">${p[2]}</h3><div class="mt"><span>${p[6]||""}</span></div><div class="sp">🚚 ارسال سریع</div><div class="pb">${p[7]?`<s>${money(old([p,i]))}</s>`:''}<span class="pr">${money(p[3])}</span></div>${q?`<div class="stp"><button data-d="1" data-i="${i}" aria-label="افزایش">+</button><b>${fa(q)}</b><button data-d="-1" data-i="${i}" aria-label="کاهش">−</button></div>`:(p[10]===0?`<button class="add" disabled style="opacity:.5">ناموجود</button>`:`<button class="add" data-i="${i}">افزودن به سبد</button>`)}</div></article>`}).join(''):'<div class="empty">محصولی یافت نشد</div>';
}
$('#grid').onclick=e=>{
 const w=e.target.closest('.hb');
 if(w){const i=w.dataset.w;if(wish[i])delete wish[i];else wish[i]=1;saveWish();w.classList.toggle('on',!!wish[i]);w.textContent=wish[i]?'♥':'♡';return}
 const s=e.target.closest('.stp button');
 if(s){const i=s.dataset.i;cart[i]=(cart[i]||0)+ +s.dataset.d;if(cart[i]<=0)delete cart[i];save();upd();return}
 const b=e.target.closest('.add');if(!b)return;
 cart[b.dataset.i]=(cart[b.dataset.i]||0)+1;save();upd();toast('به سبد خرید اضافه شد')};
{const _u=upd;upd=function(){_u();try{renderGrid()}catch(e){}}}

// سبد و سابقه
const total=()=>Object.entries(cart).reduce((s,[i,q])=>s+P[i][3]*q,0);
function upd(){$('#cnt').textContent=fa(Object.values(cart).reduce((a,b)=>a+b,0));draw()}
