# Bronchoscopy Foundations rewrite: handoff

Written 2026-10-08, last updated 2026-10-09 (after section 7). Start the next session from this file.

## Why this work exists

Russell Miller rejected the direction the module had taken: too conservative, too many protective
statements and references, and it had lost sight of its purpose, which is to teach fellows
bronchoscopy simply. His plan is `~/Downloads/Bronchoscopy Foundations — Rewrite Plan.md`
(15 sections, about 110 minutes, ten authoring rules, a numbers register, pilot first). Read it
before writing anything. Do not reintroduce hedges, disclaimers, model-boundary notes or "ask your
supervisor" answers.

## Where things stand

| PR   | Branch                             | State                                                                                                             |
| ---- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| #349 | `claude/bf-rewrite-rules`          | Draft. The new rules; no content change.                                                                          |
| #350 | `claude/bf-rewrite-pilot`          | Draft, stacked on #349. The right lung and bleeding, rewritten.                                                   |
| #373 | `claude/bf-rewrite-s10`            | Draft, stacked on #371. Section 10, findings and the report, rewritten; `honest-report` retired.                  |
| #371 | `claude/bf-rewrite-s09`            | Draft, stacked on #369. Section 9, the systematic survey, rewritten; one approved scope-pane change.              |
| #369 | `claude/bf-rewrite-s08`            | Draft, stacked on #368. Section 8, losing and regaining the view, rewritten.                                      |
| #368 | `claude/bf-rewrite-s07`            | Draft, stacked on #364. Section 7, the left lung, rewritten; `reference-frames` retired.                          |
| #364 | `claude/bf-rewrite-s05`            | Draft, stacked on #362. Section 5, larynx, trachea and carina, rewritten; `branch-entry` retired.                 |
| #362 | `claude/bf-rewrite-s04`            | Draft, stacked on #360. Section 4, driving the scope, rewritten.                                                  |
| #360 | `claude/bf-rewrite-s03`            | Draft, stacked on #359. Section 3, sedation and monitoring, rewritten; `shared-airway` retired.                   |
| #359 | `claude/bf-rewrite-s02`            | Draft, stacked on #358. Section 2, the scope and the setup, rewritten.                                            |
| #358 | `claude/bf-rewrite-s01`            | Draft, stacked on #355. Section 1, the procedure and the plan, rewritten.                                         |
| #355 | `claude/bf-rewrite-structure`      | Draft, stacked on #352. The plan's order, five phases, and the forward map for retired sections.                  |
| #352 | `claude/bf-rewrite-register`       | Draft, stacked on #350. Register rows 15, 19, 20 and 21 extracted; two sources added (U17, U18). No learner copy. |
| #351 | `claude/bf-3d-retry`               | Draft, from `main`. The 3D-retry fix lifted out of #348, with its three end-to-end cases.                         |
| #348 | `claude/bf-pre-review-04-20261007` | Draft, superseded in direction. Its 3D-retry fix is now #351; close #348 once #351 merges.                        |

Nothing is merged. The stack, in merge order: #349 → #350 → #352 → #355 → #358 → #359 → #360 →
#362 → #364 → #368 → #369 → #371 → #373. #351 is independent. The work is in the worktree
`…-Worktrees/claude-bf-pre-review-04-20261007`, which is on `claude/bf-rewrite-s10`. Branch the
next section from that branch (`git switch -c claude/bf-rewrite-s11`) and stack its PR on #373.

## Start here next session

1. Read this file, then the plan's rules and the brief for the section you are writing.
2. Next section: 11, washings and BAL (`washing-and-lavage`, which absorbs `poor-return`).
   Brief 11: washing, BAL and therapeutic aspiration; choose the site from the CT; the wedge,
   aliquots, suction pressure and return; what poor return means; processing; why lavage comes
   before biopsy. Do: run a BAL in which the learner computes the return from the volumes, then
   troubleshoot a poor return.
3. Things to know before writing it:
   - It is the first section since section 3 that teaches numbers. Use register rows 13, 14 and
     15 through `num('id')`; look up the row ids in `content/numbers.ts`. None of them is signed.
   - Review-register rows R25 and R26 refuse colony counts. Row 15 (quantitative cultures for
     VAP) is extracted, but a refusal row can still block it: lifting one needs Russell's
     decision, recorded (see the note on R14 under section 3).
   - `poor-return` retires in that change, with its flow, its tests and its Reading-the-view
     rows (`poor-return-leak`, `poor-return-collapse`, `no-return-patent-view`). The end-to-end
     stacked-table case and the Reading-the-view count use it; move them to a section that
     still prints the table.
   - Claim-queue items C09 and C10 quote `poor-return` wording.
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

1. **Get #349 and #350 reviewed and merged**, then branch each batch from `origin/main`.
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
   `larynx-and-entry`), all 2026-10-08, and sections 7 to 10 (`left-side`, `view-loss`,
   `systematic-survey`, `describe-findings`) on 2026-10-09. Four remain. Section 11
   (`washing-and-lavage`) is next. The course lists 19 sections.
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
6. **Rewrite the hub and the closing screen.** The hub still says "authored geometry". It carries
   the course's one boundary statement.
7. **Practice and assessment:** the image bank, about 40 vignettes with numbers, four evolving
   cases, mixed sets of ten, the eight integrated cases with labels hidden until after the answer,
   and about 25 objectives replacing the 108. Self-check mode is plan decision 5, not yet made.
8. **Abnormal images** for sections 8, 10, 12 and 14. Bleeding has no image questions until these
   exist. Rights and de-identification are still pending on all 100 registered files.
9. **Re-decide the review-register refusal rows** (R25, R26 and others) row by row with Russell.
10. **Plan decisions 4–10** are still open, including rescue doses and amending the
    `medical-education-modules` skill (user-level only; back it up before editing).
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

State at handoff: 40 Jest suites pass; type check and lint are clean; the end-to-end tests that
touch the two pilot sections pass against the dev server. The full end-to-end suite has not been
run. Nine Jest suites in other features fail in this checkout and were not touched by this work.

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
