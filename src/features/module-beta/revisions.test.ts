import {
  isBaxterCrrtLearnerCaseId,
  isBaxterCrrtLearnerLessonId,
} from '@/features/baxter-crrt/content/learnerRegistry'
import { betaModuleById, betaModuleReviewPath } from './catalog'
import { betaModuleRevisions, betaRevisionHistory, betaRevisionSectionPath } from './revisions'

const categories = ['clinical', 'educational', 'simulation', 'usability', 'technical']

it('registers unique revision IDs, module sequences and display versions with complete changelogs', () => {
  const revisionIds = new Set()
  const versionKeys = new Set()
  const sequenceKeys = new Set()
  const sectionPaths = new Map<string, string | undefined>()
  expect(betaModuleRevisions.length).toBeGreaterThan(0)
  for (const revision of betaModuleRevisions) {
    const { moduleId, revisionId, sequence, displayVersion, releasedOn } = revision
    const entry = betaModuleById(moduleId)
    expect(entry).toBeDefined()
    expect(revisionId).toMatch(/^[a-z0-9-]+$/)
    expect(revisionIds.has(revisionId)).toBe(false)
    revisionIds.add(revisionId)
    expect(Number.isSafeInteger(sequence)).toBe(true)
    expect(sequence).toBeGreaterThan(0)
    expect(sequenceKeys.has(`${moduleId}:${sequence}`)).toBe(false)
    sequenceKeys.add(`${moduleId}:${sequence}`)
    expect(displayVersion.trim()).not.toBe('')
    expect(versionKeys.has(`${moduleId}:${displayVersion}`)).toBe(false)
    versionKeys.add(`${moduleId}:${displayVersion}`)
    if (releasedOn !== undefined) {
      expect(releasedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(new Date(releasedOn).toISOString().slice(0, 10)).toBe(releasedOn)
    }
    expect(categories).toContain(revision.category)
    expect(revision.changelog.length).toBeGreaterThan(0)
    expect(revision.changelog.every((entry) => entry.trim().length > 0)).toBe(true)
    expect(typeof revision.rereviewRecommended).toBe('boolean')

    const sections = revision.affectedSections ?? []
    expect(new Set(sections.map(({ id }) => id)).size).toBe(sections.length)
    for (const section of sections) {
      expect(section.id).toMatch(/^[a-z0-9-]+$/)
      expect(section.title.trim()).not.toBe('')
      const sectionKey = `${moduleId}:${section.id}`
      if (sectionPaths.has(sectionKey)) expect(sectionPaths.get(sectionKey)).toBe(section.path)
      sectionPaths.set(sectionKey, section.path)
      if (!section.path) continue
      const url = new URL(section.path, 'https://module.invalid')
      const modulePath = betaModuleReviewPath(entry!)
      expect(url.origin).toBe('https://module.invalid')
      expect(url.pathname === modulePath || url.pathname.startsWith(`${modulePath}/`)).toBe(true)
    }
  }
})

it('orders revisions by explicit sequence, independently for each module', () => {
  const first = betaRevisionHistory('baxter-crrt').at(-1)!
  const second = {
    ...first,
    revisionId: 'test-crrt-next',
    sequence: 2,
    displayVersion: 'Updated preview',
  }
  const anotherModule = {
    ...first,
    moduleId: 'branch-tracing',
    revisionId: 'test-branch-first',
  } as const
  const registry = [first, anotherModule, second]
  expect(betaRevisionHistory('baxter-crrt', registry)).toEqual([second, first])
  expect(betaRevisionHistory('baxter-crrt', [...registry].reverse())).toEqual([second, first])
  expect(betaRevisionHistory('branch-tracing', registry)).toEqual([anotherModule])
  expect(betaRevisionHistory('ebus-guided', registry)).toEqual([])
  expect(registry).toEqual([first, anotherModule, second])
})

it('resolves CRRT change links against existing Learn and Practice navigation', () => {
  const revisions = betaRevisionHistory('baxter-crrt')
  const sections = revisions[0]?.affectedSections ?? []
  expect(sections).toHaveLength(5)
  for (const { id } of sections) {
    const path = betaRevisionSectionPath(revisions, id)
    const url = new URL(path!, 'https://module.invalid')
    if (url.pathname === '/baxter-crrt/learn') {
      expect(url.searchParams.get('lesson')).toBe(id)
      expect(isBaxterCrrtLearnerLessonId(id)).toBe(true)
    } else {
      expect(url.pathname).toBe('/baxter-crrt/practice')
      expect(url.searchParams.get('case')?.toLowerCase()).toBe(id)
      expect(isBaxterCrrtLearnerCaseId(url.searchParams.get('case')!)).toBe(true)
    }
  }
  expect(betaRevisionSectionPath(revisions, '/admin/modules')).toBeUndefined()
  expect(
    betaRevisionSectionPath(revisions, ['crrt-03', 'crrt-indications-modality']),
  ).toBeUndefined()
  expect(betaRevisionSectionPath(betaRevisionHistory('ebus-guided'), 'crrt-03')).toBeUndefined()
})
