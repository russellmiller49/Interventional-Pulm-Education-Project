# Handoff — MT Wolf private preview: demo hub

| Field          | Value                                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Slice          | Turn the private manufacturer preview into a hub: the device explorer plus the two 2026-10-01 presentation demonstrations (pleural-model progress, portable-trainer concept), each reachable online behind the same code |
| Branch         | `claude/mt-wolf-demo-hub`                                                                                                                                                                                                |
| Base           | `origin/main` `46c5bb94` (after PR #312)                                                                                                                                                                                 |
| Builds on      | `docs/medical-thoracoscopy/handoffs/mt-wolf-private-preview.md` (PR #309): same session, cookie, codes, attempt limits and fail-closed rules; nothing about them changed                                                 |
| Owner decision | 2026-10-01: add both demonstrations to the password-protected preview behind a hub; leave out the internal ScopeTracker platform-comparison graphic; take it all the way live                                            |
| Date           | 2026-10-01                                                                                                                                                                                                               |

## What the reviewer sees

`https://interventionalpulm.org/en/medical-thoracoscopy/wolf-preview` (the same link as before).

- **Code screen** (unchanged form; heading now "Development Preview — Manufacturer Review"). It
  appears on the hub and on each page below, and signing in returns to the page it was shown on.
- **Hub** (`/wolf-preview`): three cards with images — Device Explorer, Pleural Model Progress,
  Portable Hybrid Thoracoscopy Trainer — End preview, and a disclosure line.
- **Device Explorer** (`/wolf-preview/device-explorer`): the explorer exactly as before, with an
  "All previews" link beside End preview. The explorer used to live at the hub's address.
- **Pleural Model Progress** (`/wolf-preview/pleural-model-progress`) and **Portable Hybrid
  Thoracoscopy Trainer** (`/wolf-preview/portable-trainer-concept`): summary; the trainer's own
  statement first ("No physical thoracoscopy trainer has been built, measured or validated." and
  the rest of its README paragraph); "Open the interactive viewer" (the original three.js viewer,
  full-window, unmodified); the video (byte-range served, plays inline); stills as previews that
  open the full-resolution file in a new tab; and "What this shows" (CT-derived / authored / under
  review, or from existing work / conceptual / needs engineering validation / not claimed), taken
  from each demonstration's README.

## Access

- `src/lib/site-auth/access.ts`: three more exact paths in `PUBLIC_UNLISTED_EXACT_PATHS`
  (`/medical-thoracoscopy/wolf-preview/{device-explorer,pleural-model-progress,portable-trainer-concept}`).
  No prefix: any other path under `/wolf-preview/` still needs a site sign-in, and `/medical-thoracoscopy`
  is untouched. Every page checks the preview session itself (`server/previewPage.tsx`) and is not
  found while the preview is off; unknown demonstration names are not found.
- New endpoint `/api/medical-thoracoscopy/wolf-preview/files/<group>/<published path>`: flag, then
  session (401 without), then the group and path must be a key of the committed server-only
  manifest `server/demoManifest.ts` (object never taken from the request; segment pattern, no `..`,
  own-property lookups), then the bytes are downloaded with the service key and checked against
  the manifest's size and SHA-256 (503 on mismatch or storage failure). `Cache-Control: private,
no-store`; `Accept-Ranges: bytes`, single ranges answered 206, past-the-end 416. Groups: `hub`,
  `pleural-model-progress`, `portable-trainer-concept`.
- The sign-in form carries the page it was on (`item`); the server only accepts the three item
  names and otherwise returns to the hub, so it cannot be used as an open redirect.
- Verified bytes stay in server memory once read: about 71 MB once every file has been asked for,
  40 MB of it the two videos. Each Railway instance reads each file from storage once.

## Files distributed

Private Supabase bucket **`mt-wolf-preview-demos`** (public: false; MIME html, js, json, glb,
mp4, jpeg, png; 50 MB per file), objects under `v1/`, content-named (`<name>.<sha12>.<ext>`), one
object per distinct file: **62 published files, 51 objects, 71,029,061 bytes**. The full list with
hashes and sources is `docs/medical-thoracoscopy/distribution/wolf-private-preview-demos.json`.

- Pleural demo: `index.html`, `scene.json`, six models (ribs, pleural space, lung states, effusion,
  operative telescope, flexible sleeve), six three.js r180 files, the 88 s MP4, seven stills and
  their previews.
- Trainer concept: `index.html`, `scene.json`, `poses.json`, `trainer-frame.json`, six models
  (trainer, ribs, pleural space, lung states, operative telescope, double-spoon forceps), seven
  three.js files, the 60 s MP4, six concept images and their previews.
- Hub: three card images.

**Withheld:** `07-scope-tracker-platform-comparison.png` (owner's choice; labelled internal), both
READMEs, `build/`, `SERVE.command`, the trainer's `viewer/diagrams/` sources, the vendor LICENSE
file (the three.js files keep their licence header).

**Changed from the local files** (staging writes copies; the presentation folders are untouched):

- The three device models in the viewers are the raw showcase builds, whose device-root `extras`
  held the build's internal record: product numbers, generator and register hashes, a
  "Private … not uploaded … R-DEVICE-MODELS is unresolved" distribution note, the register entry
  with open-question codes. The staged copies keep only descriptive fields (`deviceId`, `name`,
  `label`, `units`, `frame`, `tier`, `kitModel`, `qualityClass`, field/direction of view, eyepiece
  angles, jaw opening). Neither viewer reads those fields; geometry and binary chunks unchanged.
- The effusion model's statement "Built for the local progress demo only; not uploaded." now reads
  "Built for the progress demonstration; not part of the module."
- Card images (19:10 crops without the stills' titles) and 1600 px gallery previews, metadata
  stripped, cut with ffmpeg.

## Pipeline

`scripts/medical-thoracoscopy/wolf-preview-demos.ts`:

```bash
npx tsx scripts/medical-thoracoscopy/wolf-preview-demos.ts --stage            # copy + cut + verify
npx tsx scripts/medical-thoracoscopy/wolf-preview-demos.ts --write-manifest   # server manifest
# from the primary checkout only:
npx tsx <this checkout>/scripts/medical-thoracoscopy/wolf-preview-demos.ts --upload
npx tsx <this checkout>/scripts/medical-thoracoscopy/wolf-preview-demos.ts --remove
```

The staged set lives in Local-Data `raw-assets/medical-thoracoscopy/wolf-preview-demos/v1/`
(`objects/` + `manifest.json`), so a later re-render of the presentation folders cannot change
what is distributed until someone re-stages. Staging stops if any file in either folder is neither
distributed nor on the withheld list. Verification: allow-list and hashes; models are glTF binaries
with no image, texture or external reference and no manufacturer mark, product number or internal
note; the three.js files are byte-identical to the repository's `three@0.180.0`; viewer pages
fetch nothing from the network and every relative file they or their modules import is in the
same group; stills carry no EXIF/XMP/text chunks; MP4s have the index first. Upload reads every
object back, checks the bucket holds exactly the manifest, and that the public URL is refused.

## Checks run

| Check                                                                                           | Result                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Preview tests (`wolf-preview/__tests__`, 6 suites)                                              | 69 pass: access, endpoints (file route: session first, manifest-only names, traversal, ranges, tampered bytes, preview off), page (hub, explorer, demos, return-to-page gate), boundaries, catalogue, demos (copy claims nothing positive) |
| `npx jest src/features/medical-thoracoscopy src/lib src/app src/features/learning-module`       | 96 suites, 953 tests: 952 pass; the 1 failure (`board-review-html`, English fallback) is the one recorded in the previous handoff as failing identically on main                                                                           |
| `tsc --noEmit`, `eslint`, `prettier --check` on every changed file                              | Clean. (`tsc` also had a pre-existing error on main in `boundaries.test.ts`, `canViewDraftModules` → `isAdmin`; fixed here)                                                                                                                |
| `wolf-preview-demos.ts` verify                                                                  | Clean: 62 files, 51 objects, 71,029,061 bytes; allow-list, hashes, models, marks and internal notes, three.js identity, references, image metadata, MP4 index                                                                              |
| `wolf-preview-demos.ts --upload` (primary checkout)                                             | Bucket created private; 51 objects uploaded and read back with matching SHA-256; bucket holds exactly the manifest; public URL 400. `storage.objects` policies: every permissive one is scoped to `pocus-media` or `library-pdfs`          |
| `next build --webpack` with a throwaway secret, code and verifier in the build environment      | Passed. 626 client files: no secret, code, verifier, service key, demo bucket, object name or local path. Server output: no secret value                                                                                                   |
| `verify-wolf-preview.ts` on `next start` (real private buckets, throwaway local reviewer, cold) | **67 of 67** (below)                                                                                                                                                                                                                       |

Browser run (Chromium, Metal): code screen only for a fresh context, noindex; wrong code refused
with the generic message and no cookie; correct code opened the hub (`__Host-mt-wolf-preview`,
HttpOnly, Secure, Lax) with three cards and their images; the explorer opened from its card, every
major control used, 13 models served, no console errors; All previews returned to the hub; each
demonstration page opened from its card, the trainer's statement first; each video answered
`Range: bytes=0-1023` with 206 and played in the page (88 s, 60 s); every still preview loaded and
a full-resolution still was served; each viewer loaded every file it asked for (14 and 17), ran
(`__demoReady`), took interaction (Free orbit and a layer toggle; cutaway and exploded slider), no
errors; copied viewer and video URLs answered 401 in a fresh context (request and navigation); the
withheld comparison graphic, a README, the diagram source, an encoded traversal and `hub/index.html`
answered 404 with a session; no copy at the public storage URLs of either bucket (400) or the site's
module-assets and models paths; signing in from the trainer page returned to it; End preview
removed the cookie and models and files then answered 401; signing in again and reloading kept the
explorer; the explorer at 1440 × 900, 1024 × 768, 390 × 844 and 200% zoom, and the hub and both
demonstration pages at 1440 × 900 and 390 × 844, rendered without horizontal scrolling.
Screenshots (they show the models) are in Local-Data:
`medical_thoracoscopy/presentation/2026-10-01-wolf-preview-hub-verification/local/`.

## Rollback

1. **Shut everything:** `MT_WOLF_PREVIEW_ENABLED=false` on Railway (hub, every page and every
   endpoint answer 404).
2. **Remove only the demonstrations' files:** from the primary checkout,
   `npx tsx <this checkout>/scripts/medical-thoracoscopy/wolf-preview-demos.ts --remove` (empties and
   deletes `mt-wolf-preview-demos`); the demonstration pages then render but their files answer 503. The explorer and its bucket are unaffected.
3. **Remove the hub:** revert this PR's merge commit; the explorer returns to the hub's address.

## Unresolved

- R-DEVICE-MODELS and the anatomy surfaces' broader distribution rights: unchanged, unresolved.
- Manufacturer fact-check: NOT REVIEWED (unchanged). Clinical review and publication: unchanged.
- The lung collapse, the effusion surface and the port default remain illustrative or authored
  (stated on the page).
- The attempt limit stays per server instance, in memory (unchanged).

## What must not happen next

- Do not upload these files to `module-assets`, place them under `public/`, or add a rewrite.
- Do not describe the trainer as built, validated or manufacturer-approved.
- Do not restage from the presentation folders without re-reading what changed there.

This does not change publication status or constitute clinical approval.
