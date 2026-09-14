# PI-02 — Peripheral Imaging small usability session: plan

**Status: PREPARED, NOT RUN.** No learner, technologist or facilitator session has taken place. No participant, quotation, observation or result exists. The owner recruits participants and runs the sessions with appropriate permissions.

Module: Peripheral Bronchoscopy Imaging, `/<locale>/peripheral-imaging`, as converted to self-paced learning in [PI-01](../self-paced/PI-01-handoff.md). Forms: [observation form](PI-02-observation-form.md) and [issue and retest form](PI-02-issue-retest-form.md). Handoff: [PI-02 handoff](../self-paced/PI-02-handoff.md).

## What this is, and is not

A small usability and teaching pilot: watch a few intended learners use the module the way they normally would, and learn where its navigation, controls, explanations, images and questions help or get in the way. It feeds at most three module repairs in PI-03.

It is **not** an examination, a validated sample, a research protocol, a psychometric or pass-standard study, or a clinical review. Nothing about a participant is scored. There is no hidden test: the learner is told what the session is for, every section and case is open, and help is part of the product. If the owner later wants generalizable or publishable findings, a research protocol with its own review is a separate future choice.

This plan reuses the module's existing evaluation proposal ([module plan, "Evaluation after release"](../../peripheral-imaging/module-plan.md#evidence-and-review): 3–5 fellows and a technologist; start, resume, change controls, finish and locate-term tasks). Under the [self-paced contract](../self-paced/README.md) it drops that proposal's consented time estimates, first-attempt errors and drop-off analytics. The navigation moments stay, as things to watch rather than tasks to pass.

## Who

- **Learners:** approximately three to five intended learners: pulmonary or interventional pulmonology fellows or bronchoscopists, the module's stated audience. A small, convenient group is fine; it is not a sample.
- **Technologist input:** at least one radiologic or CT technologist who works in the bronchoscopy suite. Their suggested role is to walk the path before the first session and flag suite and control wording that does not match practice. They may also take part as one of the learners or sit in as a second observer. Their comments go on the same forms, marked as technologist input.
- **Facilitator:** the owner or a delegate. One facilitator per session is enough.

Participation is voluntary. A participant can stop at any time, and stopping is not recorded as anything.

## Build and environment

Do before each session. This is a facilitator check of the build, not a learner observation, and it goes in the "version and device context" block, not the observations.

1. Record the commit SHA or deployment label. Use the same build for all sessions in a round where possible; a repair between sessions starts a new round.
2. Use an environment with the site's normal configuration. On a local development server without Supabase settings, Imaging pages load but the site home page (`/en`) fails, and the site's usage endpoint returns errors in the console. A learner who follows the site logo would reach that failure.
3. Open a **fresh browser profile or private window, signed out.** Imaging is a direct-link module that needs no account. Signed out, the site's existing usage tracker stores nothing (its endpoint accepts only signed-in users), and the module's own progress starts empty.
4. Use a laptop or desktop for the labs. Optionally run one session on a tablet or phone to see the layout, and record the device.
5. Open `/en/peripheral-imaging` and confirm that the Overview loads, Help opens on a section, and "Show the explanation" is present on integrated case 6. If any of these fails, fix or reschedule; do not run the session on a broken build.
6. After the session, close the private window or clear the profile's site data, so the next participant starts fresh.

## Suggested path

About 30–40 minutes. That is a planning estimate for booking, not a time limit, and time is not recorded. The order below is a suggestion. The learner may take the stops in any order, spend longer on one, skip a stop, jump elsewhere through the Course outline or tabs, or stop early. The module lists earlier sections for each section as background; they are not locks.

| Stop           | Teaching purpose                        | Where                                                                                 | What it contains in this build                                                                                                                                                                                                                             |
| -------------- | --------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Entry        | Finding a start                         | Overview, `/en/peripheral-imaging`                                                    | Start door, course outline of 19 sections, Learn / Practice / Integrated cases tabs, "What this device keeps"                                                                                                                                              |
| 1 Comparison   | One acquisition or control comparison   | Learn: "Projection, superimposition, and depth", `learn?section=projection`           | Worked demonstration with "Baseline · frontal overlap" and "Change projection only", C-arm obliquity control, projected separation beside the true depth offset, then the section's own activities and check                                               |
| 2 Limit        | An interpretation limit                 | Learn: "Understanding the DTS reconstruction", `learn?section=dts-interpretation`     | What a tomosynthesis reconstruction is built from, including when it combines current projections with an older scan or a model. Optional related case: integrated case 3, "Evidence for prior-aided DTS"                                                  |
| 3 Image→sample | From the image to where tissue is taken | Learn: "Confirm the biopsy tool within the lesion", `learn?section=tool-confirmation` | The sampling part of the tool as a three-dimensional object, of which the tip is one point. Optional: practice case "Needle fragments on axial images" (`practice?case=tool-confirmation-practice-1`) or integrated case 5, "Needle tip beyond the lesion" |
| 4 Safety       | A safety-related case                   | Integrated case 6, "Breath hold not tolerated", `assess?case=case-6`                  | A case marked "safety decision", with "Show the explanation" before answering, feedback on any option checked (including the unsafe-option alert), Try again, and a link to the section it draws on ("When to repeat localization")                        |

Prefix each address with `/en/peripheral-imaging/`. The path covers what PI-02 asks for: an image-to-sampling explanation, one acquisition or control comparison, an interpretation limit and a safety-related case. Choosing these stops is a usability decision, not a review of their clinical content; all items remain `draft` pending the existing faculty and technologist review.

### Help that exists in this build

Tell learners about what is really there. The Imaging item bank has no hint text, so **there is no Hint button**. Help in this module is:

- **Help** in the section header ("What do I do now?"), which says any step can be skipped, any check can show its explanation first, and answers are not saved
- **Show me where** on lab steps, which highlights the control to use
- **Show the explanation** on checks and cases, before or after answering; **Show the matches** on the evidence sort
- **Try again** after checking an answer
- **Skip** and **Continue without …** on steps with work, **Back** and **Review earlier activities**
- **Course outline**, the tabs, **Save for review** and **Restart section**

If a learner looks for a hint, that is worth writing down as an observation.

## Facilitator script

### Before starting

1. Explain the purpose in one or two sentences: feedback on the module, not a test of the learner.
2. Agree the permission arrangement. **No audio, video or screen recording by default.** If a recording is separately agreed, write the arrangement on the form, and keep the recording outside Git with the completed forms.
3. Offer an optional pseudonymous code (for example `PI02-A`). Do not write the learner's name, email, employer or trainee ID on any form. If the owner needs to link a code to a person to arrange a retest, keep that key separately from the forms, or do not keep one.
4. Read the invitation on the observation form aloud:

   > Use the module as you normally would. Read, open an explanation, use Help or "Show me where", try a check and try again, skip a step, or jump to another section whenever that is useful to you. This is feedback on the module, not a test of you, and nothing you choose is scored. Please say what you are thinking or looking for when it is convenient. You can stop at any time.

5. Mention that the module keeps only where they were and which sections and cases they opened, on this browser, and nothing about their answers.

### During the session

- Do not ask the learner to work alone or avoid help, and do not hold back teaching to find out what they already know.
- Neutral prompts are enough: "What are you looking for?", "What do you think this is asking you to do?", "What did you expect to happen?"
- If the learner asks how the interface works, answer it and note the help as context for the interface. If they ask about clinical content, point first to what the module itself offers (explanation, Help, the linked section), then answer if they still want it. Note it the same way. Neither is a deficit.
- Write down what they chose to do, not how well they did it. Do not note correctness, attempts, time or how much help they used.
- If a technical or image problem stops them, note it, help them recover or move on, and continue.
- If a learner mentions a real patient, do not write down details; note only that a clinical example came up.

### Closing questions

Ask briefly, and accept "nothing" as an answer:

1. Which question, if any, helped you understand something? Which one got in the way?
2. Which explanation, image or comparison helped most? Was anything confusing after you had read it?
3. Was there a moment you did not know what to do next, or how to get somewhere?
4. If you came back tomorrow, would you know where to pick up?
5. What would you change first?

## What to observe

The forms carry the full prompts. In short, for each stop:

- what the learner thought the activity was for
- where navigation or a control was unclear
- whether each question added value or friction
- which explanation or visual helped them make sense of it
- how they recovered from a technical or conceptual difficulty
- any facilitator help, as context for the interface

Across the session: finding a start, jumping and returning, leaving and resuming (for example a reload), and what they understood the device to keep.

Keep observed fact, facilitator interpretation and proposed change in separate columns. **Do not calculate** percent correct, first-attempt scores, independence, time on task, help counts or minimum exposure. Do not produce success rates across participants.

## After the sessions

1. Within a day of each session, tidy the observation form while memory is fresh. Leave empty fields empty.
2. Open an issue on the [issue and retest form](PI-02-issue-retest-form.md) only for something actually observed. An issue describes the module, never the learner.
3. When a round is finished, the owner chooses **at most three** issues for PI-03. Issues about clinical, source, image-rights or radiation-physics content stay pending attributable review; they are not repaired by wording alone.
4. After a repair, retest with a real session on the new build and record what was observed. The retest is one person on one build, not a validation.

## Where completed forms live

Completed observation and issue forms, and any separately agreed recording, stay **outside Git** in a private location the owner chooses. A suggested place is a new `usability-observations/peripheral-imaging/` folder in `Interventional-Pulm-Local-Data`; PI-02 does not create it, and adding it means updating the [Local-Data map](../../local-authoring-assets.md) under that folder's rules. Only de-identified issue summaries that PI-03 acts on should enter the repository, without session codes where they are not needed.

## Existing facilities, and why the session does not use them

| Facility                                                                                            | What it does                                                                                                                                     | Use in PI-02                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module beta feedback (`/development-beta/peripheral-imaging`, reviewed at `/admin/module-feedback`) | Requires a signed-in, email-verified account; stores the tester's email, page path, comment and an optional screenshot in Supabase               | **Not the session record**: it is tied to an account and email, so it is not pseudonymous. A learner who already uses it can keep doing so outside the session. |
| Site usage tracker (site layout, `/api/analytics`)                                                  | Pre-existing: session start, 30-second heartbeat and end, with module, route, duration and a random session id; stored only for a signed-in user | Not used. Running signed out means nothing is stored. PI-02 adds no event and reads no analytics.                                                               |
| Imaging self-paced progress (`ip-peripheral-imaging-self-paced-v1`, this browser only)              | Last location, opened sections and cases, reviewed and saved-for-review marks; no answers                                                        | Used as the module normally uses it, so resume can be observed. Not exported or collected; cleared with the private window.                                     |
| Critical-care progress and its export                                                               | Covers the critical-care modules                                                                                                                 | Does not cover Imaging; not used.                                                                                                                               |

No backend, analytics service, score export or assistance tracking is added for the pilot.
