import React from "react";
import { Rise } from "cube-motion/react";
import { GROUPS, MARKETS, fmt, groupColor } from "../lib/model.js";

/* Five group tiles (headlines in the last 7 days, click to filter) and one
   "where to look next" tile: the city with the highest signal index outside
   Autopilot's markets. Hero numbers, not charts: each tile answers one
   question with one number. */
export default function KpiStrip({ stats, group, city, onGroup, onCity }) {
  if (!stats) {
    return <div className="kpis">{Array.from({ length: 6 }, (_, i) => <div className="kpi skeleton" key={i} aria-hidden="true" />)}</div>;
  }
  const hot = stats.ranked.find((c) => !MARKETS[c.name]);
  return (
    <Rise className="kpis" targets="children">
      {GROUPS.filter((g) => g.id !== "other").map((g) => (
        <button key={g.id} className={"kpi" + (group === g.id ? " on" : "")} style={{ "--k": groupColor(g.id) }}
          onClick={() => onGroup(g.id)} aria-pressed={group === g.id}>
          <div className="l">{g.name}</div>
          <div className="v num">{fmt(stats.week[g.id])}</div>
          <div className="f">headlines, last 7 days</div>
        </button>
      ))}
      {hot ? (
        <button className={"kpi city" + (city === hot.name ? " on" : "")} style={{ "--k": "var(--acc)" }}
          onClick={() => onCity(hot.name)} aria-pressed={city === hot.name}>
          <div className="l">Hottest city outside our markets</div>
          <div className="v">{hot.name}</div>
          <div className="f">signal index {hot.index} · {hot.count} headlines</div>
        </button>
      ) : (
        <div className="kpi city">
          <div className="l">Hottest city outside our markets</div>
          <div className="v">None yet</div>
          <div className="f">no headline names one</div>
        </div>
      )}
    </Rise>
  );
}
