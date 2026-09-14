import type { SourceReference } from './schema'

/**
 * Publication support is not faculty/protocol approval. Source type, publication year and the
 * 2026-09-13 passage-reading date are kept apart in `sourceReviewMetadata.ts`.
 */
const pending = 'pending' as const
const context =
  'Critically ill adults receiving RRT with regional citrate anticoagulation. Conceptual physiology only; no device behavior, dosing, schedule or local protocol authorization.'
const pistolesi = {
  sourceTitle: 'Regional citrate anticoagulation: SIAARTI-SIN joint commission expert opinion',
  sourceType: 'peer-reviewed' as const,
  documentVersion: 'Pistolesi et al. J Anesth Analg Crit Care. 2023;3:7 · PMID 37386664',
}
const schneider = {
  sourceTitle: 'Complications of regional citrate anticoagulation: accumulation or overload?',
  sourceType: 'peer-reviewed' as const,
  documentVersion: 'Schneider, Journois and Rimmelé. Critical Care. 2017;21:281',
}
export const crrtCitrateSourceReferences: readonly SourceReference[] = [
  {
    ...pistolesi,
    id: 'CITRATE-SIAARTI-2023-MECHANISM',
    claim:
      'Citrate chelates ionized calcium for circuit anticoagulation; some citrate-calcium complexes are removed in effluent by diffusion/convection.',
    pageOrSection:
      'Section 1, Rationale, paragraph beginning “During RCA”; Section 2 modality context · https://doi.org/10.1186/s44158-023-00091-w',
  },
  {
    ...pistolesi,
    id: 'CITRATE-SIAARTI-2023-SAMPLING',
    claim:
      'Post-filter ionized calcium informs circuit effect; systemic ionized calcium informs patient calcium support. Calcium loss requires supplementation.',
    pageOrSection:
      'Section 4, Rationale, monitoring discussion after the accumulation triad; Section 5, Rationale, calcium mass balance · https://doi.org/10.1186/s44158-023-00091-w',
  },
  {
    ...schneider,
    id: 'CITRATE-SCHNEIDER-2017-METABOLISM',
    claim:
      'Calcium infusion sites vary with protocol. Unremoved citrate-calcium complexes return systemically; metabolism in liver, muscle and kidney releases calcium. Acid-base effect depends on metabolism and overall solution/ion balance.',
    pageOrSection:
      'General principles: Principles of citrate anticoagulation (calcium infusion sites); Citrate clearance and metabolism; Citrate and acid-base balance · https://doi.org/10.1186/s13054-017-1880-1',
  },
  {
    ...schneider,
    id: 'CITRATE-SCHNEIDER-2017-PATTERNS',
    claim:
      'Accumulation and net citrate overload differ: impaired metabolism with calcium-complex retention versus preserved metabolism with excessive net alkali load. Insufficient systemic buffer delivery is a separate concept.',
    pageOrSection:
      'Citrate accumulation and alternative diagnoses: Citrate accumulation, Net citrate overload, Insufficient trisodium-citrate delivery; Table 1 · https://doi.org/10.1186/s13054-017-1880-1',
  },
  {
    id: 'CITRATE-ICU-GUIDE-2026-SAFETY',
    claim:
      'RCA monitoring considers linked calcium and acid-base trends. Accumulation may accompany increasing calcium requirements, total/ionized calcium ratio and acidosis; progressive lactic acidosis warrants particular caution.',
    sourceTitle:
      'Multidisciplinary guidelines on renal replacement therapy in intensive care medicine',
    sourceType: 'guideline' as const,
    documentVersion: 'Critical Care. 2026;30:46 · PMID 41535952',
    pageOrSection:
      'Section 4 recommendations 4.4–4.6; Adverse events in RCA; RCA in liver failure · https://doi.org/10.1186/s13054-025-05817-6',
  },
].map((source) =>
  Object.freeze({
    ...source,
    value: context,
    implementationLocation:
      'content/circuitModel.ts, content/citrateDifferential.ts, content/advancedLessons.ts',
    reviewer: null,
    reviewStatus: pending,
  }),
)
