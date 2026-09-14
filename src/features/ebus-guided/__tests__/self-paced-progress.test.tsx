import fs from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LESSONS } from '../content/curriculum'
import { FINAL_CASES, PRACTICE_CASES } from '../content/cases'
import { CoursePage } from '../components/CoursePage'
import { IntegratedCasesPage } from '../components/IntegratedCasesPage'
import { PracticePage } from '../components/PracticePage'
import { LessonHost } from '../components/LessonHost'
import { STORAGE_KEY } from '../engine/progress'
import { examinationKey } from '../engine/examination'
import { EXAMINATION_CASE } from '../content/examination-cases'
import {
  createEmptyProgress,
  parseProgress,
  PROGRESS_STORAGE_KEY,
  readProgress,
  recommendedLesson,
  snapshotFromStorage,
  updateProgress,
  withLessonReviewed,
  withLocation,
  withReviewLater,
} from '../engine/selfPacedProgress'

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
jest.mock('../components/DecisionImage', () => ({ DecisionImage: () => <div>Reference CT</div> }))
beforeEach(() => {
  localStorage.clear()
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(cleanup)
const NOW = '2026-09-14T12:00:00.000Z'
const DECLARED_FIELDS = [
  'lastLocation',
  'openedIntegratedCaseIds',
  'openedPracticeCaseIds',
  'reviewLaterLessonIds',
  'reviewedLessonIds',
  'updatedAt',
  'version',
  'visitedLessonIds',
]
const primary = () => document.querySelector('[data-now-primary]') as HTMLButtonElement

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(full) : [full]
  })
}

describe('the self-paced record', () => {
  it('declares only location, opened, reviewed and saved-for-later state, idempotently', () => {
    expect(Object.keys(createEmptyProgress()).sort()).toEqual(DECLARED_FIELDS)
    let progress = withLocation(createEmptyProgress(), { kind: 'lesson', id: 'preparation' }, NOW)
    const again = withLocation(progress, { kind: 'lesson', id: 'preparation' }, NOW)
    expect(again).toBe(progress)
    progress = withLocation(progress, { kind: 'practice-case', id: 'practice-right' }, NOW)
    progress = withLocation(progress, { kind: 'integrated-case', id: 'assessment-map' }, NOW)
    progress = withLessonReviewed(progress, 'preparation', true, NOW)
    expect(withLessonReviewed(progress, 'preparation', true, NOW)).toBe(progress)
    progress = withReviewLater(progress, 'doppler', true, NOW)
    expect(withReviewLater(progress, 'doppler', true, NOW)).toBe(progress)
    expect(progress).toEqual({
      version: 1,
      lastLocation: { kind: 'integrated-case', id: 'assessment-map' },
      visitedLessonIds: ['preparation'],
      reviewedLessonIds: ['preparation'],
      reviewLaterLessonIds: ['doppler'],
      openedPracticeCaseIds: ['practice-right'],
      openedIntegratedCaseIds: ['assessment-map'],
      updatedAt: NOW,
    })
    expect(withLessonReviewed(progress, 'preparation', false, NOW).reviewedLessonIds).toEqual([])
    expect(withReviewLater(progress, 'doppler', false, NOW).reviewLaterLessonIds).toEqual([])
  })
  it('recommends by location and reviewed marks only', () => {
    expect(recommendedLesson(createEmptyProgress())?.id).toBe(LESSONS[0].id)
    let progress = withLocation(createEmptyProgress(), { kind: 'lesson', id: 'doppler' }, NOW)
    expect(recommendedLesson(progress)?.id).toBe('doppler')
    progress = withLessonReviewed(progress, 'doppler', true, NOW)
    expect(recommendedLesson(progress)?.id).toBe(LESSONS[0].id)
    progress = withLocation(progress, { kind: 'integrated-case', id: 'assessment-map' }, NOW)
    progress = withReviewLater(progress, 'capture', true, NOW)
    expect(recommendedLesson(progress)?.id).toBe(LESSONS[0].id)
    const all = LESSONS.reduce(
      (value, lesson) => withLessonReviewed(value, lesson.id, true, NOW),
      progress,
    )
    expect(recommendedLesson(all)).toBeUndefined()
  })
  it('refuses records that carry responses or another version, and drops unknown ids at read time', () => {
    const base = createEmptyProgress()
    expect(parseProgress(JSON.stringify({ ...base, firstAttempts: {} }))).toBeNull()
    expect(parseProgress(JSON.stringify({ ...base, answers: { a: 'b' } }))).toBeNull()
    expect(parseProgress(JSON.stringify({ ...base, version: 2 }))).toBeNull()
    expect(parseProgress('{broken')).toBeNull()
    const parsed = parseProgress(
      JSON.stringify({
        ...base,
        lastLocation: { kind: 'lesson', id: 'retired-lesson' },
        visitedLessonIds: ['doppler', 'retired-lesson', 'doppler'],
        openedIntegratedCaseIds: ['assessment-map', 'no-such-case'],
      }),
    )!
    expect(parsed.lastLocation).toBeNull()
    expect(parsed.visitedLessonIds).toEqual(['doppler'])
    expect(parsed.openedIntegratedCaseIds).toEqual(['assessment-map'])
    expect(snapshotFromStorage(null, false).status).toBe('unavailable')
    expect(snapshotFromStorage(null, true).status).toBe('empty')
    expect(snapshotFromStorage('{"version":1}', true).status).toBe('unreadable')
  })
  it('leaves an unreadable stored value untouched and keeps the course open without saving', () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, '{"version":1,"answers":{"q":"a"}}')
    expect(
      updateProgress((progress) => withLocation(progress, { kind: 'lesson', id: 'doppler' })),
    ).toBe(false)
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe('{"version":1,"answers":{"q":"a"}}')
    render(<CoursePage />)
    expect(screen.getByText('could not be read', { exact: false })).toBeVisible()
    expect(document.querySelector('[data-course-door]')).toHaveTextContent('Start with')
  })
  it('keeps the course open when storage is unavailable', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    try {
      expect(readProgress().status).toBe('unavailable')
      render(<LessonHost lesson={LESSONS[1]} />)
      expect(screen.getByText('not saving your place', { exact: false })).toBeVisible()
      expect(primary()).toBeEnabled()
    } finally {
      getItem.mockRestore()
    }
  })
  it('preserves the legacy course record and the examination drafts byte for byte through a whole journey', () => {
    const legacy = JSON.stringify({
      version: 1,
      completed: ['clinical-question'],
      lastLesson: 'preparation',
      firstAttempts: { 'clinical-question:purpose-predict': { choiceId: 'a', at: 't' } },
      skillObservations: {},
      skillHistory: {},
      supportRequests: { preparation: [{ activityId: 'x', sessionId: 'y', at: 't' }] },
      completedCases: [],
      assessmentComplete: false,
      unknownField: 'kept',
      updatedAt: 't',
    })
    localStorage.setItem(STORAGE_KEY, legacy)
    const draftKey = examinationKey(EXAMINATION_CASE.id)
    const draft = '{"not":"a valid draft"}'
    localStorage.setItem(draftKey, draft)
    render(<CoursePage />)
    expect(document.querySelector('[data-legacy-record-note]')).toBeInTheDocument()
    expect(document.querySelector('[data-course-marks]')).toHaveTextContent(
      '0 of 26 lessons reviewed',
    )
    cleanup()
    render(<LessonHost lesson={LESSONS[1]} />)
    let guard = 0
    while (!screen.queryByRole('heading', { name: 'Lesson finished' }) && guard++ < 20) {
      fireEvent.click(primary())
    }
    cleanup()
    render(<IntegratedCasesPage caseId={FINAL_CASES[0].id} />)
    cleanup()
    render(<PracticePage />)
    fireEvent.click(screen.getByRole('button', { name: PRACTICE_CASES[0].title }))
    cleanup()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(legacy)
    expect(localStorage.getItem(draftKey)).toBe(draft)
    expect(Object.keys(localStorage).sort()).toEqual(
      [STORAGE_KEY, draftKey, PROGRESS_STORAGE_KEY].sort(),
    )
    expect(readProgress().progress).toMatchObject({
      visitedLessonIds: [LESSONS[1].id],
      reviewedLessonIds: [LESSONS[1].id],
      openedIntegratedCaseIds: [FINAL_CASES[0].id],
      openedPracticeCaseIds: [PRACTICE_CASES[0].id],
    })
    render(<CoursePage />)
    expect(document.querySelector('[data-course-marks]')).toHaveTextContent(
      '1 of 26 lessons reviewed · 1 opened',
    )
    expect(document.querySelector('[data-course-door]')).toHaveTextContent(
      'Continue with ' + LESSONS[0].title,
    )
  })
  it('is the only storage writer besides the examination drafts, and no runtime file imports the legacy record', () => {
    const featureRoot = path.resolve(__dirname, '..')
    const routeRoot = path.resolve(__dirname, '../../../app/[locale]/ebus-guided')
    const sources = [...listFiles(featureRoot), ...listFiles(routeRoot)].filter(
      (file) =>
        /\.(ts|tsx)$/.test(file) && !file.includes('__tests__') && !file.includes('/testing/'),
    )
    expect(sources.length).toBeGreaterThan(30)
    const relative = (file: string) => path.relative(featureRoot, file)
    const legacyImporters = sources.filter(
      (file) =>
        !file.endsWith('selfPacedProgress.ts') &&
        /from\s+['"][^'"]*engine\/progress['"]/.test(fs.readFileSync(file, 'utf8')),
    )
    expect(legacyImporters.map(relative)).toEqual([])
    const storageWriters = sources.filter((file) =>
      /\b(?:localStorage|sessionStorage|store)\.(?:setItem|removeItem|clear)\(/.test(
        fs.readFileSync(file, 'utf8'),
      ),
    )
    expect(storageWriters.map(relative).sort()).toEqual([
      path.join('engine', 'examination.ts'),
      path.join('engine', 'selfPacedProgress.ts'),
    ])
  })
  it('says nothing, in visible or accessible text, that grades, locks or keeps first answers', () => {
    const GRADE_LANGUAGE = [
      /final assessment/i,
      /formative/i,
      /guided course first/i,
      /lessons? complete/i,
      /correct \/ answered/i,
      /first (?:response|attempt|decision)/i,
      /\bscor(?:e|ed|es|ing)\b/i,
      /\bmaster(?:y|ed)\b/i,
      /pass(?:ing|ed)? (?:threshold|standard)/i,
      /revise this response/i,
      /acquisition credit/i,
      /support request/i,
      /independent practice/i,
    ]
    const scan = (where: string) => {
      const text = [
        document.body.textContent ?? '',
        ...[...document.body.querySelectorAll('*')].flatMap((node) =>
          ['aria-label', 'title', 'alt'].map((name) => node.getAttribute(name) ?? ''),
        ),
      ].join('\n')
      for (const pattern of GRADE_LANGUAGE)
        expect({ where, match: text.match(pattern)?.[0] ?? null }).toEqual({ where, match: null })
    }
    render(<CoursePage />)
    scan('overview')
    cleanup()
    render(<CoursePage mode="Learn" />)
    scan('learn')
    cleanup()
    render(<IntegratedCasesPage />)
    scan('cases')
    fireEvent.click(screen.getAllByRole('button', { name: 'Open case' })[0])
    scan('integrated case')
    cleanup()
    render(<PracticePage />)
    scan('practice')
    cleanup()
    for (const lesson of [LESSONS[0], LESSONS.find((l) => l.id === 'station-seven')!]) {
      render(<LessonHost lesson={lesson} />)
      scan('lesson ' + lesson.id)
      fireEvent.click(screen.getByRole('button', { name: 'Course outline' }))
      scan('outline ' + lesson.id)
      fireEvent.click(screen.getByRole('button', { name: /Close/ }))
      let guard = 0
      while (!screen.queryByRole('heading', { name: 'Lesson finished' }) && guard++ < 20) {
        if (primary().disabled)
          fireEvent.click(screen.getByRole('button', { name: 'Continue without an image' }))
        else fireEvent.click(primary())
      }
      scan('finished ' + lesson.id)
      cleanup()
    }
  })
})
