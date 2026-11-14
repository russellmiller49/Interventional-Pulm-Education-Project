import { LESSONS } from '../content/curriculum'
import {
  PROGRESS_STORAGE_KEY,
  clearProgress,
  createEmptyProgress,
  parseProgress,
  readProgress,
  recommendedLesson,
  recordLocation,
  setLessonReviewed,
  snapshotFromStorage,
  withLessonReviewed,
  withLocation,
} from '../engine/progress'

const [first, second] = LESSONS

beforeEach(() => window.localStorage.clear())

describe('saved place in the course', () => {
  it('starts empty and recommends the first lesson', () => {
    expect(readProgress().status).toBe('empty')
    expect(recommendedLesson(createEmptyProgress())).toBe(first)
  })

  it('remembers the lesson the learner was in until they reach its end', () => {
    const inSecond = withLocation(createEmptyProgress(), second.id)
    expect(recommendedLesson(inSecond)).toBe(second)
    const done = withLessonReviewed(inSecond, second.id)
    expect(recommendedLesson(done)).toBe(first)
    const all = LESSONS.reduce((p, lesson) => withLessonReviewed(p, lesson.id), done)
    expect(recommendedLesson(all)).toBeUndefined()
  })

  it('keeps only where the learner has been: no answers, no images', () => {
    recordLocation(first.id)
    setLessonReviewed(first.id)
    const stored = JSON.parse(window.localStorage.getItem(PROGRESS_STORAGE_KEY)!)
    expect(Object.keys(stored).sort()).toEqual(
      ['lastLessonId', 'reviewedLessonIds', 'updatedAt', 'version', 'visitedLessonIds'].sort(),
    )
    expect(readProgress().progress.reviewedLessonIds).toEqual([first.id])
  })

  it('drops lesson ids it does not know when reading, without rewriting what is stored', () => {
    const raw = JSON.stringify({
      version: 1,
      lastLessonId: 'a-lesson-that-was-removed',
      visitedLessonIds: [first.id, 'a-lesson-that-was-removed'],
      reviewedLessonIds: ['a-lesson-that-was-removed'],
      updatedAt: '2026-11-12T00:00:00.000Z',
    })
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, raw)
    const parsed = parseProgress(raw)!
    expect(parsed.lastLessonId).toBeNull()
    expect(parsed.visitedLessonIds).toEqual([first.id])
    expect(parsed.reviewedLessonIds).toEqual([])
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe(raw)
  })

  it('leaves a value it cannot read exactly as it is and saves nothing over it', () => {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, '{"version":7}')
    expect(readProgress().status).toBe('unreadable')
    expect(recordLocation(first.id)).toBe(false)
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe('{"version":7}')
    expect(snapshotFromStorage(null, false).status).toBe('unavailable')
  })

  it('restarting the course forgets the place and every mark', () => {
    recordLocation(second.id)
    setLessonReviewed(second.id)
    expect(clearProgress()).toBe(true)
    expect(readProgress().status).toBe('empty')
    expect(recommendedLesson(readProgress().progress)).toBe(first)
  })
})
