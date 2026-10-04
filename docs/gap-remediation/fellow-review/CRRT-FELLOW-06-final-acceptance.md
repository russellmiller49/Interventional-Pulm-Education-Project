# CRRT-FELLOW-06 — final combined engineering acceptance

**FINAL ENGINEERING ACCEPTANCE: NOT READY**

Completed resumed review: **2026-10-03**, after PRs #286 and #313 merged. This is an
independent engineering review, not clinical, device, or source approval. Unlike the
historical stopped review preserved in the appendix, this review continued through the
requested case, model, learning, storage, responsive, and automated matrices.

**The two repaired blockers pass.** Current blockers are unsupported laboratory-trend
promises in CRRT-03/04, unconditional debrief claims about work never performed,
preconnection/paused narrative inconsistent with running CRRT-08/09, and incomplete
nonzero-makeup containment. A reproducible development-only rapid-selection/reload test
failure also prevents describing the complete automated gate as green. Nothing was
repaired. Only this report was changed in the repository.

## 1. Baseline, scope, and evidence

| Item                          | Value                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Exact fetched and tested main | `6753cb321a7a2aeb647a75a79ae2d1bbea04426f`                                                                            |
| PR #286                       | MERGED; `8a925f13bb3d9249cff1ab3ab4fc317c79425d83`; 2026-09-28 16:05:36 UTC                                           |
| PR #313                       | MERGED; `1dcad8dcf1b6fe6979d98c21a0b139518d81ddf6`; 2026-10-03 08:11:33 UTC                                           |
| Ancestry                      | Both merge commits are ancestors of tested main (`merge-base --is-ancestor`, exit 0)                                  |
| Isolated acceptance checkout  | `/Users/russellmiller/.codex/worktrees/crrt-final-acceptance/codex-crrt-10-3`                                         |
| Report branch                 | `codex/crrt-final-acceptance-20261003`                                                                                |
| Untouched comparison checkout | `/tmp/crrt-final-20261003-current-main`, detached at the identical main SHA                                           |
| Final main reconciliation     | Fetch after validation returned the same main SHA; no runtime drift                                                   |
| Production                    | Full `npm run build`; Chromium against `next start` on `127.0.0.1:3296`                                               |
| Development                   | Chromium against isolated Next webpack dev on `127.0.0.1:3297`; comparison on 3298                                    |
| Configuration                 | Synthetic preview URL/key supplied as process environment. No secret or environment file read/copied                  |
| Versions                      | Content `1.1.0-sme-review.1`; engine `1.0.0`; neither is reviewer approval                                            |
| Requested model               | User requested GPT-6 Astra / High. This review cannot independently certify or change the active chat's model setting |

Consulted the historical acceptance; #286 handoff and sanity review; #313 terminal-End
handoff and available `/tmp/crrt-pr313-review` sanity artifacts; prior Batch 01–04
handoff/sanity evidence; Batch-05 packet and queue; and the Local-Data implementation
pack's common contract, owner decisions, and feedback ledger. There is no separate
tracked #313 sanity-report document. Earlier reports were context, not substitutes for
current executions.

Durable evidence directory:
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/crrt-final-acceptance-20261003/`.
All evidence filenames below are relative to that directory. The scripts originally ran
from `/tmp/crrt-final-20261003`; their absolute paths remain in logs. Evidence includes
engine snapshots, rendered component captures, browser text, screenshots, Playwright
traces/JSON, command logs, and the scratch scripts/configuration. Harness errors and
superseded captures are retained with explicit names; use the final `browser.json`,
`matrix.json`, and `build-final.log` for conclusions.

## 2. Consolidated acceptance matrix

| Finding / contract                                  | Evidence                                                                                                               | Classification                                              | Hold / required next action                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Historical F06-01, CRRT-12                          | Production no-action and review-action journeys; missing domains stay absent after 2 h; `browser.json`, repaired E2E   | **PASS**                                                    | Information-gap framing remains; O-01/O-10/G-10 not implemented                              |
| Terminal End across checkpoints                     | End at 0, 30, 59, 60, 61, 300 s; single/segmented advance; reset; scheduled idle/paused transitions and CRRT-13 resume | **PASS**                                                    | No reopening or delivered-treatment accumulation after terminal End                          |
| CRRT-15 −40.5/−40/−41                               | Same raw access value, different explicit rounding functions, §4                                                       | **PASS — presentation difference**                          | Optional precision harmonization, not a physiological discrepancy                            |
| Initial 0 mL versus Unavailable                     | Cumulative fields versus absent first trend sample; first sample at 300 s, §4                                          | **PASS — not-yet-sampled presentation**                     | Optional clearer sampling label; no missing value converted to zero                          |
| TMP −18 correction                                  | Same adapter arithmetic; manual expression locator and pending-review label remain                                     | **PASS WITH HOLD**                                          | MATH-PM-002, manual p217/PDF p218; software currency/device review stays open                |
| Filter-drop −25 correction                          | Separate placement hold visible; no-flow invalidity explicit                                                           | **PASS WITH HOLD**                                          | DEV-PM-010, G01-CRRT-02 / O-04; do not infer approval from a readable equation               |
| Nonzero makeup and later-zero history               | Device guard withholds; evidence/patient/debrief still expose 500/900 mL, §3 R04                                       | **FAIL**                                                    | Propagate cumulative validity to every consumer; do not guess attribution                    |
| Patient residual clearance                          | Authored/normalized; patient-only mutation has no solute effect; pool mutation does                                    | **PASS — MODEL NOT IMPLEMENTED / O-01 HOLD**                | Do not wire patient field into chemistry in this review                                      |
| CRRT-04 setup workflow                              | Complete machine sequence and stale-review/re-review E2E                                                               | **PASS workflow; FAIL case copy**                           | R01; no setup bypass was found                                                               |
| CRRT-05 pre/post split                              | Matched 6 h engine and production paths; same dose/pressures/marker; only split changes                                | **PASS WITH HOLD — dilution consequences not modeled**      | O-01/O-03; explicit limits retained                                                          |
| CRRT-11 matched-time causality                      | Four 2 h paths distinguish stress/balance, MAP held at 59                                                              | **PASS WITH HOLD model; FAIL generic debrief**              | R02; no claim of modeled MAP recovery                                                        |
| CRRT-13 fault/action/time separation                | Diagnostic, acknowledge, harmful, correction, paused elapsed time, recovery and reassessment                           | **PASS WITH HOLD**                                          | Educational fault/alert model, not manufacturer alarm authority                              |
| CRRT-15 current run/history                         | Tiny actual trend distinguished from localization teaching                                                             | **PASS WITH HOLD**                                          | No fabricated current filter failure/exchange                                                |
| CRRT-16 supplied filter-loss history and plan       | Challenge route; action does not change circuit; comparison labels separate clocks                                     | **PASS WITH HOLD**                                          | Plans remain plans; no simulated exchange/failure                                            |
| CRRT-17 citrate/calcium                             | Missing serial calcium, total/ionized ratio and citrate remain absent                                                  | **PASS WITH HOLD physiology; FAIL no-action debrief**       | R02; no physiology implementation authorized                                                 |
| CRRT-18 recovery/transition                         | Fixed urine/creatinine/clearance; absent recovery explicitly named                                                     | **PASS — MODEL NOT IMPLEMENTED**                            | O-01 and clinical transition review remain open                                              |
| All 18 cases: promise → evidence → action → debrief | Production captures and engine definitions/state, §6                                                                   | **FAIL**                                                    | R01–R03; special scope disclosures do not neutralize affirmative unsupported prose elsewhere |
| Navigation and storage                              | Production route suite, legacy seed and nine perspective switches/reset                                                | **PASS production/storage; development gate qualified**     | R05 timing-sensitive rapid-selection/reload failure remains unresolved                       |
| Debrief actual-event matrix                         | Actual ledger preserves refused/diagnostic/harmful/corrective/recovery and reassessment states                         | **PASS actual ledger; FAIL generic tail**                   | R02; keep actual events separate from worked teaching                                        |
| Learn/feedback                                      | 25 questions, five drills, full balance diagnostic and six-signal pressure matrices                                    | **PASS**                                                    | No score, first-attempt persistence, mastery or correctness gate                             |
| Glossary/source truth                               | All 21 entries have registered or explicit module/model basis                                                          | **PASS WITH HOLD source basis; FAIL makeup behavior claim** | R04 contradicts glossary's universal withholding promise; review statuses stay pending       |
| Responsive/accessibility                            | 96 settled surface captures + 24 return-focus observations; 52 systemic checks                                         | **PASS CRRT matrix; OTHER OWNER site header**               | 200% site header overflows 51 px; CRRT local surfaces did not                                |
| Batch-05 integrity                                  | 34 NOT REVIEWED; six decision fields null on every item; all O/G IDs covered                                           | **PASS**                                                    | No owner decision implemented; G01 queue also unchanged                                      |
| Full automated gate                                 | §9: CRRT suites/build/production/systemic pass; shared Jest/TypeScript failures and dev failure recorded               | **NOT ALL GREEN**                                           | Shared failures directly compared; R05 remains a validation issue                            |

## 3. Current blockers and bounded future work

### F06-R01 — unsupported laboratory-trend promises in CRRT-03 and CRRT-04

**FAIL — UNSUPPORTED CLAIM EXPOSED. P1.**

**Exact reproduction, CRRT-03:** Open `/en/baxter-crrt/practice?case=CRRT-03`.
The opening finding says “A serial solute trend and a neurologic vulnerability are visible
together.” Perform **Complete the initial clinical assessment**, then **Pause and coordinate
the intended trajectory before changing the prescription**. The response says
“The serial simulated trend changes gradually and remains subject to delivery checks.”
Advance two hours, inspect Patient & trends, and open the debrief. That sentence appears
in the actual-action teaching notes and again as generic trend review. No clinical solute
series exists. The laboratory section correctly says changes are not modeled.

**Exact reproduction, CRRT-04:** Open `/en/baxter-crrt/practice?case=CRRT-04` and read the
opening findings: “Observe how the interruption changes actual treatment delivery and
later laboratory trends.” Open Debrief → **End run and review debrief**, even without a run.
It directs review of “the later laboratory trends” and states “Delivered clearance drives
the later solute and acid-base trends,” while its laboratory section withholds those trends.
The complete machine workflow separately passes; that does not supply clinical chemistry.

**Expected:** promise only evidence available in this case, or explicitly request absent
serial clinical data. **Actual:** current learner-facing prose promises changing laboratory
evidence which the module intentionally suppresses. Internal removal-only pool arithmetic
is not a valid clinical series and cannot rescue the claim.

**Trace:** `content/completeCases.ts:653`, `:669`, `:673`, `:1617`; CRRT-03's narrative
`expectedResponse`; the adapter copies responses into `debrief.trendReview` at `:1276`.
All paths here and below are under `src/features/baxter-crrt/` unless stated otherwise.
Evidence: `browser.json` entries CRRT-03/04-truth, `engine.json`, corresponding debrief PNGs.

**Smallest bounded future repair:** remove/qualify the serial-lab promises in intro,
findings, response and generic debrief; describe available delivery evidence and missing
clinical measurements. Add focused rendered no-action/action coverage. Keep chemistry
suppressed and owner/source holds intact; do not build physiology to justify the prose.

### F06-R02 — generic debrief narrates unperformed reassessment/escalation

**FAIL — ACTUAL/WORKED BOUNDARY. P1.**

**Exact reproduction:** Fresh `/en/baxter-crrt/practice?case=CRRT-17`; perform no action,
advance no time, record no reassessment. Open Debrief → **End run and review debrief**.
The actual ledger says **no run performed** and **Actual reassessment: Not recorded**.
Below the laboratory containment, the generic tail nevertheless says
“The escalation and reassessment plan is recorded” and “The responsible team receives a
structured escalation and reassessment summary.” It is outside the initial bounded
worked-example subsection. The correct absence-of-calcium statement does not make the
unperformed escalation true.

Fresh no-action debriefs for CRRT-01, 02, 06, 07 and 11 also end with
“Reassessing … showed whether the intended response occurred,” despite no reassessment.
CRRT-17's assertion is the clearest reproduction; these other cases share the tense/scope
problem. CRRT-12's repaired generic tail does not have it.

**Expected:** actual notes derive from recorded events; generic teaching stays explicitly
hypothetical/prospective. **Actual:** unconditional run-result wording appears in a debrief
whose actual ledger disproves it. A disclaimer at the top is not a local separation of this
tail from the preceding actual-action teaching notes.

**Trace:** `components/CrrtCasePlayer.tsx:1150` renders `trendReview` and `causalChain`
unconditionally; `content/completeCases.ts:836` creates the past-tense reassessment text;
`:1833` supplies CRRT-17's recorded-plan response, reused as generic trend review.
Evidence: `browser.json` noAction captures for all 18; `CRRT-17-debrief.png` captures the
same tail on an action path; the JSON is the no-action evidence.

**Smallest bounded future repair:** make the generic tail neutral/prospective and visibly
worked teaching, or condition run-result statements on actual events. Preserve the existing
actual-event ledger and harmful-action history; do not add another duplicate generic debrief.

### F06-R03 — preconnection/paused story conflicts with active CRRT-08/09 delivery

**FAIL — NARRATIVE/STATE MISMATCH. P1.**

**Exact reproduction, CRRT-08:** Open `/en/baxter-crrt/practice?case=CRRT-08`.
The story says **Before connection** and asks for preconnection verification. The live rail
already reports **150 mL/min through the circuit**. Perform initial assessment, then
**Stop the sequence, identify the mismatched domain, and complete an independent check**.
Its response says “The setup remains paused until the mismatch is explicitly resolved or
escalated.” Open Machine + circuit: therapy remains running, connected, with actual blood
flow 150 mL/min. Advance two hours: delivery accumulates and downtime remains zero.

CRRT-09 (`/en/baxter-crrt/practice?case=CRRT-09`) similarly begins **Before treatment
starts**, but starts connected/running at 150 mL/min. Its verification action records an
educational event without changing that state. No medication instructions are fabricated;
that separate containment passes.

**Expected:** distinguish a hypothetical preconnection planning exercise from the current
running demonstration, or make the authored initial state/claimed pause truthful.
**Actual:** CRRT-08 explicitly promises a pause that does not occur; CRRT-09's initial
chronology contradicts the current run. Both adapt a running fixture; the relevant actions
have no engine effects.

**Trace:** `content/completeCases.ts:1649`, `:1668` and the associated initial-state adapter.
Evidence: `browser.json`, `supplement.json` CRRT08-state, `crrt08-running.png`, `engine.json`.

**Smallest bounded future repair:** clearly frame these as verification/planning alongside
an already-running demonstration and remove false paused/pre-start claims, or separately
specify and review a true setup-state exercise. Prefer a bounded copy/scope repair; do not
quietly implement a clinical/device stop protocol.

### F06-R04 — nonzero-makeup guard does not reach all cumulative-balance surfaces

**FAIL — UNSUPPORTED CUMULATIVE ATTRIBUTION EXPOSED. P1. Fixture/component reachable.**

All 18 shipped cases initialize makeup at zero and have no shipped makeup source/control
path. This is **not claimed to be reachable from an ordinary current production case**.
It is a required acceptance path, reproduced with the repository's existing
`crrtFixtureWithMakeupBag` / `withCrrtMakeupFlow` review fixture and real session reducers
and components; no runtime or repository test was changed.

**Exact reproduction:** Start the CRRT-10 fixture with its makeup bag, set makeup to
100 mL/h, and advance the real learning session 7,200 s. Render `CrrtCasePlayer` and
`CrrtActivityWorkspace`; open the debrief via `REVEAL_DEBRIEF`. Then repeat after setting
makeup to zero and advancing a further 7,200 s. Scratch reproduction is
`makeup-probe.test.tsx` with `jest.probe.config.cjs`; its two passing tests mean that the
recorded reproduction succeeded, not that the acceptance contract passed.

| Quantity/surface                                                      | Nonzero makeup, 2 h                           | Makeup returned to zero, 4 h |
| --------------------------------------------------------------------- | --------------------------------------------- | ---------------------------- |
| Makeup delivered in window                                            | 200 mL                                        | Still 200 mL                 |
| Device cumulative resolution                                          | `unresolved-makeup-attribution`               | Same                         |
| Device machine-removal / whole-balance display fields                 | null / null, with reason                      | null / null, with reason     |
| Evidence rail, Patient & trends, actual debrief whole-patient balance | **500 mL**                                    | **900 mL**                   |
| Trend comparison and overload accounting                              | Raw balance/derived accounting still supplied | Still supplied               |

The fixture keeps PFR set to 250 mL/h. At 2 h its effluent target is 1,850 mL/h
and actual cumulative effluent is 3,700 mL; after makeup returns to zero, target flow is
1,750 mL/h and four-hour cumulative effluent is 7,200 mL. Raw cumulative machine
removal is 500 then 1,000 mL, but the device correctly withholds patient attribution of
those raw numbers. The unsupported displayed balance is 500 then 900 mL.

Effluent includes makeup; the registered patient-removal expression omits its subtraction.
That is why cumulative attribution is unresolved. The engine's raw intermediate ledger
continues to contain numbers; displaying them as patient balance bypasses the established
guard. Returning the rate to zero does not remove the 200 mL already carried.

**Expected:** every cumulative patient-attribution surface withholds while that run contains
unresolved makeup. **Actual:** the device adapter and guarded chart pass, but the activity
rail, patient/trend view and actual-run review consume raw totals. The glossary promises
withholding “whenever makeup has run,” which is not true across these consumers.

**Trace:** `components/CrrtActivityWorkspace.tsx:234`–`:236` reads the latest raw trend;
`components/CrrtCasePlayer.tsx:265`, `:829` read raw balance; `actualRunReview.ts:495`
reads raw cumulative balance and `:405` describes derived overload. Compare the
`selectPrismaxPilotCaseOperationsDisplay` cumulative projection and the cumulative-fluid
review-state tests. Evidence: `makeup-render-running.json`, `makeup-render-returned-zero.json`,
`makeup-render.log`, `engine.json` makeup cases.

**Smallest bounded future repair:** share the existing cumulative-validity projection with
all patient-balance/trend/debrief consumers and any dependent overload statement. Preserve
raw accounting and unresolved source status. Add nonzero-then-zero regression coverage
for those consumers. Do not choose a membrane location or a patient-attribution rule.

### F06-R05 — development rapid-selection/reload acceptance gate fails

**FAIL — TIMING-SENSITIVE VALIDATION; production regression not established. P2.**

Run unchanged `e2e/baxter-crrt-batch03-sanity.spec.ts`, test **every Cases option is reachable
and all four group boundaries stay truthful**, against the review checkout's development
server. It selects all 17 cases, then first/last core/additional boundaries, then immediately
reloads after displaying the last additional boundary. At line 176 it expects CRRT-14 but
receives CRRT-18. This happened in the complete dev suite and an unchanged targeted rerun.
The identical targeted command on untouched same-SHA main passed once; the complete
production suite also passed. This is not an identical shared-baseline failure.

**Expected:** the test's selection/reload identity contract holds. **Actual:** an earlier
URL wins on reload. Trace shows local selection finishes before the asynchronous URL
commit; this boundary loop does not wait for `toHaveURL`, unlike its first loop.
`components/BaxterCrrtPractice.tsx:129` updates local selection before `router.push` at
`:132`. This supports a navigation/test synchronization race, not a proven persistent
mismatch after a completed navigation. No test was changed or weakened to obtain a pass.

**Smallest bounded future work:** establish the intended completion boundary with a focused
route-commit/reload reproduction; if completed navigation is correct, synchronize the
boundary test with the committed URL. If the UI claims selection is complete while an
older URL can win, repair that navigation state. Keep this failure in the acceptance gate
until adjudicated. Evidence: `development-full.log`, `playwright-development.json`,
`dev-target-retry.log`, `baseline-dev-target.log`, and both failure traces.

## 4. Repaired contracts, pressure precision, and fluid sampling

### Repaired blockers

CRRT-12 production no-action debrief does not say that review occurred. Assessment/review
records a request for missing information, explicitly says requesting it does not supply
it, and after two hours exposes delivery bookkeeping without electrolyte, temperature,
medication-exposure or nutrition series. Supplied labs remain static/contained. The old
F06-01 is closed for this exact baseline, despite similar defects elsewhere.

Terminal-End probes ended CRRT-12 at 0, 30, 59, 60, 61 and 300 s, then compared a single
3,600 s advance with 1 + 59 + 3,540 s. Delivery stayed ended; actual effluent and treatment
time did not grow. Reset created a fresh run. Existing terminal regression coverage also
exercised checkpoints requesting running/paused/idle after End, legitimate nonterminal
idle/paused scheduled transitions, and CRRT-13 explicit resume. Production targeted tests
and the full dev/production suites included these contracts and passed them.

### CRRT-15 access-pressure surface trace

`simulation.circuit.pressures.accessPressureMmHg` is **−40.5 mmHg at t=0** and remains
−40.5 on the unchanged tested path. No access-pressure correction is applied by these
formatters. The −18/−25 corrections belong to derived channels, not this discrepancy.

| Surface                                                                                     | Underlying value / time                                                   | Transformation and precision                                                                       | Visible result                                             |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Live evidence rail, four-site row                                                           | Current raw −40.5, t=0                                                    | `toLocaleString`, max 1 fractional digit; `CrrtActivityWorkspace.tsx:91`/`:109`                    | −40.5                                                      |
| Live pressure tiles, selected detail and accessible summary                                 | Same current raw −40.5, t=0                                               | `Math.round`, whole mmHg; `CrrtLivePressureDevice.tsx:56`, `:61`; negative half rounds toward +∞   | −40                                                        |
| PrisMax educational pressure panel                                                          | Same adapter signal −40.5, t=0                                            | `toFixed(0)`; `PrismaxPilotInterface.tsx:768`; this negative half renders away from zero           | −41                                                        |
| Circuit pressure-node/readout text and accessible circuit summary, when supplied that value | Raw signal prop −40.5 at its supplying snapshot                           | `toLocaleString('en-US')`, default max 3 fractional digits; `CrrtPilotCircuit.tsx:205`, `:225`     | −40.5                                                      |
| Worked comparison/current-run tables                                                        | Initial/current or explicitly named comparison time; access remains −40.5 | `formatCrrtWorkedValue`, fixed 1 decimal for pressure                                              | −40.5                                                      |
| Patient & trends, circuit/fluid state sampled summary                                       | No sample at t=0; first sample t=300 s is −40.5                           | `Math.round(value * 100) / 100`, max 2 decimals; missing stays Unavailable                         | Unavailable initially, then −40.5                          |
| Debrief actual “Access pressure now”                                                        | Current end-of-run raw −40.5                                              | `actualRunReview.ts:512` → `toFixed(0)`                                                            | −41                                                        |
| Debrief first/latest sampled table                                                          | Explicit first/latest timestamps, −40.5 on unchanged run                  | Same two-decimal trend formatter                                                                   | −40.5                                                      |
| Live history graph/range                                                                    | Sampled series and labeled interval, not a new measurement                | Raw series drives graph; SVG pixel coordinates rounded to 0.1 pixel; range labels use `Math.round` | Range may show −40; graph is not a distinct pressure value |

**Adjudication:** benign presentations of one underlying value, with inconsistent display
precision. This is not contradictory physiological evidence. The timestamps and sampled
versus current distinction still matter if a learner changes the run. Optional future
harmonization would make comparison easier; no repair here.

### Initial zero versus Unavailable

At CRRT-15 t=0, device fields
`deliveredTherapy.cumulativeMachinePatientFluidRemovalMl` and
`cumulativeWholePatientBalanceMl` are both initialized, valid **0 mL** for an elapsed
zero window with no makeup. The device says **MACHINE REMOVAL / WHOLE BALANCE**.
The activity rail says **Delivered dose · whole-patient balance**, reading
`simulation.trends.at(-1)?.deliveredDoseMlKgHour` and
`?.cumulativeWholePatientBalanceMl`. There is no sample, so both are **Unavailable**.
These are not two labels for machine removal; one member is dose.

At 300 s the first sample contains delivered dose **20.625 mL/kg/h**, machine removal
**4.1666667 mL**, and whole balance **−2.0833333 mL**, agreeing with current cumulative
fields. This is a not-yet-sampled presentation, not unsupported data converted to zero.
The missing-urine balance diagnostic also retains Unavailable rather than assuming zero.
The nonzero-makeup leak in R04 is a different problem.

### Offsets and no flow

| State, CRRT-15 | Actual Qb  | Raw access/filter/return/effluent (mmHg) | Adapter TMP / drop | Interpretation                                            |
| -------------- | ---------- | ---------------------------------------- | ------------------ | --------------------------------------------------------- |
| Running, t=0   | 130 mL/min | −40.5 / 70 / 31 / −20                    | 52.5 / 14          | Flow-valid model arithmetic, source/device holds retained |
| Set Qb=0       | 0          | 5 / 5 / 5 / −20                          | 7 / −25            | Derived validity `no-flow-through-circuit`                |
| Paused         | 0          | 5 / 5 / 5 / −20                          | 7 / −25            | Same no-flow invalidity                                   |
| Ended          | 0          | 5 / 5 / 5 / −20                          | 7 / −25            | Same; terminal state separately verified                  |
| Idle           | 0          | 5 / 5 / 5 / −20                          | 7 / −25            | Same; no flowing treatment evidence                       |

Running TMP: `(70 + 31) / 2 − (−20) − 18 = 52.5` (whole display 53).
Running corrected drop: `70 − 31 − 25 = 14`.
At no flow: `(5 + 5) / 2 − (−20) − 18 = 7`; `5 − 5 − 25 = −25`.
Raw sites remain labeled modeled at-rest readings; calculated values are explicitly
**Not interpretable without blood flow** in tiles, accessible summary, machine panel and
worked arithmetic. Historical sampled TMP also warns that blood-flow validity was not
recorded with each sample, so that series alone cannot establish a filter-pressure change.

The **−18** term is the registered AW8035 displayed-TMP expression, MATH-PM-002,
manual p217/PDF p218; currency and clinical/device approval remain pending. The **−25**
placement on filter drop is separately held under DEV-PM-010, manual pp201–202,
G01-CRRT-02/O-04. Clear arithmetic does not settle that interpretation. PASS WITH HOLD.

## 5. Residual clearance and matched-time case journeys

CRRT-10 authors residual renal clearance **2 mL/min**, normalized into
`patient.residualKidneyClearanceMlMin`. Changing that scalar to 999 while holding all else
fixed leaves one-hour solute results identical. Changing per-solute
`residualClearanceMlMin` to 10 changes the pools: `engine/soluteModel.ts:59` consumes the
pool field. All authored pool defaults are zero. CRRT-18's fixed fixture/absence-of-recovery
wording does not claim that the patient scalar changes chemistry; its “input to the solute
model” descriptor is imprecise lineage, not a demonstrated coupled response. No evolving
clinical chemistry is licensed by it. **PASS — MODEL NOT IMPLEMENTED / O-01 HOLD.**

| Journey                                                                                   | Observed result                                                                                                                      | Classification                                                                             |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| CRRT-04 setup → prescription → prime → review → start → change → stale review → re-review | Full production workflow test passes; case cards cannot bypass prime/review; changed prescription invalidates review                 | PASS workflow; R01 copy remains FAIL                                                       |
| CRRT-05 matched 6 h no change vs split                                                    | Pre/post 0/1,200 becomes 900/300 mL/h; both dose 16.447368 mL/kg/h, actual effluent 7,500 mL, downtime 0, filter 80.099, TMP 59.5495 | PASS WITH HOLD: dilution/filtration consequences not modeled; explicit limitations visible |
| CRRT-11 no action at 2 h                                                                  | Stress 0.760; balance −320 mL; MAP 59                                                                                                | Model PASS WITH HOLD; generic debrief R02                                                  |
| CRRT-11 corrective at 2 h                                                                 | Stress 0.480; balance −20 mL; MAP 59                                                                                                 | Same matched time: 1 h carried by action + 1 h learner advance                             |
| CRRT-11 alternative pause at 2 h                                                          | Stress 0.480; balance +40 mL; MAP 59                                                                                                 | Same clock accounting; pause does not establish MAP recovery                               |
| CRRT-11 harmful at 2 h                                                                    | Stress 0.872; balance −600 mL; MAP 59                                                                                                | Harm remains recorded; held MAP is not evidence of tolerance                               |
| CRRT-13 diagnostic/acknowledgement at 1,800 s                                             | Access −139 mmHg; delivered dose 22.142857; zero downtime; acknowledgement does not clear cause                                      | PASS WITH HOLD                                                                             |
| CRRT-13 harmful at 1,800 s                                                                | Access −211; same dose/time before further advancement                                                                               | Harmful setting/fault consequence distinct from time                                       |
| CRRT-13 same-timestamp pause/correct/resume                                               | Access −25; same dose/time; zero added downtime                                                                                      | Correction changes cause; instant pause/resume does not invent downtime                    |
| CRRT-13 correction after 600 s paused                                                     | t=2,400; downtime 600; dose 16.607143                                                                                                | Elapsed paused time accounts for reduced delivery                                          |
| CRRT-13 harmful then recovery                                                             | Access −40 because higher Qb remains; harmful event retained; selected reassessment recorded                                         | Recovery does not erase harm or assert an unperformed reassessment                         |
| CRRT-15                                                                                   | Six-hour modeled filter change ~0.37 mmHg; explicitly too small for ordinary display localization; separate pattern exercise         | PASS WITH HOLD                                                                             |
| CRRT-16                                                                                   | `/en/baxter-crrt/assess`; prior filter losses are supplied history; planning actions have zero signal difference at matched time     | PASS WITH HOLD; no new failure or filter exchange                                          |
| CRRT-17                                                                                   | No serial calcium, ratio or citrate signal generated after action/time                                                               | Physiology containment PASS; no-action plan assertion R02 FAIL                             |
| CRRT-18                                                                                   | No rising urine, falling clinical creatinine, returning clearance or modeled renal recovery                                          | PASS — MODEL NOT IMPLEMENTED; transition decision distinct from End controls               |

Evidence: `engine.json`, `final-probe.json`, `matched05-browser.json`, `browser.json`,
full production/development E2E results. Raw internal CRRT-05 urea-pool comparisons remain
explicitly labeled model markers, not patient laboratory response or dilution effects.

## 6. All-18 truth sweep and debrief matrix

Each route was opened in production; intro, worked plan, fresh no-action debrief, available
assessment/action response, two-hour patient view and action/time debrief were captured.
Specialized setup and fault sequences were additionally exercised by full E2E and matched
probes; the generic sweep alone does not claim to complete every specialized action card.

| Case    | Promise / evidence / effects / debrief adjudication                                                                                                |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRRT-01 | Fluid goals and arithmetic supported; static patient values held. **FAIL R02** past-tense reassessment without a run                               |
| CRRT-02 | Prescription/delivery action supported; clinical chemistry suppressed. **FAIL R02** unperformed reassessment wording                               |
| CRRT-03 | No serial clinical solute evidence; no-effect planning action says trend changes. **FAIL R01**                                                     |
| CRRT-04 | Real machine workflow supported; clinical chemistry absent. **FAIL R01** lab-trend promise                                                         |
| CRRT-05 | Real split, no modeled dilution consequence; marker versus clinical chemistry distinguished. **PASS WITH HOLD**                                    |
| CRRT-06 | Scheduled interruption and integrated delivery supported; no chemistry claim accepted from raw pools. **FAIL R02** generic reassessment            |
| CRRT-07 | Entered weight/hematocrit propagate to supported calculations. **FAIL R02** generic reassessment                                                   |
| CRRT-08 | Verification narrative claims preconnection/paused while running. **FAIL R03**                                                                     |
| CRRT-09 | No invented drug regimen, verification is a record; pre-treatment narrative conflicts with running fixture. **FAIL R03**                           |
| CRRT-10 | Zero-makeup shipped fluid ledger separates external balance and machine removal. **PASS WITH HOLD** for shipped path; nonzero fixture **FAIL R04** |
| CRRT-11 | Stress/reserve/balance change with held MAP; matched-time effects honest. **FAIL R02** generic no-action wording                                   |
| CRRT-12 | Missing multidisciplinary serial evidence remains missing; actual request stays a request. **PASS WITH HOLD**, F06-01 closed                       |
| CRRT-13 | Pressure fault, acknowledgement, correction and clock accounting agree. **PASS WITH HOLD**                                                         |
| CRRT-14 | Return-path localization/inspection and model fault response; no clinical lab series asserted as supplied. **PASS WITH HOLD**                      |
| CRRT-15 | Small current trend distinguished from separate pattern teaching; no fabricated exchange. **PASS WITH HOLD**                                       |
| CRRT-16 | Supplied recurrent-loss history, present running circuit and future plan remain separate. **PASS WITH HOLD**                                       |
| CRRT-17 | Calcium/citrate absence correctly stated; fresh debrief says escalation was recorded. **FAIL R02**, physiology hold retained                       |
| CRRT-18 | Missing recovery data named; fixed urine/clearance not narrated as recovery. **PASS — MODEL NOT IMPLEMENTED**                                      |

| Debrief path           | Actual-event ledger result                                    | Generic teaching qualification                              |
| ---------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| No action              | Correct no-run header; no reassessment                        | R01/R02/R03 false statements still appear in affected cases |
| Refused start, CRRT-04 | Attempt and refusal recorded; no actual start invented        | Workflow E2E passes; lab prose still R01                    |
| Diagnostic, CRRT-13    | Inspection recorded without pretending it corrected the cause | PASS                                                        |
| Acknowledgement only   | Acknowledgement distinct from correction                      | PASS                                                        |
| Harmful                | Unsafe choice and its effect remain recorded                  | PASS; not a competence score                                |
| Corrective             | Real setting/cause changes and action-carried time recorded   | PASS actual ledger                                          |
| Recovery after harm    | Earlier harmful event retained, remaining higher Qb visible   | PASS                                                        |
| No reassessment        | “Not recorded” and recommendation clearly distinguished       | R02 generic tail contradicts this in affected cases         |
| Committed reassessment | Only selected observations recorded                           | PASS actual ledger; not clinical-success certification      |

## 7. Learn, feedback, storage and navigation

**25 optional questions:** all inventoried and opened in production. Reveal-first and skip
worked for all 25; answer/check/retry ran for 20 directly. Five Lesson-8 checks legitimately
require the associated operational observation first; they were not bypassed in the custom
browser sweep. The full advanced/operations browser journeys exercised those real run
prerequisites. The existing `fellow04AllQuestionsSanity.test.tsx` separately passed all 25
real-gate reveal/skip cases and all 25 wrong/right/retry presentation cases; the latter
explicitly mocks readiness, so it is not presented as 25 independent end-to-end run setups.
Correctness does not gate continuation; observation prerequisites are not score gates.

**Five rapid drills:** all response options, reveal-first and reset reviewed in production;
feedback remained cause-first, ungraded and transient. Representative changed action cards
(CRRT-03/05/08/11/12/13/17) showed optional teaching/recording semantics; their content
truth problems are recorded above rather than hidden by a generic UI PASS.

**Whole-patient balance diagnostic:** existing full matrix passed correct, clearly wrong,
unique sign error, liters/unit error, wrong window, category mixing, arbitrary number,
ambiguous collisions, missing urine and empty input. Only a unique arithmetic signature
gets a specific misconception; collisions get general feedback. Rendered reveal/retry
paths and production balance feedback also passed.

**Six-signal pressure lab:** access, filter, return, effluent, TMP and filter drop were
compared separately across locations; arithmetic follows the selected pattern. The tests
covered matched/mismatched predictions, deliberately wrong derived signals, all-reveal
with no predictions and revision/retry. No total score or first-attempt record appeared.

**Storage:** production seeded existing v3 progress with nonempty legacy attempts,
bestSafeScores, criticalErrorAttempts, hintUse, completed identifiers, an unknown future
field and a separate unrelated key. Hub, Learn, Help, Reference, Evidence, Practice,
Challenge and case navigation preserved the seeded values. A separate nine-switch
Operator/Prescriber/Both roles sequence and reset preserved legacy/unknown fields.
Only self-paced location/visited metadata changed; no new attempts, score, mastery or
competence was persisted. Old records were preserved, not interpreted as new completion.
Evidence: `learning-storage.json`, `supplement.json`, storage/consumer Jest and E2E.

**Navigation:** production tested direct query identity, invalid fallback with notice,
previous/next boundaries, all 17 Practice options (10 core + 7 additional), CRRT-16 Challenge,
reload, Back/Forward and visited semantics. Repeated perspective changes preserve the run
and do not score or complete it. Development rapid-selection/reload has R05; therefore this
report does not grant an unconditional all-environment navigation PASS.

## 8. Glossary, sources and review integrity

All 21 entries were read and their bases checked against registered records or explicit
module/model semantics. This checks traceability and truth about the model; it does not
approve clinical wording or certify current manufacturer behavior.

| Entry                     | Registered or explicit basis                                  | Open limitation                                                                |
| ------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| PBP                       | Module circuit drawing; MATH-PM-001, FLUID-PM-002             | Actual approved infusion configuration governs                                 |
| Dialysate                 | Drawing; MATH-PM-001, FLUID-PM-002                            | Distinct from blood-path replacement                                           |
| Pre-filter replacement    | Drawing; MATH-PM-001                                          | Split consequences not modeled                                                 |
| Post-filter replacement   | Drawing; MATH-PM-001                                          | Location concept, not universal preferred split                                |
| Syringe                   | MATH-PM-001, FLUID-PM-002                                     | No drug or rate inferred                                                       |
| Makeup                    | MATH-PM-001, FLUID-PM-002                                     | Attribution open; universal withholding claim fails R04                        |
| Effluent                  | MATH-PM-001                                                   | Not equivalent to patient loss                                                 |
| Net machine removal       | FLUID-PM-002, FLUID-PM-001                                    | Makeup omission remains open                                                   |
| Whole-patient balance     | FLUID-PM-001 plus explicit external-ledger semantics          | Missing inputs/outputs cannot be assumed zero                                  |
| Prescribed flow           | Set-versus-actual model rule; GUID-RRT-ICU-2026 topic mapping | Setting is not delivery                                                        |
| Actual blood flow         | Pump/connection model rule; GUID-RRT-ICU-2026                 | Explicit actual-flow gating                                                    |
| Prescribed/delivered dose | DOSE-PM-001; TEXT-CRRT-NEYRA-2026 topic mapping               | Intensity proxy, no clinical target/clearance claim                            |
| Downtime                  | Active delivery-window clock; GUID-RRT-ICU-2026               | Terminally closed charting window is not newly accumulating treatment downtime |
| Diffusion                 | REVIEW-CKRT-CORE-2025 transport topic                         | Concept, not current clinical chemistry simulation                             |
| Convection                | Same registered transport topic                               | Same                                                                           |
| Ultrafiltration           | Same registered transport topic                               | Net removal and replacement distinguished                                      |
| TMP                       | MATH-PM-002                                                   | Derived signal; −18 term and software scope explicit                           |
| Filter drop               | DEV-PM-010                                                    | −25 placement G01-CRRT-02 held                                                 |
| Urea marker               | Explicit model-pool semantics                                 | Not measured patient lab; no valid clinical-response claim                     |
| Creatinine marker         | Supplied lab/model unit semantics                             | Supplied mg/dL; no modeled recovery                                            |
| Simulated alert           | Explicit generic training-event semantics                     | Not manufacturer alarm identity, priority or threshold                         |

The draft glossary banner states that no clinician has reviewed the definitions. Source
records, conflict IDs, device-version limitations and pending labels remain visible.
No external-source status was upgraded by this engineering audit.

`queue-integrity.json` verifies all **34** Batch-05 items have status **NOT REVIEWED** and
all six fields (`reviewer`, `reviewerRole`, `reviewDate`, `decision`, `requiredChange`,
`unresolvedDisagreement`) are explicitly null on every item. O-01–O-10 and G-01–G-10 are
all represented and pending. The separate G01 source queue's ten decisions also remain
NOT REVIEWED with all other reviewer-decision fields null.

Unchanged SHA-256:

- Batch-05 queue: `fa4b7656f06df44008d99b0d5c92f55aeecb4dd40771e488d1a7d7e15522363b`.
- G01 queue: `7a80a66e1afa32bdbe7f3cc06bf5732b3ade9e49ed145749673a5b6ce48efc8d`.

## 9. Responsive/accessibility and automated gate

The independent production matrix covered **1440×900, 1280×900, 1024×768, 390×844,
320×740, and 1280×900 with 200% root text**. At each size it captured hub, glossary,
Learn, Lesson 5, CRRT-12 and CRRT-15 initial/Help/Evidence/circuit/debrief, pressure lab
and balance feedback: **96 settled surface captures plus 24 focus-return observations**.
No page errors, CRRT local horizontal overflow or dialog clipping were found. All 24
Help/Evidence Escape-close observations returned focus. Representative desktop, tablet,
320/390 mobile and 200% screenshots were visually inspected; long content retained its
local/document scrolling rather than being cut off. Initial drawer captures taken during
animation were superseded by settled captures and are not used as product findings.

Existing full browser suites additionally exercised Tab/Shift+Tab, Enter/Space, focus
traps, visible focus, circuit expansion, reduced motion, Escape, return focus and scroll
ownership. The independent keyboard action probe observed focus on BODY after a performed
button was removed; the next Tab reached the next Perform button. This is a transient
focus-retention qualification, not evidence of a keyboard trap. No universal screen-reader
or all-browser certification is claimed.

At 200% root text the **site header** still contributes 51 px document overflow; the CRRT
local overflow list stays empty and dialogs remain within the viewport. This is the
explicitly allowed **OTHER OWNER** issue, not repaired here.

| Gate                                         | Current execution result                                                                                                            | Evidence                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Complete CRRT feature Jest                   | **83 suites / 994 tests PASS**                                                                                                      | Subset of `jest.json`, exact `/src/features/baxter-crrt/` path                                          |
| Broad CRRT/routes/shared Jest                | **133 suites pass / 3 fail; 1,560 tests pass / 3 fail** (136 total suites)                                                          | `jest.log`, `jest.json`                                                                                 |
| Identical broad Jest, untouched same-main    | **Same counts and same three failures**                                                                                             | `baseline-jest.log/json`; messages identical after dependency-stack-path normalization                  |
| Additional shared consumers                  | **7 suites / 160 tests PASS**                                                                                                       | SiteUsageTracker, site-auth, ICU scoring/persistence/engine, MCS self-paced consumers; `consumers.json` |
| Targeted repaired production E2E             | **4 PASS**                                                                                                                          | `repaired-production.log`                                                                               |
| All eight CRRT Playwright specs, production  | **71 PASS / 1 SKIP / 0 FAIL**                                                                                                       | `production-full.log`, `playwright-production.json`                                                     |
| All eight CRRT Playwright specs, development | **70 PASS / 1 SKIP / 1 FAIL**                                                                                                       | `development-full.log`, `playwright-development.json`; R05                                              |
| Unchanged targeted dev repeat                | **1 FAIL**, same CRRT-14/18 reload assertion                                                                                        | `dev-target-retry.log`                                                                                  |
| Same target, untouched same-main dev         | **1 PASS**                                                                                                                          | `baseline-dev-target.log`; not claimed as identical failure                                             |
| Systemic CRRT layout/UX                      | **52 PASS**                                                                                                                         | `systemic.log` and `systemic/`                                                                          |
| Full TypeScript                              | **FAIL**, two EBUS TS2769 diagnostics                                                                                               | `typecheck.log`; identical `baseline-typecheck.log`                                                     |
| ESLint                                       | **PASS: 0 errors, 15 non-CRRT warnings**                                                                                            | `lint.log`                                                                                              |
| Prettier                                     | **PASS** CRRT feature/routes/E2E, decision packet/queue and final report                                                            | `prettier.log`, `report-checks.log`                                                                     |
| `git diff --check`                           | **PASS**                                                                                                                            | Final report-only diff checked                                                                          |
| Full production build                        | **PASS** both embedded apps, content/assets, Next and standalone preparation                                                        | `build-final.log`                                                                                       |
| Independent probes                           | Completed 18-case engine/browser sweep, terminal/pressure/makeup/residual, matched 05/11/13, learning/storage and responsive matrix | JSON and scripts named above; these captures are not assertions that all contracts pass                 |

The skip is the existing beta-wrapper test which self-skips when its local owner flag is
absent. No test was modified to skip it. Full build first failed for missing nested app
Vite dependencies in the fresh checkout; after provisioning existing local dependencies,
the complete unmodified build passed. These initial setup failures remain in `build.log`
and `build-retry.log`; they are not hidden runtime repairs.

The three shared Jest failures are:

1. `critical-care/__tests__/accessibility.test.tsx:237`: old expected CRRT image accessible
   name versus the canonical circuit image now rendered. Expected/actual DOM and assertion
   match on both checkouts; only the dependency stack path differed.
2. `critical-care/__tests__/curriculum-sequencing.test.tsx:211`: trailing PrisMax
   troubleshooting challenge expectation. Identical failure on untouched main.
3. `critical-care/__tests__/learner-copy.test.ts:194`: remaining MV/MCS copy findings.
   Identical failure on untouched main, not a newly introduced CRRT copy finding.

TypeScript fails at `src/features/ebus-guided/__tests__/lesson.test.tsx:380` and `:382`:
`exact` is not a supported `ByRoleOptions` property. Both diagnostics reproduce on
untouched same-main. The production build's successful type stage is not represented as
full test-inclusive TypeScript success.

Reproduction commands (from the acceptance checkout, scratch configs retain exact ports
and output paths):

```sh
NODE_OPTIONS=--max-old-space-size=16384 npx --no-install jest --runInBand \
  src/features/baxter-crrt src/features/critical-care src/features/learning-module \
  'src/app/.*/baxter-crrt' src/app/api/analytics src/app/sitemap.baxter-crrt.test.ts \
  src/features/module-beta src/lib/draft-modules.baxter-crrt.test.ts \
  src/lib/site-search.baxter-crrt.test.ts --json --outputFile=/tmp/crrt-final-20261003/jest.json
npx --no-install playwright test -c /tmp/crrt-final-20261003/playwright.production.config.cjs
npx --no-install playwright test -c /tmp/crrt-final-20261003/playwright.development.config.cjs
SYSTEMIC_UX_BASE_URL=http://127.0.0.1:3296 \
  SYSTEMIC_UX_OUTPUT_DIR=/tmp/crrt-final-20261003/systemic \
  npx --no-install playwright test -c playwright.systemic-ux.config.ts \
  e2e/systemic-ux.spec.ts e2e/systemic-ux-stabilization.spec.ts --grep 'CRRT|crrt'
npm run type-check
npm run lint
npm run build
```

No runtime/content/test, source-review record, decision queue or clinical/device/model
policy was changed. No deployment occurred. This completed review requires bounded
follow-up for R01–R04 and adjudication of R05; the historical F06-01 and terminal-End
repairs do not need reopening on this evidence.

---

## Appendix — historical stopped review, 2026-09-24

The text below records the earlier stopped review and its then-current SHAs/results.
Its NOT RUN items and open F06-01 describe **that historical execution only**. The completed
2026-10-03 review above supersedes those statuses; retaining this record does not assert
that F06-01 is still broken or that the resumed matrices were not run.

**Historical stopped disposition: NOT READY**

Review date: 2026-09-24. One independently reproduced blocking finding:
**F06-01 — FAIL — UNSUPPORTED CLAIM EXPOSED (CRRT-12).**

This is a stopped acceptance review, not a completed full-module acceptance.
The current task explicitly says: “If a real defect is found, reproduce and classify it precisely, then stop with it recorded.”
That instruction overrides the older Batch-06 prompt's instruction to continue discovery.
After reproducing F06-01, only its root-cause corroboration, result collection,
main-drift reconciliation, and report preparation continued. No defect was repaired.

### 1. Identity, isolation, ancestry, and main reconciliation

| Item                             | Recorded value                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Tested production/runtime SHA    | `afe74131b83718be1bb07b8739f8ba2bd37a0c07`                                                                               |
| Initial fetched `origin/main`    | Same SHA; PR #276 confirmed MERGED before testing                                                                        |
| Isolated acceptance checkout     | `/Users/russellmiller/.codex/worktrees/crrt-fellow-06-acceptance/codex-crrt-06`                                          |
| Acceptance branch                | `codex/crrt-fellow-06-acceptance`                                                                                        |
| Content version                  | `1.1.0-sme-review.1` — release label, not clinician approval                                                             |
| Engine version                   | `1.0.0`                                                                                                                  |
| Production browser server        | Fresh `npm run build` output, `next start -H 127.0.0.1 -p 32806`                                                         |
| Browser                          | Playwright Chromium, headless, fresh isolated context, 1440×900                                                          |
| Environment                      | Synthetic preview URL/key supplied as process environment; no environment file or stored secret copied                   |
| Final fetched `origin/main`      | `41a34608ec556a59270b4c3b2b5bbb1c924653be`                                                                               |
| Current-main comparison checkout | Fresh detached `/private/tmp/crrt-fellow06-current-main` at `41a34608…`, used only for the identical shared-test command |

The task's original checkout was used to read instructions and fetch; it was not used for
acceptance testing. No implementation or earlier sanity-review checkout was reused.

All five merge commits were verified as ancestors of the tested SHA with
`git merge-base --is-ancestor` (exit 0 for each).

| Batch | PR   | Merge SHA                                  | Merged at (UTC)     |
| ----- | ---- | ------------------------------------------ | ------------------- |
| 01    | #257 | `f01e43e2410e96f8f77a0db6814a4853749add24` | 2026-09-22 00:50:38 |
| 02    | #263 | `745146f6e40bd536c201313f0480ddde2ee03ca3` | 2026-09-22 18:25:19 |
| 03    | #268 | `bf15fb951387e9246b260a5b7336f46e86207f50` | 2026-09-23 00:25:55 |
| 04    | #275 | `85acc113be11f9acbd395f49e00fee4b69ceff71` | 2026-09-23 23:07:19 |
| 05    | #276 | `afe74131b83718be1bb07b8739f8ba2bd37a0c07` | 2026-09-24 18:14:30 |

Main moved through MCS PR #264 during acceptance. The 30 changed paths belong to MCS code,
tests, or MCS remediation documents. None overlaps CRRT, its routes, its E2E specs,
learning-module/critical-care shared infrastructure, package manifests, or Next configuration.
The CRRT reproduction therefore describes current main's unchanged CRRT implementation.
The shared learner-copy suite scans MCS, so its full command was rerun on untouched new main;
the precise comparison is below. No stale-tree PASS is asserted.

The runtime and E2E trees at the tested SHA are also byte-identical to the Batch-04 merge
`85acc113…`; Batch 05 added its two documentation files only.

### 2. Blocker F06-01 — CRRT-12 promises evidence it does not provide

**Classification: FAIL — UNSUPPORTED CLAIM EXPOSED. Priority: P1.**

- **Route:** `/en/baxter-crrt/practice?case=CRRT-12`.
- **Title:** “Electrolyte, temperature, medication, and nutrition consequences.”
- **Affected surfaces:** case introduction/opening findings; Current task objective;
  worked plan; performed-action response; action teaching notes and repeated trend-review
  sentence in the debrief.
- **Likely owner:** CRRT case/content presentation and its evidence-scope adapter.
  Larger physiological or authored-series work remains O-01/O-10/G-10 owner/source work.
- **Expected:** any promised changing clinical evidence is actually present, or the case clearly
  identifies it as absent and makes the learner's action a request/plan for further information.
  A performed action must not announce that unavailable linked trends have become available.
- **Actual:** the case claims changing electrolyte, temperature, medication-delivery, and
  nutrition trends during interrupted therapy. Performing its review action displays:
  **“The linked trends and delivery timeline become available for coordinated interpretation.”**
  Those clinical trends never appear. The debrief repeats this sentence while separately
  stating that laboratory changes are not modeled.

#### Exact production reproduction

1. Open the direct CRRT-12 URL in a fresh context at 1440×900.
2. Read the case introduction and “What this case covers.” They say the four monitoring domains
   change alongside interrupted treatment. The goal asks the learner to integrate patient trends.
3. Open **Evidence**. The drawer supplies references and pending-review limitations, not the
   promised serial case evidence. Close with Escape.
4. Open **Explain this case**.
5. Perform **Complete the initial clinical assessment**.
6. Perform **Review linked trends and coordinate the appropriate multidisciplinary reassessment**.
   The card says the simulation changes no setting, then shows the affirmative availability
   sentence quoted above.
7. Click **+1 hr** twice. Open **Patient & trends**.
   It contains delivered dose **18.82 mL/kg/h**, whole-patient balance **−320 mL**,
   downtime **0 min**, and reassessment **Not recorded**. It contains no electrolyte,
   temperature, medication-exposure, or nutrition series.
8. Open **Debrief**, then **End run and review debrief** without committing reassessment.
   The actual-action and no-reassessment records remain honest. The laboratory section explicitly
   withholds dynamic labs. Nevertheless, “Action teaching notes from this run” and the following
   trend-review paragraph again promise that the linked trends have become available.

No page JavaScript errors occurred. Screenshots and text captures were saved. The start-page
screenshot and the performed-action screenshot were visually inspected. This journey does not
constitute the requested full accessibility/layout matrix.

#### Claim-by-claim adjudication

| Claimed phenomenon                                 | Actual evidence/category                                                                                                                                                                       | Acceptance consequence                                                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Electrolyte trends change                          | Static supplied case-start labs; internal removal-only solute pools are unsupported and suppressed. No valid clinical series.                                                                  | Unsupported case prose, contradicted by the debrief's correct containment statement                                   |
| Temperature trend changes                          | One authored 35.8 °C scalar, unchanged at two hours; no temperature trend field or displayed series                                                                                            | Static supplied value, not changing evidence                                                                          |
| Medication-delivery/exposure trend changes         | No medication exposure series or medication kinetics in this case; fixed external fluid inputs do not establish drug exposure                                                                  | Absent evidence; unsupported availability claim                                                                       |
| Nutrition trend changes                            | No nutrition series or metabolic consequence model; input-volume bookkeeping does not establish nutrition response                                                                             | Absent evidence; unsupported availability claim                                                                       |
| A period of interrupted treatment supplies context | Narrative only. Fresh run starts running; its only authored timed event sets delivery to running at 60 s. Tested two-hour path has zero downtime. No supplied time-stamped interruption record | May be treated as qualitative supplied history only if labeled; cannot be claimed as this run's observed interruption |
| Delivery timeline                                  | Real current-run actions, elapsed time, delivery, and pressure/fluid samples exist                                                                                                             | Supported only for the events and quantities actually recorded                                                        |
| Review action makes linked trends available        | All five CRRT-12 interventions have `effects: []`; initial assessment plus review leaves the complete simulation byte-identical                                                                | False action-result statement                                                                                         |
| Patient inputs create a changing baseline          | Generic causal teaching; no supplied four-domain baseline series                                                                                                                               | Does not establish that this case carries the promised phenotype                                                      |

This is **not merely an absent optional explanation component**. The visible performed-action
response and debrief assert a result that the case does not generate or supply. A general draft
disclaimer or future owner decision does not contain that affirmative claim.

#### Code trace and smallest bounded future repair

Relevant tested-tree locations:

- `src/features/baxter-crrt/content/completeCases.ts:1684`: CRRT-12 adapts CRRT-11.
  Lines 1690, 1692, 1700, 1705, and 1709 carry the claims.
- `completeCases.ts:1201` and `:1219`: expected response is copied into the safe and alternative
  action responses. Line 1263 copies it into `debrief.trendReview`.
- `src/features/baxter-crrt/content/caseEvidenceScope.ts:286`: scope lookup returns
  `undefined` for CRRT-12.
- `src/features/baxter-crrt/components/CrrtCasePlayer.tsx:821`: Patient & trends exposes
  delivery/balance/downtime/reassessment, not the promised clinical series.
- `src/features/baxter-crrt/engine/simulation.ts:453`: fluid-tolerance state and generic
  solute pools advance. `engine/patientModel.ts` changes reserve, overload, and stress only.

**Smallest repair proposal, not implemented:** frame CRRT-12 as a multidisciplinary
information-gap/planning exercise; remove affirmative “trends change/become available” claims
from its intro, findings, action responses, expected response, and debrief; add a CRRT-12
evidence-scope entry naming static supplied values, absent serial evidence, and the supported
delivery ledger. A performed review should record a plan/request for evidence, not its arrival.
Keep the current engine and source holds unchanged. Add a focused rendered regression covering
the action response and debrief when no serial evidence exists. An authored series or new
physiology would be a separate reviewed decision, not part of this minimal repair.

### 3. Automated validation actually completed

These are current executions, not inherited handoff results.

| Check                                                            | Result                                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Initial CRRT plus selected shared consumers                      | 109 suites / 1,227 tests passed                                                                              |
| Complete CRRT suites within the broad command                    | **81 suites / 969 tests passed**                                                                             |
| Broad shared command at tested SHA                               | 127 suites passed / 3 failed; **1,480 tests passed / 3 failed**                                              |
| Identical command on untouched final main                        | Same counts and same three failure causes                                                                    |
| `npm run build`                                                  | PASS, including both training apps, content, asset validation, Next production build, standalone preparation |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`      | PASS                                                                                                         |
| `npm run lint`                                                   | Exit 0; 0 errors / 15 warnings outside CRRT                                                                  |
| CRRT/runtime-route/E2E plus Batch-05 packet/queue Prettier check | PASS                                                                                                         |
| `git diff --check` before report                                 | PASS, clean tracked tree                                                                                     |
| Independent mass-unit probe                                      | 54/54 case/pool conversions and round trips pass                                                             |
| Independent source/queue inventory                               | Results in §7                                                                                                |
| Targeted real production-browser journey                         | CRRT-12 blocker reproduced; no page errors                                                                   |
| Full CRRT dev/production Playwright and systemic UX specs        | **NOT RUN — stopped on F06-01**                                                                              |

Exact broad command (only JSON/log destinations differ between the two checkouts):

```sh
NODE_OPTIONS=--max-old-space-size=8192 npx --no-install jest --runInBand \
  src/features/baxter-crrt src/features/critical-care src/features/learning-module \
  'src/app/.*/baxter-crrt' src/app/api/analytics \
  src/app/sitemap.baxter-crrt.test.ts src/features/module-beta \
  --json --outputFile=/tmp/crrt-fellow06-shared.json
```

#### Shared failures: same assertion and cause on untouched current main

| Failure                                                        | Expected / actual                                                                                                                                                     | Comparison and disposition                                                                                                                                                                                 |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accessibility.test.tsx:237`, color-independent circuit states | Expected image accessible name matching the older patient-access sequence; actual circuit uses the canonical “Universal CRRT circuit topology Pressure profile…” name | Failure text identical after checkout-root normalization. **DEFERRED / OTHER OWNER**: shared accessible-name expectation; no new CRRT finding established                                                  |
| `curriculum-sequencing.test.tsx:211`, CRRT case order          | Expected authored case heading list; actual adds trailing “PrisMax troubleshooting challenge”                                                                         | Failure text identical after root normalization. **DEFERRED / OTHER OWNER**: shared curriculum expectation                                                                                                 |
| `learner-copy.test.ts:194`, static copy gate                   | Expected empty list; actual 12 MCS/MV copy findings, zero CRRT findings                                                                                               | Same 12 copies/files/terms on both. Only MCS “Seed” source-line metadata moves 115 → 149 with main. Same assertion and expected/actual cause, not byte-identical entire output. **DEFERRED / OTHER OWNER** |

The three failures are not counted as passes. They do not explain or excuse F06-01.
No test was edited, disabled, weakened, or given a new expected value.

The production server emitted Next's advisory that standalone output should use its standalone
server. The tested HTTP application served this checkout's successful production build;
standalone-package portability was not tested. Nonfatal upstream build warnings remain in the log.

### 4. Browser matrix and stop boundary

| Journey / viewport                                                                                                           | Evidence this review obtained                                                                  | Status                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| CRRT-12 direct case entry, intro, worked plan, Evidence, assessment/review action, +2 h, Patient & trends, debrief; 1440×900 | Real production Chromium, fresh storage, visible text/screenshots, exact reducer corroboration | **FAIL — UNSUPPORTED CLAIM EXPOSED**                                   |
| CRRT-12 actual actions / no reassessment                                                                                     | Actual timeline lists performed actions and two learner hours; reassessment stays Not recorded | Bounded truthful behavior observed, not a complete Batch-01 acceptance |
| Remaining 14 requested production journeys                                                                                   | No independent browser execution after stop                                                    | NOT RUN                                                                |
| 1280×900, 1024×768, 390×844, 320×740, 200% root text                                                                         | No current independent layout measurements                                                     | NOT RUN                                                                |
| Full keyboard matrix, focus return/visibility, expanded circuit, long Lesson 5, glossary, balance/pressure labs              | Existing Jest coverage passed; no fresh complete browser journey                               | NOT RUN for requested acceptance                                       |
| Dev browser suite; production suite; systemic layout/UX suite                                                                | Not launched                                                                                   | NOT RUN                                                                |

The initial scratch browser selector matched three headings and was narrowed to the actual case
heading before reproduction. That was a harness error, not an application defect or a passing
journey. Repository tests were untouched.

### 5. Acceptance matrix — adjudicated contracts only

Each evaluated row has exactly one classification. Unfinished contracts are listed separately
in §9 rather than assigned a speculative PASS or FAIL.

| Contract/finding                          | Origin                                        | Current behavior                                                                               | Evidence tested                                                                                      | Classification                       | Hold / next action                                                        |
| ----------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| CRRT-12 claimed changing/available trends | Batch 05 new observation, inherited case copy | Affirmative intro/action/debrief claims with absent clinical series                            | Production journey, DOM text, screenshots, unchanged simulation after action, two-hour reducer probe | **FAIL — UNSUPPORTED CLAIM EXPOSED** | F06-01 bounded presentation/evidence repair; O-01/O-10/G-10 remain open   |
| mg/dL → mg/L normalization and round trip | Batch 04 / F-24                               | All 18 cases × 3 pools equal authored value ×10; inverse returns authored quantity             | Independent 54-row probe plus unchanged runtime tree relative to accepted Batch-04 merge             | **PASS**                             | No model-validity inference from correct units                            |
| Patient-level residual kidney clearance   | Batch 05 / O-01                               | Authored/normalized but not consumed by solute advancement; per-pool field is consumed instead | Normalizer/equation/call-site trace, all-case field inventory, learner-copy search                   | **PASS — MODEL NOT IMPLEMENTED**     | O-01: linking fields needs reviewed specification; do not wire it in here |
| Decision queue structural integrity       | Batch 05                                      | 34 items NOT REVIEWED, reviewer/decision fields null; O-01–10/G-01–10/E-01–10/F-01 present     | JSON inventory and registered-ID resolution                                                          | **PASS WITH HOLD**                   | All decisions remain pending; full semantic packet audit unfinished       |
| Current registered review-state invariant | Batches 01–05                                 | All inventoried source records pending; no current clinician/device approval                   | Live registry inventory, source files, zero runtime diff since Batch 04                              | **PASS WITH HOLD**                   | Human clinical/device/source review still required                        |
| Three shared-suite failure causes         | Prior shared debt                             | Same assertions and causes on untouched final main                                             | Identical broad Jest commands and failure comparison                                                 | **DEFERRED / OTHER OWNER**           | Shared test/copy owners; see §3                                           |

### 6. Unit normalization and residual-clearance adjudication

Every cell below is **authored mg/dL → normalized mg/L**. Independent division by 10 returns
the original value within 1e−12 for every row; engine concentration units are mg/L.

| Case | Creatinine marker | Phosphate | Magnesium |
| ---- | ----------------- | --------- | --------- |
| 01   | 3.4 → 34          | 5.6 → 56  | 2.1 → 21  |
| 02   | 4.1 → 41          | 6.2 → 62  | 2.4 → 24  |
| 03   | 4.1 → 41          | 6.2 → 62  | 2.4 → 24  |
| 04   | 3.6 → 36          | 5.2 → 52  | 2.2 → 22  |
| 05   | 3 → 30            | 5 → 50    | 2 → 20    |
| 06   | 3.1 → 31          | 4.9 → 49  | 2 → 20    |
| 07   | 3.2 → 32          | 4.8 → 48  | 2 → 20    |
| 08   | 3.2 → 32          | 4.8 → 48  | 2 → 20    |
| 09   | 3.2 → 32          | 4.8 → 48  | 2 → 20    |
| 10   | 3.1 → 31          | 4.8 → 48  | 2.1 → 21  |
| 11   | 2.9 → 29          | 4.7 → 47  | 2 → 20    |
| 12   | 2.9 → 29          | 4.7 → 47  | 2 → 20    |
| 13   | 2.9 → 29          | 4.5 → 45  | 2 → 20    |
| 14   | 2.9 → 29          | 4.5 → 45  | 2 → 20    |
| 15   | 3 → 30            | 4.8 → 48  | 2 → 20    |
| 16   | 3 → 30            | 4.8 → 48  | 2 → 20    |
| 17   | 2.9 → 29          | 4.7 → 47  | 2 → 20    |
| 18   | 2.9 → 29          | 4.7 → 47  | 2 → 20    |

`runtimeCaseNormalization.ts` converts each mass concentration once through the central
helper. It preserves urea-marker mmol/L. Total calcium follows the separately configured
nullable molar field; no total-calcium mass↔molar conversion was introduced.

There is zero `src/` or `e2e/` diff between the Batch-04 merge and the tested SHA.
Consequently the same deterministic input/actions have the same engine, learner-state,
progression, safety/verdict, and scoring behavior; no Batch-05 double conversion is possible.
A fresh independent all-case trajectory snapshot comparison was **not** performed.
The passing CRRT suite includes unit/containment regression tests; unsupported chemistry
remains suppressed in the independently viewed CRRT-12 lab section.

Residual clearance trace:

1. Authored field: `initialPatient.residualRenalClearanceMlPerMin` (patient content/schema).
2. Normalized by `runtimeCaseNormalization.ts:97` to `patient.residualKidneyClearanceMlMin`.
3. All-case inventory: CRRT-10 is 2 mL/min; every other case is 0.
4. Solute pools separately receive `configuration.residualClearanceMlPerMin` as
   `pool.residualClearanceMlMin` (normalizer lines 53 and 75). Every pool in every case is 0.
5. `simulation.ts:463` passes the pools, delivered effluent, inlet fraction, and duration to
   `advanceSolutePools`; it does not pass the patient-level field.
6. `soluteModel.ts:59` consumes **pool** residual clearance in total clearance.
7. Learner-copy search finds supplied fixed clearance in the CRRT-18 scope and the missing
   reviewed-source specification in generic chemistry containment. No wording was found
   claiming that the patient-level field currently changes simulated chemistry.

**PASS — MODEL NOT IMPLEMENTED**, with O-01 owner hold. This is an unused patient input,
not authorization to connect it. No change was made.

### 7. Decision packet, source status, and documentary evidence

The preflight consulted root AGENTS/CLAUDE instructions (no applicable nested CRRT instructions),
the Local-Data map, the implementation package's common contract, feedback ledger, source/code
notes, owner decisions, coordination file, and Batch prompts 01–06; CRRT-FELLOW handoffs and
sanity reports; Batch-04 copy sheet/proposals; and the Batch-05 packet/queue and G01 queue.
These records guided investigation; their historical PASS statements are not current proof.
**The requested exhaustive line-by-line remediation-record and packet/runtime audit was not
completed before the stop.** Large document outputs were partially truncated, and no claim of
complete source-document review is made.

Current structural checks:

- Batch-05 queue: **34/34 NOT REVIEWED**. Reviewer, reviewer role, review date, decision,
  required change, and unresolved disagreement are null.
- O-01–O-10 and G-01–G-10 all covered; E-01–E-10 and F-01 present.
- G01 queue: **10/10 reviewer decisions NOT REVIEWED**, all reviewer/role/date/content-version/
  required-change/disagreement fields null.
- No unresolved source ID among queue `sourceIds`, `sourceRecordIds`, or
  `sourceDocumentIds`, using the learner resolver, document registry, and case source basis.
- Learner-source registry: **82 raw entries, 73 unique IDs**; all pending, all reviewer fields
  null. Duplicate registry membership explains the raw/unique difference.
- Source-document registry: **3 documents, all pending**. Thus there are **76 unique
  learner-record/document IDs combined**, distinct from 82 raw learner-record entries.
  Do not mistake any of these counts for reviewed sources.
- Runtime unchanged from Batch 04; no Batch-05 proposal, lesson split, source approval,
  or physiological implementation was introduced by that merge.

Packet/runtime relationship: its §17 CRRT-12 “NOT REPRODUCED” observation is now independently
confirmed as F06-01. The packet accurately flags the risk; its documentation does not contain
the exposed learner claim. Its residual-clearance observation is confirmed. No clinical
publication status, manual interpretation, alarm mapping, or proposed numerical guidance was
independently adjudicated here.

### 8. Unresolved anomalies and model/source holds

These items remain visible in the report; absence of a new FAIL below is **not acceptance**.
Where browser acceptance was not completed, the classification remains unadjudicated.

| Item                                                       | Current evidence / remaining question                                                                                                                                                                                                                | Current-review status and next owner                                                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| CRRT-15 access pressure −40.5 / −40 / −41                  | Source trace: evidence uses locale formatting with at most 1 decimal; live profile uses `Math.round`; device uses `toFixed(0)`. Different tie rules are present. Exact same-state browser reproduction and all-surface timestamp audit were not run. | **NOT ADJUDICATED** as benign vs engineering defect. CRRT presentation owner must complete it; no accepted rounding rule is declared |
| Device “0 mL / 0 mL” vs evidence “Unavailable”             | Source trace: device reads cumulative `deliveredTherapy` outputs; evidence reads `latestTrend`, which may be absent before the first sample. The device label says “Machine removal / whole balance,” not a setting.                                 | **NOT ADJUDICATED** by independent CRRT-15 browser reproduction. No setting-versus-balance PASS is granted                           |
| Pressure offsets / no-flow validity                        | Existing tests pass; −25 placement and −18 interpretation are held. Running, zero actual flow, paused, stopped/idle browser matrix not rerun.                                                                                                        | **NOT ADJUDICATED** containment acceptance. O-04/O-04T, G01-CRRT-01/02/04                                                            |
| Makeup                                                     | Ledger and device adapter contain explicit unresolved-attribution withholding, including previously delivered makeup. Nonzero authored-fixture browser path and every consumer were not exercised.                                                   | **NOT ADJUDICATED** across surfaces. CONFLICT-CRRT-MAKEUP-001                                                                        |
| No reviewed solution chemistry                             | Generic pools remain unsupported; real CRRT-12 debrief correctly withholds chemistry, but its case claims still fail                                                                                                                                 | O-01; no full-module MODEL NOT IMPLEMENTED PASS                                                                                      |
| No citrate anticoagulation physiology / serial calcium     | Prior model/evidence hold, passing existing suites; CRRT-17 independent browser journey not run                                                                                                                                                      | O-05C/O-09; containment acceptance unfinished                                                                                        |
| No filter-change action / true recurrent filter-loss model | Prior model hold; CRRT-15/16 independent browser journeys not run                                                                                                                                                                                    | O-06; history/plan/intervention acceptance unfinished                                                                                |
| No renal-recovery model                                    | Fixed fields and existing containment tests; CRRT-18 browser journey not run                                                                                                                                                                         | O-05R; containment acceptance unfinished                                                                                             |
| No BP/pressor response                                     | CRRT-12 debrief visibly marks MAP 59, HR 122, pressor index 0.85 as supplied/held; matched-time CRRT-11 browser paths not run                                                                                                                        | O-02; partial observed containment only                                                                                              |
| No predilution physiological penalty                       | Existing CRRT-05 tests pass; independent production split journey not run                                                                                                                                                                            | O-03, CONFLICT-001/002; containment acceptance unfinished                                                                            |
| Generic alerts / source mapping                            | Existing tests pass; no manufacturer mapping approved                                                                                                                                                                                                | O-09, G01 source holds remain                                                                                                        |
| Ten teaching proposals and Lesson-5 split                  | Queue pending; runtime unchanged from Batch 04                                                                                                                                                                                                       | O-10/E-01–10/F-01; no implementation authorization                                                                                   |
| Other carried source holds                                 | CONFLICT-010 and G01-CRRT-01–10 remain unresolved                                                                                                                                                                                                    | Human source/device review                                                                                                           |
| Global header at 200% root text                            | Prior reviews report 51 px overflow; not independently reproduced here                                                                                                                                                                               | Prior platform-owner finding only; no current CRRT-local reflow PASS                                                                 |
| Shared Reset/minute-label/smooth-scroll issues             | Prior shared ownership; not freshly reproduced                                                                                                                                                                                                       | Platform/shared-learning owners, not CRRT repair scope                                                                               |

A **PASS — MODEL NOT IMPLEMENTED** requires truthful learner containment. The absence of a
physiological implementation alone does not earn it. F06-01 demonstrates why the unexecuted
case journeys cannot be replaced by the passing test count.

### 9. NOT RUN / incomplete acceptance coverage

Stopped because F06-01 met the explicit stop condition:

- Full independent browser case identity/direct-link/reload/Back/Forward/invalid/additional/
  visited-history matrix and repeated perspective-state comparisons.
- Complete no-action/refused/diagnostic/harmful/corrective/recovery/reassessment acceptance
  journeys. The CRRT-12 no-reassessment path is the only new end-to-end evidence here.
- CRRT-04 machine setup, commit, prime, review, stale-review, and start journey.
- CRRT-05 split; CRRT-11 matched-time no-action/corrective/harmful/recovery;
  CRRT-13 correction with/without paused elapsed time; CRRT-15/16/17/18 full journeys.
- Every surface of the pressure-rounding, zero/unavailable, offset/no-flow, and makeup anomalies.
- All 25 optional-question browser branches; five drills/action-card leakage;
  full balance-error collision matrix; six-signal pressure exercise; all 21 glossary entries'
  independent source-semantic audit; all three reset scopes in the browser.
- Full storage seeding/byte-preservation regression through every requested navigation/modal/
  lesson/reset path. Existing Jest coverage passed, but no equivalent fresh browser sweep.
- Full six-condition responsive/accessibility matrix across hub/Learn/long Lesson 5/Practice/
  Challenge/glossary/Help/Evidence/circuit/pressure/balance/debrief.
- CRRT dev and production E2E suites and systemic layout/UX specs.
- Exhaustive packet/runtime wording and placeholder audit, every source locator against its
  original document, and complete prior-record reading.
- Fresh all-case before/after trajectory snapshots against the accepted Batch-04 build.
- Human screen reader, native browser zoom, Firefox/WebKit, physical touch/device/PrisMax,
  real learners, localization, account sync, clinical/device/source adjudication, deployment.

This list is intentionally not converted into successful acceptance classifications.

### 10. Evidence and handoff

Raw evidence is outside Git at:

`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/crrt-fellow06-2026-09-24/`

Principal files:

- `crrt-fellow06-crrt12-journey.cjs`, `crrt-fellow06-crrt12-journey.log`;
- `crrt-fellow06-crrt12-start.png`, `crrt-fellow06-crrt12-promise.png`,
  `crrt-fellow06-crrt12-patient-2h.txt`, `crrt-fellow06-crrt12-debrief-2h.txt`;
- `crrt-fellow06-crrt12-engine.ts` / `.json`;
- `crrt-fellow06-inventory.ts` / `.json`;
- `crrt-fellow06-shared.json`, `crrt-fellow06-current-main-shared.json`;
- build, Jest, lint, type-check, and Prettier logs with the same prefix.

Scratch scripts import the exact isolated checkout by absolute path; their content is preserved
for reproducibility. Raw screenshots and logs are not committed.

**Next bounded step:** repair F06-01 in a separately authorized CRRT change, then resume the
unfinished acceptance matrix, prioritizing the three known display/model-containment anomalies.
This report does not authorize any Batch-05 decision implementation.

The only repository modification in Batch 06 is this report. No runtime, content, tests,
existing review record, source status, owner decision, or deployment changed. A report-only PR
is the repository handoff; it is not a repair PR.
