# Batch B implementation and validation

Base: `78397433610f4775c2d3f2404d1f2ee0f34f71c7`, clean branch `codex/crrt-9-13`.
Batch A is still in draft PR 191; this continuation stays on that branch with a separate commit.
Fetched origin; main remains at `d209c800`. No reset, merge or changes to other worktrees.

## Implementation brief

Selected scope: machine orientation, applied/recorded delivery, alarms, fluid management and
liberation reassessment. Extend the existing CRRT task controller and renderer for the two stable
IDs `crrt-alarms-troubleshooting` and `crrt-fluid-liberation`. Batch A task versions and history,
eight-lesson order, Practice/Assess scores and cases, pinned device/source gates remain unchanged.
Batch C remains deferred.

Runtime inventory was executed through `createCrrtLearningSession`: all 18 current registry cases
initialize, including entries previously described as review templates. The original pilots are
CRRT-04 (blank CVVHD setup), CRRT-10 (external fluids/net removal), and CRRT-13 (access alert).
Choose these existing immutable definitions rather than changing their scoring or normalization.

One task attempt owns the current `CrrtLearningSession`, its event sequence and labeled snapshots.
Views derive patient, prescription, pressures, circuit and cumulative ledger from that session.
Changing to a different demonstration explicitly loads a different run. Learn writes only versioned
Learn evidence through the existing adapter; it never saves a Practice outcome.

Alarm sequence: static hardware functions and CVVHD paths → original setup interface → normal
recorded readouts → applied-versus-delivered interpretation → assess and reach the access event →
localize and inspect → acknowledge, pause, observe downtime, correct → continuation decision →
resume/verify this authored case → a different verification question. Generic engine alarm mapping
does not encode manufacturer alarm priorities or automatic pump responses; show actual engine pump
state and the deliberate pause rather than inventing an automatic stop.

Fluid sequence: prepared CRRT-04 reference → event-bounded delivery timeline including its authored
pause/resumption → compute balance from recorded interval totals → missing chart-data interpretation
→ separate CRRT-10 net-removal adjustment → immediate and delayed model observations → differentiate
blood flow/dialysate/net removal → clinical liberation reassessment and contingency planning.
The scheduled CRRT-04 resumption is an authored scenario event, not a clinical restart rule.

Reuse shared LessonShell/NowCard and Batch A's broad focused composition; use the existing original
PrisMax interface for setup, canonical circuit and live pressure projection. No fixed six-phase
prediction gate or global stage modification. Deep references remain secondary; active controls
and their observations stay together.

Clinical wording remains pending human review. KDIGO 2012 chapter 5.2 supplies existing conceptual
liberation framing. The current KDIGO page describes the 2026 document as a public-review draft
being prepared for publication; no draft stopping thresholds are adopted.

## Validation

The Batch B baseline was executed on the Batch A checkout: 51 feature suites / 570 tests passed.
The current last two selected lessons still used the legacy explanation/application workbench;
they did not yet supply the requested shared-session operational journey. The Batch A numeric,
history, canonical-circuit and source-gate fixes were already present and were preserved.

## Implemented behavior and files

- `content/operationalLessons.ts`: ten alarm/orientation tasks and nine fluid/liberation tasks,
  including hardware functions, worked references, actual actions, questions and a numeric chart
  exercise. A separate operational task version leaves every Batch A task version intact.
- `content/learnTasks.ts`, `learnController.ts`: extend the existing controller. A task attempt owns
  one current run and immutable session snapshots at real actions. The same next-action predicate
  supplies the visible control and enforces the allowed operation. Completion requires the requested
  engine state and reviewed feedback; stale task/attempt/example identities are rejected.
- `operationalModel.ts`: select existing immutable CRRT-04/10/13 definitions; route setup and actions
  through the current session reducer; cap observations at events; derive interval differences from
  recorded totals. The patient chart uses the canonical fluid calculation and device attribution
  gate. Missing urine in the changed chart stays unavailable. No new treatment integrator or
  manufacturer response table is introduced.
- `engine/learningSession.ts`: one additive acknowledgement action delegates to the existing alarm
  reducer and records the same session event. It neither corrects the fault nor changes delivery.
  `components/CrrtCasePlayer.tsx` supplies its display label in the existing event-name map.
  Practice/Assess case interventions and outcome evaluation remain unchanged.
- `components/CrrtOperationalTools.tsx`: current patient/case context, applied settings, actual pump
  state, canonical pressure/circuit view, alert history, recorded delivery, numeric input/feedback,
  and before/immediate/subsequent net-removal comparison. Each different demonstration explicitly
  identifies its own run and clock. The blank CRRT-04 workflow uses the native setup projection
  until a reviewed prescription is applied; structural fixture zeros cannot appear as entered flows.
- `components/CrrtFoundationLesson.tsx`, `components/BaxterCrrtLearn.tsx`: reuse Batch A's focused
  `LessonShell`/`NowCard` composition and route transition handler. Guided evidence includes the
  event sequence, interval and engine observations. The host checks the reducer result before
  persisting completion. Independent numeric feedback preserves the first answer, including a
  wrong answer subsequently reviewed. Reopening a reached task reviews its explanation and first
  response without changing the current run.
- `components/PrismaxPilotInterface.tsx`: an additive setup presentation reuses the original eight
  checks and three native CVVHD inputs. Its reference context accurately identifies the synthetic
  patient. Hardware is exported for an explicitly static orientation. Defaults used by existing
  Practice/Assess are preserved.
- `components/CrrtPilotCircuit.tsx` and its CSS: additive focused live presentation keeps the actual
  pump state and linked pressure selection; Batch A static diagrams and full-reference defaults
  retain their distinct behavior. `crrt-foundations.module.css` adds local fluid-table/numeric
  styling and keyboard-accessible horizontal scrolling.
- `content/foundationLessons.ts` adds optional operational task types; its four task arrays are
  unchanged. `content/learnLessons.ts` adds the existing DEV-PM-005 setup citation to the alarm
  lesson. `learnEvidence.ts` updates a context-field comment; the storage schema/parser is unchanged.
- `__tests__/operationalModel.test.ts`, `__tests__/operationalLessons.ui.test.tsx`,
  `e2e/baxter-crrt-operations.spec.ts`, and `playwright.baxter-crrt.config.ts` cover the new behavior
  and retain the introductory browser suite. No dependency, global stage, auth or database change.

## Routes and instructor walkthrough

Use `/en/baxter-crrt/learn?lesson=crrt-alarms-troubleshooting` and
`/en/baxter-crrt/learn?lesson=crrt-fluid-liberation`.

For alarms, select all four hardware functions and trace the five fluid paths. Prepare the normal
reference with blood flow 120 mL/min, dialysate 1,800 mL/h and removal 100 mL/h. The initial draft
is blank; clearing blood flow also clears dependent fields. Apply values, complete modeled prime
and preparation, then start. Recorded effluent remains zero until the 15-minute observation, when
this reference records 475 mL. Interpret the changed delivery-history question before entering
the separately labeled access case.

Assess and advance CRRT-13 to its 30-minute event. Answer the inspection question, acknowledge the
actual engine alert, inspect, deliberately pause and record 10 minutes. Pumps are off and new
effluent is zero; external intake and output continue. Correct the modeled access cause, choose
the permitted continuation plan, resume and observe 10 minutes. Reassess restored pressure and
new delivery; the cumulative record retains ten minutes of downtime. Finish with a different
verification question. Acknowledgement alone cannot complete the repair task.

For fluid management, read the prepared CRRT-04 reference and record each hourly boundary to four
hours. Its two-hour pause and three-hour resumption are authored case events, explicitly separate
from clinical restart instructions. The interval chart has 680 mL external intake, 80 mL urine,
0 mL other output, 300 mL net CRRT removal and 0 mL additional device gain: +300 mL patient balance.
The question withholds the calculated answer until a finite response is submitted. Wrong valid
answers receive explanation and remain the first response. The next chart withholds urine; exact
balance is unavailable rather than treating missing output as zero.

The separate CRRT-10 run then requires tolerance and ledger review before its existing 250→350 mL/h
net-removal action. Blood flow and dialysate remain fixed, and no volume/time is retroactively added.
At 30 minutes, recorded net CRRT removal is 175 mL and patient balance is +100 mL. Read the limited
reserve/stress model comparison, apply the flow distinction to a different patient, and finish the
clinical liberation reassessment/contingency question. These numbers are synthetic exercise results,
not bedside targets or a safe-rate claim.

## Executed checks

The following results were executed on the current implementation. Timing failures and fixes are separated below.

| Check                                                                 | Executed result                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline `npx --no-install jest src/features/baxter-crrt --runInBand` | 51 suites / 570 tests passed.                                                                                                                                                                                                                                                                                                                                                                             |
| Focused engine/rendered regression run                                | 3 suites / 15 tests passed; includes the existing introductory history tests and new axe checks.                                                                                                                                                                                                                                                                                                          |
| Feature/shared-stage/pathway regression                               | `npx --no-install jest src/features/baxter-crrt src/features/learning-module/stage/__tests__ src/features/critical-care/__tests__/hub-pathway-start-alignment.test.ts --runInBand --testTimeout=60000`: 57 suites / 609 tests passed; 581.68 s under extreme host load. Exit 0; a delayed-exit/async-operations warning was printed.                                                                      |
| Type-check                                                            | `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`: passed after regenerating development route types and fixing the new event-label/test-query type omissions.                                                                                                                                                                                                                                  |
| Scoped lint                                                           | `npx --no-install eslint src/features/baxter-crrt e2e/baxter-crrt-operations.spec.ts playwright.baxter-crrt.config.ts`: passed without diagnostics.                                                                                                                                                                                                                                                       |
| Full lint                                                             | `npm run lint`: exit 0; the same 15 warnings in unchanged files outside CRRT.                                                                                                                                                                                                                                                                                                                             |
| Production build                                                      | `NODE_OPTIONS=--max-old-space-size=8192 NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3113 npm run build`: passed, including training apps, content, asset validators, production TypeScript/Next.js compilation and standalone preparation. Existing training-app chunk-size and Mermaid dependency warnings remain. |
| Development browser checks                                            | Both Batch B lessons completed at 1440×900 with pointer and 390×844 with native keyboard/reduced motion. History/reload/restart and 1280/1024/900/720/320 widths passed. Four introductory scenarios also passed. Practice/Assess entry checks passed after correcting a nonunique heading selector in the browser test.                                                                                  |
| Production browser walkthrough                                        | `npx --no-install playwright test --config=playwright.baxter-crrt.config.ts` against the standalone production server on 3113: all 8 scenarios passed in 40.9 s; 66 screenshots collected.                                                                                                                                                                                                                |

Initial validation issues were investigated, not counted as successes: a test assumed the idle
fixture prescription was unconfigured (it actually has structural zeros), one existing history
test timed out during simultaneous heavy checks, and an introductory keyboard entry failed once
during development. The corrected model assertion, isolated rendered recheck and subsequent full
introductory browser run passed. The new reference-screen test initially selected three identical
heading texts; it now selects the page's level-one heading. Earlier type-check attempts were interrupted during host contention. One attempt found malformed Next.js-generated development route types; `next typegen` regenerated them after the preview stopped. The subsequent check exposed two unsupported test-query options and the missing display label for the new timeline event; both were fixed before the successful final type-check. During the host-load spike (load average above 600), an overlapping full regression run hit default five-second limits; the serialized run with a 60-second per-test allowance passed all assertions.

After the type-check fixes, the targeted command
`npx --no-install jest src/features/baxter-crrt/__tests__/operationalModel.test.ts src/features/baxter-crrt/__tests__/operationalLessons.ui.test.tsx src/features/baxter-crrt/__tests__/practiceAssess.ui.test.tsx src/features/baxter-crrt/__tests__/learningWorkflow.ui.test.tsx --runInBand --testTimeout=60000`
passed 4 suites / 19 tests in 2.994 seconds. No assertions were relaxed. `git diff --check` passed.

## Browser evidence and limits

Artifacts are under
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/baxter-crrt/batch-b-2026-09-13`.
They include the executed case inventory, command logs, 66 final production screenshots, development screenshots and retained diagnostic output.
Screenshots were opened and inspected for hardware orientation, invalid setup, live/paused circuit,
the blank numeric chart and immediate/subsequent fluid comparison. The original Practice/Assess entry surfaces and Practice machine tab were also captured at matching viewports; the current Practice device reference and final compact comparison were opened and inspected. The compact tables have an
explicit scrolling instruction and a native keyboard-scroll check; the circuit retains fixed
topology with its existing pan control.

Browser checks use Chromium and synthetic anonymous preview settings. They do not establish
Safari/Firefox behavior, physical-device touch interaction, screen-reader usability, translated
copy, clinical correctness or successful authenticated analytics delivery. Practice/Assess browser
coverage is entry/feedback-default preservation; full scored paths are covered by the existing
feature tests, not claimed as newly completed browser cases. Incomplete lesson controls are not
restored after navigation/reload: a fresh exercise starts and saved responses/completions remain.

## Source and clinical review boundary

Source-conflict gates CONFLICT-001/002, filtration-fraction limitations and historical makeup
attribution remain in force. No calculation, pressure constant, source approval, case identity,
scoring function, role boundary or stored outcome has been replaced. A current zero makeup setting
does not make a history containing makeup attributable; the new chart inherits that existing gate.

Hardware functions and setup wording require review by a PrisMax-trained nurse educator against
the pinned AW8035 / 2.xx material and current local configuration. Generic fault alerts do not encode
manufacturer priorities or automatic pump responses. The access-position correction and resume
path are existing authored case actions, not universal troubleshooting or return/discard rules.

Nephrology/critical-care review remains needed for the patient-assessment, net-removal and liberation
teaching, and novice testing is still needed for usability. Reserve and stress are engine teaching
proxies, not observed blood pressure or bedside tolerance. Native kidney recovery, clinical
laboratory trajectories, citrate dosing, physical disconnection and blood return/discard procedures
are not supplied by these lessons.

The conceptual liberation reference is [KDIGO 2012 AKI, chapter 5.2](https://kdigo.org/wp-content/uploads/2019/01/KDIGO-2012-AKI-Guideline-English.pdf).
The [current KDIGO AKI page](https://kdigo.org/guidelines/acute-kidney-injury/) described the 2026
document as a public-review draft being prepared for publication when checked. No draft stopping
threshold or local protocol was adopted; no source was marked faculty-approved.

## Scoped teaching-contract assessment

| Rule | Result and evidence within Batch B                                                                                                                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1   | PASS: both existing lesson IDs use the existing module routes, canonical order and resolver.                                                                      |
| H2   | PASS: hardware and normal operation precede the fault; recorded worked examples precede changed applications.                                                     |
| H3   | PASS: existing shared LessonShell/NowCard and Batch A's owner-authorized focused composition; no global stage fork.                                               |
| H4   | PASS: one active task and progression action, real named landmarks; task map is secondary.                                                                        |
| H5   | PASS: active teaching/functions/actions/feedback render in the route; answers are absent before submission.                                                       |
| H6   | PASS: setup, action/event, numeric and reviewed-feedback gates; guided work is not independent mastery.                                                           |
| H7   | PASS: first responses retained, Learn feedback after submission; unsafe reasoning gets immediate corrective feedback. Existing Practice/Assess behavior retained. |
| H8   | PASS: existing reducers, circuit, device projection, ledger and sources; current versus static views remain explicit.                                             |
| H9   | PASS: existing progress adapter/schema/IDs, unchanged Batch A versions, stale-identity rejection and honest fresh-run boundary.                                   |
| H10  | PASS in implemented copy; clinical/device wording still awaits the named human reviewers.                                                                         |
| H11  | PASS: feature-local changes, draft/unlisted status retained; no data migration, merge or deployment.                                                              |
| H12  | PASS for executed Chromium/rendered journeys; device, clinical, novice and unexecuted browser/assistive-technology review remain separate.                        |

## Deferred

Batch C (citrate source completion and pressure-profile integration) was not started. Existing
anticoagulation and integration lessons remain available with their prior behavior. Operational
modalities beyond the three-control CVVHD interface, manufacturer alarm-response fidelity, new
clinical thresholds and any production promotion remain outside this implementation.
