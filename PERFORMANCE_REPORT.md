# 3D explorer performance report

`/jindalx-noida/world` (and every atlas served by `engine/world.js`), 23 November 2026.

The explorer was slow because it drew far more trees than it needed, three times a frame. The fix
keeps the model, the buildings, the positions and every mode as they were. It changes how much of
the scene is drawn, how often, and at what resolution.

## How it was measured

- **Tool:** `scripts/world-bench.cjs`. It loads the real page in headless Chromium, once with the
  cache disabled and once as a repeat visit. Then it renders frames one at a time in three states
  (dollhouse still, dollhouse orbiting, walking) and times each frame to the end of its GPU work.
  It reads draw calls and triangles over every pass of a frame, plus bytes, requests and load time.
  - Run it with `PORT=8137 node scripts/atlas-dev.js`.
  - Then `node scripts/world-bench.cjs http://localhost:8137 jindalx-noida a14-18-19 out.json`.
  - `BENCH_QS=ao=0` prices one feature.
- **Hardware:** a cloud container with 4 cores of an Intel Xeon at 2.30 GHz, 15 GB RAM and **no
  GPU**. Chromium renders WebGL with SwiftShader (Vulkan on the CPU). The viewport is 960×540 at a
  pixel ratio of 1.
- **What that means:**
  - Draw calls, triangles, bytes, request counts and JavaScript time are exact, and the same on any
    machine.
  - Frame times are CPU-emulated GPU times: tens of seconds instead of milliseconds. Only the
    before-and-after ratio carries over to real hardware. It is a conservative ratio, because
    SwiftShader is relatively better at triangles than a real GPU.
  - Real FPS on a laptop or phone has **not** been measured. See "Not verified".
- **Options measured:**
  - A14/18/19: the heaviest, with 20,358 trees.
  - D1: the lightest, with 6,493 trees.

## Baseline: what was slow

| | A14/18/19 | D1 |
| --- | --- | --- |
| Triangles drawn per frame (all passes) | **51.6 million** | 16.7 million |
| Draw calls per frame | 278 | 351 |
| Frame, dollhouse still (SwiftShader) | 40.2 s | 28.3 s |
| Frame, dollhouse orbiting | 40.4 s | 27.8 s |
| Frame, walking | 59.6 s | 46.1 s |
| First frame after load | 80.2 s | 47.1 s |
| JavaScript per frame | 3 to 5 ms | 3 to 5 ms |
| Downloaded before the first frame | 10.5 MB, 85 requests | 6.6 MB, 79 requests |
| Load to scene built (local server) | 1.5 s | 1.4 s |

### Confirmed bottlenecks

1. **GPU geometry (the main one).**
   - Noida's sectors are green, so `prep.py` scattered 6,500 to 20,400 trees per slab. Andheri's
     Privilon has 2,400.
   - Each tree crown is 300 to 830 alpha-tested leaf cards.
   - Every tree was drawn at full detail, in one InstancedMesh per tree type, with nothing culled.
   - That happened in three passes: the shadow map, the scene, and the ambient-occlusion normal pass.
   - Trees were about 97% of the 51.6 million triangles.
2. **GPU fill.**
   - Each frame ran 4× MSAA on a half-float target, GTAO at full resolution (16 samples), and a
     4096² soft shadow map.
   - The pixel ratio went up to 2.
   - D1, with a third of A14's triangles, was only 30% faster. That gap is per-pixel cost.
3. **Rendering when nothing changed.**
   - The loop drew every frame forever, including the shadow map.
   - That held when the dollhouse was standing still and no one was touching it.
4. **Walk mode CPU (small).**
   - Every step tested the walker against every footprint (2,459 at A14/18/19).
   - The mini-map redrew all of them as separate canvas paths every frame.
   - This is real cost, but small next to points 1 to 3. JavaScript was never above 8 ms a frame.
5. **Loading in series.**
   - The model download only started after the 1.5 MB sky had been fetched and processed.
   - Switching to another option downloaded and parsed its model from scratch.
   - World media had no cache headers.

**Not bottlenecks:**
- **Static geometry:** about 290,000 triangles, already merged by material.
- **Textures:** 69 JPEGs, 2.5 MB on the wire.
- **JavaScript:** a few ms a frame.

## What changed

All of the changes are in `engine/world.js`, unless noted.

### Trees: cells, three levels of detail, culling (`buildForest`)

- **Cells.** Trees are binned into 100 m cells. A cell outside the camera's view, with a safety
  margin, is skipped whole.
- **Three levels of detail**, by distance from the eye:

  | Distance | What is drawn |
  | --- | --- |
  | Under 150 m | The original crown |
  | 150 to 450 m | Every second leaf card, grown 1.4× about its centre |
  | Over 450 m | Every eighth card, grown 2.6×, with no trunk |

  Outline and colour hold, as the screenshots below show.
- **Per-tree frustum culling.** Inside a visible cell, each tree is tested against the view.
  Only visible trees are copied into their level's InstancedMesh, which also sets the count.
  - The buckets are re-sorted only when the eye moves 4 m or turns 2°.
  - Only the used part of each matrix buffer is uploaded.
- **Shadows.** Shadow casting moves to copies at the middle level, in coarser 200 m cells, on a
  layer only the sun's camera sees. For A14/18/19 that is 413 instanced meshes in the scene. With
  100 m cells it was 1,195.
  - Every tree keeps its shadow, including those behind the camera.
  - The shadow map culls whole cells.
- **Reflections.** The reflection probe looks all around, so for its capture every tree is shown
  at the far level.
- **Reuse.** The geometries are derived once per diorama and disposed with it. Materials are
  shared through the existing cache.

### Shadows drawn only when they change

- `renderer.shadowMap.autoUpdate = false`. The map is redrawn only when the sun or the shadow box
  moves, or when a new diorama loads.
- In walk mode the shadow box follows the walker only once they have moved 25 m. It used to move
  every frame, which redrew the map every frame.
- Cars, people and trains no longer cast shadows. From the dollhouse they are a few pixels, and in
  the street they would need the map redrawn every frame.

### Ambient occlusion at half resolution

GTAO's normal pass, sampling and denoise now run at half width and height (a quarter of the pixels).
The result is blended over the full-resolution frame. Measured afterwards, ambient occlusion costs
about 2% of a frame.

### Pixel ratio cap and adaptive quality

- **Cap.** The pixel ratio is capped at 1.5. A 2× screen at 2 draws 78% more pixels.
- **Four tiers.** The explorer watches the median of the last 90 full-rate frames and drops a tier
  below about 36 fps.

  | Tier | Pixel ratio | Ambient occlusion | MSAA |
  | --- | --- | --- | --- |
  | 0 | Up to 1.5 | On | 4× |
  | 1 | Up to 1.25 | On | 4× |
  | 2 | 1 | Off | 2× |
  | 3 | 0.8 | Off | Off |

- **Recovery.** It climbs back a tier after 20 s at vsync, and stops climbing after three drops so
  it can't flip back and forth.
- **Memory.** The tier is remembered for the browser session.
- **Phones.** Phones and `?q=low` start at tier 2.
- **Overrides.** `?dpr=` forces a ratio, and `?adapt=0` holds the starting tier.
- **Why MSAA is in the tiers.** 4× MSAA turned out to be about 30% of the remaining frame.

### Render on demand

A frame is drawn only when something changes:
- input of any kind;
- the camera easing (a fly-to, or orbit damping after release);
- auto-rotate;
- walking, or the route walk;
- a texture arriving, or a resize.

How each state renders now:
- A still dollhouse that nobody is touching draws **nothing**. The smoke test counted 0 frames in
  5 s.
- Standing still in the street draws at 30 fps, so the traffic keeps moving.
- Auto-rotate, orbiting and walking draw at full rate.
- The existing 400 ms throttle behind the film overlay is kept.

The explorer is plain JavaScript and three.js, not React, so there are no React re-renders to
prevent. DOM updates (labels, the HUD) now happen only on drawn frames.

### Walk mode

- **Collisions.** They test only the footprints in the walker's 20 m grid cell, not all of them.
- **Mini-map.** It draws the footprints as one cached `Path2D`, and only when the walker moves or
  turns.
- **Raycasting.** It was already limited to the ground meshes, and only runs on a click. Unchanged.

### Loading

- **Download in parallel.** The chosen option's model and data start downloading at once,
  alongside the sky, instead of after it.
- **Prefetch.** Once the first option is on screen, the other options' models are fetched in idle
  time. This applies to atlases of up to six plain models, and not when Save-Data is on.
  - Switching then parses from memory in **104 to 227 ms**, measured.
  - Before, every switch downloaded and parsed the model again.
- **Cache headers (`vercel.json`).**
  - `/media/*/world/*` is cached for an hour, with stale-while-revalidate for a week.
  - The vendored three.js is cached for a day, with stale-while-revalidate for a week.

### Tools added

- `scripts/world-bench.cjs`: the benchmark described above.
- `scripts/world-smoke.cjs`: checks every mode in the real page loop.
- The `?perf=1` and `?bench=1` hooks in `world.js`, which do nothing without the flag.

## After

| | A14/18/19 before | A14/18/19 after | D1 before | D1 after |
| --- | --- | --- | --- | --- |
| Triangles per frame | 51.6 M | **2.3 M** (22× fewer) | 16.7 M | **1.9 M** (8.7× fewer) |
| Draw calls, dollhouse | 278 | 180 | 351 | 259 |
| Draw calls, orbiting | 255 | 119 | 330 | 192 |
| Draw calls, walking | 153 | 138 | 170 | 149 |
| Frame, dollhouse still | 40.2 s | **7.1 s** (5.6× faster) | 28.3 s | **7.0 s** (4.1×) |
| Frame, orbiting | 40.4 s | **7.2 s** (5.6×) | 27.8 s | **7.2 s** (3.9×) |
| Frame, walking | 59.6 s | **8.8 s** (6.7×) | 46.1 s | **10.3 s** (4.5×) |
| First frame after load | 80.2 s | **20.7 s** (3.9×) | 47.1 s | **16.2 s** (2.9×) |
| Frames drawn by a still dollhouse | every frame | **none** | every frame | **none** |
| JavaScript per frame | 3 to 5 ms | 3 to 8 ms | 3 to 5 ms | 3 to 5 ms |
| JS heap | 44 to 58 MB | 64 to 76 MB | 32 MB | 39 to 42 MB |

- **What the remaining frame time is.** It is now mostly per-pixel shading, which SwiftShader does
  on the CPU.
  - Turning MSAA off takes A14's still dollhouse from 7.1 s to 5.0 s.
  - Turning ambient occlusion off takes it from 7.1 s to 7.0 s.
  - On a real GPU, that per-pixel work is what the quality tiers trade away when a device can't
    keep up.
- **Why the heap is higher.** The extra instance buffers, plus the other options' models held in
  memory after prefetch. That trade buys switches in 0.1 to 0.2 s.

**What this should mean on real hardware** (an estimate, not a measurement):
- A capable laptop GPU handles 2 to 3 million triangles at 60 fps. The 51 million of before is
  what made it laggy.
- Weaker integrated GPUs and phones get the triangle cut plus the adaptive tiers. Those should
  reach 30 fps or better.

### Asset sizes

The models were already meshopt-compressed and quantised (1.9 to 5.0 MB each), so nothing was
re-encoded. The first visit still downloads the same bytes (10.5 MB for A14/18/19, 6.6 to 7.1 MB
for D1). The difference is that loading now overlaps the sky, and later visits and switches reuse
what was fetched.

### Loading

| | A14/18/19 before | A14/18/19 after | D1 before | D1 after |
| --- | --- | --- | --- | --- |
| Load to scene built, cache disabled (local server) | 1.50 s | 1.38 s | 1.39 s | 1.19 s |
| Load to scene built, repeat visit (local server) | 1.54 s | 1.48 s | 1.38 s | 1.22 s |
| Switch to another option | full download and parse | **0.10 to 0.23 s** | | |

The local dev server sends no cache headers, so a repeat visit there re-downloads everything. The
new Vercel headers make repeat visits use the browser cache. That can only be confirmed on the
deployed site (see below).

## Appearance and function

- **Screenshots.** Before and after, of A14/18/19 in the dollhouse and in walk mode, at 960×600:
  - The dollhouse is visually the same: canopy density, tree shadows, the lit floors and labels.
  - In walk mode, the lobby glass now reflects the trees. The reflection probe used to miss them.
- **`scripts/world-smoke.cjs`**, run in the real page loop. It checks:
  - load;
  - a still dollhouse stopping (0 frames in 5 s) and input waking it;
  - the forest;
  - walking, collisions and the mini-map;
  - the route walk;
  - the floor stack and the 2D Map link;
  - switching to every option;
  - each quality tier;
  - no page errors.

  Result on JindalX: **19 of 19 passed.**
  - A still dollhouse drew 0 frames in 5 s, and a scroll woke it.
  - The walker moved, and stopped at a wall or the slab edge.
  - The route walk advanced.
  - All four options switched, and all four tiers applied.
  - There were no page errors.

  The switch times in that run (30 to 60 s) are SwiftShader drawing the fly-in. Called directly,
  `select()` took 104 to 227 ms per option.
- **Memory.** Twelve switches round the four options showed no leak:
  - GPU geometries return to the same count for each option (117 to 121);
  - textures plateau at 73, because the texture cache is shared across options;
  - the JS heap stays between 68 and 86 MB with no upward trend.
- **Satellite ground.** The Mapbox satellite ground and the "Surroundings" view are unchanged.
  They need `config.js`, which only exists on the deployed site.

## Not verified, and what is left

1. **No real GPU.** Every frame time here is SwiftShader on a CPU. Check 60 fps on a laptop and
   30 fps on a phone at the deployed preview:
   - open `?perf=1`;
   - in the console, read `__world.PERF.at` (frame timestamps);
   - or use the browser's performance panel.
2. **Repeat-visit caching on Vercel.** The new headers can only be confirmed on the preview, which
   is behind Vercel login.
3. **Textures, as KTX2/Basis.**
   - The 69 JPEGs decode to about 200 MB of GPU memory with mipmaps, if all are used. About 60 are
     loaded per diorama.
   - KTX2 (ETC1S) would cut that by roughly 6× and matters most on phones.
   - It was not done because this container has no `toktx` or `basisu`.
   - It is the next step if phones run short of memory.
4. **Static geometry is not split into tiles.**
   - Buildings, roofs and ground (about 290,000 triangles) stay merged per material.
   - Splitting them would multiply draw calls in the dollhouse, where the whole slab is in view.
   - It would gain little, since triangles are no longer the limit.
5. **The other explorers on this engine.**
   - Flipkart Andheri (`/flipkart-andheri/world`) loads with no page errors. Its trees go through
     the same cells and levels of detail: 5,596 trees, 1.8 million triangles a frame.
   - Skymark (`/engine/world.html?atlas=noida-skymark`) loads with no errors, before and after.
   - Andheri's branded intro, preview models and lighting studio are untouched. Its lighting
     changes still redraw the shadow map, because they go through `sunBox`.
   - Their frame rates were not benchmarked.
