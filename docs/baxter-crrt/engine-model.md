# Baxter CRRT engine model

Document status: Phase 2 draft implementation; pure engine disconnected from React  
Clinical validation status: pending  
Device validation status: pending

## 1. Design goals

The engine must be:

- Deterministic and replayable.
- Transparent enough for educator inspection.
- Strict about units and impossible values.
- Shared across device adapters and learning pathways.
- Directionally coherent across patient, access, circuit, device, delivered therapy, and alarms.
- Stable under both small and large time advances.
- Explicit about the boundary between device-displayed calculations and educational clinical models.
- Incapable of generating patient-specific recommendations.

The engine is an educational causal model, not a validated digital twin.

## 2. System boundaries

The feature should keep five layers separate:

| Layer            | Owns                                                                                                | Must not own                                       |
| ---------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Authored content | Cases, options, interventions, goals, source IDs, accepted paths, review status                     | State mutation or calculations                     |
| Shared engine    | Patient, access, circuit, fluid, solute, filter, time, alarms, outcomes                             | Device navigation vocabulary or React state        |
| Device adapter   | Setup sequence, control validation, displayed calculations, screen vocabulary, device alarm mapping | Independent patient physiology                     |
| Selectors        | Read-only derived display models and scoring inputs                                                 | Side effects                                       |
| React UI         | Accessible controls and presentation of selected state                                              | Clinical correctness, formulas, or hidden mutation |

Planned data flow:

    Zod-validated authored case
              |
              v
    normalized runtime definition
              |
              v
    initial state + device adapter + protocol profile
              |
              v
    pure reducer action
              |
              v
    fixed-step shared engine
              |
              +--> device display selector
              +--> circuit and patient selectors
              +--> alarms and outcome selector
              +--> bounded trend sample

## 3. Version identifiers

Every simulation state, replay, and case result must include:

- schemaVersion
- engineVersion
- contentVersion
- deviceProfileVersion
- protocolProfileVersion or null
- deterministic seed

The detailed local progress DTO follows the narrower privacy allowlist from the coding brief. It may
store its own progress schema version, device, role, completed IDs, attempts, best scores,
critical-error status, hint use, last station, engine version, and content version. It does not store
the deterministic seed, protocol profile, live state, trend data, or action sequence. A result may
be reproduced only from a separate in-memory or explicitly exported development replay record, not
from learner progress.

Changing clinical equations, device calculations, authored cases, or protocol values requires the
relevant version to change. Replays with mismatched versions must not be presented as equivalent.

## 4. Top-level state

The state will include:

- Simulation metadata: time, seed, experience, role, device, versions.
- Patient state.
- Access state.
- Circuit state.
- Prescription state.
- Device state.
- Delivered-therapy state.
- Scenario state.
- Active derived alarms.
- Intervention records.
- Bounded trend samples.

The state must be serializable for deterministic tests, but full state and trends must not be stored
as learner progress or transmitted as analytics.

## 5. Core domain state

### 5.1 Patient

Only variables that support the curriculum should be modeled:

- Simulated body weight and hematocrit.
- Intravascular reserve, total fluid overload, vascular refill capacity, and urine/residual
  clearance.
- Heart rate, arterial pressure, vasopressor abstraction, and temperature.
- Sodium, potassium, bicarbonate/pH abstraction, small-solute marker, creatinine trend display,
  phosphate, magnesium, systemic ionized calcium, and optional total calcium/glucose.

All values use explicit units in property names or branded unit types. Every public display includes
the simulated label.

### 5.2 Access

- Catheter descriptor and nominal flow capacity.
- Access and return resistance.
- Position dependence.
- Recirculation fraction.
- Partial thrombus burden.
- Kink/clamp state.
- Connection state.

Access resistance is a causal input to the pressure model. A diagnostic label should be a selector
or authored hidden mechanism, not the pressure model itself.

### 5.3 Circuit

- Modality.
- Blood, PBP, dialysate, pre-replacement, post-replacement, and PFR flows.
- Anticoagulation concept.
- Filter permeability, fouling, and clot burden.
- Air and blood-leak states.
- Bags and scales.
- Access, filter, return, and effluent pressures.
- TMP and filter pressure drop.
- Deaeration state where the selected profile requires it.

### 5.4 Delivered therapy

- Prescribed effluent rate and weight-normalized dose.
- Cumulative actual effluent.
- Delivered dose over the active charting window.
- Cumulative downtime and reason breakdown.
- Cumulative machine PFR.
- Whole-patient cumulative balance.
- Filtration fraction and optional reviewed post-filter hematocrit.
- Filter-life/fouling indicators.
- Treatment time and set time.

## 6. Unit discipline

The engine must never silently mix mL/min and mL/h.

Required helpers include:

- mL/min to mL/h and the inverse.
- L to mL and the inverse.
- seconds, minutes, and hours.
- rate integration over a time step.
- mass/concentration conversion for every modeled solute.
- weight-normalized rate.

Every nontrivial function documents input/output units. Invalid denominators, nonfinite values,
negative concentrations, impossible hematocrit, and unsupported combinations return typed
validation errors or fail at the authored-content boundary. Runtime values are bounded only where
the bound has a documented educational reason.

## 7. Deterministic time model

### 7.1 Clock

The public reducer accepts requested time advances such as:

- Real-time tick.
- 1 minute.
- 15 minutes.
- 1 hour.
- 6 hours.
- Next scheduled event or laboratory result.

The engine integrates through a 60-second canonical internal substep selected for Phase 2.
Large requests are decomposed into the same substeps so that outcome does not depend on which
button the learner used.

### 7.2 Randomness

Direct Math.random is prohibited. The clinical seed is a deterministic device-independent hash of
case ID, pathway, and attempt. A scenario branch is selected only by an authored initial condition
or the learner's explicit actions; random generation never chooses the correct branch. The branch
identifier becomes part of the replay record after it is known.

A separate cosmetic/device seed may derive from the clinical seed plus device ID, but it can affect
only nonclinical presentation. It cannot alter patient, circuit, delivered therapy, correctness,
thresholds, scoring, or event timing. This separation preserves cross-device outcome equivalence.

### 7.3 Equivalence

Tests must compare:

- Sixty 1-minute advances.
- Four 15-minute advances.
- One 1-hour advance.

Patient, circuit, delivered dose, balance, fouling, and alarm state must remain within documented
tolerances. Accumulated volumes should use conservation-grade tolerances tighter than illustrative
patient variables.

Phase 2 declares the following test tolerances:

- Integrated volume: 0.000001 mL.
- Other continuous model values: 0.000000001 in the value's documented unit or fraction.

## 8. Calculation modules

### 8.1 Flow accounting

The shared engine stores canonical flows. A device profile supplies the supported terms, ranges,
increments, and display calculations.

For the source-mapped PrisMax profile, AW8035 p217 describes:

    Qeff = Qpfr + Qpbp + Qrep + Qdial + Qsyr + Qmakeup

This is a device-target calculation and must not be generalized to every adapter. Each term has an
explicit unit and enabled/disabled profile state. Makeup remains separate from prescribed effluent
and delivered patient removal.

### 8.2 Prescribed and delivered dose

At minimum:

    prescribedEffluentDose = prescribedEffluentRate / simulatedWeight

    deliveredDoseForWindow =
      actualIntegratedEffluentVolume / activeWindowHours / simulatedWeight

Downtime reduces actual delivery. The model must never substitute prescribed dose for delivered
dose after an interruption.

The educational effective-clearance estimate may incorporate modality, saturation/sieving
abstraction, and predilution only after clinical sources and reviewers approve the relevant
constants.

### 8.3 Whole-patient fluid balance

Track independently:

    machinePfrVolume = integral of actual machine PFR

    externalInputVolume =
      maintenance + medication carriers + nutrition + blood products + boluses + other inputs

    externalOutputVolume =
      urine + drains + other outputs

    wholePatientNetBalance =
      externalInputVolume - externalOutputVolume - machinePfrVolume + unintendedDeviceNetGain

An alarm pause or bag change changes delivered machine PFR without deleting external patient inputs.
This distinction is central to CRRT-10 and must be visible in selectors and tests.

### 8.4 Plasma flow and filtration fraction

Plasma flow must use explicit blood-flow and hematocrit units. Predilution enters the filter inlet
flow and concentration before filtration-fraction and clearance estimates are calculated.

The PrisMax and Prismaflex manuals contain device-displayed filtration-fraction equations, but one
AW8035 sign expression is unresolved. Phase 2 implements typed disabled gates for MATH-PM-004 and
MATH-PM-006; neither expression can execute until the matching conflict is adjudicated.

Required directional invariants:

- Increasing post-filter ultrafiltration raises filtration fraction when other inputs are fixed.
- Increasing predilution lowers hemoconcentration/filtration fraction for the same nominal
  replacement rate.
- Predilution lowers effective solute concentration entering the filter for the same nominal
  replacement rate.
- Denominators remain positive and finite.

### 8.5 Pressure model

Pressure is derived from flow, resistance, hydrostatic/profile terms, and connection state:

    pressure change is directionally proportional to flow times resistance

The pilot does not need a patient-specific vascular model. It needs source-reviewed recognizable
patterns:

- Increasing access resistance or blood flow makes central-venous access pressure more negative.
- An access obstruction differs from an access disconnection.
- Filter pressure is positive and rises with pre-/in-filter resistance.
- Return pressure rises with return-line or return-catheter resistance.
- Return disconnection produces a fall and an adapter-specific safety response.
- Effluent obstruction alters effluent pressure and TMP.
- Fouling can raise TMP and/or filter pressure drop depending on where resistance accumulates.

Device-displayed calculations belong in adapters. For example, AW8035 p217 describes a PrisMax TMP
expression with a device correction, while G5036003 section 3:7 documents Prismaflex filter-drop
behavior and its own correction. Alarm operating points and limits are never universal normals.

### 8.6 Bag and scale model

Each enabled circuit fluid has:

- Profile scale assignment.
- Starting volume/weight.
- Integrated actual pump flow.
- Bag-empty/full state.
- Connection and scale-open state.
- External interference or tension state where a scenario requires it.

Conservation checks compare integrated pump volumes with measured bag changes. Incorrect bag
placement, open scale, tension, or obstruction may create a profile-specific gain/loss or flow alarm.
Acknowledgement does not alter the underlying bag state.

### 8.7 Filter model

Fouling and clot progression respond directionally to:

- Time.
- Filtration fraction.
- Blood-flow interruption.
- Low effective blood flow.
- Access dysfunction and recirculation.
- Hematocrit.
- Anticoagulation state.
- Authored procoagulant burden.

Mechanical causes must remain correctable independently of anticoagulation. No case may imply that
every filter problem is solved by increasing anticoagulation.

### 8.8 Solute and acid-base model

Use a transparent bounded mass-balance model:

    nextMass =
      currentMass + productionOrInput - residualKidneyRemoval - deliveredCrrtRemoval

    nextConcentration = nextMass / currentDistributionVolume

Start with potassium, bicarbonate/pH abstraction, urea or another small-solute marker, phosphate,
and magnesium. Requirements:

- Machine setting changes alter clearance immediately.
- Concentrations change over longer time constants.
- Production/input continues during therapy.
- Residual renal clearance can be nonzero.
- Delivered rather than prescribed therapy drives change.
- Large time advances remain stable and nonnegative.

Numeric constants and success targets remain pending until approved clinical sources are added.

### 8.9 Hemodynamic tolerance

Patient response to net removal depends on intravascular reserve, refill capacity, current net
removal, scenario modifiers, and time. The model should provide a directional teaching response,
not predict a real patient's blood pressure.

Increasing PFR beyond the simulated refill/tolerance state should worsen a bounded hemodynamic
abstraction unless offset by an authored intervention. The case must allow reviewed alternatives
such as reducing removal, pausing, reassessing inputs, and escalating team communication rather than
enforcing one exact rate.

### 8.10 Citrate model

Phase 2 defines disabled state for:

- Citrate delivery.
- Post-filter ionized calcium.
- Citrate removal/metabolism abstraction.
- Calcium replacement.
- Systemic ionized and total calcium.
- Total-calcium ratio.
- Acid-base and sodium trends.
- Calcium requirement and filter-clot trend.

Without LOCAL-CRRT-PROTOCOL, no dose, target, adjustment, or active case is allowed.

## 9. Immediate and delayed response ordering

One reducer action may produce different time domains.

Immediate:

- Pending/committed control state.
- Pump, clamp, connection, and flow state.
- Pressure response.
- Derived alarm.
- Bag/scale validation.

Delayed:

- Cumulative PFR and whole-patient balance.
- Delivered dose.
- Solute and acid-base changes.
- Temperature.
- Filter fouling/clotting.
- Hemodynamic tolerance.
- Citrate/calcium trends when an approved protocol exists.

The debrief must preserve this causal ordering.

## 10. Reducer and action model

The reducer should use an exhaustive discriminated action union. Expected categories:

- Load/reset case, pathway, role, or device.
- Commit prediction.
- Navigate device procedure/screen.
- Enter, validate, and commit prescription.
- Complete setup/prime/review/connect step.
- Inspect access/circuit/bag/scale.
- Apply bedside or device intervention.
- Acknowledge alarm.
- Correct underlying cause.
- Resume, pause, stop, or end.
- Advance time.
- Request hint.
- Record reassessment.
- Reveal debrief after allowed conditions.

Practice controls remain locked until a valid prediction commitment. Learn help state is not part of
the Practice initial state. Mastery cannot inherit hints or progress state.

## 11. Device adapter contract

Each adapter should provide:

    readonly id and immutable profile
    createInitialDeviceState
    getSetupSteps
    validatePrescription
    reduceDeviceAction
    mapEngineAlarm
    selectDisplayModel

The adapter may:

- Map canonical flows to machine labels and increments.
- Enforce setup/navigation requirements.
- Calculate device-specific displayed terms.
- Determine which pump stops or clamp closes for a derived fault.
- Present device-specific alarm vocabulary and help.

The adapter may not:

- Create a different patient physiology for the same canonical therapy.
- Hide an unsupported feature behind a generic fallback.
- Clear an underlying engine fault merely because the learner acknowledged a display.
- use one device's limits or alarm taxonomy for the other.

## 12. Authored cases and scoring

Source cases pass through strict Zod validation into normalized runtime cases. Cross-record
validators must ensure:

- Exactly CRRT-04, CRRT-10, and CRRT-13 during the pilot.
- All option, intervention, requirement, alternative, hint, source, and review-status references
  resolve.
- Every case has a deterministic safe path.
- Accepted alternatives and unsafe paths are explicitly tested.
- Every critical error has a source record and pending/reviewed/approved state.
- Every success condition has explicit units and bounded metrics.
- Unsupported devices, therapies, sets, protocols, or actions fail closed.

Scoring consumes normalized outcome metrics and source-reviewed rules. React components cannot
assign correctness.

## 13. Selectors

Selectors should derive:

- Current workbench display model.
- Prescription summary.
- Prescribed and delivered dose.
- PFR and whole-patient ledger.
- Pressure pattern and accessible text equivalent.
- Alarm list and correction state.
- Patient/trend summary.
- Required reassessments.
- Score and critical-error state.
- Debrief causal chain.

Selectors are pure and memoized where profiling shows benefit.

## 14. Development calibration panel

In development only, an educator panel may show:

- Hidden access/return/filter/effluent resistance terms.
- Flow and unit conversions.
- Pressure equations and device correction terms.
- Actual versus prescribed integrated volumes.
- Solute mass-balance terms.
- Fouling/clot progression terms.
- Seed, versions, event queue, and active source IDs.

The panel must be excluded from production rendering and bundles where practical. A test must assert
its absence when NODE_ENV is production.

## 15. Required invariant and path tests

### Unit and conservation

- Unit conversions are reversible within tolerance.
- Fluid and solute mass are conserved aside from explicit sources/sinks.
- No silent NaN, infinity, negative volume, or negative concentration.
- Bag changes do not create or destroy fluid.
- Bag depletion and effluent filling match integrated actual pump flows.
- Prescribed and delivered dose diverge correctly during documented downtime.
- TMP and filter-pressure-drop calculations match the selected adapter's reviewed formulas.

### Directionality

- More dialysate increases bounded small-solute clearance.
- More post-filter ultrafiltration increases filtration fraction.
- Predilution lowers filtration fraction and effective inlet concentration.
- Downtime lowers delivered dose.
- Excess net removal relative to simulated tolerance worsens hemodynamic state.
- Access and return obstruction create different patterns.
- Fouling/clotting progression responds directionally to time, flow interruption, filtration
  fraction, access dysfunction, hematocrit, anticoagulation state, and scenario burden.

### Alarm state

- Acknowledgement does not clear the cause.
- Correcting the cause clears the derived alarm according to adapter rules.
- Setup/prime/review gates prevent premature connection.
- Unsupported therapy/set combinations fail closed.
- Alarm generation, priority mapping, acknowledgement, cause correction, clearing, repeat behavior,
  and escalation are tested independently.
- Stop/end, return/discard decision state, and clean reload behavior follow the selected adapter.

### Isolation and replay

- Learn and Practice start from clean equivalent clinical states.
- Learn cues never persist into Practice.
- Same version, seed, branch, and actions replay exactly.
- Time-advance methods are equivalent within declared tolerance.
- Progress parsing and migration preserve only allowlisted fields and fail safely.
- Every pilot case has a complete safe path, each accepted alternative, unsafe paths, explicit
  critical errors, required reassessment, and a deterministic debrief result.
- Eventually, equivalent PrisMax and Prismaflex canonical prescriptions produce equivalent patient
  outcomes while retaining different device navigation.

### UI and component verification

- Current repository Jest and Testing Library conventions cover prediction locks, clean mode
  isolation, keyboard controls, screen-reader summaries, live alarm announcements, source status,
  and analytics privacy.
- Storybook stories cover implemented workbench/device states if the repository's Storybook
  workflow remains active for the feature.
- Browser QA covers desktop, tablet, five-tab mobile layout, 320-pixel width, 200-percent zoom,
  reduced motion, focus order, and contained keyboard scrolling for wide diagrams.

### Privacy

- Progress serialization contains only allowlisted summary fields.
- Client analytics builders and server-side CRRT event validation reject free text, trends, labs,
  action logs, and unknown payload keys.

## 16. Unresolved design inputs

The following stay configurable or disabled:

- Exact market and installed PrisMax program version.
- Set, accessory, Auto Effluent, and solution inventory.
- Flow ranges/increments for the selected local configuration.
- Systemic anticoagulation approaches.
- All citrate/calcium behavior.
- Clinical model constants, thresholds, and success targets.
- The two ambiguous AW8035 formula passages recorded in the source matrix.

The Phase 2 implementation does not convert these missing inputs into defaults. Caller-supplied
test calibration is explicit, source-labeled as synthetic, review-pending, and isolated from the
learner UI.
