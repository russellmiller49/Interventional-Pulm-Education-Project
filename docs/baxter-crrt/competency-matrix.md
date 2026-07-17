# Baxter CRRT educational capability matrix

Status: `pending review` — original paraphrased curriculum map, not a competency standard

Current evidence scope: three-case authenticated/unlisted draft pilot

Credentialing status: none

## 1. Interpretation boundary

This matrix maps simulator activities to original, plain-language educational capabilities. It does
not reproduce or claim endorsement by a professional body's competency framework. It does not
establish scope of practice, credential a learner, replace supervised machine training, or prove
independent clinical competence.

An in-module Practice score is formative evidence from a synthetic scenario only. Any local
competency program must independently define eligible roles, supervised observations, assessor
qualifications, remediation, reassessment, expiration, and record retention.

## 2. Capability domains

| ID       | Educational capability                                                                                    | Primary scoring domain         |
| -------- | --------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `CAP-01` | Identify the simulated patient's immediate problem and state a bounded treatment or safety goal.          | Indication and treatment goal  |
| `CAP-02` | Relate diffusion, convection, ultrafiltration, adsorption, and modality selection to the stated goal.     | Modality and prescription      |
| `CAP-03` | Build and review a source-bounded CRRT prescription using explicit units and profile constraints.         | Modality and prescription      |
| `CAP-04` | Complete the enabled setup sequence and distinguish device readiness from patient/treatment readiness.    | Machine and circuit operation  |
| `CAP-05` | Trace access, blood, dialysate, replacement, PBP, effluent, and return paths on the enabled circuit.      | Machine and circuit operation  |
| `CAP-06` | Distinguish prescribed therapy, actual delivered therapy, and the effects of interruption/downtime.       | Monitoring and reassessment    |
| `CAP-07` | Distinguish machine patient-fluid-removal from whole-patient fluid balance and simulated tolerance.       | Monitoring and reassessment    |
| `CAP-08` | Interpret access, filter, return, effluent, TMP, and filter-drop patterns at the current operating point. | Safety and troubleshooting     |
| `CAP-09` | Use a cause-first alarm sequence; do not equate acknowledgement with correction.                          | Safety and troubleshooting     |
| `CAP-10` | Predict an immediate device/circuit response and a delayed simulated patient response before acting.      | Indication / monitoring        |
| `CAP-11` | Reassess patient, circuit, device, dose, balance, and safety after an intervention or interruption.       | Monitoring and reassessment    |
| `CAP-12` | Communicate the goal, concern, response, unresolved risk, and escalation need across the care team.       | Communication and coordination |
| `CAP-13` | Recognize medication, nutrition, electrolyte, acid-base, temperature, and filter-life consequences.       | Monitoring / communication     |
| `CAP-14` | Frame anticoagulation, citrate/calcium, stopping, blood return, liberation, and transition within policy. | Safety / communication         |

## 3. Pilot case-to-capability map

`Introduced` means the case exposes the concept. `Observed` means the deterministic workflow records
a relevant learner action or reassessment. `Scored` means the current Practice outcome uses that
evidence. None of these labels means independently validated competency.

| Capability | `CRRT-04`                      | `CRRT-10`            | `CRRT-13`                      | Pilot evidence boundary                                 |
| ---------- | ------------------------------ | -------------------- | ------------------------------ | ------------------------------------------------------- |
| `CAP-01`   | Observed/scored                | Observed/scored      | Observed/scored                | Five-field prediction and goal domain                   |
| `CAP-02`   | Introduced                     | Not assessed         | Not assessed                   | Full mechanism lab deferred                             |
| `CAP-03`   | Observed/scored                | Introduced           | Not assessed                   | CVVHD-only draft prescription surface                   |
| `CAP-04`   | Observed/scored                | Not assessed         | Not assessed                   | Pilot setup subset; set/config review pending           |
| `CAP-05`   | Introduced                     | Introduced           | Observed                       | Original circuit/text summary; full orientation pending |
| `CAP-06`   | Observed/scored                | Observed             | Observed                       | Engine dose/downtime state, not clinical target         |
| `CAP-07`   | Introduced                     | Observed/scored      | Not assessed                   | Synthetic whole-patient ledger                          |
| `CAP-08`   | Not assessed                   | Not assessed         | Observed/scored                | Synthetic pressure calibration, no universal limits     |
| `CAP-09`   | Introduced                     | Introduced           | Observed/scored                | Exact device alarm mapping remains pending              |
| `CAP-10`   | Observed/scored                | Observed/scored      | Observed/scored                | Prediction commitment before action                     |
| `CAP-11`   | Observed/scored                | Observed/scored      | Observed/scored                | Required reassessment before debrief                    |
| `CAP-12`   | Introduced/scored by case path | Observed/scored      | Introduced/scored by case path | Synthetic coordination choices                          |
| `CAP-13`   | Limited introduction           | Limited introduction | Not assessed                   | Full medication/nutrition content deferred              |
| `CAP-14`   | Not assessed                   | Not assessed         | Escalation introduced          | Citrate, blood return, liberation remain disabled       |

## 4. Role-lens expectations

The underlying scenario and safety truth remain identical across roles. These expectations are
emphasis guides, not scope-of-practice assignments.

| Capability group                             | Prescriber lens                                              | Operator lens                                                   | Integrated lens                                                 |
| -------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------- |
| Goal and modality (`CAP-01`-`03`)            | Define goal, modality, prescription, and adjustment trigger. | Verify clear/order-complete inputs and escalate discrepancies.  | Reconcile goal, order, device entry, and delivery.              |
| Setup/circuit (`CAP-04`-`05`)                | Understand readiness dependencies and consequences.          | Execute enabled checks and identify line/circuit state.         | Cross-check readiness and communicate mismatches.               |
| Delivery/balance (`CAP-06`-`07`)             | Interpret delivered dose and whole-patient balance.          | Track downtime, machine PFR, inputs/outputs, and device events. | Coordinate changes against tolerance and shared goals.          |
| Pressure/alarm (`CAP-08`-`09`)               | Interpret clinical consequence and escalation need.          | Inspect the affected domain and correct enabled causes safely.  | Link device response, circuit cause, patient state, escalation. |
| Prediction/reassessment (`CAP-10`-`11`)      | State expected endpoint and decision trigger.                | Predict immediate device response and verify restoration.       | Reassess all domains and update the plan.                       |
| Communication/system effects (`CAP-12`-`14`) | Coordinate multi-disciplinary plan and unresolved risk.      | Report delivery, interruptions, observations, and escalation.   | Maintain a shared mental model and closed-loop handoff.         |

## 5. Evidence model

Each assessed capability must be supported by all applicable evidence types:

| Evidence type               | Required evidence                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| Prediction                  | Immutable five-field commitment made before controls unlock.                                           |
| Action                      | Stable allowlisted action IDs and deterministic state transitions.                                     |
| Physiologic/device endpoint | Source-mapped, bounded engine conditions rather than exact-match answer keys.                          |
| Reassessment                | Required stable reassessment IDs completed after an intervention.                                      |
| Alternative path            | Explicit reviewed path that reaches acceptable safety/physiologic endpoints.                           |
| Critical-error status       | Separate from numeric score; source-mapped, consequential, independently reviewed, and path-tested.    |
| Debrief                     | Goal, prediction, timeline, causal chain, trends, missed/complete actions, alternatives, and transfer. |
| Version record              | Engine, content, schema, device profile, deterministic seed, case, pathway, role, and attempt.         |

The pilot does not retain free-text reasoning, detailed action logs, trend arrays, PHI, real patient
data, or screenshots in CRRT progress or analytics.

## 6. Practice rubric interpretation

| Domain                         | Maximum | Capability emphasis                              |
| ------------------------------ | ------: | ------------------------------------------------ |
| Indication and treatment goal  |      15 | `CAP-01`, `CAP-10`                               |
| Modality and prescription      |      20 | `CAP-02`, `CAP-03`                               |
| Machine and circuit operation  |      20 | `CAP-04`, `CAP-05`, `CAP-06`                     |
| Safety and troubleshooting     |      20 | `CAP-08`, `CAP-09`, `CAP-14`                     |
| Monitoring and reassessment    |      15 | `CAP-06`, `CAP-07`, `CAP-10`, `CAP-11`, `CAP-13` |
| Communication and coordination |      10 | `CAP-12`, `CAP-14`                               |

A score is interpretable only for the exact synthetic case, engine/content/profile versions, and
review state. The same score across different cases or versions is not evidence of equivalent
clinical ability. Hint deductions are formative and bounded. A critical safety error can invalidate
a future Mastery attempt regardless of numeric score, but the critical-error rules themselves remain
pending until approved.

## 7. Full-curriculum coverage plan

| Station  | Primary capabilities                                                    | Gate                                            |
| -------- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| 1        | `CAP-01`, `CAP-02`, `CAP-10`, `CAP-12`                                  | Phase 7 plus clinical source/review             |
| 2        | `CAP-02`, `CAP-03`, `CAP-06`, `CAP-10`, `CAP-11`                        | Phase 7 plus device/profile review              |
| 3        | `CAP-04`, `CAP-05`, `CAP-09`, `CAP-12`, `CAP-14`                        | Phase 7; anticoagulation content protocol-gated |
| 4        | `CAP-06`, `CAP-07`, `CAP-11`, `CAP-12`, `CAP-13`                        | Phase 7 plus specialty review where applicable  |
| 5        | `CAP-05`, `CAP-08`, `CAP-09`, `CAP-11`, `CAP-12`                        | Phase 7 plus detailed device alarm review       |
| 6        | `CAP-06`, `CAP-09`, `CAP-11`, `CAP-13`, `CAP-14`                        | Phase 7; citrate content local-protocol-gated   |
| Transfer | Same canonical clinical capabilities through a separate device workflow | Phase 8 and Prismaflex review                   |

Pharmacist review is required before medication-clearance content is activated. Nutrition specialist
review is required before nutrition/electrolyte teaching is activated. A versioned local protocol is
required before an actionable citrate-calcium pathway can exist.

## 8. Human decisions and approvals still required

- [ ] Name the clinical reviewers and record their scope and disposition.
- [ ] Name the PrisMax-trained device reviewer and record the exact target configuration.
- [ ] Define the intended learner roles and whether the organization seeks any local competency use.
- [ ] Define the supervised assessment that must accompany or follow the simulator.
- [ ] Approve or reject each capability-to-case mapping and scoring interpretation.
- [ ] Adjudicate every critical-error candidate and accepted alternative.
- [ ] Approve accessibility, localization, privacy/telemetry, entitlement, and publication decisions.
- [ ] Define retraining, remediation, reassessment, and version-change policy if competency use is ever pursued.

Until those decisions are complete, the only allowed claim is that a learner completed a synthetic
educational case or received a formative Practice score. No certificate or UI copy may state or
imply independent competence.
