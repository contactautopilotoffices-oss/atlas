// Native adaptations of EasyUI GlassNavbar, AnimatedTabs, FloatingActionDock and AnimatedNumber.
// Source links and MIT notice: /engine/vendor/easyui/README.md.
import { brandLockup } from './andheri-brand.js';
import { SHORTLIST, odometer, rollIn, ICON } from './andheri-experience.js';
export { brandLockup };

const FONTS = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap';
export function applyAndheriTheme(surface,client){
 document.body.dataset.andheriUi=surface;
 if(client)document.body.dataset.apClient=client;
 if(!document.querySelector('link[data-andheri-theme]')){
  const css=document.createElement('link');css.rel='stylesheet';css.href='/engine/andheri-ui.css';css.dataset.andheriTheme='';document.head.appendChild(css);
 }
 if(surface==='world'&&!document.querySelector('link[data-andheri-fonts]')){
  const f=document.createElement('link');f.rel='stylesheet';f.href=FONTS;f.dataset.andheriFonts='';document.head.appendChild(f);
  const x=document.createElement('link');x.rel='stylesheet';x.href='/engine/andheri-experience.css';x.dataset.andheriExperience='';document.head.appendChild(x);
 }
 // The world is dark (photography and 3D); CAD, interior and the 2D atlas have light headers.
 const tone=surface==='world'?'dark':'light';
 const brand=document.querySelector(surface==='cad'?'.plan-brand':surface==='interior'?'header>#brand':'#brand');
 if(brand&&!brand.querySelector('.ap-lockup')){
  if(brand.tagName==='IMG')brand.replaceWith(brandLockup(tone));else brand.prepend(brandLockup(tone));
 }
 for(const box of document.querySelectorAll('#gate .box,#load .box'))if(!box.querySelector('.ap-lockup'))box.prepend(brandLockup('dark'));
 if(surface==='atlas'){
  const logo=document.querySelector('#gate .logo');if(logo&&!logo.parentElement.querySelector('.ap-lockup'))logo.replaceWith(brandLockup('dark'));
  document.querySelector('#brand>.logo')?.setAttribute('hidden','');
 }
 if(surface==='world')new ResizeObserver(()=>document.body.style.setProperty('--world-header-bottom',Math.ceil(document.querySelector('#top').getBoundingClientRect().bottom)+'px')).observe(document.querySelector('#top'));
 let meta=document.querySelector('meta[name="theme-color"]');
 if(!meta&&surface==='world'){meta=document.createElement('meta');meta.name='theme-color';document.head.append(meta);}
 if(meta)meta.content=surface==='world'?'#0a0a0b':'#ffffff';
}
export function easyTabs(nav,{tabs=false,panel}={}){
 if(!nav||nav.dataset.easyTabs)return;nav.dataset.easyTabs='';nav.classList.add('ap-tabs');
 const pill=document.createElement('i');pill.className='ap-tab-indicator';pill.setAttribute('aria-hidden','true');nav.prepend(pill);
 const buttons=()=>[...nav.querySelectorAll('button')];
 if(tabs)nav.setAttribute('role','tablist');
 const update=()=>{
  const all=buttons(),active=all.find(b=>b.classList.contains('on'));
  for(const [i,b]of all.entries())if(tabs){b.id||=`ap-tab-${i}`;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(b===active));b.tabIndex=b===active?0:-1;if(panel)b.setAttribute('aria-controls',panel.id);}
  if(!active){pill.hidden=true;return;}pill.hidden=false;
  pill.style.transform=`translate(${active.offsetLeft}px,${active.offsetTop}px)`;pill.style.width=active.offsetWidth+'px';pill.style.height=active.offsetHeight+'px';
  if(tabs&&panel){panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',active.id);}
 };
 new MutationObserver(update).observe(nav,{subtree:true,attributes:true,attributeFilter:['class','aria-pressed']});
 new ResizeObserver(update).observe(nav);
 nav.addEventListener('keydown',e=>{const all=buttons(),i=all.indexOf(document.activeElement);if(i<0)return;let next;
  if(e.key==='ArrowRight')next=(i+1)%all.length;if(e.key==='ArrowLeft')next=(i+all.length-1)%all.length;if(e.key==='Home')next=0;if(e.key==='End')next=all.length-1;
  if(next!=null){e.preventDefault();all[next].focus();all[next].click();}
 });
 requestAnimationFrame(update);document.fonts?.ready.then(update);
}

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stationKey=s=>String(s||'').toLowerCase().replace(/\s*\(.*\)/,'').trim();
/* The property card at the top of the explorer's panel: canonical facts, rolling figures,
   and the nearest-metro row that draws the walk. */
let lastSpot='';
export function propertySpotlight(o,onRoute){
 let panel=document.querySelector('#property-spotlight');
 if(!panel){panel=document.createElement('div');panel.id='property-spotlight';document.querySelector('#line2').after(panel);}
 const c=SHORTLIST[o.id];
 const eyebrow=document.querySelector('#h-eyebrow');
 if(!c){panel.innerHTML='';return;}
 const route=(o.routes||[]).find(r=>r.kind==='metro'&&stationKey(r.name)===stationKey(c.metro.station))||(o.routes||[]).find(r=>r.kind==='metro');
 if(eyebrow)eyebrow.textContent=`${String(c.n).padStart(2,'0')} · ${c.market} · ${c.question}`;
 panel.innerHTML=`<p class="ax-spot-sub">${esc(c.building)}</p>
  <div class="ax-spot-stats">
   <div><small>Carpet area</small><strong data-slot="carpet"></strong>${c.carpetNote?`<em>${esc(c.carpetNote)}</em>`:''}</div>
   <div><small>On offer</small><strong class="ax-stat-text">${esc(c.offer)}</strong><em>${esc(c.offerNote)}</em></div>
  </div>
  <p class="ax-spot-status"><i aria-hidden="true"></i>${esc(c.status)}</p>
  ${route?`<button type="button" class="ax-metro-row" aria-label="Show the walk to ${esc(c.metro.station)} metro, ${c.metro.m} metres, ${c.metro.min} minutes"><span class="ax-metro-ico">${ICON.walk}</span><span class="ax-metro-name"><small>Nearest metro · ${esc(c.metro.line)}</small><b>${esc(c.metro.station)}</b></span><span class="ax-metro-val" data-slot="metro"></span></button>`:''}`;
 const carpet=panel.querySelector('[data-slot=carpet]');carpet.append(odometer(c.carpet),Object.assign(document.createElement('span'),{className:'ax-unit',textContent:' sq ft'}));
 const metro=panel.querySelector('[data-slot=metro]');
 if(metro){metro.append(odometer(c.metro.m),Object.assign(document.createElement('span'),{className:'ax-unit',textContent:' m'}));
  const sub=document.createElement('small');sub.append(odometer(c.metro.min),Object.assign(document.createElement('span'),{textContent:' min walk'}));metro.append(sub);}
 panel.querySelector('.ax-metro-row')?.addEventListener('click',()=>onRoute(route));
 // roll the figures when the property changes, not on every route click
 if(lastSpot!==o.id){lastSpot=o.id;rollIn(panel,{delay:120});}
}
