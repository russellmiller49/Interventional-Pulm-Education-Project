import { BAXTER_CRRT_CONTENT_VERSION } from './versions'

export type CrrtCrossDeviceTransferDomainId =
  | 'setup-navigation'
  | 'prescription-display'
  | 'pressure-localization'
  | 'fluid-accounting'
  | 'alarm-stop-end'

export interface CrrtCrossDeviceTransferDomain {
  readonly id: CrrtCrossDeviceTransferDomainId
  readonly sharedClinicalGoal: string
  readonly prismaxExpression: string
  readonly prismaflexExpression: string
  readonly transferPrompt: string
  readonly options: readonly { readonly id: string; readonly label: string }[]
  readonly correctOptionId: string
  readonly sourceRecordIds: readonly string[]
}

export interface CrrtCrossDeviceTransferCapstone {
  readonly id: 'TRANSFER-PRISMAX-PRISMAFLEX-01'
  readonly contentVersion: typeof BAXTER_CRRT_CONTENT_VERSION
  readonly title: 'Cross-device workflow translation capstone'
  readonly deviceIds: readonly ['prismax-aw8035-2xx', 'prismaflex-g5036003-6xx']
  readonly status: 'operational-v1'
  readonly minimumScore: 80
  readonly canonicalOutcomeTolerance: 1e-9
  readonly clinicalInterchangeabilityClaimed: false
  readonly reviewStatus: 'pending'
  readonly domains: readonly CrrtCrossDeviceTransferDomain[]
}

const domain = (value: CrrtCrossDeviceTransferDomain): CrrtCrossDeviceTransferDomain =>
  Object.freeze({
    ...value,
    options: Object.freeze(value.options.map((option) => Object.freeze(option))),
    sourceRecordIds: Object.freeze([...value.sourceRecordIds]),
  })

export const baxterCrrtCrossDeviceTransferCapstone: CrrtCrossDeviceTransferCapstone = Object.freeze(
  {
    id: 'TRANSFER-PRISMAX-PRISMAFLEX-01',
    contentVersion: BAXTER_CRRT_CONTENT_VERSION,
    title: 'Cross-device workflow translation capstone',
    deviceIds: Object.freeze(['prismax-aw8035-2xx', 'prismaflex-g5036003-6xx'] as const),
    status: 'operational-v1',
    minimumScore: 80,
    canonicalOutcomeTolerance: 1e-9,
    clinicalInterchangeabilityClaimed: false,
    reviewStatus: 'pending',
    domains: Object.freeze([
      domain({
        id: 'setup-navigation',
        sharedClinicalGoal:
          'Verify patient, therapy, prescription, circuit, fluids, prime, and connection.',
        prismaxExpression: 'Touch-screen Procedure workflow with staged setup categories.',
        prismaflexExpression:
          'Softkey workflow with patient, therapy, set, solution, prime-test, and connection screens.',
        transferPrompt: 'What should transfer between devices?',
        options: [
          { id: 'setup-goals', label: 'The verification goals, not memorized screen order' },
          { id: 'setup-identical', label: 'An assumption that the screen sequence is identical' },
        ],
        correctOptionId: 'setup-goals',
        sourceRecordIds: ['DEV-PM-005', 'DEV-PF-002'],
      }),
      domain({
        id: 'prescription-display',
        sharedClinicalGoal:
          'Distinguish prescribed controls, pump targets, displayed dose context, and actual delivery.',
        prismaxExpression: 'PrisMax manual-reference flow and displayed calculation labels.',
        prismaflexExpression: 'Separate pump-target and dose-section Qeff contexts.',
        transferPrompt: 'How should Qeff be translated?',
        options: [
          { id: 'qeff-context', label: 'Name the device and calculation context explicitly' },
          { id: 'qeff-collapse', label: 'Treat every printed Qeff expression as interchangeable' },
        ],
        correctOptionId: 'qeff-context',
        sourceRecordIds: ['DOSE-PM-001', 'DEV-PF-006', 'CONFLICT-010'],
      }),
      domain({
        id: 'pressure-localization',
        sharedClinicalGoal:
          'Use direction, operating context, circuit inspection, and reassessment to localize a problem.',
        prismaxExpression: 'PrisMax pressure labels and manual-reference displayed calculations.',
        prismaflexExpression:
          'Prismaflex pressure labels and distinct hydrostatic display corrections.',
        transferPrompt: 'What clinical reasoning stays the same?',
        options: [
          { id: 'pressure-reasoning', label: 'Causal localization and verification' },
          { id: 'pressure-number', label: 'One numeric display copied across devices' },
        ],
        correctOptionId: 'pressure-reasoning',
        sourceRecordIds: ['DEV-PM-009', 'DEV-PM-010', 'DEV-PF-005', 'DEV-PF-006'],
      }),
      domain({
        id: 'fluid-accounting',
        sharedClinicalGoal:
          'Keep machine removal, device variance, external inputs/outputs, and whole-patient balance distinct.',
        prismaxExpression: 'PrisMax bag/scale and machine-removal presentation.',
        prismaflexExpression: 'Prismaflex four-scale layout and device-fluid presentation.',
        transferPrompt: 'Which quantity should not be collapsed?',
        options: [
          { id: 'fluid-ledgers', label: 'Machine and whole-patient ledgers remain separate' },
          { id: 'fluid-one', label: 'The device value is the complete patient balance' },
        ],
        correctOptionId: 'fluid-ledgers',
        sourceRecordIds: ['FLUID-PM-001', 'DEV-PM-013', 'DEV-PF-003'],
      }),
      domain({
        id: 'alarm-stop-end',
        sharedClinicalGoal:
          'Assess safety, identify the device response, inspect the cause, verify correction, and reassess.',
        prismaxExpression: 'PrisMax curriculum alarm mappings and stop/end framing.',
        prismaflexExpression:
          'Prismaflex Warning/Malfunction/Caution/Advisory help behavior and stop/end framing.',
        transferPrompt: 'What is the safe transfer principle?',
        options: [
          {
            id: 'alarm-cause-first',
            label: 'Transfer cause-first reasoning and relearn device controls',
          },
          { id: 'alarm-identical', label: 'Assume alarm priority and controls are identical' },
        ],
        correctOptionId: 'alarm-cause-first',
        sourceRecordIds: ['DEV-PM-008', 'DEV-PM-014', 'DEV-PF-007', 'DEV-PF-008'],
      }),
    ]),
  },
)

export const baxterCrrtCrossDeviceTransferReviewArtifact = baxterCrrtCrossDeviceTransferCapstone

export function scoreBaxterCrrtCrossDeviceTransfer(
  answers: Readonly<Partial<Record<CrrtCrossDeviceTransferDomainId, string>>>,
): { readonly score: number; readonly passed: boolean; readonly completed: boolean } {
  const domains = baxterCrrtCrossDeviceTransferCapstone.domains
  const correct = domains.filter((item) => answers[item.id] === item.correctOptionId).length
  const completed = domains.every((item) => typeof answers[item.id] === 'string')
  const score = Math.round((correct / domains.length) * 100)
  return Object.freeze({
    score,
    passed: completed && score >= baxterCrrtCrossDeviceTransferCapstone.minimumScore,
    completed,
  })
}
