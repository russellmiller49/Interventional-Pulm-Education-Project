# ECMO-01 — optional learning and gas-to-air entry

## Scope and reference

Implemented from the owner's September 14, 2026 self-paced action pack. Worktree: `codex-ecmo-01`; branch: `codex/ecmo-01`. Initial status was clean at `034648ad120005f00092ef1e56fa896cc3be0c19`, also the fetched `origin/main`. ECMO had no intervening change from the pack's historical baseline `9ef04539118b889a344992c63ba35808ee477f0e`. No reset of newer work was performed.

The existing ECMO hosts, curriculum order, four route identities, VV/VA distinctions, question IDs, device model, clinical cases, evidence registry and assets are the reference implementation. This is a flow/progress repair, not a lesson-framework or clinical-content migration. Device Intelligence, shared production infrastructure, other modules, dependencies and release status are unchanged.

The v2 brief supersedes older mandatory prediction, answer concealment, Challenge grading and completion contracts. No cut score, compulsory layout, new store, backend or clinical protocol was introduced.

## Reproduction and responsible predicates

The original transfer is authored in `content/drillSpecs.ts` and enters through `DrillStageHost.enterStep`:

1. Gas-source instruction transfers to `arterial-bubble-stop` (VV) or `va-arterial-bubble-stop` (VA), via `LOAD_SCENARIO`.
2. That load clears the previous prediction. The transfer is an action task with no new prediction form.
3. The original `EcmoCircuitControls` returned only “Record your prediction…” when `scenario.prediction.committed` was false. Its additional enable predicate was `controlsEnabled && prediction.committed`. The 3D control integration had the same educational dependency.
4. The authored setup includes a four-second `TICK`. Scenario load pauses the existing clock, so that setup tick did not advance the model.

A probe against an isolated archive of the original HEAD reproduces **both** blocked controls and the unadvanced setup clock (2 reproduced cases, both confirmed). This is a rendered control/engine reproduction, not a claim of a new full-browser baseline journey. The prior [flow validation](../../cardiohelp-ecmo/flow-validation.md) remains unchanged: **108 completed browser journeys and four recorded VV transfer blocks**. Its old artifacts remain in Local-Data.

## Behavior and preservation map

The PR separates the readiness/control event change in commit `45f1a69c` from the following learning/navigation commit (hosts, disclosure, visits and test migration). Review both together for the complete transfer fix.

### A. Device readiness and protective controls

- `engine/types.ts`, `engine/simulation.ts`, `engine/reducer.ts`: a narrow `START_ACTIVITY` event records activity entry, without a prediction, credit, time advance, intervention history or physiological change. Reference models also carry no invented prediction.
- `EcmoCircuitControls.tsx`, `EcmoCircuit3D.tsx`: live versus read-only availability controls the surface; a quiz answer does not control protective actions. Clamp state rules, pressure/bubble behavior, source correction, pump resumption and true device interlocks remain in the original reducer.
- `DrillStageHost.tsx`: entering a transfer loads its new situation; **Start guided activity** explicitly runs the existing setup. Its authored observation interval uses the existing `advanceSimulation`/`STEP` path. There is still one clock. The protective clamp can be used without an answer. A transfer's performed marker requires actual started state and the original action predicate.

No clamp sequence, emergency procedure, fault definition, duration, physiological equation, IFU/source claim or human review fact was authored or changed.

### B. Separately reviewable learning/navigation change

- `DrillStageHost`, `FoundationStageHost`, `StepList`, `EcmoOptionalExplanation`: open task outlines; explanation before an answer; retry and skip. Skipping does not mark an action performed. A reload starts a fresh model without inventing prior answers, snapshots or control actions.
- Foundation story comparisons can run without a response. **Run** still produces the genuine Before / After / Change result. Revealing prose or skipping produces no comparison.
- `DrillStepTeaching`, `DrillTeachingColumn`, `StageTeachingScope`, `drillPanelPrimitives`, `CircuitAndMonitors`, `circuitPresentation`: teaching, meaningful labels, localization and supported source claims remain accessible. Actual prediction state is retained only for displaying a response the learner really submitted. Sensor validity still controls interpretable measurements.
- `EcmoPracticeActivity`, `PracticeCasePlayer`, `practice/stages`, `practice/nowCard`, `EcmoCaseDebrief`: Practice, legacy Challenge and both Assess capstones use optional exploration. All stages are available; opening debrief without a response shows an explanation with **No prediction recorded / No action recorded**, not a completed intervention. Hints remain local view state. The next case follows the existing order without a score-based remedial detour.
- `CardiohelpModuleNav`, `CardiohelpHub`, `EcmoPathwayAccordion`, `EcmoContinueCta`, `content/pathwayResolver`: `/assess` retains its URL and VV/VA case IDs, with the learner label **Integrated cases**. Overview, Learn and Practice retain their URLs. Continue uses actual self-paced location and visits.
- `engine/progress`, `useStoredProgress`, `useEcmoSessionCore`: same storage key, minimal self-paced location/visits, no new graded results or detailed lifecycle/answer/help events. The ECMO route layout stops mounting the legacy graded account-sync leaf.

The only edits outside ECMO production files are two **targeted shared consumer tests**: the ECMO label in `criticalCareShellConvergence.test.tsx`, and the ECMO sync-mount expectation in `public-client-boundary.test.ts`. Other consumer expectations remain in place.

## Progress and compatibility

`cardiohelp-ecmo-progress-v1` remains the storage key. A nested `selfPaced` field contains only `visitedTopicIds`, `lastVisited`, and track-specific last lesson/case pointers. Fresh storage contains only that field. Existing root fields (including version-1 records, scores, attempts, mastery, completions and unknown fields) are preserved value-for-value. The current ECMO readers ignore those legacy values. Corrupt/non-object records are left in place; unavailable optional storage does not block learning.

Visits are not completed simulator actions or evidence of competence. Responses, actual action history and comparisons may support feedback within the current session, but do not become new graded attempts. Dormant scoring and migration helpers remain for historical compatibility and their tests remain; no current ECMO route uses them for access, next-step recommendations or achievement claims.

## Question decisions

See the [question ledger](ECMO-01-question-ledger.md). All retained items have a named mechanism, signal, comparison or clinical-sequence teaching purpose. Their existing explanations and alternative-choice rationales remain. They are optional reinforcement; no item is retained as a quota or access requirement. The transfer bug is resolved through explicit activity entry, not a compulsory new form.

## Test-contract migration

See [the migration record](ECMO-01-test-contracts.md) for original assertions and their replacements. Existing safety, physics, source, readout-validity, authored-variant, anatomical-coordinate, single-clock and historical progress-adapter tests are retained. No test is changed to `.skip`, no suite is disabled, and no empty discovery is counted as verification. Superseded exam/deep-link assertions are replaced by actual optional-flow tests. Original versions remain at the recorded base commit; intermediate failure logs are retained outside Git.

## Executed evidence

Evidence directory: `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/ecmo-01-self-paced-2026-09-14/`. Exact commands and exit codes are in `verification-results.json`; baseline and intermediate logs are also retained there. No token, environment file or raw clinical input is included in this PR.

| Executed check                                                                                             | Result                                                                            | Evidence                                                         |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Original baseline: `npx --no-install jest src/features/cardiohelp-ecmo --runInBand`                        | 69 suites / 2,099 tests passed                                                    | `baseline-jest.log`                                              |
| Original-head rendered control/engine reproduction (`ecmo-01-baseline-repro.test.tsx` in isolated archive) | 2/2 VV and VA blocked-transfer states reproduced                                  | `baseline-transfer-repro.log`, probe source                      |
| Final ECMO: `node node_modules/jest/bin/jest.js src/features/cardiohelp-ecmo --runInBand`                  | 70 suites / **2,169 tests passed**                                                | `verified-ecmo.log`, JSON                                        |
| Exact-path ECMO routes, public client/release boundary, historical adapters                                | 4 suites / **98 tests passed**                                                    | `verified-consumers.log`, JSON                                   |
| Shared shell and accessibility, selected by `--testNamePattern=ECMO`                                       | **5 selected tests passed**; 17 unrelated tests not selected                      | `verified-shell-accessibility.log`, JSON                         |
| `tsc --noEmit`                                                                                             | Passed                                                                            | `verified-typecheck.log`                                         |
| Scoped ESLint, `--max-warnings=0`                                                                          | Passed, no warnings                                                               | `verified-lint.log`                                              |
| Prettier and `git diff --check`                                                                            | Passed                                                                            | `prettier-final.log`, `verified-diff-check.log`                  |
| Chromium, VV/VA × desktop/phone × 3 journey families                                                       | **12/12 passed**, no page exceptions, no document overflow, no graded/help events | `browser-final-results.json`, `browser-final.mjs`, `final-*.png` |

Browser automation uses real route navigation, buttons, native keyboard events and controls. No hidden session setter or fabricated model state is used. It covers VV/VA at 1440×900 and 390×900: sequential no-answer gas-to-air transfer, explicit start and return clamp by keyboard, reload, legacy Assess explanation/retry/help, and foundation explanation/real comparison/retry/skip. Screenshots were opened and inspected. These are automated UI checks and agent visual review, not physician usability or clinical approval. Local generic site analytics are stubbed in the final browser script; attempted payloads are inspected for prohibited graded/help events. An earlier unconfigured preview emitted unrelated analytics endpoint errors, recorded separately from page exceptions.

Not run: full production build, deployment, whole-repository regression suite, every clinical case as a full browser management journey, remote account sync, and human clinical/usability review. All 14 clinical cases have rendered no-answer entry/debrief coverage; the browser matrix samples the named flows rather than claiming exhaustive clinical validation.

## Clinical/source hold and precise next slice

**No new clinical approval is claimed.** Preserve the existing draft/unlisted and source/model boundaries. ECMO faculty/perfusion educators must review any future change to emergency instructional order. This patch exposes the pre-existing sequence and fixes setup timing; it does not establish a reviewed clinical protocol. No emergency teaching sequence was invented to satisfy a test.

**Shared integration remains a separate slice.** `CriticalCareRestrictedAccountSync` still includes ECMO when mounted by the ICU route. Its legacy ECMO adapter/projector can read old scores and turn them into shared completion/mastery records. A fresh self-paced-only envelope is not recognized by that legacy adapter. The public critical-care catalog exposes ECMO identity but excludes its draft activities, so public progress recommendations do not consume new ECMO visits. Resolving cross-module/account behavior requires a serialized shared change: exclude self-paced ECMO from legacy graded projection/sync and define how existing normalized historical ECMO rows are preserved without becoming current claims. Test ICU and the other consumers, restricted/public catalog boundaries, account subset merging and legacy-data preservation together. This PR intentionally does not alter those shared production paths or another agent's module.

## Structured-module acceptance within this repair

| Rule | Result / scope                                                                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1   | PASS under v2: one existing curriculum and location resolver, open outline, compatible Integrated cases route.                                           |
| H2   | PASS for retained teaching: source-backed explanations and real modeled comparisons remain; reinforcement is optional. No new curriculum review claimed. |
| H3   | NOT APPLICABLE to migration: existing ECMO surface reused; v2 imposes no three-pane requirement.                                                         |
| H4   | PASS: existing Now card/current task preserved with explicit optional actions.                                                                           |
| H5   | PASS under v2: teaching and source claims can render before a response. Old answer-concealment rule superseded.                                          |
| H6   | PASS under v2: skips permit navigation; actions/comparisons require real state changes before claims. No competence completion is written.               |
| H7   | PASS under v2: wrong-answer feedback, reveal, hints and retry without penalty; old Challenge withholding rule superseded.                                |
| H8   | PASS for unchanged/model-regression scope: device/physics/interlocks/validity preserved. Clinical approval remains pending.                              |
| H9   | PASS within ECMO: minimal visits, honest restart and unchanged historical values. Shared account integration is the separate hold above.                 |
| H10  | PASS for changed copy: optional actions named plainly; clinical instructions and source terminology preserved.                                           |
| H11  | PASS: ECMO production scope; two scoped shared tests; no Device Intelligence/release/data/service changes.                                               |
| H12  | PASS for the executed matrix only: real UI, keyboard, narrow layouts, wrong/no answer, reload, skips and safety regressions. Unrun checks listed above.  |
