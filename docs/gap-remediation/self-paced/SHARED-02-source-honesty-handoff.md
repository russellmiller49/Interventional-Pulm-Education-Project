# SHARED-02 — source attribution, review language and MV source titles

## Scope and baseline

Prepared 2026-09-15 by Codex (AI authoring assistant). This is a provenance and presentation repair, **not clinical review or approval**.

- Fetched `origin/main`; the clean starting checkout was exactly `e80a03c715e806b38dc623ac59f2dd169a77a6f8`, after ECMO-02 (#222), MCS-03 (#223) and MV-03 (#224) merged. Implementation branch: `codex/shared-02-source-honesty`.
- Read the latest HD-03, ECMO-02, MV-03, MCS-03 and SHARED-01-HD-ECMO handoffs and traced the findings against that code before editing.
- No clinical position, recommendation, numerical threshold, model, question, release/publication constant, route, progress/storage implementation or self-paced behavior changed. No source gained reviewed/approved status. Device Intelligence and G02 are untouched. No new framework or dependency.

## 1. GEF attribution

### Finding and evidence

`critical-care/content/sourceConflicts.ts` correctly named two textbooks in `source`, but both `evidenceIds` resolved to `master-hemodynamics-reference`. On current main that is HD-03's supplied synthesis with no stated author, publisher, date or references, not either textbook. The existing shared registry resolves that duplicate stable ID to the HD record first; this precedence and the MCS record are unchanged.

Read the two existing PDFs in place under:
`Interventional-Pulm-Local-Data/private-references/critical-care-full-textbooks/Hemodynamics/`.
The local-authoring map and HD-03 identify this location. Used `pdftotext -layout`, checked the title/copyright pages, and rendered/visually inspected the two principal formula passages. No private PDF or page render is committed.

| Supplied file                                                 | Identity established from the copy                                                         | SHA-256                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `Advanced Hemodynamic Monitoring Basics and New Horizons.pdf` | Kirov MY, Kuzkov VV, Saugel B, editors; Springer Nature Switzerland, 2021. 289 PDF pages.  | `c026fb85e82ce6765dee7a55a54825a008f9587ad884fc52b6c68a96b0f32d79` |
| `Hemodynamic Monitoring in the ICU.pdf`                       | Giraud R, Bendjelid K; Springer International Publishing Switzerland, 2016. 111 PDF pages. | `a4e01a066d82860b470fcc67c86509da57d4d8324d855fb12f1a8eab1d1425ee` |

These are document checks by this AI assistant, not a named human clinical review. No bibliographic detail was inferred from the filenames or check date; no link/DOI was invented or added.

### Exact attribution before → after

Both `claim` strings and both `source` titles below are unchanged.

| Position                                                                                                                     | Before                                                                         | After                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `GEF = (4 × stroke volume) / global end-diastolic volume`; source `Advanced Hemodynamic Monitoring: Basics and New Horizons` | Locator `pages 62, 113, and 121–122`; evidence `master-hemodynamics-reference` | Locator `printed pages 62 (Table 7.1) and 113 (section 12.3.2); PDF pages 72 and 119`; evidence `advanced-hemodynamic-monitoring-2021` |
| `GEF = stroke volume / global end-diastolic volume`; source `Hemodynamic Monitoring in the ICU`                              | Locator `page 24`; evidence `master-hemodynamics-reference`                    | Locator `printed page 25, section 2.2.5; PDF page 43`; evidence `hemodynamic-monitoring-icu-2016`                                      |

The first formula is explicit in Table 7.1 and section 12.3.2. Printed pages 121–122 discuss GEDV interpretation and GEF-based correction; they are not the direct formula locators. In the second textbook, printed page 24 concerns extravascular lung water; section 2.2.5 on printed page 25 describes the ratio represented by the unchanged second position.

Added two narrowly scoped records to the **existing shared evidence registry**, without adding them to the HD module's 20-source list or changing any existing source-class projection. Exact new citations:

- `Kirov MY, Kuzkov VV, Saugel B, editors. Advanced Hemodynamic Monitoring: Basics and New Horizons. Springer Nature Switzerland; 2021. Table 7.1, p. 62; section 12.3.2, p. 113.`
- `Giraud R, Bendjelid K. Hemodynamic Monitoring in the ICU. Springer International Publishing Switzerland; 2016. Section 2.2.5, p. 25.`

Both records say **Supplied textbook** and explicitly state that clinical review of the conflict is not recorded. `claimType: 'clinical'` identifies the kind of claim, not review status. The second record explicitly marks the remaining uncertainty: the supplied copy does not establish whether the missing factor of four is intentional or an editorial omission. Document attribution itself is established.

The conflict's ID, context, handling, concept associations and `reviewStatus: 'sme-review'` are unchanged. No choice between formulas was made. All other conflicts and measurement clarifications are unchanged.

## 2. Review-state language

Searched runtime components and content across the educational features, excluding Device Intelligence, for `Reviewed English`, `Reviewed-English`, release approval and comparable clinical-review claims. Traced the positive matches to their source/review records and current renderers. HD-03 already neutralized HD's fallback; BF and CRRT already use neutral fallback language. The supplied HD/MV/MCS review packets do not record human clinical approval; ICU evidence is pending, airway-stent clinical records are draft, and PI's date constant does not identify a human clinical reviewer.

### Every changed fallback phrase

Paths are relative to `src/features/`. Only the unsupported review adjective changed; the remaining sentence, locale condition and translation behavior are preserved (line wrapping changed through Prettier).

| Component                                                                   | Exact phrase before                                      | Exact phrase after                              |
| --------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| `cardiohelp-ecmo/components/CardiohelpModuleFrame.tsx`                      | `Reviewed English content fallback:`                     | `English content fallback:`                     |
| `mechanical-ventilation/components/MechanicalVentilationModuleFrame.tsx`    | `Reviewed English content fallback:`                     | `English content fallback:`                     |
| `peripheral-imaging/components/PeripheralImagingModuleFrame.tsx`            | `Reviewed English content fallback:`                     | `English content fallback:`                     |
| `mechanical-circulatory-support/components/McsModuleFrame.tsx`              | `Reviewed-English fallback.`                             | `English fallback.`                             |
| `mechanical-ventilation/components/MechanicalVentilationLab.tsx`            | `Reviewed-English fallback:`                             | `English fallback:`                             |
| `icu-simulation/components/IcuSimulatorHub.tsx`                             | `Reviewed-English fallback:`                             | `English fallback:`                             |
| `icu-simulation/components/IcuSimulatorLab.tsx`                             | `Reviewed-English fallback:`                             | `English fallback:`                             |
| `airway-stent-mechanics/components/learning-lab/AirwayStentLearningLab.tsx` | `Reviewed English fallback · translation review pending` | `English fallback · translation review pending` |
| `mechanical-ventilation/components/SourcesPanel.tsx`                        | `before the reviewed-English fallback is removed.`       | `before the English fallback is removed.`       |

The old MV lab and airway-stent learning lab are retained components, not the current page entry points. Their rendered component suites were exercised; no route was added to expose them. The airway-stent fallback is a dormant branch while its clinical status is draft; the existing visible **English clinical draft fallback** branch remains unchanged. The two ICU strings were the same unsupported fallback claim found by the cross-feature search; their repair is text only.

### Every other review-status phrase changed

Publication alone does not establish clinical review. The following conditional labels now describe publication, with **the same condition and release constants** as before. These published branches are currently dormant in the preview modules.

| Component / field                                                                                  | Exact phrase before                                | Exact phrase after                       |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------- |
| ECMO `CardiohelpModuleFrame`, release label                                                        | `Reviewed release`                                 | `Public release`                         |
| ECMO `SourcesPanel`, publication badge                                                             | `PUBLISHED · REVIEW APPROVED`                      | `PUBLISHED`                              |
| ECMO `SourcesPanel`, Publication value                                                             | `Reviewed release`                                 | `Public release`                         |
| MV `MechanicalVentilationModuleFrame`, release label                                               | `Reviewed release`                                 | `Public release`                         |
| MV `MechanicalVentilationLab`, publication badge                                                   | `Reviewed release`                                 | `Public release`                         |
| MV `SourcesPanel`, publication badge                                                               | `PUBLISHED · REVIEW APPROVED`                      | `PUBLISHED`                              |
| MV `SourcesPanel`, Publication value                                                               | `Reviewed public release`                          | `Public release`                         |
| CRRT `BaxterCrrtModuleFrame`, release label                                                        | `Reviewed release`                                 | `Public release`                         |
| PI `PeripheralImagingModuleFrame`, release label                                                   | `Reviewed ${REVIEWED_ON}` (currently `2026-09-08`) | `Public release`                         |
| Shared `critical-care/content/evidenceRegistry.ts`, `mechanical-ventilation-source-boundary` title | `Mechanical ventilation reviewed source boundary`  | `Mechanical ventilation source boundary` |

The PI date constant and its visible **References · checked 2026-09-08** record remain. Only the unused frame import was removed. No real attributable review record was erased.

### Investigated and retained

- Learner-owned **reviewed** marks, thermodilution trace-review actions and progress records describe learner activity, not faculty review; unchanged.
- Document-check dates, source identities, peer-reviewed article types, review requirements, and explicit **none recorded yet** lines remain. HD-03's dated AI document checks remain attributable checks, not human approval.
- Airway-stent clinical-review status branches remain tied to their clinical status; current records are draft. They are not publication-derived claims, and this task does not promote them.
- HD-03's shared `Versioned sources…` drawer description does not claim human review. The shared registry's clinical/device/model projection and the default `sme-review` metadata are unchanged. A queue status is not a clinical sign-off.
- MCS-03's separate CP-measurand/IFU locator issues and shared-stage visibility question remain outside this GEF/fallback/title repair.

## 3. MV source-card readability

**MV-local defect**, not a shared-component defect. Reproduced before editing on `/en/mechanical-ventilation` after opening supporting sources. The source panel styles use `var(--navy)` for headings and profile values. In the current MV dark shell, that token is `#07191d`, a background color; source-card backgrounds are transparent and inherit the dark surface. Browser-computed title color was `rgb(7, 25, 29)`.

Smallest repair: within MV's existing `.sourcesSection`, set `--navy: var(--ink)`. This fixes the source panel heading, manufacturer/supporting source titles and profile values using that token. It does not change shared CSS, other module palettes, layout, font sizes, source data or the console. The panel follows its containing palette rather than forcing a light/dark color.

Afterward, current dark-shell source titles compute to `rgb(234, 244, 244)`. Against the nearest opaque ancestor, `rgb(7, 17, 29)`, calculated text contrast is approximately **1.05:1 → 16.93:1**. Chromium checks cover all four console profiles, supporting-source disclosure by keyboard, the held MV-03 case panel, and 1440×900 / 390×844 layouts. Phone width has no horizontal page overflow. Screenshots were opened and inspected.

Other existing presentation issues (the dense/narrow profile grid and amber review-boundary text) were visible during inspection; neither is redesigned here. The fixed titles are readable.

## Verification

Local derived evidence: `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/shared-02-source-honesty-2026-09-15/`. Scripts, command logs, JSON reports and screenshots are outside Git. Private source renders remain outside the checkout. No stored secrets were read, and no remote data/upload/Supabase operation occurred.

### Tests and checks

`test-paths.json` records the exact targeted paths. The command was `node node_modules/jest/bin/jest.js <those paths> --runInBand --json --outputFile=…`, on clean main before edits and on the final code. An initial broader eight-feature run was stopped without a completed report and is **not counted** as verification; the bounded run below completed on both trees.

| Consumer                                                                                      | Suites |                                       Final tests |
| --------------------------------------------------------------------------------------------- | -----: | ------------------------------------------------: |
| All critical-care suites, including source/conflict, evidence rendering and catalog consumers |     26 |                   233 passed, 3 baseline failures |
| HD: source classes, stage sources, derived hemodynamics, case self-paced                      |      4 |                                        101 passed |
| MV: source identity, components, self-paced                                                   |      3 |                                         48 passed |
| ECMO: components, stage sources, self-paced                                                   |      3 |                                        171 passed |
| MCS: components, module surfaces, MCS-03 source holds                                         |      3 |                                         53 passed |
| PI: hub, release boundary                                                                     |      2 |                                         13 passed |
| Airway stent: learning-lab shell and components                                               |      2 |                                         14 passed |
| ICU Simulation: components                                                                    |      1 |                                         22 passed |
| CRRT: scaffold                                                                                |      1 |                                          2 passed |
| **Total**                                                                                     | **45** | **657 passed, 3 baseline failures; none skipped** |

Baseline: 45 suites, 655 passed / 3 failed. Final: 45 suites, 657 passed / 3 failed. Two new provenance tests pin the unchanged GEF formulas, correct source resolution/locators, explicit uncertainty/no-review limitation, retained handling/status, rendered IDs and unchanged Master synthesis identity. Existing fallback assertions now require neutral English wording; negative assertions reject the old claim. No tests are disabled or weakened to conceal a failure.

The same three tests fail with **byte-identical failure messages** on baseline and final (`failure-comparison.json`):

1. `critical-care/__tests__/accessibility.test.tsx`: existing CRRT pressure-image accessible-name expectation.
2. `critical-care/__tests__/curriculum-sequencing.test.tsx`: expected CRRT case order omits the existing troubleshooting challenge.
3. `critical-care/__tests__/learner-copy.test.ts`: existing all-module static-copy findings.

Other checks:

- `npm run type-check`: exit 0.
- Changed-path ESLint on every changed TS/TSX file with `--max-warnings=0`: no errors, one existing `react-hooks/set-state-in-effect` warning at `IcuSimulatorLab.tsx:501`; strict exit 1. Re-ran ESLint on `git show origin/main:<path>` through `--stdin --stdin-filename`: **identical warning output**, including line and effect. The effect is untouched.
- Changed-path Prettier check: clean. `git diff --check`: clean.
- Final source/conflict suite after formatting: passed.
- No production build, full-repository suite, deployment, clinical review or human learner session was run.

### Browser checks

Playwright Chromium against an isolated Next dev server on port 3118, dummy preview configuration and ephemeral localhost auth. API calls were fulfilled locally; external requests were blocked. `browser-final.json` combines the completed main run and the single corrected HD assertion recheck: **22 checks passed, zero page exceptions**.

- MV hub: four console source profiles; open supporting references using keyboard; all source titles use the readable foreground. Desktop and phone screenshots; no phone page overflow.
- MV-03 practice: the existing **Worked explanation · live case under modeling review** hold remains; source-card titles are readable.
- English, Spanish and Simplified Chinese overview routes for MV, ECMO, MCS, PI and ICU: no English-route fallback banner, neutral fallback on both non-English routes. ICU's active sandbox also shows the neutral Spanish-route banner.
- HD derived-hemodynamics source footer: supplied synthesis class, unknown date and explicit no-clinical-review record remain. Source disclosure opens normally.
- MV expiration-and-air-trapping lesson footer: source identities and existing no-clinical-review line remain visible.
- Shared `cc.measurement.measurand` concept: both formulas, both textbook names, corrected printed/PDF locators and original handling remain visible.

Harness corrections, not application defects: initial MV heading used `HAMILTON-C6` where the actual short name is `C6`; the English-route scan matched the MV publication checklist rather than a fallback banner; HD's summary includes a count, and CSS uppercases its class label in `innerText`; MV uses `activity=…` and an already-open footer rather than `unit=…` and the older disclosure. Corrected selectors/route/text inspection and reran affected checks. Intermediate reports are retained.

Inspected screenshots: MV before, MV after desktop/mobile, MV case sources, ECMO fallback, HD source footer and GEF concept. No browser claim is made for dormant published branches or the old MV/stent lab entry points; their existing component tests cover the retained components. Safari/Firefox, screen readers, native zoom and every lesson/case were not exercised.

### Structured-module checks within this repair

| Rule | Result and scope                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| H1   | PASS for preservation: existing routes, curriculum and navigation are unchanged.                                                          |
| H2   | NOT APPLICABLE: no lesson or teaching sequence authored.                                                                                  |
| H3   | NOT APPLICABLE: no stage migration or shared stage layout change.                                                                         |
| H4   | PASS for preservation: no task or action controls changed.                                                                                |
| H5   | PASS for the named surfaces: corrected attribution/labels/titles render in the tested consumers.                                          |
| H6   | PASS for preservation: no activity or completion predicates changed.                                                                      |
| H7   | PASS under the existing self-paced contract: no feedback, reveal or safety logic changed; targeted self-paced suites pass.                |
| H8   | PASS for the bounded diff: formulas, thresholds, clinical positions, engines and assets unchanged. Clinical adjudication remains pending. |
| H9   | PASS for preservation: no progress, storage or identity changes; targeted self-paced suites pass.                                         |
| H10  | PASS: neutral review language preserves the remaining clinical and translation wording.                                                   |
| H11  | PASS: no release-state change, deployment, G02 or Device Intelligence work.                                                               |
| H12  | PASS only for the 22 recorded browser checks and inspected screenshots; excluded checks remain unrun.                                     |

## Remaining evidence questions and stop boundary

- The textbook attribution is established, but the second textbook's missing factor of four remains unexplained. No erratum, underlying cited study or device convention was verified, and the conflict was not clinically adjudicated.
- A named/dated human clinical review of these modules and this conflict remains unrecorded in the inspected evidence. Existing source/model holds from HD-03, ECMO-02, MV-03 and MCS-03 remain.
- The shared duplicate Master ID, source-class projection, other conflicts/clarifications and review-queue metadata are not normalized by this task.

This delivers one bounded SHARED-02 PR. Do not merge or deploy it as part of this task. Do not begin G02 or modify Device Intelligence.
