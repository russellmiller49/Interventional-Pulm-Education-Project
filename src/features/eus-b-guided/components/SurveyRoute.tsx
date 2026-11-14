import { SURVEY_STOPS } from '../content/curriculum'
import styles from './eus-b-guided.module.css'

/** Where each stop is drawn, seen from the front: the patient's right is on the left. */
const PLACE: Record<
  number,
  { x: number; y: number; label: [number, number]; anchor: 'start' | 'end' }
> = {
  1: { x: 112, y: 318, label: [94, 323], anchor: 'end' },
  2: { x: 196, y: 372, label: [196, 404], anchor: 'start' },
  3: { x: 262, y: 332, label: [280, 337], anchor: 'start' },
  4: { x: 180, y: 178, label: [198, 183], anchor: 'start' },
  5: { x: 214, y: 124, label: [232, 129], anchor: 'start' },
  6: { x: 146, y: 112, label: [128, 117], anchor: 'end' },
}

const SHORT: Record<number, string> = {
  1: 'Left lobe of the liver',
  2: 'Aorta, celiac trunk, SMA',
  3: 'Left adrenal gland',
  4: 'Station 7',
  5: 'Station 4L',
  6: 'Station 4R',
}

/**
 * The course's one map: the path of the scope down the esophagus into the stomach, and the six
 * landmarks of the survey in the order they are examined.
 *
 * The drawing is decorative to assistive technology; the ordered list under it says the same
 * thing in words, so the two cannot disagree without a test noticing (`course.test.tsx`).
 */
export function SurveyRoute({ current }: { current?: number }) {
  return (
    <figure className={styles.route} data-survey-route>
      <svg viewBox="-80 0 500 430" aria-hidden="true" focusable="false">
        {/* The esophagus, then the proximal stomach to the patient's left. */}
        <path
          className={styles.routeLumen}
          d="M180 26 L180 262 C180 292 196 300 214 306 C252 318 262 352 240 376 C222 396 190 392 180 370 C172 352 176 330 180 306"
        />
        <line className={styles.routeDiaphragm} x1="40" y1="276" x2="360" y2="276" />
        <text className={styles.routeNote} x="40" y="268">
          Diaphragm
        </text>
        <text className={styles.routeNote} x="198" y="230">
          Left atrium, stations 8 and 9
        </text>
        <text className={styles.routeNote} x="198" y="44">
          Esophagus
        </text>
        <text className={styles.routeNote} x="262" y="372">
          Stomach
        </text>
        {SURVEY_STOPS.map(({ stop }) => {
          const place = PLACE[stop]
          return (
            <g key={stop} data-route-stop={stop} data-current={current === stop || undefined}>
              <circle className={styles.routeStop} cx={place.x} cy={place.y} r="13" />
              <text className={styles.routeNumber} x={place.x} y={place.y + 5} textAnchor="middle">
                {stop}
              </text>
              <text
                className={styles.routeLabel}
                x={place.label[0]}
                y={place.label[1]}
                textAnchor={place.anchor}
              >
                {SHORT[stop]}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption>
        The survey, seen from the front as on a coronal CT: the patient’s right is on the left.
        Stops 1 to 3 are examined from the stomach, stops 4 to 6 as the scope is withdrawn.
      </figcaption>
      <ol className={styles.srOnly} data-survey-route-list>
        {SURVEY_STOPS.map(({ stop, name, region }) => (
          <li key={stop} aria-current={current === stop ? 'step' : undefined}>
            {name}, {region === 'abdomen' ? 'below the diaphragm' : 'in the mediastinum'}
          </li>
        ))}
      </ol>
    </figure>
  )
}
