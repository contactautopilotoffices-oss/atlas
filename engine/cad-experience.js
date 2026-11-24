import {floorNavigation,prepareTrip} from "./floor-navigation.js";
import {loadPlan} from "/airoli-rtp/demo/js/plan.js";
import {layoutDifference,changeClusters,deskBounds} from './seat-diff.js';
import {focusPlanBounds,planReviewItems,selectPlanReviewItem} from '/airoli-rtp/demo/js/plan.js';
const $=s=>document.querySelector(s),NS='http://www.w3.org/2000/svg';
const shape=(type,attrs,parent)=>{const e=document.createElementNS(NS,type);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);parent?.append(e);return e;};
const poly=d=>'M'+d.polygon.map(p=>p[0]+','+(-p[1])).join('L')+'Z';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=v=>v.label||v.seats+' workstations';
export function createCadExperience({entry,property,onVariant,onDrawing}){
 const css=document.createElement('link');css.rel='stylesheet';css.href='/engine/cad-experience.css';document.head.append(css);
 const actions=document.createElement('div');actions.id='cad-actions';actions.innerHTML='<button id="compare-seats" aria-pressed="false">Compare seats</button><button id="tour-start" aria-pressed="false">3D room tour</button><button id="plan-trace">2D route</button><span class="cad-key"><span><i style="background:#243c54"></i>Walls</span><span><i style="background:#0086a2"></i>Glass</span><span><i style="background:#b56522"></i>Doors</span><span><i style="background:#0ba58c"></i>Desks</span></span><div class="cad-comparison-controls" id="cad-comparison-controls" hidden><label id="cad-comparison-baseline-label" for="cad-baseline">Compare against</label><select id="cad-baseline"></select><div class="cad-options" aria-label="Compare seating options"></div><select id="cad-review-floor" aria-label="Comparison floor" hidden></select></div><div id="cad-tour-controls" class="cad-tour-status" hidden><button id="tour-prev" aria-label="Previous room">‹</button><button id="tour-pause">Pause</button><button id="tour-next" aria-label="Next room">›</button><span id="tour-position" role="status" aria-live="polite"></span><button id="tour-stop">Stop</button></div>';
 $('#ptop').append(actions);
 const panel=document.createElement('section');panel.className='cad-diff-panel';panel.hidden=true;panel.setAttribute('aria-label','Seating changes');$('#mode').before(panel);
 const baseline=$('#cad-baseline');baseline.replaceChildren(...entry.variants.map(v=>new Option(label(v),v.id)));const requestedBase=new URLSearchParams(location.search).get('baseline');if(entry.variants.some(v=>v.id===requestedBase))baseline.value=requestedBase;
 let nav=null;
 let catalog=null,data=null,current=null,number=0,compare=false,request=0,tour=null,tourFrame=0,firstPlan=true;
 const catalogReady=fetch('/media/flipkart-andheri/cad/comparisons/'+encodeURIComponent(property)+'.json').then(r=>r.ok?r.json():null).then(j=>{catalog=j;$('#compare-seats').hidden=!j;return j;}).catch(()=>{$('#compare-seats').hidden=true;return null;});
 function clearDiff(){document.querySelector('#seat-differences')?.remove();}
 function normalDesks(){clearDiff();const desks=cataloguePlan(current?.id)?.desks;if(!desks||compare)return;const g=shape('g',{id:'seat-differences','pointer-events':'none'},$('#svg'));for(const d of desks)shape('path',{d:poly(d),fill:'#129d93','fill-opacity':.25,stroke:'#087f79','stroke-width':.65,'vector-effect':'non-scaling-stroke'},g);}
 function stopTour(){document.body.classList.remove('cad-review-touring');if(tourFrame)cancelAnimationFrame(tourFrame);tourFrame=0;tour=null;$('#cad-tour-controls').hidden=true;$('#plan-trace').setAttribute('aria-pressed','false');$('#plan-trace').textContent='2D route';document.querySelector('#plan-tour')?.remove();selectPlanReviewItem(null);}
 function setCompare(value){compare=value;stopTour();document.body.classList.toggle('cad-review-comparing',compare);$('#compare-seats').setAttribute('aria-pressed',String(compare));$('#cad-comparison-controls').hidden=!compare;panel.hidden=!compare;const url=new URL(location.href);if(compare)url.searchParams.set("compare","1");else url.searchParams.delete("compare");history.replaceState(null,"",url);if(compare)drawDiff();else normalDesks();}
 function cataloguePlan(id){return catalog?.variants.find(v=>v.id===id)?.plans[number];}
 async function drawDiff(){
  const own=++request;await catalogReady;if(own!==request||!compare||!catalog)return;
  const a=cataloguePlan(baseline.value),b=cataloguePlan(current.id);if(!a||!b){panel.textContent='No matching floor is supplied for this comparison.';return;}
  clearDiff();const diff=layoutDifference(a.desks,b.desks,catalog.matching_tolerance_m||.001,property),groups=changeClusters(diff.added);
  const g=shape('g',{id:'seat-differences','pointer-events':'none'},$('#svg'));
  for(const [key,cls]of [['unchanged','seat-unchanged'],['adjusted','seat-adjusted'],['removed','seat-removed'],['added','seat-added']])for(const d of diff[key])shape('path',{d:poly(d),class:cls},g);
  const same=current.id===baseline.value,from=entry.variants.find(v=>v.id===baseline.value),headline=same?'Base layout':diff.net===0?'Same seat count':(diff.net>0?'+':'')+diff.net+(property==='723-avenue'?' CAD desks':' seats');
  const floorPicker=$('#cad-review-floor');floorPicker.hidden=current.plans.length<2;floorPicker.replaceChildren(...current.plans.map((p,i)=>new Option(p.name,String(i))));floorPicker.value=String(number);floorPicker.onchange=()=>onDrawing(Number(floorPicker.value));
  panel.innerHTML='<h3>'+safe(a.name)+' · '+safe(a.desks.length)+' → '+safe(b.desks.length)+'</h3><span class="net">'+headline+'</span><p>'+(same?'Base configuration. Choose another option to reveal the additional desks.':diff.net===0&&!diff.added.length&&!diff.removed.length?(diff.adjusted.length?diff.adjusted.length+' desk positions shift by up to 12 cm.':'The desk positions match on this floor.'):diff.added.length+' added desk positions'+(diff.removed.length?' · '+diff.removed.length+' removed positions':(diff.adjusted.length?' · '+diff.adjusted.length+' slightly repositioned.':'. Every existing desk stays in place.')))+'</p><div class="diff-counts"><span><b>'+diff.unchanged.length+'</b>Unchanged</span><span><b>'+diff.added.length+'</b>Added</span>'+(diff.removed.length?'<span><b>'+diff.removed.length+'</b>Removed</span>':'')+'</div><button class="diff-focus" id="diff-all">Show the whole floor</button>';
  groups.forEach((group,i)=>{
   const b=deskBounds(group),cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
   shape('circle',{cx,cy:-cy,r:.48,fill:'#006f62',stroke:'white','stroke-width':1.5,'vector-effect':'non-scaling-stroke'},g);const t=shape('text',{x:cx,y:-cy,class:'cad-cluster-number'},g);t.textContent=i+1;
   const button=document.createElement('button');button.className='diff-focus';button.textContent='Area '+(i+1)+' · '+group.length+' added seats ↗';button.onclick=()=>focusPlanBounds(b,1.6);panel.append(button);
  });
  const note=document.createElement('p');note.className='diff-notes';note.textContent='Teal: added · Grey: unchanged · Dashed amber: removed · Purple: repositioned. Exact CAD desktop footprints; no seat identities inferred.';panel.append(note);
  const notes=[...new Set([from.count_note,current.count_note].filter(Boolean))];for(const text of notes.filter(n=>!notes.some(other=>other!==n&&other.includes(n)))){const node=document.createElement('p');node.className='diff-notes count-review';node.textContent=text;panel.append(node);}
  $('#diff-all').onclick=()=>focusPlanBounds(data.bounds,1.07);
  if(diff.net===0&&!same&&!diff.added.length&&!diff.removed.length){const next=current.plans.findIndex((p,i)=>catalog.variants.find(v=>v.id===current.id)?.plans[i]?.desks.length!==catalog.variants.find(v=>v.id===baseline.value)?.plans[i]?.desks.length);if(next>=0){const button=document.createElement('button');button.className='diff-focus';button.textContent='See seat gains on '+current.plans[next].name+' ↗';button.onclick=()=>onDrawing(next);panel.append(button);}}
  const previous=entry.variants[entry.variants.findIndex(v=>v.id===current.id)-1];if(previous&&previous.id!==baseline.value){const button=document.createElement('button');button.className='diff-focus';button.textContent='Compare with '+previous.seats+' seats';button.onclick=()=>{baseline.value=previous.id;drawDiff();};panel.append(button);}
  const url=new URL(location.href);url.searchParams.set('baseline',baseline.value);history.replaceState(null,'',url);
  $('#cad-comparison-controls .cad-options').replaceChildren(...entry.variants.map(v=>{const button=document.createElement('button');button.setAttribute('aria-pressed',String(v.id===current.id));const item=cataloguePlan(v.id),net=(item?.desks.length||0)-a.desks.length;button.innerHTML='<b>'+safe(v.seats)+'</b><small>'+(v.id===baseline.value?'Base':(net>=0?'+':'')+net+' seats')+'</small>';button.onclick=()=>onVariant(v.id);return button;}));
  if (!same) {
    const previousPlan=from.plans[number];
    const previous=await loadPlan(previousPlan.id,'/media/flipkart-andheri/cad/'+previousPlan.file);
    if(own!==request||!compare)return;
    for(const layer of ['walls','glass','doors']){
      const strokes=plan=>new Set((plan.cad?.[layer]||'').match(/M[^M]+/g)||[]);
      const before=strokes(previous),after=strokes(data);
      for(const [source,other,cls] of [[before,after,'outline-before'],[after,before,'outline-after']]){
        const paths=[...source].filter(p=>!other.has(p));
        if(paths.length)shape('path',{d:paths.join(''),class:cls},g);
      }
    }
    if(g.querySelector('.outline-before,.outline-after'))note.textContent+=' Changed partitions and openings are traced in blue (selected) and dashed amber (baseline).';
  }
  const counter=$('#foot');counter.textContent=property==='privilon'&&current.seats===301?'Highest option: 301 desks drawn in the supplied DWG.':'Comparing exact CAD desk positions on the same floor.';
 }
 $('#compare-seats').onclick=async()=>{await catalogReady;const open=!compare;setCompare(open);if(open&&current.id===baseline.value&&entry.variants.length>1)onVariant(entry.variants[1].id);};baseline.onchange=drawDiff;
 function tourStops(){
  const points=planReviewItems().filter(z=>z.label&&Number.isFinite(z.label[0])&&Number.isFinite(z.label[1]));
  const ordered=[{id:null,name:nav.map.title,label:nav.map.start}];let left=points.slice();const nearest=p=>left.sort((a,b)=>Math.hypot(a.label[0]-p[0],a.label[1]-p[1])-Math.hypot(b.label[0]-p[0],b.label[1]-p[1]))[0];let last=nearest(nav.map.start);
  while(last){ordered.push(last);left=left.filter(z=>z.id!==last.id);const p=last.label;last=left.sort((a,b)=>Math.hypot(a.label[0]-p[0],a.label[1]-p[1])-Math.hypot(b.label[0]-p[0],b.label[1]-p[1]))[0];}
  return ordered;
 }
 function visit(index){if(!tour)return;index=Math.max(0,Math.min(tour.stops.length-1,index));tour.previous=tour.point||tour.stops[index].label;tour.index=index;tour.started=performance.now();tour.leg=nav.route(tour.previous,tour.stops[index].label);tour.trip=prepareTrip(tour.leg);selectPlanReviewItem(tour.stops[index].id);tour.selected=true;$('#tour-position').innerHTML=safe(index+1)+' / '+tour.stops.length+' · '+safe(tour.stops[index].name)+'<small>From the lift lobby</small>';}
 function travelTime(trip){return matchMedia('(prefers-reduced-motion:reduce)').matches?0:Math.min(10000,trip.length*350);}
 function tick(now){
  tourFrame=0;if(!tour||tour.paused)return;
  const t=tour,stop=t.stops[t.index],elapsed=now-t.started,travel=travelTime(t.trip);
  const k=travel?Math.max(0,Math.min(1,elapsed/travel)):1;
  const [x,y]=t.trip.at(t.trip.length*k);
  t.point=[x,y];t.dot.setAttribute('cx',x);t.dot.setAttribute('cy',-y);t.halo.setAttribute('cx',x);t.halo.setAttribute('cy',-y);
  if(!t.lastFollow||now-t.lastFollow>70){focusPlanBounds([x-5,y-4.2,x+5,y+4.2]);t.lastFollow=now;}
  const traveled=t.trip.length*k;const pts=[...t.leg.filter((_,i)=>t.trip.lengths[i]<traveled),[x,y]];t.path.setAttribute('d',pts.map((p,i)=>(i?'L':'M')+p[0]+','+(-p[1])).join(''));
  if(k===1&&!t.selected){selectPlanReviewItem(stop.id);t.selected=true;}
  if(elapsed>travel+2800){if(t.index===t.stops.length-1){t.paused=true;$('#tour-pause').textContent='Replay';$('#tour-position').textContent='Tour complete · '+t.stops.length+' spaces';return;}visit(t.index+1);}
  tourFrame=requestAnimationFrame(tick);
 }
 function startTour(){if(!nav)return;setCompare(false);stopTour();document.body.classList.add('cad-review-touring');const stops=tourStops();if(!stops.length)return;focusPlanBounds([nav.map.start[0]-5,nav.map.start[1]-4,nav.map.start[0]+5,nav.map.start[1]+4]);const g=shape('g',{id:'plan-tour','pointer-events':'none'},$('#svg'));tour={stops,index:0,paused:false,path:shape('path',{class:'cad-tour-line'},g),halo:shape('circle',{r:.7,class:'cad-tour-halo'},g),dot:shape('circle',{r:.18,class:'cad-tour-dot'},g)};$('#cad-tour-controls').hidden=false;$('#plan-trace').setAttribute('aria-pressed','true');$('#plan-trace').textContent='Tour running';$('#tour-pause').textContent='Pause';visit(0);tourFrame=requestAnimationFrame(tick);}
 $('#tour-start').onclick=()=>location.assign($('#walk-link').href+'&tour=1');$('#plan-trace').onclick=()=>tour?stopTour():startTour();$('#tour-stop').onclick=stopTour;
 $('#tour-pause').onclick=()=>{if(!tour)return;if($('#tour-pause').textContent==='Replay'){startTour();return;}tour.paused=!tour.paused;$('#tour-pause').textContent=tour.paused?'Resume':'Pause';if(tour.paused){tour.pausedAt=performance.now();cancelAnimationFrame(tourFrame);}else{tour.started+=performance.now()-tour.pausedAt;selectPlanReviewItem(tour.stops[tour.index].id);tourFrame=requestAnimationFrame(tick);}};
 const advance=step=>{if(!tour)return;visit(tour.index+step);if(tour.paused){tour.pausedAt=performance.now();tour.started=tour.pausedAt-travelTime(tour.trip);$('#tour-pause').textContent='Resume';selectPlanReviewItem(tour.stops[tour.index].id);tour.point=tour.trip.at(tour.trip.length);tour.previous=tour.point;focusPlanBounds([tour.point[0]-5,tour.point[1]-4,tour.point[0]+5,tour.point[1]+4]);tour.dot.setAttribute('cx',tour.point[0]);tour.dot.setAttribute('cy',-tour.point[1]);tour.halo.setAttribute('cx',tour.point[0]);tour.halo.setAttribute('cy',-tour.point[1]);tour.path.setAttribute('d','M'+tour.previous[0]+','+(-tour.previous[1])+'L'+tour.point[0]+','+(-tour.point[1]));}else if(!tourFrame)tourFrame=requestAnimationFrame(tick);};
 $('#tour-next').onclick=()=>advance(1);$('#tour-prev').onclick=()=>advance(-1);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&tour){event.preventDefault();event.stopImmediatePropagation();stopTour();}});
 function pauseForManual(){if(tour&&!tour.paused)$('#tour-pause').click();}
 $('#svgwrap').addEventListener('pointerdown',pauseForManual);$('#svgwrap').addEventListener('wheel',pauseForManual,{passive:true});$('#list').addEventListener('pointerdown',pauseForManual);$('#mode').addEventListener('pointerdown',pauseForManual);$('#zoom').addEventListener('pointerdown',pauseForManual);document.addEventListener('visibilitychange',()=>{if(document.hidden&&tour&&!tour.paused)$('#tour-pause').click();});
 return {cancelTour:stopTour,compareFrom(id){if(!catalog||!id)return;baseline.value=id;setCompare(true);},onPlan(plan,variant,drawingIndex){stopTour();data=plan;current=variant;number=drawingIndex;nav=null;$('#tour-start').disabled=true;fetch('/media/flipkart-andheri/cad/walks/'+plan.id+'.json').then(r=>r.ok?r.json():null).then(m=>{if(data===plan&&m?.source_sha256===plan.source.sha256){nav=floorNavigation(m);$('#tour-start').disabled=false;}}).catch(()=>{});clearDiff();if(firstPlan){firstPlan=false;if(new URLSearchParams(location.search).get('compare')==='1')setCompare(true);}if(compare)drawDiff();else catalogReady.then(()=>{if(data===plan&&!compare)normalDesks();});},get comparing(){return compare;}};
}
