import type { CrrtEngineFaultId } from '../engine/types'
import { CRRT_RAPID_DRILL_ARTIFACT_IDS } from './artifactRegistry'
import { BAXTER_CRRT_CONTENT_VERSION } from './versions'

export const CRRT_RAPID_DRILL_IDS = CRRT_RAPID_DRILL_ARTIFACT_IDS
export type CrrtRapidDrillId = (typeof CRRT_RAPID_DRILL_IDS)[number]

export interface CrrtRapidDrillPredictionOption {
  readonly id: string
  readonly disposition: 'safe' | 'accepted-alternative' | 'unsafe'
  readonly label: string
  readonly description: string
}

export interface CrrtRapidDrillDefinition {
  readonly id: CrrtRapidDrillId
  readonly contentVersion: typeof BAXTER_CRRT_CONTENT_VERSION
  readonly title: string
  readonly engineFaultIds: readonly CrrtEngineFaultId[]
  readonly openingSignal: string
  readonly predictionPrompt: string
  readonly predictionOptions: readonly CrrtRapidDrillPredictionOption[]
  readonly candidateCauseOptionId: string
  readonly acceptedAlternativeOptionId: string
  readonly unsafeOptionId: string
  readonly criticalErrorCandidate: string
  readonly deviceResponseBoundary: string
  readonly inspectionDomain: string
  readonly correctionBoundary: string
  readonly reassessmentDomain: string
  readonly sourceRecordIds: readonly string[]
  readonly reviewStatus: 'pending'
  readonly learnerRunnable: true
  readonly runnable: true
  readonly scoringAvailable: true
  readonly analyticsAvailable: true
  readonly progressPersistenceAvailable: true
  readonly competencyAvailable: false
}

interface DrillSeed {
  readonly id: CrrtRapidDrillId
  readonly title: string
  readonly engineFaultIds: readonly CrrtEngineFaultId[]
  readonly openingSignal: string
  readonly safeLabel: string
  readonly alternativeLabel: string
  readonly unsafeLabel: string
  readonly inspectionDomain: string
  readonly correctionBoundary: string
  readonly reassessmentDomain: string
  readonly sourceRecordIds: readonly string[]
}

const seeds: readonly DrillSeed[] = [
  {
    id: 'DRILL-AIR',
    title: 'Air detection',
    engineFaultIds: ['air-detected'],
    openingSignal: 'An air-detection signal interrupts the simulated treatment.',
    safeLabel: 'Assess the patient and inspect the return line, detector, clamp, and circuit',
    alternativeLabel: 'Keep therapy stopped and escalate when the cause cannot be verified',
    unsafeLabel: 'Acknowledge the signal and continue without inspection',
    inspectionDomain: 'patient, return line, detector, clamp, and visible circuit',
    correctionBoundary:
      'This drill does not teach air removal or restart. Use current device instructions and local policy.',
    reassessmentDomain: 'patient safety, circuit state, delivery, interruption, and recurrence',
    sourceRecordIds: ['DEV-PM-008', 'SYNTH-DRILL-AIR-001'],
  },
  {
    id: 'DRILL-BLOOD-LEAK',
    title: 'Blood-leak detection',
    engineFaultIds: ['blood-leak-detected'],
    openingSignal: 'A blood-leak detection signal produces a safety stop.',
    safeLabel: 'Assess the patient and inspect the filter, effluent, detector, and circuit',
    alternativeLabel: 'Maintain the safety stop and escalate when the signal remains unresolved',
    unsafeLabel: 'Reset repeatedly until the message disappears',
    inspectionDomain: 'patient, filter, effluent path, detector, and circuit integrity',
    correctionBoundary:
      'Disposition and restart decisions remain device-instruction and local-policy matters.',
    reassessmentDomain: 'patient safety, filter/effluent state, delivery, and recurrence',
    sourceRecordIds: ['DEV-PM-008', 'SYNTH-DRILL-BLOOD-LEAK-001'],
  },
  {
    id: 'DRILL-GAIN-LOSS',
    title: 'Fluid gain or loss',
    engineFaultIds: ['fluid-gain-loss'],
    openingSignal:
      'A device-fluid variance appears while whole-patient fluid balance remains a separate calculation.',
    safeLabel: 'Separate device variance from the complete patient fluid ledger',
    alternativeLabel: 'Pause delivery and escalate while preserving both ledgers',
    unsafeLabel: 'Treat the device signal as the whole-patient balance',
    inspectionDomain: 'pumps, scales, bags, lines, device variance, and patient inputs/outputs',
    correctionBoundary:
      'Override limits, catch-up behavior, and restart steps depend on the device and local policy.',
    reassessmentDomain: 'device variance, patient balance, delivery, downtime, and recurrence',
    sourceRecordIds: ['DEV-PM-012', 'SYNTH-DRILL-GAIN-LOSS-001'],
  },
  {
    id: 'DRILL-BAG-SCALE',
    title: 'Bag or scale error',
    engineFaultIds: ['supply-bag-empty', 'effluent-bag-full', 'scale-open'],
    openingSignal: 'A bag or scale problem interrupts fluid delivery.',
    safeLabel: 'Verify bag identity, line path, scale position, connection, and measured state',
    alternativeLabel:
      'Keep treatment paused and escalate when the correct bag or scale state cannot be verified',
    unsafeLabel: 'Swap any bag and restart without verification',
    inspectionDomain: 'selected bag, connected line, assigned scale, clamp, and neighboring bags',
    correctionBoundary:
      'Confirm the bag, line, and scale assignment using current device instructions and local policy before resuming.',
    reassessmentDomain: 'bag/scale topology, fluid delivery, variance, and recurrence',
    sourceRecordIds: ['DEV-PM-013', 'SYNTH-DRILL-BAG-SCALE-001'],
  },
  {
    id: 'DRILL-POWER',
    title: 'Power interruption',
    engineFaultIds: ['power-interruption'],
    openingSignal: 'A power interruption pauses treatment delivery.',
    safeLabel: 'Assess patient, power, device state, circuit, downtime, and delivery',
    alternativeLabel:
      'Keep treatment paused and escalate if safe recovery steps cannot be verified',
    unsafeLabel: 'Resume immediately because power is visible',
    inspectionDomain: 'patient, power source, device state, circuit, downtime, and messages',
    correctionBoundary:
      'Battery duration, recovery, and restart instructions remain device- and configuration-specific.',
    reassessmentDomain: 'patient, device/circuit readiness, delivered therapy, and recurrence',
    sourceRecordIds: ['DEV-PM-008', 'SYNTH-DRILL-POWER-001'],
  },
  {
    id: 'DRILL-WRONG-SOLUTION',
    title: 'Wrong solution verification',
    engineFaultIds: [],
    openingSignal:
      'An independent check finds that a solution label does not match the treatment plan.',
    safeLabel: 'Stop, isolate the mismatch, verify the order and labels, and escalate',
    alternativeLabel: 'Keep therapy paused until an authorized local verification is available',
    unsafeLabel: 'Assume similar packaging means the solution is interchangeable',
    inspectionDomain:
      'order, bag label, line destination, set compatibility, and independent check',
    correctionBoundary:
      'Follow the local mismatch procedure; this drill does not recommend a substitute solution.',
    reassessmentDomain:
      'patient, exposure history, verified configuration, communication, and follow-up',
    sourceRecordIds: ['DEV-PM-013', 'GUID-RRT-ICU-2026'],
  },
  {
    id: 'DRILL-BLOOD-RETURN',
    title: 'Blood-disposition decision',
    engineFaultIds: [],
    openingSignal:
      'An end-of-treatment scenario requires a blood-disposition decision with incomplete context.',
    safeLabel:
      'Stop, verify patient/circuit context, and escalate to device instructions and local policy',
    alternativeLabel:
      'Maintain the safe stopped state until the responsible clinician resolves the decision',
    unsafeLabel: 'Choose return or discard from the simulator alone',
    inspectionDomain:
      'patient status, circuit integrity, clot/air concerns, stop/end state, and policy',
    correctionBoundary:
      'The drill teaches verification and escalation, never a universal return/discard instruction.',
    reassessmentDomain:
      'patient, circuit disposition, treatment closure, documentation, and escalation',
    sourceRecordIds: ['DEV-PM-014', 'GUID-RRT-ICU-2026'],
  },
]

function freezeDrill(seed: DrillSeed): CrrtRapidDrillDefinition {
  const prefix = seed.id.toLowerCase()
  return Object.freeze({
    ...seed,
    contentVersion: BAXTER_CRRT_CONTENT_VERSION,
    predictionPrompt: 'Which cause-first response best preserves patient safety and verification?',
    predictionOptions: Object.freeze([
      Object.freeze({
        id: `${prefix}-safe`,
        disposition: 'safe' as const,
        label: seed.safeLabel,
        description: 'Safe path: assess, inspect, verify, communicate, and reassess.',
      }),
      Object.freeze({
        id: `${prefix}-alternative`,
        disposition: 'accepted-alternative' as const,
        label: seed.alternativeLabel,
        description: 'Accepted alternative: preserve the safe state and escalate uncertainty.',
      }),
      Object.freeze({
        id: `${prefix}-unsafe`,
        disposition: 'unsafe' as const,
        label: seed.unsafeLabel,
        description:
          'Unsafe because it bypasses assessment or verification and may delay correction of the cause.',
      }),
    ]),
    candidateCauseOptionId: `${prefix}-safe`,
    acceptedAlternativeOptionId: `${prefix}-alternative`,
    unsafeOptionId: `${prefix}-unsafe`,
    criticalErrorCandidate:
      'Continuing or making a disposition decision without required patient assessment, verification, and escalation.',
    deviceResponseBoundary:
      'Device wording and screen presentation may differ. Follow current device instructions and local policy for exact actions.',
    sourceRecordIds: Object.freeze([...seed.sourceRecordIds]),
    engineFaultIds: Object.freeze([...seed.engineFaultIds]),
    reviewStatus: 'pending' as const,
    learnerRunnable: true as const,
    runnable: true as const,
    scoringAvailable: true as const,
    analyticsAvailable: true as const,
    progressPersistenceAvailable: true as const,
    competencyAvailable: false as const,
  })
}

export const baxterCrrtRapidDrills: readonly CrrtRapidDrillDefinition[] = Object.freeze(
  seeds.map(freezeDrill),
)

export const baxterCrrtRapidDrillManifest = baxterCrrtRapidDrills

if (baxterCrrtRapidDrills.map((drill) => drill.id).join('|') !== CRRT_RAPID_DRILL_IDS.join('|')) {
  throw new Error('CRRT rapid-drill registry must contain every stable drill exactly once.')
}

export function getBaxterCrrtRapidDrill(drillId: CrrtRapidDrillId): CrrtRapidDrillDefinition {
  const drill = baxterCrrtRapidDrills.find((candidate) => candidate.id === drillId)
  if (!drill) throw new Error(`Unknown CRRT rapid drill: ${drillId}`)
  return drill
}

export function isBaxterCrrtRapidDrillId(value: string): value is CrrtRapidDrillId {
  return (CRRT_RAPID_DRILL_IDS as readonly string[]).includes(value)
}
