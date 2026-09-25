import React, { useEffect, useRef, useState } from "react";
import { CITY_XY, GROUPS, MARKETS } from "../lib/model.js";
import { TipRows, useTooltip } from "./Tooltip.jsx";

/* Mapbox map of India.
   - Bubble: signal index of the city (size and opacity), neutral ink so it
     never borrows a group colour.
   - Green ring: an Autopilot market (solid home, faint expansion).
   - Numbered pin: a bet from the latest desk answer.
   Mapbox GL comes from Mapbox's CDN (window.mapboxgl) with the token that
   the ATLAS build writes into config.js. window.GODSEYE_MAP_STYLE can
   override the style (used by offline tests). */
const DEFAULT_STYLE = "mapbox://styles/mapbox/dark-v11";
const INDIA = [[67.5, 6.5], [97.5, 35.8]];

function toGeo(stats) {
  const max = Math.max(1, ...stats.ranked.map((c) => c.index));
  const names = new Set([...Object.keys(MARKETS), ...Object.keys(stats.cities)]);
  return {
    type: "FeatureCollection",
    features: [...names].map((name) => {
      const s = stats.cities[name];
      const index = s ? s.index : 0;
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: CITY_XY[name] },
        properties: {
          name, index, market: MARKETS[name] || "",
          r: index ? 4 + 14 * Math.sqrt(index / max) : 5,
          op: index ? 0.2 + (0.5 * index) / max : 0,
          label: index ? `${name} ${index}` : name,
        },
      };
    }),
  };
}

function MapCityTip({ stats, name }) {
  const s = stats.cities[name];
  const mk = MARKETS[name] ? ` · Autopilot ${MARKETS[name]} market` : "";
  if (!s) return <><div className="tt">{name}{mk}</div><div>No headline names this city right now.</div></>;
  return (
    <>
      <div className="tt">{name} · index {s.index}{mk}</div>
      <TipRows rows={GROUPS.filter((g) => s.by[g.id]).map((g) => ({ id: g.id, value: s.by[g.id], note: `headline${s.by[g.id] > 1 ? "s" : ""} (x${g.weight})` }))} />
      <div className="th">{s.items.slice(0, 3).map((i) => <div key={i.id}>· {i.title.slice(0, 90)}</div>)}</div>
    </>
  );
}

export default function SignalMap({ stats, selected, onSelect, bets, focus }) {
  const box = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const statsRef = useRef(stats);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(!window.mapboxgl || !window.MAPBOX_TOKEN);
  const tip = useTooltip();
  statsRef.current = stats;
  onSelectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    if (failed || !box.current) return undefined;
    const mapboxgl = window.mapboxgl;
    mapboxgl.accessToken = window.MAPBOX_TOKEN;
    let m;
    try {
      m = new mapboxgl.Map({
        container: box.current, style: window.GODSEYE_MAP_STYLE || DEFAULT_STYLE,
        bounds: INDIA, fitBoundsOptions: { padding: 24 }, dragRotate: false, pitchWithRotate: false,
      });
    } catch {
      setFailed(true);
      return undefined;
    }
    map.current = m;
    m.touchZoomRotate.disableRotation();
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    m.on("load", () => {
      const geo = toGeo(statsRef.current);
      m.addSource("cities", { type: "geojson", data: geo });
      /* Labels get their own source: if label glyphs fail to load, Mapbox
         drops that source's tiles, and the bubbles must not go with them. */
      m.addSource("city-labels", { type: "geojson", data: geo });
      m.addLayer({ id: "market", type: "circle", source: "cities", filter: ["!=", ["get", "market"], ""],
        paint: { "circle-radius": ["+", ["get", "r"], 4], "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 2,
          "circle-stroke-color": ["match", ["get", "market"], "home", "#2fbf71", "rgba(47,191,113,.45)"] } });
      m.addLayer({ id: "bubbles", type: "circle", source: "cities", filter: [">", ["get", "index"], 0],
        paint: { "circle-radius": ["get", "r"], "circle-color": "#ecf1ff", "circle-opacity": ["get", "op"],
          "circle-stroke-width": 1.5, "circle-stroke-color": "rgba(236,241,255,.55)" } });
      m.addLayer({ id: "sel", type: "circle", source: "cities", filter: ["==", ["get", "name"], ""],
        paint: { "circle-radius": ["+", ["get", "r"], 9], "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } });
      m.addLayer({ id: "labels", type: "symbol", source: "city-labels", filter: ["any", [">", ["get", "index"], 0], ["!=", ["get", "market"], ""]],
        layout: { "text-field": ["get", "label"], "text-size": 11.5, "text-offset": [0, 1.1], "text-anchor": "top",
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "symbol-sort-key": ["-", 0, ["get", "index"]] },
        paint: { "text-color": "rgba(255,255,255,.86)", "text-halo-color": "#0b0f16", "text-halo-width": 1.4 } });
      for (const id of ["bubbles", "market"]) {
        m.on("mousemove", id, (e) => {
          m.getCanvas().style.cursor = "pointer";
          tip.show(<MapCityTip stats={statsRef.current} name={e.features[0].properties.name} />, e.originalEvent);
        });
        m.on("mouseleave", id, () => { m.getCanvas().style.cursor = ""; tip.hide(); });
        m.on("click", id, (e) => onSelectRef.current(e.features[0].properties.name));
      }
      setReady(true);
    });
    m.on("error", (e) => { if (e && e.error && /style|token|401|403/i.test(String(e.error.message || e.error.status))) setFailed(true); });
    return () => { m.remove(); map.current = null; setReady(false); };
  }, [failed, tip]);

  // Data and selection.
  useEffect(() => {
    if (!ready) return;
    const geo = toGeo(stats);
    map.current.getSource("cities").setData(geo);
    map.current.getSource("city-labels").setData(geo);
    map.current.setFilter("sel", ["==", ["get", "name"], selected || ""]);
  }, [ready, stats, selected]);

  // Numbered bet pins.
  useEffect(() => {
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    if (!ready) return;
    const perCity = {};
    for (const b of bets) {
      if (!b.city || !CITY_XY[b.city]) continue;
      const k = (perCity[b.city] = (perCity[b.city] || 0) + 1);
      const el = document.createElement("button");
      el.className = "betpin";
      el.type = "button";
      el.textContent = String(b.n);
      el.setAttribute("aria-label", `Bet ${b.n}: ${b.name}, ${b.city}`);
      el.addEventListener("click", () => {
        const card = document.getElementById("bet-" + b.n);
        if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      markers.current.push(new window.mapboxgl.Marker({ element: el, offset: [14 * (k - 1), -18 - 6 * (k - 1)] }).setLngLat(CITY_XY[b.city]).addTo(map.current));
    }
  }, [ready, bets]);

  // Fly to a city when asked (e.g. clicking a bet card header).
  useEffect(() => {
    if (ready && focus && CITY_XY[focus.city]) map.current.flyTo({ center: CITY_XY[focus.city], zoom: 8.5, speed: 1.4 });
  }, [ready, focus]);

  if (failed) {
    return <div className="mapempty">The map needs Mapbox (MAPBOX_TOKEN from the ATLAS build). Everything else on this page works without it.</div>;
  }
  return <div id="map" ref={box} />;
}
