# Handoff — MT Wolf private preview (device explorer, manufacturer review)

| Field               | Value                                                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slice               | Controlled manufacturer-review deployment of the device explorer only (work package MT-05)                                                                                                                |
| Branch              | `claude/mt-wolf-private-preview`                                                                                                                                                                          |
| Base                | `origin/main` `501f383cd6bd558a90d314f67439de67d82df284`                                                                                                                                                  |
| Explorer source     | The audited explorer `claude/mt-05b-device-explorer` at `c6295d2aceafe59dd9bf088951cd13bad3daf45f` (which carries the showcase tier `07747c7f`). Read with `git archive`; no source worktree was changed  |
| Prerequisite slices | None merged. The review chain (#295–#307) is untouched: the explorer's data enters main only as a generated catalogue, not by merging those branches                                                      |
| Final head          | The commit that adds this file: `git log -1 --format=%H -- docs/medical-thoracoscopy/handoffs/mt-wolf-private-preview.md`                                                                                 |
| Owner decision      | Owner authorization of 2026-09-29: deploy the device explorer and its showcase assets for controlled manufacturer review only. Not publication, not rights clearance, not fact-check, not clinical review |
| Date                | 2026-09-29                                                                                                                                                                                                |

## Why

The manufacturer's reviewers need to handle the equipment models interactively without the
course, its prototypes or any model becoming public. This slice deploys only the device explorer,
behind a server-enforced review code, with the models in a private bucket that only the
application server can read.

## Route and scope

`/{locale}/medical-thoracoscopy/wolf-preview` (send `https://interventionalpulm.org/en/medical-thoracoscopy/wolf-preview`).

- Shows the device explorer (thirteen showcase models, normal/cutaway telescope, exploded view,
  assembly sequence with forceps through the channel, jaws, hotspots with kinds of claim, class
  A/B/C indicators) and the disclosure "Development preview for manufacturer review. Parametric
  educational models; not manufacturer CAD. Device details remain subject to manufacturer
  fact-check."
- Not shown and not reachable through it: lessons, anatomy, lung states, contact or biopsy
  prototypes, survey gate, registers, reference images, comparison sheets, local-data paths.
- `/medical-thoracoscopy` and every other path under it keep their existing treatment (sign-in
  required on main). Only this exact page is added to the site's direct-link list, so the site's
  sign-in gate lets it through and adds `X-Robots-Tag: noindex, nofollow, noarchive`; the page then
  enforces its own session. It is in `unlistedModulePathPrefixes`, absent from the sitemap and from
  every listing, and the page metadata is `noindex, nofollow, noarchive, nocache`.

## Authentication

- **Codes.** Each reviewer gets an individually issued random code (`MTW-` then five groups of five letters and digits, 125 bits). The host stores only `label:sha256:<hex>` verifiers (SHA-256 of a domain-separated,
  normalised code). Multiple reviewers are supported; each can be revoked independently.
- **Sign-in.** A plain HTML form posts to `/api/medical-thoracoscopy/wolf-preview/session`. The
  server checks same-site (Origin / Sec-Fetch-Site), a per-client and overall attempt limit
  (in memory: 10 failures per client, 200 overall, per 15 minutes), then compares the code's digest
  with every verifier in constant time. Wrong code: "Review code not recognized." and nothing else.
- **Session cookie.** `__Host-mt-wolf-preview` in production (`mt-wolf-preview` elsewhere): HttpOnly,
  Secure, SameSite=Lax, Path=/, host-only, Max-Age 7 days. Value = base64url payload
  `{label, verifier fingerprint, iat, exp}` + HMAC-SHA256 with the session secret. No code, no
  verifier. Checked on every page and model request: signature (constant time), expiry, label
  still configured, fingerprint still matching that label's current verifier.
- **End preview** posts to `/session/end`, which clears the cookie.
- **Fail closed.** Any missing or malformed setting (flag not exactly `true`, secret under 32
  characters, no reviewers, a malformed or duplicate entry) makes the page, sign-in and model
  endpoints answer 404. Storage not configured: the signed-in page says "temporarily unavailable".

## Environment variables (names only)

| Name                                         | Holds                                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `MT_WOLF_PREVIEW_ENABLED`                    | `true` to open the preview; anything else shuts it                                  |
| `MT_WOLF_PREVIEW_SESSION_SECRET`             | 48 random bytes, base64url (`wolf-preview-credential.ts --secret`)                  |
| `MT_WOLF_PREVIEW_REVIEWERS`                  | Comma-separated `label:sha256:<hex>` entries (`wolf-preview-credential.ts <label>`) |
| `SUPABASE_SERVICE_ROLE_KEY`                  | Existing server-only key; used to read the private bucket                           |
| `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` | Existing project URL                                                                |

Generate locally (prints to your terminal only):

```bash
npx tsx scripts/medical-thoracoscopy/wolf-preview-credential.ts --secret
npx tsx scripts/medical-thoracoscopy/wolf-preview-credential.ts wolf-reviewer-1
```

## Protected asset architecture

- Private Supabase Storage bucket `mt-wolf-preview` (public: false, MIME `model/gltf-binary`,
  5 MB limit), objects under `device-explorer/v1/`. The project's storage policies grant `anon` and
  `authenticated` nothing on this bucket (every permissive policy is scoped to `pocus-media` or
  `library-pdfs`; the one policy on all buckets is RESTRICTIVE).
- Browser asks `/api/medical-thoracoscopy/wolf-preview/models/<id>.glb`. The endpoint checks the
  flag, then the session, then that `<id>` is a key of the committed server-only manifest
  (`wolf-preview/server/assetManifest.ts`; object path never taken from the request), downloads
  with the service key, checks size and SHA-256 against the manifest, and answers
  `Cache-Control: private, no-store`. Unauthenticated 401; unknown, traversal or image names 404;
  storage failure or hash mismatch 503. No rewrite, public upload prefix or standalone path points
  at these files, and no copy exists in `public/` or the public `module-assets` bucket.
- The explorer's data is a generated catalogue
  (`content/data/generated/deviceExplorerCatalogue.ts`, from `c6295d2a` by
  `build-device-explorer-catalogue.ts`; `--check` reproduces it byte for byte) holding only what
  the explorer shows. The full definitions, register and kit manifest, with their internal notes,
  document titles and rights wording, are not on main and not in any page bundle.

## Uploaded files

Uploaded 2026-09-29 from the primary checkout by `wolf-preview-assets.ts --upload`, after it
verified each file against the showcase register (at `c6295d2a`), the asset-status table (id and
class), the staging hashes, glTF-only content, no image or texture, no external reference and no
manufacturer mark; each was read back and its hash checked; the bucket holds exactly these 13.

| Class | Object (`mt-wolf-preview/device-explorer/v1/`)              |   Bytes | SHA-256                                                            |
| ----- | ----------------------------------------------------------- | ------: | ------------------------------------------------------------------ |
| A     | `operative-telescope.2f764e19c427.glb`                      | 220,552 | `2f764e19c427b2ae4e89f2c1ab2e60334936a7ebafd2bbd44f14f504a926f923` |
| B     | `operative-telescope-illustrative-cutaway.17ca118f257b.glb` | 224,448 | `17ca118f257ba371db9c2f9303a82cb7049d2c5735d3a47bf6a5a4c34bcc0358` |
| B     | `trocar-sleeve-flexible.03ae9a58c38a.glb`                   |  50,736 | `03ae9a58c38a5db76bebedf83c6961148c01c4725917d51803a05c782f58a43a` |
| B     | `trocar-for-flexible-sleeve.1e001707ccd9.glb`               |  26,632 | `1e001707ccd95f986bf46ada49a851607b220878d65f2c12a370519afcaa5b5f` |
| B     | `trocar-sleeve-with-valves.c1dabf68c789.glb`                |  72,888 | `c1dabf68c7895ec6001f06b95885a244f908c12830a5506ebd71da791ef6d3b4` |
| B     | `trocar-for-sleeve-with-valves.3feae9fba3f9.glb`            |  25,368 | `3feae9fba3f94c0f7a211e796918b8cf47b518c8ede13c282a96e30c0ae84c94` |
| B     | `double-spoon-forceps.e97b40bf3908.glb`                     |  65,888 | `e97b40bf3908c36116675d644e1f3af683e617a9567b77bb23396c36cdc45324` |
| B     | `dissection-forceps.f104e2a99fc3.glb`                       |  50,840 | `f104e2a99fc33e7a4dc099e1426616af2c49b706a18be51ecf8c3e2282f8360e` |
| B     | `hook-electrode.5dfc958af27f.glb`                           |  35,208 | `5dfc958af27f124149cc100a92efad2b4e0c201351e7a5876b0aba153fadb438` |
| B     | `button-electrode.3e3fe98f4e39.glb`                         |  35,960 | `3e3fe98f4e39fffac1c4636ed91a4878cf2ebaec7b4986a8adf4d83ae5581862` |
| B     | `probe.fb3eddb27c35.glb`                                    |  34,288 | `fb3eddb27c350523b972fc33561f7af70d6b8b780a25f698a3b3f1a2f36fc0a3` |
| B     | `suction-tube.563d7bae279e.glb`                             |  31,800 | `563d7bae279e0afafb5f6ae72cba82806dd667ad691b70818ae63958dbb67bd0` |
| C     | `tower-blockout.cf2a04bba4eb.glb`                           |  80,304 | `cf2a04bba4ebbf92e27d66b6f593fb1d82c0c1a542e7849f7ab35c0fde643368` |

Not uploaded: reference frames, comparison sheets, renders, the assembly animation file, anatomy,
CT or segmentation data, thorax or lung models, contact-spike assets, anything else.

## Rights and status record

`docs/medical-thoracoscopy/distribution/wolf-private-preview.json` records the fact of this
restricted manufacturer-review distribution (what, channel, audience, authority, hashes).
R-DEVICE-MODELS stays **unresolved input**; manufacturer fact-check stays **NOT REVIEWED**; clinical
review and course publication status are unchanged. The rights register and asset ledger live on
the unmerged review chain (PR #295 onward), which this slice does not edit: when they land, their
R-DEVICE-MODELS `use`/`heldAt` should cite this record.

## Checks run

| Check                                                                                                          | Result                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx jest src/features/medical-thoracoscopy src/lib src/app src/features/learning-module`                      | 94 suites, 926 tests: 925 pass; the 1 failure (`board-review-html`, English fallback) fails identically on main                                                                                                                      |
| Preview tests (`wolf-preview/__tests__`, 5 suites)                                                             | 46 pass: access, endpoints, page, boundaries, catalogue                                                                                                                                                                              |
| Ported explorer tests (assembly, controls)                                                                     | 27 pass                                                                                                                                                                                                                              |
| `tsc --noEmit`, `eslint`, `prettier --check` on every changed file                                             | Clean                                                                                                                                                                                                                                |
| `build-device-explorer-catalogue.ts --check`                                                                   | Byte-identical to `c6295d2a`                                                                                                                                                                                                         |
| `npm run build:content && next build --webpack`, with probe secret, code and verifier in the build environment | Passed. 623 client files: no probe secret, code, verifier, service key, bucket, object name, local-data path, rights wording or manufacturer mark. Server output: no secret value (variable names and the server-only manifest only) |
| `next start` with the preview disabled                                                                         | Page, sign-in (even with a correct code) and model endpoints 404; `/en/medical-thoracoscopy` still redirects to sign-in                                                                                                              |
| `verify-wolf-preview.ts` on `next start` (real private bucket, throwaway local reviewer)                       | 30 of 30 (below)                                                                                                                                                                                                                     |

## Browser results (Chromium 151, Metal)

Local production server: code screen only for a fresh context; noindex header and meta; wrong code
refused with the generic message and no cookie; correct code opened the explorer with
`__Host-mt-wolf-preview` (HttpOnly, Secure, Lax); orbit, zoom, reset, labels, exploded/assemble,
play/pause, slider, steps 7 and 9, jaws, hotspot, previous/next, eight devices, cutaway and forceps
jaws all used; 13 models served; no console errors; a copied model URL answered 401 in a fresh
context (request and navigation); a reference-image name and a traversal answered 404 with a
session; the public storage URL (400), public module-assets path (400), site module-assets path
(404) and site models path (404) held no copy; End preview removed the cookie and models then
answered 401; signing in again and reloading kept the explorer; 1440 × 900, 1024 × 768,
390 × 844 and 200% zoom all rendered without horizontal scrolling. Screenshots (they show the
models) are in local data: `medical_thoracoscopy/presentation/2026-09-29-device-showcase/wolf-preview-verification/`.

## Deployed results (production, 2026-09-29)

Merged as PR #309 (`68298a84`) and deployed by Railway (service "marvelous-heart", production).
Checked on `https://interventionalpulm.org`.

**Before the owner set the variables:** the page (`/en` and `/es`), sign-in and model endpoints
answered 404; `/en/medical-thoracoscopy` still redirected to sign-in; the public storage URL of a
private object answered 400; the page carried `X-Robots-Tag: noindex, nofollow, noarchive`; the
sitemap named neither the preview nor the course.

**After the owner set the variables** (with a temporary `claude-verification` reviewer, whose code
stayed in a private local file and was never printed or committed):
`verify-wolf-preview.ts --base https://interventionalpulm.org` passed **30 of 30**, twice: on the
deploy of `68298a84` and again on the deploy of `fef3bfbc` (below). Same checks as the local run:
code screen only for a fresh context; noindex; wrong code refused with the generic message and no
cookie; correct code opened the explorer with `__Host-mt-wolf-preview` (HttpOnly, Secure, Lax);
every major control used; all 13 models served; no preview console errors; a copied model URL
answered 401 in a fresh context (request and navigation); a reference-image name and a traversal
answered 404 with a session; no copy at the public storage URL (400), the public module-assets path
(400), the site module-assets path (400) or the site models path (400); End preview removed the
cookie and models then answered 401; signing in again and reloading kept the explorer; 1440 × 900,
1024 × 768, 390 × 844 and 200% zoom rendered without horizontal scrolling. Screenshots are in local
data under `…/wolf-preview-verification/production/`.

**Direct unauthorised access, without a session (curl):** all 13 model URLs 401; HEAD, a query
string and forged or wrongly named cookies 401; upper-case, hashed-object and encoded-traversal
names 401; POST 405; `/en/medical-thoracoscopy/wolf-preview/probe.glb` 404; the kit path under
`/models/` 400. Against Supabase with the site's public anon key: the public, authenticated and
plain object endpoints 400, the bucket listing returned `[]`, and signing 400.

**Bypass found and fixed.** The site's existing, unauthenticated `/api/storage/signed-url` signed
any bucket and path with the service key: an anonymous request returned a working signed URL for a
private preview model (not downloaded), and every other private bucket was exposed the same way.
With the owner's approval it was restricted (PR #310, then PR #311 because #310's build failed on a
route-export rule): it signs only `Audio_companion`, `3d-models` and `module-assets` (its callers'
buckets), refuses dot, dot-dot, encoded and backslash path segments (`fetch` resolved
`3d-models/../other` into another bucket), and ignores a `projectRef` that is not the configured
project. Railway did not pick up the push of `fef3bfbc`; it was deployed with
`railway redeploy --from-source` (latest commit from the configured GitHub source, no configuration
change). On production afterwards: the preview bucket (two objects), `library-pdfs`,
`pocus-media`, `module-beta-feedback` and two traversal forms all answered 404 with no URL; a real
`3d-models` object still signed (200).

No production variable or reviewer credential was changed by this work. The
`claude-verification` entry is for the owner to remove.

## Rollback

1. **Shut it now:** on Railway set `MT_WOLF_PREVIEW_ENABLED=false` (or delete it). Page, sign-in
   and models answer 404 on the next deploy restart; nothing is deleted.
2. **Revoke one reviewer:** remove that entry from `MT_WOLF_PREVIEW_REVIEWERS` (their sessions end at
   once). **Revoke everyone:** rotate `MT_WOLF_PREVIEW_SESSION_SECRET` and/or empty the reviewer list.
3. **Remove the files:** from the primary checkout,
   `npx tsx <this checkout>/scripts/medical-thoracoscopy/wolf-preview-assets.ts --remove`
   (empties and deletes `mt-wolf-preview`), or delete the bucket in the Supabase dashboard.
4. **Remove the route:** revert this PR's merge commit. It touches one line in
   `src/lib/site-auth/access.ts` and one in `src/lib/draft-modules.ts`; everything else is new files.

## Unresolved

- R-DEVICE-MODELS (ownership; whether depicting the product design needs the manufacturer's
  permission). Public distribution remains unresolved.
- Manufacturer fact-check of every value, and the open questions in the showcase register.
- The sleeve's seat on the telescope (58.76 mm) is a derived measurement held only in local data
  and in the generated catalogue.
- The attempt limit is per server instance, in memory.
- Remove the temporary `claude-verification` entry from `MT_WOLF_PREVIEW_REVIEWERS` once no further
  verification is wanted.
- Railway missed one push to main (`fef3bfbc`); worth checking the service's GitHub trigger.
- When the review chain and `claude/mt-05b-device-explorer` merge, they should adopt this branch's
  catalogue-driven explorer (the components here read the catalogue instead of the definitions).

## What must not happen next

- Do not set any preview variable in a `NEXT_PUBLIC_*` name, or commit a code, verifier or secret.
- Do not upload these models to `module-assets` or place them under `public/`.
- Do not describe the preview as approved, validated or final, or treat it as rights clearance.

This does not change publication status or constitute clinical approval.
