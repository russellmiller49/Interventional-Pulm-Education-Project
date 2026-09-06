# Mechanical circulatory support — the flow rebuild: plan

Date: 2026-09-05. Branch `claude/mec-circ-9-5`, cut from `origin/main` at `119a3d08` (the merged
ECMO R4 rebuild, PR #123). Owner request: "I like the new version [of ECMO]. I would like to use a
similar structure to rebuild the mechanical circulatory support module." Read against the
`medical-education-modules` teaching standard and the ECMO R4 records
(`docs/cardiohelp-ecmo/redesign/r4-*`), including the owner-review decisions R4-OD-5 to R4-OD-12.

This is the Phase 1 plan the standard asks for before any learner-facing text is written or moved.
The implementation record is `mcs-flow-rebuild.md`, beside this file.

---

## 1. What the module already has, and where it misses

Kept, because it is the material: the nine section contracts
(`content/sectionLearningContracts.ts`) — each with a clinical question, a starting state, a
recognize item, a prediction item with an unsafe distractor, a real control with a state-predicate
completion, six observed signals, the four-level explanation, what the section establishes and does
not, the common misreading, and a transfer patient with a required action; the common model
(`commonModel.ts`), the eight pathway cards (`supportPathways.ts`), the nine live teaching panels,
the engine and its harness (`dump-mcs-signals.ts`), the sources, the progress key
`interventionalpulm:mcs-progress:v1`, and Practice/Challenge.

Missed, read against the standard (principle numbers from `SKILL.md`):

| Finding                                | Principle | Where                                                | What the learner meets                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | --------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No door                                | 12        | `McsHub`, `McsLearnLanding`                          | The hub reads no progress and has no Continue; its "recommended first section" link and the landing's start link are separate. The common model and eight pathway cards are rendered in full on the front door — an encyclopedia before the first section.                                                       |
| Old shell                              | R4-OD-3   | `McsWorkbench` → `ActivityShell`                     | Phase stepper above the workspace, an eight-item patient-context bar that prints the congestion pattern on every step, task panel, reference and evidence drawers; the phase rail is repeated inside the task pane. The R4 baseline measured this shape at 90+ controls and 1000+ words on a first screen.       |
| No spine                               | 1         | `McsAnatomyPathwaySummary`, `McsAnatomy3D`           | The "map" is a text table beneath a WebGL heart behind a launch gate. No persistent "you are here", nothing lit, nothing to point at.                                                                                                                                                                            |
| No control-panel moment                | 3, 4      | —                                                    | Thirteen sliders and toggles appear under the Act step from section 1; nothing ever says "you can change only these".                                                                                                                                                                                            |
| No diagnostic grammar                  | 6         | `commonMisinterpretation` ×9                         | Each section names its own misreading in its own words; there is no one table a later section can point at.                                                                                                                                                                                                      |
| No named increments, no story problems | 7, 5      | —                                                    | Each device pair opens cold. The confusable pair — the support setting versus the patient's loading — is never decoupled by experience.                                                                                                                                                                          |
| Titles name the answer                 | leakage   | `lessons.ts`, `learningPathways.ts`, `activities.ts` | "Impella suction, purge, hemolysis, and RV delivery" is the title of the section whose prediction is that the right-sided pump clears the suction; "Durable LVAD low flow, high power, and power emergencies" names the high-power pattern its prediction asks for.                                              |
| Teaching leaks before the commit       | 9         | six of nine panels at `orientation`                  | `data-serial-not-additive` (§6), `data-cpo-paradox="not-present"` (§7), the high-power boundary bullet (§8), `data-parameter-dependency` (§7), the IABP flow-account line "none reported" (§1) and pathway graphic "No source compartment" (§2) each state the prediction's answer while the prediction is open. |
| Verdicts describe, never state         | R4-OD-5   | `AnswerVerdict` default outcome                      | A committed answer is framed ("This is the best explanation…") but never called correct or not.                                                                                                                                                                                                                  |
| No way back                            | R4-OD-8   | phase stepper                                        | The stepper allows moving to an earlier phase, but re-entering re-renders the same pane with nothing saying you are looking back; Restart is the only recovery.                                                                                                                                                  |
| Citations in the panes                 | R4-OD-11  | `EvidenceDrawer`, panel source lists                 | Sources sit in a drawer beside the task and as cards inside the teaching pane.                                                                                                                                                                                                                                   |
| Framework vocabulary                   | R4-OD-9   | throughout                                           | "Record what you identified", "worked through" as a badge, "Your turn", "the model", "topology", "reveal stage", "the causal ladder".                                                                                                                                                                            |

---

## 2. Learner and prerequisites

Fellows, residents, advanced-practice providers and nurses new to temporary and durable mechanical
circulatory support, plus experienced clinicians reviewing. Assumed: basic cardiovascular
physiology, reading an arterial trace, filling pressures from a pulmonary artery catheter (taught
in the sibling hemodynamics module). Miller level: **knows how**. Not a device certification, not
an insertion guide, not a device-selection guide. Everything here is `sme-review` or `draft`,
non-credit, unlisted.

## 3. The spine — one circulation, five stops

Every device is drawn on the same loop: venous return → right atrium → right ventricle → pulmonary
artery → lungs → left atrium → left ventricle → aortic valve → aorta → the body. The
**circulation map** (`components/circulation-map/`) is an authored schematic of that loop with the
selected pathway drawn on it — the balloon in the descending aorta, the left-sided pump across the
aortic valve, the right-sided pump from the vena cava to the pulmonary artery, the durable pump
from the apex to the ascending aorta — the current stop lit, and a caption in words. It sits in the
simulator pane beside the monitor, labelled as a teaching schematic. Location-type items are
answered by choosing a place on it (R4-OD-12).

| Stop | Plain name                               | What a device does here                                                                  | Analogy                                                         | Checklist (≤4)                                                                   |
| ---- | ---------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1    | **Venous return** and the right atrium   | what every pump downstream can draw on; where the right-sided pump takes its blood       | the reservoir: a pump only moves what has already arrived       | volume · right atrial pressure · anything obstructing return                     |
| 2    | **The right ventricle** and the lung     | the pump every left-sided device inherits; where the right-sided pump returns its blood  | the relay runner who must hand over before the next leg can run | right atrial pressure · pulmonary pulsatility · what the left heart is receiving |
| 3    | **The left ventricle**                   | the chamber most devices relieve — the pump's inlet, the durable pump's inflow           | the bucket that gets a helper                                   | wedge pressure · ventricular size · whether the valve still opens                |
| 4    | **The aortic valve and ascending aorta** | where a transvalvular pump's outlet sits; where the balloon's timing is read (the notch) | the doorway the pump reaches through                            | the notch · the assisted beat · where the outlet returns blood                   |
| 5    | **The descending aorta and the body**    | where the balloon sits and displaces; the pressure every pump ejects against             | the pipe downstream: it pushes back                             | mean pressure · resistance · what reaches the organs                             |

## 4. The control panel — a few things, per device

"You can change only a few things on any of these devices. On the balloon, the **assist ratio**
and the **inflation and deflation timing**. On the transvalvular pump, the **performance level**.
On the durable pump, the **speed** — and only with an order. Everything else on the console —
displayed flow, power, pulsatility, timing synchrony, the alarms — is monitoring. The patient's own
conditions — volume, resistance, rhythm, the right ventricle — are the other side, and most of what
the alarms report is about them, not about a setting."

Two axes, stated once and reused on every Explain step: the **setting** (what the device is asked
for) and the **loading** (what the circulation lets it deliver). The control strip on every Explain
step marks each control _this is the setting_ / _not this setting_ / _no setting — find the cause_.

## 5. The one table — what moved → where the constraint lives → shortlist

Authored once (`content/supportGrammar.ts`), highlighted by row in every device section, and
verified against the engine by test: every direction claim is run through the reducer from the
harness states, not asserted.

| What moved                                                                            | Where the constraint lives                                        | Shortlist                                                       | Taught in |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- | --------- |
| Displayed flow falls at an unchanged setting; the source-side filling pressure is low | upstream of the inlet — what reaches the pump                     | volume · the right ventricle · obstruction · inlet position     | 5, 6, 9   |
| Displayed flow falls at an unchanged setting; mean pressure rises                     | downstream of the outlet — what the pump ejects against           | resistance · hypertension · outflow obstruction                 | 5, 7      |
| Displayed flow falls; the wedge pressure rises; a placement alarm                     | the pathway itself — the inlet and outlet are not in two chambers | position                                                        | 5         |
| Power rises; displayed flow and delivered flow do not move                            | the active component — the estimate's assumptions broke           | the high-power pattern; the model does not represent haemolysis | 8         |
| Pressure augmented; delivered flow unchanged or falling; right atrial pressure rising | not the device — the ventricle the device inherits                | the right ventricle · the support ceiling                       | 4, 9      |
| The arterial trace changes shape; synchrony falls; no flow appears                    | the device's timing against the beat                              | inflation early or late · deflation early or late · the trigger | 3         |
| Two pump flows on one screen                                                          | not a sum — pathways in series carry one stream twice             | never add them · read effective delivery                        | 2, 6      |

The trend rule is the table's footnote: compare against this patient's own earlier readings, not
against a number carried from elsewhere.

## 6. Named increments

- Counterpulsation (3–4): "the model plus one idea: a device that changes pressure and timing
  without moving a stream of its own."
- The transvalvular pump (5–6): "counterpulsation plus exactly two ideas: a real second stream,
  whose number is an estimate; and a relieved chamber whose filling the right ventricle still has
  to deliver."
- The durable pump (7–8): "the transvalvular pump plus one idea: the flow you read is computed
  from power and speed, not measured — and the decision to use it is a different kind."
- Choosing (9): "no new mechanism — the limiting problem selects among the three."

## 7. The ladder — nine sections, ids unchanged

Ids, order, stages, prerequisites and minutes stay as registered (`lessons.ts`,
`learningPathways.ts`, `activities.ts`). Titles become presentation titles where the current one
names the answer. What changes is what a section _is_ on screen: every section runs on one stage
with the same six steps — **Recognize → Predict → Act → Observe → Explain → Transfer** — from its
contract; section 2 opens with the walk as a seventh step before its identification.

| #   | Section (presentation title)                  | Stage       | New concept (one)                                                            | Stop     | Act step                                                                                                  |
| --- | --------------------------------------------- | ----------- | ---------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| 1   | A pressure that looks fine                    | foundation  | pressure, flow, oxygen delivery and organ response answer four questions     | 5 → 1    | open the three readings in turn; nothing is changed                                                       |
| 2   | Three devices called support                  | foundation  | a pathway is source, active component, destination — and only two move blood | the walk | **the walk**, then select each mechanism in turn; the **control-panel sort** on Explain                   |
| 3   | Is the balloon inflating at the right moment? | mechanism   | timing decides how much of a mechanism is available                          | 4        | move inflation to the notch                                                                               |
| 4   | Timed correctly, still not perfusing          | application | a device can be right and insufficient; the display will not say which       | 2        | reduce right ventricular contractility                                                                    |
| 5   | The setting held and the flow fell            | mechanism   | a pump works by sitting in two chambers at once                              | 3–4      | move the inlet out of position                                                                            |
| 6   | When more support delivers less               | application | serial pathways carry one stream twice                                       | 1–2      | start the right-sided pump; **story problems** (the level for a suction alarm; volume for the same alarm) |
| 7   | The speed held and the displayed flow fell    | mechanism   | displayed flow is computed from power and speed                              | 5        | raise systemic resistance                                                                                 |
| 8   | Power climbed and the flow did not move       | application | a power signature carries what the flow display does not                     | 3        | switch on the high-power pattern                                                                          |
| 9   | Low output on left-sided support              | integration | no new mechanism — the limiting problem selects                              | 1–2      | raise the level and watch it fail to help                                                                 |

Two items are answered on the map, by the R4-OD-12 rule (every choice a place, or an explicit
"not a place"): section 6's identification (where the right-sided pump returns blood) and section
9's (which side is limiting delivery). The rest keep their lists; the reasons are pinned in
`map-answer.test.tsx`.

## 8. What the model does not represent (stated to the learner, per section)

Displayed pump flows are the model's own estimates and are labelled so; effective delivery is a
reasoned line no console shows. The pulmonary pulsatility index moves only weakly with right-sided
support in this model, and only through right atrial pressure — no section asks the learner to
judge right-sided support from it. The high-power pattern raises power and leaves delivered flow
where it was; haemolysis, neurological events and collapse are not represented. A control change
advances the model by a small fixed step. No insertion, repositioning, purge, anticoagulation or
alarm-limit instruction; no product alarm limit is reproduced; no patient outcome is modelled.
Every authored value is badged simulated.

## 9. Source classes

Guideline (ISHLT/HFSA acute MCS 2023; ISHLT durable MCS 2023), consensus (ACC 2025 congestion
patterns), labelling and manufacturer (FDA Impella CP/5.5/RP labeling, HeartMate 3 IFU, Getinge
IABP), primary literature (the CPO and PAPi cohorts, the congestion cohorts), supplied reference
packages (the bedside MCS reference, the hemodynamics reference), and authored teaching constructs
(the circulation map, the five stops, the control panel, the one table, the story problems, every
simulated magnitude) — the last labelled as such wherever shown. Every section's citations fold
into one footer block, and their claim sentences wait for the commitment.

## 10. The shell

The lean shell is the one promoted from ECMO R4 on the mechanical-ventilation rebuild
(`src/features/learning-module/stage/`, adopted here verbatim so the two branches merge without a
third copy): `LessonShell`, `StageLayout` over the shared three-pane workspace, `SectionHeader`,
`ContextStrip`, `NowCard` with Back, `StepList`, `SectionsDrawer`, `HelpDialog`,
`StageSourcesFooter`, `StageTeachingScope` and `StageBlock`, `choiceOrder`. The MCS stage runs on
the dark palette the device surfaces already use; the hub stays as it is themed.

Panes: **Simulator** — the bedside monitor always, the circulation map, the controls (opened on
Act with the section's control highlighted), and the three-dimensional view behind its launch
gate; **Teaching** — the section's existing live panel and the contract's teaching, in
`StageBlock`s that fold to their headings when they are not the step's focus, the first block
only until the commitment; **Steps** — the Now card, the step list, the objectives disclosure on
step one, the completion card.

## 11. Not in this package

Micro-cases after each mechanism; Practice and Challenge on the lean shell (they keep
`McsWorkbench` and the case workflow; their pre-debrief titles are named by presentation on the
hub only); re-pointing the ECMO module at the shared stage; localisation; subject-matter review of
anything carrying `draft` or `sme-review`; the PAPi engine limitation (recorded in
`mcs-model-limitations.md`, unchanged).
