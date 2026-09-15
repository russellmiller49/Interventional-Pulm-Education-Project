# MCS-02 — Matched unloading examples

## Scope and starting state

Implemented the MCS-02 brief in the v2 self-paced action pack. The attached file
was named MV-02; the explicit request was MCS-02, and the matching MCS-02 brief
was available beside it. MV was not changed.

Started clean on `codex/mcs-02`, HEAD/origin/main
`42b46dcb224ac54d46aec4f74eaf9454d61b8227`. MCS-01 was already merged.
Compared with historical baseline `9ef04539118b889a344992c63ba35808ee477f0e`,
the current engine model, existing introductions and signal harness were
unchanged; MCS-01's newer self-paced host/progress conversion was retained.

The existing `impella-unloading-placement-unloading-example` now presents
provided comparisons of the reference and underfilled patient, using the real
MCS reducer and solver. The goal is to distinguish pump flow, LV volume, wedge
pressure and effective systemic flow at matched times. The audience and scope
remain the existing clinician-facing mechanism lesson, not procedural training.
No question or mandatory action is added. The v2 brief supersedes the older
skill's compulsory activity sequence, answer withholding and three-pane defaults.

## What changed

| Path (under `src/features/mechanical-circulatory-support/` unless stated)                     | Change                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content/unloadingExamples.ts`                                                                | Existing reference/preload-limited inputs, bounded P6/P8 choices, physiological table rows                                                                                          |
| `engine/unloadingComparison.ts`                                                               | Fork each P5 starting state into a P5 control and changed-setting branch; equal observation times; deterministic replay                                                             |
| `components/stage/McsUnloadingComparison.tsx` and `mcs-unloading.module.css`                  | Both conditions visible, real model outputs, P6/P8 buttons, replay/reset, immediate explanation, suction warning and assumptions                                                    |
| `components/stage/McsIntroTeaching.tsx`                                                       | Replace the earlier-time unloading table with the matched example in the same lesson task                                                                                           |
| `content/introductorySteps.ts`                                                                | Instructions describe optional comparison and independent volume/pressure responses; remove the unused P6 performed-action predicate                                                |
| `content/taskPresentation.ts`, `components/stage/McsTaskPresentation.tsx`, `McsStageHost.tsx` | Show this provided comparison as one focused surface; do not display unrelated live-patient readings or capture controls beside it; retain them in the following placement exercise |
| `__tests__/unloading-comparison.test.tsx`                                                     | Nine engine/host regressions                                                                                                                                                        |
| `e2e/mcs-unloading.spec.ts`                                                                   | Browser replay, keyboard settings, reset, no-answer continuation, reload/return and narrow layouts                                                                                  |
| `scripts/critical-care/dump-mcs-signals.ts`                                                   | Replay the exact lesson comparisons and IMP-01/IMP-03; correct the afterload comparison to P8 at matched times; distinguish electrical power from delivered flow                    |
| `docs/critical-care/mcs-model-limitations.md`                                                 | Link this current recheck without overwriting historical observations                                                                                                               |

No shared learning-module, catalog/progress, routing infrastructure, other module,
Device Intelligence, physics coefficients, case definitions, source registries,
assets, dependencies, release status or account data were changed.

## Reproduction and observations

```sh
npx tsx scripts/critical-care/dump-mcs-signals.ts
```

The harness prints full patient/device settings, seed, actual times, LVEDV,
wedge pressure, concurrent native/left/right/effective/return flows and alarms.
Every emitted comparison state receives the existing finiteness and topology
checks. All values below are **authored-model outputs**, not clinical targets.
Flows are L/min. Seed 417; CP, aligned, running; right pump disabled.

Each lesson condition starts at P5 after the existing eight-second setup, at
8.04 s. Each branch receives an identical setting-update step plus eight seconds,
ending at **16.06 s**. The reducer's existing 0.02 s refresh is included in these
reported times, not rounded away or repaired as part of this task. The comparison
uses continued P5 at the same final time, not the earlier starting state.

| Condition / setting      | Native | Left pump | Effective | LVEDV (mL) | Wedge (mm Hg) |
| ------------------------ | -----: | --------: | --------: | ---------: | ------------: |
| Filled / P5 control      |   3.32 |      2.44 |      5.76 |        118 |            18 |
| Filled / P6              |   3.19 |      2.84 |      6.04 |        114 |            18 |
| Filled / P8              |   3.00 |      3.49 |      6.49 |        107 |            17 |
| Underfilled / P5 control |   2.24 |      1.32 |      3.55 |         95 |            11 |
| Underfilled / P6         |   2.19 |      1.54 |      3.73 |         92 |            11 |
| Underfilled / P8         |   2.11 |      1.97 |      4.08 |         89 |            10 |

Only preload input differs between these conditions: **105% versus 58%**, reused
from the reference patient and original signal dump. Both retain HR 96/min,
SVR 1150 dyn·s/cm⁵, LV/RV contractility 0.46/0.85, PVR 2.5 WU, PEEP 5 cm H₂O,
normal purge, no aortic insufficiency or tamponade. Regurgitant return and right
pump flow are zero. Display rounding explains a possible 0.01 L/min difference
between displayed component sums and effective flow.

At P6, both conditions have a smaller modeled LV and unchanged rounded wedge
pressure. At P8 both display a pressure fall. Neither result was suppressed.
Underfilled states retain suction at every displayed setting; higher numerical
flow is explicitly not labeled safe support, successful treatment or improved
organ perfusion. No action/answer/capture is credited for viewing or replaying.

### Existing case checks

IMP-01 and IMP-03 retain all original patient/fault conditions; only the initial
support level is normalized to P5 for the comparison. Both branches finish at
16.04 s. These are distinct case conditions, not an isolated-preload comparison.
Original practice cases and their default P8/P6 settings are unchanged.

| Case / setting      | Native | Left pump | Effective | LVEDV (mL) | Wedge (mm Hg) |
| ------------------- | -----: | --------: | --------: | ---------: | ------------: |
| IMP-01 / P5 control |   1.86 |      0.28 |      2.14 |        108 |            13 |
| IMP-01 / P6         |   1.86 |      0.33 |      2.18 |        108 |            13 |
| IMP-01 / P8         |   1.84 |      0.42 |      2.26 |        107 |            13 |
| IMP-03 / P5 control |   2.79 |      2.01 |      4.80 |        125 |            19 |
| IMP-03 / P6         |   2.72 |      2.29 |      5.01 |        122 |            19 |
| IMP-03 / P8         |   2.59 |      2.84 |      5.43 |        117 |            18 |

IMP-01 includes preload 64%, RV contractility 0.42 and PVR 5.5 WU; suction and
low-flow/hemolysis-risk alarms persist. IMP-03 retains SVR 1900 and high-pressure
purge warning. This engine raises a purge alarm without imposing a flow penalty;
its warning is not silently used as an explanation for reduced modeled flow.

### Current limitation and source recheck

- **PAPi:** current `deriveMcsMetrics` still makes pulmonary pulse pressure a
  function of RV contractility. The harness reproduces PAPi 0.50 → 0.60 with RP
  at P8, RAP 20 → 17 mm Hg and RP flow 3.33 L/min. The live RV panel already
  explains the denominator-only response; no new PAPi-response task is added.
- **CPO:** the old Impella harness comparison changed both P5→P8 and afterload.
  The corrected comparison uses P8 on both sides and matched 6.04 s times:
  effective flow falls **1.16 L/min**, while CPO rises **0.19 W** and MAP rises
  105→145 mm Hg. This is the existing pressure–flow product, not proof of better
  tissue perfusion. LVAD's recorded afterload observation remains separately
  reported; no clinical CPO target is introduced.
- **High power:** the original durable-pump check still raises electrical power
  2.80 W with no displayed effective-flow change. The live alarm panel already
  says progressive obstruction and hemolysis are not modeled. The harness's
  ambiguous wording about display and delivery separating was corrected to the
  actual electrical-power/unchanged-flow observation.
- **IABP:** current timing introductions, event bands and model still delimit
  schematic contours and do not represent every clinical deflation phenotype.
  Timing/trigger and waveform regressions remain in the module suite.
- **Source records:** re-read `clarification.mcs.impella-cp-flow-measurands` and
  `conflict.mcs.impella-cp-textbook-flow` in the shared registries, and their
  distinct live renderers. Both remain `sme-review`. The revision-specific
  maximum-mean, peak-systolic and observed-average figures are not substituted
  for one another; the two textbook claims remain unresolved.
- The current [J&J CP product page](https://www.jnjmedtech.com/en-US/products/cardiovascular/impella-heart-pumps/impella-cp-with-smartassist/)
  was retrieved on September 15, 2026 and still describes 4.3 L/min as peak
  systolic flow at P9. Its linked IFU PDF fetch returned HTTP 502, so this task
  does **not** claim to have revalidated the current local device revision or
  resolved the model's manufacturer-measurand discrepancy. The existing
  [ISHLT/HFSA guideline record](https://www.ishlt.org/education-and-publications/standards-guidelines-detail/the-ishlt-hfsa-guideline-on-acute-mechanical-circulatory-support)
  also resolved, identifying the February 2023 guideline. No new clinical
  recommendation is inferred from those landing pages.

**Clinical hold:** MCS faculty/device expertise must review interpretation and
any future model-intent change. Code/tests are not clinical approval. No
unloading coefficient, pressure floor, PAPi response, thrombosis-flow penalty,
manufacturer estimator, IABP phenotype or missing patient endpoint was invented.

## Question and test-contract ledger

| Scoped item / old contract                                                    | Disposition and new contract                                                                                                                   |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Guided unloading example's P5→P6 action predicate and earlier-time comparison | **Replace** with worked, matched-time P5/P6 and P5/P8 comparisons; no question/action required. Useful flow/volume/pressure teaching retained. |
| Unloading optional recognition/prediction/observation/transfer items          | **Keep** MCS-01's optional reinforcement behavior. No new item, grading write or answer gate.                                                  |
| IMP-01 / IMP-03 questions                                                     | **Keep** the MCS-01 optional case interactions; case definitions untouched. Used as numerical cross-checks, not new examinations.              |
| IABP/PAPi/CPO/high-power teaching                                             | **Keep** existing bounded explanations; recheck engine/records rather than treating the old limitation list as proof.                          |
| Old harness Impella high-afterload comparison against P5                      | **Rewrite** to matched-time P8 control, preserving both adverse flow and rising CPO.                                                           |
| Existing safety/flow/physics/source tests                                     | **Keep**, run with the full MCS suite.                                                                                                         |

No existing test was deleted or loosened. The initial new test wrongly expected
Learn examples to record the case-only escalation error. It failed (7/8 passed),
then was replaced with an actual IMP-01 case warning test while retaining the
Learn suction-alarm assertions. An intermediate TypeScript run caught two
Testing Library options copied from Playwright; those options were removed.
The first browser run was 6/7: the native select did not change with the attempted
keyboard sequence. Two visible P6/P8 buttons now support Enter directly. Visual
review then found numeric wrapping at 320 px; nowrap numeric cells and a rendered
single-line-number assertion repair and guard that problem.

## Progress, review and preserved capabilities

The existing MCS location/visited-topic store is unchanged. Comparisons are
provided examples held only in component memory. Replay/settings/reset do not
write progress, graded attempts, answers, captures, help histories or analytics.
Legacy records remain unchanged. Reload follows MCS-01's topic/phase boundary:
it reopens the introductory reference and does not claim to restore P8 or a
captured model action. Returning to this example offers P6 again.

The next placement task starts with its original aligned live model and keeps
its controls, safety behavior, full exploration, captures, anatomy and source
notes. Those live capabilities are not presented as controlling the separate
provided comparison. Case routes, engines and release/access status are retained.

## Validation evidence

Executed September 15, 2026 in this worktree:

| Check                                                                                                                                                 | Result                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Baseline `npx jest --runInBand src/features/mechanical-circulatory-support --silent`                                                                  | 33 suites / 708 tests passed                                          |
| Baseline signal dump                                                                                                                                  | 17 states; 0 flags; 4 limitation observations retained                |
| Final `npx jest --runInBand src/features/mechanical-circulatory-support 'src/app/\[locale\]/mechanical-circulatory-support/routes.test.tsx' --silent` | **35 suites / 745 tests passed**                                      |
| Final `npx tsx scripts/critical-care/dump-mcs-signals.ts`                                                                                             | 17 existing states plus 24 baseline/control/changed rows; **0 flags** |
| `npm run type-check`                                                                                                                                  | Exit 0                                                                |
| Scoped ESLint command below                                                                                                                           | Exit 0, no findings                                                   |
| `npx prettier --check` on the 12 changed TS/TSX/CSS files                                                                                             | Passed                                                                |
| `git diff --check`                                                                                                                                    | Passed                                                                |
| `npx playwright test --config=node_modules/.cache/mcs02/playwright.config.cjs`                                                                        | **8 passed**                                                          |

```sh
npx eslint \
  src/features/mechanical-circulatory-support/content/unloadingExamples.ts \
  src/features/mechanical-circulatory-support/engine/unloadingComparison.ts \
  src/features/mechanical-circulatory-support/components/stage/McsUnloadingComparison.tsx \
  src/features/mechanical-circulatory-support/content/introductorySteps.ts \
  src/features/mechanical-circulatory-support/content/taskPresentation.ts \
  src/features/mechanical-circulatory-support/components/stage/McsTaskPresentation.tsx \
  src/features/mechanical-circulatory-support/components/stage/McsIntroTeaching.tsx \
  src/features/mechanical-circulatory-support/components/stage/McsStageHost.tsx \
  src/features/mechanical-circulatory-support/__tests__/unloading-comparison.test.tsx \
  scripts/critical-care/dump-mcs-signals.ts \
  e2e/mcs-unloading.spec.ts
```

The temporary Playwright config points at the tracked `e2e/mcs-unloading.spec.ts`,
uses Chromium with one worker, localhost **3142**, and `/tmp/mcs02-browser` for
outputs. The isolated server was started with
`NEXT_PUBLIC_SHOW_DRAFT_MODULES=true npx next dev --webpack --hostname 127.0.0.1 --port 3142`.
It compiled and served the real module. No stored secrets or shared server were
used. Initial browser exploration logged the existing analytics API's missing
account-environment error; the automated tests fulfill only `/api/analytics`
locally with 204. Model, routes and local progress are real; remote analytics and
account sync are **not** verified. The final browser flow reports no page errors.

Inspected the existing aligned-pump reference and final comparison at 1440 px,
P6/P8 results, 1280 px output, and compact/320 px cards. Browser actions also cover
1024×768, 900×800, 720×450, 390×844 and 320×844; every width checks page overflow,
keyboard replay and that each physiological number stays on one line. 720×450
checks the CSS-space equivalent of 200% zoom on 1440×900; **native browser zoom
itself was not tested**. Final full-page captures include the unchanged sticky
site navigation; viewport/table captures confirm readable rows as the page scrolls.

Local evidence (untracked): `/tmp/mcs02-signals.log`, `/tmp/mcs02-jest.log`,
`/tmp/mcs02-typecheck.log`, `/tmp/mcs02-browser.log`, `/tmp/mcs02-browser/`,
`/tmp/mcs02-entry.png`, `/tmp/mcs02-underfilled-table-320.png`,
`/tmp/mcs02-comparison-viewport.png`. Outputs can be regenerated with the harness
and tracked browser test; raw authoring inputs were not copied into the checkout.

Not run: full production build (includes unrelated embedded training apps),
repository-wide lint/tests, cross-module suites, native browser zoom, remote
account/analytics integration, faculty review or learner pilot. No shared code
changed, so no shared consumer integration slice is required.

### Structured-module checks, limited to this slice

| Rule | Status and evidence                                                                                                              |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- |
| H1   | PASS — existing section/task IDs, map, Continue and routes retained; host and route tests pass                                   |
| H2   | PASS — model explanation and both worked comparisons are visible before any optional question                                    |
| H3   | N/A for a new stage/layout migration — existing MCS NowCard/presentation reused; v2 explicitly supersedes compulsory three panes |
| H4   | PASS — one current task; P6/P8/replay/reset controls in the comparison; Continue stays available                                 |
| H5   | PASS — real tables and explanation rendered in the real route and inspected                                                      |
| H6   | PASS under v2 — no run/completion manufactured by navigation; supplied examples labeled and excluded from learner captures       |
| H7   | PASS under v2 — no new question; explanation available immediately; suction warning remains visible                              |
| H8   | PASS — engine equations/assets unchanged; conservation, topology and existing interlocks tested                                  |
| H9   | PASS — legacy progress unchanged; controls do not write progress; reload/return use the documented topic boundary                |
| H10  | PASS within scope — clinical quantities distinguished, modeled numbers labeled, unsupported patient endpoints named              |
| H11  | PASS — MCS feature, MCS script, MCS browser test and MCS docs only; no release/source-hold change                                |
| H12  | PASS for the bounded technical journey — 745 Jest tests and 8 browser tests; clinical review/pilot remain pending                |

## Next slice

No shared integration slice is required. Follow-up is attributable MCS
faculty/device review of these example interpretations and the already open
source/measurand holds. Any request to change clinical-model intent needs its
own bounded, source-backed task. No deployment or merge is included.
