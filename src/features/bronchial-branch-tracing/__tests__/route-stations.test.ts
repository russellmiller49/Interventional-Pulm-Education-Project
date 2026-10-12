import type { CtTrace } from '../content/ct-types'
import { dot, type DisplayPreset, type Vec3 } from '../geometry/coordinates'
import { CT_TRACES, NATIVE_CT, traceById } from '../geometry/native-ct'
import { pairedPath } from '../geometry/paired-scope'
import {
  LOOKING_DOWN,
  LOOKING_UP,
  SCOPE_FOV_DEG,
  MIN_BACK_MM,
  PAST_PREVIOUS_FORK_MM,
  STATION_BACK_MM,
  arcNearest,
  arcToSlice,
  arrivalArc,
  arrivalPose,
  driveFrom,
  drivePose,
  forkArc,
  lookKind,
  poseAt,
  routeLength,
  sampleRoute,
  scopeUp,
  stationCamera,
} from '../geometry/route-stations'

/**
 * Where the scope waits and how it travels: one arc-length polyline per route, a station short of
 * every fork, a drive between stations. Everything is patient space; nothing reads a CT display.
 */
const PRESETS: DisplayPreset[] = ['standard', 'mirror', 'rul', 'upper-division']
const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const forksOf = (trace: CtTrace) =>
  trace.checkpoints.flatMap((checkpoint, index) => (checkpoint.decision ? [index] : []))
function expectClose(a: readonly number[], b: readonly number[], tolerance = 1e-6) {
  expect(a).toHaveLength(b.length)
  a.forEach((value, i) => expect(Math.abs(value - b[i])).toBeLessThanOrEqual(tolerance))
}

describe('the route as one polyline', () => {
  test('every route starts at the top of the trachea and its arc lengths only grow', () => {
    for (const trace of CT_TRACES) {
      const { points, arcs, segmentEdges } = pairedPath(trace)
      expect(points.length).toBe(arcs.length)
      expect(points.length).toBe(segmentEdges.length)
      expect(arcs[0]).toBe(0)
      for (let i = 1; i < arcs.length; i++) {
        expect(arcs[i]).toBeGreaterThan(arcs[i - 1])
        expect(arcs[i] - arcs[i - 1]).toBeCloseTo(distance(points[i], points[i - 1]), 9)
      }
      // The edges are travelled in the route's own order, each at least once.
      expect([...new Set(segmentEdges)]).toEqual(trace.sourceEdgeIds)
      expect(segmentEdges[0]).toBe(0)
      expect(pairedPath(trace)).toBe(pairedPath(trace))
      expect(routeLength(trace)).toBe(arcs[arcs.length - 1])
      // Every route shares the trachea: the same first point, the highest on the route.
      expect(points[0]).toEqual(pairedPath(CT_TRACES[0]).points[0])
      expect(points[0][2]).toBe(Math.max(...points.map((p) => p[2])))
    }
  })

  test('sampleRoute walks the polyline and clamps at both ends; arcNearest is its inverse', () => {
    for (const trace of CT_TRACES) {
      const { points, arcs } = pairedPath(trace)
      const length = routeLength(trace)
      expectClose(sampleRoute(trace, 0), points[0], 1e-12)
      expectClose(sampleRoute(trace, length), points[points.length - 1], 1e-9)
      expect(sampleRoute(trace, -25)).toEqual(sampleRoute(trace, 0))
      expect(sampleRoute(trace, length + 25)).toEqual(sampleRoute(trace, length))
      // A vertex is returned at its own arc length, and a midpoint lies between its neighbours.
      const k = Math.floor(points.length / 2)
      expectClose(sampleRoute(trace, arcs[k]), points[k], 1e-9)
      const mid = sampleRoute(trace, (arcs[k] + arcs[k + 1]) / 2)
      expect(distance(mid, points[k]) + distance(mid, points[k + 1])).toBeCloseTo(
        arcs[k + 1] - arcs[k],
        9,
      )
      for (let arc = 0; arc <= length; arc += 5)
        expect(Math.abs(arcNearest(trace, sampleRoute(trace, arc)) - arc)).toBeLessThan(1e-6)
    }
  })

  test('the slice at an arc length stays inside the route’s own slice range', () => {
    for (const trace of CT_TRACES) {
      const length = routeLength(trace)
      for (const arc of [
        ...Array.from({ length: Math.floor(length / 5) + 1 }, (_, i) => i * 5),
        length,
        -10,
        length + 10,
      ]) {
        const slice = arcToSlice(trace, arc)
        expect(Number.isInteger(slice)).toBe(true)
        expect([trace.id, arc, slice >= trace.range[0] && slice <= trace.range[1]]).toEqual([
          trace.id,
          arc,
          true,
        ])
      }
      // Inside the range it is the slice of the route point itself.
      const arc = forkArc(trace, forksOf(trace).at(-1)!)!
      const z = sampleRoute(trace, arc)[2]
      expect(arcToSlice(trace, arc)).toBe(
        Math.round((z - NATIVE_CT.origin[2]) / NATIVE_CT.spacing[2]),
      )
    }
  })

  test('each fork lies on the route, farther along than the fork before it', () => {
    for (const trace of CT_TRACES) {
      let previous = -Infinity
      for (const index of forksOf(trace)) {
        const arc = forkArc(trace, index)!
        expect([trace.id, index, arc > previous]).toEqual([trace.id, index, true])
        expectClose(sampleRoute(trace, arc), trace.checkpoints[index].decision!.junctionLps, 1e-3)
        previous = arc
      }
      expect(previous).toBeLessThan(routeLength(trace))
      // The last checkpoint is the approach to the lesion, not a division.
      expect(forkArc(trace, trace.checkpoints.length - 1)).toBeNull()
      expect(forkArc(trace, 99)).toBeNull()
      expect(stationCamera(trace, trace.checkpoints.length - 1)).toBeNull()
    }
  })
})

describe('the scope’s roll', () => {
  test('look kinds: down at or below −0.3, up at or above 0.5, level between', () => {
    expect([LOOKING_DOWN, LOOKING_UP]).toEqual([-0.3, 0.5])
    expect(lookKind([0, 0, -1])).toBe('down')
    expect(lookKind([0.95, 0, -0.3])).toBe('down')
    expect(lookKind([0.95, 0, -0.29])).toBe('level')
    expect(lookKind([1, 0, 0])).toBe('level')
    expect(lookKind([0, -0.87, 0.49])).toBe('level')
    expect(lookKind([0, -0.87, 0.5])).toBe('up')
    expect(lookKind([0, 0, 1])).toBe('up')
  })

  test('looking down an airway, anterior is at the top for every region', () => {
    for (const preset of PRESETS) {
      expect(scopeUp(preset, [0, 0, -1])).toEqual([0, -1, 0])
      expect(scopeUp(preset, [0.3, 0.2, -0.93])).toEqual([0, -1, 0])
    }
  })

  test('looking along a horizontal bronchus, the head is at the top for every region', () => {
    for (const preset of PRESETS) {
      expect(scopeUp(preset, [1, 0, 0])).toEqual([0, 0, 1])
      expect(scopeUp(preset, [0, -1, 0])).toEqual([0, 0, 1])
      expect(scopeUp(preset, [-0.7, 0.7, 0.1])).toEqual([0, 0, 1])
    }
  })

  test('looking up an airway, each upper lobe has its own chest wall at the bottom', () => {
    // Patient-left at the top puts the right chest wall at the bottom, and the reverse.
    expect(scopeUp('rul', [0, 0, 1])).toEqual([1, 0, 0])
    expect(scopeUp('upper-division', [0, 0, 1])).toEqual([-1, 0, 0])
    expect(scopeUp('mirror', [0, 0, 1])).toEqual([0, -1, 0])
    expect(scopeUp('standard', [0, 0, 1])).toEqual([0, -1, 0])
  })

  test('a reference that lies along the line of sight is replaced, never returned', () => {
    // Looking steeply down and almost straight forward: anterior carries no roll.
    expect(scopeUp('mirror', [0, -0.953, -0.303])).toEqual([0, 0, 1])
    // Looking up as far sideways as an upward look goes: patient-left still carries the roll.
    expect(scopeUp('rul', [0.86, 0, 0.51])).toEqual([1, 0, 0])
    for (const { camera } of CT_TRACES.flatMap((trace) =>
      forksOf(trace).map((index) => ({ camera: stationCamera(trace, index)! })),
    ))
      expect(Math.abs(dot(camera.up, camera.direction))).toBeLessThanOrEqual(0.95)
  })
})

describe('the scope waiting at a fork', () => {
  test('it waits on the route short of the fork, looking at it, with an orthonormal basis', () => {
    expect(STATION_BACK_MM).toBe(8)
    expect(SCOPE_FOV_DEG).toBe(100)
    let stations = 0
    for (const trace of CT_TRACES) {
      let previousCamera = -Infinity
      let previousFork: number | null = null
      for (const index of forksOf(trace)) {
        stations++
        const where = `${trace.id} ${trace.checkpoints[index].id}`
        const camera = stationCamera(trace, index)!
        const fork = forkArc(trace, index)!
        expect(camera.forkArc).toBe(fork)
        expect([where, camera.arc < fork]).toEqual([where, true])
        expect([where, camera.backMm >= MIN_BACK_MM && camera.backMm <= 20]).toEqual([where, true])
        expect(camera.arc).toBeCloseTo(fork - camera.backMm, 9)
        expect(camera.position).toEqual(sampleRoute(trace, camera.arc))
        expect(Math.hypot(...camera.direction)).toBeCloseTo(1, 12)
        expect(camera.up).toEqual(scopeUp(trace.preset, camera.direction))
        // The fork is in front of the scope, not beside or behind it.
        const toFork = trace.checkpoints[index].decision!.junctionLps.map(
          (v, axis) => v - camera.position[axis],
        )
        expect([where, dot(toFork as Vec3, camera.direction) > 0]).toEqual([where, true])
        const { forward, right, up } = camera.basis
        expectClose(forward, camera.direction, 1e-12)
        for (const axis of [forward, right, up]) expect(Math.hypot(...axis)).toBeCloseTo(1, 12)
        expect(dot(forward, right)).toBeCloseTo(0, 12)
        expect(dot(forward, up)).toBeCloseTo(0, 12)
        expect(dot(right, up)).toBeCloseTo(0, 12)
        expect(dot(up, camera.up)).toBeGreaterThan(0)
        // Each station is farther along the route than the one before.
        expect([where, camera.arc > previousCamera]).toEqual([where, true])
        // The scope stays inside the parent airway: it never waits as far back as the fork
        // before, and it waits nearer than the usual distance only where that fork is close.
        if (previousFork !== null) {
          expect([where, camera.arc > previousFork]).toEqual([where, true])
          if (camera.backMm < STATION_BACK_MM)
            expect([where, fork - previousFork < STATION_BACK_MM + PAST_PREVIOUS_FORK_MM]).toEqual([
              where,
              true,
            ])
        }
        previousCamera = camera.arc
        previousFork = fork
        // Cached: the same object each time.
        expect(stationCamera(trace, index)).toBe(camera)
      }
    }
    expect(stations).toBe(128)
  })

  test('at the tracheal fork the scope looks down the trachea with anterior at the top', () => {
    for (const trace of CT_TRACES) {
      const camera = stationCamera(trace, 0)!
      expect(lookKind(camera.direction)).toBe('down')
      expect(camera.direction[2]).toBeLessThan(-0.9)
      expect(camera.up).toEqual([0, -1, 0])
      expect(camera.backMm).toBe(STATION_BACK_MM)
      // The same fork is the same station on every route.
      expect(camera.position).toEqual(stationCamera(CT_TRACES[0], 0)!.position)
      expect(camera.direction).toEqual(stationCamera(CT_TRACES[0], 0)!.direction)
    }
  })
})

describe('travelling', () => {
  test('poseAt looks ahead along the route, and along its last stretch at the very end', () => {
    for (const trace of CT_TRACES) {
      const length = routeLength(trace)
      for (const arc of [0, 40, length / 2, length - 12]) {
        const pose = poseAt(trace, arc)
        expect(pose.arc).toBe(arc)
        expect(pose.position).toEqual(sampleRoute(trace, arc))
        expect(Math.hypot(...pose.direction)).toBeCloseTo(1, 12)
        expect(pose.up).toEqual(scopeUp(trace.preset, pose.direction))
        // It looks at the route point a station's distance farther on.
        const ahead = sampleRoute(trace, arc + STATION_BACK_MM)
        const toAhead = ahead.map((v, axis) => v - pose.position[axis]) as Vec3
        expect(dot(toAhead, pose.direction)).toBeCloseTo(Math.hypot(...toAhead), 9)
      }
      // Clamped to the route; at its end there is nothing ahead, so it looks along the last stretch.
      const end = poseAt(trace, length + 30)
      expect(end.arc).toBe(length)
      expect(end.position).toEqual(sampleRoute(trace, length))
      expect(Math.hypot(...end.direction)).toBeCloseTo(1, 12)
      const back = sampleRoute(trace, length - STATION_BACK_MM)
      const along = end.position.map((v, axis) => v - back[axis]) as Vec3
      expect(dot(along, end.direction)).toBeCloseTo(Math.hypot(...along), 9)
      expect(poseAt(trace, -5).arc).toBe(0)
    }
    // The look-ahead distance can be given.
    const trace = traceById('central-right')
    const near = poseAt(trace, 50, 2)
    const two = sampleRoute(trace, 52).map((v, axis) => v - near.position[axis]) as Vec3
    expect(dot(two, near.direction)).toBeCloseTo(Math.hypot(...two), 9)
  })

  test('a route ends beside its last checkpoint, past its last fork and short of the model’s end', () => {
    for (const trace of CT_TRACES) {
      const arrival = arrivalArc(trace)
      const lastFork = forksOf(trace).at(-1)!
      expect(arrival).toBeLessThanOrEqual(routeLength(trace) - 1)
      expect(arrival).toBeGreaterThan(forkArc(trace, lastFork)!)
      expect(arrival).toBeGreaterThan(stationCamera(trace, lastFork)!.arc)
      const pose = arrivalPose(trace)
      expect(pose).toEqual(poseAt(trace, arrival))
      expect(pose.arc).toBe(arrival)
      // Within a slice or two of the approach checkpoint the export gives the route.
      const approach = trace.checkpoints.at(-1)!
      expect(approach.decision).toBeUndefined()
      expect(distance(pose.position, approach.lps)).toBeLessThan(10.5)
    }
  })

  test('every drive runs forward: to the next station, or from the last fork to the end of the route', () => {
    for (const trace of CT_TRACES) {
      const forks = forksOf(trace)
      forks.forEach((index, n) => {
        const drive = driveFrom(trace, index)
        const here = stationCamera(trace, index)!
        expect(drive.from).toBe(here)
        expect(drive.fromArc).toBe(here.arc)
        expect(drive.toArc).toBeGreaterThan(drive.fromArc)
        if (n < forks.length - 1) {
          expect(forks[n + 1]).toBe(index + 1)
          expect(drive.to).toBe(stationCamera(trace, index + 1))
          expect(drive.toArc).toBe(stationCamera(trace, index + 1)!.arc)
        } else {
          expect(drive.to).toBeNull()
          expect(drive.toArc).toBe(arrivalArc(trace))
        }
      })
    }
  })

  test.each(['central-right', 'right-upper-apical', 'left-lower-returning', 'left-upper-division'])(
    '%s: a drive leaves from the departure station’s pose and settles onto the arrival’s',
    (traceId) => {
      const trace = traceById(traceId)
      const forks = forksOf(trace)
      expect(forks.length).toBeGreaterThan(5)
      for (const index of forks) {
        const drive = driveFrom(trace, index)
        const start = drivePose(trace, drive, 0)
        expect(start.arc).toBe(drive.fromArc)
        expectClose(start.position, drive.from.position)
        expectClose(start.direction, drive.from.direction)
        expectClose(start.up, drive.from.up)
        const end = drivePose(trace, drive, 1)
        const arrival = drive.to ?? poseAt(trace, drive.toArc)
        expect(end.arc).toBe(drive.toArc)
        expectClose(end.position, arrival.position)
        expectClose(end.direction, arrival.direction)
        expectClose(end.up, arrival.up)
        // Progress is clamped: before the start and after the end the scope is at rest.
        expect(drivePose(trace, drive, -0.5)).toEqual(start)
        expect(drivePose(trace, drive, 1.5)).toEqual(end)
        // Part-way it is on the route at the interpolated arc, looking somewhere definite.
        let previousArc = drive.fromArc
        for (const progress of [0.1, 0.25, 0.5, 0.75, 0.9]) {
          const pose = drivePose(trace, drive, progress)
          const arc = drive.fromArc + (drive.toArc - drive.fromArc) * progress
          expect(pose.arc).toBeCloseTo(arc, 9)
          expect(pose.position).toEqual(sampleRoute(trace, arc))
          expect(Math.abs(arcNearest(trace, pose.position) - arc)).toBeLessThan(1e-6)
          expect(Math.hypot(...pose.direction)).toBeCloseTo(1, 9)
          expect(Math.hypot(...pose.up)).toBeCloseTo(1, 9)
          expect(pose.arc).toBeGreaterThan(previousArc)
          // The roll never lies along the line of sight, so the view always has a top.
          expect(Math.abs(dot(pose.up, pose.direction))).toBeLessThan(0.99)
          previousArc = pose.arc
        }
      }
    },
  )

  test('the last drive of a route ends at rest beside the lesion', () => {
    for (const trace of CT_TRACES) {
      const drive = driveFrom(trace, forksOf(trace).at(-1)!)
      expect(drive.to).toBeNull()
      const end = drivePose(trace, drive, 1)
      const rest = arrivalPose(trace)
      expect(end.arc).toBe(arrivalArc(trace))
      expectClose(end.position, rest.position)
      expectClose(end.direction, rest.direction)
      expectClose(end.up, rest.up)
    }
  })
})
