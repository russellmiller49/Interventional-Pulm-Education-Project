# CRRT-12 acceptance repair — F06-01 handoff

**Status:** CRRT-12 F06-01 REPAIR READY FOR INDEPENDENT REVIEW. One bounded repair PR. It is not
merged or deployed. This is not a new CRRT batch, and it does not implement any Batch-05 owner
decision.

**Finding repaired:** F06-01, FAIL — UNSUPPORTED CLAIM EXPOSED (CRRT-12), from
`CRRT-FELLOW-06-final-acceptance.md` §2.

## 1. Execution context

| Item                       | Value                                                                                                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR #280 (Batch-06 report)  | **MERGED** 2026-09-26 04:29:51 UTC as `2bc539f4e96fe66d196aae9ae08fad4c8131e79a`                                                                                                                          |
| **Base SHA**               | `7525229328102d0c01d97528b5db22448665437b` (`origin/main` at the start fetch: merge of PR #277, ECMO, which followed #280; it contains the #280 merge)                                                    |
| Branch                     | `claude/crrt12-acceptance-repair`, created from `origin/main`                                                                                                                                             |
| Worktree                   | `Interventional-Pulm-Education-Worktrees/claude-crrt-06`, created for this task and owned by it. The Batch-06 Codex worktree (`~/.codex/worktrees/crrt-fellow-06-acceptance`) was not used.               |
| Code head                  | `f2f34fea46a8b782286f5badfbd7066736977ace` (repair `3a99a22f`, then a one-line spec fix). This handoff is in the following docs-only commit; the PR reports its SHA.                                      |
| Content / engine version   | `1.1.0-sme-review.1` / `1.0.0`. **Unchanged.** The content version is a release label, not clinician approval.                                                                                            |
| Baseline production server | Unchanged base build: `next start -H 127.0.0.1 -p 32812`. It is valid for HTTP; Next warns that standalone output should use its standalone server.                                                       |
| Repair production server   | Head build: `node .next/standalone/server.js` on 127.0.0.1:3113, with its working directory checked as this worktree's `.next/standalone`                                                                 |
| Dev server                 | The CRRT Playwright config's own `next dev --webpack -p 3113`, started with `CI=1`, so it could not reuse a server                                                                                        |
| Environment                | Synthetic values on the command line only: `NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only`. `.env.local` and `launch.json` were not created or modified. |
| Browser                    | Playwright Chromium, headless, a fresh isolated context for every run; no signed-in browser                                                                                                               |
| Base-comparison checkout   | A detached scratch worktree of the base SHA, used only for the identical shared Jest command and for the all-case runtime comparison. It was removed at the end.                                          |

## 2. Baseline reproduction of F06-01 (unchanged base, production build)

Route: `/en/baxter-crrt/practice?case=CRRT-12`. Viewports: 1440×900 and 390×844. The journey was
fresh case → intro → scope → **Explain this case** → **Complete the initial clinical assessment** →
review action → **+1 hr** twice → **Patient & trends** → **End run and review debrief**.

Every element of the Batch-06 finding reproduced:

| Batch-06 claim                                    | Baseline observation (exact text)                                                                                                                                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Introduction says the four domains' trends change | “During ongoing CRRT, electrolyte, temperature, medication-delivery, and nutrition trends change alongside a period of interrupted treatment.”                                                                                                                |
| Objective                                         | “Integrate patient trends with actual therapy delivery and interruptions.”                                                                                                                                                                                    |
| Opening finding                                   | “Several linked monitoring domains change during a period of interrupted delivery.”                                                                                                                                                                           |
| Review action says trends become available        | The action is labeled “Review linked trends and coordinate the appropriate multidisciplinary reassessment.” The card says the simulation changes no setting, then: “The linked trends and delivery timeline become available for coordinated interpretation.” |
| Debrief repeats it                                | The same sentence appears in “Action teaching notes from this run” and again as the trend paragraph                                                                                                                                                           |
| Patient & trends lacks the four series            | After 2 h: delivered dose 18.82 mL/kg/h; whole-patient balance −320 mL; downtime 0 min; reassessment Not recorded. No electrolyte, temperature, medication or nutrition series.                                                                               |
| Dynamic chemistry withheld elsewhere              | The debrief's “Laboratory values in this case” shows supplied case-start values and “Not modeled in this exercise”                                                                                                                                            |
| Review action has no simulation effect            | `effects: []`. Reducer probe: after the assessment and the review, `session.simulation` is deep-equal to its value before the review.                                                                                                                         |
| No evidence scope                                 | The “What this case can show you” region is absent (count 0). `getCrrtCaseEvidenceScope('CRRT-12')` is `undefined`.                                                                                                                                           |

No page errors and no horizontal overflow occurred at either width. The worked plan (“Explain this case”) also
carried “Patient inputs and critical illness create a changing baseline.”

## 3. Files changed

| File                                                            | Change                                                                                                                                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/features/baxter-crrt/content/completeCases.ts`             | CRRT-12 narrative rewritten. `CaseNarrative` gained two optional fields, `responseOptionLabel` and `trendReview`, which only CRRT-12 uses; every other case falls back to its prior value. |
| `src/features/baxter-crrt/content/caseEvidenceScope.ts`         | New CRRT-12 scope. New supplied-field ID `temperature`. The header comment records F06-01.                                                                                                 |
| `src/features/baxter-crrt/caseEvidence.ts`                      | Field descriptor for `temperature`. It reads `initialPatient.temperatureCelsius` and displays °C with one decimal.                                                                         |
| `src/features/baxter-crrt/__tests__/crrt12EvidenceGap.test.tsx` | New focused regression (11 tests)                                                                                                                                                          |
| `e2e/baxter-crrt-self-paced.spec.ts`                            | One CRRT-12 browser journey appended                                                                                                                                                       |
| this handoff                                                    | —                                                                                                                                                                                          |

**Scope proof.** The full runtime registry and the resolved evidence were dumped for all 18 cases on base
and head. **Only CRRT-12 differs.** Within CRRT-12, 30 string paths changed and there are
**zero non-string differences**. Initial patient, circuit, prescription, engine fixture, interventions'
IDs/categories/prerequisites/effects, timed events, success conditions and source basis are
identical. There is no engine, schema, fixture-number, shared-component or shared-catalog change.

## 4. Old claims removed or reframed

| Field (derived surfaces)                                                        | Before                                                                                               | After                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Patient description (intro)                                                     | …trends change alongside a period of interrupted treatment.                                          | A patient is receiving ongoing CRRT, and the team needs a multidisciplinary review of electrolytes, temperature, medication delivery, and nutrition. This case supplies one set of case-start values and the live treatment-delivery record. It carries no serial electrolyte, temperature, medication-exposure, or nutrition data, and no record of an earlier treatment interruption. Sort what is available from what is missing, and plan how the missing data would be obtained before attributing any change to CRRT. |
| Objective 1                                                                     | Integrate patient trends with actual therapy delivery and interruptions.                             | Separate the treatment-delivery record a run provides from the serial clinical data it does not.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Objectives 2–3                                                                  | pharmacist/dietitian/nursing/prescriber coordination; the device display is not the whole assessment | **Unchanged**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Goal (goal option, hint 1, debrief goal review)                                 | Integrate multidisciplinary consequences with actual treatment delivery                              | Identify what a multidisciplinary review still needs and reconcile it with the treatment actually delivered                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Mechanism (hidden summary, mechanism option, hint 2, prediction review)         | …can influence linked monitoring domains over time.                                                  | Critical illness, patient inputs, the treatment actually delivered, and any interruption can each influence electrolytes, temperature, medication exposure, and nutrition, so naming one contributor needs serial clinical data and the delivery history, not a single case-start value.                                                                                                                                                                                                                                    |
| Safe action (control option, required action, debrief)                          | Review linked trends and coordinate the appropriate multidisciplinary reassessment                   | Review the available evidence, name the missing data, and request a multidisciplinary reassessment                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Accepted alternative                                                            | (renders) Keep the current treatment unchanged while clarifying missing clinical information         | **Unchanged**: it was already truthful                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Unsafe action (control, intervention, debrief)                                  | Attribute every change to the filter and act without cross-domain review                             | Attribute the concerns to the filter and act without the missing data or a cross-domain review. The action stays in the unsafe list with its explanation unchanged.                                                                                                                                                                                                                                                                                                                                                         |
| Expected response (safe + alternative action response, correct response option) | The linked trends and delivery timeline become available for coordinated interpretation.             | Your review and the request for the missing data are recorded in the case timeline. No electrolyte, temperature, medication-exposure, or nutrition series appears, because this case carries none; requesting the data does not supply it.                                                                                                                                                                                                                                                                                  |
| Correct response option label                                                   | Expect a linked response, then verify it                                                             | Expect the plan to be recorded, not new clinical data                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Reassessment (option, hint 3)                                                   | Reassess electrolytes, temperature, medication exposure, nutrition, and delivered therapy            | Obtain and review serial electrolytes, temperature, medication exposure, and nutrition alongside the treatment actually delivered                                                                                                                                                                                                                                                                                                                                                                                           |
| Opening finding                                                                 | Several linked monitoring domains change during a period of interrupted delivery.                    | Case-start values and the live treatment-delivery record are available. Serial electrolyte, temperature, medication-exposure, and nutrition data are not, and no earlier treatment interruption is recorded.                                                                                                                                                                                                                                                                                                                |
| Causal chain (hidden + debrief)                                                 | changing baseline / delivery and downtime alter exposure / reassessment distinguishes contributors   | This run supplies case-start values and a treatment-delivery record, but no serial electrolyte, temperature, medication-exposure, or nutrition data. Delivered dose, downtime, and interruptions belong in the review, but they cannot be linked to a clinical change that has not been measured. The multidisciplinary reassessment obtains the missing data before any contributor is named.                                                                                                                              |
| Transfer question                                                               | Which treatment-history and delivered-therapy findings belong in the multidisciplinary review?       | Which delivered-therapy findings from this run, and which missing clinical data, would you bring to the multidisciplinary review, and whom would you ask for each?                                                                                                                                                                                                                                                                                                                                                          |
| Title                                                                           | Electrolyte, temperature, medication, and nutrition consequences                                     | **Unchanged, deliberately.** It names the four domains the case is about and asserts no observation. The same string is also in the shared critical-care catalog (`critical-care/content/activities.ts`), which this repair does not touch. A retitle belongs with O-10.                                                                                                                                                                                                                                                    |

The general teaching principle survives as **domains that need review**: objective 2, the
reassessment plan, and the scope's second teaching pointer. It is no longer phrased as an observed
finding.

## 5. Evidence scope (new, rendered in the task before any action)

**Headline:** “This case is a multidisciplinary review with incomplete information. It supplies
case-start values and the live treatment-delivery record; the serial electrolyte, temperature,
medication and nutrition data a review would rest on are not in this case.”

**Supplied case values:** each is the fixture value, labeled “At case start”. The source is `SYNTH-CRRT-12`.

| Field       | Value       | Sample identity                                                     |
| ----------- | ----------- | ------------------------------------------------------------------- |
| Potassium   | 4.8 mmol/L  | Systemic sample                                                     |
| Bicarbonate | 19.0 mmol/L | Systemic sample                                                     |
| pH          | 7.29        | Systemic sample                                                     |
| Temperature | 35.8 °C     | Supplied case-start observation, one value, not a temperature trend |

`temperature` is the one new supplied-field ID. It reads `initialPatient.temperatureCelsius`,
keeps °C, and creates no engine value. Verified: `temperatureCelsius` is never written by the
engine, and a reducer probe reads 35.8 °C after an hour. No other field was added to fill the panel.

**Not in this case:** serial electrolyte and acid-base values; serial temperature; medication
delivery or drug exposure over time (the medication-carrier volume in the fluid balance is fluid,
not drug); nutrition intake or its effect over time; an earlier treatment interruption (none is
supplied, and no action in this case pauses delivery); results of a multidisciplinary reassessment
(a request records a plan, and no result comes back).

**What the simulation calculates here:** delivered dose, elapsed time and downtime, as they
actually occur in this run; the whole-patient fluid ledger; current settings, circuit pressures, and
the action timeline.

**What it does not model:** electrolyte, acid-base or temperature change; medication exposure or
clearance; any effect of nutrition. Because it produces none of these, it cannot attribute a change
in any of them to CRRT.

**Taught here, not shown by the simulation:**

1. Interruptions open a prescribed-versus-delivered gap; compare over the same interval before
   linking a clinical change to treatment. This cites `GUID-RRT-ICU-2026`, whose registered claim covers
   the `prescribed-versus-delivered` topic in `learnerSourceMap.ts`.
2. A CRRT review extends beyond the machine to electrolytes and acid-base status, temperature, medication
   dosing and nutrition, with pharmacy, nutrition, nursing and the prescriber. This pointer carries **no source
   ID** and renders “No registered source yet; awaiting clinical review.” Batch 05 (§ G-10) found
   no registered drug-dosing, nutrition or temperature source, so none was attached.

An earlier draft said downtime is counted “whenever delivery is paused or stopped”. A reducer probe
showed that CRRT-12 has no pause action, and ending treatment on the machine accrues 0 s of downtime. The
wording was corrected before commit.

## 6. Action-response and debrief change

- **Performed review action:** it keeps `category: 'fluid'`, `effects: []` and its prerequisite, and it does not
  advance time. Its response now records the review and the request, and states that no series
  appears and that requesting the data does not supply it. Test: `session.simulation` is deep-equal
  before and after the action; the clock stays at 0; exactly one `intervention-performed` timeline
  entry is added.
- **Debrief:** “What you did in this run”, “Actual reassessment: Not recorded”, time accounting,
  held signals and the laboratory containment are untouched Batch-01 surfaces. The trend paragraph is
  now a case-level statement that is independent of which actions were performed: “This run cannot attribute an
  electrolyte, temperature, medication, or nutrition change to CRRT: the case supplies those domains
  once, at case start, or not at all. What it does record is the treatment actually delivered (dose,
  elapsed time, any downtime, and the fluid ledger), which is the delivery side a multidisciplinary
  review would reconcile with the missing data once it is obtained.” Before, this paragraph reused the action response,
  so it would have claimed a review even on a run that never performed one. The generic duplicate
  debrief removed in Batch 04 does not return, and a test covers this.

## 7. Tests

| Check                                                       | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New `crrt12EvidenceGap.test.tsx` on **unchanged base**      | **9 failed / 2 passed.** Every failure is the unsupported claim or the missing scope, for example: the “become available” sentence was found four times; the scope was `null`; the card text lacked the request wording; the debrief matched `/become(s)? available/`. The two passes are guards expected to pass on base: the simulation is unchanged by the action, and solutes stay contained. A harness field name (`targetId` → `referenceId`) was corrected before this baseline was recorded. |
| Same file on head                                           | **11 / 11 passed**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Broad Jest command (below), head                            | 128 / 131 suites, **1,493 / 1,496 tests**; all **84 CRRT suites / 988 tests pass**                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Same command, untouched base                                | 127 / 130 suites, 1,482 / 1,485 tests; 83 CRRT suites / 977 tests pass                                                                                                                                                                                                                                                                                                                                                                                                                               |
| The 3 failures                                              | Same three as Batch 06 (`accessibility.test.tsx` circuit img name, `curriculum-sequencing.test.tsx` CRRT order, `learner-copy.test.ts` MV/MCS copy). **Normalized failure output is byte-identical between head and base**, and it contains zero `baxter-crrt` paths. DEFERRED / OTHER OWNER.                                                                                                                                                                                                        |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check` | PASS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `npm run build` (synthetic env, head)                       | PASS, 776 static pages                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ESLint `--max-warnings=0`, changed files                    | PASS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Prettier `--check`, changed files                           | PASS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `git diff --check`                                          | PASS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CRRT Playwright, **production build** (standalone, 3113)    | 67 passed, 1 skipped; the new CRRT-12 test first failed on a harness error (it read the Patient & trends tabpanel without opening its tab), was fixed in `f2f34fea`, and then **passed** on the same production build. Net: 68 passed, 1 skipped.                                                                                                                                                                                                                                                    |
| CRRT Playwright, **dev server** (`CI=1`)                    | **68 passed, 1 skipped** (§7a)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

Broad command (identical in both checkouts except the output path):

```sh
NODE_OPTIONS=--max-old-space-size=8192 npx --no-install jest --runInBand \
  src/features/baxter-crrt src/features/critical-care src/features/learning-module \
  'src/app/.*/baxter-crrt' src/app/api/analytics \
  src/app/sitemap.baxter-crrt.test.ts src/features/module-beta --json --outputFile=<file>
```

The skipped test is `baxter-crrt-workbench-wayfinding.spec.ts:354` (beta-wrapped route). It skips itself when
the wrapper serves no iframe without owner-local feedback mode or an account. It is pre-existing and **NOT RUN**.

### 7a. Dev-server Playwright

Run at code head `f2f34fea` with `CI=1` on the config's own dev server (port 3113, no reuse): **68 passed, 1 skipped**. This includes the new CRRT-12 journey. The skip is the same beta-wrapper test.

## 8. Production-browser journey after repair

Same route, same journey, 1440×900 and 390×844, on the head production build:

- **Introduction/current task:** new description and finding are shown. The unsupported-claim patterns
  (`become available`, `trends change`, `linked monitoring domains change`, `during a period of
interrupted`, `Integrate patient trends`) match **nothing** on the final page at either width.
- **Evidence scope:** present in the task before any action, with the four supplied values
  labeled “At case start”, the six absent items, and the calculates / does-not-model lists (§5).
  Screenshots were inspected at both widths.
- **Explain this case:** new mechanism, causal chain, reassessment plan and unsafe action, with no
  availability claim.
- **Review action:** the response records a request, and the card still says the simulation changes no
  setting.
- **Patient & trends after +2 h:** delivered dose 18.82 mL/kg/h, whole-patient balance −320 mL,
  downtime 0 min, reassessment Not recorded. The current delivery data is intact, and no clinical series
  appeared.
- **Debrief:** records the actual actions, then “Not recorded” reassessment, supplied/held signals,
  laboratory containment (“Not modeled in this exercise”), the action note with the request wording,
  and the new attribution paragraph.
- Horizontal overflow 0 and no page errors at either width.

Raw evidence (outside Git):
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/crrt12-repair-2026-09-27/`.
It holds the baseline and repaired journey logs/JSON and screenshots (`baseline-*`, `repaired-*`), scope
element screenshots, the journey script `crrt12-journey.cjs`, CRRT-12 before/after runtime dumps,
Jest JSON for head and base, and the build, type-check and Playwright logs.

## 9. Owner / model holds intentionally unchanged

- O-01 through O-10, all CONFLICT records, and the G01 decisions and queue are unchanged. The Batch-05 decision queue
  (34 items) is **NOT REVIEWED**, and its reviewer fields are null and untouched.
- No source approval, review status, reviewer field or sign-off was created or changed.
  `SYNTH-CRRT-12` stays unreviewed, and no source was added to CRRT-12's `clinicalSourceIds`.
- No new physiology, electrolyte, temperature, medication or nutrition series, timed event,
  downtime, interruption history, lab behavior, or medication/nutrition effect was added. The
  internal solute pools remain contained, and a test asserts it (`readAllowlistedCrrtMetric` still refuses
  `patient.solutes.*`).
- This repair does not author a CRRT-12 phenotype and does not preempt O-01/O-10/G-10. Whether
  CRRT-12 should ever carry an authored series is still an owner/source decision.

## 10. Batch-06 anomalies intentionally untouched

CRRT-15 −40.5 / −40 / −41 presentation; device `0 mL` vs evidence `Unavailable`; −25 pressure
placement; −18 interpretation; residual-clearance wiring; makeup; citrate; filter change; renal
recovery; BP/pressor response; predilution model. None was examined or changed, and all remain as
Batch 06 left them.

Also observed during this repair and left untouched:

1. **Generic 60 s timed event can restart an ended run.** `ensureTimedResponse` gives CRRT-12, and
   every adapted case whose template had no event, a 60 s event that sets delivery to `running`.
   Reducer probe: end treatment at 0 s and advance 1 h, and delivery reads `running`. Ending at
   300 s stays `ended`. This is an engine/content event-semantics question, not part of F06-01.
2. In a reducer probe, ending treatment on the machine at 300 s and advancing 1 h left downtime at 0 s.
   Whether an ended treatment should count as downtime was not adjudicated here. The §5 wording
   makes no claim either way.
3. The review action still shows the inherited `fluid` category chip. The generic mechanism label “Use the
   linked causal pattern” and the assessment description “…hemodynamic trends…” are shared
   adapter/template copy across adapted cases. A review of those belongs to a copy pass (O-10), not
   this repair.

## 11. NOT RUN

- Full Batch-06 acceptance matrix; this repair only unblocks resuming it.
- 1280×900, 1024×768 and 320×740 journeys for CRRT-12 specifically. The existing wayfinding
  specs covered those sizes for other routes. 200% root text, keyboard-only and theme checks on CRRT-12 were also not run.
- Beta-wrapped route Playwright test (self-skipped, §7).
- Native browser zoom, Firefox/WebKit, screen readers, physical devices, real learners,
  localization, clinical/device/source adjudication, and deployment.
