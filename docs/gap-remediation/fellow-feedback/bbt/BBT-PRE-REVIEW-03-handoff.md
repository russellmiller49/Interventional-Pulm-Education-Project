# BBT-PRE-REVIEW-03 — CT-to-parent-view teaching, visible and coherent

**Scope:** Bronchial Branch Tracing only — `src/features/bronchial-branch-tracing/**`, the module's
own `e2e/branch-tracing.spec.ts`, one launch entry for a local production server, and this document
set. No other module, no auth or access policy, no shared header/footer/global CSS, no shared
lesson-stage component, and no source volume, mesh, graph, manifest, response plane, nomenclature
or review-status file was changed.

> **Read [Sanity repair — 2026-09-22](#sanity-repair--2026-09-22) first.** An independent
> sanity review of head `a96047ef` reproduced two regressions this batch introduced — a repeated
> CT plane taking the first pass's daughter identity, and a hidden explanation for an occluded
> daughter. Both are repaired on this branch; the sections below are the original record and
> were not rewritten.

**No clinical approval, faculty review, release, deployment or merge is claimed or performed.**
OD-01 remains **OPEN**. The first-bifurcation teaching mismatch is contained, not anatomically
resolved. The BBT-02 five-junction packet remains **NOT REVIEWED**. Every `exercise.review.status`
stays `provisional`; every `entryLimitation` sentence is unchanged.

## Repository reconciliation

| Field                    | Recorded value                                                                                                                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Smoke-tested SHA         | `f01e43e2410e96f8f77a0db6814a4853749add24` (post-merge smoke of Prompts 01 and 02, passed as reported by the owner)                                                                                                                      |
| Implementation base SHA  | `2124cd0f3483db6534ab65bf6dd3730b59fee463` — `origin/main` as fetched on 2026-09-21. It is a descendant of the smoke SHA by four MCS-only commits (`caa7cee4`, `4b079428`, `6663f030`, merge `2124cd0f`); none touches a BBT file.       |
| Final head SHA           | Implementation commit `aefc136da7b0bbe10cee9b9489f61958de2dd0e6`. This document set is committed on top of it, so the PR head is the documents commit; the PR page and `BBT-PRE-REVIEW-03-status.json` record both.                      |
| Branch                   | `claude/bbt-2-21`, created from `origin/main` at the base SHA; no other commits on it before this batch                                                                                                                                  |
| Worktree                 | `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/claude-bbt-2-21` — a clean, previously unused checkout dedicated to this session (`git worktree list` inspected; no other checkout was reset, reused or modified) |
| Pull request             | [#260](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/260) into `main`; not merged, not deployed                                                                                                          |
| Planning SHA             | `77a141ccfd574a984f91e74abc9018b5d67e8202` is historical context only                                                                                                                                                                    |
| Open PRs overlapping BBT | None at the time of work: #259 (MV), #258 (HD), #254 (BF), #134 (critical care), #114 and #98 (literature) change no `bronchial-branch-tracing` or `branch-tracing` path                                                                 |
| Dev server               | `npm run dev:claude`, port 3120, this worktree only (baseline reproduction and development)                                                                                                                                              |
| Production server        | `.next/standalone/server.js`, port 3131 (`claude-bbt-03-prod` launch entry), built with `.env.example` placeholders passed as process environment only; no `.env` file was created or read                                               |
| Browser profiles         | Fresh Chromium contexts (Playwright) and the built-in preview pane. The owner's Chrome profile and the `claude-review-backup::branch-tracing::2026-09-19` backup were never opened, restored or read                                     |
| Test data                | Synthetic drafts in each run's own `localStorage`; no fixture is presented as performed learner work                                                                                                                                     |

## A. The three reference frames, and how they relate

The module now states these in code (`geometry/reference-frames.ts`) and in every learner-facing
caption. They were already separate in the implementation; this batch makes the separation visible.

| Frame                               | Where it lives                                                                                                                                                                                                      | What moves it                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Native CT pixels / patient space | `NATIVE_CT` origin and spacing, `sliceZ`, LPS millimetres. Marks (`{slice, pixel}`), response planes, the airway graph (`paired-routes.json`, hash-pinned to `airway_graph.json`) and the source camera definitions | Nothing in this batch. Not a single coordinate, plane, edge id or name changed (hash tables below).                                   |
| 2. Learner's CT display             | `CtOrientation {turns, reflected}` in `orientation.ts`, plus crop, magnification and full field. A pure screen operation; the R/L/A/P letters move with the pixels                                                  | Rotate/flip/Return to standard axial, Focus CT view, Magnify, Full CT field. Round-trips to identical native pixels (existing tests). |
| 3. Modelled parent camera           | `pairedScope()` in `paired-scope.ts`: position on the model route, forward vector along it, up = `bookScopeUp(preset, forward)`. Rendered by `ClinicalAirwayView` with roll 0                                       | The active route interval and the regional preset only. **Never frame 2.** Turning or reflecting the CT does not roll or move it.     |

Relationship: frame 2 is a rendering of frame 1; frame 3 is defined inside frame 1 along the
verified route; correspondence between the CT and the parent view is by stable source-edge identity
(`allowedEdges` = the active parent/daughter interval) and plane z, never by names, screen proximity
or a nearest hole. `paired-scope.ts` is byte-identical to the base. The camera follows the model
reference route, including after a different branch choice, and the caption beside it says so.

What the learner now reads beside every paired view (generated, never a universal claim):

- `Model parent view: looking caudally along Trachea toward its division. Reference roll for this region: anterior at the top of the view.`
- `CT display: Left–right reflection (A up, L screen-left). Turning or reflecting the CT does not move the parent camera.`

The roll word comes from `bookScopeUp` for the region (anterior for caudal tracing; patient left for
the right upper lobe; patient right for the left upper division; superior when the preferred axis
lies along the parent). The looking direction comes from the forward vector in patient words, with
"mainly" when it is oblique. A test asserts every authored checkpoint resolves to a named axis and
that no caption contains "always" or "universal".

## Source-to-display mapping

| Source identity (frame 1)                                    | Display                                                                                                                                                                                                                            | Where                                                                            |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| `decision.options[i]` (sourceEdgeId, airway.code, direction) | `Daughter A/B` by option index, source code appended; the source direction appended when the code repeats the parent's or a sibling's (`Daughter A · LB6 · more caudal`)                                                           | `engine/branch-identity.ts`; slot buttons, task card, feedback, identities block |
| `decision.parent`                                            | `Parent · <code>`                                                                                                                                                                                                                  | same                                                                             |
| stored `answerPoints[i].label` (`A · RMSB`)                  | **unchanged in data**; shown through `displayAnswerLabel()`                                                                                                                                                                        | draft signatures unchanged (fixture test)                                        |
| `parentMap().points[]` (edgeId, sourceIndex)                 | opening **number** = spatial order in the camera view (unchanged rule); opening **letter** = CT letter by `sourceIndex`; legend `Opening 1 · Daughter A · RMSB (source label “more right”) · 21 slices caudal of the parent point` | `CtParentMap`                                                                    |
| patient axes R/L, A/P, S/I                                   | both ends drawn when the axis lies in the view plane (`                                                                                                                                                                            | projection                                                                       | > 0.3`); an axis along the line of sight gets a sentence, not an arrow | `patientAxesInView()`; `[data-along-view]` |
| `option.lps` (each daughter's model response point)          | letter drawn in the paired view **only** at the fork pose and only when the point is in real line of sight (ray cast against the airway surface); otherwise a sentence says it is not marked                                       | `ClinicalAirwayView` `AnnotationProjector`                                       |
| source edge crossings of the displayed plane                 | dotted, unlabelled model course locator on intermediate demonstration planes                                                                                                                                                       | `engine/model-course.ts`, `NativeCtViewer` `courseLocators`                      |

## Assigned findings — dispositions

Per-ID detail with measurements is in `BBT-PRE-REVIEW-03-status.json`.

**BBTF-04 · reproduced · repaired.** On the base at 1427 × 1226 there was no parent airway view or
control anywhere in Lesson 2 (context, direction, comparison, demonstration, attempt), and in
Lesson 3 the `Show parent airway view` control first appeared in the parent-view phase after
checking, off by default. Now: the paired model camera is available in every local lesson from the
first (context) step through demonstration, attempt, comparison and parent view, one click away and
never behind an answer; Lesson 2 opens **paired** (CT beside the parent view), and its orientation
comparison carries the fixed camera as a **third panel** beside the two CT copies so the learner sees
the CT display change while the camera does not; entering the parent-view phase opens the paired view
beside the diagram. The learner's own toggle is kept in the saved view state. Nothing autoplays, no
interaction is forced, and opening the view records nothing (draft marks and history checked in
Jest and Playwright). The paired view is a truthful registered view: the camera sits on the same
hash-pinned route, and the surface is the same hash-pinned model. Where a plane is not the fork, the
caption says the scope is proximal to that level or how far the plane is from the route.

**BBTF-06 · reproduced · repaired within the display layer.** RB3a → RB3a / RB3a, LB6 → LB6 / LB6
and RB4 → RB4 / RB4a were shown by name only. The task card, slot buttons, feedback and legends now
use `Parent · RB3a`, `Daughter A · RB3a · more cranial`, `Daughter B · RB3a · more caudal`, with the
source direction label carrying the distinction. No LB6a/b/c or any new suffix was invented; graph
ids, source edges, `airway.code`, `option.label`, stored answer labels and draft signatures are
unchanged (fixture parity test). A "Branch identities on this CT" block lists parent and daughters
with their response planes before marking.

**BBTF-13 · reproduced · repaired.** The base diagram was 200 × 200 px with 12 px axis letters, 15 px
numbers, R/A(/S) only, and a `1 · A · RMSB` legend. Now the diagram fills the pane (up to 420 px),
draws the CT letters A/B on the openings (with the spatial number as a small badge) whenever labels
are allowed, draws **both ends** of every in-plane patient axis, states in words which axis runs
along the line of sight, and its legend reads `Opening 1 · Daughter A · RMSB (source direction:
more right) · 21 slices caudal of the parent point`. Opening identity (number, spatial) and branch
identity (letter, CT order) stay distinct in data and on screen; the independent matching try still
shows numbers only until the learner chooses or asks for the labels. Measured axis-letter heights:
27 px axis letters and 33 px opening letters on a 374 px diagram at 1427 × 1226; 19 / 24 px on 274 px at 1024 × 768; 24 / 30 px on 345 px at 390 × 844; 19 / 24 px on 275 px at 320 × 740 (base: 12 px letters on a 200 px diagram at every size).

**BBTF-26 · reproduced · repaired within the source.** Intermediate demonstration frames had no
locator (0 overlays on Lesson 1 frame 2 and Lesson 3 frame 3 on the base). Now each intermediate
plane carries a dotted, unlabelled model course locator wherever a source edge of the current
division — the parent, or the daughter whose pass the demonstration is in — actually crosses that
native plane. Positions are the graph polyline's crossing of the plane (`edgeCrossings`), never a
dark pixel or an interpolation across structures; a test asserts each lies on its edge to 1e-6 mm.
The transport caption names them ("Dotted gold crosshair: where the model centreline of Parent ·
Trachea crosses this plane. A model course locator, not a reviewed lumen boundary."), a legend line
appears, and Hide overlays removes them. Planes that already carry an authored locator get none.

**BBTF-29 · reproduced · explanation improved; replacement example prepared for owner review, not
published.** The comparison step now says, at the trachea, that a nearly round midline lumen changes
little under reflection and that the letters and asymmetric outlines are what move, that the same
reflection swaps daughters that lie on different sides of the patient, and that the fixed parent
airway view beside the copies does not change. Standard axial remains the entry reference. The
tracheal exercise was **not** replaced and the disputed first-bifurcation plane was not reused as a
resolved split. Candidate asymmetric forks from verified source data are listed under owner
decisions.

**BBTF-34 · reproduced · repaired within policy.** Lesson 4 asked `Mark A · RB1b` before saying which
lumen the source calls b. The task now leads with `Daughter A · RB1b` / `Daughter B · RB1a`, and the
identities block states before marking: "Daughter A is labelled RB1b in this source (more anterior);
Daughter B is labelled RB1a in this source (more posterior). The a/b letters follow this source's
labelling and are pending nomenclature review: they are shown so you can follow each lumen, not
asked." The existing post-check naming aid is untouched. The assignment is not taught as universal
anatomy and no a/b identity was revised.

**BBTF-42 · reproduced · addressed with existing references.** The oblique Lesson 7 division now has
three spatial cues without new anatomy: the paired parent view from RB3a, one click away before
marking; the model parent-view schematic in an optional disclosure during demonstration, attempt and
comparison, with the daughters' level relations ("N slices cranial/caudal of the parent point") and
projected patient directions; and the neutral identities carrying the source direction. No new
figure or synthetic anatomy was drawn.

## Opening letters in the paired view — how they are placed

Letters exist only where stable source-edge identity supports them: at the fork pose
(`scope.atJunction`), each daughter's own model response point (`option.lps`, the exporter's 5 mm
rule point — not a clinically selected carina point) is projected with the camera exactly as
rendered (`Vector3.project`), then a ray from the camera to the point is cast against the airway
surface (a double-sided probe mesh of the same geometry). A point hidden behind the wall or outside
the view is **not drawn**; the note under the view says so. Visible letters use the existing
`placeOverlayLabels` pass: the anchor stays on the projected point and only the text moves, with a
leader line. A pure-function twin (`projectToParentView`) is tested against a `three` camera for
every authored fork, and its screen side agrees with the schematic's side for every daughter, so
letters cannot swap between the diagram and the view. The letters follow the same policy as the CT
model locators: shown in the worked demonstration, the comparison and the parent view; in the
attempt only after `Show reference`; withheld while an independent matching try is open.

## Files changed

New: `geometry/reference-frames.ts`, `engine/branch-identity.ts`, `engine/model-course.ts`,
`__tests__/reference-frames.test.ts`, `__tests__/branch-identity.test.ts`,
`__tests__/model-course.test.ts`, `__tests__/paired-view-teaching.test.tsx`,
`__tests__/fixtures/parent-camera-baseline.json`, `__tests__/fixtures/local-draft-baseline.json`.

Changed: `components/ClinicalAirwayView.tsx` (paired annotations, projection, occlusion, overlay),
`components/NativeCtViewer.tsx` (frame captions, course locators, `scopeLabels`, `scopeDefault`,
`scopeRequest`, `data-scope-pose`), `components/CtBranchMap.tsx` (`CtParentMap` rewrite),
`components/CtViewpointComparison.tsx` (fixed third panel), `components/CtOrientationTeaching.tsx`
(roll definition; symmetric-trachea note), `components/JunctionFeedback.tsx` (display identities),
`components/LocalCtLesson.tsx` (wiring), `components/branch-tracing.module.css`,
`geometry/parent-map.ts` (letters, both-ended axes, along-view axes; projections unchanged),
`engine/local-session.ts` (the viewpoint lesson's context view opens paired),
`__tests__/local-lesson.test.tsx` and `__tests__/partial-route-and-restart.test.tsx` (label helpers),
`e2e/branch-tracing.spec.ts` (helper + 11 tests), `.claude/launch.json` (production server entry),
and this document set.

## Geometry and source integrity

SHA-256 before (base `2124cd0f`) and after (this head) of every protected artifact, recorded at
`…/renders/output/bbt-pre-review-03-2026-09-21/evidence/protected-hashes-{before,after}.txt`:

| Artifact                                                                       | SHA-256 (first 16)                                 | Status                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `geometry/paired-routes.json`                                                  | `ddd2a61893a0da64`                                 | identical                                                                                                                                                                                                                                                              |
| `geometry/branch-decisions.json`                                               | `1a78138c5e4e991a`                                 | identical                                                                                                                                                                                                                                                              |
| `public/branch-tracing/targets-v1/manifest.json`                               | `39b6d787ed6df488`                                 | identical                                                                                                                                                                                                                                                              |
| `public/branch-tracing/native-v1/manifest.json`                                | `3cd614847f371541`                                 | identical                                                                                                                                                                                                                                                              |
| `public/branch-tracing/preview-v1/manifest.json`                               | `b86cb2ca3c3f18f5`                                 | identical                                                                                                                                                                                                                                                              |
| `public/branch-tracing/preview-v1/geometry.json`                               | `754ff1013b08a2a7`                                 | identical                                                                                                                                                                                                                                                              |
| `public/branch-tracing/preview-v1/airway.glb`                                  | `24edef81dd18f10e`                                 | identical (runtime hash check unchanged)                                                                                                                                                                                                                               |
| `public/fluoroview/cases/patient-new/metadata/airway_graph.json`               | `68226a87928135f8`                                 | identical                                                                                                                                                                                                                                                              |
| `content/junction-feedback.ts`                                                 | `4329d6fde60bb986`                                 | identical (every packet sentence, `entryLimitation` included)                                                                                                                                                                                                          |
| `content/local-exercises.ts`                                                   | `f99b8319e570db9e`                                 | identical                                                                                                                                                                                                                                                              |
| `content/ct-types.ts`                                                          | `e9e93c0acef5128c`                                 | identical                                                                                                                                                                                                                                                              |
| `geometry/native-ct.ts`, `paired-scope.ts`, `coordinates.ts`, `orientation.ts` | `b4120aa9…`, `59e1d26a…`, `8637d679…`, `ea7da120…` | identical                                                                                                                                                                                                                                                              |
| `docs/gap-remediation/bbt/BBT-02-junction-packet.md`                           | `9531bc460282cb66`                                 | identical (NOT REVIEWED)                                                                                                                                                                                                                                               |
| `geometry/parent-map.ts`                                                       | `d2e869ee…` → `595777b4…`                          | **presentation-only change**: added letter, both-ended axes and along-view axes. `__tests__/reference-frames.test.ts` asserts every camera pose and every schematic point/axis projection is numerically identical to the base fixture for all 128 authored decisions. |

Git tree hashes of `public/branch-tracing/{native,targets,preview}-v1` and
`public/fluoroview/cases/patient-new` are unchanged with zero working-tree differences. Draft
signatures for all eight local lessons are identical to the base (`local-draft-baseline.json`), so
no existing draft is invalidated and no stored answer label changed.

## Evidence

Raw evidence is outside Git at
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/bbt-pre-review-03-2026-09-21/`:

- `baseline/` — 31 screenshots and `metrics.json` captured on the unmodified base with real pointer
  input across 1427 × 1226, 1440 × 900, 1024 × 768, 390 × 844 and 320 × 740 (Lesson 2 every step;
  Lesson 3 demonstration, attempt, comparison, guided and independent parent view; Lesson 4 and 7
  attempt; Lesson 1 intermediate frame).
- `after/` — the same states on the production build: 39 screenshots and `metrics.json`.
- `after/e2e/` — screenshots written by the new Playwright tests on the production build
  (`bbt03-*.png`).
- `evidence/protected-hashes-{before,after}.txt`.
- `logs/production-build.log`, `logs/playwright-production.log`, `logs/jest.log`.

Browser matrix (production build, fresh Chromium contexts):

| Check                                                                                                                          | 1427×1226          | 1440×900                              | 1024×768                             | 390×844        | 320×740        |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------- | ------------------------------------ | -------------- | -------------- |
| Lesson 2 paired from the first step; comparison carries the fixed camera; no mark created                                      | pass               | pass                                  | pass (camera wraps under the copies) | pass (stacked) | pass (stacked) |
| CT rotations (+90°, −90°), reflection and Return to standard axial leave `data-scope-pose` unchanged; mark keeps native pixels | pass               | mark round trips only (existing test) | —                                    | —              | —              |
| Diagram legible (axis letters ≥ 16 px), letters on openings, along-view sentence, no horizontal overflow                       | pass               | —                                     | pass (capture)                       | pass           | pass (capture) |
| Opening letters drawn from line of sight, apart and inside the view; withheld during matching                                  | pass               | —                                     | —                                    | —              | —              |
| Intermediate planes carry dotted course locators; none on authored planes; Hide overlays clears them                           | pass               | —                                     | —                                    | —              | —              |
| RB1 naming stated before marking; repeated names told apart by role and direction                                              | pass               | —                                     | —                                    | —              | —              |
| Lost WebGL context leaves the CT and lesson usable                                                                             | pass               | —                                     | —                                    | —              | —              |
| Paired-view toggle keyboard reachable with visible focus; records nothing                                                      | pass               | —                                     | —                                    | —              | —              |
| 200 % root text (CSS probe, 1280 × 720): comparison and camera visible, no horizontal overflow                                 | pass at 1280 × 720 | —                                     | —                                    | —              | —              |
| Compact Check stability (Prompt 02 regression, 390 × 844 / 1024 × 768 / 1427 × 1226)                                           | pass               | —                                     | pass                                 | pass           | —              |

## Verification

| Check                                                            | Result                                                                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit` (repository, after the final edit)            | Clean: exit 0, no diagnostics, run after the final code and test edit (`logs/tsc.log`)                                               |
| `npx jest src/features/bronchial-branch-tracing`                 | 137 passed, 1 failed across 22 suites (138 tests); the failure is the documented access-contract assertion (`logs/jest.log`)         |
| Playwright `branch-tracing.spec.ts` (production build)           | 49 passed, 0 failed, 0 skipped, 58 s, against the final production build on port 3136 (`logs/playwright-production.log`)             |
| Playwright `systemic-ux-stabilization -g bbt` (production build) | 3 passed: `bbt: native workspace scroll ownership` at 1600, 1440 and 1024 (`logs/playwright-systemic-bbt-production.log`)            |
| `npx eslint` (changed paths)                                     | Clean, no warnings                                                                                                                   |
| `npx prettier --check` (changed paths), `git diff --check`       | Clean                                                                                                                                |
| `npm run build` (production)                                     | Passed, exit 0, 2 min 11 s; all four branch-tracing routes compiled and the standalone output prepared (`logs/production-build.log`) |

Unique counts only: no rerun is added to a count. The dev-server run of the same Playwright suite is
recorded in the status JSON as a development run, not as a second pass.

### Tests added (unique)

- `reference-frames.test.ts` (5): base-fixture parity of every camera pose and schematic projection;
  pose independence from all eight CT displays; both-ended axes and along-view axes; captions name
  the region's roll and never a universal rule; perspective projection agrees with a `three` camera
  and with the schematic's side for every daughter.
- `branch-identity.test.ts` (3): neutral identities for repeated names without new suffixes; the RB1
  naming note; stored labels, answer points, frame counts and draft signatures unchanged from the base.
- `model-course.test.ts` (4): first bifurcation crossings above and below the node; a daughter on a
  different plane gets its own pass; every locator lies on its graph edge and names only this
  division's edges or its approach; the same-lumen intervals follow one edge.
- `paired-view-teaching.test.tsx` (5): Lesson 2 opens paired and records nothing; every local lesson
  offers the view before an answer and CT transforms leave the pose unchanged; course locators;
  the diagram's letters, axes and legend, with the independent try kept neutral; RB1 and RB3a
  identities before marking.
- `e2e/branch-tracing.spec.ts` (11): Lesson 2 pairing at 1427 × 1226 and 390 × 844; transform
  invariance with a real mark; line-of-sight letters, containment and overlap; diagram legibility at
  two sizes; course locators; RB1/RB3a identities; WebGL loss; keyboard toggle with visible focus;
  200 % root text.

Existing assertions updated because what they name genuinely changed: slot and heading labels now
read `Daughter A · RMSB` (three Jest helpers, one heading, one legend query; two Playwright label
helpers, one heading regex).

## Known baseline failure

`__tests__/contracts.test.ts` › "the new pages are anonymous and unlisted without exposing the
existing admin anatomy routes" fails at `isPublicPath('/airway-anatomy/case-001/case_manifest.json')`
exactly as documented by Prompts 01 and 02 and by the owner's post-merge smoke. **Access policy was
not changed, no asset was exposed and no auth was altered to make it pass.**

## Unresolved anatomy and source labels (holds carried forward, unchanged)

- **OD-01 remains OPEN.** Slice 387 is the plane the exporter's generic 5 mm centreline rule lands on;
  the two main bronchi share one air column throughout the browsable interval. This batch changed no
  response slice and did not weaken the `entryLimitation` text. The paired view at this division now
  shows the fork from the trachea with `A · RMSB` / `B · LMSB` letters on the daughters' model
  response points; that is a model relationship, not evidence that the CT plane shows two lumens.
- The historical BBT-02 five-junction anatomy packet remains **NOT REVIEWED**.
- Subsegmental a/b assignments (RB1a/b, RB5a/b, RB4a, RB3a) remain this source's provisional
  labelling; the module now says so before marking and never asks the learner to produce them.
- Opening letters and the schematic are model relationships (OD-05). Whether they correspond to
  actual ostia and to the teaching convention is an owner/anatomy decision; the UI labels them as
  model locators seen through the opening, not measured ostia.

## Owner decisions still required

| Decision                    | What this batch prepared                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Still for the owner                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| OD-01                       | Nothing new; containment preserved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Which planes teach the first bifurcation.                                                              |
| OD-03                       | Neutral Parent / Daughter A / Daughter B identities with source codes and directions on every surface; the code table is `divisionIdentities()`.                                                                                                                                                                                                                                                                                                                                                                 | Any new subsegment names or changed a/b assignments.                                                   |
| OD-05                       | Camera basis, projected directions, A/B mapping and line-of-sight letters for the central fork (junction-1) and subsegmental forks (junction-14, junction-20, junction-16); `parent-camera-baseline.json` records every pose.                                                                                                                                                                                                                                                                                    | Whether the rendered letters correspond to the actual openings and the teaching convention.            |
| BBTF-29 replacement example | Candidates from verified source data, all `mirror` preset, standard axial as entry: **junction-10** RML → RB4 / RB5 (parent slice 307, both daughters on 307, in-plane fork, source directions more posterior / more anterior); **junction-3** LMSB → LLL / LUL (parent 344; daughters 332 / 341; more posterior / more anterior); **junction-6** LLL → LB6 / L basal (parent 332; daughters 326 / 313). Each is an existing checkpoint with source edge ids, pixels and LPS already in `branch-decisions.json`. | Which fork, if any, replaces or supplements the tracheal reflection demonstration. Not published here. |

## Ordinary findings logged, not fixed here

- Route lessons (Lesson 9) and Practice still gate `scopeAvailable` on a recorded junction or a shown
  reference. The paired view there is unlabelled and would not leak the model continuation; making
  it available earlier is a small change, but it was outside this batch's local-lesson scope.
- Toggling the paired view mid-lesson at desktop lets Chromium's scroll anchoring keep the clicked
  button in place, so the image pane can end up scrolled by roughly the height the column change
  added. It is a pane scroll, not a coordinate or crop change, and does not occur on the automatic
  parent-view opening. Worth a look in task 04's chrome pass.
- `playwright.config.ts` still runs its web server on port 3001 with `reuseExistingServer` (logged by
  Prompt 02); this batch ran against its own ports only.

## Limitations and what was not tested

- Native screen readers, real mobile devices/touch, Safari and Firefox: not tested. The 390 × 844 and
  320 × 740 results are emulated viewports in desktop Chromium; the 200 % condition is a CSS
  root-font probe, not native browser zoom.
- Line-of-sight occlusion uses the model surface; it says nothing about mucosa or real ostia.
- The dev-server Playwright run had one readiness timeout on the opening journey at Lesson 2
  (5 s `data-ct-ready` wait while the dev server recompiled the changed chunk); it passed twice in
  isolation and on the production build. It is recorded, not counted.
- No new walkthrough, G02 audit, Prompt 04 work, merge, deployment or release was performed.

## Sanity repair — 2026-09-22

An independent sanity review of PR [#260](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/260)
at head **`a96047ef3766fa10c81af451887a2dc930586d16`** returned **SANITY REVIEW: NOT READY TO MERGE**
and reproduced two regressions introduced by the batch above. Everything else it checked passed:
all 128 authored camera mappings unchanged, protected assets and source data unchanged, production
build, type-check, lint and formatting clean, BBT Jest 137 passed with the one documented
`case_manifest.json` access assertion still failing as the known baseline. The sections above are
left as they were written; this section records what was wrong with them and what was changed.

The repair is bounded to those two defects. No response plane, camera mapping, graph identity,
manifest, packet, draft signature or review status was touched, and OD-01, OD-03, OD-05 and the
BBT-02 packet keep the status recorded above.

### Finding 1 (P1) · a repeated CT plane inherited the first pass's daughter identity

**Reproduction.** Lesson 4 (`vertical`, `right-upper-apical.junction-14.pattern`), the second
demonstration pass through slice 419: the drawn model course locator was Daughter B · RB1a, while
the caption beside it named Daughter A · RB1b.

**Root cause.** `frames` walks the parent interval once per daughter, so the same native plane is
an authored step more than once — slice 419 is steps 18, 25 and 62 of that exercise's 68.
`LocalCtLesson` resolved the caption with `frames.findIndex((f) => f.slice === displayedSlice)`
(and the overlay frame with `frames.find(...)`), which always answers with the **first** step that
shows that plane. `modelCourseLocators()` is pass-aware — it derives the pass from the frame index —
so the crosshair drawn from `s.frame` was right while the caption, the course-locator sentence and
the `n of N` transport position came from step 18's pass. The defect is generic, not Lesson 4's: on
Lesson 8 the same lookup gave Daughter B's outbound pass the lead-in's "Approach context, slice 332"
caption and its "Approach · LLL and Parent · LB6" locator names.

**Repair.** `engine/model-course.ts` gains `demonstrationFrameIndex(frames, currentIndex, slice)`:
the current step wins whenever its plane is the one on screen, and otherwise the occurrence
**nearest** the current step does, so browsing off the demonstration and back cannot rewind the
learner into an earlier pass. `LocalCtLesson` uses it for the overlay frame, for the displayed
caption/position, and in `onViewChange` where a browsed slice moves `s.frame`. Nothing else changed:
no graph, no Daughter A/B source assignment, no response plane, no stored answer, no nomenclature
and no camera geometry. Reference identity is now keyed on the authored step, never on a plane
number, so the CT caption, the course-locator sentence, the drawn locators and the transport
position agree with the step the learner is in.

### Finding 2 (P2) · the reason an occluded daughter carries no wall label was hidden

**Reproduction.** Lesson 8 (`orientation-changes`), second LB6 example
(`left-lower-returning.junction-25.integration`), slice 345: Daughter B is correctly withheld from
the airway wall because its projected point is behind the wall, and the sentence that says so
exists in the DOM — but `document.elementFromPoint` at every point down that sentence returned the
`<canvas>`. Reproduced at 1427 × 1226, 390 × 844 and 320 × 740.

**Root cause.** `.pairedScope` was `aspect-ratio: 1; position: relative` with
`.pairedScope .clinicalCanvas { position: absolute; inset: 0 }`. The explanation is an in-flow
sibling of that canvas, so it was laid out inside the same square and painted underneath an opaque
positioned element at every width.

**Repair.** `.pairedScope` becomes a flex column; the canvas keeps its square through
`aspect-ratio: 1` in normal flow (still `position: relative`, so the opening-letter SVG overlay
still covers the camera exactly); the explanation takes its own space beneath it. Loading,
surface-error and 3D-boundary paragraphs keep the square the camera will fill, so mounting the
canvas shifts nothing. The ray cast, the geometry, the suppression rule and the wording are all
unchanged — Daughter B is still not drawn on the wall; the sentence that explains why is now
readable.

### Tests added by the repair

- `__tests__/demonstration-step-identity.test.tsx` (4): the authored Lesson 4 demonstration really
  does walk slice 419 in three steps; `demonstrationFrameIndex` resolves by step and by nearest
  occurrence; Lesson 4's first use (step 18), return-trip use (step 25) and Daughter B's use
  (step 62) of slice 419 each keep their own caption, locator label and transport position across
  the transition and across a CT rotation and a return to standard axial; Lesson 8's lead-in and
  Daughter B's pass keep slices 327 and 332 apart.
- `e2e/branch-tracing.spec.ts` (4): one rendered-browser check that a demonstration plane reached
  twice keeps the identity of the pass the learner is in (Lesson 8, steps 6, 22 and 27, with the
  drawn locator count asserted at each); and the occluded-daughter reason at 1427 × 1226, 390 × 844
  and 320 × 740, asserting `elementFromPoint` returns the sentence at three points down its
  bounding rectangle, that the rectangle sits inside the viewport, that the canvas ends above it,
  that Daughter B is still absent from the wall while Daughter A is drawn, and that reading it
  moved neither the CT slice nor the recorded responses.

All eight fail on `a96047ef` and pass after the repair. The browser four were run against a
production build of `a96047ef`'s two repaired files restored from Git (4 failed: the Lesson 8
caption read "Demonstration slice 327 · 6 of 29 · Approach context…" instead of step 22, and
`elementFromPoint` returned `false, false, false` at all three sizes), then against the repaired
build (4 passed).

### Validation after the repair

| Check                                                                         | Result                                                                                                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New focused Jest regression (repeated-plane step identity)                    | 4 passed                                                                                                                                                                  |
| New focused Playwright regressions (step identity, occlusion)                 | 4 passed on the repaired production build; the same 4 failed on the reviewed-head build                                                                                   |
| `npx jest src/features/bronchial-branch-tracing`                              | 141 passed, 1 failed across 23 suites (142 tests); the failure is the same documented access-contract assertion                                                           |
| Playwright `branch-tracing.spec.ts` (production build)                        | 53 passed, 0 failed, 0 skipped, 1.3 min — includes the Prompt 02 compact Check stability trio at 390 × 844, 1024 × 768 and 1427 × 1226 and the decoded-image caption trio |
| Playwright `systemic-ux-stabilization -g bbt` (production build)              | 3 passed: `bbt: native workspace scroll ownership` at 1600, 1440 and 1024                                                                                                 |
| `npx tsc --noEmit` (repository, after the final edit)                         | Clean, exit 0, no diagnostics                                                                                                                                             |
| `npx eslint src/features/bronchial-branch-tracing e2e/branch-tracing.spec.ts` | Clean, no warnings                                                                                                                                                        |
| `npx prettier --check` (changed paths)                                        | Clean                                                                                                                                                                     |
| `npm run build` (production)                                                  | Passed, exit 0; standalone output prepared                                                                                                                                |

Counts are unique runs. The reviewed-head baseline run is recorded as evidence for the new tests,
not as a second pass of the suite. The production server for these runs was
`.next/standalone/server.js` on port 3001, which is the port `playwright.config.ts` already names,
with `.env.example` placeholders passed as process environment only; no `.env` file was created or
read.

### Heads

| Field                           | Value                                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Independently reviewed old head | `a96047ef3766fa10c81af451887a2dc930586d16`                                                                                                          |
| Repair commit                   | `199e6e3be8b747630ad4786c202a90fb69a4fd88`                                                                                                          |
| New PR head                     | This document update is committed on top of the repair commit, so the PR head is the documents commit; `BBT-PRE-REVIEW-03-status.json` records both |
| Branch / PR                     | `claude/bbt-2-21` → [#260](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/260); pushed, **not merged, not deployed** |
| Prompt 04                       | Not started                                                                                                                                         |

### Source integrity after the repair

`git diff a96047ef --name-only` is four files: `e2e/branch-tracing.spec.ts`,
`src/features/bronchial-branch-tracing/components/LocalCtLesson.tsx`,
`src/features/bronchial-branch-tracing/components/branch-tracing.module.css`,
`src/features/bronchial-branch-tracing/engine/model-course.ts`, plus the new test file and this
document set. No `geometry/`, `public/`, manifest, fixture, packet or review-status path is in it,
so every hash in **Geometry and source integrity** above still stands, `paired-scope.ts` is still
byte-identical to the base, the 128 authored camera mappings and the draft-signature fixture are
untouched, and the access-policy assertion fails exactly as before — no access control was loosened.

## Integration repair — 2026-09-22

The independent re-review of PR #260 at head **`b0e7b1dbcf6e7730abafc82298ac55316b11025c`** passed
both repairs above and left one blocker: a merge conflict with main in `.claude/launch.json`. This
pass integrates main and resolves that file only. The sections above are unchanged.

**Main integrated.** The review named `745146f6e40bd536c201313f0480ddde2ee03ca3`; by execution
`origin/main` had advanced to **`d98bab79af9231eb1857e2da96cb75ca2068d85c`** (merge of PR #254,
Bronchoscopy Foundations), a descendant of `745146f6`, so the fresher main was merged. The
integration is an ordinary merge commit (parents `b0e7b1db` and `d98bab79`); no rebase, no force
push, no reviewed commit rewritten.

**Conflict.** `.claude/launch.json` was the only conflicted file. Main's side had appended
`claude-ebus-03` (3131) and `claude-ebus-03-prod` (3132) at the end of the list; this branch had
appended `claude-bbt-03-prod` (3136) at the same place. Resolved additively: main's two entries kept
exactly as main has them, followed by `claude-bbt-03-prod` unchanged. The result is valid JSON with
20 entries — main's 19 in main's order, byte-for-byte, plus the BBT entry — no duplicate name, and
no new shared port (3120 is shared by `claude-worktree` and `claude-worktree-attached` on main by
design). Main has no `claude-bbt-03-prod` and nothing on 3136, so the BBT port was kept. At run
time 3136 happened to be held by another session's ad hoc server (`/private/tmp/hd02-base`, not a
launch entry); that process was left alone and validation used port 3001, as before.

**Source unchanged.** The committed merge tree equals `git merge-tree` of the two parents except for
the hand-resolved launch file, so the pre-commit hooks rewrote nothing. Main changed no path under
`src/features/bronchial-branch-tracing/` or `e2e/branch-tracing.spec.ts` since this branch's base
`2124cd0f`; both trees are hash-identical to `b0e7b1db` (`e40de721…` and `3c15448a…`).
`public/airway-anatomy`, `public/airway-lesson`, `geometry/` (including `paired-scope.ts`), the
camera and draft-signature fixtures, manifests, graph identities, response planes, nomenclature,
packets and review status are all untouched. The PR diff against current main is the same 26 files
as the reviewed diff, byte-identical outside `.claude/launch.json`, and the launch hunk is the one
BBT entry — no other module's merged work is carried.

### Validation on the integrated tree

| Check                                                                         | Result                                                                                                                                                                                   |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/launch.json` JSON parse (Node and Python) + Prettier check           | Valid; clean                                                                                                                                                                             |
| `git diff --check` (vs `b0e7b1db`, vs main, merge commit)                     | Clean                                                                                                                                                                                    |
| `npx tsc --noEmit` (repository)                                               | Clean, exit 0, no diagnostics, with `NODE_OPTIONS=--max-old-space-size=8192`; the first run at Node's default ~4 GB heap aborted out of memory (exit 134) before emitting any diagnostic |
| `npm run build` (production)                                                  | Passed, exit 0; standalone output prepared; no tracked file changed                                                                                                                      |
| `npx jest src/features/bronchial-branch-tracing`                              | 141 passed, 1 failed across 23 suites (142 tests); the failure is the documented `case_manifest.json` access-contract assertion (`contracts.test.ts:198`)                                |
| Playwright `branch-tracing.spec.ts` (production build)                        | 53 passed, 0 failed, 0 skipped, 1.4 min                                                                                                                                                  |
| Playwright `systemic-ux-stabilization -g bbt` (production build)              | 3 passed: `bbt: native workspace scroll ownership` at 1600, 1440 and 1024                                                                                                                |
| `npx eslint src/features/bronchial-branch-tracing e2e/branch-tracing.spec.ts` | Clean                                                                                                                                                                                    |

Each suite ran once; no rerun is counted. The server was this worktree's `.next/standalone/server.js`
on port 3001 with `.env.example` public placeholders as process environment only; no `.env` file
was created or read. Access policy was not changed.

### Heads

| Field                    | Value                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Previously reviewed head | `b0e7b1dbcf6e7730abafc82298ac55316b11025c`                                                                               |
| Main integrated          | `d98bab79af9231eb1857e2da96cb75ca2068d85c` (review named `745146f6e40bd536c201313f0480ddde2ee03ca3`, an ancestor)        |
| Integration merge commit | `6e37645172d4d4501f3b455a3d23d5aa66f3f6fb`                                                                               |
| New PR head              | The documents commit on top of the integration merge commit; `BBT-PRE-REVIEW-03-status.json` records both                |
| Branch / PR              | `claude/bbt-2-21` → #260; pushed, **not merged, not deployed**                                                           |
| Holds                    | OD-01 OPEN; OD-03 and OD-05 held; BBT-02 NOT REVIEWED; every `exercise.review.status` provisional; Prompt 04 not started |

## Next

One bounded PR, then stop. Prompt 04 follows after review and merge. OD-01 stays open; task 05
prepares its packet. Nothing here records a faculty or learner review as complete.
