# Batch C implementation record

## Scope and current brief

The owner selected Batch C after A and B. Starting checkout: `codex/crrt-9-13`,
`35dca42769b3ae3a162cd452444dcb866f7ac260`, clean; draft PR 191 has no review comments.
Continue this active branch without resetting to the review snapshot or changing A/B versions.
Baseline: 53 CRRT Jest suites / 579 tests passed (`--runInBand --testTimeout=60000`).

The remaining gaps are present: citrate has topology/source-gap teaching and the integration
lesson is a document plus one application item. Findings A–D and F were repaired in A/B; preserve
their canonical circuit, calculation/ledger, numeric completion and history handling.

Build the two remaining stable IDs for adult ICU physicians/fellows learning CRRT. The citrate
objective is to distinguish circuit anticoagulation, patient calcium support and metabolic
patterns. The capstone combines prior pressure, prescription, interruption, anticoagulation and
fluid concepts in one unseen bounded engine session. Completion means worked-through reasoning,
not independent device competence or Practice/Assess credit.

Reuse the existing Learn controller, versioned evidence, LessonShell/NowCard focused composition,
canonical circuit, real engine session and device projections. No global stage, scoring, release,
profile, existing case or source-conflict changes. A separate Batch C task version preserves old
completions and first responses. Navigation/reload/restart starts fresh transient work together.

Citrate sequence: normal entry/binding/removal/return/metabolism on the circuit → selectable
sampling domains → worked calcium-support contrast → four physiological patterns → changed
clinical applications. Keep drug quantities, solution-specific rates, schedules, titration and
restart algorithms gated by an approved local protocol; none is supplied. All new clinical claims
remain pending human review.

Integration will use a current immutable case not demonstrated in A/B. Inspect its actual runtime
before selecting its observation/action sequence. Mask diagnostic metadata, labels and future
solutions on pending tasks. Require reasoned localization, a discriminating inspection, a
permitted action, elapsed observation and both machine/patient accounting. Accept uncertainty
where pressures cannot distinguish causes. Do not invent labs or physiological improvement.

## Source review

Read the full relevant passages on 2026-09-13, not only abstracts/snippets:

- Pistolesi et al., SIAARTI-SIN expert opinion, J Anesth Analg Crit Care 2023;3:7;
  PMID 37386664, DOI [10.1186/s44158-023-00091-w](https://link.springer.com/article/10.1186/s44158-023-00091-w):
  Section 1 RCA mechanism paragraph; Section 2 solution/modality context; Section 4 rationale,
  monitoring discussion and Table 2 context; Section 5 calcium-balance discussion.
- Schneider, Journois and Rimmelé, Critical Care 2017;21:281;
  DOI [10.1186/s13054-017-1880-1](https://link.springer.com/article/10.1186/s13054-017-1880-1):
  General principles (all three subsections), Citrate accumulation and alternative diagnoses
  (all three subsections), risk discussion and management boundaries.
- Multidisciplinary ICU RRT guideline, Critical Care 2026;30:46;
  DOI [10.1186/s13054-025-05817-6](https://link.springer.com/article/10.1186/s13054-025-05817-6):
  Section 4 recommendations, RCA, Adverse events in RCA and RCA in liver failure.

These concern critically ill adults receiving RRT/RCA. The first two are expert opinion/review,
the third a multidisciplinary guideline. They support physiology and contextual pattern
recognition, not a manufacturer control sequence or local prescription. The older acid-base
review stresses overall solution/ion balance; avoid presenting metabolism as a universal numeric
bicarbonate conversion. Current guideline wording is more restrictive about progressive lactic
acidosis; no blanket liver-failure eligibility rule or numeric diagnostic cutoff is adopted.
PMC access returned a browser challenge; the publisher full texts were read instead.

Claim-level locators and source types are registered in `content/citrateSources.ts`; reviewer is
null and status remains `pending`. Device and local-protocol claims are separate.

## Verification plan

Run source/claim closure and protocol-gate regressions, actual rendered citrate progression,
capstone reducer/renderer action and history tests, then CRRT/shared-stage/pathway regression,
type-check, lint and production build. Run real clean-session Chromium journeys at laptop and
compact keyboard/reduced-motion settings, history/reload/restart and source/leakage checks.
Capture and inspect current Practice reference and target screenshots. Record executed outcomes
and diagnostic failures separately. Clinical/device/novice review remains unexecuted.

## Implemented behavior and preservation

Rechecked findings against the Batch B checkout: A remained present only in the two selected
lessons; E remained present as incomplete physiology registration. B, C, D and F were already
repaired in A/B and were retained. No review-commit reset, branch replacement or source-status
promotion was used. The baseline had no failing feature tests.

- `content/advancedLessons.ts` supplies eight citrate tasks and ten integrated-case tasks through
  the existing registry merge in `content/learnTasks.ts`. `content/foundationLessons.ts` only adds
  task types; the A/B arrays and versions are unchanged. `content/learnLessons.ts` retains lesson
  IDs/order and adds the read clinical references with configuration-scoped calcium wording.
- `content/citrateSources.ts`, `learnerSourceMap.ts`, `circuitModel.ts` and
  `citrateDifferential.ts` distinguish claim-specific publication support from schematic topology
  and unresolved inference. Existing term/category/source IDs remain; systemic metabolism is an
  additive term. The stable `SYNTH-LAB-CITRATE-001` record in `phase7ReviewSources.ts` still supports
  only authored structure/topology and stays pending. It no longer incorrectly says separately
  registered physiology is absent. General CRRT source IDs still cannot support citrate claims
  merely because they resolve.
- `components/CrrtCitrateDifferential.tsx` selects eight actual canonical locations, including both
  sampling points. Its comparison shows one of four patterns at a time, with relevant explanation
  and claim support. Guided exposure requires all selections; independent applications are
  separate tasks and unmount the answer-bearing reference. Two unresolved rows remain explicit:
  acid-base status alone cannot establish circuit effect or an interrupted calcium infusion.
  They are limits of inference, not a claim that citrate physiology lacks evidence.
- `components/CrrtPilotCircuit.tsx` labels publication support and the remaining local-protocol
  boundary. No circuit geometry, sensor formula, fluid function or engine parameter changed.
  The local citrate stylesheet improves readable paragraph spacing and selected-panel text.
- `integrationModel.ts` and `operationalModel.ts` select the unchanged CRRT-14 session and route
  permitted actions through the existing reducer. Current run, immutable event snapshots, pressure
  projection and both accounting levels derive from that session. No cloned case, scoring model,
  clinical laboratory trajectory or simulated physical inspection was added.
- `components/CrrtIntegrationTool.tsx` shows starting context, applied prescription, actual pump
  state and alert count, recorded profiles, canonical circuit and the shared delivery/ledger
  displays exported from `CrrtOperationalTools.tsx`. Its shared numeric feedback now describes
  recorded interruptions without assuming a full stopped hour or a particular next example.
  Anticoagulation context is open when its task
  asks for it. `CrrtLivePressureDevice.tsx` adds an optional interpretation-disclosure prop whose
  existing default remains unchanged; the unseen case omits diagnostic explanations from its DOM.
- `components/CrrtFoundationLesson.tsx` hosts both new tools in the existing focused shared
  `LessonShell`/`NowCard` composition. Real operation predicates gate questions and continuation.
  `learnController.ts` validates authored choice/correctness and rejects callbacks attempting to
  replace a retained first response; the accepted plan controls the next case branch.
- New `__tests__/advancedLessons.ui.test.tsx`, `__tests__/integrationModel.test.ts` and
  `e2e/baxter-crrt-advanced.spec.ts` cover actual transitions. Existing citrate/source/accessibility
  assertions now reflect sourced physiology and preserve negative claim/protocol checks. The
  existing Playwright configuration includes A, B and C.

Practice/Assess case definitions, masking, scoring, role boundaries and saved outcomes remain
unchanged. Learn completion records worked-through tasks, including reviewed mistakes, without
claiming mastery. Old completion flags create no new task evidence. The new version is
`crrt-advanced-2026-09-13-v1`; restart/navigation/reload clears the entire transient run while
retaining saved attempts. Source-conflict gates CONFLICT-001/002, unresolved filtration-fraction
outputs and historical makeup-attribution limits remain in force.

## Routes and instructor walkthrough

Citrate: `/en/baxter-crrt/learn?lesson=crrt-anticoagulation`.

Read the normal circuit/patient distinction. Select entry, circuit effect, effluent, blood return,
metabolism, calcium support, circuit sample and systemic sample on the same circuit. Apply sampling
reasoning to a handoff missing a systemic result. Read the separate worked example of interrupted
calcium delivery. Compare all four patterns, then interpret different constructed accumulation and
alkalosis contexts. Finish with a pressure handoff missing sampling/laboratory context. These
vignettes are authored clinical applications, not engine-generated laboratory observations.

Capstone: `/en/baxter-crrt/learn?lesson=crrt-pressure-profile-integration`.

Start a clean CRRT-14 projection: synthetic 70 kg patient, initial MAP 77 mmHg, heart rate 96/min,
modeled overload 3,000 mL; applied blood flow 120 mL/min, dialysate 1,500 mL/h and net removal
50 mL/h, with other prescription streams zero. Anticoagulation is **none**. Starting clinical
findings are not presented as newly measured responses after actions. External input is 190 mL/h
and urine 15 mL/h. These are exercise data, not targets.

Review and record the first 30 minutes. Compare the pressure change at unchanged flow, choose a
supported regional interpretation and a discriminating inspection. Two uncertainty-preserving
localizations are accepted. The inspection reports a return-region restriction without identifying
a catheter/tubing/patient maneuver. It does not change physiology or pause the pumps. Deliberately
pause delivery and record ten minutes while external fluids continue. Review anticoagulation in
the actual prescription before choosing a plan.

The supported correction path applies the existing regional correction while paused, explicitly
resumes the corrected simulation, observes another twenty minutes and records reassessment. The
supported deferral path stays paused, records the unresolved state at the same one-hour boundary,
and requires handoff of its consequences. An unsafe flow-increase choice receives immediate
feedback and is retained as wrong; it does not apply a harmful action. The next task explicitly
provides coached correction, rather than silently treating that choice as correct.

| One-hour recorded result | Corrected/resumed | Deferred, still paused |
| ------------------------ | ----------------: | ---------------------: |
| Downtime                 |       600 seconds |          1,800 seconds |
| Effluent                 |        1,291.7 mL |                 775 mL |
| Net CRRT removal         |           41.7 mL |                  25 mL |
| External intake / urine  |       190 / 15 mL |            190 / 15 mL |
| Whole-patient balance    |         +133.3 mL |                +150 mL |

Calculate signed patient balance from the shared recorded chart. Blank/nonfinite input cannot
submit or create evidence. Reassess actual current pump state, pressures and retained interruption;
report both ledgers and remaining clinical checks. Finish with a separate incomplete handoff where
final settings and effluent cannot establish dose or patient balance. No engine run appears in
that transfer question.

The engine's generic alert does not encode manufacturer priority or automatically stop the pumps.
The old CRRT-14 action IDs contain access-oriented names; they are preserved while the Learn copy
accurately describes their actual return-region effects. Inspection/correction/resume are bounded
case actions, not a manufacturer operating sequence or universal restart rule. Escalation alone
never improves the model, and a normalized pressure never establishes patient recovery.

## Executed checks and diagnostic history

| Check                                                                                                                                                                                                  | Executed result                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline `npx --no-install jest src/features/baxter-crrt --runInBand --testTimeout=60000`                                                                                                              | 53 suites / 579 tests passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Targeted source, circuit and rendered citrate checks                                                                                                                                                   | 6 suites / 56 tests passed after the initial source/UI fixes.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Rendered advanced lessons                                                                                                                                                                              | 5 tests passed, including correct, deferred and unsafe/coached paths, nonfinite input and preserved history.                                                                                                                                                                                                                                                                                                                                                                        |
| `npx --no-install jest src/features/baxter-crrt src/features/learning-module/stage/__tests__ src/features/critical-care/__tests__/hub-pathway-start-alignment.test.ts --runInBand --testTimeout=60000` | 59 suites / 606 tests passed in 19.179 seconds.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`                                                                                                                                            | Passed, exit 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npx --no-install eslint src/features/baxter-crrt e2e/baxter-crrt-advanced.spec.ts playwright.baxter-crrt.config.ts`                                                                                   | Passed without diagnostics.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run lint`                                                                                                                                                                                         | Exit 0; 15 existing warnings in unchanged files outside CRRT.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Production build                                                                                                                                                                                       | `NODE_OPTIONS=--max-old-space-size=8192 NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3113 npm run build`: passed, exit 0, including training apps, content, asset validators, production TypeScript/Next compilation and standalone preparation. Repeated successfully after the final copy repair. Existing training-app chunk-size, Node deprecation and Mermaid dependency warnings remain. |
| `npx --no-install playwright test --config=playwright.baxter-crrt.config.ts e2e/baxter-crrt-advanced.spec.ts` against development preview                                                              | All 3 complete C journeys passed in 36.0 seconds, with no captured page errors.                                                                                                                                                                                                                                                                                                                                                                                                     |
| Full production Chromium walkthrough                                                                                                                                                                   | `npx --no-install playwright test --config=playwright.baxter-crrt.config.ts` against the final standalone build on 3113: all 11 scenarios passed in 1.2 minutes; 130 screenshots, including 64 for C.                                                                                                                                                                                                                                                                               |

After final review corrected the shared feedback’s “stopped hour” assumption,
`npx --no-install jest src/features/baxter-crrt/__tests__/advancedLessons.ui.test.tsx src/features/baxter-crrt/__tests__/operationalLessons.ui.test.tsx src/features/baxter-crrt/__tests__/citrateDifferential.test.tsx --runInBand --testTimeout=60000`
passed 3 suites / 13 tests in 3.023 seconds. A final build and browser recheck follow that wording
repair and the addition of relevant already-registered citations to category disclosures.

Initial failures are not counted as successful executions. The new definition-list badge initially
violated HTML list structure; moving it inside the term fixed the rendered axe check. Initial
citrate tests still required permanent source gaps; they were updated only for the newly read,
registered claims. TypeScript found four accesses on an unconfigured patient union; a real status
guard fixed them. The first browser run stopped on nonunique `main` selectors after citrate
completion and a stale Practice heading assertion; scoped selectors and the actual unchanged
Practice heading fixed these test errors. The first full regression found obsolete citrate copy
assertions, including a substring match of “ratio” inside “configurations”; the test now uses word
boundaries. The regression also caught loss of the explicit noninterchangeable sampling-domain
sentence during copy scoping; that teaching was restored before the passing run. The first viewport-only screenshots moved
during smooth scrolling; explicit instantaneous screenshot positioning corrected the evidence
capture. That helper changes no learner progress or application state.

## Evidence and verification limits

Artifacts are outside Git at
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/baxter-crrt/batch-c-2026-09-13`.
Diagnostic runs, successful development screenshots, engine inventory and final validation logs
are retained separately. The final `production-browser/` directory has 130 screenshots, including 64 for C.
Representative images were opened and inspected: the selected systemic sample and full canonical
circuit at laptop/compact width; four-pattern explanation at compact width; first pressure profile
at both widths; corrected-but-still-paused state; blank numeric entry with its disabled action and
visible focus; and the unchanged Practice reference. Viewport-only captures preserve readable
text in addition to the full-page records. The final browser run completed all eight lesson
journeys again after the shared feedback correction.

The actual browser journeys cover correct regional reasoning, another supported uncertain
interpretation, wrong and unsafe choices, both action branches, invalid numeric input, feedback,
completion, first-answer task review, repeat, direct links, browser Back/Forward, reload and fresh
session boundaries. Laptop uses 1280×720 pointer interaction; compact uses 390×844 native
Tab/arrow/Space/Enter navigation with reduced motion. Reflow captures cover 1440, 1280, 1024, 900,
720 and 320 pixel widths. Tables use a named keyboard-scroll region; the compact journey actually
pans the pressure table. Screenshots include the current Practice entry at matching laptop size.

This is Chromium on a synthetic anonymous preview. No Safari/Firefox, physical-device touch,
screen-reader user study, translated-copy review, novice study or authenticated analytics delivery
is claimed. Practice/Assess browser coverage is existing entry/default preservation; full scored
paths were not newly completed in a browser. Existing case/scoring tests were executed. The
pre-existing global and feature `main` nesting is not a Batch C whole-page accessibility pass;
rendered component axe checks and actual keyboard journeys have narrower scope.

## Human review and deferred capabilities

All five new clinical source records remain pending with no reviewer. Nephrology/critical-care
review must assess the physiological contrasts and constructed applications, including whether
clinical uncertainty and escalation are expressed appropriately. The sources are supporting
publications, not local RCA orders or faculty approval. No drug dose, numeric calcium/ratio goal,
solution-specific rate, monitoring frequency, titration or restart algorithm was implemented.

A PrisMax-trained nurse educator must review the pinned device context and case-action language.
The current profile and source conflicts are unchanged. The model still lacks actual bedside
inspection, protocol-specific RCA delivery/metabolism/laboratory dynamics, complete patient
response, and manufacturer-specific alarm priorities/automatic responses. These capabilities
remain unavailable; they are not filled with invented results. Novice usability review remains
pending. Release status remains draft/unlisted; no deployment, merge or publication promotion.

## Scoped teaching-contract assessment

| Rule | Result within Batch C                                                                                                                               |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1   | PASS: existing eight-lesson registry, route IDs/order and progress resolver retained.                                                               |
| H2   | PASS: normal path and worked infusion example precede changed clinical applications; capstone draws on the completed earlier lessons.               |
| H3   | PASS: existing shared LessonShell/NowCard and owner-authorized focused composition; no fixed three-pane or prediction-first replacement.            |
| H4   | PASS: one current task with real controls and named circuit, comparison, pressure and fluid landmarks.                                              |
| H5   | PASS: route-rendered teaching, selected diagram and real case; prescription open when needed, references absent from independent citrate questions. |
| H6   | PASS: selection/action/observation and reviewed-feedback gates; no visit or invalid-input completion. Guided exposure is not mastery.               |
| H7   | PASS: first responses and Learn feedback retained, unsafe choice explicitly coached, Practice/Assess defaults unchanged.                            |
| H8   | PASS: canonical circuit, unchanged case/engine/calculations and projections; no fabricated laboratory or recovery response.                         |
| H9   | PASS: existing progress adapter and IDs, separate C version, whole-run reset and retained history; branch derived from actual first response.       |
| H10  | PASS for implemented terminology and visible instructions; clinical/device wording awaits human review.                                             |
| H11  | PASS: feature/tests/docs scope, no global stage, scoring, auth, dependency, release or data changes.                                                |
| H12  | PASS for executed rendered/Chromium journeys, including the final rebuilt production preview. Human and unexecuted platform review remain separate. |

## Delivery

Batch C is implemented as a separate commit on `codex/crrt-9-13`, continuing draft PR 191.
The final commit is recorded in the external validation manifest and PR head. This report and the
new tests are included with the implementation; raw sources, screenshots and logs remain outside
Git. The private local production preview remains on port 3113. No merge or deployment occurred.
