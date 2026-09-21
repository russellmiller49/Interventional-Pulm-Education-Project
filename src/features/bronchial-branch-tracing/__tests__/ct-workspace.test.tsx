import { fireEvent, render, screen } from '@testing-library/react'
import { BranchTracingLesson } from '../components/BranchTracingLesson'
import { LESSONS } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { DRAFT_PREFIX } from '../engine/ct-draft'

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

const images = () => [...document.querySelectorAll('image')]
const ready = () => images().forEach((image) => fireEvent.load(image))
const click = (name: string | RegExp) => {
  ready()
  fireEvent.click(screen.getByRole('button', { name }))
  ready()
}
const surface = () => document.querySelector('[data-preset]') as HTMLElement
const shownHref = () =>
  (
    document.querySelector('[data-preset] image:not([aria-hidden])') as SVGImageElement | null
  )?.getAttribute('href') ?? null
const draft = (id: string) => JSON.parse(localStorage.getItem(DRAFT_PREFIX + `learn.${id}`)!).value
async function begin(id: string) {
  await screen.findByRole('heading', { name: LESSONS.find((l) => l.id === id)!.title })
  if (screen.queryByRole('button', { name: 'Focus on this airway' })) click('Focus on this airway')
  click(/^(Start marking branches|Start tracing)$/)
}

it('keeps both response actions in the DOM, with their identity and focus, across the response-slice transition', async () => {
  render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await begin('follow-one-airway')
  const exercise = localExercise(LESSONS[0].exercises![0])
  const response = exercise.answerPoints[0].slice
  const go = screen.getByRole('button', { name: 'Go to response slice' })
  const unresolved = screen.getByRole('button', { name: 'Lumen unresolved here' })
  expect(surface()).toHaveAttribute('data-slice', String(exercise.trace.anchor.slice))
  expect(go).toBeEnabled()
  expect(unresolved).toBeDisabled()
  const minus = screen.getByRole('button', { name: 'More caudal CT slice' })
  minus.focus()
  for (let slice = exercise.trace.anchor.slice; slice > response; slice--) {
    fireEvent.click(minus)
    ready()
  }
  expect(surface()).toHaveAttribute('data-slice', String(response))
  // The same nodes, still focusable, with only their enabled state changed.
  expect(screen.getByRole('button', { name: 'Go to response slice' })).toBe(go)
  expect(screen.getByRole('button', { name: 'Lumen unresolved here' })).toBe(unresolved)
  expect(screen.getByRole('button', { name: 'More caudal CT slice' })).toBe(minus)
  expect(document.activeElement).toBe(minus)
  expect(go).toBeEnabled()
  expect(unresolved).toBeEnabled()
  // The action row keeps its place even when no response can be placed any more.
  fireEvent.click(unresolved)
  ready()
  click('Check my tracing')
  expect(screen.getByRole('button', { name: 'Go to response slice' })).toBeInTheDocument()
  expect(screen.getByText(/Reviewing slice/)).toBeVisible()
})

it('shows the previous plane with its own slice number until the requested one loads, then swaps once', async () => {
  render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await begin('follow-one-airway')
  const start = localExercise(LESSONS[0].exercises![0]).trace.anchor.slice
  const before = shownHref()
  expect(before).toContain(String(start))
  fireEvent.click(screen.getByRole('button', { name: 'More caudal CT slice' }))
  // Requested but not decoded: the old pixels stay, and they are still labelled
  // with the plane they actually are.
  expect(shownHref()).toBe(before)
  expect(surface()).toHaveAttribute('data-slice', String(start))
  expect(surface()).toHaveAttribute('data-requested-slice', String(start - 1))
  expect(surface()).toHaveAttribute('data-ct-ready', 'false')
  expect(
    screen.getByText(`Slice ${start} · patient directions stay attached to the image.`),
  ).toBeVisible()
  expect(document.querySelector('[data-ct-load="loading"]')).not.toBeNull()
  ready()
  expect(shownHref()).toContain(String(start - 1))
  expect(surface()).toHaveAttribute('data-slice', String(start - 1))
  expect(surface()).toHaveAttribute('data-ct-ready', 'true')
  expect(document.querySelector('[data-ct-load]')).toBeNull()
})

it('reports a failed plane honestly and recovers on retry without marking it ready', async () => {
  render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await begin('follow-one-airway')
  fireEvent.click(screen.getByRole('button', { name: 'More caudal CT slice' }))
  images().forEach((image) => fireEvent.error(image))
  expect(document.querySelector('[data-ct-load="failed"]')).not.toBeNull()
  expect(surface()).toHaveAttribute('data-ct-ready', 'false')
  expect(screen.getByRole('button', { name: 'Check my tracing' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Retry slice' }))
  ready()
  expect(surface()).toHaveAttribute('data-ct-ready', 'true')
  expect(screen.queryByRole('button', { name: 'Retry slice' })).toBeNull()
})

it('leaves the wheel scrolling the page until slice stepping is explicitly turned on', async () => {
  render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await begin('follow-one-airway')
  const start = localExercise(LESSONS[0].exercises![0]).trace.anchor.slice
  const wheel = () => !fireEvent.wheel(surface(), { deltaY: 120 })
  expect(wheel()).toBe(false)
  ready()
  expect(surface()).toHaveAttribute('data-slice', String(start))
  click('Wheel steps slices: off')
  expect(wheel()).toBe(true)
  ready()
  expect(surface()).toHaveAttribute('data-slice', String(start - 1))
  // Escape releases the mode, so the learner is never held inside the canvas.
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.getByRole('button', { name: 'Wheel steps slices: off' })).toBeInTheDocument()
  expect(wheel()).toBe(false)
})

it('hides and restores every overlay without touching the recorded mark', async () => {
  render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await begin('follow-one-airway')
  click('Go to response slice')
  fireEvent.keyDown(screen.getByRole('group', { name: /^CT image\./ }), { key: 'Enter' })
  ready()
  const placed = draft('follow-one-airway').marks
  expect(screen.getByLabelText('Your mark 1')).toBeInTheDocument()
  click('Hide overlays')
  expect(screen.queryByLabelText('Your mark 1')).toBeNull()
  expect(document.querySelectorAll('[data-preset] text')).toHaveLength(0)
  expect(draft('follow-one-airway').marks).toEqual(placed)
  click('Show overlays')
  expect(screen.getByLabelText('Your mark 1')).toBeInTheDocument()
  expect(draft('follow-one-airway').marks).toEqual(placed)
})

it('magnifies the native plane without moving the mark it records', async () => {
  render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await begin('follow-one-airway')
  click('Go to response slice')
  const image = screen.getByRole('group', { name: /^CT image\./ })
  fireEvent.keyDown(image, { key: 'ArrowRight' })
  fireEvent.keyDown(image, { key: 'ArrowRight' })
  fireEvent.keyDown(image, { key: 'Enter' })
  ready()
  const before = draft('follow-one-airway').marks[0]
  const scale = (): number =>
    Number(
      /scale\((\d+(?:\.\d+)?)\)/.exec(
        document.querySelector('[data-preset] g')!.getAttribute('transform')!,
      )![1],
    )
  const unmagnified = scale()
  fireEvent.change(screen.getByRole('slider', { name: 'CT magnification' }), {
    target: { value: '2.5' },
  })
  ready()
  expect(scale()).toBeCloseTo(unmagnified * 2.5, 6)
  // Enlargement is display only: the stored native pixel is untouched.
  expect(draft('follow-one-airway').marks[0]).toEqual(before)
  // And a mark placed while magnified still round-trips to a native coordinate.
  fireEvent.keyDown(image, { key: 'Enter' })
  ready()
  const magnified = draft('follow-one-airway').marks[0]
  expect(magnified.slice).toBe(before.slice)
  expect(magnified.pixel[0]).toBeGreaterThanOrEqual(0)
  expect(magnified.pixel[0]).toBeLessThanOrEqual(511)
})

it('Focus CT view restores the authored crop and claims no region of interest', async () => {
  render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await begin('follow-one-airway')
  const transform = () => document.querySelector('[data-preset] g')!.getAttribute('transform')
  click('Go to response slice')
  const authored = transform()
  click('Full CT field')
  expect(transform()).not.toBe(authored)
  click('Focus CT view')
  expect(transform()).toBe(authored)
  expect(screen.queryByRole('button', { name: 'Highlight the region' })).toBeNull()
  // The affordance frames the restored view; it draws no contour on the image.
  expect(document.querySelector('[data-region-highlight]')).not.toBeNull()
  expect(document.querySelectorAll('[data-preset] polygon')).toHaveLength(0)
  expect(draft('follow-one-airway').marks).toEqual([null])
})

it('places the demonstration transport with the CT and keeps the full captions reachable', async () => {
  render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await screen.findByRole('button', { name: 'Focus on this airway' })
  click('Focus on this airway')
  const viewer = screen.getByRole('region', { name: 'CT tracing viewer' })
  const transport = screen.getByRole('region', { name: 'CT demonstration controls' })
  expect(viewer).toContainElement(transport)
  for (const name of [
    'Play walkthrough',
    'Previous demonstration slice',
    'Next demonstration slice',
    'Replay from parent',
  ])
    expect(screen.getByRole('button', { name })).toBeInTheDocument()
  // Nothing plays until it is asked to.
  const exercise = localExercise(LESSONS[0].exercises![0])
  expect(surface()).toHaveAttribute('data-slice', String(exercise.frames[0].slice))
  // Every authored demonstration frame is an adjacent native plane.
  const slices = exercise.frames.map((frame) => frame.slice)
  for (let i = 1; i < slices.length; i++)
    expect(Math.abs(slices[i] - slices[i - 1])).toBeLessThanOrEqual(1)
  expect(screen.getByText('Caption transcript')).toBeInTheDocument()
  click('Next demonstration slice')
  expect(surface()).toHaveAttribute('data-slice', String(exercise.frames[1].slice))
})

it('keeps the demonstration identity and caption on the decoded plane during delayed and superseded loads', async () => {
  render(<BranchTracingLesson requestedId="follow-one-airway" />)
  await screen.findByRole('button', { name: 'Focus on this airway' })
  click('Focus on this airway')
  const exercise = localExercise(LESSONS[0].exercises![0])
  const transport = screen.getByRole('region', { name: 'CT demonstration controls' })
  fireEvent.click(screen.getByRole('button', { name: 'Next demonstration slice' }))
  expect(surface()).toHaveAttribute('data-requested-slice', '415')
  expect(surface()).toHaveAttribute('data-slice', '416')
  expect(transport).toHaveTextContent('Demonstration slice 416 · 1 of 5')
  expect(transport).toHaveTextContent(exercise.frames[0].caption)
  const superseded = document.querySelector('[data-ct-pending="415"]')!
  fireEvent.click(screen.getByRole('button', { name: 'Next demonstration slice' }))
  expect(surface()).toHaveAttribute('data-requested-slice', '414')
  fireEvent.load(superseded)
  expect(surface()).toHaveAttribute('data-slice', '416')
  expect(transport).toHaveTextContent('Demonstration slice 416 · 1 of 5')
  ready()
  expect(surface()).toHaveAttribute('data-slice', '414')
  expect(transport).toHaveTextContent('Demonstration slice 414 · 3 of 5')
  expect(transport).toHaveTextContent(exercise.frames[2].caption)
})
