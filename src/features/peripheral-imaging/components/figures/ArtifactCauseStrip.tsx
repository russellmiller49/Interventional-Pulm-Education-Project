'use client'

import { teachingFigure } from '../../content/teachingFigures'
import { Sides } from './CheckImages'
import { FigureCanvas } from './FigureCanvas'
import {
  DEPENDENT_OPACITY,
  dependentOpacityImages,
  MOTION_EXAMPLE,
  motionPlanePixels,
} from './simulatedFindings'
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

/** The strip's three images, computed together once the CT has loaded. */
function artifactStripImages(volume: Uint8Array) {
  return {
    truncation: truncationModel(volume),
    motion: motionPlanePixels(volume, 'coronal'),
    opacity: dependentOpacityImages(volume).current,
  }
}

/**
 * Section 16's "Match the artifact to its cause" strip (OD4-06, brief D4–D6). Truncation is shown as
 * coverage, by masking the course's CT outside a reconstruction volume. Motion and a new dependent
 * opacity are simulated on the same CT (owner decision, 2026-10-12, `simulatedFindings.ts`): a spin
 * acquired during breathing, and atelectasis against the posterior pleura.
 */
export function ArtifactCauseStrip() {
  const declaration = teachingFigure('changing-anatomy:artifact-strip')
  const volume = useTeachingVolume()
  const model = useFigureComputation(volume.data, artifactStripImages)
  const state = volume.state === 'failed' ? 'failed' : model ? 'ready' : 'loading'
  const image = (panelId: string) => {
    if (panelId === 'motion')
      return (
        <FigureCanvas
          pixels={model?.motion ?? null}
          size={MOTION_EXAMPLE.sizePx}
          label="Coronal plane from a CBCT spin: the catheter and the lesion margin each appear twice, a small distance apart"
          overlay={model ? <Sides size={MOTION_EXAMPLE.sizePx} left="R" right="L" /> : undefined}
        />
      )
    if (panelId === 'opacity')
      return (
        <FigureCanvas
          pixels={model?.opacity ?? null}
          size={DEPENDENT_OPACITY.sizePx}
          label="Axial plane: a soft opacity fills the posterior, dependent part of both lungs"
          overlay={model ? <Sides size={DEPENDENT_OPACITY.sizePx} left="R" right="L" /> : undefined}
        />
      )
    return (
      <FigureCanvas
        pixels={model?.truncation.axial ?? null}
        size={AXIAL_VIEW.sizePx}
        label="Axial CT plane, dark outside a reconstruction volume whose edge runs through the lesion"
        overlay={
          model ? (
            <>
              <circle
                cx={model.truncation.boundary.x}
                cy={model.truncation.boundary.y}
                r={model.truncation.boundary.r}
                fill="none"
                stroke="#77dccf"
                strokeWidth="1.2"
              />
              <circle
                cx={model.truncation.lesionAxial.x}
                cy={model.truncation.lesionAxial.y}
                r={model.truncation.lesionAxial.r + 2}
                fill="none"
                stroke="#f0c27d"
                strokeWidth="1.2"
                strokeDasharray="2.5 2.5"
              />
              <Sides size={AXIAL_VIEW.sizePx} left="R" right="L" />
            </>
          ) : undefined
        }
      />
    )
  }
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
        {declaration.panels.map((panel) => (
          <figure
            key={panel.id}
            className={styles.panel}
            data-figure-panel={panel.id}
            data-panel-medium={panel.medium}
          >
            <p className={styles.panelTitle}>{panel.title}</p>
            {state === 'failed' ? (
              <p className={styles.status} role="status">
                The image could not be loaded here.
              </p>
            ) : (
              image(panel.id)
            )}
            <figcaption>{panel.caption}</figcaption>
            {panel.id === 'truncation' && model ? (
              <p className={styles.panelCaption} data-truncation-readout>
                Teal line: the edge of the reconstruction volume. Dashed circle: the lesion;{' '}
                {coveredInWords(model.truncation.lesionCoveredFraction)} of it lies inside the
                volume on this plane.
              </p>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  )
}
