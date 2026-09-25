import React, { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { Rise } from "cube-motion/react";
import Header from "./Header.jsx";
import KpiStrip from "./KpiStrip.jsx";
import SignalMap from "./SignalMap.jsx";
import ChartCard from "./ChartCard.jsx";
import CityChart, { CityTable } from "./CityChart.jsx";
import DailyChart, { DailyTable } from "./DailyChart.jsx";
import Rounds from "./Rounds.jsx";
import Tabs from "./Tabs.jsx";
import SignalsPane from "./SignalsPane.jsx";
import DeskPane from "./DeskPane.jsx";
import { useFeed } from "../hooks/useFeed.js";
import { useDesk } from "../hooks/useDesk.js";
import { GROUPS, fmt, groupsOf } from "../lib/model.js";
import { parseAnswer } from "../lib/answer.js";

const ALL_GROUPS = GROUPS.map((g) => g.id);
const assessPrompt = (it) => `Assess this signal for Autopilot: "${it.title}" (${it.publisher}). Verify it, find the facts that make it actionable, and tell us whether it is a bet, a watchlist item or noise. If it is a bet, give the full bet card.`;

/* Owns the page state: filters, pinned signals, the side tab, and the map
   focus. Data comes from useFeed; the desk run from useDesk. */
export default function Dashboard({ accessKey, server }) {
  const { feed, stats, error, loading, pulse, refresh } = useFeed();
  const desk = useDesk(accessKey);
  const [tab, setTab] = useState("signals");
  const [group, setGroup] = useState("");
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [question, setQuestion] = useState("");
  const [pinned, setPinned] = useState(() => new Map());
  const [mapFocus, setMapFocus] = useState(null);
  const inputRef = useRef(null);
  const sideRef = useRef(null);
  const query = useDeferredValue(q);

  const answer = useMemo(() => parseAnswer(desk.run ? desk.run.text : ""), [desk.run && desk.run.text]);
  const betPins = useMemo(() => answer.bets.map(({ n, name, city: c }) => ({ n, name, city: c })), [answer]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(ALL_GROUPS.map((g) => [g, 0]));
    for (const it of feed ? feed.items : []) for (const g of groupsOf(it)) c[g]++;
    return c;
  }, [feed]);

  const visible = useMemo(() => {
    const needle = query.toLowerCase();
    return (feed ? feed.items : []).filter((i) =>
      (!group || groupsOf(i).includes(group)) &&
      (!city || i.cities.includes(city)) &&
      (!needle || (i.title + " " + i.publisher).toLowerCase().includes(needle)));
  }, [feed, group, city, query]);

  const handleGroup = useCallback((g) => { setGroup((cur) => (cur === g ? "" : g)); setTab("signals"); }, []);
  const handleCity = useCallback((c) => { setCity((cur) => (cur === c ? "" : c)); setTab("signals"); }, []);
  const handlePin = useCallback((it) => setPinned((m) => { const n = new Map(m); n.has(it.id) ? n.delete(it.id) : n.set(it.id, it); return n; }), []);

  const handleAsk = useCallback((text, extraPin) => {
    const t = String(text || "").trim();
    if (!t) return;
    let focus = [...pinned.values()];
    if (extraPin && !pinned.has(extraPin.id)) {
      focus = [...focus, extraPin];
      setPinned((m) => new Map(m).set(extraPin.id, extraPin));
    }
    setQuestion(t);
    setTab("desk");
    desk.ask(t, focus);
  }, [pinned, desk]);
  const handleAssess = useCallback((it) => handleAsk(assessPrompt(it), it), [handleAsk]);

  const openDesk = () => {
    setTab("desk");
    if (window.matchMedia("(max-width:1020px)").matches && sideRef.current) sideRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => inputRef.current && inputRef.current.focus({ preventScroll: true }), 0);
  };

  return (
    <>
      <Header feed={feed} error={error} loading={loading} pulse={pulse} onRefresh={refresh} onOpenDesk={openDesk} />
      <div className="wrap">
        <div className="main">
          <KpiStrip stats={stats} group={group} city={city} onGroup={handleGroup} onCity={handleCity} />

          <Rise as="section" className="card mapcard" aria-label="Signal map">
            <div className="ch">
              <h2>Signal map</h2>
              <span className="sub">{stats ? `${fmt(stats.withCity)} of ${fmt(stats.total)} headlines name a city` : ""}</span>
            </div>
            <div className="mapwrap">
              {stats ? <SignalMap stats={stats} selected={city} onSelect={handleCity} bets={betPins} focus={mapFocus} /> : <div className="mapempty">Pulling the feed.</div>}
              <div className="legend">
                <div className="lg"><i className="bub" aria-hidden="true" /><span><b>Bubble</b>: signal index for the city</span></div>
                <div className="lg"><i className="ring" aria-hidden="true" /><span><b>Green ring</b>: Autopilot market</span></div>
                <div className="lg"><i className="pin" aria-hidden="true">1</i><span><b>Numbered pin</b>: a bet from the desk</span></div>
                <div className="note">Signal index: headlines naming the city, weighted GCC 4, funding 3, hiring, expansion and leasing 2, other 1. Plotted at the city centre, not a site.</div>
              </div>
            </div>
          </Rise>

          {stats && (
            <>
              <div className="row2">
                <ChartCard title="Cities" sub="signal index, by type" keys={ALL_GROUPS} table={<CityTable stats={stats} />}>
                  <CityChart stats={stats} selected={city} onSelect={handleCity} />
                </ChartCard>
                <ChartCard title="Last 7 days" sub="headlines found per day" keys={ALL_GROUPS} table={<DailyTable stats={stats} />}>
                  <DailyChart stats={stats} />
                </ChartCard>
              </div>
              <Rounds stats={stats} onAssess={handleAssess} />
            </>
          )}
        </div>

        <aside className="card side" ref={sideRef} aria-label="Signals and desk">
          <Tabs value={tab} onChange={setTab}>
            <Tabs.List label="Side panel">
              <Tabs.Tab id="signals">Signals <span className="c">{fmt(visible.length)}</span></Tabs.Tab>
              <Tabs.Tab id="desk">Desk{desk.busy ? <span className="c">working</span> : answer.bets.length ? <span className="c">{answer.bets.length} bets</span> : null}</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel id="signals">
              <SignalsPane feed={feed} error={error} items={visible} counts={counts} group={group} city={city} q={q} pinned={pinned}
                onGroup={handleGroup} onCity={handleCity} onQuery={setQ} onPin={handlePin} onAssess={handleAssess} />
            </Tabs.Panel>
            <Tabs.Panel id="desk">
              <DeskPane server={server} desk={desk} answer={answer} question={question} setQuestion={setQuestion} inputRef={inputRef}
                pinnedCount={pinned.size} onClearPins={() => setPinned(new Map())} onAsk={(t) => handleAsk(t)}
                onFocusCity={(c) => setMapFocus({ city: c, at: Date.now() })} />
            </Tabs.Panel>
          </Tabs>
        </aside>
      </div>
    </>
  );
}
