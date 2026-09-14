# Mechanical ventilation: task presentation redesign

## Scope and baseline

Branch `codex/mv-task-flow` starts at `c2371c01`, the fetched main on September 13, 2026. The brief’s reference `8e16b69c` is an ancestor; the first-five-unit repair `7c5ea36d` was already merged. This work preserves those repaired tasks and intervening main changes. It covers all 14 Learn units, their 123 task identities and 28 experiment rounds, all 15 Practice cases, the seeded Challenge, and the contrasting transfer workflow. No merge, deployment, authentication change, backend operation, or release-state change is included.

The audience remains clinicians learning adult ventilation. The intended outcome is interpretation, controlled experimentation, and reassessment in a simplified simulation. It is not bedside competency or device certification. The user’s supplied flow brief explicitly supersedes the historical Steps / Teaching / Simulator arrangement for this module.

## Presentation and state

`content/taskPresentation.ts` declares each unit by stable ID and assigns every task a typed renderer kind and surface. No title matching, new mode, route, progress store, curriculum copy, or patient model selects the layout. The same unit can use a concept reference followed by a working experiment. The six kinds have concrete differences:

| Kind              | What is together in the current task                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `breath-reader`   | One complete captured breath, linked pressure/flow/volume cursor, explanation or question, capture/interpretation response.                |
| `concept-control` | A concept, worked example, or selected-versus-reported comparison, without an unrelated full monitor.                                      |
| `experiment-lab`  | Relevant setting or patient-property control, traces, readings, actual pressure maneuver and acquisition status, then retained comparison. |
| `timing-reader`   | Aligned model effort and machine events with start/end considered separately; no location highlight on the independent item.               |
| `response-lab`    | Immediate delivery/readouts, original recorded trend data, selected-action marker, elapsed model time and pending response.                |
| `patient-case`    | Patient brief or current findings, supported bedside assessment/actions, relevant waveform, reassessment and full-width results.           |

`VentilationStageHost` still owns one `useVentilationLabSession`. `LessonShell`, `NowCard`, section navigation, Help, source scopes and the optional lesson map are reused within MV-local document flow. Shared stage defaults and other modules’ layouts are unchanged. Required explanations stay beside the current work; longer sources expand in normal document flow. Internal step ordinals remain visible and unchanged; the step count does not force the same monitor/teaching arrangement onto every task.

The selected `MechanicalVentilatorConsole` is the setting and confirmation authority. Teaching controls run through its original native change/commit handlers and supported-control definitions. Full-console viewing changes its rendered surface without mounting another operable console or losing a pending edit. Hamilton applies numeric edits immediately; Evita and PB980 retain knob confirmation; AVEA retains ACCEPT and its existing expiration. Mode selection and confirmation remain separate commands, with original breath-boundary activation. Device choice stays locked after commitment and during case attempts.

The working task visibly separates playback/inspection, ventilator settings, teaching patient properties, and measurement maneuvers. Supplemental patient assessment, waveform review and circuit inspection use only interventions already supported by that patient, alongside original required actions. They do not replace the round’s scored goals. Buttons use the same lock state as the working controls and do not appear twice.

## Evidence and disclosure boundaries

- Complete reference breaths, learner-selected captured intervals and the live patient have different labels. Keyboard cursor inspection does not require a timed Pause click. A result caption now reads the exact stored inspected sample and its predecessor, including an earlier interval of the captured trace.
- Before/after traces retain one shared signal scale and physical time range. The existing finite-time VC/PC illustration keeps its original mathematical inputs, fixed axes, volume conventions and model qualifications. Live state is never substituted into that illustration.
- Plateau readouts distinguish modeled values from acquired measurements. Hold status uses the original queued, active, acquired, historical and unsuitable logic, revision dependencies, and recent-effort validity. An effort-contaminated acquisition remains uninterpretable for passive mechanics. Expiratory acquisition is labeled total PEEP; modeled intrinsic PEEP stays separate from selected PEEP and breath-relative volume.
- Later-unit prerequisites precede independent work. Units 7 and 11 use a separate normal passive breath. Units 8 and 12 use a conceptual normal timing illustration; unit 8’s worked example also uses that normal relationship rather than the current abnormal patient. Unit 14 starts with a neutral brief. Other later units use their existing, separate authored worked examples and source boundaries.
- Current prediction/location answer forms never coexist with keyed teaching for that item. Unit 14’s true mechanics controls, unacquired model plateau values (including the native-console text equivalent), educator overlays, diagnosis labels, prior-round review/map and explanatory source claims stay unavailable while the second prediction is pending. After commitment, the current observation still requires the original performed work.
- Independent bedside findings appear through supported assessment/inspection actions. Pre-action conditional findings are not asserted as current findings. Native effort/pressure-contribution teaching annotations are withheld for independent cases and pending transfer work. Timing lessons explicitly label effort as an educator/model signal.
- Source IDs, source scopes, draft questions, held clinical disagreements, original scoring and current release/review requirements are retained. No predictive target or clinical algorithm is changed.

## Every Learn unit and task

Each row’s ID is **both its old and new identity**; no task is renumbered or reordered. “Old location” records the existing pane destinations. “New” is the explicit kind/surface inside the current task. Original gates and required actions below remain the authority. `after-prediction` is a participation boundary, not a prediction-correctness requirement. First observations and recorded action/latency requirements remain enforced by the lab reducer.

### 1. `breathing-with-support` — Follow one supported breath

Normal complete reference → independent marked interval → keyboard capture → interpretation of the actual stored interval → another breath. No full console is required for the reading tasks.

Sources retained: `tobin-3e-setting-ventilator`, `tobin-3e-monitoring`. Registry Practice pairing: `MV-01` (next-in-unit).

Round 1, **Identify expiration on a captured breath**: `pause-expiration`; original observation interval **0 simulated seconds**.

Round 2, **Read another interval of a complete breath**: `inspect-inspiration`; original observation interval **0 simulated seconds**.

| Stable old → new task ID             | Task                                                  | Old location      | New kind / surface           | Gate / required response                   |
| ------------------------------------ | ----------------------------------------------------- | ----------------- | ---------------------------- | ------------------------------------------ |
| `breathing-with-support:1-recognize` | Read one complete passive breath                      | teaching + steps  | `breath-reader` / reference  | open; read                                 |
| `breathing-with-support:2-predict`   | Identify the marked phase                             | steps             | `breath-reader` / question   | open; prediction (round 1)                 |
| `breathing-with-support:3-act`       | Pause or inspect expiration                           | steps + simulator | `breath-reader` / working    | after-prediction; simulator-task (round 1) |
| `breathing-with-support:4-observe`   | Read the captured traces                              | steps             | `breath-reader` / working    | after-prediction; observe (round 1)        |
| `breathing-with-support:5-observe`   | Interpret your recorded result                        | steps             | `breath-reader` / comparison | after-prediction; interpret (round 1)      |
| `breathing-with-support:6-explain`   | Identify expiration on a captured breath              | steps + teaching  | `breath-reader` / comparison | after-prediction; explain (round 1)        |
| `breathing-with-support:7-transfer`  | A new setup: predict again                            | steps             | `breath-reader` / question   | after-prediction; prediction (round 2)     |
| `breathing-with-support:8-transfer`  | Inspect inspiration on the captured breath, and watch | steps             | `breath-reader` / working    | after-prediction; simulator-task (round 2) |
| `breathing-with-support:9-transfer`  | Interpret your recorded result                        | steps             | `breath-reader` / comparison | after-prediction; interpret (round 2)      |
| `breathing-with-support:10-transfer` | Read another interval of a complete breath            | steps             | `breath-reader` / comparison | after-prediction; explain (round 2)        |

### 2. `waveform-anatomy` — Three traces, one breath

Four linked reference stops → fixed-VT faster-flow experiment → actual-duration interpretation → slower-flow transfer. Baseline, setting, three traces and continuation share the same task.

Sources retained: `tobin-3e-setting-ventilator`, `tobin-3e-monitoring`. Registry Practice pairing: `MV-01` (next-in-unit).

Round 1, **Move the gas faster**: control: `peakFlowLMin = 60`; original observation interval **12 simulated seconds**.

Round 2, **Retrieve flow and volume on a slower inspiration**: control: `peakFlowLMin = 30`; original observation interval **12 simulated seconds**.

| Stable old → new task ID       | Task                                             | Old location      | New kind / surface            | Gate / required response                   |
| ------------------------------ | ------------------------------------------------ | ----------------- | ----------------------------- | ------------------------------------------ |
| `waveform-anatomy:1-recognize` | Connect pressure, flow and volume                | teaching + steps  | `breath-reader` / reference   | open; walk                                 |
| `waveform-anatomy:2-predict`   | Predict the response                             | steps + simulator | `experiment-lab` / question   | open; prediction (round 1)                 |
| `waveform-anatomy:3-act`       | Set the inspiratory flow to 60 L/min             | simulator         | `experiment-lab` / working    | after-prediction; simulator-task (round 1) |
| `waveform-anatomy:4-observe`   | Watch the response                               | simulator         | `experiment-lab` / working    | after-prediction; observe (round 1)        |
| `waveform-anatomy:5-observe`   | Interpret your recorded result                   | steps             | `experiment-lab` / comparison | after-prediction; interpret (round 1)      |
| `waveform-anatomy:6-explain`   | Move the gas faster                              | steps + teaching  | `experiment-lab` / comparison | after-prediction; explain (round 1)        |
| `waveform-anatomy:7-transfer`  | A new setup: predict again                       | steps + simulator | `experiment-lab` / question   | after-prediction; prediction (round 2)     |
| `waveform-anatomy:8-transfer`  | Set the inspiratory flow to 30 L/min, and watch  | simulator         | `experiment-lab` / working    | after-prediction; simulator-task (round 2) |
| `waveform-anatomy:9-transfer`  | Interpret your recorded result                   | steps             | `experiment-lab` / comparison | after-prediction; interpret (round 2)      |
| `waveform-anatomy:10-transfer` | Retrieve flow and volume on a slower inspiration | steps             | `experiment-lab` / comparison | after-prediction; explain (round 2)        |

### 3. `controls-and-goals` — What you set. What you check.

Worked oxygen concept → independent selected/measured question and six-value sort → actual VT experiment → separate oxygen experiment. The worked answer map is hidden during the sort.

Sources retained: `tobin-3e-setting-ventilator`, `tobin-3e-monitoring`. Registry Practice pairing: `MV-01` (next-in-unit).

Round 1, **A setting and its consequences**: control: `vtMl = 500`; original observation interval **12 simulated seconds**.

Round 2, **Separate oxygen from breath delivery**: control: `oxygenPercent = 60`; original observation interval **30 simulated seconds**.

| Stable old → new task ID         | Task                                           | Old location      | New kind / surface            | Gate / required response                   |
| -------------------------------- | ---------------------------------------------- | ----------------- | ----------------------------- | ------------------------------------------ |
| `controls-and-goals:1-recognize` | Pair a selected setting with a measured result | teaching + steps  | `concept-control` / reference | open; read                                 |
| `controls-and-goals:2-predict`   | Predict the response                           | steps + simulator | `concept-control` / question  | open; prediction (round 1)                 |
| `controls-and-goals:3-act`       | Set the tidal volume to 500 mL                 | simulator         | `experiment-lab` / working    | after-prediction; simulator-task (round 1) |
| `controls-and-goals:4-observe`   | Watch the response                             | simulator         | `experiment-lab` / working    | after-prediction; observe (round 1)        |
| `controls-and-goals:5-observe`   | Interpret your recorded result                 | steps             | `experiment-lab` / comparison | after-prediction; interpret (round 1)      |
| `controls-and-goals:6-explain`   | A setting and its consequences                 | steps + teaching  | `experiment-lab` / comparison | after-prediction; explain (round 1)        |
| `controls-and-goals:7-act`       | Sort what you set from what you check          | steps             | `concept-control` / question  | after-prediction; sort                     |
| `controls-and-goals:8-transfer`  | A new setup: predict again                     | steps + simulator | `concept-control` / question  | after-prediction; prediction (round 2)     |
| `controls-and-goals:9-transfer`  | Set the oxygen to 60 %, and watch              | simulator         | `experiment-lab` / working    | after-prediction; simulator-task (round 2) |
| `controls-and-goals:10-transfer` | Interpret your recorded result                 | steps             | `experiment-lab` / comparison | after-prediction; interpret (round 2)      |
| `controls-and-goals:11-transfer` | Separate oxygen from breath delivery           | steps             | `experiment-lab` / comparison | after-prediction; explain (round 2)        |

### 4. `mechanics-load-and-pressure` — Where does the pressure go?

Passive reference and valid hold explanation → resistance experiment with a fresh acquired hold → compliance experiment from its own baseline. Current/historical/unsuitable status and actual peak/plateau result stay adjacent.

Sources retained: `tobin-3e-monitoring`, `tobin-3e-fighting-ventilator`. Registry Practice pairing: `MV-13` (mechanism-match).

Round 1, **Find the pressure spent moving gas**: mechanics: `resistanceScale = 2`; actual inspiratory hold; original observation interval **12 simulated seconds**.

Round 2, **Separate stiffness from resistance**: mechanics: `complianceScale = 0.5`; actual inspiratory hold; original observation interval **12 simulated seconds**.

| Stable old → new task ID                  | Task                                                                | Old location      | New kind / surface            | Gate / required response                   |
| ----------------------------------------- | ------------------------------------------------------------------- | ----------------- | ----------------------------- | ------------------------------------------ |
| `mechanics-load-and-pressure:1-recognize` | Compare pressure during flow and a passive hold                     | teaching + steps  | `experiment-lab` / reference  | open; read                                 |
| `mechanics-load-and-pressure:2-predict`   | Predict the response                                                | steps + simulator | `experiment-lab` / question   | open; prediction (round 1)                 |
| `mechanics-load-and-pressure:3-act`       | Narrow the airways, then perform an inspiratory hold                | simulator         | `experiment-lab` / working    | after-prediction; simulator-task (round 1) |
| `mechanics-load-and-pressure:4-observe`   | Watch the response                                                  | simulator         | `experiment-lab` / working    | after-prediction; observe (round 1)        |
| `mechanics-load-and-pressure:5-observe`   | Interpret your recorded result                                      | steps             | `experiment-lab` / comparison | after-prediction; interpret (round 1)      |
| `mechanics-load-and-pressure:6-explain`   | Find the pressure spent moving gas                                  | steps + teaching  | `experiment-lab` / comparison | after-prediction; explain (round 1)        |
| `mechanics-load-and-pressure:7-transfer`  | A new setup: predict again                                          | steps + simulator | `experiment-lab` / question   | after-prediction; prediction (round 2)     |
| `mechanics-load-and-pressure:8-transfer`  | Make the lungs stiffer, then perform an inspiratory hold, and watch | simulator         | `experiment-lab` / working    | after-prediction; simulator-task (round 2) |
| `mechanics-load-and-pressure:9-transfer`  | Interpret your recorded result                                      | steps             | `experiment-lab` / comparison | after-prediction; interpret (round 2)      |
| `mechanics-load-and-pressure:10-transfer` | Separate stiffness from resistance                                  | steps             | `experiment-lab` / comparison | after-prediction; explain (round 2)        |

### 5. `modes-and-breath-delivery` — What does this breath hold constant?

Original fixed-input conventional VC/PC illustration → actual VC compliance experiment → actual conventional PC transfer. Pressure is explicitly above PEEP; dependent delivery and adaptive-mode qualifications remain.

Sources retained: `tobin-3e-setting-ventilator`, `tobin-3e-monitoring`. Registry Practice pairing: `MV-01` (next-in-unit).

Round 1, **Change the lung, keep the volume**: mechanics: `complianceScale = 0.5`; original observation interval **12 simulated seconds**.

Round 2, **Now control pressure**: mechanics: `complianceScale = 0.5`; original observation interval **12 simulated seconds**.

| Stable old → new task ID                | Task                                             | Old location      | New kind / surface            | Gate / required response                   |
| --------------------------------------- | ------------------------------------------------ | ----------------- | ----------------------------- | ------------------------------------------ |
| `modes-and-breath-delivery:1-recognize` | Compare conventional volume and pressure control | teaching + steps  | `concept-control` / reference | open; read                                 |
| `modes-and-breath-delivery:2-predict`   | Predict the response                             | steps + simulator | `experiment-lab` / question   | open; prediction (round 1)                 |
| `modes-and-breath-delivery:3-act`       | Make the lungs stiffer                           | simulator         | `experiment-lab` / working    | after-prediction; simulator-task (round 1) |
| `modes-and-breath-delivery:4-observe`   | Watch the response                               | simulator         | `experiment-lab` / working    | after-prediction; observe (round 1)        |
| `modes-and-breath-delivery:5-observe`   | Interpret your recorded result                   | steps             | `experiment-lab` / comparison | after-prediction; interpret (round 1)      |
| `modes-and-breath-delivery:6-explain`   | Change the lung, keep the volume                 | steps + teaching  | `experiment-lab` / comparison | after-prediction; explain (round 1)        |
| `modes-and-breath-delivery:7-transfer`  | A new setup: predict again                       | steps + simulator | `experiment-lab` / question   | after-prediction; prediction (round 2)     |
| `modes-and-breath-delivery:8-transfer`  | Make the lungs stiffer, and watch                | simulator         | `experiment-lab` / working    | after-prediction; simulator-task (round 2) |
| `modes-and-breath-delivery:9-transfer`  | Interpret your recorded result                   | steps             | `experiment-lab` / comparison | after-prediction; interpret (round 2)      |
| `modes-and-breath-delivery:10-transfer` | Now control pressure                             | steps             | `experiment-lab` / comparison | after-prediction; explain (round 2)        |

### 6. `lung-protection` — Is this breath appropriate for this lung?

Separate adult ARDS/PBW reference → delivered VT per authored PBW and actual hold → effort-contaminated hold transfer. The case supplies PBW but no height; no height or universal calculator is invented.

Sources retained: `ats-ards-2024`, `aarc-assessment-2024`. Registry Practice pairing: `MV-01` (mechanism-match).

Round 1, **Reduce the size of the breath**: control: `vtMl = 420`; actual inspiratory hold; original observation interval **12 simulated seconds**.

Round 2, **Test the measurement in an active patient**: actual inspiratory hold; original observation interval **12 simulated seconds**.

| Stable old → new task ID      | Task                                                             | Old location      | New kind / surface            | Gate / required response                   |
| ----------------------------- | ---------------------------------------------------------------- | ----------------- | ----------------------------- | ------------------------------------------ |
| `lung-protection:1-recognize` | Is this breath sized to this lung?                               | simulator         | `concept-control` / reference | open; read                                 |
| `lung-protection:2-predict`   | Predict the response                                             | steps + simulator | `experiment-lab` / question   | open; prediction (round 1)                 |
| `lung-protection:3-act`       | Set the tidal volume to 420 mL, then perform an inspiratory hold | simulator         | `experiment-lab` / working    | after-prediction; simulator-task (round 1) |
| `lung-protection:4-observe`   | Watch the response                                               | simulator         | `experiment-lab` / working    | after-prediction; observe (round 1)        |
| `lung-protection:5-explain`   | Reduce the size of the breath                                    | steps + teaching  | `experiment-lab` / comparison | after-prediction; explain (round 1)        |
| `lung-protection:6-transfer`  | A new setup: predict again                                       | steps + simulator | `experiment-lab` / question   | after-prediction; prediction (round 2)     |
| `lung-protection:7-transfer`  | Perform an inspiratory hold, and watch                           | simulator         | `experiment-lab` / working    | after-prediction; simulator-task (round 2) |
| `lung-protection:8-transfer`  | Test the measurement in an active patient                        | steps             | `experiment-lab` / comparison | after-prediction; explain (round 2)        |

### 7. `expiration-and-air-trapping` — Does the breath have time to finish?

Separate normal expiratory reference → rate/emptying experiment → obstructive cycling transfer. Retained breaths use common axes; an available expiratory hold uses the actual maneuver and validity status.

Sources retained: `tobin-3e-copd`, `tobin-3e-monitoring`. Registry Practice pairing: `MV-05` (mechanism-match).

Round 1, **Give expiration less time**: control: `ratePerMin = 26`; original observation interval **20 simulated seconds**.

Round 2, **Give expiration time back**: control: `etsPercent = 50`; original observation interval **25 simulated seconds**.

| Stable old → new task ID                  | Task                                 | Old location      | New kind / surface            | Gate / required response                   |
| ----------------------------------------- | ------------------------------------ | ----------------- | ----------------------------- | ------------------------------------------ |
| `expiration-and-air-trapping:1-recognize` | Watch the breath empty               | simulator         | `breath-reader` / reference   | open; read                                 |
| `expiration-and-air-trapping:2-predict`   | Predict the response                 | steps + simulator | `experiment-lab` / question   | open; prediction (round 1)                 |
| `expiration-and-air-trapping:3-act`       | Set the rate to 26 /min              | simulator         | `experiment-lab` / working    | after-prediction; simulator-task (round 1) |
| `expiration-and-air-trapping:4-observe`   | Watch the response                   | simulator         | `experiment-lab` / working    | after-prediction; observe (round 1)        |
| `expiration-and-air-trapping:5-explain`   | Give expiration less time            | steps + teaching  | `experiment-lab` / comparison | after-prediction; explain (round 1)        |
| `expiration-and-air-trapping:6-transfer`  | A new setup: predict again           | steps + simulator | `experiment-lab` / question   | after-prediction; prediction (round 2)     |
| `expiration-and-air-trapping:7-transfer`  | Set the cycle-off to 50 %, and watch | simulator         | `experiment-lab` / working    | after-prediction; simulator-task (round 2) |
| `expiration-and-air-trapping:8-transfer`  | Give expiration time back            | steps             | `experiment-lab` / comparison | after-prediction; explain (round 2)        |

### 8. `triggering-and-cycling` — Do the two breath clocks agree?

Separate normal timing → unhighlighted location question → trigger-threshold experiment → cycling experiment. Model effort shares time with machine inspiration and is identified as teaching evidence.

Sources retained: `antonogiannaki-dyssynchrony-2017`, `tobin-3e-fighting-ventilator`. Registry Practice pairing: `MV-07` (mechanism-match).

Round 1, **Help an effort start a breath**: control: `triggerThreshold = 1.5`; original observation interval **20 simulated seconds**.

Round 2, **Help support last through inspiration**: control: `etsPercent = 15`; original observation interval **20 simulated seconds**.

| Stable old → new task ID             | Task                                  | Old location      | New kind / surface           | Gate / required response                   |
| ------------------------------------ | ------------------------------------- | ----------------- | ---------------------------- | ------------------------------------------ |
| `triggering-and-cycling:1-recognize` | Where does the mismatch live?         | simulator + steps | `timing-reader` / question   | open; locate                               |
| `triggering-and-cycling:2-predict`   | Predict the response                  | steps + simulator | `timing-reader` / question   | open; prediction (round 1)                 |
| `triggering-and-cycling:3-act`       | Set the flow trigger to 1.5 L/min     | simulator         | `timing-reader` / working    | after-prediction; simulator-task (round 1) |
| `triggering-and-cycling:4-observe`   | Watch the response                    | simulator         | `timing-reader` / working    | after-prediction; observe (round 1)        |
| `triggering-and-cycling:5-explain`   | Help an effort start a breath         | steps + teaching  | `timing-reader` / comparison | after-prediction; explain (round 1)        |
| `triggering-and-cycling:6-transfer`  | A new setup: predict again            | steps + simulator | `timing-reader` / question   | after-prediction; prediction (round 2)     |
| `triggering-and-cycling:7-transfer`  | Set the cycle-off to 15 %, and watch  | simulator         | `timing-reader` / working    | after-prediction; simulator-task (round 2) |
| `triggering-and-cycling:8-transfer`  | Help support last through inspiration | steps             | `timing-reader` / comparison | after-prediction; explain (round 2)        |

### 9. `oxygenation-response` — Did oxygenation improve at a cost?

Existing separate benefit/cost example → PEEP experiment → oxygen-composition experiment. SpO₂, mean arterial pressure and airway pressure share the actual model clock; latency and competing effects remain visible.

Sources retained: `tobin-3e-peep`, `aarc-assessment-2024`. Registry Practice pairing: `MV-01` (mechanism-match).

Round 1, **Test a pressure change in the original patient**: control: `peepCmH2O = 8`; original observation interval **45 simulated seconds**.

Round 2, **Separate oxygen from breath delivery**: control: `oxygenPercent = 60`; original observation interval **30 simulated seconds**.

| Stable old → new task ID           | Task                                           | Old location      | New kind / surface            | Gate / required response                   |
| ---------------------------------- | ---------------------------------------------- | ----------------- | ----------------------------- | ------------------------------------------ |
| `oxygenation-response:1-recognize` | More than the saturation                       | simulator         | `concept-control` / reference | open; read                                 |
| `oxygenation-response:2-predict`   | Predict the response                           | steps + simulator | `response-lab` / question     | open; prediction (round 1)                 |
| `oxygenation-response:3-act`       | Set the PEEP to 8 cmH₂O                        | simulator         | `response-lab` / working      | after-prediction; simulator-task (round 1) |
| `oxygenation-response:4-observe`   | Watch the response                             | simulator         | `response-lab` / working      | after-prediction; observe (round 1)        |
| `oxygenation-response:5-explain`   | Test a pressure change in the original patient | steps + teaching  | `response-lab` / comparison   | after-prediction; explain (round 1)        |
| `oxygenation-response:6-transfer`  | A new setup: predict again                     | steps + simulator | `response-lab` / question     | after-prediction; prediction (round 2)     |
| `oxygenation-response:7-transfer`  | Set the oxygen to 60 %, and watch              | simulator         | `response-lab` / working      | after-prediction; simulator-task (round 2) |
| `oxygenation-response:8-transfer`  | Separate oxygen from breath delivery           | steps             | `response-lab` / comparison   | after-prediction; explain (round 2)        |

### 10. `ventilation-and-co2` — What will change the CO₂?

Separate worked example → rate with verified delivery → pressure-control/compliance transfer. Delivered VT, rate, minute ventilation, expiratory flow and CO₂ stay together; trend display and original delay remain distinct from playback.

Sources retained: `tobin-3e-setting-ventilator`, `tobin-3e-copd`. Registry Practice pairing: `MV-05` (mechanism-match).

Round 1, **Follow the two response clocks**: control: `ratePerMin = 20`; original observation interval **90 simulated seconds**.

Round 2, **Same rate, a different delivered breath**: mechanics: `complianceScale = 0.5`; original observation interval **90 simulated seconds**.

| Stable old → new task ID          | Task                                     | Old location      | New kind / surface            | Gate / required response                   |
| --------------------------------- | ---------------------------------------- | ----------------- | ----------------------------- | ------------------------------------------ |
| `ventilation-and-co2:1-recognize` | Two clocks: the breath and the blood gas | simulator         | `concept-control` / reference | open; read                                 |
| `ventilation-and-co2:2-predict`   | Predict the response                     | steps + simulator | `response-lab` / question     | open; prediction (round 1)                 |
| `ventilation-and-co2:3-act`       | Set the rate to 20 /min                  | simulator         | `response-lab` / working      | after-prediction; simulator-task (round 1) |
| `ventilation-and-co2:4-observe`   | Watch the response                       | simulator         | `response-lab` / working      | after-prediction; observe (round 1)        |
| `ventilation-and-co2:5-explain`   | Follow the two response clocks           | steps + teaching  | `response-lab` / comparison   | after-prediction; explain (round 1)        |
| `ventilation-and-co2:6-transfer`  | A new setup: predict again               | steps + simulator | `response-lab` / question     | after-prediction; prediction (round 2)     |
| `ventilation-and-co2:7-transfer`  | Make the lungs stiffer, and watch        | simulator         | `response-lab` / working      | after-prediction; simulator-task (round 2) |
| `ventilation-and-co2:8-transfer`  | Same rate, a different delivered breath  | steps             | `response-lab` / comparison   | after-prediction; explain (round 2)        |

### 11. `waveform-reading-sequence` — Read the whole breath in order

Separate normal breath → locate a change before interpreting → supported patient/circuit assessment and actual condensate workflow → high-demand inspiratory-flow transfer. Conditional findings and hidden mechanism labels are withheld.

Sources retained: `tobin-3e-monitoring`, `antonogiannaki-dyssynchrony-2017`. Registry Practice pairing: `MV-08` (mechanism-match).

Round 1, **Follow extra breaths back to the circuit**: performed `inspect-circuit`; performed `drain-condensate`; original observation interval **25 simulated seconds**.

Round 2, **Distinguish an inspiratory delivery problem**: control: `peakFlowLMin = 60`; original observation interval **12 simulated seconds**.

| Stable old → new task ID                | Task                                            | Old location      | New kind / surface           | Gate / required response                   |
| --------------------------------------- | ----------------------------------------------- | ----------------- | ---------------------------- | ------------------------------------------ |
| `waveform-reading-sequence:1-recognize` | Where do the extra breaths come from?           | simulator + steps | `breath-reader` / question   | open; locate                               |
| `waveform-reading-sequence:2-predict`   | Predict the response                            | steps + simulator | `breath-reader` / question   | open; prediction (round 1)                 |
| `waveform-reading-sequence:3-act`       | Inspect the circuit and clear the condensate    | simulator         | `breath-reader` / working    | after-prediction; simulator-task (round 1) |
| `waveform-reading-sequence:4-observe`   | Watch the response                              | simulator         | `breath-reader` / working    | after-prediction; observe (round 1)        |
| `waveform-reading-sequence:5-explain`   | Follow extra breaths back to the circuit        | steps + teaching  | `breath-reader` / comparison | after-prediction; explain (round 1)        |
| `waveform-reading-sequence:6-transfer`  | A new setup: predict again                      | steps + simulator | `breath-reader` / question   | after-prediction; prediction (round 2)     |
| `waveform-reading-sequence:7-transfer`  | Set the inspiratory flow to 60 L/min, and watch | simulator         | `breath-reader` / working    | after-prediction; simulator-task (round 2) |
| `waveform-reading-sequence:8-transfer`  | Distinguish an inspiratory delivery problem     | steps             | `breath-reader` / comparison | after-prediction; explain (round 2)        |

### 12. `dyssynchrony-mechanisms` — Locate the mismatch before changing support

Separate normal timing/example → locate before labeling → pressurization experiment → cycling transfer. Relevant control, model effort and retained traces share one workspace.

Sources retained: `antonogiannaki-dyssynchrony-2017`, `tobin-3e-fighting-ventilator`. Registry Practice pairing: `MV-11` (mechanism-match).

Round 1, **Test the speed of pressurization**: control: `pRampMs = 100`; original observation interval **20 simulated seconds**.

Round 2, **Give expiration time back**: control: `etsPercent = 50`; original observation interval **25 simulated seconds**.

| Stable old → new task ID              | Task                                       | Old location      | New kind / surface           | Gate / required response                   |
| ------------------------------------- | ------------------------------------------ | ----------------- | ---------------------------- | ------------------------------------------ |
| `dyssynchrony-mechanisms:1-recognize` | Where does this patient’s discomfort live? | simulator + steps | `timing-reader` / question   | open; locate                               |
| `dyssynchrony-mechanisms:2-predict`   | Predict the response                       | steps + simulator | `timing-reader` / question   | open; prediction (round 1)                 |
| `dyssynchrony-mechanisms:3-act`       | Set the rise time to 100 ms                | simulator         | `timing-reader` / working    | after-prediction; simulator-task (round 1) |
| `dyssynchrony-mechanisms:4-observe`   | Watch the response                         | simulator         | `timing-reader` / working    | after-prediction; observe (round 1)        |
| `dyssynchrony-mechanisms:5-explain`   | Test the speed of pressurization           | steps + teaching  | `timing-reader` / comparison | after-prediction; explain (round 1)        |
| `dyssynchrony-mechanisms:6-transfer`  | A new setup: predict again                 | steps + simulator | `timing-reader` / question   | after-prediction; prediction (round 2)     |
| `dyssynchrony-mechanisms:7-transfer`  | Set the cycle-off to 50 %, and watch       | simulator         | `timing-reader` / working    | after-prediction; simulator-task (round 2) |
| `dyssynchrony-mechanisms:8-transfer`  | Give expiration time back                  | steps             | `timing-reader` / comparison | after-prediction; explain (round 2)        |

### 13. `safety-reassessment-and-human-factors` — The alarm and the person

Patient-centered prerequisite → assessment and communication → delayed pain intervention and reassessment. Selected, pending and effective actions are distinguished without medication doses or new emergency choreography.

Sources retained: `tobin-3e-fighting-ventilator`, `aarc-assessment-2024`. Registry Practice pairing: `MV-15` (mechanism-match).

Round 1, **Use the patient’s account**: performed `assess-patient`; performed `communication-board`; original observation interval **30 simulated seconds**.

Round 2, **Reassess a reversible contributor**: performed `treat-pain`; original observation interval **150 simulated seconds**.

| Stable old → new task ID                            | Task                                           | Old location      | New kind / surface          | Gate / required response                   |
| --------------------------------------------------- | ---------------------------------------------- | ----------------- | --------------------------- | ------------------------------------------ |
| `safety-reassessment-and-human-factors:1-recognize` | The person before the machine                  | simulator         | `patient-case` / reference  | open; read                                 |
| `safety-reassessment-and-human-factors:2-predict`   | Predict the response                           | steps + simulator | `patient-case` / question   | open; prediction (round 1)                 |
| `safety-reassessment-and-human-factors:3-act`       | Assess the patient and establish communication | simulator         | `patient-case` / working    | after-prediction; simulator-task (round 1) |
| `safety-reassessment-and-human-factors:4-observe`   | Watch the response                             | simulator         | `patient-case` / working    | after-prediction; observe (round 1)        |
| `safety-reassessment-and-human-factors:5-explain`   | Use the patient’s account                      | steps + teaching  | `patient-case` / comparison | after-prediction; explain (round 1)        |
| `safety-reassessment-and-human-factors:6-transfer`  | A new setup: predict again                     | steps + simulator | `patient-case` / question   | after-prediction; prediction (round 2)     |
| `safety-reassessment-and-human-factors:7-transfer`  | Treat the pain, and watch                      | simulator         | `patient-case` / working    | after-prediction; simulator-task (round 2) |
| `safety-reassessment-and-human-factors:8-transfer`  | Reassess a reversible contributor              | steps             | `patient-case` / comparison | after-prediction; explain (round 2)        |

### 14. `high-peak-pressure-integration` — One alarm, different patients

Neutral patient brief → first undisclosed setup and acquired measurement → full-width comparison → second undisclosed setup and acquired measurement. Prior answers and true mechanics remain hidden while the second interpretation is pending.

Sources retained: `tobin-3e-monitoring`, `tobin-3e-copd`, `tobin-3e-fighting-ventilator`. Registry Practice pairing: `MV-13` (mechanism-match).

Round 1, **One high-pressure presentation**: actual inspiratory hold; original observation interval **12 simulated seconds**.

Round 2, **Same presentation, a different patient**: actual inspiratory hold; original observation interval **12 simulated seconds**.

| Stable old → new task ID                     | Task                                   | Old location      | New kind / surface          | Gate / required response                   |
| -------------------------------------------- | -------------------------------------- | ----------------- | --------------------------- | ------------------------------------------ |
| `high-peak-pressure-integration:1-recognize` | One alarm, cause not supplied          | simulator         | `patient-case` / reference  | open; read                                 |
| `high-peak-pressure-integration:2-predict`   | Predict the response                   | steps + simulator | `patient-case` / question   | open; prediction (round 1)                 |
| `high-peak-pressure-integration:3-act`       | Perform an inspiratory hold            | simulator         | `patient-case` / working    | after-prediction; simulator-task (round 1) |
| `high-peak-pressure-integration:4-observe`   | Watch the response                     | simulator         | `patient-case` / working    | after-prediction; observe (round 1)        |
| `high-peak-pressure-integration:5-explain`   | One high-pressure presentation         | steps + teaching  | `patient-case` / comparison | after-prediction; explain (round 1)        |
| `high-peak-pressure-integration:6-transfer`  | A new setup: predict again             | steps + simulator | `patient-case` / question   | after-prediction; prediction (round 2)     |
| `high-peak-pressure-integration:7-transfer`  | Perform an inspiratory hold, and watch | simulator         | `patient-case` / working    | after-prediction; simulator-task (round 2) |
| `high-peak-pressure-integration:8-transfer`  | Same presentation, a different patient | steps             | `patient-case` / comparison | after-prediction; explain (round 2)        |

## Every clinical case and transfer

All 15 registry cases retain the original seeds, initial states, supported device mapping, control limits, scoring domains, clinical targets, intervention delays, safety interruptions and replay. Titles in the working view use the existing neutral `casePresentation` registry. Original diagnosis-specific titles return in the debrief. These are existing content strings moved to their intended disclosure boundary.

The following phase mapping applies independently to **every case** in the next table. No case is removed or replaced by the generic layout.

| Existing state/task    | Previous presentation                                                     | New presentation and retained gate                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recognize` / baseline | Native workbench alongside the full workflow and repeated step navigation | Open patient brief, original native simulation and one baseline task. One breath uses the existing action/phase resolver.                                                             |
| `predict`              | Prediction embedded in the full workflow                                  | Interpretation, safety priority and expected response together. Original commitment and Guided participation policy remain.                                                           |
| `act`                  | Full workflow, case header and duplicate stepper beside console           | Native console prominent; one management task with original bedside actions, interrupts and post-action policy.                                                                       |
| `observe`              | Reassessment lower in the same long workflow                              | Review-response action selects the existing observation phase without an engine event; original supported checks and `COMMIT_REASSESSMENT` still required.                            |
| `explain` / debrief    | Causal debrief squeezed beside idle console                               | Original scorer and full causal debrief across the document width. Native component remains mounted but hidden; original `REVEAL_DEBRIEF` action is retained.                         |
| `transfer`             | New patient with the existing interpretation/review form                  | Contrasting patient and its own playback, interpretation and two performed review actions. Previous debrief is absent. Original completion rule and clean-checkpoint fallback remain. |

Transfer Run/Step use the existing transfer reducer. The host’s single interval dispatches ticks to the active patient only; the primary case record does not advance during transfer. The completed case’s validated saved clock is retained when replay differs by at most the existing 1 ms replay tolerance, preventing a final event from becoming a future timestamp on re-save. This is a restoration fix, not a schema, replay tolerance, model or scoring change.

| Case    | Original title (debrief) → working title                                                                                     | Original required intervention IDs                                      | Original reassessment IDs              | Contrasting transfer |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------- | -------------------- |
| `MV-01` | ARDS hypoxemia: recruitment versus overdistension → Low saturation in an adult with stiff lungs on volume control            | `inspiratory-hold`                                                      | `inspiratory-hold`, `review-waveforms` | `MV-14`              |
| `MV-02` | Volume-control flow starvation during high respiratory drive → A scooped pressure trace and strong efforts on volume control | `treat-drive`                                                           | `review-waveforms`, `assess-patient`   | `MV-11`              |
| `MV-03` | Double triggering and breath stacking in ARDS → Paired breaths and rising volumes in a sedated adult                         | No mandatory intervention ID; original setting/response scoring remains | `review-waveforms`, `assess-patient`   | `MV-04`              |
| `MV-04` | Reverse triggering in a deeply sedated patient → Deep sedation, yet efforts appear after each machine breath                 | No mandatory intervention ID; original setting/response scoring remains | `review-waveforms`, `assess-patient`   | `MV-03`              |
| `MV-05` | COPD: dynamic hyperinflation with ineffective efforts → A breathless adult whose exhalations never quite finish              | `expiratory-hold`                                                       | `expiratory-hold`, `review-waveforms`  | `MV-06`              |
| `MV-06` | Severe asthma: auto-PEEP with obstructive shock → Falling blood pressure and rising pressures in an adult with tight airways | `disconnect-bag`, `bronchodilator`                                      | `expiratory-hold`, `assess-patient`    | `MV-05`              |
| `MV-07` | Neuromuscular weakness with trigger delay and missed efforts → A weak adult whose efforts do not always start a breath       | `assess-strength`                                                       | `review-waveforms`, `assess-patient`   | `MV-08`              |
| `MV-08` | Autotriggering from condensate or circuit leak → More machine breaths than efforts                                           | `inspect-circuit`                                                       | `review-waveforms`, `assess-patient`   | `MV-07`              |
| `MV-09` | Premature cycling on pressure support → Supported breaths that end while the patient is still pulling                        | No mandatory intervention ID; original setting/response scoring remains | `review-waveforms`, `assess-patient`   | `MV-10`              |
| `MV-10` | Delayed cycling on pressure support in COPD → Supported breaths that keep pushing after the effort has ended                 | No mandatory intervention ID; original setting/response scoring remains | `review-waveforms`, `expiratory-hold`  | `MV-09`              |
| `MV-11` | Rise-time mismatch: too slow, then too fast → Uncomfortable at the start of every supported breath                           | No mandatory intervention ID; original setting/response scoring remains | `review-waveforms`, `assess-patient`   | `MV-02`              |
| `MV-12` | Over-assistance with low drive and periodic breathing → A sedated adult whose breaths wax and wane on generous support       | `reduce-sedation`                                                       | `order-abg`, `review-waveforms`        | `MV-15`              |
| `MV-13` | High airway pressure: secretions, tube obstruction, or bronchospasm → A high-pressure alarm in a ventilated adult            | `inspiratory-hold`, `inspect-circuit`                                   | `inspiratory-hold`, `review-waveforms` | `MV-14`              |
| `MV-14` | Sudden loss of compliance: tension pneumothorax → A sudden high-pressure alarm with a falling blood pressure                 | `decompress-pneumothorax`                                               | `assess-patient`, `review-waveforms`   | `MV-13`              |
| `MV-15` | Air hunger, anxiety, pain, and delirium in an awake ventilated patient → Awake, anxious and air-hungry on the ventilator     | `communication-board`, `treat-pain`, `relieve-bladder`                  | `assess-patient`, `review-waveforms`   | `MV-12`              |

For all rows, transfer still requires an interpretation plus performed `assess-patient` and `review-waveforms` actions. Clicking Submit with neither or just one review action cannot complete it. The original rule is retained, including its feedback and progression behavior; this work does not introduce a new correctness requirement.

Practice-only post-action coaching remains Practice-only. Challenge keeps its original optional action-feedback checkbox and restricted drawers; the new layout does not expose Practice coaching there. Guided mode retains its established scaffolding. Current present findings retain their reference policy; conditional/differential findings appear after the relevant disclosure boundary rather than exposing future or hidden information in drawers.

## Distinct entry and review activities

The hub, recommended path, registry-based case pairing, expert entry, return-to-Learn context, locale handling, placement check, spaced review, final mixed check and live Challenge keep their existing routes and identities. Placement changes scaffolding; it cannot create live evidence. The final check retains all ten questions, its original score, full-set feedback boundary and all-14-unit live-evidence eligibility. Shared placement/progress resolution and legacy Hamilton entry are unchanged. Repeated registry pairings do not create duplicate case requirements.

## Files and responsibility

| Files under `src/features/mechanical-ventilation/`                                                                                                | Responsibility                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content/taskPresentation.ts`, `content/stageLessons.ts`                                                                                          | Explicit presentation metadata attached to unchanged task IDs.                                                                                                       |
| `components/stage/VentilationStageHost.tsx`                                                                                                       | Local composition, prerequisite/answer disclosure, current-task focus, retained comparison and exact captured-interval caption.                                      |
| `components/stage/VentilationTaskWorkspace.tsx`, `VentilationTaskWorkbench.tsx`                                                                   | Task composition, relevant supported controls, measurement status, bedside assessment and readouts.                                                                  |
| `components/stage/VentilationPrerequisite.tsx`, `VentilationResponseTimeline.tsx`, `RecordedBreathComparison.tsx`, `CapturedBreath.tsx`           | Separate reference examples, real trends, shared comparison axes, responsive linked traces and keyboard inspection.                                                  |
| `components/stage/task-flow.module.css`, `components/MechanicalVentilationModuleFrame.tsx`, `components/mechanical-ventilation-module.module.css` | MV-only document layout, focus, contrast, compact flow and local native-console width gate.                                                                          |
| `components/MechanicalVentilatorConsole.tsx`, `BedsidePanel.tsx`                                                                                  | Native-authority teaching controls, preserved pending confirmation, conditional teaching annotations/findings, supported assessment and accessible region semantics. |
| `components/MechanicalVentilationCaseActivityV2.tsx`, `CaseWorkflow.tsx`, `VentilationCaseLayout.tsx`, `case-flow.module.css`                     | Current case task, prominent management console, full-width debrief, transfer playback and saved-clock continuity.                                                   |
| `content/sectionSpecs.ts`, `components/stage/FoundationTeaching.tsx`, `components/teaching/waveform-anatomy.tsx`, `IdealizedComparison.tsx`       | Location wording and learner-facing simulation labels, with clinical meaning retained.                                                                               |
| Modified `__tests__` and five `test-support/*browser.mjs` harnesses                                                                               | Replace obsolete pane assertions with explicit behavior checks; preserve and extend history, disclosure, native control and action tests.                            |

No files in the simulation engine, device profiles, runtime cases, evidence registry, source-claim registry, question definitions, persistence schema, backend, global stylesheet, route implementation, or deployment configuration are changed.

## Clinical-copy review inventory

These changes need physician review in their rendered context; automated checks do not supply that review:

1. General prerequisite explanation/checklists and existing separate examples move before independent tasks. Added normal-timing and passive-reference narration explains initiation, delivery, cycling and expiration without diagnosing the current patient.
2. Task instructions now point to nearby traces, controls and responses. Unit 13 points to patient context/bedside actions. Internal pane directions disappear from the new renderer.
3. Numeric readout qualifiers distinguish selected settings, delivered values, model estimates and acquired interpretable or unsuitable holds. The unchanged original targets remain source scoped.
4. Unit 6 explicitly uses authored PBW and identifies the absent height input. Unit 9/10 text distinguishes delivery from slower modeled gas response, preserves model limitations, and says the simulation clock does not establish a clinical blood-gas schedule.
5. Timing effort is labeled an educator/model signal; baseline/current and retained before/after traces are named explicitly. Captured-interval feedback now cites the actual stored selected interval.
6. Independent bedside panels show total measured rate instead of presenting neural model rate as a patient measurement. Pain and delirium scores in this surface require the existing assessment action; pre-action conditional findings are withheld.
7. Case and transfer working titles use existing neutral titles. Interpretation, bedside management, reassessment and debrief labels describe the current work; original causal/scoring content remains.
8. Three existing references replace the software word “engine” with “simulated patient” or “simulated maneuver.” The VC/PC assumptions, exclusions and mathematical/live distinction remain explicit.

## Gaps and review limits

- Authoring supplies PBW, not height, for the relevant lab patient. No new PBW derivation is fabricated. Adding height/reference-sex inputs would require a separately reviewed content change.
- The native case launch gate still recommends a larger screen below the existing usable viewport threshold. The Learn teaching workspace works at 320 px, but this is not a claim of full native case operation on a phone.
- Clinical model validity, human usability, bedside safety, device certification and non-English translation quality are unverified here. The existing clinical review/release status remains in force.
- Broader pre-existing critical-care learner-copy guard failures and local analytics limitations are recorded in the validation document. They are not hidden by exemptions or unrelated edits.

## Rollback

For local Learn comparison, pass `renderer="legacy"` to `VentilationStageHost`; its default is `task`. Both presentations use the same unit key, reducer and evidence, so switching the prop does not reset the patient or award credit. This is a code-level review switch, not another learner mode or route. The legacy renderer remains the previous three-pane presentation.

A full rollback reverts this feature-only commit, including the case layout change. No storage migration or history rewrite is required. All added persisted actions are already supported commands. Do not erase v1 archives, v2 evidence or case history during rollback. The case layout does not maintain a second implementation of scoring or patient state.
