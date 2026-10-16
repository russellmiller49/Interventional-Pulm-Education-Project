# Literature Atlas tester preview

`/literature-atlas` puts the Literature Atlas — a read-only evidence map of the interventional
pulmonology literature (about 37,000 included articles, about 5,300 with a machine-generated study
brief; side-by-side compare of up to 6 and an evidence table of up to 50 selected articles, kept only
in the link) — on the website as a module in development. It is separate from the site-admin Literature Explorer at `/literature`,
which this work does not touch.

## Owner decisions (2026-10-15)

- Reachable by direct link without an account; unlisted (no navigation, search or sitemap entry);
  `noindex, nofollow, noarchive`; listed in the beta-testing hub at stage `preview`.
- Read-only explorer only: no workbench, collections, reports or network meta-analysis view.
- Every brief is shown, labelled "Machine study brief — not physician-reviewed" unless reviewed.
- The website version does not show source availability, the source-use basis or the extraction
  model. The Atlas's public database and its `serve-public` profile enforce this, not the website.

## How it fits together

```
browser ── /en/literature-atlas ──────────────► module page (this repo)
   │                                               frames /api/literature-atlas
   └──── /api/literature-atlas/<path>?<query> ─► relay route (this repo, GET/HEAD only)
                                                   │ strips the prefix
                                                   ▼
                          ${LITERATURE_ATLAS_ORIGIN}/<path>?<query>  (private Atlas service)
```

- **Atlas service.** A separate private Railway service, started with
  `./literature-atlas serve-public --db <public-atlas.sqlite> --base /api/literature-atlas`. It
  serves a sanitized public database and renders every link, asset, fetch and redirect with the
  `/api/literature-atlas` prefix. It has no public domain; only the website reaches it.
- **Relay.** `src/app/api/literature-atlas/[[...path]]/route.ts`. Optional catch-all, so the bare
  prefix reaches the Atlas root, which redirects to its landing view.
- **Module page.** `src/app/[locale]/literature-atlas/page.tsx`: title row, the tester disclaimer,
  a full-height same-origin frame of `/api/literature-atlas`, then a short description.

## Relay contract

| Concern          | Behaviour                                                                                                                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Methods          | `GET` and `HEAD` (HEAD is relayed as HEAD). Every other method: `405` with `Allow: GET, HEAD`.                                                                                                                                                                                      |
| Upstream         | Server-only `LITERATURE_ATLAS_ORIGIN` (http or https; only its origin is used). Unset, blank or invalid: `404`, nothing fetched.                                                                                                                                                    |
| Path and query   | `/api/literature-atlas/<path>?<query>` → `<origin>/<path>?<query>`, the query as Next.js hands it over (equivalent, not byte-identical; see below). Built by string concatenation and checked to stay on the origin.                                                                |
| Request headers  | Only `Accept`. Never the visitor's cookies or `Authorization`; `credentials: 'omit'`, `cache: 'no-store'`.                                                                                                                                                                          |
| Timeout          | 15 s (`AbortSignal.timeout`). Network failure or timeout: `502`, `no-store`.                                                                                                                                                                                                        |
| Redirects        | `redirect: 'manual'`. A 301/302/303/307/308 passes only when `Location` starts with `/api/literature-atlas/`; any other 3xx or `Location`: `502`.                                                                                                                                   |
| Content types    | `text/html`, `application/json`, `text/css`, `text/javascript`, `application/javascript`, `application/octet-stream`, `text/plain` (parameters such as `charset` kept). Anything else: `502`.                                                                                       |
| Status           | Non-redirect upstream statuses pass through (for example the Atlas's own `404` text).                                                                                                                                                                                               |
| Response headers | Built from scratch: `Content-Type`, the Atlas's `Content-Security-Policy` (a strict fallback if absent), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-Robots-Tag: noindex, nofollow, noarchive`, `Cache-Control`. No `Set-Cookie` or other upstream header. |
| Caching          | `/static/…`: `public, max-age=3600` (asset names are not content-hashed). `application/octet-stream` (the map's packed coordinates): `public, max-age=300`. HTML, JSON, text, errors and redirects: `no-store`.                                                                     |

`next.config.mjs` keeps the site-wide security headers off `/api/literature-atlas` (the site CSP and
`X-Frame-Options: DENY` would block the frame) and gives the relay its own rule: the site's other
security headers with `X-Frame-Options: SAMEORIGIN` and no second CSP. `/literature-atlas` is in
`betaFramePaths`, so the beta hub's feedback wrapper can frame the module page.

The proxy (`src/proxy.ts`) lets every `/api/` path through without the sign-in gate, which is what
makes the direct link work without an account; the relay sets its own `X-Robots-Tag`.

### What the Atlas side must keep

- Every URL it emits carries the `/api/literature-atlas` prefix, and redirects use a relative
  `Location` under it. An absolute `Location` (FastAPI's automatic slash redirects build one) is
  refused with `502`.
- No route depends on a trailing slash: the site has `trailingSlash: false` and redirects
  `…/path/` to `…/path` before the relay runs.
- Query strings are parsed as form data, not compared byte for byte. Next.js hands the route a
  re-serialized query: repeated keys grouped together (their own order kept), `%20` as `+`, and
  `flag` as `flag=`. Standard form decoding, which FastAPI uses, reads both forms the same way.
- Only the content types above, no cookies, GET/HEAD only.
- A strict CSP with `frame-ancestors 'self'`. Atlas pages run on the website's origin, so that
  policy (`script-src 'self'`, no inline script) is what keeps an Atlas page from running script
  with access to the site's cookies and storage.

## Access, listing and analytics

- `src/lib/site-auth/access.ts`: `/literature-atlas` in `PUBLIC_UNLISTED_EXACT_PATHS` and
  `PUBLIC_UNLISTED_PATH_PREFIXES` (public, noindex); analytics module id `literature-atlas`.
- `src/lib/draft-modules.ts`: in `unlistedModulePathPrefixes`, so it is absent from navigation and
  search for everyone, including admins, like every other public-unlisted beta module. (The beta
  catalog test requires this; `draftModulePathPrefixes` would still show it to admins.)
- `src/lib/non-public-modules.ts`: listed under IP tooling, so `/admin/modules` shows it as
  direct-link.
- Beta hub: `src/features/module-beta/catalog.ts` (id `literature-atlas`, group `Literature`),
  `rollout.ts` (`preview`) and the new `Literature` group in `BetaHubSections.tsx`.
- Hub feedback storage: `supabase/migrations/20261016025933_add_literature_atlas_to_module_beta_feedback.sql`
  adds the id to the feedback table's check constraint. Not applied.

## Testing locally

Against the real Atlas public server (from the Atlas repository; see its deploy bundle notes):

```bash
./literature-atlas serve-public --db <public-atlas.sqlite> --base /api/literature-atlas --port 8920
```

Then, from the Claude worktree:

```bash
LITERATURE_ATLAS_ORIGIN=http://127.0.0.1:8920 npm run dev:claude
```

Open `http://localhost:3120/en/literature-atlas`. Header checks:

```bash
curl -sI http://localhost:3120/api/literature-atlas/map
```

Expect `200`, `x-robots-tag: noindex, nofollow, noarchive`, `x-frame-options: SAMEORIGIN` and the
Atlas CSP; `curl -sI -X POST …` gives `405`. Without `LITERATURE_ATLAS_ORIGIN` every relay path is
`404` and the page shows an empty frame. Unit tests: `npx jest src/app/api/literature-atlas`.

## Go-live (owner)

Nothing here is deployed by merging alone; each step is the owner's.

1. Rebuild the Atlas snapshot and the public database, and deploy the Atlas service on Railway as a
   private service (no public domain).
2. On the website's Railway service set `LITERATURE_ATLAS_ORIGIN` to the Atlas's private address,
   for example `http://literature-atlas.railway.internal:<port>`.
3. Apply `20261016025933_add_literature_atlas_to_module_beta_feedback.sql` to the main-site Supabase
   project from the primary checkout, so hub feedback on the Atlas can be saved.
4. Merge and deploy the website change.
5. Check on the live site: `/en/literature-atlas` shows the Atlas in its frame without signing in;
   relay responses carry `noindex`; `/en/admin/modules` shows it as direct-link; the beta hub lists
   it under Literature.

To withdraw the preview, unset `LITERATURE_ATLAS_ORIGIN`: the relay returns `404` at once.
