import type { EcmoFoundationSnapshot } from '../../session/foundationSession'
import {
  ECMO_BASELINE_DISPLAY_DEADBANDS,
  ecmoDerivedValueGuides,
} from '../../content/ecmoValueGuides'
import { ecmoReferenceProfiles } from '../../content/referenceProfiles'
import { createReferenceSimulationState, ecmoSimulationReducer } from '../../engine'
import type { EcmoSimulationState } from '../../engine/types'
import {
  GuidedValue,
  ModelBoundary,
  TextEquivalent,
  direction,
  round,
  styles,
  trendCell,
} from './shared'

/**
 * A baseline review of one modeled circuit against itself.
 *
 * The section it belongs to argues that a stable run is a reproducible relationship among signals
 * rather than a set of numbers, so this panel deliberately has no bands, no colour coding and no
 * verdict. It shows three things per signal: the value now, the value this profile authored as its
 * own starting point, and the raw change over the window that has been observed.
 *
 * The one classification that appears — the words higher, lower, or unchanged — comes from an
 * authored per-signal display deadband. Those deadbands exist so a value jittering in the last
 * decimal does not read as movement. **They are a display aid for this simulation and nothing
 * else**: they are not clinical tolerances, they do not mark a boundary of safety, and the raw
 * change is printed beside every one of them so a reader never has to take the word for it.
 */

/**
 * The deadbands live in content beside the guide that carries them as provenance, so the number the
 * panel uses and the number the guide states can never disagree. Re-exported here because this is
 * the only surface that consumes them.
 */
export const VV_BASELINE_DISPLAY_DEADBANDS = ECMO_BASELINE_DISPLAY_DEADBANDS

/**
 * The settled VV reference circuit, derived rather than transcribed.
 *
 * Only the profile's *inputs* are authored — pump speed, sweep, native cardiac output. Blood flow,
 * the three pressures and every saturation are produced by the model, and the profile's `expected`
 * block is a bound check on that production, not a set of values. Averaging those bounds and
 * printing the result as a reference value would put three numbers on screen that the model never
 * produces, so the reference column reads the model instead.
 */
let cachedReference: EcmoSimulationState | null = null
function vvReferenceCircuit(): EcmoSimulationState {
  if (!cachedReference) {
    let state = createReferenceSimulationState('vv-reference')
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

type BaselineGroupId = 'drainage-and-load' | 'membrane-and-return' | 'gas-side' | 'patient'

const groupLabels: Readonly<Record<BaselineGroupId, string>> = {
  'drainage-and-load': 'Drainage and load',
  'membrane-and-return': 'Membrane and return',
  'gas-side': 'Gas side',
  patient: 'Patient',
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

/**
 * The values this window is measured from: the learner's captured snapshot when there is one, and
 * otherwise the earliest trend sample the circuit has retained.
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
        nativeCardiacOutputLpm: snapshot.nativeCardiacOutputLpm,
        recirculationAdjustedCircuitFlowLpm: snapshot.recirculationAdjustedCircuitFlowLpm,
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
        }
      : {},
  }
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
  nativeCardiacOutputLpm: number | null
  recirculationAdjustedCircuitFlowLpm: number | null
}

function baselineRows(
  state: EcmoSimulationState,
  start: Partial<BaselineValues>,
): readonly BaselineRow[] {
  const { circuit, device, gas, patient } = state
  const profile = ecmoReferenceProfiles['vv-reference']
  const reference = vvReferenceCircuit()

  return [
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
      deadband: VV_BASELINE_DISPLAY_DEADBANDS.bloodFlow,
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
      deadband: VV_BASELINE_DISPLAY_DEADBANDS.rpmSetpoint,
    },
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
      deadband: VV_BASELINE_DISPLAY_DEADBANDS.pVen,
      ...(circuit.readouts.pVen.displayed === null
        ? { unavailableReason: circuit.readouts.pVen.reason }
        : {}),
    },
    {
      id: 'venousLineSaturation',
      group: 'drainage-and-load',
      label: 'Venous-line SvO₂',
      unit: '',
      precision: 1,
      current: circuit.readouts.venousLineSaturation.displayed,
      reference: reference.circuit.readouts.venousLineSaturation.displayed,
      referenceProvenance: 'model-derived',
      start: start.venousLineSaturation ?? null,
      deadband: VV_BASELINE_DISPLAY_DEADBANDS.venousLineSaturation,
      ...(circuit.readouts.venousLineSaturation.displayed === null
        ? { unavailableReason: circuit.readouts.venousLineSaturation.reason }
        : {}),
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
      deadband: VV_BASELINE_DISPLAY_DEADBANDS.pInt,
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
      deadband: VV_BASELINE_DISPLAY_DEADBANDS.pArt,
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
      deadband: VV_BASELINE_DISPLAY_DEADBANDS.deltaP,
      ...(circuit.readouts.deltaP.displayed === null
        ? { unavailableReason: circuit.readouts.deltaP.reason }
        : {}),
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
      deadband: VV_BASELINE_DISPLAY_DEADBANDS.sweepLpm,
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
      deadband: VV_BASELINE_DISPLAY_DEADBANDS.paCO2,
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
      deadband: VV_BASELINE_DISPLAY_DEADBANDS.pH,
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
      deadband: VV_BASELINE_DISPLAY_DEADBANDS.spo2,
    },
    {
      id: 'nativeCardiacOutputLpm',
      group: 'patient',
      label: 'Native cardiac output',
      unit: 'L/min',
      precision: 1,
      current: patient.nativeCardiacOutputLpm,
      reference: profile.inputs.patient.nativeCardiacOutputLpm ?? null,
      referenceProvenance: 'authored-input',
      start: start.nativeCardiacOutputLpm ?? null,
      deadband: VV_BASELINE_DISPLAY_DEADBANDS.nativeCardiacOutputLpm,
    },
    {
      id: 'recirculationAdjustedCircuitFlowLpm',
      group: 'patient',
      label: 'Recirculation-adjusted circuit flow',
      unit: 'L/min',
      precision: 2,
      current: circuit.recirculationAdjustedCircuitFlowLpm,
      reference: reference.circuit.recirculationAdjustedCircuitFlowLpm,
      referenceProvenance: 'model-derived',
      start: start.recirculationAdjustedCircuitFlowLpm ?? null,
      deadband: VV_BASELINE_DISPLAY_DEADBANDS.recirculationAdjustedCircuitFlowLpm,
    },
  ]
}

function ChangeCell({ row }: { readonly row: BaselineRow }) {
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

export function VvNormalStatePanel({
  state,
  snapshot,
}: {
  readonly state: EcmoSimulationState
  readonly snapshot?: EcmoFoundationSnapshot | null
}) {
  const window = windowStart(state, snapshot)
  const rows = baselineRows(state, window.values)
  const groups: readonly BaselineGroupId[] = [
    'drainage-and-load',
    'membrane-and-return',
    'gas-side',
    'patient',
  ]

  return (
    <div className={styles.panel} data-teaching-panel="vv-normal-state">
      {/*
        A short topology statement before the stable state, because this section now comes before
        the one that draws the series path in detail. A baseline is unreadable without knowing what
        the circuit is a baseline of.
      */}
      <section className={styles.section} aria-labelledby="vv-topology-heading" data-topology-lead>
        <h3 id="vv-topology-heading" className={styles.heading}>
          Where this circuit sits, in one paragraph
        </h3>
        <p className="mt-2 text-sm leading-6">
          Venovenous support drains blood from the venous side, carries it through the membrane
          lung, and returns it to the venous side. The circuit therefore sits{' '}
          <strong>in series</strong> with the patient&rsquo;s own circulation: it changes the oxygen
          content of blood arriving at the right heart, and adds no circulatory support at all. The
          native heart still does every bit of the pumping, and the native lungs are still in the
          path. Because both cannulae sit in the venous circulation, some of what the circuit
          returns can be drained again before it has been anywhere — the mechanism the next section
          works through in detail.
        </p>
        <TextEquivalent>
          In venovenous support the circuit is in series with the patient: venous drainage, membrane
          lung, venous return. It changes blood oxygen content and provides no circulatory support.
          Native cardiac output remains the systemic pump.
        </TextEquivalent>
      </section>

      <section className={styles.section} aria-labelledby="baseline-heading">
        <h3 id="baseline-heading" className={styles.heading}>
          Baseline review — this modeled circuit against itself
        </h3>
        <p className="mt-2 text-sm leading-6">
          Each signal is shown three ways: the value now, the value in this circuit&rsquo;s own
          reference state, and the raw change since {window.label}
          {window.seconds > 0
            ? `, over the ${window.seconds.toFixed(0)} modeled seconds observed so far`
            : ', which was taken at this same moment, so nothing has moved yet'}
          . Nothing here is compared with a value from any other circuit or any other patient.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm" data-baseline-table>
            <caption className="sr-only">
              Each observed signal with its current value, the value in this circuit’s own reference
              state together with whether that value was authored or produced by the model, and the
              raw change over the observed window, grouped by where in the circuit or the patient it
              belongs.
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
                        {format(row.current, row.precision, row.unit)}
                        {row.unavailableReason ? (
                          <span className="sr-only"> Not available. {row.unavailableReason}</span>
                        ) : null}
                      </td>
                      <td
                        className="py-1 pr-3 text-muted-foreground"
                        data-reference-value
                        data-reference-provenance={row.referenceProvenance}
                      >
                        {row.reference === null
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
          {rows
            .map((row) =>
              row.current === null
                ? `${row.label} is not available, ${
                    row.unavailableReason ?? 'the channel is not reporting a value'
                  }`
                : `${row.label} is ${format(row.current, row.precision, row.unit)}${
                    row.start === null
                      ? ''
                      : `, ${changeWord[direction(row.current - row.start, row.deadband)]} ${window.label} by ${signed(row.current - row.start, row.precision)}`
                  }`,
            )
            .join('. ')}
          .
        </TextEquivalent>

        <ModelBoundary>
          The words higher, lower and unchanged come from an authored per-signal display deadband
          for this simulation, so that a value moving in its last decimal does not read as a change.
          The deadbands are a display aid only. They are not clinical tolerances, they mark no
          boundary of safety, and the raw change is printed beside every one of them. The guide
          below states every one of them and where it came from.
        </ModelBoundary>

        <ModelBoundary>
          Only three values in the reference column were authored: the pump speed, the sweep, and
          the native cardiac output. Everything else in it was produced by the model from those
          inputs, and is marked as such. None of them is a value to reproduce at a bedside — cannula
          size and position, patient size, temperature, hemoglobin, the device configuration and
          local protocol all move every one of them.
        </ModelBoundary>
      </section>

      <GuidedValue
        guide={ecmoDerivedValueGuides.baselineChangeFromEarlierValue}
        value={
          rows[0].current === null || rows[0].start === null
            ? null
            : round(rows[0].current - rows[0].start, 2)
        }
        headingLevel={3}
      />

      <section className={styles.section} aria-labelledby="drift-heading">
        <h3 id="drift-heading" className={styles.heading}>
          Reading drift from this patient–circuit baseline
        </h3>
        <p className="mt-2 text-sm leading-6">
          Every failure pattern later in this pathway is a drift from this patient–circuit baseline:
          a drainage pressure that has become more negative than it was, a gradient that has been
          climbing for hours, a saturation that has moved. What makes any of them legible is that
          the run was previously steady and that the change is being read against the run&rsquo;s
          own earlier values rather than against a number from somewhere else.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="trend-window-heading">
        <h3 id="trend-window-heading" className={styles.heading}>
          The observed window, sample by sample
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm" data-trend-table>
            <caption className="sr-only">
              Retained trend samples for this circuit, showing modeled time, circuit flow, drainage
              pressure, the membrane gradient, patient saturation and arterial carbon dioxide.
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
                <th scope="col" className="pb-1 font-semibold">
                  PaCO₂
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
                  <td className="py-1 pr-3">{trendCell(sample.pVen)}</td>
                  <td className="py-1 pr-3">{trendCell(sample.deltaP)}</td>
                  <td className="py-1 pr-3">{sample.spo2.toFixed(1)}</td>
                  <td className="py-1">{sample.paCO2.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TextEquivalent>
          {state.trends.length === 0
            ? 'No samples have been retained yet.'
            : `The last ${Math.min(6, state.trends.length)} retained samples run from ${state.trends.slice(-6)[0]?.time.toFixed(0)} to ${round(state.simulationTime, 0)} modeled seconds. What a baseline review reads from a window like this is whether the relationship among the signals is holding, not whether any single value is familiar.`}
        </TextEquivalent>

        <ModelBoundary>
          The window here is modeled seconds. A bedside baseline is established and re-read over
          hours, and the drift a real circuit shows over that time has no counterpart in this
          simulation.
        </ModelBoundary>
      </section>

      <section className={styles.section} aria-labelledby="beyond-circuit-heading">
        <h3 id="beyond-circuit-heading" className={styles.heading}>
          What else belongs to the state
        </h3>
        <ul className="mt-3 grid gap-2" data-patient-context>
          <li className="rounded-xl border px-3 py-2 text-sm leading-6">
            The native lungs are still in the path and still contributing whatever gas exchange they
            can. The circuit is not the only lung in the picture.
          </li>
          <li className="rounded-xl border px-3 py-2 text-sm leading-6">
            Native cardiac output remains essential: in VV support it does all of the circulatory
            work, and the circuit adds none.
          </li>
          <li className="rounded-xl border px-3 py-2 text-sm leading-6">
            Ventilator settings, sedation, temperature, hemoglobin and volume state all sit inside
            this picture, and every one of them changes how the numbers above should be read.
          </li>
          <li className="rounded-xl border px-3 py-2 text-sm leading-6">
            A measurement can also be wrong. Before a change is treated as physiology, it is worth
            establishing that the channel reporting it is reporting properly.
          </li>
          <li className="rounded-xl border px-3 py-2 text-sm leading-6">
            A direction of travel over a window carries more than any one reading taken alone.
          </li>
        </ul>
      </section>
    </div>
  )
}
