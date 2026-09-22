import { createInitialSimulationState, ecmoSimulationReducer } from '../engine'
import type { EcmoSimulationState, SimulationAction } from '../engine/types'

/**
 * ECMO-FELLOW-02's portable causal harness.
 *
 * Every case is replayed through the real reducer on the model's own clock — never wall time, never
 * a sleep — along up to four matched paths:
 *
 * - **A** time only: load, then the clock alone.
 * - **B** an assessment or diagnostic action only, then the same clock.
 * - **C** the intended treatment at a stated modeled second, then the same horizon.
 * - **D** a reported harmful or ineffective action, then recovery where the case offers one.
 *
 * Actions are recorded as their own rows at an unchanged simulation time, apart from the clock rows,
 * so the immediate consequence of an action and what the case did over the following seconds are
 * never merged. Sample times are modeled seconds and the rows say so; they are compressed simulation
 * steps, not bedside time.
 *
 * The same module drives the regression tests and the committed trajectory results, so the numbers in
 * the handoff are the numbers the tests assert against. It imports nothing that did not already exist
 * before ECMO-FELLOW-02 other than the plans themselves, which is what lets the identical plans run
 * against the baseline checkout for the failing-before evidence.
 */

export type CausalPathId = 'A' | 'B' | 'C' | 'D'

export type CausalStep =
  | { readonly action: SimulationAction; readonly label?: string }
  | { readonly seconds: number }

export interface CausalPlan {
  readonly id: CausalPathId
  readonly label: string
  readonly steps: readonly CausalStep[]
}

export interface CausalReading {
  readonly t: number
  readonly spo2: number
  readonly femoral: number | null
  readonly paCO2: number
  readonly pH: number
  readonly map: number
  readonly cvp: number
  readonly heartRate: number
  readonly pulsePressure: number | null
  readonly nativeOutput: number | null
  readonly lactate: number
  readonly urineOutput: number
  readonly respiratoryRate: number
  readonly workOfBreathing: string
  readonly airwayPressure: number
  readonly limb: string | null
  readonly limbNirs: number | null
  readonly flow: number
  readonly pVen: number | null
  readonly preOxygenator: number
  readonly postOxygenator: number
  readonly recirculation: number
  readonly hemoglobin: number
  readonly pumpRunning: boolean
  readonly rpm: number
  readonly alarms: string
}

export interface CausalRow extends CausalReading {
  readonly kind: 'load' | 'action' | 'tick'
  readonly label: string
}

export function causalReading(state: EcmoSimulationState): CausalReading {
  const { patient, circuit, device } = state
  const va = state.supportMode === 'va'
  return {
    t: state.simulationTime,
    spo2: va ? patient.rightRadialSpo2 : patient.spo2,
    femoral: va ? patient.femoralArterialSpo2 : null,
    paCO2: patient.paCO2,
    pH: patient.pH,
    map: patient.meanArterialPressure,
    cvp: patient.centralVenousPressure,
    heartRate: patient.heartRate,
    pulsePressure: va ? patient.pulsePressure : null,
    nativeOutput: va ? patient.nativeCardiacOutputLpm : null,
    lactate: patient.lactate,
    urineOutput: patient.urineOutputMlHr,
    respiratoryRate: patient.respiratoryRate,
    workOfBreathing: patient.workOfBreathing,
    airwayPressure: patient.airwayPressure,
    limb: va ? patient.distalLimbPerfusion : null,
    limbNirs: va ? patient.distalLimbNirs : null,
    flow: circuit.bloodFlow,
    pVen: circuit.readouts.pVen.displayed,
    preOxygenator: circuit.preOxygenatorSaturation,
    postOxygenator: circuit.postOxygenatorSaturation,
    recirculation: circuit.recirculationFraction,
    hemoglobin: circuit.hemoglobin,
    pumpRunning: device.pumpRunning,
    rpm: device.rpmSetpoint,
    alarms: state.alarms.map((alarm) => alarm.code).join('+'),
  }
}

/** The modeled seconds every trajectory is sampled at. Matched across paths within a case. */
export const CAUSAL_SAMPLE_SECONDS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25]

function actionLabel(action: SimulationAction): string {
  switch (action.type) {
    case 'APPLY_CLINICAL_INTERVENTION':
      return `card:${action.interventionId}`
    case 'SET_RPM':
      return `rpm:${action.rpm}`
    case 'SET_SWEEP':
      return `sweep:${action.sweep}`
    case 'SET_GAS_FIO2':
      return `fio2:${action.fio2}`
    case 'TOGGLE_CIRCUIT_CLAMP':
      return `clamp:${action.limb}:${action.closed === false ? 'open' : 'closed'}`
    case 'CORRECT_FAULT':
      return `correct:${action.fault}`
    default:
      return action.type
  }
}

export interface CausalRun {
  readonly rows: readonly CausalRow[]
  readonly final: EcmoSimulationState
}

/**
 * Replays one plan. The case is loaded guided (paused, as Practice opens it) and entered with
 * `START_ACTIVITY`, which changes no physiology; every clock second is an explicit `STEP`.
 */
export function runCausalPlan(
  scenarioId: string,
  plan: CausalPlan,
  sampleSeconds: readonly number[] = CAUSAL_SAMPLE_SECONDS,
): CausalRun {
  let state = ecmoSimulationReducer(createInitialSimulationState(scenarioId, 'guided'), {
    type: 'START_ACTIVITY',
  })
  const rows: CausalRow[] = [{ kind: 'load', label: 'load', ...causalReading(state) }]
  for (const step of plan.steps) {
    if ('seconds' in step) {
      for (let index = 0; index < step.seconds; index += 1) {
        state = ecmoSimulationReducer(state, { type: 'STEP' })
        if (sampleSeconds.includes(state.simulationTime)) {
          rows.push({ kind: 'tick', label: 'tick', ...causalReading(state) })
        }
      }
    } else {
      state = ecmoSimulationReducer(state, step.action)
      rows.push({
        kind: 'action',
        label: step.label ?? actionLabel(step.action),
        ...causalReading(state),
      })
    }
  }
  return { rows, final: state }
}

/** The reading at a modeled second on a plan's clock rows (the load row counts as t = 0). */
export function readingAt(run: CausalRun, t: number): CausalRow | undefined {
  const atTime = run.rows.filter((row) => row.t === t)
  return atTime.at(-1)
}

const card = (interventionId: string): CausalStep => ({
  action: { type: 'APPLY_CLINICAL_INTERVENTION', interventionId },
})
const act = (action: SimulationAction): CausalStep => ({ action })
const wait = (seconds: number): CausalStep => ({ seconds })

const HORIZON = 25

/**
 * The finite set of paths per case. Canonical registry ids, in the menu order the walkthrough's
 * case numbers refer to (VV 1–7, VA 1–7, then the two integrated cases).
 */
export const ECMO_CAUSAL_PLANS: Readonly<Record<string, readonly CausalPlan[]>> = {
  // C1
  'clinical-vv-initiation-ards': [
    { id: 'A', label: 'time only', steps: [wait(HORIZON)] },
    { id: 'B', label: 'readiness check only', steps: [card('vv-readiness-check'), wait(HORIZON)] },
    {
      id: 'C',
      label: 'readiness, connect, ordered settings, start at 0 s',
      steps: [
        card('vv-readiness-check'),
        card('vv-connect-circuit'),
        act({ type: 'SET_RPM', rpm: 3200 }),
        act({ type: 'SET_SWEEP', sweep: 4 }),
        act({ type: 'SET_GAS_FIO2', fio2: 1 }),
        act({ type: 'START_ECMO' }),
        wait(HORIZON),
      ],
    },
    {
      id: 'D',
      label: 'ventilator pressure escalation first, then start at 2 s',
      steps: [
        card('vv-pressure-escalation'),
        wait(2),
        card('vv-readiness-check'),
        card('vv-connect-circuit'),
        act({ type: 'SET_RPM', rpm: 3200 }),
        act({ type: 'SET_SWEEP', sweep: 4 }),
        act({ type: 'SET_GAS_FIO2', fio2: 1 }),
        act({ type: 'START_ECMO' }),
        wait(HORIZON - 2),
      ],
    },
  ],
  // C2
  'clinical-vv-occult-hemorrhage': [
    { id: 'A', label: 'time only', steps: [wait(HORIZON)] },
    { id: 'B', label: 'bleeding search only', steps: [card('hemorrhage-search'), wait(HORIZON)] },
    {
      id: 'C',
      label: 'reduce speed, search, transfuse, source control at 0 s',
      steps: [
        act({ type: 'SET_RPM', rpm: 3200 }),
        card('hemorrhage-search'),
        card('hemorrhage-prbc'),
        card('hemorrhage-source-control'),
        wait(HORIZON),
      ],
    },
    {
      id: 'D',
      label: 'crystalloid only (temporizing)',
      steps: [card('hemorrhage-crystalloid'), wait(HORIZON)],
    },
  ],
  // C3
  'clinical-vv-tension-pneumothorax': [
    { id: 'A', label: 'time only', steps: [wait(HORIZON)] },
    { id: 'B', label: 'lung ultrasound only', steps: [card('tension-pocus'), wait(HORIZON)] },
    {
      id: 'C',
      label: 'ultrasound, decompression at 0 s',
      steps: [card('tension-pocus'), card('tension-decompress'), wait(HORIZON)],
    },
    {
      id: 'D',
      label: 'speed 3200 → 3600 first, back to 3200 and decompress at 4 s',
      steps: [
        act({ type: 'SET_RPM', rpm: 3600 }),
        wait(4),
        act({ type: 'SET_RPM', rpm: 3200 }),
        card('tension-pocus'),
        card('tension-decompress'),
        wait(HORIZON - 4),
      ],
    },
  ],
  // C4
  'clinical-vv-oxygenator-thrombosis': [
    { id: 'A', label: 'time only', steps: [wait(HORIZON)] },
    { id: 'B', label: 'verification only', steps: [card('oxygenator-verify'), wait(HORIZON)] },
    {
      id: 'C',
      label: 'verify, prepare, exchange at 0 s',
      steps: [
        card('oxygenator-verify'),
        card('oxygenator-prepare-exchange'),
        card('oxygenator-exchange'),
        wait(HORIZON),
      ],
    },
    {
      id: 'D',
      label: 'chase flow with speed to 4000',
      steps: [act({ type: 'SET_RPM', rpm: 4000 }), wait(HORIZON)],
    },
  ],
  // C5
  'clinical-vv-recirculation-migration': [
    { id: 'A', label: 'time only', steps: [wait(HORIZON)] },
    {
      id: 'B',
      label: 'gas comparison and ultrasound only',
      steps: [card('recirc-compare-gases'), card('recirc-ultrasound'), wait(HORIZON)],
    },
    {
      id: 'C',
      label: 'compare, ultrasound, reposition at 0 s',
      steps: [
        card('recirc-compare-gases'),
        card('recirc-ultrasound'),
        card('recirc-reposition'),
        wait(HORIZON),
      ],
    },
    {
      id: 'D',
      label: 'speed 3550 → 3900 first, back and reposition at 3 s',
      steps: [
        act({ type: 'SET_RPM', rpm: 3900 }),
        wait(3),
        act({ type: 'SET_RPM', rpm: 3550 }),
        card('recirc-ultrasound'),
        card('recirc-reposition'),
        wait(HORIZON - 3),
      ],
    },
  ],
  // C6
  'clinical-vv-gas-disconnection': [
    { id: 'A', label: 'time only', steps: [wait(HORIZON)] },
    {
      id: 'B',
      label: 'gas-path inspection only',
      steps: [card('gas-inspect-path'), wait(HORIZON)],
    },
    {
      id: 'C',
      label: 'inspect, reconnect, set sweep 4 at 0 s',
      steps: [
        card('gas-inspect-path'),
        act({ type: 'RESTORE_GAS_SOURCE' }),
        act({ type: 'SET_SWEEP', sweep: 4 }),
        wait(HORIZON),
      ],
    },
    {
      id: 'D',
      label: 'speed to 3800 instead',
      steps: [act({ type: 'SET_RPM', rpm: 3800 }), wait(HORIZON)],
    },
  ],
  // C7
  'clinical-vv-circuit-air-embolism': [
    { id: 'A', label: 'time only', steps: [wait(HORIZON)] },
    {
      id: 'B',
      label: 'conventional support only',
      steps: [card('air-support-patient'), wait(HORIZON)],
    },
    {
      id: 'C',
      label: 'clamp return, clamp drainage, de-air, resume at 0 s',
      steps: [
        act({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true }),
        act({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true }),
        card('air-deair'),
        act({ type: 'RESUME_SUPPORT_AFTER_BUBBLE' }),
        wait(HORIZON),
      ],
    },
    {
      id: 'D',
      label: 'premature resume (refused), then the safe sequence at 2 s',
      steps: [
        act({ type: 'RESUME_SUPPORT_AFTER_BUBBLE' }),
        wait(2),
        act({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true }),
        act({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true }),
        card('air-deair'),
        act({ type: 'RESUME_SUPPORT_AFTER_BUBBLE' }),
        wait(HORIZON - 2),
      ],
    },
  ],
  // VAC1
  'va-clinical-initiation-shock': [
    { id: 'A', label: 'time only', steps: [wait(HORIZON)] },
    { id: 'B', label: 'readiness check only', steps: [card('va-readiness-check'), wait(HORIZON)] },
    {
      id: 'C',
      label: 'readiness, connect, ordered settings, start at 0 s',
      steps: [
        card('va-readiness-check'),
        card('va-connect-circuit'),
        act({ type: 'SET_RPM', rpm: 3400 }),
        act({ type: 'SET_SWEEP', sweep: 3 }),
        act({ type: 'SET_GAS_FIO2', fio2: 1 }),
        act({ type: 'START_ECMO' }),
        wait(HORIZON),
      ],
    },
    {
      id: 'D',
      label: 'vasopressor instead of support (temporizing)',
      steps: [card('va-vasopressor-only-delay'), wait(HORIZON)],
    },
  ],
  // VAC2
  'va-clinical-tamponade': [
    { id: 'A', label: 'time only', steps: [wait(HORIZON)] },
    { id: 'B', label: 'echo only', steps: [card('tamponade-echo'), wait(HORIZON)] },
    {
      id: 'C',
      label: 'echo, surgical decompression at 0 s',
      steps: [card('tamponade-echo'), card('tamponade-decompress'), wait(HORIZON)],
    },
    {
      id: 'D',
      label: 'vasopressor only (temporizing)',
      steps: [card('tamponade-vasopressor'), wait(HORIZON)],
    },
  ],
  // VAC3
  'va-clinical-vasoplegia': [
    { id: 'A', label: 'time only', steps: [wait(HORIZON)] },
    { id: 'B', label: 'echo only', steps: [card('vasoplegia-echo'), wait(HORIZON)] },
    {
      id: 'C',
      label: 'echo, pressors at 0 s, source control at 6 s',
      steps: [
        card('vasoplegia-echo'),
        card('vasoplegia-pressors'),
        wait(6),
        card('vasoplegia-source-control'),
        wait(HORIZON - 6),
      ],
    },
    {
      id: 'D',
      label: 'speed 3500 → 3700 (the walkthrough’s comparison)',
      steps: [act({ type: 'SET_RPM', rpm: 3700 }), wait(HORIZON)],
    },
  ],
  // VAC4
  'va-clinical-oxygenator-thrombosis': [
    { id: 'A', label: 'time only', steps: [wait(HORIZON)] },
    { id: 'B', label: 'verification only', steps: [card('va-oxygenator-verify'), wait(HORIZON)] },
    {
      id: 'C',
      label: 'verify, prepare, exchange at 0 s',
      steps: [
        card('va-oxygenator-verify'),
        card('va-oxygenator-prepare'),
        card('va-oxygenator-exchange'),
        wait(HORIZON),
      ],
    },
    {
      id: 'D',
      label: 'pressors only (temporizing)',
      steps: [card('va-oxygenator-pressors'), wait(HORIZON)],
    },
  ],
  // VAC5
  'va-clinical-differential-hypoxemia': [
    { id: 'A', label: 'time only', steps: [wait(HORIZON)] },
    {
      id: 'B',
      label: 'right-arm verification only',
      steps: [card('differential-right-arm'), wait(HORIZON)],
    },
    {
      id: 'C',
      label: 'right arm, native-lung ventilation at 0 s, escalate at 4 s',
      steps: [
        card('differential-right-arm'),
        card('differential-native-lung'),
        wait(4),
        card('differential-escalate-config'),
        wait(HORIZON - 4),
      ],
    },
    {
      id: 'D',
      label: 'speed 3400 → 3600 (the walkthrough’s comparison)',
      steps: [act({ type: 'SET_RPM', rpm: 3600 }), wait(HORIZON)],
    },
  ],
  // VAC6
  'va-clinical-limb-ischemia': [
    { id: 'A', label: 'time only', steps: [wait(HORIZON)] },
    { id: 'B', label: 'limb assessment only', steps: [card('limb-assessment'), wait(HORIZON)] },
    {
      id: 'C',
      label: 'assessment, restore distal perfusion at 0 s',
      steps: [card('limb-assessment'), card('limb-restore-perfusion'), wait(HORIZON)],
    },
    {
      id: 'D',
      label: 'speed to 3900 instead',
      steps: [act({ type: 'SET_RPM', rpm: 3900 }), wait(HORIZON)],
    },
  ],
  // VAC7
  'va-clinical-circuit-air-embolism': [
    { id: 'A', label: 'time only', steps: [wait(HORIZON)] },
    {
      id: 'B',
      label: 'conventional support only',
      steps: [card('va-air-support-patient'), wait(HORIZON)],
    },
    {
      id: 'C',
      label: 'clamp return, clamp drainage, de-air, resume at 0 s',
      steps: [
        act({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true }),
        act({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true }),
        card('va-air-deair'),
        act({ type: 'RESUME_SUPPORT_AFTER_BUBBLE' }),
        wait(HORIZON),
      ],
    },
    {
      id: 'D',
      label: 'premature resume (refused), then the safe sequence at 2 s',
      steps: [
        act({ type: 'RESUME_SUPPORT_AFTER_BUBBLE' }),
        wait(2),
        act({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true }),
        act({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true }),
        card('va-air-deair'),
        act({ type: 'RESUME_SUPPORT_AFTER_BUBBLE' }),
        wait(HORIZON - 2),
      ],
    },
  ],
  // IV
  'vv-off-sweep-capstone': [
    { id: 'A', label: 'time only', steps: [wait(HORIZON)] },
    {
      id: 'C',
      label: 'off-sweep trial started at 0 s',
      steps: [act({ type: 'SET_SWEEP', sweep: 0 }), wait(HORIZON)],
    },
    {
      id: 'D',
      label: 'off-sweep trial started late, at 5 s',
      steps: [wait(5), act({ type: 'SET_SWEEP', sweep: 0 }), wait(HORIZON - 5)],
    },
  ],
  // IA
  'va-mixed-circulation-capstone': [
    { id: 'A', label: 'time only', steps: [wait(HORIZON)] },
    {
      id: 'C',
      label: 'recognise and escalate at 0 s',
      steps: [act({ type: 'CORRECT_FAULT', fault: 'differential-hypoxemia' }), wait(HORIZON)],
    },
  ],
}
