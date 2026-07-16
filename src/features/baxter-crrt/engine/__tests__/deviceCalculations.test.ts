import {
  getCrrtDeviceCalculationAdapter,
  prismaxCalculationAdapter,
} from '../deviceAdapters/calculations'
import type { CrrtFlowRates } from '../types'

const flows: CrrtFlowRates = {
  bloodFlowMlMin: 200,
  dialysateFlowMlHour: 1_000,
  pbpFlowMlHour: 200,
  preReplacementFlowMlHour: 300,
  postReplacementFlowMlHour: 500,
  patientFluidRemovalMlHour: 100,
  syringeFlowMlHour: 10,
  makeupFlowMlHour: 20,
}

describe('Phase 2 device-calculation adapter boundary', () => {
  it('maps canonical flows to the source-backed PrisMax Qeff calculation', () => {
    const adapter = getCrrtDeviceCalculationAdapter('prismax-aw8035-2xx')

    expect(adapter).toBe(prismaxCalculationAdapter)
    expect(adapter.calculateEffluentPumpTargetMlPerHour(flows)).toBe(2_130)
    expect(adapter.calculateEffluentDoseMlPerKgHour(2_100, 70)).toBe(30)
    expect(adapter.sourceIds).toEqual({
      effluentPumpTarget: ['MATH-PM-001'],
      effluentDose: ['DOSE-PM-001'],
      transmembranePressure: ['MATH-PM-002'],
      filterPressureDrop: ['DEV-PM-010'],
    })
  })

  it('returns both source-mapped PrisMax pressure displays from raw pressures', () => {
    expect(
      prismaxCalculationAdapter.calculateDisplayedPressures({
        rawFilterPressureMmHg: 150,
        rawReturnPressureMmHg: 90,
        rawEffluentPressureMmHg: -20,
      }),
    ).toEqual({
      transmembranePressureMmHg: 122,
      rawFilterPressureDropMmHg: 60,
      displayedFilterPressureDropMmHg: 35,
    })
  })

  it('fails closed instead of applying PrisMax math to deferred Prismaflex', () => {
    expect(() => getCrrtDeviceCalculationAdapter('prismaflex-g5036003-6xx')).toThrow(/deferred/i)
  })
})
