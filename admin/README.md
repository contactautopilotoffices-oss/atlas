# ATLAS Admin (CMS)

One place to run every Atlas link: see who is using them, change what they
show, and collect updates from brokers.

- **Admin panel:** `/admin/`
- **Broker portal:** `/broker/` (opened from a private link, never directly)

## What it does

| Area | What you can do |
| --- | --- |
| Dashboard | Visitors, sessions, sign-ins, average time, who is on a link right now, which access IDs signed in, which properties and sections people opened, country, city, device, where they came from. Last 7, 30 or 90 days, per link or all. |
| Atlas links | Every link shipped so far, live or paused, with its published version and 30-day visitors. Pause a link and it shows a "paused" screen instead of its data. |
| Content editor | Per link: change any data field on a property, hide a property, edit the facts and source links on a property card, add "Latest from the market" values (asking rent, availability and so on), switch tabs, filters, map layers, presets and toolbar buttons on or off, set the 3D model for a building, edit the study's facts and sources, add a notice banner, change map texts, add new properties (Chennai). Everything is saved as a draft, can be previewed, and goes live only when you publish. Every publish is kept and you can go back to any version. |
| Broker links | A private link per broker, limited to the links (and optionally the properties) you choose. Send it on WhatsApp or email. Switch it off or replace it at any time. |
| Inbox | What brokers sent. Correct a value if needed, then approve it into the draft or reject it. |
| Team | Add people with a role: viewer, editor, admin, owner. Limit someone to certain links. |
| Audit log | Who did what, and when. |

Brokers see the city and the property names they were given, never the
client's name, analytics, other brokers or anything unpublished.

## Setting it up (once)

1. **Run the database migration.** In Supabase, open the SQL editor and run
   `supabase/migrations/013_cms.sql`. It creates the tables, a storage bucket
   called `atlas-cms` for 3D models, and registers the ten links shipped so far.
   All tables have row level security on with no public policies, so only the
   server can read or write them.
2. **Add these environment variables in Vercel** (Project, Settings,
   Environment Variables), then redeploy:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | Already set for God's Eye. |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase, Project Settings, API, `service_role` key. Server only: never put it in a page. |
   | `CMS_SESSION_SECRET` | Any long random string, for example the output of `openssl rand -base64 48`. Changing it signs everyone out. |
   | `CMS_SETUP_KEY` | A one-off key you choose. It is needed only to create the first owner. |

3. **Create the first owner.** Open `/admin/`. While there are no users it
   asks for the setup key, your name, email and a password. After that the
   setup screen is gone for good; add everyone else from Team.

Visits are recorded from the moment the migration runs. Before that the links
work exactly as before and simply do not report visits.

## How a link uses it

Every Atlas link loads `/atlas-cms.js`. On start it asks
`/api/cms/config?link=<id>` for the published changes (waiting at most 1.8
seconds, then using its last copy, then its built-in data), applies them to
its own data, and only then starts. A problem with the CMS can only ever mean
"show the built-in data", never a broken page. Published changes reach
visitors within about two minutes.

Visits are sent to `/api/cms/track`: a random browser id, a random session
id, the page, the access ID used to sign in, the property or section opened,
and the country and city from Vercel's edge. No names, emails or IP addresses
are stored. Bots are ignored. Visits from a browser that has signed in to
`/admin/` are not counted (change this under Account).

## Roles

- **Viewer:** sees analytics and content, changes nothing.
- **Editor:** edits and publishes content, manages broker links and the inbox.
- **Admin:** everything an editor can do, plus links, the team, rollbacks and the audit log. Cannot change owners.
- **Owner:** everything.

Anyone can be limited to some links; they then see only those links'
analytics, content, brokers and inbox.

## Broker links

1. Broker links, New broker link. Pick the links, optionally only some
   properties, whether they can propose new buildings, and when the link
   expires.
2. Copy the link or send it on WhatsApp or email. It is shown once; only a
   fingerprint of it is stored. If it is lost, use "New link".
3. The broker opens it on their phone, picks a property and fills in what they
   know, or proposes a new building with a Google Maps link.
4. It appears in the Inbox. Approving puts it into that link's draft with a
   note of who said it and when. Publish the draft to make it live. On the
   property card it shows under "Latest from the market", marked as
   broker-stated with the date.

New buildings: the Chennai study can draw a new property from a name and a
position, so an approved proposal becomes a new option there. The other links
keep approved proposals as "Broker leads" in the content editor for the team
to act on.

## Adding a 3D model (for example Total Environment, Whitefield)

1. Atlas links, Whitefield, Edit content, 3D models.
2. On the Total Environment card set "How it is drawn" to "3D model file".
3. Upload the `.glb` (up to 100 MB) or paste an `https://` link to one.
4. Set the height in metres. Pick the footprint from the list so the model
   sits on the right building.
5. Save the draft, then "Open the alignment tool". It opens the map with
   sliders for rotation, scale and offsets. When it lines up, copy the four
   numbers into the card.
6. Preview, then publish.

## Preview

"Preview draft" opens the link with `?cms-preview=1`. You must be signed in to
`/admin/` in the same browser. A ribbon at the bottom says it is a draft. The
main map (client views at `/`) needs the client's access ID and password, as
usual.

## Adding a new Atlas link

Register it in Atlas links (Add a link) so it is counted and editable. For
visits and published changes to work, its page must load `/atlas-cms.js`:

- A standalone study or tool: load the app through `AtlasCMS.boot("<id>", { app: "./app.js" })`,
  as `/chennai/index.html` does.
- A client view on the main map: nothing to do; `index.html` already calls
  `AtlasCMS.prepareClient` for every client.

To make its properties editable, add an adapter for it in `atlas-cms.js`
(where its data lives, its id field, its facts and the features that can be
switched off).

## Running it locally

```
npm run dev:cms
```

Then open http://localhost:8090/admin/. Without Supabase settings it keeps
everything in `.cms-dev-store.json` (git-ignored) and uploaded files in
`media/_cms-dev/`. The setup key is `dev-setup`.

## Security notes

- Passwords are hashed with scrypt. Five wrong passwords lock an account for
  15 minutes.
- The admin session is an HttpOnly, Secure, SameSite=Strict cookie that lasts
  12 hours. "Sign out everywhere" and password changes end all other sessions.
- Every change needs a header a cross-site form cannot send.
- Broker links carry a random key after `#`, so it never reaches server logs.
  The server stores only its SHA-256 fingerprint.
- The Atlas links' own sign-in screens still check passwords in the browser,
  as before. The CMS does not change that.
