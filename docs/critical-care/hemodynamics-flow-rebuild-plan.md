# ICU hemodynamics — the flow rebuild: plan

Date: 2026-09-05. Branch `claude/hemodynmaics-9-5`, cut from `origin/main` at `119a3d08` (the
merged ECMO R4 rebuild) with the open H5 derived-hemodynamics branch merged in at `fc91c4c5`, so
the derive section is built on the canonical metric model rather than forking it. Owner request:
rebuild the hemodynamics module on the structure the ECMO flow rebuild used
(`docs/cardiohelp-ecmo/redesign/r4-*`), against the `medical-education-modules` teaching standard.

This is the Phase 1 plan the standard asks for before any learner-facing text is written or moved.
The implementation record is `hemodynamics-flow-rebuild.md`, beside this file.

---

## 1. What the module has, and where it missed

Kept: the deterministic engine (`engine/`), the bedside monitor and every waveform drawn from one
morphology module, the H0–H5 content — the validity sequence, the normal waveform reference and
its faulted-display challenges, the advancement scenarios with derived stop logic, the wedge
sequence with its authored non-returning state, the three-record cardiac-output model and the
disagreement scenarios, the canonical derived-metric records and the episode evaluator — and the
eight Practice cases, the challenge, and every prediction and transfer item.

Missed, read against the standard (principle numbers from `SKILL.md`), measured on the dev server
at 1440×900 on each section's first step:

| Finding                       | Principle | Where                                                         | What the learner met                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | --------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Encyclopedism                 | —         | every section                                                 | `pressure-system` opens on 3,269 visible words (3,025 under 13 px) in three 423 px panes holding 736 / 4,416 / 5,828 px, with 27 headings. `thermodilution-series` opens on 6,560 words in panes holding 7,771 and 8,694 px. The eight-artifact atlas and the thirteen-row troubleshooting table are on screen before the learner has done anything. |
| Answer leakage                | 9         | `pressure-system` context strip                               | "Signal artifact: underdamped", "Transducer level +10 cm", "Pressure zero: Required" are printed above the workspace before the prediction whose keyed answer is "off level, not zeroed, and underdamped".                                                                                                                                           |
| Inert phase bar               | 12        | `ActivityShell` header                                        | Recognize → Transfer rendered as a strip that does nothing; the learner's real progression is a `phase` state the strip only reflects.                                                                                                                                                                                                               |
| No spine                      | 1         | —                                                             | The catheter's route is drawn (`NormalWaveformAnatomyFigure`, the 3D heart) but nothing on it says "you are here", nothing is answered on it, and the measurement chain between the tip and the number is not drawn at all.                                                                                                                          |
| No control-panel moment       | 4         | —                                                             | Level, zero, scale, catheter depth, balloon, fast flush, injectate and sampling are met as a dock of buttons; the learner is never told what they can change and what is monitoring.                                                                                                                                                                 |
| No diagnostic grammar         | 6         | `troubleshootingReferenceRows`, `pressureSystemValiditySteps` | Thirteen reference rows and nine validity steps exist; no single table says what moved → where it lives → the shortlist, and no section highlights a row.                                                                                                                                                                                            |
| Normal after broken           | 2         | `pressure-system`                                             | The section opens on an off-level, unzeroed, underdamped system with the artifact atlas beside it. The learner never sees a well-set-up line before the four faults.                                                                                                                                                                                 |
| No orientation                | ladder    | pathway                                                       | Section one is "can I trust this signal?" — a foundation question. Why a pressure line is placed at all, what it adds to the bedside picture, and what it cannot tell you are on the Overview page as prose and nowhere in the pathway.                                                                                                              |
| No door                       | 12        | `IcuHemodynamicsOverviewV2`, `IcuHemodynamicsLearnLandingV2`  | Both send everyone to section one; neither reads progress. The Practice landing is the only surface that does. Counts on the Overview are derived; the five-step runway beneath them is hardcoded prose.                                                                                                                                             |
| Completion cannot be recorded | contract  | `authoritativeCriticalCareStatus`                             | Six of seven Learn activities carry `completionEvidenceAuthority: 'none'`, so the shared envelope downgrades every completion to in-progress. A "first incomplete section" resolver over that store would return section one forever.                                                                                                                |
| Story problems absent         | 5         | level/zero vs damping; more balloon for a poor wedge          | The confusable pairs are asserted in prose ("Leveling changes the number, not the waveform") and never experienced.                                                                                                                                                                                                                                  |
| Examination vocabulary        | R4-OD-9   | `PacGuidedSkillActivity`, the docks                           | "Commit this reading", "Orient to this skill station", "Skill surface", "authored", "deterministic model", "Draft reviewed · non-credit".                                                                                                                                                                                                            |

The engine-backed actions — level and zero the transducer, run a fast flush, advance the catheter
by waveform, capture and release a wedge, generate and review a thermodilution series, evaluate a
derived episode — are exactly the "Act step with something to do" the ECMO owner review asked for.
They are the material; the flow around them is what changes.

---

## 2. Learner and prerequisites

Fellows, residents and ICU nurses new to invasive pressure monitoring and the pulmonary-artery
catheter, plus experienced clinicians reviewing. Assumed: basic cardiac anatomy and the direction
of blood through the right heart, reading an ECG rhythm strip, and familiarity with an ICU bedside
monitor. No prior catheter experience. Miller level: **knows how**. Not instruction in placing a
catheter in a patient; not shock management (Practice applies it, Learn does not teach it). Every
authored item stays `sme-review` or `draft`, non-credit, unlisted.

## 3. The spine — the pressure's path, from the tip to the number

Five stops. Four are places the catheter tip sits; the fifth is everything between the tip and
the displayed number. Walked once, normal, in sections 2 and 3; lit on every later section.

| Stop | Plain name                   | What the monitor calls it | Analogy                                                                     | Checklist (≤4)                                                          |
| ---- | ---------------------------- | ------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 0    | **The line** — tip to number | the transducer, the scale | a garden hose to a gauge: height, what you call zero, how stiff the hose is | level · zero · scale · flush response                                   |
| 1    | **Right atrium**             | CVP / RA / RAP            | a filling room with a door that shuts (the tricuspid valve)                 | a and v waves · x and y descents · read the mean · at end expiration    |
| 2    | **Right ventricle**          | RV                        | the pump chamber: high in systole, near zero then rising in diastole        | systolic peak · diastolic dip then up-slope · no notch · rhythm matters |
| 3    | **Pulmonary artery**         | PA / PAP                  | the pipe after the pump: the diastolic floor steps up, the notch appears    | systolic peak · dicrotic notch · diastolic run-off · diastolic step-up  |
| 4    | **The wedge**                | PAWP / PAOP               | listening through a stopped branch to the left atrium                       | atrial shape returns · mean below PA diastolic · brief · PA comes back  |

The persistent map is the **route map** (`components/route-map/`): the existing right-heart
schematic (SVC, RA, TV, RV, PV, PA, distal PA — the geometry `NormalWaveformAnatomyFigure` draws
once and never moves) extended leftward with the line — catheter hub, tubing and stopcock, flush
bag, transducer, monitor — as one drawing. The current stop is haloed and captioned in words
("You are here: the pulmonary artery. Stop 3 of 4."). It sits in the simulator pane under the
live bedside monitor, labelled a teaching schematic. Location-type predictions — where is the tip,
where in the chain does the problem live — are answered by choosing a stop or a chain segment on
it, as numbered pins that are a native radio group (the R4-OD-12 pattern). The 3D heart is not on
the stage: the map is where answers go, and a drawing the pane cannot verify would be a second map.

## 4. The control panel — five things

"You can change five things on this monitoring system: **where the transducer sits** (level),
**what it calls zero**, the **display scale**, **where the catheter tip is** (advance or
withdraw), and **whether the balloon is up**. Three more are checks you run, not settings: a
**fast flush**, a **thermodilution injection**, and a **blood sample**. Everything else on the
screen is monitoring — the pressures are read, flow is measured, and every other number is
calculated from them."

Two axes, stated once in section 1 and reused on every Explain step: **the reference** (level and
zero move the whole tracing up or down and change no shape) and **the response** (damping and
scale change the shape and the size and move nothing). The knob strip in every Explain step marks
each of the five as _this is the one_ / _not this one_ / _no setting — find the cause_.

## 5. The diagnostic grammar — what you see → where it lives → the shortlist

Built from `troubleshootingReferenceRows`, `pressureSystemValiditySteps`, the cardiac-output
failure modes and the derived-metric records, each row given a stop on the spine, and verified
against the engine by test where the engine models it (direction claims are run, not asserted):

| What you see                                                                         | Where it lives                       | Shortlist                                                         | Engine-checked | Taught in |
| ------------------------------------------------------------------------------------ | ------------------------------------ | ----------------------------------------------------------------- | -------------- | --------- |
| Whole tracing shifted up or down; shape intact                                       | the line — the reference             | level · zero                                                      | yes            | 1         |
| Tracing tiny, flat or clipped; shape intact once rescaled                            | the line — the display               | scale · channel                                                   | yes            | 1         |
| Rounded upstroke, lost notch, narrow pulse pressure; the flush returns slowly        | the line — the fluid path (damped)   | air · clot or kink · bag pressure · loose or compliant tubing     | yes            | 1         |
| Sharp overshoot, ringing after the flush, exaggerated systolic                       | the line — the fluid path (resonant) | tubing and components · transducer · catheter motion              | yes            | 1         |
| Atrial contour with a and v waves; low, near-flat mean                               | the right atrium                     | it is where it says — read it at end expiration                   | yes            | 2         |
| Ventricular contour: high peak, diastole dips then rises, no notch                   | the right ventricle                  | tip in the ventricle — a stop, not a reading, if you meant PA     | yes            | 2, 3      |
| Diastolic floor steps up and a notch appears                                         | the pulmonary artery                 | confirmed PA — the position every measurement starts from         | yes            | 2, 3      |
| PA pulsatility gone, atrial shape back, balloon down                                 | the tip — too far                    | spontaneous wedge: withdraw under supervision, never flush        | yes            | 4         |
| "Wedge" keeps PA pulsatility, or its mean is not below PA diastolic, or keeps rising | the occlusion                        | incomplete occlusion · zone · over-wedged — deflate, do not add   | partly         | 4         |
| Three curves disagree, or one is late, double-peaked or slow                         | the technique                        | injection speed and timing · volume and temperature · rhythm · TR | yes            | 5         |
| A calculated number that contradicts the patient                                     | its inputs                           | trace each input's validity before reading the output             | yes            | 6         |

Every mechanism section highlights its rows in the one table; no section restates one. The
trend rule footnotes it: compare against this patient's own baseline, at end expiration.

## 6. The ladder — eight sections

One section is new. The seven existing ids, their order, stages and minutes are unchanged, and the
new orientation section is registered ahead of them in the shared catalog and pathway together
(`activities.ts` + `learningPathways.ts`, with the hub-alignment test moving with it). Every section
runs on one stage with the same shape: **Recognize → Predict → Act → Observe → Explain →
Transfer (predict) → Transfer (do it) → Transfer (what changed)**, with the walk sections
replacing Recognize by the walk and two sections carrying a sort or an attribution at Act.

| #   | Section (presentation title)                                       | Stage       | Min | New concept (one)                                                                | Spine stop | Act step                                                                                                                                               |
| --- | ------------------------------------------------------------------ | ----------- | --- | -------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Why put a line in at all? (`why-measure`, new)                     | orientation | 6   | a pressure measured inside the circulation answers some questions and not others | whole      | **the question sort** — six bedside questions attributed to _this line can answer it_ / _not on its own_, committed as a set                           |
| 1   | Can this number be trusted? (`pressure-system`)                    | foundation  | 12  | the line has a reference and a response, and they fail separately                | 0          | level, zero and fast-flush the live line; **the control-panel moment**; **two story problems** (level/zero vs damping)                                 |
| 2   | Four places, four shapes (`waveform-interpretation`)               | mechanism   | 18  | each chamber writes its own shape, and the shape names the place                 | 1–4        | **the walk** — four stops on the route map, each with its tracing on the monitor; then name the place from a faulted display (**answered on the map**) |
| 3   | Where is the tip? (`catheter-advancement`)                         | foundation  | 15  | the tracing, not the depth, says where you are — and when to stop                | 1–3        | advance from the introducer confirming each transition on the monitor; stop conditions as commitments                                                  |
| 4   | Listening through a stopped branch (`pawp-capture`)                | mechanism   | 15  | a wedge is brief, end-expiratory, plausible, and over when PA returns            | 3–4        | the wedge sequence on the live line: occlude, cursor, store, deflate, confirm PA; **story problem** (more balloon for a poor wedge)                    |
| 5   | How much is flowing? (`thermodilution-series`)                     | mechanism   | 18  | a flow measurement has a technique, and the curve shows whether it held          | 1, 3       | generate, inspect, accept or exclude three trials; then name each method's provenance                                                                  |
| 6   | Numbers made of numbers (`derived-hemodynamics`)                   | application | 15  | a derived value is an equation over measurements and inherits their validity     | 0–4        | the H5 episode workbench: selective withholding, method disagreement, threshold context                                                                |
| 7   | The screen that does not fit the patient (`pac-signal-validation`) | integration | 20  | no new mechanism — combine the rows                                              | whole      | HD-08: correct the line, reposition the tip, repeat the series, then reassess — each on the engine                                                     |

Named increments open every Recognize step ("Section 3 adds one idea to section 2: the shape you
already know now tells you when to stop").

### Prerequisite closure

| Section | Assumes                                              | Taught in |
| ------- | ---------------------------------------------------- | --------- |
| 1       | what a pressure line is for                          | 0         |
| 2       | a trusted line; end expiration as the reading moment | 1         |
| 3       | the four normal shapes                               | 2         |
| 4       | a confirmed PA; the atrial shape                     | 2, 3      |
| 5       | a confirmed PA (thermistor) and RA (injectate port)  | 3         |
| 6       | valid pressures and a measured flow                  | 1, 4, 5   |
| 7       | every row of the table                               | 1–6       |

## 7. What the model does not represent (stated to the learner, per section)

Every fault magnitude — the level offset, the damping, the artifact shapes, the route timings, the
thermodilution curves — is set for this simulation and badged as such; the ten-second balloon
auto-release is a simulator rail, not a clinical limit (no source supplies one); no balloon volume
in millilitres, no inflation-time limit, no numeric resistance threshold, no knotting or
conduction-complication management, and no treatment target appear anywhere, because no
registered source licenses them; the simulated deflation always restores PA, so the non-returning
state is authored; Fick inputs are authored specimens; the derive section shows no BSA formula and
no universal normal ranges; recognition, escalation and documentation never improve the patient.
The pressure-system, waveform and derive sections are signal interpretation; the advancement and
wedge sections are simulated recognition of waveforms and stop conditions, not procedural
instruction.

## 8. Source classes

Guideline (ESC/ERS PH 2022, ESICM shock 2025, SSC 2026), review (PAC waveforms and derived values
2021, PAC review 2014, CVP measurement 2017, arterial-pressure five-step 2020, PA compliance 2026),
primary literature (PAPi, CPO, PPV, Morine 2016), manufacturer (Edwards Swan-Ganz IFU 2023),
supplied references (EMCrit RHC, the master reference, the monitor workflow document, the
clinical-hemodynamics waveform text) and authored teaching constructs (the route map, the five-thing
panel, the grammar, the story-problem magnitudes, the educational model `icu-hemodynamics-model-v1`)
— the last labelled as such wherever shown. Every section's citations fold into one footer block,
and each source's claim sentence waits for the commitment.

## 9. One door, one map

`content/pathwayResolver.ts` is the single resolver: `nextIncompleteHemodynamicsSection` walks the
canonical order and returns the first section without a completed record. Completion lives in a
module-local Learn record (`engine/learnProgress.ts`, key `icu-hemodynamics-learn-v1`) because the
shared envelope cannot record it (§1). The Overview hero, the Learn landing and the accordion's
"Up next" all call it; the composition line ("8 sections · 1 orientation · 2 foundations · 3
mechanisms · 1 application · 1 capstone · 119 min") is counted at render; the accordion groups by
stage as contiguous runs of the one order, and a test asserts flattening reproduces it.
Commitments are never persisted: a reload starts a section at its first step, and a URL naming a
later phase fails closed at the prediction (the ECMO rule).

## 10. Not in this package

Micro-cases after each mechanism; shock-phenotype teaching (the pressure–flow–resistance grammar
the Practice cases apply — an H6 package with its own sources); re-pointing the ECMO module at the
shared stage; localisation; subject-matter review of anything carrying `draft`; the 3D heart on
the stage (an owner decision); Practice and Challenge, which keep `HemodynamicCaseActivity`.
