# CRRT-FELLOW-01 independent pre-merge sanity review

Scope: PR #257, Batch 01 only. No Batch 02 implementation, merge, deployment, review-status
change, model coefficient, clinical input, legacy record, or shared module change.

## Repository reconciliation

- Original Batch 01 base: `c717c9ffae09cb67e19b06a56d37c75487a5605a`.
- Reviewed PR head: `1c7ab27b7292663ac1b6ea5b657f68a461760ac7`.
- Fetched main integrated: `5ff2b096f6aa4d7032594b28520e2d78d64df5ed`.
- Initial divergence: PR 1 ahead / 17 behind main; GitHub reported CONFLICTING / DIRTY.
- Only overlapping file changed on main since the original base: `.claude/launch.json`.
- Isolated checkout: `/Users/russellmiller/.codex/worktrees/codex-crrt-257-sanity`,
  branch `codex/crrt-257-sanity`. The author's checkout and local branch were not changed.
- Main was merged without rewriting history. Conflict resolution preserved main's launch file
  exactly. Main already assigns 3129 to `claude-ebus-02` and 3130 to its production entry.
  CRRT's session-only convenience launch entry is omitted: CRRT's existing Playwright config
  supplies its server, and repository instructions do not require a per-session launch entry.
- Review dev server: 32757, isolated Chromium profiles and `/tmp/crrt257-playwright` output.
  An initial proposed port 3148 became occupied by another session; it was not reused or stopped.
- Content `1.1.0-sme-review.1`, engine `1.0.0`; review/publication status unchanged.

Read root AGENTS.md, CLAUDE.md, local-authoring-assets map, original handoff, and the local
implementation package's Prompt 01, common contract, source/code notes and coordination rules.
No applicable nested instructions govern the edited CRRT paths.

## Findings and repairs

| Finding                                            | Severity | Reproduction and repair                                                                                                                                                                                                                                                                                                                                                                                                                                   | Result                                       |
| -------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Zero conflated with missing source terms           | P1       | Changing production, input and residual clearance from zero to one removed the selector's missing-input reasons. An undeclared bag composition could then imply `modeled`. The fixture has no per-term suppliedness contract; generic source IDs/review status do not supply one. Removed numeric inference and the speculative bag-field cast. Every present pool remains explicitly `unsupported`, with the missing reviewed specification named.       | FIXED validity semantics; dynamics CONTAINED |
| Prohibited runtime metric silently evaluated false | P1       | Calling `readAllowlistedCrrtMetric` directly on a solute path returned null, and condition evaluation returned false. It now throws an explicit unsupported-solute error; content validation still rejects the same paths before normal runtime assembly. Supported metrics retain their original null/zero behavior.                                                                                                                                     | FIXED                                        |
| New debrief evidence clipped on phones             | P1       | At 390 CSS pixels the actual-evidence section extended to x≈590, despite a passing document-overflow check. Unchanged main has the same inherited table/minimum-width geometry. Batch 01 adds essential lab-boundary and reassessment text here, so a local `.debriefBody { min-width: 0 }` keeps it readable while the table retains its own horizontal scroller. A new real-route section-bounds assertion fails before the fix. No workbench redesign. | FIXED                                        |
| Launch-file conflict and port collision            | P2       | Current main assigns 3129 to EBUS. Preserve all main entries and omit the CRRT convenience entry.                                                                                                                                                                                                                                                                                                                                                         | FIXED                                        |

The two new behavioral regressions failed against the original PR runtime for their intended
reasons (2 failed / 3 controls passed), before repairs. No generic mass-balance equation or raw
fixture was changed. New tests cover nonzero values, injected bag properties, explicit zero,
absent pools, paused/unchanged pools, baseline evidence, runtime refusal, duplicate actions,
equal-time ordering, event-time prescription values and complete role-state preservation.

## Independent engine reproductions

Values below are raw diagnostic engine quantities, not clinical lab predictions. They remain
contained at presentation and verdict boundaries. Source IDs remain the supplied synthetic
case calibration IDs (`SYNTH-CRRT-02`, `SYNTH-CRRT-04`, `SYNTH-CRRT-15`).

| Case / path                                              | Elapsed | Sodium baseline → final | Bicarbonate baseline → final | Potassium baseline → final |
| -------------------------------------------------------- | ------- | ----------------------- | ---------------------------- | -------------------------- |
| CRRT-02, no action                                       | 2 h     | 136 → 129.691           | 10 → 9.512                   | 6.9 → 6.563                |
| CRRT-02, assess + increase dialysate                     | 2 h     | 136 → 126.047           | 10 → 9.231                   | 6.9 → 6.370                |
| CRRT-04, untouched unconfigured prescription             | 6 h     | 138 → 138               | 16 → 16                      | 5.8 → 5.8                  |
| CRRT-04, prescribed + started + authored six-hour action | 6 h     | 138 → 111.316           | 16 → 12.761                  | 5.8 → 4.626                |
| CRRT-15, no action                                       | 8 h     | 138 → 100.862           | 20 → 14.378                  | 4.9 → 3.523                |

The source terms remain numeric zero in these fixtures, Vd 40 L (CRRT-02/15), 42 L (CRRT-04),
and residual clearance zero. None can specify solution chemistry. The unchanged analytical
mass balance conserves mass and treats explicit zero correctly. A paused CRRT-13 pool remains
unchanged over five minutes, with 300 seconds of recorded downtime, while validity remains
unsupported. Missing pools remain absent; supplied zero baseline evidence remains zero.

CRRT-11: no-action / harmful runs at two hours give fluid balances −320 / −600 mL and stress
indices 0.760 / 0.872; MAP stays 59. The safe action itself adds one hour, yielding a three-hour
run after the same external two-hour advance: −30 mL, stress 0.360, MAP 59. This original timing
mismatch is documented, not repaired. The debrief reports performed actions and actual balance,
not a modeled MAP response or a claim of safe care.

CRRT-13 at the common 30-minute worsening point: safe / harmful paths both retain dose
22.14 mL/kg/h, balance +62.5 mL and zero downtime, because their subsequent actions occur at the
same timestamp. Access pressure is −25 / −211 mmHg respectively, and the harmful path retains
access obstruction and both authored critical errors. Recovery clears the fault, gives −40 mmHg
at the still-increased blood flow, and retains earlier harmful-action history. No downtime or
physiological response was invented to separate these paths.

## Actual-run and identity contracts

- Supplied teaching path and baseline labs are labeled separately from the actual timeline,
  computed dose/fluid/pressure evidence, entered reassessment and unperformed recommendations.
- A missing reassessment stays Not recorded. Legacy events without values stay Not recorded;
  earlier values are never reconstructed from the final prescription.
- Two same-time prescription entries retain 150 and 180 mL/min respectively and insertion order.
- A repeat nonrepeatable intervention logs one applied event and one refused event without a
  second engine effect or duplicated unsafe-action history. A repeated completed setup step is
  refused. A missing-prerequisite attempt remains refused and does not count as a performed run.
- Role reducer regression compares all session fields, including changed prescription,
  reassessment and elapsed time, and permits only role fields to differ.
- Existing progress byte-preservation tests run unchanged; no history migration was introduced.

## Validation

- Full CRRT Jest: 66 suites / 695 tests passed, including the 11 independent sanity
  regressions and the original Batch 01 tests. Repeated after the local CSS repair.
- Relevant consumers: 21 suites / 285 tests passed (critical-care progress, ICU simulation,
  module beta, analytics, draft/search/sitemap compatibility).
- CRRT route/layout: 2 suites / 8 tests passed.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`: passed.
- Changed-file ESLint and Prettier: passed; `git diff --check`: passed.
- Full CRRT Playwright on isolated dev port 32757: 17 passed / 1 compact keyboard test timed
  out waiting for “Review feedback and continue” after the lesson route had changed. The same
  unchanged test passed in 10.8 s on main and 8.3 s on the reviewed head in isolated reruns.
  This first-run timeout is retained as test-race evidence, not silently counted as a pass.
- `npm run build` with an 8 GB heap and synthetic preview environment: production build passed,
  including both embedded apps, content generation, asset validation and standalone packaging.
  Rebuilt after the local CSS repair before final browser validation.
- Final complete CRRT Playwright suite against the rebuilt production application: **19/19
  passed** (18 existing cases plus the independent viewport/double-activation probe), 50.5 s.
- Production Chromium journeys: Next recommended (CRRT-01 → CRRT-02), direct query, reload,
  Back/Forward, additional picker, invalid query fallback, unrelated history/query update,
  performed action/time/reassessment preserved across role changes, CRRT-13 harmful debrief,
  and CRRT-11 double activation (one actual assessment event).
- Screenshots inspected at 1440×900, 1280×900, 1024×768, 390×844 and 320×740; representative
  200% root text and visible keyboard focus. Root theme classes do not change the module's
  fixed dark palette; no alternate CRRT theme is claimed. Enlarged site/workspace chrome and
  sticky footer remain existing Batch 03 layout limitations; this change only contains debrief
  width. Native zoom and touch hardware were not used.

Local evidence: `/tmp/crrt257-regression-before.log`, `/tmp/crrt257-probe.jsonl`,
`/tmp/crrt257-jest-final.log`, `/tmp/crrt257-jest-shared.log`, `/tmp/crrt257-jest-route.log`,
`/tmp/crrt257-playwright.log`, `/tmp/crrt257-playwright-recheck.log`,
`/tmp/crrt257-baseline-playwright.log`, `/tmp/crrt257-width-regression.log`,
`/tmp/crrt257-baseline-geometry.log`, `/tmp/crrt257-build-final.log`, and
`/tmp/crrt257-production-final.log` and `/tmp/crrt257-production-browser`. Temporary browser configs use unique ports and are not
committed; the persistent regression additions are in the CRRT Jest and self-paced e2e suites.

## Explicit classifications and deferred work

- **FIXED:** validity/suppliedness semantics, explicit runtime metric rejection and debrief
  containment at phone widths; original
  Batch 01 case identity, role preservation and actual-run presentation verified within scope.
- **CONTAINED:** all seven unsupported evolving solute pools. The urea comparison remains
  explicitly labeled removal-only model arithmetic, not a measured or predicted laboratory result.
- **MODEL NOT IMPLEMENTED:** reviewed solution chemistry, clinical electrolyte/acid-base dynamics,
  MAP treatment responses, and any unsupported physiological extensions.
- **OWNER/SOURCE HOLD:** O-01 model/input decisions, CONFLICT-001/002 and G01-CRRT-02 remain open.
- **DEFERRED TO BATCH 02:** CRRT-11 safe-path elapsed-time mismatch; broader causality/workflow
  and same-time pause/resume interpretation. No arbitrary downtime was added.
- **DEFERRED TO BATCH 03:** inert role-control UX and broader workbench/wayfinding redesign.
- **DEFERRED TO BATCH 04/05:** teaching expansion and clinical/device model/source decisions.
- **DEFERRED cleanup:** `CrrtResponsePanel` and `CrrtCalibrationPanel` are unimported and refer to
  a nonexistent CSS module. They do not block the changed route; no cleanup was attempted.

Scoped structured-module checks (not full-module pedagogy certification):

| Criterion | Result within Batch 01                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| H1–H5     | NOT APPLICABLE: no curriculum, stage or teaching-flow migration                                                               |
| H6        | PASS: explanation/debrief remain available without inventing completed actions                                                |
| H7        | PASS: actual reassessment stays separate from recommendations; no new grading/gates                                           |
| H8        | PASS: generic engine, pressures and dose/fluid calculations preserved                                                         |
| H9        | PASS: legacy-byte tests and real route/role preservation checks                                                               |
| H10       | PASS: applied/refused actions, baseline evidence and model limitations named explicitly                                       |
| H11       | PASS: CRRT scope, source holds, review and publication status preserved                                                       |
| H12       | PASS for assigned behavior: real production routes and inspected screenshots; broader chrome limitations deferred to Batch 03 |

**SANITY REVIEW: READY TO MERGE.** This is a pre-merge code/runtime verdict, not clinical model
validation. CRRT-FELLOW-02 was not started. The PR was not merged or deployed. Native zoom, screen readers, physical devices, human sessions and other browser
engines are NOT RUN.
