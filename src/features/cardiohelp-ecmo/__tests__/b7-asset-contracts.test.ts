import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  BLENDER_OUTLET_LOCAL,
  PATIENT_POSITION,
  PATIENT_SCALE,
  TUBE_RADII,
} from '../components/ecmo-circuit/constants'
import { buildCircuitLayout, patientWorldPoint } from '../components/ecmo-circuit/layout'

/**
 * B7 asset contracts: the five runtime GLBs stay structurally valid, keep
 * their stable node names and material sets, fit the payload budget, and the
 * patient's access anchors sit ON the mannequin's skin.
 *
 * The anchor assertions decode the patient GLB's actual vertex positions
 * rather than restating the numbers in layout.ts — the defect this guards
 * against (B7 baseline audit) was anchors authored 0.16 m above the skin, so
 * cannula tips, dressing rings and the DPC all floated in mid-air. A repeat
 * of the null-material-slot regression (the shipped drape rendered
 * default-white because its material slot exported as null) is asserted
 * against the GLB's own material list.
 */

const MODELS_DIR = join(__dirname, '..', '..', '..', '..', 'public', 'models', 'cardiohelp-ecmo')

const RUNTIME_ASSETS = [
  'patient-femoral-access.glb',
  'cardiohelp-console.glb',
  'oxygenator.glb',
  'circuit-clamp.glb',
  'hls-sensor-connector.glb',
  'sweep-gas-blender.glb',
] as const

const ASSET_BUDGET_BYTES = 6 * 1024 * 1024

interface GlbDocument {
  json: {
    nodes?: { name?: string }[]
    meshes: { primitives: { attributes: Record<string, number>; material?: number }[] }[]
    materials?: { name?: string }[]
    images?: unknown[]
    accessors: {
      bufferView?: number
      byteOffset?: number
      componentType: number
      count: number
      type: string
      min?: number[]
      max?: number[]
    }[]
    bufferViews: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }[]
  }
  binary: Buffer
}

function readGlb(name: string): GlbDocument {
  const buffer = readFileSync(join(MODELS_DIR, name))
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  expect(view.getUint32(0, true)).toBe(0x46546c67) // 'glTF'
  expect(view.getUint32(4, true)).toBe(2)

  let offset = 12
  let json: GlbDocument['json'] | null = null
  let binary: Buffer | null = null
  while (offset < buffer.byteLength) {
    const chunkLength = view.getUint32(offset, true)
    const chunkType = view.getUint32(offset + 4, true)
    const chunk = buffer.subarray(offset + 8, offset + 8 + chunkLength)
    if (chunkType === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'))
    if (chunkType === 0x004e4942) binary = chunk
    offset += 8 + chunkLength
  }
  if (!json || !binary) throw new Error(`${name}: missing JSON or BIN chunk`)
  return { json, binary }
}

/** Every POSITION vertex of every primitive, decoded from the binary chunk. */
function positions(doc: GlbDocument): Float32Array[] {
  const arrays: Float32Array[] = []
  for (const mesh of doc.json.meshes) {
    for (const primitive of mesh.primitives) {
      const accessor = doc.json.accessors[primitive.attributes.POSITION]
      expect(accessor.type).toBe('VEC3')
      expect(accessor.componentType).toBe(5126) // float32
      const bufferView = doc.json.bufferViews[accessor.bufferView ?? 0]
      const start =
        doc.binary.byteOffset + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
      arrays.push(new Float32Array(doc.binary.buffer.slice(start, start + accessor.count * 12)))
    }
  }
  return arrays
}

function positionBounds(doc: GlbDocument): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const mesh of doc.json.meshes) {
    for (const primitive of mesh.primitives) {
      const accessor = doc.json.accessors[primitive.attributes.POSITION]
      if (!accessor.min || !accessor.max) continue
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], accessor.min[axis])
        max[axis] = Math.max(max[axis], accessor.max[axis])
      }
    }
  }
  return { min, max }
}

describe('runtime GLB structure', () => {
  it.each(RUNTIME_ASSETS)('%s is a valid glTF 2 GLB with finite nonzero bounds', (name) => {
    const doc = readGlb(name)
    const { min, max } = positionBounds(doc)
    for (let axis = 0; axis < 3; axis += 1) {
      expect(Number.isFinite(min[axis])).toBe(true)
      expect(Number.isFinite(max[axis])).toBe(true)
      expect(max[axis] - min[axis]).toBeGreaterThan(0.01)
      expect(max[axis] - min[axis]).toBeLessThan(3)
    }
  })

  it('keeps the stable node names the scene and tests reference', () => {
    const expected: Record<string, string> = {
      'patient-femoral-access.glb': 'patient_femoral_access',
      'cardiohelp-console.glb': 'cardiohelp_console',
      'oxygenator.glb': 'membrane_oxygenator',
      'circuit-clamp.glb': 'circuit_clamp',
      'hls-sensor-connector.glb': 'hls_sensor_connector',
      'sweep-gas-blender.glb': 'sweep_gas_blender',
    }
    for (const [file, nodeName] of Object.entries(expected)) {
      const names = (readGlb(file).json.nodes ?? []).map((node) => node.name)
      expect(names).toContain(nodeName)
    }
  })

  it('stays inside the 6 MB runtime payload budget', () => {
    const total = RUNTIME_ASSETS.reduce(
      (sum, name) => sum + readFileSync(join(MODELS_DIR, name)).byteLength,
      0,
    )
    expect(total).toBeLessThan(ASSET_BUDGET_BYTES)
  })

  it('embeds no textures in any runtime asset', () => {
    // The scanned oxygenator carried the payload's only textures; its
    // procedural replacement (B7 follow-up) retired them, so every asset is
    // plain-PBR and the whole payload rides on geometry alone.
    for (const name of RUNTIME_ASSETS) {
      expect(readGlb(name).json.images ?? []).toHaveLength(0)
    }
  })
})

describe('the B7 patient mannequin', () => {
  const doc = readGlb('patient-femoral-access.glb')

  it('carries its full material set with no null slot', () => {
    // Regression: the previous asset exported the drape's faces pointing at a
    // null slot, so the authored surgical teal rendered as default white.
    const names = (doc.json.materials ?? []).map((material) => material.name)
    expect(names).toEqual(
      expect.arrayContaining(['patient_skin', 'hospital_linen', 'surgical_cap', 'sterile_drape']),
    )
    for (const mesh of doc.json.meshes) {
      for (const primitive of mesh.primitives) {
        expect(primitive.material).toBeDefined()
      }
    }
  })

  it('lies supine along z and settles onto the mattress', () => {
    const { min, max } = positionBounds(doc)
    // Supine: long axis z, thin axis y.
    expect(max[2] - min[2]).toBeGreaterThan(1.6)
    expect(max[1] - min[1]).toBeLessThan(0.35)
    // Dorsal plane vs the bed: PATIENT_POSITION drops the deepest dorsal
    // point just below the mattress top (-0.495), reading as compression
    // rather than a hover — the old asset floated 4-6 cm above the bed.
    const dorsalWorld = PATIENT_POSITION[1] + min[1] * PATIENT_SCALE
    expect(dorsalWorld).toBeLessThan(-0.48)
    expect(dorsalWorld).toBeGreaterThan(-0.54)
  })

  it.each(['vv', 'va'] as const)(
    'anchors every %s access site on the skin surface it dresses',
    (mode) => {
      const layout = buildCircuitLayout(mode)
      const vertexArrays = positions(doc)
      // Anchor world position -> patient-local (invert patientWorldPoint).
      const toLocal = (world: { x: number; y: number; z: number }) => ({
        x: (world.x - PATIENT_POSITION[0]) / PATIENT_SCALE,
        y: (world.y - PATIENT_POSITION[1]) / PATIENT_SCALE,
        z: (world.z - PATIENT_POSITION[2]) / PATIENT_SCALE,
      })
      const skinHeightNear = (x: number, z: number) => {
        let highest = -Infinity
        for (const array of vertexArrays) {
          for (let index = 0; index < array.length; index += 3) {
            const dx = array[index] - x
            const dz = array[index + 2] - z
            if (dx * dx + dz * dz < 0.02 * 0.02) {
              highest = Math.max(highest, array[index + 1])
            }
          }
        }
        return highest
      }
      for (const site of [layout.drainageSite, layout.returnSite]) {
        const local = toLocal(site.position)
        const skin = skinHeightNear(local.x, local.z)
        expect(skin).toBeGreaterThan(-Infinity)
        // On the skin: a few millimetres proud so the dressing film sits on
        // top, never buried below the surface, never floating.
        // The 0.02 m sample disc can catch the raised drape-window rim beside
        // the site, so the ceiling is rim-height, not bare-skin height.
        expect(local.y - skin).toBeGreaterThan(-0.04)
        expect(local.y - skin).toBeLessThan(0.02)
      }
    },
  )

  it('keeps the VA distal perfusion catheter over the thigh, not in the air', () => {
    const layout = buildCircuitLayout('va')
    expect(layout.dpc).not.toBeNull()
    const points = layout.dpc!.getSpacedPoints(24)
    for (const point of points) {
      const localX = (point.x - PATIENT_POSITION[0]) / PATIENT_SCALE
      const localY = (point.y - PATIENT_POSITION[1]) / PATIENT_SCALE
      const localZ = (point.z - PATIENT_POSITION[2]) / PATIENT_SCALE
      // Right thigh corridor, between skin and ~7 cm above it.
      expect(localX).toBeGreaterThan(0.1)
      expect(localX).toBeLessThan(0.23)
      expect(localZ).toBeGreaterThan(0.05)
      expect(localZ).toBeLessThan(0.5)
      expect(localY).toBeGreaterThan(0.05)
      expect(localY).toBeLessThan(0.16)
    }
  })
})

describe('the B7 HLS module and sweep-gas blender', () => {
  it('oxygenator ships the procedural HLS material set', () => {
    const doc = readGlb('oxygenator.glb')
    const names = (doc.json.materials ?? []).map((material) => material.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'hls_clear_housing',
        'hls_fiber_bundle',
        'hls_red',
        'hls_label_white',
        'hls_stopcock_blue',
      ]),
    )
  })

  it('blender stands pole-height on the floor with its outlet inside its bounds', () => {
    const { min, max } = positionBounds(readGlb('sweep-gas-blender.glb'))
    // Standing asset: base at y~0, pole ~1.4 m tall.
    expect(min[1]).toBeGreaterThan(-0.05)
    expect(min[1]).toBeLessThan(0.02)
    expect(max[1]).toBeGreaterThan(1.2)
    expect(max[1]).toBeLessThan(1.6)
    // The sweep line's origin (BLENDER_OUTLET_LOCAL) must be a point ON the
    // asset, not floating beside it.
    const [ox, oy, oz] = BLENDER_OUTLET_LOCAL
    expect(ox).toBeGreaterThan(min[0] - 0.01)
    expect(ox).toBeLessThan(max[0] + 0.01)
    expect(oy).toBeGreaterThan(min[1])
    expect(oy).toBeLessThan(max[1])
    expect(oz).toBeGreaterThan(min[2] - 0.01)
    expect(oz).toBeLessThan(max[2] + 0.01)
  })
})

describe('the B7 console and clamp', () => {
  it('console ships its seven named materials and no textures', () => {
    const doc = readGlb('cardiohelp-console.glb')
    const names = (doc.json.materials ?? []).map((material) => material.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'console_body',
        'console_cage',
        'console_metal',
        'console_screen',
        'console_panel',
        'console_knob',
        'console_red',
      ]),
    )
    expect(doc.json.images ?? []).toHaveLength(0)
  })

  it('clamp jaws span the circuit tubing they clamp', () => {
    // The previous clamp's 0.048 m jaw span could not straddle the 0.08 m
    // tube OD, so the instrument hovered beside the tube it claimed to close.
    const { min, max } = positionBounds(readGlb('circuit-clamp.glb'))
    const jawSpan = max[1] - min[1]
    expect(jawSpan).toBeGreaterThan(TUBE_RADII.circuitWall * 2)
  })
})

describe('anchor helpers stay consistent', () => {
  it('patientWorldPoint round-trips the anchor frame used by the contracts', () => {
    const world = patientWorldPoint(0.1, 0.2, 0.3)
    expect((world.x - PATIENT_POSITION[0]) / PATIENT_SCALE).toBeCloseTo(0.1, 6)
    expect((world.y - PATIENT_POSITION[1]) / PATIENT_SCALE).toBeCloseTo(0.2, 6)
    expect((world.z - PATIENT_POSITION[2]) / PATIENT_SCALE).toBeCloseTo(0.3, 6)
  })
})
