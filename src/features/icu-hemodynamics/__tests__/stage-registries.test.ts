import {
  HEMODYNAMICS_CONTROL_PANEL,
  validateHemodynamicsControlPanel,
} from '../content/controlPanel'
import { routeStops, validateRouteSpine } from '../content/routeSpine'
import { hemodynamicsSectionSpecs, validateHemodynamicsSectionSpecs } from '../content/sectionSpecs'
import { signalGrammarRows, validateSignalGrammar } from '../content/signalGrammar'

describe('the stage registries validate at import', () => {
  it('route spine', () => {
    expect(validateRouteSpine()).toEqual([])
    expect(routeStops).toHaveLength(5)
  })
  it('control panel', () => {
    expect(validateHemodynamicsControlPanel()).toEqual([])
    expect(HEMODYNAMICS_CONTROL_PANEL.controls).toHaveLength(5)
  })
  it('signal grammar', () => {
    expect(validateSignalGrammar()).toEqual([])
    expect(signalGrammarRows.length).toBeGreaterThanOrEqual(10)
  })
  it('section specs', () => {
    expect(validateHemodynamicsSectionSpecs()).toEqual([])
    expect(hemodynamicsSectionSpecs).toHaveLength(9)
  })
})

describe('the stage items, sort, stories and map answers validate at import', () => {
  it('items', async () => {
    const { validateHemodynamicsStageItems, hemodynamicsStageItems } =
      await import('../content/stageItems')
    expect(validateHemodynamicsStageItems()).toEqual([])
    expect(Object.keys(hemodynamicsStageItems)).toHaveLength(9)
  })
  it('question sort', async () => {
    const { validateQuestionSort } = await import('../content/questionSort')
    expect(validateQuestionSort()).toEqual([])
  })
  it('story problems', async () => {
    const { validateHemodynamicsStoryProblems, hemodynamicsStoryProblems } =
      await import('../content/storyProblems')
    expect(validateHemodynamicsStoryProblems()).toEqual([])
    expect(hemodynamicsStoryProblems).toHaveLength(3)
  })
  it('map answers', async () => {
    const { validateHemodynamicsMapAnswerTargets, hemodynamicsMapAnsweredItemIds } =
      await import('../content/mapAnswerTargets')
    expect(validateHemodynamicsMapAnswerTargets()).toEqual([])
    expect(hemodynamicsMapAnsweredItemIds).toEqual(['hd-place-predict-1', 'hd-place-transfer-1'])
  })
})

describe('the stage lessons validate at import', () => {
  it('nine lessons, one prediction and one transfer each', async () => {
    const { hemodynamicsStageLessons, validateHemodynamicsStageLessons } =
      await import('../content/stageLessons')
    expect(validateHemodynamicsStageLessons()).toEqual([])
    expect(hemodynamicsStageLessons()).toHaveLength(9)
  })
})
