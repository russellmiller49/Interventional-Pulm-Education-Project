'use client'

import { DTS_ABSENCE_FIGURE, type CaseFigureDeclaration } from '../../content/caseFigures'
import { ANATOMY, sampleAnatomy } from '../../lib/anatomy'
import { ctSampler } from '../../lib/ctProjection'
import { LESION_CENTER } from '../../lib/physics'
import { DTS } from '../../lib/tomosynthesis'
import { DTS_PLANE, DTS_TOOL_MM, priorPlaneGray, priorPlanePoint } from '../suite/dtsModel'
import { FigureCanvas } from './FigureCanvas'
import { useFigureComputation } from './useFigureComputation'
import { useTeachingVolume } from './useTeachingData'
import styles from './figures.module.css'

const SIZE = DTS_PLANE.sizePx

function grayPixels(gray: (col: number, row: number) => number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(SIZE * SIZE * 4)
  for (let row = 0; row < SIZE; row++)
    for (let col = 0; col < SIZE; col++) {
      const value = gray(col, row)
      const i = (row * SIZE + col) * 4
      pixels[i] = pixels[i + 1] = pixels[i + 2] = value
      pixels[i + 3] = 255
    }
  return pixels
}

/**
 * The DTS model's projection at 0° with the modeled catheter in place, over the planes' own frame.
 *
 * The stored DTS projections pass a horizontal high-pass teaching filter before they are refocused
 * (`anatomy/dts.json`), which removes most of a horizontal catheter's length from any single
 * projection, so one of them cannot show "a projection with the catheter in place". This is the
 * same acquisition model before that filter: the generator's density weighting and its catheter
 * (`scripts/peripheral-imaging/build-dts-projections.py`: radius 1.8 mm, density 8, 18 mm from the
 * lesion's plane, from 60 mm short of the lesion's centre up to it), summed along the beam at the
 * CT's own spacing. Denser is brighter; the display window is fixed.
 */
export const DTS_PROJECTION_WINDOW = { low: 100, high: 360 } as const

export function dtsModelDensity(hu: number): number {
  return (
    Math.min(3, Math.max(0, (hu + 1000) / 1000)) + 0.7 * Math.min(2, Math.max(0, (hu - 150) / 1000))
  )
}

/** How much of the modeled catheter a point is inside, 0–1 (the generator's soft-edged cylinder). */
export function modeledCatheterFraction(x: number, y: number, z: number): number {
  const rx = x - LESION_CENTER[0]
  const ry = y - LESION_CENTER[1]
  const rz = z - LESION_CENTER[2]
  if (rx < DTS_TOOL_MM.start || rx > DTS_TOOL_MM.end) return 0
  return Math.min(1, Math.max(0, DTS_TOOL_MM.radius - Math.hypot(ry - DTS.toolPlaneRelativeMm, rz)))
}

export function dtsModelProjection(volume: Uint8Array): Uint8ClampedArray {
  const sample = ctSampler(volume)
  const y0 = ANATOMY.originMm[1]
  const dy = ANATOMY.spacingMm[1]
  const ny = ANATOMY.sizeXyz[1]
  const { low, high } = DTS_PROJECTION_WINDOW
  return grayPixels((col, row) => {
    const [x, , z] = priorPlanePoint(col, row, 0)
    let sum = 0
    for (let j = 0; j < ny; j++) {
      const y = y0 + j * dy
      const tool = modeledCatheterFraction(x, y, z)
      sum += (dtsModelDensity(sample(x, y, z)) * (1 - tool) + 8 * tool) * dy
    }
    return Math.max(0, Math.min(255, ((sum - low) / (high - low)) * 255))
  })
}

/** The planning-CT prior on a plane, in neutral gray: the samples the Section 11 view tints teal. */
export function neutralPriorPlane(volume: Uint8Array, planeDepth: number): Uint8ClampedArray {
  return grayPixels((col, row) =>
    priorPlaneGray(sampleAnatomy(volume, priorPlanePoint(col, row, planeDepth))),
  )
}

const PLANE_NAMES: Readonly<Record<number, string>> = {
  [DTS_ABSENCE_FIGURE.planeDepthsMm[0]]: 'at the catheter’s depth',
  [DTS_ABSENCE_FIGURE.planeDepthsMm[1]]: 'between the catheter and the lesion',
  [DTS_ABSENCE_FIGURE.planeDepthsMm[2]]: 'through the lesion',
}

export interface DtsAbsenceImages {
  readonly projection: Uint8ClampedArray
  readonly planes: readonly Uint8ClampedArray[]
  readonly ct: Uint8ClampedArray
}

/** Every pixel of practice case 9's figure, from the teaching CT alone. Fixed authored data. */
export function dtsAbsenceImages(volume: Uint8Array): DtsAbsenceImages {
  return {
    projection: dtsModelProjection(volume),
    planes: DTS_ABSENCE_FIGURE.planeDepthsMm.map((depth) => neutralPriorPlane(volume, depth)),
    ct: neutralPriorPlane(volume, DTS_ABSENCE_FIGURE.ctPlaneDepthMm),
  }
}

/**
 * Practice case 9's figure (QS-5). Before an answer or the explanation it shows only what the
 * learner in the room would see: a projection with the catheter, three reconstructed planes with
 * none, and the planning CT. Where the planes came from, which is the answer, waits for the
 * explanation (OD4-04 rule 5); the planes are drawn in neutral gray so no colour gives it away
 * (rule 4).
 */
export function DtsAbsenceFigure({
  declaration,
  revealed,
}: {
  readonly declaration: CaseFigureDeclaration
  readonly revealed: boolean
}) {
  const volume = useTeachingVolume()
  const images = useFigureComputation(volume.data, dtsAbsenceImages)
  const state = volume.state === 'failed' ? 'failed' : images ? 'ready' : 'loading'

  return (
    <figure
      className={styles.figure}
      data-case-figure={declaration.identity}
      data-case-figure-evidence={declaration.evidence}
      data-case-figure-medium={declaration.medium}
      data-figure-state={state}
      data-figure-revealed={revealed ? 'true' : 'false'}
    >
      <p className={styles.modelLabel} data-model-label>
        {declaration.label}
      </p>
      {state === 'failed' ? (
        <p className={styles.status} role="status">
          The teaching figure could not be loaded here. The written situation still describes the
          case.
        </p>
      ) : state === 'loading' ? (
        <p className={styles.status} role="status">
          Preparing the figure from the teaching model…
        </p>
      ) : null}
      <div className={styles.panelGrid}>
        <figure className={styles.panel} data-figure-panel="projection">
          <FigureCanvas
            pixels={images?.projection ?? null}
            size={SIZE}
            label="A projection taken with the modeled catheter in place; the catheter is a bright line ending at the lesion"
          />
          <figcaption>
            <strong>Projection</strong>, with the catheter in place
          </figcaption>
        </figure>
        {DTS_ABSENCE_FIGURE.planeDepthsMm.map((depth, index) => (
          <figure key={depth} className={styles.panel} data-figure-panel={`plane-${index + 1}`}>
            <FigureCanvas
              pixels={images?.planes[index] ?? null}
              size={SIZE}
              label={`Reconstructed plane ${PLANE_NAMES[depth]}`}
            />
            <figcaption>
              <strong>Reconstructed plane</strong> {PLANE_NAMES[depth]}
            </figcaption>
          </figure>
        ))}
        <figure className={styles.panel} data-figure-panel="planning-ct">
          <FigureCanvas
            pixels={images?.ct ?? null}
            size={SIZE}
            label="Planning CT, the same plane through the lesion"
          />
          <figcaption>
            <strong>Planning CT</strong>, the same plane through the lesion
          </figcaption>
        </figure>
      </div>
      <p className={styles.note}>
        Every panel shows the same frame, {DTS_PLANE.spanMm} mm across. The three planes run from
        the catheter’s depth, {Math.abs(DTS.toolPlaneRelativeMm)} mm from the lesion’s centre along
        the beam, to the lesion’s centre.
      </p>
      {revealed ? (
        <dl className={styles.readouts} data-case-figure-readouts>
          <dt>Where these planes come from, in this model</dt>
          <dd>
            They are drawn from the planning CT, which was acquired before the catheter was placed,
            so no plane at any depth contains it. That is why they match the planning CT panel.
          </dd>
          <dt>What the acquisition itself contains</dt>
          <dd>
            Every projection of this acquisition was taken with the catheter in place, as the
            projection on the left shows. Planes built from those projections would carry it near
            its depth, at least blurred.
          </dd>
        </dl>
      ) : null}
    </figure>
  )
}
