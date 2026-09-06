/**
 * The clinical distinctions the module turns on, pinned against the content registries and the
 * engine. Nothing here mounts a component.
 *
 * These were the "clinical distinctions survive the rewrite" pins of the Learn workbench suite,
 * together with its record of what must not move between releases: the section ids, the activity
 * ids, the storage key and the payload shape. The Learn workbench is gone; the distinctions are
 * claims about the contracts, the pathway cards, the controls and the reducer rather than about
 * any pane, so they are held here, where a component rewrite cannot take them down with it.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { criticalCareActivities } from '@/features/critical-care/content/activities'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'

import {
  mcsCapstoneScenarios,
  mcsCommonModelQuestions,
  mcsDerivedValueGuides,
  mcsFlowAccount,
  mcsLearnControls,
  mcsLessonTransferByLessonId,
  mcsLessons,
  mcsPracticeScenarios,
  mcsRequiredDistinctions,
  mcsSectionLearningContractById,
  mcsSectionLearningContracts,
  mcsSectionPrimarySurfaces,
  mcsSupportPathwayCardById,
  type McsSectionLearningContract,
} from '../content'
import {
  MCS_COMPLETABLE_ITEM_COUNT,
  createDefaultMcsProgress,
  createInitialMcsState,
  mcsReducer,
  readMcsProgress,
  type McsSimulationState,
} from '../engine'

const PROGRESS_KEY = 'interventionalpulm:mcs-progress:v1'

const KNOWN_SECTION_IDS = [
  'mcs-foundations-signals',
  'mcs-foundations-mechanisms',
  'iabp-timing-triggering',
  'iabp-efficacy-limits',
  'impella-unloading-placement',
  'impella-suction-purge-rv',
  'lvad-parameters-assessment',
  'lvad-alarms-emergencies',
  'mcs-device-selection-integration',
] as const

function contract(sectionId: string): McsSectionLearningContract {
  const found = mcsSectionLearningContractById.get(sectionId)
  if (!found) throw new Error(`No learning contract for ${sectionId}`)
  return found
}

function card(pathwayId: string) {
  const found = mcsSupportPathwayCardById.get(pathwayId)
  if (!found) throw new Error(`No pathway card for ${pathwayId}`)
  return found
}

function distinction(id: string) {
  const found = mcsRequiredDistinctions.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`No required distinction ${id}`)
  return found
}

/** The section's authored starting state, settled, exactly as the stage opens it. */
function openedState(section: McsSectionLearningContract): McsSimulationState {
  let state = createInitialMcsState('learn', section.startingDevice)
  for (const action of section.startingActions) state = mcsReducer(state, action)
  for (let tick = 0; tick < 30; tick += 1) {
    state = mcsReducer(state, { type: 'TICK', seconds: 0.2 })
  }
  return state
}

function settle(state: McsSimulationState, ticks: number): McsSimulationState {
  let next = state
  for (let tick = 0; tick < ticks; tick += 1) {
    next = mcsReducer(next, { type: 'TICK', seconds: 0.2 })
  }
  return next
}

beforeEach(() => {
  window.localStorage.clear()
})

// ── Orientation and identity ─────────────────────────────────────────────────

describe('nothing persistent moved', () => {
  it('keeps all nine section ids, in pathway order', () => {
    expect(mcsLessons.map((lesson) => lesson.id)).toEqual([...KNOWN_SECTION_IDS])
    expect(
      criticalCareLearningPathway('mechanical-circulatory-support').sections.map(
        (section) => section.id,
      ),
    ).toEqual([...KNOWN_SECTION_IDS])
  })

  it('keeps every activity id unchanged', () => {
    const learnActivities = criticalCareActivities
      .filter((activity) => activity.id.startsWith('mcs:learn:'))
      .map((activity) => activity.id)
    expect(learnActivities).toEqual(KNOWN_SECTION_IDS.map((id) => `mcs:learn:${id}`))
  })

  it('keeps the storage key, payload shape, and payload version', () => {
    const progress = createDefaultMcsProgress()
    expect(progress.version).toBe(1)
    expect(Object.keys(progress).sort()).toEqual(
      [
        'bestScores',
        'completedCapstoneIds',
        'completedCaseIds',
        'completedLessonIds',
        'criticalErrorStatus',
        'lastActivityId',
        'lastDevice',
        'lastSection',
        'masteredCaseIds',
        'version',
      ].sort(),
    )
    // The key itself, read from the module rather than typed here twice.
    const source = readFileSync(
      path.join(process.cwd(), 'src/features/mechanical-circulatory-support/engine/progress.ts'),
      'utf8',
    )
    expect(source).toContain(`const STORAGE_KEY = '${PROGRESS_KEY}'`)
  })

  it('reads a completion record written before this package', () => {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        ...createDefaultMcsProgress(),
        completedLessonIds: ['iabp-timing-triggering'],
        masteredCaseIds: ['IABP-01'],
      }),
    )
    expect(readMcsProgress().completedLessonIds).toEqual(['iabp-timing-triggering'])
    expect(readMcsProgress().masteredCaseIds).toEqual(['IABP-01'])
  })

  it('counts the nine sections consistently wherever a count is shown', () => {
    expect(mcsLessons).toHaveLength(9)
    expect(mcsSectionPrimarySurfaces).toHaveLength(9)
    expect(mcsSectionLearningContracts).toHaveLength(9)
    expect(MCS_COMPLETABLE_ITEM_COUNT).toBe(
      mcsLessons.length + mcsPracticeScenarios.length + mcsCapstoneScenarios.length,
    )
  })

  it('closes every section with an authored transfer that requires a response', () => {
    for (const section of mcsSectionLearningContracts) {
      const transfer = mcsLessonTransferByLessonId.get(section.sectionId)
      expect(transfer).toBeDefined()
      expect(transfer!.item.choices.length).toBeGreaterThan(1)
      expect(transfer!.requiredActionIds.length).toBeGreaterThan(0)
      expect(section.transferContext.length).toBeGreaterThan(30)
    }
  })
})

// ── Clinical distinctions ────────────────────────────────────────────────────

describe('the clinical distinctions', () => {
  it('never assigns counterpulsation a device flow, in the model, the contracts, or the card', () => {
    const iabpSections = mcsSectionLearningContracts.filter(
      (section) => section.startingDevice === 'iabp',
    )
    expect(iabpSections.length).toBeGreaterThan(0)
    for (const section of iabpSections) {
      const state = openedState(section)
      expect(state.metrics.deviceFlowLMin).toBeCloseTo(0, 2)
      expect(state.metrics.effectiveSystemicFlowLMin).toBeCloseTo(state.metrics.nativeFlowLMin, 2)
      expect(section.teaching.flowAccountNote).toMatch(/native|no device flow|empty/i)
    }
    const balloon = card('iabp-counterpulsation')
    expect(balloon.mechanismClass).toBe('timing-and-pressure')
    expect(balloon.displayedFlow.valueType).toBe('no-device-flow-reported')
    expect(balloon.productReferences).toHaveLength(0)
    expect(distinction('mcs.distinction.iabp-is-not-a-pump').pathwayIds).toContain(
      'iabp-counterpulsation',
    )
  })

  it('keeps the left and right microaxial pathways distinct and never sums them', () => {
    const section = contract('impella-suction-purge-rv')
    let state = openedState(section)
    state = mcsReducer(state, {
      type: 'SET_IMPELLA_CONFIGURATION',
      control: 'rightEnabled',
      value: true,
    })
    state = settle(state, 40)
    expect(state.metrics.rightDeviceFlowLMin).toBeGreaterThan(0.5)
    // The systemic device signal carries the left pump only.
    expect(state.metrics.deviceFlowLMin).toBeCloseTo(state.metrics.leftDeviceFlowLMin, 2)
    // And effective systemic flow is not the sum of the two pumps plus native.
    const summed =
      state.metrics.nativeFlowLMin +
      state.metrics.leftDeviceFlowLMin +
      state.metrics.rightDeviceFlowLMin
    expect(state.metrics.effectiveSystemicFlowLMin).toBeLessThan(summed - 0.5)
    expect(section.commonMisinterpretation).toMatch(/adding|added/i)

    // The two cards draw two different pathways with two different destinations.
    const left = card('impella-left-transvalvular')
    const right = card('impella-right-caval-to-pa')
    expect(left.bloodEntersFrom).not.toBe(right.bloodEntersFrom)
    expect(left.bloodReturnsTo).not.toBe(right.bloodReturnsTo)
    expect(left.bloodReturnsTo).toMatch(/aorta/i)
    expect(right.bloodReturnsTo).toMatch(/pulmonary artery/i)
    expect(distinction('mcs.distinction.left-versus-right-microaxial').pathwayIds).toEqual(
      expect.arrayContaining(['impella-left-transvalvular', 'impella-right-caval-to-pa']),
    )
  })

  it('never presents the two serial pump flows as one summed total', () => {
    const section = contract('impella-suction-purge-rv')
    // The before-and-after comparison keeps the two pumps and the systemic signal on separate rows.
    const observedKeys = section.observedSignals.map((signal) => signal.key)
    expect(observedKeys).toEqual(
      expect.arrayContaining(['leftDeviceFlowLMin', 'rightDeviceFlowLMin', 'deviceFlowLMin']),
    )
    expect(new Set(observedKeys).size).toBe(observedKeys.length)
    expect(section.afterStateLabels.join(' ')).toMatch(/reported separately/i)

    // The answer that adds them is keyed as a wrong mechanism, on this section and on the
    // mechanisms transfer, and no keyed-best answer anywhere adds two flows into one figure.
    const flowsAdd = section.predictionItem.choices.find((choice) => choice.id === 'flows-add')
    expect(flowsAdd?.plausibility).toBe('incorrect-mechanism')
    expect(section.predictionItem.correctChoiceIds).not.toContain('flows-add')
    const sumDeviceNative = mcsLessonTransferByLessonId
      .get('mcs-foundations-mechanisms')!
      .item.choices.find((choice) => choice.id === 'sum-device-native')
    expect(sumDeviceNative?.plausibility).toBe('incorrect-mechanism')
    for (const candidate of mcsSectionLearningContracts) {
      const best = candidate.predictionItem.choices.find(
        (choice) => choice.plausibility === 'best',
      )!
      expect(best.label).not.toMatch(/\b(add|adds|added|adding|sum|summed)\b.*\bflow/i)
    }

    // The pathway card says the same thing in its own words.
    expect(card('impella-right-caval-to-pa').displayedFlow.additivity).toMatch(
      /never add this to a left-sided pump flow/i,
    )
    expect(distinction('mcs.distinction.serial-pumps-are-not-additive').claim).toMatch(
      /serial|series/i,
    )
  })

  it('keeps durable support distinct from a larger temporary pathway', () => {
    const durable = mcsSectionLearningContracts.filter(
      (section) => section.startingDevice === 'lvad',
    )
    expect(durable.length).toBeGreaterThan(0)
    expect(
      durable.some((section) => /different decision in kind/i.test(section.deviceOrMechanism)),
    ).toBe(true)
    expect(mcsLearnControls['control:select-lvad'].doesNotGuarantee).toMatch(
      /different decision in kind/i,
    )
    expect(card('durable-continuous-flow-lvad').supportRole).toBe('durable')
    for (const pathwayId of ['impella-left-transvalvular', 'impella-right-caval-to-pa']) {
      expect(card(pathwayId).supportRole).toBe('temporary')
    }
    expect(distinction('mcs.distinction.durable-is-not-more-temporary').pathwayIds).toContain(
      'durable-continuous-flow-lvad',
    )
  })

  it('keeps cannula advancement and blood-flow direction separate wherever a pathway is drawn', () => {
    expect(contract('impella-suction-purge-rv').teaching.whatTheTargetRepresents).toMatch(
      /direction of advancement and direction of flow are different/i,
    )
    expect(contract('impella-unloading-placement').teaching.whatTheTargetRepresents).toMatch(
      /not the direction the catheter was advanced/i,
    )
    expect(distinction('mcs.distinction.insertion-direction-is-not-flow-direction').claim).toMatch(
      /not the direction blood flows/i,
    )
    // The common model asks the source-and-destination question with the same caution attached.
    const sourceAndDestination = mcsCommonModelQuestions.find(
      (question) => question.id === 'mcs.model.q2-source-and-destination',
    )
    expect(sourceAndDestination?.answeredBy.join(' ')).toMatch(
      /not the direction the cannula or catheter was advanced/i,
    )
  })

  it('never asks the learner to read right-sided support from the pulmonary pulsatility ratio', () => {
    const rightSided = contract('impella-suction-purge-rv')
    expect(rightSided.whatThisDoesNotEstablish).toMatch(/pulmonary pulsatility ratio/i)
    expect(rightSided.whatThisDoesNotEstablish).toMatch(/must not be used on its own/i)
    // No section makes it a success criterion of the action or a satisfied-state predicate.
    for (const section of mcsSectionLearningContracts) {
      expect(section.observationFocus).not.toMatch(/PAPi/)
      expect(section.actionInstruction).not.toMatch(/PAPi/)
    }
    expect(mcsDerivedValueGuides.pulmonaryArteryPulsatilityIndex.doNotInfer).toMatch(
      /do not use either band as a definition of RV failure/i,
    )
  })

  it('never equates a pressure improvement with improved perfusion', () => {
    for (const section of mcsSectionLearningContracts) {
      expect(section.organResponseExplanation.length).toBeGreaterThan(30)
    }
    const durable = contract('lvad-parameters-assessment')
    expect(durable.commonMisinterpretation).toMatch(/cardiac power|measured cardiac output/i)
    expect(durable.pressureLevelExplanation).toMatch(/improving patient/i)
    expect(mcsDerivedValueGuides.cardiacPowerOutputW.doNotInfer).toMatch(
      /evidence that perfusion is adequate/i,
    )
  })

  it('labels every displayed pump flow as an estimate rather than a measurement', () => {
    for (const section of mcsSectionLearningContracts) {
      if (section.startingDevice === 'iabp') continue
      expect(`${section.teaching.flowAccountNote} ${section.flowLevelExplanation}`).toMatch(
        /estimate|reasoned|computed/i,
      )
    }
    for (const pathwayId of [
      'impella-left-transvalvular',
      'impella-right-caval-to-pa',
      'durable-continuous-flow-lvad',
    ]) {
      expect(card(pathwayId).displayedFlow.valueType).toBe('estimated')
    }
    const displayed = mcsFlowAccount.find((line) => line.id === 'device-displayed')
    expect(displayed?.valueType).toBe('estimated')
    expect(displayed?.valueTypeStatement).toMatch(/not a flow probe/i)
  })
})
