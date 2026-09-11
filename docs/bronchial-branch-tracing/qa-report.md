# Native CT module QA

September 11, 2026 · content `c2-ct1-r2` · native-v1 · nomenclature-v1 · unpublished anonymous preview. This report supersedes the initial synthetic-preview QA. Engineering review only; faculty approval is not asserted.

## Delivered experience

Eight lessons now use real native CT, including the book's reflected axial, RUL counterclockwise and left-upper-division clockwise conventions. All 17 routes and 51 checkpoints now carry anatomical airway names. The learner browses adjacent planes, places three lumen marks, describes the course and compares the actual marks on the same CT. Each lesson requires another trace before manual completion. Practice/Assess delay comparison until four interpretations are submitted. Standard/full-field/expanded CT, inverse-coordinate marking, keyboard navigation, uncertainty responses and local worksheet export are available. The secondary whole-volume CT/exterior/virtual viewer is preserved.

The original NRRD was loaded in isolated Slicer 5.12.3 and exported at native 512×512 resolution and 0.5 mm spacing. The book's full text and relevant figures were read locally. No source volume, textbook figures, Slicer scene, named branch spreadsheet or protected source is redistributed or mutated.

## H1–H12

| Rule                    | Status in this preview                  | Evidence                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1 One curriculum       | PASS                                    | Overview/Learn/Practice/Assess; canonical eight-lesson registry supplies IDs, sequence, duration, objective, prerequisites and next-incomplete links. Free exploration remains secondary.                                                                                                                                                    |
| H2 Teach before testing | PASS                                    | Purpose, prerequisite, concept and worked real CT precede the learner trace. Each lesson has its own regional task, explanation and changed CT transfer. The new-patient validation boundary is explicit.                                                                                                                                    |
| H3 Shared stage         | PASS                                    | Existing StageLayout and reference host; explicit Steps → Teaching → Simulator, 0.26/0.29 opening fractions, 300/280/340 floors. No shared stage edits.                                                                                                                                                                                      |
| H4 Current task         | PASS                                    | One NowCard and one contextual primary action. Real trace/course controls, visible pane labels and valid LookInLine landmarks. Independent final submission occupies the same primary location so the sticky task cannot cover it.                                                                                                           |
| H5 Rendered teaching    | PASS                                    | Clinical purpose/prerequisite, Read the course, Worked CT example, Reading this airway and source pages render in their authored phases. Reference points are conditionally mounted; hidden future answers are not CSS-only.                                                                                                                 |
| H6 Real activity        | PASS                                    | Three actual marks or explicit unresolved responses and a course are required. Wrong-slice/invalid coordinates are rejected. Changed transfer starts empty and requires a new interpretation. No visit-only or Continue-only completion.                                                                                                     |
| H7 Mode-aware evidence  | PASS                                    | Learn comparison withheld until trace/course recording. Practice/Assess comparison withheld until final submission. Assess has no hints. Misplaced marks remain unchanged. First participation/hint count survives restart/reload. No clinical correctness is inferred.                                                                      |
| H8 Source fidelity      | PASS for stated engineering scope       | Native source SHA, voxel basis, PNG hashes/intensity window, pixel-center alignment and book transforms verified. Existing surface/camera explorer preserved. Clinical continuous registration and named ostial approval remain unestablished.                                                                                               |
| H9 Honest progress      | PASS                                    | Existing bounded activity envelope only. New version retains c1 history. First trace saved before comparison; completion requires transfer and Finish. No grade/mastery or coordinate/camera persistence. Incomplete sessions restart. Explicit worksheet download is local.                                                                 |
| H10 Clinical language   | PASS for source-grounded implementation | Named main/lobar/segmental bronchi and textbook-guided subsegments are rendered in controls, maps and CT annotations. R/L/B/S notation, common trunks and proximal/distal positions are distinguished. Naming provenance and formal review boundary are documented in nomenclature-review.md.                                                |
| H11 Scope/release       | PASS                                    | Feature, tests, docs and asset exporter only in this revision. Original narrow public-unlisted policy retained. No shared CSS/stage, auth infrastructure, dependencies, databases, protected inputs, other-agent source, uploads, deployment, merge or catalog changes.                                                                      |
| H12 Experience proof    | PASS for tested engineering states      | Actual pointer and keyboard handlers, all eight lessons, wrong marks, uncertainty, manual reveal/transfer, delayed debrief, backtracking/edit gating, export, reload/storage failure, stale links, image recovery, WebGL recovery and compact view switching exercised. Native assistive technology and clinical-device studies are not run. |

## Reproduction and results

```sh
npx jest src/features/bronchial-branch-tracing src/features/learning-module src/lib/site-auth/access.test.ts src/lib/draft-modules.test.ts src/lib/airway-anatomy/geometry.test.ts src/lib/airway-anatomy-lesson/airway-graph.test.ts --runInBand
npx tsc --noEmit
npx eslint src/features/bronchial-branch-tracing e2e/branch-tracing.spec.ts scripts/branch-tracing/browser-metrics.mjs
npm run build
npx playwright test --config playwright.branch-tracing.config.ts
```

- **21 Jest suites / 203 tests passed**, including shared stage/progress/access/geometry regressions, native PNG/HU/coordinate checks, real rendered lesson handlers and axe accessibility checks. Feature tests repeated after the viewer refinements.
- TypeScript and feature ESLint passed. No new dependencies were installed.
- **11 Playwright tests passed** on the development server (10 existing journeys plus the focused anatomical-label check), including all eight learner journeys and the four-interpretation assessment. The label revision verifies named checkpoint selection, the RB5b comparison and RB5a transfer, all three book conventions, expanded-view control visibility and retained marks.
- Full `npm run build` passed, including both embedded trainer builds, content generation, critical-care/cardiac validators and standalone packaging. Existing trainer chunk, module.register, Mermaid import and metadataBase warnings were unrelated to this feature.
- The shared stage's initial-layout smoke audit passed at 1440×900, 1280×720, 1024×768, 900×800 and 390×844. Playwright also checked 320 px reflow. This smoke audit is not a pedagogy or clinical validator.

The Next production build and standalone package were rebuilt for the nomenclature revision. All eight lessons, all three book transforms, external/inline named airway controls, expanded-view navigation, every debrief trace, anonymous image/model loading and resilience were exercised on the packaged preview at `http://127.0.0.1:3112`. **All 11 Playwright tests passed against the final packaged preview in 24.6 seconds** after the last on-image label legibility refinement. The existing local preview server was restarted on that same port. Its unrelated site metadataBase warning and missing analytics credentials do not gate the feature; no environment file was edited.

The earlier native-CT baseline [measurements](browser-metrics.json), before the nomenclature revision, used Chromium 151, 1440×900, a fresh browser context, 20 Mbps down/5 Mbps up and 40 ms emulated latency. The first learner CT task was ready in 1,533 ms. Transfer by that point was 2,120,330 bytes total, including 1,221,186 bytes across six native images (worked example plus learner trace and their neighbors), with zero GLB requests. Ten adjacent slice inputs took 2–280 ms, including cached/preloaded images and Playwright overhead. These local measurements ran alongside QA and are not device benchmarks or a sub-100 ms guarantee. At 720×450 CSS reflow, horizontal document overflow was zero. No browser page errors were recorded.

## Source evidence and limits

The native asset test reads all **236 PNGs**, verifies SHA/size and 512×512 grayscale format, and compares original source HU with exported windowed intensity at all **51 comparison samples**. Pixel/display inverse tests cover all 17 traces in cropped and full fields, including an asymmetric rotation-direction fixture. Slice ranges include every checkpoint/anchor. Mathematical LPS/IJK roundtrip precision is 2.84×10⁻¹⁴ mm, not a clinical registration measurement.

Original graph geometry is not silently corrected to match an expected answer. Some distal intervals cross partial-volume/wall voxels; selected checkpoints sample air, and the UI asks learners to inspect intervening source slices. No continuous clinical registration, approved subsegmental key, ostial annotation or held-out patient score is claimed. See [clinical-review.md](clinical-review.md).

## Visual review

Actual target images, reference workbench, CT crops, comparison/debrief and compact layouts were opened and inspected. The reference mechanical-ventilation host is unchanged at the same base; its 1440×900 image is retained in `review/ventilation-reference.png`. The shared audit's reference compact-tab heuristic limitation from the initial review remains a tool limitation, not a change to that module.

Durable current screenshots are in [review](review/). Desktop panes scroll independently, so a full-page screenshot does not show every offscreen internal control. Expanded CT provides a larger source image with slice/trace controls visible together. Reflow is also measured at 720×450 CSS pixels, equivalent to the layout area of 1440×900 at 200% zoom; native browser zoom and native screen readers are not claimed.

## Anatomical-name verification

The supplied textbook figures were rendered and visually inspected for segmental nomenclature, RUL a/b branches and RML subsegments. The two existing case graphs have identical complete polylines and node connections for all **36 selected edges**. Every labeled checkpoint lies on its assigned source edge within 0.0001 mm numerical rounding tolerance. Source labels and both graphs are hash-verified; each clinical assignment records its source and reasoning. See [nomenclature-review.md](nomenclature-review.md).

The annotation generator is deterministic. Removing its new fields reproduces the previous native manifest exactly: no changes to CT pixels, asset hashes, sample locations, ranges, HU values or camera poses. Every one of the 51 points has an anatomical name, and repeated points in one bronchus use proximal/distal or midportion qualifiers. Tests specifically distinguish two RB5 points on the same acquisition plane, the RB5a/RB5b siblings, the right B1–B2 common trunk, left LB1+2 and unrefined distal LB6.

Rendered tests and browser handlers verify visible full names, delayed reference locations and manual course/transfer gates. The focused browser journey records RB5b, reveals its named gold cross on the actual CT, then traces RB5a with fresh marks. Wrong learner marks remain labeled as learner marks rather than asserted anatomical truth. Names are the requested tracing targets, not an identification question's hidden answers. Local worksheet exports include the same named route and checkpoint metadata.

The shared five-viewport audit passes after the naming change; full browser checks also cover 320 px reflow. At 390 px, all four named CT navigation buttons measure 151×54 px, with zero button or document horizontal overflow. The enlarged on-image label is limited to the active checkpoint to avoid overlap when two checkpoints share a slice; labels near the right edge align leftward. Actual named CT screenshots were inspected at desktop and expanded sizes, and the current desktop target was compared with the unchanged saved ventilation reference. Faculty clinical sign-off, native screen-reader/device studies and new-patient validity are not claimed.

Current anatomical-label evidence: [RB5b comparison](review/named-rb5b-comparison.png), [expanded RB5b](review/named-rb5b-expanded.png) and [expanded RB5a](review/named-rb5a-expanded.png). Earlier screenshots document the preceding CT implementation.

## Release boundary

This is the requested CT-based, anonymous direct-URL preview. It remains unlisted and noindex. No publication, deployment or merge occurred. Multiple regional traces are one patient case. Faculty review and a distinct approved transfer CT remain prerequisites for clinical scoring and new-patient validation, not blockers to the delivered ungraded CT module.
