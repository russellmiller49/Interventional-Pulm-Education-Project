# INTEGRATION-01 — post-remediation combined validation

Validation date: 2026-09-15 PDT (2026-09-16 UTC). Prepared by Codex, an AI assistant.
**Not G02, clinical approval, release approval, or accessibility certification.**

**Result: production build passes; integration is not fully green.** The combined checks found a newly stale CRRT review-queue quotation introduced by SHARED-02. The already-failing learner-copy scanner also contains three added findings from MV-02/MCS-02. No application, clinical content, model, progress contract, source-review decision, or test was changed during this validation.

## Baseline and evidence

- Main tested: `32e8359bc36f5cc451de5ebbcb8e120cec2f74f3` (PR #230, ECMO-HONESTY-02).
- Clean dedicated checkout: `Interventional-Pulm-Education-Worktrees/codex-integrated-build`; fresh branch `codex/integration-01-validation` from fetched `origin/main`. All executed product checks preceded any tracked edit.
- Historical comparison: `9ef04539118b889a344992c63ba35808ee477f0e`, before the self-paced series; SHARED-02 boundary: parent `b32d9cd6`, merge `a465b486`.
- Read the merged SHARED-02, MV-03, MV-SAFETY-01, MV-UX-01, MCS-03, MCS-AF-PRESENTATION-01, ECMO-03, ECMO-HONESTY-02, HD-03, BF-03, CRRT-02, BBT-02, PI-02 and EBUS-01 handoffs. Earlier statements superseded by later handoffs were not treated as current failures.
- Runtime: macOS, Node `v26.5.0`, npm `11.17.0`, installed repository dependencies; Chromium through Playwright. No dependency installation or stored secrets were needed.
- Raw logs, JSON, temporary browser scripts/configuration, screenshots and failure traces: `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/integration-01-2026-09-15/`. They were generated in `/tmp/integration-01/`; commands below retain that original output path. These are local evidence, not committed assets or production dependencies.

## PASS

### Production build

`npm run build` exited **0** on unchanged current main. Both embedded training applications built; Contentlayer generated 24 documents; validators accepted 19 critical-care assets and seven cardiac-device assets, the CT heart and nine routes; Next compiled, completed its production TypeScript check, generated routes and prepared standalone output.

Warnings included existing dependency dynamic-import/cache warnings, a Mermaid dependency warning and Node deprecation warnings. None stopped the build. There was no build failure to repair or attribute.

The separate full `npm run type-check` exhausted Node’s default heap (exit 134, no source diagnostic). Re-running unchanged current-main source with `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check` exited **0**. This was a resource limit, not a suppressed type error; both logs are retained.

### Combined regression: passing checks and exact totals

The two non-overlapping Jest runs discovered **393 suites / 6,380 tests**: **388 suites passed, five failed; 6,374 tests passed, five failed, one TODO**. No skipped suite. This is a targeted combined run, not the whole repository. Passing tests in failing suites are counted individually below; the overall command is not described as passing.

| Scope                                                    |  Suites | Passed tests | Failed tests |  TODO |
| -------------------------------------------------------- | ------: | -----------: | -----------: | ----: |
| Bronchoscopy Foundations                                 |      25 |          351 |            0 |     1 |
| Peripheral Imaging                                       |      31 |          239 |            0 |     0 |
| Bronchial Branch Tracing                                 |      12 |           80 |            1 |     0 |
| EBUS Guided                                              |      10 |           81 |            0 |     0 |
| Cardiohelp ECMO                                          |      73 |        2,308 |            0 |     0 |
| Baxter CRRT                                              |      60 |          654 |            1 |     0 |
| ICU Hemodynamics                                         |      37 |          501 |            0 |     0 |
| Mechanical Ventilation                                   |      36 |          752 |            0 |     0 |
| Mechanical Circulatory Support                           |      37 |          754 |            0 |     0 |
| Shared critical-care                                     |      26 |          233 |            3 |     0 |
| Shared learning-module                                   |      15 |          134 |            0 |     0 |
| Additional routes, API, access and anatomy compatibility |      31 |          287 |            0 |     0 |
| **Total**                                                | **393** |    **6,374** |        **5** | **1** |

The additional run includes the eight progress-API tests, all discovered module route tests, shared critical-care routes, site-auth, CRRT search/sitemap/draft visibility, and anatomy helpers. The requested dashboard and recommendation coverage lives inside `critical-care`; there are no separate discovered suites under the three extra account/dashboard/recommendations selectors in the first command.

Shared passing coverage includes activity/catalog validation, ECMO catalog titles, source/conflict and evidence registries, account projection/hydration, recommendations, dashboard, adapters/readers, and learning-module routes/components/contracts. The normal production build also compiles the embedded EBUS course and navigation trainer; it does not establish their full behavioral coverage.

### Storage and progress protections

Existing tests passed without changes, using synthetic storage and mocked accounts, not real learner records:

| Protection                                                                         | Executed coverage                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy bytes remain preserved; old scores do not become current review/preparation | BF `self-paced-progress` (7), `self-paced-summaries` and boundary/rendered journeys; PI `self-paced-progress` (8); EBUS `self-paced-progress` (8); MV `self-paced-progress` (4), self-paced and safety journeys; HD `self-paced-progress` (7); MCS persistence/self-paced suites; CRRT `selfPaced` (34) |
| Declared navigation/review fields only; retired grade authority stays inert        | Shared `hd-ecmo-self-paced` (21), `adapters` (20), `integrated` (7), `selection` (3); MCS `self-paced-consumers` (25); CRRT `selfPacedConsumers` (5)                                                                                                                                                    |
| Account hydration/projection and recommendations cannot restore retired authority  | Shared `account-sync` (8), `merge-recommendation` (10), `dashboard` (7), plus progress API (8)                                                                                                                                                                                                          |
| Reveal does not fabricate actions, captures or performed work                      | All 18 CRRT cases in Chromium; CRRT real-action prerequisite and worked-case tests; BF incomplete-survey browser journey; BBT reference/skip browser journeys; EBUS acquisition skip with Hold disabled; MV/MCS/HD/ECMO self-paced rendered suites and browser checks                                   |

These counts identify representative suites, not an additional test total. Genuine artifacts such as an explicitly performed BF survey, BBT marks/drafts and EBUS examination workspace remain governed by their existing validity contracts; they are not being described as mere navigation data. Legacy-root compatibility fields retained by CRRT/ECMO/MCS are not new score writes.

### Browser smoke and regression

Local server: `127.0.0.1:3137`, dummy preview environment, no sign-in. Custom smoke scripts fulfilled API requests locally and blocked external hosts. Existing specs used fresh isolated browser contexts; their unauthenticated analytics requests returned 401 where not intercepted. No real account sync or learner data was changed.

**All 36 public entry routes loaded with HTTP 200**, with no page exceptions in the successful smoke observations: for every base in the table, the hub, `/learn`, `/practice`, and `/assess` were checked. The former Assess routes displayed self-paced worked applications, integrated cases or additional tracing routes, rather than grade-dependent access.

| Module base (under `/en/`)       | Additional representative paths/interactions actually checked                                                                                                                                                                                                                                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bronchoscopy-foundations`       | Existing specs: explanation before answering, Back/reload restoring no answer; incomplete survey saves no survey; integrated cases open with immediate safety feedback and no standard                                                                                                                                                                                                    |
| `peripheral-imaging`             | `learn?section=projection`; explanation, retry/reload and no saved answer; Practice explanation and unanswered next case; all integrated cases, safety feedback and `assess?case=case-1` deep link                                                                                                                                                                                        |
| `learn/anatomy/branch-tracing`   | `learn?lesson=follow-one-airway`; reference without marking, skip, outline jump/reload/return; former Assess opens four more routes, reference/reload/comparison without recording                                                                                                                                                                                                        |
| `ebus-guided`                    | `learn?section=acoustic-contact`; explanation with no checked radio, Continue without answering, Hold acquisition disabled before acquisition, skip without image, subsequent explanation honestly states no image held                                                                                                                                                                   |
| `cardiohelp-ecmo`                | Hub declares no local policy held/reviewed and currency not checked; `learn?track=vv&lesson=blood-flow-versus-sweep` shows 20-mmHg lower bound and saturation ceiling at about 4,000 rpm; real +200-rpm comparison; `learn?track=vv&lesson=arterial-bubble-stop` uses current IFU/local-protocol wording with optional explanation/skip; `/assess` explanation opens without a prediction |
| `baxter-crrt`                    | All `practice?case=CRRT-01` through `CRRT-18` (16 via `/assess`); hints/explanations/debrief invent no run; actual assessment unlocks fluid-removal adjustment; `learn?lesson=crrt-indications-modality` and pressure-profile map jump; CRRT-05/15/16 worked comparisons                                                                                                                  |
| `icu-hemodynamics`               | `learn?activity=pressure-system`; reach optional check by skipping demonstrations, open explanation with no radio selected, Continue without answering                                                                                                                                                                                                                                    |
| `mechanical-ventilation`         | `/assess`, “The alarm and the person”: readable purpose, empty light-scheme radios, visibly selected teal radio/row, explanation and safety note, wrong-choice feedback, retry and Continue; `practice?case=MV-03&device=hamilton-c6&mode=practice` retains live-case modeling hold                                                                                                       |
| `mechanical-circulatory-support` | `learn?lesson=iabp-timing-triggering&phase=transfer`: limitation visible beside ECG/pressure selector and associated by `aria-describedby`, stays after pressure selection, explanation before answer; existing unloading comparison resume and keyboard/layout journeys                                                                                                                  |

The targeted existing Playwright selection ran **20 tests: 19 passed, one infrastructure interruption**. The unchanged failed CRRT narrow-width test then passed alone (**1/1**, no retries configured). This is 20 distinct checks with successful executions, not a claim that the first run was green. The interruption was `page.evaluate: Execution context was destroyed` after the compact worked-example actions. Six first-pass generic route navigations likewise returned `net::ERR_ABORTED` during dev navigation; every affected route succeeded in a fresh-page rerun. Initial custom selectors also required correction: language picker versus MV concept picker, an unopened comparison disclosure, partial text versus an exact text node, hydration wait, and ECMO's full explanation-button name. No application or existing test was edited for these reruns. Original failures remain in the evidence.

Narrow-width evidence: all nine hubs measured `scrollWidth === innerWidth === 390`; MV safety-feedback card at 390 also had no page overflow. Existing MCS tests passed at 1,280, 1,024, 900, 720, 390 and 320 px; CRRT Learn and worked case checks include 390 px. EBUS at 390 shows the supported desktop/tablet acquisition notice, an honest no-image state, readable explanation and Continue. Desktop and narrow screenshots were inspected for MV, MCS, EBUS, HD, ECMO and the BF/PI/BBT/CRRT hubs. Tall hub captures establish overall wrapping only, not a pixel-level typography audit.

The inspected page text did not advertise learner grades, mastery, passing thresholds or competence. Matches were explicit denials, clinical threshold wording, or review requirements. This is a bounded current-route observation, not an exhaustive scan of every lesson state. Static-copy failures remain separately reported below.

### Scope protection

Compared every first-parent merge from `9ef04539` through tested main against its first parent, plus the net diff. No changed path belonging to Device Intelligence (`ip-device-intelligence`/`device-intelligence`), Airway Stent Mechanics or ICU Simulation was found. SHARED-02's initially proposed out-of-scope edits are absent from its merged diff. No Device Intelligence feature suite or remediation was performed; existing shared-consumer compatibility assertions were left intact.

## PRE-EXISTING / ACCEPTED DEBT

“Pre-existing” records observed history, not a new owner acceptance or waiver. All five current failing assertions were reproduced in a focused run on unchanged tested main: **49 passed / five failed in five suites** (`current-failures.json`).

| Failure                                                                                                  | Current evidence and classification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `critical-care/__tests__/accessibility.test.tsx` — color-independent circuit/pressure/alarm/trend states | Missing `img` accessible name matching `patient access, access catheter, access line, filter, return line, then patient return`. Also fails at pre-series `9ef04539`. This is a real existing test failure, not accessibility certification or a newly introduced remediation failure.                                                                                                                                                                                                                                                      |
| `bronchial-branch-tracing/__tests__/contracts.test.ts` — anonymous/unlisted versus admin anatomy         | `isPublicPath('/airway-anatomy/case-001/case_manifest.json')`: expected false, actual true. Same predicate/assertion fails at `9ef04539`; current line 198, historical line 201. Existing shared-access debt; BBT-01/02 also recorded it. No access rule was changed here.                                                                                                                                                                                                                                                                  |
| `critical-care/__tests__/curriculum-sequencing.test.tsx` — authored CRRT case order                      | Current rendered list adds **PrisMax troubleshooting challenge** after the expected 18 practice titles. Passes at `9ef04539`, already fails before SHARED-02 at `b32d9cd6`. Owning change: CRRT-01 `916eb45e` / PR #208 intentionally classified the former Assess item as `practice-case`, non-credit, no mastery authority. The expected list still filters only `crrt:practice:` IDs. **Obsolete test contract after a documented self-paced change**, not evidence that the 18 authored cases were reordered. No assertion was relaxed. |
| `critical-care/__tests__/learner-copy.test.ts` — static component copy                                   | Fails at `9ef04539` and current main. Current failure contains **19 reported literal occurrences**, versus 21 at the pre-series commit. This is not an identical finding set: three added occurrences are disclosed under NEW REGRESSION. Remaining findings include legacy software terms and clinical uses of “assessment”; classification needs contextual judgment. Do not infer that all matches represent grading claims.                                                                                                             |

The pre-series four-suite comparison ran **44 passed / three failed**, with curriculum ordering passing. SHARED-02-parent comparison (review queue plus ordering) ran **21 passed / one failed**: ordering failed, queue passed. The post-SHARED-02 queue-only run ran **four passed / one failed**. Logs and JSON retain exact payloads rather than relying on older handoff counts.

Known BF larynx-junction TODO remains TODO. It is not a passing anatomy check.

## NEW REGRESSION

### 1. SHARED-02 left G01-CRRT-10 out of sync with current source

- Owner: SHARED-02 / PR #225, merged at `a465b486`.
- Failure: `src/features/baxter-crrt/__tests__/g01SourceReviewQueue.test.ts:145`, “still quotes the content a reviewer would be deciding on”.
- `docs/gap-remediation/self-paced/G01-crrt-source-review-queue.json`, item `G01-CRRT-10`, still quotes `baxterCrrtReleaseStage === 'published' ? 'Reviewed release' : 'Unlisted preview'` and describes that wording as unchanged/on hold.
- `src/features/baxter-crrt/components/BaxterCrrtModuleFrame.tsx:45` now correctly says **Public release**, following SHARED-02. The strict quote check returns `quoted: false`.
- Reproduction: queue suite **5/5 passes at `b32d9cd6`**, **4/5 passes at `a465b486`**, and **4/5 passes on `32e8359b`**. The merge diff changes that exact phrase without updating the queue. This is a newly stale review artifact/contract, not a reason to restore an unsupported approval label or delete the test.
- The release branch is dormant while CRRT remains unlisted. No observed clinical behavior or stored learner data depends on this quotation, but a reviewer would be asked to review inaccurate current wording.

### 2. The static-copy failure gained three occurrences during remediation

A failing baseline scan is not permission to ignore additions. Comparing extracted literal findings by text (ignoring line shifts) identifies:

- MV-02 `b71f93f3` / PR #204 added **Engine-generated example values · no hold acquired** twice in `VentilationPeepComparison.tsx`, current lines 122 and 160; scanner flags `engine`.
- MCS-02 `65a99815` / PR #219 added **Seed** in `McsUnloadingComparison.tsx`, current line 115; scanner flags `seed`.

These are two distinct new strings / three occurrences in an already-red test, rather than three additional failing tests. Other old occurrences were removed, so the net count decreased. They describe example provenance/reproducibility, not restored learner grade authority. Whether to use clearer learner wording or retain a narrowly justified exception is an owner decision; neither was changed here. Earlier handoffs documenting a red scanner do not establish acceptance of these exact additions.

**One smallest proposed follow-up:** reconcile **G01-CRRT-10 only** with SHARED-02's already-merged “Public release” wording, preserving previous wording as history and every `NOT REVIEWED`/null reviewer field. Re-run the strict quotation suite and CRRT source/scaffold consumers. Do not bump persisted content versions, restore “Reviewed release”, change release state, or weaken matching. Static-copy additions remain recorded for later triage; this report does not start another repair slice.

## HUMAN REVIEW HOLDS

Automated success does not resolve any of these carried holds:

- **MV:** live MV-03 intrinsic-PEEP/settling hold; MV-02 quantitative interpretation; MV-03 question/source packet; MV-SAFETY-01 item 08 alarm-limit ambiguity and remaining faculty/RT/source decisions. Purpose/radio rendering is validated, not the clinical claims.
- **MCS:** AF trigger coefficients and the two cases' pressure-trigger-only model criteria remain held; the visible note does not settle them. CP peak versus mean-flow ceiling, RP/RP Flex identity, suction behavior, high-power inference, missing HeartMate 3 labeling and uncertain syntheses remain review work.
- **ECMO:** IFU currency/discrepancies, supplied textbook identities and guidance verification, curriculum review, PaCO₂ floor/saturation ceiling/recirculation teaching validity. No institutional protocol is held. The ELSO-endorsed source-title attribution remains unresolved.
- **HD:** waveform timing/validity, alarm-boundary source, PA waveform non-return guidance conflict, measurement conventions and unavailable sources. SHARED-02 identifies the competing GEF sources; it does not adjudicate the formulas.
- **CRRT:** predilution and filter-burden limits, CRRT-15 small trend, CRRT-16 plan-only actions, filter-drop correction and source/clinical review remain held. Review-queue synchronization is not nephrology/operator approval.
- **BF:** clinical ledger findings and cases, larynx continuity, rights/de-identification/review of 94 media files, local policies, remaining item review and faculty release decisions.
- **BBT:** five-junction continuity, provisional model locators and subsegmental naming need anatomy/faculty review. Geometric agreement is not anatomical truth.
- **EBUS:** retained-image validity, anatomy/device/media review, unsafe-flag proposals and guideline recall remain unresolved.
- **PI and all observation guides:** no learner/technologist/faculty usability session was conducted. PI-02 and BF-03 forms remain preparations, not results. English fallback and translation approval remain distinct.

## NOT RUN

- Full repository Jest, all existing E2E specs, repository-wide lint, production-server browser smoke, deployment, G02, or any clinical/source currency review.
- Safari/Firefox, real touch devices, VoiceOver/screen readers, full keyboard-only traversal, native zoom matrix or formal accessibility certification.
- Every lesson/case/device profile and every unsafe choice. The report's route and interaction tables define the actual browser coverage.
- A real embedded EBUS image acquisition/hold handshake; the browser checked refusal/skip and existing tests check the handshake. BF complete survey/report and all BBT marking/anatomy cases were not rerun in Chromium.
- The ECMO drill-panel “holds no copy” paragraphs and recirculation wording were **not established by this smoke script**: its selected step/disclosure assertions did not locate them. The hub's absence-of-protocol statement, current drill control wording, floor/ceiling teaching and optional explanation were observed; the complete ECMO renderer/content suites passed. Do not substitute their passing unit coverage for an unobserved browser state.
- Real authenticated account hydration/network synchronization, database/Supabase/upload operations, actual learner records, record migration or deletion.
- Device Intelligence, Airway Stent Mechanics and ICU Simulation feature audits. Scope history was inspected, not their product behavior.

**No requested module was wholly omitted:** all nine have feature-test and public-route coverage. The limits above remain limits, not implicit passes.

## Exact commands and replay notes

Commands ran in the active checkout unless a `cd` is shown. Outputs were redirected to the evidence directory; no relevant tests were skipped to obtain green output.

```sh
git fetch origin
git switch -c codex/integration-01-validation origin/main
git rev-parse HEAD
npm run build > /tmp/integration-01/build.log 2>&1

node node_modules/jest/bin/jest.js src/features/bronchoscopy-foundations src/features/peripheral-imaging src/features/bronchial-branch-tracing src/features/ebus-guided src/features/cardiohelp-ecmo src/features/baxter-crrt src/features/icu-hemodynamics src/features/mechanical-ventilation src/features/mechanical-circulatory-support src/features/critical-care src/features/learning-module src/features/account src/features/dashboard src/features/recommendations --runInBand --json --outputFile=/tmp/integration-01/combined.json

node node_modules/jest/bin/jest.js 'src/app/\[locale\]/(bronchoscopy-foundations|peripheral-imaging|bronchial-branch-tracing|ebus-guided|cardiohelp-ecmo|baxter-crrt|icu-hemodynamics|mechanical-ventilation|mechanical-circulatory-support|critical-care)' src/app/api/critical-care/progress src/lib/site-auth src/lib/airway-anatomy src/lib/draft-modules.baxter-crrt.test.ts src/lib/site-search.baxter-crrt.test.ts src/app/sitemap.baxter-crrt.test.ts --runInBand --json --outputFile=/tmp/integration-01/routes.json

node node_modules/jest/bin/jest.js src/features/baxter-crrt/__tests__/g01SourceReviewQueue.test.ts src/features/critical-care/__tests__/accessibility.test.tsx src/features/critical-care/__tests__/curriculum-sequencing.test.tsx src/features/critical-care/__tests__/learner-copy.test.ts src/features/bronchial-branch-tracing/__tests__/contracts.test.ts --runInBand --json --outputFile=/tmp/integration-01/current-failures.json

git worktree add --detach /tmp/integration-01-baseline 9ef04539
ln -s /Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/codex-integrated-build/node_modules /tmp/integration-01-baseline/node_modules
cd /tmp/integration-01-baseline
node node_modules/jest/bin/jest.js src/features/critical-care/__tests__/accessibility.test.tsx src/features/critical-care/__tests__/curriculum-sequencing.test.tsx src/features/critical-care/__tests__/learner-copy.test.ts src/features/bronchial-branch-tracing/__tests__/contracts.test.ts --runInBand --json --outputFile=/tmp/integration-01/baseline-failures.json
git switch --detach b32d9cd6
node node_modules/jest/bin/jest.js src/features/baxter-crrt/__tests__/g01SourceReviewQueue.test.ts src/features/critical-care/__tests__/curriculum-sequencing.test.tsx --runInBand --json --outputFile=/tmp/integration-01/pre-shared02.json
git switch --detach a465b486
node node_modules/jest/bin/jest.js src/features/baxter-crrt/__tests__/g01SourceReviewQueue.test.ts --runInBand --json --outputFile=/tmp/integration-01/post-shared02.json
cd /Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/codex-integrated-build

NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only node node_modules/next/dist/bin/next dev --webpack --port 3137

BRONCH_FOUNDATIONS_BASE_URL=http://127.0.0.1:3137 PERIPHERAL_IMAGING_BASE_URL=http://127.0.0.1:3137 node node_modules/@playwright/test/cli.js test -c /tmp/integration-01/playwright.config.cjs -g 'all 18 public cases|real device actions|Learn supports no answer|compact legacy Assess|worked CRRT cases|one entry, explanation before|survey left without|integrated cases open|projection teaching|old Assess address|a practice case explains|self-paced journey|former Assess address|readable comparison|reload and return use'
node node_modules/@playwright/test/cli.js test -c /tmp/integration-01/rerun-config.cjs -g 'compact legacy Assess'

node /tmp/integration-01/smoke.cjs
node /tmp/integration-01/recheck-routes.cjs
node /tmp/integration-01/followups.cjs
node /tmp/integration-01/followups-v2.cjs
node /tmp/integration-01/followups-v3.cjs
node /tmp/integration-01/followups-v4.cjs
node /tmp/integration-01/ecmo-final.cjs
node /tmp/integration-01/ecmo-final-v2.cjs

npm run type-check
NODE_OPTIONS=--max-old-space-size=8192 npm run type-check

git diff --name-only 8ef7001b..HEAD -- src/features/ip-device-intelligence src/features/device-intelligence src/features/airway-stent-mechanics src/features/icu-simulation
git rev-list --first-parent 9ef04539..HEAD
# For each returned commit, inspect git diff --name-only <commit>^1 <commit>.
# scope.json records every inspected commit and the empty excluded-path match list.
git diff a465b486^1 a465b486 -- src/features/baxter-crrt/components/BaxterCrrtModuleFrame.tsx
git show b71f93f3 -- src/features/mechanical-ventilation/components/stage/VentilationPeepComparison.tsx
git show 65a99815 -- src/features/mechanical-circulatory-support/components/stage/McsUnloadingComparison.tsx
```

The temporary Playwright config selects only the five named spec files, one Chromium worker, zero automatic retries, 1440×900 default viewport, and the already-running local server. The preserved scripts/configs make the ad-hoc browser observations replayable without adding a test framework or modifying tracked tests. Browser attempts are recorded separately; failed exploratory assertions are not included as passes.

Only this validation report is proposed for the repository. Stop here; no repair, release, merge, clinical sign-off or G02 is authorized by this report.
