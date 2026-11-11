import { cleanup } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)

import { MCS_OBSERVE_FOCUS, mcsObserveFocus } from '../content/observeFocus'
import { mcsSectionLearningContractById } from '../content/sectionLearningContracts'
import { mcsStageLessonIds } from '../content/stageLessons'
import {
  continueStep,
  currentStepId,
  mountSection,
  performAction,
  setupMcsStage,
  teardownMcsStage,
} from '../test-support/mcsStage'

/**
 * The Observe task marks the readings its instruction names.
 *
 * Walked on screen in November 2026, an Observe task named two or three readings in its
 * instruction, listed six in the table in another order with the named ones below the fold, and
 * marked nothing beside the picture. The named readings are now first in the table and marked
 * among the live readings, and each live reading says where it stood before the change.
 */
afterEach(() => {
  cleanup()
  teardownMcsStage()
})

/** Mount at Act, make the section's change, and continue to Observe. */
function observe(sectionId: string) {
  mountSection(sectionId, 'act')
  performAction(sectionId)
  continueStep()
  expect(currentStepId()).toBe(`${sectionId}-observe`)
}

const namedRows = () =>
  [...document.querySelectorAll('[data-before-after] [data-named-readings] tr[data-signal]')].map(
    (row) => row.getAttribute('data-signal'),
  )
const reading = (id: string) => document.querySelector<HTMLElement>(`[data-reading="${id}"]`)!

describe('the readings each Observe instruction names', () => {
  it('are named for every section, from that section’s own observed signals', () => {
    expect(Object.keys(MCS_OBSERVE_FOCUS).sort()).toEqual([...mcsStageLessonIds].sort())
    for (const id of mcsStageLessonIds) {
      const focus = mcsObserveFocus(id)
      const signals = mcsSectionLearningContractById.get(id)!.observedSignals.map((s) => s.key)
      expect(focus.length).toBeGreaterThanOrEqual(2)
      expect(new Set(focus).size).toBe(focus.length)
      for (const key of focus) expect(signals).toContain(key)
      // Naming every signal would mark nothing.
      expect(focus.length).toBeLessThan(signals.length)
    }
  })
})

describe('an Observe task after a change', () => {
  beforeEach(() => setupMcsStage())

  it('lists the named readings first, in the order the instruction names them', () => {
    observe('iabp-efficacy-limits')
    expect(namedRows()).toEqual(mcsObserveFocus('iabp-efficacy-limits'))
    const others = [
      ...document.querySelectorAll('[data-before-after] [data-other-readings] tr[data-signal]'),
    ].map((row) => row.getAttribute('data-signal'))
    expect(others).toEqual(['rapMmHg', 'papi', 'svo2Percent'])
    expect(document.querySelector('[data-named-readings] [data-group-heading]')).toHaveTextContent(
      'Named in this task',
    )
  })

  it('keeps a named reading that did not move in view, and says it did not', () => {
    // "…while timing synchrony does not move at all."
    observe('iabp-efficacy-limits')
    const timing = document.querySelector(
      '[data-before-after] tr[data-signal="timingQualityPercent"]',
    )!
    expect(timing).toHaveAttribute('data-named')
    expect(timing).toHaveAttribute('data-changed', 'false')
    expect(timing).toHaveTextContent('unchanged')
  })

  it('marks the same readings among the live values, each with where it stood', () => {
    observe('iabp-efficacy-limits')
    const pressure = reading('mean-arterial-pressure')
    expect(pressure).toHaveAttribute('data-named')
    expect(pressure).toHaveTextContent('Named in this task')
    expect(pressure.querySelector('[data-reading-was]')).toHaveAttribute(
      'data-reading-was',
      'decreased',
    )
    expect(pressure.querySelector('[data-reading-was]')).toHaveTextContent(
      /^Down from \d+\.\d mm Hg$/,
    )
    expect(reading('effective-systemic-flow')).toHaveAttribute('data-named')
    // A reading the instruction does not name still says where it stood.
    const rightAtrial = reading('right-atrial-pressure')
    expect(rightAtrial).not.toHaveAttribute('data-named')
    expect(rightAtrial.querySelector('[data-reading-was]')).toHaveTextContent(/^Up from /)
  })

  it('groups the table the same way where the task also asks which way a reading moved', () => {
    observe('lvad-parameters-assessment')
    expect(namedRows()).toEqual(mcsObserveFocus('lvad-parameters-assessment'))
    expect(document.querySelector('[data-captured-results] table')).toHaveClass('capturedTable')
  })

  it('shows the flow the console displays as the left pump estimate, not the model’s real flow', () => {
    // The high-power pattern: displayed flow reads falsely high while real pump flow falls.
    observe('lvad-alarms-emergencies')
    const now = (signal: string) =>
      Number(
        document
          .querySelector(`[data-before-after] tr[data-signal="${signal}"] td[data-direction]`)!
          .textContent!.match(/[\d.]+/)![0],
      )
    const displayed = now('estimatedPumpFlowLMin')
    const real = now('deviceFlowLMin')
    expect(displayed - real).toBeGreaterThan(1)
    const estimate = reading('left-pump-estimate')
    const shown = Number(estimate.querySelector('dd')!.textContent!.match(/[\d.]+/)![0])
    expect(Math.abs(shown - displayed)).toBeLessThan(0.06)
    expect(estimate).toHaveAttribute('data-named')
    expect(estimate.querySelector('[data-reading-was]')).toHaveTextContent(/^Up from /)
  })
})

describe('where nothing was changed', () => {
  beforeEach(() => setupMcsStage())

  it('an inspection marks the named readings and claims no change', () => {
    observe('mcs-foundations-signals')
    expect(namedRows()).toEqual(mcsObserveFocus('mcs-foundations-signals'))
    expect(document.querySelector('[data-reading-was]')).toBeNull()
  })

  it('a task that is not Observe marks nothing', () => {
    mountSection('iabp-efficacy-limits', 'act')
    performAction('iabp-efficacy-limits')
    expect(document.querySelector('[data-reading][data-named]')).toBeNull()
    expect(document.querySelector('[data-reading-was]')).toBeNull()
  })
})
