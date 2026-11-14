import {
  HEMODYNAMICS_CONTROL_PANEL,
  validateHemodynamicsControlPanel,
} from '../content/controlPanel'
import { routeStops, validateRouteSpine } from '../content/routeSpine'
import { hemodynamicCases } from '../content/cases'
import {
  hemodynamicsPracticePairing,
  hemodynamicsSecondCase,
  hemodynamicsSectionSpecs,
  validateHemodynamicsSectionSpecs,
} from '../content/sectionSpecs'
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
  it('one case per section, as its last task, and every case placed once', () => {
    expect(
      hemodynamicsSectionSpecs.map((spec) => [
        spec.id,
        hemodynamicsPracticePairing(spec.id)?.caseId ?? null,
      ]),
    ).toEqual([
      ['why-measure', null],
      ['pressure-system', 'HD-08'],
      ['waveform-interpretation', 'HD-04'],
      ['waveform-components', 'HD-07'],
      ['catheter-advancement', 'HD-03'],
      ['pawp-capture', 'HD-06'],
      ['thermodilution-series', 'HD-01'],
      ['derived-hemodynamics', 'HD-05'],
      ['pac-signal-validation', null],
    ])
    expect(hemodynamicsSecondCase('derived-hemodynamics')).toEqual({
      caseId: 'HD-02',
      title: 'Warm shock with a low diastolic pressure',
      minutes: hemodynamicCases.find((definition) => definition.id === 'HD-02')!.minutes,
    })
    expect(
      hemodynamicsSectionSpecs.filter((spec) => hemodynamicsSecondCase(spec.id)).map((s) => s.id),
    ).toEqual(['derived-hemodynamics'])
    const placed = hemodynamicsSectionSpecs.flatMap((spec) => [
      ...(hemodynamicsPracticePairing(spec.id)
        ? [hemodynamicsPracticePairing(spec.id)!.caseId]
        : []),
      ...(hemodynamicsSecondCase(spec.id) ? [hemodynamicsSecondCase(spec.id)!.caseId] : []),
    ])
    expect([...placed].sort()).toEqual(hemodynamicCases.map((definition) => definition.id).sort())
  })
  it('refuses a case placed in two sections, and a section too short to hold its case', () => {
    const [orientation, pressure, waveform, ...rest] = hemodynamicsSectionSpecs
    expect(
      validateHemodynamicsSectionSpecs([
        orientation,
        pressure,
        { ...waveform, practicePairing: { kind: 'mechanism-match', caseId: 'HD-08' } },
        ...rest,
      ]),
    ).toContain('Case HD-08 is placed in more than one section.')
    expect(
      validateHemodynamicsSectionSpecs([
        orientation,
        pressure,
        { ...waveform, practicePairing: { kind: 'mechanism-match', caseId: 'HD-99' } },
        ...rest,
      ]),
    ).toContain('Section waveform-interpretation pairs to an unknown case HD-99.')
  })
  it('gives every case an honest length', () => {
    for (const definition of hemodynamicCases) {
      expect(definition.minutes).toBeGreaterThanOrEqual(5)
      expect(definition.minutes).toBeLessThanOrEqual(20)
    }
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
