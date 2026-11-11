import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { LessonHost } from '../components/LessonHost'
import { acquired } from '../testing/linked-fixture'
import { LESSONS } from '../content/curriculum'
import { activitiesForLesson } from '../content/stage'
import { EMPTY_EBUS_OBSERVATION, type EbusObservation } from '@/lib/ebus-guided-bridge'
import { STORAGE_KEY } from '../engine/progress'
import { PROGRESS_STORAGE_KEY, readProgress } from '../engine/selfPacedProgress'

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
jest.mock('../components/Workbench', () => ({
  Workbench: ({
    onObservation,
    lab,
    sessionId,
    locked,
  }: {
    onObservation: (s: EbusObservation) => void
    lab: import('../content/types').Lab
    sessionId: string
    locked: boolean
  }) => (
    <section data-mock-locked={locked}>
      {lab.kind === 'knobology' && (
        <>
          <button
            onClick={() =>
              onObservation({
                ...EMPTY_EBUS_OBSERVATION,
                acquisitionSession: sessionId,
                ready: true,
                frameReady: true,
                actionCount: 1,
                lastAction: 'depth',
                depth: 40,
                gain: 43,
                contrast: 43,
                recorded: {
                  type: 'recorded-frame',
                  version: 1,
                  sessionId,
                  taskId: 'depth',
                  frameId: 'unit-frame',
                  segmentId: 'unit-recording',
                  mediaTime: 1,
                  width: 640,
                  height: 480,
                  settings: { depthMm: 40, gain: 43, contrast: 43, doppler: false },
                  calipers: [],
                  held: false,
                  captured: false,
                },
              })
            }
          >
            Load recorded acquisition
          </button>
          <button onClick={() => onObservation(EMPTY_EBUS_OBSERVATION)}>Lose workbench</button>
        </>
      )}
      <button
        onClick={() =>
          onObservation({
            ...EMPTY_EBUS_OBSERVATION,
            ready: true,
            frameReady: true,
            targetVisible: true,
            contactQuality: 1,
          })
        }
      >
        Load preset only
      </button>
      <button
        onClick={() =>
          onObservation({
            ...EMPTY_EBUS_OBSERVATION,
            ready: true,
            frameReady: false,
            targetVisible: true,
            contactQuality: 1,
            actionCount: 1,
            lastAction: 'flexion',
            linked: {
              assetsReady: true,
              selectedStructure: '',
              modelSectionViewed: false,
              approach: 'rms',
              scannedApproaches: [],
              frameId: 'test-frame',
            },
          })
        }
      >
        Move before frame
      </button>
      <button
        onClick={() =>
          onObservation({
            ...acquired(lab.linkedLesson!, lab.linkedVariant),
            linked: {
              ...acquired(lab.linkedLesson!, lab.linkedVariant).linked!,
              source: {
                ...acquired(lab.linkedLesson!, lab.linkedVariant).linked!.source!,
                sessionId,
              },
            },
          })
        }
      >
        Render changed scan
      </button>
    </section>
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
const coupling = LESSONS.find((lesson) => lesson.id === 'acoustic-contact')!
const primary = () => document.querySelector('[data-now-primary]') as HTMLButtonElement
const next = () => fireEvent.click(primary())
const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check response' }))
const verdict = () => document.querySelector('[data-answer-verdict]')
/** The lesson's save, restart and exit controls sit behind "More" in the header. */
const openMore = () => fireEvent.click(screen.getByRole('button', { name: 'More' }))
const explanation = () => document.querySelector('[data-explanation-reveal]')
const skipAcquisition = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Continue without an image' }))
const heading = (name: string) => screen.getByRole('heading', { name })
function answer(text: string) {
  fireEvent.click(screen.getByLabelText(text))
  check()
}
/** Nothing but the self-paced record, and no response, image or help inside it. */
function expectNoGradedWrite() {
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  const keys = Object.keys(localStorage).filter(
    (key) => !key.startsWith('ip-ebus-guided-examination:'),
  )
  expect(keys).toEqual([PROGRESS_STORAGE_KEY])
  expect(Object.keys(JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY)!)).sort()).toEqual([
    'lastLocation',
    'openedIntegratedCaseIds',
    'openedPracticeCaseIds',
    'reviewLaterLessonIds',
    'reviewedLessonIds',
    'updatedAt',
    'version',
    'visitedLessonIds',
  ])
}
/*
 * The lesson order since the 2026-11-10 flow change: a committed prediction, the teaching, the
 * acquisition, the learner's own image with its key points, then one transfer check.
 */
/**
 * From the first lab's image screen to the lesson's closing check. The contact lesson holds a
 * second unit since 2026-11-10: the contact model's briefing, its lab, and one check on that image.
 */
function toClosingCheck() {
  next()
  expect(heading('Relate the wall, transducer and air gap')).toBeInTheDocument()
  next()
  skipAcquisition()
  expect(heading('Explain the contact comparison')).toBeInTheDocument()
  next()
}
function startLab() {
  render(<LessonHost lesson={coupling} />)
  answer(coupling.question.choices.find((c) => c.correct)!.text)
  next()
  next()
}
const stationSeven = LESSONS.find((l) => l.id === 'station-seven')!
/** Station 7 up to its first acquisition: prediction, briefing, demonstration. */
function startStationSeven() {
  render(<LessonHost lesson={stationSeven} />)
  answer(stationSeven.question.choices.find((c) => c.correct)!.text)
  next()
  next()
  next()
}
it('asks for the prediction before any teaching, shows a wrong response’s feedback, allows a retry and stores nothing', () => {
  render(<LessonHost lesson={coupling} />)
  expect(heading('Identify the acquisition problem')).toBeInTheDocument()
  expect(document.querySelector('[data-activity-kind]')).toHaveTextContent('Predict first')
  // Nothing that states the answer is on the screen before the learner commits.
  expect(screen.queryByText(coupling.paragraphs[0])).not.toBeInTheDocument()
  expect(screen.queryByText(coupling.worked.reasoning)).not.toBeInTheDocument()
  expect(screen.queryByText(coupling.question.explanation)).not.toBeInTheDocument()
  expect(primary()).toHaveTextContent('Continue without answering')
  answer(coupling.question.choices[0].text)
  expect(screen.getByText('Not correct.', { exact: false })).toBeInTheDocument()
  expect(heading('Identify the acquisition problem')).toBeInTheDocument()
  expect(screen.queryByText('Render changed scan')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(verdict()).toBeNull()
  expect(document.querySelectorAll('input[type=radio]:checked')).toHaveLength(0)
  answer(coupling.question.choices.find((c) => c.correct)!.text)
  expect(screen.getByText('Correct.', { exact: false })).toBeInTheDocument()
  next()
  // The teaching, with its worked example, follows the commitment.
  expect(heading('Compare contact and brightness')).toBeInTheDocument()
  expect(screen.getByText(coupling.paragraphs[0])).toBeVisible()
  expect(screen.getByText(coupling.worked.reasoning, { exact: false })).toBeVisible()
  expectNoGradedWrite()
})
it('opens the hint and the explanation before any answer; a later check’s hint reviews the concept read-only', () => {
  render(<LessonHost lesson={coupling} />)
  fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
  expect(screen.getByText(coupling.checklist[0])).toBeVisible()
  // The prediction comes before the teaching, so its hint has no earlier concept to reopen.
  expect(screen.queryByRole('button', { name: /Review this concept/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
  expect(explanation()).toHaveTextContent(coupling.question.explanation)
  expect(explanation()).toHaveTextContent('Shown without an answer')
  expect(verdict()).toBeNull()
  next()
  next()
  skipAcquisition()
  toClosingCheck()
  expect(heading('Reassess another window')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
  fireEvent.click(screen.getByRole('button', { name: /Review this concept/ }))
  expect(screen.getByText('Review · Current activity paused')).toBeVisible()
  expect(screen.getByText(coupling.paragraphs[0])).toBeVisible()
  expect(primary()).toHaveTextContent('Return to current task')
  next()
  expect(heading('Reassess another window')).toBeInTheDocument()
  expect(document.querySelectorAll('input[type=radio]:checked')).toHaveLength(0)
  expectNoGradedWrite()
})
it('holds an image only after a real acquisition; skipping holds nothing, and the image screen says so', () => {
  startLab()
  expect(primary()).toHaveTextContent('Continue with this image')
  expect(primary()).toBeDisabled()
  fireEvent.click(screen.getByText('Load preset only'))
  expect(primary()).toBeDisabled()
  fireEvent.click(screen.getByText('Move before frame'))
  expect(primary()).toBeDisabled()
  skipAcquisition()
  expect(heading('Compare the acquired images')).toBeInTheDocument()
  expect(document.querySelector('[data-activity-kind]')).toHaveTextContent('Your image')
  expect(document.querySelector('[data-evidence-identity="held-missing"]')).toHaveTextContent(
    'No image',
  )
  expect(screen.getByRole('button', { name: 'Go back and acquire one' })).toBeVisible()
  // The image screen asks nothing: the check that repeated the prediction is no longer shown.
  expect(screen.queryByRole('button', { name: 'Check response' })).not.toBeInTheDocument()
  expect(screen.queryByText(coupling.observation.prompt)).not.toBeInTheDocument()
  expect(primary()).toHaveTextContent('Continue to Relate the wall, transducer and air gap')
  toClosingCheck()
  answer(coupling.transfer.choices.find((c) => c.unsafe)!.text)
  expect(screen.getByText('Not correct, and unsafe.', { exact: false })).toBeVisible()
  expect(primary()).toBeEnabled()
  expect(primary()).toHaveTextContent('Finish lesson')
  next()
  expect(heading('Lesson finished')).toBeInTheDocument()
  const summary = document.querySelector('[data-session-summary]')!
  expect(summary).toHaveTextContent('Identify the acquisition problem: Check answered')
  expect(summary).toHaveTextContent('Restore the acoustic window: No image')
  expect(summary).toHaveTextContent('Reassess another window: Check answered')
  expect(readProgress().progress.reviewedLessonIds).toEqual(['acoustic-contact'])
  expectNoGradedWrite()
})
it('holds a real acquisition, shows it with the key points, and neither restart nor reload restores any response', () => {
  startLab()
  fireEvent.click(screen.getByText('Render changed scan'))
  expect(primary()).toBeEnabled()
  next()
  expect(heading('Compare the acquired images')).toBeInTheDocument()
  expect(document.querySelector('[data-evidence-identity="held"]')).toBeInTheDocument()
  expect(screen.getByText(coupling.takeaways[0])).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Check response' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Course outline' }))
  expect(
    screen.getByRole('button', { name: /Restore the acoustic window · Image acquired/ }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: /Identify the acquisition problem · Check answered/ }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Close/ }))
  openMore()
  fireEvent.click(screen.getByRole('button', { name: 'Restart lesson' }))
  expect(heading('Identify the acquisition problem')).toBeInTheDocument()
  expect(document.querySelectorAll('input[type=radio]:checked')).toHaveLength(0)
  expect(verdict()).toBeNull()
  cleanup()
  render(<LessonHost lesson={coupling} />)
  expect(heading('Identify the acquisition problem')).toBeInTheDocument()
  expect(document.querySelectorAll('input[type=radio]:checked')).toHaveLength(0)
  expect(readProgress().progress.lastLocation).toEqual({ kind: 'lesson', id: 'acoustic-contact' })
  expect(readProgress().progress.reviewedLessonIds).toEqual([])
  expectNoGradedWrite()
})
it('a check on a held image stays explainable but unanswerable when both acquisitions were skipped', () => {
  startStationSeven()
  skipAcquisition()
  next()
  skipAcquisition()
  expect(screen.getByText(stationSeven.transfer.prompt)).toBeVisible()
  expect(document.querySelector('[data-question-unavailable]')).toHaveTextContent(
    'No image is held for this check',
  )
  expect(screen.queryByRole('button', { name: 'Check response' })).toBeDisabled()
  expect(screen.getByLabelText(stationSeven.transfer.choices[0].text)).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
  expect(explanation()).toHaveTextContent(stationSeven.transfer.explanation)
  expect(screen.getByRole('button', { name: /Back to the acquisition/ })).toBeVisible()
  expect(primary()).toHaveTextContent('Continue without answering')
  expectNoGradedWrite()
})
it('withholds checking when the retained acquisition becomes unavailable, keeps the explanation open and lets the learner continue', () => {
  startStationSeven()
  fireEvent.click(screen.getByText('Render changed scan'))
  next()
  next()
  fireEvent.click(screen.getByText('Render changed scan'))
  next()
  expect(screen.getByText(stationSeven.transfer.prompt)).toBeVisible()
  fireEvent.click(screen.getByText('Move before frame'))
  expect(document.querySelector('[data-question-unavailable]')).toHaveTextContent(
    'The held image is unavailable in the current view',
  )
  expect(screen.getByLabelText(stationSeven.transfer.choices[0].text)).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
  expect(explanation()).toHaveTextContent(stationSeven.transfer.explanation)
  expect(primary()).toBeEnabled()
  next()
  expect(heading('Record what this window establishes')).toBeInTheDocument()
  expectNoGradedWrite()
})
it('requires a fresh changed-window acquisition before the changed-window check, and a current source for the record task', () => {
  const lesson = stationSeven
  startStationSeven()
  fireEvent.click(screen.getByText('Render changed scan'))
  next()
  expect(heading('Read the acquired window')).toBeInTheDocument()
  next()
  expect(primary()).toHaveTextContent('Continue with this image')
  expect(primary()).toBeDisabled()
  expect(screen.queryByText(lesson.transfer.prompt)).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Load preset only'))
  expect(primary()).toBeDisabled()
  fireEvent.click(screen.getByText('Render changed scan'))
  next()
  expect(screen.getByText(lesson.transfer.prompt)).toBeVisible()
  expect(document.querySelector('[data-question-unavailable]')).toBeNull()
  answer(lesson.transfer.choices.find((c) => c.correct)!.text)
  next()
  expect(heading('Record what this window establishes')).toBeInTheDocument()
  expect(primary()).toHaveTextContent('Finish lesson without completing this record')
  fireEvent.change(screen.getByLabelText('Visualization supported by this image'), {
    target: { value: 'described' },
  })
  fireEvent.change(screen.getByLabelText('Basis for station identity'), {
    target: { value: 'landmarks' },
  })
  fireEvent.change(screen.getByLabelText('Extent supported by this acquisition'), {
    target: { value: 'window-only' },
  })
  fireEvent.click(screen.getByText('Check and save record'))
  expect(screen.getByText('Record task checked', { exact: false })).toBeVisible()
  expect(primary()).toHaveTextContent('Finish lesson')
  next()
  expect(document.querySelector('[data-session-summary]')).toHaveTextContent(
    'Record what this window establishes: Task completed',
  )
  expect(readProgress().progress.reviewedLessonIds).toEqual(['station-seven'])
  expectNoGradedWrite()
})
it('jumps ahead from the outline; a record task without a current acquisition refuses its check and can be left uncompleted', () => {
  const lesson = LESSONS.find((l) => l.id === 'station-seven')!
  render(<LessonHost lesson={lesson} />)
  fireEvent.click(screen.getByRole('button', { name: 'Course outline' }))
  fireEvent.click(screen.getByRole('button', { name: /Record what this window establishes/ }))
  expect(heading('Record what this window establishes')).toBeInTheDocument()
  fireEvent.click(screen.getByText('Check and save record'))
  // EBUS-PRE-REVIEW-04 (L22-5) reworded the refusal into learner language; it still refuses.
  expect(screen.getByRole('alert')).toHaveTextContent(
    'No current acquisition is available for this record',
  )
  expect(primary()).toHaveTextContent('Finish lesson without completing this record')
  next()
  const summary = document.querySelector('[data-session-summary]')!
  expect(summary).toHaveTextContent('Record what this window establishes: Task not completed')
  expect(summary).toHaveTextContent('Acquire both bronchial windows: No image')
  expect(summary).toHaveTextContent('Separate approach from station: Check not answered')
  fireEvent.click(screen.getByRole('button', { name: 'Unmark as reviewed' }))
  expect(readProgress().progress.reviewedLessonIds).toEqual([])
  expectNoGradedWrite()
})
it.each([
  ['clinical-question', 'matching', 'Show the matches'],
  ['preparation', 'sequence', 'Show the sequence'],
] as const)(
  'keeps the authored %s reference visible after reveal and revisit, then clears it on restart',
  (lessonId, interaction, revealLabel) => {
    const lesson = LESSONS.find((entry) => entry.id === lessonId)!
    render(<LessonHost lesson={lesson} />)
    next()
    next()
    fireEvent.click(screen.getByRole('button', { name: revealLabel }))
    const reference = () =>
      document.querySelector(`[data-task-reference="${interaction}"]`) as HTMLElement
    const assertAuthoredReference = () => {
      expect(reference()).toBeVisible()
      if (interaction === 'matching') {
        for (const pair of lesson.matching!.pairs) {
          expect(within(reference()).getByText(pair.cue, { exact: true })).toBeVisible()
          expect(within(reference()).getByText(pair.response, { exact: true })).toBeVisible()
        }
      } else {
        expect(
          within(reference())
            .getAllByRole('listitem')
            .map((item) => item.textContent),
        ).toEqual(lesson.sequence!.steps.map((step) => step.text))
      }
      expect(within(reference()).queryByRole('button')).toBeNull()
      expect(within(reference()).queryByRole('combobox')).toBeNull()
    }
    assertAuthoredReference()
    expect(primary()).toBeEnabled()
    // The task carries no check of its own now: one step on, then back to it.
    next()
    fireEvent.click(screen.getByRole('button', { name: /^Back$/ }))
    assertAuthoredReference()
    openMore()
    fireEvent.click(screen.getByRole('button', { name: /^Restart lesson$/ }))
    next()
    next()
    expect(reference()).toBeNull()
    expect(screen.getByRole('button', { name: revealLabel })).toBeEnabled()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  },
)

it('completes, shows or skips a task without a write; a skipped task with a check after it shows its explanation', () => {
  const lesson = LESSONS.find((l) => l.id === 'clinical-question')!
  render(<LessonHost lesson={lesson} />)
  expect(screen.getByText(lesson.question.prompt)).toBeVisible()
  next()
  next()
  expect(heading('State the information needed')).toBeInTheDocument()
  expect(screen.queryByText(lesson.question.prompt)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Show the matches' }))
  expect(screen.getByText(lesson.matching!.explanation, { exact: false })).toBeVisible()
  expect(document.querySelector('[data-task-explanation]')).toHaveTextContent(
    'You opened the answer to this task',
  )
  // The check that followed the task repeated the prediction and is no longer asked.
  expect(screen.queryByText(lesson.observation.prompt)).not.toBeInTheDocument()
  expect(primary()).toHaveTextContent('Continue to Consider a different diagnostic request')
  cleanup()
  // A task that still has a check after it: skipping the task shows its explanation, then the check.
  const recovery = LESSONS.find((l) => l.id === 'complications-recovery')!
  render(<LessonHost lesson={recovery} />)
  next()
  next()
  expect(heading('Prioritize the patient during deterioration')).toBeInTheDocument()
  next()
  expect(document.querySelector('[data-task-explanation]')).toHaveTextContent(
    'You continued without completing this task',
  )
  expect(screen.getByText(recovery.observation.prompt)).toBeVisible()
  expectNoGradedWrite()
})
it('opens help without any storage write', () => {
  render(<LessonHost lesson={coupling} />)
  fireEvent.click(screen.getByRole('button', { name: 'Help' }))
  expect(screen.getByText('Every check is optional', { exact: false })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /Close/ }))
  expectNoGradedWrite()
  expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).not.toContain('help')
})
it('saves a lesson for later and unsaves it, as the only marks besides location and finish', () => {
  render(<LessonHost lesson={coupling} />)
  // Closed, the menu's controls are not offered at all.
  expect(screen.queryByRole('button', { name: 'Save for later' })).not.toBeInTheDocument()
  openMore()
  fireEvent.click(screen.getByRole('button', { name: 'Save for later' }))
  expect(readProgress().progress.reviewLaterLessonIds).toEqual(['acoustic-contact'])
  fireEvent.click(screen.getByRole('button', { name: 'Saved for later' }))
  expect(readProgress().progress.reviewLaterLessonIds).toEqual([])
  expectNoGradedWrite()
})
it('cancels a pending recorded hold on a real workbench invalidation so recovery can acquire again', () => {
  const lesson = LESSONS.find((item) => item.id === 'image-depth')!
  render(<LessonHost lesson={lesson} />)
  answer(lesson.question.choices.find((choice) => choice.correct)!.text)
  next()
  next()
  fireEvent.click(screen.getByText('Load recorded acquisition'))
  next()
  expect(primary()).toHaveTextContent('Holding the selected frame')
  expect(document.querySelector('[data-mock-locked]')).toHaveAttribute('data-mock-locked', 'true')
  expect(
    screen.queryByRole('button', { name: 'Continue without an image' }),
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Lose workbench'))
  expect(document.querySelector('[data-mock-locked]')).toHaveAttribute('data-mock-locked', 'false')
  fireEvent.click(screen.getByText('Load recorded acquisition'))
  expect(primary()).toBeEnabled()
  expect(readProgress().progress.reviewedLessonIds).toEqual([])
  expectNoGradedWrite()
})
it('every lesson can be walked from first task to finish without a single answer, image or task, and says so', () => {
  for (const lesson of LESSONS) {
    render(<LessonHost lesson={lesson} />)
    let guard = 0
    while (!screen.queryByRole('heading', { name: 'Lesson finished' }) && guard++ < 30) {
      const button = primary()
      if (button.disabled) skipAcquisition()
      else next()
    }
    expect(heading('Lesson finished')).toBeInTheDocument()
    const summary = document.querySelector('[data-session-summary]')!.textContent!
    expect(summary).not.toMatch(/(?<!not )answered|Image acquired|Task completed/)
    for (const activity of activitiesForLesson(lesson)) expect(summary).toContain(activity.title)
    cleanup()
  }
  expect(readProgress().progress.reviewedLessonIds).toEqual(LESSONS.map((lesson) => lesson.id))
  expectNoGradedWrite()
})
