// دسته‌ها و اسکرول خودکار
const rail=$('#rail');const base=rail.innerHTML;rail.innerHTML=base+base+base;
let pause=false,pos=0,rt,dn=0,sx=0,sl=0;
const setW=()=>rail.children[6].offsetLeft-rail.children[0].offsetLeft;
const init=()=>{pos=setW();rail.scrollLeft=pos};init();addEventListener('load',init);
function hold(){pause=true;clearTimeout(rt);rt=setTimeout(()=>pause=false,2500)}
['pointerdown','wheel','touchstart','focusin','keydown'].forEach(ev=>rail.addEventListener(ev,hold,{passive:true}));
rail.addEventListener('mouseenter',()=>pause=true);rail.addEventListener('mouseleave',()=>{pause=false;dn=0});
rail.addEventListener('mousedown',e=>{dn=1;sx=e.pageX;sl=rail.scrollLeft});addEventListener('mouseup',()=>dn=0);
rail.addEventListener('mousemove',e=>{if(dn)rail.scrollLeft=sl-(e.pageX-sx)});
(function tick(){const W=setW();if(!pause&&!matchMedia('(prefers-reduced-motion:reduce)').matches)pos+=.5;else pos=rail.scrollLeft;if(pos>=2*W)pos-=W;if(pos<=0)pos+=W;rail.scrollLeft=pos;requestAnimationFrame(tick)})();
rail.addEventListener('click',e=>{const c=e.target.closest('.cat');if(!c)return;const a=c.dataset.a;if(a=='pic'){location.hash='#best';return}if(a=='learn'){location.hash='#guide';return}document.querySelectorAll('.cat').forEach(x=>x.classList.toggle('on',x.dataset.a==a));cur=a;cat=0;renderShop();$('#learn').hidden=true;$('#pic').hidden=true;$('#shop').hidden=false;$('#shop').scrollIntoView({behavior:'smooth'});snd(a);setBg(a)});
const FX={dog:['🐾','🦴','🐕'],cat:['🐾','🐟','🐈','🧶'],bird:['🪶','🎵','🦜','🌿']};
function shopTheme(){$('#shop').className='shop th-'+cur;$('#fx').innerHTML=Array.from({length:18},(_,i)=>{const e=FX[cur];return `<span style="left:${(i*37)%96}%;font-size:${1.2+(i%4)*.5}rem;animation-duration:${14+(i%5)*3}s;animation-delay:-${i*1.7}s">${e[i%e.length]}</span>`}).join('')}
const SND={dog:'/assets/snd-dog.mp3',cat:'/assets/snd-cat.mp3',bird:'/assets/snd-bird.mp3'};
const BG={dog:'/assets/bg-dog.jpg',cat:'/assets/bg-cat.jpg',bird:'/assets/bg-bird.jpg'};
const AUD={};function snd(a){try{const o=AUD[a]=AUD[a]||new Audio(SND[a]);o.currentTime=0;o.volume=.25;o.play().catch(()=>sndOld(a))}catch(e){sndOld(a)}}
