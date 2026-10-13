'use client'

import { CONSPICUITY_SET } from '../../content/teachingFigures'
import { FigureCanvas } from './FigureCanvas'
import {
  conspicuityImages,
  fieldComparisonImages,
  FIELD_COMPARISON,
  type LesionMark,
} from './teachingFigureModel'
import {
  DEPENDENT_OPACITY,
  dependentOpacityImages,
  MOTION_EXAMPLE,
  motionPlanes,
  type MotionPlaneId,
} from './simulatedFindings'
import { useFigureComputation } from './useFigureComputation'
import { useTeachingVolume } from './useTeachingData'
import styles from './figures.module.css'

/*
 * The images beside two checks and three practice cases, computed from the course's CT.
 *
 * Owner feedback, 2026-10-11 (slide 2, applied where the same thing occurred): these were flat
 * cartoons — two grey ovals for the lungs, an empty square for a field — on screens that ask the
 * learner to read an image. They are now projections of the same CT the suite draws, at the same
 * geometry, so what the question describes is what the picture shows.
 *
 * Owner decision, 2026-10-12: the checks in Sections 4 and 16 show their findings too — a new
 * dependent opacity, and the doubled edges of motion during a spin — simulated on the same CT
 * (`simulatedFindings.ts`).
 */

function FigureStatus({ state }: { readonly state: 'loading' | 'failed' | 'ready' }) {
  if (state === 'ready') return null
  return (
    <p className={styles.status} role="status">
      {state === 'failed'
        ? 'The images could not be drawn here. The question describes each one in words.'
        : 'Preparing the images…'}
    </p>
  )
}

function LesionRing({ mark }: { readonly mark: LesionMark }) {
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

/** A tool approaching the lesion from the hilum side, in the image's own pixels. */
function ToolLine({ mark }: { readonly mark: LesionMark }) {
  return (
    <line
      x1={mark.x - 46}
      y1={mark.y - 30}
      x2={mark.x - 2}
      y2={mark.y - 1}
      stroke="#f4f8f8"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  )
}

/**
 * Section 6's check: Image A, the collimated reference, and Image B, the same projection with the
 * collimator open — the appearance the question describes.
 */
export function ConspicuityPair() {
  const volume = useTeachingVolume()
  const model = useFigureComputation(volume.data, conspicuityImages)
  const state = volume.state === 'failed' ? 'failed' : model ? 'ready' : 'loading'
  return (
    <section className={styles.figure} data-signal-comparison data-figure-state={state}>
      <p className={styles.kicker}>Image A and Image B · the same projection</p>
      <FigureStatus state={state} />
      <div className={styles.panelGridWide}>
        {(
          [
            ['Image A', model?.reference ?? null, 'Projection collimated around the lesion'],
            [
              'Image B',
              model?.scatter ?? null,
              'The same projection with the collimator open: lower contrast throughout',
            ],
          ] as const
        ).map(([title, pixels, label]) => (
          <figure key={title} className={styles.panel}>
            <p className={styles.panelTitle}>{title}</p>
            <FigureCanvas
              pixels={pixels}
              size={CONSPICUITY_SET.sizePx}
              label={label}
              overlay={
                model ? (
                  <>
                    <LesionRing mark={model.lesion.reference} />
                    <ToolLine mark={model.lesion.reference} />
                  </>
                ) : undefined
              }
            />
          </figure>
        ))}
      </div>
      <p className={styles.note}>Dashed circle: the lesion · white line: the tool.</p>
    </section>
  )
}

/** The low-contrast appearance three practice cases describe, on the course's CT. */
export function WashedOutProjection() {
  const volume = useTeachingVolume()
  const model = useFigureComputation(volume.data, conspicuityImages)
  const state = volume.state === 'failed' ? 'failed' : model ? 'ready' : 'loading'
  return (
    <section className={styles.figure} data-case-image data-figure-state={state}>
      <p className={styles.kicker}>The image on the monitor</p>
      <FigureStatus state={state} />
      <figure className={`${styles.panel} ${styles.singlePanel}`}>
        {/* The appearance only: these cases place their lesion in different lobes, so nothing on
            the image says where one is. */}
        <FigureCanvas
          pixels={model?.scatter ?? null}
          size={CONSPICUITY_SET.sizePx}
          label="A low-contrast frontal projection: the vessels, the diaphragm and the soft tissue are close to the same gray"
        />
        <figcaption>
          Low contrast throughout: the vessels, the diaphragm and the soft tissue are close to the
          same gray.
        </figcaption>
      </figure>
    </section>
  )
}

/**
 * Section 7's check: Field A, the open field, and Field B, collimated until part of the planned
 * tool path and one landmark are cut off.
 */
export function FieldPair() {
  const volume = useTeachingVolume()
  const model = useFigureComputation(volume.data, fieldComparisonImages)
  const state = volume.state === 'failed' ? 'failed' : model ? 'ready' : 'loading'
  return (
    <section className={styles.figure} data-field-comparison data-figure-state={state}>
      <p className={styles.kicker}>Field A and Field B · the same projection</p>
      <FigureStatus state={state} />
      <div className={styles.panelGridWide}>
        {(
          [
            [
              'Field A',
              model?.open ?? null,
              'Field A includes the lesion, both landmarks and the whole dashed tool path',
              null,
            ],
            [
              'Field B',
              model?.tight ?? null,
              'Field B includes the lesion but cuts off the dashed tool path and landmark 1',
              model?.tightRect ?? null,
            ],
          ] as const
        ).map(([title, pixels, label, rect]) => (
          <figure key={title} className={styles.panel}>
            <p className={styles.panelTitle}>{title}</p>
            <FigureCanvas
              pixels={pixels}
              size={FIELD_COMPARISON.sizePx}
              label={label}
              overlay={
                model ? (
                  <FieldMarks
                    lesion={model.lesion}
                    landmarks={model.landmarks}
                    path={model.path}
                    rect={rect}
                  />
                ) : undefined
              }
            />
          </figure>
        ))}
      </div>
      <p className={styles.note}>
        Amber circle: the lesion · numbered crosses: landmarks 1 and 2 · dashed teal line: the
        planned tool path · amber outline: the collimated field.
      </p>
    </section>
  )
}

function FieldMarks({
  lesion,
  landmarks,
  path,
  rect,
}: {
  readonly lesion: LesionMark
  readonly landmarks: readonly (readonly [number, number])[]
  readonly path: readonly [readonly [number, number], readonly [number, number]]
  /** The collimated field, where the frame is collimated: marks outside it were not imaged. */
  readonly rect: { readonly x: number; readonly y: number; readonly size: number } | null
}) {
  const clip = rect ? 'field-pair-clip' : undefined
  return (
    <>
      {rect ? (
        <>
          <clipPath id="field-pair-clip">
            <rect x={rect.x} y={rect.y} width={rect.size} height={rect.size} />
          </clipPath>
          <rect
            x={rect.x}
            y={rect.y}
            width={rect.size}
            height={rect.size}
            fill="none"
            stroke="#ecc178"
            strokeWidth="1.2"
          />
        </>
      ) : null}
      <g clipPath={clip ? `url(#${clip})` : undefined}>
        <line
          x1={path[0][0]}
          y1={path[0][1]}
          x2={path[1][0]}
          y2={path[1][1]}
          stroke="#77dccf"
          strokeWidth="1.6"
          strokeDasharray="4 3"
        />
        <circle
          cx={lesion.x}
          cy={lesion.y}
          r={lesion.r + 2}
          fill="none"
          stroke="#f0c27d"
          strokeWidth="1.4"
        />
        {landmarks.map(([x, y], index) => (
          <g key={index} stroke="#c9f6ee" strokeWidth="1.2">
            <path d={`M${x - 4} ${y}h8M${x} ${y - 4}v8`} />
            {/* Toward the centre of the image, so a mark near the field edge keeps its number. */}
            <text x={x - 10} y={y - 5} fill="#c9f6ee" stroke="none" fontSize="9">
              {index + 1}
            </text>
          </g>
        ))}
      </g>
    </>
  )
}

/** Small orientation letters in an image's corners, in the image's own pixels. */
export function Sides({
  size,
  left,
  right,
}: {
  readonly size: number
  readonly left: string
  readonly right: string
}) {
  return (
    <g
      fill="#e2eef0"
      fontSize={size / 21}
      fontWeight="600"
      stroke="#0b1d25"
      strokeWidth={size / 150}
      paintOrder="stroke"
    >
      <text x={size * 0.02} y={size * 0.07}>
        {left}
      </text>
      <text x={size * 0.98} y={size * 0.07} textAnchor="end">
        {right}
      </text>
    </g>
  )
}

/**
 * Section 4's check: the planning CT, and the same axial level now, with a new dependent opacity
 * over a nodule that was distinct before.
 */
export function DependentOpacityPair() {
  const volume = useTeachingVolume()
  const model = useFigureComputation(volume.data, dependentOpacityImages)
  const state = volume.state === 'failed' ? 'failed' : model ? 'ready' : 'loading'
  const size = DEPENDENT_OPACITY.sizePx
  return (
    <section className={styles.figure} data-opacity-comparison data-figure-state={state}>
      <p className={styles.kicker}>Planning CT and current imaging · the same axial level</p>
      <FigureStatus state={state} />
      <div className={styles.panelGridWide}>
        {(
          [
            [
              'planning',
              'Planning CT',
              model?.planning ?? null,
              'Axial planning CT: a small nodule stands out in the posterior left lung',
            ],
            [
              'current',
              'Current imaging',
              model?.current ?? null,
              'The same axial level now: an opacity fills the posterior part of both lungs and covers the nodule',
            ],
          ] as const
        ).map(([id, title, pixels, label]) => (
          <figure key={id} className={styles.panel} data-opacity-panel={id}>
            <p className={styles.panelTitle}>{title}</p>
            <FigureCanvas
              pixels={pixels}
              size={size}
              label={label}
              overlay={
                model ? (
                  <>
                    <Sides size={size} left="R" right="L" />
                    {id === 'planning' && model.nodule ? (
                      <circle
                        cx={model.nodule.x}
                        cy={model.nodule.y}
                        r={model.nodule.r + 5}
                        fill="none"
                        stroke="#f0c27d"
                        strokeWidth="1.4"
                        strokeDasharray="3 3"
                      />
                    ) : null}
                  </>
                ) : undefined
              }
            />
          </figure>
        ))}
      </div>
      <p className={styles.note}>
        Dashed circle: the lesion on the planning CT. The patient is supine, so posterior is at the
        bottom of each image.
      </p>
    </section>
  )
}

const MOTION_PANELS: readonly {
  readonly id: MotionPlaneId
  readonly title: string
  readonly label: string
  readonly sides: readonly [string, string]
}[] = [
  {
    id: 'coronal',
    title: 'Coronal',
    label:
      'Coronal plane from the spin: the catheter and the nodule margin each appear twice, a few millimeters apart',
    sides: ['R', 'L'],
  },
  {
    id: 'sagittal',
    title: 'Sagittal',
    label:
      'Sagittal plane from the spin: the nodule margin and the vessels around it appear twice, one above the other',
    sides: ['A', 'P'],
  },
  {
    id: 'axial',
    title: 'Axial',
    label: 'Axial plane from the spin: the nodule margin is doubled beside the catheter',
    sides: ['R', 'L'],
  },
]

/** Section 16's check: three planes through the nodule from a spin acquired during breathing. */
export function MotionDoubledPlanes() {
  const volume = useTeachingVolume()
  const model = useFigureComputation(volume.data, motionPlanes)
  const state = volume.state === 'failed' ? 'failed' : model ? 'ready' : 'loading'
  const size = MOTION_EXAMPLE.sizePx
  return (
    <section className={styles.figure} data-motion-planes data-figure-state={state}>
      <p className={styles.kicker}>First CBCT spin · three planes through the nodule</p>
      <FigureStatus state={state} />
      <div className={styles.panelGrid}>
        {MOTION_PANELS.map((panel) => (
          <figure key={panel.id} className={styles.panel} data-motion-panel={panel.id}>
            <p className={styles.panelTitle}>{panel.title}</p>
            <FigureCanvas
              pixels={model ? model[panel.id] : null}
              size={size}
              label={panel.label}
              overlay={
                model ? (
                  <Sides size={size} left={panel.sides[0]} right={panel.sides[1]} />
                ) : undefined
              }
            />
          </figure>
        ))}
      </div>
      <p className={styles.note}>The bright line is the catheter, ending at the nodule.</p>
    </section>
  )
}
