# G00 — baseline, evidence, and handoff

**Completed scope:** establish the self-paced design contract and prepare bounded conversions for all nine educational modules. G00 makes documentation changes only. **No application is claimed converted, no engine is repaired, and no clinical approval is granted by this PR.**

## Repository reconciliation

| Field                                        | Recorded value                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Checkout                                     | `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/codex-education-9-14`                             |
| Initial branch/status                        | `codex/education-9-14...origin/main`; clean, no tracked or untracked work                                                |
| Initial HEAD                                 | `9ef04539118b889a344992c63ba35808ee477f0e`                                                                               |
| Historical review baseline                   | Same commit                                                                                                              |
| `git fetch origin` / refreshed `origin/main` | Succeeded; same commit; no newer commits to reconcile at task start                                                      |
| Work branch                                  | `codex/g00-self-paced-baseline`, created from `origin/main` in this checkout                                             |
| Repository instructions                      | Root `AGENTS.md`; `docs/local-authoring-assets.md`; EBUS-course instructions read to establish the separate-app boundary |
| Runtime / shared edits                       | None. No dependency, schema, backend, engine, catalog, release, publication or user-data changes                         |
| Device Intelligence                          | Excluded from source audit and edits; no shared runtime dependency changed                                               |

Skills applied: `interventional-pulm-education`, `medical-education-modules`, and `structured-medical-modules`. Their older assessment/fixed-layout rules were reconciled with the explicit v2 owner decision in [test-contracts](test-contracts.md); no skill was treated as an instruction to preserve an exam or request a new pass-standard decision.

## Changed files and resulting contract

| File                                                     | Change / old-to-new behavior                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/gap-remediation/self-paced/README.md`              | Active self-paced policy; settled intent replaces competing examination assumptions. Current runtime differences remain explicit.                 |
| `docs/critical-care/activity-contract.md`                | Scoped supersession notice linking the active policy; preserves older text as historical evidence.                                                |
| `docs/gap-remediation/self-paced/conversion-map.md`      | All nine route/host/registry/result/progress families mapped, with educational, simulation/data and mixed predicates.                             |
| `docs/gap-remediation/self-paced/question-ledger.md`     | Nine actual runtime samples, teaching purpose, existing feedback, friction and proposed dispositions; replaces a question-position/length census. |
| `docs/gap-remediation/self-paced/test-contracts.md`      | Named old exam assertions, replacement self-paced assertions and protections retained; no existing test changed.                                  |
| `docs/gap-remediation/self-paced/developer-checklist.md` | Reusable no-answer/help/wrong/repeat/skip/deep-link/reload, storage and real-operation checks; not a learner sequence.                            |
| `docs/gap-remediation/self-paced/implementation-plan.md` | PI-01 presentation/progress pilot and independent MV-01 investigation of case MV-03, then named module slices; no new shared helper.              |
| `docs/gap-remediation/self-paced/G00-handoff.md`         | This evidence, limitations, holds and next-slice record.                                                                                          |

Runtime behavior is unchanged. The current applications still have the gates/writes documented in the map. The policy does not retroactively turn their stored scores into visited/reviewed topics.

## Preserved external evidence

The source action pack remains in Local-Data. `EXTERNAL_REPORT_UNCHANGED.md` was read in place and never edited, copied into the repository, or relabeled as a fresh audit. SHA-256 before delivery:

```text
EXTERNAL_REPORT_UNCHANGED.md
704502351f05f1fcd636a9becbf31cfb05a07a3ec3582b2145f97767ebce0056
LEARNING_DESIGN_BRIEF.md
2957a0665aa3e15ed08285e8722d4eb8c2a8057aabc6fc708a993d113e9e1449
```

The report's engine/cueing numbers remain **externally reported**. In particular, its MV-03 intrinsic-PEEP change and all first-position/longest-option findings were not rerun in G00. The current engine regression suite below is a different test and does not confirm or erase that causal candidate. No psychometric scores or answer-position release gate were generated.

## Executed baseline tests

The installed root Jest runner was invoked without `--passWithNoTests`. **20 suites passed; 394 tests passed; zero failures, skips, pending tests or snapshots; exit 0.** Reported Jest runtime: 11.921 seconds. This baseline includes obsolete exam assertions, which are queued for explicit replacement rather than treated as immutable requirements.

Executed command (line breaks added for readability):

```sh
npx --no-install jest --runInBand --runTestsByPath \
  src/features/ebus-guided/__tests__/retained-evidence.test.ts \
  src/features/ebus-guided/__tests__/course.test.tsx \
  src/features/bronchial-branch-tracing/__tests__/local-session.test.ts \
  src/features/bronchial-branch-tracing/__tests__/native-ct.test.ts \
  src/features/peripheral-imaging/__tests__/stage-session.test.ts \
  src/features/peripheral-imaging/__tests__/case-standard.test.ts \
  src/features/peripheral-imaging/__tests__/acquisition-capture.test.ts \
  src/features/bronchoscopy-foundations/__tests__/course-record.test.ts \
  src/features/bronchoscopy-foundations/__tests__/scope-engine.test.ts \
  src/features/cardiohelp-ecmo/__tests__/progress.test.ts \
  src/features/cardiohelp-ecmo/__tests__/bubble-resumption-safety.test.ts \
  src/features/baxter-crrt/engine/__tests__/progress.test.ts \
  src/features/baxter-crrt/engine/__tests__/learningSession.test.ts \
  src/features/icu-hemodynamics/__tests__/h2-h3-reference-and-pac-safety.test.tsx \
  src/features/icu-hemodynamics/__tests__/learn-progress.test.ts \
  src/features/mechanical-ventilation/__tests__/physics-waveforms.test.ts \
  src/features/mechanical-ventilation/__tests__/learning-flow.test.ts \
  src/features/mechanical-circulatory-support/__tests__/progress.test.ts \
  src/features/critical-care/__tests__/dashboard.test.ts \
  src/features/critical-care/progress/__tests__/adapters.test.ts \
  --json --outputFile=/tmp/g00-self-paced-baseline/jest-results.json > /tmp/g00-self-paced-baseline/jest.log 2>&1
```

| Suite                                                                             | Tests | Result |
| --------------------------------------------------------------------------------- | ----: | ------ |
| `src/features/mechanical-ventilation/__tests__/physics-waveforms.test.ts`         |   173 | PASS   |
| `src/features/icu-hemodynamics/__tests__/h2-h3-reference-and-pac-safety.test.tsx` |    33 | PASS   |
| `src/features/critical-care/progress/__tests__/adapters.test.ts`                  |    20 | PASS   |
| `src/features/bronchoscopy-foundations/__tests__/scope-engine.test.ts`            |    19 | PASS   |
| `src/features/cardiohelp-ecmo/__tests__/progress.test.ts`                         |    15 | PASS   |
| `src/features/bronchial-branch-tracing/__tests__/native-ct.test.ts`               |     6 | PASS   |
| `src/features/cardiohelp-ecmo/__tests__/bubble-resumption-safety.test.ts`         |    12 | PASS   |
| `src/features/bronchial-branch-tracing/__tests__/local-session.test.ts`           |     9 | PASS   |
| `src/features/mechanical-ventilation/__tests__/learning-flow.test.ts`             |    12 | PASS   |
| `src/features/ebus-guided/__tests__/course.test.tsx`                              |    33 | PASS   |
| `src/features/critical-care/__tests__/dashboard.test.ts`                          |     7 | PASS   |
| `src/features/baxter-crrt/engine/__tests__/learningSession.test.ts`               |    21 | PASS   |
| `src/features/baxter-crrt/engine/__tests__/progress.test.ts`                      |     6 | PASS   |
| `src/features/peripheral-imaging/__tests__/stage-session.test.ts`                 |     5 | PASS   |
| `src/features/bronchoscopy-foundations/__tests__/course-record.test.ts`           |     4 | PASS   |
| `src/features/peripheral-imaging/__tests__/acquisition-capture.test.ts`           |     6 | PASS   |
| `src/features/ebus-guided/__tests__/retained-evidence.test.ts`                    |     4 | PASS   |
| `src/features/peripheral-imaging/__tests__/case-standard.test.ts`                 |     3 | PASS   |
| `src/features/icu-hemodynamics/__tests__/learn-progress.test.ts`                  |     4 | PASS   |
| `src/features/mechanical-circulatory-support/__tests__/progress.test.ts`          |     2 | PASS   |

These checks cover bounded legacy persistence/progress behavior and selected physics, scope, native-CT, retained-image, acquisition and PAC/ECMO safety behavior. They are not an exhaustive all-module regression, source review or clinical validation.

Documentation checks also passed (exit 0): `python3 /tmp/g00-self-paced-baseline/check-docs.py` verified seven handoff documents, nine mapped modules, nine question samples, explicit repository paths/relative links, the external-report hash and the recorded Jest totals; `npx --no-install prettier --check docs/critical-care/activity-contract.md docs/gap-remediation/self-paced/*.md` passed for all eight changed documents; `git diff --check` passed. These are documentation checks, not additional clinical or runtime tests.

## Genuine browser evidence

Chromium from the already-installed `@playwright/test`, Next development server on localhost:3110, desktop 1440×1000 and a PI narrow check at 390×844. The server was started directly with `node_modules/next/dist/bin/next dev --webpack --port 3110` using a newly generated ephemeral local-development auth token. No stored secrets were read. Embedded training-app rebuilds were not required for this route/PI sample and were not run.

Disposable browser contexts used the localhost auth cookie. Non-local requests were aborted to prevent external side effects. This limits any claim about external assets or services. Existing baseline code wrote only to disposable test-context localStorage; no user's browser records or account data were used. No completed state was seeded to claim a real journey.

Executed:

```sh
node /tmp/g00-self-paced-baseline/browser-baseline.cjs
node /tmp/g00-self-paced-baseline/browser-interactions.cjs
```

The route script navigated Overview, Learn, Practice and Assess for each of the nine bases in the conversion map: **36 unique routes**. First pass: **34 HTTP 200 renders, two `net::ERR_ABORTED` navigations** (EBUS Assess and BF Practice). Those errors remain in `browser-routes.json`. The interaction script then rechecked each interrupted route: **both returned 200**. Thus every listed route eventually rendered, with no page exceptions observed in the completed route visits or interaction sequence. This is route smoke coverage, not 36 completed teaching journeys or proof that all embedded media loaded.

| Real action / state                                         | Observed baseline result                                                                                                 | Self-paced implication                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| PI Learn `?section=imaging-questions`; click Continue twice | Third activity asks for six evidence matches; button disabled with “6 of 6 still to place”                               | FAIL desired no-answer continuation in that activity; do not remove image/source teaching to solve it |
| Open Help before answering; close with Escape               | Useful task instruction and explanation of first-answer persistence; no simulated operation performed                    | Preserve useful help; remove mandatory first-answer framing in PI-01                                  |
| Open Course outline and click the projection section        | Real link reaches `?section=projection` without completing the first lesson                                              | PASS existing free topic jump; do not falsely claim all PI section prerequisites are hard locks       |
| PI Practice `?case=signal-practice-1`, no response          | Check button disabled; zero Show explanation/reveal buttons                                                              | FAIL desired direct explanation; existing All cases link still permits leaving                        |
| Choose “Quantum noise…” (wrong option `a`) and check        | Specific wrong-answer rationale and takeaway rendered                                                                    | Preserve explanatory feedback; source text remains draft/unreviewed                                   |
| Inspect disposable PI local record after that click         | `ip-peripheral-imaging-v2` contains `practice:signal-practice-1`, `choiceId: a`, `correct: false`; no completed sections | FAIL desired no-new-graded-attempt writes; navigation must not invent completion                      |
| Click Answer it again, then reload                          | Current choice resets; first-decision text remains in the record and UI                                                  | Preserve legacy bytes; current sessions should not create new first-attempt surveillance              |
| Click All cases without answering the repeated question     | Returns to Practice landing                                                                                              | PASS existing exit path; local step/result restrictions still need conversion                         |
| Open PI Assess with no completed sections                   | Capstone remains locked on all Learn sections                                                                            | FAIL desired direct integrated-case access                                                            |
| Direct-link PI projection at 390×844                        | Lesson, imagery and controls render; measured document width 390 equals viewport width 390                               | Narrow smoke PASS for this state only; no 200% zoom/screen-reader/full mobile-flow claim              |
| Recheck EBUS Assess fresh                                   | “Finish the guided course first.”                                                                                        | Browser-confirmed educational entry lock                                                              |
| BF Assess fresh                                             | “8 decisions, made once”; capstone requires 23 sections                                                                  | Browser-confirmed educational entry lock                                                              |
| MV Assess fresh                                             | Final course check says all applications must be worked; separate Challenge setup appears                                | Convert both consumers, not only the heading/tab                                                      |

Screenshots visually inspected: `pi-learn-no-answer.png`, `pi-help.png`, `pi-wrong.png`, and `pi-narrow.png`. They confirm the displayed task gate, Help, wrong-answer feedback and narrow teaching surface. Full-page captures include fixed navigation/footer positioning and are not an exhaustive visual/a11y audit. More screenshots and text snapshots are retained with the raw evidence.

### Evidence location and recovery notes

Persisted outside Git under:

`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/g00-self-paced-baseline-2026-09-14/`

Includes `jest.log`, `jest-results.json`, browser scripts, `browser-routes.json`, `browser-interactions.json`, route text snapshots, screenshots and the resolved runtime question sample. The ephemeral auth token is excluded. The scripts record their actual localhost/tmp environment; regenerate an ephemeral token and run from the repository if repeating them. These raw artifacts are not production dependencies.

Two exploratory harness issues were corrected before the completed evidence runs: ESM named-import interop failed while reading TS exports, then the successful sample used `node --import tsx` with CommonJS `require`; a browser snapshot's `main` selector matched nested main elements and was changed to `#main-content`. Neither was counted as a passed test or an application defect. Initial interrupted route results are retained, not overwritten by the successful rechecks.

## Source, clinical and media holds

These are scoped follow-ups, not invented approvals or assessment-standard questions. A source/code inspection can identify a hold without resolving the clinical fact.

| Module | Hold and provenance                                                                                                                                                         | Owner of next action                                                                                                                           |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| MV     | External MV-03 time confound; PEEP/compliance example; unnamed casebook sources. G00 located priming/residual reconciliation but did not establish a root cause.            | MV-01 equal-time investigation with attributable faculty/RT modeling input if intent remains unresolved; MV-02/03 for the other bounded topics |
| ECMO   | Historical gas-to-air transfer block; current circuit-control prediction gate is source-confirmed. Device/clinical review and model ceilings remain as previously recorded. | ECMO-01 technical predicate split; actual clinical/device review where choreography changes                                                    |
| CRRT   | All sampled cases pending; existing manual/display-offset and model/protocol boundaries were not independently verified                                                     | CRRT-01 removes exam barriers; CRRT-02/03 and G01 review actual case/IFU claims without inventing offsets or approval                          |
| EBUS   | Sampled feedback is draft; actual ultrasound/media rights, anatomical/device review and retained-image validity remain required                                             | EBUS-01/02 teaching conversion; EBUS-03 for permitted media and attributable review                                                            |
| BBT    | Lumen/wall, parent-opening interpretation and local feedback require actual anatomical review; a second exam/holdout CT is not a release requirement                        | BBT-01/02 preserve coordinate identity and improve supported teaching; further media only when useful and reviewed                             |
| PI     | Item/clinical and technologist review and real usability observation remain unperformed in G00                                                                              | PI-01 preserves current clinical/image content; PI-02/03 review a bounded changed batch and observed learner experience                        |
| BF     | Transcript-backed claims and the reported larynx/trachea geometry TODO remain open; scope-engine tests do not resolve the clinical/anatomical hold                          | BF-01 conversion, BF-02/03 scoped source/anatomy follow-up                                                                                     |
| HD     | Sample items remain draft; supplied-source classification and tracing/interpretation review remain open                                                                     | HD-01/02 separate recognition quota from safety; HD-03/G01 review actual explanations and sources                                              |
| MCS    | Existing source/review status and externally requested filled-LV unloading demonstration were not revalidated in G00                                                        | MCS-01 conversion; later bounded model/source comparisons and attributable review                                                              |

No clinical thresholds, device settings, anatomical relationships, citations, rights, review identities or dates were changed. The question ledger proposes educational dispositions, not new clinical content.

## Legacy-progress implications

G00 changes no stored record or storage adapter. The map identifies where future self-paced sessions currently risk creating graded records, including PI/BF first attempts, EBUS support/first-response history, CRRT score/hint accounting, HD/MV hydration migrations, BBT normalized scored/hint attempts, and ECMO/MCS outcome writers. Shared hubs can still depend on mastery even when displaying friendly wording.

Each module conversion must preserve legacy bytes read-only, detach grades from access/recommendations/outcomes/claims, and keep only explicitly declared new location/visited/review state. A no-answer continuation must not reuse `complete`, `mastered`, captured-frame or performed-action flags as a shortcut. Shared runtime remains unchanged here, so no Device Intelligence behavior check through modified infrastructure is needed in G00.

## Checks not run / limits

- Full `npm test`, full build, global lint and type-check: not run for this documentation-only change; targeted baseline commands above ran real nonzero suites. No dependency installation was performed.
- The external review's exact engine experiments or cueing scripts, matched MV-03 control matrix, ECMO expanded transfer matrix, or MCS filled-LV experiment: not run. Their old values remain externally reported.
- Full per-module interaction completion, all devices/tracks/branches, blocked-storage browser fixtures, production auth/account sync, media loading/rights, screen reader, Safari, 200% zoom and exhaustive mobile/a11y checks: not run. Source inventories and selected tests are not substitutes.
- Human learner/technologist sessions and faculty/clinical review: not run; no pilot or clinical approval is claimed.
- No runtime self-paced acceptance suite was added because conversion has not occurred. The checklist and test-contract ledger are the implementation handoff, not a green report for current self-paced behavior.

## G00 acceptance and skill review

| G00 criterion                                                         | Result / evidence                                                                                          |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Nine modules and all route/result/progress families inventoried       | PASS within source-audit scope; conversion map plus 36-route smoke/rechecks                                |
| Pedagogical versus operational versus mixed predicates distinguished  | PASS; named host/reducer/writer traces, including CRRT's already-open operations and EBUS/ECMO mixed gates |
| Settled self-paced policy with no open examination decision           | PASS; active README, historical-contract notice, test migration ledger                                     |
| Smallest initial plan, PI pilot and independent MV priority           | PASS; PI-01 and MV-01 named; no infrastructure dependency or shared helper                                 |
| Representative EBUS/CRRT/HD question-purpose inventory                | PASS; nine runtime samples with actual text, feedback, friction and dispositions; no psychometric census   |
| External findings and old test evidence retained                      | PASS; unchanged report hash and existing tests; precise rerun limits above                                 |
| No user data, engine, clinical fact, release or shared runtime change | PASS by documentation-only scope; disposable test contexts only                                            |
| Reusable checklist and bounded handoff                                | PASS; linked documents and actual commands/results; one PR, no merge/deploy                                |

Scoped structured-module skill review:

| Rule                        | Status                           | G00 evidence / limit                                                                                                                                         |
| --------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H1 — curriculum/navigation  | NOT APPLICABLE to implementation | All route/registry consumers mapped; older required Assess grammar superseded by the owner. Runtime conversion deferred.                                     |
| H2 — teaching sequence      | NOT APPLICABLE                   | No new lesson or clinical teaching authored.                                                                                                                 |
| H3 — shared fixed stage     | NOT APPLICABLE                   | Universal layout superseded; no stage or layout changed.                                                                                                     |
| H4 — active task            | NOT APPLICABLE to implementation | Current PI task observed; no new task renderer.                                                                                                              |
| H5 — rendered content       | NOT APPLICABLE to implementation | No new teaching fields. Current sample render evidence is limited to the listed browser states.                                                              |
| H6 — real actions           | PASS for preservation            | Documentation-only diff; genuine browser actions and selected acquisition/scope/retained-image tests; no manufactured completion. No all-operation claim.    |
| H7 — answer/feedback timing | NOT APPLICABLE to implementation | Older answer-first/masking requirements superseded; existing feedback gates documented, not declared converted.                                              |
| H8 — model fidelity         | PASS for preservation            | No engine or asset edits; selected physics and safety baseline passed. Clinical/model holds remain.                                                          |
| H9 — honest progress        | PASS for audit/preservation      | No user records or adapters changed. Legacy/writer implications mapped; older mastery and first-attempt requirements superseded for future current sessions. |
| H10 — clinical language     | NOT APPLICABLE                   | No learner-facing clinical copy changed; quoted sample text remains draft/pending.                                                                           |
| H11 — scope/release         | PASS                             | Documentation only; Device Intelligence excluded; no release/deployment/data mutation.                                                                       |
| H12 — evidence              | PASS for scoped baseline         | Explicit source audit, selected 394 tests and recorded browser states. Broader unrun checks remain unrun.                                                    |

## Next slice

Start **PI-01** as the first full-path self-paced conversion. Start **MV-01** as an independent causal investigation of **case MV-03**, without waiting for PI or a shared progress service. Use `implementation-plan.md` for the file scopes and gate-specific acceptance. G00 does not execute those subsequent prompts or authorize publication.
