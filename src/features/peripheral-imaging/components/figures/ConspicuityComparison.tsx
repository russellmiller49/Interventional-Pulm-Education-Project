'use client'

import {
  CONSPICUITY_SET,
  obliquityDirection,
  SIGNAL_LATER_DEMONSTRATION_OBLIQUITY,
  signedDegrees,
  teachingFigure,
} from '../../content/teachingFigures'
import { FigureCanvas } from './FigureCanvas'
import { conspicuityImages, type ConspicuityImages, type LesionMark } from './teachingFigureModel'
import { useFigureComputation } from './useFigureComputation'
import { useTeachingVolume } from './useTeachingData'
import styles from './figures.module.css'

const PANEL_LABELS: Readonly<Record<string, string>> = {
  reference:
    'Frontal projection computed from the teaching CT, collimated around the modeled lesion',
  noise: 'The same projection with simulated quantum noise',
  scatter: 'The same view with the collimator open and a drawn veil',
  superimposition: `Projection at C-arm obliquity ${signedDegrees(CONSPICUITY_SET.changedView.orbit)}, collimated around the modeled lesion`,
}

function LesionCircle({ mark }: { readonly mark: LesionMark }) {
  return (
    <circle
      cx={mark.x}
      cy={mark.y}
      r={mark.r + 3}
      fill="none"
      stroke="#f0c27d"
      strokeWidth="1.2"
      strokeDasharray="3 3"
    />
  )
}

function pixelsFor(model: ConspicuityImages | null, id: string): Uint8ClampedArray | null {
  if (!model) return null
  if (id === 'reference') return model.reference
  if (id === 'noise') return model.noise
  if (id === 'scatter') return model.scatter
  return model.superimposition
}

/**
 * Section 6's three look-alike causes of poor conspicuity, on the course's own CT (OD4-06, brief
 * D1–D3). Replaces the square-block cartoons on the section's reading steps; the check keeps its
 * own fixed Image A and B (QS-3's text variant).
 */
export function ConspicuityComparison() {
  const declaration = teachingFigure('signal:conspicuity-set')
  const volume = useTeachingVolume()
  const model = useFigureComputation(volume.data, conspicuityImages)
  const state = volume.state === 'failed' ? 'failed' : model ? 'ready' : 'loading'
  const changed = CONSPICUITY_SET.changedView.orbit
  return (
    <section
      className={styles.figure}
      data-teaching-figure={declaration.id}
      data-figure-state={state}
    >
      <p className={styles.kicker}>Three look-alike causes, on the course’s CT</p>
      <p className={styles.modelLabel} data-model-label>
        {declaration.label}
      </p>
      {state === 'failed' ? (
        <p className={styles.status} role="status">
          The teaching CT could not be loaded here, so these examples are not drawn. The section’s
          text still describes each cause.
        </p>
      ) : state === 'loading' ? (
        <p className={styles.status} role="status">
          Preparing the examples from the teaching CT…
        </p>
      ) : null}
      <div className={styles.quadGrid}>
        {declaration.panels.map((panel) => (
          <figure
            key={panel.id}
            className={styles.panel}
            data-figure-panel={panel.id}
            data-panel-medium={panel.medium}
          >
            <p className={styles.panelTitle}>{panel.title}</p>
            <FigureCanvas
              pixels={pixelsFor(model, panel.id)}
              size={CONSPICUITY_SET.sizePx}
              label={PANEL_LABELS[panel.id]}
              overlay={
                model ? (
                  <LesionCircle
                    mark={
                      panel.id === 'superimposition' ? model.lesion.changed : model.lesion.reference
                    }
                  />
                ) : undefined
              }
            />
            <figcaption>{panel.caption}</figcaption>
            {panel.id === 'superimposition' && model ? (
              <p className={styles.panelCaption} data-ray-readout>
                Here the C-arm obliquity is {signedDegrees(changed)} ({obliquityDirection(changed)}
                ). Soft-tissue-like CT on the ray through the lesion:{' '}
                {model.rays.reference.softTotal} mm frontal, {model.rays.changed.softTotal} mm at{' '}
                {signedDegrees(changed)}.
              </p>
            ) : null}
            {panel.id === 'superimposition' &&
            model &&
            model.rays.changed.softTotal < model.rays.reference.softTotal ? (
              // PR #279 sanity review: the section's later demonstration uses another angle. The
              // two are not in conflict, and this says what each one shows.
              <p className={styles.panelCaption} data-later-example-note>
                This {signedDegrees(changed)} comparison shortens the model’s soft-tissue path on
                the target ray; the later {signedDegrees(SIGNAL_LATER_DEMONSTRATION_OBLIQUITY)}{' '}
                example shows a different pattern, with the overlap redistributed along the ray.
              </p>
            ) : null}
          </figure>
        ))}
      </div>
      <p className={styles.note}>
        The dashed circle marks where the authored nodule projects: it is part-solid and faint on
        any projection in this model. The model names density classes, not organs. Appearance alone
        does not settle the cause, so use the context as well: the field size, the dose-rate readout
        and the planning CT.
      </p>
    </section>
  )
}
