import type { McsSource } from '../engine/types'

export const mcsSources: readonly McsSource[] = [
  {
    id: 'master-hemodynamics-reference',
    title: 'Master Hemodynamics and Hemodynamic Monitoring Reference',
    citation: 'User-supplied educational reference package, pp. 39–41.',
    sourceType: 'reference-package',
    year: 2026,
    suppliedFilename: 'Master_Hemodynamics_and_Hemodynamic_Monitoring_Reference.docx',
    intendedUse:
      'Temporary MCS mechanisms, IABP timing, Impella unloading, device comparison, and response/warning patterns.',
    limitation: 'Durable LVAD operations require separate current guidance and labeling.',
  },
  {
    id: 'ishlt-hfsa-acute-mcs-2023',
    title: 'ISHLT/HFSA Guideline on Acute Mechanical Circulatory Support',
    citation: 'Bernhardt AM, et al. J Heart Lung Transplant. 2023;42(4):e1–e64.',
    sourceType: 'guideline',
    year: 2023,
    url: 'https://www.ishlt.org/education-and-publications/standards-guidelines-detail/the-ishlt-hfsa-guideline-on-acute-mechanical-circulatory-support',
    intendedUse: 'Acute MCS selection framework, monitoring, complications, and team-based care.',
  },
  {
    id: 'ishlt-durable-mcs-2023',
    title: '2023 ISHLT Guidelines for Mechanical Circulatory Support',
    citation: 'Saeed D, et al. J Heart Lung Transplant. 2023;42(7):e1–e222.',
    sourceType: 'guideline',
    year: 2023,
    url: 'https://www.ishlt.org/education-and-publications/standards-guidelines-detail/the-2023-ishlt-guidelines-for-mechanical-circulatory-support-a-10--year-update',
    intendedUse:
      'Inpatient durable MCS assessment, complications, and multidisciplinary management.',
  },
  {
    id: 'getinge-iabp-current',
    title: 'Getinge IABP product information and update center',
    citation: 'Getinge. Current US IAB/IABP reference materials and field updates.',
    sourceType: 'manufacturer',
    year: 2026,
    url: 'https://www.getinge.com/us/products-and-solutions/cardiovascular-procedures/iabp-counterpulsation/iabp-information/',
    intendedUse:
      'Counterpulsation controls, trigger/timing concepts, operational cautions, and update checks.',
    limitation:
      'The module does not reproduce a branded console or replace operating instructions.',
  },
  {
    id: 'getinge-iabp-placement-training',
    title: 'Introduction to IABP Therapy',
    citation: 'Getinge. Introduction to IABP Therapy, MCA00002810 Rev B / MCV00111547 Rev A.',
    sourceType: 'manufacturer',
    year: 2024,
    url: 'https://getinge.training/a/media/file/193610/attachment/?rnd=1653495882',
    intendedUse:
      'Visual placement check: balloon in the descending thoracic aorta, cranial tip distal to the left subclavian artery, and caudal end above the renal arteries.',
    limitation:
      'Manufacturer education does not replace the current catheter IFU or local imaging confirmation.',
  },
  {
    id: 'fda-impella-cp-labeling',
    title: 'Impella ventricular support systems labeling',
    citation: 'FDA PMA P140003 labeling and current supplements for Impella CP with SmartAssist.',
    sourceType: 'fda-labeling',
    year: 2026,
    url: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpma/pma.cfm?id=p140003',
    intendedUse:
      'Performance-level framing, placement signals, suction, purge, and safety boundaries.',
    limitation:
      'Exact software behavior must be rechecked against the current local device revision.',
  },
  {
    id: 'fda-impella-rp-labeling',
    title: 'Impella RP System Instructions for Use',
    citation: 'FDA-approved Impella RP labeling and current PMA supplement materials.',
    sourceType: 'fda-labeling',
    year: 2026,
    url: 'https://www.fda.gov/media/138463/download',
    intendedUse:
      'Anatomy-only confirmation of venous inflow and pulmonary-artery outflow for the RP comparison model.',
    limitation:
      'The module does not model RP controls, insertion, sizing, or RV-support physiology.',
  },
  {
    id: 'fda-impella-cp-2026-recall',
    title: 'Impella CP with SmartAssist affected-unit removal',
    citation: 'FDA Class I recall communication, updated July 2, 2026.',
    sourceType: 'fda-safety-notice',
    year: 2026,
    url: 'https://www.fda.gov/medical-devices/medical-device-recalls-and-early-alerts/heart-pump-recall-abiomed-removes-impella-cp-sets-smartassist',
    intendedUse:
      'Flags the affected-unit low-purge-pressure safety issue for content-freeze and prepublication reconciliation.',
    limitation:
      'Applies to identified product codes and serial numbers; facilities must use the current FDA/manufacturer notice and local process.',
  },
  {
    id: 'fda-impella-controller-2025-recall',
    title: 'Automated Impella Controller cybersecurity correction',
    citation: 'FDA Class I correction communication, current October 10, 2025.',
    sourceType: 'fda-safety-notice',
    year: 2025,
    url: 'https://www.fda.gov/medical-devices/medical-device-recalls-and-early-alerts/alert-automated-impella-controller-correction-due-cybersecurity-issue-abiomed',
    intendedUse:
      'Flags controller revision and network-mitigation review before content publication.',
    limitation:
      'This module has no networked device-controller behavior and does not reproduce mitigation instructions.',
  },
  {
    id: 'fda-heartmate3-ifu',
    title: 'HeartMate 3 Left Ventricular Assist System Instructions for Use',
    citation: 'FDA PMA P160054/S008 labeling, document 100168999.A (October 2018).',
    sourceType: 'fda-labeling',
    year: 2026,
    url: 'https://www.accessdata.fda.gov/cdrh_docs/pdf16/P160054S008D.pdf',
    intendedUse:
      'Apical inflow/ascending-aortic outflow anatomy plus controller parameters, authorized settings, alarms, power, and safety framing.',
    limitation:
      'Speed changes are represented only as an explicitly authorized educational exercise.',
  },
  {
    id: 'fda-heartmate3-pma-current',
    title: 'HeartMate 3 PMA supplement index',
    citation: 'FDA PMA P160054 supplement index, reviewed July 19, 2026.',
    sourceType: 'fda-labeling',
    year: 2026,
    url: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpma/pma.cfm?ID=P160054',
    intendedUse:
      'Requires the preview to reconcile its S008 teaching anchor with the current supplement and local IFU set.',
    limitation:
      'The index is not a substitute for the current approved labeling supplied with the local system.',
  },
  {
    id: 'fda-heartmate-mpu-2025-recall',
    title: 'HeartMate Mobile Power Unit sudden-power-loss removal',
    citation: 'FDA Class I recall communication, current April 24, 2025.',
    sourceType: 'fda-safety-notice',
    year: 2025,
    url: 'https://www.fda.gov/medical-devices/medical-device-recalls-and-early-alerts/heart-pump-accessory-removal-abbott-removes-heartmate-mobile-power-unit-due-instances-sudden-power',
    intendedUse: 'Flags external-power and backup-power content for current affected-unit review.',
    limitation:
      'Affected serial numbers and actions must be obtained from the current notice and local LVAD program.',
  },
  {
    id: 'fda-heartmate-power-cord-2025-recall',
    title: 'HeartMate Mobile Power Unit AC power-cord removal',
    citation: 'FDA Class I recall communication, current August 29, 2025.',
    sourceType: 'fda-safety-notice',
    year: 2025,
    url: 'https://www.fda.gov/medical-devices/medical-device-recalls-and-early-alerts/mobile-power-unit-ac-power-cord-recall-abbott-medical-removes-ac-power-cord-associated-heartmate',
    intendedUse:
      'Flags power-path interpretation and affected-lot reconciliation before publication.',
    limitation:
      'The simulator teaches diagnosis only and does not reproduce device-specific emergency procedures.',
  },
  {
    id: 'mcs-educational-model-v1',
    title: 'MCS ICU Lab deterministic educational model',
    citation: 'Original 50 Hz compartment and device-effect model for this module.',
    sourceType: 'educational-model',
    year: 2026,
    intendedUse:
      'Links device settings and patient loading conditions to coherent directional trends.',
    limitation:
      'Not a validated digital twin, clinical device, dosing model, or patient predictor.',
  },
] as const

export const mcsSourceById = new Map(mcsSources.map((source) => [source.id, source]))
