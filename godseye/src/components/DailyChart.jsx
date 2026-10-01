import React, { useState } from "react";
import { GROUPS, groupColor } from "../lib/model.js";
import { useElementWidth } from "../hooks/useElementWidth.js";
import { TipRows, useTooltip } from "./Tooltip.jsx";

const colPath = (x, y, w, h, r = 4) => {
  r = Math.min(r, w / 2, h / 2);
  return `M${x},${y + h}v-${h - r}a${r},${r} 0 0 1 ${r},-${r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}z`;
};
const dayLabel = (d, opts) => new Date(d + "T12:00:00+05:30").toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", ...opts });

/* Headlines per day for the last 7 IST days, stacked by primary group so
   each column's total is the day's headline count. The whole column is the
   hit target and the tooltip lists every group for that day. */
export default function DailyChart({ stats }) {
  const [ref, width] = useElementWidth(440);
  const [hover, setHover] = useState(-1);
  const tip = useTooltip();
  const ids = GROUPS.map((g) => g.id);
  const totals = stats.days.map((d) => ids.reduce((a, g) => a + stats.daily[d][g], 0));
  const max = Math.max(1, ...totals);
  const step = Math.max(1, Math.ceil(max / 4 / 5) * 5), top = Math.ceil(max / step) * step;
  const H = 232, L = 30, B = 22, T = 18, ph = H - B - T;
  const cw = Math.max(20, (width - L) / 7), bw = Math.min(46, cw * 0.62);
  const ticks = []; for (let v = 0; v <= top; v += step) ticks.push(v);

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${width} ${H}`} height={H} role="img" aria-label="Headlines per day, last 7 days">
        <g className="grid">
          {ticks.map((v) => { const y = T + ph - (ph * v) / top; return (
            <g key={v}><line x1={L} x2={width} y1={y} y2={y} /><text className="axis" x={L - 6} y={y + 3} textAnchor="end">{v}</text></g>
          ); })}
        </g>
        {stats.days.map((d, i) => {
          const x = L + i * cw + (cw - bw) / 2, h = (ph * totals[i]) / top, y0 = T + ph;
          let y = y0;
          return (
            <g key={d} opacity={hover === -1 || hover === i ? 1 : 0.55}>
              <clipPath id={"dc-" + i}><path d={colPath(x, y0 - h, bw, Math.max(h, 0.01))} /></clipPath>
              <g clipPath={`url(#dc-${i})`}>
                {ids.map((g) => {
                  const v = stats.daily[d][g];
                  if (!v) return null;
                  const sh = (ph * v) / top;
                  const el = <rect key={g} x={x} y={y - sh + 2} width={bw} height={Math.max(0, sh - 2)} fill={groupColor(g)} />;
                  y -= sh;
                  return el;
                })}
              </g>
              {totals[i] > 0 && <text className="val" x={x + bw / 2} y={y0 - h - 5} textAnchor="middle">{totals[i]}</text>}
              <text className="axis" x={x + bw / 2} y={H - 6} textAnchor="middle">{dayLabel(d, { weekday: "short", day: "numeric" })}</text>
              <rect x={L + i * cw} y={T} width={cw} height={ph} fill="transparent"
                onPointerMove={(e) => { setHover(i); tip.show(
                  <><div className="tt">{dayLabel(d, { weekday: "long", day: "numeric", month: "short" })} · {totals[i]} headlines</div>
                    <TipRows rows={ids.slice().reverse().map((g) => ({ id: g, value: stats.daily[d][g] }))} /></>, e); }}
                onPointerLeave={() => { setHover(-1); tip.hide(); }} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function DailyTable({ stats }) {
  return (
    <table className="dt">
      <thead><tr><th>Day</th>{GROUPS.map((g) => <th key={g.id}>{g.name}</th>)}<th>Total</th></tr></thead>
      <tbody>
        {stats.days.map((d) => {
          const row = GROUPS.map((g) => stats.daily[d][g.id]);
          return <tr key={d}><td>{dayLabel(d, { weekday: "short", day: "numeric", month: "short" })}</td>{row.map((v, i) => <td key={i}>{v}</td>)}<td>{row.reduce((a, b) => a + b, 0)}</td></tr>;
        })}
      </tbody>
    </table>
  );
}
