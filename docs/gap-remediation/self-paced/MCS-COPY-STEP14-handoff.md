# MCS-COPY-STEP14 — approved stem and nine learner-copy passages

Status: bounded copy repair prepared for an independent review. No merge, deployment, Prompt 06,
release decision or clinical/model approval. The owner approved only the CAP-LVAD-01 wording below.
Other decisions and held source/device/media claims remain NOT REVIEWED. All 13 hub modules remain
`preview`.

## Identity and authorization

- Repository: `russellmiller49/Interventional-Pulm-Education-Project`.
- Fetched starting main, reconfirmed before commit: `b85da4a00fc1959ff9d5818d8a2b89d98d275723`.
- Application and test head: `162ed7a85282900c917dc969b14093b4a22f3920`. This handoff is a later documentation-only commit;
  the final pushed PR head is recorded in the PR description and the external delivery receipt.
- Branch: `codex/mcs-copy-step14`.
- Isolated checkout: `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/codex-mcs-copy-step14`.
  Created from current origin/main without switching either permanent agent checkout. The managed
  worktree tool was unavailable to this execution environment; ordinary Git worktree creation was
  used under the owner's explicit isolated-worktree instruction.
- #332 merged at `a3fce9f89f880908687715829b48e324328f6e12` and is included. Its packet merge
  filed decisions without approving them.
- Owner authorization supplied in the delegated task: “I Approve the recommended wording for the
  bounded MCS copy repair.” Option B selected. The other nine passages are authorized by this task
  and the current [finish-line board](../beta-finish-line.md#MCS-copy-owner-decision-on-the-cap-lvad-01-stem).
- Open PR ownership rechecked before publishing: no other open MCS runtime PR. Shared feedback remains
  a separate pending scope. No other agent branch was used, changed or merged.

## Exact approved stem

`content/scenarios.ts:861` now renders under “Patient problem”:

> A continuous-flow LVAD patient develops low flow with rising and converging filling pressures
> after a bedside procedure; pump speed is unchanged and the power path remains connected.

This replaces “speed and power are unchanged.” It distinguishes the connected external power path
from derived pump watts. Speed/power connection, model inputs, displayed outputs, correct prediction,
options, criteria, flags and interlocks are unchanged. The existing explanation still says derived
power is lower than in the reference run. The owner selected wording; no clinical/model approval was
inferred from that selection and no other packet/queue field was changed.

## All nine guard passages — disposition

Paths below are under `src/features/mechanical-circulatory-support/`. These are exactly the nine
MCS findings in the unchanged guard on the baseline (eight component files; the Learn paragraph has
two occurrences in one passage). No additional learner-copy passage was added to scope.

| #   | Source on main                                        | Before → after                                                                                                                                                                  | Preserved meaning                                                                                                                                      |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `components/McsHub.tsx:120–122`                       | “integration with patient assessment” → “integration with patient evaluation”                                                                                                   | Clinical integration; section order remains a recommendation, not a lock.                                                                              |
| 2   | `components/McsLearnLanding.tsx:23–27`                | “assessment of the supported patient. Temporary support and assessment of an existing” → “evaluation of the supported patient. Temporary support and evaluation of an existing” | Same two clinical contexts and explicit non-treatment-ladder boundary.                                                                                 |
| 3   | `components/stage/McsCapturedResults.tsx:144`         | “Seed” → “Example number”                                                                                                                                                       | Same record.seed, captured/observation times, configuration and patient reference.                                                                     |
| 4   | `components/stage/McsIntroTeaching.tsx:56`            | “Clinical perfusion assessment” → “Clinical perfusion evaluation”                                                                                                               | Same organ findings and their unsimulated status.                                                                                                      |
| 5   | `components/stage/McsIntroTeaching.tsx:129`           | “Separate patient assessment” → “Separate patient evaluation”                                                                                                                   | Same independent pressure, filling, imaging and perfusion information; volume remains a modeled surrogate.                                             |
| 6   | `components/stage/McsStageHost.tsx:1779`              | “Seed” → “Example number”                                                                                                                                                       | Same state.seed, run reproducibility and “not a clinical value” qualification. Only this copy paragraph changed; feedback-frame logic/props untouched. |
| 7   | `components/stage/McsTaskReadings.tsx:77–78`          | “bedside assessment” → “bedside evaluation”                                                                                                                                     | Same clinical observations; they remain unsimulated.                                                                                                   |
| 8   | `components/stage/McsTeachingColumn.tsx:125–127`      | “clinical assessment” → “clinical evaluation”                                                                                                                                   | Same oxygen-content/consumption qualification and unsimulated organ responses.                                                                         |
| 9   | `components/stage/McsUnloadingComparison.tsx:171–175` | “Seed” → “Example number”                                                                                                                                                       | Same baseline.seed, P5 setting, starting time, matched eight-second branches and nonclinical stabilization boundary.                                   |

The six clinical evaluation edits are equivalent wording, not a new interpretation or operational
recommendation. The three example-number edits retain the numeric reproducibility identifier, not
a new run/record scheme. Internal seed fields and all IDs remain unchanged. Other authored uses of
“assessment,” including the existing Patient assessment controller-tour button, were outside these
nine guard passages and remain unchanged. English copy only; no locale keys or translation pipeline
changed. Spanish/Chinese browser verification was not run.

## Regression and preservation evidence

- Before runtime edits, the unchanged global copy guard failed with exactly **11** findings: nine
  MCS plus two Ventilation. Logs retain the full path/line/copy inventory.
- Added a rendered CAP regression to `mcs-pre-review-04-sanity.test.tsx`. It failed on main’s old
  stem, then passed on the repair. It renders the case beside the real monitor, checks the exact
  owner-selected stem, identical device configuration to the reference, connected power, lower
  modeled watts, actual POWER / PI text and the existing constrained-filling option.
- Three existing Jest files and `e2e/mcs-unloading.spec.ts` read the new “Example number” label;
  their numeric identifier, retained-result, session/presentation and keyboard assertions remain.
- Added `e2e/mcs-copy-step14.spec.ts`: actual hub, Learn, capstone, clinical boundaries, run details,
  retained configurations and provided examples at 1280×800, 1707×900 and 390×844. All nine changed
  passages and the stem are rendered; no horizontal document overflow was observed at those widths.
- Diff inspection confirms no changes in the MCS engine, shared hemodynamics core, case reasoning,
  shared ChoiceReasoningFeedback, or beta rollout. Every change in application code is one of the
  ten copy passages above, plus formatting. No stylesheet changed. All 13 rollout entries are preview.

## Executed validation

Run from this checkout with existing installed dependencies linked for local use; no .env.local or
raw inputs copied. Evidence root (outside Git):

`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/mcs-copy-step14-2026-10-07/`

| Command/check                                                                                                           | Result and evidence                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node node_modules/jest/bin/jest.js --runInBand src/features/critical-care/__tests__/learner-copy.test.ts` before edits | FAIL as expected: 11 findings, 1 failed / 5 passed tests. `baseline-copy-guard.log`.                                                                                                                          |
| Same runner, `mcs-pre-review-04-sanity.test.tsx -t 'renders CAP-LVAD-01'` before copy edit                              | FAIL as expected on the exact old stem; `baseline-stem-regression.log`.                                                                                                                                       |
| Full MCS plus copy guard, first repair run                                                                              | 46 suites passed; 3 label-sensitive MCS suites needed the equivalent-label update; global guard retained only the 2 Ventilation findings. `mcs-and-copy-guard.log`. No assertion was removed/weakened.        |
| `node node_modules/jest/bin/jest.js --runInBand src/features/mechanical-circulatory-support`                            | PASS: **49 suites, 1,031 tests**. `mcs-final.log`.                                                                                                                                                            |
| Final unchanged global copy guard                                                                                       | FAIL only on the **2 existing Ventilation** lines in VentilationPeepComparison at 122/160; **zero MCS findings**. 1 failed / 5 passed tests. `final-copy-guard.log`. Global guard was not edited or exempted. |
| `npm run build`                                                                                                         | PASS, full training-app builds, content generation, asset validators, production Next build/typechecking and standalone preparation. `production-build.log`.                                                  |
| `npm run type-check`                                                                                                    | First attempt exhausted Node’s default ~4 GB heap (exit 134). `typecheck.log`.                                                                                                                                |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`                                                             | PASS (exit 0). `typecheck-8gb.log`. No type error suppressed.                                                                                                                                                 |
| Changed-path ESLint and Prettier, including new e2e                                                                     | PASS. `scoped-lint-final.log`, `scoped-format-final.log`; `git diff --check` PASS.                                                                                                                            |
| `node node_modules/jest/bin/jest.js --runInBand src/features/module-beta/rollout.test.ts`                               | PASS: 2 tests; rollout diff empty and all 13 preview entries verified. `preview-preservation.log`.                                                                                                            |
| Production browser changed scope                                                                                        | PASS: **9/9 Chromium** checks, against this task’s standalone production server on loopback 3164. `/tmp/mcs-copy-step14-playwright.config.cjs`; `browser-changed-scope.log` and `browser/` screenshots.       |
| Existing unloading production browser suite after label update                                                          | **5 passed, 3 failed** at 1280×720, 720×450 and 320×844. `/tmp/mcs-copy-step14-unloading-playwright.config.cjs`; `browser-unloading.log` and failure traces. Details below.                                   |

### Remaining browser-suite failures, kept visible

All three failures are the unchanged assertion at `e2e/mcs-unloading.spec.ts:133`, which requires
one Range rectangle for **every td**, described as a physiological number. A targeted DOM diagnostic
at each failed viewport found only four wrapping cells, all containing the prose **“No resolvable
displayed change”**; no numeric cell wrapped in that diagnostic. This prose, its `deltaText` function,
the numerical table markup and all applicable styles are identical to main. The changed identifier
is inside a closed disclosure below the table when these assertions run. This is source-supported
existing prose/assertion debt, not evidence that a newly changed numerical output wrapped.

An exact main production-browser baseline was **NOT RUN** for these optional follow-up checks;
they are therefore not reported as a passing suite or a matched baseline re-test. No numerical
assertion, prose, stylesheet or layout was altered to make them green. Saved
`unloading-wrap-diagnostic.json`, `browser-diagnostic.cjs`, `unloading-diagnostic-*.png` provide
current DOM evidence. The independent reviewer can adjudicate this separately.

### Visual/environment limits

Inspected the phone CAP stem crop, the wide-window captured identities and desktop clinical-boundary
screenshots, plus a failed unloading screenshot. The chosen stem fits and the relevant disclaimers
remain visible. Screenshots/logs stay outside Git. Browser checks use anonymous public direct routes
on a production build without Supabase configuration; unrelated account-client requests log missing
configuration. No account persistence, live beta wrapper, production site, auth/backend, release
acceptance or clinical validation is claimed. No fake credentials were supplied. Only this task’s
server is stopped at task end; no other server/worktree is changed.

## NOT RUN / explicitly outside this task

- Prompt 06 combined acceptance, owner release walkthrough, real learners, clinical/device/model
  validation, new source/media review, deployment and merge.
- Shared ChoiceReasoningFeedback and McsStageHost feedback-frame repair.
- The two Ventilation guard lines, unloading prose/rectangle assertion repair, and unrelated modules.
- Full repository Jest/E2E suites; authenticated beta wrapper/account save; Safari, Firefox, native
  zoom, 200% text, screen reader, real phone/touch; Spanish/Chinese journeys.

## Review next

Review the final draft PR at its exact pushed head. Confirm the stem is the owner’s approved option
B, the nine-row ledger matches the actual diff, models/keys/holds and all preview states remain
unchanged, and the documented remaining global/browser-suite failures are acceptable for this copy
scope. Keep PR open and unmerged; no acceptance starts from this handoff.
