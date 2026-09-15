# CRRT-01 implementation handoff

## Delivery and learning design

CRRT-01 converts the current public CRRT experience to self-paced, ungraded learning. The work uses `codex/track-a-crrt` in the assigned worktree. Initial checkout and refreshed `origin/main`: `5d21844f3ed89d6f21ef1b12a1bb14a36355c21a`; the initial working tree was clean. Historical external-review baseline: `9ef04539118b889a344992c63ba35808ee477f0e`. Seventeen CRRT files had changed since that historical baseline, including the newer G01 source dates, reviewer queue and filter-drop hold. That work was retained.

The intended learner is a clinician/trainee reviewing CRRT concepts and model-based decisions. This supports understanding and simulated reasoning, not bedside competence. The existing normal blood path → fluid paths → pressure sites → known-fault sequence remains the recommended introduction. Meaningful task titles, all eight lessons, 17 Practice case entries, five rapid drills and CRRT-16 on the legacy Assess URL remain accessible. There is no new course framework, dependency, backend or device model.

The owner-authorized v2 prompt and learning design brief supersede the older required prediction, scoring/mastery, first-attempt and fixed-layout teaching defaults. The `interventional-pulm-education`, `medical-education-modules` and `structured-medical-modules` skills informed the implementation and rendered review. Their exam-oriented defaults are intentionally not acceptance requirements for this slice.

**Device Intelligence was not modified.** No other module, `learning-module` file, global route, source-review queue, authentication/access rule, asset or deployment configuration was changed. The narrow shared CRRT integration changes below are expressly included in CRRT-01's scope and are covered by consumer tests. They were applied serially in this worktree.

## Current behavior

- All 18 case forms are replaced by directly available worked plans. Goal and reassessment reminders remain teaching context. Explain, hints, clinical actions, device controls and navigation do not require five answers or a correct mechanism prediction.
- All 58 Learn tasks are reachable from the lesson map. Every optional question exposes an explanation before answering, session-only reasoning feedback, retry and unrestricted Continue. Guided exercises retain their real observation requirements for a claimed exercise; a separate Continue does not claim completion.
- The integration simulator's correction versus paused-escalation choice is independent of its optional question. Selecting a path performs no action. Actual inspection, pause, correction, resumption and timed recording still follow the existing model's prerequisites.
- The CRRT workspace composes the existing native frame/chrome with `showProgressStepper={false}`. Its case guide and tabs remain; opening a later phase no longer shows earlier phases as completed. No shared shell code changed.
- Case debrief separates the worked explanation from actual session actions/observations. It distinguishes an example with no run from a run the learner operated. Reviewing rapid-drill steps does not mark a cause corrected.
- New local progress records only lesson/case visits and the last location/time. No new grades, question histories, graded attempts, hint histories, competency claims or learning analytics are written. Existing response correctness may support transient feedback only.

See the [complete question ledger](CRRT-01-question-ledger.md): all 90 former case answer fields, 25 Learn questions, two numeric exercises, pressure/prescription comparisons and five rapid drills have an explicit disposition and teaching purpose.

## Shared integration slice

| File                                          | Required CRRT-only change                                                                                                          | Targeted protection                                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `critical-care/content/activities.ts`         | CRRT catalog entries have no prerequisites/mastery rule or completion authority; legacy Assess is an ungraded practice case.       | Every CRRT entry and the stable Assess path are checked; existing other-module catalog behavior is retained. |
| `critical-care/progress/adapters/crrt.ts`     | Read historical storage for diagnostics, project only new visits with zero attempts and no score, and resolve the saved selection. | Historical valid/corrupt/versioned storage, raw preservation, visits, resume and no inferred mastery.        |
| `critical-care/progress/index.ts`             | Ignore old normalized `crrt:` grades when merging current progress.                                                                | Current CRRT recommendations remain unblocked; hemodynamics progress remains unchanged.                      |
| `critical-care/progress/publicClient.ts`      | Apply the same CRRT-only filter in the public reader.                                                                              | Seeded legacy plus normalized mastery produces no current grade/competency claim.                            |
| `critical-care/progress/publicAccountSync.ts` | Exclude CRRT from coarse account completion upload/hydration, preserving old account records.                                      | Both directions are tested without contacting an account/backend.                                            |

Shared adapter/account tests were updated only where they asserted the superseded CRRT grade contract. Broader progress tests remain included in the regression command. No opportunistic shared refactor or integration change for another module was performed.

## Test-contract migration

| Old assertion                                                            | New assertion / reason                                                                       | Preserved invariant                                                                                       |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Five goal/mechanism/control/response/reassessment answers precede a case | Direct worked plan; all 18 public cases accept no-answer exploration                         | No synthetic prediction or action is submitted to open controls.                                          |
| A completed graded debrief writes a result, hints and mastery            | Debrief is explanation plus actual session evidence; new storage adds only visits/location   | Legacy values remain intact, including unknown fields; no normalized/account completion claim.            |
| Every Learn task must be completed in sequence                           | Continue and map navigation can skip any exercise                                            | Skipping creates no answer, completed-task marker, observation, correction or recorded interval.          |
| Every completed Learn response is appended to history                    | Responses/feedback exist only in the current session                                         | Reload/repeat start fresh controls; old history remains read-only.                                        |
| An integration question chooses the simulator plan                       | Separate explicit exploration buttons choose that path                                       | Choice alone changes no simulation state, snapshot, pump, correction or observation.                      |
| Pressure prediction is required before explanation                       | Direct comparison labels absent predictions honestly                                         | No completion callback claims an unanswered prediction.                                                   |
| Rapid-drill checklist review verifies correction                         | Steps show reviewed teaching only                                                            | `correctionVerified` and device state are not fabricated.                                                 |
| Shared phase navigation marks earlier phases complete                    | CRRT uses its case guide and tabs; standalone phase navigation supplies no completion claims | Viewing an example cannot create visible or screen-reader claims that Predict/Act/Observe were completed. |
| Legacy Assess withholds hints and current consumers display old mastery  | Hints available; stable URL opens CRRT-16; old scores inert                                  | Clinical warnings, device interlocks and actual reassessment remain meaningful.                           |

No safety, physics, source, rights or data-validation assertion was removed to obtain a green suite. Dormant grading unit tests remain compatibility tests; their code has no current public writer or grade consumer. No test was skipped or disabled.

## Executed evidence

### Baseline and final regressions

```sh
npx --no-install jest src/features/baxter-crrt src/lib/draft-modules.baxter-crrt.test.ts src/lib/site-search.baxter-crrt.test.ts src/app/sitemap.baxter-crrt.test.ts --runInBand
```

Initial baseline: **60 suites / 596 tests passed** (`/tmp/crrt-01-baseline.log`).

```sh
npx --no-install jest src/features/baxter-crrt src/features/critical-care/progress/__tests__ src/lib/draft-modules.baxter-crrt.test.ts src/lib/site-search.baxter-crrt.test.ts src/app/sitemap.baxter-crrt.test.ts --runInBand
```

Final result: **67 suites / 683 tests passed** (`/tmp/crrt-01-jest-commit-final.log`). This includes all 18 case renderers, all eight no-answer lesson traversals, optional help/retry, legacy preservation, true action prerequisites, dialog/draft navigation distinguished from performed work, delayed responses, clinical/device/source boundaries and CRRT shared consumers.

```sh
npx --no-install playwright test -c playwright.baxter-crrt.config.ts
```

Full suite: **15 tests passed** (`/tmp/crrt-01-browser-final-pass.log`). After removing inferred phase-completion marks from the CRRT header, the affected Operations and self-paced specs were reverified: **8 tests passed** (`/tmp/crrt-01-browser-delivery.log`), including all 18 case routes. Command for that final browser subset:

```sh
npx --no-install playwright test -c playwright.baxter-crrt.config.ts e2e/baxter-crrt-self-paced.spec.ts e2e/baxter-crrt-operations.spec.ts
```

The browser uses local Chromium and the existing CRRT config on port 3113 with dummy preview Supabase values. It exercises the actual Next routes: all 18 case URLs, all eight lesson journeys, optional explanation, wrong answer, retry, hints, no-answer Continue, map jumps, native keyboard actions, Back/Forward, reload, repeat, real device actions and delayed observations. Desktop and compact/reduced-motion paths are included, with reflow checks from 320 to 1440 pixels. This is browser automation, not clinical acceptance or a formal screen-reader audit.

| Check                                             | Result                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx --no-install tsc --noEmit`                   | Passed, exit 0 (`/tmp/crrt-01-typecheck-commit.log`). Run after the browser server stopped.                                                                                                                                                                                                                                                                                                          |
| ESLint on all changed TypeScript/config/E2E paths | Passed without warnings (`/tmp/crrt-01-lint-final.log`).                                                                                                                                                                                                                                                                                                                                             |
| `npm run lint`                                    | Exit 0, **0 errors / 15 warnings** in unchanged files outside the edited CRRT/shared paths (`/tmp/crrt-01-repo-lint.log`).                                                                                                                                                                                                                                                                           |
| `git diff --check` and Prettier                   | Passed; commit hook also runs lint-staged on reviewed paths.                                                                                                                                                                                                                                                                                                                                         |
| Production build                                  | Passed, exit 0: `NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only npm run build` (`/tmp/crrt-01-build.log`). Includes both training apps, 24 content documents, 19 critical-care and seven cardiac-device assets, Next production compilation and standalone preparation. Only local build output was produced; the preview credentials are dummy values. |

### Numeric/device preservation

All 18 normalized engine fixtures were captured before and after the conversion using `normalizeRuntimeCrrtCaseToEngineFixture`. Recursive comparison found **zero changes to numeric values, booleans, source IDs, event actions, device configuration or other non-label fields**. Sixty text labels (`bag.label`/`access.catheterDescriptor`) retain their original “Synthetic” wording because presentation substitution no longer traverses physics/source objects. Runtime normalization and pressure/dose/balance calculation functions are unchanged. Evidence: `/tmp/crrt-01-fixtures-before.json`, `/tmp/crrt-01-fixtures-after.json`, `/tmp/crrt-01-fixture-comparison-final.log`.

### Rendered review

Inspected the desktop actual-run and example-only debriefs, the compact Assess worked plan, a compact citrate comparison viewport and the Learn mobile journey. The initial desktop review exposed inferred completion marks in the shared header; the CRRT-only composition change removed them, and the final screenshot confirms the case guide and tabs remain with no completed earlier phases. No horizontal document overflow was observed in the scripted viewport checks.

Current local screenshots include:

- [Example-only Challenge debrief, desktop](/tmp/crrt-batch-c-playwright/baxter-crrt-self-paced-all-01cba-brief-without-invented-work/assess-example-desktop.png)
- [Actual action/time run, desktop](/tmp/crrt-batch-c-playwright/baxter-crrt-self-paced-rea-5a898-ations-without-a-prediction/actual-run-desktop.png)
- [Worked plan and case controls, compact](/tmp/crrt-batch-c-playwright/baxter-crrt-self-paced-com-49f27-gation-and-a-worked-example/assess-mobile.png)
- [Learn navigation, compact](/tmp/crrt-batch-c-playwright/baxter-crrt-self-paced-Lea-cbc66-ap-jump-reload-and-keyboard/learn-mobile.png)

Browser images/logs are generated local verification artifacts, not source inputs or clinical records; they are not committed.

The review follows the medical-education rubric with the v2 exceptions above: open titles and explanations are intended teaching; grades/assessment security are out of scope. Rendered examples clearly identify missing run evidence; actual action paths retain valid controls; clinical uncertainty remains visible. Pending clinical/source issues are listed below. The conversion does not claim all legacy content is clinically validated.

### Intermediate failures retained

Logs preserve the test migration history. The initial converted suite had 19 failures / 587 discovered tests across eight suites (`/tmp/crrt-01-regression.log`); the later broad run had one obsolete quiz-to-plan assertion among 682 tests (`/tmp/crrt-01-regression-final.log`). Those assertions were replaced with the explicit contracts above, not suppressed.

The first browser attempt was interrupted after discovering a hidden-tab locator. The next four-test run passed three and found an ambiguous action-label locator; it was made specific to the actual action article. Full 15-test runs then found old form/first-response assertions (13 passed), then the removed teaching-mode-checkbox assertion (14 passed). Logs: `/tmp/crrt-01-browser.log`, `-browser-2.log`, `-browser-final.log`, `-browser-verified.log`. Final verification is reported separately above. A late CRRT-only shell composition check caught a wrong import path for the existing concept strip: 66 suites / 676 tests passed and one suite failed to load (`/tmp/crrt-01-jest-delivery-final.log`). The import was corrected before final verification. Its concurrent browser run was interrupted after Next Fast Refresh errors (`/tmp/crrt-01-browser-shell-final.log`) and restarted cleanly; it is not counted as a pass. An overlapping type check found missing `.next/dev/types` route files while Next regenerated them; it was rerun after the browser server ended. That failed run is retained in `/tmp/crrt-01-typecheck-verified.log`.

## Legacy progress and persistence

`baxter-crrt-progress-v3` remains the storage key. `selfPaced` is a small extension with `visitedLessonIds`, `visitedCaseIds`, `lastLocation` and `updatedAt`; Learn location includes a validated task ID. The last Challenge selection is stored as the existing `MASTERY-PRISMAX-01` identity. The reader does not infer visits from prior completion or grades.

Writes preserve the parsed legacy payload and unknown fields, adding/replacing only `selfPaced`. They do not run the legacy serializer/migration. Unsupported versions, unreadable JSON and unavailable storage remain untouched; navigation still works. Legacy normalized storage is read-only in these CRRT hosts. Current read models drop its old CRRT grades without deleting those records. Old account completion remains stored remotely but is not hydrated or uploaded by current CRRT sessions.

Only the lesson/case selection is resumed; simulation controls and answers start fresh on re-entry. A saved task ID is location information, not a captured run. Current in-memory “reviewed” task markers require actual feedback review; they are not persisted as completion. The stable historical scoring manifest/reducers remain dormant and tested for compatibility, including their old thresholds. They do not affect access, recommendations, debrief claims or writes.

## Source/clinical holds and next slice

- **G01-CRRT-02:** the exact placement of the PrisMax filter-drop −25 mmHg correction remains pending device review. The printed/manual versus simulation distinction and current numerical calculations are preserved; no replacement offset was guessed.
- The program-version-2.XX boundary, source publication/check dates, named source types, and “none recorded yet” clinical/device review status remain. No later manual, device review, clinical sign-off or review date was invented.
- Existing source conflicts and unresolved makeup-fluid attribution remain unresolved. Missing data stays unavailable. Citrate instruction remains qualitative and excludes dosing/titration or unsourced restart recommendations; current device instructions and local protocol still govern bedside care.
- G01's citation/currency and citrate review queue remains in [G01-crrt-source-review-queue.json](G01-crrt-source-review-queue.json). The same source facts are now reachable without required Learn responses.
- The module remains **unlisted preview**. No release-state change, deployment, publication, upload, backend or learner-account mutation was performed. No code or test result constitutes clinical approval.
- **Next slice:** CRRT-02/CRRT-03 should refine generic worked-case explanations and retained question feedback using attributable clinical/device review. They should preserve this ungraded storage/access contract and address source holds explicitly rather than treating existing numeric examples as authority.

## Checks not run

No clinical/faculty/device acceptance, real console validation, live account synchronization, Safari/Firefox matrix, formal VoiceOver/screen-reader audit, production deployment, media-rights review or new clinical literature verification was performed. Existing protected files and controls were preserved; no Supabase/upload/shared-state scripts ran.

## Changed files

Paths are repository-relative; the PR diff is authoritative. The inventory includes implementation, specifically scoped shared consumers, tests and this handoff/ledger.

- `docs/gap-remediation/self-paced/CRRT-01-handoff.md`
- `docs/gap-remediation/self-paced/CRRT-01-question-ledger.md`
- `e2e/baxter-crrt-advanced.spec.ts`
- `e2e/baxter-crrt-foundations.spec.ts`
- `e2e/baxter-crrt-operations.spec.ts`
- `e2e/baxter-crrt-self-paced.spec.ts`
- `playwright.baxter-crrt.config.ts`
- `src/features/baxter-crrt/__tests__/CrrtRapidDrillReview.test.tsx`
- `src/features/baxter-crrt/__tests__/advancedLessons.ui.test.tsx`
- `src/features/baxter-crrt/__tests__/foundationLessons.ui.test.tsx`
- `src/features/baxter-crrt/__tests__/integrationModel.test.ts`
- `src/features/baxter-crrt/__tests__/learningWorkflow.ui.test.tsx`
- `src/features/baxter-crrt/__tests__/operationalLessons.ui.test.tsx`
- `src/features/baxter-crrt/__tests__/pathwaySequencing.test.ts`
- `src/features/baxter-crrt/__tests__/practiceAssess.ui.test.tsx`
- `src/features/baxter-crrt/__tests__/selfPaced.test.tsx`
- `src/features/baxter-crrt/__tests__/selfPacedConsumers.test.ts`
- `src/features/baxter-crrt/components/BaxterCrrtAssess.tsx`
- `src/features/baxter-crrt/components/BaxterCrrtHub.tsx`
- `src/features/baxter-crrt/components/BaxterCrrtLearn.tsx`
- `src/features/baxter-crrt/components/BaxterCrrtPractice.tsx`
- `src/features/baxter-crrt/components/CrrtActivityWorkspace.tsx`
- `src/features/baxter-crrt/components/CrrtCasePlayer.tsx`
- `src/features/baxter-crrt/components/CrrtFoundationLesson.tsx`
- `src/features/baxter-crrt/components/CrrtIntegrationTool.tsx`
- `src/features/baxter-crrt/components/CrrtOperationalTools.tsx`
- `src/features/baxter-crrt/components/CrrtPressureLocalizationLab.tsx`
- `src/features/baxter-crrt/components/CrrtRapidDrillReview.tsx`
- `src/features/baxter-crrt/components/CrrtStagedPrescriptionBuilder.tsx`
- `src/features/baxter-crrt/content/completeCases.ts`
- `src/features/baxter-crrt/content/mastery.ts`
- `src/features/baxter-crrt/content/rapidDrillReview.ts`
- `src/features/baxter-crrt/engine/__tests__/learningSession.test.ts`
- `src/features/baxter-crrt/engine/learningSession.ts`
- `src/features/baxter-crrt/learnController.ts`
- `src/features/baxter-crrt/operationalModel.ts`
- `src/features/baxter-crrt/selfPacedProgress.ts`
- `src/features/critical-care/content/activities.ts`
- `src/features/critical-care/progress/__tests__/account-sync.test.ts`
- `src/features/critical-care/progress/__tests__/adapters.test.ts`
- `src/features/critical-care/progress/adapters/crrt.ts`
- `src/features/critical-care/progress/index.ts`
- `src/features/critical-care/progress/publicAccountSync.ts`
- `src/features/critical-care/progress/publicClient.ts`
