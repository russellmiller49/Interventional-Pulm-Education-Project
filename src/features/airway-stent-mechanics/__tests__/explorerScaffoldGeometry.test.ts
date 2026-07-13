import { getStentExplorerArchitectureProfile } from '../explorer/architectures'
import { getStentExplorerPose } from '../explorer/pose'
import { buildExplorerScaffoldPaths } from '../explorer/scaffoldGeometry'
import type { StentExplorerArchitectureId } from '../explorer/types'

const metallicIds = [
  'free-crossing-braid',
  'hook-cross-covered',
  'laser-cut-covered',
  'single-wire-knit-partial-cover',
  'balloon-expanded-metal',
] as const satisfies readonly StentExplorerArchitectureId[]

function topologySignature(architectureId: StentExplorerArchitectureId) {
  const paths = buildExplorerScaffoldPaths(
    architectureId,
    getStentExplorerPose('metal-architecture', architectureId, 0),
  )
  return JSON.stringify({
    pathCount: paths.length,
    roles: [...new Set(paths.map((path) => path.role))].sort(),
    pointCounts: [...new Set(paths.map((path) => path.points.length))].sort((a, b) => a - b),
  })
}

describe('explorer metallic scaffold geometry', () => {
  it('adapts five paired constructions across four wire topologies without product GLBs', () => {
    const signatures = metallicIds.map(topologySignature)

    expect(new Set(signatures).size).toBe(4)
    expect(
      buildExplorerScaffoldPaths(
        'single-wire-knit-partial-cover',
        getStentExplorerPose('metal-architecture', 'single-wire-knit-partial-cover', 0),
      ),
    ).toHaveLength(1)
    expect(
      buildExplorerScaffoldPaths(
        'laser-cut-covered',
        getStentExplorerPose('metal-architecture', 'laser-cut-covered', 0),
      ).some((path) => path.role === 'connector'),
    ).toBe(true)
  })

  it('keeps every deformed point finite across the animation', () => {
    for (const architectureId of metallicIds) {
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        const paths = buildExplorerScaffoldPaths(
          architectureId,
          getStentExplorerPose('metal-architecture', architectureId, progress),
        )
        expect(paths.length).toBeGreaterThan(0)
        for (const path of paths) {
          expect(path.points.length).toBeGreaterThan(2)
          for (const point of path.points) {
            expect(Number.isFinite(point.x)).toBe(true)
            expect(Number.isFinite(point.y)).toBe(true)
            expect(Number.isFinite(point.z)).toBe(true)
          }
        }
      }
    }
  })

  it('opens one topology-specific discontinuity without erasing the remaining scaffold', () => {
    for (const architectureId of metallicIds) {
      const intactPose = getStentExplorerPose('fracture-cover-failure', architectureId, 0.2)
      const fracturedPose = getStentExplorerPose('fracture-cover-failure', architectureId, 1)
      const intact = buildExplorerScaffoldPaths(architectureId, intactPose)
      const fractured = buildExplorerScaffoldPaths(architectureId, fracturedPose)

      expect(fractured.length).toBe(intact.length + 1)
      expect(fractured.some((path) => /proximal|distal/.test(path.id))).toBe(true)
      expect(fractured.every((path) => path.points.length >= 3)).toBe(true)
      expect(fractured.reduce((total, path) => total + path.points.length, 0)).toBeLessThan(
        intact.reduce((total, path) => total + path.points.length, 0),
      )
    }
  })

  it('preserves full, partial, and uncovered interface labels as separate data', () => {
    expect(getStentExplorerArchitectureProfile('hook-cross-covered').coverage).toBe('fully-covered')
    expect(getStentExplorerArchitectureProfile('single-wire-knit-partial-cover').coverage).toBe(
      'partially-covered',
    )
    expect(getStentExplorerArchitectureProfile('free-crossing-braid').coverage).toBe('uncovered')
  })

  it('adds a local connector deflection while preserving connector endpoints', () => {
    const architectureId = 'laser-cut-covered'
    const neutral = buildExplorerScaffoldPaths(
      architectureId,
      getStentExplorerPose('metal-architecture', architectureId, 0),
    ).find((path) => path.role === 'connector')!
    const loaded = buildExplorerScaffoldPaths(
      architectureId,
      getStentExplorerPose('metal-architecture', architectureId, 0.5),
    ).find((path) => path.id === neutral.id)!
    const midpoint = Math.floor(loaded.points.length / 2)
    const midpointDisplacement = loaded.points[midpoint].distanceTo(neutral.points[midpoint])
    const endpointDisplacement =
      (loaded.points[0].distanceTo(neutral.points[0]) +
        loaded.points.at(-1)!.distanceTo(neutral.points.at(-1)!)) /
      2

    expect(midpointDisplacement).toBeGreaterThan(endpointDisplacement + 0.002)
  })
})
