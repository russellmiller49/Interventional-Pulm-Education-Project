# Baxter CRRT Learn & Practice simulator product requirements

Document status: Phase 0 draft  
Review status: pending clinical, device, accessibility, localization, and product review  
Initial device profile: PrisMax AW8035 Rev B JUN2019, program 2.XX  
Initial population: adult ICU patients receiving simulated CRRT  
Publication state: authenticated, unlisted draft

## 1. Product statement

Build an independent educational simulator that synchronizes four domains:

1. Device operation.
2. Blood and fluid circuit behavior.
3. Delivered therapy and simulated patient response.
4. Learner clinical reasoning and team communication.

The product is not a static chapter, screenshot tour, validated digital twin, treatment calculator,
certification program, or patient-specific guide. Learner actions must alter deterministic device,
circuit, delivered-therapy, and patient state. The same engine must support guided Learn cases and
independent Practice cases without embedding clinical logic in React components.

## 2. Required persistent disclaimer

The following statement, or a clinically and legally reviewed equivalent, must remain visible in the
implemented module:

> Professional education only. This is not a clinical device, validated digital twin, certification
> program, patient-specific treatment guide, or substitute for the current operator's manual, local
> protocol, supervised hands-on training, or multidisciplinary clinical judgment. This independent
> educational module is not manufactured, sponsored, validated, or endorsed by Baxter.

Every physiologic value must be visibly labeled simulated. The UI must not recommend a specific
prescription for a real patient or represent a device setting as universally appropriate.

## 3. Users and role lenses

The simulator will support three educational role lenses over one shared scenario:

- Prescriber: indication, goals, modality, prescription, expected consequences, and reassessment.
- Bedside operator: setup, machine controls, circuit inspection, alarms, safe interruption, and
  escalation.
- Integrated team: joins prescription, operation, physiology, communication, and handoff.

Role lenses may change emphasis and scoring weights. They must not create inconsistent patient or
circuit truth.

No local competency credit is implied until the institution defines eligible roles, supervised
requirements, reviewers, and a separate approval record.

## 4. Learning pathways

### 4.1 Orientation

Unscored familiarization using the real device adapter and circuit vocabulary:

- Identify pumps, scales, pressure sensors, clamps, detectors, sample sites, and bags.
- Trace blood, PBP, dialysate, replacement, calcium scaffold, and effluent pathways.
- Distinguish Procedure screens from the Operations screen.
- Rehearse setup, prime, review, connect, history, alarm, and stop concepts without patient
  deterioration.

### 4.2 Learn

Guided and unscored worked examples using the same engine as Practice:

- Direct attention without supplying the final answer.
- Require prediction before the learner acts.
- Explain the causal purpose of the action.
- Show immediate device/circuit response.
- Advance time to show delayed delivered-therapy and patient response.
- Require reassessment.
- End with a causal debrief and transfer question.

### 4.3 Practice

Independent and scored:

- Load a fresh deterministic state.
- Remove educator overlays and answer-revealing labels.
- Lock treatment controls until prediction commitment is complete.
- Support more than one source-reviewed acceptable path.
- Penalize hints without turning one numeric setting into the only correct answer.
- Weight safety, causal reasoning, delivered therapy, and patient endpoints above exact matching.

### 4.4 Mastery

Unavailable in the three-case pilot. A later reviewed release may add unseen multi-hit capstones with:

- No revealing title or hints.
- At least 80 percent.
- No critical safety error.
- Required reassessments completed.
- Fresh state with no inherited Learn or Practice help.
- Separate device-specific and cross-device transfer mastery.

## 5. Required reasoning contract

The workbench must display and enforce:

**Read → Define → Select → Predict → Run → Reassess → Reflect**

The learner must reason across the patient, access, circuit, machine, delivered dose, and team. In
Practice, machine and treatment controls stay locked until the learner commits to:

- Primary goal.
- Suspected mechanism.
- Planned control or intervention.
- Expected direction of immediate and delayed response.
- Required reassessment.

Acknowledging an alarm is never equivalent to correcting its cause.

## 6. Version 1 scope

### 6.1 Included

- Adult ICU CRRT using synthetic patient cases.
- Original PrisMax educational facsimile based on AW8035 Rev B, program 2.XX.
- Shared clinical, circuit, and delivered-therapy engine.
- SCUF, CVVH, CVVHD, and CVVHDF.
- No-anticoagulation and reviewed systemic-anticoagulation concepts.
- Disabled regional citrate/calcium extension points pending local protocol.
- Indication and goal framing.
- Prescription workbench.
- Prescribed versus delivered dose.
- Machine patient-fluid-removal rate versus whole-patient net balance.
- Access, filter, return, and effluent pressure reasoning.
- Access dysfunction, filter fouling/clotting, bag/scale events, alarms, interruptions, and downtime.
- Directional simulated electrolyte, acid-base, temperature, nutrition, medication, and fluid
  consequences only when source-mapped and reviewed.
- Treatment stopping, return-blood decision framing, liberation, and transition concepts.
- Role lenses, Orientation, Learn, Practice, local non-PHI detailed progress, authenticated
  structured telemetry for aggregate reporting, accessibility, and reviewed-English fallback.

### 6.2 Excluded from active v1 simulation

- Pediatric CRRT.
- Therapeutic plasma exchange, hemoperfusion, MARS, adsorptive filters, or toxin-specific therapy.
- ECMO-CRRT integration.
- Catheter insertion technique.
- Prescriptive medication dosing tables.
- A universal citrate protocol.
- Manufacturer service, administrator, password, network, or remote-control surfaces.
- A claim of certification or independent operator competence.
- Prismaflex learner controls before the accepted PrisMax pilot.

## 7. Phase-gated delivery

| Phase | Authorized outcome                                                               |
| ----- | -------------------------------------------------------------------------------- |
| 0     | Audit, source policy/matrix, engine design, requirements, and risk register      |
| 1     | Draft localized route and empty responsive feature scaffold                      |
| 2     | Pure typed engine, schemas, reducer, calculations, progress, and tests           |
| 3     | Functional PrisMax pilot interface for only the needed setup/operations surfaces |
| 4     | Learn and Practice reasoning, scoring, hints, analytics, and debrief             |
| 5     | Three source-mapped pilot cases and tested paths                                 |
| 6     | Accessibility, responsive QA, validation package, and formal review stop         |
| 7     | Remaining PrisMax curriculum only after pilot approval                           |
| 8     | Prismaflex adapter only after stable PrisMax v1                                  |

Each phase requires a file list, command/test results, unresolved questions, and explicit approval
before the next major phase.

## 8. Three-case vertical slice

### 8.1 CRRT-04 — Build a CVVHD prescription

The learner must:

- Define a small-solute and acid-base goal.
- Select CVVHD.
- Set and review blood, dialysate, and patient-fluid-removal flows through the device workflow.
- Predict prescribed dose and delayed laboratory direction.
- Recognize that interruptions reduce delivered dose.
- Reassess device delivery and the simulated patient.

Required surfaces: Prescription Workbench, setup screens, operations display, dose calculation,
prediction lock, time advancement, Learn, Practice, and causal debrief.

### 8.2 CRRT-10 — Machine PFR versus whole-patient balance

The learner must:

- Explain why a simulated patient remains net positive despite machine fluid removal.
- Reconcile maintenance fluids, medication carriers, nutrition, boluses, blood products, urine,
  drains, other outputs, downtime, and machine PFR.
- Adjust or escalate according to simulated tolerance rather than chase one number.
- Reassess hemodynamics and whole-patient balance.

Required surfaces: fluid model, Fluid Balance Ledger, patient tolerance, accepted alternatives, and
whole-patient reassessment.

### 8.3 CRRT-13 — Worsening access-pressure pattern

The learner must:

- Read access pressure as a trend, not an isolated universal threshold.
- Distinguish positional obstruction, line kink/clamp, reduced intravascular reserve, and catheter
  dysfunction.
- Correct a mechanical cause before changing alarm limits or escalating anticoagulation.
- Confirm restored flow, pressure pattern, and treatment delivery.

Required surfaces: pressure model, access state, circuit inspection, alarm behavior, positioning
intervention, clean reset, and scored troubleshooting.

All case numbers and thresholds are synthetic and remain reviewStatus: pending until the required
clinical and device reviewers sign them.

## 9. Functional requirements

### 9.1 Shared simulation state

State must include version identifiers, simulated time, deterministic seed, experience, device, role,
patient, access, circuit, prescription, device state, delivered therapy, scenario, alarms,
interventions, and bounded trends.

### 9.2 Device profiles and adapters

Profiles must be explicit and immutable:

- prismax-aw8035-2xx
- prismaflex-g5036003-6xx

The clinical engine determines physiology and circuit consequences. The adapter determines setup
steps, machine vocabulary, control workflow, displayed calculations, alarm presentation, and
device-specific safety responses.

PrisMax is first. Prismaflex cannot begin until the PrisMax vertical slice and engine tests are
accepted.

### 9.3 Prescription Workbench

Inputs:

- Simulated weight and hematocrit.
- Blood flow.
- PBP, dialysate, pre-replacement, and post-replacement flows.
- Patient fluid removal.
- Anticoagulation concept.
- Versioned solution profile.

Outputs:

- Prescribed effluent rate and weight-normalized dose.
- Estimated effective clearance with stated model limitations.
- Filtration fraction and predilution effect.
- Circuit ultrafiltration and patient net removal.
- Expected bag duration and daily fluid throughput.
- Source-linked warnings and review status.

### 9.4 Fluid Balance Ledger

Display side by side:

1. Machine PFR setting.
2. Circuit fluid flows.
3. Unintended device gain/loss and downtime.
4. Whole-patient cumulative balance.

The learner must be able to reconcile hidden scenario inputs without equating machine PFR with the
whole-patient result.

### 9.5 Pressure Localization Lab

Allow a source-reviewed obstruction or disconnection to be placed at:

- Access catheter or access line.
- Filter.
- Return line.
- Effluent line.

The learner predicts the directional pressure pattern before reveal. Pressure alarms derive from
resistance, flow, device operating point, and adapter behavior rather than scripted answer labels.

### 9.6 Transport Mechanism Lab

Use an original accessible visualization for diffusion, convection, ultrafiltration, adsorption,
countercurrent blood/dialysate flow, molecule-size abstractions, and modality-specific effluent
composition. It must teach mechanisms without implying patient-specific clearance.

### 9.7 Citrate-Calcium Dashboard

Scaffold linked citrate, filter, calcium, acid-base, sodium, and clotting domains, but keep all
actionable dosing controls disabled until a versioned local protocol and reviewer approval exist.

### 9.8 Alarm workflow

Every exercise must enforce:

1. Assess the simulated patient and immediate safety.
2. Identify what stopped or clamped.
3. Inspect the corresponding access, line, filter, bag, scale, or detector.
4. Correct the cause.
5. Resume or reset only when safe.
6. Reassess delivery and patient consequences.

Initial alarm families may include access, return, return disconnection, filter/TMP trend, effluent,
air, blood leak, bag/scale, gain-loss, leak, power, and repeated unresolved alarms. Exact alarm names,
priorities, thresholds, and automated responses are adapter-specific and remain pending device review.

### 9.9 Pre- versus post-dilution experiment

Provide a standalone original experiment using the same reviewed engine calculations as the
Prescription Workbench. Changing the pre/post replacement split must visibly and accessibly alter:

- Filter-inlet concentration.
- Filtration fraction.
- Estimated effective clearance.
- Fouling/clotting tendency.

The debrief must teach the tradeoff without declaring one universally best approach. Disputed or
unreviewed formula terms remain disabled and visibly pending.

### 9.10 Workbench layout

Desktop and tablet use a three-column workspace:

- Left — patient and reasoning: case information, reasoning phase, prediction commitment, goals,
  interventions, Learn hints, and communication tasks.
- Center — device: functional educational facsimile, screen navigation, pumps, scales, clamps,
  detectors, setup/therapy controls, and alarm window.
- Right — circuit and response: dynamic circuit, pressure nodes, patient monitor, laboratory trends,
  fluid ledger, delivered dose/downtime, access, and filter state.

A bottom drawer provides prescription summary, history, events, pressure trends, dose trends,
equations/explanations, and sources.

Mobile uses exactly five named tabs:

1. Case.
2. Machine.
3. Circuit.
4. Patient/trends.
5. Debrief.

Critical alarms and safety state remain globally visible and accessible regardless of the active tab.
Wide device/circuit graphics may use labeled, focusable, keyboard-scrollable internal viewports but
must not create page-level horizontal overflow.

### 9.11 Full curriculum registry after pilot approval

The registry is reserved now so IDs cannot drift. Only CRRT-04, CRRT-10, and CRRT-13 are authored
and active during the pilot.

**Station 1 — Why CRRT? Define the goal**

- CRRT-01: septic shock, AKI, and fluid overload.
- CRRT-02: refractory hyperkalemia/acidemia with instability.
- CRRT-03: controlled solute and sodium management in acute brain or liver failure.

**Station 2 — Build the prescription**

- CRRT-04: CVVHD for small-solute clearance.
- CRRT-05: CVVH with pre/post replacement tradeoffs.
- CRRT-06: CVVHDF with prescribed-versus-delivered dose.

**Station 3 — Set up and start safely**

- CRRT-07: incorrect weight or hematocrit entry.
- CRRT-08: set, bag, solution, line, prime, and review verification.
- CRRT-09: anticoagulation setup using an approved protocol profile.

**Station 4 — Monitor patient, dose, and fluid**

- CRRT-10: PFR versus whole-patient net balance.
- CRRT-11: hemodynamic intolerance of net removal.
- CRRT-12: electrolyte, temperature, medication, or nutritional consequences.

**Station 5 — Read pressures and troubleshoot**

- CRRT-13: increasingly negative access pressure.
- CRRT-14: high return pressure versus return disconnection.
- CRRT-15: rising TMP/filter pressure drop from clotting, clogging, or effluent obstruction.

**Station 6 — Anticoagulation, complications, and liberation**

- CRRT-16: recurrent filter loss from access, filtration fraction, downtime, or anticoagulation.
- CRRT-17: citrate/calcium problem using a reviewed local profile.
- CRRT-18: renal recovery, discontinuation, and transition.

The remaining cases cannot activate until the pilot is accepted and their sources, models, safe
paths, alternatives, critical errors, and reviewers are complete. CRRT-17 additionally requires the
approved local citrate/calcium protocol.

### 9.12 Rapid safety drills

After pilot approval, add separate short drills for:

- Air detection.
- Blood leak.
- Gain/loss error.
- Bag/scale error.
- Power interruption.
- Wrong solution.
- Blood-return decision.

Each drill uses the cause-first alarm sequence, adapter-specific behavior, explicit reassessment,
and pending review status until independently approved.

## 10. Scoring and debrief

Practice uses a 100-point framework:

| Domain                         | Points |
| ------------------------------ | -----: |
| Indication and treatment goal  |     15 |
| Modality and prescription      |     20 |
| Machine and circuit operation  |     20 |
| Safety and troubleshooting     |     20 |
| Monitoring and reassessment    |     15 |
| Communication and coordination |     10 |

Accepted alternatives must be explicit and tested. Critical errors must be clinically consequential,
source-mapped, independently reviewed, and unable to punish an accepted alternative.

The debrief must show:

- Stated goal and prediction.
- Action timeline.
- Actual causal chain.
- Pressure, dose, laboratory, and fluid trends with accessible summaries.
- Required actions completed or missed.
- Critical errors.
- Accepted alternatives.
- Machine-navigation learning point.
- Transfer point to supervised clinical practice.

## 11. Privacy, progress, and analytics

### 11.1 Detailed local CRRT progress

Store only:

- Version.
- Device and role lens.
- Completed lesson/case IDs.
- Attempts and best scores.
- Critical-error status.
- Hint counts.
- Last station.
- Engine/content versions.

Do not store PHI, real patient data, free-text reasoning, full trend arrays, action logs, or
screenshots.

The canonical detailed CRRT progress record remains in local storage for the pilot and is not
replicated as a server progress DTO. Discrete allowlisted event summaries from section 11.2 are a
separate telemetry carveout. Separately, the existing authenticated site telemetry stores per-user
module percentage, completed sections, session timing, and route/module identifiers in server data.
Neither mechanism authorizes full prediction text, action histories, critical-error histories,
laboratory arrays, trends, or replays.

### 11.2 Authenticated telemetry and aggregate reporting

Allowed CRRT event properties include stable lesson/case IDs, pathway, device, role, one-attempt
score, critical-error count, hint count, reassessment completion, and bounded elapsed-time metrics.
These discrete summary values are the approved telemetry carveout described by the coding brief;
they do not make the server the canonical CRRT progress store. Events are associated with the
authenticated user and may be reported in aggregate; they are not anonymous aggregate records at
ingestion.

Do not send free text, simulated laboratory arrays, detailed trends, or action logs. Client-side
typed builders are insufficient because the current analytics API accepts an arbitrary eventPayload
record. Before Phase 4 sends any CRRT interaction or outcome payload, the implementation must add
server-side CRRT event schemas or sanitization that rejects non-allowlisted keys and values. Tests
must cover both the builder and API boundary.

Before pilot access expands, the product owner must document telemetry retention, access, export,
and deletion expectations. Detailed CRRT outcome sync requires a separate privacy and product
decision.

The route must be registered in resolveSiteModuleId with English, Spanish, and Simplified Chinese
path tests; otherwise the existing global session tracker does not start.

## 12. Accessibility and localization

Before release:

- Full keyboard operation and logical tab order.
- Visible focus.
- Minimum 44-pixel touch targets.
- Text/icon alarm priority in addition to color.
- Priority-appropriate live alarm announcements that avoid duplicate or excessive speech.
- Screen-reader circuit and pressure descriptions.
- Accessible current-value and trend summaries.
- Reduced-motion suppression for pumps, tubing, fluid, and alarm flashing.
- No audio-only information.
- Usability at 200 percent zoom.
- No horizontal page overflow at 320 pixels.
- Wide circuit/device graphics, when unavoidable, contained inside a labeled, focusable,
  keyboard-scrollable viewport rather than overflowing the page.
- Responsive tablet and tabbed mobile workspaces.
- Global accessible alarm status even when its mobile tab is inactive.
- Reviewed-English fallback for every non-English route until clinical translation review.

## 13. Publication and access gate

The route remains draft and noindex until all applicable reviewers sign. Access states are explicit:

| State               | Production access and listing behavior                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Draft               | Existing guard permits site administrators; other authenticated users receive not found                           |
| Authenticated pilot | Requires a separately approved CRRT entitlement/cohort; no feature flag may substitute for entitlement            |
| Published           | Requires a separate decision about authentication and whether unlisted status remains permanent or status-derived |

The route must never be added to the current public-unlisted exception merely to obtain an
X-Robots-Tag header. Phase 1 must verify noindex, nofollow, and noarchive metadata while preserving
authentication.

Required reviewers:

- CRRT-experienced nephrologist.
- Critical care physician.
- CRRT nurse educator.
- PrisMax-trained device reviewer.
- Prismaflex-trained reviewer before that adapter is released.
- Pharmacist and nutrition specialist for affected content.
- Accessibility reviewer.
- Localization reviewer.
- Product owner/publication approver.

No unresolved numeric threshold, device action, critical-error rule, citrate control, or
market-specific feature may be active in a published pathway.

## 14. Human decisions required before affected work

- Release market/configuration and installed PrisMax software.
- Enabled sets, accessories, Auto Effluent, solutions, and anticoagulation approaches.
- Local citrate/calcium protocol.
- Pilot entitlements and reviewer names.
- Competency-credit policy.
- Whether detailed CRRT outcomes remain local-only or sync beyond the site's existing per-user
  module percentage, sections, and time.
- Telemetry retention/access policy.
- Whether unlisted status is permanent or publication-state-derived.

These decisions are requirements, not values that the implementation may infer.
