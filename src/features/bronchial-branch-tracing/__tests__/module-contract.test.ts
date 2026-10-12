import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { metadata } from '../../../app/[locale]/learn/anatomy/branch-tracing/layout'
import { betaModuleById, betaModuleForPath } from '@/features/module-beta/catalog'
import { isVisibleModulePath } from '@/lib/draft-modules'
import {
  isHiddenFromNavigation,
  moduleAccessMode,
  nonPublicModules,
} from '@/lib/non-public-modules'
import { isPublicPath, isPublicUnlistedPath } from '@/lib/site-auth/access'
import { BASE_PATH, SOURCE, lessonHref } from '../content/module'
import { count, displayName, displayOptionLabel } from '../engine/display-text'
import {
  directionError,
  displayPoint,
  lpsToRas,
  transformPoint,
  undisplayPoint,
} from '../geometry/coordinates'
import { CT_TARGETS, CT_TRACES, traceById } from '../geometry/native-ct'

/**
 * What the module promises the rest of the site and the files it ships: its address and access
 * tier, that it stays out of search, and that its public assets are the recorded ones. Carried over
 * from the suites that held these before the navigation rebuild (contracts, self-paced and
 * teaching-route-flow).
 */
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex')

describe('address, access and indexing', () => {
  test('the pages are anonymous and unlisted in every locale, and stay out of navigation', () => {
    expect(BASE_PATH).toBe('/learn/anatomy/branch-tracing')
    for (const locale of ['en', 'es', 'zh-CN'])
      for (const suffix of ['', '/learn', '/practice', '/assess']) {
        const path = `/${locale}${BASE_PATH}${suffix}`
        expect(isPublicPath(path)).toBe(true)
        expect(isPublicUnlistedPath(path)).toBe(true)
        expect(isVisibleModulePath(path, { isAdmin: true })).toBe(false)
      }
    // A neighbouring address is not the module's.
    expect(isPublicPath('/learn/anatomy/branch-tracing-other')).toBe(false)
    expect(isPublicUnlistedPath('/learn/anatomy/branch-tracing-other')).toBe(false)
  })

  test('it is registered once as a non-public module and once in the beta catalog, at its own address', () => {
    const listed = nonPublicModules.filter((entry) => entry.path === BASE_PATH)
    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({ title: 'Bronchial Branch Tracing', group: 'Bronchoscopy' })
    expect(listed[0].summary.trim().length).toBeGreaterThan(0)
    expect(moduleAccessMode(BASE_PATH)).toBe('direct-link')
    expect(isHiddenFromNavigation(BASE_PATH)).toBe(true)
    const beta = betaModuleById('branch-tracing')!
    expect(beta).toMatchObject({ path: BASE_PATH, title: 'Bronchial Branch Tracing' })
    for (const suffix of ['', '/learn', '/practice', '/assess'])
      expect(betaModuleForPath(`/en${BASE_PATH}${suffix}`)?.id).toBe('branch-tracing')
    // Its public assets belong to the same beta module.
    expect(betaModuleForPath('/branch-tracing/native-v1/axial/372.png')?.id).toBe('branch-tracing')
    expect(betaModuleForPath('/learn/anatomy/branch-tracing-other')).toBeUndefined()
  })

  test('the route is kept out of search indexes', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
    expect(String(metadata.title)).toMatch(/Bronchial Branch Tracing/)
  })

  test('lessons are addressed by id under the Learn page, and the course names its source', () => {
    expect(lessonHref('two-levels')).toBe('/learn/anatomy/branch-tracing/learn?lesson=two-levels')
    expect(SOURCE).toEqual({
      title: 'Kurimoto & Morita. Bronchial Branch Tracing (2020)',
      url: 'https://doi.org/10.1007/978-981-13-9905-3',
    })
  })
})

describe('shipped assets', () => {
  test('the airway surface the scope renders is traceable to immutable public inputs and carries no labels', () => {
    const base = 'public/branch-tracing/preview-v1'
    const manifest = JSON.parse(readFileSync(`${base}/manifest.json`, 'utf8'))
    expect(manifest.sliceCount).toBe(256)
    expect(manifest.capabilities.hasReviewedJunctionPoses).toBe(false)
    expect(manifest.assets).toHaveLength(258)
    for (const asset of manifest.assets) {
      const bytes = readFileSync(`${base}/${asset.path}`)
      expect(bytes.length).toBe(asset.bytes)
      expect([asset.path, sha(bytes)]).toEqual([asset.path, asset.sha256])
    }
    const geometry = readFileSync(`${base}/geometry.json`, 'utf8')
    expect(geometry).not.toMatch(/label|sourceCurve|sourceCell|RB5|B5a/)
    const surface = readFileSync(`${base}/airway.glb`)
    expect(manifest.airway.url).toBe('/branch-tracing/preview-v1/airway.glb')
    expect(sha(surface)).toBe(manifest.airway.sha256)
    const jsonLength = surface.readUInt32LE(12)
    const gltf = JSON.parse(surface.subarray(20, 20 + jsonLength).toString())
    expect(gltf.nodes).toHaveLength(1)
    expect(gltf.nodes[0]).toMatchObject({ name: 'Complete_airway', mesh: 0 })
    expect(gltf.meshes).toHaveLength(1)
    expect(gltf.materials).toBeUndefined()
    const original = readFileSync('public/fluoroview/cases/patient-new/airway_segments.glb')
    expect(sha(original)).toBe(manifest.airway.sourceSha256)
    const originalGltf = JSON.parse(
      original.subarray(20, 20 + original.readUInt32LE(12)).toString(),
    )
    const originalNode = originalGltf.nodes.find(
      (node: { name: string }) => node.name === 'Complete_airway',
    )
    for (const transform of ['matrix', 'translation', 'rotation', 'scale'])
      expect(gltf.nodes[0][transform]).toEqual(originalNode[transform])
    // JSON-only sanitization must not change the compressed surface coordinates.
    expect(surface.subarray(20 + jsonLength)).toEqual(
      original.subarray(20 + original.readUInt32LE(12)),
    )
  })

  test('the route traces and the lesion targets are the recorded data', () => {
    const digest = (value: unknown) => sha(JSON.stringify(value))
    expect(digest(CT_TRACES)).toBe(
      '86b223c8ef59e3d7943d52984718cff853615a5f876dd2556614742f3e0581a4',
    )
    expect(digest(CT_TARGETS)).toBe(
      'ca1a873b489309e16009b8c3dd7c080fe9890a0a0a38c903c0f4d9685643f957',
    )
    // The export still has the main bronchi's own response points on slice 387.
    expect(
      traceById('central-right')
        .checkpoints.find((p) => p.id === 'junction-1')!
        .decision!.options.map((o) => o.slice),
    ).toEqual([387, 387])
  })
})

describe('small shared helpers', () => {
  test('asymmetric patient/display transforms round trip without confusing reflection with LPS conversion', () => {
    expect(lpsToRas(lpsToRas([11, -23, 41]))).toEqual([11, -23, 41])
    for (const preset of ['standard', 'mirror', 'rul', 'upper-division'] as const)
      expect(undisplayPoint(displayPoint([17, -9], preset), preset)).toEqual([17, -9])
    expect(transformPoint([1, 0, 0, 11, 0, 2, 0, -7, 0, 0, 3, 2, 0, 0, 0, 1], [2, 3, 5])).toEqual([
      13, -1, 17,
    ])
    expect(() => transformPoint([1, 2], [0, 0, 0])).toThrow()
    expect(directionError(350, 10)).toBe(20)
    expect(directionError(10, 190, 180)).toBe(0)
    expect(directionError(10, 190)).toBe(180)
  })

  test('title-case source names read in sentence case and a doubled word is fixed, leaving codes and stored data intact', () => {
    expect(displayName('Left Lower Lobe Posterior Basal segmental bronchus')).toBe(
      'Left lower lobe posterior basal segmental bronchus',
    )
    expect(displayName('Right B1–B2 common trunk')).toBe('Right B1–B2 common trunk')
    expect(displayOptionLabel('LB10 · Left Lower Lobe Posterior Basal segmental bronchus')).toBe(
      'LB10 · Left lower lobe posterior basal segmental bronchus',
    )
    expect(displayOptionLabel('RB8 · between the right and left daughters daughter')).toBe(
      'RB8 · between the right and left daughters',
    )
    expect(displayOptionLabel('LB6 · more caudal daughter')).toBe('LB6 · more caudal daughter')
    expect(displayOptionLabel('LB6')).toBe('LB6')
    expect([count(1, 'checkpoint'), count(2, 'checkpoint'), count(1, 'stop')]).toEqual([
      '1 checkpoint',
      '2 checkpoints',
      '1 stop',
    ])
    expect(count(2, 'try', 'tries')).toBe('2 tries')
    // The source data keeps its own spelling.
    const stored = traceById('left-lower-basal')
      .checkpoints.flatMap((p) => p.decision?.options ?? [])
      .find((o) => o.airway.code === 'LB10')
    expect(stored?.airway.name).toBe('Left Lower Lobe Posterior Basal segmental bronchus')
  })
})
