import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchFeed } from "../lib/api.js";
import { computeStats } from "../lib/model.js";

const REFRESH_MS = 5 * 60 * 1000; // matches the server cache

/* Loads the feed, refreshes it every five minutes while the tab is visible,
   and derives the stats every panel reads. `pulse` changes on each successful
   load so the live dot can pulse once per real refresh. */
export function useFeed() {
  const [feed, setFeed] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(0);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      setFeed(await fetchFeed(force));
      setError(null);
      setPulse((p) => p + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const t = setInterval(() => { if (document.visibilityState === "visible") load(false); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const stats = useMemo(() => (feed ? computeStats(feed.items || []) : null), [feed]);
  return { feed, stats, error, loading, pulse, refresh: () => load(true) };
}
