# BF-03 — Bronchoscopy Foundations short usability session: plan

**Status: PREPARED, NOT RUN.** No learner or facilitator session has taken place. No participant, quotation, observation or result exists. The owner recruits participants and runs the sessions with appropriate permissions.

Module: Bronchoscopy Foundations, `/<locale>/bronchoscopy-foundations` (unlisted preview, direct link), as converted to self-paced learning in [BF-01](../self-paced/BF-01-handoff.md), with the larynx view repair of [BF-02](../self-paced/BF-02-handoff.md) and the BF-03 changes. Forms: [observation form](BF-03-observation-form.md) and [issue and retest form](BF-03-issue-retest-form.md). Handoff: [BF-03 handoff](../self-paced/BF-03-handoff.md). Release evidence: [release review packet](BF-03-release-review-packet.md).

## What this is, and is not

A short usability and teaching pilot: watch a few intended learners use one control demonstration and one deterioration learning case the way they normally would, and record where the instruction, the image or controls, or the navigation confuse them and what helps.

It is **not** an examination, a skills station, an OSCE, a physical-skill sign-off, a readiness judgment, a validated sample, a research protocol or a clinical review. Nothing about a participant is scored, and how a learner moves the simulated scope is not rated. There is no hidden test: the learner is told what the session is for, every section and case is open, and help is part of the product. Supervised procedural readiness remains outside this self-paced product; a faculty-observed skills evaluation belongs to the deferred fellowship-course work and is not prepared here. If the owner later wants generalizable or publishable findings, a research protocol with its own review is a separate future choice.

The module's earlier walkthrough in the [faculty packet](../../bronchoscopy-foundations/faculty-review-packet.md#suggested-review-walkthrough) is a content-review route for faculty. This plan is for learners and drops that walkthrough's examination-era steps.

## Who

- **Learners:** approximately three to five intended learners: early pulmonary or critical-care fellows, or other clinicians new to flexible bronchoscopy, the module's stated audience ("general clinical knowledge is assumed; prior bronchoscopy experience is not"). A small, convenient group is fine; it is not a sample.
- **Facilitator:** the owner or a delegate. One facilitator per session is enough.
- **Optional second observer:** a bronchoscopist who notes wording that does not match bedside practice, on the same forms. Their notes are about the module, not the learner.

Participation is voluntary. A participant can stop at any time, and stopping is not recorded as anything.

## Build and environment

Do before each session. This is a facilitator check of the build, not a learner observation, and it goes in the "version and device context" block, not the observations.

1. Record the commit SHA or deployment label. Use the same build for all sessions in a round where possible; a repair between sessions starts a new round.
2. Use an environment with the site's normal configuration. A local development server without the site's Supabase settings still serves the Foundations pages, but site-wide services (for example the usage endpoint) report errors in the console.
3. Open a **fresh browser profile or private window, signed out.** Foundations is a direct-link module that needs no account, and its own progress starts empty.
4. Use a laptop or desktop with a mouse or trackpad for the scope controls. Optionally run one session on a tablet or phone to see the compact layout, and record the device. Note whether the 3D view loaded; if WebGL is unavailable the module shows a text-and-diagram fallback, which is itself worth observing.
5. Open `/en/bronchoscopy-foundations/learn?section=five-controls` and `/en/bronchoscopy-foundations/learn?section=deterioration`, and confirm that the first step loads, "Continue" works, and on the scenario step "Show the reasoning" and "Continue without completing" are present. If any of these fails, fix or reschedule; do not run the session on a broken build.
6. After the session, close the private window or clear the profile's site data, so the next participant starts fresh.

## Suggested path

About 30 minutes. That is a planning estimate for booking, not a time limit, and time is not recorded. The order is a suggestion. The learner may take the stops in any order, spend longer on one, skip a step, jump elsewhere through the Overview outline, or stop early. Prerequisites listed for a section suggest an order and never lock it.

| Stop                    | Teaching purpose                                                      | Where                                                                                                    | What it contains in this build                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Entry                 | Finding a start                                                       | Overview, `/en/bronchoscopy-foundations`                                                                 | Start door, the 23-section outline, "Practice short cases", "Integrated cases", "Reference, sources and model limits", and the statements about what the device keeps and what online learning does not establish                                                                                                                                                                                                                                                                                                             |
| 1 Control demonstration | See what one control does to the tip and the image, then try it       | Learn: "The five controls at the scope", `learn?section=five-controls`                                   | "Meet the bronchoscope", then paired steps for depth, deflection and rotation: a demonstration ("Try with guidance", labelled as the example, not the learner's own attempt) and a repeat without the cue; "Aim at a visible target"; an optional check "Explain what rotation changes"; suction; "Try a changed target". Suggest the learner takes the depth and rotation pairs and the optional check; the rest is optional                                                                                                 |
| 2 Deterioration case    | Recognize a change in the patient's state and work through priorities | Learn: "When the patient’s state changes during an inspection", `learn?section=deterioration`            | Two teaching steps ("Establish the patient’s baseline", "Work through a change in breathing"), then the scenario "Now respond to the changing patient": four observations with monitor readings, a decision at each, "Show the reasoning" for the current observation, immediate explanation of an unsafe choice. The case moves to the next observation only on the supported decision; the learner can leave it with "Continue without completing". Then an optional check, "Review the reasoning" and an optional transfer |
| 3 Safety case, optional | See the same priorities in a situation that draws on several sections | Integrated case "Midway through a lavage under sedation", `/en/bronchoscopy-foundations/assess#case-C05` | A case marked safety-critical as teaching, with "Show the explanation" before answering, "Check my answer", "Try again", immediate unsafe-choice feedback and "Review this concept" back to the deterioration section                                                                                                                                                                                                                                                                                                         |

Prefix Learn addresses with `/en/bronchoscopy-foundations/`. The path covers what BF-03 asks for: a control demonstration and a deterioration/safety learning case. Choosing these stops is a usability decision, not a review of their clinical content. Every item remains `draft`; the deterioration items are part of the BF-03 question batch whose dispositions are proposals pending bronchoscopy faculty (see the [question ledger](../self-paced/BF-03-question-ledger.md)).

### Help that exists in this build

Tell learners about what is really there:

- **Watch the example** and **Try with guidance** on the five-controls parts (for example "Part 2 of 7 · Depth"): the demonstration is labelled as the example, not the learner's attempt; **Reset the scope** starts the model again
- **Show me where** on scope steps in the other scope sections (it highlights the control to use); it was not seen on the five-controls depth part
- **Show the explanation** on questions and cases, before or after answering; **Check this answer**, then **Try this check again**
- **Show the reasoning** on the scenario, for the current observation, without moving the case on
- **Continue without answering / checking / completing** (on the last step, **Finish without …**), **Back** and **Review the teaching**
- In the section header: **What do I do now?**, **Sections** (the outline), **Restart section** and **Save & exit**
- The **Overview outline**, **Review later** on each section, and **Mark as reviewed** (with **Undo**) at the end of a section

The build check in the [BF-03 handoff](../self-paced/BF-03-handoff.md#genuine-browser-actions) records which of these were seen on the stops above. If a learner looks for a hint button, a pause button on the scope, or a way to replay the demonstration, write that down as an observation.

## Facilitator script

### Before starting

1. Explain the purpose in one or two sentences: feedback on the module, not a test of the learner.
2. Agree the permission arrangement. **No audio, video or screen recording by default.** If a recording is separately agreed, write the arrangement on the form, and keep the recording outside Git with the completed forms.
3. Offer an optional pseudonymous code (for example `BF03-A`). Do not write the learner's name, email, employer or trainee ID on any form. If the owner needs to link a code to a person to arrange a retest, keep that key separately from the forms, or do not keep one.
4. Read the invitation on the observation form aloud:

   > Use the module as you normally would. Read, watch a demonstration, use "Show me where" or "Try with guidance", open an explanation before answering, try something again, skip a step, or jump to another section whenever that is useful to you. This is feedback on the module, not a test of you, and nothing you choose is scored or saved as an answer. Please say what you are thinking or looking for when it is convenient. You can stop at any time.

5. Mention that the module keeps only where they were, which sections they opened and any sections they mark reviewed or to review later, on this browser, and nothing about their answers or their scope movements.

### During the session

- Do not ask the learner to work alone or avoid help, and do not hold back teaching to find out what they already know.
- Neutral prompts are enough: "What are you looking for?", "What do you think this is asking you to do?", "What did you expect the view to do?"
- If the learner asks how the interface or a control works, answer it and note the help as context for the interface. If they ask about clinical content, point first to what the module itself offers (explanation, reasoning, the linked section), then answer if they still want it. Note it the same way. Neither is a deficit.
- Write down what they chose to do and where they hesitated, not how well they did it. Do not note correctness, attempts, time to a goal, how steadily they moved the scope, or how much help they used.
- If a technical or 3D-view problem stops them, note it, help them recover (reload, the fallback, or move on), and continue.
- If a learner mentions a real patient, do not write down details; note only that a clinical example came up.

### Closing questions

Ask briefly, and accept "nothing" as an answer:

1. In the control steps, was it clear what to do and what the view was showing you? What helped?
2. In the deterioration case, which explanation or reading helped you make sense of the change? Was anything confusing after you had read it?
3. Which question, if any, helped you understand something? Which one got in the way?
4. Was there a moment you did not know what to do next, or how to leave a step?
5. What would you change first?

## What to observe

The forms carry the full prompts. In short, for each stop:

- what the learner thought the activity was for
- where the instruction, the image or 3D view, a control, or navigation was unclear
- whether a demonstration was understood as an example rather than their own attempt
- whether each question added value or friction
- which explanation, reading or comparison helped them make sense of it, and what help, retry or skip they chose
- how they recovered from a technical or conceptual difficulty
- any facilitator help, as context for the interface

Across the session: finding a start, jumping and returning, leaving and resuming (for example a reload, which restarts the section's steps), and what they understood the device to keep and the course not to establish.

Keep observed fact, facilitator interpretation and proposed change in separate columns. **Do not calculate** percent correct, first-attempt results, time on task, time to goal, help counts, a handling rating or readiness. Do not produce success rates across participants.

## After the sessions

1. Within a day of each session, tidy the observation form while memory is fresh. Leave empty fields empty.
2. Open an issue on the [issue and retest form](BF-03-issue-retest-form.md) only for something actually observed. An issue describes the module, never the learner.
3. When a round is finished, the owner chooses which issues a later Foundations slice addresses. Issues about clinical, anatomical, source or media-rights content stay pending attributable review; they are not repaired by wording alone, and a known misleading safety or anatomical explanation is corrected or excluded rather than disclaimed.
4. After a repair, retest with a real session on the new build and record what was observed. The retest is one person on one build, not a validation.

## Where completed forms live

Completed observation and issue forms, and any separately agreed recording, stay **outside Git** in a private location the owner chooses. A suggested place is a new `usability-observations/bronchoscopy-foundations/` folder in `Interventional-Pulm-Local-Data`; BF-03 does not create it, and adding it means updating the [Local-Data map](../../local-authoring-assets.md) under that folder's rules. Only de-identified issue summaries that a later slice acts on should enter the repository, without session codes where they are not needed.

## Existing facilities, and why the session does not use them

| Facility                                                                                                                           | What it does                                                                                                                                                   | Use in BF-03                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Foundations self-paced progress (`ip-bronchoscopy-foundations-self-paced-v1`, this browser only)                                   | Last section, sections opened, marked reviewed and marked to review later, and a lower-airway survey only when the learner met its goals on their own controls | Used as the module normally uses it, so resume can be observed. Not exported or collected; cleared with the private window |
| The earlier Foundations record (`ip-bronchoscopy-foundations-v1`)                                                                  | Examination-era completions, first answers, performance summaries and a survey; read-only                                                                      | Not created on a fresh profile and not used by the module                                                                  |
| Module beta feedback (`/development-beta/bronchoscopy-foundations`; the module is listed in `src/features/module-beta/catalog.ts`) | The site's beta-testing frame, which is tied to a signed-in account (see the PI-02 plan for how it stores the tester's email and comment)                      | **Not the session record**: it is not pseudonymous. A learner who already uses it can keep doing so outside the session    |
| Site usage tracker (`/api/analytics`)                                                                                              | Pre-existing site service; the route answers 401 without a signed-in user, so a signed-out session stores nothing there                                        | Not used. BF-03 adds no event and reads no analytics                                                                       |

No backend, analytics service, score export, assistance tracking, skills checklist or sign-off form is added for the pilot.
