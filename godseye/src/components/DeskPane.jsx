import React, { useEffect, useRef } from "react";
import { Morph } from "cube-motion/react";
import AnswerView from "./AnswerView.jsx";
import { host } from "../lib/model.js";

export const PRESETS = [
  ["Where do we bet this week?", "Where should Autopilot place its next bets this week? Rank the companies to call and the micro-markets to build supply in."],
  ["Fresh money", "Which companies raised Series A or later in the last 14 days and employ people in Mumbai, Delhi NCR or Bengaluru? Rank them by how soon they will need 30 or more seats."],
  ["GCC radar", "Which foreign companies announced or expanded a GCC or India centre in the last 30 days? For each: city, headcount target, the named site leader if a source names one, and how Autopilot gets in front of them."],
  ["Competitor watch", "What have WeWork India, Awfis, Smartworks, IndiQube, Table Space and BHIVE done in the last 30 days? Where are they adding supply, and what should Autopilot do about it?"],
  ["Micro-market heat", "Which Indian office micro-markets are heating up right now based on leasing, GCC and hiring news, and which are cooling? Say which ones Autopilot should build supply in."],
  ["Work model debate", "What is the current debate on return to office in India, which large employers changed policy recently, and what does it mean for seat demand?"],
];

function Sources({ list }) {
  if (!list.length) return null;
  return (
    <details className="sources">
      <summary>{list.length} source{list.length === 1 ? "" : "s"} read</summary>
      <ol>{list.map((s) => (
        <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title || host(s.url)}</a> <span>{host(s.url)}{s.page_age ? " · " + s.page_age : ""}</span></li>
      ))}</ol>
    </details>
  );
}

export default function DeskPane({ server, desk, answer, question, setQuestion, pinnedCount, onClearPins, onAsk, onFocusCity, inputRef }) {
  const { run, busy, stop, recent, showSaved } = desk;
  const logRef = useRef(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [run && run.log.length]);

  return (
    <div className="dbody">
      <div className="presets">
        {PRESETS.map(([label, q]) => <button key={label} className="chip" disabled={busy} onClick={() => onAsk(q)}>{label}</button>)}
      </div>
      {pinnedCount > 0 && (
        <div className="pins on"><span>{pinnedCount} pinned signal{pinnedCount > 1 ? "s" : ""} go with your question.</span><button className="mini" onClick={onClearPins}>Clear</button></div>
      )}
      <div className="ask">
        <textarea ref={inputRef} aria-label="Question for the desk" value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder="Where should Autopilot place its next bet? Ask about companies, micro-markets, competitors or policy."
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onAsk(question); }} />
        <div className="askrow">
          <div className="hint">Checks the news live and links every fact. One to three minutes.</div>
          {busy && <button className="btn ghost" onClick={stop}>Stop</button>}
          <button className="btn" onClick={() => onAsk(question)} disabled={busy}><Morph active={busy} off="Ask" on="Working" /></button>
        </div>
      </div>
      {server.key_configured === false && (
        <div className="banner">The desk is waiting for its API key ({server.key_name || "API key"} on the server). The dashboard works now; questions run once the key is set.</div>
      )}
      {run && (
        <div aria-live="polite">
          {run.log.length > 0 && (
            <div className="log" ref={logRef}>{run.log.map((l, i) => <div key={i} className={i === run.log.length - 1 ? "now" : ""}>{l}</div>)}</div>
          )}
          <AnswerView answer={answer} onFocusCity={onFocusCity} />
          {run.error && <div className="err" role="alert">{run.error}</div>}
          <Sources list={run.sources} />
          {run.footer && <div className="foot">{run.footer}</div>}
        </div>
      )}
      {recent.length > 0 && (
        <div className="recent">
          <h4>Recent answers on this device</h4>
          {recent.map((r) => (
            <button key={r.at} onClick={() => { setQuestion(r.q); showSaved(r); }}>
              {r.q.slice(0, 100)}<small>{new Date(r.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
