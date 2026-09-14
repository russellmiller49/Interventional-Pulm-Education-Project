# ECMO activity flow validation

Validation dates: September 13–14, 2026. Base commit: `d209c8006e693e9d4ee8a250347911e191508029`. The route was exercised in the existing local Next development server at `http://localhost:3114/en/cardiohelp-ecmo`. No deployment, merge, Supabase operation or uploaded asset was part of this work.

This is automated interaction testing and agent visual review, not human usability evidence, physician review or clinical validation. The module's existing draft/unlisted and clinical-review boundaries remain.

## Test results

All logs and browser scripts are outside Git at:

`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/cardiohelp-flow-2026-09-13/`

| Check actually executed                                                                                                                                             | Result                                                                                    | Evidence                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Baseline: `npx --no-install jest src/features/cardiohelp-ecmo --runInBand`                                                                                          | 68 suites, 2,086 tests passed                                                             | `baseline-jest.log`                                          |
| First slice: existing introductory/comparison repair tests                                                                                                          | 22 tests passed; type-check passed before expansion                                       | `slice-jest.log`, `typecheck-first.log`                      |
| Final ECMO: `npx --no-install jest src/features/cardiohelp-ecmo --runInBand`                                                                                        | 69 suites, 2,099 tests passed                                                             | `ecmo-final.log`                                             |
| Broader shared-module regression: `npx --no-install jest src/features/cardiohelp-ecmo src/features/learning-module src/features/critical-care --runInBand --bail=0` | 106 suites passed; 1 pre-existing copy-scanner test failed. 2,433 tests passed, 1 failed. | `jest-final.log`; baseline copy confirmation described below |
| `npm run type-check`                                                                                                                                                | Passed                                                                                    | `typecheck-final.log`                                        |
| `npm run lint`                                                                                                                                                      | Exit 0, no errors; 15 existing warnings                                                   | `lint-final.log`                                             |
| Specific-path Prettier and `git diff --check`                                                                                                                       | Passed                                                                                    | `format*.log`; working-tree review                           |

The broad test run's remaining failure is `critical-care/__tests__/learner-copy.test.ts`, which reports five existing phrases: three in mechanical-ventilation teaching using “engine,” and two ECMO phrases using “assessment” in a clinical sense. Each complete flagged phrase was checked against the base commit with `git show`; `copy-violations-baseline.json` records all five full matches. No new phrase is responsible for this failure. The scanner and medical meaning were not altered to silence it. The affected ECMO originals are `PumpPressureZonesPanel.tsx` and `WhyExtracorporealSupportPanel.tsx`. This is a reported failure, not a claimed green full-repository run.

The final ECMO suite retains engine, physiology, source, release, interlock, scoring, assessment-boundary, first-response, missing-channel, track/progress and leak coverage. New tests exercise explicit presentation selection for every registered pathway task, the full eight-task comparison journey on both tracks, Run-before-Continue, all four blood-walk stops under one progression, normal baseline groups/Back, every original scoped teaching section assigned to a rendered phase, and one safety-gated control group outside optional 3D.

After the final phone-layout changes, the ECMO suite passed again (69 suites / 2,099 tests), as did the central accessibility suite (1 suite / 18 tests, `accessibility-final.log`), type-check and lint. The broader three-feature run above preceded those last presentation changes; it is reported separately rather than represented as a new fully green run.

## Obsolete assertions and replacements

| Previous assertion                                                  | Replacement and preserved protection                                                                                                                                  |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three permanent labelled panes and compact pane tabs                | One live Now card and current teaching/visual/response flow; no workspace tabs. Standalone legacy workspace/fit tests remain.                                         |
| Every live surface and full teaching chapter present at every phase | Explicit current surfaces; original section-to-phase coverage; unselected answers/chapters absent rather than CSS-hidden.                                             |
| Console always mounted/scaled on Practice/Assess                    | No console behind the initial decision or revealed debrief; one native-size console during management/reassessment. Control IDs remain unique.                        |
| Circuit question outside the old task pane                          | One map-owned response form within the integrated activity, with question/Submit/verdict/Continue co-located.                                                         |
| Walk uses its own separate Next/Back controls                       | Host progression visits every blood stop and then the next existing task; no competing inner Next. Standalone walk navigation remains.                                |
| Fresh learner CTA says Continue                                     | Fresh CTA says Start, with the same target; stored progress says Continue. The central accessibility suite changes only its ECMO expectations and retains axe checks. |
| Phase names in Back labels                                          | Back names the actual previous task and retains the same performed-state/answer rules.                                                                                |
| Two reveal actions                                                  | A single reachable reveal action after reassessment, focused once, with unchanged reveal authority.                                                                   |
| Resumption copy physically inside `EcmoCircuit3D.tsx`               | The identical abstraction wording is checked in extracted `EcmoCircuitControls.tsx`; all clinical safety requirements and the same wording regex remain.              |

The pre-commit leak tests caught isolation language after the controls were extracted. The implementation was corrected: before the existing prediction boundary, only a neutral availability message is mounted. The leak assertions were not weakened. Earlier development logs include obsolete-layout failures, a corrected readout property error and browser automation selector/timing failures; these are not counted as successful final checks.

## Browser execution matrix

Chromium/Playwright used real route navigation, ordinary buttons, selects, native radio keys, console keys and sliders. Scripts never seeded answer/session state or invoked hidden transition handlers. A fresh browser context was used for each main journey. Four layouts were tested: **1440×900**, **1280×800**, **820×1180** and **390×844**.

| Journey set at each of the four sizes                                                                                                                                 | Completed                                                                                                  | Evidence                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Four shared introductory sections × VV and VA                                                                                                                         | 32/32 full journeys                                                                                        | `browser-flow.mjs`, `browser-flow-report.json`                     |
| VV/VA normal state, VV series/VA parallel physiology, both foundation capstones                                                                                       | 24/24 full journeys                                                                                        | `browser-expanded.mjs`, `browser-expanded-foundations-report.json` |
| Both console orientations; drainage and return-resistance; acute CO₂; gas-source interruption; VA differential oxygenation and LV loading; bubble stop and power loss | 36/40 complete; four VV gas-to-air transfer attempts blocked by the preserved pre-existing commitment gate | `browser-expanded-drills-report.json`                              |
| Clinical VV gas-disconnection Practice; clinical VA differential-oxygenation Practice; VV and VA Assess capstones                                                     | 16/16 through committed plan, actual management, observation, reassessment and revealed debrief            | `browser-cases.mjs`, `browser-cases-report.json`                   |

That is **108 completed journeys and four recorded transfer blocks**, rather than a claim that every clinical case was individually browser-tested. The fourteen case definitions all use the new host, but browser end-to-end coverage sampled two clinical cases plus both capstones. The remaining clinical cases and ten unsampled drills have registry/unit/integration coverage rather than an end-to-end browser claim.

Checks within these journeys include document overflow, no compact workspace tabs, one current task, the actual three-control comparisons, repeat/reset, no Continue before a required Run, map response timing, normal reference groups, physical console actions, external gas controls, emergency clamps/resumption, and debrief width. Final successful journeys recorded no page exceptions. Fixed mobile defects included a teaching-grid intrinsic-width overflow and overly narrow signal-table columns; signal rows now retain their labelled fields in a stacked phone presentation. During action/observation/transfer, operational views precede the longer drill reference teaching in DOM order. The simulation remains owned by the same host.

Additional checks in `browser-accessibility.mjs` / `browser-accessibility-report.json`:

- Keyboard Enter advances blood-walk stops; native radio Space/ArrowDown and Enter select/submit a map response. Resizing a committed answer from phone to desktop preserves the chosen response and commitment.
- With Chromium WebGL explicitly disabled, the 2D retrieval task still works and optional 3D reports its fallback. At phone width the committed clamp controls work without launching 3D.
- The emergency sticky strip remains above the task without covering its new heading; the measured phone strip ended at approximately 227 px and the new task began below it.
- **Actual Chromium 200% page zoom** was set and read with `chrome.tabs.setZoom/getZoom` in an isolated extension/profile. The physical viewport was 1440×900 and the measured CSS viewport 720×450. Genuine comparison Run, Back retention, Repeat, map answer/submit and console Parameter-list interaction passed without document overflow. This was not CSS zoom or a device-scale-factor substitution.
- Reload and a late-phase deep link did not manufacture transient comparisons, responses or completion.
- The unrelated critical-care hub loaded without horizontal overflow at 1280×800. Shared production components/styles were not modified. This is not full visual regression coverage of other modules.

## Screenshots and visual review

Screenshots are in the same evidence directory; paths are local review artifacts and not runtime assets. Representative inspected states include:

| Screenshot                                                                                      | State inspected                                                      |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `comparison-390.png`, `comparison-1280.png`, `comparison-1440.png`                              | Engine-produced baseline/result and real comparison continuation     |
| `map-precommit-390.png`, `map-feedback-390.png`, `map-feedback-1440.png`                        | Question, numbered choices, Submit and later feedback beside the map |
| `vv-normal-state-390.png`, `va-parallel-physiology-1440.png`                                    | Selected baseline reading and an independent track-specific question |
| `emergency-keyboard-390.png`                                                                    | Continuous alarm/flow/clock and new task below sticky status         |
| `comparison-native-200-percent.png`, `map-native-200-percent.png`, `console-zoom-cdp-false.png` | Native zoom layout and control/result access                         |
| `signal-register-390.png`                                                                       | Readable labelled signal rows at phone width                         |
| `case-plan-practice-vv-1440.png`                                                                | Clinical findings and plan together                                  |
| `case-debrief-assess-va-1440.png`, `case-debrief-practice-vv-390.png`                           | Wide debrief and compact document flow                               |
| `unrelated-critical-care-1280.png`                                                              | Existing hub smoke check                                             |

Playwright's default screenshot capture returned a blank image at native page zoom despite successful interactions and visible element bounds; waiting and headed rendering did not fix that capture. The inspected native-zoom screenshots use Chromium's viewport capture (`Page.captureScreenshot`, `fromSurface: false`) in the isolated headed browser, preserving actual 200% page zoom. The console image comes from the dedicated diagnostic pass (`browser-zoom-capture.mjs` / `.log`); `console-native-200-percent.png` is an incomplete later capture and is not visual evidence. The final accessibility script uses the viewport capture method. The earlier `map-question-*` captures are not used as retrieval evidence: the original script captured after moving onward. The explicitly named precommit/feedback screenshots replace them. Full-page screenshots can show the site's sticky navigation at its current scroll coordinate; viewport captures were also inspected. Automated checks alone do not establish clinical validity or human usability.

## Remaining limitations and preserved holds

1. **Gas-to-air transfer lock:** both gas-source drills load a new bubble-stop scenario, which has no committed prediction. Their existing transfer supplies no prediction form; the circuit controls retain the original prediction gate. VV is browser-confirmed blocked at the four sizes; the matching VA wiring is code-confirmed. No completion was recorded for those blocked attempts and no safety/assessment rule was bypassed. A separate transfer-contract decision is needed.
2. **Existing copy scanner findings:** the one broad-suite failure above is retained and explicitly reported.
3. **Model and authoring boundaries:** no new dose response, treatment targets, actual priming/cannulation sequence or emergency choreography was added. Some track foundation explorations remain optional because their original gates are optional. Manufacturer/local-protocol qualifications and all held clinical-review decisions remain. Archived/frozen pilot material and empty human findings forms are untouched.
4. **Not executed:** human think-aloud sessions, physician adjudication, clinical validation, screen-reader device testing, Safari/Firefox/mobile hardware testing, every clinical case in a browser, production build/deployment and external publication. No such result is implied by the automated matrix.

## Structured-module contract assessment

These statuses concern this implementation's tested scope, not module release approval.

| Rule                            | Status  | Evidence / boundary                                                                                                                             |
| ------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| H1: one entry/pathway           | PASS    | Same registry/resolver; fresh Start and saved Continue; hub/pathway tests.                                                                      |
| H2: teaching before application | PASS    | Eight-task comparison journeys and all shared-foundation browser journeys; later answers remain gated.                                          |
| H3: reuse existing stage        | PASS    | Existing hosts/shell/StageLayout reused. Explicit owner brief supersedes the permanent three-pane rule only for ECMO.                           |
| H4: one current task            | PASS    | Single Now card/forms; map co-location; compact tabs absent; keyboard and CTA checks.                                                           |
| H5: original content rendered   | PASS    | Complete 214-task mapping, scoped-section coverage and existing source/panel tests; case host retains original definitions.                     |
| H6: real acts/completion        | BLOCKED | Existing gates preserved and actual actions exercised; gas-to-air transfer cannot complete under its inherited commitment mismatch.             |
| H7: mode-aware answers          | PASS    | Existing disclosure/leak/Practice-Assess suites retained; extraction leak fixed before delivery.                                                |
| H8: preserve fidelity           | PASS    | Engine/device/scoring/source registries unchanged; physical control and missing-channel tests pass.                                             |
| H9: honest progress             | PASS    | Existing persistence/first-response/track tests and real reload/deep-link checks; no new store.                                                 |
| H10: clinician language         | BLOCKED | New copy is navigational; five unchanged scanner findings remain, including two clinical uses of “assessment.” No physician validation claimed. |
| H11: scope/release              | PASS    | Feature production changes; only ECMO assertions updated in one central test; no merge/deploy/data mutation.                                    |
| H12: demonstrate behavior       | PASS    | Executed matrix, screenshots and keyboard/native-zoom checks above, with four explicit transfer blocks and human verification excluded.         |

## Short human think-aloud protocol — not yet performed

Recruit 3–5 intended learners with mixed ECMO experience. Use a fresh local profile and balance VV/VA and desktop/phone presentation. Allow 20–30 minutes. Keep clinical answer keys and the pre-existing B5 facilitator material separate from participant instructions.

Ask the learner to work an introductory explanation, follow the blood path, locate a requested measurement, compare each of the three controls, read a stable-run group, find an actual console control, and work one neutral-presented troubleshooting or case scenario through debrief. Ask them to say what they are trying to do, which information they used, what they think changed, and what they expect the next control to do. Do not supply a diagnosis, answer, or correct control while observing. Do not use the known blocked transfer as a completion task until its contract is resolved.

Record the first chosen action, time to find the current question/control/Submit, rereading and scrolling, unintended control activation, whether baseline and result are distinguished, use of Back/help, and ability to explain what the debrief adds. After each activity, ask where the learner thought they were in the course and what they would do next. Report observations by participant and task, including unsuccessful attempts. Treat small-sample findings as usability evidence only; route any clinical-content disagreement to the physician review process. Do not fill the historical findings template with automated results.
