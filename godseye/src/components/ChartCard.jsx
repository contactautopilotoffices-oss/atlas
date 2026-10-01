import React, { useState } from "react";
import { Reveal } from "cube-motion/react";
import { GROUP_BY_ID, groupColor } from "../lib/model.js";

/* Card shell for a chart: title, a legend that mirrors the marks, and a
   Chart / Table switch so no value is reachable only by hovering. */
export default function ChartCard({ title, sub, keys = [], table, children, className = "" }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Reveal as="section" className={"card " + className} aria-label={title}>
      <div className="ch">
        <h2>{title}</h2>
        {sub && <span className="sub">{sub}</span>}
        <span className="sp" />
        {table && (
          <button className="mini" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>{asTable ? "Chart" : "Table"}</button>
        )}
      </div>
      {!asTable && keys.length > 0 && (
        <div className="keys">
          {keys.map((id) => <span className="key" key={id}><i style={{ background: groupColor(id) }} aria-hidden="true" />{GROUP_BY_ID[id].name}</span>)}
        </div>
      )}
      {asTable ? <div className="tablewrap">{table}</div> : children}
    </Reveal>
  );
}
