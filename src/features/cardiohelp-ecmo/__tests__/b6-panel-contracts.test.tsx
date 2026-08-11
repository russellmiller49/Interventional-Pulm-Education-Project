import { render } from '@testing-library/react'

import { assertNoUniversalTargetLanguage } from '@/features/critical-care/test-support/teachingPanelContract'

import {
  EcmoDrillTeachingPanel,
  ecmoDraftDrillTeachingPanelScenarioIds,
  ecmoDrillPanelMetadata,
  ecmoDrillTeachingPanelScenarioIds,
  ecmoFrozenPilotPanelScenarioIds,
  validateEcmoDrillPanelRegistry,
} from '../components/teaching/EcmoDrillTeachingPanel'
import { remainingVaDrillPanelConfigs } from '../components/teaching/drills/RemainingVaDrillPanels'
import { remainingVvDrillPanelConfigs } from '../components/teaching/drills/RemainingVvDrillPanels'
import { DRILL_SIGNAL_KINDS } from '../components/teaching/drills/drillPanelPrimitives'
import { ecmoDerivedValueGuideList } from '../content/ecmoValueGuides'
import { evidenceById } from '../content/evidence'
import { cardiohelpLearnLessons } from '../content/learnLessons'
import { requireEcmoLearnPrediction } from '../content/learnPredictionItems'
import { cardiohelpScenarioById } from '../content/scenarios'
import { createInitialSimulationState, ecmoSimulationReducer } from '../engine'
import type { EcmoChannelReadout, EcmoSimulationState } from '../engine/types'

const draftConfigs = {
  ...remainingVvDrillPanelConfigs,
  ...remainingVaDrillPanelConfigs,
} as const

const DRAFT_IDS = Object.keys(draftConfigs) as (keyof typeof draftConfigs)[]

function settled(scenarioId: string, steps = 12): EcmoSimulationState {
  let state = createInitialSimulationState(scenarioId, 'guided')
  for (let tick = 0; tick < steps; tick += 1) {
    state = ecmoSimulationReducer(state, { type: 'STEP' })
  }
  return state
}

function afterCommitment(state: EcmoSimulationState): EcmoSimulationState {
  const prediction = requireEcmoLearnPrediction(state.scenario.scenarioId)
  const best = prediction.item.choices.find((choice) => choice.plausibility === 'best')
  if (!best) throw new Error(`No best choice for ${state.scenario.scenarioId}`)
  const commitment = prediction.commitments[best.id]
  return ecmoSimulationReducer(state, {
    type: 'COMMIT_PREDICTION',
    goalId: commitment.goalId,
    control: commitment.control,
    direction: commitment.direction,
  })
}

function afterCorrection(state: EcmoSimulationState): EcmoSimulationState {
  const scenario = cardiohelpScenarioById.get(state.scenario.scenarioId)
  if (!scenario) throw new Error(`No scenario ${state.scenario.scenarioId}`)
  let corrected = ecmoSimulationReducer(afterCommitment(state), {
    type: 'CORRECT_FAULT',
    fault: scenario.expectation.correctiveFault,
  })
  for (let tick = 0; tick < 4; tick += 1) {
    corrected = ecmoSimulationReducer(corrected, { type: 'STEP' })
  }
  return corrected
}

function unavailablePressureState(state: EcmoSimulationState): EcmoSimulationState {
  const unavailable = (label: string, raw: number): EcmoChannelReadout => ({
    status: 'simulation-unmodeled',
    raw,
    displayed: null,
    reason: `${label} is intentionally unavailable in this contract state.`,
  })
  return {
    ...state,
    circuit: {
      ...state.circuit,
      readouts: {
        ...state.circuit.readouts,
        pVen: unavailable('pVen', state.circuit.pVen),
        pInt: unavailable('pInt', state.circuit.pInt),
        pArt: unavailable('pArt', state.circuit.pArt),
        deltaP: unavailable('the pressure difference', state.circuit.deltaP),
      },
    },
  }
}

const forbiddenPrecommitSemantics: Readonly<Record<keyof typeof draftConfigs, readonly RegExp[]>> =
  {
    'afterload-return-obstruction': [
      /downstream resistance/i,
      /return(?:-side)? obstruction/i,
      /inspect (?:the )?return/i,
    ],
    'afterload-oxygenator-resistance': [
      /oxygenator resistance/i,
      /membrane dysfunction/i,
      /exchange (?:the )?(?:membrane|oxygenator)/i,
    ],
    'acute-hypercapnia': [/acute hypercapnia/i, /increase (?:the )?sweep/i, /insufficient co2/i],
    'compensated-hypercapnia': [
      /compensated hypercapnia/i,
      /hold (?:the )?sweep/i,
      /preserve (?:the )?compensat/i,
    ],
    'transport-power-loss': [/ac (?:mains )?(?:power )?loss/i, /restore (?:verified )?ac/i],
    'va-startup-sensor-orientation': [/complete (?:the )?startup/i, /tip-to-tip/i],
    'va-preload-drainage-collapse': [
      /preload-limited/i,
      /drainage collapse/i,
      /(?:reduce|lower|ease) (?:the )?(?:pump |rpm|speed)/i,
    ],
    'va-afterload-arterial-return-obstruction': [
      /arterial-return obstruction/i,
      /resistance downstream of the (?:membrane|oxygenator)/i,
      /inspect (?:the )?(?:arterial )?return/i,
    ],
    'va-afterload-oxygenator-resistance': [
      /oxygenator resistance/i,
      /membrane dysfunction/i,
      /exchange (?:the )?(?:membrane|oxygenator)/i,
    ],
    'va-lv-loading': [/lv[- ]loading/i, /left[- ]ventricular loading/i, /unloading evaluation/i],
    'va-acute-hypercapnia': [/acute hypercapnia/i, /increase (?:the )?sweep/i],
    'va-gas-source-interruption': [
      /gas-source interruption/i,
      /source interrupted/i,
      /restore (?:the )?(?:verified )?(?:gas )?source/i,
    ],
    'va-arterial-bubble-stop': [
      /(?:arterial|return-side) bubble/i,
      /air indication present/i,
      /isolate (?:the )?patient/i,
    ],
    'va-transport-power-loss': [/ac (?:mains )?(?:power )?loss/i, /restore (?:verified )?ac/i],
  }

const rawRuntimeIdentifiers = [
  'startup-inspection',
  'preload-limited',
  'return-obstruction',
  'oxygenator-resistance',
  'acute-hypercapnia',
  'compensated-hypercapnia',
  'gas-source-interruption',
  'arterial-bubble',
  'ac-power-loss',
  'differential-hypoxemia',
  'lv-loading',
] as const

describe('B6 panel registry and metadata contracts', () => {
  it('derives exactly fourteen drafts from twenty authored Learn ids minus six frozen pilots', () => {
    expect(validateEcmoDrillPanelRegistry()).toEqual([])
    expect(cardiohelpLearnLessons).toHaveLength(20)
    expect(ecmoFrozenPilotPanelScenarioIds).toHaveLength(6)
    expect(ecmoDraftDrillTeachingPanelScenarioIds).toHaveLength(14)
    expect(ecmoDrillTeachingPanelScenarioIds).toHaveLength(20)

    const expectedDrafts = cardiohelpLearnLessons
      .map((lesson) => lesson.scenarioId)
      .filter((id) => !(ecmoFrozenPilotPanelScenarioIds as readonly string[]).includes(id))
    expect([...ecmoDraftDrillTeachingPanelScenarioIds].sort()).toEqual(expectedDrafts.sort())
    expect([...DRAFT_IDS].sort()).toEqual(expectedDrafts.sort())
    expect(new Set(ecmoDrillTeachingPanelScenarioIds).size).toBe(20)
  })

  it.each(DRAFT_IDS)(
    '%s maps to a real lesson/scenario/prediction and is draft/non-credit',
    (id) => {
      const config = draftConfigs[id]
      const lesson = cardiohelpLearnLessons.find((candidate) => candidate.scenarioId === id)
      const scenario = cardiohelpScenarioById.get(id)
      const prediction = requireEcmoLearnPrediction(id)

      expect(config.scenarioId).toBe(id)
      expect(lesson).toBeDefined()
      expect(scenario).toBeDefined()
      expect(prediction).toBeDefined()
      expect(config.supportMode).toBe(lesson?.supportMode)
      expect(config.supportMode).toBe(scenario?.supportMode)
      expect(ecmoDrillPanelMetadata(id)).toEqual({
        supportMode: config.supportMode,
        reviewStatus: 'draft',
        creditEligible: false,
      })
    },
  )

  it('does not copy one content configuration fourteen times', () => {
    expect(new Set(DRAFT_IDS.map((id) => String(draftConfigs[id].clinicalQuestion))).size).toBe(14)
    expect(new Set(DRAFT_IDS.map((id) => String(draftConfigs[id].mechanism))).size).toBe(14)
    expect(new Set(DRAFT_IDS.map((id) => draftConfigs[id].harmfulReflex.action)).size).toBe(14)
  })
})

describe('B6 draft-panel precommit and postcommit contracts', () => {
  it.each(DRAFT_IDS)('%s withholds exact and semantic answer content before commitment', (id) => {
    const state = settled(id)
    const { container } = render(<EcmoDrillTeachingPanel state={state} />)
    const text = container.textContent ?? ''
    const scenario = cardiohelpScenarioById.get(id)
    const prediction = requireEcmoLearnPrediction(id)
    if (!scenario) throw new Error(`No scenario ${id}`)

    expect(container.querySelector('[data-withheld-until-commitment]')).not.toBeNull()
    expect(container.querySelector('[data-after-commitment]')).toBeNull()
    expect(container.querySelector('[data-panel-source-support]')).toBeNull()
    for (const selector of [
      '[data-drill-mechanism]',
      '[data-drill-competing]',
      '[data-drill-fitting-response]',
      '[data-drill-domains]',
      '[data-harmful-reflex]',
    ]) {
      expect(container.querySelector(selector)).toBeNull()
    }

    for (const choice of prediction.item.choices) {
      expect(text).not.toContain(choice.label)
      if (choice.rationale) expect(text).not.toContain(choice.rationale)
    }
    expect(text).not.toContain(prediction.item.explanation)
    expect(text).not.toContain(scenario.debrief.diagnosis)
    for (const link of scenario.debrief.causalChain) expect(text).not.toContain(link)
    for (const step of scenario.debrief.correctWorkflow) expect(text).not.toContain(step)
    for (const pattern of forbiddenPrecommitSemantics[id]) expect(text).not.toMatch(pattern)
  })

  it.each(DRAFT_IDS)('%s opens every required teaching block after a real commitment', (id) => {
    const { container } = render(<EcmoDrillTeachingPanel state={afterCommitment(settled(id))} />)

    expect(container.querySelector('[data-panel-review-status="draft"]')).not.toBeNull()
    expect(container.querySelector('[data-panel-credit-eligible="false"]')).not.toBeNull()
    expect(container.querySelector('[data-draft-panel-notice]')).not.toBeNull()
    expect(container.querySelector('[data-after-commitment]')).not.toBeNull()
    for (const selector of [
      '[data-drill-mechanism]',
      '[data-drill-competing]',
      '[data-drill-fitting-response]',
      '[data-drill-domains]',
      '[data-harmful-reflex]',
      '[data-panel-source-support]',
    ]) {
      expect(container.querySelector(selector)).not.toBeNull()
    }
    expect(container.querySelectorAll('[data-competing]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('[data-model-boundary]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('[data-text-equivalent]').length).toBeGreaterThanOrEqual(3)
    for (const domain of ['device', 'circuit-or-gas', 'patient']) {
      expect(container.querySelector(`[data-domain="${domain}"]`)?.textContent?.trim()).toBeTruthy()
    }
  })
})

describe('B6 draft-panel provenance, number, and copy contracts', () => {
  const guideIds = new Set(ecmoDerivedValueGuideList.map((guide) => guide.id))

  it.each(DRAFT_IDS)('%s classifies every signal and guides every interpreted number', (id) => {
    const { container } = render(<EcmoDrillTeachingPanel state={settled(id)} />)
    const rows = [...container.querySelectorAll('[data-signal]')]
    expect(rows.length).toBeGreaterThan(0)

    for (const row of rows) {
      const kind = row.getAttribute('data-signal-kind')
      const value = row.querySelector('[data-signal-value]')?.textContent ?? ''
      expect(DRILL_SIGNAL_KINDS).toContain(kind)
      expect(row.querySelector('[data-signal-kind-label]')?.textContent?.trim()).toBeTruthy()
      expect(row.querySelector('[data-signal-site]')?.textContent?.trim()).toBeTruthy()
      if (/[-+]?\d/.test(value)) {
        const guideId = row.getAttribute('data-value-guide-id')
        expect({ id, signal: row.getAttribute('data-signal'), value, guideId }).toMatchObject({
          guideId: expect.any(String),
        })
        expect(guideIds).toContain(guideId)
      }
    }
  })

  it.each(DRAFT_IDS)('%s never calls an off-console or bedside site a console reading', (id) => {
    const { container } = render(<EcmoDrillTeachingPanel state={settled(id)} />)
    const offConsoleSites =
      /patient|arterial line|blood[- ]gas|pulse oximeter|blender|flowmeter|bedside|echocardi|cannula|clamp|external/i

    for (const row of container.querySelectorAll('[data-signal]')) {
      const site = row.querySelector('[data-signal-site]')?.textContent ?? ''
      const kind = row.getAttribute('data-signal-kind')
      expect(site.trim()).not.toBe('')
      if (offConsoleSites.test(site)) {
        expect({ id, site, kind }).toMatchObject({ kind: expect.not.stringMatching(/^valid$/) })
      }
    }
  })

  it.each(DRAFT_IDS)(
    '%s resolves claim-scoped support to registered item/scenario evidence',
    (id) => {
      const scenario = cardiohelpScenarioById.get(id)
      const prediction = requireEcmoLearnPrediction(id)
      if (!scenario) throw new Error(`No scenario ${id}`)
      const allowed = new Set([...scenario.evidenceIds, ...prediction.item.evidenceIds])

      expect(draftConfigs[id].sourceSupport.length).toBeGreaterThan(0)
      for (const source of draftConfigs[id].sourceSupport) {
        expect(evidenceById.has(source.evidenceId)).toBe(true)
        expect(allowed).toContain(source.evidenceId)
        expect(source.claim.trim()).not.toBe('')
      }
    },
  )

  it.each(DRAFT_IDS)('%s contains no universal target or raw runtime identifier', (id) => {
    for (const state of [settled(id), afterCommitment(settled(id))]) {
      const { container, unmount } = render(<EcmoDrillTeachingPanel state={state} />)
      const text = container.textContent ?? ''
      assertNoUniversalTargetLanguage(text)
      expect(text).not.toMatch(/\b(?:undefined|NaN|Infinity|\[object Object\])\b/)
      for (const rawId of rawRuntimeIdentifiers) expect(text).not.toContain(rawId)
      unmount()
    }
  })
})

describe('B6 draft panels render live active, corrected, and unavailable states', () => {
  it.each(DRAFT_IDS)('%s renders all required state classes without invalid output', (id) => {
    const active = settled(id)
    const variants = [active, afterCorrection(active), unavailablePressureState(active)]

    for (const state of variants) {
      const { container, unmount } = render(<EcmoDrillTeachingPanel state={state} />)
      expect(container.querySelector(`[data-drill-panel="${id}"]`)).not.toBeNull()
      expect(container.textContent ?? '').not.toMatch(/\b(?:undefined|NaN|Infinity)\b/)
      expect(container.querySelectorAll('[data-signal]').length).toBeGreaterThan(0)
      unmount()
    }

    const unavailable = render(<EcmoDrillTeachingPanel state={unavailablePressureState(active)} />)
    for (const row of unavailable.container.querySelectorAll(
      '[data-signal-kind="simulation-unmodeled"]',
    )) {
      expect(row.querySelector('[data-signal-value]')?.textContent).toContain('--')
      expect(row.textContent).toMatch(/intentionally unavailable/i)
    }
  })

  it.each(DRAFT_IDS)('%s best commitment matches the scenario expectation', (id) => {
    const scenario = cardiohelpScenarioById.get(id)
    const prediction = requireEcmoLearnPrediction(id)
    if (!scenario) throw new Error(`No scenario ${id}`)
    const best = prediction.item.choices.find((choice) => choice.plausibility === 'best')
    if (!best) throw new Error(`No best choice for ${id}`)
    expect(prediction.commitments[best.id]).toEqual({
      goalId: scenario.expectation.goalId,
      control: scenario.expectation.control,
      direction: scenario.expectation.direction,
    })
  })
})
