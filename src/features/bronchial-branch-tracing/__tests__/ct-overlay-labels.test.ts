import { placeOverlayLabels } from '../components/ctOverlayLabels'
import { CT_TRACES } from '../geometry/native-ct'
import { orientedPixel, STANDARD_ORIENTATION, turnCt } from '../geometry/orientation'

const FONT = 3.4
const width = (text: string) => text.length * FONT * 0.62
const box = (label: ReturnType<typeof placeOverlayLabels>[number]) => ({
  left: label.textAnchor === 'end' ? label.x - width(label.text) : label.x,
  right: label.textAnchor === 'end' ? label.x : label.x + width(label.text),
  top: label.y - FONT,
  bottom: label.y,
})
const overlapping = (labels: ReturnType<typeof placeOverlayLabels>) => {
  const pairs: string[][] = []
  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++) {
      const a = box(labels[i])
      const b = box(labels[j])
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
        pairs.push([labels[i].text, labels[j].text])
    }
  return pairs
}

// The reported collision: "A · RMSB" and "B · LMSB" printed over each other at the
// first division, where the two locators are a few millimetres apart.
const crowded = [
  { id: 'model-0', point: [52.1, 49.4] as [number, number], text: 'A · RMSB' },
  { id: 'model-1', point: [47.6, 50.2] as [number, number], text: 'B · LMSB' },
  { id: 'mark-0', point: [53.4, 50.8] as [number, number], text: 'Your mark A' },
  { id: 'mark-1', point: [46.2, 51.6] as [number, number], text: 'Your mark B' },
]

test('the previous fixed-offset rule collides where the placement pass does not', () => {
  // What the viewer drew before: every label pinned four units from its own anchor.
  const fixed = crowded.map((anchor) => ({
    ...anchor,
    x: anchor.point[0] + (anchor.point[0] > 60 ? -4 : 4),
    y: anchor.point[1],
    textAnchor: (anchor.point[0] > 60 ? 'end' : 'start') as 'start' | 'end',
    leader: [0, 0] as [number, number],
  }))
  expect(overlapping(fixed).length).toBeGreaterThan(0)
  expect(overlapping(placeOverlayLabels(crowded, { fontSize: FONT }))).toEqual([])
})

test('placement moves only the text: anchors, identities and order are unchanged', () => {
  const placed = placeOverlayLabels(crowded, { fontSize: FONT })
  expect(placed.map((label) => label.id)).toEqual(crowded.map((anchor) => anchor.id))
  for (const [i, label] of placed.entries()) {
    expect(label.point).toEqual(crowded[i].point)
    expect(label.text).toBe(crowded[i].text)
    // The leader reaches the text it belongs to, so the pairing stays explicit.
    expect(Math.abs(label.leader[1] - label.y)).toBeLessThan(FONT)
    expect(Math.abs(label.leader[0] - label.x)).toBeLessThanOrEqual(1.2001)
  }
})

test('labels stay inside the image on every display of every authored checkpoint', () => {
  for (const trace of CT_TRACES) {
    for (const reflected of [false, true])
      for (const turns of [0, 1, 2, 3] as const) {
        const orientation = { turns, reflected }
        const anchors = trace.checkpoints.map((point, i) => ({
          id: `reference-${i}`,
          point: orientedPixel(point.pixel, trace.cropCenter, trace.cropSize, orientation),
          text: point.airway.code,
        }))
        for (const label of placeOverlayLabels(anchors, { fontSize: FONT })) {
          expect(label.y).toBeGreaterThanOrEqual(FONT)
          expect(label.y).toBeLessThanOrEqual(96.001)
          expect(label.x).toBeGreaterThanOrEqual(3.999)
          expect(label.x).toBeLessThanOrEqual(96.001)
        }
      }
  }
  // Rotating the display rotates the anchors and nothing else.
  const trace = CT_TRACES[0]
  const point = trace.checkpoints[0].pixel
  const upright = orientedPixel(point, trace.cropCenter, trace.cropSize, STANDARD_ORIENTATION)
  const turned = orientedPixel(
    point,
    trace.cropCenter,
    trace.cropSize,
    turnCt(STANDARD_ORIENTATION, 'right'),
  )
  expect(turned[0]).toBeCloseTo(100 - upright[1], 10)
  expect(turned[1]).toBeCloseTo(upright[0], 10)
})

test('an empty set places nothing and a single label keeps its own row', () => {
  expect(placeOverlayLabels([])).toEqual([])
  const [only] = placeOverlayLabels([{ id: 'a', point: [20, 30], text: 'RB5b' }], {
    fontSize: FONT,
  })
  expect(only.textAnchor).toBe('start')
  expect(only.y).toBeCloseTo(30 + FONT * 0.35, 6)
})
