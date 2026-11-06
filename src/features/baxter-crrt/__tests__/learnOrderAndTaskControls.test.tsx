import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'

import { BaxterCrrtHub } from '../components/BaxterCrrtHub'
import { BaxterCrrtLearn } from '../components/BaxterCrrtLearn'
import {
  baxterCrrtAdditionalCaseIds,
  baxterCrrtCoreCaseIds,
  baxterCrrtCurriculum,
  nextRecommendedCrrtActivity,
} from '../content'
import { baxterCrrtLearnLessons } from '../content/learnLessons'
import { BAXTER_CRRT_LEARN_LESSON_IDS } from '../content/learnerRegistry'
import { crrtLearnTasks } from '../content/learnTasks'
import { crrtLessonOutlineParts, selectCrrtLessonSequence } from '../learnSequence'
import { readCrrtSelfPacedProgress, recordCrrtVisit } from '../selfPacedProgress'

/**
 * CRRT-FELLOW-03 — F-10 (one canonical Learn order) and F-13 (the exercise leads, skip stays
 * visible and secondary, and a disabled completion names exactly what is left). Tester report
 * 2026-11-05: one lesson list on the hub, and one Skip in place of the jump button and the
 * "Continue without this exercise" box.
 */

jest.mock('@/features/critical-care/analytics', () => ({ recordCriticalCareEvent: jest.fn() }))
jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : `${href.pathname}?${new URLSearchParams(href.query ?? {}).toString()}`
      }
      {...rest}
    >
      {children}
    </a>
  ),
}))

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => window.localStorage.clear())

describe('one canonical Learn order (F-10)', () => {
  it('the registry, the lesson list and the pathway carry the same eight lessons in one order', () => {
    expect(baxterCrrtLearnLessons.map((lesson) => lesson.id)).toEqual([
      ...BAXTER_CRRT_LEARN_LESSON_IDS,
    ])
    expect(criticalCareLearningPathway('baxter-crrt').sections.map((s) => s.id)).toEqual([
      ...BAXTER_CRRT_LEARN_LESSON_IDS,
    ])
  })

  it('numbers first, middle and last lessons and steps between them without wrapping', () => {
    const first = selectCrrtLessonSequence(BAXTER_CRRT_LEARN_LESSON_IDS[0])
    const middle = selectCrrtLessonSequence(BAXTER_CRRT_LEARN_LESSON_IDS[3])
    const last = selectCrrtLessonSequence(BAXTER_CRRT_LEARN_LESSON_IDS[7])
    expect([first.number, first.previousLessonId, first.nextLessonId]).toEqual([
      1,
      null,
      BAXTER_CRRT_LEARN_LESSON_IDS[1],
    ])
    expect([middle.number, middle.previousLessonId, middle.nextLessonId]).toEqual([
      4,
      BAXTER_CRRT_LEARN_LESSON_IDS[2],
      BAXTER_CRRT_LEARN_LESSON_IDS[4],
    ])
    expect([last.number, last.nextLessonId, last.total]).toEqual([8, null, 8])
  })

  it('the lesson picker, the header number and previous/next agree on the middle lesson', () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-prescription-dosing" />)
    expect(
      screen.getByText('Lesson 4 of 8', { selector: '[data-crrt-lesson-number]' }),
    ).toBeInTheDocument()
    const picker = screen.getByRole('navigation', { name: 'CRRT lessons sections' })
    expect(
      within(picker)
        .getAllByRole('button')
        .map((option) => option.getAttribute('aria-label')),
    ).toEqual(baxterCrrtLearnLessons.map((lesson, index) => `${index + 1}. ${lesson.title}`))
    expect(within(picker).getByRole('button', { current: 'step' })).toHaveAccessibleName(
      `4. ${baxterCrrtLearnLessons[3].title}`,
    )
    expect(document.querySelector('[data-sections-drawer] summary')).toHaveTextContent(
      'Lessons4 of 8',
    )
    const steps = screen.getByRole('navigation', { name: 'Previous and next lesson' })
    expect(within(steps).getByRole('button', { name: /^Previous lesson: 3\. / })).toBeVisible()
    fireEvent.click(within(steps).getByRole('button', { name: /^Next lesson: 5\. / }))
    expect(
      screen.getByText('Lesson 5 of 8', { selector: '[data-crrt-lesson-number]' }),
    ).toBeInTheDocument()
    expect(new URL(window.location.href).searchParams.get('lesson')).toBe(
      'crrt-alarms-troubleshooting',
    )
  })

  it('states the ends instead of offering a step that does not exist', () => {
    const first = render(<BaxterCrrtLearn initialLessonId={BAXTER_CRRT_LEARN_LESSON_IDS[0]} />)
    expect(screen.getByText('First lesson')).toBeInTheDocument()
    first.unmount()
    render(<BaxterCrrtLearn initialLessonId={BAXTER_CRRT_LEARN_LESSON_IDS[7]} />)
    expect(screen.getByText('Last lesson')).toBeInTheDocument()
    expect(
      screen.getByText('Lesson 8 of 8', { selector: '[data-crrt-lesson-number]' }),
    ).toBeInTheDocument()
  })

  it('the hub keeps one numbered lesson list, each lesson with a line on what it teaches', async () => {
    render(<BaxterCrrtHub />)
    await settle()
    const sequence = screen.getByRole('list', { name: 'Recommended Learn sequence' })
    const links = within(sequence).getAllByRole('link')
    expect(links.map((link) => new URL(link.getAttribute('href')!, 'https://x').search)).toEqual(
      BAXTER_CRRT_LEARN_LESSON_IDS.map((id) => `?lesson=${id}`),
    )
    expect(links.map((link) => link.textContent?.match(/^\d+/)?.[0])).toEqual(
      BAXTER_CRRT_LEARN_LESSON_IDS.map((_, index) => String(index + 1)),
    )
    // All eight lessons, each with its one-line blurb (tester report, 2026-11-05).
    for (const [index, lesson] of baxterCrrtLearnLessons.entries()) {
      expect(links[index]).toHaveTextContent(lesson.title)
      expect(links[index]).toHaveTextContent(lesson.summary)
    }
    // No second, topical list of the same lessons: the map links each lesson exactly once.
    const map = screen.getByRole('region', { name: 'Curriculum map' })
    for (const lessonId of BAXTER_CRRT_LEARN_LESSON_IDS) {
      expect(map.querySelectorAll(`a[href$="?lesson=${lessonId}"]`)).toHaveLength(1)
    }
    expect(screen.queryByText(/Topic station/)).toBeNull()
    expect(screen.queryByText(/They are not a required order/)).toBeNull()
  })

  it('every practice case the topic stations used to link is still one click away in Practice', async () => {
    render(<BaxterCrrtHub />)
    await settle()
    const practice = screen.getByRole('link', { name: 'Open practice' })
    expect(practice).toHaveAttribute('href', '/baxter-crrt/practice')
    expect(practice.closest('article')).toHaveTextContent(
      `${baxterCrrtCoreCaseIds.length} core cases and ${baxterCrrtAdditionalCaseIds.length} additional`,
    )
    // The Practice Cases list carries every core and additional case the stations grouped
    // (pinned in practiceAssess.ui.test.tsx); the stations held nothing else.
    expect(baxterCrrtCurriculum.flatMap((unit) => unit.coreCaseIds)).toEqual([
      ...baxterCrrtCoreCaseIds,
    ])
    expect(baxterCrrtCurriculum.flatMap((unit) => unit.additionalCaseIds)).toEqual([
      ...baxterCrrtAdditionalCaseIds,
    ])
  })

  it('Resume follows the same order from the existing local record', async () => {
    recordCrrtVisit({ section: 'learn', id: BAXTER_CRRT_LEARN_LESSON_IDS[0] })
    recordCrrtVisit({ section: 'learn', id: BAXTER_CRRT_LEARN_LESSON_IDS[2] })
    const progress = readCrrtSelfPacedProgress()
    const next = nextRecommendedCrrtActivity({
      completedLessonIds: progress.visitedLessonIds,
      completedPracticeCaseIds: progress.visitedCaseIds,
    })
    expect(next).toMatchObject({ kind: 'lesson', id: BAXTER_CRRT_LEARN_LESSON_IDS[1] })
    render(<BaxterCrrtHub />)
    await settle()
    const resume = screen.getByRole('link', { name: /Continue to the next topic/ })
    expect(resume).toHaveTextContent('Lesson 2: Circuit anatomy and pressure localization')
    expect(resume).toHaveAttribute(
      'href',
      `/baxter-crrt/learn?lesson=${BAXTER_CRRT_LEARN_LESSON_IDS[1]}`,
    )
  })
})

describe('in-lesson outline for the long alarms lesson (X-03)', () => {
  it('labels the authored task order in parts without moving, dropping or adding a task', () => {
    for (const [lessonId, parts] of Object.entries(crrtLessonOutlineParts)) {
      const authored = crrtLearnTasks[lessonId as keyof typeof crrtLearnTasks]!.map((t) => t.id)
      expect(parts!.flatMap((part) => part.taskIds)).toEqual(authored)
    }
  })

  it('shows the parts in the Lesson tasks outline and keeps every task reachable', () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-alarms-troubleshooting" />)
    const map = screen.getByText(/^Lesson tasks ·/).closest('details')!
    expect(within(map).getByText('Part 1 · Set up and read a normal run')).toBeInTheDocument()
    expect(
      within(map).getByText('Part 2 · A new run with an alert, cause first'),
    ).toBeInTheDocument()
    const buttons = within(map).getAllByRole('button')
    expect(buttons).toHaveLength(crrtLearnTasks['crrt-alarms-troubleshooting']!.length)
    fireEvent.click(buttons[4])
    expect(buttons[4]).toHaveAttribute('aria-current', 'step')
    expect(new URL(window.location.href).searchParams.get('lesson')).not.toBe('')
  })
})

describe('exercise controls follow the exercise (F-13), with one Skip', () => {
  const actions = () => screen.getByRole('group', { name: 'Task actions' })
  const skip = () => screen.getByRole('button', { name: 'Skip this task' })

  it('leads with the completion button and a named reason, with Skip beside it', () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-circuit-pressures" />)
    const group = actions()
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Review observations and continue',
      'Skip',
    ])
    const primary = buttons[0]
    expect(primary).toBeDisabled()
    expect(primary).toHaveAccessibleDescription(
      'Still to select, in order: Patient access, Pre-pump segment, Blood pump, Filter, Return segment, Patient return.',
    )
    // The controls come after the exercise, not before it.
    const workbench = document.querySelector('[data-crrt-circuit-workbench]')!
    expect(workbench.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // One Skip, a full focusable button; no jump button or second skip elsewhere on the task.
    expect(
      screen.getAllByRole('button', { name: /Skip|continue without|continue controls/i }),
    ).toEqual([skip()])
    expect(screen.queryByText(/Where to look/)).toBeNull()
    skip().focus()
    expect(document.activeElement).toBe(skip())
  })

  it('counts this visit’s own selections and updates the reason until the task is ready', () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-circuit-pressures" />)
    expect(screen.getByText('0 of 6 stops selected · select them in order')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Patient access' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pre-pump segment' }))
    expect(screen.getByText('2 of 6 stops selected · select them in order')).toBeInTheDocument()
    expect(
      within(actions()).getByRole('button', { name: 'Review observations and continue' }),
    ).toHaveAccessibleDescription(
      'Still to select, in order: Blood pump, Filter, Return segment, Patient return.',
    )
    for (const name of ['Blood pump', 'Filter', 'Return segment', 'Patient return'])
      fireEvent.click(screen.getByRole('button', { name }))
    expect(screen.getByText('6 of 6 stops selected')).toBeInTheDocument()
    const primary = within(actions()).getByRole('button', {
      name: 'Review observations and continue',
    })
    expect(primary).toBeEnabled()
    // With the way on available, Skip leaves: the row never offers two ways forward.
    expect(within(actions()).getAllByRole('button')).toEqual([primary])
    fireEvent.click(primary)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Add the fluids one path at a time' }),
    ).toBeVisible()
  })

  it('Skip marks nothing as reviewed and puts focus on the next task heading', () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-circuit-pressures" />)
    fireEvent.click(skip())
    const heading = screen.getByRole('heading', {
      level: 2,
      name: crrtLearnTasks['crrt-circuit-pressures']![1].title,
    })
    expect(heading).toHaveFocus()
    fireEvent.click(screen.getByText(/^Lesson tasks ·/))
    const map = screen.getByText(/^Lesson tasks ·/).closest('details')!
    expect(within(map).queryByText(/· reviewed$/)).toBeNull()
    expect(within(map).getAllByRole('button')[0]).not.toHaveTextContent('reviewed')
  })

  it('a reading task keeps its single Continue on the card and has no Skip', () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-indications-modality" />)
    expect(screen.queryByRole('group', { name: 'Task actions' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Skip this task' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveAttribute('data-now-primary')
  })

  it('an exercise with its own check carries only Skip after it, until its own continue appears', () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-circuit-pressures" />)
    for (let step = 0; step < 3; step++) fireEvent.click(skip())
    // Task 4: the pressure lab, which has its own commit, reveal and continue.
    expect(
      within(actions())
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Skip'])
    fireEvent.click(skip())
    // Task 5: a question; Skip sits in the question's own row beside Check reasoning.
    const question = screen.getByRole('region', { name: 'Application check' })
    expect(screen.queryByRole('group', { name: 'Task actions' })).toBeNull()
    expect(
      within(question)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Show worked explanation', 'Check reasoning', 'Skip'])
    fireEvent.click(within(question).getAllByRole('radio')[0])
    fireEvent.click(within(question).getByRole('button', { name: 'Check reasoning' }))
    // Feedback brings its own continue; Skip goes.
    expect(screen.queryByRole('button', { name: 'Skip this task' })).toBeNull()
    expect(
      within(question).getByRole('button', { name: 'Review feedback and continue' }),
    ).toBeInTheDocument()
  })
})
