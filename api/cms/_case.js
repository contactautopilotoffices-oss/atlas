/* ============================================================================
   ATLAS CMS · case study routes

   Registered into the one API handler by index.js. A case study is made the
   way an atlas is: upload the workbook, read the report, save the draft,
   generate the pictures, let the helper draft the prose, preview, publish.
   Each publish is a numbered version the team sees; the reader sees only
   what is live, at /<link id>/case, behind the same access ID as the atlas
   of that id.

     GET  case/template (editor)       the empty workbook
     POST case/import (editor)         a filled workbook -> bundle + report
     POST case/draft (editor)          save a bundle as a link's draft
     POST case/image (editor)          make one slot's picture with Higgsfield
                                       and write its address into the draft
     POST case/assist (editor)         the helper: means, read, risks,
                                       prompts, check, research
     POST case/apply (editor)          fold accepted suggestions into the draft
     POST case/publish (admin)         draft -> live, kept as a version
     GET  case/history&link=           every publish
     POST case/rollback (admin)        make an earlier version live again
     GET  case/status&link=
     GET  case&link=[&draft=1]         the bundle the page draws
   ============================================================================ */
"use strict";
const store = require("./_store");
const auth = require("./_auth");
const { buildCaseTemplate, readCaseWorkbook } = require("../../scripts/lib/case-workbook");
const { validate } = require("../../scripts/lib/validate-case");
const { SLOTS } = require("../../scripts/lib/case-schema");
const images = require("./_images");
const assist = require("./_assist");
const llm = require("./_llm");

const MAX = 4 * 1024 * 1024;

function register(R, h) {
  const { needUser, needLink, fail, clip, audit, SLUG, RESERVED } = h;
  const caseUrl = (slug) => `/${slug}/case`;
  const reportOf = (rep) => ({ ok: rep.ok, errors: rep.errors, warnings: rep.warnings, stats: rep.stats });

  async function caseRow(slug) {
    let row = await store.one("atlas_cases", { eq: { link_slug: slug } });
    if (!row) [row] = await store.upsert("atlas_cases", { link_slug: slug, draft: null, published: null, version: 0 }, "link_slug");
    return row;
  }
  function clean(b) {
    if (!b || typeof b !== "object" || Array.isArray(b)) fail(400, "The case bundle must be an object.");
    const s = JSON.stringify(b);
    if (s.length > MAX) fail(413, "The case study is too large (over 4 MB).");
    return JSON.parse(s);
  }
  async function linkFor(u, slug) {
    needLink(u, slug);
    const link = await store.one("atlas_links", { eq: { slug } });
    if (!link || (link.kind !== "bundle" && link.kind !== "case")) fail(404, "That link has no case study.");
    return link;
  }
  async function saveDraft(u, slug, bundle, why, extra) {
    await caseRow(slug);
    const [saved] = await store.update("atlas_cases", { eq: { link_slug: slug } }, { draft: bundle, draft_updated_at: store.now(), draft_updated_by: u.email });
    await audit(u, why, slug, extra || {});
    return saved;
  }

  R["GET case/template"] = async (req, res) => {
    await needUser(req, "editor");
    const buf = Buffer.from(await buildCaseTemplate().xlsx.writeBuffer());
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="case-study-workbook.xlsx"');
    res.setHeader("Cache-Control", "no-store");
    res.end(buf);
    return { __sent: true };
  };

  R["POST case/import"] = async (req, res, b) => {
    await needUser(req, "editor");
    if (!b.file || typeof b.file !== "string") fail(400, "Send the workbook as a base64 string in `file`.");
    let buf;
    try { buf = Buffer.from(b.file.replace(/^data:[^,]*,/, ""), "base64"); } catch (e) { fail(400, "The file could not be read."); }
    if (!buf.length) fail(400, "The file is empty.");
    if (buf.length > MAX) fail(413, "The workbook is too large (over 4 MB).");
    let out;
    try { out = await readCaseWorkbook(buf); }
    catch (e) { fail(400, `That does not look like a case study workbook: ${clip(e.message, 200)}. Download the template from this page and fill that in.`); }
    return { bundle: out.bundle, notes: out.notes, report: reportOf(validate(out.bundle)) };
  };

  R["POST case/draft"] = async (req, res, b) => {
    const u = await needUser(req, "editor");
    const slug = clip(b.slug, 40).trim().toLowerCase();
    if (!SLUG.test(slug)) fail(400, "Use lower-case letters, numbers and hyphens for the link id.");
    if (RESERVED.has(slug)) fail(400, `"${slug}" is already a page on this site. Pick another link id.`);
    const existing = await store.one("atlas_links", { eq: { slug } });
    if (existing && existing.kind !== "bundle" && existing.kind !== "case") fail(400, `"${slug}" is already a ${existing.kind} link. Pick another id.`);
    if (existing) needLink(u, slug);
    const bundle = clean(b.bundle);
    const rep = validate(bundle);
    if (!rep.ok) fail(400, `The case study has ${rep.errors.length} problem${rep.errors.length === 1 ? "" : "s"} that stop it being drawn. Fix them in the workbook and upload it again.`);
    const name = clip(b.name, 120).trim() || (existing && existing.name) || (bundle.meta && bundle.meta.title) || slug;
    const city = clip(b.city, 60).trim() || (bundle.meta && bundle.meta.city) || (existing && existing.city) || null;
    /* A link that already exists (the atlas of this id) keeps its name and
       city; those are edited where the atlas is. */
    const row = existing
      ? { slug, updated_at: store.now() }
      : { slug, name, kind: "case", path: caseUrl(slug), city, access_id: null, notes: null, updated_at: store.now() };
    await store.upsert("atlas_links", row, "slug");
    if (h.overridesRow) await h.overridesRow(slug);
    const saved = await saveDraft(u, slug, bundle, "case.draft", { options: (bundle.options || []).length, warnings: rep.warnings.length });
    return { slug, name: existing ? existing.name : name, version: saved ? saved.version : 0, report: reportOf(rep), created: !existing, url: caseUrl(slug) };
  };

  /* One slot's picture. The prompt is the draft's, unless a new one is
     sent, which is then kept on the draft too. */
  R["POST case/image"] = async (req, res, b) => {
    const u = await needUser(req, "editor");
    const slug = clip(b.slug, 40);
    await linkFor(u, slug);
    const slot = clip(b.slot, 20);
    if (!SLOTS.includes(slot)) fail(400, `"${slot}" is not a picture slot. Use ${SLOTS.join(", ")}.`);
    const row = await caseRow(slug);
    if (!row.draft) fail(400, "There is no draft yet. Upload a workbook first.");
    const draft = row.draft;
    draft.images = draft.images || {};
    const words = clip(b.prompt, 600).trim() || (draft.images[slot] && draft.images[slot].prompt) || "";
    if (!words) fail(400, "Give this slot a prompt: a sentence saying what the picture should show.");
    if (!images.ready()) fail(503, "Generating pictures needs HIGGSFIELD_API_KEY_ID and HIGGSFIELD_API_KEY_SECRET set in Vercel. Until then, paste an image address on the Images sheet.");
    const prompt = images.promptFor(slot, words, draft.meta);
    const g = await images.generate(prompt, { idempotencyKey: `${slug}-${slot}-${Date.now().toString(36)}` });
    const kept = await images.keep(g.url, slug, slot);
    draft.images[slot] = { ...(draft.images[slot] || {}), prompt: words, url: kept.url, caption: (draft.images[slot] && draft.images[slot].caption) || "AI-generated illustration (Higgsfield)" };
    await saveDraft(u, slug, draft, "case.image", { slot, requestId: g.requestId, bytes: kept.bytes });
    return { slot, url: kept.url, prompt, requestId: g.requestId };
  };

  R["POST case/assist"] = async (req, res, b) => {
    const u = await needUser(req, "editor");
    const slug = clip(b.slug, 40);
    await linkFor(u, slug);
    const task = clip(b.task, 20);
    if (!assist.TASKS.includes(task)) fail(400, `Unknown task "${task}". Use ${assist.TASKS.join(", ")}.`);
    const row = await caseRow(slug);
    if (!row.draft) fail(400, "There is no draft yet. Upload a workbook first.");
    if (task === "research") { if (!process.env.EXA_API_KEY) fail(503, "Research needs EXA_API_KEY set in Vercel."); if (!llm.ready()) fail(503, "Research needs ENGY_API_KEY or ANTHROPIC_API_KEY set in Vercel as well."); }
    else if (!llm.ready()) fail(503, "The helper needs ENGY_API_KEY or ANTHROPIC_API_KEY set in Vercel.");
    try {
      const out = await assist.run(task, row.draft, { key: clip(b.key, 30) });
      await audit(u, "case.assist", slug, { task, model: out.model || null });
      return out;
    } catch (e) { if (e.status) fail(e.status, e.message); fail(502, `The helper could not finish: ${clip(e.message, 300)}`); }
  };

  /* Accepted suggestions, folded into the draft and re-checked. */
  R["POST case/apply"] = async (req, res, b) => {
    const u = await needUser(req, "editor");
    const slug = clip(b.slug, 40);
    await linkFor(u, slug);
    const row = await caseRow(slug);
    if (!row.draft) fail(400, "There is no draft yet.");
    const next = assist.apply(row.draft, clean(b.suggestions || {}));
    const rep = validate(next);
    if (!rep.ok) fail(400, `Adding that would break the case study: ${rep.errors[0].where}: ${rep.errors[0].message}`);
    await saveDraft(u, slug, next, "case.apply", { keys: Object.keys(b.suggestions || {}) });
    return { ok: true, report: reportOf(rep) };
  };

  R["POST case/publish"] = async (req, res, b) => {
    const u = await needUser(req, "admin");
    const slug = clip(b.slug, 40);
    await linkFor(u, slug);
    const row = await caseRow(slug);
    if (!row.draft) fail(400, "There is no draft to publish. Upload a workbook first.");
    const rep = validate(row.draft);
    if (!rep.ok) fail(400, "The draft no longer passes its checks. Upload the workbook again.");
    const version = (row.version || 0) + 1;
    await store.update("atlas_cases", { eq: { link_slug: slug } }, { published: row.draft, published_at: store.now(), published_by: u.email, version });
    await store.insert("atlas_case_history", { link_slug: slug, version, bundle: row.draft, action: "publish", by_email: u.email, note: clip(b.note, 300) || null, at: store.now() });
    await audit(u, "case.publish", slug, { version, note: clip(b.note, 300) });
    return { slug, version, url: caseUrl(slug) };
  };

  R["GET case/history"] = async (req, res, b, q) => {
    const u = await needUser(req, "viewer");
    const slug = clip(q.get("link"), 40);
    needLink(u, slug);
    const row = await store.one("atlas_cases", { eq: { link_slug: slug } });
    const history = await store.select("atlas_case_history", { eq: { link_slug: slug }, order: "at.desc", limit: 50, select: "id,version,action,by_email,note,at" });
    return { live: row ? row.version : 0, history };
  };

  R["POST case/rollback"] = async (req, res, b) => {
    const u = await needUser(req, "admin");
    const slug = clip(b.slug, 40);
    await linkFor(u, slug);
    const hrow = await store.one("atlas_case_history", { eq: { id: clip(b.historyId, 60), link_slug: slug } });
    if (!hrow) fail(404, "That version was not found.");
    const row = await caseRow(slug);
    const version = (row.version || 0) + 1;
    await store.update("atlas_cases", { eq: { link_slug: slug } }, { published: hrow.bundle, draft: hrow.bundle, published_at: store.now(), published_by: u.email, version, draft_updated_at: store.now(), draft_updated_by: u.email });
    await store.insert("atlas_case_history", { link_slug: slug, version, bundle: hrow.bundle, action: "rollback", by_email: u.email, note: `Back to version ${hrow.version}`, at: store.now() });
    await audit(u, "case.rollback", slug, { to: hrow.version, version });
    return { slug, version };
  };

  R["GET case/status"] = async (req, res, b, q) => {
    const u = await needUser(req, "viewer");
    const slug = clip(q.get("link"), 40);
    const link = await linkFor(u, slug);
    const row = await store.one("atlas_cases", { eq: { link_slug: slug } });
    const d = row && row.draft, pub = row && row.published;
    return {
      slug, name: link.name, city: link.city, status: link.status, access_id: link.access_id, kind: link.kind, url: caseUrl(slug),
      draft: !!d, draft_updated_at: row ? row.draft_updated_at : null, draft_updated_by: row ? row.draft_updated_by : null,
      draftReport: d ? reportOf(validate(d)) : null, draftTitle: d && d.meta ? d.meta.title : null,
      images: d ? Object.fromEntries(SLOTS.map(s => [s, (d.images || {})[s] || {}])) : {},
      copyKeys: d ? Object.keys(d.copy || {}) : [],
      published: !!pub, version: row ? row.version : 0, published_at: row ? row.published_at : null, published_by: row ? row.published_by : null,
      unpublished: !!(d && (!pub || JSON.stringify(d) !== JSON.stringify(pub))),
      can: { images: images.ready(), helper: llm.ready(), research: !!process.env.EXA_API_KEY && llm.ready() },
    };
  };

  /* What the page draws. Live needs the visitor's access cookie for this
     link, or a signed-in admin; the draft needs an admin. */
  R["GET case"] = async (req, res, b, q) => {
    const slug = clip(q.get("link"), 40);
    if (!SLUG.test(slug)) fail(400, "Unknown case study.");
    const wantDraft = q.get("draft") === "1";
    const link = await store.one("atlas_links", { eq: { slug } });
    if (!link || (link.kind !== "bundle" && link.kind !== "case")) fail(404, "Unknown case study.");
    const row = await store.one("atlas_cases", { eq: { link_slug: slug } });
    if (wantDraft) {
      const u = await auth.currentUser(req);
      if (!u || !auth.canLink(u, slug)) fail(401, "Sign in to /admin/ to preview a draft.");
      if (!row || !row.draft) fail(404, "There is no draft yet.");
      return { slug, name: link.name, draft: true, version: row.version, bundle: row.draft };
    }
    const a = auth.accessOf(req);
    const u = a && a.slug === slug ? null : await auth.currentUser(req);
    if (!(a && a.slug === slug) && !(u && auth.canLink(u, slug))) fail(401, "Sign in with your access ID.");
    if (link.status === "paused") return { slug, name: link.name, paused: true };
    if (!row || !row.published) fail(404, "This case study has not been published yet.");
    return { slug, name: link.name, version: row.version, bundle: row.published, accessId: a ? a.aid : null };
  };
}

module.exports = { register };
