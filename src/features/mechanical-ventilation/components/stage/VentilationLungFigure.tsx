'use client'

import type { LungFigureModel } from '../../content/lungFigure'
import styles from './task-flow.module.css'

/**
 * The lungs at the cursor: a chest, an airway, two lungs and a diaphragm, drawn from
 * `lungFigureModel`. Everything that moves is one of that model's numbers.
 */
export function VentilationLungFigure({
  model,
  when,
  breath,
}: {
  readonly model: LungFigureModel
  /** "at the cursor", "now". */
  readonly when: string
  /** Which breath the cursor is on ("Baseline breath"), for the drawing's spoken name. */
  readonly breath?: string
}) {
  // The lungs grow about their hilum as they fill.
  const scale = 0.7 + 0.45 * model.inflation
  const effort = model.effort ?? 0
  // The diaphragm's dome flattens and descends as the patient pulls.
  const domeY = 96 + 8 * effort + 6 * model.inflation
  const baseY = 112 + 4 * effort
  const lumen = 7 * (model.airway ?? 1)
  const stiff = model.stiffness ?? 0
  const summary = model.lines.join('. ') + '.'
  return (
    <figure
      className={styles.lungFigure}
      data-lung-figure
      data-flow={model.flow}
      data-inflation={model.inflation.toFixed(2)}
      data-effort={model.effort === null ? 'not-shown' : model.effort.toFixed(2)}
      data-airway={model.airway === null ? undefined : model.airway.toFixed(2)}
      data-stiffness={model.stiffness === null ? undefined : model.stiffness.toFixed(2)}
    >
      <svg
        viewBox="0 0 160 124"
        role="img"
        aria-label={`The lungs ${when}${breath ? `, ${breath}` : ''}. ${summary}`}
      >
        <defs>
          <pattern id="lung-figure-stiff" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M0 5 L5 0" className={styles.lungStiffHatch} />
          </pattern>
        </defs>
        {/* Chest wall */}
        <path
          d="M34 22 Q80 6 126 22 Q146 60 138 112 L22 112 Q14 60 34 22 Z"
          className={styles.lungChest}
        />
        {/* Lungs, growing about the hilum */}
        <g transform={`translate(80 62) scale(${scale.toFixed(3)}) translate(-80 -62)`}>
          {[
            'M72 34 Q50 30 42 58 Q38 84 46 96 Q62 100 72 90 Z',
            'M88 34 Q110 30 118 58 Q122 84 114 96 Q98 100 88 90 Z',
          ].map((d) => (
            <g key={d}>
              <path d={d} className={styles.lungLobe} />
              {stiff > 0 ? (
                <path d={d} fill="url(#lung-figure-stiff)" opacity={Math.min(1, 0.25 + stiff)} />
              ) : null}
            </g>
          ))}
        </g>
        {/* Airway: trachea and the two main bronchi; its width is the airway's calibre */}
        <path
          d="M80 4 L80 36 M80 36 L66 50 M80 36 L94 50"
          className={styles.lungAirwayWall}
          strokeWidth={lumen + 4}
          // A cue that it has been changed, not a measure of by how much: the width is the measure.
          data-calibre={
            model.airway === null || model.airway === 1
              ? undefined
              : model.airway < 1
                ? 'narrowed'
                : 'widened'
          }
        />
        <path
          d="M80 4 L80 36 M80 36 L66 50 M80 36 L94 50"
          className={styles.lungAirwayLumen}
          strokeWidth={Math.max(1.5, lumen)}
        />
        {/* Flow */}
        {model.flow === 'none' ? null : (
          // Beside the trachea, not in it, so it reads against a narrowed (amber) airway too.
          <path
            d={
              model.flow === 'in'
                ? 'M97 3 L97 25 M91 18 L97 26 L103 18'
                : 'M97 26 L97 4 M91 11 L97 3 L103 11'
            }
            className={styles.lungFlowArrow}
            data-flow-arrow={model.flow}
          />
        )}
        {/* Diaphragm */}
        <path
          d={`M22 ${baseY} Q80 ${domeY - (baseY - domeY)} 138 ${baseY}`}
          className={styles.lungDiaphragm}
          data-pulling={effort > 0 || undefined}
        />
      </svg>
      <figcaption>
        <strong>Lungs {when}</strong>
        <ul>
          {model.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <details>
          <summary>About this drawing</summary>
          <p>
            One drawing of the model’s single lung compartment, from the same numbers as the
            read-out under the traces. Its size follows the volume the trace draws, which is not
            total lung volume. The airway’s width follows the fourth root of its resistance, as a
            tube’s does. It is not this patient’s anatomy.
          </p>
        </details>
      </figcaption>
    </figure>
  )
}
