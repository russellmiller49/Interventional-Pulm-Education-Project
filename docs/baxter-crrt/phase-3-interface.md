# Phase 3 PrisMax interface acceptance contract

- Document status: Phase 3 design and acceptance contract
- Implementation status: implemented and repository/browser verification passed
- Clinical review: pending
- PrisMax device review: pending
- Publication status: authenticated, unlisted, draft

This document defines the authorized boundary for the Phase 3 PrisMax educational interface. It is
not evidence that every surface described below has been implemented or accepted. Implementation
must be checked against this contract, the engine boundary, and the exact source revision before the
phase can be approved.

The interface is an independent educational facsimile. It is not a clinical device, validated
digital twin, certification program, patient-specific treatment guide, or substitute for the
current operator's manual, local protocol, supervised hands-on training, or multidisciplinary
clinical judgment. It is not manufactured, sponsored, validated, or endorsed by Baxter.

## 1. Authorized Phase 3 scope

Phase 3 is limited to the functional interface surfaces needed later by the three pilot cases:

- An original PrisMax educational console.
- The eight-step setup sequence.
- A case-free CVVHD prescription surface with Blood Flow Rate (BFR), dialysate, and Patient Fluid
  Removal (PFR) controls.
- A therapy Operations display.
- An original circuit schematic.
- Bags and the four base front scales.
- Access, filter, return, effluent, filter-pressure-drop, and TMP display locations.
- An alarm-window surface.
- A stop surface and a separate clean simulator reset.

React components must remain presentational. Clinical values, derived pressures, dose, alarm
generation, and state-transition correctness belong to the pure engine and PrisMax adapter.

## 2. Case-free equipment-checkout state

Phase 3 must open in a neutral equipment-checkout state rather than loading a patient case. The
acceptance contract is:

- No authored or runtime pilot case is imported.
- No patient identifier, free text, real patient data, clinical target, or recommendation is
  present.
- BFR, dialysate, and PFR begin blank and are entered by the user.
- No clinical default, normal value, target, minimum, maximum, increment, or alarm threshold is
  inferred from the interface.
- Until the adapter supplies reviewed display data, operations, pressure, dose, and bag values are
  shown as unavailable rather than fabricated.
- Reset returns to a newly constructed neutral equipment-checkout state. It must not retain setup
  completion, staged prescription values, alarms, simulated time, or other prior-session state.

This state exists to validate device navigation and state isolation. It is not a fourth pilot case
and must not be represented as a patient treatment.

## 3. Setup sequence

The procedure rail must represent these eight PrisMax steps in order:

1. Patient
2. Therapy
3. Prescription
4. Sets
5. Fluids
6. Prime
7. Review
8. Connect Patient

The active step is visually distinct, completed steps can show a check mark, and unavailable steps
are disabled rather than merely hidden. The sequence must not imply that a real patient has been
connected. Patient identifiers are not part of the Phase 3 equipment-checkout surface.

The gate represented by the sequence is structural: review precedes Connect Patient, and setup is
not treated as complete while required interface fields remain blank. Exact set detection,
compatibility, priming behavior, connection instructions, and patient-facing safety rules remain
pending device and clinical review.

## 4. CVVHD pilot prescription controls

The Phase 3 prescription surface is intentionally narrow:

| Control                     | Unit label | Phase 3 behavior               |
| --------------------------- | ---------- | ------------------------------ |
| Blood Flow Rate (BFR)       | mL/min     | Entered first; initially blank |
| Dialysate                   | mL/h       | User-entered; initially blank  |
| Patient Fluid Removal (PFR) | mL/h       | User-entered; initially blank  |

No range, increment, default, validation threshold, or target is authorized in this phase. The
manual states that BFR is entered first and also discusses a general value above 10 mL/min, but it
requires the minimum appropriate to the selected filter. Without an approved set profile, the
general number must not become active validation.

PBP, replacement, syringe, anticoagulation, PFR catch-up, return-disconnect limits, gain/loss
limits, solution composition, and set-specific controls are outside this Phase 3 prescription
surface. Their visual device locations may be present as inactive orientation elements when needed
to make the original facsimile understandable.

## 5. Operations surface

The Operations surface may reserve locations for:

- Current therapy and operating mode.
- Flow displays and active/inactive pump state.
- Access, return, TMP, and filter-pressure-drop bars.
- Filter and effluent pressure readouts.
- PFR for the current and previous display period.
- Prescribed and delivered dose.
- A chronological message center.
- An original schematic of the active flow path.

These are display contracts, not permission to create values. A value remains blank or unavailable
until supplied by the shared engine through the reviewed PrisMax adapter. Color bands may identify
semantic states supplied by that adapter, but the component must not invent normal, advisory, or
warning boundaries.

## 6. Circuit, pumps, bags, scales, and pressure nodes

The original circuit artwork may show the following source-backed topology:

- Blood: access connection to access line and blood pump, then the pre-filter line and filter,
  deaeration chamber, return line, air detector, return clamp, and return connection.
- Dialysate: dialysate bag and pump to the filter fluid compartment.
- Effluent: filter fluid outlet through the effluent pressure location and blood-leak detector to
  the effluent bag.
- PBP and replacement locations may be visible but inactive; citrate/calcium must not appear.

The device facade may identify the blood, PBP, dialysate/replacement-2, replacement, syringe, and
effluent pump locations without claiming that every pump or therapy is enabled.

The four base front scales use the manual's color and shape vocabulary:

| Scale       | Color and shape |
| ----------- | --------------- |
| Effluent    | Yellow circle   |
| PBP         | White triangle  |
| Dialysate   | Green square    |
| Replacement | Purple octagon  |

Bag contents, capacity, weight, time remaining, and depletion/filling values must remain unavailable
unless supplied by reviewed adapter state. Auto Effluent is not part of the base four-scale pilot
surface.

Pressure locations are access, filter, return, and effluent. The Operations display may also reserve
filter pressure drop and TMP locations. The manual's general directional descriptions may support
orientation copy, but no numeric pressure, operating point, band, or alarm threshold is authorized
for a case-free Phase 3 state.

## 7. Alarm surface

The alarm-window contract may include:

- Alarm name and technical code.
- Priority styling supplied by the adapter.
- A problem description and cause-first corrective-action area.
- A related circuit/component highlight.
- A real-time pressure location for a pressure-related alarm.
- Dock, silence, and context-specific action locations where the mapped alarm supports them.
- A global alarm indication that remains perceivable when the detailed window is closed or another
  responsive surface is active.

Acknowledgement, docking, or silence must not clear an underlying fault. Phase 3 does not authorize
fabricated alarms, alarm priorities, stop/clamp reactions, reset timing, corrective actions, or
automatic restart behavior. Those behaviors require an explicit engine-alarm-to-device-alarm map
and device review.

## 8. Stop and clean reset

The source-backed PrisMax Stop surface distinguishes Resume Treatment, End Treatment/Discard Set,
blood recirculation, and saline recirculation, and the manual states that entering End mode is not
reversible. Phase 3 may represent this navigation vocabulary, but it does not authorize execution of
blood return, blood recirculation, saline recirculation, or policy-dependent discard decisions.

The simulator's clean reset is a separate education control outside the device facsimile. It creates
a new case-free equipment-checkout state and must not be labeled Same Patient. It must not imply a
real device power cycle, patient disconnection, blood return, set unload, or clinical end-treatment
procedure.

## 9. Confirmed source map

The authoritative device source for this phase is _PrisMax Operator's Manual_, AW8035 Rev B
JUN2019, program version 2.XX. For the cited numbered pages, the PDF page is generally one page
greater than the printed manual page.

| Claim or surface                                        | Printed manual page(s) | PDF page(s) |
| ------------------------------------------------------- | ---------------------: | ----------: |
| Procedure and Operations screen regions                 |                   9-11 |       10-12 |
| Start screen and eight-step setup sequence              |                  45-47 |       46-48 |
| Therapy and prescription entry workflow                 |                  49-51 |       50-52 |
| Sets, fluids, prime, review, and connect sequence       |                  51-65 |       52-66 |
| Operations display and message center                   |                  66-67 |       67-68 |
| Flow-change interaction                                 |                  70-74 |       71-75 |
| Pressure and treatment display locations                |                     75 |          76 |
| Stop, End, return, and unload vocabulary                |                  76-82 |       77-83 |
| Alarm monitoring, priorities, and common window anatomy |                 93-100 |      94-101 |
| Blood and fluid circuit topology                        |                236-237 |     237-238 |
| Pressure monitoring concepts and locations              |                238-241 |     239-242 |
| Pump/scale fluid-management concepts                    |                241-244 |     242-245 |
| Pump inventory and loader                               |                252-253 |     253-254 |
| Pressure sensors, detectors, valves, and return clamp   |                256-260 |     257-261 |
| Four front scales and color/shape vocabulary            |                261-262 |     262-263 |
| Therapy availability of selectable flows                |                    300 |         301 |
| Displayed flow-rate categories by therapy               |                310-311 |     311-312 |

The product boundary also comes from _Baxter CRRT Learn & Practice Simulator - Detailed
implementation instructions for an AI coding assistant_: device adapters in section 7, cause-first
alarm behavior in section 11, original responsive interface requirements in section 12, the three
pilot surface needs in section 14, and the Phase 3 stop boundary in section 22.

No manual screenshot, manufacturer photograph, logo, figure, or copied artwork may be committed.
All device and circuit visuals must be original CSS/SVG work with accessible text equivalents.

## 10. Explicit exclusions

Phase 3 does not include:

- CRRT-04, CRRT-10, CRRT-13, or any other patient case.
- Clinical starting values, targets, recommendations, safe paths, critical errors, or debriefs.
- Learn/Practice prediction locks, hints, scoring, reasoning ribbon, reassessment, analytics, or
  causal debriefs.
- Patient physiology, laboratory trends, whole-patient fluid inputs/outputs, or case time
  advancement in the React layer.
- Regional citrate-calcium controls or dosing.
- Prismaflex interface or adapter work.
- Service, administrator, connectivity, remote-control, or manufacturer configuration surfaces.
- A claim of device equivalence, training completion, certification, or publication approval.

## 11. Unresolved conflicts and review gates

The following remain unresolved and must fail closed:

1. The exact enabled therapy, set, solution, accessory, pump, and scale configuration for the target
   market has not been approved.
2. Flow ranges, increments, and filter-specific BFR minima require a reviewed set/device profile.
3. Printed p300 lists replacement flow as available in CVVHD, while the displayed-data table on
   printed p310 omits CVVHD from replacement flow. Replacement remains inactive for the pilot.
4. Exact pressure operating-point bands, alarm thresholds, trend rules, and reset behavior require
   adapter-level source mapping and device review.
5. Alarm-specific priority and pump/clamp consequences remain pending. Common alarm-window anatomy
   does not establish those behaviors.
6. Same Patient availability is described as 12 hours on printed p45 and 24 hours on printed p78.
   Phase 3 must not encode either time limit.
7. Blood return, blood/saline recirculation, set discard, bag reuse, and escalation decisions depend
   on alarm state and local clinical policy and are not active pilot behaviors.
8. Any numeric case, bag, pressure, dose, or timing value introduced later must be synthetic,
   source-mapped, marked unreviewed, and tested before use.

All source records remain pending until a named PrisMax-trained reviewer checks the exact manual
revision, market/configuration, navigation, setup, controls, pumps/clamps, pressure behavior, alarms,
bag/scale behavior, stop/end behavior, exclusions, and tests. Clinical values and cases additionally
require the designated clinical review. Until those approvals, the route remains authenticated,
unlisted, draft, and noindex.
