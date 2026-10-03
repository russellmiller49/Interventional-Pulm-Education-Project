/** @jest-environment node */
import { buildSourceSql } from '../literature-production-ingest/source'
import {
  CorpusAuthorityError,
  assertCorpusAuthority,
  corpusAbstractPresent,
  corpusReadSql,
  streamCorpus,
  yearBandOf,
  type CorpusRecord,
} from './corpus'
import { syntheticEnvelope, syntheticPmid } from './fixtures'

describe('corpus read boundary', () => {
  it('executes exactly the committed full-corpus SQL, byte for byte', () => {
    expect(corpusReadSql()).toBe(buildSourceSql('full'))
  })

  it('projects the bibliographic fields and asserts strict ascending PMID order', async () => {
    const envelopes = [
      syntheticEnvelope(syntheticPmid(1), { abstract: null }),
      syntheticEnvelope(syntheticPmid(2), { languages: [] }),
    ]
    const records: CorpusRecord[] = []
    const result = await streamCorpus(
      (record) => {
        records.push(record)
      },
      { envelopes },
    )
    expect(result.count).toBe(2)
    expect(records[0].abstract).toBeNull()
    expect(records[1].languages).toEqual([])
    expect(records[0].pmid < records[1].pmid).toBe(true)
  })

  it('throws on out-of-order or duplicate PMIDs', async () => {
    const reversed = [syntheticEnvelope(syntheticPmid(2)), syntheticEnvelope(syntheticPmid(1))]
    await expect(streamCorpus(() => undefined, { envelopes: reversed })).rejects.toThrow(
      CorpusAuthorityError,
    )
    const duplicated = [syntheticEnvelope(syntheticPmid(1)), syntheticEnvelope(syntheticPmid(1))]
    await expect(streamCorpus(() => undefined, { envelopes: duplicated })).rejects.toThrow(
      CorpusAuthorityError,
    )
  })

  it('rejects envelopes that fail the source validator', async () => {
    const bad = { article: { pmid: 'x' }, journal: null }
    await expect(streamCorpus(() => undefined, { envelopes: [bad] })).rejects.toThrow()
  })

  it('computes a deterministic identity digest over the ordered PMIDs', async () => {
    const envelopes = () => [
      syntheticEnvelope(syntheticPmid(1)),
      syntheticEnvelope(syntheticPmid(2)),
    ]
    const first = await streamCorpus(() => undefined, { envelopes: envelopes() })
    const second = await streamCorpus(() => undefined, { envelopes: envelopes() })
    expect(first.identitySha256).toBe(second.identitySha256)
    const different = await streamCorpus(() => undefined, {
      envelopes: [syntheticEnvelope(syntheticPmid(1)), syntheticEnvelope(syntheticPmid(3))],
    })
    expect(different.identitySha256).not.toBe(first.identitySha256)
  })
})

describe('corpus authority', () => {
  it('requires exactly 132,350 records', () => {
    expect(() => assertCorpusAuthority({ count: 132_349, identitySha256: 'a'.repeat(64) })).toThrow(
      /132350/u,
    )
    expect(() => assertCorpusAuthority({ count: 132_351, identitySha256: 'a'.repeat(64) })).toThrow(
      CorpusAuthorityError,
    )
    expect(() =>
      assertCorpusAuthority({ count: 132_350, identitySha256: 'a'.repeat(64) }),
    ).not.toThrow()
  })

  it('stops on identity drift against a recorded digest', () => {
    expect(() =>
      assertCorpusAuthority({ count: 132_350, identitySha256: 'a'.repeat(64) }, 'b'.repeat(64)),
    ).toThrow(/identity drift/u)
    expect(() =>
      assertCorpusAuthority({ count: 132_350, identitySha256: 'a'.repeat(64) }, 'a'.repeat(64)),
    ).not.toThrow()
  })
})

describe('abstract presence and year bands', () => {
  it('treats blank-after-trim as absent, matching the corpus convention', () => {
    expect(corpusAbstractPresent('text')).toBe(true)
    expect(corpusAbstractPresent('   ')).toBe(false)
    expect(corpusAbstractPresent(null)).toBe(false)
  })

  it('bands years deterministically', () => {
    expect(yearBandOf(null)).toBe('unknown')
    expect(yearBandOf(1955)).toBe('pre-1970')
    expect(yearBandOf(1974)).toBe('1970s')
    expect(yearBandOf(1989)).toBe('1980s')
    expect(yearBandOf(1999)).toBe('1990s')
    expect(yearBandOf(2005)).toBe('2000s')
    expect(yearBandOf(2015)).toBe('2010s')
    expect(yearBandOf(2026)).toBe('2020s')
  })
})
