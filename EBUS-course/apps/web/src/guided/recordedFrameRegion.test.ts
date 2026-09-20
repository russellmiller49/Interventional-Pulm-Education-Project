import { describe, expect, it } from 'vitest'
import {
  KNOBOLOGY_VIDEO_FRAME_HEIGHT,
  KNOBOLOGY_VIDEO_FRAME_WIDTH,
  KNOBOLOGY_VIDEO_IMAGE_REGION,
} from '@/features/knobology/videoSegments'
import {
  recordedFramePixelSeparation,
  recordedFramePlacement,
  recordedFramePointFromPointer,
  recordedFrameRegion,
} from './recordedFrameRegion'

/**
 * The transform between the displayed box and the recording (EBUS-PRE-REVIEW-02, L6-1 / L10-2).
 *
 * A caliper placed with a pointer has to land on the same recorded pixel as one moved with the
 * keyboard, in either view, at any box size — otherwise placement means something different
 * depending on how it was done, and the saved frame does not match what the learner saw.
 */
const box = (width: number, height: number) => ({ left: 40, top: 12, width, height })

describe('the displayed region', () => {
  it('is the measured image area, not a guess at the sector', () => {
    expect(recordedFrameRegion('image')).toEqual(KNOBOLOGY_VIDEO_IMAGE_REGION)
    expect(KNOBOLOGY_VIDEO_IMAGE_REGION.x + KNOBOLOGY_VIDEO_IMAGE_REGION.width).toBeLessThanOrEqual(
      KNOBOLOGY_VIDEO_FRAME_WIDTH,
    )
    expect(
      KNOBOLOGY_VIDEO_IMAGE_REGION.y + KNOBOLOGY_VIDEO_IMAGE_REGION.height,
    ).toBeLessThanOrEqual(KNOBOLOGY_VIDEO_FRAME_HEIGHT)
  })

  it('leaves the whole recorded frame available', () => {
    expect(recordedFrameRegion('frame')).toEqual({
      x: 0,
      y: 0,
      width: KNOBOLOGY_VIDEO_FRAME_WIDTH,
      height: KNOBOLOGY_VIDEO_FRAME_HEIGHT,
    })
  })

  it('places the whole frame so the displayed region exactly fills the box', () => {
    const placement = recordedFramePlacement('image')
    expect(placement.width).toBe((1920 / 1284) * 100 + '%')
    expect(placement.left).toBe((-480 / 1284) * 100 + '%')
    expect(recordedFramePlacement('frame')).toEqual({
      width: '100%',
      height: '100%',
      left: '0%',
      top: '0%',
    })
  })
})

describe('mapping a pointer back to the recording', () => {
  it('maps the corners of the image view to the corners of the measured region', () => {
    const b = box(642, 428.5)
    expect(recordedFramePointFromPointer('image', b, b.left, b.top)).toEqual({
      x: 480 / 1920,
      y: 76 / 1080,
    })
    const bottomRight = recordedFramePointFromPointer(
      'image',
      b,
      b.left + b.width,
      b.top + b.height,
    )!
    expect(bottomRight.x * 1920).toBeCloseTo(480 + 1284, 6)
    expect(bottomRight.y * 1080).toBeCloseTo(76 + 857, 6)
  })

  it('maps the corners of the full-frame view to the corners of the recording', () => {
    const b = box(800, 450)
    expect(recordedFramePointFromPointer('frame', b, b.left, b.top)).toEqual({ x: 0, y: 0 })
    expect(recordedFramePointFromPointer('frame', b, b.left + 800, b.top + 450)).toEqual({
      x: 1,
      y: 1,
    })
  })

  it('gives the same recorded pixel whatever the box is scaled to', () => {
    const small = recordedFramePointFromPointer('image', box(300, 200.2), 40 + 150, 12 + 100.1)!
    const large = recordedFramePointFromPointer('image', box(900, 600.6), 40 + 450, 12 + 300.3)!
    expect(large.x).toBeCloseTo(small.x, 10)
    expect(large.y).toBeCloseTo(small.y, 10)
  })

  it('agrees with the image view about a point both views can show', () => {
    // The centre of the measured region, reached through each view's own box.
    const viaImage = recordedFramePointFromPointer('image', box(642, 428.5), 40 + 321, 12 + 214.25)!
    const centreX = (480 + 1284 / 2) / 1920
    const centreY = (76 + 857 / 2) / 1080
    const viaFrame = recordedFramePointFromPointer(
      'frame',
      box(960, 540),
      40 + centreX * 960,
      12 + centreY * 540,
    )!
    expect(viaImage.x).toBeCloseTo(viaFrame.x, 10)
    expect(viaImage.y).toBeCloseTo(viaFrame.y, 10)
  })

  it('refuses a box with no area rather than returning a nonsense point', () => {
    expect(recordedFramePointFromPointer('image', box(0, 0), 40, 12)).toBeNull()
  })
})

describe('the separation readout', () => {
  it('is in pixels of the recorded frame, with no calibration applied', () => {
    expect(
      recordedFramePixelSeparation({ x: 0.5, y: 0.5 }, { x: 0.5 + 100 / 1920, y: 0.5 }),
    ).toBeCloseTo(100, 6)
    expect(
      recordedFramePixelSeparation({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 + 100 / 1080 }),
    ).toBeCloseTo(100, 6)
  })

  it('does not change with the view the calipers were placed in', () => {
    const a = recordedFramePointFromPointer('image', box(642, 428.5), 40 + 100, 12 + 100)!
    const b = recordedFramePointFromPointer('image', box(642, 428.5), 40 + 300, 12 + 260)!
    const scaled = [
      recordedFramePointFromPointer('image', box(1284, 857), 40 + 200, 12 + 200)!,
      recordedFramePointFromPointer('image', box(1284, 857), 40 + 600, 12 + 520)!,
    ]
    expect(recordedFramePixelSeparation(a, b)).toBeCloseTo(
      recordedFramePixelSeparation(scaled[0], scaled[1]),
      6,
    )
  })
})
