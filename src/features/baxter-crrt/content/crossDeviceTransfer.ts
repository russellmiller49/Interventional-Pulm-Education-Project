import { z } from 'zod'

import { BAXTER_CRRT_PHASE_8_CONTENT_VERSION } from './versions'

export const BAXTER_CRRT_CROSS_DEVICE_TRANSFER_DOMAIN_IDS = [
  'setup-navigation',
  'prescription-display',
  'pressure-translation',
  'fluid-accounting',
  'alarm-taxonomy',
] as const

export type BaxterCrrtCrossDeviceTransferDomainId =
  (typeof BAXTER_CRRT_CROSS_DEVICE_TRANSFER_DOMAIN_IDS)[number]

const BAXTER_CRRT_CROSS_DEVICE_TRANSFER_PREREQUISITE_IDS = [
  'stable-prismax-v1',
  'approved-prismaflex-profile',
  'assigned-device-reviewers',
  'approved-equivalence-protocol',
  'reviewed-transfer-content',
] as const

export interface BaxterCrrtCrossDeviceTransferDomain {
  readonly id: BaxterCrrtCrossDeviceTransferDomainId
  readonly label: string
  readonly sharedClinicalConcept: string
  readonly prismaxDeviceSpecificQuestion: string
  readonly prismaflexDeviceSpecificQuestion: string
  readonly equivalenceBoundary: string
  readonly sourceRecordIds: readonly string[]
}

export interface BaxterCrrtCrossDeviceTransferPrerequisite {
  readonly id: (typeof BAXTER_CRRT_CROSS_DEVICE_TRANSFER_PREREQUISITE_IDS)[number]
  readonly label: string
  readonly satisfied: false
}

export interface BaxterCrrtCrossDeviceTransferManifest {
  readonly id: 'TRANSFER-PRISMAX-PRISMAFLEX-01'
  readonly contentVersion: typeof BAXTER_CRRT_PHASE_8_CONTENT_VERSION
  readonly exactCandidateIdentity: null
  readonly learnerTitleBeforeDebrief: 'Unseen cross-device transfer capstone'
  readonly revealingTitle: null
  readonly status: 'reviewer-only-composition-plan'
  readonly reviewStatus: 'pending'
  readonly prismaxDeviceId: 'prismax-aw8035-2xx'
  readonly prismaflexDeviceId: 'prismaflex-g5036003-6xx'
  readonly minimumProblemDomains: 2
  readonly outcomeTolerance: null
  readonly hintsAllowedCandidate: false
  readonly cleanStateRequiredCandidate: true
  readonly reassessmentRequiredCandidate: true
  readonly learnerRuntimeEnabled: false
  readonly runtimeSessionAvailable: false
  readonly scoringAvailable: false
  readonly progressPersistenceAvailable: false
  readonly competencyAvailable: false
  readonly runtimeCaseIds: readonly []
  readonly domains: readonly BaxterCrrtCrossDeviceTransferDomain[]
  readonly prerequisites: readonly BaxterCrrtCrossDeviceTransferPrerequisite[]
  readonly sourceRecordIds: readonly string[]
}

const crossDeviceSourceIdSchema = z
  .string()
  .min(1)
  .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
const crossDeviceNonEmptyStringSchema = z.string().trim().min(1)

export const baxterCrrtCrossDeviceTransferDomainSchema = z
  .object({
    id: z.enum(BAXTER_CRRT_CROSS_DEVICE_TRANSFER_DOMAIN_IDS),
    label: crossDeviceNonEmptyStringSchema,
    sharedClinicalConcept: crossDeviceNonEmptyStringSchema,
    prismaxDeviceSpecificQuestion: crossDeviceNonEmptyStringSchema,
    prismaflexDeviceSpecificQuestion: crossDeviceNonEmptyStringSchema,
    equivalenceBoundary: crossDeviceNonEmptyStringSchema,
    sourceRecordIds: z.array(crossDeviceSourceIdSchema).min(1),
  })
  .strict()

export const baxterCrrtCrossDeviceTransferPrerequisiteSchema = z
  .object({
    id: z.enum(BAXTER_CRRT_CROSS_DEVICE_TRANSFER_PREREQUISITE_IDS),
    label: crossDeviceNonEmptyStringSchema,
    satisfied: z.literal(false),
  })
  .strict()

/**
 * Authored-content boundary for the Phase 8 composition plan. Every runtime,
 * scoring, progress, competency, and equivalence field remains fail-closed.
 */
export const baxterCrrtCrossDeviceTransferManifestSchema = z
  .object({
    id: z.literal('TRANSFER-PRISMAX-PRISMAFLEX-01'),
    contentVersion: z.literal(BAXTER_CRRT_PHASE_8_CONTENT_VERSION),
    exactCandidateIdentity: z.null(),
    learnerTitleBeforeDebrief: z.literal('Unseen cross-device transfer capstone'),
    revealingTitle: z.null(),
    status: z.literal('reviewer-only-composition-plan'),
    reviewStatus: z.literal('pending'),
    prismaxDeviceId: z.literal('prismax-aw8035-2xx'),
    prismaflexDeviceId: z.literal('prismaflex-g5036003-6xx'),
    minimumProblemDomains: z.literal(2),
    outcomeTolerance: z.null(),
    hintsAllowedCandidate: z.literal(false),
    cleanStateRequiredCandidate: z.literal(true),
    reassessmentRequiredCandidate: z.literal(true),
    learnerRuntimeEnabled: z.literal(false),
    runtimeSessionAvailable: z.literal(false),
    scoringAvailable: z.literal(false),
    progressPersistenceAvailable: z.literal(false),
    competencyAvailable: z.literal(false),
    runtimeCaseIds: z.array(z.never()).length(0),
    domains: z
      .array(baxterCrrtCrossDeviceTransferDomainSchema)
      .length(BAXTER_CRRT_CROSS_DEVICE_TRANSFER_DOMAIN_IDS.length),
    prerequisites: z
      .array(baxterCrrtCrossDeviceTransferPrerequisiteSchema)
      .length(BAXTER_CRRT_CROSS_DEVICE_TRANSFER_PREREQUISITE_IDS.length),
    sourceRecordIds: z.array(crossDeviceSourceIdSchema).min(1),
  })
  .strict()
  .superRefine((manifest, context) => {
    const exactDomainOrder = BAXTER_CRRT_CROSS_DEVICE_TRANSFER_DOMAIN_IDS.every(
      (domainId, index) => manifest.domains[index]?.id === domainId,
    )
    if (!exactDomainOrder) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['domains'],
        message: 'Cross-device transfer domains must be complete, unique, and in canonical order.',
      })
    }

    const exactPrerequisiteOrder = BAXTER_CRRT_CROSS_DEVICE_TRANSFER_PREREQUISITE_IDS.every(
      (prerequisiteId, index) => manifest.prerequisites[index]?.id === prerequisiteId,
    )
    if (!exactPrerequisiteOrder) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['prerequisites'],
        message: 'Cross-device transfer prerequisites must be complete and in canonical order.',
      })
    }

    const expectedSourceRecordIds = Array.from(
      new Set(manifest.domains.flatMap((domain) => domain.sourceRecordIds)),
    ).sort()
    const exactSourceRecordUnion =
      expectedSourceRecordIds.length === manifest.sourceRecordIds.length &&
      expectedSourceRecordIds.every(
        (sourceRecordId, index) => manifest.sourceRecordIds[index] === sourceRecordId,
      )
    if (!exactSourceRecordUnion) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceRecordIds'],
        message: 'Manifest source records must equal the sorted union of domain source records.',
      })
    }
  })

function freezeDomain(
  domain: BaxterCrrtCrossDeviceTransferDomain,
): BaxterCrrtCrossDeviceTransferDomain {
  Object.freeze(domain.sourceRecordIds)
  return Object.freeze(domain)
}

const domains: readonly BaxterCrrtCrossDeviceTransferDomain[] = Object.freeze([
  freezeDomain({
    id: 'setup-navigation',
    label: 'Setup and navigation translation',
    sharedClinicalConcept:
      'Preserve the intended patient, therapy, prescription, setup verification, and reassessment goals.',
    prismaxDeviceSpecificQuestion:
      'Can the reviewer locate the corresponding goal within the PrisMax Procedure-to-Operations workflow?',
    prismaflexDeviceSpecificQuestion:
      'Can the reviewer locate the corresponding goal within the Prismaflex softkey and Setup/Standby/Run workflow?',
    equivalenceBoundary:
      'Matching a goal does not establish identical screen order, wording, controls, installed options, or stop/end behavior.',
    sourceRecordIds: Object.freeze(['DEV-PM-002', 'DEV-PM-005', 'DEV-PF-002']),
  }),
  freezeDomain({
    id: 'prescription-display',
    label: 'Prescription and displayed calculation translation',
    sharedClinicalConcept:
      'Hold the canonical prescription and patient inputs constant before comparing device-displayed quantities.',
    prismaxDeviceSpecificQuestion:
      'Which PrisMax-specific flow terms and display corrections are being represented?',
    prismaflexDeviceSpecificQuestion:
      'Which Prismaflex Qeff context is being represented, and is the pump-target/dose-section distinction explicit?',
    equivalenceBoundary:
      'No cross-device numeric equivalence tolerance is approved; the unresolved Prismaflex Qeff definitions remain separate.',
    sourceRecordIds: Object.freeze(['MATH-PM-001', 'MATH-PM-002', 'DEV-PF-006', 'CONFLICT-010']),
  }),
  freezeDomain({
    id: 'pressure-translation',
    label: 'Pressure-pattern translation',
    sharedClinicalConcept:
      'Interpret the causal pattern and patient/circuit context separately from any device display value.',
    prismaxDeviceSpecificQuestion:
      'How does the PrisMax profile present operating-point-dependent access, filter, return, and filter-drop information?',
    prismaflexDeviceSpecificQuestion:
      'How does the Prismaflex profile establish operating points and distinguish raw from display-corrected filter drop?',
    equivalenceBoundary:
      'Device display corrections, operating points, thresholds, and alarm reactions are not interchangeable clinical normals.',
    sourceRecordIds: Object.freeze(['DEV-PM-009', 'DEV-PM-010', 'DEV-PF-004', 'DEV-PF-005']),
  }),
  freezeDomain({
    id: 'fluid-accounting',
    label: 'Fluid-accounting translation',
    sharedClinicalConcept:
      'Keep machine patient-fluid removal and device variance distinct from whole-patient inputs, outputs, and net balance.',
    prismaxDeviceSpecificQuestion:
      'Which PrisMax pump, scale, catch-up, and machine-PFR concepts are visible in the approved target profile?',
    prismaflexDeviceSpecificQuestion:
      'Which Prismaflex four-pump/four-scale and PFR-volume terms are visible in the approved target profile?',
    equivalenceBoundary:
      'A machine fluid value is not the complete patient ledger, and an installed configuration cannot be inferred from a manual family.',
    sourceRecordIds: Object.freeze([
      'DEV-PM-012',
      'DEV-PM-013',
      'FLUID-PM-001',
      'DEV-PF-003',
      'DEV-PF-006',
    ]),
  }),
  freezeDomain({
    id: 'alarm-taxonomy',
    label: 'Alarm-language translation',
    sharedClinicalConcept:
      'Assess patient safety, identify the device response, inspect the corresponding domain, verify cause correction, and reassess.',
    prismaxDeviceSpecificQuestion:
      'Which individually reviewed PrisMax message, priority, reaction, and action mapping applies?',
    prismaflexDeviceSpecificQuestion:
      'Which individually reviewed Prismaflex Warning, Malfunction, Caution, or Advisory mapping applies?',
    equivalenceBoundary:
      'Category labels and acknowledgement behavior do not prove that the cause is corrected and must not be mapped by name alone.',
    sourceRecordIds: Object.freeze(['DEV-PM-007', 'DEV-PM-008', 'DEV-PF-007', 'SAFETY-001']),
  }),
])

const prerequisiteSeeds = [
  {
    id: 'stable-prismax-v1',
    label: 'Freeze and approve the complete PrisMax v1 curriculum.',
    satisfied: false,
  },
  {
    id: 'approved-prismaflex-profile',
    label:
      'Document and approve the target Prismaflex market, software, therapies, sets, accessories, and local configuration.',
    satisfied: false,
  },
  {
    id: 'assigned-device-reviewers',
    label: 'Record exact-version PrisMax- and Prismaflex-trained device-reviewer dispositions.',
    satisfied: false,
  },
  {
    id: 'approved-equivalence-protocol',
    label: 'Approve the canonical-state equivalence protocol and its numeric tolerances.',
    satisfied: false,
  },
  {
    id: 'reviewed-transfer-content',
    label: 'Review the transfer tasks, alternatives, critical errors, scoring, and reassessment.',
    satisfied: false,
  },
] as const satisfies readonly BaxterCrrtCrossDeviceTransferPrerequisite[]

const prerequisites: readonly BaxterCrrtCrossDeviceTransferPrerequisite[] = Object.freeze(
  prerequisiteSeeds.map(
    (prerequisite): BaxterCrrtCrossDeviceTransferPrerequisite => Object.freeze({ ...prerequisite }),
  ),
)

export const baxterCrrtCrossDeviceTransferManifest: BaxterCrrtCrossDeviceTransferManifest =
  Object.freeze({
    id: 'TRANSFER-PRISMAX-PRISMAFLEX-01',
    contentVersion: BAXTER_CRRT_PHASE_8_CONTENT_VERSION,
    exactCandidateIdentity: null,
    learnerTitleBeforeDebrief: 'Unseen cross-device transfer capstone',
    revealingTitle: null,
    status: 'reviewer-only-composition-plan',
    reviewStatus: 'pending',
    prismaxDeviceId: 'prismax-aw8035-2xx',
    prismaflexDeviceId: 'prismaflex-g5036003-6xx',
    minimumProblemDomains: 2,
    outcomeTolerance: null,
    hintsAllowedCandidate: false,
    cleanStateRequiredCandidate: true,
    reassessmentRequiredCandidate: true,
    learnerRuntimeEnabled: false,
    runtimeSessionAvailable: false,
    scoringAvailable: false,
    progressPersistenceAvailable: false,
    competencyAvailable: false,
    runtimeCaseIds: Object.freeze([] as const),
    domains,
    prerequisites,
    sourceRecordIds: Object.freeze(
      Array.from(new Set(domains.flatMap((domain) => domain.sourceRecordIds))).sort(),
    ),
  })

baxterCrrtCrossDeviceTransferManifestSchema.parse(baxterCrrtCrossDeviceTransferManifest)

export const baxterCrrtCrossDeviceTransferAvailable = false as const
