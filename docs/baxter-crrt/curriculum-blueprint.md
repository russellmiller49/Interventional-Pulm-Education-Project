# Baxter CRRT curriculum blueprint

Status: `pending review` — curriculum architecture record, not an authorization to release content

Learner-active draft scope: Orientation plus Learn and Practice for `CRRT-04`, `CRRT-10`, and
`CRRT-13`

Reviewer-only candidates: isolated, non-progress runtime fixtures for `CRRT-01`, `CRRT-02`,
`CRRT-05`, `CRRT-06`, `CRRT-07`, `CRRT-11`, and `CRRT-15`

Learner-deferred scope: all 15 nonpilot cases, rapid safety drills, Mastery, citrate-calcium, and
Prismaflex

## 1. Purpose and safety boundary

This blueprint defines the intended adult ICU CRRT learning sequence and stable curriculum IDs. It
does not approve the clinical correctness of a case, establish a local protocol, award competency,
or authorize publication. Every active pilot case is synthetic, deterministic, source-mapped, and
pending clinical and device review.

The module remains professional education only. It is not a clinical device, validated digital
twin, certification program, patient-specific treatment guide, substitute for the current
operator's manual, or substitute for supervised hands-on training and local policy.

## 2. Learning architecture

### 2.1 Persistent reasoning loop

Every case must make the learner traverse the same causal sequence:

**Read → Define → Select → Predict → Run → Reassess → Reflect**

| Phase    | Required learner work                                                                 |
| -------- | ------------------------------------------------------------------------------------- |
| Read     | Integrate patient, access, circuit, device, and delivered-treatment findings.         |
| Define   | State the exact solute, acid-base, fluid, temperature, or safety goal and time frame. |
| Select   | Choose a modality, prescription, device action, bedside action, or escalation.        |
| Predict  | Commit to the expected immediate device/circuit and delayed patient response.         |
| Run      | Execute the plan through the enabled device or bedside interface.                     |
| Reassess | Check treatment delivery, pressure, dose, balance, and patient response.              |
| Reflect  | Explain the causal chain, accepted alternatives, and next adjustment trigger.         |

Learn and Practice use the same deterministic engine and case fixtures. In both active case
pathways, treatment controls remain locked until the learner commits to the primary goal,
mechanism, planned control/intervention, expected response, and required reassessment.

### 2.2 Pathway progression

| Pathway     | Instructional contract                                                                                              | Current state            |
| ----------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Orientation | Unscored device/circuit familiarization without a deteriorating patient or case score                               | Draft pilot available    |
| Learn       | Guided, unscored worked cases with bounded hints, prediction, immediate/delayed response, reassessment, and debrief | Three draft cases active |
| Practice    | Independent scored cases, clean state, prediction lock, accepted alternatives, hint penalty, and causal debrief     | Three draft cases active |
| Mastery     | Unseen multi-hit capstones, no hints, at least 80%, no critical safety error, and required reassessment             | Locked; Phase 7 gate     |

The presence of a Practice score does not imply clinical competence. Mastery remains unavailable
until the pilot has the required clinical, device, accessibility, localization, and product
approvals and the unseen capstones have their own review evidence.

### 2.3 Role lenses

| Role lens  | Primary emphasis                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------ |
| Prescriber | Goal definition, modality/prescription, treatment delivery, patient response, and escalation.    |
| Operator   | Setup, line/circuit inspection, machine response, alarms, troubleshooting, and communication.    |
| Integrated | Shared mental model across prescription, bedside operation, delivery, reassessment, and handoff. |

Role lenses may change emphasis but may not change the underlying patient/circuit truth or make an
unsafe action acceptable. Local decisions about which roles may receive supervised competency
credit remain unresolved and outside this simulator.

## 3. Curriculum registry and activation gates

The IDs below are reserved to prevent drift. `Draft active` means available only in the
authenticated/unlisted module with all review states pending. `Phase 7` means no authored learner
case may activate until the three-case pilot is formally accepted. `Protocol gated` additionally
requires a versioned approved local protocol.

| Station | Case ID   | Intended focus                                                                   | Activation state |
| ------- | --------- | -------------------------------------------------------------------------------- | ---------------- |
| 1       | `CRRT-01` | Septic shock, AKI, and fluid-overload goal definition                            | Phase 7          |
| 1       | `CRRT-02` | Refractory hyperkalemia/acidemia with instability                                | Phase 7          |
| 1       | `CRRT-03` | Controlled solute/sodium management in acute brain or liver failure              | Phase 7          |
| 2       | `CRRT-04` | Build a CVVHD prescription for a defined small-solute/acid-base goal             | Draft active     |
| 2       | `CRRT-05` | CVVH with pre- versus post-replacement tradeoffs                                 | Phase 7          |
| 2       | `CRRT-06` | CVVHDF with prescribed-versus-delivered dose                                     | Phase 7          |
| 3       | `CRRT-07` | Incorrect weight or hematocrit entry                                             | Phase 7          |
| 3       | `CRRT-08` | Set, bag, solution, line, prime, and review verification                         | Phase 7          |
| 3       | `CRRT-09` | Anticoagulation setup using an approved protocol profile                         | Protocol gated   |
| 4       | `CRRT-10` | Machine PFR versus whole-patient net balance                                     | Draft active     |
| 4       | `CRRT-11` | Hemodynamic intolerance of net removal                                           | Phase 7          |
| 4       | `CRRT-12` | Electrolyte, temperature, medication, or nutrition consequences                  | Phase 7          |
| 5       | `CRRT-13` | Increasingly negative access-pressure pattern                                    | Draft active     |
| 5       | `CRRT-14` | High return pressure versus return disconnection                                 | Phase 7          |
| 5       | `CRRT-15` | Rising TMP/filter pressure drop from distinct causes                             | Phase 7          |
| 6       | `CRRT-16` | Recurrent filter loss: access, filtration fraction, downtime, or anticoagulation | Phase 7          |
| 6       | `CRRT-17` | Citrate/calcium problem using an approved local profile                          | Protocol gated   |
| 6       | `CRRT-18` | Renal recovery, discontinuation, and transition                                  | Phase 7          |

## 4. Active three-case pilot

### 4.1 `CRRT-04` — Build a CVVHD prescription

- Define the simulated small-solute and acid-base goal.
- Select CVVHD and use the implemented BFR-first setup sequence.
- Distinguish prescribed from delivered dose when downtime occurs.
- Predict immediate flow changes and delayed laboratory direction.
- Reassess actual delivery before completing the causal debrief.

### 4.2 `CRRT-10` — PFR versus whole-patient balance

- Keep machine patient-fluid-removal separate from whole-patient balance.
- Reconcile scenario-defined inputs, outputs, urine, and downtime.
- Respond to simulated tolerance rather than chase one isolated number.
- Use an accepted team-coordination path where it reaches the same safe endpoint.
- Reassess balance and hemodynamic response.

### 4.3 `CRRT-13` — Worsening access-pressure pattern

- Interpret pressure direction and trend at the current operating point.
- Distinguish positional/mechanical access limitation from other mechanisms.
- Correct the cause before indiscriminate alarm acknowledgement or treatment escalation.
- Confirm restoration of flow, pressure pattern, and treatment delivery.
- Preserve escalation boundaries and supervised-practice transfer language.

The exact starting values, bands, model coefficients, scores, unsafe-action triggers, and
critical-error candidates in all three cases are synthetic and remain pending review.

## 5. Rapid safety drills

After pilot approval, separate short drills may address air detection, blood leak, gain/loss,
bag/scale errors, power interruption, wrong solution, and blood-return decisions. Each drill must:

1. Use a device-adapter-specific event rather than a generic copied alarm.
2. Enforce assess → inspect → correct cause → resume when safe → reassess.
3. Keep acknowledgement distinct from correction.
4. Include a tested safe path, unsafe path, critical-error adjudication, and causal debrief.
5. Receive clinical and device review before learner activation.

No rapid safety drill is active in the current pilot.

## 6. Case authoring and assessment contract

Every future case requires:

- Strict authored and normalized runtime schema validation.
- Explicit compatible device/profile versions and role lenses.
- Source references for every consequential claim and value.
- Synthetic calibration labeled as such until independent approval.
- At least one safe path and at least one explicit accepted alternative.
- Unsafe actions and critical-error candidates that cannot punish an accepted alternative.
- Immediate device/circuit effects separated from delayed patient effects.
- Required reassessment and deterministic causal debrief.
- Clean Learn/Practice/Mastery state isolation.
- Privacy-safe progress and aggregate analytics only.
- Automated safe, alternative, unsafe, critical, replay, and UI-path tests.

Practice uses the fixed 100-point draft rubric:

| Domain                         | Points |
| ------------------------------ | -----: |
| Indication and treatment goal  |     15 |
| Modality and prescription      |     20 |
| Machine and circuit operation  |     20 |
| Safety and troubleshooting     |     20 |
| Monitoring and reassessment    |     15 |
| Communication and coordination |     10 |

Scores must reward safety and physiologic endpoints rather than one exact preferred setting.
Critical-error status is reported separately. Learn remains unscored.

## 7. Required instructional tools and sequencing

| Tool                         | Intended station use                                     | Current gate                                         |
| ---------------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| Prescription Workbench       | Stations 2-4                                             | Pilot concepts implemented; full tool review pending |
| Fluid Balance Ledger         | Station 4                                                | Pilot response view active; review pending           |
| Pressure Localization Lab    | Station 5                                                | Pilot pressure engine active; full lab Phase 7       |
| Transport Mechanism Lab      | Stations 1-2                                             | Phase 7                                              |
| Pre/post-dilution experiment | Stations 2 and 6                                         | Phase 7                                              |
| Citrate-Calcium Dashboard    | Station 6                                                | Disabled until local protocol approval               |
| Prismaflex transfer practice | After PrisMax curriculum and separate adapter validation | Phase 8                                              |

## 8. Accessibility and localization contract

Every active surface must provide keyboard operation, logical focus order, visible focus, 44-pixel
touch targets, text/icon safety cues, accessible circuit/pressure/trend summaries, reduced-motion
behavior, 200% zoom usability, and no page-level overflow at 320 pixels. A global safety indication
must remain available when mobile tabs hide the affected workspace panel.

Reviewed English is the only authoritative curriculum language until clinical translation review
is complete. Non-English routes must explicitly identify the reviewed-English fallback; they must
not silently machine-translate unreviewed clinical content.

## 9. Advancement gates

### Phase 7 may start only after

- The exact pilot revision is accepted by a CRRT-experienced nephrologist, critical care physician,
  CRRT nurse educator, and PrisMax-trained device reviewer.
- Accessibility, localization, privacy/telemetry, entitlement, and product dispositions are recorded.
- Consequential findings are resolved and affected source records reset/re-reviewed as needed.
- The product owner documents the meaning of pilot acceptance; it is not publication approval.

### Phase 8 may start only after

- The reviewed PrisMax v1 curriculum is stable.
- The target Prismaflex market, software, sets, accessories, and local configuration are documented.
- A Prismaflex-trained reviewer is assigned.
- The separate adapter/UI and cross-device equivalence protocol are approved for implementation.

### Publication requires

All applicable clinical, device, accessibility, localization, product, privacy, entitlement, and
release approvals for the exact code/content/source versions. This blueprint itself supplies none
of those approvals.
