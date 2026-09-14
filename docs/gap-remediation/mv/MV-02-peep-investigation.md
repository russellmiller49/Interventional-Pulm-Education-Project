# MV-02 — matched PEEP investigation

## Decision

The current MV-01 case supports its **authored, discrete recruitment–overdistension tradeoff**. It does not support interpreting the external report’s apparent compliance of 47 → 79 → 27 mL/cm H₂O as measured static compliance. The reported plateau sequence is reproducible, but respiratory effort is present and those numbers are waveform estimates. A performed hold also remains unsuitable for passive interpretation in this patient. No physiological coefficient, threshold, case parameter or engine equation was changed.

The public oxygenation lesson now presents separate, replayable, time-matched engine runs. An unchanged-PEEP arm prevents spontaneous oxygenation drift from being credited to PEEP. The adverse higher-PEEP output and the discontinuous model boundaries remain visible. Quantitative physiological intent and clinical interpretation remain pending ventilation faculty/RT review.

## Scope, source and baseline

Task started on clean `codex/mv01-self-paced` at `4c1cec33b26649110df75e50502a5af1f465c797`. PR #202 had merged. The task branch `codex/mv02-peep-comparisons` starts at current `origin/main`, `dea4e80d603b32e777b647d59c300c64f5e5079b`, preserving merged G00, MV-01 and PI-01. The scoped `physics.ts`, `simulation.ts` and `learningExperiments.ts` had no diff between historical report baseline `9ef04539118b889a344992c63ba35808ee477f0e` and this task’s base. The old external driver is not supplied; the exact driver used here is tracked.

The source report’s PEEP 5/10/15 row claims plateau 13.9/15.3/30.4 and “implied Crs” 47/79/27. These are historical observations to reproduce, not required golden outputs. `source-cases.v1.json` already specifies an increase in compliance at PEEP 8–12 and a decrease with circulatory deterioration at 14–18; its separate 5–12 curve description is less precise than that implementation contract. This work does not reconcile those descriptions into a new clinical curve.

## Matched experiment

Run:

```sh
node node_modules/tsx/dist/cli.mjs src/features/mechanical-ventilation/test-support/peep-experiment.ts > /tmp/mv02-self-paced/peep-audit.json
```

Conditions: **MV-01**, `standard`, Hamilton C6, conventional VC-A/C (`deviceMode: volume-ac`), Learn construction index 1 / seed **2260925727**. Set VT 420 mL, rate 24/min, square inspiratory flow 55 L/min, FiO₂ 60%, PEEP 5, high-pressure limit 40 cm H₂O. Neural rate 24/min, neural Ti 0.85 s, effort amplitude 8 cm H₂O, variability 0.08. These are existing authored model inputs, not recommended settings. AutoFlow and the adaptive oxygenation modes are not active.

Two cohorts start at factory time 0 and after 30 simulated seconds. The factory primes four seconds of waveforms and resets the clock while retaining the mechanical history; the 30-second cohort uses that existing behavior. Each endpoint is replayed from the same cohort state, not accumulated through preceding measurements. Arms: wait; no-op FiO₂ 60; changed FiO₂ 70; and PEEP 5, 7, 8, 10, 12, 13, 14, 15, 18. Endpoints: +0, +5, +30, +45, +60, +120 seconds. **144 snapshots**, including adverse results, unchanged controls, thresholds and early states.

The public example uses the 30-second baseline, PEEP 8/10/15 and intervals 5/30/45/60/120, with PEEP 5 held unchanged alongside every changed arm. All settings other than PEEP, patient identity, effort parameters and sampling times match. The old Learn factory’s unearned `prediction.committed` flag is cleared in this separate replay adapter; no physiological field changes and no answer is created.

## Results, including the adverse arm

Representative +45-second endpoint from the 30-second baseline (absolute time 75 s). These are rounded display outputs; [the selected raw snapshots](MV-02-peep-samples.json) retain precision, both cohorts and every 5/10/15 endpoint.

| Reading                               | Baseline: PEEP 5, t=30 | Wait: PEEP 5, t=75 | PEEP 10, t=75 | PEEP 15, t=75 |
| ------------------------------------- | ---------------------: | -----------------: | ------------: | ------------: |
| SpO₂ (%)                              |                   89.6 |               93.1 |          95.3 |          94.9 |
| MAP (mm Hg)                           |                   77.0 |               77.0 |          77.0 |          61.9 |
| Peak pressure (cm H₂O)                |                   25.0 |               24.9 |          26.3 |          41.4 |
| Plateau waveform estimate (cm H₂O)    |                   14.0 |               13.9 |          15.3 |          30.4 |
| Model-assigned compliance (mL/cm H₂O) |                     25 |                 25 |            32 |            18 |
| Delivered VT from trace (mL)          |                  421.7 |              421.7 |         421.7 |         421.7 |
| Intrinsic PEEP estimate (cm H₂O)      |                    0.0 |                0.0 |           0.1 |           0.0 |

All three t=75 arms have total rate 24/min, machine Ti 0.46 s and observed Te 2.04 s. Recent peak effort is 8 cm H₂O and passive plateau interpretation is unsuitable throughout. Some other endpoints produce VT 421.6 rather than 421.7 mL; retained fixed-step trace rounding is not normalized away. The regression allows 0.21 mL between these matched volume-controlled traces, rather than requiring equality tighter than their sample precision.

Wait, no-op FiO₂ and no-op PEEP have identical readings at equal times. Raising FiO₂ to 70 increases oxygenation while leaving waveforms, mechanics and circulation identical to waiting. The unaltered oxygenation state drifts because factory gases are not at the model’s equilibrium: simply comparing the PEEP-10 result with t=30 attributes too much of the saturation change to PEEP.

### Measurement validity

The report’s quotient is approximately selected VT divided by (displayed plateau minus set PEEP). It uses an effort-affected estimate and omits intrinsic PEEP. It is not the engine’s assigned compliance, nor a valid measured driving-pressure calculation. Using actual delivered VT and total PEEP does not repair the effort problem.

Separate real inspiratory-hold acquisitions were requested at t=75 in each arm through `PERFORM_HOLD` and `updateHoldAcquisition`. They are **not** inserted into the matched non-occluded runs or into the learner’s patient:

| PEEP | Occlusion recorded from/to (s) | Final captured pressure (cm H₂O) | Range during acquisition | Passive interpretation      |
| ---- | ------------------------------ | -------------------------------: | ------------------------ | --------------------------- |
| 5    | 75.50 → 79.46                  |                             20.9 | 13.06–21.64              | Unsuitable; effort persists |
| 10   | 75.50 → 79.46                  |                             22.5 | 14.63–23.08              | Unsuitable; effort persists |
| 15   | 75.50 → 79.46                  |                             37.1 | 29.27–38.08              | Unsuitable; effort persists |

The existing **MV-LAB** passive fixture is a separate positive control: a completed acquisition at 34.64 s gives 12.8 cm H₂O, with no effort and valid passive interpretation within the model. It is not substituted for MV-01 or presented as that patient after a treatment. Instantaneous quiet periods are insufficient: the existing four-second passivity check and complete acquisition remain authoritative.

### What makes the response discontinuous

`deriveEffectivePatient` selects compliance/shunt by set PEEP: 8–12 uses 0.032 L/cm H₂O and shunt 0.20; ≥14 uses 0.018 and 0.24. Other settings, including 13, use the initial 0.025 and 0.30. The audit retains the 12→13 reversal. `advanceSimulation` separately uses the existing oxygenation-target and pressure/circulatory rules, including the higher-PEEP MAP term. Nothing interpolates these states.

At an action’s +0 endpoint, selected settings/projected measurements can change while the stored patient and prior waveform history still reflect the preceding state. Those snapshots are retained as transition diagnostics, not taught as a newly delivered breath. The public result always advances at least five seconds, and the baseline remains separate.

This is an explicit existing teaching construct, not evidence of a universal smooth compliance curve or a measured amount of recruited lung. Smoothing coefficients, changing effort to manufacture passive holds, or declaring a preferred PEEP would introduce new physiological intent; none is done. The model’s high-pressure/adverse signals remain in the recorded outputs and existing safety engine.

## Teaching repair and sources

The old live panel labeled an estimate “Plateau pressure,” assigned PaO₂ the SpO₂ arrow and mean airway pressure the plateau arrow, and showed shunt as steady without a stored shunt trend. It now names the pressure source, states the effort limitation, labels compliance/shunt as model assigned and omits arrows without the corresponding recorded series. Its FiO₂, PEEP and mean-pressure explanations describe this model’s actual scope; it no longer implies a modeled oxygenation benefit from longer inspiration.

Existing source IDs and release/review state are preserved. The [AARC 2024 patient–ventilator assessment guideline](https://www.aarc.org/wp-content/uploads/2024/10/patient-ventilator-assessment-aarc-cpg.pdf) was checked for the existing assessment context: delivered VT, plateau pressure, PEEP/auto-PEEP and total-PEEP-based driving pressure. It does not validate this case’s coefficients. Existing `tobin-3e-peep` and `bounded-ventilation-model` records remain the lesson’s clinical-reference and authored-model provenance. No new source identity, faculty approval or clinical recommendation was invented.

See the [implementation handoff](../self-paced/MV-02-handoff.md) for tests, browser evidence, question dispositions and the next slice. The case MV-03 live exclusion and causal regression remain unchanged.
