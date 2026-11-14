import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import type { EusbObservation } from '@/lib/eus-b-guided-bridge'
import { LessonHost } from '../components/LessonHost'
import type { StageRequest } from '../components/Workbench'
import { LESSONS, lessonById, nextLesson } from '../content/curriculum'
import { stationById } from '../content/stations'
import { PROGRESS_STORAGE_KEY, readProgress } from '../engine/progress'
import { held, marking, searching, shown } from '../testing/observations'

const mockBench: {
  emit: (observation: EusbObservation) => void
  stage: StageRequest | null
  sessionId: string
  mounts: number
} = { emit: () => {}, stage: null, sessionId: '', mounts: 0 }

jest.mock('../components/Workbench', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react')
  return {
    Workbench: ({
      stage,
      sessionId,
      onObservation,
    }: {
      stage: StageRequest
      sessionId: string
      onObservation: (observation: EusbObservation) => void
    }) => {
      mockBench.emit = onObservation
      mockBench.stage = stage
      mockBench.sessionId = sessionId
      useEffect(() => {
        mockBench.mounts += 1
      }, [])
      return (
        <div
          data-testid="lab"
          data-lab={stage.labId}
          data-phase={stage.phase}
          data-names={stage.names}
          data-held={stage.held ? stage.held[0].frameId : ''}
        />
      )
    },
  }
})
jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string
    children: ReactNode
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const liver = lessonById('liver')!
const first = LESSONS[0]

beforeEach(() => {
  window.localStorage.clear()
  mockBench.stage = null
  mockBench.mounts = 0
})
afterEach(cleanup)

function open(lesson = liver) {
  const view = render(<LessonHost lesson={lesson} />)
  const flow = () => view.container.querySelector('[data-eusb-flow]')!
  const pane = () => within(view.container.querySelector<HTMLElement>('[data-text-pane]')!)
  const primary = () => view.container.querySelector<HTMLButtonElement>('[data-now-primary]')!
  const activity = () => flow().getAttribute('data-activity-id')
  const next = () => fireEvent.click(primary())
  return { ...view, flow, pane, primary, activity, next }
}
const allText = (lesson = liver) =>
  lesson.steps.flatMap((step) =>
    'question' in step
      ? [step.question.explanation, ...step.question.choices.map((choice) => choice.rationale)]
      : [],
  )

describe('a lesson, task by task', () => {
  it('opens on the prediction with nothing that answers it on the page', () => {
    const { container, flow, primary } = open()
    expect(flow()).toHaveAttribute('data-step-kind', 'predict')
    expect(flow()).toHaveAttribute('data-arrange', 'hidden')
    const text = container.textContent!
    for (const reason of allText()) expect(text).not.toContain(reason)
    // Later tasks are not named anywhere, and no verdict or explanation is mounted.
    for (const step of liver.steps.slice(1)) expect(text).not.toContain(step.title)
    expect(container.querySelector('[data-answer-verdict]')).toBeNull()
    expect(container.querySelector('[data-explanation-reveal]')).toBeNull()
    expect(primary()).toHaveTextContent('Continue without answering')
    expect(primary()).toBeEnabled()
  })

  it('names a task in the outline only once it has been reached', () => {
    const { container, next } = open()
    fireEvent.click(container.querySelector('[data-open-outline]')!)
    const outline = container.querySelector('[data-outline]')!
    expect(outline).toHaveTextContent(liver.steps[0].title)
    for (const step of liver.steps.slice(1)) expect(outline).not.toHaveTextContent(step.title)
    expect(outline).toHaveTextContent('Find the view')
    next()
    expect(container.querySelector('[data-outline]') ?? container).toBeTruthy()
  })

  it('gives the verdict and the reasons only after a response is checked', () => {
    const { container, pane, primary } = open()
    const question = liver.steps[0].kind === 'predict' ? liver.steps[0].question : null
    const keyed = question!.choices.find((choice) => choice.correct)!
    const check = pane().getByRole('button', { name: 'Check response' })
    expect(check).toBeDisabled()
    fireEvent.click(pane().getByLabelText(keyed.text))
    expect(container.querySelector('[data-answer-verdict]')).toBeNull()
    fireEvent.click(check)
    expect(container.querySelector('[data-answer-verdict]')).not.toBeNull()
    expect(container).toHaveTextContent(keyed.rationale)
    expect(primary()).toHaveTextContent('Continue')
    expect(primary()).not.toHaveTextContent('without answering')
  })

  it('shows the labeled landmark beside the briefing before asking for it', () => {
    const { flow, next } = open()
    next()
    expect(flow()).toHaveAttribute('data-step-kind', 'brief')
    expect(flow()).toHaveAttribute('data-arrange', 'beside')
    expect(mockBench.stage).toMatchObject({ labId: 'liver-view', phase: 'review', names: 'shown' })
  })

  it('keeps the way on closed until the view is held, and says what it is waiting for', () => {
    const { container, flow, next, primary } = open()
    next()
    next()
    expect(flow()).toHaveAttribute('data-step-kind', 'lab')
    expect(flow()).toHaveAttribute('data-arrange', 'console')
    expect(mockBench.stage).toMatchObject({ labId: 'liver-reach', phase: 'work', names: 'hidden' })
    // A scope task shows the white light view beside the ultrasound image.
    expect(mockBench.stage!.panes).toEqual(['ultrasound', 'endoscope'])
    expect(primary()).toBeDisabled()
    const item = container.querySelector('[data-requirement]')!
    expect(item).toHaveAttribute('data-met', 'false')
    const reason = container.querySelector('[data-now-disabled-reason]')!
    expect(reason).toHaveTextContent(
      'To turn this on: ' + item.textContent!.replace(' Not done yet.', '').replace('○', ''),
    )
    expect(primary()).toHaveAttribute('aria-describedby', reason.id)

    act(() => mockBench.emit(searching('liver-reach')))
    expect(primary()).toBeDisabled()
    // An answer from another lab does not open this one.
    act(() => mockBench.emit(held('station-7-reach')))
    expect(primary()).toBeDisabled()
    act(() => mockBench.emit(held('liver-reach')))
    expect(primary()).toBeEnabled()
    expect(container.querySelector('[data-requirement]')).toHaveAttribute('data-met', 'true')
    expect(container.querySelector('[data-now-disabled-reason]')).toBeNull()
  })

  it('explains the task on the image the learner held', () => {
    const { flow, next } = open()
    next()
    next()
    const image = held('liver-reach')
    act(() => mockBench.emit(image))
    next()
    expect(flow()).toHaveAttribute('data-step-kind', 'debrief')
    expect(flow()).toHaveAttribute('data-arrange', 'beside')
    expect(mockBench.stage).toMatchObject({
      labId: 'liver-reach',
      phase: 'review',
      names: 'shown',
      held: [image.target!.foundAt],
    })
  })

  it('lets a learner who was shown the view go on, and says the image is the course’s own', () => {
    const { container, flow, next, primary } = open()
    next()
    next()
    expect(primary()).toBeDisabled()
    const seen = shown('liver-reach')
    act(() => mockBench.emit(seen))
    expect(primary()).toBeEnabled()
    expect(primary()).toHaveTextContent('Continue with the view shown')
    const item = container.querySelector('[data-requirement]')!
    expect(item).toHaveAttribute('data-met', 'true')
    expect(item).toHaveTextContent('You were shown the left lobe of the liver.')
    next()
    expect(flow()).toHaveAttribute('data-step-kind', 'debrief')
    expect(mockBench.stage).toMatchObject({
      labId: 'liver-reach',
      phase: 'review',
      names: 'shown',
      held: [seen.target!.shownAt],
    })
    expect(mockBench.stage!.panes).toEqual(['ultrasound'])
    const note = container.querySelector('[data-debrief-reference]')!
    expect(note).toHaveAttribute('data-debrief-reference', 'shown')
    expect(note).toHaveTextContent('You asked to be shown this view')
  })

  it('lets the learner move on without finishing, and then shows the landmark, not a held image', () => {
    const { container, flow, next } = open()
    next()
    next()
    fireEvent.click(container.querySelector('[data-skip-lab]')!)
    expect(flow()).toHaveAttribute('data-step-kind', 'debrief')
    expect(mockBench.stage!.held).toBeUndefined()
    expect(container.querySelector('[data-debrief-reference]')).toHaveAttribute(
      'data-debrief-reference',
      'skipped',
    )
  })

  it('starts a scope task fresh each time it is entered or restarted', () => {
    const { container, next, primary } = open()
    next()
    next()
    const firstSession = mockBench.sessionId
    act(() => mockBench.emit(held('liver-reach')))
    expect(primary()).toBeEnabled()
    fireEvent.click(container.querySelector('[data-restart-task]')!)
    expect(mockBench.sessionId).not.toBe(firstSession)
    expect(primary()).toBeDisabled()
    // Going on and coming back also starts it again, and lets the earlier image go.
    act(() => mockBench.emit(held('liver-reach')))
    next()
    fireEvent.click(container.querySelector('[data-now-back]')!)
    expect(primary()).toBeDisabled()
    expect(mockBench.stage).toMatchObject({ labId: 'liver-reach', phase: 'work' })
  })

  it('keeps one lab mounted from the first task to the last', () => {
    const { next, container } = open()
    expect(mockBench.stage).toMatchObject({ labId: 'liver-view' })
    expect(container.querySelector('[data-stage]')).toHaveAttribute('hidden')
    for (let at = 0; at < liver.steps.length - 1; at += 1) {
      if (container.querySelector('[data-skip-lab]'))
        fireEvent.click(container.querySelector('[data-skip-lab]')!)
      else next()
    }
    expect(mockBench.mounts).toBe(1)
    expect(container.querySelector('[data-testid="lab"]')).not.toBeNull()
  })

  it('marks the lesson reviewed at its end, whatever was answered, and offers the next lesson', () => {
    const { container, next, flow, primary } = open()
    expect(readProgress().progress.visitedLessonIds).toEqual(['liver'])
    for (let at = 0; at < liver.steps.length; at += 1) {
      if (at === liver.steps.length - 1) expect(primary()).toHaveTextContent('Finish lesson')
      if (container.querySelector('[data-skip-lab]'))
        fireEvent.click(container.querySelector('[data-skip-lab]')!)
      else next()
    }
    expect(flow()).toHaveAttribute('data-step-kind', 'finished')
    expect(readProgress().progress.reviewedLessonIds).toEqual(['liver'])
    const finish = container.querySelector('[data-lesson-finish]')!
    for (const takeaway of liver.takeaways) expect(finish).toHaveTextContent(takeaway)
    expect(finish).toHaveTextContent('whether you completed, skipped or only read its tasks')
    expect(finish.querySelector('[data-next-lesson]')).toHaveAttribute(
      'href',
      '/eus-b-guided/learn?section=' + nextLesson('liver')!.id,
    )
    // Nothing about answers is stored.
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).not.toMatch(/answer|selected|held/)
  })

  it('lists a station’s landmarks beside its labeled image, in the order of the lab list', () => {
    const seven = lessonById('station-7')!
    const { container, next } = open(seven)
    expect(container.querySelector('[data-station-landmarks]')).toBeNull()
    next()
    const list = container.querySelector('[data-station-landmarks="station-7"]')!
    expect(mockBench.stage).toMatchObject({ labId: 'station-7-view', names: 'shown' })
    expect(
      Array.from(list.querySelectorAll('[data-landmark]')).map((item) =>
        item.getAttribute('data-landmark'),
      ),
    ).toEqual(stationById('station-7')!.landmarks.map((landmark) => landmark.key))
    for (const landmark of stationById('station-7')!.landmarks)
      expect(list).toHaveTextContent(landmark.name)
  })

  it('asks for each landmark on a still with nothing named, and the list is the gate', () => {
    const seven = lessonById('station-7')!
    const { container, flow, next, primary } = open(seven)
    next()
    next()
    fireEvent.click(container.querySelector('[data-skip-lab]')!)
    expect(flow()).toHaveAttribute('data-step-kind', 'identify')
    expect(flow()).toHaveAttribute('data-arrange', 'console')
    expect(mockBench.stage).toMatchObject({
      labId: 'station-7-landmarks',
      phase: 'work',
      names: 'hidden',
      panes: ['ultrasound'],
    })
    const items = () => Array.from(container.querySelectorAll('[data-requirement]'))
    expect(items().map((item) => item.getAttribute('data-requirement'))).toEqual([
      'mark-left_atrium',
      'mark-pulmonary_artery',
      'mark-station_7',
    ])
    expect(items()[0]).toHaveTextContent('Click the left atrium in the image.')
    expect(primary()).toBeDisabled()

    act(() => mockBench.emit(marking('station-7-landmarks', ['left_atrium'], [], 2)))
    expect(items().map((item) => item.getAttribute('data-met'))).toEqual(['true', 'false', 'false'])
    expect(primary()).toBeDisabled()
    // Another station's answer opens nothing here.
    act(() =>
      mockBench.emit(marking('station-4l-landmarks', ['aorta', 'pulmonary_artery', 'station_4l'])),
    )
    expect(primary()).toBeDisabled()
    // A landmark the learner asked to be shown is listed as shown, and still lets them go on.
    act(() =>
      mockBench.emit(
        marking('station-7-landmarks', ['left_atrium', 'station_7'], ['pulmonary_artery']),
      ),
    )
    expect(items()[1]).toHaveTextContent('You were shown the pulmonary artery.')
    expect(items().map((item) => item.getAttribute('data-met'))).toEqual(['true', 'true', 'true'])
    expect(primary()).toBeEnabled()
    next()
    expect(flow()).toHaveAttribute('data-step-kind', 'debrief')
    expect(container.querySelector('[data-station-landmarks="station-7"]')).not.toBeNull()
  })

  it('starts the landmark task fresh each time it is entered', () => {
    const seven = lessonById('station-7')!
    const { container, flow, next } = open(seven)
    next()
    next()
    fireEvent.click(container.querySelector('[data-skip-lab]')!)
    expect(flow()).toHaveAttribute('data-step-kind', 'identify')
    const session = mockBench.sessionId
    fireEvent.click(container.querySelector('[data-restart-task]')!)
    expect(mockBench.sessionId).not.toBe(session)
  })

  it('fills in a station in the table only once its landmarks have been taught', () => {
    const seven = lessonById('station-7')!
    const { container, next } = open(seven)
    fireEvent.click(container.querySelector('[data-open-stations]')!)
    const row = (id: string) => container.querySelector(`[data-station-row="${id}"]`)!
    // On the prediction nothing of this lesson, or of any other, is in the table.
    expect(row('station-7')).toHaveAttribute('data-open', 'false')
    expect(row('station-4l')).toHaveAttribute('data-open', 'false')
    for (const landmark of stationById('station-7')!.landmarks)
      expect(row('station-7')).not.toHaveTextContent(landmark.where)
    next()
    // The task that lists the landmarks opens this station's row, and no other.
    expect(row('station-7')).toHaveAttribute('data-open', 'true')
    expect(row('station-7')).toHaveTextContent(stationById('station-7')!.mistakenFor)
    expect(row('station-4l')).toHaveAttribute('data-open', 'false')
  })

  it('restarts the course from the first lesson with a clean record', () => {
    const { container } = open()
    expect(readProgress().status).toBe('saved')
    const restart = container.querySelector('[data-restart-course]')!
    expect(restart).toHaveAttribute('href', '/eus-b-guided/learn?section=' + first.id)
    fireEvent.click(restart)
    expect(readProgress().progress.reviewedLessonIds).toEqual([])
  })

  it('runs a lesson with no lab without mounting one', () => {
    const { container, flow, next } = open(first)
    expect(container.querySelector('[data-stage]')).toBeNull()
    expect(mockBench.stage).toBeNull()
    for (let at = 0; at < first.steps.length; at += 1) next()
    expect(flow()).toHaveAttribute('data-step-kind', 'finished')
    expect(container.querySelector('[data-survey-route]')).toBeNull()
  })

  it('shows the route drawing and the reach table where the first lesson calls for them', () => {
    const { container, next } = open(first)
    next()
    expect(container.querySelector('[data-survey-route]')).not.toBeNull()
    next()
    expect(container.querySelector('[data-reach-table]')).not.toBeNull()
  })
})
