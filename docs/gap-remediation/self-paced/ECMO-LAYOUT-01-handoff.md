# ECMO-LAYOUT-01 — post-G02 owner-discovered Learn layout defect

## Authority, baseline, and reproduction

The owner reported this defect **after G02 merged**. The [G02 report](G02-ECMO-final-technical-report.md) is historical evidence; its “none demonstrated” finding is superseded by this later reproduction, not rewritten. Its file is unchanged. Read together with G02.md from the v2 action pack, [ECMO-01](ECMO-01.md), [ECMO-02](ECMO-02-handoff.md), [ECMO-03](ECMO-03-handoff.md), [ECMO-HONESTY-02](ECMO-HONESTY-02-handoff.md), and [INTEGRATION-01](INTEGRATION-01-report.md).

Started clean in the supplied fresh `codex-ecmo-layout-01` worktree. Fetched `origin/main` and created `codex/ecmo-layout-scroll` at **112a20c9e5ec747e4374efa3d236494f99a5622b**, the merged G02 PR #232. No shared/global production file, Device Intelligence file, clinical text, equation, model, scenario, interlock, question, section order, progress/storage, source/review metadata, clinical/device hold, or release state changed.

The owner's pasted reproduction described inaccessible expanded delivery arithmetic/model detail and activity chrome hidden above “Follow the blood.” No owner image files were attached. Fresh Chromium screenshots corroborate those descriptions; they are agent captures, not owner-supplied images or human usability observations.

Evidence is retained under `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/ecmo-layout-01-2026-09-16/`. It includes the original probe, 102 before samples, disclosure reproduction, production browser JSON with 204 full ancestry/rectangle snapshots, screenshots, test/build logs, and the command record. No raw authoring material is committed.

## Inventory — actual current architecture

**30 distinct sections, 34 track-specific entries, 240 authored tasks. Every current task selects FLOWING, `data-flowing=true`.** The four presentation kinds are concept, circuit-walk, comparison-lab, and guided-device. Some flowing activities contain two content columns; they are still a single reading flow. No current Learn route selects the fixed three-pane fallback. In particular, **“Follow the blood” is flowing**, as are the later VV, VA, and control-heavy sections.

The [machine-readable inventory](ECMO-LAYOUT-01-inventory.json) records every task ID/title/phase/presentation, initial task, prior/corrected owners, disclosures, automatic focus, and per-section results at all six viewports. `scripts/critical-care/ecmo-layout-inventory.mts` derives it from the current pathway and stage adapters; it does not author another curriculum.

In this table, **F / true** means flowing with `data-flowing=true`; **Fail → Pass** covers header visibility and full reading reach before/after. Every row has the same owner transition: **intended document / no working wheel or PageDown owner → desktop ECMO shell; compact document**. Every row moves focus on task entry and uses the bounded helper. Disclosure counts are native `details` present at the initial task, including outline/sources; per-task content can add more.

| Track | Section ID and title                                                                                  | Initial task                                       | Tasks | Mode / attribute | Reach / header | Details |
| ----- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----: | ---------------- | -------------- | ------: |
| VV    | `why-extracorporeal-support` — Why extracorporeal support exists                                      | `why-extracorporeal-support-recognize`             |     5 | F / true         | Fail → Pass    |       7 |
| VV    | `circuit-flow-path` — Drainage → pump → membrane lung → return: a walk round the circuit              | `circuit-flow-path-recognize`                      |     6 | F / true         | Fail → Pass    |       9 |
| VV    | `pump-and-pressure-zones` — The pump, and the pressures either side of it                             | `pump-and-pressure-zones-recognize`                |     7 | F / true         | Fail → Pass    |      10 |
| VV    | `blood-flow-versus-sweep` — The control panel: the three things you can change                        | `blood-flow-versus-sweep-recognize`                |     8 | F / true         | Fail → Pass    |       5 |
| VV    | `vv-normal-state` — A stable VV run: the baseline you read everything against                         | `vv-normal-state-recognize`                        |     6 | F / true         | Fail → Pass    |       7 |
| VV    | `vv-series-physiology` — In series with the heart: what the flow number counts                        | `vv-series-physiology-recognize`                   |     6 | F / true         | Fail → Pass    |       6 |
| VV    | `startup-sensor-orientation` — Meet the console, the circuit, and the external controls               | `startup-orient-domains`                           |    18 | F / true         | Fail → Pass    |      12 |
| VV    | `preload-drainage-collapse` — Drainage insufficiency: falling flow and line chatter                   | `preload-drainage-collapse-observe`                |     7 | F / true         | Fail → Pass    |      14 |
| VV    | `afterload-return-obstruction` — Return obstruction: rising post-pump pressures                       | `afterload-return-obstruction-observe`             |     6 | F / true         | Fail → Pass    |       7 |
| VV    | `afterload-oxygenator-resistance` — Oxygenator resistance: a widening pressure gradient               | `afterload-oxygenator-resistance-observe`          |     6 | F / true         | Fail → Pass    |       7 |
| VV    | `vv-recirculation` — VV recirculation: circuit flow and patient oxygenation                           | `vv-recirculation-observe`                         |     6 | F / true         | Fail → Pass    |      13 |
| VV    | `acute-hypercapnia` — Acute hypercapnia: sweep and the acid–base picture                              | `acute-hypercapnia-observe`                        |     6 | F / true         | Fail → Pass    |       5 |
| VV    | `compensated-hypercapnia` — Compensated hypercapnia: interpreting CO₂ with pH                         | `compensated-hypercapnia-observe`                  |     6 | F / true         | Fail → Pass    |       5 |
| VV    | `gas-source-interruption` — Sweep-gas interruption: gas transfer with stable blood flow               | `gas-source-interruption-observe`                  |     6 | F / true         | Fail → Pass    |      12 |
| VV    | `arterial-bubble-stop` — Bubble alarm: the pump stopped itself                                        | `arterial-bubble-stop-observe`                     |     9 | F / true         | Fail → Pass    |      12 |
| VV    | `transport-power-loss` — Power loss during transport: battery support                                 | `transport-power-loss-observe`                     |     6 | F / true         | Fail → Pass    |       6 |
| VV    | `vv-integration-capstone` — One presentation, four explanations: flow unchanged, patient worse        | `vv-integration-capstone-recognize`                |     6 | F / true         | Fail → Pass    |       6 |
| VA    | `why-extracorporeal-support` — Why extracorporeal support exists                                      | `why-extracorporeal-support-recognize`             |     5 | F / true         | Fail → Pass    |       7 |
| VA    | `circuit-flow-path` — Drainage → pump → membrane lung → return: a walk round the circuit              | `circuit-flow-path-recognize`                      |     6 | F / true         | Fail → Pass    |       9 |
| VA    | `pump-and-pressure-zones` — The pump, and the pressures either side of it                             | `pump-and-pressure-zones-recognize`                |     7 | F / true         | Fail → Pass    |      10 |
| VA    | `blood-flow-versus-sweep` — The control panel: the three things you can change                        | `blood-flow-versus-sweep-recognize`                |     8 | F / true         | Fail → Pass    |       5 |
| VA    | `va-normal-state` — A stable VA run: VV plus two ideas                                                | `va-normal-state-recognize`                        |     6 | F / true         | Fail → Pass    |       8 |
| VA    | `va-parallel-physiology` — In parallel with the heart: who fills the aorta                            | `va-parallel-physiology-recognize`                 |     6 | F / true         | Fail → Pass    |       7 |
| VA    | `va-startup-sensor-orientation` — Meet the console on a VA circuit                                    | `va-startup-orient-domains`                        |    18 | F / true         | Fail → Pass    |       6 |
| VA    | `va-preload-drainage-collapse` — VA drainage insufficiency: falling flow and pressure                 | `va-preload-drainage-collapse-observe`             |     7 | F / true         | Fail → Pass    |       7 |
| VA    | `va-afterload-arterial-return-obstruction` — VA arterial return obstruction: rising circuit pressures | `va-afterload-arterial-return-obstruction-observe` |     6 | F / true         | Fail → Pass    |       7 |
| VA    | `va-afterload-oxygenator-resistance` — VA oxygenator resistance: a widening pressure gradient         | `va-afterload-oxygenator-resistance-observe`       |     6 | F / true         | Fail → Pass    |       7 |
| VA    | `va-differential-hypoxemia` — Differential hypoxemia: right-arm and femoral oxygenation               | `va-differential-hypoxemia-observe`                |     6 | F / true         | Fail → Pass    |      12 |
| VA    | `va-lv-loading` — VA left ventricular loading: interpreting low pulsatility                           | `va-lv-loading-observe`                            |     6 | F / true         | Fail → Pass    |       6 |
| VA    | `va-acute-hypercapnia` — Acute hypercapnia on VA: sweep and patient reassessment                      | `va-acute-hypercapnia-observe`                     |     6 | F / true         | Fail → Pass    |       5 |
| VA    | `va-gas-source-interruption` — VA sweep-gas interruption: gas transfer with stable flow               | `va-gas-source-interruption-observe`               |     6 | F / true         | Fail → Pass    |       6 |
| VA    | `va-arterial-bubble-stop` — Bubble alarm on VA: the pump stopped itself                               | `va-arterial-bubble-stop-observe`                  |     9 | F / true         | Fail → Pass    |       6 |
| VA    | `va-transport-power-loss` — VA power loss during transport: battery support                           | `va-transport-power-loss-observe`                  |     6 | F / true         | Fail → Pass    |       6 |
| VA    | `va-integration-capstone` — The same unchanged flow, with a second circulation to blame               | `va-integration-capstone-recognize`                |     6 | F / true         | Fail → Pass    |      10 |

## Root causes and corrected contracts

1. **Flowing content escaped the bounded activity contract.** Feature-local `:has([data-flowing])` overrides made the module and shared frame auto-height/visible overflow, while `EcmoActivityShell` became a block with visible body overflow. Global desktop activity mode still set `body` and `#main-content` to hidden overflow. Growing disclosures therefore had no usable vertical scroll owner. All **102/102** baseline section/viewport samples had clipped headers, and none changed document scrollTop under wheel input.
2. **Automatic scrolling moved locked ancestors.** The flow branch of `scrollTaskPaneToTop` called `scrollIntoView`. Hidden overflow does not prevent programmatic scrolling: task focus shifted the document and sometimes hidden containers, placing the activity header/context above or beneath the sticky site header. “Follow the blood” began with the current task visible while the ECMO section header was above it and inaccessible to ordinary scrolling.
3. **The site-header token is not an invariant under reflow.** At 1600×900, 1440×900, and 1024×768 the actual site header and token both resolve to **81 px**. That mismatch is **not** the ordinary desktop cause. At 320/390 px the actual header is **73 px**, versus the token's **65 px**. At 1440×900 with `html { font-size: 200% }`, navigation wraps to **297 px**, versus the token's **161 px**. ECMO now measures that actual header through a local ResizeObserver and scopes the corrected variable to its own module frame. No arbitrary header offset and no global-token rewrite.

Desktop flowing lessons now retain the existing shared activity frame's viewport bounds. **The ECMO shell itself is the sole vertical reading scroller**, with native overflow, reserved scrollbar space, a keyboard focus stop and focus outline. The entire activity header, body and sources/footer belong to that scroll surface. Its header can scroll away during ordinary reading and is recoverable by scrolling to the top; task changes restore it. It is not a second fixed three-pane layout. Operational strips stick at zero inside this scroller. At compact/short viewports, the shell flows visibly and the document remains the owner.

The **fixed fallback** retains its grid and the actual `ResizableTeachingWorkspace`: Steps, Teaching and Simulator each own scrolling on desktop; compact tabs preserve access. The shared component already gives its regions `overflow:auto`, zero minimum height and keyboard focus. The ECMO CSS selector `[data-scroll-pane]` is unused by the current shared markup; it was not mistaken for proof that the panes work. Actual shared-region browser tests establish the contract. None of the current sections was converted to that fallback to satisfy a test.

`scrollTaskPaneToTop` now resets only the nearest scrolling pane/shell. Its document fallback is allowed only at the existing reflow breakpoint and when the body is unlocked; it measures the site header. Guided-control, circuit-map, walk-heading and comparison-result calls use `preventScroll` plus the bounded target helper. The latter accounts for the actual sticky strip/pane caption. Current Learn code no longer uses multi-ancestor `scrollIntoView` for these operations. Practice-specific calls remain outside this repair; shared dialog/source focus stays within the bounded surface.

## Measured before/after geometry

All dimensions are CSS pixels. Each ordinary desktop site-header rectangle is `(0,0,width,81)`. Module, shared activity frame, and ECMO shell have the same listed top/height; full individual rectangles, context strip, shell body/workspace and every ancestor's clientHeight, scrollHeight, scrollTop, overflow and overflow-y are in `before.json` and `after-geometry.json`. Pane entries are null on real Learn routes because no fixed workspace renders there.

| Viewport | Representative section       | Before shell top / height | After shell top / height | Document scrollTop before → after |
| -------- | ---------------------------- | ------------------------: | -----------------------: | --------------------------------: |
| 1600×900 | `why-extracorporeal-support` |              0.0 / 1190.5 |             81.0 / 819.0 |                            81 → 0 |
| 1600×900 | `circuit-flow-path`          |            -42.0 / 2145.8 |             81.0 / 819.0 |                           123 → 0 |
| 1600×900 | `startup-sensor-orientation` |            -72.0 / 8844.5 |             81.0 / 819.0 |                           153 → 0 |
| 1600×900 | `va-lv-loading`              |            -72.0 / 3498.1 |             81.0 / 819.0 |                           153 → 0 |
| 1440×900 | `why-extracorporeal-support` |              0.0 / 1190.5 |             81.0 / 819.0 |                            81 → 0 |
| 1440×900 | `circuit-flow-path`          |            -54.0 / 2157.2 |             81.0 / 819.0 |                           135 → 0 |
| 1440×900 | `startup-sensor-orientation` |            -72.0 / 8844.5 |             81.0 / 819.0 |                           153 → 0 |
| 1440×900 | `va-lv-loading`              |            -72.0 / 3498.1 |             81.0 / 819.0 |                           153 → 0 |
| 1024×768 | `why-extracorporeal-support` |            -48.0 / 1293.5 |             81.0 / 687.0 |                           129 → 0 |
| 1024×768 | `circuit-flow-path`          |            -91.0 / 3169.8 |             81.0 / 687.0 |                           172 → 0 |
| 1024×768 | `startup-sensor-orientation` |           -121.0 / 8351.7 |             81.0 / 687.0 |                           202 → 0 |
| 1024×768 | `va-lv-loading`              |           -121.0 / 4200.5 |             81.0 / 687.0 |                           202 → 0 |

At 1600×900 before repair, the first section's shell grew from **1190.5 px** collapsed to **1997 px** with arithmetic and **2540 px** with both disclosures. Wheel and PageDown did not make it readable. After repair the shell stays **819 px** high while its scrollHeight grows. At 200% text, the corrected shell is **top 297 / height 603**, ending exactly at viewport bottom 900. The ordinary 1920×1080 shell is **top 81 / height 999**; 1024×768 is **top 81 / height 687**. Compact shells are content-height and their initial top is **73**.

The ancestry probe recorded changes after wheel/PageDown aimed at the reading area, not a separate wheel hit-test over every non-scrolling ancestor. The browser tests independently target each actual fixed pane and verify document stability. This distinction avoids attributing a scroll owner merely from `scrollHeight > clientHeight`.

## Executed browser checks

Real Chromium, with local API responses isolated and external network calls blocked. Before evidence uses current-main webpack development mode; final evidence uses the successful production build. No retry turns a failed run green.

- **17/17 production Playwright tests passed**, zero skipped/flaky tests: all 34 entries at **1920×1080, 1600×900, 1440×900, 1024×768, 390×844, 320×844**. Each deep link establishes the expected task, complete activity header, valid scroll owner, wheel and PageDown operation, bottom/top reach and absence of horizontal page overflow.
- **All 240 tasks**: 34 initial tasks plus 206 subsequent selections at 1440×900; each task change restores the header, bottom content is reachable, and the desktop document remains at zero.
- First section, **1600/1440/1024/390/320 × 900**: arithmetic, every exposed slider changed by keyboard, model detail, both disclosures, bottom/Continue, closing both, next task/back, and reload. Visible focus and reachable controls are checked.
- **200% CSS text enlargement**, 1440×900: first section, circuit walk, later VV recirculation, VA ventricular loading, and live console orientation. It is CSS text enlargement, not native browser zoom.
- “Follow the blood”: actual guided walk progression; console orientation: actual “Show me where” control focus. Both reveal their targets without shifting the desktop document. Resetting the reading surface restores activity chrome.
- Fixed fallback: the **real StageLayout, EcmoActivityShell, CSS, ResizableTeachingWorkspace and scroll helper** mount in an explicitly synthetic overflow fixture inside cloned real activity wrappers. At **1600 and 1024**, each of Steps/Teaching/Simulator independently scrolls by wheel and PageDown, reaches its bottom button, and resets without moving siblings/document. At **390**, compact tabs and keyboard focus reach each pane's bottom. This is fallback evidence, not a claim that three panes rendered in VV/VA sections.
- Agent visual inspection: before “Follow the blood,” after desktop headers, enlarged navigation, and 320-px expanded content/Continue. Screenshots are in the evidence folder. No human learner session is claimed.

The same new header/reading regressions were also run against an isolated archive of merged main: **3/3 selected tests failed**. The 1600-px activity header was top **0** below an **81-px** site header; enlarged-text header was **216** below a **297-px** site header. Historical G02 itself was not edited.

## Tests, failures, and implementation review

| Check                                                              | Result                                                                                                                                        |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline ECMO + routes + learning-module + critical-care consumers | 113 suites passed / 3 failed; 2745 tests passed / 3 failed                                                                                    |
| Final same selection, including seven new scroll-owner tests       | **114 suites passed / same 3 failed; 2752 tests passed / same 3 failed**                                                                      |
| All Cardiohelp ECMO tests, workspace/foundation and route coverage | Included in that run; no ECMO or route failures                                                                                               |
| Production build (`npm run build`)                                 | **PASS**, including embedded apps, content, both asset validators, production TypeScript and standalone preparation                           |
| Full repository `npm run type-check`                               | **PASS** after final test-loader correction and fresh incremental cache                                                                       |
| Changed-path ESLint, `--max-warnings=0`                            | **PASS**                                                                                                                                      |
| Changed-path Prettier, `git diff --check`                          | **PASS**                                                                                                                                      |
| Production Chromium                                                | **17/17 PASS**, plus **5/5 PASS** after final inventory-loader correction (all entries at 1600, fixed fallback at three widths, guided focus) |

Exactly the same three Jest assertion identities fail before and after: CRRT circuit accessible-name expectation (`accessibility.test.tsx`), old CRRT challenge ordering (`curriculum-sequencing.test.tsx`), and the cross-module static-copy scanner (`learner-copy.test.ts`). They remain unsuppressed. No old assertion was weakened, removed, or skipped. Seven new unit cases cover local scroll ownership, locked desktop/no-overflow behavior, compact document allowance, measured header, and sticky-strip clearance. Browser tests cover geometry and actual input, rather than relying on CSS-string assertions.

Intermediate failures are retained separately: Turbopack's generated invalid CSS prevented the first dev attempt, so the baseline used webpack as the production build does; early browser harness captures checked before hydration/scroll settlement and the synthetic fixture initially missed CSSOM styles. A new test's direct clinical-registry imports triggered **75 Three.js type errors through declaration ordering**; matched baseline and a run excluding only that test were clean. The final test loads the unchanged live inventory in an isolated esbuild/Node process, and both fresh and standard full type-checks pass. These were implementation/harness failures resolved here, not reclassified as baseline debt.

## Exact changed paths

- `src/features/cardiohelp-ecmo/components/CardiohelpModuleFrame.tsx` — scope measured header height to ECMO activity sizing.
- `src/features/cardiohelp-ecmo/components/cardiohelp-ecmo.module.css` — remove desktop auto-height escape; retain compact reading padding.
- `src/features/cardiohelp-ecmo/components/shell/EcmoActivityShell.module.css` and `EcmoActivityShell.tsx` — flowing shell scroll/focus surface; compact overflow; local operational-strip offset.
- `src/features/cardiohelp-ecmo/components/stage/scrollTaskPaneToTop.ts` — bounded reset/reveal helpers.
- `src/features/cardiohelp-ecmo/components/stage/FoundationStageHost.tsx`, `DrillStageHost.tsx`, `components/teaching/EcmoCircuitWalk.tsx`, and `components/CircuitAndMonitors.tsx` — route existing focus/reveal operations through those helpers.
- `src/features/cardiohelp-ecmo/__tests__/layout-scroll-owners.test.ts` — seven behavioral regression cases.
- `e2e/ecmo-layout.spec.ts`, `e2e/fixtures/ecmo-layout.tsx`, `playwright.ecmo-layout.config.ts` — route/interaction/geometry and actual fixed-fallback browser protection.
- `scripts/critical-care/ecmo-layout-inventory.mts` — source-derived inventory for the browser suite and handoff.
- This handoff and `docs/gap-remediation/self-paced/ECMO-LAYOUT-01-inventory.json`.

`src/styles/globals.css`, shared `learning-module` production files, and every other module remain unchanged. No shared migration or additional G02 audit was necessary.

## Commands and evidence replay

From the active worktree (logs redirected to the named evidence directory):

```sh
node_modules/.bin/esbuild scripts/critical-care/ecmo-layout-inventory.mts --bundle --platform=node --format=cjs --log-level=error | node
npm run build
NODE_OPTIONS=--max-old-space-size=8192 npm run type-check
node node_modules/jest/bin/jest.js src/features/cardiohelp-ecmo src/features/critical-care src/features/learning-module 'src/app/\[locale\]/cardiohelp-ecmo' src/app/api/critical-care/progress --runInBand --json
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3147
ECMO_LAYOUT_BASE_URL=http://127.0.0.1:3147 node node_modules/@playwright/test/cli.js test --config=playwright.ecmo-layout.config.ts
```

The named config can also start its local webpack dev server when no base URL is supplied. It runs Chromium without retries; the fixture and runtime inventory are generated outside the checkout. The final loader produces the exact same 34-entry/240-task JSON as the pre-edit inventory.

## Checks not run and stop boundary

No native zoom, screen reader certification, Safari/Firefox, physical mobile device, or human learner/faculty/perfusion review. No additional locale matrix, every clinical action as a completed management journey, authenticated account/network synchronization, production data mutation, upload, deployment, publication, or whole-repository Jest/lint. No browser tests of MV/MCS/HD/CRRT were needed because no shared production layout changed; their relevant shared consumer tests were included.

The v2 self-paced flow and all clinical/source/device/publication holds remain intact. H1–H10 are preserved within this layout-only scope; no new pedagogy or clinical-content validation is claimed. H11 passes (bounded feature-local repair), and H12 passes for the explicit browser/keyboard matrix above. **This repairs the post-G02 layout defect; it does not declare ECMO technically or clinically validated.** One bounded PR; stop here.
