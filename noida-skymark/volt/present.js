// Presenter remote, display side. The display shows a QR code; a phone opens the
// link in it, signs in with the same Atlas ID and password, and then drives this
// page. The page itself decides what each command does (see runCommand in volt.js).
import { randomSecret, sessionKeys, channelName, openLink, messenger, verify, loadScript } from './link.js';

const $ = (s) => document.querySelector(s);
export function createPresenter({ run, hello, state }) {
  const P = { on: false, secret: null, link: null, keys: null, msgr: null, mode: 'k0', ctrl: null, lastN: {}, lastSeen: 0, ready: false, sent: '', waiting: null, url: '' };

  async function open() {
    if (P.on) return;
    P.secret = randomSecret();
    let cred = null; try { cred = sessionStorage.getItem('noida-skymark-rk'); } catch (e) {}
    P.keys = await sessionKeys(P.secret, cred); P.mode = cred ? 'k' : 'k0';
    P.link = await openLink(await channelName(P.secret), onMsg, (st) => { P.status = st; paint(); });
    P.cnt = { n: 0 }; P.msgr = messenger(P.link, P.keys, 'display', P.cnt); P.msgr.setMode(P.mode);
    P.m0 = messenger(P.link, P.keys, 'display', P.cnt); P.m0.setMode('k0');
    P.url = `${location.origin}/noida-skymark/volt/remote.html#s=${P.secret}`;
    P.on = true; document.body.classList.add('present'); await drawQR(); paint(); showPair(true);
    setInterval(tick, 200);
  }
  async function drawQR() {
    try {
      if (!window.qrcode) await loadScript('/engine/vendor/qrcode/qrcode.js');
      const q = window.qrcode(0, 'M'); q.addData(P.url); q.make();
      const n = q.getModuleCount(), c = $('#pairqr'), cell = Math.floor(520 / (n + 4)), pad = cell * 2; c.width = c.height = cell * n + pad * 2;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#111';
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) g.fillRect(pad + x * cell, pad + y * cell, cell, cell);
    } catch (e) { console.warn('[volt remote] QR', e && e.message); }
  }
  function paint() {
    $('#pairurl').textContent = P.url.replace(/^https?:\/\//, '');
    $('#pairnote').textContent = P.status === 'local' ? 'No live link is set up on this site, so the remote only works in another tab of this same browser.'
      : P.status === 'down' ? 'The live link dropped. Check the internet connection on this display.'
      : (P.mode === 'k' ? 'Sign in on the phone with the same Atlas ID and password as this display.' : 'Sign in on the phone with your Atlas ID and password.');
    const chip = $('#pairchip'); chip.textContent = P.ctrl ? 'Remote connected' : 'Waiting for the remote · show QR'; chip.classList.toggle('ok', !!P.ctrl);
  }
  function showPair(on) { $('#pair').classList.toggle('show', on); }

  async function onMsg(msg) {
    if (!msg || msg.f === 'display') return;
    if (!(msg.n > (P.lastN[msg.f] || 0))) return;                           // old or replayed
    if (msg.t === 'hello') {
      const ok = await verify(msg, P.keys, P.mode);
      if (!ok) { if (P.mode === 'k' && await verify(msg, P.keys, 'k0')) { P.lastN[msg.f] = msg.n; reply0('denied', { to: msg.f }); } return; }
      P.lastN[msg.f] = msg.n;
      if (P.mode === 'k0' && !(msg.a && msg.a.auth)) return;
      if (P.ctrl && P.ctrl !== msg.f && !(msg.a && msg.a.take) && Date.now() - P.lastSeen < 15000) { reply0('busy', { to: msg.f }); return; }
      if (P.ctrl && P.ctrl !== msg.f) reply0('taken', { to: P.ctrl });
      P.ctrl = msg.f; P.lastSeen = Date.now(); P.sent = ''; paint(); showPair(false);
      if (P.waiting) { const w = P.waiting; P.waiting = null; w(); }
      if (P.ready) welcome(); else reply0('wait', { to: msg.f });
      return;
    }
    if (msg.f !== P.ctrl || !(await verify(msg, P.keys, P.mode))) return;
    P.lastN[msg.f] = msg.n; P.lastSeen = Date.now();
    if (msg.t === 'ping') return;
    if (msg.t === 'bye') { P.ctrl = null; paint(); return; }
    if (msg.t === 'pointer') return pointer(msg.a);
    if (msg.t === 'qr') return showPair(!!(msg.a && msg.a.on));
    try { run(msg.t, msg.a || {}); } catch (e) { console.warn('[volt remote] command', msg.t, e && e.message); }
  }
  // replies that must be readable before the two sides agree on a key use the QR-only key
  async function reply0(t, a) { await P.m0.send(t, a, true); }
  function welcome() { P.msgr.send('welcome', { to: P.ctrl, mode: P.mode, hello: hello() }, true); P.sent = ''; }
  function tick() {
    if (!P.ready || !P.ctrl) return;
    if (Date.now() - P.lastSeen > 20000) { P.ctrl = null; paint(); try { run('move', { f: 0, s: 0 }); } catch (e) {} return; }
    const s = JSON.stringify(state());                                    // on change, and every few seconds so the phone knows the display is alive
    if (s !== P.sent || Date.now() - (P.sentAt || 0) > 4000) { P.sent = s; P.sentAt = Date.now(); P.msgr.send('state', JSON.parse(s)); }
  }
  let ptrT = 0;
  function pointer(a) {
    const el = $('#ptr'); if (!a || a.on === false) { el.classList.remove('show'); return; }
    el.style.left = (Math.max(0, Math.min(1, a.x)) * 100) + '%'; el.style.top = (Math.max(0, Math.min(1, a.y)) * 100) + '%';
    el.classList.add('show'); clearTimeout(ptrT); ptrT = setTimeout(() => el.classList.remove('show'), 2500);
  }

  $('#pairchip').onclick = () => showPair(!$('#pair').classList.contains('show'));
  $('#pairx').onclick = () => showPair(false);
  return {
    /** On a display that is not signed in (a TV with no keyboard): show the QR and wait for a phone to sign in. */
    async gateIfNeeded() {
      if (!window.__pairFirst) return;
      document.body.classList.add('pairgate'); await open();
      await new Promise((ok) => { P.waiting = ok; });
      try { sessionStorage.setItem('noida-skymark-auth', '1'); } catch (e) {}
      document.body.classList.remove('pairgate');
    },
    /** The scene is built: greet a waiting phone and start reporting state. */
    ready() { P.ready = true; if (P.ctrl) welcome(); },
    async toggle() { if (!P.on) return open(); showPair(!$('#pair').classList.contains('show')); },
    get on() { return P.on; }, get connected() { return !!P.ctrl; }, get url() { return P.url; },
  };
}
