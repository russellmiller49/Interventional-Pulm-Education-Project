# MCS flow redesign

Implemented September 13, 2026, on `codex/mcs-flow-redesign`, from `origin/main` at `2b10cb6ae5b2a8b2d1dc3cab1f248cfced1a1983`. The starting task checkout's earlier teaching-repair work was inspected, then a fresh branch was created from the fetched main branch. The reviewed plan reference is the implementation base; no reset to an older revision or changes to another checkout were performed.

## Outcome and design rationale

All nine Learn sections use an MCS-local, typed presentation selection. A single current task contains its instruction, relevant teaching/observations, original action or answer, feedback and continuation. The six presentations are renderer metadata, not routes, tabs, phases or progression IDs. Mechanism comparisons lead with the retained results and action; timing leads with the synchronized arterial/balloon figure; loading work pairs the permitted control with filling and flow; controller orientation teaches quantities individually; patient work leads with the clinical question. Explanations and captures span the task width.

The existing shared StageLayout is retained behind `MCS_TASK_PRESENTATIONS_ENABLED = false`. Shared stage components, defaults and global styles are unchanged. Compact views use ordinary document flow; maps/cutaway figures alone can pan, with keyboard focus and equivalent text. Full monitor, anatomy, history and references remain secondary. A playback button advances one existing engine cardiac cycle; it does not create a second animation clock or task credit. Introduction/reference and captured-observation states pause playback.

The visible chapter headings distinguish shared foundations, IABP, microaxial support, existing durable-LVAD patient assessment and integration. The landing retains one recommended Start/Continue action and puts the complete registry lesson map in an on-demand disclosure. Existing prerequisites and expert direct links remain authoritative; no new locks were added.

Practice now distinguishes **Explore mechanisms** from **Work a clinical case**. The active workbench presents clinical brief, monitor/inspection, optional initial frame, permitted controls, actual response, reassessment and full-width debrief. The case/device selector remains a secondary control and describes its reset semantics. Mobile completion no longer requires anatomy/monitor/controls/workflow tab changes. Studio starts only by explicit selection or an explicit device deep link, has no scenario and earns no case credit. Challenge remains open from the start, retains critical safety interruptions, and defers routine explanation until post-action opt-in or debrief. An opt-in marks the current debrief as assisted even if teaching is subsequently hidden; reset/replay/switch starts a fresh display of assistance status. Existing numeric scoring and stored scores are unchanged; assistance is not a new persisted score field.

## Live task preservation map

The tables below are generated from `buildMcsStageLesson` for every `mcsStageLessonIds` entry. They contain **68 live tasks, in the same order with the same IDs**. `stageLessons.ts` adds presentation metadata only; the three changed introductory instructions remove obsolete pane directions. Broad `lessons.ts` records are not counted as additional mounted tasks.

For every row, the old task interaction is still handled by the same StageHost branch/session. Open/after-prediction is the original phase gate, not a replacement completion rule. Original inspection/action requirements, first responses, structured observations, sorting and transfers remain enforced by `learningSession.ts`. The current task is inside one NowCard; history is under **Task history and lesson map**. The source overlays and full post-commit teaching remain reachable from the same section.

### mcs-foundations-signals — 9 tasks

Prerequisites: None. Starting device: `iabp`. Existing route: `/{locale}/mechanical-circulatory-support/learn?lesson=mcs-foundations-signals`.

| Original ID (unchanged)                | Original work                                    | New presentation     | Original phase gate |
| -------------------------------------- | ------------------------------------------------ | -------------------- | ------------------- |
| `mcs-foundations-signals-orientation`  | Meet the circulation and the balloon (teaching)  | `circulation-reader` | open                |
| `mcs-foundations-signals-walk`         | Walk the loop (walk)                             | `circulation-reader` | open                |
| `mcs-foundations-signals-measurements` | Read each quantity at its source (teaching)      | `circulation-reader` | open                |
| `mcs-foundations-signals-recognize`    | Read the pressure first (identify)               | `circulation-reader` | open                |
| `mcs-foundations-signals-predict`      | Say what the flow account will show (prediction) | `circulation-reader` | open                |
| `mcs-foundations-signals-act`          | Open the three readings in turn (action)         | `circulation-reader` | after-prediction    |
| `mcs-foundations-signals-observe`      | Compare the readings you opened (observe)        | `circulation-reader` | after-prediction    |
| `mcs-foundations-signals-explain`      | Four questions, four separate answers (explain)  | `circulation-reader` | after-prediction    |
| `mcs-foundations-signals-transfer`     | The same patient, back from imaging (transfer)   | `patient-case`       | after-prediction    |

Preserved independent actions: control:inspect-arterial<br>control:inspect-preload<br>control:inspect-device.

Observed signals: Mean arterial pressure (mapMmHg; mm Hg; 0 decimal places; pressure)<br>Wedge pressure (pcwpMmHg; mm Hg; 0 decimal places; pressure)<br>Native contribution (nativeFlowLMin; L/min; 1 decimal places; flow)<br>Displayed device contribution (deviceFlowLMin; L/min; 1 decimal places; device-display)<br>Effective systemic delivery (effectiveSystemicFlowLMin; L/min; 1 decimal places; flow)<br>Simulated mixed venous saturation (svo2Percent; %; 0 decimal places; oxygen-balance).

Observation/reassessment: Hold the mean pressure beside the effective systemic delivery and the mixed venous saturation, and notice that they are not telling you the same thing. Which bedside finding, not on this screen, would you go and look for before deciding whether this circulation is adequate?

Completion contract: Recorded once all three readings have been opened, the prediction and its verdict have been worked through, the before-and-after comparison has been seen, and a transfer answer has been committed. Transfer: `mcs-foundations-signals-transfer-1` — The same patient returns from imaging. The mean pressure still reads as acceptable, but the trace is damped, the extremities are cool, and urine output has fallen.

### mcs-foundations-mechanisms — 8 tasks

Prerequisites: `mcs-foundations-signals`. Starting device: `iabp`. Existing route: `/{locale}/mechanical-circulatory-support/learn?lesson=mcs-foundations-mechanisms`.

| Original ID (unchanged)                        | Original work                                             | New presentation       | Original phase gate |
| ---------------------------------------------- | --------------------------------------------------------- | ---------------------- | ------------------- |
| `mcs-foundations-mechanisms-pathway-reference` | Follow three support pathways (teaching)                  | `mechanism-comparison` | open                |
| `mcs-foundations-mechanisms-walk`              | Walk the loop (walk)                                      | `circulation-reader`   | open                |
| `mcs-foundations-mechanisms-recognize`         | Trace the pathway on the screen (identify)                | `mechanism-comparison` | open                |
| `mcs-foundations-mechanisms-predict`           | Say what changes across the three mechanisms (prediction) | `mechanism-comparison` | open                |
| `mcs-foundations-mechanisms-act`               | Select each mechanism in turn (action)                    | `mechanism-comparison` | after-prediction    |
| `mcs-foundations-mechanisms-observe`           | Compare the three mechanisms (observe)                    | `mechanism-comparison` | after-prediction    |
| `mcs-foundations-mechanisms-explain`           | What can be set, and what is monitoring (explain)         | `mechanism-comparison` | after-prediction    |
| `mcs-foundations-mechanisms-transfer`          | A congested patient on a well-timed balloon (transfer)    | `patient-case`         | after-prediction    |

Preserved independent actions: control:select-iabp<br>control:select-impella<br>control:select-lvad.

Observed signals: Native contribution (nativeFlowLMin; L/min; 1 decimal places; flow)<br>Displayed device contribution (deviceFlowLMin; L/min; 1 decimal places; device-display)<br>Effective systemic delivery (effectiveSystemicFlowLMin; L/min; 1 decimal places; flow)<br>Pulse pressure (pulsePressureMmHg; mm Hg; 0 decimal places; pressure)<br>Modeled LV end-diastolic volume (lvedvMl; mL; 0 decimal places; volume)<br>Mean arterial pressure (mapMmHg; mm Hg; 0 decimal places; pressure).

Observation/reassessment: Compare the device line and the pulse pressure across the three mechanisms, and notice that effective systemic delivery does not move by the size of the device number. If a pump raised the device line but the native contribution fell by the same amount, what would have changed for the patient?

Completion contract: Recorded once all three mechanism results have been retained and interpreted, the prediction and its verdict have been worked through, the comparison has been seen, and a transfer answer has been committed. Transfer: `mcs-foundations-mechanisms-transfer-1` — A patient stays congested despite well-timed counterpulsation: the wedge pressure is high and the ventricle is distended.

### iabp-timing-triggering — 11 tasks

Prerequisites: `mcs-foundations-mechanisms`. Starting device: `iabp`. Existing route: `/{locale}/mechanical-circulatory-support/learn?lesson=iabp-timing-triggering`.

| Original ID (unchanged)                          | Original work                                      | New presentation | Original phase gate |
| ------------------------------------------------ | -------------------------------------------------- | ---------------- | ------------------- |
| `iabp-timing-triggering-normal-beat`             | A normal assisted beat (teaching)                  | `timing-lab`     | open                |
| `iabp-timing-triggering-early-inflation-example` | Demonstration: early inflation (teaching)          | `timing-lab`     | open                |
| `iabp-timing-triggering-late-inflation-example`  | Demonstration: late inflation (teaching)           | `timing-lab`     | open                |
| `iabp-timing-triggering-early-deflation-example` | Demonstration: early deflation (teaching)          | `timing-lab`     | open                |
| `iabp-timing-triggering-late-deflation-example`  | Demonstration: late deflation (teaching)           | `timing-lab`     | open                |
| `iabp-timing-triggering-recognize`               | Read the assisted beat (identify)                  | `timing-lab`     | open                |
| `iabp-timing-triggering-predict`                 | Say what moving inflation will change (prediction) | `timing-lab`     | open                |
| `iabp-timing-triggering-act`                     | Move inflation to the notch (action)               | `timing-lab`     | after-prediction    |
| `iabp-timing-triggering-observe`                 | Compare the trace before and after (observe)       | `timing-lab`     | after-prediction    |
| `iabp-timing-triggering-explain`                 | Timing decides how much is available (explain)     | `timing-lab`     | after-prediction    |
| `iabp-timing-triggering-transfer`                | The same balloon in atrial fibrillation (transfer) | `patient-case`   | after-prediction    |

Preserved independent actions: control:iabp-inflation.

Observed signals: Timing synchrony (timingQualityPercent; %; 0 decimal places; device-display)<br>Mean arterial pressure (mapMmHg; mm Hg; 0 decimal places; pressure)<br>Pulse pressure (pulsePressureMmHg; mm Hg; 0 decimal places; pressure)<br>Native contribution (nativeFlowLMin; L/min; 1 decimal places; flow)<br>Effective systemic delivery (effectiveSystemicFlowLMin; L/min; 1 decimal places; flow)<br>Calculated cardiac power output (cardiacPowerOutputW; W; 2 decimal places; pressure-flow).

Observation/reassessment: Watch the early-inflation alarm clear and timing synchrony recover, then read how much effective systemic delivery actually moved. Timing is now aligned. What would you check next before concluding that this level of support is adequate?

Completion contract: Recorded once inflation has been returned to within 20 ms of the notch, the prediction and its verdict have been worked through, the before-and-after comparison has been seen, and a transfer answer has been committed. Transfer: `mcs-iabp-trigger-transfer-1` — The rhythm becomes atrial fibrillation with variable cycle lengths, and some assisted beats land in the wrong place.

### iabp-efficacy-limits — 6 tasks

Prerequisites: `iabp-timing-triggering`. Starting device: `iabp`. Existing route: `/{locale}/mechanical-circulatory-support/learn?lesson=iabp-efficacy-limits`.

| Original ID (unchanged)          | Original work                                                     | New presentation | Original phase gate |
| -------------------------------- | ----------------------------------------------------------------- | ---------------- | ------------------- |
| `iabp-efficacy-limits-recognize` | Find the reading that moves first (identify)                      | `timing-lab`     | open                |
| `iabp-efficacy-limits-predict`   | Say what a weaker right ventricle will change (prediction)        | `patient-case`   | open                |
| `iabp-efficacy-limits-act`       | Weaken the right ventricle (action)                               | `patient-case`   | after-prediction    |
| `iabp-efficacy-limits-observe`   | Compare the device's account with the circulation's (observe)     | `patient-case`   | after-prediction    |
| `iabp-efficacy-limits-explain`   | Right, and insufficient (explain)                                 | `patient-case`   | after-prediction    |
| `iabp-efficacy-limits-transfer`  | High right atrial pressure, limited left-heart filling (transfer) | `patient-case`   | after-prediction    |

Preserved independent actions: control:patient-rv-contractility.

Observed signals: Timing synchrony (timingQualityPercent; %; 0 decimal places; device-display)<br>Right atrial pressure (rapMmHg; mm Hg; 0 decimal places; pressure)<br>Pulmonary pulsatility ratio (papi; ratio; 1 decimal places; pressure)<br>Effective systemic delivery (effectiveSystemicFlowLMin; L/min; 1 decimal places; flow)<br>Mean arterial pressure (mapMmHg; mm Hg; 0 decimal places; pressure)<br>Simulated mixed venous saturation (svo2Percent; %; 0 decimal places; oxygen-balance).

Observation/reassessment: Watch mean pressure and effective systemic delivery separate on the trend while timing synchrony does not move at all. The balloon is aligned and the patient is worse. What do you say first when you call the shock or mechanical-support team?

Completion contract: Recorded once right ventricular contractility has been lowered into its limited range, the prediction and its verdict have been worked through, the before-and-after comparison has been seen, and a transfer answer has been committed. Transfer: `mcs-iabp-limits-transfer-1` — A patient with high right atrial pressure, a low pulmonary pulsatility ratio and limited left-heart filling remains poorly perfused despite acceptable timing.

### impella-unloading-placement — 8 tasks

Prerequisites: `mcs-foundations-mechanisms`. Starting device: `impella`. Existing route: `/{locale}/mechanical-circulatory-support/learn?lesson=impella-unloading-placement`.

| Original ID (unchanged)                         | Original work                                                | New presentation   | Original phase gate |
| ----------------------------------------------- | ------------------------------------------------------------ | ------------------ | ------------------- |
| `impella-unloading-placement-inlet-outlet`      | An aligned LV-to-aorta pump (teaching)                       | `pump-loading-lab` | open                |
| `impella-unloading-placement-unloading-example` | Guided example: ventricular unloading (teaching)             | `pump-loading-lab` | open                |
| `impella-unloading-placement-recognize`         | Read where the inlet and the outlet sit (identify)           | `pump-loading-lab` | open                |
| `impella-unloading-placement-predict`           | Say what moving the inlet will change (prediction)           | `pump-loading-lab` | open                |
| `impella-unloading-placement-act`               | Move the inlet out of position (action)                      | `pump-loading-lab` | after-prediction    |
| `impella-unloading-placement-observe`           | Compare the pump's account with the ventricle's (observe)    | `pump-loading-lab` | after-prediction    |
| `impella-unloading-placement-explain`           | A pump in two chambers (explain)                             | `pump-loading-lab` | after-prediction    |
| `impella-unloading-placement-transfer`          | Position acceptable, pressures high, flow falling (transfer) | `patient-case`     | after-prediction    |

Preserved independent actions: control:impella-left-position.

Observed signals: Displayed pump flow (leftDeviceFlowLMin; L/min; 1 decimal places; device-display)<br>Effective systemic delivery (effectiveSystemicFlowLMin; L/min; 1 decimal places; flow)<br>Native contribution (nativeFlowLMin; L/min; 1 decimal places; flow)<br>Modeled LV end-diastolic volume (lvedvMl; mL; 0 decimal places; volume)<br>Wedge pressure (pcwpMmHg; mm Hg; 0 decimal places; pressure)<br>Mean arterial pressure (mapMmHg; mm Hg; 0 decimal places; pressure).

Observation/reassessment: Compare displayed pump flow with effective systemic delivery, and read the ventricular volume and wedge pressure as the unloading claim being checked. Before touching any setting, what three things would you check to explain a fallen flow: in the patient, in the position, and in the device?

Completion contract: Recorded once the specifically requested too-deep condition has been reached and its captured results interpreted, the prediction and its verdict have been worked through, the before-and-after comparison has been seen, and a transfer answer has been committed. Transfer: `mcs-impella-afterload-transfer-1` — The position is acceptable and the level is unchanged, but systemic resistance and aortic pressure rise, and the displayed flow falls anyway.

### impella-suction-purge-rv — 6 tasks

Prerequisites: `impella-unloading-placement`. Starting device: `impella`. Existing route: `/{locale}/mechanical-circulatory-support/learn?lesson=impella-suction-purge-rv`.

| Original ID (unchanged)              | Original work                                                   | New presentation   | Original phase gate |
| ------------------------------------ | --------------------------------------------------------------- | ------------------ | ------------------- |
| `impella-suction-purge-rv-recognize` | Find where the right-sided pump returns blood (identify)        | `pump-loading-lab` | open                |
| `impella-suction-purge-rv-predict`   | Say what starting the right-sided pump will change (prediction) | `pump-loading-lab` | open                |
| `impella-suction-purge-rv-act`       | Start the right-sided pump (action)                             | `pump-loading-lab` | after-prediction    |
| `impella-suction-purge-rv-observe`   | Compare the two pump lines with delivery (observe)              | `pump-loading-lab` | after-prediction    |
| `impella-suction-purge-rv-explain`   | One stream, measured twice (explain)                            | `pump-loading-lab` | after-prediction    |
| `impella-suction-purge-rv-transfer`  | A sudden fall in preload, the same alarm (transfer)             | `patient-case`     | after-prediction    |

Preserved independent actions: control:impella-right-enable.

Observed signals: Right-sided pump flow, into the lung (rightDeviceFlowLMin; L/min; 1 decimal places; device-display)<br>Left-sided pump flow, into the aorta (leftDeviceFlowLMin; L/min; 1 decimal places; device-display)<br>Systemic device flow signal (deviceFlowLMin; L/min; 1 decimal places; device-display)<br>Native contribution (nativeFlowLMin; L/min; 1 decimal places; flow)<br>Effective systemic delivery (effectiveSystemicFlowLMin; L/min; 1 decimal places; flow)<br>Right atrial pressure (rapMmHg; mm Hg; 0 decimal places; pressure).

Observation/reassessment: Add the two displayed pump flows together yourself, then compare that sum with the effective systemic delivery the model reports. Which findings, other than the two pump displays, would you use to decide whether right-sided support is achieving anything?

Completion contract: Recorded once right-sided support has been started, the prediction and its verdict have been worked through, the before-and-after comparison has been seen, and a transfer answer has been committed. Transfer: `mcs-impella-suction-transfer-1` — A left-sided pump is running at a high level when preload falls abruptly and a suction pattern appears with a lower effective flow.

### lvad-parameters-assessment — 8 tasks

Prerequisites: `mcs-foundations-mechanisms`, `impella-unloading-placement`. Starting device: `lvad`. Existing route: `/{locale}/mechanical-circulatory-support/learn?lesson=lvad-parameters-assessment`.

| Original ID (unchanged)                        | Original work                                                        | New presentation   | Original phase gate |
| ---------------------------------------------- | -------------------------------------------------------------------- | ------------------ | ------------------- |
| `lvad-parameters-assessment-controller-tour`   | The durable LVAD controller and the patient (teaching)               | `parameter-reader` | open                |
| `lvad-parameters-assessment-afterload-example` | Guided example: change afterload at fixed speed (teaching)           | `parameter-reader` | open                |
| `lvad-parameters-assessment-recognize`         | Read what the displayed flow is made from (identify)                 | `parameter-reader` | open                |
| `lvad-parameters-assessment-predict`           | Say what a stiffer circulation will change (prediction)              | `parameter-reader` | open                |
| `lvad-parameters-assessment-act`               | Raise the systemic resistance (action)                               | `pump-loading-lab` | after-prediction    |
| `lvad-parameters-assessment-observe`           | Compare pressure with delivery (observe)                             | `parameter-reader` | after-prediction    |
| `lvad-parameters-assessment-explain`           | A pressure improvement that is not a perfusion improvement (explain) | `parameter-reader` | after-prediction    |
| `lvad-parameters-assessment-transfer`          | The same rise in resistance, overnight (transfer)                    | `patient-case`     | after-prediction    |

Preserved independent actions: control:patient-svr.

Observed signals: Pump power (pumpPowerW; W; 1 decimal places; device-display)<br>Pulsatility index (pulsatilityIndex; index; 1 decimal places; device-display)<br>Displayed pump flow (deviceFlowLMin; L/min; 1 decimal places; device-display)<br>Effective systemic delivery (effectiveSystemicFlowLMin; L/min; 1 decimal places; flow)<br>Mean arterial pressure (mapMmHg; mm Hg; 0 decimal places; pressure)<br>Calculated cardiac power output (cardiacPowerOutputW; W; 2 decimal places; pressure-flow).

Observation/reassessment: Read the mean pressure and the effective systemic delivery in the same glance, then check what cardiac power did. Which measurements would you want beside the controller before deciding what this low displayed flow means?

Completion contract: Recorded once systemic vascular resistance has been raised into its high range, the prediction and its verdict have been worked through, the before-and-after comparison has been seen, and a transfer answer has been committed. Transfer: `mcs-lvad-afterload-transfer-1` — The same rise in resistance happens overnight: mean pressure and resistance are up, the displayed flow is down, and no controller fault is present.

### lvad-alarms-emergencies — 6 tasks

Prerequisites: `lvad-parameters-assessment`. Starting device: `lvad`. Existing route: `/{locale}/mechanical-circulatory-support/learn?lesson=lvad-alarms-emergencies`.

| Original ID (unchanged)             | Original work                                         | New presentation | Original phase gate |
| ----------------------------------- | ----------------------------------------------------- | ---------------- | ------------------- |
| `lvad-alarms-emergencies-recognize` | Read what an alarm on this pathway reports (identify) | `patient-case`   | open                |
| `lvad-alarms-emergencies-predict`   | Say what the controller will show (prediction)        | `patient-case`   | open                |
| `lvad-alarms-emergencies-act`       | Switch on the high-power pattern (action)             | `patient-case`   | after-prediction    |
| `lvad-alarms-emergencies-observe`   | Compare power with the flow display (observe)         | `patient-case`   | after-prediction    |
| `lvad-alarms-emergencies-explain`   | The signal the flow display does not carry (explain)  | `patient-case`   | after-prediction    |
| `lvad-alarms-emergencies-transfer`  | Power rising while perfusion worsens (transfer)       | `patient-case`   | after-prediction    |

Preserved independent actions: control:lvad-thrombosis.

Observed signals: Pump power (pumpPowerW; W; 1 decimal places; device-display)<br>Displayed pump flow (deviceFlowLMin; L/min; 1 decimal places; device-display)<br>Pulsatility index (pulsatilityIndex; index; 1 decimal places; device-display)<br>Effective systemic delivery (effectiveSystemicFlowLMin; L/min; 1 decimal places; flow)<br>Mean arterial pressure (mapMmHg; mm Hg; 0 decimal places; pressure)<br>Simulated mixed venous saturation (svo2Percent; %; 0 decimal places; oxygen-balance).

Observation/reassessment: Compare how far power moved with how far the displayed flow moved, and read the alarm interpretation beneath the band. Power is up and the flow display has not moved. What do you preserve, what do you examine, and who do you call?

Completion contract: Recorded once the high-power pattern has been switched on, the prediction and its verdict have been worked through, the before-and-after comparison has been seen, and a transfer answer has been committed. Transfer: `mcs-lvad-emergency-transfer-1` — Power rises while effective flow and perfusion worsen together, and the concern is an obstructed flow path.

### mcs-device-selection-integration — 6 tasks

Prerequisites: `iabp-efficacy-limits`, `impella-suction-purge-rv`, `lvad-alarms-emergencies`. Starting device: `impella`. Existing route: `/{locale}/mechanical-circulatory-support/learn?lesson=mcs-device-selection-integration`.

| Original ID (unchanged)                      | Original work                                                | New presentation | Original phase gate |
| -------------------------------------------- | ------------------------------------------------------------ | ---------------- | ------------------- |
| `mcs-device-selection-integration-recognize` | Find which side is limiting delivery (identify)              | `patient-case`   | open                |
| `mcs-device-selection-integration-predict`   | Say what raising the level will change (prediction)          | `patient-case`   | open                |
| `mcs-device-selection-integration-act`       | Raise the level (action)                                     | `patient-case`   | after-prediction    |
| `mcs-device-selection-integration-observe`   | Compare the gain with the levels added (observe)             | `patient-case`   | after-prediction    |
| `mcs-device-selection-integration-explain`   | The limiting problem selects (explain)                       | `patient-case`   | after-prediction    |
| `mcs-device-selection-integration-transfer`  | The same low output, right atrial pressure rising (transfer) | `patient-case`   | after-prediction    |

Preserved independent actions: control:impella-left-level.

Observed signals: Right atrial pressure (rapMmHg; mm Hg; 0 decimal places; pressure)<br>Wedge pressure (pcwpMmHg; mm Hg; 0 decimal places; pressure)<br>Displayed pump flow (leftDeviceFlowLMin; L/min; 1 decimal places; device-display)<br>Effective systemic delivery (effectiveSystemicFlowLMin; L/min; 1 decimal places; flow)<br>Mean arterial pressure (mapMmHg; mm Hg; 0 decimal places; pressure)<br>Simulated mixed venous saturation (svo2Percent; %; 0 decimal places; oxygen-balance).

Observation/reassessment: Read how much the displayed pump flow moved, how much the effective systemic delivery moved, and whether the right atrial pressure moved at all. You have named the limiting problem. What would have to appear on reassessment for you to change that judgement?

Completion contract: Recorded once the left-sided performance level has been raised to at least eight, the prediction and its verdict have been worked through, the before-and-after comparison has been seen, and a transfer answer has been committed. Transfer: `mcs-device-selection-integration-transfer-1` — The same low output, with a rising right atrial pressure and a falling pulmonary pulsatility ratio, and left-sided support under consideration.

## Original content and reference destinations

| Original content/action/reference                                                                  | New destination and boundary                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native/IABP orientation and pressure/flow/oxygen/perfusion groups                                  | Signals circulation-reader. Unsupported diagram explicitly conceptual; live readings remain a supported model state. Inspections never manufacture improvement.                                                                                                                                |
| Eight support-spine stops and original map-localized choices                                       | Same inner map-walk in the current task, with the same outer progression button. Keyboard answer list remains present.                                                                                                                                                                         |
| IABP, transvalvular and apical-LVAD pathway references                                             | One conceptual map/path account at a time, with all three accounts in a secondary comparison. View selection never dispatches DEVICE selection.                                                                                                                                                |
| Three independent device-selection experiments                                                     | Same matched-reference capture machinery, arbitrary order and repeat-one behavior. Retained comparison keeps patient/seed/configuration/baseline/model-time data. No equal-dose or efficacy ranking claim.                                                                                     |
| Common-model levels, support grammar/control classification, foundation disclosure                 | Original teaching renderer and sort interaction within the current task or mechanism explanation disclosure, at original disclosure gates.                                                                                                                                                     |
| Aligned assisted/unassisted IABP reference and four separate timing demonstrations                 | Timing-lab: existing McsTimingFigure and event markers. Identify remains a fresh unannotated figure, with timing hints and controls withheld. Event markers are authored, not clinically detected notches.                                                                                     |
| IABP efficacy loading/RV experiment and escalation transfer                                        | A short separate prerequisite reference precedes the original identification task; it moves from timing to patient response without a second full foundation lesson. RV contractility remains labelled experimental, not therapy.                                                              |
| CP correct-position reference and P5→P6 worked unloading example                                   | Conceptual labelled LV/aortic cutaway first; original guided example, fresh application and captures remain. 3D is opt-in. Too-shallow still cannot satisfy too-deep. Placement selector remains a fault demonstration, not a repositioning instruction.                                       |
| Impella RV/serial support, suction story problem and abrupt-preload transfer                       | Four unscored prerequisite pages distinguish upstream filling, RP source/destination and serial flow, differential explanation domains, and purge-reference scope. Original RP configuration action and transfer task remain; no new progression IDs.                                          |
| Purge-state action in broad lessons.ts                                                             | Still a broad authoring record and Studio control; **not** an interactive task in the mounted Learn stage. The prerequisite page says this explicitly. Existing post-commit suction/purge/RV teaching and sources remain.                                                                      |
| CP/5.5 variant comparison and optional 3D paths                                                    | Existing reference material, variant preview and Studio controls; not newly claimed as independent stage tasks. No manufacturer equivalence claim.                                                                                                                                             |
| LVAD controller tour, smaller SVR example, fresh estimator question, larger fixed-speed experiment | Parameter-reader teaches one original quantity description at a time, then pump-loading action and source-labelled measurements. Engine computes flow from speed/loading and derives power/PI; not the manufacturer estimator. Speed authorization remains unavailable in assigned Learn work. |
| High-power experiment                                                                              | Patient-case with source-labelled power/flow, permitted fault selector, captured response, later explanation and escalation transfer. No claim that high power proves thrombosis or stable flow excludes danger.                                                                               |
| Integration limiting-side question and P-level experiment                                          | Neutral clinical question and map/measurement workspace. True RV control, causal highlight and interpretation withheld until commitment; fresh changed-patient transfer. No shock-team device-selection algorithm.                                                                             |
| Full monitor, derived values, PV loop, trends and alarm semantics                                  | Same McsMonitor, secondary full-monitor disclosure in Learn, integrated into the case decision workspace.                                                                                                                                                                                      |
| All nine state-driven teaching panels and numeric/source disclosures                               | Same McsTeachingColumn/teaching components; their post-commit material is retained. General prerequisites are separate from active keyed answers. All pending transfers now suppress prior full explanations.                                                                                  |
| Source/evidence panel, device profiles and FDA review flags                                        | Same SourcesPanel and source registry, accessible in Learn source scope and case/reference material. Challenge references remain allowed by existing policy. No current recall sweep claimed.                                                                                                  |
| Retired lesson/panel arrangements                                                                  | Not reinstated as extra learner tasks. Legacy stage rendering exists only as an explicit feature rollback. Broad lesson interaction records remain unmodified rather than being silently promoted to live tasks.                                                                               |

No original live task is unmapped. Purge-management practice, broad CP/5.5 interaction records and other broad lesson interactions are explicitly distinguished from the 68 mounted tasks. Optional reference preservation does not claim they are completed or assessed.

## Practice and Challenge registry map

All **9 Practice cases and 3 capstones** retain their IDs, original starting patient/device, prediction options/correct IDs, action permissions, critical errors, success criteria, source IDs and scoring. The new rendering uses `mcsPresentationTitle` before completion; scenario diagnosis/title and objectives appear at debrief. The table names all cases and their retained required actions; these remain scoring inputs, not newly invented blocking UI gates.

| Case ID       | Route                                                              | Original required actions (unchanged)                                                                                   | Source/evidence IDs (unchanged)                                                                                     |
| ------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `IABP-01`     | `/{locale}/mechanical-circulatory-support/practice?case=IABP-01`   | `inspect:arterial`, `iabp:set-deflation`                                                                                | `master-hemodynamics-reference`, `ishlt-hfsa-acute-mcs-2023`, `mcs-educational-model-v1`, `getinge-iabp-current`    |
| `IABP-02`     | `/{locale}/mechanical-circulatory-support/practice?case=IABP-02`   | `inspect:arterial`, `iabp:set-trigger`, `iabp:set-ratio`                                                                | `master-hemodynamics-reference`, `ishlt-hfsa-acute-mcs-2023`, `mcs-educational-model-v1`, `getinge-iabp-current`    |
| `IABP-03`     | `/{locale}/mechanical-circulatory-support/practice?case=IABP-03`   | `inspect:preload`, `inspect:device`, `team:escalate`                                                                    | `master-hemodynamics-reference`, `ishlt-hfsa-acute-mcs-2023`, `mcs-educational-model-v1`                            |
| `IMP-01`      | `/{locale}/mechanical-circulatory-support/practice?case=IMP-01`    | `inspect:preload`, `impella:left:set-level`, `patient:set-preload`                                                      | `master-hemodynamics-reference`, `ishlt-hfsa-acute-mcs-2023`, `mcs-educational-model-v1`, `fda-impella-cp-labeling` |
| `IMP-02`      | `/{locale}/mechanical-circulatory-support/practice?case=IMP-02`    | `inspect:device`, `impella:left:set-position`                                                                           | `master-hemodynamics-reference`, `ishlt-hfsa-acute-mcs-2023`, `mcs-educational-model-v1`, `fda-impella-cp-labeling` |
| `IMP-03`      | `/{locale}/mechanical-circulatory-support/practice?case=IMP-03`    | `inspect:device`, `patient:set-svr`, `impella:left:set-purge`                                                           | `master-hemodynamics-reference`, `ishlt-hfsa-acute-mcs-2023`, `mcs-educational-model-v1`, `fda-impella-cp-labeling` |
| `LVAD-01`     | `/{locale}/mechanical-circulatory-support/practice?case=LVAD-01`   | `inspect:device`, `inspect:arterial`, `patient:set-svr`                                                                 | `ishlt-durable-mcs-2023`, `fda-heartmate3-ifu`, `mcs-educational-model-v1`                                          |
| `LVAD-02`     | `/{locale}/mechanical-circulatory-support/practice?case=LVAD-02`   | `inspect:preload`, `patient:set-rv`, `patient:set-pvr`, `team:escalate`                                                 | `ishlt-durable-mcs-2023`, `fda-heartmate3-ifu`, `mcs-educational-model-v1`                                          |
| `LVAD-03`     | `/{locale}/mechanical-circulatory-support/practice?case=LVAD-03`   | `inspect:device`, `lvad:set-power`, `team:escalate`                                                                     | `ishlt-durable-mcs-2023`, `fda-heartmate3-ifu`, `mcs-educational-model-v1`                                          |
| `CAP-IABP-01` | `/{locale}/mechanical-circulatory-support/assess?case=CAP-IABP-01` | `inspect:arterial`, `inspect:device`, `iabp:set-trigger`, `iabp:set-ratio`, `iabp:set-inflation`, `iabp:set-deflation`  | `master-hemodynamics-reference`, `ishlt-hfsa-acute-mcs-2023`, `mcs-educational-model-v1`, `getinge-iabp-current`    |
| `CAP-IMP-01`  | `/{locale}/mechanical-circulatory-support/assess?case=CAP-IMP-01`  | `inspect:arterial`, `inspect:device`, `impella:left:set-position`, `patient:set-svr`, `patient:adjust`, `team:escalate` | `master-hemodynamics-reference`, `ishlt-hfsa-acute-mcs-2023`, `mcs-educational-model-v1`, `fda-impella-cp-labeling` |
| `CAP-LVAD-01` | `/{locale}/mechanical-circulatory-support/assess?case=CAP-LVAD-01` | `inspect:preload`, `inspect:device`, `patient:set-tamponade`, `team:escalate`                                           | `ishlt-durable-mcs-2023`, `fda-heartmate3-ifu`, `mcs-educational-model-v1`                                          |

The pathway resolver's mechanism-match / next-in-unit pairings are unchanged; LVAD-03 remains next-in-unit rather than an assertion of identical high-power mechanism. Phase rail clicks focus authored sections only; they do not dispatch arbitrary phase changes. The original initial prediction is optional in cases, unlike required Learn prediction gates. Opening the causal debrief still uses the original reducer/scoring path.

## State, numeric and assessment contracts

- One reducer/session owns the engine; presentations, tabs within a reference, viewport and optional anatomy do not create a second patient, timebase or progression source. Existing learning action permission intersects each task with scenario restrictions. Reset/setup is not learner evidence.
- Original matched references, immutable Back snapshots and matching baseline, Return, Repeat, first-answer retention and fresh transfers are intact. New layouts reuse those records. Observations pause rather than drifting while the learner reads.
- `interventionalpulm:mcs-progress:v1`, completed sections, existing case scores, routes, lifecycle identities, access and draft release stage are unchanged. Incomplete Learn restarts safely; transient answers/captures are not durable mid-step restoration. No migration or fabricated past answer was added.
- Model equations, conservation, recirculation, source registries, device profiles, thresholds, alarm/interlock semantics and scoring files have no diff. RP remains a serial pulmonary route and is never added as a second systemic stream. IABP has no separate pump-flow estimate. Native output is concurrent output during support, not pre-support output.
- New compact readings use the existing unavailable/nonfinite formatter rather than filling missing readings with zero; units and modeled/device-estimate provenance are explicit. No bedside mentation, urine, skin or lactate values are generated.
- Independent timing masking, placement masking, neutral case labels and flow-account disclosure remain in ordinary UI/accessibility text. This is a client-rendered educational assessment, not a tamper-proof exam.

## Changed files and review scope

All runtime changes are under `src/features/mechanical-circulatory-support/`. `taskPresentation.ts` selects the six renderer kinds; StageHost composes them and retains rollback; SimulatorPane selects relevant surfaces; TaskControls covers only permitted actions; McsTaskPresentation/Readings/PathwayTour/PumpCutaway/PrerequisiteReference and scoped CSS supply the new flow. IntroTeaching integrates the references. Hub/LearnLanding and pathway group labels expose the coherent route. Workbench/CaseWorkflow integrate case decisions; Controls omits unavailable controls in cases, preserving the original Studio default.

Tests replace permanent-pane/mobile-tab/implicit-3D assertions with one-task, optional-3D, co-located decision and neutral-disclosure assertions. Workbench workspace fixtures now explicitly request an IABP Studio when that is the test's subject; new raw component tests cover the actual empty Practice landing. Stage fixtures read the new unscored prerequisite pages through their buttons before working original tasks. No original scoring, source, numeric, permission or persistence suite was removed.

## Substantive clinical-copy additions for physician review

1. Conceptual native/IABP/microaxial/apical-LVAD path diagrams and aligned LV inlet/aortic outlet cutaway; solid blood flow versus dashed insertion, conceptual/not scale/not procedural framing.
2. Efficacy reference distinguishing technical timing from patient perfusion, and RV contractility as a model condition.
3. Four-part upstream filling/RP/serial flow/suction/purge reference, including the statement that there is no interactive purge-management lesson.
4. Compact reading labels: modeled filling pressures/LV volume/native/effective flow, separate RP estimate, electrical power/PI as derived teaching values, absent nonsimulated organ endpoints.
5. Temporary support versus existing durable-LVAD assessment chapter context; neutral case framing and assistance disclosure.

Existing detailed clinical content and source IDs were reused. Source checks during implementation included the [ISHLT/HFSA acute MCS guideline page](https://www.ishlt.org/education-and-publications/standards-guidelines-detail/the-ishlt-hfsa-guideline-on-acute-mechanical-circulatory-support) and the [FDA-hosted 2018 HeartMate 3 IFU](https://www.accessdata.fda.gov/cdrh_docs/pdf16/P160054S008D.pdf). The latter is a dated source, not a claim that it is the current manual. No therapy targets, implantation depth, purge solution, anticoagulation instructions or device emergency choreography were added.

## Gaps and preserved holds

The existing [clinical review packet](mcs-live-teaching-panels.md), [model limitations](mcs-model-limitations.md), [section contracts](mcs-learn-section-contracts.md), [learner review record](mcs-learner-review-record.md) and [latest introduction repair](mcs-targeted-teaching-repair-2026-09-13.md) continue to apply. In particular, the CP manufacturer-measurand clarification and textbook-flow held disagreement remain distinct; no clinical/source hold is resolved by this UI work. The engine's authored IABP contours do not establish all clinical deflation phenotypes. PAPi response to RP is restricted by its modeled numerator; rising CPO during afterload does not prove improved perfusion. The high-power model can raise electrical power without lowering flow. These are preserved limitations, not silently fixed physiology.

Pre-existing assessment exposure: some cases permit `patient:adjust` or direct position/fault manipulation. Their permitted controls still show the experimental state. This is documented rather than silently removing those actions; neutral identity and omission of unpermitted controls do not make these cases a secure assessment.

Pre-existing scoring behavior: case COMPLETE can mark a case worked through and record a score despite missing required actions; required actions affect the score/mastery calculation rather than blocking the debrief. Browser transition runs exercise this path and are not evidence of mastery. Clinical threshold/criterion appropriateness is unchanged and needs separate physician review. Assistance indication is transient to the current attempt; stored historical scores cannot distinguish prior assistance without an explicitly authorized schema change.

Clinical approval, current IFU/recall review, human usability, native 200% browser zoom and a full browser/assistive-technology matrix remain outstanding; see [validation](mcs-flow-validation.md).

## Rollback

For a rapid Learn presentation rollback, set `MCS_TASK_PRESENTATIONS_ENABLED` to `false`; StageHost uses the original StageLayout with the same clinical content/session. No storage migration is needed. Full rollback (including separate Practice/Studio changes and prerequisite/reference composition) is a normal revert of this feature commit/PR on a new branch. Do not reset shared main, change the engine, or rewrite progress. The flag is deliberately local and does not alter other modules.
