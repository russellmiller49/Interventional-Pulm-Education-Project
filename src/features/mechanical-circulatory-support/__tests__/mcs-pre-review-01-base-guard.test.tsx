/**
 * MCS-PRE-REVIEW-01 — the defect guard that runs against the base commit.
 *
 * `mcs-pre-review-01.test.tsx` is the full contract, and it cannot run on `c717c9ff`: it imports
 * modules and reads fields that this slice added, so the suite fails to resolve rather than
 * reporting anything. This file asserts the *repaired behaviour only*, through imports that exist
 * on the base, so every one of the eight defects produces a named failure there and a pass here.
 *
 * Keeping the two apart matters. A regression that only fails because a new file is missing proves
 * the file is new; a regression that fails with "the worked explanation says the number is
 * authored" proves the defect.
 *
 * Base evidence is recorded in `MCS-PRE-REVIEW-01-handoff.md`. Nothing here is clinical approval.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render, screen } from '@testing-library/react'

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

import { McsCaseWorkflow } from '../components/McsCaseWorkflow'
import { McsMonitor } from '../components/McsMonitor'
import { McsStoryProblems } from '../components/stage/McsStoryProblems'
import { mcsLessonTransferByLessonId } from '../content/lessonTransfers'
import { allMcsScenarios, mcsScenarioById } from '../content/scenarios'
import { mcsSectionLearningContractById } from '../content/sectionLearningContracts'
import { mcsSources } from '../content/sources'
import { mcsStoryProblems } from '../content/storyProblems'
import { createInitialMcsState, mcsReducer } from '../engine'
import { calculateMcsScore } from '../engine/reducer'
import type { McsSimulationState } from '../engine/types'

function settle(state: McsSimulationState, seconds = 8): McsSimulationState {
  let next = state
  for (let step = 0; step < seconds * 5; step += 1) {
    next = mcsReducer(next, { type: 'TICK', seconds: 0.2 })
  }
  return next
}

const TRIGGERS = ['ecg', 'pressure', 'internal'] as const

function withTrigger(state: McsSimulationState, value: (typeof TRIGGERS)[number]) {
  return settle(mcsReducer(state, { type: 'SET_IABP_CONTROL', control: 'triggerSource', value }))
}

function openingState(id: string): McsSimulationState {
  const scenario = mcsScenarioById.get(id)!
  return settle(createInitialMcsState('practice', scenario.device, scenario, 417))
}

function workedExplanation(state: McsSimulationState): HTMLElement {
  const view = render(
    <McsCaseWorkflow state={mcsReducer(state, { type: 'COMPLETE' })} dispatch={jest.fn()} />,
  )
  return view.container.querySelector<HTMLElement>('[data-worked-explanation]')!
}

describe('F19 — the atrial-fibrillation trigger choice earns no success signal', () => {
  it('does not move the case score between trigger sources', () => {
    for (const id of ['IABP-02', 'CAP-IABP-01']) {
      const opening = openingState(id)
      const responses = TRIGGERS.map(
        (trigger) => calculateMcsScore(withTrigger(opening, trigger)).response,
      )
      expect(new Set(responses).size).toBe(1)
    }
  })

  it('marks the disputed condition held wherever the worked explanation prints it', () => {
    for (const id of ['IABP-02', 'CAP-IABP-01']) {
      const panel = workedExplanation(withTrigger(openingState(id), 'pressure'))
      expect(panel.querySelector('[data-condition-held="true"]')).not.toBeNull()
      expect(panel.textContent).toMatch(/not treated as an outcome/i)
      expect(panel.textContent).toContain('MCS-03-05')
    }
  })

  it('does not let the quiet alarm bar read as an all-clear', () => {
    const af = withTrigger(
      settle(
        mcsReducer(createInitialMcsState('learn', 'iabp', null, 417), {
          type: 'SET_RHYTHM',
          rhythm: 'atrial-fibrillation',
        }),
      ),
      'pressure',
    )
    expect(af.alarms.filter((alarm) => alarm.active)).toHaveLength(0)
    const view = render(<McsMonitor state={af} />)
    expect(view.container.querySelector('[data-af-trigger-held]')).not.toBeNull()
  })

  it('does not narrate the modeled index as a statement about the balloon', () => {
    const af = withTrigger(
      settle(
        mcsReducer(createInitialMcsState('learn', 'iabp', null, 417), {
          type: 'SET_RHYTHM',
          rhythm: 'atrial-fibrillation',
        }),
      ),
      'pressure',
    )
    expect(af.causalExplanation).not.toMatch(/^Counterpulsation is \d+% synchronized\./)
    expect(af.causalExplanation).toMatch(/not a console reading/)
  })
})

describe('F26 — the story names the patient it starts from, before it asks', () => {
  it('shows the pair’s own baseline and its model values above the question', () => {
    const story = mcsStoryProblems.find((candidate) => candidate.id === 'story-volume-for-suction')!
    const view = render(<McsStoryProblems stories={[story]} />)
    const panel = view.container.querySelector<HTMLElement>('[data-story-baseline]')
    expect(panel).not.toBeNull()
    expect(panel!.textContent).toContain('mcs-story-low-preload-suction-v1')
    expect(panel!.querySelector('[data-story-baseline-metric="rapMmHg"]')).not.toBeNull()
    expect(panel!.querySelector('[data-story-baseline-metric="pcwpMmHg"]')).not.toBeNull()
    const question = view.container.querySelector('[data-story-choices]')!
    expect(panel!.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('states the scope of the loading change without implying a dose', () => {
    const story = mcsStoryProblems.find((candidate) => candidate.id === 'story-volume-for-suction')!
    const view = render(<McsStoryProblems stories={[story]} />)
    const scope = view.container.querySelector('[data-story-change-scope]')
    expect(scope).not.toBeNull()
    expect(scope!.textContent).toMatch(/not a specified bolus/i)
    expect(scope!.textContent).not.toMatch(/\b\d+\s*(mL|ml|cc)\b/)
  })
})

describe('F33 — the twelve cases say what kind of number each condition is', () => {
  it.each(allMcsScenarios.map((scenario) => scenario.id))(
    '%s prints a classification beside every threshold',
    (id) => {
      const panel = workedExplanation(openingState(id))
      expect(panel.querySelector('[data-condition-contract]')).not.toBeNull()
      const entries = panel.querySelectorAll('[data-condition-list] > li')
      expect(entries.length).toBe(mcsScenarioById.get(id)!.successCriteria.length)
      entries.forEach((entry) => {
        expect(entry.getAttribute('data-condition-class')).toBeTruthy()
        expect(entry.textContent).toContain('Authored for this simulation')
      })
    },
  )
})

describe('F04 — the monitor and the causal ladder name their quantities', () => {
  it('labels the strip readouts and the modeled means', () => {
    render(<McsMonitor state={settle(createInitialMcsState('learn', 'iabp', null, 417))} />)
    expect(screen.getByRole('img', { name: /^ART waveform/ }).getAttribute('aria-label')).toMatch(
      /instantaneous sample/,
    )
    expect(document.querySelectorAll('[data-readout-window="instantaneous"]').length).toBe(4)
    expect(document.querySelector('[data-quantity-class="model-index"]')?.textContent).toMatch(
      /no console reports this/,
    )
    expect(document.body.textContent).toContain('modeled mean')
  })

  it('keeps the modeled synchrony index off the device-display level', () => {
    const observation = mcsLessonTransferByLessonId.get('iabp-timing-triggering')!.observation!
    expect(String(observation.level)).toBe('model-index')
    for (const contract of mcsSectionLearningContractById.values()) {
      for (const signal of contract.observedSignals) {
        if (signal.key !== 'timingQualityPercent') continue
        expect(String(signal.level)).toBe('model-index')
      }
    }
  })
})

describe('F18 / F27 / F28 — claims that have to match the screen and the device', () => {
  it('claims no unannotated example', () => {
    const contract = mcsSectionLearningContractById.get('iabp-timing-triggering')!
    expect(contract.recognizePrompt).not.toMatch(/unannotated/i)
    expect(contract.startingContext).not.toMatch(/unannotated/i)
  })

  it('does not call the durable reference state normal', () => {
    const reference = settle(createInitialMcsState('learn', 'lvad', null, 417))
    expect(reference.metrics.mapMmHg).toBeGreaterThan(100)
    const section7 = mcsSectionLearningContractById.get('lvad-parameters-assessment')!
    expect(section7.startingContext).not.toMatch(/reading normally/)
    expect(section7.startingContext).toMatch(/not adopted as this module’s target/)
  })

  it('names the direction of the real controller’s flow estimate, with its source', () => {
    const section8 = mcsSectionLearningContractById.get('lvad-alarms-emergencies')!
    expect(section8.teaching.flowAccountNote).toMatch(
      /speed, power and (the patient’s )?hematocrit/,
    )
    expect(section8.teaching.flowAccountNote).toMatch(/no estimator equation/)
    expect(
      mcsSources.some((source) => source.id === 'abbott-heartmate3-pump-parameters-card'),
    ).toBe(true)
  })
})

describe('F01 — the hub’s light theme is pinned to the module’s own palette', () => {
  it('sets the shared frame’s tokens inside the MCS shell', () => {
    const css = readFileSync(
      join(__dirname, '..', 'components/mechanical-circulatory-support.module.css'),
      'utf8',
    )
    expect(css).toMatch(
      /\.moduleShell \[data-learning-module-v2-theme-root\]\[data-theme='light'\]/,
    )
    expect(css).toContain('--lm-v2-text: var(--ink)')
  })
})
