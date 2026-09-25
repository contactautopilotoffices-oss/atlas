# God's Eye

Live market signals plus a desk that tells Autopilot where to place its next bet.
Lives at `/godseye/` on the ATLAS deployment.

## What it does

**Live feed (left).** Every five minutes the server pulls public headlines from
Google News searches (funding, Series A to E, GCCs, hiring, office leasing, flex and
coworking, competitor moves, the return-to-office debate, policy) and the Entrackr and
Inc42 feeds. Headlines are de-duplicated, tagged by keyword, and shown newest first
with the amount and city exactly as the headline prints them. Tags are a filter, not
a verdict. Source health is shown under the feed, so a failed source is visible.

**The desk (right).** Ask a question, or tap a preset. The server sends the question,
the current feed and any pinned headlines to the model. The model checks each signal,
scores bets out of 100 (signal, timing, fit, reach, evidence), and streams back a ranked
answer. Every fact carries a date and a link, and anything reasoned rather than found is
marked "Estimate:". The brief it works from is `SYSTEM_PROMPT` in `api/godseye/_lib.js`;
the company description is `AUTOPILOT_PROFILE` in the same file. Edit that block when
the footprint changes.

It runs on one of two providers:

- **Engy** (default when `ENGY_API_KEY` is set). Open models on engy.ai through their
  OpenAI-compatible API. Engy has no built-in web search, so the model gets two tools
  that run on our server: `search_news` (Google News for any query) and `read_page`
  (open a public URL and read it). If a model refuses tools, the desk answers from the
  feed alone and marks every fact "headline only, not verified".
- **Claude** (when only `ANTHROPIC_API_KEY` is set, or `GODSEYE_PROVIDER=claude`). Uses
  Anthropic's built-in web search.

## Setup

Set in Vercel, Project > Settings > Environment Variables:

| Variable | Required | What it is |
| --- | --- | --- |
| `ENGY_API_KEY` | yes, for Engy | Powers the desk. The feed works without it. |
| `GODSEYE_ACCESS_KEY` | yes | The passcode people type at the gate. Checked on the server. |
| `GODSEYE_MODEL` | no | Defaults to `engy/deepseek-v4-flash-0731`. `engy/qwen3.8-27b` also exists. |
| `ENGY_BASE_URL` | no | Defaults to `https://api.engy.ai/v1`. |
| `ANTHROPIC_API_KEY` | no | Use Claude instead. |
| `GODSEYE_PROVIDER` | no | Force `engy` or `claude`. |

Optional subdomain: add `godseye.autopilotoffices.com` as a domain on the Vercel
project. `vercel.json` already redirects it to `/godseye/`.

## Run locally

    ENGY_API_KEY=... GODSEYE_ACCESS_KEY=... npm run godseye
    open http://localhost:8090/godseye/

## Cost

On Engy each question is up to 10 model rounds and 20 tool calls, billed per token. On
Claude it is one request with up to 15 web searches. Expect one to three minutes per answer. Keep `GODSEYE_ACCESS_KEY` private: anyone with it can spend
API credit.
