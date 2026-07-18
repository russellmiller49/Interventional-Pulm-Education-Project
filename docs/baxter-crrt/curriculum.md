# Baxter CRRT v1 curriculum

The learner registry contains exactly 18 cases. All are runnable in Learn and Practice; `CRRT-16`
also supplies the masked PrisMax Mastery fixture. Review metadata is visible to SMEs but does not
affect availability.

| Station                       | Case      | Focus                                                                         |
| ----------------------------- | --------- | ----------------------------------------------------------------------------- |
| Define the goal               | `CRRT-01` | Septic shock, AKI, and fluid-overload goal definition                         |
| Define the goal               | `CRRT-02` | Hyperkalemia/acidemia with hemodynamic instability                            |
| Define the goal               | `CRRT-03` | Controlled solute trajectory in acute brain or liver failure                  |
| Build the prescription        | `CRRT-04` | CVVHD prescription for a defined solute/acid-base goal                        |
| Build the prescription        | `CRRT-05` | CVVH pre- versus post-replacement tradeoffs                                   |
| Build the prescription        | `CRRT-06` | CVVHDF prescribed-versus-delivered therapy                                    |
| Set up and start              | `CRRT-07` | Incorrect weight or hematocrit entry                                          |
| Set up and start              | `CRRT-08` | Set, bag, solution, line, prime, and review verification                      |
| Set up and start              | `CRRT-09` | Anticoagulation protocol selection and verification; no dosing                |
| Monitor dose and fluid        | `CRRT-10` | Machine removal versus whole-patient fluid balance                            |
| Monitor dose and fluid        | `CRRT-11` | Hemodynamic intolerance of net removal                                        |
| Monitor dose and fluid        | `CRRT-12` | Electrolyte, temperature, medication, and nutrition consequences              |
| Pressures and troubleshooting | `CRRT-13` | Increasingly negative access-pressure pattern                                 |
| Pressures and troubleshooting | `CRRT-14` | High return pressure versus return disconnection                              |
| Pressures and troubleshooting | `CRRT-15` | Rising TMP/filter pressure drop from distinct causes                          |
| Complications and liberation  | `CRRT-16` | Recurrent filter loss across access, filtration, downtime, and policy domains |
| Complications and liberation  | `CRRT-17` | Conceptual citrate-calcium recognition and escalation                         |
| Complications and liberation  | `CRRT-18` | Renal recovery, discontinuation, and transition                               |

## Case contract

Each case begins from a clean deterministic state. The learner reads the whole situation, defines a
goal, selects a mechanism, commits a predicted control/response/reassessment bundle, acts, advances
time, reassesses, and receives a causal debrief. Required paths and accepted alternatives are
tested independently. Unsafe paths exist for feedback; critical-error rules are educational scoring
rules rather than universal clinical thresholds.

## Rapid drills

The seven runnable cause-first drills are `DRILL-AIR`, `DRILL-BLOOD-LEAK`, `DRILL-GAIN-LOSS`,
`DRILL-BAG-SCALE`, `DRILL-POWER`, `DRILL-WRONG-SOLUTION`, and `DRILL-BLOOD-RETURN`.

The shared sequence is: acknowledge the signal, assess patient safety, inspect the relevant
patient/circuit/device domain, verify cause and correction or maintain a safe stopped state, then
reassess delivery and recurrence. Wrong-solution and blood-disposition drills stop and escalate to
the current device instructions and local policy; they never invent a substitution or universal
return/discard instruction.

## Instructional tools

1. `LAB-TRANSPORT` — diffusion, convection, ultrafiltration, adsorption, and flow arrangement.
2. `LAB-PRESCRIPTION` — transparent device calculations and explicitly unavailable expressions.
3. `LAB-PREPOST-DILUTION` — qualitative split-only tradeoffs, with no universally best split.
4. `LAB-PRESSURE-LOCALIZATION` — commit a directional prediction before revealing the pattern.
5. `LAB-FLUID-LEDGER` — reconcile machine removal with all patient inputs and outputs.
6. `LAB-CITRATE-DASHBOARD` — direction-only linked trends, safety checks, reassessment, escalation.

An unresolved calculation disables only that expression. It does not block the rest of its lab.

## Mastery and transfer

`MASTERY-PRISMAX-01` masks the `CRRT-16` identity until debrief, supplies no hints, starts clean,
requires score ≥80, no critical error, and completed reassessment. It is an educational completion
result, not certification.

`TRANSFER-PRISMAX-PRISMAFLEX-01` tests translation of setup goals, calculation context, pressure
localization, fluid accounting, and alarm/stop/end reasoning. It deliberately requires relearning
device-specific controls and makes no claim that the devices are clinically interchangeable.
