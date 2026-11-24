# Current client MVP

The primary client journey starts in the existing 2D CAD plan. Clicking a room opens large relevant source images. Open an image to inspect it, select it, and press **Submit choice**. Repeat for another room, then use **Preview selected rooms** to see submitted choices together. The preview reads persisted owned sessions; it is not an email flow.

Source, offering, measured room context and provenance remain available. With no room offering set, supplied offerings can be browsed together. Once an offering is set, other offerings appear only through explicit inspiration browsing; choosing one requires an explicit offering change. Missing references remain empty. Phone Booth 04 has zero matching supplied images.

Verified in Chrome: 723 Avenue 14th floor reception → enlarge Altruist source → select → submit; meeting room → Safegold source → submit; summary reload retained both choices. API tests cover owned summaries and explicit tier-change enforcement. Elevation presentation and email configuration are deferred.

Local review: `http://localhost:8096/engine/cad.html?property=723-avenue&variant=723-284&drawing=1&mvp=1`.

## Source coverage

There are three PowerPoint files and one ZIP, not PDFs. All 198 image records were inventoried (196 distinct hashes). Reception has 12 views: four Foundever, four Lexvia.ai, four Altruist. Safegold has no reception classified among its readable images; unsupported originals remain unresolved. Prior tier filtering hid the Premium sources when Premium Economy was selected. Full per-source category counts are generated in `.atlas-design/library/classification-summary.json`.

## Activation limits

This is running on the local durable store. The configured Supabase project is reachable by service credentials, but the signed-in dashboard account cannot access its SQL editor. Prepared migration has not been applied and no cloud images or sessions have been uploaded. Higgsfield is implemented behind server credentials and explicit paid authorization; no live paid calls have been made. Nothing has been deployed or emailed.

## Internal implementation notes (earlier render workflow)

# Andheri Atlas design MVP

The MVP runs inside the existing **Flipkart Andheri Atlas**, using its shortlist, CAD drawings, 3D fit-outs and source room identities. It is not a separate property demo.

## Review and run

```sh
npm run design:mvp
```

Open **http://localhost:8096/flipkart-andheri/world?mvp=1&map=0#privilon**.

1. Enter the existing experience, skip or watch its film, then select a shortlisted building.
2. Choose **Design this workspace** to open that selected configuration directly, or **Explore floor plans** to inspect the drawing first.
3. In CAD, select a meeting room or choose **Inventory → Reception Waiting Area**, then **Design this room in 3D**.
4. The same source room opens in the 3D gallery. Inspect seats/verified square feet, choose Option 1/2 and an exact supplied offering, then select references and specific borrowed features. Likes/dislikes, reasons, comments and stages are saved per option.
5. **Render design** saves that exact revision and queues a native Blender concept. View it under **Results & revisions**, use it as a revision parent, or download a readable designer handoff.
6. **Designer tools** opens `/engine/design-review.html` for source review, client sessions, handoffs and result acceptance/rejection.

The `mvp=1` entry is an explicit **loopback-only** local preview. The backend refuses it on Vercel. Production clients need existing project-issued Atlas access; the legacy frontend gate alone does not authorize private records. Existing site navigation, source drawings and other Atlas projects remain intact.

The launcher starts the site and a separate native worker, preserving private state under `.atlas-design/`. It reuses the existing CMS store in local JSON mode, generates a persistent local signing secret, ingests the actual source files, merges classification by source/image IDs, and restores prior human review decisions. It deliberately avoids silently connecting local preview writes to production Supabase. `PORT=... npm run design:mvp` selects another free port.

## Catalog coverage and provenance

Actual supplied offering folders: **Premium Economy** and **Premium**. No Economy offering was invented.

Three PowerPoint decks and one ZIP contain **198 image records / 196 distinct binary hashes** and **106 slides**:

| Category | Image records |
| --- | ---: |
| Reception | 12 |
| Meeting room | 13 |
| Boardroom | 6 |
| Training room | 3 |
| Interview room | 1 |
| Workstations | 14 |
| Private cabin | 4 |
| Cafeteria | 11 |
| Indoor focus/breakout/collaboration + outdoor lounge | 5 |
| Washroom | 5 |
| Wellness / lockers / lactation | 2 each |
| Non-room assets: plans, branding, graphics, people, moodboards, mixed diagrams, exterior | 93 |
| Unresolved or ambiguous originals | 25 |

There are **80 room-reference records**. Counts include source exports/crops and are not a claim of 80 unique completed designs. Of the unresolved originals, 17 are unrendered SVGs, 6 are unsupported WDP alternates, and 2 are blank/ambiguous assets. Their originals and provenance remain retained; none is forced into a room category.

Support detail is deliberately more specific than a generic support-space bucket: 12 reception views include 10 visible/likely waiting-area settings, 4 visually inferred lobby contexts and 1 possible glazed entrance threshold. These secondary labels overlap; they are not independent confirmed rooms. Formal waiting/lobby function and primary-entrance identity remain qualified where the source does not establish them.

Private generated artifacts:

- `.atlas-design/library/manifest.json`: originals, hashes, slide/image relationships and embedded text.
- `.atlas-design/library/records/<image-id>.json`: one structured record per image.
- `.atlas-design/library/categories/*.json`: segregated categories plus nonexclusive waiting/lobby/entrance detail indexes.
- `.atlas-design/library/classification-summary.json`: current counts and limitations.
- `.atlas-design/library/classified-index.json`: complete source-linked catalog.
- `.atlas-design/index.json`: active catalog plus preserved human review decisions.

Each record separates source-container/project/client context, room facts supported by captions, visible interpretations, palette, material appearance, furniture, lighting, confidence and unknowns. Source deck context is not an assertion that every depicted image is an as-built photograph of that property. Pixel dimensions are explicitly image dimensions, never physical room measurements.

PowerPoint XML text is read before OCR. OCR has not been run by default. Source captions remain evidence and are not automatically applied to repeated logos or diagrams. Original files are never overwritten. New/changed source IDs that lack matching visual research remain unknown, avoiding positional reassignment of another room/client’s description.

Visual classification is an assistant source/appearance review. **No human approval or designer validation was recorded automatically.** The review UI requires reviewer name, source/permission confirmation and evidence note. Shared-library promotion is never automatic; current grants are project-scoped.

## Native render behavior

The worker imports the **exact registered web GLB** whose SHA-256 is frozen in the job, with the same selected room/source hash and saved browser camera, aspect, up vector, clipping and ceiling/cutaway state. It reverses the documented web/Blender coordinate transform. It does not call the old proof renderer, which scaled vertical geometry for cutaways.

For this MVP, selected palette features blend into a proposed display swatch on existing room-finish faces fully contained in the verified CAD enclosure. Source material appearance, furniture and lighting requests remain explicitly recorded suggestions unless implemented. No counters, chairs, walls, openings, surrounding buildings or new room geometry are invented by the native worker. Unknown or unverified enclosures cannot be rendered through this finish-edit path.

The worker fingerprints every mesh’s vertices, topology and object transform before/after material changes. A mismatch rejects the job. Outputs retain image/scene/source hashes, camera, geometry checks, applied finish-face count, unapplied features and assumptions. Native results require designer review. Current source XY is CAD-derived; heights, ceilings, furniture heights, finishes and rectangular presentation supports retain their existing proposed/unverified status. An unchanged scene is not as-built certification.

Actual local proof: a Privilon 4-seat / 77 sq ft meeting-room job completed with **22 meshes unchanged** and **184 finish faces** recolored. Its native image and metadata are in `.atlas-design/renders/6067a321-09c0-4716-8c31-2d1d5696c166/`. The result remains awaiting human designer review.

Support-space selection now includes the actual CAD `others` records, not only the primary meeting/workstation zones. Privilon’s **Reception Waiting Area** has a verified **180 sq ft** enclosure and unspecified seats. CAD inventory display IDs are resolved back to the actual source handle/room ID before entering 3D.

## Higgsfield integration

**Higgsfield is the selected AI provider.** The verified [Kling Image 4.0 Image Edit API](https://open.higgsfield.ai/models/kling-image/v4.0/edit/api-reference) supports one output from 1–10 images. The integration supplies the native render first, followed by up to nine authorized original inspiration images and their selected-feature brief. Inputs must meet the documented JPG/PNG, size and pixel-aspect limits. The model’s documented default 2K list price is $0.063 per image; actual provider billing applies.

The server/worker uses signed Higgsfield uploads, retains the request ID/status URL, sends an idempotency key, polls with backoff and copies finished media into private persistent storage. API credentials are never sent to upload destinations, browser code, chat or logs. Existing case-study illustration generation remains separate and unchanged.

Create `.env.design.local` locally (git-ignored), or set the corresponding server/worker environment variables:

```dotenv
HIGGSFIELD_API_KEY=<complete copied credential from open.higgsfield.ai/api-keys>
# Enable only when paid use is authorized; the UI still requires one-image consent.
ATLAS_DESIGN_ALLOW_PAID_ENHANCEMENT=0
```

Keep the credential server-side; do not paste it into chat. Restart the MVP after configuring it. To run an authorized visualization, the operator enables paid use, then the user explicitly authorizes **one** billable image and transfer of the selected images in the gallery. Native rendering needs no Higgsfield key.

Higgsfield output is stored as **AI visualization, geometry unverified**, separately from native proof. The gallery and designer tools compare native/AI images. Reviewers can reject inconsistent room types, shell/openings/camera or invented surroundings; keeping an AI image as inspiration never changes its geometry flag or makes it a geometry-validated design. Native result acceptance and AI inspiration acceptance have different checklists. A designer-validated session requires a matching accepted native result, not an AI image.

No live paid generation has been submitted. Higgsfield account/model access remains unverified because no credential is configured. Adapter submission, upload, polling/cancel and result-separation checks use mocked HTTP; these are not represented as a successful live provider run.

## Supabase: current state and activation

Existing `.env` server credentials were discovered without displaying values. A read-only authenticated request to the existing `atlas_links` table succeeded (**HTTP 200**). The new design tables returned **HTTP 404**. Thus connectivity works, but design cloud persistence is **not yet activated**. No private reference upload or cloud client-session write has been performed. The dashboard currently requires sign-in, and no management token or direct SQL credential is present.

Prepare/check:

```sh
npm run design:setup
```

The script creates `.atlas-design/supabase-setup.sql` from migrations **019 + 020**, without applying remote changes. Run that prepared file in the existing Supabase project’s SQL Editor. It creates server-only reference/event/job/worker tables, RLS, a private `atlas-design-private` bucket and an atomic worker-claim RPC using leases and `SKIP LOCKED`.

After the schema is applied, explicitly import all image originals and metadata privately:

```sh
node tools/design/publish.cjs .atlas-design/library/classified-index.json --apply
node tools/design/start.cjs --supabase
```

The importer verifies hashes and private-bucket configuration, retains pending/human-review states and upserts all 198 catalog records. It is resumable and uses content-hash object paths. Original proposal containers remain preserved locally; the importer copies their embedded image originals and source provenance, not the large PPTX/ZIP containers. Source containers can be archived separately after cloud large-file/storage limits are configured. No anonymous storage policies are added.

For Vercel, configure existing Supabase URL/service-role key and a strong `CMS_SESSION_SECRET` only on the server. Run the dedicated worker on a separate trusted host with the same registered model assets, source hashes and Supabase environment. Do not run Blender inside the Vercel request. The API uses the compact server-owned `api/design/_scenes.json` registry (about 291 KB), rather than bundling the 122 MB model set or full CAD payload. `node tools/design/build-registry.cjs` regenerates it from actual source/model files; the launcher does this before starting. The worker verifies both model and source-metadata hashes against its own files before rendering. The API includes registered hashes and submits jobs; worker leases, heartbeats, idempotent submissions and immutable specifications preserve ownership and lineage.

No frontend deployment was performed. Local state remains private under `.atlas-design/`, blocked by the development server and excluded from Vercel. The offering originals and internal tooling are also excluded from static deployment.

## Persistence and review

Project access and credential revocation are rechecked on every protected request. Client records are owner/project-scoped; authorized editors can inspect project sessions explicitly. Writes require a custom CSRF header. Immutable session events carry parent event/revision, source room, references, selected features, likes/dislikes, reasons, comments, stage, full camera and source-reference snapshots. Thus a later library edit cannot silently rewrite prior decisions.

Native/AI jobs freeze the saved event, scene, references and parent result. Native jobs have exclusive claims, leases, retry limits and private artifacts. Session restore works across refresh and server restart; browser storage holds opaque session IDs only. Device-independent restore can query owned room sessions. Readable HTML handoffs include current choices, provenance, measured/unknown room facts, render statuses, feedback and complete revision history.

Retrieval filters permission, room and supplied offering **before** deterministic lexical ranking. No vector/embedding connection or semantic-score claim is invented. The structured source/room/project/reference/event/job relationships are ready for a later filtered vector index.

## Validation

```sh
npm run test:design
```

Focused checks cover ingestion, source-version-safe classification, CAD metrics/source validation, scoped retrieval, owner isolation/revocation, CSRF, immutable revision conflicts, exclusive job claims, idempotency, native/AI review separation, safe HTML handoff, source-review gates, paid-use guards and Higgsfield request contracts. Browser checks exercise the actual Andheri world → CAD → room → gallery journey, save/restore, native rendering/results and the designer queue. Earlier existing regressions passed 79 CMS checks and 14 case-illustration checks.
