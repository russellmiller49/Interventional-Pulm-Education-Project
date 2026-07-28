# E4 — model limitations found while building the VV foundation lessons

**Date:** 2026-07-28
**Branch:** `critical-care/module-rebuild`
**Scope:** `vv-series-physiology`, `vv-normal-state`, `vv-integration-capstone`

Every limitation below was established by running the engine, not by assumption. The command that
produces the numbers is `npm run dump:ecmo-signals` (add `ECMO_SCENARIO=<id> ECMO_STEPS=<n>` for a
sample-by-sample table). Each one is rendered to the learner where it bears on what a panel claims —
these notes are the record, not the disclosure.

## 1. No engine state isolates a patient-side deterioration

`vv-integration-capstone` needs four explanations for a deteriorating patient with an unchanged flow
display. Three of them have an engine-backed preview. The fourth — the patient has changed — does
not, and no combination of existing presets produces one.

What was checked, and why each candidate fails:

| Candidate                             | Circuit at 12 modeled seconds  | Why it is not an isolated patient-side change                                                                                                                                           |
| ------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `acute-hypercapnia`                   | flow 4.05, pressures unchanged | The case authors a sweep of 2 L/min. The finding is at the gas control, so it is a gas-side state, not a patient-side one.                                                              |
| `compensated-hypercapnia`             | flow 4.05, pressures unchanged | Same: the sweep setting is authored away from the reference.                                                                                                                            |
| `clinical-vv-tension-pneumothorax`    | flow 2.39, pVen −140, ΔP 19    | The fault limits drainage, so the circuit changes markedly. The handoff explicitly warned against presenting this as an unchanged-circuit example, and the engine confirms the warning. |
| `clinical-vv-occult-hemorrhage`       | flow 2.80, pVen −139, ΔP 22    | Same drainage limitation.                                                                                                                                                               |
| `clinical-vv-recirculation-migration` | flow 4.49, pVen −36            | A re-drainage case, not a patient-side one.                                                                                                                                             |
| `transport-power-loss`                | flow 4.05, pressures unchanged | A device and power state, not a patient one.                                                                                                                                            |

Two structural reasons make a clean preset impossible without new engine work:

- `derivePatient` drives `nativeCardiacOutputLpm` to a fixed target of 4.5 L/min in VV, so a case
  cannot hold a different native output over time.
- `modelInputs.oxygenConsumptionMlMin` is authorable per case, and raising it would lower
  `systemicVenousSaturationEstimate` without touching the circuit — but `patientTargets` does not
  read consumption, so patient SpO₂ would not move. The result would be a deterioration the patient
  monitor cannot see, which is worse teaching than no preview at all.

**How E4 handled it.** The patient-side column of the hypothesis matrix is authored from the section's
own source prose, three of its cells carry an explicit limitation, and the panel renders a
source-backed hypothesis card plus a `data-model-limitation` entry saying that no preset isolates it.
Completion is not blocked. No new scenario was created and no new physiology was invented.

**If this is picked up later**, the honest fix is an engine change — a patient-side fault that raises
consumption and feeds it through `patientTargets` — not a new scenario built on the current model.

## 2. The membrane-resistance preset also constrains circuit flow

`afterload-oxygenator-resistance` settles at flow 3.08 L/min against the reference circuit's 4.05,
with pInt 331, pArt 190 and a gradient of 141 mmHg. Its displayed flow therefore **falls**; it is not
an example of an unchanged flow display.

It also leaves PaCO₂ at 46.0 mmHg, unchanged from the reference, so it cannot demonstrate the
carbon-dioxide row of the matrix either.

**How E4 handled it.** The preview's `modelBoundary` says the flow falls and tells the learner to read
the gradient rather than the flow. The matrix cell for displayed circuit flow under membrane
dysfunction says "falls in this simulation" and carries a limitation warning that a real membrane can
lose gas transfer without its resistance having risen enough to constrain flow — so an unchanged flow
must not be read here as ruling a membrane problem out. The PaCO₂ cell carries its own limitation.

## 3. Bedside and ventilator findings are effectively fixed across the VV presets

Work of breathing, respiratory rate, airway pressure, lung sliding, MAP and lactate are identical
across the VV reference, `vv-recirculation`, `gas-source-interruption` and
`afterload-oxygenator-resistance`. The row of the matrix that a patient-side change would show
itself in is therefore authored teaching rather than something a loaded case will demonstrate. Stated
in the matrix cell.

## 4. Recirculation fraction is authored, not derived (carried forward from E3)

`deriveRecirculationFraction` returns `RECIRCULATION_FRACTION.baseline` (0.08) or `.established`
(0.48) from the case's fault flag. It does not vary with pump speed, cannula position or volume
state. `vv-series-physiology` states this in a `ModelBoundary` and in the
`ecmo.recirculationFraction` guide rather than implying that raising the speed moves it.

## Carried forward unchanged from E3

- Connected-but-stopped static pressures are `simulation-unmodeled`; no supplied source provides a
  support-mode-specific static-pressure model.
- The 13 `icu-hemodynamics` guides remain on the legacy shape behind the audit's exact-path
  allowlist. Not E4 work; the allowlist was not broadened.
