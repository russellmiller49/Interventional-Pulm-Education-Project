# G02 — Cardiohelp ECMO final post-focus closure addendum

September 16, 2026. Reviewer: Codex, AI assistant. **Report only.**

**PASS for this bounded technical closure. Both residual native keyboard-focus defects from #235 are repaired; no new ECMO defect was demonstrated.** Representative scrolling/header behavior, self-paced controls, simulation interlocks and progress/review honesty remain intact. Human, clinical, device and publication holds remain unchanged.

## Scope and historical evidence

The owner requested a bounded, read-only closure check after [ECMO-FOCUS-01, PR #236](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/236). The owner's current request narrows the broader `prompts/G02.md` protocol; it does not authorize another full module inventory, runtime repair or another module. Read G02 and the authoritative v2 `LEARNING_DESIGN_BRIEF.md` in Local-Data, applicable AGENTS.md, the original G02, ECMO-LAYOUT-01, post-repair G02 and ECMO-FOCUS-01 records. Older examination, compulsory-answer and fixed-pane requirements remain superseded by the owner's self-paced brief.

The historical sequence remains intact:

1. [Original G02](G02-ECMO-final-technical-report.md) passed its exercised states.
2. Owner review then identified the module-wide scrolling/header defect.
3. [ECMO-LAYOUT-01](ECMO-LAYOUT-01-handoff.md), PR #234, repaired that defect.
4. [Post-repair G02](G02-ECMO-post-repair-addendum.md), PR #235, independently checked all 240 tasks across six settings and demonstrated two residual native-focus defects.
5. [ECMO-FOCUS-01](ECMO-FOCUS-01-handoff.md), PR #236, repaired those focus defects.
6. This addendum independently replays the exact failure sequences on merged main and checks representative preservation.

The supplied worktree was clean. After fetching origin, created `codex/ecmo-g02-final-closure` from **`56303a2acde3c7dd22786153c4d50df9fcf965b8`**, current merged `origin/main`, including #236 (`6677b78c`) and the unrelated Peripheral Imaging #237. Historical baseline `9ef04539118b889a344992c63ba35808ee477f0e` remains an ancestor. No newer work or historical report was reset or rewritten.

The ECMO/shared-consumer source diff since #235 contains only `EcmoActivityShell.tsx`, its CSS module and `useEcmoFocusClearance.ts`. It publishes measured site-header/operational-strip heights and native focus scroll-padding/margin. It changes no overflow, height, reading owner, authored-task scrolling helper, content registry, engine, interlock, progress or review metadata. The freshly generated invariant manifest matches #235. **The established scroll architecture is unchanged; #235's 204 entries / 1,440 task states remain valid historical evidence for unchanged areas. That matrix was not rerun.**

Only this addendum changes in Git. Runtime, tests, questions, Device Intelligence, source decisions, legacy records and release flags are unchanged. Original G02 Git blob: `f7870a3a7d90cb1f43ed535f133b2237ae1c7755`; #235 addendum blob: `324136fcc6b568ec20f17587582842c678b43104`.

## PASS

### Independent replay of the two residual defects

Fresh production build from the recorded main commit, served at `http://127.0.0.1:3148`; macOS, Chromium **151.0.7922.34**. Browser contexts were isolated, local APIs fulfilled with test responses and external requests blocked. No stored secret, actual learner account or remote data mutation was used. The exact-reproduction script uses native keyboard and wheel input, without DOM `.focus()` or scripted scrolling for those transitions. Each final reverse-focus state settles for **three seconds** before measurement and screenshot.

**Compact reverse Tab:** at 390×844 and 320×844, opened `why-extracorporeal-support`, continued to the worked example and tabbed to the primary Continue. A positioning wheel established Continue at y≈400, followed by the requested **230 px** wheel movement. Shift+Tab reached “Continue without doing this step.” Forward Tab returned to Continue.

| Viewport | Focused skip control, top–bottom | Site-header bottom | Document scrollTop before → after Shift+Tab | Result |
| -------- | -------------------------------- | ------------------ | ------------------------------------------- | ------ |
| 390×844  | 96.72–140.72 px                  | 73 px              | 1426 → 1390                                 | PASS   |
| 320×844  | 96.58–140.58 px                  | 73 px              | 1642 → 1606                                 | PASS   |

Both complete controls and their 6 px outward focus outlines are visible. Top, center and bottom hit tests resolve to the button; `:focus-visible` and a nonzero visible outline are asserted. The 36 px native correction is bounded and does not jump to page top. Forward Tab remains fully visible. The historical y≈60.6–60.7 px occlusion from #235 no longer reproduces.

**Enlarged operational strip:** at 1440×900 with exactly `html { font-size: 200% !important; }`, tabbed to “Sources for this lesson,” then used three Shift+Tabs to “Why this matters.” All four routes were tested, with `track=va` for the VA counterparts.

| Lesson                    | Focused summary, top–bottom | Shell scrollTop at Sources → after reverse traversal | Result |
| ------------------------- | --------------------------- | ---------------------------------------------------- | ------ |
| `arterial-bubble-stop`    | 653.89–735.66 px            | 21620 → 21372                                        | PASS   |
| `transport-power-loss`    | 653.72–735.48 px            | 6076 → 5828                                          | PASS   |
| `va-arterial-bubble-stop` | 654.33–736.09 px            | 6032 → 5784                                          | PASS   |
| `va-transport-power-loss` | 653.72–735.48 px            | 6076 → 5828                                          | PASS   |

The site header ends at 297 px and the pinned operational strip at 489.91 px in each case. The whole summary and its focus outline clear both; all three hit tests resolve to the summary. Desktop document scrollTop remains zero. Forward traversal back to Sources also passes. The historical summary-under-strip failure no longer reproduces. All six exact screenshots were opened for assistant visual inspection; no page exception occurred. Historical failure coordinates remain historical evidence, not a claim that the old build was rerun in this closure task.

### Representative ECMO-LAYOUT-01 preservation

**20/20 representative checks passed**, with no page exceptions. The later VV and VA checks include all six tasks in each of those two sections at all four settings: **48 task states** within the 20 checks, not an additional full inventory.

The selected paths are foundation disclosures in `why-extracorporeal-support`, “Follow the blood” in `circuit-flow-path`, later VV `vv-recirculation`, VA-specific `va-lv-loading`, and live/control-heavy `startup-sensor-orientation`. The settings are 1600×900, 1024×768, 390×844 and 1440×900 with 200% CSS text.

| Setting                 | Reading owner / measured site-header height | Foundation expanded | Follow the blood | Later VV | VA-specific | Guided live control |
| ----------------------- | ------------------------------------------- | ------------------- | ---------------- | -------- | ----------- | ------------------- |
| 1600×900                | Shell / 81 px                               | PASS                | PASS             | PASS     | PASS        | PASS                |
| 1024×768                | Shell / 81 px                               | PASS                | PASS             | PASS     | PASS        | PASS                |
| 390×844                 | Document / 73 px                            | PASS                | PASS             | PASS     | PASS        | PASS                |
| 1440×900, 200% CSS text | Shell / 297 px                              | PASS                | PASS             | PASS     | PASS        | PASS                |

At all 20 entries, wheel moves the expected owner, the reading bottom is reachable, and returning to the top restores the activity header below the measured site header. PageDown advances in 19 entries; the short 1600 px foundation entry is already at its reading bottom after wheel and remains correctly bounded there. Desktop document scrollTop stays zero. No document horizontal overflow occurs. The activity title remains in the reading flow and can scroll away; this contract does not require a permanently pinned title.

Foundation arithmetic-only, model-only and both-open states remain reachable; all three sliders changed by keyboard at every setting (**12 changes**). Continue advances and reload retains the truthful fresh-task boundary. “Follow the blood” traverses all four stops per setting (**16 stops**) with the actual circuit SVG and live readings present. Later VV/VA task changes restore the header and retain bottom reach. “Show me where” focuses the real PARAM control below the site header at every setting, with a successful hit test. Representative screenshots across all four settings were opened for assistant inspection; these are not human observations.

**Harness correction retained:** the initial smoke attempt passed five named checks and failed two probes because it clicked the already-active first task after scrolling to the outline, then asserted the header reset for a task _change_. The existing merged test deliberately uses `steps.slice(1)`, and `DrillStageHost` runs its entry effect when `activeStep.id` changes. The corrected harness records the first task at entry and selects the five different tasks; all 48 representative task states pass. No runtime edit or assertion weakening was used. The first script, log and JSON remain as `representative-smoke-attempt1.*`, alongside their original failure screenshots; its five valid passes were retained, and 15 remaining checks executed in the corrected continuation. The 20-check result is their explicit aggregate, not a claim that the initial execution passed.

### Self-paced, simulation and honesty checks

The current-build replay of the existing invariant harness passed **25 named checks**: 14 detailed VV/VA flows, three legacy/recommendation checks, three outline/completed-review checks and five content-boundary checks. These are fresh executions, separate from #235's historical evidence and from the focused layout smoke.

- **Gas-to-air interlocks:** VV and VA at 1440 and 390 px. Skipped preceding learning steps, revealed without acting, explicitly started the guided air event and operated the return clamp by keyboard. Premature resumption remained rejected before isolation/source correction; protective controls required no quiz answer.
- **No answer, explanation and retry:** explanations were reachable before a response. Actual wrong choices produced their authored rationale; Try again cleared the choice; skipping and continuation remained available. Both gas lessons could reach “Section reviewed” with zero performed-step markers, including after reload.
- **No fabricated actions:** revealing or skipping did not manufacture a prediction, intervention or comparison capture. “Run comparison without answering” produced an actual modeled comparison; its separate reset cleared it. Integrated-case explanation and Hint continued to report no action when none was performed. Former Assess routes opened the existing self-paced cases.
- **Legacy honesty:** seeded historical grades 0 and 100 yielded identical links, shared progress and recommendations. Historical fields survived value-for-value; normalized historical storage survived byte-for-byte. Navigation added only truthful existing self-paced visit/location fields.
- **Review honesty:** the hub still reports clinical/device review “none recorded,” IFU currency not checked and no local policy held/reviewed. Air-case explanations retain the local-protocol boundary. Current displayed model limitations were checked for the PaCO₂ floor, saturation ceiling and recirculation; no clinical validity was inferred.
- **Network:** zero graded-progress POSTs or graded/help/action-completion payloads in these isolated checks; zero page exceptions. Existing session-start analytics requests were intercepted locally. This is not live authenticated-backend verification.

### Executed build and targeted regressions

| Check                                    | Result                                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                          | PASS, exit 0: training apps, content, asset validators, production compilation/type checking and standalone preparation |
| Targeted ECMO Jest                       | **5 suites / 278 tests PASS**, zero skipped or TODO                                                                     |
| Repair-path ESLint, `--max-warnings=0`   | PASS, exit 0                                                                                                            |
| Report formatting and `git diff --check` | PASS                                                                                                                    |

Jest selection: `self-paced.test.tsx` (90), `progress.test.ts` (15), `layout-scroll-owners.test.ts` (7), `ecmo03-claim-review-queue.test.ts` (5), `ecmo-honesty-02-review-language.test.tsx` (161). No assertion was changed or suppressed. Build advisories were non-fatal. Next's existing standalone-start advisory did not prevent the tested production routes from being served.

## NEW DEFECT

None demonstrated in the requested closure scope. **G02-ECMO-POST-01 and G02-ECMO-POST-02 are technically closed by the six independent current-build replays above.** No further repair is proposed. This conclusion does not claim exhaustive keyboard, clinical or device validation.

## PRE-EXISTING / UNRELATED DEBT

- Carry forward #235/#236's three shared Jest failures: CRRT accessible-name assertion, obsolete CRRT case ordering and the cross-module static-copy scanner. Those suites were **not rerun** here; the selected 278 passing ECMO tests do not make the repository-wide suite green.
- Carry forward the shared `ModuleProgressToggle.tsx` hook warning, unrelated BBT access-contract failure, `cardiohelp-i-us-2025` manufacturer-attribution discrepancy and dormant score/mastery compatibility debt. No repair or waiver is implied.
- #235's initial intermittent 1024×768 `va-normal-state` layout-suite failure remains in its historical record, together with its passing unchanged rerun and independent matrix. This closure does not rerun that entire entry inventory or establish the earlier failure's cause.

## HUMAN REVIEW HOLDS

- All **ten ECMO-03 claim decisions remain NOT REVIEWED**, with null reviewer, role, date and reviewed-content-version fields; the queue and source-review metadata are unchanged.
- Current U.S. IFU currency, exact alarms/device behavior, emergency instructional order and the air-resumption abstraction still require attributable faculty/device review. No local institutional protocol was obtained or approved.
- Textbook/guidance identity, currency and claim support; supplied case-curriculum status; the ambiguous ELSO-endorsed source-title item; and media-rights/source follow-ups remain held.
- Faculty decisions on the PaCO₂ floor, saturation ceiling, recirculation curves and optional-question teaching value remain pending. Technical agreement with the current model is not clinical approval.
- [ECMO-03's observation guide](ECMO-03-observation-guide.md) remains **prepared, not run**. Assistant screenshots and automated tests are not learner/facilitator observations or owner usability retest.
- Draft/unlisted state remains authoritative. No publication, limited-preview authorization, competence certification or clinical/device approval is created by this addendum.

## NOT RUN

- The full 240-task × six-setting inventory, the full 17-test layout suite, the full 13-test focus suite and other unchanged route/locale/fallback inventories. Their prior evidence remains explicitly historical. The independent six exact reproductions and selected smoke paths are this run's browser evidence.
- Whole-repository Jest/lint, the prior combined shared suite, a separate full `npm run type-check`, or a historical-baseline rebuild. The fresh production build includes its configured TypeScript check.
- Native browser zoom, Safari/Firefox, screen-reader certification, physical mobile devices, hardware/device validation, missing-asset injection, graphics context-loss recovery, every console safety chord or every clinical management journey. CSS text enlargement is not native browser zoom.
- Live accounts, real learner records, production APIs/databases, Supabase/upload operations, deployment/publication, new source-currency adjudication, rights clearance or human learner/faculty/owner review.

## Evidence, replay and stop boundary

Evidence stays outside Git at:

`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/g02-ecmo-final-closure-2026-09-16/`

It contains `source-audit.json`, fresh manifests, `exact-focus.cjs/json/log`, six exact screenshots, representative smoke scripts/results/screenshots, four `browser-*.json/log` invariant groups, `invariant-summary.json`, `build.log`, `jest.json/log` and `lint.log`. No raw/private source inputs were copied into the checkout.

Commands, from the recorded worktree (`EVIDENCE` denotes the absolute directory above):

```sh
git fetch origin
git switch -c codex/ecmo-g02-final-closure origin/main
npm run build
NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3148
node "$EVIDENCE/prepare.cjs"
node "$EVIDENCE/exact-focus.cjs"
node "$EVIDENCE/representative-smoke.cjs"
node "$EVIDENCE/invariants.cjs" flows
node "$EVIDENCE/invariants.cjs" legacy
node "$EVIDENCE/invariants.cjs" review
node "$EVIDENCE/invariants.cjs" content
node node_modules/jest/bin/jest.js src/features/cardiohelp-ecmo/__tests__/layout-scroll-owners.test.ts src/features/cardiohelp-ecmo/__tests__/self-paced.test.tsx src/features/cardiohelp-ecmo/__tests__/progress.test.ts src/features/cardiohelp-ecmo/__tests__/ecmo03-claim-review-queue.test.ts src/features/cardiohelp-ecmo/__tests__/ecmo-honesty-02-review-language.test.tsx --runInBand --json --outputFile="$EVIDENCE/jest.json"
node node_modules/eslint/bin/eslint.js src/features/cardiohelp-ecmo/components/shell/EcmoActivityShell.tsx src/features/cardiohelp-ecmo/components/shell/useEcmoFocusClearance.ts e2e/ecmo-focus.spec.ts --max-warnings=0
git diff --check
```

**Behavior/test contracts and question ledger:** no runtime behavior or test contract changed; no question was added, rewritten, replaced, combined, removed or re-keyed. ECMO-01's contracts/ledger, the historical-data boundary and ECMO-LAYOUT-01's scroll-owner contract remain authoritative. This is one report-only closure addendum. Stop after the report-only PR; no runtime repair, merge, publication, Device Intelligence work or next module is included.
