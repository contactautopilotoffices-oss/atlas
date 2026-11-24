// Reuse existing project access cookies; retain the legacy static gate as fallback.
export async function signInDesignProject(slug,id,password,{fetchFn=fetch}={}){
 if(!['flipkart-andheri','flipkart-andheri-east'].includes(slug))return false;
 try{const response=await fetchFn('/api/cms?r=access',{method:'POST',headers:{'Content-Type':'application/json','x-cms':'1'},body:JSON.stringify({id,password})});if(!response.ok)return false;const result=await response.json();return result.slug===slug||(slug==='flipkart-andheri-east'&&result.slug==='flipkart-andheri');}catch{return false;}
}
