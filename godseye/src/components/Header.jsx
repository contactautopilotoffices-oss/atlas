import React, { useEffect, useRef } from "react";
import { fmt } from "../lib/model.js";

export function EyeMark() {
  return (
    <svg className="eye" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="rgba(255,255,255,.22)" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="rgba(47,191,113,.55)" />
      <path d="M3 16c3.6-6 8-9 13-9s9.4 3 13 9c-3.6 6-8 9-13 9s-9.4-3-13-9z" fill="none" stroke="#fff" strokeWidth="1.4" />
      <circle cx="16" cy="16" r="4" fill="#2fbf71" />
    </svg>
  );
}

/* The live dot pulses once per successful refresh (`pulse` changes), never
   on a timer, so its motion always means "new data just landed". */
export default function Header({ feed, error, loading, pulse, onRefresh, onOpenDesk }) {
  const dot = useRef(null);
  useEffect(() => {
    const el = dot.current;
    if (!el || !pulse) return;
    el.classList.remove("ping"); void el.offsetWidth; el.classList.add("ping");
  }, [pulse]);

  let status = "Loading feed";
  if (error && !feed) status = "Feed unavailable: " + error;
  else if (feed) {
    const s = feed.sources || [];
    const t = new Date(feed.fetched_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
    status = (
      <>Updated {t} IST<span className="long"> · {fmt(feed.items.length)} signals · {s.filter((x) => x.ok).length}/{s.length} sources</span></>
    );
  }
  return (
    <header>
      <EyeMark />
      <div className="brand">
        <div className="t">GOD'S EYE <span>by Autopilot</span></div>
        <div className="s">Where to place the next bet</div>
      </div>
      <div className="sp" />
      <div className="health" aria-live="polite">
        <span ref={dot} className={"dot" + (feed && !error ? " live" : "")} aria-hidden="true" />
        <span>{loading && !feed ? "Pulling feed" : status}</span>
      </div>
      <button className="btn ghost" onClick={onRefresh} disabled={loading} title="Pull the feed again">Refresh</button>
      <button className="btn" onClick={onOpenDesk}>Ask the desk</button>
    </header>
  );
}
