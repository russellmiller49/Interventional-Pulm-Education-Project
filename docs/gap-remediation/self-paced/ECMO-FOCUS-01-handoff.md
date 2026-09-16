# ECMO-FOCUS-01 — native keyboard focus clearance

## Scope and baseline

Bounded repair of the two residual keyboard defects in the [G02 post-repair addendum](G02-ECMO-post-repair-addendum.md), following [ECMO-LAYOUT-01](ECMO-LAYOUT-01-handoff.md). Read the original G02 technical report and the owner's Local-Data `prompts/G02.md`; this task does not begin another G02 validation.

The supplied `codex/ecmo-focus-01` branch was clean and already at **99b43dee2d1ecabaab0d8a564d44c70beea0f74e**, merged PR #235. Fetch confirmed it matched `origin/main`. Both failures were reproduced on that unmodified runtime before edits. No other agent's checkout or branch was modified.

Runtime changes are confined to `EcmoActivityShell.tsx`, its CSS module and the new `useEcmoFocusClearance.ts` hook. Added `e2e/ecmo-focus.spec.ts` to the existing ECMO Playwright configuration. No clinical/device content, questions, equations, simulation actions/interlocks, task ordering, progress/storage, legacy records, source/review metadata, publication status or Device Intelligence changes. All clinical/device/human-review holds remain unchanged. Question ledger: no additions, removals or rewrites. No test contract for safety, physics, sources or data was replaced.

## Reproduction and root cause

Chromium with local API responses isolated and external requests blocked. Before evidence used webpack development mode; final browser evidence uses the production build. Dimensions below are CSS pixels, including the 200% CSS root-font enlargement (not native browser zoom).

**Compact:** open `why-extracorporeal-support`, Continue to `why-extracorporeal-support-worked-example`, use native Tab to Continue, position that control around y=400, wheel another 230 px, then Shift+Tab to the skip control. The small positioning wheel makes the precondition independent of browser-version differences in native focus centering. No DOM `.focus()` or scripted scrolling substitutes for the tested transition.

| Width   | Focused skip control before repair | Site header | Active owner | Owner scrollTop before → after Shift+Tab |
| ------- | ---------------------------------- | ----------- | ------------ | ---------------------------------------- |
| 390×844 | x=34, y=60.72, w=239.72, h=44      | y=0–73      | Document     | 1426 → 1426                              |
| 320×844 | x=34, y=60.58, w=239.72, h=44      | y=0–73      | Document     | 1642 → 1642                              |

The ECMO title has scrolled away; the non-operational strip is empty/static. Shell scrollTop stays zero. The button center still hit-tests to itself, but its top edge and outline are under the site header. This is why the new assertions test the whole control, outline and three vertical hit-test points rather than just its center.

**Enlarged text:** at 1440×900 with `html { font-size: 200% !important; }`, open `arterial-bubble-stop`, use 34 native Tabs from task-entry focus to Sources, then Shift+Tab three times. Before repair, `Why this matters` is x=61.80, y=405.89–487.66, under the operational strip at y=297–489.91 (height 192.91). The site header is y=0–297. The active owner is the ECMO shell: scrollTop 21620 → 21620; document scrollTop 0 → 0. The summary center hits the strip's modeled-time paragraph. Its top and bottom are also obscured. Repeating this path on transport power loss and both VA counterparts gives the same failure.

Before repair, document scroll-padding is `auto`; the shell has `scroll-padding-block: 1rem` (16px normally, 32px enlarged). The affected buttons/summaries have zero scroll-margin. Those insets omit the actual sticky obstruction. Native Tab does not call the authored-task/guided helper in `scrollTaskPaneToTop.ts`, so the existing helper cannot correct this path. Scroll ownership itself is correct and remains unchanged.

The evidence records full focus/site-header/ECMO-header/strip rectangles, both owners' scrollTop, computed padding/margin, and hit tests. All six new exact-reproduction tests fail against the unmodified runtime at the clearance assertion.

## Repair strategy

- Keep browser-native focus scrolling. There is **no focusin handler, key handler, scroll listener, `scrollIntoView` call or corrective JavaScript scroll** in this repair.
- A Learn/FLOWING-only layout effect measures the existing site header and context strip. It counts the strip only when its computed position is sticky: the operational strip contributes; the activity title and ordinary context do not. ResizeObserver handles wrapped text and changing strip height; resize handles breakpoint changes. Task changes refresh the measurement, and cleanup disconnects observers and restores/removes the feature's root token.
- Desktop shell scroll-padding starts at **sticky strip height +1rem**; its existing bottom inset stays 1rem. When focus is within the activity header or strip itself, the top inset is only 1rem, avoiding clearance for the same chrome that contains the control.
- Compact document scroll-padding starts at **measured site header +sticky strip height +1rem**, with 1rem at the bottom. The root rule is in the ECMO CSS module and matches only while a flowing Learn shell is mounted and the existing compact breakpoint applies. Compact focusable descendants also have 0.5rem block scroll-margin to protect their outline.
- Desktop descendants deliberately do not receive the new compact margin. An exploratory blanket 8px margin caused the browser to move the otherwise locked outer document by 8px during traversal. The owner-specific version preserves document scrollTop 0.
- Measurements only publish CSS values. Scroll-padding does not resize content or change overflow/height, so there is no measurement/scroll feedback loop. No worst-case fixed chrome offset is used.

Typical measured insets: compact foundation =73+0+16=**89px** document top padding, plus 8px target margin; ordinary desktop operational strip =72.44+16=**88.44px** shell top padding; enlarged operational strip =192.91+32=**224.91px**. At compact operational entries the measured strip is 153.98px, giving 242.98px document top padding. These are observed values, not constants in runtime code. Clearance anticipates the strip's sticky position when native scrolling reveals a body/footer target.

## Verification notes

The exact assertions require the entire control plus its computed outline outside the actual pinned chrome, hit-test the top/center/bottom, check page width, and retain desktop document scrollTop 0. Compact reverse Tab must stay within 100px of the prior reading position; forward Tab back to Continue is checked. Enlarged tests also traverse forward back to Sources and open/close the source disclosure with Enter/Escape.

The broader native Tab matrix includes the horizontal signal-table and actual-size console reading regions. Those named scroll regions can be taller than the usable viewport; their contract is a readable, unobstructed intersection and retained tab access, not fitting an entire multi-screen table/device on screen. Discrete buttons, inputs and summaries retain the full-control/outline assertions. Initial harness attempts incorrectly required the entire large regions to fit, and sampled long native scrolls at 250ms. Final checks wait 800ms for settlement; those earlier attempts are retained separately, not reported as product regressions or passes. A first Sources locator incorrectly assumed an exact button name; the corrected regression targets its actual native summary (including the source-count badge).

## Results

| Check                                          | Result                                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| All ECMO Jest                                  | **74 suites / 2,316 tests PASS**                                                                                             |
| Shared learning-module Jest                    | **15 suites / 134 tests PASS**                                                                                               |
| ECMO routes / shared progress API              | **2 suites / 70 tests PASS**                                                                                                 |
| Combined Jest selection                        | **114 suites passed / 3 failed; 2,753 tests passed / 3 failed; zero skipped**. The same three known shared assertions fail.  |
| Production build                               | **PASS**, including training apps, content, both asset validators, Next compilation/type checking and standalone preparation |
| Repository type-check                          | **PASS**, exit 0                                                                                                             |
| Changed-path ESLint (`--max-warnings=0`)       | **PASS**, exit 0                                                                                                             |
| Changed-path Prettier / `git diff --check`     | **PASS**                                                                                                                     |
| Final production focus / layout browser suites | **13/13 focus tests and 17/17 existing layout tests PASS**, zero retries, skips or flaky results.                            |

A test-only TypeScript error in the new resize check (`Node.remove`) was corrected with the style-element type; the final repository type-check passed. Existing build dependency/advisory warnings remain non-fatal. The production `next start` standalone advisory was emitted; actual served routes are verified by the browser suites.

### Exact production results and browser matrix

| Reproduction                       | Focused control after repair (top–bottom) | Actual owner scrollTop before → after reverse traversal | Result                                                                |
| ---------------------------------- | ----------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| 390×844 worked example             | 96.72–140.72                              | Document 1426 → 1390                                    | PASS; full outline below 73px header; forward Tab to Continue visible |
| 320×844 worked example             | 96.58–140.58                              | Document 1642 → 1606                                    | PASS; full outline below 73px header; forward Tab to Continue visible |
| 200% text: arterial-bubble-stop    | 653.89–735.66                             | Shell 21620 → 21372                                     | PASS                                                                  |
| 200% text: transport-power-loss    | 653.72–735.48                             | Shell 6076 → 5828                                       | PASS                                                                  |
| 200% text: va-arterial-bubble-stop | 654.33–736.09                             | Shell 6032 → 5784                                       | PASS                                                                  |
| 200% text: va-transport-power-loss | 653.72–735.48                             | Shell 6076 → 5828                                       | PASS                                                                  |

For every enlarged case the strip ends at 489.91px, the site header ends at 297px, all three focused-summary hit tests resolve to the summary, and the desktop document remains at 0. For both phone cases the transition makes a bounded 36px correction through native browser scrolling, without jumping to the page top. The focus outline extends 6px beyond the measured control rectangle and remains clear.

| Viewport                 | Native Tab/Shift+Tab | Reading owner/top/bottom | Horizontal page overflow |
| ------------------------ | -------------------- | ------------------------ | ------------------------ |
| 1600×900                 | PASS                 | Shell / PASS             | None                     |
| 1440×900                 | PASS                 | Shell / PASS             | None                     |
| 1024×768                 | PASS                 | Shell / PASS             | None                     |
| 390×844                  | PASS                 | Document / PASS          | None                     |
| 320×844                  | PASS                 | Document / PASS          | None                     |
| 1440×900 / 200% CSS text | PASS                 | Shell / PASS             | None                     |

The new suite checks native forward traversal to Sources and six reverse stops, full discrete-control/outline clearance, hit tests, scroll bounds, responsive measurement and client-navigation cleanup. The existing 17-test suite passes unchanged: all 34 track entries across six layout sizes (including 1920×1080), all 240 authored task entries/changes at 1440×900, foundation disclosures/sliders/reload, enlarged-text reading, guided-control/circuit-walk focus and the actual shared fixed-pane fallback. Its wheel/PageDown and top/bottom checks preserve ECMO-LAYOUT-01's ownership contract. This is execution of the requested layout regression suite, not a new G02 revalidation.

Production screenshots inspected: exact 320/390px skip-button focus, enlarged arterial-bubble summary, 1024px operational focus, 390px operational focus and the enlarged native-focus matrix. Before screenshots were inspected as well. These are assistant visual checks, not human usability observations. `production-exact-geometry.json` extracts the final exact-reproduction measurements; the complete reports retain all attachments.

## Existing debt and checks outside scope

The combined shared Jest run retains the documented CRRT circuit accessible-name assertion, obsolete CRRT case-order assertion and cross-module static-copy scanner failures. They are not repaired or suppressed. The historical `ModuleProgressToggle.tsx` hook warning and unrelated BBT access-contract failure remain carried forward; neither is in this bounded changed-path lint check. Existing manufacturer/source attribution and clinical/device/IFU review holds remain open.

No whole-repository Jest/lint, new G02 module or full G02 revalidation, live account/database writes, Supabase/upload operations, deployment/publication, human learner/faculty review, native browser zoom, screen-reader/hardware certification, Safari/Firefox or physical-device testing. Automated browser evidence does not confer clinical/device approval.

## Commands and stop boundary

From the supplied worktree; logs and browser attachments are kept outside Git under `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/ecmo-focus-01-2026-09-16/` (working output `/tmp/ecmo-focus-01/`). This includes unmodified-main reproductions, declarative CSS experiments, failed harness attempts, final production evidence and screenshots inspected by the assistant.

```sh
npm run build
NODE_OPTIONS=--max-old-space-size=8192 npm run type-check
node node_modules/jest/bin/jest.js src/features/cardiohelp-ecmo src/features/critical-care src/features/learning-module 'src/app/\[locale\]/cardiohelp-ecmo' src/app/api/critical-care/progress --runInBand --json
NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3148
ECMO_LAYOUT_BASE_URL=http://127.0.0.1:3148 npx playwright test --config=playwright.ecmo-layout.config.ts e2e/ecmo-focus.spec.ts --reporter=json
ECMO_LAYOUT_BASE_URL=http://127.0.0.1:3148 npx playwright test --config=playwright.ecmo-layout.config.ts e2e/ecmo-layout.spec.ts --reporter=json
node node_modules/eslint/bin/eslint.js src/features/cardiohelp-ecmo/components/shell/EcmoActivityShell.tsx src/features/cardiohelp-ecmo/components/shell/useEcmoFocusClearance.ts e2e/ecmo-focus.spec.ts playwright.ecmo-layout.config.ts --max-warnings=0
# Prettier --check on the six changed paths, then:
git diff --check
```

The structured-module contracts H1–H10 are preserved by the bounded diff and existing regressions; no fresh teaching/clinical adjudication is claimed. H11 passes for feature-local scope. H12 passes for the browser matrix documented here. The owner-specific self-paced contract continues to supersede older mandatory prediction, assessment and three-pane rules. Deliver one PR and stop: no merge, deployment, publication or G02 revalidation from this branch.
