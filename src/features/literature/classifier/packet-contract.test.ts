/** @jest-environment node */
import {
  PACKET_FORBIDDEN_KEY_PREFIXES,
  PACKET_FORBIDDEN_NORMALIZED_KEYS,
  PacketLeakageError,
  assertNoForbiddenPacketKeys,
  deriveEvidenceProfile,
  normalizePacketKey,
  validateUniversalPacket,
} from './packet-contract'

const RECORD_ID = 'b'.repeat(64)

function packet(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    record_id: RECORD_ID,
    title: 'A synthetic title',
    abstract: 'A synthetic abstract.',
    journal: 'Synthetic Journal',
    publication_year: 2021,
    publication_types: ['Journal Article'],
    mesh_terms: ['Testing'],
    keywords: ['synthetic'],
    language: 'eng',
    evidence_profile: 'metadata_with_abstract',
    ...overrides,
  }
}

describe('evidence profiles', () => {
  it('derives from abstract presence with blank-after-trim treated as absent', () => {
    expect(deriveEvidenceProfile('text')).toBe('metadata_with_abstract')
    expect(deriveEvidenceProfile(null)).toBe('metadata_without_abstract')
    expect(deriveEvidenceProfile(undefined)).toBe('metadata_without_abstract')
    expect(deriveEvidenceProfile('   ')).toBe('metadata_without_abstract')
  })

  it('requires the packet profile to match the abstract', () => {
    expect(validateUniversalPacket(packet()).ok).toBe(true)
    expect(
      validateUniversalPacket(
        packet({ abstract: null, evidence_profile: 'metadata_without_abstract' }),
      ).ok,
    ).toBe(true)
    expect(
      validateUniversalPacket(
        packet({ abstract: null, evidence_profile: 'metadata_with_abstract' }),
      ).ok,
    ).toBe(false)
    expect(
      validateUniversalPacket(packet({ evidence_profile: 'metadata_without_abstract' })).ok,
    ).toBe(false)
  })

  it('rejects a blank abstract string: absence must be an explicit null', () => {
    expect(
      validateUniversalPacket(
        packet({ abstract: '   ', evidence_profile: 'metadata_without_abstract' }),
      ).ok,
    ).toBe(false)
  })
})

describe('structural allowlist', () => {
  it('accepts exactly the ten fields and nothing else', () => {
    expect(validateUniversalPacket(packet()).ok).toBe(true)
    expect(validateUniversalPacket(packet({ extra_field: 1 })).ok).toBe(false)
    const missing = packet()
    delete missing.language
    expect(validateUniversalPacket(missing).ok).toBe(false)
  })

  it('rejects malformed record ids and out-of-range years', () => {
    expect(validateUniversalPacket(packet({ record_id: 'nope' })).ok).toBe(false)
    expect(validateUniversalPacket(packet({ publication_year: 1500 })).ok).toBe(false)
  })
})

describe('forbidden-key firewall', () => {
  it('normalizes keys before matching', () => {
    expect(normalizePacketKey('Physician-Label')).toBe('physicianlabel')
    expect(normalizePacketKey('held_out')).toBe('heldout')
    expect(normalizePacketKey('PMID')).toBe('pmid')
  })

  it('throws on direct identity fields in any casing', () => {
    for (const key of ['pmid', 'PMID', 'p_m_i_d', 'doi', 'DOI', 'pmcid']) {
      expect(() => assertNoForbiddenPacketKeys({ [key]: 'x' })).toThrow(PacketLeakageError)
    }
  })

  it('throws on physician truth, membership, and credential families', () => {
    const forbidden = [
      'physician_label',
      'physicianConfidence',
      'goldLabel',
      'gold_answer',
      'coordinatorNotes',
      'held_out',
      'heldOutMembership',
      'reviewed_relevance',
      'review_notes',
      'enrichment_provenance',
      'dataset_split',
      'splitMembership',
      'sanity_membership',
      'truth_counts',
      'supabase_url',
      'api_key',
      'operation_id',
      'file_path',
      'sql',
    ]
    for (const key of forbidden) {
      expect(() => assertNoForbiddenPacketKeys({ [key]: 'x' })).toThrow(PacketLeakageError)
    }
  })

  it('recurses through nested objects and arrays and names the path', () => {
    expect(() =>
      assertNoForbiddenPacketKeys({ outer: [{ inner: { physician_label: 'x' } }] }),
    ).toThrow(/packet\.outer\[0\]\.inner\.physician_label/u)
  })

  it('never echoes the offending value', () => {
    try {
      assertNoForbiddenPacketKeys({ pmid: 'SECRET-VALUE-123' })
      throw new Error('expected a leakage error')
    } catch (error) {
      expect(String(error)).not.toContain('SECRET-VALUE-123')
    }
  })

  it('keeps the vocabulary lists internally consistent', () => {
    for (const key of PACKET_FORBIDDEN_NORMALIZED_KEYS) {
      expect(key).toBe(normalizePacketKey(key))
    }
    for (const prefix of PACKET_FORBIDDEN_KEY_PREFIXES) {
      expect(prefix).toBe(normalizePacketKey(prefix))
    }
  })

  it('passes a clean packet', () => {
    expect(() => assertNoForbiddenPacketKeys(packet())).not.toThrow()
  })
})
