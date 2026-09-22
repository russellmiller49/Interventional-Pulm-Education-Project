# CRRT-FELLOW-02 — case evidence, causal comparisons and setup workflow

**Status:** implementation complete for the assigned findings; one bounded PR, not merged, not deployed.
**Assigned:** F-02 (causal/time aspects), F-03, F-04, F-05, F-14 (set/actual/paused-state truth),
F-16 (case evidence), F-17 (setup reconciliation), X-02, X-05.
**Not started here:** batch 03 (workbench and wayfinding), batch 04 (teaching and units),
prompt 05 (clinical/device model and source decisions).

## 1. Execution context

| Item                                | Value                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Repository                          | `russellmiller49/Interventional-Pulm-Education-Project`                                                 |
| Worktree                            | `Interventional-Pulm-Education-Worktrees/claude-crrt-9-22` (exclusively owned)                          |
| Branch                              | `claude/crrt-fellow-02`, created from the post-merge `origin/main`                                      |
| **Base SHA**                        | `c1fb8a0d4d0704ea7fc3050d34512104edba79b7` (merge of PR #262)                                           |
| PR #257 / CRRT-FELLOW-01            | **MERGED** as `f01e43e2410e96f8f77a0db6814a4853749add24`, 2026-09-22T00:50:38Z                          |
| Baseline worktree for reproductions | `/private/tmp/crrt-fellow-02-base`, detached at the base SHA                                            |
| Content version                     | `1.1.0-sme-review.1`                                                                                    |
| Playwright server                   | `playwright.baxter-crrt.config.ts` own dev server on 3113                                               |
| Production server                   | `.next/standalone/server.js` on 3134                                                                    |
| Browser                             | Chromium (Playwright), isolated profile; no signed-in browser used                                      |
| `.claude/launch.json`               | **not modified** — the Playwright config supplies its own server, as the #257 sanity review established |

The Baxter CRRT module is draft / unlisted and every route stays `noindex`. No access,
publication, review status, reviewer, date or signoff was changed. No `.env.local`, read-only
mount or Local-Data asset was written.

## 2. Matched-time causal matrix

Every number below comes from the real engine at the base SHA, driven through
`getBaxterCrrtCase` → `createCrrtLearningSession` → `crrtLearningSessionReducer`. The probe was
removed; the surviving assertions live in
`src/features/baxter-crrt/engine/__tests__/matchedTimeCausality.test.ts`.

### Inventory

| Case    | Intended phenomenon                                 | Runtime identity                                              | Configurable inputs                         | Authored latency realised     | Plan-only?  |
| ------- | --------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------- | ----------------------------- | ----------- |
| CRRT-04 | Prescribed vs delivered dose across an interruption | own fixture, `new-patient` phase, prescription starts at zero | Qb, dialysate, PFR (machine and case cards) | `advance-six-hours` +6 h      | no          |
| CRRT-05 | Pre- vs post-filter replacement split               | own fixture, running                                          | pre/post replacement split                  | none                          | no          |
| CRRT-11 | Fluid-removal tolerance                             | own fixture, running                                          | patient fluid removal                       | safe **and** alternative +1 h | no          |
| CRRT-13 | Access-pressure localization and correction         | own fixture, running                                          | Qb, access resistance, delivery state       | `advance-to-pattern` +30 min  | no          |
| CRRT-15 | Filter/effluent pressure localization               | own fixture, running                                          | none (safe action observes only)            | safe +1 h                     | effectively |
| CRRT-16 | Recurrent filter loss                               | **same fixture and seed as CRRT-15**                          | none                                        | **none** (see §7 D-1)         | yes         |
| CRRT-17 | Citrate–calcium safety recognition                  | **same fixture and seed as CRRT-11**                          | none                                        | none                          | yes         |
| CRRT-18 | Renal recovery and transition                       | **same fixture and seed as CRRT-11**                          | none                                        | none                          | yes         |

`latencySeconds` exists on every authored intervention and **nothing in the repository reads
it**. The interval a run actually takes comes from an explicit
`simulation.advanceTimeSeconds` effect. Both are recorded above; only the second is reported to
learners, because only the second happens.

### CRRT-11, matched at two hours (same fixture, same seed)

| Path                                                              | Elapsed | Tolerance-stress index | Reserve remaining | Whole-patient balance | MAP | Critical errors                    |
| ----------------------------------------------------------------- | ------- | ---------------------- | ----------------- | --------------------- | --- | ---------------------------------- |
| No intervention                                                   | 2 h     | 0.760                  | 0 mL              | −320 mL               | 59  | none                               |
| Assessment only                                                   | 2 h     | 0.760                  | 0 mL              | −320 mL               | 59  | none                               |
| Intended corrective (reduce to 30 mL/h, then 1 h of learner time) | 2 h     | **0.480**              | **100 mL**        | −20 mL                | 59  | none                               |
| Alternative (pause removal, then 1 h of learner time)             | 2 h     | 0.480                  | 100 mL            | +40 mL                | 59  | none                               |
| Harmful (increase removal to 320 mL/h)                            | 2 h     | **0.872**              | 0 mL              | −600 mL               | 59  | `crrt11-critical-unsafe-candidate` |

### CRRT-11, matched at three hours

| Path                                      | Elapsed | Tolerance-stress index | Balance |
| ----------------------------------------- | ------- | ---------------------- | ------- |
| No intervention                           | 3 h     | 0.800                  | −480 mL |
| Intended corrective + 2 h of learner time | 3 h     | 0.360                  | −30 mL  |
| Harmful                                   | 3 h     | 0.968                  | −900 mL |

Step segmentation is exact: `+1 h ×3` reaches byte-identical state to a single `+3 h`.

### CRRT-13, matched at thirty minutes (the authored worsening point)

| Path                                               | Access pressure | Active fault       | Active alarm       | Delivered dose | Downtime   | Critical errors                            |
| -------------------------------------------------- | --------------- | ------------------ | ------------------ | -------------- | ---------- | ------------------------------------------ |
| No intervention                                    | −139 mmHg       | access-obstruction | ACCESS_OBSTRUCTION | 22.14          | 0 min      | none                                       |
| Diagnostic only (inspect)                          | −139 mmHg       | access-obstruction | ACCESS_OBSTRUCTION | 22.14          | 0 min      | none                                       |
| Corrective (pause → reposition → resume → confirm) | **−25 mmHg**    | none               | none               | 22.14          | 0 min      | none                                       |
| Acknowledgement only                               | −139 mmHg       | access-obstruction | ACCESS_OBSTRUCTION | 22.14          | 0 min      | `…-acknowledgement-only`                   |
| Harmful (Qb 180 through the obstruction)           | **−211 mmHg**   | access-obstruction | ACCESS_OBSTRUCTION | 22.14          | 0 min      | `…-increase-bfr`, `…-acknowledgement-only` |
| Harmful then recovery                              | −40 mmHg        | none               | none               | 22.14          | 0 min      | `…-increase-bfr` retained                  |
| Corrective **with 10 min advanced while paused**   | −25 mmHg        | none               | none               | **16.61**      | **10 min** | none                                       |

The last row is the answer to the downtime question: the module already owns an explicit
time-advance workflow, and using it while delivery is paused produces real downtime and real lost
dose. No downtime was invented for the same-timestamp path.

### CRRT-05, matched at one and six hours

The split moves 900 of 1,200 mL/h before the filter. Comparing the two arms at the same clock,
**exactly two quantities differ** — `preReplacementFlowMlHour` 0 → 900 and
`postReplacementFlowMlHour` 1,200 → 300. Prescribed dose, delivered dose, cumulative effluent,
whole-patient balance, filtration fraction, all four measured pressures, TMP, the filter pressure
drop, every filter burden term and every solute pool are **bit-identical**, not merely close. The
order of the split and the hour does not matter.

### CRRT-15 / CRRT-16 at six hours

Byte-identical to each other on every engine quantity: filter pressure 70 → 70.3744 mmHg, filter
drop 14 → 14.3744 mmHg, TMP 52.5 → 52.6872 mmHg, fouling 0.00823, clot 0.00411, delivered dose
20.625 mL/kg/h, downtime 0. CRRT-16's repeated circuit losses exist only in prose.

### CRRT-17 / CRRT-18 at two hours

Byte-identical to each other and to CRRT-11's untouched fixture. Urine output stays 5 mL/h,
residual kidney clearance 0 mL/min, systemic ionized calcium 1.05 mmol/L, total calcium null.

### CRRT-04 untouched at six hours

Delivery goes idle → running through the scheduled event, downtime 3,600 s, delivered dose 0,
prescribed dose 0, balance +900 mL. Access, filter and return pressures all read 5 mmHg (the
authored reference pressures at zero flow); **the filter pressure drop reads −25 mmHg and TMP
reads 7 mmHg with nothing moving** — the exact reading F-14 reports.

### Conservation and ledger invariants

- The clock moves only through a learner `ADVANCE_TIME` or an action's own
  `simulation.advanceTimeSeconds`. Total elapsed equals the sum of the two in every run checked,
  and the new run review publishes that decomposition with a `reconciled` flag.
- Step segmentation: 3×1 h equals 1×3 h exactly, on CRRT-11 and CRRT-05.
- Fluid: whole-patient balance tracks machine removal plus the supplied external rates;
  `totalFluidOverloadMl` accumulates the same balance delta.
- Intravascular reserve is monotonically non-increasing — it is spent, never refilled. A path that
  still holds reserve never spent it; it did not recover any.

## 3. Per-case evidence and claim map

| Case    | Claim the case made                                                              | Evidence that exists                                                                                                                                                                                  | Verdict                                                                                                               |
| ------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| CRRT-04 | "Complete prime and prescription review" (a case card)                           | The machine facsimile's `primeState` and `completedStepIds`                                                                                                                                           | **FIXED** — the card now confirms the machine's record and is refused without it                                      |
| CRRT-04 | "Start after review"                                                             | The facsimile's `canStartPrismaxTreatment` interlock                                                                                                                                                  | **FIXED** — an authored start effect can no longer bypass it                                                          |
| CRRT-05 | "Identify the dilution and filter-concentration tradeoffs"                       | Flow split only; FF is a fixed model coefficient and filter-inlet fraction is constant                                                                                                                | **MODEL NOT IMPLEMENTED**, now stated in the task                                                                     |
| CRRT-11 | Harmful and safe removal "end the same way"                                      | Tolerance-stress index, reserve, whole-patient balance; MAP is held                                                                                                                                   | **FIXED** (reporting) / MAP response **MODEL NOT IMPLEMENTED**                                                        |
| CRRT-13 | Correct and harmful paths indistinguishable                                      | Access pressure, fault, alarm, two authored critical errors                                                                                                                                           | **FIXED** (reporting); zero downtime is **correct accounting**                                                        |
| CRRT-15 | Rising filter pressure trend                                                     | +0.3744 mmHg over 6 h                                                                                                                                                                                 | **CONTAINED** (pre-existing hold), now stated in the task                                                             |
| CRRT-16 | "Several CRRT circuits have failed prematurely"                                  | Prose only; the run is CRRT-15                                                                                                                                                                        | **CONTAINED** — history/plan/run now separated in the task                                                            |
| CRRT-17 | "Linked calcium, acid-base, circuit and treatment-delivery trends"               | **One** systemic ionized calcium, 1.05 mmol/L, at case start; total calcium **not supplied**; no circuit-sample field exists; the linked-direction state is hard-wired `unknown` and rendered nowhere | **FIXED** (false claim removed, real evidence rendered with identity) / interpretation **OWNER/SOURCE HOLD (O-05)**   |
| CRRT-18 | "Several recovery signals are improving"                                         | One creatinine marker 2.9 mg/dL, urine output 5 mL/h constant, residual clearance 0                                                                                                                   | **FIXED** (false claim removed) / recovery model **MODEL NOT IMPLEMENTED**                                            |
| F-14    | Blood flow 120 mL/min shown while paused; drop −25 mmHg, TMP 7 mmHg with no flow | Set vs actual flow is derivable from the engine's own gate                                                                                                                                            | **FIXED** (set/actual split, validity rule) / the −18 / −25 placement stays **OWNER/SOURCE HOLD (G01-CRRT-02, O-04)** |

### CRRT-17 in detail

`initialPatient.solutes` for CRRT-17 carries `systemicIonizedCalciumMmolPerL: 1.05` and
`totalCalciumMgPerDl: null`, sourced to `SYNTH-CRRT-17` (synthetic teaching calibration, review
status PENDING). There is no post-filter or circuit calcium field anywhere in
`configuredPatientSchema`, so the sample that would describe circuit anticoagulant effect cannot
be represented at all. `ConceptualCitrateState.linkedTrendDirections` exists in
`engine/types.ts`, is initialised to `unknown` for all four fields in `engine/initialState.ts`,
is never written by any reducer or event, and is imported by no component — so the "conceptual
dashboard" the case promised does not exist in any form.

What does exist, and is now pointed at from the task: the four-pattern citrate differential and
the sampling-domain teaching in `content/citrateDifferential.ts`, source-backed through
`CITRATE-SIAARTI-2023-SAMPLING`, `CITRATE-SIAARTI-2023-MECHANISM` and `REVIEW-CKRT-CORE-2025`,
already mounted in the `crrt-anticoagulation` Learn lesson.

No serial calcium, no total/ionized ratio, no citrate dose, no calcium infusion requirement and
no toxicity threshold was manufactured.

### CRRT-18 in detail

`creatinineMgPerDl: 2.9`, `urineOutputMlPerHour: 5`, `residualRenalClearanceMlPerMin: 0`, one
time point, sourced to `SYNTH-CRRT-18`. Urine output is a constant external rate in the fluid
ledger; residual clearance is a fixed solute-model input. Neither changes during a run, and the
engine has no model of returning kidney function. The repeated CRRT-11 seed was **not** relabelled
as a different patient's longitudinal observation, and no urine-output, creatinine or clearance
trend was generated. The case now teaches the supported objective — keeping the clinical
discontinuation decision separate from the machine stop/end workflow — and names the evidence the
decision would need.

## 4. Baseline reproductions

Run in `/private/tmp/crrt-fellow-02-base` (detached at the base SHA, `node_modules` symlinked from
this worktree). The probe file is kept out of Git; its content is reproduced in
`src/features/baxter-crrt/engine/__tests__/setupWorkflow.test.ts` and
`.../matchedTimeCausality.test.ts` as the post-repair contracts.

| Reproduced on the unchanged base                                                                                                         | Result                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| A case declaration is recorded as prime and review the machine never performed (`primeState: 'not-started'`, `completedStepIds: []`)     | **reproduced** → now refused                                             |
| A case card starts delivery with no machine setup step completed, no prime and no committed prescription                                 | **reproduced** → now refused                                             |
| A case card silently diverges from the prescription committed on the machine (machine 150 mL/min, engine 120 mL/min, nothing reports it) | **reproduced** → the card still applies, and the divergence is now named |
| The two calculated pressures are reported `live-model-value` at −25 mmHg and 7 mmHg with no blood moving                                 | **reproduced** → now carry an explicit validity state                    |
| CRRT-11's safe arm reaches 3 h while no-action and harmful reach 2 h                                                                     | **reproduced, and deliberately unchanged** (see §5 B)                    |
| CRRT-05 outputs are identical after the split                                                                                            | **reproduced, and deliberately unchanged**                               |
| CRRT-15 and CRRT-16 run identically at 6 h                                                                                               | **reproduced, and deliberately unchanged**                               |
| CRRT-18's copy says "Several recovery signals are improving"; CRRT-17's says "Linked calcium … trends"                                   | **reproduced** → removed                                                 |

Ten of the fifteen assertions in `matchedTimeCausality.test.ts` pass on the unchanged base by
design: they characterise engine behaviour this batch did not change, and they are the controls
for the five that exercise the new reporting. The five that fail on base fail because the new
selectors do not exist there — they are new-surface tests, not baseline reproductions, and the
behavioural reproductions in the table above are what stands in for them.

## 5. Repairs, with the mechanism chosen

### B. CRRT-11 — the matched-time defect

**Traced.** `crrt11-action-safe-candidate` and `crrt11-action-alternative-candidate` each carry
`latencySeconds: 3_600` **and** an explicit `simulation.advanceTimeSeconds` effect of 3,600 s,
described in the action's own copy as the observation interval. The effect is applied exactly once
per performance, the timeline records it once, and the unsafe action carries `latencySeconds: 0`
and no time effect at all.

**Verdict: an authored and supported latency, not duplicated time advancement.** Removing it
would delete the authored observation interval the case is built on; applying an equal interval to
the unsafe arm would invent a latency the content does not have. Neither was done.

**What was wrong was the comparison, not the clock.** Nothing told the learner that the safe
action consumed an hour, so two arms at different clocks looked comparable.

Repaired:

- Every action card that carries an observation interval now says so before it is performed
  ("Performing this advances the simulated clock by 1 hr — its authored observation interval"),
  computed from the action's own effects, never from the unread `latencySeconds`.
- The debrief adds **"Where this run's simulated time came from"**: total elapsed, the part the
  learner advanced, the part the performed case actions carried, and the actions that carried it.
  `CrrtRunTimeAccounting.reconciled` is a conservation check on that split.
- The debrief adds **"Bounded model indices this run advanced"** — the tolerance-stress index and
  the intravascular reserve, each with a statement of what it is and is not — and **"Patient
  signals this exercise holds at the supplied value"** — MAP, heart rate and vasopressor index,
  with the explicit sentence that this exercise models no blood-pressure or vasopressor response,
  so an unchanged number is not evidence that a change was tolerated.

**MAP stays static and is now said to be static.** No MAP, pressor, arrhythmia or perfusion
coefficient was added.

### C. CRRT-13 — same-time correction and downtime truth

**Traced.** Only `crrt13-advance-to-pattern` carries a time effect (+30 min). `pause-treatment`,
`reposition-access`, `resume-treatment` and `confirm-restored-delivery` all carry
`latencySeconds: 0` and no time effect, so the corrective sequence lands on one timestamp.

**Verdict: no authored latency exists for the pause/reposition/resume sequence, so zero elapsed
downtime is legitimate.** No downtime was added.

Repaired: the debrief adds **"Pausing, elapsed time, and downtime"** — pauses and stops recorded,
resumptions recorded, downtime accumulated, and time delivery was running — plus, when a pause and
resume share a timestamp, the sentence that no downtime was charged because no simulated time
passed, and that advancing the clock while delivery is paused is how an interruption costs
anything. Batch 01's "Modeled cause at the end of this run" already separated cause corrected from
acknowledgement without correction, and is unchanged.

No pressure or dose consequence was invented.

### D. CRRT-05 — dilution comparison

**Classified as (3), the existing constant-model limitation**, on positive evidence rather than by
elimination:

- Not a wiring or state defect: CRRT-02's pre-filter source bag is still hung, delivery continues
  after the split (`deliveryState: 'running'`, delivered dose > 0, downtime 0).
- Not a rounded difference: the arms are compared field by field at matched clocks and every
  non-split quantity is **exactly equal**, not close. There is no small number being lost.
- `deliveredTherapy.filtrationFraction` is assigned straight from
  `scenario.modelConfiguration.filtrationFraction` in `engine/simulation.ts`; it is a fixed model
  coefficient fed into the filter progression, never calculated from the flows. The two real
  PrisMax FF expressions in `engine/clinicalMath.ts` are wired to nothing, and CONFLICT-002 blocks
  deriving the pre-infusion term they need.

Repaired by separating the three things in the task rather than after a reveal: what the
simulation calculates, what it does not model (with the reason), and the source-backed conceptual
teaching. No dilution penalty, FF equation, hemoconcentration threshold, pressure penalty or
filter-life effect was added.

### E. CRRT-15 / CRRT-16 — history vs current run vs plan

Repaired by exposing, in the task and before any reveal:

- the domain table (`FilterDomainTable`), which describes the current run and what the run can and
  cannot verify. Only the authored **team summary** stays behind "Explain this case";
- an evidence-scope block stating that the earlier failed circuits exist only in the case
  description, that every action in CRRT-16 carries no simulated effect, and that recognising,
  explaining, planning an exchange or escalating does not change the running circuit.

Recognition, explanation, planning and escalation were **not** converted into a performed filter
exchange, and no cure was simulated. CRRT-16's plan-only behaviour remains a model/source
limitation.

### F. CRRT-17 — citrate evidence

See §3. The one supplied systemic value is rendered with sample identity, time point, unit and
source record; total calcium renders as **Not supplied**, never as zero. The five absent items are
named with the reason each is absent. The interpretation exercise stays held.

### G. CRRT-18 — renal recovery evidence

See §3. The false improving-signals claim is removed from the patient description, the opening
finding, the learning objective, the goal, the safe action, the expected response, the
reassessment and the causal chain. The three supplied values render with identity, time and unit.

### H. CRRT-04 — authoritative setup workflow

New `engine/setupWorkflow.ts`:

- `selectCrrtPrescriptionRecord` reports one of `not-set`, `machine-reviewed-matches`,
  `changed-since-machine-review`, `not-reviewed-on-machine`, with the diverging fields and their
  two values. Rendered on the machine surface above the case-setting panel. The learner's committed
  machine entry is **never overwritten** — the divergence is named, and the statement says
  explicitly that only the prescription review is affected, while completed prime, connection and
  start are unchanged. No acceptance criterion for a prescription was invented.
- `selectCrrtMachineStartReadiness` restates `canStartPrismaxTreatment` and names what is missing.
  `crrtLearningSessionReducer` refuses an intervention whose effects would set delivery to
  `running` while the machine is not ready and not already delivering, recording the reason on the
  timeline. A resume after a pause is untouched, because it bypasses nothing.
- `assertsCompletedMachineSteps` is a new optional intervention field (schema-validated, mirroring
  the facsimile step ids). `crrt04-complete-prime-review` declares `['prime', 'review']` and is
  refused until the machine has recorded both. Its copy now says it records a confirmation and does
  not perform the steps.

Also: the case-setting cards label a flow-writing card as the case's **supplied example value**,
show the value currently in force for the same target, and show any observation interval they
carry. A genuinely completed machine step is still recorded exactly once — a repeated
`COMPLETE_SETUP_STEP` was already refused, and a test pins it. Viewing the case, reading an
explanation and declaring the goal complete no machine step (tested). Goal setting is already a
prerequisite of the guided prescription entry, and opening the lesson requires nothing.

### I. F-14 — prescribed Qb, actual flow, pressure validity

New `engine/circuitDelivery.ts`:

- `selectCrrtBloodFlowState` publishes the **setting**, the **actual** blood flow the circuit
  carries, and why they differ. `delivering` requires a running pump, both lumens connected **and**
  a setting above zero — because `engine/simulation.ts` feeds zero into the pressure model in every
  other case, including a pump nominally running against a zero setting, which is exactly CRRT-04
  at six hours. Actual flow is reported as `0`, a computed value, not as missing.
- `selectCrrtCalculatedPressureValidity` marks only the two PrisMax _calculated_ relationships
  (TMP, filter pressure drop) `no-flow-through-circuit` while the circuit carries no blood. The
  four measured sites stay `supported` always: with no flow they legitimately report the authored
  reference pressures, and that is a real static reading.

The rule is principled, not screenshot-shaped: with blood flow zero,
`calculateSyntheticBloodCircuitPressures` returns filter pressure **equal** to return pressure by
construction, so the raw drop is identically zero and the displayed drop is exactly the correction
term. The values are still shown; what is added is the statement that they carry no information
about the filter.

**The −18 mmHg TMP offset and the −25 mmHg filter-drop correction are unchanged**, still applied
exactly once, and still held under G01-CRRT-02 / O-04. Nothing was tuned to match a screenshot.
Paused delivery continues to follow the existing physics and accounting: external patient intake
and output keep contributing to the fluid ledger while circuit delivery is paused, and downtime
accrues only while the clock moves.

Surfaces updated: the live pressure profile (`Blood flow set` + `Blood flow through the circuit`,
per-signal validity reason, updated text equivalent), the facsimile pump strip (`BFR set` +
`BFR through circuit`) and pressure grid, and the debrief's run record.

### J. Batch-01 debrief truth

`__tests__/caseCausalityAndEvidence.test.tsx` re-covers the Batch-01 contract alongside the new
sections: the supplied teaching path stays labelled as the example, the actual timeline stays
separate, an unentered reassessment stays "Not recorded", `Run reviewed` stays absent, and an
explanation-only visit still reports "no run performed". Supplied case values stay under the
supplied heading and never appear under what happened in this run; a plan never appears as
performed treatment.

### K. Dead component cleanup

`components/CrrtResponsePanel.tsx` and `components/CrrtCalibrationPanel.tsx` were **removed**.
They are demonstrably in CRRT scope, imported by nothing (verified by a repository-wide search),
and both import `./crrt-learning-workflow.module.css`, which does not exist — so neither can build
if reintroduced. `CrrtResponsePanel` also rendered a live "Simulated solutes" card, the one
laboratory surface Batch 01 left uncontained because it was unreachable. Removing it closes that
latent hazard. No other dead-code sweep was attempted.

## 6. Tests

### New

| File                                                                     | Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/baxter-crrt/engine/__tests__/matchedTimeCausality.test.ts` | 15 — CRRT-11 matched at 2 h and 3 h, the unmatched clock, action-vs-learner time attribution, same-timestamp actions, step segmentation; CRRT-13 five paths at one clock, same-timestamp zero downtime, real downtime when the clock moves while paused, harmful history retained after recovery; CRRT-05 field-by-field equality and order independence; CRRT-15/16 equality, CRRT-16 plan-only, the CRRT-15 0.3744 mmHg trend                                         |
| `src/features/baxter-crrt/engine/__tests__/setupWorkflow.test.ts`        | 17 — the schema/facsimile step alignment, the refused declaration, the refused start, the accepted declaration, exactly-once machine steps, viewing and goal declaration completing nothing, the preserved learner prescription and named divergence, supplied-example labelling with the current value, the published observation interval, the untouched resume; set vs actual flow running/paused/stopped, the calculated-pressure validity rule and its restoration |
| `src/features/baxter-crrt/__tests__/caseCausalityAndEvidence.test.tsx`   | 14 — the evidence scope in the task for CRRT-05/11/16/17/18, absent-stays-absent, the removed false claims, the debrief's time accounting, the pre-performance interval warning, the interruption record, the model indices and held signals, and the Batch-01 debrief contract                                                                                                                                                                                         |
| `e2e/baxter-crrt-self-paced.spec.ts`                                     | +2 — the real CRRT-04 route refusing the declaration and reporting zero circuit flow; the real CRRT-11 route showing the scope block before any reveal and the full time/index/held-signal accounting, checked at 1440×900 and 390×844                                                                                                                                                                                                                                  |

### Updated existing assertions (intentional, contract changed)

- `__tests__/pilotCases.test.ts` — every accepted-path and unsafe-path run now walks the PrisMax
  facsimile setup first, through the new `engine/testSupport/machineWorkflow.ts` helper, because a
  case card can no longer prime, review, connect or start. Cases that already begin on Operations
  are returned unchanged by the helper.
- `engine/__tests__/sanityReview.test.ts` — the CRRT-04 six-hour removal-only trajectory now
  starts on the machine. The pinned arithmetic (sodium 138 → 111.316) is unchanged; only the route
  that starts the run changed.
- `__tests__/workedCaseExamples.test.tsx` — the CRRT-16 domain table is asserted before the reveal
  and the team summary after it.

### Commands run on this branch

```
npx --no-install jest src/features/baxter-crrt --runInBand              → 69 suites, 741 tests, pass
npx --no-install jest src/features/critical-care/progress \
    src/app/api/analytics src/app/sitemap.baxter-crrt.test.ts \
    src/features/module-beta 'src/app/[locale]/baxter-crrt'             → 12 suites, 200 tests, pass
NODE_OPTIONS=--max-old-space-size=8192 npm run type-check               → exit 0
npx --no-install eslint <26 changed files>                              → 0 errors, 0 warnings
npx --no-install prettier --check <26 changed files>                     → clean
npx --no-install playwright test -c playwright.baxter-crrt.config.ts    → see §8
NODE_OPTIONS=--max-old-space-size=8192 npm run build                    → see §8
git diff --check                                                        → clean
```

## 7. Classifications

### FIXED

- D-1 CRRT-04: a case declaration recorded as completed prime and review — refused against the
  machine's own record.
- D-2 CRRT-04: a case card starting delivery around `canStartPrismaxTreatment` — refused.
- D-3 CRRT-04: an unreported divergence between the prescription committed on the machine and the
  one the engine runs — named, with the learner's entry preserved and only the review invalidated.
- D-4 F-14: a blood-flow setting presented as delivered flow — set and actual are now separate
  published quantities.
- D-5 F-14: the two calculated device pressures reported as live with no blood moving — an explicit
  validity rule, keyed on actual flow, applied only to the calculated channels.
- D-6 F-02/X-05: a run's elapsed time not attributable to its source, so paths at different clocks
  looked comparable — the decomposition is published with a conservation check.
- D-7 F-02/X-05: the discriminating model indices and the held blood pressure both unreported — both
  now reported, with what each is and is not.
- D-8 F-04/F-16 CRRT-17: a case claiming linked calcium trends it does not carry — claim removed,
  the one supplied value rendered with sample identity, time, unit and source.
- D-9 F-16 CRRT-18: a case claiming improving recovery signals it does not carry — claim removed.
- D-10 F-05 CRRT-16: the domain table available only after "Explain this case" — now in the task.
- D-11 X-02: a flow-writing case card not labelled as the case's supplied example and not showing
  what it replaces — both labelled.
- D-12 K: two unreachable components importing a nonexistent CSS module, one of them an
  uncontained live-solute surface — removed.

### CONTAINED

- CRRT-16's recurrent filter loss: history in prose, a stable current run, plan-only actions. The
  separation is now explicit in the task; the phenomenon is still not simulated.
- CRRT-15's filter trend: +0.3744 mmHg over six hours, too small to localize from the number. Named
  in the task; the pressure-location exercise carries the teaching instead.
- CRRT-17's citrate interpretation: the one supplied systemic value and the source-backed sampling
  teaching are shown; the pattern the case describes cannot be shown.
- Every evolving solute pool stays contained exactly as Batch 01 left it. `engine/soluteModel.ts`,
  `engine/soluteValidity.ts`, `engine/patientModel.ts`, `engine/simulation.ts`,
  `content/phase7ReviewCases.ts`, `content/pilotCases.ts` and
  `content/runtimeCaseNormalization.ts` were **not modified**. No case gained a solution
  composition, a production or input term, a residual-clearance value, a nonzero source term used
  as a proxy for "modeled", or a solute success condition.

### MODEL NOT IMPLEMENTED

- Pre-filter dilution's effect on clearance, filter burden, filter pressure or TMP; a calculated
  filtration fraction (CRRT-05, F-03).
- Any haemodynamic, vasopressor, arrhythmia or perfusion response to fluid removal (CRRT-11, F-02,
  X-05).
- Citrate physiology, calcium kinetics, citrate accumulation and any pattern threshold (CRRT-17,
  F-04).
- Renal recovery: returning kidney function, rising urine output, falling creatinine, recovering
  clearance (CRRT-18, F-16).
- Recurrent filter loss, filter failure over time, anticoagulation effect (CRRT-16, F-05).
- Reviewed solution chemistry and clinical electrolyte/acid-base dynamics (F-01, unchanged from
  Batch 01).

### OWNER / SOURCE HOLD

- **O-01** — the solution/solute model decision and its seven inputs, unchanged from Batch 01 §3.
- **O-02** — what the tolerance cases should show, and what is explicitly a planning exercise. This
  batch supplies the equal-time comparison the packet asks for (§2) and added no coefficient.
- **O-03 / CONFLICT-001 / CONFLICT-002** — predilution and filtration-fraction expression.
  Untouched. The two PrisMax FF functions remain unwired.
- **O-04 / G01-CRRT-02** — where the PrisMax −25 mmHg correction applies, and what is valid when
  paused. The values are unchanged. This batch answers only the _validity_ half, from the model's
  own arithmetic, and explicitly does not adjudicate the placement.
- **O-05** — minimum evidence for the citrate safety and renal recovery cases. Both cases now state
  what they lack; neither has the evidence.
- **O-06** — whether recurrent filter loss becomes a real simulated intervention.
- **O-09** — device alarm mapping. Recorded, not changed: CRRT-13's "Acknowledge the generic
  training alert" action carries no effects, so the engine alarm's `acknowledgedAtSeconds` is never
  set and the alert stays unacknowledged in engine state while the case's critical error fires.
  That is the teaching point as authored, but whether the facsimile should mark the alarm
  acknowledged is a device-behaviour question for O-09.

### DEFERRED

- **Batch 03** — F-09 (Help and the case picker inside the collapsed drawer), F-22's inert role
  control, F-11/F-12 layout, the 200% activity-header truncation, and the workbench redesign. The
  new scope and accounting blocks were built to the existing chrome and add no new sticky element.
- **Batch 04** — F-19 and F-24 terminology. New copy avoids internal codes; `assertsCompletedMachineSteps`
  never reaches a learner surface, and the refusal message names the machine step's own label.
- **Prompt 05** — O-01 through O-10, including the CRRT-16 filter-loss storyboard and the CRRT-17 /
  CRRT-18 evidence storyboards this batch shows to be necessary.
- **Newly recorded for a later batch (not repaired here):**
  1. `latencySeconds` is authored on every intervention and read by nothing. CRRT-16's safe action
     carries `latencySeconds: 3_600` with no time effect, because `removeInheritedTemplatePhysiology`
     stripped the inherited `simulation.advanceTimeSeconds` along with the physiology. Restoring it
     would change what the learner observes, so it was left alone and recorded. Either wire the
     field or remove it — a content/owner decision.
  2. `ConceptualCitrateState.linkedTrendDirections` is dead state: always `unknown`, never written,
     never rendered. Removing or implementing it is an O-05 decision.
  3. CRRT-17 and CRRT-18 remain byte-identical to CRRT-11's fixture, and CRRT-16 to CRRT-15's.
     Repeated seeds are not a defect on their own (F-16's implementation decision), and each case
     now states what it can show; giving them their own patients is an O-10 content decision.

## 8. Validation

| Check                                                                                                                             | Result                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `npx --no-install jest src/features/baxter-crrt --runInBand`                                                                      | **69 suites / 741 tests passed**                                                                                           |
| Shared consumers: `critical-care/progress`, `app/api/analytics`, `sitemap.baxter-crrt`, `module-beta`, `app/[locale]/baxter-crrt` | **12 suites / 200 tests passed**                                                                                           |
| `npm run type-check` (8 GB heap)                                                                                                  | **passed**                                                                                                                 |
| Changed-file ESLint (26 files)                                                                                                    | **0 errors, 0 warnings** (3 CSS files reported as "no matching configuration", which is the repository's own ESLint scope) |
| Changed-file Prettier `--check`                                                                                                   | **clean**                                                                                                                  |
| `git diff --check`                                                                                                                | **clean**                                                                                                                  |
| CRRT Playwright, **dev** server on 3113                                                                                           | 18 existing passed (2.0 min); the two new specs then passed individually                                                   |
| `npm run build` (8 GB heap, synthetic preview env)                                                                                | **passed**, including training-app generation, content generation, asset validation and standalone packaging               |
| CRRT Playwright, **production** build on 3134                                                                                     | **20 / 20 passed** (55.3 s) — the 18 existing plus both new specs                                                          |

The dev server on 3113 was stopped before the production build. No other worktree's process was
touched, and `.claude/launch.json` was not modified; the temporary production Playwright config was
removed after the run.

### Production-build browser journeys (Chromium, isolated pane, `node .next/standalone/server.js` on 3134)

| Viewport                                                    | Checked                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1440 × 900                                                  | CRRT-04: the declaration card says it records rather than performs, the start card stays disabled behind it, page horizontal overflow 0                                                                                                                                                                                                                                        |
| 1280 × 900                                                  | CRRT-17 evidence scope: heading, the 1.05 mmol/L systemic value with its sample identity and time, `Not supplied` for total calcium, the `SYNTH-CRRT-17` source line; section and both grids inside the viewport, 0 clipped children, 0 horizontal overflow                                                                                                                    |
| 1280 × 900, **200% root text** (`html { font-size: 32px }`) | All four new debrief blocks inside the viewport, 0 clipped children, 0 vertically clipped children, 0 horizontal overflow                                                                                                                                                                                                                                                      |
| 1024 × 768                                                  | CRRT-13 paused on the machine surface: `BFR set 120 mL/min` beside `BFR through circuit 0 mL/min`; TMP 7 mmHg and filter drop −25 mmHg both labelled "Calculated relationship · not interpretable without blood flow" with their values still shown; the four measured sites still "Directly modelled site"; the prescription-record note present; 0 horizontal overflow       |
| 390 × 844                                                   | CRRT-11 debrief: all five sections ("Where this run's simulated time came from", "Pausing, elapsed time, and downtime", "What this run recorded", "Bounded model indices this run advanced", "Patient signals this exercise holds at the supplied value") inside 390 px with 0 clipped children; the actual-evidence section itself inside the viewport; 0 horizontal overflow |
| 320 × 740                                                   | CRRT-17 evidence scope: section, supplied grid and the two-up block all inside 320 px, 0 clipped children, 0 horizontal overflow                                                                                                                                                                                                                                               |

### Keyboard

Forward Tab and reverse Shift+Tab across the case surface at 1024 × 768 on the production build:
every stop matched `:focus-visible` with a 3 px solid outline and stayed in the viewport. The new
evidence-scope block contains **zero** focusable elements, so it changes no focus order and cannot
trap focus; the new debrief blocks are likewise static text inside the existing region. No new
interactive control, popover or Help surface was added by this batch.

## 9. NOT RUN

- No screen reader and no real assistive technology. No native browser zoom (the 200% check set the
  root font size; that is not the same thing). No other engine — Firefox and WebKit were not run.
  No real phone, no touch hardware. No `es` / `zh-CN` locale pass.
- No real learner or operator session. The walkthrough remains AI-assisted persona feedback and
  does not satisfy owner task 5.
- No clinical, device, source, alarm or dosing claim was verified, added or changed. No KDIGO
  document, no manufacturer manual page and no institutional protocol was read for this batch.
- The six additional cases the walkthrough did not visit were not individually walked here either.
  The 20-case Playwright sweep covers every route, which is route coverage, not clinical review.
- The predilution/filtration-fraction expressions in `engine/clinicalMath.ts` were read but not
  wired, tested against a device, or adjudicated.

## 10. Remaining dependencies

### For batch 03 (workbench and wayfinding)

- F-09, F-11, F-12, F-13, F-22's inert role control and the 200% activity-header truncation are
  untouched and still open. The new blocks were built inside the existing chrome and add no sticky
  element, no new region landmark beyond the labelled evidence section, and no new focus stop.
- The machine surface now carries one more note (the prescription record) above the case-setting
  panel; any workbench re-layout should keep it adjacent to the cards it qualifies.

### For batch 04 (teaching and units)

- The new copy is learner-facing and avoids internal codes. `assertsCompletedMachineSteps` is never
  rendered; the refusal message names the facsimile step's own label ("Prime", "Review").
- The three deferred items in §7 (`latencySeconds` unread, the dead conceptual citrate state, the
  shared fixtures) are terminology-adjacent and belong in a content pass, not a runtime one.

### For prompt 05 (clinical / device / source decisions)

- **O-01** unchanged from Batch 01 §3.
- **O-02** — this batch supplies the equal-time comparison the packet asked for. The decision that
  remains is whether CRRT-11 should stay a planning exercise over bounded indices or acquire a
  reviewed response model.
- **O-03 / CONFLICT-001 / CONFLICT-002** — CRRT-05 now shows precisely what is missing: a
  filtration fraction calculated from the flows, and a filter-inlet concentration that responds to
  predilution. Two implemented-but-unwired PrisMax expressions are waiting on the pre-infusion term.
- **O-04 / G01-CRRT-02** — the validity half is answered from the model's own arithmetic; the
  placement of the −18 and −25 corrections is not.
- **O-05** — CRRT-17 and CRRT-18 each now state exactly which evidence a decision would need and
  which of it exists. That is the minimal-evidence question, ready to be answered.
- **O-06** — CRRT-16's plan-only behaviour is now explicit to the learner, which makes the
  storyboard decision concrete rather than abstract.
- **O-09** — the CRRT-13 alarm-acknowledgement observation recorded in §7.
- **O-10** — whether CRRT-16, CRRT-17 and CRRT-18 should get their own patients.

### For batch 06 (combined acceptance)

- The matched-time matrix in §2 and the baseline reproductions in §4 are the evidence to re-check.
- `engine/testSupport/machineWorkflow.ts` is the only supported way to start a CRRT-04 run in a
  test; a review that reaches past it is reaching past the interlock this batch protects.

## 11. Files changed

Added: `src/features/baxter-crrt/engine/circuitDelivery.ts`,
`src/features/baxter-crrt/engine/setupWorkflow.ts`,
`src/features/baxter-crrt/engine/testSupport/machineWorkflow.ts`,
`src/features/baxter-crrt/content/caseEvidenceScope.ts`,
`src/features/baxter-crrt/caseEvidence.ts`,
`src/features/baxter-crrt/components/CrrtCaseEvidenceScope.tsx`,
`src/features/baxter-crrt/components/crrt-case-evidence-scope.module.css`,
`src/features/baxter-crrt/engine/__tests__/matchedTimeCausality.test.ts`,
`src/features/baxter-crrt/engine/__tests__/setupWorkflow.test.ts`,
`src/features/baxter-crrt/__tests__/caseCausalityAndEvidence.test.tsx`,
and this handoff.

Modified: `src/features/baxter-crrt/actualRunReview.ts`,
`src/features/baxter-crrt/engine/{consoleControls,learningSession}.ts`,
`src/features/baxter-crrt/engine/deviceAdapters/prismax.ts`,
`src/features/baxter-crrt/content/{completeCases,pilotCases,schema}.ts`,
`src/features/baxter-crrt/components/{CrrtCasePlayer,CrrtLivePressureDevice,CrrtWorkedCaseExample,PrismaxPilotInterface}.tsx`,
`src/features/baxter-crrt/components/{crrt-case-player,prismax-pilot-interface}.module.css`,
`e2e/baxter-crrt-self-paced.spec.ts`, and the three existing test files listed in §6.

Removed: `src/features/baxter-crrt/components/CrrtResponsePanel.tsx`,
`src/features/baxter-crrt/components/CrrtCalibrationPanel.tsx`.

**Not modified:** `engine/soluteModel.ts`, `engine/soluteValidity.ts`, `engine/patientModel.ts`,
`engine/simulation.ts`, `engine/reducer.ts`, `engine/pressureModel.ts`, `engine/clinicalMath.ts`,
`engine/filterModel.ts`, `engine/fluidModel.ts`, `content/phase7ReviewCases.ts`,
`content/runtimeCaseNormalization.ts`, `content/phase7ReviewSources.ts`, `engine/progress.ts`,
`.claude/launch.json`. No raw fixture value, source record, review status, saved history or
clinical coefficient was altered.
