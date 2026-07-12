# Airway Stent Clinical Decision Lab — Clinical Review Checklist

Status: **Draft · clinical review required**

Primary route: `/[locale]/airway-stent-mechanics`

This checklist is the release gate for changing `clinicalReviewStatus` from `draft` to `reviewed`.
Review the visible learner experience, source boundaries, optional physics lenses, assessment, and
the hands-on bootcamp coordination together.

## 1. Indication statements

- [ ] Confirm the no-stent case accurately frames a stable airway after successful treatment of
      purely intrinsic malignant obstruction.
- [ ] Confirm that mixed obstruction with important residual extrinsic compression is framed as a
      possible structural indication, contingent on symptoms, intended benefit, downstream lung,
      overall treatment plan, anatomy, local resources, and operator expertise.
- [ ] Confirm that stenting is not presented as automatic after debulking or as a substitute for
      tumor-directed therapy.
- [ ] Confirm the aerodigestive-fistula case compares airway-only, esophageal-only, combined, and
      no-airway-stent pathways before assigning an airway device a sealing job.
- [ ] Confirm that the selected dynamic-collapse vignette is explicitly a defined temporary trial,
      not a general recommendation.

Primary sources: CHEST CAO guideline; WABIP malignant and benign airway-stenting guidelines.

## 2. Benign-disease statements

- [ ] Review every statement about definitive therapy, temporary support, removability, dwell
      horizon, tissue incorporation, and exit planning.
- [ ] Confirm that no architecture is presented as a default permanent solution for heterogeneous
      benign disease.
- [ ] Confirm that the uncovered and partially covered teaching families do not imply easy later
      removal.

Primary source: WABIP benign central-airway-obstruction stenting guideline.

## 3. Sizing and fit statements

- [ ] Confirm the lumen-budget cross-sections use one true drawing scale and that inner diameter,
      circular lumen area, inner-to-outer diameter ratio, and lumen-area fraction are calculated
      correctly from the displayed illustrative wall geometry.
- [ ] Confirm the thicker-wall silicone comparison is qualitative and is not converted into an
      unsupported airflow, symptom, complication, or patient-outcome model.
- [ ] Confirm that the required path teaches landing zones, disease length, taper, curvature,
      branches, dynamic change, and future remodeling without providing a universal oversizing or
      margin rule.
- [ ] Confirm that the Y-stent case requires whole-device review: tracheal segment, saddle, both
      limb diameters and lengths, branch angles, device ends, and distal patency.
- [ ] Confirm that Hu et al. is described only as a study-specific association involving Dumon
      stents and is not converted into a universal cutoff or patient-level risk equation.
- [ ] Review all architecture-registry claims about deployment, apposition, customization, and
      removal against current instructions for use before publication.
- [ ] Confirm the curved-airway solid-silicone scene shows straightening, sliding, gapping, or
      central involution rather than braid-angle foreshortening.
- [ ] Confirm the whole-Y scenario includes the tracheal segment, saddle, both limb diameters and
      lengths, branch angles, distal orifices, and architecture-specific staged deployment.

## 4. Surveillance recommendations

- [ ] Confirm that surveillance and an exit strategy are part of the initial prescription in each
      case where a stent is considered.
- [ ] Review the statement that the malignant WABIP guideline conditionally suggests surveillance
      bronchoscopy in asymptomatic patients and, absent stronger evidence, an initial examination at
      approximately 4–6 weeks.
- [ ] Confirm that the module explicitly states this is not a universal schedule for every benign
      and malignant case.
- [ ] Confirm that symptom, imaging, bronchoscopic, secretion, position, disease-response, and
      ongoing-indication triggers are framed as context dependent.

## 5. Complication and management statements

- [ ] Confirm that recurrent obstruction includes mucus, granulation, tumor ingrowth or overgrowth,
      migration, malposition or branch obstruction, recurrent external compression, infection,
      fracture, cover failure, and fistula progression or failure to seal.
- [ ] Confirm that granulation is presented as multifactorial: fit/contact/motion,
      secretions/infection, foreign-body and wound-healing biology, dwell time, disease, and host
      factors.
- [ ] Confirm that Ost et al. supports an association—not deterministic causation—between lower
      respiratory infection and later granulation in the studied malignant-airway cohort.
- [ ] Confirm that restoring patency is paired with evaluation of infection and secretions,
      reassessment of fit/position/architecture and ongoing indication, and consideration of
      exchange, repositioning, removal, or another strategy as clinically appropriate.
- [ ] Confirm that the module never presents a debridement modality as a complete response by
      itself.
- [ ] Confirm the cough scene allows diameter-length coupling and axial end excursion only for a
      braided scaffold and does not depict solid silicone as braid-foreshortening.
- [ ] Confirm progressive tissue response is not revealed until end contact,
      secretions/infection, dwell time, and host response have all been considered.
- [ ] Confirm the longitudinal sequence includes mucus obstruction, infection, migration,
      granulation, tumor ingrowth or overgrowth, fracture, cover failure, and branch obstruction.
- [ ] Confirm technical patency, symptoms and quality of life, reintervention burden, and
      underlying-disease outcome remain separate outcome domains.

## 6. Architecture and branded-device descriptions

- [ ] Review all seven architecture families for construction accuracy and neutral language.
- [ ] Confirm that branded examples appear only in sourced engineering details, never as a correct
      clinical answer or product ranking.
- [ ] Verify current manufacturer and FDA source pages before publication.
- [ ] Resolve publication rights, provenance, and manufacturer-validation limitations before any
      branded GLB asset is added to the required clinical path.
- [ ] Confirm unresolved model derivatives remain behind the site-admin asset gate and outside the
      ordinary learner path until those limitations are resolved.
- [ ] If `MODULE_ASSET_ORIGIN` is configured, verify equivalent private-origin or CDN controls;
      the app-origin proxy gate does not authorize a separately public asset URL.
- [ ] Confirm that generic schematics are labeled as educational architecture families rather than
      exact product CAD.

## 7. Regulatory and off-label implications

- [ ] Verify current labeling and instructions for use for every device-specific construction,
      deployment, retrieval, or use statement.
- [ ] Confirm that regulatory documents are used only for construction and labeled-use description,
      not comparative clinical effectiveness.
- [ ] Add explicit review language before any off-label application is discussed.

## 8. Images, physics lenses, and captions

- [ ] Review all six authored physics presets and observation prompts.
- [ ] Confirm that the required lenses do not expose raw displacement controls, force units,
      normalized geometry readouts, COF/RRF vocabulary, or bench values.
- [ ] Confirm that every lens states its clinical question and an evidence boundary.
- [ ] Confirm that curve and cough scenes do not calculate tissue pressure, prove causation, or
      assign an individual risk.
- [ ] Confirm that reduced-motion and text-only learners receive equivalent instructional content.
- [ ] Confirm completion remains possible without WebGL and that each required code-native SVG has
      an equivalent static text description.
- [ ] Confirm that the archived standalone prototype is not presented as the primary curriculum.

## 9. Assessment and analytics

- [ ] Review every correct answer and rationale for indication, architecture, fit, complication,
      surveillance, and changing-anatomy cases.
- [ ] Confirm that no branded product is the sole correct answer.
- [ ] Confirm that assessment totals remain data-driven and the old assessment mastery is not
      carried into progress version 3 from version 1 or version 2.
- [ ] Confirm every missed domain requires rationale review and a defensible revised plan before
      module completion, including a 5/6 attempt that otherwise meets the mastery threshold.
- [ ] Confirm that analytics payloads contain only module, lesson, case, decision, choice, and
      completion identifiers—no free text or patient-identifying information.

## 10. Localization and release state

- [ ] Clinically approve the English source before changing `clinicalReviewStatus` to `reviewed`.
- [ ] Confirm Spanish and Simplified Chinese show an explicit English-fallback review badge until
      their translated clinical review is complete.
- [ ] Confirm the route gate and visible review badge both derive from `clinicalReviewStatus`.
- [ ] Confirm the Board Prep airway-stent chapter links to the localized Clinical Decision Lab and
      remains a concise reference rather than a duplicate course.
- [ ] Confirm the Board Prep bridge is hidden from ordinary users while the lab is draft-gated and
      becomes public from the same `clinicalReviewStatus` release transition.

## Sign-off

- Physician reviewer:
- Review date:
- Evidence review completed:
- Visual/caption review completed:
- Required corrections:
- Approved status (`draft` or `reviewed`):
