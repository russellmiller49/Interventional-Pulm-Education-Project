import {
  BufferGeometry,
  Float32BufferAttribute,
  type BufferAttribute,
  type InterleavedBufferAttribute,
} from 'three'

/**
 * The drawn lung at one of its states. The lung-states file holds the expanded lung and each step as
 * a morph target (slice 8), with the expanded lung's normals only, so a scene that shows another step
 * must work its normals out again. Each step is made once, as its own geometry, positions resolved
 * and normals computed, and swapped in when the engine's lung steps: the scene draws exactly the
 * step the engine answers for.
 */
type Attribute = BufferAttribute | InterleavedBufferAttribute

function resolved(base: Attribute, target: Attribute | null, relative: boolean): Float32Array {
  const out = new Float32Array(base.count * 3)
  for (let i = 0; i < base.count; i += 1) {
    const x = base.getX(i)
    const y = base.getY(i)
    const z = base.getZ(i)
    if (!target) {
      out.set([x, y, z], i * 3)
    } else if (relative) {
      out.set([x + target.getX(i), y + target.getY(i), z + target.getZ(i)], i * 3)
    } else {
      out.set([target.getX(i), target.getY(i), target.getZ(i)], i * 3)
    }
  }
  return out
}

/** The geometry of the lung at `step`: 0 is the expanded lung, k the morph target "step k". */
export function lungGeometryAt(
  source: BufferGeometry,
  step: number,
  targetNames: readonly string[],
): BufferGeometry {
  const base = source.getAttribute('position')
  const targets = source.morphAttributes.position ?? []
  const index = step === 0 ? -1 : targetNames.indexOf(`step ${step}`)
  if (step !== 0 && (index < 0 || !targets[index]))
    throw new Error(`The lung has no state for step ${step}`)
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      resolved(base, index < 0 ? null : targets[index], source.morphTargetsRelative),
      3,
    ),
  )
  const order = source.getIndex()
  if (order) geometry.setIndex(order.clone())
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

/** Every step's geometry, made once for a source geometry and kept. */
export function lungGeometries(
  source: BufferGeometry,
  targetNames: readonly string[],
  steps: number,
): BufferGeometry[] {
  return Array.from({ length: steps }, (_, step) => lungGeometryAt(source, step, targetNames))
}
