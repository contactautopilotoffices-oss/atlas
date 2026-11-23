import {currentWorldReturn,drawingHref} from './andheri-navigation.js';
export function createWorldLayouts(){
 const link=document.querySelector('#cad-link');if(!link)return {select(){}};
 const menu=document.createElement('details');menu.id='world-layout-menu';menu.hidden=true;menu.innerHTML='<summary>Open a CAD layout</summary><div><select aria-label="Layout configuration"></select><select aria-label="Drawing floor"></select><a>Open 2D CAD ↗</a></div>';link.after(menu);
 const select=menu.querySelectorAll('select'),open=menu.querySelector('a');let property=null,entry=null,floor=null;
 const loaded=fetch('/media/flipkart-andheri/cad/manifest.json').then(r=>{if(!r.ok)throw Error('Layouts unavailable');return r.json();}).catch(()=>null);
 function urls(){if(!entry)return;const v=entry.variants.find(v=>v.id===select[0].value)||entry.variants[0],i=Number(select[1].value)||0,back=currentWorldReturn(property);open.href=drawingHref('cad',property,v.id,i,back);link.textContent='Explore floor plans →';link.href=open.href;link.hidden=false;}
 function drawings(){const v=entry.variants.find(v=>v.id===select[0].value)||entry.variants[0];select[1].replaceChildren(...v.plans.map((p,i)=>new Option(p.name,String(i))));select[1].hidden=v.plans.length<2;const match=v.plans.findIndex(p=>p.floor_level===floor);if(match>=0)select[1].value=match;else if(['723-avenue','corporate-avenue'].includes(property))select[1].value='1';urls();}
 select[0].onchange=drawings;select[1].onchange=urls;
 document.querySelector('#floors')?.addEventListener('click',e=>{const n=e.target.closest('[data-n]');if(!n||!entry)return;floor=Number(n.dataset.n);drawings();});
 return {async select(id){property=id;const own=id,data=await loaded;if(own!==property)return;entry=data?.properties[id];menu.hidden=!entry;if(!entry){link.hidden=true;return;}select[0].replaceChildren(...entry.variants.map(v=>new Option(v.label||v.seats+' workstations',v.id)));if(entry.variants[1])select[0].value=entry.variants[1].id;drawings();}};
}
