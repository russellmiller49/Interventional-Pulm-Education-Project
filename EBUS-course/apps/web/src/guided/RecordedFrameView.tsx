import { useId, type ReactNode } from 'react'
import {
  KNOBOLOGY_VIDEO_FRAME_HEIGHT,
  KNOBOLOGY_VIDEO_FRAME_WIDTH,
} from '@/features/knobology/videoSegments'
import {
  recordedFramePlacement,
  recordedFrameRegion,
  type RecordedFrameFit,
  type RecordedFramePoint,
} from './recordedFrameRegion'
import { recordedFramePointFromPointer } from './recordedFrameRegion'

/**
 * One recorded EBUS frame, shown at a useful size (EBUS-PRE-REVIEW-02, L6-1 / L7-5 / L10-2).
 *
 * The recordings are 1920x1080 with the sector and its depth scale occupying a measured
 * x 480..1763, y 76..932. They used to be letterboxed into a square box, so a 205 px box rendered
 * a 205x115 frame in which the sector was about 46 px tall and no border could be read. The box
 * now has the aspect ratio of whichever region is displayed, so nothing is squashed and nothing is
 * enlarged past the pixels that exist. See `recordedFrameRegion.ts` for the region and the pointer
 * transform.
 */
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
      <div className="recorded-frame-media" data-recorded-fit={fit} style={recordedFramePlacement(fit)}>
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
