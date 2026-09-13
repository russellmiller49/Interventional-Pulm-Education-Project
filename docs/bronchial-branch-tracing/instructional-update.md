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

Foundation and pattern lessons use the shared `LessonShell` and `SectionHeader` with a module-specific CT-first arrangement. The persistent current-task strip contains the sole task-advancing action. Supporting airway views load on demand after the local viewpoint response. Shared layout APIs and other modules are unchanged.

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
- `npx --no-install playwright test --config=playwright.branch-tracing.config.ts`: 19 passed. Screenshots were inspected at 1280 × 800, 720 × 900 and 390 × 844.
- `npx --no-install jest --runInBand src/features/bronchial-branch-tracing`: 35 passed, 1 existing failure described below.

A pre-existing contract assertion expects `/airway-anatomy/case-001/case_manifest.json` to be private, while the current baseline access rule exposes it. This implementation does not alter that rule or its test.
