# Reading an AutoCAD 2010 (AC1024) DWG on Linux and counting seats and rooms

Scope: how to read "20260915_SKY_MARK_NOIDA_1ST_VOLT_ENERGY_R16.dwg" (header AC1024, 1.1 MB) headless on Ubuntu 24.04 / Python 3.13 / Node 22 with only PyPI, npm and GitHub reachable, and how to prove or disprove a 100-seat claim from its entities. Researched 11 November 2026.

Method note: package versions come from live `npm view` and the PyPI JSON API on 2026-11-11. Several claims are backed by **hands-on tests on the real file** in this container: @mlightcad/libredwg-web 0.8.8 and @node-projects/acad-ts 3.8.0 under Node v22.23.4. Test scripts are in `/tmp/claude-0/-home-user-atlas/4916a3cb-0b24-5ee3-9958-bffcb6a246c8/scratchpad/scripts/` (lw.mjs, lw2.mjs, lw3.mjs, lw4.mjs, acad.mjs, acad2.mjs, acad3.mjs). These tests are labelled "[tested here]" and have no web URL. The session network blocked ezdxf.mozman.at, ezdxf.readthedocs.io, www.opendesign.com, ftp.gnu.org (403) and the GitHub REST API (gh api, 403). So ezdxf claims are cited from its installed source code (wheel 1.4.5 from PyPI, unpacked and grepped), and ODA claims from search snippets of its pages.

## Q1. Which DWG readers handle AC1024, under what licence, and how do you run them headless on Linux?

### Takeaway
Two npm packages read this exact file in under a second each, with no native build, under Node 22: **@mlightcad/libredwg-web** (GPL-3.0, LibreDWG compiled to WASM) and **@node-projects/acad-ts** (MIT, a TypeScript port of ACadSharp). They agree on the model-space counts. acad-ts additionally exposes block-record XDATA, so dynamic-block (*U) effective names can be recovered; libredwg-web's typed database does not expose it. For a Python pipeline the route is DWG → DXF (LibreDWG `dwg2dxf` built from source, or acad-ts DxfWriter) → **ezdxf 1.4.5** (MIT), which has the best query, block, dynamic-block, MTEXT and rendering tooling. The ODA File Converter works headless only with Xvfb, and per ODA's own FAQ it is for non-commercial use unless you are an ODA member. Aspose.CAD is the paid fallback.

### Cited Findings
**Version and maturity matrix (live registry data, 2026-11-11)**
- @mlightcad/libredwg-web: version 0.8.8, published 2026-11-10, licence GPL-3.0, description "A DWG/DXF JavaScript parser based on libredwg", engines node >=20, unpacked size about 13 MB. Releases are very frequent (0.8.5 to 0.8.8 between 7 and 10 Nov 2026). — [npm @mlightcad/libredwg-web](https://www.npmjs.com/package/@mlightcad/libredwg-web)
- @mlightcad/libredwg-converter 3.15.25 (GPL-3.0), from the mlightcad/realdwg-web repo, published 2026-11-10. @mlightcad/cad-simple-viewer 1.7.8 (MIT), from the mlightcad/cad-viewer repo. — [npm @mlightcad/libredwg-converter](https://www.npmjs.com/package/@mlightcad/libredwg-converter); [npm @mlightcad/cad-simple-viewer](https://www.npmjs.com/package/@mlightcad/cad-simple-viewer)
- @node-projects/acad-ts: version 3.8.0, published 2026-11-06, licence MIT, "TypeScript library to read and write AutoCAD DWG and DXF files". First published 2026-04-13. — [npm @node-projects/acad-ts](https://www.npmjs.com/package/@node-projects/acad-ts)
- @cadview/dwg: version 0.2.0, last published 2026-02-19, licence GPL-3.0-only, "DWG file format support for @cadview/core via LibreDWG WASM". It converts DWG to a DXF string (`convertDwgToDxf(buffer)`, `getDwgVersion`), aimed mainly at in-browser viewers. — [npm @cadview/dwg](https://www.npmjs.com/package/@cadview/dwg)
- dxf-parser: version 1.1.2, last published 2022-06-16, MIT. DXF only; it cannot read DWG. — [npm dxf-parser](https://www.npmjs.com/package/dxf-parser)
- ezdxf: version 1.4.5, uploaded 2026-10-16, requires Python >=3.10, MIT. A cp313 manylinux wheel exists, so it installs from PyPI with no compiler. — [PyPI ezdxf](https://pypi.org/project/ezdxf/)
- No `libredwg` or `pylibredwg` package exists on PyPI (the PyPI JSON API returned nothing for either name on 2026-11-11). LibreDWG's Python bindings come only from a source build (SWIG). — [PyPI](https://pypi.org/) [tested here]

**LibreDWG (C library and command-line tools)**
- The README says LibreDWG "can read all DWG versions", but "some very advanced R2010+ objects fail to read and are skipped over". — [GitHub LibreDWG/libredwg](https://github.com/LibreDWG/libredwg)
- Writing: "R2010-R2018 writing leads to CRC errors still". dwg2dxf has about 90% coverage. dwg2SVG "Handles only some entities". dwg2ps is "very limited". — [GitHub LibreDWG/libredwg](https://github.com/LibreDWG/libredwg)
- Programs:
  - dwgread: JSON, DXF, DXFB and GeoJSON output
  - dwg2dxf, dwg2SVG, dwgbmp (extracts the thumbnail), dwglayers, dwggrep (regex text search)
  - dwgfilter: jq JSON filters
  - dwgwrite, dxf2dwg, dwgadd, dwgrewrite
  — [GitHub LibreDWG/libredwg](https://github.com/LibreDWG/libredwg)
- Build from git: install gcc/clang, make, autoconf, automake and libtool, then run `sh ./autogen.sh && ./configure [--disable-bindings] [--disable-docs] && make && make check && sudo make install`. All other dependencies (pcre2, SWIG, Python, jq and so on) are optional. `--enable-release` skips "unstable DWG features or objects"; `--enable-debug` "Activates support for unstable classes". Licence: GPL-3.0-or-later. — [GitHub LibreDWG/libredwg](https://github.com/LibreDWG/libredwg)
- Release state:
  - Last announced stable line: 0.13 (4 Feb 2024), then 0.13.2 (10 Feb 2024) and 0.13.3 (26 Feb 2024). — [Savannah news 10590](https://savannah.nongnu.org/news/?id=10590); [Savannah 10594](https://savannah.gnu.org/news/?id=10594); [Savannah 10601](https://savannah.nongnu.org/news/?id=10601)
  - The GitHub releases page shows nightly pre-releases tagged 0.14.89xx (for example 0.14.8936 on 11 Nov). Some of them carry source tar.gz and tar.xz assets, which can be downloaded from GitHub without ftp.gnu.org. — [GitHub releases](https://github.com/LibreDWG/libredwg/releases)
  - Wikipedia lists a 0.14 stable release dated 27 June 2026. I did not find the announcement, so this is unverified. — [Wikipedia LibreDWG](https://en.wikipedia.org/wiki/LibreDWG)

**@mlightcad/libredwg-web (how to call it from Node 22)**
- Install with `npm install @mlightcad/libredwg-web`. Usage:
  1. `import { Dwg_File_Type, LibreDwg } from '@mlightcad/libredwg-web'`
  2. `const libredwg = await LibreDwg.create('./node_modules/@mlightcad/libredwg-web/wasm/')` (in Node you must pass the wasm directory)
  3. `const dwg = libredwg.dwg_read_data(fileContent, Dwg_File_Type.DWG)`
  4. `const db = libredwg.convert(dwg)` returns a typed `DwgDatabase`
  5. `dwg_free` releases memory.
  - The raw API is also available (`createModule()`, `FS.writeFile`, `dwg_read_file`). The default WASM build disables JSON import/export. — [npm README](https://www.npmjs.com/package/@mlightcad/libredwg-web); [API docs](https://mlightcad.github.io/libredwg-web/docs/)
- [tested here] On the real file, libredwg-web 0.8.8 parsed in 0.86 s.
  - It returned `{tables, objects, header, entities, classes, thumbnailImage}` with 5,554 entities (model space plus all paper spaces).
  - It logged "Open dwg file with error code: 64", which is VALUEOUTOFBOUNDS in the package's enum. Codes of 128 (CLASSESNOTFOUND) and above are the critical ones, so this warning is non-fatal.
  - INSERT objects carry: name, layer, insertionPoint, x/y/zScale, rotation, rowCount/columnCount (MINSERT), attribs[], xdata, handle, ownerBlockRecordSoftId.
  - `tables.BLOCK_RECORD.entries[]` carry name, flags, basePoint, insertionUnits and **entities[]**, so nested blocks can be expanded recursively. Block-record entries expose **no xdata**, so the AcDbBlockRepBTag link from *U blocks to dynamic blocks is not reachable through the typed DB.
  - Gotcha: objects contain BigInt values, so `JSON.stringify` needs a replacer.
  - Gotcha: the package is ESM. A script outside the project folder must import it by absolute path to `dist/libredwg-web.js`.
- [tested here] `header.INSUNITS` = 1, which means inches.

**@node-projects/acad-ts**
- The README lists DwgReader and DxfReader/Writer support for AC1009 to AC1032, with AC1024 explicitly ticked. It also has SvgWriter, and is a port of ACadSharp. Usage: `DwgReader.readFromStream(arrayBuffer, (sender, e) => …)` then `doc.modelSpace.entities`. — [npm README @node-projects/acad-ts](https://www.npmjs.com/package/@node-projects/acad-ts)
- [tested here] acad-ts 3.8.0 parsed the real file in 0.57 s.
  - It raised 135 notifications, all of them unlisted objects (ACDBASSOCDEPENDENCY, ACDBASSOCPERSSUBENTMANAGER) read as UnknownNonGraphicalObject. These are parametric-constraint objects and harmless for counting.
  - Model space: 5,035 entities (886 Insert, 927 LwPolyline, 1,531 Line, 167 MText, 20 Text, 139 dimensions, 260 Face3D).
  - Its top INSERT names match libredwg-web, for example `WS-3'X2'` = 86 and `A$C779abbf3` = 118 in both.
  - BlockRecord exposes `isDynamic`, `isAnonymous`, `attributeDefinitions` and `_extendedData`. Insert has `hasAttributes`, `explode()`, `getTransform()` and `getBoundingBox()`.

**ezdxf (Python)**
- ezdxf reads DXF only. Its internal `ezdxf.addons.dwg` loader supports only `SUPPORTED_VERSIONS = [ACAD_13, ACAD_14, ACAD_2000]`, so it cannot open AC1024 DWG directly. — [ezdxf 1.4.5 source, addons/dwg/const.py](https://pypi.org/project/ezdxf/)
- The `ezdxf.addons.odafc` addon offers `readfile()`, `export_dwg()`, `convert()` and `is_installed()`, with the option `odafc-addon.unix_exec_path` (AppImages supported). On Linux it wraps the converter in `Xvfb :<pid> -screen 0 800x600x24` and otherwise warns "Install xvfb to prevent the ODAFileConverter GUI from opening". — [ezdxf 1.4.5 source, addons/odafc.py](https://pypi.org/project/ezdxf/); docs at [ezdxf odafc](https://ezdxf.readthedocs.io/en/stable/addons/odafc.html)

**ODA File Converter**
- It has a GUI and a CLI (arguments: source dir, target dir, input filter, output version). Linux builds come as DEB, RPM and AppImage; the AppImage needs fuse; GLIBC 2.28 or later is required. — [ODA DWG-DXF Converter page](https://www.opendesign.com/guestfiles/oda_file_converter.md) (search snippet only; host blocked here)
- ODA's FAQ says the File Converter and Viewer are example projects: "if you are not an ODA member, you can use them for non-commercial applications only". — [ODA: What are ODA Viewer and ODA File Converter?](https://www.opendesign.com/node/3218) (search snippet)
- The NixOS package marks it as unfree. — [mynixos odafileconverter](https://mynixos.com/nixpkgs/package/odafileconverter)

**Aspose.CAD (commercial fallback)**
- Aspose.CAD for Python via .NET handles DWG/DXF/DGN/IFC. Prices for v25.12:
  - Developer Small Business perpetual licence: about US$783, including 1 year of maintenance.
  - Site Small Business (10 developers, 10 locations): US$3,915.
  - Prices are from the authorised reseller ComponentSource, not Aspose directly.
  — [ComponentSource Aspose.CAD for Python prices](https://www.componentsource.com/product/aspose-cad-for-python-via-net/prices)

### Inferences
- **Recommended primary reader: acad-ts (MIT)**. It read AC1024 cleanly, exposes dynamic-block XDATA, and its MIT licence avoids GPL obligations if the code ships inside a product.
- **Use libredwg-web (GPL-3.0) as an independent second reader** for cross-checking. Two independent parsers agreeing on counts is strong audit evidence. GPL is fine for internal tooling that is not distributed.
- **If the team wants ezdxf**, convert DWG → DXF with LibreDWG `dwg2dxf` (built from source; no apt needed beyond the build tools, or use a GitHub nightly tarball) or with acad-ts DxfWriter. Then run ezdxf on the DXF. Check that the conversion round-trips by comparing INSERT counts per block name against the direct DWG readers.
- Do not depend on the ODA File Converter for a commercial pipeline. It needs a download from opendesign.com (blocked here), Xvfb (an apt package), and its non-member terms are non-commercial only.

### Gaps
- I did not build LibreDWG from source in this session, so dwg2dxf/dwgread fidelity on this file (including XDATA preservation of AcDbBlockRepBTag in the DXF output) is untested.
- I did not confirm whether Ubuntu 24.04 apt has a `libredwg-tools` package or which version it would be.
- I could not read the ODA File Converter licence text itself; the opendesign.com host is blocked.
- I could not confirm whether the 0.14 stable release date is genuine.

## Q2. Known failure modes when counting from CAD entities

### Takeaway
On this file the real traps are not parser failures. They are:
- (a) the plan appears **more than once in model space** (sheet copies), so naive totals double-count;
- (b) most chairs are **exploded geometry or pasted anonymous `A$C…` blocks**, not cleanly named chair blocks;
- (c) dynamic blocks appear as `*U##` and must be resolved through AcDbBlockRepBTag XDATA;
- (d) paper-space entities (8 layouts) must be excluded;
- (e) units are inches and room labels are MTEXT with formatting codes.

There are no xrefs and no proxy-entity problem in this file.

### Cited Findings
- **Dynamic blocks.** Each configuration of a dynamic block that differs from its definition is stored as an anonymous `*U` block. The "EffectiveName" is the parent block-table-record name. — [Autodesk .NET forum: effective block of anonymous block](https://forums.autodesk.com/t5/net-forum/effective-block-of-anonymous-block/m-p/7916376/highlight/true)
- **How to recover the effective name.** The original dynamic block-record handle sits in the XDATA of the *U block record under app "AcDbBlockRepBTag" (this is undocumented). — [netDxf issue #324](https://github.com/haplokuon/netDxf/issues/324)
- **ezdxf helper for this.** `ezdxf.dynblkhelper.get_dynamic_block_definition(insert)`:
  - returns the block directly if its BLOCK_RECORD has XDATA `AcDbDynamicBlockGUID` (a dynamic definition);
  - otherwise it reads XDATA `AcDbBlockRepBTag` group code 1005 (the handle) and resolves the dynamic definition;
  - the helper is read-only.
  — [ezdxf 1.4.5 source, dynblkhelper.py](https://pypi.org/project/ezdxf/)
- [tested here] Effective names on the real file, resolved through acad-ts and AcDbBlockRepBTag:
  - Inserts `*U40`/`*U41`/`*U43`/`*U44`/`*U45` resolve to handle 0x65D, which is "DOOR_SNGL" (isDynamic true). Model space holds 59 such inserts.
  - `*U13` resolves to 0x50B, "25 Stall Partition" (10 inserts).
  - 15 inserts resolve to `A$Cbfba1e20`.
  - Other `*U1xx`/`*U2xx` blocks have no RepBTag; they are probably plain anonymous blocks.
  - So **none of the dynamic blocks are seats**: they are doors and partitions. There are 73 `*U` block records in total.
- **Nested blocks.** Counts must separate primary and nested blocks. Example: 10 WORKSTATION blocks that each contain 4 CHAIR blocks give 40 chairs. Hidden nested blocks are not counted by simple tools. — [draftsperson.net DeepCount LISP](https://blog.draftsperson.net/deepcount-lisp-routine/)
- **Reference counter caveat.** ezdxf's `BlockReferenceCounter` counts references across `doc.entitydb`. A reference inside a block definition counts once per definition, not once per placed instance, so it is not a seat counter. — [ezdxf 1.4.5 source, blkrefs.py](https://pypi.org/project/ezdxf/)
- [tested here] **Model space vs paper space.** libredwg-web's `db.entities` mixes model-space entities (owner handle "2" = *Model_Space, 5,035 entities) with paper-space entities (*Paper_Space…, 56–88 entities each). The `isInPaperSpace` flag was not set, so filtering must use `ownerBlockRecordSoftId`. acad-ts `doc.modelSpace.entities` returns 5,035 only. Layouts: "Model", "1. DIM LAY", "2. INT LAY" (and copies (2) and (3)), "3. FUR-DIM LAY", "4. FLR LAY", "5. RCP LAY", "6. WALL PANELLING DETAIL". 16 VIEWPORT entities.
- [tested here] **Multiple copies of the plan in model space.**
  - The 86 `WS-3'X2'` inserts (all on layer WS-FURN, all in model space) fall in two far-apart clusters: 40 near x≈0 and 46 near x≈6,000,000.
  - Every room-label MTEXT appears twice, for example "WORKSTATION - 48 NOS" at (2996356, −3363127) and (2996465, −3365649).
  - Entity x-coordinates bucket into about 3,011 entities near 0 and about 2,464 near 2–3 million.
  - Counting must therefore be clipped to one plan instance, by bounding box or by the viewport extents of one layout.
- [tested here] **Exploded furniture.** After recursively expanding inserts, layer WS-FURN holds 3,956 ARC, 3,505 LWPOLYLINE, 2,891 LINE and 314 CIRCLE primitives. Its furniture inserts are mostly pasted-block names: `A$C779abbf3` ×118 (each holds one LWPOLYLINE plus nested `A$C136922d8`), `A$Caa80c39f` ×16, `A$Cd484c6a2` ×12, `A$Cd18c31fc` ×11 and others.
  - The only meaningfully named seat-like blocks are `WS-3'X2'` (86), "5555 FT TABLE" (2) and "Staff Chair - Staff Chair_1-171-Level 1" (2).
  - Layer CP-INT-CHAIRS holds only 8 CIRCLEs.
  - `A$C…` names come from AutoCAD Paste-as-Block, so the block name carries no meaning; it has to be identified from its geometry or from a render.
- [tested here] **Other checks on this file:**
  - No xrefs: no BLOCK_RECORD has the xref flag (4).
  - Only 28 ATTRIBs, which belong to "DW" door/window tags (tag "SDS", text "W"). No seat attributes.
  - Only 8 closed LWPOLYLINEs exist, so rooms are **not** drawn as closed room polygons.
  - Units: INSUNITS = 1 (inches). The title-block note says "ALL THE DIMENSIONS ARE IN FEET INCHES".
- [tested here] **MTEXT formatting codes.** Room labels contain inline codes such as `\pi16.68094;06 SEATER \P\pi6.38149;MEETING ROOM` and `{\fArial|b1|i0|c0|p34;AUTOPILOT CABIN}`. They need stripping with ezdxf `MText.plain_text()` / `ezdxf.tools.text.plain_mtext()` (present in the 1.4.5 source), or with an equivalent regex. — [ezdxf 1.4.5 source, tools/text.py](https://pypi.org/project/ezdxf/)
- [tested here] **Label inconsistency to flag.** The legend reads "WORKSTATION - 48 NOS(4'0"X2'0")" (4 ft × 2 ft desks), but the named desk block is `WS-3'X2'`. Either the block name is stale, or the legend and the blocks disagree.

### Inferences
- A defensible count picks **one** plan instance in model space, preferably the one framed by the "3. FUR-DIM LAY" or "2. INT LAY" viewport. It then counts within that bounding box.
- The 40 and 46 split of `WS-3'X2'` suggests the two copies differ, for example an older and a newer revision, or one copy is incomplete. That has to be resolved before any seat claim.
- Because chairs are mostly exploded or pasted blocks, the most reliable "seat" primitive is probably the **desk unit** (the `WS-3'X2'` inserts plus desk-like `A$C` blocks) together with the **room-label seat legends**. Each workstation cluster should be reconciled against its label.

### Gaps
- I did not check whether `A$C779abbf3` (×118) is a chair, a desk or a light. That needs a render or a geometry inspection; its bounding-box size would tell.
- Proxy entities: none were reported by either parser. OLE2FRAME (6) and IMAGE (5) entities exist but do not matter for counting.

## Q3. Practical seat- and room-counting methods, open-source precedents, and auditable proof

### Takeaway
There is no maintained open-source "seat counter for DWG". Practice is a scripted version of what AutoCAD users do by hand:
1. count named block inserts (resolving *U and nested blocks) on furniture layers;
2. reconcile those counts with the seat legends written in room-label MTEXT;
3. assign each seat to a room by point-in-polygon or nearest label;
4. publish a numbered seat list with coordinates plus a rendered plan with each counted seat marked.

On this file the room labels already state their capacities. Their sum (see Inferences) is the first hypothesis to test against the geometry.

### Cited Findings
- **Block-name and layer filtering in practice.** A DXF classification case study kept blocks on a furniture layer as chairs and rejected blocks on a floor layer (door swings, human figures). It noted a custom Python DXF parser was viable but cost developer time. — [energent.ai case study](https://www.energent.ai/en/resources/customer-stories/transportation-dxf-classification) (vendor marketing; treat as anecdotal)
- **Open-source precedent.** scorphus/aptscan "automates chair type counting for each room in the floor plan", giving chairs per room and the total. I did not verify its input format or whether it reads DXF. — [GitHub scorphus/aptscan](https://github.com/scorphus/aptscan)
- **Nested counts in AutoCAD practice.** DeepCount and BlockTally LISP routines count nested blocks with multipliers. — [DeepCount](https://blog.draftsperson.net/deepcount-lisp-routine/); [BlockTally](https://blog.draftsperson.net/blocktally-lisp-routine/)
- **AutoCAD's own block-quantity analysis** is covered in Autodesk's certification course. — [Autodesk: Analyze quantities of blocks](https://www-pt.autodesk.com/learn/ondemand/course/autocad-design-drafting-cert-prep-2023/unit/723UfzFHykLJSnvM4eu1hs)
- **ezdxf primitives for a counter** (all present in the 1.4.5 source):
  - `msp.query('INSERT[layer=="WS-FURN"]')`
  - `Insert.virtual_entities()` / `explode()` for nested expansion with transforms; `Insert.matrix44()` for world coordinates
  - `get_attrib_text()` / `has_attrib()`
  - `dynblkhelper.get_dynamic_block_definition()`
  - `MText.plain_text()`
  — [PyPI ezdxf](https://pypi.org/project/ezdxf/)
- [tested here] **Seat legends in the real file**, read from MTEXT after stripping codes. Each appears twice, once per plan copy:
  - "ENGINEERING 15 PAX+1VP"
  - "FINANCE ROOM 7 SEATES WS"
  - "WORKSTATION - 48 NOS(4'0"X2'0")"
  - "STAFF ROOM 4 SEATER WS"
  - "CONTROL ROOM/COMMAND CENTER 12 NOS"
  - "SALES OFFICE 33 NOS"
  - "CALLING ROOM 09 SEATER WS"
  - "DIRECTOR CABIN-01" and "DIRECTOR CABIN-02", "AUTOPILOT CABIN"
  - "04 SEATER MEETING ROOM_01", "04 SEATER MEETING ROOM_03", "06 SEATER MEETING ROOM" (×2 labels per copy)
  - "18 SEATER CONFERENCE ROOM", "CAFE 12 PAX"
  - Service rooms: GENTS/LADIES/EXECUTIVE WASHROOM, SERVER ROOM, UPS BATTERY ROOM

### Inferences
- **Legend arithmetic (hypothesis only, not proof).** Workstation-type labels sum to 16 (15+1 VP) + 7 + 48 + 4 + 12 + 33 + 9 = **129**, before cabins (2 directors + 1 Autopilot). That total holds only if "WORKSTATION - 48 NOS" does not already include the Engineering or Sales seats. Collaborative seats (meeting rooms 4+4+6+6, conference 18, cafe 12) are usually excluded from a "seat" count. The 100-seat claim should be tested against workstation and cabin seats, and the definition of "seat" must be stated explicitly.
- **Proposed auditable pipeline:**
  1. Read the DWG with acad-ts, cross-checked with libredwg-web.
  2. Restrict to model space and to one plan instance's bounding box.
  3. Expand inserts recursively with world transforms, resolving *U to effective names.
  4. Classify candidate seat blocks by name, layer and bounding-box size (a chair is about 18–24 in; a desk is 36×24 or 48×24 in).
  5. Clean the MTEXT and attach each seat to the nearest room label. Rooms are not closed polylines here, so a room-assignment fallback is nearest label within a wall-bounded region, or polygonising WS-WALL/WS-WALL-PRTN lines with shapely `polygonize`.
  6. Emit a CSV (seat_id, block/effective name, layer, x, y in inches and metres, rotation, room, source handle). The DWG handle lets anyone re-find the entity in AutoCAD.
  7. Emit an SVG/PNG of that plan with each counted seat numbered.
  8. Report per-room counts against the legend numbers, with discrepancies listed.
- The DWG **handle** per seat is the strongest audit key: a reviewer can type it into AutoCAD (or `dwgread`/JSON) to locate the exact entity.

### Gaps
- I found no maintained open-source DXF/DWG furniture-count or space-programming tool with documented DWG support. Only small LISP routines and the unverified aptscan.
- I could not fetch the ezdxf docs "query" or "blocks" tutorial pages (host blocked). The method names above come from the source code.

## Q4. Headless rendering for a visual check

### Takeaway
Rendering options:
- **Best for Python:** the ezdxf drawing add-on (matplotlib, SVG or PyMuPDF backends, plus the `ezdxf draw` CLI) on a DXF.
- **Pure Node:** acad-ts `SvgWriter`, run directly on the DWG document. Overlay the seat numbers onto the SVG.
- **Weakest:** LibreDWG `dwg2SVG`, which handles only some entities.
- **Browser viewers:** libredwg-web and @cadview, which need a canvas or browser such as headless Chromium.

### Cited Findings
- The ezdxf 1.4.5 drawing add-on contains frontend.py and backends in matplotlib.py, svg.py, pymupdf.py and pyqt.py, plus a `draw` CLI command (`ezdxf draw`). — [ezdxf 1.4.5 source, addons/drawing](https://pypi.org/project/ezdxf/)
- acad-ts has a writer, used as `new SvgWriter(output, doc).write()`. — [npm @node-projects/acad-ts](https://www.npmjs.com/package/@node-projects/acad-ts)
- LibreDWG dwg2SVG "Handles only some entities", and dwg2ps is "very limited". — [GitHub LibreDWG/libredwg](https://github.com/LibreDWG/libredwg)
- @cadview/dwg and @mlightcad cad-viewer are browser canvas viewers; a live libredwg-web demo exists. — [npm @cadview/dwg](https://www.npmjs.com/package/@cadview/dwg); [libredwg-web demo](https://mlightcad.github.io/libredwg-web/)
- [tested here] libredwg-web returned a `thumbnailImage` field, the DWG's embedded preview (also extractable with LibreDWG `dwgbmp`). It is useful only as a low-resolution sanity check.

### Inferences
- **Lowest-friction proof render:** compute seat positions in Node (acad-ts), then draw the plan's model-space entities clipped to one plan instance into SVG, either with acad-ts SvgWriter or a custom SVG emitter from LINE, ARC, LWPOLYLINE and expanded INSERT geometry. Add numbered circles at each seat and rasterise with a pure-npm tool if a PNG is needed.
- **Python route:** convert to DXF, then use ezdxf `Frontend` with the matplotlib backend under the non-GPU `Agg` backend. Add seat markers to the same axes and save as PNG/SVG.

### Gaps
- I did not test the quality of acad-ts SvgWriter output on this file (hatches, MTEXT, 3DFACE).
- I did not test the ezdxf render of a LibreDWG-converted DXF.
