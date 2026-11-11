import { TARGET_IDS, lobeOf, targetById, traceForTarget } from '../content/targets'
import { TREE_BOX, TREE_BRANCHES, lobarRoute, routeSoFar, treePoint } from '../geometry/airway-tree'
import { CT_TRACES, traceById } from '../geometry/native-ct'
import { pairedPath } from '../geometry/paired-scope'
import { sampleRoute, stationCamera } from '../geometry/route-stations'

/** The small frontal tree in the corner of the scope pane: where the scope is, and no more. */
describe('the airway tree picture', () => {
  it('draws every airway the routes name, each from its own centreline', () => {
    expect(TREE_BRANCHES).toHaveLength(116)
    expect(new Set(TREE_BRANCHES.map((branch) => branch.id)).size).toBe(116)
    for (const branch of TREE_BRANCHES) {
      expect(branch.d.startsWith('M')).toBe(true)
      expect(branch.d).not.toMatch(/NaN|undefined/)
      expect(branch.radiusMm).toBeGreaterThan(0)
    }
    // The trachea is the widest airway in the picture.
    const widest = [...TREE_BRANCHES].sort((a, b) => b.radiusMm - a.radiusMm)[0]
    expect(traceById('central-right').sourceEdgeIds.slice(0, 2)).toContain(widest.id)
    expect(widest.radiusMm).toBeGreaterThan(5)
  })

  it('is seen from the front: the patient’s right on the left, the head at the top', () => {
    expect(treePoint([10, -3, 25])).toEqual([10, -25])
    const end = (id: string) => {
      const { points } = pairedPath(traceById(id))
      return treePoint(points[points.length - 1])
    }
    const top = treePoint(pairedPath(traceById('central-right')).points[0])
    // A right-lung route ends to the left of a left-lung route's end, and both below the top of
    // the trachea, where every route begins.
    expect(end('right-lower-basal')[0]).toBeLessThan(end('left-lower-basal')[0])
    expect(end('right-lower-basal')[1]).toBeGreaterThan(top[1])
    expect(end('left-lower-basal')[1]).toBeGreaterThan(top[1])
  })

  it('frames every point of every route, with room for the tip', () => {
    for (const trace of CT_TRACES)
      for (const point of pairedPath(trace).points) {
        const [x, y] = treePoint(point)
        expect(x).toBeGreaterThan(TREE_BOX.x)
        expect(x).toBeLessThan(TREE_BOX.x + TREE_BOX.width)
        expect(y).toBeGreaterThan(TREE_BOX.y)
        expect(y).toBeLessThan(TREE_BOX.y + TREE_BOX.height)
      }
  })

  it('shows the route only as far as the scope has come, and never the way ahead', () => {
    const trace = traceById('right-upper-apical')
    const { arcs } = pairedPath(trace)
    const total = arcs[arcs.length - 1]
    let last = -1
    for (const share of [0.1, 0.35, 0.6, 0.9]) {
      const at = sampleRoute(trace, total * share)
      const soFar = routeSoFar(trace, at)
      // The path ends at the scope, to within the route's own sampling.
      expect(Math.abs(soFar.arc - total * share)).toBeLessThan(1.5)
      expect(soFar.arc).toBeGreaterThan(last)
      last = soFar.arc
      const [x, y] = treePoint(sampleRoute(trace, soFar.arc))
      expect(soFar.d.endsWith(`L${Number(x.toFixed(1))} ${Number(y.toFixed(1))}`)).toBe(true)
      // More of the route, a longer path.
      expect(soFar.d.split('L').length).toBeGreaterThan(1)
    }
    // At the first fork the path is the trachea and nothing below it.
    const first = stationCamera(
      trace,
      trace.checkpoints.findIndex((c) => c.decision),
    )!
    const atCarina = routeSoFar(trace, first.position)
    expect(atCarina.arc).toBeLessThan(total - 20)
    expect(atCarina.d.length).toBeLessThan(routeSoFar(trace, sampleRoute(trace, total)).d.length)
  })
})

/** The lesion list's thumbnail: the way to the lobe, and nothing a lobe's name does not say. */
describe('the way to a lesion’s lobe', () => {
  const lines = TARGET_IDS.map((id) => ({
    id,
    lobe: lobeOf(targetById(id)!),
    d: lobarRoute(traceForTarget(id)),
  }))

  it('is the same line for every lesion in a lobe, so it cannot tell two of them apart', () => {
    const byLobe = new Map<string, Set<string>>()
    for (const { lobe, d } of lines) byLobe.set(lobe, (byLobe.get(lobe) ?? new Set()).add(d))
    expect([...byLobe.keys()]).toHaveLength(5)
    for (const [lobe, drawn] of byLobe) expect([lobe, drawn.size]).toEqual([lobe, 1])
    // Five lobes, five different lines.
    expect(new Set(lines.map((line) => line.d)).size).toBe(5)
  })

  it('stops well short of the lesion', () => {
    for (const { id, d } of lines) {
      const whole = routeSoFar(traceForTarget(id), targetById(id)!.centerLps).d
      expect(d.startsWith('M')).toBe(true)
      expect(d.length).toBeLessThan(whole.length * 0.9)
    }
  })
})
