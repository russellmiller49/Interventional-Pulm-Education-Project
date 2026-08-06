import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as THREE from 'three'

import {
  CONSOLE_MODEL_BOUNDS,
  CONSOLE_PLACEMENT,
  FLOOR_Y,
} from '../components/ecmo-circuit/constants'
import { groundAsset, transformedBounds } from '../components/ecmo-circuit/grounding'
import { buildCircuitLayout, consolePlacement } from '../components/ecmo-circuit/layout'

/**
 * The bedside console has to stand on its base, and the labels have to name what they point at.
 *
 * Owner smoke test, 2026-08-06: the CARDIOHELP lay on its display face with the pump-drive side to
 * the sky, and the "Sweep gas" pill sat on the console body — because the sweep curve *started
 * inside the console's own volume*. The `CARDIOHELP console` pill meanwhile floated 0.70 m above
 * the model it named and drifted into the HLS module's labels.
 *
 * These are geometry contracts, not pixels: they pin the transformed box on the floor, each label
 * against the object it names, and the model-local bounds against the shipped GLB — so a future
 * placement change that re-breaks any of it fails here rather than in someone's screenshot.
 */

const GLB_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'public',
  'models',
  'cardiohelp-ecmo',
  'cardiohelp-console.glb',
)

/**
 * The GLB's own POSITION accessor bounds, read with a zero-dependency chunk walk.
 *
 * `CONSOLE_MODEL_BOUNDS` is authored in constants so `layout.ts` and the node harness can compute
 * label anchors without loading a mesh. That is only safe if it keeps matching the shipped asset.
 */
function readGlb(path: string): { json: GlbJson; bin: Buffer } {
  const buffer = readFileSync(path)
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  expect(view.getUint32(0, true)).toBe(0x46546c67) // 'glTF'

  let offset = 12
  let json: GlbJson | null = null
  let bin: Buffer | null = null
  while (offset < buffer.byteLength) {
    const chunkLength = view.getUint32(offset, true)
    const chunkType = view.getUint32(offset + 4, true)
    const body = buffer.subarray(offset + 8, offset + 8 + chunkLength)
    if (chunkType === 0x4e4f534a) json = JSON.parse(body.toString('utf8')) as GlbJson
    if (chunkType === 0x004e4942) bin = body
    // 8-byte chunk header (length + type), not 12. The 12 is the *file* header, and the original
    // walk got away with it only because it stopped at the first chunk.
    offset += 8 + chunkLength
  }
  if (!json || !bin) throw new Error('GLB is missing its JSON or BIN chunk')
  return { json, bin }
}

interface GlbJson {
  meshes: { primitives: { attributes: Record<string, number>; indices?: number }[] }[]
  accessors: {
    bufferView: number
    componentType: number
    count: number
    type: string
    min?: number[]
    max?: number[]
    byteOffset?: number
  }[]
  bufferViews: { buffer: number; byteOffset?: number; byteLength: number }[]
}

function glbPositionBounds(path: string): { min: number[]; max: number[] } {
  const { json } = readGlb(path)

  const { meshes, accessors } = json
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const mesh of meshes) {
    for (const primitive of mesh.primitives) {
      const accessor = accessors[primitive.attributes.POSITION]
      if (!accessor.min || !accessor.max) continue
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], accessor.min[axis])
        max[axis] = Math.max(max[axis], accessor.max[axis])
      }
    }
  }
  return { min, max }
}

/**
 * Flat, floor-facing surface area at the bottom of the asset once a rotation is applied.
 *
 * This is what "which face is the base" actually means: a device that stands has a broad flat
 * plate at its lowest extreme whose normal points at the floor. Measured from the shipped mesh, so
 * the assertion is about the asset rather than about the constant that positions it.
 */
function floorContactArea(path: string, rotation: readonly [number, number, number]): number {
  const { json, bin } = readGlb(path)
  const matrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation))

  const points: THREE.Vector3[] = []
  const triangles: [number, number, number][] = []
  for (const mesh of json.meshes) {
    for (const primitive of mesh.primitives) {
      const base = points.length
      const position = json.accessors[primitive.attributes.POSITION]
      const positionView = json.bufferViews[position.bufferView]
      const positionStart = (positionView.byteOffset ?? 0) + (position.byteOffset ?? 0)
      for (let i = 0; i < position.count; i += 1) {
        const at = positionStart + i * 12
        points.push(
          new THREE.Vector3(
            bin.readFloatLE(at),
            bin.readFloatLE(at + 4),
            bin.readFloatLE(at + 8),
          ).applyMatrix4(matrix),
        )
      }
      if (primitive.indices === undefined) throw new Error('expected indexed geometry')
      const index = json.accessors[primitive.indices]
      const indexView = json.bufferViews[index.bufferView]
      const indexStart = (indexView.byteOffset ?? 0) + (index.byteOffset ?? 0)
      // 5123 = UNSIGNED_SHORT, 5125 = UNSIGNED_INT.
      const width = index.componentType === 5125 ? 4 : 2
      const read = (at: number) =>
        width === 4 ? bin.readUInt32LE(indexStart + at * 4) : bin.readUInt16LE(indexStart + at * 2)
      for (let i = 0; i < index.count; i += 3) {
        triangles.push([base + read(i), base + read(i + 1), base + read(i + 2)])
      }
    }
  }

  const box = new THREE.Box3().setFromPoints(points)
  const band = (box.max.y - box.min.y) * 0.04
  const down = new THREE.Vector3(0, -1, 0)
  let area = 0
  for (const [i0, i1, i2] of triangles) {
    const a = points[i0]
    const b = points[i1]
    const c = points[i2]
    const cross = new THREE.Vector3().crossVectors(
      new THREE.Vector3().subVectors(b, a),
      new THREE.Vector3().subVectors(c, a),
    )
    const size = cross.length() / 2
    if (size <= 0) continue
    if ((a.y + b.y + c.y) / 3 - box.min.y > band) continue
    if (cross.normalize().dot(down) < 0.85) continue
    area += size
  }
  return area
}

function labelPosition(mode: 'vv' | 'va', id: string): THREE.Vector3 {
  const label = buildCircuitLayout(mode).labels.find((item) => item.id === id)
  if (!label) throw new Error(`No scene label ${id}`)
  return label.position
}

describe('the grounding helper accounts for the whole transform', () => {
  const bounds = { min: [-1, -2, -3], max: [1, 2, 3] } as const

  it('measures the rotated box, not the authored one', () => {
    const upright = transformedBounds(bounds, { rotation: [0, 0, 0], scale: 1 })
    expect(upright.min.y).toBeCloseTo(-2)

    // Rolled a quarter turn about Z, the 3-unit Y half-extent becomes the X half-extent and the
    // 1-unit X half-extent becomes Y. Grounding on the unrotated box would be wrong by 1 unit.
    const rolled = transformedBounds(bounds, { rotation: [0, 0, Math.PI / 2], scale: 1 })
    expect(rolled.min.y).toBeCloseTo(-1)
    expect(rolled.min.x).toBeCloseTo(-2)
  })

  it('scales the transformed box, not the authored one', () => {
    const scaled = transformedBounds(bounds, { rotation: [0, 0, Math.PI / 2], scale: 2 })
    expect(scaled.min.y).toBeCloseTo(-2)
  })

  it('rests any rotated asset exactly on the floor', () => {
    for (const rotation of [
      [0, 0, 0],
      [0, -0.35, Math.PI / 2],
      [Math.PI / 2, 0.8, 0],
      [0.3, 0.2, 0.1],
    ] as const) {
      const { origin, worldBounds } = groundAsset(bounds, { x: 4, z: -2, rotation, scale: 1.4 }, -5)
      expect(worldBounds.min.y).toBeCloseTo(-5)
      expect(origin.x).toBe(4)
      expect(origin.z).toBe(-2)
    }
  })
})

describe('the console model and its placement', () => {
  it('matches the bounds of the shipped GLB', () => {
    const actual = glbPositionBounds(GLB_PATH)
    for (let axis = 0; axis < 3; axis += 1) {
      expect(CONSOLE_MODEL_BOUNDS.min[axis]).toBeCloseTo(actual.min[axis], 3)
      expect(CONSOLE_MODEL_BOUNDS.max[axis]).toBeCloseTo(actual.max[axis], 3)
    }
  })

  it('stands the asset on a real flat base, measured from the shipped mesh', () => {
    /*
     * Measured, not restated. This is the area of triangles in the bottom 4% of the rotated asset
     * whose normals point at the floor — a device that stands has a broad plate there, and one
     * resting on its display face does not. Asserting `rotation[2] === π/2` would only have
     * restated the constant it was meant to justify.
     */
    const standing = floorContactArea(GLB_PATH, CONSOLE_PLACEMENT.rotation)
    const asShipped = floorContactArea(GLB_PATH, [0, CONSOLE_PLACEMENT.rotation[1], 0])

    expect(standing).toBeGreaterThan(0.1)
    expect(standing).toBeGreaterThan(asShipped * 1.5)
  })

  it('rests exactly on the floor once rotated and scaled', () => {
    expect(consolePlacement.worldBounds.min.y).toBeCloseTo(FLOOR_Y, 6)
  })

  it('is a plausible standing device, not a box lying down', () => {
    const size = consolePlacement.worldBounds.getSize(new THREE.Vector3())
    // Wider and deeper than it is tall, and short enough that the HLS module sits above it. Lying
    // on the display face made the console the tallest thing at the bedside.
    expect(size.y).toBeLessThan(0.75)
    expect(size.x).toBeGreaterThan(size.y)
    expect(size.z).toBeGreaterThan(size.y)
    expect(consolePlacement.worldBounds.max.y).toBeLessThan(0)
  })

  it('points its display face at the default camera', () => {
    // Normal of the asset's largest angled panel, measured from the mesh.
    const displayNormal = new THREE.Vector3(0, -0.594, 0.805)
      .normalize()
      .applyEuler(new THREE.Euler(...CONSOLE_PLACEMENT.rotation))
    const centre = consolePlacement.worldBounds.getCenter(new THREE.Vector3())
    const toCamera = new THREE.Vector3(4.4, 2.75, 5.25).sub(centre).normalize()
    expect(displayNormal.dot(toCamera)).toBeGreaterThan(0.6)
  })
})

describe.each(['vv', 'va'] as const)('%s scene labels name what they point at', (mode) => {
  const layout = buildCircuitLayout(mode)
  const consoleBox = layout.consoleBounds

  it('puts the console label on the console', () => {
    const label = labelPosition(mode, 'console')
    // Directly over the console footprint, and close above its top rather than adrift.
    expect(label.x).toBeGreaterThan(consoleBox.min.x)
    expect(label.x).toBeLessThan(consoleBox.max.x)
    expect(label.z).toBeGreaterThan(consoleBox.min.z)
    expect(label.z).toBeLessThan(consoleBox.max.z)
    expect(label.y - consoleBox.max.y).toBeGreaterThan(0)
    expect(label.y - consoleBox.max.y).toBeLessThan(0.35)
  })

  it('puts the sweep label on the start of the sweep line, and nowhere near the console', () => {
    const label = labelPosition(mode, 'sweep')
    const source = layout.sweepLine.getPoint(0)

    expect(label.distanceTo(source)).toBeLessThan(0.4)
    // The defect: the sweep source used to sit inside the console's own volume, so the pill landed
    // on the console and read as naming it.
    expect(consoleBox.containsPoint(source)).toBe(false)
    expect(consoleBox.containsPoint(label)).toBe(false)
  })

  it('never calls the console a gas source', () => {
    const consoleLabel = layout.labels.find((label) => label.id === 'console')
    const sweepLabel = layout.labels.find((label) => label.id === 'sweep')
    expect(consoleLabel?.text).toBe('CARDIOHELP console')
    expect(consoleLabel?.text).not.toMatch(/sweep|gas/i)
    // No modelled blender or wall outlet, so the label names the line and its connection.
    expect(sweepLabel?.text).toBe('Sweep-gas line / source connection')
  })

  it('keeps the console and sweep labels apart', () => {
    expect(labelPosition(mode, 'console').distanceTo(labelPosition(mode, 'sweep'))).toBeGreaterThan(
      0.5,
    )
  })

  it('gives every label a distinct id and a distinct anchor', () => {
    const ids = layout.labels.map((label) => label.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const first of layout.labels) {
      for (const second of layout.labels) {
        if (first.id === second.id) continue
        expect(first.position.distanceTo(second.position)).toBeGreaterThan(0.08)
      }
    }
  })

  it('routes the sweep line clear of the console body', () => {
    /*
     * Tested against the console's *oriented* box, not its world AABB.
     *
     * The unit is yawed, so its axis-aligned box includes two empty corners the tubing may pass
     * through quite legitimately. What must never happen is the line entering the device itself.
     */
    const toConsoleLocal = new THREE.Matrix4()
      .compose(
        layout.consoleOrigin,
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...CONSOLE_PLACEMENT.rotation)),
        new THREE.Vector3().setScalar(CONSOLE_PLACEMENT.scale),
      )
      .invert()
    const local = new THREE.Box3(
      new THREE.Vector3(...CONSOLE_MODEL_BOUNDS.min),
      new THREE.Vector3(...CONSOLE_MODEL_BOUNDS.max),
    )
    const inside = layout.sweepLine
      .getSpacedPoints(96)
      .filter((point) => local.containsPoint(point.clone().applyMatrix4(toConsoleLocal)))
    expect(inside).toHaveLength(0)
  })

  it('hands out its own console geometry rather than one shared object', () => {
    // `consolePlacement` is computed once at module load. Returning that same Box3 to every layout
    // would let one consumer's `translate` silently move the console for every other consumer.
    const other = buildCircuitLayout(mode === 'vv' ? 'va' : 'vv')
    const before = other.consoleBounds.max.y
    layout.consoleBounds.clone().translate(new THREE.Vector3(0, 5, 0))
    buildCircuitLayout(mode).consoleBounds.translate(new THREE.Vector3(0, 5, 0))
    expect(other.consoleBounds.max.y).toBeCloseTo(before)
    expect(layout.consoleBounds.max.y).toBeCloseTo(before)
  })

  it('lands the HLS holder arm on the console rather than in mid-air', () => {
    const anchor = layout.consoleHolderAnchor
    expect(anchor.y).toBeLessThan(consoleBox.max.y)
    expect(anchor.y).toBeGreaterThan(consoleBox.min.y)
    expect(consoleBox.max.y - anchor.y).toBeLessThan(0.2)
    expect(anchor.x).toBeGreaterThan(consoleBox.min.x)
    expect(anchor.x).toBeLessThan(consoleBox.max.x)
  })
})
