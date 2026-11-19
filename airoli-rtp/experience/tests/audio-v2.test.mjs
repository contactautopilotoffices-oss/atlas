import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source = await fs.readFile(new URL('../js/xp/audio.js', import.meta.url), 'utf8');
const audios = [];
class MockAudio {
  constructor() { this.paused=true; this.ended=false; this.currentTime=0; this.duration=NaN; this.volume=1; audios.push(this); }
  play() { this.paused=false; return Promise.resolve(); }
  pause() { this.paused=true; }
}
globalThis.Audio=MockAudio;
const manifest={vo:[{t:0,duration_s:113,file:'voice.mp3',status:'ok'}],bed:'music.mp3',captions:'captions.srt'};
globalThis.__testManifest=manifest;
globalThis.fetch=async()=>({ok:true,text:async()=> '1\n00:01:30,000 --> 00:01:32,000\nLate narration stays captioned.\n'});
const code=source.replace("import { fetchJSON } from './core.js';", 'const fetchJSON=async()=>globalThis.__testManifest;');
const {probeAudio,createAudio}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const found=await probeAudio({},{});
assert.equal(found.caps.length,1,'Captions beyond the old 12-second limit must remain.');
const player=createAudio({...found,sfx:[]});
player.setMuted(true);
player.unlock();
player.seek(65);
const voice=audios.find(a=>a.src==='audio/voice.mp3');
const bed=audios.find(a=>a.src==='audio/music.mp3');
assert.equal(voice.currentTime,65);
assert.equal(voice.paused,false);
assert.equal(bed.currentTime,65);
assert.equal(bed.muted,true,'A music element created after mute must inherit it.');
player.unlock();
assert.equal(bed.currentTime,65,'Chapter unlock must not restart the music.');
player.pause(); assert.equal(voice.paused,true); assert.equal(bed.paused,true);
player.resume(); assert.equal(voice.paused,false); assert.equal(bed.paused,false);
player.setMuted(false); assert.equal(voice.muted,false);
player.seek(113); assert.equal(voice.paused,true,'Do not restart narration past its end.');
console.log('PASS: long captions, chapter offset, pause/resume, mute persistence, end boundary.');
