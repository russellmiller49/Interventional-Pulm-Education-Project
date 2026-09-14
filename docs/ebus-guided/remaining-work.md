# EBUS guided course — remaining work

Updated September 13, 2026. The earlier PR #189 checklist is retained below; see the bounded flow-redesign delivery note for subsequent implementation. This checklist tracks the broader `EBUS_GUIDED_REVIEW_AND_3D_BUILD_PLAN.md` beyond the completed bounded Phase 1 assignment. The owner has authorized pushing the implementation and this record to the existing PR. The course remains an unlisted development module.

## Completed implementation

- [x] Build the six initial model packages: mediastinal anatomy, scope rig, generic needle assembly, acoustic-contact cutaway, measurement phantoms and EUS-B route comparison.
- [x] Integrate the four companion model lessons into the existing shared stage and progress record (26 lessons total).
- [x] Complete the five Phase 1 lesson updates: scope orientation, acoustic contact, CT/model mapping, station 7 and right paratracheal anatomy.
- [x] Require landmark checks and gradual acquired sweeps; add changed-position station 7/4R tasks; retain traceable actual ultrasound during image-dependent questions.
- [x] Add matching anonymous letter markers, selection highlights and mode-aware hover; preserve concealed assessment labels and actual retained frames.
- [x] Execute the documented builds, type checks, focused tests and browser journeys. See [Phase 1 review](phase-1-followup-review.md), [additional-model review](additional-models-review.md) and [letter-marker review](structure-labels-review.md).

## Remaining build and content tasks

- [ ] **B1 — Additional anatomical activities.** Extend the landmark-and-sweep workflow to 4L and selected hilar/interlobar comparisons. Add the 4R/10R boundary contrast only after the target placement and boundary have been reviewed. Preserve station identity across approaches and reconcile geometry, acoustic data, presets and annotations for each new case.
- [ ] **B2 — Clinical image interpretation.** Pair Doppler/control tasks with actual image interpretation; add expert-marked border/axis exercises and a reviewed node-description bank. Keep the existing analytic phantoms as phantoms. Use clinical millimeters only when image calibration is verified, and support an inadequate-visualization response.
- [ ] **B3 — Contact/artifact media companions.** Pair the existing cutaway with reviewed examples of good coupling, air/reverberation, calcification/shadowing, gain-related detail loss and post-pass artifacts. Clearly identify each recording as reference media unless same-case correspondence is established.
- [ ] **B4 — ROSE and specimen exercises.** Build a reviewed cytology/ROSE gallery and specimen-allocation activity with representative adequacy, contamination and pathologist-confirmed examples. Keep provisional ROSE, final pathology and ancillary-test adequacy distinct.
- [ ] **B5 — Integrated examination record.** Add case-specific survey and sampling plans, including changed primary side and multiple nodes within one station. Track expected, visualized, not visualized, inadequate image, sampled/not sampled with reason, specimen label, pass count, ROSE, final pathology and pending studies as separate fields. Carry this record into a coherent final report and negative/inadequate-result decisions.
- [ ] **B6 — Additional cases and independent checks.** After pilot review, introduce further anatomies, reviewed station contrasts and hidden-answer practice cases. Extend complementary-access examples where the case supports them. Add matched clinical/CT views only when authorized source data and their correspondence are established.

Recommended implementation order: B1, then B2–B4 as reviewed media become available, followed by B5–B6. The existing model packages are the starting point for these tasks.

## Remaining source, review and validation tasks

- [ ] **R1 — Source reconciliation.** Obtain and reconcile the referenced `Text.zip`, _Handbook of Endobronchial Ultrasound.pdf_ and `EBUS_GUIDED_SOURCE_MAP_AND_REVIEW_FLAGS.md`; these were unavailable during the implementation searches. Resolve flagged disagreements against current primary sources before extending clinical teaching.
- [ ] **R2 — Anatomical and device review.** Have faculty review the carina/main-bronchus divisions, node placements, venous landmarks, station boundaries, changed-position tasks and lower paraesophageal example. Compare device-specific geometry and transitions with authorized IFU/CAD or measurements before making device-specific claims. Keep generic models explicitly generic.
- [ ] **R3 — Media collection and approval.** Inventory reusable approved media and obtain the missing teaching examples (the plan proposes roughly 20–30 selected frames/clips). Record provenance, permissions, de-identification, station/route, settings, annotations, teaching purpose and limitations. Expert annotations and confirmed pathology are required for the relevant B2–B4 tasks.
- [ ] **R4 — Learner and clinical review.** Review task wording, rationales and changed cases with faculty and beginning fellows; document findings and make the resulting corrections. Browser completion checks do not substitute for these reviews.
- [ ] **R5 — Additional compatibility/accessibility checks.** Complete Safari, assistive-technology and physical-device comparison reviews noted in the model report. Rerun the appropriate real-browser and regression checks for each subsequent implementation change.

PR delivery is authorized. Merge, public release, legacy-course replacement and backend/data changes are not part of this update.

## Bounded flow-redesign delivery — September 13, 2026

The [flow redesign review](flow-redesign-review.md) and [coverage matrix](flow-redesign-coverage.md) supersede the old seven-stage presentation assumptions. All 26 stable lessons now use explicit task flows, retaining their original teaching and source boundaries.

- **B2, supported portion delivered:** recorded depth/gain/Doppler interpretation and actual capture have explicit held-frame provenance, fixed comparison pixels and versioned questions. A structured description uses a clearly written vignette. Expert clinical border/axis truth, a reviewed clinical image bank and pathological interpretation remain open.
- **B4, supported portion delivered:** an authored written ROSE/specimen case separates nonrepresentative material, provisional malignant cells, final pathology and pending ancillary studies. The allocation task retains case/station/node/specimen identity and accepts laboratory clarification where requirements are absent. A reviewed cytology gallery remains open.
- **B5, bounded implementation delivered:** three separate versioned local case artifacts cover a station-7 model window, a written node-description vignette, and a left-primary examination/specimen/report case. The written case preserves two 4R nodes within one station, planned coverage, inadequate/unexamined targets, reasons not sampled, distinct specimens and pending results. Compatible drafts restore without live guidance; incompatible drafts are isolated and archived on explicit replacement. No pass counts are supplied or invented. Additional primary-side variants, anatomies and broader clinical records remain future scope.
- **B1/B3/B6 and R items remain open where they depend on reviewed anatomy/media, device detail, faculty or learner validation.** The flow refactor does not approve a 4R/10R contrast, new station sweep, pathology image or clinical measurement merely because a task renders.
