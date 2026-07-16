import { advanceSolutePool, calculateDeliveredSoluteClearanceMlMin } from '../soluteModel'
import type { SolutePoolState } from '../types'

const pool: SolutePoolState = {
  id: 'potassium',
  amountUnit: 'mmol',
  concentrationUnit: 'mmol/L',
  concentrationPerLiter: 5,
  distributionVolumeLiters: 40,
  productionAmountPerHour: 1,
  inputAmountPerHour: 0,
  residualClearanceMlMin: 1,
  filterPermeabilityFraction: 1,
  reviewStatus: 'pending',
  sourceIds: ['TEST-P2-001'],
}

describe('CRRT transparent solute mass balance', () => {
  it('conserves mass aside from explicit source and removal terms', () => {
    const result = advanceSolutePool(pool, 20, 3600)
    expect(
      result.startingAmount + result.producedOrInfusedAmount - result.removedAmount,
    ).toBeCloseTo(result.endingAmount, 10)
    expect(result.pool.concentrationPerLiter).toBeGreaterThanOrEqual(0)
  })

  it('conserves exactly when all sources and clearances are zero', () => {
    const isolated = {
      ...pool,
      productionAmountPerHour: 0,
      residualClearanceMlMin: 0,
    }
    const result = advanceSolutePool(isolated, 0, 6 * 3600)
    expect(result.endingAmount).toBe(result.startingAmount)
    expect(result.removedAmount).toBe(0)
  })

  it('increases delivered clearance with actual effluent and lowers concentration directionally', () => {
    const lowClearance = calculateDeliveredSoluteClearanceMlMin(600, 1, 1)
    const highClearance = calculateDeliveredSoluteClearanceMlMin(1_200, 1, 1)
    expect(highClearance).toBeGreaterThan(lowClearance)
    expect(advanceSolutePool(pool, highClearance, 3600).pool.concentrationPerLiter).toBeLessThan(
      advanceSolutePool(pool, lowClearance, 3600).pool.concentrationPerLiter,
    )
  })

  it('produces equivalent one-hour results from one or sixty analytical advances', () => {
    const clearance = 20
    const single = advanceSolutePool(pool, clearance, 3600).pool
    let stepped = pool
    for (let index = 0; index < 60; index += 1) {
      stepped = advanceSolutePool(stepped, clearance, 60).pool
    }
    expect(stepped.concentrationPerLiter).toBeCloseTo(single.concentrationPerLiter, 10)
  })

  it('rejects invalid volume, concentration, permeability, and duration', () => {
    expect(() => advanceSolutePool({ ...pool, distributionVolumeLiters: 0 }, 0, 1)).toThrow(
      /positive/i,
    )
    expect(() => advanceSolutePool({ ...pool, concentrationPerLiter: -1 }, 0, 1)).toThrow()
    expect(() => calculateDeliveredSoluteClearanceMlMin(1, 1.1, 1)).toThrow(/exceed/i)
    expect(() => advanceSolutePool(pool, 0, -1)).toThrow(/nonnegative/i)
  })
})
