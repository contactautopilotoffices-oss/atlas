// Keep the selected preview when moving between the world and its drawings.
export function worldReturn(property, params = new URLSearchParams(location.search)) {
 const raw=params.get('returnTo');
 if(raw){try{const url=new URL(raw,location.origin);if(url.origin===location.origin&&/^\/flipkart-andheri(?:-east)?\/world$/.test(url.pathname))return url.pathname+url.search+'#'+encodeURIComponent(property||'privilon');}catch{}}
 return '/flipkart-andheri/world#'+encodeURIComponent(property||'privilon');
}
export function currentWorldReturn(property){const url=new URL(location.href);url.hash=property;return url.pathname+url.search+url.hash;}
export function drawingHref(page,property,variant,drawing,returnTo){const q=new URLSearchParams({property,variant,drawing:String(drawing)});if(returnTo)q.set('returnTo',returnTo);return '/engine/'+page+'.html?'+q;}
