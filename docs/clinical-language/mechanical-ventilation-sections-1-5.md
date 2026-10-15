# Mechanical ventilation, Learn sections 1–5 — clinical language pass

Status: validated (needs physician subject-matter review of the reworded items)

This file is public. It quotes the module's own copy and gives no transcript text.

## Scope

- Module and route: `mechanical-ventilation`, `/mechanical-ventilation/learn?activity=` for
  `breathing-with-support`, `waveform-anatomy`, `controls-and-goals`,
  `mechanics-load-and-pressure` and `modes-and-breath-delivery`.
- Canonical copy files: `content/learningExperiments.ts` (the rounds those sections load),
  `content/sectionSpecs.ts` (first-task instructions, Section 1 deny patterns),
  `content/stageLessons.ts` (generated step rationales and maneuver notes used by these sections),
  `content/foundations.ts` (Section 1 worked reading), `content/learningCurriculum.ts` (Section 1
  checklist), `content/learnerMap.ts` (section time line), `components/MechanicalVentilationHub.tsx`
  ("How this module works"), `components/VentilationReinforcement.tsx` (question eyebrow).
- Mode: implement, as slice 4 of the October 2026 plan
  (`docs/critical-care/mv-hemodynamics-ecmo-format-2026-10.md`). Sections 6–14 keep their copy for
  a later pass.
- Audience: physicians and fellows. Not localized (English fallback on es and zh-CN).
- Profile: `mechanical-ventilation`. No transcripts were opened; the profile's terminology was
  enough for E0/E1 work.

## Coverage

| Surface (Sections 1–5)                    | Located | Reviewed | Changed | Retained | E2 hold | Unreviewed |
| ----------------------------------------- | ------: | -------: | ------: | -------: | ------: | ---------: |
| Round titles (shown on explanation steps) |      10 |       10 |       4 |        6 |       0 |          0 |
| Round introductions                       |      10 |       10 |      10 |        0 |       0 |          0 |
| Round look lines                          |      10 |       10 |      10 |        0 |       0 |          0 |
| Round prompts                             |      10 |       10 |       8 |        2 |       0 |          0 |
| Round tasks                               |      10 |       10 |      10 |        0 |       0 |          0 |
| Round explanations                        |      10 |       10 |      10 |        0 |       0 |          0 |
| Round rationales                          |      30 |       30 |      24 |        6 |       0 |          0 |
| Round choices                             |      30 |       30 |       0 |       30 |       0 |          0 |
| Round hints                               |      10 |       10 |       0 |       10 |       0 |          0 |
| First-task instructions (section specs)   |       5 |        5 |       5 |        0 |       0 |          0 |
| Section 1 task titles (new list)          |       8 |        8 |       6 |        2 |       0 |          0 |

Counts are strings, measured by diffing the round registry before and after the pass. No key,
choice, goal, interval, watched reading or clinical number changed; the only digits added are two
"Section 4" cross-references.

**Shared templates.** Four round templates are reused by later sections, so the reworded look,
task, prompt and rationale lines also appear where those sections inherit them: Section 10 part 2
(`stiffPressure`), Section 11 part 2 (`flow`, whose prompt must equal Section 2's for its revisit
label) and Section 14 (`resistance`). Each inherited line is the same E1 wording; nothing a later
section overrides was touched.

## Changes

Representative pairs; every changed string is in the diff of `learningExperiments.ts`,
`sectionSpecs.ts` and `stageLessons.ts` on this slice.

| Location                      | Before                                                                                                                                                                                                                                           | After                                                                                                                                                                                                                                       | Class | Why the meaning is preserved                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------- |
| S1 round 1 task               | Try Pause and Run on the live display. You can either pause during outward flow after a full breath, or inspect expiration on the captured complete breath and choose Use this captured interval. The captured alternative needs no timed click. | Press Run, then Pause while gas is flowing out. Or, on the frozen breath, move the cursor into expiration and choose Use this captured interval.                                                                                            | E0    | Same two ways to meet the goal; the builder sentence is dropped.                                                             |
| S1 round 1 rationale (key)    | Interval A lies after inspiratory delivery: flow there is negative and breath-relative volume is coming down.                                                                                                                                    | Interval A falls after inspiratory flow has ended: flow is below zero and the volume above baseline is falling.                                                                                                                             | E1    | Same observation; "breath-relative volume" becomes "volume above baseline", as the plan asked.                               |
| S1 round 1 explanation        | Identifying the phase is a separate answer from operating a playback control. At interval A gas is leaving and the breath-relative volume trace is coming down…                                                                                  | At interval A gas is leaving the lungs: flow is below zero and volume is falling back toward its starting level. That pattern, not the moment you pressed Pause, identifies expiration in a passive breath.                                 | E1    | Same finding and the same separation of reading from timing a Pause.                                                         |
| S2 round 1 prompt             | If flow rises while the tidal-volume target stays fixed, what should happen?                                                                                                                                                                     | If inspiratory flow rises and the set tidal volume stays the same, what happens?                                                                                                                                                            | E1    | Same construct; "target" becomes "set", the console's word.                                                                  |
| S3 round 1 look               | Distinguish the selected volume from the measured exhaled volume and the pressure needed to deliver it.                                                                                                                                          | Find the set tidal volume, the exhaled volume the ventilator reports, and the peak pressure it took to deliver the breath.                                                                                                                  | E1    | Same three values; reworded so the keyed option's own phrase is not printed above the question.                              |
| S3 round 2 prompt             | What does an increase in the oxygen control directly change?                                                                                                                                                                                     | What does raising the set oxygen fraction (FiO₂) change directly?                                                                                                                                                                           | E1    | The control is the oxygen fraction; FiO₂ is its clinical name.                                                               |
| S4 round 1 introduction       | The muscles are quiet. Compare flowing pressure with the pressure during an actual occlusion.                                                                                                                                                    | This patient is passive: no respiratory effort. Compare airway pressure while gas is flowing with the pressure during an inspiratory hold.                                                                                                  | E1    | Same patient state and comparison; "occlusion" named as the maneuver the console performs.                                   |
| S4 round 1 explanation        | Use the actual hold, together with the effort signal. Separating resistance from elastic load requires a valid passive measurement.                                                                                                              | Peak minus plateau is the pressure spent on airway resistance, and it widens when resistance rises. Splitting resistive from elastic pressure needs a valid hold in a passive patient: check the effort trace before you trust the plateau. | E1    | The first sentence restates the keyed rationale already in the round; the validity condition is unchanged. Post-commit only. |
| S5 round 2 introduction       | The mode has explicitly switched from conventional VC to conventional PC. The same passive baseline patient now receives fixed pressure above PEEP and fixed inspiratory time.                                                                   | The mode is now pressure control (PC). The same passive patient receives a set pressure above PEEP for a set inspiratory time.                                                                                                              | E1    | Same mode, patient, and fixed inputs.                                                                                        |
| Predict-step rationale (S1–5) | Apply the concept you just studied. Your first answer is retained, and a wrong prediction can be corrected by observing the actual response.                                                                                                     | Committing to an answer before you watch is what turns watching into learning: the response then confirms or corrects something you actually thought.                                                                                       | E0    | Same purpose; drops "wrong" from learner copy.                                                                               |
| Time line                     | About 5 minutes to read. The optional parts here have no timed run.                                                                                                                                                                              | About 5 minutes                                                                                                                                                                                                                             | E0    | The estimate is unchanged; the caveats are dropped (all 14 sections share this line).                                        |

## Terminology decisions

| Context                   | Preferred term                                        | Accepted aliases | Rejected replacement                    | Basis                                   | Draft or owner-approved |
| ------------------------- | ----------------------------------------------------- | ---------------- | --------------------------------------- | --------------------------------------- | ----------------------- |
| Volume trace in Section 1 | volume above baseline (once), then volume             | —                | breath-relative volume                  | Owner plan, C4                          | Owner-approved (plan)   |
| What the learner selects  | set (set tidal volume, set rate)                      | selected         | target, request                         | Profile: set versus measured            | Draft                   |
| Oxygen control            | FiO₂ / oxygen fraction                                | oxygen           | the oxygen control                      | Profile                                 | Draft                   |
| Frozen display            | the frozen breath, held still on the console          | —                | captured breath below, Experiment panel | New surface (slice 3)                   | Draft                   |
| Teaching-patient sliders  | the teaching patient’s compliance / airway resistance | —                | patient properties                      | Not a ventilator setting on any console | Draft                   |

## Gate collisions and overrides

None. "wrong" was removed from one generated rationale; no gate was changed.

## Clinical-review queue (E2)

| Ticket | Existing text and location                                                                                                               | Concern                                                                         | What needs review                                           | Action taken                                                 |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------ |
| MV-L1  | S3 round 2 rationale: "the patient’s response develops over time" (was "evolves with simulated time")                                    | Time course of SpO₂ after an FiO₂ change is not stated in minutes, deliberately | Whether to state a typical equilibration time with a source | Left unstated                                                |
| MV-L2  | Section titles that hint at their answer in the task list ("Separate oxygen from breath delivery", "Find the pressure spent moving gas") | Every task title is visible before the questions in Sections 3 and 4            | Whether to neutralize those titles as Section 1's were      | Not changed (titles are sections 2–5 structure, not wording) |

## Protected contracts

- Numbers, units, thresholds: unchanged (diffed by hand; no digit changed in any round).
- Choices, keys, choice order, ids: unchanged. Key-length balance therefore unchanged.
- Deny patterns: Section 1 gained the marker-sentence patterns; Section 3's look line was reworded
  so it no longer prints the keyed option's phrase. `stage-lessons.test.ts` (static scan) and
  `stage-lessons.rendered.test.tsx` (rendered scan, proved to fail when the marker evidence is
  shown before the commit) pass.
- Reviewed items: every round item remains `reviewStatus: 'draft'` (`stageItems.ts`).

## Validation

| Command or check                                                                                                    | Baseline                      | After                         |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------- |
| `npx jest src/features/mechanical-ventilation 'src/app/[locale]/mechanical-ventilation' src/features/critical-care` | 79 suites green after slice 3 | 79 suites, 1,811 tests green  |
| `tsc --noEmit`                                                                                                      | clean                         | clean                         |
| ESLint and Prettier on changed files                                                                                | clean                         | clean                         |
| Rendered: Section 1 tasks 1–4 at 1366×768, English                                                                  | —                             | inspected in the browser pane |

## Handoff

- Reworded items awaiting review: all changed round strings in Sections 1–5.
- Open E2 tickets: MV-L1, MV-L2.
- Remaining surfaces: Sections 6–14 (the same pass), the Practice and Applications copy.
- PR: not opened.
