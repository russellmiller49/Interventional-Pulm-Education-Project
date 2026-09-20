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
/** Anatomical verdicts and accuracy grades this comparison must never produce. */
const VERDICT =
  /\b(score|scored|grade|graded|accuracy|pass|passed|fail|failed|incorrect|wrong|correct)\b|inside the intended lumen[.,]|correct branch|mistaken vessel|right airway|true airway/i

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
  const { container } = render(
    <JunctionFeedback
      exercise={j10}
      marks={[null, markNearUnrelated()]}
      packet={junctionFeedbackPacket('junction-10')}
      onGoToSlice={() => {}}
    />,
  )
  // The packet text for RB5 names RB4; RB4 is not the nearest locator here, so it is not shown.
  expect(container.querySelector('[data-when-nearer="RB5"]')).toBeNull()
  const scoped = container.querySelector('[data-when-nearer-scope="RB5"]')!
  expect(scoped).not.toBeNull()
  expect(scoped.textContent).toMatch(/Your RB5 mark sits nearer the RB5a model locator/)
  expect(scoped.textContent).toMatch(/that comparison does not apply to your mark/)
  // No sentence claims the mark is nearer RB4 while the position sentence says RB5a.
  const nearerClaims = container.textContent!.match(/sits nearer the (\w+) model locator/g) ?? []
  expect(new Set(nearerClaims)).toEqual(new Set(['sits nearer the RB5a model locator']))
  expect(container.textContent).not.toMatch(/it sits nearer RB4/)
  expect(container.textContent!.match(VERDICT)?.[0] ?? null).toBeNull()
})

test('the sibling paragraph is still shown when the sibling is the nearest locator', () => {
  const { container } = render(
    <JunctionFeedback
      exercise={j10}
      marks={[null, { slice: 307, pixel: [...j10.answerPoints[0].pixel] as [number, number] }]}
      packet={junctionFeedbackPacket('junction-10')}
      onGoToSlice={() => {}}
    />,
  )
  expect(container.querySelector('[data-when-nearer="RB5"]')).toHaveTextContent(
    /Your RB5 mark sits nearer the RB4 model locator/,
  )
  expect(container.querySelector('[data-when-nearer-scope="RB5"]')).toBeNull()
})

test('the span sentence states the scalar it is actually comparing', () => {
  const j1 = exerciseFor('junction-1')
  const [rmsb, lmsb] = j1.trace.checkpoints[0].decision!.options
  // Beyond LMSB, on the far side from RMSB: farther from RMSB than the two locators are apart.
  const [beyond] = compareMarks(j1, [
    { slice: 387, pixel: [lmsb.pixel[0] + 6, lmsb.pixel[1]] },
    null,
  ])
  expect(beyond.beyondSpan).toBe(true)
  expect(beyond.spanMm).toBeCloseTo(8.6, 1)
  expect(beyond.intended!.mm).toBeGreaterThan(beyond.spanMm!)
  expect(spanSentence(beyond)).toMatch(
    /Your mark is farther from the RMSB locator \(\d+\.\d mm\) than that locator is from the LMSB locator \(8\.6 mm\), so it lies outside the span between the two\./,
  )
  // Inside the span, the sentence is not shown at all.
  const [inside] = compareMarks(j1, [{ slice: 387, pixel: [...rmsb.pixel] }, null])
  expect(inside.beyondSpan).toBe(false)
  expect(spanSentence(inside)).toBeNull()
})

test('an unresolved response stays unresolved, offers a revisit action and never mutates the marks', () => {
  const j1 = exerciseFor('junction-1')
  const marks: (CtMark | null)[] = [null, { slice: 387, pixel: null }]
  const before = JSON.stringify(marks)
  const goTo = jest.fn()
  const { container } = render(
    <JunctionFeedback
      exercise={j1}
      marks={marks}
      packet={junctionFeedbackPacket('junction-1')}
      onGoToSlice={goTo}
    />,
  )
  const statuses = [...container.querySelectorAll('li[data-mark-status]')].map((li) =>
    li.getAttribute('data-mark-status'),
  )
  expect(statuses).toEqual(['unresolved', 'unresolved'])
  const revisit = [...container.querySelectorAll('button')].map((b) => b.textContent)
  expect(revisit).toContain(`Go to the parent slice ${j1.trace.anchor.slice}`)
  expect(revisit).toContain('Go to response slice 387')
  expect(container.textContent).toMatch(
    /neither counted against you nor turned into an identification/,
  )
  expect(JSON.stringify(marks)).toBe(before)
  expect(container.textContent!.match(VERDICT)?.[0] ?? null).toBeNull()
})

test('a division with no authored packet gives a revisit action and keeps identifiers in the detail', () => {
  const other = exerciseFor('junction-9')
  const goTo = jest.fn()
  const { container } = render(
    <JunctionFeedback
      exercise={other}
      marks={other.answerPoints.map((p) => ({
        slice: p.slice,
        pixel: [...p.pixel] as [number, number],
      }))}
      packet={junctionFeedbackPacket('junction-9')}
      onGoToSlice={goTo}
    />,
  )
  const scope = container.querySelector('[data-feedback-scope]')!
  expect(scope.textContent).toMatch(/has not been authored yet/)
  expect(scope.textContent).not.toMatch(/junction-\d+|edge \d+|BBT-02/)
  const detail = container.querySelector('details')!
  expect(detail.textContent).toMatch(/junction-9/)
  expect(detail.textContent).toMatch(/parent source edge \d+/)
  const buttons = [...container.querySelectorAll('button')].map((b) => b.textContent)
  expect(buttons).toContain(`Go to the parent slice ${other.trace.anchor.slice}`)
  expect(container.textContent!.match(VERDICT)?.[0] ?? null).toBeNull()
})
