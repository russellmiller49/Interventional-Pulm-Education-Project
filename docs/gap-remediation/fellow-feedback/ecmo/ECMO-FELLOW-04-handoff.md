# ECMO-FELLOW-04 — honest self-paced teaching and case flow

Implementation: October 3, 2026. Prepared by Claude (AI implementation). **Not reviewed by a
clinician, a perfusionist or a device specialist.** This is a software and copy remediation. It is
not clinical validation, device validation or release approval, and it closes no
`OWNER_DECISIONS.md` hold.

The separate, earlier handoff
[ECMO-FELLOW-04-save-location-handoff-2026-09-30.md](ECMO-FELLOW-04-save-location-handoff-2026-09-30.md)
records PR #315 (the S2-6 Save & exit disclosure). It is unchanged, and so is the behaviour it
records.

**Result.** Where the module promised something it does not do — an answer withheld, a map without
labels, a step that stops, a blood gas on a console tab, a procedure carried out, a requirement to
review — the sentence now describes what happens. The teaching, the explanations, the readings and
the safety sequences that were on the page are still on the page. Nothing was hidden to make an old
promise true, and no gate, tally, stored answer or required step was added.

Of the 52 source IDs audited (the 51 ledger rows with a lane-04 component, plus S14-1):

- **23 are repaired** here;
- **8 are partly repaired**, with the remainder and its owner named;
- **3 are contained**: the limit is stated on the learner's surface and the clinical design is held;
- **14 were already repaired** by Prompt 01, 02, 03 or PR #315, verified and left alone;
- **2 needed no change**;
- **2 are clinical/content holds** with no change here.

None is "not reproduced". No physiology, coefficient, answer key, threshold, alarm or device
behaviour, persistence, score or source approval changed.

The row-by-row before/after record is in
[ECMO-FELLOW-04-copy-ledger.md](ECMO-FELLOW-04-copy-ledger.md).

**Evidence provenance.** The source rows come from `CARDIOHELP_ECMO_learner_walkthrough.docx`, an
AI-assisted browser walkthrough written in a first-year-fellow persona. It is not a learner study
and not a clinical or device review. Every row was checked against current `origin/main` before any
edit: against the rendered text of a production build where the row is about words on a page, and
against the code where it is not.

## Git

- **Starting `origin/main`:** `9086f2af0a538a0afabf964273cf15a219e165d6` (PR #325, MCS-PRE-REVIEW-04).
  The batch brief named `60e3bd64`; main had moved by #325 alone, which changes MCS paths and no
  ECMO or shared-feedback path.
- **Branch `claude/ecmo-fellow-04`**, in a new worktree
  `Interventional-Pulm-Education-Worktrees/claude-ecmo-fellow-04-10-03`, created from `origin/main`.
  - The desktop session was opened in `codex-ecmo-10-3`, the PR #315 worktree. That checkout was not
    edited, built in or served from. `CLAUDE.md` names a permanent `…/claude` worktree, which does
    not exist; this follows the per-task worktree practice the earlier ECMO prompts used.
  - The Prompt-01, -02 and -03 worktrees and the #315 worktree were not reused.
  - A detached baseline tree at `9086f2af` was made in the session's scratch directory for the
    failing-before and matched-baseline runs.
- **`origin/main` at completion:** `9086f2af0a538a0afabf964273cf15a219e165d6`, fetched again after the
  final checks. It had not moved, so there was nothing to integrate and no check to rerun on a
  combined tree.
- **Commits:**

| SHA        | What                                                                        |
| ---------- | --------------------------------------------------------------------------- |
| `a7c896aa` | Runtime: honest self-paced teaching and case flow                           |
| `68b17da2` | Tests: the Prompt-04 contract; existing suites follow renamed copy          |
| `9387fb1c` | Runtime: two spaces the production build dropped; the case-scope note's box |
| `1e59371a` | Tests: fixture typing                                                       |
| `7567f91d` | Runtime: S3-4 control name, with its check                                  |
| `925b0d7c` | A count in one code comment. **The production build under test.**           |
| _(this)_   | Docs: this handoff and the copy ledger                                      |

- **Ports** (this worktree's own processes only; no other worktree's server or watcher was stopped):
  - 3164: baseline production standalone, an APFS clone of the `9086f2af` build;
  - 3165: final production standalone, stopped before each rebuild.
- **Browser isolation:** Playwright-launched Chromium with a fresh context per page. The owner's
  signed-in profile was not used and `.env.local` was neither created nor copied. For the scripted
  journeys third-party hosts were blocked and `/api/*` answered with an empty stub, as in
  `e2e/ecmo-layout.spec.ts`; the Prompt-01 driver and the #315 save/location spec run unstubbed.

### Open work checked before editing

All 23 open PRs and their changed paths were listed. One touches ECMO or the shared feedback
components: **PR #134** (`claude/critical-care-shared-and-hub`, last updated September 8). It was
read as coordination evidence only. Nothing was merged, cherry-picked or rebuilt from it.

- It edits three ECMO files this branch also edits (`DrillStageHost.tsx`, `FoundationStageHost.tsx`
  and `EcmoOtherAnswers.tsx`), plus shared `AnswerVerdict.tsx`, the shared stage layout and the
  critical-care hub, none of which this branch touches.
- Its intent for `EcmoOtherAnswers` was to delete the module-local list in favour of the shared
  card's `alternatives` prop. Current main already has that prop; ECMO still does not use it. See
  "Shared holds".
- If #134 is revived it must be re-derived against current main, as the Prompt-03 review said.

## Scope

Changed here (34 IDs): S1-3, S1-4, S1-5, S1-6, S1-7, S2-1, S2-7, S2-8, S3-4, S4-4, S5-3, S5-4, S7-5,
S8-1, S9-1, S9-2, S9-3, S10-1, S11-1, S12-1, S12-2, S17-3, VA5-2, VA6-2, VA7-1, VA12-1, VA16-1,
VA17-2, IV-1, IV-2, IV-3, IA-1, IA-2, OV-2.

Already satisfied by an earlier batch, verified, not changed (14): S2-5, S5-5, S7-1, S17-2 (Prompt
03); S3-2, S6-2, S11-2, VAC6-1 (Prompt 02); C7-2, VAC5-2, IA-4 (Prompt 01); C1-5 (Prompts 01 and
03); S2-6, S16-1 (PR #315).

No change needed (2): S7-4 (the target is already beside the instruction), S14-1 (no lane-04
component; contained by 01 and 02).

Clinical/content hold, no change (2): S8-3, S17-5.

Files: 45 under `src/features/cardiohelp-ecmo/` — 25 components (one stylesheet among them), 11
content files (one new, `content/integratedCaseScope.ts`), 8 test files (one new) and one
test-support matcher — plus these two documents. **No file outside the
ECMO feature changed, and no file under its `engine/` or `session/` directories.** `learning-module/**`, `AnswerVerdict.tsx`, `ChoiceReasoningFeedback.tsx`,
`critical-care/**`, global chrome, feedback storage and the beta wrapper are untouched.

## What changed, by kind

### False exam promises

| Where                                       | The promise                                                                              | What is true, and now said                                                                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| The prediction step of all 20 drills        | "Commit to a prediction before you act"; reasoning "held back until you have chosen"     | The prediction is optional; the pattern's teaching stays on the page; an option's rationale appears when chosen or when the explanation is opened. |
| VV and VA capstone prediction               | "Commit to one of the … explanations before looking further"; "then read the comparison" | The comparison is open on the page from the first task and stays open.                                                                             |
| Sections 5 and 6, VA 5 and 6                | "Commit a prediction, then read why the other answers do not fit."                       | An optional answer; the explanation can be opened without one.                                                                                     |
| Section 3 prediction                        | "Submit your prediction before reading the explanation."                                 | The same.                                                                                                                                          |
| Section 2 map question                      | "Locate a measurement from memory"; "The map now omits pressure labels"                  | The map keeps its labels. The task is an optional check on the labelled map.                                                                       |
| Integrated cases, Reassess                  | "Required review domains"; "the response you actually see on the monitor"                | A teaching checklist, readable first; the three selections restate it and are called a guided comparison.                                          |
| Unsafe answers (foundation and drill cards) | "Stopping here — this could harm a real patient."                                        | "This action could harm a real patient." Nothing stops: the lesson continues and the answer can be retried.                                        |
| Section 5 task 1 (VV and VA)                | "Decide which signals belong …" with nothing to decide                                   | "Read which signals belong …".                                                                                                                     |

Not done, on purpose: no answer, title, banner, reading, control-panel box or safety sequence was
hidden; no question was added to justify a verb; no clean-view toggle was built for the map.

### Vocabulary at first relevant use

| Term                                            | What was audited                                                                                                                                                                                  | Outcome                                                                                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The three controls                              | Section 4's "Three adjustments, two control locations" and the recurring control-panel strip.                                                                                                     | Already taught at first use; unchanged.                                                                                                                                                                                |
| Sweep-gas oxygen fraction vs ventilator FiO₂    | The teaching says "sweep-gas oxygen fraction"; the gas panel is labelled "Sweep-gas FiO₂". Section 1 names the sweep gas before either.                                                           | Section 1 introduces the sweep gas (S1-3). Section 4, the gas panel and the console-tour step say that the panel's "Sweep-gas FiO₂" is that fraction and not the ventilator FiO₂ (S4-4). The panel label is unchanged. |
| **FdO₂**                                        | The module never uses it. The registered textbook calls the setting "the FiO2 of the gas delivered" by the blender. FdO₂ appears in a supplied textbook that is not a registered evidence record. | **Not introduced.** Adopting it needs a registered source (clinical/content queue).                                                                                                                                    |
| Drainage-line saturation and the console's SvO₂ | IFU rev. 2.3: "SVO2 — Venous oxygen saturation", from the venous probe. The lessons use four other names for the same reading.                                                                    | Stated once in Section 2 (S2-7). The console label is kept. The names are not normalised module-wide.                                                                                                                  |
| Displayed flow vs effective flow; recirculation | "Flow left after re-drainage" (Section 4) and "Recirculation-adjusted circuit flow" (Section 5) appeared before Section 6 teaches recirculation.                                                  | One gloss at each first use (S4-4).                                                                                                                                                                                    |
| Native output; pulse pressure                   | Both carry value guides and model-boundary notes from earlier batches.                                                                                                                            | Unchanged.                                                                                                                                                                                                             |
| pArt vs patient arterial pressure               | "pArt is pressure in the return-side circuit tubing, not the patient's arterial blood pressure" stands beside the map; Prompt 03 paired pArt with the patient MAP.                                | Unchanged.                                                                                                                                                                                                             |
| pAux                                            | Prompt 03 explains it from the IFU and says this model has no pAux sensor.                                                                                                                        | Unchanged.                                                                                                                                                                                                             |
| Δp                                              | The lessons wrote "ΔP" and "delta-p"; the console tile and the IFU write Δp ("pressure drop … between pInt and pArt").                                                                            | One symbol, the device's, in every learner-facing string, with its meaning at first use (S2-8).                                                                                                                        |
| Alarm list                                      | The step said "Alarm history"; the console menu and IFU §9.2 say "Alarm list".                                                                                                                    | The step says "Alarm list" (S7-5).                                                                                                                                                                                     |
| Battery percent                                 | PR #315 fixed the VV item. The VA item still read "24" with no unit; its scenario field is `batteryPercent: 24`.                                                                                  | The VA stem reads "24 percent" (VA16-1). No run time is inferred. The VV text is unchanged.                                                                                                                            |
| Requested pump setting vs running state         | Prompt 01's "Speed (requested)" and the pump-stop explanation.                                                                                                                                    | Unchanged.                                                                                                                                                                                                             |

### Acquisition and treatment language

- **S12-2.** The step told the learner to read the acid–base picture on the console's Blood
  parameters screen, which shows TVen, TArt, SvO₂, Hb and Hct. It now opens that screen for what the
  console reports and reads PaCO₂, pH and bicarbonate on the independent monitor and blood gas panel.
  The VA counterpart, which implied the right-arm and femoral samples were console values, is
  corrected the same way.
- **S3-4.** The teaching named a "Run control"; it now names the control by the words on it.
- **IV-2 / IA-2.** The integrated cases' Reassess card no longer asks for "the response you actually
  see on the monitor" when the selections are review statements.
- **IA-1.** The VA integrated case's single action is named an authored composite that records
  recognition and escalation and performs no procedure. Its label, effect and credit are unchanged.
- **IV-1 / IV-3.** The VV off-sweep case states what it rehearses and what it cannot establish. No
  separation protocol, threshold, duration, pass/fail call or resume action was written.
- **Safety log.** Prompt 01's sentence is unchanged and still says the empty log "says nothing about
  how the patient is doing", with the patient's readings printed beside it.
- Verified and unchanged: VAC5-2 (escalation is called escalation), VAC6-1 (the limb note matches
  the scenario), C7-2 (harmful action is not badged as success; the clamp sequence stays visible
  before any answer), S8-3 and S10-2 (authored composite transitions), S14-1 (modeled gas
  availability, not a flowmeter reading).

### Navigation

Checked against the pathway registry (`pairedCaseForLesson`, `nextPathwaySection`).

- **S9-3.** A drill's end card offers the next section and a Practice case. For the six drills whose
  unit case applies a _different_ mechanism, the next section now leads and the case follows; for the
  eleven whose case applies the lesson's own mechanism, the case still leads. Both are always
  offered. Of the six, three cases are taught by a later section, one by an earlier section, and two
  (VA vasoplegia, VA limb ischemia) by no section; the card therefore does not say where.
- **C1-5.** The debrief's "Next: …" names its destination, the authored next case; "Continue to
  another topic" returns to the lessons. Unchanged.
- **IA-4.** Integrated cases resolve their lesson link through the mechanism vocabulary (Prompt 01).
  For the VV case that lesson is "Compensated hypercapnia", and the link now says which part of the
  case it teaches.
- No route, id, alias or deep link changed. Every section and case stays open.

### Sequencing and recap

- **S5-3.** The six sections that end in a narrative now show their key points on the first task,
  before the optional prediction, as well as at Explain.
- **S1-7.** Section 1 carries an optional recap on its last task: three of its four existing key
  points, verbatim. The other three introductory sections carry none, because their unshown key
  points reach past what their tasks teach on screen (Section 4's includes "Rapid CO₂ correction has
  its own hazards", which is ECMO-OWNER-09).
- **VA7-1.** The VA console tour says its screen-by-screen tasks are the VV tour and can be passed
  over from the task list.
- **OV-2.** The hub folds the per-source registry and keeps the review status outside the fold.

## Self-paced contract: no-answer, wrong-answer and retry evidence

Driven through rendered controls on the production build (`journeys-04.mjs`), at five viewports.

| Path                                  | What was checked                                                                                                                                                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No answer (drill, Section 9)          | With no option selected: "What explains it" and "The response that fits" are on the page and not folded; the live readings are visible; "Show explanation without answering" opens every option's rationale and leaves the prediction uncommitted. |
| Wrong and unsafe answer (drill)       | "Not correct, and unsafe." is stated; nothing says the activity stopped; the comparison is headed "How the other answers compare"; "Try again" is offered and restores an unanswered question.                                                     |
| Correct answer (drill)                | "Correct." is stated, the explanation stays on the card, and the learner is still on the same task: nothing navigates on its own.                                                                                                                  |
| Unsafe answer (foundation, Section 1) | The same outcome label and the truthful frame; "Continue" and "Try again" both enabled; "Back" and "Show explanation without answering" available before answering.                                                                                |
| Skip (drill end)                      | "Continue without doing this step" reaches the end card; the skipped task is not marked done; no prediction is recorded.                                                                                                                           |
| Integrated case, no answer            | The review checklist is readable before any selection; "Show explanation without answering" opens the debrief; the debrief prints the patient's readings and the scope note.                                                                       |
| Simulation safety refusal (Prompt 01) | Premature Resume is still refused on both air cases while the explanation and debrief stay reachable (`verify-01.mjs`).                                                                                                                            |

No score, mastery threshold, first-attempt record, reveal penalty, assistance tracking, required
acknowledgment, review quota or correctness gate was added. `scoring-honesty.test.ts` and
`self-paced.test.tsx` pass unchanged.

## Persistence

**PR #315's contract is preserved and nothing was added to it.**

- No file under `engine/progress.ts`, `session/**` or `useStoredProgress.ts` changed. No storage key,
  field or write was added.
- The disclosure sentence is unchanged: "Save & exit saves your location, not the current teaching
  or case state. Your existing progress history is retained. Reopening starts fresh; answers,
  snapshots, and simulator actions from this run are not restored."
- The hub link still reads "Return to your saved location".
- `e2e/ecmo-save-location.spec.ts` was run unmodified against this branch's production build:
  **5 / 5 pass** (Learn exit and fresh reopening at 1440, at 390, and at 390 with 200 % root text; the
  saved Practice link by keyboard; a captured snapshot and modeled-run actions cleared on reopening).
- **S2-6:** the disclosure and location portion is repaired by #315. Persisting in-progress answers,
  snapshots or simulator state remains **owner-held and not authorized**; no proposal was
  implemented.

### #315's battery exception, and the VA item

The venovenous transport item, its text ("a battery reserve reading of 24 percent"), its exception
and `transport-battery-unit.test.ts` are unchanged and pass.

VA16-1 is the same finding on the VA item, which #315 did not touch. It now reads "24 percent" and
carries **its own** item-local exception, with a different recorded reason. **This is a second
exception, and the reviewer should decide whether it is wanted.** What holds it:

- the shared learner-copy schema is not edited;
- the new suite asserts that exactly two prediction items carry any exception, the two transport
  items, each with exactly one flagged token, `percent`, equal to its own scenario's `batteryPercent`;
- #315's own check that its exception "does not extend … to another prediction" still passes, because
  it compares reason strings and the VA reason differs. That is stated here so the assertion is not
  read as proof that no second exception exists. If the owner prefers a single exception, reverting
  VA16-1 is one stem and one field.

## Shared holds

**Not edited:** `AnswerVerdict.tsx`, `ChoiceReasoningFeedback.tsx`, the shared stage, global header,
footer and navigation, feedback storage, the beta wrapper.

**`ChoiceReasoningFeedback` (S1-1, and the comparison-heading part of VA6-2).** The shared card still
heads its `alternatives` list "Why the other answers do not fit" unconditionally. For ECMO there is a
finding the pack did not have:

- ECMO's foundation sections render `ChoiceReasoningFeedback` **without** `alternatives`. The list a
  learner sees under a wrong answer comes from a module-local component that predates this round,
  `components/shell/EcmoOtherAnswers.tsx`, with the same unconditional heading.
- So the coordinated shared fix, by itself, **will not repair ECMO's S1-1**. ECMO needs either to
  pass `alternatives` to the fixed shared card and retire `EcmoOtherAnswers` (PR #134's original
  intent), or to have that module-local heading corrected by an ECMO session the owner assigns.
- It was left alone here: S1-1 is a SHARED-lane row, and the brief rules out a local alternate to
  the shared behaviour. The keyed alternative is not hidden. Concept links, evidence links, retry
  and reveal timing are unchanged.
- The drill half is unaffected: it renders `AnswerVerdict`, whose corrected heading ("How the other
  answers compare") is consumed as merged.

**Unsafe wording.** The shared default titles still open "Stopping here". ECMO now overrides them
through the `frames` prop both cards already offer. Whether other modules should say the same is the
shared owner's call.

## Clinical and content queue (for Prompt 05; nothing here is implemented)

All NOT REVIEWED. These are proposals for a reviewer, not approved content.

### Weak or repetitive questions (10)

| #   | Source ID        | Current problem                                                                                                 | Proposed direction                                                                           | Decision needed                                                                       |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Q1  | S17-5            | VV capstone task 6 re-asks the Section 6 recirculation stem almost verbatim.                                    | A new transfer case that needs the capstone's comparison, not Section 6's.                   | Clinical authoring; which discrimination the transfer should exercise.                |
| Q2  | VA6-2            | VA Section 6 task 6: the key is the only mechanistic option and the longest.                                    | Parallel-length, parallel-kind options.                                                      | Clinical wording of three plausible mechanisms; key unchanged.                        |
| Q3  | IV-2             | The VV integrated case's Reassess options are built from its checklist; the distractors are straw men.          | Authored observed-response options read from the monitor after the trial.                    | What response the case expects, which depends on ECMO-OWNER-11.                       |
| Q4  | IA-2             | The same, VA integrated case.                                                                                   | The same.                                                                                    | The expected right-arm, pulsatility and perfusion findings.                           |
| Q5  | S8-3             | "Correct the identified drainage cause" is one action; the learner never chooses a cause from the evidence.     | An optional question: which cause the evidence points to (cannula, kink, straining, volume). | Evidence per cause, and whether the model should respond differently (ECMO-OWNER-10). |
| Q6  | Section 1 task 3 | The key is ≥1.6× the average distractor length (walkthrough §3.6).                                              | Equalise option length.                                                                      | Editorial, with clinical read.                                                        |
| Q7  | Section 2 task 6 | The same.                                                                                                       | The same.                                                                                    | The same.                                                                             |
| Q8  | Section 5 task 6 | The same.                                                                                                       | The same.                                                                                    | The same.                                                                             |
| Q9  | S2-1             | With the map labelled, the pInt location question is a look-up.                                                 | Keep it as a guided look-up, or add an optional clean-view toggle that is never required.    | Design choice; no gate either way.                                                    |
| Q10 | S16-1 / VA16-1   | The transport drills' Practice reassessment uses the same checklist-restating fallback as the integrated cases. | Authored observed-response options.                                                          | Expected device, circuit and patient findings after AC is restored.                   |

### Integrated-case storyboards (2)

- **SB1 — VV off-sweep (IV-1, IV-3).** Either a short, source-linked primer on separation from VV
  support ahead of the case, with an optional step in which the learner reads the response and
  chooses to continue or to restore the sweep; or a replacement case built from mechanisms the track
  teaches. Needs ECMO-OWNER-11, and ECMO-OWNER-09 for any statement about duration.
- **SB2 — VA mixed circulation (IA-1).** Replace the one composite action with separate optional
  reasoning choices (which reading to verify, which circulation to assess, when to escalate), none of
  which claims a procedure was performed. Needs ECMO-OWNER-11 and ECMO-OWNER-12.

### Source needs

- **Oxygen-content arithmetic (S1-7).** The 1.34 mL/g constant and the delivery product are cited to
  the bounded educational model only. A physiology source should be registered.
- **FdO₂ (S4-4).** Register a source that uses the term before adopting it. The registered textbook
  says "FiO2 of the gas delivered"; the ELSO VV guideline is registered but was not available
  locally to check.
- **One lesson name for the venous-line saturation (S2-7).** The device label is verified. Choosing
  one of the four lesson names module-wide is an editorial decision.
- **Section 4's unshown key point** "Rapid CO₂ correction has its own hazards" (ECMO-OWNER-09). It is
  not rendered today; it must not be surfaced without source support.
- **Two cases with no teaching lesson:** VA vasoplegia and VA limb ischemia are offered as "next case
  in this unit" from lessons that teach other mechanisms.

### Observations, with owners

| Observation                                                                                                                                                                                            | Owner                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| Section 1: the explorer prints oxygen content 13.3 mL/dL and the "Current components and model detail" disclosure on the same task prints 13.2 mL/dL. Not assigned to this batch; not changed.         | 02 / content              |
| Section 5 tasks 3 and 4 show the same table (S5-3 remainder).                                                                                                                                          | Content (phase structure) |
| The six authored drill panels fold their mechanism block until Explain; the fourteen data-driven drills show it open (S9-2 remainder).                                                                 | Content / owner           |
| VA tasks 2–13 repeat the VV console tour (VA7-1 remainder).                                                                                                                                            | Curriculum mapping        |
| The production build drops a leading space that only the JSX layout implies after an inline element or expression. Two new sentences were caught by the browser run and fixed; jsdom does not show it. | Build tooling (repo-wide) |
| 2D map and 3D scene disagree on the cannulated side (Prompt 03).                                                                                                                                       | ECMO-OWNER-12             |

### Owner decisions that stay open

ECMO-OWNER-01 through -12 are all NOT REVIEWED and none is closed here. Touched by this batch's
containment: **-09** (time and CO₂ pacing), **-10** (unrepresented responses, cause selection),
**-11** (integrated-case scope: the off-sweep decision, the resume action, the VA composite) and
**-12** (orientation material). Also open: broader in-progress persistence (S2-6), the second
battery exception (VA16-1), and who corrects ECMO's module-local comparison heading (S1-1).

## Regression evidence

### Jest

| Check                                                                                                                                                     | Baseline `9086f2af`             | Final                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full ECMO (`src/features/cardiohelp-ecmo`)                                                                                                                | 81 suites, 2,511 / 2,511        | **82 suites, 2,588 / 2,588**: the 2,511, the 76 new checks, and one more instance of an existing parametrized guard (it now scans the new file). |
| New suite `ecmo-fellow-04-teaching-and-flow.test.tsx`                                                                                                     | **69 of 75 fail** (see below)   | 76 / 76                                                                                                                                          |
| Prompt 01 (`ecmo-fellow-01-recovery-and-state-truth`)                                                                                                     | 43 / 43                         | 43 / 43                                                                                                                                          |
| Prompt 02 (`ecmo-fellow-02-causality-and-time`, `-surfaces`)                                                                                              | 70 + 33                         | 70 + 33                                                                                                                                          |
| Prompt 03 (`ecmo-fellow-03-console-and-visual-workbench`)                                                                                                 | 28 / 28                         | 28 / 28                                                                                                                                          |
| #315 (`save-location-disclosure`, `transport-battery-unit`)                                                                                               | 2 + 7                           | 2 + 7, both files unmodified                                                                                                                     |
| Self-paced, progress, restoration, scoring (`self-paced`, `progress`, `foundation-phase-restoration`, `scoring-honesty`, `learn-precommit-leak.rendered`) | pass                            | pass, unmodified                                                                                                                                 |
| Consumers (critical-care, learning-module, icu-simulation, ECMO and critical-care routes, analytics, module-beta)                                         | 59 suites, 700 pass, **3 fail** | 59 suites, 700 pass, **the same 3 fail**                                                                                                         |

- **Failing before.** The new suite was run on a detached `9086f2af` tree with one compile-only stub
  for the new content module. 69 of the 75 checks then present failed, every one at an assertion or a
  lookup of the new words. The 6 that pass are premise or preservation checks: the drill count, the
  authored panel's disclosure, the console Blood parameters screen having no blood gas, the #315
  venovenous text, the recap-is-a-subset rule, and the VA step order. (The 76th check, S3-4, was
  added afterwards and verified against the baseline string it replaces.)
- **The three consumer failures** are the CRRT station order, the critical-care colour-accessibility
  sweep, and the general learner-copy sweep (MV and MCS files). They are identical on the clean
  baseline tree, name no ECMO file, and were not touched. The ECMO-specific learner-copy check
  passes.
- **Existing ECMO tests changed**, each because it pinned words this batch replaced: two step
  headings and one console-menu query made exact (`learn-walkthrough`), the checklist heading
  (`components`), the hub checklist selector (`evidence-surface`), and the Δp symbol in four files'
  fixtures. No assertion about behaviour was weakened.

### Static checks and build

| Check                                      | Result                                         |
| ------------------------------------------ | ---------------------------------------------- |
| TypeScript, whole repository, 8 GB heap    | exit 0                                         |
| ESLint, changed TypeScript paths           | exit 0                                         |
| Prettier `--check`, changed paths          | clean                                          |
| `git diff --check`                         | clean                                          |
| `npm run build` (full, with training apps) | exit 0 at the baseline and at the final commit |

### Browser

Production builds only: the baseline at `9086f2af` (port 3164) and the final build at `925b0d7c`
(port 3165). Headless Chromium (the full binary, new-headless mode), a fresh context per journey,
DPR 1, `prefers-color-scheme: dark`, reduced motion.

**Viewports:** 1280×961; 390×844; 390×844 with **200 % root font** (`html { font-size: 32px }`);
320×740; 320×740 with 200 % root font. Root-font enlargement is not CSS zoom and not native browser
zoom; neither of those was driven.

**Changed-flow journeys** (`journeys-04.mjs`, 70 checks per viewport, 350 in all):

| Journey                                                                                                   | Baseline  | Final         |
| --------------------------------------------------------------------------------------------------------- | --------- | ------------- |
| J1 — a data-driven drill: optional prediction, explanation first, unsafe answer, retry, correct, end card | 65 / 95   | 95 / 95       |
| J2 — Section 1: no "beside you", unsafe verdict, sweep gas introduced, recap                              | 30 / 50   | 50 / 50       |
| J3 — Sections 2, 4, 5, 7, 12, the VV capstone, VA 7 and VA 16 copy                                        | 50 / 110  | 110 / 110     |
| J4 — VV integrated case: scope, checklist, live sweep control, the trial's readings, debrief              | 40 / 60   | 60 / 60       |
| J5 — VA integrated case and the hub                                                                       | 13 / 35   | 33 / 35       |
| **Total**                                                                                                 | 198 / 350 | **348 / 350** |

| Viewport            | Baseline | Final   |
| ------------------- | -------- | ------- |
| 1280×961            | 40 / 70  | 70 / 70 |
| 390×844             | 40 / 70  | 70 / 70 |
| 390×844, 200 % root | 39 / 70  | 69 / 70 |
| 320×740             | 40 / 70  | 70 / 70 |
| 320×740, 200 % root | 39 / 70  | 69 / 70 |

- **The two checks that do not pass are the same two that do not pass on the baseline:** the ECMO hub
  scrolls sideways with 200 % root text (document 418 px wide in a 390 px viewport, 410 px in 320).
  The width is identical before and after, so this batch neither caused nor changed it. Hiding the
  page's `main` removes it and hiding the global header does not: it is the hub's own module
  navigation and continue link. It is a layout follow-up for lane 03, recorded and not fixed here.
- **Page overflow elsewhere:** 83 of 85 overflow checks pass on both builds; the two are the hub rows
  above. Every changed Learn, Practice and integrated surface holds its width at all five viewports,
  including the longer instructions.
- **Keyboard:** at all five viewports the "Commit this prediction" control takes focus, is inside
  the viewport when focused, and commits on Enter.
- **The integrated-case scope note's claim was checked in the browser:** after "Set sweep to zero",
  the gas blender's sweep control is still enabled.
- **Page errors:** none in any journey.
- **Found by this run and fixed:** two new sentences lost a space on the production build ("15sources
  are registered", "several names.The console"). Jest could not see it. Both are fixed in `9387fb1c`,
  and the journeys assert the spaces.

### Prompt 01, 02, 03 and #315 preservation in the browser

All on the final production build (port 3165).

| Suite                                                                    | Result                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt 01 driver (`verify-01.mjs`, assertions unmodified)                | **29 / 31.** Pass: VV and VA air (premature Resume refused → isolate → de-air → Resume → repeat press inert); the safety card with the explanation reachable without a restart; the harmful card's badge; the protective stop with the requested speed kept; the Resume control at four viewports; the keyboard sequence at 320 px with 200 % root text. The 2 that fail are "no page errors" on the two air cases. |
|                                                                          | Those are RSC prefetches of global-navigation pages returning 500 because this worktree has no Supabase credentials. Prompt 01's own run, Prompt 03's and PR #315's recorded the same two.                                                                                                                                                                                                                          |
| Prompt 02 driver (`verify-02.mjs`, assertions unmodified)                | **29 / 29.** Includes: authored values at t = 0; no hidden loading second; same-second recomputation leaving patient time alone; the reveal freezing the run; untreated C5, VAC5 and VAC2 not recovering; the C3 protective-stop chronology; the immutable action observation; the debrief's untreated comparison.                                                                                                  |
| Prompt 03 specs (`e2e/ecmo-layout.spec.ts`, `e2e/ecmo-focus.spec.ts`)    | **36 / 36** in 12.7 minutes, unmodified, through `playwright.ecmo-layout.config.ts` with `ECMO_LAYOUT_BASE_URL` set to the final build: every Learn section's reading and headers at six viewports, the console and table reflow, the focus and Tab-order specs, and the 200 % text spec.                                                                                                                           |
| PR #315 spec (`e2e/ecmo-save-location.spec.ts`, unmodified, no API stub) | **5 / 5.**                                                                                                                                                                                                                                                                                                                                                                                                          |

Prompt-01 and -02 state truth was not touched: no file under `engine/` or `session/` changed, so the
reducer, the patient model, the resumption contract, the time gates and the stored-progress code are
byte-identical to `origin/main`. Prompt-03 layout code changed only where a new sentence or the `Δp`
symbol sits inside it; one small CSS block was added for the case-scope note.

## NOT RUN

- Native browser zoom, CSS `zoom`, and device pixel ratio above 1. The "200 %" runs set the root
  font size to 32 px; that scales rem-based type and thresholds and is not native zoom.
- Any browser other than Chromium; a screen reader; a touch device; translations (`es`, `zh-CN`).
- The signed-in and beta-wrapped routes: this worktree has no `.env.local`, by rule, so anything
  that needs Supabase returns 500, as on the baseline.
- A real CARDIOHELP console, and any learner observation.
- Other modules' e2e suites. Deployment.
- The 3D scene was not changed and was not re-measured beyond the Prompt-03 layout and focus specs.

## Readiness

- **Software/runtime merge readiness:** READY for independent review as a bounded copy and
  presentation change.
- **Clinical/device/content readiness:** NOT REVIEWED. The integrated-case scope notes, the recap
  selection, the first-use glosses and every reworded teaching sentence are AI-authored and
  unreviewed. Several rows are BLOCKED ON OWNER DECISION (ECMO-OWNER-09, -10, -11, -12).
- **Release readiness:** NOT ESTABLISHED.

No merge, no deployment, and no Prompt 05 or Prompt 06 work was performed.

## Evidence

Outside Git, in
`Interventional-Pulm-Local-Data/renders/output/ecmo-fellow-04-2026-10-03/`:

- `baseline/learn-text/` and `baseline/practice-text/`: the rendered text of every Learn step (240)
  and every Practice and integrated case stage on the baseline build, used for the "before" column;
- `baseline/journeys/`, `final/journeys/`: the journey results as JSON, with verdict screenshots;
- `final/shots/`: element screenshots of the changed surfaces at three viewports;
- `probe/`: every driver (`journeys-04.mjs`, `dump-text.mjs`, `dump-practice.mjs`, `shots-04.mjs`);
- `regress/`: the Prompt-01 and Prompt-02 drivers and their logs;
- `logs/`: build, Jest (JSON and text), failing-before, consumer, TypeScript, ESLint, Prettier and
  server logs.

To reproduce the journeys: `npm run build`, serve `.next/standalone` with `PORT=3165`, then
`node probe/journeys-04.mjs http://127.0.0.1:3165 final <outdir>`.
