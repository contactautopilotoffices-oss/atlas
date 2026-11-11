// The live link between a display showing the Volt floor and a presenter's phone.
//
// Transport: Supabase Realtime "broadcast" on a channel whose name comes from a
// one-time secret (carried in the QR code, never sent to our servers). Where the
// site has no Supabase config (a local test), a BroadcastChannel stands in, which
// only reaches tabs of the same browser.
//
// Every message is signed (HMAC-SHA256) so the display acts only on messages from
// a phone that holds the secret, and, when the display was signed in at the gate,
// from someone who also typed the same ID and password.

const enc = new TextEncoder();
export async function sha256hex(s) {
  const b = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export const norm = (v) => String(v || '').trim().toUpperCase().replace(/[\s-]/g, '');
/** A value derived from the ID and password (never the password itself). Stored by the gate at sign-in. */
export const credKey = (id, pw) => sha256hex('remote-key:' + norm(id) + ':' + norm(pw));
export const gateHash = (id, pw) => sha256hex(norm(id) + ':' + norm(pw));
export function randomSecret(bytes = 16) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return [...a].map(x => x.toString(16).padStart(2, '0')).join('');
}
/** Keys for a session: k0 needs only the QR secret; k also needs the credentials. */
export async function sessionKeys(secret, cred) {
  const imp = async (hex) => crypto.subtle.importKey('raw', enc.encode(hex), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return { k0: await imp(await sha256hex('open:' + secret)), k: cred ? await imp(await sha256hex(cred + ':' + secret)) : null };
}
export async function sign(key, body) {
  const b = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return [...new Uint8Array(b)].slice(0, 16).map(x => x.toString(16).padStart(2, '0')).join('');
}
export const channelName = async (secret) => 'volt-remote-' + (await sha256hex('channel:' + secret)).slice(0, 24);

export function loadScript(src) {
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('could not load ' + src)); document.head.appendChild(s); });
}

/** Open the channel. onMsg(obj) gets every message from the other side; onStatus('live' | 'local' | 'down'). */
export async function openLink(name, onMsg, onStatus = () => {}) {
  const url = window.SUPABASE_URL, key = window.SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      if (!window.supabase) await loadScript('/engine/vendor/supabase/supabase.js');
      const sb = window.supabase.createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 40 } } });
      const ch = sb.channel(name, { config: { broadcast: { self: false, ack: false } } });
      ch.on('broadcast', { event: 'm' }, ({ payload }) => onMsg(payload));
      await new Promise((ok, no) => {
        const t = setTimeout(() => no(new Error('timeout')), 9000);
        ch.subscribe((st) => {
          if (st === 'SUBSCRIBED') { clearTimeout(t); onStatus('live'); ok(); }
          else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') onStatus('down');
        });
      });
      return { kind: 'live', send: (obj) => ch.send({ type: 'broadcast', event: 'm', payload: obj }), close: () => sb.removeChannel(ch) };
    } catch (e) { console.warn('[volt remote] live link failed, using this browser only:', e && e.message); }
  }
  const bc = new BroadcastChannel(name);
  bc.onmessage = (e) => onMsg(e.data);
  onStatus('local');
  return { kind: 'local', send: (obj) => bc.postMessage(obj), close: () => bc.close() };
}

/** Pack and unpack signed messages. n is a counter that must go up, so an old message cannot be replayed. */
export function messenger(link, keys, from, counter = { n: 0 }) {
  let mode = 'k0';
  return {
    setMode(m) { mode = m; },
    get mode() { return mode; },
    async send(t, a = {}, both = false) {
      const n = ++counter.n, body = JSON.stringify([from, t, a, n]);
      const msg = { f: from, t, a, n, s0: both || mode === 'k0' ? await sign(keys.k0, body) : undefined, s: keys.k && (both || mode === 'k') ? await sign(keys.k, body) : undefined };
      link.send(msg);
    },
  };
}
export async function verify(msg, keys, wantMode) {
  if (!msg || typeof msg.t !== 'string' || typeof msg.n !== 'number') return false;
  const body = JSON.stringify([msg.f, msg.t, msg.a, msg.n]);
  if (wantMode === 'k') return !!keys.k && !!msg.s && msg.s === await sign(keys.k, body);
  return !!msg.s0 && msg.s0 === await sign(keys.k0, body);
}
