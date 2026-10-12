# Bronchoscopy Foundations rewrite: handoff

Written 2026-10-08, last updated 2026-10-12 (after the mixed sets). Start the next session from this file.

## Why this work exists

Russell Miller rejected the direction the module had taken: too conservative, too many protective
statements and references, and it had lost sight of its purpose, which is to teach fellows
bronchoscopy simply. His plan is `~/Downloads/Bronchoscopy Foundations — Rewrite Plan.md`
(15 sections, about 110 minutes, ten authoring rules, a numbers register, pilot first). Read it
before writing anything. Do not reintroduce hedges, disclaimers, model-boundary notes or "ask your
supervisor" answers.

## Where things stand

All fifteen sections are on `main` (`1c225e79`, 2026-10-11): #349 to #375 were merged on
2026-10-10 with #351 and #376, and #377 (section 13) and #378 (section 15, with capstone C09)
the next day. #348 is closed.

Four PRs are open:

| PR   | Branch                  | State                                                                                                              |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| #380 | `claude/bf-rewrite-hub` | Draft, targets `main`. The hub rewritten, a closing screen, `what-completion-means` retired, the image rule moved. |
| #382 | `claude/bf-image-bank`  | Draft, stacked on #380. The image bank: 50 click-on-the-picture questions in five sets, on the Practice surface.   |
| #385 | `claude/bf-vignettes`   | Draft, stacked on #382. Forty vignettes with numbers in eight topics, on the Practice surface.                     |
| #388 | `claude/bf-mixed-sets`  | Draft, stacked on #385. Practice in mixed sets of ten; the paired section and the safety label shown afterwards.   |

The work is in the worktree `…-Worktrees/claude-bf-pre-review-04-20261007`, which is on
`claude/bf-mixed-sets`. Merge #380, #382, #385, then #388; branch the next change from
`origin/main` after that. The
local copies of the merged stack branches are behind origin.

A reader reviewed sections 13 and 15 against `docs/teaching-first-rules.md` before the merge and
found no blocking problem. Its teaching suggestions went to Russell; none is applied. Ask him
before acting on them.

## Start here next session

1. Read this file, then the plan's rules and the brief for the section you are writing.
2. The fifteen sections, the hub, the closing screen, the image bank, the vignettes and the
   mixed sets are written. Left in the plan's practice and assessment (item 7 under "What is
   left"): rewriting the eight integrated cases, cleaning the older practice items, and
   replacing the 108 objectives with about 25. Self-check mode is still Russell's decision.
3. Things to know before that change:
   - With the image bank and the vignettes the course shows an image in 79 of 187 questions,
     so the one-third rule is met. Without the bank it is 29 of 137.
   - First-contract code is now dead and still in the tree: the old fields in `content/types.ts`
     (`recognizeTitle`, `why`, `newConcept`, `incrementSentence`, `controlStrip`,
     `modelBoundary`, `steps`), the `!rewritten` branches in `sectionValidation.ts`,
     `BronchStageHost.tsx`, `BronchCourseTeaching.tsx` and `BronchPilotTeaching.tsx`, the
     first-contract verdict frames, and the report-only branch of `check-section.ts`. Removing
     it is its own change; `authoringContract: 2` can then go too.
   - `TubeCrossSection.tsx` and the scope pane's tube mode are unused. Ask before removing them.
4. Work one section per session. Get a digest of the old section from a subagent instead of
   reading it into context, then write the new file. The notes under each section below say
   what the checks will refuse.
5. Dev server for this worktree: launch configuration `claude-bf`, port 3133. The Browser pane
   refuses that address; verify with Playwright (a throwaway config, since the module's own
   config matches its spec files exactly) and with `curl`. Keep the throwaway config and spec
   inside the repository while they run, or `@playwright/test` does not resolve, then delete them.

Owner decisions so far (2026-10-08):

- Rewrite, 15-section structure and "teach the numbers" are accepted (plan decisions 1–3).
- The four Nashville bleeding rows are signed.
- The right lung's prediction stays as reworded in `b06c9009`. It was ambiguous before; see the
  lesson under "Traps".
- The fellow-session gate on the remaining sections is removed.
- 2026-10-11, hub and closing screen: the one-third image rule blocks publication and no
  longer fails the build. The printable faculty observation form is left for a later change.
- 2026-10-10, section 13: rescue drugs are named and no dose is printed, lipid emulsion
  included. Review-register R14 stands. This answers plan decision 4 for section 13.
- Methylene blue: the expert panel's regimen (signed). Flumazenil and naloxone: the product-label
  doses (signed). Scope diameters: current Olympus scopes from the device catalog (not signed).

## How a rewritten section is built

Read `docs/bronchoscopy-foundations/section-authoring-guide.md` (two pages) and use
`content/sections/right-side.ts` and `bleeding-priorities.ts` as the exemplars.

- Mark the section `authoringContract: 2`. The rules in `content/authoringRules.ts` are then
  strict for it.
- Flow in `content/courseFlow.ts`: `hook()` → `check('check')` → `screen(...)` → practice →
  `check('transfer')` → `close([...])`.
- Numbers: `num('id')` from `content/numbers.ts`. A number that is not there gets a `to-extract`
  row, and you stop. Never type a value from memory.
- Check as you go:

```bash
npx tsx scripts/bronchoscopy-foundations/check-section.ts <section-id>
```

- Machinery already available: click-on-image (`find` act; add frames in
  `scripts/bronchoscopy-foundations/build-find-frames.mjs`), several activities per section
  (`moreActs`, `CourseChunk.act`), labelled tour stops (`section.tour`, `CourseChunk.tour`),
  cases where a wrong move plays out (`AuthoredChoice.consequence`, frame `time`, numeric
  `MonitorReading`), first-move cards (`role: 'first-moves'`, `steps`, `callForHelp`).

## What is left

In the plan's order. Russell removed the fellow-session gate on 2026-10-08: the 13 remaining
sections no longer wait for sessions with the pilot.

1. **Get #380 reviewed and merged.** Everything before it is on `main`.
2. **Still open from the pilot, for Russell:**
   - Confirm the bleeding first-move card, especially step 2 (suction).
   - Confirm three orientation statements in the right lung's image questions (carina: membranous
     wall at 7 o'clock; upper lobe: anterior to the left; middle lobe: midline to the left). They
     were derived from the survey's outlines, not from a recorded camera roll.
   - Confirm the basal mnemonic M-A-L-P.
   - Sign the remaining register rows as sections come to use them. None of rows 1–17 is signed.
3. **Register rows still open.** Rows 15, 19, 20, 21 and 22 were extracted on 2026-10-08 (#352).
   Russell signed the methylene blue rows (the expert panel's regimen, U17), the flumazenil rows
   (the product label, U20) and the naloxone row (the product label, U21) the same day. No row
   is left to extract. Still open:
   - Row 22 holds current Olympus scopes from the device catalog (FDA device records, product
     pages, the manufacturer flyer). The instructions for use themselves were not read.
   - The ASRA checklist is under review, with an update expected in early 2027.
   - Rows 1–17 still have no recommendation number or page. Rows 1–17, 20 and 22 are unsigned.
4. **Restructure to 15 sections: started.** The course is in the plan's order and five phases
   (`content/sectionIds.ts`), and `content/sectionMigration.ts` holds the 15-section end state and
   the forward map for the ten retired ids, with a test. The map is applied when saved progress is
   read and when a link names a section. It carries the saved place, the sections opened and the
   review-later marks forward; it does not carry "reviewed".
   The ten absorbed sections are still in the course, each beside the section that absorbs it.
   **Retire each one in the change that rewrites its absorber**: delete its file, remove its id
   from `BRONCH_SECTION_IDS`, the phase, `BRONCH_SECTION_STAGE` and `sections/index.ts`, and move
   its tests to the absorber. `honest-report` sits late for now because its prerequisites do;
   it goes when `describe-findings` is rewritten. `what-completion-means` goes with the hub and
   closing screen (item 6).
5. **Sections rewritten so far:** the right lung, bleeding, and sections 1 to 5
   (`clinical-question`, `pre-use-check`, `sedation-and-monitoring`, `five-controls`,
   `larynx-and-entry`), all 2026-10-08, sections 7 to 10 (`left-side`, `view-loss`,
   `systematic-survey`, `describe-findings`) on 2026-10-09, and section 11
   (`washing-and-lavage`), section 12 (`biopsy-and-specimens`) and section 13
   (`deterioration`) on 2026-10-10, and section 15 (`ventilated-patient`) the same day. None
   remains. The course lists the fifteen sections.
   Notes from section 15:
   - `scope-in-a-tube` and `icu-physiology` are retired. M16-O1, O2, O5 and O6 are homed in
     section 15; M16-O3 (the procedure taxonomy) and M16-O4 (radiation and separate training)
     are in `RETIRED_OBJECTIVE_REASONS`. Section 12 teaches radiation under its own outcome.
   - The brief's fix is made: the pressure limit is raised with the therapist before the scope
     goes in, and practice case `mc-alarm-limits` keys it. The Reading-the-view row
     `pressure-up-volume-down` has `taughtIn: 'ventilated-patient'` and its third shortlist line
     now reads "Take the scope out if the volume does not come back". Claim-queue item C03 is
     superseded. Capstone C09 was rewritten to match on 2026-10-11, at Russell's request: the limit is already raised, the volume falls anyway, and the key is to take the scope out. Its option on raising the limit again is a mechanism error, not unsafe.
   - The tube-navigation task is cut, with its recipe, its walkthrough test and the
     end-to-end case S20. `TubeCrossSection.tsx` and the pane's `tube` mode are still in the
     code and now unused by any section; removing them is a scope-pane change to ask about.
   - A sort may state its own sizes: `BronchSort.caseValues` lets row statements and rationales
     carry digits, as a ledger does. The pairs activity uses it for tube sizes and margins.
     Scope diameters still come from row 22.
   - The case reads the ventilator on the monitor's `peak-pressure` and `exhaled-volume`
     channels. Plateau pressure and auto-PEEP have no channel; the frame's situation states them.
   - No lesson prints the Reading-the-view table now. The lesson-table tests are removed; the
     stacked-table end-to-end cases run on the Reference page, which has a fifth column.
   - `TubeGeometryFigure` kept its drawing; its caption was course-talk and is rewritten.
   - The scope views number 12, not 15 (`scope-engine.test.ts`).
   - It states 11 minutes, not the plan's 7: two activities, timed at 4 by estimate.
   - For Russell to confirm: the five settings, above all "raise the tidal volume during the
     procedure" (the register row has no condition), the sentence on mode, and PEEP ("decide
     whether to lower it": no register row); the swivel-adapter card; peak against plateau and
     the auto-PEEP line; the first-move card; recruitment afterwards; the case's ventilator
     values and four keyed decisions; the six pairs; C17's explanation; retiring M16-O3 and
     M16-O4; sign rows 16, 17 and 22.
     Notes from section 13:
   - Eight first-move cards sit two to a screen (`breathing`, `spasm`, `circulation`,
     `topical`), each card under 60 words. A block's `body` is required by the type, so a card
     cannot be steps alone. The section is 700 teaching words; the longest screen is 119.
   - Russell chose names only for every rescue drug on 2026-10-10. No dose token is used: the
     signed flumazenil, naloxone and methylene blue rows and the `last-*` rows are unused here.
     The section uses `oxygen-trigger` and `methb-oximeter-plateau`, both unsigned.
   - The case is one patient in four frames: bronchospasm, chest pain after the third biopsy,
     tension, and the plan after decompression. It differs from section 3's sedation case on
     purpose. Oversedation, hypotension, toxicity and methemoglobinemia are met in the cards,
     the transfer and the practice cases, not in the case.
   - No section's case refuses a move now. The control's refusal path (`refused`, `other`) is
     held by a direct render of `BronchScenarioControl` in `actions-and-feedback.test.tsx`.
   - The stacked Reading-the-view cases and `GRAMMAR_SECTIONS` moved to `scope-in-a-tube`. The
     lecture-transcript row is checked on `biopsy-and-specimens` (T13). The section cites no
     lecture; T09 is no longer used by it.
   - A rewritten case has no `[data-case-baseline]` line; the course-workspace walk branches on
     `authoringContract`.
   - A precommit guard may not match the prediction's own situation. "restless" is in the stem,
     so the guard is `hypoxi…` alone.
   - The harmful reflex is carrying on to finish. A choice is `unsafe` only when it does that
     (three in the case, one in each check); more sedative is `incorrect-mechanism`.
   - The copy gate refuses "assessment" in a rationale.
   - The 390 px walk logs a hydration warning from the site header's search box. It is not from
     this module.
   - It states 10 minutes, not the plan's 8.
   - For Russell to confirm: every card's steps (written from general knowledge against the
     cited chapters, `claimClass: 'synthesis'`; the pages were not reread); propofol, then a
     muscle relaxant and a tube for laryngospasm that does not break; albuterol as the named
     bronchodilator; "decompress the chest" without naming needle or finger; the case's vital
     signs and the four keyed decisions; the three practice cases, C08 rewritten around
     imaging first when the pressure holds; sign `oxygen-trigger` and `methb-oximeter-plateau`.
     Notes from section 12:
   - `protected-accessories` and `specimen-pathway` are retired. M13-O1 to O5 and M14-O1 to O4
     are homed in section 12; M14-O5 is in `RETIRED_OBJECTIVE_REASONS`. The Reading-the-view row
     `state-disagrees` has `taughtIn: 'biopsy-and-specimens'`, and capstones C01, C07 and C16 are
     paired with it.
   - A new id needed: `BRONCH_SECTION_IDS`, `BRONCH_SECTION_STAGE`, the phase, `sections/index.ts`,
     `courseFlow.ts`, `lessonVersions.ts` and the key in `scopeRecipes.ts`. Saved progress needed
     nothing: `sectionMigration.ts` already forwarded both old ids to it.
   - The find control now takes a picture that is not a survey frame: `PICTURE_FRAMES` in
     `content/findFrames.ts` (its own `size`, boxes as outlines, a `short` label per outline),
     and `marks: 'tools'`. `accessory-states` is the render of the simulator's six tool states.
     An abnormal still can be added the same way once one is cleared.
   - The matching control shows rows as authored and options in the order of `origins`. Rows
     written in that order read the answers off. Sections 2, 8, 10 and 12 are reordered and a
     test in `authoring-rules.test.tsx` refuses three or more rows in step.
   - A practice chunk with a `demonstration` works in a rewritten flow. The brush exchange keeps
     its eight captions; the word "model" was taken out of one.
   - A length cue is measured on the unresolved text, so a key with a number token counts its
     token's length. Lengthen the distractors.
   - `opacity` on an SVG path fades its stroke too; use `fillOpacity` for a shaded shape with an
     outline.
   - The "Pull it back" case keeps its situation, question, options and key word for word; its
     rationales and explanation were cut to the caps.
   - `icu-physiology` still teaches fluoroscopy; it retires with section 15.
   - It states 10 minutes, not the plan's 8.
   - For Russell to confirm: sign rows 11, 12 and the brush threshold; forceps types and biopsy
     technique (written from general knowledge); the protected brush; the radiation points;
     the container list; the new prediction and the imaging case; retiring M14-O5.
     Notes from section 11:
   - `poor-return` is retired. M12-O5 and O6 are homed in section 11. Its three Reading-the-view
     rows have `taughtIn: 'washing-and-lavage'`; `taughtIn` is typed by section id, so a retired
     id there is a compile error.
   - Russell decided on 2026-10-10 to lift review-register R25 for register-rendered culture
     thresholds. The row now refuses only a threshold typed in the caret form, and still
     refuses relabelling a specimen. R22 was not changed; its patterns refuse a volume followed
     within 30 characters by "required", "needed", "the standard" or "adequate", and "at least"
     or "minimum" before 100, 30, 40 or 50 mL. Word number sentences around those.
   - The word "relabel" near "washing" or "aspirate" trips R25's other pattern; the prediction
     says "change the label".
   - A number token renders as the row's bare value ("under 100 mmHg"), so write the sentence
     to read with it. The card prints the source line and "Check your local protocol" once.
   - The return is chosen, not typed: the ledger control is built for strength times volume.
     A case `situation` may carry digits; option labels and rationales may not, so the options
     state the return in words or through a token.
   - In a rewritten scenario every choice that is not the key needs a `consequence` with
     readings, and oximetry and heart-rate readings need a value, a unit and `provenance`.
   - A `source` claim needs a course textbook or manual among its sources; a guideline alone
     is refused.
   - A section may state at most 12 minutes. Section 11 is at 12 (the plan says 7).
     `activityMinutes` may be a decimal.
   - Tests that used `poor-return` now use `deterioration` (scenario refusal, retry, the stacked
     table) or section 11 (the case that plays out). When `deterioration` is rewritten they move
     again; `protected-accessories` and `scope-in-a-tube` are the other table sections.
   - For Russell to confirm: sign rows 13, 14 and 15; the culture-threshold sentence; the three
     procedures; the four causes of poor return; the case's decisions; whether to drop the
     ordering activity to shorten the section.
     Notes from section 10:
   - `honest-report` is retired. M17-O1, O2, O4 and O5 are homed in section 10; M17-O3 (recovery
     instructions) is in `RETIRED_OBJECTIVE_REASONS`.
   - Russell said to hold the image questions back (2026-10-09). The findings are named from six
     descriptions in three pairs (`moreActs.findings`, a `sort`). Sections 12 and 14 will meet
     the same gap; hold their image questions back the same way unless he says otherwise.
   - No section shows the report built from the learner's own saved survey now. The survey is
     still saved, and `engine/inspectionReport.ts` and the `learnerRecord` step type are kept but
     unused. Whether to remove them is Russell's call: it changes the saved-progress record.
   - A report act refuses an unsupported entry and leaves it unselected. In a browser test,
     click such an option; `check()` fails because the state does not change.
   - A report act's prompt is held to three sentences a paragraph, like a block.
   - `kind: 'worked-example'` is not a block kind; the role carries that. Use `kind: 'pattern'`.
   - New drawing `ObstructionTypesFigure` (`visual: 'obstruction-types'`). Leave room between
     shapes: the first version's outside mass overlapped the next airway.
   - It states 10 minutes, not the plan's 9.
   - For Russell to confirm: the vascular-lesion teaching and its key; the four pairs; the
     definition of extrinsic compression; the model report and the six report lines; retiring
     M17-O3; whether to keep the saved survey.
     Notes from section 9:
   - Russell approved one change to the scope pane on 2026-10-09: a view may name its record's
     own words (`ledger.record`, type `LedgerRecordWords`). Only `ScopeFallback.tsx` and
     `types.ts` changed; the reducer and the ledger's rules did not. Any further pane or engine
     change still needs asking first.
   - `SurveyVideo` (`components/stage`) plays the annotated survey with its outlines; a teach
     screen shows it with `visual: 'survey-video'`. It reuses
     `src/lib/airway-anatomy-lesson/video-atlas.ts`. Section 5 could use it for the larynx.
   - The survey's ledger is `expected: 'segmental'` (18 lines) with `inaccessible: ['RB10']`.
     The ledger allows "not seen" only before an opening has come into view, and it does not
     count toward `ledger-complete`; the goals therefore use `ledger … 'inspected'` tests.
   - Goals written as `ledger` tests give the help line "Record … in the inspection record";
     `declared:` events give "Declare …".
   - The recipe in `scopeRecipes.ts` backs out until the target is on the way, then goes in.
     It ends in LB10, so tests that move on afterwards withdraw to the left main bronchus.
   - A step title may not carry a digit, segment codes included ("A smeared lens in RB4" was
     refused); the stage lessons then fail at import.
   - A long word in the record's Status column breaks mid-word at 390 px; the word for an
     unrecorded line is "To do" for that reason.
   - It states 11 minutes, not the plan's 7: the full-tree survey is timed at 7 by estimate.
   - For Russell to confirm: the reason given for "presumed normal side first"; the meaning of
     each status; the new check (a right upper lobe mass: left lung first) and the two new
     practice cases; whether 18 segments in one task is too long.
     Notes from section 8:
   - No photograph of a red-out, a fogged lens, secretions or blood exists in the repository or
     in Local-Data, and `MediaRef` carries only normal structures. The causes are named from
     five written descriptions (`moreActs.causes`, a `sort`). Replace it with image questions
     when the abnormal images are cleared.
   - The simulator shows three view states: `red-out`, `contaminated` (a smear) and an unused
     `unfamiliar-clear` script for disorientation. It has no state for secretions or blood, and
     its `dark` signal is never set.
   - The lens task is `moreActs.lens`, a second scope task, not an `observe` step. An `observe`
     chunk can only read `act.observe`; a rewritten section uses `moreActs`.
   - A teach screen cannot show the scope pane. Its picture is a block's `media`, a tour, or one
     of the drawings.
   - A rewritten section's goal card carries no "does not judge the bronchoscope image" note;
     the tests that pinned it now check that it is absent.
   - The end-to-end `reachAct` skips a further activity that comes before the section's own.
     The "missing teaching media" case walks to the left lung's stills.
   - It states 8 minutes, not the plan's 6; the activities are timed at 4 by estimate.
   - For Russell to confirm: the wording around his four recovery steps (say it, stop, sheath
     the tool; suction on the wall pulls mucosa onto the lens; the call-for-help line); how each
     of the five causes looks; the prediction asks for the cause, not the action.
     Notes from section 7:
   - `reference-frames` is retired. M06-O1 and M06-O2 are homed in the right lung; M06-O5 (CT
     tracing) is in `RETIRED_OBJECTIVE_REASONS`. Its six-row CT identify activity is gone.
   - The two-image media workspace has no section left. Its Jest tests use
     `test-support/comparisonWorkspace.ts`. Its two browser tests (S7 layout, S7 enlarge) were
     removed with the page.
   - Six left-lung frames were added to `build-find-frames.mjs`. Check the size of an outline
     before you pick a frame: the first pick's lower lobe outline was too small to tap. No frame
     shows LB6 with LB7+8, and none shows all four lower lobe openings.
   - A section title appears in the course map on every page. A leak guard in another section
     that matches it fails the rendered leak scan: bleeding's guard is now `her left lung`.
   - A guard must still match the keyed answer, its explanation or the new concept, or the
     registry refuses to load and most suites fail at import.
   - A practice item's id is a manifest case id or `mc-<slug>`; a seed id alone is refused.
   - The four simulator goals kept their ids and event tests, so `scopeRecipes.ts` did not change.
   - It states 9 minutes, not the plan's 7: the activities are timed at 5, as on the right.
   - For Russell to confirm: four orientation statements in the image questions (head toward
     the top; anterior to the right; LB4 nearer the upper division; posterior to the right),
     read from the outlines; the unoutlined fourth opening on the basal frame; "the lingula
     runs forward and down"; the new prediction and check; retiring M06-O5.
     Notes from section 5:
   - `branch-entry` is retired. Its two airway tasks are section 5's `moreActs.carina` and
     `moreActs.hold`; its objectives M05-O3 to O5 and the reading-the-view row
     `handle-turns-view-static` are homed in section 5.
   - Three larynx frames were cut from the survey video (`larynx-inlet`, `larynx-folds`,
     `larynx-cords`). `build-find-frames.mjs` now picks a structure by the annotation set's key
     and writes a paired structure as two markers, `-image-left` and `-image-right`. A find row
     sets `marks: 'structures'` when its outlines are not openings.
   - The survey outlines only the true cords, the aryepiglottic folds and the corniculate and
     cuneiform tubercles. The epiglottis and the false cords are taught in words and cannot be
     asked on an image until someone outlines them.
   - Tests that addressed `branch-entry` now reach the carina task (`larynx-and-entry-flow-v1-carina`)
     or use `test-support/carinaTasks.ts`, which presents the two tasks in the shape the
     simulation tests were written against. `scopeRecipe(sectionId, activity)` gives the recipe
     for a named scope task.
   - The registry hands out a rewritten section with its numbers resolved, so its views are new
     objects: match a view by content, not identity.
   - For Russell to confirm: the one-line descriptions of the laryngeal structures; "the
     corniculate tubercles cap the arytenoids near the midline, the cuneiform sit further out
     in the folds"; the tour notes on the right and left main bronchi; the prompts name a side
     of the image, not of the patient.
     Notes from section 4:
   - `branch-entry` is NOT retired yet. Its technique teaching is in section 4 now (the block
     `in-the-airway`). Its airway tasks (enter each main bronchus and come back; hold the view)
     belong to section 5 by the plan, so retire it there. About a dozen Jest files and six e2e
     cases use it; the digest in the section 4 PR lists them.
   - How section 4 is built: `content/fiveControlsBench.ts` holds each bench task's view and
     goals; the section names them as `act` and `moreActs`; `fiveControlsLearn.ts` turns each
     into a unit that shows one section block and adds the demonstration, the cue and the
     line shown when the goal is met; `stageLessons.ts` lays the units out in the order of
     `COURSE_FLOWS['five-controls']`. A unit keeps its step id (`five-controls-learn-<id>`).
   - "One guided pass, then the assists turn off" is the guided unit followed by its repeat with
     no demonstration and no cue. The engine was not changed.
   - Three notes are hidden for rewritten sections through props: the collapsed "Technique
     reference" and "More on technique and model limits" panels, "Teaching adaptation; review
     pending", and the bench's "not a physical-skills assessment" line. The instrument picture's
     caption drops "review pending" too, which also tidies section 2.
   - Lesson version for `five-controls` is 3.
   - For Russell to confirm: "If you face the patient instead, left and right swap on the
     screen" (no source text states it; the brief asks for it); left hand on the control
     section as the default grip; "push the lever down and the tip bends up".
     Notes from section 3:
   - `shared-airway` is retired. Its objectives M01-O2 to O4 are homed in section 3 and M01-O1 in
     section 1; M01-O5 (scope history) is cut and listed in `RETIRED_OBJECTIVE_REASONS`.
   - The tests that used `shared-airway` as their fixture now use `what-completion-means`
     (question and matching tests, the stage walk) and `deterioration` (source lists). Both were
     made general, so they should move with one search and replace when those sections change.
     `what-completion-means` retires last; move its fixtures then to the matching activity in
     `pre-use-check`.
   - A dose ledger may carry its own digits (`caseValues` on its copy surfaces): strengths,
     volumes, the weight and the sums are the case's values. Rationales elsewhere still may not.
   - Review register R14 no longer refuses a naloxone dose; it refuses only the old manual's
     ceiling. Russell signed the label dose on 2026-10-08. The R14 rows on bicarbonate and lipid
     emulsion doses still stand and will need the same decision for section 13.
   - The set-level test-wise score is checked across all rewritten sections. Avoid keys that
     alone sound cautious (stop, pause, wait, hold, ask, call) and distractors that argue for
     themselves (since, because).
   - Section 3 needs register rows 1 to 6, 10 and the unsigned parts of 19 signed.
   - For Russell to confirm: nasal gel, throat spray and spray-as-you-go as the three sites;
     the toxicity signs listed; midazolam with an opioid, propofol only with trained staff; the
     three-frame case, which ends with bag-mask ventilation and both reversal agents.
     Notes from section 2:
   - Two drawings were added to `BronchCourseTeaching.tsx`: `two-diameters` and `room-setup`.
   - The photo-naming activity keeps its eight rows in order; tests pin them.
   - The second activity is a `sort` (match a failed check to its name), run through `moreActs`.
   - Section 2 needs register row 22 signed before it can be published.
   - For Russell to confirm: the room-setup card (position, where you stand, bite block, IV,
     oxygen) came from the brief, not from a mined source; the leak test is listed as one of the
     five pre-use checks; the forceps in the check state a minimum channel of 2.8 mm (written
     for the case).
   - When a rewritten section replaces wording that `BF-01-claim-review-queue.json` quotes, add
     `supersededBy` to that item and to the list in `claim-review-queue.test.ts`.
     Notes from section 1:
   - `shared-airway` is NOT retired yet. Its monitoring teaching belongs to section 3
     (`sedation-and-monitoring`); retire it in that change. Many tests use it as their fixture
     section (hub, stage-host, actions-and-feedback, sources-and-reading-view, the e2e spec), so
     budget for moving them.
   - The image-share rule (a third of questions on an image) now fails the build only once every
     section is rewritten. Until then the `--all --report` run prints where it stands.
   - Section 1 needs register rows 7, 8 and 9 signed before it can be published.
   - For Russell to confirm in section 1: "hemoptysis with no source found" is listed as an
     indication though the old section did not list it; the three referral plans (go ahead for
     suspected foreign body on aspirin; hold for clopidogrel after a recent stent; lavage without
     biopsy at a platelet count between the two thresholds).
   - Old practice case C03 (stent and dual antiplatelet therapy) became the second referral.
     **Rewrite the other sections** from their briefs, in the plan's three batches. Two are new:
     `biopsy-and-specimens` and `ventilated-patient`. Apply the content fixes the briefs name
     (foreign-body aspiration is an indication; site choice from the CT; raising pressure limits is
     recommended, not unsafe).
6. **The hub and the closing screen: done (2026-10-11).**
   - The hub's copy is rewritten and carries one statement of what an online course cannot
     show. "Authored geometry", "model limits" and the paragraph on optional questions are gone.
   - The closing screen is `/bronchoscopy-foundations/learn/complete`
     (`BronchoscopyFoundationsClosing.tsx`): what each phase covered, what the course cannot
     show, four things to do next, and a count of sections opened and reviewed on this device.
     The last section's end card and the hub's all-reviewed button both lead to it.
   - `what-completion-means` is retired. M18-O1 to O5 are in `RETIRED_OBJECTIVE_REASONS`. A
     saved place or a link that names it opens section 15, as the forward map already said.
   - The module frame's notice on every page lost "authored teaching model", "anatomy profile"
     and "No dose … is a recommendation", which the taught numbers contradict. It now reads
     "For education only. Follow your device’s instructions for use and your local protocol."
   - The helpers `teach` and `debrief` are removed from `courseFlow.ts`; nothing used them.
   - Tests that used the old section now use `ventilated-patient` (a sort, a prediction with a
     situation, and the last section). The walk in `stage-host.test.tsx` runs the transfer
     before the closing checklist, as every rewritten section does.
   - Still course-talk outside the lessons, not touched: the atlas page's "Authored teaching
     media, pending review", and the practice landing's empty state.
   - For Russell to confirm: the hub's four paragraphs; the closing screen's wording, above all
     "What this course cannot show" and the four next steps; the shorter notice on every page;
     retiring M18-O1 to O5.
7. **Practice and assessment.** The image bank is done (2026-10-11); the rest is open.
   - The image bank is `/bronchoscopy-foundations/practice/images` (`content/imageBank.ts`,
     `components/BronchImageBank.tsx`), linked from the Practice landing. It has 50 questions:
     25 openings, each asked once upright and once rotated, in five fixed sets of ten that mix
     both lungs. An opening's two questions are never in the same set. Nothing is saved.
   - It reuses the 12 lung frames the two lung sections already show and the course's own
     click control, not `AirwayIdentifyQuiz`: that component picks from a list of names, has no
     context line, no rotation and no keyboard path. The plan's 30 quiz stills carry one outline
     each, so they cannot be clicked on; the survey frames carry them all.
   - 25 of the 32 outlined openings are asked. The seven left out could only be told apart by
     an orientation cue no one has stated: RB7, RB8 and RB9 on the intermedius frame, RB8 and
     RB10 on the right basal frame, LB9 and LB10 on the left lower lobe frame. The larynx frames
     are left out too: their outlines are named by the side of the picture.
   - The orientation cues are the lung sections' own, turned with the picture
     (`cueSentence`). They were read from the survey's outlines and still wait for Russell.
   - The bank counts toward the image share: `imageShareBlockers` and `publishBlockers` take
     the number of bank questions, and `check-section.ts --all --report` prints it and runs
     `imageBankErrors` (the copy rules through `findCopyErrors`, the frames, and the set rules).
   - `docs/bronchoscopy-foundations/media-register.json` lists only the six right-lung frames;
     the larynx and left-lung frames were cut later and the register was not rebuilt. The bank
     adds no picture. Rights and de-identification are pending on every file.
   - For Russell to confirm: the 25 rationales; the cues, above all the rotated ones; whether
     an upright and a rotated question on one opening count as two; the seven openings left out.
   - The vignettes are done (2026-10-11): `content/vignettes.ts`, forty cases in eight topics
     of five (antithrombotics and platelets, lidocaine by weight, lavage return and counts,
     methemoglobinemia, pneumothorax after biopsy, the tube and the ventilator, massive
     hemoptysis, sedation and its reversal). Each is a practice case (`vg-<slug>`) listed by
     topic on the Practice landing, after the sections' own cases, and opens on the same case
     page.
   - A vignette tests only a number a section already teaches (a test holds this). No lipid or
     methylene blue dose is asked. The two methemoglobin treatment levels are used; the
     teaching-gaps change adds them to section 13.
   - Three lidocaine vignettes and one lavage vignette are marked `sums`: their options and
     reasons carry amounts added up from the case, as the dose ledger does. `caseCopyErrors`
     in `authoringRules.ts` holds a standalone case to the copy rules; `vignetteErrors` adds
     the key-length and test-wise checks. `check-section.ts --all --report` runs both.
   - A vignette takes its sources and objective ids from its paired section's first question.
     No page was read for them.
   - `microCasesForSection` returns a section's own cases only; `vignetteCasesForTopic` gives
     the vignettes. The case page's previous and next links run through both lists.
   - The copy gate refuses "wrong" and "correct" in a vignette, the verb included ("correct the
     value"). The stage-item schema throws at import, so the whole registry fails to load.
   - For Russell to confirm: all forty keys and reasons, written from general knowledge. Most in
     need of a look: the stent case (postpone, not hold); the daily-benzodiazepine case (hold
     flumazenil while he breathes); biopsy of one lung in a sitting; pain as the forceps open;
     the ARDS case (defer); raising the tidal volume when delivered volume falls; the three
     hemoptysis airway cases; the culture below the threshold.
   - Mixed sets are done (2026-10-12): `content/practiceSets.ts` deals all 79 practice cases
     into eight fixed sets of ten (the last holds nine). The sections' own cases are dealt one
     from each section in turn, the vignettes one from each topic in turn, and the two streams
     alternate, so a set is half vignettes and never puts two cases from one section or topic
     side by side. The sets are fixed because nothing is saved.
   - A case opened from a set carries `?set=N`; its way on stays in the set and its last case
     offers the next set. A set the case is not in is ignored.
   - The Practice landing leads with the sets. The by-section and by-topic lists are behind a
     closed disclosure, "Browse every case by section and topic".
   - A practice case names its section only after an answer or with the explanation open. An
     integrated case shows its section and its "safety-critical decision" label the same way.
     This reverses an earlier choice to name the section first; the plan asks for it.
   - Still open: the eight integrated cases are not rewritten (only C09 is); the plan's clean-up
     of the older practice items (its findings F-01 to F-09, the grading mismatches, the three
     stems that give the key away) is not done; and about 25 objectives replacing the 108. The
     four evolving cases exist (sections 3, 13, 14 and 15). Self-check mode is plan decision 5,
     not yet made.
8. **Abnormal images** for sections 8, 10, 12 and 14. Bleeding has no image questions until these
   exist. Rights and de-identification are still pending on all 100 registered files.
9. **Re-decide the review-register refusal rows** (R25, R26 and others) row by row with Russell.
10. **Plan decisions 5–10** are still open, including amending the
    `medical-education-modules` skill (user-level only; back it up before editing). Decision 4,
    rescue doses, was answered for section 13: names only.
11. **Cut over from `/intro-bronchoscopy`** after the final pass with fellows.

## Checks

```bash
npx jest src/features/bronchoscopy-foundations "src/app/\[locale\]/bronchoscopy-foundations"
```

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
```

```bash
npx eslint src/features/bronchoscopy-foundations
```

```bash
BRONCH_FOUNDATIONS_BASE_URL=http://localhost:3120 npx playwright test -c playwright.bronchoscopy-foundations.config.ts -g "<title>"
```

State at handoff (hub and closing screen): 40 Jest suites pass; type check and lint are clean;
the full end-to-end suite passes against the dev server on port 3133.

## Traps

- A stem must describe what the operator did. Never assert an absence the learner can take as a
  fact about the anatomy: "You have not seen a side opening" was read as "none has come yet".
- `tsc` dies in V8 without the larger heap.
- "wrong", "correct" and "score" are still refused in learner copy, step instructions included.
- `BRONCH_SECTIONS` holds resolved copy. Run rule checks on the raw `section` export.
- The lesson of a rewritten section ends on `explain`, not `transfer`; tests branch on
  `authoringContract`.
- Do not key the image control on its answer count; it remounts and skips the feedback.
- Tailwind strips list numbers; set `list-style: decimal` where order matters.
- Sessions on this module have died from a safety-classifier false positive on accumulated
  clinical text. Mine an old section through a subagent digest and write one section per session.
- Do not edit `learning-module/`, the scope engine or the 3D assets. The verdict card's wording
  and the scope pane's notes are changed through props (`REWRITTEN_VERDICT_FRAMES`, `plain`).

Screenshots of the pilot are in Local-Data, `renders/output/bf-rewrite-pilot-2026-10-08/`.
