import {
  ECMO_BASELINE_DISPLAY_DEADBANDS,
  ecmoDerivedValueGuides,
} from '../../content/ecmoValueGuides'
import { createReferenceSimulationState, ecmoSimulationReducer } from '../../engine'
import type { EcmoSimulationState } from '../../engine/types'
import type { EcmoFoundationSnapshot } from '../../session/foundationSession'
import {
  GuidedValue,
  ModelBoundary,
  TextEquivalent,
  direction,
  directionWord,
  round,
  styles,
  VA_CONFIGURATION_BOUNDARY,
  VaConfigurationLabel,
} from './shared'
import { UNAVAILABLE_INDICATION } from '../channelReadout'
import {
  VA_CONFIGURATION_DIAGRAM_NOTE,
  VaConfigurationStrategyCard,
} from './VaConfigurationStrategyCard'

/**
 * VA parallel physiology: two circulations filling one aorta, and the two prices of that.
 *
 * This panel exists to hold apart three states the console cannot tell apart. The VA reference
 * circuit, the differential-oxygenation preview and the loading preview all run the same flow, the
 * same three pressures and the same membrane gradient. Everything that separates them is measured
 * on the patient: two arterial saturations taken at two sites, the pulsatility of the native beat,
 * whether the aortic valve opens, what the lungs look like, and what the cannulated limb is doing.
 *
 * The comparison below therefore keeps the console rows even though they do not move. A learner who
 * is only shown the rows that changed takes away a finding; a learner who is also shown the rows
 * that did not change takes away the lesson.
 *
 * One console-side value can still move without the pump moving — the drainage-limb saturation,
 * which falls when the patient extracts more oxygen. It is kept in its own group for that reason,
 * so that "the circuit display is unchanged" is a claim about the five channels it is true of.
 */

/**
 * Display deadbands for the rows that exist only in the VA track.
 *
 * Deliberately an alias rather than its own record: authoring these numbers beside the markup is
 * exactly the defect an earlier review found in the VV baseline panel. They live in
 * `content/ecmoValueGuides.ts` next to the guide whose reference statement is built from them, so
 * the number a panel classifies with and the number the learner is told about cannot drift apart,
 * and both appear in the guide audit.
 */
const VA_DISPLAY_DEADBANDS = ECMO_BASELINE_DISPLAY_DEADBANDS

/** Lower-body minus upper-body saturation. The finding is this difference, not either number. */
function upperToLowerSaturationGap(state: EcmoSimulationState): number {
  return state.patient.femoralArterialSpo2 - state.patient.rightRadialSpo2
}

const congestionWord: Readonly<Record<'none' | 'mild' | 'marked', string>> = {
  none: 'no congestion',
  mild: 'mild congestion',
  marked: 'marked congestion',
}

const limbPerfusionWord: Readonly<Record<'normal' | 'threatened' | 'critical', string>> = {
  normal: 'normal',
  threatened: 'threatened',
  critical: 'critical',
}

function valveWord(state: EcmoSimulationState): string {
  return state.patient.aorticValveOpening ? 'opening' : 'not opening'
}

/**
 * The settled VA reference circuit, derived rather than transcribed.
 *
 * Built the same way the lesson builds it — the authored VA reference profile, advanced eight
 * modeled seconds — and cached, because the comparison this section asks for is between the state
 * on screen and the circuit the lesson opens on, and a learner cannot hold both in their head while
 * switching between them.
 */
let cachedReference: EcmoSimulationState | null = null
function vaReferenceCircuit(): EcmoSimulationState {
  if (!cachedReference) {
    let state = createReferenceSimulationState('va-reference')
    for (let tick = 0; tick < 8; tick += 1) {
      state = ecmoSimulationReducer(state, { type: 'STEP' })
    }
    cachedReference = state
  }
  return cachedReference
}

interface ParallelStage {
  readonly id: string
  readonly label: string
  /** Which of the two streams this stage belongs to, spelled out rather than implied by position. */
  readonly stream: 'circuit' | 'native' | 'shared'
  readonly detail: string
  readonly carries: string
}

const streamLabel: Readonly<Record<ParallelStage['stream'], string>> = {
  circuit: 'circuit stream',
  native: 'native stream',
  shared: 'both streams',
}

function parallelStages(state: EcmoSimulationState): readonly ParallelStage[] {
  const { circuit, patient } = state
  const gap = upperToLowerSaturationGap(state)
  return [
    {
      id: 'systemic-venous-return',
      label: 'Systemic venous return',
      stream: 'circuit',
      detail:
        'Blood coming back from the tissues, carrying whatever the tissues left behind. Nothing on the circuit measures this directly.',
      carries: `Systemic venous saturation, estimated at ${round(patient.systemicVenousSaturationEstimate, 1)}`,
    },
    {
      id: 'drainage',
      label: 'Drainage limb',
      stream: 'circuit',
      detail:
        'The venous cannula pulls that blood into the circuit. Return is on the arterial side and nowhere near here, so there is no short path by which freshly returned blood is drained straight back in.',
      carries: `Venous-line saturation ${round(circuit.preOxygenatorSaturation, 1)}, measured in the disposable’s measuring cell; recirculating share ${circuit.recirculationFraction.toFixed(3)}`,
    },
    {
      id: 'membrane-lung',
      label: 'Membrane lung',
      stream: 'circuit',
      detail: 'Gas exchange, then out along the return limb toward the arterial cannula.',
      carries: `Post-oxygenator saturation ${round(circuit.postOxygenatorSaturation, 1)}`,
    },
    {
      id: 'arterial-return',
      label: 'Return to the arterial system',
      stream: 'circuit',
      detail:
        'The circuit gives the blood back downstream of the heart. From a femoral cannula it then travels up the aorta, against the direction the native heart is ejecting.',
      carries: `Circuit blood flow ${circuit.bloodFlow.toFixed(2)} L/min entering the arterial system`,
    },
    {
      id: 'native-ejection',
      label: 'Native ejection into the same aorta',
      stream: 'native',
      detail:
        'The left ventricle fills that same aorta from the other end, and now has to eject against what the circuit is returning into it. This is the stage where loading lives.',
      carries: `Native cardiac output ${patient.nativeCardiacOutputLpm.toFixed(2)} L/min, pulse pressure ${patient.pulsePressure.toFixed(1)} mmHg, aortic valve ${valveWord(state)}`,
    },
    {
      id: 'mixing-point',
      label: 'The mixing point',
      stream: 'shared',
      detail:
        'The two streams meet somewhere along the aorta, and that place moves. Raising native ejection relative to circuit flow moves it more distally, away from the aortic root and toward the return cannula. Raising circuit flow relative to native ejection moves it more proximally, back toward the ascending aorta and the root.',
      carries: `Difference between the two arterial sampling sites ${gap.toFixed(1)} saturation points`,
    },
    {
      id: 'arch-branches',
      label: 'Arch branches — upper body and brain',
      stream: 'native',
      detail:
        'The brachiocephalic, left common carotid and left subclavian arteries arise from the arch. When the mixing point lies distal to them they are filled from the native side, and what they carry is whatever the native lungs managed to do to it. When it lies proximal to them they are filled by the membrane.',
      carries: `Right radial saturation ${round(patient.rightRadialSpo2, 1)}`,
    },
    {
      id: 'aortic-root-and-coronaries',
      label: 'Aortic root — coronary origin',
      stream: 'shared',
      detail:
        'The coronary arteries arise from the aortic root, proximal to every arch branch, so they are not an upper-body bed in the way the arch vessels are. The mixing point can sit between the root and the arch branches, and in that case the coronary supply and the right radial sample are being filled from different sides. A right radial value therefore does not establish what the coronary circulation is receiving.',
      carries: `Right radial saturation ${round(patient.rightRadialSpo2, 1)} does not on its own establish coronary supply`,
    },
    {
      id: 'lower-body',
      label: 'Beds distal to the mixing point',
      stream: 'circuit',
      detail:
        'Distal to the mixing point the beds are supplied by circuit blood, which has just crossed a membrane running on oxygen. It can look reassuring while everything proximal is being filled from somewhere else. The cannulated limb sits down here too, distal to a cannula that occupies part of its artery.',
      carries: `Femoral arterial saturation ${round(patient.femoralArterialSpo2, 1)}, distal limb perfusion ${limbPerfusionWord[patient.distalLimbPerfusion]}`,
    },
  ]
}

type ComparisonGroupId = 'circuit-display' | 'circuit-oxygen' | 'parallel'

const groupLabels: Readonly<Record<ComparisonGroupId, string>> = {
  'circuit-display': 'The five console channels',
  'circuit-oxygen': 'Oxygen the circuit carries, and the share it re-drains',
  parallel: 'Signals that exist only because the circulations are in parallel',
}

interface ComparisonRow {
  readonly id: string
  readonly group: ComparisonGroupId
  readonly label: string
  readonly unit: string
  readonly precision: number
  readonly deadband: number
  readonly read: (state: EcmoSimulationState) => number | null
}

/**
 * Deadbands here drive the comparison words only. They are a display aid for this simulation — not
 * a tolerance, not a threshold — and the raw values either side of them are always printed.
 */
const COMPARISON_ROWS: readonly ComparisonRow[] = [
  {
    id: 'displayed-circuit-flow',
    group: 'circuit-display',
    label: 'Displayed circuit flow',
    unit: 'L/min',
    precision: 2,
    deadband: ECMO_BASELINE_DISPLAY_DEADBANDS.bloodFlow,
    read: (state) => state.circuit.bloodFlow,
  },
  {
    id: 'pVen',
    group: 'circuit-display',
    label: 'pVen',
    unit: 'mmHg',
    precision: 0,
    deadband: ECMO_BASELINE_DISPLAY_DEADBANDS.pVen,
    read: (state) => state.circuit.readouts.pVen.displayed,
  },
  {
    id: 'pInt',
    group: 'circuit-display',
    label: 'pInt',
    unit: 'mmHg',
    precision: 0,
    deadband: ECMO_BASELINE_DISPLAY_DEADBANDS.pInt,
    read: (state) => state.circuit.readouts.pInt.displayed,
  },
  {
    id: 'pArt',
    group: 'circuit-display',
    label: 'pArt',
    unit: 'mmHg',
    precision: 0,
    deadband: ECMO_BASELINE_DISPLAY_DEADBANDS.pArt,
    read: (state) => state.circuit.readouts.pArt.displayed,
  },
  {
    id: 'deltaP',
    group: 'circuit-display',
    label: 'ΔP across the membrane',
    unit: 'mmHg',
    precision: 0,
    deadband: ECMO_BASELINE_DISPLAY_DEADBANDS.deltaP,
    read: (state) => state.circuit.readouts.deltaP.displayed,
  },
  {
    id: 'recirculation-fraction',
    group: 'circuit-oxygen',
    label: 'Recirculating share of drainage',
    unit: '',
    precision: 3,
    deadband: VA_DISPLAY_DEADBANDS.recirculationFraction,
    read: (state) => state.circuit.recirculationFraction,
  },
  {
    id: 'adjusted-circuit-flow',
    group: 'circuit-oxygen',
    label: 'Recirculation-adjusted circuit flow',
    unit: 'L/min',
    precision: 2,
    deadband: ECMO_BASELINE_DISPLAY_DEADBANDS.recirculationAdjustedCircuitFlowLpm,
    read: (state) => state.circuit.recirculationAdjustedCircuitFlowLpm,
  },
  {
    id: 'venous-line-saturation',
    group: 'circuit-oxygen',
    label: 'Venous-line SvO₂ — device-displayed',
    unit: '',
    precision: 1,
    deadband: ECMO_BASELINE_DISPLAY_DEADBANDS.venousLineSaturation,
    read: (state) => state.circuit.readouts.venousLineSaturation.displayed,
  },
  {
    id: 'post-oxygenator-saturation',
    group: 'circuit-oxygen',
    label: 'Post-oxygenator saturation',
    unit: '',
    precision: 1,
    deadband: VA_DISPLAY_DEADBANDS.postOxygenatorSaturation,
    read: (state) => state.circuit.postOxygenatorSaturation,
  },
  {
    id: 'systemic-venous-estimate',
    group: 'circuit-oxygen',
    label: 'Systemic venous saturation (estimate)',
    unit: '',
    precision: 1,
    deadband: VA_DISPLAY_DEADBANDS.systemicVenousSaturationEstimate,
    read: (state) => state.patient.systemicVenousSaturationEstimate,
  },
  {
    id: 'right-radial-spo2',
    group: 'parallel',
    label: 'Right radial saturation (upper body)',
    unit: '',
    precision: 1,
    deadband: VA_DISPLAY_DEADBANDS.rightRadialSpo2,
    read: (state) => state.patient.rightRadialSpo2,
  },
  {
    id: 'femoral-arterial-spo2',
    group: 'parallel',
    label: 'Femoral arterial saturation (lower body)',
    unit: '',
    precision: 1,
    deadband: VA_DISPLAY_DEADBANDS.femoralArterialSpo2,
    read: (state) => state.patient.femoralArterialSpo2,
  },
  {
    id: 'upper-to-lower-gap',
    group: 'parallel',
    label: 'Lower body minus upper body',
    unit: 'saturation points',
    precision: 1,
    deadband: VA_DISPLAY_DEADBANDS.upperToLowerSaturationGap,
    read: upperToLowerSaturationGap,
  },
  {
    id: 'pulse-pressure',
    group: 'parallel',
    label: 'Pulse pressure',
    unit: 'mmHg',
    precision: 1,
    deadband: VA_DISPLAY_DEADBANDS.pulsePressure,
    read: (state) => state.patient.pulsePressure,
  },
  {
    id: 'native-cardiac-output',
    group: 'parallel',
    label: 'Native cardiac output',
    unit: 'L/min',
    precision: 2,
    deadband: ECMO_BASELINE_DISPLAY_DEADBANDS.nativeCardiacOutputLpm,
    read: (state) => state.patient.nativeCardiacOutputLpm,
  },
  {
    id: 'distal-limb-nirs',
    group: 'parallel',
    label: 'Distal limb near-infrared reading',
    unit: '',
    precision: 0,
    deadband: VA_DISPLAY_DEADBANDS.distalLimbNirs,
    read: (state) => state.patient.distalLimbNirs,
  },
]

const COMPARISON_GROUPS: readonly ComparisonGroupId[] = [
  'circuit-display',
  'circuit-oxygen',
  'parallel',
]

/** For a table cell, where the console's unavailable indication is the right thing to show. */
function format(value: number | null, precision: number, unit: string): string {
  if (value === null) return UNAVAILABLE_INDICATION
  return unit ? `${value.toFixed(precision)} ${unit}` : value.toFixed(precision)
}

/** For prose and text equivalents, where a screen reader would announce the dashes as characters. */
function formatPhrase(value: number | null, precision: number, unit: string): string {
  if (value === null) return 'not reported'
  return format(value, precision, unit)
}

/** Direction against the reference circuit, with the unavailable case kept separate from flat. */
function comparisonWord(row: ComparisonRow, state: EcmoSimulationState): string {
  const live = row.read(state)
  const reference = row.read(vaReferenceCircuit())
  if (live === null || reference === null) return 'no comparison available'
  return directionWord[direction(live - reference, row.deadband)]
}

/**
 * Three outcomes, not two.
 *
 * Collapsing "this channel is not reporting" into "not flat" made the panel assert that a channel
 * had *moved away from* the reference — a claim about the circuit built from the absence of a
 * number. Unavailable is its own answer and gets its own sentence.
 */
type ComparisonState = 'flat' | 'moved' | 'not-comparable'

function comparisonState(row: ComparisonRow, state: EcmoSimulationState): ComparisonState {
  const live = row.read(state)
  const reference = row.read(vaReferenceCircuit())
  if (live === null || reference === null) return 'not-comparable'
  return direction(live - reference, row.deadband) === 'flat' ? 'flat' : 'moved'
}

interface VaSignal {
  readonly name: string
  readonly label: string
  readonly value: string
  readonly detail: string
}

function vaSignals(state: EcmoSimulationState): readonly VaSignal[] {
  const { patient } = state
  const gap = upperToLowerSaturationGap(state)
  return [
    {
      name: 'rightRadialSpo2',
      label: 'Right radial saturation — arch-branch territory',
      value: patient.rightRadialSpo2.toFixed(1),
      detail:
        'Drawn from the first arch branch, so it is the most useful single site for asking what the upper body and the brain are being given. It reports the native side only while the mixing point lies distal to that branch, and it does not establish what the coronary arteries — which arise further back, at the root — are receiving. Nothing on the console reports it.',
    },
    {
      name: 'femoralArterialSpo2',
      label: 'Femoral arterial saturation — distal to the mixing point',
      value: patient.femoralArterialSpo2.toFixed(1),
      detail:
        'Drawn distal to the mixing point, in blood the membrane lung has just oxygenated. It can look reassuring while everything proximal to that point is being supplied by something else entirely.',
    },
    {
      name: 'upperToLowerSaturationGap',
      label: 'Lower body minus upper body',
      value: `${gap.toFixed(1)} saturation points`,
      detail:
        'Two arterial saturations from one patient are not a repeated measurement — they are measurements of two different bloods. The difference between them is the finding, so where the probe or the sampling line sits is part of the measurement rather than a detail of it.',
    },
    {
      name: 'pulsePressure',
      label: 'Pulse pressure',
      value: `${patient.pulsePressure.toFixed(1)} mmHg`,
      detail:
        'How much the native beat is still moving. It narrows as the ventricle struggles to eject against the pressure the circuit is returning into the aorta.',
    },
    {
      name: 'aorticValveOpening',
      label: 'Aortic valve',
      value: valveWord(state),
      detail:
        'Whether the ventricle clears itself at all. A valve that has stopped opening means the chamber is ejecting nothing and everything that reaches it stays there.',
    },
    {
      name: 'pulmonaryCongestion',
      label: 'Pulmonary congestion',
      value: congestionWord[patient.pulmonaryCongestion],
      detail:
        'What sits behind a ventricle that cannot empty. Loading presents here and in the pulsatility above, never on a circuit pressure channel.',
    },
    {
      name: 'nativeCardiacOutputLpm',
      label: 'Native cardiac output',
      value: `${patient.nativeCardiacOutputLpm.toFixed(2)} L/min`,
      detail:
        'The other pump. In VA it shares the aorta with the circuit instead of doing all the circulatory work, and how much it is doing decides where the watershed sits.',
    },
    {
      name: 'distalLimbPerfusion',
      label: 'Distal limb perfusion',
      value: `${limbPerfusionWord[patient.distalLimbPerfusion]}, near-infrared reading ${patient.distalLimbNirs.toFixed(0)}`,
      detail:
        'The limb below the arterial cannula, which occupies part of the vessel feeding it. It belongs to the routine look at a VA patient rather than to a list of complications.',
    },
  ]
}

export function VaParallelPhysiologyPanel({
  state,
}: {
  readonly state: EcmoSimulationState
  /**
   * Part of the shared panel prop shape. This section compares the state on screen with the VA
   * reference circuit rather than with a baseline captured in the session, so it reads no snapshot.
   */
  readonly snapshot?: EcmoFoundationSnapshot | null
}) {
  const { circuit, patient } = state
  const stages = parallelStages(state)
  const signals = vaSignals(state)
  const gap = upperToLowerSaturationGap(state)
  const reference = vaReferenceCircuit()

  const consoleRows = COMPARISON_ROWS.filter((row) => row.group === 'circuit-display')
  const consoleStates = consoleRows.map((row) => comparisonState(row, state))
  const consoleComparable = !consoleStates.includes('not-comparable')
  const consoleUnchanged = consoleComparable && consoleStates.every((item) => item === 'flat')
  const unreportedConsoleChannels = consoleRows
    .filter((_, index) => consoleStates[index] === 'not-comparable')
    .map((row) => row.label)

  return (
    <div className={styles.panel} data-teaching-panel="va-parallel-physiology">
      <VaConfigurationLabel />
      <ModelBoundary>{VA_CONFIGURATION_BOUNDARY}</ModelBoundary>
      <section className={styles.section} aria-labelledby="parallel-path-heading">
        <h3 id="parallel-path-heading" className={styles.heading}>
          The circuit in parallel with the patient
        </h3>

        {/*
          Stated at the diagram rather than only in the panel's boundary note. The sequence below is
          one topology, and a learner who reads it without that sentence has been shown a flow path
          and told it is "VA".
        */}
        <p className="mt-2 text-sm leading-6" data-configuration-diagram-note>
          {VA_CONFIGURATION_DIAGRAM_NOTE}
        </p>

        <ol className="mt-3 grid gap-2" data-parallel-path>
          {stages.map((stage, index) => (
            <li
              key={stage.id}
              className="rounded-xl border-l-4 border-solid bg-muted/30 p-3"
              data-parallel-stage={stage.id}
            >
              <p className="text-sm font-semibold">
                {index + 1}. {stage.label}
              </p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {streamLabel[stage.stream]}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{stage.detail}</p>
              <p className="mt-1 text-xs font-medium">{stage.carries}</p>
            </li>
          ))}
        </ol>

        <p className="mt-3 text-sm leading-6" data-parallel-claim>
          VA support carries the circulation as well as gas exchange. The circuit does not sit
          inside the native loop the way a VV circuit does — it fills the same aorta from the
          opposite end, so the two streams meet somewhere rather than combining one after the other.
          Everything in this section is a consequence of that meeting.
        </p>

        <TextEquivalent>
          Blood returns from the tissues at an estimated systemic venous saturation of{' '}
          {round(patient.systemicVenousSaturationEstimate, 1)}, is drained into the circuit at a
          venous-line saturation of {round(circuit.preOxygenatorSaturation, 1)} with a recirculating
          share of {circuit.recirculationFraction.toFixed(3)}, crosses the membrane lung to a
          post-oxygenator saturation of {round(circuit.postOxygenatorSaturation, 1)}, and re-enters
          the arterial system at {circuit.bloodFlow.toFixed(2)} L/min. The native heart fills the
          same aorta from the other end at {patient.nativeCardiacOutputLpm.toFixed(2)} L/min, with a
          pulse pressure of {patient.pulsePressure.toFixed(1)} mmHg and an aortic valve{' '}
          {valveWord(state)}. Above where the two streams meet the right radial saturation is{' '}
          {round(patient.rightRadialSpo2, 1)}; below it the femoral arterial saturation is{' '}
          {round(patient.femoralArterialSpo2, 1)}, a difference of {gap.toFixed(1)} saturation
          points, and distal limb perfusion is {limbPerfusionWord[patient.distalLimbPerfusion]}.
        </TextEquivalent>

        <ModelBoundary>
          The watershed is drawn at a fixed place in this diagram. This simulation does not compute
          where the two streams meet from native ejection and circuit flow — the upper-body and
          lower-body saturations are authored by the loaded case, and the diagram reads them rather
          than deriving them. It is a teaching sequence of where blood goes, not a scale drawing of
          cannula positions or vessel anatomy.
        </ModelBoundary>
      </section>

      <section className={styles.section} aria-labelledby="va-signals-heading">
        <h3 id="va-signals-heading" className={styles.heading}>
          What parallel circulation adds — none of it on the console
        </h3>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {signals.map((signal) => (
            <div key={signal.name} className="rounded-xl border p-3" data-va-signal={signal.name}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {signal.label}
              </p>
              <p className="text-2xl font-semibold">{signal.value}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{signal.detail}</p>
            </div>
          ))}
        </div>

        <TextEquivalent>
          {signals.map((signal) => `${signal.label} is ${signal.value}`).join('. ')}. Every one of
          these is read from the patient or the patient monitor. The CARDIOHELP displays none of
          them, so a stable console does not by itself establish that any of them is where it was.
        </TextEquivalent>

        <ModelBoundary>
          Pulsatility, aortic-valve opening and pulmonary congestion are authored states in this
          simulation rather than quantities produced by a ventricular model. They move when the
          loaded case says they move, and raising or lowering the pump speed here does not move
          them.
        </ModelBoundary>
      </section>

      <section className={styles.section} aria-labelledby="va-comparison-heading">
        <h3 id="va-comparison-heading" className={styles.heading}>
          This circuit against the settled VA reference circuit
        </h3>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm" data-reference-comparison>
            <caption className="sr-only">
              Each quantity in the settled VA reference circuit this lesson opens on, in the state
              currently loaded, and the direction between them, grouped into the five console
              channels, the saturations the circuit carries, and the signals that exist only because
              the circulations are in parallel.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  Quantity
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  VA reference circuit
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  On screen now
                </th>
                <th scope="col" className="pb-1 font-semibold">
                  Direction
                </th>
              </tr>
            </thead>
            {COMPARISON_GROUPS.map((group) => (
              <tbody key={group} data-comparison-group={group}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={4}
                    className="pt-3 text-xs uppercase tracking-wide text-muted-foreground"
                  >
                    {groupLabels[group]}
                  </th>
                </tr>
                {COMPARISON_ROWS.filter((row) => row.group === group).map((row) => (
                  <tr key={row.id} data-comparison-row={row.id}>
                    <th scope="row" className="py-1 pr-3 font-medium">
                      {row.label}
                    </th>
                    <td className="py-1 pr-3 text-muted-foreground" data-reference-value>
                      {format(row.read(reference), row.precision, row.unit)}
                    </td>
                    <td className="py-1 pr-3 font-semibold" data-live-comparison-value>
                      {format(row.read(state), row.precision, row.unit)}
                    </td>
                    <td className="py-1" data-comparison-direction={comparisonWord(row, state)}>
                      {comparisonWord(row, state)}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>

        <dl className="mt-3 grid gap-2 sm:grid-cols-3" data-categorical-comparison>
          <div className="rounded-xl border p-3" data-categorical-row="aorticValveOpening">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Aortic valve</dt>
            <dd className="text-sm font-semibold">{valveWord(state)}</dd>
            <dd className="text-xs text-muted-foreground">
              reference circuit: {valveWord(reference)}
            </dd>
          </div>
          <div className="rounded-xl border p-3" data-categorical-row="pulmonaryCongestion">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Pulmonary congestion
            </dt>
            <dd className="text-sm font-semibold">{congestionWord[patient.pulmonaryCongestion]}</dd>
            <dd className="text-xs text-muted-foreground">
              reference circuit: {congestionWord[reference.patient.pulmonaryCongestion]}
            </dd>
          </div>
          <div className="rounded-xl border p-3" data-categorical-row="distalLimbPerfusion">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Distal limb perfusion
            </dt>
            <dd className="text-sm font-semibold">
              {limbPerfusionWord[patient.distalLimbPerfusion]}
            </dd>
            <dd className="text-xs text-muted-foreground">
              reference circuit: {limbPerfusionWord[reference.patient.distalLimbPerfusion]}
            </dd>
          </div>
        </dl>

        <p
          className="mt-3 text-sm leading-6"
          data-circuit-signals-unchanged={
            consoleComparable ? (consoleUnchanged ? 'true' : 'false') : 'not-comparable'
          }
        >
          {!consoleComparable
            ? `${unreportedConsoleChannels.join(' and ')} ${
                unreportedConsoleChannels.length === 1 ? 'is' : 'are'
              } not reporting a number in this state, so the five console channels cannot be read as a set here. ${
                circuit.readouts.pVen.reason
              } Until they report, nothing on the console can be said to have moved or held.`
            : consoleUnchanged
              ? `All five console channels read about the same as the VA reference circuit: flow ${circuit.bloodFlow.toFixed(2)} L/min, pVen ${format(circuit.readouts.pVen.displayed, 0, 'mmHg')}, pInt ${format(circuit.readouts.pInt.displayed, 0, 'mmHg')}, pArt ${format(circuit.readouts.pArt.displayed, 0, 'mmHg')} and a membrane gradient of ${format(circuit.readouts.deltaP.displayed, 0, 'mmHg')}. Differential oxygenation and a loaded ventricle both leave every one of them exactly where the reference put them. What separates this state from the reference is a property of the patient rather than of the pump — including the drainage-limb saturation below, which the circuit reports but the patient sets.`
              : `At least one of the five console channels has moved away from the VA reference circuit, so what is on screen is not one of the two patient-side mechanisms in this section acting on its own. The rows above show which channel moved and by how much.`}
        </p>

        <p className="mt-2 text-sm leading-6" data-drainage-saturation-note>
          The one console-side value in the second group that can move without the pump moving is
          the drainage-limb saturation. When less oxygen is being delivered, more of it is taken out
          before the blood reaches the venous cannula, and the measuring cell reports the lower
          number. That is the circuit reporting the patient, not the circuit reporting itself, and
          it is why the two groups are kept apart here. With no recirculating share to dilute it,
          the systemic venous estimate in the same group is that same blood, so the two move
          together rather than one of them moving alone.{' '}
          {`In this state the drainage-limb saturation reads ${formatPhrase(circuit.readouts.venousLineSaturation.displayed, 1, '')} against the reference circuit’s ${formatPhrase(reference.circuit.readouts.venousLineSaturation.displayed, 1, '')}, and the systemic venous estimate ${formatPhrase(patient.systemicVenousSaturationEstimate, 1, '')} against ${formatPhrase(reference.patient.systemicVenousSaturationEstimate, 1, '')}.`}
        </p>

        <TextEquivalent>
          {COMPARISON_ROWS.map(
            (row) =>
              `${row.label} is ${formatPhrase(row.read(state), row.precision, row.unit)} against the reference circuit's ${formatPhrase(row.read(reference), row.precision, row.unit)}, ${comparisonWord(row, state)}`,
          ).join('. ')}
          . The aortic valve is {valveWord(state)} against the reference circuit&rsquo;s{' '}
          {valveWord(reference)}, the lungs show {congestionWord[patient.pulmonaryCongestion]}{' '}
          against {congestionWord[reference.patient.pulmonaryCongestion]}, and distal limb perfusion
          is {limbPerfusionWord[patient.distalLimbPerfusion]} against{' '}
          {limbPerfusionWord[reference.patient.distalLimbPerfusion]}.
        </TextEquivalent>

        <ModelBoundary>
          The reference column is this simulation&rsquo;s own authored teaching circuit, produced by
          the same model as every other number here, and not a set of bedside values to reproduce.
          The words higher, lower and about the same come from authored display deadbands for this
          simulation and mark no boundary of safety; the raw values either side of each of them are
          printed beside it.
        </ModelBoundary>
      </section>

      <section className={styles.section} aria-labelledby="va-mechanisms-heading">
        <h3 id="va-mechanisms-heading" className={styles.heading}>
          Two mechanisms, one unchanged console
        </h3>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-3" data-va-mechanism="differential-oxygenation">
            <p className="text-sm font-semibold">Differential oxygenation</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The upper body is supplied by blood the native heart ejected through lungs that did
              little with it, while the lower body is supplied by circuit blood that has just
              crossed the membrane. Both bloods are arterial; they are not the same blood.
            </p>
            <p className="mt-2 text-xs font-medium">
              Read it at: right radial {patient.rightRadialSpo2.toFixed(1)} against femoral{' '}
              {patient.femoralArterialSpo2.toFixed(1)} — a difference of {gap.toFixed(1)} saturation
              points.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              A recovering ventricle ejects more and moves the mixing point more distally, away from
              the aortic root, so improving native function can present as a new upper-body
              hypoxemia rather than as good news. Raising circuit flow moves that point the other
              way, back toward the root — which can lift the upper-body value while raising what the
              ventricle has to eject against.
            </p>
          </div>
          <div className="rounded-xl border p-3" data-va-mechanism="lv-loading">
            <p className="text-sm font-semibold">Left ventricular loading</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Arterial return raises what the ventricle has to eject against, while venous drainage
              reduces what reaches it. A chamber that cannot clear itself distends, and the lungs
              behind it fill. This is a property of parallel support that has to be watched for, not
              an unusual complication of it.
            </p>
            <p className="mt-2 text-xs font-medium">
              Read it at: pulse pressure {patient.pulsePressure.toFixed(1)} mmHg, aortic valve{' '}
              {valveWord(state)}, lungs showing {congestionWord[patient.pulmonaryCongestion]},
              native cardiac output {patient.nativeCardiacOutputLpm.toFixed(2)} L/min.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              It leaves the two arterial sampling sites where they were, so a loaded ventricle is
              not a hypoxemia problem and will not be found by looking for one.
            </p>
          </div>
        </div>

        <TextEquivalent>
          Differential oxygenation is read from the two sampling sites: right radial{' '}
          {patient.rightRadialSpo2.toFixed(1)} against femoral{' '}
          {patient.femoralArterialSpo2.toFixed(1)}, a difference of {gap.toFixed(1)} saturation
          points. Loading is read from the beat and the lungs: pulse pressure{' '}
          {patient.pulsePressure.toFixed(1)} mmHg, aortic valve {valveWord(state)},{' '}
          {congestionWord[patient.pulmonaryCongestion]}, and native cardiac output{' '}
          {patient.nativeCardiacOutputLpm.toFixed(2)} L/min. Neither mechanism moves circuit flow,
          which is {circuit.bloodFlow.toFixed(2)} L/min, or the membrane gradient, which is{' '}
          {format(circuit.readouts.deltaP.displayed, 0, 'mmHg')}.
        </TextEquivalent>

        <p className="mt-3 text-sm leading-6" data-va-recirculation-note>
          One arithmetic point belongs here as well. In VA drainage is venous and return is
          arterial, so there is no short path between them and nothing for the recirculating share
          to count: it reads {circuit.recirculationFraction.toFixed(3)} in this state, which is why
          the recirculation-adjusted circuit flow of{' '}
          {circuit.recirculationAdjustedCircuitFlowLpm.toFixed(2)} L/min is the displayed flow of{' '}
          {circuit.bloodFlow.toFixed(2)} L/min again. It is not total systemic flow: the native
          heart is contributing {patient.nativeCardiacOutputLpm.toFixed(2)} L/min into the same
          aorta, and the two must never be added together and called one.
        </p>

        <ModelBoundary>
          In this simulation the recirculating share is authored by the loaded case, and for VA that
          authored value is zero. The panel shows the arithmetic that follows from it; it is not
          evidence that arterial return can never be re-drained in any real configuration.
        </ModelBoundary>
      </section>

      {/*
        Last of the teaching sections, and deliberately so.

        The card generalizes the mechanism this panel has just built — the two streams, the place
        they meet, the two sampling sites, and what the ventricle is ejecting against — to
        configurations that put the streams somewhere else. Placed any earlier it would read as a
        list of rescue procedures offered before the physiology that makes any of them meaningful.
      */}
      <VaConfigurationStrategyCard detail="full" headingLevel={3} />

      <GuidedValue
        guide={ecmoDerivedValueGuides.recirculationFraction}
        value={round(circuit.recirculationFraction, 3)}
        headingLevel={3}
      />
      <GuidedValue
        guide={ecmoDerivedValueGuides.recirculationAdjustedCircuitFlow}
        value={round(circuit.recirculationAdjustedCircuitFlowLpm, 2)}
        headingLevel={3}
      />
      <GuidedValue
        guide={ecmoDerivedValueGuides.venousLineSaturation}
        value={circuit.readouts.venousLineSaturation.displayed}
        headingLevel={3}
      />
      <GuidedValue
        guide={ecmoDerivedValueGuides.systemicVenousSaturationEstimate}
        value={round(patient.systemicVenousSaturationEstimate, 1)}
        headingLevel={3}
      />
    </div>
  )
}
