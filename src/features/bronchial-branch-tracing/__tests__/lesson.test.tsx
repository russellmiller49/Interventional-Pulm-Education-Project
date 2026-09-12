import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BranchTracingLesson } from '../components/BranchTracingLesson'
import { traceById } from '../geometry/native-ct'
import { LESSONS } from '../content/lessons'
import { completedLessons, readProgress } from '../engine/progress'
import { axe } from 'jest-axe'

jest.mock('@/i18n/navigation', () => ({
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
function imageReady() {
  document.querySelectorAll('image').forEach((image) => fireEvent.load(image))
}
function relation(value = 'unresolved') {
  fireEvent.change(screen.getByRole('combobox', { name: 'Airway–nodule relationship' }), {
    target: { value },
  })
}
function orient(id: string) {
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
  fireEvent.click(screen.getByRole('button', { name: 'Check orientation' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Current junction CT' }))
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
              ? 'Continue to nodule approach'
              : 'Next junction',
        }),
      )
  }
}
it('requires every real branch response, withholds each junction comparison until recording, retains a wrong choice and requires a complete changed transfer', async () => {
  const lesson = LESSONS[0]
  render(<BranchTracingLesson requestedId={lesson.id} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Trace this airway' }))
  expect(document.querySelector('[data-ct-reference]')).toBeNull()
  expect(screen.getByRole('button', { name: 'Check orientation' })).toBeDisabled()
  orient(lesson.prediction)
  expect(screen.queryByRole('button', { name: 'Record trace' })).not.toBeInTheDocument()
  markLevels(lesson.prediction, true)
  fireEvent.click(screen.getByRole('button', { name: 'Record trace' }))
  expect(document.querySelector('[data-ct-reference]')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Reveal CT comparison' })).toBeDisabled()
  fireEvent.change(screen.getByRole('combobox', { name: 'Airway course' }), {
    target: { value: 'cranial' },
  })
  expect(screen.getByRole('button', { name: 'Reveal CT comparison' })).toBeDisabled()
  relation()
  fireEvent.click(screen.getByRole('button', { name: 'Reveal CT comparison' }))
  imageReady()
  expect(document.querySelector('[data-ct-reference]')).not.toBeNull()
  fireEvent.click(screen.getByText('Review the route in order'))
  fireEvent.click(screen.getByRole('button', { name: /^Stop 1:/ }))
  imageReady()
  expect(screen.getByLabelText('Your mark 1')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Review the relationship' }))
  fireEvent.click(screen.getByRole('button', { name: 'Trace another airway' }))
  expect(document.querySelector('[data-ct-reference]')).toBeNull()
  expect(screen.getByRole('button', { name: 'Check orientation' })).toBeDisabled()
  orient(lesson.transfer)
  expect(screen.queryByRole('button', { name: 'Compare new trace' })).not.toBeInTheDocument()
  expect(completedLessons(readProgress())).toEqual([])
  markLevels(lesson.transfer)
  fireEvent.change(screen.getByRole('combobox', { name: 'Airway course' }), {
    target: { value: 'uncertain' },
  })
  expect(screen.getByRole('button', { name: 'Compare new trace' })).toBeDisabled()
  relation('different-structure')
  fireEvent.click(screen.getByRole('button', { name: 'Compare new trace' }))
  expect(completedLessons(readProgress())).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: 'Finish lesson' }))
  await waitFor(() => expect(completedLessons(readProgress())).toEqual([lesson.id]))
  const first = readProgress().activities.find((a) =>
    a.activityId.endsWith('prediction.trace.first'),
  )!
  expect(first.bestScore).toBeUndefined()
  fireEvent.click(screen.getByRole('button', { name: 'Restart lesson' }))
  expect(readProgress().activities.find((a) => a.activityId === first.activityId)).toEqual(first)
  expect(readProgress().activities.some((a) => a.status === 'mastered')).toBe(false)
  expect(JSON.stringify(readProgress())).not.toMatch(/pixel|marks|course|sourceHu/)
})
it('retains the first recorded trace and hint count across reload before comparison', async () => {
  const view = render(<BranchTracingLesson requestedId={LESSONS[0].id} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Trace this airway' }))
  orient(LESSONS[0].prediction)
  fireEvent.click(screen.getByRole('button', { name: 'Tracing reminder' }))
  markLevels(LESSONS[0].prediction)
  fireEvent.click(screen.getByRole('button', { name: 'Record trace' }))
  const first = readProgress().activities.find((a) =>
    a.activityId.endsWith('prediction.trace.first'),
  )!
  expect(first.hintCount).toBe(1)
  view.unmount()
  render(<BranchTracingLesson requestedId={LESSONS[0].id} />)
  await screen.findByRole('button', { name: 'Trace this airway' })
  expect(readProgress().activities.find((a) => a.activityId === first.activityId)).toEqual(first)
  expect(completedLessons(readProgress())).toEqual([])
})
it('keeps all RB5 divisions distinct and shows their actual bronchial names at the appropriate junction', async () => {
  const lesson = LESSONS.find((l) => l.id === 'horizontal-vertical')!
  render(<BranchTracingLesson requestedId={lesson.id} />)
  await screen.findByRole('button', { name: 'Trace this airway' })
  expect(screen.getByRole('heading', { name: 'Airway names' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Trace this airway' }))
  orient(lesson.prediction)
  expect(screen.getAllByRole('radio').map((n) => n.getAttribute('value'))).toEqual([
    '1',
    '2',
    'unresolved',
  ])
  expect(document.querySelector('[data-ct-reference]')).toBeNull()
  markLevels(lesson.prediction)
  fireEvent.click(screen.getByRole('button', { name: 'Record trace' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Airway course' }), {
    target: { value: 'uncertain' },
  })
  relation()
  fireEvent.click(screen.getByRole('button', { name: 'Reveal CT comparison' }))
  imageReady()
  expect(
    screen.getByLabelText(/Reference: Right medial bronchus, subsegment b, distal nodule approach/),
  ).toBeVisible()
})
it('has no automated accessibility violations in orientation and before comparison', async () => {
  const { container } = render(<BranchTracingLesson requestedId={LESSONS[0].id} />)
  await screen.findByRole('button', { name: 'Trace this airway' })
  expect(await axe(container)).toHaveNoViolations()
  fireEvent.click(screen.getByRole('button', { name: 'Trace this airway' }))
  expect(await axe(container)).toHaveNoViolations()
})
