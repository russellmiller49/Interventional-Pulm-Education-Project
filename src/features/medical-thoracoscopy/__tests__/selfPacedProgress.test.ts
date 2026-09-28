import {
  createEmptyProgress,
  isRecordable,
  parseProgress,
  readProgress,
  recordLocation,
  setSectionReviewed,
  setSectionReviewLater,
  THORACOSCOPY_PROGRESS_CHANGED_EVENT,
  THORACOSCOPY_PROGRESS_STORAGE_KEY,
  updateProgress,
  withLocation,
} from '../engine/selfPacedProgress'

/**
 * The record with the real registry, in which nothing can be opened yet: nothing is ever written.
 * The paths that do write are covered, with one section opened, in the next file.
 */
const LEGACY_KEY = 'ip-pleural-module-progress-v1'

beforeEach(() => window.localStorage.clear())

describe('progress record, with nothing open', () => {
  it('records no visit, review or saved place for a section in preparation', () => {
    const events = jest.fn()
    window.addEventListener(THORACOSCOPY_PROGRESS_CHANGED_EVENT, events)

    expect(isRecordable({ kind: 'section', id: 'four-controls' })).toBe(false)
    expect(recordLocation({ kind: 'section', id: 'four-controls' })).toBe(false)
    expect(setSectionReviewed('four-controls', true)).toBe(false)
    expect(setSectionReviewLater('four-controls', true)).toBe(false)
    expect(recordLocation({ kind: 'practice-scenario', id: 'P1' })).toBe(false)
    expect(recordLocation({ kind: 'case', id: 'C1' })).toBe(false)
    expect(window.localStorage.getItem(THORACOSCOPY_PROGRESS_STORAGE_KEY)).toBeNull()
    expect(events).not.toHaveBeenCalled()
    window.removeEventListener(THORACOSCOPY_PROGRESS_CHANGED_EVENT, events)
  })

  it('reads an empty record, a saved one, and one it cannot read', () => {
    expect(readProgress()).toEqual({ progress: createEmptyProgress(), status: 'empty' })

    const saved = { ...createEmptyProgress(), visitedSectionIds: ['a', 'a'] }
    window.localStorage.setItem(THORACOSCOPY_PROGRESS_STORAGE_KEY, JSON.stringify(saved))
    expect(readProgress().status).toBe('saved')
    expect(readProgress().progress.visitedSectionIds).toEqual(['a'])

    window.localStorage.setItem(THORACOSCOPY_PROGRESS_STORAGE_KEY, '{"version":2}')
    expect(readProgress().status).toBe('unreadable')
  })

  it('leaves a value it cannot read exactly as it is', () => {
    window.localStorage.setItem(THORACOSCOPY_PROGRESS_STORAGE_KEY, 'not json')

    expect(updateProgress((progress) => ({ ...progress, updatedAt: 'now' }))).toBe(false)
    expect(window.localStorage.getItem(THORACOSCOPY_PROGRESS_STORAGE_KEY)).toBe('not json')
  })

  it('never reads, writes or removes the earlier module record', () => {
    window.localStorage.setItem(LEGACY_KEY, 'legacy value')
    const getItem = jest.spyOn(Storage.prototype, 'getItem')
    const setItem = jest.spyOn(Storage.prototype, 'setItem')
    const removeItem = jest.spyOn(Storage.prototype, 'removeItem')

    readProgress()
    updateProgress((progress) => ({ ...progress, updatedAt: '2026-10-01T00:00:00.000Z' }))
    recordLocation({ kind: 'section', id: 'why-thoracoscopy' })

    for (const spy of [getItem, setItem, removeItem]) {
      expect(spy.mock.calls.map(([key]) => key)).not.toContain(LEGACY_KEY)
    }
    expect(window.localStorage.getItem(LEGACY_KEY)).toBe('legacy value')
    jest.restoreAllMocks()
  })

  it('works without saving where storage is refused', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })

    expect(readProgress().status).toBe('unavailable')
    expect(updateProgress((progress) => progress)).toBe(false)
    getItem.mockRestore()
  })

  it('parses nothing it does not recognise', () => {
    expect(parseProgress(null)).toBeNull()
    expect(parseProgress('{}')).toBeNull()
    expect(parseProgress(JSON.stringify({ ...createEmptyProgress(), extra: true }))).toBeNull()
    expect(withLocation(createEmptyProgress(), { kind: 'section', id: 'entry' })).toEqual(
      createEmptyProgress(),
    )
  })
})
