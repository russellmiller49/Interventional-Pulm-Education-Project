# EBUS-PRE-REVIEW-04 — clearer teaching without exam conversion: handoff

**Batch scope:** lane 04 of the EBUS fellow-walkthrough package — the course map, navigation
language, first-use definitions, activity titles, hints, guided-practice framing, learner-facing
status strings, source-bound diagrams and literal duplication. **This is a clarity pass, not an
assessment redesign or a clinical-content pass.** No question key, question id, activity id,
accepted action, gate, threshold, geometry, stored field or progress schema changed. No teaching,
limit, safety statement, hint, reveal or explanation was hidden. Prompts 05 and 06 were not started.

The walkthrough this batch answers is Claude in a first-year-fellow persona, not a fellow and not a
faculty reviewer. **No merge, deployment, clinical approval or owner decision is claimed.**

## Repository reconciliation

| Field                   | Value                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Smoke-tested main       | `745146f6e40bd536c201313f0480ddde2ee03ca3` (post-merge EBUS-03 smoke: PASS)                                                                                                                                                                                                                                                                  |
| Implementation baseline | `d98bab79af9231eb1857e2da96cb75ca2068d85c` = `origin/main` at start (2026-09-22). `745146f6` is its ancestor; Prompt 03's head `95ddc0d8` and its sanity repair `98a67907` are in its ancestry                                                                                                                                               |
| Intervening changes     | `745146f6..d98bab79` is PR #254 (Bronchoscopy Foundations) plus a `claude-bf` entry in `.claude/launch.json`. No EBUS or shared learning-module file is touched. Integrated by starting from current main                                                                                                                                    |
| Current main at PR time | `bf613270a37a30cfd31a915a33758b808dfbff89` (PR #259, mechanical ventilation). `d98bab79` is its ancestor; the eight commits since touch only `src/features/mechanical-ventilation/**` and an MV handoff — no EBUS, shared learning-module or launch file. The branch was not rebased; it merges without overlap                              |
| Checkout                | `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/claude-ebus-teaching-9-22`, a new worktree made for this batch (no other process or session used it)                                                                                                                                                                  |
| Branch                  | `claude/ebus-teaching-clarity-9-22` (the suggested name was free locally and on origin)                                                                                                                                                                                                                                                      |
| Code head               | `321d5338` (implementation `d12a6db0`, then one follow-up). The handoff/status/copy-table commit follows it and is the PR head                                                                                                                                                                                                               |
| Ports and profiles      | production standalone on 3137 (this worktree) and 3138 (a throwaway detached baseline checkout at `d98bab79` in the session scratchpad, built only to classify one e2e failure); disposable Playwright contexts and the desktop app's browser pane on a fresh `127.0.0.1` origin; synthetic learner state only                               |
| Instructions read       | `CLAUDE.md`, `AGENTS.md`; the standalone `EBUS_MODULE_HANDOFF_2026-09-21.md` (execution status); package `04_EBUS_TEACHING_CLARITY.md`, `OWNER_DECISIONS.md`, `PI_EBUS_COORDINATION.md`, `SOURCE_CONTEXT.md`, `FEEDBACK_LEDGER.md/.json`; the original DOCX for the lane-04 rows; the Prompt 01, 02 and 03 handoffs and the 03 sanity review |

## Where the teaching lives (traced)

- **Curriculum registry:** `CHAPTERS` in `src/features/ebus-guided/content/curriculum.ts` — **7
  chapters, 26 lessons** (confirmed; the package's numbers still hold). It remains the only order.
- **Activity flows and titles:** `ACTIVITY_FLOWS` in `content/stage.ts`. Activity ids are
  `<lesson>:<spec id>`; titles are display only.
- **Lesson content:** `content/{prepare,optimize,locate,plan,sample,complete,models}.ts` and the
  lesson-4 object in `curriculum.ts`. Questions are built by `question()`, which sets
  `explanation` to the keyed rationale.
- **Host:** `components/LessonHost.tsx` (eyebrow, instruction, evidence pane, hint, finish card,
  Help), `CoursePage.tsx` (Overview and Learn map), `ExaminationWorkspace.tsx`, `PracticePage.tsx`,
  `SequenceActivity.tsx`, `Diagram.tsx`.
- **Embedded app:** `EBUS-course/apps/web/src/guided/**` (model workbench, linked models, image
  discovery), built into `public/socal-ebus-course/app` by the production build.
- **Shared contracts:** `src/lib/ebus-linked-contract.ts` (landmarks, names),
  `src/lib/ebus-model-contract.ts` (model reducer, notices; notices are excluded from
  `modelFrameId`).

## Source-ID dispositions (lane 04, plus L5-1)

"Implemented" = runtime change observed on the production build. "Adapted" = the governing policy
or a source limit changed the suggestion; what was done is stated. Copy for every row is in
`EBUS-PRE-REVIEW-04-copy-table.md` (C/T/P/H/E/F rows = runtime; Q rows = held).

| ID        | Disposition                                       | What was done / why                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OV-1**  | Implemented                                       | The five-phase schematic is gone from the Overview; "The course in 7 chapters" summarizes `CHAPTERS` with links to each chapter card and per-chapter reviewed counts (C1). No second registry, no phase-to-lesson mapping                                                                                                                                                                                                                                                         |
| **OV-2**  | Implemented                                       | "Authored schematic · Select a label to locate it." is gone with that figure; the remaining schematics say "A schematic drawn for this course, not to scale and not a patient image. Select a name to mark it on the drawing." and selecting a name does mark it (C3)                                                                                                                                                                                                             |
| **NAV-1** | Implemented (language only)                       | Learn intro, a marks legend on Overview and Learn, and the finish card now say reviewed means reaching the end, whether tasks were completed, skipped or only read (C6–C8). The self-paced record, "Unmark as reviewed", draft compatibility, continue/skip and ungraded navigation are unchanged. No attempted/skipped status was added                                                                                                                                          |
| **NAV-3** | Implemented; gaps held                            | Ten-term glossary from course sentences only (`content/glossary.ts`), at first use in eight lessons, under Help in every lesson and on the Overview (H6). Terms the course does not define (central hilar structure — the ledger's "CHS" — and TNM, IASLC, NSCLC, PET, IFU, FNA, ERS/ESGE/ESTS, CHEST expansions) are **not** defined → Q4                                                                                                                                        |
| **L1-2**  | Implemented                                       | Lesson 1 briefing has no figure (C2)                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **L1-3**  | Implemented, with a limit                         | The recall links three existing refreshers that open without an account, in new tabs, labelled with the destinations' own titles (C11). No EBUS-local primer exists; none was invented (Q14). The airway-anatomy modules under `/intro-bronchoscopy` and `/learn/anatomy/airway` return 404 to an anonymous visitor on the production build (draft-guarded) and were not linked; `/tnm-9-staging` requires sign-in and was not linked                                             |
| **L1-4**  | Implemented                                       | Examination record, nodal station and N category (with "Full teaching: Lesson 17") appear beside lesson 1's teaching; the examination-record note itself is unchanged                                                                                                                                                                                                                                                                                                             |
| **L1-9**  | Implemented                                       | Lesson-1 checks carry a quoted passage from lesson 1's own paragraphs as their hint, in place of the CT prerequisite (H1, H2). Other lessons keep recall + checklist                                                                                                                                                                                                                                                                                                              |
| **L1-10** | Adapted                                           | Key points stay visible. The transfer is labelled "Guided practice · new situation" with a stated purpose (T7, P1). No commit boundary                                                                                                                                                                                                                                                                                                                                            |
| **L1-11** | Implemented                                       | "Histology from one station…" → "A result from one station…" (H3). The stem says aspirate and the item's other option says cytology; the claim is unchanged; key `b` unchanged                                                                                                                                                                                                                                                                                                    |
| **L2-6**  | Adapted; stem held                                | Guided-practice framing (P1). A stem that does not name the problem is a question rewrite → Q6                                                                                                                                                                                                                                                                                                                                                                                    |
| **L2-8**  | Implemented                                       | Lesson 2 briefing has no figure (C2)                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **L3-10** | Implemented (display only)                        | `STRUCTURE_DISPLAY_NAMES` + `structureDisplayName()`; all four label consumers use it (E10). Ids including `azygous` unchanged in meshes, label volume, `LINKED_LANDMARKS` and stored observations                                                                                                                                                                                                                                                                                |
| **L4-5**  | Implemented                                       | Recall recombines lesson 3's own sentence about tip flexion and advancement and names the activity's control (H4). No new mechanism                                                                                                                                                                                                                                                                                                                                               |
| **L4-6**  | Adapted                                           | Held review and transfer labelled guided with purposes (P1, P2); key points visible                                                                                                                                                                                                                                                                                                                                                                                               |
| **L5-2**  | Implemented                                       | One statement of what counts, beside the demonstration (E1); embedded kicker and step list say "not recorded" in the demonstration and "Steps this activity asks for" in the learner's activity (E2, E3). No score, persistence or attempt history. Demonstration observations are still dropped by the host                                                                                                                                                                      |
| **L5-4**  | Preserved intentionally, with a caption           | Measured on the production build (default view, 475×356 panel): air gap ↔ direct 2.8 % of pixels differ, gap ↔ balloon 1.0 %, direct ↔ balloon 2.8 %; **direct ≡ reflector (0 px) and balloon ≡ bubble (0 px)**; zooming in did not separate them. The panel teaches the transducer/wall/balloon arrangement, so it was not removed; geometry was not changed. A caption now says it distinguishes gap/direct/balloon and that the bubble and reflector are in the echo schematic |
| **L6-3**  | Adapted                                           | The worked setting stays in the instruction; the acquisition says it is guided and that the numbers belong to the teaching library (P3). The requirement list still states the range (a genuine acquisition criterion from Prompt 02)                                                                                                                                                                                                                                             |
| **L10-3** | Adapted                                           | The capture record's limitation stays before the check (R); the review is labelled guided (P2)                                                                                                                                                                                                                                                                                                                                                                                    |
| **L10-4** | Implemented                                       | "Recorded example Depth4_Gain_4" → "Recorded teaching example at 4 cm depth, gain example 4 of 8" from the frame's own example description (E5). The embedded workbench's provenance caption ("clip Depth4_Gain_3, … of Depth4.mp4") is Prompt 02's deliberate provenance line and was left                                                                                                                                                                                       |
| **L12-2** | Adapted; stem held                                | Purpose states the check is approach versus station and that the stem names the compartment (P4); stem rewrite → Q6                                                                                                                                                                                                                                                                                                                                                               |
| **L12-7** | Adapted; consolidation proposed                   | Two-approach acquisition and changed-window repeat each say why they repeat (P5, P6); times labelled estimates (C9). Task ids, evidence and gates unchanged. Consolidation → proposal below (Q13)                                                                                                                                                                                                                                                                                 |
| **L13-5** | Adapted                                           | Same as L12-7 for the changed right paratracheal position (P6)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **L15-3** | Implemented (title); follow-up held               | "Match bronchial relationships to interlobar stations" (T1). The follow-up check that re-asks a matched row is a question change → Q7                                                                                                                                                                                                                                                                                                                                             |
| **L15-4** | Implemented                                       | N category (course examples, including "ipsilateral hilar and intrapulmonary nodes, including interlobar nodes, are N1") appears at first use in lessons 1, 12 and 15, linking to lesson 17. Lesson order unchanged                                                                                                                                                                                                                                                               |
| **L16-3** | Implemented                                       | "Choose the description the vignette supports" (T2). No composition task added (Q8)                                                                                                                                                                                                                                                                                                                                                                                               |
| **L17-3** | Adapted                                           | Purpose (P7) and a learner-chosen "Try it yourself: hide the N categories" (P10): off by default, not tracked, same ids checked, Show the sequence and the explanation unchanged                                                                                                                                                                                                                                                                                                  |
| **L17-4** | Adapted                                           | Guided-practice framing (P1); key point visible                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **L17-5** | Adapted (layout); labels/colours held             | Numbers sit beside each structure; 0 leader crossings measured (C4). Labelling the node ovals and a primary-side N-colour toggle → Q2 (mapping inputs recorded there)                                                                                                                                                                                                                                                                                                             |
| **L19-2** | Adapted                                           | Each "Record comparison" names the view and counts supported views (E9). No per-view anatomy exists in the course → Q5                                                                                                                                                                                                                                                                                                                                                            |
| **L20-4** | Implemented (supported part); rest held           | "An exposed tip can harm the patient or the equipment" — what the lesson's own takeaway says retraction protects (H5). "Working channel / airway injury" → Q1                                                                                                                                                                                                                                                                                                                     |
| **L20-5** | Implemented                                       | "Respond to resistance at a calcified target" (T3)                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **L22-5** | Implemented                                       | Restored-draft status in learner language, keeping all three truths (E6); the related refusal and stored-reference lines likewise (E7, E8)                                                                                                                                                                                                                                                                                                                                        |
| **L22-6** | Implemented; destinations held                    | "Running case: the supplied specimens" for lessons 22 and 23 from `EXAMINATION_CASE` (F2). No destination, diagnosis or management inferred (Q11)                                                                                                                                                                                                                                                                                                                                 |
| **L23-2** | Adapted                                           | Instruction lines stay; the record says it is guided and what it asks (P8). Concealing the laboratory instruction or adding media options rejected/held (Q9)                                                                                                                                                                                                                                                                                                                      |
| **L23-4** | Implemented                                       | "Discuss granulomas when microbiology was not sent" (T4)                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **L24-2** | Implemented                                       | The lesson's five questions as an ordered flow, attached only to the lesson's own matching pairs where the lesson names the same failure; two questions say they have no paired example; the patient-safety paragraph stays whole in the lesson text and is pointed to in the flow (F1). No new algorithm or priority                                                                                                                                                             |
| **L25-5** | Implemented                                       | Lesson 25 briefing has no figure (C2); lesson 26 likewise                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **PR-4**  | Already resolved (Prompt 01, CS-6); verified      | `QuestionExplanation` drops a takeaway identical to the keyed rationale and the verdict hides a repeated "Reasoning". Browser: a practice-case debrief has 0 explanation sections with a repeated paragraph and 0 takeaway blocks                                                                                                                                                                                                                                                 |
| **L5-1**  | Preserved; presentation clarified; alignment held | See below                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

Also touched, same defect classes: **L11-5** (title half only: "Identify what determines a station
name", T6; distractors → 05) and the lesson-21 transfer title ("Respond to resistance with the tip
visible", T5; the item's repetition of lesson 20 stays L21-5 → 05).

### L5-1 disposition

**The held-frame evidence identity is untouched; the question/evidence alignment remains held for
Prompt 05.** On the production build a real lesson-5 acquisition (gain raised in the air gap, all
four conditions inspected, **balloon with a bubble** left selected) was held: the evidence line read
"Contact condition held: balloon with a bubble."; the model frame id before and after the hold
was the same; the second check (`cutaway-observe`, the reflector question) was unchanged; after a
reload the lesson returned to its briefing with nothing held (the Prompt 02 contract). The only
change is the instruction above that check: when the condition the check names (the reflector,
recorded as `namesContactMode: 'shadow'` on the question) differs from the held condition, it says
so, says the held image stays as acquired, and says the named condition was inspected in the
workbench before holding — which is true, because `labGoalMet` requires all five conditions before
a hold. Rewording the check, choosing a reference state, or aligning the item is **Q3**.

## Glossary provenance

Every definition is built from course sentences; `pre-review-04.test.tsx` holds a per-term record of
the source fragments (each must be found in the course text) and the only framing words allowed,
and fails if anything else is left over.

| Term                        | Source locations                                                                                                                                                                 | First-use lessons |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| EBUS-TBNA                   | Course overview (expansion); lesson 1 paragraph 1                                                                                                                                | 1                 |
| Examination record          | Lesson 1 note; record tasks' "Record identity and source limits"                                                                                                                 | 1                 |
| Nodal station               | Lesson 11 paragraph 2                                                                                                                                                            | 1                 |
| N category (N1, N2, N3)     | Lesson 1 note and transfer rationale; lesson 17 paragraph 2, worked example, first check; lesson 15 transfer rationale; lesson 12 ("station 7 is an N2 station for either lung") | 1, 12, 15         |
| N2a and N2b                 | Lesson 17 paragraph 3                                                                                                                                                            | (glossary only)   |
| Systematic staging          | Lesson 17 paragraph 1 (the survey sentence; the 2026-guideline clause is **not** repeated — it is an open source hold)                                                           | 26                |
| Acoustic contact (coupling) | Lesson 4 paragraph 1                                                                                                                                                             | (glossary only)   |
| EUS-B                       | Lesson 19 recall; lesson 18 paragraphs 1–2                                                                                                                                       | 14, 19            |
| ROSE                        | Lesson 22 paragraph 1                                                                                                                                                            | 23                |
| Nonrepresentative sample    | Lesson 26 paragraph 1                                                                                                                                                            | 22                |

A lesson never shows a term whose definition it already prints word for word (tested).

## Routes and resources linked

| Link                                                               | Destination as rendered (production, anonymous)                                                            | Access                                              |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `/learn/anatomy/branch-tracing/learn?lesson=orientation` (new tab) | Bronchial Branch Tracing, "Relate CT to the parent airway view", first task "Begin with standard axial CT" | 200, no account                                     |
| `/bronchoscopy-foundations/learn?section=right-side` (new tab)     | Bronchoscopy Foundations, "The right bronchial tree"                                                       | 200, no account                                     |
| `/bronchoscopy-foundations/learn?section=left-side` (new tab)      | Bronchoscopy Foundations, "The left airways"                                                               | 200, no account                                     |
| `/ebus-training/simulator`, `/ebus-training/knobology` (existing)  | Separate EBUS tools                                                                                        | 307 → `/en/login` (now labelled "sign-in required") |
| Glossary "Full teaching" links                                     | The EBUS lesson that teaches each term (`/ebus-guided/learn?section=…`)                                    | Public-unlisted                                     |

Both refresher courses are separate modules in development owned by other lanes; the links are
optional and the EBUS lesson does not wait on them. Shared footer naming was not touched.

## Diagram and data sources

- Course map: `CHAPTERS` (and the self-paced record for reviewed counts).
- Remaining schematics: the existing drawing and anchor coordinates in `Diagram.tsx`; only number
  placement moved. Leader crossings measured 0 in the lesson-17 drawing.
- Troubleshooting flow: `completeLessons['difficult-acquisition']` paragraphs 1–3 and `matching.pairs`,
  read by reference (`content/troubleshooting.ts`).
- Running-case specimens: `EXAMINATION_CASE` specimens, nodes, requested tests and results.
- **No new clinical algorithm, threshold, image, annotation, station colouring or management step
  was created.**

## Confirmations

- **Question keys and clinical answers:** no key moved; no question id changed; two keyed texts
  were reworded with the claim unchanged (L1-11 rationale, L20-4 option), recorded in the copy table.
- **Self-paced semantics:** `selfPacedProgress.ts` untouched; reviewed is still set on reaching the
  end and undone on the finish card; drafts load and restore as before; nothing new is stored.
- **Prompt 01/02/03 contracts:** re-driven — see Verification. Demonstration still records nothing;
  held evidence identity, reload clearing, latest-intent recording, terminal media failure,
  landmark ids, camera/arrows and touch/scroll are untouched code paths (their tests pass).
- **Shared files:** no shared learning-module, stage, header/footer, auth or CI file changed.
  `AnswerVerdict` untouched.

## Files changed

| File                                                                                                                                      | Change                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/ebus-guided/content/types.ts`                                                                                               | `Question.hint`, `Question.namesContactMode`, `Sequence` bare steps + try-it-yourself, optional `Lesson.diagram` (no `workflow`), `Lesson.refreshers`                                                                                                                                     |
| `…/content/stage.ts`                                                                                                                      | titles, purposes, default guided purposes, truthful `support`, no figure on five briefings                                                                                                                                                                                                |
| `…/content/prepare.ts`, `curriculum.ts`, `plan.ts`, `sample.ts`, `complete.ts`, `models.ts`, `authoring.ts`                               | L1 hints/refreshers/L1-11; L4-5; L17 bare steps; L20-4; figure kinds; `namesContactMode`; `withBareSteps`                                                                                                                                                                                 |
| `…/content/glossary.ts`, `troubleshooting.ts` (new)                                                                                       | glossary; troubleshooting flow data                                                                                                                                                                                                                                                       |
| `…/components/LessonHost.tsx`                                                                                                             | eyebrows, purpose line, hint, refreshers, first-use terms, figures, demonstration label, L5-1 note, capture label, finish text, Help glossary                                                                                                                                             |
| `…/components/CoursePage.tsx`, `Diagram.tsx`, `ExaminationWorkspace.tsx`, `PracticePage.tsx`, `SequenceActivity.tsx`, `course.module.css` | map summary, legend, estimates, glossary; schematic caption/layout; status strings; tool labels; try-it-yourself; styles                                                                                                                                                                  |
| `…/components/Glossary.tsx`, `CaseSpecimens.tsx`, `TroubleshootingFlow.tsx` (new)                                                         | new surfaces                                                                                                                                                                                                                                                                              |
| `src/lib/ebus-linked-contract.ts`                                                                                                         | `STRUCTURE_DISPLAY_NAMES`, `structureDisplayName()`                                                                                                                                                                                                                                       |
| `src/lib/ebus-model-contract.ts`                                                                                                          | view-specific route notice                                                                                                                                                                                                                                                                |
| `EBUS-course/apps/web/src/guided/LinkedModelView.tsx`, `imageDiscoveryPixels.ts`, `models/ModelViewport.tsx`, `models/ModelWorkbench.tsx` | display names; contact caption; demonstration kicker and step list                                                                                                                                                                                                                        |
| Tests                                                                                                                                     | new `src/features/ebus-guided/__tests__/pre-review-04.test.tsx` (59), `EBUS-course/apps/web/src/guided/displayNames.test.ts` (9); narrow updates in `pre-review-01.test.tsx` (tool label regex) and `lesson.test.tsx` (refusal wording); `e2e/ebus-anatomy-sweep.spec.ts` J5 wait (below) |
| `scripts/ebus-guided/browser-teaching-clarity.ts` (new)                                                                                   | browser evidence journey                                                                                                                                                                                                                                                                  |

### Tests updated, and why

- `pre-review-01.test.tsx` PR-5: the link now reads "(separate tool, sign-in required)"; the regex
  still requires "separate tool".
- `lesson.test.tsx`: the station-window refusal is reworded (E7); the test still requires the alert.
- `e2e/ebus-anatomy-sweep.spec.ts` J5: **a pre-existing race, not an obsolete assertion.** After
  "Reset acquisition" the test waited for a frame-ready event, which the last pre-reset event
  already was, and read `actionCount` 61. On a throwaway production build of main `d98bab79` it
  failed 3 of 3; on this branch 2 of 3. It now polls until the new session's event arrives
  (`actionCount` 0) — a reset that did not clear would still time out — and passes 3 of 3 on both.
  No obsolete exam assertion was restored anywhere.

## Verification

| Check                      | Command                                                                                                                                                                             | Result                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| This batch's host tests    | `npx jest src/features/ebus-guided/__tests__/pre-review-04.test.tsx`                                                                                                                | 59 passed                                                                                     |
| EBUS host + shared verdict | `npx jest src/features/ebus-guided src/features/learning-module`                                                                                                                    | 29 suites, **364 passed** (includes the 59; 305 before this batch)                            |
| Wider baseline context     | `npx jest src/features/ebus-guided src/features/learning-module src/lib` (baseline only)                                                                                            | at `d98bab79`: 574/575, the one failure the documented pre-existing `board-review-html` suite |
| Embedded (Vitest)          | `npm --prefix EBUS-course/apps/web test`                                                                                                                                            | 40 files, **287 passed** (includes 9 new)                                                     |
| Embedded types             | `npm --prefix EBUS-course/apps/web run typecheck`                                                                                                                                   | clean                                                                                         |
| Root types                 | `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` (after `build:content`)                                                                                                   | exit 0                                                                                        |
| Lint                       | `npx eslint src/features/ebus-guided src/lib/ebus-linked-contract.ts src/lib/ebus-model-contract.ts e2e/ebus-anatomy-sweep.spec.ts scripts/ebus-guided/browser-teaching-clarity.ts` | exit 0 (the embedded app has no ESLint config; Prettier only)                                 |
| Formatting / diff          | `npx prettier --check` on changed paths; `git diff --check`                                                                                                                         | clean                                                                                         |
| Production build           | `npm run build`                                                                                                                                                                     | exit 0 at `d12a6db0` and again at `321d5338` (see Build identity)                             |
| Browser evidence           | `EBUS_REVIEW_URL=http://127.0.0.1:3137 npx tsx scripts/ebus-guided/browser-teaching-clarity.ts`                                                                                     | see Browser conditions                                                                        |
| EBUS e2e (regression)      | `npx playwright test` with a temporary no-webServer config (baseURL 3137) on `e2e/ebus-anatomy-sweep.spec.ts` and `e2e/ebus-recording-status.spec.ts`                               | see Browser conditions                                                                        |

Unique counts: 59 new host tests, 9 new embedded tests, 1 new browser evidence script. Repeated and
overlapping runs are not added together. The whole host Jest suite and the whole Playwright suite
were not run.

## Browser conditions

Headless Chromium (SwiftShader) through the real host and embedded app on the production
standalone server, plus the desktop app's browser pane for reading pages. Every condition is what
its label says. **Native browser zoom, a physical device, Safari and Firefox were not tested.** The
browser pane's synthetic Enter/Space did not activate _any_ `<summary>` on the page (including the
pre-existing "Sources and model limits"), so keyboard operation was verified with Playwright's
keyboard instead.

Journeys (B-numbers match the copy table's evidence column): B1 Overview map, legend, keyboard to a
chapter card (lands at 112 px below an 81 px sticky header), glossary open/close by keyboard with a
visible focus ring; B2 lesson 1 skipped end to end → reviewed stored, "Unmark as reviewed" clears
it, "Mark as reviewed" restores it, the summary lists "Task not completed"; B3 five briefings have
no generic figure; B4 refreshers (three, new tabs, real titles), first-use terms, N-category link
to lesson 17, lesson-passage hint, L1-11 wording; B5 eyebrows and guided transfer with key points
visible; B6 lesson 16 title; B7 lesson 17 schematic (0 crossings, selection marks), sequence purpose,
try-it-yourself by keyboard, completion unchanged; B8 lesson 5 demonstration wording, real contact
acquisition, held condition, L5-1 note, held frame id unchanged, reload clears, L5-4 caption; B9
lesson 10 capture label with no clip id and the limitation visible, lesson-11 structure names,
lesson-15 title; B10 lesson 19 route notices, practice tool label and anonymous redirect to login;
B11 Help glossary by keyboard, Escape returns focus to Help; B12 lesson 22 specimens, lesson 23
allocation purpose and restored-draft status, instruction lines visible; B13 lesson 24 flow and
matching purpose; B14 PR-4 debrief. B15 reflow matrix: 320×740, 390×844, 768×1024 and 1246×1021
viewport emulation, 1440×900 with root font 200 % (not zoom), and emulated `prefers-color-scheme:
light` — Overview, Learn map, lessons 1, 22, 24 and the lesson-17 sequence with try-it-yourself on
and every glossary disclosure open: no horizontal page scroll. The course keeps its own dark
palette under either scheme (pre-existing).

Results: on the `d12a6db0` build 93 of 93 checks passed; on the final `321d5338` build **94 of 94**
(the added check is the L5-4 caption). EBUS e2e on the final production build: `ebus-anatomy-sweep`
8 passed and `ebus-recording-status` 2 passed (10/10), with the J5 race fixed; before the fix the
first build gave 9 passed, 1 failed (J5).

## Build identity

Final build: `npm run build` exit 0 at `321d5338`; served by `node .next/standalone/server.js` on
127.0.0.1:3137 (pid 56884, cwd this worktree's `.next/standalone`). The embedded entry served by
`index.html` is `main-gZGKHYMr.js`; the guided chunk `guided-Cl7ejZAU.js`, fetched from the running
server, contains "The bubble and the reflector do not change what it shows" and "Worked
demonstration · nothing here is recorded"; `SimulatorPage-DpM8z9UJ.js` contains "azygos vein";
host chunk `21635-f42f242be81a20c9.js` contains the refresher title and "Try it yourself: hide the N
categories"; the Learn page chunk contains "Running case: the supplied specimens". Server identity
was checked before every run. Details in `EBUS-PRE-REVIEW-04-status.json` (`build`).

## Proposal: integrated knobology workbench map (documentation only — Q13)

The four recorded-image lessons (6 depth, 7 gain/contrast, 8 Doppler, 10 capture) use one recording
library and one workbench. A single progressive page could show them as four stations in that
order, **keeping** each lesson's deep link (`?section=image-depth|gain-contrast|doppler|capture`),
its own task id (`recorded.taskId = goal`) and held evidence, its own `labGoalMet` criterion (depth
30–45 mm with depth last; gain 35–65 with contrast used and gain last; Doppler on; frozen + two
calipers + saved), all checks, explanations and limits, and the one-control-per-clip explanation.
What would change is navigation only. This is an owner decision because it restructures clinical
curriculum; nothing was merged.

## Prompt-05 / owner-review queue generated by this batch

Q1 L20-4 specific harm wording; Q2 L17-5 station labels and primary-side colouring (mapping inputs
listed); Q3 L5-1 question/evidence alignment; Q4 undefined terms and abbreviations (CHS/central
hilar structure, TNM, IASLC, NSCLC, PET, IFU, FNA, ERS/ESGE/ESTS, CHEST); Q5 L19-2 per-view anatomy;
Q6 L2-6 and L12-2 stems; Q7 L15-3 follow-up row; Q11 L22-6 destinations; Q13 knobology map; Q14
EBUS-local CT primer; Q15 L18-2/L16 image assets. Details in the copy table, section B. Existing
owner holds (Doppler/4L, 4R disc, orientation, sweep windows, calibration, thresholds, sizing,
anticoagulation, sampling, sequencing, media, rights, guideline claims) were not touched.

## Evidence paths (outside Git)

`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/ebus-pre-review-04-2026-09-22/`
— `prod-d12a6db0/` (first build: `report.json`, per-journey PNGs, B15 matrix PNGs, L5-4 3D captures
and pixel diffs) and `prod-321d5338/` (final build). e2e traces for failures went to the session
scratchpad. The throwaway baseline checkout was removed after use.

## Not run / limitations

- Native browser zoom, physical phone/tablet, Safari, Firefox, screen-reader software (structure
  was checked through roles, names and native disclosures, not with a screen reader).
- Any human, faculty, clinical, source or media review.
- The whole host Jest and Playwright suites.
- The refresher links point into two other in-development modules; if their lesson ids or titles
  change, these labels need updating.
- Try it yourself exists only for the lesson-17 ordering; elsewhere every candidate concealment
  would have hidden a limit, a safety point or a laboratory instruction, or was already covered by
  "Show explanation".
- Phone widths still show the host's existing desktop/tablet fallback for model labs (unchanged).
