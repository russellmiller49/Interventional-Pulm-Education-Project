# E5 — model limitations found while building the VA foundation lessons

**Date:** 2026-07-29
**Branch:** `claude/cardiohelp-ecmo/foundation-learning-flow`
**Scope:** `va-parallel-physiology`, `va-normal-state`, `va-integration-capstone`

Every limitation below was established by running the simulation, not by assumption. Each one is
rendered to the learner where it bears on what a panel claims — these notes are the record, not the
disclosure.

The VA-specific quantities are not in `npm run dump:ecmo-signals`, which reports the circuit columns
only. They were measured by stepping each VA scenario and the VA reference profile directly and
reading `patient.rightRadialSpo2`, `patient.femoralArterialSpo2`, `patient.pulsePressure`,
`patient.aorticValveOpening`, `patient.pulmonaryCongestion`, `patient.distalLimbPerfusion`,
`patient.distalLimbNirs` and `patient.meanArterialPressure` off each frame.

Sibling document: `docs/critical-care/e4-model-limitations.md`, for the VV track.

## 1. No VA scenario carries vasoplegia

`va-integration-capstone` needs vasoplegia on its differential: a fallen systemic vascular resistance
is a real explanation for a deteriorating VA patient with an unchanged circuit, and the section's
prose names it. `vasoplegia` exists as a fault type in the engine's fault union, but **no authored VA
scenario injects it**.

Measured across all eleven VA scenarios and the VA reference, at nine sample times each:

| Quantity               | Range observed                                |
| ---------------------- | --------------------------------------------- |
| `meanArterialPressure` | 60–72, and 71 in the large majority of frames |

The only VA preset that moves mean arterial pressure at all is
`va-afterload-oxygenator-resistance`, which settles at 67 — and it moves it as a side effect of a
membrane problem, not as a vascular one. There is therefore no state in which a learner can see
vasoplegia's signature.

**How this is handled:** the vasoplegia column of the hypothesis matrix is authored teaching, and
every cell in it carries an explicit limitation saying the simulation cannot demonstrate it. The
column is kept rather than dropped because omitting a real explanation from a differential teaches a
worse habit than including one the model cannot show.

## 2. No VA scenario moves the cannulated limb

Limb ischemia distal to an arterial cannula is one of the few VA complications that is found only by
examining the patient, and `va-integration-capstone` teaches exactly that discipline.
`distal-limb-ischemia` exists as a fault type, but no authored VA scenario injects it.

Measured across every VA scenario frame sampled (108 frames):

| Quantity              | Distinct values observed |
| --------------------- | ------------------------ |
| `distalLimbPerfusion` | `normal` — only          |
| `distalLimbNirs`      | 68 — only                |

**How this is handled:** the limb row renders live state like any other row, so it correctly reports
a normal limb, and it carries a limitation stating that this simulation holds the limb fixed across
every VA preset. The teaching point — that nothing on the console will raise the limb for you — is
made by the row existing and by the guided action that sends the learner to look at it.

## 3. The membrane preset couples resistance to flow

Identical to the VV track's finding, and repeated here because the VA preset behaves the same way.
`va-afterload-oxygenator-resistance` settles at a displayed flow of 3.08 L/min against the reference
4.05, with the gradient at 141 mmHg against 31.

At the bedside a membrane can lose gas transfer without its resistance having risen enough to
constrain flow. This simulation couples the two, so an unchanged flow must not be read as ruling a
membrane problem out. The panel says so on that column's flow cell.

This preset is also the one VA preview that is **not** settled at eight modeled seconds: its
discriminating signals are fixed from the first frame, but the drainage saturation is still falling
at twelve seconds and only settles by about twenty. The variant therefore advances twenty seconds,
not the eight the other VA previews use.

## 4. Differential oxygenation is authored, not derived from a watershed

`va-differential-hypoxemia` settles with a right radial saturation of 82.0 against a femoral
arterial saturation of 98.5. Those two values are **authored by the scenario**. This simulation does
not model a mixing watershed and does not compute its position from native ejection, so the learner
cannot move the watershed by changing native cardiac output or circuit flow and watch the two
saturations respond.

**How this is handled:** the parallel-physiology panel states the relationship in words and renders
the two live values with the gap between them, under a model boundary saying the position is
authored rather than derived. The teaching claim is about what the two sites mean and why the site
matters, which the preset does support; it is not a claim that the model computes mixing.

## 5. The VA capstone has no pre-change state of its own

`vv-integration-capstone` opens one modeled second before an authored timed change, which is why its
opening variant holds the lesson clock. `va-mixed-circulation-capstone` has no timed fault: it
carries `differential-hypoxemia` from the first frame, and settles to a state identical in every
measured quantity to `va-differential-hypoxemia` at the same time.

Consequences, both deliberate:

- The VA capstone's presenting case **is** its differential-oxygenation mechanism. Offering a
  separate differential-oxygenation preview would show the learner the same state twice, so the
  panel says this instead and the discrimination is done by the findings the learner goes and looks
  at.
- The one VA preset with an authored timed change is `va-gas-source-interruption`, at second five. It
  is offered as a mechanism preview with a held pre-change state and an evolved state, which is what
  gives the VA capstone a change that can be watched arriving rather than only revealed.

### 5a. The VA gas case settles later than its VV counterpart

The VV package advances its evolved gas state twenty-eight modeled seconds, on the measured basis
that the VV case stops moving by about second twenty-six. The VA case does not: at twenty-eight the
carbon dioxide value is still climbing and the femoral saturation still falling.

| t   | PaCO₂ | pH   | femoral | right radial | post-oxygenator |
| --- | ----- | ---- | ------- | ------------ | --------------- |
| 4   | 46.0  | 7.36 | 96.5    | 96.0         | 99.0            |
| 28  | 79.6  | 7.12 | 79.7    | 80.0         | 72.0            |
| 40  | 90.0  | 7.07 | 78.0    | 80.0         | 72.0            |
| 180 | 90.0  | 7.07 | 78.0    | 80.0         | 72.0            |

The VA evolved state therefore advances **forty** seconds. Copying the VV number would have opened
the preview mid-slide and invited a learner to read a still-moving value as the case's endpoint.
This was found by a test asserting that every variant not deliberately held is at equilibrium, not
by inspection — keep that test.

## 6. The simulator models one VA configuration

"VA ECMO" is not one flow topology, and this simulation is one of them: **peripheral femoral V-A ECMO
with retrograde arterial return**. Every VA panel names it in a badge and in a model boundary, and
the configuration strategy card names it again before any alternative is described.

What is described in the learner-facing teaching but **not simulated**:

| Configuration                                                    | Status in this simulation                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Peripheral femoral V-A, retrograde arterial return               | The modeled topology. One drainage cannula, one femoral arterial return.                                           |
| V-AV                                                             | Described, not simulated. There is one return limb, so there is no arterial-versus-venous return split to compute. |
| Upper-body arterial return (axillary/subclavian/brachiocephalic) | Described, not simulated. No upper-body return path exists to load.                                                |
| Central V-A (ascending or proximal aorta)                        | Described, not simulated. Nothing places the return centrally, so the anterograde topology cannot be shown.        |

Three quantities a configuration discussion invites and this simulation does not model:

- **Return-flow split.** No state divides circuit flow between two return limbs, so no panel reports
  or derives one.
- **Cannula interaction.** Nothing models one cannula's effect on another's drainage or return, in any
  configuration.
- **V-AV recirculation.** In VA the authored recirculating share is zero and there is no venous return
  limb for returned blood to be re-drained from. The parallel-physiology panel shows the arithmetic
  that follows and says explicitly that it is not evidence about any real configuration.

One further boundary belongs with these, because it is the one that is easiest to miss: even for the
strategy this simulation _can_ apply — raising femoral circuit flow — the mixing point does not move.
The two arterial saturations are authored by the loaded case (finding 4 above), so the direction is
taught in words and cannot be demonstrated by changing the pump speed.

**How this is handled:** every entry of the configuration strategy card carries its own model
boundary, and the card carries a further one stating that one of the five is available on this page
and four are not. The teaching claim is the mechanism and the caution that goes with it, never an
order of escalation, a flow target, a dose or a timing cutoff — none of which follow from a physiology
and nomenclature position paper.

Sources added for this teaching, metadata only, with no figure reproduced and no passage quoted:
`elso-dual-circulation-2024` (Badulak et al., _Intensive Care Med_ 2024, DOI
10.1007/s00134-024-07645-8, with the published correction DOI 10.1007/s00134-025-07809-0 recorded in
the same citation) and `elso-maastricht-nomenclature-2019` (Broman et al., _Crit Care_ 2019, DOI
10.1186/s13054-019-2334-8). The hyphenated forms V-A, V-AV and V-V are the formal spellings used
throughout; a clinical-copy guard fails on unhyphenated `VAV`.

## 7. Cannulated-limb ischemia is a bedside-only hypothesis here

Finding 2 above is the measurement: the limb never moves in any VA state this lesson can load. The
consequence for the learner-facing teaching is recorded separately because it changed how the
capstone is laid out.

- The five-column hypothesis matrix is titled **"Selected high-yield explanations for deterioration
  with unchanged displayed flow"**, and says in its first paragraph that it is not a complete
  differential. It was never exhaustive; it now says so.
- Cannulated-limb ischemia keeps its **matrix row**, so it is still compared against all five
  columns, and gains a **card of its own beside the matrix** rather than a sixth column. A sixth
  column of directional prose would push the discriminating cells of every row out of view inside a
  teaching pane that already scrolls the matrix horizontally.
- The card states that limb ischemia may be the whole explanation or may coexist with any of the
  five; that no console signal reliably substitutes for examining the limb; that evaluation rests on
  direct examination and on whatever limb-monitoring approach the program uses, with a near-infrared
  probe being one such approach and a single number from it settling nothing; and that this
  simulation holds distal-limb perfusion and the near-infrared value fixed, so **the absence of a
  modeled change is not evidence that limb perfusion is adequate**.
- The guided action that sends the learner to look at the limb is retained, and it is the measurement.

## Quantities that do move, and are therefore safe to teach from

Recorded so a future package does not re-derive them. VA reference settled at eight modeled seconds
against the two mechanism presets, all at eight seconds:

| Quantity                | VA reference   | differential-hypoxemia | lv-loading     |
| ----------------------- | -------------- | ---------------------- | -------------- |
| displayed circuit flow  | 4.05           | 4.05                   | 4.05           |
| pVen / pInt / pArt / ΔP | −35/242/211/31 | −35/242/211/31         | −35/242/211/31 |
| right radial saturation | 96.0           | **82.0**               | 96.0           |
| femoral saturation      | 98.5           | 98.5                   | 98.5           |
| pulse pressure          | 18.0           | 18.0                   | **5.0**        |
| aortic valve opening    | open           | open                   | **shut**       |
| pulmonary congestion    | mild           | mild                   | **marked**     |
| native cardiac output   | 2.40           | 2.40                   | **0.80**       |
| drainage saturation     | 81.5           | 81.5                   | **75.9**       |

The circuit row being identical across all three columns is the lesson, not an artefact.

Note that the VA reference is **not** equilibrated at t=0: pulse pressure ramps 33 → 25 → 21 → 18 and
the femoral saturation 93.7 → 96.5 → 97.9 → 98.5 over the first eight modeled seconds, and the
right radial and femoral values are equal at t=0. Opening a VA lesson at frame zero would therefore
show no differential at all. `REFERENCE_SETTLE_SECONDS = 8` covers this for both tracks; do not
remove it.

---

# Two owner decisions taken after the B3/B4 vertical slice

Both came out of adversarial review of the six pilot drill panels. Both were engine changes, and
both were explicitly authorised because the defect was a safety or honesty one rather than a
refinement.

## 8. Air resumption is one bounded action, not a taught clamp order

**What was wrong.** The module taught: correct and de-air, open the drainage limb, open the return
limb, then reset the console latch to restart the pump. That order walks the learner through both
near-patient limbs open on a stopped centrifugal pump — and a centrifugal head is non-occlusive, so
nothing holds a column in place. The panel taught that non-occlusiveness two blocks above the step
that contradicted it.

**What was decided.** The module does not teach any universal clamp/pump/reset choreography for
coming back, because no single order is supported by both the current CARDIOHELP instructions for
use and every approved local protocol. What is preserved is everything up to and including
de-airing: recognise the event and the device stop, clamp the return limb near the patient, complete
isolation, identify and correct the source, de-air and verify.

**What replaced it.** `RESUME_SUPPORT_AFTER_BUBBLE` — "resume support using the verified
manufacturer and local protocol" — which moves the circuit from corrected-and-isolated to safely
running in one transition. It is deliberately neither a clamp action nor the console reset button:
making the reset button appear to operate circuit clamps would be a different false claim.

Preserved: source correction and de-airing remain prerequisites; a premature resume is still
`premature-bubble-reset`; a premature unclamp is still `unsafe-unclamp-before-deair`.

**The new invariant.** Once the air source is recorded as corrected, no accepted path reaches both
limbs open with the pump stopped. Opening the last closed limb by hand while the bubble latch still
holds the pump is refused (and still charged if the air is outstanding). The refusal is scoped to
the latch on purpose — both limbs open with a stopped pump is the ordinary pre-use state of every
circuit in this module, and making it globally illegal would break startup.

Applies to: the VV and VA bubble lessons, their panels, the guided-lesson validator, and both
clinical air-embolism cases, whose two unclamp interventions became one `air-resume-support`.

## 9. Drainage-limited flow is a capacity, not a multiplier

**What was wrong.** `preload-limited` (and its three guard-family siblings) multiplied the pump
curve by a constant. Displayed flow — and, through it, the modelled patient's saturation — therefore
rose with every extra revolution, while the reducer charged `rpm-during-collapse` as a critical
error for exactly that action. A learner who tested the reflex watched the patient improve and was
scored as though they had harmed them. A model boundary telling the learner to ignore the patient
response was not an acceptable substitute for fixing it.

**What replaced it.** A scenario-authored drainage capacity. `ScenarioDefinition.drainageCapacityLpm`
overrides a per-fault default; `resolveDrainageLimitation` reports the demand, the capacity and the
shortfall. Below the capacity, flow tracks the pump curve normally. Past it, delivered flow _falls_
as demand climbs, drainage pressure deepens in proportion to the shortfall, and the judder appears.

| Fault                     | Default capacity (L/min) | Suction base (mmHg) | Suction per L/min of shortfall |
| ------------------------- | ------------------------ | ------------------- | ------------------------------ |
| `preload-limited`         | 3.5                      | −35                 | 42                             |
| `hemorrhagic-hypovolemia` | 3.3                      | −45                 | 75                             |
| `tension-pneumothorax`    | 3.1                      | −65                 | 79                             |
| `tamponade`               | 3.1                      | −65                 | 79                             |

All bounded educational-model quantities. None is a threshold, and none is a flow any real patient
is limited to. The suction constants were calibrated so each case's drainage pressure at its own
opening speed is unchanged from the previous model.

**Guard alignment.** `rpm-during-collapse` now fires when the _new_ speed asks for more than the
drainage can supply, rather than on any increase. A learner who backed the pump well off and is
bringing it back inside the supported range is no longer penalised for an action the model itself
treats as helpful.

**Guard-family audit.** All four faults that share the guard were aligned rather than narrowed: they
differ in why drainage is short but share the shape that matters, so the shape is modelled once.

**The shape, from `npm run dump:ecmo-signals`** (`preload-drainage-collapse`, capacity 3.50 L/min):

| rpm  | demand | flow | pVen | chatter | SpO2 | past capacity | guard |
| ---- | ------ | ---- | ---- | ------- | ---- | ------------- | ----- |
| 2400 | 3.04   | 3.04 | −35  | —       | 93.2 | —             | —     |
| 2800 | 3.54   | 3.19 | −37  | —       | 94.4 | yes           | —     |
| 3200 | 4.05   | 3.01 | −58  | —       | 93.8 | yes           | —     |
| 3600 | 4.56   | 2.83 | −80  | yes     | 93.1 | yes           | —     |
| 4000 | 5.06   | 2.65 | −101 | yes     | 92.5 | yes           | yes   |
| 4800 | 6.08   | 2.30 | −143 | yes     | 91.3 | yes           | yes   |

Flow peaks _at_ the capacity and falls past it, which is the whole teaching point: only samples both
past the capacity are comparable, and the authored 3600 → 3300 action moves flow up and suction
back. Backing the speed off is never charged. The underlying fault stays active until the
patient/cannula/drainage cause itself is corrected, so the reduction never reads as a cure.

**What did not change.** A2 recirculation is untouched — displayed flow still rises while effective
flow falls, under its own separately-named guard. The cross-surface causal-consistency claim for
drainage collapse no longer needs the `authoredContextDifference` exception it used to carry.
