import fs from 'node:fs'
import path from 'node:path'
import { act, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import {
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  createEmptyCriticalCareProgress,
  upsertCriticalCareActivityProgress,
  writeCriticalCareProgress,
} from '@/features/learning-module/activity/progress'
import { BranchTracingOverview } from '../components/BranchTracingOverview'
import { BASE_PATH, SOURCE, lessonHref } from '../content/module'
import { NAV_LESSONS } from '../content/nav-lessons'
import { NAV_STORAGE_KEY } from '../engine/nav-storage'
import {
  emptySelfPacedRecord,
  parseSelfPacedRecord,
  readSelfPacedRecord,
  recommendedLesson,
  recordLessonOpened,
  SELF_PACED_CHANGED_EVENT,
  SELF_PACED_STORAGE_KEY,
  setLessonReviewed,
  setLessonReviewLater,
  updateSelfPacedRecord,
} from '../engine/selfPacedProgress'

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/learn/anatomy/branch-tracing',
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

beforeEach(() => {
  window.localStorage.clear()
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
const storedKeys = () =>
  Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!).sort()

const [FIRST, SECOND, THIRD] = NAV_LESSONS.map((lesson) => lesson.id)

/** Grade, lock and surveillance wording the self-paced course must not show or announce. */
const GRADE_WORDING = [
  /first (attempt|response)/i,
  /hint level/i,
  /independent (interpretation|application)/i,
  /ungraded check/i,
  /tracing reminder used/i,
  /\(preserved\)/i,
  /submit all/i,
  /(withheld|hidden) until/i,
  /\bmastery\b/i,
  /\bpass(ed)? (the|threshold met)/i,
  /Assess ·/,
]
function expectNoGradeWording(root: HTMLElement) {
  const text = [
    root.textContent ?? '',
    ...Array.from(root.querySelectorAll('[aria-label]')).map((el) => el.getAttribute('aria-label')),
  ].join('\n')
  for (const pattern of GRADE_WORDING)
    expect([String(pattern), pattern.test(text)]).toEqual([String(pattern), false])
}

describe('self-paced record', () => {
  it('stores only declared place fields, writes idempotently and never overwrites an unreadable value', () => {
    expect([FIRST, SECOND, THIRD]).toEqual(['carina-orientation', 'two-levels', 'middle-lobe-flat'])
    expect(readSelfPacedRecord(localStorage).status).toBe('empty')
    expect(recordLessonOpened(FIRST, localStorage)).toBe(true)
    const once = localStorage.getItem(SELF_PACED_STORAGE_KEY)
    expect(recordLessonOpened(FIRST, localStorage)).toBe(true)
    expect(localStorage.getItem(SELF_PACED_STORAGE_KEY)).toBe(once)
    setLessonReviewed(FIRST, true, localStorage)
    setLessonReviewLater(SECOND, true, localStorage)
    const { status, record } = readSelfPacedRecord(localStorage)
    expect(status).toBe('saved')
    expect(Object.keys(record).sort()).toEqual([
      'lastLessonId',
      'reviewLaterLessonIds',
      'reviewedLessonIds',
      'updatedAt',
      'version',
      'visitedLessonIds',
    ])
    expect(record).toMatchObject({
      version: 1,
      lastLessonId: FIRST,
      visitedLessonIds: [FIRST],
      reviewedLessonIds: [FIRST],
      reviewLaterLessonIds: [SECOND],
    })
    expect(Number.isNaN(Date.parse(record.updatedAt))).toBe(false)
    expect(storedKeys()).toEqual([SELF_PACED_STORAGE_KEY])
    // Un-setting removes the id and nothing else.
    setLessonReviewed(FIRST, false, localStorage)
    setLessonReviewLater(SECOND, false, localStorage)
    expect(readSelfPacedRecord(localStorage).record).toMatchObject({
      lastLessonId: FIRST,
      visitedLessonIds: [FIRST],
      reviewedLessonIds: [],
      reviewLaterLessonIds: [],
    })
    // A record with a field the course does not declare is unreadable, and is left as it is.
    localStorage.setItem(SELF_PACED_STORAGE_KEY, JSON.stringify({ ...record, marks: [[1, 2]] }))
    expect(readSelfPacedRecord(localStorage).status).toBe('unreadable')
    const carrying = localStorage.getItem(SELF_PACED_STORAGE_KEY)
    expect(setLessonReviewed(SECOND, true, localStorage)).toBe(false)
    expect(localStorage.getItem(SELF_PACED_STORAGE_KEY)).toBe(carrying)
    localStorage.setItem(SELF_PACED_STORAGE_KEY, '{not json')
    expect(recordLessonOpened(SECOND, localStorage)).toBe(false)
    expect(localStorage.getItem(SELF_PACED_STORAGE_KEY)).toBe('{not json')
    expect(recordLessonOpened(SECOND, null)).toBe(false)
    expect(readSelfPacedRecord(null)).toEqual({
      status: 'unavailable',
      record: emptySelfPacedRecord(),
    })
  })

  it('still reads a record written by the earlier course, and keeps its legacy field on the next write', () => {
    const earlier = {
      version: 1,
      lastLessonId: 'follow-one-airway',
      visitedLessonIds: ['follow-one-airway', 'vertical'],
      reviewedLessonIds: ['follow-one-airway'],
      reviewLaterLessonIds: ['continuity'],
      displayExplanationsShown: ['mirror'],
      updatedAt: '2026-09-01T00:00:00.000Z',
    }
    expect(parseSelfPacedRecord(JSON.stringify(earlier))).toEqual({
      status: 'saved',
      record: earlier,
    })
    // Without the legacy field the record is just as readable; a wrong type in it is not.
    const { displayExplanationsShown, ...current } = earlier
    expect(displayExplanationsShown).toEqual(['mirror'])
    expect(parseSelfPacedRecord(JSON.stringify(current)).status).toBe('saved')
    expect(
      parseSelfPacedRecord(JSON.stringify({ ...earlier, displayExplanationsShown: 'mirror' }))
        .status,
    ).toBe('unreadable')
    expect(parseSelfPacedRecord(JSON.stringify({ ...current, version: 2 })).status).toBe(
      'unreadable',
    )
    expect(parseSelfPacedRecord(null)).toEqual({ status: 'empty', record: emptySelfPacedRecord() })
    // Ids of lessons that no longer exist are carried, never dropped: opening a new lesson adds to them.
    localStorage.setItem(SELF_PACED_STORAGE_KEY, JSON.stringify(earlier))
    expect(recordLessonOpened(FIRST, localStorage)).toBe(true)
    expect(readSelfPacedRecord(localStorage).record).toMatchObject({
      lastLessonId: FIRST,
      visitedLessonIds: ['follow-one-airway', 'vertical', FIRST],
      reviewedLessonIds: ['follow-one-airway'],
      reviewLaterLessonIds: ['continuity'],
      displayExplanationsShown: ['mirror'],
    })
  })

  it('announces a change once, and not at all when nothing changed', () => {
    const heard = jest.fn()
    window.addEventListener(SELF_PACED_CHANGED_EVENT, heard)
    try {
      expect(recordLessonOpened(FIRST, localStorage)).toBe(true)
      expect(heard).toHaveBeenCalledTimes(1)
      expect(recordLessonOpened(FIRST, localStorage)).toBe(true)
      expect(updateSelfPacedRecord((record) => record, localStorage)).toBe(true)
      expect(heard).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener(SELF_PACED_CHANGED_EVENT, heard)
    }
  })

  it('recommends from the self-paced record and the lesson registry only', () => {
    const empty = emptySelfPacedRecord()
    expect(recommendedLesson(empty)).toMatchObject({ kind: 'start', lesson: { id: FIRST } })
    expect(
      recommendedLesson({ ...empty, lastLessonId: THIRD, visitedLessonIds: [THIRD] }),
    ).toMatchObject({ kind: 'resume', lesson: { id: THIRD } })
    expect(
      recommendedLesson({
        ...empty,
        lastLessonId: FIRST,
        visitedLessonIds: [FIRST],
        reviewedLessonIds: [FIRST],
      }),
    ).toMatchObject({ kind: 'continue', lesson: { id: SECOND } })
    // A place in a lesson of the earlier course is not a place in this one.
    expect(
      recommendedLesson({ ...empty, lastLessonId: 'vertical', visitedLessonIds: ['vertical'] }),
    ).toMatchObject({ kind: 'continue', lesson: { id: FIRST } })
    expect(
      recommendedLesson({ ...empty, reviewedLessonIds: NAV_LESSONS.map((l) => l.id) }),
    ).toBeNull()
    // Each lesson in turn is the next one once those before it are reached.
    NAV_LESSONS.forEach((lesson, i) =>
      expect(
        recommendedLesson({
          ...empty,
          reviewedLessonIds: NAV_LESSONS.slice(0, i).map((l) => l.id),
        })?.lesson.id,
      ).toBe(lesson.id),
    )
  })
})

describe('storage boundary', () => {
  const featureRoot = path.join(process.cwd(), 'src/features/bronchial-branch-tracing')
  const sourceFiles = (dir: string): string[] =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? entry.name === '__tests__'
            ? []
            : sourceFiles(path.join(dir, entry.name))
          : /\.tsx?$/.test(entry.name)
            ? [path.join(dir, entry.name)]
            : [],
      )
  it('no course source writes the shared activity envelope, imports the legacy readers, or writes storage outside the declared owners', () => {
    // Each file that writes to this device, and the one key it writes: the course place, the
    // place within a trip, and whether the bench's primer has been seen. Nothing else is stored.
    const writers: Record<string, string> = {
      'engine/selfPacedProgress.ts': 'SELF_PACED_STORAGE_KEY',
      'engine/nav-storage.ts': 'NAV_STORAGE_KEY',
      'components/NavigationBench.tsx': 'PRIMER_SEEN_KEY',
    }
    const files = sourceFiles(featureRoot)
    expect(files.length).toBeGreaterThan(20)
    const found: string[] = []
    const keys: string[] = []
    for (const file of files) {
      const rel = path.relative(featureRoot, file).split(path.sep).join('/')
      const text = fs.readFileSync(file, 'utf8')
      expect([
        rel,
        /writeCriticalCareProgress|upsertCriticalCareActivityProgress|CRITICAL_CARE_PROGRESS_STORAGE_KEY/.test(
          text,
        ),
      ]).toEqual([rel, false])
      expect([rel, /from '(\.\.\/engine|\.)\/progress'/.test(text)]).toEqual([rel, false])
      expect([rel, /sessionStorage|indexedDB|document\.cookie/.test(text)]).toEqual([rel, false])
      const written = [...text.matchAll(/\.(?:setItem|removeItem)\(\s*([^,)\s]+)/g)].map(
        (m) => m[1],
      )
      if (!written.length) continue
      found.push(rel)
      // A declared owner writes its own key and no other.
      expect([rel, [...new Set(written)]]).toEqual([rel, [writers[rel]]])
      keys.push(text.match(new RegExp(`export const ${writers[rel]} = '([^']+)'`))![1])
    }
    expect(found.sort()).toEqual(Object.keys(writers).sort())
    // Three keys, each the module's own.
    expect(keys.sort()).toEqual([
      'branch-tracing.nav-v1',
      'branch-tracing.primer-seen-v1',
      'branch-tracing.self-paced-v1',
    ])
    expect(keys).toContain(NAV_STORAGE_KEY)
    expect(keys).toContain(SELF_PACED_STORAGE_KEY)
  })
})

describe('Overview', () => {
  it('opens every lesson, starts at lesson 1, cites the named source and shows no grade', async () => {
    const { container } = render(<BranchTracingOverview />)
    const start = await screen.findByRole('link', { name: 'Start lesson 1' })
    expect(start).toHaveAttribute('href', lessonHref(FIRST))
    expect(lessonHref(FIRST)).toBe(`${BASE_PATH}/learn?lesson=${FIRST}`)
    for (const lesson of NAV_LESSONS) {
      const link = Array.from(container.querySelectorAll('[data-lesson-group] a')).find(
        (a) => a.getAttribute('href') === lessonHref(lesson.id),
      )
      expect([lesson.id, link?.textContent]).toEqual([lesson.id, lesson.title])
    }
    expect(container.querySelectorAll('[data-lesson-group] a')).toHaveLength(NAV_LESSONS.length)
    expect(screen.getByRole('link', { name: SOURCE.title })).toHaveAttribute('href', SOURCE.url)
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).toContain(`${BASE_PATH}/practice`)
    expect(hrefs).toContain(`${BASE_PATH}/assess`)
    expect(container.querySelector('[data-teaching-simulator-statement]')).not.toBeNull()
    expectNoGradeWording(container)
    expect(await axe(container)).toHaveNoViolations()
    // Looking at the overview saves nothing.
    expect(storedKeys()).toEqual([])
  })

  it('continues from the self-paced record, ignores legacy completions and scores, and leaves their bytes unchanged', async () => {
    const at = '2026-09-01T00:00:00.000Z'
    let legacy = createEmptyCriticalCareProgress(at)
    for (const lesson of NAV_LESSONS)
      legacy = upsertCriticalCareActivityProgress(legacy, {
        activityId: `bronchial-branch-tracing.learn.${lesson.id}`,
        status: 'completed',
        attempts: 1,
        bestScore: 100,
        hintCount: 0,
        competencyEvidenceIds: [],
        updatedAt: at,
      })
    writeCriticalCareProgress(localStorage, legacy)
    const bytes = localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)
    expect(bytes).not.toBeNull()
    render(<BranchTracingOverview />)
    expect(await screen.findByRole('link', { name: 'Start lesson 1' })).toBeVisible()
    expect(screen.queryByText('Reached the end')).toBeNull()
    act(() => {
      recordLessonOpened(FIRST)
      setLessonReviewed(FIRST, true)
    })
    expect(screen.getByRole('link', { name: `Continue: ${NAV_LESSONS[1].title}` })).toHaveAttribute(
      'href',
      lessonHref(SECOND),
    )
    expect(screen.getAllByText('Reached the end')).toHaveLength(1)
    act(() => {
      recordLessonOpened(THIRD)
    })
    expect(screen.getByRole('link', { name: `Resume: ${NAV_LESSONS[2].title}` })).toHaveAttribute(
      'href',
      lessonHref(THIRD),
    )
    expect(localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBe(bytes)
  })

  it('leaves a saved place it cannot read untouched, and still opens the course', async () => {
    localStorage.setItem(SELF_PACED_STORAGE_KEY, '{"version":2}')
    render(<BranchTracingOverview />)
    expect(await screen.findByRole('link', { name: 'Start lesson 1' })).toHaveAttribute(
      'href',
      lessonHref(FIRST),
    )
    expect(localStorage.getItem(SELF_PACED_STORAGE_KEY)).toBe('{"version":2}')
  })
})
