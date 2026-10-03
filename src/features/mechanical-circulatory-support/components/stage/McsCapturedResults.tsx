import { mcsDeviceNaming } from '../../content/deviceNaming'
import type { McsObservedSignal } from '../../content/sectionLearningContracts'
import {
  mcsConfigurationLabel,
  mcsObservedDirection,
  type McsDeviceComparison,
} from '../../engine/learningSession'
import type { McsDeviceKind, McsSimulationState } from '../../engine/types'
import styles from './mcs-stage.module.css'

export type McsComparisonRecords = Partial<Record<McsDeviceKind, McsDeviceComparison>>

const signed = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`

/** Whether the three figures still add up after each is rounded for display; if not, say "≈". */
function closesAsDisplayed(pump: number, native: number, effective: number): boolean {
  const shown = (value: number) => Number(value.toFixed(2))
  return Math.abs(shown(pump) + shown(native) - shown(effective)) < 0.005
}

/**
 * The three flow lines of one pump, set against the balloon, as arithmetic (F13).
 *
 * The Observe step said effective systemic delivery "does not move by the size of the device
 * number", which read as though delivery did not follow the pump at all — while the table beside
 * it rose in step. What the comparison shows is narrower and more useful: the pump's line rises,
 * the native line falls as the pump takes over, and effective delivery rises by the difference.
 *
 * Every figure is read from the records the learner captured in this run. Nothing is authored,
 * rounded toward a tidier sum, or shown before a record exists; where the three displayed deltas do
 * not close to the hundredth, the line says what the remainder is instead of hiding it.
 */
export function McsFlowArithmetic({ records }: { readonly records: McsComparisonRecords }) {
  const reference = records.iabp?.state.metrics
  const pumps = (
    [
      ['impella', mcsDeviceNaming('impella-cp').shortLabel],
      ['lvad', mcsDeviceNaming('lvad').shortLabel],
    ] as const
  ).filter(([device]) => records[device])
  if (!reference || pumps.length === 0) {
    return (
      <p data-flow-arithmetic="awaiting">
        The arithmetic appears here once the IABP and at least one pump have been captured on the
        Act step. Until then: the pump line rises, the native line falls as the pump takes over, and
        effective systemic delivery rises by the difference between the two.
      </p>
    )
  }
  return (
    <div data-flow-arithmetic="captured">
      <p>
        <strong>Three separate lines, one sum.</strong> Against the captured{' '}
        {mcsDeviceNaming('iabp').shortLabel} record, in L/min:
      </p>
      <ul>
        {pumps.map(([device, label]) => {
          const metrics = records[device]!.state.metrics
          const pump = metrics.deviceFlowLMin
          const native = metrics.nativeFlowLMin - reference.nativeFlowLMin
          const effective = metrics.effectiveSystemicFlowLMin - reference.effectiveSystemicFlowLMin
          const remainder = effective - (pump + native)
          return (
            <li key={device} data-flow-arithmetic-device={device}>
              <strong>{label}:</strong> pump estimate{' '}
              <span data-delta="device">{signed(pump)}</span>, concurrent native{' '}
              <span data-delta="native">{signed(native)}</span>, modeled effective{' '}
              <span data-delta="effective">{signed(effective)}</span>.{' '}
              {Math.abs(remainder) < 0.015
                ? `${pump.toFixed(2)} ${native >= 0 ? '+' : '−'} ${Math.abs(native).toFixed(2)} ${
                    closesAsDisplayed(pump, native, effective) ? '=' : '≈'
                  } ${effective.toFixed(2)}: effective delivery rose by less than the pump number, because native ejection fell as the pump took over.`
                : `The three do not close exactly: ${signed(remainder)} is regurgitant recirculation or a model limit counted out of the effective line.`}
            </li>
          )
        })}
      </ul>
      <p>
        The balloon has no pump line, so its pump estimate counts as zero here. These are this run’s
        modeled values at nominal settings; they compare what each mechanism does and are not
        equivalent doses or a reason to choose a device.
      </p>
    </div>
  )
}
export function McsDeviceComparisonTable({ records }: { records: McsComparisonRecords }) {
  return (
    <div className={styles.block} data-retained-comparison>
      <h3>Three retained device results</h3>
      <p>
        One reference patient throughout. Each selection resets patient and compartments, then
        observes eight simulated seconds. No additional patient variables changed. Nominal settings
        are not equivalent doses.
      </p>
      <div className={styles.tableScroll}>
        <table className={styles.grammar} data-before-after data-device-comparison-table>
          <caption>Observed in this run</caption>
          <thead>
            <tr>
              <th scope="col">Quantity</th>
              <th scope="col">{mcsDeviceNaming('iabp').shortLabel}</th>
              <th scope="col">{mcsDeviceNaming('impella-cp').shortLabel}</th>
              <th scope="col">{mcsDeviceNaming('lvad').shortLabel}</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['nativeFlowLMin', 'Concurrent native', 'L/min', 2],
                ['deviceFlowLMin', 'Pump estimate', 'L/min', 2],
                ['effectiveSystemicFlowLMin', 'Modeled effective', 'L/min', 2],
                ['pulsePressureMmHg', 'Pulse pressure', 'mm Hg', 0],
              ] as const
            ).map(([key, label, unit, digits]) => (
              <tr key={key} data-comparison-metric={key}>
                <th scope="row">
                  {label}
                  <small>{unit}</small>
                </th>
                {(['iabp', 'impella', 'lvad'] as const).map((device) => (
                  <td key={device} data-device={device}>
                    {device === 'iabp' && key === 'deviceFlowLMin'
                      ? 'No separate stream'
                      : (records[device]?.state.metrics[key].toFixed(digits) ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        IABP has no separate pump-flow stream. A dash means that device has not yet been observed.
      </p>
      <details>
        <summary>Captured configurations and patient identity</summary>
        {(['iabp', 'impella', 'lvad'] as const).map((device) => {
          const record = records[device]
          return (
            <p key={device} data-comparison-device={device}>
              {record ? mcsConfigurationLabel(record.state) : device.toUpperCase()}
              <small>
                {record
                  ? `Seed ${record.seed} · captured at ${record.capturedAtSeconds.toFixed(2)} s · observation ${record.observationSeconds} s · patient ${record.referenceId}`
                  : 'Awaiting selection and observation'}
              </small>
            </p>
          )
        })}
      </details>
      <McsFlowArithmetic records={records} />
      {records.iabp && records.lvad ? (
        <p data-comparison-observed>
          Compared with captured IABP, durable LVAD effective systemic flow{' '}
          {mcsObservedDirection(
            records.iabp.state.metrics.effectiveSystemicFlowLMin,
            records.lvad.state.metrics.effectiveSystemicFlowLMin,
            2,
          )}{' '}
          by{' '}
          {Math.abs(
            records.lvad.state.metrics.effectiveSystemicFlowLMin -
              records.iabp.state.metrics.effectiveSystemicFlowLMin,
          ).toFixed(2)}{' '}
          L/min. This is a model comparison, not evidence for choosing a device.
        </p>
      ) : null}
    </div>
  )
}

export function McsCapturedResults({
  before,
  after,
  signals,
  inspectOnly = false,
  providedExample = false,
}: {
  before: McsSimulationState | null
  after: McsSimulationState
  signals: readonly McsObservedSignal[]
  inspectOnly?: boolean
  providedExample?: boolean
}) {
  const format = (value: number | boolean | null | undefined, digits: number) =>
    value == null
      ? 'not captured'
      : typeof value === 'boolean'
        ? value
          ? 'yes'
          : 'no'
        : value.toFixed(digits)
  return (
    <div className={styles.block} data-captured-results>
      <p>
        <strong>{providedExample ? 'Provided model reference.' : 'Observed in this run.'}</strong>{' '}
        {mcsConfigurationLabel(after)}. {providedExample ? 'Reference at' : 'Captured at'}{' '}
        {after.timeSeconds.toFixed(2)} simulated seconds
        {before ? `; baseline at ${before.timeSeconds.toFixed(2)} s` : ''}.
      </p>
      {inspectOnly ? (
        <p>
          Reading is an inspection, not a physiological intervention. Any difference is model
          settling or sampling.
        </p>
      ) : null}
      <div className={styles.tableScroll}>
        <table className={styles.grammar} data-before-after>
          <caption>
            {providedExample
              ? 'Provided reference readings; no action recorded'
              : 'Captured model readings'}
          </caption>
          <thead>
            <tr>
              <th scope="col">Quantity / unit</th>
              <th scope="col">Before</th>
              <th scope="col">{providedExample ? 'Current reference' : 'After'}</th>
              <th scope="col">Observed change</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((signal) => {
              const first = before?.metrics[signal.key]
              const last = after.metrics[signal.key]
              const noStream = signal.key === 'deviceFlowLMin' && after.device.kind === 'iabp'
              return (
                <tr key={signal.key} data-signal={signal.key} data-level={signal.level}>
                  <th scope="row">
                    {signal.label}{' '}
                    <small>
                      {signal.unit} · {signal.level}
                    </small>
                  </th>
                  <td>{noStream ? 'No separate stream' : format(first, signal.digits)}</td>
                  <td>{noStream ? 'No separate stream' : format(last, signal.digits)}</td>
                  <td>
                    {noStream
                      ? 'Not a pump-flow measurement'
                      : typeof first === 'number' && typeof last === 'number'
                        ? `${mcsObservedDirection(first, last, signal.digits)} (${(last - first).toFixed(signal.digits)} ${signal.unit === '%' ? 'percentage points' : signal.unit})`
                        : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
