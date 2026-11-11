/** @jest-environment node */
import { createHash } from 'node:crypto'

// airway-render also loads meshes; its three.js loaders are ES modules this suite does not need.
jest.mock('three/examples/jsm/loaders/DRACOLoader.js', () => ({ DRACOLoader: class {} }))
jest.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({ GLTFLoader: class {} }))
jest.mock('three/examples/jsm/loaders/STLLoader.js', () => ({ STLLoader: class {} }))
jest.mock('three/examples/jsm/utils/BufferGeometryUtils.js', () => ({ mergeVertices: jest.fn() }))

import {
  createBronchoscopyMaterial,
  tintedMucosaFragmentShader,
} from '../airway-anatomy/airway-render'
import {
  MUCOSA_ANATOMY_ATTRIBUTE,
  MUCOSA_ANATOMY_DEFINE,
  mucosaFragmentShader,
  mucosaVertexShader,
} from './mucosa'

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')
/** What a compiler sees when `MUCOSA_ANATOMY` is not defined: every such block removed. */
const withoutAnatomy = (source: string) =>
  source.replace(/^#ifdef MUCOSA_ANATOMY\n[\s\S]*?^#endif\n/gm, '')

describe('shared mucosa shader', () => {
  it('is the shared shader, character for character, when the anatomy define is absent', () => {
    // The shader every scope viewer drew before the wall anatomy was added. A change to these
    // two hashes is a change to every viewer's picture, not only to the one that opted in.
    expect(sha256(withoutAnatomy(mucosaVertexShader))).toBe(
      'ab2bdced08f1c64a67d570a6d20914f7265b06930c5129c678de95fb06449a0e',
    )
    expect(sha256(withoutAnatomy(mucosaFragmentShader))).toBe(
      '28c654488f6ec59c6dd9dc5d3edf55fb3697ac7218176160015efc076beb08f2',
    )
  })

  it('keeps every anatomy line inside an anatomy block', () => {
    for (const source of [mucosaVertexShader, mucosaFragmentShader]) {
      expect(source).toContain(`#ifdef ${MUCOSA_ANATOMY_DEFINE}`)
      const shared = withoutAnatomy(source)
      expect(shared).not.toContain(MUCOSA_ANATOMY_DEFINE)
      expect(shared).not.toMatch(/AirwayWall|airwayWallAnatomy|\bwall\b/)
    }
    expect(mucosaVertexShader).toContain(`attribute vec4 ${MUCOSA_ANATOMY_ATTRIBUTE};`)
  })

  it('defines the anatomy only for a material that asks for it', () => {
    const shared = createBronchoscopyMaterial()
    expect(shared.defines ?? {}).not.toHaveProperty(MUCOSA_ANATOMY_DEFINE)
    expect(shared.fragmentShader).toBe(mucosaFragmentShader)

    const tint = { low: [0.3, 0.2, 0.2], high: [0.6, 0.5, 0.5] } as const
    const tinted = createBronchoscopyMaterial(tint)
    expect(tinted.defines ?? {}).not.toHaveProperty(MUCOSA_ANATOMY_DEFINE)
    // A case's own tones still replace the base line, which the anatomy blocks leave alone.
    expect(tinted.fragmentShader).toBe(tintedMucosaFragmentShader(tint))
    expect(tinted.fragmentShader).toContain('vec3 base=mix(vec3(0.300,0.200,0.200)')
    expect(tinted.fragmentShader).not.toContain('vec3(0.51,0.205,0.19)')

    const anatomy = createBronchoscopyMaterial(undefined, { anatomy: true })
    expect(anatomy.defines).toHaveProperty(MUCOSA_ANATOMY_DEFINE)
    expect(anatomy.fragmentShader).toBe(mucosaFragmentShader)
    for (const material of [shared, tinted, anatomy]) material.dispose()
  })
})
