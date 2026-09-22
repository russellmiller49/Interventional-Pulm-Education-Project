import {
  KNOBOLOGY_VIDEO_FRAME_HEIGHT,
  KNOBOLOGY_VIDEO_FRAME_WIDTH,
  KNOBOLOGY_VIDEO_IMAGE_REGION,
} from '@/features/knobology/videoSegments'

/**
 * Which part of a recorded EBUS frame is on display, and how a pointer over it maps back to the
 * recording (EBUS-PRE-REVIEW-02, L6-1 / L10-2).
 *
 * `image` is the measured region the sector and its depth scale occupy inside the 1920x1080
 * recording; `frame` is the whole recording. Both are display windows — no file is cropped, the
 * held frame is always captured whole, and the full-frame view stays one control away because some
 * recorded frames carry the device banner outside the measured region.
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

/** The region each fit displays, in recorded-frame pixels. */
export function recordedFrameRegion(fit: RecordedFrameFit) {
  return fit === 'image'
    ? KNOBOLOGY_VIDEO_IMAGE_REGION
    : { x: 0, y: 0, width: KNOBOLOGY_VIDEO_FRAME_WIDTH, height: KNOBOLOGY_VIDEO_FRAME_HEIGHT }
}

/**
 * A pointer position over the displayed box, in frame-normalised coordinates.
 *
 * The box always has the aspect ratio of the region it shows, so the mapping is that region's own
 * offset and scale: there is no letterbox to subtract and nothing is measured off the picture.
 * Returns null for a box with no area.
 */
export function recordedFramePointFromPointer(
  fit: RecordedFrameFit,
  box: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): RecordedFramePoint | null {
  if (!(box.width > 0) || !(box.height > 0)) return null
  const region = recordedFrameRegion(fit)
  const x =
    (region.x + ((clientX - box.left) / box.width) * region.width) / KNOBOLOGY_VIDEO_FRAME_WIDTH
  const y =
    (region.y + ((clientY - box.top) / box.height) * region.height) / KNOBOLOGY_VIDEO_FRAME_HEIGHT
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

/**
 * Scale and offset the whole recorded frame so the displayed region fills the box.
 *
 * Percentages of the box, so it follows the box at any size and needs no measurement in script.
 */
export function recordedFramePlacement(fit: RecordedFrameFit) {
  const region = recordedFrameRegion(fit)
  return {
    width: (KNOBOLOGY_VIDEO_FRAME_WIDTH / region.width) * 100 + '%',
    height: (KNOBOLOGY_VIDEO_FRAME_HEIGHT / region.height) * 100 + '%',
    left: (-region.x / region.width) * 100 + '%',
    top: (-region.y / region.height) * 100 + '%',
  }
}
