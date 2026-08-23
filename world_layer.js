/* ============================================================================
   ATLAS — UNIFIED WORLD LAYER
   ONE Three.js scene + ONE WebGLRenderer + ONE shared astronomical sun on the
   Mapbox canvas. Replaces the old per-building renderers. Hosts procedural
   buildings (Class A/B/C), instanced props, and (migrated) traffic.

   World convention: Z-UP mercator metres, origin at map centre.
     x = east, y = north, z = up  (matches the extrusion custom-layer idiom).
   Positioning transform = mapMatrix · translate(originMercator) · scale(s,-s,s).

   Initialised by mapbox_app.js with the THREE module it already imports.
   ============================================================================ */
window.AtlasWorld = (function () {
  let THREE, map, mapboxgl, CENTER, getRig, themeModeRef;
  let scene, renderer, camera, sun, hemi;
  let originMC, mScale, added = false;
  const frameCbs = [];
  let A;               // AtlasAssets api

  // Class C batching: accumulate geometries per facade variant, flush merged.
  let mergeGeometries = null;
  const contextBatch = {};   // variantIndex → [geometry,...]
  const contextMeshes = [];

  /* ---- coord helpers (east/north metres relative to CENTER) ---- */
  const R = 6378137;
  let latR = 0;
  function toXY(lng, lat) {
    return [(lng - CENTER[0]) * (Math.PI / 180) * R * Math.cos(latR),
            (lat - CENTER[1]) * (Math.PI / 180) * R];
  }
  // Sun direction remapped from Move-1's y-up rig to our z-up world (east,north,up)
  function sunWorld(rig) { return [rig.sunVec[0], -rig.sunVec[2], rig.sunVec[1]]; }

  /* ---- seeded RNG so a building looks identical every frame/reload ---- */
  function rngFrom(x, y) {
    let s = (Math.floor(x * 13.37) ^ Math.floor(y * 7.11)) >>> 0;
    return function () { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* ---- facade texture variants (windows): built once, shared by all buildings.
     Mirrors mapbox_app.js createBuildingTextures, generalised to N variants. */
  let FACADES = null;
  function buildFacades() {
    if (FACADES) return FACADES;

    /* Facade grammar traced to reference photography of the shortlist itself
       (references/ — Starmark Camelot corner elevation, media/starmark/starmark-07):
       these are NOT punched-window towers. They are horizontal RIBBON GLAZING between
       pale concrete SPANDREL BANDS. The previous build drew a dense grid of high-contrast
       lit squares on a near-black wall, which read as an arcade sprite rather than a
       Grade-A office block — wrong silhouette, wrong material, wrong value range. */
    const palettes = [
      { band: "#d9d5cc", glass: "#2c4f4a", mullion: "#8f9490" }, // cream band / green ribbon (Starmark)
      { band: "#cfd3d6", glass: "#33454f", mullion: "#899097" }, // grey band / slate ribbon
      { band: "#d5d0c6", glass: "#2f4450", mullion: "#8d9298" }, // warm stone / blue-grey ribbon
      { band: "#c9ccd0", glass: "#2a3f47", mullion: "#868c91" }, // pale concrete / teal ribbon
    ];

    FACADES = palettes.map((p) => {
      const cw = 256, ch = 256;
      const mk = () => { const c = document.createElement("canvas"); c.width = cw; c.height = ch; return c; };
      const c1 = mk(), c2 = mk(), c3 = mk();
      const x1 = c1.getContext("2d"), x2 = c2.getContext("2d"), x3 = c3.getContext("2d");

      // base = spandrel band colour; emissive black; roughness matte
      x1.fillStyle = p.band; x1.fillRect(0, 0, cw, ch);
      x2.fillStyle = "#000";  x2.fillRect(0, 0, cw, ch);
      x3.fillStyle = "#c8c8c8"; x3.fillRect(0, 0, cw, ch);   // concrete: matte

      // One floor = 32px: 20px glazed ribbon over a 12px spandrel band.
      const FLOOR = 32, GLASS_H = 20;
      for (let y = 0; y < ch; y += FLOOR) {
        // glazed ribbon
        x1.fillStyle = p.glass; x1.fillRect(0, y, cw, GLASS_H);
        x3.fillStyle = "#1e1e1e"; x3.fillRect(0, y, cw, GLASS_H);   // glass: smooth/reflective

        // vertical mullion rhythm — 16px bay, matching the reference's bay spacing
        x1.fillStyle = p.mullion;
        for (let x = 0; x < cw; x += 16) x1.fillRect(x, y, 1.5, GLASS_H);

        // shadow line under the band overhang — this is what gives the facade depth
        x1.fillStyle = "rgba(0,0,0,0.20)";
        x1.fillRect(0, y + GLASS_H, cw, 2);

        // Lit panes: sparse and warm. 42% at full white previously made every tower a
        // Christmas tree; a real office at dusk shows a scattered handful.
        for (let x = 0; x < cw; x += 16) {
          if (Math.random() < 0.10) {
            const warm = Math.random() < 0.75 ? "#e8dcc0" : "#cfe0e6";
            x1.fillStyle = warm;      x1.fillRect(x + 2, y + 3, 12, GLASS_H - 6);
            x2.fillStyle = "#4a4436"; x2.fillRect(x + 2, y + 3, 12, GLASS_H - 6);  // low emissive
          }
        }
      }

      const T = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.018, 0.030); return t; };
      return new THREE.MeshStandardMaterial({
        map: T(c1), emissive: 0xffffff, emissiveMap: T(c2), emissiveIntensity: 0.45,
        roughnessMap: T(c3), roughness: 0.55, metalness: 0.12, envMapIntensity: 0.9,
        transparent: false, opacity: 1, depthWrite: true, depthTest: true,
        side: THREE.DoubleSide,          // solid, opaque facade
      });
    });
    return FACADES;
  }

  /* solid roof material for the extrude caps (top+bottom) — NOT window-textured */
  let ROOFMAT = null;
  function roofMat() {
    return ROOFMAT || (ROOFMAT = new THREE.MeshStandardMaterial({
      color: 0x6b7078, roughness: 0.92, metalness: 0.06, side: THREE.DoubleSide }));
  }

  /* ---- build one building's geometry (z-up world metres) ---- */
  function buildingGeometry(ring, heightM) {
    const shape = new THREE.Shape();
    ring.forEach((ll, i) => { const [x, y] = toXY(ll[0], ll[1]); i ? shape.lineTo(x, y) : shape.moveTo(x, y); });
    const geo = new THREE.ExtrudeGeometry(shape, { depth: heightM, bevelEnabled: false });
    geo.computeVertexNormals();
    return geo;
  }

  // bbox + rough centroid of a ring, in world metres
  function ringBox(ring) {
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    ring.forEach((ll) => { const [x, y] = toXY(ll[0], ll[1]); minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); });
    return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, d: maxY - minY };
  }

  function roofUnits(box, heightM, rnd) {
    const geos = [];
    const n = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const uw = 2 + rnd() * 4, ud = 2 + rnd() * 4, uh = 1.2 + rnd() * 2.2;
      const g = new THREE.BoxGeometry(uw, ud, uh);
      const px = box.minX + 3 + rnd() * Math.max(1, box.w - 6);
      const py = box.minY + 3 + rnd() * Math.max(1, box.d - 6);
      g.translate(px, py, heightM + uh / 2);
      geos.push(g);
    }
    return geos;
  }

  const buildings = {};   // atlasId → { group, body, baseColor }

  /* ---- Class A/B: an individual detailed building (few of these) ---- */
  function addBuilding(ring, heightM, opts = {}) {
    if (!ring || ring.length < 3) return null;
    const box = ringBox(ring);
    const rnd = rngFrom(box.cx, box.cy);
    const facades = buildFacades();
    const variant = opts.variant != null ? opts.variant : Math.floor(rnd() * facades.length);
    const g = new THREE.Group();

    // Class A/B get their OWN facade material clone so highlight/ghost is per-building.
    // Material array: [0]=caps (solid roof), [1]=extruded sides (windowed facade).
    const bodyMat = facades[variant].clone();
    const body = new THREE.Mesh(buildingGeometry(ring, heightM), [roofMat(), bodyMat]);
    body.userData = { atlasId: opts.id, cls: opts.cls || "A" };
    g.add(body);
    if (opts.id) buildings[opts.id] = { group: g, body, mat: bodyMat, baseColor: bodyMat.color.getHex() };

    // Rooftop plant is randomly generated (count, size and position all from rnd()),
    // so it is invented detail on a specific, identifiable building. Off by default;
    // opts.roofPlant must be explicitly set for a client that wants massing filler.
    if (opts.roofPlant) {
      const ru = roofUnits(box, heightM, rnd);
      if (ru.length) g.add(new THREE.Mesh(mergeGeometries(ru, false), roofMat()));
    }

    // REMOVED — invented entrance canopy.
    // It was placed at (box.cx, box.minY - 2.5), i.e. 2.5 m outside the footprint's
    // southern edge, with no knowledge of where the real entrance is. On Sumadhura
    // Capitol that edge faces Whitefield Road, so the canopy rendered as a slab lying
    // in the carriageway. Geometry a tenant reads as part of the building must come
    // from the footprint, not from a guess.
    scene.add(g);
    map.triggerRepaint();
    return g;
  }

  /* ---- Class C: queue a context building; flush() merges per variant ---- */
  function addContext(ring, heightM) {
    if (!ring || ring.length < 3 || !(heightM > 0)) return;
    const box = ringBox(ring);
    const rnd = rngFrom(box.cx, box.cy);
    const variant = Math.floor(rnd() * buildFacades().length);
    const geos = [buildingGeometry(ring, heightM), ...roofUnits(box, heightM, rnd)];
    (contextBatch[variant] ||= []).push(mergeGeometries(geos, false));
  }
  function flushContext() {
    const facades = buildFacades();
    for (const [v, geos] of Object.entries(contextBatch)) {
      if (!geos.length) continue;
      const merged = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
      const mesh = new THREE.Mesh(merged, facades[v]);
      mesh.userData = { cls: "C" };
      scene.add(mesh); contextMeshes.push(mesh);
      contextBatch[v] = [];
    }
    map.triggerRepaint();
  }

  /* ---- attach an arbitrary object (prop clone / hero GLB) at a lng/lat ---- */
  function attachAt(obj, lng, lat, { yaw = 0, z = 0 } = {}) {
    const [x, y] = toXY(lng, lat);
    obj.position.set(x, y, z);
    obj.rotation.x = Math.PI / 2;      // kit models are y-up → our z-up world
    if (yaw) obj.rotateZ(yaw);
    scene.add(obj);
    map.triggerRepaint();
    return obj;
  }

  function addObject(obj) { scene.add(obj); map.triggerRepaint(); return obj; }
  function onFrame(cb) { frameCbs.push(cb); }

  /* ---- per-building state so existing UI (highlight/select/filter) drives it ---- */
  function setHighlight(id, on) {
    const b = buildings[id]; if (!b) return;
    b.mat.emissive.setHex(on ? 0x2fbf71 : 0xffffff);
    b.mat.emissiveIntensity = on ? 0.30 : (getRig(themeModeRef()).eDeg < 2 ? 0.85 : 0.45);
    map.triggerRepaint();
  }
  function setSelected(id, on) {
    const b = buildings[id]; if (!b) return;
    b.mat.color.setHex(on ? 0x8ff0b6 : b.baseColor);
    map.triggerRepaint();
  }
  function setGhost(id, on) {
    const b = buildings[id]; if (!b) return;
    b.mat.transparent = on; b.mat.opacity = on ? 0.18 : 1; b.mat.depthWrite = !on;
    b.group.visible = true;
    map.triggerRepaint();
  }
  function hasBuilding(id) { return !!buildings[id]; }

  /* ---- Phase 3: instanced props scattered along the real road network ----
     Trees + lamps as InstancedMesh (one draw call per species). y-up kit
     geometry is baked then rotated to our z-up world once. */
  async function populateProps(roads, heroes = [], opts = {}) {
    if (!roads || !roads.length) return;
    const wantTrees = opts.trees !== false, wantLamps = opts.lamps !== false;
    if (!wantTrees && !wantLamps) return;
    const dummy = new THREE.Object3D();
    const treeIds = A.idsByKind("tree");
    const lampId = "lamp";

    // sample points along every road, offset to the kerb, alternating sides
    const treePts = [], lampPts = [];
    let toggle = 0;
    roads.forEach((r) => {
      const pts = r.pts.map((ll) => toXY(ll[0], ll[1]));
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        let dx = bx - ax, dy = by - ay; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
        const step = 26 + (r.cls === 2 ? 10 : 0);
        for (let d = 0; d < len; d += step) {
          const side = (toggle++ % 2) ? 1 : -1;
          const off = 7 + (r.cls === 2 ? 3 : 0);
          const px = ax + dx * d - dy * off * side, py = ay + dy * d + dx * off * side;
          const rnd = rngFrom(px, py);
          if (rnd() < 0.6) treePts.push([px, py, rnd()]);
          else lampPts.push([px, py, Math.atan2(dy, dx)]);
        }
      }
    });
    heroes.forEach((h) => {                       // a cluster at each hero entrance
      const [cx, cy] = toXY(h[0], h[1]);
      for (let k = 0; k < 4; k++) { const a = (k / 4) * 6.28, rnd = rngFrom(cx + k, cy - k); treePts.push([cx + Math.cos(a) * 24, cy + Math.sin(a) * 24, rnd()]); }
    });

    // trees — split across species
    if (!wantTrees) treePts.length = 0;
    if (!wantLamps) lampPts.length = 0;
    for (let s = 0; s < treeIds.length; s++) {
      const mine = treePts.filter((_, i) => i % treeIds.length === s);
      if (!mine.length) continue;
      const inst = await A.getInstancedMesh(treeIds[s], mine.length);
      inst.geometry.rotateX(Math.PI / 2);         // y-up → z-up (height along +z)
      mine.forEach((p, i) => {
        dummy.position.set(p[0], p[1], 0);
        dummy.rotation.set(0, 0, p[2] * 6.28);
        const sc = 0.8 + p[2] * 0.6; dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
      });
      inst.instanceMatrix.needsUpdate = true; inst.castShadow = true; scene.add(inst);
    }
    // lamps
    if (lampPts.length) {
      const inst = await A.getInstancedMesh(lampId, lampPts.length);
      inst.geometry.rotateX(Math.PI / 2);
      lampPts.forEach((p, i) => { dummy.position.set(p[0], p[1], 0); dummy.rotation.set(0, 0, p[2]); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix); });
      inst.instanceMatrix.needsUpdate = true; scene.add(inst);
    }
    map.triggerRepaint();
    console.log(`[Atlas] Props: ${treePts.length} trees, ${lampPts.length} lamps (instanced) along ${roads.length} roads`);
  }

  function relight(rig) {
    if (!sun) return;
    sun.color.setHex(rig.sunColor); sun.intensity = rig.sunI;
    sun.position.set(...sunWorld(rig));
    hemi.color.setHex(rig.skyColor); hemi.groundColor.setHex(rig.groundColor); hemi.intensity = rig.hemiI * 1.4;
    if (scene.fog) scene.fog.color.setHex(rig.skyColor);   // atmosphere follows the sky
    renderer.toneMappingExposure = rig.exposure;
    // night: lift window/lobby glow across all facades
    const night = rig.eDeg < 2;
    buildFacades().forEach((m) => { m.emissiveIntensity = night ? 0.85 : 0.45; });
    map.triggerRepaint();
  }

  /* ---- the Mapbox custom layer ---- */
  function makeLayer() {
    return {
      id: "atlas-world",
      type: "custom",
      renderingMode: "3d",
      onAdd(_map, gl) {
        scene = new THREE.Scene();
        camera = new THREE.Camera();
        const rig = getRig(themeModeRef());
        hemi = new THREE.HemisphereLight(rig.skyColor, rig.groundColor, rig.hemiI * 1.4);
        sun = new THREE.DirectionalLight(rig.sunColor, rig.sunI);
        sun.position.set(...sunWorld(rig));
        scene.add(hemi, sun);
        // Atmosphere — distant towers fade into the sky like the basemap city,
        // so they read as part of the environment, not stickers on top of it.
        scene.fog = new THREE.Fog(rig.skyColor, 900, 3800);
        renderer = new THREE.WebGLRenderer({ canvas: _map.getCanvas(), context: gl, antialias: true });
        renderer.autoClear = false;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = rig.exposure;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        this._last = performance.now();
        // Image-based lighting — without this, metalness>0 glass renders BLACK.
        // This is what brings the colour/reflections to life.
        import("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js")
          .then(({ RoomEnvironment }) => {
            const pmrem = new THREE.PMREMGenerator(renderer);
            scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
            map.triggerRepaint();
          }).catch((e) => console.warn("[Atlas] env map skipped:", e.message));
      },
      render(gl, matrix) {
        const now = performance.now();
        const dt = Math.min(0.06, (now - this._last) / 1000); this._last = now;
        for (const cb of frameCbs) { try { cb(dt, now); } catch (e) { /* keep rendering */ } }

        const m = new THREE.Matrix4().fromArray(matrix);
        const l = new THREE.Matrix4()
          .makeTranslation(originMC.x, originMC.y, originMC.z)
          .scale(new THREE.Vector3(mScale, -mScale, mScale));
        camera.projectionMatrix = m.multiply(l);
        renderer.resetState();
        renderer.clearDepth();   // own depth buffer → buildings are SOLID, not see-through
        renderer.render(scene, camera);
        map.triggerRepaint();
      },
    };
  }

  async function init(opts) {
    if (added) return api;
    THREE = opts.THREE; map = opts.map; mapboxgl = opts.mapboxgl;
    CENTER = opts.center; getRig = opts.getRig; themeModeRef = opts.themeMode;
    latR = CENTER[1] * Math.PI / 180;
    originMC = mapboxgl.MercatorCoordinate.fromLngLat(CENTER, 0);
    mScale = originMC.meterInMercatorCoordinateUnits();
    A = await window.AtlasAssets.init(THREE);
    const BGU = await import("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js");
    mergeGeometries = BGU.mergeGeometries;
    map.addLayer(makeLayer());
    added = true;
    console.log("[Atlas] Unified world layer online (one scene, one sun).");
    return api;
  }

  const api = { init, addBuilding, addContext, flushContext, attachAt, addObject, onFrame, relight,
                setHighlight, setSelected, setGhost, hasBuilding, populateProps,
                get scene() { return scene; }, toXY, get assets() { return A; } };
  return api;
})();
