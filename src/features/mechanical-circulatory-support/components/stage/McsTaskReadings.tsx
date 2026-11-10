import type { McsSimulationState } from '../../engine/types'
import {
  mcsReadingPlace,
  type McsPointedPlace,
  type McsReadingId,
} from '../../content/readingPlaces'
import type { McsPresentationKind } from '../../content/taskPresentation'
import { reading } from '../teaching/selectors'
import styles from './mcs-flow.module.css'

interface ReadingRow {
  readonly id: McsReadingId
  readonly label: string
  readonly value: number | null | undefined
  readonly unit: string
  readonly provenance: string
}

/**
 * The task's current readings.
 *
 * Each reading that is taken at a place on the circulation can be pointed at: hovering it,
 * focusing it or pressing it lights that place on the circulation map and on the heart, and its
 * region of the open monitor (a tester on the ECMO module, 2026-10-15, asked for exactly this
 * between the text and the simulation). Pointing is display only: no model action, no clock tick,
 * no progress. The host turns it off while a place on the map is itself the question.
 */
export function McsTaskReadings({
  state,
  kind,
  withholdFlow = false,
  pointed = null,
  onPoint,
}: {
  state: McsSimulationState
  kind: McsPresentationKind
  withholdFlow?: boolean
  pointed?: McsPointedPlace | null
  /** Absent where pointing is off; the readings are then plain rows. */
  onPoint?: (place: McsPointedPlace | null) => void
}) {
  const m = state.metrics
  const rows: ReadingRow[] = [
    {
      id: 'mean-arterial-pressure',
      label: 'Mean arterial pressure',
      value: m.mapMmHg,
      unit: 'mm Hg',
      provenance: 'Arterial line',
    },
    {
      id: 'right-atrial-pressure',
      label: 'Right atrial pressure',
      value: m.rapMmHg,
      unit: 'mm Hg',
      provenance: 'Right-sided filling',
    },
    {
      id: 'wedge-pressure',
      label: 'Wedge pressure',
      value: m.pcwpMmHg,
      unit: 'mm Hg',
      provenance: 'Left-sided filling',
    },
    ...(!withholdFlow
      ? ([
          {
            id: 'native-flow',
            label: 'Concurrent native flow',
            value: m.nativeFlowLMin,
            unit: 'L/min',
            provenance: 'The heart’s own forward flow',
          },
          ...(state.device.kind === 'iabp'
            ? []
            : [
                {
                  id: 'left-pump-estimate',
                  label: 'Left pump estimate',
                  value: m.leftDeviceFlowLMin,
                  unit: 'L/min',
                  provenance: 'Estimated by the console',
                },
                ...(state.device.kind === 'impella' && state.device.right.enabled
                  ? [
                      {
                        id: 'right-pump-estimate',
                        label: 'RP pump estimate',
                        value: m.rightDeviceFlowLMin,
                        unit: 'L/min',
                        provenance: 'Serial pulmonary route; do not add to systemic flow',
                      },
                    ]
                  : []),
              ]),
          {
            id: 'effective-systemic-flow',
            label: 'Effective systemic flow',
            value: m.effectiveSystemicFlowLMin,
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
            value: m.lvedvMl,
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
            value: m.pumpPowerW,
            unit: 'W',
            provenance: 'Measured by the controller',
          },
          {
            id: 'pulsatility-index',
            label: 'Pulsatility index',
            value: m.pulsatilityIndex,
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
          return (
            <div
              key={row.label}
              data-reading={row.id}
              data-pointable={place ? '' : undefined}
              data-pointed={lit || undefined}
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
                {reading(row.value, row.unit === 'L/min' ? 2 : 1)} {row.unit}
                <small>{row.provenance}</small>
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
