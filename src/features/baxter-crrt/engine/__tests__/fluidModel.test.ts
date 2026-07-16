import {
  advanceBag,
  advanceFluidLedger,
  calculateWholePatientNetBalanceMl,
  emptyFluidLedgerTotals,
  replaceBag,
} from '../fluidModel'
import type { BagState } from '../types'
import { syntheticExternalFluidRates } from '../testSupport/syntheticFixture'

function sourceBag(): BagState {
  return {
    id: 'synthetic-dialysate',
    label: 'Synthetic source bag',
    flowTerm: 'dialysate',
    direction: 'source',
    capacityMl: 1_000,
    calculatedVolumeMl: 1_000,
    measuredVolumeMl: 1_000,
    cumulativePumpVolumeMl: 0,
    connected: true,
    scaleOpen: false,
    externalInterferenceMl: 0,
    reviewStatus: 'pending',
    sourceIds: ['TEST-P2-001'],
  }
}

describe('CRRT fluid accounting and bag conservation', () => {
  it('keeps machine PFR separate from whole-patient balance', () => {
    const totals = advanceFluidLedger(
      emptyFluidLedgerTotals,
      syntheticExternalFluidRates,
      100,
      0,
      3600,
    )
    expect(totals.machinePatientFluidRemovalMl).toBe(100)
    expect(calculateWholePatientNetBalanceMl(totals)).toBe(0)

    const positiveDespiteRemoval = advanceFluidLedger(
      emptyFluidLedgerTotals,
      syntheticExternalFluidRates,
      50,
      0,
      3600,
    )
    expect(positiveDespiteRemoval.machinePatientFluidRemovalMl).toBe(50)
    expect(calculateWholePatientNetBalanceMl(positiveDespiteRemoval)).toBe(50)
  })

  it('integrates unintended device gain as its own signed term', () => {
    const gain = advanceFluidLedger(
      emptyFluidLedgerTotals,
      {
        ...syntheticExternalFluidRates,
        maintenanceInputMlHour: 0,
        medicationCarrierInputMlHour: 0,
        nutritionInputMlHour: 0,
        urineOutputMlHour: 0,
        drainOutputMlHour: 0,
      },
      0,
      25,
      7200,
    )
    expect(gain.unintendedDeviceNetGainMl).toBe(50)
    expect(calculateWholePatientNetBalanceMl(gain)).toBe(50)
  })

  it('conserves source-bag volume, pauses cleanly, and preserves cumulative flow on replacement', () => {
    const first = advanceBag(sourceBag(), 200, 3600, true)
    expect(first).toMatchObject({ requestedPumpVolumeMl: 200, actualPumpVolumeMl: 200 })
    expect(first.bag.calculatedVolumeMl).toBe(800)
    expect(first.bag.measuredVolumeMl).toBe(800)
    expect(first.bag.cumulativePumpVolumeMl).toBe(200)

    const paused = advanceBag(first.bag, 200, 3600, false)
    expect(paused.actualPumpVolumeMl).toBe(0)
    expect(paused.bag).toEqual(first.bag)

    const replaced = replaceBag(paused.bag, 1_000)
    expect(replaced.calculatedVolumeMl).toBe(1_000)
    expect(replaced.cumulativePumpVolumeMl).toBe(200)
  })

  it('limits bag movement at physical volume bounds without creating negative volume', () => {
    const nearlyEmpty = { ...sourceBag(), calculatedVolumeMl: 25, measuredVolumeMl: 25 }
    const result = advanceBag(nearlyEmpty, 100, 3600, true)
    expect(result.actualPumpVolumeMl).toBe(25)
    expect(result.limited).toBe(true)
    expect(result.bag.calculatedVolumeMl).toBe(0)
    expect(result.bag.cumulativePumpVolumeMl).toBe(25)
  })

  it('rejects nonfinite, negative, and over-capacity values', () => {
    expect(() => advanceBag(sourceBag(), Number.NaN, 1, true)).toThrow()
    expect(() => advanceBag(sourceBag(), -1, 1, true)).toThrow()
    expect(() => replaceBag(sourceBag(), 1_001)).toThrow(/capacity/i)
  })
})
