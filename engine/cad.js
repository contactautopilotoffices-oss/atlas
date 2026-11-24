import {enableLocalDesignPreview} from './design-preview.js';
import {createRoomDesignGallery} from './room-design-gallery.js';
import {applyAndheriTheme,easyTabs} from './andheri-ui.js';
import {worldReturn,drawingHref} from './andheri-navigation.js';
import {loadShortlist,CAD_BASE} from './andheri-data.js';
import {loadPlan,openPlan,selectPlanReviewItem} from '/airoli-rtp/demo/js/plan.js';
const query=new URLSearchParams(location.search);
const property=query.get('property');
const back=()=>location.assign(worldReturn(property,query));
applyAndheriTheme('cad');
easyTabs(document.querySelector('#mode'),{tabs:true,panel:document.querySelector('#list')});
try{
  await enableLocalDesignPreview(query);
  const entry=await loadShortlist(property);
  const variant=entry.variants.find(v=>v.id===query.get('variant'))||entry.variants[0];
  const plan=variant.plans[Number(query.get('drawing'))]||variant.plans[0];
  const data=await loadPlan(plan.id,CAD_BASE+plan.file);
  data.title=entry.name+' · '+plan.name+' · '+data.totals.work_seats+' workstations';
  document.querySelector('.plan-eyebrow').textContent='Autopilot · Flipkart';
  document.title=data.title;
  await openPlan(plan.id,back);
  const designGallery=createRoomDesignGallery();
  const summaryLink=document.createElement('a');summaryLink.textContent='Preview selected rooms →';summaryLink.href='/engine/design-summary.html?'+new URLSearchParams({property,returnTo:location.pathname+location.search});summaryLink.className='comments-button';document.querySelector('#ptop').append(summaryLink);
  const rooms=document.createElement('details');rooms.className='design-room-list';const heading=document.createElement('summary');heading.textContent='Choose a room to design';rooms.append(heading);
  for(const room of [...data.zones,...(data.others||[])]){const b=document.createElement('button');b.type='button';b.textContent=room.name;b.onclick=()=>designGallery.open(room,{property,plan:plan.id,source_sha256:data.source.sha256},b);rooms.append(b);}document.querySelector('#plan').append(rooms);

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const comments=document.createElement('section');comments.id='all-comments';comments.hidden=true;document.querySelector('#plan').append(comments);
  const commentsButton=document.createElement('button');commentsButton.className='comments-button';commentsButton.type='button';commentsButton.textContent='◉ Comments';document.querySelector('#ptop').append(commentsButton);
  const noteKey='atlas-layout-notes';
  const loadComments=(roomId)=>JSON.parse(localStorage.getItem(noteKey)||'[]').filter(c=>c.property===property&&c.variant===variant.id&&(!roomId||c.roomId===roomId));
  const renderComments=(rows,empty='No comments on this layout yet.')=>rows.length?rows.map(c=>`<button type="button" class="note-item" data-room-id="${esc(c.roomId)}"><b>${esc(c.room)}</b><span>${esc(c.name||'Note')} · ${new Date(c.createdAt).toLocaleString()}</span><p>${esc(c.note)}</p></button>`).join(''):'<p>'+empty+'</p>';
  commentsButton.onclick=()=>{comments.hidden=!comments.hidden;if(!comments.hidden){comments.innerHTML=renderComments(loadComments());comments.querySelectorAll('.note-item').forEach(item=>item.onclick=()=>{selectPlanReviewItem(item.dataset.roomId);comments.hidden=true})}};
  document.addEventListener('atlas-room-selected',({detail:room})=>{
    const sourceRoom=[...data.zones,...(data.others||[])].find(z=>z.id===room.id||(z.source_handle&&z.source_handle===room.source_handle));
    if(sourceRoom){const next=new URL(drawingHref('interior',property,variant.id,Number(query.get('drawing'))||0,worldReturn(property,query)),location.origin);next.searchParams.set('room',sourceRoom.id);const open=()=>designGallery.open(sourceRoom,{property,plan:plan.id,source_sha256:data.source.sha256,previewHref:next.pathname+next.search},document.activeElement);const reopen=document.createElement('button');reopen.type='button';reopen.className='room-design-reopen';reopen.textContent='View design references';reopen.onclick=open;document.querySelector('#sel').append(reopen);open();}
    const form=document.createElement('form');
    form.className='room-feedback';
    form.innerHTML='<details><summary>Comment on this room</summary><label>Your name<input name="reviewer" autocomplete="name" required maxlength="100"></label><textarea required maxlength="2000" aria-label="Comment on this room" placeholder="Comment on this room"></textarea><button>Save comment</button><output role="status"></output></details>';
    document.querySelector('#sel').append(form);
    const roomComments=document.createElement('div');roomComments.className='room-comments';form.append(roomComments);
    roomComments.innerHTML=renderComments(loadComments(room.id),'No comments on this room yet.');
    form.elements.reviewer.value=sessionStorage.getItem('atlas-reviewer-name')||'';
    form.onsubmit=async event=>{
      event.preventDefault();
      const field=form.querySelector('textarea'),button=form.querySelector('button'),status=form.querySelector('output');
      const reviewer=form.elements.reviewer.value.trim();
      if(!reviewer||!field.value.trim()){status.textContent='Add your name and comment first.';return;}
      const rows=JSON.parse(localStorage.getItem(noteKey)||'[]');rows.unshift({property,variant:variant.id,floor:plan.name,room:room.name,roomId:room.id,name:reviewer,note:field.value.trim(),createdAt:new Date().toISOString()});localStorage.setItem(noteKey,JSON.stringify(rows));field.value='';status.textContent='Saved on this device.';roomComments.innerHTML=renderComments(loadComments(room.id),'No comments on this room yet.');
    };
  });
}catch(e){document.querySelector('#error-msg').textContent=e.message;document.querySelector('#error').hidden=false;document.querySelector('#error a').href=worldReturn(property,query);}
