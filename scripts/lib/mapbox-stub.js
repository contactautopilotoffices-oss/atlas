/* ============================================================================
   ATLAS · a stand-in for mapbox-gl, for tests

   The engine cannot be opened in this environment with a real map: that needs
   a Mapbox token and a network. This stub is enough of one for the engine to
   run its whole start-up, add every source and layer, and render every tab,
   so a test can tell the difference between "the map did not draw" and "the
   code threw".

   It deliberately does NOT pretend to render anything. It records what it was
   asked to do, which is what the test asserts on.
   ============================================================================ */
"use strict";
module.exports = function mapboxStubSource() {
  return `(function () {
  function LngLatBounds() { this._p = []; }
  LngLatBounds.prototype.extend = function (p) { this._p.push(p); return this; };
  LngLatBounds.prototype.isEmpty = function () { return this._p.length === 0; };

  function Marker() {}
  Marker.prototype.setLngLat = function () { return this; };
  Marker.prototype.addTo = function () { return this; };
  Marker.prototype.remove = function () { return this; };

  function Popup() {}
  Popup.prototype.setLngLat = function () { return this; };
  Popup.prototype.setHTML = function () { return this; };
  Popup.prototype.addTo = function () { return this; };
  Popup.prototype.remove = function () { return this; };

  function Map(opts) {
    this._handlers = {};
    this._sources = {};
    this._layers = {};
    this._opts = opts || {};
    window.__atlasMap = this;
    var self = this;
    setTimeout(function () { self._fire("style.load"); self._fire("load"); }, 0);
  }
  Map.prototype._fire = function (ev, arg) {
    (this._handlers[ev] || []).forEach(function (fn) { try { fn(arg || { target: this }); } catch (e) { window.__atlasErrors.push("handler " + ev + ": " + e.message); } });
  };
  Map.prototype.on = function (ev, a, b) { var fn = b || a; (this._handlers[ev] = this._handlers[ev] || []).push(fn); return this; };
  Map.prototype.once = function (ev, a, b) { return this.on(ev, a, b); };
  Map.prototype.off = function () { return this; };
  Map.prototype.addSource = function (id, def) { this._sources[id] = { def: def, setData: function () {} }; return this; };
  Map.prototype.getSource = function (id) { return this._sources[id]; };
  Map.prototype.removeSource = function (id) { delete this._sources[id]; return this; };
  Map.prototype.addLayer = function (layer) {
    if (!layer || !layer.id) throw new Error("addLayer without an id");
    if (layer.source && !this._sources[layer.source] && layer.type !== "sky" && layer.type !== "background") {
      throw new Error("layer " + layer.id + " uses source " + layer.source + " which was never added");
    }
    this._layers[layer.id] = layer; return this;
  };
  Map.prototype.getLayer = function (id) { return this._layers[id]; };
  Map.prototype.removeLayer = function (id) { delete this._layers[id]; return this; };
  Map.prototype.setLayoutProperty = function (id) { if (!this._layers[id]) throw new Error("setLayoutProperty on missing layer " + id); return this; };
  Map.prototype.setPaintProperty = function (id) { if (!this._layers[id]) throw new Error("setPaintProperty on missing layer " + id); return this; };
  Map.prototype.setFilter = function () { return this; };
  Map.prototype.setConfigProperty = function () { return this; };
  Map.prototype.setFog = function () { return this; };
  Map.prototype.setTerrain = function () { return this; };
  Map.prototype.getStyle = function () { return { layers: [], sources: {} }; };
  Map.prototype.getCanvas = function () { return { style: {} }; };
  Map.prototype.getContainer = function () { return document.getElementById("map") || document.body; };
  Map.prototype.flyTo = function () { return this; };
  Map.prototype.easeTo = function () { return this; };
  Map.prototype.jumpTo = function () { return this; };
  Map.prototype.fitBounds = function () { return this; };
  Map.prototype.getZoom = function () { return this._opts.zoom || 11; };
  Map.prototype.setZoom = function () { return this; };
  Map.prototype.getCenter = function () { var c = this._opts.center || [0, 0]; return { lng: c[0], lat: c[1] }; };
  Map.prototype.getBearing = function () { return 0; };
  Map.prototype.getPitch = function () { return 0; };
  /* Real mapbox hands back a LngLat, which the engine calls .toArray() on
     when it spreads pins apart. */
  function LngLat(lng, lat) { this.lng = lng; this.lat = lat; }
  LngLat.prototype.toArray = function () { return [this.lng, this.lat]; };
  LngLat.prototype.wrap = function () { return this; };
  Map.prototype.project = function (ll) {
    var lng = Array.isArray(ll) ? ll[0] : (ll && ll.lng) || 0;
    var lat = Array.isArray(ll) ? ll[1] : (ll && ll.lat) || 0;
    /* A plain linear mapping is enough: the engine only needs distances in
       screen space to be consistent, not correct. */
    return { x: (lng + 180) * 20, y: (90 - lat) * 20 };
  };
  Map.prototype.unproject = function (p) {
    var x = Array.isArray(p) ? p[0] : (p && p.x) || 0;
    var y = Array.isArray(p) ? p[1] : (p && p.y) || 0;
    return new LngLat(x / 20 - 180, 90 - y / 20);
  };
  Map.prototype.queryRenderedFeatures = function () { return []; };
  Map.prototype.addControl = function () { return this; };
  Map.prototype.resize = function () { return this; };
  Map.prototype.remove = function () { return this; };
  Map.prototype.loadImage = function (u, cb) { cb(null, {}); };
  Map.prototype.addImage = function () { return this; };
  Map.prototype.hasImage = function () { return false; };
  Map.prototype.isStyleLoaded = function () { return true; };

  window.mapboxgl = {
    Map: Map, Marker: Marker, Popup: Popup, LngLatBounds: LngLatBounds,
    accessToken: "", supported: function () { return true; }, LngLat: LngLat,
    NavigationControl: function () {}, AttributionControl: function () {}, ScaleControl: function () {}
  };
})();`;
};
