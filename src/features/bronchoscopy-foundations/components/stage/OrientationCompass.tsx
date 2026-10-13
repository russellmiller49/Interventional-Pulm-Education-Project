'use client'

import { useEffect, useId, useRef, useState } from 'react'

import styles from './orientation-compass.module.css'

/**
 * Where the operator stands, and what that does to the picture (educator feedback, 2026-10-13).
 *
 * One rule carries the whole figure: held square in front of the operator, the scope puts the side
 * of the airway that faces away from the operator at 12 o'clock. At the head of the bed that side
 * is the front of the chest, which is the view the course teaches everywhere else. Standing
 * anywhere else turns the same picture about its centre: half a turn facing the patient, a quarter
 * turn at the bedside. The figure turns the view above the carina, with a compass on its rim, and
 * lists where the openings a fellow looks for first fall on the clock.
 *
 * `turnDeg` is that turn, clockwise as the picture is seen. Every clock position below is the
 * head-of-the-bed position plus the turn; nothing is authored twice.
 */
export const OPERATOR_POSITIONS = [
  {
    id: 'head',
    label: 'At the head of the bed',
    stance: 'Behind the patient’s head, looking toward the feet.',
    top: 'the front of the chest',
    turnDeg: 0,
  },
  {
    id: 'facing',
    label: 'Facing the patient',
    stance: 'In front of a patient who is sitting up.',
    top: 'the patient’s back',
    turnDeg: 180,
  },
  {
    id: 'bedside-right',
    label: 'At the bedside, patient’s right',
    stance: 'Beside the patient’s right shoulder, looking across the bed.',
    top: 'the patient’s left side',
    turnDeg: 90,
  },
  {
    id: 'bedside-left',
    label: 'At the bedside, patient’s left',
    stance: 'Beside the patient’s left shoulder, looking across the bed.',
    top: 'the patient’s right side',
    turnDeg: 270,
  },
] as const

export type OperatorPositionId = (typeof OPERATOR_POSITIONS)[number]['id']

/**
 * Where each landmark sits from the head of the bed, as degrees clockwise from 12 o'clock: the
 * front of the chest at the top, the patient's right on the right of the picture.
 */
export const HEAD_OF_BED_LANDMARKS = [
  { id: 'membranous-wall', name: 'Membranous wall', from: 'in the trachea', atDeg: 180 },
  { id: 'right-main', name: 'Right main bronchus', from: 'above the carina', atDeg: 90 },
  { id: 'left-main', name: 'Left main bronchus', from: 'above the carina', atDeg: 270 },
  { id: 'right-upper', name: 'Right upper lobe', from: 'in the right main bronchus', atDeg: 90 },
  { id: 'middle-lobe', name: 'Middle lobe', from: 'in the bronchus intermedius', atDeg: 0 },
  { id: 'right-superior', name: 'RB6', from: 'opposite the middle lobe', atDeg: 180 },
  { id: 'left-upper', name: 'Left upper lobe', from: 'in the left main bronchus', atDeg: 270 },
  { id: 'left-superior', name: 'LB6', from: 'in the left lower lobe', atDeg: 180 },
] as const

/** "3 o’clock" for a direction in degrees clockwise from the top of the picture. */
export function clockWords(deg: number): string {
  const hour = Math.round((((deg % 360) + 360) % 360) / 30) % 12
  return `${hour === 0 ? 12 : hour} o’clock`
}

/** Where a head-of-the-bed landmark falls for an operator standing somewhere else. */
export function landmarkClock(atDeg: number, turnDeg: number): string {
  return clockWords(atDeg + turnDeg)
}

const CENTRE = { x: 520, y: 208 }
const FIELD_RADIUS = 122
const TURN_MS = 450

/** The turn shown, eased to the chosen one the short way round; at once with reduced motion. */
function useShownTurn(target: number): number {
  const [shown, setShown] = useState(target)
  const current = useRef(target)
  useEffect(() => {
    const from = current.current
    const delta = ((((target - from + 180) % 360) + 360) % 360) - 180
    if (delta === 0) return
    // With reduced motion the turn takes no time: the next frame shows the chosen view.
    const duration = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : TURN_MS
    let frame = 0
    const started = performance.now()
    const step = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - started) / duration)
      const eased = t * t * (3 - 2 * t)
      // Ends on the chosen turn itself, not on an equivalent of it a whole turn away.
      current.current = t < 1 ? from + delta * eased : target
      setShown(current.current)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target])
  return shown
}

/** A point given from the picture's centre, turned clockwise with the picture. */
function turned(x: number, y: number, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180
  return {
    x: CENTRE.x + x * Math.cos(a) - y * Math.sin(a),
    y: CENTRE.y + x * Math.sin(a) + y * Math.cos(a),
  }
}

const RIM = [
  { letter: 'A', name: 'front', atDeg: 0 },
  { letter: 'R', name: 'patient’s right', atDeg: 90 },
  { letter: 'P', name: 'back', atDeg: 180 },
  { letter: 'L', name: 'patient’s left', atDeg: 270 },
] as const

/** Where the operator stands on the bed drawing, and which way they look. */
const STANCE: Readonly<
  Record<OperatorPositionId, { x: number; y: number; lookDeg: number; mouth: string }>
> = {
  head: { x: 150, y: 34, lookDeg: 180, mouth: 'M150 48 C150 62 150 72 150 84' },
  facing: { x: 150, y: 362, lookDeg: 0, mouth: 'M158 350 C212 300 212 132 164 98' },
  'bedside-right': { x: 52, y: 96, lookDeg: 90, mouth: 'M66 96 C96 78 124 84 142 94' },
  'bedside-left': { x: 248, y: 96, lookDeg: 270, mouth: 'M234 96 C204 78 176 84 158 94' },
}

export function OrientationCompass() {
  const [positionId, setPositionId] = useState<OperatorPositionId>('head')
  const position = OPERATOR_POSITIONS.find((entry) => entry.id === positionId)!
  const shownTurn = useShownTurn(position.turnDeg)
  const headingId = useId()
  const gradient = useId()
  const stance = STANCE[positionId]
  const rightMain = turned(46, 6, shownTurn)
  const leftMain = turned(-48, 10, shownTurn)
  return (
    <section className={styles.compass} aria-labelledby={headingId} data-orientation-compass>
      <h3 id={headingId}>Choose where you are standing</h3>
      <div className={styles.positions} role="group" aria-label="Where you are standing">
        {OPERATOR_POSITIONS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={entry.id === positionId}
            data-operator-position={entry.id}
            onClick={() => setPositionId(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <figure className={styles.figure}>
        <div className={styles.panels}>
          <svg
            className={styles.bedPanel}
            viewBox="0 0 300 404"
            role="img"
            aria-label={`${position.label}. ${position.stance}`}
          >
            {/* Where you stand: the bed from above, the patient's head at the top. */}
            <text x="150" y="16" textAnchor="middle" className={styles.panelTitle}>
              Where you stand
            </text>
            <g transform="translate(0 18)">
              <rect x="92" y="52" width="116" height="290" rx="14" className={styles.mattress} />
              <rect x="112" y="60" width="76" height="38" rx="10" className={styles.pillow} />
              <circle cx="150" cy="88" r="19" className={styles.body} />
              <path
                d="M118 122 Q150 104 182 122 L178 226 Q150 236 122 226 Z"
                className={styles.body}
              />
              <path d="M130 232 L126 322 M170 232 L174 322" className={styles.limb} />
              <text x="80" y="170" textAnchor="end" className={styles.sideWord}>
                Patient’s
              </text>
              <text x="80" y="186" textAnchor="end" className={styles.sideWord}>
                right
              </text>
              <text x="220" y="170" className={styles.sideWord}>
                Patient’s
              </text>
              <text x="220" y="186" className={styles.sideWord}>
                left
              </text>
              <text x="84" y="340" textAnchor="end" className={styles.sideWord}>
                Feet
              </text>
              <text x="84" y="72" textAnchor="end" className={styles.sideWord}>
                Head
              </text>
              <path d={stance.mouth} className={styles.scopeLine} />
              <g transform={`translate(${stance.x} ${stance.y}) rotate(${stance.lookDeg})`}>
                <circle r="12" className={styles.operator} />
                <path d="M-6 -15 L0 -27 L6 -15 Z" className={styles.operator} />
              </g>
            </g>
          </svg>
          <svg
            className={styles.screenPanel}
            viewBox="330 0 380 404"
            role="img"
            aria-label={`${position.label}: the picture’s 12 o’clock is ${position.top}. The membranous wall is at ${landmarkClock(180, position.turnDeg)} and the right main bronchus at ${landmarkClock(90, position.turnDeg)}.`}
            data-compass-turn={position.turnDeg}
          >
            <defs>
              <radialGradient id={`${gradient}-wall`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#c9756f" />
                <stop offset="70%" stopColor="#e79d93" />
                <stop offset="100%" stopColor="#f3b9ae" />
              </radialGradient>
              <radialGradient id={`${gradient}-lumen`} cx="50%" cy="45%" r="60%">
                <stop offset="0%" stopColor="#0d0406" />
                <stop offset="100%" stopColor="#4a1c20" />
              </radialGradient>
              <clipPath id={`${gradient}-field`}>
                <circle cx={CENTRE.x} cy={CENTRE.y} r={FIELD_RADIUS} />
              </clipPath>
            </defs>

            {/* What the screen shows: the view above the carina, turned with the operator. */}
            <text x={CENTRE.x} y="16" textAnchor="middle" className={styles.panelTitle}>
              On the screen, above the carina
            </text>
            <circle cx={CENTRE.x} cy={CENTRE.y} r={FIELD_RADIUS + 9} className={styles.bezel} />
            <g clipPath={`url(#${gradient}-field)`}>
              <g transform={`rotate(${shownTurn} ${CENTRE.x} ${CENTRE.y})`}>
                <g transform={`translate(${CENTRE.x} ${CENTRE.y})`}>
                  <circle r={FIELD_RADIUS} fill={`url(#${gradient}-wall)`} />
                  {/* Cartilage rings: in front and at the sides, open behind. */}
                  {[112, 98, 84].map((radius) => (
                    <path
                      key={radius}
                      d={`M${-radius * 0.82} ${radius * 0.57} A${radius} ${radius} 0 1 1 ${radius * 0.82} ${radius * 0.57}`}
                      className={styles.ring}
                    />
                  ))}
                  {/* The membranous wall: flat, behind, with its lengthwise folds. */}
                  <path
                    d="M-92 70 Q0 96 92 70 L74 108 Q0 132 -74 108 Z"
                    className={styles.membrane}
                  />
                  {[-54, -27, 0, 27, 54].map((x) => (
                    <path key={x} d={`M${x} 82 L${x * 0.9} 118`} className={styles.fold} />
                  ))}
                  {/* The two main bronchi, and the carina between them. */}
                  <ellipse
                    cx="46"
                    cy="6"
                    rx="36"
                    ry="45"
                    fill={`url(#${gradient}-lumen)`}
                    transform="rotate(-8 46 6)"
                  />
                  <ellipse
                    cx="-48"
                    cy="10"
                    rx="31"
                    ry="41"
                    fill={`url(#${gradient}-lumen)`}
                    transform="rotate(12 -48 10)"
                  />
                  <path d="M-6 -44 Q2 4 -4 60" className={styles.carina} />
                </g>
              </g>
            </g>
            <circle cx={CENTRE.x} cy={CENTRE.y} r={FIELD_RADIUS} className={styles.fieldEdge} />

            {/* The clock, fixed to the screen. */}
            {[0, 90, 180, 270].map((deg) => {
              const at = turned(0, -(FIELD_RADIUS + 44), deg)
              return (
                <text key={deg} x={at.x} y={at.y + 5} textAnchor="middle" className={styles.hour}>
                  {clockWords(deg).replace(' o’clock', '')}
                </text>
              )
            })}
            {/* The compass, fixed to the patient: it turns with the picture. */}
            {RIM.map((mark) => {
              const at = turned(0, -(FIELD_RADIUS + 22), mark.atDeg + shownTurn)
              return (
                <g key={mark.letter} data-compass-mark={mark.letter}>
                  <circle cx={at.x} cy={at.y} r="12" className={styles.markDisc} />
                  <text x={at.x} y={at.y + 5} textAnchor="middle" className={styles.markLetter}>
                    {mark.letter}
                  </text>
                </g>
              )
            })}
            <text
              x={rightMain.x}
              y={rightMain.y + 5}
              textAnchor="middle"
              className={styles.opening}
            >
              Right main
            </text>
            <text x={leftMain.x} y={leftMain.y + 5} textAnchor="middle" className={styles.opening}>
              Left main
            </text>
          </svg>
        </div>
        <figcaption>
          A is the patient’s front, P the back, R the patient’s right and L the patient’s left. The
          numbers are the clock on your screen.
        </figcaption>
      </figure>
      <div className={styles.reading} aria-live="polite" data-compass-reading={position.id}>
        <p>
          <strong>{position.label}.</strong> {position.stance} The top of your screen is{' '}
          {position.top}.
        </p>
        <table>
          <thead>
            <tr>
              <th scope="col">Look for</th>
              <th scope="col">From</th>
              <th scope="col">On your screen</th>
            </tr>
          </thead>
          <tbody>
            {HEAD_OF_BED_LANDMARKS.map((landmark) => (
              <tr key={landmark.id} data-compass-landmark={landmark.id}>
                <th scope="row">{landmark.name}</th>
                <td>{landmark.from}</td>
                <td>{landmarkClock(landmark.atDeg, position.turnDeg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.rule}>
          This is with the control section held square in front of you. Turn it and the picture
          turns with it, so read right and left from the membranous wall, not from the screen.
        </p>
      </div>
    </section>
  )
}
