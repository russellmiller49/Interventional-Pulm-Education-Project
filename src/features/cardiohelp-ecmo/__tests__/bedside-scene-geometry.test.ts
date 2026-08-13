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
 * Owner smoke test, 2026-08-06: the CARDIOHELP rested on its *top* — the pump drive and connectors
 * faced the sky — and the "Sweep gas" pill sat on the console body, because the sweep curve started
 * inside the console's own volume. The `CARDIOHELP console` pill floated 0.39 m clear of the model
 * it named and drifted into the HLS module's labels.
 *
 * **Which way up is not settled here.** The first attempt at this fix leaned on measured geometry —
 * flat contact area, support-footprint span, mass distribution — and every one of those metrics
 * pointed at the wrong face, because the asset is a body inside a tubular cage and the cage
 * dominates all of them. It shipped a second wrong orientation. Orientation is settled by rendering
 * the candidates and looking, and the owner is the arbiter.
 *
 * What these contracts do hold is everything that follows once the orientation is chosen: the
 * transformed box on the floor, the model bounds against the shipped GLB, and each label against
 * the object it names.
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
function readGlb(path: string): { json: GlbJson } {
  const buffer = readFileSync(path)
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  expect(view.getUint32(0, true)).toBe(0x46546c67) // 'glTF'

  let offset = 12
  let json: GlbJson | null = null
  while (offset < buffer.byteLength) {
    const chunkLength = view.getUint32(offset, true)
    const chunkType = view.getUint32(offset + 4, true)
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(buffer.subarray(offset + 8, offset + 8 + chunkLength).toString('utf8'))
      break
    }
    // 8-byte chunk header (length + type). The 12 is the *file* header.
    offset += 8 + chunkLength
  }
  if (!json) throw new Error('GLB is missing its JSON chunk')
  return { json }
}

interface GlbJson {
  meshes: { primitives: { attributes: Record<string, number> }[] }[]
  accessors: { min?: number[]; max?: number[] }[]
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

  it("puts the asset's authored base on the floor", () => {
    // The physical claim, not the raw number: the model's authored base faces the ground. The B7
    // console (build_fidelity_assets.py) is authored upright — base on local −Y — so the placement
    // must keep −Y pointing down; the legacy scan was authored base-up and needed a flip about X.
    const down = new THREE.Vector3(0, -1, 0).applyEuler(
      new THREE.Euler(...CONSOLE_PLACEMENT.rotation),
    )
    expect(down.y).toBeLessThan(-0.99)
  })

  it('rests exactly on the floor once rotated and scaled', () => {
    expect(consolePlacement.worldBounds.min.y).toBeCloseTo(FLOOR_Y, 6)
  })

  it('stands taller than it is wide, and clears the bed', () => {
    // Upright: the 0.945 m axis is the height. Compared against the MODEL's own footprint, not the
    // yawed world AABB — a yaw inflates the axis-aligned depth (0.786 m becomes ~0.97 m at 20°),
    // which says nothing about which way up the unit stands.
    const size = consolePlacement.worldBounds.getSize(new THREE.Vector3())
    const modelExtent = (axis: number) =>
      CONSOLE_MODEL_BOUNDS.max[axis] - CONSOLE_MODEL_BOUNDS.min[axis]
    expect(size.y).toBeCloseTo(modelExtent(1), 3)
    expect(modelExtent(1)).toBeGreaterThan(modelExtent(0))
    expect(modelExtent(1)).toBeGreaterThan(modelExtent(2))
    expect(consolePlacement.worldBounds.max.y).toBeGreaterThan(-0.56)
  })

  it('keeps its top below the HLS module it carries', () => {
    /*
     * There is no verified "display face" normal to assert against — the panel identified as the
     * display during the first attempt at this fix turned out not to be one, and asserting a face
     * whose identity is not established is how that attempt shipped the wrong orientation. What is
     * checkable is the relationship the scene depends on: the disposable sits on the console.
     */
    const layout = buildCircuitLayout('vv')
    expect(layout.consoleBounds.max.y).toBeLessThan(layout.hlsModulePosition.y + 0.3)
    expect(layout.consoleHolderAnchor.y).toBeLessThan(layout.consoleBounds.max.y)
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
    // The pole-mounted air/O2 blender is modelled now (B7 follow-up), so the
    // label names the device. Before it existed the label deliberately named
    // only "the line and its connection" — naming a device that was not there
    // was this suite's original defect.
    expect(sweepLabel?.text).toBe('Air–O₂ blender — sweep-gas source')
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
