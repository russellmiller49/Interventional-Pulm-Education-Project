# CRRT-FELLOW-01 — trustworthy output, debrief and case identity

**Status:** implementation complete for the assigned findings; one bounded PR, not merged.
**Assigned:** F-01 (containment), F-02 (safety/debrief truth), F-08 (case routing),
F-18 (actual timeline), F-22 / X-08 (role-switch state loss).
**Not started here:** the workbench and teaching rewrite batches (03/04) and the F-03/F-05
clinical-model extensions (02/05).

## 1. Execution context

| Item                         | Value                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Repository                   | `russellmiller49/Interventional-Pulm-Education-Project`                                                    |
| Worktree                     | `Interventional-Pulm-Education-Worktrees/claude-crrt-9-21`                                                 |
| Branch                       | `claude/crrt-fellow-01` (from `claude/crrt-9-21`, which equalled `origin/main`)                            |
| Base SHA                     | `c717c9ffae09cb67e19b06a56d37c75487a5605a` (merge of PR #250; `origin/main` at fetch)                      |
| Planner's inspected snapshot | `bf738aa4b04facdca3638468f067cdaa5c24a5d0` — reconciled, not rolled back                                   |
| Content version              | `1.1.0-sme-review.1`; engine `1.0.0`                                                                       |
| Dev server                   | `next dev --port 3129 --webpack` (original run only; convenience entry omitted during main reconciliation) |
| Playwright server            | `playwright.baxter-crrt.config.ts` own dev server on 3113                                                  |
| Production server            | `node server.js` on 3131 from the real `npm run build` output                                              |
| Browser                      | Claude in-app Chromium, isolated profile, synthetic local storage only                                     |
| Viewports exercised          | 1280×900, 1440×900 (Playwright default), 390×844, 375×812, 200% root text at 1280×900                      |

The Baxter CRRT module is draft / unlisted; every route stays `noindex`. No access, publication,
review status, reviewer, date or signoff was changed by this batch.

## 2. Reproduction before the change

All numbers below come from the real engine at the base SHA, via a temporary probe that loaded
each runtime case through `getBaxterCrrtCase` → `createCrrtLearningSession` → `ADVANCE_TIME`.
The probe was removed; the surviving equivalent assertions live in
`src/features/baxter-crrt/engine/__tests__/soluteValidity.test.ts`.

### F-01 — every solute decays toward zero

| Case    | Elapsed                | Sodium mmol/L     | Bicarbonate mmol/L | Potassium mmol/L |
| ------- | ---------------------- | ----------------- | ------------------ | ---------------- |
| CRRT-02 | start → 2 h, no action | 136.000 → 129.691 | 10.000 → 9.512     | 6.900 → 6.563    |
| CRRT-15 | start → 8 h, no action | 138.000 → 100.862 | 20.000 → 14.378    | 4.900 → 3.523    |
| CRRT-04 | start → 6 h, no action | 138.000 → 138.000 | 16.000 → 16.000    | 5.800 → 5.800    |

CRRT-15 reproduces the walkthrough's figures (137.6 → 100.9, 19.9 → 14.4, 4.9 → 3.5) almost
exactly. CRRT-04 is static with no action because its prescription starts unconfigured and the
case only reaches `running` through the scheduled event, recording 3600 s of downtime and a
delivered dose of 0; the report's CRRT-04 fall (137.5 → 111.3) follows the prescribe-and-start
path, not the untouched fixture. The walkthrough's CRRT-02 figures likewise follow the
recommended actions. **An identical reproduction of the direction and magnitude is established;
the exact endpoint depends on the path, which the report did not state.**

Provenance of the starting values: `definition.initialPatient.solutes`, sourced to
`SYNTH-CRRT-nn`, a _synthetic teaching calibration_ record
(`content/phase7ReviewSources.ts`: "Every exact patient value … is synthetic teaching
calibration … Not a clinical target, normal range, alarm threshold, device limit, or
patient-specific recommendation", review status PENDING, reviewer null).

### Why the trajectory is unsupported, in the code

`engine/soluteModel.ts` holds a generic constant-volume mass balance with production, external
input, residual clearance and delivered clearance terms. It is mathematically correct. The
fixture is incomplete in two separate ways:

1. Every pool in every runtime case seeds `productionAmountPerHour = 0`,
   `inputAmountPerHour = 0`, `residualClearanceMlPerMin = 0`
   (`content/phase7ReviewCases.ts` `soluteModel()` — 40 L; `content/pilotCases.ts` — 42 L).
2. **No case can declare a solution composition at all.** `BagState`
   (`engine/types.ts`) and `engineBagSchema` (`content/engineFixtureBoundary.ts`) carry
   identity, flow term, volumes and connection only. `collectCrrtCaseSemanticIssues`
   (`content/schema.ts`) explicitly rejects any case that carries `solutionProfileIds`:
   _"Solution profiles cannot be normalized before a reviewed solution registry exists."_

With no solution term and every source term zero, the only surviving term is delivered
clearance, so the analytic solution decays every pool toward zero. That is removal-only
arithmetic — not a wrong equation, and not a modeled patient response.

### Selected solution IDs, production/input, volumes, residual clearance, delivery

| Case    | Active source bags                           | Vd (L) | Production | Input | Residual clearance | Delivery at t=0 | Filter-inlet fraction / FF |
| ------- | -------------------------------------------- | ------ | ---------- | ----- | ------------------ | --------------- | -------------------------- |
| CRRT-02 | dialysate                                    | 40     | 0          | 0     | 0 mL/min           | running         | 1 / 0.10                   |
| CRRT-04 | dialysate                                    | 42     | 0          | 0     | 0 mL/min           | idle            | 1 / 0.10                   |
| CRRT-15 | dialysate, pre-replacement, post-replacement | 40     | 0          | 0     | 0 mL/min           | running         | 1 / 0.20                   |

Bags carry no composition field, so the "solution ID" is a flow-term label, not a product.

### F-02 — matched-time safe / harmful / no-action comparison

CRRT-11, identical fixture and seed, debrief revealed at the end:

| Path                                 | Elapsed | MAP | Stress index | Delivered dose | Whole-patient balance | Critical errors                    |
| ------------------------------------ | ------- | --- | ------------ | -------------- | --------------------- | ---------------------------------- |
| No action                            | 2 h     | 59  | 0.760        | 18.82          | −320 mL               | none                               |
| Safe (assess → reduce → communicate) | 3 h     | 59  | 0.360        | 16.62          | −30 mL                | none                               |
| Harmful (increase removal)           | 2 h     | 59  | 0.872        | 20.88          | −600 mL               | `crrt11-critical-unsafe-candidate` |

MAP is identical on all three paths, as reported — `engine/patientModel.ts` advances reserve,
fluid overload and an abstract stress index, and holds MAP at its supplied baseline. The model
_does_ separate the paths through the stress index and the fluid balance; the base debrief showed
neither. Note the safe path is **not** time-matched to the others: `crrt11-action-safe-candidate`
carries its own `simulation.advanceTimeSeconds` effect, so the safe arm reaches 3 h while the
others reach 2 h. That is recorded here for batch 02's matched-time work; nothing was changed.

CRRT-13, identical fixture, debrief revealed:

| Path                                                    | Delivered dose | Balance   | Downtime | Access pressure | Active faults        | Critical errors                                                        |
| ------------------------------------------------------- | -------------- | --------- | -------- | --------------- | -------------------- | ---------------------------------------------------------------------- |
| Safe (inspect → pause → reposition → resume → confirm)  | 22.14          | +187.5 mL | 0 min    | −25 mmHg        | none                 | none                                                                   |
| Harmful (increase BFR → acknowledge → declare resolved) | 22.14          | +187.5 mL | 0 min    | **−211 mmHg**   | `access-obstruction` | `crrt13-critical-increase-bfr`, `crrt13-critical-acknowledgement-only` |

Delivered dose and balance are identical, as reported. The engine is **not** silent about the
harmful path: access pressure differs by 186 mmHg, the fault stays active, the
`ACCESS_OBSTRUCTION` alert stays active after acknowledgement, and two authored critical errors
trigger. None of that reached the learner. Both paths record 0 min downtime because every
correct-path action lands on the same timestamp; that remains a batch-02 causality question and
was **not** papered over with invented downtime.

### F-08 / F-22 / X-08 — route and role

Reproduced independently of the report, in jsdom and in the real route.

- Rendering `BaxterCrrtPractice` with `initialCaseId="CRRT-01"` and then re-rendering with
  `"CRRT-02"` (exactly what the route adapter does on a query change) left the heading, the case
  picker and all case data on CRRT-01. `selectedCaseId` was `useState(firstCaseId)`, initialized
  once. Meanwhile the visit effect depended on `initialCaseId`, so it recorded a visit for the
  case that was _not_ shown, which is why the footer then recommended CRRT-04.
- `chooseCase` never touched the URL, so an additional case left the address bar on the previous
  case and could not be linked or shared.
- Switching the role lens from Integrated to Operator after one performed action and `+1 hr`
  reset the clock to 0 min and cleared the performed action. Cause: the `LOAD_CASE` effect
  listed `roleLens` in its dependency array, and `CrrtCasePlayer`'s `playerKey` included
  `session.roleLens`, remounting the player. `BaxterCrrtAssess` carried the identical defect.
- `readAllowlistedCrrtMetric(state, 'patient.solutes.sodium.concentrationPerLiter')` returned
  `136` at base — a removal-only pool was reachable as a scored success-condition metric. No
  authored case used it, but nothing prevented one.

## 3. Outcome for F-01: **CONTAINED, not a clinically validated model**

No proven unit, wiring or configuration error was found. The conversion in
`content/runtimeCaseNormalization.ts` (authored mg/dL × 10 → internal mg/L) is arithmetically
correct and is paired with the right `concentrationUnit`. The equation is generic and correct.
The missing inputs are clinical data that does not exist anywhere in the repository, so no
quantitative repair was available and none was invented. **The engine arithmetic is unchanged**
— `engine/soluteModel.ts` was not touched, and a regression pins the CRRT-15 8-hour values so a
future change to it is deliberate.

What changed is output validity and presentation.

### New: `engine/soluteValidity.ts`

**Corrected by the independent pre-merge review:** the first implementation inferred missing
source terms from numeric zero. That was not a valid suppliedness test. The current boundary
reports `status: 'unsupported'` for every present pool, with missing specifications
`solution-concentration` and `reviewed-source-term-specification`.

The strict fixture schema and engine pool have generic source IDs and review status, but no
per-term provenance distinguishing a placeholder from an explicitly specified zero. No bag
composition field or solution registry is implemented. Neither nonzero source terms nor an
extra unvalidated bag field can lift containment. A future reviewed model must deliberately
implement that contract and its tests. Numeric zero remains a real numeric value in the generic
mass-balance equation; no clinical source term is invented or changed here.

See `CRRT-FELLOW-01-sanity-review.md` for independent reproduction and validation evidence.

### Every affected laboratory surface

| #   | Surface                                                                                            | Was                                                                    | Now                                                                                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `CrrtCasePlayer` debrief "Sampled pressure, dose, fluid, **and laboratory** evidence" table        | Seven solute rows, first vs latest, labeled `sodium`, `bicarbonate`, … | Solute rows removed; heading is "Sampled pressure, dose, and fluid evidence". A new **"Laboratory values in this case"** section shows the supplied case-start values with their authored units, then names each unmodeled solute and the inputs the simulator lacks, then states what the case still teaches                               |
| 2   | `CrrtActivityWorkspace` patient strip, "Relevant labs"                                             | Live evolving K / HCO₃ from the decaying pool, plus pH                 | "Supplied labs at case start" — the authored K, HCO₃ and pH, with "not modeled over time"                                                                                                                                                                                                                                                   |
| 3   | `CrrtWorkedCaseExample` run comparison, `urea-marker` signal ("Small-solute marker", CRRT-05 only) | Value shown with no validity statement                                 | Unchanged value, plus an explicit caption that it is a model pool advanced by delivered clearance alone and not a measured laboratory value                                                                                                                                                                                                 |
| 4   | `engine/outcomes.ts` `readAllowlistedCrrtMetric` solute path                                       | Returned the live concentration; a success condition could score it    | Throws an explicit unsupported-solute error for every recognized `patient.solutes.*.concentrationPerLiter` path, including calls bypassing content validation. Supported delivery, pressure, fluid and patient metrics are untouched                                                                                                        |
| 5   | `content/schema.ts` `collectCrrtCaseSemanticIssues`                                                | Accepted a solute-concentration success metric                         | Raises "scores an unmodeled solute concentration", so no authored case can depend on a silently-false condition                                                                                                                                                                                                                             |
| 6   | `engine/simulation.ts` `TrendSample.soluteConcentrationsPerLiter`                                  | Published and rendered                                                 | Field retained as engine state — the model's own quantity, used by the step-equivalence invariants — but no learner surface renders it. Containment sits at the presentation and verdict boundaries, not by deleting typed engine state                                                                                                     |
| 7   | `components/CrrtResponsePanel.tsx` "Simulated solutes" K / HCO₃ card                               | Live evolving values                                                   | **Left unchanged and not mounted.** It is dead code: nothing imports it, and it imports `./crrt-learning-workflow.module.css`, which does not exist, so it cannot build if reintroduced. `CrrtCalibrationPanel.tsx` has the same broken import and is equally unreferenced. Flagged, not touched — deleting dead code is outside this batch |

### What stayed numerically supported

Prescribed and delivered effluent dose, downtime and treatment time, the fluid ledger
(effluent, machine removal, whole-patient balance, missing-urine semantics), filtration
fraction, the four measured circuit pressures and the two calculated ones, filter fouling and
clot burden, and the abstract reserve / stress index. All of these are calculated from settings
the learner enters and from authored model coefficients with their own source IDs; they are
separately labeled and none of them were suppressed.

### State vocabulary kept distinct

`unsupported` (dynamic output without an implemented reviewed specification) · `Not supplied` (no authored value) ·
`Not recorded` (the learner did not enter it) · `None recorded for this action` (the action
changes no parameter) · `0 min` / `0 mL` (a recorded or computed zero) · unchanged because delivery is
paused (the engine's own state, untouched). After the independent review correction, no zero is used as a missing value, no sodium or
bicarbonate is hard-coded, no dialysate composition is inferred, and no pH calculation was added
— pH remains the authored supplied value and is labeled as such.

### Source / input decisions required for a quantitative replacement (for prompt 05, O-01)

1. The identity and exact composition of each dialysate, replacement, PBP and syringe solution
   used by each case, with the manufacturer or formulary record and revision, per solute.
2. Which flow location each solution enters (pre-blood-pump, pre-filter, post-filter, dialysate
   counter-current) and how the model should express dilution — this is entangled with
   CONFLICT-001/002 and O-03 and must not be settled by this batch.
3. Endogenous production or tissue-release rates for the urea and creatinine markers, with the
   population and the assumption stated; and whether the markers stay markers or become BUN and
   creatinine (which would be a new clinical claim, not a relabeling).
4. Residual kidney clearance per case, distinct from the authored urine output already present.
5. Distribution volume per solute rather than one 40–42 L compartment for all seven.
6. Which acid-base output, if any, is in scope. Bicarbonate mass balance alone is not pH, and no
   pH model may be added without an explicit decision.
7. The conservation and endpoint tests each case must pass before its trajectory is shown again,
   and which signals stay suppressed even after the model lands.

Until those exist, the correct description remains **CONTAINED**. A case whose defining
laboratory phenotype is still absent (CRRT-02's "potassium should fall, bicarbonate should rise")
is **not repaired** by better caveat wording; it now tells the truth about what it cannot show.

## 4. Actual-versus-worked projection (F-02, F-18)

New `actualRunReview.ts` builds the honest record of one current session; nothing in it is
derived from the authored worked narrative, and nothing is persisted or scored.

The debrief now renders, in order:

1. **Status** — `Debrief opened · N recorded events in this run`, or
   `Debrief opened · no run performed`, with the line _"This lists what this session recorded.
   It is not a judgement that the care was safe, complete, or successful."_ The string
   `Run reviewed` no longer exists anywhere in the module, and a Playwright assertion keeps it
   from returning.
2. **Supplied teaching path · worked example** — the authored explanation, explicitly labeled as
   the example and not as this run.
3. **What you did in this run** — the real timeline with exact timestamps and tie order
   preserved, translated to readable actions with the values each event actually carried
   (`Blood flow: set to 180 mL/min`, `Setup step: Patient`, `Elapsed: 1 hr`). An action that
   changes no parameter says `Parameter change: None recorded for this action`. An event
   recorded without values says `Values were not recorded with this event.` and its values are
   never reconstructed from the final prescription. Refused attempts are shown as
   `· not applied` with the reason.
4. **Actual reassessment** — `Not recorded. The recommended reassessment below is the authored
answer, not something you entered.` It is never populated from the recommended answer.
5. **What this run recorded** — elapsed time, prescribed and delivered dose, whole-patient
   balance, downtime and current access pressure, from this run only.
6. **Sampled pressure, dose, and fluid evidence** — unchanged, minus the solute rows.
7. **Safety review of this run** — for each performed action the case authors as unsafe, the
   authored `explanation` and the linked critical error's `label` and `explanation`, verbatim.
   No new scores, gates, attempt counts or safety profiles. When none were performed, it says so
   and adds that this is a record, not a judgement of clinical adequacy.
8. **Modeled cause at the end of this run** — each still-active engine fault, its still-showing
   alert, whether this run recorded an acknowledgement, and the cause-first line: _"Seeing or
   acknowledging an alert does not correct its cause; the simulated cause stays in place until it
   is corrected."_ On the corrected path it says no simulated fault was still active.
9. **Laboratory values in this case** — the containment section described above.
10. The existing worked run comparison, action teaching notes, causal chain and transfer question.

Verified end to end on the CRRT-13 harmful path in the production build: the timeline reads
`0 min Assess … / 0 min Advance to the worsening pattern · Simulated time advanced: 30 min /
30 min Increase BFR through unresolved access resistance · Blood flow: set to 180 mL/min /
30 min Acknowledge … / 30 min Declare resolution … / 30 min Advanced simulated time by 1 hr ·
Elapsed: 1 hr / 90 min Ended the run`, with `Access pressure now −211 mmHg` and the
access-obstruction cause reported as still active.

Supporting engine change: `CrrtLearningTimelineEntry` gained optional `details` and `outcome`.
The timeline is in-memory session state and is not persisted, so there is no stored record to
migrate. A refused attempt no longer counts as run activity (`hasCrrtRunActivity` ignores
`outcome: 'refused'`), so exploring a disabled path cannot manufacture a run. Existing safety
prerequisites and interlocks are untouched: unsafe cards keep exactly the prerequisites their
authors gave them, and nothing was forced through the safe sequence.

## 5. Route and role mechanism (F-08, F-22, X-08)

`BaxterCrrtPractice` now treats the address bar as the single case identity.

- `resolvePracticeCaseId` validates `?case=` and falls back to the first core case.
- A render-phase sync mirrors the route prop into the selection whenever the route changes, so
  Next recommended, a direct link, reload, back and forward all move the rendered case, the
  header, the picker, the session and the visit record together. `lastRouteCaseId` mirrors the
  route only, which is what lets a local pick stand until the router catches up while a later
  back/forward still wins.
- `chooseCase` returns early for the same case and otherwise calls
  `router.push({ pathname, query: { case } })`, so the picker and the additional-case list put
  the case in the shareable URL. An additional case shows as `Optional · …` in the picker.
- An unavailable ID renders an explicit `role="status"` notice naming the case that opened
  instead. No mixed case data is possible, because one validated ID feeds everything.
- The visit effect depends on the case actually shown, so an unrelated query update cannot record
  a visit for a case the learner never saw, and cannot duplicate one.
- The `LOAD_CASE` effect depends only on `selectedDefinition`. `getBaxterCrrtCase` returns one
  frozen definition per ID, so it fires exactly once per real case change. A stale handler from
  the previous case cannot write into the new one: the reducer resolves intervention and
  reassessment IDs against the _current_ `caseDefinition` and ignores anything it does not find,
  and `CrrtCasePlayer` is keyed on the case ID so its local state is replaced. No autosave and no
  cross-case action transplant were added.
- New `SET_ROLE_LENS` action changes `state.roleLens` and `simulation.roleLens` and nothing else.
  Both `BaxterCrrtPractice` and `BaxterCrrtAssess` now dispatch it instead of `LOAD_CASE`, and
  `playerKey` no longer includes the role. Actions, elapsed time, prescription and reassessment
  all survive a role change. The control itself was **not** removed and no role-view framework
  was invented — F-22's "inert control" half stays with batch 03; this batch only stopped it from
  erasing the run. Legacy role records in `engine/progress.ts` are unaffected.

## 6. Tests

### New, and failing on the unmodified base for the intended reason

| File                                                                | Tests | Base result                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/baxter-crrt/__tests__/caseIdentityAndRole.test.tsx`   | 7     | **6 fail** on base: route change, back/forward, shareable URL, explicit fallback, exactly-one-fresh-session, role preservation. The 7th (an unrelated query update must not discard the run) passes on base and is a guard                                                                          |
| `src/features/baxter-crrt/__tests__/outputTruthAndDebrief.test.tsx` | 9     | **8 fail** on base: solute rows in the sampled table, missing supplied baseline, "Run reviewed", no-run wording, unreadable timeline, reassessment wording, harmful-action naming, corrected-path claim. The 9th (the decayed K must not appear as a current reading) passes on base and is a guard |
| `src/features/baxter-crrt/engine/__tests__/soluteValidity.test.ts`  | 5     | With `soluteValidity.ts` restored onto the base engine, **2 fail**: the metric reader returned `136` for sodium, and the content validator accepted a solute success metric. The other 3 characterize behavior that is unchanged by design                                                          |
| `src/features/baxter-crrt/__tests__/actualRunReview.test.ts`        | 4     | New module; covers the legacy no-values path, recorded console values, refused attempts, and harmful-path observations                                                                                                                                                                              |
| `src/features/baxter-crrt/__tests__/legacyProgressBytes.test.tsx`   | 3     | Seeds legacy storage and compares bytes                                                                                                                                                                                                                                                             |
| `e2e/baxter-crrt-self-paced.spec.ts`                                | +2    | Real-route case identity and role preservation; real-route debrief truth                                                                                                                                                                                                                            |

### Legacy storage

A `version: 2` record is left **byte-identical** — `recordCrrtVisit` refuses to touch an
unsupported record. A current `version: 3` record keeps `version`, `schemaVersion`, `attempts`
and any unknown future key untouched, and only extends `visitedCaseIds` and `lastLocation`. A
completed run writes no score, attempt count, streak or safety profile: `attempts`,
`bestSafeScores`, `criticalErrorAttempts` and `hintUse` all stay `{}`. One pre-existing
behavior is recorded rather than changed: an unrecognized lesson ID inside `selfPaced` is
dropped when the subtree is rewritten. That predates this batch.

### Updated existing assertions (intentional, headings changed)

`selfPaced.test.tsx`, `workedCaseExamples.test.tsx`, `practiceAssess.ui.test.tsx`,
`e2e/baxter-crrt-self-paced.spec.ts` — "Worked debrief explanation" → "Supplied teaching path ·
worked example"; "Run reviewed" / "Example reviewed · no run performed" → the new status lines;
"Relevant labs" → "Supplied labs at case start"; "Recorded action timeline" → "What you did in
this run".

### Commands run on this branch

```
npx --no-install jest src/features/baxter-crrt                     → 64 suites, 684 tests, pass
npx --no-install jest src/features/critical-care/progress \
    src/app/api/analytics src/app/sitemap.baxter-crrt.test.ts \
    src/features/module-beta                                       → 12 suites, 200 tests, pass
npx --no-install jest 'src/app/[locale]/baxter-crrt'               → pass
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit            → exit 0
npx --no-install eslint <changed files>                            → 0 errors, 0 warnings
npx --no-install prettier --check <changed files>                  → clean
npx --no-install playwright test -c playwright.baxter-crrt.config.ts → 18 passed (dev, 1.6 min)
NODE_OPTIONS=--max-old-space-size=8192 npm run build               → success
git diff --check                                                   → clean
```

`tsc` needs the raised heap on this machine when other worktrees' dev servers are running;
at the default heap it exits with a V8 out-of-memory, which is an environment limit, not a
type error. The dev server was stopped before the production build, and no other worktree's
process was touched.

### Browser evidence

- **Dev (3129), 1280×900:** CRRT-01 → Next recommended → URL, `h2`, picker and the next
  recommendation all move to CRRT-02, and the recommendation advances to CRRT-04. Browser back
  → CRRT-01; forward → CRRT-02. An additional case moves the URL to `?case=CRRT-03` and shows
  `Optional · …` in the picker. Role Integrated → Operator after one action and `+1 hr` keeps
  60 min and the completed action.
- **Dev, 390×844 and 375×812:** page horizontal overflow is 0 with the debrief open. The inner
  `contextStrip` scrolls sideways by design (it announces "This clinical context row scrolls
  sideways"); that is the shared learning-module chrome and was not changed.
- **Dev, 200% root text at 1280×900:** the new "What you did in this run" and "Laboratory values
  in this case" sections have 0 horizontal overflow and 0 clipped children.
- **Production build (`node server.js`, 3131), 1280×900:** Next recommended, back, forward,
  role preservation and the full debrief all behave as above; `Run reviewed` is absent, the
  containment section is present, and the sampled table heading is "Sampled pressure, dose, and
  fluid evidence".

## 7. NOT RUN

- No screen reader, no real assistive technology, no native browser zoom, no other engine
  (Firefox/WebKit), no real phone or touch testing, no `es` / `zh-CN` locale pass.
- No real learner or operator session. The walkthrough is AI-assisted persona feedback and does
  not satisfy owner task 5.
- The six additional cases the report did not walk were not individually walked here either.
  The containment and debrief changes are module-wide and the 18-case Playwright sweep covers
  every route, but that is route coverage, not clinical review.
- No clinical, device, source, alarm or dosing claim was verified, added or changed. No KDIGO or
  manufacturer document was read for this batch.

## 8. Holds and dependencies still open

- **CONFLICT-001 / CONFLICT-002** (predilution and filtration-fraction expression) and
  **G01-CRRT-02** (the PrisMax −25 mmHg placement) are untouched and still held.
- The prior `docs/gap-remediation/self-paced/CRRT-02-handoff.md` limitations — fixed filter-inlet
  concentration and filtration fraction, the ~0.37 mmHg filter rise at 6 h, and CRRT-16 plans
  that do not act on the circuit — are unchanged. They are pre-existing decisions, not
  regressions found by this batch.
- **Batch 02** owns: the CRRT-11 safe-arm time offset noted in §2, whether the CRRT-13 correct
  path should consume simulated minutes, and the F-03 / F-05 model extensions.
- **Batch 03** owns: F-09 (Help and the case picker still live inside the collapsed "Current
  task" drawer — the new Playwright test opens it explicitly and says why), the F-22 inert-control
  decision, F-11/F-12 layout, and the 200% activity-header truncation observed above, which is
  shared chrome and predates this batch.
- **Batch 04** owns F-19 (build jargon in learner-facing panels) and F-24 (terminology). This
  batch added no new internal codes to learner surfaces and removed the `SET_PRESCRIPTION_VALUE`
  / `COMPLETE_SETUP_STEP` codes from the debrief.
- **Prompt 05** owns O-01 and the seven decisions listed in §3.
- Shared `AnswerVerdict` (PR #249) is merged into the base and was consumed, not duplicated.
  `ChoiceReasoningFeedback` was not touched; this batch encountered no CRRT wrong-answer heading
  that needed it.
- Dead code flagged, not fixed: `components/CrrtResponsePanel.tsx` and
  `components/CrrtCalibrationPanel.tsx` both import a `crrt-learning-workflow.module.css` that
  does not exist and are imported by nothing.

## 9. Files changed

Modified: `.claude/launch.json`, `e2e/baxter-crrt-self-paced.spec.ts`,
`src/features/baxter-crrt/components/{BaxterCrrtAssess,BaxterCrrtPractice,CrrtActivityWorkspace,CrrtCasePlayer,CrrtWorkedCaseExample}.tsx`,
`src/features/baxter-crrt/content/schema.ts`,
`src/features/baxter-crrt/engine/{learningSession,outcomes}.ts`,
and three existing test files whose changed assertions are listed in §6.

Added: `src/features/baxter-crrt/engine/soluteValidity.ts`,
`src/features/baxter-crrt/labEvidence.ts`, `src/features/baxter-crrt/actualRunReview.ts`,
`src/features/baxter-crrt/engine/__tests__/soluteValidity.test.ts`, and
`src/features/baxter-crrt/__tests__/{caseIdentityAndRole,outputTruthAndDebrief,actualRunReview,legacyProgressBytes}` tests.

`engine/soluteModel.ts`, `engine/patientModel.ts`, `engine/simulation.ts`,
`content/phase7ReviewCases.ts`, `content/pilotCases.ts`, `content/completeCases.ts` and
`content/runtimeCaseNormalization.ts` were **not** modified. No raw fixture, source record,
review status or saved history was altered.
