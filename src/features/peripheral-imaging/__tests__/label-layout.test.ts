/** @jest-environment node */
import { labelsOverlap, placeLabels, type LabelRequest } from '../components/suite/labelLayout'

/*
 * Report 2.4 / 2.5 (fellow walkthrough, PDF p.17, p.18, p.25): component labels parked far from
 * their objects, all six stacked at one point in the beam's-eye view, and "Tool tip" printed over
 * "Authored target". The rule that places them is pure, so it is held here without a WebGL context;
 * the rendered bounds are held in the browser suite.
 */
const pin = (id: string, x: number, y: number, width = 110): LabelRequest => ({
  id,
  anchor: [x, y],
  width,
  height: 44,
  placement: 'side',
  gap: 28,
})
const objects = (x: number, y: number): LabelRequest[] => [
  { id: 'tip', anchor: [x, y], width: 46, height: 18, placement: 'above-left', gap: 8 },
  { id: 'target', anchor: [x, y], width: 86, height: 18, placement: 'below-right', gap: 8 },
]

describe('scene label layout', () => {
  it('keeps a label beside the object it names when nothing is in the way', () => {
    const requests = [pin('tube', 360, 250), pin('detector', 330, 40), pin('display', 520, 120)]
    const placed = placeLabels(requests, 760, 290)
    expect(labelsOverlap(requests, placed)).toBe(false)
    for (const label of placed) expect(label.distance).toBeLessThanOrEqual(30)
  })

  it('puts a label on its object’s own side of the figure', () => {
    const requests = [pin('left', 200, 100), pin('right', 600, 100)]
    const [left, right] = placeLabels(requests, 800, 300)
    expect(left.x).toBeLessThan(200)
    expect(right.x).toBeGreaterThan(600)
  })

  it('separates six labels whose objects share one point, as in the beam’s-eye view', () => {
    const requests = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => pin(id, 380, 145))
    const placed = placeLabels(requests, 760, 290)
    expect(labelsOverlap(requests, placed)).toBe(false)
    for (const label of placed) {
      expect(label.x - 55).toBeGreaterThanOrEqual(0)
      expect(label.x + 55).toBeLessThanOrEqual(760)
      expect(label.y - 22).toBeGreaterThanOrEqual(0)
      expect(label.y + 22).toBeLessThanOrEqual(290)
    }
  })

  it('never prints the tool-tip label over the target label, even when the two are superimposed', () => {
    for (const [x, y] of [
      [380, 145],
      [20, 20],
      [750, 280],
    ] as const) {
      const requests = objects(x, y)
      expect(labelsOverlap(requests, placeLabels(requests, 760, 290))).toBe(false)
    }
  })

  it('keeps object labels clear of the component pins around them', () => {
    const requests = [pin('patient', 380, 150), pin('beam', 380, 200), ...objects(385, 152)]
    expect(labelsOverlap(requests, placeLabels(requests, 760, 290))).toBe(false)
  })

  it('still resolves in a phone-width figure', () => {
    const requests = [
      pin('a', 150, 60, 70),
      pin('b', 150, 120, 70),
      pin('c', 150, 180, 70),
      pin('d', 160, 40, 70),
      pin('e', 250, 130, 96),
      pin('f', 260, 100, 60),
    ]
    expect(labelsOverlap(requests, placeLabels(requests, 300, 260))).toBe(false)
  })

  it('moves nothing but the labels: every anchor is returned to its caller untouched', () => {
    const requests = [pin('a', 100, 100), pin('b', 100, 100)]
    const before = JSON.stringify(requests)
    placeLabels(requests, 400, 300)
    expect(JSON.stringify(requests)).toBe(before)
  })
})
