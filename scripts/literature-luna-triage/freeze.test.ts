/** @jest-environment node */
import {
  FreezeDriftError,
  assertFreezeReceiptCurrent,
  buildFreezeReceipt,
  outputSchemaSha256,
  reasonVocabularySha256,
  type FreezeInputs,
} from './freeze'

const INPUTS: FreezeInputs = {
  calibrationVersion: 'cal-v1',
  model: 'gpt-5.6-luna',
  modelAlias: 'gpt-5.6-luna-2026-08-01',
  reasoningEffort: 'low',
  promptText: 'PROMPT TEXT',
  splitManifestSha256: 'f'.repeat(64),
}

describe('freeze receipts', () => {
  it('pins every frozen surface and self-checksums', () => {
    const receipt = buildFreezeReceipt(INPUTS, '2026-08-17T00:00:00.000Z')
    expect(receipt.promptSha256).toMatch(/^[0-9a-f]{64}$/u)
    expect(receipt.outputSchemaSha256).toBe(outputSchemaSha256())
    expect(receipt.reasonVocabularySha256).toBe(reasonVocabularySha256())
    expect(receipt.splitManifestSha256).toBe(INPUTS.splitManifestSha256)
    expect(receipt.receiptSha256).toMatch(/^[0-9a-f]{64}$/u)
    expect(receipt.model).toBe('gpt-5.6-luna')
    expect(receipt.modelAlias).toBe('gpt-5.6-luna-2026-08-01')
    expect(receipt.reasoningEffort).toBe('low')
  })

  it('is deterministic for identical inputs and timestamps', () => {
    const first = buildFreezeReceipt(INPUTS, '2026-08-17T00:00:00.000Z')
    const second = buildFreezeReceipt(INPUTS, '2026-08-17T00:00:00.000Z')
    expect(second).toEqual(first)
  })

  it('rejects malformed calibration versions', () => {
    expect(() =>
      buildFreezeReceipt({ ...INPUTS, calibrationVersion: 'Bad Version!' }, 'now'),
    ).toThrow(/lowercase identifier/u)
  })

  it('verifies an untouched surface and names every drifted field', () => {
    const receipt = buildFreezeReceipt(INPUTS, '2026-08-17T00:00:00.000Z')
    expect(() => assertFreezeReceiptCurrent(receipt, INPUTS)).not.toThrow()
    expect(() => assertFreezeReceiptCurrent(receipt, { ...INPUTS, model: 'other-model' })).toThrow(
      FreezeDriftError,
    )
    expect(() =>
      assertFreezeReceiptCurrent(receipt, { ...INPUTS, promptText: 'EDITED PROMPT' }),
    ).toThrow(/promptSha256/u)
    expect(() =>
      assertFreezeReceiptCurrent(receipt, { ...INPUTS, reasoningEffort: 'high' }),
    ).toThrow(/reasoningEffort/u)
    expect(() =>
      assertFreezeReceiptCurrent(receipt, {
        ...INPUTS,
        splitManifestSha256: 'e'.repeat(64),
      }),
    ).toThrow(/splitManifestSha256/u)
  })

  it('detects a tampered receipt via its own checksum', () => {
    const receipt = buildFreezeReceipt(INPUTS, '2026-08-17T00:00:00.000Z')
    const tampered = {
      ...receipt,
      model: 'gpt-5.6-luna',
      createdAt: receipt.createdAt,
      receiptSha256: 'a'.repeat(64),
    }
    expect(() => assertFreezeReceiptCurrent(tampered, INPUTS)).toThrow(FreezeDriftError)
  })
})
