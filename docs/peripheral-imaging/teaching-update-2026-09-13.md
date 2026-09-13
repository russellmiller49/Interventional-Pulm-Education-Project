# Peripheral imaging teaching update

Baseline: `ab05b9d66e169f426cc0147f8aae2a73e1080765` (the supplied brief's baseline also matched `origin/main` when this task began). Branch: `codex/peripheral-imaging-teaching`. Initial checkout was clean. The attached implementation brief was used as the task specification; it was not treated as evidence of browser or clinical validation.

The intended learner understands chest CT and basic bronchoscopy. Outcomes remain identifying the imaging question, interpreting its limitation, choosing an adjustment, and recognizing remaining uncertainty: **knows how**, not clinical competence. All 19 stable sections, recommended order, routes, source associations, historical scored keys, capstone eligibility and draft release status remain.

## Implemented teaching and interactions

| Sections                                | Changes and observable result                                                                                                                                                                                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hub, Learn entry, all 19 sections       | Practical introduction, registry-derived Practice availability, reference disclosures retaining anchors. Essential explanations and demonstrations precede independent application. Direct choices replace remote map-based answers. Guided activities precede new interpretation checks where appropriate.               |
| `imaging-questions`, `chain-walk`       | Four labeled teaching panels distinguish the navigation target, current lesion, actual sampling component and tissue result. Depth collapse and the six image-formation components are taught before the question.                                                                                                        |
| `good-image`                            | Uses the existing geometry lab for actual projection and stored-image display changes. Control families remain an organizing aid; selectable settings, automatic exposure behavior and mode availability are qualified.                                                                                                   |
| `projection`                            | Isolated demonstration holds a fictional 30 mm depth offset fixed while orbit changes from 0° to 55°. A frozen baseline and current projection show the mismatch. The learner's task starts separately; its interpretation question uses another position and projection. Numerical separation is no longer the endpoint. |
| `signal`                                | Matched conceptual reference/noise/contrast/superimposition illustrations plus the existing CT projection for superimposition. The independent check uses its own A/B illustrations and contextual clues. No simulated photon-noise or scatter dose response is claimed.                                                  |
| `field`                                 | Physical collimation, electronic crop and stored-image zoom are separate. A saved image retains its pixels, overlays, physical field and acquisition label. Required field coverage uses the projected target, authored excursion and two landmarks. A narrow field that excludes them cannot pass on narrowness alone.   |
| `time`                                  | Baseline, isolated pulse-width, isolated pulse-rate, combined and static examples. Acquisition samples and an enlarged within-pulse inset distinguish the effects. Pause, replay and reduced-motion Step remain. The independent comparison uses a different rate pair.                                                   |
| `two-dimensional`                       | Replaces the sort-only activity with a coached projection/field/display problem. Feedback retains the numeric before/after comparison; an independent second situation has another projection, depth offset and restricted field.                                                                                         |
| `current-anatomy`, `changing-anatomy`   | Labeled acquisition timeline: initial state, saved contour A, rigid change, contour off, reassessment B. Corrected the claim that imaging reverses atelectasis. The displacement illustrates registration mismatch, without modeling physiology.                                                                          |
| `dts-acquisition`, `dts-interpretation` | Introduce the acquisition arc and reconstructed planes before questions; guided tool/lesion scrolling and reconstruction-source explanation use existing DTS/prior views. Independent checks omit target-plane shortcut controls and explanatory reveals.                                                                 |
| `cbct-acquisition`                      | Demonstrates one-scout alignment with a remaining depth offset, both-scout centering and subsequent movement. Existing readiness and capture invalidation remain. Confirmations are labeled learner-declared.                                                                                                             |
| `fixed-suite`, `mobile-suite`           | Different guided work: fixed-room gantry/setup movement and its scout change; mobile setup centering and gantry-path inspection. Shared acquisition preconditions stay in the CBCT section. Installation-specific checks remain teaching, not collision detection.                                                        |
| `tool-confirmation`                     | Demonstration compares thin views through the tip/window, a tip beyond the lesion with window behind it, and misleading thick-slab appearance. Independent configuration withholds geometric verdicts, 3D explanation and slice-to-answer shortcuts.                                                                      |
| `staff-protection`                      | Patient/source/path example followed by changed distance and barrier state in the existing scene. Point-source distance arithmetic stays explicitly idealized.                                                                                                                                                            |
| `dose-reporting`                        | Fictional procedure table lists mode subtotals, combined KAP, reference air kerma and units. The independent record uses different numbers and tests double counting. Arithmetic lab remains a worked explanation.                                                                                                        |
| `suite-cases`, Practice                 | Worked integrated lesion/tool-exchange panels and conceptual illustrations in three existing Practice cases. Existing item meanings and keys, independent Assess debrief and safety-critical standard remain.                                                                                                             |

The shared stage and standalone FluoroView were reused without modification. Two small shared navigation changes allow links to wrap and their header to grow at enlarged text sizes; their ordinary-size layout remains the same. The peripheral-imaging shell retains a minimum height so large text cannot collapse the lesson panes. The interpretation image now precedes the smaller room view in image-reading modes, with relevant controls adjacent. Model-only controls have their own group. Baseline/current images remain side by side with separate acquisition labels. The existing help, spotlight/reset and numeric before/after surfaces remain.

## Records and disclosure

Demonstrations own disposable component state and cannot write an attempt, complete a section or satisfy learner goals. Replay and reset establish a separate baseline for subsequent guided work. A question-level retry changes the current session response but preserves the immutable first attempt.

Seven materially changed primary questions have new IDs: `projection-interpretation-v2`, `signal-interpretation-v2`, `field-interpretation-v2`, `time-interpretation-v2`, `two-dimensional-interpretation-v2`, `sampling-interpretation-v2`, and `dose-record-interpretation-v2`. Original question records remain resolvable. The progress adapter recognizes both generations and does not rescore old attempts against new keys. Incomplete sections restart after reload; completed sections and first answers persist. UI wording states that boundary.

Pending independent items receive limited foundational teaching, neutral images and source metadata, without keyed rationale, component highlights, numeric geometric truth or model-position shortcuts. Signal/field/time/dose checks show their self-contained illustration or record rather than an unrelated lab state. Asset/WebGL failure disables image-dependent progression and retains explanation and retry. Offscreen 3D views render their first frame before idle suspension, avoiding a readiness deadlock.

## Validation actually executed

| Command                                                                                                                                                                                   | Result                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx --no-install jest src/features/peripheral-imaging --runInBand` before implementation                                                                                                 | 28 suites, 209 tests passed.                                                                                                                                                                                                  |
| Same command on final implementation                                                                                                                                                      | **29 suites, 194 tests passed**. Obsolete prediction-before-teaching tests were replaced with demonstration isolation, all-section pending disclosure, retry/history and real control/goal tests.                             |
| `npx --no-install jest src/components/layout src/features/learning-module src/features/critical-care --runInBand`                                                                         | **39 suites, 337 tests passed**, covering the shared navigation and sibling learning modules.                                                                                                                                 |
| `npm run type-check`                                                                                                                                                                      | Passed.                                                                                                                                                                                                                       |
| `npm run lint`                                                                                                                                                                            | Passed, 0 errors; 15 existing warnings outside this feature.                                                                                                                                                                  |
| `npx --no-install eslint src/features/peripheral-imaging e2e/peripheral-imaging.spec.ts src/components/layout/DesktopNav.tsx src/components/layout/Layout.tsx`                            | Passed without warnings.                                                                                                                                                                                                      |
| `PERIPHERAL_IMAGING_BASE_URL=http://localhost:3111 npx --no-install playwright test -c playwright.peripheral-imaging.config.ts`                                                           | **10 tests passed** in the final full run. All 19 real scenes render; required CT surfaces have nonuniform pixels; changed/frozen image pixels, history, failure, readiness, capstone, keyboard and responsive paths checked. |
| Structured-module skill `audit-stage.mjs` with actual projection route                                                                                                                    | Initial helper run failed its phone width assertion because its 350 ms delay measured server HTML before client layout measurement.                                                                                           |
| `node /private/tmp/peripheral-imaging-hydrated-audit.mjs --url 'http://localhost:3111/en/peripheral-imaging/learn?section=projection' --out /tmp/peripheral-imaging-stage-audit-hydrated` | Passed at 1440×900, 1280×720, 1024×768, 900×800 and 390×844. This temporary copy changes only the fixed delay to wait for the workspace's measured pixel widths; all original assertions remain.                              |
| Medical-education `item_cueing_check.py /tmp/peripheral-imaging-new-items.json --strict`                                                                                                  | Exit 0: no P0/P1 findings. Actual displayed positions A/B/C = 2/3/2. One lexical-overlap advisory (`visible`) and two grammar heuristics remain for faculty review; these do not expose keyed answers.                        |
| Medical-education `copy_density_check.py /tmp/peripheral-imaging-copy/*.md`                                                                                                               | Exit 0; advisory long-sentence/paragraph findings in technical detail.                                                                                                                                                        |
| `git diff --check`                                                                                                                                                                        | Passed.                                                                                                                                                                                                                       |

Earlier development runs found duplicate baseline/current selectors, a wrong verdict attribute expectation, premature measurement before hydration, offscreen rendering readiness, and authored values exceeding actual ranges. These were corrected; new range coverage prevents silently clamped demonstrations. One intermediate all-section navigation was interrupted by development hot reload. Those runs are not cited as final passing evidence.

No production build, full repository Jest run, other modules' browser suites, live patient/device validation, screen-reader certification or learner pilot was performed. No shared lesson-stage code changed; shared navigation received only wrapping and minimum-height class changes. Port 3110 was already owned by another worktree and was left untouched. This checkout ran `node scripts/dev-with-training-apps.mjs --port 3111`. Development analytics requests report missing Supabase configuration; module rendering and local progress operate without it. No environment secrets, uploads or shared database state were accessed or changed.

## Instructor walkthrough and screenshots

Start at `http://localhost:3111/en/peripheral-imaging`. Follow the single Start/Continue action, or use `/en/peripheral-imaging/learn?section=<stable-section-id>` on the same localhost origin.

1. In `projection`, read parallax first, save the frontal baseline and choose **Change projection only**. Compare the fixed baseline with the changed CT projection. Replay; Continue starts the separate guided state. Complete the view comparison, answer incorrectly, review feedback and retry. Reload preserves the first response and restarts the incomplete section.
2. In `field`, save the full acquisition, compare physical collimation, stored crop and stored zoom. Labels retain each acquisition's state. During guided work, 45% excludes context and cannot advance; 90% retains the modeled context. These are examples, not clinical thresholds.
3. In `time`, compare width alone, then rate alone. Inspect the six samples and enlarged within-pulse detail. Enable reduced motion and use Step.
4. In `cbct-acquisition`, compare the two scouts, complete the declared checks and move the setup; readiness invalidates. In `tool-confirmation`, follow the tip and sampling window, compare thin/slab appearances, then inspect the independent configuration without its geometric answer.
5. Review Practice illustrations, then the unchanged gated Assess flow. At phone width, switch Steps/Teaching/Simulator using touch or arrow/Home/End keys. Help and section restart remain available.

Final screenshot files are local, ignored test outputs under `test-results/peripheral-imaging/`:

| File suffix                                                                                                                     | Inspected evidence                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `peripheral-imaging-project-b6f89-and-reload-preserve-history/projection-baseline-current.png`                                  | Frontal overlap versus a changed view showing the tool endpoint outside the target contour; stationary model geometry and separate acquisition labels.                         |
| `peripheral-imaging-field-c-f7d18-tricted-context-cannot-pass/field-collimated.png`                                             | Physical field changes with the retained baseline.                                                                                                                             |
| `peripheral-imaging-field-c-f7d18-tricted-context-cannot-pass/field-stored-zoom.png`                                            | Enlarged acquired information with unchanged 100% acquisition metadata and frozen baseline.                                                                                    |
| `peripheral-imaging-timing--97217-effects-with-reduced-motion/timing-width-detail.png`                                          | Wider within-pulse bar (0.20 mm authored motion travel), unchanged pulse-position spacing.                                                                                     |
| `peripheral-imaging-timing--97217-effects-with-reduced-motion/timing-rate-detail.png`                                           | Wider position spacing with the original within-pulse bar (0.10 mm). Separate-scale inset is labeled.                                                                          |
| `peripheral-imaging-desktop-f9c7d-ain-task-and-control-access/projection-1440.png`, `projection-1024.png`, `projection-390.png` | Desktop panels and compact phone switcher; simulator image/control access.                                                                                                     |
| Same folder, `projection-text-200-percent-900.png` and `projection-text-200-percent-1440.png`                                   | 200% text at 900×1000 and 1440×1000, without horizontal page overflow; the active Continue action remains operable. The desktop Steps pane retains more than 350 px of height. |

Additional layout measurements and screenshots: `/tmp/peripheral-imaging-stage-audit-hydrated/layout-smoke-report.json`. Screenshots are evidence of depicted model changes and layout, not clinical or educational efficacy.

## Source and review boundaries

New values and vector illustrations are authored teaching constructs dated 2026-09-13. Existing CT assets and their provenance remain. No clinical photo archive, patient material or private reference was copied. The renderer does not supply calibrated scatter/noise response, detector lag, dose, equipment collision clearance or patient physiology. Physical field coverage checks only the explicitly authored context marks. The integration lab automatically centers its field on the model target; manual recentering is not modeled.

Orientation was traced through the LAS configuration in `lib/anatomy.ts`, the atlas export/provenance in `docs/peripheral-imaging/slicer-assets.md`, and the existing detector frame and ray marcher in `fluoro-viewer/src/geometry.ts` and `volume-drr.ts`. At frontal, screen right is patient left, top is superior, and the zero-angle beam is posterior to anterior. Signed model orbit/tilt labels remain; no clinical RAO/LAO name was assigned from a slider sign.

Existing WABIP, AAPM and modality-specific source associations retain their scope. [IAEA patient-protection guidance](https://www.iaea.org/resources/rpop/health-professionals/other-specialities-and-imaging-modalities/gastroenterology/patients) was consulted for general equipment/optimization distinctions, not as a bronchoscopy protocol. New images/items require faculty and medical-physics review, followed by learner piloting.

The initial desktop 200% text check exposed inherited site-navigation overflow and too little vertical workspace. The narrowly necessary shared navigation wrapping/header-height changes and peripheral-only minimum workspace height resolve the reproduced issue. The extended browser test exercises both 900 px and 1440 px text enlargement and advances the actual lesson from each layout.

## Structured-module acceptance within this scope

| Rule                       | Status                       | Evidence or boundary                                                                                                                                                                          |
| -------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1 One door/curriculum     | PASS                         | Same registry/resolver and all 19 links; hub/resolver tests.                                                                                                                                  |
| H2 Teaching before testing | PASS                         | All-section rendered disclosure tests; worked/guided/changed core examples.                                                                                                                   |
| H3 Shared stage            | PASS                         | Existing imports, pane order, fractions and minimums retained; layout audit.                                                                                                                  |
| H4 One current task        | PASS                         | NowCard, direct choices, one primary action, real authored locations.                                                                                                                         |
| H5 Teaching renders        | PASS                         | All-section browser views and rendered teaching tests.                                                                                                                                        |
| H6 Real activities         | PASS                         | New geometry tasks, context coverage, timing events and failure gates; sequence follows the owner's supplied teaching-first brief.                                                            |
| H7 Mode-aware feedback     | PASS                         | Wrong/retry/immutable-history tests; pending disclosure; capstone safety test.                                                                                                                |
| H8 Fidelity                | PASS                         | Existing engines/assets and acquisition invalidation preserved; conceptual limits explicit.                                                                                                   |
| H9 Honest progress         | PASS                         | Legacy/new-ID round trips, reload/restart tests and corrected save copy.                                                                                                                      |
| H10 Clinical language      | PASS within authored changes | Corrected exposure/atelectasis/display claims; clinician review still pending.                                                                                                                |
| H11 Scope/release          | PASS                         | Feature, its E2E, this report, and two narrowly necessary shared navigation layout changes; no release, access, data or shared lesson-stage changes.                                          |
| H12 Browser evidence       | PASS for stated matrix       | Final browser suite, hydrated layout audit, shared regressions and inspected representative frames, including compact and desktop 200% text. No full accessibility/clinical-validation claim. |

## Exact changed paths

- `docs/peripheral-imaging/teaching-update-2026-09-13.md`
- `e2e/peripheral-imaging.spec.ts`
- `src/components/layout/DesktopNav.tsx`
- `src/components/layout/Layout.tsx`
- `src/features/peripheral-imaging/__tests__/acquisition-capture.test.ts`
- `src/features/peripheral-imaging/__tests__/lab-metrics.test.ts`
- `src/features/peripheral-imaging/__tests__/registries.test.ts`
- `src/features/peripheral-imaging/__tests__/stage-host.test.tsx`
- `src/features/peripheral-imaging/__tests__/stage-lessons.test.ts`
- `src/features/peripheral-imaging/__tests__/stage-precommit-leak.rendered.test.tsx`
- `src/features/peripheral-imaging/__tests__/stage-session.test.ts`
- `src/features/peripheral-imaging/__tests__/teaching-invariants.test.ts`
- `src/features/peripheral-imaging/components/ImagingCaseActivity.tsx`
- `src/features/peripheral-imaging/components/PeripheralImagingHub.tsx`
- `src/features/peripheral-imaging/components/PeripheralImagingLearnLanding.tsx`
- `src/features/peripheral-imaging/components/peripheral-imaging-module.module.css`
- `src/features/peripheral-imaging/components/stage/ImagingStageHost.tsx`
- `src/features/peripheral-imaging/components/stage/ImagingTeachingColumn.tsx`
- `src/features/peripheral-imaging/components/stage/LessonDemonstration.tsx`
- `src/features/peripheral-imaging/components/stage/TeachingPanels.tsx`
- `src/features/peripheral-imaging/components/stage/imaging-stage.module.css`
- `src/features/peripheral-imaging/components/suite/LabDock.tsx`
- `src/features/peripheral-imaging/components/suite/Monitor.tsx`
- `src/features/peripheral-imaging/components/suite/SuiteFallback.tsx`
- `src/features/peripheral-imaging/components/suite/SuiteScene.tsx`
- `src/features/peripheral-imaging/components/suite/suite-scene.module.css`
- `src/features/peripheral-imaging/components/suite/suiteViewSpec.ts`
- `src/features/peripheral-imaging/components/suite/types.ts`
- `src/features/peripheral-imaging/components/suite/views/FieldView.tsx`
- `src/features/peripheral-imaging/components/suite/views/TimeView.tsx`
- `src/features/peripheral-imaging/content/controlPanel.ts`
- `src/features/peripheral-imaging/content/interpretationChecks.ts`
- `src/features/peripheral-imaging/content/labGoals.ts`
- `src/features/peripheral-imaging/content/sectionSpecs.ts`
- `src/features/peripheral-imaging/content/sorts.ts`
- `src/features/peripheral-imaging/content/stageItems.ts`
- `src/features/peripheral-imaging/content/stageLessons.ts`
- `src/features/peripheral-imaging/content/suiteViews.ts`
- `src/features/peripheral-imaging/content/teachingBlocks.ts`
- `src/features/peripheral-imaging/content/teachingExamples.ts`
- `src/features/peripheral-imaging/data/lessons.ts`
- `src/features/peripheral-imaging/data/questions.ts`
- `src/features/peripheral-imaging/engine/labGoalEvaluation.ts`
- `src/features/peripheral-imaging/engine/labMetrics.ts`
- `src/features/peripheral-imaging/engine/stageSession.ts`
- `src/features/peripheral-imaging/lib/physics.ts`
- `src/features/peripheral-imaging/test-support/SuiteTestDouble.tsx`
- `src/features/peripheral-imaging/test-support/stageHarness.tsx`
