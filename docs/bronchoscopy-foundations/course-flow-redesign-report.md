# Bronchoscopy Foundations course-flow redesign

Implemented from `origin/main` at `d209c800`, without overwriting later work. The implementation branch is `codex/bronch-foundations-course-flow`. This report distinguishes the implemented behavior, software verification and remaining human review. Historical implementation and validation reports remain intact.

## Implemented behavior

All 23 sections have explicit, module-local teaching sequences. The permanent Steps / Teaching / Simulator shell and its universal local flow adapter have been removed from Learn. The existing host still owns responses, engine state, goal evaluation and completion. Its center presents an illustrated explanation, instrument workspace, normal-airway tour, case or evidence-and-report exercise as the task requires.

A shared section header provides course context, outline browsing, restart and exit. Back reviews completed work without replaying it. One continuation area explains an unmet requirement beside a disabled action. Teaching and response controls stay in the same page; the scope’s existing scope/map comparison remains an actual tool view. Page scrolling reserves space for the continuation area so native touch controls remain reachable.

The two course entry URLs use the same hub and canonical continuation resolver. Fresh Start opens `shared-airway`. Returning learners receive the next section without current completion evidence; open browsing and prerequisite guidance remain. Time labels explicitly say estimated. Practice, Assess and Reference remain secondary links with their existing disclosure and evidence policies. The Assess heading now derives its count, and Reference anchor targets are larger.

The first representative slices were pre-use and five-controls, followed by right-side, deterioration and honest-report, before the remaining sections. [The course map and migration ledger](course-flow-map.md) describe every sequence, prerequisite and design rationale. [The preservation matrix](course-preservation-map.md) maps all 92 existing core objectives, every original source block and each meaningful activity to its final location.

## Representative walkthrough

1. **Fresh Start:** the hub explains the learner, purpose, model limits and storage behavior, then opens the illustrated shared-airway introduction. Normal/reference teaching and worked reasoning precede the first question.
2. **Instrument and controls:** pre-use introduces the physical instrument before parts identification and readiness cases. Five-controls reuses the orientation and groups its 12 actual units into seven displayed concepts. Explanation, transient demonstration, native controls, feedback and continuation are together. Advance followed by withdrawal is required; two advances are insufficient. The camera primer precedes branch entry. The original extended technique blocks remain available alongside their concepts; the displayed teaching retains essential action cues and model limits.
3. **Normal airway inspection:** the right-sided tour names each supported airway and its parent using existing outlined normal stills. Navigation follows as a separate control task; the original in-view-label-free tasks retain their disclosed centerline and parentage assistance. Pending interpretation questions remove the worked tour and solution surfaces. The left side teaches its own branching convention.
4. **Clinical case:** deterioration teaches baseline and priorities before the scenario. Observations and choices appear beside one another on desktop and reflow on narrow screens. Unsafe responses are refused immediately. A correct response shows contextual feedback before an explicit continuation to the next observation. The final summary retains first decisions and explanations; there is no speed score or new physiology engine.
5. **Report:** the original written-case report remains. A second exercise uses the available saved survey record, with evidence beside each field. An entered airway is not automatically inspected; a declaration is not a modeled normal mucosal finding. The lower-airway record cannot establish laryngeal examination. A missing record remains unavailable rather than generating a normal template.
6. **Return:** completed work and first answers survive reload when storage is available. An unfinished section restarts; the UI does not promise a saved pose. A storage failure is visible and work may continue in the current session. The closing lesson summarizes the actual available participation, support and first-response record and explains the supervised work still needed.

## Disclosure, engine fidelity and progress

Teaching, demonstration, guided practice, independent check and debrief are explicit activity contracts, independent of presentation. Source-backed mechanisms and worked examples can be taught before a check. Pending checks unmount worked blocks, tours and rationales; source claim summaries remain withheld until response commitment. Rendered disclosure tests inspect the document, accessibility attributes and target/answer surfaces, including the changed checks.

Five-controls and the protected-accessory exchange use the existing reducer in isolated transient playback state. Playback cannot write learner evidence, inspection records or an assessment attempt. Trying the activity creates a fresh authored learner state. Discrete Next demonstration movement controls provide a reduced-motion/step-through alternative.

The runtime geometry, assets, source graph, collisions, authored goal predicates, scope controls, case content, correct-choice identities and critical-safety policies are retained. Cosmetic reflow does not recreate the host’s learner state. Completion requires actual activity evidence and explicit Finish; arbitrary confirms cannot skip an activity. The complete survey stores its declarations only at Finish.

The existing version-1 progress envelope remains. New optional fields store the survey snapshot and distinguish Learn responses after teaching from responses following an explicit review during a pending check. Historical responses without support labels are not retroactively called independent. First responses and existing performance evidence are write-once. `honest-report` advances to lesson version 2 because the personal-record task adds a requirement; prior completion remains history. The equivalent five-controls pilot stays at version 2. Presentation-only migrations retain their completion versions.

## File-change summary

Paths below are under `src/features/bronchoscopy-foundations/` unless noted.

| Files                                                                                                                                        | Change and purpose                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content/courseFlow.ts`, `content/stageLessons.ts`, `content/fiveControlsLearn.ts`                                                           | Explicit section sequences and disclosure contracts; seven five-controls concepts with the existing real tasks.                                                   |
| `components/stage/BronchCourseLayout.tsx`, `course-flow.module.css`, `BronchStageHost.tsx`                                                   | Module-local task presentation and responsive continuation, connected to the existing state and controls. The universal local shell branch is removed.            |
| `components/stage/BronchCourseTeaching.tsx`, `BronchTeachingBlock.tsx`, `MediaFigure.tsx`                                                    | Source-block rendering, normal tours, worked teaching, actual-record debrief and honest missing-media states. The obsolete `BronchTeachingColumn.tsx` is removed. |
| `components/stage/BronchScenarioControl.tsx`, `useScopeDemonstration.ts`                                                                     | Integrated observations and decisions, explicit feedback continuation, and isolated accessory demonstrations using the existing reducer.                          |
| `components/BronchoscopyFoundations{Hub,LearnLanding,AssessLanding,ModuleFrame}.tsx`, module CSS, Reference, `content/pathwayResolver.ts`    | Unified entry, derived course counts, estimated timing, larger reference links and module-local document scrolling.                                               |
| `engine/learnProgress.ts`, `inspectionReport.ts`, `stageSession.ts`, `content/lessonVersions.ts`                                             | Saved survey provenance, support labels, preserved first answers, actual-work completion guards and the justified report version transition.                      |
| `content/sectionValidation.ts`, five section content files                                                                                   | Reconcile authoring validation with teaching-first disclosure and replace obsolete rendered panel directions.                                                     |
| Feature tests and test-support harnesses; `e2e/bronchoscopy-foundations.spec.ts`; `scripts/bronchoscopy-foundations/validate-course-flow.ts` | Complete rendered routes, native browser journeys, disclosure, progress, safety, fallback and responsive verification.                                            |
| This report, `course-flow-map.md`, `course-preservation-map.md`                                                                              | Reviewable implementation record, all-section migration ledger and objective/source-block preservation matrix. Historical evidence is retained.                   |

## Verification

Baseline command, before implementation:

```sh
npx --no-install jest src/features/bronchoscopy-foundations --runInBand
```

Baseline: 20 suites, 283 passed, one existing TODO. The TODO is the existing larynx/trachea junction issue; it was not introduced or claimed fixed here.

Final commands and results are recorded below. Logs and screenshots are retained locally under:

`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/outputs/bronchoscopy-foundations-course-flow-2026-09-14/`

Raw captures stay outside Git under the repository’s local-authoring policy.

| Command                                                                                                                                                                           | Result                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `npm run type-check`                                                                                                                                                              | Passed.                                                                                                                    |
| `npm run lint`                                                                                                                                                                    | Passed with 0 errors and 15 warnings in unchanged files outside Foundations.                                               |
| `npx --no-install eslint src/features/bronchoscopy-foundations e2e/bronchoscopy-foundations.spec.ts scripts/bronchoscopy-foundations/validate-course-flow.ts`                     | Passed with 0 errors and 0 warnings.                                                                                       |
| `npx --no-install tsx scripts/bronchoscopy-foundations/validate-course-flow.ts`                                                                                                   | 23 sections, canonical pathway, item registry and course sequences: 0 errors.                                              |
| `npx --no-install jest src/features/bronchoscopy-foundations --runInBand`                                                                                                         | 22 suites; 312 passed and 1 existing TODO.                                                                                 |
| `npx --no-install jest src/features/bronchoscopy-foundations/__tests__/course-record.test.ts src/features/learning-module --runInBand`                                            | 16 suites / 138 tests passed, including the unchanged shared-shell tests.                                                  |
| `BRONCH_FOUNDATIONS_BASE_URL=http://localhost:3145 npx --no-install playwright test --config playwright.bronchoscopy-foundations.config.ts --grep 'honest records at 390'`        | The full native touch five-controls journey passed after the scroll fix.                                                   |
| `BRONCH_FOUNDATIONS_BASE_URL=http://localhost:3145 npx --no-install playwright test --config playwright.bronchoscopy-foundations.config.ts --grep-invert 'honest records at 390'` | 12 passed; 4 viewport tests stopped on the hidden-reference-image assertion. All four passed on the corrected rerun below. |
| `BRONCH_FOUNDATIONS_BASE_URL=http://localhost:3145 npx --no-install playwright test --config playwright.bronchoscopy-foundations.config.ts --grep 'course presentations reflow'`  | 4 passed at 1440, 1024, 390 and 320 pixels.                                                                                |
| `git diff --check`                                                                                                                                                                | Passed.                                                                                                                    |

All 17 browser test definitions have passing final executions across the native-phone, remaining-journey and corrected-viewport runs. This is a combined result, not a claim of one uninterrupted 17-test run.

All 23 sections have complete rendered host walkthroughs using actual response handlers and scope commands through the existing pane seam, with the graph-only case and scene double explicitly identified as component-test infrastructure. Browser coverage visits every section through its actual URL and completes five-controls, pre-use, deterioration and honest-report through native controls/responses. It also checks Start, continuation, Back, reload, wrong answers and retry, survey refusal, Practice, critical capstone failure and model/media fallback. Browser assessment setup seeds only the prerequisite fixture for the separate capstone policy test; course completion journeys never inject completion.

Viewport checks cover 1440×900, 1024×768, 390×844 and 320-pixel reflow. A separate Chromium 200% CSS zoom check exercises the course reflow; this is not a claim of native assistive-technology or OS browser-zoom testing. Keyboard activation/focus, native touch, reduced motion, real painted control-head views, WebGL fallback and missing-media feedback are exercised.

### Issues found during implementation

- Old tests required a prediction before teaching, fixed phase positions, absent unmet-action buttons and three permanent panels. These assertions were deliberately replaced by stronger activity, disclosure and evidence checks. The original clinical/engine acceptance tests remain.
- The initial browser run had 12 passes and four failures: signed-zero animation metadata, an off-screen lazy canvas, a development navigation abort and a temporary closing-summary import defect. The metadata check now treats signed zero numerically; the canvas check scrolls the actual view into sight, and the import was corrected.
- Native phone taps subsequently exposed a real overlap between scrolling instrument controls and the sticky continuation area. Module-local scroll spacing and anchoring were corrected, and the same full native touch journey passed. Intermediate failures are retained in the local logs.
- The viewport screenshot assertion initially expected an image inside a closed technique-reference panel to be visible. It now waits for loaded images that are actually displayed. This changed the test assertion, not the disclosure or image-loading implementation; all four viewport tests passed on rerun.
- The isolated development checkout lacks analytics environment configuration. Early manual page visits produced analytics endpoint errors. Browser tests intercept the unrelated analytics POST with 204; application/backend/authentication configuration was not changed.
- The full repository lint run reports 15 warnings in untouched image, board-review, theme, scope-tracker, ECMO, ICU, shared progress, pleural and media-query files. No clean full-lint baseline is claimed.

## Screenshot review

The local evidence bundle includes the original pre-use and five-controls screens; final instrument teaching and normal-airway tour; the integrated desktop skill view, case and report; phone controls and changed-target completion; all course first screens at desktop; representative tablet, phone and narrow screens; and fallback/zoom captures. Selected actual captures were opened and visually inspected for layout, legible views and task/feedback/continuation placement. Merely producing a screenshot is not counted as visual review.

Selected local captures (absolute links work in the Codex workspace):

- [Before: pre-use three-panel layout](/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/outputs/bronchoscopy-foundations-course-flow-2026-09-14/before-pre-use-check.png)
- [Before: five-controls three-panel layout](/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/outputs/bronchoscopy-foundations-course-flow-2026-09-14/before-five-controls.png)
- [After: physical instrument teaching](/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/outputs/bronchoscopy-foundations-course-flow-2026-09-14/reviewed/pre-use-instrument-1440.png)
- [After: loaded labeled normal tour](/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/outputs/bronchoscopy-foundations-course-flow-2026-09-14/reviewed/right-normal-tour-1440.png)
- [After: normal tour on tablet](/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/outputs/bronchoscopy-foundations-course-flow-2026-09-14/reviewed/right-normal-tour-1024-viewport.png)
- [After: normal tour at 320-pixel reflow](/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/outputs/bronchoscopy-foundations-course-flow-2026-09-14/reviewed/right-normal-tour-320-viewport.png)
- [After: paired case observations and decision](/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/outputs/bronchoscopy-foundations-course-flow-2026-09-14/reviewed/deterioration-decision-1440.png)
- [After: written evidence beside report fields](/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/outputs/bronchoscopy-foundations-course-flow-2026-09-14/reviewed/written-case-report-1440.png)
- [After: actual advance and withdrawal on phone](/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/outputs/bronchoscopy-foundations-course-flow-2026-09-14/phone-acceptance/04-learner-depth-return.png)
- [After: successful changed-target retry on phone](/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/outputs/bronchoscopy-foundations-course-flow-2026-09-14/phone-acceptance/09-target-retry-success.png)
- [After: integrated desktop controls](/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/outputs/bronchoscopy-foundations-course-flow-2026-09-14/desktop-and-cases/bronchoscopy-foundations-t-967e9--and-honest-records-at-1440/04-learner-depth-return.png)
- [After: 200% CSS zoom](/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/outputs/bronchoscopy-foundations-course-flow-2026-09-14/desktop-and-cases/bronchoscopy-foundations-t-da941-eadable-at-200-percent-zoom/course-200-percent.png)

Full-page captures preserve the actual sticky continuation; viewport captures show its position during native control work. The `viewport-matrix/` folder includes all 23 first screens at desktop and the five representative sections at each smaller size. `logs/` preserves the baseline, intermediate failures and final checks.

## Human review still needed

The proposed flow is a design hypothesis, not evidence of educational efficacy. Existing faculty, media-rights, local-policy and authored-geometry review statuses remain pending. Normal stills, CT images and the scope model are not represented as a registered study. No new abnormal images, thresholds, doses, device limits or hand-skill measurements were introduced. Existing source blocks and citations were inspected; the local knowledge specification was consulted for the camera primer, but the underlying books, complete transcripts and source media were not re-reviewed in their entirety.

The known authored larynx/trachea junction gap remains approximately 2.4168 mm and the existing test TODO remains. Native screen-reader testing, physical scope observation and novice human usability testing remain outside the completed software QA. There is no deployment, release/access change or merge to main.

### Small novice usability protocol

Recruit three to five clinicians beginning bronchoscopy training. Use a desktop and phone. Ask each to start fresh, locate an instrument part, advance and withdraw, use a normal-airway tour, make a deterioration decision, and report a limitation from the available record. Then reload and continue.

At each transition, ask the participant to state the current task, find its control, describe the result and continue without coaching. Record navigation errors (could not find the task/control/feedback/continuation) separately from content errors (misidentified anatomy, misinterpreted observations or chose an unsupported statement). Record assistance and time descriptively; do not introduce a speed score. Review recurrent navigation problems before a larger pilot. Faculty separately reviews the clinical reasoning, supported media and physical-skill boundary. No automated pass is substituted for these observations.
