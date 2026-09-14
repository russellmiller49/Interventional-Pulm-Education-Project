# MV-01 — MV-03 causal investigation

Executed September 14, 2026 on `codex/mv01-self-paced`, based on `8ef7001b8c8a6b8be3d4b833a743ad130177496b`. This implements the investigation requested by **prompt MV-01**; **case MV-03** is the double-triggering example. The historical review baseline is `9ef04539118b889a344992c63ba35808ee477f0e`. Newer work was retained.

## Decision

**No physiology equation, priming interval, pressure floor, residual rule, case definition, or waveform generator changed.** The reported 13.1 → 0.9 cm H₂O fall was reproduced from a 30-second baseline followed by 120 additional seconds. It is not sustained resolution: the value rises again at the next paired-breath interval. Equal-time controls show no mechanical benefit from FiO₂.

The current display takes the most recent expiration, which can be the short gap **within** a breath pair or the longer gap **between** pairs. These are different measurement windows. That demonstrated display ambiguity does not establish the clinically intended settling or aggregation rule. Accordingly, the public MV-03 case opens a worked explanation and **does not instantiate the live simulator**, including through saved seeded Challenge URLs. The other 14 cases retain the live engine. The 14 lesson experiments do not use MV-03. The exclusion is one case, not a global warning over an otherwise misleading live example.

Ventilation faculty/RT review must decide how paired-breath end-expiration, initialization, and reported PEEPi should be represented. A release of the live example needs that attributable modeling decision and new coherent waveform/measurement acceptance evidence. No review approval is claimed here.

## Matched design and reproduction

Run from the repository root:

```sh
node node_modules/tsx/dist/cli.mjs src/features/mechanical-ventilation/test-support/causal-experiment.ts
npx --no-install jest --runInBand --runTestsByPath src/features/mechanical-ventilation/__tests__/causal-experiment.test.ts
```

Every arm starts from the same immutable resolved MV-03 / `short-machine-ti` / Learn / attempt-seed 1 / HAMILTON-C6 state. Each endpoint is independently advanced from that state; sampling does not change integration chunking. Repeat both immediately after initialization and after a 30-second baseline. Endpoints are 0, 5, 30, 60 and 120 **additional** simulated seconds.

| Arm            | Actual command                 | Interpretation                                                                                    |
| -------------- | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Wait           | None                           | Time control                                                                                      |
| No-op oxygen   | FiO₂ 50% → 50%                 | Action-dispatch control                                                                           |
| Changed oxygen | FiO₂ 50% → 70%                 | Unrelated mechanics control                                                                       |
| Lower set rate | Set RR 24 → 14/min             | Sham timing control: total RR remains 32/min                                                      |
| Changed timing | Inspiratory flow 60 → 22 L/min | Actual machine Ti changes 0.35 → 0.95 s; observed Ti/Te change and paired-breath behavior differs |

All recorded mechanical fields are identical between wait, no-op oxygen, changed oxygen and lower set-rate arms at every matched endpoint (except the deliberately changed setting fields). This includes waveform volume/recoil, analytic PEEPi, peak, plateau, delivered volume, actual observed timing, and total rate. The timing arm is a distinct experiment; a longer machine Ti does not mean that every displayed last-expiration Te must increase. It must be read against the sampled phase.

## Recorded samples

The [complete generated dataset](MV-01-causal-samples.json) contains all 50 snapshots, including instantaneous lung volume, residual PEEPi, observed Ti and Te, set and total rates, oxygen setting, last phase/flow, and plateau validity/source. Values below summarize the wait and real timing arms. No measurements were hand-entered. Rounding here is for readability; the JSON retains actual output precision.

All listed plateau values are **trace estimates, not performed holds**, and are non-interpretable in this effortful phenotype. Peak and plateau numbers must not be treated as a valid passive-mechanics pair. Total RR stays 32/min and set RR stays 24/min in these two arms.

### Immediately after initialization

| Arm     | Δt (s) | PEEPi | Analytic PEEPi | Trapped volume (mL) | Recoil | Peak / plateau | Delivered VT (mL) | Machine Ti / observed Te (s) |
| ------- | -----: | ----: | -------------: | ------------------: | -----: | -------------- | ----------------: | ---------------------------- |
| Wait    |      0 |   0.8 |            0.0 |                23.0 |  0.821 | 38.7 / 27.7    |             340.0 | 0.35 / 1.06                  |
| Wait    |      5 |  13.1 |            1.2 |               366.7 | 13.096 | 38.7 / 27.4    |             340.0 | 0.35 / 0.14                  |
| Wait    |     30 |  13.1 |            1.3 |               365.9 | 13.068 | 39.5 / 28.3    |             360.0 | 0.35 / 0.12                  |
| Wait    |     60 |   0.9 |            0.0 |                24.4 |  0.871 | 39.3 / 28.3    |             360.0 | 0.35 / 1.04                  |
| Wait    |    120 |  13.1 |            1.3 |               365.9 | 13.068 | 39.5 / 28.3    |             360.0 | 0.35 / 0.12                  |
| Flow 22 |      0 |   0.8 |            0.0 |                23.0 |  0.821 | 38.7 / 27.7    |             340.0 | 0.95 / 1.06                  |
| Flow 22 |      5 |   0.6 |            0.0 |                17.0 |  0.607 | 38.7 / 21.0    |             352.0 | 0.95 / 0.92                  |
| Flow 22 |     30 |   0.6 |            0.0 |                17.0 |  0.607 | 25.0 / 20.1    |             344.6 | 0.95 / 0.92                  |
| Flow 22 |     60 |   0.6 |            0.0 |                16.7 |  0.596 | 24.8 / 20.1    |             344.6 | 0.95 / 0.92                  |
| Flow 22 |    120 |   0.6 |            0.0 |                17.0 |  0.607 | 25.0 / 20.1    |             344.6 | 0.95 / 0.92                  |

### After the 30-second baseline

| Arm     | Δt (s) | PEEPi | Analytic PEEPi | Trapped volume (mL) | Recoil | Peak / plateau | Delivered VT (mL) | Machine Ti / observed Te (s) |
| ------- | -----: | ----: | -------------: | ------------------: | -----: | -------------- | ----------------: | ---------------------------- |
| Wait    |      0 |  13.1 |            1.3 |               365.9 | 13.068 | 39.5 / 28.3    |             360.0 | 0.35 / 0.12                  |
| Wait    |      5 |  13.6 |            1.3 |               381.5 | 13.625 | 39.5 / 27.9    |             340.0 | 0.35 / 0.12                  |
| Wait    |     30 |   0.9 |            0.0 |                24.4 |  0.871 | 39.3 / 28.3    |             360.0 | 0.35 / 1.04                  |
| Wait    |     60 |  13.1 |            1.3 |               365.9 | 13.068 | 39.3 / 28.3    |             360.0 | 0.35 / 0.12                  |
| Wait    |    120 |   0.9 |            0.0 |                24.4 |  0.871 | 39.5 / 28.3    |             360.0 | 0.35 / 1.04                  |
| Flow 22 |      0 |  13.1 |            1.3 |               365.9 | 13.068 | 39.5 / 28.3    |             360.0 | 0.95 / 0.12                  |
| Flow 22 |      5 |   0.6 |            0.0 |                17.0 |  0.607 | 39.5 / 21.0    |             352.0 | 0.95 / 0.92                  |
| Flow 22 |     30 |   0.6 |            0.0 |                16.7 |  0.596 | 24.8 / 20.1    |             344.6 | 0.95 / 0.92                  |
| Flow 22 |     60 |   0.6 |            0.0 |                17.0 |  0.607 | 25.0 / 20.1    |             344.6 | 0.95 / 0.92                  |
| Flow 22 |    120 |   0.6 |            0.0 |                16.7 |  0.596 | 25.0 / 20.1    |             344.6 | 0.95 / 0.92                  |

The changed-flow arm at Δt=0 still contains the pre-action waveform history; the new calculated machine Ti is not a newly acquired post-action breath. This is why the later endpoints and observed timing are included.

## Initialization and reconciliation trace

- `simulation.ts::createInitialSimulationState` advances four simulated seconds to prime waveforms, then resets the public clock and time-stamps. The primed patient volume/history is retained; the four-second prime is not guaranteed to land at an identical boundary of the paired-breath cycle. The separate lesson priming path (`learningLab.ts::createLabSimulation`) fills four baseline breaths. Neither priming algorithm was changed.
- `physics.ts::observedExpiratoryTimeSeconds` and `observedEndExpiratoryVolumeMl` select the latest completed expiration; the latter uses its last volume sample. Within-pair gaps of about 0.12–0.14 s retain roughly 366–382 mL; between-pair gaps of about 1.04–1.06 s retain roughly 23–24 mL in this reproduction.
- `deriveMeasurements` combines an analytic timing/resistance term with waveform-derived recoil using the existing reconciliation, rather than adding both recoil representations. The diagnostic isolates the analytic term by zeroing only waveform **volumes on a copied diagnostic input**, preserving timing. This never becomes simulator state.
- `unmodeledIntrinsicPeepCmH2O` returns the positive residual after subtracting recoil already represented by retained volume. For the reproduced 30-second baseline, 365.9 mL / 0.028 L·cm H₂O⁻¹ gives about 13.068 cm H₂O; the residual against a displayed 13.1 is only about 0.032. At +120 s, 24.4 mL gives about 0.871 and the residual against 0.9 is about 0.029. Adding full displayed PEEPi again would double-count recoil. No floor or compensating offset was introduced.
- The patient field named `endExpiratoryVolumeL` is updated during integration and is an **instantaneous** retained-volume state; it is not interchangeable with the most recent waveform end-expiratory sample. Both are recorded separately.
- Floating-point interval endpoints and fixed integration sampling can choose opposite sides of a phase transition. At absolute t=150 the displayed PEEPi is 0.9; around t=150.72 it rises to 13.6 with no intervention. The regression uses phase-sensitive inequalities, not 13.1/0.9 as required golden outputs.

The demonstrated contradiction is a sustained causal teaching interpretation of a phase-dependent display. The investigation does **not** establish a replacement clinical equation or settling contract. Faculty/RT review is the appropriate boundary for that decision.

## Regression boundary

Five causal tests cover matched time/action controls at two starting states, actual timing differences, non-sustained phase-dependent change, and unrelated oxygen/mechanics separation in **MV-01 (recruitment/overdistension)** and **MV-13 (high resistance/secretions)**. Existing physics/waveform, hold validity, safety, source, identity, device commit/interlock, and post-action timing tests remain. Self-paced navigation changes are documented separately in the [handoff](../self-paced/MV-01-handoff.md).
