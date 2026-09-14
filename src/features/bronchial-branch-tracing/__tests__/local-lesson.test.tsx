import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { axe } from 'jest-axe'
import { BranchTracingLesson } from '../components/BranchTracingLesson'
import { LESSONS, ORIENTATION_CONTRACT } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { DRAFT_PREFIX } from '../engine/ct-draft'
import { completedLessons, readProgress } from '../engine/progress'

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
async function begin(id: string) {
  await screen.findByRole('heading', { name: LESSONS.find((l) => l.id === id)!.title })
  if (screen.queryByRole('button', { name: 'Focus on this airway' })) click('Focus on this airway')
  click(/^(Start marking branches|Start tracing)$/)
}
function reflect() {
  click('Compare with the caudal tracing view')
  click('Only the CT display orientation')
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
it('starts full-field standard, completes both same-lumen intervals without transforms, and continues to orientation', async () => {
  render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await screen.findByRole('button', { name: 'Focus on this airway' })
  ready()
  expect(document.querySelector('[data-preset]')).toHaveAttribute('data-preset', 'standard')
  expect(screen.getByRole('button', { name: 'Airway detail' })).toBeVisible()
  await begin('follow-one-airway')
  expect(screen.queryByRole('button', { name: 'Show target' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Flip left/ })).toBeNull()
  expect(screen.getByRole('button', { name: 'Check my tracing' })).toBeDisabled()
  recordLocal('follow-one-airway')
  click('Next airway interval')
  recordLocal('follow-one-airway', 1)
  click(/^Next lesson:/)
  expect(push).toHaveBeenCalledWith('/learn/anatomy/branch-tracing/learn?lesson=orientation')
  expect(completedLessons(readProgress())).toContain('follow-one-airway')
})
it('locks a same-slice pair, teaches observers before reflection, preserves negative comprehension and restored transform, and requires a real application', async () => {
  const view = render(<BranchTracingLesson requestedId="orientation" />)
  await screen.findByRole('button', { name: 'Focus on this airway' })
  click('Focus on this airway')
  expect(
    screen.getByRole('heading', { name: 'Patient, display and parent-airway viewpoint' }),
  ).toBeVisible()
  const copies = document.querySelectorAll('[data-comparison-copy] image')
  expect(copies).toHaveLength(2)
  expect(copies[0].getAttribute('href')).toEqual(copies[1].getAttribute('href'))
  const native = copies[0].parentElement!.getAttribute('transform')
  click('Compare with the caudal tracing view')
  expect(copies[0].parentElement!.getAttribute('transform')).toBe(native)
  expect(copies[1].parentElement!.getAttribute('transform')).not.toBe(native)
  click('The CT became a bronchoscopic image')
  expect(screen.getByRole('button', { name: 'Apply this to the same airway' })).toBeDisabled()
  expect(Object.keys(draft('orientation').history)).toHaveLength(0)
  view.unmount()
  render(<BranchTracingLesson requestedId="orientation" />)
  await screen.findByText(/Restored display:/)
  ready()
  click('Return to standard axial')
  click('Replay comparison')
  click('Only the CT display orientation')
  click('Apply this to the same airway')
  expect(completedLessons(readProgress())).not.toContain('orientation')
  click('Start tracing')
  recordLocal('orientation')
  click(/^Next lesson:/)
  expect(completedLessons(readProgress())).toContain('orientation')
  expect(readProgress().activities.some((a) => a.activityId.endsWith(ORIENTATION_CONTRACT))).toBe(
    true,
  )
})
it('supports off-slice browsing, preserved first marks, supported retries and honest image failure', async () => {
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
  const attempts = Object.values(draft('continuity').history)[0] as { support: string }[]
  expect(attempts[0]).toEqual(
    Object.values(first)[0] instanceof Array ? (Object.values(first)[0] as unknown[])[0] : null,
  )
  expect(attempts[1].support).toBe('after-comparison')
  click('Redo branch marks (optional)')
  document.querySelectorAll('image').forEach((image) => fireEvent.error(image))
  expect(screen.getByRole('button', { name: 'Check my tracing' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Retry slice' })).toBeVisible()
})
it('teaches the same parent relationship before an independent second-division response', async () => {
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
  expect(screen.queryByRole('button', { name: 'Finish lesson' })).toBeNull()
  click('Opening unresolved')
  click('Finish lesson')
  expect(screen.getByRole('link', { name: /^Next lesson:/ })).toHaveAttribute(
    'href',
    '/learn/anatomy/branch-tracing/learn?lesson=vertical',
  )
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
it('retains keyboard marking, outline access and automated accessibility checks', async () => {
  const { container } = render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await screen.findByRole('button', { name: 'Focus on this airway' })
  ready()
  expect(await axe(container)).toHaveNoViolations()
  await begin('follow-one-airway')
  click('Go to response slice')
  fireEvent.keyDown(screen.getByRole('group', { name: /^CT image\./ }), { key: 'Enter' })
  expect(screen.getByRole('heading', { name: 'Mark placed — ready to review' })).toBeVisible()
  click('Course outline')
  expect(screen.getByRole('dialog').querySelectorAll('ol a')).toHaveLength(9)
  click('Close')
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Check my tracing' })).toBeEnabled(),
  )
  expect(await axe(container)).toHaveNoViolations()
})
