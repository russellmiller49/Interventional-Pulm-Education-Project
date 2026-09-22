/**
 * MV-PRE-REVIEW-02 causal inventory: every live case, replayed through the real reducer from a
 * fresh deterministic start, sampled at fixed **model** times, one arm per action history.
 *
 * Nothing here is a target. The numbers are what the engine does, recorded so that a change to the
 * model can be compared with what it replaced at identical elapsed model time, from the same start
 * state, with the same inputs. A playback speed is only a schedule for handing time to the engine:
 * the reducer's `TICK` multiplies its seconds by `state.speed`, so 1×, 5× and 30× are the same
 * model with 0.1 s, 0.5 s and 3 s handed over per tick.
 *
 * Deliberately engine-level. The browser adds a requestAnimationFrame/interval schedule on top,
 * and a hidden tab suspends it; neither is physiology and neither is exercised here.
 */
import { mechanicalVentilationCaseById, mechanicalVentilationCases } from '../content/runtimeCases'
import { patientReportAvailability } from '../content/patientReport'
import { plateauAcquisition } from '../content/plateauAcquisition'
import { arterialGasView } from '../engine/arterialGas'
import {
  observedPeakAirwayPressureCmH2O,
  observedTidalVolumeMl,
  deriveEffectivePatient,
} from '../engine/physics'
import { ventilationSimulationReducer } from '../engine/reducer'
import { createInitialSimulationState } from '../engine/simulation'
import { triggerDelayEvidence } from '../engine/triggerEvidence'
import type {
  SimulationSpeed,
  VentilationAction,
  VentilationSimulationState,
  VentilatorDeviceId,
} from '../engine/types'

/** Held from live construction; never replayed here as a live case. */
export const HELD_CASE_IDS = ['MV-03'] as const

export function liveCaseIds(): string[] {
  return mechanicalVentilationCases
    .map((definition) => definition.id)
    .filter((id) => !(HELD_CASE_IDS as readonly string[]).includes(id))
}

/** The attempt number whose seeded branch is `branch`, searched the way `lessonRuntime` does. */
export function attemptForBranch(
  caseId: string,
  branch: string,
  deviceId: VentilatorDeviceId = 'hamilton-c6',
): number {
  for (let attempt = 1; attempt < 200; attempt += 1) {
    if (createInitialSimulationState(caseId, 'practice', attempt, deviceId).branch === branch) {
      return attempt
    }
  }
  throw new Error(`${caseId}: no attempt selects branch ${branch}`)
}

export interface TimedAction {
  readonly at: number
  readonly label: string
  readonly action: VentilationAction
}

export interface InventoryArm {
  readonly id: string
  readonly label: string
  readonly actions: readonly TimedAction[]
}

export interface InventorySnapshot {
  readonly t: number
  readonly branch: string
  readonly settings: Record<string, number | string | boolean>
  readonly airway: Record<string, boolean>
  readonly mechanics: { complianceMlCmH2O: number; resistanceCmH2OPerLps: number }
  readonly breath: {
    readonly exhaledVtMl: number
    /** 'trace' = a completed inflation in the buffer; 'predicted' = the analytic fallback. */
    readonly exhaledVtSource: 'trace' | 'predicted'
    /** Earliest sample time in the buffer; negative = primed history before the case opened. */
    readonly bufferStartsAt: number | null
    readonly totalRatePerMin: number
    readonly peakCmH2O: number
    readonly peakSource: 'trace' | 'predicted'
    readonly plateauEstimateCmH2O: number
    readonly plateauStatus: string
    readonly intrinsicPeepCmH2O: number
    readonly minuteVentilationLMin: number
    readonly triggerEvidence: string
  }
  readonly gas: {
    readonly pH: number
    readonly paCO2: number
    readonly hco3: number
    readonly paO2: number
    readonly spo2: number
    readonly shunt: number
  }
  readonly sampledAbg: readonly {
    id: string
    pending: boolean
    values: { pH: number; paCO2MmHg: number; paO2MmHg: number; bicarbonateMmolL: number } | null
  }[]
  readonly hemodynamics: { map: number; sbp: number; dbp: number; hr: number }
  readonly human: {
    dyspnea: number
    pain: number
    anxiety: number
    delirium: number
    rass: number
    canCommunicate: boolean
    reportability: string
  }
  readonly alarms: readonly string[]
  readonly highPressureLimitCmH2O: number
  readonly risk: Record<string, number>
  readonly criticalErrors: readonly string[]
  readonly actions: readonly string[]
}

function r(value: number, places = 1): number {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

function settingsSummary(state: VentilationSimulationState) {
  const s = state.ventilator.settings
  const summary: Record<string, number | string | boolean> = {
    mode: s.deviceMode,
    fio2: s.oxygenPercent,
    peep: s.peepCmH2O,
    highPressureLimit: s.highPressureLimitCmH2O,
  }
  if (s.mode === 'volume-ac') {
    Object.assign(summary, {
      vt: s.vtMl,
      rate: s.ratePerMin,
      peakFlow: s.peakFlowLMin,
      pattern: s.flowPattern,
    })
  } else if (s.mode === 'pressure-ac') {
    Object.assign(summary, { deltaP: s.deltaPControlCmH2O, rate: s.ratePerMin })
  } else {
    Object.assign(summary, { ps: s.pressureSupportCmH2O, ets: s.etsPercent, pRamp: s.pRampMs })
  }
  return summary
}

export function inventorySnapshot(state: VentilationSimulationState): InventorySnapshot {
  const definition = mechanicalVentilationCaseById.get(state.caseId)!
  const effective = deriveEffectivePatient(state, definition)
  const m = state.measurements
  const observedVt = observedTidalVolumeMl(state.waveforms)
  const observedPeak = observedPeakAirwayPressureCmH2O(state.waveforms)
  const gasView = arterialGasView(state.arterialGasSamples, state.simulationTime)
  return {
    t: r(state.simulationTime, 2),
    branch: state.branch,
    settings: settingsSummary(state),
    airway: { ...state.patient.airway },
    mechanics: {
      complianceMlCmH2O: r(effective.mechanics.complianceLPerCmH2O * 1000, 1),
      resistanceCmH2OPerLps: r(effective.mechanics.resistanceCmH2OPerLps, 1),
    },
    breath: {
      exhaledVtMl: m.exhaledVtMl,
      exhaledVtSource: observedVt === undefined ? 'predicted' : 'trace',
      bufferStartsAt: state.waveforms[0] ? r(state.waveforms[0].time, 2) : null,
      totalRatePerMin: m.totalRatePerMin,
      peakCmH2O: m.peakPressureCmH2O,
      peakSource: observedPeak === undefined ? 'predicted' : 'trace',
      plateauEstimateCmH2O: m.plateauPressureCmH2O,
      plateauStatus: plateauAcquisition(state).status,
      intrinsicPeepCmH2O: m.intrinsicPeepCmH2O,
      minuteVentilationLMin: m.minuteVentilationLMin,
      triggerEvidence: triggerDelayEvidence(state).status,
    },
    gas: {
      pH: r(state.patient.gasExchange.pH, 3),
      paCO2: r(state.patient.gasExchange.paCO2MmHg, 1),
      hco3: r(state.patient.gasExchange.bicarbonateMmolL, 1),
      paO2: r(state.patient.gasExchange.paO2MmHg, 1),
      spo2: r(state.patient.gasExchange.spo2Percent, 1),
      shunt: r(effective.gasExchange.shuntFraction, 3),
    },
    sampledAbg: gasView.all.map((sample) => {
      const pending = gasView.pendingAll.includes(sample)
      return {
        id: sample.id,
        pending,
        values: pending
          ? null
          : {
              pH: r(sample.values.pH, 3),
              paCO2MmHg: r(sample.values.paCO2MmHg, 1),
              paO2MmHg: r(sample.values.paO2MmHg, 1),
              bicarbonateMmolL: r(sample.values.bicarbonateMmolL, 1),
            },
      }
    }),
    hemodynamics: {
      map: r(state.patient.hemodynamics.mapMmHg, 1),
      sbp: state.patient.hemodynamics.systolicMmHg,
      dbp: state.patient.hemodynamics.diastolicMmHg,
      hr: r(state.patient.hemodynamics.heartRatePerMin, 0),
    },
    human: {
      dyspnea: r(state.patient.human.dyspneaScore, 1),
      pain: r(state.patient.human.painScore, 1),
      anxiety: r(state.patient.human.anxietyScore, 1),
      delirium: r(state.patient.human.deliriumScore, 1),
      rass: state.patient.human.sedationScore,
      canCommunicate: state.patient.human.canCommunicate,
      reportability: patientReportAvailability(state).availability,
    },
    alarms: state.alarms.map((alarm) => alarm.code),
    highPressureLimitCmH2O: state.ventilator.settings.highPressureLimitCmH2O,
    risk: Object.fromEntries(Object.entries(state.risk).map(([k, v]) => [k, r(v, 1)])),
    criticalErrors: [...state.criticalErrors],
    actions: state.interventions.map((record) => `${record.interventionId}@${r(record.time, 1)}`),
  }
}

export interface ArmRun {
  readonly caseId: string
  readonly branch: string
  readonly attempt: number
  readonly deviceId: VentilatorDeviceId
  readonly speed: SimulationSpeed
  readonly arm: InventoryArm
  readonly snapshots: readonly InventorySnapshot[]
  /** Model time at which the buffer first held a completed inflation from inside the case. */
  readonly firstInCaseInflationAt: number | null
}

/**
 * Plays an arm through the reducer exactly as the Practice page does — un-pause, speed, a fixed
 * tick — applying each action at its model time and snapshotting at each requested model time.
 *
 * `tickSeconds` is the wall-clock tick (0.1 s in the page); model time per tick is that times the
 * speed. Action and sample times must be multiples of the model time per tick.
 */
export function runInventoryArm(args: {
  caseId: string
  arm: InventoryArm
  sampleTimes: readonly number[]
  attempt?: number
  branch?: string
  deviceId?: VentilatorDeviceId
  speed?: SimulationSpeed
  tickSeconds?: number
  experience?: 'practice' | 'learn'
}): ArmRun {
  const deviceId = args.deviceId ?? 'hamilton-c6'
  const attempt =
    args.attempt ?? (args.branch ? attemptForBranch(args.caseId, args.branch, deviceId) : 1)
  const speed = args.speed ?? 1
  const tick = args.tickSeconds ?? 0.1
  let state = createInitialSimulationState(
    args.caseId,
    args.experience ?? 'practice',
    attempt,
    deviceId,
  )
  const snapshots: InventorySnapshot[] = []
  const end = Math.max(...args.sampleTimes, ...args.arm.actions.map((a) => a.at))
  const pendingActions = [...args.arm.actions].sort((a, b) => a.at - b.at)
  const pendingSamples = [...args.sampleTimes].sort((a, b) => a - b)
  let firstInCaseInflationAt: number | null = null
  const epsilon = 1e-6
  const settle = () => {
    while (pendingActions.length && pendingActions[0].at <= state.simulationTime + epsilon) {
      state = ventilationSimulationReducer(state, pendingActions.shift()!.action)
    }
    while (pendingSamples.length && pendingSamples[0] <= state.simulationTime + epsilon) {
      pendingSamples.shift()
      snapshots.push(inventorySnapshot(state))
    }
  }
  settle()
  state = ventilationSimulationReducer(state, { type: 'SET_SPEED', speed })
  state = ventilationSimulationReducer(state, { type: 'SET_PAUSED', paused: false })
  while (state.simulationTime < end - epsilon) {
    state = ventilationSimulationReducer(state, { type: 'TICK', seconds: tick })
    if (firstInCaseInflationAt === null) {
      const inCase = state.waveforms.filter((sample) => sample.time > 0)
      if (observedTidalVolumeMl(inCase) !== undefined)
        firstInCaseInflationAt = r(state.simulationTime, 2)
    }
    settle()
  }
  return {
    caseId: args.caseId,
    branch: state.branch,
    attempt,
    deviceId,
    speed,
    arm: args.arm,
    snapshots,
    firstInCaseInflationAt,
  }
}

const control = (
  at: number,
  control: Extract<VentilationAction, { type: 'SET_CONTROL' }>['control'],
  value: number | string | boolean,
): TimedAction => ({
  at,
  label: `${control}=${String(value)}`,
  action: { type: 'SET_CONTROL', control, value },
})
const perform = (at: number, interventionId: string): TimedAction => ({
  at,
  label: interventionId,
  action: { type: 'PERFORM_INTERVENTION', interventionId },
})

export const NO_ACTION: InventoryArm = { id: 'no-action', label: 'No action', actions: [] }
export const ASSESSMENT_ONLY: InventoryArm = {
  id: 'assessment-only',
  label: 'Assess the patient and review waveforms only',
  actions: [perform(12, 'assess-patient'), perform(12, 'review-waveforms')],
}

/**
 * The arms compared per priority case, each starting at model time 12 s from the same state.
 * "Appropriate" follows the case's own authored success criteria and required actions; nothing
 * here asserts that the modeled response to it is clinically right.
 */
export function caseArms(caseId: string, branch: string): InventoryArm[] {
  const at = 12
  const arms: InventoryArm[] = [NO_ACTION, ASSESSMENT_ONLY]
  switch (caseId) {
    case 'MV-01':
      arms.push(
        {
          id: 'peep-10',
          label: 'PEEP 5 → 10 (authored 8–12 band)',
          actions: [control(at, 'peepCmH2O', 10)],
        },
        { id: 'peep-13', label: 'PEEP 5 → 13', actions: [control(at, 'peepCmH2O', 13)] },
        {
          id: 'peep-16',
          label: 'PEEP 5 → 16 (authored overdistension band)',
          actions: [control(at, 'peepCmH2O', 16)],
        },
        {
          id: 'fio2-100',
          label: 'FiO₂ 60 → 100 only',
          actions: [control(at, 'oxygenPercent', 100)],
        },
      )
      break
    case 'MV-02':
      arms.push(
        {
          id: 'flow-70',
          label: 'Peak flow 40 → 70 + treat drive',
          actions: [control(at, 'peakFlowLMin', 70), perform(at, 'treat-drive')],
        },
        {
          id: 'treat-drive-only',
          label: 'Treat drive only (flow unchanged)',
          actions: [perform(at, 'treat-drive')],
        },
      )
      break
    case 'MV-05':
      arms.push(
        {
          id: 'ps-ets',
          label: 'PS 18 → 12, ETS 25 → 40, expiratory hold',
          actions: [
            control(at, 'pressureSupportCmH2O', 12),
            control(at, 'etsPercent', 40),
            perform(at, 'expiratory-hold'),
          ],
        },
        {
          id: 'ps-up',
          label: 'PS 18 → 24 (more support; harmful direction)',
          actions: [control(at, 'pressureSupportCmH2O', 24)],
        },
      )
      break
    case 'MV-06':
      arms.push(
        {
          id: 'bag-bronchodilator-rate',
          label: 'Disconnect/bag + bronchodilator + rate 24 → 10, flow 50 → 80',
          actions: [
            perform(at, 'disconnect-bag'),
            perform(at, 'bronchodilator'),
            control(at, 'ratePerMin', 10),
            control(at, 'peakFlowLMin', 80),
          ],
        },
        {
          id: 'rate-up',
          label: 'Rate 24 → 30 (harmful direction)',
          actions: [control(at, 'ratePerMin', 30)],
        },
      )
      break
    case 'MV-08': {
      const fix =
        branch === 'condensate'
          ? [perform(at, 'inspect-circuit'), perform(at + 21, 'drain-condensate')]
          : branch === 'leak'
            ? [perform(at, 'inspect-circuit'), perform(at + 21, 'correct-leak')]
            : [perform(at, 'inspect-circuit'), control(at, 'triggerThreshold', 2)]
      arms.push({ id: 'localize-and-fix', label: `Inspect + fix (${branch})`, actions: fix })
      break
    }
    case 'MV-12':
      arms.push(
        {
          id: 'reduce-assist',
          label: 'PS 22 → 11 + reduce sedation',
          actions: [control(at, 'pressureSupportCmH2O', 11), perform(at, 'reduce-sedation')],
        },
        {
          id: 'reduce-sedation-only',
          label: 'Reduce sedation only',
          actions: [perform(at, 'reduce-sedation')],
        },
      )
      break
    case 'MV-13': {
      const matching =
        branch === 'secretions'
          ? 'suction-airway'
          : branch === 'hme-or-ett'
            ? 'remove-hme'
            : 'bronchodilator'
      const wrong = branch === 'bronchospasm' ? 'suction-airway' : 'bronchodilator'
      arms.push(
        {
          id: 'matching-treatment',
          label: `Inspect circuit + ${matching}`,
          actions: [perform(at, 'inspect-circuit'), perform(at + 21, matching)],
        },
        {
          id: 'wrong-treatment',
          label: `${wrong} (does not reach this branch)`,
          actions: [perform(at, wrong)],
        },
      )
      break
    }
    case 'MV-14':
      arms.push(
        {
          id: 'decompress',
          label: 'Decompress + pleural drainage',
          actions: [perform(at, 'decompress-pneumothorax'), perform(at + 16, 'pleural-drainage')],
        },
        {
          id: 'bag-only',
          label: 'Disconnect and bag only (no decompression)',
          actions: [perform(at, 'disconnect-bag')],
        },
      )
      break
    case 'MV-15':
      arms.push(
        {
          id: 'ask-and-treat',
          label: 'Communication board + treat pain + relieve bladder + PS 11, P-ramp 100',
          actions: [
            perform(at, 'communication-board'),
            perform(at, 'treat-pain'),
            perform(at, 'relieve-bladder'),
            control(at, 'pressureSupportCmH2O', 11),
            control(at, 'pRampMs', 100),
          ],
        },
        {
          id: 'deepen-sedation',
          label: 'Deepen sedation (unsafe)',
          actions: [perform(at, 'deepen-sedation')],
        },
      )
      break
    default:
      break
  }
  return arms
}

export const PRIORITY_CASE_IDS = [
  'MV-01',
  'MV-02',
  'MV-05',
  'MV-06',
  'MV-08',
  'MV-12',
  'MV-13',
  'MV-14',
  'MV-15',
] as const

export const INVENTORY_TIMES = [0, 30, 60, 150, 180] as const
