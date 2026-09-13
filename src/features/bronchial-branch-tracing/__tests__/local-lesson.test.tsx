import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { axe } from 'jest-axe'
import { BranchTracingLesson } from '../components/BranchTracingLesson'
import { LESSONS } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { DRAFT_PREFIX } from '../engine/ct-draft'
import { readProgress } from '../engine/progress'

const push = jest.fn()
jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}))
beforeEach(() => {
  window.localStorage.clear()
  push.mockClear()
})
const ready = () => document.querySelectorAll('image').forEach((image) => fireEvent.load(image))
async function begin() {
  fireEvent.click(await screen.findByRole('button', { name: /^(Your turn|Start tracing)$/ }))
  ready()
}
function markBoth() {
  for (const name of [/A · RMSB/, /B · LMSB/]) {
    fireEvent.click(screen.getByRole('button', { name }))
    ready()
    fireEvent.click(screen.getByRole('button', { name: 'Lumen unresolved here' }))
  }
  fireEvent.click(screen.getByRole('button', { name: 'Check my tracing' }))
}
it('isolates a local bifurcation, hides the model during attempts, preserves task when browsing and help, and restores a comparison', async () => {
  const view = render(<BranchTracingLesson requestedId="continuity" />)
  await begin()
  expect(document.querySelector('[data-teaching-overlay]')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Show target' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check my tracing' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Go to answer slice' }))
  ready()
  fireEvent.change(screen.getByRole('slider', { name: 'CT slice' }), {
    target: { value: '389' },
  })
  ready()
  expect(screen.getByText(/Exploring slice 389/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'What do I do now?' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Help does not reset your answers')
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.getByRole('slider', { name: 'CT slice' })).toHaveValue('389')
  markBoth()
  ready()
  expect(screen.getByRole('heading', { name: 'Review the image evidence' })).toBeVisible()
  expect(document.querySelector('[data-teaching-overlay]')).not.toBeNull()
  const key = DRAFT_PREFIX + 'learn.continuity'
  const first = JSON.parse(window.localStorage.getItem(key)!).value.history
  view.unmount()
  render(<BranchTracingLesson requestedId="continuity" />)
  await screen.findByRole('heading', { name: 'Review the image evidence' })
  expect(screen.getByText(/Draft restored on this device/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Try this bifurcation again' }))
  expect(document.querySelector('[data-teaching-overlay]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '3. Replay the walkthrough' }))
  ready()
  markBoth()
  const next = JSON.parse(window.localStorage.getItem(key)!).value.history
  expect(Object.values(next)[0]).toHaveLength(2)
  expect((Object.values(next)[0] as unknown[])[0]).toEqual(
    (Object.values(first)[0] as unknown[])[0],
  )
  fireEvent.click(screen.getByRole('button', { name: 'Try this bifurcation again' }))
  expect(document.querySelector('[data-teaching-overlay]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Save & exit' }))
  expect(push).toHaveBeenCalledWith('/learn/anatomy/branch-tracing')
  expect(readProgress().activities.every((a) => a.bestScore === undefined)).toBe(true)
})
it('gates the matched parent view behind a viewpoint response and gives the second example without a reference', async () => {
  render(<BranchTracingLesson requestedId="continuity" />)
  await begin()
  markBoth()
  expect(document.querySelectorAll('[aria-label^="Model direction schematic"]')).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Relate the parent view' }))
  expect(document.querySelectorAll('[aria-label^="Model direction schematic"]')).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Show parent airway view' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Opening 2' }))
  expect(screen.getByRole('button', { name: 'Show parent airway view' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Try another local example' }))
  expect(document.querySelector('[data-teaching-overlay]')).toBeNull()
  expect(screen.getByRole('button', { name: 'Check my tracing' })).toBeDisabled()
})
it('preserves native image/overlay transforms and never renders provisional contours', async () => {
  render(<BranchTracingLesson requestedId="orientation" />)
  await screen.findByRole('button', { name: 'Your turn' })
  ready()
  const exercise = localExercise(LESSONS.find((l) => l.id === 'orientation')!.exercises![0])
  expect(exercise.review.status).toBe('provisional')
  fireEvent.click(screen.getByRole('button', { name: /Rotate 90° left/ }))
  expect(document.querySelector('image')!.parentElement!.getAttribute('transform')).toContain(
    'rotate(-90)',
  )
  expect(document.querySelector('[data-teaching-overlay] polygon')).toBeNull()
})
it('has no automated accessibility violations in the CT demonstration and attempt', async () => {
  const { container } = render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await screen.findByRole('button', { name: 'Start tracing' })
  ready()
  expect(await axe(container)).toHaveNoViolations()
  await begin()
  expect(await axe(container)).toHaveNoViolations()
})
it('explains the warm-up, acknowledges a placed mark, restores it and opens bifurcations after both reviews', async () => {
  const exercises = LESSONS[0].exercises!.map(localExercise)
  const view = render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await begin()
  expect(screen.getByText(/This is a brief viewer warm-up/)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Review my mark' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '3. Replay the walkthrough' }))
  fireEvent.click(screen.getByRole('button', { name: 'Go to answer slice' }))
  ready()
  fireEvent.keyDown(screen.getByRole('group', { name: /^CT image\./ }), { key: 'Enter' })
  expect(screen.getByRole('heading', { name: 'Mark placed — ready to review' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Review my mark' })).toBeEnabled()
  expect(screen.getByText(/Mark placed on slice 412. Select Review my mark above/)).toBeVisible()
  expect(screen.queryByText(/Answer slice 412: mark the lumen/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Next demonstration slice' })).not.toBeInTheDocument()
  const key = DRAFT_PREFIX + 'learn.follow-one-airway'
  const draft = JSON.parse(window.localStorage.getItem(key)!)
  view.unmount()
  render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await screen.findByRole('heading', { name: 'Mark placed — ready to review' })
  expect(JSON.parse(window.localStorage.getItem(key)!).value.marks).toEqual(draft.value.marks)
  fireEvent.click(screen.getByRole('button', { name: 'Review my mark' }))
  fireEvent.click(
    screen.getByRole('button', { name: `Starting slice ${exercises[0].trace.anchor.slice}` }),
  )
  expect(screen.getByRole('slider', { name: 'CT slice' })).toHaveValue(
    String(exercises[0].trace.anchor.slice),
  )
  fireEvent.click(
    screen.getByRole('button', {
      name: `My response · slice ${exercises[0].answerPoints[0].slice}`,
    }),
  )
  expect(screen.getByRole('slider', { name: 'CT slice' })).toHaveValue(
    String(exercises[0].answerPoints[0].slice),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Next airway' }))
  fireEvent.click(screen.getByRole('button', { name: 'Go to answer slice' }))
  ready()
  fireEvent.click(screen.getByRole('button', { name: 'Lumen unresolved here' }))
  fireEvent.click(screen.getByRole('button', { name: 'Review my mark' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue to bifurcations' }))
  expect(push).toHaveBeenCalledWith('/learn/anatomy/branch-tracing/learn?lesson=continuity')
  const complete = JSON.parse(window.localStorage.getItem(key)!)
  expect(complete.value.phase).toBe('complete')
  expect(complete.signature).toBe(draft.signature)
  expect(complete.value.history[exercises[0].id][0].marks).toEqual(draft.value.marks)
})
it('warns before exiting when browser storage fails', async () => {
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('unavailable')
  })
  render(<BranchTracingLesson requestedId="continuity" />)
  await begin()
  fireEvent.click(screen.getByRole('button', { name: 'Save & exit' }))
  await waitFor(() =>
    expect(screen.getByRole('dialog')).toHaveTextContent('Leaving now will lose changes'),
  )
  expect(push).not.toHaveBeenCalled()
  jest.restoreAllMocks()
})
