# EBUS-PRE-REVIEW-01 — truthful feedback, navigation and evidence: handoff

**Batch scope:** ledger lane 01 of the EBUS fellow-walkthrough package — the host-level defects in
feedback semantics, case exit, evidence identity, the matching/ordering/record interactions, and
lesson-header/focus clearance. **No clinical approval, no real learner validation, no release, no
deployment and no merge is claimed or performed.** The visual workbenches (lane 02), the anatomy
and sweep work (03), the teaching-clarity pass (04) and the clinical/media drafts (05) are
untouched.

The walkthrough this repairs is Claude in a first-year-fellow persona, not a fellow and not a
faculty reviewer. Nothing here is evidence that the module teaches what it intends to.

## Repository reconciliation

| Field              | Recorded value                                                                                                                                                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Checkout           | `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/claude-ebus-9-19`                                                                                                                                                                                                                          |
| Branch             | `claude/ebus-pre-review-01`, created from `origin/main`                                                                                                                                                                                                                                                           |
| Base SHA           | `77a141ccfd574a984f91e74abc9018b5d67e8202` — the same commit the planning package inspected, so no reconciliation with newer main was needed                                                                                                                                                                      |
| Starting status    | clean                                                                                                                                                                                                                                                                                                             |
| Instructions read  | root `AGENTS.md` and `CLAUDE.md`; `docs/local-authoring-assets.md`; the package in place under `Interventional-Pulm-Local-Data/module_update_9_19/EBUS_Claude_Implementation_Pack` (`00_START_HERE.md`, `01_…`, `PI_EBUS_COORDINATION.md`, `OWNER_DECISIONS.md`, `SOURCE_CONTEXT.md`, `FEEDBACK_LEDGER.md/.json`) |
| Prior context read | `docs/gap-remediation/self-paced/EBUS-01-handoff.md` (active self-paced contract), `docs/gap-remediation/systemic-ux/SYSTEMIC-UX-01-handoff.md` and `-02-handoff.md`                                                                                                                                              |
| Commits            | seven, listed below, each independently revertible                                                                                                                                                                                                                                                                |
| Pull request       | opened from this branch; not merged                                                                                                                                                                                                                                                                               |

## Shared-file scope

One shared runtime file was changed, the one `PI_EBUS_COORDINATION.md` explicitly authorises for
this batch:

- **`src/features/learning-module/components/AnswerVerdict.tsx`** and its focused test.
  The change is the comparison heading and a per-entry role marker inside the existing disclosure.
  No prop, timing rule, announcement, plausibility mapping, key, rationale, `data-` contract or
  callback changed, and nothing was added or removed from the list of choices.

Directly affected consumers, all re-run green without edits:

| Consumer                 | File                                      | Result                                      |
| ------------------------ | ----------------------------------------- | ------------------------------------------- |
| EBUS Guided              | `ebus-guided/components/QuestionBody.tsx` | repaired and re-tested                      |
| ECMO foundation & drills | `cardiohelp-ecmo/components/stage/*`      | 74 suites pass unchanged                    |
| Hemodynamics stage       | `icu-hemodynamics/components/stage/*`     | pass unchanged                              |
| MCS stage                | `mechanical-circulatory-support`          | pass unchanged                              |
| Bronchoscopy Foundations | `bronchoscopy-foundations/components/*`   | pass unchanged                              |
| Peripheral imaging       | `peripheral-imaging/components/*`         | pass unchanged (PI lane's files not edited) |

`ChoiceReasoningFeedback.tsx`, which several modules use instead, was **not** changed. Its own
"Why the other answers do not fit" panel has the same shape of problem and is recorded below as an
unrelated finding for whoever owns that lane; it was not in this batch's authorisation.

Two other files outside `src/features/ebus-guided` were touched:

- **`src/lib/ebus-model-contract.ts`** — an EBUS-only adapter (consumers: `ebus-guided/content`,
  `lib/ebus-guided-bridge`, and three files under `EBUS-course/apps/web/src/guided/models`). No PI
  or other-module consumer. Section D of the task assigns L21-4 to this batch. The embedded course
  bundle is built from this source at build time and is not committed, so no generated artefact
  changed in Git; a deploy rebuilds it.
- **`.claude/launch.json`** — one added dev-server entry for this worktree's port.

## What each assigned source ID came to

`Reproduced/fixed` means the defect was observed in the running application on this checkout before
the change and observed gone after it. Browser evidence is from the local dev server on port 3128
in the Claude desktop browser pane (Chromium), at the walkthrough's 1246×1021 unless stated.

### A. Feedback category

| ID       | Status                           | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L4-1** | Reproduced / fixed               | Lesson 4 (`acoustic-contact`) and every other Learn check. Choosing a wrong option put the keyed option inside "Why the other answers do not fit".                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **PR-3** | Reproduced / fixed               | Practice case `practice-boundary`, check 1. Chose "4R" (wrong); the disclosure listed `7 — The medial subcarinal location supports station 7.` under the same heading. After: heading reads "How the other answers compare" and the row is prefixed **Best-supported answer.** with `data-other-answer-role="keyed"`.                                                                                                                                                                                                                                                              |
| **CS-6** | Reproduced / fixed               | Both halves. The heading, as above, in the integrated cases (`assessment-sampling`); and the debrief's "The takeaway", which restated the keyed rationale word for word because `question()` authors `explanation` as that rationale. An exact repetition is now dropped; a takeaway that says anything else is kept. Measured in the `assessment-map` debrief: 3 explanation cards, 0 duplicate takeaway blocks.                                                                                                                                                                  |
| **L4-2** | Reproduced / partially addressed | The unsafe card said "Stopping here — this could harm a real patient" while nothing stopped. Replaced through the caller's existing `frames` with "Unsafe — this would put a real patient at risk". Distinguished by text ("Not correct, and unsafe." plus that title), semantics (`role="alert"`, `aria-live="assertive"`) and a shape cue (8 px double left rule), not colour alone. **Not done, deliberately:** the required acknowledgement and the unsafe flag in the lesson summary that the source asked for — both are barred by the self-paced contract and by this task. |
| **CS-3** | Held by contract                 | The source asks for first-and-final response history. The self-paced contract forbids storing a first response, and the task forbids restoring attempt history. The debrief already explains every unsafe option through `QuestionExplanation`, which names an unsafe option as unsafe whether or not anyone chose it, so the safety teaching is available without claiming to remember an erased response. No change.                                                                                                                                                             |

**Where the heading is unchanged.** When the learner took the keyed answer, nothing in the list is
keyed and the original wording is still true, so it is still shown. That keeps the promise the
bronchoscopy-foundations instruction strings make ("then why the other answers do not fit, on this
card") in the case they were written for, and it is why no content in that module needed editing.

### B. Leaving a case

| ID        | Status                               | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PR-7**  | Reproduced / fixed                   | Before: `Leave this case` was a `<Link>` to `/en/ebus-guided/practice` while already at that path, and the "03 Practice" tab the same; measured `caseOpen: true` after both. After: `Leave this case` is a button calling the parent's `onExit`, and the module frame's optional `onReselectSection` handles a click on the one tab marked `aria-current="page"`. Verified from check 1 before answering, from check 2, after a retry, and from the debrief; verified for an integrated case; verified that the Learn tab still navigates normally. |
| **L26-5** | Reproduced / fixed                   | The finish card now offers "Practice cases and labs" and "Integrated cases" side by side with a line saying either is open in any order. The footer's "Continue to <next lesson>" / "Open the integrated cases" is unchanged. Practice is not a prerequisite.                                                                                                                                                                                                                                                                                       |
| **PR-5**  | Partly not reproduced / partly fixed | **Not reproduced:** "Fix the image and document it" does not reopen Learn lessons — it opens the knobology labs inside Practice, with a fresh `practice-<id>-<round>` session. **Reproduced and fixed:** the two links under "Explore anatomy and acquisition" did not say they leave the course; they now name themselves as separate tools and the copy says so. The source's request for new practice variants is new content and is not in this batch.                                                                                          |

**Known consequence, deliberate.** An integrated case opened from a `?case=` deep link leaves the
query in the address bar after Leave. The list is shown; a reload reopens the case, which is the
deep link's existing behaviour. Changing that means a routing state machine, which this task
directs against.

### C. Evidence

| ID        | Status                                              | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PR-2**  | Reproduced / fixed (evidence), held (target marker) | Before: the reference CT was rendered per question, so check 2 of `practice-boundary` — "The same target is viewed through the left main bronchus" — had no image. After: the case's reference is shown for every check of the case, same station, same figure caption identifying it as supplied reference evidence. **Held:** no target marker was added. No verified annotation exists for it, and the task forbids inferring one. → 05.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **L3-8**  | Partially addressed                                 | The pane now says what it holds, and on a check whose `imagePolicy` is not `retained-acquisition` the held activity's instruction no longer says "This is the image you acquired. Interpret it." **Held:** whether the item should be rewritten to ask about the held image, and whether the target should be annotated after commit, are clinical/asset decisions. → 05.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **L5-1**  | Partially addressed                                 | Reproduced with a real acquisition (all five contact states inspected, held in the air-gap state): check 1 asks "An air gap is present…" and check 2 "Why did changing gain fail to remove the dark region behind the reflector?". Check 1 now reads "The image you acquired stays beside this check. This one describes a situation in words, so answer it from the description." **Exact residual mismatch, for 05:** check 2 declares `imagePolicy: 'retained-acquisition'` and names the reflector state, but the held frame is whichever of the five contact modes the learner left selected. The observation contract (`EbusObservation`) carries no contact mode, so the host cannot tell which state is held. Resolving it needs either a new field on the bridge (lane 02/03) or a re-worded item (05). Nothing was overwritten, relabelled or unlocked to paper over it. |
| **L9-4**  | Partially addressed                                 | The measurement lesson's held evidence is labelled and stays visible. **Held:** the recorded phantom number is not carried in `EbusObservation`, and asking about the learner's own measurement is new measurement-dependent reasoning. → 05, as the ledger direction states.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **L11-5** | Partially addressed                                 | Same labelling as L3-8. **Held:** the mismatch between the task title "Explain the model and clinical CT distinction" and the item "Which finding should determine a node's station name?", and the trivial distractor, are content. → 04/05.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

The four identities the task asks to keep separate are now named on the pane, from data the module
already had: `supplied` (authored reference or diagram), `live` (workbench, nothing held),
`held` (a real acquisition this session), `held-missing` (the acquisition was skipped), and
`demonstration` (authored worked example). Verified for each in the browser, including with a real
acquisition driven through the embedded workbench.

### D. Matching, ordering and the record

| ID        | Status                                                 | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L1-6**  | Reproduced / fixed                                     | With 1 of 3 correct, feedback was "One or more pairs need another look". Each row now says whether it matches the authored pairing; selections stay editable and a changed row clears its mark. No count, no score, no required first attempt.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **L1-7**  | Reproduced / fixed (hierarchy), rejected (reveal gate) | "Continue without completing this task" was the bright primary. It keeps its place and its label and is now visually secondary while a task is open; on an acquisition step, where the primary is disabled until a real acquisition, "Continue without an image" carries the weight instead so the only prominent route is not a disabled button. **Rejected, as the ledger directs:** gating "Show the matches" behind an attempt.                                                                                                                                                                                                                                                                                                                                   |
| **L2-3**  | Reproduced / fixed                                     | `list-style: decimal` plus a hard-coded `{i + 1}.` rendered "1. 1. Clarify…". The marker is now the only numbering.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **L2-4**  | Reproduced / fixed                                     | The instruction now says to select the steps in the order you would do them and that Tab + Enter/Space does the same as a click; the running order is labelled "Your sequence so far"; a partial order says how many steps are left and that the check opens when it is complete; a wrong order names the first position that differs, read from the existing key.                                                                                                                                                                                                                                                                                                                                                                                                    |
| **L20-2** | Untouched (owner)                                      | Whether the alternative ordering should be accepted is a clinical/device decision. Which sequences are accepted is unchanged. → 05.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **L12-6** | Partly fixed, partly held                              | **Fixed:** "Negative tissue assessment" returned the survey-completeness sentence; it now returns the reason that applies to it, built from the statement the workspace already carries on that screen ("No needle action, specimen or pathology is supplied for this model task"). **Not reproduced as stated:** "Inadequate image evidence…" is accepted because recording inadequate evidence is a valid declaration for that task. **Held:** whether acceptance should say more about evidence sufficiency is new teaching. → 05. **Not reproduced on this checkout:** the string "This is your last unannotated ultrasound frame" does not exist anywhere in the repository; it is likely from the embedded workbench's own copy (lane 02).                      |
| **L21-4** | Reproduced / fixed                                     | `modelReducer`'s `stop` gave every stop the resistance sentence, including a stop taken because the tip had left the imaging plane with no resistance reported. Each cause now gets the reason already authored for it, and both when both are true. Recorded steps, safety predicates and the block on advancing are unchanged. Verified by unit test on the reducer; not re-driven through the embedded 3D needle model, which belongs to lane 02/03.                                                                                                                                                                                                                                                                                                               |
| **L26-3** | Reproduced / fixed                                     | Every per-node select opened on a real declaration ("Not examined", "Not recorded"). They now open on "Choose…" until the learner enters something, per field, through transient form state that is never written, saved or read back. A stored draft — including a legacy one that really does say "Not examined" — is shown and saved byte for byte; verified by writing a draft, reloading, and comparing. Rendering the form writes nothing (`localStorage` empty before and after). Skipping the record writes nothing and fabricates no field. Validation, the schema and the save path are unchanged, so an unfilled field fails the check exactly as before. The conditional "reason not sampled" field stays conditional but is announced before it appears. |

### E. Context during focus and task navigation

**L1-1 — reproduced, measured, fixed.** At 1246×1021 on the unmodified build, after load and after
every task change:

| Element                            | Before (css px)              | After                                             |
| ---------------------------------- | ---------------------------- | ------------------------------------------------- |
| Site header (sticky)               | 0 → 81                       | 0 → 81 (unchanged)                                |
| "Lesson 4 of 26 · …"               | −32 → −15 (off screen)       | 158 → 175                                         |
| Lesson title `<h1>`                | −15 → 22 (behind the header) | 175 → 212                                         |
| "Task 1 of 5"                      | 36 → 56 (behind the header)  | 226 → 246                                         |
| Task heading (focused)             | 109                          | 299                                               |
| `scroll-margin-top` on the heading | `110px` (a fixed guess)      | `var(--ebus-focus-clear-top)` = 202.9 px measured |

Scrolled to y = 1200 and then changing task: the chrome sticks at 81 → 195 and the identity stays
visible throughout. Keyboard: all 18 focusables inside the lesson flow are fully in the viewport
and hit-testable when focused, at normal text and at 200%. Help, the course outline, Save for
later, Restart and Exit stay in the pinned block. No global focus listener, no locked viewport, no
change to the site header, and the `:has` selectors keep every declaration to pages that render a
lesson.

`useLessonChromeClearance` measures rather than guesses, because the chrome is content-sized:

| Root text    | Chrome height | Pinned          | Reserved                               |
| ------------ | ------------- | --------------- | -------------------------------------- |
| 16 px        | 114 px        | yes             | 202.9 px                               |
| 32 px (200%) | 205 px        | yes             | 374.0 px                               |
| 56 px (350%) | 486 px        | **no** (static) | 510.5 px (capped at half the viewport) |

The cap exists because the **site** header wraps to 1037 px at 350% text — taller than the 1021 px
viewport — and a `scroll-padding-top` at or beyond the scrollport's height stops the browser
scrolling anything into what is left. The oversized site header itself is reported below, not
worked around here.

Viewport matrix, no horizontal scroll from this module at any of them: 1246×1021, 1440×900,
1024×768, 390×844, 320×740. At ≤ 767 px the chrome is static by media query and the reservation
drops to the site header alone (81 px at 390, measured).

**Beta-wrapped route:** not exercised. The beta wrapper is PI platform 05's surface and this
session found no EBUS route behind it; the evidence above is all from the direct
`/en/ebus-guided/**` routes and is labelled as such.

## Verification

| Check                                                                                                      | Command                                                                                                                                                                                                              | Result                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New regressions, on the changed tree                                                                       | `npx jest src/features/ebus-guided/__tests__/pre-review-01.test.tsx`                                                                                                                                                 | 43 passed                                                                                                                                                                                                                                                     |
| The same file on unmodified `origin/main` (separate worktree, new runtime file copied in so it can import) | same                                                                                                                                                                                                                 | **28 of 43 fail**; the 15 that pass are the control assertions — the heading that must stay, "Show the matches" before an attempt, the authored order still accepted, stored-draft preservation, the measuring hook's arithmetic                              |
| EBUS host, routes, matching/sequence/record/bridge/state                                                   | `npx jest src/features/ebus-guided`                                                                                                                                                                                  | 11 suites, 123 tests passed                                                                                                                                                                                                                                   |
| Shared verdict and its consumers                                                                           | `npx jest src/features/learning-module src/features/cardiohelp-ecmo src/features/icu-hemodynamics src/features/mechanical-circulatory-support src/features/bronchoscopy-foundations src/features/peripheral-imaging` | all passed                                                                                                                                                                                                                                                    |
| Whole suite                                                                                                | `npx jest`                                                                                                                                                                                                           | 890 of 899 suites pass. **Nine failures, all pre-existing:** verified by running the same nine on unmodified `origin/main` in a separate worktree, where they fail identically. None touches EBUS, the shared verdict or anything in this diff. Listed below. |
| Types                                                                                                      | `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`                                                                                                                                                            | clean (the default heap OOMs on this repository; not related to this change)                                                                                                                                                                                  |
| Lint                                                                                                       | `npx eslint src/features/ebus-guided src/features/learning-module/components/AnswerVerdict.tsx src/lib/ebus-model-contract.ts`                                                                                       | clean                                                                                                                                                                                                                                                         |
| Formatting                                                                                                 | `npx prettier --check` on the changed paths, and `lint-staged` on every commit                                                                                                                                       | clean                                                                                                                                                                                                                                                         |
| Production build                                                                                           | `npm run build`                                                                                                                                                                                                      | exit 0; 767 static pages generated, standalone output prepared. See note 4 below about running it while the dev server is up.                                                                                                                                 |

**Pre-existing failures, unchanged by this batch** (each confirmed failing at `77a141cc`):
`scripts/ip-preference-cards/check-brochure-intake-static-exposure.test.ts`,
`scripts/ip-preference-cards/us-status/__tests__/safety-boundaries.test.ts`,
`scripts/training-apps.test.mjs`,
`src/features/bronchial-branch-tracing/__tests__/contracts.test.ts`,
`src/features/critical-care/__tests__/accessibility.test.tsx`,
`src/features/critical-care/__tests__/curriculum-sequencing.test.tsx`,
`src/features/critical-care/__tests__/learner-copy.test.ts`,
`src/features/literature/dedicated-supabase/foundation-manifest.test.ts`,
`src/lib/board-review-html.test.ts`.

**Browser checks performed** (Chromium in the desktop app's browser pane, H.264 available —
`Depth8.mp4` decoded at 1920×1080, `readyState` 4, so the walkthrough's WebM substitution was not
needed here):

- fresh load and a returning load with a stored examination draft;
- wrong, correct and unsafe responses in Learn, in a practice case and in an integrated case;
- continuing without answering, through to a debrief;
- revealing the explanation without answering, with the "shown without an answer" note and no
  verdict;
- leaving a case from the first check, from a later check, after a retry, and from the debrief;
- selecting the already-active Practice tab, and confirming other tabs still navigate;
- the case reference CT present on every check of a case;
- a real acquisition driven through the embedded workbench (knobology depth lab and the 3D contact
  model), producing the `held` identity;
- an image check refused when no acquisition was held, with the explanation and "Back to the
  acquisition" still offered;
- the record skipped with nothing written and no field fabricated, and a stored draft restored
  byte for byte.

No safety or identity assertion was relaxed. `labGoalMet`, `retainedImageAvailable`, the hold
handshake, `taskErrors`, `compatibleExamination` and the workbench origin/session checks are
untouched.

## Observations recorded, not acted on

These are outside this batch's mechanisms; they are logged rather than fixed.

1. **`ChoiceReasoningFeedback.tsx`** has the same "Why the other answers do not fit" heading over a
   list that excludes the selected choice rather than the keyed one. Not authorised here; the same
   minimal repair would apply. Its consumers are ECMO foundation, the MCS workbench and CRRT Learn.
2. **The global site header** wraps to 1037 css px at 350% root text at 1246 px wide — taller than
   the viewport — and one of its links overflows the viewport horizontally at 200%. Global chrome
   belongs to the PI platform task, per the coordination guide.
3. **`POST /api/analytics` returns 500** on this local dev server because no Supabase URL/key is
   configured in this worktree. That is a local environment condition, not an application
   regression, and no change to authentication or tracking was made or is authorised.
4. **`npm run build` and the dev server cannot share a worktree.** The dev wrapper's file watcher
   rebuilds the embedded training apps while `build:training-apps` is removing and re-copying the
   same directory, and the copy fails with `ENOENT` on a path it is mid-way through replacing. The
   first build attempt failed this way; with the dev server stopped it completes. Worth knowing
   before anyone reads a build failure as a code defect.

## What a reviewer should look at first

1. The comparison heading on a wrong answer, in all three surfaces (`AnswerVerdict.tsx`), and
   whether "How the other answers compare" with a named **Best-supported answer** row is the
   wording you want.
2. The unsafe title wording, which is a clinical-voice question as much as a truthfulness one.
3. The held-activity instruction rewrites in `LessonHost.tsx`, which change learner-facing
   sentences to stop them claiming something untrue. They are presentation, not clinical content,
   but they are new sentences.
4. The L5-1 residual, which is the one place where the prompt can still name a model state the
   learner is not holding, and which needs either a bridge field or a re-worded item.

## Boundaries

This batch is not a clinical review, a source review, a media-rights review or a usability session.
"Reviewed" in this course still means a place in a browser, not competence. Nothing here is
authorised to merge, deploy, publish or start lane 02.
