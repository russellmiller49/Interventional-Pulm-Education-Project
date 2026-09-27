import { act, renderHook } from '@testing-library/react'
import { caseFixture } from '@/features/socrates-study/testing/fixtures'
import { publishedLibraryDocument, type SharedSlide } from '../shared-library'
import { reconcileShared, useSharedLibrary } from '../use-shared-library'
import { refreshSharedLibrary, saveSharedSlide } from '@/app/[locale]/socrates-library/actions'
jest.mock('@/app/[locale]/socrates-library/actions', () => ({
  refreshSharedLibrary: jest.fn(),
  saveSharedSlide: jest.fn(),
  publishSharedSlide: jest.fn(),
}))
const id = '70000000-0000-4000-8000-000000000001'
function row(version = 1): SharedSlide {
  return {
    id,
    importKey: `local:${id}`,
    version,
    assignment: 'teaching',
    publishedRevision: null,
    publishedAssignment: null,
    publishedAt: null,
    updatedAt: '2026-09-27T00:00:00Z',
    document: { ...caseFixture(), revision: version },
  }
}
beforeEach(() => {
  localStorage.clear()
  sessionStorage.setItem('socrates-author-tab', 'qa-tab')
  jest.useFakeTimers()
  jest.mocked(refreshSharedLibrary).mockResolvedValue({ ok: true, slides: [row()] })
})
afterEach(() => jest.useRealTimers())
test('clean clients adopt teammate revisions; dirty clients keep edits and show conflicts', () => {
  const first = reconcileShared({}, [row()])
  const next = row(2)
  next.document.title = 'Team update'
  expect(reconcileShared(first, [next])[id].draft.document.title).toBe('Team update')
  first[id].dirty = true
  first[id].draft = {
    ...first[id].draft,
    document: { ...first[id].draft.document, title: 'My working copy' },
  }
  const conflict = reconcileShared(first, [next])[id]
  expect(conflict.draft.document.title).toBe('My working copy')
  expect(conflict.conflict?.document.title).toBe('Team update')
  expect(reconcileShared(reconcileShared({}, [next]), [row()])[id].base?.version).toBe(2)
})
test('typing while a save is in flight preserves later edits and uses the acknowledged revision', async () => {
  let complete!: (value: Awaited<ReturnType<typeof saveSharedSlide>>) => void
  jest.mocked(saveSharedSlide).mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve
    }),
  )
  const { result } = renderHook(() => useSharedLibrary([row()], 'editor'))
  act(() => result.current.edit({ ...row(), document: { ...row().document, title: 'First edit' } }))
  await act(async () => {
    jest.advanceTimersByTime(1000)
  })
  act(() =>
    result.current.edit({
      ...result.current.entries[id].draft,
      document: { ...row().document, title: 'Second edit' },
    }),
  )
  const saved = row(2)
  saved.document.title = 'First edit'
  await act(async () => complete({ ok: true, slide: saved }))
  expect(result.current.entries[id].draft.document.title).toBe('Second edit')
  expect(result.current.entries[id].dirty).toBe(true)
  const savedAgain = row(3)
  savedAgain.document.title = 'Second edit'
  jest.mocked(saveSharedSlide).mockResolvedValueOnce({ ok: true, slide: savedAgain })
  await act(async () => {
    jest.advanceTimersByTime(1000)
  })
  expect(saveSharedSlide).toHaveBeenLastCalledWith(
    expect.objectContaining({ document: expect.objectContaining({ title: 'Second edit' }) }),
    2,
    2,
  )
  expect(result.current.entries[id].dirty).toBe(false)
})
test('connection failures retain recoverable unsaved content and release the save lock', async () => {
  jest.mocked(saveSharedSlide).mockRejectedValueOnce(new Error('offline'))
  const { result } = renderHook(() => useSharedLibrary([row()], 'editor'))
  act(() =>
    result.current.edit({ ...row(), document: { ...row().document, title: 'Offline edit' } }),
  )
  await act(async () => {
    jest.advanceTimersByTime(1000)
  })
  expect(result.current.busy).toBeNull()
  expect(result.current.entries[id].dirty).toBe(true)
  expect(localStorage.getItem('socrates-shared-unsaved:editor:qa-tab')).toContain('Offline edit')
  expect(result.current.entries[id].error).toMatch(/Connection lost/)
})
test('reload preserves unsaved content and detects a newer teammate revision', () => {
  const entry = reconcileShared({}, [row()])[id]
  entry.dirty = true
  entry.draft.document.title = 'Recovered edit'
  localStorage.setItem('socrates-shared-unsaved:editor:qa-tab', JSON.stringify({ [id]: entry }))
  const { result } = renderHook(() => useSharedLibrary([row(2)], 'editor'))
  expect(result.current.entries[id].draft.document.title).toBe('Recovered edit')
  expect(result.current.entries[id].conflict?.version).toBe(2)
})
test('published testing payload contains no teaching content, private metadata, source URLs or color', () => {
  const doc = caseFixture()
  doc.title = 'SECRET_DIAGNOSIS'
  doc.caseContent.vignette = 'SECRET_CONTEXT'
  doc.authorContent.internalHighlightNotes = 'SECRET_NOTES'
  doc.caseContent.adequacy.designation = 'SECRET_KEY'
  const projected = publishedLibraryDocument(doc, 'testing', id)
  expect(JSON.stringify(projected)).not.toMatch(
    /SECRET_|ucsd-slide-viewer|thinviewer|comparisonDescriptorUrl/,
  )
  expect(projected.annotations).toEqual([])
  expect(projected.slide.descriptorUrl).toBe(
    `/api/socrates/images/library/${id}/${doc.revision}/tissue/slide.dzi`,
  )
  const teaching = publishedLibraryDocument(doc, 'teaching', id)
  expect(teaching.caseContent.vignette).toBe('SECRET_CONTEXT')
  expect(JSON.stringify(teaching)).not.toContain('SECRET_NOTES')
})
