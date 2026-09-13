import type { McsObservedSignal } from '../../content/sectionLearningContracts'
import {
  mcsConfigurationLabel,
  mcsObservedDirection,
  type McsDeviceComparison,
} from '../../engine/learningSession'
import type { McsDeviceKind, McsSimulationState } from '../../engine/types'
import styles from './mcs-stage.module.css'

export type McsComparisonRecords = Partial<Record<McsDeviceKind, McsDeviceComparison>>
export function McsDeviceComparisonTable({ records }: { records: McsComparisonRecords }) {
  return (
    <div className={styles.block} data-retained-comparison>
      <h3>Three retained device results</h3>
      <p>
        Reference patient: mcs-reference-patient-v1. Each selection resets patient and compartments,
        then observes eight simulated seconds. No additional patient variables changed. Nominal
        settings are not equivalent doses.
      </p>
      <div className={styles.tableScroll}>
        <table className={styles.grammar} data-before-after data-device-comparison-table>
          <caption>Observed in this run</caption>
          <thead>
            <tr>
              <th scope="col">Quantity</th>
              <th scope="col">IABP</th>
              <th scope="col">Impella CP</th>
              <th scope="col">LVAD</th>
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
      {records.iabp && records.lvad ? (
        <p data-comparison-observed>
          Compared with captured IABP, LVAD effective systemic flow{' '}
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
}: {
  before: McsSimulationState | null
  after: McsSimulationState
  signals: readonly McsObservedSignal[]
  inspectOnly?: boolean
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
        <strong>Observed in this run.</strong> {mcsConfigurationLabel(after)}. Captured at{' '}
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
          <caption>Captured model readings</caption>
          <thead>
            <tr>
              <th scope="col">Quantity / unit</th>
              <th scope="col">Before</th>
              <th scope="col">After</th>
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
