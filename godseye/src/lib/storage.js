/* Browser storage can throw (private mode, blocked site data). Every access
   goes through here so the page works without it. */
export const storage = {
  get(k, d, area = "local") { try { const v = window[area + "Storage"].getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v, area = "local") { try { window[area + "Storage"].setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
