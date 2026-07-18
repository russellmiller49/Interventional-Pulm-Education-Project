import { z } from 'zod'

import {
  baxterCrrtPublicationStatus,
  baxterCrrtReleaseStage,
  type BaxterCrrtPublicationStatus,
} from './release'
import type { BaxterCrrtReviewStatus } from './reviewStatus'

export { baxterCrrtPublicationStatus, baxterCrrtReleaseStage }
export type { BaxterCrrtPublicationStatus, BaxterCrrtReviewStatus }

export const BAXTER_CRRT_DEVICE_IDS = Object.freeze([
  'prismax-aw8035-2xx',
  'prismaflex-g5036003-6xx',
] as const)

export type BaxterCrrtDeviceId = (typeof BAXTER_CRRT_DEVICE_IDS)[number]
export type BaxterCrrtModalityLabel = 'SCUF' | 'CVVH' | 'CVVHD' | 'CVVHDF'

export type BaxterCrrtFormulaGateId = 'CONFLICT-001' | 'CONFLICT-002'
export type BaxterCrrtFormulaConflictId = BaxterCrrtFormulaGateId | 'CONFLICT-010'

export interface BaxterCrrtFlowRateIncrement {
  readonly controlId: string
  readonly configurationContextId: string
  readonly rangeMinimumInclusive: number
  readonly rangeMaximumInclusive: number
  readonly increment: number
  readonly unit: string
  readonly sourceRecordIds: readonly string[]
}

/**
 * Optional site data can extend a manual-reference profile later. The public
 * educational build never fabricates or silently assumes these fields.
 */
export interface BaxterCrrtOptionalLocalConfiguration {
  readonly kind: 'local-extension'
  readonly id: string
  readonly version: string
  readonly baseDeviceId: BaxterCrrtDeviceId
  readonly displayLabel: string
  readonly enabledModalities: readonly BaxterCrrtModalityLabel[]
  readonly setLabels: readonly string[]
  readonly solutionLabels: readonly string[]
  readonly sourceRecordIds: readonly string[]
}

export const baxterCrrtOptionalLocalConfigurationSchema = z
  .object({
    kind: z.literal('local-extension'),
    id: z.string().trim().min(1),
    version: z.string().trim().min(1),
    baseDeviceId: z.enum(BAXTER_CRRT_DEVICE_IDS),
    displayLabel: z.string().trim().min(1),
    enabledModalities: z.array(z.enum(['SCUF', 'CVVH', 'CVVHD', 'CVVHDF'])).min(1),
    setLabels: z.array(z.string().trim().min(1)),
    solutionLabels: z.array(z.string().trim().min(1)),
    sourceRecordIds: z.array(z.string().trim().min(1)).min(1),
  })
  .strict()

export interface BaxterCrrtReferenceProfileMetadata {
  readonly status: 'manual-reference'
  readonly learnerRuntimeEnabled: true
  readonly adapterRegistrationStatus: 'registered'
  readonly targetConfigurationStatus: 'not-claimed'
  readonly sourceDescribedTherapyFamilies: readonly string[]
  readonly sourceDescribedCrrtModes: readonly BaxterCrrtModalityLabel[]
  readonly interfaceParadigm: readonly string[]
}

export interface BaxterCrrtDeviceProfile {
  readonly id: BaxterCrrtDeviceId
  readonly profileKind: 'manual-reference'
  readonly profileVersion: string
  readonly displayName: string
  readonly manufacturerDisclosure: string
  readonly manualNumber: string
  readonly manualRevision: string
  readonly manualSourceSha256: string
  readonly sourceProgramFamily: string
  readonly marketConfiguration: string
  readonly localConfiguration: BaxterCrrtOptionalLocalConfiguration | null
  readonly availability: 'learner-runtime'
  readonly publicationStatus: BaxterCrrtPublicationStatus
  readonly referenceMetadata: Readonly<BaxterCrrtReferenceProfileMetadata>
  readonly supportedModalities: readonly BaxterCrrtModalityLabel[]
  readonly enabledTherapies: readonly string[]
  readonly enabledSetsAndAccessories: readonly string[]
  readonly pumpAndScaleInventory: Readonly<{
    status: 'manual-reference-educational'
    items: readonly string[]
  }>
  readonly flowRateRanges: Readonly<{
    status: 'case-authored-educational'
    ranges: readonly string[]
  }>
  readonly flowRateIncrements: Readonly<{
    status: 'case-authored-educational'
    increments: readonly Readonly<BaxterCrrtFlowRateIncrement>[]
  }>
  readonly setupSequenceStatus: 'full-v1-reference-workflow'
  readonly screenVocabulary: readonly string[]
  readonly alarmBehaviorStatus: 'curriculum-mapped-reference'
  readonly pressureCalculationSourceIds: readonly string[]
  readonly fluidCalculationSourceIds: readonly string[]
  readonly unresolvedFormulaGates: readonly BaxterCrrtFormulaGateId[]
  readonly contextualFormulaConflicts: readonly BaxterCrrtFormulaConflictId[]
  /** Informational provenance for the final SME pass; never a runtime gate. */
  readonly deviceReviewStatus: BaxterCrrtReviewStatus
  /** Informational provenance for the final SME pass; never a runtime gate. */
  readonly clinicalReviewStatus: BaxterCrrtReviewStatus
  readonly sourceRecordIds: readonly string[]
  readonly excludedSurfaceGroups: readonly string[]
}

/** Backward-compatible type name for modules that predate the unified v1 profile. */
export type BaxterCrrtDraftDeviceProfile = BaxterCrrtDeviceProfile

const nonEmptyString = z.string().trim().min(1)
const reviewStatusSchema = z.enum(['pending', 'reviewed', 'approved'])

export const baxterCrrtDeviceProfileSchema: z.ZodType<BaxterCrrtDeviceProfile> = z
  .object({
    id: z.enum(BAXTER_CRRT_DEVICE_IDS),
    profileKind: z.literal('manual-reference'),
    profileVersion: nonEmptyString,
    displayName: nonEmptyString,
    manufacturerDisclosure: nonEmptyString,
    manualNumber: nonEmptyString,
    manualRevision: nonEmptyString,
    manualSourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    sourceProgramFamily: nonEmptyString,
    marketConfiguration: nonEmptyString,
    localConfiguration: baxterCrrtOptionalLocalConfigurationSchema.nullable(),
    availability: z.literal('learner-runtime'),
    publicationStatus: z.enum(['draft', 'published']),
    referenceMetadata: z
      .object({
        status: z.literal('manual-reference'),
        learnerRuntimeEnabled: z.literal(true),
        adapterRegistrationStatus: z.literal('registered'),
        targetConfigurationStatus: z.literal('not-claimed'),
        sourceDescribedTherapyFamilies: z.array(nonEmptyString).min(1),
        sourceDescribedCrrtModes: z.array(z.enum(['SCUF', 'CVVH', 'CVVHD', 'CVVHDF'])).length(4),
        interfaceParadigm: z.array(nonEmptyString).min(1),
      })
      .strict(),
    supportedModalities: z.array(z.enum(['SCUF', 'CVVH', 'CVVHD', 'CVVHDF'])).length(4),
    enabledTherapies: z.array(nonEmptyString).min(1),
    enabledSetsAndAccessories: z.array(nonEmptyString).min(1),
    pumpAndScaleInventory: z
      .object({
        status: z.literal('manual-reference-educational'),
        items: z.array(nonEmptyString).min(1),
      })
      .strict(),
    flowRateRanges: z
      .object({
        status: z.literal('case-authored-educational'),
        ranges: z.array(nonEmptyString),
      })
      .strict(),
    flowRateIncrements: z
      .object({
        status: z.literal('case-authored-educational'),
        increments: z.array(
          z
            .object({
              controlId: nonEmptyString,
              configurationContextId: nonEmptyString,
              rangeMinimumInclusive: z.number().finite().nonnegative(),
              rangeMaximumInclusive: z.number().finite().nonnegative(),
              increment: z.number().finite().positive(),
              unit: nonEmptyString,
              sourceRecordIds: z.array(nonEmptyString).min(1),
            })
            .strict(),
        ),
      })
      .strict(),
    setupSequenceStatus: z.literal('full-v1-reference-workflow'),
    screenVocabulary: z.array(nonEmptyString).min(1),
    alarmBehaviorStatus: z.literal('curriculum-mapped-reference'),
    pressureCalculationSourceIds: z.array(nonEmptyString).min(1),
    fluidCalculationSourceIds: z.array(nonEmptyString).min(1),
    unresolvedFormulaGates: z.array(z.enum(['CONFLICT-001', 'CONFLICT-002'])),
    contextualFormulaConflicts: z.array(z.enum(['CONFLICT-001', 'CONFLICT-002', 'CONFLICT-010'])),
    deviceReviewStatus: reviewStatusSchema,
    clinicalReviewStatus: reviewStatusSchema,
    sourceRecordIds: z.array(nonEmptyString).min(1),
    excludedSurfaceGroups: z.array(nonEmptyString).min(1),
  })
  .strict()
  .superRefine((profile, context) => {
    if (new Set(profile.supportedModalities).size !== 4) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['supportedModalities'],
        message: 'A v1 manual-reference profile must expose all four CRRT modalities.',
      })
    }
    if (
      profile.localConfiguration !== null &&
      profile.localConfiguration.baseDeviceId !== profile.id
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['localConfiguration', 'baseDeviceId'],
        message: 'A local extension must identify the profile it extends.',
      })
    }
  })

const allModalities = Object.freeze(['SCUF', 'CVVH', 'CVVHD', 'CVVHDF'] as const)

function referenceMetadata(
  interfaceParadigm: readonly string[],
): Readonly<BaxterCrrtReferenceProfileMetadata> {
  return Object.freeze({
    status: 'manual-reference',
    learnerRuntimeEnabled: true,
    adapterRegistrationStatus: 'registered',
    targetConfigurationStatus: 'not-claimed',
    sourceDescribedTherapyFamilies: Object.freeze(['CRRT']),
    sourceDescribedCrrtModes: allModalities,
    interfaceParadigm: Object.freeze([...interfaceParadigm]),
  })
}

function deepFreezeProfile(profile: BaxterCrrtDeviceProfile): BaxterCrrtDeviceProfile {
  Object.freeze(profile.supportedModalities)
  Object.freeze(profile.enabledTherapies)
  Object.freeze(profile.enabledSetsAndAccessories)
  Object.freeze(profile.pumpAndScaleInventory.items)
  Object.freeze(profile.pumpAndScaleInventory)
  Object.freeze(profile.flowRateRanges.ranges)
  Object.freeze(profile.flowRateRanges)
  Object.freeze(profile.flowRateIncrements.increments)
  Object.freeze(profile.flowRateIncrements)
  Object.freeze(profile.screenVocabulary)
  Object.freeze(profile.pressureCalculationSourceIds)
  Object.freeze(profile.fluidCalculationSourceIds)
  Object.freeze(profile.unresolvedFormulaGates)
  Object.freeze(profile.contextualFormulaConflicts)
  Object.freeze(profile.sourceRecordIds)
  Object.freeze(profile.excludedSurfaceGroups)
  return Object.freeze(profile)
}

export const prismaxDeviceProfile: Readonly<BaxterCrrtDeviceProfile> = deepFreezeProfile({
  id: 'prismax-aw8035-2xx',
  profileKind: 'manual-reference',
  profileVersion: 'prismax-aw8035-rb-2xx-v1.0.0',
  displayName: 'PrisMax educational reference profile',
  manufacturerDisclosure: 'Baxter',
  manualNumber: 'AW8035',
  manualRevision: 'Rev B · JUN2019',
  manualSourceSha256: '204543b8c205e535cb9d45c970b8231362839177f3795b6164edcef3b834f1ff',
  sourceProgramFamily: 'Manual for program 2.XX',
  marketConfiguration:
    'Manual-revision educational reference; not a claim about any installed local configuration',
  localConfiguration: null,
  availability: 'learner-runtime',
  publicationStatus: baxterCrrtPublicationStatus,
  referenceMetadata: referenceMetadata([
    'Touch-screen Procedure workflow',
    'Therapy Operations screen',
    'Physical Stop control and return clamp',
  ]),
  supportedModalities: allModalities,
  enabledTherapies: Object.freeze([
    'SCUF educational workflow',
    'CVVH educational workflow',
    'CVVHD educational workflow',
    'CVVHDF educational workflow',
  ]),
  enabledSetsAndAccessories: Object.freeze([
    'Generic CRRT circuit representation',
    'Generic dialysate and replacement-fluid teaching profiles',
  ]),
  pumpAndScaleInventory: Object.freeze({
    status: 'manual-reference-educational',
    items: Object.freeze([
      'Blood pump',
      'Pre-blood-pump fluid pump',
      'Dialysate/replacement 2 pump',
      'Replacement pump',
      'Syringe pump',
      'Effluent pump',
      'Effluent, PBP, dialysate, and replacement scale positions',
    ]),
  }),
  flowRateRanges: Object.freeze({
    status: 'case-authored-educational',
    ranges: Object.freeze([
      'Every scenario supplies an explicit synthetic range; no local device limit is inferred.',
    ]),
  }),
  flowRateIncrements: Object.freeze({
    status: 'case-authored-educational',
    increments: Object.freeze([]),
  }),
  setupSequenceStatus: 'full-v1-reference-workflow',
  screenVocabulary: Object.freeze([
    'Start',
    'Procedure',
    'Patient',
    'Therapy',
    'Prescription',
    'Sets',
    'Fluids',
    'Prime',
    'Review',
    'Connect Patient',
    'Operations',
    'History',
    'Alarm window',
    'Stop treatment',
    'End treatment',
  ]),
  alarmBehaviorStatus: 'curriculum-mapped-reference',
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
  unresolvedFormulaGates: Object.freeze(['CONFLICT-001', 'CONFLICT-002']),
  contextualFormulaConflicts: Object.freeze([]),
  deviceReviewStatus: 'pending',
  clinicalReviewStatus: 'pending',
  sourceRecordIds: Object.freeze([
    'DEV-PM-001',
    'DEV-PM-002',
    'DEV-PM-003',
    'DEV-PM-005',
    'DEV-PM-006',
    'DEV-PM-007',
    'DEV-PM-008',
    'DEV-PM-009',
    'DEV-PM-010',
    'DEV-PM-011',
    'DEV-PM-012',
    'DEV-PM-013',
    'DEV-PM-014',
  ]),
  excludedSurfaceGroups: Object.freeze([
    'Administrator, service, password, connectivity, and remote-control surfaces',
    'Manufacturer branding, screenshots, copied figures, and proprietary trade dress',
    'Local solution, set, alarm-limit, and protocol claims',
    'Actionable citrate/calcium dosing',
    'Certification or independent-operator competency claims',
  ]),
})

export const prismaflexDeviceProfile: Readonly<BaxterCrrtDeviceProfile> = deepFreezeProfile({
  id: 'prismaflex-g5036003-6xx',
  profileKind: 'manual-reference',
  profileVersion: 'prismaflex-g5036003-r05-6xx-v1.0.0',
  displayName: 'Prismaflex educational reference profile',
  manufacturerDisclosure: 'Gambro Lundia AB',
  manualNumber: 'G5036003',
  manualRevision: 'Revision 05.2011',
  manualSourceSha256: '6d311624ec075c86ff539d3a86f3ed77cd2ca467346168ee4985af09f0a9224b',
  sourceProgramFamily: 'Manual for program 6.xx',
  marketConfiguration:
    'Multi-market manual-revision educational reference; not a local installed configuration',
  localConfiguration: null,
  availability: 'learner-runtime',
  publicationStatus: baxterCrrtPublicationStatus,
  referenceMetadata: referenceMetadata([
    'Color touch-screen display',
    'Context-dependent softkeys',
    'Arrow controls for settings and history navigation',
  ]),
  supportedModalities: allModalities,
  enabledTherapies: Object.freeze([
    'SCUF educational workflow',
    'CVVH educational workflow',
    'CVVHD educational workflow',
    'CVVHDF educational workflow',
  ]),
  enabledSetsAndAccessories: Object.freeze([
    'Generic four-pump CRRT circuit representation',
    'Generic four-scale teaching configuration',
  ]),
  pumpAndScaleInventory: Object.freeze({
    status: 'manual-reference-educational',
    items: Object.freeze([
      'Four therapy-dependent peristaltic fluid pumps',
      'Four therapy-dependent fluid and effluent scales',
      'Blood pump and return-line safety clamp',
    ]),
  }),
  flowRateRanges: Object.freeze({
    status: 'case-authored-educational',
    ranges: Object.freeze([
      'Every scenario supplies an explicit synthetic range; no local device limit is inferred.',
    ]),
  }),
  flowRateIncrements: Object.freeze({
    status: 'case-authored-educational',
    increments: Object.freeze([]),
  }),
  setupSequenceStatus: 'full-v1-reference-workflow',
  screenVocabulary: Object.freeze([
    'Choose Patient',
    'Enter Patient Information',
    'Choose Therapy',
    'Choose Anticoagulation Method',
    'Load Set',
    'Prepare and Connect Solutions',
    'Verify Setup',
    'Prime',
    'Prime Test',
    'Enter Treatment Settings',
    'Enter Flow Settings',
    'Review Prescription',
    'Connect Patient',
    'Verify Patient Connection',
    'Start Treatment',
    'Status',
    'History',
    'Alarm help',
    'Stop',
    'Treatment Complete',
  ]),
  alarmBehaviorStatus: 'curriculum-mapped-reference',
  pressureCalculationSourceIds: Object.freeze(['DEV-PF-004', 'DEV-PF-005', 'DEV-PF-006']),
  fluidCalculationSourceIds: Object.freeze(['DEV-PF-006']),
  unresolvedFormulaGates: Object.freeze([]),
  contextualFormulaConflicts: Object.freeze(['CONFLICT-010']),
  deviceReviewStatus: 'pending',
  clinicalReviewStatus: 'pending',
  sourceRecordIds: Object.freeze([
    'DEV-PF-001',
    'DEV-PF-002',
    'DEV-PF-003',
    'DEV-PF-004',
    'DEV-PF-005',
    'DEV-PF-006',
    'DEV-PF-007',
    'DEV-PF-008',
  ]),
  excludedSurfaceGroups: Object.freeze([
    'HP, TPE, and other non-CRRT therapy workflows',
    'Administrator, service, password, connectivity, and remote-control surfaces',
    'Manufacturer branding, screenshots, copied figures, and proprietary trade dress',
    'Local solution, set, alarm-limit, and protocol claims',
    'Actionable citrate/calcium dosing',
    'Certification or independent-operator competency claims',
  ]),
})

baxterCrrtDeviceProfileSchema.parse(prismaxDeviceProfile)
baxterCrrtDeviceProfileSchema.parse(prismaflexDeviceProfile)

export const baxterCrrtDeviceProfiles: readonly Readonly<BaxterCrrtDeviceProfile>[] = Object.freeze(
  [prismaxDeviceProfile, prismaflexDeviceProfile],
)

export const initialBaxterCrrtDeviceId: BaxterCrrtDeviceId = 'prismax-aw8035-2xx'

export function getBaxterCrrtDeviceProfile(
  deviceId: BaxterCrrtDeviceId,
): Readonly<BaxterCrrtDeviceProfile> {
  const profile = baxterCrrtDeviceProfiles.find(({ id }) => id === deviceId)
  if (!profile) throw new Error(`Unknown Baxter CRRT device profile: ${deviceId}`)
  return profile
}

export interface BaxterCrrtSmeReviewItem {
  readonly domain: 'clinical-content' | 'device-fidelity' | 'accessibility' | 'editorial-release'
  readonly label: string
  readonly reviewStatus: BaxterCrrtReviewStatus
  readonly note: string
}

/**
 * A lightweight final checklist, not an activation or authorization contract.
 * Completion is recorded in the review document after the finished build is
 * inspected; these values never control private runtime behavior.
 */
export const baxterCrrtSmeReviewItems: readonly BaxterCrrtSmeReviewItem[] = Object.freeze([
  Object.freeze({
    domain: 'clinical-content',
    label: 'Clinical content and causal reasoning',
    reviewStatus: 'pending',
    note: 'Review the finished cases, alternatives, critical errors, trends, and debriefs.',
  }),
  Object.freeze({
    domain: 'device-fidelity',
    label: 'Device workflow and terminology',
    reviewStatus: 'pending',
    note: 'Review the manual-reference PrisMax and Prismaflex workflows and limitations.',
  }),
  Object.freeze({
    domain: 'accessibility',
    label: 'Accessibility and responsive behavior',
    reviewStatus: 'pending',
    note: 'Review keyboard, assistive-technology, zoom, motion, and mobile behavior.',
  }),
  Object.freeze({
    domain: 'editorial-release',
    label: 'Feedback incorporated and ready for publication decision',
    reviewStatus: 'pending',
    note: 'The site owner changes the release stage only after feedback is incorporated.',
  }),
])
