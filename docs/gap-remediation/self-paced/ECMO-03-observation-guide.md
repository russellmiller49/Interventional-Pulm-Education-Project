# ECMO-03 — self-paced observation guide for the Cardiohelp ECMO module

**Status: prepared, not run.** No participant, session or finding exists. The browser checks in the
[ECMO-03 handoff](ECMO-03-handoff.md) and the earlier journeys in
[flow-validation.md](../../cardiohelp-ecmo/flow-validation.md) are automated or assistant checks,
not observed learning. Do not copy them into the forms below.

This adapts the unrun think-aloud protocol (the short protocol at the end of `flow-validation.md`
and the B5 packet under `docs/cardiohelp-ecmo/validation/`) to the self-paced module. Two rules from
those documents are **not** used here: the no-coaching boundary and recording "interface help" as a
lesser outcome. Here, teaching, hints, explanations, references, replaying a comparison and skipping
are normal use. The session watches whether those choices help a learner understand and recover,
not whether the learner managed without them.

## Purpose

For each of three activities, notice whether a learner can:

1. find the explanation or source for what is on screen;
2. use a real control or comparison and say what changed in the model;
3. recover from a tempting answer or a surprising model response, using feedback, Hint, Show
   explanation, Try again, a source or the facilitator; and
4. leave, return and find where they were, without earlier answers being replayed as their own.

Record what was confusing or useful, in the learner's words where possible. There is no score,
time, first-attempt record or independence label anywhere in this guide.

## Before the session

- Use a current build of branch `claude/ecmo-03` or later, on a fresh browser profile (or cleared
  site data) so no earlier location is restored. The module is an unlisted preview.
- Tell the learner: "Use the module as you normally would. Read the explanation, ask for help,
  reveal an answer, repeat a comparison, skip a question or jump to another topic whenever that is
  useful. The numbers come from this teaching model, not from a patient, and they are not targets.
  This is feedback on the module, not a test of you."
- The facilitator may answer questions, point to a panel and explain. Note that it happened and
  what the learner was looking for, as context for the interface.
- An ECMO or device educator should be present or available afterwards for the content questions
  the [claim-review queue](ECMO-03-claim-review-queue.json) raises. The observer does not settle them.
- Do not enter or discuss patient-identifiable information.

## Activity A — a control comparison (VV)

Start: the module page → **Learn** → VV track → the section on blood flow versus sweep
(`/en/cardiohelp-ecmo/learn?track=vv&lesson=blood-flow-versus-sweep`).

| Step                  | Invite the learner to…                                                                                                                            | Watch for                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Find the explanation  | Read the three adjustments, then open **Show explanation** on the prediction before choosing anything, if they wish.                              | Is the explanation reachable without answering? Does it say what to read after each comparison?                                                      |
| Use a comparison      | Run the sweep comparison, then the speed comparison, then the oxygen-fraction comparison. Each starts from the same circuit.                      | Do they read PaCO₂ and pH after the sweep change and flow after the speed change? Do they see that the changes are not cumulative?                   |
| Recover from surprise | Work either story problem: choose, compare with the explanation, run the colleague's change, and try again if they like.                          | Does the run settle the question, or does the learner rely on the verdict text? Is "read the direction, not the slope" understood?                   |
| Meet a model bound    | Optional: in the console, raise pump speed toward 5000 rpm, or sweep toward 15 L/min, and read the model boundary beside the pump and sweep text. | Is it clear that saturation stops rising and that PaCO₂ stops at 20 mmHg because of the model? Does anyone read more speed or sweep as more benefit? |
| Return later          | Leave for the module page, then reopen the section from the outline or the resume link.                                                           | Location restored with no answer or run replayed. Is that expected?                                                                                  |

Content questions for the educator: queue items ECMO-03-07 (sweep bound), -08 (saturation ceiling)
and -09 (whether the prediction question adds anything over the story problems).

## Activity B — a circuit and pressure task (VV)

Start: **Learn** → VV track → the drill on oxygenator resistance
(`/en/cardiohelp-ecmo/learn?track=vv&lesson=afterload-oxygenator-resistance`).

| Step                  | Invite the learner to…                                                                                              | Watch for                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Find the explanation  | Read the task, open the teaching or Show explanation, and find where pInt, pArt and the pressure drop are measured. | Can they find the pressure locations on the circuit map without a question being answered first?                                   |
| Use the circuit       | Start the guided activity if they choose, advance the observation, and read the pressures and their change.         | Do they read two pressures and the gradient together, and compare at similar flow?                                                 |
| Recover from surprise | Answer the localization question, read the feedback for the other choices, and try again or skip.                   | Does the feedback explain the pressure pattern and what to reassess, or only announce an answer?                                   |
| Sources               | Open the sources for the lesson.                                                                                    | Are the IFU revision, its issue date and the date it was checked read as separate facts? Is "no clinical review recorded" noticed? |
| Return later          | Leave and reopen the drill.                                                                                         | A fresh model; no earlier action shown as performed.                                                                               |

Content questions: ECMO-03-02 (IFU identity and scope) and -03 (why no pressure-drop alarm priority
or bubble size is taught).

## Activity C — one learning case (VV or VA)

Pick one, balancing VV and VA across sessions:

- VV: **Practice** → the sweep-gas disconnection case
  (`/en/cardiohelp-ecmo/practice?track=vv&case=clinical-vv-gas-disconnection`).
- VA: **Practice** → the differential hypoxemia case
  (`/en/cardiohelp-ecmo/practice?track=va&case=va-clinical-differential-hypoxemia`).

| Step                 | Invite the learner to…                                                                                          | Watch for                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Find the explanation | Read the case, open a Hint or the explanation whenever they want, including before making a plan.               | Does the case read as learning rather than an examination? Is it clear the plan is optional?                                        |
| Use the simulator    | Make a change they believe in on the console or gas controls and read the patient, circuit and device response. | Do they separate device, circuit or gas, and patient findings?                                                                      |
| Recover              | Open the debrief with or without acting. Replay the case if they like.                                          | Without actions, does the debrief say no prediction or action was recorded, and is that understood? Does the debrief add something? |
| Sources              | Open the case sources.                                                                                          | Is the supplied case curriculum read as an unpublished draft, and the guidance years as registered but unchecked?                   |
| Return later         | Leave and use the next-case or resume link.                                                                     | The next case opens by name; nothing from the earlier case is carried as done.                                                      |

Content questions: ECMO-03-05 (case curriculum) and -06 (guidance records), and any clinical
disagreement the learner raises about the case.

## Blank observation record

Copy one per learner. Status: NOT PERFORMED until filled from a real session.

| Session field                                                 | Entry |
| ------------------------------------------------------------- | ----- |
| Module build or commit                                        |       |
| Actual session date                                           |       |
| Facilitator role                                              |       |
| Educator present or consulted (role)                          |       |
| Optional pseudonymous participant code and experience context |       |
| Device, browser and any accessibility needs volunteered       |       |
| Activities explored (A, B, C-VV or C-VA)                      |       |

| Activity | Step | What the learner did or said | Help, explanation, source or replay used, and whether it clarified | Where the next action or navigation was unclear | Content question raised (queue item) |
| -------- | ---- | ---------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------ |
| A        |      |                              |                                                                    |                                                 |                                      |
| B        |      |                              |                                                                    |                                                 |                                      |
| C        |      |                              |                                                                    |                                                 |                                      |

| After the session                                         | Entry |
| --------------------------------------------------------- | ----- |
| What the learner thought each activity was for            |       |
| Which question helped understanding, and how              |       |
| Which question interrupted without adding anything        |       |
| Technical or display problem                              |       |
| Facilitator intervention, as context for the interface    |       |
| Unresolved misunderstanding to address in the teaching    |       |
| Observed fact, kept apart from facilitator interpretation |       |
| Proposed module repair and where the evidence is kept     |       |
| Priority of the module issue (not of the learner)         |       |
| Actual retest date and what was seen                      |       |

Do not record names, scores, times to answer, first attempts, or whether help was used as a measure.
A path that works in an automated browser does not show that the explanation became clear to a
person.
