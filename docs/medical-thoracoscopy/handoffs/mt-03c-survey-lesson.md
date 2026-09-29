# Handoff — MT-03c survey lesson

| Field               | Value                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Slice               | 12 of the first build round; work package MT-03                                                                            |
| Branch              | `claude/mt-03c-survey-lesson`                                                                                              |
| Base                | `origin/main` `4f9329f3ed8fe985283ab1cf81d59040f13e995e` (main has not moved since slice 9)                                |
| Prerequisite slices | `claude/mt-03b-space-scene` at `6228c283` (which carries slices A, B and 1 to 11), merged as the first commit (`9a148051`) |
| Final head          | The commit that adds this file: `git log -1 --format=%H -- docs/medical-thoracoscopy/handoffs/mt-03c-survey-lesson.md`     |
| Owner decision      | OD-08; the approved first-round plan, sections 4.2 and 5 (row 12)                                                          |
| Date                | 2026-09-29                                                                                                                 |

## Why

Sections 6, 7 and 11 were written in slice 6 and waited for a lesson to show them. This slice builds
the lesson host and opens the three sections: a learner can now go from the hub's one door into
"A normal hemithorax from inside", take the tour of the regions, learn the pivot by aiming at them,
and survey the space in order, noting each region and comparing the note with the model's estimate.

## What changed

| Path                                                                                                                                           | Change                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/medical-thoracoscopy/components/lesson/{SectionLesson,LessonActivities,QuestionView}.tsx`, `lessonWords.ts`, `lesson.module.css` | New. The lesson host: the parts in document flow, the course bar, the finish, the optional questions, the tour, the pivot and the survey                    |
| `src/features/medical-thoracoscopy/content/lessonParts.ts`, `engine/stageSession.ts`                                                           | New. The parts in each section's order; the lesson session, a pure reducer                                                                                  |
| `src/features/medical-thoracoscopy/engine/space/{exampleStarts,tourStops}.ts`                                                                  | New. The teaching example's values for the engine; the tour's stops, used only for their own snapshot                                                       |
| `scripts/medical-thoracoscopy/build-tour-stops.ts`, `content/data/anatomy/tour-stops.json`                                                     | New. The tour's stops, computed by the engine from the proxies; numbers only                                                                                |
| `src/features/medical-thoracoscopy/components/space/useSpaceEngine.ts`                                                                         | `restart`: the engine started afresh at a labelled state, never a simulated action                                                                          |
| `src/features/medical-thoracoscopy/content/curriculum.ts`                                                                                      | Sections 6, 7 and 11 available                                                                                                                              |
| `src/app/[locale]/medical-thoracoscopy/learn/page.tsx`                                                                                         | An available section opens as its lesson; anything else is the landing, as before                                                                           |
| `src/features/medical-thoracoscopy/content/anatomy.ts`                                                                                         | The tour-stops record's schema                                                                                                                              |
| `docs/medical-thoracoscopy/registers/{asset-ledger,traceability}.json`                                                                         | The pleural-space scene's row (its files, cold download and decoded size; what it draws not measured); the three sections' lessons, assets and tests        |
| `src/features/medical-thoracoscopy/test-support/spaceScenes.ts`                                                                                | A nine-step analytic lung for the lesson's tests                                                                                                            |
| Tests                                                                                                                                          | New: `sectionLesson.test.tsx`, `stageSession.test.ts`; the curriculum, resolver, progress, hub, routes, registers and engine tests follow the open sections |
| `docs/medical-thoracoscopy/README.md`                                                                                                          | "Written sections": the three open, and the lesson host                                                                                                     |

## How the lesson is built

- **Document flow, one part at a time.** A section is a list of parts in the order its question sets
  (`lessonParts`): the orientation and the teaching example first, then, for a prediction, the
  blocks placed before the question, the question, and the teaching that answers it; for a retrieval,
  the teaching and then the question; the transfer last. Continue reveals the next part; the outline
  opens any part at any time (the spec's rule), and Back returns. A part with work to do offers
  "Move on without doing this" instead of Continue, and is recorded as moved past, never as done.
- **Three kinds of action, visibly apart** (learning contract): the course (the outline, the course
  bar, finishing), the teaching example (its own panel, dashed and labelled, with "Put the space back
  as the example has it"), and the scope controls in the space pane's dock. The session keeps
  navigation, answers and activity as separate actions; the engine keeps its simulated actions, and
  loading an example or a tour stop restarts it, which is not one of them.
- **What counts as done** is only the learner's own work: a question checked; the tour's every stop
  named or asked about; the pivot's every target in view after the learner moved the telescope,
  which the engine decides, not the lesson; the survey's note complete and compared.
- **Nothing is kept but the course's place**: opening a section records the place and the visit;
  "Mark this section reviewed" records the mark, and "Take the mark back" removes it. No answer, note
  or simulator state is stored. If the browser will not save, or the saved value cannot be read, the
  lesson says so plainly, works all the same, and leaves the value as it was.
- **The optional questions**: the explanation can be read first, any answer changed and checked
  again, and, once checked, why each other choice does or does not fit can be read. The words for a
  checked choice follow its authored kind (it fits; it is reasonable and leaves something out; it
  does not match how it works; it would be unsafe). The copy gate refused "best" (promotional) and
  "wrong"; neither is used.
- **Every section says, at its head, that its clinical statements have not been clinically reviewed**
  (T11's default) and lists what the learner sees with its fidelity label.
- **The tour** (section 6) moves the telescope to each region's stop: the position, among those the
  port allows with the lung fallen away, that shows the most of the region with nothing in the way,
  computed offline by the engine (`build-tour-stops.ts`). Each stop asks what tells the learner where
  they are before the region's name appears. The mediastinum's stop shows one sample of it (slice 10's
  finding); the lesson shows the model's view as it is.
- **The pivot** (section 7): the learner first says which way the hand will go (a choice, named apart
  from the dock's buttons, which move the telescope), then aims with the controls; the target is
  reached when the engine puts its region in view after a move of theirs, and the explanation of
  hand and tip follows.
- **The survey** (section 11): the learner notes each region in order, seen, partly seen or not
  seen, and why, and compares the note with the model's estimate once every region is noted.

## Claims and assets touched

No claim was added or reworded. The claims of the three sections are now shown to learners in the
unlisted preview, under the not-reviewed notice (T11); every decision stays NOT REVIEWED and
publication stays blocked. The asset ledger gains the pleural-space scene's row, and the traceability
register links the three sections to the lesson, the scene's files and the new tests.

## Checks run

| Command or check                                                                                                                                                                                                  | Result                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx jest src/features/medical-thoracoscopy "src/app/[locale]/medical-thoracoscopy"`                                                                                                                              | 24 suites, 362 tests, all passing: 26 new for the lesson and its session, 2 for the tour's stops, the rest following the open sections                                                |
| The lesson's tests with four faults planted, one at a time: moving past counts as done; a pivot target reached without a move; a section marked reviewed on opening; the survey compared with its note unfinished | The first three caught (the second only after a test was added with the target in view from the start); the fourth led to the rule moving into the session, where a test now holds it |
| `npx tsx scripts/medical-thoracoscopy/build-tour-stops.ts`                                                                                                                                                        | Seven stops, each clear and with its region in view on the real proxies (tested)                                                                                                      |
| `npx tsx scripts/medical-thoracoscopy/render-registers.ts`                                                                                                                                                        | The printed register pages unchanged                                                                                                                                                  |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .`; `npx eslint src/features/medical-thoracoscopy "src/app/[locale]/medical-thoracoscopy"`; `npx prettier --check`; `git diff --check`                | Clean                                                                                                                                                                                 |

## Real browser observations

On the dev server (`claude-thoracoscopy`, port 3134), driven through the page (the Browser pane was
often hidden, so no screenshot was relied on for a result):

- **A fresh learner**: the hub's one door reads "Start: A normal hemithorax from inside", section 6 of
  19, and opens it; the record then holds the place and the visit, nothing else.
- **Section 6**: Continue reveals the parts in order; the outline opened the question far ahead; the
  explanation opened before any answer; the tour's first stop put the diaphragm and the recess in
  view, and naming the recess there showed the diaphragm's name, what was named, and what to notice.
- **Section 7**: after choosing "toward the head", twelve presses of the hand toward the head brought
  the diaphragm into view and the explanation of hand and tip followed.
- **Section 11**, by a deep link: opened fresh at its orientation; the survey's note, every region
  filled in, compared with the model's estimate row by row; nothing of the note stored.
- **A saved value that cannot be read**: the lesson said it is not saving, worked, and left the value
  exactly as it was.

## Checks not run

- **Keyboard-only and touch journeys with a visible page, reduced motion, WebGL unavailable, a missing
  asset, a decoder error, context loss, the three layouts, 200 % zoom and 320 px reflow**: the Playwright
  evidence of slice 14. jsdom covers the cut, the not-saving path and jest-axe on every part of all
  three sections.
- **A reader's review of the lesson's own words**: they are the author's, checked only by the copy gate.

## Unresolved decisions

- **What the survey can see** (MT-C-0002, slice 10): with the lung as it is, a learner will note most
  regions partly seen, hidden by the lung, and the mediastinum barely seen; the tour's mediastinum
  stop shows little of it.
- **T9, finishing**: built as the default (mark reviewed, with undo; leave without marking).
- **T11**: clinical statements shown under the not-reviewed notice, as the default says.
- Everything open after slice 11 stays open.

## What must not happen next

- Do not count navigation, a loaded example or a tour stop as the learner's work.
- Do not decide in the lesson what is in view: the engine does.
- Do not store an answer, the survey's note or the simulator's state.
- Do not open a section in preparation, or mark it reviewed.

## Repair after the independent review (2026-09-29): OD-11, R4, OD-16

- **OD-11.** Every lesson already starts from the loaded "space-made" teaching example, with the lung
  at its last step; no lesson lets the learner drive the lung. That is now the owner's decision, and
  the lesson says it: with the teaching example and above the space in each activity, "The lung here
  is an authored teaching state, loaded with the space: not the lung's response to anything you did,
  and not yet clinically reviewed." Gate criterion 9 stays partial: the lung's change is shown only
  on the space prototype, as an authored sequence.
- **R4.** `tour-stops.json` was rebuilt for the fuller snapshot
  (`npx tsx scripts/medical-thoracoscopy/build-tour-stops.ts`, 9 s): the same stops, only the
  identity changed. It is listed in the ledger's `bundledRecords`.
- **OD-16.** The model's ledger may now say a region is seen as far as this model reaches; the
  learner's own note keeps the three states section 11 teaches (seen, partly seen, not seen), and the
  comparison shows the two side by side. The section's text is unchanged.

This does not change publication status or constitute clinical approval.
