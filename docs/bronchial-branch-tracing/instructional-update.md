# Local CT teaching and draft restoration

> Historical implementation and follow-up evidence through PR #192. See [flow-redesign.md](flow-redesign.md) for the current nine-lesson sequence and [flow-redesign-validation.md](flow-redesign-validation.md) for this redesign's executed checks. The new bridge precedes continuity, the warm-up's next link now resolves to orientation, parent-view tasks vary by objective, and complete routes use a CT/map workspace. Older screenshots, dimensions, task labels and assertions below describe their dated repairs and are retained as history.

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

## Orientation onboarding repair

The September 13 orientation brief corrects the next prerequisite gap for a first-time CT learner: `emptyLocalSession` and the next-example transition previously called `orientationFor(trace.preset)` immediately. This made the first warm-up appear reflected before the learner had established standard axial orientation. `CtOrientationTeaching` existed in the full-route experience but did not appear in the local lesson flow.

This repair targets display comprehension (Miller: knows how). The learner distinguishes standard axial CT, a display transformation, and the distal view through a parent airway. A short, ungraded response checks that distinction; it does not assess clinical tracing accuracy.

The visible local sequence is now:

1. Full standard axial context with R/L/A/P markers and a gold parent-airway locator. Visible teaching explains the view from the feet and patient right on screen-left. **Focus on this airway** moves to the parent crop.
2. Both warm-up intervals stay in standard axial. The next lesson also traces the bifurcation in standard before asking about the parent-airway view.
3. At the first parent-view comparison, visible teaching explains CT cross-section versus observer → parent bronchus → daughter bronchi. **Reflect left ↔ right** transforms the same displayed CT, with its slice, image/window, crop, zoom and airway reference unchanged.
4. **Standard axial** and **Show tracing view** alternate on that same viewer. The learner answers **What changed?**. Each wrong option has specific feedback; a correct response enables **Continue in tracing view**, without automatic advance. Only then does the original parent-opening question appear.
5. Direct links into later local lessons receive the same prerequisites. The first RUL convention is introduced as **90° counterclockwise**; the first upper-division convention as **90° clockwise**. Once understood, a preset is reused in later lessons through the existing progress adapter. The warm-up remains standard on restart even when the reflection has already been learned.

`CtOrientationTeaching` now has a guided mode for the local renderer. It uses the same orientation functions and the actual `NativeCtViewer`; no second viewer or geometry engine was added. Routine local controls offer reset and the named tracing view. The existing free rotation/reflection controls remain under **More orientation controls** after introduction. The explanation and check occupy the existing left teaching pane, and the pane returns to its top when a new teaching phase opens. No full-width or frozen onboarding banner was added.

Session changes are additive: `orientationGuide`, `taughtPresets` and `orientationResponses`. A completed comprehension check uses the shared progress adapter with no score or competency evidence. Actual responses, including the first error, remain in the local draft. Lesson/exercise objects and geometry signatures are unchanged. Older unfinished drafts are recognized by the absent guide field: they establish full standard context, explain that saved work remains, then return to the saved task. Native marks, branch choices, first-attempt orientations and prior comparisons are retained. New drafts restore the exact guide phase and current view, including an incorrect response or a toggle back to standard. Restart retains attempts and learned conventions; it resets the beginner CT view.

Preserved scope: patient coordinates, source images/window, annotations, named branches, regional presets, decisions, nodule targets, paired camera geometry, full-route teaching/practice/assessment, shared stage files and global layout are unchanged. The terminology follows the existing Kurimoto/Morita teaching source and supplied brief. The [DICOM patient-orientation convention](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.7.6.2.html) supports the patient-direction distinction; this is not a new clinical recommendation or validation of the model.

Implementation paths: `engine/local-session.ts`, `engine/progress.ts`, `components/LocalCtLesson.tsx`, `components/NativeCtViewer.tsx`, `components/CtOrientationTeaching.tsx` and the feature CSS. Tests changed in `__tests__/local-session.test.ts`, `__tests__/local-lesson.test.tsx` and `e2e/branch-tracing.spec.ts`.

The comparison fits all three answer choices without scrolling at 1280 × 720. Response-specific feedback replaces the task instruction, so it stays visible beside the CT. Final dark-mode measurements on current `main` retain a 509 px activity pane (70.8%) at 1280 × 720 and a 674 px pane (76.2%) at 2488 × 885; the CT images remain 355 and 520 px square. The same-slice before/after images, all three presets, full-context opening, feedback and phone layout were inspected. In-session screenshots are `/tmp/branch-orientation-standard-context-1280.png`, `/tmp/branch-orientation-before-reflection-dark-1280.png`, `/tmp/branch-orientation-after-reflection-dark-1280.png`, `/tmp/branch-orientation-feedback-dark-1280.png`, `/tmp/branch-orientation-after-reflection-390.png`, `/tmp/branch-orientation-rul.png` and `/tmp/branch-orientation-upper-division.png`. Measurements are in `/tmp/branch-orientation-final-metrics.json`.

Verification on the follow-up branch, based on `origin/main` after PR #183 merged:

- `npm run build`: passed, including both embedded trainers, asset validation, TypeScript and standalone packaging. The existing Mermaid dependency warning remains.
- `npm run type-check`, scoped ESLint, Prettier and `git diff --check`: passed.
- `npx jest --runInBand --testTimeout=60000 src/features/bronchial-branch-tracing`: **41 passed, one existing failure** at `contracts.test.ts:201`. The unchanged access rule exposes `/airway-anatomy/case-001/case_manifest.json`; the test expects it to be private. The final local component rerun also passed all six tests.
- `npx playwright test --config playwright.branch-tracing.config.ts --timeout=180000`: all **23 scenarios verified across the full run and focused repair rerun**. The main-base run passed 22 and identified a partly clipped final answer choice; shortening the comparison repaired it. The four affected scenarios (seven-width warm-up, fresh/legacy draft, reflection/resume/reuse and both regional rotations) then passed together, including full-visibility and feedback assertions. The test waits for the focus crop to finish before taking its standard-image baseline.
- An initial dev-server run timed out before page load under host load; two five-second unit timeouts also cleared on rerun. The final browser checks used the production build. No test assertion was removed to clear those timeouts.

| Contract                   | Result | Evidence for this orientation repair                                                                               |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| H1: entry and curriculum   | PASS   | Existing registry, lesson order and course destinations unchanged.                                                 |
| H2: teach before testing   | PASS   | Standard context and viewing direction precede the explicit display change and ungraded check.                     |
| H3: shared stage           | PASS   | Existing LessonShell/SectionHeader/NowCard and the authorized local CT layout retained.                            |
| H4: current task           | PASS   | One visible primary action; image readiness and comprehension govern its enabled state.                            |
| H5: rendered teaching      | PASS   | Prerequisites open beside the actual CT; feedback appears in the current task.                                     |
| H6: real activity          | PASS   | Actual transform, response and explicit continuation; no automatic completion from viewing text.                   |
| H7: response and feedback  | PASS   | Specific misconception repair, preserved first response, no clinical accuracy score.                               |
| H8: fidelity               | PASS   | Same image/crop/slice assertions, all preset directions and existing native mark/asset checks.                     |
| H9: progress               | PASS   | Legacy mark/history preservation, exact new-draft resume and shared preset-understanding records.                  |
| H10: language              | PASS   | Standard axial, left–right reflection and actual clockwise/counterclockwise rotations.                             |
| H11: scope                 | PASS   | Feature, feature tests and this report only; no geometry, shared-stage or global layout edits.                     |
| H12: rendered verification | PASS   | All local flows and existing route/practice/assessment behaviors; inspected desktop/phone and light/dark captures. |

The previously documented standard three-pane audit limitation and external faculty/learner-pilot boundaries still apply; these browser checks establish implemented behavior and layout, not educational efficacy or clinical competence.

## Progression after marking branches

The follow-up repair starts from `7f77e63d` (PR #192). The learner reported being unable to advance from the second bifurcation after marking both daughters. Browser reproduction at 1280 × 720 confirmed that the review opened with replay controls ahead of the feedback, the required next activity was labeled **Relate the parent view**, and the later opening-choice buttons fell below the visible instruction pane.

This is a navigation repair for the existing fellow-facing, ungraded image-interpretation lesson. Its objective remains following a parent airway into its daughters and relating the CT branches to the existing parent-view schematic. No clinical recommendation, model answer, coordinate, display convention, asset, lesson ID, progress schema or completion gate changes. `LocalCtLesson` still uses the existing LessonShell, SectionHeader and NowCard within the previously approved compact CT workspace. The warm-up's distinct three-step flow remains intact.

The non-warm-up sequence now names its four steps:

1. **Watch this bifurcation**, then **Start marking branches**.
2. Mark a daughter. The current task acknowledges the mark or uncertainty response and offers **Mark [remaining branch]**, which opens that branch's existing answer slice. After both responses, **Review my marks** becomes available. Pattern and integration lessons still require their additional course or continuation response and name that missing action.
3. **Your branch marks are recorded** (or **responses** for uncertainty). The branch comparison controls appear first. **Continue to branch matching** names the required next activity and explains its purpose. Replay and redoing marks are explicitly optional.
4. **Match the branches** asks for the actual numbered opening. Labels and the parent airway view remain withheld until the learner selects an opening or records uncertainty. **Branch match recorded** then names **Next example: [parent]** or **Finish lesson**. The completion screen exposes the registry-derived next lesson.

Feedback never advances automatically. Native marks and first attempts survive reload, including the user's second-example review state; continuing does not add another tracing attempt. Display labels are derived in the renderer so the existing lesson/exercise signature remains compatible. No new data model or calculation is introduced.

The local matching diagram uses the same SVG geometry at 200 px and keeps 44 px answer targets. The shorter question and narrower button padding expose the whole diagram and all three choices at laptop width. The CT workspace and full-route diagram presentation retain their existing dimensions.

Entering the matching question opens the existing slice for daughter A, which the question asks about, including after the orientation introduction. Previously the CT stayed on the most recently reviewed daughter; the LLL example could ask about A on slice 326 while displaying B on slice 313. The repair changes the viewer request, not either native slice or annotation.

When a stacked layout changes step, the document returns to the new task and its teaching content, below the site header. Marking or browsing within the same step keeps the CT position. This fixes the mobile case where the sticky task updated while the new matching diagram remained above the learner's scroll position. Initial entry does not force a document scroll.

Changed paths: `components/LocalCtLesson.tsx`, `components/branch-tracing.module.css`, `__tests__/local-lesson.test.tsx`, `e2e/branch-tracing.spec.ts`, and this report. UI wording is grounded in the existing module; no private transcripts or new clinical sources were needed.

Validation:

- `npm run build`: passed, including the final question/slice alignment, embedded trainers, asset validation, TypeScript and standalone output. The existing Mermaid dependency warning remains.
- `npm run type-check`, scoped ESLint, Prettier and `git diff --check`: passed.
- `npx --no-install jest --runInBand --testTimeout=30000 src/features/bronchial-branch-tracing/__tests__/local-lesson.test.tsx`: **7 passed**. The added test drives native marks, the remaining-branch action, restored second-example comparison, actual opening responses, final completion and the next-lesson link while checking immutable attempts and draft signatures. It also asserts that the matching question shows daughter A's native slice.
- `npx --no-install playwright test --config playwright.branch-tracing.config.ts --timeout=120000`: **24 passed**. This includes all local lessons, full routes, Practice/Assess, asset/storage recovery, native transforms and compact layouts. The new progression scenario drives both examples through the visible controls at 1440 × 900, 1280 × 720, 1024 × 768, 900 × 800, 390 × 844 and 320 × 844. It requires every opening choice and the complete matching diagram in the viewport, tests second-example reload, and opens the next lesson.
- After visual inspection identified the A-question/B-slice mismatch, the same browser command with `--grep 'branch marks lead|local teaching loop: continuity|RUL and upper-division'` passed **3 tests**. This final rerun includes all six progression viewports, the new native-slice assertion, and both regional rotation workflows. The corrected daughter-A image was inspected at 1280 × 720.
- Inspected the baseline review, revised second-example review and matching screens at laptop/desktop sizes, and actual phone viewports at 390 and 320 CSS pixels. Screenshots remain outside Git: `/tmp/branch-progression-before.png`, `/tmp/branch-progression-review-1280.png`, `/tmp/branch-progression-matching-1280.png`, `/tmp/branch-progression-matching-1440.png`, `/tmp/branch-progression-matching-viewport-390.png` and `/tmp/branch-progression-matching-viewport-320.png`.

| Contract                   | Result | Evidence within this progression repair                                                                    |
| -------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| H1: entry and curriculum   | PASS   | Existing lesson order and registry-derived next lesson retained; browser follows the next link.            |
| H2: teaching sequence      | PASS   | Worked example, marks, comparison and real opening question remain required in the same order.             |
| H3: shared stage           | PASS   | Existing shell/NowCard and the authorized compact CT layout retained.                                      |
| H4: current task           | PASS   | Current response, missing action and named next step are exposed; matching choices remain visible.         |
| H5: rendered content       | PASS   | Review controls precede optional replay; the required matching diagram opens with its question.            |
| H6: real activity          | PASS   | Existing reducer gates require marks, additional interpretations and an opening response.                  |
| H7: feedback               | PASS   | Actual responses retained; no automatic advance or invented accuracy verdict.                              |
| H8: fidelity               | PASS   | Native images, coordinates, orientation presets, camera geometry and model labels unchanged.               |
| H9: progress               | PASS   | Saved second-example review advances without restarting; first attempts and draft signatures are retained. |
| H10: language              | PASS   | Explicit mark acknowledgement, branch matching, optional retry, next example and finish labels.            |
| H11: scope                 | PASS   | Only the local renderer, feature CSS, focused tests and this report changed.                               |
| H12: rendered verification | PASS   | Six-width progression and existing browser regression coverage; inspected screenshots.                     |

The earlier standard three-pane audit limitation and provisional clinical-reference/faculty-review boundaries remain applicable. These checks verify the repaired interaction, not clinical accuracy grading or learning efficacy.

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
