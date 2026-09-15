import { fireEvent, render, screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { JunctionFeedback } from '../components/JunctionFeedback'
import { LESSONS } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { JUNCTION_FEEDBACK_SCOPE, junctionFeedbackPacket } from '../content/junction-feedback'
import type { CtMark } from '../content/ct-types'

const exerciseFor = (checkpointId: string) => {
  const divisionExercise = (spec: { checkpointId: string; kind: string }) =>
    spec.checkpointId === checkpointId && !['same-lumen', 'viewpoint'].includes(spec.kind)
  const lesson = LESSONS.find((l) => l.exercises?.some(divisionExercise))!
  return localExercise(lesson.exercises!.find(divisionExercise)!)
}
const FORBIDDEN =
  /\b(score|scored|grade|graded|pass|passed|fail|failed|penalt\w*|incorrect|wrong|correct)\b|you (mistook|confused)/i

it('explains a mark nearer the other daughter by geometry and divergence, guides an unresolved response, navigates to revisit slices and leaves the marks alone', async () => {
  const exercise = exerciseFor('junction-1')
  const [rmsb, lmsb] = exercise.trace.checkpoints[0].decision!.options
  const marks: (CtMark | null)[] = [
    { slice: 387, pixel: [lmsb.pixel[0], lmsb.pixel[1]] },
    { slice: 387, pixel: null },
  ]
  const before = JSON.stringify(marks)
  const goTo = jest.fn()
  const { container } = render(
    <JunctionFeedback
      exercise={exercise}
      marks={marks}
      packet={junctionFeedbackPacket('junction-1')}
      onGoToSlice={goTo}
    />,
  )
  const items = container.querySelectorAll('[data-junction-feedback] li[data-mark-status]')
  expect([...items].map((li) => li.getAttribute('data-mark-status'))).toEqual([
    'nearest-other',
    'unresolved',
  ])
  expect(items[0]).toHaveTextContent(
    /A · RMSB · slice 387\. Your mark is 0\.0 mm from the LMSB model locator and 8\.6 mm from the RMSB locator: it sits nearer LMSB\./,
  )
  expect(items[1]).toHaveTextContent(
    /You recorded B · LMSB as unresolved on slice 387\. That is a valid response/,
  )
  expect(container.querySelector('[data-when-nearer="RMSB"]')).toHaveTextContent(
    /The two paths separate at the carina, not on this slice/,
  )
  expect(container.querySelector('[data-when-nearer="LMSB"]')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Where the paths diverge' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Which wall or lumen decides it' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Uncertain? Start here' })).toBeVisible()
  expect(
    screen.getByText(/neither counted against you nor turned into an identification/),
  ).toBeVisible()
  expect(
    screen.getByText(
      /Your marks stay exactly where you placed them; the gold rings are model references/,
    ),
  ).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Go to slice 392' }))
  fireEvent.click(screen.getByRole('button', { name: 'Go to slice 384' }))
  expect(goTo.mock.calls).toEqual([[392], [384]])
  expect(JSON.stringify(marks)).toBe(before)
  expect(rmsb.pixel).toEqual(exercise.answerPoints[0].pixel)
  expect(container.textContent!.match(FORBIDDEN)?.[0] ?? null).toBeNull()
  expect(await axe(container)).toHaveNoViolations()
})
it('shows the names without a choice, explains any choice without penalty, records nothing and can be repeated', () => {
  const exercise = exerciseFor('junction-6')
  const { container } = render(
    <JunctionFeedback
      exercise={exercise}
      marks={[null, null]}
      packet={junctionFeedbackPacket('junction-6')}
      onGoToSlice={() => {}}
    />,
  )
  const aid = container.querySelector('[data-naming-aid]') as HTMLElement
  expect(within(aid).getByText('Name the daughters (optional)')).toBeInTheDocument()
  expect(
    within(aid).getByText(/LB6 is the superior segmental bronchus of the left lower lobe/),
  ).toBeInTheDocument()
  expect(within(aid).queryByRole('status')).toBeNull()
  fireEvent.click(within(aid).getByRole('button', { name: 'Show the names' }))
  expect(within(aid).getByRole('status')).toHaveTextContent(
    /LB6, the superior segmental bronchus, is the posterior, cranially directed daughter.*Nothing is recorded/,
  )
  fireEvent.click(within(aid).getByRole('button', { name: 'Basal trunk · continues caudally' }))
  expect(within(aid).getByRole('status')).toHaveTextContent(
    /The basal trunk is the caudal continuation of the lower-lobe bronchus\. The posterior daughter that runs cranially is LB6/,
  )
  fireEvent.click(
    within(aid).getByRole('button', { name: 'LB6 · left superior segmental bronchus' }),
  )
  expect(within(aid).getByRole('status')).toHaveTextContent(
    /LB6, the superior segmental bronchus, is the posterior/,
  )
  expect(
    within(aid).getByRole('button', { name: 'LB6 · left superior segmental bronchus' }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(aid.textContent!.match(FORBIDDEN)?.[0] ?? null).toBeNull()
  expect(window.localStorage.length).toBe(0)
})
it('shows subsegmental names directly with their uncertainty and no try, and states the five-junction scope elsewhere', () => {
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
  expect(within(aid).queryByRole('button', { name: 'Show the names' })).toBeNull()
  expect(
    within(aid).getByText('Subsegmental a/b assignment pending faculty review.'),
  ).toBeInTheDocument()
  expect(
    [...view.container.querySelectorAll('li[data-mark-status]')].map((li) =>
      li.getAttribute('data-mark-status'),
    ),
  ).toEqual(['nearest-intended', 'nearest-intended'])
  expect(view.container.querySelectorAll('li[data-mark-status]')[0]).toHaveTextContent(
    /Your mark is 0\.0 mm from the RB1b model locator; the nearest other model airway on this slice, RB1a, is \d+\.\d mm away\./,
  )
  view.unmount()
  const other = exerciseFor('junction-16')
  const { container } = render(
    <JunctionFeedback
      exercise={other}
      marks={[null, null]}
      packet={junctionFeedbackPacket('junction-16')}
      onGoToSlice={() => {}}
    />,
  )
  expect(container.querySelector('[data-feedback-scope]')).toHaveTextContent(
    `BBT-02 covers five pilot junctions (${JUNCTION_FEEDBACK_SCOPE.join(', ')})`,
  )
  expect(container.querySelector('[data-naming-aid]')).toBeNull()
  expect(container.querySelectorAll('li[data-mark-status]')).toHaveLength(2)
  // Unresolved responses get the starting guidance outside the pilot too.
  expect(screen.getByRole('heading', { name: 'Uncertain? Start here' })).toBeVisible()
  expect(
    screen.getByText(/Return to RB3a on slice \d+ and step toward the answer slice/),
  ).toBeVisible()
})
it('renders nothing for a same-lumen interval', () => {
  const warmup = localExercise(LESSONS[0].exercises![0])
  const { container } = render(
    <JunctionFeedback exercise={warmup} marks={[null]} packet={undefined} onGoToSlice={() => {}} />,
  )
  expect(container.querySelector('[data-junction-feedback]')).toBeNull()
})
