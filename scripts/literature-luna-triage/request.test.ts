/** @jest-environment node */
import type { UniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import {
  assertSafeShardFilename,
  buildStageAJsonSchema,
  buildStageARequestBody,
  requestBodySha256,
  requestBodyText,
} from './request'

/**
 * The offline request surface: deterministic bytes, a strict closed schema, and a digest that
 * is taken over exactly the bytes that were built. Nothing here reaches a network.
 */

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

const PARAMETERS = {
  model: 'gpt-5.6-luna',
  reasoning: 'low',
  instructions: 'INSTRUCTIONS',
} as const

describe('the structured-output schema', () => {
  it('stays strict and closed', () => {
    const schema = buildStageAJsonSchema()
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual([
      'record_id',
      'triage_decision',
      'confidence_band',
      'reason_codes',
    ])
  })

  it('enumerates the contract vocabularies rather than accepting free text', () => {
    const properties = buildStageAJsonSchema().properties as Record<
      string,
      { enum?: readonly string[]; items?: { enum?: readonly string[] } }
    >
    expect(properties.triage_decision.enum?.length).toBeGreaterThan(0)
    expect(properties.confidence_band.enum?.length).toBeGreaterThan(0)
    expect(properties.reason_codes.items?.enum?.length).toBeGreaterThan(0)
  })
})

describe('deterministic request bodies', () => {
  it('builds byte-identical bodies for identical inputs', () => {
    const first = buildStageARequestBody(packet('a'.repeat(64), 'Title'), PARAMETERS)
    const second = buildStageARequestBody(packet('a'.repeat(64), 'Title'), PARAMETERS)
    expect(requestBodyText(first)).toBe(requestBodyText(second))
    expect(requestBodySha256(first)).toBe(requestBodySha256(second))
  })

  it('sends no tools, stores nothing, and carries the packet verbatim', () => {
    const item = packet('b'.repeat(64), 'Pleural effusion')
    const body = buildStageARequestBody(item, PARAMETERS)
    expect(body.tools).toEqual([])
    expect(body.store).toBe(false)
    const input = body.input as readonly {
      content: readonly { type: string; text: string }[]
    }[]
    expect(input[0].content[0].text).toBe(canonicalJson(item))
  })

  it('changes the digest when the packet, model, effort, or instructions change', () => {
    const base = requestBodySha256(
      buildStageARequestBody(packet('c'.repeat(64), 'One'), PARAMETERS),
    )
    const digests = [
      requestBodySha256(buildStageARequestBody(packet('c'.repeat(64), 'Two'), PARAMETERS)),
      requestBodySha256(
        buildStageARequestBody(packet('c'.repeat(64), 'One'), { ...PARAMETERS, model: 'other' }),
      ),
      requestBodySha256(
        buildStageARequestBody(packet('c'.repeat(64), 'One'), { ...PARAMETERS, reasoning: 'high' }),
      ),
      requestBodySha256(
        buildStageARequestBody(packet('c'.repeat(64), 'One'), { ...PARAMETERS, instructions: 'X' }),
      ),
    ]
    for (const digest of digests) expect(digest).not.toBe(base)
  })

  it('takes the digest over exactly the prepared bytes', () => {
    const body = buildStageARequestBody(packet('d'.repeat(64), 'Title'), PARAMETERS)
    expect(requestBodySha256(body)).toBe(sha256(requestBodyText(body)))
  })
})

describe('local shard filenames', () => {
  it('accepts a plain filename', () => {
    expect(assertSafeShardFilename('shard-0001.jsonl')).toBe('shard-0001.jsonl')
  })

  it('refuses separators, traversal, and non-strings', () => {
    for (const value of ['../escape.jsonl', 'a/b.jsonl', '.hidden', '', 42, null]) {
      expect(() => assertSafeShardFilename(value)).toThrow(/plain local filename/u)
    }
  })
})
