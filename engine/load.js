/* ============================================================================
   ATLAS · engine loader

   Decides where this page's bundle comes from, before the engine starts.

     /engine/                    ./bundle.js, a static file: the demo
     /engine/?atlas=<slug>       the published bundle, from the CMS, which
                                 needs the visitor's access cookie. Without
                                 one the sign-in form on this page asks for
                                 the access ID and password and the server
                                 checks them; nothing is checked in the
                                 browser and no credential ships in a script.
     /engine/?atlas=<slug>&draft=1   the draft, for an admin's preview

   window.AtlasLoad resolves once window.ATLAS is set. The boot at the foot
   of the page waits on it, so an unsigned-in visitor sees the sign-in form
   and nothing else loads until they are through.
   ============================================================================ */
(function () {
  "use strict";
  var q = new URLSearchParams(location.search);
  var slug = (q.get("atlas") || "").trim().toLowerCase();
  var draft = q.get("draft") === "1";
  var $ = function (s) { return document.querySelector(s); };
  var API = "/api/cms";

  function script(src) {
    return new Promise(function (ok, bad) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
  }
  function ready(fn) { if (document.body) fn(); else document.addEventListener("DOMContentLoaded", fn); }
  function set(sel, text) { var el = $(sel); if (el) el.textContent = text; }
  function hideGate() { var g = $("#gate"); if (g) g.remove(); }
  function message(text, tone) {
    ready(function () {
      set("#g-eyebrow", "Autopilot ATLAS");
      set("#g-title", tone === "paused" ? "Paused" : "Not available");
      set("#g-lede", text);
      var f = $("#g-form"); if (f) f.remove();
      var g = $("#gate"); if (g) g.style.display = "";
    });
  }

  function fetchBundle() {
    return fetch(API + "?r=bundle&link=" + encodeURIComponent(slug) + (draft ? "&draft=1" : ""), { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; }); });
  }
  function signIn(id, pw) {
    return fetch(API + "?r=access", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-cms": "1" }, body: JSON.stringify({ id: id, password: pw }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; }); });
  }

  /* The page's own sign-in form, pointed at the server. */
  function gate(resolve) {
    ready(function () {
      set("#g-eyebrow", "Autopilot ATLAS");
      set("#g-title", "Sign in");
      set("#g-lede", "Use the access ID and password you were given.");
      var form = $("#g-form"), err = $("#g-err"), go = $("#g-go");
      if (!form) { message("This page has no sign-in form."); return; }
      var busy = false;
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (busy) return; busy = true; go.disabled = true; err.textContent = "";
        signIn($("#g-id").value, $("#g-pw").value).then(function (r) {
          busy = false; go.disabled = false;
          if (r.status !== 200 || r.j.slug !== slug) {
            err.textContent = r.j.error || (r.status === 200 ? "That ID opens a different atlas." : "Not recognised. Access is issued per person.");
            $("#g-pw").value = ""; $("#g-pw").focus(); return;
          }
          try { sessionStorage.setItem("atlas-access-id", String($("#g-id").value).trim().toUpperCase()); } catch (x) {}
          return fetchBundle().then(function (b) { settle(b, resolve); });
        }).catch(function () { busy = false; go.disabled = false; err.textContent = "Could not reach the server. Try again."; });
      });
      var id = $("#g-id"); if (id) id.focus();
    });
  }

  function settle(r, resolve) {
    if (r.status === 200 && r.j.bundle) {
      window.ATLAS = Object.assign({ slug: slug, path: "/engine/", draft: !!r.j.draft }, r.j.bundle);
      if (r.j.accessId) { try { sessionStorage.setItem("atlas-access-id", r.j.accessId); } catch (x) {} }
      hideGate();
      resolve();
    } else if (r.status === 200 && r.j.paused) {
      message("This atlas is paused. Ask Autopilot to switch it back on.", "paused");
    } else if (r.status === 401) {
      gate(resolve);
    } else {
      message(r.j.error || "This atlas could not be loaded.");
    }
  }

  window.AtlasAccess = {
    slug: slug,
    signOut: function () {
      return fetch(API + "?r=access/signout", { method: "POST", credentials: "same-origin", headers: { "x-cms": "1" } })
        .catch(function () {}).then(function () { try { sessionStorage.removeItem("atlas-access-id"); } catch (x) {} location.href = "/"; });
    }
  };

  window.AtlasLoad = new Promise(function (resolve) {
    if (!slug) {
      /* No atlas named: the static demo bundle. A missing file is a blank
         page with a reason, not a broken one. */
      script("./bundle.js?v=eng1").then(resolve, function () { message("No atlas was named. Open this page as /engine/?atlas=<id>, or sign in at the site root."); });
      return;
    }
    fetchBundle().then(function (r) { settle(r, resolve); }).catch(function () { message("Could not reach the server."); });
  });
})();
