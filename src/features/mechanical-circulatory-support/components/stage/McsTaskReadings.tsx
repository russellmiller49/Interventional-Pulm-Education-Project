import { mcsObservedDirection } from '../../engine/learningSession'
import type { McsDerivedMetrics, McsSimulationState } from '../../engine/types'
import {
  mcsReadingPlace,
  type McsPointedPlace,
  type McsReadingId,
} from '../../content/readingPlaces'
import type { McsPresentationKind } from '../../content/taskPresentation'
import { mcsDisplayedDurableFlow, reading } from '../teaching/selectors'
import styles from './mcs-flow.module.css'

interface ReadingRow {
  readonly id: McsReadingId
  readonly label: string
  /** The metrics this row answers to when a task names a reading (`mcsObserveFocus`). */
  readonly metrics: readonly (keyof McsDerivedMetrics)[]
  readonly read: (metrics: McsDerivedMetrics) => number | null | undefined
  readonly unit: string
  readonly provenance: string
}

/**
 * The pump flow a console displays. A durable pump's is the controller's estimate from power at
 * the set speed, which is what every other surface of the module shows as displayed flow; the
 * model's real pump flow is no console's reading (in the high-power pattern the two part, and
 * that gap is the teaching point of Section 8).
 */
const displayedLeftPumpFlow = (state: McsSimulationState) => (metrics: McsDerivedMetrics) =>
  state.device.kind === 'lvad' ? mcsDisplayedDurableFlow(metrics) : metrics.leftDeviceFlowLMin

/**
 * The task's current readings.
 *
 * Each reading that is taken at a place on the circulation can be pointed at: hovering it,
 * focusing it or pressing it lights that place on the circulation map and on the heart, and its
 * region of the open monitor (a tester on the ECMO module, 2026-10-15, asked for exactly this
 * between the text and the simulation). Pointing is display only: no model action, no clock tick,
 * no progress. The host turns it off while a place on the map is itself the question.
 *
 * On an Observe task the host passes the readings the instruction names (`focus`) and the values
 * before the change (`before`). The named readings are marked in words and with an edge, and each
 * reading says where it stood, so the comparison is beside the picture as well as in the table.
 */
export function McsTaskReadings({
  state,
  kind,
  withholdFlow = false,
  pointed = null,
  onPoint,
  focus,
  before = null,
}: {
  state: McsSimulationState
  kind: McsPresentationKind
  withholdFlow?: boolean
  pointed?: McsPointedPlace | null
  /** Absent where pointing is off; the readings are then plain rows. */
  onPoint?: (place: McsPointedPlace | null) => void
  focus?: readonly (keyof McsDerivedMetrics)[]
  before?: McsDerivedMetrics | null
}) {
  const m = state.metrics
  const rows: ReadingRow[] = [
    {
      id: 'mean-arterial-pressure',
      label: 'Mean arterial pressure',
      metrics: ['mapMmHg'],
      read: (metrics) => metrics.mapMmHg,
      unit: 'mm Hg',
      provenance: 'Arterial line',
    },
    {
      id: 'right-atrial-pressure',
      label: 'Right atrial pressure',
      metrics: ['rapMmHg'],
      read: (metrics) => metrics.rapMmHg,
      unit: 'mm Hg',
      provenance: 'Right-sided filling',
    },
    {
      id: 'wedge-pressure',
      label: 'Wedge pressure',
      metrics: ['pcwpMmHg'],
      read: (metrics) => metrics.pcwpMmHg,
      unit: 'mm Hg',
      provenance: 'Left-sided filling',
    },
    ...(!withholdFlow
      ? ([
          {
            id: 'native-flow',
            label: 'Concurrent native flow',
            metrics: ['nativeFlowLMin'],
            read: (metrics: McsDerivedMetrics) => metrics.nativeFlowLMin,
            unit: 'L/min',
            provenance: 'The heart’s own forward flow',
          },
          ...(state.device.kind === 'iabp'
            ? []
            : [
                {
                  id: 'left-pump-estimate',
                  label: 'Left pump estimate',
                  metrics: ['leftDeviceFlowLMin', 'estimatedPumpFlowLMin', 'deviceFlowLMin'],
                  read: displayedLeftPumpFlow(state),
                  unit: 'L/min',
                  provenance: 'Estimated by the console',
                },
                ...(state.device.kind === 'impella' && state.device.right.enabled
                  ? [
                      {
                        id: 'right-pump-estimate',
                        label: 'RP pump estimate',
                        metrics: ['rightDeviceFlowLMin'],
                        read: (metrics: McsDerivedMetrics) => metrics.rightDeviceFlowLMin,
                        unit: 'L/min',
                        provenance: 'Serial pulmonary route; do not add to systemic flow',
                      },
                    ]
                  : []),
              ]),
          {
            id: 'effective-systemic-flow',
            label: 'Effective systemic flow',
            metrics: ['effectiveSystemicFlowLMin'],
            read: (metrics: McsDerivedMetrics) => metrics.effectiveSystemicFlowLMin,
            unit: 'L/min',
            provenance: 'What reaches the body',
          },
        ] as ReadingRow[])
      : []),
    ...(kind === 'pump-loading-lab' || kind === 'parameter-reader'
      ? ([
          {
            id: 'lv-volume',
            label: 'LV volume',
            metrics: ['lvedvMl'],
            read: (metrics: McsDerivedMetrics) => metrics.lvedvMl,
            unit: 'mL',
            provenance: 'End-diastolic',
          },
        ] as ReadingRow[])
      : []),
    ...(state.device.kind === 'lvad'
      ? ([
          {
            id: 'pump-power',
            label: 'Electrical pump power',
            metrics: ['pumpPowerW'],
            read: (metrics: McsDerivedMetrics) => metrics.pumpPowerW,
            unit: 'W',
            provenance: 'Measured by the controller',
          },
          {
            id: 'pulsatility-index',
            label: 'Pulsatility index',
            metrics: ['pulsatilityIndex'],
            read: (metrics: McsDerivedMetrics) => metrics.pulsatilityIndex,
            unit: '',
            provenance: 'From the flow pulse',
          },
        ] as ReadingRow[])
      : []),
  ]
  const places = rows.map((row) => {
    const place = onPoint ? mcsReadingPlace(row.id, state.deviceKind) : null
    return place
      ? ({
          readingId: row.id,
          label: row.label,
          placeName: place.placeName,
          sentence: place.sentence(row.label),
          segmentIds: place.segmentIds,
          monitorTarget: place.monitorTarget,
        } satisfies McsPointedPlace)
      : null
  })
  const anyPointable = places.some(Boolean)
  return (
    <section aria-label="Current observations" data-task-readings>
      <h3>Current observations</h3>
      <dl className={styles.readings}>
        {rows.map((row, index) => {
          const place = places[index]
          const lit = place !== null && pointed?.readingId === row.id
          const digits = row.unit === 'L/min' ? 2 : 1
          const value = row.read(m)
          const named = focus?.some((key) => row.metrics.includes(key)) ?? false
          const was = before ? row.read(before) : null
          const direction =
            typeof was === 'number' && typeof value === 'number'
              ? mcsObservedDirection(was, value, digits)
              : undefined
          return (
            <div
              key={row.label}
              data-reading={row.id}
              data-pointable={place ? '' : undefined}
              data-pointed={lit || undefined}
              data-named={named || undefined}
              data-changed={direction === undefined ? undefined : direction !== 'unchanged'}
              onMouseEnter={place ? () => onPoint?.(place) : undefined}
              onMouseLeave={place ? () => onPoint?.(null) : undefined}
            >
              <dt>
                {place ? (
                  <button
                    type="button"
                    data-point-place={row.id}
                    aria-pressed={lit}
                    aria-describedby={lit ? 'mcs-pointed-sentence' : undefined}
                    onFocus={() => onPoint?.(place)}
                    onBlur={() => onPoint?.(null)}
                    onClick={() => onPoint?.(place)}
                  >
                    {row.label}
                  </button>
                ) : (
                  row.label
                )}
              </dt>
              <dd>
                {reading(value, digits)} {row.unit}
                {direction ? (
                  <small data-reading-was={direction}>
                    {direction === 'unchanged'
                      ? 'Unchanged'
                      : `${direction === 'increased' ? 'Up' : 'Down'} from ${reading(was, digits)}${row.unit ? ` ${row.unit}` : ''}`}
                  </small>
                ) : null}
                <small>{row.provenance}</small>
                {named ? <small data-reading-named>Named in this task</small> : null}
              </dd>
            </div>
          )
        })}
      </dl>
      {/*
       * Under the readings, never above them: a sentence that wraps to a second line would push
       * the rows down from under the pointer, the row would lose its hover, and the line would
       * flicker.
       */}
      {anyPointable ? (
        <p
          id="mcs-pointed-sentence"
          className={styles.readingsHint}
          role="status"
          data-readings-hint
          data-pointing={pointed ? '' : undefined}
        >
          {pointed ? pointed.sentence : 'Point at a reading to see where it is taken.'}
        </p>
      ) : null}
      {state.device.kind === 'iabp' ? <p>IABP has no separate pump-flow stream.</p> : null}
    </section>
  )
}
