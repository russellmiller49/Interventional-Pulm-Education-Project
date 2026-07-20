# Baxter CRRT curriculum

The source registry retains all 18 runnable cases. `curriculum.ts` is the presentation curation
layer and does not delete or reorder source definitions.

## Learn

1. CRRT indications and modality selection
2. Solute and water transport
3. Prescription and delivered dose — embeds the Prescription Workbench
4. Circuit anatomy and pressure localization — embeds circuit/console figures and the Pressure Lab
5. Anticoagulation and citrate safety
6. Alarms and cause-first troubleshooting
7. Fluid management and liberation

All lesson prose is marked `reviewStatus: pending` for owner clinical/editorial review. A collapsed
advanced note addresses transfer from prior Prismaflex training without activating a second device.

## Practice curation

| Station                                            | Core cases           | Optional cases       |
| -------------------------------------------------- | -------------------- | -------------------- |
| 1 · Define the goal                                | `CRRT-01`, `CRRT-02` | `CRRT-03`            |
| 2 · Build the prescription                         | `CRRT-04`, `CRRT-05` | `CRRT-06`            |
| 3 · Set up and start safely                        | `CRRT-08`            | `CRRT-07`, `CRRT-09` |
| 4 · Monitor dose and fluid                         | `CRRT-11`            | `CRRT-10`, `CRRT-12` |
| 5 · Read pressures and troubleshoot                | `CRRT-13`, `CRRT-15` | `CRRT-14`            |
| 6 · Anticoagulation, complications, and liberation | `CRRT-17`, `CRRT-18` | —                    |

`CRRT-16` appears in neither list. It is loaded directly by the assessment manifest only.

## Case loop

Each Practice case starts clean. The learner reads and defines the problem, selects a mechanism and
control, commits an expected response and reassessment plan, acts in the PrisMax simulation,
observes time-dependent behavior, reassesses, and receives a causal debrief. Unsafe paths and
critical errors are educational scoring rules, not universal treatment thresholds.

## Safety drills and labs

The five drills are `DRILL-AIR`, `DRILL-BLOOD-LEAK`, `DRILL-GAIN-LOSS`, `DRILL-BAG-SCALE`, and
`DRILL-WRONG-SOLUTION`. Acknowledging a signal is separated from identifying and correcting its
cause; every drill ends with delivery and patient reassessment.

The only interactive concept labs are `LAB-PRESCRIPTION` and `LAB-PRESSURE-LOCALIZATION`, embedded
inside Learn lessons 3 and 4. Transport, pre/post-dilution, fluid-ledger, and citrate teaching points
were incorporated into lesson prose instead of separate tools.

## Assess

`MASTERY-PRISMAX-01` masks the `CRRT-16` identity until debrief, offers no hints, starts clean, and
requires score ≥80, no critical error, and completed reassessment. Completing optional cases or
drills is not required to unlock it. The result is educational completion, not certification.
