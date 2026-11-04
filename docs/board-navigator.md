# IP Board Navigator

Route: `/board-navigator` · Feature: `src/features/board-navigator` · Stage: in development (direct link, noindex)

The Navigator is the first build of the product vision in _IP Board Navigator — Product Vision,
Complete-State Experience_ (3 November 2026). It is the **foundation** phase of that document's
practical path: the blueprint/objective graph, the per-device evidence record, the knowledge map,
reusable activity templates, a rules-first recommendation engine, and a pilot of 24 objectives
across mediastinal staging, pleural disease, airway obstruction and stents, and therapeutic
modalities. It deep-links into the existing modules and board-prep chapters rather than copying
their content.

## The five screens

| Screen        | Route                                   | What it answers                                                                                                                                                                            |
| ------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Today         | `/board-navigator`                      | What should I do now, why this, am I making progress. First visit: goal, optional board date, session length.                                                                              |
| Knowledge map | `/board-navigator/map?objective=`       | Two blueprint domains → topics → objective tiles with a five-state status. A tile opens what to know, the evidence, and the next action.                                                   |
| Repair lab    | `/board-navigator/lab?objective=&mode=` | Diagnose → Explain → Manipulate → Apply to a new case → Close the loop. `mode=review` runs the retention check alone.                                                                      |
| Progress      | `/board-navigator/progress`             | Timeline, sampled vs unassessed topics, review calendar, export and delete.                                                                                                                |
| Curriculum    | `/board-navigator/curriculum`           | Every blueprint topic (including those without pilot objectives), resources, references, the numbers register, and a flag for topics that felt difficult elsewhere (for example in iPASS). |

## Architecture

```
content/
  blueprint.ts        versioned AABIP crosswalk: 2 domains (50.4 / 49.6, 2024), 15 topics, weights null until read
  concepts.ts         cross-cutting concept tags
  sources.ts          source registry; citations must name an id here
  teachingNumbers.ts  numbers register (shared defineTeachingNumbers); copy reads num('…')
  types.ts            LearningObjective, Task kinds, Misconception, RepairStep
  labs/*.ts           the objectives, by pilot area
  objectives.ts       catalogue and lookups
engine/
  record.ts           zod schema for the device record; storage; pure updaters
  status.ts           status derivation rules (see below)
  schedule.ts         spaced review: 3, 7, 14, 30 days (teaching convention)
  recommend.ts        rules-first ranking with a readable rationale per entry
  lab.ts              grading for every task kind; lab stage list; closing summary
components/           the five screens, the task runner, the station schematic
```

### Task kinds

`choice`, `predict` (hold the scenario, change one thing, predict), `sequence` (reorder with
move buttons), `sort` (assign each item to a bucket), `hotspot` (click a region on the station
schematic, with an equivalent text list). Every objective's verification task is a different kind
from its diagnostic task; a test enforces it.

### Status rules (pilot defaults, not validated psychometrics)

- **Not yet assessed**: no observation. Rendered dashed, never as a low mark.
- **Exploring**: some evidence, not enough either way.
- **Needs focus**: the same misconception missed twice, two consecutive misses, or a miss after a
  demonstrated run.
- **Demonstrated**: independent successes on two different task kinds, one of them a verify or
  review task, with the latest observation a success. Schedules the first review.
- **Review due**: demonstrated and the schedule has come round.

Hints are free and recorded; a hinted success is never "independent". Confidence is captured
alongside each commit.

### Recommendation tiers

Confirmed gaps → prerequisites holding back another objective → due reviews → unassessed
(breadth-first across topics, safety-critical first) → exploring. The learner's goal reorders the
tiers (knowledge maintenance puts reviews first; fellowship puts prerequisites first). Each entry
carries its rule and one sentence of rationale, and the learner can always pick something else.

## Honesty boundaries kept

- One boundary statement, in the module frame: a learning navigator, not an assessment; not an
  AABIP product.
- No pass-probability estimate anywhere; the Today screen says so.
- Grading vocabulary (score, grade, mastery, quiz, …) is kept out of learner copy by a test.
  "Demonstrated" is the strongest status word.
- Every clinical number is in the numbers register with class, source, year and locator. All rows
  await the owner's signature: `npm run numbers:signoff -- board-navigator`.
- Review status, reviewer and content version live in `provenance` and are never rendered.
- The record is on the device only, exportable and deletable from the Progress screen.

## Adding an objective

1. Add it to the right `content/labs/*.ts` with a stable id (`area-nn`), a blueprint topic,
   prerequisites, at least two misconceptions, resources that point at existing routes, source ids
   from `sources.ts`, and a lab whose verify task kind differs from its diagnose kind.
2. Any new clinical number goes in `teachingNumbers.ts` first and is read with `num()`.
3. Run `npx jest src/features/board-navigator`. The content-integrity suite checks every rule above.

## Deferred (vision sections not in this build)

- Account-level evidence sync (the record is per device, like the other self-paced modules).
- Faculty / program-director dashboard and the permission model behind it.
- Editorial workflow tooling for proposing, reviewing and publishing objectives.
- Blueprint topic weights (recorded as null until read from the blueprint document).
- Image-based labelling beyond the station schematic; CT/ultrasound stills.
- AI-assisted teach-back or scenario variation.
- Learner problem reports from inside the module.

## Exam-level authoring rules (calibration pass, November 2026)

A review against a 193-item board-style question bank (not reused here) showed the exam tests stacked
constraints, named trials with their numbers, device physics, and both sides of guideline
disagreements. Objectives at content version `2026.12-exam` follow these rules, which the content test
enforces where it can:

- **Stems stack constraints.** A diagnose or verify stem names at least two competing constraints
  (`stemConstraints` on the task): an oxygen limit, an anatomical limit, a timing demand, performance
  status, device availability, comorbidity. The decision is the one they jointly force.
- **Evidence by name.** Every claim that rests on a study carries an `EvidenceCard` (label, year,
  design, population, one-sentence headline with its number) and the number lives in the register.
  Cards render in the Explain step and on the curriculum page.
- **Both positions where bodies differ.** `positions` lists each body's statement with its source; the
  stem says which frame it is asking in.
- **Distractors are documented wrong models**, written generically: delayed modality for an acute
  airway; treat the number not the patient; remove the catheter when it infects; a bigger tube is
  better; on-site evaluation raises yield; a benign-looking node can be skipped; metal in a benign
  airway; size decides the pneumothorax.
- **Fresh scenarios only.** Relative to any question bank, change at least three of age and sex,
  disease, side, numbers, setting, and the decision asked; never reuse an option list.

The full assessment and the phased plan (sessions S1–S6) are in the owner's planning notes for this
module; S1 covered the schema, the pleural and staging objectives, and these rules.
