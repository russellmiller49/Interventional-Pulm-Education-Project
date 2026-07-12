# Rigid Bronchoscopy Technique Videos — Production Plan

**Status: foundation built; no media generated.** The Higgsfield MCP server is
configured but not authenticated (see [`higgsfield-capabilities.md`](./higgsfield-capabilities.md)).
This plan defines the production system so generation can begin immediately once
Higgsfield is authenticated and the mainstem-direction prototype is approved.

## What supplements what

Higgsfield generates the **external** procedural scenes (manikin, operator,
straight rigid barrel). It is **not** trusted for authoritative internal airway
anatomy. Internal consequences use **validated 3D renders / deterministic
animation**. The integrated sequence is **assembled** from approved clips.

| Media source (`sourceType`)                       | Used for                                                            | Tracked in                         |
| ------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------- |
| `higgsfield-synthetic`                            | External manikin/operator scenes, dental-fulcrum error, quiz freeze | `manifest/generation-history.json` |
| `validated-3d-render`                             | Internal consequences, cutaways, movement-vector animations         | TS manifest only                   |
| `manikin-recording` / `faculty-approved-clinical` | Optional real footage if provided                                   | TS manifest only                   |

## Where things live (repo-convention adaptation)

The plan's suggested `manifest/videos.json` is adapted to this repo's convention
(a typed TS manifest that the compiler validates, mirroring
`src/features/pccm-intro-course/content`):

- **Clip manifest (app source of truth):**
  `src/features/rigid-bronchoscopy-techniques/content/techniqueVideos.ts`
- **Lessons:** `src/features/rigid-bronchoscopy-techniques/content/techniqueLessons.ts`
- **Types / validation / publication rule:**
  `src/features/rigid-bronchoscopy-techniques/{types.ts,lib/validation.ts}`
- **Higgsfield generation tracker:**
  `public/module-assets/v1/rigid-bronchoscopy-techniques/manifest/generation-history.json`
- **Learner UI:** `src/features/rigid-bronchoscopy-techniques/components/*`
- **Routes:** `src/app/[locale]/rigid-bronchoscopy/techniques/{page.tsx,[lessonId]/page.tsx}`

### Asset layout

```
public/module-assets/v1/rigid-bronchoscopy-techniques/
  manifest/            generation-history.json (Higgsfield job tracker)
  references/          equipment/ manikin/ operator/ anatomy/
  hero-frames/         selected image-to-video start frames
  clips/               draft/ approved/   (raw MP4/WebM — git-ignored, uploaded to Supabase)
  lessons/             draft/ approved/   (assembled micro-lessons)
  posters/             poster stills (committed; small)
  captions/en/         WebVTT (committed)
  transcripts/en/      narration transcripts (committed)
  audio/en/            narration audio (git-ignored, uploaded)
  qa/                  contact-sheets/ review-records/
```

**Media in git:** the repo already globally ignores `*.mp4` / `*.webm` / `*.mov`
(root `.gitignore`) and allow-lists specific approved paths. Raw technique video
therefore stays out of git by default and is uploaded to Supabase Storage and
resolved at runtime through `resolveModuleAssetUrl` (module prefix
`rigid-bronchoscopy-techniques`). Source-controlled: manifests, captions,
transcripts, posters, prompts, and checksums for remote media. No new
`.gitignore` rule is required.

## Production specifications

- Aspect ratio **16:9**; final **1080p**; drafts lowest practical preview res.
- Individual clip **~4–10 s**; final micro-lesson **~45–120 s**.
- Fixed or slowly moving documentary camera; deep focus keeping hands, barrel,
  and mouth visible; neutral OR instructional lighting.
- Audio disabled during generation; **no** generated text/labels; no dramatic
  effects or excessively shallow depth of field.
- **One major movement per generation.** Do not ask one generation to show oral
  insertion + cord passage + mainstem intubation + coring + extraction.
- Global prompt + negative constraints: [`prompts/global-style.md`](./prompts/global-style.md).

## Shot list

Prototype first (`mainstem-direction`), then the library. `H` = Higgsfield,
`3D` = validated 3D render, `ASM` = assembled from approved clips.

### Lesson 6 — `mainstem-direction` (PROTOTYPE — build & approve before the rest)

| Shot            | Source | Side  | Purpose                                                     |
| --------------- | ------ | ----- | ----------------------------------------------------------- |
| RB-NAV-001      | H      | n/a   | Neutral distal tracheal hero frame                          |
| RB-NAV-L-001    | H      | left  | External: head + proximal barrel toward patient **right**   |
| RB-NAV-L-002    | 3D     | left  | Internal: proximal right → distal tip aligns **left**       |
| RB-NAV-R-001    | H      | right | External (separately validated — never a flipped left clip) |
| RB-NAV-R-002    | 3D     | right | Internal: proximal left → distal tip aligns **right**       |
| RB-NAV-ERR-001  | H      | n/a   | Dental-fulcrum error; freeze before force                   |
| RB-NAV-QUIZ-001 | H      | n/a   | Clean freeze frame (no text) for retrieval question         |

### Library (Phase 6 — only after prototype QA)

| Lesson                   | Shots                                          |
| ------------------------ | ---------------------------------------------- |
| 1 `positioning`          | RB-POS-001 (H), RB-POS-002 (H), RB-POS-003 (H) |
| 2 `oral-entry`           | RB-ORAL-001 (H), RB-ORAL-002 (3D)              |
| 3 `glottic-passage`      | RB-GLOTTIS-001/002/003 (H)                     |
| 4 `tracheal-advancement` | RB-TRACH-001 (H), RB-TRACH-002 (3D)            |
| 5 `scope-manipulation`   | RB-MOVE-001/002/003 (3D)                       |
| 7 `apple-coring`         | RB-CORE-001 (H), RB-CORE-002 (3D)              |
| 8 `unsafe-mechanics`     | RB-UNSAFE-001/002 (3D)                         |
| 9 `integrated-sequence`  | RB-SEQ-001 (ASM)                               |

## Hero-frame workflow (per shot)

1. Generate/prepare the starting hero frame; verify instrument shape, hand count,
   patient + camera orientation, dental protection when visible.
2. Record the selected image-generation ID in `generation-history.json`.
3. Use the still as the image-to-video input (defined end frame when supported
   and it improves directional reliability).
4. No more than **three** draft variations per hero frame without documenting why.

## Postproduction

All text is deterministic and added in post: title cards, direction arrows,
patient-left/right markers, bevel highlighting, freeze frames, slow-motion
replays, chapter transitions, the `Synthetic procedural visualization` label,
safety callouts, captions, and the narration track. Narration is written
precisely in advance (never Higgsfield dialogue) and uses hedged wording where
technique varies among experts.

## Validation & gating

- `npm run validate:rigid-technique-media` validates `generation-history.json`
  (no fabricated media; delivered shots resolve to real files).
- Jest (`src/features/rigid-bronchoscopy-techniques/__tests__`) validates the TS
  manifest and the deterministic publication rule (`canPublishClip`).
- The production learner route shows **only** publishable clips (approved +
  medically verified + left/right verified for side-specific). Drafts appear
  only outside production, behind a review badge.

## Clinical review

Every clip is reviewed against [`clinical-review-checklist.md`](./clinical-review-checklist.md).
Only the physician owner or a designated faculty reviewer may set
`medicalAccuracyVerified = true`. The prototype ships at
`reviewStatus: "faculty-review"`, `medicalAccuracyVerified: false`,
`leftRightVerified: false`.
