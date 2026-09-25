import React, { memo } from "react";
import { Morph } from "cube-motion/react";
import { GROUPS, GROUP_BY_ID, ago, groupColor, groupsOf, primaryOf } from "../lib/model.js";

const FEED_LIMIT = 250;

const FeedItem = memo(function FeedItem({ item, pinned, onPin, onAssess, onCity }) {
  return (
    <article className={"item" + (pinned ? " pinned" : "")} style={{ "--gc": groupColor(primaryOf(item)) }}>
      <div className="meta">
        <b>{item.publisher}</b><span>{ago(item.published_at)}</span>
        {item.amount && <span className="amt" title="As printed in the headline">{item.amount}</span>}
      </div>
      <a className="hl" href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a>
      <div className="irow">
        {groupsOf(item).map((g) => <span className="tag" key={g}><i style={{ background: groupColor(g) }} aria-hidden="true" />{GROUP_BY_ID[g].name}</span>)}
        {item.cities.map((c) => <button className="tag city" key={c} onClick={() => onCity(c)}>{c}</button>)}
        <span className="sp" />
        <button className={"mini" + (pinned ? " on" : "")} aria-pressed={pinned} onClick={() => onPin(item)}>
          <Morph active={pinned} off="Pin" on="Pinned" />
        </button>
        <button className="mini" onClick={() => onAssess(item)}>Assess</button>
      </div>
    </article>
  );
});

/* Filters (group chips, a city chip when one is selected, text search), the
   list, and source health. Filtering happens in the parent; this only draws. */
export default function SignalsPane({ feed, error, items, counts, group, city, q, pinned, onGroup, onCity, onQuery, onPin, onAssess }) {
  let body;
  if (!feed) body = <div className="empty">{error ? `The feed could not be loaded (${error}). The desk still works: it runs its own searches.` : "Pulling the feed."}</div>;
  else if (!feed.items.length) body = <div className="empty">No headlines came back from the sources. The desk still works.</div>;
  else if (!items.length) body = <div className="empty">Nothing matches this filter.</div>;
  else body = items.slice(0, FEED_LIMIT).map((it) => (
    <FeedItem key={it.id} item={it} pinned={pinned.has(it.id)} onPin={onPin} onAssess={onAssess} onCity={onCity} />
  ));
  return (
    <>
      <div className="filters">
        <div className="chips">
          <button className={"chip" + (group ? "" : " on")} onClick={() => onGroup("")}>All <span className="c">{feed ? feed.items.length : 0}</span></button>
          {GROUPS.map((g) => (
            <button key={g.id} className={"chip" + (group === g.id ? " on" : "")} aria-pressed={group === g.id} onClick={() => onGroup(g.id)}>
              <i style={{ background: groupColor(g.id) }} aria-hidden="true" />{g.name} <span className="c">{counts[g.id] || 0}</span>
            </button>
          ))}
          {city && <button className="chip on" onClick={() => onCity(city)} aria-label={`Clear city filter ${city}`}>{city} ✕</button>}
        </div>
        <div className="frow">
          <input type="search" placeholder="Filter headlines" aria-label="Filter headlines" value={q} onChange={(e) => onQuery(e.target.value)} />
        </div>
      </div>
      <div id="feed">{body}</div>
      {feed && (
        <div className="srcs">Sources: {(feed.sources || []).map((s, i) => (
          <span key={s.id}>{i ? " · " : ""}{s.ok ? `${s.label} (${s.count})` : <span className="bad" title={s.error}>{s.label} (failed)</span>}</span>
        ))}</div>
      )}
    </>
  );
}
