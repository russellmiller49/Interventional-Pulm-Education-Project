# MCS-PRE-REVIEW-05 — clinical, device and model decision packet

**DOCUMENTATION ONLY. EVERY DECISION IS NOT REVIEWED. NO RUNTIME CHANGE. NO CLINICAL APPROVAL.**

Prepared 2026-10-04 by an AI authoring assistant (Claude). It consolidates the pending owner
decisions for Mechanical Circulatory Support into the pack's eight groups, **OD-01 … OD-08**. It
makes none of them. Reviewer, role, date, version, decision and required-changes fields are blank
throughout, and stay blank until a named human reviewer fills them for an exact commit and source
version. Earlier technical reviews (the Prompt 01–04 sanity reviews) are not reviewer decisions and
are not counted as any.

Machine-readable index: [MCS-PRE-REVIEW-05-decision-queue.json](MCS-PRE-REVIEW-05-decision-queue.json).
It does not replace [MCS-03-claim-review-queue.json](MCS-03-claim-review-queue.json), which is
unedited; the ten historical ids are mapped into the groups below.

## Identity

| Item                    | Value                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authorized baseline     | `9086f2af0a538a0afabf964273cf15a219e165d6` — merge commit of PR #325 (MCS-PRE-REVIEW-04). "Current committed file" below means this revision                                                                                                                                                                                                                                                     |
| Last MCS code commit    | `d36f3706e13c81c32e55abb037d8adb9dbecd686` (last commit touching `src/features/mechanical-circulatory-support/` at the baseline)                                                                                                                                                                                                                                                                 |
| Branch                  | `claude/mcs-pre-review-05-10-03`, new exclusive worktree; no earlier MCS worktree reused                                                                                                                                                                                                                                                                                                         |
| Files in this slice     | this packet and the queue JSON; nothing else                                                                                                                                                                                                                                                                                                                                                     |
| Walkthrough             | `MCS_ICU_Lab_Fellow_Walkthrough_Findings.docx`, Local-Data `module_update_9_19/claude_reviews/`, SHA-256 `0f6e31dcfce9723792630e65d4d8b3ee91228fdf6d6396d649ed630d3f365350` — re-hashed 2026-10-04. Rendered to 45 pages; every finding id was found on the page the pack ledger gives. The Mechanical Ventilation walkthrough in the pack was not used                                          |
| Record read             | Pack `00_START_HERE`, `COMMON_CONTRACT`, `05_…DECISIONS`, `OWNER_DECISIONS`, `FEEDBACK_LEDGER`, `SOURCE_AND_CODE_NOTES`, `CROSS_MODULE_COORDINATION`; the Prompt 01–04 handoffs, sanity reviews, scope audits, the Prompt-02 owner packet, the Prompt-04 owner copy and source audit; `MCS-03-handoff.md` and its queue                                                                          |
| Main after the baseline | `origin/main` was `fd6805119d9de8bb454d8dcf7f879f4e8165f420` when this packet was finalized. Since the baseline, one MCS path changed there: `components/stage/mcs-flow.module.css` (PR #331, a layout-only stylesheet change). No MCS model, content, test or source file changed, and no newer MCS owner-decision packet exists on main or in an open PR. This branch was not merged with main |
| What Prompt 05 re-did   | Re-hashed every local source file below; re-opened the four Cardiosave trigger passages (OD-01). Everything else is **consolidated from the cited record, not re-measured**: no model replay, no browser run and no new source hunt was performed in this slice                                                                                                                                  |

## Four things this packet keeps apart

| Axis                               | The question                                               | What does _not_ settle it                                     |
| ---------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| **A. Source validity**             | Does an exact source support the claim?                    | A file name, a citation title, a synthesis, a `reviewed` flag |
| **B. Model fidelity**              | Does the simulator implement and display the mechanism?    | Determinism, passing tests, 1,422 matching comparisons        |
| **C. Instructional design**        | What should this self-paced module teach and show?         | A repaired layout or a clearer sentence                       |
| **D. Release / clinical approval** | Has an authorized human approved the activity for release? | Any of A–C, or "zero technical blockers"                      |

Each group states where it stands on A, B and C. **D is blank for every group.**

## Sources — identity, and what was opened when

"Re-hashed" means the local file's SHA-256 matched the recorded value on 2026-10-04; it does not
mean the document is the current revision for any device, and it is not approval of anything cited
to it. Raw documents and extracts stay outside Git.

| Key | Document, identity as printed                                                                                                                                           | Class                              | SHA-256                                                            | Prompt 05                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| S1  | CARDIOSAVE Hybrid Operating Instructions, English, 0070-00-0638-01, Rev S 11/15, ©2015 Datascope. Software revision and market not stated in the record                 | Primary                            | `d04891c04fcd9960ccec9036d56d2098ba9b403a6d534b748c5b5eb18eaace88` | Re-hashed; PDF pp. 16 and 104 re-opened                                     |
| S2  | Cardiosave Troubleshooting Strategies, MCA00002553 Rev A, ©2025 Datascope (US booklet)                                                                                  | Primary                            | `98fe5bc2fc0e6927c527e79212236a7f10eaee6eaae5944837555d836940c468` | Re-hashed; PDF pp. 5 and 7 re-opened                                        |
| S3  | IAB Insertion / Cardiosave IABP Operation Quick Reference Guide, software D.00/D.01, **for use outside the US only**                                                    | Corroboration only                 | `29e4f1f5b9486df78ae87f596f5e980a1db9664b61f8436bbd93da433c43b529` | Re-hashed; not re-opened                                                    |
| S4  | Getinge, _The IABP Numbers Game_, booklet 83440-EN                                                                                                                      | Manufacturer education             | `2870fecd9fb6d8d605e323fe9352e9040e23462431a00e9837e60a342a8e2580` | Re-hashed; not re-opened                                                    |
| S5  | Impella CP with SmartAssist IFU, 0048-9007 rV, February 2026, cover V11.1, United States only                                                                           | Primary                            | `84f07fe97c0e85f1e6e42e96689d00505b48abe076279469cde025464590bacd` | Re-hashed; not re-opened                                                    |
| S6  | Impella 5.5 with SmartAssist IFU, 10003049 rL, February 2026, United States only                                                                                        | Primary                            | `635aab4ab3743d53ebf9e5099dc4477d4ccff45b46392969b789edd9a17be57e` | Re-hashed; not re-opened. **See erratum below**                             |
| S7  | Impella RP System IFU, 0046-9062 Rev N, April 2024, United States only — the RP System, **not** the RP Flex                                                             | Primary                            | `aeea6701e0b3f88c3d13637abcb31fa34bc33dfc97fb7184cf27b40f95c18ea5` | Re-hashed; not re-opened                                                    |
| S8  | Abbott, _HeartMate 3 LVAD — Pump Parameter Overview / Clinical Considerations_, ©2025, MAT-2007803 v3.0, US use only (two-page card; not the IFU)                       | Manufacturer education             | `873d0243f5226ec849fad4fddb6cb44c3f8311ae8417de593551bc7bb346806a` | **Historically recorded; not re-opened in Prompt 05** (no local copy found) |
| S9  | Stewart S, Blood P, eds. _A Guide to Mechanical Circulatory Support: A Primer for VAD Clinicians_, Springer 2022 (corrected 2023), ISBN 978-3-031-05712-0; private copy | Secondary                          | `8708155f5bd99ce9ecaf6b7a5556c5f3ae59b7da8f96c591b82aa6a956ac433d` | Re-hashed; not re-opened                                                    |
| S10 | Birgersdotter-Green U, Adler E, eds. _Case-Based Device Therapy for Heart Failure_, Springer 2021; Walters and Reeves chapter; private copy                             | Secondary                          | `c014ff47a8c0cf48d7549457a971ca96ccc7c36a104889c1a78e8065ad1387a2` | Re-hashed; not re-opened                                                    |
| S11 | Two supplied Word syntheses ("Bedside MCS reference", "Master hemodynamics reference"); file creator OpenAI; incomplete bibliographic provenance                        | Authoring provenance, not evidence | `d3c1cbd9…439d`, `98c2dfa9…85bf`                                   | Re-hashed in place (OneDrive); not re-opened                                |

**Registered but never opened in any MCS slice — no current-status claim is made for any of them:**
the ISHLT/HFSA 2023 acute MCS guideline; the 2023 ISHLT durable MCS guideline; the HeartMate 3
instructions for use; every FDA labeling, PMA and recall record; the Johnson & Johnson MedTech
product pages (including the RP Flex page); the current Getinge IABP page. The ACC congestion
description behind the module's 15 mm Hg classification is cited by the module; no first-hand read
of it was found in the Prompt 01–04 record.

### Erratum — Impella 5.5 hash in the Prompt-04 source audit

[MCS-PRE-REVIEW-04-source-audit.md](MCS-PRE-REVIEW-04-source-audit.md) prints the Impella 5.5
manual's SHA-256 as `635aab4ab3743d53ebf9e5099dc4477d4ccff45b46392969b789edd9a17be57e261` — 67
characters, with three stray trailing characters (`261`). That historical record is **left as
written**. The correct 64-character hash is
`635aab4ab3743d53ebf9e5099dc4477d4ccff45b46392969b789edd9a17be57e`, as recorded in the final
Prompt-04 handoff and in the MCS-03 queue, and as re-computed from the local file on 2026-10-04. The
erratum changes document-identity metadata only. It does not change which passages were reproduced
(C06: printed 5.26 / PDF 70, Table 5.3) or any source conclusion.

---

## OD-01 — IABP device scope, the atrial-fibrillation trigger conflict, and the timing references

**Priority group.** Two questions are kept separate inside it: **(a) AF triggering** and **(b) the
timing-reference diagrams**.

1. **Decision title.** Which console and mode context the IABP teaching stands on; what AF trigger
   behaviour the module should teach; and what the canonical timing references should show.
2. **Affected findings.** F17, F18, F19; historical `MCS-03-05`.
3. **Activities.** Learn Section 3 `iabp-timing-triggering` (five demonstrations, recognition,
   AF transfer at step 11); cases `IABP-01`, `IABP-02`, `IABP-03`, `CAP-IABP-01`; a rhythm set in
   the Mechanism Studio.
4. **Claim or behaviour at issue.** (a) In atrial fibrillation the model rates arterial-pressure
   triggering highest and quiets its trigger alarm only on pressure. (b) Section 3 teaches two
   pressure relationships — augmentation above systole, lower assisted end-diastolic pressure — that
   the live trace does not show.
5. **Current committed file.** `engine/model.ts` `computeIabpSupport` (AF ratings) and
   `generateMcsWaveformSample` (contour); `content/afTriggerLimit.ts`,
   `content/afTriggerComparison.ts`, `components/McsAfTriggerComparison.tsx` (containment);
   `content/scenarios.ts` (the two held conditions).
6. **Report pages.** F17 pp. 25–26; F18 p. 26; F19 p. 27.
7. **Source titles.** S1 (primary), S2 (primary), S3 (corroboration only), S4 (timing landmarks).
   The report's EMCrit and other secondary links are the report author's checks and were **not**
   verified in any slice; they are not used.
8. **Device / version / market.** Getinge–Datascope Cardiosave Hybrid. S1 is Rev S 11/15; S2 is a
   2025 US booklet; S3 is software D.00/D.01, outside the US. **The console software revision and
   market the module intends are not established** — the module's profile is a console-neutral
   facsimile "informed by Cardiosave reference material".
9. **Locators.** S1 printed p. vi / PDF 16 (Warnings); S1 printed p. 2-18 / PDF 104 ("Dysrhythmias
   while in pressure trigger"); S2 printed p. 3 / PDF 5 (ECG and pressure triggers); S2 printed
   p. 5 / PDF 7 (internal trigger); S3 PDF 19 ("Cardiosave Triggers"); S4 printed p. 3 / PDF 5
   (landmarks).
10. **Close paraphrase.** S1 p. vi: pressure triggering is not recommended with sustained irregular
    rhythms or tachyarrhythmias; do not stay in internal trigger while the patient generates an
    output. S1 p. 2-18: in pressure trigger the console adapts to sustained random dysrhythmias such
    as AF by deflating earlier, and the user should not adjust deflation. S2 p. 3: ECG is the
    preferred trigger with a reliable R wave and is recommended for arrhythmias; pressure is not
    recommended for irregular rhythms such as AF. S2 p. 5: same internal-trigger warning. S3: ECG
    the trigger of choice with an adequate R wave; pressure with a regular rhythm when the R wave is
    inadequate. S4: inflation at the dicrotic notch; augmentation _ideally_ above systole; deflation
    before ejection lowers assisted end-diastolic and assisted systolic pressure — no mm Hg figure.
11. **Technically verified.** The AF values and containment are present at the baseline. The four
    S1/S2 passages were re-opened in Prompt 05 and read as recorded. S1 and S2 agree with each other.
12. **Not verified.** The intended console software and market; R-wave quality behaviour; any
    console AF mode; whether S1 (2015) is current labeling; any numeric synchrony relationship. The
    report's "15–20 mm Hg" end-diastolic figure came from a third-party source not verified and is
    used nowhere.
13. **Model evidence (Prompt 01/02 record; unchanged through Prompt 04).**
    - AF trigger rating: **ECG 50, pressure 74, internal 40**; `iabp-trigger-unreliable` is raised
      below 0.6. Sinus control: 100 / 90 / 62.
    - `IABP-02` (timing ≥ 60) and `CAP-IABP-01` (timing ≥ 65) are reachable in AF only on pressure
      triggering. Both conditions are **held and excluded from scoring**; whether a run reached them
      is not shown.
    - **Pressure triggering does not receive an all-clear**: the clear badge, "No active alarm" and
      the case header's quiet state are suppressed while the hold applies, and a three-source
      comparison is shown instead.
    - `CAP-IABP-01` still opens on internal triggering in a patient with output.
    - `MCS-03-05` remains **NOT REVIEWED**.
    - Timing contour, aligned, 1:2: augmented peak 92.4 against systolic 98.1 mm Hg; assisted
      end-diastolic 60.5 against 61.0. No term reduces pressure at the next ejection. **The authored
      reference diagram is containment because the live model does not reproduce every canonical
      pressure relationship**; it is labelled not this patient, not a run, not a measurement.
14. **Disagreement / missing input.** (a) The model's AF ranking is the reverse of the preference in
    S1 and S2, and S1 also describes an automatic AF compensation the model does not represent. The
    sources state a preference and supply no synchrony model, so reversing three coefficients would
    be substituting constants. **Missing input: the exact console, software revision and market, and
    a reviewed statement of the intended AF behaviour.** (b) No available source gives a magnitude
    for the deflation effect.
15. **Alternatives (two).** **A.** Keep the generic IABP model and the explicit worked, contained AF
    comparison; keep the authored timing reference beside the live strip. **B.** Adopt source-backed
    named-console behaviour, only after the exact console, software and market specification exists
    and a reviewed AF/deflation specification is written.
16. **Effect on the learning objective.** A: the learner can read timing events and compare the
    three trigger ratings, but cannot practise trigger selection in AF or recognise the two pressure
    relationships on a moving trace. B: both become practisable, at the cost of a reviewed engine
    change and re-validation of four cases.
17. **Technical recommendation.** A is the only option implementable from material in hand; B
    needs a specification that does not exist. This is an engineering statement, not the clinical
    choice.
18. **Decision requested.** (i) Name the console, software revision and market, and say whether the
    module teaches a generic mechanism, a named console, or both in separate panels. (ii) Choose A
    or B for AF. (iii) Separately, accept, change or withdraw the authored timing reference and its
    "ideally" qualifier. (iv) Say whether `CAP-IABP-01` should open on internal triggering.
19. **Recommended reviewer.** IABP-experienced physician; perfusionist; Cardiosave educator or
    device specialist — the passages are console-operation statements, and the question is which
    console.
20. **Question.** _For which exact Cardiosave console, software revision and mode should this
    module teach, and in sustained atrial fibrillation what trigger behaviour and what
    inflation/deflation timing relationship do you want a first-year fellow to learn from it?_
21. **Status.** NOT REVIEWED. A: S1/S2 opened and consistent. B: model contradicts them, contained
    not corrected. C: open.
22. **Reviewer.**
23. **Reviewer role.**
24. **Date.**
25. **Commit / source version reviewed.**
26. **Decision.**
27. **Required changes / notes.**

---

## OD-02 — product identity and the durable-LVAD estimator

1. **Decision title.** Whether the durable activities are a generic continuous-flow model or
   HeartMate 3 teaching; which product identities and measurands the Impella content names.
2. **Affected findings.** F12, F16, F27, F28; historical `MCS-03-01`, `-02`, `-03`, `-04`, `-08`,
   `-09`.
3. **Activities.** Learn Sections 7 `lvad-parameters-assessment` and 8 `lvad-alarms-emergencies`;
   Section 2 pathway picker; Section 5 CP-versus-5.5 statement; cases `LVAD-01`, `LVAD-02`,
   `LVAD-03`, `CAP-LVAD-01`; pathway cards and the naming crosswalk.
4. **Claim or behaviour at issue.** The high-power pattern shows power up with displayed flow
   unchanged; a real HeartMate 3 displays an _estimated_ flow. The durable reference patient starts
   hypertensive. Impella flow figures are different measurands on different surfaces.
5. **Current committed file.** `engine/model.ts` `computeLvadSupport`
   (`LVAD_SUSPECTED_THROMBOSIS_POWER_W = 2.8`, `LVAD_HIGH_AFTERLOAD_MAP_MMHG = 100`);
   `content/supportPathways.ts`, `content/impellaVariants.ts`, `content/deviceProfiles.ts`; shared
   `critical-care/content/measurementClarifications.ts` and `sourceConflicts.ts` (read, not owned).
6. **Report pages.** F12 p. 21; F16 p. 24; F27 p. 34; F28 pp. 34–35.
7. **Source titles.** S8 (HeartMate 3 parameter card); S5, S6, S7 (Impella IFUs); S10 (textbook
   with two conflicting CP figures).
8. **Device / version / market.** HeartMate 3: card ©2025 v3.0, US only; **the HeartMate 3 IFU has
   never been opened** and no revision is anchored. Impella CP rV, 5.5 rL, RP System rN — all "United
   States only"; currency for a local device not verified.
9. **Locators.** S8 p. 1. S5 printed 3.4 / PDF 26; printed 5.25 / PDF 77 (Table 5.3 and footnote);
   printed 9.15 / PDF 272 (Table 9.15). S6 printed 3.3 / PDF 21; printed 9.15 / PDF 250. S7 printed
   8.18 / PDF 125 (Table 8.15); printed 5.20 / PDF 68 (Table 5.4); PDF 3 (title). S10 printed 26 /
   PDF 32 (Table 3); printed 27 / PDF 33.
10. **Close paraphrase.** S8: power is a direct measurement of motor voltage and current; flow is an
    estimate calculated from fixed speed, power and hematocrit; no single parameter stands for
    clinical status. S5: CP maximum mean flow 3.7 L/min; P-9 mean 3.3–3.7; peak at systole up to
    4.3. S6: 5.5 maximum mean 5.5 L/min. S7: RP parameter maximum 4.0 L/min, P-9 range 3.9–4.4;
    title names the RP System. S10: CP "up to 3.8" in a table and "3.5" in the text, measurand
    unstated.
11. **Technically verified.** The flag adds exactly +2.8 W with identical modeled flow at matched
    time. The durable surfaces now say "modeled transfer", and distinguish **modeled transfer**, its
    rounded display, and **effective systemic flow**. The alarm label names its real input.
12. **Not verified.** Any HeartMate 3 estimator algorithm, failure-mode behaviour or validation
    data; the IFU; current labeling or recall status for any product; the RP Flex page (registered,
    not opened).
13. **Model evidence (Prompt 02).**
    - **Generic flow computation:** target flow from speed × min(right-sided delivery, LV filling
      term) × afterload factor × tamponade factor. **Power is derived from the resulting flow
      afterwards.**
    - **Thrombosis flag:** an authored flat **+2.8 W**; it never enters the flow formula (4.9 →
      7.8 W; displayed flow 3.78 → 3.79 L/min).
    - **No hematocrit** anywhere in the flow model, and **no controller estimator**: displayed pump
      flow _is_ the modeled transfer, rounded. Estimator bias is not represented.
    - **High-afterload alarm:** predicate is `baseline.mapMmHg > 100` — the patient's modeled
      circulation **with no support running**, not the displayed MAP. Reference: displayed MAP about
      103, alarm input 67.5, alarm quiet; at SVR 2200 displayed 153–154, input 96.0, still quiet; it
      raises only with preload 145% (input 119.5).
    - CP model reference ceiling is the 4.3 L/min peak-systolic figure used as a mean-flow reference
      (`MCS-03-01`, held, not recalibrated).
14. **Disagreement / missing input.** Direction of dependency: device power → estimated flow; model
    flow → power. S8 names the estimator's inputs and gives **no implementable algorithm**. **Missing
    input: the current HeartMate 3 IFU for the intended device and version, and an owner statement
    of device scope.** Product identity: RP versus RP Flex unresolved; CP peak versus maximum mean
    unresolved; the textbook's two CP figures are a documented conflict, not averaged.
15. **Alternatives (two).** **A.** Retain the generic continuous-flow model with named-device
    comparisons — _a generic continuous-flow model with a source-linked HeartMate 3 comparison, not
    a HeartMate 3 simulator_. **B.** An explicit device-specific estimator, only after a complete
    current official specification and a validation basis exist. No reverse-engineered algorithm is
    proposed under either.
16. **Effect on the learning objective.** A: the fellow learns that speed is set, flow depends on
    loading, and a real controller's flow is an estimate — but cannot practise reading a falsely
    high estimated flow. B: that pattern becomes practisable, with device-fidelity obligations the
    module does not carry today.
17. **Technical recommendation.** A; B is not implementable from any source in the record. On the
    alarm predicate, re-pointing it at the compartment pressure is **not** a drop-in: the Prompt-02
    packet measured that it would also raise in the tamponade state and could chatter.
18. **Decision requested.** (i) Generic or HeartMate 3, and the labelling boundary. (ii) Which
    HeartMate 3 labeling revision to anchor, or supply it. (iii) What the high-power example may
    claim. (iv) Keep or change the high-afterload predicate. (v) Confirm CP versus 5.5 and RP versus
    RP Flex, and which CP flow measurand the module names.
19. **Recommended reviewer.** VAD physician; VAD coordinator; Abiomed / J&J MedTech device specialist
    for Impella identity; LVAD device specialist where appropriate.
20. **Question.** _What exact product identities and measurands should the learner be taught — for
    the durable pump, the left-sided Impella and the right-sided Impella — and which current
    official source and version governs each?_
21. **Status.** NOT REVIEWED. A: card and three IFUs opened; HM3 IFU unopened. B: generic, no
    estimator, labelled as such. C: open.
22. **Reviewer.**
23. **Reviewer role.**
24. **Date.**
25. **Commit / source version reviewed.**
26. **Decision.**
27. **Required changes / notes.**

---

## OD-03 — right-sided delivery, filling, suction, volume and congestion

1. **Decision title.** Which model variables may be presented as clinically meaningful filling or
   congestion signals, and whether the coupled model is recalibrated before these objectives are
   released.
2. **Affected findings.** F14, F21, F24, F25, F26, F29, F35; historical `MCS-03-06`, `MCS-03-07`.
3. **Activities.** Learn Sections 2 (transfer), 4 `iabp-efficacy-limits`, 5
   `impella-unloading-placement`, 6 `impella-suction-purge-rv`, 9
   `mcs-device-selection-integration`; stories `story-level-for-suction` and
   `story-volume-for-suction`; cases `IMP-01`, `IMP-02`, `LVAD-02`.
4. **Claim or behaviour at issue.** Weakening the RV does not visibly lower the displayed wedge; a
   suction state appears beside a high displayed wedge and volume; a preload control produces a very
   large response; Section 9's key and its congestion panel answer different questions.
5. **Current committed file.** `engine/model.ts` `computeImpellaSupport`
   (`LEFT_IMPELLA_SUCTION_PRELOAD_THRESHOLD = 0.58`), `deriveBaselineMeasurements`,
   `deriveMcsMetrics`; `content/storyProblems.ts`; `content/sectionLearningContracts.ts`;
   `content/lessonTransfers.ts` (`mcs-rv-limited-device-selection`).
6. **Report pages.** F14 p. 23; F21 pp. 29–30; F24 p. 31; F25 p. 32; F26 p. 33; F29 pp. 36–37; F35
   p. 40.
7. **Source titles.** S5 (suction); S7 (right-sided suction). No source supplies a coupled model.
8. **Device / version / market.** Impella CP rV and RP System rN, United States only.
9. **Locators.** S5 printed 7.17 / PDF 236 ("Suction"); S7 printed 5.20 / PDF 68 ("Suction").
10. **Close paraphrase.** S5: for a suction alarm, reduce the P-level by one or two, ensure adequate
    volume, check position with imaging, evaluate RV function; suction may indicate right heart
    failure. S7: decrease the P-level as needed; displayed flow may be higher than actual.
11. **Technically verified.** The alarm no longer claims the ventricle is empty; it names the
    limiting term. The stories are isolated from the live section and carry no dose or rate.
12. **Not verified.** Any clinical validity of the suction predicate, the `lvFilling` scale, the
    displayed-wedge coupling or the response magnitudes. None of this is physiologically validated.
13. **Model evidence (Prompt 02, corrected matched-time values from the sanity review).** These are
    separate things:

    | Thing                                 | What it is                                                                                                                                     |
    | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
    | Section patient                       | Section 6's RV-failure patient (RV contractility 0.36, CP at level 7)                                                                          |
    | Isolated low-preload story patient    | A different, constructed patient: left level 7, `preloadPercent` 55                                                                            |
    | `preloadPercent` control              | A control that **rescales circulating volume**: total = `4100 × fraction + 260` mL                                                             |
    | Circulating-volume rescaling          | 55% → 100% = 2515 → 4360 mL, **+1845 mL of MODEL VOLUME — not a bedside bolus, dose or rate**                                                  |
    | Displayed LVEDV surrogate             | `modeledLvedv`, an educational surrogate with only a bounded compartment contribution                                                          |
    | Conserved LV reservoir                | `leftVentricularVolumeMl`, the solver's compartment; feeds `lvFilling`                                                                         |
    | Displayed wedge                       | `metrics.pcwpMmHg`, built from `baseline.pawpMmHg` and the LVEDV surrogate                                                                     |
    | Pulmonary-venous compartment pressure | `compartments.pulmonaryVenousPressureMmHg`, a latent solver value, not a measured wedge                                                        |
    | Suction predicate                     | Left pump running, level ≥ 5, and `min(rvDeliveryToLeftHeart, lvFilling, circulatingVolumeFactor) < 0.58` — authored, not manufacturer logic   |
    | Limiter branches                      | **All three are reachable**: RV delivery; LV compartment (e.g. 45.76 mL, factor 0.244 at 60 s); circulating volume (0.556). Ties name RV first |
    | Congestion classification             | Biventricular when both pressures exceed 15 mm Hg, per the description the module cites                                                        |
    | Support bottleneck                    | Which term limits the pump — a different question from the congestion class                                                                    |
    - **RV weakening (0.85 → 0.20), Section 4:** RAP 11 → 22; effective flow 4.51 → 2.55; displayed
      LVEDV 134 → 127; **displayed wedge 20 → 20** (unrounded 20.4214 → 20.0727). Conserved LV
      reservoir 238.53 → 175.13 mL; pulmonary-venous pressure 16.28 → 11.66 mm Hg. Right-sided
      delivery moves the compartments strongly and the display barely.
    - **`lvFilling` scale / calibration concern:** documented, unchanged; a recalibration changes
      suction, and a wedge coupling changes every displayed wedge and the congestion classification.
    - **F24:** P5 → P8 LVEDV 118 → 107 mL, wedge 18 → 17, flow +1.05 L/min; P5 → P6 "No resolvable
      displayed change" in wedge. Small, real, not amplified.
    - **Volume story:** MAP 59 → 97 and effective delivery 3.74 → 6.15 L/min with suction clearing.
    - **RV-failure contrasting story — measured, NOT shipped:** on the section patient, preload →
      140% raises RAP to 24 and wedge to 25 and suction stays active.
    - **Section 9:** RAP 18, wedge 18, PAPi 0.5, effective 2.74–2.75 L/min, suction active, limiter
      `rv-delivery`. **Biventricular congestion and an RV-limited support bottleneck both hold.** Key
      unchanged; the word "modest" was removed.
    - **LVAD-02:** success is **PAPi ≥ 1 AND device flow ≥ 2.8**. No action 0.5 / 1.16; both
      required actions 2.1 / 3.66 with RAP 20 → 8. Adding right-sided _support_ in Section 9 moves
      PAPi only 0.5 → 0.6. Read PAPi with RAP and flow, not alone.
    - `MCS-03-06`: a one- or two-level reduction does not clear modeled suction, while S5 lists it
      first.

14. **Disagreement / missing input.** The displayed surrogates and the conserved compartments are
    different quantities with similar names. **Missing input: a reviewed coupled-model
    specification** — what the display may call chamber volume, filling pressure or available
    inflow. Nothing here supports "suction means give fluid", "fluid is harmful", a standard fluid
    bolus, a clinically validated wedge coupling, or a new physiology equation.
15. **Alternatives (two).** **A.** Keep the current display and model gaps explicitly contained.
    **B.** Commission one reviewed coupled-model specification, then revalidate every affected
    section and case together (including the congestion classifications of all twelve cases).
16. **Effect on the learning objective.** A: the fellow learns to name the limiting term and to
    separate congestion from bottleneck, but cannot see RV failure underfill the left heart on the
    monitor. B: that becomes demonstrable, and every wedge-dependent surface changes.
17. **Technical recommendation.** None on the clinical choice. If B is chosen, decide the `lvFilling`
    scale and the wedge coupling in the same pass. The 0.26 display blend in the Prompt-02 packet is
    an unvalidated post-hoc arithmetic, not a specification.
18. **Decision requested.** (i) Which quantities may be displayed as volume, filling pressure or a
    qualitative surrogate. (ii) A or B. (iii) Whether the measured RV-failure/volume contrast is
    wanted as a third story. (iv) Whether Section 9 should teach the ratio explicitly. (v) The full
    PAPi / RAP / flow reading for LVAD-02.
19. **Recommended reviewer.** MCS cardiologist or intensivist; VAD/MCS specialist; the model owner.
20. **Question.** _Which current variables may be presented as clinically meaningful filling or
    congestion signals, and should the model be recalibrated before these learning objectives are
    released?_
21. **Status.** NOT REVIEWED. A: suction actions source-located; no source for the coupling. B:
    deterministic and internally consistent, **not** physiologically validated. C: open.
22. **Reviewer.**
23. **Reviewer role.**
24. **Date.**
25. **Commit / source version reviewed.**
26. **Decision.**
27. **Required changes / notes.**

---

## OD-04 — authored numerical conditions versus clinical targets

1. **Decision title.** Which numbers stay visible as simulation criteria, and which — if any — are
   promoted into sourced clinical teaching.
2. **Affected findings.** F04, F27, F33, F35 and the Section 9 framework.
3. **Activities.** All twelve cases' worked explanations; Sections 6, 7, 8 and 9 where a threshold
   is printed.
4. **Claim or behaviour at issue.** A learner may read a model condition (for example "MAP ≥58") as
   a clinical target.
5. **Current committed file.** `content/scenarios.ts` (`successCriteria`); `engine/model.ts` named
   constants. Full table: [MCS-PRE-REVIEW-01-condition-inventory.md](MCS-PRE-REVIEW-01-condition-inventory.md)
   — **21 conditions across 12 cases, incorporated by reference**, every one classified
   `authored-model-condition`, none with a clinical source.
6. **Report pages.** F04 pp. 11–12; F27 p. 34; F33 p. 39; F35 p. 40.
7. **Source titles.** None behind any case condition. S8 names a mean-pressure figure for HeartMate
   3 patients, quoted as the manufacturer's statement about its own device and **not adopted**.
8. **Device / version / market.** Not applicable to the authored conditions.
9. **Locators.** Not applicable; see field 14.
10. **Paraphrase.** Not applicable.
11. **Technically verified.** Every condition prints its class in all twelve cases; the two AF
    timing conditions are held. No learner-facing surface renders a score.
12. **Not verified.** Any clinical basis for any value.
13. **Consequential values, and what each currently is.**

    | Category                            | Values                                                                                                                         | Currently                                          |
    | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
    | MAP case conditions                 | `IABP-01` ≥ 58; `CAP-IABP-01` ≥ 50; `LVAD-03` and `CAP-LVAD-01` ≥ 55; `LVAD-01` ≤ 95; `IMP-03` ≤ 100                           | Model-only condition                               |
    | Timing criteria                     | `IABP-01` and `IABP-03` ≥ 80; `IABP-02` ≥ 60 and `CAP-IABP-01` ≥ 65 (**held**, `MCS-03-05`)                                    | Model-only; two unresolved under OD-01             |
    | Suction thresholds                  | Left Impella 0.58; durable 0.42 with flow > 2.5 L/min                                                                          | Model-only; calibration unresolved under OD-03     |
    | Durable high-afterload threshold    | 100 mm Hg, applied to unsupported baseline MAP                                                                                 | Unresolved (OD-02)                                 |
    | PAPi / flow success criteria        | `LVAD-02` PAPi ≥ 1 and flow ≥ 2.8; device-flow floors 2–3.2 L/min in seven cases; `IMP-01` RAP ≤ 18; recirculation ≤ 0.5 L/min | Model-only condition                               |
    | Congestion classification, 15 mm Hg | Section 9 panel                                                                                                                | Source-linked contextual teaching; source unopened |
    | High-power increment                | +2.8 W                                                                                                                         | Model-only; unresolved under OD-02                 |

14. **Disagreement / missing input.** No clinical source is attached to any condition. **Missing
    input: a first-hand read of the ACC congestion description**, and, for any promoted number, its
    exact patient, device and guideline scope. **Not imported, and not proposed:** a universal MAP
    65; one universal LVAD pressure range (the report's ISHLT 75–90 and < 80 figures were not
    verified and are not used); a single congestion threshold as a treatment target; automated
    treatment advice.
15. **Alternatives (two).** **A.** Retain each as a model-only condition with explicit labelling.
    **B.** Replace or link a specific condition only after source- and patient/device-specific human
    review.
16. **Effect on the learning objective.** A: cases still have an end, and the learner is told the
    number is the simulation's. B: a chosen number becomes clinical teaching and inherits its
    source's scope and currency.
17. **Technical recommendation.** None; A is the current state.
18. **Decision requested.** For each row above: stay model-only, become source-linked, or be
    withheld as misleading.
19. **Recommended reviewer.** Owner; MCS clinician with guideline expertise.
20. **Question.** _Which numerical conditions may remain visible as simulation criteria, and which —
    if any — should be promoted into sourced clinical teaching?_
21. **Status.** NOT REVIEWED. A: none. B: authored. C: open.
22. **Reviewer.**
23. **Reviewer role.**
24. **Date.**
25. **Commit / source version reviewed.**
26. **Decision.**
27. **Required changes / notes.**

---

## OD-05 — clinical source replacement and review provenance

1. **Decision title.** Whether the ten mapped claims are acceptable as written, and which
   synthesis-backed claims need a primary source next.
2. **Affected findings.** F10; historical `MCS-03-10` and linked source holds.
3. **Activities.** Sections 3, 5, 6, 7; cases `IABP-01`, `IMP-01`, `IMP-02`, `IMP-03`, `LVAD-01`;
   every surface that still cites a synthesis (all prediction, transfer and story items; pathway
   cards; device profiles; support spine and grammar).
4. **Claim or behaviour at issue.** Learner-facing claims were cited first to an unauthored,
   AI-generated synthesis.
5. **Current committed file.** `content/sources.ts` and the claim map (ids `MCS-04-C01` … `C10`);
   exact strings and line locators are in the
   [source audit](MCS-PRE-REVIEW-04-source-audit.md).
6. **Report pages.** F10 pp. 19–20.
7. **Source titles.** S1, S5, S6, S7, S9; S11 as authoring provenance only.
8. **Device / version / market.** As in the source table. Currency for a local device not verified.
9. **Locators.** In the table under field 10.
10. **What each passage supports.**

    | ID  | Claim (short)                                                      | Locator                                            | Standing                                                      |
    | --- | ------------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------- |
    | C01 | Inflation at valve closure; deflation before the next ejection     | S1 printed xiv / PDF 24                            | Primary-supported                                             |
    | C02 | Early inflation opposes ejection; late deflation worsens afterload | S9 printed 220 / PDF 231; S1 printed vi / PDF 16   | Secondary-supported; S1 in a pressure-trigger warning context |
    | C03 | Late inflation / early deflation shorten augmentation              | S9 printed 220 / PDF 231                           | Secondary-supported                                           |
    | C04 | Inlet in LV, outlet toward aorta; position needs imaging           | S5 printed 4.11 / PDF 45; printed 7.17 / PDF 236   | Primary-supported                                             |
    | C05 | Level is a setting; higher outlet pressure can reduce flow         | S5 printed 5.25 / PDF 77; printed 8.5 / PDF 254    | Direction / context only                                      |
    | C06 | Same level on CP and 5.5 is not an equivalent "dose"               | S5 printed 5.25 / PDF 77; S6 printed 5.26 / PDF 70 | Primary-supported; 30–60 mm Hg qualification restored         |
    | C07 | Suction may indicate right heart failure; evaluate the RV          | S5 printed 7.17 / PDF 236                          | Primary-supported; **narrowed wording**                       |
    | C08 | Malposition can reduce flow and raise hemolysis risk               | S5 printed 7.18–7.19 / PDF 237–238                 | Primary-supported (qualitative)                               |
    | C09 | RP returns blood to the pulmonary artery, bypassing the RV         | S7 printed 3.1 / PDF 23                            | Primary-supported (RP System, not RP Flex)                    |
    | C10 | Continuous-flow LVAD output is afterload sensitive                 | S9 printed 101 / PDF 117                           | Secondary-supported                                           |

11. **Technically verified.** **10 of 10 passage locations were independently reproduced** in the
    Prompt-04 source audit. **This is not clinical or source-owner approval.** The `MCS-03-10` hold
    is printed in the open on the hub, references, every lesson task, every case and the Studio.
12. **Not verified.** The claims' clinical acceptability; currency of rV, rL and rN; anything in
    the unopened records listed under the source table; whether the private textbook may be cited to
    learners by title, chapter and page.
13. **Model evidence.** Not applicable; magnitudes shown by the simulation are its own.
14. **Disagreement / missing input.** C02, C03 and C10 rest on a textbook chapter only. **Every
    other synthesis-backed claim stays under `MCS-03-10` — NOT REVIEWED, source-owner review
    required.** The syntheses remain on record as authoring provenance; the source trail is not
    erased.
15. **Alternatives (two).** **A.** Accept the ten mappings with their stated classes and keep
    `MCS-03-10` in force for the rest. **B.** Require primary evidence for C02, C03 and C10 (and any
    others named) before the "secondary-supported" label is lifted, and schedule the next batch of
    unmapped claims.
16. **Effect on the learning objective.** Neither changes what is taught; they change what the
    module may say its teaching rests on.
17. **Technical recommendation.** None.
18. **Decision requested.** Accept, change or withdraw each of C01–C10; say whether a textbook
    alone is enough for C02, C03 and C10; confirm access to the unopened guidelines, the HeartMate 3
    IFU and the FDA records; name the next unmapped claims.
19. **Recommended reviewer.** Owner / MCS clinician; the appropriate device specialist; a guideline
    or source reviewer as relevant.
20. **Question.** _Which of the ten mapped claims are acceptable as written, which textbook-only
    claims require primary evidence, and which unmapped synthesis-backed claims need priority next?_
21. **Status.** NOT REVIEWED. A: 10/10 located. B: n/a. C: open.
22. **Reviewer.**
23. **Reviewer role.**
24. **Date.**
25. **Commit / source version reviewed.**
26. **Decision.**
27. **Required changes / notes.**

---

## OD-06 — media identity, anatomical placement and rights

1. **Decision title.** Which two visual assets, if any, are worth adding, and under what source,
   rights and review boundary.
2. **Affected findings.** F05, F12, F17, F22, F23; optional chest-film and console interests.
3. **Activities.** Circulation map (all sections); Section 2 pathway sketches; Section 3 timing
   reference; Section 5 cutaway; Sections 7–8 flow account.
4. **Claim or behaviour at issue.** Whether drawings teach position or device behaviour they have
   no reviewed basis for.
5. **Current committed file.** MCS stage and monitor components. The Prompt-03 repairs (map halos
   and labels, distinct Impella/LVAD paths, filled source/component/destination boxes, cutaway
   leader lines) are presentation repairs of existing authored, conceptual, not-to-scale drawings.
6. **Report pages.** F05 pp. 12–13; F12 p. 21; F17 pp. 25–26; F22 p. 30; F23 p. 31.
7. **Source titles.** S4 (timing landmarks); S8 (estimator inputs). No source has been opened for
   balloon position.
8. **Device / version / market.** As in the source table.
9. **Locators.** S4 printed p. 3 / PDF 5; S8 p. 1.
10. **Close paraphrase.** As in OD-01 field 10 and OD-02 field 10.
11. **Technically verified.** No source image was copied; the module draws its own polylines.
12. **Not verified.** Rights to any third-party figure; anatomical placement of any landmark.
13. **Model evidence.** See OD-01 field 13 (contour) and OD-02 field 13 (dependency direction).
14. **Disagreement / missing input.** **Held and not drawn: the aortic arch, left subclavian and
    renal landmark teaching idea** (F05). A schematic arch drawn without a named source would be
    guessed anatomy used as position teaching. **Missing input: a named source for the tip/base
    relationship, a reviewer, and a rights position.** A redraw — by a person or by an AI — does not
    by itself remove copyright restrictions on a source figure's protected expression.
15. **Alternatives — at most two storyboards, neither built.**

    |                        | **SB-1 — IABP timing comparison**                                                                                                                                     | **SB-2 — durable estimator comparison**                                                                                                                    |
    | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | Learning purpose       | Recognise the five landmarks and the two pressure relationships the live trace cannot show                                                                            | See that a real controller estimates flow from power, while this model derives power from flow                                                             |
    | Model data vs authored | Left: the live strip (model data, event timing only). Right: the **existing** authored reference (not this patient, not a run)                                        | Left: this model's chain, speed and loading → modeled transfer → derived power (model). Right: an authored two-arrow diagram of the device's stated inputs |
    | Source                 | S4 printed p. 3 / PDF 5                                                                                                                                               | S8 p. 1                                                                                                                                                    |
    | Rights / permission    | Module-drawn polyline from stated relationships; no source image copied. Whether a drawing derived from a manufacturer booklet needs a rights review is **undecided** | Words and two arrows only; **no Abbott artwork**. The card is ©Abbott, US use only; reuse of its figures is not cleared and not proposed                   |
    | Annotations            | I, D, notch, augmented peak, assisted end-diastolic; "ideally" kept on augmentation above systole                                                                     | "Measured: power." "Estimated: flow, from speed, power and hematocrit." "This model: no estimator, no hematocrit."                                         |
    | Boundary               | Conceptual, not to scale; coordinate-only magnitudes; no mm Hg decrement                                                                                              | Conceptual; no equation, no estimator bias, no failure-mode prediction                                                                                     |
    | Needs human approval   | Content, the qualifier, rights position                                                                                                                               | Device scope (OD-02), wording, rights position                                                                                                             |

    SB-1 prefers an existing authorized asset. SB-2 was chosen over a suction comparison because the
    suction mechanism has no reviewed specification (OD-03), whereas S8 states the estimator's inputs.

16. **Effect on the learning objective.** SB-1 adds nothing new unless the owner wants the early and
    late panels extended; SB-2 makes the OD-02 boundary visible in one picture.
17. **Technical recommendation.** None. No new asset library is proposed.
18. **Decision requested.** Approve, change or decline SB-1 and SB-2; keep or release the arch
    landmark hold, with a source and reviewer if released; state the rights position.
19. **Recommended reviewer.** Owner; device or anatomy subject-matter reviewer; media / rights owner
    where necessary.
20. **Question.** _Which two visual assets, if any, are worth adding, and what exact source, rights
    and review boundary is acceptable?_
21. **Status.** NOT REVIEWED.
22. **Reviewer.**
23. **Reviewer role.**
24. **Date.**
25. **Commit / source version reviewed.**
26. **Decision.**
27. **Required changes / notes.**

---

## OD-07 — selected teaching choices and future interests

1. **Decision title.** Which draft teaching changes are approved, revised or withdrawn.
2. **Affected findings.** F02, F06, F07, F11, F13, F15, F16, F30, F31, F32, F36, F39, F40, F42, F43.
3. **Activities.** Hub; all nine Explain steps; all twelve case predictions; Mechanism Studio;
   naming crosswalk.
4. **At issue.** Draft learner-facing prose written in Prompt 04 and labelled draft on screen.
5. **Current committed file.** Wording in full:
   [MCS-PRE-REVIEW-04-owner-copy.md](MCS-PRE-REVIEW-04-owner-copy.md) — not reproduced here.
6. **Report pages.** F02 pp. 8–9; F06 pp. 14–15; F07 pp. 15–17; F11 pp. 20–21; F13 p. 22; F15
   p. 24; F16 p. 24; F30 p. 37; F31 pp. 37–38; F32 p. 38; F36 p. 40; F39 p. 43; F40 pp. 43–44; F42
   p. 44; F43 p. 44; wider interests p. 45.
7. **Source titles.** None of its own; product-identity rows rest on OD-02's sources and the
   reflections on OD-05's.
8. **Device / version / market.** As in OD-02.
9. **Locators.** Not applicable.
10. **Paraphrase.** Not applicable.
11. **Technically verified.** No key, option id, stem, order, threshold or model value changed in
    Prompt 04; the nine drafts appear nowhere in production content.
12. **Not verified.** Whether any draft improves learning; no learner has used them.
13. **Model evidence.** `CAP-LVAD-01`: derived power 3.7 W against the reference run's 4.9 W at
    unchanged speed 5200, high-power pattern off (Prompt-04 sanity review).
14. **Disagreement / missing input.** The intended audience was never written down; the
    `CAP-LVAD-01` stem and its reasoning use "power" differently.
15. **Alternatives.** Per row: accept, or withdraw. For the `CAP-LVAD-01` stem, the two options
    below.
16. **Effect on the learning objective.** Stated per row below.
17. **Technical recommendation.** None.
18. **Decision requested — the short before/after packet.** Each row needs _accept_ / _accept with
    changes_ / _withdraw_.

    | Item                       | Before                                                         | Now (draft)                                                                                                                                                                                                                 |
    | -------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | Audience statement         | None written anywhere                                          | Adult-ICU clinicians and trainees starting to look after IABP, Impella or durable-LVAD patients; assumes arterial-line and right-heart literacy                                                                             |
    | Five hub objectives        | None                                                           | Pressure vs flow (S1–2); IABP timing (S3–4); Impella placement, unloading, suction (S5–6); generic durable parameters (S7–8); transfer vs effective delivery (S9)                                                           |
    | Nine optional reflections  | A question with nowhere to answer                              | Same question, optional, with a worked response that opens at once; nothing typed or stored. Attention: S4, S7, S8 name who to call and what is _not_ established                                                           |
    | 36 case-option sentences   | No per-option reasoning                                        | Twelve "fits" and twenty-four "does not fit" sentences, each tied to the case's built state. Grouped: IABP ×9, Impella ×9, durable ×9, capstones ×9. The two AF cases say the option "does not say which trigger to choose" |
    | Framings                   | Case titles gave the diagnosis unremarked; Studio "no patient" | "A worked teaching case"; "Open sandbox · reference patient"                                                                                                                                                                |
    | Product identity (confirm) | Four to six names per device                                   | CP vs 5.5 are different pumps; supplied instructions are RP, registered page is RP Flex, not treated as the same; durable is generic, not a HeartMate 3 simulator; no IABP console is named                                 |

    **Self-paced policy preserved:** no scores, no first-attempt summaries, no mandatory answer
    gates, no response quotas.

    **CAP-LVAD-01 stem — explicit owner decision.** `content/scenarios.ts` line 861 still reads:
    "…develops low flow with rising and converging filling pressures after a bedside procedure;
    **speed and power are unchanged**." The repaired reasoning beside it says speed is unchanged,
    the power path is connected, and **derived pump power is lower than in the reference run**
    (3.7 W against 4.9 W; the high-power pattern is off). The mismatch was on the baseline and was
    deliberately left for this decision. Two bounded options, neither chosen here:
    - **A.** Change the stem to separate unchanged _speed_ from the lower modeled _derived power_.
    - **B.** Keep the stem's meaning only if "power" was intended as an external setting or state
      (for example the power path) rather than the model-derived displayed power — with the wording
      changed enough to remove the ambiguity.

    **Question drafts.** **Nine** carried forward from Prompt 04, **none shipped**; Prompt 05 adds
    **none** (cap: ten across both). No key was randomized or re-keyed.
    - One presentation decision: all twelve case predictions render the keyed option first — apply
      the Learn stage's stable display order to cases, yes or no.
    - Four story options that read as instructions among forecasts (two in Section 6, two in
      Section 7).
    - Five self-refuting case distractors (`IABP-03`, `IMP-02`, `IMP-03`, `LVAD-01`, `LVAD-03`).

    The RV-failure/volume contrast in OD-03 would be the tenth if the owner asks for it; it is not
    drafted.

    **Page 45 future interests — not defects.**

    | Interest                      | Existing verified cross-link                                                                                                  | Disposition                                                                         |
    | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
    | VA-ECMO / ECPELLA             | Hub link to `/cardiohelp-ecmo`; two comparison pathway cards name the CARDIOHELP module. Nothing covers LV venting on VA-ECMO | Existing cross-link sufficient for VA-ECMO; ECPELLA is a future module / workstream |
    | SCAI shock stages             | None; no staging source registered                                                                                            | Optional future enhancement (needs a source and an owner decision)                  |
    | IABP chest-film position      | None; a Getinge placement source is registered, unopened                                                                      | Optional future enhancement, under the OD-06 hold                                   |
    | Realistic console examples    | None, by design: the monitor is generic                                                                                       | Future module / workstream, under OD-01 / OD-02 / OD-06                             |
    | Hemolysis laboratory pointers | None; S5 printed 7.18 names plasma-free hemoglobin, nothing is taught                                                         | Optional future enhancement                                                         |

    No new module, no Device Intelligence change and no runtime change is proposed.

19. **Recommended reviewer.** Owner; curriculum lead; MCS clinician.
20. **Question.** _Which draft teaching changes materially improve the fellow's learning enough to
    approve, revise or withdraw?_
21. **Status.** NOT REVIEWED.
22. **Reviewer.**
23. **Reviewer role.**
24. **Date.**
25. **Commit / source version reviewed.**
26. **Decision.**
27. **Required changes / notes.**

---

## OD-08 — owner walkthrough, real learners and release

**Human work. Nothing below is complete, and no AI browser run counts toward it.**

1. **Decision title.** After direct human use: what is approved, what stays contained, what blocks
   release.
2. **Affected findings.** F39, F40 (timing and self-assessment), and every group above.
3. **Activities.** The whole module.
4. **At issue.** Whether anyone has actually used the repaired module, and who has approved what.
5. **Current committed file.** The baseline revision as deployed to the reviewer's browser.
6. **Report pages.** F39 p. 43; F40 pp. 43–44. The report's fellow is an AI persona, not a usability
   study.
7. **Source titles.** Not applicable.
8. **Device / version / market.** Not applicable.
9. **Locators.** Not applicable.
10. **Paraphrase.** Not applicable.
11. **Technically verified.** Engineering ran emulated viewports and 200% root text in Chromium.
12. **Not verified.** Everything in the checklist below.
13. **Model evidence.** Not applicable.
14. **Missing input.** Human use.
15. **Alternatives.** Not applicable; the checklist is the work.
16. **Effect on the learning objective.** Real timing and observation decide whether the stated
    duration and the optional-everything design serve a first-year fellow.
17. **Technical recommendation.** None.
18. **Decision requested — execution checklist.**

    **Owner walkthrough — run personally, on your ordinary browser**
    - [ ] AF trigger path (Section 3 transfer, then `IABP-02` and `CAP-IABP-01`)
    - [ ] Both suction stories (`story-level-for-suction`, `story-volume-for-suction`)
    - [ ] Section 9 integration
    - [ ] Durable high-power example (Section 8)
    - [ ] One normal practice case
    - [ ] One recovery / troubleshooting case
    - [ ] Main navigation, glossary, Mechanism Studio

    **Intended-learner observation**
    - [ ] Intended first-year fellows
    - [ ] An MCS/VAD bedside educator

    **Timing — measured separately; a word count is not a validated duration**
    - [ ] Realistic primary path
    - [ ] Optional reference use

    **Native platform and accessibility — outstanding unless a human completes them**
    - [ ] Native browser zoom
    - [ ] Safari
    - [ ] Firefox
    - [ ] Physical phone / touch
    - [ ] Screen reader / assistive technology

    **Release decision — recorded separately**

    | Decision                | Reviewer | Role | Date | Version | Decision |
    | ----------------------- | -------- | ---- | ---- | ------- | -------- |
    | Clinical approval       |          |      |      |         |          |
    | Device approval         |          |      |      |         |          |
    | Source approval         |          |      |      |         |          |
    | Media / rights approval |          |      |      |         |          |
    | Model approval          |          |      |      |         |          |
    | Technical acceptance    |          |      |      |         |          |
    | Release authorization   |          |      |      |         |          |

    Zero technical blockers is not clinical release approval.

19. **Recommended reviewer.** Owner; first-year fellow users; MCS/VAD educator; accessibility /
    usability reviewer where appropriate.
20. **Question.** _After direct human use, which activities are approved, which remain contained,
    and what specifically still blocks release?_
21. **Status.** NOT REVIEWED.
22. **Reviewer.**
23. **Reviewer role.**
24. **Date.**
25. **Commit / source version reviewed.**
26. **Decision.**
27. **Required changes / notes.**

---

## Activities currently held

Built from the reviewed records. **Nothing is labelled release-ready.**

| Activity                                                                                            | State                                                                    | Pending |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------- |
| Section 3 AF transfer (trigger selection)                                                           | Contained; model held                                                    | OD-01   |
| `IABP-02` (timing condition)                                                                        | Contained; condition held and unscored                                   | OD-01   |
| `CAP-IABP-01` (timing condition; internal-trigger start)                                            | Contained; condition held and unscored                                   | OD-01   |
| Section 3 steps 1–5, live IABP contour-dependent teaching                                           | Contained by an authored reference; model held                           | OD-01   |
| Sections 7–8; `LVAD-01`, `LVAD-02`, `LVAD-03`, `CAP-LVAD-01`                                        | Technically repaired but clinically NOT REVIEWED; owner-decision pending | OD-02   |
| Impella flow figures, RP identity (pathway cards, variants, crosswalk)                              | Source held                                                              | OD-02   |
| Sections 4, 6, 9; both suction stories; `IMP-01`, `IMP-02`                                          | Model held; technically repaired but clinically NOT REVIEWED             | OD-03   |
| All twelve cases' numerical conditions                                                              | Owner-decision pending (authored, labelled)                              | OD-04   |
| Ten mapped claims C01–C10                                                                           | Technically repaired but clinically NOT REVIEWED                         | OD-05   |
| Every other synthesis-backed claim (`MCS-03-10`)                                                    | Source held                                                              | OD-05   |
| Aortic arch / left subclavian / renal landmarks; SB-1; SB-2                                         | Owner-decision pending; not drawn                                        | OD-06   |
| Draft objectives, reflections, option reasoning, framings; nine question drafts; `CAP-LVAD-01` stem | Owner-decision pending                                                   | OD-07   |
| Whole module                                                                                        | Owner-decision pending                                                   | OD-08   |

## Historical queue mapping

| Historical id | Topic                                                | Group |
| ------------- | ---------------------------------------------------- | ----- |
| `MCS-03-01`   | Impella CP flow as three measurands                  | OD-02 |
| `MCS-03-02`   | Textbook's two CP flows                              | OD-02 |
| `MCS-03-03`   | Impella 5.5 flow measurand                           | OD-02 |
| `MCS-03-04`   | RP flow figure and RP versus RP Flex                 | OD-02 |
| `MCS-03-05`   | AF trigger; internal trigger with a beating heart    | OD-01 |
| `MCS-03-06`   | First response to suction at high support            | OD-03 |
| `MCS-03-07`   | Left-sided escalation in a right-limited circulation | OD-03 |
| `MCS-03-08`   | High-power pattern                                   | OD-02 |
| `MCS-03-09`   | Durable speed bounds, labeling revision, notices     | OD-02 |
| `MCS-03-10`   | Two syntheses cited as primary evidence              | OD-05 |

All ten remain `NOT REVIEWED` with null reviewer fields in the historical file, which this slice did
not edit.

## What this packet does not claim

No clinical validation. No device fidelity. No source-owner approval. No release readiness. No
measurement made in this slice beyond file hashes and the four re-opened Cardiosave passages. No
merge, no deployment, no combined acceptance, no G02 restart, and no runtime repair begun from any
option above.
