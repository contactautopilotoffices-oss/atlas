/* Signal model: groups, cities, markets and the stats every panel reads.
   Everything here is counted from the feed; nothing is estimated. */

/* Keyword tags from the server fold into five groups plus Other. An item's
   primary group (used by stacked charts, so totals add up) is the first match
   in PRIMARY_ORDER; filters match any of its groups. Colours are categorical
   slots 1 to 5 of the validated dark palette (see index.html :root). */
export const GROUPS = [
  { id: "funding", name: "Funding", tags: ["funding"], weight: 3 },
  { id: "gcc", name: "GCC and India centres", tags: ["gcc"], weight: 4 },
  { id: "grow", name: "Hiring and expansion", tags: ["hiring", "expansion"], weight: 2 },
  { id: "lease", name: "Leasing", tags: ["leasing"], weight: 2 },
  { id: "comp", name: "Competitors", tags: ["competitor"], weight: 1 },
  { id: "other", name: "Other", tags: ["policy", "rto", "contraction"], weight: 1 },
];
export const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g]));
const PRIMARY_ORDER = ["gcc", "funding", "grow", "lease", "comp", "other"];
export const groupColor = (id) => `var(--g-${id})`;
export const groupsOf = (item) => GROUPS.filter((g) => g.tags.some((t) => item.tags.includes(t))).map((g) => g.id);
export const primaryOf = (item) => { const gs = groupsOf(item); return PRIMARY_ORDER.find((g) => gs.includes(g)) || "other"; };

/* City centres, for plotting only: a bubble means "headlines that name this
   city", never a building or site. Names match CITIES in api/godseye/_lib.js. */
export const CITY_XY = {
  "Mumbai": [72.8777, 19.0760], "Navi Mumbai": [73.0297, 19.0330], "Thane": [72.9781, 19.2183],
  "Bengaluru": [77.5946, 12.9716], "Delhi": [77.2090, 28.6139], "Gurugram": [77.0266, 28.4595],
  "Noida": [77.3910, 28.5355], "Hyderabad": [78.4867, 17.3850], "Pune": [73.8567, 18.5204],
  "Chennai": [80.2707, 13.0827], "Kolkata": [88.3639, 22.5726], "Ahmedabad": [72.5714, 23.0225],
  "GIFT City": [72.6806, 23.1645], "Kochi": [76.2673, 9.9312], "Jaipur": [75.7873, 26.9124],
  "Chandigarh": [76.7794, 30.7333], "Indore": [75.8577, 22.7196], "Coimbatore": [76.9558, 11.0168],
};
const CITY_RE = Object.keys(CITY_XY).sort((a, b) => b.length - a.length)
  .map((c) => [c, new RegExp("\\b" + c.replace(/ /g, "\\s+") + "\\b", "i")])
  .concat([["Bengaluru", /\bbangalore\b/i], ["Gurugram", /\bgurgaon\b/i]]);
export function findCity(text) {
  for (const [c, re] of CITY_RE) if (re.test(text || "")) return c;
  return null;
}

/* Autopilot's markets. Mirrors AUTOPILOT_PROFILE in api/godseye/_lib.js;
   edit both together. */
export const MARKETS = {
  "Mumbai": "home", "Navi Mumbai": "home", "Thane": "home", "Delhi": "home", "Gurugram": "home",
  "Noida": "home", "Bengaluru": "home", "Hyderabad": "expansion", "Pune": "expansion", "Chennai": "expansion",
};

const DAY = 86400000;
export const istDay = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/* Reads a printed amount as a number in its own currency, only to sort. The
   screen always shows the amount exactly as the headline printed it. */
export function parseAmount(s) {
  if (!s) return null;
  const rupee = /(rs\.?|₹|inr)/i.test(s), dollar = /(\$|usd)/i.test(s);
  const indianUnit = /(crore|\bcr\b|lakh)/i.test(s);
  if (!rupee && !dollar && !indianUnit) return null;
  const m = s.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(billion|bn|b|million|mn|m|crore|cr|lakh|k)?\b/i);
  if (!m) return null;
  const mult = { billion: 1e9, bn: 1e9, b: 1e9, million: 1e6, mn: 1e6, m: 1e6, crore: 1e7, cr: 1e7, lakh: 1e5, k: 1e3 }[(m[2] || "").toLowerCase()] || 1;
  return { currency: dollar && !rupee ? "USD" : "INR", value: parseFloat(m[1]) * mult };
}

const emptyByGroup = () => Object.fromEntries(GROUPS.map((g) => [g.id, 0]));

export function computeStats(items, now = Date.now()) {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(istDay(now - i * DAY));
  const daily = Object.fromEntries(days.map((d) => [d, emptyByGroup()]));
  const week = emptyByGroup();
  const cities = {};
  let withCity = 0;
  for (const it of items) {
    const ts = it.published_at ? Date.parse(it.published_at) : NaN;
    const pg = primaryOf(it);
    if (Number.isFinite(ts) && now - ts <= 7 * DAY) {
      for (const g of groupsOf(it)) week[g]++;
      const d = istDay(ts);
      if (daily[d]) daily[d][pg]++;
    }
    if (it.cities.length) withCity++;
    for (const c of it.cities) {
      if (!CITY_XY[c]) continue;
      const s = cities[c] || (cities[c] = { name: c, index: 0, count: 0, by: emptyByGroup(), items: [] });
      s.index += GROUP_BY_ID[pg].weight; s.count++; s.by[pg]++; s.items.push(it);
    }
  }
  const ranked = Object.values(cities).sort((a, b) => b.index - a.index || b.count - a.count);
  const rounds = { USD: [], INR: [] };
  for (const it of items) {
    if (!it.tags.includes("funding") || !it.amount) continue;
    const a = parseAmount(it.amount);
    if (a) rounds[a.currency].push({ item: it, value: a.value });
  }
  rounds.USD.sort((a, b) => b.value - a.value);
  rounds.INR.sort((a, b) => b.value - a.value);
  return { days, daily, week, cities, ranked, withCity, rounds, total: items.length };
}

export const fmt = (n) => Number(n).toLocaleString("en-IN");
export function ago(iso) {
  if (!iso) return "date unknown";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.round(m / 60);
  if (h < 36) return h + "h ago";
  return Math.round(h / 24) + "d ago";
}
export const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
