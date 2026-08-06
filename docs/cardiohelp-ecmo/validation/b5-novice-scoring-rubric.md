# B5 novice think-aloud — outcome and failure classification

This rubric classifies **what happened during a task** and **what kind of problem it points at**. It
does not score people. There is no total, no pass mark, and no aggregate that means anything about a
participant.

The word "success" below means _the module worked_, not _the participant is competent_. Never report
a participant's outcomes as an assessment of them, and never describe any outcome here as
competency, mastery, sign-off, or bedside readiness.

---

## 1. Task outcome codes

Assign exactly one per task, using the **first** code that applies reading top to bottom.

| Code   | Outcome                          | Definition                                                                                                                                                                      |
| ------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O1** | Independent success              | Reached the intended reading using only what is on screen. No prompt beyond standard think-aloud nudges, no in-module help.                                                     |
| **O2** | Success after a neutral prompt   | Reached it, but only after a standardized prompt ("what are you looking at?", "is there anything you haven't looked at?"). The content was there; attention did not land on it. |
| **O3** | Success after interface help     | Reached it only after using the module's own help affordance, or after the facilitator answered a _mechanical_ question. Points at discoverability, not understanding.          |
| **O4** | Conceptual error with recovery   | Stated a wrong reading, then corrected it themselves — from a live response, re-reading, or the verdict. Record what triggered the recovery; that is the module working.        |
| **O5** | Unresolved conceptual error      | Ended the task holding a wrong reading, uncorrected at the time.                                                                                                                |
| **O6** | Safety-critical misunderstanding | Ended the task holding a belief that would be unsafe at a bedside. **Always also record in the observation form's critical-misunderstanding field, and correct at debrief.**    |
| **O7** | Not attempted                    | Task skipped for time, fatigue, or a stop. Not a result about the module.                                                                                                       |

O4 is a good outcome for a teaching module and should not be read as a failure. O5 and O6 always
generate a finding.

## 2. Failure classification

For every O2–O6, assign at least one class. More than one may apply; record all.

| Code   | Class                         | It means                                                                                                                                                                                                      | Typical owner    |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **F1** | Usability failure             | The information was present and correct, but could not be found, reached, or operated. Layout, tab order, focus, discoverability, scroll, viewport.                                                           | UI               |
| **F2** | Curriculum sequencing failure | The information was findable but arrived in the wrong order — the learner needed something a later step teaches, or the drill assumed a foundation not yet laid.                                              | Content ordering |
| **F3** | Copy failure                  | The words were present and in the right place but were ambiguous, contradictory, too dense, or misread in a way most participants share.                                                                      | Content          |
| **F4** | Simulator-model failure       | The live response contradicted the teaching, or the model did something the panel does not account for. **This is the only class that may justify an engine change, and only with a reproducing test.**       | Engine           |
| **F5** | Learner knowledge gap         | The participant lacked a prerequisite the module never claimed to teach and reasonably does not owe them. **Not a defect.** Record it to explain the outcome and to check the recruitment category was right. |
| **F6** | Model-boundary misread        | The learner read "this simulation does not model X" as "X does not matter clinically". A specific and expected failure mode for this module; always record separately.                                        | Content          |

**F5 is the one class that produces no remediation.** Be strict with it: a gap most of the target
audience would share is usually F2, not F5.

## 3. Severity

| Code   | Severity | Definition                                                                                                                         |
| ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **S1** | Critical | A learner could leave believing something unsafe, or the task cannot be completed at all. Blocks further sessions until addressed. |
| **S2** | Major    | The intended learning of that drill did not land, or a whole surface was unreachable for some input method.                        |
| **S3** | Moderate | Reached the reading, but slowly, with avoidable confusion or a wrong turn most participants would take.                            |
| **S4** | Minor    | Noticed, recoverable, low cost — wording, polish, a single participant's preference.                                               |

Any **O6** is at least S1. Any **F6** is at least S2 — a boundary misread is the failure mode this
module is most exposed to, because it teaches with an explicitly bounded simulation.

## 4. Reading results honestly

- **Never aggregate into a percentage.** With four to six participants, "67% succeeded" is noise
  wearing a number.
- Report as counts with the denominator: "3 of 5 reached it unaided; 1 needed a prompt; 1 did not."
- A single **O6** matters more than five **O1**s. Do not average it away.
- Two participants failing the same way is a pattern; one is a lead.
- Distinguish _what was observed_ from _why you think it happened_. The observation form holds the
  first; the root-cause column of the findings file holds the second, and it is a hypothesis until a
  change fixes it.

## 5. What this rubric cannot classify

It cannot tell you whether the clinical content is **correct** — novices cannot falsify that, and it
needs review by an ECMO clinician against the sources. It says nothing about the fourteen drills
with no live panel, about Practice, or about Assess. And no combination of codes here amounts to a
statement that the module has been validated: that requires findings actually written up in
[`b5-novice-findings-template.md`](./b5-novice-findings-template.md).
