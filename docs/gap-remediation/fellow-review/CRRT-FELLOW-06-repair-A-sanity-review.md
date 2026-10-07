# CRRT-FELLOW-06 Repair A — independent pre-merge sanity review

Date: 2026-10-04. Scope: F06-R01, R02 and R03 only. No merge or deployment.

**SANITY REVIEW: READY TO MERGE — for the repaired tree identified below.**

**PR #333 at its submitted/current head is NOT READY TO MERGE unchanged.** It still has
no-effect stop/connection labels in CRRT-08/09 and unsupported linked-trend language in
CRRT-17. The independent review fixes these on `codex/crrt-333-sanity`. This verdict requires
those fixes, not just the original PR. The repository prohibits working on the other agent's
branch, so the Codex branch is a separately reviewable replacement containing #333 plus the
review repairs and this report. It does not modify or close `claude/crrt-f06-repair-a`.

This is bounded Repair-A acceptance. R04, R05, the three shared Jest failures, and clinical,
device and source-review holds remain open; this is not full CRRT-FELLOW-06 acceptance.

## 1. Identity, isolation and governing evidence

| Item                                             | Independently verified value                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Submitted and final-observed #333 head           | `e67339abe98fe7c81e18418dc39eaa7324f37b32`                                                                                                         |
| Current main, initial and final fetch            | `fd6805119d9de8bb454d8dcf7f879f4e8165f420`                                                                                                         |
| Submitted PR versus current main                 | 2 ahead / 0 behind; GitHub MERGEABLE / CLEAN                                                                                                       |
| Main drift / overlap                             | None; no integration needed                                                                                                                        |
| Review repair commit / final tested runtime head | `62f7a0b21ef2dea244592cd08fc8cd94d10fb040`                                                                                                         |
| Repaired code versus main                        | 3 ahead / 0 behind before this report-only commit                                                                                                  |
| Final delivery                                   | The report-only descendant on `codex/crrt-333-sanity`; its exact tip is recorded in the review handoff. Runtime and tests are those at `62f7a0b2`. |

Fresh managed review checkout:
`/Users/russellmiller/.codex/worktrees/crrt-333-sanity/codex-crrt-10-3`.
A separate untouched same-main checkout was used for browser, runtime and Jest comparison:
`/Users/russellmiller/.codex/worktrees/crrt-333-main/codex-crrt-10-3`.
The original working directory and other agent's branch were not edited.

Read the Local-Data map before resolving inputs. Read the implementation pack's
`COMMON_CONTRACT.md`, `FEEDBACK_LEDGER.md` and `OWNER_DECISIONS.md` end-to-end,
including the review/ownership boundaries and unresolved model decisions. These live under
`Interventional-Pulm-Local-Data/module_update_9_19/CRRT_Claude_Implementation_Pack/`.
Read the final acceptance record and Repair-A handoff, the Batch-05 decision packet, and
reviewed its queue; consulted the relevant prior Batch-01–04, CRRT-12 and terminal-End
handoffs/sanity records. Historical PASS statements were not substituted for current tests.
No original clinical source or manufacturer instruction was newly adjudicated.

The 34 Batch-05 decisions remain NOT REVIEWED, with all six decision/reviewer fields null.
The decision queue SHA-256 remains
`fa4b7656f06df44008d99b0d5c92f55aeecb4dd40771e488d1a7d7e15522363b`;
the G01 queue remains
`7a80a66e1afa32bdbe7f3cc06bf5732b3ade9e49ed145749673a5b6ce48efc8d`.
Neither queue, source registry nor governing Local-Data file was edited.

## 2. Independent accepted-base reproductions

Used actual browser DOM text and screenshots from untouched main, plus imported runtime
case definitions and real learning-session reducers. No dependence on the author's new tests
for establishing the original defects. Fresh contexts opened
`/en/baxter-crrt/practice?case=CRRT-XX`; no-action runs opened Debrief and ended the run.

| Finding                  | Reproduction on untouched main                                                                                                                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01 / 03                 | Intro says “A serial solute trend and a neurologic vulnerability are visible together.” Its action response and generic debrief say “The serial simulated trend changes gradually…” Yet the lab projection after two hours still carries supplied starting values and withholds unsupported evolving chemistry. |
| R01 / 04                 | Intro/action teaching promises “later laboratory trends”; reassessment asks for laboratory trends; debrief asks for “the later laboratory trends.” This is a delivery/setup case with supplied starting chemistry, not a valid serial clinical chemistry model.                                                 |
| R02 / 01, 02, 06, 07, 11 | Fresh no-action actual ledger records no intervention/reassessment, but generic prose says reassessment “showed whether the intended response occurred.” The context also “framed” the goal.                                                                                                                    |
| R02 / 17                 | No-action generic teaching says the escalation/reassessment plan “is recorded” and the responsible team “receives” the summary, despite the actual no-action record.                                                                                                                                            |
| R03 / 08                 | Starts connected/running at actual blood flow **150 mL/min**. Intro says “Before connection”; action/debrief says setup “remains paused.” All intervention effects are empty.                                                                                                                                   |
| R03 / 09                 | Starts connected/running at actual blood flow **150 mL/min**. Intro says “Before treatment starts”; generic teaching suggests a workflow becomes verified or remains unavailable although the fixture continues running. All intervention effects are empty.                                                    |

Evidence: `main-browser.json`, `main-runtime.json`, corresponding screenshots and the
submitted-head captures. CRRT-03/08/09 action, two-hour Patient & trends and Machine views
were also captured. No page JavaScript errors occurred in these reproductions.

## 3. Residual defects and bounded review repairs

### CRRT-08/09 no-effect action labels

**Confirmed on submitted head.** CRRT-08 still offered “Stop the sequence…” while its response
said nothing stops or pauses. Both cases also inherited “Stop progression and request
independent input verification.” CRRT-08's unsafe “Connect first…” card likewise had no
connection effect. These labels were inconsistent with what clicking the cards records.

The repair uses:

- CRRT-08 safe: “Plan to stop the sequence, identify the mismatched domain, and complete an independent check”.
- CRRT-08 unsafe: “Plan to connect first and correct the mismatch later”.
- CRRT-08/09 alternative: “Plan to stop progression and request independent input verification”.

Alternative-card descriptions explicitly say that a plan is recorded and the running
demonstration continues unchanged. Existing no-effect responses, action identities, safety
classification, prerequisites and intervention effects remain unchanged. In particular, no
pause/stop effect was added and no fixture was changed.

Independent tests actually perform every stop/connection-labelled choice after assessment:
all are recorded, the entire simulation is unchanged, actual blood flow remains 150 mL/min,
and the pause count remains zero. The browser matrix also performs both safe and alternative
choices and inspects the resulting action text. Unsafe teaching still names the actual choice;
only two exact-label expectations in the earlier teaching tests needed updating.

### CRRT-17 absent “linked trend”

**Confirmed on submitted head.** Transfer still asked how to communicate “the linked trend.”
The reassessment option and generated hint also asked to reassess “linked trend direction.”
These imply serial evidence absent from this single-systemic-calcium case.

Transfer now asks about “the single supplied calcium observation, missing trend and context,
and escalation boundary.” The reassessment/hint asks to review the supplied observation,
sampling validity and delivery context and identify missing trends and follow-up. No serial
values, citrate measurement, ratio, infusion model or clinical instruction was added.

Four independent assertions failed against the submitted content for these residuals and
passed after repair; the seven mixed-action debrief assertions already passed. The focused
suite is now **61/61**: the author's 50 plus 11 independent checks. Early scratch harness
errors were corrected before recording the four-failure red baseline; they are not product
findings. The broad run initially exposed the two old unsafe-label expectations; they were
updated to the new explicit plan label without removing or weakening their assertions.

## 4. R01–R03 verdicts on the repaired tree

### R01 — PASS

Audited CRRT-03/04 intro, opening finding, objectives, action labels/descriptions/responses,
Patient & trends, actual action notes, worked plan/debrief and transfer question. Runtime
field comparison, rendered focused tests and real dev/production journeys agree:

- Laboratory observations are supplied once at case start, not a serial clinical trajectory.
- Serial clinical measurements are information to obtain/review separately.
- Actual delivery, dose, elapsed time, interruptions, pressure and fluid evidence remain usable.
- No action claims to make an unsupported solute series appear or attributes a displayed
  clinical solute trajectory to delivered clearance.
- The clinical chemistry projection continues withholding unsupported internal solute arithmetic.

CRRT-04's effects, setup/start prerequisites, prescribed/delivered distinction, timed events,
refusal paths and stale-review/rereview behavior are unchanged. Its full machine workflow
passed in development and production, including the existing six-condition focus checks.

### R02 — PASS

The generic teaching is inside the locally labelled region
**“Worked teaching for this case · not a record of this run”**, with a visible amber heading,
dashed border and adjacent explanation. The actual ledger remains outside that region.
The separation is semantic and textual, not color-only. The authored content is independent
of whether an action was performed; its shared tense is prospective/hypothetical. No duplicate
“Your clinical model” generic debrief was restored and there is one Causal debrief.

| Independently exercised path       | What the actual section records                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| No action, CRRT-17                 | Opening the debrief only; no invented intervention or reassessment                |
| Initial assessment only, CRRT-01   | The assessment actually performed                                                 |
| Diagnostic only, CRRT-13           | Real assessment, advance-to-pattern and access inspection; no invented correction |
| Harmful, CRRT-11                   | The unsafe choice, without fabricated reassessment                                |
| Corrective, CRRT-11                | The assessment and correction actually performed                                  |
| Actual reassessment, CRRT-17       | Only the committed option, alongside the performed actions                        |
| Time without reassessment, CRRT-02 | Elapsed-time event; reassessment stays Not recorded                               |

The independent rendered test validates that each requested action really executed, compares
actual ledger length to the session timeline, and checks reassessment against committed state.
The same authored teaching remains separate in all seven paths. The author's passing suite
additionally renders no-action debriefs for all 18 cases and performed/reassessed 11/17 paths.
Action responses appear only as notes for actions actually performed, not automatically as
generic debrief truth.

### R03 — PASS after review repair

Both 08/09 remain connected/running at actual **150 mL/min**. Safe, alternative and unsafe
choices have unchanged empty effects. Two-hour trajectories remain identical to main and
record continuous delivery with zero downtime. Intro, response and worked teaching identify
verification/planning beside an already-running demonstration. The corrected buttons now
match this boundary. Medication quantities, anticoagulation physiology and setup holds remain
unimplemented; this repair makes no new model claim.

## 5. Built/runtime case-diff audit

Imported the real built case definitions on main, submitted head and repaired head. The
recursive audit compares every serialized leaf, all initial and two-hour simulation state,
lab evidence and actual-flow projections. Counts below include repeated generated teaching
fields, not just the narrative authoring inputs.

| Case group                   | Changed runtime-definition leaves versus main | Disposition                                                                 |
| ---------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| CRRT-03                      | 15                                            | Delivery versus missing serial-chemistry wording                            |
| CRRT-04                      | 13                                            | Missing clinical chemistry wording; workflow unchanged                      |
| CRRT-08                      | 24                                            | Running-demo framing plus explicit plan choices                             |
| CRRT-09                      | 8                                             | Running-demo framing plus explicit alternative plan                         |
| CRRT-17                      | 6                                             | Prospective generic teaching plus transfer/reassessment/hint correction     |
| CRRT-01/02/06/07/11          | 2 each                                        | Only `debrief.causalChain[0]` framed → frames and `[3]` showed → would show |
| CRRT-05/10/12/13/14/15/16/18 | 0 each                                        | Entire runtime case definitions identical                                   |

**18/18 initial and two-hour simulation states, lab projections and blood-flow projections
are identical.** All intervention properties other than label/description/response are
identical, including effects, identities and prerequisites. Initial patient/access/device/
prescription, engine configuration, source basis, timed events, required IDs, success and
critical-error conditions did not change. The only shared presentation changes from main
are the worked-teaching region/style and its explanatory constant. There are no engine-file
changes. Evidence and reproducible recursive assertions: `case-diff.json`, three runtime JSON
snapshots and `crrt333-audit.py` / `crrt333-dump.ts`.

## 6. Accepted regressions rerun

| Contract                         | Current evidence and result                                                                                                                                                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRRT-12 information gap          | `crrt12EvidenceGap` Jest; full dev/production journey verifies missing data and review as a request. PASS.                                                                                                                                                        |
| Terminal End checkpoint          | `terminalEnd` Jest before/at/after checkpoint, including explicit scheduled state attempts; dev/production before/after End and never-ended control. PASS.                                                                                                        |
| CRRT-04 setup/start/stale review | `batch02Sanity`, setup/session tests; real machine entry, divergence, stale review and rereview browser journey. PASS.                                                                                                                                            |
| CRRT-13 downtime/debrief         | `matchedTimeCausality` and `caseCausalityAndEvidence`: same-timestamp pause/resume is zero; advancing while paused creates actual downtime; diagnostic/harmful/corrective/recovery distinctions preserved. Full self-paced/operations browser journeys also pass. |
| URL case identity                | `caseIdentityAndRole` and full browser direct query, cases, reload, Back/Forward, invalid fallback and group boundaries. PASS, with historical R05 still open.                                                                                                    |
| Reading perspective              | `workbenchWayfinding`, identity/role tests and browser repeated Operator/Prescriber/Both switches preserve the run. PASS.                                                                                                                                         |
| Unsupported chemistry            | `soluteValidity`, Repair-A and CRRT-12 containment; live Patient & trends/debrief shows static supplied labs. PASS.                                                                                                                                               |
| Zero versus missing              | `soluteValidity`, balance-feedback/independent balance checks and output evidence tests. Numeric zero remains distinct from unavailable evidence. PASS.                                                                                                           |
| Help / Reference / Evidence      | Full Batch-03 browser keyboard, dismissal, rerender and state-preservation checks at compact/desktop widths. PASS.                                                                                                                                                |

## 7. Responsive and keyboard coverage

Independent production browser matrix: five cases × six conditions = **30/30 passed**.
For each case, measured intro and debrief, executed action controls with Enter/Space, checked
focus outline and viewport reachability, scrolled to the worked heading and transfer question,
and saved DOM text and screenshots. 03/08/09/17 perform assessment plus safe action; 08/09
also perform the alternative. 04 performs its goal action here; its full setup sequence is
covered by the separate production/dev regression. Tab/Shift+Tab boundary traversal is
recorded; the static teaching region correctly does not add an artificial tab stop.

| Viewport/root text | CRRT-03 | CRRT-04 | CRRT-08 | CRRT-09 | CRRT-17 debrief | Document overflow          |
| ------------------ | ------- | ------- | ------- | ------- | --------------- | -------------------------- |
| 1440×900 / 100%    | PASS    | PASS    | PASS    | PASS    | PASS            | 0 px                       |
| 1280×900 / 100%    | PASS    | PASS    | PASS    | PASS    | PASS            | 0 px                       |
| 1024×768 / 100%    | PASS    | PASS    | PASS    | PASS    | PASS            | 0 px                       |
| 390×844 / 100%     | PASS    | PASS    | PASS    | PASS    | PASS            | 0 px                       |
| 320×740 / 100%     | PASS    | PASS    | PASS    | PASS    | PASS            | 0 px                       |
| 1280×900 / 200%    | PASS    | PASS    | PASS    | PASS    | PASS            | 51 px global; 0 CRRT-local |

All measured visible CRRT sections, headings, cards and controls stay inside the viewport;
all tested controls show a solid focus outline and are reachable. The worked heading is
visible after scrolling; long narrow text wraps and the transfer remains reachable. No page
JavaScript errors. Visually inspected representative screenshots spanning all five cases
and all six conditions, including the 320 px full worked section and 200% debrief.

The historical “global-header” classification needs precision: this review's DOM trace
locates the 51 px overflow at the global **footer** “Intro to Bronchoscopy” link, whose right
edge is 1330.765625 at a 1280 px viewport. Untouched main and repaired production both show
51 px. The global header also occupies more vertical space at 200%, but the measured
horizontal offender is the footer. This remains a separate platform issue; no CSS workaround
or repair was added. Evidence: `main-header.json`, `repaired-header.json` (historical filenames).

Systemic CRRT layout/UX suite: **52/52 passed**, covering the shared instruction/navigation,
primary circuit/control and actual-output surfaces, including narrow and text200 conditions.

## 8. Explicit R04/R05 boundary

**R04 untouched and unresolved.** Repeated the real session/review/device projection with
`crrtFixtureWithMakeupBag` and `withCrrtMakeupFlow`: 100 mL/h for 7200 seconds, then zero
for another 7200 seconds. Complete main/repaired simulation, actual-review and device output
JSON is identical. At both checkpoints the device projection is
`unresolved-makeup-attribution` and withholds machine-removal/whole-balance fields; actual
review still exposes **500 mL** and **900 mL** whole-patient balance. Raw evidence/patient
consumer code is unchanged. No new consumer browser rendering was needed to claim a fix:
there is no fix and no new all-consumer acceptance. The defect remains for its separate owner.

**R05 unresolved.** Ran the unchanged focused “every Cases option is reachable and all four
group boundaries stay truthful” development test **10 repetitions on untouched main and 10
on the repaired branch**, one worker, no retries. Both are 10/10 pass (49.6 s / 46.5 s).
The full repaired dev run also passes it once. These executions did not reproduce the
historical race; they do not establish resolution or justify deleting its finding. No
navigation/storage/timing code or this test was changed.

## 9. Automated validation and exact scope

| Check                                                     | Current result                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Focused Repair-A Jest                                     | **61 passed**                                                                        |
| Full feature CRRT Jest                                    | **85 suites / 1055 tests passed**                                                    |
| CRRT + shared/route/analytics/draft/search command        | **135 suites passed / 3 failed; 1622 tests passed / 3 failed**                       |
| Same broad command on untouched current main              | **133 suites passed / 3 failed; 1561 tests passed / 3 failed**                       |
| Full CRRT Playwright development, all nine matching specs | **84 passed / 1 skipped**, 3.9 min                                                   |
| Full CRRT Playwright production, same nine specs          | **84 passed / 1 skipped**, 2.0 min                                                   |
| Systemic CRRT layout/UX                                   | **52 passed**, 1.4 min                                                               |
| Independent changed-case matrix                           | **30 passed**, no local overflow/page errors                                         |
| R05 development repetitions                               | **10/10 main + 10/10 repaired**, unresolved                                          |
| Root `npm run type-check`, 8 GiB heap                     | PASS                                                                                 |
| `npm run build`, 8 GiB heap                               | PASS; both training apps, content, asset validation, Next and standalone preparation |
| All changed TypeScript/TSX ESLint                         | PASS, no output                                                                      |
| All changed paths Prettier                                | PASS; report checked separately before commit                                        |
| `git diff --check`                                        | PASS                                                                                 |

The beta-wrapped browser case is the existing conditional skip without the local owner flag.
No new skip/retry was added. The custom full-suite configuration matches `baxter-crrt-*.spec.ts`
so that the new Repair-A spec is included even though the older systemic configuration lists
only selected CRRT files.

The **same three shared Jest failures** reproduce on identical current main:

1. `critical-care/__tests__/accessibility.test.tsx`: old circuit image accessible-name expectation.
2. `critical-care/__tests__/curriculum-sequencing.test.tsx`: expected list omits the trailing
   “PrisMax troubleshooting challenge”.
3. `critical-care/__tests__/learner-copy.test.ts`: 11 non-CRRT MV/MCS copy findings.

All failure messages, assertions and stack frames are identical after normalizing only the
checkout root. `shared-failure-comparison.json` records `identical: true`. These are failures,
not passes; none was disabled, edited or waived as fixed by Repair A. The two new broad-run
failures caused by this review's changed unsafe label were corrected by updating the exact
label assertions, leaving their safety/visibility checks intact; the final totals above are
from the subsequent full run.

Broad Jest command, executed independently in both checkouts:

```sh
NODE_OPTIONS=--max-old-space-size=8192 npx --no-install jest --runInBand \
  src/features/baxter-crrt src/features/critical-care src/features/learning-module \
  'src/app/.*/baxter-crrt' src/app/api/analytics \
  src/app/sitemap.baxter-crrt.test.ts src/features/module-beta \
  src/lib/draft-modules.baxter-crrt.test.ts src/lib/site-search.baxter-crrt.test.ts \
  --json --outputFile=<evidence-output>
```

Browser suite uses `/tmp/crrt333-playwright.config.cjs`, copied into the evidence directory;
baseURL points at local dev 3337 or production 3336, workers=1, retries=0. The systemic command:

```sh
SYSTEMIC_UX_BASE_URL=http://127.0.0.1:3336 \
SYSTEMIC_UX_OUTPUT_DIR=<evidence>/systemic \
npx --no-install playwright test -c playwright.systemic-ux.config.ts \
  e2e/systemic-ux.spec.ts e2e/systemic-ux-stabilization.spec.ts --grep 'CRRT|crrt'
```

Root and both nested training-app dependencies were installed in the isolated checkout.
Servers/build used synthetic preview Supabase values; no secrets file or shared Supabase
state was read or mutated. Build contains nonfatal upstream Browserslist/webpack dependency
warnings. Development was stopped before building. Production tests used the completed Next
build; standalone portability is not certified by starting that build locally.

## 10. NOT RUN and evidence handoff

Not run: human screen reader audit; native browser zoom (200% root text was tested instead);
Firefox/WebKit, physical touch/device/PrisMax testing, real learner study, localization,
account sync, deployment, fresh clinical/manufacturer source adjudication, or Batch-05 owner
decision implementation. No R04 repair or exhaustive fresh browser rerender of all its
consumers. No claim that ten clean repetitions resolve R05. No full-repository Jest or lint
beyond the explicitly listed shared consumers and changed files.

Raw authoring/review evidence remains outside Git:

`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/crrt-333-sanity-20261004/`

Principal evidence: base/submitted browser captures; main/submitted/repaired runtime JSON;
`case-diff.json`; main/repaired makeup JSON; red and focused Jest logs;
`main-jest.json`, `repaired-jest-final.json`, `shared-failure-comparison.json`;
dev/production Playwright logs and JSON; both R05-repeat logs;
`responsive-matrix.json` plus 90 screenshots; systemic output; build/typecheck/eslint/prettier
logs; seven reproducibility scripts/configurations. Temporary script paths are copied there
so the evidence does not depend on `/tmp` surviving. Screenshots and logs are not committed.

The smallest remaining integration step is to use the reviewed Codex replacement, or have
#333's owner apply `62f7a0b2` and this report. Merging #333 unchanged would retain the exact
residuals documented in §3. No merge, deployment, R04/R05 repair or source approval is implied.
