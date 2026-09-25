import React from "react";
import { GROUPS, MARKETS, groupColor } from "../lib/model.js";
import { useElementWidth } from "../hooks/useElementWidth.js";
import { TipRows, useTooltip } from "./Tooltip.jsx";

/* Square baseline end, 4px rounded data end. */
const barPath = (x, y, w, h, r = 4) => {
  r = Math.min(r, w / 2, h / 2);
  return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}h-${w - r}z`;
};

function CityTip({ c }) {
  return (
    <>
      <div className="tt">{c.name} · index {c.index}{MARKETS[c.name] ? ` · Autopilot ${MARKETS[c.name]} market` : ""}</div>
      <TipRows rows={GROUPS.filter((g) => c.by[g.id]).map((g) => ({ id: g.id, value: c.by[g.id] * g.weight, note: `(${c.by[g.id]} x${g.weight})` }))} />
      <div className="th">Click to filter the feed to {c.name}.</div>
    </>
  );
}

/* Top cities by signal index, stacked by group contribution. Horizontal
   bars because the labels are words and the job is ranking. */
export default function CityChart({ stats, selected, onSelect, limit = 10 }) {
  const [ref, width] = useElementWidth(520);
  const tip = useTooltip();
  const top = stats.ranked.slice(0, limit);
  if (!top.length) return <div className="empty">No headline names a city right now.</div>;

  const LW = 104, VW = 34, rowH = 24, gap = 8;
  const H = top.length * (rowH + gap);
  const span = Math.max(40, width - LW - VW), max = top[0].index;
  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${width} ${H}`} height={H} role="img" aria-label="Top cities by signal index">
        {top.map((c, i) => {
          const y = i * (rowH + gap), bw = Math.max(3, (span * c.index) / max);
          let x = LW;
          return (
            <g key={c.name} className={"rowhit" + (selected === c.name ? " sel" : "")} onClick={() => onSelect(c.name)}
              onPointerMove={(e) => tip.show(<CityTip c={c} />, e)} onPointerLeave={tip.hide}>
              <rect className="hl" x="0" y={y - 3} width={width} height={rowH + 6} rx="6" />
              {MARKETS[c.name] && (
                <circle cx="7" cy={y + rowH / 2} r="3.5" fill={MARKETS[c.name] === "home" ? "#2fbf71" : "none"} stroke="#2fbf71" strokeWidth="1.5">
                  <title>{`Autopilot ${MARKETS[c.name]} market`}</title>
                </circle>
              )}
              <text className="lbl" x={LW - 10} y={y + rowH / 2 + 4} textAnchor="end">{c.name}</text>
              <clipPath id={"cc-" + i}><path d={barPath(LW, y, bw, rowH)} /></clipPath>
              <g clipPath={`url(#cc-${i})`}>
                {GROUPS.map((g) => {
                  const v = c.by[g.id] * g.weight;
                  if (!v) return null;
                  const w = (bw * v) / c.index;
                  const el = <rect key={g.id} x={x} y={y} width={Math.max(0, w - 2)} height={rowH} fill={groupColor(g.id)} />;
                  x += w;
                  return el;
                })}
              </g>
              <text className="val" x={LW + bw + 6} y={y + rowH / 2 + 4}>{c.index}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function CityTable({ stats, limit = 10 }) {
  return (
    <table className="dt">
      <thead><tr><th>City</th><th>Index</th>{GROUPS.map((g) => <th key={g.id}>{g.name}</th>)}</tr></thead>
      <tbody>
        {stats.ranked.slice(0, limit).map((c) => (
          <tr key={c.name}><td>{c.name}{MARKETS[c.name] ? ` (${MARKETS[c.name]})` : ""}</td><td>{c.index}</td>{GROUPS.map((g) => <td key={g.id}>{c.by[g.id] || ""}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
