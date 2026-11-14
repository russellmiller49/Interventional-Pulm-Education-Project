import { routeOption } from '../engine/nav-session'
import {
  MIN_ASTRAY_MM,
  astrayIn,
  astrayOut,
  astrayPath,
  astrayPose,
  astrayStop,
  edgeRadiusMm,
  nextBranches,
  tipSlice,
} from '../geometry/astray'
import { dot } from '../geometry/coordinates'
import { CT_TRACES } from '../geometry/native-ct'
import { edgePoints } from '../geometry/paired-scope'
import { STATION_BACK_MM, drivePose, driveFrom, stationCamera } from '../geometry/route-stations'

/**
 * A turn into the daughter the route does not take, one generation deep, and back out. Every fork
 * of every route, every daughter but the route's own.
 */
const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const TURNS = CT_TRACES.flatMap((trace) =>
  trace.checkpoints.flatMap((checkpoint, ci) =>
    (checkpoint.decision?.options ?? []).flatMap((option, oi) =>
      oi === routeOption(trace, ci) ? [] : [{ trace, ci, oi, option, id: checkpoint.id }],
    ),
  ),
)

/** Distance from a point to a polyline. */
function toLine(point: readonly number[], line: readonly (readonly number[])[]) {
  let best = Infinity
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1],
      b = line[i]
    const ab = [0, 1, 2].map((k) => b[k] - a[k])
    const length2 = ab.reduce((s, v) => s + v * v, 0) || 1e-9
    const f = Math.max(
      0,
      Math.min(1, [0, 1, 2].reduce((s, k) => s + (point[k] - a[k]) * ab[k], 0) / length2),
    )
    best = Math.min(
      best,
      distance(
        point,
        [0, 1, 2].map((k) => a[k] + ab[k] * f),
      ),
    )
  }
  return best
}

describe('turning into the other daughter', () => {
  it('has a path for every daughter a route does not take, and none for its own', () => {
    expect(TURNS.length).toBeGreaterThan(100)
    for (const { trace, ci, oi } of TURNS) expect(astrayPath(trace, ci, oi)).not.toBeNull()
    for (const trace of CT_TRACES)
      trace.checkpoints.forEach((checkpoint, ci) => {
        if (checkpoint.decision) expect(astrayPath(trace, ci, routeOption(trace, ci))).toBeNull()
      })
  })

  it('stops inside that daughter, past the fork and short of its next division', () => {
    for (const { trace, ci, oi, option } of TURNS) {
      const stop = astrayStop(trace, ci, oi)!
      const daughter = edgePoints(option.sourceEdgeId)!
      expect(toLine(stop.position, daughter)).toBeLessThan(1e-6)
      expect(stop.intoMm).toBeGreaterThan(0)
      expect(stop.intoMm).toBeLessThanOrEqual(stop.lengthMm)
      if (stop.lengthMm >= MIN_ASTRAY_MM + STATION_BACK_MM) {
        expect(stop.intoMm).toBeCloseTo(stop.lengthMm - STATION_BACK_MM, 6)
      } else
        expect(stop.intoMm).toBeGreaterThanOrEqual(
          Math.min(MIN_ASTRAY_MM, stop.lengthMm / 2) - 1e-9,
        )
    }
  })

  it('looks on into the daughter, not back up the parent', () => {
    for (const { trace, ci, oi, option } of TURNS) {
      const stop = astrayStop(trace, ci, oi)!
      const daughter = edgePoints(option.sourceEdgeId)!
      const along = [0, 1, 2].map((k) => daughter[daughter.length - 1][k] - daughter[0][k])
      const length = Math.hypot(...along)
      expect(
        dot(stop.direction, along.map((v) => v / length) as [number, number, number]),
      ).toBeGreaterThan(0)
    }
  })

  it('knows the next division of every daughter that divides, from the source graph', () => {
    let divides = 0,
      ends = 0
    for (const { trace, ci, oi, option } of TURNS) {
      const next = nextBranches(option.sourceEdgeId)
      const path = astrayPath(trace, ci, oi)!
      expect(path.ends).toBe(next.length === 0)
      if (next.length) {
        divides++
        const daughter = edgePoints(option.sourceEdgeId)!
        for (const branch of next)
          expect(distance(branch.points[0], daughter[daughter.length - 1])).toBeLessThan(1e-6)
      } else ends++
      expect(edgeRadiusMm(option.sourceEdgeId)).toBeGreaterThan(0)
    }
    expect(divides).toBeGreaterThan(ends)
  })
})

describe('the drive in and the back-out', () => {
  it('leaves from the fork’s station and stops where the turn stops', () => {
    for (const { trace, ci, oi } of TURNS) {
      const drive = astrayIn(trace, ci, oi)!
      const station = stationCamera(trace, ci)!
      const start = astrayPose(trace, drive, 0)
      const end = astrayPose(trace, drive, 1)
      expect(distance(start.position, station.position)).toBeLessThan(1e-6)
      expect(distance(start.direction, station.direction)).toBeLessThan(1e-6)
      expect(distance(end.position, astrayStop(trace, ci, oi)!.position)).toBeLessThan(1e-6)
      expect(drive.toArc).toBeGreaterThan(drive.fromArc)
    }
  })

  it('backs out to exactly the pose the scope waited in at the fork', () => {
    for (const { trace, ci, oi } of TURNS) {
      const back = astrayOut(trace, ci, oi)!
      const station = stationCamera(trace, ci)!
      const end = astrayPose(trace, back, 1)
      expect(distance(end.position, station.position)).toBeLessThan(1e-6)
      expect(distance(end.direction, station.direction)).toBeLessThan(1e-6)
      expect(distance(end.up, station.up)).toBeLessThan(1e-6)
    }
  })

  it('leaves the route’s own drives as they were', () => {
    const trace = CT_TRACES[0]
    const drive = driveFrom(trace, 0)
    expect(
      distance(drivePose(trace, drive, 0).position, stationCamera(trace, 0)!.position),
    ).toBeLessThan(1e-6)
  })

  it('keeps the CT on a shipped slice wherever the tip goes', () => {
    for (const { trace, ci, oi } of TURNS) {
      const drive = astrayIn(trace, ci, oi)!
      for (const t of [0, 0.5, 1]) {
        const slice = tipSlice(astrayPose(trace, drive, t))
        expect(slice).toBeGreaterThanOrEqual(239)
        expect(slice).toBeLessThanOrEqual(478)
      }
    }
  })
})
