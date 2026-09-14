import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { CRITICAL_CARE_PROGRESS_STORAGE_KEY } from '@/features/learning-module/activity/progress'
import { BranchTracingLesson } from '../components/BranchTracingLesson'
import { LESSONS } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { DRAFT_PREFIX } from '../engine/ct-draft'
import { readSelfPacedRecord } from '../engine/selfPacedProgress'

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
const click = (name: string | RegExp) => {
  ready()
  fireEvent.click(screen.getByRole('button', { name }))
  ready()
}
const draft = (id: string) => JSON.parse(localStorage.getItem(DRAFT_PREFIX + `learn.${id}`)!).value
const record = () => readSelfPacedRecord(localStorage).record
async function begin(id: string) {
  await screen.findByRole('heading', { name: LESSONS.find((l) => l.id === id)!.title })
  if (screen.queryByRole('button', { name: 'Focus on this airway' })) click('Focus on this airway')
  click(/^(Start marking branches|Start tracing)$/)
}
function reflect() {
  click('Compare with the caudal tracing view')
  click('Apply this to the same airway')
}
function recordLocal(id: string, index = 0) {
  const ex = localExercise(LESSONS.find((l) => l.id === id)!.exercises![index])
  ex.answerPoints.forEach((point) => {
    const button = screen.getByRole('button', {
      name: new RegExp(`^${point.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · slice`),
    })
    fireEvent.click(button)
    ready()
    click('Lumen unresolved here')
  })
  const course = screen.queryByRole('combobox', { name: 'Airway course' })
  if (course) fireEvent.change(course, { target: { value: 'uncertain' } })
  click('Check my tracing')
}
it('teaches the authored single-lumen lesson on the real trachea interval, stays in standard axial and continues to orientation', async () => {
  const lesson = LESSONS[0]
  const trachea = localExercise(lesson.exercises![0])
  render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await screen.findByRole('button', { name: 'Focus on this airway' })
  ready()
  expect(document.querySelector('[data-preset]')).toHaveAttribute('data-preset', 'standard')
  expect(screen.getByRole('button', { name: 'Airway detail' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Begin with standard axial CT' })).toBeVisible()
  click('Focus on this airway')
  const teaching = document.querySelector('[data-lesson-teaching]') as HTMLElement
  expect(within(teaching).getByText(lesson.purpose!)).toBeVisible()
  expect(within(teaching).getByText(lesson.worked)).toBeVisible()
  expect(within(teaching).getAllByRole('listitem')).toHaveLength(lesson.checklist!.length)
  expect(
    screen.getAllByText(
      new RegExp(
        `from slice ${trachea.trace.anchor.slice} to slice ${trachea.answerPoints[0].slice}`,
      ),
    ).length,
  ).toBeGreaterThan(0)
  expect(screen.queryByText('Earlier teaching and regional worked example')).toBeNull()
  expect(screen.queryByText(/upper-lobe example/i)).toBeNull()
  click('Start tracing')
  expect(screen.queryByRole('button', { name: 'Show target' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Flip left/ })).toBeNull()
  expect(screen.getByRole('button', { name: 'Check my tracing' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Continue without marking' })).toBeEnabled()
  expect(screen.getByRole('region', { name: 'Tracing checklist' })).toBeVisible()
  recordLocal('follow-one-airway')
  expect(screen.getByText(lesson.interpretation)).toBeVisible()
  click('Next airway interval')
  expect(screen.getByText(lesson.transferPrompt)).toBeVisible()
  recordLocal('follow-one-airway', 1)
  click(/^Next lesson:/)
  expect(push).toHaveBeenCalledWith('/learn/anatomy/branch-tracing/learn?lesson=orientation')
  expect(record()).toMatchObject({
    lastLessonId: 'follow-one-airway',
    visitedLessonIds: ['follow-one-airway'],
    reviewedLessonIds: ['follow-one-airway'],
  })
  expect(localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBeNull()
})
it('shows the reference without placing a mark, then moves on without marking and records nothing', async () => {
  render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await begin('follow-one-airway')
  expect(document.querySelector('[data-teaching-overlay]')).toBeNull()
  click('Show reference')
  expect(screen.getByRole('button', { name: 'Show reference' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await waitFor(() => {
    ready()
    expect(document.querySelector('[data-teaching-overlay]')).not.toBeNull()
  })
  expect(screen.queryByLabelText('Your mark 1')).toBeNull()
  expect(draft('follow-one-airway').marks).toEqual([null])
  expect(screen.getByRole('heading', { name: '2. Mark the same airway' })).toBeVisible()
  click('Continue without marking')
  expect(screen.getAllByText(/Same-lumen interval 2 of 2/).length).toBeGreaterThan(0)
  expect(draft('follow-one-airway').history).toEqual({})
  click('Continue without marking')
  expect(screen.getByRole('heading', { name: 'Lesson finished' })).toBeVisible()
  expect(
    screen.getByText(/You moved through the examples without checking marks, so none are recorded/),
  ).toBeVisible()
  expect(draft('follow-one-airway').history).toEqual({})
  expect(record().reviewedLessonIds).toEqual(['follow-one-airway'])
  click('Undo reviewed')
  expect(record().reviewedLessonIds).toEqual([])
  expect(screen.getByRole('link', { name: /^Next lesson:/ })).toHaveAttribute(
    'href',
    '/learn/anatomy/branch-tracing/learn?lesson=orientation',
  )
})
// BBT-01 superseded "preserves negative comprehension … requires a real application": the
// What-changed check is replaced by a visible comparison, so Apply needs no answer.
it('explains standard axial and the observers before any reflection, then compares the displays directly without an answer', async () => {
  const view = render(<BranchTracingLesson requestedId="orientation" />)
  await screen.findByRole('button', { name: 'Focus on this airway' })
  expect(screen.getByRole('heading', { name: 'Begin with standard axial CT' })).toBeVisible()
  click('Focus on this airway')
  expect(
    screen.getByRole('heading', { name: 'Patient, display and parent-airway viewpoint' }),
  ).toBeVisible()
  const copies = document.querySelectorAll('[data-comparison-copy] image')
  expect(copies).toHaveLength(2)
  expect(copies[0].getAttribute('href')).toEqual(copies[1].getAttribute('href'))
  const native = copies[0].parentElement!.getAttribute('transform')
  expect(copies[1].parentElement!.getAttribute('transform')).toBe(native)
  click('Compare with the caudal tracing view')
  expect(copies[0].parentElement!.getAttribute('transform')).toBe(native)
  expect(copies[1].parentElement!.getAttribute('transform')).not.toBe(native)
  expect(screen.getByText(/The patient has not moved\./)).toBeVisible()
  const comparison = document.querySelector('[data-orientation-comparison]') as HTMLElement
  for (const term of ['Changed', 'Unchanged', 'Still a cross-section'])
    expect(within(comparison).getByText(term)).toBeVisible()
  expect(screen.queryByText(/What changed\? · Ungraded check/)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Only the CT display orientation' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Apply this to the same airway' })).toBeEnabled()
  expect(Object.keys(draft('orientation').history)).toHaveLength(0)
  view.unmount()
  render(<BranchTracingLesson requestedId="orientation" />)
  await screen.findByText(/Restored display:/)
  ready()
  click('Return to standard axial')
  click('Replay comparison')
  click('Apply this to the same airway')
  expect(record().displayExplanationsShown).toEqual(['mirror'])
  expect(draft('orientation').orientationResponses).toEqual({})
  click('Start tracing')
  recordLocal('orientation')
  click(/^Next lesson:/)
  expect(record().reviewedLessonIds).toContain('orientation')
  expect(localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBeNull()
})
it('supports off-slice browsing, keeps checked marks exactly through retries and stays honest when an image fails', async () => {
  const view = render(<BranchTracingLesson requestedId="continuity" />)
  await begin('continuity')
  expect(document.querySelector('[data-teaching-overlay]')).toBeNull()
  fireEvent.change(screen.getByRole('slider', { name: 'CT slice' }), { target: { value: 389 } })
  ready()
  expect(screen.getByText(/Exploring slice 389/)).toBeVisible()
  click('What do I do now?')
  click('Close')
  expect(screen.getByRole('slider', { name: 'CT slice' })).toHaveValue('389')
  recordLocal('continuity')
  const first = draft('continuity').history
  view.unmount()
  render(<BranchTracingLesson requestedId="continuity" />)
  await screen.findByRole('heading', { name: 'Review the image evidence' })
  ready()
  click('Redo branch marks (optional)')
  recordLocal('continuity')
  const attempts = Object.values(draft('continuity').history)[0] as {
    support: string
    hints?: number
  }[]
  expect(attempts[0]).toEqual((Object.values(first)[0] as unknown[])[0])
  expect(attempts.map((attempt) => attempt.support)).toEqual(['not-recorded', 'not-recorded'])
  expect(attempts.every((attempt) => attempt.hints === undefined)).toBe(true)
  expect(screen.queryByText(/First attempt|hint level|independent application/i)).toBeNull()
  click('Redo branch marks (optional)')
  document.querySelectorAll('image').forEach((image) => fireEvent.error(image))
  expect(screen.getByRole('button', { name: 'Check my tracing' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Retry slice' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Continue without marking' })).toBeEnabled()
})
// BBT-01 superseded "independent second-division response": the opening choice stays as optional
// practice, the labels open on request, and Finish never waits on a choice.
it('teaches the parent relationship, then offers second-division matching as optional with labels on request', async () => {
  render(<BranchTracingLesson requestedId="continuity" />)
  await begin('continuity')
  recordLocal('continuity')
  click('Study the parent view')
  reflect()
  expect(screen.queryByRole('button', { name: 'Opening 1' })).toBeNull()
  expect(screen.getByText(/1 · A · RMSB|2 · A · RMSB/)).toBeVisible()
  click('Next example: LLL')
  expect(document.querySelector('[data-preset]')).toHaveAttribute('data-preset', 'standard')
  recordLocal('continuity', 1)
  click('Continue to branch matching')
  expect(screen.getByRole('button', { name: 'Opening 1' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Finish lesson' })).toBeEnabled()
  click('Show the labels')
  expect(screen.queryByRole('button', { name: 'Opening 1' })).toBeNull()
  expect(screen.getByText(/Labels shown without choosing an opening/)).toBeVisible()
  expect(draft('continuity')).toMatchObject({ viewAnswer: null, viewAnswers: {} })
  click('Finish lesson')
  expect(screen.getByRole('link', { name: /^Next lesson:/ })).toHaveAttribute(
    'href',
    '/learn/anatomy/branch-tracing/learn?lesson=vertical',
  )
  expect(screen.getByText(/You checked your marks on all 2 examples/)).toBeVisible()
})
it('renders pattern-specific teaching before application, keeps neutral controls and does not require a repeated parent quiz', async () => {
  render(<BranchTracingLesson requestedId="horizontal-horizontal" />)
  const lesson = LESSONS.find((l) => l.id === 'horizontal-horizontal')!
  await screen.findByRole('button', { name: 'Start marking branches' })
  ready()
  expect(screen.getByText(lesson.teaching[0])).toBeVisible()
  expect(
    screen.getByText('The RML parent and both daughter locations lie near axial level 307.'),
  ).toBeVisible()
  expect(document.querySelector('[data-preset]')).toHaveAttribute('data-preset', 'standard')
})
it('retains keyboard marking, an open outline with a next-lesson link, save for review and automated accessibility checks', async () => {
  const { container } = render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await screen.findByRole('button', { name: 'Focus on this airway' })
  ready()
  expect(await axe(container)).toHaveNoViolations()
  await begin('follow-one-airway')
  click('Go to response slice')
  fireEvent.keyDown(screen.getByRole('group', { name: /^CT image\./ }), { key: 'Enter' })
  expect(screen.getByRole('heading', { name: 'Mark placed — ready to review' })).toBeVisible()
  click('Course outline')
  const outline = screen.getByRole('dialog')
  expect(outline.querySelectorAll('ol a')).toHaveLength(9)
  expect(within(outline).getByText(/Every lesson is open/)).toBeVisible()
  click('Close')
  expect(screen.getByRole('link', { name: 'Next lesson' })).toHaveAttribute(
    'href',
    '/learn/anatomy/branch-tracing/learn?lesson=orientation',
  )
  expect(screen.getByRole('button', { name: 'Save for review' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  click('Save for review')
  expect(screen.getByRole('button', { name: 'Save for review' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(record().reviewLaterLessonIds).toEqual(['follow-one-airway'])
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Check my tracing' })).toBeEnabled(),
  )
  expect(await axe(container)).toHaveNoViolations()
})
