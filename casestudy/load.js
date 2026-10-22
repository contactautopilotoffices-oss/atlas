/* ============================================================================
   ATLAS · case study loader

   Where this page's case bundle comes from, before anything is drawn.

     /casestudy/                 /casestudy/demo.js, a static file: the
                                 Andheri example, for looking at the design
     /<slug>/case                the published case study from the CMS,
                                 behind the same access ID as the atlas of
                                 that slug (the server checks the cookie)
     /<slug>/case?draft=1        the draft, for an admin's preview
     /casestudy/?case=<slug>     the same by its plain address

   window.CaseLoad resolves once window.CASE is set. The visitor never sees
   a version number; what is live is simply the case study.
   ============================================================================ */
(function () {
  "use strict";
  var q = new URLSearchParams(location.search);
  var parts = location.pathname.split("/").filter(Boolean);
  var slug = (q.get("case") || (parts.length === 2 && parts[1] === "case" ? parts[0] : "")).trim().toLowerCase();
  var draft = q.get("draft") === "1";
  var $ = function (s) { return document.querySelector(s); };
  var API = "/api/cms";

  function script(src) { return new Promise(function (ok, bad) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }); }
  function ready(fn) { if (document.body) fn(); else document.addEventListener("DOMContentLoaded", fn); }
  function set(sel, text) { var el = $(sel); if (el) el.textContent = text; }
  function hideGate() { var g = $("#gate"); if (g) g.remove(); }
  function message(text, tone) {
    ready(function () {
      set("#g-title", tone === "paused" ? "Paused" : "Not available");
      set("#g-lede", text);
      var f = $("#g-form"); if (f) f.remove();
      var g = $("#gate"); if (g) g.style.display = "";
    });
  }
  function fetchCase() {
    return fetch(API + "?r=case&link=" + encodeURIComponent(slug) + (draft ? "&draft=1" : ""), { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; }); });
  }
  function signIn(id, pw) {
    return fetch(API + "?r=access", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-cms": "1" }, body: JSON.stringify({ id: id, password: pw }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; }); });
  }
  function gate(resolve) {
    ready(function () {
      set("#g-title", "Sign in");
      set("#g-lede", "Use the access ID and password you were given.");
      var form = $("#g-form"), err = $("#g-err"), go = $("#g-go");
      var g = $("#gate"); if (g) g.style.display = "";
      if (!form) return;
      var busy = false;
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (busy) return; busy = true; go.disabled = true; err.textContent = "";
        signIn($("#g-id").value, $("#g-pw").value).then(function (r) {
          busy = false; go.disabled = false;
          if (r.status !== 200 || r.j.slug !== slug) { err.textContent = r.j.error || (r.status === 200 ? "That ID opens a different study." : "Not recognised."); $("#g-pw").value = ""; return; }
          return fetchCase().then(function (b) { settle(b, resolve); });
        }).catch(function () { busy = false; go.disabled = false; err.textContent = "Could not reach the server. Try again."; });
      });
      var id = $("#g-id"); if (id) id.focus();
    });
  }
  function settle(r, resolve) {
    if (r.status === 200 && r.j.bundle) { window.CASE = Object.assign({ slug: slug, draft: !!r.j.draft }, r.j.bundle); hideGate(); resolve(); }
    else if (r.status === 200 && r.j.paused) message("This case study is paused. Ask Autopilot to switch it back on.", "paused");
    else if (r.status === 401) gate(resolve);
    else message(r.j.error || "This case study could not be loaded.");
  }
  window.CaseLoad = new Promise(function (resolve) {
    if (window.CASE) { hideGate(); resolve(); return; }
    if (!slug) { script("/casestudy/demo.js?v=cs1").then(function () { hideGate(); resolve(); }, function () { message("No case study was named. Open it at /<id>/case."); }); return; }
    fetchCase().then(function (r) { settle(r, resolve); }).catch(function () { message("Could not reach the server."); });
  });
})();
