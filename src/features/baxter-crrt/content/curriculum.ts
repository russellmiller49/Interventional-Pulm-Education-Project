import {
  canActivateCrrtRecord,
  pendingReviewRequirements,
  requiredCrrtReviewerDomainsForArtifacts,
  type CrrtActivationRecord,
  type CrrtActivationState,
} from './activation'
import { baxterCrrtPhase7ReviewCases } from './phase7ReviewCases'
import {
  CRRT_ALL_CASE_IDS,
  CRRT_PILOT_CASE_IDS,
  CRRT_PROTOCOL_GATED_CASE_IDS,
  type CrrtCaseId,
  type RuntimeCrrtCase,
} from './schema'
import { BAXTER_CRRT_PHASE_7_CONTENT_VERSION } from './versions'

export type CrrtCurriculumStationNumber = 1 | 2 | 3 | 4 | 5 | 6

export interface BaxterCrrtCaseCatalogEntry extends CrrtActivationRecord {
  readonly id: CrrtCaseId
  readonly contentVersion: typeof BAXTER_CRRT_PHASE_7_CONTENT_VERSION
  readonly station: CrrtCurriculumStationNumber
  readonly stationLabel: string
  readonly title: string
  readonly focus: string
  readonly runtimeAvailable: boolean
  readonly reviewerRuntimeAvailable: boolean
  readonly sourceRecordIds: readonly string[]
}

const stationLabels: Readonly<Record<CrrtCurriculumStationNumber, string>> = Object.freeze({
  1: 'Define the goal',
  2: 'Build the prescription',
  3: 'Set up and start safely',
  4: 'Monitor patient, dose, and fluid',
  5: 'Read pressures and troubleshoot',
  6: 'Anticoagulation, complications, and liberation',
})

interface CatalogSeed {
  readonly id: CrrtCaseId
  readonly station: CrrtCurriculumStationNumber
  readonly title: string
  readonly focus: string
  readonly sourceRecordIds: readonly string[]
  readonly blockingInputs?: readonly string[]
}

const catalogSeeds: readonly CatalogSeed[] = [
  {
    id: 'CRRT-01',
    station: 1,
    title: 'Septic shock, AKI, and fluid-overload goal definition',
    focus: 'Define the treatment goal from the whole clinical picture before selecting controls.',
    sourceRecordIds: ['CLIN-001'],
  },
  {
    id: 'CRRT-02',
    station: 1,
    title: 'Refractory hyperkalemia and acidemia with instability',
    focus:
      'Recognize a time-sensitive solute and acid-base problem without relying on one isolated value.',
    sourceRecordIds: ['CLIN-001'],
  },
  {
    id: 'CRRT-03',
    station: 1,
    title: 'Controlled solute and sodium management in acute brain or liver failure',
    focus: 'Coordinate a controlled trajectory with neurocritical or liver-failure goals.',
    sourceRecordIds: ['CLIN-001'],
  },
  {
    id: 'CRRT-04',
    station: 2,
    title: 'CVVHD for small-solute clearance',
    focus: 'Relate CVVHD prescription, device workflow, downtime, and delivered therapy.',
    sourceRecordIds: ['RENAL-2009', 'DOSE-PM-001', 'SYNTH-CRRT-04'],
  },
  {
    id: 'CRRT-05',
    station: 2,
    title: 'CVVH with pre- versus post-replacement tradeoffs',
    focus: 'Compare dilution location, effective clearance, and filtration-fraction implications.',
    sourceRecordIds: ['CLIN-001', 'MATH-PM-003', 'MATH-PM-005'],
    blockingInputs: ['Resolve the disputed/disabled pre-infusion calculation before activation.'],
  },
  {
    id: 'CRRT-06',
    station: 2,
    title: 'CVVHDF with prescribed-versus-delivered dose',
    focus: 'Separate the combined prescription from actual delivery across interruptions.',
    sourceRecordIds: ['CLIN-001', 'DOSE-PM-001'],
  },
  {
    id: 'CRRT-07',
    station: 3,
    title: 'Incorrect weight or hematocrit entry',
    focus: 'Identify how foundational patient inputs propagate into displayed calculations.',
    sourceRecordIds: ['CLIN-001', 'MATH-PM-005', 'DOSE-PM-001'],
  },
  {
    id: 'CRRT-08',
    station: 3,
    title: 'Set, bag, solution, line, prime, and review verification',
    focus: 'Complete configuration-dependent setup checks before simulated connection.',
    sourceRecordIds: ['DEV-PM-005', 'DEV-PM-013', 'SAFETY-002', 'SAFETY-005'],
    blockingInputs: ['Supply the exact local set, accessory, and solution registry.'],
  },
  {
    id: 'CRRT-09',
    station: 3,
    title: 'Anticoagulation setup using an approved protocol profile',
    focus: 'Protocol-gated anticoagulation setup; no actionable pathway is authored.',
    sourceRecordIds: ['CLIN-001', 'PROTO-001'],
    blockingInputs: ['Supply and approve a versioned local anticoagulation protocol profile.'],
  },
  {
    id: 'CRRT-10',
    station: 4,
    title: 'Machine PFR versus whole-patient net balance',
    focus: 'Keep machine removal distinct from external inputs, outputs, and tolerance.',
    sourceRecordIds: ['FLUID-PM-001', 'WHITE-2024', 'GONEUTRAL-2024', 'SYNTH-CRRT-10'],
  },
  {
    id: 'CRRT-11',
    station: 4,
    title: 'Hemodynamic intolerance of net removal',
    focus: 'Recognize simulated intolerance, reassess, and coordinate a response.',
    sourceRecordIds: ['CLIN-001', 'SAFETY-011'],
  },
  {
    id: 'CRRT-12',
    station: 4,
    title: 'Electrolyte, temperature, medication, or nutrition consequences',
    focus: 'Integrate treatment delivery with multidisciplinary monitoring.',
    sourceRecordIds: ['CLIN-001'],
    blockingInputs: ['Add pharmacist and nutrition-specialist evidence and dispositions.'],
  },
  {
    id: 'CRRT-13',
    station: 5,
    title: 'Increasingly negative access pressure',
    focus:
      'Use pressure direction and circuit inspection to correct the cause before reassessment.',
    sourceRecordIds: ['DEV-PM-009', 'SAFETY-009', 'SYNTH-CRRT-13'],
  },
  {
    id: 'CRRT-14',
    station: 5,
    title: 'High return pressure versus return disconnection',
    focus: 'Differentiate opposing return-path patterns before acting.',
    sourceRecordIds: ['DEV-PM-008', 'DEV-PM-009', 'SAFETY-001'],
    blockingInputs: [
      'Complete exact PrisMax alarm and response mapping for the target configuration.',
    ],
  },
  {
    id: 'CRRT-15',
    station: 5,
    title: 'Rising TMP or filter pressure drop from distinct causes',
    focus: 'Localize clotting, clogging, and effluent-path hypotheses using trends.',
    sourceRecordIds: ['DEV-PM-008', 'DEV-PM-009', 'DEV-PM-010'],
    blockingInputs: ['Resolve device-specific alarm and pressure-pattern review.'],
  },
  {
    id: 'CRRT-16',
    station: 6,
    title: 'Recurrent filter loss: access, filtration fraction, downtime, or anticoagulation',
    focus: 'Integrate repeated circuit loss across mechanical, delivery, and policy domains.',
    sourceRecordIds: ['CLIN-001', 'MATH-PM-003', 'SAFETY-010'],
    blockingInputs: ['Supply approved anticoagulation policy before operational teaching.'],
  },
  {
    id: 'CRRT-17',
    station: 6,
    title: 'Citrate and calcium problem using an approved local profile',
    focus:
      'Protocol-gated placeholder only; no dosing, targets, or adjustment algorithm is authored.',
    sourceRecordIds: ['PROTO-001', 'SAFETY-012'],
    blockingInputs: ['Supply and approve the complete versioned local citrate/calcium profile.'],
  },
  {
    id: 'CRRT-18',
    station: 6,
    title: 'Renal recovery, discontinuation, and transition',
    focus:
      'Reassess whether kidney support remains needed and coordinate the next supervised step.',
    sourceRecordIds: ['CLIN-001'],
    blockingInputs: ['Supply local stop, blood-return, transition, and escalation policies.'],
  },
] as const

function activationStateFor(id: CrrtCaseId): CrrtActivationState {
  if ((CRRT_PILOT_CASE_IDS as readonly string[]).includes(id)) return 'protected-pilot-active'
  if ((CRRT_PROTOCOL_GATED_CASE_IDS as readonly string[]).includes(id)) {
    return 'protocol-blocked'
  }
  if (baxterCrrtPhase7ReviewCases.cases.some((definition) => definition.id === id)) {
    return 'draft-reviewer-only'
  }
  return 'manifest-only'
}

export const baxterCrrtCaseCatalog: readonly BaxterCrrtCaseCatalogEntry[] = Object.freeze(
  catalogSeeds.map((seed) => {
    const activationState = activationStateFor(seed.id)
    const pilotActive = activationState === 'protected-pilot-active'
    const reviewerRuntimeAvailable = activationState === 'draft-reviewer-only'
    const domains = requiredCrrtReviewerDomainsForArtifacts([seed.id])
    if (domains === null) throw new Error(`Unknown CRRT activation artifact: ${seed.id}`)
    return Object.freeze({
      ...seed,
      contentVersion: BAXTER_CRRT_PHASE_7_CONTENT_VERSION,
      exactCandidateIdentity: null,
      candidateManifestSha256: null,
      expectedFindingsLedgerSha256: null,
      expectedAuthorizationScopeSha256: null,
      expectedReviewScopeSha256ByDomain: null,
      expectedPilotAcceptanceReference: null,
      expectedPhase8StablePrismaxPrerequisite: null,
      reviewScope: 'prismax' as const,
      activationAuthorization: null,
      stationLabel: stationLabels[seed.station],
      runtimeAvailable: pilotActive,
      reviewerRuntimeAvailable,
      activationState,
      reviewStatus: 'pending' as const,
      requiredReviews: pendingReviewRequirements(domains),
      blockingInputs: Object.freeze([...(seed.blockingInputs ?? [])]),
      sourceRecordIds: Object.freeze([...seed.sourceRecordIds]),
    })
  }),
)

function validateCatalog(): void {
  const ids = baxterCrrtCaseCatalog.map((entry) => entry.id)
  if (ids.length !== CRRT_ALL_CASE_IDS.length) {
    throw new Error('CRRT curriculum catalog must contain exactly 18 cases.')
  }
  for (const [index, expected] of CRRT_ALL_CASE_IDS.entries()) {
    if (ids[index] !== expected) {
      throw new Error(`CRRT curriculum catalog order mismatch at ${expected}.`)
    }
  }
  if (new Set(ids).size !== ids.length) throw new Error('CRRT curriculum case IDs must be unique.')
  for (const entry of baxterCrrtCaseCatalog) {
    if (entry.runtimeAvailable !== (entry.activationState === 'protected-pilot-active')) {
      throw new Error(`CRRT catalog runtime boundary is inconsistent for ${entry.id}.`)
    }
    if (
      entry.reviewerRuntimeAvailable !==
      baxterCrrtPhase7ReviewCases.cases.some((definition) => definition.id === entry.id)
    ) {
      throw new Error(`CRRT reviewer-runtime boundary is inconsistent for ${entry.id}.`)
    }
    if (entry.activationState === 'learner-active' && !canActivateCrrtRecord(entry)) {
      throw new Error(`CRRT catalog cannot activate unreviewed case ${entry.id}.`)
    }
  }
}

validateCatalog()

export {
  baxterCrrtPhase7LearnerRegistrations,
  baxterCrrtLearnerCases,
  buildBaxterCrrtLearnerCaseRegistry,
  isBaxterCrrtLearnerCaseDefinition,
  isBaxterCrrtLearnerCaseId,
  isBaxterCrrtLearnerLessonId,
  isBaxterCrrtLearnerProgressCaseId,
} from './learnerRegistry'

export const baxterCrrtReviewerCases: readonly RuntimeCrrtCase[] = baxterCrrtPhase7ReviewCases.cases

export function getBaxterCrrtCaseCatalogEntry(caseId: CrrtCaseId): BaxterCrrtCaseCatalogEntry {
  const entry = baxterCrrtCaseCatalog.find((candidate) => candidate.id === caseId)
  if (!entry) throw new Error(`Unknown CRRT curriculum case: ${caseId}`)
  return entry
}
