import { predictDrainageCurve } from '../engine/manometry'
import { classifyBleedingRisk, intercostalVesselRisk } from '../engine/safety'

describe('thoracentesis planner engines', () => {
  it('classifies elevated bleeding risk from active anticoagulation', () => {
    expect(
      classifyBleedingRisk({
        inr: 1.2,
        platelets: 150000,
        antiplatelet: 'none',
        anticoagulant: 'active',
      }).level,
    ).toBe('elevated')
  })

  it('flags high risk for very low platelets or INR 3 or higher', () => {
    expect(
      classifyBleedingRisk({
        inr: 3,
        platelets: 150000,
        antiplatelet: 'none',
        anticoagulant: 'none',
      }).level,
    ).toBe('high')
    expect(
      classifyBleedingRisk({
        inr: 1.1,
        platelets: 20000,
        antiplatelet: 'none',
        anticoagulant: 'none',
      }).level,
    ).toBe('high')
  })

  it('models posterior medial entry as higher vessel risk', () => {
    expect(intercostalVesselRisk('posterior-medial').level).toBe('higher')
    expect(intercostalVesselRisk('lateral-safe').level).toBe('lower')
  })

  it('models trapped lung as symptomatic at small drainage volumes', () => {
    const trapped = predictDrainageCurve('trapped', 100)

    expect(trapped.pressureCmH2O).toBeLessThan(-5)
    expect(trapped.symptomTriggers).toContain('chestPressure')
  })
})
