/* ============================================================================
   ATLAS · case study costing

   The arithmetic behind a managed-office business case, as one small
   module the page and the server share. Every figure a case study prints
   about an option (its rent, what it must bill, the price a seat, where it
   breaks even, what each lever is worth) comes out of here, from a handful
   of inputs a person types into the workbook. Nothing on the page is typed
   as a result.

   The method is the Andheri costing workbook's, line for line:

     built-up         carpet ÷ efficiency
     rent a month     carpet × rate              (rate quoted on carpet)
                      built-up × rate            (rate quoted on built-up)
     fit-out          carpet × fit-out rate      one-time, recovered over the lock-in
     running          carpet × running rate      a month
     cost a month     rent + fit-out ÷ lock-in + running
     billed a month   cost × (1 + margin)
     seats            carpet ÷ sq ft a seat      (shown whole; the price uses the exact figure)
     price a seat     billed ÷ (carpet ÷ sq ft a seat)
     break-even       cost ÷ billed              = 1 ÷ (1 + margin), the same for every option

   Loads in the browser (window.Costing) and in Node (module.exports).
   ============================================================================ */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Costing = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DEFAULTS = { efficiency: 0.6, runningRate: 75, lockinMonths: 60, margin: 0.2, sqftPerSeat: 35, brokeragePct: 0.10, adsPerMonth: 150000, rentBasis: "carpet" };

  function num(v, d) { var n = typeof v === "number" ? v : parseFloat(String(v == null ? "" : v).replace(/[, ]/g, "")); return isFinite(n) ? n : d; }
  function pct(v, d) { var n = num(v, undefined); if (n === undefined) return d; return n > 1 ? n / 100 : n; }

  /* The inputs an option carries, with the sheet's defaults filled in. */
  function inputs(o, a) {
    a = a || {};
    return {
      carpet: num(o.carpet, 0),
      efficiency: pct(o.efficiency, pct(a.efficiency, DEFAULTS.efficiency)),
      rentRate: num(o.rentRate, 0),
      rentBasis: (o.rentBasis || a.rentBasis || DEFAULTS.rentBasis) === "builtup" ? "builtup" : "carpet",
      fitoutRate: num(o.fitoutRate, 0),
      runningRate: num(o.runningRate, num(a.runningRate, DEFAULTS.runningRate)),
      lockinMonths: num(o.lockinMonths, num(a.lockinMonths, DEFAULTS.lockinMonths)),
      margin: pct(o.margin, pct(a.margin, DEFAULTS.margin)),
      sqftPerSeat: num(o.sqftPerSeat, num(a.sqftPerSeat, DEFAULTS.sqftPerSeat)),
      brokeragePct: pct(o.brokeragePct, pct(a.brokeragePct, DEFAULTS.brokeragePct)),
      adsPerMonth: num(o.adsPerMonth, num(a.adsPerMonth, DEFAULTS.adsPerMonth)),
    };
  }

  /* Everything the case study says about one option's money. */
  function cost(o, a) {
    var i = inputs(o, a);
    var builtup = i.efficiency > 0 ? i.carpet / i.efficiency : 0;
    var rentOnCarpet = i.rentBasis === "builtup" ? (i.efficiency > 0 ? i.rentRate / i.efficiency : 0) : i.rentRate;
    var rentOnBuiltup = i.rentBasis === "builtup" ? i.rentRate : i.rentRate * i.efficiency;
    var rent = i.rentBasis === "builtup" ? builtup * i.rentRate : i.carpet * i.rentRate;
    var fitout = i.carpet * i.fitoutRate;
    var fitoutMonthly = i.lockinMonths > 0 ? fitout / i.lockinMonths : 0;
    var running = i.carpet * i.runningRate;
    var total = rent + fitoutMonthly + running;
    var marginAmt = total * i.margin;
    var billed = total + marginAmt;
    var seatsExact = i.sqftPerSeat > 0 ? i.carpet / i.sqftPerSeat : 0;
    var seats = Math.floor(seatsExact);
    var perSeat = function (x) { return seatsExact > 0 ? x / seatsExact : 0; };
    var perSqft = function (x) { return i.carpet > 0 ? x / i.carpet : 0; };
    var price = perSeat(billed);
    var breakEven = billed > 0 ? total / billed : 0;
    var runningCovered = billed > 0 ? (rent + running) / billed : 0;
    return {
      inputs: i,
      builtup: builtup, rentOnCarpet: rentOnCarpet, rentOnBuiltup: rentOnBuiltup,
      rent: rent, fitout: fitout, fitoutMonthly: fitoutMonthly, running: running,
      total: total, margin: marginAmt, billed: billed,
      seats: seats, seatsExact: seatsExact,
      price: price, pricePerSqft: perSqft(billed),
      perSeat: { rent: perSeat(rent), running: perSeat(running), fitout: perSeat(fitoutMonthly), margin: perSeat(marginAmt), cost: perSeat(total),
        ads: perSeat(i.adsPerMonth), brokerage: price * i.brokeragePct },
      withBrokerage: { price: price * (1 + i.brokeragePct), pricePerSqft: perSqft(billed) * (1 + i.brokeragePct) },
      withAds: { price: perSeat(billed + i.adsPerMonth), pricePerSqft: perSqft(billed + i.adsPerMonth) },
      breakEven: breakEven, runningCovered: runningCovered,
      breakEvenWithAds: (billed > 0) ? (total + i.adsPerMonth) / billed : 0,
      breakEvenSeats: Math.ceil(breakEven * seatsExact),
      rentShareOfCost: total > 0 ? rent / total : 0,
      rentShareOfPrice: billed > 0 ? rent / billed : 0,
      profitFull: marginAmt, profitFullYear: marginAmt * 12,
      commitment: rent * i.lockinMonths + fitout,
      perSqftPerSeat: i.sqftPerSeat * (1 + i.margin),       /* what ₹1 a sq ft of cost does to the price of a seat */
    };
  }

  /* Profit or loss a month at a given occupancy, at the sheet's price. */
  function atOccupancy(c, occ, adsOn) { return c.billed * occ - c.total - (adsOn ? c.inputs.adsPerMonth : 0); }

  /* The rent (on the quoted basis) that lands the seat price on a target. */
  function rentForPrice(c, targetPrice) {
    var i = c.inputs;
    var costPerSqftCarpet = targetPrice / (i.sqftPerSeat * (1 + i.margin));
    var rentOnCarpet = costPerSqftCarpet - (i.lockinMonths > 0 ? i.fitoutRate / i.lockinMonths : 0) - i.runningRate;
    return { onCarpet: rentOnCarpet, onBuiltup: rentOnCarpet * i.efficiency, quoted: i.rentBasis === "builtup" ? rentOnCarpet * i.efficiency : rentOnCarpet };
  }

  /* What each negotiating lever takes off the price of a seat, a month. */
  function levers(c, opts) {
    opts = opts || {};
    var i = c.inputs, k = c.perSqftPerSeat;
    var rentStep = num(opts.rentStep, 10), fitoutStep = num(opts.fitoutStep, 100), target = num(opts.targetPrice, 0);
    var out = [
      { key: "rent", label: "Rent ₹" + rentStep + " lower", sub: "a sq ft of carpet, a month", saving: rentStep * k },
      { key: "rentFree", label: "One rent-free month", sub: "spread over the " + i.lockinMonths + "-month lock-in", saving: i.lockinMonths > 0 ? c.perSeat(c.rent / i.lockinMonths) * (1 + i.margin) : 0 },
      { key: "fitout", label: "Fit-out ₹" + fitoutStep + " cheaper", sub: "a sq ft", saving: i.lockinMonths > 0 ? (fitoutStep / i.lockinMonths) * k : 0 },
      { key: "broker", label: "No broker on the deal", sub: "direct or inbound sale", saving: c.perSeat.brokerage },
    ];
    if (target > 0) {
      var r = rentForPrice(c, target);
      out.push({ key: "target", label: "Rent for ₹" + Math.round(target).toLocaleString("en-IN") + " a seat", sub: "₹" + Math.round(r.quoted) + " a sq ft " + (i.rentBasis === "builtup" ? "built-up" : "carpet") + " (now ₹" + Math.round(i.rentRate) + ")", saving: c.price - target, rent: r });
    }
    return out;
  }
  /* perSeat as a function on the result, for levers() */
  function withHelpers(c) { c.perSeat = Object.assign(function (x) { return c.seatsExact > 0 ? x / c.seatsExact : 0; }, c.perSeat); return c; }

  /* The whole set for a case: every option costed, plus the figures that
     are the same for all of them. */
  function caseCosting(options, assumptions) {
    var list = (options || []).map(function (o) { var c = full(o, assumptions); c.id = o.id; c.name = o.name; return c; });
    var be = list.length ? list[0].breakEven : 0;
    return { options: list, breakEven: be, priceLow: list.length ? Math.min.apply(null, list.map(function (c) { return c.price; })) : 0, priceHigh: list.length ? Math.max.apply(null, list.map(function (c) { return c.price; })) : 0 };
  }

  /* Indian number formats, the way the document writes them. */
  function inr(n, opts) {
    opts = opts || {};
    if (n == null || !isFinite(n)) return "";
    var abs = Math.abs(n), s;
    if (opts.unit === "Cr" || (!opts.unit && abs >= 1e7 && !opts.plain)) s = (n / 1e7).toFixed(opts.dp == null ? (abs / 1e7 >= 100 ? 0 : abs / 1e7 >= 10 ? 1 : 2) : opts.dp) + " Cr";
    else if (opts.unit === "L" || (!opts.unit && abs >= 1e5 && !opts.plain)) s = (n / 1e5).toFixed(opts.dp == null ? 2 : opts.dp) + " L";
    else s = Math.round(n).toLocaleString("en-IN");
    return (opts.sign && n > 0 ? "+" : "") + (n < 0 ? "−" : "") + "₹" + s.replace(/^-/, "");
  }
  function pc(x, dp) { return (x * 100).toFixed(dp == null ? 0 : dp) + "%"; }

  function full(o, a) { var c = withHelpers(cost(o, a)); c.levers = levers(c, { targetPrice: num(a && a.targetPrice, 0) }); return c; }

  return { DEFAULTS: DEFAULTS, inputs: inputs, cost: full, atOccupancy: atOccupancy, rentForPrice: rentForPrice, levers: levers, caseCosting: caseCosting, inr: inr, pc: pc, num: num };
});
