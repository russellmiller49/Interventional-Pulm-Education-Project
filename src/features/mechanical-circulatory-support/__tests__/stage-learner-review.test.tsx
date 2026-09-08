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
import { act, fireEvent, render, screen } from '@testing-library/react'

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

import { McsStageHost } from '../components/stage/McsStageHost'
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

function paneOrder(): readonly string[] {
  return [...document.querySelectorAll('[data-pane]')].map(
    (pane) => pane.getAttribute('data-pane') ?? '',
  )
}

describe('the panes say what they are', () => {
  it('lead with the steps, and each pane prints its name and what it is for', () => {
    mountSection('mcs-foundations-signals')
    expect(paneOrder()).toEqual(['task', 'teaching', 'simulator'])
    expect(
      [...document.querySelectorAll('[data-pane-label]')].map((label) => label.textContent),
    ).toEqual([
      'Steps panel · what to do',
      'Teaching panel · what to read',
      'Simulator panel · the monitor, the map and the controls',
    ])
    for (const name of ['Steps panel', 'Teaching panel', 'Simulator panel']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    }
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

  it('prints the location under the instruction, naming a pane whose caption says the same word', () => {
    mountSection('mcs-foundations-mechanisms')
    const where = document.querySelector('[data-now-card] [data-now-where]')
    expect(where?.textContent).toBe(
      'Where to look: Steps panel — this card, one stop at a time, and Simulator panel — the Circulation map, where each stop lights.',
    )
    const captions = [...document.querySelectorAll('[data-pane-label]')].map(
      (label) => label.textContent ?? '',
    )
    for (const named of where?.querySelectorAll('strong') ?? []) {
      expect(captions.some((caption) => caption.startsWith(named.textContent ?? '∅'))).toBe(true)
    }
    walkTheLoop()
    expect(currentStepId()).toBe('mcs-foundations-mechanisms-recognize')
    expect(document.querySelector('[data-now-card] [data-now-where]')?.textContent).toBe(
      'Where to look: Steps panel — the answer choices below, and Simulator panel — the Circulation map.',
    )
  })

  it('repeats the location in the help dialog', () => {
    mountSection('iabp-timing-triggering')
    fireEvent.click(screen.getByRole('button', { name: /What do I do now/ }))
    expect(document.querySelector('dialog')?.textContent).toMatch(
      /Where to look: Steps panel — the answer choices below, and Simulator panel — the arterial pressure trace on the monitor\./,
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

  it('prints the authored before-and-after account above the numbers on Observe', () => {
    const sectionId = 'iabp-timing-triggering'
    mountSection(sectionId)
    answerIdentification(sectionId)
    continueStep()
    commitPrediction(sectionId)
    continueFromVerdict()
    performAction(sectionId)
    continueStep()
    expect(currentStepId()).toBe(`${sectionId}-observe`)
    const contract = mcsSectionLearningContractById.get(sectionId)!
    const before = [...document.querySelectorAll('[data-before-labels] li')].map(
      (row) => row.textContent,
    )
    const after = [...document.querySelectorAll('[data-after-labels] li')].map(
      (row) => row.textContent,
    )
    expect(before).toEqual(contract.beforeStateLabels)
    expect(after).toEqual(contract.afterStateLabels)
    const labels = document.querySelector('[data-before-after-labels]')!
    const table = document.querySelector('[data-before-after]')!
    expect(labels.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('the short list says what kind of list it is', () => {
  it('labels the stop card’s checklist and associates the list with the label', () => {
    mountSection('mcs-foundations-mechanisms')
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
  it('names the pump-speed lock on the authorization box, from the flag that disables the slider', () => {
    const sectionId = 'lvad-parameters-assessment'
    mountSection(sectionId)
    answerIdentification(sectionId)
    continueStep()
    commitPrediction(sectionId)
    continueFromVerdict()
    expect(currentStepId()).toBe(`${sectionId}-act`)
    const slider = screen.getByRole('slider', { name: 'Pump speed' })
    const note = document.querySelector('[data-speed-authorization-note]')
    expect(slider).toBeDisabled()
    expect(note?.textContent).toMatch(/tick it to unlock the pump speed below/)
    fireEvent.click(screen.getByRole('checkbox', { name: /Authorized-personnel order/ }))
    expect(slider).not.toBeDisabled()
    expect(note?.textContent).toMatch(/the pump speed below can be changed/)
  })
})

describe('the compact viewport opens on the pane the step is worked in', () => {
  const COMPACT_WIDTH = 600
  let originalGetBoundingClientRect: typeof HTMLElement.prototype.getBoundingClientRect
  let originalResizeObserver: typeof ResizeObserver | undefined

  beforeEach(() => {
    jest.useFakeTimers()
    originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function measured(this: HTMLElement) {
      const rect = originalGetBoundingClientRect.call(this)
      if (
        /^Mechanical circulatory support lesson workspace/.test(
          this.getAttribute('aria-label') ?? '',
        )
      ) {
        return { ...rect, width: COMPACT_WIDTH, left: 0 }
      }
      return rect
    }
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  })

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
    globalThis.ResizeObserver = originalResizeObserver as typeof ResizeObserver
  })

  function visiblePane(): string {
    const visible = [...document.querySelectorAll<HTMLElement>('[role="region"]')].filter(
      (region) => /panel$/.test(region.getAttribute('aria-label') ?? '') && !region.hidden,
    )
    expect(visible).toHaveLength(1)
    return visible[0].querySelector('[data-pane]')?.getAttribute('data-pane') ?? ''
  }

  it('shows the steps for an identification answered on the card, and the simulator for one answered on the map', () => {
    render(<McsStageHost sectionId="impella-suction-purge-rv" />)
    act(() => {
      jest.runOnlyPendingTimers()
    })
    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(3)
    // Where does the right-sided pump return blood? Answered by the pins, in the simulator pane.
    expect(document.querySelector('[data-map-answer-prompt]')).not.toBeNull()
    expect(visiblePane()).toBe('simulator')
    // The learner may still switch panes themselves; the preference is followed, not forced.
    fireEvent.click(
      [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
        (tab) => tab.textContent === 'Steps',
      )!,
    )
    expect(visiblePane()).toBe('task')
  })

  it('shows the steps on a walk, which is worked from the card', () => {
    render(<McsStageHost sectionId="mcs-foundations-mechanisms" />)
    act(() => {
      jest.runOnlyPendingTimers()
    })
    expect(visiblePane()).toBe('task')
    walkTheLoop()
    // The identification that follows is read on the map and answered on the card, so the card
    // is the pane a compact viewport shows; the map is the second place the location names.
    expect(document.querySelector('[data-map-answer-prompt]')).toBeNull()
    expect(visiblePane()).toBe('task')
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
