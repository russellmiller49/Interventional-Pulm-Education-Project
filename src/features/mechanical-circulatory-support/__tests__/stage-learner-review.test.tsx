/**
 * What the September 2026 learner-review round changed on this module's stage, pinned.
 *
 * The findings came from a walk of the ECMO Learn pathway by someone who had not built it, and
 * most of them turned out to be properties of the shape this module shares: panes with names only
 * in `aria-label`, steps that name no pane, a compact viewport parked on the wrong pane, controls
 * with no hover state, a short list that reads as prose, a dead control that does not say what
 * unlocks it, a verdict written in another module's vocabulary, and authored copy the step carried
 * but never rendered. The record beside this module's docs says what each became; this suite says
 * it stays.
 */
import { fireEvent, screen, within } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .anatomyModule(),
)

import { mcsLessonTransferByLessonId, mcsLessonTransfers } from '../content/lessonTransfers'
import {
  mcsSectionLearningContractById,
  mcsSectionLearningContracts,
} from '../content/sectionLearningContracts'
import { buildMcsStageLesson, mcsStageLessonIds } from '../content/stageLessons'
import { mcsSpineStop } from '../content/supportSpine'
import {
  answerIdentification,
  commitPrediction,
  commitTransfer,
  continueFromVerdict,
  continueStep,
  currentStepId,
  mountSection,
  nowCard,
  nowPrimary,
  performAction,
  setupMcsStage,
  teardownMcsStage,
  walkTheLoop,
} from '../test-support/mcsStage'

beforeEach(() => {
  setupMcsStage()
})

afterEach(() => {
  teardownMcsStage()
})

describe('the task owns its teaching and observations', () => {
  it('uses the circulation reader with one task and no permanent panes', () => {
    mountSection('mcs-foundations-signals')
    expect(document.querySelectorAll('[data-now-card]')).toHaveLength(1)
    expect(
      document.querySelector('[data-now-card] [data-presentation="circulation-reader"]'),
    ).not.toBeNull()
    expect(document.querySelectorAll('[data-pane]')).toHaveLength(0)
  })
})

describe('every step says where it is worked', () => {
  it('authors a location on every step of every section, in words the panes carry', () => {
    for (const sectionId of mcsStageLessonIds) {
      for (const step of buildMcsStageLesson(sectionId).steps) {
        expect(`${step.id}: ${step.lookIn?.pane ?? 'none'}`).toMatch(
          /: (steps|teaching|simulator)$/,
        )
        expect(step.lookIn?.landmark.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('keeps the answer and observation in the current task without pane directions', () => {
    mountSection('mcs-foundations-mechanisms')
    expect(document.querySelector('[data-now-where]')).toBeNull()
    walkTheLoop()
    expect(currentStepId()).toBe('mcs-foundations-mechanisms-recognize')
    expect(document.querySelector('[data-now-card] fieldset')).not.toBeNull()
    expect(document.querySelector('[data-now-card] [data-circulation-map]')).not.toBeNull()
  })

  it('repeats the current task instruction in the help dialog', () => {
    mountSection('iabp-timing-triggering')
    fireEvent.click(screen.getByRole('button', { name: /What do I do now/ }))
    expect(document.querySelector('dialog')?.textContent).toMatch(
      /Inspect the Timing reference, then read the arterial trace using the button below/,
    )
  })

  it('opens the map on the Act step whose instruction is about what the map draws', () => {
    for (const [sectionId, opens] of [
      ['mcs-foundations-mechanisms', true],
      ['impella-suction-purge-rv', true],
      ['impella-unloading-placement', false],
      ['lvad-parameters-assessment', false],
    ] as const) {
      const act = buildMcsStageLesson(sectionId).steps.find((step) => step.phase === 'act')!
      expect(`${sectionId}: ${act.surfaces.includes('map')}`).toBe(`${sectionId}: ${opens}`)
    }
  })
})

describe('the card keeps its promises', () => {
  it('folds the other answers under the prediction verdict, and says the verdict in this module’s words', () => {
    const sectionId = 'lvad-parameters-assessment'
    mountSection(sectionId)
    answerIdentification(sectionId)
    continueStep()
    expect(document.querySelector('[data-other-answers-panel]')).toBeNull()
    commitPrediction(sectionId)
    const contract = mcsSectionLearningContractById.get(sectionId)!
    const best = contract.predictionItem.choices.find((choice) => choice.plausibility === 'best')!
    const verdict = document.querySelector('[data-verdict]')!
    expect(verdict.textContent).toContain('Correct. That is what the circulation does.')
    const others = verdict.querySelectorAll('[data-other-answers] [data-other-answer]')
    expect(others).toHaveLength(contract.predictionItem.choices.length - 1)
    expect(verdict.querySelector(`[data-other-answer="${best.id}"]`)).toBeNull()
    for (const choice of contract.predictionItem.choices.filter((c) => c.id !== best.id)) {
      expect(verdict.querySelector(`[data-other-answer="${choice.id}"]`)?.textContent).toContain(
        choice.rationale,
      )
    }
  })

  it('judges a transfer as a response, not as a read', () => {
    const sectionId = 'iabp-efficacy-limits'
    mountSection(sectionId)
    answerIdentification(sectionId)
    continueStep()
    commitPrediction(sectionId)
    continueFromVerdict()
    performAction(sectionId)
    continueStep()
    continueStep()
    continueStep()
    expect(currentStepId()).toBe(`${sectionId}-transfer`)
    commitTransfer(sectionId)
    const verdict = document.querySelector('[data-verdict]')!
    expect(verdict.textContent).toContain('Correct. That is the response this pattern calls for.')
    expect(verdict.textContent).not.toMatch(/cues support this read|working frame/)
    const transfer = mcsLessonTransferByLessonId.get(sectionId)!
    expect(verdict.querySelectorAll('[data-other-answer]')).toHaveLength(
      transfer.item.choices.length - 1,
    )
  })

  it('derives the selected Observe account from captured model readings', () => {
    const sectionId = 'iabp-timing-triggering'
    mountSection(sectionId)
    answerIdentification(sectionId)
    continueStep()
    commitPrediction(sectionId)
    continueFromVerdict()
    performAction(sectionId)
    continueStep()
    expect(currentStepId()).toBe(`${sectionId}-observe`)
    expect(document.querySelector('[data-captured-results]')?.textContent).toContain(
      'Observed in this run.',
    )
    expect(document.querySelector('[data-before-after]')?.textContent).toContain('Observed change')
    expect(document.querySelector('[data-before-after-labels]')).toBeNull()
    expect(nowPrimary()?.textContent).toBe('Continue')
  })
})

describe('the short list says what kind of list it is', () => {
  it('labels the stop card’s checklist and associates the list with the label', () => {
    mountSection('mcs-foundations-mechanisms')
    fireEvent.click(within(nowCard()).getByRole('button', { name: /Read the device/ }))
    continueStep()
    const card = document.querySelector('[data-teaching-block="stop"][data-stop="venous-return"]')
    expect(card).not.toBeNull()
    const label = card?.querySelector('[data-stop-checklist-label]')
    expect(label?.textContent).toBe('What to check at this stop')
    const list = card?.querySelector('[data-stop-checklist]')
    expect(list?.getAttribute('aria-labelledby')).toBe(label?.id)
    expect(list?.querySelectorAll('li')).toHaveLength(
      mcsSpineStop('venous-return').checklist.length,
    )
  })
})

describe('the dead control says what unlocks it', () => {
  it('offers only the afterload control, with no speed authorization escape', () => {
    const sectionId = 'lvad-parameters-assessment'
    mountSection(sectionId)
    answerIdentification(sectionId)
    continueStep()
    commitPrediction(sectionId)
    continueFromVerdict()
    expect(currentStepId()).toBe(`${sectionId}-act`)
    expect(screen.queryByRole('slider', { name: 'Pump speed' })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: /Authorized-personnel order/ })).toBeNull()
    expect(screen.getByRole('slider', { name: /SVR/ })).toBeEnabled()
  })
})

describe('compact task continuity', () => {
  it('keeps the map answer and next action together without tabs', () => {
    mountSection('impella-suction-purge-rv')
    expect(document.querySelector('[data-map-answer-prompt]')).not.toBeNull()
    expect(nowCard().querySelector('[data-circulation-map]')).not.toBeNull()
    expect(nowPrimary()).not.toBeNull()
    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(0)
  })
})

/**
 * The item sweep, pinned.
 *
 * Eight predictions offered an unsafe option that was a move — "raise the level instead",
 * "disconnect the power source briefly" — in an item whose stem asks what the circulation will do,
 * so a learner could pick it out by its shape alone. Each is a forecast now, still graded unsafe
 * because acting on it is the harm. Two transfers graded the section's own misreading partly
 * correct; three carried an absolute a learner eliminates on sight. Every edited item is draft
 * again until the owner has read it.
 */
describe('the items ask one kind of question', () => {
  const DRAFT_PREDICTIONS = [
    'mcs-foundations-signals-predict-1',
    'mcs-foundations-mechanisms-predict-1',
    'mcs-iabp-timing-predict-1',
    'mcs-iabp-limits-predict-1',
    'mcs-impella-placement-predict-1',
    'mcs-impella-bipella-predict-1',
    'mcs-lvad-afterload-predict-1',
    'mcs-lvad-high-power-predict-1',
    'mcs-integration-predict-1',
  ]
  const DRAFT_TRANSFERS = [
    'mcs-foundations-mechanisms-transfer-1',
    'mcs-iabp-trigger-transfer-1',
    'mcs-iabp-limits-transfer-1',
    'mcs-impella-afterload-transfer-1',
    'mcs-impella-suction-transfer-1',
    'mcs-lvad-emergency-transfer-1',
  ]
  const MOVE =
    /^(raise|lower|keep|disconnect|increase|reduce|give|switch|re-time|retime|whatever)\b/i

  it('offers no prediction option that is a move rather than a forecast', () => {
    for (const contract of mcsSectionLearningContracts) {
      for (const choice of contract.predictionItem.choices) {
        expect(`${contract.predictionItem.id}/${choice.id}: ${choice.label}`).not.toMatch(
          new RegExp(`: ${MOVE.source.slice(1)}`, 'i'),
        )
        expect(choice.label).not.toMatch(/\binstead\b/i)
      }
    }
  })

  it('grades no transfer option that restates the section’s own misreading as partly correct', () => {
    const limits = mcsLessonTransferByLessonId.get('iabp-efficacy-limits')!
    const emergency = mcsLessonTransferByLessonId.get('lvad-alarms-emergencies')!
    expect(limits.item.choices.find((c) => c.id === 'retime-normal')?.plausibility).toBe(
      'incorrect-mechanism',
    )
    expect(emergency.item.choices.find((c) => c.id === 'controller-only')?.plausibility).toBe(
      'incorrect-mechanism',
    )
  })

  it('carries no eliminable absolute in a transfer distractor', () => {
    for (const transfer of mcsLessonTransfers) {
      for (const choice of transfer.item.choices) {
        if (choice.plausibility === 'best') continue
        expect(`${transfer.item.id}/${choice.id}: ${choice.label}`).not.toMatch(
          /\b(always|never|in any rhythm|in every|every low-flow|until proven otherwise)\b/i,
        )
      }
    }
  })

  it('marks exactly the edited items draft, and leaves the rest as reviewed', () => {
    for (const contract of mcsSectionLearningContracts) {
      const expected = DRAFT_PREDICTIONS.includes(contract.predictionItem.id)
        ? 'draft'
        : 'sme-review'
      expect(`${contract.predictionItem.id}: ${contract.predictionItem.reviewStatus}`).toBe(
        `${contract.predictionItem.id}: ${expected}`,
      )
    }
    for (const transfer of mcsLessonTransfers) {
      const expected = DRAFT_TRANSFERS.includes(transfer.item.id) ? 'draft' : 'sme-review'
      expect(`${transfer.item.id}: ${transfer.item.reviewStatus}`).toBe(
        `${transfer.item.id}: ${expected}`,
      )
    }
  })
})
