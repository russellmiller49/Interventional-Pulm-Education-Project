'use client'

import { teachingFigure } from '../../content/teachingFigures'
import { FigureCanvas } from './FigureCanvas'
import { AXIAL_VIEW, truncationModel } from './teachingFigureModel'
import { useFigureComputation } from './useFigureComputation'
import { useTeachingVolume } from './useTeachingData'
import styles from './figures.module.css'

/** How much of the lesion the modeled volume covers, in words rather than a figure. */
export function coveredInWords(fraction: number): string {
  if (fraction >= 0.9) return 'nearly all'
  if (fraction >= 0.6) return 'most'
  if (fraction >= 0.4) return 'about half'
  if (fraction > 0.1) return 'a small part'
  return 'almost none'
}

/**
 * Section 16's "Match the artifact to its cause" strip (OD4-06, brief D4–D6). Truncation can be
 * shown honestly as coverage, by masking the course's CT outside a modeled reconstruction volume.
 * Motion and a new dependent opacity cannot: the course has no motion model, the registration model
 * moves anatomy rigidly, and authentic examples wait for cleared media (deferred by the owner). Those
 * two panels say what to look for in words and draw nothing that could pass for an acquisition.
 */
export function ArtifactCauseStrip() {
  const declaration = teachingFigure('changing-anatomy:artifact-strip')
  const volume = useTeachingVolume()
  const model = useFigureComputation(volume.data, truncationModel)
  const state = volume.state === 'failed' ? 'failed' : model ? 'ready' : 'loading'
  return (
    <section
      className={styles.figure}
      data-teaching-figure={declaration.id}
      data-figure-state={state}
    >
      <p className={styles.kicker}>Three appearances, three causes</p>
      <p className={styles.modelLabel} data-model-label>
        {declaration.label}
      </p>
      <div className={styles.panelGrid}>
        {declaration.panels.map((panel) =>
          panel.medium === 'placeholder' ? (
            <div
              key={panel.id}
              className={styles.placeholder}
              data-figure-panel={panel.id}
              data-panel-medium={panel.medium}
            >
              <p className={styles.panelTitle}>{panel.title}</p>
              <p className={styles.panelCaption}>{panel.caption}</p>
            </div>
          ) : (
            <figure
              key={panel.id}
              className={styles.panel}
              data-figure-panel={panel.id}
              data-panel-medium={panel.medium}
            >
              <p className={styles.panelTitle}>{panel.title}</p>
              {state === 'failed' ? (
                <p className={styles.status} role="status">
                  The teaching CT could not be loaded here.
                </p>
              ) : (
                <FigureCanvas
                  pixels={model?.axial ?? null}
                  size={AXIAL_VIEW.sizePx}
                  label="Axial plane of the teaching CT, dark outside a modeled reconstruction volume whose edge runs through the modeled lesion"
                  overlay={
                    model ? (
                      <>
                        <circle
                          cx={model.boundary.x}
                          cy={model.boundary.y}
                          r={model.boundary.r}
                          fill="none"
                          stroke="#77dccf"
                          strokeWidth="1.2"
                        />
                        <circle
                          cx={model.lesionAxial.x}
                          cy={model.lesionAxial.y}
                          r={model.lesionAxial.r + 2}
                          fill="none"
                          stroke="#f0c27d"
                          strokeWidth="1.2"
                          strokeDasharray="2.5 2.5"
                        />
                        <text x="4" y="12" fill="#e2eef0" fontSize="9">
                          R
                        </text>
                        <text x={AXIAL_VIEW.sizePx - 10} y="12" fill="#e2eef0" fontSize="9">
                          L
                        </text>
                      </>
                    ) : undefined
                  }
                />
              )}
              <figcaption>{panel.caption}</figcaption>
              {model ? (
                <p className={styles.panelCaption} data-truncation-readout>
                  Teal line: the edge of the modeled volume. Dashed circle: the modeled lesion;{' '}
                  {coveredInWords(model.lesionCoveredFraction)} of it lies inside the volume on this
                  plane.
                </p>
              ) : null}
            </figure>
          ),
        )}
      </div>
    </section>
  )
}
