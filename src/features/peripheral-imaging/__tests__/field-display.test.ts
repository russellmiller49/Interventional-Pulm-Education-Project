import {
  fieldDisplay,
  luminanceOf,
  MIN_DISPLAY_WINDOW,
  veilContrast,
  VEIL_FREE_AREA_FRACTION,
} from '../lib/fieldDisplay'

/*
 * The collimation section's monitor (owner's teaching, 2026-10-11): the display range is set from
 * what is inside the collimated field, and a scatter veil lifts as the irradiated area shrinks.
 * These hold the mapping itself; `model-truth.test.ts` holds the claim it makes about the CT.
 */

/** A 20 × 20 frame: dark lung on the right, a bright spine band down the left quarter. */
function frame(): { gray: Uint8Array; width: number } {
  const width = 20
  const gray = new Uint8Array(width * width)
  for (let row = 0; row < width; row++)
    for (let col = 0; col < width; col++)
      gray[row * width + col] = col < 5 ? 200 : 40 + ((row + col) % 6) * 6
  return { gray, width }
}

const OPEN = { left: 0, top: 0, size: 1 }
const LUNG_ONLY = { left: 0.3, top: 0, size: 0.7 }

describe('the display range follows the collimated field', () => {
  it('leaves the open field as the reference: a gain of one', () => {
    const { gray, width } = frame()
    expect(fieldDisplay(gray, width, OPEN, 1).gain).toBeCloseTo(1, 6)
  })

  it('spends the range on the lung once the bright band is outside the field', () => {
    const { gray, width } = frame()
    const open = fieldDisplay(gray, width, OPEN, 1)
    const lung = fieldDisplay(gray, width, LUNG_ONLY, 0.49)
    // The open field's white point is up at the spine; the collimated field's is in the lung.
    expect(open.window[1]).toBeGreaterThan(0.7)
    expect(lung.window[1]).toBeLessThan(0.35)
    expect(lung.gain).toBeGreaterThan(2)
    // Two lung values a few grey levels apart are displayed further apart.
    const shown = (display: typeof open, value: number) =>
      display.table[Math.round((value / 255) * (display.table.length - 1))]
    expect(shown(lung, 70) - shown(lung, 40)).toBeGreaterThan(shown(open, 70) - shown(open, 40))
  })

  it('never narrows the range past its floor, however uniform the field', () => {
    const flat = new Uint8Array(400).fill(90)
    const display = fieldDisplay(flat, 20, OPEN, 1)
    expect(display.window[1] - display.window[0]).toBeCloseTo(MIN_DISPLAY_WINDOW, 6)
  })

  it('is a monotonic table from dark to bright, inside the display range', () => {
    const { gray, width } = frame()
    for (const [field, area] of [
      [OPEN, 1],
      [LUNG_ONLY, 0.49],
    ] as const) {
      const { table } = fieldDisplay(gray, width, field, area)
      expect(table.length).toBeGreaterThan(8)
      for (let i = 1; i < table.length; i++) expect(table[i]).toBeGreaterThanOrEqual(table[i - 1])
      expect(Math.min(...table)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...table)).toBeLessThanOrEqual(1)
    }
  })
})

describe('the scatter veil lifts with the irradiated area', () => {
  it('costs the open field contrast and none at or below the veil-free area', () => {
    expect(veilContrast(1)).toBeLessThan(0.75)
    expect(veilContrast(VEIL_FREE_AREA_FRACTION)).toBe(1)
    expect(veilContrast(0.09)).toBe(1)
  })

  it('falls steadily as the field opens', () => {
    const areas = [0.2, 0.36, 0.64, 1]
    const kept = areas.map(veilContrast)
    for (let i = 1; i < kept.length; i++) expect(kept[i]).toBeLessThan(kept[i - 1])
  })

  it('keeps the veiled image off pure black and pure white', () => {
    const { gray, width } = frame()
    const { table } = fieldDisplay(gray, width, OPEN, 1)
    expect(table[0]).toBeGreaterThan(0.1)
    expect(table.at(-1)!).toBeLessThan(0.9)
  })
})

it('reads luminance from the red channel of RGBA pixels', () => {
  expect([...luminanceOf([10, 0, 0, 255, 200, 0, 0, 255])]).toEqual([10, 200])
})
