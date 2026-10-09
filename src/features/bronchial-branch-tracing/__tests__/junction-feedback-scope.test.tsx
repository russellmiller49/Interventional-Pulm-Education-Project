import { render } from '@testing-library/react'
import { JunctionFeedback, spanSentence, siblingSentence } from '../components/JunctionFeedback'
import { LESSONS } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { junctionFeedbackPacket } from '../content/junction-feedback'
import { compareMarks, slotLocators } from '../engine/junction-feedback'
import type { CtMark } from '../content/ct-types'

/**
 * BBTF-39 and BBTF-05. Sibling-specific feedback is written about the other daughter of the
 * division; the position sentence reports whichever named locator is actually nearest. Those two
 * scopes can differ, and when they do the sibling sentence must not be shown as if it applied.
 */

const exerciseFor = (checkpointId: string) => {
  const pick = (spec: { checkpointId: string; kind: string }) =>
    spec.checkpointId === checkpointId && !['same-lumen', 'viewpoint'].includes(spec.kind)
  const lesson = LESSONS.find((l) => l.exercises?.some(pick))!
  return localExercise(lesson.exercises!.find(pick)!)
}
/** Scoring and answer-leak wording. Saying which lumen a mark is in is the teaching, not a score. */
const SCORING =
  /\b(score|scored|grade|graded|accuracy|pass|passed|fail|failed|incorrect|wrong|correct)\b|correct branch|mistaken vessel|right airway|true airway/i

const j10 = exerciseFor('junction-10')
const rb5Slot = 1

/** A mark placed in the RB5 slot but closest to the RB5a locator, which is not its sibling. */
function markNearUnrelated(): CtMark {
  const locators = slotLocators(j10, rb5Slot)
  const rb5a = locators.find((l) => l.airway.code === 'RB5a')!
  const intended = locators.find((l) => l.role === 'intended')!
  return {
    slice: j10.answerPoints[rb5Slot].slice,
    pixel: [
      rb5a.pixel[0] * 0.8 + intended.pixel[0] * 0.2,
      rb5a.pixel[1] * 0.8 + intended.pixel[1] * 0.2,
    ],
  }
}

test('the nearest locator and the nearest sibling are reported as different scopes', () => {
  const [, unrelated] = compareMarks(j10, [null, markNearUnrelated()])
  expect(unrelated.status).toBe('nearest-other')
  expect(unrelated.nearestOther!.locator.airway.code).toBe('RB5a')
  expect(unrelated.nearestSibling!.locator.airway.code).toBe('RB4')
  expect(unrelated.nearestOther!.locator.airway.code).not.toBe(
    unrelated.nearestSibling!.locator.airway.code,
  )
  const sibling = siblingSentence(unrelated)!
  expect(sibling).toMatch(/The other daughter of this division, RB4, is \d+\.\d mm away/)

  // When the sibling is the nearest locator, it is not repeated as a separate scope.
  const onSibling = compareMarks(j10, [
    null,
    { slice: 307, pixel: [...j10.answerPoints[0].pixel] as [number, number] },
  ])[1]
  expect(onSibling.nearestOther!.locator.airway.code).toBe('RB4')
  expect(siblingSentence(onSibling)).toBeNull()
})

test('a sibling-specific paragraph is withheld when a different airway is the nearest locator', () => {
  const packet = junctionFeedbackPacket('junction-10')!
  // The packet text for the RB5 slot is about a mark in the other daughter, RB4.
  expect(packet.whenNearer[rb5Slot]).toMatchObject({ appliesTo: ['daughter'] })
  expect(packet.whenNearer[rb5Slot]!.text).toMatch(/Your RB5 mark is in the RB4 channel/)
  const [, comparison] = compareMarks(j10, [null, markNearUnrelated()])
  // Whatever the mark is in or nearer here, it is not the other daughter.
  expect(comparison.verdict?.nearest?.role).not.toBe('daughter')
  expect(comparison.nearestOther!.locator.role).toBe('other')
  const { container } = render(
    <JunctionFeedback
      exercise={j10}
      marks={[null, markNearUnrelated()]}
      packet={packet}
      onGoToSlice={() => {}}
    />,
  )
  // RB4 is not where this mark went, so the RB4 paragraph is not shown.
  expect(container.querySelector(`[data-when-nearer="${rb5Slot}"]`)).toBeNull()
  expect(container.textContent).not.toContain(packet.whenNearer[rb5Slot]!.text)
  expect(container.textContent).not.toMatch(/Your RB5 mark is in the RB4 channel/)
  expect(container.textContent!.match(SCORING)?.[0] ?? null).toBeNull()
})

test('the sibling paragraph is still shown when the mark is in the sibling', () => {
  const packet = junctionFeedbackPacket('junction-10')!
  const { container } = render(
    <JunctionFeedback
      exercise={j10}
      marks={[null, { slice: 307, pixel: [...j10.answerPoints[0].pixel] as [number, number] }]}
      packet={packet}
      onGoToSlice={() => {}}
    />,
  )
  expect(container.querySelector(`[data-when-nearer="${rb5Slot}"]`)).toHaveTextContent(
    packet.whenNearer[rb5Slot]!.text,
  )
  // The band and the paragraph name the same airway.
  const item = container.querySelector('li[data-mark-verdict]')!
  expect(item).toHaveAttribute('data-mark-verdict', 'near-fork')
  expect(item).toHaveTextContent(/At the fork, on the side of RB4\./)
  expect(container.querySelector('[data-when-nearer="0"]')).toBeNull()
})

test('the span sentence states the scalar it is actually comparing', () => {
  const j1 = exerciseFor('junction-1')
  const [rmsb, lmsb] = j1.trace.checkpoints[0].decision!.options
  // The lesson marks the main bronchi on slice 372, where their centres are 30.5 mm apart.
  expect([rmsb.slice, lmsb.slice]).toEqual([372, 372])
  // Beyond LMSB, on the far side from RMSB: farther from RMSB than the two locators are apart.
  const [beyond] = compareMarks(j1, [
    { slice: 372, pixel: [lmsb.pixel[0] + 6, lmsb.pixel[1]] },
    null,
  ])
  expect(beyond.beyondSpan).toBe(true)
  expect(beyond.spanMm).toBeCloseTo(30.5, 1)
  expect(beyond.intended!.mm).toBeGreaterThan(beyond.spanMm!)
  expect(spanSentence(beyond)).toMatch(
    /Your mark is farther from the RMSB locator \(\d+\.\d mm\) than that locator is from the LMSB locator \(30\.5 mm\), so it lies outside the span between the two\./,
  )
  // Inside the span, the sentence is not shown at all.
  const [inside] = compareMarks(j1, [{ slice: 372, pixel: [...rmsb.pixel] }, null])
  expect(inside.beyondSpan).toBe(false)
  expect(spanSentence(inside)).toBeNull()
})

test('an unresolved response stays unresolved, gets no result band, is told what to scroll to and never mutates the marks', () => {
  const j1 = exerciseFor('junction-1')
  const packet = junctionFeedbackPacket('junction-1')!
  const marks: (CtMark | null)[] = [null, { slice: 372, pixel: null }]
  const before = JSON.stringify(marks)
  const goTo = jest.fn()
  const { container } = render(
    <JunctionFeedback exercise={j1} marks={marks} packet={packet} onGoToSlice={goTo} />,
  )
  const items = [...container.querySelectorAll('li[data-mark-status]')]
  expect(items.map((li) => li.getAttribute('data-mark-status'))).toEqual([
    'unresolved',
    'unresolved',
  ])
  expect(compareMarks(j1, marks).map((c) => c.verdict)).toEqual([null, null])
  expect(items.map((li) => li.hasAttribute('data-mark-verdict'))).toEqual([false, false])
  expect(container.querySelector('[data-verdict-tone]')).toBeNull()
  expect(container.querySelector('[data-when-nearer]')).toBeNull()
  const revisit = [...container.querySelectorAll('button')].map((b) => b.textContent)
  expect(revisit).toContain(`Go to the parent slice ${j1.trace.anchor.slice}`)
  expect(revisit).toContain('Go to answer slice 372')
  // Scroll until the lumens separate, then mark: not "that is a valid response".
  expect(container.textContent).toContain(packet.moreEvidence)
  expect(packet.moreEvidence).toMatch(
    /Scroll down one slice at a time from 376: the wall appears on 375 and is thick by 372\. Mark each oval on 372\./,
  )
  expect(container.textContent).toMatch(/Then use Redo branch marks below and mark the lumen/)
  expect(container.textContent).not.toMatch(
    /valid response|reasonable (record|response)|counted against you/i,
  )
  expect(JSON.stringify(marks)).toBe(before)
  expect(container.textContent!.match(SCORING)?.[0] ?? null).toBeNull()
})

test('a division outside the first five now has its explanation, and no identifiers reach the learner', () => {
  const other = exerciseFor('junction-9')
  const packet = junctionFeedbackPacket('junction-9')!
  const goTo = jest.fn()
  const { container } = render(
    <JunctionFeedback
      exercise={other}
      marks={[
        { slice: other.answerPoints[0].slice, pixel: [...other.answerPoints[0].pixel] },
        { slice: other.answerPoints[1].slice, pixel: null },
      ]}
      packet={packet}
      onGoToSlice={goTo}
    />,
  )
  expect(container.querySelector('[data-feedback-scope]')).toBeNull()
  expect(container.textContent).not.toMatch(/has not been authored yet|faculty review|pending/i)
  expect(container.textContent).not.toMatch(/junction-\d+|edge \d+|BBT-02/)
  expect(container.textContent).toContain(packet.divergence)
  expect(container.textContent).toContain(packet.continuity)
  expect(container.textContent).toContain(packet.moreEvidence)
  expect(container.querySelector('li[data-mark-verdict]')).toHaveTextContent(
    'In R basal. Your mark is inside the lumen of R basal on slice 294.',
  )
  const buttons = [...container.querySelectorAll('button')].map((b) => b.textContent)
  expect(buttons).toContain(`Go to the parent slice ${other.trace.anchor.slice}`)
  expect(buttons).toContain('Go to answer slice 309')
  expect(buttons).toContain('RB6 · right superior segmental bronchus')
  expect(container.textContent!.match(SCORING)?.[0] ?? null).toBeNull()
})
