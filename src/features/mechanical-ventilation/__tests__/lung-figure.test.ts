import {
  LUNG_FIGURE_FULL_EFFORT_CMH2O,
  LUNG_FIGURE_FULL_SCALE_ML,
  LUNG_FIGURE_FULL_TRAPPING_CMH2O,
  lungFigureModel,
  type BreathCursorReading,
} from '../content/lungFigure'

/**
 * The drawing of the lungs beside the console is one function of one cursor reading. These tests
 * hold what it may say: only what the read-out under the traces says for the same instant.
 */
const reading = (over: Partial<BreathCursorReading> = {}): BreathCursorReading => ({
  flowLMin: 40,
  volumeMl: 200,
  anchored: true,
  pmusCmH2O: 0,
  phase: 'inspiration',
  ...over,
})

describe('what the lung figure draws from a cursor reading', () => {
  it('says which way gas is moving, and nothing when the read-out prints 0.0', () => {
    expect(lungFigureModel(reading(), { effortShown: false }).flow).toBe('in')
    expect(lungFigureModel(reading({ flowLMin: -31.4 }), { effortShown: false }).flow).toBe('out')
    // The read-out prints flow to one decimal: ±0.04 is printed 0.0 and drawn as no flow.
    for (const flowLMin of [0, 0.04, -0.04]) {
      const model = lungFigureModel(reading({ flowLMin }), { effortShown: false })
      expect(model.flow).toBe('none')
      expect(model.lines[0]).toBe('No gas flowing')
    }
    expect(lungFigureModel(reading({ flowLMin: 0.06 }), { effortShown: false }).flow).toBe('in')
  })

  it('names the volume by the trace’s own origin', () => {
    expect(lungFigureModel(reading(), { effortShown: false }).lines[1]).toBe(
      '200 mL · from first inspiratory sample',
    )
    expect(
      lungFigureModel(reading({ anchored: false, volumeMl: 512.4 }), { effortShown: false })
        .lines[1],
    ).toBe('512 mL · above the trace baseline')
  })

  it('draws a larger breath larger, on one fixed scale', () => {
    const at = (volumeMl: number) =>
      lungFigureModel(reading({ volumeMl }), { effortShown: false }).inflation
    expect(at(420)).toBeLessThan(at(600))
    expect(at(0)).toBe(0)
    expect(at(-13)).toBe(0)
    expect(at(LUNG_FIGURE_FULL_SCALE_ML)).toBe(1)
    expect(at(LUNG_FIGURE_FULL_SCALE_ML * 2)).toBe(1)
  })

  it('says nothing about effort on a step that does not show the effort trace', () => {
    const model = lungFigureModel(reading({ pmusCmH2O: -8 }), { effortShown: false })
    expect(model.effort).toBeNull()
    expect(model.lines.join(' ')).not.toMatch(/effort|machine/i)
  })

  it('states effort and the machine’s phase where the effort trace is shown', () => {
    const quiet = lungFigureModel(reading({ phase: 'expiration' }), { effortShown: true })
    expect(quiet.effort).toBe(0)
    expect(quiet.lines).toContain('No patient effort · machine expiration')
    const pulling = lungFigureModel(reading({ pmusCmH2O: -2.8 }), { effortShown: true })
    expect(pulling.lines).toContain('Patient effort 2.8 cmH₂O · machine inspiration')
    expect(pulling.effort).toBeCloseTo(2.8 / LUNG_FIGURE_FULL_EFFORT_CMH2O)
    expect(lungFigureModel(reading({ pmusCmH2O: -40 }), { effortShown: true }).effort).toBe(1)
  })

  it('draws the patient’s properties only for the sliders the step offers', () => {
    const mechanics = { resistanceScale: 2, complianceScale: 0.5 }
    const none = lungFigureModel(reading(), { effortShown: true })
    expect([none.airway, none.stiffness]).toEqual([null, null])
    // Given the multipliers but no slider for them: still nothing.
    const unoffered = lungFigureModel(reading(), { effortShown: true, mechanics })
    expect([unoffered.airway, unoffered.stiffness]).toEqual([null, null])
    expect(unoffered.lines.join(' ')).not.toMatch(/resistance|compliance/i)

    const airway = lungFigureModel(reading(), {
      effortShown: true,
      mechanics,
      mechanicsKeys: ['resistanceScale'],
    })
    expect(airway.lines).toContain('Patient resistance 2.00×')
    expect(airway.stiffness).toBeNull()
    // A tube's resistance goes with the fourth power of its radius.
    expect(airway.airway).toBeCloseTo(Math.pow(0.5, 0.25))

    const lung = lungFigureModel(reading(), {
      effortShown: false,
      mechanics,
      mechanicsKeys: ['complianceScale'],
    })
    expect(lung.lines).toContain('Patient compliance 0.50×')
    expect(lung.airway).toBeNull()
    expect(lung.stiffness).toBe(0.5)
  })

  it('draws no trapped gas unless it is handed the intrinsic PEEP reading', () => {
    const plain = lungFigureModel(reading(), { effortShown: true })
    expect(plain.trapped).toBeNull()
    expect(plain.lines.join(' ')).not.toMatch(/PEEP|trapped/i)
    expect(
      lungFigureModel(reading(), { effortShown: true, intrinsicPeepCmH2O: null }).trapped,
    ).toBe(null)
  })

  it('draws trapped gas from the intrinsic PEEP reading, in the reading’s own words', () => {
    const model = lungFigureModel(reading(), { effortShown: false, intrinsicPeepCmH2O: 8.94 })
    // The tile beside it reads "Intrinsic PEEP · model estimate — 8.9 cmH₂O".
    expect(model.lines.at(-1)).toBe('Intrinsic PEEP 8.9 cmH₂O · model estimate')
    expect(model.trapped).toBeCloseTo(8.94 / LUNG_FIGURE_FULL_TRAPPING_CMH2O)
    // A reading printed as 0.0 is drawn as none, and still stated.
    const none = lungFigureModel(reading(), { effortShown: false, intrinsicPeepCmH2O: 0.04 })
    expect(none.trapped).toBe(0)
    expect(none.lines.at(-1)).toBe('Intrinsic PEEP 0.0 cmH₂O · model estimate')
    expect(lungFigureModel(reading(), { effortShown: false, intrinsicPeepCmH2O: 40 }).trapped).toBe(
      1,
    )
  })

  it('draws this patient’s own lungs as neither narrowed nor stiff', () => {
    const model = lungFigureModel(reading(), {
      effortShown: false,
      mechanics: { resistanceScale: 1, complianceScale: 1 },
      mechanicsKeys: ['resistanceScale', 'complianceScale'],
    })
    expect(model.airway).toBe(1)
    expect(model.stiffness).toBe(0)
  })
})
