# CRRT-FELLOW-04 independent sanity review — PR #275

Review date: 2026-09-23. **SANITY REVIEW: READY TO MERGE**, following the bounded balance-feedback repair and validation below. This is a software/content-presentation review, not clinical or device approval. No merge, deployment, or Batch 05 work was performed.

## Exact state and review isolation

- Original reviewed and fetched PR head: `e07a32bbaf8de5466aeb7a6fe6f05cc59ca459a1` (implementation `a28e335e154e7704841e4da1e02db5d919797388`).
- Original base, current main, and merge base: `a306d8250ec10207c750f46407f151c06d487707`.
- At initial and pre-final fetch: OPEN, MERGEABLE, CLEAN; 2 ahead / 0 behind main. Worktree scope / Registry scope: SUCCESS. Main drift: zero; overlapping intervening-main paths: none. No main integration commit was needed.
- Repair commit: d4ec0abe0cc6530eb68597da3a089a16cbdd9d9e. The final PR head is the documentation commit containing this report; its exact SHA is recorded in the final task handoff because a commit cannot contain its own hash. It descends from the original PR head without rewriting history.
- Isolated review checkout: `Interventional-Pulm-Education-Worktrees/codex-crrt04-review`, branch `codex/crrt04-sanity-review`. Untouched-main comparison checkout: `codex-crrt04-base`, detached at the SHA above. Original Claude checkout remained untouched.
- Identical dependency installation: both checkouts symlink the same existing `claude-crrt-04/node_modules`; training-app dependencies similarly linked for the build. These local symlinks are not committed. Separate build output and fresh Playwright Chromium contexts. Review port 32775; main reproduction port 32776. Synthetic preview URL/key only; production build used `NEXT_PUBLIC_MODULE_FEEDBACK_MODE=owner-local` to exercise that route. No environment-file edits, backend writes, or signed-in browser use.
- Governing material: repository AGENTS/CLAUDE instructions, local-authoring-assets policy, implementation-pack START_HERE, COMMON_CONTRACT, FEEDBACK_LEDGER, SOURCE_AND_CODE_NOTES, CROSS_MODULE_COORDINATION, OWNER_DECISIONS and Batch-04 prompt; Batch-01–03 handoffs/reviews; Batch-04 handoff, copy sheet and owner proposals. Prior reports were treated as claims to check, not evidence of this run.

## Findings repaired during review

### REGRESSION REPAIRED — tolerance overlap falsely identified a misconception

`balanceFeedback.ts` originally discarded candidate errors within 0.5 mL of the correct answer before testing uniqueness. Those candidates can still be within 0.5 mL of an incorrect entry.

Reproduction: external intake 121.2 mL, urine 0.4 mL, other output 0.8 mL, net removal 20 mL, device gain zero, recorded balance 100 mL, four-hour window, effluent 5,000 mL. Entry **100.6 mL** is close to both urine-omitted **100.4** and other-output-omitted **100.8**. Original feedback falsely named only “other output left out.” The repair counts every modeled candidate near the entry; this collision now produces the general hint. The early correct-entry tolerance check remains unchanged.

### FIXED — unavailable ledger terms override a stale cached total

The public feedback helper originally trusted a finite `balanceMl` even when required urine or removal was null. A deliberately inconsistent chart could therefore return “matches” or diagnose using zero for missing urine. Current lesson callers already return a null total for those conditions; this was defensive contract coverage, not a newly demonstrated live-route failure.

Both diagnosis and feedback now require finite, available intake, urine, other output, removal, device gain and recorded balance. Missing terms return unavailable immediately, with the worked calculation and explanation. No arithmetic, engine, storage or clinical rule changed.

The new independent suite failed **3 assertions before repair** and passed afterwards. Coverage includes all 13 modeled mistakes, correct/arbitrary/empty entries, equal and tolerance-overlapping candidates, missing urine/removal, zero terms/balance, one-hour window, negative/large balances and the strict 0.5 mL boundary. No error category or attempt counter is persisted.

## F-18 duplicate debrief: REGRESSION REPAIRED / F-18 LEFTOVER FIXED

On unchanged main, opened CRRT-13, performed only “Assess the patient and treatment,” then ended the run. The second generic panel displayed “Your clinical model” with authored correction/resolution, raw `intervention performed` and `debrief revealed` labels, and a worked “What happened” chain despite no corrective action. This both duplicated the causal debrief and risked representing unperformed actions as actual history.

The final production build shows one CRRT causal debrief and no generic panel. The retained `CrrtCasePlayer` independently supplies actual performed/refused actions, time decomposition, actual reassessment or “not recorded,” active/resolved modeled cause, supported evidence, safety findings including unperformed unsafe examples, explicitly labeled supplied teaching path, transfer question, and reset. Keyboard/mobile paths and the debrief focus target remain covered. Reset/Replay was not unique to the removed panel. Shared `DebriefPanel` was not modified. Retain the CRRT-local suppression.

## Teaching and semantic contracts

| Area                        | Independent disposition and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-06 — 25 Learn questions   | **PRESENTATION FIXED / CLINICAL MEANING UNCHANGED.** Rendered every authored question through the real lesson/task map. All offer optional try, reveal-first with no answer selected/submitted, full option rationales, hide, skip and no performance persistence. A separate 25-item presentation matrix supplies a ready operational state and checks wrong/accepted answer-first plus retry; real observation prerequisites remain tested by the unmocked reveal/skip matrix and existing operational journeys. Verdicts appear after check/reveal only. No requirement to answer correctly to navigate.                                                                 |
| Question identity           | Compared all 25 registries against main: stems, option IDs, option labels and accepted keys unchanged. Only two feedback strings differ (US spelling and removal of “first choice retained” language). Lesson-8 task-6 instruction no longer prints the answer; its key and clinical content remain unchanged. This does not claim distractor quality/cueing is fully repaired: nine substantive rewrites remain proposals.                                                                                                                                                                                                                                                 |
| F-07 — five rapid drills    | **FIXED.** All five original drill definitions, options and safety dispositions are identical to main. Shared renderer hides option descriptions/verdicts before choice or worked reveal, asks for the first response, exposes safety teaching on reveal-first, supports retry/reset, and saves no score/attempt. Authored safety explanations remain present.                                                                                                                                                                                                                                                                                                              |
| F-07 — action cards         | **PRESENTATION FIXED / CLINICAL MEANING UNCHANGED.** Reviewed all 13 keyed description replacements and common adapted-card description. Bodies describe the action or that it merely records a plan; labels still identify the action, the list warns that unsafe choices exist, and Explain this case/post-action/debrief retain safety explanations. All 18 cases retain identical action IDs, labels, prerequisites, effects, safety classifications and critical-error conditions in the independent normalized comparison. No dangerous action was recast as a recommended one.                                                                                       |
| F-19 — sources/review truth | **FIXED** presentation; **OWNER/SOURCE HOLD** status. Inspected citation projection, source lists/dating/evidence/glossary disclosures and records in provenance/clinical source registries. Manual/publication identity, registered edition/page/section, source kind, limitations and review state remain available. Exact audit ID/version/section/status/reviewer/implementation location remain one disclosure away. `sme-review` is explicitly a release-stage string, never human approval; pending/null reviewer remains no review/no reviewer. Document checking is distinct from clinical review; synthetic values are teaching values, not patient measurements. |
| Generic alerts              | **FIXED.** All 13 generic engine alert labels use the shared simulation-label map; unknown codes fall back to “Simulated alert.” Inspected learner consumers and rendered CRRT-13. No raw `ACCESS_OBSTRUCTION` reaches its alert UI. No manufacturer alarm title, priority, color, reset/acknowledgment rule or automatic pump behavior was invented. Source-mapped device references remain separate.                                                                                                                                                                                                                                                                      |
| F-20 — Visited              | **FIXED.** Eye/Visited plus accessible “opened on this device; not a record of completion.” Pristine/open-lesson-leave/open-case-leave/skip-all/review-worked-explanations/hub/reload browser probe saved only self-paced navigation. Legacy arrays/history stay structurally and value-identical in existing storage tests. Hub completion-shaped helper input is local/read-only and used only for next-unvisited/all-opened navigation; no completion, mastery, competence or correctness is written or surfaced.                                                                                                                                                        |
| F-21 — balance              | **REGRESSION REPAIRED**, as above. Immediate worked calculation, sign convention, window/units and distinct patient/circuit ledgers remain. A number earns a named error only if one modeled candidate matches. Ambiguous or arbitrary entries get general guidance. Reveal/retry/continue do not require a second miss or save a category.                                                                                                                                                                                                                                                                                                                                 |
| Makeup                      | **OWNER/SOURCE HOLD.** Glossary and teaching explicitly leave patient-ledger attribution unresolved. Reviewed cumulative makeup guard through fluid ledger, recorded-balance chart, evidence and debrief. Nonzero makeup history makes exact cumulative removal/balance unavailable; it is not inferred from effluent. Existing model/consumer tests exercise the hold.                                                                                                                                                                                                                                                                                                     |
| F-23 — pressure             | **FIXED.** Six separate comparisons carry prediction/no-prediction, observed direction, worded match/mismatch and explanation/numbers. Independent tests make each signal wrong alone and test all correct; existing rendered tests cover reveal-first, multiple wrong signals, deliberate TMP/drop errors and revise. Across all five supported sites, TMP delta equals half filter-plus-return delta minus effluent delta, and drop delta equals filter-minus-return delta. These are pattern-derived, not canned verdicts. No score/“4 of 6”/percentage/persistent first attempt. Batch-03 fractional `≈` versus `=` fix is unchanged and passes.                        |
| F-25 — reset                | **FIXED.** Restart lesson replaces the in-memory lesson attempt/run and returns to its beginning. Reset case creates a fresh run for the same selected case (clears actions/time/answers and resets prescription), retaining case identity and visited/legacy storage. Reset this drill clears only that drill's choice/reveal/reviewed steps. Labels and adjacent scope notes match these mutations. Shared chrome's generic Reset label remains a separately identified platform item; its CRRT callback has the same local reset scope.                                                                                                                                  |
| Lesson 8                    | **FIXED.** `Pressure-profile integration` matches registry, activity/pathway, picker/header/hub and previous/next/deep-link flows. Stable ID `crrt-pressure-profile-integration`, order, prerequisites and duration unchanged. No storage migration.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| X-01 — orientation/minutes  | **FIXED.** Audience, outcomes, optional order and Visited meaning are stated. Existing minute values are unchanged and labeled estimates/unvalidated, not observed completion times. Shared per-section badge redesign remains **GLOBAL/OTHER OWNER**.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| X-04 — reused cases         | **FIXED.** Registry-derived reuse notes cover CRRT-04/13 in Lesson 5, CRRT-10 in Lesson 7, CRRT-14 in Lesson 8, with task ranges. Learn calls them guided Practice cases; Practice identifies the curriculum's prior guided version without claiming the learner completed/mastered it. No new variants.                                                                                                                                                                                                                                                                                                                                                                    |

## F-24 units: PRESENTATION FIXED / CLINICAL MEANING UNCHANGED

**Correction to the request's numerical premise:** untouched current main already used `concentrationMgPerDeciliter * 10` in normalization. Batch 04 centralizes that existing conversion in `concentrationUnits.ts`; it does not introduce a tenfold engine-state correction.

The dimensional conversion is `mg/dL × 10 dL/L = mg/L`; 2.9 mg/dL and 29 mg/L represent the same concentration. Authored creatinine-marker/phosphate/magnesium values remain unchanged; learner baselines still use those authored mg/dL fields, not dynamic engine pools. Tests cover round-trips and nullable helper behavior; normalization applies the conversion once.

Independent main/PR snapshots compared all 18 cases: authored initial patient, normalized engine fixture configuration, full initial simulation, full eight-hour no-action simulation, supplied baseline lab evidence, intervention semantics, unsafe classifications and critical-error conditions. **Every compared value is identical.** Thus there is no new numeric trajectory, verdict, safety condition, debrief outcome or progression effect from this conversion refactor.

Broad inventory searched `creatinine-marker`, phosphate, magnesium, `concentrationPerLiter` and authored `*MgPerDl` reads. Engine pool reads stay private to normalization/engine; learner lab/evidence selectors use supplied baselines and withhold unsupported evolving chemistry. The worked-case solute marker read is urea, not a new mg-based lab consumer. Prior prohibited-solute verdict guards pass. Unsupported physiology remains **MODEL NOT IMPLEMENTED**, irrespective of dimensionally correct private arithmetic.

Total calcium was audited separately: authored nullable `totalCalciumMgPerDl` is not converted into engine `totalCalciumMmolL`; no mass-to-molar factor was added. Urea remains a small-solute marker in mmol/L, not BUN, with no BUN conversion. Edited learner prose uses US spelling while source titles/quotations/registered strings are preserved.

## Glossary: all 21 entries

All definitions were checked against the existing circuit/model semantics and the specific registered claim/formula, rather than just whether a source ID resolves. This checks consistency with registered support, not independent clinical/device adjudication.

| Entry                     | Supporting semantics/record and boundary                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| PBP                       | Canonical circuit entry before pump; MATH-PM-001/FLUID-PM-002 count its flow/volume. Citrate site explicitly configuration-dependent. |
| Dialysate                 | Existing countercurrent fluid-side path; MATH-PM-001/FLUID-PM-002; never blood infusion.                                              |
| Pre-filter replacement    | Drawing places it after pump/before filter; no new split-dependent clearance/FF/pressure model claimed.                               |
| Post-filter replacement   | Drawing's return-side port; distinct from pre-filter port.                                                                            |
| Syringe                   | Separate flow term in MATH-PM-001 and FLUID-PM-002; no drug, dose or infusion-site prescription.                                      |
| Makeup                    | Qmakeup in effluent expression, absent in patient-removal subtraction; attribution explicitly unresolved.                             |
| Effluent                  | MATH-PM-001 sum of enabled terms; distinguished from patient fluid loss.                                                              |
| Net machine removal       | FLUID-PM-002 `Veff − Vpbp − Vdial − Vrep − Vsyr`; FLUID-PM-001 distinguishes patient balance; makeup caveat retained.                 |
| Whole-patient balance     | Existing external-input/output/device ledger and FLUID-PM-001 distinction; missing urine is unavailable.                              |
| Prescribed flow           | Existing entered setting and units; persists when pump stopped.                                                                       |
| Actual flow               | Existing pump/connection gate; zero when stopped/disconnected; GUID-RRT-ICU-2026 supports prescribed/delivered distinction.           |
| Prescribed/delivered dose | DOSE-PM-001 weight-normalized effluent; existing interval accounting; TEXT-CRRT-NEYRA-2026; not measured clearance/target.            |
| Downtime                  | Existing explicit elapsed-time accounting; no duration invented by same-time pause/resume; GUID-RRT-ICU-2026.                         |
| Diffusion                 | Existing mechanism teaching and REVIEW-CKRT-CORE-2025 registered transport claim.                                                     |
| Convection                | Existing sieving/solute-with-water teaching and same registered transport source; no patient outcome claim.                           |
| Ultrafiltration           | Existing water-through-membrane teaching and same source; distinct from net removal/convection.                                       |
| TMP                       | MATH-PM-002 printed expression and −18 term; calculated, not a measured site or alarm limit.                                          |
| Filter drop               | DEV-PM-010; simulation's −25 explicitly described with G01-CRRT-02 placement hold, not adjudicated.                                   |
| Urea marker               | Engine's unsupported teaching pool in mmol/L; not measured urea/BUN or modeled clinical trajectory.                                   |
| Creatinine marker         | Supplied mg/dL baseline; not a treatment trend or renal-recovery verdict.                                                             |
| Simulated alert           | Existing generic fault/acknowledgment behavior; not source-mapped manufacturer alarm behavior.                                        |

Glossary keyboard entry, group-heading focus, Escape/return focus, narrow layout and 200% root text pass. Draft/no-clinical-review wording stays visible. Six viewport screenshots were independently viewed, including the narrow and enlarged glossary, optional answer feedback, drill safety example, per-signal pressure explanations and mobile debrief.

## Owner proposals, queue and holds

**PROPOSED FOR OWNER REVIEW:** exactly ten substantive proposals, nine question rewrites plus one Lesson-5 split. All remain NOT REVIEWED / PROPOSED FOR OWNER REVIEW. No proposed distractor/key/clinical anchor/route split appears in runtime. Canonical lesson IDs and accepted keys match main.

**OWNER/SOURCE HOLD:** O-01 through O-10, CONFLICT-001, CONFLICT-002, G01-CRRT-02 and all clinical/device review states unchanged. G01 queue has exactly four changed leaves: learnerWording and laterWordingChange for G01-CRRT-08 and G01-CRRT-10. No reviewerDecision, decision status, reviewer/date, adjudication or −25-placement decision changed. `latencySeconds` remains unused; MAP remains held; CRRT-05/15/16/17/18 limitations are not promoted to implemented models.

## Exact shared-test comparison

Both checkouts used the same Node/dependency installation and command, with only output filenames differing:

```sh
NODE_OPTIONS=--max-old-space-size=8192 npx --no-install jest --runInBand   src/features/baxter-crrt src/features/critical-care src/features/learning-module   'src/app/.*/baxter-crrt' src/app/api/analytics   src/app/sitemap.baxter-crrt.test.ts src/features/module-beta   --json --outputFile=/tmp/crrt275-review/final-review.json
```

The route regex deliberately includes both bracketed-locale route suites. An earlier over-escaped route regex omitted them; that incomplete run was superseded, not counted as the final gate.

| Failing assertion (one each on PR/main)                                                                                    | Expected / received comparison                                                                                                                                                                                                                                                                                                                                                                                              | Location on both                                          |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `critical-care accessibility surfaces keeps color-coded circuit, pressure, alarm, and trend states readable without color` | Expected an img name matching `/patient access, access catheter, access line, filter, return line, then patient return/i`. Both instead expose the long canonical “Universal CRRT circuit topology Pressure profile…” name. PR name differs only by two `modelled` → `modeled` spellings. Same missing-match assertion, not missing diagram or a new assertion. Full DOM dumps are not byte-identical because copy changed. | `accessibility.test.tsx:237:14`, `Object.getByRole`       |
| `activity library ordering (WP10 §4 bug A) renders CRRT cases in authored station order, not alphabetically by title`      | Same expected ordered case list; same received list with additional trailing “PrisMax troubleshooting challenge.” Failure text and stack byte-identical after normalizing only checkout root. Lesson-8 title is not in this case-order mismatch.                                                                                                                                                                            | `curriculum-sequencing.test.tsx:211:22`, `Object.toEqual` |
| `critical-care learner-copy framing keeps static component copy free of grading and software-internal labels`              | Expected `[]`. Main receives 22 findings; PR receives 12. Every PR finding is an exact unchanged object from main (copy/file/line/terms). Ten CRRT findings removed; **zero CRRT findings remain**. Remaining 12 are MCS/MV only. This is an improved subset, not literally identical received output.                                                                                                                      | `learner-copy.test.ts:194:22`, `Object.toEqual`           |

Final PR: **130 suites, 1,480 passed / 3 failed**. Main: **123 suites, 1,321 passed / 3 failed**. Difference is Batch-04's 85 tests plus 74 independent review tests. Same three failure identities/locations; no new PR-only failure. Shared tests were neither changed nor weakened. The precise conclusion is equivalent existing failure causes, with intentional spelling/copy-output differences—not “all failure output is identical.”

## Deferred anomalies reproduced on both main and final production

- **DEFERRED / Batch-06 or prior owner:** CRRT-15 at t=0 shows access −40.5 in evidence, −40 in the live pressure profile, and −41 on the device surface. Reproduced independently with identical starting fixtures and surfaces; Batch 04 did not introduce or worsen the inconsistent rounding.
- **DEFERRED / Batch-06 or prior owner:** same case at t=0 shows device “MACHINE REMOVAL / WHOLE BALANCE: 0 mL / 0 mL,” while evidence says “Unavailable · Unavailable.” Same on main/final; no change to the underlying data. This is a retained display inconsistency, not evidence that missing data equals zero.
- **GLOBAL/OTHER OWNER:** global header's known 51 px overflow at 1280 px/200% root text persists; CRRT-local content reflows. Shared Reset label and per-section minute badges retain their previous platform ownership.

## Validation and limits

| Gate                                                                       | Result                                                                                                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Batch-04 targeted Jest (five original plus two review suites)              | 159 passed; all included in final full command                                                                                                          |
| Complete CRRT and relevant shared/route/analytics/sitemap/module-beta Jest | 1,480 passed, three precisely characterized existing shared failures, 130 suites; CRRT alone 969/969 tests in 81 suites                                 |
| Untouched same-current-main identical Jest command                         | 1,321 passed, same three assertion failures, 123 suites                                                                                                 |
| CRRT development Playwright, final runtime                                 | 67 passed, one expected owner-local-only skip                                                                                                           |
| CRRT production Playwright                                                 | 68 passed, none skipped                                                                                                                                 |
| CRRT systemic UX/layout, production                                        | 72 passed                                                                                                                                               |
| Production build                                                           | PASS, full `npm run build`: training apps/content/assets/Next/standalone preparation; actual browser suite served that build with `next start`          |
| Type-check                                                                 | PASS, with 8 GB Node heap and development server stopped                                                                                                |
| Changed-file ESLint / Prettier / `git diff --check`                        | PASS, all changed paths; review additions rechecked after typing corrections                                                                            |
| Independent browser probes                                                 | Main duplicate debrief and two anomalies reproduced; final single debrief and identical anomalies; visited/open/skip/review/reload storage probe passed |
| Independent numerical/registry probe                                       | 18/18 case snapshots and 5/5 drills unchanged; all 25 question stems/options/keys unchanged                                                             |

Browser matrix: 1440×900, 1280×900, 1024×768, 390×844, 320×740, and 1280×900 with 200% root text. Public Learn/Practice/Challenge, optional reveal/answer paths, source disclosures, glossary, numeric feedback, pressure comparison, alert/reuse labels, reset/debrief, forward/reverse keyboard traversal, Enter/Space/Escape, focus visibility and return focus, URL case identity/Back/Forward/reload, machine review/start authority, reading perspective, Help and wrapping regressions are exercised by the passing suites. Owner-local-only test skips in dev because that environment flag is absent; it runs in the production build explicitly configured with that flag.

Review-created test harness issues were corrected before the final gate: an initial wrong case-title selector, a wrongly substituted debrief assertion, Testing Library typing options, and a type-check/dev generated-file race. These were harness failures, not passes or product repairs. A default-memory type-check also exhausted Node heap; final type-check uses the same explicit 8 GB limit as the full Jest gate.

Raw evidence remains outside Git at `/tmp/crrt275-review/`: before/after test logs, both final Jest JSON files and failure extracts, build/type/lint/format logs, dev/prod/systemic Playwright output/screenshots, main/PR debrief and CRRT-15 text/screenshots, runtime snapshot JSON and visited-browser JSON. Reproducible independent tests are committed. Scratch browser/config/probe scripts are local ignored artifacts, not authoring inputs copied into source.

**NOT RUN:** human screen-reader testing, native browser zoom, Safari/Firefox, physical devices/touch, localization validation, real-learner sessions/timing, clinical review, device review, real PrisMax console, production deployment, account-sync testing, and standalone-package portability. Registered-source consistency does not lift any clinical/device hold.

## Exhaustive changed-path scope

All paths below are relative to the repository and classified against current main, including this review's additions. Shared critical-care changes are exactly one CRRT Lesson-8 title literal in each file. No unrelated/shared behavior or tests changed. Test-config change is CRRT-only suite registration. Original PR: 86 paths; this review adds two CRRT test files and this report.

### 1. CRRT implementation (56 paths)

- `src/features/baxter-crrt/actualRunReview.ts`
- `src/features/baxter-crrt/balanceFeedback.ts`
- `src/features/baxter-crrt/caseEvidence.ts`
- `src/features/baxter-crrt/caseReuse.ts`
- `src/features/baxter-crrt/components/BaxterCrrtHub.tsx`
- `src/features/baxter-crrt/components/BaxterCrrtLearnLanding.tsx`
- `src/features/baxter-crrt/components/BaxterCrrtPractice.tsx`
- `src/features/baxter-crrt/components/CrrtActivityWorkspace.tsx`
- `src/features/baxter-crrt/components/CrrtCaseEvidenceScope.tsx`
- `src/features/baxter-crrt/components/CrrtCaseNavigator.tsx`
- `src/features/baxter-crrt/components/CrrtCasePlayer.tsx`
- `src/features/baxter-crrt/components/CrrtCitrateDifferential.tsx`
- `src/features/baxter-crrt/components/CrrtFoundationLesson.tsx`
- `src/features/baxter-crrt/components/CrrtFoundationTools.tsx`
- `src/features/baxter-crrt/components/CrrtGlossary.tsx`
- `src/features/baxter-crrt/components/CrrtIntegrationTool.tsx`
- `src/features/baxter-crrt/components/CrrtLivePressureDevice.tsx`
- `src/features/baxter-crrt/components/CrrtLivePressureStation.tsx`
- `src/features/baxter-crrt/components/CrrtOperationalTools.tsx`
- `src/features/baxter-crrt/components/CrrtPilotCircuit.tsx`
- `src/features/baxter-crrt/components/CrrtPressureLocalizationLab.tsx`
- `src/features/baxter-crrt/components/CrrtRapidDrillReview.tsx`
- `src/features/baxter-crrt/components/CrrtSourceDating.tsx`
- `src/features/baxter-crrt/components/CrrtSourceRecord.tsx`
- `src/features/baxter-crrt/components/CrrtStagedPrescriptionBuilder.tsx`
- `src/features/baxter-crrt/components/CrrtWorkbench.tsx`
- `src/features/baxter-crrt/components/CrrtWorkedCaseExample.tsx`
- `src/features/baxter-crrt/components/PrismaxPilotInterface.tsx`
- `src/features/baxter-crrt/components/SourcesPanel.tsx`
- `src/features/baxter-crrt/components/baxter-crrt.module.css`
- `src/features/baxter-crrt/components/crrt-case-player.module.css`
- `src/features/baxter-crrt/components/crrt-foundations.module.css`
- `src/features/baxter-crrt/components/crrt-glossary.module.css`
- `src/features/baxter-crrt/components/crrt-pressure-localization-lab.module.css`
- `src/features/baxter-crrt/components/crrt-rapid-drill-review.module.css`
- `src/features/baxter-crrt/components/crrt-source-dating.module.css`
- `src/features/baxter-crrt/content/advancedLessons.ts`
- `src/features/baxter-crrt/content/alertLabels.ts`
- `src/features/baxter-crrt/content/caseEvidenceScope.ts`
- `src/features/baxter-crrt/content/circuitModel.ts`
- `src/features/baxter-crrt/content/completeCases.ts`
- `src/features/baxter-crrt/content/concentrationUnits.ts`
- `src/features/baxter-crrt/content/foundationLessons.ts`
- `src/features/baxter-crrt/content/glossary.ts`
- `src/features/baxter-crrt/content/learnLessons.ts`
- `src/features/baxter-crrt/content/operationalLessons.ts`
- `src/features/baxter-crrt/content/prismaxSimulator.ts`
- `src/features/baxter-crrt/content/runtimeCaseNormalization.ts`
- `src/features/baxter-crrt/content/sourceReviewMetadata.ts`
- `src/features/baxter-crrt/content/stateLabels.ts`
- `src/features/baxter-crrt/engine/deviceAdapters/prismax.ts`
- `src/features/baxter-crrt/labEvidence.ts`
- `src/features/baxter-crrt/operationalModel.ts`
- `src/features/baxter-crrt/pressureLocalizationLabModel.ts`
- `src/features/baxter-crrt/sourcePresentation.ts`
- `src/features/baxter-crrt/stagedPrescriptionModel.ts`

### 2. CRRT tests and CRRT-only browser configuration (26 paths)

- `e2e/baxter-crrt-advanced.spec.ts`
- `e2e/baxter-crrt-batch03-sanity.spec.ts`
- `e2e/baxter-crrt-fellow04.spec.ts`
- `e2e/baxter-crrt-foundations.spec.ts`
- `e2e/baxter-crrt-operations.spec.ts`
- `e2e/baxter-crrt-self-paced.spec.ts`
- `playwright.baxter-crrt.config.ts`
- `src/features/baxter-crrt/__tests__/CrrtLivePressureDevice.test.tsx`
- `src/features/baxter-crrt/__tests__/CrrtPilotCircuit.test.tsx`
- `src/features/baxter-crrt/__tests__/CrrtRapidDrillReview.test.tsx`
- `src/features/baxter-crrt/__tests__/advancedLessons.ui.test.tsx`
- `src/features/baxter-crrt/__tests__/circuitModel.test.ts`
- `src/features/baxter-crrt/__tests__/fellow04AllQuestionsSanity.test.tsx`
- `src/features/baxter-crrt/__tests__/fellow04BalanceFeedback.test.tsx`
- `src/features/baxter-crrt/__tests__/fellow04IndependentSanity.test.ts`
- `src/features/baxter-crrt/__tests__/fellow04MarkersGlossaryUnitsResets.test.tsx`
- `src/features/baxter-crrt/__tests__/fellow04PressureComparison.test.tsx`
- `src/features/baxter-crrt/__tests__/fellow04SourcesAndAlerts.test.tsx`
- `src/features/baxter-crrt/__tests__/fellow04TeachingFeedback.test.tsx`
- `src/features/baxter-crrt/__tests__/learnOrderAndTaskControls.test.tsx`
- `src/features/baxter-crrt/__tests__/livePressureProvenance.test.tsx`
- `src/features/baxter-crrt/__tests__/operationalLessons.ui.test.tsx`
- `src/features/baxter-crrt/__tests__/outputTruthAndDebrief.test.tsx`
- `src/features/baxter-crrt/__tests__/selfPaced.test.tsx`
- `src/features/baxter-crrt/__tests__/sourceReviewMetadata.test.tsx`
- `src/features/baxter-crrt/__tests__/workbenchWayfinding.test.tsx`

### 3. CRRT documentation/review queue (5 paths)

- `docs/gap-remediation/fellow-review/CRRT-FELLOW-04-copy-sheet.md`
- `docs/gap-remediation/fellow-review/CRRT-FELLOW-04-handoff.md`
- `docs/gap-remediation/fellow-review/CRRT-FELLOW-04-owner-proposals.md`
- `docs/gap-remediation/fellow-review/CRRT-FELLOW-04-sanity-review.md`
- `docs/gap-remediation/self-paced/G01-crrt-source-review-queue.json`

### 4. Narrow shared CRRT registration/title metadata (2 paths)

- `src/features/critical-care/content/activities.ts`
- `src/features/critical-care/content/learningPathways.ts`

### 5. Unrelated/shared change requiring justification (0 paths)

None.
