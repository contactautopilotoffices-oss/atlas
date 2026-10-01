import React from "react";
import { Reveal } from "cube-motion/react";

/* Largest rounds in the feed, one column per currency as printed. Sorting
   reads the number; the screen shows the printed text, never a conversion. */
function RoundList({ title, list, onAssess }) {
  return (
    <div>
      <h3>{title}</h3>
      {list.length === 0 && <div className="empty tight">None in the feed.</div>}
      {list.map(({ item }) => (
        <div className="round" key={item.id}>
          <span className="amt">{item.amount}</span>
          <span className="t"><a href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a></span>
          <button className="mini" onClick={() => onAssess(item)}>Assess</button>
        </div>
      ))}
    </div>
  );
}

export default function Rounds({ stats, onAssess, limit = 6 }) {
  return (
    <Reveal as="section" className="card" aria-label="Largest rounds in the feed">
      <div className="ch"><h2>Largest rounds in the feed</h2><span className="sub">amounts as printed, never converted</span></div>
      <div className="rounds">
        <RoundList title="Printed in US$" list={stats.rounds.USD.slice(0, limit)} onAssess={onAssess} />
        <RoundList title="Printed in Rs / ₹" list={stats.rounds.INR.slice(0, limit)} onAssess={onAssess} />
      </div>
    </Reveal>
  );
}
