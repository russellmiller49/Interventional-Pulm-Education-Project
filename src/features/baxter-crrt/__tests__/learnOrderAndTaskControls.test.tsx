import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'

import { BaxterCrrtHub } from '../components/BaxterCrrtHub'
import { BaxterCrrtLearn } from '../components/BaxterCrrtLearn'
import { baxterCrrtCurriculum, nextRecommendedCrrtActivity } from '../content'
import { baxterCrrtLearnLessons } from '../content/learnLessons'
import { BAXTER_CRRT_LEARN_LESSON_IDS } from '../content/learnerRegistry'
import { crrtLearnTasks } from '../content/learnTasks'
import { crrtLessonOutlineParts, selectCrrtLessonSequence } from '../learnSequence'
import { readCrrtSelfPacedProgress, recordCrrtVisit } from '../selfPacedProgress'

/**
 * CRRT-FELLOW-03 — F-10 (one canonical Learn order) and F-13 (the exercise leads, skip stays
 * visible and secondary, and a disabled completion names exactly what is left).
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
    expect(screen.getByText('Lesson 4 of 8')).toBeInTheDocument()
    const picker = screen.getByRole('combobox', { name: 'CRRT lesson' })
    expect(
      within(picker)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(baxterCrrtLearnLessons.map((lesson, index) => `${index + 1}. ${lesson.title}`))
    const steps = screen.getByRole('navigation', { name: 'Previous and next lesson' })
    expect(within(steps).getByRole('button', { name: /^Previous lesson: 3\. / })).toBeVisible()
    fireEvent.click(within(steps).getByRole('button', { name: /^Next lesson: 5\. / }))
    expect(screen.getByText('Lesson 5 of 8')).toBeInTheDocument()
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
    expect(screen.getByText('Lesson 8 of 8')).toBeInTheDocument()
  })

  it('the hub map numbers lessons in that order and labels stations as topical groups', async () => {
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
    expect(screen.getByText(/They are not a required order/)).toBeInTheDocument()
    // A station chip keeps the lesson's canonical number, whichever station holds it.
    for (const unit of baxterCrrtCurriculum) {
      for (const lessonId of unit.lessonIds) {
        const number = BAXTER_CRRT_LEARN_LESSON_IDS.indexOf(lessonId) + 1
        expect(screen.getAllByText(new RegExp(`^Lesson ${number} · `)).length).toBeGreaterThan(0)
      }
    }
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

  it('shows a visited station note as its own wrapping pill, not in the number circle (F-20)', async () => {
    const unit = baxterCrrtCurriculum[0]
    for (const lessonId of unit.lessonIds) recordCrrtVisit({ section: 'learn', id: lessonId })
    for (const caseId of unit.coreCaseIds) recordCrrtVisit({ section: 'practice', id: caseId })
    render(<BaxterCrrtHub />)
    await settle()
    const note = screen.getByText('Every lesson and core case here opened', { exact: false })
    const heading = note.closest('div')!
    expect(within(heading).getByText('1', { exact: false })).not.toBe(note)
    expect(note.className).not.toBe(heading.querySelector('span')!.className)
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

describe('exercise controls follow the exercise (F-13)', () => {
  const actions = () => screen.getByRole('group', { name: 'Continue from this task' })

  it('leads with the completion button and a named reason, and keeps skip beside it', () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-circuit-pressures" />)
    const group = actions()
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Review observations and continue',
      'Continue without this exercise',
    ])
    const primary = buttons[0]
    expect(primary).toBeDisabled()
    expect(primary).toHaveAccessibleDescription(
      'Still to select, in order: Patient access, Pre-pump segment, Blood pump, Filter, Return segment, Patient return.',
    )
    // The controls come after the exercise, not before it.
    const workbench = document.querySelector('[data-crrt-circuit-workbench]')!
    expect(workbench.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The skip is a full, focusable button — not hidden, not a tiny link.
    const skip = within(group).getByRole('button', { name: 'Continue without this exercise' })
    skip.focus()
    expect(document.activeElement).toBe(skip)
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
    fireEvent.click(primary)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Add the fluids one path at a time' }),
    ).toBeVisible()
  })

  it('continuing without the exercise marks nothing as reviewed', () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-circuit-pressures" />)
    fireEvent.click(
      within(actions()).getByRole('button', { name: 'Continue without this exercise' }),
    )
    fireEvent.click(screen.getByText(/^Lesson tasks ·/))
    const map = screen.getByText(/^Lesson tasks ·/).closest('details')!
    expect(within(map).queryByText(/· reviewed$/)).toBeNull()
    expect(within(map).getAllByRole('button')[0]).not.toHaveTextContent('reviewed')
  })

  it('a reading task keeps its single Continue on the card and has no exercise controls', () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-indications-modality" />)
    expect(screen.queryByRole('group', { name: 'Continue from this task' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveAttribute('data-now-primary')
  })

  it('an exercise with its own check keeps only the optional skip here', () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-circuit-pressures" />)
    for (let step = 0; step < 4; step++)
      fireEvent.click(
        within(actions()).getByRole('button', { name: 'Continue without this exercise' }),
      )
    const group = actions()
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Continue without this exercise'])
    expect(group).toHaveTextContent('This exercise has its own check and continue buttons above.')
  })
})
