/** @jest-environment node */
import type { UniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import { estimateCohortCost } from './estimate'
import { reconcileRequestBodyText } from './reconcile'
import { prepareRequestSet } from './runner'

function packet(recordId: string, title: string): UniversalPacket {
  return {
    record_id: recordId,
    title,
    abstract: null,
    journal: null,
    publication_year: null,
    publication_types: [],
    mesh_terms: [],
    keywords: [],
    language: null,
    evidence_profile: 'metadata_without_abstract',
  }
}

const PARAMS = {
  model: 'gpt-5.6-luna',
  reasoningEffort: 'low',
  instructions: 'INSTRUCTIONS',
  promptSha256: 'a'.repeat(64),
} as const

const ID_A = 'a'.repeat(64)
const ID_B = 'b'.repeat(64)

describe('deterministic request preparation', () => {
  it('orders by record id and yields a stable manifest hash', () => {
    const packets = [packet(ID_B, 'Second'), packet(ID_A, 'First')]
    const first = prepareRequestSet(packets, PARAMS)
    const second = prepareRequestSet([...packets].reverse(), PARAMS)
    expect(first.requests.map((request) => request.customId)).toEqual([ID_A, ID_B])
    expect(second.manifest.requestSetSha256).toBe(first.manifest.requestSetSha256)
    expect(first.manifest.requestCount).toBe(2)
    expect(first.manifest.promptSha256).toBe(PARAMS.promptSha256)
  })

  it('changes the manifest hash when the prompt, model, or packet changes', () => {
    const base = prepareRequestSet([packet(ID_A, 'Title')], PARAMS)
    const prompt = prepareRequestSet([packet(ID_A, 'Title')], {
      ...PARAMS,
      instructions: 'OTHER',
    })
    const model = prepareRequestSet([packet(ID_A, 'Title')], { ...PARAMS, model: 'gpt-x' })
    const content = prepareRequestSet([packet(ID_A, 'Other title')], PARAMS)
    expect(prompt.manifest.requestSetSha256).not.toBe(base.manifest.requestSetSha256)
    expect(model.manifest.requestSetSha256).not.toBe(base.manifest.requestSetSha256)
    expect(content.manifest.requestSetSha256).not.toBe(base.manifest.requestSetSha256)
  })

  it('refuses duplicate record ids', () => {
    expect(() => prepareRequestSet([packet(ID_A, 'One'), packet(ID_A, 'Two')], PARAMS)).toThrow(
      /Duplicate record ids/u,
    )
  })

  it('reproduces byte-identical prepared bytes across independent preparations', () => {
    const first = prepareRequestSet([packet(ID_A, 'Title'), packet(ID_B, 'Other')], PARAMS)
    const second = prepareRequestSet([packet(ID_A, 'Title'), packet(ID_B, 'Other')], PARAMS)
    expect(second.requests.map((request) => request.bodyText)).toEqual(
      first.requests.map((request) => request.bodyText),
    )
  })
})

describe('estimates reconcile to the prepared bytes', () => {
  it('recovers each request identity and token contribution from its own bytes', () => {
    const prepared = prepareRequestSet([packet(ID_A, 'Title'), packet(ID_B, 'Other')], PARAMS)
    for (const request of prepared.requests) {
      const reconciliation = reconcileRequestBodyText(request.bodyText)
      expect(reconciliation.recordId).toBe(request.customId)
      expect(reconciliation.bodySha256).toBe(request.bodySha256)
      expect(reconciliation.inputTokens).toBe(request.estimate.inputTokens)
      expect(reconciliation.outputTokenAllowance).toBe(request.estimate.outputTokenAllowance)
    }
  })

  it('reconciles the cohort estimate against the sum recovered from the bytes', () => {
    const prepared = prepareRequestSet([packet(ID_A, 'Title'), packet(ID_B, 'Other')], PARAMS)
    const estimate = estimateCohortCost(
      prepared.requests.map((request) => request.estimate),
      { batch: false },
    )
    const fromBytes = prepared.requests
      .map((request) => reconcileRequestBodyText(request.bodyText))
      .reduce(
        (sum, row) => ({
          inputTokens: sum.inputTokens + row.inputTokens,
          outputTokenAllowance: sum.outputTokenAllowance + row.outputTokenAllowance,
        }),
        { inputTokens: 0, outputTokenAllowance: 0 },
      )
    expect(fromBytes.inputTokens).toBe(estimate.inputTokens)
    expect(fromBytes.outputTokenAllowance).toBe(estimate.outputTokenAllowance)
    expect(estimate.inputTokens).toBe(prepared.manifest.totalEstimatedInputTokens)
    expect(estimate.outputTokenAllowance).toBe(prepared.manifest.totalEstimatedOutputTokenAllowance)
  })
})
