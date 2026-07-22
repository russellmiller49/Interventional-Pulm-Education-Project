import * as THREE from 'three'

import { IMPELLA_RP_FLOW_ROUTE, type CardiacPoint3 } from '@/features/cardiac-anatomy/content/paths'

import {
  createCannulaHelixPoints,
  createImpellaBloodFlowPaths,
  smoothImpellaCannulaRoute,
} from '../components/three/impellaFlowGeometry'

function maximumTurn(points: readonly CardiacPoint3[]): number {
  let maximum = 0
  for (let index = 1; index < points.length - 1; index += 1) {
    const incoming = new THREE.Vector3(...points[index]).sub(
      new THREE.Vector3(...points[index - 1]),
    )
    const outgoing = new THREE.Vector3(...points[index + 1]).sub(
      new THREE.Vector3(...points[index]),
    )
    maximum = Math.max(maximum, incoming.angleTo(outgoing))
  }
  return maximum
}

function routeLength(points: readonly CardiacPoint3[]): number {
  return new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(...point)),
    false,
    'centripetal',
  ).getLength()
}

describe('Impella 3D flow geometry', () => {
  const route = [
    [0, 0, 0],
    [0.02, 0.5, 0],
    [0.15, 1, 0.04],
    [0.22, 1.5, 0.08],
  ] as const satisfies readonly CardiacPoint3[]

  it('converges inlet streams into the pump and projects outlet jets downstream', () => {
    const paths = createImpellaBloodFlowPaths(route)
    const inletDirection = new THREE.Vector3(...route[1])
      .sub(new THREE.Vector3(...route[0]))
      .normalize()
    const outletDirection = new THREE.Vector3(...route.at(-1)!)
      .sub(new THREE.Vector3(...route.at(-2)!))
      .normalize()

    expect(paths.inlet).toHaveLength(4)
    expect(paths.outlet).toHaveLength(5)
    expect(paths.core).toEqual(route)
    paths.inlet.forEach((path) => {
      const travel = new THREE.Vector3(...path.at(-1)!).sub(new THREE.Vector3(...path[0]))
      expect(travel.dot(inletDirection)).toBeGreaterThan(0.35)
      expect(
        new THREE.Vector3(...path[0]).distanceTo(new THREE.Vector3(...route[0])),
      ).toBeGreaterThan(0.4)
    })
    paths.outlet.forEach((path) => {
      const travel = new THREE.Vector3(...path.at(-1)!).sub(new THREE.Vector3(...path[0]))
      expect(travel.dot(outletDirection)).toBeGreaterThan(0.55)
    })
  })

  it('removes local RP reversals while retaining exact inlet and outlet registration', () => {
    const smoothed = smoothImpellaCannulaRoute(IMPELLA_RP_FLOW_ROUTE)

    expect(smoothed[0]).toEqual(IMPELLA_RP_FLOW_ROUTE[0])
    expect(smoothed.at(-1)).toEqual(IMPELLA_RP_FLOW_ROUTE.at(-1))
    expect(maximumTurn(smoothed)).toBeLessThan(maximumTurn(IMPELLA_RP_FLOW_ROUTE) * 0.5)
    expect(routeLength(smoothed)).toBeCloseTo(routeLength(IMPELLA_RP_FLOW_ROUTE), 5)
  })

  it('builds a finite continuous reinforcement helix around the smoothed cannula', () => {
    const bodyRadius = 0.088
    const helix = createCannulaHelixPoints(route, bodyRadius, 12)

    expect(helix.length).toBeGreaterThan(100)
    helix.flat().forEach((coordinate) => expect(Number.isFinite(coordinate)).toBe(true))
    expect(new THREE.Vector3(...helix[0]).distanceTo(new THREE.Vector3(...route[0]))).toBeCloseTo(
      bodyRadius,
      4,
    )
    expect(
      new THREE.Vector3(...helix.at(-1)!).distanceTo(new THREE.Vector3(...route.at(-1)!)),
    ).toBeCloseTo(bodyRadius, 4)
  })
})
