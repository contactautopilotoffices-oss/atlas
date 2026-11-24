// Explicit loopback review only. The server refuses this action on Vercel.
export async function enableLocalDesignPreview(params=new URLSearchParams(location.search)){
 if(params.get('mvp')!=='1')return;
 try{const response=await fetch('/api/design?project=flipkart-andheri&r=local-preview');if(response.ok&&(await response.json()).local_preview){sessionStorage.setItem('flipkart-andheri-auth','1');sessionStorage.setItem('flipkart-andheri-east-auth','1');}}catch{}
}
