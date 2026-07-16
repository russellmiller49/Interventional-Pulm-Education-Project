import type { BaxterCrrtReviewStatus } from './deviceProfiles'
import type { SourceReference } from './schema'

export interface BaxterCrrtSourceRecord {
  readonly id: string
  readonly evidenceClass: 'device-operator-manual'
  readonly sourceTitle: string
  readonly documentIdentity: string
  readonly pageOrSection: string
  readonly claim: string
  readonly limitation: string
  readonly reviewStatus: BaxterCrrtReviewStatus
}

export interface BaxterCrrtSourceDocument {
  readonly id: 'PRISMAX-AW8035-RB' | 'PRISMAFLEX-G5036003-R05' | 'PRISMAX-NORDICS-2023'
  readonly title: string
  readonly documentIdentity: string
  readonly role: 'primary' | 'deferred' | 'supporting'
  readonly intendedUse: string
  readonly limitation: string
  readonly sourceSha256: string
  readonly reviewStatus: BaxterCrrtReviewStatus
}

interface BaxterCrrtEngineSourceDetail {
  readonly id:
    | 'DEV-PM-009'
    | 'DEV-PM-010'
    | 'DEV-PM-013'
    | 'MATH-PM-001'
    | 'MATH-PM-002'
    | 'MATH-PM-003'
    | 'MATH-PM-004'
    | 'MATH-PM-005'
    | 'MATH-PM-006'
    | 'FLUID-PM-001'
    | 'FLUID-PM-002'
    | 'DOSE-PM-001'
  readonly claim: string
  readonly formulaOrBehavior: string
  readonly unit: string
  readonly sourceDocumentId: BaxterCrrtSourceDocument['id']
  readonly pageOrSection: string
  readonly implementationLocation: string
  readonly reviewer: null
  readonly reviewStatus: 'pending'
  readonly limitation: string
}

export type BaxterCrrtEngineSourceRecord = SourceReference & {
  readonly id: BaxterCrrtEngineSourceDetail['id']
}

const sourceLimitation =
  'This source profile does not establish the software, therapies, disposable sets, accessories, alarm settings, or local practices available on any installed device.'

export const baxterCrrtSourceDocuments: readonly BaxterCrrtSourceDocument[] = Object.freeze([
  {
    id: 'PRISMAX-AW8035-RB',
    title: "PrisMax Operator's Manual",
    documentIdentity: 'AW8035 Rev B JUN2019 · program 2.XX',
    role: 'primary',
    intendedUse: 'Primary device source for the initial PrisMax educational profile.',
    limitation: sourceLimitation,
    sourceSha256: '204543b8c205e535cb9d45c970b8231362839177f3795b6164edcef3b834f1ff',
    reviewStatus: 'pending',
  },
  {
    id: 'PRISMAFLEX-G5036003-R05',
    title: "Prismaflex Operator's Manual",
    documentIdentity: 'G5036003 Revision 05.2011 · program 6.xx',
    role: 'deferred',
    intendedUse: 'Deferred source for the future Prismaflex adapter.',
    limitation:
      'This older, separate device generation is not active in Phase 1 and must not be merged into the PrisMax profile.',
    sourceSha256: '6d311624ec075c86ff539d3a86f3ed77cd2ca467346168ee4985af09f0a9224b',
    reviewStatus: 'pending',
  },
  {
    id: 'PRISMAX-NORDICS-2023',
    title: 'PrisMax Specifications and Features',
    documentIdentity: 'NOR-AT21-230020 · printed August 2023',
    role: 'supporting',
    intendedUse: 'Inactive regional supporting context only.',
    limitation:
      'This Nordic marketing sheet lacks matching software/manual revision and cannot activate any feature in an unmatched release profile.',
    sourceSha256: '3265a60a947617a80628549cde84dc9a9d7e10c50d8a8b56be8acb63317b501d',
    reviewStatus: 'pending',
  },
])

export const baxterCrrtSourceRecords: readonly BaxterCrrtSourceRecord[] = Object.freeze([
  {
    id: 'DEV-PM-001',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "PrisMax Operator's Manual",
    documentIdentity: 'AW8035 Rev B JUN2019 · program 2.XX',
    pageOrSection: 'Front matter · PDF pages 2–3',
    claim:
      'The cited source identifies the document and program-version family used to define this draft educational profile.',
    limitation: sourceLimitation,
    reviewStatus: 'pending',
  },
  {
    id: 'DEV-PM-002',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "PrisMax Operator's Manual",
    documentIdentity: 'AW8035 Rev B JUN2019 · program 2.XX',
    pageOrSection: 'Manual pages 9–11 · PDF pages 10–12',
    claim:
      'The cited manual distinguishes guided Procedure screens from the Operations screen used during therapy.',
    limitation: sourceLimitation,
    reviewStatus: 'pending',
  },
])

export const baxterCrrtEngineSourceDetails: readonly BaxterCrrtEngineSourceDetail[] = Object.freeze(
  [
    {
      id: 'MATH-PM-001',
      claim: 'PrisMax defines the CRRT effluent-pump target as the sum of enabled flow terms.',
      formulaOrBehavior: 'Qeff = Qpfr + Qpbp + Qrep + Qdial + Qsyr + Qmakeup',
      unit: 'mL/h for every term',
      sourceDocumentId: 'PRISMAX-AW8035-RB',
      pageOrSection: 'Manual p217 · PDF p218',
      implementationLocation: 'engine/clinicalMath.ts',
      reviewer: null,
      reviewStatus: 'pending',
      limitation:
        'Enabled terms still depend on the reviewed therapy, set, and local configuration.',
    },
    {
      id: 'MATH-PM-002',
      claim: 'PrisMax calculates displayed TMP from raw filter, return, and effluent pressures.',
      formulaOrBehavior: 'TMP = ((Pfil + Pret) / 2) - Peff - 18',
      unit: 'mmHg',
      sourceDocumentId: 'PRISMAX-AW8035-RB',
      pageOrSection: 'Manual p217 · PDF p218',
      implementationLocation: 'engine/pressureModel.ts',
      reviewer: null,
      reviewStatus: 'pending',
      limitation: 'Device-display calculation only; it is not a universal alarm or clinical limit.',
    },
    {
      id: 'DEV-PM-010',
      claim:
        'PrisMax filter pressure drop uses filter minus return pressure with one display offset.',
      formulaOrBehavior: 'raw delta P = Pfil - Pret; displayed delta P = raw delta P - 25',
      unit: 'mmHg',
      sourceDocumentId: 'PRISMAX-AW8035-RB',
      pageOrSection: 'Manual pp201–202 · PDF pp202–203',
      implementationLocation: 'engine/pressureModel.ts',
      reviewer: null,
      reviewStatus: 'pending',
      limitation: 'Raw and displayed values remain separate to prevent double correction.',
    },
    {
      id: 'MATH-PM-003',
      claim: 'PrisMax defines total-predilution and FF display expressions.',
      formulaOrBehavior: 'Formula functions require an explicit Qpre input.',
      unit: 'fraction or percent',
      sourceDocumentId: 'PRISMAX-AW8035-RB',
      pageOrSection: 'Manual p218 · PDF p219',
      implementationLocation: 'engine/clinicalMath.ts',
      reviewer: null,
      reviewStatus: 'pending',
      limitation: 'The engine does not derive Qpre while CONFLICT-002 remains unresolved.',
    },
    {
      id: 'MATH-PM-004',
      claim: 'The printed post-filter ultrafiltration expression remains disabled.',
      formulaOrBehavior: 'CONFLICT-001 gate enabled = false',
      unit: 'mL/h expression; inactive',
      sourceDocumentId: 'PRISMAX-AW8035-RB',
      pageOrSection: 'Manual p218 · PDF p219',
      implementationLocation: 'engine/clinicalMath.ts',
      reviewer: null,
      reviewStatus: 'pending',
      limitation:
        'The printed sign conflicts with the adjacent filtration-fraction numerator and is not executed.',
    },
    {
      id: 'MATH-PM-005',
      claim: 'Plasma flow depends on blood flow and hematocrit.',
      formulaOrBehavior: 'Qplasma = (1 - Hct fraction) × Qb',
      unit: 'mL/h after explicit blood-flow conversion',
      sourceDocumentId: 'PRISMAX-AW8035-RB',
      pageOrSection: 'Manual pp218–219 · PDF pp219–220',
      implementationLocation: 'engine/clinicalMath.ts',
      reviewer: null,
      reviewStatus: 'pending',
      limitation: 'Plasma-water naming and the 0.95 display convention remain device-specific.',
    },
    {
      id: 'MATH-PM-006',
      claim: 'The printed pre-infusion expression remains disabled.',
      formulaOrBehavior: 'CONFLICT-002 gate enabled = false',
      unit: 'mL/h expression; inactive',
      sourceDocumentId: 'PRISMAX-AW8035-RB',
      pageOrSection: 'Manual p220 · PDF p221',
      implementationLocation: 'engine/clinicalMath.ts',
      reviewer: null,
      reviewStatus: 'pending',
      limitation:
        'The expression is visually and dimensionally ambiguous and is not used to derive Qpre.',
    },
    {
      id: 'FLUID-PM-001',
      claim: 'Machine PFR and whole-patient fluid balance are different quantities.',
      formulaOrBehavior: 'External inputs and outputs are integrated separately from machine PFR.',
      unit: 'mL and mL/h',
      sourceDocumentId: 'PRISMAX-AW8035-RB',
      pageOrSection: 'Manual p219 · PDF p220',
      implementationLocation: 'engine/fluidModel.ts',
      reviewer: null,
      reviewStatus: 'pending',
      limitation: 'No prescription or tolerance target is supplied by this device statement.',
    },
    {
      id: 'FLUID-PM-002',
      claim: 'PrisMax derives machine patient-fluid-removed volume from measured circuit volumes.',
      formulaOrBehavior: 'Vpfr = Veff - Vpbp - Vdial - Vrep - Vsyr',
      unit: 'mL',
      sourceDocumentId: 'PRISMAX-AW8035-RB',
      pageOrSection: 'Manual p219 · PDF p220',
      implementationLocation: 'engine/clinicalMath.ts',
      reviewer: null,
      reviewStatus: 'pending',
      limitation: 'The result excludes external patient inputs and outputs.',
    },
    {
      id: 'DOSE-PM-001',
      claim: 'PrisMax displays an effluent rate normalized by body weight.',
      formulaOrBehavior: 'DCRRT-eff = Qeff / BW',
      unit: 'mL/kg/h',
      sourceDocumentId: 'PRISMAX-AW8035-RB',
      pageOrSection: 'Manual pp219–220 · PDF pp220–221',
      implementationLocation: 'engine/clinicalMath.ts',
      reviewer: null,
      reviewStatus: 'pending',
      limitation: 'No clinical target range is implemented.',
    },
    {
      id: 'DEV-PM-009',
      claim: 'Circuit pressures depend on flow and resistance rather than universal normal values.',
      formulaOrBehavior: 'Caller-parametric monotonic pressure model',
      unit: 'mmHg with resistance in mmHg per (mL/min)',
      sourceDocumentId: 'PRISMAX-AW8035-RB',
      pageOrSection: 'Manual pp197–204 · PDF pp198–205',
      implementationLocation: 'engine/pressureModel.ts',
      reviewer: null,
      reviewStatus: 'pending',
      limitation:
        'The engine contains no built-in baseline, resistance coefficient, or alarm limit.',
    },
    {
      id: 'DEV-PM-013',
      claim: 'PrisMax fluid management uses pumps, scales, and measured bag changes.',
      formulaOrBehavior: 'Integrate actual source-bag depletion and effluent-bag filling.',
      unit: 'mL and mL/h',
      sourceDocumentId: 'PRISMAX-AW8035-RB',
      pageOrSection: 'Manual pp241–244 · PDF pp242–245',
      implementationLocation: 'engine/fluidModel.ts',
      reviewer: null,
      reviewStatus: 'pending',
      limitation:
        'No default bag size, weight-to-volume conversion, or device stop threshold is assumed.',
    },
  ],
)

export const baxterCrrtEngineSourceRecords: readonly BaxterCrrtEngineSourceRecord[] = Object.freeze(
  baxterCrrtEngineSourceDetails.map((detail) =>
    Object.freeze({
      id: detail.id,
      claim: detail.claim,
      value: detail.formulaOrBehavior,
      unit: detail.unit,
      sourceTitle: "PrisMax Operator's Manual",
      sourceType: 'device-manual' as const,
      documentVersion: 'AW8035 Rev B JUN2019 · program 2.XX',
      pageOrSection: detail.pageOrSection,
      market: 'Market/configuration not established from supplied copy',
      implementationLocation: detail.implementationLocation,
      reviewer: detail.reviewer,
      reviewStatus: detail.reviewStatus,
    }),
  ),
)
