# IP Board Navigator — handoff for the local session

Written at the end of the cloud sessions of 4–5 November 2026 so the work can continue locally. The
first part is the handoff; the second is the assessment and plan it follows.

## 1. Where things stand (2026-11-05)

| Item                                                          | State                                                                                                                                                                                                                 |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR #450 (Navigator foundation, 24 objectives)                 | **merged** into `main`                                                                                                                                                                                                |
| PR #451 (typed-route fix to the map screen, by owner)         | **merged**                                                                                                                                                                                                            |
| PR #452 (Session 1: exam-level schema + pleural/staging pass) | **open**, branch `claude/lucid-tesla-e44ac6`, CI green, 45 tests pass. Merge it, then start Session 2 from a fresh branch off `main`.                                                                                 |
| Numbers register                                              | 41 rows, **all unsigned**. `npm run numbers:signoff -- board-navigator` prints them.                                                                                                                                  |
| Owner decisions pending                                       | (a) pneumothorax shows ACCP 2001 / BTS 2010 / BTS 2023 side by side — keep? (b) EBUS ≥ 5 mm sampling threshold attributed to ACCP 2013 — keep? (c) a `pathology-molecular` blueprint topic is proposed for Session 6. |

Module: `src/features/board-navigator` · routes `src/app/[locale]/board-navigator/*` · docs
`docs/board-navigator.md` (architecture, status rules, authoring rules). Release stage is
`unlisted-preview` (direct link only, noindex) in `content/release.ts`.

## 2. Local setup (from CLAUDE.md / AGENTS.md)

```bash
cd /Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/claude
git fetch origin && git switch -c claude/navigator-s2 origin/main
npm run dev:claude          # port 3120; the Navigator is at /en/board-navigator
```

The site header's Supabase client needs `.env.local` (present in the primary checkout, mounted
read-only); the Navigator itself needs no backend. Fast checks for the module:

```bash
npx jest src/features/board-navigator
npx eslint src/features/board-navigator "src/app/[locale]/board-navigator"
npx prettier --check src/features/board-navigator
node --max-old-space-size=6144 node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

`tsc` in a fresh checkout reports `contentlayer/generated` errors until `npm run build:content` has
run once; those are not the module's.

## 3. How an objective is built (the schema you will fill)

Content files: `content/labs/{staging,pleural,airway,therapeutics}.ts` (Session 4 adds
`labs/diagnostic.ts`; register it in `content/objectives.ts`). Each `LearningObjective`
(`content/types.ts`):

```ts
{
  id: 'pl-08',                       // area prefix + two digits; task ids are `${id}.diagnose` etc.
  topicId: 'pleural-disease',        // a TopicId from content/blueprint.ts (set pilot: true there)
  secondaryTopicIds: ['pleural-procedures'],
  title: '…',                        // a verb phrase, no answer in it
  competency: 'You can …',
  whatToKnow: ['…', '…', '…'],       // numbers via num('register-id'), never typed
  prerequisites: ['pl-04'],
  concepts: ['complication', 'rescue'],   // ConceptTag in content/concepts.ts
  safetyCritical: true,
  misconceptions: [{ id: 'pl-08.remove-ipc-when-infected', label: '…wrong model…', repair: '…' }],
  resources: [{ label, href, kind }],     // href must be an existing route (test checks)
  sourceIds: ['fysh-ipc-infection-2013'],  // ids in content/sources.ts
  evidence: [{ id: 'pl-08.fysh', label: 'IPC-related infection, multicentre', year: 2013,
               design: 'cohort', population: '…', headline: `… ${num('ipc-infection-rate')}.`,
               caveat?: '…', sourceId: 'fysh-ipc-infection-2013' }],
  positions?: [{ body: 'BTS', year: 2023, statement: '…', sourceId: '…' }, …],  // ≥2 if present
  estimatedMinutes: 6,
  lab: {
    diagnose: Task,                  // kind: choice | predict | sequence | sort | hotspot
    repair: { principle, explanation: [p1, p2, p3], distinction, manipulate?: PredictTask },
    verify: Task,                    // MUST be a different kind from diagnose
  },
  provenance: EXAM_PROVENANCE,
}
```

Every `Task` carries `stemConstraints: ['…', '…']` (≥ 2 on diagnose and verify at the exam content
version), `hint`, `teachingPoint`, `sourceIds`, and per-option `rationale` with
`misconceptionId` on the options that encode a documented wrong model. Grading rules live in
`engine/lab.ts` (sequence: `earlyMisconceptions`; sort: item `misconceptionId`; hotspot:
`regionMisconceptions`).

**Content tests you must keep green** (`__tests__/content-integrity.test.ts`): unique ids; verify
kind ≠ diagnose kind; ≥ 2 misconceptions per objective, all referenced ids exist and at least one is
referenced; all `sourceIds` registered; resources resolve to a `page.tsx` (board-prep and
ebus-training slugs are checked against their data files); no grading vocabulary in learner copy
(score, points, grade, mastery, quiz, exam, certification, competent — "LENT score"/"RAPID score"
are whitelisted); no "correct/incorrect" in stems or option labels; exam-level objectives carry
evidence and ≥ 2 constraints per stem; numbers register rows trace to a registered source.

**Numbers register** (`content/teachingNumbers.ts`): one row per clinical number, with class
(guideline / consensus / device / expert-reference / physiology / teaching-convention), source id,
year, grade or null, a locator, `...CHECK`. Copy reads `num('id')`. A teaching convention needs a
`note`. Never type a number into copy.

**Sources** (`content/sources.ts`): add `{ id, kind, citation, year, url? }`. In Session 1 every
citation was matched to a PubMed record (journal, year, first page, first author) before entry;
do the same locally with the PubMed MCP or a manual PubMed check. One citation was **not**
resolvable and was left out: Nakajima's nodal vascularity paper (the lookup returned the wrong
article) — verify it before citing.

## 4. The remaining sessions, in order

Each is one branch, one PR, with the fast checks above and one dev-server look at a new lab.

**S2 — airway and therapeutics pass (ao-01…ao-06, tm-01…tm-04).** Same treatment as S1: switch
`PILOT_PROVENANCE` → `EXAM_PROVENANCE` in `labs/airway.ts` and `labs/therapeutics.ts`, replace
`evidence: []`, add `stemConstraints` to every diagnose and verify, stack the stems, add one
exam-tested distractor each. Specific items: AQuIRE outcomes and predictors (ao-01, ao-05);
hour-glass silicone / external fixation / mitomycin (ao-02); inner-to-outer ratio by material and
partially covered ends (ao-03); rates by stent type, LRTI, heliox temporiser, embedded SEMS needs
rigid (ao-04); rigid via stoma, obesity and cannot-lie-flat not absolute, jet ventilation ports
open, bleeding side down (ao-05); peak-flow monitoring, relapsing polychondritis (ao-06);
cryodebulking bleeding 4–25 %, cryo at high FiO₂ (tm-01); cryo/mechanical as the high-FiO₂
alternatives (tm-02); physics numbers belong in tm-05, not here (tm-03). **Correct the
`apc-depth` row**: value "about 1–3 mm, superficial", note that ERS/ATS 2002 prints 2–3 mm and
other reviews 1–2 mm. Sources to add and verify: AQuIRE complications (Ost, Chest 2015) and
outcomes (Ost, AJRCCM 2015); Cardillo 2010 EJCTS if ao-08 is pulled forward.

**S3 — seven new pleural objectives.** pl-08 IPC complications and infection (manage through the
IPC with MIST2 doses; thoracentesis from a separate site for culture; flush → tPA for blockage;
daily vs symptom-guided drainage); pl-09 IPC for non-malignant effusions and hepatic hydrothorax
(10 % infection, mortality, serial tap cumulative risk, chest tubes dangerous, MDT); pl-10
pleurodesis evidence (TIME1, TAPPS, AMPLE, cost by survival, chemotherapy timing uncertain,
benign effusions pleurodese less); pl-11 undiagnosed exudate pathway (cytology → thoracoscopy,
chest pain suggests malignancy, bronchoscopy ≈ 2 %, chylothorax TG > 110, duropleural
β2-transferrin, mesothelioma tract RT no benefit); pl-12 pleural infection beyond pH (antibiotics
with anaerobic cover, split-pleura sign, post-pneumonectomy empyema first step, haemothorax Hct ≥
50 %, retained haemothorax: EAST VATS first-line, lytics in non-surgical candidates); pl-13
pneumothorax recurrence and persistent air leak (second PSP → VATS; indications list; catamenial;
SSP recurrence ≈ 50 % → talc; EBV criteria 7 days / 5 days with features; blood patch ≈ 92 %;
pigtail vs large bore equal success, shorter stay; triangle of safety; PSP + positive pressure →
tension); pl-14 pleural procedures under bleeding risk (Hibbert; antiplatelet agents; paravertebral
tortuous arteries in the elderly). Sources to add: Bayman 2019 JCO (PIT), EAST (Mowery 2011),
Hendriksen 2019, Dhooria semirigid vs rigid, MINT, COFFEE, Puri already in.

**S4 — eight diagnostic-bronchoscopy objectives** in a new `labs/diagnostic.ts` (topics
`advanced-diagnostic-bronchoscopy`, `ebus`): db-01 sampling technique evidence (passes, gauge,
suction, ROSE — register rows already exist from S1); db-02 tissue for molecular testing (≥ 4
passes, formalin not Bouin, minimal IHC, ≈ 94 % adequacy, NCCN panel, squamous → PD-L1 only);
db-03 EBUS beyond lung cancer (sarcoid ≈ 75 % + TBLB; lymphoma poor de novo, miniforceps/cryo;
calcified and congestive nodes); db-04 image problem-solving (reverberation → contact, central
vessel → sample periphery, 4L view = aorta above / left PA below, EUS stations 5/8/9, cTBNA at 7);
db-05 peripheral nodule strategy (rEBUS within 78.7 % / adjacent 52 % / overall ≈ 70 %; bronchus
sign 79 vs 31 %; needle adds yield; ENB vs rEBUS; ultrathin; robotic reach; PEEP 8–10 (VESPA);
consent numbers PTX 1–5 %, transfusion < 1 %); db-06 sedation and anaesthesia evidence (GA vs
moderate no difference; anticholinergics discouraged; benzocaine methaemoglobinaemia; nebulised
lidocaine no benefit; spray catheter fewer coughs; OSA; echo before TBBx in PH risk); db-07 ICU and
immunocompromised bronchoscopy (TBBx in ventilated: PTX ≈ 9.5 %, bleeding ≈ 8.9 %, diagnosis ≈ 63 %;
BAL changes management ≈ 38 %; allogeneic > autologous; transplant surveillance ≥ 5 pieces, lower
PTX); db-08 cryobiopsy (indications = SLB after MDD; COLDICE 70.8 % agreement, 22 % bleeding, 2 %
PTX; CAN-ICE; 1.9 mm probe; 1 cm from pleura; blocker; non-diagnostic ≈ 20 % most common
complication). Sources: Wahidi ACCP 2011, Casal AJRCCM 2015, Oki 2015, Ali 2017, Eberhardt 2007,
NAVIGATE 2019, VESPA 2022, Chen 2018, Helgeson 2020, Bauer 2019, Hetzel 2018, COLDICE 2020, CAN-ICE
2023, ISHLT 2007, Lee 2013 (spray catheter). The `station-schematic` hotspot figure can be reused
for db-04; an EBUS-image figure would need new artwork (optional).

**S5 — therapeutic depth.** ao-07 stent types compared (merge sizing detail from ao-03); ao-08
tracheal injury (Cardillo levels; conservative < 2 cm; covered SEMS for level II) and transplant
anastomotic complications (dehiscence → uncovered SEMS exchanged in 2–6 weeks; stenosis → silicone;
risk factors); ao-09 rigid bronchoscopy in practice; ao-10 patient selection and outcomes in
malignant CAO (AQuIRE 3.9 % / 0.5 %; ECOG > 1 / ASA > 3; survival equal to stage; ventilated patients
liberated; no intervention when asymptomatic / PS 4; debulk before chemoradiation; fibrosing
mediastinitis caution); tm-05 energy physics (electrocautery ≈ 40 / 70 / 100 / 200 °C; APC lateral
flow, depth, gas-flow embolism; laser depth by colour, CO₂ poor haemostasis, pacemaker-safe; PDT
non-thermal; cryosensitivity by water content; spray cryo barotrauma precautions); tm-06 delayed
modalities, early central cancer (< 2 cm, no cartilage invasion; modalities equivalent; surveillance
3–6 months), carcinoid (> 20 mm → surgery; surveillance 6 weeks / 6-monthly × 2 y / annual), RRP
(HPV 6/11; cidofovir/bevacizumab; tracheostomy spreads). Sources: Ernst 2004 (in), Bolliger 2002
(in), ACCP 2013 carcinoid (Detterbeck) and early central cancer (Wisnivesky), Finley spray cryo,
Derkay RRP.

**S6 — new blueprint topics.** lv-01 BLVR (FEV₁ 15–45 %, RV ≥ 175 %, TLC ≥ 100 %, 6MWD; StratX /
Chartis; heterogeneity > 10–20 %; PTX 18–34 % mostly in 3 days; remove valves for leak ≥ 5 days;
CELEB; IMPACT; Labarca meta-analysis RR 6.3); lv-02 thermoplasty and chronic-bronchitis therapies
(14-day rule; AIR2; BT10+; rheoplasty/TLD/cryospray exclusions); ph-01 airflow physics, heliox,
dynamic collapse, peak flow for LTS; tx-01 transplant airway surveillance; pa-01 pathology at ROSE
and molecular panel (needs a `pathology-molecular` topic in `blueprint.ts`); st-01 staging corner
cases. Set `pilot: true` on each topic as it gains an objective.

## 5. Pitfalls met in the cloud sessions

- **Prettier reflows long strings.** After `npx prettier --write`, anchors for scripted edits no
  longer match. Edit after formatting, or re-grep the current text.
- **`tsc` needs memory**: run it with `--max-old-space-size=6144` or it aborts with exit 134.
- **Dev server**: `next dev` without `--webpack` fails on a Tailwind class in a test file; the
  project's `npm run dev:claude` already passes `--webpack`.
- **Vocabulary gate**: "pass", "fail", "score", "grade", "mastery", "exam", "quiz" fail the content
  test in learner copy. "Failed pleurodesis" → "pleurodesis that did not take". Clinical instrument
  names are whitelisted in the test (`CLINICAL_SCORE_NAMES`); extend that list rather than
  renaming an instrument.
- **Hotspot and `role="radio"` queries in tests** match on full option labels; when a label
  changes, update `__tests__/repair-lab.test.tsx` (it uses `/^Station 4L, as recorded/`).
- **The record is per device** (`ip-board-navigator-v1` in localStorage); retired objective ids are
  dropped on parse, so renaming an id loses that objective's evidence for existing learners.
- Keep `pass`/`exam` out of stems even where the bank uses them; the Navigator is not an exam.

## 6. Prompt to start the local session

> Read `docs/board-navigator-handoff.md` and `docs/board-navigator.md`. We are on Session 2 of the
> exam-level calibration of the IP Board Navigator. Start a branch `claude/navigator-s2` from
> `origin/main` in the claude worktree. Move `labs/airway.ts` and `labs/therapeutics.ts` to
> `EXAM_PROVENANCE`: add evidence cards with verified sources, `stemConstraints` (≥ 2) on every
> diagnose and verify task, stack each stem with at least two competing constraints, add one
> exam-tested distractor per objective, and correct the `apc-depth` register row to show both
> sources. Do not reuse any question-bank scenario or option list. Run the module's jest, eslint,
> prettier and tsc checks, open one new lab in the dev server, then open a PR titled
> "feat(board-navigator): exam-level calibration pass on the airway and therapeutics objectives (S2)".

---

# Original assessment and plan (approved 2026-11-05)

## Context

The Navigator shipped in PR #450 with 24 pilot objectives. The owner's review: the content is "really
basic" relative to the exam. The attached question bank (193 items: Advanced Therapeutic Bronchoscopy
60, Airway Disease / diagnostic bronchoscopy 54, Pleural Disease 66, Pathology 13) shows the level the
exam actually tests. The owner does **not** want the bank's cases reused (the Navigator must not compete
with a question bank); the bank is a calibration instrument only. Budget is tight (~$60 of cloud
credits), so this plan is sequenced so each session is one small PR with the highest-yield change first,
and so most of the work is content files in a schema that already exists.

Nothing in this plan copies a bank vignette, option set or rationale. Scenarios are authored fresh;
only the underlying evidence (trials, guidelines, device facts) is shared, cited from primary sources.

---

## Part 1 — Assessment

### 1.1 What the exam level looks like (from the bank)

1. **Stems stack three or four constraints and ask for the one decision they jointly force.** A typical
   stem combines an airway finding, an oxygenation limit (cannot hold FiO₂ ≤ 0.4), an anatomical limit
   (mouth opening, cervical fusion, cannot lie flat), a timing demand (relief needed today vs in weeks),
   performance status, and device availability. The Navigator's current stems carry one or two.
2. **Trial-level evidence is expected by name, with its design and headline numbers**, and the
   distractors are built from misreadings of the same trial. Named repeatedly: MIST1 and MIST2 (doses,
   DNase-alone worse than placebo, 67 % completed six doses, tube size no outcome difference but less
   pain), TIME1 (NSAIDs non-inferior; 12F not non-inferior), TIME2 and AMPLE (equal dyspnoea relief,
   fewer hospital days), TAPPS (poudrage = slurry, equal cost), Puri cost-effectiveness (survival > 12
   months favours bedside pleurodesis), LENT and RAPID scores, COLDICE and CAN-ICE (cryobiopsy),
   AQuIRE (3.9 % complication, 0.5 % mortality; ECOG > 1 / ASA > 3 predict 30-day mortality), AIR2 and
   BT10+, CELEB and IMPACT and the Labarca meta-analysis (BLVR), VESPA (PEEP 8–10), NAVIGATE, Oki
   (ultrathin), Fujiwara (node features), Fysh and Shojaee (IPC infection), Bayman/PIT (mesothelioma
   tract radiotherapy), Hibbert (thoracentesis in thrombocytopenia), Cardillo (tracheal injury levels).
3. **Device physics and mechanism numbers are tested directly**: electrocautery tissue temperatures
   (≈40 / 70 / 100 / 200 °C), APC depth and gas-flow embolism risk, laser depth by target colour, CO₂
   laser poor haemostasis, lasers safe with pacemakers, PDT non-thermal mechanism, cryosensitivity by
   water content (cartilage resistant), spray-cryotherapy barotrauma precautions, jet-ventilation ports
   open, heliox physics, obstruction thresholds (≈50 % → exertional, ≈75 % → rest).
4. **Comparative device facts with rates**: silicone vs SEMS inner/outer ratio, migration (straight
   silicone 5–10 %, Y rare), mucostasis (silicone, left-sided), granulation (uncovered metal, partially
   covered ends), LRTI association, embedded SEMS need rigid removal, uncovered SEMS deliberately used for
   transplant dehiscence and exchanged in 2–6 weeks, covered SEMS for Level II tracheal laceration.
5. **Patient-selection and outcomes reasoning**: when _not_ to intervene (asymptomatic, ECOG 4),
   recanalise before chemoradiation, ventilated patients can be liberated, fibrosing mediastinitis
   caution, cost and hospital-days arguments, drainage schedules vs spontaneous pleurodesis.
6. **Pathology and molecular literacy at ROSE**: small-cell morphology and its mimics (lymphoma, poorly
   differentiated squamous), carcinoid chromatin, granuloma → cultures first, AFB speciation by PCR on
   FFPE, DIPNECH, stains used at ROSE, the NCCN biomarker panel, EGFR + high PD-L1 → TKI, squamous →
   PD-L1 only, ≥ 4 passes and formalin (not Bouin) for molecular work, minimal IHC.
7. **Where guidelines disagree the exam tests both positions** (ACCP 2001 vs BTS pneumothorax; ACCP
   "sample every node ≥ 5 mm" during staging; chest-tube size).

### 1.2 Gap table against the current 24 objectives

| Area                        | Current objective(s)                         | Depth the exam tests that is missing                                                                                                                                                                                                            | Fix type                                          |
| --------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Station anatomy (ms-01)     | Boundaries from landmarks, schematic hotspot | EBUS-image landmark reading (4L view = aorta above, LPA below; BCV/SVC junction = 2R/4R region); the "upper rim of _left_ PA, not main PA" trap; EUS-only stations 5, 8, 9                                                                      | Deepen + 1 new image-reading objective            |
| N descriptor (ms-02)        | N1/N2/N3, TNM-9 N2a/b                        | T descriptors tested alongside (separate nodule same lobe = T3; recurrent laryngeal palsy = T4 → IIIB); stage group consequence                                                                                                                 | Deepen                                            |
| Sampling order (ms-03)      | N3 → N2 → N1                                 | Diagnosis-first vs staging-first logic when stage IV is already evident (largest node, station 7 by cTBNA); cTBNA inferior to EBUS except station 7                                                                                             | Deepen                                            |
| Who needs staging (ms-04)   | ACCP indications, 4R/4L/7                    | ACCP "every station ≥ 5 mm on EBUS" rule; negative CT/PET central tumour still staged; EUS add-on                                                                                                                                               | Deepen (numbers)                                  |
| Node features (ms-05)       | Fujiwara features                            | Vascularity patterns (central single vessel → sample periphery), reverberation artefact fix, "no feature obviates biopsy" phrasing                                                                                                              | Deepen                                            |
| Adequacy / ROSE (ms-06)     | Lymphocytes = adequate                       | Evidence on ROSE (no yield gain; fewer passes/procedures), 3-pass plateau, 21 vs 22 G, suction vs capillary, ≥ 4 passes for molecular, fixative, minimal IHC, 94 % adequacy                                                                     | New objective (db-01/db-02)                       |
| Staging → decision (ms-07)  | Confirm negative high-pretest                | Full stage synthesis incl. T; non-surgical stage IIIB; squamous unlikely EGFR                                                                                                                                                                   | Deepen                                            |
| Light's (pl-01)             | Criteria + gradient                          | Fine. Add chylothorax (TG > 110 / chylomicrons), duropleural (β2-transferrin), haemothorax definition (Hct ≥ 50 % serum), traumatic tap pattern                                                                                                 | New objective (pl-11)                             |
| Parapneumonic (pl-02)       | pH < 7.2 drain                               | Full fluid profile, antibiotics with anaerobic cover, RAPID score, split-pleura sign, small vs large tube (MIST1), tube flushing, post-pneumonectomy empyema first step                                                                         | Deepen + new (pl-12)                              |
| tPA/DNase (pl-03)           | MIST2 regimen                                | Chaddha consensus (individualise dose count; 67 % completed), use through an IPC, retained haemothorax lytics (EAST), no systemic bleeding signal                                                                                               | Deepen                                            |
| MPE management (pl-04)      | IPC vs talc, NEL                             | TIME1 (NSAIDs, 12F), TAPPS, AMPLE, Puri cost by survival, drainage schedule vs pleurodesis (45–50 %), chemotherapy timing uncertain, LENT, pericardial-effusion mimic                                                                           | Deepen + new (pl-10)                              |
| NEL (pl-05)                 | Elastance, ex vacuo                          | Normal pleural pressure −3 to −5; measurement independent of catheter tip; manage symptomatic tap by observation 30–60 min; stop suction on CT-found ex-vacuo                                                                                   | Deepen                                            |
| Pneumothorax (pl-06)        | BTS 2023 symptom-led                         | ACCP 2001 position must be taught alongside (size/symptom → tube; aspiration not adopted); second PSP → VATS; definitive indications list; catamenial; SSP recurrence ≈ 50 % → talc; pigtail vs large bore evidence; PSP + intubation → tension | Deepen + new (pl-13)                              |
| US site (pl-07)             | Real-time, above rib                         | Paravertebral tortuous arteries in the elderly, triangle of safety, coagulopathy/thrombocytopenia evidence (no reversal; Hibbert)                                                                                                               | New objective (pl-14)                             |
| CAO classification (ao-01)  | Intrinsic/extrinsic/mixed                    | AQuIRE outcomes and predictors, when not to intervene, debulk before chemoradiation, ventilated-patient liberation, CT clues to viable collapsed lung                                                                                           | New objective (ao-10)                             |
| Benign stents (ao-02)       | FDA 2005                                     | Hour-glass silicone, external fixation, mitomycin adjunct, post-transplant stenosis → silicone, GPA stenosis                                                                                                                                    | Deepen                                            |
| Sizing (ao-03)              | Diameter/length logic                        | Inner/outer ratio by material; partially covered ends granulate                                                                                                                                                                                 | Merge into new stent-comparison objective (ao-07) |
| Stent complications (ao-04) | Plug/migrate/granulate                       | Rates by type, LRTI association, heliox as temporiser, embedded-SEMS removal needs rigid, left-sided plugging                                                                                                                                   | Deepen + ao-07                                    |
| Rigid selection (ao-05)     | Silicone needs rigid; contraindications      | Rigid via stoma; obesity and cannot-lie-flat are not absolute; jet ventilation (ports open; alarm = tubing first); bleeding side down                                                                                                           | Deepen + new (ao-09)                              |
| Benign stenosis (ao-06)     | Simple vs complex                            | Peak-flow monitoring of LTS; relapsing polychondritis; idiopathic SGS demographics                                                                                                                                                              | Deepen                                            |
| Modality timing (tm-01)     | Immediate vs delayed                         | Cryodebulking bleeding 4–25 %; cryo can proceed at high FiO₂; AQuIRE modality mix                                                                                                                                                               | Deepen                                            |
| Airway fire (tm-02)         | FiO₂ ≤ 0.4                                   | Fine; add that cryo/mechanical are the high-FiO₂ alternatives                                                                                                                                                                                   | Deepen                                            |
| Modality by lesion (tm-03)  | Shape, silicone nearby                       | Physics numbers (temperatures, APC depth/flow/embolism, laser colour, CO₂, pacemaker), PDT mechanism and candidates                                                                                                                             | New objective (tm-05)                             |
| Dilation (tm-04)            | Simple vs complex                            | Fine                                                                                                                                                                                                                                            | —                                                 |

### 1.3 Blueprint topics with no coverage that the bank tests heavily

- **Bronchoscopic lung-volume reduction** (9 items): candidacy numbers, StratX/Chartis logic,
  heterogeneity threshold, pneumothorax 18–34 % mostly in 3 days, valve removal for persistent leak,
  CELEB (BLVR ≈ LVRS at 1 year), IMPACT (homogeneous).
- **Bronchial thermoplasty and chronic-bronchitis therapies** (5 items): contraindications (14-day
  steroid/exacerbation rule), AIR2 findings, BT10+, rheoplasty/TLD/cryospray exclusion logic.
- **Transplant airway complications** (6 items): dehiscence grading and uncovered-SEMS strategy,
  stenosis management, risk factors (fungal infection, telescoping, long donor bronchus), surveillance
  biopsy ≥ 5 pieces, lower pneumothorax rate.
- **Peripheral nodule strategy** (9 items): yields by technique and view, bronchus sign (79 % vs 31 %),
  needle adds yield, ENB vs rEBUS, ultrathin, robotic access, VESPA PEEP, consent numbers.
- **Sedation / anaesthesia evidence** (4 items): GA vs moderate, anticholinergics discouraged,
  benzocaine, lidocaine delivery, OSA, echo before TBBx in PH risk.
- **ICU / immunocompromised bronchoscopy** (5 items): TBBx in ventilated (PTX 9.5 %, bleeding 8.9 %,
  diagnosis 63 %), BAL changes management 38 %, allogeneic > autologous yield.
- **Transbronchial cryobiopsy** (5 items): indications = SLB after MDD, COLDICE/CAN-ICE, 1.9 mm probe,
  1 cm from pleura, blocker, complication ranking.
- **Pathology / molecular** (13 items): see 1.1 item 6.
- **Early-stage central cancer, carcinoid, RRP, TEF, tracheal injury** (10 items).
- **Pleural: IPC complications and benign effusions** (14 items): the largest single pleural gap.

### 1.4 Content-correctness notes found while comparing

- **APC depth**: register row `apc-depth` says 2–3 mm (ERS/ATS 2002); the bank and other reviews say
  1–2 mm. Teach as "about 1–3 mm, superficial" and show both sources in the row's note.
- **Pneumothorax (pl-06)**: currently teaches the BTS 2023 symptom-led pathway only. The exam still
  tests ACCP 2001 (tube for large/symptomatic; aspiration not endorsed). Show both, attributed.
- **ms-04/ms-05**: add the ACCP 2013 "sample nodes ≥ 5 mm" rule beside the ≥ 10 mm CT enlargement
  threshold; the two numbers answer different questions.
- **pl-03**: add that monotherapy arms were not just "no better" but DNase-alone had _more_ surgical
  referrals (already stated) and that only 67 % completed six doses, so dose count is individualised.

---

## Part 2 — Implementation plan

### 2.1 Schema changes (small, once; `src/features/board-navigator/content/types.ts`)

1. **`evidence: readonly EvidenceCard[]` on `LearningObjective`** — `{ id, label (trial or guideline
name), year, design (RCT / meta-analysis / registry / guideline / consensus), population, headline
(one sentence with the number), caveat?, sourceId }`. Rendered in the Explain panel as "Evidence
   behind this" and on the Curriculum page. Tests: every `sourceId` registered; every objective with
   `safetyCritical` or a numbered claim has ≥ 1 card.
2. **`positions?: readonly GuidelinePosition[]`** — `{ body, year, statement, sourceId }` for topics
   where bodies differ (pneumothorax, chest-tube size, node sampling threshold). Rendered as a
   two-column "Where sources differ" block; the task's answer names the body it follows.
3. **`stemConstraints: readonly string[]` on `TaskBase`** (authoring metadata, not rendered): the
   constraints the stem stacks (e.g. `['fio2>0.4', 'cannot-lie-flat', 'needs-relief-today']`). Test:
   every diagnose and verify stem on an exam-level objective lists ≥ 2; keeps authors honest about
   depth without changing the renderer.
4. No new task kinds. The five existing kinds cover the bank's formats (one-best-answer, "which changes
   the plan" predict, sequence, sort, schematic hotspot). A **`compare` sort** (two devices × features)
   is just a `sort` with device buckets.

### 2.2 Authoring rules for exam-level objectives (add to `docs/board-navigator.md`)

- Stem = a decision forced by ≥ 2 competing constraints; name the patient's performance status,
  oxygen requirement or anatomy whenever it changes the answer.
- Every rationale that cites evidence names the study and its headline number via an `EvidenceCard`,
  and the number sits in the register (`num()`), never typed.
- Distractors are the bank's recurring wrong models expressed generically: "delayed modality for an
  acute airway", "treat the number not the patient", "remove the IPC when it infects", "bigger tube is
  better", "ROSE raises yield", "node looks benign so skip it", "metal in benign airway", "size decides
  the pneumothorax".
- Where two bodies disagree, the stem states which setting/guideline frame applies, and the
  `positions` block shows the other.
- Fresh scenarios only. Rule of thumb: change at least three of {age/sex, disease, side, numbers,
  setting, the decision asked} relative to anything in the bank; never reuse a bank option list.

### 2.3 Sources to register (`content/sources.ts`)

Verify each citation against PubMed at authoring time (the PubMed MCP is available). Grouped:

- Pleural trials/guidelines: MIST1 (Maskell 2005 NEJM) and its tube-size analysis (Rahman 2010 Chest);
  TIME1 (Rahman 2015 JAMA); AMPLE (Thomas 2017 JAMA); TAPPS (Bhatnagar 2020 JAMA); Puri 2012 Ann
  Thorac Surg; LENT (Clive 2014 Thorax); RAPID (Rahman 2014 Chest); Fysh 2013 Chest (IPC infection);
  Shojaee 2019 Chest (hepatic hydrothorax IPC); Chaddha 2021 (fibrinolytic/DNase consensus); Bayman
  2019 JCO (PIT); Hibbert 2013 Chest; MacDuff BTS 2010 pneumothorax; Baumann ACCP 2001 pneumothorax;
  EAST retained haemothorax (Mowery 2011); Hendriksen 2019 (lytics in retained haemothorax); Dhooria
  (semirigid vs rigid), MINT, COFFEE (pleural cryobiopsy).
- Diagnostic bronchoscopy: Wahidi ACCP 2011 sedation consensus; Casal 2015 AJRCCM (GA vs moderate);
  Casal 2012 (suction vs capillary); Trisolini 2015 (ROSE and genotyping); Oki 2015 AJRCCM (ultrathin);
  Ali 2017 meta-analysis (rEBUS); Eberhardt 2007; NAVIGATE (Folch 2019); VESPA (Salahuddin 2022
  Chest); Chen 2018 (robotic reach); Helgeson 2020 (TBBx in ventilated); Bauer 2019 (BAL in ICU);
  Hetzel 2018 (cryobiopsy statement); COLDICE (Troy 2020 Lancet Resp Med); CAN-ICE (Fortin 2023);
  ISHLT 2007 biopsy adequacy; Nakajima (nodal vascularity); Navani/Gupta (sarcoid EBUS yield).
- Therapeutic: AQuIRE (Ost 2015 Chest complications; Ost 2015 AJRCCM outcomes); Cardillo 2010 EJCTS;
  Labarca 2019 (EBV meta-analysis); CELEB (Buttery 2023 AJRCCM); IMPACT (Valipour 2016; Eberhardt
  2021); AIR2 (Castro 2010 AJRCCM); BT10+ (Chaudhuri 2021 Lancet Resp Med); Chupp 2017 (PAS2); ACCP
  2013 carcinoid surveillance (Detterbeck); ACCP 2013 early central cancer (Wisnivesky); RRP review
  (Derkay); Reddy/Freitag on stents; Finley (spray cryotherapy complications).
- Pathology: NCCN NSCLC biomarker list (current version); CAP/IASLC/AMP molecular testing guideline
  (Lindeman 2018); Travis WHO neuroendocrine criteria.

### 2.4 Numbers register additions (`content/teachingNumbers.ts`, all unsigned until owner review)

EBUS node sampling threshold ≥ 5 mm (ACCP 2013); EBUS passes 3 (plateau) / 4 (molecular); EBUS
molecular adequacy ≈ 94 %; cTBNA vs EBUS yield statement; rEBUS yield within 78.7 % / adjacent 52 % /
overall 70.6 %; ENB bronchus sign 79 % vs 31 %; peripheral PTX 1–5 %; AQuIRE 3.9 % / 0.5 %; obstruction
thresholds 50 % / 75 % cross-section; electrocautery 40 / 70 / 100 / 200 °C; APC depth (both sources);
cryodebulking bleeding 4–25 %; straight silicone migration 5–10 %; MIST2 completion 67 %; TIME1 12F vs
24F; TIME2/AMPLE hospital-day medians; IPC infection 0–12 % (pooled 4.9 %), ≥ 6–8 weeks, blockage
< 5 %, spontaneous pleurodesis ≈ 46 %; hepatic hydrothorax IPC infection 10–16 %, mortality 2–3 %;
cytology sensitivity ≈ 60 % (+20–25 % second tap); pleuroscopy ≈ 95 %; bronchoscopy for undiagnosed
effusion ≈ 2 %; PSP recurrence ≈ 50 % at 5 years; SSP recurrence ≈ 50 %; haemothorax Hct ≥ 50 %;
surgical haemothorax 1500 mL / 200 mL·h⁻¹ × 4 h; chylothorax TG > 110 mg/dL; normal pleural pressure
−3 to −5 cmH₂O; Lan elastance ≥ 19 result; EBV criteria (FEV₁ 15–45 %, RV ≥ 175 %, TLC ≥ 100 %, 6MWD);
BLVR pneumothorax 18–34 %; thermoplasty 14-day rule; persistent air leak 5–7 days; blood patch ≈ 92 %;
tracheal laceration conservative < 2 cm; transplant biopsy ≥ 5 pieces; VESPA PEEP 8–10 and atelectasis
84 % vs 29 %; LENT bands; RAPID bands.

### 2.5 Objective work, in priority order

**Phase A — exam-level pass over the existing 24 (highest value per hour).** For each: add 1–3
evidence cards, add the register numbers above that the objective uses, rewrite the diagnose and verify
stems to stack ≥ 2 constraints, add one exam-tested distractor, and add `positions` where bodies differ
(pl-06, pl-02 tube size, ms-04 threshold). Files: `content/labs/{staging,pleural,airway,therapeutics}.ts`.
Expected size: ~40 edited stems, ~50 evidence cards, ~45 register rows.

**Phase B — 22 new objectives inside the pilot areas** (ids continue existing series):

- Diagnostic bronchoscopy (new topic file `labs/diagnostic.ts`, topic `advanced-diagnostic-bronchoscopy`
  / `ebus`): db-01 EBUS sampling technique evidence; db-02 tissue for molecular testing; db-03 EBUS
  beyond lung cancer (sarcoid, lymphoma, infection, calcified/congestive nodes); db-04 EBUS image
  problem-solving (artefact, Doppler, 4L view, EUS stations, cTBNA at 7); db-05 peripheral nodule
  strategy; db-06 sedation and anaesthesia evidence; db-07 ICU and immunocompromised bronchoscopy;
  db-08 transbronchial cryobiopsy.
- Pleural (`labs/pleural.ts`): pl-08 IPC complications and infection (manage through the IPC); pl-09
  IPC for non-malignant effusions and hepatic hydrothorax; pl-10 pleurodesis evidence (TIME1, TAPPS,
  AMPLE, cost, drainage schedule); pl-11 the undiagnosed exudate pathway (cytology → pleuroscopy,
  chylothorax, duropleural, mesothelioma tract RT, LENT); pl-12 pleural infection beyond pH
  (antibiotics, tube size and care, Chaddha, RAPID, split pleura, post-pneumonectomy, haemothorax);
  pl-13 pneumothorax recurrence and persistent air leak (both guideline positions, VATS indications,
  catamenial, EBV criteria, blood patch, tube choice); pl-14 pleural procedures under bleeding risk.
- Airway (`labs/airway.ts`): ao-07 stent types compared with rates (absorbs the sizing detail of
  ao-03); ao-08 tracheal injury and transplant anastomotic complications; ao-09 rigid bronchoscopy in
  practice (ventilation, stoma, positioning, bleeding first moves); ao-10 patient selection and outcomes
  in malignant CAO (AQuIRE, when not to intervene, sequencing with oncology).
- Therapeutics (`labs/therapeutics.ts`): tm-05 energy physics and device hazards; tm-06 delayed
  modalities, early central cancer, carcinoid and RRP.

**Phase C — new blueprint topics (set `pilot: true` in `blueprint.ts` as each gains objectives).**
lv-01 BLVR candidacy and complications; lv-02 bronchial thermoplasty and chronic-bronchitis therapies;
ph-01 airflow physics, heliox, dynamic collapse, laryngotracheal stenosis monitoring (topic
`physiology-anesthesia-sedation`); tx-01 transplant airway surveillance (topic
`transplant-other-lung-disease`); pa-01 pathology at ROSE and the molecular panel (topic
`ethics-palliative-statistics-surgery` is wrong for this — add a `pathology-molecular` topic to
`blueprint.ts` under the disease domain, weight null); st-01 staging corner cases (T descriptors,
image-to-stage, EUS reach).

### 2.6 Engine and UI touches (small)

- Explain panel (`components/RepairLab.tsx`): render `evidence` cards under the principle and the
  `positions` block when present.
- Curriculum page: list evidence cards per objective; the numbers table already renders new rows.
- Recommendation engine: no change. Status rules: no change.
- Tests (`__tests__/content-integrity.test.ts`): evidence card source ids registered; `positions`
  source ids registered; `stemConstraints.length ≥ 2` on every objective whose provenance
  `contentVersion` ≥ `2026.12-exam` (lets Phase A land incrementally); verify kind ≠ diagnose kind
  (existing); grading-vocabulary gate (existing; note "pass" appears in bank copy — keep it out of ours).

### 2.7 Budget-aware sequencing (each item = one session, one PR, fully tested)

| Session | Scope                                                                                                                                                          | Why first                                                                     |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| S1      | Schema (2.1), tests, Explain/Curriculum rendering, register rows + sources for the pleural and staging objectives, Phase A pass on pl-01…pl-07 and ms-01…ms-07 | Pleural + EBUS are 120 of 193 bank items; the schema unlocks everything after |
| S2      | Phase A pass on ao-01…ao-06 and tm-01…tm-04; APC-depth and pneumothorax `positions` corrections                                                                | Finishes "no longer basic" across all 24                                      |
| S3      | pl-08…pl-14 (7 new)                                                                                                                                            | Largest remaining pleural gap (IPC, benign effusions, air leak)               |
| S4      | db-01…db-08 (8 new)                                                                                                                                            | Diagnostic bronchoscopy has no coverage today                                 |
| S5      | ao-07…ao-10, tm-05, tm-06 (6 new)                                                                                                                              | Therapeutic depth                                                             |
| S6      | Phase C (6 new) + blueprint topic flags                                                                                                                        | New blueprint areas                                                           |

Each new objective is ~150–200 lines in the existing schema; a session of 6–8 objectives plus tests
has been the size of one PR in this codebase. If credits run short, S1 alone delivers the schema and the
exam-level pass on the two highest-weight areas; S2 completes the pass. S3–S6 can be authored by the
owner or a later session using the authoring rules in 2.2 without further engine work.

### 2.8 What the owner does (no credits needed)

- Sign or correct register rows weekly: `npm run numbers:signoff -- board-navigator`.
- Decide the two guideline-position questions: whether learners default to ACCP or BTS framing for
  pneumothorax (plan: show both; stem names the frame), and whether to teach the 5 mm EBUS sampling
  threshold as a rule or as ACCP's position (plan: ACCP's position, attributed).
- Confirm the `pathology-molecular` topic is acceptable as a crosswalk addition (the blueprint lists
  pathology under disease-specific knowledge).

## Verification (per session)

1. `npx jest src/features/board-navigator` — content contract (sources, numbers, misconception
   references, distinct task kinds, vocabulary gate, routes exist), engine, release boundary, lab flow.
2. `npx eslint src/features/board-navigator "src/app/[locale]/board-navigator"` and
   `npx prettier --check` on the same paths.
3. `node --max-old-space-size=6144 node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
   (ignore the pre-existing `contentlayer/generated` errors).
4. One Playwright pass of a new objective's lab (`/board-navigator/lab?objective=<id>`) with the dev
   server started as `npx next dev --webpack -p 3120` and placeholder Supabase env, to confirm the
   evidence cards and positions block render and the stem is readable at phone width.
5. Spot-check three new stems against the bank by eye: no shared option list, no shared vignette.

## Out of scope

Account sync, faculty dashboard, editorial tooling, images from the bank (none are used), AI-generated
items, and any iPASS content. Tracheostomy, ethics/statistics and lung-transplant disease objectives
beyond airway complications remain blueprint topics without objectives until a later phase.
