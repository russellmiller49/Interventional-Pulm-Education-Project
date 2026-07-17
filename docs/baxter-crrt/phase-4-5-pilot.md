# Baxter CRRT Phase 4-5 pilot record

Status: implemented for the authenticated, unlisted draft route; clinical, device, accessibility,
localization, and publication review remain pending

Route: `/[locale]/baxter-crrt`

Device profile: `prismax-aw8035-2xx` locked to AW8035 Rev B, program 2.XX

## Authorized vertical slice

Phase 4 activates Learn and Practice around one shared deterministic engine. Phase 5 supplies only
the three approved pilot cases:

- `CRRT-04`: build and run a synthetic CVVHD prescription while separating prescribed dose from
  delivery lost to downtime.
- `CRRT-10`: reconcile the machine patient-fluid-removal setting with whole-patient balance and
  simulated hemodynamic tolerance.
- `CRRT-13`: interpret a worsening access-pressure trend, correct the synthetic access cause, and
  verify restored delivery.

Mastery, Prismaflex, regional citrate-calcium dosing, patient-specific recommendations, local
competency credit, and the remaining curriculum stations remain unavailable.

## Shared learner contract

Both pathways use a fresh `CrrtLearningSessionState` and the same case fixture. Changing the case,
pathway, or role starts a clean attempt with no retained prediction, action, hint, score, trend, or
device state.

The persistent reasoning ribbon is:

`Read -> Define -> Select -> Predict -> Run -> Reassess -> Reflect`

Before any treatment, machine, or time-advance action, the learner commits five structured fields:

1. goal;
2. mechanism;
3. planned control;
4. expected immediate or delayed response; and
5. reassessment plan.

Learn is guided and unscored. It reveals the next source-mapped hint on request and still requires
prediction, action, reassessment, and debrief. Practice removes educator framing, applies the
fixed 100-point rubric, subtracts the bounded hint penalty, allows explicit alternative paths, and
reports draft critical-error candidates separately from score.

The fixed rubric is:

| Domain                         | Points |
| ------------------------------ | -----: |
| Indication and treatment goal  |     15 |
| Modality and prescription      |     20 |
| Machine and circuit operation  |     20 |
| Safety and troubleshooting     |     20 |
| Monitoring and reassessment    |     15 |
| Communication and coordination |     10 |

No learner can receive Mastery or competency credit from these pilot scores.

## Response and causality contract

The workbench keeps patient reasoning, the educational PrisMax surface, and circuit/patient
response separate. The engine produces all simulated dose, pressure, fluid, alarm, and patient
values; React components only render selectors and dispatch typed actions.

Every attempt distinguishes:

- the immediate machine/circuit response from delayed simulated patient or laboratory response;
- the machine PFR setting and cumulative machine removal from whole-patient balance;
- alarm acknowledgement from correction of the underlying cause; and
- the prescribed effluent dose from delivered dose after downtime.

The causal debrief remains locked until the learner has committed a prediction, performed an
intervention, advanced or observed the response where applicable, and completed reassessment. It
then shows the stated goal, prediction, action timeline, causal chain, trend interpretation,
required actions, accepted alternatives, draft critical errors, device-navigation point, and a
transfer question for supervised practice.

## Evidence and synthetic calibration boundary

The pilot uses the supplied PrisMax AW8035 Rev B manual for device workflow and device-specific
calculation mapping. Clinical direction is supported by source-mapped literature for
prescribed-versus-delivered dose and whole-patient fluid balance. Those sources do not validate the
pilot's exact starting values, thresholds, coefficients, action labels, scores, or critical-error
rules.

Every exact case number and engine coefficient is synthetic, deterministic, marked
`reviewStatus: pending`, and unsuitable for patient care. The development-only calibration panel
exposes the fixture, seed, pressure terms, dose, downtime, fluid ledger, matched path, and candidate
critical errors to reviewers. It is omitted outside development builds.

## Privacy and analytics

Local progress uses `baxter-crrt-progress-v1` and stores only versioned stable IDs, context,
attempts, best scores, critical-error status, hint counts, station, and engine/content versions.
It stores no PHI, patient-entered data, free-text reasoning, detailed action logs, trend arrays, or
screenshots.

CRRT analytics pass through a strict client and server allowlist. Events contain only enumerated
interaction, case or lesson ID, pathway, device, role, bounded aggregate score/count/time values,
and completion booleans. Unknown fields, free text, and detailed simulation payloads are rejected.

## Review gate

Phase 4-5 completion does not approve pilot release. Before broader access or publication, Phase 6
must independently verify keyboard and screen-reader behavior, reduced motion, 200-percent zoom,
320-pixel layout, clinical claims and scoring, device workflow and vocabulary, translation, engine
calibration, feedback capture, and the final publication decision.
