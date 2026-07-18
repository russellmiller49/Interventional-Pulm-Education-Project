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

export interface PrismaflexSourceConflictRecord {
  readonly id: 'CONFLICT-010'
  readonly sourceRecordIds: readonly ['DEV-PF-006']
  readonly pageOrSection: string
  readonly observation: string
  readonly requiredDisposition: string
  readonly status: 'unresolved-contextual-definition-conflict'
  readonly reviewStatus: 'pending'
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
    role: 'supporting',
    intendedUse: 'Primary source for the Prismaflex manual-reference educational adapter.',
    limitation:
      'This older, separate device generation is learner-active through its own adapter and must not be merged into the PrisMax profile.',
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
  {
    id: 'DEV-PM-003',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "PrisMax Operator's Manual",
    documentIdentity: 'AW8035 Rev B JUN2019 · program 2.XX',
    pageOrSection: 'Manual page 11 · PDF page 12',
    claim:
      'The Operations screen separates the flow path, pressure/status measurements, treatment status, and recent message center.',
    limitation:
      'Orientation leaves pressure and dose signals blank; cases supply only synthetic educational engine signals.',
    reviewStatus: 'pending',
  },
  {
    id: 'DEV-PM-005',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "PrisMax Operator's Manual",
    documentIdentity: 'AW8035 Rev B JUN2019 · program 2.XX',
    pageOrSection: 'Manual pages 39–64 · PDF pages 40–65',
    claim:
      'The new-patient setup sequence proceeds through Patient, Therapy, Prescription, Sets, Fluids, Prime, Review, and Connect Patient.',
    limitation:
      'Orientation verifies interface order only; CRRT-04 connects a synthetic model after the gated sequence and does not select a commercial set or run a real prime.',
    reviewStatus: 'pending',
  },
  {
    id: 'DEV-PM-006',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "PrisMax Operator's Manual",
    documentIdentity: 'AW8035 Rev B JUN2019 · program 2.XX',
    pageOrSection: 'Manual pages 65–90 · PDF pages 66–91',
    claim:
      'Therapy operation includes flow review, bag and syringe change concepts, and a stop/end workflow.',
    limitation:
      'Commercial bag-change execution, return-blood disposition, recirculation, and local-policy decisions are not inferred.',
    reviewStatus: 'pending',
  },
  {
    id: 'DEV-PM-007',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "PrisMax Operator's Manual",
    documentIdentity: 'AW8035 Rev B JUN2019 · program 2.XX',
    pageOrSection: 'Manual pages 93–100 · PDF pages 94–101',
    claim:
      'PrisMax uses an alarm window and priority presentation distinct from the deferred Prismaflex adapter.',
    limitation:
      'Generic engine alerts may appear, but exact device alarm names, priorities, thresholds, reactions, and correction steps remain unmapped.',
    reviewStatus: 'pending',
  },
  {
    id: 'DEV-PM-008',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "PrisMax Operator's Manual",
    documentIdentity: 'AW8035 Rev B JUN2019 · program 2.XX',
    pageOrSection: 'Manual pages 101–169 · PDF pages 102–170',
    claim:
      'The cited manual contains device alarm tables and troubleshooting information that can be mapped to curriculum alarm families during device review.',
    limitation:
      'No alarm priority, threshold, pump or clamp consequence, correction sequence, escalation rule, or scoring consequence is activated from this broad source range.',
    reviewStatus: 'pending',
  },
  {
    id: 'DEV-PM-011',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "PrisMax Operator's Manual",
    documentIdentity: 'AW8035 Rev B JUN2019 · program 2.XX',
    pageOrSection: 'Manual pages 206–212 · PDF pages 207–213',
    claim:
      'The cited source describes distinct CRRT flow paths, including the CVVHD topology used by the educational interface.',
    limitation:
      'The interface does not establish clinical eligibility or installed-device availability; other modalities use the shared adapter rather than this CVVHD case surface.',
    reviewStatus: 'pending',
  },
  {
    id: 'DEV-PM-012',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "PrisMax Operator's Manual",
    documentIdentity: 'AW8035 Rev B JUN2019 · program 2.XX',
    pageOrSection: 'Manual pages 215–217 · PDF pages 216–218',
    claim:
      'The cited manual distinguishes prescribed patient-fluid-removal behavior from device gain/loss and catch-up concepts.',
    limitation:
      'This record does not establish a clinical fluid goal, acceptable variance, catch-up response, escalation threshold, or local configuration.',
    reviewStatus: 'pending',
  },
  {
    id: 'DEV-PM-014',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "PrisMax Operator's Manual",
    documentIdentity: 'AW8035 Rev B JUN2019 · program 2.XX',
    pageOrSection: 'Manual pages 252–262 · PDF pages 253–263',
    claim:
      'The device layout identifies pumps, pressure sites, detectors, clamp, and four color-and-shape-coded scale positions.',
    limitation:
      'The learner surface uses original schematic artwork and does not copy a manual figure, product photograph, or manufacturer logo.',
    reviewStatus: 'pending',
  },
  {
    id: 'DEV-PF-001',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "Prismaflex Operator's Manual",
    documentIdentity: 'G5036003 Revision 05.2011 · program 6.xx',
    pageOrSection: 'Title and front matter · PDF page 1',
    claim:
      'The supplied manual identifies Gambro Lundia AB as manufacturer and defines the G5036003 Revision 05.2011, program 6.xx source family.',
    limitation:
      'The source identity does not establish the market, installed software build, enabled therapies, disposable sets, accessories, or local configuration of a target device.',
    reviewStatus: 'pending',
  },
  {
    id: 'DEV-PF-002',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "Prismaflex Operator's Manual",
    documentIdentity: 'G5036003 Revision 05.2011 · program 6.xx',
    pageOrSection: 'Manual sections 4:2–4:16 · PDF pages 62–76',
    claim:
      'Prismaflex uses context-dependent touch-screen softkeys, arrow controls, and a device-specific Setup, Standby, Run, and End workflow.',
    limitation:
      'The setup sequence is a manual-reference educational representation; no protected screen artwork or exact local workflow is claimed.',
    reviewStatus: 'pending',
  },
  {
    id: 'DEV-PF-003',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "Prismaflex Operator's Manual",
    documentIdentity: 'G5036003 Revision 05.2011 · program 6.xx',
    pageOrSection: 'Manual sections 3:8–3:11 · PDF pages 52–55',
    claim:
      'The source describes four occlusive peristaltic fluid pumps and four scales whose functions depend on the selected therapy.',
    limitation:
      'No therapy/set-specific local pump assignment, commercial bag identity, capacity, or local scale threshold is inferred.',
    reviewStatus: 'pending',
  },
  {
    id: 'DEV-PF-004',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "Prismaflex Operator's Manual",
    documentIdentity: 'G5036003 Revision 05.2011 · program 6.xx',
    pageOrSection: 'Manual sections 3:5–3:7 · PDF pages 49–51',
    claim:
      'Prismaflex establishes pressure operating points after flow stabilizes and re-establishes them after documented flow, restart, continuation, and self-test events.',
    limitation:
      'No operating point, trending limit, alarm threshold, automatic reaction, or unsupported disconnection response is inferred by the adapter.',
    reviewStatus: 'pending',
  },
  {
    id: 'DEV-PF-005',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "Prismaflex Operator's Manual",
    documentIdentity: 'G5036003 Revision 05.2011 · program 6.xx',
    pageOrSection: 'Manual section 3:7 · PDF page 51',
    claim:
      'Prismaflex defines raw filter pressure drop as filter pressure minus return pressure and displays a hydrostatically corrected value with a −25 mmHg correction.',
    limitation:
      'This is a device-display calculation only; it is not a universal normal, alarm limit, or clinical target.',
    reviewStatus: 'pending',
  },
  {
    id: 'DEV-PF-006',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "Prismaflex Operator's Manual",
    documentIdentity: 'G5036003 Revision 05.2011 · program 6.xx',
    pageOrSection: 'Manual sections 5:3–5:19 · PDF pages 97–113',
    claim:
      'The Prismaflex CRRT section defines device-generation-specific flow paths, effluent-pump control, TMP, predilution, filtration fraction, patient-fluid removal, and dose concepts.',
    limitation:
      'The pump-control and dose sections print different Qeff expressions; they remain separate under CONFLICT-010, and no set-specific range, clinical target, or cross-device equivalence claim is supplied.',
    reviewStatus: 'pending',
  },
  {
    id: 'DEV-PF-007',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "Prismaflex Operator's Manual",
    documentIdentity: 'G5036003 Revision 05.2011 · program 6.xx',
    pageOrSection: 'Manual sections 10:2–10:7 · PDF pages 166–171',
    claim:
      'Prismaflex defines the device-specific alarm categories Warning, Malfunction, Caution, and Advisory.',
    limitation:
      'The adapter does not invent a category, label, priority, stopped-pump reaction, clamp response, correction sequence, clearing rule, or escalation consequence for an unmapped engine alarm.',
    reviewStatus: 'pending',
  },
  {
    id: 'DEV-PF-008',
    evidenceClass: 'device-operator-manual',
    sourceTitle: "Prismaflex Operator's Manual",
    documentIdentity: 'G5036003 Revision 05.2011 · program 6.xx',
    pageOrSection: 'Manual sections 13:3–13:11 · PDF pages 265–273',
    claim:
      'The manual specifications show that flow, scale, and pressure characteristics depend on device, therapy, disposable set, and configuration.',
    limitation:
      'No numeric range, increment, tolerance, bag limit, alarm threshold, or compatibility value is copied into the profile before exact target-configuration review.',
    reviewStatus: 'pending',
  },
])

export const prismaflexSourceConflictRecords: readonly PrismaflexSourceConflictRecord[] =
  Object.freeze([
    Object.freeze({
      id: 'CONFLICT-010',
      sourceRecordIds: Object.freeze(['DEV-PF-006'] as const),
      pageOrSection: 'Manual p5:12 / PDF p106 and manual p5:19 / PDF p113',
      observation:
        'The CRRT effluent-pump equation includes syringe flow, while the later CRRT dose-section Qeff equation omits syringe flow.',
      requiredDisposition:
        'Keep pump-target Qeff and dose-section Qeff as separately named calculations; do not substitute one for the other or claim that the supplied manual resolves the difference.',
      status: 'unresolved-contextual-definition-conflict',
      reviewStatus: 'pending',
    }),
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

/**
 * SourceReference records used by the original case templates. Clinical
 * publications provide teaching context only. Every exact case value and model
 * coefficient is attributed to a separate synthetic-calibration record.
 */
export const baxterCrrtPilotSourceReferences: readonly SourceReference[] = Object.freeze(
  [
    {
      id: 'DEV-PM-005',
      claim:
        'The PrisMax new-patient workflow orders Patient, Therapy, Prescription, Sets, Fluids, Prime, Review, and Connect Patient before treatment operation.',
      value: 'Device workflow only; no clinical prescription target is supplied.',
      sourceTitle: "PrisMax Operator's Manual",
      sourceType: 'device-manual' as const,
      documentVersion: 'AW8035 Rev B JUN2019 · program 2.XX',
      pageOrSection: 'Manual pp39–64 · PDF pp40–65',
      market: 'Market/configuration not established from supplied copy',
      implementationLocation: 'content/pilotCases.ts',
      reviewer: null,
      reviewStatus: 'pending' as const,
    },
    {
      id: 'MATH-PM-001',
      claim:
        'PrisMax describes its CRRT effluent-pump target as the sum of the profile-enabled patient-removal and circuit-fluid flow terms.',
      value: 'Qeff = Qpfr + Qpbp + Qrep + Qdial + Qsyr + Qmakeup',
      unit: 'mL/h for every term',
      sourceTitle: "PrisMax Operator's Manual",
      sourceType: 'device-manual' as const,
      documentVersion: 'AW8035 Rev B JUN2019 · program 2.XX',
      pageOrSection: 'Manual p217 · PDF p218',
      market: 'Market/configuration not established from supplied copy',
      implementationLocation: 'engine/clinicalMath.ts and content/pilotCases.ts',
      reviewer: null,
      reviewStatus: 'pending' as const,
    },
    {
      id: 'DOSE-PM-001',
      claim: 'PrisMax displays an effluent-rate concept normalized by patient body weight.',
      value: 'DCRRT-eff = Qeff / BW; no clinical target range is supplied by this record.',
      unit: 'mL/kg/h',
      sourceTitle: "PrisMax Operator's Manual",
      sourceType: 'device-manual' as const,
      documentVersion: 'AW8035 Rev B JUN2019 · program 2.XX',
      pageOrSection: 'Manual pp219–220 · PDF pp220–221',
      market: 'Market/configuration not established from supplied copy',
      implementationLocation: 'engine/clinicalMath.ts and content/pilotCases.ts',
      reviewer: null,
      reviewStatus: 'pending' as const,
    },
    {
      id: 'FLUID-PM-001',
      claim:
        'Machine patient-fluid removal excludes external patient inputs and outputs, so it is distinct from whole-patient fluid balance.',
      value: 'Device distinction only; it does not prescribe a removal rate.',
      sourceTitle: "PrisMax Operator's Manual",
      sourceType: 'device-manual' as const,
      documentVersion: 'AW8035 Rev B JUN2019 · program 2.XX',
      pageOrSection: 'Manual p219 · PDF p220',
      market: 'Market/configuration not established from supplied copy',
      implementationLocation: 'engine/fluidModel.ts and content/pilotCases.ts',
      reviewer: null,
      reviewStatus: 'pending' as const,
    },
    {
      id: 'DEV-PM-009',
      claim:
        'Access, filter, and return pressure behavior depends on flow, resistance, and the device operating point rather than a universal normal value.',
      value: 'Directional model context only; no alarm threshold or clinical normal is supplied.',
      sourceTitle: "PrisMax Operator's Manual",
      sourceType: 'device-manual' as const,
      documentVersion: 'AW8035 Rev B JUN2019 · program 2.XX',
      pageOrSection: 'Manual pp197–204 · PDF pp198–205',
      market: 'Market/configuration not established from supplied copy',
      implementationLocation: 'engine/pressureModel.ts and content/pilotCases.ts',
      reviewer: null,
      reviewStatus: 'pending' as const,
    },
    {
      id: 'DEV-PM-013',
      claim: 'PrisMax fluid management uses pumps, scales, and measured bag changes.',
      value: 'No default bag size, stop threshold, or local configuration is inferred.',
      sourceTitle: "PrisMax Operator's Manual",
      sourceType: 'device-manual' as const,
      documentVersion: 'AW8035 Rev B JUN2019 · program 2.XX',
      pageOrSection: 'Manual pp241–244 · PDF pp242–245',
      market: 'Market/configuration not established from supplied copy',
      implementationLocation: 'engine/fluidModel.ts and content/pilotCases.ts',
      reviewer: null,
      reviewStatus: 'pending' as const,
    },
    {
      id: 'RENAL-2009',
      claim:
        'The RENAL trial compared weight-normalized CRRT effluent intensities and found no 90-day mortality benefit from the higher-intensity strategy.',
      value:
        'Research context for prescribed-versus-delivered and weight-normalized intensity; not a patient-specific target or case success threshold.',
      sourceTitle: 'Intensity of Continuous Renal-Replacement Therapy in Critically Ill Patients',
      sourceType: 'peer-reviewed' as const,
      documentVersion: 'N Engl J Med. 2009;361:1627–1638',
      pageOrSection: 'DOI 10.1056/NEJMoa0902413',
      implementationLocation: 'content/pilotCases.ts · CRRT-04',
      reviewer: null,
      reviewStatus: 'pending' as const,
    },
    {
      id: 'WHITE-2024',
      claim:
        'Observed whole-patient fluid balance during CRRT included material contributions from net ultrafiltration, residual urine, crystalloid administration, and nutrition.',
      value:
        'Observational context for separating machine removal from all patient inputs and outputs; published cohort values are not copied into the synthetic case.',
      sourceTitle:
        'Current Fluid Management Practice in Critically Ill Adults on Continuous Renal Replacement Therapy: A Binational, Observational Study',
      sourceType: 'peer-reviewed' as const,
      documentVersion: 'Blood Purif. 2024;53:624–633 · PMID 38626729',
      pageOrSection: 'DOI 10.1159/000538421',
      implementationLocation: 'content/pilotCases.ts · CRRT-10',
      reviewer: null,
      reviewStatus: 'pending' as const,
    },
    {
      id: 'GONEUTRAL-2024',
      claim:
        'The GO NEUTRAL randomized trial evaluated hemodynamic-guided fluid-balance neutralization and accounted for multiple fluid inputs and outputs when calculating balance.',
      value:
        'Context for reassessing hemodynamic tolerance while adjusting fluid removal; no trial protocol value is used as a simulator recommendation.',
      sourceTitle:
        'Fluid balance neutralization secured by hemodynamic monitoring versus protocolized standard of care in patients with acute circulatory failure requiring continuous renal replacement therapy: results of the GO NEUTRAL randomized controlled trial',
      sourceType: 'peer-reviewed' as const,
      documentVersion: 'Intensive Care Med. 2024;50:2061–2072 · PMID 39417870',
      pageOrSection: 'DOI 10.1007/s00134-024-07676-1',
      implementationLocation: 'content/pilotCases.ts · CRRT-10',
      reviewer: null,
      reviewStatus: 'pending' as const,
    },
    ...(['04', '10', '13'] as const).map((caseNumber) => ({
      id: `SYNTH-CRRT-${caseNumber}`,
      claim: `All exact patient values, flow settings, timings, condition bands, resistance values, and model coefficients in CRRT-${caseNumber} are synthetic teaching calibration.`,
      value:
        'Not sourced clinical targets, normal values, alarm thresholds, device limits, or patient-specific recommendations.',
      sourceTitle: 'Baxter CRRT pilot synthetic calibration record',
      sourceType: 'synthetic-calibration' as const,
      documentVersion: 'Phase 5 draft.1',
      pageOrSection: `CRRT-${caseNumber} authored fixture`,
      implementationLocation: `content/pilotCases.ts · CRRT-${caseNumber}`,
      reviewer: null,
      reviewStatus: 'pending' as const,
    })),
  ].map((record) => Object.freeze(record)),
)
