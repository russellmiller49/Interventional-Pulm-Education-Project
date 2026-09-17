# PI-HELP-01 — Peripheral Imaging Help presentation

September 17, 2026. Bounded developer implementation and browser QA; no human review or clinical approval is claimed.

**PI_HELP_REPAIR_VERIFIED.** The scoped repair and executed regressions pass. This does not accept G02, clear the retained PI-local 3D-label issue, or replace any human-review hold.

## Baseline and scope

The initial branch was `codex/g02-pi-post-wrap-validation`. After fetching, HEAD, its upstream and `origin/main` all resolved to `24e42c6e30402fdc39837b8986ad56386efe8754`, the merged PI-WRAP-01 baseline. The only pre-existing dirty path was the untracked `docs/gap-remediation/self-paced/G02-PI-04-stop-report.md`. The dedicated repair branch is `codex/pi-help-01`, created from that `origin/main`.

The original stop report remains unedited and untracked; it is not part of this repair PR. Its SHA-256 remains `d82c947d70cd9af2078454da27835da145d2e27f5d393fc232ff44b1095c29a9`. The original evidence remains in Local-Data at `renders/output/g02-pi-continuation-2026-09-16-24e42c6e/`. This handoff does not rewrite the earlier stop as an implemented or accepted repair.

The v2 self-paced contract and [PI-01 preservation record](PI-01-handoff.md), [PI-02 holds](PI-02-handoff.md), [PI-FOCUS-01](PI-FOCUS-01-handoff.md), [PI-OUTLINE-01](PI-OUTLINE-01-handoff.md) and [PI-WRAP-01](PI-WRAP-01-handoff.md) remain authoritative. No PI-03 or full G02 continuation was undertaken.

## Changed files

| Path                                                                       | Change                                                                                                                                                                |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/peripheral-imaging/components/stage/imaging-flow.module.css` | Twenty added lines: a dialog-only token adapter and wrapping header rules. All pre-existing rules are byte-for-byte preserved.                                        |
| `e2e/peripheral-imaging.spec.ts`                                           | Nine additional Help regressions and their measurement helpers. The original test file is preserved as an exact prefix; no earlier assertion was weakened or removed. |
| `docs/gap-remediation/self-paced/PI-HELP-01-handoff.md`                    | This implementation, evidence and stopping-boundary record.                                                                                                           |

No component, shared stylesheet, theme definition, dependency, source/media asset, question, simulation engine, progress adapter, legacy-storage implementation, Device Intelligence file or release configuration changed.

## Confirmed cause and bounded repair

The actual `ImagingStageHost` renders the shared `HelpDialog` inside `ImagingActivityShell`'s `[data-imaging-flow]` section. Browser checks confirm that ancestry and native `:modal` status. There is no portal: the native top layer changes painting, not DOM inheritance.

Shared `lesson-shell.module.css` consumes `--stage-panel`, `--stage-ink`, `--stage-line` and `--stage-type-floor` in Help. Normally the shared `.shell` defines them, but PI's flow does not use that shell. Before the repair, the panel token was empty, background resolved transparent and the border resolved to 0 px. PI already supplies `--panel: #10262b`, `--ink: #eaf4f4` and `--line: rgba(163, 206, 209, .22)` through its module root. Those three tokens are now aliased only on PI's Help dialog. The type token is `1rem`, preserving Help's actual pre-repair 16/32 px body text; it does not reduce enlarged text to the shared shell's smaller floor.

The shared header is flex without wrapping. In combination with inherited `overflow-wrap:anywhere`, its title and button previously shrank into narrow columns. The PI-scoped container of the semantic `h2` now permits flex wrapping, and the button immediately following that heading cannot shrink. These selectors use the existing Help data marker and semantic elements; they do not depend on generated class names, child indexes or a new component API. The normal desktop row stays a row. PI's general text wrapping and native dialog scrolling remain intact.

The current PI module intentionally uses its dark palette in both light and dark site themes. Both site-theme states were exercised; the Help panel uses that same PI palette in each. No global theme, shared Help implementation, font size, clipping rule or content was changed to obtain the result.

## Before and after

Both baseline conditions were reproduced twice on `/en/peripheral-imaging/learn?section=projection` before the CSS edit. The two new regression cases also failed against that unchanged application for the expected missing-token, opacity, heading-word and Close-line assertions. The before runs completed their dismissal/state assertions without a separate behavioral failure.

| Measurement                    | Before                                                            | Repaired                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Desktop 1440 × 1000 background | `rgba(0, 0, 0, 0)`; underlying lesson text visibly showed through | Opaque `rgb(16, 38, 43)`; inspected screenshot shows no lesson text through the panel                                           |
| Foreground / border            | Inherited readable ink; missing border token, 0 px border         | `rgb(234, 244, 244)` ink; PI line color, 1 px border                                                                            |
| Desktop heading and Close      | Heading 162.42 × 28.80 px; Close 65.17 × 44 px; both one line     | Same heading and button dimensions; same row                                                                                    |
| 320 × 740, root 32 px: dialog  | x=35, y=35, 250 × 670 px                                          | Same outer rectangle; entirely inside the viewport                                                                              |
| Enlarged heading               | 70.77 × 345.56 px, six text lines; words split                    | 174.41 × 115.19 px, two text lines; every heading word intact; full header width                                                |
| Enlarged Close                 | 73.64 × 257.98 px, five individual-letter lines                   | 128.33 × 78.80 px, one intact word below the heading, no overlap                                                                |
| Help body font                 | 16 px normal / 32 px enlarged                                     | Unchanged 16 / 32 px                                                                                                            |
| Enlarged dialog content        | Tall native scrolling dialog                                      | 3280 px scroll height / 668 px client height; 61 text-range fragments tested, zero horizontal clipping or unreachable fragments |

Text-only enlargement sets the root font to 200% (32 px). The CSS-zoom condition separately sets `html { zoom: 2 }` with a 16 px root font. Neither is native browser zoom.

## Browser regression method

The nine new browser cases cover the eight required conditions plus the existing longer `projection:guided` Help in both site themes. Its authored title/instruction total 204 characters versus 150 for the initial reading step, and it includes the real “Show me where” action. No teaching content or learner answer is invented for these checks.

Measurements wait for fonts and four consecutive stable animation frames, including dialog geometry and scroll position. They assert native modal status, real PI DOM ancestry, resolved panel/foreground/border, unchanged typography, intact word ranges, one-line Close, header separation, viewport containment, and no added document or dialog width. A text-node walker measures each line with DOM Range geometry and scrolls the actual dialog to establish that every line can be reached vertically. It accounts for CSS zoom when comparing client dimensions to rendered rectangles. Hit tests confirm that reached text is on the modal surface. This is stronger than checking a border box or merely saving a screenshot; it is still a bounded developer check, not accessibility-wide approval.

Each matrix case opens from the real Help control using Enter, verifies Close receives focus, closes with the keyboard, reopens and closes with a pointer, then reopens and dismisses with Escape. Focus returns to Help each time. URL, active lesson step, all local-storage values, and rendered input/select values are compared before and after every dismissal. The longer instance verifies real Tab to “Show me where” and Shift+Tab back to Close, with the focused control visible and operable. The shared interaction code is unchanged.

## Eight-condition preservation matrix

The reused focus/outline harness completed a fresh full run with **8/8 passes and zero page errors**. In every condition, three real Tab traversals reached the slider with its 3 px outline and 4 px offset visible inside the measured usable band; five-point hit tests found no covering chrome. A separate calculation over all 24 saved traversals confirms the full outline plus offset fits on every side: 7 rendered px normally and 14 rendered px under CSS zoom 2 (`focus-ring-check.json`). ArrowRight, ArrowLeft and Home retained their behavior. The outline stayed contained, wheel scrolling stayed inside the panel, all 19 links were keyboard reachable, and Shift+Tab, Escape, click-away and final-section navigation passed. Desktop chrome stayed pinned only where the existing repair allows it.

| Viewport and condition      | Focus | Outline | Help | Document width with Help                 |
| --------------------------- | ----- | ------- | ---- | ---------------------------------------- |
| 1440 × 1000, normal         | PASS  | PASS    | PASS | 1440 px                                  |
| 1440 × 1000, root text 200% | PASS  | PASS    | PASS | 1440 px                                  |
| 1440 × 1000, CSS zoom 2     | PASS  | PASS    | PASS | 1449 px, unchanged known shared overflow |
| 900 × 1000, root text 200%  | PASS  | PASS    | PASS | 900 px                                   |
| 390 × 844, normal           | PASS  | PASS    | PASS | 390 px                                   |
| 390 × 844, root text 200%   | PASS  | PASS    | PASS | 390 px                                   |
| 320 × 740, normal           | PASS  | PASS    | PASS | 320 px                                   |
| 320 × 740, root text 200%   | PASS  | PASS    | PASS | 320 px                                   |

An earlier matrix attempt passed the first three conditions, then its evaluation context was destroyed by navigation while the local build was regenerating assets. That incomplete attempt is retained as `interrupted-regressions.*`; it is not counted as the final matrix. After the build finished, the entire eight-condition harness was rerun successfully. No application edit, weakened assertion or automatic test retry was used to resolve the interruption.

## PI-WRAP-01 preservation

The existing exact probe was rerun at 320 × 740 with a 32 px root font for **projection and dts-acquisition**:

- All 19 outline links per section were reached by keyboard and their text ranges checked against all four panel edges: **zero clipped labels** in both sections.
- Teaching has a 190 px grid track inside its 190 px container; Sources has a 198.406 px track inside its 198.406 px container. Both sections have zero horizontally clipped or out-of-viewport text ranges in these surfaces.
- The document is exactly **320 px** wide in both sections. `superimposition` breaks across lines in projection instead of setting excess min-content width.
- The pre-existing `overflow-wrap:anywhere` rule is unchanged. The Help adapter does not apply to Teaching, Sources, the outline, or focus/outline hooks.

## Executed verification

Commands ran from the repair worktree using anonymous `http://127.0.0.1:3150` preview, deliberately invalid preview Supabase values, and no sign-in, stored secrets, `.env.local` edits or paid model calls. Runtime: Playwright 1.62.0, Chrome for Testing 151.0.7922.34, Node 26.5.0. Custom probes block external browser requests and fulfill local APIs with 401; the existing PI suite uses the local server's anonymous responses. Production build compilation is a local artifact check, not deployment or production-host testing.

| Check                                                               | Actual result from this task                                                                         |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Reused `help-repro.cjs` before edit                                 | Expected defect reproduced in 4/4 fresh contexts; screenshots inspected                              |
| New desktop/narrow regressions before edit                          | Expected 2/2 failures on the known defect; log retained                                              |
| New Help regression subset                                          | 9/9 passed                                                                                           |
| Full PI browser suite                                               | 31/31 passed, no skipped tests, 3.8 minutes; original 22 plus 9 new                                  |
| PI/shared-learning/PI-route Jest                                    | 50 suites, 412 tests passed, 0 snapshots                                                             |
| Exact `reflow.cjs` probe                                            | Both sections passed, including all 38 outline-link visits                                           |
| `npm run type-check`                                                | Exit 0                                                                                               |
| `npm run lint`                                                      | Exit 0; 0 errors, 14 warnings in unchanged source files (10 effect/setState, 4 img-element warnings) |
| Focused E2E-file ESLint; Prettier                                   | Exit 0; both edited code files formatted                                                             |
| `npm run build` with invalid preview environment and 8 GB Node heap | Exit 0 through standalone preparation                                                                |
| `git diff --check`; preservation comparison                         | Passed; original CSS rules, original browser assertions and original stop-report hash preserved      |

Build warnings in this run: two embedded-build large-chunk notices; Node `module.register()` deprecation; Mermaid dependency extraction; unset `metadataBase`. Jest reports Node's experimental localStorage warning; Playwright reports the NO_COLOR/FORCE_COLOR warning. These are retained in logs, not suppressed or repaired.

Reproducible main commands:

```sh
node node_modules/jest/bin/jest.js src/features/peripheral-imaging src/features/learning-module 'src/app/\[locale\]/peripheral-imaging' --runInBand
PERIPHERAL_IMAGING_BASE_URL=http://127.0.0.1:3150 node node_modules/@playwright/test/cli.js test --config=playwright.peripheral-imaging.config.ts
NODE_OPTIONS=--max-old-space-size=8192 npm run type-check
npm run lint
NEXT_PUBLIC_SUPABASE_URL=https://pi-help-01-invalid.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=pi-help-01-preview-invalid NODE_OPTIONS=--max-old-space-size=8192 npm run build
git diff --check
```

## Retained findings and human holds

The following G02-PI-04 classifications remain open. They were not repaired, waived or converted into passes by this slice:

| Finding                                                          | Retained classification                                                                                        |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Shared learning-module-v2 navigation/title overflow and ellipsis | Known shared presentation failure affecting PI consumers                                                       |
| Suite-scene 3D labels under injected CSS zoom 2                  | Known **PI-local** visualization failure; separate bounded suite review required; native zoom remains untested |
| Shared footer overflow under CSS zoom 2                          | Known shared footer/chrome failure; Help adds no width, which does not clear the existing width                |
| Inaccurate `--site-header-height`                                | Known shared infrastructure inaccuracy; PI's measured focus/outline protection remains required                |
| SVG diagram text                                                 | Prior clipping inference **not reproduced**; no SVG fix or new approval claimed                                |

**Technical validation does not replace learner, technologist, clinical-language, source or media review.** All PI-02 holds remain unchanged: approximately 3–5 actual learner observations and factual completed forms/retests; technologist pre-walk and suite/control wording; faculty review of `choose-1`, the safety-decision label, `case-3`, draft teaching/items; physician review of skip/explanation/completion/hub wording; attributable source, clinical and media-rights decisions; Spanish/Simplified Chinese review and translation after clinical review; owner recruitment, permissions/recording and private observation storage; and the publication decision. Research generalization retains its separate protocol/review requirement.

## Structured-module acceptance within this slice

| Rule                        | Scoped disposition                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| H1 curriculum/entry         | NOT APPLICABLE to the Help CSS repair; routes and registry unchanged                                                 |
| H2 pedagogy                 | BLOCKED for human acceptance by the unchanged PI-02 observation/content holds                                        |
| H3 shared stage             | PASS: existing shared Help reused without modification or a fork                                                     |
| H4 current task             | PASS for Help: actual active-step text retained, real Help/Close controls tested                                     |
| H5 rendered content         | PASS for Help: opaque readable surface, text-range reachability and inspected screenshots                            |
| H6 activity/completion      | PASS for preservation: unchanged implementation and passing existing PI regressions; no mastery claim                |
| H7 answer/feedback behavior | PASS for preservation: existing relevant unit/browser checks pass; no question or answer code changed                |
| H8 fidelity                 | PASS for technical preservation only; source/media/clinical validation remains on human hold                         |
| H9 progress                 | PASS for preservation: every Help dismissal keeps step, controls and storage identical; existing progress tests pass |
| H10 clinical language       | BLOCKED for human approval; no wording edits or inferred language approval                                           |
| H11 scope/release           | PASS: PI Help CSS, focused tests and this handoff only; draft/unlisted state unchanged                               |
| H12 rendered verification   | PASS for the executed Chromium conditions only; broader validation limits below                                      |

## Evidence and limits

New private/browser evidence is outside Git under:

`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/pi-help-01-2026-09-17-24e42c6e/`

The bundle contains the reused probes, before/after screenshots, JSON text/geometry results, complete test/build/lint logs, and a checksum manifest. Browser screenshots and local learner fixtures are not committed.

All **138** files covered by the original G02-PI-04 evidence checksum manifest were verified unchanged. That evidence was read in place and was not overwritten.

Inspected images include both `help-defect-*-run2.png` baselines; all eight `browser-help/**/help-top.png` states; the 320/200% `help-bottom.png`; longer-content light-theme bottom and dark-theme top; desktop and narrow enlarged-text focus, enlarged desktop and narrow outlines, narrow projection outline/Sources, and DTS Teaching. The panel pixels are opaque, Close stays a word, and tall content is available through scrolling. The per-line assertions establish reachability beyond the particular scroll positions pictured.

**Not executed:** the separate full G02 journey program or final acceptance continuation; all-repository unit tests; native browser zoom; Safari/Firefox; physical-device or assistive-technology sessions; authenticated/backend or production-host browser checks; actual learner, technologist, faculty, source, language, translation or media review. The required existing PI browser suite was run; that does not substitute for the separate G02 program.

No merge, publication, deployment or PI-03 work is authorized by this handoff. The next task after a verified and reviewed repair is **independent G02 continuation against the reviewed repair baseline**, not a final G02 acceptance claim from this repair run.
