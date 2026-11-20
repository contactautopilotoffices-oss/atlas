// Voice, music and sound for the timed run: the ElevenLabs set in audio/ (manifest.json: one clip per beat with its start
// time t, the music bed, captions.srt on the same clock; sfx/ for the cues). Nothing plays before the Enter click
// (browser autoplay rules). Lines still marked VERIFY are skipped unless the location research confirms them
// (only b08a has such a rule: the Trans-Harbour line wording, checked against location.json's direct-train rows).
// audio/draft_say/ is never used.
import { fetchJSON } from './core.js';

const SFX_CUES = [                       // SCRIPT.md section 8 / shots.json sfx, levels well under the voice
  { t: 0.0, file: 'sfx/wind_rush_clouds.mp3', vol: .22 },
  { t: 10.4, file: 'sfx/whoosh_soft.mp3', vol: .30 },
  { t: 50.6, file: 'sfx/glass_shimmer.mp3', vol: .20 },
  { t: 81.0, file: 'sfx/ui_tick.mp3', vol: .40 },
  { t: 94.0, file: 'sfx/arrival_chime.mp3', vol: .28 },
];

function parseSrt(txt) {
  const ts = (s) => { const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(s); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000 : 0; };
  return txt.replace(/\r/g, '').split(/\n\n+/).map(b => b.split('\n')).filter(l => l.length >= 3 && l[1].includes('-->'))
    .map(l => { const [a, b] = l[1].split('-->'); return { t0: ts(a), t1: ts(b), line: l.slice(2).join(' ').trim() }; });
}

// verification rules for lines the script still marks VERIFY
function verified(beat, loc) {
  if (beat === 'b08a_rail') {
    const row = (h) => (loc.catchment || []).find(r => r.hub === h && /Trans-Harbour line, direct/i.test(r.route || ''));
    const st = (loc.points || []).find(p => p.id === 'airoli_station');
    return !!(row('Thane') && row('Vashi') && row('Panvel') && st && /Trans-Harbour/i.test(st.name));
  }
  return false;
}

export async function probeAudio(shots, loc, base = 'audio/') {
  const found = { vo: [], bed: null, caps: null, sfx: [], verifiedBeats: new Set() };
  let man = null; try { man = await fetchJSON(base + 'manifest.json'); } catch (e) { return found; }
  for (const v of man.vo || []) {
    if (!v.file || !Number.isFinite(v.t)) continue;
    const ok = /^ok/i.test(v.status || '') || (/VERIFY/i.test(v.status || '') && verified(v.beat, loc));
    if (!ok) continue;
    if (/VERIFY/i.test(v.status || '')) found.verifiedBeats.add(v.beat);
    found.vo.push({ t: v.t, duration: v.duration_s ?? null, url: base + v.file, beat: v.beat || '', text: v.text || '' });
  }
  if (man.bed) found.bed = base + man.bed;
  if (man.captions) { try { const r = await fetch(base + man.captions, { cache: 'no-cache' }); if (r.ok) found.caps = parseSrt(await r.text()); } catch (e) { } }
  // captions only for lines that will actually play
  if (found.caps) found.caps = found.caps.filter(c => found.vo.some(v => {
    const next = found.vo.find(w => w.t > v.t);
    const end = v.duration != null ? v.t + v.duration : (next?.t ?? v.t + 12);
    return c.t0 >= v.t - .05 && c.t0 < end;
  }));
  found.sfx = SFX_CUES.map(c => ({ ...c, url: base + c.file }));
  found.vo.sort((a, b) => a.t - b.t);
  return found;
}

export function createAudio(found) {
  const els = new Map(); let bed = null, started = false, lastT = -1, bedTarget = .32, muted = false;
  const el = (url) => { if (!els.has(url)) { const a = new Audio(); a.preload = 'auto'; a.src = url; a.muted = muted; els.set(url, a); } return els.get(url); };
  found.vo.forEach(v => el(v.url)); found.sfx.forEach(s => el(s.url));
  const swell = found.sfx.length ? el(found.sfx[0].url.replace(/wind_rush_clouds/, 'low_swell')) : null;
  const vo = new Set(found.vo.map(v => v.url));
  let pausedEls = [];
  const api = {
    pause() { pausedEls = [...els.values()].filter(a => !a.paused); pausedEls.forEach(a => a.pause()); },
    resume() { pausedEls.forEach(a => a.play().catch(() => {})); pausedEls=[]; },
    setMuted(on) { muted = on; for (const a of els.values()) a.muted=on; },
    has: found.vo.length > 0 || !!found.bed, caps: found.caps, verifiedBeats: found.verifiedBeats,
    unlock() { // The Enter/chapter click grants playback; avoid async priming that can pause a newly sought voice.
      if (started) return;
      started = true;
      if (swell) { swell.volume = .4; swell.currentTime = 0; swell.play().catch(() => {}); }
      if (found.bed) { bed = el(found.bed); bed.loop = false; bed.volume = .32; bed.currentTime = 0; bed.play().catch(() => {}); }
    },
    // every frame with the timeline time: fire each clip once as the time crosses its start; duck the bed under the voice
    update(t) {
      if (!started) return;
      for (const v of found.vo) if (lastT < v.t && t >= v.t && t - v.t < .5) { const a = el(v.url); a.currentTime = 0; a.volume = 1; a.play().catch(() => {}); }
      for (const s of found.sfx) if (lastT < s.t && t >= s.t && t - s.t < .5) { const a = el(s.url); a.currentTime = 0; a.volume = s.vol; a.play().catch(() => {}); }
      lastT = t;
      if (bed) { let speaking = false; for (const u of vo) { const a = els.get(u); if (a && !a.paused && !a.ended) { speaking = true; break; } }
        bedTarget = speaking ? .2 : .32; bed.volume += (bedTarget - bed.volume) * .06; }
    },
    seek(t) {
      lastT = t; for (const a of els.values()) if (a !== bed) a.pause();
      if (bed && started) { try { bed.currentTime = Math.max(0, t); if (bed.paused) bed.play().catch(() => {}); } catch (e) { } }
      if (started) for (const v of found.vo) {
        const a = el(v.url), duration = v.duration ?? a.duration;
        if (Number.isFinite(duration) && t >= v.t && t < v.t + duration) {
          a.currentTime = Math.max(0, t - v.t); a.volume = 1; a.play().catch(() => {});
        }
      }
    },
    fadeOut(sec = 1.2) { const all = [...els.values()]; const t0 = performance.now(); const v0 = all.map(a => a.volume);
      const step = () => { const k = Math.min(1, (performance.now() - t0) / (sec * 1000)); all.forEach((a, i) => { a.volume = v0[i] * (1 - k); }); if (k < 1) requestAnimationFrame(step); else all.forEach(a => a.pause()); }; step(); },
    stopVoice() { for (const u of vo) { const a = els.get(u); if (a) a.pause(); } },
    stopAll() { for (const a of els.values()) a.pause(); },
  };
  return api;
}
