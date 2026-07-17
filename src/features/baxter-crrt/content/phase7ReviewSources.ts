import type { SourceReference } from './schema'

const PENDING = 'pending' as const

/**
 * Candidate authoritative sources for Phase 7 reviewer-only content. Inclusion
 * is not approval: every record remains pending and cannot activate a case.
 * Exact scenario numbers and scoring bands must reference a separate
 * SYNTH-CRRT record instead of being presented as guideline thresholds.
 */
const candidateClinicalSources = [
  {
    id: 'GUID-NICE-NG148-2024',
    claim:
      'RRT indications should be discussed promptly when listed complications do not respond to medical management, and the start decision should use the whole clinical condition rather than an isolated value.',
    value:
      'Candidate context for goal definition and escalation reasoning; no simulator threshold is imported.',
    sourceTitle: 'Acute kidney injury: prevention, detection and management',
    sourceType: 'guideline' as const,
    documentVersion: 'NICE NG148 · last updated 16 October 2024',
    pageOrSection:
      'Recommendations 1.5.6–1.5.10 · https://www.nice.org.uk/guidance/ng148/chapter/Recommendations',
    implementationLocation: 'content/phase7ReviewCases.ts · CRRT-01 and CRRT-02',
    reviewer: null,
    reviewStatus: PENDING,
  },
  {
    id: 'GUID-KDIGO-AKI-2012',
    claim:
      'The guideline frames RRT initiation around life-threatening fluid, electrolyte, or acid-base change and broader clinical context, and distinguishes prescribed from delivered dose with ongoing assessment.',
    value:
      'Candidate clinical context only; no local workflow, device behavior, or patient-specific target is supplied.',
    sourceTitle: 'KDIGO Clinical Practice Guideline for Acute Kidney Injury',
    sourceType: 'guideline' as const,
    documentVersion: 'Kidney International Supplements. 2012;2:1–138',
    pageOrSection:
      'Sections 5.1.1, 5.1.2, 5.6.2, 5.8.1, 5.8.2, and 5.8.4 · https://kdigo.org/wp-content/uploads/2016/10/KDIGO-2012-AKI-Guideline-English.pdf',
    implementationLocation:
      'content/phase7ReviewCases.ts · CRRT-01, CRRT-02, CRRT-05, CRRT-06, CRRT-07, CRRT-11, and CRRT-15',
    reviewer: null,
    reviewStatus: PENDING,
  },
  {
    id: 'GUID-RRT-ICU-2026',
    claim:
      'The multidisciplinary guideline describes individualized modality selection, continuous or prolonged therapy for hemodynamic instability, and the gap between prescribed and delivered continuous therapy during interruptions.',
    value:
      'Candidate general guidance; it does not establish the target device configuration, local prescription, or a universal fluid-removal rate.',
    sourceTitle:
      'Multidisciplinary guidelines on renal replacement therapy in intensive care medicine',
    sourceType: 'guideline' as const,
    documentVersion: 'Critical Care. 2026;30:46 · PMID 41535952 · PMCID PMC12849416',
    pageOrSection:
      'Recommendations 2.1, 2.4, 3.2, 3.3, 3.6, and 5.1 · DOI 10.1186/s13054-025-05817-6 · https://link.springer.com/article/10.1186/s13054-025-05817-6',
    implementationLocation:
      'content/phase7ReviewCases.ts · CRRT-01, CRRT-02, CRRT-05, CRRT-06, CRRT-07, CRRT-11, and CRRT-15',
    reviewer: null,
    reviewStatus: PENDING,
  },
  {
    id: 'STARRT-AKI-2020',
    claim:
      'The trial did not establish a mortality benefit for an accelerated initiation strategy over a standard strategy in its enrolled severe-AKI population.',
    value:
      'Debrief context only; trial eligibility and strategies must not become simulator initiation thresholds.',
    sourceTitle: 'Timing of Initiation of Renal-Replacement Therapy in Acute Kidney Injury',
    sourceType: 'peer-reviewed' as const,
    documentVersion: 'N Engl J Med. 2020;383:240–251 · PMID 32668114',
    pageOrSection: 'DOI 10.1056/NEJMoa2000741 · https://pubmed.ncbi.nlm.nih.gov/32668114/',
    implementationLocation: 'content/phase7ReviewCases.ts · CRRT-01 and CRRT-02 debrief',
    reviewer: null,
    reviewStatus: PENDING,
  },
  {
    id: 'REVIEW-CKRT-CORE-2025',
    claim:
      'The review describes diffusion, convection, ultrafiltration, adsorption, and continuous kidney-replacement modality concepts.',
    value:
      'Candidate mechanism source for a non-patient conceptual lab; it supplies no patient-specific prescription or device setting.',
    sourceTitle: 'Continuous Kidney Replacement Therapies: Core Curriculum 2025',
    sourceType: 'peer-reviewed' as const,
    documentVersion: 'Am J Kidney Dis. 2025;85:767–786 · PMID 40072400',
    pageOrSection:
      'DOI 10.1053/j.ajkd.2024.09.015 · https://www.sciencedirect.com/science/article/pii/S027263862401120X · erratum DOI 10.1053/j.ajkd.2025.06.004',
    implementationLocation: 'components/CrrtPhase7InstructionalTools.tsx · Transport Mechanism Lab',
    reviewer: null,
    reviewStatus: PENDING,
  },
] satisfies readonly SourceReference[]

const phase7DeviceSources = [
  {
    id: 'MATH-PM-003',
    claim:
      'PrisMax presents total predilution and filtration-fraction concepts using explicit circuit-flow terms.',
    value:
      'Device-display provenance only; disputed adjacent expressions remain disabled and no preferred clinical split is supplied.',
    sourceTitle: "PrisMax Operator's Manual",
    sourceType: 'device-manual' as const,
    documentVersion: 'AW8035 Rev B JUN2019 · program 2.XX',
    pageOrSection: 'Manual p218 · PDF p219',
    market: 'Market/configuration not established from supplied copy',
    implementationLocation: 'content/phase7ReviewCases.ts · CRRT-05 qualitative split candidate',
    reviewer: null,
    reviewStatus: PENDING,
  },
  {
    id: 'MATH-PM-005',
    claim:
      'PrisMax plasma-flow display arithmetic explicitly depends on blood flow and hematocrit.',
    value:
      'Input-propagation provenance only; this record supplies no patient target, alarm threshold, or connection decision.',
    sourceTitle: "PrisMax Operator's Manual",
    sourceType: 'device-manual' as const,
    documentVersion: 'AW8035 Rev B JUN2019 · program 2.XX',
    pageOrSection: 'Manual pp218–219 · PDF pp219–220',
    market: 'Market/configuration not established from supplied copy',
    implementationLocation: 'content/phase7ReviewCases.ts · CRRT-05 and CRRT-07',
    reviewer: null,
    reviewStatus: PENDING,
  },
  {
    id: 'DEV-PM-010',
    claim:
      'PrisMax presents filter pressure drop as a filter-to-return pressure relationship with a documented display correction.',
    value:
      'Trend-localization provenance only; no alarm threshold, diagnosis, filter-life estimate, or corrective sequence is supplied.',
    sourceTitle: "PrisMax Operator's Manual",
    sourceType: 'device-manual' as const,
    documentVersion: 'AW8035 Rev B JUN2019 · program 2.XX',
    pageOrSection: 'Manual pp201–202 · PDF pp202–203',
    market: 'Market/configuration not established from supplied copy',
    implementationLocation: 'content/phase7ReviewCases.ts · CRRT-15',
    reviewer: null,
    reviewStatus: PENDING,
  },
] satisfies readonly SourceReference[]

const phase7ReviewerRuntimeCaseNumbers = ['01', '02', '05', '06', '07', '11', '15'] as const

const phase7ManifestOnlyCaseNumbers = ['03', '08', '12', '14', '16', '18'] as const

const syntheticReviewerCaseSources = phase7ReviewerRuntimeCaseNumbers.map(
  (caseNumber) =>
    ({
      id: `SYNTH-CRRT-${caseNumber}`,
      claim: `Every exact patient value, flow, timing, event magnitude, condition band, and model coefficient in the CRRT-${caseNumber} reviewer candidate is synthetic teaching calibration.`,
      value:
        'Not a clinical target, normal range, alarm threshold, device limit, or patient-specific recommendation.',
      sourceTitle: 'Baxter CRRT Phase 7 synthetic calibration record',
      sourceType: 'synthetic-calibration' as const,
      documentVersion: 'Phase 7 reviewer draft.1',
      pageOrSection: `CRRT-${caseNumber} authored reviewer fixture`,
      implementationLocation: `content/phase7ReviewCases.ts · CRRT-${caseNumber}`,
      reviewer: null,
      reviewStatus: PENDING,
    }) satisfies SourceReference,
)

const reservedManifestCaseSources = phase7ManifestOnlyCaseNumbers.map(
  (caseNumber) =>
    ({
      id: `SYNTH-CRRT-${caseNumber}`,
      claim: `Reserved synthetic-calibration identity for a possible future CRRT-${caseNumber} reviewer candidate; no runtime fixture or exact scenario values are authored.`,
      value:
        'Manifest-only placeholder. It supplies no clinical target, normal range, alarm threshold, device limit, simulator behavior, or patient-specific recommendation.',
      sourceTitle: 'Baxter CRRT Phase 7 reserved synthetic calibration record',
      sourceType: 'synthetic-calibration' as const,
      documentVersion: 'Phase 7 reviewer draft.1',
      pageOrSection: `CRRT-${caseNumber} manifest-only reserved record`,
      implementationLocation: `content/curriculum.ts · CRRT-${caseNumber} manifest`,
      reviewer: null,
      reviewStatus: PENDING,
    }) satisfies SourceReference,
)

const syntheticRapidDrillSources = [
  {
    id: 'SYNTH-DRILL-AIR-001',
    claim:
      'The air-detection signal, response state, prediction choices, and cause-first review gates are generic synthetic reviewer content.',
    value:
      'Not an alarm name, priority, threshold, detector specification, pump or clamp behavior, air-removal instruction, restart procedure, or patient recommendation.',
    pageOrSection: 'DRILL-AIR reviewer-only preview',
  },
  {
    id: 'SYNTH-DRILL-BLOOD-LEAK-001',
    claim:
      'The blood-leak signal, response state, prediction choices, and cause-first review gates are generic synthetic reviewer content.',
    value:
      'Not an alarm name, priority, threshold, detector specification, discard or blood-return decision, correction sequence, restart procedure, or patient recommendation.',
    pageOrSection: 'DRILL-BLOOD-LEAK reviewer-only preview',
  },
  {
    id: 'SYNTH-DRILL-GAIN-LOSS-001',
    claim:
      'The device-fluid variance signal, prediction choices, and separate-ledger review gates are generic synthetic reviewer content.',
    value:
      'Not an alarm name, priority, threshold, accuracy specification, catch-up behavior, override rule, correction sequence, or whole-patient fluid target.',
    pageOrSection: 'DRILL-GAIN-LOSS reviewer-only preview',
  },
  {
    id: 'SYNTH-DRILL-BAG-SCALE-001',
    claim:
      'The selectable bag/scale signal, topology choices, and cause-first review gates are generic synthetic reviewer content.',
    value:
      'Not an alarm name, priority, threshold, scale assignment, stocked solution or set, bag-change instruction, restart procedure, or patient recommendation.',
    pageOrSection: 'DRILL-BAG-SCALE reviewer-only preview',
  },
  {
    id: 'SYNTH-DRILL-POWER-001',
    claim:
      'The power-interruption signal, paused-delivery state, prediction choices, and cause-first review gates are generic synthetic reviewer content.',
    value:
      'Not an alarm name, priority, battery duration, recovery behavior, continuation instruction, escalation rule, restart procedure, or patient recommendation.',
    pageOrSection: 'DRILL-POWER reviewer-only preview',
  },
].map(
  (record) =>
    ({
      ...record,
      sourceTitle: 'Baxter CRRT Phase 7 rapid-drill synthetic calibration record',
      sourceType: 'synthetic-calibration' as const,
      documentVersion: 'Phase 7 reviewer draft.1',
      implementationLocation: 'content/rapidDrillReview.ts and components/CrrtRapidDrillReview.tsx',
      reviewer: null,
      reviewStatus: PENDING,
    }) satisfies SourceReference,
)

const candidateToolCalibrationSources = [
  {
    id: 'SYNTH-LAB-TRANSPORT-001',
    claim:
      'Every unitless coefficient, starting position, comparison band, and qualitative output in the Transport Mechanism Lab is an authored teaching abstraction.',
    value:
      'Not a clearance estimate, membrane performance specification, clinical target, device output, or patient prediction.',
    sourceTitle: 'Baxter CRRT Phase 7 instructional-tool synthetic calibration record',
    sourceType: 'synthetic-calibration' as const,
    documentVersion: 'Phase 7 reviewer draft.2',
    pageOrSection: 'LAB-TRANSPORT reviewer prototype',
    implementationLocation:
      'instructionalToolsModel.ts and components/CrrtPhase7InstructionalTools.tsx',
    reviewer: null,
    reviewStatus: PENDING,
  },
  {
    id: 'SYNTH-LAB-FLUID-001',
    claim:
      'Every initial rate, duration, and editable example value in the Fluid Balance Ledger is synthetic teaching calibration.',
    value:
      'Not a prescribed removal rate, patient fluid goal, device accuracy claim, or recommendation.',
    sourceTitle: 'Baxter CRRT Phase 7 instructional-tool synthetic calibration record',
    sourceType: 'synthetic-calibration' as const,
    documentVersion: 'Phase 7 reviewer draft.2',
    pageOrSection: 'LAB-FLUID-LEDGER reviewer prototype',
    implementationLocation:
      'instructionalToolsModel.ts and components/CrrtPhase7InstructionalTools.tsx',
    reviewer: null,
    reviewStatus: PENDING,
  },
  {
    id: 'SYNTH-LAB-PRESSURE-001',
    claim:
      'Every baseline resistance, synthetic pressure value, direction classification, and obstruction magnitude in the Pressure Localization Lab is authored teaching calibration.',
    value:
      'Not an alarm threshold, expected patient value, device limit, diagnostic rule, correction sequence, or disconnection model.',
    sourceTitle: 'Baxter CRRT Phase 7 instructional-tool synthetic calibration record',
    sourceType: 'synthetic-calibration' as const,
    documentVersion: 'Phase 7 reviewer draft.2',
    pageOrSection: 'LAB-PRESSURE-LOCALIZATION reviewer prototype',
    implementationLocation:
      'pressureLocalizationLabModel.ts and components/CrrtPressureLocalizationLab.tsx',
    reviewer: null,
    reviewStatus: PENDING,
  },
  {
    id: 'SYNTH-LAB-PRESCRIPTION-001',
    claim:
      'Every initial editable entry and arithmetic example in the Full Prescription Workbench is synthetic teaching calibration.',
    value:
      'Not a prescription default, target, device limit, delivered-clearance estimate, or patient recommendation.',
    sourceTitle: 'Baxter CRRT Phase 7 instructional-tool synthetic calibration record',
    sourceType: 'synthetic-calibration' as const,
    documentVersion: 'Phase 7 reviewer draft.2',
    pageOrSection: 'LAB-PRESCRIPTION reviewer prototype',
    implementationLocation:
      'prescriptionWorkbenchModel.ts and components/CrrtPrescriptionWorkbench.tsx',
    reviewer: null,
    reviewStatus: PENDING,
  },
  {
    id: 'SYNTH-LAB-PREPOST-001',
    claim:
      'Every unitless split index and qualitative comparison label in the pre/post-dilution experiment is an authored teaching proxy.',
    value:
      'Not quantitative filtration fraction, effective clearance, clotting risk, filter-life prediction, or a preferred clinical split.',
    sourceTitle: 'Baxter CRRT Phase 7 instructional-tool synthetic calibration record',
    sourceType: 'synthetic-calibration' as const,
    documentVersion: 'Phase 7 reviewer draft.2',
    pageOrSection: 'LAB-PREPOST-DILUTION reviewer prototype',
    implementationLocation:
      'prescriptionWorkbenchModel.ts and components/CrrtPrescriptionWorkbench.tsx',
    reviewer: null,
    reviewStatus: PENDING,
  },
] satisfies readonly SourceReference[]

export const baxterCrrtPhase7SourceReferences: readonly SourceReference[] = Object.freeze(
  [
    ...candidateClinicalSources,
    ...phase7DeviceSources,
    ...syntheticReviewerCaseSources,
    ...reservedManifestCaseSources,
    ...syntheticRapidDrillSources,
    ...candidateToolCalibrationSources,
  ].map((record) => Object.freeze(record)),
)

if (
  new Set(baxterCrrtPhase7SourceReferences.map((record) => record.id)).size !==
  baxterCrrtPhase7SourceReferences.length
) {
  throw new Error('Phase 7 source-reference IDs must be unique.')
}
