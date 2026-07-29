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
