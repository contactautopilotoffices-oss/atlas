// Re-record the corrected website route through its deterministic capture API.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const { chromium } = require('playwright');
const out = new URL('../assets/location_route_v3.mp4', import.meta.url).pathname;
const browser = await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--force-color-profile=srgb']});
const page = await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:8137/airoli-rtp/experience/?capture=b08b@76.5',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__READY__===true,null,{timeout:180000});
await page.addStyleTag({content:'#credit,#credit-details{display:none!important}'}); // Composition carries the source credit.
const ff=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-an','-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',out],{stdio:['pipe','inherit','inherit']});
const finished=new Promise((resolve,reject)=>ff.on('close',code=>code===0?resolve():reject(new Error(`ffmpeg ${code}`))));
try {
  for(let f=0;f<600;f++) {
    const t=56+21.5*f/599;
    await page.evaluate(t=>{
      const x=window.__XP__,p=x.PATH.sample(t);
      x.S.t=t;x.setCam(p.p,p.target,p.hfov);x.applyTod(9.5);x.timelineState(t);x.U.uTime.value=t;
      x.OV.setPixelAngle(x.camera,1080);window.__XP.render();
    },t);
    const jpg=await page.screenshot({type:'jpeg',quality:96});
    if(!ff.stdin.write(jpg)) await new Promise(r=>ff.stdin.once('drain',r));
    if(f%120===0) console.log(`Route ${f}/600`);
  }
  await fs.writeFile(new URL('../assets/route_hold_v3.png',import.meta.url),await page.screenshot({type:'png'}));
  ff.stdin.end();await finished;
  if(errors.length) throw new Error(errors.join('\n'));
  console.log(out);
} finally { await browser.close(); }
