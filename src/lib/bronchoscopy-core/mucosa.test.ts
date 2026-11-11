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
  MUCOSA_PALE_WALL_DEFINE,
  mucosaFragmentShader,
  mucosaVertexShader,
} from './mucosa'

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')
/** What a compiler sees when `MUCOSA_ANATOMY` is not defined: every such block removed. */
const withoutAnatomy = (source: string) =>
  source.replace(/^#ifdef MUCOSA_ANATOMY\n[\s\S]*?^#endif\n/gm, '')

/** What a compiler sees when `MUCOSA_PALE_WALL` is not defined: each such block's `#else` branch. */
const withoutPaleWall = (source: string) =>
  source
    .replace(/^  #ifdef MUCOSA_PALE_WALL\n[\s\S]*?^  #else\n([\s\S]*?)^  #endif\n/gm, '$1')
    .replace(/^#ifdef MUCOSA_ANATOMY\n#endif\n/gm, '')

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

  it('is the anatomy shader, character for character, when the pale wall is not asked for', () => {
    // The anatomy shader as the EBUS white-light view was merged with it. Bronchoscopy
    // Foundations' paler wall is a second opt-in; a change to this hash changes the EBUS picture.
    expect(sha256(withoutPaleWall(mucosaFragmentShader))).toBe(
      '70d9aee4cc273cd59f22a6d409b4bd253c4116e48a944ff24f9b40f12f25e1c9',
    )
    expect(mucosaVertexShader).not.toContain(MUCOSA_PALE_WALL_DEFINE)
    // Every pale-wall directive is nested and indented, so the anatomy blocks still strip whole.
    expect(withoutAnatomy(mucosaFragmentShader)).not.toContain(MUCOSA_PALE_WALL_DEFINE)
    expect(mucosaFragmentShader).not.toMatch(/^#ifdef MUCOSA_PALE_WALL/m)
  })

  it('defines the pale wall only with the anatomy, and only when asked', () => {
    const anatomy = createBronchoscopyMaterial(undefined, { anatomy: true })
    expect(anatomy.defines).not.toHaveProperty(MUCOSA_PALE_WALL_DEFINE)
    const pale = createBronchoscopyMaterial(undefined, { anatomy: true, paleWall: true })
    expect(pale.defines).toHaveProperty(MUCOSA_ANATOMY_DEFINE)
    expect(pale.defines).toHaveProperty(MUCOSA_PALE_WALL_DEFINE)
    const alone = createBronchoscopyMaterial(undefined, { paleWall: true })
    expect(alone.defines ?? {}).not.toHaveProperty(MUCOSA_PALE_WALL_DEFINE)
    for (const material of [anatomy, pale, alone]) material.dispose()
  })
})
