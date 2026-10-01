import React, { createContext, useContext } from "react";

/* Compound tabs: <Tabs value onChange><Tabs.List><Tabs.Tab id>…</Tabs.Tab></Tabs.List><Tabs.Panel id>…</Tabs.Panel></Tabs>.
   Arrow keys move between tabs, as the ARIA tabs pattern expects. */
const TabsCtx = createContext(null);

export default function Tabs({ value, onChange, children }) {
  return <TabsCtx.Provider value={{ value, onChange }}>{children}</TabsCtx.Provider>;
}

Tabs.List = function TabList({ children, label }) {
  const handleKeyDown = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const tabs = [...e.currentTarget.querySelectorAll('[role="tab"]')];
    const i = tabs.indexOf(document.activeElement);
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    next.focus(); next.click();
  };
  return <div className="tabs" role="tablist" aria-label={label} onKeyDown={handleKeyDown}>{children}</div>;
};

Tabs.Tab = function Tab({ id, children }) {
  const { value, onChange } = useContext(TabsCtx);
  const on = value === id;
  return (
    <button className={"tab" + (on ? " on" : "")} role="tab" id={"tab-" + id} aria-selected={on} aria-controls={"pane-" + id}
      tabIndex={on ? 0 : -1} onClick={() => onChange(id)}>{children}</button>
  );
};

Tabs.Panel = function TabPanel({ id, children }) {
  const { value } = useContext(TabsCtx);
  return (
    <div className={"pane" + (value === id ? " on" : "")} role="tabpanel" id={"pane-" + id} aria-labelledby={"tab-" + id} hidden={value !== id}>
      {children}
    </div>
  );
};
