// The Andheri experience: opening screen, film, then the three-property shortlist.
// Plain HTML/CSS/JS ports of EasyUI anatomy (Glass Navbar, Button, Animated Number, Sheet), MIT,
// © 2026 Suraj Maurya; notice in engine/vendor/easyui. Only loaded for the autopilot-flipkart branding.
import { brandLockup } from './andheri-brand.js';

const MEDIA = '/media/flipkart-andheri/';
const FILM = { src: MEDIA + 'film/andheri-intro.mp4', poster: MEDIA + 'film/andheri-intro-poster.jpg' };
const CONFIG = MEDIA + 'brand/experience.json';   // optional media (ambient bed, card images); see that file
const HERO = MEDIA + 'world/film-stills/privilon-dusk.jpg';
const SFX = { tick: MEDIA + 'brand/selection-tick.mp3' };
const SEEN = 'andheri-experience-seen', SOUND = 'andheri-sound';

/* Canonical facts (andheri-project/film/OVERNIGHT-BRIEF.md). Where the atlas bundle disagrees,
   these win: the cards, the spotlight and the route figures all read from here. */
export const SHORTLIST = {
  'privilon': {
    n: 1, name: 'Privilon', market: 'Marol', question: 'The commute',
    building: 'Grade A · G+15 · new tower', offer: 'Single floor plate', offerNote: '260 · 280 · 301 workstations',
    carpet: 11331, condition: 'Bare shell', possession: 'January 2027', status: 'Bare shell · possession January 2027',
    metro: { station: 'Marol Naka', line: 'Line 1', m: 140, min: 2 },
    image: 'world/film-stills/privilon-sunrise.jpg',
  },
  'corporate-avenue': {
    n: 2, name: 'Corporate Avenue', market: 'Chakala', question: 'The speed',
    building: 'Grade A- · G+8 · gated campus', offer: '3rd and 4th floors', offerNote: 'In Atul Corporate Avenue',
    carpet: 12414, carpetNote: '6,207 sq ft on each floor', condition: 'Ready now', possession: 'Ready now',
    status: 'Ready now · plans for 266, 281 and 373 seats',
    metro: { station: 'Chakala (J B Nagar)', short: 'Chakala', line: 'Line 1', m: 850, min: 11 },
    image: 'world/film-stills/corporate-avenue-drone.jpg',
  },
  '723-avenue': {
    n: 3, name: '723 Avenue', market: 'Marol', question: 'The view from the top',
    building: 'Grade A · G+15', offer: '13th and 14th floors', offerNote: 'Plus the terrace above them',
    carpet: 11331, condition: 'Bare shell', possession: 'Immediate', status: 'Bare shell · possession immediate',
    metro: { station: 'Marol Naka', line: 'Line 1', m: 700, min: 9 },
    image: 'world/film-stills/723-avenue-dusk.jpg',
  },
};

/* Bring the atlas data in line with the canonical facts, so the explorer's route list, walk and
   labels agree with the cards. Route geometry is kept; only the stated figures change. */
export function applyCanonicalFacts(options) {
  for (const o of options || []) {
    const c = SHORTLIST[o.id]; if (!c) continue;
    const set = (k, v) => { const f = (o.facts || []).find(x => x.k === k); if (f) f.v = v; };
    set('Carpet area', c.carpet.toLocaleString('en-IN') + ' sq. ft.');
    set('Floor / Unit', o.id === '723-avenue' ? c.offer + ', plus the terrace' : c.offer);
    set('Furnishing', c.condition);
    set('Possession', c.possession);
    const name = s => String(s || '').toLowerCase().replace(/\s*\(.*\)/, '').trim();
    const routes = o.routes || [], i = routes.findIndex(r => r.kind === 'metro' && name(r.name) === name(c.metro.station));
    if (i >= 0) { const r = routes[i]; r.m = c.metro.m; r.min = c.metro.min; routes.splice(i, 1); routes.unshift(r); }
  }
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch { } } };

/* ------------------------------------------------------------- rolling digits ----
   EasyUI Animated Number, reworked as a date-picker drum: each digit is a reel of 0-9 three times,
   spun upward and settled with a small overshoot; edges fade like a picker wheel. */
const CELL = 1.18;   // em per reel cell; matches --ax-cell in the CSS
export function odometer(value, { suffix = '' } = {}) {
  const text = typeof value === 'number' ? value.toLocaleString('en-IN') : String(value);
  const el = document.createElement('span'); el.className = 'ax-odo'; el.dataset.value = text;
  const sr = document.createElement('span'); sr.className = 'ax-sr'; sr.textContent = text + suffix; el.append(sr);   // what assistive tech reads
  const digits = [...text].filter(ch => /\d/.test(ch)).length; let seen = 0;
  for (const ch of text) {
    if (/\d/.test(ch)) {
      const fromRight = digits - (++seen);
      const col = document.createElement('span'); col.className = 'ax-odo-col'; col.setAttribute('aria-hidden', 'true');
      const reel = document.createElement('span'); reel.className = 'ax-odo-reel';
      reel.innerHTML = Array.from({ length: 30 }, (_, i) => `<span>${i % 10}</span>`).join('');
      reel.dataset.end = String(Number(ch) + 10 * (fromRight > 1 ? 1 : 2));
      reel.style.transform = `translateY(${-(Number(reel.dataset.end)) * CELL}em)`;
      col.append(reel); el.append(col);
    } else {
      const sep = document.createElement('span'); sep.className = 'ax-odo-sep'; sep.setAttribute('aria-hidden', 'true'); sep.textContent = ch; el.append(sep);
    }
  }
  return el;
}
export function rollIn(root, { delay = 0 } = {}) {
  if (reduced()) return;
  const reels = [...root.querySelectorAll('.ax-odo-reel')];
  reels.forEach((reel, i) => {
    const end = Number(reel.dataset.end), start = end % 10 === 0 && end > 9 ? end - 10 : 0;
    reel.getAnimations().forEach(a => a.cancel());
    reel.closest('.ax-odo').classList.add('ax-rolling');
    const anim = reel.animate([
      { transform: `translateY(${-start * CELL}em)`, easing: 'cubic-bezier(.14,.62,.24,1)' },
      { transform: `translateY(${-(end + .16) * CELL}em)`, offset: .82, easing: 'cubic-bezier(.33,0,.3,1)' },
      { transform: `translateY(${-end * CELL}em)` },
    ], { duration: 980 + i * 70, delay: delay + i * 45, fill: 'backwards' });
    anim.onfinish = () => { if (reels.every(r => !r.getAnimations().length)) root.querySelectorAll('.ax-rolling').forEach(n => n.classList.remove('ax-rolling')); };
  });
}

/* ------------------------------------------------------------------- icons ---- */
const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>',
  walk: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4.5" r="1.8"/><path d="m9.5 21 2.2-6.8 2.8 2.8V21M7.5 12.5l3-3.8 3 1.8 2.8 1.2M10.6 8.7 9.8 14"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  grid: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="5" height="15" rx="1.5"/><rect x="9.5" y="4.5" width="5" height="15" rx="1.5"/><rect x="15.5" y="4.5" width="5" height="15" rx="1.5"/></svg>',
  replay: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4.5v4.2h4.2"/></svg>',
};
export { ICON };

/* -------------------------------------------------------------- sound state ---- */
const listeners = new Set();
export const sound = {
  get on() { return store.get(SOUND) !== 'off'; },
  set(on) { store.set(SOUND, on ? 'on' : 'off'); listeners.forEach(f => f(on)); },
  watch(f) { listeners.add(f); f(this.on); return () => listeners.delete(f); },
};
export function soundToggle({ compact = false } = {}) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'ax-sound' + (compact ? ' ax-sound-compact' : '');
  sound.watch(on => {
    b.innerHTML = (on ? ICON.soundOn : ICON.soundOff) + `<span>${on ? 'Sound on' : 'Sound off'}</span>`;
    b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Mute sound' : 'Turn sound on');
  });
  b.addEventListener('click', () => sound.set(!sound.on));
  return b;
}
function sfx(src, volume) { const a = new Audio(src); a.preload = 'auto'; a.volume = volume; return () => { if (!sound.on) return; a.currentTime = 0; a.play().catch(() => { }); }; }

/* ------------------------------------------------------------------- cards ---- */
function cardMarkup(id, i) {
  const c = SHORTLIST[id];
  return `<li class="ax-card-slot" style="--i:${i}"><button type="button" class="ax-card" data-id="${esc(id)}" aria-label="Explore ${esc(c.name)}, ${esc(c.market)}">
  <span class="ax-card-media"><img src="${MEDIA}${esc(c.image)}" alt="" decoding="async"><span class="ax-card-num">${String(c.n).padStart(2, '0')}</span><span class="ax-card-tag">${esc(c.question)}</span></span>
  <span class="ax-card-body">
    <span class="ax-card-kicker">${esc(c.market)} · Andheri East</span>
    <span class="ax-card-name">${esc(c.name)}</span>
    <span class="ax-card-sub">${esc(c.building)}</span>
    <span class="ax-chip ax-metro">${ICON.walk}<span class="ax-metro-figs" data-slot="metro"></span><span class="ax-metro-to">to ${esc(c.metro.short || c.metro.station)}</span></span>
    <span class="ax-card-stats">
      <span class="ax-stat"><small>Carpet area</small><strong data-slot="carpet"></strong>${c.carpetNote ? `<em>${esc(c.carpetNote)}</em>` : ''}</span>
      <span class="ax-stat"><small>On offer</small><strong class="ax-stat-text">${esc(c.offer)}</strong><em>${esc(c.offerNote)}</em></span>
    </span>
    <span class="ax-card-foot"><span>${esc(c.status)}</span><span class="ax-card-go">Explore ${ICON.arrow}</span></span>
  </span>
  <span class="ax-card-progress" aria-hidden="true"><i></i></span>
</button></li>`;
}
function fillNumbers(card, id) {
  const c = SHORTLIST[id];
  const metro = card.querySelector('[data-slot=metro]');
  metro.append(odometer(c.metro.m), Object.assign(document.createElement('span'), { className: 'ax-unit', textContent: ' m · ' }), odometer(c.metro.min), Object.assign(document.createElement('span'), { className: 'ax-unit', textContent: ' min walk' }));
  const carpet = card.querySelector('[data-slot=carpet]');
  carpet.append(odometer(c.carpet), Object.assign(document.createElement('span'), { className: 'ax-unit', textContent: ' sq ft' }));
}

/* ------------------------------------------------------------- experience ---- */
export function andheriExperience({ options, first }) {
  const ids = options.map(o => o.id).filter(id => SHORTLIST[id]);
  const root = document.querySelector('#load');
  root.className = 'ax-root'; root.removeAttribute('style'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Flipkart × Autopilot: Andheri East');
  const chrome = () => [...document.querySelectorAll('#c,#top,#hud,#strip,#floors,#credit,#map-credits,#labels')];
  const cover = on => { document.body.classList.toggle('ax-covered', on); chrome().forEach(n => n.inert = on); };
  cover(true);

  root.innerHTML = `
  <div class="ax-bg" aria-hidden="true"><img class="ax-bg-img" src="${HERO}" alt=""><span class="ax-bg-shade"></span></div>
  <header class="ax-bar"><div class="ax-bar-brand"></div><div class="ax-bar-actions"><button type="button" class="ax-btn ax-btn-ghost ax-replay" hidden>${ICON.replay}<span>Replay film</span></button></div></header>
  <section class="ax-screen ax-open" data-screen="open">
    <div class="ax-open-copy">
      <p class="ax-eyebrow"><i class="ax-dot" aria-hidden="true"></i>Andheri East · Marol · Chakala</p>
      <h1 class="ax-h1">Andheri East.<br><span>Let’s choose it together.</span></h1>
      <p class="ax-lede">Flipkart asked us for space in Andheri East. We walked the micro‑market, checked every building against the deck, and brought it down to three.</p>
      <div class="ax-cta-row"><button type="button" class="ax-btn ax-btn-primary ax-enter"><span class="ax-btn-icon">${ICON.play}</span>Enter the experience</button><span class="ax-meta">A short film, then the shortlist</span></div>
    </div>
    <ol class="ax-open-list" aria-label="The shortlist">${ids.map(id => `<li><span>${String(SHORTLIST[id].n).padStart(2, '0')}</span><b>${esc(SHORTLIST[id].name)}</b><i>${esc(SHORTLIST[id].market)}</i></li>`).join('')}</ol>
  </section>
  <section class="ax-screen ax-film" data-screen="film" hidden aria-label="Film">
    <video class="ax-video" playsinline preload="metadata" poster="${FILM.poster}" src="${FILM.src}"></video>
    <div class="ax-film-ui">
      <button type="button" class="ax-film-btn ax-film-sound"></button>
      <button type="button" class="ax-btn ax-btn-glass ax-skip" hidden>Skip film ${ICON.arrow}</button>
      <div class="ax-progress" aria-hidden="true"><i></i></div>
    </div>
  </section>
  <section class="ax-screen ax-pick" data-screen="pick" hidden>
    <div class="ax-pick-head">
      <p class="ax-eyebrow"><i class="ax-dot" aria-hidden="true"></i>The shortlist · Andheri East</p>
      <h2 class="ax-h2">Three buildings. Each answers a different question.</h2>
      <p class="ax-lede">The commute, the speed, the view from the top. Choose where to begin; you can come back to all three at any time.</p>
    </div>
    <ul class="ax-cards" aria-label="Choose a property">${ids.map(cardMarkup).join('')}</ul>
    <div class="ax-dots" aria-hidden="true">${ids.map(() => '<i></i>').join('')}</div>
    <div class="ax-pick-foot"><div class="ax-load-track"><i id="l-bar"></i></div><p id="l-msg" role="status">Preparing the 3D model…</p></div>
  </section>
  <span id="l-title" hidden></span>`;

  root.querySelector('.ax-bar-brand').append(brandLockup('dark'));
  const barActions = root.querySelector('.ax-bar-actions'); barActions.append(soundToggle());
  const screens = Object.fromEntries([...root.querySelectorAll('[data-screen]')].map(s => [s.dataset.screen, s]));
  const video = root.querySelector('.ax-video'), skip = root.querySelector('.ax-skip'), progress = root.querySelector('.ax-progress i');
  const filmSound = root.querySelector('.ax-film-sound'), replay = root.querySelector('.ax-replay');
  const cards = [...root.querySelectorAll('.ax-card')];
  cards.forEach(card => fillNumbers(card, card.dataset.id));
  const tick = sfx(SFX.tick, .12);

  /* optional media from brand/experience.json: ambient bed, film and card image overrides */
  let ambient = null, ambientWanted = false;
  const film = { ...FILM };
  fetch(CONFIG, { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).catch(() => ({})).then(c => {
    if (c.film?.src) film.src = c.film.src;
    if (c.film?.poster) { film.poster = c.film.poster; video.poster = c.film.poster; }
    if (c.hero) root.querySelector('.ax-bg-img').src = c.hero;
    for (const card of cards) { const src = c.cards?.[card.dataset.id]; if (src) card.querySelector('.ax-card-media img').src = src; }
    if (c.ambient) { ambient = new Audio(c.ambient); ambient.loop = true; ambient.preload = 'auto'; ambient.volume = 0; syncAmbient(); }
  });
  function syncAmbient() {
    if (!ambient) return;
    const want = ambientWanted && sound.on;
    if (want) { ambient.play().then(() => fade(ambient, .14, 1600)).catch(() => { }); }
    else fade(ambient, 0, 500, () => ambient.pause());
  }
  function fade(a, to, ms, done) {
    const from = a.volume, t0 = performance.now(); clearInterval(a._fade);
    a._fade = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = from + (to - from) * k; if (k >= 1) { clearInterval(a._fade); done?.(); } }, 30);
  }
  sound.watch(on => {
    video.muted = !on;
    filmSound.innerHTML = on ? ICON.soundOn : ICON.soundOff;
    filmSound.setAttribute('aria-label', on ? 'Mute film' : 'Unmute film'); filmSound.setAttribute('aria-pressed', String(on));
    syncAmbient();
  });
  filmSound.addEventListener('click', () => sound.set(!sound.on));

  let screen = 'open', pending = null, world = null;
  function show(name) {
    screen = name;
    root.dataset.screen = name;
    for (const [k, s] of Object.entries(screens)) { s.hidden = k !== name; }
    replay.hidden = name !== 'pick';
    root.querySelector('.ax-bar').hidden = name === 'film';
    if (name === 'pick') revealCards();
  }
  function revealCards() {
    root.classList.remove('ax-cards-in'); void root.offsetWidth; root.classList.add('ax-cards-in');
    cards.forEach((card, i) => rollIn(card, { delay: 260 + i * 110 }));
    ambientWanted = true; syncAmbient();
    const h = root.querySelector('.ax-h2'); h.tabIndex = -1; requestAnimationFrame(() => h.focus({ preventScroll: true }));
  }

  /* film */
  let skipTimer = 0;
  function playFilm() {
    show('film'); store.set(SEEN, '1');
    ambientWanted = false; syncAmbient();
    if (video.getAttribute('src') !== film.src) video.src = film.src;
    video.currentTime = 0; video.muted = !sound.on;
    progress.style.transform = 'scaleX(0)';
    skip.hidden = true; clearTimeout(skipTimer);
    skipTimer = setTimeout(() => { skip.hidden = false; }, 3000);
    const p = video.play();
    p?.catch(() => { video.muted = true; video.play().catch(() => endFilm()); });
    const f = root.querySelector('.ax-film'); f.tabIndex = -1; f.focus({ preventScroll: true });
  }
  function endFilm() {
    if (screen !== 'film') return;
    clearTimeout(skipTimer); video.pause();
    root.classList.add('ax-film-out');
    setTimeout(() => { root.classList.remove('ax-film-out'); show('pick'); }, reduced() ? 0 : 420);
  }
  video.addEventListener('timeupdate', () => { if (video.duration) progress.style.transform = `scaleX(${video.currentTime / video.duration})`; });
  video.addEventListener('ended', endFilm);
  video.addEventListener('error', () => { if (screen === 'film') endFilm(); });
  skip.addEventListener('click', endFilm);
  replay.addEventListener('click', playFilm);
  // the film starts only once the city has loaded: parsing the 3D models on the main thread while the video plays made it stutter
  const enter = root.querySelector('.ax-enter'), enterHTML = enter.innerHTML;
  enter.disabled = true; enter.setAttribute('aria-busy', 'true'); enter.innerHTML = `<span class="ax-btn-icon ax-spin"></span>Preparing the city…`;
  enter.addEventListener('click', playFilm);
  document.addEventListener('keydown', e => {
    if (root.hidden) return;
    if (e.key === 'Escape' && screen === 'film') { e.preventDefault(); e.stopImmediatePropagation(); endFilm(); return; }
    if (screen === 'pick' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const i = cards.indexOf(document.activeElement); if (i < 0) return;
      const next = cards[(i + (e.key === 'ArrowRight' ? 1 : cards.length - 1)) % cards.length];
      e.preventDefault(); next.focus(); next.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced() ? 'auto' : 'smooth' });
    }
  });

  /* mobile carousel position dots */
  const list = root.querySelector('.ax-cards'), dots = [...root.querySelectorAll('.ax-dots i')];
  const syncDots = () => { const w = list.scrollWidth - list.clientWidth; const i = w > 0 ? Math.round(list.scrollLeft / w * (dots.length - 1)) : 0; dots.forEach((d, k) => d.classList.toggle('on', k === i)); };
  list.addEventListener('scroll', syncDots, { passive: true }); syncDots();

  /* choosing a property */
  cards.forEach(card => card.addEventListener('click', () => choose(card.dataset.id)));
  async function choose(id, byUser = true) {
    if (byUser) tick();
    cards.forEach(c => c.classList.toggle('ax-chosen', c.dataset.id === id));
    root.classList.add('ax-choosing');
    if (!world) { pending = id; status('Preparing the 3D model…'); return; }
    if (world.selected() !== id) { status(`Opening ${SHORTLIST[id].name}…`); await world.select(id); }
    enterExplorer();
  }
  function status(text) { const m = root.querySelector('#l-msg'); if (m) m.textContent = text; }
  function enterExplorer() {
    store.set(SEEN, '1');
    root.classList.add('ax-leaving'); root.classList.remove('ax-direct');
    cover(false);
    setTimeout(() => { root.hidden = true; root.classList.remove('ax-leaving', 'ax-choosing'); cards.forEach(c => c.classList.remove('ax-chosen')); }, reduced() ? 0 : 520);
    const title = document.querySelector('#name'); if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
  }
  function openShortlist() {
    root.hidden = false; cover(true); show('pick');
  }

  /* the way back from the explorer */
  const back = document.createElement('button'); back.type = 'button'; back.id = 'ax-back'; back.className = 'ax-back';
  back.innerHTML = `${ICON.grid}<span>Shortlist</span>`; back.setAttribute('aria-label', 'Back to the three shortlisted buildings');
  back.addEventListener('click', openShortlist);
  const top = document.querySelector('#top'); top?.prepend(back);
  const topSound = soundToggle({ compact: true }); topSound.id = 'ax-top-sound'; top?.append(topSound);

  /* where to start: first visit sees the opening; a return trip with a property in the URL goes straight in */
  const deep = ids.includes(location.hash.slice(1)) && store.get(SEEN) === '1';
  const forceIntro = new URLSearchParams(location.search).get('intro') === '1';
  if (deep && !forceIntro) { root.classList.add('ax-direct'); show('pick'); status(`Opening ${SHORTLIST[location.hash.slice(1)].name}…`); pending = location.hash.slice(1); root.classList.add('ax-choosing'); }
  else if (store.get(SEEN) === '1' && !forceIntro) show('pick');
  else show('open');
  root.tabIndex = -1; root.focus({ preventScroll: true });

  return {
    selection: () => { if (root.hidden) tick(); },   // switching property from the rail
    ready(w) {
      world = w; status('Ready. Choose a building.');
      enter.disabled = false; enter.removeAttribute('aria-busy'); enter.innerHTML = enterHTML;
      root.classList.add('ax-world-ready');
      if (pending) { const id = pending; pending = null; choose(id, false); }
    },
  };
}
