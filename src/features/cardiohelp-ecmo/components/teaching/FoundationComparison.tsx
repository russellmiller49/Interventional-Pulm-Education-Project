import { CircuitPressureIdentity } from './shared'
import type { SupportMode } from '../../engine/types'
import type {
  EcmoFoundationComparison,
  EcmoFoundationSnapshot,
} from '../../session/foundationSession'
import { UNAVAILABLE_INDICATION } from '../channelReadout'
import styles from '../stage/EcmoLessonStage.module.css'

type Signal = { key: keyof EcmoFoundationSnapshot; label: string; unit: string; precision: number }
const flow: Signal = {
  key: 'displayedBloodFlow',
  label: 'Circuit blood flow',
  unit: 'L/min',
  precision: 2,
}
const speed: Signal = {
  key: 'rpmSetpoint',
  label: 'Pump speed · setting',
  unit: 'rpm',
  precision: 0,
}
const sweep: Signal = {
  key: 'sweepLpm',
  label: 'Sweep-gas flow · setting',
  unit: 'L/min',
  precision: 1,
}
const oxygen: Signal = {
  key: 'gasOxygenFraction',
  label: 'Sweep-gas oxygen fraction · setting',
  unit: 'fraction',
  precision: 2,
}
const co2: Signal = {
  key: 'paCO2',
  label: 'Patient PaCO₂ · simulated blood gas',
  unit: 'mmHg',
  precision: 0,
}

function signalsFor(actionId: string, mode: SupportMode): readonly Signal[] {
  if (
    actionId === 'increase-rpm' ||
    actionId === 'decrease-rpm' ||
    actionId === 'load-return-resistance'
  ) {
    return [
      speed,
      flow,
      ...(['pVen', 'pInt', 'pArt', 'deltaP'] as const).map((key) => ({
        key,
        label: key === 'deltaP' ? 'ΔP · derived difference' : key,
        unit: 'mmHg',
        precision: 0,
      })),
    ]
  }
  if (actionId === 'compare-oxygen-fraction') {
    return [
      oxygen,
      sweep,
      speed,
      {
        key: 'postOxygenatorSaturation',
        label: 'Post-oxygenator saturation · simulated sample, off console',
        unit: '%',
        precision: 1,
      },
      mode === 'vv'
        ? { key: 'spo2', label: 'Patient SpO₂', unit: '%', precision: 1 }
        : {
            key: 'rightRadialSpo2',
            label: 'Right-radial SpO₂ · fixed in this preview',
            unit: '%',
            precision: 1,
          },
      co2,
    ]
  }
  return [
    actionId === 'increase-sweep' || actionId === 'double-sweep' ? sweep : speed,
    flow,
    co2,
    { key: 'pH', label: 'Patient pH · simulated blood gas', unit: '', precision: 2 },
    {
      key: 'spo2',
      label: mode === 'va' ? 'Right-radial SpO₂' : 'Patient SpO₂',
      unit: '%',
      precision: 1,
    },
  ]
}

export function FoundationComparison({
  baseline,
  comparison,
  actionId,
  supportMode,
}: {
  readonly baseline: EcmoFoundationSnapshot
  readonly comparison?: EcmoFoundationComparison
  readonly actionId: string
  readonly supportMode: SupportMode
}) {
  const before = comparison?.before ?? baseline
  return (
    <section
      className={styles.comparison}
      data-foundation-comparison
      data-comparison-action={actionId}
      data-comparison-complete={Boolean(comparison)}
      aria-label="Before and after comparison"
    >
      <h3>Before / After / Change</h3>
      <p className={styles.comparisonTiming}>
        Before: modeled time {before.simulationTime} s.
        {comparison
          ? ` After: modeled time ${comparison.after.simulationTime} s. Values retained from this comparison.`
          : ' Run the guided comparison to add the result.'}
      </p>
      {actionId === 'load-return-resistance' ? (
        <p>
          Two settled authored circuits: the reference and the existing return-resistance preview.
          This is a comparison of loading conditions, not a timed obstruction developing in this
          patient.
        </p>
      ) : null}
      {signalsFor(actionId, supportMode).some((signal) => signal.key === 'pArt') ? (
        <CircuitPressureIdentity />
      ) : null}
      <table>
        <thead>
          <tr>
            <th scope="col">Reading</th>
            <th scope="col">Before</th>
            <th scope="col">After</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          {signalsFor(actionId, supportMode).map(({ key, label, unit, precision }) => {
            const left = before[key]
            const right = comparison?.after[key] ?? null
            // Compare the values at the same precision the learner reads. Never convert null to zero.
            const delta =
              left === null || right === null
                ? null
                : Number(
                    (Number(right.toFixed(precision)) - Number(left.toFixed(precision))).toFixed(
                      precision,
                    ),
                  )
            return (
              <tr key={key} data-comparison-signal={key}>
                <th scope="row">
                  {label}
                  {unit ? <span className={styles.comparisonUnit}>{unit}</span> : null}
                </th>
                <td>{left === null ? UNAVAILABLE_INDICATION : left.toFixed(precision)}</td>
                <td>{right === null ? UNAVAILABLE_INDICATION : right.toFixed(precision)}</td>
                <td>
                  {delta === null
                    ? UNAVAILABLE_INDICATION
                    : `${delta > 0 ? '+' : ''}${delta.toFixed(precision)}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className={styles.comparisonTiming}>
        All values are simulated. A missing reading stays unavailable; a comparison is not a bedside
        target or dose-response.
      </p>
    </section>
  )
}
