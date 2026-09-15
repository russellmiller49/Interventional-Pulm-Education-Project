# HD-03 — Observation guide: reading an invalid display and finding the next check

**Status: prepared, not run.** No learner or faculty session has taken place. This guide was written on 2026-09-15 by an AI authoring assistant (Claude) for prompt HD-03 of the v2 self-paced action pack. The path it follows was walked in the browser on this branch (see [HD-03 handoff](HD-03-handoff.md), "Genuine browser actions").

## What this observation is for

It checks whether the module's teaching is clear. It does not test the learner. The questions are about the material: can a learner who reads a faulted display understand why it cannot be read, find the explanation when they want it, and find where the next relevant check is taught?

- Normal help is allowed and expected: Hint, Show the labels and explanation, the task list, Back, "What do I do now?", the section outline, the source list, and questions to the observer.
- Nothing is timed, counted, or marked right or wrong. There is no pass standard.
- Notes describe where the module was clear or unclear, not how well a person performed.
- No new tracking is added. The module keeps only its existing self-paced record (sections visited and marked reviewed, and the last location).

## People and consent

- One to three volunteers: fellows, residents, ICU nurses or other clinicians who use hemodynamic monitoring. Any experience level is useful.
- An observer, ideally a hemodynamics faculty member or bedside educator, who can also note clinical wording problems.
- Explain the purpose in the words above and ask for verbal agreement. Record no names. A role (for example "second-year fellow") is optional.
- The participant can stop at any point.

## Setup

- A desktop browser at least 1024 × 700 pixels wide and tall (the Learn stage needs that space), in a fresh browser profile.
- Start at `/en/icu-hemodynamics/learn?activity=waveform-interpretation`. The route is public-unlisted; no sign-in is needed.
- Every tracing in this path is drawn by the module's model. None is a patient recording. The content has not had clinical review (see the [HD-03 claim-review queue](HD-03-claim-review-queue.json)).

## The path

Read the prompt in the right-hand column aloud only if the participant stalls or asks what to do. Otherwise let them explore.

| Moment                                      | Where                                                                                                                                                                | What to watch for                                                                                                                                                                                                                                          | Optional prompt                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1. Arrive at the practice                   | "Tasks in this section · open any task" → "4. Name and compare tracings"                                                                                             | Whether the task list and the practice's own instructions are enough to start.                                                                                                                                                                             | "Open the task that lets you compare tracings."                                      |
| 2. Read a trace                             | "Tracing 6" (unlabelled)                                                                                                                                             | What the participant says they see: shape, pulse pressure, notch, scale. Whether they try to name a chamber.                                                                                                                                               | "Tell me what you see on this display."                                              |
| 3. Ask for an explanation                   | "Hint", or "Show the labels and explanation", or "Sources for this section"                                                                                          | Whether help is easy to find, and whether the participant hesitates to use it. Showing the explanation without answering is a normal choice.                                                                                                               | "Help is part of the module; use whatever you would like."                           |
| 4. Choose not to interpret an invalid value | The reading "Cannot be named from this display" and "Check answer", or saying so aloud                                                                               | Whether the idea that a display can make a chamber or value unreadable comes across. The words the participant uses for it. Whether "Chamber interpretation withheld" is understood.                                                                       | "Is there anything this display lets you say?"                                       |
| 5. Find the next relevant check             | The explanation's "Repair or re-read first", then wherever the participant goes: the section outline ("02 Trust the signal"), a task list, the troubleshooting atlas | Whether the participant can name what to check next (fluid path, then the fast-flush release) and find where it is taught. In "Trust the signal" that is "5. Three dynamic responses" and "8. Read the response". Any other sensible route counts equally. | "What would you check next, and where in this module would you look for it?"         |
| 6. Weigh the sources                        | "Sources for this section" in "Trust the signal"                                                                                                                     | Whether the class labels ("Review article", "Device manual, monitor workflow"), the date lines and "Clinical review of how this module uses it: none recorded yet." are read and understood.                                                               | "Which of these would you rely on for the fast-flush pattern, and what is each one?" |

The locations in moment 5 are where the module teaches the check, not an answer key.

## Notes form

Copy this table for each participant. Write paraphrases, not quotations that could identify anyone.

| Moment | What the participant did or said | Where the material was unclear | Wording or layout suggestion (optional) |
| ------ | -------------------------------- | ------------------------------ | --------------------------------------- |
| 1      |                                  |                                |                                         |
| 2      |                                  |                                |                                         |
| 3      |                                  |                                |                                         |
| 4      |                                  |                                |                                         |
| 5      |                                  |                                |                                         |
| 6      |                                  |                                |                                         |

Session date: \_\_\_\_ · Observer role: \_\_\_\_ · Participant role (optional): \_\_\_\_ · Help the participant asked the observer for: \_\_\_\_

## Short debrief (optional)

1. Was anything on this path unclear or confusing?
2. Did the source labels and dates help you judge what to trust?
3. Did any part feel like a test rather than practice?

## After the session

- Keep notes outside the repository (for example in the owner's Local-Data folder). Do not attach screenshots of participants.
- Turn recurring clarity problems into proposed wording changes. Clinical wording changes go through the claim-review queue and need an attributable reviewer decision before they count as reviewed.
- Known limits to keep in mind: the overdamped repair advice ("before interpreting anything but the mean") depends on an unverified statement that the mean stays relatively preserved (HD-03-02); the withhold rule is authored synthesis awaiting review (HD-03-03).
