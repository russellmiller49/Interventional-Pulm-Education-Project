import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BranchTracingLesson } from '../components/BranchTracingLesson'
import { LESSONS } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { demonstrationFrameIndex } from '../engine/model-course'

/**
 * BBT-PRE-REVIEW-03 sanity repair, finding 1. A demonstration walks the same CT plane once per
 * daughter pass, so the plane on screen does not identify the teaching step. Resolving the
 * caption, the transport position or the course-locator note by slice number alone returned the
 * first pass and gave a later pass the earlier daughter's identity — on Lesson 4 the second
 * demonstration pass through slice 419 drew Daughter B · RB1a and captioned it Daughter A · RB1b.
 * Every assertion below fails on the reviewed head a96047ef.
 */
jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('next/dynamic', () => () => () => null)
beforeEach(() => window.localStorage.clear())

const ready = () => document.querySelectorAll('image').forEach((image) => fireEvent.load(image))
const click = (name: string | RegExp) => {
  ready()
  fireEvent.click(screen.getByRole('button', { name }))
  ready()
}
const transport = () => screen.getByRole('region', { name: 'CT demonstration controls' })
const locatorLabels = () =>
  Array.from(document.querySelectorAll('[data-course-locator]')).map((node) =>
    node.getAttribute('aria-label'),
  )
async function stepTo(index: number, from = 0) {
  for (let i = from; i < index; i++) click('Next demonstration slice')
  await waitFor(() => ready())
}
async function openDemonstration(id: string) {
  render(<BranchTracingLesson requestedId={id} />)
  await screen.findByRole('region', { name: 'CT demonstration controls' })
  ready()
  if (screen.queryByRole('button', { name: 'Focus on this airway' })) click('Focus on this airway')
  await waitFor(() => ready())
}

const vertical = localExercise(LESSONS.find((l) => l.id === 'vertical')!.exercises![0])
// Authored demonstration steps, read from the content rather than restated by hand.
const passes419 = vertical.frames.flatMap((frame, index) => (frame.slice === 419 ? [index] : []))

it('the authored Lesson 4 demonstration really does walk slice 419 in more than one pass', () => {
  expect(vertical.id).toBe('right-upper-apical.junction-14.pattern')
  expect(vertical.answerPoints.map((point) => `${point.label}@${point.slice}`)).toEqual([
    'A · RB1b@422',
    'B · RB1a@424',
  ])
  expect(passes419).toEqual([18, 25, 62])
})

it('resolves a demonstration step by its index, never by the first frame that shares its slice', () => {
  const frames = [{ slice: 401 }, { slice: 419 }, { slice: 401 }, { slice: 419 }]
  // The current step wins whenever it is the plane on screen.
  expect(demonstrationFrameIndex(frames, 3, 419)).toBe(3)
  expect(demonstrationFrameIndex(frames, 1, 419)).toBe(1)
  // Browsing off the demonstration resolves to the occurrence nearest the current step, so
  // stepping away and back cannot drop the learner into an earlier pass.
  expect(demonstrationFrameIndex(frames, 3, 401)).toBe(2)
  expect(demonstrationFrameIndex(frames, 0, 419)).toBe(1)
  expect(demonstrationFrameIndex(frames, 2, 512)).toBe(-1)
  expect(demonstrationFrameIndex(frames, 2, null)).toBe(-1)
  // The real Lesson 4 frames: each pass through 419 answers with its own step.
  for (const index of passes419)
    expect(demonstrationFrameIndex(vertical.frames, index, 419)).toBe(index)
})

it('Lesson 4 · each demonstration pass through slice 419 keeps its own daughter identity', async () => {
  await openDemonstration('vertical')
  expect(transport()).toHaveTextContent(
    `Demonstration slice ${vertical.trace.anchor.slice} · 1 of ${vertical.frames.length}`,
  )

  // First use of the plane: the parent's pass toward Daughter A's response plane.
  await stepTo(18)
  expect(transport()).toHaveTextContent(`Demonstration slice 419 · 19 of ${vertical.frames.length}`)
  expect(transport()).toHaveTextContent(
    'Dotted gold crosshair: where the model centreline of Daughter A · RB1b crosses this plane.',
  )
  expect(locatorLabels()).toEqual([
    'Model course locator: Daughter A · RB1b, centreline crossing on slice 419; provisional model position, not a lumen boundary',
  ])

  // Second use, still inside Daughter A's pass: the return trip toward the parent.
  await stepTo(25, 18)
  expect(transport()).toHaveTextContent(`Demonstration slice 419 · 26 of ${vertical.frames.length}`)
  expect(transport()).toHaveTextContent('Daughter A · RB1b crosses this plane.')

  // Daughter B's pass across the same plane. Nothing of Daughter A's pass may survive here.
  await stepTo(62, 25)
  expect(transport()).toHaveTextContent(`Demonstration slice 419 · 63 of ${vertical.frames.length}`)
  expect(transport()).toHaveTextContent(
    'Dotted gold crosshair: where the model centreline of Daughter B · RB1a crosses this plane.',
  )
  expect(transport()).not.toHaveTextContent('Daughter A · RB1b crosses this plane.')
  expect(locatorLabels()).toEqual([
    'Model course locator: Daughter B · RB1a, centreline crossing on slice 419; provisional model position, not a lumen boundary',
  ])

  // Stepping off the plane and back stays in Daughter B's pass.
  click('Previous demonstration slice')
  await waitFor(() => ready())
  expect(transport()).toHaveTextContent(`Demonstration slice 418 · 62 of ${vertical.frames.length}`)
  click('Next demonstration slice')
  await waitFor(() => ready())
  expect(transport()).toHaveTextContent(`Demonstration slice 419 · 63 of ${vertical.frames.length}`)
  expect(transport()).toHaveTextContent('Daughter B · RB1a crosses this plane.')

  // Frame 2 is a display transform. Turning the CT moves pixels, never branch identity.
  click('Show tracing view')
  await waitFor(() => ready())
  expect(document.querySelector('[data-preset]')).not.toHaveAttribute('data-preset', 'standard')
  expect(transport()).toHaveTextContent(`Demonstration slice 419 · 63 of ${vertical.frames.length}`)
  expect(transport()).toHaveTextContent('Daughter B · RB1a crosses this plane.')
  expect(locatorLabels()).toEqual([
    'Model course locator: Daughter B · RB1a, centreline crossing on slice 419; provisional model position, not a lumen boundary',
  ])
  click('Return to standard axial')
  await waitFor(() => ready())
  expect(transport()).toHaveTextContent('Daughter B · RB1a crosses this plane.')
})

it('Lesson 8 · the approach lead-in and Daughter B’s pass keep the planes they share apart', async () => {
  const short = localExercise(LESSONS.find((l) => l.id === 'orientation-changes')!.exercises![0])
  expect(short.frames.flatMap((f, i) => (f.slice === 332 ? [i] : []))).toEqual([0, 26])
  expect(short.frames.flatMap((f, i) => (f.slice === 327 ? [i] : []))).toEqual([5, 21])
  await openDemonstration('orientation-changes')

  // This lesson opens on its parent plane, part way along the declared lead-in.
  expect(transport()).toHaveTextContent(`Demonstration slice 325 · 8 of ${short.frames.length}`)
  click('Replay from parent')
  await waitFor(() => ready())

  // The declared, unscored LLL lead-in before the recorded map begins at LB6.
  expect(transport()).toHaveTextContent(`Demonstration slice 332 · 1 of ${short.frames.length}`)
  expect(transport()).toHaveTextContent('Approach context, slice 332')
  await stepTo(5)
  expect(transport()).toHaveTextContent(
    'the model centreline of Approach · LLL and Parent · LB6 crosses this plane.',
  )
  expect(locatorLabels()).toHaveLength(2)

  // Daughter B’s pass crosses both planes again, past the lead-in and past the fork.
  await stepTo(21, 5)
  expect(transport()).toHaveTextContent(`Demonstration slice 327 · 22 of ${short.frames.length}`)
  expect(transport()).toHaveTextContent('the model centreline of Parent · LB6 crosses this plane.')
  expect(transport()).not.toHaveTextContent('Approach · LLL')
  expect(locatorLabels()).toHaveLength(1)
  await stepTo(26, 21)
  expect(transport()).toHaveTextContent(`Demonstration slice 332 · 27 of ${short.frames.length}`)
  expect(transport()).not.toHaveTextContent('Approach context, slice 332')
  expect(transport()).toHaveTextContent(short.frames[26].caption)
  expect(locatorLabels()).toHaveLength(0)
})
