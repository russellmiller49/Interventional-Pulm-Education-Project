/** @jest-environment node */

import { sha256 } from '../literature-production-ingest/canonical'
import {
  assertDeterministicUuid,
  deterministicUuid,
  overlayEventId,
  overlayOperationId,
} from './identity'

describe('deterministic identity', () => {
  it('shapes a v8 UUID and stays stable for identical parts', () => {
    const first = deterministicUuid(['a', 'b'])
    expect(first).toBe(deterministicUuid(['a', 'b']))
    expect(() => assertDeterministicUuid(first, 'uuid')).not.toThrow()
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u)
    expect(deterministicUuid(['a', 'c'])).not.toBe(first)
  })

  it('refuses empty or newline-carrying parts', () => {
    expect(() => deterministicUuid([])).toThrow(/nonempty/u)
    expect(() => deterministicUuid([''])).toThrow(/nonempty/u)
    expect(() => deterministicUuid(['a\nb'])).toThrow(/newline-free/u)
  })

  it('derives operation ids from the projection digest only through the engine identity', () => {
    const digest = sha256('projection')
    const operation = overlayOperationId(digest)
    expect(operation).toBe(overlayOperationId(digest))
    expect(overlayOperationId(sha256('other'))).not.toBe(operation)
    expect(() => overlayOperationId('not-a-digest')).toThrow(/SHA-256/u)
  })

  it('derives distinct event ids per record and validates inputs', () => {
    const operation = overlayOperationId(sha256('projection'))
    const eventA = overlayEventId(operation, '100000001')
    const eventB = overlayEventId(operation, '100000002')
    expect(eventA).not.toBe(eventB)
    expect(eventA).toBe(overlayEventId(operation, '100000001'))
    expect(() => overlayEventId('not-a-uuid', '100000001')).toThrow(/deterministic v8 UUID/u)
    expect(() => overlayEventId(operation, 'abc')).toThrow(/1-12 digit PMID/u)
  })
})
