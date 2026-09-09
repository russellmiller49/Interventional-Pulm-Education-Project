/** @jest-environment node */
import {
  CostCeilingError,
  RecordCeilingError,
  assertWithinCostCeiling,
  assertWithinRecordCeiling,
  estimateCohortCost,
  estimateRequestTokens,
  estimateTextTokens,
} from './estimate'

describe('deterministic token estimation', () => {
  it('estimates from character counts with fixed overheads', () => {
    expect(estimateTextTokens('abcd')).toBe(1)
    expect(estimateTextTokens('a'.repeat(400))).toBe(100)
    const request = estimateRequestTokens('i'.repeat(400), 'p'.repeat(400), 'low')
    expect(request.inputTokens).toBe(100 + 100 + 48)
    expect(request.outputTokenAllowance).toBe(96 + 256)
  })

  it('scales the output allowance with reasoning effort', () => {
    const low = estimateRequestTokens('i', 'p', 'low')
    const high = estimateRequestTokens('i', 'p', 'high')
    expect(high.outputTokenAllowance).toBeGreaterThan(low.outputTokenAllowance)
  })
})

describe('cohort cost estimation', () => {
  const requests = [
    { inputTokens: 1_000_000, outputTokenAllowance: 100_000 },
    { inputTokens: 1_000_000, outputTokenAllowance: 100_000 },
  ]

  it('prices input and output separately and marks the estimate as assumed', () => {
    const estimate = estimateCohortCost(requests, { batch: false })
    expect(estimate.records).toBe(2)
    expect(estimate.inputTokens).toBe(2_000_000)
    expect(estimate.estimatedCostUsd).toBeCloseTo(2 * 1.25 + 0.2 * 10, 6)
    expect(estimate.pricingAssumed).toBe(true)
  })

  it('applies the batch discount only when asked', () => {
    const sync = estimateCohortCost(requests, { batch: false })
    const batch = estimateCohortCost(requests, { batch: true })
    expect(batch.estimatedCostUsd).toBeCloseTo(sync.estimatedCostUsd / 2, 6)
    expect(batch.batchDiscountApplied).toBe(true)
  })
})

describe('spend ceilings', () => {
  it('refuses when the estimate exceeds the authorized ceiling', () => {
    const estimate = estimateCohortCost([{ inputTokens: 10_000_000, outputTokenAllowance: 0 }], {
      batch: false,
    })
    expect(() => assertWithinCostCeiling(estimate, 1)).toThrow(CostCeilingError)
    expect(() => assertWithinCostCeiling(estimate, 100)).not.toThrow()
  })

  it('refuses non-positive or non-finite ceilings', () => {
    const estimate = estimateCohortCost([], { batch: false })
    expect(() => assertWithinCostCeiling(estimate, 0)).toThrow(CostCeilingError)
    expect(() => assertWithinCostCeiling(estimate, Number.NaN)).toThrow(CostCeilingError)
  })

  it('refuses cohorts above --max-records before anything is sent', () => {
    expect(() => assertWithinRecordCeiling(31, 30)).toThrow(RecordCeilingError)
    expect(() => assertWithinRecordCeiling(30, 30)).not.toThrow()
    expect(() => assertWithinRecordCeiling(1, 0)).toThrow(RecordCeilingError)
    expect(() => assertWithinRecordCeiling(1, 1.5)).toThrow(RecordCeilingError)
  })
})
