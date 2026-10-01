import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GROUP_BY_ID, groupColor } from "../lib/model.js";

/* One tooltip for the whole page. Charts and the map call show(content, event)
   with React content (never HTML strings), so labels from the feed are
   always rendered as text. */
const TooltipCtx = createContext({ show: () => {}, hide: () => {} });
export const useTooltip = () => useContext(TooltipCtx);

export function TooltipProvider({ children }) {
  const [tip, setTip] = useState(null);
  const ref = useRef(null);
  const show = useCallback((content, ev) => setTip({ content, x: ev.clientX, y: ev.clientY }), []);
  const hide = useCallback(() => setTip(null), []);
  /* Stable value: consumers (the map especially) must not re-run effects
     every time the tooltip moves. */
  const api = useMemo(() => ({ show, hide }), [show, hide]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !tip) return;
    const pad = 14, w = el.offsetWidth, h = el.offsetHeight;
    let x = tip.x + pad, y = tip.y + pad;
    if (x + w > window.innerWidth - 8) x = tip.x - w - pad;
    if (y + h > window.innerHeight - 8) y = tip.y - h - pad;
    el.style.left = Math.max(8, x) + "px";
    el.style.top = Math.max(8, y) + "px";
  }, [tip]);
  return (
    <TooltipCtx.Provider value={api}>
      {children}
      {tip && <div id="tip" ref={ref} role="tooltip" style={{ display: "block" }}>{tip.content}</div>}
    </TooltipCtx.Provider>
  );
}

/* Tooltip rows lead with the value and key each group with a short line. */
export function TipRows({ rows }) {
  return rows.map(({ id, value, note }) => (
    <div className="tr" key={id}>
      <i style={{ background: groupColor(id) }} aria-hidden="true" />
      <b>{value}</b>
      <span>{GROUP_BY_ID[id].name}{note ? " " + note : ""}</span>
    </div>
  ));
}
