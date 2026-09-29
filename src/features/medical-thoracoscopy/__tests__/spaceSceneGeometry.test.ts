/** @jest-environment node */
import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'

import { lungGeometries, lungGeometryAt } from '../components/space/scene/lungGeometry'

/**
 * The drawn lung at each step (slice 11): the file keeps each step as a morph target and the expanded
 * lung's normals only, so the scene resolves each step's positions and works its normals out again.
 */

// One triangle facing +z at the start; step 1 tips it to face −x; step 2 moves it along z.
function source(relative: boolean): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3))
  geometry.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2]), 1))
  const tipped = relative ? [0, 0, 0, -1, 0, 1, 0, 0, 0] : [0, 0, 0, 0, 0, 1, 0, 1, 0]
  const moved = relative ? [0, 0, 5, 0, 0, 5, 0, 0, 5] : [0, 0, 5, 1, 0, 5, 0, 1, 5]
  geometry.morphAttributes.position = [
    new Float32BufferAttribute(tipped, 3),
    new Float32BufferAttribute(moved, 3),
  ]
  geometry.morphTargetsRelative = relative
  return geometry
}

const normalOf = (geometry: BufferGeometry) =>
  new Vector3().fromBufferAttribute(geometry.getAttribute('normal') as BufferAttribute, 0)

describe('the lung at each step', () => {
  it.each([
    ['relative', true],
    ['absolute', false],
  ] as const)('resolves %s morph targets and works the normals out again', (_, relative) => {
    const names = ['step 1', 'step 2']
    const [expanded, tipped, moved] = lungGeometries(source(relative), names, 3)
    expect(Array.from(expanded.getAttribute('position').array)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0])
    expect(normalOf(expanded).toArray()).toEqual([0, 0, 1])
    expect(Array.from(tipped.getAttribute('position').array)).toEqual([0, 0, 0, 0, 0, 1, 0, 1, 0])
    expect(normalOf(tipped).x).toBeCloseTo(-1, 9)
    expect(Array.from(moved.getAttribute('position').array)).toEqual([0, 0, 5, 1, 0, 5, 0, 1, 5])
    expect(normalOf(moved).toArray()).toEqual([0, 0, 1])
    expect(moved.getIndex()?.array).toEqual(new Uint16Array([0, 1, 2]))
  })

  it('finds each step by its name, not by its place in the file', () => {
    const geometry = lungGeometryAt(source(true), 1, ['step 2', 'step 1'])
    // "step 1" is the file's second target here: the one that moves the triangle along z
    expect(Array.from(geometry.getAttribute('position').array)).toEqual([0, 0, 5, 1, 0, 5, 0, 1, 5])
  })

  it('refuses a step the file does not hold', () => {
    expect(() => lungGeometryAt(source(true), 3, ['step 1', 'step 2'])).toThrow(
      /no state for step 3/,
    )
  })
})
