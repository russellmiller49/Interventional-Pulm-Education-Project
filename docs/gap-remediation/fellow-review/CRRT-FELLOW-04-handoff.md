# CRRT-FELLOW-04 — optional teaching, truthful terminology and units

**Status:** implementation complete for the assigned findings. One bounded PR, not merged, not
deployed.

**Assigned:** F-06, F-07, F-19, F-20 (semantics), F-21, F-23, F-24, F-25; X-01, X-03 (split
proposal only), X-04.

**Not started here:** prompt 05 (clinical, device and source decisions, including every
owner-review proposal in `CRRT-FELLOW-04-owner-proposals.md`) and Batch 06 (combined acceptance).

**Companion documents:**

- `CRRT-FELLOW-04-copy-sheet.md` — before/after learner copy.
- `CRRT-FELLOW-04-owner-proposals.md` — ten proposals, all NOT REVIEWED.

## 1. Execution context

| Item                        | Value                                                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repository                  | `russellmiller49/Interventional-Pulm-Education-Project`                                                                                                                                                                  |
| PR #268 / CRRT-FELLOW-03    | **MERGED** as `bf15fb951387e9246b260a5b7336f46e86207f50` (2026-09-22 17:25:54 −0700)                                                                                                                                     |
| **Base SHA**                | `a306d8250ec10207c750f46407f151c06d487707`, which was `origin/main` at the start fetch and still was at the final fetch. It contains the PR #268 merge (checked with `git merge-base --is-ancestor`).                    |
| Worktree                    | `Interventional-Pulm-Education-Worktrees/claude-crrt-04`, created fresh from `origin/main` for this task. It did not continue from `claude/crrt-fellow-03`, the Codex CRRT-03 sanity branch, or any older CRRT worktree. |
| Branch                      | `claude/crrt-fellow-04`                                                                                                                                                                                                  |
| Dev server                  | `node node_modules/next/dist/bin/next dev --webpack -p 3113`, the CRRT Playwright config's own server. It was started with `CI=1` so a server already on the port could not be reused.                                   |
| Production server           | `node .next/standalone/server.js` on 127.0.0.1:3113, from this worktree's `npm run build` output. Its working directory was checked before use.                                                                          |
| Environment                 | Synthetic values passed on the command line: `NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only`, `NEXT_PUBLIC_MODULE_FEEDBACK_MODE=owner-local`                            |
| Browser                     | Playwright Chromium: isolated contexts with fresh storage for every test. No signed-in browser; only synthetic local progress was used.                                                                                  |
| Content version             | `1.1.0-sme-review.1`, unchanged. Engine version unchanged. `engine/deviceAdapters/prismax.ts` changed only in one learner string and comments.                                                                           |
| Validated code head         | `a28e335e154e7704841e4da1e02db5d919797388` (implementation). This handoff is in the following docs-only commit, whose SHA is reported in the PR rather than embedded here.                                               |
| `.env.local`, `launch.json` | **Not created and not modified.** The Playwright CRRT config gained one `testMatch` entry for the new spec.                                                                                                              |

**Active worktrees at start:** 83 registered. The CRRT-relevant ones:

- `claude-crrt03` — Batch 03, merged, idle.
- `codex-crrt03-review` / `codex-crrt03-base` — the Codex sanity review of Batch 03.
- `~/.codex/worktrees/codex-crrt-257-*` and `codex-crrt-263-*` — earlier sanity reviews.
- A scratch worktree of the base SHA used for baseline tests. It was removed at the end.

No other session's process was stopped. Only this worktree's dev and production servers on 3113
were started and stopped.

## 2. Surfaces changed

| Surface                                   | What changed                                                                                                                                                       | Findings               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| Hub                                       | "Before you start" orientation; Eye + "Visited" markers with screen-reader meaning; station badge; Glossary button                                                 | F-20, X-01, F-24       |
| Learn landing                             | Minutes labeled as authoring estimates; US spelling                                                                                                                | X-01, F-24             |
| Learn lessons (all 8)                     | All 25 application checks (optional-try framing, worked explanation, explicit accepted and not-accepted feedback); lesson header Glossary; restart scope; L8 title | F-06, F-24, F-25       |
| Learn L2 pressure lab (and Practice uses) | Per-signal comparison column and "Why each signal moved"                                                                                                           | F-23                   |
| Learn L7 recorded balance                 | Compare, name categories and sign, worked calculation, single-slip diagnosis or general hint                                                                       | F-21                   |
| Learn runs                                | "Guided version of Practice case CRRT-nn" captions and teaching                                                                                                    | X-04                   |
| Practice / Challenge case player          | Factual action descriptions, unsafe-action teaching (Explain, debrief), reset scope, simulated alert labels, reuse label, single debrief                           | F-07, F-19, F-25, X-04 |
| Safety drills                             | Response legend, reveal-first worked example, verdicts only after a check or reveal, "Reset this drill" with scope                                                 | F-07, F-25             |
| Device interface and evidence panels      | Simulated alert labels and boundary; plain citations with a record disclosure; spelling                                                                            | F-19, F-24             |
| Sources panels (lessons, hub, citrate)    | Plain status; CONFLICT IDs and pages kept; source-record disclosures                                                                                               | F-19                   |
| Shared catalog (CRRT rows only)           | Lesson 8 title in `critical-care/content/learningPathways.ts` and `activities.ts`                                                                                  | F-25                   |

New modules:

- `content/glossary.ts`, `content/concentrationUnits.ts`, `content/alertLabels.ts` and `content/stateLabels.ts`.
- `balanceFeedback.ts`, `caseReuse.ts` and `sourcePresentation.ts`.
- `components/CrrtGlossary.tsx` (+ CSS) and `components/CrrtSourceRecord.tsx`.

Shared components were traced before use and **not edited**:

- `AnswerVerdict` / `ChoiceReasoningFeedback`. CRRT items carry no plausibility data, and
  assigning one would be a clinical classification.
- `learning-module/stage`.
- `ActivityChrome`.
- `PathwayLanding`.
- `DebriefPanel`. Its only consumer was CRRT, which no longer renders it; see F-18 residual in §3.

## 3. Findings

### 3.1 F-06 — application checks: optional explanatory practice

**Audit.** All 25 learner-visible items were read against the report. These are the editorial
signals. They are not measures of learning.

| #   | Lesson · task | Task ID                   | Options | Accepted answer(s)                    | Longest is accepted | Absolute wording (D = distractor, K = key) | Action here                 |
| --- | ------------- | ------------------------- | ------- | ------------------------------------- | ------------------- | ------------------------------------------ | --------------------------- |
| 1   | L1 · 4        | `goals-case`              | 3       | two-goals                             | yes                 | D: alone                                   | cat. 1                      |
| 2   | L1 · 5        | `goals-transfer`          | 3       | gain                                  | yes                 | —                                          | cat. 1                      |
| 3   | L2 · 5        | `unknown-pattern`         | 3       | access-region                         | yes                 | D: proves, establishes                     | cat. 1                      |
| 4   | L2 · 6        | `pressure-transfer`       | 3       | return                                | yes                 | D: alone                                   | cat. 1 · **P-04**           |
| 5   | L3 · 4        | `transport-case`          | 3       | diffusion                             | no                  | D: establishes                             | cat. 1                      |
| 6   | L3 · 5        | `transport-transfer`      | 3       | convection                            | yes                 | D: All                                     | cat. 1 · **P-07**           |
| 7   | L4 · 4        | `dose-transfer`           | 3       | 12.5                                  | yes                 | —                                          | cat. 1                      |
| 8   | L4 · 5        | `fluid-transfer`          | 3       | positive                              | yes                 | D: must                                    | cat. 1                      |
| 9   | L5 · 4        | `delivery-interpretation` | 3       | recorded                              | no                  | D: alone, proves                           | cat. 1                      |
| 10  | L5 · 6        | `alarm-localize`          | 3       | inspect                               | yes                 | —                                          | cat. 1                      |
| 11  | L5 · 8        | `alarm-continuation`      | 3       | resume-verify                         | yes                 | D: every, automatically                    | cat. 1 · **P-08**           |
| 12  | L5 · 10       | `alarm-transfer`          | **2**   | not-restored                          | yes                 | D: alone                                   | cat. 1 · **P-06**           |
| 13  | L6 · 3        | `sample-application`      | 3       | circuit-only                          | yes                 | D: established                             | cat. 1                      |
| 14  | L6 · 6        | `metabolic-application`   | 3       | accumulation-concern                  | yes                 | —                                          | cat. 1                      |
| 15  | L6 · 7        | `alkalosis-application`   | 3       | net-alkali                            | yes                 | D: established                             | cat. 1                      |
| 16  | L6 · 8        | `citrate-transfer`        | 3       | parallel-assessment                   | yes                 | —                                          | cat. 1 · **P-09**           |
| 17  | L7 · 4        | `missing-chart-data`      | **2**   | reconcile                             | yes                 | —                                          | cat. 1                      |
| 18  | L7 · 7        | `flow-transfer`           | 3       | separate                              | yes                 | K: all · D: alone                          | cat. 1 · **P-03**           |
| 19  | L7 · 9        | `liberation-transfer`     | **2**   | reassess                              | yes                 | D: solely                                  | cat. 1 · **P-01**           |
| 20  | L8 · 2        | `case-localize`           | 4       | return-resistance + outflow-uncertain | yes                 | D: established · K: alone                  | cat. 1 (multi-key feedback) |
| 21  | L8 · 3        | `case-inspection-choice`  | 3       | inspect-return                        | yes                 | D: alone ×2                                | cat. 1                      |
| 22  | L8 · 5        | `case-anticoagulation`    | 3       | review-strategy                       | yes                 | D: establishes                             | cat. 1                      |
| 23  | L8 · 6        | `case-plan`               | 3       | defer + correct                       | yes                 | —                                          | cat. 1 + **cat. 2** (leak)  |
| 24  | L8 · 9        | `case-reassess`           | 3       | reconcile                             | yes                 | D: whenever                                | cat. 1 · **P-02**           |
| 25  | L8 · 10       | `integration-transfer`    | 3       | request-history                       | yes                 | D: establish                               | cat. 1 · **P-05**           |

Totals: 23 of 25 items have one accepted answer; 3 have two options; in 23 the accepted answer is
the longest option; absolute wording appears in 22 of 46 distractors and 2 of 27 accepted answers.

The eight `lessonClinicalAnchors.ts` items are not rendered by any component and were not changed.

**Category 1: presentation, implemented for all 25.**

- Kicker "Apply · optional try", with an intro saying it is optional, nothing is saved or
  counted, and the worked explanation may be opened first.
- "Show worked explanation" is available before any answer. It marks every option **Accepted
  answer** or **Not accepted**, with its authored rationale.
- After a check the heading says the outcome in words:
  - "Your choice matches the accepted answer"
  - "… is one of the accepted answers"
  - "… is not the accepted answer"
- The feedback also shows "You chose:", the accepted answer(s) with rationale on a miss or when
  several are accepted, and "How every option compares".
- Try again, continue and skip are unchanged. Evidence stays in memory; there is no attempt
  count, first-attempt record or score, and `learnTaskHistory` stays undefined.
- Answer IDs, keys, option text and option order are unchanged. Nothing is shuffled.

**Category 2: safe wording, clinical meaning unchanged, implemented.**

- **L8 `case-plan` instruction leak.** It named one of the two accepted plans: "A continued
  pause for escalation is also supported when cause correction cannot be verified." It now reads
  "Use the inspection and the paused state to choose a plan. More than one plan can be supported."
- **L8 unsafe-flow feedback.** "Your first choice is retained" implied a stored attempt; it was
  reworded.
- **L8 case entry and transfer.** Wording now names Practice case CRRT-14 instead of "an existing
  engine case".

**Category 3: substantive.** Options, distractors and keys are **PROPOSED FOR OWNER REVIEW**:
P-01 to P-09 in the owner packet. The cue statistics ranked these items; they are not a target.

Tests: `fellow04TeachingFeedback.test.tsx` checks:

- the 25 items and keys are stable, and no instruction contains a key;
- read-first and reveal-first paths;
- wrong, right and empty answers, retry and skip;
- multi-key feedback;
- nothing is persisted.

### 3.2 F-07 — drills and action cards have truthful labels

**Drills.**

- The legend asked for the "likely cause" while the options were responses. It now reads
  "Optional try: choose a first response before the worked example".
- Before, the verdict text ("Safe path:", "Accepted alternative:", "Unsafe because…") was printed
  under every option before any choice. Now options show labels only. The verdict and description
  appear after "Check this response" or "Show worked safety example".
- The chosen option carries its verdict in words: Accepted first response, Also accepted, or
  Unsafe.
- Headings match the operation: "Worked safety example".
- Authored order is kept and there is no shuffle. The safe option is first in the authored order;
  changing that is a content decision and is not in this batch.
- "Reset this drill" states its scope.

**Action cards.**

- 13 adapted-case descriptions that were verdicts ("This path intentionally bypasses a required
  safety or verification step for debriefing.", "Use this alternative with the same safety
  checks…", "Complete the assessment first…") now say factually what performing the action does.
  Adapted cases have no simulated effects, and that is said.
- 13 exact unsafe-explanation strings with internal jargon were rewritten in plain words, for
  example "Pending simulated critical-error option" → "Unsafe action in this case".
- A list-level note says the list includes unsafe actions and where to learn which ones.
- **Explain this case** lists the actions the case treats as unsafe, with reasons.
- The debrief lists both the unsafe actions performed and those not performed.
- No card is marked before a choice. Labels are unchanged.

Tests:

- `fellow04TeachingFeedback` (`it.each` over every case: no verdict words on any card; unchanged
  labels; Explain and debrief lists).
- `CrrtRapidDrillReview.test.tsx` (updated wording).

**FIXED.**

### 3.3 F-19 — plain main-path status, exact audit detail one disclosure away

`sourcePresentation.ts` turns each source record into a plain learner citation: kind, title,
edition, locator and review. The verbatim record is kept as `audit`, and
`CrrtSourceRecord` shows it in a "Source record {id}" disclosure: registered version, registered
section, review status (plus "no reviewer recorded"), "Used in", and a note for "sme-review"
version strings.

- **Reviewer and build jargon** leaves the main path. For example, "LAB-PRESCRIPTION reviewer
  prototype" becomes "Staged prescription builder", and "private learning fixture" becomes
  "Case CRRT-17". URLs leave the locator and stay in the audit record.
- **Draft status stays visible** in plain words:
  - "No clinical review recorded"
  - "Draft teaching: no clinician or device specialist has reviewed …"
  - "Clinical and device review of how this module uses it: none recorded yet"
- **No status is upgraded.** A test checks every pending source. An "sme-review" build string gets
  the note "It does not mean a subject-matter expert has reviewed it."
- **Conflicts are not rewritten away.** L4 says "Not calculated here: filtration fraction." and
  that it does not respond to the flows, with "CONFLICT-002, manual p220" and "CONFLICT-001,
  manual p218" kept.
- **Makeup stays unresolved:** "Unresolved: makeup flow", with the consequence that cumulative
  machine removal and whole-patient balance are withheld.
- **Device-manual citations** keep identity, edition, program and page. For example: "PrisMax
  Operator's Manual · AW8035 Rev B JUN2019 · program 2.XX · Manual p217 · PDF p218".
- **Generic alerts** are labeled as simulated for every engine code, and unknown codes read
  "Simulated alert". The boundary text says they are not PrisMax alarm names and that no
  manufacturer priority, color or automatic pump response is mapped. "Priority: none shown"
  replaces "Priority status: not mapped — independent device review required". No manufacturer
  name, priority or reset behavior is invented.
- **Software words** leave learner copy: engine, reducer, engine-generated, scored.

The learner-copy gate's CRRT findings went from 10 to 0.

**F-18 residual, found during this audit (owner: Batch 01).** After "End run and review
debrief", a second, generic panel still rendered below the case's own debrief. This was the
shared `DebriefPanel`, left in `CrrtActivityWorkspace` from before Batch 01. It showed:

- "Your clinical model: {authored summary}";
- "What you did: intervention performed · debrief revealed" — raw event types;
- "What happened: {the worked causal chain}", even when the run did none of it.

That is the report's F-18 text word for word. CRRT no longer renders that panel. Batch 01's
debrief is unchanged and remains the only one. It keeps "What you did in this run" apart from the
labeled worked example, and it already carried the transfer question and the causal chain. No
competing debrief was created. The shared component itself is untouched; CRRT was its only
consumer. Reviewers who prefer a different fix can revert this one hunk, which is self-contained.

Tests: `fellow04SourcesAndAlerts.test.tsx` covers:

- plain versus audit citations;
- the sme-review note and no upgrade;
- the device line;
- the L4 panel;
- alert labels for every code;
- CRRT-13 in Practice;
- exactly one "Causal debrief", no raw event types and no "Your clinical model".

**FIXED** (presentation), with conflict and makeup **OWNER/SOURCE HOLD**s preserved.

### 3.4 F-20 — "Visited" means opened

- Hub chips and the Learn sequence show an Eye icon and "Visited". For screen readers they add
  "— opened on this device; not a record of completion". The tick icons are gone.
- A station reads "Every lesson and core case here opened", plus "on this device; not a record of
  completion" for screen readers.
- The orientation defines "Visited", and says a lesson whose exercises you skipped still shows as
  visited.
- The storage contract is unchanged: `selfPaced.visitedLessonIds` and `visitedCaseIds` are
  location-only. Legacy `completedLessonIds` and `completedPracticeCaseIds` are never read as
  visited and never written by the hub; their stored bytes are unchanged (test). Resetting a case
  or restarting a lesson does not touch them (test).
- No durations are invented. The hub shows no minutes (test).

Tests: `fellow04MarkersGlossaryUnitsResets`:

- clean state;
- opened-and-skipped lesson;
- visited case;
- returning learner;
- legacy bytes;
- orientation text.

**FIXED.**

### 3.5 F-21 — balance feedback that teaches the ledger

`balanceFeedback.ts` compares the entered whole-patient balance with the recorded arithmetic,
within 0.5 mL. The panel then shows:

- the outcome in words, plus "Your entry", "Recorded balance" and "Difference", all signed;
- the **worked calculation** at once, on the first miss, and also before any entry through "Show
  worked calculation";
- five labeled ledger lines: add intake; subtract urine, other non-CRRT output, and net CRRT
  removal (set as PFR on PrisMax, counted once); add device gain;
- the sign convention, the units and window ("every term is a recorded total in mL over the same
  4-hour charting window"), and what is not in the ledger (effluent, dialysate, replacement,
  PBP).

A **specific diagnosis** appears only when exactly one of 13 named slips reproduces the entry
within 0.5 mL and differs from the correct value. The slips include:

- sign reversed;
- urine left out;
- net removal left out or added;
- circuit fluids counted — the walkthrough's −5,100 mL is balance − dialysate;
- liters instead of milliliters;
- per-hour average.

Otherwise a general revisit hint is shown. An example: in this run the balance, +300 mL, equals
net removal, so −300 mL fits two slips, and only the general hint is shown (test).

**Missing urine** makes the balance **unavailable**: "not recorded … a missing record is not
zero". The calculation ends "= unavailable".

Retry and continue both work. Nothing is stored — no "first answer" and no attempt count.

Tests: `fellow04BalanceFeedback` (13) uses a real four-hour run built with the operational
reducer. It also covers the UI harness: worked calculation before entry, first-miss feedback,
retry, continue, and empty `localStorage`.

**FIXED.**

### 3.6 F-23 — six per-signal pressure comparisons

The comparison model (`comparePressureLocalizationPrediction`) compares each of the six
predictions with the observed direction. Outcomes are in words and signs: ✓ Matches, ✗ Does not
match, – No prediction made.

Each explanation is **derived from that pattern's own readings**. For example: "Filter changed by
+20 mmHg and return by +20 mmHg, so their average changed by +20 mmHg; effluent … TMP therefore
rose from 37 to 57 mmHg." It stays arithmetically true for every site: tests check TMP = average −
effluent and drop = filter − return for all five sites, giving distinct TMP stories.

There is no total, count or score. Reveal-first shows all six explanations with no prediction.
Revise hides the comparison.

Tests: `fellow04PressureComparison` (11) and the Batch-04 e2e journey.

**FIXED.**

### 3.7 F-24 — terminology, first use, US English and units

**Glossary.** It has 21 terms in six groups. Each has a definition, "also called", "not the same
as", and a basis:

- the module's own drawing;
- a device-manual record ID;
- a clinical publication ID with a claim topic that `crrtSourceSupportsClaim` confirms (test).

Required distinctions are tested:

- set versus actual flow;
- effluent versus patient loss;
- net machine removal versus UF, versus whole-patient balance, and the PFR alias;
- UF versus net UF;
- the urea marker is not a lab value.

**Makeup** keeps its **Unresolved** open question and the withheld consequence. The status line
says no clinician has reviewed the definitions.

It is reachable from:

- the hub orientation;
- every Learn lesson header;
- the Practice/Challenge task panel, which Help names.

It is a dialog. Focus returns to the trigger (tests plus the keyboard e2e). Group links are
buttons, not `#hash` links, because a hash fires `popstate`, which restarts a Learn lesson.

**First use.**

- "TMP (transmembrane pressure)" at its first appearance, the L2 task 3 instruction.
- L4's worked dose: "Net CRRT removal is the net ultrafiltration the machine takes from the
  patient; PrisMax sets it as patient fluid removal (PFR)."
- L1's first "effluent" gets a gloss.

The other required first uses were already introduced where first used, and the test holds them:

- PBP: "Pre-blood-pump (PBP) fluid", L2 task 2.
- Pre/post replacement: L2 task 2.
- UF: L1 task 3.
- Net removal: L1 task 1.
- Whole-patient versus CRRT removal: L1 task 2.
- Prescribed versus delivered: L4 task 1.

**US English.** All learner strings in the module were swept. Identifiers, the audit harness and
source titles or quotations were left as they are; the sweep found no UK spelling in any
registered source title. A guard test parses every non-test module file's string literals and JSX
text.

**Units.**

- `concentrationUnits.ts` derives `DECILITERS_PER_LITER` (10) from milliliter constants, with
  mg/dL ↔ mg/L conversion in both directions. Non-finite input throws; null stays null.
- The runtime normalizer uses it, and its output is bit-identical for every case and mg pool
  (test).
- Round trips hold to 12 decimal places (test).
- No learner surface showed mg/L. Displayed creatinine, phosphate and magnesium were, and remain,
  the authored mg/dL values; the test checks them against the converted pools. The unit label
  now comes from one constant.
- Unsupported dynamics stay suppressed after four simulated hours (test).
- Source and audit records keep their original units, untouched.
- The urea marker is **not** renamed to BUN (test).

**FIXED** (glossary, first use, spelling), plus **PRESENTATION FIXED / CLINICAL MEANING UNCHANGED**
(units).

### 3.8 F-25 — reset wording matches its scope; titles

- **Lesson 8 title** is now the noun phrase "Pressure-profile integration" in all three places:
  `learnLessons.ts`, the pathway section and the activity seed. The ID
  `crrt-pressure-profile-integration` and all eight IDs and their order are unchanged (test).
- **"Restart lesson"**: the end card used "Repeat lesson" for the same operation. It now uses the
  same words, with the scope: "goes back to task 1 and clears this visit's answers and simulated
  runs. Visited topics stay saved on this device."
- **"Reset case"** has a scope note: a new run clears this run's actions, simulated time, entered
  settings and reassessment, while the case and visited history stay. The device interface's
  "Reload clean interface" is now "Reset case (start a new run)" where it performs the case
  reset.
- **"Reset this drill"** has its scope.
- No reset clears legacy history (test).
- The shared header's fixed "Reset" label is other-owner; see §4.
- **Lesson 5 split** is a proposal only (P-10). No ID, route, order or prerequisite changed.

**FIXED**; Lesson 5 split **PROPOSED FOR OWNER REVIEW**.

### 3.9 X-01 — overview

The hub's "Before you start · Who this is for and how it works" covers:

- audience and assumed background;
- what you will practice;
- that the order is a recommendation, not a requirement;
- what "Visited" means;
- what is saved (only locally: which lessons and cases were opened, and where you were last);
- status.

There is no fabricated time. The Learn landing's per-section minutes are the authoring defaults
from `learningPathways.ts`, validated against `activities.ts` `estimatedMinutes`. They are now
labeled: "The minutes shown beside each section are estimates written when this pathway was
authored, not measured learner times."

**FIXED.** The per-badge label inside shared `PathwayLanding` is other-owner; see §4.

### 3.10 X-04 — Learn reuses Practice cases, said honestly

`caseReuse.ts` derives the map from the lesson task registry, so it cannot drift:

- CRRT-04: L5 tasks 2–4 and L7 tasks 1–4.
- CRRT-13: L5 tasks 5–9.
- CRRT-10: L7 tasks 5–6.
- CRRT-14: L8 tasks 1–9.

Learn run captions and teaching now say "guided version of Practice case CRRT-nn". The Practice
case says "Revisit from Learn: Lesson N (tasks a–b) walked through a guided version of this
case. Here you practice it on your own …". Cases Learn does not use show no note (test).

**FIXED.**

## 4. Classification summary

| Finding                  | Classification                                                                                                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-06                     | **PRESENTATION FIXED / CLINICAL MEANING UNCHANGED** (categories 1–2, all 25 items) · **PROPOSED FOR OWNER REVIEW** (P-01 to P-09)                                                                                                       |
| F-07                     | **FIXED**                                                                                                                                                                                                                               |
| F-18 residual (owner 01) | **FIXED**: removed the leftover generic debrief panel; no competing implementation                                                                                                                                                      |
| F-19                     | **FIXED** (plain status, audit disclosure, simulated alerts) · **OWNER/SOURCE HOLD**: CONFLICT-001/002, makeup attribution, alert-to-manufacturer mapping (awaiting device review)                                                      |
| F-20                     | **FIXED**                                                                                                                                                                                                                               |
| F-21                     | **FIXED**                                                                                                                                                                                                                               |
| F-23                     | **FIXED**                                                                                                                                                                                                                               |
| F-24                     | **FIXED** (glossary, first use, US English) · **PRESENTATION FIXED / CLINICAL MEANING UNCHANGED** (units) · **MODEL NOT IMPLEMENTED**: solute dynamics remain unsupported (Batch 01 containment), so no converted value moves over time |
| F-25                     | **FIXED** · **PROPOSED FOR OWNER REVIEW**: Lesson 5 split (P-10)                                                                                                                                                                        |
| X-01                     | **FIXED**                                                                                                                                                                                                                               |
| X-03                     | **PROPOSED FOR OWNER REVIEW**: P-10, with impact on IDs, URLs, progress and prerequisites. The in-lesson outline is from Batch 03.                                                                                                      |
| X-04                     | **FIXED**                                                                                                                                                                                                                               |

**Holds kept as they were:**

- O-01 to O-10 are not resolved.
- CONFLICT-001/002 stay held and visible.
- G01-CRRT-02: the −25 mmHg filter-drop placement is held, and the glossary's filter-drop entry
  says so.
- The −18 mmHg TMP display offset is shown as printed.
- `latencySeconds` is still not read.
- Makeup attribution still fails closed.
- Solute validity is still unsupported.
- The urea marker is not renamed.
- No review status is upgraded.

**Other owner / DEFERRED (not fixed here):**

1. **Shared `ActivityChrome` header "Reset".** The label is fixed, and CRRT, MV and ICU sim all
   use it. CRRT's own control and scope note say the header does the same. Proposal: an optional
   `resetLabel` prop. Owner: learning-module chrome.
2. **Shared `PathwayLanding` per-section minute badges.** They cannot carry an "estimate" label
   per badge without a shared change; the CRRT note labels them at list level. The same applies to
   the critical-care hub's minute listings. Owner: learning-module / catalog.
3. **Site header overflows 51 px at 200% root text at 1280 px.** This is Batch-03 §11.1,
   measured again here on every Batch-04 surface; CRRT content itself does not overflow. Owner:
   global header.
4. **Pre-existing shared test failures on unchanged `main`,** reproduced on the base SHA with the
   identical command (§5):
   - `critical-care/__tests__/accessibility.test.tsx` — the CRRT pressure-lab circuit image name.
   - `curriculum-sequencing.test.tsx` — an extra "PrisMax troubleshooting challenge" heading.
   - `learner-copy.test.ts` — now MV/MCS findings only; CRRT went from 10 to 0.
5. **Observed, not in this batch's scope; the code paths were not changed here.**
   - On Practice CRRT-15 at case start, access pressure reads −40.5 in the evidence summary, −40
     in the live profile and −41 on the device panel: three roundings of one value.
   - The device panel's "Machine removal / whole balance" reads "0 mL / 0 mL" while the evidence
     summary says whole-patient balance is "Unavailable".
   - Both are output-truth items for Batch 06 or the Batch 01 owner to confirm.
6. **The Practice "Try predicting · optional" worked-case check** (`CrrtWorkedCaseExample`, from
   Batch 02) still says "Show explanation" and "Reasoning feedback". It is not one of the 25
   Learn items; aligning its words with Learn is a small follow-up.
7. **The authored drill option order puts the safe response first in all five drills.** The pack
   forbids shuffling to hide keys; a fixed authored reorder is a content decision.

## 5. Tests

| Check                                                                                                                                                     | Result                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jest — CRRT + shared consumers (`baxter-crrt`, `critical-care`, `learning-module`, the CRRT route, `api/analytics`, `sitemap.baxter-crrt`, `module-beta`) | **1,406 passed, 3 failed** (128 suites)                                                                                                                                                                                                                                    |
| The same command on the base SHA `a306d825`                                                                                                               | 1,321 passed, **the same 3 failed** (123 suites), so the 3 are pre-existing (§4 item 4)                                                                                                                                                                                    |
| New Batch-04 tests                                                                                                                                        | 85 in 5 files: `fellow04TeachingFeedback` 34, `fellow04MarkersGlossaryUnitsResets` 20, `fellow04BalanceFeedback` 13, `fellow04PressureComparison` 11, `fellow04SourcesAndAlerts` 7                                                                                         |
| Existing tests changed                                                                                                                                    | 12 files, wording only (for example "Repeat lesson", "Reasoning feedback", "modelled", "Topics visited"); none weakened, several strengthened                                                                                                                              |
| Type-check (`tsc --noEmit`, 8 GB heap)                                                                                                                    | **pass**                                                                                                                                                                                                                                                                   |
| ESLint, all changed TS/TSX (`--max-warnings=0`)                                                                                                           | **pass**                                                                                                                                                                                                                                                                   |
| Prettier, all changed files                                                                                                                               | **pass**                                                                                                                                                                                                                                                                   |
| `git diff --check`                                                                                                                                        | **clean**                                                                                                                                                                                                                                                                  |
| Production build (`npm run build`, synthetic env)                                                                                                         | **pass**: 776 static pages; CRRT routes built                                                                                                                                                                                                                              |
| Playwright CRRT, dev server                                                                                                                               | **67 passed, 1 skipped** (the beta-wrapped route, which skips itself outside owner-local mode), on a fresh server after the final edits. An earlier dev run was also clean apart from wording updates and one run disturbed by editing during it, which passed when rerun. |
| Playwright CRRT, production build                                                                                                                         | **68 / 68 passed**: the 58 existing tests, including the beta-wrapped route (it runs in owner-local mode), plus the 10 new Batch-04 tests                                                                                                                                  |
| Systemic UX specs, CRRT tests only (`-g "CRRT\|crrt"`), production                                                                                        | **72 / 72 passed**                                                                                                                                                                                                                                                         |

Existing e2e specs were updated for changed words only:

- "Show worked explanation".
- The outcome headings.
- "cause still active".
- "Recorded balance: +300 mL", plus the match/mismatch heading.
- `.first()` for the header "Restart lesson", which now shares its name with the end card.

New: `e2e/baxter-crrt-fellow04.spec.ts`, with four keyboard-inclusive journeys and the six-size
matrix.

## 6. Browser matrix

Chromium through Playwright, dev and production, at:

- 1440×900, 1280×900, 1024×768, 390×844 and 320×740;
- 1280×900 with 200% root text (`html { font-size: 32px }`).

Surfaces measured at each size:

- hub orientation;
- the glossary dialog (its box must stay inside the window);
- Learn check feedback after a miss;
- the pressure comparison after reveal-first;
- Practice CRRT-13 with the reuse note and actions;
- a drill's worked example;
- the debrief after ending the run.

| Size             | Document sideways overflow | Page content spilling past the window          |
| ---------------- | -------------------------- | ---------------------------------------------- |
| 1440×900         | 0 px on all seven          | none                                           |
| 1280×900         | 0 px                       | none                                           |
| 1024×768         | 0 px                       | none                                           |
| 390×844          | 0 px                       | none                                           |
| 320×740          | 0 px                       | none                                           |
| 1280×900 at 200% | 51 px on all seven         | none (the 51 px is the site header, §4 item 3) |

**Keyboard checks (e2e).**

- Glossary: opened with Enter; a group button moves focus to its heading, in view; Escape closes
  it and returns focus to the trigger.
- Learn check: worked explanation shown and hidden with Enter; radio chosen with Space; "Check
  reasoning", "Try again" and "Review feedback and continue" with Enter.
- Drill: worked example with Enter.

The earlier keyboard-only journeys in the Batch 01–03 specs still pass.

Evidence (outside Git):
`Interventional-Pulm-Local-Data/renders/output/crrt-fellow-04-2026-09-23/`, with 42 matrix
screenshots per server (`dev/` and `prod/`) named `{size}-{surface}.png`.

## 7. NOT RUN

- No screen reader or other assistive technology. No native browser zoom; 200% was root text.
  No Safari, Firefox or real phone.
- No real learner or pilot observation. That is why no durations were estimated.
- No clinical, device or source review of any kind. The glossary definitions, the plain
  citations and every proposal are unreviewed.
- The systemic specs were run for their CRRT tests only. Their MV, MCS, ECMO, BBT, PI, EBUS and
  BF tests were not run.
- The beta-wrapped route e2e test skips itself outside owner-local mode; this is unchanged.
- Nothing was merged, deployed or uploaded. No Supabase or upload script was run. Batch 05 was not
  started.

## 8. Files

- **Code (CRRT):**
  - `src/features/baxter-crrt/{balanceFeedback,caseReuse,sourcePresentation}.ts`
  - `content/{glossary,concentrationUnits,alertLabels,stateLabels}.ts`
  - `components/{CrrtGlossary,CrrtSourceRecord}.tsx` + `crrt-glossary.module.css`
  - edits across the CRRT components, content and models listed in §2
- **Shared catalog (CRRT rows only):**
  - `src/features/critical-care/content/{learningPathways,activities}.ts` (Lesson 8 title)
- **Docs:**
  - `docs/gap-remediation/self-paced/G01-crrt-source-review-queue.json`: learner-wording mirror for
    G01-CRRT-08/10, presentation only; decisions still NOT REVIEWED.
  - `docs/gap-remediation/fellow-review/CRRT-FELLOW-04-{handoff,copy-sheet,owner-proposals}.md`
- **Tests:**
  - `src/features/baxter-crrt/__tests__/fellow04*.test.tsx` (5)
  - 12 existing test files (wording)
  - `e2e/baxter-crrt-fellow04.spec.ts`
  - 5 existing CRRT specs (wording)
  - `playwright.baxter-crrt.config.ts` (`testMatch` entry)
