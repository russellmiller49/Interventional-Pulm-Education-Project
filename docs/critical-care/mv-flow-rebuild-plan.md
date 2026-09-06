# Mechanical ventilation — the flow rebuild: plan

Date: 2026-09-05. Branch `claude/mv-flow-rebuild`, cut from `codex/mechanical-ventilation-update`
at `7976e5b3` (itself on `origin/main` at `119a3d08`, the merged ECMO R4 rebuild). Owner request:
keep the content Codex authored, rebuild the flow and engagement on the principles the ECMO R4
rebuild used (`docs/cardiohelp-ecmo/redesign/r4-*`), against the `medical-education-modules`
teaching standard.

This is the Phase 1 plan the standard asks for before any learner-facing text is written or moved.
The implementation record is `mv-flow-rebuild.md`, beside this file.

---

## 1. What the Codex build got right, and where it missed

Right, and kept: the fourteen-unit ladder (`content/learningCurriculum.ts`) with its stages,
prerequisites, minutes, analogy / precise statement / checklist / worked example / boundary per
unit; the twenty-eight live experiments (`content/learningExperiments.ts`), each with a prediction,
three misconception-linked rationales, a real action on the running engine and an observation
interval; the passive teaching patient `MV-LAB`; the event-sourced session and checkpoint
(`engine/learningLab.ts`); the ten-item final check; the fifteen clinical cases untouched.

Missed, read against the standard (principle numbers from `SKILL.md`):

| Finding                                        | Principle                     | Where                                                   | What the learner met                                                                                                                                                                                      |
| ---------------------------------------------- | ----------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No door                                        | 12                            | `page.tsx`, `learn/page.tsx` → `CourseHome`             | Both routes open directly on unit 1's running console. No hub, no "Continue — next section", no derived composition, the module frame removed from Learn. The map is a dialog behind "Learning map 0/14". |
| Runway skipped                                 | 2, 4                          | `LearningActivity` first screen                         | 300+ words of console readouts and two patient-mechanics sliders before the learner knows what a breath is. No "why this therapy exists".                                                                 |
| No spine                                       | 1                             | `unit.spine` authored, never rendered                   | No persistent "you are here" on the breath. `VentilationBreathSpine` had zero importers.                                                                                                                  |
| No control-panel moment                        | 3, 4                          | `controls-and-goals`                                    | The enumerated "you can change five things" never appears; sliders appear from unit 1.                                                                                                                    |
| No diagnostic grammar                          | 6                             | `ventilationDecisionTable` (6 rows)                     | Authored, zero importers.                                                                                                                                                                                 |
| Analogy → checklist → application not rendered | 3                             | `unit.analogy/checklist/example/why/increment/boundary` | Authored for all 14 units, rendered nowhere. Only the experiment rounds reached the screen.                                                                                                               |
| One loop, 28 times                             | 7, 11                         | Explore → Predict → Change → Explain ×2 per unit        | Identical shape on every unit; no named increments, no story problems, no micro-cases.                                                                                                                    |
| Teaching hidden                                | —                             | `<details>` "Explain the physiology on this ventilator" | The nine live teaching panels folded shut under the coach.                                                                                                                                                |
| Framework vocabulary                           | R4-OD-9                       | throughout                                              | "Commit prediction & take the controls", "Test the relationship in the next setup", "evidence", "experiment", "explore the relationship".                                                                 |
| Friction gate with no teaching value           | contract §Explicit completion | `CONTINUE` requires a ≥12-character reflection          | A text-length gate; not a learning act, not scored, not reviewed.                                                                                                                                         |
| Three progress stores                          | —                             | `live-learning-v1`, `learning-flow-v1`, legacy          | Half of `learningProgress.ts` (the six-step reading ladder) is parsed and never written.                                                                                                                  |
| Diagnosis-named cases pre-reveal               | leakage contract              | Practice picker, unit case chips                        | "Sudden loss of compliance: tension pneumothorax" is the case title on every surface.                                                                                                                     |

The engine-verified experiments are exactly the "Act step with something to do" that R4-OD-6 asked
for on ECMO. They are the material; the flow around them is what changes.

---

## 2. Learner and prerequisites

Fellows, residents, respiratory therapists and nurses new to invasive ventilation, plus
experienced clinicians reviewing. Assumed: basic respiratory physiology and blood-gas reading.
Miller level: **knows how**. Not a device certification, not a neonatal curriculum, not a
liberation course. Everything here is `draft`, non-credit, unlisted.

## 3. The spine — one breath

Four stops, walked once on the normal running breath and lit on every later section:

| Stop | Plain name                         | On the console                                                          | Analogy                                      | Checklist (≤4)                                                             |
| ---- | ---------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- |
| 1    | **Start** — the trigger            | trigger sensitivity; the pressure dip / flow deflection before a breath | the doorbell: who rings it, patient or timer | who started it · did every effort start one · any breath with no effort    |
| 2    | **Push** — inspiration             | set volume or pressure, flow, inspiratory time; Ppeak                   | filling a balloon through a straw            | how fast (flow) · how much (volume) · what it cost (pressure)              |
| 3    | **Switch** — cycling               | inspiratory time / cycle-off; the flow dropping to zero                 | letting go of the pump handle                | what ended it: time, flow, or the patient · did the patient agree          |
| 4    | **Empty** — expiration to baseline | PEEP; expiratory flow returning to zero                                 | the balloon emptying through the same straw  | did flow reach zero before the next start · where the baseline sits (PEEP) |

The persistent map is a **breath map**: an authored schematic of one passive volume-controlled
breath on three stacked traces (pressure, flow, volume) with the four stops marked, a halo on the
current stop and a caption ("You are here: Empty — expiration."). It sits in the simulator pane
under the live console, labelled as a teaching schematic; the real traces are on the console above
it. Location-type predictions are answered by choosing a stop on it (the R4-OD-12 pattern).

## 4. The control panel — five things

"You can change five things on this ventilator: the **mode** (what the breath holds constant),
the **size of the breath** (a volume or a pressure), the **rate**, the **PEEP**, and the
**oxygen**. Three more shape the breath — flow or inspiratory time, trigger sensitivity, and
cycle-off — and you meet them at their stop. Everything else on the screen is monitoring."

Two axes, stated once and reused on every gas-exchange debrief: **oxygenation** (oxygen, PEEP) and
**ventilation** (rate × breath size, less the part that reaches no exchanging lung). The knob strip
in every Explain step marks each knob _this is the knob_ / _not this knob_ / _no knob — find the
cause_.

## 5. The diagnostic grammar — what moved → where on the breath → shortlist

Built from `ventilationDecisionTable`, given a breath location, and verified against the engine by
test (direction claims are run, not asserted):

| What moved                                                              | Where on the breath                   | Shortlist                                                       | Taught in |
| ----------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------- | --------- |
| Peak up, valid plateau near baseline, same volume and flow              | Push — while gas moves                | tube · secretions · airways · circuit                           | 4         |
| Peak and valid plateau up together, same volume and total PEEP          | Push — end of inspiration             | lung · chest wall · trapped gas · one lung                      | 4, 14     |
| Expiratory flow still running when the next breath starts               | Empty                                 | too little time · slow emptying · rate too high                 | 7         |
| Efforts with no breath, or breaths with no effort                       | Start                                 | trigger setting · trapped gas · weak effort · leak / condensate | 8, 11     |
| Effort continues after flow stops, or flow stops while effort continues | Switch                                | cycle-off · inspiratory time · demand                           | 8, 12     |
| Pressure scoops inward during a volume breath                           | Push — while gas moves                | set flow below demand · high drive                              | 11, 12    |
| Saturation moves, breath pattern quiet                                  | not the breath — the oxygenation axis | oxygen · PEEP · shunt · circulation                             | 9         |
| CO₂ moves, saturation acceptable                                        | not the breath — the ventilation axis | rate · breath size · emptying · dead space · production         | 10        |

## 6. The ladder — fourteen sections, ids unchanged

Unit ids, order, stages, prerequisites and minutes stay as registered (`activities.ts`,
`learningPathways.ts`, `catalogs.test.ts`). What changes is what a section _is_ on screen. Every
section runs on one stage with the same eight steps: **Recognize → Predict → Act → Observe →
Explain → Transfer (predict) → Transfer (do it and watch) → Transfer (what changed)**, the first
five from experiment round 1 and the last three from round 2 — round 2 was authored as the
transfer ("repeat under pressure control", "change oxygen while delivery stays fixed").

| #   | Section (presentation title)                | Stage       | New concept (one)                                   | Spine stop     | Act step                                                                                                            |
| --- | ------------------------------------------- | ----------- | --------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | Follow one supported breath                 | orientation | a breath is a cycle with time to empty              | whole          | pause during expiration on the live breath                                                                          |
| 2   | Three traces, one breath                    | foundation  | three descriptions of one event                     | whole          | **the walk** — four stops on the breath map, each with its look on the console                                      |
| 3   | What you set. What you check.               | foundation  | a setting is a request; a measurement is the result | Push           | **the five-knob sort** — attribute six screen values to _you set it_ / _the patient reports it_, committed as a set |
| 4   | Where does the pressure go?                 | mechanism   | airway pressure carries two loads                   | Push           | resistance up, inspiratory hold                                                                                     |
| 5   | What does this breath hold constant?        | mechanism   | the controlled variable decides what you watch      | Push           | stiffen under volume control; transfer under pressure control                                                       |
| 6   | Is this breath appropriate for this lung?   | mechanism   | size the breath to predicted body weight            | Push           | reduce the breath, hold; transfer: an active patient's hold                                                         |
| 7   | Does the breath have time to finish?        | mechanism   | expiration needs enough time                        | Empty          | rate up in a resistive model; transfer: earlier cycle-off in MV-10                                                  |
| 8   | Do the two breath clocks agree?             | mechanism   | the patient's timing joins the machine's            | Start / Switch | trigger in MV-07; transfer: cycling in MV-09 (both **answered on the breath map**)                                  |
| 9   | Did oxygenation improve at a cost?          | mechanism   | benefit and cost are judged together                | — (axis)       | PEEP in MV-01; transfer: oxygen in the passive patient                                                              |
| 10  | What will change the CO₂?                   | mechanism   | moved gas and effective gas differ                  | Empty          | rate up; transfer: same rate, smaller pressure breaths + **story problems** (oxygen for CO₂; rate into trapping)    |
| 11  | Read the whole breath in order              | application | one repeatable read                                 | whole          | MV-08 extra breaths back to the circuit; transfer: MV-02 flow                                                       |
| 12  | Locate the mismatch before changing support | application | localize, then change                               | Push / Switch  | MV-11 pressurization; transfer: MV-10 cycling (**answered on the breath map**)                                      |
| 13  | The alarm and the person                    | application | action, then reassessment                           | whole          | MV-15 assess and communicate; transfer: the delayed pain intervention                                               |
| 14  | One alarm, different patients               | integration | no new mechanism — combine                          | Push / Empty   | hold in an undisclosed resistive setup; transfer: a stiffer passive setup                                           |

Named increments come from `unit.increment` and open every section's Recognize step.

## 7. What the model does not represent (stated to the learner, per section)

Single-compartment passive mechanics unless the case authors effort; the effort trace is an
educator-only model signal; plateau validity is a window over recent effort, not an instantaneous
sample; PEEP response and recruitment are bounded and not a titration protocol; the gas-exchange
clock is a bounded delayed response, not a sampling schedule; no drug dosing, no manual
ventilation, no emergency choreography; the four console facsimiles paraphrase vendor screens and
are not certification. Every authored value is badged simulated.

## 8. Source classes

Textbook (Tobin 3e chapters), guideline (ATS 2024 ARDS; AARC 2024 patient–ventilator assessment),
primary literature (Antonogiannaki 2017), manufacturer (PB980 manual and the device profiles'
sources), and authored teaching constructs (the five-knob panel, the breath map, the grammar, the
passive patient, every experiment magnitude) — the last labelled as such wherever shown. Every
section's citations fold into one footer block and their claim sentences wait for the commitment.

## 9. Not in this package

Micro-cases after each mechanism; presentation titles inside the case activity itself (only the
picker and the pairing chips are renamed here); re-pointing the ECMO module at the promoted stage
primitives; localisation; subject-matter review of anything carrying `draft`.
