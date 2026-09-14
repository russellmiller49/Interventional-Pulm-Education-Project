# MV-01 — implementation handoff

## Delivery and scope

MV-01 converts Mechanical Ventilation's current public entry paths to self-paced learning and isolates the misleading MV-03 live example. Work is on `codex/mv01-self-paced`, based on `8ef7001b8c8a6b8be3d4b833a743ad130177496b` (merged G00, PR #201). The checkout was clean before the task branch. The historical external-review baseline is `9ef04539118b889a344992c63ba35808ee477f0e`; current files, newer engine work, case definitions and assets were retained rather than reset.

The owner-authorized v2 brief supersedes older mandatory Assess, commitment-before-teaching, three-pane, first-attempt, timed, mastery and grading contracts. The `interventional-pulm-education`, `medical-education-modules` and `structured-medical-modules` skills informed this work; their conflicting examination requirements are superseded for this slice. This is not a clinical approval or a release-state change.

**Device Intelligence is excluded.** No file in `src/features/device-intelligence` was edited or audited. Shared changes have explicit MV module/ID checks; compatibility testing exercises its existing access and daily-reference tests. No new dependencies, backend, framework, deployment, merge, Supabase/upload operation, or remote learner-data mutation was performed. Repository commit/push/PR are the authorized delivery workflow.

## Causal investigation: separate from navigation

Read the [MV-03 investigation](../mv/MV-01-causal-investigation.md) and its [50 generated snapshots](../mv/MV-01-causal-samples.json). Equal-time wait, no-op FiO₂, changed FiO₂ and lower-set-rate arms have identical mechanics. A flow change alters actual Ti/Te separately. The reported 13.1 → 0.9 display change is reproduced after a 30-second baseline and reverses at a subsequent paired-breath interval. It must not be attributed to FiO₂ or treated as sustained resolution.

No physiology equations or case parameters changed. The public MV-03 route returns a worked explanation before constructing a live simulation. This applies to Practice, legacy Challenge and seeded case entry. Other cases and all current lesson experiments remain live. Faculty/RT review must define paired-breath measurement/settling behavior before the excluded live case returns. Green tests do not resolve that clinical modeling hold.

## Old → new public behavior

| Surface / contract                                                    | Current behavior                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Overview, Learn outline, case picker                                  | Meaningful section and authored case titles; every topic is reachable. Suggestions use location/visits, never old scores or inferred competence. A saved case can be reopened from the hub.                                                                                                                                    |
| Fourteen lesson hosts                                                 | Back, Continue and section/step selectors are independent of correctness, prediction and observation. All teaching/source blocks can be opened before an answer. The existing workbench and module-specific controls remain.                                                                                                   |
| Predictions, location checks, observations                            | Optional transient reinforcement with Hint, direct Show explanation, local comparison, retry and Continue. No hint history, confidence quota, assistance penalty, stored answer or first-attempt result.                                                                                                                       |
| Settings classification                                               | Original rows, origins and rationales shown as a worked table.                                                                                                                                                                                                                                                                 |
| Story comparisons                                                     | Optional questions and explicitly separate authored engine runs. They never populate the working patient's evidence.                                                                                                                                                                                                           |
| Real run/capture                                                      | An actual action, required measurement/inspection, correct patient/device/condition identity and observation interval remain necessary to claim a response. Reading can continue while capture is unavailable. Captured results are labeled, with validity and source; merely viewing an explanation produces no response.     |
| Practice / former Assess or Challenge / capstone-style question entry | Same original case IDs and compatible routes; untimed public case sessions. Useful worked applications replace final grades and mandatory transfer. Seeded legacy URLs still resolve deterministically. Missing/invalid parameters lead to a usable setup/outline.                                                             |
| Case actions                                                          | All real controls and protective actions are usable without a quiz answer. Actual circuit prerequisites, device pending edits/confirmation, holds, alarms, safety interruptions, patient assessment and delayed action feedback remain. Restart and another variation create a fresh paused patient, not a successful attempt. |
| Results and shared consumers                                          | Public MV has no score sheet, pass/fail, mastery/independence dashboard, score-based recommendation or completion write. Old MV grades/resume pointers are excluded from current shared projections. Coarse account hydration/projection cannot revive or post MV completion claims.                                           |
| Reload / return                                                       | Only reading location and visited topics resume. Simulation, measurements, answers and action histories start fresh, paused. The UI states this explicitly. Storage failure leaves navigation usable.                                                                                                                          |

## Progress and legacy records

`mechanical-ventilation-self-paced-v1` stores only `{ version: 1, visited: string[], location?: { section, id, step } }`. Existing console preference uses `ventilation-learning-device`. This is minimal local MV state, not a new cross-module progress service. A visit is explicitly a visit, including in DOM attributes; it does not imply completion.

Public entry paths no longer read/write the legacy answer, graded case, live-lab checkpoint or session stores. Existing `mechanical-ventilation-learning-flow-v1`, `mechanical-ventilation-live-learning-v1`, `mechanical-ventilation-progress-v2`, `hamilton-c6-ventilation-progress-v1`, `mechanical-ventilation-session-v1`, and normalized `critical-care-activity-progress-v1` bytes are preserved by self-paced interactions. The old V1→V2 **read-side write** in `engine/progress.ts` was removed; pure parsing remains.

The shared legacy MV adapter still classifies stored formats/corruption read-only, but produces no current activities/resume. Read projections filter normalized historical MV claims without rewriting their source. The account-sync subset merge retains opaque historical local records; the MV-specific allowlist exclusion prevents new hydrated completion or posting old MV progress. Other module projection behavior, account ownership, authentication and access controls are unchanged.

`CaseWorkflow`, `MechanicalVentilationLab`, old graded question/progress helpers and replay parsers remain dormant for compatibility. Import searches found no public route consumers of those old MV renderers. Their existing engine/data compatibility tests remain. No new fellowship or graded-mode framework was added.

## Test-contract migration

The old assertions remain available at base commit `8ef7001b` and in the original baseline/exploratory logs. Files retired from current test discovery are deleted, not silently skipped. No zero-test suite is counted as evidence.

| Previous assertion / file                                                                                                                            | Why superseded and replacement                                                                                                                                                                                                                 | Invariants retained                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `stage-host.test.tsx` (5 tests): locked future steps, mandatory prediction/transfer completion, full patient replay, restart                         | Consolidated into `self-paced.test.tsx`, `stage-learner-review.test.tsx` and `self-paced-progress.test.ts`: every step/section reachable, direct reveal and wrong-choice retry; reload restores only location; restart begins a fresh patient. | Real reducer state, actual result identity, no fake prediction/run, legacy bytes unchanged.                                                            |
| `stage-interactions.test.tsx` (5): mandatory four-stop walk, withheld location teaching, immutable answers, scored sort, gated inspection sequence   | Freely selectable synchronized landmarks; optional location; worked classification table; real capture requirements tested separately from navigation.                                                                                         | Linked pressure/flow/volume cursors, actual inspection/hold and timing.                                                                                |
| `stage-precommit-leak.rendered.test.tsx` (14 cases + aggregate): forbid explanatory content, meaningful findings and source claims before commitment | Replaced by 14 `stage-teaching-disclosure.test.tsx` cases: named outline, open teaching and source limitations before answering, no acquired response.                                                                                         | Source records, actual model/measurement boundary, stable case/lesson identities.                                                                      |
| `stage-learner-review.test.tsx`: fixed commitment-driven presentation/replay                                                                         | Rewritten as 21 checks of the 14 current hosts, synchronized landmarks, actual hold/capture and all four devices' pending edits/native confirmation.                                                                                           | Device workflow, actual plateaus, one patient, correct measurement prerequisites.                                                                      |
| `case-activity-v2.test.tsx` (6): checkpoint resave, score-before-transfer, mastery telemetry, withheld Assess coaching, scored replay                | Replaced by public legacy-mode checks in `self-paced.test.tsx` and 4 `case-self-paced-safety.test.tsx` cases. No graded checkpoint or telemetry; every route ungraded; real action feedback allowed without an answer.                         | Real circuit-action prerequisite, elapsed response interval, paused clock, immediate safety interruption, deterministic variation and device identity. |
| `learning-lab.test.ts`: block changing a control in prediction phase                                                                                 | Only the quiz lock is removed; optional prediction can coexist with actual controls.                                                                                                                                                           | All existing experiment goals, hold identity, confound/invalidation, timing, and physiological tests remain.                                           |
| `pathway-resolver.test.tsx`: old completed-lab recommendations and diagnosis masking                                                                 | Suggestions use actual visits/location; all-visited means revisit, not competence. Authored case titles are shown.                                                                                                                             | Canonical order, stable pairings, known IDs and usable routes.                                                                                         |
| `setup-v2.test.tsx`, `reducer-progress.test.ts`: write graded setup/preference and automatic V1 migration                                            | Setup says Open case and saves only console preference; reading an old record does not write a replacement.                                                                                                                                    | Existing safe device/seed validation and legacy parsers.                                                                                               |
| Shared `catalogs`, `adapters`, `merge-recommendation`, `integrated` tests                                                                            | MV has no mandatory predecessors/mastery authority; historical MV scores neither recommend nor count as current preparation. Generic continue-priority test now uses another module, with explicit MV inertness checks added.                  | Other module contracts; no inferred completion; ICU preview eligibility unchanged; read-only storage and corruption handling.                          |
| Added causal and shared-progress checks                                                                                                              | Five causal controls; local minimal-state parsing, exact legacy-byte preservation, no fabricated action/result, no MV account hydration or POST.                                                                                               | Actual physiology and serialization boundaries.                                                                                                        |

The [question ledger](MV-01-question-ledger.md) records keep/rewrite/replace/combine/remove for 46 existing short-case items, 28 lab predictions, 3 location items, 10 dynamic observations, the settings-sort rows, 2 story comparisons and all 15 case field groups. Counts describe the inventory, not quotas.

## Executed verification

Evidence directory (generated outputs only): `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/mv01-self-paced-2026-09-14/`. It contains the reproduction, full Jest JSON/logs, baseline failure comparison, browser scripts/reports and screenshots. The ephemeral local-auth token is excluded. The raw v2 pack/report and private source assets were read in place and not copied into Git.

| Executed command / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Actual result                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline: `npx --no-install jest --runInBand --runTestsByPath src/features/mechanical-ventilation/__tests__/physics-waveforms.test.ts src/features/mechanical-ventilation/__tests__/learning-flow.test.ts src/features/mechanical-ventilation/__tests__/learning-lab.test.ts src/features/mechanical-ventilation/__tests__/case-activity-v2.test.tsx src/features/mechanical-ventilation/__tests__/stage-interactions.test.tsx --json --outputFile=/tmp/mv01-self-paced/baseline-tests.json`                                                                                                              | **5 suites / 212 tests passed**, before conversion.                                                                                                                                                                                                                                                                                                                                         |
| `node node_modules/tsx/dist/cli.mjs src/features/mechanical-ventilation/test-support/causal-experiment.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Both initial states × five arms × five endpoints; 50 actual snapshots. Separate phase probe records the subsequent rebound.                                                                                                                                                                                                                                                                 |
| Final broad regression: `npx --no-install jest --runInBand src/features/mechanical-ventilation src/features/critical-care/progress/__tests__ src/features/critical-care/__tests__ src/features/critical-care/components --json --outputFile=/tmp/mv01-self-paced/verified-regressions.json`                                                                                                                                                                                                                                                                                                               | **52 suites: 50 passed, 2 failed. 850 tests: 848 passed, 2 failed, 0 skipped. All 29 MV suites / 649 MV tests passed.** The two failures below are present on the clean base; no new failing test remains.                                                                                                                                                                                  |
| `npx --no-install jest --runInBand --runTestsByPath 'src/app/[locale]/mechanical-ventilation/routes.test.tsx' src/features/device-intelligence/__tests__/route-access.test.ts src/features/device-intelligence/__tests__/daily-reference.test.tsx src/features/learning-module/activity/__tests__/clinical-contracts.test.ts src/features/learning-module/activity/__tests__/evidence-authority.test.ts src/features/learning-module/__tests__/criticalCareShellConvergence.test.tsx src/features/learning-module/moduleRoutes.test.ts --json --outputFile=/tmp/mv01-self-paced/compatibility-final.json` | **7 suites / 51 tests passed**, including the excluded consumer's **2 existing suites / 29 tests**.                                                                                                                                                                                                                                                                                         |
| `npm run type-check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | **Passed** (`tsc --noEmit`).                                                                                                                                                                                                                                                                                                                                                                |
| `node node_modules/eslint/bin/eslint.js --max-warnings=0 <explicit changed TS/TSX paths>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **Passed, no warnings**. Exact file list follows below and is retained with the evidence.                                                                                                                                                                                                                                                                                                   |
| `git diff --check` and Prettier on changed paths                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | **Passed**.                                                                                                                                                                                                                                                                                                                                                                                 |
| Local Next development server: `node node_modules/next/dist/bin/next dev --webpack --port 3110`; `node /tmp/mv01-self-paced/browser-check.cjs`                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **40 route/action scenarios, 7 layout checks passed, zero page errors**. Fresh hub/outline, all 14 lessons, all 15 cases, wrong/no answer, Hint, direct explanation, retry, unrestricted Continue/jump, real VT edit + run + capture, circuit prerequisite + delayed feedback, restart/variation, saved placement/review/final/seeded Challenge, reload and return. Legacy bytes unchanged. |
| `node /tmp/mv01-self-paced/browser-entry-check.cjs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | **15 entry-layout checks and 2 fallback scenarios passed, zero page errors**: five entry surfaces × 320/768/1440 widths, invalid lesson fallback, and blocked local progress storage. No page overflow; explanation/Continue remains usable when storage is blocked.                                                                                                                        |

The native browser run uses Chromium with the existing local-development authentication mechanism. Final browser runs intercept `/api/*` locally and block external requests; no backend, grading service or production data is touched. Generic site `/api/analytics` requests were observed and intercepted; MV question/help actions write no response or assistance history. The test-only browser storage probe `lswt-*` is transient and was verified absent after use. Every legacy MV/normalized fixture value remains byte-identical. Native device confirmation is also exercised across all four devices in the rendered regression tests.

At 320, 390, 768, 1024, 1280 and 1440 pixels, lesson document width equals viewport width; Tab/Enter reaches and activates Continue with a visible focus ring. A CSS 200% content-zoom check retains document flow and access to explanation/navigation. Screenshots were inspected for desktop prediction, actual captured waveforms, the MV-03 hold, narrow lesson/case fallback and enlarged content. This is not a claim of a full screen-reader audit or a native browser-zoom matrix.

### Pre-existing failures, preserved

A detached temporary checkout of exact base `8ef7001b` ran:

```sh
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/features/critical-care/__tests__/accessibility.test.tsx src/features/critical-care/__tests__/learner-copy.test.ts --json --outputFile=/tmp/mv01-self-paced/unrelated-baseline.json
```

Result: **22 tests, 20 passed, the same 2 failed**. The first expects an obsolete CRRT circuit image accessible name. The second is a static wording check with existing MCS, ECMO and CRRT findings (including the clinically ordinary word “assessment”). Its failure payload is identical before and after MV-01. Neither test nor those modules was edited. `preexisting-failure-comparison.json` records matching failure names and identical copy findings.

The first exploratory conversion run had 64 failures / 772 tests; the second had 23 / 848 while the test migration was incomplete. A later intermediate run had one MV fixture/prop-selector mismatch in addition to the two base failures. Those Jest logs remain. Browser discovery failures are documented in `exploration-notes.md`, with the retained Practice-select diagnostic in `entry-overflow-pre-fix.json`; final reruns replace the temporary browser logs/reports. The final results above replace their outcome claims, not their historical evidence. An early syntax-error suite discovered no tests and is **not counted as a verification pass**.

### Checks not run

No full production build/export, deployment, live account-data synchronization, remote upload, Safari/Firefox matrix, formal VoiceOver audit, clinical validation or faculty/RT acceptance was performed. The development server compiled/rendered actual routes; type checks, targeted tests and real browser actions are the technical evidence. Existing publication/media/auth/privacy boundaries were preserved, not newly certified.

## Holds and next slice

- **MV-03 live example:** excluded pending attributable ventilation faculty/RT agreement on paired-breath PEEPi measurement, initialization and settling. The causal investigation does not authorize a replacement physiological model.
- Existing source, manufacturer/IFU, content review, language fallback, noindex and publication status remain unchanged. No source identities, faculty approvals, clinical media or review dates were created.
- Existing plateau/hold limitations are displayed; a trace estimate is not a performed passive hold. After-action comparisons require actual time and action identity, and do not prove a clinical diagnosis.
- Next bounded implementation: **MV-02 — Teach the PEEP response through matched, replayable comparisons.** Carry this baseline, hold, minimal progress and ungraded contracts forward. Do not restore score-dependent paths or treat this PR as clinical acceptance.

## Changed files

The file inventory below separates the diagnostic investigation, MV navigation/progress and explicitly MV-scoped shared consumers. No `simulation.ts`, `physics.ts`, case definition, runtime asset or Device Intelligence file is changed.

### Causal reproduction and hold evidence

- `docs/gap-remediation/mv/MV-01-causal-investigation.md`
- `docs/gap-remediation/mv/MV-01-causal-samples.json`
- `src/features/mechanical-ventilation/__tests__/causal-experiment.test.ts`
- `src/features/mechanical-ventilation/test-support/causal-experiment.ts`

### MV entry, teaching, local progress and presentation

- `src/app/[locale]/mechanical-ventilation/assess/page.tsx`
- `src/features/mechanical-ventilation/components/MechanicalVentilationAssessSetupV2.tsx`
- `src/features/mechanical-ventilation/components/MechanicalVentilationCaseActivityV2.tsx`
- `src/features/mechanical-ventilation/components/MechanicalVentilationCourseCheck.tsx`
- `src/features/mechanical-ventilation/components/MechanicalVentilationHub.tsx`
- `src/features/mechanical-ventilation/components/MechanicalVentilationLearnLanding.tsx`
- `src/features/mechanical-ventilation/components/MechanicalVentilationModuleFrame.tsx`
- `src/features/mechanical-ventilation/components/MechanicalVentilationPracticePicker.tsx`
- `src/features/mechanical-ventilation/components/VentilationPathwayAccordion.tsx`
- `src/features/mechanical-ventilation/components/VentilationReinforcement.tsx`
- `src/features/mechanical-ventilation/components/mechanical-ventilation-hub.module.css`
- `src/features/mechanical-ventilation/components/stage/FoundationTeaching.tsx`
- `src/features/mechanical-ventilation/components/stage/VentilationPrerequisite.tsx`
- `src/features/mechanical-ventilation/components/stage/VentilationStageHost.tsx`
- `src/features/mechanical-ventilation/components/stage/VentilationStoryProblems.tsx`
- `src/features/mechanical-ventilation/components/stage/VentilationTeachingColumn.tsx`
- `src/features/mechanical-ventilation/components/stage/task-flow.module.css`
- `src/features/mechanical-ventilation/components/stage/useVentilationLabSession.ts`
- `src/features/mechanical-ventilation/components/useVentilationSelfPacedProgress.ts`
- `src/features/mechanical-ventilation/content/casePresentation.ts`
- `src/features/mechanical-ventilation/content/pathwayResolver.ts`
- `src/features/mechanical-ventilation/content/postActionCoaching.ts`
- `src/features/mechanical-ventilation/engine/learningLab.ts`
- `src/features/mechanical-ventilation/engine/progress.ts`
- `src/features/mechanical-ventilation/engine/selfPacedProgress.ts`

### MV-specific shared consumer changes

- `src/features/critical-care/content/activities.ts`
- `src/features/critical-care/dashboard.ts`
- `src/features/critical-care/progress/adapters/ventilation.ts`
- `src/features/critical-care/progress/index.ts`
- `src/features/critical-care/progress/publicAccountSync.ts`
- `src/features/critical-care/progress/publicClient.ts`
- `src/features/critical-care/progress/recommendation.ts`
- `src/features/critical-care/progress/utils.ts`

### Test contract changes

- `src/features/critical-care/__tests__/catalogs.test.ts`
- `src/features/critical-care/progress/__tests__/adapters.test.ts`
- `src/features/critical-care/progress/__tests__/integrated.test.ts`
- `src/features/critical-care/progress/__tests__/merge-recommendation.test.ts`
- `src/features/mechanical-ventilation/__tests__/case-activity-v2.test.tsx` (retired; retained in Git history)
- `src/features/mechanical-ventilation/__tests__/case-self-paced-safety.test.tsx`
- `src/features/mechanical-ventilation/__tests__/learning-lab.test.ts`
- `src/features/mechanical-ventilation/__tests__/pathway-resolver.test.tsx`
- `src/features/mechanical-ventilation/__tests__/reducer-progress.test.ts`
- `src/features/mechanical-ventilation/__tests__/self-paced-progress.test.ts`
- `src/features/mechanical-ventilation/__tests__/self-paced.test.tsx`
- `src/features/mechanical-ventilation/__tests__/setup-v2.test.tsx`
- `src/features/mechanical-ventilation/__tests__/stage-host.test.tsx` (retired; retained in Git history)
- `src/features/mechanical-ventilation/__tests__/stage-interactions.test.tsx` (retired; retained in Git history)
- `src/features/mechanical-ventilation/__tests__/stage-learner-review.test.tsx`
- `src/features/mechanical-ventilation/__tests__/stage-precommit-leak.rendered.test.tsx` (retired; retained in Git history)
- `src/features/mechanical-ventilation/__tests__/stage-teaching-disclosure.test.tsx`

### Handoff documents

- `docs/gap-remediation/self-paced/MV-01-handoff.md`
- `docs/gap-remediation/self-paced/MV-01-question-ledger.md`
- `docs/gap-remediation/self-paced/README.md`
- `docs/gap-remediation/self-paced/implementation-plan.md`
