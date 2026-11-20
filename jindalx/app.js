'use strict';
// Reuse the landlord presentation's floor-by-floor move-in infographic.
const occupiers = [
  {name:'Altruist',logo:'altruist.png',seats:100,label:'100',floor:2},
  {name:'ARCIL',logo:'arcil.png',seats:250,label:'250+',floor:2},
  {name:'Volt',logo:'volt.png',seats:100,label:'100+',floor:1},
  {name:'Paytm',logo:'paytm.svg',seats:400,label:'400+',floor:1}
];
const floors = document.getElementById('floors');
floors.innerHTML=[2,1].map(f=>`<div class="fl"><small>${f===2?'2nd':'1st'} floor</small><div class="floor-row">${occupiers.map((t,k)=>t.floor===f?`<div class="tenant" data-tenant="${k}" style="flex:${Math.max(t.seats,180)}"><div class="tenant-fill"></div><div class="tenant-logo"><img src="/landlord/assets/logos/${t.logo}" alt="${t.name}"></div></div>`:'').join('')}</div></div>`).join('');
document.getElementById('seq').innerHTML=occupiers.map((t,k)=>`<li><i>0${k+1}</i><div><b>${t.name}</b><span>${t.label} seats · ${t.floor===2?'2nd':'1st'} floor</span></div></li>`).join('');
const tenants=[...floors.querySelectorAll('.tenant')].sort((a,b)=>a.dataset.tenant-b.dataset.tenant);
const sequence=[...document.querySelectorAll('#seq li')];
const scrub=document.getElementById('move-scrub');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let animationFrame=0,userControlled=false;
function setMoveIn(value){
  let seats=0,count=0;
  occupiers.forEach((tenant,index)=>{
    const progress=Math.max(0,Math.min(1,value-index));
    seats+=tenant.seats*progress;
    const occupied=progress>=.6;
    count+=Number(occupied);
    tenants[index].querySelector('.tenant-fill').style.width=`${progress*100}%`;
    tenants[index].classList.toggle('on',occupied);
    sequence[index].classList.toggle('on',occupied);
  });
  document.getElementById('move-count').textContent=count;
  document.getElementById('occupied-seats').textContent=Math.round(seats);
  scrub.value=value;
  scrub.setAttribute('aria-valuetext',`${count} of 4 occupiers, ${Math.round(seats)} plus seats`);
}
function playMoveIns(){
  cancelAnimationFrame(animationFrame);
  if(reducedMotion.matches){setMoveIn(4);return;}
  setMoveIn(0);
  let started;
  const step=time=>{started??=time;const value=Math.min(4,(time-started)/5200*4);setMoveIn(value);if(value<4)animationFrame=requestAnimationFrame(step);};
  animationFrame=requestAnimationFrame(step);
}
scrub.addEventListener('input',()=>{userControlled=true;cancelAnimationFrame(animationFrame);setMoveIn(Number(scrub.value));});
scrub.addEventListener('pointerdown',()=>{userControlled=true;cancelAnimationFrame(animationFrame);});
document.getElementById('move-replay').addEventListener('click',()=>{userControlled=true;playMoveIns();});
setMoveIn(reducedMotion.matches?4:0);
const moveObserver=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){if(!userControlled)playMoveIns();moveObserver.disconnect();}},{threshold:.35});
moveObserver.observe(document.querySelector('.tower'));
const galleries={arcil:{title:'ARCIL · F1 Skymark, Noida',photos:[['skymark-lobby','Reception'],['skymark-floor','Workspace'],['skymark-conference','Conference room'],['skymark-meeting','Meeting room']]},digitide:{title:'Digitide · SS Plaza, Bengaluru',photos:[['ssplaza-floor','Open workstations'],['ssplaza-boardroom','Boardroom'],['ssplaza-discussion','Cafeteria'],['ssplaza-lounge','Manager cabin']]},foundever:{title:'Foundever · Rupa Solitaire, Navi Mumbai',photos:[['rupa-boardroom','Boardroom'],['rupa-rows','Workstations'],['rupa-atrium','Building atrium'],['rupa-floor','Workspace']]},altruist:{title:'Altruist · F1 Skymark, Noida',photos:[['altruist-workstations','Workstations'],['altruist-reception','Reception'],['altruist-cabin','Cabin'],['altruist-workstations-2','Workspace']]}};
const dialog=document.getElementById('gallery-dialog');let currentGallery,photoIndex=0;
function showPhoto(){const gallery=galleries[currentGallery];const [file,caption]=gallery.photos[photoIndex];document.getElementById('gallery-title').textContent=gallery.title;const image=document.getElementById('gallery-image');image.src='/landlord/assets/sites/'+file+'.jpg';image.alt=caption+' · '+gallery.title;document.getElementById('gallery-caption').textContent=caption+' · Built workspace photograph';document.getElementById('gallery-count').textContent=`${photoIndex+1} / ${gallery.photos.length}`;document.getElementById('gallery-prev').disabled=photoIndex===0;document.getElementById('gallery-next').disabled=photoIndex===gallery.photos.length-1;}
document.querySelectorAll('[data-gallery]').forEach(button=>button.addEventListener('click',()=>{currentGallery=button.dataset.gallery;photoIndex=0;showPhoto();dialog.showModal();}));
document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
document.getElementById('gallery-prev').addEventListener('click',()=>{if(photoIndex>0){photoIndex--;showPhoto();}});
document.getElementById('gallery-next').addEventListener('click',()=>{if(photoIndex<galleries[currentGallery].photos.length-1){photoIndex++;showPhoto();}});
dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')document.getElementById('gallery-prev').click();if(e.key==='ArrowRight')document.getElementById('gallery-next').click();});
const sectionObserver = new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)document.querySelectorAll('.topbar nav a').forEach(a=>{const selected=a.hash==='#'+entry.target.id;a.classList.toggle('active',selected);if(selected)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}),{rootMargin:'-20% 0px -55% 0px'});
document.querySelectorAll('main section[id]').forEach(s=>sectionObserver.observe(s));
