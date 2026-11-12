'use client'

import { useId, useState, useSyncExternalStore } from 'react'
import { Pause, Play } from 'lucide-react'

import styles from './crrt-membrane-transport.module.css'

export type CrrtTransportMechanism = 'diffusion' | 'convection' | 'ultrafiltration'

/**
 * The filter inset, enlarged so the three transport mechanisms can be compared (F-15), and in
 * motion so the difference between them is seen rather than read (critical care plan, 2026-11-10).
 *
 * Every caption is the inset's existing source-grounded text, unchanged. Every mark drawn has a
 * stated meaning taken from those captions or the canonical circuit's own text:
 *  - the blood side, fluid side and membrane are the inset's original geometry;
 *  - more solute dots on the blood side than the fluid side is the "concentration gradient";
 *  - dialysate running the opposite way to blood is the circuit model's "countercurrent" path;
 *  - water crossing with dots riding on it is convection's "water carries eligible solute";
 *  - the replacement arrow is "replacement enters the blood path";
 *  - water crossing with no dots is ultrafiltration's "water moves from blood".
 *
 * The motion adds direction and nothing else. In diffusion the dots travel with their own stream
 * and single dots step across; no water crosses. In convection the water crosses and the dots
 * travel in it at its speed. In ultrafiltration the water crosses and no solute is drawn. Speeds,
 * counts and spacing are drawing choices: nothing is a clearance, a sieving coefficient or a flow.
 * One dot size only: this source set does not support a molecule-size or relative-clearance
 * example, which stays with prompt 05.
 *
 * The motion is CSS only, can be paused, and starts paused where the reader's device asks for
 * reduced motion. Paused, each panel is a complete drawing.
 */
export const crrtTransportMechanisms: readonly {
  readonly id: CrrtTransportMechanism
  readonly label: string
  readonly caption: string
  readonly drawing: string
  /** What the motion shows, in words. */
  readonly motion: string
}[] = [
  {
    id: 'diffusion',
    label: 'Diffusion',
    caption:
      'Solute moves down its concentration gradient across the membrane. Bulk dialysate remains on the fluid side; solute exchange is not a direct dialysate infusion.',
    drawing:
      'Drawn: more solute dots on the blood side than the fluid side, one arrow carrying solute across the membrane toward the fluid side, and blood and dialysate flowing in opposite directions.',
    motion:
      'Moving: the solute dots travel with the blood, and single dots step across the membrane and leave with the dialysate, which runs the other way. No water crosses.',
  },
  {
    id: 'convection',
    label: 'Convection',
    caption:
      'Water carries eligible dissolved solute across the membrane. Replacement enters the blood path to replace part of this filtered water.',
    drawing:
      'Drawn: a water arrow crossing the membrane with solute dots carried in it, and a replacement arrow entering the blood side.',
    motion:
      'Moving: water streams across the membrane and the solute dots travel in it, at its speed. Replacement runs into the blood side.',
  },
  {
    id: 'ultrafiltration',
    label: 'Ultrafiltration',
    caption:
      'Water moves from blood across the membrane. Net patient removal equals that water loss after blood-path infusions are accounted for.',
    drawing: 'Drawn: a water arrow crossing the membrane with no solute dots.',
    motion: 'Moving: water streams across the membrane. No solute is drawn.',
  },
]

export function crrtTransportCaption(mechanism: CrrtTransportMechanism): string {
  return crrtTransportMechanisms.find((item) => item.id === mechanism)!.caption
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeToReducedMotion(onChange: () => void) {
  const media = window.matchMedia?.(REDUCED_MOTION_QUERY)
  media?.addEventListener?.('change', onChange)
  return () => media?.removeEventListener?.('change', onChange)
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false,
    () => false,
  )
}

export function CrrtMembraneTransport({ selected }: { readonly selected: CrrtTransportMechanism }) {
  const headingId = useId()
  const current = crrtTransportMechanisms.find((item) => item.id === selected)!
  // The learner's own choice wins; until they make one, the device's setting decides.
  const reducedMotion = usePrefersReducedMotion()
  const [choice, setChoice] = useState<'playing' | 'paused' | null>(null)
  const motion = choice ?? (reducedMotion ? 'paused' : 'playing')
  return (
    <figure
      className={styles.figure}
      aria-labelledby={headingId}
      data-crrt-membrane-transport
      data-selected={selected}
      data-motion={motion}
      data-motion-chosen={choice ? true : undefined}
    >
      <figcaption className={styles.caption}>
        <div className={styles.captionRow}>
          <strong id={headingId}>Filter inset · {selected}</strong>
          <button
            type="button"
            className={styles.motionButton}
            onClick={() => setChoice(motion === 'playing' ? 'paused' : 'playing')}
            data-crrt-membrane-motion
          >
            {motion === 'playing' ? (
              <>
                <Pause aria-hidden="true" /> Pause motion
              </>
            ) : (
              <>
                <Play aria-hidden="true" /> Play motion
              </>
            )}
          </button>
        </div>
        <p>{current.caption}</p>
      </figcaption>
      {/* One accessible image named by the selected mechanism; the three panels inside it are
          drawn for side-by-side comparison and described in full by the list that follows. */}
      <div className={styles.panels} role="img" aria-label={current.caption}>
        {crrtTransportMechanisms.map((mechanism) => (
          <div
            key={mechanism.id}
            className={styles.panel}
            data-mechanism={mechanism.id}
            data-selected={mechanism.id === selected}
          >
            <span className={styles.panelTitle} aria-hidden="true">
              {mechanism.label}
              {mechanism.id === selected ? ' · selected' : ''}
            </span>
            <MembranePanel mechanism={mechanism.id} />
          </div>
        ))}
      </div>
      <section className={styles.equivalentSection} aria-labelledby={`${headingId}-equivalent`}>
        <h4 id={`${headingId}-equivalent`}>What each panel shows</h4>
        <dl className={styles.equivalent}>
          {crrtTransportMechanisms.map((mechanism) => (
            <div key={mechanism.id} data-selected={mechanism.id === selected}>
              <dt>{mechanism.label}</dt>
              <dd>
                {mechanism.caption} {mechanism.drawing} {mechanism.motion}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <p className={styles.note}>
        Conceptual inset of the highlighted filter, not a quantitative clearance or patient model.
        The motion shows direction only; nothing in it is measured.
      </p>
    </figure>
  )
}

/*
 * Where the dots are. Each stream dot runs the height of its side and comes round again; its
 * `phase` (0 to 1) is how far round it starts, so the dots are spread along the stream and a
 * paused panel still shows eight on the blood side and two on the fluid side.
 */
const BLOOD_STREAM = [
  { x: 26, phase: 0.05 },
  { x: 44, phase: 0.55 },
  { x: 60, phase: 0.3 },
  { x: 78, phase: 0.8 },
  { x: 94, phase: 0.15 },
  { x: 110, phase: 0.65 },
  { x: 124, phase: 0.42 },
  { x: 52, phase: 0.92 },
] as const
const FLUID_STREAM = [
  { x: 226, phase: 0.25 },
  { x: 262, phase: 0.7 },
] as const
/** The dots that step across the membrane, one after another. */
const CROSSING = [
  { y: 92, phase: 0 },
  { y: 150, phase: 0.5 },
] as const
/** The dots carried in the water, evenly spaced along it. */
const CARRIED = [0, 1 / 3, 2 / 3] as const

const STREAM_SECONDS = 10
const CROSSING_SECONDS = 7
const WATER_SECONDS = 5

/** A negative delay starts an animation part-way through its cycle. */
const startAt = (phase: number, seconds: number) => ({ animationDelay: `${-phase * seconds}s` })

function MembranePanel({ mechanism }: { readonly mechanism: CrrtTransportMechanism }) {
  const markerId = useId().replaceAll(':', '')
  return (
    <svg viewBox="0 0 300 230" className={styles.svg} aria-hidden="true" focusable="false">
      <defs>
        <marker
          id={`${markerId}-arrow`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth="16"
          markerHeight="16"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className={styles.arrowHead} />
        </marker>
        <clipPath id={`${markerId}-blood`}>
          <rect x="6" y="30" width="136" height="180" rx="12" />
        </clipPath>
        <clipPath id={`${markerId}-fluid`}>
          <rect x="158" y="30" width="136" height="180" rx="12" />
        </clipPath>
      </defs>
      <rect x="6" y="30" width="136" height="180" rx="12" className={styles.bloodSide} />
      <rect x="158" y="30" width="136" height="180" rx="12" className={styles.fluidSide} />
      <path d="M150 26 V214" className={styles.membrane} />
      <text x="16" y="22" className={styles.label}>
        Blood side
      </text>
      <text x="168" y="22" className={styles.label}>
        Fluid side
      </text>
      <text x="150" y="228" textAnchor="middle" className={styles.smallLabel}>
        Membrane
      </text>

      {mechanism === 'diffusion' ? (
        <>
          {/* Blood runs down its side and dialysate up the other, each carrying its dots. */}
          <g clipPath={`url(#${markerId}-blood)`}>
            {BLOOD_STREAM.map(({ x, phase }) => (
              <circle
                key={x}
                cx={x}
                cy={20}
                r="6"
                className={`${styles.solute} ${styles.streamDown}`}
                style={startAt(phase, STREAM_SECONDS)}
              />
            ))}
          </g>
          <g clipPath={`url(#${markerId}-fluid)`}>
            {FLUID_STREAM.map(({ x, phase }) => (
              <circle
                key={x}
                cx={x}
                cy={220}
                r="6"
                className={`${styles.solute} ${styles.streamUp}`}
                style={startAt(phase, STREAM_SECONDS)}
              />
            ))}
          </g>
          {/* Single dots step across, down the gradient, and leave with the dialysate. */}
          {CROSSING.map(({ y, phase }) => (
            <circle
              key={y}
              cx={118}
              cy={y}
              r="6"
              className={`${styles.solute} ${styles.crossing}`}
              style={startAt(phase, CROSSING_SECONDS)}
              data-crrt-crossing
            />
          ))}
          <path
            d="M104 128 H204"
            className={styles.soluteArrow}
            markerEnd={`url(#${markerId}-arrow)`}
          />
          <text x="154" y="118" textAnchor="middle" className={styles.smallLabel}>
            solute
          </text>
          {/* The canonical filter drawing runs blood down its channel and dialysate up the
              other, countercurrent. */}
          <path
            d="M20 150 V196"
            className={styles.flowArrow}
            markerEnd={`url(#${markerId}-arrow)`}
          />
          <path
            d="M280 196 V150"
            className={styles.flowArrow}
            markerEnd={`url(#${markerId}-arrow)`}
          />
          <text x="28" y="168" className={styles.smallLabel}>
            blood
          </text>
          <text x="272" y="182" textAnchor="end" className={styles.smallLabel}>
            dialysate
          </text>
        </>
      ) : null}

      {mechanism === 'convection' ? (
        <>
          <path
            d="M44 128 H236"
            className={styles.waterArrow}
            markerEnd={`url(#${markerId}-arrow)`}
          />
          <path d="M44 128 H228" className={styles.waterFlow} />
          {/* The dots ride the water: same path, same speed. */}
          {CARRIED.map((phase) => (
            <circle
              key={phase}
              cx={44}
              cy={128}
              r="6"
              className={`${styles.solute} ${styles.carried}`}
              style={startAt(phase, WATER_SECONDS)}
              data-crrt-carried
            />
          ))}
          <text x="140" y="112" textAnchor="middle" className={styles.smallLabel}>
            water + solute
          </text>
          <path
            d="M74 48 V92"
            className={`${styles.replacementArrow} ${styles.replacementFlow}`}
            markerEnd={`url(#${markerId}-arrow)`}
          />
          <text x="84" y="62" className={styles.smallLabel}>
            replacement
          </text>
        </>
      ) : null}

      {mechanism === 'ultrafiltration' ? (
        <>
          <path
            d="M44 128 H236"
            className={styles.waterArrow}
            markerEnd={`url(#${markerId}-arrow)`}
          />
          <path d="M44 128 H228" className={styles.waterFlow} />
          <text x="140" y="112" textAnchor="middle" className={styles.smallLabel}>
            water
          </text>
        </>
      ) : null}
    </svg>
  )
}
