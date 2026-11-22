// ===== مسیریابی چندصفحه‌ای =====
const R={home:'p-home',shop:'p-home',guide:'learn',best:'pic',about:'p-about',contact:'p-contact',login:'p-login',account:'p-account'};
const TT={home:'',shop:'فروشگاه',guide:'آموزش',best:'کوچولوی برتر',about:'درباره ما',contact:'تماس',login:'ورود',account:'حساب من'};
function route(){let r=(location.hash||'#home').slice(1);if(!R[r])r='home';if(r=='account'&&!me())r='login';
 document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!=R[r]);
 document.querySelectorAll('nav a').forEach(x=>x.classList.toggle('on',x.getAttribute('href')=='#'+r));
 document.title=(window.SITE_TITLE||'Petherapy | پت‌تراپی')+(TT[r]?' - '+TT[r]:'');
 if(r=='guide')pickLearn(lcur);else if(r=='best')drawPic();else if(r=='account')drawAcc();
 if(r!='home'&&r!='shop'&&r!='guide'&&r!='best')$('#bgfull').classList.remove('on');
 if(r=='shop'){$('#rail').scrollIntoView({behavior:'smooth',block:'center'})}else scrollTo(0,0)}
addEventListener('hashchange',route);
