// Native adaptations of EasyUI GlassNavbar, AnimatedTabs and FloatingActionDock.
// Source links and MIT notice: /engine/vendor/easyui/README.md.
const asset='/media/flipkart-andheri/brand/';
export function brandLockup(){
 const node=document.createElement('div');node.className='ap-lockup';node.setAttribute('aria-label','Autopilot for Flipkart');
 node.innerHTML=`<img class="ap-logo" src="/airoli-rtp/brand/autopilot-wordmark-white.png" alt="Autopilot" width="880" height="112"><span class="ap-brand-divider" aria-hidden="true"></span><span class="ap-client"><img class="fk-symbol" src="${asset}flipkart-mark.png" alt="" width="104" height="88"><img class="fk-wordmark" src="${asset}flipkart-wordmark.png" alt="Flipkart" width="276" height="108"></span>`;
 return node;
}
export function applyAndheriTheme(surface){
 document.body.dataset.andheriUi=surface;
 if(!document.querySelector('link[data-andheri-theme]')){
  const css=document.createElement('link');css.rel='stylesheet';css.href='/engine/andheri-ui.css';css.dataset.andheriTheme='';document.head.appendChild(css);
 }
 const brand=document.querySelector(surface==='cad'?'.plan-brand':surface==='interior'?'header>#brand':'#brand');
 if(brand&&!brand.querySelector('.ap-lockup')){
  if(brand.tagName==='IMG')brand.replaceWith(brandLockup());else brand.prepend(brandLockup());
 }
 for(const box of document.querySelectorAll('#gate .box,#load .box'))if(!box.querySelector('.ap-lockup'))box.prepend(brandLockup());
 if(surface==='atlas'){
  const logo=document.querySelector('#gate .logo');if(logo&&!logo.parentElement.querySelector('.ap-lockup'))logo.replaceWith(brandLockup());
  document.querySelector('#brand>.logo')?.setAttribute('hidden','');
 }
 if(surface==='world')new ResizeObserver(()=>document.body.style.setProperty('--world-header-bottom',Math.ceil(document.querySelector('#top').getBoundingClientRect().bottom)+'px')).observe(document.querySelector('#top'));
 const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=surface==='world'?'#0b1630':'#ffffff';
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
const fact=(o,k)=>(o.facts||[]).find(f=>f.k===k)?.v||'';
const nearest=o=>(o.routes||[]).filter(r=>r.kind==='metro'&&Number.isFinite(r.m)).sort((a,b)=>a.m-b.m)[0];
const distance=r=>r.m>=1000?`${(r.m/1000).toFixed(1)} km`:`${Math.round(r.m)} m`;
function factsMarkup(o){return ['Carpet area','Floor / Unit','Furnishing'].map(k=>`<div><span>${k==='Floor / Unit'?'On offer':esc(k)}</span><b>${esc(fact(o,k)||'—')}</b></div>`).join('');}
export function propertySpotlight(o,onRoute){
 let panel=document.querySelector('#property-spotlight');
 if(!panel){panel=document.createElement('div');panel.id='property-spotlight';document.querySelector('#line2').after(panel);}
 const r=nearest(o);
 panel.innerHTML=`<div class="ap-property-facts">${factsMarkup(o)}</div>${r?`<button class="ap-metro-card" aria-label="View walking route to ${esc(r.name)} metro"><span><small>NEAREST METRO</small><b>${esc(r.name)}</b><em>${esc((r.lines||[]).join(' · '))}</em></span><span class="metro-distance"><strong>${distance(r)}</strong><small>${r.min?`${r.min} min walk`:'On foot'} <i aria-hidden="true">↗</i></small></span></button>`:''}`;
 panel.querySelector('button')?.addEventListener('click',()=>onRoute(r));
}
export function twinIntro(o){
 const load=document.querySelector('#load');load.classList.add('twin-intro');load.style.removeProperty('background-image');load.setAttribute('role','dialog');load.setAttribute('aria-modal','true');load.setAttribute('aria-label','Enter the digital twin');
 const background=[...document.querySelectorAll('#c,#top,#hud,#strip,#floors,#credit,#map-credits')];background.forEach(n=>n.inert=true);
 const r=nearest(o);
 load.innerHTML=`<div class="twin-intro-top"><span id="intro-brand"></span><button id="intro-sound" type="button" aria-pressed="true">Sound on</button></div>
 <div class="twin-intro-body"><div class="twin-construction" aria-hidden="true"><div class="twin-orbit"></div><svg viewBox="0 0 520 400" fill="none"><defs><linearGradient id="twin-ink" x1="30" y1="300" x2="430" y2="30" gradientUnits="userSpaceOnUse"><stop stop-color="#2A55E5"/><stop offset="1" stop-color="#FFC200"/></linearGradient></defs><g class="twin-grid" stroke="#ffffff10"><path d="M40 280L260 160L480 280L260 400Z M95 250L315 370 M150 220L370 340 M205 190L425 310 M95 310L315 190 M150 340L370 220 M205 370L425 250"/></g><g class="twin-floor floor-1"><path d="M100 230L270 140L420 220L250 310Z"/></g><g class="twin-floor floor-2"><path d="M100 180L270 90L420 170L250 260Z"/></g><g class="twin-floor floor-3"><path d="M100 130L270 40L420 120L250 210Z"/></g><g class="twin-columns"><path d="M100 230V130M270 140V40M420 220V120M250 310V210"/></g><path class="twin-route" d="M30 340L90 307L155 340L250 288"/><circle class="twin-node" cx="30" cy="340" r="6"/><circle class="twin-node destination" cx="250" cy="288" r="7"/></svg><span class="twin-visual-label">LOCATION · SPACE · POSSIBILITY</span></div>
 <div class="twin-intro-copy"><p class="twin-eyebrow">ANDHERI EAST · A DIGITAL TWIN EXPERIENCE</p><h1 id="l-title">A new perspective<br>on your next office.</h1><div class="intro-property">${esc(o.name)}</div>${r?`<div class="intro-metro"><strong>${distance(r)}</strong><span>to ${esc(r.name)} metro${r.min?`<br><b>${r.min} minutes on foot</b>`:''}</span></div>`:''}<div class="ap-property-facts intro-facts">${factsMarkup(o)}</div><div class="intro-progress"><div class="bar"><i id="l-bar"></i></div><p id="l-msg" role="status">Preparing geometry, surroundings and light…</p></div><button id="intro-enter" class="ap-action" hidden>Enter digital twin <span aria-hidden="true">↗</span></button><p class="intro-source">Connectivity from the supplied route data.</p></div></div>`;
 document.querySelector('#intro-brand').append(brandLockup());
 const sound=document.querySelector('#intro-sound'),enter=document.querySelector('#intro-enter');
 const cue=new Audio(asset+'twin-arrival.mp3'),tick=new Audio(asset+'selection-tick.mp3');cue.volume=.22;tick.volume=.12;
 let enabled=true;try{enabled=sessionStorage.getItem('andheri-sound')!=='off';}catch{}
 const sync=()=>{sound.textContent=enabled?'Sound on':'Sound off';sound.setAttribute('aria-pressed',String(enabled));sound.setAttribute('aria-label',enabled?'Mute sound effects':'Enable sound effects');};sync();
 sound.onclick=()=>{enabled=!enabled;sync();if(!enabled){cue.pause();tick.pause();}try{sessionStorage.setItem('andheri-sound',enabled?'on':'off');}catch{}};
 const play=a=>{if(enabled){a.currentTime=0;a.play().catch(()=>{});}};
 load.tabIndex=-1;load.focus({preventScroll:true});
 return {
  selection:()=>play(tick),
  ready(){load.classList.add('twin-ready');document.querySelector('#l-bar').style.width='100%';document.querySelector('#l-msg').textContent='Your digital twin is ready.';enter.hidden=false;
   enter.onclick=()=>{play(cue);load.classList.add('twin-entering');sound.classList.add('twin-sound-floating');document.body.append(sound);setTimeout(()=>{load.remove();background.forEach(n=>n.inert=false);const title=document.querySelector("#name");title.tabIndex=-1;title.focus({preventScroll:true});},750);};
  }
 };
}
