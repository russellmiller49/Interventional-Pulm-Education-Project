import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BranchTracingLesson } from '../components/BranchTracingLesson'
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
  const image = document.querySelector('image')!
  fireEvent.load(image)
}
function markLevels(wrong = false) {
  for (let i = 0; i < 3; i++) {
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Trace levels' })).getAllByRole('button')[i + 1],
    )
    imageReady()
    if (wrong && i === 0) {
      const svg = screen.getByRole('group', { name: /^CT image\./ })
      jest.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        toJSON: () => ({}),
      })
      // jsdom lacks PointerEvent; the real keyboard placement handler is also supported.
      fireEvent.keyDown(svg, { key: 'ArrowLeft', shiftKey: true })
      fireEvent.keyDown(svg, { key: 'Enter' })
      expect(screen.getByLabelText('Your mark 1')).toBeInTheDocument()
    } else fireEvent.click(screen.getByRole('button', { name: 'Lumen unresolved at this level' }))
  }
}
it('requires a real three-level response, withholds references, preserves a wrong mark and requires a new transfer', async () => {
  const lesson = LESSONS[0]
  render(<BranchTracingLesson requestedId={lesson.id} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Trace this airway' }))
  expect(document.querySelector('[data-ct-reference]')).toBeNull()
  expect(screen.getByRole('button', { name: 'Record trace' })).toBeDisabled()
  markLevels(true)
  fireEvent.click(screen.getByRole('button', { name: 'Record trace' }))
  expect(document.querySelector('[data-ct-reference]')).toBeNull()
  expect(screen.getByRole('button', { name: 'Reveal CT comparison' })).toBeDisabled()
  fireEvent.change(screen.getByRole('combobox', { name: 'Airway course' }), {
    target: { value: 'cranial' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Reveal CT comparison' }))
  imageReady()
  expect(document.querySelector('[data-ct-reference]')).not.toBeNull()
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Trace levels' })).getAllByRole('button')[1],
  )
  imageReady()
  expect(screen.getByLabelText('Your mark 1')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Review the relationship' }))
  fireEvent.click(screen.getByRole('button', { name: 'Trace another airway' }))
  expect(document.querySelector('[data-ct-reference]')).toBeNull()
  expect(screen.getByRole('button', { name: 'Compare new trace' })).toBeDisabled()
  expect(completedLessons(readProgress())).toEqual([])
  markLevels()
  fireEvent.change(screen.getByRole('combobox', { name: 'Airway course' }), {
    target: { value: 'uncertain' },
  })
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
  fireEvent.click(screen.getByRole('button', { name: 'Tracing reminder' }))
  markLevels()
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
it('has no automated accessibility violations in orientation and before comparison', async () => {
  const { container } = render(<BranchTracingLesson requestedId={LESSONS[0].id} />)
  await screen.findByRole('button', { name: 'Trace this airway' })
  expect(await axe(container)).toHaveNoViolations()
  fireEvent.click(screen.getByRole('button', { name: 'Trace this airway' }))
  expect(await axe(container)).toHaveNoViolations()
})
