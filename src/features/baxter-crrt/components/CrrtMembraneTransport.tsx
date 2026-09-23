'use client'

import { useId } from 'react'

import styles from './crrt-membrane-transport.module.css'

export type CrrtTransportMechanism = 'diffusion' | 'convection' | 'ultrafiltration'

/**
 * The filter inset, enlarged so the three transport mechanisms can be compared (F-15).
 *
 * Every caption is the inset's existing source-grounded text, unchanged. Every mark drawn has a
 * stated meaning taken from those captions or the canonical circuit's own text:
 *  - the blood side, fluid side and membrane are the inset's original geometry;
 *  - more solute dots on the blood side than the fluid side is the "concentration gradient";
 *  - dialysate running the opposite way to blood is the circuit model's "countercurrent" path;
 *  - water crossing with dots riding on it is convection's "water carries eligible solute";
 *  - the replacement arrow is "replacement enters the blood path";
 *  - water crossing with no dots is ultrafiltration's "water moves from blood".
 * One dot size only: this source set does not support a molecule-size or relative-clearance
 * example, which stays with prompt 05. Nothing moves; the figure is conceptual, not measured
 * clearance, molecular transport or device telemetry.
 */
export const crrtTransportMechanisms: readonly {
  readonly id: CrrtTransportMechanism
  readonly label: string
  readonly caption: string
  readonly drawing: string
}[] = [
  {
    id: 'diffusion',
    label: 'Diffusion',
    caption:
      'Solute moves down its concentration gradient across the membrane. Bulk dialysate remains on the fluid side; solute exchange is not a direct dialysate infusion.',
    drawing:
      'Drawn: more solute dots on the blood side than the fluid side, one arrow carrying solute across the membrane toward the fluid side, and blood and dialysate flowing in opposite directions.',
  },
  {
    id: 'convection',
    label: 'Convection',
    caption:
      'Water carries eligible dissolved solute across the membrane. Replacement enters the blood path to replace part of this filtered water.',
    drawing:
      'Drawn: a water arrow crossing the membrane with solute dots carried in it, and a replacement arrow entering the blood side.',
  },
  {
    id: 'ultrafiltration',
    label: 'Ultrafiltration',
    caption:
      'Water moves from blood across the membrane. Net patient removal equals that water loss after blood-path infusions are accounted for.',
    drawing: 'Drawn: a water arrow crossing the membrane with no solute dots.',
  },
]

export function crrtTransportCaption(mechanism: CrrtTransportMechanism): string {
  return crrtTransportMechanisms.find((item) => item.id === mechanism)!.caption
}

export function CrrtMembraneTransport({ selected }: { readonly selected: CrrtTransportMechanism }) {
  const headingId = useId()
  const current = crrtTransportMechanisms.find((item) => item.id === selected)!
  return (
    <figure
      className={styles.figure}
      aria-labelledby={headingId}
      data-crrt-membrane-transport
      data-selected={selected}
    >
      <figcaption className={styles.caption}>
        <strong id={headingId}>Filter inset · {selected}</strong>
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
                {mechanism.caption} {mechanism.drawing}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <p className={styles.note}>
        Conceptual inset of the highlighted filter, not a quantitative clearance or patient model.
        Static drawing; nothing in it is measured or animated.
      </p>
    </figure>
  )
}

const BLOOD_DOTS = [
  [40, 70],
  [78, 104],
  [52, 140],
  [96, 62],
  [110, 150],
  [66, 186],
  [120, 110],
  [34, 118],
] as const
const FLUID_DOTS = [
  [226, 92],
  [262, 160],
] as const

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
          {BLOOD_DOTS.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="6" className={styles.solute} />
          ))}
          {FLUID_DOTS.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="6" className={styles.solute} />
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
          {[70, 120, 186].map((x) => (
            <circle key={x} cx={x} cy={128} r="6" className={styles.solute} />
          ))}
          <text x="140" y="112" textAnchor="middle" className={styles.smallLabel}>
            water + solute
          </text>
          <path
            d="M74 48 V92"
            className={styles.replacementArrow}
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
          <text x="140" y="112" textAnchor="middle" className={styles.smallLabel}>
            water
          </text>
        </>
      ) : null}
    </svg>
  )
}
