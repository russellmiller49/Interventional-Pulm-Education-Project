# Mechanical ventilation: learn on the running ventilator

> **Superseded on 2026-09-05.** The flow this document describes — both routes opening directly on
> a running console, a four-phase loop per experiment, a learning-map dialog, a reflection gate —
> was replaced by the lesson-stage rebuild recorded in
> [`critical-care/mv-flow-rebuild-plan.md`](./critical-care/mv-flow-rebuild-plan.md) and
> [`critical-care/mv-flow-rebuild.md`](./critical-care/mv-flow-rebuild.md). The curriculum, the
> experiment rounds, the passive patient, the saved-record design and the provenance sections below
> still describe what is on the stage; the interaction, completion and layout sections do not.

Design/review date: September 5, 2026. Audience: mixed experience, with a guided beginner entry
and an experience-based entry. Release status: existing tester preview.

The live patient is the teaching surface. The module opens directly on a running supported
breath; the learner adjusts the original ventilator or patient-mechanics controls and watches
its real pressure, flow, volume, gas exchange, and patient response. A short adjacent coach gives
the next experiment. Reading, sources, and question review support that interaction.

## Scope and alignment

Apply the medical-education-modules device/physiology playbook (A), supplemented by signal
interpretation (C), clinical reasoning (D), and communication (G). Kern's problem analysis is
structural: the previous redesign displaced the simulator with reading/check screens. No learner
analytics or observed learning-effectiveness data were supplied. The author explicitly requested
that the original interactive value be restored while improving the educational sequence.

Assume basic respiratory anatomy and familiarity with blood gases. Teach adult ventilation
reasoning at Miller's **knows how** level. This is not a neonatal curriculum, a liberation course,
a device certification, or evidence of independent bedside competence.

| Objective                                                             | Bloom / Miller         | Main units | Observed task                                                                    |
| --------------------------------------------------------------------- | ---------------------- | ---------- | -------------------------------------------------------------------------------- |
| Interpret a breath and distinguish settings from delivery             | Interpret / knows how  | 1–3, 5     | Pause a real expiration; change flow/volume; compare volume and pressure control |
| Distinguish pressure contributions and assess lung-protection context | Analyze / knows how    | 4, 6–7     | Change mechanics, perform holds, inspect effort and emptying                     |
| Locate a patient–machine timing mismatch                              | Analyze / knows how    | 8, 11–12   | Change trigger, cycling, or pressurization; inspect the resulting breath         |
| Separate oxygenation and ventilation responses                        | Apply / knows how      | 9–10       | Follow oxygen, pressure, delivered ventilation, and the slower gas response      |
| Connect an intervention to patient reassessment                       | Prioritize / knows how | 13–14      | Observe delayed comfort responses; distinguish two high-pressure presentations   |

The canonical 14-unit order, five stages, prerequisites, case mappings, sources, and estimated
minutes remain in `learningCurriculum.ts`. The prerequisite graph still puts the normal breath
before loads, modes, timing, gas exchange, and integration. Estimates include exploration and
explanation; they require calibration in a learner pilot.

## Lesson specs and sequence

The executable lesson spec is `learningExperiments.ts`: each round specifies the initial
patient/setup, introduction, observable signals, prediction, three misconception-linked
rationales, actual engine commands that must be observed, response interval, comparison metrics,
and explanation. `learningCurriculum.ts` supplies the objective, prerequisites, source classes,
clinical question, and later reuse. No interpretation is substituted for an observed response.

| Unit                      | One relationship / application                 | First live experiment                                         | Transfer or later retrieval                                                      |
| ------------------------- | ---------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1. Supported breath       | Follow inward and outward gas movement         | Pause during an actual expiration                             | Increase flow and watch the same volume arrive sooner                            |
| 2. Waveforms              | Read three signals on one time axis            | Change flow at fixed volume                                   | Stiffen the patient at fixed volume                                              |
| 3. Controls and goals     | Input versus delivered result                  | Raise selected volume and inspect its pressure cost           | Change oxygen while breath delivery remains fixed                                |
| 4. Mechanics              | Flowing versus elastic pressure                | Raise resistance and perform a hold                           | Lower compliance and repeat the hold                                             |
| 5. Modes                  | Controlled versus dependent variable           | Lower compliance under volume control                         | Repeat under pressure control                                                    |
| 6. Lung protection        | Volume context and valid pressure              | Reduce breath size in an authored PBW example                 | Repeat the hold in active MV-01; inspect effort contamination                    |
| 7. Expiration             | Time available to empty                        | Increase rate in a resistive passive model                    | Change cycling in obstructive MV-10                                              |
| 8. Patient–machine clocks | Start versus end of support                    | Adjust triggering in MV-07                                    | Adjust cycling in MV-09                                                          |
| 9. Oxygenation            | Response and competing costs                   | PEEP experiment in MV-01 with SpO₂, MAP, pressure, and volume | Oxygen-composition experiment in the passive patient                             |
| 10. CO₂                   | Delivered ventilation and delayed gas response | Increase rate with verified delivery                          | Reduce compliance under pressure control; same rate, smaller breaths, rising CO₂ |
| 11. Systematic read       | Effort, timing, delivery, circuit              | Inspect and clear the authored condensate branch of MV-08     | Change flow in high-demand MV-02                                                 |
| 12. Dyssynchrony          | Localize the mismatch within the breath        | Change pressurization in MV-11                                | Revisit end-inspiratory timing in MV-10                                          |
| 13. Human factors         | Action followed by reassessment                | Assess and establish communication in MV-15                   | Observe the delayed modeled pain intervention                                    |
| 14. Integration           | Similar peak pressures, different mechanisms   | Hold in an undisclosed resistive setup                        | Hold in a stiffer passive setup                                                  |

Earlier concepts return through changed patient/control combinations: flow and volume recur in
mechanics and high-demand breathing; controlled variables recur in the CO₂ transfer; cycling
returns in dyssynchrony; valid pressure measurement returns in the final integration. Optional
question review reuses the retained question bank after completed live experiments: missed or
uncertain predictions generate immediate retrieval; confident correct observations return after
seven days. Reviewed misses return after one day, reviewed confident answers after thirty days.
Those are authored educational intervals, not empirically validated personalized scheduling.

## One consistent interaction

1. **Explore:** a running baseline, a concise observation task, and fully usable controls. Guided
   learners can request a demonstration using those same engine commands. Demonstrations do not
   complete the experiment. Experienced learners can proceed directly.
2. **Predict:** restore a clean baseline and keep its raw tracings visible. Explanatory panels,
   saved comparisons, and rationales are unmounted. Changes to treatment or mechanics are blocked
   by the controller; pause/step and monitoring remain available.
3. **Change:** commit the first prediction, operate the device or teaching sliders, perform actual
   holds/interventions, and allow the response interval to elapse. Observation starts after the
   required action occurs, including the original intervention delay.
4. **Explain:** compare saved measurements and waveforms from the learner's run, review the
   prediction's rationale, and record a brief interpretation. Repeat with the changed setup.

The interpretation is an ungraded reasoning record. A twelve-character minimum prevents an empty
submission; it is not a measure of explanation quality. The prediction feedback describes the
intended relationship; the separate before/after table reports actual observations. Further
exploration can alter the response, so reset permits a controlled repetition. First predictions
remain recorded through that repetition. No experiment is labeled mastered or passed.

The normal-before-abnormal walkthrough is built into the running patient, not a required reading
primer. The course map and reference detail are secondary. This is a deliberate adaptation of
the generic prose-unit template and hub checklist to playbook A and the author's explicit request.
Reduced-motion users start with a paused patient and can explicitly run or step it.
On laptops the monitor and coach have separate scroll areas so a coaching interaction does not
scroll the monitor off screen. Phone layouts stack the surfaces with explicit links between
experiment controls and the monitor. Four native console facsimiles remain selectable.

## Completion, restoration, and original assets

Completion requires two committed predictions, the actual authored actions, elapsed response
intervals, saved before/after measurements and tracings, and two learner interpretations. A
clicked action, paused timer, or written answer alone cannot complete a unit. Wrong predictions
are retained for feedback and later retrieval; completion records participation, not mastery.

New live evidence uses `mechanical-ventilation-live-learning-v1`. Old reading/question progress
is retained and can still inform placement/review, but cannot unlock live completion. On reload,
a bounded event timeline reconstructs the patient and device, paused, while preserving the
observations and first predictions. Local storage failure leaves the in-memory session usable
and displays a saving notice. No account/CME credit is asserted.

The independent final knowledge check remains ten distinct questions: 80% correct with no unsafe
choice. Feedback stays behind commitment of the whole set. All fourteen live units are required;
the placement check only reduces scaffolding. This is a limited knows-how check, not a clinical
credential. Supervised device training and workplace assessment remain necessary.

Preserved: all fifteen original case IDs and case routes; all four device profiles and native
control interfaces; the waveform engine; patient and circuit findings; holds and delayed
interventions; dynamic teaching diagrams; manufacturer/clinical sources; seeded independent
case entry. The new passive `MV-LAB` fixture is excluded from the clinical case registry and its
counts. Its resolver is shared by simulation initialization, reducer operations, and advancement.
No clinical physics algorithm or original case definition was replaced.

## Numeric and clinical provenance

The passive patient's inputs and experiment targets are **authored simulation values**. They are
not treatment recommendations. Its initial oxygenation is consistent with this engine's resting
oxygenation target, avoiding an unrelated baseline drift during the oxygen experiment. All
waveform references and before/after comparisons are samples from the existing engine.

Exact guideline context remains source-scoped: the retained lung-protection reference cites
[AARC patient–ventilator assessment (2024)](https://www.aarc.org/wp-content/uploads/2024/10/patient-ventilator-assessment-aarc-cpg.pdf)
and the [ATS adult ARDS guideline (2024)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10870893/),
checked September 5, 2026. Manufacturer settings retain their existing device-specific source
boundaries. Plateau interpretation uses the existing recent-effort validity window, not an
instantaneously quiet sample. Numeric monitor readouts are retained when interpretation is
withheld. No new drug, dose, procedural choreography, or universal ventilator prescription is added.

The model is a bounded adult teaching system: it is not a validated patient predictor, does not
cover all lung heterogeneity, and does not reproduce all vendor algorithms. Original active-case
blood gases can be evolving at entry. The CO₂ experiment therefore contrasts stable passive
setups; it does not promise that a timing change makes a non-equilibrated original case's CO₂
fall immediately. Clinical/manufacturer sign-off and source reconciliation remain release work.

## Separate rendered review and corrections

| Finding                                                  | Class / severity    | Location and reproduction                                                | Educational harm                                           | Fix                                                                                       |
| -------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Simulator relegated to optional content                  | Alignment / P1      | Previous Learn flow used reading and MCQ screens as its primary activity | Disconnected causal reasoning from the interactive patient | Open directly on a running console; require observed live experiments                     |
| Oxygen example drifted downward despite more oxygen      | Causal / P0         | Advance authored baseline, then change oxygen; compare SpO₂              | False causal impression from a non-equilibrated fixture    | Align the fixture's initial gas state with the model; pin the response direction in tests |
| Active plateau interpreted from a momentary quiet sample | Causal / P0         | Hold in MV-01 and inspect the evidence snapshot                          | A falsely reassuring passive-mechanics inference           | Reuse the existing recent-effort validity window in saved comparisons                     |
| Hidden capstone cause exposed by mechanics sliders       | Leakage / P1        | Inspect pre-commit integration controls                                  | Reveals the authored fault before measurement              | Withhold patient-mechanics controls until comparison in the integration unit              |
| Correct option often longest                             | Cueing / P1         | Run the skill's checker over all 28 predictions                          | Test-taking strategy substitutes for reasoning             | Rewrite parallel, misconception-based alternatives; strict checker now has no findings    |
| Knobs below the monitor                                  | Navigation / P2     | Render at 1280×800 and reach for patient resistance                      | Learner loses sight of the response                        | Put teaching controls beside the compact native monitor; preserve independent scrolling   |
| Delayed action looked unresponsive                       | Causal clarity / P2 | Select MV-15 pain intervention                                           | Confuses selecting an action with its effect               | Display pending latency, then count the observed response interval                        |
| Question-only records unlocked the revised course        | Completion / P1     | Load the previous progress key                                           | Records unperformed live work as complete                  | Separate versioned live evidence and final gate; keep previous answers intact             |

The 28-prediction mechanical cueing audit reports first-option 39%, longest-option 28%, against
33% chance; key positions A/B/C = 11/9/8. No automated P1/P2/P3 findings remain. The rendered
commit-boundary pass also checks live raw signals, accessible descriptions, hidden detail,
control values, titles, and saved snapshots. Demonstrations are intentionally explanatory and
explicitly excluded from completion.

Validation includes real-engine completion of all 28 experiments on all four devices, response
direction checks, active-versus-passive plateau checks, skipped-action/time gates, replay,
malformed saved progress, and optional spaced retrieval. Browser tests cover 1440, 1024, 390,
and 320-pixel layouts, keyboard control changes, an observed hold, both rounds of a unit,
reload with saved evidence, four device consoles, the original practice deep link, final-check
unlock/feedback boundaries, and serious/critical WCAG findings via axe.

Remaining owner decisions concern clinical/manufacturer release review and a learner pilot,
not permission to rebuild this worktree. Pilot with beginners and experienced clinicians:
time to first useful control change; ability to explain a new waveform response; excessive
scrolling or resets; confidence versus first predictions; delayed transfer at one week. Do not
claim educational effectiveness from automated tests or this authoring review.

### Executed checks for this revision

- Ventilation/route regression: 26 suites, 595 tests passed. After the final retrieval and experiment refinements, the two focused live-learning suites passed all 22 tests.
- Playwright: eight complete browser scenarios passed, plus the separate reduced-motion scenario; nine scenarios total. The final knowledge-check path was rerun after correcting its test selector.
- Production build and TypeScript passed. TypeScript was rerun after build-generated types settled.
- Repository lint: zero errors and fifteen existing warnings; changed-file lint passed.
- The skill's strict item-cueing checker passed all 28 live predictions with no findings.

Run the browser checks with `npx playwright test --config playwright.ventilation.config.ts` against
this worktree's port 3110. The retained original lesson/case tests continue to exercise the shared
physiology and device implementation independently of the live-course controller.
