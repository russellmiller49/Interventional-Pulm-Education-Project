# MV-PRE-REVIEW-04 — self-paced teaching, wayfinding and sources

Batch 04 of the Mechanical Ventilation pre-owner-review pack
(`Interventional-Pulm-Local-Data/module_update_9_19/MV_Claude_Implementation_Pack/04_MV_SELF_PACED_TEACHING_AND_SOURCES.md`),
read with `00_START_HERE.md`, `COMMON_CONTRACT.md`, the thirty assigned rows of `FEEDBACK_LEDGER.md`,
`SOURCE_AND_CODE_NOTES.md`, `CROSS_MODULE_COORDINATION.md`, `OWNER_DECISIONS.md`,
`docs/gap-remediation/beta-finish-line.md` (MV-04), and the merged `MV-PRE-REVIEW-01/02/03` handoffs.
Prepared 2026-10-07 by an AI authoring assistant (Claude) at the owner's request.

**Nothing here is clinical, device, media, source or release approval.** This batch changed how the
module is named, mapped, worded and attributed. It changed no physiology, case trajectory, gas
model, alarm policy, safety control, answer key, question or case id, stored format, review status
or D1–D8 decision. Every new sentence is listed in the [wording appendix](#wording-appendix) and is
**NOT REVIEWED**. The source is an AI persona's walkthrough, not a fellow's usability session.

## Delivery and scope

|                          |                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base                     | `b85da4a00fc1959ff9d5818d8a2b89d98d275723` — `origin/main` as fetched 2026-10-07 (merge of PR #340). Batches 01–03 are merged (#259, #271, #290).                                                                                                                                                                                                                                                                                |
| Branch / worktree        | `claude/mv-pre-review-04-20261007` in `…/Interventional-Pulm-Education-Worktrees/claude-mv-pre-review-04-20261007`, created from that base; clean and exclusively owned at start (`git status` empty, `HEAD == origin/main`).                                                                                                                                                                                                    |
| Implementation head      | `88c320a5025247da4cfdb7145e1d7b29e733f2cd` — runtime, content and tests. Every test, build and browser result below is from this tree.                                                                                                                                                                                                                                                                                           |
| Final head               | recorded in the PR (the commit that adds this document and its screenshots)                                                                                                                                                                                                                                                                                                                                                      |
| Files                    | Everything under `src/features/mechanical-ventilation` plus this document and `MV-PRE-REVIEW-04-screenshots/`. No shared `learning-module` file, shared `AnswerVerdict` / `ChoiceReasoningFeedback`, critical-care registry, progress store, other clinical engine, global chrome, dependency, `launch.json` or `.env.local` was created or changed. `content/source-cases.v1.json` (the SHA-pinned casebook) is byte-identical. |
| Not done, by instruction | The wide-window workbench layout pass (figure and its control on one screen at 1707 × 900) — a separate later PR. Batch 05 and 06. No merge, deploy or readiness change.                                                                                                                                                                                                                                                         |
| Held                     | Live clinical case MV-03 stays excluded on every path. The alarm-limit harmful choice, D1–D8 and every source/review hold are unchanged. See [Holds](#holds).                                                                                                                                                                                                                                                                    |

## The learner-copy guard

`src/features/critical-care/__tests__/learner-copy.test.ts` flags software-internal words in static
component copy. On the base it reported **eleven** lines: two in Ventilation and nine in MCS.

| Run                         | Ventilation findings                                                                                                                          | MCS findings | Guard test |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------- |
| Base `b85da4a0` (untouched) | 2 — `components/stage/VentilationPeepComparison.tsx` lines 122 and 160, `"Engine-generated example values · no hold acquired"`, term `engine` | 9            | fails      |
| This branch                 | 0                                                                                                                                             | 9            | fails      |

Both Ventilation lines now read **"Model-generated example values · no hold acquired"** (the table
caption and the compact layout's line). The guard was run on a detached checkout of the base and on
this branch with the same `node_modules`; the only difference in its output is the two Ventilation
entries.

**The guard test as a whole still fails**, on the nine MCS lines that belong to the MCS copy lane
(`beta-finish-line.md`, "the nine lines the learner-copy guard flags in MCS components"). They were
not touched: another module's files are not this batch's to edit. No assertion, term list or
exception in the guard was changed. The Ventilation half is additionally pinned by
`mv-pre-review-04-learner-map.test.tsx` ("the matched PEEP comparison names no software internals").

## Disposition of the thirty findings

Reproduced = seen on the base in code, in the rendered component, or both. "Modified" means the
source's proposed fix conflicted with the self-paced contract and a different repair was made.

| ID    | Reproduced on base                                                                                                                                                            | Disposition                                           | What changed                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| N1    | Yes. Stage 1 listed the ARDS recruitment case (`next-in-unit` pairing of Sections 1, 2, 3, 5 to MV-01); the hub said "15 clinical cases".                                     | **Repaired**                                          | A stage lists a case only where one of its sections teaches that case's mechanism (`mechanism-match`); Stages 1–2 list none. A second pairing of the same case is labelled "revisit". Counts come from the registry: "14 live cases and 1 worked explanation". All 15 entries stay in the Practice index. No prerequisite gate.                                                                                                      |
| N2    | Yes. "Application" was the tab, the stage of Sections 11–13, and "Application 1/2" inside every section.                                                                      | **Repaired**                                          | "Applications" is the tab only. In-section parts are "Part 1 of 2 / Part 2 of 2"; the stage is "integration sections" (id `application` unchanged). Each part prints what it starts from, derived from the round, and Continue warns before it opens the other part on a fresh patient. No reset behaviour changed.                                                                                                                  |
| N3    | Yes. Practice said "builds on Lung protection" (`shortTitle`) for a section titled "Is this breath appropriate for this lung?".                                               | **Repaired**                                          | One name everywhere: `Section N · title`, from `content/learnerMap.ts`. Used on Practice, the Applications chooser and review link, the section chooser, the pathway chips and the next-section link.                                                                                                                                                                                                                                |
| N5    | Yes (the Step menu names the experiment).                                                                                                                                     | **Modified — not hidden**                             | Step names, controls and explanations stay visible before any answer (owner's self-paced design). The section header now says so: "This is a guided walk-through: step names, controls and explanations show what is coming and can be opened before you answer anything." No clean-trace mode was added.                                                                                                                            |
| N6    | Yes. `observe` drew the same task, panel and readings as the `simulator-task` step before it; `interpret` drew what the `explain` step after it draws again.                  | **Repaired, with limits**                             | The two repeating step kinds are no longer separate stops: 10 → 7 shown steps in Sections 1, 2, 4, 5; 11 → 8 in Section 3; 8 → 7 in Sections 6–8 and 10–14; Section 9 unchanged at 4. No lesson step, id or ordinal was removed. See [Step map](#step-map). Minutes are labelled as an author's reading estimate with the experiments' simulated seconds derived beside them; no minutes were re-authored. New scenarios → Batch 05. |
| T2    | Yes. Overview: mode, breath size, rate, PEEP, oxygen. Section 3 round: "volume, rate, flow, oxygen, and PEEP". Section 3 text: five differently named groups.                 | **Repaired, with limits**                             | One taxonomy (`content/controlPanel.ts`): five main settings; flow or inspiratory time, trigger, cycle-off and rise time named as settings that shape delivery; playback, holds and simulated-patient controls named as not settings. It no longer claims to be everything on the console or every mode.                                                                                                                             |
| T3    | Yes. Hashes, snapshot filenames and "Clinical review … none recorded yet" under every citation; an all-unchecked publication list on the main path.                           | **Modified — folded, not hidden**                     | Review status is stated once and stays visible; file-identity checks, snapshot hashes and the publication checklist are in one "audit" disclosure on the same page. Every record's identity line and the no-review line are still rendered. No status was softened.                                                                                                                                                                  |
| Q1    | Yes. Learn feedback opened "Your choice: X" with no verdict.                                                                                                                  | **Repaired**                                          | MV-local `VentilationReinforcement` leads with "Best-supported answer." or "Not the best-supported answer. Best supported: …". Local to the card; nothing counted or stored. Keys are single-best, so there is no "partly supported" verdict. Shared `AnswerVerdict` untouched.                                                                                                                                                      |
| Q2    | Partly. Batches 01/03 already made the lead-in depend on marker / hold / pause; rounds that change a setting but ask for identification or reflection still read "Predict …". | **Repaired**                                          | A round can say what it asks (`asks`): Section 3 both parts and the oxygen round → identify; Section 9 Part 1 → interpret; Section 13 Part 1 → reflect, Part 2 → interpret. Step title "A new setup: predict again" → "Part 2: a new setup".                                                                                                                                                                                         |
| Q3    | Yes. The Learn hint was the round's `look` line, already printed above the question.                                                                                          | **Repaired, with limits**                             | Each of the 24 distinct rounds has a `hint` drawn from its own rationale and explanation: a cue, no choice label, no new number. These are new sentences and are listed for review. No question was added.                                                                                                                                                                                                                           |
| Q4    | Yes. Case titles name the mechanism and the three options are sibling case mechanisms.                                                                                        | **Modified; substantive part deferred**               | Titles and immediate explanations stay (owner's design). The question is described honestly — "A guided comparison, not a test: the case title already names the mechanism…" — and now gives a verdict. New application questions or distractors are **not** drafted here: 0 of the pack's 10-draft allowance used; goes to the D6 packet (Batch 05).                                                                                |
| Q6    | Yes. "The learner should not chase…", "The randomized branch prevents rote pattern matching", "The simulator should…".                                                        | **Repaired**                                          | `content/caseTeaching.ts`: each of the 15 debriefs restated to the learner. The casebook is SHA-pinned and untouched; its wording is one disclosure away ("Casebook wording, as supplied").                                                                                                                                                                                                                                          |
| V5    | Yes. "cm H₂O", "mm Hg", "mL/cm H₂O" in teaching text beside "cmH₂O", "mmHg".                                                                                                  | **Repaired, with a documented exception**             | Teaching text uses `cmH₂O`, `mmHg`, `mL`, `L/min`. Exceptions kept on purpose: native console labels and units from the registered manuals (`deviceProfiles.ts`, the console — e.g. Hamilton `ml`, `l/min`), and casebook lines reproduced verbatim (`cm H2O`). No value, scale or conversion changed.                                                                                                                               |
| S3-1  | Yes. "It is higher than the set rate whenever the patient triggers."                                                                                                          | **Repaired (source-preserving)**                      | "…only when the patient triggers breaths faster than the set rate; in assist-control each triggered breath restarts the wait for the next mandatory one." Consistent with the model, whose cycle follows the larger of set and patient rate. Not clinically reviewed.                                                                                                                                                                |
| S3-2  | Yes. On the C6 facsimile `peakFlowLMin` is in the group headed "Oxygenation".                                                                                                 | **Contained; device verification held**               | The registered C6 operator's manual is not on this machine (not in Local-Data `device-manuals/`, not in the primary checkout's mount), so the placement could not be checked against Figures 7-2 to 7-12. The grouping is **left exactly as registered**. A note above grouped controls says the headings are the console's own menu groups, not teaching categories. Decision D4.                                                   |
| S4-2  | Yes.                                                                                                                                                                          | **Repaired**                                          | "…a valid plateau stays near its previous value."                                                                                                                                                                                                                                                                                                                                                                                    |
| S5-1  | Yes. Section 5 Part 1 is the Section 4 Part 2 round with a new introduction.                                                                                                  | **Modified — labelled as a revisit**                  | "Revisit of Section 4 · Where does the pressure go?, Part 2. The same stiffness experiment and the same question, read here for what volume control holds constant." A PC or different-patient variant is a content proposal for Batch 05, not drafted.                                                                                                                                                                              |
| S6-1  | Yes. Limits attributed to "ATS 2024" in the text, the guideline box and the record's "Supports".                                                                              | **Repaired (verified source history)**                | New record `ats-esicm-sccm-ards-2017` (Fan 2017) as the origin; `ats-ards-2024` now says it retains that recommendation and lists its own. Text, guideline box and links follow. Both checked on PubMed/PMC on 2026-10-07; bibliographic only. See [Source locators](#source-locators).                                                                                                                                              |
| S6-3  | Yes. "This original patient…" in six round introductions.                                                                                                                     | **Repaired**                                          | Each says which simulated patient it is ("A different simulated patient: the patient of case MV-01, who has stiffer lungs and is making inspiratory efforts"), and the derived setup line says same/different and what the part starts with.                                                                                                                                                                                         |
| S7-1  | Yes. Section 7 Part 2 uses pressure support, flow cycling and ETS before Section 8.                                                                                           | **Contained by earlier explanation; relocation → 05** | The terms are expanded where first used and the part is labelled "Preview of Section 8 · Do the two breath clocks agree?". The part was **not** moved or replaced: that changes sequencing and objectives. Map in [Duplicate-screen map](#duplicate-screen-map).                                                                                                                                                                     |
| S7-4  | Yes. The control strip states both parts' readings and is open before the questions.                                                                                          | **Modified — not hidden**                             | The strip stays open and says what it is: "This strip is the worked reading for both parts of this section. Open it before or after trying the optional questions; nothing here is held back." "In the second setup" → "In Part 2".                                                                                                                                                                                                  |
| S11-1 | Yes. Section 11 Part 2 is Section 2's flow round on case MV-02.                                                                                                               | **Modified — labelled as a revisit**                  | "Revisit of Section 2 · Three traces, one breath, Part 1. The same flow question, asked here of a patient who is pulling hard during inspiration." The flow teaching is kept. A high-drive transfer question is not drafted here → Batch 05.                                                                                                                                                                                         |
| S12-1 | Yes. Section 12 Part 2 is the same round as Section 7 Part 2.                                                                                                                 | **Modified — labelled as a revisit; map for 05**      | "Revisit of Section 7 · Does the breath have time to finish?, Part 2. The same patient, setup and question, read here for where on the breath the mismatch lives." Both uses keep the same patient (MV-10) and goal; nothing relocated.                                                                                                                                                                                              |
| C8    | Yes. Button label "Deepen sedation without correcting the mechanism".                                                                                                         | **Modified**                                          | Label "Deepen sedation". Its safety teaching is not withheld: every action now prints its authored description beneath it, and this one reads "Suppresses visible respiratory effort. It does not address timing, load, pain, or delirium." Effect, latency, `unsafe` flag, refusals and physiology unchanged.                                                                                                                       |
| C10   | Yes. "…review the measurement and initialization contract"; "The simulator should calculate…".                                                                                | **Hold preserved; wording repaired**                  | MV-03 still opens only as a worked explanation, now addressed to the learner with a one-sentence reason. The measurement/initialization detail and the casebook wording are in a disclosure that states "Review status: not reviewed." No live construction, on any path.                                                                                                                                                            |
| C11   | Yes. MV-01's question asks for a mechanism; its hint was "Which settings primarily change oxygenation?".                                                                      | **Repaired, with limits**                             | The hint beside the mechanism question is now the casebook's own second line for MV-01, "Compare the change in Pplat and compliance after each PEEP step." Still a casebook line; the other fourteen cases keep their first line. No new hint was written for cases.                                                                                                                                                                 |
| C12   | Yes, and traced. See below.                                                                                                                                                   | **Mapping checked; nothing invented; drafts → 05**    | Reasons do not exist in the data, so there was no dropped mapping to repair. The empty "Compare the possibilities" disclosure no longer appears where no option has a reason; the card says so. Verdict added (Q1).                                                                                                                                                                                                                  |
| A1    | Yes. Items numbered 1–10; four sections with none.                                                                                                                            | **Modified**                                          | The chooser labels each item by its section; a line derived from the registry says "Sections 1, 2, 5, 7 and 12 have no item here" and that the items are a selection. No item was added for symmetry. (After A2 the uncovered sections are five, not four.)                                                                                                                                                                          |
| A2    | Yes. `modes-and-breath-delivery:final` asks about resistance and peak pressure; review link to Section 5.                                                                     | **Repaired**                                          | Shown under, and linked to, Section 4. Its id, stem, options, key and cited evidence are unchanged.                                                                                                                                                                                                                                                                                                                                  |
| A3    | Yes. Section 9 outcome: "Separate oxygen concentration from pressure support for oxygenation…".                                                                               | **Repaired (source-preserving)**                      | "Separate oxygen concentration from PEEP as ways to support oxygenation, and select the reassessment." Section 9's own explanation is FiO₂ against PEEP. No pressure-support physiology was reworded.                                                                                                                                                                                                                                |

### C12 — where case option reasons come from

`MechanicalVentilationCaseActivityV2` → `definition.mechanismOptions` →
`runtimeCases.ts: stationMechanismOptions(stationId)` → `{ id: phenotype, label: mechanismLabel }`
for each case in the station. `PredictionOption` has no rationale field, `caseProfiles` has none,
and `source-cases.v1.json` has no per-option text. The adapter drops nothing: **the reasons were
never authored**. Learn and Applications items carry `rationale` per choice and still show the
disclosure. Fifteen cases × two alternatives would be thirty new clinical sentences; none was
written. They belong to the D6 packet.

## Content map

### One learner map

| Surface                       | Before                                                                   | After                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Section name                  | title on Learn, `shortTitle` on Practice, bare title on Applications     | `Section N · title` everywhere (`ventilationSectionLabel`)                                                               |
| Case counts                   | "15 clinical cases"                                                      | "14 live cases and 1 worked explanation" (`ventilationCaseCounts`: 15 entries, 14 live, 1 held)                          |
| Stage → case                  | every section's pairing, including four `next-in-unit` pairings to MV-01 | `mechanism-match` pairings only; repeat labelled "revisit"                                                               |
| Stage word for Sections 11–13 | "3 applications"                                                         | "3 integration sections"                                                                                                 |
| In-section parts              | "Application 1 / 2"                                                      | "Part 1 of 2 / Part 2 of 2"                                                                                              |
| Applications items            | "1." … "10."                                                             | the section each draws on; coverage stated                                                                               |
| Time                          | "5 minutes", "102 min"                                                   | "about 5 minutes of reading", "about 102 min of reading", plus the experiments' simulated seconds on each section header |

Stage → paired cases after the change (from `ventilationPathwayGroups()`):

| Stage                            | Sections | Paired cases                                                                  |
| -------------------------------- | -------- | ----------------------------------------------------------------------------- |
| Meet the breath                  | 1        | none                                                                          |
| Learn to see                     | 2–3      | none                                                                          |
| Build your reasoning             | 4–10     | MV-13 (S4), MV-01 (S6; revisit at S9), MV-05 (S7; revisit at S10), MV-07 (S8) |
| Read the patient and the machine | 11–13    | MV-08 (S11), MV-11 (S12), MV-15 (S13)                                         |
| Put it together                  | 14       | MV-13 (revisit)                                                               |

Seven of the fifteen entries are paired with a stage; all fifteen are in "Every entry, in the
mechanism-alternating order" on Practice, with MV-03 tagged "worked explanation · live simulation
held for review". Routes, query parameters, section ids, case ids and item ids are unchanged.

Applications item → section (ids unchanged):

| Item id                                       | Shown under               | Review link               |
| --------------------------------------------- | ------------------------- | ------------------------- |
| `modes-and-breath-delivery:final`             | Section 4 (was Section 5) | Section 4 (was Section 5) |
| `oxygenation-response:final`                  | Section 9                 | Section 9                 |
| `triggering-and-cycling:final`                | Section 8                 | Section 8                 |
| `lung-protection:final`                       | Section 6                 | Section 6                 |
| `safety-reassessment-and-human-factors:final` | Section 13                | Section 13                |
| `mechanics-load-and-pressure:final`           | Section 4                 | Section 4                 |
| `ventilation-and-co2:final`                   | Section 10                | Section 10                |
| `waveform-reading-sequence:final`             | Section 11                | Section 11                |
| `controls-and-goals:final`                    | Section 3                 | Section 3                 |
| `high-peak-pressure-integration:final`        | Section 14                | Section 14                |

No item: Sections 1, 2, 5, 7, 12.

### Step map

`lesson.steps` is unchanged: same steps, ids (`unit:ordinal-phase`), ordinals and positions. The
host shows the steps for which `isPresentedVentilationStep` is true.

| Lesson position (foundation sections 1, 2, 4, 5) | Kind               | Before: shown as | After: shown as | Where its content is now                                                    |
| ------------------------------------------------ | ------------------ | ---------------- | --------------- | --------------------------------------------------------------------------- |
| 0                                                | read / walk        | Step 1           | Step 1          | —                                                                           |
| 1                                                | prediction, P1     | Step 2           | Step 2          | —                                                                           |
| 2                                                | simulator-task, P1 | Step 3           | Step 3          | —                                                                           |
| 3                                                | observe, P1        | Step 4           | not a stop      | Same task, experiment panel, readings and captured result as position 2     |
| 4                                                | interpret, P1      | Step 5           | not a stop      | Explanation, captured comparison and observation question are on position 5 |
| 5                                                | explain, P1        | Step 6           | Step 4          | —                                                                           |
| 6                                                | prediction, P2     | Step 7           | Step 5          | —                                                                           |
| 7                                                | simulator-task, P2 | Step 8           | Step 6          | —                                                                           |
| 8                                                | interpret, P2      | Step 9           | not a stop      | on position 9                                                               |
| 9                                                | explain, P2        | Step 10          | Step 7          | —                                                                           |

Section 3 has the settings sort after position 5 (11 → 8 shown). Sections 6–8 and 10–14 have no
`interpret` step and lose only the `observe` stop (8 → 7). Section 9 keeps its four steps.

What each kind was, per the pack's three categories:

- `observe` — **two displays of one result**. The step title differed ("Watch the response"); the
  screen did not.
- `interpret` — **two displays of one result**, in the five foundation sections only. Its own
  instruction text was never rendered by the Batch-03 host.
- Section 5 Part 1, Section 11 Part 2, Section 12 Part 2 — **deliberate retrieval**. Kept and
  labelled.

Preserved: every prediction, experiment, hold, capture, explanation, sort, locate and walk step;
`START_EXPERIMENT` on the task step; `labGoalMet` / `labReadyToCompare`; automatic capture; the
marker figure; point-of-use notes; source access; Restart and Reset.

**Saved reading locations.** The store (`mechanical-ventilation-self-paced-v1`) holds a lesson
position and has no layout version, so its format is not changed and nothing is rewritten on read. A
saved position on `observe` opens the task step of the same part; on `interpret`, that part's
explanation step (`resolvePresentedStepIndex`). The next visit records the position shown. No
answer, attempt or score is read, written or migrated.

### Duplicate-screen map

For the pack's N6, S1-4, S5-1, S7-1/S12-1 and S11-1. (S1-4 is a Batch-01 finding; its marker and
reference identity are untouched here.)

| Where                                | Round (unchanged)                      | Also at           | Kind                                            | Now                                           | For Batch 05 (D6)                                                                       |
| ------------------------------------ | -------------------------------------- | ----------------- | ----------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| Section 4 Part 2                     | `stiffVolume` + hold, MV-LAB           | Section 5 Part 1  | first use                                       | unchanged                                     | —                                                                                       |
| Section 5 Part 1                     | `stiffVolume`, MV-LAB                  | Section 4 Part 2  | deliberate retrieval                            | labelled revisit                              | a PC-first or different-patient variant (source's suggestion)                           |
| Section 2 Part 1                     | `flow`, MV-LAB                         | Section 11 Part 2 | first use                                       | unchanged                                     | —                                                                                       |
| Section 11 Part 2                    | `flow` on case MV-02                   | Section 2 Part 1  | retrieval on a new patient                      | labelled revisit                              | a high-drive transfer question (pressure scoop)                                         |
| Section 7 Part 2                     | `earlierCycle`, case MV-10, ETS → 50 % | Section 12 Part 2 | used before it is taught                        | terms expanded; labelled preview of Section 8 | whether Section 7 should get a VC-only second part and this one live only in Section 12 |
| Section 12 Part 2                    | `earlierCycle`, case MV-10, ETS → 50 % | Section 7 Part 2  | exact repeat                                    | labelled revisit of Section 7, Part 2         | same decision                                                                           |
| Section 3 Part 2 / Section 9 round 2 | `oxygen`, MV-LAB                       | —                 | Section 9's public lesson does not show round 2 | unchanged                                     | —                                                                                       |

No round was moved, removed or re-keyed; `?activity=<section>` links land where they did.

## Test-contract changes

Eight existing suites were edited. Each change follows a contract this batch was assigned to
change; none removes or loosens a check.

| Suite                               | Change                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stage-teaching-disclosure`         | The step outline is asserted over the shown steps, and every step not shown is asserted to be `observe` or `interpret`.                                                                                                                                                                                                                                             |
| `stage-learner-review`              | Option count is the shown-step count.                                                                                                                                                                                                                                                                                                                               |
| `mv-pre-review-03-workbench` (N4)   | "Step 6 of 10" → "Step 4 of 7" for the same lesson position.                                                                                                                                                                                                                                                                                                        |
| `mv-pre-review-03-repairs` (R2, R4) | "Step 3 of 10" → "Step 3 of 7". The every-step sweep runs over the shown steps with the original threshold (≥ 4), and asserts where positions 3 and 4 open. The "not started" figure state is reached through a saved location on the former observe step, which is how a learner can now reach it. The next-section link is found by its `Section N · title` name. |
| `mv03-source-identity`              | The new 2017 record is added to the pinned claim-type table (the 31 existing entries unchanged). The identity and no-review lines are asserted per record inside the audit view, and the once-stated status above the list is asserted.                                                                                                                             |
| `mv-ux-01-purpose-and-controls`     | The generic purpose is that of the section the item is shown under (A2).                                                                                                                                                                                                                                                                                            |
| `pathway-resolver`                  | The composition line's new wording.                                                                                                                                                                                                                                                                                                                                 |
| `peep-comparison.rendered`          | The table's accessible name, "Model-generated example values · no hold acquired".                                                                                                                                                                                                                                                                                   |

New: `__tests__/mv-pre-review-04-learner-map.test.tsx` (37 tests) and
`test-support/mv-pre-review-04-browser.mjs` (Chromium journeys).

## Source locators

AI bibliographic check on 2026-10-07; **not** a clinical review and not sign-off.

| Claim in the module                                                                                                                           | Source                                                                                                                                                                             | Locator                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adult ARDS: 4–8 mL/kg PBW and plateau < 30 cmH₂O (origin)                                                                                     | Fan E, Del Sorbo L, Goligher EC, et al. Am J Respir Crit Care Med 2017;195:1253–1263. [doi:10.1164/rccm.201703-0548ST](https://doi.org/10.1164/rccm.201703-0548ST). PMID 28459336. | PubMed abstract, Results: "the recommendation is strong for mechanical ventilation using lower tidal volumes (4-8 ml/kg predicted body weight) and lower inspiratory pressures (plateau pressure < 30 cm H2O)".                                                                                         |
| The 2024 update keeps that recommendation                                                                                                     | Qadir N, et al. Am J Respir Crit Care Med 2024;209:24–36. [doi:10.1164/rccm.202311-2011ST](https://doi.org/10.1164/rccm.202311-2011ST). PMC10870893.                               | PMC full text, Overview ("Recommendations from the 2017 guideline that remain in place") and the closing paragraph: "two recommendations that remain in place from the 2017 guidelines … limit tidal volume (4–8 ml/kg predicted body weight) and inspiratory pressures (plateau pressure <30 cm H2O)". |
| The 2024 update's own recommendations (corticosteroids, VV-ECMO, neuromuscular blockade, higher PEEP without prolonged recruitment maneuvers) | same                                                                                                                                                                               | PMC full text, Questions 1–4.                                                                                                                                                                                                                                                                           |

According to PubMed, the 2017 guideline is the source of the limits and the 2024 guideline retains
them. Neither statement was extended beyond adult ARDS. No local copy of the 2017 paper is held; its
record says so (`identity.status: 'as-cited-not-checked'`).

Not checked in this batch: the Hamilton C6 control grouping (manual unavailable), the total-rate
sentence against a named source page, any IFU currency, any casebook claim.

## Validation

Environment: macOS (Darwin 27.2.0), node 26.5.0, `NODE_OPTIONS=--max-old-space-size=8192`,
Playwright 1.62.0 Chromium, `npm ci` in this worktree. No `.env.local` exists in the worktree; the
build and the server were given placeholder public Supabase values in their own process only, as
earlier batches did, so nothing here exercised live sync or sign-in.

| Check                                                                                          | Result                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jest src/features/mechanical-ventilation "src/app/[locale]/mechanical-ventilation"`           | **47 suites, 1398 tests passed**, 0 failed, 0 skipped (46 Ventilation suites incl. the new one, 1 route suite)                                                                                                                                                       |
| New suite alone                                                                                | 37 passed                                                                                                                                                                                                                                                            |
| `jest src/features/critical-care` (shared consumers of the Ventilation registries)             | 26 suites, 242 tests: 23 suites passed, **3 suites failed (one test each), the same three tests that fail on the untouched base**: `learner-copy` (11 → 9 findings, see above), `curriculum-sequencing` (CRRT case order), `accessibility` (CRRT circuit image name) |
| `tsc --noEmit` (whole repository, after `npm run build:content`)                               | clean                                                                                                                                                                                                                                                                |
| `eslint src/features/mechanical-ventilation "src/app/[locale]/mechanical-ventilation"`         | clean                                                                                                                                                                                                                                                                |
| `prettier --check` on the changed paths                                                        | clean                                                                                                                                                                                                                                                                |
| `git diff --check`                                                                             | clean                                                                                                                                                                                                                                                                |
| `npm run build` (training apps, content, asset validators, `next build --webpack`, standalone) | exit 0                                                                                                                                                                                                                                                               |
| Chromium journeys on the production build (`node .next/standalone/server.js`, port 3187)       | see below                                                                                                                                                                                                                                                            |

### Chromium journeys

`test-support/mv-pre-review-04-browser.mjs`, against this worktree's production build, at
1280 × 900, 1024 × 768, 390 × 844 and 320 × 740 (DPR 1), plus 1280 × 900 at 200 % root text for the
new copy. **255 of 255 checks passed**; no uncaught page error.

Covered per viewport: Overview counts, stage pairings, section numbering and folded audit view;
Practice index (15 entries, canonical names, MV-03 tag); a live case (guided-comparison wording,
explanation without a choice, no empty disclosure, verdict, learner voice, sedation label); MV-03 on
the Practice link, the guided link, a seeded Applications URL and a bare `?case=MV-03`; Applications
chooser, coverage line, verdict and the Section 4 review link followed to Section 4; Continue
through every shown step of Sections 1, 3, 7 and 9 with no answer; Part labels, the Section 7
preview and Section 12 revisit; a hint; a Learn verdict; the 2017/2024 attribution and the source
audit view; a reading location saved on the former observe step; storage keys and format; the PEEP
caption and units; uncaught page errors; module content within the viewport.

One false start is worth recording: the first run was against port 3147, which another session's
server had taken between my probe and my start, so it exercised the wrong build. It was caught
because the case page showed base wording. The server's working directory is now checked before a
run, and no other session's process was stopped.

Screenshots (`MV-PRE-REVIEW-04-screenshots/`, production build, no account data):

- `1280x900-overview.png`, `1280x900-practice.png`, `1280x900-applications.png`
- `1280x900-section7-part2.png`, `390x844-section7-part2.png` — Part label, setup line, preview label, hint
- `1280x900-section6-sources.png` — 2017/2024 attribution and the source list
- `1280x900-case-mv15.png` — action descriptions and the case question's verdict
- `390x844-mv03-held.png` — the held case as a worked explanation

## NOT RUN

- Any clinical, device, source or media review. Real intended-learner or RT observation.
- Native browser zoom, CSS zoom, DPR 2; Firefox and Safari; real devices; real assistive technology.
- The light site theme; the es and zh-CN locales; beta-wrapped routes; the deployed build.
- A development-server (`next dev`) browser pass: journeys were run on the production build only.
- Bounded all-case physiology replays and 1× / 5× / 30× comparisons: no physiology, clock or alarm
  code changed. The Batch-02 invariance suites ran inside the 1398 and pass.
- The wide-window (1707 × 900, 1440 × 900) workbench measurement: out of scope by instruction.
- The repository's full Jest run and the Playwright `e2e/` suite: no Ventilation spec exists there,
  and no shared file changed.
- A timed walk of any section. The minutes are the authors' existing estimates, now labelled as
  such; the journeys' duration is a browser run, not learner timing.

## Seen, not changed

- **The guard's nine MCS lines** — MCS copy lane.
- **`curriculum-sequencing` and `accessibility` (CRRT)** fail on the base — CRRT lane.
- **Practice at 200 % root text on a phone** and the **global site header at 200 %** — recorded in
  Batch 03; unchanged.
- **Case action list is longer**: every action now carries its one-line description. Readable at all
  four widths; whether the list wants grouping belongs with the wide-window pass.
- **`CaseWorkflow.tsx` / `MechanicalVentilationLab.tsx`** still print the casebook debrief
  unchanged; neither is mounted by a public route (the routes mount `MechanicalVentilationCaseActivityV2`).
- **`unit.shortTitle`** remains in the curriculum for non-display use; no learner surface in this
  module prints it as a section's name any more.
- **`content/lessons.ts`** (legacy, not rendered) still carries older wording.

## Holds

Unchanged, and each remains **NOT REVIEWED**:

- **Live case MV-03** — excluded on Practice, guided, seeded/legacy and Applications paths; the list
  of held cases is now one constant (`ventilationHeldLiveCaseIds`) that the activity, the counts and
  the index read. Returning it needs the named faculty/RT decision (D1/D5).
- **MV-SAFETY-01 alarm-limit harmful choice** — its missing safety note was not written.
- **D1–D5** (case onset, gas and patient signals, PEEP 13, alarm and console fidelity, measurement
  definitions) — untouched.
- **D4, added evidence**: whether Peak flow belongs in the C6 "Oxygenation" group needs the
  registered manual; the facsimile is unchanged meanwhile.
- **D6** — for Batch 05: the cycling setup's home (S7-1/S12-1); a non-repeating Section 5 Part 1 and
  Section 11 Part 2; case questions that apply the teaching without restating the title (Q4); the
  thirty absent option reasons (C12). **0** of the pack's ten substantively new or revised question
  drafts were used in this batch.
- **D7** — casebook attribution, transcripts, preprints: unchanged. The 2017/2024 correction is
  bibliographic only.
- **D8** — media and human review.

## Reviewer decisions

| Item                                                       | Decision     | Reviewer | Role | Date |
| ---------------------------------------------------------- | ------------ | -------- | ---- | ---- |
| New learner wording in the appendix (A–F)                  | NOT REVIEWED |          |      |      |
| Section 7 Part 2 kept in place with an earlier explanation | NOT REVIEWED |          |      |      |
| Total-rate sentence, including the assist-control clause   | NOT REVIEWED |          |      |      |
| C6 "Oxygenation" group contents                            | NOT REVIEWED |          |      |      |
| 2017 origin / 2024 retention wording                       | NOT REVIEWED |          |      |      |

## What must not be undone

- A section's displayed name comes from `ventilationSectionLabel`; counts from
  `ventilationCaseCounts`; neither is typed.
- "Applications" names the tab. A part of a section is a Part.
- `lesson.steps` keeps its `observe` and `interpret` steps. Removing them renumbers every step id
  and silently moves saved reading locations.
- The casebook JSON is not edited; learner wording lives in `caseTeaching.ts` with the source text
  one disclosure away.
- No option reason is written to fill the case comparison panel without a source decision.
- The source review status stays visible; only identity checks and hashes fold.
- Everything listed under "What must not be undone" in the Batch 03 handoff.

## Wording appendix

Exact new or changed learner prose. Minor presentation (A–C) is separated from sentences with
clinical content (D–F). All **NOT REVIEWED**.

### A. Names, counts and navigation (presentation)

- Hub: "…learn the five main settings, then take one mechanism at a time on the live patient… Clinical cases in Practice and the optional Applications tab connect the mechanisms."
- Hub: "{14 live cases and 1 worked explanation} that apply what the sections taught — inspect, act, reassess, and explore the explanation — each labelled with the section it builds on. Any case can be opened at any time."
- Hub: "Reading times are an author’s estimate, not timed with learners; optional experiments take longer and depend on the playback speed you choose."
- Composition line: "14 sections · 1 orientation · 2 foundations · 7 mechanisms · 3 integration sections · 1 capstone · about 102 min of reading".
- Practice: "There are 14 live cases and 1 worked explanation: MV-03 is a worked explanation while its live measurement display is under review. “Builds on” names the section that teaches a case’s mechanism; it is a suggestion, and every case opens without it."
- Practice: "Every entry, in the mechanism-alternating order" / "…A case can appear under a stage above and again here; it is the same case."
- Tag: "worked explanation · live simulation held for review".
- Applications: "10 optional items, each labelled with the section it draws on. They are a selection, not a syllabus, and they are not one per section. Sections 1, 2, 5, 7 and 12 have no item here; their experiments are in Learn."
- Section header: "This is a guided walk-through: step names, controls and explanations show what is coming and can be opened before you answer anything."
- Section header: "About N minutes to read: an author’s estimate, not timed with learners. The optional experiments add about S seconds of simulated time at 1×, less on a faster clock."
- Section header: "Reloading, or moving between Part 1 and Part 2, starts a fresh paused patient; answers and runs are not saved."
- Step card: "Step i of n · Part p of 2"; "Continue opens Part 2 on a fresh, paused patient. This part’s run and captured breaths are not kept."
- Part setup (derived): "Part 2 uses a different simulated patient from Part 1: the simulated patient of case MV-10. It starts from that patient’s own settings. It opens on a fresh, paused patient; the run and the captured breaths from Part 1 are not carried over."
- "No response has been captured in this part." / "The result for this part is captured." / "Captured reference · Part N".
- PEEP comparison: "Model-generated example values · no hold acquired".
- Foundations: "These are breaths the simulator generated from the passive MV-LAB patient." / "…includes an inspiratory hold the simulator actually performed."

### B. Feedback and lead-ins (presentation)

- "Best-supported answer." / "Not the best-supported answer. Best supported: {label}."
- "The case set gives no written reason for each alternative, so none is shown here. The explanation above is the case’s own."
- Case question purpose: "A guided comparison, not a test: the case title already names the mechanism. Use this to find the observation on this patient that sets it apart from the two other mechanisms in the same group."
- Lead-ins: "Identify the reading or control that answers this, then check it on a real run." / "Think through what would guide the next step. There is no reading to predict here; the experiment afterwards shows what the action changes." / "Interpret what these readings would mean together, then compare with a real run."
- Control strip: "This strip is the worked reading for both parts of this section. Open it before or after trying the optional questions; nothing here is held back."
- Relation lines: see the Disposition table (S5-1, S7-1, S11-1, S12-1).

### C. Sources (presentation)

- "No source listed here has a recorded clinical review of how this module uses it. What each source is cited for, and its limits, are shown with it; file identity checks are in the audit view below."
- "Source audit: identity checks and review status (N)"; "No identity check is recorded for this source."
- Hub/cases: "Review status: reviewer preview. No clinical, device or publication review of this module is recorded, and the items still required before publication are open. The list, the file identity checks and the source snapshots are in the audit view below."
- Console: "These headings are the console’s own menu groups, as registered from its manual. They are not this module’s teaching categories: where a tile sits does not say what the control changes. Flow and inspiratory time shape the timing of the breath."
- MV-03: "This case is read here as a worked explanation. Its live simulation is not offered: the simulator’s intrinsic PEEP reading for paired breaths is being reviewed by ventilation faculty and respiratory therapy, and until then a live run could teach the wrong conclusion about air trapping." / "Review status: not reviewed. No date for the live case’s return is set."

### D. Teaching sentences with clinical content

- Section 3 explanation: "Five settings do most of the work: the mode, the size of the breath (a volume, or a pressure), the rate, the PEEP and the oxygen. Flow or inspiratory time, trigger sensitivity, cycle-off and rise time shape how each breath is delivered. Everything else helps you judge delivery and tolerance."
- Section 3 boundary: "…The five main settings are a teaching aid: they are not a manufacturer’s menu grouping, and they do not list every setting of every mode."
- Control panel: "Five settings do most of the work on this ventilator: the mode, the size of the breath, the rate, the PEEP, and the oxygen." / "Flow or inspiratory time, trigger sensitivity, cycle-off and rise time are settings too: they shape how each breath is delivered and timed, and each is met at its place on the breath. Other modes add settings of their own." / "Three things in these sections are not ventilator settings: Pause and Run are playback, a hold is a measurement, and the compliance and resistance controls change the simulated patient."
- Total rate (S3-1): "The total rate counts every breath, including the ones the patient started. It is higher than the set rate only when the patient triggers breaths faster than the set rate; in assist-control each triggered breath restarts the wait for the next mandatory one."
- Section 4 example (S4-2): "At unchanged volume and flow, a passive patient’s peak rises while a valid plateau stays near its previous value."
- Section 6 (S6-1): "For adults with acute respiratory distress syndrome (ARDS), the 2017 ATS/ESICM/SCCM guideline recommends 4–8 mL/kg PBW and plateau pressure below 30 cmH₂O, and the 2024 ATS update keeps that recommendation in place." / "The stated guideline limits apply to adult ARDS…" / badge "Guideline · ATS/ESICM/SCCM 2017, kept in the ATS 2024 update · adult ARDS".
- Section 9 outcome (A3): "Separate oxygen concentration from PEEP as ways to support oxygenation, and select the reassessment."
- Section 7 Part 2 introduction (S7-1): "A different simulated patient: the obstructive patient of case MV-10, breathing on pressure support. On pressure support the patient starts each breath, and the ventilator ends it when inspiratory flow has fallen to a set percentage of its peak: the cycle-off threshold (expiratory trigger sensitivity, ETS)."
- Other introductions (S6-3): "A different simulated patient: the patient of case MV-01, who has stiffer lungs and is making inspiratory efforts. Inspect the effort trace during the hold." · "A different simulated patient from the earlier sections, the patient of case MV-07, who makes more efforts than the machine delivers breaths." · "A different simulated patient again, the patient of case MV-09, who starts the breath, but machine inspiration ends early." · "This is the patient of case MV-08. Compare effort, machine breaths, and the circuit." · "A different simulated patient, the patient of case MV-02, who has strong effort during machine inspiration. Read the sequence again." · "The distressed patient of case MV-15 can communicate. Start with their experience of breathing." · Section 3: "Start from the five main settings: mode, breath size, rate, PEEP and oxygen. Here the breath size is a tidal volume."
- Sedation action (C8): label "Deepen sedation"; description "Suppresses visible respiratory effort. It does not address timing, load, pain, or delirium."

### E. Learn hints (new; each drawn from its round's own rationale and explanation)

| Round                              | Hint                                                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1 P1 · interval A                 | Look at which side of the zero line the flow trace is on at interval A, and which way the volume trace is heading.                                         |
| S1 P2 · interval B                 | At interval B, check the sign of flow and whether the volume trace is rising or falling.                                                                   |
| S2 P1, S11 P2 · flow up            | Flow is a rate and tidal volume is an amount. Hold the amount fixed and ask how long it takes at the new rate.                                             |
| S2 P2 · flow down                  | The same amount is delivered at a slower rate: compare the slope of the volume trace and the length of inspiration.                                        |
| S3 P1 · set vs delivered           | One value is what you asked for and one is what came back. Find the one on the monitoring side of the screen.                                              |
| S3 P2 · oxygen                     | Ask on which of the three traces — pressure, flow or volume — the oxygen setting appears at all.                                                           |
| S4 P1 · resistance                 | A hold stops flow. Ask which part of the airway pressure exists only while gas is moving.                                                                  |
| S4 P2, S5 P1 · stiffness in VC     | Volume control holds one of the two things you are comparing. Decide which trace the machine is holding, then ask what a stiffer system does to the other. |
| S5 P2 · stiffness in PC            | This mode holds a different trace from the one before. Find the trace that is held, then follow the one that is free to move.                              |
| S6 P1 · smaller breath             | Elastic pressure is the delivered volume divided by the compliance, and the compliance has not changed here.                                               |
| S6 P2 · hold with effort           | Find the dashed effort trace during the hold. Ask which way a patient who is pulling in moves the airway pressure.                                         |
| S7 P1 · rate                       | Each cycle lasts 60 seconds divided by the rate, and inspiration takes as long as it did before. Work out what is left.                                    |
| S7 P2, S12 P2 · cycle-off up       | Inspiratory flow falls from its peak during a supported breath. Ask whether a higher percentage of that peak is reached earlier or later.                  |
| S8 P1 · trigger                    | Count the efforts on the dashed trace and count the machine breaths. The change is aimed at the efforts with no breath after them.                         |
| S8 P2 · cycle-off down             | The breath ends when inspiratory flow has decayed to the set percentage of its peak. Ask whether a lower percentage is reached sooner or later.            |
| S9 P1 · benefit and cost           | Three readings are named. Decide which one, if it moved the wrong way, would be a cost and not a benefit.                                                  |
| S10 P1 · rate and CO₂              | Carbon dioxide follows the ventilation that reaches exchanging lung, relative to production. Production is unchanged here.                                 |
| S10 P2 · same rate, smaller breath | Minute ventilation is the rate times the delivered volume. The rate is unchanged; find what pressure control leaves free to move.                          |
| S11 P1 · circuit                   | If the extra breaths were started by the circuit and not by the patient, ask what becomes of them once the circuit is corrected.                           |
| S12 P1 · rise time                 | Read the first part of each push: the pressure contour and the patient’s comfort together, not either one alone.                                           |
| S13 P1 · patient’s account         | Two of the choices describe what was done or recorded. One finds out something about the patient.                                                          |
| S13 P2 · reassessment              | An intervention being recorded and a patient improving are different observations. Ask which one tests the other.                                          |
| S14 P1 · flowing component         | During the hold flow is zero. Ask what happens to the part of the pressure that was there only because gas was moving.                                     |
| S14 P2 · elastic component         | Ask which part of the pressure remains once flow has stopped, and what that part depends on.                                                               |

### F. Case explanations (restated to the learner; casebook text unchanged and one disclosure away)

| Case  | Learner wording                                                                                                                                                                                                                                                                                                                                                                             | Left out of the learner text (still in "Casebook wording")                                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MV-01 | The central tradeoff is recruitment versus overdistension. Do not chase a single SpO₂ value without watching the mechanics and the blood pressure. The same PEEP increment can help at one point on the compliance curve and harm at another.                                                                                                                                               | —                                                                                                                                                                                                            |
| MV-02 | In volume control, a fixed flow can be inadequate even when the tidal volume is reasonable. Match flow and timing to the patient’s demand while the cause of the high drive is treated. A normal respiratory rate is not the only goal in metabolic acidosis.                                                                                                                               | —                                                                                                                                                                                                            |
| MV-03 | Double triggering is a timing problem with a volume-injury consequence. One patient effort outlasts the machine’s inflation and starts a second one before the first has emptied, so the two volumes stack. Count the volume inflated per patient effort, not only per machine breath: that is why breath stacking can defeat a low tidal-volume strategy.                                  | "The simulator should calculate…" (turned into what to count). The second sentence restates the casebook's own third hint and its finding "A single prolonged patient effort spans both ventilator breaths". |
| MV-04 | Reverse triggering is ventilator-to-patient entrainment: the machine breath comes first and the patient’s effort follows it. It is often hard to recognize without effort monitoring, so look for indirect clues and for a fixed phase relationship between the mandatory breath and the effort. Management depends on context and does not reduce to more sedation or less sedation alone. | "the case should teach…"                                                                                                                                                                                     |
| MV-05 | The missed efforts here are often caused by hyperinflation, not by weak effort. High support can create a larger tidal volume, a shorter expiratory time, more intrinsic PEEP and more missed triggers. The corrective direction may therefore be less support, earlier cycling and more expiratory time.                                                                                   | —                                                                                                                                                                                                            |
| MV-06 | This is time-critical obstructive shock. The key is to unload trapped gas first, then deliberately accept a low minute ventilation. Raising the respiratory rate is harmful here: it leaves even less time to exhale.                                                                                                                                                                       | "The simulator should make the harmful effect of increasing RR immediate and unmistakable" (kept as the clinical point)                                                                                      |
| MV-07 | Missed triggers can arise from low effort as well as from intrinsic PEEP, so the waveform context matters. Improve sensitivity and reduce load, and avoid the opposite error of autotriggering.                                                                                                                                                                                             | —                                                                                                                                                                                                            |
| MV-08 | Autotriggering is the machine misreading a signal as an effort. Check the circuit and the patient-effort signal before treating what looks like a respiratory drive problem.                                                                                                                                                                                                                | "The case rewards…"                                                                                                                                                                                          |
| MV-09 | Premature cycling is common when a short time constant and a high cycle threshold make flow fall rapidly. Align the timing of the breath with the patient’s inspiration; simply increasing the tidal volume does not do that.                                                                                                                                                               | —                                                                                                                                                                                                            |
| MV-10 | Delayed cycling is especially likely in obstructive lungs because flow decays slowly. High support and a low cycle threshold can keep the ventilator inflating after the patient’s inspiration has ended.                                                                                                                                                                                   | —                                                                                                                                                                                                            |
| MV-11 | Rise time is not a cosmetic setting. It changes peak flow, effort, mechanical inspiratory time and comfort. The value that suits a patient depends on their respiratory drive and mechanics, so there is no single universal number.                                                                                                                                                        | "the simulator should avoid presenting one universal number"                                                                                                                                                 |
| MV-12 | Over-assistance may look comfortable in the moment, but it can produce alkalemia, periodic breathing, missed efforts, sleep disruption and diaphragmatic unloading. The target is shared work, not zero effort.                                                                                                                                                                             | —                                                                                                                                                                                                            |
| MV-13 | Peak pressure contains a resistive and an elastic component. A large peak-to-plateau gap directs you toward airway or circuit resistance. The cause differs between runs of this case, so read this patient’s findings; do not rely on recalling an earlier run.                                                                                                                            | "The randomized branch prevents rote pattern matching"                                                                                                                                                       |
| MV-14 | Two distinctions meet in this case: patient causes versus ventilator causes in an emergency, and resistance versus compliance. Integrate the mechanics with the bedside examination; the waveform is not read in isolation.                                                                                                                                                                 | "This case reinforces…"                                                                                                                                                                                      |
| MV-15 | Dyspnea, anxiety, pain and delirium reinforce one another, and physical signs and oxygen saturation can underestimate suffering. Assess the patient directly, make small physiology-based ventilator changes, communicate, and treat reversible stressors before deep sedation.                                                                                                             | "The case should reward…"                                                                                                                                                                                    |

## Stop

One bounded draft PR, opened and stopped. No merge, no deploy, no wide-window follow-up, no Batch 05
or 06, no readiness change.
