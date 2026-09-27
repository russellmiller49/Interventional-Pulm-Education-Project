import {
  createWebOverlayWorkspace,
  saveWebOverlayWorkspace,
  readWebOverlayWorkspace,
} from '@/features/socrates-builder/web-overlay-storage'
import { caseFixture } from '@/features/socrates-study/testing/fixtures'
import {
  authorLibrarySchema,
  documentKey,
  exportAuthorLibrary,
  importAuthorLibrary,
  mergeCurriculum,
  normalizeWorkspace,
} from '../author-library'
import { collectionSchema } from '../model'

function curriculum() {
  const doc = caseFixture()
  delete doc.recordId
  Object.assign(doc, { revision: 0, workflowStatus: 'draft' })
  doc.caseContent.trainingEligible = false
  doc.caseContent.testingEligible = false
  return collectionSchema.parse({
    format: 'socrates-local-curriculum-v1',
    title: 'Synthetic curriculum',
    documents: [doc],
  })
}
beforeEach(() => localStorage.clear())

test('joining the prepared curriculum preserves existing drafts and never duplicates or overwrites later edits', () => {
  const original = createWebOverlayWorkspace()
  original.activeDocument.annotations[0].explanation = 'Existing author work'
  const first = mergeCurriculum(original, curriculum())
  expect(first.documents).toHaveLength(2)
  expect(first.activeDocument.annotations[0].explanation).toBe('Existing author work')
  const prepared = first.documents[0]
  const id = documentKey(prepared)
  prepared.title = 'Authored title'
  prepared.slug = 'authored-slug'
  prepared.caseContent!.vignette = 'Authored context'
  first.curriculum!.assignments[id] = 'testing'
  const second = mergeCurriculum(first, curriculum())
  expect(second.documents).toHaveLength(2)
  expect(second.documents[0]).toEqual(prepared)
  expect(second.curriculum!.assignments[id]).toBe('testing')
  expect(second.curriculum!.importedIds).toEqual([id])
  expect(saveWebOverlayWorkspace(second)).toBeNull()
  expect(readWebOverlayWorkspace().workspace).toEqual(second)
})

test('export and import carry context, annotations, original metadata and assignments without replacing conflicting work', () => {
  const first = mergeCurriculum(createWebOverlayWorkspace(), curriculum())
  const doc = first.documents[0]
  const id = documentKey(doc)
  first.curriculum!.assignments[id] = 'teaching'
  doc.caseContent!.vignette = 'Team context'
  doc.annotations[0].explanation = 'Team annotation'
  const bundle = exportAuthorLibrary(first)
  expect(importAuthorLibrary(first, bundle).documents).toHaveLength(first.documents.length)
  const emptyDestination = normalizeWorkspace(createWebOverlayWorkspace())
  const imported = importAuthorLibrary(emptyDestination, bundle)
  expect(imported.documents.find((item) => documentKey(item) === id)).toEqual(doc)
  expect(imported.curriculum!.assignments[id]).toBe('teaching')
  expect(importAuthorLibrary(imported, bundle).documents).toHaveLength(imported.documents.length)
  imported.documents.find((item) => documentKey(item) === id)!.caseContent!.vignette =
    'Local changes'
  const merged = importAuthorLibrary(imported, bundle)
  expect(merged.documents.find((item) => documentKey(item) === id)!.caseContent!.vignette).toBe(
    'Local changes',
  )
  const copy = merged.documents.find((item) => item.title.endsWith('(imported copy)'))!
  expect(copy.caseContent!.vignette).toBe('Team context')
  expect(copy.annotations[0].explanation).toBe('Team annotation')
  expect(merged.curriculum!.assignments[documentKey(copy)]).toBe('teaching')
})

test('library import rejects release eligibility, duplicate identities and dangling assignments', () => {
  const workspace = mergeCurriculum(createWebOverlayWorkspace(), curriculum())
  const bundle = exportAuthorLibrary(workspace)
  expect(authorLibrarySchema.safeParse(bundle).success).toBe(true)
  expect(
    authorLibrarySchema.safeParse({
      ...bundle,
      workspace: { ...workspace, documents: [...workspace.documents, workspace.documents[0]] },
    }).success,
  ).toBe(false)
  workspace.curriculum!.assignments.missing = 'testing'
  expect(authorLibrarySchema.safeParse({ ...bundle, workspace }).success).toBe(false)
  delete workspace.curriculum!.assignments.missing
  workspace.documents[0].caseContent!.testingEligible = true
  expect(authorLibrarySchema.safeParse({ ...bundle, workspace }).success).toBe(false)
})
