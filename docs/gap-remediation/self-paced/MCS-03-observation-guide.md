# MCS-03 — observation guide for three self-paced device paths

**Status: prepared, not run with learners.** No participant, session or result exists. The
technical walk recorded in the [MCS-03 handoff](MCS-03-handoff.md) is an assistant's browser check,
not an observed session. Nothing here scores a learner, times a task or records who needed help.

## Purpose

Watch whether a clinician-learner can, in each device family:

1. **find the right explanation** for a device reading;
2. **use a relevant control** and read what it changed in the model;
3. **recover from confusion** — a tempting answer, a surprising model response — using feedback,
   Hint, Show explanation or Try again; and
4. **return later** and pick up where they were, without earlier answers replayed.

Help, explanations and skipping are normal use, not failure. Record what was confusing or useful,
in the learner's words where possible.

## Before the session

- Use a current build of branch `claude/mcs-03` or later. The module is an unlisted preview.
- Open each link fresh (a new browser profile or cleared site data), so no earlier location is
  restored.
- Tell the learner: these are optional teaching activities; the numbers are this teaching model's
  outputs, not patient data or targets; nothing is graded or saved beyond where they were.
- A device or MCS educator should be present or available afterwards for the content questions the
  claim queue raises. The observer does not decide those.

## Path A — intra-aortic balloon pump: a trigger in atrial fibrillation

Start: `/en/mechanical-circulatory-support/learn?lesson=iabp-timing-triggering&phase=transfer`
(section 3, “Is the balloon inflating at the right moment?”, task “The same balloon in atrial
fibrillation”).

| Step                   | Invite the learner to…                                                                                           | Watch for                                                                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Find the explanation   | Read the question, then use **Show explanation** before choosing anything.                                       | Do they find it without answering? Does the explanation make clear that trigger choice is judged on the arterial trace, beat by beat?                                        |
| Recover from confusion | Choose whichever option they would pick at the bedside, then **Compare answer**; use **Try again** if they wish. | If they keep ECG triggering, do they understand “Partly correct” as a missing check rather than a wrong choice? Is the Cardiosave reference legible?                         |
| Use a relevant control | Open **Explore all supported controls**, change **Trigger source**, and read timing synchrony and alarms.        | Do they notice the exercise text saying the synchrony figure is this model's output only, and that it favors pressure triggering against the supplied manufacturer material? |
| Return later           | Choose **Save & exit**, then open the section again from the module page.                                        | Does it reopen at the same place with no answer selected? Is that expected or confusing?                                                                                     |

Content questions for the educator: claim queue items MCS-03-05 (trigger model versus source) and
the learner's reading of the IABP-02 and CAP-IABP-01 worked explanations.

## Path B — microaxial support: a suction alarm at high support

Start: `/en/mechanical-circulatory-support/learn?lesson=impella-suction-purge-rv&phase=transfer`
(section 6, “A suction alarm at high support”).

| Step                   | Invite the learner to…                                                                                                    | Watch for                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Find the explanation   | Use **Hint**, then **Show explanation**, before answering.                                                                | Is the first step (reduce the level) distinguishable from the whole response (volume, position on imaging, right ventricular function)?                                  |
| Recover from confusion | Answer, **Compare answer**, and read why escalating through suction or treating it as a purge problem does not fit.       | Does the feedback explain the mechanism, or only announce the answer?                                                                                                    |
| Use a relevant control | Lower the left-pump performance level one or two steps; then, separately, restore filling (preload) in the full controls. | Do they expect the suction alarm to clear after a small reduction? The model keeps it until filling returns — is that surprising, and does the explanation prepare them? |
| Return later           | Leave and reopen the section.                                                                                             | Location restored; no answer or control change replayed.                                                                                                                 |

Content questions: MCS-03-06 (suction response), and MCS-03-01, -03 and -04 if the learner opens
the pathway cards or the Impella variant preview and asks about the flow figures.

## Path C — durable LVAD: an alarm at an unchanged speed

Start: `/en/mechanical-circulatory-support/learn?lesson=lvad-alarms-emergencies&phase=transfer`
(section 8, “An alarm at an unchanged speed”).

| Step                   | Invite the learner to…                                                                                    | Watch for                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Find the explanation   | Read the stem and context; use **Show explanation**.                                                      | Is it clear that the flow display barely moves and that this does not reassure? Is “this model does not diagnose” understood? |
| Recover from confusion | Answer and **Compare answer**; if they chose to disconnect power or rely on the controller, read why not. | Is the safety explanation immediate and specific, without sounding like a penalty?                                            |
| Use a relevant control | In the full controls, switch the high-power pattern on and off and compare power with displayed flow.     | Do they read power and flow together? Do they try to change speed, and do they understand the simulated authorization step?   |
| Return later           | Leave and reopen the section.                                                                             | Location restored; the high-power pattern is not left switched on from the earlier visit.                                     |

Content questions: MCS-03-08 (high-power transfer wording and the pathway card's thrombosis
sentence) and MCS-03-09 (speed bounds, labeling revision, power-path notices).

## Blank observation record

Copy per learner. Do not record names, scores, times to answer or whether help was used as a
measure.

| Path | Step | What the learner did or said | Confusion or usefulness noted | Content question raised (queue item) |
| ---- | ---- | ---------------------------- | ----------------------------- | ------------------------------------ |
| A    |      |                              |                               |                                      |
| B    |      |                              |                               |                                      |
| C    |      |                              |                               |                                      |

Session date: \_\_\_\_ Observer role: \_\_\_\_ Educator present (role): \_\_\_\_ Build or commit:
\_\_\_\_
