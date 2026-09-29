# Medical Thoracoscopy — learning contract

## Adoption

The repository's self-paced policy
([`docs/gap-remediation/self-paced/README.md`](../gap-remediation/self-paced/README.md), owner
decision of 2026-09-14) names nine modules. Medical Thoracoscopy is not one of them. This module
**adopts that policy explicitly**, as the revised plan requires (v2 §3.1; corrected assumption 6).
Where this document is silent, the policy applies as written. The
[developer checklist](../gap-remediation/self-paced/developer-checklist.md) is the verification aid.

The target is **"knows how"**. Completing the course, finishing a simulated survey or seeing every
modelled region does not establish procedural competence, and nothing in the course says it does.

## What the learner can always do

- Follow a recommended route, or open any section from a visible outline with meaningful titles.
- Read any explanation before answering anything.
- Try an optional prediction, reveal, try again, or leave it.
- Continue, skip, go back, repeat, or leave, whatever they answered or did not answer.
- Finish a section without performing the modelled procedure.

Nothing is locked behind a correct answer. There is no pretest, timer, score, percentage correct,
passing standard, mastery badge, streak or rank, and no recommendation depends on correctness.
Numbers that are clinical or physical stay: device dimensions, trial results, simulated time.

## Three different actions

The interface keeps these visibly apart, and the code keeps them apart by type.

| Action                         | What it changes                                  | What it never does                                                             |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| **Continue or skip**           | Where the learner is in the course               | Create a prediction, an observation, a survey, a sample or any procedure event |
| **Load a teaching example**    | Starts an authored state, labelled as an example | Claim the learner performed the steps that would lead to it                    |
| **Perform a simulated action** | The scenario, through the one command path       | Happen as a side effect of navigation                                          |

A visited section is not a completed procedure. A loaded example is not the learner's own
observation. Recovering from an error or reloading never reports a survey or a sample as done.

## Unsafe actions

> Unsafe actions must not be endorsed, conceal their risks, or generate fabricated procedural
> success. Their modeled consequences must remain clinically reviewed and causally plausible. A
> favorable immediate observation does not establish that the action was appropriate or safe.

This is the revised plan's rule (v2 §1.3) and a proposed change to the teaching contract. Until a
consequence has a reviewed claim behind it, the simulation says the consequence is **not
modeled** and explains the risk at once. It does not invent a punishment and it does not invent
reassurance. A movement the model refuses is a limit of the model, and is described that way. It
is never presented as protection the real device provides.

## What each section contains

Objective, suggested background, one primary concept, a worked example, an optional activity, a
transfer example, the model's limits, and claim references. Suggested background is a suggestion:
it never locks navigation. Misconceptions are recorded when they are real ones. There is no quota.

Titles name the presentation and never the answer. An optional prediction may hold back its own
case-specific interpretation until the learner asks for it. It may not hold back foundational
teaching, chapter titles or other lessons.

## What is stored

One module-local record, under `ip-medical-thoracoscopy-self-paced-v1`, written by one adapter:

- where the learner is,
- which sections they have visited,
- which sections they have chosen to mark reviewed.

Nothing else. No answers, attempts, help use, timings or simulator state. If storage is blocked or
the saved value cannot be read, the course still works, says plainly that it cannot save, and
leaves the unreadable value untouched. The legacy record `ip-pleural-module-progress-v1` is never
read, written or migrated by this module.

There is no new backend, no learner telemetry and no sponsor tracking.

## Sections that are not written yet

The outline lists all nineteen sections by title from the first day. A section that is not written
is marked "In preparation", is not a link, cannot be marked reviewed and is never recorded as
visited. Continue resolves only to a written section.

## Language

The course launches in English. On Spanish and Simplified Chinese routes the teaching content is
English, marked as English for assistive technology, under a notice that says so.

## Learner-facing words

- `/assess` is labelled **Cases**.
- The survey ledger describes **model-estimated visible regions**. It has three states for what
  has been seen and three reasons for what has not, and no number. Seeing every region is not
  described as an adequate examination.
- Learner copy passes the repository's copy check. Clinical phrasing that trips it is reworded
  first and exempted by name only where no rewording exists.
