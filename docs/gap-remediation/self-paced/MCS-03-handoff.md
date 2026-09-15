# MCS-03 — Mechanical Circulatory Support: consequential teaching and source holds, first batch

Prompt MCS-03 of the v2 self-paced action pack
(`Interventional-Pulm-Local-Data/roadmaps/IP-Education-Self-Paced-Action-Pack-v2/prompts/MCS-03.md`),
read in place with `LEARNING_DESIGN_BRIEF.md`. Prepared 2026-09-15 by an AI authoring assistant
(Claude) at the owner's request. **Nothing here is clinical approval.** All ten items in the
[claim-review queue](MCS-03-claim-review-queue.json) are `NOT REVIEWED`, and the
[observation guide](MCS-03-observation-guide.md) is prepared, not run with learners.

## Delivery and scope

- Worktree `…/Interventional-Pulm-Education-Worktrees/claude-mcs-03`, branch `claude/mcs-03`, cut
  from `origin/main` at `905372be` (merge of PR #221). The tree was clean. MCS-01 (PR #217) and
  MCS-02 (PR #219) are in the base and were carried forward: the self-paced contract (optional
  questions, explanation before answering, retry, location-only progress) and MCS-02's matched
  filled/underfilled comparisons are unchanged. The historical review baseline `9ef04539` is an
  ancestor; 51 MCS files changed on main since then, and that newer work is preserved.
- The prompt's `docs/gap-remediation/mcs/` does not exist; MCS records are in `docs/critical-care/`
  and this folder.
- **Module-local.** Every changed runtime and test file is under
  `src/features/mechanical-circulatory-support`. The shared records
  `critical-care/content/measurementClarifications.ts` and `sourceConflicts.ts` were read and
  checked, not edited. The shared critical-care evidence registry projects this module's source list,
  so it now carries the two registered Cardiosave documents as device-workflow records; no class or
  mapping changed. Nothing in `learning-module`, `src/lib`, routes, catalog, progress or Device
  Intelligence changed.
- At the start, one other worktree (`codex-ecmo-02`) had uncommitted edits to shared
  `critical-care/content` files. They were not touched.
- No model coefficient, success signal, starting state, alarm, interlock, storage key, analytics
  payload, dependency, backend, deployment or remote data changed. No URL was fetched. No `.env.local`
  was added.

## How the ten items were chosen

The queue covers the remaining model and source disagreements and the interpretations most likely to
teach something unsafe. It takes the three device families in turn and keeps the Impella CP
manufacturer-measurand clarification separate from the textbook flow disagreement.

| ID        | Family       | Topic                                                    | Finding                                                                                                                                                                                                                                                                                     | Change / hold                                                                                                                                                      |
| --------- | ------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MCS-03-01 | Microaxial   | Impella CP flow measurands (shared clarification)        | All three quantities verified in the supplied February 2026 IFU rev V at the record's locators (PDF pages; printed 3.4, 5.25, 6.73, 9.15). The model's CP ceiling is the 4.3 peak systolic figure; its P-9 mean flow is 3.85, above the 3.7 maximum mean                                    | **Held**; no change. Kept apart from 02                                                                                                                            |
| MCS-03-02 | Microaxial   | A textbook chapter's two CP flows (shared conflict)      | Both statements at printed pages 26 and 27 of Walters & Reeves in Birgersdotter-Green & Adler (Springer 2021); the registry called it a private source “reviewed July 2026”, year 2026                                                                                                      | Registry identity corrected; shared record unchanged                                                                                                               |
| MCS-03-03 | Microaxial   | Impella 5.5 figure                                       | Card said “maximum flow”, preview said “mean flow; not a guaranteed maximum”; the supplied rev L says maximum mean flow (printed 3.3; Table 9.15)                                                                                                                                           | **Corrected** on three surfaces                                                                                                                                    |
| MCS-03-04 | Microaxial   | Impella RP figure and product identity                   | Supplied document is Impella RP rev N (April 2024): 4.0 maximum in its parameter table but P-9 3.9–4.4; the registered product page is RP Flex                                                                                                                                              | **Held**                                                                                                                                                           |
| MCS-03-05 | IABP         | Trigger choice in atrial fibrillation; internal trigger  | The model scores AF pressure 0.74, ECG 0.5, internal 0.4 and clears its alarm on pressure; the supplied Cardiosave material prefers ECG for arrhythmias, advises against pressure triggering in sustained irregular rhythm, and says not to keep internal triggering while the heart ejects | Transfer no longer rewards leaving ECG; ECG answer regraded partly right; model limit named in the exercise, explanation and two case explanations. **Model held** |
| MCS-03-06 | Microaxial   | First response to suction                                | Supported by the CP IFU order (printed 7.17); the model keeps suction after a one- or two-level reduction and clears it when filling returns                                                                                                                                                | Rationale and explanation rewritten                                                                                                                                |
| MCS-03-07 | Microaxial   | Left-sided escalation in a right-limited circulation     | “Raises the displayed number without raising effective systemic flow” — the model adds 0.17 L/min with suction persisting                                                                                                                                                                   | One sentence corrected; draft                                                                                                                                      |
| MCS-03-08 | Durable LVAD | High-power transfer                                      | Stem said effective flow and perfusion worsen; the setup (pattern only) gives power 4.90 → 7.70 W with flow 6.30 → 6.31                                                                                                                                                                     | Title, context, stem, rationale, explanation and task title reworded                                                                                               |
| MCS-03-09 | Durable LVAD | Speed bounds, authorization, HM3 revision, power notices | No HeartMate 3 labeling supplied; registry year 2026 contradicts its own October 2018 citation                                                                                                                                                                                              | **Held**; interlock intact                                                                                                                                         |
| MCS-03-10 | All          | Two supplied syntheses cited as primary evidence         | Both Word files: creator OpenAI, 2013 placeholder dates, no author, date or references; registry said “reviewed July 2026”, 2026                                                                                                                                                            | Identity, null dates, limits; evidence card wording                                                                                                                |

Every item in the queue carries: exact learner wording and file, device profile, source locations with
findings, a dated document check, the model output, the unresolved disagreement, what is missing and
what to reassess, the clinical question, the question disposition, the hold, the change in this batch,
the content version and an empty reviewer decision. The documents checked (paths, SHA-256, page
counts, identity as printed) and the sources that were not available are listed in the queue.

## Behavior: old → new

| Surface                                                      | Before                                                                                                                                 | After                                                                                                                                                                                                                                |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Left microaxial pathway card, Impella 5.5 figure             | “Product-reported maximum flow”, “Device specification for this labeling revision…”                                                    | “Maximum mean flow”, “Device specification for the Impella 5.5, a different pump from the Impella CP figures above; not a guaranteed patient flow”                                                                                   |
| Impella variant preview, 5.5 flow framing; 5.5 source record | “Product-reported mean flow of 5.5 L/min; not a guaranteed maximum.”                                                                   | “Maximum mean flow of 5.5 L/min in the device specification; actual flow remains loading-dependent.”                                                                                                                                 |
| Case-Based Device Therapy record                             | “Owner-licensed private authoring source, reviewed July 2026.”, 2026                                                                   | Walters & Reeves chapter in Birgersdotter-Green & Adler, Springer 2021; limit names the printed pages and the rev V comparison                                                                                                       |
| Bedside and Master reference records                         | “User-supplied … reviewed July 2026.” / “… package, pp. 39–41.”, both 2026                                                             | What the files show (no author, date or references; creator OpenAI); year `null`, shown as “date not stated”; limit “no clinical statement should rest on it alone”                                                                  |
| Evidence and model card (hub and workbench)                  | “current FDA labeling”; notices “found during the July 19, 2026 review”; profile line “Reviewed 2026-07-19”                            | Labeling records whose currency “has not been verified here”; notices “from a July 19, 2026 check; no later check is recorded”; “Labeling sources last checked 2026-07-19; no clinical review is recorded”                           |
| IABP atrial-fibrillation transfer, optional exercise         | Satisfied only when the trigger was no longer ECG (internal counted)                                                                   | Satisfied by a trigger change on a running balloon, whichever trigger it ends on; label names the model limit                                                                                                                        |
| Same transfer, option “Keep ECG triggering…”                 | `incorrect-mechanism`: “no source is universally superior”                                                                             | `reasonable-but-incomplete`, citing the supplied Cardiosave material and the beat-by-beat check it still needs. Stem, options, key and required action unchanged                                                                     |
| Same transfer, explanation and evidence                      | “The learner must change the trigger…”                                                                                                 | Trigger judged on the trace; the synchrony figure does not settle it; the model lacks R-wave quality and console handling. Two Cardiosave documents registered and cited                                                             |
| IABP timing teaching panel                                   | —                                                                                                                                      | A model boundary beside the synchrony figure when the rhythm is atrial fibrillation (rendered test). **Not reachable on the current Learn transfer step**, where the live-panel block is not mounted; see findings                   |
| IABP-02 and CAP-IABP-01 worked explanations                  | —                                                                                                                                      | One model-limit line each (CAP-IABP-01 also names its internal-trigger start). Success signals and starting states unchanged                                                                                                         |
| Suction transfer, best rationale and explanation             | “This limits ongoing suction…”; “The learner must make a real pump-level adjustment…”                                                  | The CP IFU order; what the model does after a reduction and after refilling; what to reassess (volume status, position on imaging, RV function)                                                                                      |
| RV-limited selection transfer                                | “…raises the displayed number without raising effective systemic flow.” `sme-review`                                                   | “…raises effective systemic flow only a little and leaves the suction pattern in place.” `draft`                                                                                                                                     |
| LVAD high-power transfer and section task title              | “high power with worsening perfusion”; “Power rises while effective flow and perfusion worsen”; “Power rising while perfusion worsens” | “high power with an unchanged flow display”; displayed and effective flows barely move; “which this model does not diagnose”; “Power rising while the flow display holds”; explanation says the model does not establish a diagnosis |
| Kept exactly                                                 | —                                                                                                                                      | Engine and coefficients, alarms, LVAD speed authorization, device topology, scenario success signals and starting states, all other options and keys, required actions, progress storage, analytics, routes, shared records          |

## Test-contract migration

| File · assertion                                                                                       | Old contract                                                                   | New assertion                                                                                                                                                                                                                                                                                                                                                                                                                      | Why                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/m0-m1-requirements.test.tsx` · “renders the five published figures…”                        | Fourth measurand “Product-reported maximum flow”; all five measurands distinct | Fourth measurand “Maximum mean flow”; distinct per pump (product · measurand); fourth product is Impella 5.5                                                                                                                                                                                                                                                                                                                       | The supplied rev L names it a maximum mean flow, the same measurand as the first CP figure for a different pump                          |
| `__tests__/stage-learner-review.test.tsx` · “marks exactly the edited items draft…”                    | Draft transfers exclude the RV-limited selection transfer                      | That transfer is draft                                                                                                                                                                                                                                                                                                                                                                                                             | Its rationale was reworded (MCS-03-07); edited items return to draft                                                                     |
| `__tests__/targeted-introductions.test.tsx` · “does not announce IABP correction for stopped support…” | Transfer work is unsatisfied after selecting ECG                               | Satisfied with ECG on a running balloon; unsatisfied with the balloon stopped                                                                                                                                                                                                                                                                                                                                                      | The old predicate rewarded the model's AF rating that the supplied Cardiosave material contradicts; the genuine run prerequisite is kept |
| New `__tests__/mcs03-source-holds.test.tsx`                                                            | —                                                                              | 15 tests: 01/02 separate and not approved, textbook identity, CP ceiling hold pinned; 5.5 measurand on three surfaces; AF trigger hold pinned, predicate (all triggers on a running balloon, not stopped), regrade and registered evidence, panel note only in AF, both case explanations; suction replay and copy; RV-limited replay and copy; LVAD replay and copy; synthesis identity, “date not stated”, evidence card wording | Keeps each correction and each held disagreement visible to the next change                                                              |
| New `__tests__/mcs03-claim-review-queue.test.ts`                                                       | —                                                                              | 6 tests: at most ten items reaching all three families; 01 and 02 separate; required fields; decision `NOT REVIEWED` with null reviewer fields or a named non-AI reviewer; every cited source, shared record and document resolves; every excerpt still quoted at the content version                                                                                                                                              | Keeps the queue honest; it enforces no workflow                                                                                          |

No other assertion changed, and none was skipped or removed. Earlier assertions remain in Git history at
`905372be`. Model, topology, flow-conservation, interlock, persistence and source-registry suites ran
unchanged, among them `model.test.ts`, `common-model.test.ts`, `impella-flow-geometry.test.ts`,
`unloading-comparison.test.tsx`, `m5-persistence-analytics.test.tsx`, `self-paced-consumers.test.ts`
and `story-self-paced.test.tsx`.

## Executed evidence

Raw outputs are outside Git in
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/mcs-03-2026-09-15/`:
`baseline/`, `iter1/`, `iter2/`, `final/`, `mcs03-replay-baseline.json` and
`mcs03-replay-suction-baseline.json`.

| Command                                                                                                                                                                                                                                                                          | Result                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline, this worktree before any edit (clean status recorded): `node node_modules/jest/bin/jest.js --runInBand src/features/mechanical-circulatory-support 'src/app/\[locale\]/mechanical-circulatory-support' src/features/critical-care src/features/learning-module --json` | **75 suites (72 passed, 3 failed); 1,108 tests (1,105 passed, 3 failed, 0 pending).** MCS + routes: 35 suites / 745 tests, all passed                                                                                                                                                                                                                                                                                               |
| MCS + routes after the first edits (`iter1`)                                                                                                                                                                                                                                     | 37 suites (36 passed, 1 failed); 766 tests (765 passed, 1 failed). The failure was `targeted-introductions.test.tsx:339`, which asserted the old non-ECG predicate. Removing the predicate had also dropped its running-balloon prerequisite; that prerequisite was restored and the assertion replaced (table above)                                                                                                               |
| Same (`iter2`)                                                                                                                                                                                                                                                                   | **37 suites / 766 tests, all passed** (745 + 21 new)                                                                                                                                                                                                                                                                                                                                                                                |
| Baseline command again after all code edits (`final`)                                                                                                                                                                                                                            | **77 suites (74 passed, 3 failed); 1,129 tests (1,126 passed, 3 failed, 0 pending).** The same three failures with **identical failure messages**: `critical-care accessibility … readable without color`, `curriculum-sequencing … CRRT cases in authored station order`, `critical-care learner-copy … static component copy`. The only new suites are the two above; no suite changed its test count (`failure-comparison.json`) |
| `NODE_OPTIONS=--max-old-space-size=8192 node node_modules/typescript/bin/tsc --noEmit -p .` after the first edit set                                                                                                                                                             | Exit 0                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Same, after the final code and test edits (`final/tsc-final.log`)                                                                                                                                                                                                                | Exit 0                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ESLint `--max-warnings=0` on the 15 changed `.ts`/`.tsx` files                                                                                                                                                                                                                   | The first attempt passed a newline-joined list as one argument in zsh and did not lint anything (kept as `eslint-prettier-first-attempt-invalid.txt`, not counted). Rerun through `xargs`: **exit 0**                                                                                                                                                                                                                               |
| Prettier `--check` on every changed `.ts`/`.tsx`/`.json`/`.md` file                                                                                                                                                                                                              | Flagged the queue JSON, the observation guide and the new test; `--write` (whitespace only); recheck **clean**; the two new suites re-run: **2 suites / 21 tests passed**                                                                                                                                                                                                                                                           |
| Model replays (scratch scripts driving the real reducer, learn mode, seed 417, 0.2 s ticks, 8 s settling)                                                                                                                                                                        | Outputs in the two replay files; the values each queue item relies on are pinned in `mcs03-source-holds.test.tsx`                                                                                                                                                                                                                                                                                                                   |

Source documents were read with `pdftotext -layout` and `unzip` of the Word files' `docProps/core.xml`
and `word/document.xml`, for identity and at the locators in the queue; their hashes are in the queue.

### Genuine browser actions

Local `npx next dev --port 3122 --webpack` (launch entry `claude-mcs`, this worktree), in-app browser,
unauthenticated, viewport 1400 × 900, reset afterwards. Clicks by accessibility ref; `form_input` set one
select and two range inputs; JavaScript only read DOM text and `localStorage`. `/en` returned 404 because
the proxy throws without Supabase keys; the public-unlisted MCS routes served. Full record:
`final/browser-observations.json`.

| Path                                                               | Find the explanation                                                                | Recover from confusion                                                                                                                    | Use a relevant control                                                                                                                           | Return later                                                                                                     |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| IABP: `learn?lesson=iabp-timing-triggering&phase=transfer`         | Show explanation with nothing selected: new explanation, radios empty               | “Keep ECG triggering” → Compare answer: “Partly correct.” with the Cardiosave rationale; Try again cleared it                             | Trigger source → Arterial pressure: trigger-reliability text gone, before/after observation offered, exercise label still naming the model limit | Hub “Resume — Is the balloon inflating at the right moment?” reopened the transfer fresh: no answer, trigger ECG |
| Microaxial: `learn?lesson=impella-suction-purge-rv&phase=transfer` | Show explanation: names volume status, imaging, right ventricular function          | “Increase the performance level” → “Not correct, and unsafe.” with the reason; the IFU order among the alternatives; Try again cleared it | Level 8 → 6: suction still present, exercise marked done; preload → 85%: suction text gone                                                       | Resume reopened with preload 55%, level 8, suction present, no answer                                            |
| LVAD: `learn?lesson=lvad-alarms-emergencies&phase=transfer`        | New stem, “does not diagnose” context, new task title; explanation before answering | “Disconnect the power briefly” → “Not correct, and unsafe.” with the collapse reason; Try again cleared it                                | High-power pattern off: 5.1 W, displayed 4.0, effective 6.42; on: 7.9 W, displayed 4.0, effective 6.43 L/min                                     | Resume reopened fresh with the new stem, no answer, explanation closed                                           |

No grading words appeared in any feedback. Throughout the walk the progress record held only
`selfPaced` visited lessons and the last activity, section, device, phase and location time; no answer,
hint, explanation, control change or feedback wrote to it. The “low flow” and “High-power pattern” text
matches could not be told apart from static copy and are not claimed. The live LVAD values ran slightly
above the 8-second replay because the model had run longer; the relationship is the same.

## Source, clinical and model holds

- **Faculty or device review required** for all ten items; none is reviewed or approved.
- **MCS-03-05:** the AF trigger coefficients, IABP-02 and CAP-IABP-01 success signals (reachable in AF only
  with pressure triggering), CAP-IABP-01's internal-trigger start, and the partly-right regrade itself.
- **MCS-03-01:** the CP model reference ceiling (4.3 peak systolic) and P-9 mean flow above 3.7; whether rev
  V is current; the July 2026 removal notice.
- **MCS-03-04:** Impella RP versus RP Flex; the 4.0 figure's measurand; recall applicability.
- **MCS-03-06:** whether the model's suction response to a reduction is a fair teaching example.
- **MCS-03-08:** the pathway card's statement that pump thrombosis reduces delivered flow (unsourced; the
  model does not reduce flow).
- **MCS-03-09:** everything about HeartMate 3 labeling, the speed bounds and the power-path notices; no
  supplied evidence.
- **MCS-03-10:** every statement whose only evidence is one of the two supplied syntheses.
- **Carried from MCS-01/MCS-02:** PAPi as a right-pump response signal, CPO versus perfusion under high
  afterload, the high-power pattern, IABP contour phenotypes, the reviewed-English fallback labels, and
  existing draft and `sme-review` labels (none of which is approval).
- **Recall and current-label statements** in the registry were not verified; no URL was fetched.
- **Source copies:** the two Word syntheses are in the owner's OneDrive, not Local-Data. Nothing was copied.
- No media changed.

## Legacy-progress implications

None. No storage key, writer, reducer, completion flag or analytics payload changed; source years and review
metadata are never persisted. The browser walk showed only location and visited-topic fields being written.
The walk had no legacy MCS fields to preserve; the existing persistence and consumer suites that cover them
passed unchanged.

## Question ledger (MCS-03 scope)

Rows refer to [MCS-01-question-ledger.md](MCS-01-question-ledger.md).

| Item                                          | Disposition                         | What and why                                                                                                                                                                    |
| --------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mcs-iabp-trigger-transfer-1`                 | **Keep as reinforcement — rewrite** | Teaches judging a trigger on the trace in an irregular rhythm. One option regraded with a source-based rationale; exercise label, work predicate and explanation revised. Draft |
| IABP-02 guided case prediction                | **Combine**                         | Kept; its worked explanation now carries the AF model limit                                                                                                                     |
| CAP-IABP-01 integrated walkthrough prediction | **Combine**                         | Kept; its worked explanation carries the model limit and names the internal-trigger start                                                                                       |
| `mcs-impella-suction-transfer-1`              | **Keep as reinforcement — rewrite** | Contrasts escalation, a purge explanation and a structured reduction; best rationale and explanation follow the IFU and the model. Draft                                        |
| `mcs-device-selection-integration-transfer-1` | **Keep as reinforcement — rewrite** | Teaches selecting by the limiting problem; one overclaiming sentence corrected. `sme-review` → draft                                                                            |
| `mcs-integration-predict-1`                   | Keep                                | Already consistent with the model (“raises the displayed number more than it raises effective systemic delivery”)                                                               |
| `mcs-lvad-emergency-transfer-1`               | **Keep as reinforcement — rewrite** | A safety contrast (preserve power and escalate, disconnect, defer to the controller); wording now matches the patient on screen. Draft                                          |
| `mcs-lvad-high-power-predict-1`               | Keep                                | Already teaches the unchanged flow display correctly                                                                                                                            |
| Pathway-card clarifications and conflicts     | Not questions                       | Kept as worked explanations (MCS-03-01 to -04)                                                                                                                                  |

Summary: rewrite 4, combine 2, keep unchanged 2, replace 0, remove 0. No option was added or removed and no
key changed.

## Findings outside the module (not changed; for a serialized shared slice)

- The shared CP clarification gives PDF page indices as page numbers, and its evidence ids point to the
  FDA PMA index and the J&J page rather than the rev V document itself.
- The IABP timing panel's new AF note renders only where the live-panel block is mounted. In the shared stage
  column that block is shown on recognize, predict and explain, and not on the transfer step — the only step
  where the patient is in AF. On the current Learn route, learners see the model limit in the exercise label
  and the explanation instead. Whether the note should also appear at the transfer step is a stage-visibility
  decision for the shared-stage owner.
- The MCS and hemodynamics registries both use the id `master-hemodynamics-reference`, with different class
  wording since HD-03.
- Other modules still carry registry dates that are review or retrieval dates rather than publication dates.

## Checks not run

Full `npm test`; production build; Playwright (including `e2e/mcs-unloading.spec.ts`); keyboard-only and
screen-reader passes; widths other than 1400 × 900; screenshots; es and zh-CN wording (English only); the
evidence card on the hub and workbench in the browser (rendered test only); authenticated sync or remote
analytics; learner observation; faculty or device review; any URL fetch, including current device labeling
and recall notices.

## Next slice

1. **MCS/device faculty review of the queue**, starting with MCS-03-05 (AF trigger model), -08 (high-power
   wording) and -06 (suction response).
2. **Source acquisition by the owner:** HeartMate 3 labeling for the applicable revision, RP Flex labeling if
   that is the product taught, the two ISHLT guidelines, and the four chapters behind the bedside synthesis.
3. **If faculty confirm a model change,** one bounded, reviewed engine task for AF trigger reliability and the
   CP reference ceiling.
4. **Serialized shared slice:** clarification locator format and registering the rev V document; the AF note's
   stage visibility.
5. **Run the observation guide** with one to three volunteers and an MCS educator.

## Changed files

Module source:

- `src/features/mechanical-circulatory-support/content/sources.ts`
- `src/features/mechanical-circulatory-support/content/supportPathways.ts`
- `src/features/mechanical-circulatory-support/content/impellaVariants.ts`
- `src/features/mechanical-circulatory-support/content/lessonTransfers.ts`
- `src/features/mechanical-circulatory-support/content/scenarios.ts`
- `src/features/mechanical-circulatory-support/content/sectionSpecs.ts`
- `src/features/mechanical-circulatory-support/engine/types.ts` (source `year` may be `null`)
- `src/features/mechanical-circulatory-support/components/McsSourcesPanel.tsx`
- `src/features/mechanical-circulatory-support/components/stage/McsSourceList.tsx`
- `src/features/mechanical-circulatory-support/components/teaching/IabpTimingTriggeringPanel.tsx`

Tests:

- `src/features/mechanical-circulatory-support/__tests__/mcs03-source-holds.test.tsx` (new)
- `src/features/mechanical-circulatory-support/__tests__/mcs03-claim-review-queue.test.ts` (new)
- `src/features/mechanical-circulatory-support/__tests__/m0-m1-requirements.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/stage-learner-review.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/targeted-introductions.test.tsx`

Documents:

- `docs/gap-remediation/self-paced/MCS-03-handoff.md` (new)
- `docs/gap-remediation/self-paced/MCS-03-claim-review-queue.json` (new)
- `docs/gap-remediation/self-paced/MCS-03-observation-guide.md` (new)
- `docs/gap-remediation/self-paced/README.md`
- `docs/gap-remediation/self-paced/test-contracts.md`
- `docs/critical-care/mcs-model-limitations.md`
