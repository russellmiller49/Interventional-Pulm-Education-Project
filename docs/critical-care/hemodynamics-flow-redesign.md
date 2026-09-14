# ICU hemodynamics: activity-specific flow

Implementation record, 2026-09-13. This follows the owner's additional flow prompt and supersedes the permanent three-pane presentation in the earlier teaching repair. The clinical review holds in `hemodynamics-learner-review-record.md` still apply.

## Scope and reference

Work continues on `codex/icu-hemodynamics-9-13`, based at `ab05b9d6`, preserving the local targeted teaching repair. The supplied reference `d209c8006e693e9d4ee8a250347911e191508029` contains no intervening changes to the ICU feature, ICU routes, or shared learning-module files. This is a local implementation; no merge, deployment, release change, or data operation is included.

Use a feature-local typed presentation adapter and document flow. Reuse the question/verdict, sources, monitor, catheter model, measurement workbenches, engine, and progress adapters. Presentation never owns a patient or dispatches a clinical action. Internal phase/task identities remain compatible. Extra teaching sequences live within existing tasks rather than renumbering stored identities.

## Preservation map

| Live section            | Presentation and sequence                                                                                                     | Preserved evidence and references                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| why-measure             | Clinical question, measurement origins, worked comparison, question/sort/transfer                                             | Existing prediction, seven attribution rows, answer reasoning, origin distinctions                          |
| pressure-system         | Measurement chain; isolated level/zero/scale/response demonstrations; mixed fault; comparison; transfer                       | Clean independent baselines, actual engine actions, fresh flush proof, two stories, validity sequence       |
| waveform-interpretation | Sequential large reference traces; matched RV/PA comparison; blinded map question; recognition; validity challenges; transfer | Chamber masking, five cumulative correct responses, repeat labels, ECG and pressure axes                    |
| waveform-components     | Annotated normal components; guided selection; changed practice; abnormal comparison; mechanism questions                     | First selections and assisted retries, original mechanisms/items, atlas and model qualifications            |
| catheter-advancement    | Safety prebrief; paired synchronized anatomy and pressure; confirmation and recovery                                          | RA/RV/PA confirmation, transit, stop conditions, keyboard and 2D fallback, repair-before-advance transfer   |
| pawp-capture            | Purpose/prebrief; acquisition and recovery beside pressure/respiratory observation                                            | Inflation/cursor/capture/deflation, plausibility and PA-return requirements, model timeout qualification    |
| thermodilution-series   | Acquisition concept and raw curve; trial ledger; direct Fick; assumed uptake; disagreement                                    | Three canonical method IDs, trial decisions and accepted series, Fick episodes/qualifiers, no pooling       |
| derived-hemodynamics    | One metric's question, inputs, formula, result and boundary; provenance; episodes; transfer                                   | Canonical metric registry, selective invalidation, method dependence, caution/withhold, existing evaluation |
| pac-signal-validation   | Patient brief; neutral measurement tool groups; response; integrated debrief                                                  | HD-08 state/actions/reassessment, blinded interpretation, arterial transfer, original completion            |

Practice and Assess use `HemodynamicCaseActivity` and `HemodynamicNativeWorkspace`, not the Learn host. All eight HD-01–HD-08 cases, the masked seeded challenge, existing pairings and next-Learn destinations remain. Case briefing, interpretation, working tools, observation and full-width debrief receive their own document flow. Safety interrupts and explicit Challenge feedback preference remain; hidden model truth is reserved for debrief.

## Implementation slices

1. Pressure end to end, verified before extending the renderer.
2. Waveform reader as a different presentation.
3. Remaining seven sections and local acquisition/calculation sequences.
4. Practice and Challenge, then full regression and browser journeys.

The old PAC layout e2e targets a retired seven-station UI. Replace its independent-pane assertions with active-route progression, paired anatomy/trace, responsive document flow, and state-retention coverage. Do not remove its clinical obligations.

## Boundaries and rollback

The nine section IDs, item keys, task IDs, first-attempt evidence, historical scores, persistence schemas, source registries, equations, thresholds and clinical action meanings stay unchanged by this flow pass. Learn reloads safely at the section beginning; case reloads at the authored pre-prediction checkpoint. Completing material is participation, not clinical competence.

Rollback is a revert of the feature-local presentation changes and their tests/docs, retaining the preceding targeted repair. There is no second copy of clinical content and no shared-stage modification. The detailed maps and remaining limits below accompany the validation record.

## Presentation and state ownership

`content/taskPresentation.ts` selects a presentation using section identity and typed task interaction/surface metadata. It does not inspect titles, construct patients, dispatch actions, grade answers, or own progress. `HemodynamicsStageHost` remains the Learn session owner through `useHemodynamicsStageSession`; `HemodynamicCaseActivity` remains the case owner. The shared stage and workspace packages have not been edited.

The flow uses a document scrollport at every width. An instruction, its observation, real action/answer controls, verdict and primary continuation render in one `NowCard`. The pathway and recorded-task list are secondary disclosures. Related pressure/anatomy and comparison views use local grids; resizing changes CSS rather than the patient or clocks. No compact Steps/Teaching/Simulator tabs remain in the active guided routes.

Extra thermodilution, Fick and metric introductions are local reading positions inside existing tasks. No task ordinals were inserted or reinterpreted by this pass. There are **72 existing task identities**, 18 prediction/transfer item slots, the separate wedge plausibility/recovery items, and the unchanged practice/drill decisions. The earlier targeted repair already introduced its additional teaching tasks; this pass preserves those identities.

Back renders completed work with disabled acquisition/answer surfaces. The current live monitor is explicitly identified as live rather than a historical replay; retained before/after tables use saved engine snapshots. First answers and subsequent assisted choices remain transient in the section session. The existing completion record is the only Learn storage. Reload starts at the first task; restarting does not erase stored history. Section selection intentionally navigates to the selected URL and starts that section safely. This also avoids a reproduced race between query-only client navigation and the previous session’s phase URL update.

The pressure baseline is captured from the actual task entry state once. Reset demonstration reloads that demonstration’s entry factory; viewport changes and Back never call it. Trial review/accept/exclude still uses the engine ledger. An active balloon retains visible state and recovery controls, and blocks review/section/reset/exit actions that would conceal the ongoing task. Wedge continuation still depends on acquisition and return evidence; a stored number or automatic release alone does not satisfy it.

## Every live Learn task

Each row maps the task identity at the start of this flow pass to the **same identity** now. Phase remains an internal analytics/progress field. Read/Explain continuation records participation; it is not a mastery criterion. Engine goal objects below are the existing predicates, not new clinical rules.

### why-measure

| Retained task ID          | Current title                             | Presentation / interaction | Preserved gate                                                                                            |
| ------------------------- | ----------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `why-measure-1-recognize` | Why put a line in at all?                 | concept / read             | Explicit continuation; retained work/reasoning, no clinical mastery award                                 |
| `why-measure-2-predict`   | What does a trustworthy number establish? | concept / prediction       | Record actual choice for `hd-why-predict-1`; reveal full rationale after submission; continue explicitly  |
| `why-measure-3-act`       | How to use the measurement categories     | concept / read             | Explicit continuation; retained work/reasoning, no clinical mastery award                                 |
| `why-measure-4-act`       | Where does each answer come from?         | concept / sort             | Submit all seven attribution rows together; preserve each verdict                                         |
| `why-measure-5-explain`   | Read, measured, calculated, inferred      | concept / explain          | Explicit continuation; retained work/reasoning, no clinical mastery award                                 |
| `why-measure-6-transfer`  | The same question, on the catheter        | concept / prediction       | Record actual choice for `hd-why-transfer-1`; reveal full rationale after submission; continue explicitly |

Practice: `HD-01` (next-in-unit). Reference stops: `line`, `ra`, `rv`, `pa`, `wedge`. Sources: `pac-review-2014`, `esicm-shock-2025`, `icu-hemodynamics-model-v1`, `arterial-pressure-five-step-2020`, `clinical-hemodynamics-waveforms`, `monitor-workflow-supplied`, `cvp-measurement-2017`, `pac-waveforms-part-1-2021`, `edwards-swan-ganz-ifu-2023`, `pac-derived-part-2-2021`.

### pressure-system

| Retained task ID              | Current title                                   | Presentation / interaction  | Preserved gate                                                                                                                                                                                                                    |
| ----------------------------- | ----------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pressure-system-1-recognize` | A line that can be trusted                      | signal-lab / walk           | Visit line; explicit finish/continue                                                                                                                                                                                              |
| `pressure-system-2-recognize` | Leveling: a height reference                    | signal-lab / read           | Explicit continuation; retained work/reasoning, no clinical mastery award                                                                                                                                                         |
| `pressure-system-3-recognize` | Zeroing: an atmospheric reference               | signal-lab / read           | Explicit continuation; retained work/reasoning, no clinical mastery award                                                                                                                                                         |
| `pressure-system-4-recognize` | Arterial display scale                          | signal-lab / read           | Explicit continuation; retained work/reasoning, no clinical mastery award                                                                                                                                                         |
| `pressure-system-5-recognize` | Three dynamic responses                         | signal-lab / read           | Explicit continuation; retained work/reasoning, no clinical mastery award                                                                                                                                                         |
| `pressure-system-6-predict`   | What is this number carrying?                   | signal-lab / prediction     | Record actual choice for `pac-pressure-predict-1`; reveal full rationale after submission; continue explicitly                                                                                                                    |
| `pressure-system-7-act`       | Set the reference                               | signal-lab / simulator-task | `{"type":"level"}`; `{"type":"zeroed"}`                                                                                                                                                                                           |
| `pressure-system-8-observe`   | Read the response                               | signal-lab / observe        | `{"type":"check","id":"fast-flush"}`; `{"type":"check","id":"dynamic-response-classified"}`; `{"type":"check","id":"dynamic-response-corrected"}`; `{"type":"check","id":"learn-current-response-rechecked"}`                     |
| `pressure-system-9-explain`   | Reference errors versus dynamic-response errors | signal-lab / explain        | Explicit continuation; retained work/reasoning, no clinical mastery award                                                                                                                                                         |
| `pressure-system-10-transfer` | A different patient, a different fault          | signal-lab / prediction     | Record actual choice for `pac-pressure-transfer-1`; reveal full rationale after submission; continue explicitly                                                                                                                   |
| `pressure-system-11-transfer` | Repair both                                     | signal-lab / simulator-task | `{"type":"level"}`; `{"type":"check","id":"fast-flush"}`; `{"type":"check","id":"dynamic-response-classified"}`; `{"type":"check","id":"dynamic-response-corrected"}`; `{"type":"check","id":"learn-current-response-rechecked"}` |
| `pressure-system-12-transfer` | What carried over                               | signal-lab / explain        | Explicit continuation; retained work/reasoning, no clinical mastery award                                                                                                                                                         |

Practice: `HD-08` (mechanism-match). Reference stops: `line`. Sources: `arterial-pressure-five-step-2020`, `monitor-workflow-supplied`, `clinical-hemodynamics-waveforms`, `icu-hemodynamics-model-v1`, `pac-waveforms-part-1-2021`.

### waveform-interpretation

| Retained task ID                      | Current title                    | Presentation / interaction       | Preserved gate                                                                                              |
| ------------------------------------- | -------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `waveform-interpretation-1-recognize` | Walk the four places             | waveform-reader / walk           | Visit ra, rv, pa, wedge; explicit finish/continue                                                           |
| `waveform-interpretation-2-recognize` | RV and PA: compare diastole      | waveform-reader / read           | Explicit continuation; retained work/reasoning, no clinical mastery award                                   |
| `waveform-interpretation-3-predict`   | Where is the tip?                | waveform-reader / prediction     | Record actual choice for `hd-place-predict-1`; reveal full rationale after submission; continue explicitly  |
| `waveform-interpretation-4-act`       | Identify five tracings correctly | waveform-reader / simulator-task | `{"type":"check","id":"waveform-recognition"}`                                                              |
| `waveform-interpretation-5-explain`   | The shape names the place        | waveform-reader / explain        | Explicit continuation; retained work/reasoning, no clinical mastery award                                   |
| `waveform-interpretation-6-transfer`  | New visual application           | waveform-reader / prediction     | Record actual choice for `hd-place-transfer-1`; reveal full rationale after submission; continue explicitly |
| `waveform-interpretation-7-transfer`  | What carried over                | waveform-reader / explain        | Explicit continuation; retained work/reasoning, no clinical mastery award                                   |

Practice: `HD-07` (mechanism-match). Reference stops: `ra`, `rv`, `pa`, `wedge`. Sources: `clinical-hemodynamics-waveforms`, `pac-waveforms-part-1-2021`, `pac-review-2014`, `cvp-measurement-2017`, `edwards-swan-ganz-ifu-2023`.

### waveform-components

| Retained task ID                  | Current title                         | Presentation / interaction                 | Preserved gate                                                                                              |
| --------------------------------- | ------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `waveform-components-1-recognize` | Atrial waves and descents             | waveform-reader / read                     | Explicit continuation; retained work/reasoning, no clinical mastery award                                   |
| `waveform-components-2-act`       | Guided component identification       | waveform-reader / component-identification | guided component criteria; first selections and assisted retries retained                                   |
| `waveform-components-3-act`       | Practice with renumbered components   | waveform-reader / component-identification | independent component criteria; first selections and assisted retries retained                              |
| `waveform-components-4-recognize` | When the atrial contour changes       | waveform-reader / read                     | Explicit continuation; retained work/reasoning, no clinical mastery award                                   |
| `waveform-components-5-predict`   | What made this wave?                  | waveform-reader / prediction               | Record actual choice for `hd-waves-predict-1`; reveal full rationale after submission; continue explicitly  |
| `waveform-components-6-explain`   | Interpret the component in context    | waveform-reader / explain                  | Explicit continuation; retained work/reasoning, no clinical mastery award                                   |
| `waveform-components-7-transfer`  | A different wave, a different patient | waveform-reader / prediction               | Record actual choice for `hd-waves-transfer-1`; reveal full rationale after submission; continue explicitly |
| `waveform-components-8-transfer`  | What carried over                     | waveform-reader / explain                  | Explicit continuation; retained work/reasoning, no clinical mastery award                                   |

Practice: `HD-07` (mechanism-match). Reference stops: `ra`, `wedge`. Sources: `clinical-hemodynamics-waveforms`, `pac-waveforms-part-1-2021`, `cvp-measurement-2017`, `pac-review-2014`, `edwards-swan-ganz-ifu-2023`.

### catheter-advancement

| Retained task ID                   | Current title                                     | Presentation / interaction          | Preserved gate                                                                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catheter-advancement-1-recognize` | The tracing says where; the list says whether     | catheter-procedure / read           | Explicit continuation; retained work/reasoning, no clinical mastery award                                                                                                                                                                 |
| `catheter-advancement-2-predict`   | A confirmed atrium. What next?                    | catheter-procedure / prediction     | Record actual choice for `hd-advance-predict-1`; reveal full rationale after submission; continue explicitly                                                                                                                              |
| `catheter-advancement-3-act`       | Advance by the tracing                            | catheter-procedure / simulator-task | `{"type":"position","position":"rv"}`; `{"type":"check","id":"waveform-confirmed-rv"}`; `{"type":"position","position":"pa"}`; `{"type":"check","id":"waveform-confirmed-pa"}`                                                            |
| `catheter-advancement-4-observe`   | The step-up                                       | catheter-procedure / observe        | Existing observation predicate                                                                                                                                                                                                            |
| `catheter-advancement-5-explain`   | Position from the shape, permission from the list | catheter-procedure / explain        | Explicit continuation; retained work/reasoning, no clinical mastery award                                                                                                                                                                 |
| `catheter-advancement-6-transfer`  | The signal stops being trustworthy                | catheter-procedure / prediction     | Record actual choice for `hd-advance-transfer-1`; reveal full rationale after submission; continue explicitly                                                                                                                             |
| `catheter-advancement-7-transfer`  | Repair, then move                                 | catheter-procedure / simulator-task | `{"type":"check","id":"fast-flush"}`; `{"type":"check","id":"dynamic-response-classified"}`; `{"type":"check","id":"dynamic-response-corrected"}`; `{"type":"position","position":"rv"}`; `{"type":"check","id":"waveform-confirmed-rv"}` |
| `catheter-advancement-8-transfer`  | What carried over                                 | catheter-procedure / explain        | Explicit continuation; retained work/reasoning, no clinical mastery award                                                                                                                                                                 |

Practice: `HD-08` (mechanism-match). Reference stops: `ra`, `rv`, `pa`. Sources: `pac-waveforms-part-1-2021`, `pac-review-2014`, `edwards-swan-ganz-ifu-2023`, `clinical-hemodynamics-waveforms`, `cvp-measurement-2017`, `arterial-pressure-five-step-2020`, `monitor-workflow-supplied`.

### pawp-capture

| Retained task ID           | Current title                    | Presentation / interaction       | Preserved gate                                                                                                 |
| -------------------------- | -------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pawp-capture-1-recognize` | Listening past the tip           | acquisition-lab / read           | Explicit continuation; retained work/reasoning, no clinical mastery award                                      |
| `pawp-capture-2-predict`   | Which sequence?                  | acquisition-lab / prediction     | Record actual choice for `pac-pawp-predict-1`; reveal full rationale after submission; continue explicitly     |
| `pawp-capture-3-act`       | Occlude, read, release           | acquisition-lab / simulator-task | `{"type":"wedge-stored"}`; `{"type":"balloon-down"}`                                                           |
| `pawp-capture-4-observe`   | Is it plausible, and is it over? | acquisition-lab / observe        | `{"type":"check","id":"pa-waveform-return-confirmed"}`; wedge plausibility commitment, wedge return commitment |
| `pawp-capture-5-explain`   | Brief, plausible, and over       | acquisition-lab / explain        | Explicit continuation; retained work/reasoning, no clinical mastery award                                      |
| `pawp-capture-6-transfer`  | Under more positive pressure     | acquisition-lab / prediction     | Record actual choice for `pac-pawp-transfer-1`; reveal full rationale after submission; continue explicitly    |
| `pawp-capture-7-transfer`  | Take it again                    | acquisition-lab / simulator-task | `{"type":"wedge-stored"}`; `{"type":"balloon-down"}`; `{"type":"check","id":"pa-waveform-return-confirmed"}`   |
| `pawp-capture-8-transfer`  | What carried over                | acquisition-lab / explain        | Explicit continuation; retained work/reasoning, no clinical mastery award                                      |

Practice: `HD-08` (mechanism-match). Reference stops: `pa`, `wedge`. Sources: `pac-waveforms-part-1-2021`, `edwards-swan-ganz-ifu-2023`, `monitor-workflow-supplied`, `clinical-hemodynamics-waveforms`, `cvp-measurement-2017`.

### thermodilution-series

| Retained task ID                    | Current title                          | Presentation / interaction       | Preserved gate                                                                                             |
| ----------------------------------- | -------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `thermodilution-series-1-recognize` | A curve, then a number                 | acquisition-lab / read           | Explicit continuation; retained work/reasoning, no clinical mastery award                                  |
| `thermodilution-series-2-predict`   | Which curves belong in the series?     | acquisition-lab / prediction     | Record actual choice for `pac-td-predict-1`; reveal full rationale after submission; continue explicitly   |
| `thermodilution-series-3-act`       | Read each curve, decide each curve     | acquisition-lab / simulator-task | `{"type":"trials-reviewed"}`; `{"type":"series"}`                                                          |
| `thermodilution-series-4-observe`   | Which result was measured?             | calculation-lab / observe        | Defend direct-versus-assumed Fick provenance                                                               |
| `thermodilution-series-5-explain`   | The technique is in the curve          | acquisition-lab / explain        | Explicit continuation; retained work/reasoning, no clinical mastery award                                  |
| `thermodilution-series-6-transfer`  | A low-flow patient, a poor third curve | acquisition-lab / prediction     | Record actual choice for `pac-td-transfer-1`; reveal full rationale after submission; continue explicitly  |
| `thermodilution-series-7-transfer`  | When the two methods disagree          | calculation-lab / disagreement   | Existing defensible-position callback; four comparisons available separately (no new all-four requirement) |
| `thermodilution-series-8-transfer`  | What carried over                      | acquisition-lab / explain        | Explicit continuation; retained work/reasoning, no clinical mastery award                                  |

Practice: `HD-08` (mechanism-match). Reference stops: `ra`, `pa`. Sources: `pac-derived-part-2-2021`, `master-hemodynamics-reference`, `edwards-swan-ganz-ifu-2023`, `clinical-hemodynamics-waveforms`, `cvp-measurement-2017`, `pac-review-2014`, `pac-waveforms-part-1-2021`, `papi-rvmi-2012`, `cpo-acute-cardiac-2007`, `ppv-sepsis-2000`, `pa-compliance-outcomes-2026`.

### derived-hemodynamics

| Retained task ID                   | Current title                    | Presentation / interaction          | Preserved gate                                                                                                       |
| ---------------------------------- | -------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `derived-hemodynamics-1-recognize` | Which of these is a measurement? | calculation-lab / provenance-drill  | All six provenance classifications defensible; first answers retained                                                |
| `derived-hemodynamics-2-predict`   | Can this resistance be read?     | calculation-lab / prediction        | Record actual choice for `pac-derived-predict-1`; reveal full rationale after submission; continue explicitly        |
| `derived-hemodynamics-3-act`       | Work the episodes                | calculation-lab / derived-workbench | Existing dependency, method, validity withholding, selective preservation, disagreement and threshold-context checks |
| `derived-hemodynamics-4-explain`   | An equation over measurements    | calculation-lab / explain           | Explicit continuation; retained work/reasoning, no clinical mastery award                                            |
| `derived-hemodynamics-5-transfer`  | A number the monitor can show    | calculation-lab / prediction        | Record actual choice for `pac-derived-transfer-1`; reveal full rationale after submission; continue explicitly       |
| `derived-hemodynamics-6-transfer`  | Plausible, or coherent?          | calculation-lab / derived-transfer  | Submit transfer comparison and acknowledge its reasoning; original evaluation retained                               |
| `derived-hemodynamics-7-transfer`  | What carried over                | calculation-lab / explain           | Explicit continuation; retained work/reasoning, no clinical mastery award                                            |

Practice: `HD-05` (mechanism-match). Reference stops: `line`, `ra`, `pa`, `wedge`. Sources: `pac-derived-part-2-2021`, `master-hemodynamics-reference`, `arterial-pressure-five-step-2020`, `clinical-hemodynamics-waveforms`, `monitor-workflow-supplied`, `cvp-measurement-2017`, `pac-review-2014`, `pac-waveforms-part-1-2021`, `edwards-swan-ganz-ifu-2023`, `papi-rvmi-2012`, `cpo-acute-cardiac-2007`, `ppv-sepsis-2000`, `pa-compliance-outcomes-2026`.

### pac-signal-validation

| Retained task ID                    | Current title                            | Presentation / interaction | Preserved gate                                                                                                                                                                  |
| ----------------------------------- | ---------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pac-signal-validation-1-recognize` | The screen changed. The patient did not. | case / read                | Explicit continuation; retained work/reasoning, no clinical mastery award                                                                                                       |
| `pac-signal-validation-2-predict`   | What comes first?                        | case / prediction          | Record actual choice for `hd-capstone-predict-1`; reveal full rationale after submission; continue explicitly                                                                   |
| `pac-signal-validation-3-act`       | Restore the screen, in order             | case / simulator-task      | `{"type":"intervention","id":"correct-measurement-system"}`; `{"type":"intervention","id":"reposition-catheter"}`; `{"type":"intervention","id":"repeat-valid-thermodilution"}` |
| `pac-signal-validation-4-observe`   | Reassess against the patient             | case / observe             | `{"type":"reassessed"}`                                                                                                                                                         |
| `pac-signal-validation-5-explain`   | Every row, in order                      | case / explain             | Explicit continuation; retained work/reasoning, no clinical mastery award                                                                                                       |
| `pac-signal-validation-6-transfer`  | A different line, a different patient    | case / prediction          | Record actual choice for `hd-capstone-transfer-1`; reveal full rationale after submission; continue explicitly                                                                  |
| `pac-signal-validation-7-transfer`  | Read the line before the number          | case / simulator-task      | `{"type":"check","id":"fast-flush"}`; `{"type":"check","id":"dynamic-response-classified"}`; `{"type":"check","id":"dynamic-response-corrected"}`                               |
| `pac-signal-validation-8-transfer`  | What carried over                        | case / explain             | Explicit continuation; retained work/reasoning, no clinical mastery award                                                                                                       |

Practice: `HD-08` (mechanism-match). Reference stops: `line`, `ra`, `rv`, `pa`, `wedge`. Sources: `arterial-pressure-five-step-2020`, `pac-waveforms-part-1-2021`, `pac-derived-part-2-2021`, `monitor-workflow-supplied`, `clinical-hemodynamics-waveforms`, `cvp-measurement-2017`, `pac-review-2014`, `edwards-swan-ganz-ifu-2023`, `master-hemodynamics-reference`.

## All cases and Practice pairings

All eight cases remain available at `/icu-hemodynamics/practice?case=HD-0N`. Assess retains the existing seeded HD-07 route `/icu-hemodynamics/assess?start=1` and lifecycle identity `hemodynamics:assess:masked-seeded`. Practice retains `hemodynamics:practice:HD-0N`. Seeds, interventions, case thresholds, historical scores and both progress adapters are unchanged.

| Case  | Title                                               | All available intervention IDs                                                                                                          | Existing required action IDs                                                       | Hard safety interrupt IDs |
| ----- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------- |
| HD-01 | A narrow pulse pressure after volume loss           | `passive-leg-raise`, `fluid-250`, `norepinephrine-up`, `dobutamine-up`, `peep-up-unsafe`                                                | `passive-leg-raise`, `fluid-250`                                                   | `peep-up-unsafe`          |
| HD-02 | Warm shock with a low diastolic pressure            | `passive-leg-raise`, `fluid-250`, `norepinephrine-up`, `vasopressin-add`, `dobutamine-up`                                               | `norepinephrine-up`                                                                | None authored             |
| HD-03 | Low flow with pulmonary congestion                  | `dobutamine-up`, `milrinone-up`, `diuresis-step`, `fluid-250`, `norepinephrine-up`                                                      | `dobutamine-up`, `diuresis-step`                                                   | None authored             |
| HD-04 | Abrupt RV pressure overload                         | `inhaled-pulmonary-vasodilator`, `systemic-pulmonary-vasodilator`, `pe-reperfusion`, `norepinephrine-up`, `fluid-250`, `peep-up-unsafe` | `inhaled-pulmonary-vasodilator`, `pe-reperfusion`                                  | `peep-up-unsafe`          |
| HD-05 | Decompensated pre-capillary PH with RV failure      | `inhaled-pulmonary-vasodilator`, `systemic-pulmonary-vasodilator`, `milrinone-up`, `diuresis-step`, `fluid-250`                         | `inhaled-pulmonary-vasodilator`, `milrinone-up`                                    | None authored             |
| HD-06 | Post-capillary PH with biventricular congestion     | `diuresis-step`, `peep-down`, `dobutamine-up`, `fluid-250`, `inhaled-pulmonary-vasodilator`                                             | `diuresis-step`, `peep-down`                                                       | None authored             |
| HD-07 | Pressure equalization with a falling pulse pressure | `pericardial-drainage`, `fluid-250`, `norepinephrine-up`, `peep-up-unsafe`                                                              | `pericardial-drainage`                                                             | `peep-up-unsafe`          |
| HD-08 | The numbers do not fit the patient                  | `correct-measurement-system`, `reposition-catheter`, `repeat-valid-thermodilution`, `fluid-250`, `norepinephrine-up`                    | `correct-measurement-system`, `reposition-catheter`, `repeat-valid-thermodilution` | None authored             |

The case flow keeps Recognize → Predict → Act → Observe → Explain → Transfer internally. The initial clinical brief uses the authored presentation and observed channels; the diagnosis-bearing short title and internal physiology are not mounted there. Interpretation controls sit beside the monitor. All interventions are offered with their original consequences and timing. Measurement tools are neutral disclosures. Retained response tables precede a full-width debrief; the original reflection and discriminating-cue steps remain.

Opening the debrief or transfer from the checkpoint menu cannot reveal them before reassessment. Revisiting a completed transfer does not replay its state-loading action. Case reload restores the authored **pre-prediction checkpoint**, not exact intervention state. Challenge still defaults to deferred teaching, allows an explicit immediate-feedback choice before commitment, keeps Reference/Evidence available, and always reveals hard safety interruptions. It remains supported practice with a debrief, not proof of unassisted performance.

Several sections intentionally point to HD-08. These are references to the same stored case identity, never new assessment requirements or duplicate mandatory cases. The existing mechanism-match versus next-in-unit labels remain. The optional `nextLearn` query on a Practice link is validated against the nine-section registry; completing that case offers the intended next Learn destination.

## Source-content preservation

| Content family                               | Active use before independent application                                                                                           | Full/reference and post-answer use                                                                                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Measurement origins and question attribution | `IntroductoryTeaching` uses the existing origins and distinct worked pressure/flow example                                          | `QuestionSortControl`, row feedback and original prediction/transfer reasoning                                                                                       |
| Route stops and pressure system              | Pressure walk; isolated level, zero, scale and response demonstrations; retained baseline                                           | `routeSpine`, `controlPanel`, `pressureSystemValiditySteps`, original story problems and grammar rows                                                                |
| Normal waveforms                             | Sequential RA/RV/PA/wedge references; matched RV–PA axes; ECG/respiration from existing figure data                                 | `NormalWaveformReference`, `NormalWaveformValidityChallenges`, recognition drill with five cumulative correct responses                                              |
| Atrial components and abnormal atlas         | Labeled normal component selection; recorded guided/renumbered practice; distinct authored abnormal examples                        | Original TR/tamponade question traces, full verdicts, and full abnormal atlas during explanation                                                                     |
| Catheter advancement                         | `pacPrebriefExpectedTransitions` and `pacPrebriefStopConditions` before action; synchronized existing CT-derived heart and pressure | Same route and real confirmations; keyboard anatomy controls, optional 2D map; explicit resistance/ectopy limitation                                                 |
| Wedge acquisition                            | Purpose and entire `pawpCaptureSteps` before action; essential acquisition/recovery reminder during work                            | Existing plausibility and failed-return items, `WedgeValidityPanel`, respiratory conventions, stored capture and confirmed PA return                                 |
| Thermodilution                               | Canonical method measurand/acquisition sequence and worked raw curve; actual trial ledger                                           | Canonical quality rules, accepted average and technique history; no pooling or new agreement threshold                                                               |
| Fick and method disagreement                 | All six existing Fick episodes, sequentially; measured/sampled/entered/assumed/calculated status, site/time and units               | `CardiacOutputMethodModel`, complete `FickMethodWorkbench` including amplification comparison; all four existing comparison scenarios and commitment-gated reasoning |
| Derived metrics                              | All 11 `derivedMetricRecords`, individually; canonical evaluator and existing ungraded input episodes                               | Six-row provenance drill, all eight workbench episodes, selective withholding, independent method sets, source-specific threshold boundaries and transfer comparison |
| Case teaching and evidence                   | Authored patient briefs and neutral measurement tools                                                                               | Unchanged teaching artifact/expert trace, feedback records, full debrief, Reference/Evidence drawers, optional labeled internal-model view                           |

`stageSources` remains the source aggregator; citation identity is available before commitment and question-specific source-use text remains gated. Canonical source and clinical threshold registries are unchanged. New Fick introductions repeat the registry’s estimating-equation and hemoglobin-binding qualifiers where the calculation is shown. No source was promoted from local notes into a clinical guideline.

Legacy station/workspace records remain in the repository for their existing consumers and compatibility tests. `PacLearningPathwayActivity` routes the nine live sections into `HemodynamicsStageHost`; Learn no longer mounts the retired seven-station resizable layout. Practice/Assess use their separate case renderer. No legacy activity was resurrected merely to satisfy the old PAC e2e selectors.

## Clinical-copy changes for physician review

- The opening lesson now begins with the existing clinical distinction between low pressure, flow and resistance, using an authored worked comparison before the question/sort.
- Added concise scope and provenance labels: authored example, actual retained simulation comparison, calculated method result, and internal model reference.
- General atrial teaching uses different atlas examples from the keyed TR/tamponade questions. The renumbered normal pattern is explicitly additional practice, not an independent specimen. Rhythm-specific ECG is withheld for the two abnormal introductory examples because the generic ECG generator does not model those rhythms.
- Catheter and wedge prebriefs render before the actions they govern. Short reminders preserve the source limitations and distinguish model automatic release from a clinical inflation limit; no balloon volume, duration or device protocol was invented.
- Fick and metric introductory wording is assembled from the canonical registries/evaluator, including qualifiers. No equation, threshold, ranking of methods or expected intervention response was rewritten.
- Case calculated results consume the accepted thermodilution series and stored wedge rather than exposing internal CO/PAWP as additional acquisitions. Internal physiology is labeled and reserved for debrief. Catheter confirmation asks the learner to identify the observed tracing instead of printing the true location in its action button.
- First-answer records and participation language clarify what the learner actually did; completion is not described as clinical competence.

## Review holds and remaining limits

The HLR-OD-4 item holds remain: `pac-pressure-predict-1`, `pac-pressure-transfer-1`, `pac-pawp-predict-1`, `pac-pawp-transfer-1`, `pac-td-predict-1`, `pac-td-transfer-1`, `pac-derived-predict-1`, and `pac-derived-transfer-1`; the previously draft `hd-capstone-transfer-1` also stays draft. This UI pass supplies no physician sign-off and does not change unlisted-preview status.

Pre-existing clinical/scoring issues remain separate from this UX work:

- Case completion/reassessment and mastery are different engine outcomes. Except for HD-08, the existing observation gate accepts any completed intervention; scoring still evaluates required interventions and case-specific success criteria. This pass does not convert completion into a new mandatory success threshold.
- Case narratives, baseline physiology and scenario targets require physician reconciliation; layout tests do not establish clinical plausibility or treatment efficacy.
- The legacy case formula drawer’s PPV context includes authored assumptions (for example tidal volume/chest context). The Learn workbench’s canonical context-sensitive validity rules remain unchanged; no broader clinical inference is warranted from a displayed case PPV.
- The case monitor exposes an authored PA-site SvO₂ when that site is available; there is no new specimen-draw workflow or real oximetry device. The case UI is a teaching model.
- Fresh post-repair flush evidence is required by the existing targeted pressure-system gates. Other sections keep their original action/check predicates; this redesign does not silently expand those criteria.
- Automatic model release is not learner-confirmed recovery. Actual catheter resistance, ectopy, manufacturer-specific balloon operation and clinical management are outside the model.
- Reference availability intentionally supports Practice/Challenge. Ordinary-UI masking is tested; client-side content is not tamper-proof.
- No human think-aloud study, educational efficacy evaluation, physician review, translated clinical approval, deployment or production analytics validation was performed.

## Changed-file groups and rollback

The implementation changes the feature-local presentation adapter, flow stylesheet, task draft provider, focused introductory renderer, Learn host/teaching/simulator composition, waveform/monitor presentation, calculation/disagreement workbenches, Overview/Learn entry points, case activity/native workspace, PAC action disclosure, and the Practice route’s validated next-Learn query. Tests cover the new flow; this document and `hemodynamics-flow-validation.md` record the result.

The working diff also contains the preceding targeted teaching repair, documented in `src/features/icu-hemodynamics/TARGETED_TEACHING_REPAIR.md`. Its engine flush guards, introductory component activity and source/wording changes predate this flow request and were preserved. Do not treat every change against `ab05b9d6` as a new physiology change from this pass.

The earlier targeted repair was uncommitted, so there is no isolated flow commit that can be reversed automatically. A complete [reviewed-path patch](/Users/russellmiller/.codex/visualizations/2026/09/13/01a09bd3-a438-70d0-b97f-2743be787e77/icu-hemodynamics-flow-review/working-result.patch) is retained with the evidence to preserve this working result. Rollback requires a reviewed feature-local reversal of the flow adapter/composition, case presentation and corresponding UI tests, retaining the preceding targeted repair. Reuse the existing shared layout primitives and the unchanged default/reference component paths when restoring the prior composition; do not reset this dirty branch or revert shared clinical/state registries. No database migration, storage migration, shared-stage fork, duplicated clinical curriculum, release flag change, or generated asset is required to roll back. The earlier visual evidence remains separately labeled as the superseded three-pane implementation.

### Reviewable working files

These paths include both the preserved targeted repair and this flow pass. The earlier repair record identifies its original scope. No shared stage, backend, authentication, dependency or publication file was changed by the flow pass.

- `docs/critical-care/hemodynamics-flow-redesign.md`
- `docs/critical-care/hemodynamics-flow-validation.md`
- `e2e/icu-hemodynamics-flow.spec.ts`
- `e2e/icu-hemodynamics-pac-layout.spec.ts`
- `e2e/icu-hemodynamics-targeted.spec.ts`
- `src/app/[locale]/icu-hemodynamics/practice/page.tsx`
- `src/features/critical-care/content/learningPathways.ts`
- `src/features/icu-hemodynamics/TARGETED_TEACHING_REPAIR.md`
- `src/features/icu-hemodynamics/__tests__/case-activity-v2.test.tsx`
- `src/features/icu-hemodynamics/__tests__/h5-derived-hemodynamics.test.tsx`
- `src/features/icu-hemodynamics/__tests__/pathway-resolver.test.tsx`
- `src/features/icu-hemodynamics/__tests__/pressure-system-component.test.tsx`
- `src/features/icu-hemodynamics/__tests__/simulation.test.ts`
- `src/features/icu-hemodynamics/__tests__/stage-host.test.tsx`
- `src/features/icu-hemodynamics/__tests__/stage-learner-review.test.tsx`
- `src/features/icu-hemodynamics/__tests__/stage-lessons.test.ts`
- `src/features/icu-hemodynamics/__tests__/stage-precommit-leak.rendered.test.tsx`
- `src/features/icu-hemodynamics/__tests__/stage-sources.test.tsx`
- `src/features/icu-hemodynamics/__tests__/targeted-teaching.test.tsx`
- `src/features/icu-hemodynamics/components/BedsideMonitor.tsx`
- `src/features/icu-hemodynamics/components/CardiacOutputDisagreementLab.tsx`
- `src/features/icu-hemodynamics/components/DerivedHemodynamicsWorkbench.tsx`
- `src/features/icu-hemodynamics/components/FickMethodWorkbench.tsx`
- `src/features/icu-hemodynamics/components/FormulaDrawer.tsx`
- `src/features/icu-hemodynamics/components/HemodynamicCaseActivity.tsx`
- `src/features/icu-hemodynamics/components/HemodynamicNativeWorkspace.tsx`
- `src/features/icu-hemodynamics/components/IcuHemodynamicsLearnLandingV2.tsx`
- `src/features/icu-hemodynamics/components/IcuHemodynamicsModuleFrameV2.tsx`
- `src/features/icu-hemodynamics/components/IcuHemodynamicsOverviewV2.tsx`
- `src/features/icu-hemodynamics/components/NormalWaveformReference.tsx`
- `src/features/icu-hemodynamics/components/PacActionDock.tsx`
- `src/features/icu-hemodynamics/components/PressureSystemTeachingVisual.tsx`
- `src/features/icu-hemodynamics/components/WaveformAtlasFigure.tsx`
- `src/features/icu-hemodynamics/components/WaveformRecognitionDrill.tsx`
- `src/features/icu-hemodynamics/components/WaveformStrip.tsx`
- `src/features/icu-hemodynamics/components/icu-hemodynamics.module.css`
- `src/features/icu-hemodynamics/components/stage/AtrialComponentActivity.tsx`
- `src/features/icu-hemodynamics/components/stage/FlowPrerequisite.tsx`
- `src/features/icu-hemodynamics/components/stage/HemodynamicsSimulatorPane.tsx`
- `src/features/icu-hemodynamics/components/stage/HemodynamicsStageHost.tsx`
- `src/features/icu-hemodynamics/components/stage/HemodynamicsTaskDrafts.tsx`
- `src/features/icu-hemodynamics/components/stage/HemodynamicsTeachingColumn.tsx`
- `src/features/icu-hemodynamics/components/stage/IntroductoryTeaching.tsx`
- `src/features/icu-hemodynamics/components/stage/StageDocks.tsx`
- `src/features/icu-hemodynamics/components/stage/hemodynamics-flow.module.css`
- `src/features/icu-hemodynamics/components/stage/hemodynamics-stage.module.css`
- `src/features/icu-hemodynamics/components/stage/stageProgress.ts`
- `src/features/icu-hemodynamics/content/introductoryTeaching.ts`
- `src/features/icu-hemodynamics/content/questionSort.ts`
- `src/features/icu-hemodynamics/content/routeSpine.ts`
- `src/features/icu-hemodynamics/content/sectionSpecs.ts`
- `src/features/icu-hemodynamics/content/signalGrammar.ts`
- `src/features/icu-hemodynamics/content/stageItems.ts`
- `src/features/icu-hemodynamics/content/stageLessons.ts`
- `src/features/icu-hemodynamics/content/taskPresentation.ts`
- `src/features/icu-hemodynamics/engine/pressureObservation.ts`
- `src/features/icu-hemodynamics/engine/reducer.ts`
- `src/features/icu-hemodynamics/engine/stageRuntime.ts`
- `src/features/icu-hemodynamics/test-support/stageHarness.tsx`

- `src/app/[locale]/icu-hemodynamics/practice/page.test.tsx`

## Publication follow-up — 2026-09-14

The owner subsequently requested a commit, push and pull request. The validation above records the reviewed implementation before publication of the branch. This follow-up authorizes the PR only; clinical review holds and unlisted-preview status remain unchanged.
