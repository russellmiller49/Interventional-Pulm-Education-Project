# Local CT teaching and draft restoration

Implementation of the September 12, 2026 branch-tracing improvement brief. The existing native CT, source graphs, named branches, coordinate transforms, paired airway engine and navigation simulator are unchanged. This is an unpublished educational preview.

## Learner sequence and alignment

For fellows and bronchoscopists familiar with an air-filled airway on CT. These exercises support image interpretation and spatial reasoning (Miller: knows how); participation does not establish procedural competence.

| Stage                | New task                                                                  | Recorded evidence and feedback                                                                     |
| -------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Follow one airway    | Keep one lumen in view across a short interval                            | A nearby-slice mark or uncertainty; immediate model comparison and retry                           |
| Follow a bifurcation | Follow a parent into both daughter lumens                                 | Separate marks on explicit answer slices; comparison of the intervening CT                         |
| CT and parent view   | Separate patient direction, display transformation and camera orientation | A numbered-opening response before labels and the matched airway view become available             |
| Four patterns        | Inspect one local division and describe its course                        | Both daughter responses and course, followed by parent-view interpretation                         |
| Short route map      | Verify three successive divisions from LB6                                | Siblings remain visible in a progressive parent-view schematic; the learner selects a continuation |
| Complete tracing     | Integrate orientation, every fork, distal continuity and uncertainty      | Full routes retain their existing gates and interpretation responses                               |
| Practice             | One coached route by default; mixed sets remain available                 | Each recorded junction reveals a comparison; retries preserve previous responses                   |
| Assess               | Independent full-route interpretations                                    | No branch comparisons or reference overlays until final set submission                             |

The first exercise includes an explicitly initiated slideshow, pause, adjacent-frame steps, replay, and a caption transcript. Later local examples start at an attempt; a requested level-three hint exposes the walkthrough. There is no autoplay on entry or reload. Hints identify the inspection region, return to the authored parent, and replay the interval without resetting answers. Full-route practice remains linked from local lessons.

Foundation and pattern lessons use the shared `LessonShell`, `SectionHeader` and `NowCard` with a module-specific CT-first arrangement. The task pane beside the CT contains the sole task-advancing action. Supporting airway views load on demand after the local viewpoint response. Shared layout APIs and other modules are unchanged.

## Warm-up progression repair

The September 13 follow-up addressed a learner who placed a mark on slice 412 but could not identify the purpose or next action. The task previously continued to ask for a mark, a requested walkthrough remained open, and the review button was separated from its instruction by most of a wide screen.

The first lesson now explicitly introduces a brief viewer warm-up: keep the same lumen in view across adjacent slices, record the selected lumen, and compare the start and response before moving to bifurcations. The visible sequence is `Start tracing → Review my mark → Next airway → Review my mark → Continue to bifurcations`. Placing a mark or recording uncertainty changes the task heading, stops the walkthrough and exposes a highlighted review action beside the instruction. Review offers direct starting-slice and response-slice controls. The final action saves completion and opens the existing bifurcation lesson.

The progression repair changes presentation and the final navigation handler. Lesson data, annotation versions, draft signatures and native geometry are unchanged, so an existing slice-412 mark remains compatible. Tests restore the pending mark and preserve the first response through both warm-up intervals. The language edit uses the existing objective and supplied brief; it does not add clinical recommendations or claim transcript calibration or faculty validation.

The subsequent screen-space repair puts the task card at the top of the left column, with teaching below it and the CT spanning the full activity height. Course navigation uses compact text links; the lesson title and utilities share one row on desktop. Routine duration/save/restore details remain in Help, while storage failures and incompatible drafts still appear immediately. Compact layouts scroll the lesson headers away and keep only the current task beneath the existing site navigation.

The local viewer uses one Axial CT heading. Slice browsing and marking controls sit together beneath the larger image. Duplicate response instructions and the warm-up's unrelated route/viewpoint boilerplate are removed. The source geometry, mark handlers, slice limits, draft signature and shared stage files are unchanged.

Measured after restoring a placed mark, with the ordinary site header present and without expanding the viewer:

| Viewport   | Available CT activity pane | Share of viewport height | CT image size | CT image top |
| ---------- | -------------------------- | ------------------------ | ------------- | ------------ |
| 2488 × 885 | 674 px high                | 76.2%                    | 520 × 520 px  | 237 px       |
| 1280 × 720 | 509 px high                | 70.8%                    | 355 × 355 px  | 237 px       |

Both layouts were inspected in light and dark mode. The browser test now checks that desktop activity height is at least 70% of the viewport, the task is beside the viewer, the full image and its essential controls remain in view after reload, and the review action remains next to its instruction. Marked and review states also cover 1024 × 768, 900 × 800, 390 × 844 and 320 × 844 without horizontal overflow. In-session dark-mode screenshots are `/tmp/branch-tracing-layout-dark-2488.png` and `/tmp/branch-tracing-layout-dark-1280.png`.

The scoped acceptance below applies to this repair, not to clinical validation of the whole module:

| Contract                   | Result | Evidence or boundary                                                                                                                                                      |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1: entry and curriculum   | PASS   | Existing Overview/Learn/Practice/Assess routes and registry remain in use; final warm-up action opens `continuity`.                                                       |
| H2: teach before testing   | PASS   | Visible purpose, captioned demonstration, own mark and start/response comparison precede the next airway. This is a viewer warm-up, not a competence assessment.          |
| H3: shared stage           | PASS   | Reuses `LessonShell`, `SectionHeader` and `NowCard`. The brief's CT-first arrangement supersedes the standard three-pane layout for these local exercises.                |
| H4: visible current task   | PASS   | One task card and primary action in the left column; the card remains visible while teaching or CT panes scroll. Compact view keeps only that task below site navigation. |
| H5: rendered teaching      | PASS   | Purpose and phase-specific guidance are open in the actual lesson; review controls navigate the real CT.                                                                  |
| H6: real activity          | PASS   | Review requires a real mark or explicit uncertainty; completion follows both attempts and their review actions.                                                           |
| H7: response and feedback  | PASS   | Actual native marks are retained, review opens only on request, and no automatic accuracy verdict or feedback-driven advance is added.                                    |
| H8: fidelity               | PASS   | Native-coordinate, asset-failure, display-transform and existing viewer regression checks remain covered.                                                                 |
| H9: progress               | PASS   | Mark-ready reload and final saved completion are tested without changing draft compatibility or first-attempt records.                                                    |
| H10: language              | PASS   | Instructions name the current slice and visible next action; the purpose distinguishes a viewer warm-up from later bifurcation work.                                      |
| H11: scope                 | PASS   | Feature components, feature tests and these notes only; the PR remains a draft and the module remains unlisted.                                                           |
| H12: rendered verification | PASS   | Real keyboard/touch progression across seven widths, 320–2488 px; desktop pane-height and CT/control visibility assertions, plus inspected light/dark screenshots.        |

The bundled `audit-stage.mjs` returned **BLOCKED (exit 2)** because it requires the standard three-pane `data-stage-frame`; the authorized local CT workspace does not mount that frame. Its result is not counted as a pass. Feature-specific Playwright checks exercise this layout and its real controls instead. Faculty review and a learner pilot remain separate pending work, as detailed below.

## Annotation and clinical boundary

Every supplied local annotation remains **provisional**. The CT frames are real existing acquisition planes. Parent/daughter locators use existing source geometry; the two single-lumen exercises use explicitly labeled model intersections on native planes. No wall contours are inferred from centerlines, no neighboring structure is newly labeled as a distractor, and a mark's distance from a model point is never an accuracy grade.

`CtTeachingFrame` supports labeled native-coordinate overlays and optional authored contours. Contours render only with faculty-reviewed metadata; no supplied exercise has that status or supplies contours. Review metadata carries reviewer, date and geometry version when available. Current provisional metadata explains the missing review. Native marks and overlays use the same coordinate transforms as the CT image.

The parent-view schematic projects source daughter directions into the existing parent-camera basis. It retains numbered siblings and selected continuations, names the viewing parent, and indicates projected patient R/A/S directions. It is labeled as model direction geometry, not an ostium segmentation or a clinically validated bronchoscopic opening map. Camera notices explicitly say that the camera follows the model reference route after a different learner branch choice.

CT daughters use letter labels; schematic openings are numbered by projected position independently of CT answer order. The progressive map adds the current division only after the learner records the viewpoint response, so it cannot disclose those labels during the prediction.

The RB5a/RB5b exercises revisit the same bifurcation to compare the two continuations. They are not independent examples or new-patient transfer evidence. All other local exercises and nodule targets also share the original teaching scan.

The following require external faculty/case-owner work and are not claimed as completed:

- Review each native interval for continuous lumen/wall correspondence, visible carina, daughter identities, acceptable marks and parent-view orientation.
- Supply reviewed wall contours, distractor annotations and error-specific explanations before enabling such teaching verdicts.
- Approve additional unfamiliar CT cases before evaluating cross-case transfer.
- Conduct the proposed formative learner pilot. Automated/browser tests are not a usability study or evidence of educational efficacy.

The method retains the existing Kurimoto and Morita textbook references. The brief's additional [Mortimer and Saghaie paper](https://pubmed.ncbi.nlm.nih.gov/41303044/) describes a mapping method; it does not validate this implementation.

## Draft and first-attempt contract

A separate `branch-tracing.draft.*` browser store contains versioned lesson or practice/assessment drafts. Draft signatures bind the lesson version, annotation version, native source CT and graph hashes, transform/window metadata and exercise geometry. Authors must revise the version when changing rendered assets or annotations. Reads validate schema, known exercises, array lengths, native slices, coordinates and branch choices before restoring. Incompatible or damaged drafts produce an explicit explanation; old participation history is retained.

Local drafts restore phase, exercise, selected daughter, marks, course, viewpoint response, hint level, demonstration frame and CT viewing state. Full routes restore phase, active junction, recorded responses, orientation attempts and CT views. Practice/assessment drafts additionally restore selection, case index, unfinished case work, responses and submission status. CT viewing state includes slice, focus, orientation, full/detail field, magnification and supporting-view visibility. The reference camera pose is derived from the restored slice and junction. Browser fullscreen and active slideshow playback intentionally do not resume.

Local first attempts and subsequent retries are separate immutable snapshots; restarting retains that history. Coached route retries keep separate junction snapshots, also included in the worksheet export. Existing first-participation activity records remain separate from draft state and acquire no clinical score. Save & exit performs a synchronous final save. A failed save leaves the learner in place and explains the loss before offering Leave without saving.

A local retry clears the active hints while preserving the prior attempt's hint use. Submitted practice worksheets can reopen for junction repair without discarding the recorded first response.

## Verification

The focused test suite covers all local lesson transitions, full-route gating, adjacent-slice browsing, reference withholding, viewpoint commitment, unchanged native-coordinate transforms, first-attempt retention, help, save/reload/exit, incompatible drafts, failed assets, keyboard and touch input, and laptop/narrow layouts. The existing explorer retains its WebGL context-loss recovery test.

- `npm run build`: passed, including embedded trainers, asset validation and standalone packaging.
- `npm run type-check`: passed.
- Scoped ESLint, Prettier and `git diff --check`: passed.
- `npx --no-install playwright test --config=playwright.branch-tracing.config.ts`: 20 passed. Marked/review screenshots cover 2488 × 885, 1993 × 927, 1280 × 720, 1024 × 768, 900 × 800, 390 × 844 and 320 × 844, alongside existing laptop/touch and full-route checks.
- `npx --no-install jest --runInBand src/features/bronchial-branch-tracing`: 36 passed, 1 existing failure described below. All six local lesson tests pass, including automated accessibility, pending-mark restoration and the final navigation handler.

A pre-existing contract assertion expects `/airway-anatomy/case-001/case_manifest.json` to be private, while the current baseline access rule exposes it. This implementation does not alter that rule or its test.
