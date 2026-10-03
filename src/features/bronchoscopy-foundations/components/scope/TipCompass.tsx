'use client'

import { useId } from 'react'

import {
  benchOffCardNote,
  benchOrientationLines,
  benchTipOrientation,
  compassRadius,
} from '../../engine/scope/benchOrientation'
import { MODEL_DEFLECTION_LIMIT_DEG, normalizeRotationDeg } from '../../engine/scope/scopeInputs'
import type { ScopeState } from './types'
import styles from './scope-fallback.module.css'

const RINGS = [30, 60, 90, 120].filter((ring) => ring <= MODEL_DEFLECTION_LIMIT_DEG)

/**
 * The tip end-on (fellow walkthrough A21, A22, SUP-08): where the tip points, and which way the
 * lever's U bends it, drawn from the engine's optical frame in the bench's own frame.
 *
 * It stays readable when the scope view has nothing to show — the card outside the field — and
 * when the side view of the bending section is foreshortened because the bend points at the
 * viewer. The rings are angles from straight ahead, out to the model's deflection limit, so +60°
 * and −60° land on opposite sides and 120° sits beyond 90° instead of folding back. The words
 * under it say the same thing for a learner who cannot see the drawing.
 *
 * `state` is the bench as it is being shown. On the animated bench that is the pane's presentation
 * state, so during a transition this drawing passes through the same intermediate orientations as
 * the control head, the bending section and the scope view; it never shows the commanded
 * orientation before they reach it.
 *
 * While the card is outside the scope view's field, the note the scope view prints over the picture
 * is repeated here once for assistive technology (it is hidden from it there). It goes when the
 * card is back in view.
 */
export function TipCompass({ state }: { readonly state: ScopeState }) {
  const captionId = useId()
  const orientation = benchTipOrientation(state)
  if (!orientation) return null
  const radius = compassRadius(orientation.angleDeg)
  const tip = orientation.toward
    ? { x: orientation.toward.x * radius, y: -orientation.toward.y * radius }
    : { x: 0, y: 0 }
  const up = { x: orientation.bendUp.x, y: -orientation.bendUp.y }
  // A transition takes the short way round, so a turn in progress can sit outside ±180°.
  const lines = benchOrientationLines(orientation, normalizeRotationDeg(state.inputs.rotationDeg))
  const offCard = benchOffCardNote(orientation)
  return (
    <figure
      className={styles.compass}
      data-tip-compass
      data-tip-angle={orientation.angleDeg.toFixed(1)}
      data-tip-toward={
        orientation.toward
          ? `${orientation.toward.x.toFixed(3)},${orientation.toward.y.toFixed(3)}`
          : 'center'
      }
      data-bend-up={`${orientation.bendUp.x.toFixed(3)},${orientation.bendUp.y.toFixed(3)}`}
      data-card-in-view={orientation.cardInView ? 'true' : 'false'}
    >
      <svg viewBox="-1.45 -1.45 2.9 2.9" role="img" aria-labelledby={captionId}>
        {RINGS.map((ring) => (
          <circle
            key={ring}
            className={styles.compassRing}
            r={compassRadius(ring)}
            data-compass-ring={ring}
          />
        ))}
        <text className={styles.compassRingLabel} x={0.04} y={-compassRadius(60) - 0.04}>
          60°
        </text>
        <text className={styles.compassRingLabel} x={0.04} y={-compassRadius(120) - 0.04}>
          120°
        </text>
        <text className={styles.compassFrameLabel} x={0} y={-1.28} textAnchor="middle">
          card top
        </text>
        <line
          className={styles.compassPlane}
          x1={-up.x}
          y1={-up.y}
          x2={up.x}
          y2={up.y}
          data-compass-plane
        />
        <text
          className={styles.compassBend}
          x={up.x * 1.2}
          y={up.y * 1.2}
          textAnchor="middle"
          dominantBaseline="central"
        >
          U
        </text>
        <text
          className={styles.compassBend}
          x={-up.x * 1.2}
          y={-up.y * 1.2}
          textAnchor="middle"
          dominantBaseline="central"
        >
          D
        </text>
        <rect className={styles.compassCard} x={-0.07} y={-0.07} width={0.14} height={0.14} />
        <line className={styles.compassTipLine} x1={0} y1={0} x2={tip.x} y2={tip.y} />
        <circle className={styles.compassTip} cx={tip.x} cy={tip.y} r={0.09} data-compass-tip />
      </svg>
      {offCard ? (
        <p className={styles.compassOffCard} data-bench-off-card-note>
          {offCard}
        </p>
      ) : null}
      <figcaption id={captionId}>
        <strong>The tip end-on, looking along the shaft toward the card</strong>
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
        <span>
          Rings every 30° from straight ahead, to the model’s {MODEL_DEFLECTION_LIMIT_DEG}° limit. U
          and D are the marks on this model’s control head.
        </span>
      </figcaption>
    </figure>
  )
}
