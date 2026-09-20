import { fireEvent, render, screen, within } from '@testing-library/react'
import { BranchTracingPractice } from '../components/BranchTracingPractice'
import { LocalCtLesson } from '../components/LocalCtLesson'
import { LESSONS, lessonById } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { DRAFT_PREFIX } from '../engine/ct-draft'
import { emptyLocalSession, localSessionReducer, restartDiscards } from '../engine/local-session'
import { emptyCtSession, routeRestartDiscards } from '../engine/ct-session'
import { SEGMENT_PRACTICE_TRACES } from '../content/practice'
import { traceById } from '../geometry/native-ct'
import { STANDARD_ORIENTATION } from '../geometry/orientation'

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
jest.mock('next/dynamic', () => () => () => null)

beforeEach(() => {
  window.localStorage.clear()
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  })
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
const imageReady = () =>
  document.querySelectorAll('image').forEach((image) => fireEvent.load(image))
const practiceDraft = () => {
  const key = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!).find(
    (k) => k.startsWith(`${DRAFT_PREFIX}practice.`),
  )!
  return JSON.parse(localStorage.getItem(key)!).value
}
/** Place a genuine mark with the keyboard, as a learner can: move the cursor, then Enter. */
function markOnCt(root: HTMLElement | Document = document) {
  const image = (root === document ? screen : within(root as HTMLElement)).getAllByRole('group', {
    name: /^CT image\./,
  })[0]
  fireEvent.keyDown(image, { key: 'ArrowLeft', shiftKey: true })
  fireEvent.keyDown(image, { key: 'ArrowLeft', shiftKey: true })
  fireEvent.keyDown(image, { key: 'Enter' })
  imageReady()
}

describe('BBTF-14 · partial junction work in the route comparison', () => {
  function openRs4() {
    render(<BranchTracingPractice mode="practice" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start CT practice' }))
    imageReady()
    fireEvent.click(screen.getByRole('button', { name: 'Use this orientation' }))
    imageReady()
  }

  it('shows one recorded junction as partial with real counts, keeps the bytes and never finalizes it', () => {
    openRs4()
    const trace = traceById(SEGMENT_PRACTICE_TRACES[2])
    fireEvent.click(screen.getByRole('button', { name: 'Go to response slice' }))
    imageReady()
    fireEvent.click(screen.getByText('RMSB · Right main bronchus'))
    markOnCt()
    fireEvent.click(screen.getByRole('button', { name: 'Check this junction' }))
    imageReady()

    // The draft holds the work before the comparison opens.
    const beforeCompare = practiceDraft()
    expect(beforeCompare.work.recorded.filter(Boolean)).toHaveLength(1)
    expect(beforeCompare.work.marks.filter(Boolean)).toHaveLength(1)
    expect(beforeCompare.responses).toEqual([null])

    fireEvent.click(screen.getByRole('button', { name: 'Compare all routes with the reference' }))
    const section = document.querySelector('[data-route-state]')!
    expect(section.getAttribute('data-route-state')).toBe('partial')
    expect(section.querySelector('[data-route-partial]')).not.toBeNull()
    expect(section.querySelector('[data-partial-counts]')!.textContent).toMatch(
      new RegExp(
        `1 of ${trace.checkpoints.length} stops recorded on this route; final route interpretation not recorded`,
      ),
    )
    expect(screen.getByText(/1 has junction work that is not part of one yet/)).toBeVisible()
    expect(screen.queryByText(/No junction work and no interpretation recorded/)).toBeNull()
    // Nothing was finalized and no byte changed.
    const afterCompare = practiceDraft()
    expect(afterCompare.responses).toEqual([null])
    expect(afterCompare.work.marks).toEqual(beforeCompare.work.marks)
    expect(afterCompare.work.recorded).toEqual(beforeCompare.work.recorded)
    // The course and airway–nodule description belong to the route interpretation, not to this.
    expect(screen.queryByText(/Your recorded course:/)).toBeNull()
    expect(screen.queryByText(/Your airway–nodule interpretation:/)).toBeNull()
  })

  it('opens the comparison before any work and calls it neither partial nor recorded', () => {
    openRs4()
    fireEvent.click(screen.getByRole('button', { name: 'Compare all routes with the reference' }))
    expect(document.querySelector('[data-route-state]')!.getAttribute('data-route-state')).toBe(
      'none',
    )
    expect(
      screen.getByText(/No junction work and no interpretation recorded for this route/),
    ).toBeVisible()
    expect(document.querySelector('[data-route-partial]')).toBeNull()
  })

  it('returns to tracing with the same partial work and keeps retry available', () => {
    openRs4()
    fireEvent.click(screen.getByRole('button', { name: 'Go to response slice' }))
    imageReady()
    fireEvent.click(screen.getByText('RMSB · Right main bronchus'))
    markOnCt()
    fireEvent.click(screen.getByRole('button', { name: 'Check this junction' }))
    imageReady()
    const recorded = practiceDraft().work
    fireEvent.click(screen.getByRole('button', { name: 'Compare all routes with the reference' }))
    fireEvent.click(screen.getByRole('button', { name: 'Review and retry these junctions' }))
    imageReady()
    expect(practiceDraft().work.marks).toEqual(recorded.marks)
    expect(practiceDraft().work.recorded).toEqual(recorded.recorded)
    expect(screen.getByRole('button', { name: 'Retry this junction' })).toBeEnabled()
  })

  it('restores the same partial work after a reload', () => {
    openRs4()
    fireEvent.click(screen.getByRole('button', { name: 'Go to response slice' }))
    imageReady()
    fireEvent.click(screen.getByText('RMSB · Right main bronchus'))
    markOnCt()
    fireEvent.click(screen.getByRole('button', { name: 'Check this junction' }))
    imageReady()
    const saved = practiceDraft().work
    // A reload: the component tree is rebuilt from browser storage alone.
    const reopened = render(<BranchTracingPractice mode="practice" />)
    fireEvent.click(within(reopened.container).getByRole('button', { name: 'Start CT practice' }))
    imageReady()
    expect(practiceDraft().work.marks).toEqual(saved.marks)
    expect(practiceDraft().work.recorded).toEqual(saved.recorded)
  })
})

describe('BBTF-44 · the route map counts only recorded stops', () => {
  it('labels a map with unrecorded divisions Partial and names them', () => {
    render(<BranchTracingPractice mode="practice" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start CT practice' }))
    imageReady()
    fireEvent.click(screen.getByRole('button', { name: 'Use this orientation' }))
    imageReady()
    const trace = traceById(SEGMENT_PRACTICE_TRACES[2])
    const heading = screen.getByRole('heading', { name: /Your route map/ })
    expect(heading.textContent).toMatch(
      new RegExp(`Your route map · 0 of ${trace.checkpoints.length} stops recorded`),
    )
    expect(heading.getAttribute('data-map-state')).toBe('partial')
    fireEvent.click(screen.getByRole('button', { name: 'Go to response slice' }))
    imageReady()
    fireEvent.click(screen.getByText('RMSB · Right main bronchus'))
    markOnCt()
    fireEvent.click(screen.getByRole('button', { name: 'Check this junction' }))
    imageReady()
    expect(screen.getByRole('heading', { name: /Your route map/ }).textContent).toMatch(
      new RegExp(`1 of ${trace.checkpoints.length} stops recorded`),
    )
    const missing = document.querySelector('[data-map-missing]')!
    expect(missing.textContent).toMatch(/Not recorded here: 2\./)
    expect(missing.textContent).toMatch(/nothing is counted against you/)
  })
})

describe('BBTF-22 and BBTF-23 · restart asks first and stops claiming a stale display', () => {
  const lesson = lessonById('continuity')!
  const exercises = lesson.exercises!.map(localExercise)

  it('lists exactly what a restart discards, and nothing when there is no work', () => {
    const fresh = emptyLocalSession(exercises)
    expect(restartDiscards(fresh, exercises)).toEqual([])
    const marked = localSessionReducer(
      exercises,
      localSessionReducer(exercises, fresh, { type: 'focus-airway' }),
      { type: 'begin' },
    )
    const withMark = localSessionReducer(exercises, marked, {
      type: 'mark',
      mark: { slice: exercises[0].answerPoints[0].slice, pixel: [240, 315] },
    })
    expect(restartDiscards(withMark, exercises)).toEqual([
      '1 lumen mark on the Trachea example',
      'your place in this example: it would start again',
    ])
    // A recorded (checked) attempt survives a restart, so it is never listed as discarded.
    const checked = localSessionReducer(
      exercises,
      localSessionReducer(exercises, withMark, {
        type: 'mark',
        mark: { slice: exercises[0].answerPoints[1].slice, pixel: null },
      }),
      { type: 'check' },
    )
    const restarted = localSessionReducer(exercises, checked, { type: 'restart' })
    expect(Object.keys(restarted.history)).toEqual(Object.keys(checked.history))
    expect(restartDiscards(checked, exercises)).not.toContain('checked')
  })

  it('cancels without touching the draft and confirms only on request', () => {
    render(<LocalCtLesson lesson={lesson} />)
    imageReady()
    fireEvent.click(screen.getByRole('button', { name: 'Focus on this airway' }))
    imageReady()
    fireEvent.click(screen.getByRole('button', { name: 'Start marking branches' }))
    imageReady()
    fireEvent.click(screen.getByRole('button', { name: /^A · RMSB · slice 387/ }))
    imageReady()
    markOnCt()
    const key = `${DRAFT_PREFIX}learn.continuity`
    const marked = JSON.parse(localStorage.getItem(key)!).value
    expect(marked.marks.filter(Boolean)).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Restart lesson' }))
    expect(screen.getByText('Restart this lesson?')).toBeVisible()
    expect(screen.getByText(/1 lumen mark on the Trachea example/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel, keep my work' }))
    expect(JSON.parse(localStorage.getItem(key)!).value.marks).toEqual(marked.marks)

    fireEvent.click(screen.getByRole('button', { name: 'Restart lesson' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restart the lesson' }))
    imageReady()
    const after = JSON.parse(localStorage.getItem(key)!).value
    expect(after.marks.filter(Boolean)).toHaveLength(0)
    expect(after.orientation).toEqual(STANDARD_ORIENTATION)
    // Only this lesson's current draft changed; nothing else in this browser was cleared.
    expect(
      Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!).sort(),
    ).toEqual([key, 'branch-tracing.self-paced-v1'])
  })

  it('does not describe the current standard display as the restored one', () => {
    const key = `${DRAFT_PREFIX}learn.continuity`
    render(<LocalCtLesson lesson={lesson} />)
    imageReady()
    fireEvent.click(screen.getByRole('button', { name: 'Focus on this airway' }))
    imageReady()
    fireEvent.click(screen.getByRole('button', { name: 'Start marking branches' }))
    imageReady()
    fireEvent.click(screen.getByRole('button', { name: /^A · RMSB · slice 387/ }))
    imageReady()
    markOnCt()
    // Reopen with a reflected display saved in the draft, as the reported session did.
    const envelope = JSON.parse(localStorage.getItem(key)!)
    envelope.value.orientation = { turns: 0, reflected: true }
    localStorage.setItem(key, JSON.stringify(envelope))
    const reopened = render(<LocalCtLesson lesson={lesson} />)
    imageReady()
    const note = () =>
      reopened.container.querySelector('[data-stage-resumed-note]')!.textContent ?? ''
    expect(note()).toMatch(/Restored display: Left–right reflection/)

    fireEvent.click(within(reopened.container).getByRole('button', { name: 'Restart lesson' }))
    fireEvent.click(within(reopened.container).getByRole('button', { name: 'Restart the lesson' }))
    imageReady()
    expect(note()).not.toMatch(/Restored display: Left–right reflection/)
    expect(note()).toMatch(/You restarted this lesson/)
    expect(note()).toMatch(/started again in standard axial/)
    expect(JSON.parse(localStorage.getItem(key)!).value.orientation).toEqual(STANDARD_ORIENTATION)
  })

  it('lists a route lesson’s recorded interpretations before discarding them', () => {
    const routeLesson = LESSONS.find((l) => !l.exercises)!
    const trace = traceById(routeLesson.prediction)
    const session = emptyCtSession(trace)
    expect(routeRestartDiscards(session, trace)).toEqual([])
    const working = {
      ...session,
      step: 2,
      alignment: STANDARD_ORIENTATION,
      course: 'caudal' as const,
      recorded: session.recorded.map((_, i) => i === 0),
      marks: session.marks.map((m, i) =>
        i === 0 ? { slice: trace.checkpoints[0].slice, pixel: [1, 1] as [number, number] } : m,
      ),
      prediction: null,
    }
    const discards = routeRestartDiscards(working, trace)
    expect(discards).toContain(`1 recorded junction on the ${trace.airwayPath[0].code} route`)
    expect(discards).toContain('the airway course you chose')
    expect(discards).toContain('the CT display you recorded for this route')
  })
})
