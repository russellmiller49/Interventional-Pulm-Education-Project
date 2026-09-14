# ECMO activity flow redesign

Implemented September 13–14, 2026 against `d209c8006e693e9d4ee8a250347911e191508029` on `codex/ecmo-activity-flow`. The user requested review and implementation of ECMO updates; the supplied CARDIOHELP flow brief defined the requested implementation scope. Its activity-specific layout supersedes permanent Steps / Teaching / Simulator panes. It does not authorize clinical model changes, release changes, merging, or deployment.

## Scope and design

The intended audience remains clinicians and trainees learning the module's simulated adult VV and peripheral femoral VA circuits. This is a delivery change to existing teaching, not a new treatment protocol or competence claim. All 30 unique Learn sections and 214 existing task IDs have an explicit presentation. The four shared sections occur in both 17-section pathways. All 14 clinical Practice cases and both Assess capstones use the same existing case stages with a stage-specific layout.

The first implemented and verified slice was the eight-task `blood-flow-versus-sweep` section. The same feature-local adapter was then applied to the other shared foundations, the six track foundations, all twenty drills, and Practice/Challenge. No shared workspace, global stylesheet, route implementation, backend, or dependency was changed.

| Previous delivery                                            | New delivery                                                                                             | Why                                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Always-visible chapter, console and step list                | `concept`: current explanation/question in reading order                                                 | Keep independent application beside its question; omit unrelated controls.                    |
| Independent outer task and inner walk Next buttons           | `circuit-walk`: one progression through all four blood stops, then gas, pressure sites and readings      | The existing map, explanation and later response form form one activity.                      |
| Run button, action results and reading split across panes    | `comparison-lab`: purpose, actual Run, retained baseline/result, units, modeled duration and explanation | Read the result next to the action that produced it.                                          |
| Console shrunk to a fixed residual pane                      | `guided-device`: instruction paired with readable native-size console and selected surfaces              | Preserve every hardware control; bounded horizontal console scrolling is keyboard accessible. |
| Brief, controls and debrief in the same residual case column | `clinical-case`: brief/plan together, management/reassessment with simulator, wide debrief after reveal  | Follow the existing case state rather than requiring pane switching.                          |

`activityPresentation.ts` maps authored task IDs (shared foundations), registered phase IDs (track foundations), and explicit registered drill IDs plus their existing control targets. It never infers clinical intent from visible words. `ActivityContent` and the presentation branch of the existing `StageLayout` compose the existing Now card, teaching and simulator surfaces. The simulation hooks remain mounted at the host level. Breakpoints change CSS layout, not React trees, action dispatches, or session ownership.

The hub uses **Start** before any saved visit/completion and **Continue** for existing progress, with the same pathway resolver. The lesson map and task recap are secondary disclosures. Clinical/device sources remain available in the footer; in the flowing layout they expand into the document instead of a nested text scroller. Device boundaries remain explicit. Emergency drills keep a sticky flow/alarm/clock strip below the site header. The accessible clamp/resumption controls now sit outside the optional 3D launch gate and retain their exact existing commitment and interlock predicates. Before commitment, their descriptive instruction is replaced by a neutral availability message, so moving the controls cannot disclose an isolation answer. Standalone 3D rendering still includes that same shared control group by default.

## Preservation and gates

No physiology equation, threshold, interlock, action semantic, device profile, source registry, grading rule, progress schema, URL, track canonicalization rule or curriculum prerequisite changed. Existing local first-response and historical attempt records remain authoritative. A page visit is not completion. The feature remains draft/unlisted and non-credit-eligible; this work neither resolves clinical review holds nor updates the empty human-validation instruments. Draft PR #94 and its frozen artifacts are untouched. The current R0/R4 and subsequent owner-decision documents remain the record for held disagreements; the older three-pane requirement is the layout contract superseded here.

- **Shared foundations:** current authored read tasks retain read-only continuation. The blood-path read task now progresses through drainage, pump, membrane and return before the next authored task; the four stops add no persisted task IDs or mastery credit. Pressure-site inspection remains selectable without an artificial all-clicked gate. Predictions, component attribution and transfer require actual learner selections. Correct-site marks, keys and explanations follow the original commitment boundary.
- **Comparisons:** independent Run controls use the existing restored baseline and engine snapshots; Continue is absent until a required comparison exists. Repeat restores the original baseline; Reset clears only that comparison. Back keeps saved comparisons and first commitments. Sweep and oxygen-fraction controls retain their external gas-blender location; teaching Run is explicitly labelled as a lesson control, not CARDIOHELP hardware. The return-resistance preview, independent −300 rpm question and separate comparison are retained.
- **Track foundations:** the six existing semantic phases and gates are unchanged. Normal-state Recognize presents drainage/load, membrane/return, gas and patient groups, plus the VA parallel-circulation group, then the combined run. The topology paragraph appears at the first group only. Existing state loaders, capture, clock and restore controls remain accessible. The pre-existing runtime allows continuation from some bounded-action phases without requiring each optional exploration; this presentation does not invent a new completion criterion.
- **Drills:** original read/model-advance/physical-control/observation/prediction/transfer actions and the data-driven Explain remain. Physical actions complete from the actual simulator predicate. Required views are added from existing task targets. Diagnosis-bearing mechanism material remains gated by commitment. A mechanism-matched Practice case is distinguished from an honest next case in the unit.
- **Cases:** the existing brief (clinical cases), plan, manage, reassess and debrief stages remain. Brief facts and the plan share a card; written initiation orders remain visible in Practice and Challenge. Management opens only after plan commitment. Corrective/required actions, support establishment, observation interval, reassessment submission and reveal retain their current authority. The case can advance automatically to Reassess when management is complete, as before. No correctness is added before debrief in Challenge. Revealed debrief has one follow-through and one replay control; the duplicate reveal action is removed.

The current task and response receive focus on deliberate transitions/results. Circuit view changes no longer schedule a second document scroll in the flowing host. The 2D retrieval map and ordinary radio controls work without opening 3D. Hardware controls are not recreated for responsive layouts. pArt remains a circuit pressure, delta pressure remains unavailable when inputs cannot report, and measurement unavailability uses the existing channel formatters rather than displaying a normal-looking zero.

During drill action, observation and transfer, operational views precede longer reference teaching in the document. At phone widths the existing signal-register rows become labelled blocks, keeping the original measured-at, current-value and interpretation fields readable. These are DOM/CSS presentation changes in `ActivityContent`, `ActivityFlow.module.css` and `drillPanelPrimitives.tsx`; the signal definitions and action predicates are unchanged.

## Registered pathways

### VV pathway

`why-extracorporeal-support` → `circuit-flow-path` → `pump-and-pressure-zones` → `blood-flow-versus-sweep` → `vv-normal-state` → `vv-series-physiology` → `startup-sensor-orientation` → `preload-drainage-collapse` → `afterload-return-obstruction` → `afterload-oxygenator-resistance` → `vv-recirculation` → `acute-hypercapnia` → `compensated-hypercapnia` → `gas-source-interruption` → `arterial-bubble-stop` → `transport-power-loss` → `vv-integration-capstone`

### VA pathway

`why-extracorporeal-support` → `circuit-flow-path` → `pump-and-pressure-zones` → `blood-flow-versus-sweep` → `va-normal-state` → `va-parallel-physiology` → `va-startup-sensor-orientation` → `va-preload-drainage-collapse` → `va-afterload-arterial-return-obstruction` → `va-afterload-oxygenator-resistance` → `va-differential-hypoxemia` → `va-lv-loading` → `va-acute-hypercapnia` → `va-gas-source-interruption` → `va-arterial-bubble-stop` → `va-transport-power-loss` → `va-integration-capstone`

## Complete Learn task inventory

Every row previously used the three-pane stage. Below, the task title is its existing immediate objective, the semantic phase stays internal, and the new presentation lists its initial essential surfaces. Guided help can also expose the existing required target. Section sources are the unchanged union collected by `content/stageSources.ts`; prediction/transfer item sources are included there. More detailed claim-to-source and source-access mappings remain in the original registries and panels, not duplicated into a new evidence store.

Gate notation: **open** means no prior prediction gate; **after prediction** means the original section commitment is required. Read tasks continue on acknowledgement; prediction/transfer/attribution tasks require the learner's selection and preserve the first response. A physical task must satisfy its existing real-control predicate; a model action uses its authored action list. The final transfer records the existing section/lesson completion. It does not establish mastery. The known gas-to-air transfer limitation is listed below.

### `why-extracorporeal-support` — Why extracorporeal support exists

Tracks: VV, VA. Objective: Tell which component of oxygen delivery is impaired from a saturation, a hemoglobin and a cardiac output, and which of those a circuit can stand in for

Prerequisites: None. Sources: `ecmo-book-ch9`, `elso-circuit-2022`, `bounded-educational-model`, `ecmo-book-ch16`, `ecmo-book-ch17`, `elso-adult-vv-2021`, `elso-adult-va-2021`.

Follow-through: existing next-section/capstone navigation; no paired clinical case in this lesson adapter.

| Stable task ID / immediate objective                                   | Phase     | New presentation / surfaces          | Existing interaction and gate                        |
| ---------------------------------------------------------------------- | --------- | ------------------------------------ | ---------------------------------------------------- |
| `why-extracorporeal-support-recognize`<br>Start with oxygen delivery   | recognize | concept; current teaching / question | read: Continue. open.                                |
| `why-extracorporeal-support-worked-example`<br>Follow a worked example | explain   | concept; current teaching / question | read: Continue. open.                                |
| `why-extracorporeal-support-predict`<br>Apply the relationship         | predict   | concept; current teaching / question | prediction: Submit answer. open.                     |
| `why-extracorporeal-support-act`<br>Identify what each change affects  | act       | concept; current teaching / question | attribution: Submit these answers. after prediction. |
| `why-extracorporeal-support-transfer`<br>Consider a different patient  | transfer  | concept; current teaching / question | transfer-item: Submit answer. after prediction.      |

### `circuit-flow-path` — Drainage → pump → membrane lung → return: a walk round the circuit

Tracks: VV, VA. Objective: Name where on the path a displayed reading is taken before reading its value; tell a drainage-side reading from a return-side one

Prerequisites: `why-extracorporeal-support`. Sources: `ecmo-book-ch9`, `elso-circuit-2022`, `bounded-educational-model`, `ecmo-book-ch16`.

Follow-through: existing next-section/capstone navigation; no paired clinical case in this lesson adapter.

| Stable task ID / immediate objective                                 | Phase     | New presentation / surfaces          | Existing interaction and gate                   |
| -------------------------------------------------------------------- | --------- | ------------------------------------ | ----------------------------------------------- |
| `circuit-flow-path-recognize`<br>Follow the blood                    | recognize | circuit-walk; circuit                | read: Continue. open.                           |
| `circuit-flow-path-gas-path`<br>Follow the separate gas path         | explain   | circuit-walk; circuit                | read: Continue. open.                           |
| `circuit-flow-path-pressure-sites`<br>Find the pressure measurements | act       | circuit-walk; circuit                | read: Continue. open.                           |
| `circuit-flow-path-observe`<br>Compare circuit and patient readings  | observe   | circuit-walk; circuit, monitor       | read: Continue. open.                           |
| `circuit-flow-path-predict`<br>Locate a measurement from memory      | predict   | circuit-walk; circuit                | prediction: Submit answer. open.                |
| `circuit-flow-path-transfer`<br>Interpret a different reading        | transfer  | concept; current teaching / question | transfer-item: Submit answer. after prediction. |

### `pump-and-pressure-zones` — The pump, and the pressures either side of it

Tracks: VV, VA. Objective: Distinguish a change confined to the drainage zone from one that moves both post-pump pressures together, and from one that widens the gradient across the membrane

Prerequisites: `circuit-flow-path`. Sources: `ecmo-book-ch9`, `elso-circuit-2022`, `bounded-educational-model`, `ecmo-book-ch16`, `ecmo-book-ch17`, `elso-adult-vv-2021`, `ifu-anomaly-boundary`, `ecmo-book-ch18`.

Follow-through: existing next-section/capstone navigation; no paired clinical case in this lesson adapter.

| Stable task ID / immediate objective                                  | Phase     | New presentation / surfaces                 | Existing interaction and gate                                         |
| --------------------------------------------------------------------- | --------- | ------------------------------------------- | --------------------------------------------------------------------- |
| `pump-and-pressure-zones-recognize`<br>Read the settled reference     | recognize | circuit-walk; circuit                       | read: Continue. open.                                                 |
| `pump-and-pressure-zones-act`<br>Watch one speed change               | act       | comparison-lab; current teaching / question | bounded-actions: Increase pump speed by 300 rpm. open.                |
| `pump-and-pressure-zones-observe`<br>Compare the result               | observe   | comparison-lab; current teaching / question | read: Continue. open.                                                 |
| `pump-and-pressure-zones-loading`<br>Keep speed, change the load      | act       | comparison-lab; current teaching / question | bounded-actions: Read the same speed against a resisted return. open. |
| `pump-and-pressure-zones-predict`<br>Predict a different speed change | predict   | concept; current teaching / question        | prediction: Submit answer. open.                                      |
| `pump-and-pressure-zones-decrease`<br>Check the speed decrease        | act       | comparison-lab; current teaching / question | bounded-actions: Decrease pump speed by 300 rpm. after prediction.    |
| `pump-and-pressure-zones-transfer`<br>Apply the loading principle     | transfer  | circuit-walk; circuit                       | transfer-item: Submit answer. after prediction.                       |

### `blood-flow-versus-sweep` — The control panel: the three things you can change

Tracks: VV, VA. Objective: Given a rising CO₂ with steady oxygenation, or the reverse, decide which of the three settings to reach for, and recognise when none of them is

Prerequisites: `pump-and-pressure-zones`. Sources: `ecmo-book-ch9`, `elso-circuit-2022`, `bounded-educational-model`, `ecmo-book-ch16`, `elso-adult-vv-2021`, `ecmo-book-ch17`, `ecmo-book-ch18`, `ifu-console-workflow`.

Follow-through: existing next-section/capstone navigation; no paired clinical case in this lesson adapter.

| Stable task ID / immediate objective                                     | Phase     | New presentation / surfaces                 | Existing interaction and gate                                   |
| ------------------------------------------------------------------------ | --------- | ------------------------------------------- | --------------------------------------------------------------- |
| `blood-flow-versus-sweep-recognize`<br>Find the three adjustments        | recognize | guided-device; console, gas                 | read: Continue. open.                                           |
| `blood-flow-versus-sweep-pump`<br>Watch the pump-speed comparison        | act       | comparison-lab; current teaching / question | bounded-actions: Increase pump speed by 200 rpm. open.          |
| `blood-flow-versus-sweep-sweep`<br>Watch the sweep comparison            | act       | comparison-lab; current teaching / question | bounded-actions: Increase sweep by 1 L/min. open.               |
| `blood-flow-versus-sweep-oxygen`<br>Watch the oxygen-fraction comparison | act       | comparison-lab; current teaching / question | bounded-actions: Run the oxygen-fraction comparison. open.      |
| `blood-flow-versus-sweep-predict`<br>Choose a control for a new example  | predict   | concept; current teaching / question        | prediction: Submit answer. open.                                |
| `blood-flow-versus-sweep-sweep-story`<br>Try the sweep story             | observe   | comparison-lab; current teaching / question | bounded-actions: Double the sweep. after prediction.            |
| `blood-flow-versus-sweep-speed-story`<br>Try the speed story             | observe   | comparison-lab; current teaching / question | bounded-actions: Raise pump speed by 400 rpm. after prediction. |
| `blood-flow-versus-sweep-transfer`<br>Interpret the flow display         | transfer  | concept; current teaching / question        | transfer-item: Submit answer. after prediction.                 |

### `vv-normal-state` — A stable VV run: the baseline you read everything against

Tracks: VV. Objective: Distinguish a value that has moved from this run's own baseline from one that merely differs from a number you carry

Prerequisites: `blood-flow-versus-sweep`. Sources: `ecmo-book-ch9`, `elso-circuit-2022`, `bounded-educational-model`, `elso-adult-vv-2021`, `ecmo-book-ch18`.

Follow-through: existing next-section/capstone navigation; no paired clinical case in this lesson adapter.

| Stable task ID / immediate objective                                                              | Phase     | New presentation / surfaces                              | Existing interaction and gate                                                                                                       |
| ------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `vv-normal-state-recognize`<br>Decide which signals belong in a baseline review.                  | recognize | concept; one baseline group → combined console + patient | read: Continue. open.                                                                                                               |
| `vv-normal-state-predict`<br>Decide what a single unfamiliar absolute value establishes.          | predict   | concept; current teaching / question                     | prediction: Commit this prediction. open.                                                                                           |
| `vv-normal-state-act`<br>Capture this circuit’s own starting values and watch them over a window. | act       | comparison-lab; current teaching / question              | bounded-actions: Capture reference snapshot; Run 20 modeled seconds; Compare with snapshot; Restore VV reference. after prediction. |
| `vv-normal-state-observe`<br>Read the raw change in each signal over the observed window.         | observe   | comparison-lab; current teaching / question              | read: Continue. after prediction.                                                                                                   |
| `vv-normal-state-explain`<br>State what belongs to a stable run beyond the circuit display.       | explain   | guided-device; monitor                                   | read: Continue. after prediction.                                                                                                   |
| `vv-normal-state-transfer`<br>Recognize a stable baseline whose absolute values are unfamiliar.   | transfer  | concept; current teaching / question                     | transfer-item: Commit this answer. after prediction.                                                                                |

### `vv-series-physiology` — In series with the heart: what the flow number counts

Tracks: VV. Objective: Decide when a higher displayed flow means more support and when it does not, using the drainage-line saturation against the patient's own

Prerequisites: `vv-normal-state`. Sources: `ecmo-book-ch9`, `elso-circuit-2022`, `bounded-educational-model`, `elso-adult-vv-2021`, `ecmo-book-ch16`, `ecmo-book-ch17`.

Follow-through: existing next-section/capstone navigation; no paired clinical case in this lesson adapter.

| Stable task ID / immediate objective                                                                             | Phase     | New presentation / surfaces                 | Existing interaction and gate                                                            |
| ---------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `vv-series-physiology-recognize`<br>Trace the series circuit and name which flow the pump displays.              | recognize | concept; current teaching / question        | read: Continue. open.                                                                    |
| `vv-series-physiology-predict`<br>Decide what a higher displayed flow with a worsening patient means.            | predict   | concept; current teaching / question        | prediction: Commit this prediction. open.                                                |
| `vv-series-physiology-act`<br>Load the recirculation preview and read it beside the reference.                   | act       | comparison-lab; current teaching / question | bounded-actions: Load the recirculation preview; Restore VV reference. after prediction. |
| `vv-series-physiology-observe`<br>Compare the two states signal by signal.                                       | observe   | comparison-lab; current teaching / question | read: Continue. after prediction.                                                        |
| `vv-series-physiology-explain`<br>State what VV support does and does not do for the circulation.                | explain   | concept; current teaching / question        | read: Continue. after prediction.                                                        |
| `vv-series-physiology-transfer`<br>Separate a real increase in useful support from an increase in recirculation. | transfer  | comparison-lab; current teaching / question | transfer-item: Commit this answer. after prediction.                                     |

### `startup-sensor-orientation` — Meet the console, the circuit, and the external controls

Tracks: VV. Objective: Say, for each reading on the startup screen, which domain produced it, and which readings a stopped pump cannot produce

Prerequisites: `blood-flow-versus-sweep`, `vv-normal-state`. Sources: `ifu-console-workflow`, `ifu-us-2025-scope`, `ecmo-book-ch9`, `bounded-educational-model`.

Follow-through: mechanism-match → `clinical-vv-initiation-ards` (Falling SpO₂ and rising PaCO₂ despite optimized conventional support).

| Stable task ID / immediate objective                                                      | Phase     | New presentation / surfaces              | Existing interaction and gate                                                   |
| ----------------------------------------------------------------------------------------- | --------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| `startup-orient-domains`<br>Start with four sources of information                        | recognize | guided-device; console, circuit          | read: I can identify all four sources. open.                                    |
| `startup-screen-parameters`<br>The pump is stopped: which channels still mean anything?   | recognize | guided-device; console, circuit          | simulator-task: SET_SCREEN. open.                                               |
| `startup-bring-circuit-up`<br>Bring a reference circuit up before touring the rest        | recognize | guided-device; console, circuit          | simulator-task: SET_RPM. open.                                                  |
| `startup-settle-circuit`<br>Let the circuit respond                                       | recognize | guided-device; console, circuit          | model-advance: STEP; STEP. open.                                                |
| `startup-screen-parameters-running`<br>Read the parameter list again, now that it reports | recognize | guided-device; console, circuit          | simulator-task: SET_SCREEN. open.                                               |
| `startup-screen-blood`<br>Review blood parameters                                         | recognize | guided-device; console, circuit          | simulator-task: SET_SCREEN. open.                                               |
| `startup-screen-transport`<br>Find transport power status                                 | recognize | guided-device; console, circuit          | simulator-task: SET_SCREEN. open.                                               |
| `startup-screen-interventions`<br>Locate intervention state                               | recognize | guided-device; console, circuit          | simulator-task: SET_SCREEN. open.                                               |
| `startup-screen-timers`<br>Review timers and menu surfaces                                | recognize | guided-device; console, circuit          | simulator-task: SET_SCREEN. open.                                               |
| `startup-screen-alarm-history`<br>Use alarm history as context                            | recognize | guided-device; console, circuit          | simulator-task: SET_SCREEN. open.                                               |
| `startup-physical-controls`<br>Map the physical controls                                  | recognize | guided-device; console, circuit          | simulator-task: SET_SCREEN. open.                                               |
| `startup-external-gas`<br>Separate sweep and sweep-gas FiO₂ from the console              | recognize | guided-device; console, circuit, gas     | read: I can distinguish the two gas controls. open.                             |
| `startup-return-to-pre-use`<br>End the demonstration and return to the pre-use state      | recognize | guided-device; console, circuit          | simulator-task: LOAD_SCENARIO. open.                                            |
| `startup-interpret`<br>Commit to a prediction before you act                              | predict   | guided-device; console, circuit          | prediction: Commit this prediction. open.                                       |
| `startup-respond`<br>Complete startup and the tip-to-tip check                            | act       | guided-device; console, circuit          | simulator-task: PERFORM_CHECK. after prediction.                                |
| `startup-reassess`<br>Confirm the whole system, not only the screen                       | observe   | guided-device; console, circuit, monitor | simulator-task: STEP. after prediction.                                         |
| `startup-sensor-orientation-explain`<br>What explains the pattern you worked              | explain   | guided-device; console, circuit          | read: I have read what explains it. after prediction.                           |
| `startup-transfer`<br>Carry the reasoning to a new circuit                                | transfer  | guided-device; console, circuit          | transfer-scenario: Load `preload-drainage-collapse`; SET_RPM. after prediction. |

### `preload-drainage-collapse` — Flow falls and the drainage line judders

Tracks: VV. Objective: Decide whether a falling flow is limited upstream or downstream of the pump before touching a setting

Prerequisites: `pump-and-pressure-zones`, `startup-sensor-orientation`. Sources: `ecmo-book-ch9`, `ecmo-book-ch17`, `bounded-educational-model`, `ecmo-book-ch16`, `elso-adult-vv-2021`.

Follow-through: mechanism-match → `clinical-vv-occult-hemorrhage` (New low flow, tachycardia and hypotension on day 4 of VV support).

| Stable task ID / immediate objective                                                                       | Phase     | New presentation / surfaces            | Existing interaction and gate                                                         |
| ---------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| `preload-drainage-collapse-observe`<br>Read the pattern before touching a control                          | recognize | circuit-walk; circuit, trends          | read: Inspect the starting pattern. open.                                             |
| `preload-drainage-collapse-interpret`<br>Commit to a prediction before you act                             | predict   | circuit-walk; circuit, trends          | prediction: Commit this prediction. open.                                             |
| `preload-drainage-collapse-reduce-rpm`<br>Reduce pump demand first                                         | act       | circuit-walk; console, circuit, trends | simulator-task: SET_RPM. after prediction.                                            |
| `preload-drainage-collapse-correct-drainage-cause`<br>Correct the drainage limitation                      | act       | circuit-walk; circuit, trends          | simulator-task: CORRECT_FAULT. after prediction.                                      |
| `preload-drainage-collapse-reassess`<br>Let the circuit respond, then reassess device, circuit and patient | observe   | circuit-walk; circuit, trends          | simulator-task: STEP. after prediction.                                               |
| `preload-drainage-collapse-explain`<br>What explains the pattern you worked                                | explain   | circuit-walk; circuit, trends          | read: I have read what explains it. after prediction.                                 |
| `preload-drainage-collapse-transfer`<br>Carry the reasoning to a new circuit                               | transfer  | circuit-walk; console, circuit, trends | transfer-scenario: Load `afterload-return-obstruction`; SET_SCREEN. after prediction. |

### `afterload-return-obstruction` — Two pressures rise together as flow falls

Tracks: VV. Objective: Decide from the two post-pump pressures and the gradient whether the load sits beyond the membrane or in it

Prerequisites: `pump-and-pressure-zones`, `preload-drainage-collapse`. Sources: `ecmo-book-ch9`, `ecmo-book-ch17`, `bounded-educational-model`, `elso-circuit-2022`.

Follow-through: next-in-unit → `clinical-vv-oxygenator-thrombosis` (Climbing Δp with visible fibrin, falling saturation leaving the circuit and increasing hemolysis markers).

| Stable task ID / immediate objective                                                                          | Phase     | New presentation / surfaces            | Existing interaction and gate                                                            |
| ------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `afterload-return-obstruction-observe`<br>Read the pattern before touching a control                          | recognize | circuit-walk; circuit, trends          | read: Inspect the starting pattern. open.                                                |
| `afterload-return-obstruction-interpret`<br>Commit to a prediction before you act                             | predict   | circuit-walk; circuit, trends          | prediction: Commit this prediction. open.                                                |
| `afterload-return-obstruction-correct-return-obstruction`<br>Inspect and clear the return path                | act       | circuit-walk; circuit, trends          | simulator-task: CORRECT_FAULT. after prediction.                                         |
| `afterload-return-obstruction-reassess`<br>Let the circuit respond, then reassess device, circuit and patient | observe   | circuit-walk; circuit, trends          | simulator-task: STEP. after prediction.                                                  |
| `afterload-return-obstruction-explain`<br>What explains the pattern you worked                                | explain   | circuit-walk; circuit, trends          | read: I have read what explains it. after prediction.                                    |
| `afterload-return-obstruction-transfer`<br>Carry the reasoning to a new circuit                               | transfer  | circuit-walk; console, circuit, trends | transfer-scenario: Load `afterload-oxygenator-resistance`; SET_SCREEN. after prediction. |

### `afterload-oxygenator-resistance` — One pressure pulls away from the other

Tracks: VV. Objective: Tell a gradient widened at matched flow from one widened because flow rose; decide whether one reading justifies an action

Prerequisites: `afterload-return-obstruction`. Sources: `ifu-anomaly-boundary`, `ecmo-book-ch9`, `ecmo-book-ch17`, `elso-circuit-2022`, `bounded-educational-model`, `ecmo-book-ch18`.

Follow-through: mechanism-match → `clinical-vv-oxygenator-thrombosis` (Climbing Δp with visible fibrin, falling saturation leaving the circuit and increasing hemolysis markers).

| Stable task ID / immediate objective                                                                             | Phase     | New presentation / surfaces            | Existing interaction and gate                                             |
| ---------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------- | ------------------------------------------------------------------------- |
| `afterload-oxygenator-resistance-observe`<br>Read the pattern before touching a control                          | recognize | circuit-walk; circuit, trends          | read: Inspect the starting pattern. open.                                 |
| `afterload-oxygenator-resistance-interpret`<br>Commit to a prediction before you act                             | predict   | circuit-walk; circuit, trends          | prediction: Commit this prediction. open.                                 |
| `afterload-oxygenator-resistance-correct-oxygenator-resistance`<br>Escalate the oxygenator/circuit cause         | act       | circuit-walk; circuit, trends          | simulator-task: CORRECT_FAULT. after prediction.                          |
| `afterload-oxygenator-resistance-reassess`<br>Let the circuit respond, then reassess device, circuit and patient | observe   | circuit-walk; circuit, trends          | simulator-task: STEP. after prediction.                                   |
| `afterload-oxygenator-resistance-explain`<br>What explains the pattern you worked                                | explain   | circuit-walk; circuit, trends          | read: I have read what explains it. after prediction.                     |
| `afterload-oxygenator-resistance-transfer`<br>Carry the reasoning to a new circuit                               | transfer  | circuit-walk; console, circuit, trends | transfer-scenario: Load `vv-recirculation`; SET_SCREEN. after prediction. |

### `vv-recirculation` — Flow is up and the patient is worse

Tracks: VV. Objective: Decide whether a reassuring flow number and a worsening patient are telling you about the pump or about where the returned blood goes

Prerequisites: `vv-series-physiology`, `preload-drainage-collapse`. Sources: `ecmo-book-ch17`, `elso-adult-vv-2021`, `bounded-educational-model`, `ecmo-book-ch18`.

Follow-through: mechanism-match → `clinical-vv-recirculation-migration` (Falling SpO₂ after repositioning while displayed flow and post-oxygenator saturation stay high).

| Stable task ID / immediate objective                                                              | Phase     | New presentation / surfaces          | Existing interaction and gate                                             |
| ------------------------------------------------------------------------------------------------- | --------- | ------------------------------------ | ------------------------------------------------------------------------- |
| `vv-recirculation-observe`<br>Read the pattern before touching a control                          | recognize | guided-device; circuit, monitor      | read: Inspect the starting pattern. open.                                 |
| `vv-recirculation-interpret`<br>Commit to a prediction before you act                             | predict   | guided-device; circuit, monitor      | prediction: Commit this prediction. open.                                 |
| `vv-recirculation-correct-recirculation`<br>Correct the recirculation cause                       | act       | guided-device; circuit, monitor      | simulator-task: CORRECT_FAULT. after prediction.                          |
| `vv-recirculation-reassess`<br>Let the circuit respond, then reassess device, circuit and patient | observe   | guided-device; circuit, monitor      | simulator-task: STEP. after prediction.                                   |
| `vv-recirculation-explain`<br>What explains the pattern you worked                                | explain   | guided-device; circuit, monitor      | read: I have read what explains it. after prediction.                     |
| `vv-recirculation-transfer`<br>Carry the reasoning to a new circuit                               | transfer  | guided-device; circuit, monitor, gas | transfer-scenario: Load `acute-hypercapnia`; SET_SWEEP. after prediction. |

### `acute-hypercapnia` — CO₂ climbing, pH falling, patient struggling

Tracks: VV. Objective: Choose the control for a CO₂ problem and decide how fast to correct it

Prerequisites: `blood-flow-versus-sweep`. Sources: `ecmo-book-ch16`, `ecmo-book-ch18`, `elso-adult-vv-2021`, `bounded-educational-model`.

Follow-through: next-in-unit → `clinical-vv-gas-disconnection` (Abrupt rise in PaCO₂ and falling pH with RPM, flow and circuit pressures unchanged).

| Stable task ID / immediate objective                                                               | Phase     | New presentation / surfaces                  | Existing interaction and gate                                                    |
| -------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| `acute-hypercapnia-observe`<br>Read the pattern before touching a control                          | recognize | guided-device; gas, monitor, trends          | read: Inspect the starting pattern. open.                                        |
| `acute-hypercapnia-interpret`<br>Commit to a prediction before you act                             | predict   | guided-device; gas, monitor, trends          | prediction: Commit this prediction. open.                                        |
| `acute-hypercapnia-increase-sweep`<br>Increase external sweep flow                                 | act       | guided-device; gas, monitor, trends          | simulator-task: SET_SWEEP. after prediction.                                     |
| `acute-hypercapnia-reassess`<br>Let the circuit respond, then reassess device, circuit and patient | observe   | guided-device; gas, monitor, trends          | simulator-task: STEP. after prediction.                                          |
| `acute-hypercapnia-explain`<br>What explains the pattern you worked                                | explain   | guided-device; gas, monitor, trends          | read: I have read what explains it. after prediction.                            |
| `acute-hypercapnia-transfer`<br>Carry the reasoning to a new circuit                               | transfer  | guided-device; console, gas, monitor, trends | transfer-scenario: Load `compensated-hypercapnia`; SET_SCREEN. after prediction. |

### `compensated-hypercapnia` — High CO₂, normal pH, comfortable patient

Tracks: VV. Objective: Decide whether an elevated CO₂ calls for a setting change or for leaving a settled state alone

Prerequisites: `acute-hypercapnia`. Sources: `ecmo-book-ch18`, `bounded-educational-model`, `ecmo-book-ch16`, `elso-adult-vv-2021`, `ifu-console-workflow`.

Follow-through: next-in-unit → `clinical-vv-gas-disconnection` (Abrupt rise in PaCO₂ and falling pH with RPM, flow and circuit pressures unchanged).

| Stable task ID / immediate objective                                                                     | Phase     | New presentation / surfaces         | Existing interaction and gate                                                            |
| -------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `compensated-hypercapnia-observe`<br>Read the pattern before touching a control                          | recognize | guided-device; gas, monitor, trends | read: Inspect the starting pattern. open.                                                |
| `compensated-hypercapnia-interpret`<br>Commit to a prediction before you act                             | predict   | guided-device; gas, monitor, trends | prediction: Commit this prediction. open.                                                |
| `compensated-hypercapnia-hold-sweep`<br>Hold sweep and reassess the goal                                 | act       | guided-device; gas, monitor, trends | simulator-task: SET_SWEEP. after prediction.                                             |
| `compensated-hypercapnia-reassess`<br>Let the circuit respond, then reassess device, circuit and patient | observe   | guided-device; gas, monitor, trends | simulator-task: STEP. after prediction.                                                  |
| `compensated-hypercapnia-explain`<br>What explains the pattern you worked                                | explain   | guided-device; gas, monitor, trends | read: I have read what explains it. after prediction.                                    |
| `compensated-hypercapnia-transfer`<br>Carry the reasoning to a new circuit                               | transfer  | guided-device; gas, monitor, trends | transfer-scenario: Load `gas-source-interruption`; RESTORE_GAS_SOURCE. after prediction. |

### `gas-source-interruption` — Gas transfer falls while flow holds

Tracks: VV. Objective: Decide from unchanged pressures and worsening gas values whether the problem is in the blood path or somewhere the flow display cannot see

Prerequisites: `blood-flow-versus-sweep`, `acute-hypercapnia`. Sources: `ecmo-book-ch9`, `ecmo-book-ch18`, `elso-circuit-2022`, `bounded-educational-model`, `elso-adult-vv-2021`.

Follow-through: mechanism-match → `clinical-vv-gas-disconnection` (Abrupt rise in PaCO₂ and falling pH with RPM, flow and circuit pressures unchanged).

| Stable task ID / immediate objective                                                                     | Phase     | New presentation / surfaces                  | Existing interaction and gate                                                           |
| -------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `gas-source-interruption-observe`<br>Read the pattern before touching a control                          | recognize | guided-device; gas, monitor, trends          | simulator-task: STEP; STEP; STEP; STEP; STEP. open.                                     |
| `gas-source-interruption-interpret`<br>Commit to a prediction before you act                             | predict   | guided-device; gas, monitor, trends          | prediction: Commit this prediction. open.                                               |
| `gas-source-interruption-restore-gas-source`<br>Restore the verified gas source                          | act       | guided-device; gas, monitor, trends          | simulator-task: RESTORE_GAS_SOURCE. after prediction.                                   |
| `gas-source-interruption-reassess`<br>Let the circuit respond, then reassess device, circuit and patient | observe   | guided-device; gas, monitor, trends          | simulator-task: STEP. after prediction.                                                 |
| `gas-source-interruption-explain`<br>What explains the pattern you worked                                | explain   | guided-device; gas, monitor, trends          | read: I have read what explains it. after prediction.                                   |
| `gas-source-interruption-transfer`<br>Carry the reasoning to a new circuit                               | transfer  | guided-device; gas, monitor, trends, circuit | transfer-scenario: Load `arterial-bubble-stop`; TOGGLE_CIRCUIT_CLAMP. after prediction. |

### `arterial-bubble-stop` — Bubble alarm: the pump stopped itself

Tracks: VV. Objective: Tell the device's stop, the clamps that protect the patient, the air source and the restart apart as separate acts

Prerequisites: `startup-sensor-orientation`. Sources: `ifu-console-workflow`, `ifu-anomaly-boundary`, `elso-circuit-2022`, `bounded-educational-model`.

Follow-through: mechanism-match → `clinical-vv-circuit-air-embolism` (Bubble alarm and pump stop with air visible in the drainage limb during a bedside line exchange on VV).

| Stable task ID / immediate objective                                                                    | Phase     | New presentation / surfaces              | Existing interaction and gate                                                       |
| ------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `arterial-bubble-stop-observe`<br>Read the pattern before touching a control                            | recognize | guided-device; console, circuit          | simulator-task: STEP; STEP; STEP; STEP. open.                                       |
| `arterial-bubble-stop-interpret`<br>Commit to a prediction before you act                               | predict   | guided-device; console, circuit          | prediction: Commit this prediction. open.                                           |
| `arterial-bubble-stop-isolate-return-clamp`<br>Isolate the patient: clamp the return limb               | act       | guided-device; console, circuit          | simulator-task: TOGGLE_CIRCUIT_CLAMP. after prediction.                             |
| `arterial-bubble-stop-isolate-drainage-clamp`<br>Complete isolation: clamp the drainage limb            | act       | guided-device; console, circuit          | simulator-task: TOGGLE_CIRCUIT_CLAMP. after prediction.                             |
| `arterial-bubble-stop-correct-bubble-source`<br>Correct and clear the air source                        | act       | guided-device; console, circuit          | simulator-task: CORRECT_FAULT. after prediction.                                    |
| `arterial-bubble-stop-resume-support`<br>Resume support per the current IFU and approved local protocol | act       | guided-device; console, circuit          | simulator-task: RESUME_SUPPORT_AFTER_BUBBLE. after prediction.                      |
| `arterial-bubble-stop-reassess`<br>Let the circuit respond, then reassess device, circuit and patient   | observe   | guided-device; console, circuit, monitor | simulator-task: STEP. after prediction.                                             |
| `arterial-bubble-stop-explain`<br>What explains the pattern you worked                                  | explain   | guided-device; console, circuit          | read: I have read what explains it. after prediction.                               |
| `arterial-bubble-stop-transfer`<br>Carry the reasoning to a new circuit                                 | transfer  | guided-device; console, circuit          | transfer-scenario: Load `transport-power-loss`; RESTORE_AC_POWER. after prediction. |

### `transport-power-loss` — On battery, mid-transport

Tracks: VV. Objective: Decide what continued flow on reserve power does and does not buy, and which action secures support without trading it away

Prerequisites: `startup-sensor-orientation`. Sources: `ifu-console-workflow`, `ecmo-book-ch9`, `elso-circuit-2022`, `bounded-educational-model`.

Follow-through: next-in-unit → `clinical-vv-circuit-air-embolism` (Bubble alarm and pump stop with air visible in the drainage limb during a bedside line exchange on VV).

| Stable task ID / immediate objective                                                                  | Phase     | New presentation / surfaces              | Existing interaction and gate                                                          |
| ----------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `transport-power-loss-observe`<br>Read the pattern before touching a control                          | recognize | guided-device; console, circuit          | simulator-task: STEP; STEP; STEP. open.                                                |
| `transport-power-loss-interpret`<br>Commit to a prediction before you act                             | predict   | guided-device; console, circuit          | prediction: Commit this prediction. open.                                              |
| `transport-power-loss-restore-ac-power`<br>Restore verified AC and confirm backup readiness           | act       | guided-device; console, circuit          | simulator-task: RESTORE_AC_POWER. after prediction.                                    |
| `transport-power-loss-reassess`<br>Let the circuit respond, then reassess device, circuit and patient | observe   | guided-device; console, circuit, monitor | simulator-task: STEP. after prediction.                                                |
| `transport-power-loss-explain`<br>What explains the pattern you worked                                | explain   | guided-device; console, circuit          | read: I have read what explains it. after prediction.                                  |
| `transport-power-loss-transfer`<br>Carry the reasoning to a new circuit                               | transfer  | guided-device; console, circuit          | transfer-scenario: Load `startup-sensor-orientation`; PERFORM_CHECK. after prediction. |

### `vv-integration-capstone` — One presentation, four explanations: flow unchanged, patient worse

Tracks: VV. Objective: Separate four explanations by what each predicts elsewhere in the circuit and the patient

Prerequisites: `preload-drainage-collapse`, `afterload-return-obstruction`, `afterload-oxygenator-resistance`, `vv-recirculation`, `acute-hypercapnia`, `compensated-hypercapnia`, `gas-source-interruption`, `arterial-bubble-stop`, `transport-power-loss`. Sources: `ecmo-book-ch9`, `elso-circuit-2022`, `bounded-educational-model`, `elso-adult-vv-2021`, `ecmo-book-ch16`, `ecmo-book-ch17`, `ecmo-book-ch18`, `ifu-anomaly-boundary`.

Follow-through: existing next-section/capstone navigation; no paired clinical case in this lesson adapter.

| Stable task ID / immediate objective                                                                      | Phase     | New presentation / surfaces          | Existing interaction and gate                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vv-integration-capstone-recognize`<br>Establish that circuit flow alone cannot discriminate here.        | recognize | guided-device; monitor               | read: Continue. open.                                                                                                                                                                                                                                                                                                                               |
| `vv-integration-capstone-predict`<br>Commit to one of the four explanations before looking further.       | predict   | guided-device; monitor               | prediction: Commit this prediction. open.                                                                                                                                                                                                                                                                                                           |
| `vv-integration-capstone-act`<br>Gather the findings that separate the four explanations.                 | act       | guided-device; circuit, gas, monitor | bounded-actions: Inspect the gas-source connection; Compare venous-line and post-oxygenator saturations; Review pInt, pArt, and the gradient; Review the bedside and ventilator findings; Reveal the evolved state; Mechanism preview: recirculation; Mechanism preview: membrane resistance; Restore the case before the change. after prediction. |
| `vv-integration-capstone-observe`<br>Reveal how the case has evolved and read it against your prediction. | observe   | guided-device; circuit, gas, monitor | read: Continue. after prediction.                                                                                                                                                                                                                                                                                                                   |
| `vv-integration-capstone-explain`<br>Work the whole differential against what each explanation predicts.  | explain   | concept; current teaching / question | read: Continue. after prediction.                                                                                                                                                                                                                                                                                                                   |
| `vv-integration-capstone-transfer`<br>Apply the same discipline to a case with a different mechanism.     | transfer  | guided-device; monitor               | transfer-item: Commit this answer. after prediction.                                                                                                                                                                                                                                                                                                |

### `va-normal-state` — A stable VA run: VV plus two ideas

Tracks: VA. Objective: Say which signals belong to a stable VA state that a VV state does not have, and why each exists

Prerequisites: `blood-flow-versus-sweep`. Sources: `ecmo-book-ch9`, `elso-circuit-2022`, `bounded-educational-model`, `elso-adult-va-2021`, `elso-neuro-monitoring-2024`.

Follow-through: existing next-section/capstone navigation; no paired clinical case in this lesson adapter.

| Stable task ID / immediate objective                                                                 | Phase     | New presentation / surfaces                              | Existing interaction and gate                                                                                                       |
| ---------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `va-normal-state-recognize`<br>Decide which signals belong in a VA baseline review.                  | recognize | concept; one baseline group → combined console + patient | read: Continue. open.                                                                                                               |
| `va-normal-state-predict`<br>Decide what an unremarkable circuit display establishes about a VA run. | predict   | concept; current teaching / question                     | prediction: Commit this prediction. open.                                                                                           |
| `va-normal-state-act`<br>Capture this circuit’s own starting values and watch them over a window.    | act       | comparison-lab; current teaching / question              | bounded-actions: Capture reference snapshot; Run 20 modeled seconds; Compare with snapshot; Restore VA reference. after prediction. |
| `va-normal-state-observe`<br>Read the raw change in each signal over the observed window.            | observe   | comparison-lab; current teaching / question              | read: Continue. after prediction.                                                                                                   |
| `va-normal-state-explain`<br>State what belongs to a stable VA run beyond the circuit display.       | explain   | guided-device; monitor                                   | read: Continue. after prediction.                                                                                                   |
| `va-normal-state-transfer`<br>Recognize a stable VA baseline whose absolute values are unfamiliar.   | transfer  | concept; current teaching / question                     | transfer-item: Commit this answer. after prediction.                                                                                |

### `va-parallel-physiology` — In parallel with the heart: who fills the aorta

Tracks: VA. Objective: Separate a loading problem from an oxygenation one when the circuit display has not moved, naming the two signals that decide it

Prerequisites: `va-normal-state`. Sources: `ecmo-book-ch9`, `elso-circuit-2022`, `bounded-educational-model`, `elso-adult-va-2021`, `ecmo-book-ch17`, `elso-dual-circulation-2024`, `elso-maastricht-nomenclature-2019`, `elso-neuro-monitoring-2024`.

Follow-through: existing next-section/capstone navigation; no paired clinical case in this lesson adapter.

| Stable task ID / immediate objective                                                                                       | Phase     | New presentation / surfaces                 | Existing interaction and gate                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `va-parallel-physiology-recognize`<br>Trace the two circulations and find where they meet.                                 | recognize | concept; current teaching / question        | read: Continue. open.                                                                                                         |
| `va-parallel-physiology-predict`<br>Decide what an unchanged circuit display with a falling upper-body saturation means.   | predict   | concept; current teaching / question        | prediction: Commit this prediction. open.                                                                                     |
| `va-parallel-physiology-act`<br>Load the two consequences of parallelism and read each beside the reference.               | act       | comparison-lab; current teaching / question | bounded-actions: Load the differential-oxygenation preview; Load the loading preview; Restore VA reference. after prediction. |
| `va-parallel-physiology-observe`<br>Compare the upper-body and lower-body saturations, and the pulsatility, in each state. | observe   | comparison-lab; current teaching / question | read: Continue. after prediction.                                                                                             |
| `va-parallel-physiology-explain`<br>State what parallel circulation adds and what it costs.                                | explain   | concept; current teaching / question        | read: Continue. after prediction.                                                                                             |
| `va-parallel-physiology-transfer`<br>Separate a loading problem from an oxygenation one.                                   | transfer  | comparison-lab; current teaching / question | transfer-item: Commit this answer. after prediction.                                                                          |

### `va-startup-sensor-orientation` — Meet the console on a VA circuit

Tracks: VA. Objective: Say which extra things must be established by hand before support starts on VA, and which the console cannot show

Prerequisites: `va-normal-state`, `va-parallel-physiology`. Sources: `ifu-console-workflow`, `ecmo-book-ch9`, `elso-adult-va-2021`, `bounded-educational-model`.

Follow-through: mechanism-match → `va-clinical-initiation-shock` (Critically low MAP, rising lactate and a narrow pulse pressure despite conventional resuscitation).

| Stable task ID / immediate objective                                                         | Phase     | New presentation / surfaces              | Existing interaction and gate                                                      |
| -------------------------------------------------------------------------------------------- | --------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `va-startup-orient-domains`<br>Start with four sources of information                        | recognize | guided-device; console, circuit          | read: I can identify all four sources. open.                                       |
| `va-startup-screen-parameters`<br>The pump is stopped: which channels still mean anything?   | recognize | guided-device; console, circuit          | simulator-task: SET_SCREEN. open.                                                  |
| `va-startup-bring-circuit-up`<br>Bring a reference circuit up before touring the rest        | recognize | guided-device; console, circuit          | simulator-task: SET_RPM. open.                                                     |
| `va-startup-settle-circuit`<br>Let the circuit respond                                       | recognize | guided-device; console, circuit          | model-advance: STEP; STEP. open.                                                   |
| `va-startup-screen-parameters-running`<br>Read the parameter list again, now that it reports | recognize | guided-device; console, circuit          | simulator-task: SET_SCREEN. open.                                                  |
| `va-startup-screen-blood`<br>Review blood parameters                                         | recognize | guided-device; console, circuit          | simulator-task: SET_SCREEN. open.                                                  |
| `va-startup-screen-transport`<br>Find transport power status                                 | recognize | guided-device; console, circuit          | simulator-task: SET_SCREEN. open.                                                  |
| `va-startup-screen-interventions`<br>Locate intervention state                               | recognize | guided-device; console, circuit          | simulator-task: SET_SCREEN. open.                                                  |
| `va-startup-screen-timers`<br>Review timers and menu surfaces                                | recognize | guided-device; console, circuit          | simulator-task: SET_SCREEN. open.                                                  |
| `va-startup-screen-alarm-history`<br>Use alarm history as context                            | recognize | guided-device; console, circuit          | simulator-task: SET_SCREEN. open.                                                  |
| `va-startup-physical-controls`<br>Map the physical controls                                  | recognize | guided-device; console, circuit          | simulator-task: SET_SCREEN. open.                                                  |
| `va-startup-external-gas`<br>Separate sweep and sweep-gas FiO₂ from the console              | recognize | guided-device; console, circuit, gas     | read: I can distinguish the two gas controls. open.                                |
| `va-startup-return-to-pre-use`<br>End the demonstration and return to the pre-use state      | recognize | guided-device; console, circuit          | simulator-task: LOAD_SCENARIO. open.                                               |
| `va-startup-interpret`<br>Commit to a prediction before you act                              | predict   | guided-device; console, circuit          | prediction: Commit this prediction. open.                                          |
| `va-startup-respond`<br>Complete startup and the tip-to-tip check                            | act       | guided-device; console, circuit          | simulator-task: PERFORM_CHECK. after prediction.                                   |
| `va-startup-reassess`<br>Confirm the whole system, not only the screen                       | observe   | guided-device; console, circuit, monitor | simulator-task: STEP. after prediction.                                            |
| `va-startup-sensor-orientation-explain`<br>What explains the pattern you worked              | explain   | guided-device; console, circuit          | read: I have read what explains it. after prediction.                              |
| `va-startup-transfer`<br>Carry the reasoning to a new circuit                                | transfer  | guided-device; console, circuit          | transfer-scenario: Load `va-preload-drainage-collapse`; SET_RPM. after prediction. |

### `va-preload-drainage-collapse` — Flow falls on VA, and the patient’s pressure follows

Tracks: VA. Objective: Decide whether the endpoint of a holding move is the flow display or the patient

Prerequisites: `pump-and-pressure-zones`, `va-startup-sensor-orientation`. Sources: `ecmo-book-ch9`, `ecmo-book-ch17`, `elso-adult-va-2021`, `bounded-educational-model`, `elso-adult-vv-2021`.

Follow-through: mechanism-match → `va-clinical-tamponade` (Low VA flow, negative pVen, high CVP and an abrupt drop in chest-drain output after heart surgery).

| Stable task ID / immediate objective                                                                          | Phase     | New presentation / surfaces            | Existing interaction and gate                                                                     |
| ------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `va-preload-drainage-collapse-observe`<br>Read the pattern before touching a control                          | recognize | circuit-walk; circuit, trends          | read: Inspect the starting pattern. open.                                                         |
| `va-preload-drainage-collapse-interpret`<br>Commit to a prediction before you act                             | predict   | circuit-walk; circuit, trends          | prediction: Commit this prediction. open.                                                         |
| `va-preload-drainage-collapse-reduce-rpm`<br>Reduce pump demand first                                         | act       | circuit-walk; console, circuit, trends | simulator-task: SET_RPM. after prediction.                                                        |
| `va-preload-drainage-collapse-correct-drainage-cause`<br>Correct the venous drainage limitation               | act       | circuit-walk; circuit, trends          | simulator-task: CORRECT_FAULT. after prediction.                                                  |
| `va-preload-drainage-collapse-reassess`<br>Let the circuit respond, then reassess device, circuit and patient | observe   | circuit-walk; circuit, trends, monitor | simulator-task: STEP. after prediction.                                                           |
| `va-preload-drainage-collapse-explain`<br>What explains the pattern you worked                                | explain   | circuit-walk; circuit, trends          | read: I have read what explains it. after prediction.                                             |
| `va-preload-drainage-collapse-transfer`<br>Carry the reasoning to a new circuit                               | transfer  | circuit-walk; console, circuit, trends | transfer-scenario: Load `va-afterload-arterial-return-obstruction`; SET_SCREEN. after prediction. |

### `va-afterload-arterial-return-obstruction` — Two pressures rise together on the arterial side

Tracks: VA. Objective: Tell a circuit-return load from the patient's own afterload, using the independent monitor beside the circuit pressures

Prerequisites: `pump-and-pressure-zones`, `va-preload-drainage-collapse`. Sources: `ecmo-book-ch9`, `ecmo-book-ch17`, `elso-adult-va-2021`, `bounded-educational-model`, `elso-circuit-2022`, `ifu-console-workflow`.

Follow-through: next-in-unit → `va-clinical-vasoplegia` (Warm hypotension and a climbing lactate with a full pulse pressure and steady VA flow).

| Stable task ID / immediate objective                                                                                       | Phase     | New presentation / surfaces            | Existing interaction and gate                                                               |
| -------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `va-afterload-arterial-return-obstruction-observe`<br>Read the pattern before touching a control                           | recognize | circuit-walk; circuit, trends          | read: Inspect the starting pattern. open.                                                   |
| `va-afterload-arterial-return-obstruction-interpret`<br>Commit to a prediction before you act                              | predict   | circuit-walk; circuit, trends          | prediction: Commit this prediction. open.                                                   |
| `va-afterload-arterial-return-obstruction-clear-arterial-return`<br>Inspect the arterial return path and patient afterload | act       | circuit-walk; circuit, trends          | simulator-task: CORRECT_FAULT. after prediction.                                            |
| `va-afterload-arterial-return-obstruction-reassess`<br>Let the circuit respond, then reassess device, circuit and patient  | observe   | circuit-walk; circuit, trends          | simulator-task: STEP. after prediction.                                                     |
| `va-afterload-arterial-return-obstruction-explain`<br>What explains the pattern you worked                                 | explain   | circuit-walk; circuit, trends          | read: I have read what explains it. after prediction.                                       |
| `va-afterload-arterial-return-obstruction-transfer`<br>Carry the reasoning to a new circuit                                | transfer  | circuit-walk; console, circuit, trends | transfer-scenario: Load `va-afterload-oxygenator-resistance`; SET_SCREEN. after prediction. |

### `va-afterload-oxygenator-resistance` — One pressure pulls away from the other, on VA

Tracks: VA. Objective: Tell a gradient widened at matched flow from one widened because flow rose, then reassess the territories the circuit supplies

Prerequisites: `va-afterload-arterial-return-obstruction`. Sources: `ifu-anomaly-boundary`, `ecmo-book-ch9`, `elso-circuit-2022`, `bounded-educational-model`, `elso-adult-va-2021`.

Follow-through: mechanism-match → `va-clinical-oxygenator-thrombosis` (Climbing Δp and visible fibrin with flow constrained at the same RPM and a falling MAP on VA).

| Stable task ID / immediate objective                                                                                | Phase     | New presentation / surfaces            | Existing interaction and gate                                                      |
| ------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| `va-afterload-oxygenator-resistance-observe`<br>Read the pattern before touching a control                          | recognize | circuit-walk; circuit, trends          | read: Inspect the starting pattern. open.                                          |
| `va-afterload-oxygenator-resistance-interpret`<br>Commit to a prediction before you act                             | predict   | circuit-walk; circuit, trends          | prediction: Commit this prediction. open.                                          |
| `va-afterload-oxygenator-resistance-escalate-oxygenator`<br>Escalate the oxygenator/circuit problem                 | act       | circuit-walk; circuit, trends          | simulator-task: CORRECT_FAULT. after prediction.                                   |
| `va-afterload-oxygenator-resistance-reassess`<br>Let the circuit respond, then reassess device, circuit and patient | observe   | circuit-walk; circuit, trends          | simulator-task: STEP. after prediction.                                            |
| `va-afterload-oxygenator-resistance-explain`<br>What explains the pattern you worked                                | explain   | circuit-walk; circuit, trends          | read: I have read what explains it. after prediction.                              |
| `va-afterload-oxygenator-resistance-transfer`<br>Carry the reasoning to a new circuit                               | transfer  | circuit-walk; console, circuit, trends | transfer-scenario: Load `va-differential-hypoxemia`; SET_SCREEN. after prediction. |

### `va-differential-hypoxemia` — Right arm low, groin fine, circuit reassuring

Tracks: VA. Objective: Say which territory each arterial sampling site reports, and whether the console can change what reaches the right arm

Prerequisites: `va-parallel-physiology`. Sources: `elso-adult-va-2021`, `elso-neuro-monitoring-2024`, `bounded-educational-model`, `elso-dual-circulation-2024`, `ecmo-book-ch17`.

Follow-through: mechanism-match → `va-clinical-differential-hypoxemia` (Right-hand SpO₂ falling as pulse pressure widens, while femoral and post-oxygenator samples stay reassuring).

| Stable task ID / immediate objective                                                                       | Phase     | New presentation / surfaces              | Existing interaction and gate                                          |
| ---------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| `va-differential-hypoxemia-observe`<br>Read the pattern before touching a control                          | recognize | guided-device; console, circuit, monitor | read: Inspect the starting pattern. open.                              |
| `va-differential-hypoxemia-interpret`<br>Commit to a prediction before you act                             | predict   | guided-device; console, circuit, monitor | prediction: Commit this prediction. open.                              |
| `va-differential-hypoxemia-verify-and-escalate-mixing`<br>Verify the upper-body mismatch and escalate      | act       | guided-device; console, circuit, monitor | simulator-task: CORRECT_FAULT. after prediction.                       |
| `va-differential-hypoxemia-reassess`<br>Let the circuit respond, then reassess device, circuit and patient | observe   | guided-device; console, circuit, monitor | simulator-task: STEP. after prediction.                                |
| `va-differential-hypoxemia-explain`<br>What explains the pattern you worked                                | explain   | guided-device; console, circuit, monitor | read: I have read what explains it. after prediction.                  |
| `va-differential-hypoxemia-transfer`<br>Carry the reasoning to a new circuit                               | transfer  | guided-device; console, circuit, monitor | transfer-scenario: Load `va-lv-loading`; SET_SCREEN. after prediction. |

### `va-lv-loading` — Flow and pressure look fine; the pulse has gone flat

Tracks: VA. Objective: Decide whether flow and mean pressure establish that the heart is still ejecting, and name the signals that do

Prerequisites: `va-parallel-physiology`. Sources: `elso-adult-va-2021`, `bounded-educational-model`, `ecmo-book-ch9`, `ecmo-book-ch17`.

Follow-through: existing next-section/capstone navigation; no paired clinical case in this lesson adapter.

| Stable task ID / immediate objective                                                           | Phase     | New presentation / surfaces                   | Existing interaction and gate                                                |
| ---------------------------------------------------------------------------------------------- | --------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| `va-lv-loading-observe`<br>Read the pattern before touching a control                          | recognize | guided-device; console, circuit, monitor      | read: Inspect the starting pattern. open.                                    |
| `va-lv-loading-interpret`<br>Commit to a prediction before you act                             | predict   | guided-device; console, circuit, monitor      | prediction: Commit this prediction. open.                                    |
| `va-lv-loading-escalate-lv-loading`<br>Escalate concerning LV-loading cues                     | act       | guided-device; console, circuit, monitor      | simulator-task: CORRECT_FAULT. after prediction.                             |
| `va-lv-loading-reassess`<br>Let the circuit respond, then reassess device, circuit and patient | observe   | guided-device; console, circuit, monitor      | simulator-task: STEP. after prediction.                                      |
| `va-lv-loading-explain`<br>What explains the pattern you worked                                | explain   | guided-device; console, circuit, monitor      | read: I have read what explains it. after prediction.                        |
| `va-lv-loading-transfer`<br>Carry the reasoning to a new circuit                               | transfer  | guided-device; console, circuit, monitor, gas | transfer-scenario: Load `va-acute-hypercapnia`; SET_SWEEP. after prediction. |

### `va-acute-hypercapnia` — CO₂ climbing on VA

Tracks: VA. Objective: Choose the control for a CO₂ problem on VA and say which VA-specific checks it does not replace

Prerequisites: `blood-flow-versus-sweep`, `va-lv-loading`. Sources: `ecmo-book-ch16`, `ecmo-book-ch18`, `elso-adult-va-2021`, `bounded-educational-model`, `elso-dual-circulation-2024`.

Follow-through: existing next-section/capstone navigation; no paired clinical case in this lesson adapter.

| Stable task ID / immediate objective                                                                  | Phase     | New presentation / surfaces         | Existing interaction and gate                                                               |
| ----------------------------------------------------------------------------------------------------- | --------- | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `va-acute-hypercapnia-observe`<br>Read the pattern before touching a control                          | recognize | guided-device; gas, monitor, trends | read: Inspect the starting pattern. open.                                                   |
| `va-acute-hypercapnia-interpret`<br>Commit to a prediction before you act                             | predict   | guided-device; gas, monitor, trends | prediction: Commit this prediction. open.                                                   |
| `va-acute-hypercapnia-increase-sweep`<br>Increase external sweep flow                                 | act       | guided-device; gas, monitor, trends | simulator-task: SET_SWEEP. after prediction.                                                |
| `va-acute-hypercapnia-reassess`<br>Let the circuit respond, then reassess device, circuit and patient | observe   | guided-device; gas, monitor, trends | simulator-task: STEP. after prediction.                                                     |
| `va-acute-hypercapnia-explain`<br>What explains the pattern you worked                                | explain   | guided-device; gas, monitor, trends | read: I have read what explains it. after prediction.                                       |
| `va-acute-hypercapnia-transfer`<br>Carry the reasoning to a new circuit                               | transfer  | guided-device; gas, monitor, trends | transfer-scenario: Load `va-gas-source-interruption`; RESTORE_GAS_SOURCE. after prediction. |

### `va-gas-source-interruption` — Gas transfer falls while arterial flow holds

Tracks: VA. Objective: Decide from unchanged pressures and worsening gas values whether the problem is in the blood path or the gas path, then sample the upper body

Prerequisites: `blood-flow-versus-sweep`, `va-differential-hypoxemia`. Sources: `ecmo-book-ch9`, `ecmo-book-ch18`, `elso-circuit-2022`, `elso-adult-va-2021`, `bounded-educational-model`, `elso-dual-circulation-2024`, `elso-neuro-monitoring-2024`.

Follow-through: existing next-section/capstone navigation; no paired clinical case in this lesson adapter.

| Stable task ID / immediate objective                                                                        | Phase     | New presentation / surfaces                  | Existing interaction and gate                                                              |
| ----------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `va-gas-source-interruption-observe`<br>Read the pattern before touching a control                          | recognize | guided-device; gas, monitor, trends          | simulator-task: STEP; STEP; STEP; STEP; STEP. open.                                        |
| `va-gas-source-interruption-interpret`<br>Commit to a prediction before you act                             | predict   | guided-device; gas, monitor, trends          | prediction: Commit this prediction. open.                                                  |
| `va-gas-source-interruption-restore-gas-source`<br>Restore the verified source                              | act       | guided-device; gas, monitor, trends          | simulator-task: RESTORE_GAS_SOURCE. after prediction.                                      |
| `va-gas-source-interruption-reassess`<br>Let the circuit respond, then reassess device, circuit and patient | observe   | guided-device; gas, monitor, trends          | simulator-task: STEP. after prediction.                                                    |
| `va-gas-source-interruption-explain`<br>What explains the pattern you worked                                | explain   | guided-device; gas, monitor, trends          | read: I have read what explains it. after prediction.                                      |
| `va-gas-source-interruption-transfer`<br>Carry the reasoning to a new circuit                               | transfer  | guided-device; gas, monitor, trends, circuit | transfer-scenario: Load `va-arterial-bubble-stop`; TOGGLE_CIRCUIT_CLAMP. after prediction. |

### `va-arterial-bubble-stop` — Bubble alarm on VA: the pump stopped itself

Tracks: VA. Objective: Tell the device's stop, the clamps that protect the patient, the air source and the restart apart, and name what circulation loses meanwhile

Prerequisites: `va-startup-sensor-orientation`. Sources: `ifu-console-workflow`, `ifu-anomaly-boundary`, `elso-circuit-2022`, `elso-adult-va-2021`, `bounded-educational-model`.

Follow-through: mechanism-match → `va-clinical-circuit-air-embolism` (Bubble alarm and pump stop after a drainage connector loosens during repositioning on VA).

| Stable task ID / immediate objective                                                                       | Phase     | New presentation / surfaces              | Existing interaction and gate                                                          |
| ---------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `va-arterial-bubble-stop-observe`<br>Read the pattern before touching a control                            | recognize | guided-device; console, circuit          | simulator-task: STEP; STEP; STEP; STEP. open.                                          |
| `va-arterial-bubble-stop-interpret`<br>Commit to a prediction before you act                               | predict   | guided-device; console, circuit          | prediction: Commit this prediction. open.                                              |
| `va-arterial-bubble-stop-isolate-return-clamp`<br>Isolate the patient: clamp the arterial return limb      | act       | guided-device; console, circuit          | simulator-task: TOGGLE_CIRCUIT_CLAMP. after prediction.                                |
| `va-arterial-bubble-stop-isolate-drainage-clamp`<br>Complete isolation: clamp the drainage limb            | act       | guided-device; console, circuit          | simulator-task: TOGGLE_CIRCUIT_CLAMP. after prediction.                                |
| `va-arterial-bubble-stop-correct-bubble-source`<br>Correct and clear the air source                        | act       | guided-device; console, circuit          | simulator-task: CORRECT_FAULT. after prediction.                                       |
| `va-arterial-bubble-stop-resume-support`<br>Resume support per the current IFU and approved local protocol | act       | guided-device; console, circuit          | simulator-task: RESUME_SUPPORT_AFTER_BUBBLE. after prediction.                         |
| `va-arterial-bubble-stop-reassess`<br>Let the circuit respond, then reassess device, circuit and patient   | observe   | guided-device; console, circuit, monitor | simulator-task: STEP. after prediction.                                                |
| `va-arterial-bubble-stop-explain`<br>What explains the pattern you worked                                  | explain   | guided-device; console, circuit          | read: I have read what explains it. after prediction.                                  |
| `va-arterial-bubble-stop-transfer`<br>Carry the reasoning to a new circuit                                 | transfer  | guided-device; console, circuit          | transfer-scenario: Load `va-transport-power-loss`; RESTORE_AC_POWER. after prediction. |

### `va-transport-power-loss` — On battery, mid-transport, on VA

Tracks: VA. Objective: Decide what continued flow on reserve power does and does not buy for a patient whose circulation depends on it

Prerequisites: `va-startup-sensor-orientation`. Sources: `ifu-console-workflow`, `ecmo-book-ch9`, `elso-circuit-2022`, `elso-adult-va-2021`, `bounded-educational-model`.

Follow-through: next-in-unit → `va-clinical-limb-ischemia` (A cool, mottled leg beside the arterial cannula with falling limb NIRS while VA flow and MAP hold).

| Stable task ID / immediate objective                                                                     | Phase     | New presentation / surfaces              | Existing interaction and gate                                                             |
| -------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `va-transport-power-loss-observe`<br>Read the pattern before touching a control                          | recognize | guided-device; console, circuit          | simulator-task: STEP; STEP; STEP. open.                                                   |
| `va-transport-power-loss-interpret`<br>Commit to a prediction before you act                             | predict   | guided-device; console, circuit          | prediction: Commit this prediction. open.                                                 |
| `va-transport-power-loss-restore-ac`<br>Restore verified AC and confirm backup                           | act       | guided-device; console, circuit          | simulator-task: RESTORE_AC_POWER. after prediction.                                       |
| `va-transport-power-loss-reassess`<br>Let the circuit respond, then reassess device, circuit and patient | observe   | guided-device; console, circuit, monitor | simulator-task: STEP. after prediction.                                                   |
| `va-transport-power-loss-explain`<br>What explains the pattern you worked                                | explain   | guided-device; console, circuit          | read: I have read what explains it. after prediction.                                     |
| `va-transport-power-loss-transfer`<br>Carry the reasoning to a new circuit                               | transfer  | guided-device; console, circuit          | transfer-scenario: Load `va-startup-sensor-orientation`; PERFORM_CHECK. after prediction. |

### `va-integration-capstone` — The same unchanged flow, with a second circulation to blame

Tracks: VA. Objective: Separate the VV explanations from the four VA-only ones by where you look and what you sample

Prerequisites: `va-preload-drainage-collapse`, `va-afterload-arterial-return-obstruction`, `va-afterload-oxygenator-resistance`, `va-differential-hypoxemia`, `va-lv-loading`, `va-acute-hypercapnia`, `va-gas-source-interruption`, `va-arterial-bubble-stop`, `va-transport-power-loss`. Sources: `ecmo-book-ch9`, `elso-circuit-2022`, `bounded-educational-model`, `elso-adult-va-2021`, `elso-neuro-monitoring-2024`, `ecmo-book-ch17`, `elso-dual-circulation-2024`, `elso-maastricht-nomenclature-2019`, `elso-adult-vv-2021`, `ifu-anomaly-boundary`, `ecmo-book-ch18`.

Follow-through: existing next-section/capstone navigation; no paired clinical case in this lesson adapter.

| Stable task ID / immediate objective                                                                      | Phase     | New presentation / surfaces          | Existing interaction and gate                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `va-integration-capstone-recognize`<br>Establish that circuit flow alone cannot discriminate here either. | recognize | guided-device; monitor               | read: Continue. open.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `va-integration-capstone-predict`<br>Commit to one of the explanations before looking further.            | predict   | guided-device; monitor               | prediction: Commit this prediction. open.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `va-integration-capstone-act`<br>Gather the findings that separate the explanations.                      | act       | guided-device; circuit, gas, monitor | bounded-actions: Compare the right radial and femoral saturations; Review pulsatility, valve opening, and the lungs; Review pInt, pArt, and the gradient; Inspect the gas-source connection; Review the cannulated limb and bedside findings; Mechanism preview: ventricular loading; Mechanism preview: membrane resistance; Mechanism preview: the gas case before its change; Reveal the gas case evolved; Restore the case as it stands. after prediction. |
| `va-integration-capstone-observe`<br>Read each mechanism preview against the case in front of you.        | observe   | guided-device; circuit, gas, monitor | read: Continue. after prediction.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `va-integration-capstone-explain`<br>Work the whole differential against what each explanation predicts.  | explain   | concept; current teaching / question | read: Continue. after prediction.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `va-integration-capstone-transfer`<br>Apply the same discipline to a mechanism the circuit does report.   | transfer  | guided-device; monitor               | transfer-item: Commit this answer. after prediction.                                                                                                                                                                                                                                                                                                                                                                                                           |

## Clinical case inventory

All rows use **clinical-case** and keep the five original stages. The existing case objective, source mappings and required interventions are listed to make preservation reviewable. Management completion still also requires the scenario's corrective fault to be resolved and, for initiation, support to be established; observation and reassessment still precede reveal. Optional and unsafe alternative interventions remain available through the original case action panel. No prerequisites are changed by the presentation.

| Stable case ID / track                     | Existing learning objectives                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Required interventions / minimum modeled observation                                              | Sources                                                                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `clinical-vv-initiation-ards` / VV         | Decide from the device self-check, a hand walk from drainage cannula to return cannula, the gas path and the bedside data whether the whole system is ready to connect or only the console is.; Decide from the written case orders, rather than a remembered default, what speed, sweep and oxygen fraction the console and blender should show before forward flow begins.; Decide from SpO₂, PaCO₂ and pH set against the displayed flow whether the new support is effective or only running.                                                                                                                                | `vv-readiness-check`, `vv-connect-circuit`; 4 s                                                   | `elso-adult-vv-2021`, `ecmo-book-ch16`, `ecmo-book-ch17`, `ecmo-book-ch18`, `attached-ecmo-case-curriculum`, `bounded-educational-model` |
| `clinical-vv-occult-hemorrhage` / VV       | Decide from CVP, the hemoglobin trend and the behavior of the line whether falling flow is a circuit problem or a volume problem before choosing a first move.; Decide from a low CVP beside a falling hemoglobin whether a low-volume state is fluid depletion or ongoing blood loss, and where a hidden source can sit around a cannulated circuit.; Decide, when a pressor lifts MAP or a bolus steadies flow for a moment, whether the numbers improved because the cause was treated or only because it was masked.                                                                                                         | `hemorrhage-reduce-rpm`, `hemorrhage-search`, `hemorrhage-prbc`, `hemorrhage-source-control`; 4 s | `ecmo-book-ch16`, `ecmo-book-ch17`, `attached-ecmo-case-curriculum`, `bounded-educational-model`                                         |
| `clinical-vv-tension-pneumothorax` / VV    | Decide from CVP set against pVen whether a fall in flow is starved of blood or blocked from filling before choosing a first move.; Decide from the airway-pressure trend and lung sliding on each side whether the block sits inside the chest or somewhere on the circuit.; Decide, once the block is located in the chest, whether fluid, a pressor or any change on the console addresses the cause or only buys minutes.                                                                                                                                                                                                     | `tension-decompress`; 3 s                                                                         | `ecmo-book-ch16`, `ecmo-book-ch17`, `attached-ecmo-case-curriculum`, `bounded-educational-model`                                         |
| `clinical-vv-recirculation-migration` / VV | Decide from patient SpO₂ set against the pre- and post-oxygenator saturations whether a fall in oxygenation sits at the oxygenator or between the two limbs inside the patient.; Decide from an unchanged displayed flow beside a rising drainage-side saturation whether the flow number still describes the support the patient actually receives.; Decide, when more speed makes systemic saturation worse rather than better, what that response says about where the returned blood is going before the console is touched again.                                                                                           | `recirc-ultrasound`, `recirc-reposition`; 4 s                                                     | `ecmo-book-ch9`, `ecmo-book-ch17`, `elso-adult-vv-2021`, `attached-ecmo-case-curriculum`, `bounded-educational-model`                    |
| `clinical-vv-gas-disconnection` / VV       | Decide from a fast-rising PaCO₂ beside unchanged RPM, flow and circuit pressures whether the problem sits on the blood side or the gas side of the oxygenator.; Decide whether more blood flow or more gas flow is the lever for CO₂ when the two are separate controls in separate places.; Decide whether a number set on the blender or gas arriving at the oxygenator inlet is what proves delivery, and what the PaCO₂ trend should then do over time rather than at once.                                                                                                                                                  | `gas-inspect-path`, `gas-reconnect`, `gas-set-sweep`; 5 s                                         | `ecmo-book-ch18`, `elso-circuit-2022`, `attached-ecmo-case-curriculum`, `bounded-educational-model`                                      |
| `clinical-vv-oxygenator-thrombosis` / VV   | Decide from pInt set against pArt and the Δp trend whether flow is being held back between those two readings, beyond pArt or on the drainage side.; Decide from a climbing Δp beside the saturation leaving the circuit and the hemolysis markers whether one sensor has drifted or the component between pInt and pArt is itself failing.; Decide what asking the pump for more speed can and cannot do against a fixed obstruction, and whether the trend or a single number should set the moment to escalate.                                                                                                               | `oxygenator-verify`, `oxygenator-prepare-exchange`, `oxygenator-exchange`; 4 s                    | `elso-circuit-2022`, `ecmo-book-ch9`, `attached-ecmo-case-curriculum`, `bounded-educational-model`                                       |
| `clinical-vv-circuit-air-embolism` / VV    | Decide from a bubble alarm with the pump stopped and both lines still open whether the stop itself has already made the bedside safe or has only paused the flow.; Decide, before anything is opened or restarted, in what order the two lines and the air source have to be dealt with, and what must be true of the tubing before flow is allowed back.; Decide what this simulation stands for and what it leaves out: it shows why the tubing must be clear before flow comes back, and it leaves how flow is resumed to the current IFU and approved local protocol.                                                        | `air-clamp-return`, `air-clamp-drainage`, `air-deair`, `air-resume-support`; 3 s                  | `elso-circuit-2022`, `ifu-console-workflow`, `attached-ecmo-case-curriculum`, `bounded-educational-model`                                |
| `va-clinical-initiation-shock` / VA        | Decide from MAP, lactate, pulse pressure and urine output whether the organs are short of blood because the pump is failing or because the vessels are, and which of those the selected support can take over.; Decide, before the pump turns, what has to be true of the device, the tubing, the arterial return, the leg below the cannula and the team, and why a device self-check alone does not establish any of it.; Decide from MAP, lactate and urine output set against right-arm saturation, pulsatility and the cannulated leg whether the support is doing what the orders intended or only moving the flow number. | `va-readiness-check`, `va-connect-circuit`; 4 s                                                   | `elso-adult-va-2021`, `elso-circuit-2022`, `attached-ecmo-case-curriculum`, `bounded-educational-model`                                  |
| `va-clinical-differential-hypoxemia` / VA  | Decide from the upper-body SpO₂ set against femoral and post-oxygenator samples whether a fall belongs to the oxygenator, to the lungs or to where the two blood streams meet.; Decide from a widening pulse pressure beside the lung findings which stream is gaining ground in the aorta, and why a femoral sample cannot settle what the head and the coronaries are receiving.; Decide, when more pump speed leaves the upper body unchanged, whether the lungs, the configuration or the flow is the lever, and which of those this module can and cannot represent.                                                        | `differential-right-arm`, `differential-native-lung`, `differential-escalate-config`; 4 s         | `elso-adult-va-2021`, `elso-neuro-monitoring-2024`, `attached-ecmo-case-curriculum`, `bounded-educational-model`                         |
| `va-clinical-tamponade` / VA               | Decide from CVP set against pVen whether a fall in VA flow is starved of blood or blocked from filling before choosing a first move.; Decide from an abrupt fall in chest-drain output after heart surgery, beside a high CVP and a narrow pulse pressure, whether the block sits around the heart, in the chest or in the tubing.; Decide what fluid and a pressor can and cannot do for a heart that cannot fill, and whether a focused echo should delay the call for help or run alongside it.                                                                                                                               | `tamponade-echo`, `tamponade-decompress`; 3 s                                                     | `elso-adult-va-2021`, `ecmo-book-ch17`, `attached-ecmo-case-curriculum`, `bounded-educational-model`                                     |
| `va-clinical-vasoplegia` / VA              | Decide from a steady VA flow, a full pulse pressure and an aortic valve that opens on every beat, set against a low MAP, whether the shortfall is too little flow or too little vascular tone before choosing a first move.; Decide from warm extremities, a climbing lactate and fever which shock physiology fits, and why the pump cannot supply what the vessels are failing to hold.; Decide what asking the pump for more speed does to pVen and the line when the heart is already ejecting, and which endpoints show the cause itself is being treated rather than the number.                                           | `vasoplegia-echo`, `vasoplegia-pressors`, `vasoplegia-source-control`; 4 s                        | `elso-adult-va-2021`, `attached-ecmo-case-curriculum`, `bounded-educational-model`                                                       |
| `va-clinical-limb-ischemia` / VA           | Decide from a leg that is cool and mottled beside a normal MAP, flow and oxygenator whether the problem is global or regional before choosing a first move.; Decide from side-to-side NIRS, temperature, color and Doppler signals what one reading on one leg can and cannot establish about the blood supply below the arterial cannula.; Decide what raising total VA flow does and does not do for a leg starved below the cannula, and how the clock on threatened tissue should shape what happens next.                                                                                                                   | `limb-assessment`, `limb-restore-perfusion`; 3 s                                                  | `elso-adult-va-2021`, `elso-circuit-2022`, `attached-ecmo-case-curriculum`, `bounded-educational-model`                                  |
| `va-clinical-oxygenator-thrombosis` / VA   | Decide from pInt set against pArt and the Δp trend whether VA flow is being held back between those two readings, beyond pArt or on the drainage side.; Decide from a climbing Δp beside a falling MAP, visible fibrin and a falling saturation leaving the circuit whether one sensor has drifted or the component between pInt and pArt is itself failing, and why on VA that is a circulation problem and not only a gas one.; Decide what a pressor buys and what it cannot fix while the component fails, and what has to be standing ready before a circulation-critical part is swapped.                                  | `va-oxygenator-verify`, `va-oxygenator-prepare`, `va-oxygenator-exchange`; 3 s                    | `elso-circuit-2022`, `elso-adult-va-2021`, `attached-ecmo-case-curriculum`, `bounded-educational-model`                                  |
| `va-clinical-circuit-air-embolism` / VA    | Decide from a bubble alarm with the pump stopped and both lines still open whether the stop itself has already made the bedside safe or has only paused a flow that was carrying the circulation.; Decide, before anything is opened or restarted, in what order the two lines and the air source have to be dealt with on a VA run, and what must be true of the tubing before flow is allowed back.; Decide what this simulation stands for and what it leaves out: it shows why the tubing must be clear before flow comes back, and it leaves how VA flow is resumed to the current IFU and approved local protocol.         | `va-air-clamp-return`, `va-air-clamp-drainage`, `va-air-deair`, `va-air-resume-support`; 3 s      | `elso-circuit-2022`, `elso-adult-va-2021`, `attached-ecmo-case-curriculum`, `bounded-educational-model`                                  |

Assess retains `vv-off-sweep-capstone` and `va-mixed-circulation-capstone`, their existing prerequisites, supported alternative actions, patient-domain expectations, safety rules and 20 s / 10 s modeled observation requirements. They begin with Plan rather than adding a new Brief gate. Their existing authored challenge presentation is placed immediately above the plan; patient facts remain in the context strip. Their names/diagnostic explanations remain governed by the original debrief boundary.

## Changed files and clinical-copy review

Production changes are restricted to `src/features/cardiohelp-ecmo/`, with these two flow documents. The existing central `critical-care/__tests__/accessibility.test.tsx` also changes only its ECMO assertions: current task/flow landmarks replace pane labels, and fresh entry is Start; its axe checks and all other modules remain intact. The new presentation adapter, `ActivityContent`, `ActivityFlow.module.css`, section-selection adapter and `FocusedFoundationSections` define layout only. `FoundationStageHost`, `DrillStageHost` and `StageLayout` integrate them. The four track teaching panels filter their existing sections; the shared teaching block component mounts only the current block. `EcmoCircuitWalk` shares progression with the host. `EcmoCircuitControls` extracts the unchanged accessible controls from `EcmoCircuit3D`, and `CircuitAndMonitors` places them outside the optional launch gate. `FitWidthSurface` provides a labelled keyboard-scrollable viewport at native console size. The ECMO shell/styles, Practice host/panel/Now-card copy, hub, Continue CTA and Learn landing are updated locally. The affected layout tests are replaced with equivalent behavior coverage; clinical, source and assessment assertions remain.

Wording for physician review (no new clinical thresholds or treatment instructions):

1. Pane directions become direct instructions: follow the blood, inspect the map, or use the comparison table/Run control. The console's reading-only note points to the named lesson actions rather than the former Steps panel.
2. Current baseline group instructions say “this modeled run's own reference” and explicitly avoid universal targets; the original topology and physiological explanations remain intact.
3. Reference displays are labelled observation-only; the pedagogical Run control is distinguished from hardware. Active loaded variants are labelled beside retained comparisons.
4. The case opening says the working simulation opens at management. The existing nonclinical capstone presentation paragraph is placed above its plan. Written simulation orders repeat the exact authored RPM, sweep and fraction already used by the case.
5. Start/Continue, task/back labels and control-viewport accessibility labels describe the current action. No content source or medical recommendation is substituted.

## Limitations, holds and rollback

The browser identified a **pre-existing gas-to-air drill transfer lock**. `gas-source-interruption` and its VA counterpart load a fresh bubble-stop transfer scenario without a new prediction form. `EcmoCircuit3D` on the base commit requires that new scenario's `prediction.committed` before its return clamp can operate. That predicate is retained exactly in `EcmoCircuitControls` (with a neutral availability message before commitment); neither a fabricated commitment nor a bypass was added. The VV transfer is browser-confirmed blocked across the tested sizes; the same VA mapping is code-confirmed. The guided gas restoration, explanation and other drills remain usable. Resolving this requires a separate decision about the transfer commitment contract. Do not report this transfer as completed or the model as clinically validated.

The native-size console intentionally has bounded horizontal scrolling at compact widths. Optional 3D still has its existing display/bandwidth launch gate and WebGL fallback; the accessible clamps and 2D map no longer depend on that gate. Some existing deep teaching sections are long and retain their prose. This is not a rewrite of all clinical text. The six track foundations keep their existing optional exploration/completion semantics. Human think-aloud work, clinical review, non-Chromium/device testing and production deployment are outside the executed validation; see `flow-validation.md`.

For layout-only comparison, the pre-existing three-pane branch in `StageLayout` remains when `presentation` is omitted, and `ActivityContent` passes through children without presentation. These are reference seams, not a second learner-selectable mode. For a full rollback, revert this PR as a unit: the hosts also relocate content and manage focused sections. No data migration or progress rollback is required. Preserve any subsequently authored content when reverting.
