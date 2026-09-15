import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CRITICAL_CARE_PROGRESS_STORAGE_KEY } from '@/features/learning-module/activity/progress'
import { BranchTracingLesson } from '../components/BranchTracingLesson'
import { traceById } from '../geometry/native-ct'
import { LESSONS } from '../content/lessons'
import { DRAFT_PREFIX } from '../engine/ct-draft'
import { readSelfPacedRecord } from '../engine/selfPacedProgress'
import { axe } from 'jest-axe'

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
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
const lesson = LESSONS.find((l) => l.id === 'variants-limits')!
type StoredAttempt = { branch: unknown; hints?: number; support?: string }
const session = () =>
  JSON.parse(localStorage.getItem(`${DRAFT_PREFIX}learn.${lesson.id}`)!).value.session
const storedAttempts = () => Object.values(session().junctionHistory).flat() as StoredAttempt[]
const reviewed = () => readSelfPacedRecord(localStorage).record.reviewedLessonIds
function imageReady() {
  document.querySelectorAll('image').forEach((image) => fireEvent.load(image))
}
function relation(value = 'unresolved') {
  fireEvent.click(screen.getByRole('button', { name: 'Show target' }))
  imageReady()
  fireEvent.change(screen.getByRole('combobox', { name: 'Airway–nodule relationship' }), {
    target: { value },
  })
}
function orient(id: string) {
  imageReady()
  const preset = traceById(id).preset
  fireEvent.click(
    screen.getByRole('button', {
      name:
        preset === 'mirror'
          ? /Flip left–right/
          : preset === 'rul'
            ? /Rotate 90° left/
            : /Rotate 90° right/,
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Use this orientation' }))
}
function markLevels(id: string, wrong = false) {
  const trace = traceById(id)
  for (const [i, point] of trace.checkpoints.entries()) {
    expect(document.querySelector(`[data-ct-reference="${i + 1}"]`)).toBeNull()
    expect(screen.getByRole('button', { name: 'View next junction' })).toBeDisabled()
    if (point.decision) {
      const edge =
        wrong && i === 0
          ? point.decision.options.find((o) => o.sourceEdgeId !== point.sourceEdgeId)!.sourceEdgeId
          : point.sourceEdgeId
      fireEvent.click(
        screen
          .getAllByRole('radio')
          .find((input) => (input as HTMLInputElement).value === String(edge))!,
      )
    }
    fireEvent.click(screen.getByRole('button', { name: 'Go to response slice' }))
    imageReady()
    if (wrong && i === 0) {
      const svg = screen.getByRole('group', { name: /^CT image\./ })
      fireEvent.keyDown(svg, { key: 'ArrowLeft', shiftKey: true })
      fireEvent.keyDown(svg, { key: 'Enter' })
      expect(screen.getByLabelText('Your mark 1')).toBeInTheDocument()
    } else fireEvent.click(screen.getByRole('button', { name: 'Lumen unresolved here' }))
    fireEvent.click(
      screen.getByRole('button', {
        name: point.decision ? 'Check this junction' : 'Record nodule approach',
      }),
    )
    expect(document.querySelector(`[data-ct-reference="${i + 1}"]`)).not.toBeNull()
    if (i < trace.checkpoints.length - 1)
      fireEvent.click(
        screen.getByRole('button', {
          name:
            i + 1 === trace.checkpoints.length - 1
              ? 'Inspect the distal airway–nodule relationship'
              : 'Continue to the next division',
        }),
      )
  }
}
// BBT-01 superseded "requires every real branch response … requires a complete changed transfer"
// and its shared-envelope participation checks: recording still needs every real part, but it is
// the learner's choice, and finishing writes only the self-paced reviewed note.
it('records a route when the learner chooses to, keeps a wrong choice as placed, and finishes with a note rather than a result', async () => {
  render(<BranchTracingLesson requestedId={lesson.id} />)
  await screen.findByRole('button', { name: 'Trace this airway' })
  imageReady()
  fireEvent.click(screen.getByRole('button', { name: 'Trace this airway' }))
  expect(document.querySelector('[data-ct-reference]')).toBeNull()
  expect(screen.getByRole('button', { name: 'Use this orientation' })).toBeInTheDocument()
  orient(lesson.prediction)
  expect(screen.queryByRole('button', { name: 'Record trace' })).not.toBeInTheDocument()
  markLevels(lesson.prediction, true)
  const prediction = traceById(lesson.prediction)
  const wrongEdge = prediction.checkpoints[0].decision!.options.find(
    (o) => o.sourceEdgeId !== prediction.checkpoints[0].sourceEdgeId,
  )!.sourceEdgeId
  expect(
    session().junctionHistory[`${prediction.id}.${prediction.checkpoints[0].id}`][0].branch,
  ).toBe(wrongEdge)
  fireEvent.click(screen.getByRole('button', { name: 'Record trace' }))
  expect(document.querySelector('[data-ct-reference]')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Reveal CT comparison' })).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Show the comparison without recording' }),
  ).toBeEnabled()
  fireEvent.change(screen.getByRole('combobox', { name: 'Airway course' }), {
    target: { value: 'cranial' },
  })
  expect(screen.getByRole('button', { name: 'Reveal CT comparison' })).toBeDisabled()
  relation()
  fireEvent.click(screen.getByRole('button', { name: 'Reveal CT comparison' }))
  imageReady()
  fireEvent.click(screen.getByText('Review the route in order'))
  fireEvent.click(screen.getByRole('button', { name: /^Stop 1:/ }))
  imageReady()
  expect(screen.getByLabelText('Your mark 1')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Review the relationship' }))
  fireEvent.click(screen.getByRole('button', { name: 'Trace another airway' }))
  expect(document.querySelector('[data-ct-reference]')).toBeNull()
  expect(screen.getByRole('button', { name: 'Use this orientation' })).toBeInTheDocument()
  orient(lesson.transfer)
  expect(screen.queryByRole('button', { name: 'Compare new trace' })).not.toBeInTheDocument()
  expect(reviewed()).toEqual([])
  markLevels(lesson.transfer)
  fireEvent.change(screen.getByRole('combobox', { name: 'Airway course' }), {
    target: { value: 'uncertain' },
  })
  expect(screen.getByRole('button', { name: 'Compare new trace' })).toBeDisabled()
  relation('different-structure')
  fireEvent.click(screen.getByRole('button', { name: 'Compare new trace' }))
  expect(reviewed()).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: 'Finish lesson' }))
  await waitFor(() => expect(reviewed()).toEqual([lesson.id]))
  expect(screen.getByText(/You recorded both routes/)).toBeVisible()
  const history = session().junctionHistory
  expect(storedAttempts().every((a) => a.hints === undefined && a.support === undefined)).toBe(true)
  expect(session().prediction.hints).toBeUndefined()
  expect(localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Restart lesson' }))
  expect(session().junctionHistory).toEqual(history)
  expect(JSON.stringify(readSelfPacedRecord(localStorage).record)).not.toMatch(
    /pixel|marks|course|sourceHu|hint|score|support/,
  )
})
// BBT-01 superseded "retains the first recorded trace and hint count": hint use is in-session help
// state only and is never written to a response or a progress record.
it('restores the recorded trace across reload and never records hint use', async () => {
  const view = render(<BranchTracingLesson requestedId={lesson.id} />)
  await screen.findByRole('button', { name: 'Trace this airway' })
  imageReady()
  fireEvent.click(screen.getByRole('button', { name: 'Trace this airway' }))
  orient(lesson.prediction)
  fireEvent.click(screen.getByRole('button', { name: 'Tracing reminder' }))
  markLevels(lesson.prediction)
  fireEvent.click(screen.getByRole('button', { name: 'Record trace' }))
  expect(session().hints).toBe(1)
  expect(storedAttempts().length).toBeGreaterThan(0)
  expect(storedAttempts().every((a) => a.hints === undefined)).toBe(true)
  view.unmount()
  render(<BranchTracingLesson requestedId={lesson.id} />)
  await screen.findByRole('button', { name: 'Reveal CT comparison' })
  expect(reviewed()).toEqual([])
  expect(localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBeNull()
})
it('shows a junction reference without recording, continues past junctions and both traces, and finishes with nothing recorded', async () => {
  const trace = traceById(lesson.prediction)
  render(<BranchTracingLesson requestedId={lesson.id} />)
  await screen.findByRole('button', { name: 'Trace this airway' })
  imageReady()
  fireEvent.click(screen.getByRole('button', { name: 'Trace this airway' }))
  imageReady()
  fireEvent.click(screen.getByRole('button', { name: 'Use this orientation' }))
  imageReady()
  fireEvent.click(screen.getByRole('button', { name: 'Go to response slice' }))
  imageReady()
  expect(document.querySelector('[data-ct-reference="1"]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Show reference for this junction' }))
  imageReady()
  expect(document.querySelector('[data-ct-reference="1"]')).not.toBeNull()
  expect(document.querySelector('[data-branch-comparison]')).not.toBeNull()
  expect(screen.queryByLabelText('Your mark 1')).toBeNull()
  expect(session()).toMatchObject({
    marks: trace.checkpoints.map(() => null),
    recorded: trace.checkpoints.map(() => false),
    junctionHistory: {},
  })
  for (let i = 0; i < trace.checkpoints.length - 1; i++) {
    fireEvent.click(screen.getByRole('button', { name: 'Continue without recording' }))
    imageReady()
  }
  expect(screen.getAllByText('Distal nodule approach').length).toBeGreaterThan(0)
  expect(session()).toMatchObject({ active: trace.checkpoints.length - 1, junctionHistory: {} })
  fireEvent.click(screen.getByRole('button', { name: 'Continue without recording this trace' }))
  fireEvent.click(screen.getByRole('button', { name: 'Show the comparison without recording' }))
  imageReady()
  expect(screen.getByText('No interpretation recorded for this trace')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Review the relationship' }))
  fireEvent.click(screen.getByRole('button', { name: 'Trace another airway' }))
  imageReady()
  fireEvent.click(screen.getByRole('button', { name: 'Finish without recording' }))
  expect(screen.getByRole('heading', { name: 'Lesson finished' })).toBeVisible()
  expect(
    screen.getByText(/You moved through both routes without recording an interpretation/),
  ).toBeVisible()
  expect(session()).toMatchObject({
    prediction: null,
    transfer: null,
    complete: true,
    junctionHistory: {},
  })
  expect(reviewed()).toEqual([lesson.id])
  expect(localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBeNull()
})
it('has no automated accessibility violations in orientation and before comparison', async () => {
  const { container } = render(<BranchTracingLesson requestedId={lesson.id} />)
  await screen.findByRole('button', { name: 'Trace this airway' })
  expect(await axe(container)).toHaveNoViolations()
  fireEvent.click(screen.getByRole('button', { name: 'Trace this airway' }))
  expect(await axe(container)).toHaveNoViolations()
})
