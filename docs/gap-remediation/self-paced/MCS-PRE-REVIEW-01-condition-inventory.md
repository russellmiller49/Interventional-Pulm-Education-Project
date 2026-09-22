# MCS-PRE-REVIEW-01 — the twelve cases' numerical conditions, classified

Sidecar to [MCS-PRE-REVIEW-01-handoff.md](MCS-PRE-REVIEW-01-handoff.md). Generated from
`content/scenarios.ts` on this branch; `__tests__/mcs-pre-review-01.test.tsx` asserts the same
twenty-one rows through the rendered worked explanation of all twelve cases.

**No condition in this module has a clinical source behind it.** Every one is a test this module
wrote so its own cases have an end. The `source-supported-clinical` class exists in the type for
OD-04 and the later source work to fill in with a named document and an exact scope; the type
requires both, and `mcs-pre-review-01.test.tsx` fails if a condition claims the class without them.
Two conditions are additionally **held**: kept in the record, excluded from scoring, and never shown
as a result (see F19 in the handoff).

| Case        | Metric                  | Condition | Label on screen                     | Class                    | What the number is in this model                                                             | Clinical source | Scoring          |
| ----------- | ----------------------- | --------- | ----------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------- | --------------- | ---------------- |
| IABP-01     | `timingQualityPercent`  | ≥ 80      | Timing quality ≥80%                 | authored-model-condition | this model’s own trigger/timing index, which no IABP console reports                         | —               | graded           |
| IABP-01     | `mapMmHg`               | ≥ 58      | MAP ≥58 mm Hg                       | authored-model-condition | the model’s mean arterial pressure                                                           | —               | graded           |
| IABP-02     | `timingQualityPercent`  | ≥ 60      | Usable trigger/timing quality       | authored-model-condition | this model’s own trigger/timing index, which no IABP console reports                         | —               | HELD · MCS-03-05 |
| IABP-03     | `timingQualityPercent`  | ≥ 80      | Timing remains technically adequate | authored-model-condition | this model’s own trigger/timing index, which no IABP console reports                         | —               | graded           |
| IMP-01      | `rapMmHg`               | ≤ 18      | RAP not progressively rising        | authored-model-condition | the model’s mean right atrial pressure                                                       | —               | graded           |
| IMP-01      | `deviceFlowLMin`        | ≥ 2       | Stable device flow ≥2 L/min         | authored-model-condition | the model’s pump-flow estimate for this mechanism                                            | —               | graded           |
| IMP-02      | `deviceFlowLMin`        | ≥ 2.5     | Effective device flow restored      | authored-model-condition | the model’s pump-flow estimate for this mechanism                                            | —               | graded           |
| IMP-03      | `mapMmHg`               | ≤ 100     | Excess afterload reduced            | authored-model-condition | the model’s mean arterial pressure                                                           | —               | graded           |
| IMP-03      | `deviceFlowLMin`        | ≥ 2.5     | Pump flow improves                  | authored-model-condition | the model’s pump-flow estimate for this mechanism                                            | —               | graded           |
| LVAD-01     | `mapMmHg`               | ≤ 95      | MAP returns to modeled target range | authored-model-condition | the model’s mean arterial pressure                                                           | —               | graded           |
| LVAD-01     | `deviceFlowLMin`        | ≥ 3.2     | Flow improves without speed change  | authored-model-condition | the model’s pump-flow estimate for this mechanism                                            | —               | graded           |
| LVAD-02     | `papi`                  | ≥ 1       | PAPi improves                       | authored-model-condition | the model’s pulmonary artery pulsatility index, derived from its own PA and RA pressures     | —               | graded           |
| LVAD-02     | `deviceFlowLMin`        | ≥ 2.8     | LVAD filling and flow improve       | authored-model-condition | the model’s pump-flow estimate for this mechanism                                            | —               | graded           |
| LVAD-03     | `deviceFlowLMin`        | ≥ 3       | Modeled pump flow restored          | authored-model-condition | the model’s pump-flow estimate for this mechanism                                            | —               | graded           |
| LVAD-03     | `mapMmHg`               | ≥ 55      | Perfusion pressure recovers         | authored-model-condition | the model’s mean arterial pressure                                                           | —               | graded           |
| CAP-IABP-01 | `timingQualityPercent`  | ≥ 65      | Trigger/timing quality ≥65%         | authored-model-condition | this model’s own trigger/timing index, which no IABP console reports                         | —               | HELD · MCS-03-05 |
| CAP-IABP-01 | `mapMmHg`               | ≥ 50      | MAP ≥50 mm Hg                       | authored-model-condition | the model’s mean arterial pressure                                                           | —               | graded           |
| CAP-IMP-01  | `deviceFlowLMin`        | ≥ 2.4     | Device flow ≥2.4 L/min              | authored-model-condition | the model’s pump-flow estimate for this mechanism                                            | —               | graded           |
| CAP-IMP-01  | `recirculatingFlowLMin` | ≤ 0.5     | Recirculation ≤0.5 L/min            | authored-model-condition | the part of the model’s pump flow that returns to the ventricle instead of reaching the body | —               | graded           |
| CAP-LVAD-01 | `deviceFlowLMin`        | ≥ 3       | Modeled pump flow recovers          | authored-model-condition | the model’s pump-flow estimate for this mechanism                                            | —               | graded           |
| CAP-LVAD-01 | `mapMmHg`               | ≥ 55      | Perfusion pressure recovers         | authored-model-condition | the model’s mean arterial pressure                                                           | —               | graded           |

TOTAL 21 conditions across 12 cases

## What "graded" and "HELD" mean here

- **graded** — `calculateMcsScore` counts the condition in its internal `response` component. No
  learner-facing surface in this module renders that score: `state.score` is `null` after
  `COMPLETE` and no component reads it. The worked explanation lists the condition and says what
  kind of number it is; it does not say whether this run reached it.
- **HELD · MCS-03-05** — the condition stays in `successCriteria` so its identity and the historical
  contract are intact, and `calculateMcsScore` skips it in both numerator and denominator. The
  worked explanation prints it with the reason it is not treated as an outcome and the open item.

## Owner decisions this sidecar is for

**OD-04** — which of these numbers should stay model-only, which should become source-linked
contextual teaching, and which should be withheld as misleading. Nothing here proposes a clinical
target; in particular no universal MAP 65 has been imported and `MAP ≥50` and `MAP ≥58` are
unchanged from their authored values.

**OD-01** — the two held conditions. Their decision is `NOT REVIEWED`.
