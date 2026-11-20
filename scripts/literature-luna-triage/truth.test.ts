/** @jest-environment node */
import { syntheticTruth, syntheticTruthRows } from './fixtures'
import { TruthAuthorityError, assertTruthCensus, censusOf, toTruthAuthority } from './truth'

describe('physician-truth authority', () => {
  it('accepts the exact published census: 630/283/75/272/358/192/133/305', () => {
    const authority = toTruthAuthority(syntheticTruth())
    expect(authority.census.total).toBe(630)
    expect(authority.census.byClass).toEqual({
      include_core: 283,
      include_adjacent: 75,
      exclude: 272,
    })
    expect(authority.census.reviewedRelevant).toBe(358)
    expect(authority.census.byProvenance).toEqual({
      physician_confirmed: 192,
      physician_modified: 133,
      qc_accepted: 305,
    })
  })

  it('stops on total-count drift', () => {
    const rows = syntheticTruthRows().slice(0, 629)
    expect(() => assertTruthCensus(censusOf(rows))).toThrow(TruthAuthorityError)
  })

  it('stops on class-count drift even when the total is right', () => {
    const rows = [...syntheticTruthRows()]
    // Flip one exclude to include_core: total stays 630, both classes drift.
    const index = rows.findIndex((row) => row.relevance === 'exclude')
    rows[index] = { ...rows[index], relevance: 'include_core' }
    expect(() => assertTruthCensus(censusOf(rows))).toThrow(/include_core 284/u)
  })

  it('stops on provenance drift', () => {
    const rows = [...syntheticTruthRows()]
    const index = rows.findIndex((row) => row.provenance === 'qc_accepted')
    rows[index] = { ...rows[index], provenance: 'physician_confirmed' }
    expect(() => assertTruthCensus(censusOf(rows))).toThrow(TruthAuthorityError)
  })

  it('never prints identities in drift errors', () => {
    const rows = syntheticTruthRows().slice(0, 100)
    try {
      assertTruthCensus(censusOf(rows))
      throw new Error('expected drift')
    } catch (error) {
      expect(String(error)).not.toMatch(/9000000\d\d/u)
    }
  })
})
