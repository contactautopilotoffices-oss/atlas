const PROJECT='flipkart-andheri';
const sessionKey=(context)=>'atlas-design:'+PROJECT+':'+context.plan+':'+context.room_id;
const $=(s,root=document)=>root.querySelector(s);
const el=(tag,props={},children=[])=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(props)){if(k==='text')n.textContent=v;else if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else n.setAttribute(k,v);}n.append(...children);return n;};
const button=(text,click,props={})=>el('button',{type:'button',text,onclick:click,...props});
const blank=()=>({session_id:crypto.randomUUID(),base_revision:0,stage:'explored',tier:'Premium Economy',selections:[],comments:'',camera:null,parent_result_id:null});
export function createDesignGallery({snapshot,view}){
 let context=null,room=null,options=[blank(),blank()],active=0,refs=[],selected=null,request=0,saving=false,dirty=false,jobTimer=null,workerReady=false,renderSubmitting=false,nativeAvailable=false,higgsfieldReady=false,higgsfieldSetup='Higgsfield visualization awaits secure provider setup.';
 const panel=el('section',{class:'atlas-gallery atlas-gallery-room',hidden:'','aria-label':'Room design gallery'});
 const title=el('h2',{text:'Select a room'}),metrics=el('div',{class:'atlas-gallery-stats'}),basis=el('p',{class:'gallery-caption'}),note=el('p',{class:'gallery-caption',text:'Reference choices guide a proposed design. The measured room stays unchanged.'});
 const status=el('p',{class:'atlas-gallery-status',role:'status','aria-live':'polite'});
 const tabs=el('div',{class:'atlas-gallery-options','aria-label':'Design alternatives'});
 const optionButtons=[0,1].map(i=>button('Option '+(i+1),()=>switchOption(i),{'aria-pressed':String(i===active)}));tabs.append(...optionButtons);
 const tier=el('select',{'aria-label':'Offering tier'},['Premium Economy','Premium'].map(t=>el('option',{value:t,text:t})));
 const stage=el('select',{'aria-label':'Decision stage'},[['explored','Explored'],['shortlisted','Shortlisted'],['client-approved','Client-approved inspiration']].map(([value,text])=>el('option',{value,text})));
 const comments=el('textarea',{'aria-label':'Design comments',placeholder:'What should this option achieve?',rows:'2'});
 const detail=el('div',{class:'atlas-gallery-detail'});
 const strip=el('nav',{class:'atlas-gallery atlas-gallery-strip',hidden:'','aria-label':'Room-compatible design references'});
 const count=el('span',{class:'gallery-caption'});
 const rail=el('div',{class:'gallery-reference-rail',tabindex:'0','aria-label':'Reference thumbnails'});
 const toggle=button('Design gallery',()=>{if(!context){status.textContent='Choose a room from Explore spaces first.';panel.hidden=false;}else show(!panel.hidden?false:true);},{id:'design-gallery-toggle','aria-expanded':'false'});
 const close=button('×',()=>show(false),{'aria-label':'Close design gallery',class:'gallery-close'});
 const views=el('div',{class:'gallery-views'},[button('Room view',()=>{if(view('room')===false)status.textContent='Room angles await a verified enclosure. Use the CAD focus or dollhouse view.';}),button('Other angle',()=>{if(view('reverse')===false)status.textContent='Room angles await a verified enclosure. Use the CAD focus or dollhouse view.';}),button('Dollhouse',()=>view('overview'))]);
 const saveButton=button('Save option',save),handoffButton=button('Designer handoff',handoff),renderButton=button('Render design',render,{'aria-describedby':'gallery-render-note'});
 const renderNote=el('p',{id:'gallery-render-note',class:'gallery-caption',text:'Checking native rendering availability…'});renderButton.disabled=true;
 const resultDetails=el('details',{class:'gallery-results'},[el('summary',{text:'Results & revisions'}),el('div',{class:'gallery-result-list'})]);
 const designerLink=el('a',{href:'/engine/design-review.html',text:'Designer tools',hidden:''});
 const collapse=button('Room details',()=>{const collapsed=panel.classList.toggle('gallery-compact');collapse.setAttribute('aria-expanded',String(!collapsed));},{'aria-expanded':'true',class:'gallery-collapse'});
 panel.append(el('div',{class:'gallery-eyebrow',text:'DESIGN YOUR WORKSPACE'}),close,title,metrics,basis,tabs,collapse,el('div',{class:'gallery-room-body'},[views,el('label',{text:'Offering'},[tier]),el('label',{text:'Decision'},[stage]),comments,detail,note,el('div',{class:'atlas-gallery-actions'},[saveButton,handoffButton,renderButton]),renderNote,resultDetails,designerLink,status]));
 strip.append(el('div',{class:'gallery-strip-heading'},[el('strong',{text:'Borrow the details'}),count,button('←',()=>rail.scrollBy({left:-300,behavior:'smooth'}),{'aria-label':'Previous references'}),button('→',()=>rail.scrollBy({left:300,behavior:'smooth'}),{'aria-label':'Next references'})]),rail);
 document.body.append(panel,strip);$('#tools').append(toggle);
 const apiURL=(route,extra={})=>'/api/design?'+new URLSearchParams({project:PROJECT,r:route,...extra});
 async function api(route,extra={},data){const r=await fetch(apiURL(route,extra),{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json','x-atlas-design':'1'}:{},body:data?JSON.stringify(data):undefined});const j=await r.json().catch(()=>({error:'Start the CMS development server to use the design library.'}));if(!r.ok)throw Object.assign(Error(j.error||'Design service unavailable.'),{status:r.status});return j;}
 function show(open){if(open&&matchMedia('(max-width:600px)').matches){panel.classList.add('gallery-compact');collapse.setAttribute('aria-expanded','false');}panel.hidden=!open;strip.hidden=!open||!context;document.body.toggleAttribute('data-gallery-open',open);toggle.setAttribute('aria-expanded',String(open));if(!open)toggle.focus();}
 function changed(){dirty=true;options[active].dirty=true;options[active].camera=snapshot()?.camera||null;status.textContent='Unsaved changes';}
 function persistFields(){options[active].comments=comments.value;options[active].stage=stage.value;}
 function switchOption(index){persistFields();active=index;selected=null;sync();loadReferences();loadJobs();}
 function sync(){const o=options[active];tier.value=o.tier;stage.value=o.stage;comments.value=o.comments;optionButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===active)));detail.replaceChildren(el('p',{class:'gallery-caption',text:'Choose a reference below, then specify the features to borrow. These are inspirations, not renders of this room.'}));status.textContent=o.base_revision?'Saved revision '+o.base_revision:'Draft option · not yet saved';refreshCapabilities();}
 tier.onchange=()=>{persistFields();const o=options[active];if(o.selections.length&&!confirm('Changing offering clears this option’s reference choices. Continue?')){tier.value=o.tier;return;}o.tier=tier.value;o.tier_changed=true;o.selections=[];o.stage='explored';selected=null;changed();sync();loadReferences();};
 comments.oninput=changed;stage.onchange=changed;
 function imageURL(r){return apiURL('image',{id:r.id,room_type:context.room_type,tier:options[active].tier});}
 async function loadReferences(){
  const token=++request;rail.replaceChildren(el('p',{text:'Loading permitted room references…'}));rail.setAttribute('aria-busy','true');count.textContent=options[active].tier;
  try{const j=await api('references',{room_type:context.room_type,tier:options[active].tier});if(token!==request)return;refs=j.references;paintRail();}
  catch(e){if(token===request)rail.replaceChildren(el('p',{text:e.message}),button(e.status===401?'Sign in to this project':'Retry',e.status===401?signIn:loadReferences));}
  finally{if(token===request)rail.removeAttribute('aria-busy');}
 }
 function signIn(){
  const dialog=el('dialog',{class:'atlas-gallery atlas-gallery-signin','aria-label':'Sign in to your design session'});
  const id=el('input',{type:'text',autocomplete:'username',required:'',name:'id','aria-label':'Atlas access ID'}),password=el('input',{type:'password',autocomplete:'current-password',required:'',name:'password','aria-label':'Atlas password'}),message=el('p',{role:'status'}),submit=el('button',{type:'submit',text:'Sign in'});
  const form=el('form',{},[el('h2',{text:'Your design session'}),el('p',{text:'Use the Atlas access ID and password issued for this project.'}),el('label',{text:'Access ID'},[id]),el('label',{text:'Password'},[password]),submit,message]);
  form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;message.textContent='Signing in…';try{const r=await fetch('/api/cms?r=access',{method:'POST',headers:{'Content-Type':'application/json','x-cms':'1'},body:JSON.stringify({id:id.value,password:password.value})}),j=await r.json();if(!r.ok)throw Error(j.error||'Sign-in failed.');if(j.slug!==PROJECT)throw Error('This access ID opens a different project. Use the access issued for this gallery.');dialog.close();loadReferences();restoreSaved(context,options);}catch(e){message.textContent=e.message;}finally{submit.disabled=false;password.value='';}};
  dialog.append(button('Close',()=>dialog.close()),form);dialog.addEventListener('keydown',e=>e.stopPropagation());dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();id.focus();
 }
 function paintRail(){
  count.textContent=options[active].tier+' · '+refs.length+' references';
  if(!refs.length){rail.replaceChildren(el('p',{text:'No reviewed references for this room and offering yet. Try another supplied offering or ask your designer to review more sources.'}));return;}
  rail.replaceChildren(...refs.map((r,i)=>{
   const p=options[active].selections.find(p=>p.reference_id===r.id);
   const img=el('img',{src:imageURL(r),alt:r.title||'Source meeting-room reference',loading:'lazy'});
   img.onerror=()=>{img.hidden=true;};
   const b=button('',()=>selectReference(r),{class:'atlas-gallery-reference','aria-pressed':String(selected?.id===r.id),'aria-label':(r.title||'Reference '+(i+1))+(p?' · '+p.preference:'')});
   b.append(img,el('span',{text:r.title||'Reference '+(i+1)}),el('small',{text:p?`${p.preference==='like'?'✓ ':''}${p.preference} · ${p.features.length} features`:'Inspiration · designer review pending'}));return b;
  }));
 }
 function selectReference(r){
  selected=r;paintRail();
  const o=options[active];let choice=o.selections.find(p=>p.reference_id===r.id);
  if(!choice){choice={reference_id:r.id,preference:'neutral',features:[],comment:'',reason:''};o.selections.push(choice);changed();}
  const preference=el('select',{'aria-label':'Reference preference'},['neutral','like','dislike'].map(p=>el('option',{value:p,text:p==='like'?'Like':p==='dislike'?'Dislike':'Exploring'})));preference.value=choice.preference;preference.onchange=()=>{choice.preference=preference.value;changed();paintRail();};
  const features=[...new Set([...(r.interpretations?.selectable_features||[]),...(r.interpretations?.design_language||[]),...Object.values(r.interpretations?.palette||{}).flat(),...(r.interpretations?.materials_textures||[]),...(r.interpretations?.furniture||[]),...(r.interpretations?.lighting||[])])];
  const featureBox=el('div',{class:'gallery-features'},features.map(f=>{const input=el('input',{type:'checkbox'});input.checked=choice.features.includes(f);input.onchange=()=>{choice.features=input.checked?[...new Set([...choice.features,f])]:choice.features.filter(x=>x!==f);changed();paintRail();};return el('label',{},[input,document.createTextNode(f)]);}));
  const reason=el('textarea',{'aria-label':'Decision reason',rows:'2',placeholder:'Why use or avoid these details?'});reason.value=choice.reason;reason.oninput=()=>{choice.reason=reason.value;changed();};
  const comment=el('textarea',{'aria-label':'Reference comments',rows:'2',placeholder:'Changes or dislikes for this reference'});comment.value=choice.comment;comment.oninput=()=>{choice.comment=comment.value;changed();};
  const source=el('details',{},[el('summary',{text:'Source & unknowns'}),el('p',{text:r.source_path||r.source_id}),el('p',{text:r.source_member}),el('p',{text:'Slide: '+(r.occurrences||[]).map(x=>x.slide_member).join(', ')}),el('p',{text:Object.entries(r.facts||{}).map(([key,value])=>key+': '+(value||'Unknown')).join(' · ')}),el('p',{text:'Visual interpretation, not a material specification. Unknown: '+(r.unknowns||[]).join(', ')}),el('p',{text:'Review: '+(r.human_review?'human review by '+r.human_review.reviewer_name:(r.review?.scope||r.review_status)+' · human review pending')})]);
  const inspect=button('Inspect image',()=>{const dialog=el('dialog',{class:'atlas-gallery atlas-gallery-image'});const exit=button('Close image',()=>dialog.close());dialog.append(exit,el('img',{src:imageURL(r),alt:r.title}),el('p',{text:r.title}));dialog.addEventListener('close',()=>{dialog.remove();inspect.focus();});dialog.addEventListener('keydown',e=>e.stopPropagation());document.body.append(dialog);dialog.showModal();exit.focus();});
  detail.replaceChildren(el('h3',{text:r.title}),inspect,preference,el('p',{class:'gallery-caption',text:'Borrow specific visible features'}),featureBox,reason,comment,source);
 }
 async function restoreSaved(selectedContext,selectedOptions){
  if(selectedOptions.some(x=>x.base_revision||x.selections.length))return;
  let ids;try{ids=JSON.parse(localStorage.getItem(sessionKey(selectedContext))||'null');}catch{}
  if(!Array.isArray(ids)||ids.length!==2){try{const result=await api('sessions',{plan:selectedContext.plan,room_id:selectedContext.room_id});ids=[1,2].map(n=>result.sessions.find(s=>s.option_number===n)?.session_id||null);}catch{return;}}
  for(let i=0;i<2;i++){
   if(!ids[i])continue;
   try{const result=await api('session',{session:ids[i]});const event=result.events.at(-1);if(!event||selectedOptions[i].selections.length||selectedOptions[i].dirty||selectedOptions[i].base_revision)continue;
    selectedOptions[i]={...selectedOptions[i],...event.state,session_id:ids[i],base_revision:event.revision,event_id:event.id};
   }catch{/* IDs contain no content and never grant permission; a different user sees a fresh draft. */}
  }
  if(context===selectedContext&&options===selectedOptions){sync();loadReferences();loadJobs();}
 }
 async function save(){
  if(!context||saving)return false;persistFields();const index=active,o=options[index],saveContext=context,saveOptions=options;o.camera=snapshot()?.camera||o.camera;
  saving=true;saveButton.disabled=true;status.textContent='Saving…';
  try{const result=await api('session',{}, {session_id:o.session_id,base_revision:o.base_revision,authorize_tier_change:!!o.tier_changed,state:{option_number:index+1,context:saveContext,tier:o.tier,stage:o.stage,selections:o.selections,comments:o.comments,camera:o.camera,parent_result_id:o.parent_result_id}});o.base_revision=result.event.revision;o.event_id=result.event.id;try{localStorage.setItem(sessionKey(saveContext),JSON.stringify(saveOptions.map(x=>x.session_id)));}catch{}o.dirty=false;if(context===saveContext&&active===index){dirty=false;status.textContent='Saved revision '+o.base_revision;}return true;}
  catch(e){if(context===saveContext)status.textContent='Not saved · '+e.message;return false;}
  finally{saving=false;saveButton.disabled=false;}
 }
 async function handoff(){const handoffContext=context,handoffOption=options[active];if(!await save()||context!==handoffContext||options[active]!==handoffOption)return;try{const result=await api('handoff',{session:options[active].session_id});const blob=new Blob([result.html],{type:'text/html'}),url=URL.createObjectURL(blob),a=el('a',{href:url,download:context.plan+'-'+context.room_id+'-option-'+(active+1)+'-handoff.html'});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){status.textContent=e.message;}}
 async function refreshCapabilities(){
  try{const response=await api('status');workerReady=response.generation_enabled;higgsfieldReady=response.higgsfield_enabled;higgsfieldSetup=!response.higgsfield_key_configured?'Higgsfield is selected. Secure server credential setup is still required.':!response.higgsfield_paid_authorized?'The project operator has not enabled paid Higgsfield requests.':'A paid request requires your explicit one-image authorization.';designerLink.hidden=!response.editor;renderButton.disabled=!workerReady||!room?.outline_verified||!nativeAvailable;
   renderNote.textContent=!room?.outline_verified?'Rendering needs a verified room enclosure. Save your reference choices while its area is checked.':!nativeAvailable?'This plan has no registered native render model yet. Your reference choices can still be saved.':workerReady?'Native CAD concept: chosen palette colours blend onto the existing room finish. Other borrowed details stay in your brief. Heights and specifications require designer review.':'Rendering is temporarily offline. Your choices can still be saved.';
  }catch{renderButton.disabled=true;}
 }
 async function render(){
  if(renderSubmitting)return;renderSubmitting=true;
  const currentContext=context,o=options[active];if(!await save()||context!==currentContext||options[active]!==o){renderSubmitting=false;return;}
  renderButton.disabled=true;try{const result=await api('generate',{}, {session_id:o.session_id,event_id:o.event_id});status.textContent='Native render queued · '+result.job.id.slice(0,8);resultDetails.open=true;loadJobs();}catch(e){status.textContent=e.message;}finally{renderSubmitting=false;refreshCapabilities();}
 }
 function authorizeHiggsfield(native){
  const dialog=el('dialog',{class:'atlas-gallery atlas-gallery-signin','aria-label':'Authorize one Higgsfield visualization'}),check=el('input',{type:'checkbox'}),feedback=el('p',{role:'status'}),go=button('Authorize one paid visualization',async()=>{
   if(!check.checked){feedback.textContent='Confirm the single paid request and image sharing first.';return;}go.disabled=true;
   try{await api('enhance',{}, {native_job_id:native.id,authorize_single_paid_request:true});dialog.close();resultDetails.open=true;loadJobs();}catch(e){feedback.textContent=e.message;go.disabled=false;}
  });
  dialog.append(button('Cancel',()=>dialog.close()),el('h2',{text:'One Higgsfield visualization'}),el('p',{text:'The native room image and selected inspiration images will be sent to Higgsfield. Its documented Kling Image 4.0 edit model produces one 2K image, listed at $0.063; provider billing applies. AI output remains a suggestion until compared and reviewed.'}),el('label',{},[check,document.createTextNode(' I authorize one paid image and sharing these selected images with Higgsfield.')]),go,feedback);dialog.addEventListener('close',()=>dialog.remove());dialog.addEventListener('keydown',e=>e.stopPropagation());document.body.append(dialog);dialog.showModal();
 }
 async function loadJobs(){
  clearTimeout(jobTimer);if(!context)return;const selectedContext=context,o=options[active],container=$('.gallery-result-list',panel);
  try{const result=await api('jobs',{session:o.session_id});if(context!==selectedContext||options[active]!==o)return;
   container.replaceChildren(...result.jobs.map(job=>{
    const ai=job.result?.kind==='ai-visualization'||job.specification?.engine==='higgsfield-image-edit',item=el('div',{class:'gallery-result'});item.append(el('strong',{text:(ai?'Higgsfield visualization · ':'Native concept · ')+(ai&&job.status==='accepted'?'kept as inspiration':job.status.replaceAll('_',' '))}),el('small',{text:new Date(job.created_at).toLocaleString()+' · revision '+(job.specification?.event_id?.slice(0,8)||'')}));
    if(job.error)item.append(el('p',{text:job.error}));
    if(job.result){
     item.append(button(ai?'Compare AI with native':'View native result',()=>{
      const dialog=el('dialog',{class:'atlas-gallery atlas-gallery-image','aria-label':ai?'Compare native and Higgsfield visualization':'Native CAD concept result'});dialog.append(button('Close result',()=>dialog.close()));if(ai){dialog.append(el('div',{class:'gallery-compare'},[el('figure',{},[el('figcaption',{text:'Native CAD concept · geometry authority'}),el('img',{src:apiURL('job-artifact',{id:job.specification.native_parent_id}),alt:'Authoritative native source view'})]),el('figure',{},[el('figcaption',{text:'Higgsfield · AI visualization · geometry unverified'}),el('img',{src:apiURL('job-artifact',{id:job.id}),alt:'Higgsfield visualization awaiting comparison'})])]),el('p',{text:'Reject changed room types, shell, openings, camera or invented surroundings. Keeping this as inspiration does not validate geometry.'}));}else dialog.append(el('img',{src:apiURL('job-artifact',{id:job.id}),alt:'Native render of the selected CAD room'}),el('p',{text:'Geometry unchanged by native material edits. Vertical geometry, furniture and finishes remain proposed assumptions. Status: '+job.status}));dialog.append(el('p',{text:'Source: '+job.result.checks.source_sha256}));dialog.addEventListener('close',()=>dialog.remove());dialog.addEventListener('keydown',e=>e.stopPropagation());document.body.append(dialog);dialog.showModal();
     }));
     item.append(button('Revise from this result',()=>{o.parent_result_id=job.id;o.stage='explored';stage.value='explored';changed();status.textContent='Revision parent selected. Adjust your choices and comments, then save and render again.';}));
     if(!ai){const enhance=button('Create Higgsfield visualization',()=>authorizeHiggsfield(job));enhance.disabled=!higgsfieldReady;item.append(enhance,el('small',{text:higgsfieldReady?'One AI image, listed at $0.063 for 2K. Explicit paid approval required.':higgsfieldSetup}));}
    }
    if(job.status==='failed')item.append(button(ai?'Resume saved Higgsfield request':'Retry native render',async()=>{try{await api('job-retry',{}, {id:job.id});loadJobs();}catch(e){status.textContent=e.message;}}));
    return item;
   }));
   if(!result.jobs.length)container.append(el('p',{class:'gallery-caption',text:'No render yet for this option. Save a palette choice, then render a native concept.'}));
   if(result.jobs.some(j=>['queued','running'].includes(j.status)))jobTimer=setTimeout(loadJobs,2000);
  }catch(e){container.replaceChildren(el('p',{text:e.message}));}
 }

 addEventListener('beforeunload',e=>{if(dirty||options.some(o=>o.dirty)||[...roomDrafts.values()].some(list=>list.some(o=>o.dirty))){e.preventDefault();e.returnValue='';}});
 return {
  reset(){clearTimeout(jobTimer);if(context){persistFields();roomDrafts.set(context.plan+':'+context.room_id,options);}request++;context=null;room=null;selected=null;panel.hidden=true;strip.hidden=true;document.body.removeAttribute('data-gallery-open');toggle.setAttribute('aria-expanded','false');},
  select(zone,scene){
   const next={property:scene.property,plan:scene.plan,source_sha256:scene.source_sha256,room_id:zone.id,room_type:zone.group};
   if(context&&context.plan===next.plan&&context.room_id===next.room_id){show(true);return;}
   if(context){persistFields();roomDrafts.set(context.plan+':'+context.room_id,options);}
   context=next;room=zone;nativeAvailable=!!scene.native_model;options=roomDrafts.get(context.plan+':'+context.room_id)||[blank(),blank()];active=0;selected=null;
   title.textContent=zone.name;metrics.replaceChildren(el('div',{},[el('strong',{text:zone.seats!=null?String(zone.seats):'—'}),el('span',{text:zone.seats!=null?'Seats · CAD label':'Seats not specified'})]),el('div',{},[el('strong',{text:zone.outline_verified&&zone.area_sqft!=null?String(zone.area_sqft):'—'}),el('span',{text:zone.outline_verified&&zone.area_sqft!=null?'sq ft · CAD enclosure':'Area awaiting verification'})]));
   basis.textContent=(zone.area_basis||'Room capacity follows the source label; no area inferred.')+(zone.note?' '+zone.note:'');
   panel.classList.toggle('gallery-compact',matchMedia('(max-width:600px)').matches);collapse.setAttribute('aria-expanded',String(!panel.classList.contains('gallery-compact')));
   sync();show(true);loadReferences();loadJobs();
   restoreSaved(context,options);
  }
 };
}
const roomDrafts=new Map();
