# ICU hemodynamics flow: validation record

2026-09-13. Local implementation on `codex/icu-hemodynamics-9-13`, based at `ab05b9d6`, including the preserved targeted teaching repair. The supplied reference `d209c8006e693e9d4ee8a250347911e191508029` was inspected; it adds no intervening ICU/shared-stage changes. Nothing was committed, pushed, merged, deployed, or promoted from unlisted preview.

The companion [redesign record](./hemodynamics-flow-redesign.md) maps all nine sections, 72 existing task IDs, 18 prediction/transfer item slots, eight cases, source families and completion predicates. This record describes software checks and agent inspection. It is not a physician review, human usability study, or evidence of educational efficacy.

## Executed commands and results

Commands ran from `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/codex-icu-hemodynamics-9-13` after inspecting the project scripts.

| Check                                | Command                                                                                                                                                                                        | Result                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Before this flow redesign            | `npx jest src/features/icu-hemodynamics src/features/learning-module src/features/critical-care --runInBand`                                                                                   | 70 suites, 764 tests passed; 17.851 s                                  |
| Final feature/shared regression      | Same Jest selection                                                                                                                                                                            | 70 suites, 762 tests passed; 22.138 s                                  |
| Project TypeScript                   | `npm run type-check`                                                                                                                                                                           | Passed, exit 0                                                         |
| Project lint                         | `npm run lint`                                                                                                                                                                                 | Passed, exit 0; 0 errors, 15 existing warnings outside ICU             |
| Changed feature/routes/browser tests | `npx eslint src/features/icu-hemodynamics 'src/app/[locale]/icu-hemodynamics' e2e/icu-hemodynamics-flow.spec.ts e2e/icu-hemodynamics-targeted.spec.ts e2e/icu-hemodynamics-pac-layout.spec.ts` | Passed with no warnings                                                |
| Route/API regression                 | Exact command below                                                                                                                                                                            | Six suites, 109 tests passed                                           |
| Patch whitespace                     | `git diff --check`                                                                                                                                                                             | Passed                                                                 |
| Browser suite                        | Three spec files, 26 checks, one Chromium worker                                                                                                                                               | 26/26 passed in one complete final run; 3.1 min                        |
| Actual browser zoom                  | `node /tmp/icu-hemodynamics-flow/verify-zoom.cjs`                                                                                                                                              | Chromium tab zoom verified as 2.0; keyboard component selection passed |

```sh
npx --no-install jest --runInBand --runTestsByPath \
  'src/app/[locale]/icu-hemodynamics/page.test.tsx' \
  'src/app/[locale]/icu-hemodynamics/learn/page.test.tsx' \
  'src/app/[locale]/icu-hemodynamics/practice/page.test.tsx' \
  'src/app/[locale]/icu-hemodynamics/assess/page.test.tsx' \
  src/app/api/critical-care/progress/route.test.ts \
  src/app/api/analytics/route.test.ts
```

The shared regression includes the real lesson-shell/layout/location tests, module routes, progress adapters, critical-care access/release boundaries and analytics contracts. ICU tests retain numeric, source, safety, disclosure, scoring and persistence validators. The Practice route additionally checks a valid next-Learn return and rejection of unknown or repeated query values.

Two fewer unit tests reflect consolidation of obsolete permanent-pane assertions in `stage-learner-review.test.tsx`; replacement coverage checks one current task, instruction/evidence/action co-location, paired procedural anatomy, optional wedge anatomy, and absence of compact pane tabs. The old PAC e2e suite expected a retired seven-station resizable layout. Its replacements verify synchronized anatomy/pressure placement, resize without losing the task, and navigation to the thermodilution introduction. No clinical or disclosure validator was deleted to unlock introductory teaching. The rendered precommit test now walks through the eleven general metric introductions before testing the same keyed-question boundary.

## Browser environment and run history

**Final result: all 26 tests passed in one uninterrupted full Chromium run (3.1 minutes, exit 0).** The previously failing waveform, cardiac-output and case-capture checks passed in that same run after the procedural tests. The raw result is `logs/browser-final.log` in the evidence folder.

The isolated Next development server runs at `http://127.0.0.1:3111`. A private, ephemeral localhost authentication grant allows the real routes to load. Tests do not inject completed lesson progress, fabricate acquired trials, call hidden success handlers, or use the development clock seam. Auth request failures redact the temporary token. Browser acquisition uses the actual buttons, keyboard input, trial decisions, and elapsed transit behavior.

The local runner uses `e2e/icu-hemodynamics-flow.spec.ts`, `e2e/icu-hemodynamics-targeted.spec.ts` and `e2e/icu-hemodynamics-pac-layout.spec.ts`, a single worker, a 180-second test timeout and a 10-second action timeout. Local auth setup separately allows 30 seconds for initial compilation. The private grant's value is never part of a reproduction command.

```sh
ICU_E2E_TOKEN_FILE=/tmp/icu-hemodynamics-targeted/auth-token \
  npx --no-install playwright test \
  --config=/tmp/icu-hemodynamics-flow/playwright.config.cjs
```

Earlier default headless-shell runs were unstable: one full run passed 23/26, and a focused rerun passed its three failed checks in 38.9 seconds. A later capture pass passed 7/8 and reproduced a scroll-stability wait after procedural tests; explicitly activating the tab did not resolve it. An additional full pass passed 22/26, with focus-visibility, timeout and screenshot-protocol failures. During the stalled run its graphics child process showed sustained CPU use above 500%. These attempts remain in the raw results; they are not silently counted as green runs.

The ICU specs now explicitly use full Chromium's headless mode (`channel: 'chromium'`), matching the actual-zoom browser, instead of the separate headless-shell executable. The primary-action helper checks that a control is rendered and enabled, focuses it and presses Enter. It does not force a click or call an application handler. Short-height/zoom visibility and actual viewport screenshots remain separate checks; task-heading focus can move the viewport after a task transition.

```sh
ICU_E2E_TOKEN_FILE=/tmp/icu-hemodynamics-targeted/auth-token \
  npx --no-install playwright test \
  --config=/tmp/icu-hemodynamics-flow/playwright.config.cjs \
  --grep 'pressure flow preserves|thermodilution ledger precedes|all eight existing Practice'
```

Review captures also retain the current viewport separately from the full document. Full-page capture scrolls to the document start, then restores the original scroll position, so the site's fixed navigation is not stitched into the middle of a long screenshot. This changes no application state or action evidence.

## Executed journeys

| Journey                   | What was actually exercised                                                                                                                                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every section, five sizes | All nine section openings at 1440×900, 1280×800, 1280×600, 768×1024 and 390×844; current task visible, no compact pane tabs, no horizontal document overflow                                                                                                                                                                   |
| Why measure               | General teaching and distinct worked comparison, prediction, all seven attribution decisions including a wrong flow attribution, explanation and transfer                                                                                                                                                                      |
| Pressure system           | Independent level/zero/scale demonstrations, keyboard level change, retained reference/current values, Reset demonstration, mixed fault, real flush/classification/repair, stale evidence rejection, fresh repeat flush, comparison and transfer; deep link/reload returns to the safe beginning with section history retained |
| Waveform interpretation   | Sequential references and matched comparison, blinded map question, wrong feedback, five cumulative correct recognition responses, validity questions, transfer, Back and resize with recorded answers retained                                                                                                                |
| Waveform components       | Normal annotation and ECG context, keyboard selection, first answer and assisted retry, renumbered practice, distinct abnormal teaching, actual mechanism questions, full reasoning and retained history after reload                                                                                                          |
| Catheter advancement      | Paired functioning 3D model and pressure, actual RA/RV/PA transit and confirmations, stop-by-stop work, repair and transfer; 2D/keyboard fallback remains available with the 3D asset blocked                                                                                                                                  |
| Wedge                     | Two actual inflate/cursor/store/learner-deflate sequences, plausibility decision and PA-return confirmation; storing alone does not unlock progress and Back remains unavailable during occlusion                                                                                                                              |
| Cardiac output            | Two prerequisite readings, raw trial review/exclude/accept ledger, a real keyboard-held injection, all six Fick introductions, provenance commitment, all four disagreement decisions; separate methods remain separate                                                                                                        |
| Derived hemodynamics      | All eleven metric introductions, six provenance classifications, dependency and method decisions, an incorrect threshold answer and explicit retry with first answer retained, invalid wedge selectively withholding dependent results, two separate method results, Back/resize and transfer                                  |
| Integration               | Actual zeroing, catheter withdrawal, flush/repair, three real thermodilution injections and ledger decisions, reassessment, retained response/debrief, and arterial-line transfer                                                                                                                                              |
| Practice                  | HD-01 interpretation, all five interventions visible, PLR and fluid actions, modeled observation, final reassessment, reflection/expert trace, discriminating cue and actual line-repair transfer; return to the intended next Learn section and safe reload checkpoint                                                        |
| Challenge, deferred       | All four HD-07 interventions visible; unsafe action interrupts immediately and leaves PEEP unchanged, rewind, interpretation/action/observation, correctness deferred until debrief, reflection and transfer                                                                                                                   |
| Challenge, immediate      | Same actual safety and case journey with an explicit immediate-feedback choice; post-observation teaching appears as selected                                                                                                                                                                                                  |
| Case availability         | All eight existing Practice case briefs render, each using one current case workspace                                                                                                                                                                                                                                          |
| Actual 200% zoom          | Browser extension sets and verifies tab zoom 2.0; outer width 1440, inner width 720, device pixel ratio 2, document overflow 0; keyboard focus/Enter selects the v wave and its explanation remains readable                                                                                                                   |

The 720-pixel “zoom equivalent” test in the targeted suite is additional responsive coverage, not the evidence for actual zoom. Actual zoom has its own browser API verification, JSON, and screenshots. The viewport matrix checks openings at every size; it does not imply every complete journey was repeated at every viewport.

## Evidence and visual review

The retained [evidence index](/Users/russellmiller/.codex/visualizations/2026/09/13/01a09bd3-a438-70d0-b97f-2743be787e77/icu-hemodynamics-flow-review/INDEX.md) links the raw logs, screenshots and reviewed-path patch. `logs/` contains baseline/final Jest, route checks, typecheck, lint, the complete browser run, focused rerun, and actual zoom output. `screenshots/` contains the five-size opening matrix and performed states. Temporary local-auth values are redacted; credential-bearing browser traces and browser profiles are excluded.

Representative artifacts:

- [Pressure reference/current comparison](/Users/russellmiller/.codex/visualizations/2026/09/13/01a09bd3-a438-70d0-b97f-2743be787e77/icu-hemodynamics-flow-review/screenshots/pressure-level-reference-current.png)
- [Blinded mobile map question](/Users/russellmiller/.codex/visualizations/2026/09/13/01a09bd3-a438-70d0-b97f-2743be787e77/icu-hemodynamics-flow-review/screenshots/map-question-390.png)
- [Confirmed PA in the paired anatomy workspace](/Users/russellmiller/.codex/visualizations/2026/09/13/01a09bd3-a438-70d0-b97f-2743be787e77/icu-hemodynamics-flow-review/screenshots/advancement-confirmed-pa.png)
- [Stored wedge and verified PA return](/Users/russellmiller/.codex/visualizations/2026/09/13/01a09bd3-a438-70d0-b97f-2743be787e77/icu-hemodynamics-flow-review/screenshots/wedge-stored-and-pa-return-verified.png)
- [Accepted trial ledger](/Users/russellmiller/.codex/visualizations/2026/09/13/01a09bd3-a438-70d0-b97f-2743be787e77/icu-hemodynamics-flow-review/screenshots/accepted-trial-ledger.png)
- [Selective derived-result withholding](/Users/russellmiller/.codex/visualizations/2026/09/13/01a09bd3-a438-70d0-b97f-2743be787e77/icu-hemodynamics-flow-review/screenshots/derived-invalid-wedge-selective-withholding.png)
- [Practice debrief](/Users/russellmiller/.codex/visualizations/2026/09/13/01a09bd3-a438-70d0-b97f-2743be787e77/icu-hemodynamics-flow-review/screenshots/practice-hd01-debrief.png)
- [Challenge safety interrupt](/Users/russellmiller/.codex/visualizations/2026/09/13/01a09bd3-a438-70d0-b97f-2743be787e77/icu-hemodynamics-flow-review/screenshots/challenge-false-safety-interrupt.png)
- [Actual 200% zoom after keyboard selection](/Users/russellmiller/.codex/visualizations/2026/09/13/01a09bd3-a438-70d0-b97f-2743be787e77/icu-hemodynamics-flow-review/screenshots/actual-browser-zoom200-selected.png)

Agent inspection includes the previous 1280×800/390×844 reference layout, new concept and procedural openings, pressure comparison, paired 3D/trace, wedge recovery, derived work at narrow width, Practice debrief, deferred Challenge response, and actual zoom. The earlier [targeted-repair evidence](/Users/russellmiller/.codex/visualizations/2026/09/13/01a09bd3-a438-70d0-b97f-2743be787e77/icu-hemodynamics-review) is retained separately as the superseded pane layout. Long calculation ledgers and case debriefs intentionally use document scrolling; their entire content does not fit on a phone screen at once.

## Findings resolved during implementation

- The old fixed-height activity wrapper clipped a document-flow lesson. ICU-only opt-in styles now allow the outer document to grow and scroll.
- A narrow derived fieldset/select imposed a minimum width. Scoped minimum-width and wrapping rules now keep the selected metric and its ledger within the document.
- Initial focus and query-only section navigation could race hydration/history updates. Focus now follows explicit task changes, and switching sections performs a document navigation to the existing deep link. That boundary intentionally starts the chosen section's safe session; resizing and Back do not.
- Back could discard workbench selections when a task unmounted. Transient task-keyed drafts now retain actual choices, including first answers; no persistent schema or patient store was added.
- Case short titles, position controls and internal physiology could expose the current mechanism or tip. Initial case views use the clinical presentation, generic position controls and observed acquisitions; model reference physiology is reserved for debrief.
- Full debrief/transfer could be selected prematurely from the case checkpoint menu. The view now follows the existing completion boundary, without changing scoring or clinical success thresholds.
- The local activity now uses a `div` within the site’s existing `main`, avoiding nested main landmarks.
- The unavailable-waveform SVG label could clip in the focused tracing. It now has a short trace label plus its complete visible text equivalent below.

## Applied skill checks

These are implementation checks against the structured-module skill as modified by the owner's explicit flow request.

| Rule                            | Status and evidence                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1: entry and curriculum        | PASS — Overview/Learn resolver and on-demand section map; nine registry sections and existing Practice pairings                                                                             |
| H2: teaching before application | PASS for rendered sequencing — general teaching, distinct worked specimens and procedural prebriefs precede application; learning benefit remains untested                                  |
| H3: shared stage                | NOT APPLICABLE to the mandatory three-pane requirement — explicitly superseded by the owner; shared primitives reused, shared framework unchanged                                           |
| H4: current task                | PASS under the requested flow — one NowCard/task/action, secondary review; pane labels and pane-location directions are superseded                                                          |
| H5: rendered content            | PASS — active task/reference/source map plus all-section and deep browser journeys; extended references remain reachable                                                                    |
| H6: actual completion           | PASS — real controls and existing predicates, explicit first answers, wedge recovery and actual trial decisions; existing completion-versus-mastery limits documented                       |
| H7: disclosure and feedback     | PASS under the actual ICU policies — keyed Learn answers remain gated, wrong/unsafe feedback tested, Challenge defaults to deferred with explicit immediate option and available references |
| H8: fidelity                    | PASS for preservation — one engine/session, retained assets and action semantics, observed values distinguished from model truth; physiological validation is outside this UI check         |
| H9: progress                    | PASS — stable tasks/cases, transient drafts, old stored history and safe restart/checkpoint boundaries; no new mastery label                                                                |
| H10: language                   | PASS for requested navigation/copy repairs — clinical-copy changes listed separately for physician review; review holds remain                                                              |
| H11: scope/release              | PASS — module-local flow and authorized route/tests/docs; no shared-stage, backend, auth, data, dependency or publication changes in this pass                                              |
| H12: UX evidence                | PASS for automated journeys and agent review — five-size matrix, performed states, fallback and actual zoom; human usability and efficacy not evaluated                                     |

## Remaining issues and unexecuted checks

The eight HLR-OD-4 draft-item holds and previously draft capstone transfer remain unchanged. Case narrative/physiology reconciliation, source-specific target review, and physician review of the listed clinical-copy changes remain open. Existing case scoring may distinguish completion from mastery; this pass did not silently change that contract. The legacy case PPV assumptions and authored SvO₂ availability are documented in the redesign record.

The isolated preview has no configured production analytics service; its analytics endpoint can return 500. Client/API contract tests pass, but remote delivery was not verified. No production database, Supabase process, upload, migration, release operation, or deployment was run. No production build or cross-browser/device hardware matrix was claimed. Browser checks use Chromium; missing-asset testing verifies the 2D/keyboard fallback but does not validate every GPU driver.

The historical headless-shell timing/capture instability is retained as a test-environment limitation. Full Chromium coverage does not establish compatibility with every headless runtime or graphics driver. Source/code review and ordinary-UI masking do not make a client-side quiz tamper-proof. No human participant, clinical efficacy, competence, or translation approval is inferred from this record.

## Proposed human think-aloud check — not performed

Recruit three to five clinicians/trainees unfamiliar with this interface, with a supervising clinician available for content review. Use a desktop and a narrow/zoomed view. Give neutral tasks, without teaching the answer or directing attention to a particular control:

1. Identify the current clinical question, available observation, and intended next action in the opening lesson.
2. Explain a pressure change after adjusting reference height versus display scale; repair the authored line fault and explain why another observation is needed.
3. Read an unlabelled RV/PA tracing, then advance the simulated catheter while describing the waveform/anatomy relationship.
4. Capture a wedge observation and explain what demonstrates recovery.
5. Compare discordant CO methods and an invalid derived result, naming which inputs can and cannot support each result.
6. Complete one Practice case and try each Challenge feedback setting, then describe what completion and the saved checkpoint actually mean.

Ask participants to say what they are looking for and why. Record incorrect interpretation of labels, missed prerequisites, time spent searching, scroll/focus interruptions, accidental actions, disclosure of a keyed answer, and whether feedback helps explain a revision. Do not prompt them toward the keyed option. Treat clinical misconceptions and loss of visible balloon/recovery controls as blocking findings for review. Use the observations to refine presentation; do not convert this small study into a clinical competence or educational efficacy claim.

## Publication follow-up — 2026-09-14

The owner subsequently requested a commit, push and pull request. The validation above records the reviewed implementation before publication of the branch. This follow-up authorizes the PR only; clinical review holds and unlisted-preview status remain unchanged.
