# CRRT-FELLOW-05 — clinical, device and model decision packet

> **Status of every decision in this packet: NOT REVIEWED.**
> Reviewer, reviewer role, review date, decision, required change and unresolved disagreement are
> blank on purpose. Nothing here is a clinical, nephrology, pharmacy or device approval. Nothing
> here changes the module: no runtime file, test, source record or review status was edited to
> produce it. The machine-readable queue is
> [`CRRT-FELLOW-clinical-device-model-decision-queue.json`](CRRT-FELLOW-clinical-device-model-decision-queue.json).

Prepared 2026-09-23 by an AI authoring assistant (Claude) at the owner's request, as prompt 05 of
the CRRT fellow-review package. The assistant gathered and checked sources; it is not a reviewer
and it decided nothing.

## How to use this packet

This packet is written for a nephrologist, a CRRT pharmacist and an experienced PrisMax operator.
You should not need the code to use it.

1. Read the one-screen decision summary in §3.
2. For O-01 to O-06, each section opens with an **at-a-glance table**: what the learner sees now,
   what the simulator does, what source exists, what is missing, one or two bounded options, and
   the exact decision requested. Details and locators follow the table for audit.
3. Record a decision in the JSON queue (or on paper for the owner to transcribe). The values
   used by the existing G01 queue apply: `APPROVE AS SCOPED`, `REVISE`, `REJECT`, `UNCERTAIN`. A
   decision covers the item's stated scope only, and needs your name, role, the actual date and
   the content version you reviewed (`1.1.0-sme-review.1` at `origin/main` `85acc113`).
4. "Not modeled", "not supplied", "not recorded" and "zero" are different things throughout. A
   blank in this packet means missing, never zero.

Placeholders written as `⟨…⟩` are values nobody has supplied. They must be sourced, or approved by
you as a **proposed synthetic teaching value**, before anything is built. This packet proposes no
new clinical number of its own.

---

## 1. The module state this packet describes

| Item                              | Value                                                                                                                                                                                                                                                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository                        | `russellmiller49/Interventional-Pulm-Education-Project`                                                                                                                                                                                                                                                                    |
| Starting `origin/main`            | `85acc113be11f9acbd395f49e00fee4b69ceff71` — merge of PR #275, 2026-09-23T23:07:19Z                                                                                                                                                                                                                                        |
| PR #275 (CRRT-FELLOW-04)          | **MERGED** as `85acc113`. Head `62154ba5`. The merged tree is byte-identical to that head (`git rev-parse 85acc113^{tree}` = `62154ba5^{tree}` = `fcca731e`), so the Batch-04 sanity review's final-state reproductions describe current main.                                                                             |
| PR #257 (CRRT-FELLOW-01)          | **MERGED** as `f01e43e2`, 2026-09-22T00:50:38Z                                                                                                                                                                                                                                                                             |
| PR #263 (CRRT-FELLOW-02)          | **MERGED** as `745146f6`, 2026-09-22T18:25:19Z                                                                                                                                                                                                                                                                             |
| PR #268 (CRRT-FELLOW-03)          | **MERGED** as `bf15fb95`, 2026-09-23T00:25:55Z                                                                                                                                                                                                                                                                             |
| Content version                   | `BAXTER_CRRT_CONTENT_VERSION = '1.1.0-sme-review.1'` (`src/features/baxter-crrt/content/versions.ts`). "sme-review" is a release-stage name; no subject-matter review is recorded.                                                                                                                                         |
| Engine version                    | `CRRT_ENGINE_VERSION = '1.0.0'` (`engine/initialState.ts`)                                                                                                                                                                                                                                                                 |
| Release stage                     | `unlisted-preview` (`content/release.ts`)                                                                                                                                                                                                                                                                                  |
| Branch / worktree                 | `claude/crrt-fellow-05-decisions`, created from `origin/main` `85acc113` in the task's own worktree (`Interventional-Pulm-Education-Worktrees/claude-crrt-05`). Not a Batch-04 or sanity-review worktree.                                                                                                                  |
| Final `origin/main` before commit | Recorded in §19.                                                                                                                                                                                                                                                                                                           |
| Holds carried unchanged           | O-01 to O-10; `CONFLICT-001`, `CONFLICT-002` (PrisMax FF/predilution expressions); `CONFLICT-CRRT-MAKEUP-001` (makeup attribution); `CONFLICT-010` (Prismaflex effluent definitions); `G01-CRRT-01` to `G01-CRRT-10` (all NOT REVIEWED); the CRRT-02 faculty packet's open questions for CRRT-05/15/16 (all NOT REVIEWED). |

"Current implementation" statements in this packet were checked against the code at `85acc113`,
not against the planner's older `bf738aa4` snapshot. Numbers attributed to runs come from the
merged Batch-01 to Batch-04 handoffs and sanity reviews, which ran the real reducer; §2.1 lists the
read-only probes run for this packet.

---

## 2. What was verified, and how

### 2.1 Local and registered sources

| Source                                                                                                 | What was done                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PRISMAX-AW8035-RB` — PrisMax Operator's Manual, AW8035 Rev B JUN2019, program version 2.XX, 353 pages | Local copy at `Interventional-Pulm-Local-Data/device-manuals/critical-care/708933961-Prismax-Operator-s-Manual (1).pdf`. SHA-256 `204543b8…34f1ff` **matches** the registered hash. Read PDF pp202–203 (filter pressure drop), 218–221 (CRRT software calculations), 94–161 (alarm chapter: priorities, alarm tables, overrides). Footer on every page read: "AW8035 Rev B JUN2019 · Program version: 2.XX". |
| Implementation package (outside Git)                                                                   | `Interventional-Pulm-Local-Data/module_update_9_19/CRRT_Claude_Implementation_Pack/`: `00_START_HERE.md`, `COMMON_CONTRACT.md`, `FEEDBACK_LEDGER.md`, `SOURCE_AND_CODE_NOTES.md`, `OWNER_DECISIONS.md`, `CROSS_MODULE_COORDINATION.md`, `05_CRRT_CLINICAL_DEVICE_MODEL_DECISIONS.md`. Read in place; not copied. References to those file names in this packet mean these copies.                            |
| Prior CRRT records in Git                                                                              | Read in full: the Batch-04 handoff, sanity review and owner proposals; `docs/gap-remediation/self-paced/CRRT-02-handoff.md`; `docs/gap-remediation/self-paced/G01-crrt-source-review-queue.json`. Read for the sections cited here: the Batch-01 to Batch-03 handoffs and sanity reviews; `docs/gap-remediation/self-paced/CRRT-02-faculty-packet.md` (CRRT-05/15/16 comparisons and open decisions).        |
| Walkthrough `CRRT_PrisMax_Learner_Walkthrough.docx` (2026-09-19)                                       | SHA-256 `34d2837d…d73b2e` matches the package manifest. Text of §5 (content needs) and §6 (reviewer notes) re-read so its claims can be kept separate below. It is AI-assisted persona feedback, not a source of clinical fact.                                                                                                                                                                              |
| Registered source records                                                                              | Every ID cited here was resolved against the learner-facing resolver `baxterCrrtLearnerFacingSourceById` (`content/learnerSourceMap.ts`), the source-document list (`content/provenance.ts`), or the runtime case registry for `SYNTH-CRRT-nn` IDs (§19).                                                                                                                                                    |
| Code                                                                                                   | Read at `85acc113`: `engine/soluteModel.ts`, `engine/soluteValidity.ts`, `engine/patientModel.ts`, `engine/clinicalMath.ts`, `engine/pressureModel.ts`, `engine/circuitDelivery.ts`, `engine/simulation.ts` (step), `engine/types.ts`, `content/runtimeCaseNormalization.ts`, `content/caseEvidenceScope.ts`, `content/alertLabels.ts`, the lesson registries.                                               |
| Read-only probes (scratchpad only, not committed)                                                      | Normalized all 18 runtime cases through `normalizeRuntimeCrrtCaseToEngineFixture` and tabulated flows, bags, solute pools (value, unit, volume, production, input, residual clearance, permeability), filter-inlet fraction, filtration fraction, supplied hemodynamics, calcium and urine. No engine state was advanced and nothing was written.                                                            |

### 2.2 Outside verification (bounded; primary sources only)

| Document                                                                                                                                                                                                | Type                                            | Status found on 2026-09-23                                                                                                                                                                                                                                                                                                                      | How it was read                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KDIGO 2026 Clinical Practice Guideline for AKI and AKD — "Public Review Draft, March 2026"                                                                                                              | **Draft guideline** (public review)             | **Still a draft.** kdigo.org's AKI page says the draft was made available for public review and that the work group is preparing the guideline for publication; public review closed 2026-05-11 (extended from 2026-04-27). No final publication or journal citation was found. The draft cover says it is for public review and feedback only. | Draft PDF (499 pp) from kdigo.org, text-extracted. Chapter 5 recommendations read in the summary (PDF pp38–42) and chapter text (PDF pp261–316). PDF page numbers are used as locators. |
| Zhou et al. "Highlights of the KDIGO 2026 clinical practice guideline for AKI/AKD." Zhonghua Nei Ke Za Zhi 2026;65:784–790 (PMID 42557083)                                                              | Secondary commentary (Chinese)                  | Not the guideline. Recorded only so it is not mistaken for a final publication.                                                                                                                                                                                                                                                                 | PubMed metadata only.                                                                                                                                                                   |
| KDIGO 2012 AKI guideline, Kidney Int Suppl 2012;2:1–138 (`GUID-KDIGO-AKI-2012`)                                                                                                                         | Guideline (final)                               | Remains the published KDIGO AKI guideline.                                                                                                                                                                                                                                                                                                      | **Not re-read.** No local copy; full text not retrieved for this packet. Its section numbers and grades below are the registry's or the walkthrough's, marked as such.                  |
| Meersch-Dini et al. "Multidisciplinary guidelines on renal replacement therapy in intensive care medicine." Crit Care 2026;30:46 (PMID 41535952) (`GUID-RRT-ICU-2026`, `CITRATE-ICU-GUIDE-2026-SAFETY`) | Guideline (final; bi-national German–Austrian)  | Published 2026-01-14. Population: critically ill adults with dialysis-dependent AKI in the ICU. 22 clinicians from 12 German-speaking societies. Grades: A (strong), B (weak), 0 (no recommendation), expert consensus; certainty ⊕ symbols.                                                                                                    | PMC full text (PMC12849416) via a retrieval tool; recommendations 4.4, 4.5, 4.6, 5.1 and 7.3 read verbatim. **Grades should be confirmed by the reviewer against the article.**         |
| Murugan et al. JAMA Netw Open 2019;2:e195418 (PMID 31173127)                                                                                                                                            | Observational (secondary analysis of RENAL RCT) | Published. Australia/New Zealand, 35 ICUs, CVVHDF, 1,434 patients.                                                                                                                                                                                                                                                                              | PubMed abstract.                                                                                                                                                                        |
| Palevsky et al. (ATN) N Engl J Med 2008;359:7–20 (PMID 18492867)                                                                                                                                        | RCT                                             | Published.                                                                                                                                                                                                                                                                                                                                      | PubMed abstract. Not in the registry.                                                                                                                                                   |
| Bellomo et al. (RENAL) N Engl J Med 2009;361:1627–38 (PMID 19846848) (`RENAL-2009`)                                                                                                                     | RCT                                             | Published.                                                                                                                                                                                                                                                                                                                                      | PubMed abstract.                                                                                                                                                                        |
| Pistolesi et al. (SIAARTI-SIN) J Anesth Analg Crit Care 2023;3:7 (PMID 37386664) (`CITRATE-SIAARTI-2023-*`)                                                                                             | Expert opinion (position statement)             | Published; identity confirmed.                                                                                                                                                                                                                                                                                                                  | PubMed abstract only. Passages not re-read (no local copy).                                                                                                                             |
| Schneider, Journois, Rimmelé. Crit Care 2017;21:281 (PMID 29151020) (`CITRATE-SCHNEIDER-2017-*`)                                                                                                        | Expert viewpoint                                | Published; PMID confirmed (the registry records only the DOI).                                                                                                                                                                                                                                                                                  | PubMed identity only. Passages not re-read.                                                                                                                                             |

Retrieval note: reading the KDIGO draft required the retrieval tool to save the 5.8 MB draft PDF in
this session's tool-output folder outside the repository. It was text-extracted in the session
scratchpad. Neither the PDF nor the extraction is committed.

### 2.3 What the walkthrough claimed, kept separate from what was verified

| Walkthrough claim (§5 / §6)                                                                                     | Verification in this packet                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "KDIGO 2026 draft rec. 5.1.1 (deferred timing, 1C)"                                                             | **Matches the draft.** Recommendation 5.1.1: for adults with AKI, a deferred initiation strategy over early (pre-emptive) initiation, graded 1C (PDF p38; chapter text p261). Still a draft.                                                                          |
| "KDIGO 2026 draft rec. 5.3.1 (1B)" for 20–25 mL/kg/h                                                            | **Matches the draft.** Recommendation 5.3.1: deliver an effluent volume of 20–25 ml/kg/h over higher volumes in adults receiving CRRT (or Kt/V 3.9/week for IRRT/PIRRT), 1B (PDF p39; p277).                                                                          |
| "KDIGO 2026 draft rec. 5.5.1 (1B)" citrate over heparin                                                         | **Matches the draft.** Recommendation 5.5.1: where available, regional citrate anticoagulation rather than heparin for children and adults on CRRT without contraindications to citrate, 1B (PDF p40; p292).                                                          |
| "KDIGO 2012 (1A)" dose; "KDIGO 2012 (2B)" citrate; "KDIGO 2012 (not graded)" access order                       | **Not verified.** KDIGO 2012 was not re-read. The registry lists sections 5.1.1, 5.1.2, 5.6.2, 5.8.1, 5.8.2 and 5.8.4 for `GUID-KDIGO-AKI-2012` without grades.                                                                                                       |
| Net UF "above about 1.75 mL/kg/h" associated with higher mortality (Murugan 2019)                               | **Matches the abstract as an association.** Highest tertile >1.75 vs lowest <1.01 mL/kg/h was associated with lower risk-adjusted 90-day survival in a RENAL secondary analysis; the authors state residual confounding and the need for RCTs. It is not a threshold. |
| FF "commonly taught ceiling (about 20–25%)"                                                                     | **No source found in the registry or the KDIGO draft** (the draft does not mention filtration fraction). Stays unverified teaching folklore until a source is named.                                                                                                  |
| Total/ionized calcium ratio "above about 2.5" suggests accumulation (Schneider 2017)                            | **Not verified.** Full text not re-read. The registered claim for `CITRATE-ICU-GUIDE-2026-SAFETY` mentions the ratio without a number.                                                                                                                                |
| KDIGO 2026 draft "keeps the 20–25 mL/kg/h effluent recommendation and recommends regional citrate over heparin" | Consistent with the draft as read. Both remain **draft** statements.                                                                                                                                                                                                  |
| "If both readings carry the same correction it cancels in the difference" (−25 mmHg)                            | This is one of the interpretations laid out in §7. The manual does not settle it.                                                                                                                                                                                     |

---

## 3. Decision summary (one screen)

| ID        | Decision requested (short)                                                                                            | Recommended reviewer                         | Bounded options                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| O-01      | Keep all evolving chemistry suppressed, or authorize one reviewed pilot solute model once named inputs are supplied?  | Nephrologist + CRRT pharmacist               | A. keep suppressed, teach with supplied values · B. two-solute pilot (K, HCO₃) in CRRT-02 only            |
| O-02      | Are CRRT-11 (and its three clones) planning exercises over abstract indices, or should they show a reviewed response? | Nephrologist/ICU faculty + CRRT nurse        | A. planning exercise, reframed · B. reviewed synthetic authored trend · C. source-backed physiology later |
| O-03      | Which predilution/FF expression or concept should the module teach?                                                   | Nephrology/device SME                        | A. concept only · B. PrisMax FF Blood% · C. PrisMax FF Plasma% · D. a textbook FF definition              |
| O-04      | Where is PrisMax's −25 mmHg correction applied, and what is shown when no blood flows?                                | Experienced PrisMax operator + nephrology    | Answer the console observation question in §7                                                             |
| O-04T     | Is the TMP −18 mmHg term a display-formula term or a correction to the readings? (kept separate)                      | Experienced PrisMax operator                 | Answer the console observation question in §7                                                             |
| O-05C     | Minimum evidence for the citrate-safety case (CRRT-17)                                                                | Nephrology + CRRT pharmacist                 | A. recognition-only with supplied single value · B. reviewed authored series (storyboard B1)              |
| O-05R     | Minimum evidence for the renal-recovery case (CRRT-18)                                                                | Nephrology                                   | A. workflow-separation only · B. reviewed authored series (storyboard B2)                                 |
| O-06      | Recurrent filter loss: history-based plan, or a real simulated intervention?                                          | Nephrology + experienced CRRT nurse          | A. keep plan-only, labeled · B. specify a simulated event (storyboard B3)                                 |
| O-07      | Dose, timing and anticoagulation orientation: which statements, from which evidence tier?                             | Nephrology/faculty                           | Approve the tier table in §10 per row                                                                     |
| O-08      | Net UF, citrate monitoring and numeric anchors: include numbers with context, or withhold?                            | Nephrology/ICU faculty + pharmacist          | Per-number disposition in §11                                                                             |
| O-09      | Device alarm mapping, workflow, fluids and access                                                                     | PrisMax SME/CRRT nurse + pharmacy/nephrology | A. keep generic alerts unmapped · B. map named families from §12                                          |
| O-10      | Smallest set of next content/model changes                                                                            | Owner + faculty/learners/media reviewer      | Choose from §13                                                                                           |
| E-01–E-10 | Ten weak-item rewrites                                                                                                | Nephrology/ICU faculty                       | Approve / edit / reject each line (§14)                                                                   |
| F-01      | Lesson-5 presentation                                                                                                 | Owner                                        | A. status quo · B. split · C. resume point (§15)                                                          |
| O-02b     | CRRT-13: should the corrective pause–reposition–resume consume an authored interval?                                  | Experienced CRRT nurse + faculty             | A. keep same-time correction (zero downtime) · B. approve an authored interval (§5)                       |

Queue IDs: O-nn → `CRRT-F05-Onn`; O-02b → `CRRT-F05-O02-CRRT13`; O-04T → `CRRT-F05-O04-TMP`;
O-05C → `CRRT-F05-O05-CITRATE`; O-05R → `CRRT-F05-O05-RECOVERY`; G-nn → `CRRT-F05-Gnn`;
E-nn → `CRRT-F05-Enn`; F-01 → `CRRT-F05-F01`. Thirty-four items in all.

---

## 4. O-01 — clinical chemistry model

### At a glance

| Question                  | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What the learner sees now | The supplied case-start labs with their units, labeled "Supplied labs at case start" / "not modeled over time" (patient strip) and "Laboratory values in this case" (debrief), with the inputs the simulator lacks named. No evolving sodium, potassium, bicarbonate, urea, creatinine, phosphate or magnesium value is shown anywhere, and none can be a scored success condition. CRRT-05's worked comparison still prints a "small-solute marker" with a caption that it is a model pool, not a laboratory value. |
| What the engine does      | Runs a correct constant-volume mass balance for seven pools. In every one of the 18 cases, production, external input and pool residual clearance are 0, and no solution composition can be declared, so every pool decays toward zero whenever effluent flows. This arithmetic is kept as engine state but contained at every learner and scoring boundary.                                                                                                                                                         |
| What source exists        | None for any solution composition in the registry. The KDIGO 2026 **draft** contains a table of representative commercial solutions (Table 53, PDF p312) — a draft table, not a product record. Case-start values are synthetic teaching calibration (`SYNTH-CRRT-nn`).                                                                                                                                                                                                                                              |
| What is missing           | Exact solution products and compositions; distribution volume per solute; endogenous production; external solute inputs; residual renal clearance linked to pools; sieving/saturation per solute and membrane; the flux equation form (removal-only versus exchange toward solution concentration); unit conversions requiring molar masses; case endpoints; conservation tests.                                                                                                                                     |
| Option A                  | Keep every evolving chemistry output suppressed. Teach chemistry with supplied values, worked explanations and named sources only.                                                                                                                                                                                                                                                                                                                                                                                   |
| Option B                  | Authorize one bounded pilot: potassium and bicarbonate in CRRT-02 only, after the inputs in the specification below are supplied and the conservation tests pass. Everything else stays suppressed.                                                                                                                                                                                                                                                                                                                  |
| **Decision requested**    | **Should the next step be A (keep suppressed) or B (a reviewed K/HCO₃ pilot in CRRT-02)? If B, which exact dialysate product (manufacturer, product name, label revision) should CRRT-02 use, and who will supply its composition record?**                                                                                                                                                                                                                                                                          |

### Current implementation (exact)

- Equation (`engine/soluteModel.ts` `advanceSolutePool`): with amount `A = C·V`, source `S = G + I`
  (production + input, per hour) and total clearance `K = K_r + K_crrt` (mL/min × 0.06 → L/h),
  `A(t) = A₀·e^(−kt) + (S/k)(1 − e^(−kt))`, `k = K/V`. With `k = 0` the pool accumulates `S·t`.
  The code is correct and was deliberately left untouched by Batches 01–04.
- Delivered clearance (`calculateDeliveredSoluteClearanceMlMin`):
  `K_crrt = Q_eff,actual × permeability × filterInletFraction / 60`, where `Q_eff,actual` is the
  **total** effluent target times the delivery fraction (it includes net removal, PBP, replacement
  and dialysate). This is an effluent-based clearance approximation; it has no separate diffusive
  saturation and no convective sieving term.
- There is no solution concentration term. Removal is toward zero.
- Validity boundary (`engine/soluteValidity.ts`): every pool reports `status: 'unsupported'` with
  missing inputs `solution-concentration` and `reviewed-source-term-specification`. The boundary
  deliberately ignores numbers: a future reviewed model must replace it on purpose.
- Scoring boundary: `readAllowlistedCrrtMetric` throws for `patient.solutes.*.concentrationPerLiter`;
  `collectCrrtCaseSemanticIssues` rejects a case that scores a solute, and rejects any case that
  carries `solutionProfileIds` ("Solution profiles cannot be normalized before a reviewed solution
  registry exists").
- Solution representation: `BagState` (`engine/types.ts`) has identity, `flowTerm`, direction,
  volumes, connection and scale fields only — **no composition field**. A "dialysate bag" is a flow
  label, not a product.

### Supplied inputs in all 18 cases (probe at `85acc113`)

| Field                               | Value in every case                                                                        | Note                                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pools                               | Na, K, HCO₃, urea marker (mmol/L); creatinine marker, phosphate, Mg (mg/L internally)      | Authored mg/dL × 10 → mg/L. Displayed values remain the authored mg/dL values.                                                                                              |
| Distribution volume                 | One volume for all seven pools: 40 L (review-case template) or 42 L (pilot cases 04/10/13) | Not solute-specific.                                                                                                                                                        |
| Production `G`, input `I`           | 0 for every pool in every case                                                             | Numeric zero; not a reviewed "explicit zero" assumption.                                                                                                                    |
| Pool residual clearance             | 0 mL/min for every pool                                                                    | The patient-level `residualKidneyClearanceMlMin` is 2 mL/min in CRRT-10 and 0 elsewhere, **but it is not read by the solute step**. Pool and patient values are not linked. |
| Permeability fraction               | Na 0.95; K, HCO₃, urea marker 1.0; creatinine marker, phosphate 0.9; Mg 0.85               | Authored coefficients, source `SYNTH-*`, pending.                                                                                                                           |
| Filter-inlet concentration fraction | 1 (constant)                                                                               | Predilution cannot change it; entangled with O-03.                                                                                                                          |
| Total calcium                       | `null` (engine `totalCalciumMmolL`)                                                        | No calcium pool exists; systemic ionized calcium is a single supplied scalar per case.                                                                                      |
| pH                                  | Supplied scalar per case                                                                   | Not calculated. Bicarbonate mass balance is not pH.                                                                                                                         |

### Case endpoints that depend on chemistry

| Case    | Chemistry the case claims or implies                                                                     | Current state                                                                                            |
| ------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| CRRT-02 | Hyperkalemia (K 6.9) and acidemia (pH 7.08, HCO₃ 10): the walkthrough expects K to fall and HCO₃ to rise | Supplied values only; trajectory contained.                                                              |
| CRRT-03 | "Controlled solute trajectory in acute brain or liver failure" (a sodium-rate objective)                 | **Same seed as CRRT-02.** No sodium-control input exists. Not walked by the report; not reproduced here. |
| CRRT-12 | "Electrolyte, temperature, medication, and nutrition consequences"                                       | Adapted from CRRT-11; see §17 (evidence-scope gap).                                                      |
| CRRT-17 | Citrate–calcium safety                                                                                   | One systemic iCa; see O-05.                                                                              |
| CRRT-18 | Renal recovery (creatinine, urine)                                                                       | One creatinine value, constant urine; see O-05.                                                          |
| Others  | Chemistry is context, not the objective                                                                  | Supplied values suffice for the objective.                                                               |

### Artifact A — chemistry and solution-model specification outline (not an implementation)

This outline names what a reviewed model would need. It sets no coefficient and no trend.

**A.1 Scope decision first.** Which solutes, which cases, and which outputs would be shown. Until
that is decided, the outputs in A.4 stay suppressed.

**A.2 Proposed modeled variables**

| Variable                                    | Unit                                | Compartment                                                    | Role in the equations                                  | Supplied or calculated                                                  | Required source                                                                                                                        | If missing                                                             | Invariant/conservation test required                                                                  |
| ------------------------------------------- | ----------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `C_p,i` patient concentration, solute _i_   | mmol/L (mg/dL shown for mg solutes) | Patient (single pool unless decided otherwise)                 | State                                                  | Supplied at t₀; calculated after                                        | Case record (synthetic, `SYNTH-CRRT-nn`) for t₀                                                                                        | Case cannot run chemistry                                              | Amount closure: `A_end = A_start + ∫(G+I)dt − removed_CRRT − removed_renal` within a stated tolerance |
| `V_d,i` distribution volume                 | L                                   | Patient                                                        | Divides amount into concentration                      | Supplied per solute                                                     | Reviewed physiology/pharmacology reference per solute, with the population and the body-weight basis stated                            | Suppress that solute                                                   | `V > 0`; results reported with the volume used                                                        |
| `G_i` endogenous production/release         | mmol/h or mg/h                      | Patient                                                        | Source term                                            | Supplied                                                                | Reviewed reference per marker (urea, creatinine, potassium release), with population and assumption                                    | Suppress; a zero must be a flagged, reviewed assumption, not a default | Zero-clearance run accumulates exactly `G·t`                                                          |
| `I_i` external input                        | mmol/h                              | Patient                                                        | Source term                                            | Supplied, tied to the fluid ledger's inputs                             | Composition of each external fluid (maintenance, nutrition, medication carriers, calcium or citrate infusions) from the product record | Suppress                                                               | Input fluid volume in the ledger and solute input share one source record                             |
| `K_r,i` residual renal clearance            | mL/min                              | Patient                                                        | Sink                                                   | Supplied; **must be linked** to the patient-level field                 | Case record, reviewed                                                                                                                  | Suppress                                                               | Pool value equals the patient value (or a stated per-solute fraction of it)                           |
| `C_s,i,k` solution concentration, fluid _k_ | mmol/L                              | Circuit fluid (dialysate, pre-/post-replacement, PBP, syringe) | Boundary condition for exchange                        | Supplied                                                                | **Exact product record**: manufacturer, product name, label/formulary revision. No generic "standard bag".                             | Suppress every solute that fluid carries                               | Product identity check; each bag's `flowTerm` and product agree                                       |
| `Q_k` flows                                 | mL/h (Qb mL/min)                    | Circuit                                                        | Drives exchange                                        | Supplied by prescription (exists)                                       | Existing prescription                                                                                                                  | n/a                                                                    | Existing fluid-ledger conservation tests                                                              |
| Entry site of fluid _k_                     | categorical                         | Circuit                                                        | Determines dilution before the filter                  | Supplied (exists as `flowTerm`)                                         | Existing circuit model; dilution effect held by O-03                                                                                   | Treat predilution as unmodeled                                         | Pre/post split changes only what O-03 authorizes                                                      |
| `S_i` sieving / saturation coefficient      | dimensionless                       | Membrane                                                       | Scales convective/diffusive removal                    | Supplied per solute and membrane (replaces today's single permeability) | Filter-specific data (manufacturer) or reviewed reference                                                                              | Suppress                                                               | Coefficient within [0, 1]; source recorded                                                            |
| Filter-inlet fraction                       | dimensionless                       | Circuit                                                        | Reduces concentration at the membrane with predilution | Calculated only if O-03 authorizes an expression                        | O-03 decision                                                                                                                          | Constant 1 (current), stated as unmodeled                              | Equals 1 with no predilution                                                                          |
| Flux equation form                          | —                                   | Circuit–patient                                                | Removal-only, or exchange toward `C_s`                 | Decision                                                                | A named reviewed source for the form used                                                                                              | Keep current containment                                               | Equilibrium: with `G = I = K_r = 0`, `C_p → C_s` monotonically and never crosses it                   |
| Delivery state                              | categorical                         | Device                                                         | Gates exchange                                         | Existing                                                                | Existing                                                                                                                               | n/a                                                                    | Paused or stopped: CRRT flux exactly zero; segmentation (3 × 1 h = 1 × 3 h) holds                     |

**A.3 Deliberately out of scope unless separately decided:** pH and any acid–base calculation
beyond bicarbonate mass; calcium, citrate and their kinetics (O-05); lactate; glucose; drug
clearance; nutrition losses; temperature. The urea marker stays a marker; it is not converted to
BUN (a new clinical claim, not a relabel).

**A.4 Outputs that must stay suppressed until a validated model exists:** every evolving value of
the seven pools on every surface (patient strip, debrief, worked comparison, evidence panel);
any solute-based success condition or verdict; any pH, calcium or creatinine trend; any
"recovery" or "correction" wording derived from a pool.

**A.5 Tests a reviewed model must pass before any output is shown:** amount closure per solute and
per step; equilibrium toward the solution concentration; zero flux when not delivering; exact step
segmentation; matched-time arms (no action, intended, harmful, recovery) at equal elapsed time;
unit round-trips (any mmol ↔ mg conversion needs a sourced molar mass); explicit-zero provenance
(no silent zero); and a per-case endpoint test for each case whose objective depends on chemistry.

---

## 5. O-02 — tolerance cases

### At a glance

| Question                  | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What the learner sees now | CRRT-11's task says the signals that separate paths are bounded model indices and the fluid ledger, not a blood pressure. Before any reveal it lists what is absent: any MAP, heart-rate or vasopressor response, and any lactate or perfusion marker. The debrief shows "Bounded model indices this run advanced" and "Patient signals this exercise holds at the supplied value", with the sentence that an unchanged MAP is not evidence that a rate was tolerated. |
| What the engine does      | `advancePatientFluidTolerance` spends an intravascular reserve when net removal exceeds a refill capacity, then raises a bounded stress index. It never writes MAP, heart rate or vasopressor index. Reserve is spent and never refilled.                                                                                                                                                                                                                              |
| What source exists        | Supplied values and coefficients are `SYNTH-CRRT-11` (synthetic, pending). `GUID-RRT-ICU-2026` and `GONEUTRAL-2024` are registered for reassessment context only. No registered source supports any blood-pressure or vasopressor response coefficient.                                                                                                                                                                                                                |
| What is missing           | Any source-backed hemodynamic response to net ultrafiltration; any perfusion marker; a reviewed authored series if one is wanted.                                                                                                                                                                                                                                                                                                                                      |
| Option A                  | Keep CRRT-11 as a **planning exercise** with abstract indices, and say so in its title and goal.                                                                                                                                                                                                                                                                                                                                                                       |
| Option B                  | Add a **reviewed synthetic authored trend** (supplied case evidence, labeled as authored, not a model response) for named paths only.                                                                                                                                                                                                                                                                                                                                  |
| Option C                  | Implement **source-backed physiology later**, only after a named source and reviewed coefficients exist.                                                                                                                                                                                                                                                                                                                                                               |
| **Decision requested**    | **Is CRRT-11 a planning exercise (A), a case with a reviewed authored trend (B), or deferred until a physiology source exists (C)? If B, which paths get a series, at which elapsed times, and who supplies the values?**                                                                                                                                                                                                                                              |

### What each signal is in CRRT-11 (fixture at `85acc113`)

| Signal                         | Kind                          | Value / behavior                                                                                                  | Source                          |
| ------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| MAP 59 mmHg, HR 122/min        | Supplied, held                | Never changes in any run                                                                                          | `SYNTH-CRRT-11`                 |
| Vasopressor support index 0.85 | Supplied abstract index, held | Never changes                                                                                                     | `SYNTH-CRRT-11`                 |
| Intravascular reserve          | Abstract model quantity       | Starts 100 mL; spent at (net removal − refill 80 mL/h); never refilled                                            | `SYNTH-CRRT-11`                 |
| Tolerance-stress index         | Abstract bounded index (0–1)  | Starts 0.72; rises 0.4 per liter of uncompensated removal; falls 0.12/h only while removal does not exceed refill | `SYNTH-CRRT-11`                 |
| Whole-patient balance          | Ledger (calculated)           | Machine removal plus supplied external rates (medication carrier 25 mL/h in; urine 5 mL/h out)                    | `SYNTH-CRRT-11`, `FLUID-PM-001` |
| Pressure / fault evidence      | Not the case's phenomenon     | No scheduled fault                                                                                                | —                               |
| Absent physiology              | Not modeled                   | MAP, HR, vasopressor dose, lactate, perfusion                                                                     | —                               |

### Matched-time results already on record (Batch 02 handoff §2; sanity review "Matched-time causal results")

CRRT-11, identical fixture and seed, 7,200 simulated seconds:

| Path                                       | Stress index | Reserve left | Whole-patient balance | MAP |
| ------------------------------------------ | -----------: | -----------: | --------------------: | --: |
| No intervention                            |        0.760 |         0 mL |               −320 mL |  59 |
| Assessment only                            |        0.760 |         0 mL |               −320 mL |  59 |
| Reduce removal (includes the authored 1 h) |        0.480 |       100 mL |                −20 mL |  59 |
| Pause removal (alternative; includes 1 h)  |        0.480 |       100 mL |                +40 mL |  59 |
| Increase removal to 320 mL/h               |        0.872 |         0 mL |               −600 mL |  59 |

At three matched hours: no action 0.800 / −480 mL; reduce 0.360 / −30 mL; increase 0.968 / −900 mL.

CRRT-13 (a pressure/fault case, listed because the walkthrough paired it with CRRT-11) at the
30-minute authored worsening point: access pressure −139 mmHg untreated, diagnostic-only or
acknowledgement-only; **−211 mmHg** after raising blood flow through the obstruction; **−25 mmHg**
after pause → reposition → resume → confirm. The fault and generic alert persist on every path
except correction. Delivered dose 22.14 mL/kg/h and zero downtime on every same-time path; advancing
10 minutes while paused yields 16.61 mL/kg/h and 10 min downtime. So CRRT-13's harmful path is
already distinguishable by pressure, fault and two authored critical errors; its open question is
only whether the corrective sequence should carry an **authored elapsed interval** (none exists; the
unread `latencySeconds` metadata does not count).

### Consequences for existing activities

| Option | CRRT-11                                                                          | CRRT-12, CRRT-17, CRRT-18 (same CRRT-11 seed)                      | Learn L7 (`net-observe`, CRRT-10 guided run) | Challenge |
| ------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------- | --------- |
| A      | Retitle/goal wording only; no numbers change                                     | None                                                               | Keep "bounded teaching proxies" wording      | None      |
| B      | New authored evidence series and its source record; debrief shows it as supplied | Must not inherit the series silently (each needs its own decision) | Unchanged unless separately chosen           | None      |
| C      | Blocked until a physiology source and coefficients are reviewed                  | Same                                                               | Same                                         | Same      |

Not proposed: any MAP or pressor coefficient, any "unsafe above" rate, any penalty added only to
make the harmful path look worse.

---

## 6. O-03 — predilution and filtration fraction

### At a glance

| Question                  | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What the learner sees now | CRRT-05 says, before any reveal, that the flow split is real and that the clearance consequence of pre-filter dilution is not modeled; it lists "Filtration fraction for each split" and "Concentration of blood reaching the filter" as absent. Lesson 4 says "Not calculated here: filtration fraction", citing CONFLICT-002 (manual p220) and CONFLICT-001 (manual p218).                                                                                                |
| What the engine does      | Carries filtration fraction as a fixed authored coefficient (0.1 or 0.2 per case) that feeds only the filter-burden model; holds the filter-inlet concentration fraction at 1. The two PrisMax FF functions in `engine/clinicalMath.ts` exist but are wired to nothing.                                                                                                                                                                                                     |
| CRRT-05 matched result    | Moving 900 of 1,200 mL/h to pre-filter: at 1 h and 6 h **only** the pre- and post-filter flows differ. Dose, delivered dose, effluent, balance, FF, all pressures, TMP, filter drop, burden terms and pools are bit-identical.                                                                                                                                                                                                                                              |
| What source exists        | PrisMax manual PDF p219 (manual p218) and p221 (manual p220): total predilution, FF Blood %, FF Plasma %, PreREP %, post-filter hematocrit, Qufpost, Qpre — two held as conflicts. `REVIEW-CKRT-CORE-2025` (audited topic: solute-transport mechanisms) supports the qualitative predilution/hemoconcentration statement. KDIGO 2026 **draft** Practice Point 5.6.2 lists predilution hemofiltration among non-pharmacologic strategies for circuit life (ungraded, draft). |
| What is missing           | An agreed teaching expression; a resolution of CONFLICT-001 and CONFLICT-002; a registered source for any generic FF definition; a decision on whether predilution should change clearance in the engine.                                                                                                                                                                                                                                                                   |
| **Decision requested**    | **Which concept or expression should the module teach for predilution and filtration fraction — (A) a qualitative concept only, (B) PrisMax "FF Blood %", (C) PrisMax "FF Plasma %", or (D) a generic textbook definition you name — and should any of them be calculated live?**                                                                                                                                                                                           |

### Artifact C — predilution / filtration-fraction comparison sheet

Where the fluids enter (circuit model): PBP enters before the blood pump; pre-filter replacement
after the pump and before the filter; post-filter replacement after the filter, before return;
dialysate runs countercurrent on the fluid side (it never enters blood); syringe is a separate flow
term whose infusion site the registry does not establish; makeup is an effluent-side term whose
patient-ledger role is unresolved (`CONFLICT-CRRT-MAKEUP-001`).

Symbols as printed by PrisMax (PDF pp219–221): `Qb` blood flow (set in mL/min; the equations need
mL/h), `Hct` in percent, `Qpbp`, `Qrep` (total replacement), `Qrep_pre`, `Qrep_post`, `Qpfr`
(net patient fluid removal), `Qsyr`, `Qeff`, `Qplasma`, `Qpre`, `Fp`.

| #   | Expression (as printed, or as named)                                                 | Locator                                               | Numerator                                                                                                          | Denominator                      | Plasma or blood                                     | Hct enters?   | Pre/post handling                     | Status in the module                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------- | --------------------------------------------------- | ------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `PRE%tot = (Qpbp + Qrep_pre) / (Qpbp + Qrep)`                                        | PDF p219 (manual p218), `MATH-PM-003`                 | Pre-filter dilution flows                                                                                          | PBP + all replacement            | Neither (a flow ratio)                              | No            | Defines the split                     | Implemented (`calculatePrismaxTotalPredilutionFraction`), unwired                                                                                                                             |
| 2   | `FF Blood % = 100 × (Qrep_post + Qpfr + Qsyr) / (Qplasma + Qpre)`                    | PDF p219, `MATH-PM-003`                               | Post-filter replacement + net removal + syringe                                                                    | Plasma flow + pre-infusion flow  | Denominator is **plasma** despite the "Blood" label | Via `Qplasma` | Needs `Qpre` (CONFLICT-002)           | Implemented with an explicit `Qpre` input, unwired                                                                                                                                            |
| 3   | `FF Plasma % = 100 × Qeff / (Qplasma × 0.95 + Qpre)`                                 | PDF p219, `MATH-PM-003`/`-005`                        | `Qeff` — as defined at PDF p218 this **includes dialysate** (`Qeff = Qpfr + Qpbp + Qrep + Qdial + Qsyr + Qmakeup`) | Plasma water + pre-infusion flow | Plasma water (×0.95)                                | Via `Qplasma` | Needs `Qpre` (CONFLICT-002)           | Implemented with explicit `Qpre` and plasma-water inputs, unwired                                                                                                                             |
| 4   | `Qplasma = (1 − Hct/100) × Qb`                                                       | PDF p219                                              | —                                                                                                                  | —                                | Plasma                                              | Yes           | —                                     | Implemented (`calculatePlasmaFlowMlPerHour`)                                                                                                                                                  |
| 5   | `Qplasma = [1 − (Hct/100)] × Qb × Fp`, `Fp = 0.95` (headed "Plasma water flow rate") | PDF p220 (manual p219), `MATH-PM-005`                 | —                                                                                                                  | —                                | Plasma water                                        | Yes           | —                                     | Not implemented; **conflicts with row 4's use of the same symbol**                                                                                                                            |
| 6   | `PreREP % = Qrep_pre / Qrep`                                                         | PDF p219                                              | Pre-filter replacement                                                                                             | Total replacement                | Neither                                             | No            | Replacement split only                | Not implemented                                                                                                                                                                               |
| 7   | `Hctpost = (Qb × Hct) / (Qb − Qufpost)`                                              | PDF p219                                              | —                                                                                                                  | —                                | Whole blood                                         | Yes           | Depends on `Qufpost`                  | Not implemented                                                                                                                                                                               |
| 8   | `Qufpost = Qrep_post − Qpfr`                                                         | PDF p219, `MATH-PM-004`                               | —                                                                                                                  | —                                | —                                                   | No            | Post-filter UF                        | **CONFLICT-001**: the minus sign disagrees with the `+ Qpfr` in row 2's numerator; gate disabled                                                                                              |
| 9   | `Qpre = Qpbp + Qrep (PRE% / 100) × Qsyr`                                             | PDF p221 (manual p220), `MATH-PM-006`                 | —                                                                                                                  | —                                | —                                                   | No            | Defines the pre-infusion term         | **CONFLICT-002**: an operator appears to be missing (flow × flow is dimensionally inconsistent), and it does not say whether `PRE%` is row 1's `PRE%tot` or row 6's `PreREP %`; gate disabled |
| 10  | Generic "FF = ultrafiltration / plasma flow" and the "20–25% ceiling"                | **No registered source**; not in the KDIGO 2026 draft | —                                                                                                                  | —                                | Usually plasma                                      | Usually       | Predilution variants differ by author | Named by the walkthrough only ("textbook / device literature")                                                                                                                                |

Readings the manual leaves open (not resolved here):

- Row 2's label says "Blood" but its denominator is plasma plus pre-infusion flow.
- Row 3's numerator, read literally with the PDF p218 definition of `Qeff`, counts dialysate flow
  as filtrate. Whether FF Plasma is meant to use total effluent or only the convective part is not
  stated.
- Rows 4 and 5 give two definitions of `Qplasma`. Substituting row 5 into row 3 would apply 0.95
  twice.
- Units: `Qb` is set in mL/min and must be converted before any row that mixes it with mL/h flows;
  `Hct` is printed in percent, while the engine stores a fraction.

Current engine behavior, for contrast: FF = authored constant (`SYNTH-*`) used only as a
filter-burden weight; filter-inlet concentration fraction = 1; neither responds to the split.

What each option would change:

| Option | Engine                                                                                                                          | Learner surfaces                                                             | Holds                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------- |
| A      | Nothing                                                                                                                         | CRRT-05, L3–L4 keep the qualitative contrast with its source                 | CONFLICT-001/002 stay                        |
| B / C  | Wire one PrisMax expression **only after** CONFLICT-002 is resolved by a device reviewer; FF would then vary with flows and Hct | CRRT-05, L4, CRRT-15/16 domain tables show a calculated FF                   | Resolve CONFLICT-002 (and -001 for Hctpost)  |
| D      | A generic FF calculation beside (not replacing) the device display                                                              | Needs a registered source and a statement that it is not the PrisMax display | CONFLICT-001/002 stay for the device display |

Not proposed: a universal FF threshold, a predilution clearance penalty, or any filter-life effect.
A decision to model predilution's effect on clearance is separate from choosing a display
expression, and would also need the O-01 inputs.

---

## 7. O-04 — the −25 mmHg correction, the TMP −18 mmHg term, and paused validity

### At a glance

| Question                  | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What the learner sees now | Beside the TMP and filter-drop readings, the arithmetic is laid out with each correction as its own bracketed term: `(50 + 20) ÷ 2 − (−20) + (−18) = 37 mmHg` and `(50 − 20) + (−25) = 5 mmHg`, with "Filter − return, before correction 30 mmHg". The −25 term is labeled "Correction applied by this simulation · placement held for device review". With no blood flowing, both calculated values stay visible with "not interpretable without blood flow". |
| What the engine does      | Displays the four monitored sites as raw values (`inputConvention: 'raw-sensor'`). Displayed filter drop = (raw filter − raw return) − 25. Displayed TMP = (raw filter + raw return)/2 − raw effluent − 18. With zero flow the model makes filter equal return, so the drop reads exactly −25 and TMP reads 7 in the untouched CRRT-04 run.                                                                                                                    |
| What source exists        | Manual PDF p203 (manual p202), `DEV-PM-010`; PDF pp218–219 (manual pp217–218), `MATH-PM-002`. Hold: `G01-CRRT-02` (NOT REVIEWED).                                                                                                                                                                                                                                                                                                                              |
| What is missing           | Console behavior on a PrisMax running program 2.XX (or the program the module should describe, `G01-CRRT-04`).                                                                                                                                                                                                                                                                                                                                                 |
| **Decision requested**    | **Answer the console observation question below. The simulation will then be kept or changed to match; this packet does not choose.**                                                                                                                                                                                                                                                                                                                          |

### Artifact D (part 1) — device-offset sheet

**Document:** PrisMax Operator's Manual AW8035 Rev B JUN2019, program version 2.XX
(`PRISMAX-AW8035-RB`), SHA-256 verified.

**Filter pressure drop — PDF p203 (manual p202), `DEV-PM-010`.**
Printed expression: `∆Pfil = Pfil − Pret` (all mmHg). The next paragraph states that a hydrostatic
bias arises because the sensors sit at different heights, and that the filter and return pressure
readings are "automatically corrected for this bias of -25 mmHg". No −25 term appears in the printed
drop expression.

**TMP — PDF p218 (manual p217) and PDF p219 (manual p218), `MATH-PM-002`.**
Printed expression: `TMP = [(Pfil + Pret) / 2] − Peff − 18 mmHg`. The first sentence of the next
page (PDF p219) says the software automatically corrects the **filter and effluent** pressures by
−18 mmHg for hydrostatic biases. This sentence is not recorded in `G01-CRRT-01`, whose limitation
says the manual prints the −18 term without naming it. That record is **not edited here**; this is
a new locator for the reviewer. Also on PDF p219: TMP rise above its initial value contributes to
the filter-clotting alarm, and an alarm occurs if TMP exceeds +300 mmHg.

**Terms, kept distinct**

| Term               | In the manual                                      | In the simulation today                                                                                                                                     |
| ------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw pressure       | Not named as such                                  | `rawFilterPressureMmHg`, `rawReturnPressureMmHg`, `rawEffluentPressureMmHg` (model inputs)                                                                  |
| Displayed pressure | The Operations-screen values                       | The four site tiles show the raw values                                                                                                                     |
| Corrected reading  | Filter and return (−25); filter and effluent (−18) | None: no tile is corrected                                                                                                                                  |
| Derived gradient   | `∆Pfil`, TMP                                       | `displayedPressureDropMmHg`, `prismaxTransmembranePressureMmHg`                                                                                             |
| Correction term    | "bias of −25 mmHg"; "−18 mmHg"                     | `PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG = −25` added to the drop; `PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG = −18` added to TMP (`engine/pressureModel.ts`) |
| Flow state         | Not stated for either expression                   | `selectCrrtCalculatedPressureValidity` → `no-flow-through-circuit` for TMP and drop when actual blood flow is 0; the four sites stay `supported`            |

**Competing interpretations of the −25 mmHg (not resolved)**

| #   | Interpretation                                                                   | Displayed filter / return tiles for raw 50 / 20 | Displayed drop | Displayed drop = displayed filter − displayed return? |
| --- | -------------------------------------------------------------------------------- | ----------------------------------------------- | -------------- | ----------------------------------------------------- |
| I1  | Current simulation: tiles are raw; −25 is added to their difference              | 50 / 20                                         | 5              | **No** — differs by 25                                |
| I2  | Each reading is corrected by the same −25 mmHg (the walkthrough's reading)       | 25 / −5                                         | 30 (cancels)   | Yes                                                   |
| I3  | The bias is between the two sensors, so one reading carries the whole correction | 25 / 20 (if the filter reading carries it)      | 5              | Yes                                                   |

The raw 50 / 20 pair is the walkthrough's worked example, used only to show the arithmetic. I3's
direction (which reading, which sign) is not stated in the manual and is shown only as one example.

A model fact that matters to every interpretation: the simulation's raw readings contain no
hydrostatic bias at all. With zero blood flow `calculateSyntheticBloodCircuitPressures` makes raw
filter pressure equal raw return pressure by construction, so a correction applied to the
difference produces a stopped-flow drop of −25 mmHg. The manual describes the correction as removing
a bias caused by sensor height; whether the raw-reading generator should carry that bias is part of
the same decision.

**The console observation that decides it (for an experienced PrisMax operator):**

> On a PrisMax running program 2.XX during CRRT with blood flowing, read the Operations screen:
> (1) Does the displayed filter pressure drop equal the displayed filter pressure minus the
> displayed return pressure, or does it differ from that difference by 25 mmHg?
> (2) With the blood pump stopped (paused, before connection, or during an alarm), what does the
> screen show for filter pressure drop and for TMP: a number (which?), a blank or dash, or nothing?

Answer (1) "differs by 25" supports I1; "equal" rules out I1 but does not separate I2 from I3.
A stopped-pump value from (2) should be recorded as observed, but this packet does not infer I2
versus I3 from it: what a real sensor pair reads at zero flow depends on the height bias the
manual describes and does not quantify at zero flow. Baxter documentation stating which reading
carries the correction would separate I2 from I3. Answer (2) also settles what the simulation should
display when no blood flows.

**TMP −18 mmHg (kept separate: `O-04T`)**

> Does the displayed TMP equal [(displayed filter + displayed return)/2] − displayed effluent −
> 18 mmHg, or are the displayed filter and effluent pressures already corrected by −18 mmHg?

The two readings of the manual are not algebraically the same: if the filter and effluent
readings were each corrected by −18 before the printed expression, TMP would move by +9 mmHg, not
−18. This packet does not decide which.

**What changes after each answer (for scoping only)**

| Answer                       | Change needed                                                                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Console matches I1           | None to arithmetic; lift the "placement held" wording after a recorded decision                                                                                                          |
| Console matches I2 or I3     | `engine/pressureModel.ts`, the pressure-arithmetic layout, circuit derivation chip, glossary entry and the tests that pin 5 / 37 / −25 values; the live profile and trend history labels |
| Paused values shown as blank | Keep the numbers internal, show "—" for TMP and drop while not flowing (currently shown with a validity note)                                                                            |

Carried hold: `G01-CRRT-02` stays NOT REVIEWED; `G01-CRRT-04` (which program version the module
describes) stays open. No console observation is claimed here.

---

## 8. O-05 — citrate safety and renal-recovery evidence

Two linked decisions. Both cases (CRRT-17, CRRT-18) run the **same fixture and seed as CRRT-11**;
their engine quantities are byte-identical to CRRT-11 at matched times (Batch 02 §2).

### 8.1 Citrate safety (CRRT-17) — at a glance

| Question                  | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What the learner sees now | Before any reveal, an evidence-scope block shows the one supplied systemic ionized calcium (1.05 mmol/L, case start, `SYNTH-CRRT-17`), total calcium "Not supplied", bicarbonate and pH, and names five absent items: a post-filter (circuit) ionized calcium; serial calcium or any trend; a total/ionized relationship; citrate delivery or calcium replacement; the linked trend-direction display. It points to the source-backed four-pattern citrate comparison in Lesson 6. |
| What the engine does      | Nothing citrate-specific. The anticoagulation method type is `'none' \| 'systemic-concept'` — **there is no citrate method** — and runtime normalization sets `anticoagulation: 'none'` for every case, so the simulated circuit in CRRT-17 receives no citrate. `ConceptualCitrateState.linkedTrendDirections` is always `unknown`, never written, never rendered. No circuit-sample, citrate-dose or calcium-infusion field exists in the patient schema.                        |
| What source exists        | Registered: `CITRATE-SIAARTI-2023-MECHANISM`, `CITRATE-SIAARTI-2023-SAMPLING` (expert opinion), `CITRATE-SCHNEIDER-2017-METABOLISM`, `CITRATE-SCHNEIDER-2017-PATTERNS` (expert viewpoint), `CITRATE-ICU-GUIDE-2026-SAFETY` (guideline, German–Austrian). Outside, verified: German–Austrian recommendations 4.4 (Grade 0), 4.5 (Grade A), 4.6 (Grade B) — see §11. KDIGO 2026 draft Recommendation 5.5.1 (1B, draft) is about choosing citrate, not monitoring it.                 |
| What is missing           | Any serial values; the circuit sample; units for total calcium (the authored field is mg/dL, the engine field is mmol/L, and no molar-mass conversion is registered); the ratio definition; the citrate and calcium delivery records; the local protocol that defines targets.                                                                                                                                                                                                     |
| Option A                  | Keep CRRT-17 a **recognition** case over the single supplied value and the source-backed differential, renamed so it does not promise trends.                                                                                                                                                                                                                                                                                                                                      |
| Option B                  | Add a **reviewed authored evidence series** (storyboard B1), shown as supplied case evidence with sample identity, time and unit — not as a model output.                                                                                                                                                                                                                                                                                                                          |
| **Decision requested**    | **A or B? If B: which sample sites, units and time points; is the total/ionized ratio shown, and in which units; who supplies each value (sourced, or approved as a proposed synthetic teaching value)?**                                                                                                                                                                                                                                                                          |

### Storyboard B1 — citrate safety (for review; not built; no runtime trend)

Every `⟨…⟩` is unsupplied. Direction words cite the registered claim that supports them.

| Frame | Time   | Sample / record (identity required)                            | Value and unit                                                   | What the learner is asked                                             | Support for the direction or concept                                                                                                   |
| ----- | ------ | -------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | t₀     | Systemic ionized calcium (patient sample)                      | 1.05 mmol/L — **existing synthetic case value**, `SYNTH-CRRT-17` | Which compartment does this describe?                                 | `CITRATE-SIAARTI-2023-SAMPLING`: systemic iCa informs patient calcium support                                                          |
| 1     | t₀     | Post-filter ionized calcium (circuit sample)                   | `⟨PF-iCa t₀⟩` mmol/L                                             | Which question does this answer that frame 1's systemic value cannot? | Same record: post-filter iCa informs circuit effect                                                                                    |
| 1     | t₀     | Total calcium (patient sample)                                 | `⟨tCa t₀⟩` — unit to be decided (mmol/L or mg/dL)                | —                                                                     | —                                                                                                                                      |
| 1     | t₀     | Citrate delivery and calcium replacement (device/order record) | `⟨citrate dose⟩`, `⟨Ca infusion⟩` — protocol units               | What must be verified before reading any calcium value?               | Local protocol; `CITRATE-SCHNEIDER-2017-METABOLISM` (infusion sites vary with protocol)                                                |
| 2     | `⟨t₁⟩` | Same four records                                              | `⟨…⟩`                                                            | Which pattern is emerging?                                            | `CITRATE-ICU-GUIDE-2026-SAFETY`: accumulation may accompany increasing calcium requirements, a rising total/ionized ratio and acidosis |
| 2     | `⟨t₁⟩` | Bicarbonate, pH, anion gap or lactate                          | `⟨…⟩`                                                            | Accumulation, net citrate overload, or insufficient delivery?         | `CITRATE-SCHNEIDER-2017-PATTERNS` (the three patterns); German–Austrian Rec 4.4 (monitor lactate, ionized and total calcium)           |
| 3     | `⟨t₂⟩` | Treatment-delivery state (running, paused, downtime)           | From the run                                                     | Could a delivery interruption explain the change?                     | Existing delivered-therapy accounting                                                                                                  |
| 4     | —      | Worked plan                                                    | —                                                                | Escalate to the responsible team under the local protocol             | German–Austrian Rec 4.5 (Grade A) and 4.6 (Grade B) describe what a guideline recommends; the module still gives no dose               |

Values that would need your approval before B1 is built: every `⟨…⟩` above. The walkthrough's
"total/ionized ratio above about 2.5" is **not** verified here (§2.3) and is not proposed.

Consequences: B adds schema fields (circuit sample, series, units) and a source record per value;
it does not add citrate physiology to the engine. The Lesson 6 differential, the drills and
CRRT-11/12/18 are unaffected. Dead state `linkedTrendDirections` should then be either removed or
filled only from the authored series (a separate implementation decision).

### 8.2 Renal recovery and liberation (CRRT-18) — at a glance

| Question                  | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What the learner sees now | Supplied values with identity, time and unit: creatinine marker 2.9 mg/dL at case start, urine output 5 mL/h (constant), residual kidney clearance 0. Absent: a recovery trend, recovering kidney function, serial chemistry after stopping. The case teaches that the clinical discontinuation decision is separate from the machine stop/end workflow. The earlier "several recovery signals are improving" claim was removed in Batch 02. |
| What the engine does      | Urine output is a constant external rate in the fluid ledger. Residual clearance is a fixed value not read by the solute step (§4). No kidney-recovery model exists. The prescription is CRRT-11's: CVVHD, Qb 140 mL/min, dialysate 1,100 mL/h, net removal 180 mL/h.                                                                                                                                                                        |
| What source exists        | Registered: `GUID-KDIGO-AKI-2012` (sections listed, not re-read), the lesson link to "KDIGO 2012 AKI guideline, chapter 5.2" (hard-coded; `G01-CRRT-08`, NOT REVIEWED), `DEV-PM-006` (stop/end workflow, manual pp65–90). Outside, verified: KDIGO 2026 **draft** Practice Points 5.9.1–5.9.4 (PDF p42, p316); German–Austrian Rec 7.3 (Grade 0).                                                                                            |
| What is missing           | A time series of urine output and creatinine with clinical context (diuretics, fluid balance, whether CRRT is running when creatinine is sampled); a reviewed choice of which predictor the case uses; the reviewer's view on how to show two sources that give different urine-output numbers.                                                                                                                                              |
| Option A                  | Keep CRRT-18 a **workflow-separation** case (clinical decision versus machine stop/end), renamed so it does not promise recovery evidence.                                                                                                                                                                                                                                                                                                   |
| Option B                  | Add a **reviewed authored evidence series** (storyboard B2) shown as supplied case evidence.                                                                                                                                                                                                                                                                                                                                                 |
| **Decision requested**    | **A or B? If B: which predictors, over which window, whether diuretics are part of the story, and which of the two differing sources (below) the case cites?**                                                                                                                                                                                                                                                                               |

Two sources, different numbers, not reconciled here:

| Source                                                               | Tier                                             | What it says (paraphrase)                                                                                                                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KDIGO 2026 public-review draft, Practice Point 5.9.3 (PDF p42; p316) | Draft practice point (ungraded)                  | Urine output >450 mL/24 h without diuretics, or >2,300 mL/24 h with diuretics, and a 2-hour timed creatinine clearance ≥23 mL/min can be used to predict successful discontinuation in adults |
| German–Austrian guideline Rec 7.3 (Crit Care 2026;30:46)             | Guideline statement, Grade 0 (no recommendation) | No precise minimum urine output can be recommended; as guidance, 300–600 mL/day without diuretics may be considered indicative                                                                |

### Storyboard B2 — renal recovery and liberation (for review; not built)

| Frame | Time           | Record (identity required)                                 | Value and unit                                                          | Learner task                                                        | Support                                                        |
| ----- | -------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1     | t₀ (on CRRT)   | Urine output, diuretic exposure                            | 5 mL/h — **existing synthetic value**, `SYNTH-CRRT-18`; diuretics `⟨…⟩` | What is the original indication, and is it resolved?                | KDIGO draft PP 5.9.1–5.9.2 (draft)                             |
| 1     | t₀             | Creatinine, with the sampling time relative to CRRT        | 2.9 mg/dL — **existing synthetic value**                                | Why is a creatinine drawn on CRRT hard to interpret?                | `⟨source to be named⟩`                                         |
| 2     | `⟨t₁…tₙ⟩` 24 h | Hourly or 24-h urine output                                | `⟨…⟩` mL/24 h                                                           | Which predictor, from which source, does the team use?              | Table above                                                    |
| 3     | `⟨t⟩`          | Fluid balance and hemodynamics                             | From the ledger / `⟨…⟩`                                                 | Is fluid overload corrected enough to trial off?                    | German–Austrian §7 (not all statements verified verbatim here) |
| 4     | —              | Treatment-delivery state and **machine stop/end workflow** | From the run                                                            | Separate the clinical decision from ending treatment on the machine | `DEV-PM-006` (manual pp65–90); existing case teaching          |
| 5     | `⟨post-stop⟩`  | Serial creatinine and urine after stopping                 | `⟨…⟩`                                                                   | What would make you restart?                                        | `⟨source to be named⟩`                                         |

No draft trend is added to runtime by this packet.

---

## 9. O-06 — recurrent filter loss

### At a glance

| Question                  | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What the learner sees now | CRRT-16 (legacy Assess/Challenge URL) says, before any reveal, that the earlier failed circuits are supplied history, described not simulated; the current circuit is running; the actions record a plan. The domain table is in the task. CRRT-15 says its filter trend is too small to read.                                                                                                                                                                                                          |
| What the engine does      | CRRT-16 is byte-identical to CRRT-15. Over 6 h: filter pressure 70.0 → 70.37 mmHg, drop 14.0 → 14.37, TMP 52.5 → 52.69, delivered dose 20.6 mL/kg/h, downtime 0. All CRRT-16 actions have no effect. **The engine has no filter or set-change action at all** (reducer actions: reset, load fixture, delivery state, prescription, external fluid rates, set/correct fault, acknowledge alarm, advance time). Anticoagulation is `none`.                                                                |
| What source exists        | Manual: set-change and stop/end workflow `DEV-PM-006` (manual pp65–90); "Change Set – T0948" (High priority: blood pump stopped over 10 minutes, set must be changed; PDF p103); "CRRT Max Set Life Reached – T1262" (Medium; PDF p112); TMP rise above its initial value feeds the filter-clotting alarm (PDF p219). KDIGO 2026 draft PP 5.6.2 (ungraded, draft): non-pharmacologic strategies for circuit life. No registered source for filter life or for how factors combine (open since CRRT-02). |
| What is missing           | Any source for filter-life time course, for the size of each contributor, and for anticoagulation's effect on filter life; an engine filter-exchange action.                                                                                                                                                                                                                                                                                                                                            |
| Option A                  | Keep CRRT-16 **plan-only**, clearly labeled (status quo since Batch 02).                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Option B                  | Specify a **simulated filter-loss event and exchange** (storyboard B3), built only after the listed sources exist.                                                                                                                                                                                                                                                                                                                                                                                      |
| **Decision requested**    | **A or B? If B, which single trigger and which single action should the first version support, and which source supports the time course?**                                                                                                                                                                                                                                                                                                                                                             |

### Storyboard B3 — historical filter loss versus the current run (for review; not built)

| Layer                     | What it is                        | Current content                                                                                                                     | What a learner may conclude from it                             |
| ------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1. Prior history          | Supplied narrative                | "Several CRRT circuits have failed prematurely"; no filter lifetimes, times or pressures supplied (`⟨lifetimes⟩`, `⟨times⟩` absent) | A pattern worth investigating, not a measurement                |
| 2. Current run            | Live simulation (CRRT-15 fixture) | CVVHDF, Qb 130 mL/min, dialysate 800, pre 400 / post 400 mL/h, net removal 50 mL/h, Hct 36%, FF constant 0.2, anticoagulation none  | Which domains this run can verify (access, pressures, delivery) |
| 3. Plan                   | Recorded learner declaration      | Case actions record the plan; zero effect on every signal                                                                           | That a plan is documented, not performed                        |
| 4. Performed intervention | Not possible today                | No filter-exchange, anticoagulation-start or predilution-effect action exists in the engine                                         | —                                                               |

If option B is chosen, a first simulated event would need all of:

| Element               | Candidate (not approved)                                                                                                | Required source or decision                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger               | A scheduled filter-risk change (the fixture schema already has `SET_FILTER_RISK`) or the generic `filter-fouling` fault | Which one; at `⟨time⟩`                                                                                                                          |
| Observable evidence   | Rising TMP and filter drop; possibly a generic simulated alert                                                          | Size and rate: `⟨mmHg per h⟩` — **no registered source**; any PrisMax alarm name needs O-09                                                     |
| Time course           | `⟨hours to loss⟩`                                                                                                       | Filter-life source (none registered)                                                                                                            |
| Action                | One of: change the set; start anticoagulation under a named protocol; shift replacement pre-filter; adjust blood flow   | Set change: manual workflow (`DEV-PM-006`); anticoagulation: local protocol + effect-size source; predilution: O-03; blood flow: access-limited |
| Supported consequence | Downtime while the set is changed; delivered dose falls accordingly                                                     | Duration `⟨min⟩` (authored and approved); the dose arithmetic already exists                                                                    |
| Recovery / reset      | New filter: burden terms return to baseline; pressures return to the new operating point                                | New engine action + tests; the manual's operating-point behavior after restart (not read for PrisMax; Prismaflex `DEV-PF-004` only)             |

Not proposed: filter-failure rates, an anticoagulation protection coefficient (the existing
`systemic-concept` 0.25 is synthetic and unsourced), or making the plan secretly change the circuit.

---

## 10. O-07 — dose, indication/timing and anticoagulation orientation

Evidence tiers are kept separate. A draft recommendation is not a guideline recommendation; a trial
result is not a recommendation; a device display is not a target; a local order is none of these.

| Topic                          | Guideline recommendation (final)                                                                                                                                             | Draft recommendation                                                                                                                                                                                                                                   | Trial / observational                                                                                                                                          | Common practice (unsourced)                                       | Device setting                                                      | Local order                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------- |
| CRRT dose                      | German–Austrian Rec 5.1: 20–25 mL/kg/h for continuous RRT, Grade A (critically ill adults). KDIGO 2012 (registry section 5.8.4; grade per walkthrough "1A", **not re-read**) | KDIGO 2026 draft Rec 5.3.1: 20–25 mL/kg/h over higher volumes, 1B (PDF p39). Draft PP 5.3.1: ideal/adjusted weight in high BMI                                                                                                                         | RENAL 2009 (25 vs 40 mL/kg/h post-dilution CVVHDF: no 90-day mortality difference); ATN 2008 (20 vs 35 mL/kg/h CVVHDF within strategies: no 60-day difference) | "Prescribe a bit more to cover downtime" (walkthrough; unsourced) | PrisMax displays effluent dose `Qeff/BW` (`DOSE-PM-001`); no target | Institution order                       |
| Timing of initiation           | KDIGO 2012 section 5.1.1 (registered; not re-read). NICE NG148 1.5.6–1.5.10 (`GUID-NICE-NG148-2024`, registered)                                                             | KDIGO 2026 draft Rec 5.1.1: deferred over early (pre-emptive) initiation in adults, 1C (PDF p38); PP 5.1.3: start for medically refractory complications                                                                                               | STARRT-AKI 2020 (`STARRT-AKI-2020`): no mortality benefit of accelerated start in its population                                                               | —                                                                 | —                                                                   | —                                       |
| Modality in instability        | German–Austrian Rec 3.3 (continuous/prolonged preferred when hemodynamically unstable; Grade B per retrieval summary — confirm)                                              | KDIGO 2026 draft Rec 5.2.1: CRRT or acute PD over conventional IRRT for unstable adults, 2C (PDF p38)                                                                                                                                                  | —                                                                                                                                                              | —                                                                 | —                                                                   | —                                       |
| Anticoagulation choice         | KDIGO 2012 section 5.6.2 (registered; grade "2B" per walkthrough, not re-read)                                                                                               | KDIGO 2026 draft Rec 5.5.1: regional citrate over heparin where available and not contraindicated, 1B (PDF p40); PP 5.5.1: heparin, epoprostenol or nafamostat acceptable if citrate contraindicated or unavailable                                    | —                                                                                                                                                              | "Citrate preferred" (common phrasing)                             | The engine offers `none` / `systemic-concept` only                  | Protocol (CRRT-09 teaches verification) |
| Citrate in shock/liver failure | German–Austrian Rec 4.4 (Grade 0), 4.5 (Grade A), 4.6 (Grade B)                                                                                                              | —                                                                                                                                                                                                                                                      | —                                                                                                                                                              | —                                                                 | —                                                                   | Protocol                                |
| Discontinuation                | German–Austrian Rec 7.3 (Grade 0)                                                                                                                                            | KDIGO 2026 draft PP 5.9.1–5.9.4 (ungraded)                                                                                                                                                                                                             | —                                                                                                                                                              | —                                                                 | Machine stop/end workflow `DEV-PM-006`                              | Team decision                           |
| Vascular access                | KDIGO 2012 site order (walkthrough: "not graded"; **not re-read**)                                                                                                           | KDIGO 2026 draft PP 5.4.1 (type, size, length and site weigh infection/bleeding against patency; PDF p40); draft chapter text (PDF p287) prefers the right internal jugular and advises avoiding subclavian — explanatory text, not a graded statement | —                                                                                                                                                              | —                                                                 | —                                                                   | —                                       |

Populations differ: KDIGO covers children and adults with AKI (dose recommendation is adults);
the German–Austrian guideline covers critically ill adults with dialysis-dependent AKI in the ICU;
RENAL and ATN enrolled critically ill adults with AKI.

**Decision requested:** for each row, which tier(s) may the module state, with which wording, and
should a draft statement appear at all before KDIGO 2026 is final? No row is promoted here.

---

## 11. O-08 — net ultrafiltration, citrate monitoring and numeric anchors

| Number                                                                                    | Where it comes from                                                                                                                                                                      | Category                                                           | Population / context          | May it become a rule?                                                                                                 | Disposition requested             |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Net UF >1.75 vs <1.01 mL/kg/h                                                             | Murugan et al. 2019 (PMID 31173127)                                                                                                                                                      | **Observational association** (secondary analysis of an RCT)       | RENAL trial, ANZ ICUs, CVVHDF | No: associated with lower survival; authors cite residual confounding and call for RCTs. Not an "unsafe above X" rule | Include with context / omit       |
| UFNET practice suggestions (weight-based, slower, avoid high UFNET on vasopressors)       | KDIGO 2026 draft, table adapted from Murugan et al. (PDF p314)                                                                                                                           | Draft guideline text (not a graded statement)                      | —                             | No                                                                                                                    | Include as draft context / omit   |
| Effluent 20–25 mL/kg/h                                                                    | §10                                                                                                                                                                                      | Guideline recommendation (German–Austrian Grade A); draft KDIGO 1B | Critically ill adults         | A prescription range, not a delivered-dose verdict                                                                    | Wording                           |
| FF ceiling ~20–25%                                                                        | Walkthrough only                                                                                                                                                                         | **Unsourced common teaching**                                      | —                             | No                                                                                                                    | Name a source or omit             |
| Total/ionized calcium ratio >~2.5                                                         | Walkthrough (attributes to Schneider 2017; not re-read)                                                                                                                                  | Expert opinion (as attributed); unverified                         | RCA                           | No: a ratio alone is not a diagnostic algorithm                                                                       | Verify full text or omit          |
| Post-filter and systemic iCa ranges                                                       | KDIGO 2026 draft Table 50 (PDF p298) lists a post-filter range in its citrate row; not reproduced here because the table was read from text extraction and column alignment is uncertain | Draft summary table; protocol-dependent                            | —                             | No: local protocol sets targets                                                                                       | Reviewer reads the table directly |
| Urine output >450 mL/24 h (no diuretics), >2,300 mL/24 h (diuretics), 2-h CrCl ≥23 mL/min | KDIGO 2026 draft PP 5.9.3 (PDF p42)                                                                                                                                                      | Draft practice point (ungraded)                                    | Adults                        | No                                                                                                                    | §8.2                              |
| Urine output 300–600 mL/day (no diuretics)                                                | German–Austrian Rec 7.3                                                                                                                                                                  | Guideline statement, Grade 0                                       | Critically ill adults         | No                                                                                                                    | §8.2                              |
| TMP > +300 mmHg alarm                                                                     | PrisMax manual PDF p219                                                                                                                                                                  | **Device alarm condition**                                         | PrisMax program 2.XX          | A device behavior, not a clinical target                                                                              | O-09                              |
| −18 and −25 mmHg                                                                          | PrisMax manual PDF pp203, 218–219                                                                                                                                                        | Device display corrections                                         | PrisMax program 2.XX          | Never an alarm limit or threshold                                                                                     | O-04                              |
| Typical blood-flow range (F-25)                                                           | No source; cases use synthetic 120–150 mL/min                                                                                                                                            | —                                                                  | —                             | No                                                                                                                    | Name a source or state none       |
| Case values (Qb, dialysate, net removal, weights)                                         | `SYNTH-CRRT-nn`                                                                                                                                                                          | Proposed synthetic teaching values (pending)                       | Synthetic                     | No                                                                                                                    | Covered by case review            |

**Decision requested:** for each number, include with its category and population stated, or omit.
The owner decision already recorded in `OWNER_DECISIONS.md` stands: a net-UF association is not an
"unsafe above" rule, and neither a total/ionized ratio nor an FF ceiling is by itself sufficient
for a universal algorithm.

---

## 12. O-09 — device alarms, workflow, fluids and access

### At a glance

| Question                  | Answer                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What the learner sees now | Thirteen **generic simulated alerts**, labeled "Simulated … alert", with the boundary sentence that they are not PrisMax alarm names and that no manufacturer priority, color or automatic pump response is mapped. "Priority: none shown". Five safety drills (air, blood leak, gain/loss, bag/scale, wrong solution), each with the safe response first in authored order. |
| What the engine does      | `ActiveAlarm.urgency` is `null` and `deviceMappingStatus` is `pending-device-adapter` for every alert. An engine `ACKNOWLEDGE_ALARM` action exists, but CRRT-13's "Acknowledge the generic training alert" case action carries no effect, so the engine alert is never marked acknowledged (recorded in Batch 02 §7).                                                        |
| What source exists        | PrisMax manual alarm chapter: priorities and indicators PDF pp96–98 (`DEV-PM-007`, manual pp93–100), alarm tables PDF pp102–161 (`DEV-PM-008`, manual pp101–169). Both records say names, priorities, thresholds and reactions remain unmapped.                                                                                                                              |
| What is missing           | A reviewed mapping from each generic alert family to zero, one or several PrisMax alarms; a decision on how the facsimile shows priority, reaction and acknowledgment; local-protocol dependencies (blood return, set discard, anticoagulation).                                                                                                                             |
| Option A                  | Keep generic alerts unmapped (status quo), and add the manual's alarm names only as a **source-labeled reference list** beside the simulation.                                                                                                                                                                                                                               |
| Option B                  | Map named families (table below) after a PrisMax operator confirms each candidate and its priority for program 2.XX.                                                                                                                                                                                                                                                         |
| **Decision requested**    | **A or B? If B, confirm or reject each candidate row below, and state whether acknowledgment in the facsimile should mark the alert acknowledged.**                                                                                                                                                                                                                          |

### Artifact D (part 2) — generic alerts versus manufacturer alarms

**Manufacturer priority scheme (sourced; PDF pp96–98).** High (flashing red light, high-priority
audio, red pop-up); Medium (flashing yellow, yellow pop-up); Low (steady yellow; treatment continues
with some exceptions); Information (steady green; single beep every five minutes); Malfunction
(flashing red, "Call Service"; treated as high priority). For high- and medium-priority alarms the
system enters a safe state that can include stopping the blood, fluid or syringe pumps or closing
the return clamp, depending on the alarm. Response and reset (PDF pp94–99, 155, paraphrased):
follow the on-screen instructions; an alarm window can be docked or silenced for 2 minutes; some
alarms offer Override or Alarm Off, which lowers alarm sensitivity; do not continue if the same
alarm recurs; if an alarm cannot be corrected, check the patient, stop treatment and return blood
if possible per hospital policy, and contact service. **Codes identify alarms for technical
reference; the same alarm title can appear under different priorities with different codes.**

**Candidate manufacturer alarms per generic family — for review only, not a mapping.**

| Generic engine code    | Learner label now                    | Candidate PrisMax alarm(s): title – code (priority section, PDF page)                                                                                                                                                                                              |
| ---------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ACCESS_OBSTRUCTION`   | Simulated access-obstruction alert   | Access Extremely Negative – T0775 (High, p102); Check Access – T1145 (Medium, p111); Access Line Clamped – T1615 (Medium, p109); Access Extremely Negative – T1238 (Information, p132)                                                                             |
| `ACCESS_DISCONNECTION` | Simulated access-disconnection alert | No access-specific disconnection title found in the tables read. Set Disconnection – T0777 (High, p107) covers a disconnection anywhere in the set. Reviewer to confirm                                                                                            |
| `RETURN_OBSTRUCTION`   | Simulated return-obstruction alert   | Return Extremely Positive – T0526 (High, p106); Return Extremely Positive – T1164 (Low, p128); Return Line Clamped – T1614 (Medium, p117)                                                                                                                          |
| `RETURN_DISCONNECTION` | Simulated return-disconnection alert | Return Disconnection – T0525, T1168, T1169 (High, p106); Cannot Monitor Return – T0527 (Medium, p111)                                                                                                                                                              |
| `FILTER_FOULING`       | Simulated filter-fouling alert       | High Filter Pressure – T0781 (High, p104); Membrane Pressure Excessive – T0938 (Medium, p114); TMP Pressure Excessive – T0782 (Medium, p119); Membrane Pressure Rising – T0786 (Low, p127)                                                                         |
| `EFFLUENT_OBSTRUCTION` | Simulated effluent-obstruction alert | None identified in the tables read. Reviewer to confirm                                                                                                                                                                                                            |
| `AIR_DETECTED`         | Simulated air-detection alert        | Air Detected in Blood – T0792 (High, p103). Setup-phase air alarms (p136) are a different context                                                                                                                                                                  |
| `BLOOD_LEAK_DETECTED`  | Simulated blood-leak-detection alert | Blood Leak Detected – T0830 (Medium, p110)                                                                                                                                                                                                                         |
| `SUPPLY_BAG_EMPTY`     | Simulated empty-supply-bag alert     | Bag Empty – T0804, T0805, T0933, T1076 (Low, p122)                                                                                                                                                                                                                 |
| `EFFLUENT_BAG_FULL`    | Simulated full-effluent-bag alert    | Effluent Bag Full – T0801 (Low, p125); Auto-Effluent Bags Full – T0802 (Low, p122)                                                                                                                                                                                 |
| `SCALE_OPEN`           | Simulated open-scale alert           | Scale Open – T0811, T0812, T0813, T0934, T0947, T1081, T1281 (Low, p129)                                                                                                                                                                                           |
| `FLUID_GAIN_LOSS`      | Simulated fluid gain-or-loss alert   | CRRT Gain/Loss Limit Reached – T0798 (Medium, p112); Flow Problem – T0822 (Medium, p113) and T0823, T0824, T0935, "1069" (printed without the T), T1070 (Medium, p114); Effluent Bag Weight Change – T1721 and Effluent Drain Weight Increase – T1716 (High, p104) |
| `POWER_INTERRUPTION`   | Simulated power-interruption alert   | Total Loss of Power – T0595 (High, p107); Loss of AC Power – T0598 (Low, p126)                                                                                                                                                                                     |

Also sourced and relevant to G-07: TMP rise above its initial value adds to the filter-clotting
alarm, and an alarm occurs if TMP exceeds +300 mmHg (PDF p219); "Change Set – T0948" (High, p103)
when the blood pump has been stopped over 10 minutes; "CRRT Max Set Life Reached – T1262" (Medium,
p112).

**Fluids and lines.** Flow terms in the model: PBP, dialysate, pre-filter replacement, post-filter
replacement, syringe, makeup, effluent (`engine/types.ts` `CrrtFlowTerm`). Bags carry no product
identity or composition (§4), so CRRT-08 ("Verify the set, bags, solutions…") and the
wrong-solution drill verify labels, not products. Makeup's patient-ledger role is unresolved
(`CONFLICT-CRRT-MAKEUP-001`). Registered layout sources: `DEV-PM-011` (flow paths, manual
pp206–212), `DEV-PM-013` (pumps, scales, bag changes, pp241–244), `DEV-PM-014` (device layout,
pp252–262; the module uses original schematic artwork, not manual figures).

**Access terminology.** The module uses "access" and "return" limbs and a synthetic dual-lumen
catheter descriptor ("Synthetic dual-lumen central venous…", "Synthetic stable dual-lumen access").
No insertion site or catheter length appears in learner content (searched: none). See G-09.

**Local-protocol dependencies (never inferred by the module).** Anticoagulation protocol and dosing
(CRRT-09 teaches verification only); blood return and set discard after an unresolvable alarm (the
manual defers to hospital/clinic policy, PDF p96); bag-change execution; alarm-limit
configuration (service-set parameters, PDF p219).

---

## 13. O-10 — new content, media and usability priority

The candidates below are consolidated from Batches 01–04 and this packet. None is built.

| #   | Candidate                                                                                        | Source of the proposal               | Depends on                   | Size (rough)          |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------ | ---------------------------- | --------------------- |
| 1   | Ten item rewrites (E-01 to E-10)                                                                 | Batch 04 P-01–P-09 + this packet     | Faculty review               | Content only          |
| 2   | Lesson-5 presentation (F-01)                                                                     | Batch 04 P-10, X-03                  | Owner                        | A: none; B: migration |
| 3   | CRRT-17 citrate evidence series (B1)                                                             | F-04, F-16, O-05                     | O-05C, values                | Schema + content      |
| 4   | CRRT-18 recovery evidence series (B2)                                                            | F-16, O-05                           | O-05R, values                | Schema + content      |
| 5   | CRRT-16 simulated filter loss (B3)                                                               | F-05, O-06                           | O-06, sources, engine action | Engine + content      |
| 6   | CRRT-11 reframe or authored trend                                                                | F-02, O-02                           | O-02                         | A: copy; B: content   |
| 7   | CRRT-05 FF display / predilution                                                                 | F-03, O-03                           | O-03, CONFLICT-002           | Engine + copy         |
| 8   | Pilot chemistry (K/HCO₃, CRRT-02)                                                                | F-01, O-01                           | O-01, product record         | Engine + tests        |
| 9   | Own patients for CRRT-16/17/18 (and CRRT-03, -12)                                                | F-16; Batch 02 §7 deferred item 3    | Content decision             | Content               |
| 10  | CRRT-12 evidence scope like CRRT-17/18 (its description claims changing trends it may not carry) | This packet (§17), code reading only | Batch 06 check               | Copy                  |
| 11  | Membrane picture: a molecule-size / relative-clearance example                                   | F-15; left for prompt 05 by Batch 03 | A registered source          | Visual                |
| 12  | Drill option order (safe response first in all five drills)                                      | Batch 04 §4 item 7                   | Content decision             | Content               |
| 13  | Practice "Try predicting" wording aligned with Learn ("Show explanation", "Reasoning feedback")  | Batch 04 §4 item 6                   | None clinical                | Copy                  |
| 14  | `latencySeconds`: wire or remove (112 interventions carry it; 9 have a real time effect)         | Batch 02 §7; Batch 02 sanity review  | Content/owner                | Content + tests       |

**Media and rights.** The walkthrough's screenshots are not repackaged. Any PrisMax screen image,
manual figure or product photograph needs written permission; `DEV-PM-014` records that the module
uses original schematic artwork. A new membrane illustration must stay illustrative (not a
clearance measurement) and cite its source.

**Validation that no document can replace.** Real intended-learner and PrisMax-operator sessions
with build SHA, route, observed difficulty and time (owner task 5 in `OWNER_DECISIONS.md`). The AI
persona walkthrough does not satisfy it.

**Timing.** Minutes shown on the Learn landing come from `critical-care/content/learningPathways.ts`
(for example 12 minutes for Lesson 5) and are labeled as authoring estimates. No measured learner
time exists.

**Decision requested:** choose the **smallest** set to do next (for example, at most three rows),
in order. Rows 3–8 each need their O-decision first.

---

## 14. Artifact E — ten weak-item revisions

Starting point: the nine item proposals P-01 to P-09 in `CRRT-FELLOW-04-owner-proposals.md`. The
tenth (E-10) was chosen here by the same rule Batch 04 used (a structural weakness in how the item
is written): it is the only remaining item with just two options. Cue counts ranked the items;
they are not a target. Existing option text, keys and IDs were confirmed unchanged at `85acc113`.
Every proposed distractor restates a misconception already named in that item's own authored
feedback, unless marked **new**. None is implemented.

"Registered rationale" = the lesson's `sourceRecordIds` (the registry has no item-level claim map,
so no single option is asserted to be source-supported) plus the item's own authored feedback.

### E-01 — Lesson 7, task 9 · `crrt-fluid-liberation` / `liberation-transfer` (`content/operationalLessons.ts:370`) — was P-01

- **Prompt:** "Urine output is improving, but substantial ongoing intake and unresolved solute/acid–base concerns remain. Which plan is supported?"
- **Existing options:** `urine-only` "Stop CRRT solely because urine output increased; no specific follow-up plan is needed." · **`reassess` (key)** "Reassess the original indication, native function, fluid and solute/acid–base needs and hemodynamics; define monitoring and contingencies before any trial off."
- **Registered rationale:** lesson sources FLUID-PM-001, FLUID-PM-002, TEXT-CRRT-NEYRA-2026, WHITE-2024, GONEUTRAL-2024, SYNTH-LAB-FLUID-001, GUID-RRT-ICU-2026 (P-01 omitted SYNTH-LAB-FLUID-001). Feedback: urine recovery alone does not establish that fluid, solute and acid–base needs are met; no universal stop threshold.
- **Proposed rewrite:** key "Before any trial off, reassess the indication, fluid and solute/acid–base needs, native function and hemodynamics, and plan monitoring." · `urine-only` "Plan a trial off now, since improving urine output shows the fluid and solute/acid–base needs are being met." · optional **new** option "Continue unchanged until urine output passes a fixed threshold, then stop."
- **Clinical meaning changes?** Key: no. Distractor: same misconception. The optional third option is new; note it now intersects O-08/§8.2, where two sources give different urine-output numbers.
- **Reviewer question:** Approve, edit or reject each line; should the new third option exist given that sources disagree on thresholds?

### E-02 — Lesson 8, task 9 · `crrt-pressure-profile-integration` / `case-reassess` (`content/advancedLessons.ts:366`) — was P-02

- **Prompt:** "Which handoff accounts for both this run and the limits of its observations?"
- **Existing options:** `complete-runtime` "Report the current hourly settings as delivered for the whole hour and omit the pause." · **`reconcile` (key)** "Report regional findings, actions, current pump state, recorded delivery/downtime, both fluid ledgers and remaining patient/protocol checks." · `patient-neutral` "Report patient fluid neutrality whenever the machine has removed some fluid."
- **Registered rationale:** lesson sources DEV-PM-009, DEV-PM-010, MATH-PM-002, FLUID-PM-002, TEXT-RRT-HOSTE-2024, REVIEW-CRRT-PRINCIPLES-2021, REVIEW-CKRT-CORE-2025, SYNTH-LAB-PRESSURE-001, GUID-RRT-ICU-2026. Feedback: a corrected pressure profile does not establish recovery; machine removal is one term.
- **Proposed rewrite:** key "Report findings, actions, pump state, recorded delivery and downtime, both fluid ledgers, and the checks still open." · `complete-runtime` "Report the corrected pressure profile and the actions taken; the pause fixed the problem, so no checks remain open." · `patient-neutral` "Report this hour's machine removal as the patient's fluid balance, alongside the settings and pressures."
- **Clinical meaning changes?** Key: no. `complete-runtime` changes misconception from "omit the pause" to "a corrected profile closes the case" (both in authored feedback).
- **Reviewer question:** Which misconception should `complete-runtime` test, and do you approve the wording?

### E-03 — Lesson 7, task 7 · `crrt-fluid-liberation` / `flow-transfer` (`content/operationalLessons.ts:326`) — was P-03

- **Prompt:** "A different patient's immediate concern is excessive fluid loss during CRRT, while the need for solute support persists. What distinction should guide reassessment?"
- **Existing options:** `dialysate` "Dialysate flow is the same quantity as net patient fluid removal." · **`separate` (key)** "Reassess net removal and all patient inputs/outputs while separately reviewing blood flow and solute-support requirements." · `pump` "Increasing blood flow alone establishes a safer net-removal rate."
- **Registered rationale:** Lesson 7 sources (as E-01). Feedback names both misconceptions.
- **Proposed rewrite:** key "Review net removal against every input and output, separately from blood flow and solute support." · `dialysate` "Lower dialysate flow, since dialysate is the flow that sets how much fluid the patient loses." · `pump` "Raise blood flow first, since a faster circuit makes the current net-removal rate safer to continue."
- **Clinical meaning changes?** No.
- **Reviewer question:** Approve, edit or reject?

### E-04 — Lesson 2, task 6 · `crrt-circuit-pressures` / `pressure-transfer` (`content/foundationLessons.ts:256`) — was P-04

- **Prompt:** "At the same blood flow, return and filter pressures rise together while filter pressure drop stays unchanged. What should you inspect to refine the interpretation?"
- **Existing options:** `filter` "Focus on the filter alone because any higher filter pressure proves filter clotting." · **`return` (key)** "Assess the patient and inspect the return path for increased resistance; the readings do not identify one specific cause." · `ignore` "Treat the unchanged pressure drop as proof that no circuit problem is present."
- **Registered rationale:** lesson sources DEV-PM-009, DEV-PM-010, MATH-PM-002, TEXT-RRT-HOSTE-2024, REVIEW-CRRT-PRINCIPLES-2021, SYNTH-LAB-PRESSURE-001. Feedback: downstream resistance raises filter pressure; an unchanged difference can hide changed components.
- **Proposed rewrite:** key "Assess the patient and inspect the return path; the readings point to a region, not a specific cause." · `filter` "Inspect the filter first; filter pressure rose, and a clotting filter raises it." · `ignore` "Keep observing without inspecting; an unchanged filter pressure drop suggests the circuit is intact."
- **Clinical meaning changes?** No. Note: the item's logic depends on the filter drop, whose −25 mmHg placement is held (O-04); the direction reasoning is unaffected by the offset.
- **Reviewer question:** Approve, edit or reject?

### E-05 — Lesson 8, task 10 · `crrt-pressure-profile-integration` / `integration-transfer` (`content/advancedLessons.ts:398`) — was P-05

- **Prompt:** "A separate handoff gives only the final pump settings and total effluent volume. It omits urine, external intake, interruption times and anticoagulation delivery. What can you conclude?"
- **Existing options:** `patient-equals-effluent` "Whole-patient fluid loss equals the effluent total, so the missing fields are unnecessary." · `dose-from-settings` "The final settings establish the delivered dose for the entire treatment interval." · **`request-history` (key)** "Retain the reported effluent total and request the missing patient and delivery history before reconciling balance or adequacy."
- **Registered rationale:** Lesson 8 sources (as E-02). Feedback: effluent is not patient loss; settings are not delivery.
- **Proposed rewrite:** key "Keep the effluent total and request the missing patient and delivery history before reconciling balance or dose." · `patient-equals-effluent` "Use the effluent total as the patient's fluid loss for now, and ask for the other fields later." · `dose-from-settings` "Calculate the delivered dose from the final settings over the whole interval, then ask for the history."
- **Clinical meaning changes?** No.
- **Reviewer question:** Approve, edit or reject?

### E-06 — Lesson 5, task 10 · `crrt-alarms-troubleshooting` / `alarm-transfer` (`content/operationalLessons.ts:206`) — was P-06

- **Prompt:** "In a different run, the alert is acknowledged and the pressure looks less abnormal, but the blood pump remains stopped and recorded effluent has not increased. What has been verified?"
- **Existing options:** `restored` "Successful treatment delivery has been verified by the pressure alone." · **`not-restored` (key)** "Delivery has not been demonstrated; reassess the cause and device state before permitted continuation."
- **Registered rationale:** lesson sources DEV-PM-005, DEV-PM-008, DEV-PM-012, DEV-PM-013, DEV-PM-014, TEXT-RRT-HOSTE-2024, GUID-RRT-ICU-2026. Feedback: acknowledgement, pressure at stopped flow and actual delivery are separate observations.
- **Proposed rewrite:** key "Delivery has not been shown; reassess the cause and device state before any permitted continuation." · `restored` "Treatment delivery has resumed, since the pressure is closer to its starting value." · **new** option "The cause has been corrected, since the alert was acknowledged and the pressure improved."
- **Clinical meaning changes?** Key: no. The third option is new.
- **Reviewer question:** Approve, edit or reject the new option; confirm the key stays the only accepted answer.

### E-07 — Lesson 3, task 5 · `crrt-solute-transport` / `transport-transfer` (`content/foundationLessons.ts:359`) — was P-07

- **Prompt:** "A CVVH illustration increases replacement flow and matching filtration while holding net CRRT removal fixed. What is the main distinction?"
- **Existing options:** **`convection` (key)** "More water crosses the membrane with convective solute transport; the replacement offsets part of that water loss." · `replacement-dialysate` "Replacement stays on the fluid side of the membrane and acts as dialysate." · `all-patient-loss` "All increased effluent must be additional net fluid loss from the patient."
- **Registered rationale:** lesson sources REVIEW-CRRT-PRINCIPLES-2021, TEXT-RRT-HOSTE-2024, REVIEW-CKRT-CORE-2025, GUID-RRT-ICU-2026, SYNTH-LAB-TRANSPORT-001.
- **Proposed rewrite:** key "More water crosses the membrane, carrying solute by convection; replacement offsets part of that water." · `replacement-dialysate` "Replacement works like dialysate: it runs on the fluid side and clears solute by diffusion." · `all-patient-loss` "The extra effluent is extra fluid removed from the patient, even though the removal setting is unchanged."
- **Clinical meaning changes?** No. Separate clinical-wording question flagged by Batch 04: with net removal fixed and filtration matched by replacement, does "offsets **part of**" describe the replacement correctly?
- **Reviewer question:** Approve, edit or reject; and should "offsets part of that water" stay?

### E-08 — Lesson 5, task 8 · `crrt-alarms-troubleshooting` / `alarm-continuation` (`content/operationalLessons.ts:162`) — was P-08

- **Prompt:** "The modeled access cause has been corrected while treatment is paused. Which continuation plan is supported?"
- **Existing options:** **`resume-verify` (key)** "Use the permitted case resume action, then reassess the patient, pressures, pump state and new delivery." · `universal` "Use the same resume sequence for every device alarm once it is acknowledged." · `return` "Perform blood return automatically because the pressure improved during the pause."
- **Registered rationale:** Lesson 5 sources (as E-06). Feedback: no universal restart sequence; a stopped-pump pressure is not evidence that blood return is appropriate.
- **Proposed rewrite:** `universal` "Resume with the same steps used for the previous alert, since this alert has been acknowledged." · `return` "Return the blood and end the run, since the pressure improved while paused." · key unchanged.
- **Clinical meaning changes?** No. Related device fact (O-09): the manual defers blood return after an uncorrectable alarm to hospital/clinic policy (PDF p96).
- **Reviewer question:** Approve, edit or reject?

### E-09 — Lesson 6, task 8 · `crrt-anticoagulation` / `citrate-transfer` (`content/advancedLessons.ts:152`) — was P-09

- **Prompt:** "A handoff reports rising circuit pressures during RCA. Sampling sites and current calcium/acid-base trends are missing. Which next step is justified?"
- **Existing options:** `empiric-citrate` "Increase citrate to reverse the pressure change, then seek the missing samples." · **`parallel-assessment` (key)** "Assess patient and circuit, verify delivery, and obtain correctly identified systemic and circuit information." · `ignore-systemic` "Use the pressure trend as a substitute for systemic calcium and acid-base assessment."
- **Registered rationale:** lesson sources TEXT-CRRT-NEYRA-2026, REVIEW-CKRT-CORE-2025, GUID-RRT-ICU-2026, SYNTH-LAB-CITRATE-001, CITRATE-SIAARTI-2023-MECHANISM, CITRATE-SIAARTI-2023-SAMPLING, CITRATE-SCHNEIDER-2017-METABOLISM, CITRATE-SCHNEIDER-2017-PATTERNS, CITRATE-ICU-GUIDE-2026-SAFETY. Feedback: mechanical localization and the anticoagulation review answer different questions.
- **Proposed rewrite:** `ignore-systemic` "Localize the pressure change first; the calcium and acid–base review can wait for the next routine samples." · key "Assess the patient and circuit, verify delivery, and get correctly labeled systemic and circuit samples." · `empiric-citrate` unchanged.
- **Clinical meaning changes?** **Yes, in what the item tests:** the distractor moves from a substitution misconception to a sequencing one (both are in the authored feedback).
- **Reviewer question:** Should this item test substitution or sequencing? Approve, edit or reject.

### E-10 — Lesson 7, task 4 · `crrt-fluid-liberation` / `missing-chart-data` (`content/operationalLessons.ts:272`) — new in this packet

- **Prompt:** "What balance can you report from this incomplete chart?" (instruction: a deliberately incomplete chart copy withholds urine output; the simulation's record is intact).
- **Existing options:** `zero-output` "Enter zero for unrecorded urine and report an exact whole-patient balance." · **`reconcile` (key)** "Report that exact balance is unavailable and reconcile the missing urine output."
- **Existing accepted key:** `reconcile` only.
- **Registered rationale:** Lesson 7 sources (as E-01). Key feedback: a missing chart term stays unavailable; neither the machine-removal total nor an assumption of zero fills that gap. Distractor feedback: an absent record does not establish zero output.
- **Why selected:** the only two-option item not already proposed (Batch 04 audit row 17). The distractor is plausible; the weakness is that the item offers one misconception when its own feedback names two.
- **Proposed rewrite:** keep both options as written; add a **new** third option drawn from the key's feedback: "Report net CRRT removal as the whole-patient balance until urine output is charted."
- **Clinical meaning changes?** No change to the key or the existing distractor. The third option is new.
- **Reviewer question:** Approve, edit or reject the new option; confirm the key stays the only accepted answer.

---

## 15. Artifact F — Lesson-5 presentation / split map

Lesson 5, "Alarms and cause-first troubleshooting" (`crrt-alarms-troubleshooting`), position 5 of 8
in `BAXTER_CRRT_LEARN_LESSON_IDS` (`content/learnerRegistry.ts:31`). All IDs below are preserved by
every option until a separate decision.

**Current grouping (four plus six; `learnSequence.ts` `crrtLessonOutlineParts`)**

| Part                                     | Task # | Task IDs                                                                                                  | Guided run                                     |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1 · Set up and read a normal run         | 1–4    | `machine-orientation`, `machine-setup`, `normal-delivery`, `delivery-interpretation`                      | Guided version of Practice CRRT-04 (tasks 2–4) |
| 2 · A new run with an alert, cause first | 5–10   | `alarm-arrival`, `alarm-localize`, `alarm-repair`, `alarm-continuation`, `alarm-verify`, `alarm-transfer` | Guided version of Practice CRRT-13 (tasks 5–9) |

The in-lesson "Lesson tasks" outline already shows the two parts; each task in it is a button that
navigates within the lesson (`components/CrrtFoundationLesson.tsx`, outline block). Whether Part 2
can be opened before Part 1 follows the lesson's existing navigation rules, which were not
re-tested for this packet.

**Options and consequences**

| Concern                                   | A · status quo (one lesson, two-part outline)                                                                                | B · split into two lessons                                                                                                                                                                                                                                                 | C · one lesson, a "Part 2 starts here" resume point                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Lesson IDs                                | Unchanged                                                                                                                    | One new ID (for example `crrt-alarms-first-response`); existing ID kept for the other part                                                                                                                                                                                 | Unchanged                                                                                                              |
| URL                                       | `/baxter-crrt/learn?lesson=crrt-alarms-troubleshooting` (the URL carries only `lesson`; the task position is not in the URL) | A second lesson URL; old links open the part that keeps the old ID                                                                                                                                                                                                         | Needs either an in-lesson jump (no URL change) or a new `task` query parameter (a route-contract change; not proposed) |
| Local storage (`baxter-crrt-progress-v3`) | Unchanged                                                                                                                    | `selfPaced.visitedLessonIds` holds the old ID; the new lesson starts "not visited". `selfPaced.lastLocation.taskId` for moved tasks fails `validCrrtLearningLocation` and is dropped (fails safe). Legacy `completedLessonIds` must stay untouched                         | Unchanged unless a part marker is stored (not proposed)                                                                |
| Order and numbering                       | Unchanged                                                                                                                    | Nine lessons: "Lesson N of 8", the hub's "Eight lessons", later lesson numbers and the Practice reuse labels ("Lesson 5 (tasks 5–9)") all change                                                                                                                           | Unchanged                                                                                                              |
| Prerequisites                             | Unchanged                                                                                                                    | Lesson 8's `prerequisiteActivityIds` (`critical-care/content/activities.ts`, includes `crrt:learn:crrt-alarms-troubleshooting`) must list both                                                                                                                             | Unchanged                                                                                                              |
| Shared catalog and other files            | None                                                                                                                         | `critical-care/content/learningPathways.ts` (section, 12-minute estimate), `activities.ts` seed, `content/curriculum.ts` station `lessonIds`, `src/lib/baxter-crrt-analytics.ts` allowlist, `learnSequence.ts`, `content/lessonClinicalAnchors.ts` (pinned to the ID list) | Outline copy and possibly the hub sequence copy                                                                        |
| Clinical content                          | None                                                                                                                         | None                                                                                                                                                                                                                                                                       | None                                                                                                                   |

**Decision requested:** A, B or C. The Batch 04 implementer's note (not a clinical recommendation):
A or C until pilot observations show where learners stop; B is its own migration and should be
scoped separately. No new route is created by this packet.

---

## 16. The ten content-need topics (G-01 to G-10)

From the ten-topic table in `FEEDBACK_LEDGER.md`. "Review status" is the registry's
`reviewStatus` (every CRRT record is `pending`, reviewer `null`) or the G01 queue decision (every
item NOT REVIEWED). Inspecting a source here does not change either.

### G-01 — Indications and timing

- **Learner surface:** Lesson 1 "CRRT indications and modality selection"; Practice CRRT-01, CRRT-02 (and their debriefs).
- **Implementation:** Qualitative goal-first framing; no timing threshold or start rule anywhere.
- **Sources:** `GUID-KDIGO-AKI-2012` (guideline; Kidney Int Suppl 2012;2:1–138; sections 5.1.1, 5.1.2 as registered; pending); `GUID-NICE-NG148-2024` (guideline; NICE NG148, last updated 16 Oct 2024; recs 1.5.6–1.5.10; pending); `STARRT-AKI-2020` (RCT; N Engl J Med 2020;383:240–251; pending). Outside: KDIGO 2026 **draft** Rec 5.1.1 (1C, PDF p38) and PP 5.1.3 (PDF p38).
- **Limitation:** KDIGO 2012 not re-read; the 2026 document is a draft.
- **Proposed bounded change:** none now; optionally one tier-labeled sentence on deferred versus urgent initiation after O-07.
- **Decision required:** O-07 row "Timing of initiation".

### G-02 — Dose target

- **Learner surface:** Lesson 4 "Prescription and delivered dose"; CRRT-04, CRRT-06.
- **Implementation:** Prescribed and delivered effluent dose `Qeff/BW` with downtime accounting (`DOSE-PM-001`); "No clinical target range is implemented."
- **Sources:** `DOSE-PM-001` (device manual; AW8035 Rev B JUN2019, manual pp219–220 / PDF pp220–221; pending); `RENAL-2009` (RCT; N Engl J Med 2009;361:1627–38; pending); `TEXT-CRRT-NEYRA-2026` (textbook; Brenner & Rector 12th ed. 2026, ch. 64 pp1881–1898; pending). Outside: German–Austrian Rec 5.1 (Grade A); KDIGO 2026 draft Rec 5.3.1 (1B); ATN 2008 (not registered).
- **Limitation:** "prescribe more to cover downtime" is unsourced common practice.
- **Proposed bounded change:** one sentence stating the recommended delivered-dose range with its tier and population, kept separate from the simulator's dose display.
- **Decision required:** O-07 row "CRRT dose".

### G-03 — Filtration fraction

- **Learner surface:** Lessons 3–4 (L4 "Not calculated here: filtration fraction"), CRRT-05, CRRT-15/16 domain table.
- **Implementation:** FF is a fixed authored coefficient (0.1 or 0.2); PrisMax FF functions unwired.
- **Sources:** `MATH-PM-003`, `MATH-PM-004`, `MATH-PM-005`, `MATH-PM-006` (device manual; AW8035 Rev B JUN2019; PDF pp219–221; pending); `CONFLICT-001`, `CONFLICT-002` (unresolved). No registered source for a generic FF definition or ceiling.
- **Limitation:** see Artifact C.
- **Proposed bounded change:** per O-03.
- **Decision required:** O-03.

### G-04 — Heparin and no anticoagulation

- **Learner surface:** Lesson 6 "Anticoagulation and citrate safety"; CRRT-09 (protocol verification); CRRT-16 domain table ("No anticoagulation method is listed").
- **Implementation:** Engine methods `none` and `systemic-concept` only; every runtime case starts with `none`; no citrate method; `systemic-concept` carries a synthetic 0.25 filter-protection fraction used by no case.
- **Sources:** citrate records (§8.1); `GUID-RRT-ICU-2026` (guideline; Crit Care 2026;30:46; recs 2.1, 2.4, 3.2, 3.3, 3.6, 5.1 as registered; pending). Outside: KDIGO 2026 draft Rec 5.5.1 (1B) and PP 5.5.1–5.5.5 (PDF p40); KDIGO 2012 section 5.6.2 (registered; not re-read).
- **Limitation:** no source for expected filter life with heparin or without anticoagulation.
- **Proposed bounded change:** one tier-labeled sentence on agent choice; no dose, no filter-life number.
- **Decision required:** O-07 row "Anticoagulation choice"; O-06 if filter life is wanted.

### G-05 — Citrate monitoring

- **Learner surface:** Lesson 6 (four-pattern citrate comparison, sampling domains); CRRT-17.
- **Implementation:** Direction-only conceptual state; one supplied systemic iCa in CRRT-17; no circuit sample field.
- **Sources:** `CITRATE-SIAARTI-2023-MECHANISM`, `-SAMPLING` (expert opinion; J Anesth Analg Crit Care 2023;3:7; pending; `G01-CRRT-05` NOT REVIEWED); `CITRATE-SCHNEIDER-2017-METABOLISM`, `-PATTERNS` (expert viewpoint; Crit Care 2017;21:281; pending; `G01-CRRT-06` NOT REVIEWED); `CITRATE-ICU-GUIDE-2026-SAFETY` (guideline; recs 4.4–4.6; pending; `G01-CRRT-07` NOT REVIEWED). **Outside verification for `G01-CRRT-07`:** Rec 4.4 Grade 0 ⊕⊕⊝⊝; Rec 4.5 Grade A ⊕⊕⊝⊝; Rec 4.6 Grade B ⊕⊕⊝⊝ (read from the PMC full text; reviewer to confirm and record in G01 — not recorded there by this packet).
- **Limitation:** ranges and ratios are protocol-dependent; the "ratio > 2.5" claim is unverified.
- **Proposed bounded change:** per O-05C and O-08.
- **Decision required:** O-05C, O-08.

### G-06 — PrisMax alarms

- **Learner surface:** Lesson 5 "Alarms and cause-first troubleshooting"; five safety drills; CRRT-13, CRRT-14.
- **Implementation:** 13 generic simulated alerts, unmapped, no priority.
- **Sources:** `DEV-PM-007` (manual pp93–100 / PDF pp94–101), `DEV-PM-008` (manual pp101–169 / PDF pp102–170); AW8035 Rev B JUN2019; pending.
- **Limitation:** program 2.XX only (`G01-CRRT-04`).
- **Proposed bounded change:** per O-09 (a source-labeled reference list is the smallest step).
- **Decision required:** O-09.

### G-07 — Filter clotting

- **Learner surface:** Lesson 2 pressure localization; Lesson 5; CRRT-15, CRRT-16 (Challenge).
- **Implementation:** Filter burden rises too slowly to show a readable trend (+0.37 mmHg in 6 h); no filter exchange.
- **Sources:** `DEV-PM-009`, `DEV-PM-010`, `MATH-PM-002` (device manual; pending). Manual PDF p219 (TMP rise feeds the filter-clotting alarm; TMP > +300 mmHg alarm) and the alarm rows in §12 are located but not registered.
- **Limitation:** no filter-life source; −25 mmHg placement held.
- **Proposed bounded change:** register the PDF p219 statements as a device record if the device reviewer agrees; otherwise per O-06.
- **Decision required:** O-06, O-09.

### G-08 — Net ultrafiltration rate

- **Learner surface:** Lesson 7 "Fluid management and liberation"; CRRT-10, CRRT-11.
- **Implementation:** Two ledgers (machine removal, whole-patient balance); abstract tolerance indices; MAP held.
- **Sources:** `FLUID-PM-001`, `FLUID-PM-002` (device manual; manual p219 / PDF p220; pending); `WHITE-2024` (observational; Blood Purif 2024;53:624–633; pending); `GONEUTRAL-2024` (RCT; Intensive Care Med 2024;50:2061–2072; pending). Outside, not registered: Murugan 2019 (observational); KDIGO 2026 draft PP 5.8.1–5.8.2 and the UFNET table (PDF pp42, 313–314).
- **Limitation:** an association is not a threshold.
- **Proposed bounded change:** per O-08 (context sentence or omit).
- **Decision required:** O-02, O-08.

### G-09 — Vascular access

- **Learner surface:** Lesson 2 "Circuit anatomy and pressure localization" (access and return limbs).
- **Implementation:** Synthetic dual-lumen catheter descriptor and resistances; no site, length or catheter-choice teaching.
- **Sources:** none registered for site or length. Outside: KDIGO 2026 draft PP 5.4.1 (PDF p40) and chapter text (PDF p287: right internal jugular preferred, subclavian avoided — explanatory text); KDIGO 2012 site order per the walkthrough (not re-read).
- **Limitation:** no registered source; the draft is not final.
- **Proposed bounded change:** none, or one tier-labeled sentence after O-07.
- **Decision required:** O-07 row "Vascular access".

### G-10 — Drug dosing, nutrition, temperature

- **Learner surface:** Not in the lessons (Lesson 7 mentions "medication and nutrition needs" in the liberation paragraph); additional case CRRT-12 "Electrolyte, temperature, medication, and nutrition consequences".
- **Implementation:** CRRT-12 is adapted from CRRT-11; temperature and nutrition inputs are supplied scalars; nothing is modeled. CRRT-12 has no evidence-scope entry (§17).
- **Sources:** CRRT-12 cites `REVIEW-CKRT-CORE-2025` and `GUID-RRT-ICU-2026` (the guideline has a pharmacotherapy section that was not read for this packet). No registered drug-dosing, nutrition or temperature source.
- **Limitation:** entirely unsourced as a topic.
- **Proposed bounded change:** CRRT-12 evidence scope first (say what it does not carry); new teaching only with a pharmacist-named source.
- **Decision required:** O-10 rows 9–10.

---

## 17. Deferred technical anomalies and carried model limitations

Nothing below is repaired here. Classification uses the package vocabulary.

| Item                                                                                                                                                                | Classification                                            | Where recorded / how checked                                                                                                                                 | Owner / next step              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| CRRT-15 access pressure at t=0 reads −40.5 (evidence), −40 (live profile), −41 (device panel)                                                                       | DEFERRED (output truth, rounding)                         | Batch-04 handoff §4 item 5; Batch-04 sanity review "Deferred anomalies". Present at `85acc113` by tree identity with the reviewed head; not re-rendered here | Batch 06 or the Batch-01 owner |
| Device panel "Machine removal / whole balance: 0 mL / 0 mL" while evidence says whole-patient balance "Unavailable"                                                 | DEFERRED (output truth)                                   | Same                                                                                                                                                         | Batch 06 or the Batch-01 owner |
| Unsupported solute dynamics (all seven pools, all 18 cases)                                                                                                         | CONTAINED / MODEL NOT IMPLEMENTED                         | §4                                                                                                                                                           | O-01                           |
| CRRT-05 predilution effect                                                                                                                                          | MODEL NOT IMPLEMENTED                                     | §6                                                                                                                                                           | O-03                           |
| MAP / pressor response (CRRT-11 and clones)                                                                                                                         | MODEL NOT IMPLEMENTED                                     | §5                                                                                                                                                           | O-02                           |
| CRRT-16 true filter-loss model                                                                                                                                      | CONTAINED / MODEL NOT IMPLEMENTED                         | §9                                                                                                                                                           | O-06                           |
| CRRT-17 citrate physiology                                                                                                                                          | MODEL NOT IMPLEMENTED; evidence OWNER/SOURCE HOLD         | §8.1                                                                                                                                                         | O-05C                          |
| CRRT-18 renal-recovery physiology                                                                                                                                   | MODEL NOT IMPLEMENTED; evidence OWNER/SOURCE HOLD         | §8.2                                                                                                                                                         | O-05R                          |
| Makeup volume's patient-ledger role                                                                                                                                 | OWNER/SOURCE HOLD (`CONFLICT-CRRT-MAKEUP-001`)            | `circuitFluidLedger.ts`; manual PDF p218 (effluent pump can increase for makeup; `Qeff` includes `Qmakeup`), PDF p220 (`Vpfr` omits it)                      | Device reviewer                |
| −25 mmHg placement                                                                                                                                                  | OWNER/SOURCE HOLD (`G01-CRRT-02`)                         | §7                                                                                                                                                           | O-04                           |
| TMP −18 mmHg: PDF p219 describes it as a correction to filter and effluent pressures                                                                                | OWNER/SOURCE HOLD (new locator; `G01-CRRT-01` not edited) | §7                                                                                                                                                           | O-04T                          |
| Patient-level residual kidney clearance is not read by the solute step (CRRT-10 has 2 mL/min; pools carry 0)                                                        | KNOWN MODEL LIMITATION (new observation, code reading)    | §4                                                                                                                                                           | O-01                           |
| FF Plasma numerator, read with the manual's `Qeff`, includes dialysate; two `Qplasma` definitions                                                                   | OWNER/SOURCE HOLD (new observation, manual reading)       | Artifact C                                                                                                                                                   | O-03                           |
| CRRT-12 description claims changing electrolyte, temperature, medication and nutrition trends; no evidence-scope entry                                              | NOT REPRODUCED (code reading only; case not run here)     | `content/completeCases.ts` (CRRT-12 narrative); `content/caseEvidenceScope.ts` has entries for 05, 11, 15, 16, 17, 18 only                                   | Batch 06 check; O-10 row 10    |
| Shared seeds: CRRT-03 = CRRT-02; CRRT-08, -09 = CRRT-07; CRRT-12, -17, -18 = CRRT-11; CRRT-14 = CRRT-13; CRRT-16 = CRRT-15 (identical starting values in the probe) | KNOWN LIMITATION (not a defect by itself, F-16)           | Probe §2.1; Batch 02 §2 for 16/17/18                                                                                                                         | O-10 row 9                     |
| `latencySeconds` authored on every intervention, read by nothing                                                                                                    | BACKLOG (content/owner)                                   | Batch 02 §7; Batch 02 sanity review                                                                                                                          | O-10 row 14                    |
| `ConceptualCitrateState.linkedTrendDirections` dead state                                                                                                           | BACKLOG                                                   | Batch 02 §7                                                                                                                                                  | O-05C                          |
| CRRT-13 acknowledgment action does not mark the engine alert acknowledged                                                                                           | OWNER/SOURCE HOLD (device behavior)                       | Batch 02 §7                                                                                                                                                  | O-09                           |
| Shared `ActivityChrome` fixed "Reset" label; shared `PathwayLanding` minute badges; site header 51 px overflow at 200% root text                                    | GLOBAL / OTHER OWNER                                      | Batch-04 handoff §4 items 1–3                                                                                                                                | Platform owners                |
| Three pre-existing shared test failures (accessibility image name, curriculum-sequencing extra heading, learner-copy MV/MCS)                                        | GLOBAL / OTHER OWNER                                      | Batch-04 sanity review                                                                                                                                       | Other owners                   |

---

## 18. Missing source documents

| Missing document                                                                                                          | Why it is needed                                                                                      | Decisions blocked or weakened               |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Exact solution product records (manufacturer, product name, label or formulary revision) for every fluid a case would use | Solution composition cannot be inferred from a product family name                                    | O-01, O-05, G-10                            |
| KDIGO 2012 AKI guideline full text (Kidney Int Suppl 2012;2:1–138)                                                        | To verify the registered sections, their grades, and the lesson's "chapter 5.2" link                  | O-07, G-01, G-02, G-04, G-09, `G01-CRRT-08` |
| KDIGO 2026 AKI/AKD guideline, **final** version                                                                           | The public-review draft may change; re-check status before any statement is pinned                    | O-07, O-08, G-01–G-04, G-09                 |
| Schneider, Journois, Rimmelé 2017, full text                                                                              | The ratio claim and the cited passages were not re-read                                               | O-05C, O-08, `G01-CRRT-06`                  |
| Pistolesi et al. 2023 (SIAARTI-SIN), full text                                                                            | Cited passages not re-read                                                                            | O-05C, `G01-CRRT-05`                        |
| Human reading of the German–Austrian 2026 guideline for recs 4.4–4.6, 5.1, 7.x                                            | Grades here came through a retrieval tool                                                             | O-05, O-07, `G01-CRRT-07`                   |
| Baxter documentation stating which pressure reading carries the −25 mmHg correction, or a console observation (§7)        | The manual's wording supports more than one arithmetic                                                | O-04, O-04T, `G01-CRRT-02`                  |
| PrisMax operator's manual for the software the module should describe, if not program 2.XX                                | Display claims are scoped to 2.XX                                                                     | O-04, O-09, `G01-CRRT-04`                   |
| Prismaflex manual G5036003 Rev 05.2011 local copy                                                                         | `DEV-PF-005` (displayed, hydrostatically corrected drop) may be where the model's placement came from | O-04, `G01-CRRT-09`                         |
| A registered source for a filtration-fraction definition (and any ceiling)                                                | None in the registry or the KDIGO draft                                                               | O-03, G-03                                  |
| A filter/circuit-life source and an anticoagulation effect-size source                                                    | Needed for any simulated filter loss                                                                  | O-06, G-04, G-07                            |
| A source for hemodynamic response to net ultrafiltration                                                                  | Only if O-02 option C is chosen                                                                       | O-02                                        |
| Drug-dosing-on-CRRT, nutrition-loss and temperature references named by a pharmacist/dietitian                            | G-10 has no source at all                                                                             | G-10                                        |
| A source for a typical blood-flow range                                                                                   | F-25 asked for one; none registered                                                                   | O-08                                        |
| Local protocols approved for educational use (citrate/calcium, anticoagulation, blood return, alarm response)             | The module must not infer them                                                                        | O-05, O-06, O-09                            |
| A molar-mass reference for any mg ↔ mmol conversion                                                                       | Needed before any calcium or phosphate unit conversion                                                | O-01, O-05                                  |

---

## 19. Verification of this packet

| Check                                    | Result                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `origin/main` at start and before commit | Both `85acc113be11f9acbd395f49e00fee4b69ceff71`. No drift, so no reconciliation was needed; the packet describes the merged runtime at that commit.                                                                                                                                                                                                                      |
| Files changed                            | Exactly two new files: this packet and `CRRT-FELLOW-clinical-device-model-decision-queue.json`. No file under `src/`, `e2e/`, `scripts/` or `docs/gap-remediation/self-paced/` changed. No runtime handoff or shared index was edited.                                                                                                                                   |
| Referenced repository paths              | Every backticked repository path and file name in this packet exists at `85acc113` (scripted check). The package files (`FEEDBACK_LEDGER.md`, `OWNER_DECISIONS.md` and the others in §2.1) live in Local-Data, as stated.                                                                                                                                                |
| Source IDs                               | Every source ID in this packet and in the queue resolves: 76 through `baxterCrrtLearnerFacingSourceById` or `baxterCrrtSourceDocuments`, and `SYNTH-CRRT-17` / `SYNTH-CRRT-09` through the runtime case registry. Family references (`CITRATE-SIAARTI-2023-*`, `SYNTH-CRRT-nn`) are shorthand for resolved members. The queue builder asserts resolution for every item. |
| Locators                                 | PrisMax locators checked against the hash-verified local manual (PDF pp96–98, 102–161, 202–203, 218–221); all 28 cited alarm codes appear on their cited PDF pages. KDIGO 2026 draft locators are PDF pages of the March 2026 public-review draft. Registry locators are quoted from the registry.                                                                       |
| Review status unchanged                  | All 76 registry records: `reviewStatus: 'pending'`, `reviewer: null` (dumped from the live registry). `G01-crrt-source-review-queue.json` not edited; its test passes (`g01SourceReviewQueue`, `sourceMatrixIntegrity`: 2 suites, 8 tests passed).                                                                                                                       |
| New decisions                            | 34 queue items, all `status: "NOT REVIEWED"` with `reviewer`, `reviewerRole`, `reviewDate`, `decision`, `requiredChange`, `unresolvedDisagreement` null (scripted check). O-01–O-10 and G-01–G-10 all covered; E-01–E-10 and F-01 present.                                                                                                                               |
| Numbers                                  | Every number in the storyboards and proposals is an existing synthetic case value with its `SYNTH-CRRT-nn` record, a run output from a merged handoff, a sourced figure with its locator and tier, the walkthrough's worked pressure example (labeled), or a `⟨…⟩` placeholder. No new clinical value is proposed.                                                       |
| `git diff --cached --check`              | Clean.                                                                                                                                                                                                                                                                                                                                                                   |
| JSON / formatting                        | Queue parses; Prettier `--check` passes on both files (repository configuration).                                                                                                                                                                                                                                                                                        |
| Not run                                  | Full Jest, type-check, Playwright and build (no runtime change). No browser rendering of CRRT-12 or of the two deferred anomalies (their status rests on tree identity with the Batch-04 reviewed head).                                                                                                                                                                 |

---

## 20. Boundaries

- **No runtime change.** Only this packet and its JSON queue were added.
- **No source approval.** Every source record keeps `reviewStatus: 'pending'` and `reviewer: null`;
  every `G01-CRRT-*` decision stays NOT REVIEWED; `CONFLICT-001`, `CONFLICT-002`,
  `CONFLICT-CRRT-MAKEUP-001` and `CONFLICT-010` stay unresolved.
- **No clinical or device decision.** Options are listed; none is chosen.
- **No merge and no deployment.** One documentation-only PR.
- **Batch 06 not started.**
