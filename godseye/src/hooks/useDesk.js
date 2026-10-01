import { useCallback, useRef, useState } from "react";
import { streamAsk } from "../lib/api.js";
import { storage } from "../lib/storage.js";

const RECENT_KEY = "ge-recent";

/* Runs one question at a time against /api/godseye/ask and exposes the
   streamed state. Text from a model round that ends in a tool call is
   narration, so the server sends "discard" and it is dropped here. */
export function useDesk(accessKey) {
  const [run, setRun] = useState(null); // { question, log, text, sources, error, footer, done }
  const [recent, setRecent] = useState(() => storage.get(RECENT_KEY, []));
  const ctrl = useRef(null);
  const busy = !!(run && !run.done);

  const ask = useCallback(async (question, focus = []) => {
    question = String(question || "").trim();
    if (!question || ctrl.current) return;
    const c = new AbortController();
    ctrl.current = c;
    const t0 = Date.now();
    let text = "", roundStart = 0, sources = [];
    const patch = (p) => setRun((r) => ({ ...r, ...p }));
    setRun({ question, log: [], text: "", sources: [], error: null, footer: "", done: false });
    try {
      await streamAsk({
        key: accessKey, question, focus, signal: c.signal,
        onEvent: (ev, d) => {
          if (ev === "status") setRun((r) => ({ ...r, log: [...r.log, d.text] }));
          else if (ev === "round") roundStart = text.length;
          else if (ev === "discard") { text = text.slice(0, roundStart); patch({ text }); }
          else if (ev === "text") { text += d.t; patch({ text }); }
          else if (ev === "sources") { sources = sources.concat(d.items); patch({ sources }); }
          else if (ev === "error") patch({ error: d.message });
          else if (ev === "done") {
            const u = d.usage || {};
            patch({ footer: [d.provider, d.model, Math.round((Date.now() - t0) / 1000) + "s",
              u.exa_checks ? u.exa_checks + " Exa checks" : "",
              u.searches != null ? `${u.searches} search${u.searches === 1 ? "" : "es"}` : "",
              u.output_tokens ? `${u.input_tokens} in / ${u.output_tokens} out tokens` : ""].filter(Boolean).join(" · ") });
          }
        },
      });
      setRun((r) => ({ ...r, log: [...r.log, "Done"], done: true }));
      if (text.trim()) {
        const next = [{ q: question, a: text, sources, at: Date.now() }, ...storage.get(RECENT_KEY, [])].slice(0, 8);
        storage.set(RECENT_KEY, next);
        setRecent(next);
      }
    } catch (e) {
      if (e.name === "AbortError") setRun((r) => ({ ...r, log: [...r.log, "Stopped"], done: true }));
      else setRun((r) => ({ ...r, error: e.message, done: true }));
    } finally {
      ctrl.current = null;
    }
  }, [accessKey]);

  const stop = useCallback(() => { if (ctrl.current) ctrl.current.abort(); }, []);
  const showSaved = useCallback((r) => setRun({
    question: r.q, log: [], text: r.a, sources: r.sources || [], error: null, done: true,
    footer: "Saved answer from " + new Date(r.at).toLocaleString("en-IN") + ". Ask again for a fresh read.",
  }), []);

  return { run, busy, ask, stop, recent, showSaved };
}
