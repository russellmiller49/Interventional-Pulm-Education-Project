import { describe, expect, it } from 'vitest'
import {
  ARTERY_KEYS,
  PULSE_AMPLITUDE,
  PULSE_PERIOD_MS,
  drawPulse,
  pulseRegion,
  pulseScale,
  structureOutline,
} from './sectorOverlays'

/** A 40 x 40 image of tissue (1) with a filled disc of `id`, and a strip outside the sector. */
function image(id: number, radius = 8, cx = 20, cy = 20) {
  const width = 40,
    height = 40,
    labels = new Uint8Array(width * height).fill(1)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (x < 3) labels[y * width + x] = 0
      else if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) labels[y * width + x] = id
    }
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < labels.length; i++) {
    const gray = labels[i] === id ? 0 : labels[i] === 1 ? 90 : 0
    rgba.set([gray, gray, gray, 255], i * 4)
  }
  return { width, height, labels, rgba }
}

describe('the outline of a found structure', () => {
  it('is the structure’s own edge, with its number on the structure', () => {
    const { width, height, labels } = image(5)
    const outline = structureOutline(labels, width, height, 5)!
    expect(outline.count).toBeGreaterThan(150)
    for (const i of outline.edge) expect(labels[i]).toBe(5)
    // Every edge pixel touches something that is not the structure.
    for (const i of outline.edge)
      expect(
        [i - 1, i + 1, i - width, i + width].some((n) => labels[n] !== 5),
      ).toBe(true)
    expect(labels[outline.anchor[1] * width + outline.anchor[0]]).toBe(5)
    expect(structureOutline(labels, width, height, 9)).toBeNull()
  })
  it('puts the number on a crescent, not in the hole beside it', () => {
    const { width, height, labels } = image(5, 10)
    // Bite a disc out of it: the centroid of what is left falls in the bite.
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if ((x - 24) ** 2 + (y - 20) ** 2 <= 49 && labels[y * width + x] === 5)
          labels[y * width + x] = 1
    const outline = structureOutline(labels, width, height, 5)!
    expect(labels[outline.anchor[1] * width + outline.anchor[0]]).toBe(5)
  })
})

describe('arterial pulsation', () => {
  it('names arteries only', () => {
    for (const key of ARTERY_KEYS) expect(key).toMatch(/aorta|artery|trunk/)
    for (const vein of ['superior_vena_cava', 'azygous', 'left_brachiocephalic_vein', 'left_atrium'])
      expect(ARTERY_KEYS).not.toContain(vein)
  })
  it('is a beat: at rest at its start, widest early, back to rest by its end, and it repeats', () => {
    expect(pulseScale(0)).toBe(1)
    expect(pulseScale(PULSE_PERIOD_MS * 0.15)).toBeCloseTo(1 + PULSE_AMPLITUDE, 6)
    expect(pulseScale(PULSE_PERIOD_MS * 0.999)).toBeLessThan(1 + PULSE_AMPLITUDE * 0.01)
    let previous = pulseScale(PULSE_PERIOD_MS * 0.15)
    for (let phase = 0.2; phase < 1; phase += 0.05) {
      const now = pulseScale(PULSE_PERIOD_MS * phase)
      expect(now).toBeLessThan(previous)
      expect(now).toBeGreaterThanOrEqual(1)
      previous = now
    }
    expect(pulseScale(PULSE_PERIOD_MS * 3.4)).toBeCloseTo(pulseScale(PULSE_PERIOD_MS * 0.4), 9)
  })
  it('moves the lumen and a feathered margin of tissue, and nothing outside the sector', () => {
    const { width, height, labels } = image(3)
    const region = pulseRegion(labels, width, height, 3)!
    expect(region.centre[0]).toBeCloseTo(20, 0)
    expect(region.centre[1]).toBeCloseTo(20, 0)
    for (let k = 0; k < region.indices.length; k++) {
      const label = labels[region.indices[k]]
      expect(label === 3 || label === 1).toBe(true)
      expect(region.weights[k]).toBeGreaterThan(0)
      if (label === 3) expect(region.weights[k]).toBe(1)
      else expect(region.weights[k]).toBeLessThan(1)
    }
    // Too little of a vessel in view is left still.
    expect(pulseRegion(image(3, 3).labels, width, height, 3)).toBeNull()
  })
  it('widens the echo-free lumen at the peak of the beat and leaves it as rendered at rest', () => {
    const { width, height, labels, rgba } = image(3)
    const region = pulseRegion(labels, width, height, 3)!
    /** Total brightness seen over the region: the overlay where opaque, else the frame beneath. */
    const seen = (scale: number) => {
      const out = new Uint8ClampedArray(rgba.length)
      drawPulse(rgba, labels, width, height, region, scale, out)
      let total = 0
      for (let k = 0; k < region.indices.length; k++) {
        const o = region.indices[k] * 4
        const alpha = out[o + 3] / 255
        total += out[o] * alpha + rgba[o] * (1 - alpha)
      }
      return total
    }
    let asRendered = 0
    for (const i of region.indices) asRendered += rgba[i * 4]
    // At rest it shows the frame as rendered; at the peak the dark lumen has spread outwards.
    expect(seen(1)).toBeCloseTo(asRendered, 3)
    expect(seen(1 + PULSE_AMPLITUDE)).toBeLessThan(asRendered * 0.98)
    // The frame itself is never written to.
    expect([...rgba.slice(0, 16)]).toEqual([...image(3).rgba.slice(0, 16)])
  })
  it('does not pull the outside of the sector into the image', () => {
    // An artery cut by the sector edge: sources beyond the edge are skipped.
    const { width, height, labels, rgba } = image(3, 8, 8, 20)
    const region = pulseRegion(labels, width, height, 3)!
    const out = new Uint8ClampedArray(rgba.length)
    drawPulse(rgba, labels, width, height, region, 0.9, out)
    for (let k = 0; k < region.indices.length; k++) {
      const i = region.indices[k]
      expect(labels[i]).not.toBe(0)
    }
  })
})
