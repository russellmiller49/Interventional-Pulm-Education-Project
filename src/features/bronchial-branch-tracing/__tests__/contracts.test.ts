import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { childrenOf, makeExercise, makePhantom, openingPosition } from '../content/phantoms'
import { canAssessClinicalCase, validateGraph, type Branch } from '../content/types'
import {
  displayPoint,
  undisplayPoint,
  directionError,
  lpsToRas,
  transformPoint,
} from '../geometry/coordinates'
import { atArcLength, previewGraphSchema } from '../geometry/clinical-preview'
import { emptySession, sessionReducer, referenceVisible, scoreResponse } from '../engine/session'
import { emptyPractice, practiceReducer } from '../engine/practice'
import {
  createEmptyCriticalCareProgress,
  upsertCriticalCareActivityProgress,
} from '@/features/learning-module/activity/progress'
import { recordFirst, PREFIX, completedLessons } from '../engine/progress'
import { LESSONS, nextLesson } from '../content/lessons'
import { isPublicPath, isPublicUnlistedPath } from '@/lib/site-auth/access'
import { isVisibleModulePath } from '@/lib/draft-modules'

const source = () => makeExercise('horizontal-oblique', 3)
const response = () => ({
  branchId: source().targetId,
  openings: Object.fromEntries(
    childrenOf(source().phantom).map((b) => [b.id, openingPosition(source().phantom, b)]),
  ),
  hints: 0,
})

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
test('all authored geometries are connected and support nonbinary divisions, common stems and side branches', () => {
  for (const pattern of [
    'vertical',
    'horizontal-horizontal',
    'horizontal-vertical',
    'horizontal-oblique',
    'reversal',
    'variant',
  ] as const)
    expect(validateGraph(makePhantom(pattern).branches, 'parent')).toEqual([])
  const p = makePhantom('variant'),
    stem = p.branches[1]
  stem.kind = 'common-trunk'
  stem.childIds = ['daughter']
  const daughter: Branch = {
    ...stem,
    id: 'daughter',
    parentId: stem.id,
    childIds: [],
    kind: 'daughter',
    points: [stem.points.at(-1)!, [28, 28, -40]],
    topologicalDepth: 2,
  }
  p.branches.push(daughter)
  expect(validateGraph(p.branches, 'parent')).toEqual([])
  daughter.childIds = ['parent']
  expect(validateGraph(p.branches, 'parent')).toContain('Cycle')
  p.branches.pop()
  stem.childIds = []
  stem.points[0] = [1, 0, 0]
  expect(validateGraph(p.branches, 'parent')).toContain(`Disconnected endpoint: ${stem.id}`)
})
test('arc-length traversal can descend and then ascend without a monotonic slice assumption', () => {
  const points: [number, number, number][] = [
    [0, 0, 20],
    [0, 0, 0],
    [20, 0, 20],
  ]
  expect(atArcLength(points, 0.4).position[2]).toBeLessThan(atArcLength(points, 0.9).position[2])
  expect(atArcLength(points, 1).position).toEqual([20, 0, 20])
})
test('clinical case eligibility fails closed without rights, matching derivative and reviewed checkpoints', () => {
  const c = {
    kind: 'clinical' as const,
    capabilities: {
      hasSourceIntensityVolume: false,
      hasContinuousCtStack: true,
      hasReviewedSubsegmentLabels: false,
      hasReviewedJunctionPoses: false,
      hasActualBronchoscopyVideo: false,
    },
    rightsApproved: true,
    deidentificationApproved: true,
    approvedCheckpointIds: [],
  }
  expect(canAssessClinicalCase(c)).toBe(false)
  expect(
    canAssessClinicalCase({
      ...c,
      capabilities: {
        ...c.capabilities,
        hasReviewedSubsegmentLabels: true,
        hasReviewedJunctionPoses: true,
      },
      approvedCheckpointIds: ['one'],
      reviewedDerivativeSha256: 'a'.repeat(64),
    }),
  ).toBe(true)
})
test('predict and transfer actions cannot be bypassed; first attempts survive changed answers and hints', () => {
  const reduce = sessionReducer(source(), source())
  let s = reduce(emptySession(), { type: 'advance' })
  expect(reduce(s, { type: 'advance' })).toBe(s)
  s = reduce(s, { type: 'choose', id: source().targetId })
  s = reduce(s, { type: 'advance' })
  expect(reduce(s, { type: 'submit' })).toBe(s)
  let p = createEmptyCriticalCareProgress()
  p = upsertCriticalCareActivityProgress(p, {
    activityId: 'other-module',
    status: 'in-progress',
    attempts: 1,
    competencyEvidenceIds: [],
    updatedAt: new Date().toISOString(),
  })
  const wrong = { ...response(), branchId: 'unresolved', hints: 1 }
  p = recordFirst(p, 'example', source(), wrong)
  p = recordFirst(p, 'example', source(), response())
  expect(
    p.activities.find((a) => a.activityId === `${PREFIX}.example.connectivity.first`),
  ).toMatchObject({ bestScore: 0, hintCount: 1 })
  expect(p.activities.some((a) => a.activityId === 'other-module')).toBe(true)
  expect(completedLessons(p)).toEqual([])
  expect(nextLesson([])?.id).toBe(LESSONS[0].id)
  expect(nextLesson(LESSONS.map((l) => l.id))).toBeNull()
  expect(JSON.stringify(p)).not.toMatch(/pointsLps|openings|branchId|camera|targetId/)
})
test('independent modes require submission; backtracking and an unrecorded edit cannot reveal results', () => {
  for (const mode of ['practice', 'assess'] as const)
    expect(referenceVisible(mode, true, false)).toBe(false)
  const e = source(),
    reduce = practiceReducer([e], false)
  let s = emptyPractice([e])
  expect(reduce(s, { type: 'submit' })).toBe(s)
  expect(reduce(s, { type: 'hint' })).toBe(s)
  s = reduce(s, { type: 'choose', id: e.targetId })
  for (const b of childrenOf(e.phantom))
    s = reduce(s, { type: 'place', id: b.id, position: openingPosition(e.phantom, b) })
  s = reduce(s, { type: 'record' })
  const changed = reduce(s, { type: 'choose', id: 'unresolved' })
  expect(reduce(changed, { type: 'submit' }).submitted).toBe(false)
  expect(reduce(s, { type: 'submit' }).submitted).toBe(true)
  expect(scoreResponse(e, response()).connectivity).toBe(1)
})
test('clinical preview is traceable to immutable public inputs and omits candidate labels', () => {
  const base = 'public/branch-tracing/preview-v1'
  const manifest = JSON.parse(readFileSync(`${base}/manifest.json`, 'utf8'))
  expect(manifest.sliceCount).toBe(256)
  expect(manifest.capabilities.hasReviewedJunctionPoses).toBe(false)
  for (const asset of manifest.assets) {
    const bytes = readFileSync(`${base}/${asset.path}`)
    expect(bytes.length).toBe(asset.bytes)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256)
  }
  const geometry = readFileSync(`${base}/geometry.json`, 'utf8')
  expect(() => previewGraphSchema.parse(JSON.parse(geometry))).not.toThrow()
  expect(geometry).not.toMatch(/label|sourceCurve|sourceCell|RB5|B5a/)
  const surface = readFileSync(`${base}/airway.glb`)
  const jsonLength = surface.readUInt32LE(12)
  const gltf = JSON.parse(surface.subarray(20, 20 + jsonLength).toString())
  expect(gltf.nodes).toHaveLength(1)
  expect(gltf.nodes[0]).toMatchObject({ name: 'Complete_airway', mesh: 0 })
  expect(gltf.meshes).toHaveLength(1)
  expect(gltf.materials).toBeUndefined()
  const original = readFileSync('public/fluoroview/cases/patient-new/airway_segments.glb')
  const originalGltf = JSON.parse(original.subarray(20, 20 + original.readUInt32LE(12)).toString())
  const originalNode = originalGltf.nodes.find(
    (node: { name: string }) => node.name === 'Complete_airway',
  )
  for (const transform of ['matrix', 'translation', 'rotation', 'scale'])
    expect(gltf.nodes[0][transform]).toEqual(originalNode[transform])
  // JSON-only sanitization must not change the compressed surface coordinates.
  expect(surface.subarray(20 + jsonLength)).toEqual(
    original.subarray(20 + original.readUInt32LE(12)),
  )
  const graph = JSON.parse(geometry)
  graph.edges[0].endNodeId = graph.rootNodeId
  expect(() => previewGraphSchema.parse(graph)).toThrow()
})
test('the new pages are anonymous and unlisted without exposing the existing admin anatomy routes', () => {
  for (const locale of ['en', 'es', 'zh-CN'])
    for (const suffix of ['', '/learn', '/practice', '/assess']) {
      const path = `/${locale}/learn/anatomy/branch-tracing${suffix}`
      expect(isPublicPath(path)).toBe(true)
      expect(isPublicUnlistedPath(path)).toBe(true)
      expect(isVisibleModulePath(path, { isAdmin: true })).toBe(false)
    }
  expect(isPublicPath('/airway-anatomy/case-001/case_manifest.json')).toBe(false)
  expect(isPublicPath('/learn/anatomy/airway')).toBe(false)
  expect(isPublicPath('/learn/anatomy/branch-tracing-other')).toBe(false)
})
