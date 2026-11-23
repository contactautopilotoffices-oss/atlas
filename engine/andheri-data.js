import {worldReturn} from './andheri-navigation.js';
export const CAD_BASE='/media/flipkart-andheri/cad/';
export const PROPERTY_IDS=['723-avenue','corporate-avenue','privilon'];
export async function loadShortlist(property) {
  if(!PROPERTY_IDS.includes(property))throw new Error('Choose one of the three shortlisted properties.');
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/engine/atlases/flipkart-andheri.js';s.onload=resolve;s.onerror=()=>reject(new Error('Property access could not load.'));document.head.appendChild(s);});
  const A=window.ATLAS;
  if(A?.gate?.hash && sessionStorage.getItem('flipkart-andheri-auth')!=='1') {
    location.replace(worldReturn(property));
    return null;
  }
  const r=await fetch(CAD_BASE+'manifest.json');if(!r.ok)throw new Error('Drawings could not load.');
  const m=await r.json();const e=m.properties[property];
  if(!e?.variants?.length)throw new Error('A CAD drawing has not been supplied for this property.');
  return e;
}
