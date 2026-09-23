# CRRT-FELLOW-03 independent sanity review — PR #268

Review date: 2026-09-22. **SANITY REVIEW: READY TO MERGE.** No material Batch-03 defect remains after the repairs and reconciled validation below. No merge, deployment, or Batch 04 work is authorized or performed.

## Repository and review boundary

- Original Batch-03 base / original merge base: `745146f6e40bd536c201313f0480ddde2ee03ca3`.
- Original reviewed head and remote head at both fetches: `cbc49896dcf96d3bf03aa4ff1398d44f168a94f0`.
- First fetched main: `b9fa0483f0551ed055a4e370afaafdec4eb49c14`; PR was 2 commits ahead / 26 behind, OPEN, MERGEABLE, CLEAN. Integrated without conflicts in `3c1db6d2a134546c0f4fb69b245d83db19203586`.
- Main advanced during review through ECMO PR #267. Final integrated main: `bc65b44a73b4de034077d8432c0e78b35f6e45e6`; the original PR was then 2 ahead / 37 behind; second non-destructive integration: `ff2143746827370e77b8cb09bff99a38007edee5`.
- Repair / final implementation head: `5ec1e33d8bd4d1394d80cb614d548461eccd3b70`. The final PR head is the documentation-only commit titled `docs(crrt): record independent Batch 03 sanity review` that records this report. Its exact hash is reported with the final PR update; a commit cannot contain its own hash.
- All 165 paths changed on main since the original base are listed in the appendix. **Zero overlap** with the original 42 PR paths. Main includes MV, bronchoscopy foundations, Socrates, shared authentication, launch configuration, and ECMO; the handoff's narrower main-work assumption was stale. Those changes were preserved.
- Isolated review worktree: `Interventional-Pulm-Education-Worktrees/codex-crrt03-review`, branch `codex/crrt03-sanity-review`. Original implementation checkout untouched. A detached original-base worktree independently reproduced defects. Ports: review dev 3168, production 3169, base 3170. Fresh Chromium contexts, synthetic local configuration, no production credentials or backend writes.

Read root instructions, Batch-01/02 handoffs and sanity reviews, Batch-03 handoff, and the local implementation pack's COMMON_CONTRACT, OWNER_DECISIONS, SOURCE_AND_CODE_NOTES, CROSS_MODULE_COORDINATION, FEEDBACK_LEDGER, and batch-03 prompt. Reviewed the source, changed tests, rendered behavior, and main integration independently.

## Findings and repairs

### REGRESSION REPAIRED — false equality in rounded pressure arithmetic

On the original PR, finite raw pressures filter 50.4, return 20.4, effluent −20.4 produce authoritative TMP 37.8, displayed as 38 mmHg. The visible rounded inputs instead produce `(50 + 20) ÷ 2 − (−20) + (−18) = 37`; the original component falsely printed `= 38`. A subsequent rounding note did not repair that equality.

`pressureArithmetic.ts` now uses `=` only when the visible calculation exactly equals the displayed rounded engine result, otherwise `≈`. Three actual component-render regressions failed before the fix and pass afterwards: that TMP case; filter-drop inputs 50.6/20.4 (visible calculation 6 versus engine 5.2, displayed 5); and integer TMP inputs whose visible calculation is 37.5 while the tile displays 38. The latter demonstrates why `roundedTermsReproduceResult` alone cannot authorize an equality.

A real browser journey through CRRT-15 → Machine + circuit → TMP confirms `(70 + 31) ÷ 2 − (−20) + (−18) ≈ 53 mmHg`, with the tile still 53. No raw pressure, adapter, formula, constant, or engine result changed. Existing exact equalities remain exact. No-flow validity remains separately and visibly qualified at each call site.

### REGRESSION REPAIRED — keyboard jump focused an offscreen destination

At 1440×900, Learn `crrt-solute-transport`, activating “Go to this task's continue controls” without reduced motion focused controls around y=1462 while the viewport was still near scrollY=10. They became visible only as smooth scrolling completed. Reduced-motion behavior alone concealed this defect.

The local handler now explicitly uses instant `scrollIntoView` followed by `focus({ preventScroll: true })`. Regression tests require visible, uncovered, outlined keyboard focus immediately after one activation, with both motion preferences. The normal-motion regression failed before the repair; both now pass. No site-wide scrolling rule changed.

### REGRESSION REPAIRED — Evidence cards overflowed inside a narrow drawer

CRRT-13 at 320×740: a long source locator forced approximately 444 px-wide cards inside a 245 px reading area. The original broad overflow test excluded scroll containers and missed it.

Reference and Evidence retain distinct shared Radix Sheet primitives, titles, source text, limitations, dismissal and return focus. CRRT-local wrappers/styles add a constrained grid and wrapping for long source text. No shared component or other module changed. New browser checks inspect every card's scroll width, reach the final source card, open by keyboard, dismiss, check return focus, and compare run/storage fingerprints. Both 320 px and 200% root text pass. Settled screenshots confirm an opaque, readable drawer; an initial screenshot during its entrance animation was discarded as visual evidence.

### FIXED — workbench and original defect reproduction

The original base was actually served and inspected; these are DOM measurements, not a screenshot comparison. Widths below are client/scroll widths of the evidence region, in CSS pixels.

| Viewport                 | Original evidence | Reviewed evidence | Original footer | Reviewed footer | Reviewed document overflow |
| ------------------------ | ----------------- | ----------------- | --------------- | --------------- | -------------------------- |
| 1440×900                 | 1425/3625         | 395/395           | static, 58 px   | static, 47 px   | 0                          |
| 1280×900                 | 1265/3625         | 395/395           | static, 58 px   | static, 47 px   | 0                          |
| 1024×768                 | 1009/3458         | 998/998           | sticky, 58 px   | static, 47 px   | 0                          |
| 390×844                  | 351/2650          | 364/364           | sticky, 143 px  | static, 47 px   | 0                          |
| 320×740                  | 281/2601          | 294/294           | sticky, 167 px  | static, 47 px   | 0                          |
| 1280×900, root text 200% | 1265/5016         | 1230/1230         | static, 95 px   | static, 95 px   | **51 px, global header**   |

Original evidence labels were outside the viewport and/or covered by the current-task presentation; the repaired task and evidence occupy distinct flow regions. The active alert leads the evidence. Expanded objective, long safety constraints, source cards, primary actions, first/last controls, and footer remain reachable. All eight current evidence labels are hit-tested after ordinary scrolling. Case identity is now in the case heading/navigation; device details remain accessible in their disclosure. No evidence was silently discarded to reduce width.

On a tall desktop case the rail really overflows and acquires a tab stop. ArrowDown, wheel, and End move it; the last safety item is reachable; Tab and Shift+Tab leave it. At 1024 px it returns to document flow, loses the tab stop, and regains it when resized to 1440. The page itself remains scrollable. Circuit panning and modal body scrolling are intentional local scrollers, separately tested rather than counted as document overflow.

On the base, Help produced zero dialogs and zero visible Hint headings at all six sizes; focus remained on the opener. The reviewed version produces one visible modal with focus inside it. The base's tiny circuit, membrane inset and scattered exercise controls were also measured: at 1280 px, membrane figure 281×339 versus the new full-width conceptual comparison 1198×804. On mobile it changes from a single small inset to three vertically readable panels. This improves detail at the cost of page length; controls and the jump affordance remain necessary.

## Behavioral contracts

### Help and material surfaces

Practice and Challenge were tested with mouse, Enter and Space; Close, Escape and outside dismissal; initial close-button focus; forward/backward trapping; labelled title/description; actual authored first hint; constrained modal size/internal scroll; and return to the correct Help opener after navigation, role changes, reasoning-phase transitions and rerender.

A new component test observes the actual player/reducer boundary without replacing either. It compares the entire serialized session and progress bytes before and after Help, including committed prediction, machine draft, performed actions, elapsed time, committed reassessment and case identity. Browser tests independently compare URL, local storage, evidence, run text and inputs. Reference and Evidence similarly change none of those browser fingerprints. Evidence retains explicit source scope/limitations; Reference does not adjudicate sources.

### Cases and Reading perspective

All 17 Cases options were selected through the visible UI: 10 core and 7 additional. Group positions, four group boundaries, previous/next, direct URL/selection, visited labels, recommendation, invalid query, reload and browser Back/Forward remain truthful. The URL is authoritative. Position labels are navigation, not a completion percentage. Visiting cases does not create a score or completed attempt.

The handoff's literal “nothing consumes role” claim is too broad. Current consumers select the reading prompt and pressed button, validate/store role metadata, and pass it through the worked-run baseline reconstruction. There is no role-dependent engine branch, hint/evidence selection, device control, grading rule or case selection. Legacy progress helpers also accept role, but current CRRT UI does not call those attempt-writing helpers; similarly named MV code is unrelated. The UI accurately says the **reading prompt** changes and the run does not.

Switching before and after actions, prescription entry, elapsed time, interventions and reassessment, with at least six repeated named changes, preserves all session fields except the two intended role fields. No duplicate timeline event or progress write appears. Case navigation still starts the URL-selected case; role changes do not restart it.

### Learn and exercise controls

The authored eight-ID registry is the sole canonical sequence used by `learnSequence.ts`, picker, numbering, previous/next, end CTA and hub recommendation. All eight lessons, first/middle/final boundaries, direct lesson URLs, restart, Save & exit and Resume were exercised. Resume means the next unvisited topic, not restoration of a running simulation. Topic grouping is explicitly a grouping rather than a competing required sequence. Existing lesson IDs/storage schema remain unchanged.

Lesson 5's outline contains all ten authored tasks once, in its existing four-plus-six order. Visiting and reopening every task does not mark it reviewed or complete. Restart returns to the first task. Navigating to the final task and continuing does not manufacture completion of skipped prior tasks.

Exercise controls now directly follow the exercise in one labelled controls block. Multiple exercise families retain meaningful disabled reasons, optional explanation/check behavior, and secondary keyboard-reachable “Continue without this exercise.” Skipping records no correct response or score and adds no correctness gate. The repaired jump provides immediate visible focus under both motion preferences.

### Batch-01/02 preservation and pressure/source truth

The CRRT `engine/` and `content/` directories are byte-identical to the original Batch-03 base. Full suites and representative browser journeys retain canonical case identity; actual-event debrief and refused-action history; supplied-zero versus absent data; containment of unsupported/prohibited solute outputs; CRRT-04 machine-only setup/start interlock; stale prescription-review enforcement; machine-committed versus in-use settings; set Qb versus actual flow; and no-flow pressure validity.

CRRT-11 MAP stays held, CRRT-05 dilution stays MODEL NOT IMPLEMENTED, CRRT-15/16 distinguish prior history/current run/plan, CRRT-17 invents no calcium/citrate trend, and CRRT-18 invents no renal recovery. `latencySeconds` remains schema/content metadata without an engine consumer.

Both arithmetic call sites pass the raw adapter readings. TMP retains `(filter + return) / 2 − effluent − 18`; filter drop retains `filter − return − 25`. The latter is labelled the simulation's placement and explicitly awaits device review; no manufacturer conclusion was added. No-flow qualification remains visible rather than overridden by a tidy worked expression.

The G01 queue diff changes exactly eight leaf values across the first two items: learner wording, later wording change, and one learner-surface excerpt/locator for each. No reviewer decision, status, source adjudication, hold, date, or −25 placement decision changed. Relevant review remains NOT REVIEWED / held.

### Circuit, membrane and badges

Canonical paths/nodes, bags, blood/filter/return/effluent topology, pressure sites, line styles and labels are preserved. The renderer reuses the existing circuit model. Measured circuit scale increases from 0.6015 to 0.7281 at 1280 and to 0.7949 at 1440. Smallest inline glyph bounds increase from about 6 px to 7/9 px respectively: this is an improvement, **not a claim that every inline label is comfortably legible**. The expanded view is the readable detail affordance.

At 390/320 the intentionally larger drawing pans horizontally with a visible instruction and a focusable region; first/last regions are reachable, arrow keys pan, vertical scrolling remains available, and Tab leaves it. Mouse/keyboard expansion, 100/150/200% size, internal scroll, Escape/Close and focus return preserve state. Changing size is presentation only.

One old systemic pixel test sampled the unchanged blood path on the left while the selected dialysate path was offscreen to the right. This was reproduced twice at 390 px. Its CRRT-only setup now uses real keyboard panning to the dialysate side before input, reorients the pair, and retains the pixel-change/no-page-scroll/uncovered-control checks. It additionally asserts that the actual dialysate path changes inactive → active. All six fluid-walk variants pass. No unrelated module assertion was relaxed.

The membrane's three static panels map to the existing diffusion, convection and ultrafiltration captions and the canonical countercurrent dialysate description. One dot size; no numeric clearance, molecule-size example, measured particle motion or kinetics. Text equivalents preserve all three concepts. Desktop/mobile/enlarged-text inspection confirms no local overflow or animation; final figure client/scroll widths are 265/265 at 320 and 1161/1161 at 1280 with 200% root text. Reduced motion has nothing animated to suppress.

Changed status/badge rows wrap with the tested controls and alerts. “Visited” retains local history meaning; no new mastery, competence, score, or required completion badge is introduced.

## Shared tests and platform-owner findings

The shared convergence change removes only CRRT from the fixed-height shell list and adds a narrow rendered CRRT document-scroll declaration plus a CRRT-only CSS assertion. MCS, ECMO, MV and ICU Hemodynamics fixed-shell/navigation protections remain. The independent shared consumer runs include MV, ICU simulator and newly merged ECMO components. The review did not modify `criticalCareShellConvergence.test.tsx` further.

**GLOBAL/OTHER OWNER — header:** reproduced on the original CRRT Learn base and the reviewed production build at 1280×900/200% root text: document 1331 px, viewport 1280 px, main 1280/1280, body overflow visible. CRRT-local overflow is zero; whole-document overflow is not. No clipping, text reduction or global-header repair was used.

**GLOBAL/OTHER OWNER — smooth focus scrolling:** independently reproduced on the non-CRRT `/en` page. A native focused footer link starts at y≈907 with scrollY=0 and only later becomes visible as the document scrolls; computed root behavior is `smooth`. CRRT's jump explicitly opts out. This review does not claim the global behavior is repaired.

**GLOBAL/OTHER OWNER — shared activity chrome:** in the original-base ICU practice route, using the existing localhost-only development-auth mechanism and the normal “Continue on this device” gate, the footer is sticky at the bottom: 69 px high at 390 and 320. Shared title overflow/ellipsis styling persists. The tested ICU title itself was not text-truncated; do not generalize the policy into an observed clipped title. The current MV Practice route uses its newer self-paced surface and did **not** reproduce the claimed pinned shared footer, even after passing its device gate. `VentilationCaseLayout` retains the legacy shared component but has no current caller. Thus the handoff's blanket “MV/ICU pages still crop/pin” claim is qualified, not blindly repeated. ICU production authentication was not bypassed; its browser probe was local development only.

## Validation and evidence

Final reconciled validation passed on implementation head `5ec1e33d8bd4d1394d80cb614d548461eccd3b70`, after both main integrations. The final pipeline completed successfully in 8m 41s (job `20260922T233626-8ae35c3ef785`). Initial repaired validation passed 57 dev and 57 production browser tests; the added real fractional-pressure journey passed separately. After the second main integration, all 106 selected Jest suites / 1,224 tests passed, including the complete CRRT suite and shared consumer selection. The new two full-state integrity tests also passed after their typing cleanup. Three targeted Batch-03 suites passed 40 tests.

| Check                                       | Final reconciled result                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Full CRRT + shared consumer Jest            | 106 suites / 1,224 tests passed                                                                      |
| CRRT dev Chromium                           | 58 / 58 passed                                                                                       |
| CRRT real production Chromium               | 58 / 58 passed                                                                                       |
| CRRT systemic layout + MV scroll ownership  | 55 / 55 passed (52 CRRT, 3 MV)                                                                       |
| Type-check                                  | Passed                                                                                               |
| Production build                            | Passed (training apps, content, asset checks, Next build, static generation, standalone preparation) |
| Changed-file ESLint / Prettier / diff check | All passed                                                                                           |

Browser matrix: 1440×900, 1280×900, 1024×768, 390×844, 320×740, and 200% root-text enlargement; systemic suites additionally cover 1600 and enlarged text at 1440. Keyboard checks include Tab/Shift+Tab, Enter/Space, arrow keys, End, visible focus, Escape and return focus. Production is compiled Next output served locally with `next start`; it is not the development server.

Environment/test problems are not hidden: initial Playwright launch lacked its matching Chromium revision, then passed after installing that revision. Generated standalone tracing across the isolated dependency symlink omitted `cpu-profile`; the same completed production output was served with the full installed runtime via `next start`. Standalone packaging/deployment portability is **NOT VERIFIED**. Earlier extra-test failures included asynchronous role/wheel timing in the test setup, as well as the real drawer/focus/rounding findings documented above. The initial systemic run was 54/55 because of the offscreen pixel target; its repaired test setup adds a real path assertion rather than accepting unchanged output.

Evidence (local, not committed): `Interventional-Pulm-Local-Data/renders/output/crrt268-sanity-2026-09-22/` contains original/review geometry JSON, matching viewport screenshots, settled drawer and membrane captures, and the fractional TMP capture. Ignored `artifacts/crrt03-sanity/` contains repository-state JSON, before-fix regression logs, global probes, configs and final validation logs. These are generated evidence, not source inputs or secrets.

**NOT RUN:** screen readers, native browser zoom, Safari/Firefox, physical devices, localization, real learners, clinical validation, manufacturer/device adjudication, remote authenticated production journeys, deployment, and Batch 04. Headless Chromium root-text enlargement is not native zoom. No clinical correctness beyond preserving the reviewed existing model is claimed.

## Remaining holds

- **OWNER/SOURCE HOLD:** O-01 through O-06, O-09, O-10, CONFLICT-001, CONFLICT-002, and G01-CRRT-02 remain open/held. The filter-drop −25 placement has not been adjudicated.
- **MODEL NOT IMPLEMENTED:** evolving solution/solute chemistry, sodium/potassium/bicarbonate kinetics, citrate/calcium response, renal recovery, MAP/vasopressor response, filter-failure and predilution penalty remain outside this batch. No new filtration-fraction math, threshold, alarm correction, latency or clinical recommendation was introduced.
- **DEFERRED:** platform issues above, broader browser/accessibility/real-learner validation and later-batch work. Nothing is closed merely because layout tests pass.

## Appendix — every path changed on main since the original Batch-03 base

No path below overlaps the original 42-path PR diff or the final 45-path implementation diff (the report adds one documentation path). This list includes both fetched-main integrations.

```text
.claude/launch.json
docs/bronchoscopy-foundations/codex-scope-brief.md
docs/gap-remediation/fellow-feedback/ecmo/ECMO-FELLOW-02-causal-manifest.json
docs/gap-remediation/fellow-feedback/ecmo/ECMO-FELLOW-02-handoff.md
docs/gap-remediation/fellow-feedback/ecmo/ECMO-FELLOW-02-trajectories.json
docs/gap-remediation/fellow-feedback/ecmo/ECMO-FELLOW-02-trajectories.md
docs/gap-remediation/fellow-walkthrough/bronchoscopy-foundations/BF-PRE-REVIEW-01-dispositions.json
docs/gap-remediation/fellow-walkthrough/bronchoscopy-foundations/BF-PRE-REVIEW-01-handoff.md
docs/gap-remediation/self-paced/MV-PRE-REVIEW-01-handoff.md
docs/socrates-invenio-comparison.md
docs/socrates-launch-audit.md
docs/socrates-launch-validation.md
docs/socrates-training-study.md
e2e/bronchoscopy-foundations.spec.ts
e2e/socrates-study.spec.ts
playwright.socrates.config.ts
public/socrates-study-template.json
scripts/cardiohelp-ecmo/dump-causal-trajectories.mts
scripts/socrates/browser-rehearsal.mjs
scripts/socrates/rehearsal.mjs
scripts/socrates/serve-fixture.mjs
scripts/socrates/start-browser-app.mjs
src/app/[locale]/admin/socrates/page.tsx
src/app/[locale]/socrates-builder/actions.ts
src/app/[locale]/socrates-demo/page.tsx
src/app/[locale]/socrates/layout.tsx
src/app/[locale]/socrates/loading.tsx
src/app/[locale]/socrates/page.tsx
src/app/[locale]/socrates/testing/[attemptId]/page.tsx
src/app/[locale]/socrates/testing/page.tsx
src/app/[locale]/socrates/training/[caseId]/page.tsx
src/app/api/socrates/[...path]/route.ts
src/app/api/socrates/images/[...path]/route.ts
src/features/bronchoscopy-foundations/__tests__/goal-truth.test.tsx
src/features/bronchoscopy-foundations/__tests__/optical-view-truth.test.tsx
src/features/bronchoscopy-foundations/__tests__/scope-playback.test.tsx
src/features/bronchoscopy-foundations/__tests__/simulation-truth.test.tsx
src/features/bronchoscopy-foundations/components/scope/ScopeDock.tsx
src/features/bronchoscopy-foundations/components/scope/ScopeFallback.tsx
src/features/bronchoscopy-foundations/components/scope/ScopeScene.tsx
src/features/bronchoscopy-foundations/components/scope/ScopeScenePane.tsx
src/features/bronchoscopy-foundations/components/scope/scope-fallback.module.css
src/features/bronchoscopy-foundations/components/scope/scope-scene.module.css
src/features/bronchoscopy-foundations/components/scope/scopeSceneModel.ts
src/features/bronchoscopy-foundations/components/scope/types.ts
src/features/bronchoscopy-foundations/components/scope/useScopePlayback.ts
src/features/bronchoscopy-foundations/components/stage/BronchStageHost.tsx
src/features/bronchoscopy-foundations/components/stage/bronch-stage.module.css
src/features/bronchoscopy-foundations/content/courseFlow.ts
src/features/bronchoscopy-foundations/content/sections/branch-entry.ts
src/features/bronchoscopy-foundations/content/sections/larynx-and-entry.ts
src/features/bronchoscopy-foundations/content/sections/view-loss.ts
src/features/bronchoscopy-foundations/engine/scope/goalPresentation.ts
src/features/bronchoscopy-foundations/engine/scope/scopeGoalEvaluation.ts
src/features/bronchoscopy-foundations/engine/scope/scopeMetrics.ts
src/features/bronchoscopy-foundations/engine/scope/scopeScripts.ts
src/features/bronchoscopy-foundations/engine/scope/scopeViewErrors.ts
src/features/bronchoscopy-foundations/engine/stageSession.ts
src/features/cardiohelp-ecmo/__tests__/components.test.tsx
src/features/cardiohelp-ecmo/__tests__/ecmo-fellow-01-recovery-and-state-truth.test.tsx
src/features/cardiohelp-ecmo/__tests__/ecmo-fellow-02-causality-and-time.test.ts
src/features/cardiohelp-ecmo/__tests__/ecmo-fellow-02-surfaces.test.tsx
src/features/cardiohelp-ecmo/__tests__/engine.reducer.test.ts
src/features/cardiohelp-ecmo/components/CircuitAndMonitors.tsx
src/features/cardiohelp-ecmo/components/PracticeCasePlayer.tsx
src/features/cardiohelp-ecmo/components/cardiohelp-ecmo.module.css
src/features/cardiohelp-ecmo/components/practice/EcmoCaseDebrief.tsx
src/features/cardiohelp-ecmo/components/practice/EcmoPracticeActivity.module.css
src/features/cardiohelp-ecmo/components/practice/EcmoPracticeActivity.tsx
src/features/cardiohelp-ecmo/components/practice/debriefTimeline.ts
src/features/cardiohelp-ecmo/components/teaching/BloodFlowVsSweepPanel.tsx
src/features/cardiohelp-ecmo/components/teaching/OxygenDeliveryExplorer.tsx
src/features/cardiohelp-ecmo/components/teaching/PumpPressureZonesPanel.tsx
src/features/cardiohelp-ecmo/components/teaching/VaIntegrationCapstonePanel.tsx
src/features/cardiohelp-ecmo/components/teaching/VaNormalStatePanel.tsx
src/features/cardiohelp-ecmo/components/teaching/VvIntegrationCapstonePanel.tsx
src/features/cardiohelp-ecmo/components/teaching/VvNormalStatePanel.tsx
src/features/cardiohelp-ecmo/components/teaching/VvSeriesPhysiologyPanel.tsx
src/features/cardiohelp-ecmo/components/teaching/drills/GasSourceInterruptionPanel.tsx
src/features/cardiohelp-ecmo/content/clinicalCases.ts
src/features/cardiohelp-ecmo/content/drillSpecs.ts
src/features/cardiohelp-ecmo/content/foundationLearningItems.ts
src/features/cardiohelp-ecmo/content/foundationLessonRuntime.ts
src/features/cardiohelp-ecmo/content/learnLessons.ts
src/features/cardiohelp-ecmo/content/practiceSupport.ts
src/features/cardiohelp-ecmo/content/scenarios.ts
src/features/cardiohelp-ecmo/engine/clinicalResponse.ts
src/features/cardiohelp-ecmo/engine/counterfactual.ts
src/features/cardiohelp-ecmo/engine/index.ts
src/features/cardiohelp-ecmo/engine/reducer.ts
src/features/cardiohelp-ecmo/engine/simulation.ts
src/features/cardiohelp-ecmo/engine/types.ts
src/features/cardiohelp-ecmo/session/foundationSession.ts
src/features/cardiohelp-ecmo/test-support/causalTrajectories.ts
src/features/mechanical-ventilation/__tests__/case-debrief.test.tsx
src/features/mechanical-ventilation/__tests__/components.test.tsx
src/features/mechanical-ventilation/__tests__/mv-pre-review-01-evidence.test.tsx
src/features/mechanical-ventilation/__tests__/mv-pre-review-01-sanity-repairs.test.tsx
src/features/mechanical-ventilation/__tests__/post-action-coaching.test.tsx
src/features/mechanical-ventilation/__tests__/teaching-panel.test.tsx
src/features/mechanical-ventilation/__tests__/waveform-annotations.test.tsx
src/features/mechanical-ventilation/components/BedsidePanel.tsx
src/features/mechanical-ventilation/components/MechanicalVentilationTeachingPanel.tsx
src/features/mechanical-ventilation/components/MechanicalVentilatorConsole.tsx
src/features/mechanical-ventilation/components/PostActionCoachingPanel.tsx
src/features/mechanical-ventilation/components/mechanical-ventilation.module.css
src/features/mechanical-ventilation/components/stage/CapturedBreath.tsx
src/features/mechanical-ventilation/components/stage/FoundationTeaching.tsx
src/features/mechanical-ventilation/components/stage/RecordedBreathComparison.tsx
src/features/mechanical-ventilation/components/stage/VentilationStageHost.tsx
src/features/mechanical-ventilation/components/stage/VentilationTaskWorkbench.tsx
src/features/mechanical-ventilation/components/stage/VentilationTeachingColumn.tsx
src/features/mechanical-ventilation/components/stage/ventilation-stage.module.css
src/features/mechanical-ventilation/components/teaching/dyssynchrony.tsx
src/features/mechanical-ventilation/components/teaching/oxygenation.tsx
src/features/mechanical-ventilation/components/teaching/timing.tsx
src/features/mechanical-ventilation/content/caseFindings.ts
src/features/mechanical-ventilation/content/learningExperiments.ts
src/features/mechanical-ventilation/content/patientReport.ts
src/features/mechanical-ventilation/content/plateauAcquisition.ts
src/features/mechanical-ventilation/content/postActionCoaching.ts
src/features/mechanical-ventilation/content/referenceEvidence.ts
src/features/mechanical-ventilation/content/stageLessons.ts
src/features/mechanical-ventilation/content/taskPresentation.ts
src/features/mechanical-ventilation/engine/arterialGas.ts
src/features/mechanical-ventilation/engine/learningMeasurements.ts
src/features/mechanical-ventilation/engine/measurementConditions.ts
src/features/mechanical-ventilation/engine/reducer.ts
src/features/mechanical-ventilation/engine/simulation.ts
src/features/mechanical-ventilation/engine/teachingBreath.ts
src/features/mechanical-ventilation/engine/triggerEvidence.ts
src/features/mechanical-ventilation/engine/types.ts
src/features/socrates-builder/case-content.ts
src/features/socrates-builder/components/CaseContentEditor.tsx
src/features/socrates-builder/components/SocratesBuilder.tsx
src/features/socrates-builder/components/socrates-builder.module.css
src/features/socrates-builder/database-compatibility.ts
src/features/socrates-builder/schema.ts
src/features/socrates-builder/server/data.ts
src/features/socrates-builder/types.ts
src/features/socrates-demo/components/ComparisonSlideViewer.tsx
src/features/socrates-demo/components/DeepZoomViewer.tsx
src/features/socrates-demo/components/ExpandableViewer.tsx
src/features/socrates-demo/components/expandable-viewer.module.css
src/features/socrates-demo/types.ts
src/features/socrates-study/__tests__/access.test.ts
src/features/socrates-study/__tests__/builder.test.tsx
src/features/socrates-study/__tests__/fullscreen.test.tsx
src/features/socrates-study/__tests__/model.test.ts
src/features/socrates-study/__tests__/routes.test.ts
src/features/socrates-study/components/AdminDashboard.tsx
src/features/socrates-study/components/StudyDirectory.tsx
src/features/socrates-study/components/StudyViewer.tsx
src/features/socrates-study/components/TestingCase.tsx
src/features/socrates-study/components/TrainingCase.tsx
src/features/socrates-study/components/shared.tsx
src/features/socrates-study/components/study.module.css
src/features/socrates-study/model.ts
src/features/socrates-study/projections.ts
src/features/socrates-study/reporting.ts
src/features/socrates-study/server/service.ts
src/features/socrates-study/testing/fixtures.ts
src/lib/site-auth/access.ts
src/proxy.ts
supabase/migrations/20260922201126_socrates_training_study_v2.sql
```
