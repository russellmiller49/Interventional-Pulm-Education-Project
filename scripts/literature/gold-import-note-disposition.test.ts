import { createHash } from 'node:crypto'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import {
  GOLD_IMPORT_NOTE_CURRENT_HEADS,
  buildGoldImportNoteDispositionAuditForTest,
  goldImportNoteDispositionAuditSha256,
} from './gold-import-note-disposition'

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function fixture() {
  const finalV3ArtifactSha256 = 'f'.repeat(64)
  const rationales = {
    '36879724': 'Authorized current rationale 36879724',
    '39281191': 'Authorized current rationale 39281191',
  }
  const amendedAuthorizationBytes = Buffer.from(
    JSON.stringify({
      authorization_status: 'authorized',
      target: 'local',
      two_row_only_write_boundary: true,
      target_pmids: ['39281191', '36879724'],
      finalized_v3_source_artifact: { sha256: finalV3ArtifactSha256 },
      physician_rationales: rationales,
    }),
    'utf8',
  )
  const authorizationMappingBytes = Buffer.from(
    JSON.stringify({
      rationale_exception:
        'The database review notes field uses the exact amended physician rationale rather than the earlier artifact physician_notes, as expressly authorized.',
      mappings: [
        {
          authorization: 'exact physician rationale',
          database:
            'literature_gold_set_reviews.notes and event amendment_authorization.physician_rationale',
        },
      ],
    }),
    'utf8',
  )
  const amendedAuthorizationSha256 = sha256(amendedAuthorizationBytes)
  const authorizationMappingSha256 = sha256(authorizationMappingBytes)
  const authorizationMappingCorrectionBytes = Buffer.from(
    JSON.stringify({
      authoritative: true,
      original_mapping: { sha256: authorizationMappingSha256 },
      review_row_mappings_unchanged: true,
      status: 'authoritative_additive_path_correction',
    }),
    'utf8',
  )
  const authorizationMappingCorrectionSha256 = sha256(authorizationMappingCorrectionBytes)
  const authorizationMappingCorrectionManifestBytes = Buffer.from(
    `${authorizationMappingCorrectionSha256}  artifact-to-database-field-mapping-authoritative-v2.json\n`,
    'utf8',
  )
  const authorizationManifestBytes = Buffer.from(
    `${amendedAuthorizationSha256}  amended-authorization.json\n${authorizationMappingSha256}  artifact-to-database-field-mapping.json\n`,
    'utf8',
  )
  return {
    input: {
      amendedAuthorizationBytes,
      authorizationManifestBytes,
      authorizationMappingBytes,
      authorizationMappingCorrectionBytes,
      authorizationMappingCorrectionManifestBytes,
      currentEffectiveStateSha256: 'a'.repeat(64),
      currentPhysicalStateSha256: 'b'.repeat(64),
      currentPointersAreLatestHeads: true,
      developmentPlanningStateSha256: 'c'.repeat(64),
      finalV3ArtifactSha256,
      revisionChainsLinear: true,
      rows: [
        {
          currentNote: rationales['39281191'],
          currentReviewId: 'review-39281191',
          currentRevision: 2,
          finalizedV3Note: 'Different finalized note 39281191',
          itemId: 'item-39281191',
          masterRowId: 'master-39281191',
          pmid: '39281191',
        },
        {
          currentNote: rationales['36879724'],
          currentReviewId: 'review-36879724',
          currentRevision: 2,
          finalizedV3Note: 'Different finalized note 36879724',
          itemId: 'item-36879724',
          masterRowId: 'master-36879724',
          pmid: '36879724',
        },
      ],
    },
    expectations: {
      amendedAuthorizationSha256,
      authorizationManifestSha256: sha256(authorizationManifestBytes),
      authorizationMappingSha256,
      authorizationMappingCorrectionManifestSha256: sha256(
        authorizationMappingCorrectionManifestBytes,
      ),
      authorizationMappingCorrectionSha256,
      finalV3ArtifactSha256,
    },
  }
}

describe('gold import note disposition audit', () => {
  it('proves the exact two-row preserve-current disposition deterministically', () => {
    const { input, expectations } = fixture()
    const first = buildGoldImportNoteDispositionAuditForTest(input, expectations)
    const second = buildGoldImportNoteDispositionAuditForTest(input, expectations)

    expect(first).toEqual(second)
    expect(first).toMatchObject({
      authorizationTemplateRequired: false,
      disposition: 'preserve_current_database_note',
      status: 'already_authorized',
    })
    expect(first.rows.map((row) => row.pmid)).toEqual(['36879724', '39281191'])
    expect(first.rows.every((row) => row.exactAuthorizedRationalePreserved)).toBe(true)
    expect(GOLD_IMPORT_NOTE_CURRENT_HEADS).toEqual([
      expect.objectContaining({ currentRevision: 2, masterRowId: '4', pmid: '36879724' }),
      expect.objectContaining({ currentRevision: 2, masterRowId: '9', pmid: '39281191' }),
    ])
    expect(goldImportNoteDispositionAuditSha256(first)).toBe(sha256(canonicalJson(first)))
  })

  it('rejects a current note not exactly supplied by the checksum-bound authorization', () => {
    const { input, expectations } = fixture()
    const rows = input.rows.map((row) =>
      row.pmid === '36879724' ? { ...row, currentNote: `${row.currentNote} altered` } : row,
    )

    expect(() =>
      buildGoldImportNoteDispositionAuditForTest({ ...input, rows }, expectations),
    ).toThrow('Current note for PMID 36879724 is not the authorized rationale')
  })

  it('rejects stale or substituted authorization evidence', () => {
    const { input, expectations } = fixture()
    expect(() =>
      buildGoldImportNoteDispositionAuditForTest(
        {
          ...input,
          amendedAuthorizationBytes: Buffer.concat([
            input.amendedAuthorizationBytes,
            Buffer.from('\n'),
          ]),
        },
        expectations,
      ),
    ).toThrow('does not match its exact checksum-bound SHA-256')
  })
})
