'use client'
import media from '../../../../EBUS-course/apps/web/src/content/station-media.json'
import { initialModelState, modelReducer, type NeedleState } from '@/lib/ebus-model-contract'
import { needlePictureAlt, needlePictureUri } from '@/lib/ebus-needle-picture'
import type { ReviewImage } from '../content/chapter-reviews'
import { teachingClip } from '../content/clips'
import { OUTLINE_NAMES } from '../content/node-features'
import { Mark } from './ClipFigure'
import { NodeImage } from './NodeFeatureFigures'
import { STILL_COLOURS, stillAnnotation, stillRegionKind, stillRegionName } from './StationFigure'
import { useHiddenImage } from './useHiddenImage'
import styles from './chapter-review.module.css'

/*
 * One image of a chapter review (2026-11-11), shown before anything on it is named. A station
 * still carries its outlines as numbers from the start, because its question asks about them by
 * number; every name, and every outline on the other kinds of image, opens once the learner has
 * answered or opened the explanation.
 */
const NEEDLE_AT_STOP = [
  { type: 'sheath', value: 1 },
  { type: 'secure' },
  { type: 'stop', value: 19 },
  { type: 'needle', value: 19 },
].reduce(
  (state, action) => modelReducer(state, action) as NeedleState,
  initialModelState('needle') as NeedleState,
)
const NEEDLE_STATES: Record<'at-stop' | 'turned', NeedleState> = {
  'at-stop': NEEDLE_AT_STOP,
  turned: modelReducer(NEEDLE_AT_STOP, { type: 'rotate', value: 6 }) as NeedleState,
}

/**
 * A picture whose address would name its station, shown from an object URL (`useHiddenImage`).
 * The frame around it has the picture's shape already, so nothing moves when it arrives.
 */
function HiddenPicture({
  path,
  width,
  height,
  alt,
}: {
  path: string
  width: number
  height: number
  alt: string
}) {
  const { url, failed } = useHiddenImage(path)
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} width={width} height={height} alt={alt} data-hidden-address />
  ) : (
    <p role="status" className={styles.loading}>
      {failed ? 'This image could not load.' : 'Loading image…'}
    </p>
  )
}

export function ReviewImageView({ image, revealed }: { image: ReviewImage; revealed: boolean }) {
  const names = (entries: { key: string; kind?: string; name: string }[]) =>
    revealed &&
    entries.length > 0 && (
      <ol className={styles.names} data-review-names>
        {entries.map((entry, index) => (
          <li key={entry.key} data-kind={entry.kind}>
            <span aria-hidden="true">{index + 1}</span>
            {entry.name}
          </li>
        ))}
      </ol>
    )
  if (image.kind === 'still') {
    const asset = media[image.station as keyof typeof media]?.ebusVariants[0]
    const outlines = stillAnnotation(
      asset && 'annotationKey' in asset ? asset.annotationKey : undefined,
    )
    if (!asset || !outlines) return null
    return (
      <figure className={styles.figure} data-review-image="still">
        <div
          className={styles.frame}
          style={{ aspectRatio: outlines.width + ' / ' + outlines.height }}
        >
          <HiddenPicture
            path={'/socal-ebus-course/app' + asset.image}
            width={outlines.width}
            height={outlines.height}
            alt={
              'EBUS still with ' +
              outlines.regions.length +
              ' numbered outlines' +
              (revealed ? ', named in the list below.' : '.')
            }
          />
          <svg
            className={styles.overlay}
            viewBox={`0 0 ${outlines.width} ${outlines.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {outlines.regions.map((region, index) => {
              // Until the answer, every outline is one neutral colour: colour would name its kind.
              const colour = revealed ? STILL_COLOURS[stillRegionKind(region.label)] : '#e8eef2'
              const cx = region.points.reduce((sum, p) => sum + p[0], 0) / region.points.length
              const cy = region.points.reduce((sum, p) => sum + p[1], 0) / region.points.length
              const r = outlines.width * 0.019
              return (
                <g key={index}>
                  <polygon
                    points={region.points.map((p) => p[0] + ',' + p[1]).join(' ')}
                    fill="none"
                    stroke={colour}
                    strokeWidth={outlines.width * 0.004}
                    strokeLinejoin="round"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="#06161c"
                    stroke={colour}
                    strokeWidth={r * 0.14}
                  />
                  <text
                    x={cx}
                    y={cy + r * 0.38}
                    textAnchor="middle"
                    fill="#f4fbfa"
                    fontSize={r * 1.15}
                    fontWeight="700"
                  >
                    {index + 1}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
        {names(
          outlines.regions.map((region, index) => ({
            key: region.label + index,
            kind: stillRegionKind(region.label),
            name: stillRegionName(region.label),
          })),
        )}
      </figure>
    )
  }
  if (image.kind === 'node')
    return (
      <figure className={styles.figure} data-review-image="node">
        <div className={styles.frame}>
          <NodeImage
            slug={image.slug}
            layers={image.layers}
            outlines={revealed}
            label={'EBUS still of a lymph node' + (revealed ? ', with its outlines.' : '.')}
          />
        </div>
        {revealed && (
          <p className={styles.caption} data-review-names>
            Outlined: {image.layers.map((layer) => OUTLINE_NAMES[layer].toLowerCase()).join(', ')}.
          </p>
        )}
      </figure>
    )
  if (image.kind === 'clip') {
    const clip = teachingClip(image.clip)
    const stop = clip?.stops.find((entry) => entry.id === image.stop)
    const still = clip?.built.stops.find((entry) => entry.id === image.stop)
    if (!clip || !stop || !still) return null
    return (
      <figure className={styles.figure} data-review-image="clip">
        <div className={styles.frame}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={still.image}
            width={clip.built.width}
            height={clip.built.height}
            alt={'A paused frame of a patient EBUS recording: ' + clip.title.toLowerCase() + '.'}
          />
          {revealed && (
            <svg
              className={styles.overlay}
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {stop.marks.map((mark, index) => (
                <Mark key={index} mark={mark} number={index + 1} />
              ))}
            </svg>
          )}
        </div>
        {names(
          stop.marks.map((mark, index) => ({
            key: mark.label + index,
            kind: mark.kind,
            name: mark.label,
          })),
        )}
      </figure>
    )
  }
  const state = NEEDLE_STATES[image.state]
  return (
    <figure className={styles.figure} data-review-image="needle">
      <div className={styles.frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={needlePictureUri(state, { reveal: revealed, scale: false })}
          width={540}
          height={400}
          alt={needlePictureAlt(state)}
        />
      </div>
      <p className={styles.caption}>Simulated ultrasound from the needle lab.</p>
    </figure>
  )
}
