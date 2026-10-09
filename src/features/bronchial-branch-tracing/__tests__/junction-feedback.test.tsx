import { fireEvent, render, screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { JunctionFeedback } from '../components/JunctionFeedback'
import { LESSONS } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { junctionFeedbackPacket } from '../content/junction-feedback'
import type { CtMark } from '../content/ct-types'

const exerciseFor = (checkpointId: string) => {
  const divisionExercise = (spec: { checkpointId: string; kind: string }) =>
    spec.checkpointId === checkpointId && !['same-lumen', 'viewpoint'].includes(spec.kind)
  const lesson = LESSONS.find((l) => l.exercises?.some(divisionExercise))!
  return localExercise(lesson.exercises!.find(divisionExercise)!)
}
/** Scoring and answer-leak wording. The result band says which lumen a mark is in; it does not score. */
const FORBIDDEN =
  /\b(score|scored|grade|graded|pass|passed|fail|failed|penalt\w*|incorrect|wrong|correct)\b|you (mistook|confused)/i
/** Project records (review status, authoring notes, source identifiers) are not shown to learners. */
const PROJECT_RECORD =
  /faculty review|authoring session|has not been authored|pending|provisional|junction-\d+|\bedge \d+|BBT-\d+|\bOD-\d+/i

it('says which lumen a mark is in and which way to move, tells an unresolved response what to scroll to, navigates to revisit slices and leaves the marks alone', async () => {
  const exercise = exerciseFor('junction-1')
  const packet = junctionFeedbackPacket('junction-1')!
  const [rmsb, lmsb] = exercise.trace.checkpoints[0].decision!.options
  // The lesson marks both main bronchi on slice 372, below the carina.
  expect(exercise.answerPoints.map((p) => p.slice)).toEqual([372, 372])
  const marks: (CtMark | null)[] = [
    { slice: 372, pixel: [lmsb.pixel[0], lmsb.pixel[1]] },
    { slice: 372, pixel: null },
  ]
  const before = JSON.stringify(marks)
  const goTo = jest.fn()
  const { container } = render(
    <JunctionFeedback exercise={exercise} marks={marks} packet={packet} onGoToSlice={goTo} />,
  )
  const items = container.querySelectorAll('[data-junction-feedback] li[data-mark-status]')
  expect([...items].map((li) => li.getAttribute('data-mark-status'))).toEqual([
    'nearest-other',
    'unresolved',
  ])
  // The verdict is given: the mark is in the other main bronchus, with the move that reaches RMSB.
  expect(items[0]).toHaveAttribute('data-mark-verdict', 'other-airway')
  const band = within(items[0] as HTMLElement).getByRole('status')
  expect(band).toHaveAttribute('data-verdict-tone', 'miss')
  expect(band).toHaveTextContent(
    'In LMSB, not RMSB. Your mark is inside the lumen of LMSB on slice 372. Move about 31 mm toward the patient’s right to reach RMSB.',
  )
  expect(items[0]).toHaveTextContent(
    /A · RMSB · slice 372\. In LMSB, not RMSB\..*Your mark is 0\.0 mm from the LMSB centre and 30\.5 mm from the RMSB centre\./,
  )
  // An unresolved response gets no verdict band. It is told what to do next, not that it will do.
  expect(items[1]).not.toHaveAttribute('data-mark-verdict')
  expect(within(items[1] as HTMLElement).queryByRole('status')).toBeNull()
  expect(items[1].querySelector('[data-verdict-tone]')).toBeNull()
  expect(items[1]).toHaveTextContent(
    'You recorded B · LMSB as unresolved on slice 372. See "Could not separate them? Do this" below, then mark it.',
  )
  expect(container.textContent).not.toMatch(
    /valid response|reasonable (record|response)|counted against you/i,
  )
  expect(screen.getByRole('heading', { name: 'Could not separate them? Do this' })).toBeVisible()
  expect(packet.moreEvidence).toMatch(/Scroll down one slice at a time from 376/)
  expect(screen.getByText(packet.moreEvidence)).toBeVisible()
  expect(screen.getByText(/Then use Redo branch marks below and mark the lumen/)).toBeVisible()
  // The slot's own paragraph is shown for the slot that missed, and only for that slot.
  expect(container.querySelector('[data-when-nearer="0"]')).toHaveTextContent(
    packet.whenNearer[0]!.text,
  )
  expect(container.querySelector('[data-when-nearer="1"]')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Where your marks are' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Where the paths diverge' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Which wall or lumen decides it' })).toBeVisible()
  expect(screen.getByText(packet.divergence)).toBeVisible()
  expect(screen.getByText(packet.continuity)).toBeVisible()
  expect(
    screen.getByText(
      /Anywhere inside the lumen counts; you do not need to hit the gold crosshair\. Your marks stay where you placed them\./,
    ),
  ).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Go to slice 392' }))
  fireEvent.click(screen.getByRole('button', { name: 'Go to slice 372' }))
  fireEvent.click(
    screen.getByRole('button', { name: `Go to the parent slice ${exercise.trace.anchor.slice}` }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Go to answer slice 372' }))
  expect(goTo.mock.calls).toEqual([[392], [372], [exercise.trace.anchor.slice], [372]])
  expect(JSON.stringify(marks)).toBe(before)
  expect(rmsb.pixel).toEqual(exercise.answerPoints[0].pixel)
  expect(container.textContent!.match(FORBIDDEN)?.[0] ?? null).toBeNull()
  expect(container.textContent!.match(PROJECT_RECORD)?.[0] ?? null).toBeNull()
  expect(await axe(container)).toHaveNoViolations()
})
it('a mark in the intended lumen is told so, on each main bronchus of the first lesson plane', () => {
  const exercise = exerciseFor('junction-1')
  const { container } = render(
    <JunctionFeedback
      exercise={exercise}
      marks={exercise.answerPoints.map((p) => ({
        slice: p.slice,
        pixel: [p.pixel[0], p.pixel[1]],
      }))}
      packet={junctionFeedbackPacket('junction-1')}
      onGoToSlice={() => {}}
    />,
  )
  const items = [...container.querySelectorAll('li[data-mark-status]')]
  expect(items.map((li) => li.getAttribute('data-mark-verdict'))).toEqual([
    'intended-lumen',
    'intended-lumen',
  ])
  const bands = items.map((li) => within(li as HTMLElement).getByRole('status'))
  expect(bands.map((b) => b.getAttribute('data-verdict-tone'))).toEqual(['in', 'in'])
  expect(bands[0]).toHaveTextContent('In RMSB. Your mark is inside the lumen of RMSB on slice 372.')
  expect(bands[1]).toHaveTextContent('In LMSB. Your mark is inside the lumen of LMSB on slice 372.')
  // Nothing was left unresolved, so the scroll-and-mark guidance is not shown.
  expect(screen.queryByRole('heading', { name: 'Could not separate them? Do this' })).toBeNull()
  expect(container.querySelector('[data-when-nearer]')).toBeNull()
})
it('shows the names without a choice, explains any choice without penalty, records nothing and can be repeated', () => {
  const exercise = exerciseFor('junction-6')
  const naming = junctionFeedbackPacket('junction-6')!.naming
  const { container } = render(
    <JunctionFeedback
      exercise={exercise}
      marks={[null, null]}
      packet={junctionFeedbackPacket('junction-6')}
      onGoToSlice={() => {}}
    />,
  )
  const aid = container.querySelector('[data-naming-aid]') as HTMLElement
  expect(within(aid).getByText('Name the daughters')).toBeInTheDocument()
  for (const paragraph of naming.demonstration)
    expect(within(aid).getByText(paragraph)).toBeInTheDocument()
  expect(naming.demonstration[0]).toMatch(
    /LB6 is the superior segmental bronchus of the left lower lobe/,
  )
  expect(within(aid).queryByRole('status')).toBeNull()
  fireEvent.click(within(aid).getByRole('button', { name: 'Show the names' }))
  expect(within(aid).getByRole('status')).toHaveTextContent(
    `${naming.try!.explanation.LB6} Nothing is recorded; choose again if you like.`,
  )
  fireEvent.click(within(aid).getByRole('button', { name: 'Basal trunk · continues caudally' }))
  expect(within(aid).getByRole('status')).toHaveTextContent(naming.try!.explanation['L basal'])
  expect(naming.try!.explanation['L basal']).toMatch(
    /The posterior daughter that runs upward is LB6/,
  )
  fireEvent.click(
    within(aid).getByRole('button', { name: 'LB6 · left superior segmental bronchus' }),
  )
  expect(within(aid).getByRole('status')).toHaveTextContent(naming.try!.explanation.LB6)
  expect(
    within(aid).getByRole('button', { name: 'LB6 · left superior segmental bronchus' }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(aid.textContent!.match(FORBIDDEN)?.[0] ?? null).toBeNull()
  expect(window.localStorage.length).toBe(0)
})
it('asks the RB1a/RB1b and RB5a/RB5b naming questions in the textbook orientation, with no status text', () => {
  const rb1 = exerciseFor('junction-14')
  const view = render(
    <JunctionFeedback
      exercise={rb1}
      marks={rb1.answerPoints.map((p) => ({ slice: p.slice, pixel: [p.pixel[0], p.pixel[1]] }))}
      packet={junctionFeedbackPacket('junction-14')}
      onGoToSlice={() => {}}
    />,
  )
  const aid = view.container.querySelector('[data-naming-aid]') as HTMLElement
  expect(aid).toHaveTextContent(
    /RB1a, which goes posteriorly \(dorsal\), and RB1b, which goes anteriorly \(ventral\)/,
  )
  expect(aid).toHaveTextContent('Try it: Which daughter is the posterior (dorsal) one?')
  expect(within(aid).queryByText(/pending|faculty review|provisional/i)).toBeNull()
  fireEvent.click(within(aid).getByRole('button', { name: 'Show the names' }))
  expect(within(aid).getByRole('status')).toHaveTextContent(
    /RB1a is the dorsal branch of the apical bronchus: the posterior lumen here/,
  )
  fireEvent.click(within(aid).getByRole('button', { name: 'RB1b' }))
  expect(within(aid).getByRole('status')).toHaveTextContent(
    /RB1b is the ventral branch: the anterior lumen here.*The posterior one is RB1a\./,
  )
  const items = [...view.container.querySelectorAll('li[data-mark-status]')]
  expect(items.map((li) => li.getAttribute('data-mark-status'))).toEqual([
    'nearest-intended',
    'nearest-intended',
  ])
  expect(items.map((li) => li.getAttribute('data-mark-verdict'))).toEqual([
    'intended-lumen',
    'intended-lumen',
  ])
  expect(items[0]).toHaveTextContent(
    /In RB1b\. Your mark is inside the lumen of RB1b on slice 422\. Your mark is 0\.0 mm from the RB1b centre; the next nearest named airway on slice 422, RB1a, is \d+\.\d mm away\./,
  )
  expect(view.container.textContent!.match(PROJECT_RECORD)?.[0] ?? null).toBeNull()
  view.unmount()

  const rb5 = exerciseFor('junction-20')
  const second = render(
    <JunctionFeedback
      exercise={rb5}
      marks={[null, null]}
      packet={junctionFeedbackPacket('junction-20')}
      onGoToSlice={() => {}}
    />,
  )
  const rb5Aid = second.container.querySelector('[data-naming-aid]') as HTMLElement
  expect(rb5Aid).toHaveTextContent(
    /RB5a, which runs forward near-horizontally, and RB5b, which runs forward and down/,
  )
  fireEvent.click(within(rb5Aid).getByRole('button', { name: 'RB5a' }))
  expect(within(rb5Aid).getByRole('status')).toHaveTextContent(
    /RB5a is the horizontal branch.*The one that descends is RB5b\./,
  )
  fireEvent.click(within(rb5Aid).getByRole('button', { name: 'RB5b' }))
  expect(within(rb5Aid).getByRole('status')).toHaveTextContent(/RB5b is the caudal branch/)
  expect(second.container.textContent!.match(PROJECT_RECORD)?.[0] ?? null).toBeNull()
})
it('explains a division whose daughters share one name by direction, with no question and no scope notice', () => {
  const other = exerciseFor('junction-16')
  const packet = junctionFeedbackPacket('junction-16')!
  const { container } = render(
    <JunctionFeedback
      exercise={other}
      marks={[null, null]}
      packet={packet}
      onGoToSlice={() => {}}
    />,
  )
  // Every division now has a written explanation: there is no "not authored yet" notice and no
  // list of covered divisions.
  expect(container.querySelector('[data-feedback-scope]')).toBeNull()
  expect(container.textContent!.match(PROJECT_RECORD)?.[0] ?? null).toBeNull()
  expect(screen.getByText(packet.divergence)).toBeVisible()
  expect(screen.getByText(packet.continuity)).toBeVisible()
  const aid = container.querySelector('[data-naming-aid]') as HTMLElement
  expect(aid).toHaveTextContent(/Daughter A, more cranial, and Daughter B, more caudal/)
  expect(within(aid).queryByRole('button')).toBeNull()
  expect(container.querySelectorAll('li[data-mark-status]')).toHaveLength(2)
  expect(container.querySelector('[data-verdict-tone]')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Could not separate them? Do this' })).toBeVisible()
  expect(screen.getByText(packet.moreEvidence)).toBeVisible()
})
it('without a packet still tells an unresolved response where to go back to and what to look for', () => {
  const other = exerciseFor('junction-16')
  const { container } = render(
    <JunctionFeedback
      exercise={other}
      marks={[null, null]}
      packet={undefined}
      onGoToSlice={() => {}}
    />,
  )
  expect(screen.getByRole('heading', { name: 'Could not separate them? Do this' })).toBeVisible()
  expect(
    screen.getByText(
      /Go back to RB3a on slice \d+ and step toward the answer slice one slice at a time\..*when a wall appears inside it, you have two lumens\. Then mark each one\./,
    ),
  ).toBeVisible()
  expect(container.querySelector('[data-naming-aid]')).toBeNull()
  expect(container.textContent!.match(PROJECT_RECORD)?.[0] ?? null).toBeNull()
})
it('renders nothing for a same-lumen interval', () => {
  const warmup = localExercise(LESSONS[0].exercises![0])
  const { container } = render(
    <JunctionFeedback exercise={warmup} marks={[null]} packet={undefined} onGoToSlice={() => {}} />,
  )
  expect(container.querySelector('[data-junction-feedback]')).toBeNull()
})
