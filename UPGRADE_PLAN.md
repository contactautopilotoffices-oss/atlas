# Upgrade plan: JindalX 3D explorer, visual realism

Branch `update-jindal-dev`. This covers what is upgraded, what is modelled new, in what order, and
what each step is checked against. The audit is `VISUAL_REALISM_AUDIT.md`, the results are in
`VISUAL_REALISM_REPORT.md`, and the asset list is `ASSET_INVENTORY.md`.

## Decisions

| Question | Decision | Why |
| --- | --- | --- |
| Blender MCP or scripts | Blender Python, headless (`bpy` 5.2.3) | No MCP connection reaches this cloud session. Every step is a script, so it reruns on any machine, MCP or not |
| React Three Fiber | Keep the plain three.js explorer | No React in the repository, and the brief says not to rebuild the app or add a second renderer. The GLBs work in R3F unchanged if that is ever wanted |
| One mesh or many | Separate collections in the `.blend`, one merged mesh in the GLB | Collections keep the source editable. The merged export keeps one draw call per material |
| Textures | Generated PBR sets (colour, roughness, normal) | External CC0 libraries are blocked here, and generated textures carry no licence questions. Metalness is a per-material constant. Ambient occlusion comes from the explorer's GTAO pass, so no baked AO maps |
| Compression | Meshopt geometry; JPEG and palette PNG textures | KTX2 tools are not available in this container |
| Architecture | Grade A: curtain wall. Grade B: plaster with ribbon windows and sunshades | The repository's existing convention (`scripts/world/README.md`), applied to the workbook's grades |
| Amenities | None modelled | The workbook lists none for any option. A cafeteria is only "planned" or "can be planned" |

## Upgrade or new model

| Asset | Before | Now |
| --- | --- | --- |
| Option buildings (4) | A generic prism with one facade texture | **New model** per option from `hero_building.py`, driven by the workbook (floors, plate, grade, stilt, stepped upper block) |
| Option plots (4) | Bare slab | **New model.** Wall, gates, cabin, forecourt, drive, parking, layered beds, hedges, lights |
| Context buildings | Extruded footprints with facade textures | **Kept**, upgraded by the light and ground. Detailed modelling stays on the property, as the brief asks |
| Trees | 3 prototypes, a carpet of 6,500 to 20,400 | **Upgraded.** Neem, ashoka and palm models, avenues and parks, 2,500 to 7,900 trees |
| Shrubs, hedges, grasses, flowers | None | **New.** Shrub, bougainvillea, ornamental grass and mixed-flower cards, box hedges |
| Ground | Tinted roof texture | **New** Noida soil and grass material; lawn, mulch, pavers and asphalt on the plots |
| Lighting | Fixed sun, ACES | **Upgraded.** AgX and the time-of-day studio, opening at 15:45 |

## Phases and status

| Phase | What | Status |
| --- | --- | --- |
| 1. Audit | Blender, MCP, assets, app, pipeline | Done: `VISUAL_REALISM_AUDIT.md`, `ASSET_INVENTORY.md` |
| 2. Pilot | Magnus Towers building and plot | Done (first pass on 23 Nov, now rebuilt through the generic builder) |
| 3. Preview renders | Blender stills from the 4 cameras, compared with the references | Done: `docs/visual-realism/` |
| 4. Refinement | Glass reflectance, exposure, cabin placement, landscaping layers, sky | Done, see the report |
| 5. Export | Editable `.blend` per option, merged GLB, meshopt | Done: `assets/blender/`, `media/jindalx-noida/world/d/` |
| 6. Browser integration | Materials by name, stepped floor bands, lighting default | Done in `engine/world.js` |
| 7. Testing | Logic gate, smoke test, unit tests, benchmarks from identical cameras | Done, see the report |
| 8. Expansion | A104, A14/18/19, D1 | Done through the same builder and spec file |

## How a new property is added

1. Add an entry to a spec file such as `scripts/world/heroes/noida_jindalx.json`. Give its name, grade, ground floor type, storeys, any upper block, and the "known" and "assumed" lists.
2. Make sure the option has an outline in the refs file. `plot_massing.py` makes one if there is no surveyed plot.
3. Run the steps in `scripts/world/heroes/README.md`.

## Open items

- **Replace assumed designs** with the developers' drawings or photos when they arrive. Magnus Towers is first, since its architect is known.
- **Basement ramps** are left out on A104, A14/18/19 and D1, because the indicative plots have no room behind the building. Place them once the plots are surveyed.
- **KTX2 textures** on a machine with `toktx`, to cut GPU memory on phones.
- **Real-device frame rates** need measuring on a laptop and a phone at the preview with `?perf=1`.
