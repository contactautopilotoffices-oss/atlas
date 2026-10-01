/* Thin wrappers over the two endpoints. */
export async function fetchFeed(force) {
  const r = await fetch("/api/godseye/feed" + (force ? "?force=1" : ""), { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
  return j;
}

export async function ping(key) {
  const r = await fetch("/api/godseye/ask", {
    method: "POST", headers: { "Content-Type": "application/json", "x-godseye-key": key }, body: JSON.stringify({ ping: true }),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}

/* POSTs a question and calls onEvent(name, data) for every server-sent event. */
export async function streamAsk({ key, question, focus, signal, onEvent }) {
  const r = await fetch("/api/godseye/ask", {
    method: "POST", signal,
    headers: { "Content-Type": "application/json", "x-godseye-key": key },
    body: JSON.stringify({ question, focus }),
  });
  if (!r.ok || !(r.headers.get("content-type") || "").includes("event-stream")) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || "Server error " + r.status);
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const ev = (chunk.match(/^event: (.*)$/m) || [])[1];
      const data = (chunk.match(/^data: (.*)$/m) || [])[1];
      if (ev && data) onEvent(ev, JSON.parse(data));
    }
  }
}
