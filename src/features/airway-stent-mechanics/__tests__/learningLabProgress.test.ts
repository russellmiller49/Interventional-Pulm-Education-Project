import {
  STENT_PROGRESS_STORAGE_KEY,
  createDefaultStentProgress,
  getExplicitLessonFromSearchParams,
  isModuleComplete,
  markLessonCompleted,
  parseStentProgress,
  readStentProgress,
  recordAssessmentResult,
  resolveInitialLessonId,
  setLastLesson,
  writeStentProgress,
} from '../engine/learningLabProgress'
import type { StentProgressStorage } from '../engine/learningLabTypes'

class MemoryStorage implements StentProgressStorage {
  values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('airway stent learning-lab progress', () => {
  it('creates a versioned default that starts at orient', () => {
    expect(createDefaultStentProgress()).toEqual({
      version: 1,
      lastLessonId: 'orient',
      completedLessonIds: [],
      assessment: {
        attempts: 0,
        lastScore: null,
        bestScore: null,
        mastery: false,
      },
    })
  })

  it('round-trips valid progress through the v1 storage key', () => {
    const storage = new MemoryStorage()
    const progress = markLessonCompleted(createDefaultStentProgress(), 'orient')

    expect(writeStentProgress(progress, storage)).toBe(true)
    expect(storage.values.has(STENT_PROGRESS_STORAGE_KEY)).toBe(true)
    expect(readStentProgress(storage)).toEqual(progress)
  })

  it('parses defensively, deduplicates valid completion IDs, and rejects bad versions', () => {
    const serialized = JSON.stringify({
      version: 1,
      lastLessonId: 'force-lab',
      completedLessonIds: ['orient', 'orient', 'not-a-lesson', 'architectures'],
      assessment: {
        attempts: 0,
        lastScore: null,
        bestScore: null,
        mastery: false,
      },
    })

    expect(parseStentProgress(serialized)?.completedLessonIds).toEqual(['orient', 'architectures'])
    expect(parseStentProgress('{bad json')).toBeNull()
    expect(parseStentProgress(JSON.stringify({ version: 2 }))).toBeNull()
    expect(
      parseStentProgress(
        JSON.stringify({
          version: 1,
          lastLessonId: 'not-a-lesson',
          completedLessonIds: [],
          assessment: { attempts: 0, lastScore: null, bestScore: null, mastery: false },
        }),
      ),
    ).toBeNull()
  })

  it('falls back safely when storage is unavailable or throws', () => {
    const throwingStorage: StentProgressStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }

    expect(readStentProgress(null)).toEqual(createDefaultStentProgress())
    expect(readStentProgress(throwingStorage)).toEqual(createDefaultStentProgress())
    expect(writeStentProgress(createDefaultStentProgress(), null)).toBe(false)
    expect(writeStentProgress(createDefaultStentProgress(), throwingStorage)).toBe(false)
  })

  it('gives a valid explicit lesson precedence over resume state', () => {
    const progress = setLastLesson(createDefaultStentProgress(), 'tissue-time')

    expect(resolveInitialLessonId('force-lab', progress)).toBe('force-lab')
    expect(resolveInitialLessonId('not-a-lesson', progress)).toBe('tissue-time')
    expect(resolveInitialLessonId(null, null)).toBe('orient')

    expect(
      getExplicitLessonFromSearchParams(new URLSearchParams('lesson=evidence-decisions')),
    ).toBe('evidence-decisions')
    expect(getExplicitLessonFromSearchParams(new URLSearchParams('lesson=unknown'))).toBeNull()
  })

  it('records completion only through explicit completion and preserves assessment mastery', () => {
    let progress = createDefaultStentProgress()
    for (const lessonId of [
      'orient',
      'architectures',
      'force-lab',
      'tissue-time',
      'evidence-decisions',
    ] as const) {
      progress = markLessonCompleted(progress, lessonId)
    }

    expect(isModuleComplete(progress)).toBe(false)
    progress = recordAssessmentResult(progress, 4)
    expect(progress.assessment).toEqual({
      attempts: 1,
      lastScore: 4,
      bestScore: 4,
      mastery: false,
    })
    expect(isModuleComplete(progress)).toBe(true)

    progress = recordAssessmentResult(progress, 5)
    expect(progress.assessment).toEqual({
      attempts: 2,
      lastScore: 5,
      bestScore: 5,
      mastery: true,
    })

    progress = recordAssessmentResult(progress, 2)
    expect(progress.assessment).toEqual({
      attempts: 3,
      lastScore: 2,
      bestScore: 5,
      mastery: true,
    })
  })

  it('rejects invalid assessment scores and totals', () => {
    const progress = createDefaultStentProgress()
    expect(() => recordAssessmentResult(progress, -1)).toThrow('between zero')
    expect(() => recordAssessmentResult(progress, 7)).toThrow('between zero')
    expect(() => recordAssessmentResult(progress, 4.5)).toThrow('integers')
    expect(() => recordAssessmentResult(progress, 4, 5)).toThrow('exactly six')
  })
})
