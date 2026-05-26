import { pleuralFluidCases } from '../content/cases'
import { scoreDifferential } from '../engine/differential'
import { evaluateLightsCriteria, interpretPleuralFluid } from '../engine/interpretation'

const getCase = (id: string) => {
  const clinicalCase = pleuralFluidCases.find((item) => item.id === id)

  if (!clinicalCase) {
    throw new Error(`Missing test case ${id}`)
  }

  return clinicalCase
}

describe('pleural fluid analysis interpretation', () => {
  it('classifies positive Light criteria and then recognizes a CHF pseudoexudate', () => {
    const interpretation = interpretPleuralFluid(getCase('diuresed-heart-failure').input)

    expect(interpretation.lightCriteria.classification).toBe('exudate')
    expect(interpretation.reconciledCategory).toBe('transudate')
    expect(interpretation.pseudoexudateReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('albumin gradient'),
        expect.stringContaining('NT-proBNP'),
      ]),
    )
  })

  it('marks pleural infection signals when pneumonia context has low pH and high LDH', () => {
    const interpretation = interpretPleuralFluid(getCase('septated-pneumonia').input)

    expect(interpretation.lightCriteria.classification).toBe('exudate')
    expect(interpretation.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          diagnosis: 'Complicated parapneumonic effusion',
          strength: 'highly suggestive',
        }),
      ]),
    )
  })

  it('uses lymphocyte predominance, ADA, and exposure context to support TB', () => {
    const interpretation = interpretPleuralFluid(getCase('lymphocytic-tb-risk').input)

    expect(interpretation.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          diagnosis: 'Tuberculous pleural effusion',
          strength: 'highly suggestive',
        }),
      ]),
    )
  })

  it('keeps malignancy active even when the chemistry is transudative', () => {
    const interpretation = interpretPleuralFluid(getCase('malignancy-transudate-trap').input)

    expect(interpretation.lightCriteria.classification).toBe('transudate')
    expect(interpretation.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          diagnosis: 'Malignancy remains in play',
        }),
      ]),
    )
    expect(interpretation.reconciliation).toContain('chemistry looks transudative')
  })

  it('prompts tissue escalation after two negative cytology samples when malignancy remains likely', () => {
    const interpretation = interpretPleuralFluid({
      ...getCase('malignancy-transudate-trap').input,
      negativeCytologyCount: 2,
      cytologyPositive: false,
    })

    expect(interpretation.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          diagnosis: 'Repeated negative cytology',
          strength: 'pitfall',
        }),
      ]),
    )
    expect(interpretation.nextActions[0]).toContain('Stop fluid-only cycling')
  })

  it('detects chylothorax from triglycerides', () => {
    const interpretation = interpretPleuralFluid(getCase('milky-lymphatic').input)

    expect(interpretation.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          diagnosis: 'Chylothorax',
          strength: 'definitive',
        }),
      ]),
    )
  })

  it('ranks CHF pseudoexudate highly when gradients and NT-proBNP fit', () => {
    const differential = scoreDifferential(getCase('diuresed-heart-failure').input, {
      contextEmphasis: 75,
      raritySensitivity: 35,
      maxResults: 5,
    })

    expect(differential.visibleResults[0]?.disease.id).toBe('congestive-heart-failure')
  })

  it('keeps yellow nail syndrome visible for lymphatic cases when rare disease sensitivity is enabled', () => {
    const differential = scoreDifferential(getCase('milky-lymphatic').input, {
      contextEmphasis: 80,
      raritySensitivity: 90,
      maxResults: 8,
    })

    expect(differential.visibleResults.map((result) => result.disease.id)).toContain(
      'yellow-nail-syndrome',
    )
  })

  it('expands the visible differential when context emphasis is low', () => {
    const broad = scoreDifferential(getCase('lymphocytic-tb-risk').input, {
      contextEmphasis: 10,
      raritySensitivity: 70,
    })
    const narrow = scoreDifferential(getCase('lymphocytic-tb-risk').input, {
      contextEmphasis: 95,
      raritySensitivity: 70,
    })

    expect(broad.visibleResults.length).toBeGreaterThan(narrow.visibleResults.length)
  })

  it('evaluates Light criteria thresholds directly', () => {
    const result = evaluateLightsCriteria({
      ...getCase('diuresed-heart-failure').input,
      pleuralProtein: 2,
      serumProtein: 6,
      pleuralLdh: 80,
      serumLdh: 200,
      serumLdhUpperLimit: 210,
    })

    expect(result.classification).toBe('transudate')
    expect(result.positiveCriteria).toHaveLength(0)
  })
})
