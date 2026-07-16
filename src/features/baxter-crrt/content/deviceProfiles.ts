export type BaxterCrrtPublicationStatus = 'draft' | 'published'
export type BaxterCrrtReviewStatus = 'pending' | 'reviewed' | 'approved'

export type BaxterCrrtDeviceId = 'prismax-aw8035-2xx' | 'prismaflex-g5036003-6xx'

export interface BaxterCrrtDraftDeviceProfile {
  readonly id: BaxterCrrtDeviceId
  readonly profileVersion: string
  readonly displayName: string
  readonly manufacturerDisclosure: string
  readonly manualNumber: string
  readonly manualRevision: string
  readonly sourceProgramFamily: string
  readonly marketConfiguration: string
  readonly availability: 'orientation-scaffold' | 'deferred'
  readonly enabledTherapies: readonly string[]
  readonly enabledSetsAndAccessories: readonly string[]
  readonly pumpAndScaleInventory: Readonly<{
    status: 'pending-local-configuration' | 'deferred'
    items: readonly string[]
  }>
  readonly flowRateRanges: Readonly<{
    status: 'pending-set-and-configuration-review' | 'deferred'
    ranges: readonly string[]
  }>
  readonly setupSequenceStatus: 'phase-3-not-implemented' | 'deferred'
  readonly screenVocabulary: readonly string[]
  readonly alarmBehaviorStatus: 'pending-device-adapter' | 'deferred'
  readonly pressureCalculationSourceIds: readonly string[]
  readonly fluidCalculationSourceIds: readonly string[]
  readonly unresolvedFormulaGates: readonly ('CONFLICT-001' | 'CONFLICT-002')[]
  readonly deviceReviewStatus: BaxterCrrtReviewStatus
  readonly clinicalReviewStatus: BaxterCrrtReviewStatus
  readonly sourceRecordIds: readonly string[]
  readonly excludedSurfaceGroups: readonly string[]
}

export const baxterCrrtPublicationStatus: BaxterCrrtPublicationStatus = 'draft'
export const initialBaxterCrrtDeviceId: BaxterCrrtDeviceId = 'prismax-aw8035-2xx'

export const baxterCrrtReleaseReviews = Object.freeze([
  { id: 'device', label: 'PrisMax device review', status: 'pending' },
  { id: 'clinical', label: 'Clinical review', status: 'pending' },
  { id: 'accessibility', label: 'Accessibility review', status: 'pending' },
  { id: 'localization', label: 'Localization review', status: 'pending' },
] satisfies readonly {
  id: string
  label: string
  status: BaxterCrrtReviewStatus
}[])

export const prismaxDraftDeviceProfile: Readonly<BaxterCrrtDraftDeviceProfile> = Object.freeze({
  id: 'prismax-aw8035-2xx',
  profileVersion: 'prismax-aw8035-rb-2xx-draft.1',
  displayName: 'PrisMax educational profile',
  manufacturerDisclosure: 'Baxter',
  manualNumber: 'AW8035',
  manualRevision: 'Rev B · JUN2019',
  sourceProgramFamily: 'Manual for program 2.XX',
  marketConfiguration: 'Not established from supplied copy',
  availability: 'orientation-scaffold',
  enabledTherapies: Object.freeze([]),
  enabledSetsAndAccessories: Object.freeze([]),
  pumpAndScaleInventory: Object.freeze({
    status: 'pending-local-configuration',
    items: Object.freeze([]),
  }),
  flowRateRanges: Object.freeze({
    status: 'pending-set-and-configuration-review',
    ranges: Object.freeze([]),
  }),
  setupSequenceStatus: 'phase-3-not-implemented',
  screenVocabulary: Object.freeze(['Procedure', 'Operations']),
  alarmBehaviorStatus: 'pending-device-adapter',
  pressureCalculationSourceIds: Object.freeze(['DEV-PM-009', 'DEV-PM-010', 'MATH-PM-002']),
  fluidCalculationSourceIds: Object.freeze([
    'MATH-PM-001',
    'MATH-PM-003',
    'MATH-PM-005',
    'FLUID-PM-001',
    'FLUID-PM-002',
    'DOSE-PM-001',
    'DEV-PM-013',
  ]),
  unresolvedFormulaGates: Object.freeze(['CONFLICT-001', 'CONFLICT-002'] as const),
  deviceReviewStatus: 'pending',
  clinicalReviewStatus: 'pending',
  sourceRecordIds: Object.freeze(['DEV-PM-001', 'DEV-PM-002']),
  excludedSurfaceGroups: Object.freeze([
    'Clinical prescription controls',
    'Alarm response and troubleshooting',
    'Administrator and service configuration',
    'Citrate and calcium dosing',
    'Set, solution, accessory, and Auto Effluent selection',
  ]),
})

export const prismaflexDeferredDeviceProfile: Readonly<BaxterCrrtDraftDeviceProfile> =
  Object.freeze({
    id: 'prismaflex-g5036003-6xx',
    profileVersion: 'prismaflex-g5036003-r05-6xx-deferred.1',
    displayName: 'Prismaflex deferred profile',
    manufacturerDisclosure: 'Gambro / Baxter',
    manualNumber: 'G5036003',
    manualRevision: 'Revision 05.2011',
    sourceProgramFamily: 'Manual for program 6.xx',
    marketConfiguration: 'Multi-market source; local configuration not established',
    availability: 'deferred',
    enabledTherapies: Object.freeze([]),
    enabledSetsAndAccessories: Object.freeze([]),
    pumpAndScaleInventory: Object.freeze({ status: 'deferred', items: Object.freeze([]) }),
    flowRateRanges: Object.freeze({ status: 'deferred', ranges: Object.freeze([]) }),
    setupSequenceStatus: 'deferred',
    screenVocabulary: Object.freeze([]),
    alarmBehaviorStatus: 'deferred',
    pressureCalculationSourceIds: Object.freeze([]),
    fluidCalculationSourceIds: Object.freeze([]),
    unresolvedFormulaGates: Object.freeze([]),
    deviceReviewStatus: 'pending',
    clinicalReviewStatus: 'pending',
    sourceRecordIds: Object.freeze(['DEV-PF-001']),
    excludedSurfaceGroups: Object.freeze([
      'All learner-facing device controls',
      'All setup, alarm, and end-treatment workflows',
      'All clinical cases and cross-device transfer exercises',
    ]),
  })
