import { useEffect, useRef, useState } from "react";

/* Width of an element, kept current with ResizeObserver, so SVG charts draw
   at their real size instead of scaling text. */
export function useElementWidth(initial = 480) {
  const ref = useRef(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
