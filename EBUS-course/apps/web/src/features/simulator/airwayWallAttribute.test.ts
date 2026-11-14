import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BRONCHIAL_RING_PITCH_MM,
  RINGS_PAST_CARINA_MM,
  RING_FADE_MM,
  TRACHEAL_RING_PITCH_MM,
  airwayWallAttribute,
  carinaArcLengthMm,
  ringCount,
  ringCue,
} from './airwayWallAttribute'
import type { SimulatorCaseManifest, SimulatorCenterlineAsset, SimulatorMeshAsset } from './types'

const root = resolve('public/simulator/case-001')
const json = <T>(file: string): T => JSON.parse(readFileSync(resolve(root, file), 'utf8'))
const manifest = json<SimulatorCaseManifest>('case_manifest.simplified.web.json')
const centerlines = json<SimulatorCenterlineAsset>(manifest.assets.centerlines)
const mesh = json<SimulatorMeshAsset>(manifest.assets.airway_mesh)
const carina = carinaArcLengthMm(centerlines)
const attribute = airwayWallAttribute(mesh.vertices, centerlines)
const at = (v: number) => ({
  cos: attribute[v * 4],
  sin: attribute[v * 4 + 1],
  cue: attribute[v * 4 + 2],
  count: attribute[v * 4 + 3],
})

describe('ring spacing and extent', () => {
  it('finds the carina where the left and right paths part', () => {
    // The station 7 presets sit just past it on either side (125 and 126 mm).
    expect(carina).toBeGreaterThan(95)
    expect(carina).toBeLessThan(115)
  })
  it('counts rings wider apart in the trachea than in the bronchi, without a jump at the carina', () => {
    expect(ringCount(TRACHEAL_RING_PITCH_MM * 3, carina)).toBeCloseTo(3, 6)
    expect(ringCount(carina + 0.001, carina) - ringCount(carina, carina)).toBeLessThan(0.001)
    expect(
      ringCount(carina + BRONCHIAL_RING_PITCH_MM * 2, carina) - ringCount(carina, carina),
    ).toBeCloseTo(2, 6)
  })
  it('draws rings through the main bronchi and fades them out beyond', () => {
    expect(ringCue(0, carina)).toBe(1)
    expect(ringCue(carina + RINGS_PAST_CARINA_MM, carina)).toBe(1)
    const mid = ringCue(carina + RINGS_PAST_CARINA_MM + RING_FADE_MM / 2, carina)
    expect(mid).toBeGreaterThan(0.4)
    expect(mid).toBeLessThan(0.6)
    expect(ringCue(carina + RINGS_PAST_CARINA_MM + RING_FADE_MM, carina)).toBe(0)
  })
})

describe('the wall attribute on this case’s airway', () => {
  it('gives every vertex a finite value whose direction has the length of its cue', () => {
    expect(attribute.length).toBe(mesh.vertices.length * 4)
    let cued = 0
    for (let v = 0; v < mesh.vertices.length; v++) {
      const { cos, sin, cue, count } = at(v)
      for (const value of [cos, sin, cue, count]) expect(Number.isFinite(value)).toBe(true)
      expect(cue).toBeGreaterThanOrEqual(0)
      expect(cue).toBeLessThanOrEqual(1)
      expect(Math.hypot(cos, sin)).toBeCloseTo(cue, 4)
      if (cue === 1) cued += 1
    }
    // The trachea and proximal bronchi carry the cue; the distal tree does not.
    expect(cued).toBeGreaterThan(mesh.vertices.length * 0.1)
    expect(cued).toBeLessThan(mesh.vertices.length * 0.9)
  })
  it('opens the rings behind: the most posterior tracheal wall reads as membranous', () => {
    // Scene coordinates are [left, superior, -posterior]: posterior is the lowest z.
    const line = centerlines.polylines.find((entry) => entry.points.length >= 20)!
    const index = line.cumulative_lengths_mm.findIndex((s) => s >= carina * 0.5)
    const centre = line.points[index]
    const ring = mesh.vertices
      .map((vertex, v) => ({ vertex, v }))
      .filter(({ vertex }) => Math.abs(vertex[1] - centre[1]) < 4 && Math.hypot(vertex[0] - centre[0], vertex[2] - centre[2]) < 20)
    expect(ring.length).toBeGreaterThan(6)
    const behind = ring.reduce((a, b) => (b.vertex[2] < a.vertex[2] ? b : a))
    const front = ring.reduce((a, b) => (b.vertex[2] > a.vertex[2] ? b : a))
    // The shader draws the membranous wall where cos is above about 0.7 to 0.9.
    expect(at(behind.v).cos).toBeGreaterThan(0.85)
    expect(at(front.v).cos).toBeLessThan(-0.85)
    expect(at(behind.v).cue).toBe(1)
  })
  it('counts rings down the trachea in step with the distance travelled', () => {
    const line = centerlines.polylines.find((entry) => entry.points.length >= 20)!
    const near = (s: number) => {
      const centre = line.points[line.cumulative_lengths_mm.findIndex((value) => value >= s)]
      let best = Infinity,
        found = 0
      mesh.vertices.forEach((vertex, v) => {
        const d = Math.hypot(vertex[0] - centre[0], vertex[1] - centre[1], vertex[2] - centre[2])
        if (d < best) {
          best = d
          found = v
        }
      })
      return at(found).count
    }
    const upper = near(carina * 0.3),
      lower = near(carina * 0.8)
    expect(lower - upper).toBeGreaterThan(((carina * 0.5) / TRACHEAL_RING_PITCH_MM) * 0.7)
    expect(lower - upper).toBeLessThan(((carina * 0.5) / TRACHEAL_RING_PITCH_MM) * 1.3)
  })
})
