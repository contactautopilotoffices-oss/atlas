import {applyAndheriTheme,easyTabs} from './andheri-ui.js';
import {worldReturn} from './andheri-navigation.js';
import {loadShortlist,CAD_BASE} from './andheri-data.js';
import {loadPlan,openPlan} from '/airoli-rtp/demo/js/plan.js';
const query=new URLSearchParams(location.search);
const property=query.get('property');
const back=()=>location.assign(worldReturn(property,query));
applyAndheriTheme('cad');
easyTabs(document.querySelector('#mode'),{tabs:true,panel:document.querySelector('#list')});
try{
  const entry=await loadShortlist(property);
  const variant=entry.variants.find(v=>v.id===query.get('variant'))||entry.variants[0];
  const plan=variant.plans[Number(query.get('drawing'))]||variant.plans[0];
  const data=await loadPlan(plan.id,CAD_BASE+plan.file);
  data.title=entry.name+' · '+plan.name+' · '+data.totals.work_seats+' workstations';
  document.querySelector('.plan-eyebrow').textContent='Autopilot · Flipkart';
  document.title=data.title;
  await openPlan(plan.id,back);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const comments=document.createElement('section');comments.id='all-comments';comments.hidden=true;document.querySelector('#plan').append(comments);
  const commentsButton=document.createElement('button');commentsButton.className='comments-button';commentsButton.type='button';commentsButton.textContent='◉ Comments';document.querySelector('#ptop').append(commentsButton);
  async function loadComments(roomId){const r=await fetch(`/api/cms?r=layout-feedback&property=${encodeURIComponent(property)}&variant=${encodeURIComponent(variant.id)}${roomId?'&roomId='+encodeURIComponent(roomId):''}`);const d=await r.json();return d.comments||[];}
  commentsButton.onclick=async()=>{comments.hidden=!comments.hidden;if(!comments.hidden){const rows=await loadComments();comments.innerHTML=rows.length?rows.map(c=>`<article><b>${esc(c.room)}</b><span>${esc(c.name)} · ${new Date(c.createdAt).toLocaleString()}</span><p>${esc(c.note)}</p></article>`).join(''):'<p>No saved comments for this layout.</p>'}};
  document.addEventListener('atlas-room-selected',({detail:room})=>{
    const form=document.createElement('form');
    form.className='room-feedback';
    form.innerHTML='<details><summary>Give design feedback</summary><label>Your name<input name="reviewer" autocomplete="name" required maxlength="100"></label><textarea required maxlength="2000" aria-label="Feedback for the design team" placeholder="What would you change in this space?"></textarea><button>Send feedback</button><output role="status"></output></details>';
    document.querySelector('#sel').append(form);
    const roomComments=document.createElement('div');roomComments.className='room-comments';form.append(roomComments);
    loadComments(room.id).then(rows=>{roomComments.innerHTML=rows.length?rows.map(c=>`<article><b>${esc(c.name)}</b><time>${new Date(c.createdAt).toLocaleString()}</time><p>${esc(c.note)}</p></article>`).join(''):'<p>No saved comments for this room.</p>'});
    form.elements.reviewer.value=sessionStorage.getItem('atlas-reviewer-name')||'';
    form.onsubmit=async event=>{
      event.preventDefault();
      const field=form.querySelector('textarea'),button=form.querySelector('button'),status=form.querySelector('output');
      const reviewer=form.elements.reviewer.value.trim();
      if(!reviewer||!field.value.trim()){status.textContent='Enter your name and feedback.';return;}
      button.disabled=true;
      try{
        const response=await fetch('/api/cms?r=layout-feedback',{method:'POST',headers:{'Content-Type':'application/json','x-cms':'1'},body:JSON.stringify({reviewer,property,variant:variant.id,floor:plan.name,room:room.name,roomId:room.id,note:field.value.trim()})});
        if(!response.ok||!(await response.json()).saved)throw Error();
        sessionStorage.setItem('atlas-reviewer-name',reviewer);field.value='';status.textContent='Saved to the design review log.';loadComments(room.id).then(rows=>{roomComments.innerHTML=rows.map(c=>`<article><b>${esc(c.name)}</b><time>${new Date(c.createdAt).toLocaleString()}</time><p>${esc(c.note)}</p></article>`).join('')});
      }catch{status.textContent='Could not send. Your note is here to retry.';}
      finally{button.disabled=false;}
    };
  });
}catch(e){document.querySelector('#error-msg').textContent=e.message;document.querySelector('#error').hidden=false;document.querySelector('#error a').href=worldReturn(property,query);}
