# G02 — Cardiohelp ECMO POST-REPAIR ADDENDUM

Date: September 16, 2026. Reviewer: Codex, AI assistant. **Report only.**

**The repaired Learn scrolling and task-entry/header placement pass the expanded matrix. Residual keyboard-focus defects remain at phone widths and under enlarged text, so the complete requested accessibility matrix does not pass. Clinical/device and human-review holds remain unchanged.**

The [original G02 report](G02-ECMO-final-technical-report.md) passed the states it exercised, but subsequent direct owner review found a module-wide Learn scrolling/header defect outside that matrix. [ECMO-LAYOUT-01](ECMO-LAYOUT-01-handoff.md), merged in [PR #234](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/234), reproduced and inventoried that defect, repaired scrolling/header placement and bounded automatic scrolling, and added regression coverage. **This addendum independently revalidates the repaired states. It supplements, and does not replace or rewrite, the original report.**

## Scope, baseline and method

- Read the owner's `prompts/G02.md`, `LEARNING_DESIGN_BRIEF.md` and the ECMO/phase-4 roadmap in the v2 action pack in Local-Data. The current request narrows that protocol to this post-repair ECMO addendum and one report-only PR. The self-paced brief supersedes older mandatory-answer, assessment, mastery and fixed-layout rules in historical teaching guidance.
- Entry worktree was clean. Fetched `origin`, then created `codex/ecmo-g02-post-repair` from **`695ede0a7c3469f4374414f2136d84e16c31e972`**, current merged `origin/main` including PR #234. Historical baseline `9ef04539118b889a344992c63ba35808ee477f0e` remains an ancestor; no newer work was reset.
- Reviewed the prior G02, ECMO-LAYOUT-01, source/review queue, observation guide and current implementation. Freshly derived **30 distinct sections / 34 track-specific entries / 240 authored tasks** from the current pathway and stage adapters. All current tasks use FLOWING. The four common sections have VV and VA entries.
- Fresh production build served at `http://127.0.0.1:3148`. macOS, Node `v26.5.0`, npm `11.17.0`, installed Chromium. Local API responses were mocked and external browser requests blocked. No actual account, stored secret, production data or remote service mutation was used.
- Re-executed the merged browser regression suite, independently surveyed every task at each requested viewport, and exercised expanded disclosures, circuit walk/map, guided live controls and the G02 invariants. Screenshots were opened for assistant visual inspection. These are browser/assistant observations, **not human learner or faculty review**.
- Only this addendum changes in Git. ECMO runtime, tests, equations, questions, source metadata, review decisions, progress records, release status and Device Intelligence are unchanged. The original report's Git blob remains **`f7870a3a7d90cb1f43ed535f133b2237ae1c7755`**.

Generated QA evidence and replay scripts are retained outside Git at:

`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/g02-ecmo-post-repair-2026-09-16/`

This directory contains current-run results, screenshots, logs, raw failed attempts and the current-head route manifest. Historical QA results were not substituted for new executions. The regenerated invariant manifest matches every field consumed by the historical G02 browser harness.

## PASS

### Complete Learn layout inventory and matrix

At **1600×900, 1440×900, 1024×768, 390×844, 320×844 and 1440×900 with 200% CSS text enlargement**, the independent survey checked all **34 direct entries and all 240 task states per viewport: 204 entries and 1,440 task states**.

Each entry loaded its correct initial task. Each task selection restored the activity header with its title, track, section controls and actions below the actual global header. The reading owner reached the bottom and returned to the top. Wheel and PageDown operated the expected owner in **204/204 entry checks**. No document horizontal overflow or desktop document displacement was measured in this matrix. Task/reading geometry passed **1,440/1,440 states**. Keyboard results are qualified separately below; these geometry passes are not blanket accessibility passes.

| Viewport                | Actual site-header height | Reading owner           | Header/task geometry        | Keyboard qualification                                               |
| ----------------------- | ------------------------: | ----------------------- | --------------------------- | -------------------------------------------------------------------- |
| 1600×900                |                     81 px | ECMO shell, 819 px high | 34 entries / 240 tasks pass | Surveyed controls pass                                               |
| 1440×900                |                     81 px | ECMO shell, 819 px high | 34 entries / 240 tasks pass | Surveyed controls pass                                               |
| 1024×768                |                     81 px | ECMO shell, 687 px high | 34 entries / 240 tasks pass | Surveyed controls pass; separate regression-run caveat below         |
| 390×844                 |                     73 px | Document                | 34 entries / 240 tasks pass | Forward entry traversal works; residual focus occlusion demonstrated |
| 320×844                 |                     73 px | Document                | 34 entries / 240 tasks pass | Forward entry traversal works; residual focus occlusion demonstrated |
| 1440×900, 200% CSS text |                    297 px | ECMO shell, 603 px high | 34 entries / 240 tasks pass | Operational-strip focus occlusion demonstrated; see below            |

The activity header belongs to the reading flow. It can scroll away during reading and returns when the learner scrolls to the top or changes task. The validated contract does not make it permanently sticky. Desktop automatic guided scrolling moved the shell, leaving the document at zero; compact scrolling used the document. The actual global-header height, including wrapped enlarged navigation, remained the sizing reference.

The following table lists every current entry. **Geometry PASS ×6** covers all of its tasks at all six settings. The last columns count flagged native-focus probes after deliberate reading/footer scrolling (see NEW DEFECT); a flag is not a clinical outcome or a separate defect. Zero means no flag in those probes, not every possible keyboard state.

| Track | Learn section                                                                                         | Tasks | Geometry | Focus flags 390 px | Focus flags 320 px |
| ----- | ----------------------------------------------------------------------------------------------------- | ----: | -------- | -----------------: | -----------------: |
| VV    | `why-extracorporeal-support` — Why extracorporeal support exists                                      |     5 | PASS ×6  |                  4 |                  4 |
| VV    | `circuit-flow-path` — Drainage → pump → membrane lung → return: a walk round the circuit              |     6 | PASS ×6  |                  5 |                  3 |
| VV    | `pump-and-pressure-zones` — The pump, and the pressures either side of it                             |     7 | PASS ×6  |                  2 |                  0 |
| VV    | `blood-flow-versus-sweep` — The control panel: the three things you can change                        |     8 | PASS ×6  |                  0 |                  0 |
| VV    | `vv-normal-state` — A stable VV run: the baseline you read everything against                         |     6 | PASS ×6  |                  0 |                  1 |
| VV    | `vv-series-physiology` — In series with the heart: what the flow number counts                        |     6 | PASS ×6  |                  0 |                  1 |
| VV    | `startup-sensor-orientation` — Meet the console, the circuit, and the external controls               |    18 | PASS ×6  |                  0 |                  0 |
| VV    | `preload-drainage-collapse` — Drainage insufficiency: falling flow and line chatter                   |     7 | PASS ×6  |                  5 |                  6 |
| VV    | `afterload-return-obstruction` — Return obstruction: rising post-pump pressures                       |     6 | PASS ×6  |                  1 |                  4 |
| VV    | `afterload-oxygenator-resistance` — Oxygenator resistance: a widening pressure gradient               |     6 | PASS ×6  |                  1 |                  4 |
| VV    | `vv-recirculation` — VV recirculation: circuit flow and patient oxygenation                           |     6 | PASS ×6  |                  1 |                  4 |
| VV    | `acute-hypercapnia` — Acute hypercapnia: sweep and the acid–base picture                              |     6 | PASS ×6  |                  1 |                  4 |
| VV    | `compensated-hypercapnia` — Compensated hypercapnia: interpreting CO₂ with pH                         |     6 | PASS ×6  |                  1 |                  4 |
| VV    | `gas-source-interruption` — Sweep-gas interruption: gas transfer with stable blood flow               |     6 | PASS ×6  |                  1 |                  4 |
| VV    | `arterial-bubble-stop` — Bubble alarm: the pump stopped itself                                        |     9 | PASS ×6  |                  8 |                  1 |
| VV    | `transport-power-loss` — Power loss during transport: battery support                                 |     6 | PASS ×6  |                  5 |                  5 |
| VV    | `vv-integration-capstone` — One presentation, four explanations: flow unchanged, patient worse        |     6 | PASS ×6  |                  1 |                  1 |
| VA    | `why-extracorporeal-support` — Why extracorporeal support exists                                      |     5 | PASS ×6  |                  4 |                  4 |
| VA    | `circuit-flow-path` — Drainage → pump → membrane lung → return: a walk round the circuit              |     6 | PASS ×6  |                  5 |                  3 |
| VA    | `pump-and-pressure-zones` — The pump, and the pressures either side of it                             |     7 | PASS ×6  |                  2 |                  0 |
| VA    | `blood-flow-versus-sweep` — The control panel: the three things you can change                        |     8 | PASS ×6  |                  0 |                  0 |
| VA    | `va-normal-state` — A stable VA run: VV plus two ideas                                                |     6 | PASS ×6  |                  0 |                  1 |
| VA    | `va-parallel-physiology` — In parallel with the heart: who fills the aorta                            |     6 | PASS ×6  |                  0 |                  1 |
| VA    | `va-startup-sensor-orientation` — Meet the console on a VA circuit                                    |    18 | PASS ×6  |                  0 |                  0 |
| VA    | `va-preload-drainage-collapse` — VA drainage insufficiency: falling flow and pressure                 |     7 | PASS ×6  |                  5 |                  6 |
| VA    | `va-afterload-arterial-return-obstruction` — VA arterial return obstruction: rising circuit pressures |     6 | PASS ×6  |                  2 |                  4 |
| VA    | `va-afterload-oxygenator-resistance` — VA oxygenator resistance: a widening pressure gradient         |     6 | PASS ×6  |                  1 |                  4 |
| VA    | `va-differential-hypoxemia` — Differential hypoxemia: right-arm and femoral oxygenation               |     6 | PASS ×6  |                  1 |                  4 |
| VA    | `va-lv-loading` — VA left ventricular loading: interpreting low pulsatility                           |     6 | PASS ×6  |                  1 |                  4 |
| VA    | `va-acute-hypercapnia` — Acute hypercapnia on VA: sweep and patient reassessment                      |     6 | PASS ×6  |                  1 |                  4 |
| VA    | `va-gas-source-interruption` — VA sweep-gas interruption: gas transfer with stable flow               |     6 | PASS ×6  |                  1 |                  4 |
| VA    | `va-arterial-bubble-stop` — Bubble alarm on VA: the pump stopped itself                               |     9 | PASS ×6  |                  1 |                  1 |
| VA    | `va-transport-power-loss` — VA power loss during transport: battery support                           |     6 | PASS ×6  |                  5 |                  5 |
| VA    | `va-integration-capstone` — The same unchanged flow, with a second circulation to blame               |     6 | PASS ×6  |                  1 |                  1 |

### Requested expanded and interactive states

- **“Why extracorporeal support exists”:** at all six requested settings, opened delivery arithmetic, changed all three exposed sliders with arrow keys (18 actual slider changes across the six settings), reached the bottom, tested model detail alone, then both disclosures simultaneously. Continue was fully visible, focused and activated with Enter; the worked example appeared with the header restored. Skipping and reloading restored the truthful fresh initial task. `expanded-and-guided.json` records six passing foundation checks and the three disclosure states per check.
- **“Follow the blood”:** complete entry chrome was visible; all six authored tasks were traversed in every viewport. Followed all four circuit stops in this section, inspected the actual SVG circuit map and its live-reading/text content, reached the bottom and restored the header. `expanded-and-guided-followup.json` records six passing settled walk/map checks. The map was selected through its actual `[data-circuit-drawing] svg` markup; absence of a guessed selector was not counted as map evidence.
- **Later VV:** all six tasks in `vv-recirculation`, including its later phases, passed entry/header/reading geometry across the six settings. The recirculation boundary was also opened before answering in `vv-series-physiology`.
- **VA-specific:** all six tasks in `va-lv-loading` and the other VA sections passed the same geometry matrix. The VA gas-to-air and integrated-case invariants were independently exercised.
- **Control-heavy/live lesson:** all 18 tasks in `startup-sensor-orientation`, and all 18 VA counterparts, were surveyed across the matrix. “Show me where” focused the real PARAM console control; its settled location was below the global header and reachable at every setting. At 390/320 px its final top was approximately **89 px**, below the **73 px** site header. Screenshots and time-separated geometry distinguish settled placement from intermediate smooth scrolling.
- The merged suite also re-exercised the **actual fixed StageLayout fallback** at 1600, 1024 and 390 px. Its three desktop panes scroll independently, and compact tabs expose the panes. This is explicitly a synthetic fallback fixture, not the layout of any current Learn section.

### Self-paced, simulation and honesty invariants

The current-head G02 browser replay produced **95 passing named checks**: 68 routes/deep links, 14 detailed flows, 5 content-boundary checks, 3 legacy/recommendation checks, 3 outline/completed-review checks and 2 unavailable-WebGL checks. Final groups recorded no page exceptions. These counts are separate from the layout/task survey.

| Invariant                                               | Current-run evidence                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No-answer progression; explanation before answer; retry | Both VV/VA gas lessons completed by skipping, with Section reviewed and zero performed-step markers. Explanation was available without answering. Actual wrong choices produced their authored rationale; Try again cleared the choice; Continue stayed available.                                                                                            |
| Gas-to-air interlocks                                   | VV/VA × 1440/390: skipped preceding learning steps, entered the new air event, revealed without acting, explicitly started the guided event and used the return clamp by keyboard. Premature resumption was rejected before isolation/source correction. Clamps required no quiz answer.                                                                      |
| Genuine action/capture requirements                     | Revealing did not produce a comparison or action. Run comparison without answering produced a real modeled Before/After result; Reset this comparison cleared it. Integrated-case reveal/Hint continued to report no action when none was performed. No skipped capture, prediction or intervention was manufactured.                                         |
| Score-independent navigation                            | Legacy grades 0 and 100 produced identical hub links, shared progress and next-case recommendations. Former `/assess` URLs opened the existing self-paced integrated cases. Help and answers did not govern access.                                                                                                                                           |
| Legacy progress preservation                            | Seeded historical scores, attempts, completion/mastery and unknown fields survived value-for-value. Normalized historical storage survived byte-for-byte. Only truthful existing `selfPaced` visits/location fields were added by navigation. No graded progress POST was observed in isolated flows; account boundaries also passed mocked regression tests. |
| Source/review-state honesty                             | Hub remained unlisted/draft, clinical/device review none recorded and IFU currency not checked. Source checks were not relabeled human review. All ten claim decisions and review-status files remain unchanged.                                                                                                                                              |
| Local-protocol wording                                  | Hub still states no local policy is held/reviewed. Both air-case explanations say the module holds no copy of the local protocol. The resume control retains current IFU/local-protocol wording and its simulation abstraction.                                                                                                                               |
| PaCO₂ floor                                             | Rendered sweep boundary states the existing straight-line model, fixed 20 mmHg floor and approximately 7.5 L/min reference-circuit point. Existing model-range regressions passed; no new clinical target was inferred.                                                                                                                                       |
| Saturation ceiling                                      | Rendered pump comparison states the existing 100 ceiling around 4000 rpm, with flow/suction able to change thereafter. Model-range regressions passed.                                                                                                                                                                                                        |
| Recirculation boundary                                  | Opened the model boundary without a prediction. It retains the authored starting share, unchanged reference share, speed response only in established recirculation and absent cannula-position/volume modeling.                                                                                                                                              |
| Fallback                                                | With WebGL deliberately unavailable, both VV/VA transfer paths displayed the fallback, kept the protective return clamp usable and allowed continued navigation. This is unsupported-graphics evidence, not a missing-asset or context-recovery test.                                                                                                         |

### Executed commands and results

| Check                                                       | Actual result                                                                                                                                                                                             |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full `npm run build`                                        | PASS, exit 0: embedded apps, content generation, asset validation, Next production compilation/type checking and standalone preparation                                                                   |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check` | PASS, exit 0                                                                                                                                                                                              |
| Combined ECMO/routes/shared Jest                            | **117 suites: 114 passed, 3 failed; 2,755 tests: 2,752 passed, 3 failed; zero skipped**                                                                                                                   |
| ECMO part of that same Jest run                             | **74 suites / 2,315 tests passed**, including the seven scroll-owner regressions                                                                                                                          |
| Other parts of that same Jest run                           | Shared critical-care: 26 suites / 236 tests, 3 failures; learning-module: 15 / 134 passed; ECMO routes: 1 / 62 passed; progress API: 1 / 8 passed                                                         |
| Scoped ESLint, `--max-warnings=0`                           | **Exit 1: zero errors, one pre-existing shared warning**; no ECMO diagnostic                                                                                                                              |
| Merged layout Playwright suite                              | **First execution: 16/17 passed, 1 failed; zero skipped/retries.** A separate unchanged rerun of the failed 1024×768 test passed 1/1 across all 34 entries. Do not label the first suite execution green. |
| Independent task layout survey                              | 204 direct entries and 1,440 authored task states checked across the six settings; all entry/task header and scroll-reach geometry passed                                                                 |
| Detailed browser/invariant runs                             | Results itemized above; failed/intermediate measurements retained separately                                                                                                                              |

The intermittent merged-suite failure occurred after reading-scroll reset in `va-normal-state` at 1024×768: header top **−12 px**, expected at least **80 px**. The unchanged targeted rerun passed, as did the independent 240-task survey at that size. The first failure remains a validation limitation; this addendum does not establish its cause or silently convert it into a pass.

Other measurement corrections are retained in the evidence: an initial route-manifest generator read raw lesson steps instead of the actual stage adapter; final generation uses the adapter and its prediction item. Early compact-focus/walk samples preceded smooth-scroll settlement. A document-bottom sample could already be below the ECMO footer because the global footer follows it, and focusing an already-focused control after test-driven scrolling does not cause a new browser reveal. Follow-ups explicitly exposed the ECMO footer and re-entered keyboard focus. Oversized focusable reading regions were distinguished from clipped actionable controls. None of these harness corrections changed application code or the merged regression assertions.

## NEW DEFECT

**G02-ECMO-POST-01 — P2: native keyboard focus can remain beneath the sticky global header after compact reading scroll.** This is a newly demonstrated residual ECMO layout/accessibility defect on the repaired build. It is not evidence that PR #234 introduced it, and it is not the former module-wide loss of the reading scroller.

Reproduction at both **390×844 and 320×844**, using real browser input:

1. Open `/en/cardiohelp-ecmo/learn?lesson=why-extracorporeal-support` and Continue to the worked example (`why-extracorporeal-support-worked-example`).
2. Tab through its controls to the primary Continue button. In the recorded run this took seven Tabs and placed it around y=400.
3. Wheel down 230 px while Continue has focus. Continue remains visible around y=170.
4. Press Shift+Tab to **Continue without doing this step**, then wait three seconds.

Expected: the complete focused button and focus outline are exposed below the sticky site header. Actual: its top stays at **60.72 px (390)** / **60.58 px (320)** beneath the header ending at **73 px**. Approximately 12 px of the control/focus outline is covered, with no corrective document movement. The isolated reproduction is in `wheel-reverse-tab.json`, `reproduce-wheel-tab.cjs` and `wheel-reverse-tab-{390,320}.png`. This remains after scroll settlement and is distinct from the early timing candidates.

The broader task-focus follow-up also records compact controls partly or fully under the header after reading/footer navigation. Its raw per-task findings are retained; the isolated reproduction above is the bounded defect claim. Ordinary unscrolled forward/backward traversal did not reproduce every positioned-scroll case, so this is **state-dependent**, not a claim that all keyboard navigation fails.

The current bounded helper handles authored task/guided focus. Native Tab/Shift+Tab does not use that helper. Compact mode correctly transfers reading to the document, but the shell's `scroll-padding-block: 1rem` does not establish document clearance for these native focus transitions. That source trace is a likely explanation, not a validated repair.

**G02-ECMO-POST-02 — P2: at 200% CSS text, native reverse-Tab focus can be fully hidden by the operational strip.** On `/en/cardiohelp-ecmo/learn?lesson=arterial-bubble-stop` at 1440×900 with `html { font-size: 200% !important; }`, Tab to **Sources for this lesson**, then Shift+Tab three times to **Why this matters**. The isolated run used 34 forward Tabs from the task-entry focus. After another three seconds, the focused summary occupies **y=405.89–487.66**, entirely beneath the sticky operational strip at **y=297–489.91**. Hit-testing finds the strip's modeled-time paragraph, not the focused summary. The document stays at zero: reading ownership is intact, but focus visibility fails. See `text200-footer-reverse-tab.json`, `reproduce-text-footer-tab.cjs` and `text200-footer-reverse-tab.png`.

The same enlarged-text footer/focus probe flags the initial tasks in `arterial-bubble-stop`, `transport-power-loss` and both VA counterparts (4 of 34 entry probes). Simple forward Tab reaches this summary visibly; the failure follows footer navigation and reverse Tab. This is separately reproduced keyboard behavior, not the earlier same-focus sampling artifact. The shell's native focus clearance does not account for this enlarged pinned strip.

**Disposition:** no runtime repair in this report-only PR. A subsequent bounded ECMO focus repair should reproduce both the settled wheel→reverse-Tab and enlarged-text sources→reverse-Tab cases, account for actual pinned chrome and recheck desktop, compact and enlarged text without changing the validated scroll-owner, simulation or progress contracts. The requested full keyboard acceptance remains failed in both sets of states.

| Follow-up | Executed probes | Passed | Flagged | Footer reachable |
| --------- | --------------: | -----: | ------: | ---------------: |
| 390       |             240 |    174 |      66 |              240 |
| 320       |             240 |    148 |      92 |              240 |
| text200   |              34 |     30 |       4 |               34 |

These follow-ups expose the actual ECMO footer, freshly focus the last enabled task control, then reverse-Tab when that control is unobscured. The phone runs cover every task; the enlarged-text follow-up revisits the initial task in every entry to resolve the earlier same-focus sampling issue. Existing raw candidates remain available. These are technical probe counts, not learner scores.

## PRE-EXISTING / UNRELATED DEBT

- The same three shared Jest failures recorded by G02 and ECMO-LAYOUT-01 recur: CRRT circuit accessible-name expectation (`accessibility.test.tsx`), obsolete CRRT challenge ordering (`curriculum-sequencing.test.tsx`) and the cross-module static-copy scanner (`learner-copy.test.ts`). They remain unsuppressed. No ECMO engine/route test failed.
- `ModuleProgressToggle.tsx:33` retains the shared `react-hooks/set-state-in-effect` warning. That file is unchanged from historical baseline `9ef04539`. Strict lint remains red; it is not reported as a pass.
- The shared `cardiohelp-i-us-2025` manufacturer-attribution discrepancy and dormant score/mastery compatibility debt remain as recorded in ECMO-03/G02. Neither was repaired or reinterpreted here.
- The unrelated BBT access-contract failure remains carried forward from the original G02/integration evidence, **not rerun** as an ECMO check.

The new compact and enlarged-text focus findings are ECMO in-scope work, not hidden in this unrelated-debt list. The intermittent browser result is recorded separately above because its pre-existing status/cause was not established.

## HUMAN REVIEW HOLDS

- All **ten ECMO-03 claim decisions remain NOT REVIEWED**, with null reviewer, role, date and reviewed-content-version fields. No clinical/device/source review status or publication flag changed.
- Current U.S. IFU currency, exact alarms/device behavior, emergency instructional order and air-resumption abstraction still require attributable faculty/device review. No local institutional protocol was obtained or approved.
- Textbook/guidance identity, currency and claim support; supplied case-curriculum status; the ambiguous ELSO-endorsed source-title item; and existing media-rights/source follow-ups remain held.
- Faculty decisions on the PaCO₂ floor, saturation ceiling, recirculation curves and optional-question teaching value remain pending. Agreement between displayed copy and the current model is technical evidence only.
- [ECMO-03's observation guide](ECMO-03-observation-guide.md) still says **prepared, not run**. These automated/assistant checks do not fill learner/facilitator records or replace owner retest.
- No publication or limited-preview authorization is created by this addendum. Draft/unlisted state remains authoritative.

## NOT RUN

- Native browser zoom, screen-reader certification, Safari/Firefox, physical mobile devices or hardware/device validation. The enlarged-text run was exactly `html { font-size: 200% !important; }`; it is not native browser zoom.
- Missing-asset injection separate from the unavailable-WebGL fallback, native graphics context loss/recovery, every console safety chord or every clinical case as a complete management journey.
- Live authenticated account synchronization, real learner records, production network/database operations, Supabase/upload scripts, deployments or publication. Account evidence is mocked regression coverage and isolated browser storage.
- Whole-repository Jest/lint or a new full historical-baseline build. Existing baseline classifications remain historical evidence; this run used current merged main.
- New clinical/device/source-currency adjudication, rights clearance, actual learner observations or faculty/owner usability retests.

## Handoff and replay

Commands ran from the supplied ECMO worktree; output paths below refer to the evidence directory above. No test used zero discovered tests as acceptance evidence.

```sh
git fetch origin
git switch -c codex/ecmo-g02-post-repair origin/main
npm run build
NODE_OPTIONS=--max-old-space-size=8192 npm run type-check
node node_modules/jest/bin/jest.js src/features/cardiohelp-ecmo src/features/critical-care src/features/learning-module 'src/app/\[locale\]/cardiohelp-ecmo' src/app/api/critical-care/progress --runInBand --json --outputFile="$EVIDENCE/jest.json"
node node_modules/eslint/bin/eslint.js src/features/cardiohelp-ecmo src/features/critical-care src/features/learning-module 'src/app/[locale]/cardiohelp-ecmo' src/app/api/critical-care/progress --max-warnings=0
NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3148
ECMO_LAYOUT_BASE_URL=http://127.0.0.1:3148 PLAYWRIGHT_JSON_OUTPUT_NAME="$EVIDENCE/layout-regression.json" node node_modules/@playwright/test/cli.js test --config=playwright.ecmo-layout.config.ts --reporter=json --output="$EVIDENCE/test-results"
```

`EVIDENCE` denotes the absolute evidence directory, not a repository input. `prepare.cjs` generates the live inventory/manifest. `independent-layout.cjs` accepts `1600`, `1440`, `1024`, `390`, `320`, `text200`. `invariants.cjs` was run for `routes`, `flows`, `content`, `legacy`, `review`, `fallback`. Additional scripts cover expanded/guided states, settled motion, task-footer/focus and the isolated reverse-Tab reproduction. First attempts and follow-ups have separate result files; no application edits were made between them.

**Behavior/test contracts:** this addendum changes no behavior or assertion. [ECMO-01's test contracts](ECMO-01-test-contracts.md), the historical-data boundary and ECMO-LAYOUT-01's scroll-owner contract remain intact. The applicable structured-module review passes physical reading/header preservation and scope isolation; its keyboard requirement fails in the demonstrated compact and enlarged-text focus states. Superseded exam/mandatory-pane rules were not reinstated.

**Question ledger:** no questions added, removed, rewritten, combined or re-keyed. [ECMO-01's ledger](ECMO-01-question-ledger.md) and ECMO-03's scoped feedback dispositions remain authoritative.

**Bounded recommendation:** preserve the validated scrolling/header repair and the original G02 history. Resolve/retest the demonstrated keyboard-focus defects before calling the entire requested technical matrix PASS. Keep all clinical/device/human holds. This task ends with one report-only PR; no merge, deployment, publication, Device Intelligence work or clinical-status change is authorized by this report.
