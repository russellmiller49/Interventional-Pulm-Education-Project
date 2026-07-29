import type { EcmoFoundationSnapshot } from '../../session/foundationSession'
import {
  ECMO_BASELINE_DISPLAY_DEADBANDS,
  ecmoDerivedValueGuides,
} from '../../content/ecmoValueGuides'
import { ecmoReferenceProfiles } from '../../content/referenceProfiles'
import { createReferenceSimulationState, ecmoSimulationReducer } from '../../engine'
import type { EcmoSimulationState } from '../../engine/types'
import { GuidedValue, ModelBoundary, TextEquivalent, direction, round, styles } from './shared'

/**
 * A baseline review of one modeled VA circuit against itself.
 *
 * The VA mirror of the VV baseline review, and it makes the same argument: a stable run is a
 * reproducible relationship among signals rather than a set of numbers, so there are no bands, no
 * colour coding and no verdict. Each signal is shown three ways — the value now, the value in this
 * circuit's own reference state, and the raw change over the window that has been observed.
 *
 * What VA adds is a fifth group. Under venoarterial support the circuit and the native heart push
 * into the same aorta, and the signals that describe how that division is going — pulse pressure,
 * whether the aortic valve is opening, the difference between two arterial sampling sites, and the
 * limb below the arterial cannula — never appear on the console at all. A VA run can look entirely
 * unremarkable on screen while those signals have moved.
 *
 * The one classification that appears — the words higher, lower, or unchanged — comes from an
 * authored per-signal display deadband. Those deadbands exist so a value jittering in the last
 * decimal does not read as movement. **They are a display aid for this simulation and nothing
 * else**: they are not clinical tolerances, they do not mark a boundary of safety, and the raw
 * change is printed beside every one of them.
 */

/**
 * The deadbands live in content beside the guide that carries them as provenance, so the number a
 * panel uses and the number the guide states can never disagree. This panel reads the same record
 * the VV baseline review reads rather than authoring a second copy.
 */
const deadbands = ECMO_BASELINE_DISPLAY_DEADBANDS

/**
 * What a signal the authored record does not carry gets: no deadband at all.
 *
 * Inventing a number here would put a display tolerance on screen that no guide states and no
 * source backs. Zero means any change whatsoever reads as movement, which is the honest default —
 * and the raw change is printed beside the word either way.
 *
 * Reach for this only when `ECMO_BASELINE_DISPLAY_DEADBANDS` has no key for the signal. Using it
 * for a signal the record *does* carry would classify with a number the guide rendered below this
 * table contradicts, which is the exact drift keeping the deadbands in content is meant to prevent.
 */
const NO_DISPLAY_DEADBAND = 0

/**
 * The settled VA reference circuit, derived rather than transcribed.
 *
 * Only the profile's *inputs* are authored — pump speed, sweep, blender FiO₂, native cardiac output
 * and the oxygen consumption the model needs to close its own balance. Blood flow, every pressure,
 * every saturation, pulse pressure, valve opening, mean arterial pressure and limb perfusion are
 * all produced by the model from those inputs. The profile's `expected` block is a bound check on
 * that production, not a set of values: averaging a pair of bounds and printing the result as a
 * reference value would put numbers on screen that the model never produces, so the reference
 * column reads a freshly settled circuit instead.
 *
 * Twelve steps because this profile ramps for its first several modeled seconds — pulse pressure
 * and the femoral saturation are still moving early on — and is flat from the eighth second
 * onward. Twelve is comfortably past that, so the reference column is read off a settled run.
 */
let cachedReference: EcmoSimulationState | null = null
function vaReferenceCircuit(): EcmoSimulationState {
  if (!cachedReference) {
    let state = createReferenceSimulationState('va-reference')
    for (let tick = 0; tick < 12; tick += 1) {
      state = ecmoSimulationReducer(state, { type: 'STEP' })
    }
    cachedReference = state
  }
  return cachedReference
}

/** How the reference column got its number, shown so the two are never confused. */
type ReferenceProvenance = 'authored-input' | 'model-derived'

const provenanceLabel: Readonly<Record<ReferenceProvenance, string>> = {
  'authored-input': 'authored input',
  'model-derived': 'produced by the model',
}

const changeWord: Readonly<Record<'up' | 'down' | 'flat', string>> = {
  up: 'higher than',
  down: 'lower than',
  flat: 'unchanged from',
}

type BaselineGroupId =
  | 'drainage-and-load'
  | 'membrane-and-return'
  | 'gas-side'
  | 'patient'
  | 'parallel-circulation'

const groupLabels: Readonly<Record<BaselineGroupId, string>> = {
  'drainage-and-load': 'Drainage and load',
  'membrane-and-return': 'Membrane and return',
  'gas-side': 'Gas side',
  patient: 'Patient',
  'parallel-circulation': 'Parallel circulation — venoarterial only',
}

interface BaselineRow {
  readonly id: string
  readonly group: BaselineGroupId
  readonly label: string
  readonly unit: string
  readonly precision: number
  readonly current: number | null
  /** This circuit's reference value, and how the reference came by it. */
  readonly reference: number | null
  readonly referenceProvenance: ReferenceProvenance
  readonly start: number | null
  readonly deadband: number
  /** Present when the console would show no number here. */
  readonly unavailableReason?: string
  /**
   * For the two signals this simulation carries as a state rather than a quantity. They are words,
   * not numbers, so they have no change and no deadband — and the model boundary below says what
   * kind of thing produced them.
   */
  readonly stateWords?: { readonly current: string; readonly reference: string }
}

function format(value: number | null, precision: number, unit: string): string {
  if (value === null) return '--'
  return unit ? `${value.toFixed(precision)} ${unit}` : value.toFixed(precision)
}

function signed(value: number, precision: number): string {
  const rendered = Math.abs(value).toFixed(precision)
  if (Number(rendered) === 0) return `0${precision > 0 ? `.${'0'.repeat(precision)}` : ''}`
  return `${value > 0 ? '+' : '−'}${rendered}`
}

interface BaselineValues {
  bloodFlow: number | null
  rpmSetpoint: number | null
  pVen: number | null
  pInt: number | null
  pArt: number | null
  deltaP: number | null
  sweepLpm: number | null
  spo2: number | null
  paCO2: number | null
  pH: number | null
  venousLineSaturation: number | null
  systemicVenousSaturationEstimate: number | null
  nativeCardiacOutputLpm: number | null
  meanArterialPressure: number | null
  lactate: number | null
}

/**
 * The values this window is measured from: the learner's captured snapshot when there is one, and
 * otherwise the earliest trend sample the circuit has retained.
 *
 * Between them they carry one parallel-circulation signal and no more. Under VA the trended `spo2`
 * field *is* the right radial value, and the snapshot records the same quantity, so that one row
 * has an earlier value; pulse pressure, valve opening, the femoral sampling site and the limb probe
 * have none. That absence is the section's point rather than a gap in it: these are the signals
 * nothing on the machine is keeping for you.
 */
function windowStart(
  state: EcmoSimulationState,
  snapshot: EcmoFoundationSnapshot | null | undefined,
): { readonly label: string; readonly seconds: number; readonly values: Partial<BaselineValues> } {
  if (snapshot) {
    return {
      label: 'the snapshot captured in this session',
      seconds: Math.max(0, state.simulationTime - snapshot.simulationTime),
      values: {
        bloodFlow: snapshot.bloodFlow,
        rpmSetpoint: snapshot.rpmSetpoint,
        pVen: snapshot.pVen,
        pInt: snapshot.pInt,
        pArt: snapshot.pArt,
        deltaP: snapshot.deltaP,
        sweepLpm: snapshot.sweepLpm,
        spo2: snapshot.spo2,
        paCO2: snapshot.paCO2,
        pH: snapshot.pH,
        venousLineSaturation: snapshot.venousLineSaturation,
        systemicVenousSaturationEstimate: snapshot.systemicVenousSaturationEstimate,
        nativeCardiacOutputLpm: snapshot.nativeCardiacOutputLpm,
      },
    }
  }
  const first = state.trends[0]
  return {
    label: 'this circuit’s starting state',
    seconds: first ? Math.max(0, state.simulationTime - first.time) : 0,
    values: first
      ? {
          bloodFlow: first.flow,
          pVen: first.pVen,
          pInt: first.pInt,
          pArt: first.pArt,
          deltaP: first.deltaP,
          spo2: first.spo2,
          paCO2: first.paCO2,
          meanArterialPressure: first.map,
          lactate: first.lactate,
        }
      : {},
  }
}

function baselineRows(
  state: EcmoSimulationState,
  start: Partial<BaselineValues>,
): readonly BaselineRow[] {
  const { circuit, device, gas, patient } = state
  const profile = ecmoReferenceProfiles['va-reference']
  const reference = vaReferenceCircuit()

  return [
    {
      id: 'pVen',
      group: 'drainage-and-load',
      label: 'pVen',
      unit: 'mmHg',
      precision: 0,
      current: circuit.readouts.pVen.displayed,
      reference: reference.circuit.readouts.pVen.displayed,
      referenceProvenance: 'model-derived',
      start: start.pVen ?? null,
      deadband: deadbands.pVen,
      ...(circuit.readouts.pVen.displayed === null
        ? { unavailableReason: circuit.readouts.pVen.reason }
        : {}),
    },
    {
      id: 'bloodFlow',
      group: 'drainage-and-load',
      label: 'Circuit blood flow',
      unit: 'L/min',
      precision: 2,
      current: circuit.bloodFlow,
      reference: reference.circuit.bloodFlow,
      referenceProvenance: 'model-derived',
      start: start.bloodFlow ?? null,
      deadband: deadbands.bloodFlow,
    },
    {
      id: 'rpmSetpoint',
      group: 'drainage-and-load',
      label: 'Pump speed',
      unit: 'rpm',
      precision: 0,
      current: device.rpmSetpoint,
      reference: profile.inputs.rpmSetpoint,
      referenceProvenance: 'authored-input',
      start: start.rpmSetpoint ?? null,
      deadband: deadbands.rpmSetpoint,
    },
    {
      id: 'pInt',
      group: 'membrane-and-return',
      label: 'pInt',
      unit: 'mmHg',
      precision: 0,
      current: circuit.readouts.pInt.displayed,
      reference: reference.circuit.readouts.pInt.displayed,
      referenceProvenance: 'model-derived',
      start: start.pInt ?? null,
      deadband: deadbands.pInt,
      ...(circuit.readouts.pInt.displayed === null
        ? { unavailableReason: circuit.readouts.pInt.reason }
        : {}),
    },
    {
      id: 'pArt',
      group: 'membrane-and-return',
      label: 'pArt',
      unit: 'mmHg',
      precision: 0,
      current: circuit.readouts.pArt.displayed,
      reference: reference.circuit.readouts.pArt.displayed,
      referenceProvenance: 'model-derived',
      start: start.pArt ?? null,
      deadband: deadbands.pArt,
      ...(circuit.readouts.pArt.displayed === null
        ? { unavailableReason: circuit.readouts.pArt.reason }
        : {}),
    },
    {
      id: 'deltaP',
      group: 'membrane-and-return',
      label: 'ΔP across the membrane',
      unit: 'mmHg',
      precision: 0,
      current: circuit.readouts.deltaP.displayed,
      reference: reference.circuit.readouts.deltaP.displayed,
      referenceProvenance: 'model-derived',
      start: start.deltaP ?? null,
      deadband: deadbands.deltaP,
      ...(circuit.readouts.deltaP.displayed === null
        ? { unavailableReason: circuit.readouts.deltaP.reason }
        : {}),
    },
    {
      id: 'postOxygenatorSaturation',
      group: 'membrane-and-return',
      label: 'Post-membrane saturation',
      unit: '',
      precision: 1,
      current: circuit.postOxygenatorSaturation,
      reference: reference.circuit.postOxygenatorSaturation,
      referenceProvenance: 'model-derived',
      // Neither the snapshot record nor the retained samples carry this one.
      start: null,
      deadband: deadbands.postOxygenatorSaturation,
    },
    {
      id: 'sweepLpm',
      group: 'gas-side',
      label: 'Sweep gas',
      unit: 'L/min',
      precision: 1,
      current: gas.sweepLpm,
      reference: profile.inputs.gas.sweepLpm,
      referenceProvenance: 'authored-input',
      start: start.sweepLpm ?? null,
      deadband: deadbands.sweepLpm,
    },
    {
      id: 'fio2',
      group: 'gas-side',
      label: 'Blender FiO₂ (fraction)',
      unit: '',
      precision: 2,
      current: gas.fio2,
      reference: profile.inputs.gas.fio2,
      referenceProvenance: 'authored-input',
      start: null,
      deadband: NO_DISPLAY_DEADBAND,
    },
    {
      id: 'paCO2',
      group: 'gas-side',
      label: 'PaCO₂',
      unit: 'mmHg',
      precision: 1,
      current: patient.paCO2,
      reference: reference.patient.paCO2,
      referenceProvenance: 'model-derived',
      start: start.paCO2 ?? null,
      deadband: deadbands.paCO2,
    },
    {
      id: 'pH',
      group: 'gas-side',
      label: 'pH',
      unit: '',
      precision: 2,
      current: patient.pH,
      reference: reference.patient.pH,
      referenceProvenance: 'model-derived',
      start: start.pH ?? null,
      deadband: deadbands.pH,
    },
    {
      id: 'venousLineSaturation',
      group: 'patient',
      label: 'Drainage-limb saturation (console SvO₂ tile)',
      unit: '',
      precision: 1,
      current: circuit.readouts.venousLineSaturation.displayed,
      reference: reference.circuit.readouts.venousLineSaturation.displayed,
      referenceProvenance: 'model-derived',
      start: start.venousLineSaturation ?? null,
      deadband: deadbands.venousLineSaturation,
      ...(circuit.readouts.venousLineSaturation.displayed === null
        ? { unavailableReason: circuit.readouts.venousLineSaturation.reason }
        : {}),
    },
    {
      id: 'systemicVenousSaturationEstimate',
      group: 'patient',
      label: 'Systemic venous saturation (estimated, no sensor)',
      unit: '',
      precision: 1,
      current: patient.systemicVenousSaturationEstimate,
      reference: reference.patient.systemicVenousSaturationEstimate,
      referenceProvenance: 'model-derived',
      start: start.systemicVenousSaturationEstimate ?? null,
      deadband: deadbands.systemicVenousSaturationEstimate,
    },
    {
      id: 'spo2',
      group: 'patient',
      label: 'Patient SpO₂',
      unit: '',
      precision: 1,
      current: patient.spo2,
      reference: reference.patient.spo2,
      referenceProvenance: 'model-derived',
      start: start.spo2 ?? null,
      deadband: deadbands.spo2,
    },
    {
      id: 'lactate',
      group: 'patient',
      label: 'Lactate',
      unit: 'mmol/L',
      precision: 1,
      current: patient.lactate,
      reference: reference.patient.lactate,
      referenceProvenance: 'model-derived',
      start: start.lactate ?? null,
      deadband: NO_DISPLAY_DEADBAND,
    },
    {
      id: 'meanArterialPressure',
      group: 'patient',
      label: 'Mean arterial pressure',
      unit: 'mmHg',
      precision: 0,
      current: patient.meanArterialPressure,
      reference: reference.patient.meanArterialPressure,
      referenceProvenance: 'model-derived',
      start: start.meanArterialPressure ?? null,
      deadband: deadbands.meanArterialPressure,
    },
    {
      id: 'pulsePressure',
      group: 'parallel-circulation',
      label: 'Pulse pressure',
      unit: 'mmHg',
      precision: 0,
      current: patient.pulsePressure,
      reference: reference.patient.pulsePressure,
      referenceProvenance: 'model-derived',
      start: null,
      deadband: deadbands.pulsePressure,
    },
    {
      id: 'aorticValveOpening',
      group: 'parallel-circulation',
      label: 'Aortic valve',
      unit: '',
      precision: 0,
      current: null,
      reference: null,
      referenceProvenance: 'model-derived',
      start: null,
      deadband: NO_DISPLAY_DEADBAND,
      stateWords: {
        current: patient.aorticValveOpening ? 'opening' : 'not opening',
        reference: reference.patient.aorticValveOpening ? 'opening' : 'not opening',
      },
    },
    {
      id: 'rightRadialSpo2',
      group: 'parallel-circulation',
      label: 'Right radial arterial saturation',
      unit: '',
      precision: 1,
      current: patient.rightRadialSpo2,
      reference: reference.patient.rightRadialSpo2,
      referenceProvenance: 'model-derived',
      start: null,
      deadband: deadbands.rightRadialSpo2,
    },
    {
      id: 'femoralArterialSpo2',
      group: 'parallel-circulation',
      label: 'Femoral arterial saturation',
      unit: '',
      precision: 1,
      current: patient.femoralArterialSpo2,
      reference: reference.patient.femoralArterialSpo2,
      referenceProvenance: 'model-derived',
      start: null,
      deadband: deadbands.femoralArterialSpo2,
    },
    {
      id: 'arterialSamplingGap',
      group: 'parallel-circulation',
      label: 'Femoral minus right radial saturation',
      unit: '',
      precision: 1,
      current: patient.femoralArterialSpo2 - patient.rightRadialSpo2,
      reference: reference.patient.femoralArterialSpo2 - reference.patient.rightRadialSpo2,
      referenceProvenance: 'model-derived',
      start: null,
      deadband: deadbands.upperToLowerSaturationGap,
    },
    {
      id: 'distalLimbPerfusion',
      group: 'parallel-circulation',
      label: 'Distal limb perfusion',
      unit: '',
      precision: 0,
      current: null,
      reference: null,
      referenceProvenance: 'model-derived',
      start: null,
      deadband: NO_DISPLAY_DEADBAND,
      stateWords: {
        current: patient.distalLimbPerfusion,
        reference: reference.patient.distalLimbPerfusion,
      },
    },
    {
      id: 'distalLimbNirs',
      group: 'parallel-circulation',
      label: 'Distal limb near-infrared reading',
      unit: '',
      precision: 0,
      current: patient.distalLimbNirs,
      reference: reference.patient.distalLimbNirs,
      referenceProvenance: 'model-derived',
      start: null,
      deadband: deadbands.distalLimbNirs,
    },
    {
      id: 'nativeCardiacOutputLpm',
      group: 'parallel-circulation',
      label: 'Native cardiac output',
      unit: 'L/min',
      precision: 1,
      current: patient.nativeCardiacOutputLpm,
      reference: profile.inputs.patient.nativeCardiacOutputLpm ?? null,
      referenceProvenance: 'authored-input',
      start: start.nativeCardiacOutputLpm ?? null,
      deadband: deadbands.nativeCardiacOutputLpm,
    },
  ]
}

function ChangeCell({ row }: { readonly row: BaselineRow }) {
  if (row.stateWords) {
    return (
      <span className="text-xs text-muted-foreground" data-change="not-comparable">
        no earlier state retained
      </span>
    )
  }
  if (row.current === null || row.start === null) {
    return (
      <span className="text-xs text-muted-foreground" data-change="not-comparable">
        no comparison available
      </span>
    )
  }
  const delta = row.current - row.start
  const word = changeWord[direction(delta, row.deadband)]
  return (
    <span data-change={word.replace(/ .*/, '')}>
      <span className="font-semibold">{signed(delta, row.precision)}</span>
      <span className="ml-1 text-xs text-muted-foreground">{word} the earlier value</span>
    </span>
  )
}

/** One row rendered as a sentence, so the table's numbers exist outside the table. */
function rowSentence(row: BaselineRow, windowLabel: string): string {
  const referencePhrase = `${provenanceLabel[row.referenceProvenance]}`
  if (row.stateWords) {
    return `${row.label} is ${row.stateWords.current}, and this circuit’s reference state reports ${row.stateWords.reference} (${referencePhrase}), with no earlier state retained to compare against`
  }
  const now = row.current === null ? 'not reported' : format(row.current, row.precision, row.unit)
  const referenceValue =
    row.reference === null
      ? 'not reported in the reference state'
      : `${format(row.reference, row.precision, row.unit)} (${referencePhrase})`
  const change =
    row.current === null || row.start === null
      ? 'with no earlier value retained to compare against'
      : `${changeWord[direction(row.current - row.start, row.deadband)]} ${windowLabel} by ${signed(row.current - row.start, row.precision)}`
  return `${row.label} is ${now}, against ${referenceValue}, ${change}`
}

export function VaNormalStatePanel({
  state,
  snapshot,
}: {
  readonly state: EcmoSimulationState
  readonly snapshot?: EcmoFoundationSnapshot | null
}) {
  const window = windowStart(state, snapshot)
  const rows = baselineRows(state, window.values)
  const flowRow = rows.find((row) => row.id === 'bloodFlow')
  // Counted off the rendered rows rather than written into the copy, so the boundary below cannot
  // claim a different number of authored values from the number the table actually marks.
  const authoredReferenceRows = rows.filter((row) => row.referenceProvenance === 'authored-input')
  const groups: readonly BaselineGroupId[] = [
    'drainage-and-load',
    'membrane-and-return',
    'gas-side',
    'patient',
    'parallel-circulation',
  ]

  return (
    <div className={styles.panel} data-teaching-panel="va-normal-state">
      <section className={styles.section} aria-labelledby="va-baseline-heading">
        <h3 id="va-baseline-heading" className={styles.heading}>
          Baseline review — this modeled circuit against itself
        </h3>
        <p className="mt-2 text-sm leading-6">
          Each signal is shown three ways: the value now, the value in this circuit&rsquo;s own
          reference state, and the raw change since {window.label}
          {window.seconds > 0
            ? `, over the ${window.seconds.toFixed(0)} modeled seconds observed so far`
            : ', which was taken at this same moment, so nothing has moved yet'}
          . Nothing here is compared with a value from any other circuit or any other patient. Where
          a row says no comparison is available, neither the captured snapshot nor the retained
          samples hold an earlier value for that signal — which is worth noticing rather than
          skipping past.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm" data-baseline-table>
            <caption className="sr-only">
              Each observed signal with its current value, the value in this circuit’s own reference
              state together with whether that value was authored or produced by the model, and the
              raw change over the observed window, grouped by where in the circuit or the patient it
              belongs. The final group holds the signals that exist only under venoarterial support.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  Signal
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  Now
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  This circuit’s reference state
                </th>
                <th scope="col" className="pb-1 font-semibold">
                  Change over the observed window
                </th>
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group} data-baseline-group={group}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={4}
                    className="pt-3 text-xs uppercase tracking-wide text-muted-foreground"
                  >
                    {groupLabels[group]}
                  </th>
                </tr>
                {rows
                  .filter((row) => row.group === group)
                  .map((row) => (
                    <tr key={row.id} data-baseline-row={row.id}>
                      <th scope="row" className="py-1 pr-3 font-medium">
                        {row.label}
                      </th>
                      <td className="py-1 pr-3" data-current-value>
                        {row.stateWords
                          ? row.stateWords.current
                          : format(row.current, row.precision, row.unit)}
                        {row.unavailableReason ? (
                          <span className="sr-only"> Not available. {row.unavailableReason}</span>
                        ) : null}
                      </td>
                      <td
                        className="py-1 pr-3 text-muted-foreground"
                        data-reference-value
                        data-reference-provenance={row.referenceProvenance}
                      >
                        {row.stateWords
                          ? row.stateWords.reference
                          : row.reference === null
                            ? 'not reported in the reference state'
                            : format(row.reference, row.precision, row.unit)}
                        <span className="ml-1 text-xs">
                          ({provenanceLabel[row.referenceProvenance]})
                        </span>
                      </td>
                      <td className="py-1">
                        <ChangeCell row={row} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
        </div>

        <TextEquivalent>
          {rows.map((row) => rowSentence(row, window.label)).join('. ')}.
        </TextEquivalent>

        <ModelBoundary>
          The words higher, lower and unchanged come from an authored per-signal display deadband
          for this simulation, so that a value moving in its last decimal does not read as a change.
          The deadbands are a display aid only. They are not clinical tolerances, they mark no
          boundary of safety, and the raw change is printed beside every one of them. Signals the
          authored record does not carry are given no deadband at all here, so any movement in them
          reads as movement. The guide below states every authored deadband and where it came from.
        </ModelBoundary>

        <ModelBoundary>
          The reference column carries {authoredReferenceRows.length} authored values:{' '}
          {authoredReferenceRows.map((row) => row.label).join(', ')}. One further authored input —
          the oxygen consumption this simulation needs in order to close its own oxygen balance —
          has no row here at all. Everything else in that column — the flow, every pressure, every
          saturation, the pulse pressure, the valve state, the mean arterial pressure, the limb
          readings — was produced by the model from those inputs, and is marked as such. None of
          them is a value to reproduce at a bedside: cannula size and position, patient size,
          temperature, hemoglobin, the device configuration and local protocol all move every one of
          them.
        </ModelBoundary>
      </section>

      <GuidedValue
        guide={ecmoDerivedValueGuides.baselineChangeFromEarlierValue}
        value={
          !flowRow || flowRow.current === null || flowRow.start === null
            ? null
            : round(flowRow.current - flowRow.start, 2)
        }
        headingLevel={3}
      />

      <section className={styles.section} aria-labelledby="va-parallel-heading">
        <h3 id="va-parallel-heading" className={styles.heading}>
          What a venoarterial normal state includes that the console never shows
        </h3>
        {state.supportMode === 'va' ? null : (
          <p className="mt-2 rounded-xl border px-3 py-2 text-sm leading-6" data-mode-note>
            The circuit on screen is not running venoarterial support, so the parallel-circulation
            rows above are this simulation&rsquo;s venovenous defaults and carry none of the meaning
            described here.
          </p>
        )}
        <p className="mt-2 text-sm leading-6">
          Under venoarterial support the circuit and the native heart push into the same aorta, and
          how that circulation is divided between them is not a console parameter. Pulse pressure
          comes from an arterial line trace. Whether the aortic valve is opening comes from an echo
          image. The difference between the two arterial sampling sites comes from drawing blood in
          two places. What the leg below the arterial cannula is receiving comes from looking at the
          leg and from a probe placed on it. The console reports the circuit, and the circuit can
          look entirely settled while any of these has moved.
        </p>
        <p className="mt-2 text-sm leading-6">
          The two sampling sites are the clearest case. Blood at the right wrist arrives from what
          the native heart ejected, having passed through the native lungs; blood at the femoral
          sheath arrives from what the membrane returned. When those two sources differ in
          oxygenation, the same patient carries two different arterial saturations at the same
          moment, and a single probe on a single limb reports only one of them. The observable is
          the difference between the sites, read against this circuit&rsquo;s own earlier difference
          — not against any number carried in from elsewhere.
        </p>

        <ModelBoundary>
          In this simulation pulse pressure, aortic valve opening, pulmonary congestion and distal
          limb perfusion are authored states rather than quantities falling out of a ventricular or
          vascular model: the simulation moves them toward values it holds for each configuration,
          so &ldquo;produced by the model&rdquo; here means selected from that authored table, not
          computed from chamber pressures or vascular resistance. The two arterial saturations
          behave the same way — they move toward authored values rather than being mixed from two
          competing flows. This simulation also holds distal limb perfusion fixed across every
          venoarterial preset, changing it only when a case injects a limb problem, so its reference
          value shows the state and says nothing about how it would move. Patient SpO₂ under
          venoarterial support is reported here as the right radial value, which is why those two
          rows carry the same number.
        </ModelBoundary>
      </section>

      <section className={styles.section} aria-labelledby="va-drift-heading">
        <h3 id="va-drift-heading" className={styles.heading}>
          Reading drift from this patient–circuit baseline
        </h3>
        <p className="mt-2 text-sm leading-6">
          Every failure pattern later in this pathway is a drift from this patient–circuit baseline:
          a drainage pressure that has become more negative than it was, a gradient that has been
          climbing, a pulse that has flattened, a difference between two sampling sites that has
          widened, a limb that has changed. What makes any of them legible is that the run was
          previously steady and that the change is being read against the run&rsquo;s own earlier
          values rather than against a number from somewhere else. The comparison that transfers out
          of this simulation is that one — this circuit against itself over time.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="va-trend-window-heading">
        <h3 id="va-trend-window-heading" className={styles.heading}>
          The observed window, sample by sample
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm" data-trend-table>
            <caption className="sr-only">
              Retained trend samples for this circuit, showing modeled time, circuit flow, drainage
              pressure, the membrane gradient, patient saturation, mean arterial pressure and
              lactate. Under venoarterial support the saturation column is the right radial value.
              Pulse pressure, aortic-valve opening, the femoral saturation and the limb readings are
              not retained here.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  Modeled time
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  Flow
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  pVen
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  ΔP
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  SpO₂
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  MAP
                </th>
                <th scope="col" className="pb-1 font-semibold">
                  Lactate
                </th>
              </tr>
            </thead>
            <tbody>
              {state.trends.slice(-6).map((sample) => (
                <tr key={sample.time} data-trend-sample={sample.time}>
                  <th scope="row" className="py-1 pr-3 font-medium">
                    {sample.time.toFixed(0)} s
                  </th>
                  <td className="py-1 pr-3">{sample.flow.toFixed(2)}</td>
                  <td className="py-1 pr-3">{sample.pVen.toFixed(0)}</td>
                  <td className="py-1 pr-3">{sample.deltaP.toFixed(0)}</td>
                  <td className="py-1 pr-3">{sample.spo2.toFixed(1)}</td>
                  <td className="py-1 pr-3">{sample.map.toFixed(0)}</td>
                  <td className="py-1">{sample.lactate.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TextEquivalent>
          {state.trends.length === 0
            ? 'No samples have been retained yet.'
            : `The last ${Math.min(6, state.trends.length)} retained samples run from ${state.trends.slice(-6)[0]?.time.toFixed(0)} to ${round(state.simulationTime, 0)} modeled seconds, and read ${state.trends
                .slice(-6)
                .map(
                  (sample) =>
                    `at ${sample.time.toFixed(0)} seconds flow ${sample.flow.toFixed(2)}, pVen ${sample.pVen.toFixed(0)}, gradient ${sample.deltaP.toFixed(0)}, saturation ${sample.spo2.toFixed(1)}, mean arterial pressure ${sample.map.toFixed(0)}, lactate ${sample.lactate.toFixed(1)}`,
                )
                .join(
                  '; ',
                )}. What a baseline review reads from a window like this is whether the relationship among the signals is holding, not whether any single value is familiar.`}
        </TextEquivalent>

        <ModelBoundary>
          The window here is modeled seconds. A bedside baseline is established and re-read over
          hours, and the drift a real circuit shows over that time has no counterpart in this
          simulation. Of the parallel-circulation signals, exactly one is retained: under
          venoarterial support the saturation kept in this table is the right radial value, which is
          why the Patient SpO₂ row of the baseline review has an earlier value to compare against
          while the right radial row, carrying that same number, is shown without one. Pulse
          pressure, aortic-valve opening, the femoral saturation and the limb readings are not
          retained at all, so nothing in this table would show a pulse flattening or a sampling-site
          difference opening up.
        </ModelBoundary>
      </section>

      <section className={styles.section} aria-labelledby="va-beyond-circuit-heading">
        <h3 id="va-beyond-circuit-heading" className={styles.heading}>
          What else belongs to the state
        </h3>
        <ul className="mt-3 grid gap-2" data-patient-context>
          <li className="rounded-xl border px-3 py-2 text-sm leading-6">
            Native cardiac output is not a bystander in venoarterial support. The circuit and the
            heart divide one circulation between them, and a change on either side changes the
            division.
          </li>
          <li className="rounded-xl border px-3 py-2 text-sm leading-6">
            The native lungs still matter even though the circuit returns arterial blood. Whatever
            the heart ejects has passed through them, and that is the blood the upper body receives.
          </li>
          <li className="rounded-xl border px-3 py-2 text-sm leading-6">
            Left-sided loading belongs to the picture too. This simulation carries a pulmonary
            congestion state, currently reported as {state.patient.pulmonaryCongestion}, alongside
            the pulse pressure and valve rows above.
          </li>
          <li className="rounded-xl border px-3 py-2 text-sm leading-6">
            Volume state, temperature, hemoglobin, sedation and the afterload the returning circuit
            blood imposes all sit inside this picture, and every one of them changes how the numbers
            above should be read.
          </li>
          <li className="rounded-xl border px-3 py-2 text-sm leading-6">
            A measurement can also be wrong, and in venoarterial support it can be right about
            something other than what was assumed — which limb a saturation came from is part of
            what the number is. Before a change is treated as physiology, it is worth establishing
            that the channel reporting it is reporting properly, and from where.
          </li>
          <li className="rounded-xl border px-3 py-2 text-sm leading-6">
            A direction of travel over a window carries more than any one reading taken alone.
          </li>
        </ul>
      </section>
    </div>
  )
}
