# Critical-Care Curriculum Plan — Independent Review

**Date:** 2026-07-24
**Reviewed:** `critical-care-integrated-curriculum-plan.md` (labeled "Version 2") and `critical-care-integrated-curriculum-plan_v2.md` (labeled "Version 3 Revision")
**Cross-checked against:** the 5 synthesis files, the 39 PDFs in `Full_textbooks/`, the `src/features/critical-care` codebase, `docs/critical-care/*`, and the git repository state.
**Companion deliverable:** `critical-care-integrated-curriculum-plan-v4.md` (merged, corrected plan)

---

## Verdict

The plan is strong on **content governance** and **instructional sequencing**, and both are better than what most commercial medical-education products have. V2's normal-before-abnormal contract, the failure-complexity ladder, the shared concept spine, and the localize-before-intervene troubleshooting model are genuinely good pedagogy and should be preserved verbatim.

Three things block it from being a high-quality educational program:

1. **It is a content-derived curriculum, not a needs-derived one.** Every objective traces to a textbook. None traces to a documented performance gap in actual PCCM fellows. This is the single largest educational weakness and it is invisible because the provenance machinery is so elaborate.
2. **There is no validity argument for assessment.** An 80% cut score and a critical-error list are asserted, not defended. For a program that uses the word "mastery," that is the claim most likely to be challenged and least likely to survive.
3. **The plan's own governance rules are already violated on disk.** 132 copyrighted PDFs are committed to git history (`.git` is 4.5 GB), the anchor scheme it calls "traceable" is four mutually incompatible schemes, and a large fraction of provenance references point at documents that do not exist in this repository.

Fix (3) this week, (1) before authoring anything new, and (2) before the word "mastery" appears in any learner-facing screen.

---

## Section A — Immediate remediation (do before any curriculum work)

### A1. Copyrighted source material is in git history

`git ls-files "*.pdf"` returns **132 tracked PDFs**, including full textbooks under `critical_care_references/`. The `.git` directory is **4.5 GB**. `Critical_Care_Reference/` (the newer root, containing another 39 PDFs and 10.7 MB of syntheses) is **untracked but not gitignored** — a single `git add -A` commits it.

V3 says "Do not commit, publish, bundle, or reproduce full texts without documented rights." That instruction is already too late. Required actions, in order:

- Add `Critical_Care_Reference/`, `critical_care_references/`, and `**/Full_textbooks/` to `.gitignore` **today**, before the next commit.
- Confirm the repository has never been pushed to a public remote. If it has, treat the textbook exposure as a disclosure event.
- Plan a history rewrite (`git filter-repo`) to strip the 132 PDFs. This is disruptive and needs to happen before more history accumulates, not after.
- Decide whether the synthesis files themselves are publishable. See A3 — several of them are not.

### A2. Two competing reference roots

`critical_care_references/` (611 MB, 134 tracked files, 7 subfolders including `ventilator manuals`) and `Critical_Care_Reference/` (untracked, 39 PDFs) overlap substantially but not completely. V3 correctly identifies this. Add: the older root contains material the newer one does not — `ICU_One_Pager_ECMO_troubleshooting.pdf`, `Right heart catheterization (RHC) - EMCrit Project.pdf`, `ventilator manuals/`, and `The ECMO Book/` split into 30+ per-chapter PDFs. Reconciliation must be additive; do not delete the old root until the manifest proves coverage.

### A3. The syntheses are not uniformly safe to retain in their current form

The audit found material problems beyond "these are long":

| Finding                                       | Detail                                                                                                                                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Not deduplicated despite the heading          | `Mechanical_Circulatory_Support.md` §3 is 96% of the file (17,864 of 18,579 lines) and is **source-siloed**, with a separate "Complete Textbook Knowledge Extract" per book. The heading says "Master Knowledge Base (deduplicated)." It is not. |
| Reproduces source table-of-contents structure | MCS carries headings like `##### Part IV — Techniques (403-527)` and `##### Section I — Management of Cardiogenic Shock` lifted from the books.                                                                                                  |
| Reproduces operative technique step-by-step   | ECMO §8.7 contains sequential cannulation steps for 8 named procedures, e.g. purse-string placement with suture size and tourniquet handling.                                                                                                    |
| 322 explicitly verbatim definitions           | `CRRT_Synthesis.md` contains 322 instances of `**Definition (source's):**`.                                                                                                                                                                      |
| Pipeline artifacts in the deliverable         | 198 `##### Chunk NN` headings in MCS; duplicated text in headings; a citation reading `(see Ch.7, chunk 03)`.                                                                                                                                    |

**Recommendation:** MCS in its current state is closer to a derivative work than a synthesis. Before it is used as an authoring source, it needs a deduplication pass, removal of source-TOC headings, and removal of chunk markers. Treat "is this file safe to keep on disk in a repository" as a separate question from "is this file safe to publish."

### A4. Provenance traceability is currently aspirational

Both plans lean on "traceable anchors" as the foundation of clinical safety. The corpus does not yet support that:

- **Four incompatible anchor schemes.** MCS puts `[TAG] {#anchor}` inline; CRRT reverses to `{#anchor} **[TAG]**`; ECMO has **no anchors in §3 at all** (they live only in the §8 ledger); Hemodynamics §3 uses bare page cites with anchors only in per-source sub-ledgers.
- **Dangling references to documents that don't exist.** All five files cite upstream sections `§9`–`§16` — **547 times in MCS alone**, 256 in Educational, 133 in Hemodynamics, 118 in ECMO, 98 in CRRT. Those per-source extract documents are not in this repository. Every one of those provenance trails is currently broken.
- **840 duplicate HTML anchor IDs in CRRT.** Educational, Hemodynamics, and MCS neutralize their §8 ID lists (backticks or brace-stripping). CRRT does not, so every anchor is declared twice and deep links are non-deterministic.
- **Two citations exceed their source's page count.** `case-based-device-therapy-complete-textbook` is cited at pp.337–340 against a 336-page PDF; `nutrition-metabolism-kidney-support-rrt` at p.634 against a 632-page PDF. Probably a printed-vs-PDF page offset, but as written they cannot be resolved.
- **Reliability caveats are dense in the largest file.** MCS carries 249 `[[INFERRED:]]` and 258 `[LOW-CONF]` tags — roughly 9% of its 5,487 knowledge units. That content must not reach a learner unreviewed.

Add a Workstream 0 deliverable: **normalize the anchor scheme across all five files, resolve or delete every §9–§16 reference, and de-duplicate CRRT's IDs.** Until that is done, "every learner claim maps to a source anchor" is not a checkable statement.

---

## Section B — Problems with the plan documents themselves

### B1. The version numbering is broken

`critical-care-integrated-curriculum-plan.md` contains a document titled "Version 2." `critical-care-integrated-curriculum-plan_v2.md` contains a document titled "Version 3 Revision." In a project whose central thesis is versioning and provenance discipline, this is worth fixing immediately. The companion V4 file supersedes both; archive them with explicit dates.

### B2. V3 would destroy V2's best content if applied literally

V3 opens: _"Replace `critical-care-integrated-curriculum-plan.md` with Version 3."_ But V3 is a 64-line governance memo. It does not contain the standard lesson grammar, the normal-before-abnormal contract, the failure-complexity ladder, the concept spine, or the per-module sequences — all of which are V2's most valuable and most implementable content. V3 is a **diff**, not a replacement. Applying it as written loses the curriculum.

### B3. V3's formatting will degrade implementation quality

V3 has broken markdown (`hierarchy:current guidelines/consensus...` on line 12 collapses a six-item list into a sentence fragment), no heading hierarchy, and inline lists mashed into paragraphs. If this document is handed to a coding agent as the specification, ambiguity in the source produces ambiguity in the output. V4 restores structure.

### B4. The ACGME citation does not verify

V3 cites "the 2026 ACGME requirements." The current published PCCM program requirements are the 2022v2 document, the 2024 revision, and the **2025 reformatted** version, with an interim revision effective **September 3, 2025**. I could not locate a 2026-dated PCCM requirements document. Cite what exists, with its effective date. A plan about citation discipline should model it.

---

## Section C — Educational design gaps

These are the substantive additions. Each is incorporated into V4.

### C1. No needs assessment — the foundational gap

Both plans derive objectives from textbooks. Kern's model starts with **problem identification** and **targeted needs assessment of the learners**, and only then moves to goals and objectives. There is currently no documented answer to:

- What do PCCM fellows actually get wrong with these devices, measured how?
- Which of the 133 activities addresses a gap that exists, versus a gap the textbook happened to cover well?
- What do program directors say their fellows can't do?

Without this, the curriculum's shape is determined by which books were available, and the ECMO module has 36 activities while the entire ICU integration layer has 6 scenarios — a ratio driven by source density, not by clinical importance or gap size.

**Minimum viable fix (weeks, not months):** structured interviews with 5–8 PCCM program directors and 10–15 fellows; a short critical-incident survey ("describe a time you or a trainee misread a device signal"); a review of the ABIM CCM blueprint and ACGME milestones for these domains; and a documented gap register that every objective must cite. Objectives that cannot cite a gap get demoted to "reference-only."

**Note:** `Curriculum-Development-for-Medical-Education.pdf` (Kern) is sitting in `Full_textbooks/Educational Approaches/` **uncovered by any synthesis**. It is the single most useful uncovered book in the folder for exactly this problem — and it should be read by the author directly, not fed into the synthesis pipeline.

### C2. No validity argument for assessment

V3 says: _"Preserve existing 80% and critical-error rules for compatibility, but label them as module-specific educational mastery thresholds until formal standard-setting evidence exists."_ That is honest but it defers the central problem indefinitely.

Restructure the assessment section around **Messick's five sources of validity evidence**, and make each one a deliverable:

| Source                       | Deliverable                                                                       | Status today      |
| ---------------------------- | --------------------------------------------------------------------------------- | ----------------- |
| Content                      | Objective→item blueprint, SME review of item-objective fit                        | Partially planned |
| Response process             | Think-aloud with 5+ fellows; confirm items measure reasoning, not UI-guessing     | Absent            |
| Internal structure           | Item difficulty/discrimination, internal consistency, per-domain scoring behavior | Absent            |
| Relations to other variables | Novice-vs-experienced discrimination; correlation with training year              | Absent            |
| Consequences                 | What happens to a fellow who fails; false-pass rate on critical errors            | Absent            |

**Replace the 80% cut score with an actual standard-setting exercise.** For a criterion-referenced simulation assessment, a modified Angoff or Hofstee panel (6–10 SMEs) or a borderline-group method takes a day per module and converts an arbitrary number into a defensible one. Until then, do not display "mastery" — display "met the module criterion (provisional)."

### C3. The Miller-level claim is one tier too high

V2 §7 lists "Demonstrates mastery" and "Integrates across systems" as top tiers. V3's assumptions correctly walk this back ("educational simulation performance only"), but the blueprint was never updated to match.

**Cap the program explicitly at Miller's "Shows how."** Simulation, however good, does not establish "Does." Then turn that limitation into a feature: ship an **exportable workplace-based assessment handoff** — an entrustment-scaled observation form, tied to the same objective IDs, that a fellow's actual program can use at the bedside. That closes the loop honestly and is a genuine differentiator over every other simulation product.

### C4. Debriefing is the biggest unaddressed simulation risk

V3 adds a prebrief (correct, and aligned with the current INACSL standards, which were revised in 2025 for Prebriefing, Facilitation, Professional Integrity, and Debriefing). But it does not specify a **debriefing method**, and the product's primary mode is self-directed — meaning most debriefs will have no debriefer.

The evidence is more encouraging than it first appears: structured self-guided debriefing performs comparably to facilitator-guided debriefing on learning outcomes in several studies, and _structured_ and _video-assisted_ debriefing outperform unstructured debriefing. The operative word is **structured**. Unguided reflection after a case is not a debrief.

**Design requirement to add:** every scored simulation ends with a specified self-debrief protocol —

1. learner states their frame ("what did you think was happening, and why?") before seeing any result;
2. system replays the decision trace with timestamps;
3. system contrasts it with an **expert model trace** for the same scenario, authored alongside the case;
4. learner names the divergence point and the cue they missed;
5. system routes to the specific concept, not the module.

The expert model trace becomes a required authoring artifact per scenario. This is more work than "write a debrief paragraph" and it is the difference between a simulator and a curriculum.

### C5. If faculty facilitation is claimed, it must be equipped

V3 positions the program as "self-directed and faculty-facilitated." No facilitator materials exist in either plan. Either drop the claim or deliver, per scenario: a facilitator guide, an observation checklist keyed to the same objective IDs, a calibration set with scored exemplars, and a stated inter-rater agreement target.

### C6. Retention and spacing are treated as evaluation, not design

V3 mentions a 4–6 week retention check "during pilot evaluation." That measures decay; it does not prevent it.

The concept spine makes something better possible, and nobody else in this space has it: a **cross-module spaced-retrieval queue**. Because concepts are shared (`cc.flow.transmural-pressure` appears in ventilation, hemodynamics, ECMO, and MCS), the system can interleave retrieval items across modules at expanding intervals. Interleaving and spacing are among the best-supported effects in the learning-science literature, and the architecture V2 already proposes is the exact prerequisite. Build it in Slice B, not as an afterthought.

Keep the 4–6 week retention check as _evaluation_ — and V3 is right to label the interval a program-evaluation choice rather than an evidence-based retraining schedule.

### C7. Cognitive load is invoked but not managed

V2 correctly names pretraining, progressive disclosure, and predict-before-reveal. Add three things that make it operational:

- **An element-interactivity budget per mechanism lab.** One manipulated variable is stated; also state a ceiling on simultaneously displayed novel elements (a working number: ≤5 novel elements for foundation-level labs).
- **Worked-example fading.** First instance fully worked, second partially, third independent. The failure-complexity ladder is a _case_ progression; this is the missing _within-skill_ progression.
- **Name the expertise-reversal effect.** V2's "allow experienced learners to proceed directly" is exactly the right accommodation. Naming it tells the implementer _why_, which prevents someone from later "improving" the product by forcing everyone through Stage 0.

Measure it in the pilot with a validated instrument (Paas single-item, or Leppink's differentiated scale) rather than "did it feel hard."

### C8. Program evaluation has no framework

Both plans have usability sessions and a pilot. Neither has a program evaluation model, pre-specified outcomes, or a logic model. Adopt Moore's expanded outcomes framework (Levels 1–7) or Kirkpatrick, pre-register which levels are in scope (realistically 1–4: participation, satisfaction, declarative and procedural knowledge, competence in the simulator), and state that Levels 5–7 (performance, patient health, community health) are explicitly **out of scope and not claimed**. Then define, for each metric, what decision it drives.

### C9. Missing: productive failure and error management

The failure-complexity ladder is well-designed but the plan's coaching model is uniformly corrective ("pause-and-correct"). For troubleshooting expertise specifically, letting learners commit to a wrong localization _and experience the non-response_ before correction produces better transfer than preventing the error. Add an explicit rule for when to let an error play out versus when to interrupt — with a hard exception list for actions that would be catastrophic in reality, which must always be interrupted with a stated reason.

### C10. Longitudinal threads are implicit

Three concepts appear in every module: RV failure, heart–lung interaction, and measurement validity. The spine contains them but treats them as flat entries. Promote them to named **longitudinal threads** with deliberate cross-module callbacks and interleaved retrieval. A fellow who understands transmural pressure in ventilation, then meets it again in tamponade, then in VA-ECMO LV loading, has something no single-module product can produce. This should be the program's headline claim.

---

## Section D — Scope and content

### D1. The program's name overstates its coverage

For adult PCCM fellows, "critical care" implies neurocritical care, sedation/analgesia/delirium, sepsis and antimicrobials, nutrition, transfusion, toxicology, end-of-life care, and POCUS. This program covers **cardiopulmonary organ support**. That is a coherent and defensible scope — but it should be named honestly ("Critical Care Organ Support" or similar) or the exclusions must be visible to learners, not just documented in an internal plan.

### D2. POCUS / critical care echo is the most conspicuous gap

Hemodynamic assessment without echocardiography is no longer standard practice, and several of the plan's own scenarios (tamponade, RV shock, mixed shock) are echo-dependent in reality. The repo already contains `thoracic-ultrasound-simulator` and `pleural-ultrasound-simulator` — the rendering and interaction infrastructure exists. Either scope echo in as a future module and say so, or add a prominent statement that hemodynamic decisions in the simulator are deliberately echo-free and that this is a simplification.

### D3. Mechanical ventilation is a retrofit, not a build

Both plans treat ventilation as a gap to fill. It isn't — **24 activities already exist** (8 lessons + 15 cases + 1 assessment) and were authored _without_ the synthesis. When your synthesis lands, the work is **reconciliation, and it may be destructive**: existing lessons may contradict the new sources and some may need to be pulled or rewritten. Budget for that explicitly, and pre-commit to the decision rule for what happens when authored content and new source disagree.

Three ventilation textbooks (3,193 pages: Tobin 3e, the 8th-edition text, and the pathophysiology-to-evidence volume) are uncovered. That is more source material than the CRRT and ECMO syntheses combined drew on — the synthesis pass will be large.

### D4. Four other uncovered sources

Beyond the three ventilation texts: `Hemodynamic Monitoring.pdf` (476 pp), `Curriculum-Development-for-Medical-Education.pdf` (Kern), `Innovation in Medical Education and Clinical Practice.pdf`, `Podcasting for Medical Professionals.pdf`. V3's arithmetic (39 total, 32 covered) is **correct**. My recommendation differs on disposition: Kern should be read, not synthesized; Podcasting is almost certainly out of scope and should get a documented exclusion rather than a synthesis pass.

---

## Section E — Technical assumptions that don't hold

Verified against the codebase. These matter because several plan requirements are currently unenforceable.

| Plan assumption                                               | Reality                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "133 activities"                                              | **Correct**, but only **127 are distinct** — `icu-simulation`'s 6 scenarios are registered twice (once as `practice`, once as `assess`, from the identical seed array at `content/activities.ts:859-860`). The headline number is inflated by 6.                                                                                                                                                                                                                                                                                |
| CRRT: 7 lessons + 17 practice cases                           | **Confirmed.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Ventilation: 8 lessons + 15 cases                             | **Confirmed.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 6 integrated ICU scenarios                                    | **Confirmed.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| "None are yet released"                                       | **Confirmed** — 0 released, 77 `sme-review`, 56 `draft`. Note the tension: **56 activities are `competency-eligible`** while 56 are `draft`. The schema forbids `draft` + `competency-eligible`, so these are different sets, but the overlap needs an explicit reconciliation table.                                                                                                                                                                                                                                           |
| Evidence registries are authoritative                         | Partially. Six per-module registries exist with **six different type shapes**. Critically, **`evidenceIds` on `CriticalCareActivityDefinition` are never resolved against anything** — `validateCriticalCareCatalogs()` checks moduleIds, pathwayIds, competencyIds, assetIds, and prerequisiteActivityIds, but not evidence. Two IDs in the live catalog (`mcs-device-source-registry`, `mechanical-ventilation-source-boundary`) resolve to nothing. **This is the highest-leverage single technical fix in the whole plan.** |
| Accessibility gates (200% zoom, 320px reflow, reduced motion) | **Unenforceable with the current toolchain.** No `jest-axe` anywhere in the repo, no e2e framework (`e2e/` is empty), no visual-regression tooling. Automated a11y is limited to the Storybook a11y addon across 12 stories. If a11y is a release gate, install the tooling in the blueprint slice or delete the gate.                                                                                                                                                                                                          |
| Locale-specific clinical review before translated release     | **Premature.** There is _zero_ i18n coverage for critical care — no `useTranslations` call in any of the seven critical-care features; all strings are hardcoded English. Defer localization entirely; require only string-externalization discipline for new content.                                                                                                                                                                                                                                                          |
| Prerequisites exist                                           | Only **13 of 133** activities have non-empty `prerequisiteActivityIds`. Referential integrity is validated; **cycles are not**. Add cycle detection when the concept graph lands.                                                                                                                                                                                                                                                                                                                                               |
| "Concepts" already exist                                      | They do not. There is no concept model anywhere in the codebase. The 25-entry **competency** registry and 17 **pathways** are the closest existing hooks and are where the concept layer should attach.                                                                                                                                                                                                                                                                                                                         |
| WCAG 2.2 AA                                                   | Correct standard, still current.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

One additional asset the plans don't credit: `clinicalLearningItem.ts` already enforces `evidenceIds` (1–30, required), a `reviewStatus`, choice-level `plausibility`, and a **software-jargon blocklist** that fails validation if learner copy contains words like "reducer," "engine," or "localStorage" unless an override reason is supplied. That is a better content-safety mechanism than most of what the plan proposes to build — extend it rather than duplicate it.

---

## Section F — Sequencing

Both plans propose seven workstreams touching all six modules. With the retrofit work now visible (ventilation reconciliation, anchor normalization, evidence-ID enforcement, a11y tooling, plus a needs assessment), that sequence will not converge.

**Recommendation: hard-scope to a minimum releasable slice.** One module — hemodynamics + the Impella vertical — taken all the way to _actually released_, including standard setting, usability testing, and every human sign-off. Everything learned there reprices the remaining six. Both plans already nominate hemodynamics + Impella as the pilot; the change is to make **release**, not "clinical-review-ready," the gate before workstream 4 starts.

Concretely, the order in V4 is:

0. Remediation (gitignore, history plan, root reconciliation, anchor normalization) — days
1. Needs assessment and gap register — weeks, runs in parallel with 0
2. Blueprint and metadata (concept graph, objective registry, evidence-ID enforcement, validators, a11y tooling) — the technical foundation
3. Hemodynamics + Impella **to release**, including standard setting and 5+ fellow usability sessions
4. Ventilation reconciliation (once your synthesis lands)
5. ECMO and CRRT core review
6. Remaining MCS and integrated ICU
7. Program evaluation and iteration

---

## Section G — What to keep unchanged

Carried into V4 verbatim or near-verbatim:

- The normal-before-abnormal contract (V2 §4) — the strongest single idea in the plan.
- The failure-complexity ladder, seven rungs (V2 §4).
- The standard lesson grammar (V2 §4).
- The troubleshooting localizer concept spine (V2 §2) — `localize-before-intervene` with the pre-pump / active-component / post-pump / exchanger decomposition is excellent and generalizes across all four device families.
- The `selected → displayed → native → effective → perfusion` distinction (V2 §6, Workstream 3). This is the concept most likely to change actual practice and it should be a program-level thread, not an Impella detail.
- Recommendation ordering (V2 §5) and session-only readiness answers.
- The source-authority hierarchy (V3) — a clear improvement over V2's "only convergent claims may be core."
- The three-deliverable distinction: source statement / reviewed learner explanation / synthetic model behavior (V3). Also excellent.
- The rule that no source statement may silently alter engine parameters, scoring, or critical errors (V3).
- Separation of "clinical-review-ready" from "public-release-ready" (V3).

---

## Section H — Open decisions that need you

These cannot be resolved from the documents and are listed at the end of V4:

1. **Git history rewrite** — yes or no, and when. Blocks safe collaboration.
2. **Program name and scope statement** — does "critical care" stay?
3. **Faculty-facilitated mode** — real product mode, or drop the claim?
4. **Standard setting** — can you convene 6–10 SMEs for one day per module? If not, "mastery" language must go permanently.
5. **Needs assessment access** — do you have a route to PCCM program directors and fellows for interviews?
6. **MCS synthesis disposition** — regenerate with deduplication, or accept it as an unpublishable internal artifact with a heavy review tax?
7. **Ventilation reconciliation rule** — when your new synthesis contradicts an existing authored lesson, does the lesson get pulled by default?
8. **POCUS** — future module, or documented permanent exclusion?
