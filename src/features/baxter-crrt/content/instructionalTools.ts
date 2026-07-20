import { CRRT_INSTRUCTIONAL_TOOL_ARTIFACT_IDS } from './artifactRegistry'
import { BAXTER_CRRT_CONTENT_VERSION } from './versions'

export const CRRT_INSTRUCTIONAL_TOOL_IDS = CRRT_INSTRUCTIONAL_TOOL_ARTIFACT_IDS
export type CrrtInstructionalToolId = (typeof CRRT_INSTRUCTIONAL_TOOL_IDS)[number]

export interface CrrtInstructionalToolManifest {
  readonly id: CrrtInstructionalToolId
  readonly contentVersion: typeof BAXTER_CRRT_CONTENT_VERSION
  readonly title: string
  readonly purpose: string
  readonly sourceRecordIds: readonly string[]
  readonly unavailableExpressions: readonly string[]
  readonly reviewStatus: 'pending'
  readonly reviewerRuntimeAvailable: true
  readonly learnerAvailable: true
  readonly scoringAvailable: boolean
  readonly progressPersistenceAvailable: true
  /** Compatibility alias; these are limitations, not runtime blockers. */
  readonly blockingInputs: readonly string[]
}

const tools: readonly Omit<
  CrrtInstructionalToolManifest,
  | 'contentVersion'
  | 'reviewStatus'
  | 'reviewerRuntimeAvailable'
  | 'learnerAvailable'
  | 'progressPersistenceAvailable'
  | 'blockingInputs'
>[] = [
  {
    id: 'LAB-PRESCRIPTION',
    title: 'Full Prescription Workbench',
    purpose:
      'Compare source-backed device calculations while keeping clinical goals, solution choices, and protocols explicitly separate.',
    sourceRecordIds: [
      'MATH-PM-001',
      'MATH-PM-003',
      'MATH-PM-004',
      'MATH-PM-005',
      'MATH-PM-006',
      'DOSE-PM-001',
      'FLUID-PM-002',
      'SYNTH-LAB-PRESCRIPTION-001',
    ],
    unavailableExpressions: [
      'Ambiguous PrisMax pre-infusion expressions remain unavailable.',
      'No local solution, set, or medication protocol is inferred.',
    ],
    scoringAvailable: true,
  },
  {
    id: 'LAB-PRESSURE-LOCALIZATION',
    title: 'Pressure Localization Lab',
    purpose:
      'Predict a synthetic directional pressure pattern before revealing the placed obstruction or disconnection.',
    sourceRecordIds: ['DEV-PM-009', 'DEV-PM-010', 'MATH-PM-002', 'SYNTH-LAB-PRESSURE-001'],
    unavailableExpressions: [
      'Exact local alarm thresholds and corrective procedures are not represented.',
    ],
    scoringAvailable: true,
  },
]

export const baxterCrrtInstructionalToolManifest: readonly CrrtInstructionalToolManifest[] =
  Object.freeze(
    tools.map((tool) =>
      Object.freeze({
        ...tool,
        contentVersion: BAXTER_CRRT_CONTENT_VERSION,
        sourceRecordIds: Object.freeze([...tool.sourceRecordIds]),
        unavailableExpressions: Object.freeze([...tool.unavailableExpressions]),
        blockingInputs: Object.freeze([...tool.unavailableExpressions]),
        reviewStatus: 'pending' as const,
        reviewerRuntimeAvailable: true as const,
        learnerAvailable: true as const,
        progressPersistenceAvailable: true as const,
      }),
    ),
  )

if (
  baxterCrrtInstructionalToolManifest.map((tool) => tool.id).join('|') !==
  CRRT_INSTRUCTIONAL_TOOL_IDS.join('|')
) {
  throw new Error('CRRT instructional-tool registry must contain both embedded labs exactly once.')
}

export function isBaxterCrrtInstructionalToolId(value: string): value is CrrtInstructionalToolId {
  return (CRRT_INSTRUCTIONAL_TOOL_IDS as readonly string[]).includes(value)
}
