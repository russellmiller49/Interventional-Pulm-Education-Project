import { fireEvent, render, screen, within } from '@testing-library/react'
import { CrrtFoundationLesson } from '../components/CrrtFoundationLesson'
import { crrtLearnTasks } from '../content/learnTasks'
import { BAXTER_CRRT_LEARN_LESSON_IDS } from '../content/learnerRegistry'
import { BAXTER_CRRT_PROGRESS_STORAGE_KEY } from '../engine/progress'
import { crrtOperationalTaskComplete } from '../operationalModel'

jest.mock('../operationalModel', () => {
  const actual = jest.requireActual('../operationalModel')
  return { ...actual, crrtOperationalTaskComplete: jest.fn(actual.crrtOperationalTaskComplete) }
})

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))
const items = BAXTER_CRRT_LEARN_LESSON_IDS.flatMap((lessonId) =>
  (crrtLearnTasks[lessonId] ?? [])
    .filter((task) => task.kind === 'question')
    .map((task) => ({ lessonId, task })),
)
beforeEach(() => {
  window.localStorage.clear()
  jest
    .mocked(crrtOperationalTaskComplete)
    .mockImplementation(jest.requireActual('../operationalModel').crrtOperationalTaskComplete)
})
it.each(items)(
  'independently renders reveal/retry/skip contract for $lessonId/$task.id',
  ({ lessonId, task }) => {
    render(<CrrtFoundationLesson lessonId={lessonId} onNavigate={() => {}} onRestart={() => {}} />)
    const map = screen.getByText(/Lesson tasks ·/).closest('details')!
    fireEvent.click(map.querySelector('summary')!)
    fireEvent.click(within(map).getByRole('button', { name: task.title }))
    const question = screen.getByRole('region', { name: 'Application check' })
    expect(question).toHaveTextContent('Optional try')
    expect(question.querySelector('[data-crrt-question-feedback]')).toBeNull()
    expect(question.querySelector('[data-accepted]')).toBeNull()
    fireEvent.click(within(question).getByRole('button', { name: 'Show worked explanation' }))
    expect(question).toHaveTextContent('Worked explanation · no answer recorded.')
    for (const option of task.choices!) {
      const row = question.querySelector(`[data-accepted="${option.correct}"]`)
      expect(row).not.toBeNull()
      expect(question).toHaveTextContent(option.feedback)
    }
    expect(within(question).queryByRole('radio', { checked: true })).toBeNull()
    fireEvent.click(within(question).getByRole('button', { name: 'Hide worked explanation' }))
    const accepted = task.choices!.find((c) => c.correct)!
    fireEvent.click(within(question).getByRole('radio', { name: accepted.label }))
    const check = within(question).getByRole('button', { name: 'Check reasoning' })
    if (!(check as HTMLButtonElement).disabled) {
      fireEvent.click(check)
      expect(question).toHaveTextContent(/Your choice (matches|is one of)/)
      fireEvent.click(within(question).getByRole('button', { name: 'Try again' }))
      expect(within(question).queryByRole('radio', { checked: true })).toBeNull()
    } else {
      // Existing real-run prerequisites must stay visible; they do not gate reveal or skip.
      expect(question).toHaveTextContent(/observation|run|before|complete/i)
    }
    fireEvent.click(screen.getByRole('button', { name: 'Continue without this exercise' }))
    const stored = JSON.parse(localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)!)
    expect(stored.completedLessonIds).toEqual([])
    expect(stored.attempts).toEqual({})
    expect(stored.bestSafeScores).toEqual({})
    expect(stored.learnTaskHistory).toBeUndefined()
  },
)

// Isolate the presentation contract from the already-tested operational observation gate.
// The real gate is retained in the reveal/skip matrix above; this matrix supplies ready state.
it.each(items)(
  'answer-first and retry for every authored question: $lessonId/$task.id',
  ({ lessonId, task }) => {
    jest.mocked(crrtOperationalTaskComplete).mockReturnValue(true)
    render(<CrrtFoundationLesson lessonId={lessonId} onNavigate={() => {}} onRestart={() => {}} />)
    const map = screen.getByText(/Lesson tasks ·/).closest('details')!
    fireEvent.click(map.querySelector('summary')!)
    fireEvent.click(within(map).getByRole('button', { name: task.title }))
    const question = screen.getByRole('region', { name: 'Application check' })
    for (const accepted of [false, true]) {
      const option = task.choices!.find((choice) => choice.correct === accepted)!
      fireEvent.click(within(question).getByRole('radio', { name: option.label }))
      expect(question.querySelector('[data-crrt-question-feedback]')).toBeNull()
      fireEvent.click(within(question).getByRole('button', { name: 'Check reasoning' }))
      expect(question.querySelector('[data-crrt-question-feedback]')).toHaveAttribute(
        'data-crrt-question-feedback',
        accepted ? 'accepted' : 'not-accepted',
      )
      expect(question).toHaveTextContent(option.feedback)
      fireEvent.click(within(question).getByRole('button', { name: 'Try again' }))
      expect(within(question).queryByRole('radio', { checked: true })).toBeNull()
    }
    expect(JSON.parse(localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)!).attempts).toEqual({})
  },
)
