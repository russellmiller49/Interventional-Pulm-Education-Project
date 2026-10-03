# BF-PRE-REVIEW-03 — readable images and coherent scope workspaces: handoff

**Batch scope:** lane 03 of the Bronchoscopy Foundations fellow-walkthrough package — instrument
and teaching-still enlargement and accessibility (A18, A20, A28, A29, SUP-13), the five-controls
bench (A21, A22, SUP-08), live-airway labels, frames and help (A24, A30, SUP-09), the phone and
enlarged-text scope workspace (A37), the S7 CT/still comparison (A25), the S20 cross-section (A33)
and the visual part of A2. **No clinical approval, no source, media or anatomy review, no
real-learner validation, no release, no deployment and no merge is claimed or performed.** Lane 04
(teaching and survey flow) and lane 05 (media and clinical decisions) are not started.

**Status, 2 October 2026.** Independently reviewed at `4126103b`: four P2 blockers reproduced,
the rest accepted. The four are repaired in "Independent review repair" below (code
`c9f4477d`); the branch awaits independent re-review. Not merged, not deployed.

The walkthrough this repairs is Claude in a first-year-fellow persona, not a fellow, technologist
or faculty reviewer. Its severity labels are kept as its own; the dispositions below are this
batch's. "Image larger" is not anatomical approval: every image here keeps its pending review
status.

## Repository reconciliation

| Field                   | Recorded value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base SHA                | `756c9aee7d7119f3817b5d85aaf73f9efa573418` — `origin/main` fetched 2026-09-28 at the start of this batch (merge of PR #285). The Batch-02 post-merge verification main `2bc539f4` (merge of PR #280) is an ancestor. The planning SHA `77a141cc` was not restored.                                                                                                                                                                                                                                                                                                                                                                                |
| Checkout and branch     | `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/claude-bf-pre-review-03`, a new worktree created from `origin/main` for this batch; branch `claude/bf-pre-review-03-9-25`. Neither prior BF worktree was reused. The session itself was opened in `…-Worktrees/codex-bf-04` (branch `codex/bf-04`, clean, at main, with a Codex process holding it as its working directory); nothing was written there.                                                                                                                                                                                                                   |
| Batch 01 and 02 present | At the base: `__tests__/simulation-truth.test.tsx`, `goal-truth.test.tsx`, `scope-playback.test.tsx`, `sources-and-reading-view.test.tsx`, `actions-and-feedback.test.tsx`, `engine/scope/goalPresentation.ts`, `ENVIRONMENT_CLOCK_SCRIPTS`, `ReadingTheViewTable`, `verdictWords.ts`, and the `BF-PRE-REVIEW-01` and `-02` handoffs and dispositions (merges `96291d71`/PR #254 and `8ae2ecc9`/PR #274).                                                                                                                                                                                                                                         |
| Ownership check         | Open PRs at start: #290 (MV), #289 (Socrates), #284 (MCS), #279 (PI), #273 (BBT), #134 (older critical-care branch that edits `AnswerVerdict.tsx`; not touched), #114 and #98 (literature). No open PR holds a BF branch; the only other BF-named branches are `claude/bf-03` (stale, local) and `codex/bf-04` (no commits beyond main). Every changed file is under `src/features/bronchoscopy-foundations/**` or `e2e/bronchoscopy-foundations.spec.ts` — the BF lane's surfaces in `PI_EBUS_BBT_BF_COORDINATION.md`. No shared stage, `AnswerVerdict`, `HelpDialog`, global CSS, other module, Device Intelligence or `public/` asset changed. |
| Instructions read       | `AGENTS.md`, `CLAUDE.md`, `docs/local-authoring-assets.md`, `docs/gap-remediation/self-paced/README.md`, the SYSTEMIC-UX-01/02 handoffs (BF parts), the `BF-PRE-REVIEW-01/02` handoffs and dispositions, and in place in Local-Data: `00_START_HERE.md`, `03_BF_WORKBENCH_AND_VISUALS.md`, `FEEDBACK_LEDGER.md` / `feedback-ledger.json`, `PI_EBUS_BBT_BF_COORDINATION.md`, `SOURCE_AND_CODE_NOTES.md`, `OWNER_DECISIONS.md` and the walkthrough DOCX (SHA-256 `3bac73ed…d30aa`, figures 3.1, 5.1, 5.2, 6.2, 7.1, 9.1, 9.2, 10.1, 10.2, 20.1, X.1).                                                                                               |
| Ports                   | **3143** — the unchanged base, production build `UNI1BRS7GvfPS-DHqZx9n` served standalone from a copy outside the checkout; **3144** — this branch, final build `IbUgl6424100pTpX6vN9N`. Chosen because no `.claude/launch.json` in any checkout names them (those use 3001, 3010, 3120–3136, 3213, 3214, 5173, 8099) and nothing listened on them.                                                                                                                                                                                                                                                                                               |
| Environment             | Node 26.5, Next 16.2.2 `next build --webpack` via `npm run build` with an 8 GB heap and placeholder public Supabase variables (no `.env.local` in this worktree; none read or written). Playwright 1.62 Chromium, isolated contexts, `/api/analytics` stubbed by the suite. Evidence: `Interventional-Pulm-Local-Data/renders/output/bf-pre-review-03-2026-09-28/{baseline,after,logs}/`.                                                                                                                                                                                                                                                         |
| Not done                | No `.env.local` access, no owner-profile session, no production data write, no paid API call, no merge, no deploy, no Batch 04 work.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Inventory and reproduction on the base build, before any edit

All on `/en/bronchoscopy-foundations/learn?section=…` of the base production build, native input,
measured by `logs/inventory.cjs` (useful-content geometry, not container size).

| Family / route                          | Task and renderer                                                                               | Source identity                                                                                                                                | Controls and instruction                             | Measured on the base                                                                                                                                                                                                                  | Known limitation                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| S3 `pre-use-check`, Part 3              | Identify set `scope-parts`; `BronchIdentifyControl` → `MediaFigure` (img + SVG polygon overlay) | `scope-photo-atlas.json` (CVAT polygons), `full-scope.png` 2100×1500, `suction-valve-setup.png` 754×1100, `biopsy-adapter-setup.png` 1050×1504 | 8 radio sets; "choose the name of the outlined part" | Outline on screen, views 2/3/6/8: **21×35, 12.8×13.5, 17×17, 42×48 px** at 1204×987; 11.8 px (view 3) at 1024; 9 px at 390; 7 px at 320. No enlarge control. All 8 `alt` = "A photograph of the bronchoscope with one part outlined". | Part identity is the atlas's; five names not in the overview (A19, batch 04) |
| S9 `larynx-and-entry`, Part 1           | Media workspace, one still                                                                      | `airway-quiz-frames.json` `larynx` (820×647 file, 1368×1080 manifest space)                                                                    | Caption only                                         | Caption: "…one still from the course's **annotated** normal survey…" with nothing drawn; image 1038×819 at 1204; no zoom; the corner rectangle is baked into the file                                                                 | Epiglottis out of frame; false folds/arytenoids/orientation unverified       |
| S9 Part 3                               | `ScopeScene` larynx-entry                                                                       | larynx GLB/JSON                                                                                                                                | Advance/withdraw/rotate/deflect/declare              | "Scope view" label clipped to "…ew" by the lens vignette (`s9-scope-label.png`); Part 4 titled "Identify the structures in view" but asks when to cross                                                                               | Close-up pink-ring geometry (A2 human boundary)                              |
| S10 `right-side`, Part 1                | `NormalAirwayTour`, one still + `<select>` of 15                                                | Quiz-frame stills and polygons                                                                                                                 | Dropdown                                             | RB1 outline 160×51 at the top edge, RB6 63×103 bottom right, RB10 100×55 (1204); one control; no frame statement                                                                                                                      | Stills carry no orientation/roll metadata                                    |
| S5 `five-controls`, bend and rotation   | `ScopeScene` bench + control-head and bending-section close-ups                                 | `bench.glb`, `control-head.glb/json`                                                                                                           | Deflection slider ±120°, rotation −179…180°          | Lit share of the scope view: **0.118 at 0°, 0.133 at 15°, 0.124 at 30°, 0.003 at ±60° and ±120°** — black, direction unreadable; at 30° bend the side view is foreshortened at 90° roll; U/D marks on the faceplate a few pixels tall | Bench is a teaching card, not an airway                                      |
| S6 `branch-entry`, Part 3 at the carina | `ScopeScene` guided walk, in-view labels on                                                     | Teaching graph ostium points                                                                                                                   | 31 Advance presses to the carina                     | LMSB/RMSB captions 17 px apart (1204), 19 (1024), 15 (390), on the ridge; no frame on either view; "Show me where" spotlights **Advance** for "enter the right main bronchus"; keyboard help collapsed                                | Openings not dark at the carina (rendering/anatomy, unchanged)               |
| S10 Part 3                              | Guided walk, labels off                                                                         | —                                                                                                                                              | No labels control                                    | "Show me where" spotlights **Advance** although the tip starts in the bronchus intermedius and the goal needs the RUL origin; no way to see names                                                                                     | —                                                                            |
| S6 Part 3 at 390×844                    | Course layout                                                                                   | —                                                                                                                                              | —                                                    | View top 916, dock 1203, the pane's duplicate goal list 1573 (5 rows), the Now card's ticking checklist **2089** — 1,173 px below the view                                                                                            | —                                                                            |
| S7 `reference-frames`, Part 2           | `MediaWorkspace`, 2 figures stacked                                                             | `airway-survey-ct.json` `rmb` axial (512×512, case-001 preview volume, slice 126 of 212), quiz still `rmb`                                     | Caption                                              | CT 1038×1038 and still 1038×819 **stacked: union height 1868 px** at 1204×987, 1730 at 1024×768, 1869 at 1440×900                                                                                                                     | Not a registered pair; one slice for a five-level trace                      |
| S20 `scope-in-a-tube`, Part 2           | Tube mode, observer "Tube cutaway"                                                              | Authored 8/6 mm and 7.5/6.2 mm                                                                                                                 | Readouts only                                        | No cross-section; longitudinal cutaway 157×195 px; readouts 0.44 / 22 mm²                                                                                                                                                             | Geometric teaching values only                                               |

## Root causes

- **A18, A20, A28, SUP-13.** `MediaFigure` drew the whole file at the column's width with its
  polygon and nothing else: no enlargement, and `mediaDescription()` returned one sentence per media
  kind, so all eight S3 views shared an alternative. The larynx and S13 captions were authored as
  "annotated" although those still refs set `outline: false`. The S9 check chunk kept a generic
  title. The view label had no stacking order above the later `.lens` vignette.
- **A29.** `NormalAirwayTour` was one still behind a 15-option `<select>`.
- **A21, A22.** The bench view renders only what the optical frame sees; beyond about 45° the card
  leaves the 88° field, and the side-view close-up is a single projection. Nothing reported the
  frame itself. The model is correct; its direction was simply not shown.
- **A24.** `layoutOpticalLabels` moved the second caption 32 px vertically when two overlapped, so
  at the carina both captions stayed on the ridge between the two ostium points. Neither view
  stated its frame.
- **A30.** `goalControlKey` read only a goal's first clause: every `location`, `ledger-complete`
  and unlisted event mapped to Advance, and an event sequence used `events[0]` even after that
  event had happened.
- **A37.** `ScopePaneFrame` printed the whole goal list after the controls, readouts and
  performance line; on a phone the ticking list on the Now card followed the teaching column.
- **SUP-09.** The key map (W/S/A/D, arrows, Space and more, held keys repeating) was already live;
  the text sat in a closed `<details>`, named only five keys, and did not say a key works only with
  the scope view selected.
- **A25.** `MediaWorkspace` stacked every figure at full column width.
- **A33.** No cross-section existed; `annularArea` fed only the readouts.

## What changed

| File (under `src/features/bronchoscopy-foundations/`)                                                                                                                        | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/stage/MediaFigure.tsx`, `MediaEnlargeDialog.tsx` (new), `mediaDetail.ts` (new), `bronch-stage.module.css`                                                        | One resolver for the three manifests; a real **Enlarge** button on every figure opening a native modal dialog (Escape/Close, focus back to the button) with the same file and outline at viewport size; a **detail window** for any registered outline under 15% of its photograph, cut from the same file in its own coordinates (square, 2.4× the outline, inside the photograph) with a dashed mark on the whole photograph; item-specific `alt`; "the same file and outline… nothing is added"; the processor-rectangle note on stills; no "annotated" wording for unmarked stills. |
| `content/types.ts`, `content/sectionValidation.ts`, `content/sections/pre-use-check.ts`                                                                                      | Identify rows gain `mediaDescription` (where the outline sits, never the keyed name — the validator refuses one that contains it) and `partNote` (one line, condensed from the row's own sourced rationale).                                                                                                                                                                                                                                                                                                                                                                            |
| `components/stage/BronchIdentifyControl.tsx`                                                                                                                                 | Per-view alternatives, "Enlarge view N of 8", and a **text reference** of the eight parts in alphabetical order (so its order gives nothing away), open before any answer.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `content/sections/larynx-and-entry.ts`, `describe-findings.ts`, `content/courseFlow.ts`                                                                                      | Captions say nothing is marked on those stills; the S9 check is titled "Decide when to cross the glottis" (id unchanged).                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `components/stage/BronchCourseTeaching.tsx`, `course-flow.module.css`                                                                                                        | Tour navigated by the tree's own groups (airways before the segments, then each lobe's segments), a same-group side-by-side comparison, Enlarge on every still, "Frame not recorded…", and the trachea no longer listed as its own parent.                                                                                                                                                                                                                                                                                                                                              |
| `content/types.ts`, `content/sections/reference-frames.ts`, `components/stage/MediaWorkspace.tsx`, `BronchStageHost.tsx`                                                     | Media workspaces may carry per-image notes and a comparison note; two or more images sit side by side at `min(52vh, 30rem)` tall (stacked on a narrow screen). S7 notes say what each file establishes and that the pair is not registered and the panel shows one slice.                                                                                                                                                                                                                                                                                                               |
| `engine/scope/benchOrientation.ts` (new), `components/scope/TipCompass.tsx` (new), `ScopeScene.tsx`, `BenchSchematic.tsx`, `ScopeOpticalView.tsx`, `BronchoscopeCloseup.tsx` | The tip end-on: angle and direction from the engine's optical frame, U/D from the rolled frame, rings every 30° to the model's 120° limit, words for each; "the card is outside the field of view… this is the bench, not a lost view of an airway" when its centre leaves the round field; the control head's existing U/D marks drawn at a legible size in their existing places.                                                                                                                                                                                                     |
| `components/scope/scopeSceneModel.ts`, `ScopeScene.tsx`, `ScopeFallback.tsx`, `TreeMap.tsx`                                                                                  | Caption declutter pushing crowded captions outward from the openings' centroid and clear of every other opening's point, with a dot and leader at the model's projected ostium point; **A/L rim ticks** from the model's LPS frame (hidden when a direction points nearly along the view, and while a tree question is open); a legend under the controls; the map states it is a coronal front view.                                                                                                                                                                                   |
| `engine/scope/goalHelp.ts` (new), `BronchStageHost.tsx`, `components/scope/types.ts`                                                                                         | Goal help: the first unmet requirement; for an opening, withdraw when it is behind the tip, **Advance only when the reducer itself, run on a copy, enters it**, otherwise rotate or deflect by the align-to-branch math (`aimAt` from the tip's base frame along the branch direction). The spotlight, the sentence and a ring on the named opening; **opening names on request** where a step has no labels control of its own; both withheld while the engine withholds names (`unfamiliar-clear`).                                                                                   |
| `components/scope/ScopeFallback.tsx`, `scope-fallback.module.css`, `scope-scene.module.css`                                                                                  | The pane's duplicate list replaced by **one current-goal card** (heading, the goal, the help sentence, "where the tip is now", the model's limit, a link to the full list) directly above the view on airway steps; on the five-controls pilot bench it follows the controls, keeping the SYSTEMIC-UX-01 bench geometry. The end-on drawing also follows the controls there. The "Scope view" label above the vignette. The larynx view shows the folds' phase from `CORDS_STATE_WORDS`.                                                                                                |
| `components/scope/scopeKeyMap.ts`, `ScopeScenePane.tsx`                                                                                                                      | A visible key line beside the dock built from `SCOPE_KEY_MAP` and the step's controls, saying held movement keys repeat and Advance/Withdraw can be pressed and held. No key behaviour changed.                                                                                                                                                                                                                                                                                                                                                                                         |
| `engine/scope/scopeMetrics.ts`, `components/scope/TubeCrossSection.tsx` (new)                                                                                                | `tubeGeometry()` — the two authored diameters, their radii and `annularArea` — now feeds both readouts and a **to-scale cross-section** in millimetres, with its limit and no open area drawn for an impossible pairing.                                                                                                                                                                                                                                                                                                                                                                |

## Source identity, hashes and derived assets

No file under `public/` changed (`git diff --name-only 756c9aee HEAD -- public` is empty), and **no
derived asset was created**: the detail windows are the source files drawn through an SVG viewBox
at run time. Nothing was upscaled into a new file, painted, re-labelled, cropped to disk or
replaced. The files the changed views display, SHA-256 (full list in `logs/media-hashes.txt`):

| File                                                             | SHA-256                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `public/intro-bronchoscopy/scope-anatomy/scope-photo-atlas.json` | `f1d0608f77d025e5839418bb35e748cd67192e898e42a4b5c5dd026f03c6e29b` |
| `…/scope-anatomy/full-scope.png`                                 | `894d1c582cf802d708c80e7c1b99aae20a34c74738771ee85cfc327bea67ee36` |
| `…/scope-anatomy/suction-valve-setup.png`                        | `5c97a8d39655e8fb6226b2787d2fc3cc219166be6ab79cb5bbeebb1f3bcad600` |
| `…/scope-anatomy/biopsy-adapter-setup.png`                       | `c237f8699ebe6b71ab2337a89e46a5d81b71c4cdd34be494869cc56251b01c95` |
| `public/airway-lesson/airway-quiz-frames.json`                   | `4970b9f814c87d4f…` (full value in the log)                        |
| `public/airway-lesson/airway-survey-ct.json`                     | `ed63f8607abd9322…`                                                |
| `public/airway-lesson/quiz/larynx.jpg`                           | `81233827f38a230c…`                                                |
| `public/airway-lesson/ct/rmb-axial.jpg`                          | `fdf7750350e6445b…`                                                |

The control head's U/D marks are drawn by the module's own canvas code (`DirectionMarkings`), not
a source asset; their letters are larger, their places and convention (D at the top of the arc, U
at its foot, "Lever toward U" = positive deflection = toward the image top) unchanged.

## Measured after the repair (final build, same pages and sizes)

**S3 (A18, A20)** — outline width × height on screen:

| Viewport | View 2 whole / detail | View 3 whole / detail | View 6 whole / detail | View 8 whole / detail |
| -------- | --------------------- | --------------------- | --------------------- | --------------------- |
| 1204×987 | 12.6×20.7 / **48×79** | 7.5×7.9 / **58×61**   | 10×10 / **79×79**     | 25×28 / **71×79**     |
| 1024×768 | 11.6×19 / **44×73**   | 6.9×7.3 / **54×56**   | 9.3×9.3 / **72×72**   | 23×26 / **65×73**     |
| 390×844  | 15×25 / **65×106**    | 9×9.5 / **78×82**     | 12×12 / **105×105**   | 30×33 / **95×106**    |
| 320×740  | 12×20 / **65×106**    | 7.2×7.5 / **78×82**   | 9.6×9.6 / **105×105** | 24×26 / **95×106**    |

At 1204 and 1024 the whole photograph on the card is about 60% of its former width, beside the
detail; at full width it is one press away (the enlarged view shows the whole photograph at about
2.2× the card and the detail with view 3's outline over 100 px). Registration error between drawn
polygon and the file's polygon scaled to the image box: under 1.5 px on the card, after resizing to
760 px and in the dialog. Eight distinct alternatives at every size.

**S5 bench (A21, A22)** — end-on reading from the engine frame, unchanged model: 0° centre; ±15°
toward the card's top/bottom; ±60° 60° toward top/bottom with "card outside the field"; ±120°
120°, beyond the 90° ring. At 30° bend: U toward the card's top/right/bottom/left at
0/90/180/270°, angle 30° throughout. `data-lever-deflection`, `data-handle-rotation` and the drawing
agree at every sampled state. The rotation sentence is checked against the projection (a point at
the card's top lands at the image's left at 90° clockwise).

**S6 carina (A24, A30, SUP-09)** — caption gap 17 → **51 px** (1204), 19 → **61** (1024), 15 → **46**
(390); both captions carry a dot and leader to their own ostium point; A and L on the rim turn
90° with a quarter turn of the control section (±8°); "Show me where" after the carina: Advance →
**"Rotate counterclockwise: the opening of the right main bronchus is off the plane the lever
bends in."** with the rotation control and the RMSB opening ringed; following the advice step by
step enters the right main bronchus in the browser. Over 144 sampled states (two targets, six
deflections, twelve rotations) help says Advance exactly when the engine then enters the opening.

**S10 (A30)** — at the start of Part 3: Advance → **Withdraw**; "Show the opening names" draws dashed
names; the input-mode and assists attributes, the goal rows and the device record are unchanged;
the performance line says "opening names shown for reference".

**Phone and enlarged text (A37)** — at 390×844 the pane shows one current goal directly above the
view (only the view's own tabs and review line between), and the goal, the view and Advance fit on
one screen below the site header (asserted at 390 and 320); the full list is one link away and
takes focus; a focused Advance stays below the header and on screen at 390/320 and at 200% root
text; the course region has no horizontal overflow. At 200% root text the card is tall (the limit
sentence wraps), and the page scrolls, as permitted.

**S7 (A25)** — union height of the two images 1868 → **478 px** (1204×987), 1730 → **397** (1024×768),
1869 → **466** (1440×900), side by side, tops level; stacked at 390. Both frame notes and the
comparison note present.

**S20 (A33)** — cross-section rendered at both pairings: scope/tube circle ratio 0.75 and 0.827 to
two decimals, tube circle over 120 px; readouts and caption both 22 mm² / 0.44 and 14 mm² / 0.32.

**Themes** — the new surfaces render identically under the site's light and dark themes (the
module's fixed dark palette): card text rgb(234,244,244) on rgb(11,26,38), secondary text
rgb(177,195,210), dialog rgb(234,244,244) on rgb(6,21,25) (`after/theme-*.png`).

## Preserved contracts (Batch 01, Batch 02 and earlier)

Verified by the complete BF Jest suite and the complete BF browser suite on the final build:

- Brush demonstration: the intentional first misreport and the refusal to move an exposed
  accessory (`the worked accessory exchange keeps its false report and still ends protected`);
  no accessory or engine rule touched.
- Environmental clock and time as nobody's work: `scopeScripts.ts`, `useScopePlayback.ts`,
  `stageSession.ts` and `scopeReducer.ts` unchanged; the breath and carina-hold browser cases pass
  in ordinary and reduced motion; the closed-fold guard case passes. The larynx phase cue reads
  the same `inputs.cords` the guard reads.
- Historical versus current goal semantics and the inspection ledger as history: `goalPresentation`
  wording unchanged; the pane card carries the same heading, claim class and limit (the
  goal-truth guard now asserts them on the card); the overshoot and inspection-record browser
  cases pass.
- Optical accessibility naming: `opticalViewName` untouched; ticks and the off-card note are
  `aria-hidden` with the words in the drawing's caption and legend. No visible-lumen judgement:
  help reads geometry and the reducer's own outcome, never the picture.
- Batch 02: source classes and PDF-page wording, the source list clear of the continuation, the one
  Reading-the-view table, the S4 primary Check, S15/S18/S19 Decide → feedback → Continue with the
  unsafe move refused and nothing forced, the S1 question kept above the shared AnswerVerdict and
  the matching feedback — all their browser cases pass unchanged.
- Self-paced: explanation first, retry, skip that records nothing, no scores, no counts; help and
  reference names record nothing (asserted). Stable ids: no section, step, item, row, goal or
  control id changed; one step title changed. Legacy storage meanings unchanged.
- The owner-held lavage key, every source, media, anatomy and local-policy hold: unchanged.
- The known pre-existing 3D restore defect (schematic fallback → `loading`) is not touched.
- SYSTEMIC-UX-01 bench geometry: the five-controls bench stays on screen at entry on a phone and
  within 680 px of Advance (its seven systemic checks pass).

## Validation

Commands were read from `package.json` and the Playwright configs. Unique tests are counted once;
reruns are listed separately.

| Check                                                                                                                              | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx jest src/features/bronchoscopy-foundations 'src/app/[locale]/bronchoscopy-foundations' --runInBand`, pristine base `756c9aee` | 32 suites, 446 passed, 1 todo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| the same at the final head                                                                                                         | **34 suites, 488 passed, 1 todo** (42 new cases in two new files; one existing case rewritten — the goal-truth pane guard; the todo is the pre-existing larynx/trachea one)                                                                                                                                                                                                                                                                                                                                                                                                                            |
| New and changed Jest cases against the unchanged runtime                                                                           | **17 of 43 fail.** Run in a detached worktree at the base with the new test files and only additive shims the base runtime never calls (the new modules `benchOrientation`, `goalHelp`, `mediaDetail`, `TipCompass`, `TubeCrossSection`, and appended exports `tubeGeometry`, `scopeKeyboardHint`, `patientDirectionTicks`, `tourGroups`). The 26 that pass are unit tests of those shimmed helpers (25) and the guard that no reference names are offered where a step has its own labels (1); their runtime fail-before comes from the browser run. Per-test results in `logs/failbefore-jest.json`. |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`                                                                          | exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `npx eslint --max-warnings=0` on every changed `.ts`/`.tsx` (33)                                                                   | 0 errors, 0 warnings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `npx prettier --check` on every changed path (37)                                                                                  | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `git diff --check 756c9aee HEAD`                                                                                                   | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npm run build`                                                                                                                    | exit 0 at the base (`UNI1BRS7GvfPS-DHqZx9n`) and at the final head (`IbUgl6424100pTpX6vN9N`); the "Compiled with warnings" block is byte-identical (a third-party `vscode-languageserver-types` dynamic-require notice) plus the embedded apps' Vite chunk-size notes                                                                                                                                                                                                                                                                                                                                  |
| Playwright BF suite on the final build                                                                                             | **61 unique tests, 61 passed** in one clean run (50 existing, 11 new)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| The 11 new browser cases against the base build                                                                                    | **11 of 11 fail** for the repaired reasons (non-unique alternatives, "annotated", no drawing, no key line, help says Advance not Withdraw, no goal card at four sizes, S7 images 1,050 px apart, no cross-section)                                                                                                                                                                                                                                                                                                                                                                                     |
| Systemic-UX checks that load BF (`bf:` × 6 sizes and "all nine public entry routes"), final build                                  | 7 passed (base: 7 passed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Reruns and intermediate builds, not counted again: draft builds `Q99nAqX…`, `oe8a9DD…`, `KKIyzbZ…`
and `6l1oxjY…` preceded the final one. On `oe8a9DD…` the new cases first ran 8/11: two were
test-harness faults (a float compared to the six-decimal serialisation of a style value;
Playwright does not treat a disabled `<fieldset>` as disabled, so the attribute is asserted), and
one was real — views 2 and 8 were under 40 px in the detail at narrow widths, which led to the
2.4× context and the stacked detail below 22rem. On `KKIyzbZ…` the full suite ran 60/61 (the S3 case measured
the dialog's whole photograph instead of its detail; test-only fix, then passed). The systemic
check then failed on `KKIyzbZ…` (bench-to-Advance span 747 px with the drawing and card between)
and on `6l1oxjY…` (the bench left the screen at 390/320/200% with the card above it); both were
real regressions of SYSTEMIC-UX-01 geometry, fixed in source (`290255ad`), then 7/7. On the final
build the four phone/enlarged-text cases first failed on a fixed 60 px gap assumption that ignored
the view's own tabs and rem-based gaps; the bound was changed to the measured view header, then
4/4, then the clean 61/61 run above.

Browser acceptance used real routes of the production build with native pointer and keyboard input
(clicks, keyboard slider presses, W and ArrowUp on the selected scope view, Enter/Escape on the
dialog, typed focus); no reducer injection, forced clicks, fabricated captures or always-open folds.

## Independent review repair (2 October 2026)

The independent pre-merge review of head `4126103b3d67a4377b235c4670a7dc0712caecb8` (this branch
with `origin/main` `46c5bb94` merged in) reproduced four P2 defects and accepted the rest of the
batch. This section records the bounded repair of those four and nothing else. No accepted area was
redesigned, no owner or source hold was resolved, nothing was merged or deployed, and Batch 04 was
not started. Where an earlier section of this handoff says more than the reviewed build did, the
correction is listed under "Statements this repair corrects" below; the earlier text is left as the
record of what was claimed at the time.

| Field           | Value                                                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reviewed head   | `4126103b3d67a4377b235c4670a7dc0712caecb8`, production build `DFHwTB0JTl-OKF0VGOfYL`, served on **3143** from a copy outside the checkout                                                                                                                                |
| Repair code     | `c9f4477de56bc76c501f7593465007f29b032a7a`, production build `9jpWZv3QtfOj_kknLKuPG`, served on **3144**                                                                                                                                                                 |
| `origin/main`   | `f962a3819b5e8d946de59b2401532a3ed681ae6a` at the fetch for this repair. **Not merged:** `git diff --name-only 46c5bb94 origin/main` lists 36 files, none under BF, the shared learning-module, the BF e2e spec, launch or build/package configuration                   |
| Changed runtime | Nine files, all under `src/features/bronchoscopy-foundations/`; no shared stage, `ModuleFrameV2`, `AnswerVerdict`, `HelpDialog`, global CSS, public asset, media file, manifest or other module                                                                          |
| Evidence        | `Interventional-Pulm-Local-Data/renders/output/bf-pre-review-03-2026-09-28/review-repair-2026-10-02/{before,after,logs}/` — the per-frame samples, accessibility trees, measured image sizes and screenshots from both builds, and the Jest and Playwright logs for both |

### Blocker 1 — "Show me where" kept advice for a goal already met (A30)

- **Reproduction (reviewed build, S6 Part 3, 1204×987).** Show me where, then advance until the
  carina goal is met. The goal the step is waiting for becomes "enter the right main bronchus"; the
  help still reads "Advance down the trachea to the main carina." and Advance is still lit.
  Pressing Highlight it again gives the correct rotation advice.
- **Root cause.** `firstUnmetHelp` in `BronchStageHost` was already computed on every render from
  the current goal statuses and scope state, but `showWhere()` copied its control, target and
  sentence into the `spotlight` state, and the pane drew that copy until help was asked for again.
- **Repair.** The stored state is now only "help is on for this step" (and the control to focus
  once, at the moment of asking). What the pane shows — sentence, lit control, ringed opening — is
  `firstUnmetHelp` itself, read on every render (`helpNow`). `goalHelp` was not changed. Help ends
  on a reset (a new attempt), on leaving the step (Back, Continue, Continue without completing) and
  has nothing to show once every goal is met.
- **Focus.** The focus moves to the control when help is asked for and never when the advice
  changes afterwards: moving it then would hand the learner's next key press to a different control.
- **Before / after (production builds, same steps, no second request).**

  | After…                                | Reviewed build                                               | Repair                                                                                             |
  | ------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
  | Show me where at the start            | "Advance down the trachea to the main carina." · Advance lit | the same                                                                                           |
  | the carina goal is met                | the same sentence · Advance still lit                        | "Rotate counterclockwise: the opening of the right main bronchus is off the plane…" · Rotation lit |
  | following the advice on the same goal | not reachable without asking again                           | Rotate → Deflect → Advance, each as the state makes it the useful control                          |
  | the right main bronchus is entered    | —                                                            | the next goal's help: Withdraw lit                                                                 |
  | Reset the scope                       | the stored sentence stays                                    | no help shown; Show me where is offered again                                                      |
  | Back, then return to the step         | the stored sentence returns                                  | no help shown; Show me where is offered again                                                      |
  | every goal met                        | the stored sentence stays under "all recorded"               | no help shown, no control lit, no help button                                                      |

- **Preserved.** Help sends no scope command, records no input mode or assist, meets no goal, marks
  no opening seen or airway inspected and writes nothing to the device record: an attempt with help
  asked for three times ends in a byte-identical scope state, goal list and record (less its
  timestamp) to the same attempt without it. The opening-names reference is a separate state and
  was not touched.
- **Files.** `components/stage/BronchStageHost.tsx`.
- **Regression.** `__tests__/review-repair-help.test.tsx` (7 cases on the real host: the S6
  transition; control change within one goal; focus; every command of the whole step; reset; leave
  and return; nothing written). Browser: `review repair 1`.

### Blocker 2 — the end-on tip drawing ran ahead of the animated bench (A21, A22)

- **Reproduction (reviewed build, S5 rotation lesson, ordinary motion).** Try with guidance,
  deflection 0°, press End. The end-on drawing is at 120° on the first frame; the control head and
  bending section take about 220 ms to get there.
- **Root cause.** The 3D scene held its own displayed state (`useBenchPresentation`, called inside
  `ScopeScene`) and interpolated it; `TipCompass` is drawn by the pane frame outside the scene and
  was handed the reducer's state.
- **Repair.** One displayed bench state. `useBenchPresentation` is now called once, by the pane
  (`ScopeScenePane`), and that one object is handed to the scene (scope view, control head, bending
  section, the note over the scope view, the lever's caption) and to the frame for `TipCompass`.
  Interpolation, its 220 ms duration and easing, the deflection and rotation semantics, the model
  geometry and the reducer are unchanged, and nothing is delayed: the sliders, readouts, target
  status and goals still read the model's own state, which is where the learner's command already
  is. When a transition ends, the displayed state is now the model's state value for value (a turn
  taken the short way round used to settle at 270° where the model says −90°). The schematic view
  has no transition, so there the drawing reads the model's state directly, as the picture does.
- **Before / after, per animation frame (production builds, Chromium, native End key; the control
  head's reading is `data-lever-deflection`, the drawing's is the tip mark's distance from centre
  × 120°).**

  | Reviewed build: ms after the press | 4    | 65   | 116    | 161    | 201    | 242     | 284  |
  | ---------------------------------- | ---- | ---- | ------ | ------ | ------ | ------- | ---- |
  | control head                       | 0°   | 0°   | 19.49° | 56.97° | 89.85° | 113.76° | 120° |
  | end-on drawing                     | 120° | 120° | 120°   | 120°   | 120°   | 120°    | 120° |

  | Repair: ms after the press | 40    | 83     | 123    | 162    | 202     | 241  |
  | -------------------------- | ----- | ------ | ------ | ------ | ------- | ---- |
  | control head               | 7.21° | 31.96° | 65.07° | 96.71° | 117.07° | 120° |
  | end-on drawing             | 7.21° | 31.96° | 65.07° | 96.71° | 117.07° | 120° |

  The same agreement holds on every sampled frame of +120° → −120° (through 106.16°, 99.57°,
  57.1°, −8.83°, −59.56°, −108.14°), −120° → 0° (−110.21°, −83.33°, −56.57°, −24.69°, −3.54°),
  rotation 0° → 95° → 180° → −95° (the last by way of 186.5°, 204.48°, 223.83°, 246.59°, 262.1°,
  the drawing's U mark at the same angle on each frame; the two track clicks landed on 95° and
  −95°), and a turn with the lever moved while it was still turning: 196 frames in all, 45 of
  them part-way through a transition, the drawing's attributes within 0.002 of the
  engine's value for the control head's reading and the painted mark within 0.04 drawing units
  (about a pixel and a half). The note over the scope view and its words for assistive technology
  switch on the same frame.

- **Settled geometry.** Unchanged and re-asserted: 0° centre; ±deflection at `0.000,±1.000`;
  30° at U toward the card's top, right, bottom and left for 0°, 90°, 180° and −90°.
- **Reduced motion.** No transition, as before: the bench and the drawing change together on the
  command (browser case and Jest case).
- **Files.** `components/scope/useBenchPresentation.ts`, `ScopeScenePane.tsx`, `ScopeScene.tsx`,
  `ScopeFallback.tsx`, `TipCompass.tsx`.
- **Regression.** `__tests__/review-repair-visuals.test.tsx` (12 cases: eight transitions stepped
  frame by frame against an independent interpolation and against the state the scene was handed;
  mid-transition position; the short way round; reduced motion; schematic view). Browser:
  `review repair 2` (two cases).

### Blocker 3 — the bench's out-of-view note was not in the accessibility tree (A21)

- **Reproduction (reviewed build, S5 at ±60° and ±120°).** The scope view prints "The card is
  outside the field of view… This is the bench, not a lost view of an airway."; the accessibility
  tree of the pane has no such sentence.
- **Root cause.** The note is `aria-hidden` on the scope view, with a code comment saying the
  end-on drawing carries it in words. The drawing's caption gave only the angle and direction.
- **Repair.** The sentence comes from one function (`benchOffCardNote`) read by both places. The
  scope view prints it for the eye, still hidden from assistive technology there; the end-on
  drawing carries the same sentence as a paragraph inside its figure, visually hidden, outside the
  caption that names the image — so it is in the tree once, not once more in the image's name. It
  is read from the same displayed state as the picture and is removed when the card is back in
  view. It is not a live region: it is not announced on every lever movement.
- **Accessibility tree, before / after (Playwright `ariaSnapshot` of the pane, production
  builds).** At 0° and at 15° both builds: no such text. At +60° the reviewed build's figure has
  the image and its caption only; the repair adds
  `paragraph: "The card is outside the field of view: the tip points 60° from straight ahead. This is the bench, not a lost view of an airway."`.
  The same at −60°, ±120°, 90°/60°, 180°/120° and −90°/−60°, once each; absent again at −90°/0°.
- **Not an airway event.** The view signal stays `clear`, the lost-view and contact counts stay 0,
  no red-out, blind-advance, contact, entry or ostium event is recorded, the inspection ledger is
  untouched and the device record is unchanged. The sentence claims no obstruction, contact,
  clinical lost view or safety judgement.
- **Files.** `engine/scope/benchOrientation.ts`, `components/scope/TipCompass.tsx`,
  `ScopeScene.tsx`, `scope-fallback.module.css`.
- **Regression.** `__tests__/review-repair-visuals.test.tsx` (15 cases: seven out-of-view states,
  five in-view states, the return to view, the pane in 3D and schematic views, nothing recorded).
  Browser: `review repair 3` (ten states, read from the accessibility tree).

### Blocker 4 — S7 Enlarge did not enlarge the CT (A25)

- **Reproduction (reviewed build, S7 Part 2).** Card CT and enlarged CT both 478×478 px at
  1204×987, both 397.36×397.36 px at 1024×768.
- **Root cause.** `.mediaGrid[data-media-compare='true'] .figureFrame` — the comparison row's
  size limit — is a descendant selector, and the enlarge dialog is nested in the same figure; with
  three selector parts it outranked `.figureFrameLarge`.
- **Repair.** The selector is `.mediaGrid[data-media-compare='true'] .figureBody > .figureFrame`:
  the card's own frame, by structure. One CSS rule; no media file, manifest, markup, comparison
  wording or card size changed.
- **Measured, the image itself (production builds).**

  | Viewport | Image | Card          | Enlarged, reviewed build | Enlarged, repair      |
  | -------- | ----- | ------------- | ------------------------ | --------------------- |
  | 1204×987 | CT    | 478 × 478     | 478 × 478 (1.00×)        | 753.5 × 753.5 (1.58×) |
  | 1204×987 | still | 510 × 402.4   | 606 × 478.1 (1.19×)      | 955.0 × 753.5 (1.87×) |
  | 1024×768 | CT    | 397.4 × 397.4 | 397.4 × 397.4 (1.00×)    | 543.3 × 543.3 (1.37×) |
  | 1024×768 | still | 471.3 × 371.8 | 503.8 × 397.5 (1.07×)    | 688.7 × 543.4 (1.46×) |
  | 390×844  | CT    | 364 × 364     | 338.4 × 338.4 (0.93×)    | 338.4 × 338.4 (0.93×) |
  | 390×844  | still | 364 × 287.2   | 338.4 × 267.0 (0.93×)    | 338.4 × 267.0 (0.93×) |

  Same file and natural proportions in both; the dialog stays inside the viewport and needs no
  scrolling at the two desktop sizes; Close and Escape return the focus to the figure's own Enlarge
  button; the card is the size it was. **Phone:** unchanged by this repair. The card already spans
  the column, so the dialog — the screen less its own border and padding — shows the image slightly
  smaller than the card. That is how every enlarged view behaves at 390 px and is recorded in the
  backlog below, not changed here.

- **Files.** `components/stage/bronch-stage.module.css`.
- **Regression.** `__tests__/review-repair-visuals.test.tsx` (the stylesheet's own selectors
  matched against the rendered card and dialog frames, for the CT and the still). Browser:
  `review repair 4` at 1204×987, 1024×768 and 390×844.

### Statements this repair corrects

- A21, "Lever, drawing and engine agree at every sampled state": true of settled states, which is
  all the original cases sampled (the suite runs with reduced motion). During an ordinary-motion
  transition the drawing was ahead of the bench. Repaired (blocker 2).
- A21, the note "in words for assistive technology": the words were not there. Repaired
  (blocker 3).
- A25 / the media workspace, "each still opens full size from its own Enlarge button": not so for
  the S7 comparison at laptop sizes. Repaired (blocker 4). A25 stays **partially repaired**: the
  five-level trace is still held.
- A30, "help from the first unmet requirement": true at the moment help was asked for, and stale
  afterwards. Repaired (blocker 1).

A21, A22 and A30 are recorded in the dispositions file as repaired **pending independent
re-review**, not as closed.

### Validation of the repair

Unique tests are counted once. Commands were read from `package.json` and the Playwright configs.

| Check                                                                                          | Result                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New Jest cases (`review-repair-help`, `review-repair-visuals`) on the repair                   | 2 suites, **35 passed**                                                                                                                                                                                                                                                                                            |
| The same 35 on the reviewed head (detached worktree at `4126103b`, test files only, no shims)  | **26 fail, 9 pass.** 25 fail on the reproduced defects; 1 (reduced motion) fails only because the reviewed pane handed the scene no displayed state to compare. The 9 that pass are preservation guards: card in view says nothing (5), nothing recorded, help writes nothing, schematic view, the short way round |
| Batch-03 Jest (`workbench-and-visuals`, `workbench-host`, `goal-truth`, and the two new files) | 5 suites, **84 passed** (49 existing, 35 new)                                                                                                                                                                                                                                                                      |
| Complete BF Jest, routes included (`'src/app/\[locale\]/bronchoscopy-foundations'` escaped)    | **36 suites, 523 passed, 1 todo** (reviewed head: 34 suites, 488 passed, 1 todo; two suites and 35 cases added, no existing case changed)                                                                                                                                                                          |
| Shared learning-module Jest (not touched; run as a guard)                                      | 17 suites, 184 passed                                                                                                                                                                                                                                                                                              |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`                                      | exit 2 with **one** diagnostic, the known one on main: `src/features/medical-thoracoscopy/wolf-preview/__tests__/boundaries.test.ts(51,67): TS2353`. Identical on the reviewed head. **No new diagnostic.** The separate fix on main was not merged in                                                             |
| `npx eslint --max-warnings=0` on every changed `.ts`/`.tsx`                                    | 10 files, 0 errors, 0 warnings                                                                                                                                                                                                                                                                                     |
| `npx prettier --check` on every changed path                                                   | clean on all 14 changed paths, these two documents included                                                                                                                                                                                                                                                        |
| `git diff --check 4126103b HEAD`                                                               | clean                                                                                                                                                                                                                                                                                                              |
| `npm run build`                                                                                | exit 0, build `9jpWZv3QtfOj_kknLKuPG`; "Compiled with warnings" block identical to the reviewed head's                                                                                                                                                                                                             |
| New browser cases on the reviewed build (3143)                                                 | **6 of 7 fail**: the stale sentence; the drawing at 120° with the head at 0°; no note in the tree at 60°; the CT at 478 and at 397.36 px; and the reduced-motion case, which fails there only on the missing accessible note. The phone case passes on both builds: it is a guard                                  |
| Complete BF Playwright suite on the repair build (3144)                                        | **68 unique tests, 68 passed** in one run with no retries (61 existing, 7 new)                                                                                                                                                                                                                                     |
| Systemic-UX checks that load BF (`bf:` × 6 sizes and the nine public entry routes)             | 7 passed                                                                                                                                                                                                                                                                                                           |

Reruns, not counted again. While the new browser cases were being written they were run alone
four more times on the reviewed build and twice more on the repair build. Three assertions of the
cases' own were corrected in that time, with no source change: a word check that matched the
pane's existing goal text, a phone bound the dialog cannot meet on either build, and a text query
that also matched the note hidden from assistive technology (now a query by role). One further
invocation did not start (a syntax error in the spec). There was one production build of the
repair, and no source file changed after it.

### Owner and source holds — unchanged, none resolved here

1. Showing the registered "Vocal cords" outline on the S9 still (A28; owner).
2. Authoring or reusing the five-level S7 CT trace (A25; source and owner) — A25 stays partially
   repaired even with the enlargement fixed.
3. Owner approval of A/L as the teaching frame (A24 / SUP-09; the implementation matches the
   teaching model, the choice of frame is the owner's).
4. Whether the optional opening-name reveal should count as an assist (A30; owner).
5. New head-on airway-tour stills (A29; source).
6. Close-up laryngeal anatomy and geometry (A2; owner).

### Not run, and limits of this repair

- No human review of any kind; no screen-reader was listened to. Blocker 3 is asserted on
  Chromium's accessibility tree, not on what VoiceOver, NVDA or JAWS say.
- Chromium only. The frame samples are from headless Chromium, which drew about one frame every
  40 ms here; a 60 Hz display shows more frames of the same transition.
- The agreement between the drawing and the 3D picture is asserted through the state both are
  handed in one render (the control head's own `data-handle-rotation` / `data-lever-deflection`
  and the drawing's painted mark). The WebGL pixels were not read back.
- Hidden-tab behaviour of the bench transition (it does not animate in a background tab) is the
  same code, moved; it was not exercised in a browser.
- Backlog, not changed here: on a 390 px phone an enlarged view is slightly narrower than a card
  that already spans the column (S7: 338 px against 364 px).

## Unresolved media, anatomy and source dependencies

1. **A25 — five-level CT trace (SOURCE-HELD / OWNER-HELD).** Investigated: the course's registered
   CT correlation media (`airway-survey-ct.json`, case-001 preview volume, 212 axial slices) holds
   one representative slice per named airway: `rul` and `rmb` at 126, `bronchus-intermedius` 113,
   `rml` 103, `rb6` 102, `rll` 104, the basal segments 85–94. **There is no registered slice for
   the main carina**, the basal continuation exists only as segmental points, and the slices that
   do exist for the RUL, BI and RML levels are **the images Part 3's identify check asks the
   learner to name** — showing them labelled in Part 2 would turn those items into recall (the A6
   pattern). None were exposed. Exact requirement: five axial slices from one volume at the main
   carina, the RUL takeoff, the bronchus intermedius, the RML/RB6 level and the basal trunk, each
   with volume id, slice index and position, window, display convention (viewed from the feet) and
   the traced airway marked, pre-rendered like the existing 512×512 slices — and either distinct
   from the Part 3 images or with those items replaced. Owner decides.
2. **A28 — laryngeal landmarks (OWNER-HELD, batch 05).** The quiz-frame manifest already carries a
   registered polygon named "Vocal cords" for this still; it was not added to S9. Whether to show it,
   and any epiglottis, false-fold, arytenoid or orientation label, needs review.
3. **A2 — close-up geometry and inlet continuity (OWNER-HELD, batch 05).** The phase is now on the
   picture; the pink-ring close-up and the existing `scope-assets` larynx/trachea todo are anatomy.
4. **A29 — head-on representative stills and frame metadata (SOURCE-HELD, batch 05).** The tour now
   says the frame is not recorded; no roll was inferred.
5. **A24 — anatomy at the carina (OWNER-HELD).** Why the main-bronchial openings do not read as dark
   at the carina (lighting, mesh or camera) is unchanged; the left-main tour still is A23 (batch 05).
6. **A20 — screen-reader review (NOT RUN).** Alternatives and the part reference are asserted in the
   DOM; no assistive-technology user or specialist review.
7. **A18 — part identity.** Unchanged; the part notes condense the rows' existing sourced rationales
   and are for the same faculty review as the set.

## Owner decisions left open

- Whether to show the existing "Vocal cords" polygon on the S9 still (and on what review).
- Whether to author the five-level S7 trace, or reuse the per-airway slices and replace the Part 3
  items (item 1 above).
- The A/L rim ticks are read from the teaching model's LPS coordinates — the same ones the map and
  CT correlation use. They state the model's frame, not a device's or a patient's image; confirm
  that is the frame to teach.
- Reference names on request in S10/S11 are shown without being recorded as the in-view-labels
  assist and without calling the attempt unaided; confirm this is the wanted balance for the
  less-assisted lessons.

## NOT RUN / limitations

- No human review of any kind: faculty, learner, technologist, clinical, source, media, anatomy or
  accessibility specialist; no usability session; screen-reader output not listened to.
- Chromium only; Safari/WebKit and Firefox not run. Native browser zoom not tested — "200% text" is
  the root font size set to 200% (labelled as such).
- The loading gate (dock disabled until the scene is ready) is unchanged code; it was sampled, not
  exhaustively raced (the silent load delay itself is A39, batch 04).
- Hidden-tab and reduced-motion behaviour was not re-tested beyond the existing suite, which ran in
  full (no lifecycle code changed).
- At 200% root text the site header and footer overflow the page, identically on the base (shared
  chrome, recorded by BF-PRE-REVIEW-02); the course region fits.

## Backlog raised in passing (not repaired here)

- The side-view bending-section close-up is still a single projection; the end-on drawing now
  carries the direction, but a second exterior projection could be considered with the 3D owner.
- The pane card's model-limit sentence makes the card tall at 200% text on a phone; a shorter
  wording would need the Batch-01 copy owner.
