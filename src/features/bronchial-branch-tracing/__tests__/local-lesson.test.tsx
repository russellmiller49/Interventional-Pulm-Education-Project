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
  const focus = await screen.findByRole('button', { name: 'Focus on this airway' })
  ready()
  fireEvent.click(focus)
  fireEvent.click(
    await screen.findByRole('button', { name: /^(Start marking branches|Start tracing)$/ }),
  )
  ready()
}
function learnReflection() {
  ready()
  fireEvent.click(screen.getByRole('button', { name: 'Reflect left ↔ right' }))
  fireEvent.click(screen.getByRole('button', { name: 'Only the CT display orientation' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue in tracing view' }))
}
function markBoth() {
  for (const name of [/^A · RMSB/, /^B · LMSB/]) {
    fireEvent.click(screen.getByRole('button', { name }))
    ready()
    fireEvent.click(screen.getByRole('button', { name: 'Lumen unresolved here' }))
  }
  fireEvent.click(screen.getByRole('button', { name: 'Review my marks' }))
}
it('isolates a local bifurcation, hides the model during attempts, preserves task when browsing and help, and restores a comparison', async () => {
  const view = render(<BranchTracingLesson requestedId="continuity" />)
  await begin()
  expect(document.querySelector('[data-teaching-overlay]')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Show target' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Review my marks' })).toBeDisabled()
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
  fireEvent.click(screen.getByRole('button', { name: 'What do I do now?' }))
  expect(screen.getByText(/Draft restored on this device/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  fireEvent.click(screen.getByRole('button', { name: 'Redo branch marks (optional)' }))
  expect(document.querySelector('[data-teaching-overlay]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '3. Replay the walkthrough' }))
  ready()
  markBoth()
  const next = JSON.parse(window.localStorage.getItem(key)!).value.history
  expect(Object.values(next)[0]).toHaveLength(2)
  expect((Object.values(next)[0] as unknown[])[0]).toEqual(
    (Object.values(first)[0] as unknown[])[0],
  )
  fireEvent.click(screen.getByRole('button', { name: 'Redo branch marks (optional)' }))
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
  fireEvent.click(screen.getByRole('button', { name: 'Continue to branch matching' }))
  expect(document.querySelectorAll('[aria-label^="Model direction schematic"]')).toHaveLength(0)
  learnReflection()
  expect(document.querySelectorAll('[aria-label^="Model direction schematic"]')).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Show parent airway view' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Opening 2' }))
  expect(screen.getByRole('button', { name: 'Show parent airway view' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Next example: LLL' }))
  expect(document.querySelector('[data-teaching-overlay]')).toBeNull()
  expect(screen.getByRole('button', { name: 'Review my marks' })).toBeDisabled()
})
it('acknowledges each branch mark and restores the review with a direct path through matching to lesson completion', async () => {
  const lesson = LESSONS.find((item) => item.id === 'continuity')!
  const exercises = lesson.exercises!.map(localExercise)
  const key = DRAFT_PREFIX + 'learn.continuity'
  const view = render(<BranchTracingLesson requestedId="continuity" />)
  await begin()
  const markCurrent = () => {
    ready()
    fireEvent.keyDown(screen.getByRole('group', { name: /^CT image\./ }), { key: 'Enter' })
  }
  for (const [i, exercise] of exercises.entries()) {
    fireEvent.click(screen.getByRole('button', { name: 'Go to answer slice' }))
    markCurrent()
    expect(screen.getByText('1 of 2 branch responses recorded')).toBeVisible()
    expect(
      screen.getByText(new RegExp(`Your ${exercise.answerPoints[0].label} mark is recorded`)),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Continue to branch matching' }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: `Mark ${exercise.answerPoints[1].label}` }))
    expect(screen.getByRole('slider', { name: 'CT slice' })).toHaveValue(
      String(exercise.answerPoints[1].slice),
    )
    markCurrent()
    expect(screen.getByRole('button', { name: 'Review my marks' })).toBeEnabled()
    expect(JSON.parse(localStorage.getItem(key)!).value.phase).toBe('attempt')
    fireEvent.click(screen.getByRole('button', { name: 'Review my marks' }))
    expect(screen.getByRole('heading', { name: '3. Your branch marks are recorded' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Play walkthrough' })).not.toBeVisible()
    if (i === 1) {
      const recorded = JSON.parse(localStorage.getItem(key)!)
      view.unmount()
      render(<BranchTracingLesson requestedId="continuity" />)
      await screen.findByRole('button', { name: 'Continue to branch matching' })
      expect(JSON.parse(localStorage.getItem(key)!).value.history).toEqual(recorded.value.history)
      expect(JSON.parse(localStorage.getItem(key)!).signature).toBe(recorded.signature)
    }
    fireEvent.click(screen.getByRole('button', { name: 'Continue to branch matching' }))
    if (i === 0) learnReflection()
    expect(screen.getByRole('heading', { name: '4. Match the branches' })).toBeVisible()
    expect(screen.getByRole('slider', { name: 'CT slice' })).toHaveValue(
      String(exercise.answerPoints[0].slice),
    )
    expect(screen.queryByRole('button', { name: 'Finish lesson' })).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: i === 0 ? 'Opening 1' : 'Opening unresolved' }),
    )
    expect(screen.getByRole('heading', { name: '4. Branch match recorded' })).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: i === 0 ? 'Next example: LLL' : 'Finish lesson' }),
    )
  }
  expect(screen.getByRole('heading', { name: 'Lesson completed' })).toBeVisible()
  expect(screen.getByRole('link', { name: /^Next lesson:/ })).toHaveAttribute(
    'href',
    '/learn/anatomy/branch-tracing/learn?lesson=orientation',
  )
  const finished = JSON.parse(localStorage.getItem(key)!).value
  expect(finished.phase).toBe('complete')
  for (const exercise of exercises) {
    expect(finished.history[exercise.id]).toHaveLength(1)
    expect(finished.viewAnswers[exercise.id]).toHaveLength(1)
  }
})
it('teaches the viewing direction, transforms the same image, checks understanding and resumes safely', async () => {
  const view = render(<BranchTracingLesson requestedId="orientation" />)
  const focus = await screen.findByRole('button', { name: 'Focus on this airway' })
  ready()
  const exercise = localExercise(LESSONS.find((l) => l.id === 'orientation')!.exercises![0])
  expect(exercise.review.status).toBe('provisional')
  expect(screen.getByRole('heading', { name: 'Begin with standard axial CT' })).toBeVisible()
  expect(document.querySelector('[data-preset]')).toHaveAttribute('data-preset', 'standard')
  fireEvent.click(focus)
  expect(
    screen.getByRole('heading', { name: 'CT and bronchoscopy look in different directions' }),
  ).toBeVisible()
  const before = document.querySelector('image')!
  const slice = screen.getByRole('slider', { name: 'CT slice' }).getAttribute('value')
  const transform = before.parentElement!.getAttribute('transform')!
  fireEvent.click(screen.getByRole('button', { name: 'Reflect left ↔ right' }))
  expect(document.querySelector('image')).toBe(before)
  expect(document.querySelector('image')!.parentElement!.getAttribute('transform')).toBe(
    transform.replace('scale(1 1)', 'scale(-1 1)'),
  )
  expect(screen.getByRole('slider', { name: 'CT slice' })).toHaveValue(slice)
  expect(screen.getByRole('button', { name: 'Continue in tracing view' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'The CT became a bronchoscopic image' }))
  expect(screen.getByText(/This remains a CT cross-section/)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Continue in tracing view' })).toBeDisabled()
  view.unmount()
  render(<BranchTracingLesson requestedId="orientation" />)
  await screen.findByText(/This remains a CT cross-section/)
  ready()
  fireEvent.click(screen.getByRole('button', { name: 'Standard axial' }))
  expect(document.querySelector('[data-preset]')).toHaveAttribute('data-preset', 'standard')
  fireEvent.click(screen.getByRole('button', { name: 'Show tracing view' }))
  fireEvent.click(screen.getByRole('button', { name: 'Only the CT display orientation' }))
  expect(screen.getByText(/Correct. The airway is unchanged/)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Start marking branches' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Continue in tracing view' }))
  expect(screen.getByRole('button', { name: 'Start marking branches' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Reset to standard' }))
  expect(document.querySelector('[data-preset]')).toHaveAttribute('data-preset', 'standard')
  expect(
    readProgress().activities.find((a) => a.activityId.endsWith('.orientation.mirror')),
  ).toMatchObject({ status: 'completed', competencyEvidenceIds: [] })
  expect(readProgress().activities.every((a) => a.bestScore === undefined)).toBe(true)
  expect(document.querySelector('[data-teaching-overlay] polygon')).toBeNull()
})
it('has no automated accessibility violations in the CT demonstration and attempt', async () => {
  const { container } = render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await screen.findByRole('button', { name: 'Focus on this airway' })
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
  expect(screen.getByText(/Your mark on slice 412 is ready/)).toBeVisible()
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
