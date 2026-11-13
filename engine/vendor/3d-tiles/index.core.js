import { F as b, b as y, U as g, L as Z, f as I, a as w, P as A } from "./constants-z3YLhXg0.js";
import { e as pe, c as ge, d as Te, W as me } from "./constants-z3YLhXg0.js";
import { t as ee, c as H, L as U, r as v, g as te } from "./LoaderBase-CfTLVHyZ.js";
import { a as ye, T as ve } from "./LoaderBase-CfTLVHyZ.js";
function Q(s) {
  if (!s)
    return null;
  let e = s.length;
  const t = s.indexOf("?"), r = s.indexOf("#");
  t !== -1 && (e = Math.min(e, t)), r !== -1 && (e = Math.min(e, r));
  const n = s.lastIndexOf(".", e), o = s.lastIndexOf("/", e), a = s.indexOf("://");
  return a !== -1 && a + 2 === o || n === -1 || n < o ? null : s.substring(n + 1, e) || null;
}
const L = {
  inView: !1,
  error: 1 / 0,
  distanceFromCamera: 1 / 0
}, q = !0;
function j(s) {
  return s === y || s === b;
}
function T(s, e) {
  return s.__lastFrameVisited === e && s.__used;
}
function k(s) {
  return s.__childrenProcessed === s.children.length;
}
function O(s) {
  return s.__hasUnrenderableContent || s.parent && s.parent.geometricError < s.geometricError;
}
function x(s, e) {
  s.__lastFrameVisited !== e.frameCount && (s.__lastFrameVisited = e.frameCount, s.__used = !1, s.__inFrustum = !1, s.__isLeaf = !1, s.__visible = !1, s.__active = !1, s.__error = 1 / 0, s.__distanceFromCamera = 1 / 0, s.__allChildrenReady = !1, e.calculateTileViewError(s, L), s.__inFrustum = L.inView, s.__error = L.error, s.__distanceFromCamera = L.distanceFromCamera);
}
function B(s, e, t = !1) {
  if (e.ensureChildrenArePreprocessed(s), x(s, e), D(s, e, t), O(s) && k(s)) {
    const r = s.children;
    for (let n = 0, o = r.length; n < o; n++)
      B(r[n], e, t);
  }
}
function J(s, e) {
  if (e.ensureChildrenArePreprocessed(s), T(s, e.frameCount) && (s.__hasContent && e.queueTileForDownload(s), k(s))) {
    const t = s.children;
    for (let r = 0, n = t.length; r < n; r++)
      J(t[r], e);
  }
}
function D(s, e, t = !1) {
  s.__used || (t || (s.__used = !0, e.stats.used++), e.markTileUsed(s), s.__inFrustum === !0 && e.stats.inFrustum++);
}
function se(s, e) {
  return !(s.__error <= e.errorTarget && !O(s) || e.maxDepth > 0 && s.__depth + 1 >= e.maxDepth || !k(s));
}
function W(s, e) {
  if (e.ensureChildrenArePreprocessed(s), x(s, e), !s.__inFrustum)
    return;
  if (!se(s, e)) {
    D(s, e);
    return;
  }
  let t = !1, r = !1;
  const n = s.children;
  for (let o = 0, a = n.length; o < a; o++) {
    const l = n[o];
    W(l, e), t = t || T(l, e.frameCount), r = r || l.__inFrustum;
  }
  if (s.refine === "REPLACE" && !r && n.length !== 0) {
    s.__inFrustum = !1;
    for (let o = 0, a = n.length; o < a; o++)
      B(n[o], e, !0);
    return;
  }
  if (D(s, e), s.refine === "REPLACE" && (t && s.__depth !== 0 || q))
    for (let o = 0, a = n.length; o < a; o++)
      B(n[o], e);
}
function z(s, e) {
  const t = e.frameCount;
  if (!T(s, t))
    return;
  const r = s.children;
  let n = !1;
  for (let o = 0, a = r.length; o < a; o++) {
    const l = r[o];
    n = n || T(l, t);
  }
  if (!n)
    s.__isLeaf = !0;
  else {
    let o = !0;
    for (let a = 0, l = r.length; a < l; a++) {
      const i = r[a];
      if (z(i, e), T(i, t)) {
        const h = !O(i);
        let c = !i.__hasContent || i.__hasRenderableContent && j(i.__loadingState) || i.__hasUnrenderableContent && i.__loadingState === b;
        c = h && c || i.__allChildrenReady, o = o && c;
      }
    }
    s.__allChildrenReady = o;
  }
}
function K(s, e) {
  const t = e.stats;
  if (!T(s, e.frameCount))
    return;
  if (s.__isLeaf) {
    s.__loadingState === y ? (s.__inFrustum && (s.__visible = !0, t.visible++), s.__active = !0, t.active++) : s.__hasContent && e.queueTileForDownload(s);
    return;
  }
  const r = s.children, n = s.__hasContent, o = j(s.__loadingState) && n, a = (e.errorTarget + 1) * e.errorThreshold, l = s.__error <= a, i = s.refine === "ADD", h = s.__allChildrenReady || s.__depth === 0 && !q;
  if (n && (l || i) && e.queueTileForDownload(s), (l && o && !h || o && i) && (s.__inFrustum && (s.__visible = !0, t.visible++), s.__active = !0, t.active++), !i && l && !h)
    for (let c = 0, u = r.length; c < u; c++) {
      const f = r[c];
      T(f, e.frameCount) && J(f, e);
    }
  else
    for (let c = 0, u = r.length; c < u; c++)
      K(r[c], e);
}
function Y(s, e) {
  const t = T(s, e.frameCount);
  if (t || s.__usedLastFrame) {
    let r = !1, n = !1;
    t ? (r = s.__active, e.displayActiveTiles ? n = s.__active || s.__visible : n = s.__visible) : x(s, e), s.__hasRenderableContent && s.__loadingState === y && (s.__wasSetActive !== r && e.invokeOnePlugin((a) => a.setTileActive && a.setTileActive(s, r)), s.__wasSetVisible !== n && e.invokeOnePlugin((a) => a.setTileVisible && a.setTileVisible(s, n))), s.__wasSetActive = r, s.__wasSetVisible = n, s.__usedLastFrame = t;
    const o = s.children;
    for (let a = 0, l = o.length; a < l; a++) {
      const i = o[a];
      Y(i, e);
    }
  }
}
function ne(s) {
  let e = null;
  return () => {
    e === null && (e = requestAnimationFrame(() => {
      e = null, s();
    }));
  };
}
const M = Symbol("PLUGIN_REGISTERED"), $ = (s, e) => {
  const t = s.priority || 0, r = e.priority || 0;
  return t !== r ? t > r ? 1 : -1 : s.__used !== e.__used ? s.__used ? 1 : -1 : s.__error !== e.__error ? s.__error > e.__error ? 1 : -1 : s.__distanceFromCamera !== e.__distanceFromCamera ? s.__distanceFromCamera > e.__distanceFromCamera ? -1 : 1 : s.__depthFromRenderedParent !== e.__depthFromRenderedParent ? s.__depthFromRenderedParent > e.__depthFromRenderedParent ? -1 : 1 : 0;
}, re = (s, e) => {
  const t = s.priority || 0, r = e.priority || 0;
  return t !== r ? t > r ? 1 : -1 : s.__lastFrameVisited !== e.__lastFrameVisited ? s.__lastFrameVisited > e.__lastFrameVisited ? -1 : 1 : s.__depthFromRenderedParent !== e.__depthFromRenderedParent ? s.__depthFromRenderedParent > e.__depthFromRenderedParent ? 1 : -1 : s.__loadingState !== e.__loadingState ? s.__loadingState > e.__loadingState ? -1 : 1 : s.__hasUnrenderableContent !== e.__hasUnrenderableContent ? s.__hasUnrenderableContent ? -1 : 1 : s.__error !== e.__error ? s.__error > e.__error ? -1 : 1 : 0;
};
class le {
  get root() {
    const e = this.rootTileset;
    return e ? e.root : null;
  }
  get rootTileSet() {
    return console.warn('TilesRenderer: "rootTileSet" has been deprecated. Use "rootTileset" instead.'), this.rootTileset;
  }
  get loadProgress() {
    const { stats: e, isLoading: t } = this, r = e.downloading + e.parsing, n = e.inCacheSinceLoad + (t ? 1 : 0);
    return n === 0 ? 1 : 1 - r / n;
  }
  get errorThreshold() {
    return this._errorThreshold;
  }
  set errorThreshold(e) {
    console.warn('TilesRenderer: The "errorThreshold" option has been deprecated.'), this._errorThreshold = e;
  }
  constructor(e = null) {
    this.rootLoadingState = g, this.rootTileset = null, this.rootURL = e, this.fetchOptions = {}, this.plugins = [], this.queuedTiles = [], this.cachedSinceLoadComplete = /* @__PURE__ */ new Set(), this.isLoading = !1;
    const t = new Z();
    t.unloadPriorityCallback = re;
    const r = new I();
    r.maxJobs = 25, r.priorityCallback = $;
    const n = new I();
    n.maxJobs = 5, n.priorityCallback = $;
    const o = new I();
    o.maxJobs = 25, this.processedTiles = /* @__PURE__ */ new WeakSet(), this.visibleTiles = /* @__PURE__ */ new Set(), this.activeTiles = /* @__PURE__ */ new Set(), this.usedSet = /* @__PURE__ */ new Set(), this.lruCache = t, this.downloadQueue = r, this.parseQueue = n, this.processNodeQueue = o, this.stats = {
      inCacheSinceLoad: 0,
      inCache: 0,
      parsing: 0,
      downloading: 0,
      failed: 0,
      inFrustum: 0,
      used: 0,
      active: 0,
      visible: 0
    }, this.frameCount = 0, this._dispatchNeedsUpdateEvent = ne(() => {
      this.dispatchEvent({ type: "needs-update" });
    }), this.errorTarget = 16, this._errorThreshold = 1 / 0, this.displayActiveTiles = !1, this.maxDepth = 1 / 0;
  }
  // Plugins
  registerPlugin(e) {
    if (e[M] === !0)
      throw new Error("TilesRendererBase: A plugin can only be registered to a single tileset");
    e.loadRootTileSet && !e.loadRootTileset && (console.warn('TilesRendererBase: Plugin implements deprecated "loadRootTileSet" method. Please rename to "loadRootTileset".'), e.loadRootTileset = e.loadRootTileSet), e.preprocessTileSet && !e.preprocessTileset && (console.warn('TilesRendererBase: Plugin implements deprecated "preprocessTileSet" method. Please rename to "preprocessTileset".'), e.preprocessTileset = e.preprocessTileSet);
    const t = this.plugins, r = e.priority || 0;
    let n = t.length;
    for (let o = 0; o < t.length; o++)
      if ((t[o].priority || 0) > r) {
        n = o;
        break;
      }
    t.splice(n, 0, e), e[M] = !0, e.init && e.init(this);
  }
  unregisterPlugin(e) {
    const t = this.plugins;
    if (typeof e == "string" && (e = this.getPluginByName(e)), t.includes(e)) {
      const r = t.indexOf(e);
      return t.splice(r, 1), e.dispose && e.dispose(), !0;
    }
    return !1;
  }
  getPluginByName(e) {
    return this.plugins.find((t) => t.name === e) || null;
  }
  invokeOnePlugin(e) {
    const t = [...this.plugins, this];
    for (let r = 0; r < t.length; r++) {
      const n = e(t[r]);
      if (n)
        return n;
    }
    return null;
  }
  invokeAllPlugins(e) {
    const t = [...this.plugins, this], r = [];
    for (let n = 0; n < t.length; n++) {
      const o = e(t[n]);
      o && r.push(o);
    }
    return r.length === 0 ? null : Promise.all(r);
  }
  // Public API
  traverse(e, t, r = !0) {
    this.root && ee(this.root, (n, ...o) => (r && this.ensureChildrenArePreprocessed(n, !0), e ? e(n, ...o) : !1), t);
  }
  getAttributions(e = []) {
    return this.invokeAllPlugins((t) => t !== this && t.getAttributions && t.getAttributions(e)), e;
  }
  update() {
    const { lruCache: e, usedSet: t, stats: r, root: n, downloadQueue: o, parseQueue: a, processNodeQueue: l } = this;
    if (this.rootLoadingState === g && (this.rootLoadingState = w, this.invokeOnePlugin((c) => c.loadRootTileset && c.loadRootTileset()).then((c) => {
      let u = this.rootURL;
      u !== null && this.invokeAllPlugins((f) => u = f.preprocessURL ? f.preprocessURL(u, null) : u), this.rootLoadingState = y, this.rootTileset = c, this.dispatchEvent({ type: "needs-update" }), this.dispatchEvent({ type: "load-content" }), this.dispatchEvent({
        type: "load-tileset",
        tileset: c,
        url: u
      }), this.dispatchEvent({
        type: "load-root-tileset",
        tileset: c,
        url: u
      });
    }).catch((c) => {
      this.rootLoadingState = b, console.error(c), this.rootTileset = null, this.dispatchEvent({
        type: "load-error",
        tile: null,
        error: c,
        url: this.rootURL
      });
    })), !n)
      return;
    r.inFrustum = 0, r.used = 0, r.active = 0, r.visible = 0, this.frameCount++, t.forEach((c) => e.markUnused(c)), t.clear(), W(n, this), z(n, this), K(n, this), Y(n, this);
    const i = this.queuedTiles;
    i.sort(e.unloadPriorityCallback);
    for (let c = 0, u = i.length; c < u && !e.isFull(); c++)
      this.requestTileContents(i[c]);
    i.length = 0, e.scheduleUnload(), (o.running || a.running || l.running) === !1 && this.isLoading === !0 && (this.cachedSinceLoadComplete.clear(), r.inCacheSinceLoad = 0, this.dispatchEvent({ type: "tiles-load-end" }), this.isLoading = !1);
  }
  resetFailedTiles() {
    this.rootLoadingState === b && (this.rootLoadingState = g);
    const e = this.stats;
    e.failed !== 0 && (this.traverse((t) => {
      t.__loadingState === b && (t.__loadingState = g);
    }, null, !1), e.failed = 0);
  }
  dispose() {
    [...this.plugins].forEach((n) => {
      this.unregisterPlugin(n);
    });
    const t = this.lruCache, r = [];
    this.traverse((n) => (r.push(n), !1), null, !1);
    for (let n = 0, o = r.length; n < o; n++)
      t.remove(r[n]);
    this.stats = {
      parsing: 0,
      downloading: 0,
      failed: 0,
      inFrustum: 0,
      used: 0,
      active: 0,
      visible: 0
    }, this.frameCount = 0;
  }
  // Overrideable
  calculateBytesUsed(e, t) {
    return 0;
  }
  dispatchEvent(e) {
  }
  addEventListener(e, t) {
  }
  removeEventListener(e, t) {
  }
  parseTile(e, t, r) {
    return null;
  }
  disposeTile(e) {
    e.__visible && (this.invokeOnePlugin((t) => t.setTileVisible && t.setTileVisible(e, !1)), e.__visible = !1), e.__active && (this.invokeOnePlugin((t) => t.setTileActive && t.setTileActive(e, !1)), e.__active = !1);
  }
  preprocessNode(e, t, r = null) {
    var n;
    if (this.processedTiles.add(e), e.content && (!("uri" in e.content) && "url" in e.content && (e.content.uri = e.content.url, delete e.content.url), e.content.boundingVolume && !("box" in e.content.boundingVolume || "sphere" in e.content.boundingVolume || "region" in e.content.boundingVolume) && delete e.content.boundingVolume), e.parent = r, e.children = e.children || [], (n = e.content) != null && n.uri) {
      const o = Q(e.content.uri);
      e.__hasContent = !0, e.__hasUnrenderableContent = !!(o && /json$/.test(o)), e.__hasRenderableContent = !e.__hasUnrenderableContent;
    } else
      e.__hasContent = !1, e.__hasUnrenderableContent = !1, e.__hasRenderableContent = !1;
    e.__childrenProcessed = 0, r && r.__childrenProcessed++, e.__distanceFromCamera = 1 / 0, e.__error = 1 / 0, e.__inFrustum = !1, e.__isLeaf = !1, e.__usedLastFrame = !1, e.__used = !1, e.__wasSetVisible = !1, e.__visible = !1, e.__allChildrenReady = !1, e.__wasSetActive = !1, e.__active = !1, e.__loadingState = g, r === null ? (e.__depth = 0, e.__depthFromRenderedParent = e.__hasRenderableContent ? 1 : 0, e.refine = e.refine || "REPLACE") : (e.__depth = r.__depth + 1, e.__depthFromRenderedParent = r.__depthFromRenderedParent + (e.__hasRenderableContent ? 1 : 0), e.refine = e.refine || r.refine), e.__basePath = t, e.__lastFrameVisited = -1, this.invokeAllPlugins((o) => {
      o !== this && o.preprocessNode && o.preprocessNode(e, t, r);
    });
  }
  setTileActive(e, t) {
    t ? this.activeTiles.add(e) : this.activeTiles.delete(e);
  }
  setTileVisible(e, t) {
    t ? this.visibleTiles.add(e) : this.visibleTiles.delete(e);
  }
  calculateTileViewError(e, t) {
  }
  // Private Functions
  queueTileForDownload(e) {
    e.__loadingState !== g || this.lruCache.isFull() || this.queuedTiles.push(e);
  }
  markTileUsed(e) {
    this.usedSet.add(e), this.lruCache.markUsed(e);
  }
  fetchData(e, t) {
    return fetch(e, t);
  }
  ensureChildrenArePreprocessed(e, t = !1) {
    const r = e.children;
    for (let n = 0, o = r.length; n < o; n++) {
      const a = r[n];
      if ("__depth" in a)
        break;
      t ? (this.processNodeQueue.remove(a), this.preprocessNode(a, e.__basePath, e)) : this.processNodeQueue.has(a) || this.processNodeQueue.add(a, (l) => {
        this.preprocessNode(l, e.__basePath, e), this._dispatchNeedsUpdateEvent();
      });
    }
  }
  // returns the total bytes used for by the given tile as reported by all plugins
  getBytesUsed(e) {
    let t = 0;
    return this.invokeAllPlugins((r) => {
      r.calculateBytesUsed && (t += r.calculateBytesUsed(e, e.cached.scene) || 0);
    }), t;
  }
  // force a recalculation of the tile or all tiles if no tile is provided
  recalculateBytesUsed(e = null) {
    const { lruCache: t, processedTiles: r } = this;
    e === null ? t.itemSet.forEach((n) => {
      r.has(n) && t.setMemoryUsage(n, this.getBytesUsed(n));
    }) : t.setMemoryUsage(e, this.getBytesUsed(e));
  }
  preprocessTileset(e, t, r = null) {
    const n = Object.getPrototypeOf(this);
    Object.hasOwn(n, "preprocessTileSet") && console.warn(`${n.constructor.name}: Class overrides deprecated "preprocessTileSet" method. Please rename to "preprocessTileset".`);
    const o = e.asset.version, [a, l] = o.split(".").map((h) => parseInt(h));
    console.assert(
      a <= 1,
      "TilesRenderer: asset.version is expected to be a 1.x or a compatible version."
    ), a === 1 && l > 0 && console.warn("TilesRenderer: tiles versions at 1.1 or higher have limited support. Some new extensions and features may not be supported.");
    let i = t.replace(/\/[^/]*$/, "");
    i = new URL(i, window.location.href).toString(), this.preprocessNode(e.root, i, r);
  }
  preprocessTileSet(...e) {
    return console.warn('TilesRenderer: "preprocessTileSet" has been deprecated. Use "preprocessTileset" instead.'), this.preprocessTileset(...e);
  }
  loadRootTileset() {
    const e = Object.getPrototypeOf(this);
    Object.hasOwn(e, "loadRootTileSet") && console.warn(`${e.constructor.name}: Class overrides deprecated "loadRootTileSet" method. Please rename to "loadRootTileset".`);
    let t = this.rootURL;
    return this.invokeAllPlugins((n) => t = n.preprocessURL ? n.preprocessURL(t, null) : t), this.invokeOnePlugin((n) => n.fetchData && n.fetchData(t, this.fetchOptions)).then((n) => {
      if (n instanceof Response) {
        if (n.ok)
          return n.json();
        throw new Error(`TilesRenderer: Failed to load tileset "${t}" with status ${n.status} : ${n.statusText}`);
      } else return n;
    }).then((n) => (this.preprocessTileset(n, t), n));
  }
  loadRootTileSet(...e) {
    return console.warn('TilesRenderer: "loadRootTileSet" has been deprecated. Use "loadRootTileset" instead.'), this.loadRootTileSet(...e);
  }
  requestTileContents(e) {
    if (e.__loadingState !== g)
      return;
    let t = !1, r = null, n = new URL(e.content.uri, e.__basePath + "/").toString();
    this.invokeAllPlugins((d) => n = d.preprocessURL ? d.preprocessURL(n, e) : n);
    const o = this.stats, a = this.lruCache, l = this.downloadQueue, i = this.parseQueue, h = Q(n), c = new AbortController(), u = c.signal;
    if (a.add(e, (d) => {
      c.abort(), t ? (d.children.length = 0, d.__childrenProcessed = 0) : this.invokeAllPlugins((_) => {
        _.disposeTile && _.disposeTile(d);
      }), o.inCache--, this.cachedSinceLoadComplete.has(e) && (this.cachedSinceLoadComplete.delete(e), o.inCacheSinceLoad--), d.__loadingState === w ? o.downloading-- : d.__loadingState === A && o.parsing--, d.__loadingState = g, i.remove(d), l.remove(d);
    }))
      return this.isLoading || (this.isLoading = !0, this.dispatchEvent({ type: "tiles-load-start" })), a.setMemoryUsage(e, this.getBytesUsed(e)), this.cachedSinceLoadComplete.add(e), o.inCacheSinceLoad++, o.inCache++, o.downloading++, e.__loadingState = w, l.add(e, (d) => {
        if (u.aborted)
          return Promise.resolve();
        const _ = this.invokeOnePlugin((p) => p.fetchData && p.fetchData(n, { ...this.fetchOptions, signal: u }));
        return this.dispatchEvent({ type: "tile-download-start", tile: e, uri: n }), _;
      }).then((d) => {
        if (!u.aborted)
          if (d instanceof Response) {
            if (d.ok)
              return h === "json" ? d.json() : d.arrayBuffer();
            throw new Error(`Failed to load model with error code ${d.status}`);
          } else return d;
      }).then((d) => {
        if (!u.aborted)
          return o.downloading--, o.parsing++, e.__loadingState = A, i.add(e, (_) => u.aborted ? Promise.resolve() : h === "json" && d.root ? (this.preprocessTileset(d, n, e), e.children.push(d.root), r = d, t = !0, Promise.resolve()) : this.invokeOnePlugin((p) => p.parseTile && p.parseTile(d, _, h, n, u)));
      }).then(() => {
        if (u.aborted)
          return;
        o.parsing--, e.__loadingState = y, a.setLoaded(e, !0);
        const d = this.getBytesUsed(e);
        if (a.getMemoryUsage(e) === 0 && d > 0 && a.isFull()) {
          a.remove(e);
          return;
        }
        a.setMemoryUsage(e, d), this.dispatchEvent({ type: "needs-update" }), this.dispatchEvent({ type: "load-content" }), t && this.dispatchEvent({
          type: "load-tileset",
          tileset: r,
          url: n
        }), e.cached.scene && this.dispatchEvent({
          type: "load-model",
          scene: e.cached.scene,
          tile: e,
          url: n
        });
      }).catch((d) => {
        u.aborted || (d.name !== "AbortError" ? (i.remove(e), l.remove(e), e.__loadingState === A ? o.parsing-- : e.__loadingState === w && o.downloading--, o.failed++, console.error(`TilesRenderer : Failed to load tile at url "${e.content.uri}".`), console.error(d), e.__loadingState = b, a.setLoaded(e, !0), this.dispatchEvent({
          type: "load-error",
          tile: e,
          error: d,
          url: n
        })) : a.remove(e));
      });
  }
}
function X(s, e, t, r, n, o) {
  let a;
  switch (r) {
    case "SCALAR":
      a = 1;
      break;
    case "VEC2":
      a = 2;
      break;
    case "VEC3":
      a = 3;
      break;
    case "VEC4":
      a = 4;
      break;
    default:
      throw new Error(`FeatureTable : Feature type not provided for "${o}".`);
  }
  let l;
  const i = t * a;
  switch (n) {
    case "BYTE":
      l = new Int8Array(s, e, i);
      break;
    case "UNSIGNED_BYTE":
      l = new Uint8Array(s, e, i);
      break;
    case "SHORT":
      l = new Int16Array(s, e, i);
      break;
    case "UNSIGNED_SHORT":
      l = new Uint16Array(s, e, i);
      break;
    case "INT":
      l = new Int32Array(s, e, i);
      break;
    case "UNSIGNED_INT":
      l = new Uint32Array(s, e, i);
      break;
    case "FLOAT":
      l = new Float32Array(s, e, i);
      break;
    case "DOUBLE":
      l = new Float64Array(s, e, i);
      break;
    default:
      throw new Error(`FeatureTable : Feature component type not provided for "${o}".`);
  }
  return l;
}
class P {
  constructor(e, t, r, n) {
    this.buffer = e, this.binOffset = t + r, this.binLength = n;
    let o = null;
    if (r !== 0) {
      const a = new Uint8Array(e, t, r);
      o = JSON.parse(H(a));
    } else
      o = {};
    this.header = o;
  }
  getKeys() {
    return Object.keys(this.header).filter((e) => e !== "extensions");
  }
  getData(e, t, r = null, n = null) {
    const o = this.header;
    if (!(e in o))
      return null;
    const a = o[e];
    if (a instanceof Object) {
      if (Array.isArray(a))
        return a;
      {
        const { buffer: l, binOffset: i, binLength: h } = this, c = a.byteOffset || 0, u = a.type || n, f = a.componentType || r;
        if ("type" in a && n && a.type !== n)
          throw new Error("FeatureTable: Specified type does not match expected type.");
        const d = i + c, _ = X(l, d, t, u, f, e);
        if (d + _.byteLength > i + h)
          throw new Error("FeatureTable: Feature data read outside binary body length.");
        return _;
      }
    } else return a;
  }
  getBuffer(e, t) {
    const { buffer: r, binOffset: n } = this;
    return r.slice(n + e, n + e + t);
  }
}
class oe {
  constructor(e) {
    this.batchTable = e;
    const t = e.header.extensions["3DTILES_batch_table_hierarchy"];
    this.classes = t.classes;
    for (const n of this.classes) {
      const o = n.instances;
      for (const a in o)
        n.instances[a] = this._parseProperty(o[a], n.length, a);
    }
    if (this.instancesLength = t.instancesLength, this.classIds = this._parseProperty(t.classIds, this.instancesLength, "classIds"), t.parentCounts ? this.parentCounts = this._parseProperty(t.parentCounts, this.instancesLength, "parentCounts") : this.parentCounts = new Array(this.instancesLength).fill(1), t.parentIds) {
      const n = this.parentCounts.reduce((o, a) => o + a, 0);
      this.parentIds = this._parseProperty(t.parentIds, n, "parentIds");
    } else
      this.parentIds = null;
    this.instancesIds = [];
    const r = {};
    for (const n of this.classIds)
      r[n] = r[n] ?? 0, this.instancesIds.push(r[n]), r[n]++;
  }
  _parseProperty(e, t, r) {
    if (Array.isArray(e))
      return e;
    {
      const { buffer: n, binOffset: o } = this.batchTable, a = e.byteOffset, l = e.componentType || "UNSIGNED_SHORT", i = o + a;
      return X(n, i, t, "SCALAR", l, r);
    }
  }
  getDataFromId(e, t = {}) {
    const r = this.parentCounts[e];
    if (this.parentIds && r > 0) {
      let i = 0;
      for (let h = 0; h < e; h++)
        i += this.parentCounts[h];
      for (let h = 0; h < r; h++) {
        const c = this.parentIds[i + h];
        c !== e && this.getDataFromId(c, t);
      }
    }
    const n = this.classIds[e], o = this.classes[n].instances, a = this.classes[n].name, l = this.instancesIds[e];
    for (const i in o)
      t[a] = t[a] || {}, t[a][i] = o[i][l];
    return t;
  }
}
class N extends P {
  get batchSize() {
    return console.warn("BatchTable.batchSize has been deprecated and replaced with BatchTable.count."), this.count;
  }
  constructor(e, t, r, n, o) {
    super(e, r, n, o), this.count = t, this.extensions = {};
    const a = this.header.extensions;
    a && a["3DTILES_batch_table_hierarchy"] && (this.extensions["3DTILES_batch_table_hierarchy"] = new oe(this));
  }
  getData(e, t = null, r = null) {
    return console.warn("BatchTable: BatchTable.getData is deprecated. Use BatchTable.getDataFromId to get allproperties for an id or BatchTable.getPropertyArray for getting an array of value for a property."), super.getData(e, this.count, t, r);
  }
  getDataFromId(e, t = {}) {
    if (e < 0 || e >= this.count)
      throw new Error(`BatchTable: id value "${e}" out of bounds for "${this.count}" features number.`);
    for (const r of this.getKeys())
      t[r] = super.getData(r, this.count)[e];
    for (const r in this.extensions) {
      const n = this.extensions[r];
      n.getDataFromId instanceof Function && (t[r] = t[r] || {}, n.getDataFromId(e, t[r]));
    }
    return t;
  }
  getPropertyArray(e) {
    return super.getData(e, this.count);
  }
}
class ce extends U {
  parse(e) {
    const t = new DataView(e), r = v(t);
    console.assert(r === "b3dm");
    const n = t.getUint32(4, !0);
    console.assert(n === 1);
    const o = t.getUint32(8, !0);
    console.assert(o === e.byteLength);
    const a = t.getUint32(12, !0), l = t.getUint32(16, !0), i = t.getUint32(20, !0), h = t.getUint32(24, !0), c = 28, u = e.slice(
      c,
      c + a + l
    ), f = new P(
      u,
      0,
      a,
      l
    ), d = c + a + l, _ = e.slice(
      d,
      d + i + h
    ), p = new N(
      _,
      f.getData("BATCH_LENGTH"),
      0,
      i,
      h
    ), S = d + i + h, C = new Uint8Array(e, S, o - S);
    return {
      version: n,
      featureTable: f,
      batchTable: p,
      glbBytes: C
    };
  }
}
class de extends U {
  parse(e) {
    const t = new DataView(e), r = v(t);
    console.assert(r === "i3dm");
    const n = t.getUint32(4, !0);
    console.assert(n === 1);
    const o = t.getUint32(8, !0);
    console.assert(o === e.byteLength);
    const a = t.getUint32(12, !0), l = t.getUint32(16, !0), i = t.getUint32(20, !0), h = t.getUint32(24, !0), c = t.getUint32(28, !0), u = 32, f = e.slice(
      u,
      u + a + l
    ), d = new P(
      f,
      0,
      a,
      l
    ), _ = u + a + l, p = e.slice(
      _,
      _ + i + h
    ), S = new N(
      p,
      d.getData("INSTANCES_LENGTH"),
      0,
      i,
      h
    ), C = _ + i + h, V = new Uint8Array(e, C, o - C);
    let R = null, F = null, G = null;
    if (c)
      R = V, F = Promise.resolve();
    else {
      const E = this.resolveExternalURL(H(V));
      G = te(E), F = fetch(E, this.fetchOptions).then((m) => {
        if (!m.ok)
          throw new Error(`I3DMLoaderBase : Failed to load file "${E}" with status ${m.status} : ${m.statusText}`);
        return m.arrayBuffer();
      }).then((m) => {
        R = new Uint8Array(m);
      });
    }
    return F.then(() => ({
      version: n,
      featureTable: d,
      batchTable: S,
      glbBytes: R,
      gltfWorkingPath: G
    }));
  }
}
class he extends U {
  parse(e) {
    const t = new DataView(e), r = v(t);
    console.assert(r === "pnts");
    const n = t.getUint32(4, !0);
    console.assert(n === 1);
    const o = t.getUint32(8, !0);
    console.assert(o === e.byteLength);
    const a = t.getUint32(12, !0), l = t.getUint32(16, !0), i = t.getUint32(20, !0), h = t.getUint32(24, !0), c = 28, u = e.slice(
      c,
      c + a + l
    ), f = new P(
      u,
      0,
      a,
      l
    ), d = c + a + l, _ = e.slice(
      d,
      d + i + h
    ), p = new N(
      _,
      f.getData("BATCH_LENGTH") || f.getData("POINTS_LENGTH"),
      0,
      i,
      h
    );
    return Promise.resolve({
      version: n,
      featureTable: f,
      batchTable: p
    });
  }
}
class ue extends U {
  parse(e) {
    const t = new DataView(e), r = v(t);
    console.assert(r === "cmpt", 'CMPTLoader: The magic bytes equal "cmpt".');
    const n = t.getUint32(4, !0);
    console.assert(n === 1, 'CMPTLoader: The version listed in the header is "1".');
    const o = t.getUint32(8, !0);
    console.assert(o === e.byteLength, "CMPTLoader: The contents buffer length listed in the header matches the file.");
    const a = t.getUint32(12, !0), l = [];
    let i = 16;
    for (let h = 0; h < a; h++) {
      const c = new DataView(e, i, 12), u = v(c), f = c.getUint32(4, !0), d = c.getUint32(8, !0), _ = new Uint8Array(e, i, d);
      l.push({
        type: u,
        buffer: _,
        version: f
      }), i += d;
    }
    return {
      version: n,
      tiles: l
    };
  }
}
export {
  ce as B3DMLoaderBase,
  ue as CMPTLoaderBase,
  b as FAILED,
  de as I3DMLoaderBase,
  y as LOADED,
  w as LOADING,
  Z as LRUCache,
  U as LoaderBase,
  ye as LoaderUtils,
  A as PARSING,
  he as PNTSLoaderBase,
  I as PriorityQueue,
  pe as PriorityQueueItemRemovedError,
  le as TilesRendererBase,
  ve as TraversalUtils,
  g as UNLOADED,
  ge as WGS84_FLATTENING,
  Te as WGS84_HEIGHT,
  me as WGS84_RADIUS
};
