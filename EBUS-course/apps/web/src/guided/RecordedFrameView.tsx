import { useId, type ReactNode } from 'react'
import {
  KNOBOLOGY_VIDEO_FRAME_HEIGHT,
  KNOBOLOGY_VIDEO_FRAME_WIDTH,
  KNOBOLOGY_VIDEO_IMAGE_REGION,
} from '@/features/knobology/videoSegments'

/**
 * One recorded EBUS frame, shown at a useful size (EBUS-PRE-REVIEW-02, L6-1 / L7-5 / L10-2).
 *
 * The recordings are 1920x1080 with the sector and its depth scale occupying a measured
 * x 480..1763, y 76..932 (see `KNOBOLOGY_VIDEO_IMAGE_REGION`). They used to be letterboxed into a
 * square box, so a 205 px box rendered a 205x115 frame in which the sector was about 46 px tall
 * and no border could be read. This component shows either that measured region or the whole
 * recorded frame, in a box whose aspect ratio matches whichever is displayed, so nothing is
 * squashed and nothing is enlarged past the pixels that exist.
 *
 * Both views are display only. The file is untouched, the held frame is captured from the full
 * frame, and the full-frame view is always one control away, because some recorded frames carry
 * the device banner — patient header, date, depth setting, frame rate — outside the measured
 * region.
 */
export type RecordedFrameFit = 'image' | 'frame'

export const RECORDED_FRAME_FIT_LABELS: Record<RecordedFrameFit, string> = {
  image: 'Ultrasound image',
  frame: 'Whole recorded frame',
}

export interface RecordedFramePoint {
  x: number
  y: number
}

/** The region of the recorded frame each fit displays, in recorded-frame pixels. */
export function recordedFrameRegion(fit: RecordedFrameFit) {
  return fit === 'image'
    ? KNOBOLOGY_VIDEO_IMAGE_REGION
    : { x: 0, y: 0, width: KNOBOLOGY_VIDEO_FRAME_WIDTH, height: KNOBOLOGY_VIDEO_FRAME_HEIGHT }
}

/**
 * A pointer position over the displayed box, in frame-normalised coordinates.
 *
 * The displayed box always has the aspect ratio of the region it shows, so the mapping is the
 * region's own offset and scale — there is no letterbox to subtract and no guesswork. Returns null
 * outside the box.
 */
export function recordedFramePointFromPointer(
  fit: RecordedFrameFit,
  box: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): RecordedFramePoint | null {
  if (box.width <= 0 || box.height <= 0) return null
  const region = recordedFrameRegion(fit)
  const x = (region.x + ((clientX - box.left) / box.width) * region.width) / KNOBOLOGY_VIDEO_FRAME_WIDTH
  const y = (region.y + ((clientY - box.top) / box.height) * region.height) / KNOBOLOGY_VIDEO_FRAME_HEIGHT
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

/** Separation of two frame-normalised points, in pixels of the recorded frame. */
export function recordedFramePixelSeparation(a: RecordedFramePoint, b: RecordedFramePoint): number {
  return Math.hypot(
    (a.x - b.x) * KNOBOLOGY_VIDEO_FRAME_WIDTH,
    (a.y - b.y) * KNOBOLOGY_VIDEO_FRAME_HEIGHT,
  )
}

export function RecordedFrameView({
  fit,
  media,
  calipers,
  activeCaliper,
  connectLine,
  onPlace,
  overlay,
  className = '',
}: {
  fit: RecordedFrameFit
  /** The `<video>` or `<img>` that holds the recorded pixels. */
  media: ReactNode
  calipers?: (RecordedFramePoint | null)[]
  activeCaliper?: number | null
  connectLine?: boolean
  /** Placement from a pointer or touch. Omitted where placement is not open. */
  onPlace?: (point: RecordedFramePoint) => void
  overlay?: ReactNode
  className?: string
}) {
  const region = recordedFrameRegion(fit)
  const clipId = useId().replace(/:/g, '')
  const placed = (calipers ?? []).filter((point): point is RecordedFramePoint => !!point)
  return (
    <div
      className={'guided-media recorded-frame' + (className ? ' ' + className : '')}
      data-recorded-fit={fit}
      style={{ aspectRatio: `${region.width} / ${region.height}` }}
      onPointerDown={
        onPlace
          ? (event) => {
              const box = event.currentTarget.getBoundingClientRect()
              const point = recordedFramePointFromPointer(
                fit,
                box,
                event.clientX,
                event.clientY,
              )
              if (point) onPlace(point)
            }
          : undefined
      }
    >
      <div className="recorded-frame-media" data-recorded-fit={fit} style={framePlacement(fit)}>
        {media}
      </div>
      {(placed.length > 0 || overlay) && (
        <svg
          viewBox={`${region.x} ${region.y} ${region.width} ${region.height}`}
          aria-hidden="true"
          focusable="false"
        >
          <clipPath id={clipId}>
            <rect x={region.x} y={region.y} width={region.width} height={region.height} />
          </clipPath>
          <g clipPath={`url(#${clipId})`}>
            {connectLine && placed.length === 2 && (
              <line
                x1={placed[0].x * KNOBOLOGY_VIDEO_FRAME_WIDTH}
                y1={placed[0].y * KNOBOLOGY_VIDEO_FRAME_HEIGHT}
                x2={placed[1].x * KNOBOLOGY_VIDEO_FRAME_WIDTH}
                y2={placed[1].y * KNOBOLOGY_VIDEO_FRAME_HEIGHT}
                stroke="#69f5de"
                strokeWidth="5"
                strokeDasharray="18 12"
              />
            )}
            {(calipers ?? []).map((point, index) =>
              point ? (
                <g
                  key={index}
                  stroke={index === activeCaliper ? '#ffff93' : '#69f5de'}
                  strokeWidth="6"
                  data-caliper={index}
                >
                  <path
                    d={
                      'M' +
                      (point.x * KNOBOLOGY_VIDEO_FRAME_WIDTH - 26) +
                      ' ' +
                      point.y * KNOBOLOGY_VIDEO_FRAME_HEIGHT +
                      'h52 M' +
                      point.x * KNOBOLOGY_VIDEO_FRAME_WIDTH +
                      ' ' +
                      (point.y * KNOBOLOGY_VIDEO_FRAME_HEIGHT - 26) +
                      'v52'
                    }
                  />
                </g>
              ) : null,
            )}
            {overlay}
          </g>
        </svg>
      )}
    </div>
  )
}

/**
 * Scale and offset the full recorded frame so the displayed region fills the box.
 *
 * Percentages of the box, so it follows the box at any size and needs no measurement in script.
 */
function framePlacement(fit: RecordedFrameFit) {
  const region = recordedFrameRegion(fit)
  return {
    width: (KNOBOLOGY_VIDEO_FRAME_WIDTH / region.width) * 100 + '%',
    height: (KNOBOLOGY_VIDEO_FRAME_HEIGHT / region.height) * 100 + '%',
    left: (-region.x / region.width) * 100 + '%',
    top: (-region.y / region.height) * 100 + '%',
  }
}
