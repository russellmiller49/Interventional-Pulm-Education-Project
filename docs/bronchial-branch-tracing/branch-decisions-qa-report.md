# Complete branch decisions — review record

September 11, 2026. Content `c5-all-branches-r1`. Builds on `65b8375c` / PR #179. The module remains unpublished, unlisted and anonymously accessible by direct URL.

## Repair and source

The old renderer asked for three points even where the source route passed through several intervening forks. All 17 live traces now start near the carina in the trachea and include every branching node on the source path to the target: 6–9 junctions and one separate distal nodule inspection. At each junction the learner chooses among all actual daughters, marks the lumen (or explicitly records uncertainty), records that response, and manually continues. Reviewing a previous stop cannot change its first response or unlock a future stop. Viewing the target and freely browsing slices do not advance the route.

- `scripts/branch-tracing/build-branch-decisions.mjs` reads the matching original NRRD, graph and existing labels, verifies their hashes and derives the complete route manifest.
- `geometry/branch-decisions.json` contains every parent fork, all daughter choices, native coordinates and locally centered CT crops. No new image or textbook raster is shipped.
- `build-paired-routes.mjs` now includes the full route union: 70 unchanged source polylines. The added RB3 parent edge was absent from the former regional-only union. Original source graphs and the 3D mesh remain untouched.
- Segment and subsegment labels come from the existing nomenclature specification and matching labeled graph. Unnamed descendants retain their last verified bronchial name and use relative patient directions to distinguish daughters. Those directions describe the source geometry, not new nomenclature or fixed screen positions.
- The right posterior apical target's old terminal inspection was on edge 61, before its final fork to edge 122. Its new inspection includes that daughter and explicitly notes the nodule overlap. Other target placement and all nodule patches are unchanged. The final nodule inspection can reuse the last clear daughter plane; it asks for distal continuity rather than inventing another branch.

Native CT SHA `572afc5bf6b2d80b28439e0397ad4e24e4eb6dfb2630780593259e081ae0a29b`; source graph SHA `68226a87928135f8be1435c78774f455dab8f792c085509100aa6c21304c18f4`; labels SHA `fc446faabf7654592b88ec7315321a9c874244efac29f5de2dcd501d2a9f7f8a`. The earlier [nomenclature review](nomenclature-review.md), [nodule target review](nodule-target-review.md) and [orientation review](orientation-qa-report.md) retain source provenance and preserved-asset checks.

## Teaching and response boundary

The eight existing concepts and six-stage shared lesson remain. Each lesson now includes a complete guided path and a complete changed-target transfer. A compact connection diagram identifies the current parent and all daughters while actual CT and virtual bronchoscopy stay paired. At a junction the camera looks from the parent toward the fork without aiming into the answer daughter; while browsing slices the previous plane-correspondence behavior remains. New junctions return the shared panes to their beginning.

Learn exposes a junction comparison only after that junction is recorded, retains wrong and unresolved responses, and explicitly continues along the source example. Practice/Assess remain fixed-route interpretation worksheets: each next junction is supplied on the source route even if the learner chose otherwise. They withhold explicit comparisons/reference marks until the set is submitted. The selections do not steer an adaptive bronchoscope and are not clinical grades. The worksheet export includes every choice alongside the parent and offered daughter labels. Incomplete work restarts after reload; stored participation history remains in the existing bounded adapter.

The textbook supports branch tracing and nomenclature; this implementation's camera stations, relative direction labels and nodule targets remain authored teaching constructs. Clinical camera/ostial approval and novel-patient validity are not claimed.

## Verification

- `npx jest src/features/bronchial-branch-tracing src/features/learning-module src/lib/bronchoscopy-core/core.test.ts src/lib/site-auth/access.test.ts src/lib/draft-modules.test.ts src/lib/airway-anatomy/geometry.test.ts src/lib/airway-anatomy-lesson/airway-graph.test.ts --runInBand` — **25 suites, 225 tests passed**. This includes native PNG/HU fidelity, all forks and siblings, monotonic route stations, camera aim, exact common-trunk daughter labels, no-skip gates, wrong-response retention, changed transfers, progress and existing module regressions. The source-label check was rerun after the common-trunk correction: **3/3 passed**.
- `npx eslint src/features/bronchial-branch-tracing scripts/branch-tracing/build-branch-decisions.mjs scripts/branch-tracing/build-paired-routes.mjs e2e/branch-tracing.spec.ts` and `npm run type-check` — **passed**. A final case-navigation adjustment uses React state for the furthest visited case, keeping session drafts in event handlers and satisfying the React refs rule.
- `npx next build --webpack && npm run prepare:standalone` — production build and packaged output passed; pre-existing metadataBase and Mermaid dependency warnings remain unrelated to this feature.
- `BRANCH_TRACING_BASE_URL=http://127.0.0.1:3112 npx playwright test --config=playwright.branch-tracing.config.ts` — **17/17 passed** against the packaged preview (3.3 minutes). Actual pointer marks at every stop, all eight lessons plus changed transfers, a full four-case worksheet, wrong choices, delayed feedback, first-response export, case backtracking, image and nodule-patch recovery, WebGL recovery, independent explorer controls, anonymous/noindex routes and a complete phone route were exercised. After the React case-navigation adjustment, the two affected independent-case/backtracking checks were repeated against the final rebuilt package: **2/2 passed** (21.5 seconds).
- The structured-module `audit-stage.mjs` passed at 1440×900, 1280×720, 1024×768, 900×800 and 390×844. This is an initial layout/keyboard smoke check, not a clinical or accessibility certification. E2E also checks 320 px reflow. Paired images and lower controls remain inside the existing scrollable simulator pane; Expand both views remains available.

Actual screenshots inspected: the live ventilation reference at 1440×900, the target at matching dimensions, the recorded RB5 → RB5b decision, the next distinct bifurcation within RB5b, and compact/short-height initial views. The native images and virtual surface were allowed to load before the saved junction screenshots. The reference is `VentilationStageHost.tsx` (`breathing-with-support`), using the same unmodified `StageLayout` / `ResizableTeachingWorkspace`, pane order, opening fractions and floors.

- [Recorded RB5 division](review/branch-decisions-comparison.png)
- [Next distal RB5b division](review/branch-decisions-daughters.png)
- [Actual shared-stage reference](review/branch-decisions-reference.png)

| Contract                    | Result | Evidence                                                                                                                                                                                                                                                                             |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H1 One curriculum           | PASS   | Stable eight-lesson registry and URLs, shared next-incomplete resolver, overview and separate Learn/Practice/Assess; anonymous/noindex browser checks.                                                                                                                               |
| H2 Teach before testing     | PASS   | Worked orientation/route, guided daughter choice and CT mark at every fork, comparison, explanation and changed-target transfer; all eight real journeys exercised.                                                                                                                  |
| H3 Shared stage             | PASS   | Existing stage imports; Steps → Teaching → Simulator, fractions .26/.29, floors 300/280/340; matched reference and layout audit.                                                                                                                                                     |
| H4 Current task             | PASS   | One NowCard; current parent and choices in Steps; live CT landmarks; recording/Next actions correspond to reducer gates.                                                                                                                                                             |
| H5 Rendered teaching        | PASS   | Current-junction connection diagram, source names/directions, worked pattern and interpretation render in their actual phases.                                                                                                                                                       |
| H6 Real completion          | PASS   | Every graph fork requires a daughter response and lumen response, explicit recording and sequential advancement. Target viewing cannot unlock the route. Transfer and final completion remain separate actions.                                                                      |
| H7 Feedback boundary        | PASS   | Learn reveals only recorded junctions; wrong/uncertain choices remain fixed. Practice/Assess withhold explicit comparisons until set submission; their fixed-route context is stated. Source coordinates are absent from pending DOM annotations. No safety intervention is modeled. |
| H8 Source fidelity          | PASS   | Original CT/patch/mesh unchanged; source graph/label hashes, native pixel/HU tests, every sibling (including three-way divisions), and preserved native inverse transforms. Camera points at the fork from its parent.                                                               |
| H9 Honest progress          | PASS   | Existing bounded adapter and stable IDs; c5 participation separates the new task from historical completion. No grades/mastery. Incomplete reload boundary and session-only choices are explicit; case review preserves first responses.                                             |
| H10 Clinical language       | PASS   | Existing bronchial terminology retained; LB4 and LB7+8 remain distinct from their common trunks; unnamed distal forks receive relative patient directions, not invented segment suffixes.                                                                                            |
| H11 Scope/release           | PASS   | Feature, authoring scripts, tests and review documentation only. No shared stage, dependency, authentication, catalog, source-volume, upload or deployment change. Draft/unlisted/anonymous behavior preserved.                                                                      |
| H12 Demonstrated experience | PASS   | 225 automated checks and 17 packaged browser cases; actual reference/target inspection, keyboard and phone route, wrong/reset/review/reload/error states. Clinical approval remains separate and pending.                                                                            |

## Boundary reached

Complete source-derived branch sequences are implemented in every Learn trace, Practice target and Assess worksheet. The local preview and existing draft PR contain the implementation; no merge or publication is part of this task. The offline build does not require Slicer to be open and does not alter the user's scene or input CT. The local environment still lacks credentials for the unrelated shared analytics endpoint; its server-side log errors do not block the anonymous module or browser-local progress. No changes were made to that service.

Faculty review of the virtual camera/ostia and image-based branch interpretation, and testing on additional patients, remain outside the claim of this unpublished educational preview.

## Route coverage

| Authored trace        | Target segment | Branch decisions | Final inspection       |
| --------------------- | -------------- | ---------------: | ---------------------- |
| central-right         | RS5            |                8 | Distal nodule approach |
| central-left          | LS5            |                8 | Distal nodule approach |
| right-upper-entry     | RS1            |                7 | Distal nodule approach |
| right-upper-apical    | RS1            |                7 | Distal nodule approach |
| right-upper-distal    | RS1            |                7 | Distal nodule approach |
| middle-lobe-entry     | RS5            |                8 | Distal nodule approach |
| middle-lobe-lateral   | RS4            |                7 | Distal nodule approach |
| middle-lobe-caudal    | RS5            |                8 | Distal nodule approach |
| middle-lobe-cranial   | RS5            |                8 | Distal nodule approach |
| upper-oblique-lateral | RS3            |                6 | Distal nodule approach |
| upper-oblique-medial  | RS3            |                7 | Distal nodule approach |
| left-upper-division   | LS1+2          |                9 | Distal nodule approach |
| left-upper-anterior   | LS3            |                8 | Distal nodule approach |
| left-lingula          | LS5            |                8 | Distal nodule approach |
| left-lower-returning  | LS6            |                8 | Distal nodule approach |
| right-lower-basal     | RS8            |                8 | Distal nodule approach |
| left-lower-basal      | LS9            |                6 | Distal nodule approach |
