/** @jest-environment node */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { createDecoderModule, type DecoderModule } from 'draco3d'

import { AIRWAY_LABELS, type AccessoryState } from '../components/scope/types'
import { createScopeCase, type TeachingGraphFile } from '../engine/scope/scopeCase'
import {
  LARYNX_GLOTTIS_MM,
  LARYNX_LENGTH_MM,
  TUBE_START_MM,
  TUBE_TIP_MM,
} from '../engine/scope/scopeScripts'

const ROOT = process.cwd()
const BASE = path.join(ROOT, 'public/bronchoscopy-foundations/anatomy')
const PROFILE = 'adult-teaching-combined-left-basal-v1'
const json = <T>(relative: string): T =>
  JSON.parse(readFileSync(path.join(BASE, relative), 'utf8')) as T
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const graphFile = json<TeachingGraphFile>(`${PROFILE}/graph.json`)
const fileHash = (relative: string) => hash(readFileSync(path.join(BASE, relative)))
const manifest = json<{
  files: {
    path: string
    bytes: number
    sha256: string
    clinical_review_status: string
    publication_permitted: null
    [key: string]: unknown
  }[]
  payloadBytes: number
  releaseStatus: string
  unresolved: string[]
}>('manifest.json')
const REQUIRED_ACCESSORIES = {
  'forceps-closed': 'ACC_forceps_closed',
  'forceps-open': 'ACC_forceps_open',
  'brush-sheathed': 'ACC_brush_sheathed',
  'brush-exposed': 'ACC_brush_exposed',
  'needle-sheathed': 'ACC_needle_sheathed',
  'needle-exposed': 'ACC_needle_exposed',
} satisfies Record<Exclude<AccessoryState, 'none'>, string>
const BUDGETS: Record<string, number> = {
  [`${PROFILE}/lumen.glb`]: 3_000_000,
  'larynx/larynx-lumen.glb': 1_500_000,
  'devices/accessories.glb': 450_000,
  'devices/handle.glb': 500_000,
  'devices/scope-tip.glb': 100_000,
  'devices/bench.glb': 100_000,
  'devices/findings.glb': 100_000,
}
interface GlbDoc {
  buffers: { byteLength: number; uri?: string }[]
  bufferViews: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }[]
  accessors: {
    bufferView?: number
    byteOffset?: number
    componentType: number
    count: number
    type: string
    min?: number[]
    max?: number[]
  }[]
  nodes: {
    name: string
    mesh?: number
    translation?: number[]
    rotation?: number[]
    scale?: number[]
    matrix?: number[]
  }[]
  meshes: {
    primitives: {
      attributes: Record<string, number>
      indices: number
      targets?: Record<string, number>[]
      extensions: {
        KHR_draco_mesh_compression: { bufferView: number; attributes: Record<string, number> }
      }
    }[]
    extras?: { targetNames?: string[] }
    weights?: number[]
  }[]
  extensionsRequired: string[]
}
function readGlb(relative: string) {
  const data = readFileSync(path.join(BASE, relative))
  expect(data.readUInt32LE(0)).toBe(0x46546c67)
  expect(data.readUInt32LE(4)).toBe(2)
  expect(data.readUInt32LE(8)).toBe(data.length)
  const size = data.readUInt32LE(12)
  expect(data.readUInt32LE(16)).toBe(0x4e4f534a)
  expect(data.readUInt32LE(24 + size)).toBe(0x004e4942)
  return {
    doc: JSON.parse(data.subarray(20, 20 + size).toString()) as GlbDoc,
    binary: data.subarray(28 + size),
  }
}
type Glb = ReturnType<typeof readGlb>
let draco: DecoderModule
beforeAll(async () => {
  draco = await createDecoderModule({})
})
function decode(glb: Glb, meshIndex: number) {
  const primitive = glb.doc.meshes[meshIndex].primitives[0]
  const extension = primitive.extensions.KHR_draco_mesh_compression
  const view = glb.doc.bufferViews[extension.bufferView]
  const data = glb.binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
  const decoder = new draco.Decoder(),
    buffer = new draco.DecoderBuffer(),
    mesh = new draco.Mesh()
  const values = new draco.DracoFloat32Array(),
    face = new draco.DracoInt32Array()
  try {
    buffer.Init(new Int8Array(data), data.length)
    const status = decoder.DecodeBufferToMesh(buffer, mesh)
    expect(status.ok()).toBe(true)
    const attribute = decoder.GetAttributeByUniqueId(mesh, extension.attributes.POSITION)
    expect(decoder.GetAttributeFloatForAllPoints(mesh, attribute, values)).toBe(true)
    const positions = Float32Array.from({ length: mesh.num_points() * 3 }, (_, i) =>
      values.GetValue(i),
    )
    const indices = new Uint32Array(mesh.num_faces() * 3)
    for (let i = 0; i < mesh.num_faces(); i++) {
      decoder.GetFaceFromMesh(mesh, i, face)
      for (let k = 0; k < 3; k++) indices[3 * i + k] = face.GetValue(k)
    }
    expect(positions.length / 3).toBe(glb.doc.accessors[primitive.attributes.POSITION].count)
    expect(indices.length).toBe(glb.doc.accessors[primitive.indices].count)
    return { positions, indices }
  } finally {
    for (const object of [values, face, mesh, buffer, decoder]) draco.destroy(object)
  }
}
function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const filename = path.join(directory, entry.name)
      expect(entry.isSymbolicLink()).toBe(false)
      return entry.isDirectory() ? walk(filename) : [path.relative(BASE, filename)]
    })
    .sort()
}

describe('scope asset inventory and provenance', () => {
  test('lists every payload exactly once and includes the manifest in the total budget', () => {
    expect(manifest.files.map((f) => f.path).sort()).toEqual(
      walk(BASE).filter((p) => p !== 'manifest.json'),
    )
    expect(new Set(manifest.files.map((f) => f.path)).size).toBe(manifest.files.length)
    expect(manifest.payloadBytes).toBe(manifest.files.reduce((sum, f) => sum + f.bytes, 0))
    expect(
      walk(BASE).reduce((sum, f) => sum + statSync(path.join(BASE, f)).size, 0),
    ).toBeLessThanOrEqual(8_000_000)
  })
  test.each(manifest.files)(
    '$path has the committed byte count, hash, budget and pending rights record',
    (entry) => {
      expect(path.isAbsolute(entry.path)).toBe(false)
      expect(entry.path.split('/')).not.toContain('..')
      const bytes = readFileSync(path.join(BASE, entry.path))
      expect(bytes.length).toBe(entry.bytes)
      expect(hash(bytes)).toBe(entry.sha256)
      if (BUDGETS[entry.path]) expect(bytes.length).toBeLessThanOrEqual(BUDGETS[entry.path])
      for (const key of [
        'origin',
        'creator_or_rightsholder',
        'license_or_permission',
        'deidentification_status',
        'clinical_reviewer',
        'review_date',
        'anatomy_profile_id',
        'camera_orientation_description',
        'approved_use',
        'clinical_review_status',
        'publication_permitted',
        'provenance',
      ])
        expect(entry).toHaveProperty(key)
      expect(entry.clinical_review_status).toBe('pending')
      expect(entry.publication_permitted).toBeNull()
      expect(entry.clinical_reviewer).toBeNull()
      expect(entry.review_date).toBeNull()
      expect(entry.anatomy_profile_id).toBe(PROFILE)
    },
  )
  test('adds no machine paths to assets, GLB metadata, scripts or documentation', () => {
    const forbidden = new RegExp(
      ['Users', 'home', 'Volumes', 'private', 'tmp'].map((name) => `/${name}/`).join('|') +
        '|[A-Za-z]:\\\\',
    )
    const paths = [
      ...walk(BASE).map((p) => path.join(BASE, p)),
      path.join(ROOT, 'docs/bronchoscopy-foundations/scope-assets.md'),
      path.join(ROOT, 'src/features/bronchoscopy-foundations/__tests__/scope-assets.test.ts'),
      ...[
        'build-scope-assets.py',
        'build-teaching-props.py',
        'compress-scope-assets.mjs',
        'review-scope-assets.browser.mts',
        'review-scope-assets.mjs',
        'build-scope-manifest.mjs',
        'tsconfig.scope-assets.json',
      ].map((p) => path.join(ROOT, 'scripts/bronchoscopy-foundations', p)),
    ]
    for (const p of paths.filter((p) => !p.endsWith('.png'))) {
      const content = p.endsWith('.glb')
        ? JSON.stringify(readGlb(path.relative(BASE, p)).doc)
        : readFileSync(p, 'utf8')
      expect(content).not.toMatch(forbidden)
    }
  })
})

describe('decoded runtime geometry', () => {
  test.each(
    manifest.files.filter((entry) => entry.path.endsWith('.glb')).map((entry) => entry.path),
  )('%s is self-contained and each primitive decodes with Draco', (relative) => {
    const glb = readGlb(relative)
    expect(JSON.stringify(glb.doc)).not.toMatch(/"uri"\s*:/)
    expect(glb.doc.extensionsRequired).toContain('KHR_draco_mesh_compression')
    expect(glb.doc.buffers).toHaveLength(1)
    expect(glb.doc.buffers[0].byteLength).toBeLessThanOrEqual(glb.binary.length)
    for (const view of glb.doc.bufferViews) {
      expect(view.buffer).toBe(0)
      expect((view.byteOffset ?? 0) + view.byteLength).toBeLessThanOrEqual(glb.binary.length)
    }
    glb.doc.meshes.forEach((mesh, i) => {
      expect(mesh.primitives).toHaveLength(1)
      const decoded = decode(glb, i)
      expect(decoded.indices.length).toBeGreaterThan(0)
      expect(Array.from(decoded.positions).every(Number.isFinite)).toBe(true)
    })
    for (const node of glb.doc.nodes) {
      expect(node.translation ?? [0, 0, 0]).toEqual([0, 0, 0])
      expect(node.rotation ?? [0, 0, 0, 1]).toEqual([0, 0, 0, 1])
      expect(node.scale ?? [1, 1, 1]).toEqual([1, 1, 1])
      expect(node.matrix ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]).toEqual([
        1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
      ])
    }
  })
  test('the lumen is one closed outward mesh containing every graph node in its actual bounds', () => {
    const glb = readGlb(`${PROFILE}/lumen.glb`)
    expect(glb.doc.nodes).toHaveLength(1)
    expect(glb.doc.nodes[0].name).toBe('PatientLpsLumen')
    expect(glb.doc.meshes).toHaveLength(1)
    const { positions: p, indices } = decode(glb, 0)
    expect(indices.length / 3).toBeLessThanOrEqual(250_000)
    const count = p.length / 3
    const parents = Uint32Array.from({ length: count }, (_, i) => i)
    const find = (i: number): number => {
      while (parents[i] !== i) {
        parents[i] = parents[parents[i]]
        i = parents[i]
      }
      return i
    }
    const edges = new Map<string, { count: number; direction: number }>()
    let volume = 0
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]]
      expect(a !== b && b !== c && c !== a).toBe(true)
      parents[find(b)] = find(a)
      parents[find(c)] = find(a)
      for (const [u, v] of [
        [a, b],
        [b, c],
        [c, a],
      ]) {
        const key = `${Math.min(u, v)},${Math.max(u, v)}`
        const edge = edges.get(key) ?? { count: 0, direction: 0 }
        edge.count++
        edge.direction += u < v ? 1 : -1
        edges.set(key, edge)
      }
      volume +=
        (p[3 * a] * (p[3 * b + 1] * p[3 * c + 2] - p[3 * b + 2] * p[3 * c + 1]) +
          p[3 * a + 1] * (p[3 * b + 2] * p[3 * c] - p[3 * b] * p[3 * c + 2]) +
          p[3 * a + 2] * (p[3 * b] * p[3 * c + 1] - p[3 * b + 1] * p[3 * c])) /
        6
    }
    expect([...edges.values()].every((e) => e.count === 2 && e.direction === 0)).toBe(true)
    expect(new Set(Array.from(parents, (_, i) => find(i))).size).toBe(1)
    expect(volume).toBeGreaterThan(0)
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < p.length; i++) {
      min[i % 3] = Math.min(min[i % 3], p[i])
      max[i % 3] = Math.max(max[i % 3], p[i])
    }
    for (const node of graphFile.graph.nodes)
      node.lps.forEach((v, i) => {
        expect(v).toBeGreaterThanOrEqual(min[i])
        expect(v).toBeLessThanOrEqual(max[i])
      })
  })
})

describe('runtime review evidence and engine contracts', () => {
  // The brief's geometric acceptance remains open; a passing inventory must not hide it.
  test.todo('joins the larynx to a continuous tracheal opening with at most 0.5 mm surface gap')
  test('the laryngeal wall shells are closed manifold surfaces with patent luminal end rings', () => {
    const glb = readGlb('larynx/larynx-lumen.glb')
    for (const name of ['UA_lumen', 'UA_subglottis']) {
      const meshIndex = glb.doc.nodes.find((n) => n.name === name)!.mesh!
      const { indices } = decode(glb, meshIndex)
      const edges = new Map<string, number>()
      const vertices = new Set<number>()
      for (let i = 0; i < indices.length; i += 3) {
        const face = [indices[i], indices[i + 1], indices[i + 2]]
        for (let j = 0; j < 3; j++) {
          const a = face[j],
            b = face[(j + 1) % 3]
          vertices.add(a)
          const key = `${Math.min(a, b)},${Math.max(a, b)}`
          edges.set(key, (edges.get(key) ?? 0) + 1)
        }
      }
      expect([...edges.values()].every((count) => count === 2)).toBe(true)
      // A connected capped annular sleeve has genus one (Euler characteristic zero),
      // unlike an air-volume cylinder capped across its opening (characteristic two).
      expect(vertices.size - edges.size + indices.length / 3).toBe(0)
    }
  })
  test('pins an actual zero-outside route review, tip clearances and reference frames to this mesh and graph', () => {
    const review = json<{
      lumenSha256: string
      graphSha256: string
      sourceLumenSha256: string
      centerlineSamples: number
      interpolatedSamples: number
      outsideSamples: number
      outside: unknown[]
      minimumClearanceMm: number
      tipRadiusMm: number
      actualSurfaceAdvanceWithdraw: boolean
      largeStepWallStop: boolean
      wallStopClearanceMm: number
      airwayClearances: {
        label: string
        edgeId: number
        minClearanceMm: number
        freeDriveFits: boolean
      }[]
      belowTipRadius: string[]
      references: { id: string; edgeId: number; distanceMm: number; relationshipMatches: boolean }[]
      deviation: {
        topologyPreserved: boolean
        maxSurfaceDeviationBoundMm: number
        meanVertexDisplacementMm: number
      }
      build: {
        connectedComponents: number
        nonManifoldEdges: number
        outwardNormals: boolean
        triangles: number
      }
      browser: {
        errors: string[]
        dracoDecodeAndParseMs: number
        bvhBuildMs: number
        decoderPath: string
      }
    }>(`${PROFILE}/review/collision-review.json`)
    expect(review.lumenSha256).toBe(fileHash(`${PROFILE}/lumen.glb`))
    expect(review.graphSha256).toBe(fileHash(`${PROFILE}/graph.json`))
    expect(review.sourceLumenSha256).toBe(
      hash(readFileSync(path.join(ROOT, 'public/airway-anatomy/case-001/lumen-v2.glb'))),
    )
    expect(review.centerlineSamples).toBe(
      graphFile.graph.edges.reduce((sum, edge) => sum + edge.pointsLps.length, 0),
    )
    expect(review.interpolatedSamples).toBeGreaterThan(review.centerlineSamples)
    expect(review.outsideSamples).toBe(0)
    expect(review.outside).toEqual([])
    expect(review.minimumClearanceMm).toBeGreaterThanOrEqual(0)
    expect(review.tipRadiusMm).toBe(1.9)
    expect(review.actualSurfaceAdvanceWithdraw).toBe(true)
    expect(review.largeStepWallStop).toBe(true)
    expect(review.wallStopClearanceMm).toBeGreaterThanOrEqual(review.tipRadiusMm)
    expect(review.airwayClearances.map((a) => a.label).sort()).toEqual([...AIRWAY_LABELS].sort())
    const scopeCase = createScopeCase(graphFile)
    for (const airway of review.airwayClearances) {
      expect(airway.edgeId).toBe(
        scopeCase.originEdge.get(airway.label as (typeof AIRWAY_LABELS)[number]),
      )
      expect(airway.minClearanceMm).toBeGreaterThanOrEqual(0)
      expect(airway.freeDriveFits).toBe(airway.minClearanceMm >= review.tipRadiusMm)
    }
    expect(review.belowTipRadius).toEqual(
      review.airwayClearances.filter((a) => !a.freeDriveFits).map((a) => a.label),
    )
    expect(review.references.map((r) => [r.id, r.edgeId, r.distanceMm])).toEqual([
      ['rul', 3, 10],
      ['rml', 9, 6],
      ['lul', 496, 9],
    ])
    expect(review.references.every((r) => r.relationshipMatches)).toBe(true)
    expect(review.deviation.topologyPreserved).toBe(true)
    expect(review.deviation.maxSurfaceDeviationBoundMm).toBeLessThanOrEqual(0.3)
    expect(review.deviation.meanVertexDisplacementMm).toBeLessThanOrEqual(
      review.deviation.maxSurfaceDeviationBoundMm,
    )
    expect(review.build).toMatchObject({
      connectedComponents: 1,
      nonManifoldEdges: 0,
      outwardNormals: true,
    })
    const lumenDoc = readGlb(`${PROFILE}/lumen.glb`).doc
    expect(review.build.triangles).toBe(
      lumenDoc.accessors[lumenDoc.meshes[0].primitives[0].indices].count / 3,
    )
    expect(review.browser.errors).toEqual([])
    expect(review.browser.decoderPath).toBe('/fluoroview/draco/')
    expect(review.browser.dracoDecodeAndParseMs).toBeGreaterThan(0)
    expect(review.browser.bvhBuildMs).toBeGreaterThan(0)
  })
  test('uses the engine larynx distances, a sub-millimetre path and the exact graph entry', () => {
    const larynx = json<{
      pathLps: number[][]
      glottisMm: number
      exitMm: number
      numberClass: string
    }>('larynx/larynx.json')
    expect(larynx.numberClass).toBe('authored-for-simulation')
    expect(larynx.glottisMm).toBe(LARYNX_GLOTTIS_MM)
    expect(larynx.exitMm).toBe(LARYNX_LENGTH_MM)
    expect(larynx.pathLps.at(-1)).toEqual(graphFile.graph.nodes.find((n) => n.id === 0)!.lps)
    let length = 0
    larynx.pathLps.slice(1).forEach((p, i) => {
      const spacing = Math.hypot(...p.map((v, k) => v - larynx.pathLps[i][k]))
      expect(spacing).toBeGreaterThan(0)
      expect(spacing).toBeLessThanOrEqual(1)
      length += spacing
    })
    expect(length).toBeCloseTo(LARYNX_LENGTH_MM, 3)
  })
  test('decodes both true-fold adduct targets, keeps half-adduction open and closes at full weight', () => {
    const glb = readGlb('larynx/larynx-lumen.glb')
    const required = [
      'UA_lumen',
      'UA_epiglottis',
      'UA_fold_true_L',
      'UA_fold_true_R',
      'UA_fold_false_L',
      'UA_fold_false_R',
      'UA_arytenoid_L',
      'UA_arytenoid_R',
      'UA_subglottis',
    ]
    expect(glb.doc.nodes.map((n) => n.name)).toEqual(expect.arrayContaining(required))
    const larynx = json<{
      pathLps: number[][]
      frameLps: { left: number[]; anterior: number[]; forward: number[] }
    }>('larynx/larynx.json')
    const root = larynx.pathLps.at(-1)!
    const center = root.map((v, i) => v - 15 * larynx.frameLps.forward[i])
    const folds = ['L', 'R'].map((side) => {
      const meshIndex = glb.doc.nodes.find((n) => n.name === `UA_fold_true_${side}`)!.mesh!
      const mesh = glb.doc.meshes[meshIndex]
      expect(mesh.extras?.targetNames).toEqual(['adduct'])
      expect(mesh.weights).toEqual([0])
      const decoded = decode(glb, meshIndex)
      const accessor = glb.doc.accessors[mesh.primitives[0].targets![0].POSITION]
      expect(accessor.count).toBe(decoded.positions.length / 3)
      expect(accessor.componentType).toBe(5126)
      const view = glb.doc.bufferViews[accessor.bufferView!]
      const morph = Float32Array.from({ length: accessor.count * 3 }, (_, i) =>
        glb.binary.readFloatLE(
          (view.byteOffset ?? 0) +
            (accessor.byteOffset ?? 0) +
            Math.floor(i / 3) * (view.byteStride ?? 12) +
            (i % 3) * 4,
        ),
      )
      return { ...decoded, morph }
    })
    const gaps = [0, 0.5, 1].map((weight) => {
      const edges = folds.map((fold, side) => {
        const positions: number[] = []
        for (let i = 0; i < fold.positions.length; i += 3) {
          const point = [0, 1, 2].map(
            (k) => fold.positions[i + k] + weight * fold.morph[i + k] - center[k],
          )
          if (Math.abs(point.reduce((sum, v, k) => sum + v * larynx.frameLps.anterior[k], 0)) < 0.1)
            positions.push(point.reduce((sum, v, k) => sum + v * larynx.frameLps.left[k], 0))
        }
        expect(positions.length).toBeGreaterThan(0)
        return side === 0 ? Math.min(...positions) : Math.max(...positions)
      })
      return edges[0] - edges[1]
    })
    expect(gaps[0]).toBeGreaterThan(gaps[1])
    expect(gaps[1]).toBeGreaterThan(1)
    expect(Math.abs(gaps[2])).toBeLessThan(0.001)
  })
  test('covers every non-none accessory and the three authored tube sizes', () => {
    const devices = json<{
      numberClass: string
      tubes: {
        idMm: number
        odMm: number
        lengthMm: number
        startMm: number
        tipMm: number
        numberClass: string
      }[]
      accessories: {
        kind: string
        tipOffsetBeyondScopeTipMm: { 'at-tip': number; extended: number }
        inChannelVisible: boolean
        states: { state: string; node: string; protected: boolean }[]
      }[]
    }>('devices/devices.json')
    expect(devices.numberClass).toBe('authored-for-simulation')
    expect(devices.tubes.map((t) => t.idMm)).toEqual([7, 7.5, 8])
    for (const tube of devices.tubes) {
      expect(tube.numberClass).toBe('authored-for-simulation')
      expect(tube.odMm).toBeGreaterThan(tube.idMm)
      expect(tube.startMm).toBe(TUBE_START_MM)
      expect(tube.tipMm).toBe(TUBE_TIP_MM)
      expect(tube.lengthMm).toBe(TUBE_TIP_MM - TUBE_START_MM)
    }
    const states = devices.accessories.flatMap((a) => a.states)
    expect(Object.fromEntries(states.map((s) => [s.state, s.node]))).toEqual(REQUIRED_ACCESSORIES)
    expect(
      readGlb('devices/accessories.glb')
        .doc.nodes.map((n) => n.name)
        .sort(),
    ).toEqual(Object.values(REQUIRED_ACCESSORIES).sort())
    for (const accessory of devices.accessories) {
      expect(accessory.inChannelVisible).toBe(false)
      expect(accessory.tipOffsetBeyondScopeTipMm['at-tip']).toBeGreaterThan(0)
      expect(accessory.tipOffsetBeyondScopeTipMm.extended).toBeGreaterThan(
        accessory.tipOffsetBeyondScopeTipMm['at-tip'],
      )
      for (const state of accessory.states)
        expect(state.protected).toBe(/closed|sheathed/.test(state.state))
    }
  })
  test('pins the device review and keeps the noncompliant source junction explicitly pending', () => {
    const review = json<{
      larynxSha256: string
      larynxPathSha256: string
      accessoriesSha256: string
      pathEndpointGapMm: number
      junction: {
        status: string
        exitRingSourceMaxDistanceMm: number
        continuousOpeningVerified: boolean
      }
    }>('review/device-review.json')
    expect(review.larynxSha256).toBe(fileHash('larynx/larynx-lumen.glb'))
    expect(review.larynxPathSha256).toBe(fileHash('larynx/larynx.json'))
    expect(review.accessoriesSha256).toBe(fileHash('devices/accessories.glb'))
    expect(review.pathEndpointGapMm).toBeLessThanOrEqual(0.5)
    expect(review.junction.status).toBe('pending-source-inlet-decision')
    expect(review.junction.exitRingSourceMaxDistanceMm).toBeGreaterThan(0.5)
    expect(review.junction.continuousOpeningVerified).toBe(false)
    expect(manifest.releaseStatus).toBe('pending-clinical-review-and-junction-decision')
    expect(manifest.unresolved.length).toBeGreaterThan(0)
  })
})

test('teaching props expose the scene nodes and identify authored parameters', () => {
  const expected: Record<string, string[]> = {
    handle: ['HANDLE_body', 'HANDLE_lever', 'HANDLE_suction'],
    'scope-tip': ['TIP_body', 'TIP_lens', 'TIP_light', 'TIP_channel'],
    bench: ['BENCH_card', 'BENCH_up', 'BENCH_cross'],
    findings: ['PRACTICE_target', 'PRACTICE_secretion'],
  }
  for (const [file, names] of Object.entries(expected)) {
    const nodes = readGlb(`devices/${file}.glb`).doc.nodes.map((node) => node.name)
    expect(nodes).toEqual(expect.arrayContaining(names))
    expect(
      manifest.files.find((entry) => entry.path === `devices/${file}.glb`)?.provenance,
    ).toMatchObject({ generatedBy: 'scripts/bronchoscopy-foundations/build-teaching-props.py' })
  }
  const props = json<{ scopeTip: { odMm: number }; numberClass: string }>(
    'devices/teaching-props.json',
  )
  expect(props.scopeTip.odMm).toBe(3.8)
  expect(props.numberClass).toMatch(/authored/i)
})
