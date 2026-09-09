import { imagingLabGoals } from '../content/labGoals'
import { emptyLabState, labGoalMet, labStateAfterChange } from '../engine/labGoalEvaluation'
import { labReadouts, labValue } from '../engine/labMetrics'

/**
 * The acquisition lab's capture flag, and the goals that depend on it.
 *
 * `captured` is the one control whose own key is latched by its patch, so it is the one place a
 * stored boolean has to survive a read. It did not: `labValue` fell through to the action's
 * default, so the flag read false everywhere it was used and the last goal of every section on
 * this lab could never be met. Found by the imaging suite's CBCT scene check, 2026-09-09.
 */
const SECTIONS = ['cbct-acquisition', 'fixed-suite', 'mobile-suite'] as const

/** Centre the target, work through the readiness checks, then capture. */
function readyAndCaptured(lesson: string) {
  let state = emptyLabState('acquisition', lesson)
  state = labStateAfterChange('acquisition', state, { center: true }, lesson)
  for (const check of ['target', 'clearance', 'state', 'protection']) {
    state = labStateAfterChange('acquisition', state, { [check]: true }, lesson)
  }
  return labStateAfterChange('acquisition', state, { captured: true }, lesson)
}

describe('capturing the acquisition state', () => {
  it.each(SECTIONS)('lets %s reach every goal its Act step is waiting on', (lesson) => {
    const state = readyAndCaptured(lesson)
    const goals = imagingLabGoals(lesson)?.act ?? []
    expect(goals.length).toBeGreaterThan(0)
    const unmet = goals
      .filter((goal) => !labGoalMet(goal, state, 'acquisition', lesson))
      .map((goal) => goal.label)
    expect(unmet).toEqual([])
  })

  it('reads the captured flag back the way it was stored', () => {
    const lesson = 'cbct-acquisition'
    const state = readyAndCaptured(lesson)
    expect(state.values.captured).toBe(true)
    expect(labValue('acquisition', state.values, 'captured', lesson)).toBe(true)
    expect(labReadouts('acquisition', state.values, lesson).captured).toBe(true)
    expect(state.events).toContain('state-captured')
  })

  it('clears the capture when the setup moves, and says that it moved', () => {
    const lesson = 'cbct-acquisition'
    const moved = labStateAfterChange(
      'acquisition',
      readyAndCaptured(lesson),
      { offsetX: 12 },
      lesson,
    )
    expect(labValue('acquisition', moved.values, 'captured', lesson)).toBe(false)
    expect(moved.events).toContain('moved-after-capture')
  })

  it('leaves every other action a momentary trigger', () => {
    // Only `captured` latches its own key. The rest patch other keys and must keep reading false,
    // or a button press would look like a setting that stays on.
    const lesson = 'projection'
    const geometry = labStateAfterChange(
      'geometry',
      emptyLabState('geometry', lesson),
      { resetGeometry: true },
      lesson,
    )
    expect(labValue('geometry', geometry.values, 'resetGeometry', lesson)).toBe(false)
    expect(geometry.values.resetGeometry).toBeUndefined()

    const mpr = labStateAfterChange(
      'mpr',
      emptyLabState('mpr', 'tool-confirmation'),
      { slicesTarget: true },
      'tool-confirmation',
    )
    expect(labValue('mpr', mpr.values, 'slicesTarget', 'tool-confirmation')).toBe(false)

    const dose = labStateAfterChange(
      'dose',
      emptyLabState('dose', 'dose-reporting'),
      { presetSmaller: true },
      'dose-reporting',
    )
    expect(labValue('dose', dose.values, 'presetSmaller', 'dose-reporting')).toBe(false)
  })
})
