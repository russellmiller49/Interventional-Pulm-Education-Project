# CRRT-FELLOW-02 — independent pre-merge sanity review

**Verdict: SANITY REVIEW: READY TO MERGE** for the bounded Batch-02 contracts below. No merge,
deployment, publication change, clinical signoff or Batch-03 work was performed.

## State and review boundary

- Original reviewed PR #263 head: `4ce47d3eadf21d93bd3886898c628056efaabbdd` (matched handoff).
- Original Batch-02 base / initial merge base: `c1fb8a0d4d0704ea7fc3050d34512104edba79b7`.
- Initial fetched main: `81145a6d1a7166f1d7000485a8853cd9ddbf89b6`; PR was 3 behind / 1 ahead,
  `MERGEABLE`, `CLEAN`.
- Main advanced during review. Final integrated main: `9fbdbddc4d7f124c7ac3254f4cb8aa4c15c0233f`.
  Both main integrations are ordinary merge commits, without rebasing or force-pushing.
- **No CRRT paths overlap intervening main work.** The first integration contains hemodynamics;
  the second contains EBUS. The PR's changed paths and intervening-main paths have an empty intersection.
  `.claude/launch.json` is byte-identical to final integrated main, including its hemodynamics and EBUS
  entries. This review adds no CRRT launch entry.
- Review branch: `codex/crrt-263-sanity`, isolated at
  `/Users/russellmiller/.codex/worktrees/codex-crrt-263-sanity`.
  Baseline: separate detached checkout at `/Users/russellmiller/.codex/worktrees/codex-crrt-263-base`.
  The original Claude checkout was read only; updating the existing PR is explicitly authorized by
  this task. No other agent's checkout, server, stored progress or environment file was changed.
- Runtime content remains `1.1.0-sme-review.1`, draft/unlisted/noindex. Browser: isolated Playwright
  Chromium; production standalone server on `127.0.0.1:3143`, synthetic preview environment only.
- Validated code repair commit: `a64ec7c035a3e80ed1800f66e82940222103b719`. The final PR head is recorded in the final task handoff. This report is delivered
  as a separate documentation commit after the validated code repair, so it does not attempt to embed
  its own self-referential commit hash.

Read: root AGENTS/CLAUDE instructions (no applicable nested CRRT instructions), both fellow handoffs,
prior CRRT-02 handoff/faculty context, the CRRT package common contract, feedback ledger, source/code
notes, cross-module coordination and Batch-02 prompt. The medical-education, project and structured-module
skills informed the bounded review. No new clinical claim or external clinical source was adjudicated.

## Findings and repairs

| Finding                                                                                               | Classification                                                 | Reproduction / evidence                                                                                                                                                                               | Smallest repair applied                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prescription review was only described as stale; readiness still accepted it                          | Incomplete Batch-02 repair of a pre-existing workflow defect   | Complete the machine with 150/1900/100, review/connect, then apply CRRT-04's 120/1800 case values. The machine kept all steps complete and both initial-start paths accepted the changed prescription | Preserve completed step history and committed values; independently mark review stale on a real prescription change. Both initial-start paths share the same readiness gate. Re-review displays current values, records those values, clears only stale review, and never appends duplicate setup IDs |
| New prescription selector could call unreviewed values reviewed, and miss replacement-flow divergence | New Batch-02 reporting defects                                 | A committed prescription without a Review step was `machine-reviewed-matches`; CRRT-05 changes pre/post flows outside the three compared fields                                                       | Review status now checks the actual Review record/staleness separately; divergence covers every prescription flow. Returning to the original value does not silently perform a review                                                                                                                 |
| Calculated no-flow readings remained ordinary values in downstream consumers                          | Incomplete Batch-02 F-14 containment                           | The Lesson-8 recorded-profile table and circuit display could still show Qb 120, TMP 7 and drop −25 while stopped; historical TMP points lacked validity context                                      | Propagate set/actual flow and calculated-pressure qualification to the circuit and recorded-profile table. Historical series explicitly state that flow validity was not recorded at each sample; do not infer historical validity from the final state                                               |
| Prescription record text had insufficient contrast                                                    | New Batch-02 presentation defect                               | Pale text on the translucent pale machine panel was difficult to read in production screenshots                                                                                                       | Use an opaque dark record surface, dark secondary text on the light settings surface, and the existing primary-action style for re-review                                                                                                                                                             |
| Enlarged-text keyboard focus could be covered by the reasoning ribbon                                 | Pre-existing layout behavior affecting the new Batch-02 action | During repair validation at 1280×900 and 200% root text, reverse/forward keyboard traversal put the new re-review button behind the existing sticky ribbon                                            | Keep the ribbon in normal document flow; assert button bounds and center-point hit visibility after traversal. This is a bounded focus-visibility repair, not Batch-03 workbench restructuring                                                                                                        |

Prescription verification is distinct from the historical machine entry. Re-reviewing 120 mL/min
never changes the recorded 150 mL/min entry. Repeated edits invalidate only review, not prime,
connection or earlier operations. An already-started run can resume its existing operational workflow
without replaying initial setup; its review remains visibly not current until explicitly reviewed.
This preserves CRRT-13's authored corrective/recovery paths and the cases authored to begin running.
An ended treatment remains ended. No clinical prescription acceptability criteria were added.

The setup status display marks stale Review as current work rather than completed verification.
The start predicate checks actual step membership, not merely an array length. Regression coverage
includes missing prescription, unfinished prime, missing review/sets/connection, ended state,
returning to the original value, refused repeat review and preserved prior critical errors.

## Positive baseline reproductions

Independent probes used the unchanged original base's existing APIs:
`getBaxterCrrtCase` → `createCrrtLearningSession` → `crrtLearningSessionReducer` and its original
PrisMax display adapter. They did not import a newly added selector or test for absent functions.
The same probe was also run against the original PR head before repair.

| Case               | Baseline behavior actually observed                                                                                                                               | Final disposition                                                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CRRT-04            | Six case cards at t=0 recorded prime/review and started delivery with `primeState: not-started`, no completed machine steps and no machine-committed prescription | Card declaration refused until machine steps are recorded; first start cannot bypass readiness. Goal declaration, page view and reading are not machine completion |
| CRRT-04 divergence | After actual machine entry 150/1900/100, a case card changed engine Qb to 120 while committed Qb remained 150                                                     | Both values and review status visible; original entry preserved                                                                                                    |
| F-14               | At six hours on untouched CRRT-04, actual flow was zero; original adapter marked TMP 7 and drop −25 `live-model-value`                                            | Calculated channels qualified as non-interpretable without flow; numbers/formulas unchanged. Four modeled pressure sites retain their own availability             |
| CRRT-11            | Safe action plus two learner hours reached three hours; no-action/harmful plus two learner hours reached two                                                      | Authored hour retained, exposed, attributed once                                                                                                                   |
| CRRT-13            | Pause → reposition → resume at 1800 s added zero downtime; adding 600 s while paused added 600 s downtime                                                         | Retained and honestly reported                                                                                                                                     |
| CRRT-05            | At one and six hours, only pre/post split changed; delivered quantities, pressures, filter state and solute pools were exactly equal                              | MODEL NOT IMPLEMENTED: no dilution/filter-concentration response; conceptual clinical distinction remains                                                          |
| CRRT-15/16         | At six hours filter state and pressures were exactly equal; both dose 20.625 mL/kg/h, downtime zero                                                               | CONTAINED: repeated losses are supplied history; plans do not cause filter exchange or circuit repair                                                              |
| CRRT-17            | One systemic ionized calcium 1.05 mmol/L; total calcium null; no post-filter/circuit sample schema; linked citrate directions stay unknown                        | CONTAINED / MODEL NOT IMPLEMENTED: no invented serial evidence or measured citrate state                                                                           |
| CRRT-18            | One creatinine marker 2.9 mg/dL, constant urine 5 mL/h, residual clearance 0                                                                                      | CONTAINED / MODEL NOT IMPLEMENTED: no recovery trajectory; machine stop/end separate from clinical liberation decision                                             |

CRRT-15/16's numerical filter/delivery equality does not mean every metadata object is identical:
source identifiers remain case-specific. The generic removal-only solute arithmetic is still present
but contained; it is not a clinically valid recovery or citrate trajectory. No solution chemistry,
MAP/pressor response, citrate kinetics, filter failure, renal recovery, FF math or pressure correction
was added.

## Matched-time causal results

CRRT-11, identical starting fixture and seed, all measured at **7200 simulated seconds**:

| Path                                                                      | Stress index | Reserve remaining (mL) | Whole-patient balance (mL) | MAP (mmHg) |
| ------------------------------------------------------------------------- | -----------: | ---------------------: | -------------------------: | ---------: |
| No intervention                                                           |        0.760 |                      0 |                       −320 |         59 |
| Assessment only                                                           |        0.760 |                      0 |                       −320 |         59 |
| Reduce removal, including authored hour, then one learner hour            |        0.480 |                    100 |                        −20 |         59 |
| Pause removal alternative, including authored hour, then one learner hour |        0.480 |                    100 |                        +40 |         59 |
| Increase removal, then two learner hours                                  |        0.872 |                      0 |                       −600 |         59 |

These are reducer outputs, not test substitutes for running the engine. The reserve is spent/not
spent, never recovered. Stress is an abstract bounded index, not a validated bedside measurement.
MAP is supplied/held, not a treatment response or evidence of safety. At three matched hours the
no-action/reduced/harmful stress indices are 0.800/0.360/0.968. Segmented advances remain consistent.

CRRT-13 at the 30-minute pattern: no action, diagnosis, acknowledgement and harmful Qb increase
leave the modeled obstruction; correction clears it. Access pressures: −139 untreated/diagnostic/
acknowledgement, −211 harmful, −25 corrected. All those same-time arms have dose approximately
22.14 mL/kg/h and zero downtime. Advancing ten minutes during the pause yields elapsed 2400 s,
downtime 600 s, dose approximately **16.61 mL/kg/h**. Harmful-then-corrected retains the prior
critical error. Acknowledgement alone does not resolve the cause. No latency or downtime is invented.

## Latency versus actual elapsed time

All **112 normalized interventions** carry `latencySeconds`. Only **nine** carry an actual
`simulation.advanceTimeSeconds` effect; **51** have metadata/effect mismatches. Runtime/UI/debrief
code does not consume latency metadata as elapsed time. No metadata was wired into the clock,
and no existing time effect was removed. CRRT-12/16/17/18's unused one-hour metadata remains an
owner/content decision, alongside the many unused 60-second values.

The inventory below enumerates every action; the action ID uniquely identifies the normalized
runtime definition. The columns are **seconds**, with zero distinct from a missing value.

| Action ID                                  | Latency metadata | Actual time effect | Mismatch |
| ------------------------------------------ | ---------------: | -----------------: | -------- |
| `crrt01-action-assess`                     |               60 |                  0 | yes      |
| `crrt01-action-safe-candidate`             |               60 |                  0 | yes      |
| `crrt01-action-alternative-candidate`      |               60 |                  0 | yes      |
| `crrt01-action-communicate`                |               60 |                  0 | yes      |
| `crrt01-action-unsafe-candidate`           |                0 |                  0 | no       |
| `crrt02-action-assess`                     |               60 |                  0 | yes      |
| `crrt02-action-safe-candidate`             |               60 |                  0 | yes      |
| `crrt02-action-alternative-candidate`      |               60 |                  0 | yes      |
| `crrt02-action-communicate`                |               60 |                  0 | yes      |
| `crrt02-action-unsafe-candidate`           |                0 |                  0 | no       |
| `crrt03-action-assess`                     |               60 |                  0 | yes      |
| `crrt03-action-safe-candidate`             |               60 |                  0 | yes      |
| `crrt03-action-alternative-candidate`      |               60 |                  0 | yes      |
| `crrt03-action-communicate`                |               60 |                  0 | yes      |
| `crrt03-action-unsafe-candidate`           |                0 |                  0 | no       |
| `crrt04-assess-goal`                       |                0 |                  0 | no       |
| `crrt04-enter-blood-flow`                  |                0 |                  0 | no       |
| `crrt04-enter-dialysate-primary`           |                0 |                  0 | no       |
| `crrt04-enter-dialysate-alternative`       |                0 |                  0 | no       |
| `crrt04-enter-machine-pfr`                 |                0 |                  0 | no       |
| `crrt04-complete-prime-review`             |                0 |                  0 | no       |
| `crrt04-start-reviewed-treatment`          |                0 |                  0 | no       |
| `crrt04-advance-six-hours`                 |            21600 |              21600 | no       |
| `crrt04-reassess-delivery`                 |                0 |                  0 | no       |
| `crrt04-start-before-review`               |                0 |                  0 | no       |
| `crrt04-equate-prescribed-delivered`       |                0 |                  0 | no       |
| `crrt05-action-assess`                     |               60 |                  0 | yes      |
| `crrt05-action-safe-candidate`             |               60 |                  0 | yes      |
| `crrt05-action-alternative-candidate`      |               60 |                  0 | yes      |
| `crrt05-action-communicate`                |               60 |                  0 | yes      |
| `crrt05-action-unsafe-candidate`           |                0 |                  0 | no       |
| `crrt06-action-assess`                     |               60 |                  0 | yes      |
| `crrt06-action-safe-candidate`             |             5400 |               5400 | no       |
| `crrt06-action-alternative-candidate`      |             2400 |               2400 | no       |
| `crrt06-action-communicate`                |               60 |                  0 | yes      |
| `crrt06-action-unsafe-candidate`           |                0 |                  0 | no       |
| `crrt07-action-assess`                     |               60 |                  0 | yes      |
| `crrt07-action-safe-candidate`             |               60 |                  0 | yes      |
| `crrt07-action-alternative-candidate`      |               60 |                  0 | yes      |
| `crrt07-action-communicate`                |               60 |                  0 | yes      |
| `crrt07-action-unsafe-candidate`           |                0 |                  0 | no       |
| `crrt08-action-assess`                     |               60 |                  0 | yes      |
| `crrt08-action-safe-candidate`             |               60 |                  0 | yes      |
| `crrt08-action-alternative-candidate`      |               60 |                  0 | yes      |
| `crrt08-action-communicate`                |               60 |                  0 | yes      |
| `crrt08-action-unsafe-candidate`           |                0 |                  0 | no       |
| `crrt09-action-assess`                     |               60 |                  0 | yes      |
| `crrt09-action-safe-candidate`             |               60 |                  0 | yes      |
| `crrt09-action-alternative-candidate`      |               60 |                  0 | yes      |
| `crrt09-action-communicate`                |               60 |                  0 | yes      |
| `crrt09-action-unsafe-candidate`           |                0 |                  0 | no       |
| `crrt10-assess-tolerance`                  |                0 |                  0 | no       |
| `crrt10-review-fluid-ledger`               |                0 |                  0 | no       |
| `crrt10-cautious-pfr-adjustment`           |                0 |                  0 | no       |
| `crrt10-coordinate-maintenance-input`      |                0 |                  0 | no       |
| `crrt10-coordinate-medication-carriers`    |                0 |                  0 | no       |
| `crrt10-advance-two-hours`                 |             7200 |               7200 | no       |
| `crrt10-reassess-balance-tolerance`        |                0 |                  0 | no       |
| `crrt10-increase-pfr-without-reassessment` |                0 |                  0 | no       |
| `crrt10-ignore-external-balance`           |                0 |                  0 | no       |
| `crrt11-action-assess`                     |               60 |                  0 | yes      |
| `crrt11-action-safe-candidate`             |             3600 |               3600 | no       |
| `crrt11-action-alternative-candidate`      |             3600 |               3600 | no       |
| `crrt11-action-communicate`                |               60 |                  0 | yes      |
| `crrt11-action-unsafe-candidate`           |                0 |                  0 | no       |
| `crrt12-action-assess`                     |               60 |                  0 | yes      |
| `crrt12-action-safe-candidate`             |             3600 |                  0 | yes      |
| `crrt12-action-alternative-candidate`      |             3600 |                  0 | yes      |
| `crrt12-action-communicate`                |               60 |                  0 | yes      |
| `crrt12-action-unsafe-candidate`           |                0 |                  0 | no       |
| `crrt13-assess-patient-device`             |                0 |                  0 | no       |
| `crrt13-advance-to-pattern`                |             1800 |               1800 | no       |
| `crrt13-inspect-access-path`               |                0 |                  0 | no       |
| `crrt13-acknowledge-alert`                 |                0 |                  0 | no       |
| `crrt13-pause-treatment`                   |                0 |                  0 | no       |
| `crrt13-reposition-access`                 |                0 |                  0 | no       |
| `crrt13-resume-treatment`                  |                0 |                  0 | no       |
| `crrt13-confirm-restored-delivery`         |                0 |                  0 | no       |
| `crrt13-increase-bfr-through-obstruction`  |                0 |                  0 | no       |
| `crrt13-declare-resolved-after-ack`        |                0 |                  0 | no       |
| `crrt13-escalate-anticoagulation-first`    |                0 |                  0 | no       |
| `crrt14-assess-patient-device`             |                0 |                  0 | no       |
| `crrt14-advance-to-pattern`                |             1800 |               1800 | no       |
| `crrt14-inspect-access-path`               |                0 |                  0 | no       |
| `crrt14-acknowledge-alert`                 |                0 |                  0 | no       |
| `crrt14-pause-treatment`                   |                0 |                  0 | no       |
| `crrt14-reposition-access`                 |                0 |                  0 | no       |
| `crrt14-resume-treatment`                  |                0 |                  0 | no       |
| `crrt14-confirm-restored-delivery`         |                0 |                  0 | no       |
| `crrt14-increase-bfr-through-obstruction`  |                0 |                  0 | no       |
| `crrt14-declare-resolved-after-ack`        |                0 |                  0 | no       |
| `crrt14-escalate-anticoagulation-first`    |                0 |                  0 | no       |
| `crrt15-action-assess`                     |               60 |                  0 | yes      |
| `crrt15-action-safe-candidate`             |             3600 |               3600 | no       |
| `crrt15-action-alternative-candidate`      |               60 |                  0 | yes      |
| `crrt15-action-communicate`                |               60 |                  0 | yes      |
| `crrt15-action-unsafe-candidate`           |                0 |                  0 | no       |
| `crrt16-action-assess`                     |               60 |                  0 | yes      |
| `crrt16-action-safe-candidate`             |             3600 |                  0 | yes      |
| `crrt16-action-alternative-candidate`      |               60 |                  0 | yes      |
| `crrt16-action-communicate`                |               60 |                  0 | yes      |
| `crrt16-action-unsafe-candidate`           |                0 |                  0 | no       |
| `crrt17-action-assess`                     |               60 |                  0 | yes      |
| `crrt17-action-safe-candidate`             |             3600 |                  0 | yes      |
| `crrt17-action-alternative-candidate`      |             3600 |                  0 | yes      |
| `crrt17-action-communicate`                |               60 |                  0 | yes      |
| `crrt17-action-unsafe-candidate`           |                0 |                  0 | no       |
| `crrt18-action-assess`                     |               60 |                  0 | yes      |
| `crrt18-action-safe-candidate`             |             3600 |                  0 | yes      |
| `crrt18-action-alternative-candidate`      |             3600 |                  0 | yes      |
| `crrt18-action-communicate`                |               60 |                  0 | yes      |
| `crrt18-action-unsafe-candidate`           |                0 |                  0 | no       |

The accounting challenge tests cover zero, learner-only, action-only, mixed, multiple interval
carrying actions, same-timestamp actions, refused actions, nonrepeatable actions attempted twice,
pause/resume, absent reassessment and an entered reassessment. Changing every action's unused
latency to an arbitrary large number still attributes only its actual effects. Removing a real
clock event from a copied timeline makes `reconciled` false: the conservation flag is not forced true.
Refused and duplicate actions add no carried time. Unsafe CRRT-11 receives no invented hour.

## Batch-01 preservation and deleted components

The full CRRT suite rechecks solute containment/metric exclusion, zero versus absent, current-run
versus worked evidence, immutable legacy progress, canonical case URL identity, and role changes
without reset. Production routes exercise case navigation and role changes after real actions/time.
Reassessment is taken only from the current session. No plan/history becomes performed care.

Repository-wide base search for `CrrtResponsePanel` and `CrrtCalibrationPanel` found only their own
component definitions; no static/dynamic imports, barrel exports, test/story/demo entry points or
route registrations. Their removal is valid. Neither was restored.

## Validation

- Original reconciled head before repairs: **69 Baxter CRRT suites / 741 tests passed**.
- Final reconciled tree: **84 suites / 976 tests passed** — 70 Baxter CRRT suites / 768 tests,
  plus 14 shared consumer/route suites / 208 tests.
- Focused final workflow/pressure challenges: **2 suites / 48 tests passed**; matched-time and
  case-evidence suites also pass in the complete run.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`: passed.
- Changed-file ESLint: zero errors/warnings. Changed-file Prettier: clean. `git diff --check`: clean.
- Real `npm run build` with synthetic preview env: passed, including both training-app builds,
  content generation, asset checks and standalone packaging. Nonfatal upstream webpack dynamic
  dependency warnings remain; no build step was skipped.
- CRRT production Playwright: **27/27 passed** on the final main-reconciled build, using the four
  existing CRRT specs plus the new sanity-review spec. No dev server was used for browser evidence.
- Representative real routes: CRRT-04 machine entry/prime/review/connect/start, nondefault 150/1900/100,
  changed in-use Qb 120, keyboard re-review, retained committed 150, truthful debrief; CRRT-11 actual
  elapsed-time/index/held-signal debrief; CRRT-13 correction/interruptions; evidence scope and all
  18 public cases' no-action explanation/debrief. Existing Learn integration journeys exercise
  the paused recorded-profile table and circuit display.
- Viewports: 1440×900, 1280×900, 1024×768, 390×844, 320×740, and 1280×900 with **200% root text**.
  Forward Tab, reverse Shift+Tab and visible outline checked on the affected re-review control at
  each size; evidence/debrief reflow and document overflow checked across the matrix. Intentional
  scrollable tables/circuit diagrams retain their existing scroll regions. New actionable controls
  fit the viewport; no horizontal document overflow. The re-review control is scrolled into view,
  traversed in both directions, and checked for full viewport bounds and an unobstructed center point.
  Tests do not apply a CSS workaround for the ribbon or use a forced click.

Screenshots were inspected for the affected evidence, review/control and paused pressure surfaces.
Initial automation missed the low contrast and focus occlusion; visual inspection caught them,
leading to the repairs and stronger geometry/occlusion assertions described above.
The existing compact activity-header truncation and broader workbench/wayfinding issues remain
Batch-03 items; this is not a full-module layout signoff. Root-text enlargement is not native zoom.

Evidence/probes/logs/screenshots are outside Git at
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/crrt263-sanity-2026-09-22`.
Tracked reproductions: `engine/__tests__/batch02Sanity.test.ts`, updated workflow/circuit tests and
`e2e/baxter-crrt-sanity-review.spec.ts` (registered in the standard CRRT Playwright config).

Structured-module skill applicability: H1/H2/H3/H4 not applicable to this bounded repair (curriculum,
stage adoption and wayfinding remain outside scope); H5 PASS rendered evidence; H6 PASS actual
machine completion; H7 PASS optional explanation/debrief; H8 PASS retained model fidelity;
H9 PASS legacy/session preservation; H10 PASS affected labels distinguish records; H11 PASS scope/
release protection; H12 PASS bounded real-route verification. These do not claim full H1–H12 module compliance.

## Remaining holds and NOT RUN

- **MODEL NOT IMPLEMENTED / CONTAINED:** evolving clinical solutes, predilution response,
  clinical hemodynamic response, citrate/calcium dynamics, renal recovery, recurrent filter loss.
- **OWNER/SOURCE HOLD:** O-01–O-06, O-09, O-10, CONFLICT-001/002 and G01-CRRT-02 remain held.
  The −18/−25 pressure corrections and all clinical/model coefficients are unchanged.
- **Deferred Batch-03/04/05:** workbench/navigation/help/layout, broader terminology/teaching,
  unused latency metadata, unused conceptual citrate state, and case-specific model/evidence authoring.
- Pre-existing scheduled delivery events still represent the authored scenario. For example the
  untouched CRRT-04 six-hour probe includes its scheduled idle/running changes despite zero configured
  flow; this review does not turn those authored events into learner-performed prime/review/start.
- NOT RUN: screen reader, native browser zoom, Safari/Firefox/WebKit, real device/touch hardware,
  localization, real clinician/learner testing, device/source adjudication or clinical validation.
- No material Batch-02 blocker remains in the checked contracts. No merge or deployment performed.
