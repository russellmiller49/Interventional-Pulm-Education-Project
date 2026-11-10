/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createDecoderModule } from 'draco3d'
import * as THREE from 'three'

import type { Vec3 } from '@/lib/airway-anatomy/types'
import { MUCOSA_ANATOMY_ATTRIBUTE } from '@/lib/bronchoscopy-core/mucosa'
import {
  applyLumenWallAttribute,
  computeLumenWallAttribute,
  smoothCenterline,
  teachingLumenAirways,
  type LumenWallAirway,
} from '../components/scope/lumenWallAttributes'
import { createScopeCase, type TeachingGraphFile } from '../engine/scope/scopeCase'

const PROFILE = path.join(
  process.cwd(),
  'public/bronchoscopy-foundations/anatomy/adult-teaching-combined-left-basal-v1',
)

/** A straight airway running foot-ward (LPS −Z), 8 mm in radius, with rings 4 mm apart. */
const straight = (overrides: Partial<LumenWallAirway> = {}): LumenWallAirway => ({
  edgeId: 1,
  parentEdgeId: null,
  pointsLps: [
    [0, 0, 0],
    [0, 0, -20],
    [0, 0, -40],
  ],
  radiusMm: 8,
  ringPitchMm: 4,
  cueStart: 1,
  cueEnd: 1,
  ...overrides,
})
const read = (values: Float32Array, vertex: number) => ({
  cos: values[vertex * 4],
  sin: values[vertex * 4 + 1],
  ring: values[vertex * 4 + 2],
  count: values[vertex * 4 + 3],
})

describe('lumen wall attribute', () => {
  it('measures the angle from posterior and counts rings down the airway', () => {
    // Posterior, anterior, the patient's left and right at 20 mm; posterior again at 30 mm.
    const wall = [
      [0, 8, -20],
      [0, -8, -20],
      [8, 0, -20],
      [-8, 0, -20],
      [0, 8, -30],
    ]
    const values = computeLumenWallAttribute(wall.flat(), [straight()])
    const [posterior, anterior, left, right, lower] = wall.map((_, i) => read(values, i))
    expect(posterior.cos).toBeCloseTo(1, 5)
    expect(posterior.sin).toBeCloseTo(0, 5)
    expect(anterior.cos).toBeCloseTo(-1, 5)
    expect(left.cos).toBeCloseTo(0, 5)
    expect(left.sin).toBeCloseTo(1, 5)
    expect(right.sin).toBeCloseTo(-1, 5)
    for (const vertex of [posterior, anterior, left, right]) {
      expect(vertex.ring).toBeCloseTo(1, 5)
      expect(vertex.count).toBeCloseTo(5, 4)
    }
    expect(lower.count).toBeCloseTo(7.5, 4)
  })

  it('carries the ring count on from a parent and lets the cue run out along a branch', () => {
    const parent = straight()
    const child = straight({
      edgeId: 2,
      parentEdgeId: 1,
      pointsLps: [
        [0, 0, -40],
        [0, 0, -52],
        [0, 0, -64],
      ],
      radiusMm: 4,
      ringPitchMm: 3,
      cueEnd: 0,
    })
    const wall = [
      [0, 4, -52],
      [0, 4, -63.9],
    ]
    const values = computeLumenWallAttribute(wall.flat(), [parent, child])
    const [middle, end] = wall.map((_, i) => read(values, i))
    // Ten rings down the parent, then four of the child's own.
    expect(middle.count).toBeCloseTo(10 + 4, 3)
    expect(Math.hypot(middle.cos, middle.sin)).toBeCloseTo(0.5, 2)
    expect(middle.ring).toBeCloseTo(0.5, 2)
    expect(Math.hypot(end.cos, end.sin)).toBeLessThan(0.02)
    expect(end.ring).toBeLessThan(0.02)
  })

  it('draws no rings where the airway runs straight back and posterior has no side', () => {
    const backward = straight({
      pointsLps: [
        [0, 0, 0],
        [0, 20, 0],
        [0, 40, 0],
      ],
    })
    const values = computeLumenWallAttribute([8, 20, 0, 0, 20, 8], [backward])
    expect(read(values, 0).ring).toBe(0)
    expect(read(values, 1).ring).toBe(0)
  })

  it('smooths a kinked centerline without moving its ends', () => {
    const kinked: Vec3[] = [
      [0, 0, 0],
      [3, 0, -10],
      [-3, 0, -20],
      [3, 0, -30],
      [0, 0, -40],
    ]
    const smooth = smoothCenterline(kinked, 8)
    expect(smooth[0]).toEqual(kinked[0])
    expect(smooth[smooth.length - 1]).toEqual(kinked[kinked.length - 1])
    let sharpest = 1
    for (let i = 1; i < smooth.length - 1; i += 1) {
      const a = new THREE.Vector3(...smooth[i]).sub(new THREE.Vector3(...smooth[i - 1]))
      const b = new THREE.Vector3(...smooth[i + 1]).sub(new THREE.Vector3(...smooth[i]))
      sharpest = Math.min(sharpest, a.normalize().dot(b.normalize()))
    }
    // The raw line turns by about 62 degrees at each point; the smoothed one by under 15.
    expect(sharpest).toBeGreaterThan(Math.cos((15 * Math.PI) / 180))
  })
})

describe('teaching lumen wall', () => {
  const file = JSON.parse(
    readFileSync(path.join(PROFILE, 'graph.json'), 'utf8'),
  ) as TeachingGraphFile
  const scopeCase = createScopeCase(file)
  const airways = teachingLumenAirways(scopeCase)
  let positions: Float32Array

  beforeAll(async () => {
    const glb = readFileSync(path.join(PROFILE, 'lumen.glb'))
    const jsonLength = glb.readUInt32LE(12)
    const doc = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'))
    const binary = glb.subarray(20 + jsonLength + 8)
    const extension = doc.meshes[0].primitives[0].extensions.KHR_draco_mesh_compression
    const view = doc.bufferViews[extension.bufferView]
    const data = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
    const draco = await createDecoderModule({})
    const decoder = new draco.Decoder()
    const buffer = new draco.DecoderBuffer()
    const mesh = new draco.Mesh()
    const values = new draco.DracoFloat32Array()
    try {
      buffer.Init(new Int8Array(data), data.length)
      expect(decoder.DecodeBufferToMesh(buffer, mesh).ok()).toBe(true)
      const attribute = decoder.GetAttributeByUniqueId(mesh, extension.attributes.POSITION)
      expect(decoder.GetAttributeFloatForAllPoints(mesh, attribute, values)).toBe(true)
      positions = Float32Array.from({ length: mesh.num_points() * 3 }, (_, i) => values.GetValue(i))
    } finally {
      for (const object of [values, mesh, buffer, decoder]) draco.destroy(object)
    }
  })

  it('gives the full cue to the central airways and none to the segments', () => {
    const cue = new Map(airways.map((airway) => [airway.edgeId, airway]))
    for (const label of ['TR', 'RMSB', 'LMSB', 'BI'] as const) {
      const airway = cue.get(scopeCase.originEdge.get(label)!)!
      expect([label, airway.cueStart, airway.cueEnd]).toEqual([label, 1, 1])
    }
    for (const label of ['RUL', 'RML', 'RLL', 'LUL', 'LLL'] as const) {
      const airway = cue.get(scopeCase.originEdge.get(label)!)!
      expect(airway.cueStart).toBeGreaterThan(0)
      expect(airway.cueEnd).toBeLessThan(airway.cueStart)
    }
    // A segment may begin with the last of its lobe's cue; no airway still has any where it ends.
    const parents = new Set(airways.map((airway) => airway.parentEdgeId))
    const terminal = airways.filter((airway) => !parents.has(airway.edgeId))
    expect(terminal.length).toBeGreaterThan(18)
    expect(terminal.filter((airway) => airway.cueEnd !== 0)).toEqual([])
    for (const label of ['RB1', 'RB6', 'RB10', 'LB1+2', 'LB6', 'LB10'] as const)
      expect(cue.get(scopeCase.originEdge.get(label)!)!.cueStart).toBeLessThan(0.5)
    expect(airways).toHaveLength(file.graph.edges.length)
  })

  it('finds the membranous wall behind the trachea and rings in front of it', () => {
    const values = computeLumenWallAttribute(positions, airways)
    expect(values).toHaveLength((positions.length / 3) * 4)
    expect(values.every(Number.isFinite)).toBe(true)

    // The middle of the trachea, well clear of the larynx and of the carina. The trachea leans,
    // so "behind" is judged against the centerline at the vertex's own level.
    const trachea = file.graph.edges.find((edge) => edge.id === scopeCase.originEdge.get('TR'))!
    const line = trachea.pointsLps
    const top = line[0][2]
    const bottom = line[line.length - 1][2]
    const centreAt = (z: number) => {
      let i = 1
      while (i < line.length - 1 && line[i][2] > z) i += 1
      const f = (line[i - 1][2] - z) / Math.max(line[i - 1][2] - line[i][2], 1e-6)
      return [0, 1].map((k) => line[i - 1][k] + (line[i][k] - line[i - 1][k]) * f)
    }
    let wall = 0
    let ringed = 0
    let behind = 0
    let behindCorrect = 0
    let inFront = 0
    let inFrontCorrect = 0
    let lowest = Infinity
    let highest = -Infinity
    for (let v = 0; v < positions.length / 3; v += 1) {
      const [x, y, z] = [positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]]
      const depth = (top - z) / (top - bottom)
      if (depth < 0.35 || depth > 0.7) continue
      const centre = centreAt(z)
      if (Math.hypot(x - centre[0], y - centre[1]) > 16) continue
      const vertex = read(values, v)
      wall += 1
      if (vertex.ring > 0.95) ringed += 1
      lowest = Math.min(lowest, vertex.count)
      highest = Math.max(highest, vertex.count)
      // LPS: posterior is +Y. A vertex straight behind the centerline must read as posterior,
      // and one straight in front of it as anterior.
      const straight = Math.abs(x - centre[0]) < 3
      if (straight && y - centre[1] > 4) {
        behind += 1
        if (vertex.cos > 0.8) behindCorrect += 1
      }
      if (straight && y - centre[1] < -4) {
        inFront += 1
        if (vertex.cos < -0.8) inFrontCorrect += 1
      }
    }
    expect(wall).toBeGreaterThan(2000)
    expect(ringed / wall).toBeGreaterThan(0.98)
    expect(behind).toBeGreaterThan(100)
    expect(behindCorrect / behind).toBeGreaterThan(0.98)
    expect(inFront).toBeGreaterThan(100)
    expect(inFrontCorrect / inFront).toBeGreaterThan(0.98)
    // About two rings to the centimetre over that stretch of trachea.
    const stretchMm = (top - bottom) * 0.35
    expect((highest - lowest) / (stretchMm / 10)).toBeGreaterThan(1.6)
    expect((highest - lowest) / (stretchMm / 10)).toBeLessThan(2.6)
  })

  it('writes the attribute once onto the shared geometry', () => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, 3000), 3))
    applyLumenWallAttribute(geometry, scopeCase)
    const written = geometry.getAttribute(MUCOSA_ANATOMY_ATTRIBUTE)
    expect(written.itemSize).toBe(4)
    expect(written.count).toBe(1000)
    applyLumenWallAttribute(geometry, scopeCase)
    expect(geometry.getAttribute(MUCOSA_ANATOMY_ATTRIBUTE)).toBe(written)
  })
})
