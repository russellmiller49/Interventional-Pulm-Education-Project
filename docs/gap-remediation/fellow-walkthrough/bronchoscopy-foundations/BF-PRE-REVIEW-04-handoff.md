# BF-PRE-REVIEW-04 — teaching clarity, honest review state and the survey-to-report path: handoff

**Batch scope:** lane 04 of the Bronchoscopy Foundations fellow-walkthrough package — first-use
definitions, wayfinding, honest repetition, the S14 ordering review and the S12-to-S22
survey/report path (A6, A7, A11, A14, A17, A19, A27, A31, A34, A35, A38–A43, and the local parts of
SUP-01, 04, 06, 10, 12, 14) — plus **BF-01 finding 3**, the 3D view that stayed in loading after
an asset failure. **No clinical approval, no source, media or anatomy review, no real-learner
validation, no readiness change, no release, no deployment and no merge is claimed or performed.**
Lane 05 (media and clinical decisions) and lane 06 (combined acceptance) are not started.

**Status, 7 October 2026.** Implemented, production-built and browser-verified at code head
`05cf6ad0`. One bounded draft PR, awaiting owner review.

The walkthrough this repairs is Claude in a first-year-fellow persona, not a fellow, technologist
or faculty reviewer. Its severity labels are kept as its own; the dispositions here are this
batch's. Clearer wording is not clinical approval: every "review pending" label is still in place.

Companion files: `BF-PRE-REVIEW-04-dispositions.json` (per-finding record) and
`BF-PRE-REVIEW-04-wording-appendix.md` (every changed or added string, with where its words come
from).

## Repository reconciliation

| Field                   | Recorded value                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base SHA                | `b85da4a00fc1959ff9d5818d8a2b89d98d275723` — `origin/main` fetched 2026-10-07 at the start of this batch (merge of PR #340). The planning SHA `77a141cc` was not restored.                                                                                                                                                                                                                             |
| Checkout and branch     | `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/claude-bf-pre-review-04-20261007`, a dated per-task worktree; branch `claude/bf-pre-review-04-20261007`, clean and equal to `origin/main` at the start.                                                                                                                                                                         |
| Batches 01–03 present   | PR #254, #274 and #291 are merged in the base, with their handoffs and dispositions in this folder. Batch 03 was closed by a post-merge check on `15c52445`.                                                                                                                                                                                                                                           |
| Ownership check         | No open PR holds a BF branch (open at start: #346, #345, #344, #343, #342, #337, #335, #326, #321, MT #295–#307, #114, #98). The only other BF branch on the remote is the merged `claude/bf-pre-review-03-9-25`. Two other desktop sessions were live (ICU Hemodynamics, Mechanical Ventilation), in their own worktrees. The only processes with this worktree as their directory were this session. |
| Instructions read       | `AGENTS.md`, `CLAUDE.md`, `docs/local-authoring-assets.md`, `docs/gap-remediation/beta-finish-line.md` (BF-04 entry), the BF-PRE-REVIEW-01/02/03 handoffs, and in place in Local-Data: `00_START_HERE.md`, `04_BF_TEACHING_AND_SURVEY_FLOW.md`, `feedback-ledger.json` (the assigned findings), `PI_EBUS_BBT_BF_COORDINATION.md`, `SOURCE_AND_CODE_NOTES.md`, `OWNER_DECISIONS.md`.                    |
| Restricted-content rule | The clinical section files on the module's restricted list were not read into the session. Their structure was taken from whitelisted structural dumps (ids, headings, kinds, word counts) and from two read-only helpers told to return identifiers only. The walkthrough's Appendix B was read the same way. No patient media was opened.                                                            |
| Ports                   | **3146** — the unchanged base, production build `QOm9tykat3tn1JV4fGe1-`, served standalone from a copy outside the checkout; **3147** — this branch, final build `C0CuwGZ5yXnIPO38Xh5A_`. Nothing else listened on them.                                                                                                                                                                               |
| Environment             | Node 26.5, Next 16.2.2 `next build --webpack` via `npm run build` with an 8 GB heap and `NEXT_PUBLIC_SHOW_DRAFT_MODULES=true`; no `.env.local` in this worktree, none read or written. Playwright Chromium, isolated contexts, `/api/analytics` stubbed by the suites. Evidence: `Interventional-Pulm-Local-Data/renders/output/bf-pre-review-04-2026-10-07/{baseline,after,logs}/`.                   |
| Not done                | No `.env.local` access, no owner-profile session, no production data write, no paid API call, no merge, no deploy, no Batch 05 or 06 work, no clinical approval, no readiness change.                                                                                                                                                                                                                  |

## Commits

| SHA           | What                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `287581f3`    | BF-01 finding 3: the visibility observer follows the mounted element; the load state machine.        |
| `5b3b23cf`    | The teaching, status and survey/report changes.                                                      |
| `05cf6ad0`    | A retry re-requests a model request that hung; the Batch 04 Jest and Playwright suites.              |
| (this commit) | This handoff, the dispositions and the wording appendix. Its SHA is the PR head, recorded in the PR. |

Every changed runtime file is under `src/features/bronchoscopy-foundations/**`. Outside it:
`e2e/bronchoscopy-foundations-batch04.spec.ts` (new), `playwright.bronchoscopy-foundations.config.ts`
(its `testMatch` now includes the new file) and this folder. No shared stage file, `AnswerVerdict`,
`HelpDialog`, global CSS, shared airway library, other module, auth, server data or public asset
changed.

## BF-01 finding 3 — "Try the 3D view again" stayed in loading

**Reproduced on the base build** with the BF-01 recipe: abort `**/anatomy/larynx/**`, reach S9
Part 3 (`data-three-state="failed"`), take **Use the schematic view**, restore the route, take
**Try the 3D view again** — `loading` for the full 30 s. A second shape of the same defect also
reproduced: after repeated failures and a restored route, **Reload the 3D view** stayed in
`loading`.

**Root cause, now confirmed in the browser.** `ScopeScenePane` attaches the playback element to a
different node in the 3D branch and in the schematic branch. `useScopePlayback` bound its
`IntersectionObserver` in an effect keyed on the ref object, whose identity never changes, so after
the switch it was still observing the node that had left the page. A removed node reports
`isIntersecting: false`; `visible` stayed false; the canvas ran with `frameloop="never"`; no frame
was drawn; `onDraw` never fired; the status stayed `loading`.

**Repair — a bounded retry state machine.**

1. `useScopePlayback` takes the mounted element itself, held as state by the pane, so the observer
   is rebound whenever the element changes.
2. `components/scope/sceneLoad.ts` is the scene's load as one reducer: `loading | ready | failed`,
   with an attempt number, a count of automatic recoveries and the reason for the last failure.
   Every way back to `loading` is counted:

   | Event                                                         | From       | To                                                                |
   | ------------------------------------------------------------- | ---------- | ----------------------------------------------------------------- |
   | first frame drawn                                             | `loading`  | `ready` (ignored once the attempt has failed)                     |
   | asset, renderer or render error                               | any        | `failed`                                                          |
   | the learner's retry                                           | any        | `loading`, a new attempt; automatic recoveries reset              |
   | graphics context lost                                         | not failed | `loading` for at most **2** recoveries per attempt, then `failed` |
   | deadline: **45 s** on screen in a visible tab without a frame | `loading`  | `failed`, with the retry and the schematic view on offer          |

   Time offscreen or in a background tab does not count toward the deadline: nothing is drawn there
   by design.

3. A new attempt re-requests model files whose earlier request never settled
   (`forgetPendingScopeModels`). Loaded models stay cached; failed ones were already forgotten.
4. While the controls wait for the first frame the dock says so: "The 3D view is still loading. The
   controls open when it has drawn; nothing you press before then is counted."

**After (final build):** failure → schematic → retry by keyboard → `ready`; three retries that fail
again each return to `failed`, never to `loading`, and the next one after the route is restored
draws; a request that never answers fails at the deadline (`data-three-failure="deadline"`) and the
next reload draws (`data-three-attempt="1"`).

**Not changed:** the scope reducer, the scripted clock, goals, accessory and closed-fold
interlocks. The controls still open only on a drawn frame or in the schematic view. PR #291's one
bench presentation for the scene and the end-on drawing is intact and its suites pass.

**Limits.** The shared airway-geometry loader (`src/lib/airway-anatomy/airway-render.ts`) keeps its
own in-flight cache. A request that hangs there is bounded by the deadline, but a retry waits on
the same request; that file has other consumers and was not changed. The 45 s deadline and the
limit of two recoveries are design values, not measurements.

## The survey-to-report path (A35)

Three kinds of evidence are separate in the type (`SurveyEvidence`), on the screen and in storage.

| Kind                     | What it is                                                                                                                             | How it is named                                                                                                                                                                                                 | Storage                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| The learner's own survey | Only what `availableSurveySnapshot` returns: the current record's survey, saved when the learner met S12's goals on their own controls | "Use my recorded survey"; report `report-from-your-survey`, "Your completed survey record"                                                                                                                      | Read once at mount. Never written by S22.             |
| Supplied teaching record | The lower lobe already worked in S12 (`lower-lobe-worked`), as four record statuses, held as constants                                 | "Work through a supplied teaching record (not mine)"; report `report-from-supplied-teaching-record`; "Supplied teaching record — not your examination" on the choice, the evidence title and every airway field | None. It exists only in `engine/inspectionReport.ts`. |
| No survey evidence       | An empty record                                                                                                                        | "Continue with no survey evidence"; report `report-without-survey-evidence`, "No saved survey examination"                                                                                                      | None.                                                 |

- **S12** now says the survey is used again, and what does not count (an unfinished survey, a
  demonstration, a step moved past).
- **"My recorded survey" is unavailable, with the reason,** when the device holds none. A visited or
  reviewed mark, a survey in the earlier course's record, and a current record that does not parse
  each leave it unavailable. `availableSurveySnapshot` was not changed.
- **Switching** clears the report's fields (`REPORT_RESET`), so a statement chosen for one record is
  never carried onto another's. Returning to the learner's own survey shows the same fields and the
  same evidence as before.
- **Calling the supplied record one's own examination is a refused option**, with the reason.
- **Finishing** the supplied report says: "It was not your examination, and nothing was saved as
  your survey." Looking back at the step says the fields were filled "from the supplied teaching
  record, not your examination".
- **No normal finding is inferred in any mode**; the larynx stays "not assessed"; the supplied
  record's entered-but-not-inspected airway and its inaccessible opening are left as they are.

**The supplied record's status: implemented from existing teaching; owner approval as a report
example is pending** (`OWNER_DECISIONS.md`, "Supplied report example"). It adds no clinical
narrative: its four rows are the statuses the S12 worked example already states, and the words on
its report are the model's existing status wording. A test ties each row to the corresponding line
of that example. If the owner withdraws it, removing the `supplied` option is a one-file change.

### Provenance validation

| Check                                                                               | Result                                                                                                              |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Earlier record's bytes (fixture sha256 `59cd3b11…0829f0`, 1,163 bytes) before/after | Identical after every mode, at 7 sizes and in the legacy-only case                                                  |
| Current record's `surveySnapshot` before/after using the supplied record            | JSON-identical (fixture sha256 `2dd20ce3…a48c5aa`); also for a survey made on the real controls, and after a reload |
| "LB6" (a supplied-record airway) in stored data                                     | Never present                                                                                                       |
| Supplied record shown in S12                                                        | Never (`[data-ledger-row="LB6"]` count 0; no "Supplied teaching record" text)                                       |
| Finish S22 after the supplied record, with no survey of one's own                   | `reviewedSectionIds: ['honest-report']`, `surveySnapshot: null`, earlier record absent                              |
| Storage schema                                                                      | Unchanged; the stored record's keys equal the empty record's keys                                                   |

Modes exercised: a genuine current survey made with the page's own controls (browser); a stored
current survey, partly declared (synthetic fixture, labelled); none; legacy only; an unparseable
current record; a reviewed/visited marker only; learner → supplied → learner → none; finishing the
section after the supplied record.

## What changed, by finding

Full records are in the dispositions file. In brief:

| Finding | Before (base build)                                                                                         | After (final build)                                                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A6      | A check repeated its worked example with nothing saying so                                                  | 14 repeating screens in 11 sections say "Guided rehearsal, not a new case" or "Retrieval practice, not a new case", naming what is shared and where it was worked |
| A7      | S14 steps opened as the worked order rotated by two (authored indexes 2–7, 0, 1); retry gave the same order | A fixed permutation that is never the worked order or a rotation of it (round 0: 4, 0, 7, 5, 1, 6, 2, 3); reshuffles only on request                              |
| A11     | The five controls were listed only in the Reference                                                         | Listed on S5's first screen from the Reference's own data; the fifth pointed to S16; kept apart from S1's five questions                                          |
| A14     | 41 blocks in 16 sections each ended "Not configured. …" in full; 10 parts carried it two or three times     | Each block names its own policies; "no local policy has been supplied" is said once per part (29 statements), with a Reference link                               |
| A17     | "the pathways in the sort", "the man in the prediction"                                                     | The section's own case and the four box names are introduced before use                                                                                           |
| A19     | The eight S3 names were first met as answer choices                                                         | All eight defined with the overview in Part 1; "suction control" reconciled with "suction valve"                                                                  |
| A27     | "Read the observations" with none supplied                                                                  | Named a guided demonstration, with its authored context and its goal's own condition                                                                              |
| A31     | Two goals asked the learner to "say which lobe"; nothing could hear it                                      | Goals state only what the model records; the reflection is offered as unrecorded                                                                                  |
| A34     | S21 changed topic with no transition                                                                        | Part 3 says a second topic starts; Part 6 says it returns to the first                                                                                            |
| A35     | See above                                                                                                   | See above                                                                                                                                                         |
| A38     | "Estimated N min" and bare "N min", three wordings                                                          | "about N min" everywhere; the header and the hub say the times are untimed estimates                                                                              |
| A39     | 12 screens, 7 positions (five repeated); silent while the 3D view loaded                                    | Every screen has its own position ("· step 2 of 2"); repeats are called optional; the dock says when the controls are waiting                                     |
| A40     | Badges had no stated reference                                                                              | Every monitor says what a badge is compared against and what each badge on it means                                                                               |
| A41     | Three vocabularies for the record, no key                                                                   | A legend: what the model sets, what the learner declares, and that the record holds no finding                                                                    |
| A42     | "marked reviewed by you" for a mark the course sets                                                         | The mark is said to be set on reaching the end, for navigation, not a sign-off                                                                                    |
| A43     | 16 transcripts listed under file names as titles                                                            | "Transcript file “…” (lecture title not verified)"                                                                                                                |

Supplemental notes: SUP-01 no change, as planned. SUP-04 the guideline is named by source U2's
registered title; the four boxes are named. SUP-06 "review pending" is explained on the hub and in
each lesson's Help; no label was removed. SUP-10 the airway map has a key from the teaching tree's
own names; MALPS is recorded for review. SUP-12 the repeated tour and overview are labelled
refreshers. SUP-14 the duplicated S13 still is shown once.

### The repeat inventory (A6)

Classified from the walkthrough's Appendix B against the course flow. "Literal redisplay" marks the
three worked visuals the course draws from the item itself.

| Section | Repeating part             | Worked in                 | Class             |
| ------- | -------------------------- | ------------------------- | ----------------- |
| S1      | check                      | Part 2 (worked block)     | guided rehearsal  |
| S2      | matching activity          | Part 2 (worked match)     | literal redisplay |
| S2      | check                      | Part 2 (worked plan)      | later retrieval   |
| S3      | check                      | Part 2 (worked situation) | literal redisplay |
| S4      | accounting activity, check | Part 2 (worked block)     | guided rehearsal  |
| S8      | check                      | Part 2 (worked block)     | later retrieval   |
| S12     | check                      | Part 2 (worked block)     | guided rehearsal  |
| S13     | report activity, check     | Part 2 (worked block)     | guided rehearsal  |
| S14     | ordering activity          | Part 2 (worked sequence)  | literal redisplay |
| S15     | check                      | Part 1 (baseline)         | later retrieval   |
| S17     | matching activity          | Part 2 (worked match)     | literal redisplay |
| S21     | matching activity          | Part 3 (worked match)     | literal redisplay |

S21 is not in Appendix B; it uses the same worked-match visual, so it was inventoried with the
others. No "proposed new application" was implemented: those are batch 05 proposals.

## Preserved contracts (Batches 01–03 and earlier)

Verified by the complete BF Jest suite and the complete BF browser suite on the final build.

- **Self-paced.** Explanation before any answer, Review the teaching, retry, and a skip that
  records nothing are on every changed screen (asserted). No input gate, score, count,
  first-attempt record, quota or mandatory acknowledgement was added. The reflection note holds no
  control.
- **Stable identities.** No section, step, item, row, block, goal, control or source id changed.
  One part title and two goal labels changed (appendix rows 16–18). No stem, option, key, rationale
  or explanation changed.
- **Simulation.** `scopeReducer`, `scopeScripts`, `scopeAccessory`, `scopeGoalEvaluation`,
  `goalPresentation` and `stageSession`'s scope handling are unchanged. The brush misreport and the
  exposed-accessory refusal, the scripted clock, the closed-fold guard and "history versus current"
  goal wording all pass their existing cases.
- **Batch 02.** Source classes and locators, the Reading-the-view table, the S4 primary Check, the
  scenario Decide → feedback → Continue pattern and the question kept above the shared
  `AnswerVerdict` pass unchanged.
- **Batch 03 / PR #291.** Enlarge dialog and detail windows, the end-on bench drawing, "Show me
  where" from the reducer, the compact goal card, the S7 comparison and the S20 cross-section pass
  unchanged. Part notes sit with the coaching on a scope step, never above the view.
- **Storage.** The record schema, `availableSurveySnapshot` and the earlier record's bytes are
  unchanged. Only `engine/selfPacedProgress.ts` writes storage (boundary guard passes).
- **Holds.** Every source, media, anatomy, local-policy and clinical hold is unchanged, including
  the owner-held lavage key and **SUP-07 (dose guidance): not touched**. No policy value was
  supplied; all sixteen are still null.

## Validation

Commands were read from `package.json` and the Playwright configs. Unique tests are counted once;
reruns are listed separately.

| Check                                                                                                                    | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx jest src/features/bronchoscopy-foundations 'src/app/\[locale\]/bronchoscopy-foundations'`, pristine base `b85da4a0` | 36 suites, 523 passed, 1 todo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| the same at the final code head `05cf6ad0`                                                                               | **38 suites, 580 passed, 1 todo** (57 new cases in two new files: `teaching-and-survey-flow` 46, `scene-retry` 11; three existing expectations updated for the new wording — hub, pathway-resolver, self-paced-summaries; two harness-only edits — `scope-playback` passes the element, `workbench-and-visuals` gains the standard Link mock; the todo is the pre-existing larynx/trachea one)                                                                                                                               |
| The 57 new Jest cases against the unchanged runtime                                                                      | **41 of 57 fail.** Run in a detached worktree at the base with the two new test files and only the six new files as shims the base runtime never imports (`sceneLoad`, `sequenceOrder`, `repetition`, `LocalPolicyNote`, `ReferenceLink`, `SurveyRecordChoice`). The 16 that pass are unit tests of those shimmed helpers (13: the load machine 7, the permutation 3, the repeat inventory 3) and 3 preserved-contract guards (no item changed; every policy block still shown; the stored record alone decides "my survey") |
| The three updated existing expectations, and the element-taking playback harness, against the base runtime               | fail, as expected (10 cases across 4 files)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.json`                                               | exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `npx eslint --max-warnings=0` on every changed `.ts`/`.tsx` (47)                                                         | 0 errors, 0 warnings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npx prettier --check` on every changed path                                                                             | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `git diff --check b85da4a0 HEAD`                                                                                         | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `NEXT_PUBLIC_SHOW_DRAFT_MODULES=true npm run build`                                                                      | exit 0 at the base (`QOm9tykat3tn1JV4fGe1-`) and at the final code head (`C0CuwGZ5yXnIPO38Xh5A_`); one "Compiled with warnings" block in each (the third-party dynamic-require notice Batch 03 recorded)                                                                                                                                                                                                                                                                                                                     |
| Playwright, complete BF suite on the final build (`playwright.bronchoscopy-foundations.config.ts`)                       | **91 unique tests, 91 passed** in one run of 20.0 min: 67 existing (`bronchoscopy-foundations.spec.ts`) and 24 new (`bronchoscopy-foundations-batch04.spec.ts`)                                                                                                                                                                                                                                                                                                                                                              |
| The 24 new browser cases against the base build                                                                          | **24 of 24 fail** (21 in one run; the hung-request and genuine-survey cases in a second). The hung-request case fails on its first Batch 04 assertion, the waiting note, before it reaches the deadline; the retry defect itself is shown on the base by the two failure-and-retry cases, which stay in `loading` for 30 s                                                                                                                                                                                                   |
| Systemic-UX checks that load BF (`bf:` at six sizes and "all nine public entry routes")                                  | 7 passed on the final build; 7 passed on the base                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

**The new browser cases, by size.** A35's three records: 1204×987, 1440×900, 1024×768, 390×844,
320×740, and 200% root text at 1204×987 and 390×844 (keyboard reach of each choice, the identity
line on screen, no sideways scroll, storage hashes). A7: 1204×987, 390×844, 390×844 at 200%. The
repeat note, the once-per-part policy statement and the S21 signpost: 1204×987, 1024×768, 320×740,
1204×987 at 200%. The reflection note with the scene drawing: 390×844; the record legend and map
key: 1024×768. The 3D retry, the genuine survey and the remaining wording cases: 1440×900 or
1204×987. The complete existing suite keeps its own matrix.

Reruns and intermediate builds, not counted again: an intermediate build `p11grPTBhAJ7L5S1EuqZ9`
(code `5b3b23cf`) ran the new cases 21 of 21 after three test-harness corrections (a fit check
that counted the closed sections drawer; a pointer probe that landed under the pinned continuation
bar at 390 px and 200% text, replaced by a check of the focused control; a tab that exists only at
narrow widths), and the genuine-survey case once (5.9 min). A complete run of the existing suite on
that build was stopped at 5 tests when the hung-request change required a rebuild; it is not
counted. Two new Jest assertions were corrected on first run (a figure selector; a case-sensitive
name comparison).

Browser acceptance used real routes of the production build with native pointer and keyboard input
(clicks, radio-group arrow keys, Enter on buttons and summaries, slider page and arrow keys, native
select). No forced click, no injected reducer state, no fabricated capture or inspection event. The
stored-survey cases use a labelled synthetic fixture written before the app starts; the genuine
case makes its survey on the page's controls — the fixed Advance and Withdraw steps, whole-degree
rotation and deflection, Clear the lens and the Declare menu — and asserts the page's own goals,
record and saved data. Its list of inputs is planned against the same engine in Node; nothing is
injected.

"200% root text" is the root font size set to 200%, not native browser zoom. At that size the
site's own header and footer overflow the page, identically on the base (shared chrome, recorded by
Batch 02); the course region is measured on its own there.

## Unresolved holds and decisions

Unchanged from Batches 01–03: the S7 five-level CT trace (A25), laryngeal landmarks (A28), the
larynx close-up and inlet continuity (A2), head-on tour stills (A29), anatomy at the carina (A24),
part identity (A18), screen-reader review (A20), the lavage key, and every local policy.

Raised or left open by this batch, for the owner:

1. **Supplied teaching record (A35).** Approve, change or withdraw it as the S22 example.
2. **S4 heart-rate badge (A40).** The reading describes a brief rise that returns, badged steady.
   The legend explains it; whether the badge should differ is an authoring decision.
3. **New application cases (A6).** At most ten candidates, batch 05.
4. **S21 (A34).** Whether to split it; any ventilator waveform figure.
5. **MALPS (SUP-10).** Used once in S11 with no definition in any registered source. Define it from
   a source, or remove it.
6. **The four-box plan's origin (SUP-04).** Not attributed; needs the source checked.
7. **Lecture titles (A43).** Verified titles for T01–T16.
8. **Timing (A38).** Observed durations with intended learners.
9. **SUP-07 dose guidance.** Unresolved and untouched.

Shared, not this batch's: the intro-course footer and the clipped language menu stay with PI
platform 05 (A43's shared part).

## NOT RUN / limitations

- No human review of any kind: faculty, learner, technologist, clinical, source, media, anatomy or
  accessibility specialist; no usability session; no screen reader was listened to.
- Chromium only; Safari/WebKit and Firefox not run. Native browser zoom not tested.
- Both themes were not compared for this batch: the new elements use the module's existing tokens
  and classes (one new rule each for the part notes, the record legend and the map key). The
  existing suite's theme pass ran and passed.
- The 3D retry was exercised with reduced motion (the BF config's setting); ordinary motion was not
  run for it. No clock or animation code changed. A lost graphics context was exercised in the
  reducer only, not forced in a browser.
- The deadline was exercised once in the browser with a request that never answers (45 s real
  time); the hidden-tab and offscreen exemptions are covered by the hook's existing unit suite, not
  by a new browser case.
- The genuine survey was made at 1440×900 only.
- The walkthrough's own figures were not re-rendered; Appendix B was read as a structural inventory
  by a helper, not line by line in this session.
- At 200% root text the site header and footer overflow the page, identically on the base (shared
  chrome); the course region fits.

## Backlog raised in passing (not repaired here)

- S13 Part 3's instruction says the still "stays in the Simulator panel", but that part shows no
  workspace.
- The section files' own step texts for S8 ("Name what the field shows") and S21's explain title
  are validated but not rendered by the course flow; they are dead copy.
- Source U2 has no byline in the manifest, so its line runs the title into the year.
- The shared airway-geometry loader's in-flight cache (see the BF-01 finding 3 limits).
