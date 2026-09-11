import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BranchTracingLesson } from '../components/BranchTracingLesson'
import { LESSONS } from '../content/lessons'
import { childrenOf, openingPosition } from '../content/phantoms'
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
    value: jest.fn().mockImplementation(() => ({
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

it('runs the real lesson with a wrong choice, withheld comparison, authored transfer and honest completion', async () => {
  const lesson = LESSONS[0]
  render(<BranchTracingLesson requestedId={lesson.id} />)
  await screen.findByRole('button', { name: 'Try a new branch' })
  expect(completedLessons(readProgress())).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: 'Try a new branch' }))
  expect(screen.queryByRole('heading', { name: 'Reference comparison' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Record branch choice' })).toBeDisabled()
  const wrong = childrenOf(lesson.prediction.phantom).find(
    (b) => b.id !== lesson.prediction.targetId,
  )!
  fireEvent.click(screen.getByRole('radio', { name: `Branch ${wrong.label}` }))
  fireEvent.click(screen.getByRole('button', { name: 'Record branch choice' }))
  expect(screen.queryByRole('heading', { name: 'Reference comparison' })).not.toBeInTheDocument()
  for (const b of childrenOf(lesson.prediction.phantom))
    fireEvent.change(screen.getByLabelText(`Opening ${b.label}`, { selector: 'select' }), {
      target: { value: openingPosition(lesson.prediction.phantom, b) },
    })
  fireEvent.click(screen.getByRole('button', { name: 'Submit opening map' }))
  expect(screen.getByRole('heading', { name: 'Reference comparison' })).toBeInTheDocument()
  expect(screen.getByText('Review the branch connection')).toBeInTheDocument()
  expect(screen.getByLabelText(`Branch ${wrong.label}, your selected route`)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Read the explanation' }))
  fireEvent.click(screen.getByRole('button', { name: 'Apply it to a changed view' }))
  expect(screen.queryByRole('heading', { name: 'Reference comparison' })).not.toBeInTheDocument()
  expect(completedLessons(readProgress())).toEqual([])
  fireEvent.click(screen.getByRole('radio', { name: 'Continuation unresolved' }))
  for (const b of childrenOf(lesson.transfer.phantom))
    fireEvent.change(screen.getByLabelText(`Opening ${b.label}`, { selector: 'select' }), {
      target: { value: openingPosition(lesson.transfer.phantom, b) },
    })
  fireEvent.click(screen.getByRole('button', { name: 'Submit new interpretation' }))
  expect(completedLessons(readProgress())).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: 'Finish lesson' }))
  await waitFor(() => expect(completedLessons(readProgress())).toEqual([lesson.id]))
  const first = readProgress().activities.find((a) =>
    a.activityId.endsWith('prediction.connectivity.first'),
  )
  expect(first?.bestScore).toBe(0)
  fireEvent.click(screen.getByRole('button', { name: 'Restart lesson' }))
  expect(readProgress().activities.find((a) => a.activityId === first?.activityId)?.bestScore).toBe(
    0,
  )
  expect(readProgress().activities.some((a) => a.status === 'mastered')).toBe(false)
})

it('retains the first branch prediction across reload before the map is submitted', async () => {
  const lesson = LESSONS[0]
  const view = render(<BranchTracingLesson requestedId={lesson.id} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Try a new branch' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Continuation unresolved' }))
  fireEvent.click(screen.getByRole('button', { name: 'Record branch choice' }))
  const saved = readProgress().activities.find((a) =>
    a.activityId.endsWith('prediction.connectivity.first'),
  )
  expect(saved?.bestScore).toBe(0)
  expect(
    readProgress().activities.some((a) => a.activityId.endsWith('prediction.viewpoint.first')),
  ).toBe(false)
  view.unmount()
  render(<BranchTracingLesson requestedId={lesson.id} />)
  await screen.findByRole('button', { name: 'Try a new branch' })
  expect(readProgress().activities.find((a) => a.activityId === saved?.activityId)?.bestScore).toBe(
    0,
  )
  expect(completedLessons(readProgress())).toEqual([])
})

it('has no automated accessibility violations on the rendered orientation and pending response', async () => {
  const { container } = render(<BranchTracingLesson requestedId={LESSONS[0].id} />)
  await screen.findByRole('button', { name: 'Try a new branch' })
  expect(await axe(container)).toHaveNoViolations()
  fireEvent.click(screen.getByRole('button', { name: 'Try a new branch' }))
  expect(await axe(container)).toHaveNoViolations()
})
