import { buildAeroPaths, buildBonastentPaths, buildUltraflexPaths } from '../deviceGeometry'

describe('device-specific procedural scaffold paths', () => {
  it('builds AERO from crowns, bridges, and anchors rather than helical wire families', () => {
    const paths = buildAeroPaths()
    const families = new Set(paths.map((path) => path.family))

    expect(families).toEqual(new Set(['crown', 'bridge', 'anchor']))
    expect(paths.some((path) => path.closed)).toBe(true)
    expect(paths.some((path) => path.family === 'clockwise')).toBe(false)
  })

  it('builds BONASTENT from two counter-wound wire families with visible crossing relief', () => {
    const paths = buildBonastentPaths()
    const clockwise = paths.filter((path) => path.family === 'clockwise')
    const counterclockwise = paths.filter((path) => path.family === 'counterclockwise')

    expect(clockwise).toHaveLength(8)
    expect(counterclockwise).toHaveLength(8)

    const clockwiseRadius = Math.hypot(clockwise[0]!.points[0]![0], clockwise[0]!.points[0]![2])
    const counterRadius = Math.hypot(
      counterclockwise[0]!.points[0]![0],
      counterclockwise[0]!.points[0]![2],
    )
    expect(clockwiseRadius).not.toBeCloseTo(counterRadius, 4)
  })

  it('builds Ultraflex as one uninterrupted looped strand', () => {
    const paths = buildUltraflexPaths()

    expect(paths).toHaveLength(1)
    expect(paths[0]!.family).toBe('single-wire')
    expect(paths[0]!.closed).toBe(false)
    expect(paths[0]!.points.length).toBeGreaterThan(1000)
  })
})
