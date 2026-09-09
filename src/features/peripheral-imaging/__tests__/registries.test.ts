/**
 * @jest-environment node
 */
import {
  CHAIN_STOPS,
  chainCaption,
  chainStopIds,
  validateImagingChain,
} from '../content/imagingChain'
import { imagingLearnerCopyErrors } from '../content/learnerCopy'

describe('the imaging chain', () => {
  it('has six stops in order and validates clean at import', () => {
    expect(chainStopIds).toHaveLength(6)
    expect(CHAIN_STOPS.map((stop) => stop.id)).toEqual([...chainStopIds])
    expect(validateImagingChain()).toEqual([])
  })

  it('prints the stop number only in the caption', () => {
    expect(chainCaption('detector')).toBe('You are at: the detector. Stop 4 of 6.')
    expect(chainCaption(null)).toMatch(/not pointing anywhere/)
    for (const stop of CHAIN_STOPS) expect(stop.title).not.toMatch(/\d/)
  })
})

describe('the learner copy gate', () => {
  it('refuses the shared banned vocabulary and empty copy', () => {
    expect(imagingLearnerCopyErrors('x', 'Trace the airway route to the lesion')).toHaveLength(1)
    expect(imagingLearnerCopyErrors('x', '   ')).toHaveLength(1)
    expect(imagingLearnerCopyErrors('x', 'Trace the airway path to the lesion')).toEqual([])
  })

  it('refuses digits only where the caller says so', () => {
    expect(imagingLearnerCopyErrors('x', 'Rotate to 30 degrees')).toEqual([])
    expect(imagingLearnerCopyErrors('x', 'Stop 4', { allowDigits: false })).toHaveLength(1)
  })
})

describe('the content registries validate clean at import', () => {
  it('pathway, control panel, grammar, sorts and lab goals', async () => {
    const { validateImagingPathway, peripheralImagingSectionIds, peripheralImagingPathway } =
      await import('../content/pathway')
    const { validateImagingControlPanel } = await import('../content/controlPanel')
    const { validateImagingGrammar, IMAGING_GRAMMAR } = await import('../content/grammar')
    const { validateImagingSorts, IMAGING_SORTS } = await import('../content/sorts')
    const { validateImagingLabGoals, IMAGING_LAB_GOALS } = await import('../content/labGoals')
    expect(validateImagingPathway()).toEqual([])
    expect(validateImagingControlPanel()).toEqual([])
    expect(validateImagingGrammar()).toEqual([])
    expect(validateImagingSorts()).toEqual([])
    expect(validateImagingLabGoals()).toEqual([])
    expect(peripheralImagingPathway.sections.map((section) => section.id)).toEqual([
      ...peripheralImagingSectionIds,
    ])
    expect(IMAGING_GRAMMAR).toHaveLength(9)
    expect(IMAGING_SORTS.map((sort) => sort.sectionId)).toEqual([
      'imaging-questions',
      'good-image',
      'dts-interpretation',
      'two-dimensional',
      'suite-cases',
    ])
    const labSections = Object.keys(IMAGING_LAB_GOALS)
    for (const sectionId of labSections) expect(peripheralImagingSectionIds).toContain(sectionId)
  })
})

describe('items, chain answers and cases validate clean at import', () => {
  it('converts every lesson pair and maps every chain-answered choice', async () => {
    const { validateImagingStageItems, imagingStageItems } = await import('../content/stageItems')
    const { validateImagingChainAnswerTargets, imagingChainAnsweredItemIds } =
      await import('../content/chainAnswerTargets')
    expect(validateImagingStageItems()).toEqual([])
    expect(validateImagingChainAnswerTargets()).toEqual([])
    expect(imagingChainAnsweredItemIds).toEqual([
      'chain-walk:walk-1',
      'good-image:walk-1',
      'suite-cases:capstone-1',
    ])
    const projection = imagingStageItems.projection
    expect(projection.prediction.id).toBe('projection:geometry-1')
    expect(projection.transfer).toMatchObject({
      id: 'projection:anatomy-1',
      phase: 'transfer',
      itemType: 'transfer-case',
    })
    expect(projection.prediction.choices.find((c) => c.id === 'c')?.plausibility).toBe(
      'reasonable-but-incomplete',
    )
    expect(imagingStageItems['suite-cases'].prediction.id).toBe('suite-cases:capstone-1')
  })
})

describe('section specs, suite views and sources validate clean at import', () => {
  it('one spec and one view per section; every section cites at least three sources', async () => {
    const { validateImagingSectionSpecs, imagingSectionSpecs } =
      await import('../content/sectionSpecs')
    const { validateImagingSuiteViews, SUITE_VIEWS, suiteViewForStep } =
      await import('../content/suiteViews')
    const { imagingStageSources } = await import('../content/stageSources')
    const { peripheralImagingSectionIds } = await import('../content/pathway')
    expect(validateImagingSectionSpecs()).toEqual([])
    expect(validateImagingSuiteViews()).toEqual([])
    expect(imagingSectionSpecs).toHaveLength(peripheralImagingSectionIds.length)
    for (const sectionId of peripheralImagingSectionIds) {
      expect(SUITE_VIEWS[sectionId].sectionId).toBe(sectionId)
      expect(imagingStageSources(sectionId).evidenceIds.length).toBeGreaterThanOrEqual(3)
    }
    const pinned = suiteViewForStep('chain-walk', { chainAnswer: true })
    expect(pinned.litStop).toBeNull()
    expect(pinned.stopSentence).toMatch(/not pointing anywhere/)
    expect(suiteViewForStep('projection', { litStop: 'detector' }).stopSentence).toBe(
      'You are at: the detector. Stop 4 of 6.',
    )
  })
})
