/**
 * @jest-environment node
 */
import { leverPadPoint, thumbKnuckle } from '../components/scope/ControlHeadHand'

type Point = readonly [number, number, number]
const PIVOT: Point = [-7, 29, 18]
const BASE: Point = [-33, 5, 9]
const flat = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])
const rad = (deg: number) => (deg * Math.PI) / 180

describe('the left hand on the control head', () => {
  it('puts the thumb pad out along the lever, lower when the lever is pushed toward U', () => {
    const rest = leverPadPoint(PIVOT, 0)
    expect(rest[0]).toBeCloseTo(-30)
    expect(rest[1]).toBeCloseTo(29)
    // A positive bend is the lever toward U, which is down on the control head.
    expect(leverPadPoint(PIVOT, rad(52))[1]).toBeLessThan(rest[1])
    expect(leverPadPoint(PIVOT, rad(-52))[1]).toBeGreaterThan(rest[1])
    // The pad stays the same distance from the pivot through the lever's travel.
    for (const bend of [-52, -20, 0, 30, 52])
      expect(flat(leverPadPoint(PIVOT, rad(bend)), PIVOT)).toBeCloseTo(23)
  })

  it('keeps both thumb bones their own length across the lever’s whole travel', () => {
    for (const bend of [-52, -26, 0, 26, 52]) {
      const pad = leverPadPoint(PIVOT, rad(bend))
      const knuckle = thumbKnuckle(BASE, pad, 23, 21)
      expect(flat(BASE, knuckle)).toBeCloseTo(23, 1)
      expect(flat(knuckle, pad)).toBeCloseTo(21, 1)
      // The knuckle bends away from the fingers: on this left hand, to the viewer's left.
      expect(knuckle[0]).toBeLessThanOrEqual(Math.max(BASE[0], pad[0]))
    }
  })

  it('still gives a thumb when the pad is nearer or further than the bones can reach', () => {
    for (const pad of [
      [-33, 6, 20],
      [40, 90, 20],
    ] as const) {
      const knuckle = thumbKnuckle(BASE, pad, 23, 21)
      expect(knuckle.every(Number.isFinite)).toBe(true)
      expect(flat(BASE, knuckle)).toBeCloseTo(23, 1)
    }
  })
})
