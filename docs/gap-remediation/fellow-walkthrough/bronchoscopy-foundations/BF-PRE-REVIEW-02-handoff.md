# BF-PRE-REVIEW-02 — truthful sources, readable tables and usable actions: handoff

**Batch scope:** lane 02 of the Bronchoscopy Foundations fellow-walkthrough package — source
identity and metadata (A8, SUP-02), the section source list against the continuation bar (A9),
Reading the view in the lessons (A10), the ledger's and the branching cases' own actions (A12,
A13, SUP-17), the question kept in view with its verdict (the module's part of A15), matching
feedback (A16) and the module's part of the two verdict vocabularies (A43). **No clinical approval,
no source or media review, no anatomical validation, no real-learner validation, no release, no
deployment and no merge is claimed or performed.** Lane 03 (visual workspace), 04 (teaching and
survey flow) and 05 (media and clinical decisions) are untouched.

The walkthrough this repairs is Claude in a first-year-fellow persona, not a fellow, a
technologist or a faculty reviewer. Its severity labels are kept as its own; the dispositions
below are this batch's.

## Repository reconciliation

| Field               | Recorded value                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base SHA            | `a306d8250ec10207c750f46407f151c06d487707` — `origin/main` fetched 2026-09-23 at the start of this batch (merge of PR #265). The prompt-preparation SHA `b9fa0483` and the Batch-01 verification SHA `d98bab79` (merge of PR #254) are both ancestors. The planning SHA `77a141cc` was not restored.                                                                                                                                                                               |
| Checkout and branch | `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/claude-bf-02`, a new worktree created from `origin/main` for this batch (not the Batch-01 `claude-bf-1-9-19` worktree); branch `claude/bf-pre-review-02-9-22`. Clean at start (`0 0` against `origin/main`).                                                                                                                                                                                                |
| Batch-01 present    | At the base: `__tests__/simulation-truth.test.tsx`, `goal-truth.test.tsx`, `scope-playback.test.tsx`, `engine/scope/goalPresentation.ts`, `ENVIRONMENT_CLOCK_SCRIPTS` / `isEnvironmentClockCommand` in `engine/scope/scopeScripts.ts`, and the `BF-PRE-REVIEW-01` handoff and dispositions.                                                                                                                                                                                        |
| Ownership check     | Open PRs at start: #271 (MV), #266 (HD), #264 (MCS), #134 (an older critical-care branch that also edits `AnswerVerdict.tsx`; not a BF lane and not touched here), #114 and #98 (literature). No open PR or other worktree holds a BF branch. Every file this batch changes is under `src/features/bronchoscopy-foundations/**` or the BF e2e spec, which `PI_EBUS_BBT_BF_COORDINATION.md` assigns to BF 01–04. No engine, generated-data, section-content or shared file changed. |
| Instructions read   | `AGENTS.md`, `CLAUDE.md`, `docs/local-authoring-assets.md`, `docs/gap-remediation/self-paced/README.md`, the BF-01/02/03 and `BF-PRE-REVIEW-01` handoffs and dispositions, and in place in Local-Data: `00_START_HERE.md`, `02_BF_SOURCES_FEEDBACK_AND_CONTROLS.md`, `FEEDBACK_LEDGER.md` / `feedback-ledger.json`, `PI_EBUS_BBT_BF_COORDINATION.md`, `SOURCE_AND_CODE_NOTES.md`, `OWNER_DECISIONS.md` and the walkthrough DOCX (SHA-256 `3bac73ed…d30aa`).                        |
| Environment         | Production builds served standalone on lane-unique ports: the unchanged base on **3141** (build `cH8SKNAsjrlBfqQC1zRQm`, a copy kept outside the checkout), this branch on **3142**. Playwright Chromium 1.62 with isolated contexts; `/api/analytics` stubbed by the suite's own handler. Evidence: `Interventional-Pulm-Local-Data/renders/output/bf-pre-review-02-2026-09-23/{baseline,after}/`.                                                                                |
| Not done            | No `.env.local` read or written, no owner-profile session, no production data write, no paid API call, no merge, no deploy.                                                                                                                                                                                                                                                                                                                                                        |

## Shared AnswerVerdict dependency

**Merged and consumed; not forked.** `853c60e7 fix(learning-module): say what the comparison list
actually holds` (EBUS-PRE-REVIEW-01) is on the base: after a wrong or unsafe selection the
comparison is headed "How the other answers compare", the keyed entry carries "Best-supported
answer." and `data-other-answers-keyed` is set; "Why the other answers do not fit" is kept only
where it is true. Reproduced on the base build at S1 Part 3 (wrong answer): heading "How the other
answers compare", one keyed label. This batch changes nothing in `AnswerVerdict.tsx`; the BF
host still passes `outcome="stated"`. The Jest and browser cases assert the merged behaviour so a
regression in the shared card fails here too. **A15's shared part is closed by that merge; its BF
part (the question disappearing) is repaired below.**

## Reproduction on the base build, before any edit

All on `/en/bronchoscopy-foundations/learn?section=…` of the base production build, native input.

| Finding  | Observed on the base                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A8       | In the four lists opened in the browser (S1, S4, S8, S19) every row had `data-source-class="transcript"` and carried the lecture sentence: S1 (Textbook), S2, S3, U1, U2, U4 once each; genuine transcripts (T05–T09, T11, T16) **twice** (the tag and again as the limit). The other nineteen lists behave the same by construction (the Jest case comparing every section with the Reference fails on the base). The Reference was right: the sentence on T01–T16 only, once. |
| SUP-02   | Locators printed "S1, PDF 71–83" with nothing saying what a PDF page is.                                                                                                                                                                                                                                                                                                                                                                                                        |
| A9       | See the geometry table below: the open list is `position: absolute; z-index: 5` and the pinned continuation `sticky; z-index: 10`, so the bar was drawn over the list at every 100% size, the last source's focused Copy control was covered at 1204, 1440, 1024 and 390 px, and at 200% text and phone widths the list rose above the viewport under the site header with the first source.                                                                                    |
| A10      | All thirteen lesson occurrences (S6, S8 ×2, S9, S10, S11, S12, S15 ×2, S16, S18, S19, S20) rendered `div > h4 + p + p` with no table, no headers and no labels; the Reference rendered a four-column `<table>`.                                                                                                                                                                                                                                                                 |
| A12      | S4 Part 3 "Answer": transparent background, no border, no padding, 26 px tall and 1040 px wide, class `bronch-stage_orderActions` (the sequence arrows' layout class); only "Continue without completing" looked like a button.                                                                                                                                                                                                                                                 |
| A13      | S15, S18, S19 after the keyed decision: "Continue to the next observation" with the same class and metrics; the Now-card status still read "Decide on this card, open the reasoning for this observation, or continue without completing the case."; no primary action.                                                                                                                                                                                                         |
| SUP-17   | Unsafe first-frame moves were refused and the frame stayed, in all three cases. Reveal and skip stayed available. (Preserved; see below.)                                                                                                                                                                                                                                                                                                                                       |
| A15      | S1 Part 3 after a deliberately wrong answer: the situation and the stem were gone (0 matches); the shared card said "Not correct." with the neutral heading and the keyed label (merged fix present). "Try this check again" restored four unselected options.                                                                                                                                                                                                                  |
| A16, A43 | S1 Part 4 with the lavage statement matched to "What am I looking at?": "Did not hold." and the rationale, never naming the keyed category; the other six rows "Held.". Explanation-first printed "Belongs with: Where am I?." (a full stop after the question mark).                                                                                                                                                                                                           |

Baseline A9 geometry (px, viewport coordinates, list just opened with the page scrolled to the
summary):

| Viewport | Root text | Open list             | Continuation bar       | Header bottom | First source top      | Last source's focused control |
| -------- | --------- | --------------------- | ---------------------- | ------------- | --------------------- | ----------------------------- |
| 1204×987 | 100%      | 152–536 (absolute, 5) | 370–441 (sticky, 10)   | 81            | 163                   | covered by the bar            |
| 1204×987 | 200%      | −234–259              | −156 to −21            | 213           | −214 (above viewport) | —                             |
| 1440×900 | 100%      | 65–449                | 283–354                | 81            | 76 (under header)     | covered by the bar            |
| 1440×900 | 200%      | −185–265              | −105–31                | 297           | −164                  | —                             |
| 1024×768 | 100%      | −127–257              | 91–162                 | 81            | −116                  | covered by the bar            |
| 1024×768 | 200%      | −126–258              | −202 to −67            | 289           | −106                  | —                             |
| 390×844  | 100%      | −93–291               | 35–106                 | 73            | −83                   | covered by the bar            |
| 390×844  | 200%      | −285–137              | −715 to −586 (far off) | 145           | −265                  | —                             |
| 320×740  | 100%      | −131–239              | −61–9                  | 73            | −120                  | —                             |
| 320×740  | 200%      | −272–98               | −1024 to −895          | 145           | −252                  | —                             |

At 390×844 with 200% text the bar was far off screen, so there was no overlap to catch there; the
matching browser case passes on the base and is reported as not reproduced at that size.

After the repair (final build, same pages and sizes; the page is scrolled to the summary and the list
opened by a native click, so the list starts below it):

| Viewport | Root text | Open list (in flow) | Continuation bar | Header bottom | List and bar intersect | Last source's focused control |
| -------- | --------- | ------------------- | ---------------- | ------------- | ---------------------- | ----------------------------- |
| 1204×987 | 100%      | 581–1193            | 370–441          | 81            | no                     | in view, uncovered            |
| 1204×987 | 200%      | 579–2588            | 74–209           | 213           | no                     | in view, uncovered            |
| 1440×900 | 100%      | 494–1084            | 283–354          | 81            | no                     | in view, uncovered            |
| 1440×900 | 200%      | 577–2376            | 117–253          | 297           | no                     | in view, uncovered            |
| 1024×768 | 100%      | 412–1066            | 201–272          | 81            | no                     | in view, uncovered            |
| 1024×768 | 200%      | 507–2726            | −42–93           | 289           | no                     | in view, uncovered            |
| 390×844  | 100%      | 447–1877            | 146–217          | 73            | no                     | in view, uncovered            |
| 390×844  | 200%      | 492–7733            | −481 to −352     | 145           | no                     | in view, uncovered            |
| 320×740  | 100%      | 394–2139            | 49–119           | 73            | no                     | in view, uncovered            |
| 320×740  | 200%      | 440–8317            | −803 to −674     | 145           | no                     | in view, uncovered            |

The bar is confined to the lesson section and the list follows that section, so they cannot meet;
the list is taller than the viewport at 200% and at phone width and is read by scrolling the page
(the one scroller). In the browser cases every control in the list is reached by Tab in view, below
the header and hit-tested as itself (each line fragment of a wrapped link), and Escape closes the
list and returns focus to its summary. Before the measured bottom reserve, focus in the list landed
under the site header with 200% text — by 10 px at 1440×900 and 1024×768 and by 29 px at
320×740; after, it does not. The bottom reserve is the bar's measured height plus 12 px (147 px for a 135 px bar at 200%).

## Root causes

- **A8.** `components/stage/BronchSourceList.tsx` tested `source.manifest.transcript !== undefined`.
  The generated manifest writes `transcript: null` on every non-transcript, and `null !== undefined`,
  so every source was classed a transcript. `data/sources.ts` already used truthiness for its kind
  label, which is why the Reference (and the list's own kind label) were right. The transcript list
  also printed the sentence twice: once as a tag and again as the limit it already is.
- **A9.** The shared `StageSourcesFooter` floats its list up from the summary
  (`position: absolute; bottom: 100%; z-index: 5`), which suits the fixed-height shared stage. This course
  scrolls the document and pins its continuation (`sticky; bottom: 0; z-index: 10`) inside the
  lesson section, so the floating list slid under it and, anchored to a summary near the viewport
  top, rose above the viewport. Separately, `course-flow.module.css` reserved a fixed
  `scroll-padding-bottom: 19rem` for the bar — 608 px at 200% root text — which together with the
  measured header clearance left no band for a focused control on 1440×900, 1024×768 and 320×740,
  so Chrome parked focus under the site header.
- **A10.** The course rewrite `cc8a6a00` replaced the stage's `<table className={styles.grammarTable}>`
  (then in the deleted `BronchTeachingColumn`) with `h4`/`p` lines in `BronchCourseTeaching`,
  dropping the headers, and the Reference kept its own separate table without the control column.
  The `.grammarTable` CSS survived unused.
- **A12 / A13.** `BronchLedgerControl` (Answer) and `BronchScenarioControl` (Decide, Continue to
  the next observation) used `styles.orderActions`, the inline-flex wrapper for the sequence
  arrows, as a button class. Decide looked right only because of a separate global rule in
  `course-flow.module.css`. The scenario's feedback phase lived in the control's local state, so the
  host's Now-card status could not know a decision had been made.
- **A15 (BF part).** `BronchStageHost.predictionBody` returned only `verdictFor(…)` once a choice
  was committed, replacing the situation, still, stem and options.
- **A16 / A43 (BF part).** `BronchSortControl` printed "Held." / "Did not hold." and the rationale,
  and named the authored origin only on the explanation-first path; identify, sequence, report,
  ledger and scenario used the same "Held" vocabulary while the questions' shared card says
  "Correct." / "Not correct.".

## What changed

| File (under `src/features/bronchoscopy-foundations/`)                                                    | Change                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/sources.ts`                                                                                        | `manifestTranscript` reads the record against the manifest schema (object → record, `null` / absent → none, anything else throws); `bronchSourceClass` derives `transcript` / `reference` and throws if it disagrees with the T-id grammar citations already rely on; `BronchSource.sourceClass`; `PDF_PAGE_LOCATOR_NOTE`; "PDF page(s)" locators; the unchecked printed-page offset in the header comment is marked as unchecked. |
| `content/stageSources.ts`                                                                                | Each record says whether any of its locations is a PDF page.                                                                                                                                                                                                                                                                                                                                                                       |
| `components/stage/BronchSourceList.tsx`                                                                  | Reads `sourceClass`; the transcript sentence once, as the limit; the PDF-page note where it applies; Copy and Open name their source (`Copy citation for S2`, `Open source U1 (opens in a new tab)`).                                                                                                                                                                                                                              |
| `components/stage/course-flow.module.css`                                                                | BF-local rule putting the open list in page flow after the lesson section; bottom scroll reserve reads the measured `--bronch-focus-clear-bottom`; the global `[data-scenario-decide]` styling removed (Decide now uses the primary class).                                                                                                                                                                                        |
| `components/stage/BronchCourseLayout.tsx`                                                                | Measures the pinned continuation (ResizeObserver) into `--bronch-focus-clear-bottom`, the same way the header clearance is measured; nothing is reserved when the bar is in flow (skill/inspection steps).                                                                                                                                                                                                                         |
| `content/grammar.ts`, `components/ReadingTheViewTable.tsx`, `components/reading-the-view.module.css`     | `grammarRowControl` (the lesson's control wording, unchanged); one table component: observation as row header, "Where it lives", a shortlist list, "Which control, if any", optional "Taught in"; a container-query card stack with visible labels in a narrow container; explicit table roles; theme-neutral colours.                                                                                                             |
| `components/stage/BronchCourseTeaching.tsx`, `components/reference/BronchoscopyFoundationsReference.tsx` | Both render `ReadingTheViewTable` from `BRONCH_GRAMMAR`; the Reference keeps its heading, trend rule and Taught-in links.                                                                                                                                                                                                                                                                                                          |
| `components/stage/BronchLedgerControl.tsx`                                                               | "Check this answer" with the course primary class; disabled with a visible reason (`Enter the milligrams…` / `Choose a statement, then check it.`); outcome in a polite live region; focus to the outcome when the keyed answer removes the button.                                                                                                                                                                                |
| `components/stage/BronchScenarioControl.tsx`                                                             | Decide and Continue use the primary class; feedback phase can be held by the host; focus follows the learner's own Decide/Continue; outcome words harmonized; the refusal sentence kept.                                                                                                                                                                                                                                           |
| `components/stage/BronchStageHost.tsx`                                                                   | Holds the scenario feedback phase; ledger and scenario status name the next real step; the reveal toggle is hidden only while a decision's feedback is being read; `QuestionContext` keeps situation, still, stem and options (learner's answer marked) above the shared verdict.                                                                                                                                                  |
| `components/stage/verdictWords.ts`, sort/identify/sequence/report controls                               | One vocabulary mapped from plausibility: Correct / Partly correct / Not correct / Not correct, and unsafe. A wrong row names what was chosen and the authored category or name; a misplaced step names its worked position. No counts.                                                                                                                                                                                             |
| `components/stage/bronch-stage.module.css`                                                               | `.actRow`, `.questionContext`; the dead `.grammarTable` selectors removed.                                                                                                                                                                                                                                                                                                                                                         |

## Source classes after the repair

| Source  | Registered kind                | Class      | Transcript sentence | PDF-page note   |
| ------- | ------------------------------ | ---------- | ------------------- | --------------- |
| S1      | Textbook                       | reference  | none                | yes (S1 pages)  |
| S2      | Training manual                | reference  | none                | yes             |
| S3      | Faculty manual                 | reference  | none                | yes             |
| U1, U2  | Guideline or official guidance | reference  | none                | no (section)    |
| U4      | Emergency checklist            | reference  | none                | no              |
| T01–T16 | Lecture transcript             | transcript | once, as the limit  | no (time spans) |

Publication class, source-read status and clinical-use review stay separate: the class says only
what kind of work it is; the transcript sentence is the existing review-status statement for the
lecture recordings (a test keeps it true — every transcript record has `audioVideoReviewed:
false`); claim approval stays in the claim-review queue and register, which nothing here touches.
`sources.generated.ts` is unchanged (every non-transcript still carries `transcript: null`).

## Reading the view after the repair

Every one of the eleven reported sections renders a `<table>` named by "Connect the observation to
the problem" with the headers You see / Where it lives / Shortlist / Which control, if any, one row
per `grammarRowIds` entry, the observation as `th scope="row"`, and the trend rule under it:

| Section | Step(s) with the table     | Rows |
| ------- | -------------------------- | ---- |
| S6      | review                     | 1    |
| S8      | recovery (Part 2), review  | 5    |
| S9      | review                     | 2    |
| S10     | review                     | 2    |
| S11     | review                     | 2    |
| S12     | review                     | 2    |
| S15     | reasoning (Part 2), review | 3    |
| S16     | review                     | 1    |
| S18     | review                     | 1    |
| S19     | review                     | 2    |
| S20     | review                     | 1    |

The Reference renders all fourteen rows through the same component and adds Taught in. Cell text
is asserted equal to the canonical row on both surfaces, so lesson and Reference cannot diverge; no
row, exception or clinical sentence changed.

In a narrow container (below 42rem of its own width, so sooner at 200% text) the same table stacks
into one bordered card per row with each cell under a visible label ("You see", "Where it lives",
"Shortlist", "Which control, if any", "Taught in"); the header row stays in the accessibility tree,
the visible labels are hidden from it, and Chrome's own accessibility tree (read over CDP in the
browser case) still reports each observation as a `rowheader`. Measured: no horizontal overflow of
the table or the course at 390 px, 320 px and at 1204 px with 200% text; the Reference fits and
stacks the same way at 390 px. The Reference card is the module's fixed dark palette in both site
themes (checked with the site set to light and to dark: same colours, text on background well
above 4.5:1); the table's rules and headings take their colour from the surrounding text, so it
would follow a light card too.

## Actions and feedback after the repair

**A12 — S4 ledger.** The submit control is a native `button` with the course's primary class and the
words every other check uses, "Check this answer". Incomplete (a line empty): disabled, readable
(the course's disabled primary, 5.0:1 text on its background), and `aria-describedby` the visible
prompt "Enter the milligrams for every measured line…". Entries complete but no statement chosen:
still disabled, with "Choose a statement, then check it." beside it. A false total (every entry
off) is flagged per row ("Check the arithmetic…") and does **not** block checking the statement —
the entries carry no dose judgement, exactly as before. An unsafe statement: "Not correct, and
unsafe." with its rationale and "The table stays open."; the step is not done, the Now card says
"Choose another statement and check it, open the worked arithmetic, or continue without completing
it.", and skip stays. The keyed statement: "Correct.", the Check button leaves, focus moves to the
outcome, Continue opens. Keyboard: Tab from the chosen statement reaches Check (3 px focus ring),
Enter checks. Measured at 1204×987: 44 × 175 px (was 26 × 1040 px, no background). No
arithmetic, row, statement, key or local-anaesthetic wording changed; no maximum, mixed-agent rule or remaining-dose statement exists or was added.

**A13, SUP-17 — S15, S18, S19.** Decide and "Continue to the next observation" are native buttons
with the primary class (cyan; Continue measured 44 × 285 px at 1204×987). First frame, unsafe
move: "Not correct, and unsafe. That move is refused here, and the case does not move on with it." — the frame stays, nothing is recorded as
done, the Now card says "Decide again on this observation, open its reasoning, or continue without
completing the case.", reveal opens that frame's reasoning, skip stays; no acknowledgment or other
gate was added. An other-than-keyed move says "Not correct." (or "Partly correct.") and "Not the
move to make first." The keyed move: "Correct. Your action: …" with its rationale, and the case
**waits** — the next frame is not shown until the learner chooses Continue; focus moves to the
feedback, the next Tab reaches Continue, and the Now card says "Read the feedback on your decision,
then continue to the next observation. You can also continue without completing the case." (the
reasoning toggle is hidden only while that feedback is on screen, because it would open nothing).
Continue shows the next frame and focuses its observations; the last keyed decision ends the case
("Done. You worked the case to its end.") with Continue in the Now card. Skip remains a separate,
secondary action throughout and is never the only styled control. **No contract mismatch was found
between the refusal and the educational flow**: the engine already refuses an unsafe choice without
advancing, and read, reveal, retry-by-deciding-again and skip were already open.

**A15 (BF part) — S1 Part 3.** After a deliberately wrong answer the question stays above the
verdict: the situation, any still, the stem and the options in the order they were shown, with
"— your answer" on the learner's choice. The shared card then says "Not correct.", explains, and
its comparison is headed "How the other answers compare" with "Best-supported answer." on the keyed
option. The same context stays after a correct and after an unsafe answer. "Try this check again"
restores the unselected question. Explanation before answering is unchanged (no verdict, no
context block).

**A16, A43 (BF part) — S1 Part 4 and every set.** Deliberately wrong (the lavage statement on
"What am I looking at?"): "**Not correct.** You chose: What am I looking at? **Belongs with: What
result would change management?** A well-returned lavage is a procedural observation. It changes
management only through the result it produces." The other rows: "Correct. You chose: …".
Explanation first: every row "Belongs with: …" without the stray full stop after a question mark.
No count, total or "N of M" appears. The same words now run through identify ("Name: …" on a wrong
row), sequence ("Not correct. In the worked order this is step N."; a critical step is still named
a safety error), the report ("Correct." for a supported field; "Refused: the evidence does not
support that." unchanged), the ledger and the scenario. A test pins these words to the shared
card's own outcome labels and checks none of them uses grading vocabulary.

## Owner and clinical decisions left open

1. **A16 — the lavage statement (owner / faculty; for batch 05).** Unchanged here.
   - Where: `content/sections/shared-airway.ts:327`, sort `five-questions`, row `lavage-returned`.
   - Current statement: "The lavage came back well; whether it helps depends on what the laboratory
     can report." Key: `result` — "What result would change management?".
   - Current rationale: "A well-returned lavage is a procedural observation. It changes management
     only through the result it produces."
   - Why it is ambiguous: the statement joins a procedural observation (the return) and a
     result-dependence clause, and the rationale opens by calling it a procedural observation,
     which reads as support for "What am I looking at?". The feedback now names the keyed category,
     so the wording, not the feedback, is what remains.
   - Possible proposals for review (not applied): keep one idea per statement — e.g. "Whether this
     lavage changes the plan depends on what the laboratory reports." (key unchanged: result), and,
     if wanted, a separate row "The lavage returned well." (a new row would need its own key and
     review). Source for the set: S2 PDF pages 44–47 and S1 PDF pages 61–70, as cited on the sort.
2. **SUP-02 — printed page numbers (owner / source).** The registry holds only PDF pages. An
   authoring comment places S1's printed page at the PDF page less sixteen; that was not checked
   against the book here, so no printed page is shown or inferred. Adding printed locators needs
   the book pages checked, per source.
3. **A43 — lecture display names** stay with batch 04; the global intro-route and language-menu
   parts stay with the PI platform lane.
4. **200% root text, site chrome (shared, not BF).** With the root font at 200% the site header and
   footer links overflow the page width (e.g. the footer's "Coming soon" link to 1280 px at
   1204 px, 1149 px scroll width at 1024 px). Identical on the base build, with the list open or
   closed. For the single shared platform queue; the BF cases assert the course region fits and
   record the page separately.
5. Unchanged holds: the local-anaesthetic source-specific dose question (SUP-07) — no maximum,
   mixed-agent arithmetic or remaining-dose statement was added; every existing source, media,
   anatomy and local-policy hold.

## Preserved contracts (Batch 01 and earlier)

Verified by the complete BF Jest suite and the complete BF browser suite on the final build (both
include the Batch-01 cases), plus the new cases:

- Protected-accessory demonstration truth, the intentional first accessory misreport, and the
  refusal to move an exposed accessory: unchanged code; the Batch-01 Jest and browser cases pass.
- Laryngeal environmental clock, closed-fold guard, carina hold, and environmental time as nobody's
  work: no change to `scopeScripts.ts`, `useScopePlayback.ts`, `stageSession.ts` or the reducer; the
  scripted-clock browser cases pass in ordinary and reduced motion.
- Historical versus current goal semantics, ledger-as-history, truthful optical-accessibility
  wording, no invented visible-lumen judgement, and no A26 geometry or default-branch change: no
  change to `engine/**`, `goalPresentation.ts`, the scope components or the case data.
- Self-paced contract: explanation before any answer on every activity, optional retry, skip that
  records nothing, no score, no completion gate. `SKIP_PAST` / `CONFIRM_THROUGH`, `performedIds`
  and the self-paced record are untouched; the ledger's and scenario's step completion still come
  from the engine's own keyed-choice rule.
- Stable ids and legacy meaning: no section, step, item, row, frame or choice id changed; no
  generated file changed; `data-outcome` / `data-*-verdict` hook values kept.
- Source, media, review and release holds: no source identity, citation, review status,
  publication flag or media record changed.
- The known pre-existing 3D restore defect (schematic fallback → `loading`) is not touched.
- Shared ownership: `AnswerVerdict.tsx`, the shared stage and footer, global CSS, other modules and
  Device Intelligence are unchanged.

## Validation

Commands were read from `package.json` and the Playwright configs, not guessed. Unique tests are
counted once; reruns are listed separately.

| Check                                                                                                                           | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx jest src/features/bronchoscopy-foundations 'src/app/[locale]/bronchoscopy-foundations' --runInBand` (base `a306d825`)      | 30 suites, 410 passed, 1 todo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| the same at the final head `21f753ce`                                                                                           | **32 suites, 446 passed, 1 todo** (36 new cases in two new files; no existing case changed or removed; the todo is the pre-existing larynx/trachea one)                                                                                                                                                                                                                                                                                                                                                                                                                  |
| New Jest cases against the unchanged runtime                                                                                    | **29 of 36 fail**. Run in a detached worktree at `a306d825` with the new test files and only the new pure helpers added so they compile (`manifestTranscript`, `bronchSourceClass`, `PDF_PAGE_LOCATOR_NOTE`, `grammarRowControl`, `verdictWords.ts`; nothing in the base runtime imports them). The 7 that pass are the helpers' own unit cases (2), preserved-contract guards (explanation before answering, the ledger's worked arithmetic before any entry, the pinned control wording, the transcript sentence's truth) and the vocabulary-equals-shared-card check. |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`                                                                       | exit 0 (the default heap runs out on unchanged main too)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `npx eslint --max-warnings=0` on every changed `.ts`/`.tsx`                                                                     | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npx prettier --check` on every changed path                                                                                    | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `git diff --check a306d825 HEAD`                                                                                                | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run build` (embedded training apps, contentlayer, asset validators, `next build --webpack`, `prepare:standalone`)          | exit 0 at the base (`cH8SKNAsjrlBfqQC1zRQm`), at `1614e5ea` (`ZtMAPeXAQ7V5N-ZTSfsV_`) and at the final head `21f753ce` (`R6q1Frts9WYPZ7RuLwEJm`)                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Playwright BF suite (`playwright.bronchoscopy-foundations.config.ts`) against the final production build                        | **50 unique tests, 50 passed** (28 existing, 22 new)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Reruns of that suite                                                                                                            | Build `1614e5ea`, first full run 49/50: the one failure was the new case's own helper taking the centre of a wrapped link's union box at 320 px / 200% (a point on the text beside it); fixed to test each line fragment (`a1b18f84`, test-only), then 50/50 on that build and 50/50 on the final build. The six failures of an earlier partial run of the new cases led to the measured bottom reserve and to scoping the 200%-text overflow check to the course (below).                                                                                               |
| The 22 new browser cases against the base build                                                                                 | **21 fail, 1 passes** (the source list at 390×844 with 200% text — a genuine non-reproduction, see the geometry table)                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Systemic-UX checks that load BF (`systemic-ux.spec.ts` `bf:` × 6 sizes, both "all nine public entries" checks × 7), final build | 13 passed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Browser acceptance used real routes of the production build with native pointer and keyboard input
(clicks, `check`/`selectOption` on native controls, Tab, Enter, Escape, typed entries); no reducer
injection, forced clicks or storage fixtures. Screenshots and measurement JSON are in Local-Data
(`renders/output/bf-pre-review-02-2026-09-23/`), not in Git.

At 200% root text the page itself overflows horizontally because of the site header and footer
links, identically on the base build (see decisions, item 4); the enlarged-text cases therefore
assert that the course region fits and check the page only at 100% text.

## NOT RUN / limitations

- No human review of any kind: no faculty, learner, technologist, clinical, source, media or
  accessibility-specialist review, and no usability session.
- Screen-reader output was not listened to. Semantics are asserted from the DOM and from Chrome's
  accessibility tree (CDP) only.
- Browsers: Chromium only (Playwright 1.62). Safari/WebKit and Firefox not run; the explicit table
  roles are there for engines that drop table semantics under `display: block`, but that was not
  observed here.
- Native browser zoom was not tested; "200% text" means the root font size set to 200% (and the
  existing suite's CSS-zoom case), labelled as such.
- Hidden-tab behaviour: not re-tested beyond the existing suite (no lifecycle code changed).
- The light/dark check covers the Reference card (the lessons use the module's fixed dark
  palette); both site themes render the Reference card in the same dark palette.
- The printed-page locators (SUP-02) were not checked against the books; none are shown.
- The global 200%-text site-chrome overflow was reproduced and recorded, not repaired (not BF).

## Backlog raised in passing (not repaired here)

- `sources.generated.ts` keeps the 16 transcript records' `publicationPermission: not_established`
  and `speakerIdentityVerified: false`; nothing learner-facing reads them yet. If a lecture display
  name is added in batch 04, those fields are the ones to consult.
- The section-list copy action copies author, title and year only; it does not include the DOI or
  URL. Unchanged here (identity is correct); worth deciding if the citation should carry the link.
- The shared `StageSourcesFooter` float-over design still suits the fixed-height stage; a module
  that scrolls the document may need the same in-flow override. Recorded for whoever owns the shared
  stage; not changed.
- The site header and footer overflow the page at 200% root text (see decisions, item 4).
