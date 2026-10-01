import React from "react";
import { Rise } from "cube-motion/react";
import { inline, markdown } from "../lib/markdown.js";

/* Renders an answer parsed by lib/answer.js. Markdown strings are escaped
   before any tag is added (see lib/markdown.js), so setting them as HTML is
   safe. Each bet card rises in as it first appears in the stream. */
const Html = ({ as: Tag = "div", html, ...rest }) => <Tag {...rest} dangerouslySetInnerHTML={{ __html: html }} />;

function Meter({ value, max }) {
  const pct = value == null ? 0 : Math.round((100 * Math.min(value, max)) / max);
  return <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value ?? undefined}><i style={{ width: pct + "%" }} /></div>;
}

function BetCard({ bet, onFocusCity }) {
  const showParts = bet.parts.some((p) => p.value != null);
  return (
    <Rise className="bet" id={"bet-" + bet.n}>
      <button className="bh" onClick={() => bet.city && onFocusCity(bet.city)} disabled={!bet.city}
        aria-label={bet.city ? `Bet ${bet.n}, show ${bet.city} on the map` : `Bet ${bet.n}`}>
        <span className="rank">{bet.n}</span>
        <span className="name">
          <Html as="span" html={inline(bet.name)} />
          <span className="where">{bet.city ? `${bet.city} · show on map` : "city not stated"}</span>
        </span>
        {bet.score != null && (
          <span className="score"><span className="n">{bet.score}</span><span className="d">of 100</span><Meter value={bet.score} max={100} /></span>
        )}
      </button>
      <div className="bb">
        {bet.fields.map((f, i) => (
          <div key={i} className={"field" + (/^move/i.test(f.label) ? " move" : "")}>
            {f.label && <div className="fl">{f.label}</div>}
            <Html html={inline(f.text)} />
          </div>
        ))}
        {showParts && (
          <div className="parts">
            {bet.parts.map((p) => (
              <div className="part" key={p.label}>
                <div className="pl"><span>{p.label}</span><b>{p.value ?? "?"}/{p.max}</b></div>
                <Meter value={p.value} max={p.max} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Rise>
  );
}

export default function AnswerView({ answer, onFocusCity }) {
  const { preamble, verdict, bets, betsIntro, sections } = answer;
  return (
    <>
      {preamble && preamble.trim() && <Html className="report" html={markdown(preamble)} />}
      {verdict != null && (
        <Rise className="verdict"><div className="k">Verdict</div><Html html={markdown(verdict)} /></Rise>
      )}
      {betsIntro && betsIntro.trim() && <Html className="report" html={markdown(betsIntro)} />}
      {bets.map((b) => <BetCard key={b.n} bet={b} onFocusCity={onFocusCity} />)}
      {sections.map((s, i) => (
        <Html key={i} className="report" html={(s.title ? `<h2>${inline(s.title)}</h2>` : "") + markdown(s.body)} />
      ))}
    </>
  );
}
