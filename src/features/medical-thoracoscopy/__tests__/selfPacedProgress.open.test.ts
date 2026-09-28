import {
  readProgress,
  recordLocation,
  setSectionReviewed,
  setSectionReviewLater,
  THORACOSCOPY_PROGRESS_CHANGED_EVENT,
  THORACOSCOPY_PROGRESS_STORAGE_KEY,
} from '../engine/selfPacedProgress'

/** The writing paths, with one section opened in the registry. */
jest.mock('../content/curriculum', () => {
  const actual = jest.requireActual<typeof import('../content/curriculum')>('../content/curriculum')
  return {
    ...actual,
    curriculumSections: actual.curriculumSections.map((section) =>
      section.id === 'four-controls' ? { ...section, state: 'available' } : section,
    ),
  }
})

beforeEach(() => window.localStorage.clear())

describe('progress record, with one section open', () => {
  it('records the place and the visit, once, and tells the page', () => {
    const events = jest.fn()
    window.addEventListener(THORACOSCOPY_PROGRESS_CHANGED_EVENT, events)

    expect(recordLocation({ kind: 'section', id: 'four-controls' })).toBe(true)
    expect(recordLocation({ kind: 'section', id: 'four-controls' })).toBe(false)
    expect(readProgress().progress).toMatchObject({
      lastLocation: { kind: 'section', id: 'four-controls' },
      visitedSectionIds: ['four-controls'],
    })
    expect(events).toHaveBeenCalledTimes(1)
    window.removeEventListener(THORACOSCOPY_PROGRESS_CHANGED_EVENT, events)
  })

  it('marks a section reviewed and takes it back', () => {
    expect(setSectionReviewed('four-controls', true)).toBe(true)
    expect(readProgress().progress.reviewedSectionIds).toEqual(['four-controls'])
    expect(setSectionReviewed('four-controls', false)).toBe(true)
    expect(readProgress().progress.reviewedSectionIds).toEqual([])
  })

  it('saves a section for later and unsaves it', () => {
    expect(setSectionReviewLater('four-controls', true)).toBe(true)
    expect(setSectionReviewLater('four-controls', true)).toBe(false)
    expect(readProgress().progress.reviewLaterSectionIds).toEqual(['four-controls'])
    expect(setSectionReviewLater('four-controls', false)).toBe(true)
  })

  it('still records nothing for a section in preparation', () => {
    expect(recordLocation({ kind: 'section', id: 'entry' })).toBe(false)
    expect(window.localStorage.getItem(THORACOSCOPY_PROGRESS_STORAGE_KEY)).toBeNull()
  })
})
