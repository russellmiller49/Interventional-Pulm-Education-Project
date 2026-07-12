import type { Vector3 } from 'three'

import { architectureRegistry } from '../content/architectureRegistry'
import {
  buildScaffoldPaths,
  getSiliconeYStentTopology,
  PARTIAL_COVER_LENGTH_FRACTION,
  SINGLE_WIRE_COURSE_COUNT,
  STENT_LENGTH,
  STENT_RADIUS,
  WIRE_RADIUS,
} from '../engine/learningLabGeometry'

const TAU = Math.PI * 2

function minimumPointDistance(first: Vector3[], second: Vector3[]) {
  let minimum = Number.POSITIVE_INFINITY
  for (const firstPoint of first) {
    for (const secondPoint of second) {
      minimum = Math.min(minimum, firstPoint.distanceTo(secondPoint))
    }
  }
  return minimum
}

function pathSignature(builder: (typeof architectureRegistry)[number]['geometryBuilder']) {
  return buildScaffoldPaths(builder)
    .map((path) => {
      const first = path.points[0]
      const last = path.points[path.points.length - 1]
      return [
        path.role,
        path.closed,
        path.points.length,
        first
          ?.toArray()
          .map((value) => value.toFixed(3))
          .join(','),
        last
          ?.toArray()
          .map((value) => value.toFixed(3))
          .join(','),
      ].join(':')
    })
    .join('|')
}

describe('airway stent learning-lab geometry builders', () => {
  it('builds distinct, finite scaffold paths for every tubular topology', () => {
    const tubularProfiles = architectureRegistry.filter(
      (profile) => profile.geometryBuilder !== 'silicone-y',
    )
    const signatures = new Set<string>()

    for (const profile of tubularProfiles) {
      const paths = buildScaffoldPaths(profile.geometryBuilder)
      expect(paths.length).toBeGreaterThan(0)
      expect(new Set(paths.map((path) => path.id)).size).toBe(paths.length)

      for (const path of paths) {
        expect(path.points.length).toBeGreaterThanOrEqual(3)
        expect(path.radius).toBeGreaterThan(0)
        for (const point of path.points) {
          expect(point.toArray().every(Number.isFinite)).toBe(true)
        }
      }

      signatures.add(pathSignature(profile.geometryBuilder))
    }

    expect(signatures.size).toBe(tubularProfiles.length)
  })

  it('keeps the knitted scaffold on one continuous wire with exposed loop courses', () => {
    const paths = buildScaffoldPaths('single-wire-knitted-loops')
    expect(paths).toHaveLength(1)
    const knit = paths[0]
    expect(knit).toEqual(
      expect.objectContaining({
        closed: false,
        id: 'single-continuous-knitted-wire',
        role: 'single-wire',
      }),
    )

    expect(SINGLE_WIRE_COURSE_COUNT).toBeGreaterThanOrEqual(7)
    expect(PARTIAL_COVER_LENGTH_FRACTION).toBeGreaterThan(0)
    expect(PARTIAL_COVER_LENGTH_FRACTION).toBeLessThanOrEqual(0.65)
    expect(SINGLE_WIRE_COURSE_COUNT * (1 - PARTIAL_COVER_LENGTH_FRACTION)).toBeGreaterThan(3)

    const segmentLengths = knit.points
      .slice(1)
      .map((point, index) => point.distanceTo(knit.points[index]))
    expect(Math.max(...segmentLengths)).toBeLessThan(STENT_RADIUS * 0.2)

    const angles = knit.points.map((point) => Math.atan2(point.z, point.x))
    const angularTravel = angles.slice(1).reduce((total, angle, index) => {
      let delta = angle - angles[index]
      while (delta > Math.PI) delta -= TAU
      while (delta < -Math.PI) delta += TAU
      return total + Math.abs(delta)
    }, 0)
    expect(angularTravel).toBeGreaterThan(SINGLE_WIRE_COURSE_COUNT * TAU * 0.85)

    const coverHalfLength = (STENT_LENGTH * PARTIAL_COVER_LENGTH_FRACTION) / 2
    const exposedEnds = [
      knit.points.filter((point) => point.y < -coverHalfLength),
      knit.points.filter((point) => point.y > coverHalfLength),
    ]

    for (const exposed of exposedEnds) {
      expect(exposed.length).toBeGreaterThan(0)
      const axialCoordinates = exposed.map((point) => point.y)
      expect(Math.max(...axialCoordinates) - Math.min(...axialCoordinates)).toBeGreaterThan(
        (STENT_LENGTH * (1 - PARTIAL_COVER_LENGTH_FRACTION)) / 3,
      )

      const angularSectors = new Set(
        exposed.map((point) => {
          const normalizedAngle = (Math.atan2(point.z, point.x) + TAU) % TAU
          return Math.floor(normalizedAngle / (TAU / 8))
        }),
      )
      expect(angularSectors.size).toBeGreaterThanOrEqual(6)

      const radii = exposed.map((point) => Math.hypot(point.x, point.z))
      expect(Math.min(...radii)).toBeLessThan(STENT_RADIUS)
      expect(Math.max(...radii)).toBeGreaterThan(STENT_RADIUS)
    }
  })

  it('builds open eye hooks at the captured crossings while retaining both wire families', () => {
    const captured = buildScaffoldPaths('hook-cross-captured-helices')
    const captures = captured.filter((path) => path.role === 'capture')
    const wireA = captured.filter((path) => path.role === 'wire-a')
    const wireB = captured.filter((path) => path.role === 'wire-b')
    const wireAPoints = wireA.flatMap((path) => path.points)
    const wireBPoints = wireB.flatMap((path) => path.points)

    expect(wireA.length).toBeGreaterThan(0)
    expect(wireB.length).toBeGreaterThan(0)
    for (const path of [...wireA, ...wireB]) {
      expect(path.closed).toBe(false)
      const axialCoordinates = path.points.map((point) => point.y)
      expect(Math.max(...axialCoordinates) - Math.min(...axialCoordinates)).toBeGreaterThan(
        STENT_LENGTH * 0.9,
      )
    }

    expect(captures.length).toBeGreaterThanOrEqual(8)
    for (const capture of captures) {
      expect(capture.closed).toBe(false)
      expect(capture.id).toMatch(/^hook-capture-/)
      expect(capture.points.length).toBeGreaterThanOrEqual(20)

      const endpointDistance = capture.points[0].distanceTo(capture.points.at(-1)!)
      const pathLength = capture.points
        .slice(1)
        .reduce((total, point, index) => total + point.distanceTo(capture.points[index]), 0)
      expect(endpointDistance).toBeGreaterThan(WIRE_RADIUS * 5)
      expect(pathLength).toBeGreaterThan(endpointDistance * 2)
      expect(minimumPointDistance(capture.points, wireAPoints)).toBeLessThan(WIRE_RADIUS * 2)
      expect(minimumPointDistance(capture.points, wireBPoints)).toBeLessThan(WIRE_RADIUS * 2)
    }
  })

  it('includes laser connectors and a joined three-limb Y topology', () => {
    const laser = buildScaffoldPaths('laser-cut-rings')
    const y = getSiliconeYStentTopology()

    expect(laser.filter((path) => path.role === 'connector').length).toBeGreaterThan(0)
    expect(buildScaffoldPaths('silicone-y')).toEqual([])
    expect(y.limbs.map((limb) => limb.id).sort()).toEqual(['left', 'right', 'tracheal'])
    expect(y.limbs.every((limb) => limb.start.equals(y.junction))).toBe(true)
    expect(y.limbs.every((limb) => limb.end.toArray().every(Number.isFinite))).toBe(true)
    expect(y.limbs.find((limb) => limb.id === 'left')?.end.x).toBeLessThan(0)
    expect(y.limbs.find((limb) => limb.id === 'right')?.end.x).toBeGreaterThan(0)
  })
})
