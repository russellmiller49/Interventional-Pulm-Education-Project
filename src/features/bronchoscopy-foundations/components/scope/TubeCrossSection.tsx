'use client'

import { useId } from 'react'

import { fractionInWords, tubeGeometry } from '../../engine/scope/scopeMetrics'
import type { ScopeInputs } from './types'
import styles from './scope-fallback.module.css'

/** Millimetres, as the readouts and the step's text write them: "8 mm", "7.5 mm", "6.2 mm". */
function mm(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)} mm`
}

/** The limit the drawing carries wherever it appears. */
export const TUBE_CROSS_SECTION_LIMIT =
  'A geometric illustration from two authored diameters, drawn as ideal circles. It is not a ventilation, airway-fit or device recommendation.'

/**
 * The scope inside the tube, in cross-section, to scale (fellow walkthrough A33).
 *
 * The step asked the learner to use a cross-sectional view that did not exist: the only drawing was
 * a narrow longitudinal cutaway in which the gap around the scope was a few pixels. This is the
 * cross-section the readouts describe, drawn in millimetres from `tubeGeometry` — the same
 * calculation the readouts print — so the circles, the diameters and the shaded open area are one
 * set of numbers. The scope is drawn centred; the open area is the same wherever it sits. Nothing
 * here says whether the space is enough for anything.
 */
export function TubeCrossSection({
  inputs,
}: {
  readonly inputs: Pick<ScopeInputs, 'tube' | 'scopeOdMm'>
}) {
  const captionId = useId()
  const geometry = tubeGeometry(inputs)
  if (!geometry) return null
  const { tubeRadiusMm: tube, scopeRadiusMm: scope, fits } = geometry
  const extent = Math.max(tube, scope) * 1.55
  const font = extent * 0.11
  const dimensionY = tube + extent * 0.2
  return (
    <figure
      className={styles.crossSection}
      data-tube-cross-section
      data-tube-id-mm={geometry.tubeIdMm}
      data-scope-od-mm={geometry.scopeOdMm}
      data-open-fraction={geometry.fraction.toFixed(4)}
      data-open-mm2={geometry.mm2.toFixed(3)}
    >
      <svg
        viewBox={`${-extent} ${-extent} ${extent * 2} ${extent * 2}`}
        role="img"
        aria-labelledby={captionId}
      >
        <circle
          className={styles.crossSectionOpen}
          r={tube}
          data-cross-section-tube-radius={tube}
        />
        <circle
          className={styles.crossSectionScope}
          r={Math.min(scope, tube)}
          data-cross-section-scope-radius={scope}
        />
        <circle className={styles.crossSectionTube} r={tube} fill="none" />
        {/* Diameter lines: the tube's inside across the top, the scope's outside across its middle. */}
        <line
          className={styles.crossSectionDimension}
          x1={-tube}
          y1={-dimensionY}
          x2={tube}
          y2={-dimensionY}
        />
        <line
          className={styles.crossSectionTick}
          x1={-tube}
          y1={-dimensionY - font * 0.35}
          x2={-tube}
          y2={0}
        />
        <line
          className={styles.crossSectionTick}
          x1={tube}
          y1={-dimensionY - font * 0.35}
          x2={tube}
          y2={0}
        />
        <text
          className={styles.crossSectionText}
          x={0}
          y={-dimensionY - font * 0.45}
          fontSize={font}
          textAnchor="middle"
        >
          Tube inside {mm(geometry.tubeIdMm)}
        </text>
        <line className={styles.crossSectionDimension} x1={-scope} y1={0} x2={scope} y2={0} />
        <text
          className={styles.crossSectionScopeText}
          x={0}
          y={-font * 0.45}
          fontSize={font}
          textAnchor="middle"
        >
          Scope {mm(geometry.scopeOdMm)}
        </text>
        {fits ? (
          <text
            className={styles.crossSectionText}
            x={0}
            y={tube + extent * 0.3}
            fontSize={font}
            textAnchor="middle"
          >
            Shaded: open area
          </text>
        ) : null}
      </svg>
      <figcaption id={captionId}>
        <strong>Cross-section, to scale</strong>
        <span>
          Tube inside diameter {mm(geometry.tubeIdMm)}; scope outside diameter{' '}
          {mm(geometry.scopeOdMm)}.
        </span>
        {fits ? (
          <span>
            Open area around the scope: {Math.round(geometry.mm2)} mm²,{' '}
            {geometry.fraction.toFixed(2)} of the tube’s lumen ({fractionInWords(geometry.fraction)}
            ).
          </span>
        ) : (
          <span>
            The scope is no narrower than the tube here, so there is no open area to draw.
          </span>
        )}
        <span>{TUBE_CROSS_SECTION_LIMIT}</span>
      </figcaption>
    </figure>
  )
}
