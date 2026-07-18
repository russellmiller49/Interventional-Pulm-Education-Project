import {
  getCrrtDeviceCalculationAdapter,
  prismaxCalculationAdapter,
} from '../deviceAdapters/calculations'
import {
  calculatePrismaflexDoseSectionEffluentFlowMlPerHour,
  calculatePrismaflexEffluentPumpTargetMlPerHour,
  prismaflexCalculationAdapter,
} from '../deviceAdapters/prismaflexCalculations'
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

describe('v1 device-calculation adapter boundary', () => {
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

  it('keeps Prismaflex pump-target and dose-section Qeff definitions separate', () => {
    const prismaflexFlows: CrrtFlowRates = { ...flows, makeupFlowMlHour: 0 }

    expect(calculatePrismaflexEffluentPumpTargetMlPerHour(prismaflexFlows)).toBe(2_110)
    expect(calculatePrismaflexDoseSectionEffluentFlowMlPerHour(prismaflexFlows)).toBe(2_100)
    expect(
      prismaflexCalculationAdapter.calculateDoseSectionEffluentDoseMlPerKgHour(prismaflexFlows, 70),
    ).toBe(30)
    expect(prismaflexCalculationAdapter.unresolvedConflictIds).toEqual(['CONFLICT-010'])
    expect(prismaflexCalculationAdapter.sourceIds).toEqual({
      effluentPumpTarget: ['DEV-PF-006'],
      doseSectionEffluentFlow: ['DEV-PF-006'],
      effluentDose: ['DEV-PF-006'],
      transmembranePressure: ['DEV-PF-006'],
      filterPressureDrop: ['DEV-PF-005'],
    })
    expect(Object.isFrozen(prismaflexCalculationAdapter)).toBe(true)
    expect(Object.isFrozen(prismaflexCalculationAdapter.sourceIds)).toBe(true)
  })

  it('implements Prismaflex pressure displays independently and rejects unsourced makeup flow', () => {
    expect(
      prismaflexCalculationAdapter.calculateDisplayedPressures({
        rawFilterPressureMmHg: 150,
        rawReturnPressureMmHg: 90,
        rawEffluentPressureMmHg: -20,
      }),
    ).toEqual({
      transmembranePressureMmHg: 122,
      rawFilterPressureDropMmHg: 60,
      displayedFilterPressureDropMmHg: 35,
    })

    expect(() => calculatePrismaflexEffluentPumpTargetMlPerHour(flows)).toThrow(/makeup-flow/i)
    expect(() =>
      calculatePrismaflexDoseSectionEffluentFlowMlPerHour({
        ...flows,
        makeupFlowMlHour: 0,
        dialysateFlowMlHour: -1,
      }),
    ).toThrow(/zero or greater/i)
  })

  it('registers the operational Prismaflex adapter without falling back to PrisMax math', () => {
    expect(getCrrtDeviceCalculationAdapter('prismaflex-g5036003-6xx')).toBe(
      prismaflexCalculationAdapter,
    )
    expect(getCrrtDeviceCalculationAdapter('prismaflex-g5036003-6xx')).not.toBe(
      prismaxCalculationAdapter,
    )
  })
})
