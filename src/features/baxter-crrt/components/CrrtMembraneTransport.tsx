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
 *  - the same water arrow and dots with no replacement arrow is ultrafiltration's "water moves
 *    from blood", not given back.
 *
 * Ultrafiltration and convection are one movement, seen for two purposes. Water pushed across the
 * membrane takes membrane-permeable solute with it; "convection" names that solute transport and
 * "ultrafiltration" the water. The ultrafiltration panel was drawn as water with no solute, which
 * read as a separate mechanism that carries none (clinical review, 2026-11-13). It now draws the
 * same water and dots as the convection panel and differs from it in the one way the therapies
 * differ: nothing is run back into the blood, so what crosses is net fluid removal. Its `scope`
 * line says the panel is about fluid balance and where the solute is counted.
 *
 * The motion adds direction and nothing else. In diffusion the dots travel with their own stream
 * and single dots step across; no water crosses. In convection and in ultrafiltration the water
 * crosses and the dots travel in it at its speed. Speeds, counts and spacing are drawing choices:
 * nothing is a clearance, a sieving coefficient or a flow, and the two water panels use the same
 * ones so that neither reads as carrying more.
 * One dot size only: this source set does not support a molecule-size or relative-clearance
 * example, which stays with prompt 05.
 *
 * The motion is CSS only and can be paused. Paused, each panel is a complete drawing.
 *
 * Where the reader's device asks for reduced motion the figure is a still drawing and offers no
 * Play: this module's shell switches every animation off there (`baxter-crrt.module.css`), so a
 * Play button did nothing, and the dots, which were placed by their paused animations, all sat at
 * their start points: the diffusion panel showed none and the water panels one (found in the
 * browser, 2026-11-13). In the still drawing every dot is placed by its own coordinates.
 */
export const crrtTransportMechanisms: readonly {
  readonly id: CrrtTransportMechanism
  readonly label: string
  readonly caption: string
  readonly drawing: string
  /** What the motion shows, in words. */
  readonly motion: string
  /** What the panel is for, where its drawing could be taken for more than that. */
  readonly scope?: string
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
    scope:
      'This panel is about fluid balance. The water that crosses carries dissolved solute with it, as in convection, and that solute is counted as convective clearance. What is not replaced is the net fluid removal.',
    drawing:
      'Drawn: the same water arrow and solute dots as in convection, and no replacement arrow.',
    motion:
      'Moving: water streams across the membrane and the solute dots travel in it. Nothing runs back into the blood side.',
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
  // Still where the device asks for reduced motion; otherwise playing until the learner pauses.
  const reducedMotion = usePrefersReducedMotion()
  const [choice, setChoice] = useState<'playing' | 'paused' | null>(null)
  const motion = reducedMotion ? 'still' : (choice ?? 'playing')
  return (
    <figure
      className={styles.figure}
      aria-labelledby={headingId}
      data-crrt-membrane-transport
      data-selected={selected}
      data-motion={motion}
    >
      <figcaption className={styles.caption}>
        <div className={styles.captionRow}>
          <strong id={headingId}>Filter inset · {selected}</strong>
          {motion === 'still' ? (
            <span className={styles.motionOff} data-crrt-membrane-motion-off>
              Shown still: this device asks for reduced motion.
            </span>
          ) : (
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
          )}
        </div>
        <p>{current.caption}</p>
        {current.scope ? <p data-crrt-membrane-scope>{current.scope}</p> : null}
      </figcaption>
      {/* One accessible image named by the selected mechanism; the three panels inside it are
          drawn for side-by-side comparison and described in full by the list that follows. */}
      <div
        className={styles.panels}
        role="img"
        aria-label={current.scope ? `${current.caption} ${current.scope}` : current.caption}
      >
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
            <MembranePanel mechanism={mechanism.id} still={motion === 'still'} />
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
                {mechanism.caption} {mechanism.scope ? `${mechanism.scope} ` : ''}
                {mechanism.drawing} {mechanism.motion}
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

/*
 * The still drawing. Each dot is placed by its own coordinates, where its phase would have put it
 * along the same path, so nothing depends on an animation that is switched off.
 */
const STREAM_TRAVEL = 200
const stillStreamDown = (phase: number) => 20 + ((phase + 0.1) % 1) * (STREAM_TRAVEL - 40) + 20
const stillStreamUp = (phase: number) => 220 - ((phase + 0.1) % 1) * (STREAM_TRAVEL - 40) - 20
/** One dot about to cross on the blood side, one just across on the fluid side. */
const STILL_CROSSING = [
  { x: 118, y: 92 },
  { x: 184, y: 150 },
] as const
/** Three dots evenly along the water arrow. */
const STILL_CARRIED = [76, 128, 180] as const

function MembranePanel({
  mechanism,
  still,
}: {
  readonly mechanism: CrrtTransportMechanism
  readonly still: boolean
}) {
  const markerId = useId().replaceAll(':', '')
  /** The carried dots of a water panel: riding the arrow, or placed along it. */
  const carriedDots = still
    ? STILL_CARRIED.map((x) => (
        <circle key={x} cx={x} cy={128} r="6" className={styles.solute} data-crrt-carried />
      ))
    : CARRIED.map((phase) => (
        <circle
          key={phase}
          cx={44}
          cy={128}
          r="6"
          className={`${styles.solute} ${styles.carried}`}
          style={startAt(phase, WATER_SECONDS)}
          data-crrt-carried
        />
      ))
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
            {BLOOD_STREAM.map(({ x, phase }) =>
              still ? (
                <circle
                  key={x}
                  cx={x}
                  cy={stillStreamDown(phase)}
                  r="6"
                  className={styles.solute}
                />
              ) : (
                <circle
                  key={x}
                  cx={x}
                  cy={20}
                  r="6"
                  className={`${styles.solute} ${styles.streamDown}`}
                  style={startAt(phase, STREAM_SECONDS)}
                />
              ),
            )}
          </g>
          <g clipPath={`url(#${markerId}-fluid)`}>
            {FLUID_STREAM.map(({ x, phase }) =>
              still ? (
                <circle key={x} cx={x} cy={stillStreamUp(phase)} r="6" className={styles.solute} />
              ) : (
                <circle
                  key={x}
                  cx={x}
                  cy={220}
                  r="6"
                  className={`${styles.solute} ${styles.streamUp}`}
                  style={startAt(phase, STREAM_SECONDS)}
                />
              ),
            )}
          </g>
          {/* Single dots step across, down the gradient, and leave with the dialysate. */}
          {still
            ? STILL_CROSSING.map(({ x, y }) => (
                <circle key={y} cx={x} cy={y} r="6" className={styles.solute} data-crrt-crossing />
              ))
            : CROSSING.map(({ y, phase }) => (
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
          {carriedDots}
          <text x="140" y="112" textAnchor="middle" className={styles.smallLabel}>
            water + solute
          </text>
          <path
            d="M74 48 V92"
            className={`${styles.replacementArrow} ${styles.replacementFlow}`}
            markerEnd={`url(#${markerId}-arrow)`}
            data-crrt-replacement
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
          {/* The same water, carrying the same solute, as the convection panel. */}
          {carriedDots}
          <text x="140" y="112" textAnchor="middle" className={styles.smallLabel}>
            water + solute
          </text>
          {/* What this panel is about: none of it is replaced. */}
          <text x="226" y="160" textAnchor="middle" className={styles.smallLabel}>
            net fluid removal
          </text>
        </>
      ) : null}
    </svg>
  )
}
