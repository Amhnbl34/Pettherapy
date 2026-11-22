// ===== اتصال به بک‌اند (فقط وقتی سایت از طریق سرور باز شده باشد) =====
let SID=(()=>{try{return localStorage.getItem('pt_store')||''}catch(e){return''}})();
const API={on:false,user:null,online:false,cfg:{},stores:[],store:null,settings:{},needStore:false};
const finalPrice=p=>p.disc?Math.round(p.price*(100-p.disc)/100/1000)*1000:p.price;
async function api(m,u,b){try{const r=await fetch(u,{method:m,headers:b?{'Content-Type':'application/json'}:{},body:b?JSON.stringify(b):undefined,credentials:'same-origin'});let d={};try{d=await r.json()}catch(e){}return{ok:r.ok,status:r.status,data:d}}catch(e){return{ok:false,status:0,data:{error:'ارتباط با سرور برقرار نشد'}}}}
const idxOf=id=>{const i=P.findIndex(x=>x[9]==id);return i<0?null:i};
function cartIds(){const o={};for(const k in cart)if(P[k]&&P[k][9]!=null)o[P[k][9]]=cart[k];return o}
function saveWish(){const ids=[];for(const k in wish)if(P[k]&&P[k][9]!=null)ids.push(P[k][9]);try{localStorage.setItem('pt_wish',JSON.stringify(API.on?Object.fromEntries(ids.map(i=>[i,1])):wish))}catch(_){}if(API.on&&API.user){API.user.wish=ids;api('PUT','/api/me',{wish:ids})}}
(function(){if(!/^https?:$/.test(location.protocol))return;let b=null;try{const x=new XMLHttpRequest();x.open('GET','/api/bootstrap?store='+encodeURIComponent(SID),false);x.send();if(x.status==200)b=JSON.parse(x.responseText)}catch(e){}
 if(!b||!Array.isArray(b.products))return;API.on=true;API.user=b.user||null;API.stores=b.stores||[];API.store=b.store||null;API.settings=b.settings||{};API.needStore=!!b.needStore;if(API.store)SID=String(API.store.id);try{if(API.store)localStorage.setItem('pt_store',String(API.store.id));else if(SID)localStorage.removeItem('pt_store')}catch(e){}API.cfg=b.config||{};API.online=!!API.cfg.online;
 P.length=0;b.products.forEach(p=>P.push([p.animal,p.cat,p.name,finalPrice(p),p.emoji,p.brand,p.note||'',p.disc||0,p.img||'',p.id,p.stock]))})();
const $=s=>document.querySelector(s),fa=n=>n.toLocaleString('fa-IR');
const money=n=>fa(n)+' تومان';
let cur=null,cat=0,cart={},hist=[],tab='cart';
try{cart=JSON.parse(localStorage.getItem('pt_cart2_'+SID))||{};hist=JSON.parse(localStorage.getItem('pt_hist2'))||[]}catch(e){}
if(API.on){const c2={};for(const k in cart){const ix=idxOf(k);if(ix!=null)c2[ix]=cart[k]}cart=c2}
for(const k in cart)if(!P[k])delete cart[k];
const save=()=>{try{localStorage.setItem('pt_cart2_'+SID,JSON.stringify(API.on?cartIds():cart));if(!API.on)localStorage.setItem(ordersKey(),JSON.stringify(hist))}catch(e){}};
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1500)}
