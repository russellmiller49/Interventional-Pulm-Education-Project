# MCS-PRE-REVIEW-02 — consolidated owner-decision packet

Prepared 2026-09-22 by an AI authoring assistant (Claude Opus 5) against the
`MCS_Claude_Implementation_Pack` of 2026-09-20. Every decision below is **NOT REVIEWED**. Nothing
here is clinical, device or source approval, and no decision has been made on the owner's behalf.

One packet, four decisions, in the order the package numbers them. Each carries: the exact
activity and case ids, what the model does today, the matched-time numbers behind it, the
dependency path, what source support exists, what is missing, the risk of leaving it, and at most
two bounded implementation options. Where the evidence establishes a technical truth it is stated
as a recommendation; where the choice is clinical it is left open.

All numbers were read from the production reducer through
`test-support/replayHarness.ts`, seed 417, fixed 0.02 s steps, an 8-second authored settle and an
8-second observation, with a no-action control in the same comparison. They are reproducible from
`__tests__/mcs-pre-review-02.test.tsx`.

---

## The dependency path these decisions sit on

```
patient controls  ──►  deriveNativeCardiacOutput  ──►  deriveBaselineMeasurements
(preload %, LV/RV            (stroke volume)              rapMmHg   pawpMmHg   mapMmHg
 contractility, SVR,                                         │         │         │
 PVR, PEEP, rhythm,                                          │         │         └─► afterloadFactor
 tamponade, AI)                                              │         │             (LVAD alarm input)
        │                                                    │         │
        └──► patientToCirculationParameters ──► advanceWindkesselCompartments (shared solver)
                (circulatingVolumeFraction)         │
                                                    ├─► leftVentricularVolumeMl  (conserved reservoir)
                                                    ├─► pulmonaryVenousPressureMmHg
                                                    └─► systemicArterialPressureMmHg
                                                            │
        ┌───────────────────────────────────────────────────┘
        ▼
  computeImpellaSupport / computeLvadSupport / computeIabpSupport
        │   rvDeliveryToLeftHeart = f(RV contractility, preload %, PVR) + RP gain
        │   lvFilling             = f(leftVentricularVolumeMl)      ← saturated in practice
        │   leftPreloadFactor     = min(the three)  ──► suction predicate, pump flow
        ▼
  deriveMcsMetrics
        │   modeledLvedv  = f(preload %, LV contractility, AI, unloading, PEEP, tamponade)
        │                   + clamp((leftVentricularVolumeMl − 120) × 0.1, −10, +14)
        │   pcwpMmHg      = pawpMmHg + (modeledLvedv − 120) × 0.055 − unloading + …
        ▼
  monitor tiles, teaching panels, worked explanations, case successCriteria
```

**Names that are not one quantity.** These are the pairs that made the walkthrough read as
self-contradictory, and they are all genuinely different variables:

| Looks like one thing     | Actually two                                                                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "LV filling"             | `lvFilling`, a term computed from the conserved reservoir volume and used in the suction predicate; and `modeledLvedv`, the educational end-diastolic surrogate on the monitor. They do not track each other.                                   |
| "wedge pressure"         | `compartments.pulmonaryVenousPressureMmHg`, which the solver integrates and which _does_ respond to right-sided delivery; and `metrics.pcwpMmHg`, the displayed number, built from `baseline.pawpMmHg` and the LVEDV surrogate, which does not. |
| "mean arterial pressure" | `baseline.mapMmHg`, this patient's modeled circulation with no support running; and `metrics.mapMmHg`, the monitor's figure. At the durable reference they differ by ~35 mm Hg.                                                                 |
| "pump flow"              | the modeled transfer the compartments actually move; the displayed figure (the same number, rounded); and effective systemic delivery. A real HeartMate 3's displayed flow is a fourth thing — a controller estimate.                           |
| "PAPi improves"          | PAPi moving because right-sided _support_ was added (weak in this model) and PAPi moving because the modeled right ventricle itself changed (large).                                                                                            |

---

## OD-01 — IABP device scope, atrial fibrillation, and the timing references

**Findings:** F17, F19 (model half), F18; historical `MCS-03-05`.
**Activities:** Learn section `iabp-timing-triggering` (its five demonstrations and its transfer);
cases `IABP-01`, `IABP-02`, `IABP-03`, `CAP-IABP-01`.

### What is still held, unchanged

MCS-PRE-REVIEW-01's atrial-fibrillation containment is **in force and untouched**. Measured again
this slice at matched times: in atrial fibrillation the model rates arterial-pressure triggering
**74%**, ECG **50%**, internal **40%**, and raises `iabp-trigger-unreliable` below 0.6 — so only
pressure triggering leaves the trigger alarm quiet. Sinus control: 100 / 90 / 62. The two held
timing conditions (`IABP-02` and `CAP-IABP-01`) are still the only two held conditions in the
module.

**New this slice: the source was read first-hand rather than described.** Getinge's _Cardiosave
Troubleshooting Strategies_ (MCA00002553 Rev A, ©2025 Datascope Corp.) was opened from the local
reference copy on 2026-09-22 (SHA-256
`98fe5bc2fc0e6927c527e79212236a7f10eaee6eaae5944837555d836940c468`). Printed pages 3 and 5 state
that ECG triggering is the preferred trigger given a reliable R wave and is recommended for
arrhythmias; that pressure triggering is not recommended for irregular rhythms such as atrial
fibrillation; and that internal triggering should not be kept while the patient is generating a
cardiac output. **That confirms the existing `MCS-03` source record is accurate.** It also confirms
that the source names a _preference_ and supplies no synchrony model, no numbers, and nothing from
which a corrected ranking could be implemented. Reversing the three coefficients would be
substituting constants, so containment remains the only defensible state.

### F17 — what the waveform can and cannot show

Measured at the section's own 1:2 demonstration settings, aligned timing, four complete beats:

|                | assisted beat              | unassisted beat |
| -------------- | -------------------------- | --------------- |
| systolic peak  | 98.1 mm Hg                 | 97.8 mm Hg      |
| diastolic peak | **92.4 mm Hg** (augmented) | 76.2 mm Hg      |
| end-diastolic  | **60.5 mm Hg**             | 61.0 mm Hg      |

Both of the features the walkthrough looked for are absent: the augmented peak is 5.7 mm Hg
**below** the systolic peak, and the assisted end-diastolic pressure is **0.5 mm Hg** below the
unassisted one. The cause is in `generateMcsWaveformSample`: assisted beats receive a
fixed-amplitude Gaussian augmentation (22 mm Hg at full timing quality) added to a diastolic
baseline that is identical for assisted and unassisted beats, and **there is no term anywhere that
reduces the pressure at the start of the next ejection**. The 0.5 mm Hg is the tail of the
augmentation bump, not a modeled unloading. Across the four error states the assisted-versus-
unassisted end-diastolic difference is 0.00, +0.63, 0.00 and 0.00 mm Hg; the late-deflation penalty
appears as an early-systolic dip on the assisted beat (minimum 49.6 against 55.4), not at
end-diastole.

Raising the augmentation amplitude until the picture matched the teaching would be changing a
waveform to agree with a sentence, so it was not done.

**What was done instead.** Getinge's _The IABP Numbers Game_ (booklet 83440-EN, read 2026-09-22
from the local copy, SHA-256
`2870fecd9fb6d8d605e323fe9352e9040e23462431a00e9837e60a342a8e2580`) names the five landmarks and
states the relationships: inflation at the dicrotic notch appearing as a sharp V, diastolic
augmentation that _ideally_ rises above systole, and deflation just before ejection that reduces
the assisted end-diastolic and assisted systolic pressures. It gives **no** millimetre-of-mercury
magnitude for either reduction — so the walkthrough's "15–20 mm Hg" figure, which came from a
third-party source not verified here, was not used and appears nowhere. An authored diagram of
those relationships now sits beside the live strip, on the same fixed 40–120 mm Hg scale, labelled
as not this patient, not a run of the simulation and not a measurement.

### The decisions

- [ ] Confirm the intended Cardiosave model, software revision and market, and whether the module
      teaches a generic mechanism, a named console, or both in explicitly separate panels.
- [ ] Have an IABP-experienced physician, perfusionist or Cardiosave educator review the trigger
      passages, the intended atrial-fibrillation behaviour and the reliable-signal assumptions.
- [ ] Approve either a source-backed correction specification for the ranking, or continued holding
      of the disputed interaction as a worked comparison.
- [ ] Approve the authored reference diagram: its content, the "ideally" qualifier, and whether a
      drawing derived from a manufacturer booklet's stated relationships needs a rights review
      (cross-reference **OD-06**).

### Options, at most two

**A. Keep the generic mechanism and keep the hold.** No engine change. The reference diagram
carries the two pressure relationships; the live strip carries event timing and says so. Cost:
learners cannot _practise_ recognising the two relationships on a moving trace.
**B. Specify a reviewed deflation model.** An approved specification would have to say what the
assisted end-diastolic reduction depends on and how large it is, with a source. No source available
to this slice supplies that.

**Technical recommendation (not the clinical decision):** A is the only option currently
implementable; B needs a specification that does not exist in the available material.

---

## OD-02 — durable LVAD product identity, the estimator, and the reference pressure

**Findings:** F27, F28; historical `MCS-03-01/02/03/04/08/09`.
**Activities:** Learn sections `lvad-parameters-assessment` and `lvad-alarms-emergencies`; cases
`LVAD-01`, `LVAD-02`, `LVAD-03`, `CAP-LVAD-01`.

### What the code actually computes (reconfirmed, unchanged)

`computeLvadSupport` sets a target flow from speed, multiplies it by the smaller of right-sided
delivery and the left-ventricular filling term, then by an afterload factor and a tamponade factor.
**Power is computed from the resulting flow afterwards**, with a flat `2.8 W` added when
`suspectedPumpThrombosis` is set. Measured at matched times from the durable reference state:

|                       | power     | displayed flow |
| --------------------- | --------- | -------------- |
| no action             | 4.9 W     | 3.78 L/min     |
| high-power pattern on | **7.8 W** | **3.79 L/min** |

The flag never enters the flow formula. That is confirmed, and this slice did not change it.

**Abbott's parameter card** (already registered as `abbott-heartmate3-pump-parameters-card`) states
that device power is a direct measurement of motor voltage and current, and that flow is an
estimate derived from a calculation of fixed speed, power and the patient's hematocrit. The arrow
runs power → flow on the device and flow → power here. The card names the inputs and gives no
equation, no failure-mode behaviour and no validation data.

**One thing is now said plainly that was not before:** this module has no estimator at all. Its
displayed pump flow _is_ the modeled transfer the conserved compartments move, rounded. Nothing is
biased and nothing estimated is fed back into mass transport. No hematocrit control was added and
no coefficients were invented.

### F27 — the reference pressure, and an alarm reading the wrong measurand

The durable reference settles at a **displayed MAP of about 103 mm Hg**. MCS-PRE-REVIEW-01 already
removed the claim that this reads normally, and this slice did not tune it toward any target.

The new finding is separate and concrete. The `lvad-high-afterload` alarm's predicate is
`baseline.mapMmHg > 100` — this patient's modeled circulation **with no support running**, which is
not the number on the monitor and not the pressure the pump ejects against:

| simulated SVR       | displayed MAP | alarm's own input | modeled afterload factor | pump flow | alarm      |
| ------------------- | ------------- | ----------------- | ------------------------ | --------- | ---------- |
| 1150 (reference)    | 101           | 67.5              | 0.94                     | 3.93      | quiet      |
| 1400                | 115           | 74.5              | 0.88                     | 3.69      | quiet      |
| 1900                | 140           | 87.2              | 0.77                     | 3.22      | quiet      |
| 2200                | 154           | 96.0              | 0.71                     | 2.97      | quiet      |
| 2200 + preload 145% | 155           | 119.5             | 0.66                     | 3.18      | **raised** |

So the alarm named "Afterload-limited flow" stays silent through a state where the model is
demonstrably taking 29% of the pump's requested flow away at the outlet. What _does_ carry the
limitation is `pressureGradientFactor`, computed from the conserved arterial and pulmonary-venous
compartments.

**Repaired without changing when the alarm fires:** the alarm's label and explanation now name the
quantity the predicate actually reads; the panel prints the modeled afterload cost as a percentage
of what the speed is asking for; and the alarms panel's evidence row no longer offers the displayed
MAP as evidence for this alarm. The predicate, its input and its threshold are **unchanged** —
changing when a safety-styled alarm fires is an owner decision.

### The decisions

- [ ] Decide whether the durable activities are a generic continuous-flow model or explicitly
      HeartMate 3 teaching, and approve the labelling boundary.
- [ ] Supply or authorize retrieval of the current official IFU / clinical education references for
      the intended device and version. The parameter card is neither the IFU nor an estimator.
- [ ] Have an LVAD physician or coordinator review the high-power pattern, the estimated-versus-
      actual flow framing, PI, and the reference patient's baseline pressure.
- [ ] Decide the `lvad-high-afterload` predicate (below).
- [ ] Confirm CP versus 5.5 and RP versus RP Flex, and resolve the CP peak-versus-mean flow question
      separately from the textbook's conflicting statements.

### Options, at most two

**On product identity —**
**A. Generic continuous-flow mechanism with source-linked HeartMate 3 comparisons.** What is
implemented today, now stated explicitly. No invented physics; the device-specific teaching is
comparison, not simulation.
**B. Explicit device-specific estimator.** Requires a complete, defensible specification and a
validation basis. None exists in the available material, and reverse-engineering one from the
parameter card is expressly out of bounds.

**Technical recommendation:** A. B is not implementable from any source this slice could read.

**On the `lvad-high-afterload` predicate —**
**A. Re-point it at the arterial pressure the model uses to limit the flow**
(`compartments.systemicArterialPressureMmHg`), keeping the threshold at 100. Measured consequence:
it would raise at simulated SVR 1400 and above, matching the flow limitation — **and** it would
raise in the tamponade state (compartment pressure 103.9 with a displayed MAP of 83), which is
probably not wanted, and the compartment pressure carries within-beat ripple, so the alarm could
chatter.
**B. Leave the predicate and keep the honest labelling shipped in this slice.** The alarm remains a
statement about the modeled patient rather than the modeled pump; the cost figure carries the
teaching.

**Technical recommendation:** the choice is clinical. Option A's tamponade behaviour is a real
defect that would need a second condition, so A should not be taken as a drop-in.

---

## OD-03 — right-sided delivery, filling, suction, congestion, and volume response

**Findings:** F14, F21, F24, F25, F26, F29, F35.
**Activities:** Learn sections `iabp-efficacy-limits` (4), `impella-unloading-placement` (5),
`impella-suction-purge-rv` (6), `mcs-device-selection-integration` (9); the two suction story
problems; cases `IMP-01`, `IMP-02`, `LVAD-02`.

### Finding 1 — left-sided suction is always a right-sided-delivery story in this model

`leftPreloadFactor = min(rvDeliveryToLeftHeart, lvFilling, circulatingVolumeFactor)`, and the
suction state is raised when that minimum falls below **0.58**.

Across thirteen deliberately extreme states (preload 50% and 145%, RV contractility 0.2, LV
contractility 0.2 and 1.4, PVR 9 Wood units, tamponade, heart rate 180, level 9, severe aortic
insufficiency, PEEP 20, and combinations), each read at 8 and at 60 simulated seconds:

- `lvFilling` **never left the band 0.817 – 1.200**, against a clamp of 0.18 – 1.20.
- `leftPreloadLimiter` was **`rv-delivery` in every single state**.

`lvFilling` is calibrated as `(leftVentricularVolumeMl − 25) / 85`, which spans an end-diastolic
range of 25–110 mL. The quantity fed into it is the conserved reservoir volume, which operates at
**115–260 mL**. The term is therefore saturated at its ceiling essentially always and **cannot
participate in the minimum**. The same scale mismatch exists in `computeLvadSupport`
(`(leftVentricularVolumeMl − 25) / 82`, observed 1.18 in every state), so durable-support suction
is also purely right-sided-delivery-driven.

This is a provable local defect. It is **not repaired here**, because recalibrating it would change
which states raise a suction alarm across nine sections and twelve cases — a consequential clinical
behaviour change.

**What was repaired:** the alarm no longer claims the ventricle is empty. `impella-left-suction`'s
explanation now names the term the model used, and the Section 6 panel prints it live with its
threshold. So the Section 6 opening state — suction beside a wedge of 20 mm Hg and the largest
end-diastolic volume in the module — reads as a mechanism instead of a contradiction.

### Finding 2 — the displayed wedge has no right-sided term

Section 4 setup, matched times, no-action control in the same comparison:

|                                   | RAP | PAPi | effective flow | **displayed wedge** | **displayed LVEDV** | conserved LV reservoir | conserved pulmonary venous pressure |
| --------------------------------- | --- | ---- | -------------- | ------------------- | ------------------- | ---------------------- | ----------------------------------- |
| no action                         | 11  | 1.6  | 4.51           | **20**              | **133**             | 235.3 mL               | 16.31 mm Hg                         |
| RV contractility → 0.20           | 22  | 0.3  | 2.55           | **20**              | **127**             | **175.1 mL**           | **11.66 mm Hg**                     |
| LV contractility → 0.25 (control) | 12  | 1.5  | 2.80           | **26**              | 144                 | 247.3 mL               | 16.87 mm Hg                         |

At 30 s and beyond the reservoir settles at 155 mL against the control's 252 mL and the pulmonary
venous pressure at 9.6 against 16.2.

So **the model does represent right-sided limitation of left-heart filling — in its conserved
compartments — and the displayed surfaces do not carry it.** `deriveBaselineMeasurements`'s `pawp`
formula has preload, LV-failure, aortic-insufficiency, PEEP and pericardial terms and no
right-ventricular term at all; `modeledLvedv` has no RV-contractility term; and the compartment
contribution to `modeledLvedv` is deliberately scaled by 0.1 and clamped to −10/+14 mL, with a
comment explaining that the fixed-step reservoir would otherwise read as progressive dilation. The
displayed LVEDV moved 6 mL, which is inside the module's own 5.5 mL display deadband.

The LV-failure control shows the display is not simply frozen: the same wedge moves 6 mm Hg there.

**Not repaired**, and the teaching inference is contained instead. The Section 4 distractor
rationale used to tell the learner that the left heart tends to be underfilled rather than
congested; it now says what this model shows, that the displayed wedge does not move at all when
right-sided delivery is taken away, and that the right-sided pressures move first. The section's
own learning objective — a technically perfect device failing because the limitation is upstream —
is intact and plainly visible (RAP doubles, PAPi collapses, flow falls 44%, synchrony does not
move), so this is containment of an unsupported extra inference, not the removal of a required
phenomenon.

### The bounded specification, if the owner wants the display to carry it

The solver already produces the quantity a wedge estimates:
`compartments.pulmonaryVenousPressureMmHg`, anchored on the same `baseline.pawpMmHg` the display
uses and moved by the pulmonary-venous reservoir's deviation from its reference. A blend of the
existing formula with that compartment pressure, in the same form `deriveMcsMetrics` already uses
for MAP (`mapFromFlow × 0.74 + compartment × 0.26`), would give at a 0.26 weight:

|                       | today | with the blend  |
| --------------------- | ----- | --------------- |
| reference, no action  | 20    | ~20 (unchanged) |
| RV contractility 0.20 | 20    | ~18             |
| LV contractility 0.25 | 26    | ~24             |

**Risk of adopting it:** it moves displayed wedge pressures in every section and every case,
including the congestion classification, which is scored against a 15 mm Hg threshold the module
cites from an ACC consensus description. **Risk of leaving it:** any teaching statement that
right-sided failure underfills the left heart cannot be demonstrated on the monitor, and Section 4
and Section 9 both come close to needing it.

### Options, at most two

**A. Leave the display and keep the inference contained** (what ships in this slice), with the
limiting term now visible where suction is taught.
**B. Adopt a reviewed coupling** — either the blend above or a recalibration of `lvFilling` — with
a named reviewer, re-checked congestion classifications for all twelve cases, and the ACC threshold
re-examined against the new numbers.

**Technical recommendation:** the mapping gap is real and provable; whether the displayed wedge
should carry it is a clinical modelling decision and is left to the owner. If B is chosen, the
`lvFilling` scale mismatch should be decided in the same pass, because both change suction
behaviour.

### Finding 3 — F24, the size of the unloading response

Matched times, filled example, against the P5 control:

|         | LVEDV              | wedge            | left pump flow      |
| ------- | ------------------ | ---------------- | ------------------- |
| P5 → P6 | 118 → 114 mL (−4)  | 18 → 18          | 2.44 → 2.84 (+0.40) |
| P5 → P8 | 118 → 107 mL (−11) | 18 → **17** (−1) | 2.44 → 3.49 (+1.05) |

The response is real, monotone in the setting, and small in the pressure. **It was not amplified.**
Printing more decimal places would have been false precision — the metrics are derived to the
nearest millimetre and the engine's own measured idle drift for the wedge is about 1 mm Hg. Instead
each row now carries its matched-time difference stated against the module's own measured display
deadband, so "below this model's resolution" is a readable answer rather than an invisible one. At
P6 all three qualify; at P8 the volume and the flow clear their deadbands and the wedge still does
not.

- [ ] Decide whether a demonstration state with a larger pressure response is wanted. That requires
      an approved baseline, not a larger coefficient.

### Finding 4 — F26, what the volume story's control actually does

The preload control is not an addition to the circulation; it rescales it.
`patientToCirculationParameters` turns the percentage into the solver's `circulatingVolumeFraction`
and the solver holds the total at `4100 × fraction + 260` mL. The story's one change, 55% → 100%,
therefore moves the simulation's circulating volume from **2515 mL to 4360 mL — +1845 mL in one
step**. That is why the response is as large as the walkthrough found it (MAP 59 → 97 and effective
delivery 3.74 → 6.15 L/min at matched times, with suction clearing).

The learner-facing sentence says the control rescales the entire circulation and that the response
is larger than a bedside fluid challenge would produce, and **still carries no figure that could be
read as a dose** — MCS-PRE-REVIEW-01's guard on that surface is intact and tested. The number above
lives here and in the handoff.

**A reviewed right-ventricular-failure contrast is ready to specify, and is not shipped.** Measured
on the section's own patient (RV contractility 0.36, CP at level 7), matched times:

|                | RAP    | wedge  | left pump flow | effective delivery | suction          |
| -------------- | ------ | ------ | -------------- | ------------------ | ---------------- |
| no action      | 20     | 20     | 1.06           | 3.60               | active           |
| preload → 100% | 19     | 19     | 0.97           | 3.43               | **still active** |
| preload → 140% | **24** | **25** | 1.65           | 4.72               | **still active** |

So the model already produces the contrast the walkthrough asked for: in right-ventricular failure
the same control raises both filling pressures and does not clear suction.

- [ ] Approve or decline a third story problem built on this state, with its baseline, its
      intervention and the expected response above. No generic "suction means fluid" or "fluid is
      harmful" rule is proposed, and nothing has been added to the module.

### Finding 5 — F29, congestion pattern against support bottleneck

Section 9's recognize step, measured at its own starting actions (RV contractility 0.34, preload
88%, CP at level 5):

- RAP **18**, wedge **18**, ratio 1.00, PAPi 0.5, effective delivery 2.75 L/min, suction active.
- The congestion panel on the same screen classifies this as **biventricular** — correctly, since
  both pressures exceed the 15 mm Hg the ACC description the module cites uses.
- `leftPreloadLimiter` is **`rv-delivery`**, and P5 → P8 buys +0.25 L/min displayed and +0.21
  effective with RAP unmoved and the suction still active.

So the key (`right-sided`) is defensible on the bottleneck and the word "modest" was false on the
classification. **The key, its id and the option set are unchanged.** What changed is the wording:
the option no longer calls an 18 mm Hg wedge modest, the distractor is refused on the bottleneck
rather than by denying that the wedge is elevated, and the section's starting context now points at
the congestion panel and says the two questions are different. The panel is not hidden and no
lower-wedge baseline was invented.

- [ ] Review whether Section 9 should additionally teach the ratio explicitly, or whether naming
      the bottleneck from the pump's own behaviour is enough. No ratio threshold was introduced.

### Finding 6 — F35, LVAD-02's whole success condition

The condition is **two** predicates: `papi ≥ 1` **and** `deviceFlowLMin ≥ 2.8`. Matched times from
the case's own opening state:

|                           | PAPi    | RAP   | pump flow | effective delivery | both met |
| ------------------------- | ------- | ----- | --------- | ------------------ | -------- |
| no action                 | 0.5     | 20    | 1.16      | 3.12               | no       |
| RV contractility → 0.9    | 1.6     | 11    | 2.82      | 5.22               | yes      |
| PVR → 2.5 alone           | 0.5     | 18    | 1.52      | 3.61               | no       |
| both required actions     | **2.1** | **8** | **3.66**  | **6.03**           | yes      |
| raise speed (alternative) | 0.5     | 20    | 1.34      | 3.26               | no       |

PAPi is not flat here and it is not a standalone criterion. The apparent contradiction with Section
9 dissolves on inspection: Section 9's statement is about right-sided _support_, and adding the
right-sided pump there moves PAPi 0.5 → 0.6, inside the module's own 0.25 deadband. This case
changes the modeled right ventricle itself. **Nothing was re-keyed and no criterion changed**; the
debrief now names the difference.

- [ ] Review the full PAPi/RAP/flow interpretation, and whether the source-specific limitations in
      `derivedValueGuides` are the ones you want a fellow to carry.

---

## OD-04 — authored numerical conditions against clinical targets

**Findings:** F04, F27, F33, F35 and the Section 9 framework.

MCS-PRE-REVIEW-01's [condition inventory](MCS-PRE-REVIEW-01-condition-inventory.md) lists all
twenty-one conditions across twelve cases, all classified `authored-model-condition`, none with a
clinical source. That table is unchanged by this slice. Three additions belong to it:

| Value                | What it is                                                           | Where it lives                                                     | Decision needed                                                                               |
| -------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `0.58`               | The left-sided inflow factor below which the suction state is raised | `LEFT_IMPELLA_SUCTION_PRELOAD_THRESHOLD`                           | Authored, no source. Its input term is the one OD-03 Finding 1 is about.                      |
| `0.42` / `2.5 L/min` | Durable-support suction thresholds                                   | `LVAD_SUCTION_FILLING_THRESHOLD`, `LVAD_SUCTION_MINIMUM_FLOW_LMIN` | Authored, no source. The filling term cannot reach 0.42 in any measured state.                |
| `100 mm Hg`          | The durable high-afterload predicate                                 | `LVAD_HIGH_AFTERLOAD_MAP_MMHG`                                     | Authored, no source, and applied to a quantity that is not the displayed pressure. See OD-02. |

These were inline literals before this slice and are now named constants with their values
unchanged, so a reviewed change has one place to land.

- [ ] Decide which of these numbers stay model-only, which become source-linked contextual
      teaching, and which should be withheld as misleading.
- [ ] Approve any clinical blood-pressure, congestion, flow or PAPi target with its exact patient
      and device setting and guideline scope. **No universal MAP 65 has been imported, the report's
      ISHLT 75–90 and <80 figures were not used, and `MAP ≥50` and `MAP ≥58` are unchanged.**

---

## Activities that remain unsuitable for clinical release

Stated as engineering findings, not as a release decision — which is **OD-08**, and is the owner's.

| Activity                                                                                     | Why                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `iabp-timing-triggering` transfer; cases `IABP-02`, `CAP-IABP-01`                            | The atrial-fibrillation trigger model contradicts the manufacturer's own material and is **contained, not corrected**. `MCS-03-05` is open.                                                                            |
| `iabp-timing-triggering` steps 1–5                                                           | The live model cannot demonstrate the two pressure relationships the section teaches; an authored reference carries them, which is containment and not the same as practising on a trace.                              |
| `lvad-parameters-assessment`, `lvad-alarms-emergencies`; cases `LVAD-01`/`03`, `CAP-LVAD-01` | The product identity is undecided (OD-02), the reference patient's pressure is undecided, and an alarm named for afterload reads a quantity that is not the displayed pressure.                                        |
| `impella-suction-purge-rv`, `mcs-device-selection-integration`; cases `IMP-01`, `IMP-02`     | The suction predicate's left-ventricular term is inert (OD-03 Finding 1) and the displayed filling pressures carry no right-sided response (Finding 2). Both are now stated truthfully on screen; neither is repaired. |
| All twelve cases                                                                             | Every numerical condition is authored with no clinical source (OD-04).                                                                                                                                                 |

---

## What this packet does not claim

No clinical validation. No device fidelity. No release readiness. No owner approval. Every decision
above is **NOT REVIEWED**, every reviewer field in
[`MCS-03-claim-review-queue.json`](MCS-03-claim-review-queue.json) is still null, and `MCS-03-05`
keeps its decision. Two manufacturer documents were read first-hand for this slice and registered
or reconfirmed with their limitations; registering a source is not approval of anything it is cited
for.
