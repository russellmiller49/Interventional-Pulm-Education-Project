# Baxter CRRT curriculum

The source registry retains all 18 runnable cases. `curriculum.ts` is the presentation curation
layer and does not delete or reorder source definitions.

## Learn

The pathway carries the recommended novice progression. Nine conceptual steps sit on eight
sections: `crrt-prescription-dosing` holds both prescription construction and prescribed-versus-
delivered dose, which is the split the staged builder inside it makes visible.

| #   | Section id                          | Progression step                                                 | Notes                                                                |
| --- | ----------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | `crrt-indications-modality`         | treatment trajectory                                             | Where a novice begins                                                |
| 2   | `crrt-circuit-pressures`            | universal circuit                                                | Embeds the circuit/console figures and the Pressure Localization Lab |
| 3   | `crrt-solute-transport`             | transport mechanisms                                             |                                                                      |
| 4   | `crrt-prescription-dosing`          | prescription construction, then prescribed versus delivered dose | Embeds the Staged Prescription Builder                               |
| 5   | `crrt-alarms-troubleshooting`       | pressure localization                                            |                                                                      |
| 6   | `crrt-anticoagulation`              | citrate                                                          | Embeds the citrate mechanism walk and the four-way comparison        |
| 7   | `crrt-fluid-liberation`             | fluid management                                                 |                                                                      |
| 8   | `crrt-pressure-profile-integration` | integration                                                      | Capstone; reuses every earlier reading                               |

Localization precedes citrate: a learner who cannot yet name a place on the circuit has no way to
read a citrate result as belonging to the circuit rather than to the patient. Section ids, activity
ids, routes, storage keys, progress payloads, scoring, content version, and publication status are
unchanged by that reorder; the `application` ordinals in the shared activity catalog moved with the
pathway because `validateCriticalCareLearningPathways` requires a pathway to visit a stage in
ascending `stageOrder`.

Nothing gates. Prerequisites are advisory, every section stays reachable by URL, and the front door
states where to begin, what is assumed, what is practised, and that finishing the pathway qualifies
nobody to run CRRT independently.

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

The only interactive concept labs are `LAB-PRESCRIPTION` (the Staged Prescription Builder, in
section 4) and `LAB-PRESSURE-LOCALIZATION` (in section 2). Transport, pre/post-dilution, and
fluid-ledger teaching points live in lesson prose and in the builder's third step rather than in
separate tools.

The Staged Prescription Builder asks three questions in order — what job the prescription has to do,
which flows do that job, and what those flows predict — and the learner can move between them in
either direction without losing state. Its third step mounts the same universal circuit and the same
fluid ledger used everywhere else in the module, so there is one circuit and one ledger, not two.

The citrate section in section 6 walks the mechanism using the citrate terms already authored on the
circuit, then separates four questions that are routinely collapsed: insufficient citrate effect,
inadequate calcium replacement, citrate accumulation, and citrate-related alkalosis. Every field is
typed as either following from the circuit or held open where the registered source set does not
carry the answer; see `docs/baxter-crrt/evidence.md` for that boundary and what an SME source
expansion would resolve.

## Assess

`MASTERY-PRISMAX-01` masks the `CRRT-16` identity until debrief, offers no hints, starts clean, and
requires score ≥80, no critical error, and completed reassessment. Completing optional cases or
drills is not required to unlock it. The result is educational completion, not certification.
