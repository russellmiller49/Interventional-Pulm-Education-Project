# MV-SAFETY-01 — immediate safety feedback for the remaining harmful ventilation choices

Owner prompt MV-SAFETY-01, given in session on 2026-09-15 after MV-03 (PR #224) merged. Prepared by an AI authoring assistant (Claude) at the owner's request. **Nothing here is clinical approval.** Every decision in the [review queue](MV-SAFETY-01-review-queue.json) is `NOT REVIEWED`.

## Delivery and scope

- **Checkout and branch.** Worktree `…/Interventional-Pulm-Education-Worktrees/claude-mv-safety-01`, branch `claude/mv-safety-01`, cut from `origin/main` at `e80a03c7` (merge of PR #224, MV-03). The tree was clean, and MV-01, MV-02 and MV-03 are all in the base.
- **Other worktrees.** No worktree had uncommitted changes under `src/features/mechanical-ventilation` or `docs/gap-remediation`.
- **Bounded gap.** The MV-03 handoff ("Next slice", item 2) listed ten authored potentially harmful choices, across six items, with no safety explanation. This slice addresses only those ten. The three MV-03 safety notes, the other 36 items' teaching and the MV-03 review packet are untouched.
- **One runtime change.** `content/learningQuestions.ts` gains nine `safety` strings, each the optional fourth element of an existing choice tuple. No component, style, engine, case or storage file changed.
- **Kept exactly:**
  - question ids, choice ids and stored-answer identity;
  - stems, choice labels, rationales, keyed answers and `unsafe` markers;
  - physiology equations, simulator parameters and cases;
  - MV-01/MV-02 matched comparisons and the live MV-03 exclusion;
  - genuine safety predicates.
- **No grading restored.** No scorer, pass rule or correctness gate was added back.
- **Excluded.** No dependency, backend, grading service, storage key, Supabase or upload command, deployment or publication change, and no URL was fetched. `src/features/device-intelligence` was neither read nor changed.

## Inventory and decisions

Each row is one queue item. Positions follow each route's picker. "Registered" means a record in `content/evidence.ts`. Page numbers are PDF pages.

| Queue id | Item · where                                                            | Choice                                                     | Status                         | Harm stated in this case                                                                                                     | Main registered locators                                                       |
| -------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 01       | `oxygenation-response:check` · Revisit a concept 17                     | Accept the change because saturation improved              | **supported-feedback-added**   | Higher PEEP can lower venous return and cardiac output; oxygen delivery can fall while saturation rises                      | Tobin ch 10 pp 2, 17, 19                                                       |
| 02       | `oxygenation-response:final` · Worked applications 2                    | A successful change demonstrated by the saturation         | **supported-feedback-added**   | A pressure change that raises saturation can lower cardiac output, so oxygen delivery may fall                               | Tobin ch 10 pp 2, 17, 19                                                       |
| 03       | `safety-reassessment-and-human-factors:check` · Revisit a concept 25    | Finish waveform classification before calling for help     | **supported-feedback-added**   | Hypoxemia with hypotension can be fatal within minutes; asymmetric breath sounds point to bedside causes                     | Tobin ch 53 pp 1–3, 30                                                         |
| 04       | same item                                                               | Acknowledge the alarm and observe for improvement          | **supported-feedback-added**   | Acknowledgment changes only the warning; waiting for improvement in this patient can be fatal                                | Tobin ch 53 pp 1, 3; ch 48 p 19 (partly); HAMILTON-C6 manual p 202 (partly)    |
| 05       | `safety-reassessment-and-human-factors:placement` · Starting concepts 8 | Alarm acknowledgment and documentation alone               | **supported-feedback-added**   | Neither supports the patient or finds an obstructed airway or pneumothorax                                                   | Tobin ch 53 pp 1–2; ch 48 p 19                                                 |
| 06       | same item                                                               | Detailed waveform analysis before bedside evaluation       | **supported-feedback-added**   | Ventilation comes before diagnosis; the dangerous causes are checked at the bedside                                          | Tobin ch 53 pp 1–2 (including Figure 53-1)                                     |
| 07       | `safety-reassessment-and-human-factors:final` · Worked applications 5   | Record completion because the sound has diminished         | **supported-feedback-added**   | Persistent hypoxemia and distress mean the problem is unresolved; recording completion can stop the search and escalation    | Tobin ch 53 pp 2, 30; ch 48 p 19 (partly); HAMILTON-C6 manual p 202            |
| 08       | same item                                                               | Raise the alarm limit to match the current display         | **held-for-faculty-RT-review** | None added. Proposed point and decision needed are below                                                                     | No registered source addresses the situation; manuals narrow it                |
| 09       | `high-peak-pressure-integration:final` · Worked applications 10         | Wait for a relaxed plateau before requesting assistance    | **supported-feedback-added**   | High pressure, abrupt hypotension and asymmetric breath sounds raise concern for a tension pneumothorax; waiting delays help | Tobin ch 53 pp 1–3 (tension link partly; unregistered ch 44 pp 26–27 recorded) |
| 10       | same item                                                               | Silence the alarm while waiting for spontaneous resolution | **supported-feedback-added**   | Silencing only mutes the alarm; suspected tension pneumothorax needs treatment, not waiting                                  | HAMILTON-C6 p 202, Evita V800/V600 3.1n p 184, PB980 p 191; Tobin ch 53 pp 1–3 |

**Summary:** 9 supported-feedback-added, 0 already-adequate, 0 held-for-source-review, 1 held-for-faculty-RT-review. None of the existing rationales was adequate by itself. Each names the error, for example "This delays stabilization of a deteriorating patient", but not the mechanism or consequence in the stated case.

### Safety notes as written

Each appears to the learner as **Potential harm in this case:** followed by the text.

1. **01:** Higher PEEP raises pressure in the chest, which can reduce venous return and cardiac output; the falling arterial pressure is the warning that this may be happening. Oxygen reaching the tissues depends on cardiac output as well as saturation, so it can fall while saturation rises, and accepting the change on saturation alone keeps that PEEP in place.
2. **02:** Worsening perfusion means less blood may be carrying oxygen to the tissues. A pressure change that raises saturation can also lower cardiac output, and oxygen delivery depends on both, so it can fall even as saturation improves. Calling the change a success on saturation alone would keep, or build on, a setting that may be reducing oxygen delivery.
3. **03:** New hypoxemia with hypotension can be fatal within minutes if the cause is not found and treated, and asymmetric breath sounds point to causes found at the bedside, such as a pneumothorax or a tube that has moved into the right main bronchus. Classifying the waveform before calling for help delays the support and bedside checks this patient needs now.
4. **04:** Acknowledging the alarm changes only the warning; the hypoxemia, hypotension and asymmetric breath sounds are still there. Possible causes such as a pneumothorax or a displaced tube have to be found and treated, and in a patient this unstable, minutes spent watching for improvement can be fatal.
5. **05:** Acknowledging the alarm and writing it down do nothing to support the patient or find the cause. A high-pressure alarm with sudden hypoxemia and hypotension can come from an obstructed airway or a pneumothorax, and without bedside support and a search for the cause the patient may die within minutes.
6. **06:** In a patient this unstable, securing ventilation comes before diagnosis. Dangerous causes of a high-pressure alarm with hypoxemia and hypotension, such as an obstructed or displaced tube or a pneumothorax, are checked at the bedside by passing a suction catheter, checking the tube and examining the chest; detailed waveform analysis first spends minutes the patient may not have.
7. **07:** Persistent hypoxemia and distress mean the problem has not resolved, and hypoxemia can be rapidly lethal. Recording completion because the alarm is quieter can stop the search for the cause and the escalation this patient still needs.
8. **09:** A high-pressure alarm with abrupt hypotension and asymmetric breath sounds raises concern for a tension pneumothorax, and a patient this unstable may die within minutes if the cause is not treated. A plateau is worth measuring when possible, but waiting for a relaxed one before asking for help delays the support and treatment that come first.
9. **10:** Silencing only mutes the alarm for a short time and treats nothing. High pressure, abrupt hypotension and asymmetric breath sounds together raise concern for a tension pneumothorax, which needs recognition and treatment rather than waiting; left untreated, a patient this unstable may die within minutes.

The notes state no threshold, dose, duration or procedural sequence. Where a source narrowed a claim, the note says "can" or "may", or keeps the competing good practice (a plateau "is worth measuring when possible").

## What the learner sees

The six items render on the saved `learn?entry=review`, `learn?entry=placement` and `/assess` (Worked applications) pages through `MechanicalVentilationCourseCheck`. They have no MV-03 teaching record, so they keep MV-01's generic purpose and hint, and their explanation is the keyed choice's rationale.

The existing `VentilationReinforcement` renders any `safety` field in two places:

- **Before any answer.** Under **Show explanation**, then **Compare the possibilities**, beside the choice's rationale.
- **Immediately after a choice.** Directly below the choice after **Compare my choice**, together with "This does not fit the case." and the rationale.

Try again clears the choice and the explanation, and Continue works whatever was chosen. No code reads `safety` or `unsafe` to change an outcome. The held choice (08) shows its unchanged rationale and no note.

## Source discipline

A note was added only when at least one registered, checked source **supports** the harm it states. Every other kind of material is recorded under its own class and never counted as support.

| Class in the queue              | What was used                                                                                                                                                                 | How it counted                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `checked-published-source`      | Tobin 3rd edition chapters 10 (PEEP), 48 (Monitoring), 53 (Fighting the Ventilator) and 5 (Setting the Ventilator): registered, identity checked in MV-03, PDFs read in place | Support, at a page and section, with any narrowing recorded                                                 |
| `checked-manufacturer-source`   | HAMILTON-C6 operator's manual, PB980 operator's manual, Evita V800/V600 IFU 3.1n and AVEA operator's manual: registered, local SHA-256 equal to the registered hash           | Support for device behavior only (alarm silence, limit setting); the stems name no device                   |
| `unregistered-published-source` | Tobin chapter 44 (Barotrauma and Bronchopleural Fistula), pp 26–27: tension pneumothorax presents with hypotension and cardiovascular collapse                                | Recorded for a registration decision; not support                                                           |
| `authored-course-content`       | The unit explanations and examples in `learningCurriculum.ts`, `sectionSpecs.ts`, `learningExperiments.ts`, the safety and oxygenation teaching panels, and `runtimeCases.ts` | Consistency only. Every note stays inside what the unit already teaches; "calling for help" is unit wording |
| `supplied-uncertain-provenance` | `source-cases.v1.json` (case MV-01 and MV-14 unsafe actions, hints and findings)                                                                                              | Intent only                                                                                                 |
| `model-behavior`                | MV-01's higher-PEEP state lowers arterial pressure (MV-02); case MV-14 models progressive hypotension                                                                         | Consistency only                                                                                            |
| `unverified-citation`           | AARC 2024 patient–ventilator assessment guideline, cited by the safety unit                                                                                                   | Not available locally, not read, not used                                                                   |
| `faculty-rt-judgment-required`  | Item 08, and the open questions below                                                                                                                                         | The decision is left to faculty/RT                                                                          |

**How the sources were read.** Tobin chapters 5, 10, 36, 41, 44, 48 and 53 were extracted with `pdftotext` and searched in place. Page numbers come from form feeds, and each cited passage was read in context.

A subagent searched all registered ventilator manuals it could find for limit setting, high-pressure-limit behavior and alarm silence. All ten files located matched their registered hashes. Every manual page cited as support was re-extracted page by page. The pages not re-extracted are listed under item 08.

The locators found that no registered chapter discusses acknowledging, documenting, silencing or re-setting an alarm. Where a note relies on that, the queue records it as definitional (`none`, "does not address"), and the harm itself rests on chapter 53's time course.

## The hold: item 08

- **Choice.** `safety-reassessment-and-human-factors:final`, choice 2, "Raise the alarm limit to match the current display". The case: after an intervention the alarm is quieter, but the patient remains hypoxemic and distressed.
- **Proposed teaching point (not shown).** Re-setting an alarm limit to the current abnormal reading, while hypoxemia and distress persist, stops the alarm warning at that value and treats nothing.
- **Why it is held.** The registered manuals show that the consequence depends on which limit and which device:
  - **Automatic limits.** The HAMILTON-C6 (p 105) and Evita (p 187) set limits around current measured values automatically, so "matching the display" is a normal device function when the readings are acceptable.
  - **The pressure limit shapes the breath.** On the HAMILTON-C6 (p 106), the PB980 (pp 188, 216) and in Tobin chapter 5 (p 20), the high-pressure limit also ends or caps the breath, so raising it changes ventilation, not only the warning.
  - **Raising a limit can be correct.** The AVEA manual (p 87) lists raising the high-pressure limit as one action for a different alarm.
  - **What the sources do support.** HAMILTON-C6 p 202, PB980 p 30 and Evita p 186 say limits are set for the individual patient and that extreme limits can defeat the alarm. None addresses re-setting a limit around an unresolved abnormality, and no registered chapter does either.
  - **An open question already exists.** The MV-03 packet asks the same thing of its own alarm-limit note ("Keep, reword or source it?").
- **Evidence searched.** Tobin chapters 48, 53 and 5 (registered) and 41 and 44 (unregistered), for "alarm". All located registered manuals. The AARC 2024 guideline was not available and not read. The registered INTELLiVENT-ASV manual was not found on this machine.
- **Pages not re-extracted.** HAMILTON-C6 pp 93 and 109, AVEA p 87 and PB980 p 148; a subagent located them.
- **Decision needed (faculty/RT).**
  1. Which alarm and limit the stem means, since it names none.
  2. Wording that separates re-setting limits around verified, acceptable readings from widening a limit around an unresolved abnormality.
  3. Whether to say that on several registered ventilators the high-pressure limit also caps or ends the breath.
  4. Whether this choice and the MV-03 alarm-limit note should share one sourced wording.

Until then the choice keeps only its existing rationale, "Changing the monitoring boundary does not correct the cause."

## Open questions for review

1. **"May die in minutes."** Chapter 53 says this of a patient suddenly fighting the ventilator whose cause is not found. Seven notes (03–07, 09, 10) apply that time course to new hypoxemia with hypotension. Accept, or soften?
2. **Chapter 44.** Register Tobin chapter 44 for the link between hypotension and tension pneumothorax, or accept chapter 53's partial support (items 09, 10)?
3. **"Calling for help."** It rests on the unit's own wording and the unchecked AARC 2024 guideline (item 03). Check the guideline, or accept the course wording?
4. **One alarm-limit decision.** A single faculty/RT decision can resolve item 08 and the MV-03 alarm-limit note together.

Per-item review questions are in the queue: overdistension depth (01), the unspecified "pressure adjustment" (02) and whether to name the suction-catheter check (06).

## Test-contract migration

**No existing assertion was changed, skipped or removed.** The only new test file is listed below, and the suites that guard the neighboring contracts were re-run unchanged.

| File · assertion                            | Old contract | New assertion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Count            |
| ------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| New `mv-safety-01-harmful-choices.test.tsx` | —            | **Queue and content:** the queue holds exactly the ten inventoried choices with allowed statuses, and every one of the 13 harmful choices has either a note or a queue entry. Wording is added only where the queue records a registered checked source that supports it, never on a held choice, and the notes address no learner and use no grading words. Stems, labels, rationales, keys and `unsafe` markers equal the base. Decisions are honest, and every locator is registered, unregistered or `none`, with a known class and finding. **Rendered:** see the next row.      | new 23           |
| (same file, rendered)                       | —            | Each of the six items shows its notes under Show explanation with no choice selected. Each of the nine harmful choices shows "This does not fit the case.", its rationale and its note directly below; then Try again clears and Continue advances with nothing stored. The held choice shows no note and does not block. Wrong, then Try again, then the fitting reading, with no grade text. Remounting opens item 1 with nothing revealed. A legacy `learning-flow-v1` record that chose these options parses to the same choice ids and `finalHistory`, and stays byte-identical. | (in 23)          |
| Re-run unchanged                            | —            | `mv03-question-teaching` (includes the global "`safety` only on `unsafe`" check), `mv03-review-packet`, `learning-flow`, `self-paced`, `case-self-paced-safety`, `stage-teaching-disclosure`, `content-registry` and the rest of the MV, MV route, critical-care and learning-module suites                                                                                                                                                                                                                                                                                           | passed unchanged |

## Executed evidence

Raw outputs, outside Git: `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/mv-safety-01-2026-09-15/`. The folder holds:

- baseline and branch Jest JSON and logs, and normalized failure payloads;
- the source hashes and the queue generator;
- the browser script, report and screenshots;
- the ESLint, Prettier and type-check logs.

| Command                                                                                                                                                                                                                                                                                                                    | Result                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline, before any edit, in a detached worktree at `e80a03c7` (current main) with this worktree's `node_modules` linked: `node node_modules/jest/bin/jest.js --runInBand src/features/mechanical-ventilation 'src/app/\[locale\]/mechanical-ventilation' src/features/critical-care src/features/learning-module --json` | **76 suites (73 passed, 3 failed); 1,078 tests (1,075 passed, 3 failed, 0 skipped).** MV plus MV routes: 35 suites / 710 tests, all passed.                                                                                                                                                                                                                                                                                                   |
| Queue generator: `node node_modules/tsx/dist/cli.mjs …/generate-mv-safety-01-queue.ts`                                                                                                                                                                                                                                     | Wrote the queue from current and base content, with no hand-copied wording. Its guards passed: legacy-facing fields equal to base, each choice harmful and previously unexplained, status agreeing with content, and manual hashes equal to the registered hashes. Summary: 9 supported, 1 held.                                                                                                                                              |
| Focused, after the content and queue: `mv-safety-01-harmful-choices`, `mv03-question-teaching`, `mv03-review-packet`, `learning-flow`                                                                                                                                                                                      | **4 suites / 57 tests passed** (23 + 18 + 4 + 12), first run.                                                                                                                                                                                                                                                                                                                                                                                 |
| Same full Jest command on the branch                                                                                                                                                                                                                                                                                       | **77 suites (74 passed, 3 failed); 1,101 tests (1,098 passed, 3 failed, 0 skipped). MV plus MV routes: 36 suites / 733 tests, all passed.** Added: exactly `mv-safety-01-harmful-choices` (23). No suite was removed or changed its test count (`suite-diff.json`).                                                                                                                                                                           |
| Failure comparison, branch against current main                                                                                                                                                                                                                                                                            | The same three failures, with identical payloads once ANSI codes and stack frames are stripped. **Pre-existing on main: no new failure, none fixed** (`failure-comparison-branch-vs-main.txt`). They are `critical-care/__tests__/accessibility.test.tsx` (readable without color), `critical-care/__tests__/learner-copy.test.ts` (static component copy) and `critical-care/__tests__/curriculum-sequencing.test.tsx` (CRRT station order). |
| `node node_modules/typescript/bin/tsc --noEmit -p .`                                                                                                                                                                                                                                                                       | Exit 0.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `eslint --max-warnings=0` on the two changed `.ts`/`.tsx` files; `prettier --check` on all seven changed files; `git diff --check`                                                                                                                                                                                         | Exit 0; clean; clean.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Dev-server log (preview tool, error level)                                                                                                                                                                                                                                                                                 | Only the known missing-Supabase-key errors from `src/proxy.ts` and `/api/analytics`, because there is no `.env.local`, as in MV-03. MV routes rendered, and Playwright recorded no page or console error.                                                                                                                                                                                                                                     |

### Genuine browser actions

- **Server.** `npx next dev --port 3123 --webpack` (the `claude-mv` launch entry in this worktree), started through the preview tool, with no `.env.local`.
- **Why Playwright.** The in-app browser pane was hidden, so actions were driven by Playwright Chromium (`browser/mv-safety-01-browser-check.cjs`).
- **Isolation.** The script fulfills `/api/*` locally and blocks external hosts; none was attempted.
- **Seeded storage.** Six legacy MV keys, with `mechanical-ventilation-learning-flow-v1` holding a realistic record that chose five of the harmful options. Every localStorage write was recorded.

| Requested check                  | Covered by                                                                                                                                                                                                                            | Result |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Explanation before answering     | Revisit 17, Revisit 25 (after Hint), Starting concepts 8, Applications 5 and 10: Show explanation with no choice selected opens the safety notes in "Compare the possibilities" (1, 2, 2, 1 and 2 notes)                              | Passed |
| Harmful choice → safety feedback | Revisit 17, Revisit 25, Starting concepts 8, Applications 2 and 10: "This does not fit the case." with the note directly below the compared choice                                                                                    | Passed |
| Held choice                      | Applications 5, "Raise the alarm limit…": existing rationale and no note; Continue enabled                                                                                                                                            | Passed |
| Wrong answer → retry             | Applications 2: harmful choice, Try again, then "A benefit accompanied by a possible circulatory cost", which shows "This fits the case." and no note                                                                                 | Passed |
| Continue without correctness     | Revisit 17 (after Try again), Revisit 25 (with the non-fitting choice still selected), Starting concepts 8 by keyboard (focus plus Enter)                                                                                             | Passed |
| Reload                           | Applications: reload returns to item 1 with nothing revealed or selected                                                                                                                                                              | Passed |
| Legacy record preservation       | All six seeded keys byte-identical at every check. Writes were transient `lswt-*` probes and `mechanical-ventilation-self-paced-v1` on the MV-03 practice visit, asserted free of response data. The course-check pages wrote nothing | Passed |
| Narrow and mobile width          | Applications 10 (both notes plus the silencing choice) and Revisit 25 at 390×844, 320×740 and 1024×768: no horizontal page overflow. Safety-note boxes end at 314 of 390, 244 of 320 and 918 of 1024 px                               | Passed |
| Live MV-03 hold                  | `practice?case=MV-03&device=hamilton-c6&mode=practice` shows "Worked explanation · live case under modeling review"                                                                                                                   | Passed |
| Whole run                        | **8 scenarios and 9 layout checks passed, 0 page errors, 0 console errors.** The only request was `POST /api/analytics`, fulfilled locally                                                                                            | Passed |

Screenshots inspected:

- the PEEP harmful choice with its note, at 1440 px;
- the held alarm-limit choice with no note, at 1440 px;
- the silencing choice at 320 px.

## Observed, not changed

- **Generic purpose line.** For the six items it reads, for example, "Apply did oxygenation improve at a cost? to a short authored case." MV-01's generic purpose is built from a unit title that is a question. It belongs to a later teaching batch for the remaining 36 items.
- **Radio styling.** On the course-check card, unselected radio controls render as filled dark dots at 1440 px, which can read as selected. The styling predates this slice.
- **Chapter 53 locator for the MV-03 packet.** Chapter 53 p 2 locates "tension pneumothorax stays on the list", which the MV-03 packet records as not checked. The packet was not edited, and a reviewer can use this locator.
- **HAMILTON-C6 manual file name.** The registered manual exists locally only as `HAMILTON-C6_ops-manual_v1.2.x_en_10197564.00 (1).pdf`, with a matching hash.

## Legacy-progress implications

- **Storage untouched.** No storage key, writer, reducer, completion flag or analytics payload changed.
- **Saved answers keep their meaning.** Question ids, choice ids, labels, rationales and keyed choices are unchanged, so a saved `mechanical-ventilation-learning-flow-v1` answer still names the same choice. A test and the browser run both pin a legacy record that chose these options.
- **Nothing new stored.** `safety` is never persisted, and nothing reads it to grade, weight, remediate or lock.

## Checks not run

- Full `npm test`, a production build and the repository's Playwright end-to-end specs.
- Safari and Firefox; VoiceOver or other screen readers; native browser zoom.
- The es and zh routes. The new notes are English only.
- Authenticated sync or any remote data.
- The in-app browser, whose pane was hidden.
- The AARC 2024 and ATS 2024 guideline texts; no URL was fetched.
- Faculty, RT or learner observation, and clinical review.

## Next

This slice stops here; G02 was not started.

1. **Faculty/RT review of the queue.** Start with item 08 and the four open questions, then review the nine notes.
2. **Owner source decisions.** Whether to register Tobin chapter 44, and whether to check the AARC 2024 guideline.

## Changed files

- `src/features/mechanical-ventilation/content/learningQuestions.ts`
- `src/features/mechanical-ventilation/__tests__/mv-safety-01-harmful-choices.test.tsx` (new)
- `docs/gap-remediation/self-paced/MV-SAFETY-01-handoff.md` (new)
- `docs/gap-remediation/self-paced/MV-SAFETY-01-review-queue.json` (new)
- `docs/gap-remediation/self-paced/README.md`
- `docs/gap-remediation/self-paced/implementation-plan.md`
- `docs/gap-remediation/self-paced/test-contracts.md` (one row added; Prettier re-padded that table)
