// Presenter remote, phone side. Opened from the QR code on the display
// (remote.html#s=<one-time secret>). After signing in with the same Atlas ID and
// password, every control here sends a signed command to the display.
import { sessionKeys, channelName, openLink, messenger, verify, credKey, credKeyFromHash, gateHash, sha256hex, norm, randomSecret } from './link.js';

const $ = (s) => document.querySelector(s);
const show = (id) => { document.querySelectorAll('.screen').forEach(e => e.classList.toggle('show', e.id === id)); $('#ctl').classList.toggle('show', id === 'ctl'); };
const secret = (location.hash.match(/s=([0-9a-f]{16,64})/) || [])[1];
const me = 'r-' + randomSecret(6);
let link = null, keys = null, msgr = null, mode = 'k0', hello = null, state = {}, lastN = 0, cred = null, live = false, lastState = 0;

if (!secret) show('s-nolink');
else { try { cred = sessionStorage.getItem('volt-remote-cred'); } catch (e) {} if (cred) connect(false); else show('s-sign'); }

$('#f-sign').addEventListener('submit', async (e) => {
  e.preventDefault(); $('#e-sign').textContent = '';
  const id = $('#i-id').value, pw = $('#i-pw').value, ok = (window.VOLT_REMOTE && window.VOLT_REMOTE.presenters) || [];
  const roots = (window.VOLT_REMOTE && window.VOLT_REMOTE.rootLogins) || {}, rp = await sha256hex(norm(pw));   // the Atlas root sign-in: ID in the list, password hash matches
  const isRoot = roots[norm(id)] === rp;
  if (!isRoot && !ok.includes(await gateHash(id, pw))) { $('#e-sign').textContent = 'Not recognised. Use the presenter ID and password.'; $('#i-pw').value = ''; return; }
  cred = isRoot ? await credKeyFromHash('root:' + rp) : await credKey(id, pw); try { sessionStorage.setItem('volt-remote-cred', cred); } catch (e2) {}
  connect(false);
});
$('#b-retry').onclick = () => connect(false);
$('#b-take').onclick = () => connect(true);

async function connect(take) {
  show('s-wait'); $('#w-title').textContent = 'Connecting to the display…'; $('#w-text').textContent = 'Keep the display on the QR code screen.'; $('#b-take').style.display = 'none';
  try {
    if (!link) {
      keys = await sessionKeys(secret, cred);
      link = await openLink(await channelName(secret), onMsg, (st) => { if (st === 'down') setLive(false); });
      msgr = messenger(link, keys, me);
    }
    await msgr.send('hello', { auth: true, take: !!take }, true);
    setTimeout(() => { if (!hello && $('#s-wait').classList.contains('show') && $('#b-take').style.display === 'none') {
      $('#w-title').textContent = 'No answer from the display'; $('#w-text').textContent = link.kind === 'local'
        ? 'This site has no live link set up, so the remote only reaches a display open in this same browser.' : 'Check that the display is still showing the QR code, then try again. Codes change each time Remote is opened.'; } }, 6000);
  } catch (err) { $('#w-title').textContent = 'Could not connect'; $('#w-text').textContent = String(err && err.message || err); }
}

async function onMsg(msg) {
  if (!msg || msg.f !== 'display' || !(msg.n > lastN)) return;
  if (msg.a && msg.a.to && msg.a.to !== me) return;            // meant for another phone
  const early = ['welcome', 'busy', 'denied', 'wait', 'taken'].includes(msg.t);
  if (!(await verify(msg, keys, early ? 'k0' : mode))) return;
  lastN = msg.n;
  if (msg.t === 'busy') { $('#w-title').textContent = 'Someone else has the remote'; $('#w-text').textContent = 'Another presenter is connected to this display.'; $('#b-take').style.display = ''; return; }
  if (msg.t === 'denied') { try { sessionStorage.removeItem('volt-remote-cred'); } catch (e) {} cred = null; link.close(); link = null; show('s-sign'); $('#e-sign').textContent = 'The display did not accept that ID and password.'; return; }
  if (msg.t === 'wait') { $('#w-title').textContent = 'Signed in. The display is loading…'; $('#w-text').textContent = 'It will be ready in a moment.'; return; }
  if (msg.t === 'taken') { setLive(false); show('s-wait'); $('#w-title').textContent = 'Another presenter took the remote'; $('#w-text').textContent = ''; $('#b-take').style.display = ''; hello = null; return; }
  if (msg.t === 'welcome') { mode = msg.a.mode; msgr.setMode(mode); hello = msg.a.hello; build(); show('ctl'); setLive(true); wake(); return; }
  if (msg.t === 'state' && hello) { state = msg.a; lastState = Date.now(); setLive(true); paint(); }
}
function setLive(on) { live = on; $('#dot').classList.toggle('ok', on); }
setInterval(() => { if (hello) { msgr.send('ping'); if (Date.now() - lastState > 12000 && lastState) setLive(false); } }, 4000);
const send = (t, a) => { if (hello) msgr.send(t, a || {}); if (navigator.vibrate) navigator.vibrate(8); };
async function wake() { try { if (navigator.wakeLock) await navigator.wakeLock.request('screen'); } catch (e) {} }
document.addEventListener('visibilitychange', () => { if (!document.hidden && hello) { wake(); msgr.send('ping'); } });

// ---------------------------------------------------------------- controls
const KIND = { metro: 'Metro', corp: 'Office', cowork: 'Coworking', retail: 'Shops', health: 'Health', hotel: 'Hotel', edu: 'Education' };
const bp = new Image();
function build() {
  $('#rooms').innerHTML = ''; $('#places').innerHTML = '';
  for (const r of hello.rooms) {
    const b = document.createElement('button'); b.dataset.room = r.name;
    b.innerHTML = `<span>${r.name.replace(' / command centre', '')}</span><small class="${r.g.toLowerCase()}">${r.n ? r.n + ' ' + ({ W: 'work', M: 'meeting', C: 'cafe', L: 'lounge', O: 'operator' })[r.g] : ''}</small><i>›</i>`;
    b.onclick = () => send('room', { name: r.name }); $('#rooms').appendChild(b);
  }
  hello.places.forEach((q, i) => { const b = document.createElement('button'); b.innerHTML = `${q.name}<small>${KIND[q.kind] || ''} · ${q.d >= 1000 ? (q.d / 1000).toFixed(1) + ' km' : Math.round(q.d / 10) * 10 + ' m'}</small>`; b.onclick = () => send('place', { i }); $('#places').appendChild(b); });
  bp.onload = drawMap; bp.src = hello.bp.img;
}
document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => send(b.dataset.c, b.dataset.a ? JSON.parse(b.dataset.a) : {}));
document.querySelectorAll('#nav [data-p]').forEach(b => b.onclick = () => {
  document.querySelectorAll('#nav button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('show', p.id === 'p-' + b.dataset.p)); if (b.dataset.p === 'walk') drawMap();
});
$('#b-tour').onclick = () => send('tour', { on: state.mode !== 'tour' });
$('#b-above').onclick = () => send('above', { name: state.room });
$('#b-end').onclick = () => { if (hello) msgr.send('bye'); hello = null; setLive(false); show('s-wait'); $('#w-title').textContent = 'Remote ended'; $('#w-text').textContent = 'Scan the code on the display to connect again.'; $('#b-take').style.display = 'none'; };
let qrOn = false; $('#b-qr').onclick = () => { qrOn = !qrOn; send('qr', { on: qrOn }); $('#b-qr').textContent = qrOn ? 'Hide QR' : 'Show QR'; };
const throttle = (fn, ms) => { let t = 0, pend = null; return (...a) => { const now = Date.now(); if (now - t >= ms) { t = now; fn(...a); } else { clearTimeout(pend); pend = setTimeout(() => { t = Date.now(); fn(...a); }, ms - (now - t)); } }; };
$('#tod').oninput = throttle(() => send('tod', { t: +$('#tod').value / 100 }), 80);
$('#cut').oninput = throttle(() => send('cut', { f: +$('#cut').value / 100 }), 80);

function paint() {
  const names = { building: 'Building', floor: 'First floor · Volt' };
  $('#w-room').textContent = state.room || (state.stage === 'floor' ? 'First floor · Volt' : 'Skymark F-1');
  $('#w-sub').textContent = ({ orbit: names[state.stage] || '', walk: 'Inside · walking', tour: 'Tour playing', elev: state.elev ? (state.elev.kind === 'section' ? 'Section' : 'Facade') : 'Elevation' })[state.mode] || '';
  document.querySelectorAll('#rooms button').forEach(b => b.classList.toggle('on', b.dataset.room === state.room));
  $('#b-tour').textContent = state.mode === 'tour' ? 'Stop the tour' : 'Play the tour'; $('#b-tour').classList.toggle('p', state.mode !== 'tour');
  $('#b-seats').classList.toggle('on', !!state.seats); $('#b-walls').classList.toggle('on', !!state.walls);
  if (document.activeElement !== $('#tod')) $('#tod').value = Math.round((state.tod || 0) * 100);
  if ($('#p-walk').classList.contains('show')) drawMap();
}

// the CAD drawing with the presenter's position on it; tap to go
const map = $('#map'), mg = map.getContext('2d');
function mapXY(x, y) { const [x0, y0, x1, y1] = hello.bp.bounds; return [(x - x0) / (x1 - x0) * map.width, (y1 - y) / (y1 - y0) * map.height]; }
function drawMap() {
  if (!hello) return; const [x0, y0, x1, y1] = hello.bp.bounds; const h = Math.round(map.width * (y1 - y0) / (x1 - x0)); if (map.height !== h) map.height = h;
  mg.fillStyle = '#123b7a'; mg.fillRect(0, 0, map.width, map.height); if (bp.complete && bp.naturalWidth) mg.drawImage(bp, 0, 0, map.width, map.height);
  const r = hello.rooms.find(q => q.name === state.room);
  if (r) { const [ax, ay] = mapXY(r.box[0], r.box[3]), [bx, by] = mapXY(r.box[2], r.box[1]); mg.fillStyle = 'rgba(242,162,76,.25)'; mg.strokeStyle = '#f2a24c'; mg.lineWidth = 3; mg.fillRect(ax, ay, bx - ax, by - ay); mg.strokeRect(ax, ay, bx - ax, by - ay); }
  if (state.pose) { const [px, py] = mapXY(state.pose.x, state.pose.y); mg.save(); mg.translate(px, py); mg.rotate(-state.pose.yaw);
    mg.fillStyle = 'rgba(255,190,90,.45)'; mg.beginPath(); mg.moveTo(0, 0); mg.arc(0, 0, 90, -.5, .5); mg.closePath(); mg.fill();
    mg.fillStyle = '#ff9f2e'; mg.strokeStyle = '#fff'; mg.lineWidth = 5; mg.beginPath(); mg.arc(0, 0, 15, 0, 7); mg.fill(); mg.stroke(); mg.restore(); }
}
map.addEventListener('pointerdown', (e) => { if (!hello) return; const b = map.getBoundingClientRect(), [x0, y0, x1, y1] = hello.bp.bounds;
  send('goto', { x: x0 + (e.clientX - b.left) / b.width * (x1 - x0), y: y1 - (e.clientY - b.top) / b.height * (y1 - y0) }); });

// joystick: sends the stick position about 15 times a second while held, and a stop on release
const stick = $('#stick'), knob = stick.querySelector('i'); let sv = [0, 0], st = 0;
function stickAt(e) { const b = stick.getBoundingClientRect(); let x = (e.clientX - b.left - b.width / 2) / (b.width / 2), y = (e.clientY - b.top - b.height / 2) / (b.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  sv = [x, -y]; knob.style.transform = `translate(${x * b.width * .3}px,${y * b.height * .3}px)`; }
stick.addEventListener('pointerdown', (e) => { stick.setPointerCapture(e.pointerId); stickAt(e); clearInterval(st); st = setInterval(() => { if (hello) msgr.send('move', { s: +sv[0].toFixed(2), f: +sv[1].toFixed(2) }); }, 66); });
stick.addEventListener('pointermove', (e) => { if (st) stickAt(e); });
const stopStick = () => { clearInterval(st); st = 0; sv = [0, 0]; knob.style.transform = ''; if (hello) { msgr.send('move', { s: 0, f: 0 }); setTimeout(() => hello && msgr.send('move', { s: 0, f: 0 }), 120); } };
stick.addEventListener('pointerup', stopStick); stick.addEventListener('pointercancel', stopStick);

// look pad: drag turns the view (in a room) or orbits (over the building or floor)
const look = $('#lookpad'); let lp = null, acc = [0, 0];
const flushLook = throttle(() => { if (hello && (acc[0] || acc[1])) { msgr.send('look', { dx: +acc[0].toFixed(3), dy: +acc[1].toFixed(3) }); acc = [0, 0]; } }, 40);
look.addEventListener('pointerdown', (e) => { look.setPointerCapture(e.pointerId); lp = [e.clientX, e.clientY]; });
look.addEventListener('pointermove', (e) => { if (!lp) return; acc[0] += (e.clientX - lp[0]) * .006; acc[1] += (e.clientY - lp[1]) * .005; lp = [e.clientX, e.clientY]; flushLook(); });
look.addEventListener('pointerup', () => { lp = null; }); look.addEventListener('pointercancel', () => { lp = null; });

// pointer pad: a dot on the display follows the finger
const pp = $('#ptrpad'); let pOn = false;
const ptr = throttle((e) => { const b = pp.getBoundingClientRect(); if (hello) msgr.send('pointer', { x: +((e.clientX - b.left) / b.width).toFixed(3), y: +((e.clientY - b.top) / b.height).toFixed(3) }); }, 40);
pp.addEventListener('pointerdown', (e) => { pp.setPointerCapture(e.pointerId); pOn = true; ptr(e); });
pp.addEventListener('pointermove', (e) => { if (pOn) ptr(e); });
pp.addEventListener('pointerup', () => { pOn = false; });
window.__remote = { get state() { return state; }, get hello() { return hello; }, get live() { return live; }, send };
