/** @jest-environment node */
import { syntheticCorpusRecord } from './fixtures'
import {
  assertOperationSalt,
  buildPacket,
  deriveRecordId,
  mintOperationSalt,
  serializePacketLine,
  type OperationSalt,
} from './packet'

const SALT: OperationSalt = {
  version: 'literature-luna-record-id/1.0.0',
  saltHex: '1'.repeat(64),
}

describe('operation salt', () => {
  it('mints 32-byte salts bound to the record-id version', () => {
    const salt = mintOperationSalt()
    expect(() => assertOperationSalt(salt)).not.toThrow()
    expect(salt.saltHex).toMatch(/^[0-9a-f]{64}$/u)
    expect(mintOperationSalt().saltHex).not.toBe(salt.saltHex)
  })

  it('rejects malformed or foreign-version salts', () => {
    expect(() => assertOperationSalt({ version: 'other', saltHex: '1'.repeat(64) })).toThrow()
    expect(() => assertOperationSalt({ version: SALT.version, saltHex: 'zz' })).toThrow()
  })
})

describe('packet building', () => {
  it('maps corpus fields into the ten-field packet', () => {
    const record = syntheticCorpusRecord('900000042', {
      meshTerms: ['Cough'],
      keywords: ['synthetic'],
      languages: ['eng', 'fre'],
    })
    const built = buildPacket(SALT, record)
    expect(built.packet).toEqual({
      record_id: built.mapping.recordId,
      title: record.title,
      abstract: record.abstract,
      journal: 'Synthetic Journal of Testing',
      publication_year: 2020,
      publication_types: ['Journal Article'],
      mesh_terms: ['Cough'],
      keywords: ['synthetic'],
      language: 'eng',
      evidence_profile: 'metadata_with_abstract',
    })
  })

  it('represents an absent abstract as an explicit null with the without-abstract profile', () => {
    for (const absent of [null, '', '   ']) {
      const built = buildPacket(SALT, syntheticCorpusRecord('900000043', { abstract: absent }))
      expect(built.packet.abstract).toBeNull()
      expect(built.packet.evidence_profile).toBe('metadata_without_abstract')
    }
  })

  it('falls back from journal title to abbreviation to null', () => {
    expect(
      buildPacket(SALT, syntheticCorpusRecord('900000044', { journalTitle: null })).packet.journal,
    ).toBe('Synth J Test')
    expect(
      buildPacket(
        SALT,
        syntheticCorpusRecord('900000044', { journalTitle: null, journalAbbreviation: null }),
      ).packet.journal,
    ).toBeNull()
  })

  it('takes the first language or null', () => {
    expect(
      buildPacket(SALT, syntheticCorpusRecord('900000045', { languages: [] })).packet.language,
    ).toBeNull()
  })

  it('never leaks the PMID into the serialized packet', () => {
    const pmid = '987654321'
    const built = buildPacket(SALT, syntheticCorpusRecord(pmid, { title: 'A distinct title' }))
    const serialized = serializePacketLine(built.packet)
    expect(serialized).not.toContain(pmid)
    expect(serialized).not.toContain('"pmid"')
    expect(built.mapping.pmid).toBe(pmid)
  })
})

describe('opaque content-bound record ids', () => {
  it('is 64 lowercase hex and deterministic for the same salt, pmid, and content', () => {
    const record = syntheticCorpusRecord('900000050')
    const first = buildPacket(SALT, record)
    const second = buildPacket(SALT, record)
    expect(first.mapping.recordId).toMatch(/^[0-9a-f]{64}$/u)
    expect(first.mapping.recordId).toBe(second.mapping.recordId)
    expect(first.mapping.contentSha256).toBe(second.mapping.contentSha256)
  })

  it('changes with the operation salt', () => {
    const record = syntheticCorpusRecord('900000050')
    const other = buildPacket({ ...SALT, saltHex: '2'.repeat(64) }, record)
    expect(other.mapping.recordId).not.toBe(buildPacket(SALT, record).mapping.recordId)
  })

  it('changes when the record content changes: the id is content-bound', () => {
    const base = buildPacket(SALT, syntheticCorpusRecord('900000050'))
    const changed = buildPacket(
      SALT,
      syntheticCorpusRecord('900000050', { title: 'A different title' }),
    )
    expect(changed.mapping.recordId).not.toBe(base.mapping.recordId)
  })

  it('differs across records with identical content', () => {
    const left = buildPacket(
      SALT,
      syntheticCorpusRecord('900000051', { title: 'Same', abstract: 'Same abstract.' }),
    )
    const right = buildPacket(
      SALT,
      syntheticCorpusRecord('900000052', { title: 'Same', abstract: 'Same abstract.' }),
    )
    expect(left.mapping.recordId).not.toBe(right.mapping.recordId)
    expect(left.mapping.contentSha256).toBe(right.mapping.contentSha256)
  })

  it('derives ids without exposing salt material', () => {
    const id = deriveRecordId(SALT, '900000053', 'c'.repeat(64))
    expect(id).toMatch(/^[0-9a-f]{64}$/u)
    expect(id).not.toContain(SALT.saltHex.slice(0, 16))
  })
})

describe('risk flags ride beside the packet, never inside it', () => {
  it('computes deterministic flags from bibliographic fields', () => {
    const built = buildPacket(
      SALT,
      syntheticCorpusRecord('900000060', { title: 'Bronchoscopy outcomes' }),
    )
    expect(built.riskFlags).toContain('signal_bronchoscopy')
    expect(Object.keys(built.packet)).not.toContain('riskFlags')
  })

  it('projects only the ten allowlisted fields even from a widened record object', () => {
    const record = {
      ...syntheticCorpusRecord('900000061'),
      relevance_state: 'unreviewed',
      extra_note: 'never model-facing',
    } as never
    const built = buildPacket(SALT, record)
    expect(Object.keys(built.packet).sort()).toEqual(
      [
        'abstract',
        'evidence_profile',
        'journal',
        'keywords',
        'language',
        'mesh_terms',
        'publication_types',
        'publication_year',
        'record_id',
        'title',
      ].sort(),
    )
  })
})
