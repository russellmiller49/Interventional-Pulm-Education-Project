# H5 — Derived hemodynamics and validity

Package record for the `derived-hemodynamics` Learn station rebuild
(branch `claude/hemodynamics-h5-derived-hemodynamics-validity-2026-08-09`,
base `2f26cb76`). H4's record is
[hemodynamics-h4-cardiac-output-methods.md](hemodynamics-h4-cardiac-output-methods.md).

## Central rule

A derived hemodynamic value is an equation over measurements. It is not a new
independent measurement, and it cannot be more valid than its inputs. Every H5
surface — teaching panel, episode workbench, transfer comparison, numeric
audit — resolves from one canonical record set so the rule cannot drift apart
from the arithmetic.

## Scope

Eleven metrics were displayed before H5 and the same eleven are displayed after
it: CI, SV, SVI, SVR, SVRI, PVR, PVRI, CPO, PAPi, PA compliance, and PPV.
Nothing was added (no gradients, stroke-work indices, or Qp/Qs — TPG/DPG and
RVSWI/LVSWI appear in the audited source table but were never in this module's
scope) and nothing was removed. The persistent section id, route, storage key,
progress schema, completion-rule ids, scoring, and the H2/H3/H4 stations are
unchanged; case-lab scoring still counts its own `derived-reviewed` check.

## What the station now holds a learner to

The Learn-local completion contract
(`derivedHemodynamicsSectionCompletion`) requires seven pieces of evidence,
each earned by a separate graded interaction:

1. measured separated from calculated (Recognize provenance drill);
2. one complete dependency chain validated (PVR's inputs named exactly);
3. one metric withheld for the correct input-validity reason (invalid wedge);
4. unrelated metrics preserved in that same episode (no global invalid switch);
5. a flow-dependent result traced to its cardiac-output method;
6. a two-method disagreement preserved without averaging;
7. a phenotype-specific boundary read inside its population.

The four hands-on items are ordinary `VALIDATE_SIGNAL` checks, so the exported
objective predicate stays a function of simulation state. Opening the formula
reference completes nothing.

## Sources and verification depth

The supplied hemodynamics reference workspace was located during H5
(OneDrive `critical_care_references_old_version/Hemodynamics/` and
`Interventional-Pulm-Local-Data/private-references/`), and the Bootsma Part 2
review was read directly. `derivedSourceBoundaries.ts` records per-topic depth:

- **source-text-and-locator-verified** — formulas and reference intervals
  (Table 1, p. 18), resistance unit conventions (×80; Table 1), PAPi
  definition and its no-extrapolation statement (§7.2, p. 24), the mPAP > 20 /
  PAWP ≤ 15 boundaries (§7.6, pp. 25–26), the direct-Fick account (§3.1,
  p. 19), and the shunt/TR interpretation limits (§4.2–4.3).
- **claim-text-audited** — the CPO formula and cohort context (Mendoza 2007
  not present), the PA-compliance distribution (Mounsey 2026 not present),
  the PPV threshold (Michard 2000 not present), and the model registration.
- **registry-membership-only** — the declared gaps: no BSA estimating
  formula, no universal derived normal ranges, no numeric small-denominator
  criterion, and no derived-value treatment targets. No number is shown for
  any of these.

No source document is distributed in this repository, and sentence-level SME
review remains open. The threshold-context classification uses the task's
seven categories plus one addition, `reference-interval`, for the Table 1
adult reference figures (SVR 800–1200, CI 2.5–4.0, SV 60–100, SVI 33–47),
which are neither definitions, cohort cut points, nor targets.

## Regression falsifications (2026-08-10)

Twelve representative defects were introduced one at a time against the
committed implementation, proven caught, and reverted with
`git checkout --`. The final diff contains none of them.

| #   | Defect introduced                                                                         | Caught by                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Calculated cardiac output made acceptable as `measured` in the CI record                  | Import-time validator: “Cardiac output is an equation over other values and must not be labeled measured” — every consuming suite refuses to load                                  |
| 2   | Invalid-input withhold disabled, so PVR calculated from the invalid wedge                 | `withholds only the wedge-dependent branch`: expected withheld, received available                                                                                                 |
| 3   | Convention check disabled, so an end-diastolic PAWP fed the mean-PAWP formula             | `requires the mean PAWP convention`: expected withheld, received available                                                                                                         |
| 4   | Episode-coherence check disabled, so titration-era MAP/RAP combined with the current flow | Jest (expected withheld, received available) and the audit: four “calculated across current+earlier-titration” flags                                                               |
| 5   | Flow-method label dropped from dependent results                                          | Jest (flowMethodLabel null) and the audit: “a flow-dependent value is displayed with no method name” ×79                                                                           |
| 6   | The two accepted flows averaged to 4.85 L/min before deriving                             | Jest (one set instead of two) and the audit: set-count flag, four hand-value disagreements (SVR 1336, PVR 4.5 — exactly the averaged-flow values), and the averaged-value tripwire |
| 7   | A global “any invalid input withholds everything” switch                                  | `withholds only the wedge-dependent branch`: survivors expected available, received withheld                                                                                       |
| 8   | Required-positive and nonfinite guards removed, so a zero-RAP PAPi displayed              | `withholds on a zero denominator`: expected withheld, received available-with-caution                                                                                              |
| 9   | The acute-RV-infarction PAPi boundary reclassified as a treatment target                  | Import-time validator: “no derived-hemodynamics boundary may be classified as a treatment target”                                                                                  |
| 10  | SVR conversion constant broken (79 for 80)                                                | Hand-calculated fixture in Jest (1200 vs 1185) and the audit's independent hand-value table                                                                                        |
| 11  | Negative transpulmonary gradient clamped to zero                                          | Jest (expected withheld, received available) and the audit: “gradient = 0 mmHg was clamped or ignored instead of withholding”                                                      |
| 12  | Station objective reverted to the `derived-reviewed` button                               | `cannot be completed by the formula reference`: expected false, received true                                                                                                      |

After restoration: 23 suites / 325 tests green, audit reports no numeric or
provenance problems.

## Rendered review (2026-08-10)

Reviewed in the running app at `/en/icu-hemodynamics/learn?activity=derived-hemodynamics`
at 1600×900, 1440×900, 1280×720, and 1024×768, plus `/en/critical-care`,
`/en/icu-hemodynamics`, and the two neighbouring stations.

All eight episodes, both flow-method result sets, the withheld and
caution states, the perturbation table, and the threshold-context blocks
render as authored. Status is carried in words on every result
(`AVAILABLE` / `AVAILABLE WITH CAUTION` / `WITHHELD`, plus
`NOT MATHEMATICALLY CALCULABLE` and `NOT CLINICALLY INTERPRETABLE`), so no
judgment depends on color. No H5 surface overflows the document at any
reviewed width; below 1300px the lab shell swaps to its existing
space-saving one-panel-at-a-time view and the station renders full-width
there. Keyboard focus is visible (`:focus-visible`, amber ring), there are
no duplicate ids, and the provenance chips measure 7.0–8.2:1 contrast.

One defect was found and fixed: a dependency that accepts more than one
provenance rendered its chips with no gap, so "Measured" and "Sampled"
abutted on screen and concatenated to `MEASUREDSAMPLED` in the text the
panel exposes. The chip cell is now a wrapping flex row.

Two pre-existing conditions are not H5 defects and were left alone. This
worktree has no `.env.local`, so `src/proxy.ts` throws when it builds a
Supabase client; that makes non-public routes 500 and `POST /api/analytics`
fail. The H5 routes are public-unlisted and return before that line, so they
serve normally. Separately, `scripts/literature/protected-gold-import-contract-v2-recovery-bundle.test.ts`
(a file this branch does not touch, added by `main`) exceeds its own 15 s
cap under full-suite parallelism; it passes in isolation.

## Boundaries

This is an educational simulation pending SME review. It teaches measurement
validity and provenance for derived values; it does not claim treatment
validity, shock-management readiness, novice validation, procedural
competence, bedside readiness, or release readiness. H6 shock integration and
H7 validation remain future packages.
