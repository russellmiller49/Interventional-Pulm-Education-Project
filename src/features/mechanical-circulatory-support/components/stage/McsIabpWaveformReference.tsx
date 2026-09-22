import {
  MCS_IABP_PRESSURE_SCALE,
  MCS_IABP_REFERENCE_IDENTITY,
  MCS_IABP_REFERENCE_LANDMARKS,
  MCS_IABP_LIVE_TRACE_LIMITS,
} from '../../content/iabpWaveformReference'
import styles from './mcs-stage.module.css'

/**
 * The authored counterpulsation contour, drawn beside the live strip and never mistaken for it.
 *
 * Every number on this diagram is a drawing coordinate. Nothing is read from the engine, nothing
 * is dispatched, and no state is touched — which is the point: the live model cannot show the two
 * pressure relationships a learner is asked to recognize, so the relationships are drawn instead
 * of being faked into the simulation (F17). The scale is the same fixed one the live strip now
 * uses, so the two pictures can be held side by side.
 */

const WIDTH = 320
const HEIGHT = 120
const TOP = 8

/** Pressure to a y coordinate on the shared fixed scale. */
function y(mmHg: number): number {
  const { minMmHg, maxMmHg } = MCS_IABP_PRESSURE_SCALE
  const fraction = (mmHg - minMmHg) / (maxMmHg - minMmHg)
  return TOP + (1 - Math.min(1, Math.max(0, fraction))) * (HEIGHT - TOP * 2)
}

const at = (id: string) => MCS_IABP_REFERENCE_LANDMARKS.find((entry) => entry.id === id)!

/**
 * Two beats as one path: an unassisted beat, then an assisted beat whose diastole carries the
 * augmentation and whose end-diastolic pressure is drawn lower than the unassisted one.
 */
function contourPath(): string {
  const unassistedSystole = at('unassisted-systole')
  const unassistedEnd = at('unassisted-end-diastolic')
  const augmentation = at('diastolic-augmentation')
  const assistedEnd = at('assisted-end-diastolic')
  const assistedSystole = at('assisted-systole')
  const x = (fraction: number) => (fraction * WIDTH).toFixed(1)
  return [
    `M0 ${y(66).toFixed(1)}`,
    // unassisted beat: upstroke, peak, decline to the dicrotic notch
    `L${x(0.1)} ${y(unassistedSystole.mmHg).toFixed(1)}`,
    `L${x(unassistedSystole.x)} ${y(unassistedSystole.mmHg).toFixed(1)}`,
    `L${x(0.26)} ${y(80).toFixed(1)}`,
    `L${x(0.3)} ${y(76).toFixed(1)}`,
    // unassisted diastole runs down to its own end-diastolic pressure
    `L${x(unassistedEnd.x)} ${y(unassistedEnd.mmHg).toFixed(1)}`,
    // assisted beat: upstroke and peak, then the sharp V of inflation at the notch
    `L${x(0.5)} ${y(102).toFixed(1)}`,
    `L${x(0.56)} ${y(100).toFixed(1)}`,
    `L${x(0.6)} ${y(78).toFixed(1)}`,
    `L${x(augmentation.x)} ${y(augmentation.mmHg).toFixed(1)}`,
    // deflation carries the pressure down past the unassisted end-diastolic level
    `L${x(0.82)} ${y(74).toFixed(1)}`,
    `L${x(assistedEnd.x)} ${y(assistedEnd.mmHg).toFixed(1)}`,
    // the ejection that follows, peaking below unassisted systole
    `L${x(assistedSystole.x)} ${y(assistedSystole.mmHg).toFixed(1)}`,
    `L${x(1)} ${y(90).toFixed(1)}`,
  ].join(' ')
}

export function McsIabpWaveformReference() {
  const { minMmHg, maxMmHg } = MCS_IABP_PRESSURE_SCALE
  const unassistedEnd = at('unassisted-end-diastolic')
  const unassistedSystole = at('unassisted-systole')
  return (
    <section className={styles.block} data-iabp-authored-reference>
      <h3>{MCS_IABP_REFERENCE_IDENTITY.heading}</h3>
      <p>
        <strong>{MCS_IABP_REFERENCE_IDENTITY.notThis}</strong> {MCS_IABP_REFERENCE_IDENTITY.lead}
      </p>
      <figure>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="Authored diagram of one unassisted and one assisted arterial beat, with unassisted systole, unassisted end-diastolic pressure, diastolic augmentation, assisted end-diastolic pressure and assisted systole marked on a fixed pressure scale"
          data-iabp-reference-contour
        >
          {/* the two reference levels the eye is meant to compare against */}
          <line
            x1="0"
            x2={WIDTH}
            y1={y(unassistedSystole.mmHg)}
            y2={y(unassistedSystole.mmHg)}
            stroke="currentColor"
            strokeDasharray="3 4"
            opacity="0.35"
          />
          <line
            x1="0"
            x2={WIDTH}
            y1={y(unassistedEnd.mmHg)}
            y2={y(unassistedEnd.mmHg)}
            stroke="currentColor"
            strokeDasharray="3 4"
            opacity="0.35"
          />
          <path d={contourPath()} stroke="currentColor" strokeWidth="1.6" fill="none" />
          {MCS_IABP_REFERENCE_LANDMARKS.map((landmark, index) => (
            <g key={landmark.id} data-iabp-reference-landmark={landmark.id}>
              <circle cx={landmark.x * WIDTH} cy={y(landmark.mmHg)} r="2.6" fill="currentColor" />
              <text
                x={Math.min(WIDTH - 6, landmark.x * WIDTH + 3)}
                y={y(landmark.mmHg) + (index % 2 === 0 ? -5 : 11)}
                fill="currentColor"
                fontSize="10"
                textAnchor={landmark.x > 0.8 ? 'end' : 'start'}
              >
                {index + 1}
              </text>
            </g>
          ))}
        </svg>
        <figcaption>
          <p>
            Pressure scale {minMmHg}–{maxMmHg} mm Hg, the same scale as the live strip.
          </p>
          <p>
            Dashed lines: unassisted systole ({unassistedSystole.mmHg}) and unassisted end-diastolic
            pressure ({unassistedEnd.mmHg}). These are drawing coordinates.
          </p>
          <p>{MCS_IABP_REFERENCE_IDENTITY.sourceLead}</p>
        </figcaption>
      </figure>
      <ol data-iabp-reference-landmark-list>
        {MCS_IABP_REFERENCE_LANDMARKS.map((landmark) => (
          <li key={landmark.id}>
            <strong>{landmark.label}.</strong> {landmark.relationship}
          </li>
        ))}
      </ol>
      <p>{MCS_IABP_REFERENCE_IDENTITY.noMagnitude}</p>
      <p>{MCS_IABP_REFERENCE_IDENTITY.reviewNote}</p>
    </section>
  )
}

/**
 * The measured statement of what the live strip carries, printed with it.
 *
 * Separate from the diagram because it is about the simulation, not about the principle.
 */
export function McsIabpLiveTraceLimits() {
  return (
    <div data-iabp-live-trace-limits>
      <p>
        <strong>{MCS_IABP_LIVE_TRACE_LIMITS.heading}.</strong> {MCS_IABP_LIVE_TRACE_LIMITS.shows}
      </p>
      <p>{MCS_IABP_LIVE_TRACE_LIMITS.doesNotShow}</p>
      <p>{MCS_IABP_LIVE_TRACE_LIMITS.soRead}</p>
    </div>
  )
}
