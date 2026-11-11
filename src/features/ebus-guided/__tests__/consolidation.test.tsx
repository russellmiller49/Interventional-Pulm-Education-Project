import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { CoursePage } from '../components/CoursePage'
import { LessonHost } from '../components/LessonHost'
import {
  CONTENT_LESSONS,
  LESSONS,
  MERGED_INTO,
  lessonById,
  lessonHref,
  lessonLabel,
  partsOf,
} from '../content/curriculum'
import { GLOSSARY } from '../content/glossary'
import { activitiesForLesson } from '../content/stage'
import { PROGRESS_STORAGE_KEY, parseProgress, recommendedLesson } from '../engine/selfPacedProgress'

/*
 * Consolidation of 2026-11-10 (owner decision): five lessons were folded into the lesson before or
 * after them. These tests pin what must survive that: a merged lesson teaches both of its units
 * with each unit's own lab, old links and saved marks still resolve, and lesson numbers shown to a
 * learner follow the registry.
 */
jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
jest.mock('../components/Workbench', () => ({
  Workbench: ({
    lab,
    demonstration,
    sessionId,
  }: {
    lab: import('../content/types').Lab
    demonstration?: boolean
    sessionId: string
  }) => (
    <section
      data-mock-workbench
      data-lab={lab.modelPackage ?? lab.goal}
      data-demonstration={!!demonstration}
      data-session={sessionId}
    />
  ),
}))
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

const primary = () => document.querySelector('[data-now-primary]') as HTMLButtonElement
const skip = () => document.querySelector('[data-skip-acquisition]') as HTMLButtonElement | null
const step = () => fireEvent.click(skip() ?? primary())
const activityId = () =>
  document.querySelector('[data-ebus-flow]')!.getAttribute('data-activity-id')
const workbenches = () => [...document.querySelectorAll('[data-mock-workbench]')] as HTMLElement[]
/** Continue (leaving any lab without an image) until the named step is on screen. */
function goTo(id: string) {
  for (let guard = 0; guard < 20 && activityId() !== id; guard++) step()
  expect(activityId()).toBe(id)
}

describe('merged lessons', () => {
  const merged = LESSONS.filter((lesson) => lesson.parts)

  it('are five lessons of two units each, and every step names a unit the lesson holds', () => {
    expect(merged.map((lesson) => lesson.id)).toEqual([
      'acoustic-contact',
      'image-depth',
      'capture',
      'eus-b',
      'needle-safety',
    ])
    for (const lesson of merged) {
      const units = partsOf(lesson).map((unit) => unit.id)
      expect(units).toHaveLength(2)
      expect(units).toContain(lesson.id)
      const activities = activitiesForLesson(lesson)
      // Both units are taught, each with its own briefing and its own lab or task.
      for (const unit of units) {
        const steps = activities.filter((activity) => activity.lessonId === unit)
        expect(steps.some((activity) => activity.teaching.includes('foundation'))).toBe(true)
        expect(steps.some((activity) => activity.interaction !== 'read')).toBe(true)
      }
      // One prediction opens the lesson; it ends on a transfer.
      expect(activities.filter((activity) => activity.kind === 'prediction')).toHaveLength(1)
      expect(activities[0].kind).toBe('prediction')
      expect(activities.at(-1)!.kind).toBe('transfer')
      expect(new Set(activities.map((activity) => activity.id)).size).toBe(activities.length)
    }
  })

  it('states the lesson objective on the first briefing and the unit objective on the second', () => {
    const lesson = lessonById('image-depth')!
    const [depth, gain] = partsOf(lesson)
    render(<LessonHost lesson={lesson} />)
    goTo('image-depth:depth-example')
    expect(screen.getByText(lesson.objective, { exact: false })).toBeVisible()
    expect(screen.getByText(depth.paragraphs[0])).toBeVisible()
    goTo('gain-contrast:detail-example')
    expect(screen.getByText(gain.objective, { exact: false })).toBeVisible()
    expect(screen.getByText(gain.paragraphs[0])).toBeVisible()
    expect(screen.queryByText(depth.paragraphs[0])).not.toBeInTheDocument()
  })

  it('gives each unit its own lab and never carries the first lab into the second unit', () => {
    const lesson = lessonById('image-depth')!
    render(<LessonHost lesson={lesson} />)
    goTo('image-depth:depth-comparison')
    expect(workbenches().map((bench) => bench.dataset.lab)).toEqual(['depth'])
    const depthSession = workbenches()[0].dataset.session
    // The gain briefing shows the gain demonstration, not the depth lab left running.
    goTo('gain-contrast:detail-example')
    expect(workbenches()).toHaveLength(1)
    expect(workbenches()[0].dataset.lab).toBe('gain')
    expect(workbenches()[0].dataset.demonstration).toBe('true')
    goTo('gain-contrast:detail-comparison')
    expect(workbenches().map((bench) => bench.dataset.lab)).toEqual(['gain'])
    expect(workbenches()[0].dataset.demonstration).toBe('false')
    expect(workbenches()[0].dataset.session).not.toBe(depthSession)
  })

  it('mounts no lab behind a closing check that belongs to the first unit', () => {
    const lesson = lessonById('acoustic-contact')!
    render(<LessonHost lesson={lesson} />)
    goTo('contact-cutaway-model:contact-states')
    expect(workbenches().map((bench) => bench.dataset.lab)).toEqual(['contact'])
    goTo('acoustic-contact:apply-another-situation')
    expect(workbenches()).toHaveLength(0)
    expect(screen.getByText(lesson.transfer.prompt)).toBeVisible()
  })

  it('reaches the finish from every merged lesson without an answer or an image', () => {
    for (const lesson of merged) {
      render(<LessonHost lesson={lesson} />)
      for (
        let guard = 0;
        guard < 30 && !screen.queryByRole('heading', { name: 'Lesson finished' });
        guard++
      )
        step()
      expect(screen.getByRole('heading', { name: 'Lesson finished' })).toBeInTheDocument()
      const summary = document.querySelector('[data-session-summary]')!.textContent!
      for (const activity of activitiesForLesson(lesson)) expect(summary).toContain(activity.title)
      cleanup()
    }
  })
})

describe('old links and saved marks', () => {
  it('resolves a folded lesson to the lesson that holds it', () => {
    for (const [unit, holder] of Object.entries(MERGED_INTO)) {
      expect(lessonById(unit)!.id).toBe(holder)
      expect(lessonHref(unit)).toBe('/ebus-guided/learn?section=' + holder)
    }
    expect(lessonById('no-such-lesson')).toBeUndefined()
  })

  it('reads a record written before the consolidation forward, without rewriting it', () => {
    const stored = JSON.stringify({
      version: 1,
      lastLocation: { kind: 'lesson', id: 'measurement-phantoms' },
      visitedLessonIds: ['image-depth', 'gain-contrast', 'contact-cutaway-model'],
      reviewedLessonIds: ['image-depth', 'needle-assembly-model', 'doppler'],
      reviewLaterLessonIds: ['eus-b-route-model'],
      openedPracticeCaseIds: [],
      openedIntegratedCaseIds: [],
      updatedAt: '2026-11-01T00:00:00.000Z',
    })
    const progress = parseProgress(stored)!
    expect(progress.lastLocation).toEqual({ kind: 'lesson', id: 'capture' })
    // Opening either half counts as having opened the merged lesson, once.
    expect(progress.visitedLessonIds).toEqual(['image-depth', 'acoustic-contact'])
    // "Reviewed" carries only from the lesson that kept its id: the needle lesson was not reached
    // to its end, so it is not marked reviewed.
    expect(progress.reviewedLessonIds).toEqual(['image-depth', 'doppler'])
    expect(progress.reviewLaterLessonIds).toEqual(['eus-b'])
    expect(recommendedLesson(progress)!.id).toBe('capture')
    localStorage.setItem(PROGRESS_STORAGE_KEY, stored)
    render(<CoursePage />)
    expect(document.querySelector('[data-course-marks]')).toHaveTextContent(
      '2 of ' + LESSONS.length + ' lessons reviewed · 2 opened',
    )
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe(stored)
  })

  it('keeps a practice lab inside a merged lesson as a known place', () => {
    const stored = JSON.stringify({
      version: 1,
      lastLocation: { kind: 'practice-lab', id: 'gain-contrast' },
      visitedLessonIds: ['gain-contrast'],
      reviewedLessonIds: [],
      reviewLaterLessonIds: [],
      openedPracticeCaseIds: [],
      openedIntegratedCaseIds: [],
      updatedAt: '2026-11-01T00:00:00.000Z',
    })
    const progress = parseProgress(stored)!
    expect(progress.lastLocation).toEqual({ kind: 'practice-lab', id: 'gain-contrast' })
    expect(progress.visitedLessonIds).toEqual(['image-depth'])
    expect(recommendedLesson(progress)!.id).toBe('image-depth')
  })
})

describe('lesson numbers a learner reads', () => {
  it('come from the registry, for a lesson and for a unit folded into one', () => {
    expect(lessonLabel('clinical-question')).toBe('Lesson 1, Define the clinical question')
    const eusB = LESSONS.findIndex((lesson) => lesson.id === 'eus-b') + 1
    expect(lessonLabel('eus-b-route-model')).toBe(`Lesson ${eusB}, Where EUS-B complements EBUS`)
    // No glossary excerpt carries a number of its own.
    for (const entry of GLOSSARY)
      for (const source of entry.sources) {
        const cited = source.match(/^Lesson (\d+), ([^:]+):/)
        if (!cited) continue
        const lesson = LESSONS[Number(cited[1]) - 1]
        expect(lesson.title).toBe(cited[2])
      }
  })

  it('counts lessons and minutes from the merged registry on the hub', () => {
    render(<CoursePage />)
    // 22 lessons from 27 units: the five merges, plus the scope lesson added after them.
    expect(LESSONS).toHaveLength(22)
    expect(document.querySelector('[data-course-marks]')).toHaveTextContent(
      '0 of 22 lessons reviewed',
    )
    expect(CONTENT_LESSONS).toHaveLength(27)
  })
})
