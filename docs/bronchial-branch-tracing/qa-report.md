# CT nodule route module QA

Historical c3 report. The current orientation and paired-view revision is documented in [orientation-qa-report.md](orientation-qa-report.md).

September 11, 2026 · `c3-target1-r1` · native-v1 + targets-v1 · unpublished anonymous preview. This report supersedes the regional tracing QA at `6152ade3`. Engineering and image review only; faculty approval is not asserted.

## Delivered journey

The learner inspects a simulated nodule in a named segment, returns to the parent airway, and follows the real CT air column through three checkpoints. A course and distal airway–nodule interpretation are required before comparison. Learn retains all eight lessons, the textbook display conventions and four tracing patterns, source-grounded airway names, worked examples, explanation and a changed-target transfer. Completion requires the transfer and a separate Finish action.

Practice offers a target-segment selector or a mixed four-target set. Assess requires four interpretations with delayed comparison. Thirteen authored targets cover ten segments through 17 traces in one source CT. The existing exterior/virtual-airway explorer remains a secondary Practice tool. Nodules are CT teaching overlays; the module does not demonstrate instrument reach or tool-in-lesion.

## H1–H12

| Rule                    | Status for this revision                | Evidence                                                                                                                                                                                                                                                                                                                                          |
| ----------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1 One curriculum       | PASS                                    | Overview/Learn/Practice/Assess and the canonical eight-lesson registry/resolver are retained. Segment selection is in Practice. Free exploration remains secondary.                                                                                                                                                                               |
| H2 Teach before testing | PASS                                    | Purpose, prerequisite, concept and worked CT example precede tracing. Named nodule destinations add a planning problem to the retained orientation/pattern lessons. Every prediction/transfer pair has different target IDs.                                                                                                                      |
| H3 Shared stage         | PASS                                    | Existing StageLayout and reference host. Explicit Steps → Teaching → Simulator, 0.26/0.29 opening fractions, 300/280/340 floors. No shared stage changes.                                                                                                                                                                                         |
| H4 Current task         | PASS                                    | One NowCard and contextual primary action. Actual marks, course and relationship controls are colocated in Steps; visible look-in landmarks remain valid. Target controls are labeled in the simulator.                                                                                                                                           |
| H5 Rendered teaching    | PASS                                    | Purpose, concept, worked example, named destination, distal-continuity guidance, comparison and sources render in their authored phases. Reference coordinates are absent from pending DOM.                                                                                                                                                       |
| H6 Real activity        | PASS                                    | Three actual marks or unresolved responses plus course and relationship are required. Show target does not satisfy those gates. Transfer resets marks and both interpretations; manual Finish remains required. Wrong-slice and non-finite coordinates are rejected.                                                                              |
| H7 Mode-aware evidence  | PASS                                    | Learn reveals after the required interpretation; Practice/Assess wait for set submission. Unresolved and adjacent-structure choices receive matching debrief guidance. Wrong learner marks remain unchanged; Assess has no hints. No clinical score is assigned. No patient-treatment action is modeled.                                          |
| H8 Source fidelity      | PASS for stated engineering scope       | Exact trainer compositor reused before windowing; source/donor/core hashes, CT pixel registration, changing patch footprints and native image hashes checked. All 70 selected edges retain matching topology; the two known LB6 junction-coordinate differences are explicitly recorded. See target review.                                       |
| H9 Honest progress      | PASS                                    | Existing bounded activity envelope only. c1/c2 records remain history; c3 records new target participation. Incomplete sessions restart. First participation/hint count and completed lessons persist, without grade/mastery or raw-coordinate persistence. Exported worksheets identify the simulated target and actual response.                |
| H10 Clinical language   | PASS for source-grounded implementation | Conventional R/L/B/S labels and curated subsegment names retained. Destination, course, visible air column and unresolved distal connection replace abstract level tasks. No finer suffix is inferred from graph depth.                                                                                                                           |
| H11 Scope/release       | PASS                                    | Feature, tests, docs and feature exporter/assets only. No shared core/stage/CSS, auth, dependency, database, protected-source, trainer, upload, catalog, deployment or merge changes. Anonymous unlisted/noindex policy remains intact.                                                                                                           |
| H12 Experience proof    | PASS for tested states                  | Real pointer/keyboard actions across all eight lessons; wrong marks, uncertainty, changed-target transfer, delayed debrief, backtracking/edit gates, export, reload, stale links, image/nodule/WebGL recovery, segment selection, phone completion and compact pane switching. Native screen-reader and clinical validation studies were not run. |

## Commands and results

```sh
npx jest src/features/bronchial-branch-tracing src/features/learning-module src/lib/bronchoscopy-core/core.test.ts src/lib/site-auth/access.test.ts src/lib/draft-modules.test.ts src/lib/airway-anatomy/geometry.test.ts src/lib/airway-anatomy-lesson/airway-graph.test.ts --runInBand
npx tsc --noEmit
npx eslint src/features/bronchial-branch-tracing scripts/branch-tracing/build-targets.ts scripts/branch-tracing/browser-metrics.mjs e2e/branch-tracing.spec.ts
npx next build --webpack
npm run prepare:standalone
BRANCH_TRACING_BASE_URL=http://127.0.0.1:3112 npx playwright test --config=playwright.branch-tracing.config.ts
BRANCH_TRACING_BASE_URL=http://127.0.0.1:3112 npx playwright test --config=playwright.branch-tracing.config.ts --grep 'phone learner'
```

- **23 Jest suites / 218 tests passed.** Includes feature rendering/axe, original and target pixel/HU/provenance checks, shared stage/progress/access regressions and core CT geometry tests.
- **TypeScript and feature/exporter ESLint passed.** No dependency installation or shared source edit.
- **Next production build and standalone packaging passed.** The unchanged embedded trainers had already passed the full build in the preceding revision. This revision rebuilt Next and repackaged the existing trainer outputs. Existing metadataBase/Mermaid/module-register notices do not originate in this feature.
- **13 browser tests passed on the final packaged preview in 26.3 s.** Coverage includes all eight complete learner journeys, the four-target assessment, single-segment practice, the actual nodule patch/rotation/original-image toggle, error recovery and delayed feedback. An additional complete phone workflow then passed in 0.98 s: **14 browser checks total**, all against the same packaged runtime. The development suite also passed before final packaging.
- The shared initial-layout audit passed at **1440×900, 1280×720, 1024×768, 900×800 and 390×844**. Browser regression also checked 320 px reflow. This audit measures layout/pane switching, not pedagogy or clinical accuracy.
- The local standalone server was restarted on **http://127.0.0.1:3112**. Anonymous routes and source/target PNG loading were exercised there. No public deployment occurred.

## Source and pixel checks

The baseline asset test still verifies all 236 native PNG hashes and the original 51 samples' signed-HU windowing. Target tests verify all 377 new PNG hashes, image dimensions, binary alpha footprints and changing slice extents. At each of the 13 target centers, actual base pixels match signed source HU and patch pixels match the shared residual compositor before windowing. Distal comparison points lie in source air upstream of the donor signal. First and second checkpoints remain unchanged.

All required acquisition planes exist. All target paths follow connected edges with the intended segment label. Every displayed reference point lies on its assigned original polyline within 0.0001 mm rounding tolerance. The labeled graph and CT graph differ at a single pre-existing LB6 junction by 0.1349908221 mm, affecting two incident vertices; the exporter and tests explicitly check those exact differences and require all other selected vertices to match. This is correspondence evidence, not a clinical registration threshold. See [nodule source and placement review](nodule-target-review.md).

The source-derived geometry is a comparison aid. It does not certify continuous airway visibility through every interval. The UI allows unresolved continuity and asks the learner to inspect the distal image evidence. Anatomical naming still follows the supplied book and the prior [figure-based nomenclature review](nomenclature-review.md).

## Visual inspection and measurements

Final target placements were inspected on real CT in the appropriate display conventions. The first lingular placement had distracting adjacent opacity; the final target lies farther along LB5 at edge 353. The original CT and graph were not changed. The final [13-target contact sheet](review/nodule-target-placements.png) records the reviewed placements.

Actual lesson, selected-segment Practice, expanded CT, comparison, debrief and phone images were opened and inspected. The target uses the same shared stage as the unchanged [ventilation reference](review/ventilation-reference.png), compared at 1440×900. Pane widths/order and named captions remain consistent. Desktop/compact panes scroll internally; a full-page screenshot does not expose every offscreen control. The separate phone journey operated the actual offscreen controls through pane scrolling and manual tab switching, then submitted a real interpretation.

- [RS5 pending lesson](review/nodule-rs5-pending.png)
- [RS5 expanded target](review/nodule-rs5-expanded.png)
- [LS3 expanded target in the clockwise view](review/nodule-ls3-expanded.png)
- [LS5 phone target](review/nodule-ls5-phone.png)

[Nodule browser measurements](nodule-browser-metrics.json) used Chromium 151, 1440×900, a fresh context and 20 Mbps down/5 Mbps up/40 ms emulated latency on the local packaged server. The first learner CT/nodule was ready in **1,742 ms**. Total transfer at that point was 2,120,203 bytes, including 1,210,179 native-image bytes and **1,552 nodule-patch bytes**, with zero optional model requests. Ten adjacent-slice actions took 3–782 ms including Playwright overhead and cached/preloaded images. Equivalent 200% reflow at 720×450 had zero horizontal document overflow, with no page errors. These are local measurements, not device benchmarks or a sub-100 ms guarantee.

## Release and review boundary

The requested nodule-directed, educational CT module is delivered as an unpublished, anonymous direct-URL preview. Source assets, original trainer behavior and earlier progress history remain intact. No merge, publication, upload or deployment was performed. Faculty clinical approval, a separate-patient transfer case, instrument simulation and clinical scoring are not claimed.
