import { createHash } from 'node:crypto'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'

export const GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SCHEMA_VERSION =
  'gold-import-note-disposition-audit/1.0.0' as const
export const GOLD_IMPORT_NOTE_DISPOSITION_RULE_VERSION =
  'amended-two-row-physician-rationale-exception/1.0.0' as const
export const GOLD_IMPORT_NOTE_DISPOSITION_STATUS = 'already_authorized' as const
export const GOLD_IMPORT_NOTE_DISPOSITION = 'preserve_current_database_note' as const

export const GOLD_IMPORT_AMENDED_AUTHORIZATION_SHA256 =
  'b95fc9785ee355b810981c051db62307e868110e06ffb1a83c09c8eff52bf89a' as const
export const GOLD_IMPORT_AUTHORIZATION_MAPPING_SHA256 =
  '169808d89f094798ec1c55682dce047f4cb51de26cb1117639fc81f190250191' as const
export const GOLD_IMPORT_AUTHORIZATION_MANIFEST_SHA256 =
  '11d2232a2bc257a607d284f34ff6d2aa022a1e925249c3ce067258c137547a0e' as const
export const GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_SHA256 =
  '9f0bba6172ea1af4a6d4844365bb5aa8c63308bee67ab9df5c03d1937e8d429d' as const
export const GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_MANIFEST_SHA256 =
  'f718fd854bb3c9257b5ff46748a04583110584166e63952c534d9a043c437ec0' as const
export const GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256 =
  '961c19f4ea1c6a82e061369fd33d927e804360f10781729f8049073a4b6d0f59' as const
export const GOLD_IMPORT_NOTE_PMIDS = Object.freeze(['36879724', '39281191'] as const)
export const GOLD_IMPORT_NOTE_CURRENT_HEADS = Object.freeze([
  {
    currentReviewId: 'c14d5fe8-958b-87e6-a381-4604b51277ba',
    currentRevision: 2,
    itemId: '7f58c9cf-779f-42d8-a538-b3d39116495c',
    masterRowId: '4',
    pmid: '36879724',
  },
  {
    currentReviewId: 'd31ca926-4e1b-82cc-a39f-3c358b49a369',
    currentRevision: 2,
    itemId: '13b9eb7f-fdc0-4b3f-af14-33b6e21e8956',
    masterRowId: '9',
    pmid: '39281191',
  },
] as const)

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const NOTE_MAPPING_EXCEPTION =
  'The database review notes field uses the exact amended physician rationale rather than the earlier artifact physician_notes, as expressly authorized.'

function sha256Bytes(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return value as Record<string, unknown>
}

function parsePinnedJson(bytes: Buffer, expectedSha256: string, label: string) {
  if (sha256Bytes(bytes) !== expectedSha256) {
    throw new Error(`${label} does not match its exact checksum-bound SHA-256.`)
  }
  try {
    return objectValue(JSON.parse(bytes.toString('utf8')) as unknown, label)
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`${label} is not valid JSON.`)
    throw error
  }
}

function requireString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label}.${key} must be a nonempty string.`)
  }
  return value
}

interface NoteDispositionEvidenceExpectations {
  amendedAuthorizationSha256: string
  authorizationManifestSha256: string
  authorizationMappingSha256: string
  authorizationMappingCorrectionManifestSha256: string
  authorizationMappingCorrectionSha256: string
  finalV3ArtifactSha256: string
}

const PINNED_NOTE_DISPOSITION_EVIDENCE: NoteDispositionEvidenceExpectations = {
  amendedAuthorizationSha256: GOLD_IMPORT_AMENDED_AUTHORIZATION_SHA256,
  authorizationManifestSha256: GOLD_IMPORT_AUTHORIZATION_MANIFEST_SHA256,
  authorizationMappingSha256: GOLD_IMPORT_AUTHORIZATION_MAPPING_SHA256,
  authorizationMappingCorrectionManifestSha256:
    GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_MANIFEST_SHA256,
  authorizationMappingCorrectionSha256: GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_SHA256,
  finalV3ArtifactSha256: GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256,
}

function requireExactManifest(
  bytes: Buffer,
  expectations: NoteDispositionEvidenceExpectations,
): void {
  if (sha256Bytes(bytes) !== expectations.authorizationManifestSha256) {
    throw new Error('Authorization artifact manifest does not match its pinned SHA-256.')
  }
  const entries = new Map<string, string>()
  const text = bytes.toString('utf8')
  if (!text.endsWith('\n') || text.includes('\r')) {
    throw new Error('Authorization artifact manifest must use canonical LF-delimited bytes.')
  }
  text
    .trimEnd()
    .split('\n')
    .forEach((line) => {
      const match = /^([a-f0-9]{64})  ([^/]+)$/u.exec(line)
      if (!match || entries.has(match[2]!)) {
        throw new Error('Authorization artifact manifest is malformed or duplicated.')
      }
      entries.set(match[2]!, match[1]!)
    })
  if (
    entries.get('amended-authorization.json') !== expectations.amendedAuthorizationSha256 ||
    entries.get('artifact-to-database-field-mapping.json') !==
      expectations.authorizationMappingSha256
  ) {
    throw new Error('Authorization manifest does not bind the exact note evidence artifacts.')
  }
}

function requireExactMappingCorrectionManifest(
  bytes: Buffer,
  expectations: NoteDispositionEvidenceExpectations,
): void {
  if (sha256Bytes(bytes) !== expectations.authorizationMappingCorrectionManifestSha256) {
    throw new Error('Authorization mapping-correction manifest does not match its pinned SHA-256.')
  }
  const text = bytes.toString('utf8')
  if (!text.endsWith('\n') || text.includes('\r')) {
    throw new Error('Authorization mapping-correction manifest must use canonical LF bytes.')
  }
  const entries = new Map<string, string>()
  for (const line of text.trimEnd().split('\n')) {
    const match = /^([a-f0-9]{64})  ([^/]+)$/u.exec(line)
    if (!match || entries.has(match[2]!)) {
      throw new Error('Authorization mapping-correction manifest is malformed or duplicated.')
    }
    entries.set(match[2]!, match[1]!)
  }
  if (
    entries.get('artifact-to-database-field-mapping-authoritative-v2.json') !==
    expectations.authorizationMappingCorrectionSha256
  ) {
    throw new Error('Authorization mapping-correction manifest does not bind the exact artifact.')
  }
}

export interface GoldImportNoteDispositionRowInput {
  currentNote: string
  currentReviewId: string
  currentRevision: number
  finalizedV3Note: string
  itemId: string
  masterRowId: string
  pmid: string
}

interface BuildGoldImportNoteDispositionAuditInput {
  amendedAuthorizationBytes: Buffer
  authorizationManifestBytes: Buffer
  authorizationMappingBytes: Buffer
  authorizationMappingCorrectionBytes: Buffer
  authorizationMappingCorrectionManifestBytes: Buffer
  currentEffectiveStateSha256: string
  currentPhysicalStateSha256: string
  currentPointersAreLatestHeads: boolean
  developmentPlanningStateSha256: string
  finalV3ArtifactSha256: string
  revisionChainsLinear: boolean
  rows: readonly GoldImportNoteDispositionRowInput[]
}

function buildGoldImportNoteDispositionAuditWithExpectations(
  input: BuildGoldImportNoteDispositionAuditInput,
  expectations: NoteDispositionEvidenceExpectations,
) {
  requireExactManifest(input.authorizationManifestBytes, expectations)
  requireExactMappingCorrectionManifest(
    input.authorizationMappingCorrectionManifestBytes,
    expectations,
  )
  const authorization = parsePinnedJson(
    input.amendedAuthorizationBytes,
    expectations.amendedAuthorizationSha256,
    'Amended authorization',
  )
  const mapping = parsePinnedJson(
    input.authorizationMappingBytes,
    expectations.authorizationMappingSha256,
    'Authorization field mapping',
  )
  const mappingCorrection = parsePinnedJson(
    input.authorizationMappingCorrectionBytes,
    expectations.authorizationMappingCorrectionSha256,
    'Authoritative authorization field-mapping correction',
  )
  if (input.finalV3ArtifactSha256 !== expectations.finalV3ArtifactSha256) {
    throw new Error('Note audit is not bound to the exact finalized V3 artifact.')
  }
  ;[
    input.currentEffectiveStateSha256,
    input.currentPhysicalStateSha256,
    input.developmentPlanningStateSha256,
  ].forEach((sha256) => {
    if (!SHA256_PATTERN.test(sha256)) throw new Error('Note audit state SHA-256 is malformed.')
  })
  if (!input.revisionChainsLinear || !input.currentPointersAreLatestHeads) {
    throw new Error('Note disposition requires linear physical chains and current head pointers.')
  }
  if (
    authorization.authorization_status !== 'authorized' ||
    authorization.target !== 'local' ||
    authorization.two_row_only_write_boundary !== true
  ) {
    throw new Error('Amended authorization is not the exact authorized local two-row boundary.')
  }
  const sourceArtifact = objectValue(
    authorization.finalized_v3_source_artifact,
    'Amended authorization finalized_v3_source_artifact',
  )
  if (sourceArtifact.sha256 !== input.finalV3ArtifactSha256) {
    throw new Error('Amended authorization is bound to a different finalized artifact.')
  }
  const authorizedPmids = authorization.target_pmids
  if (
    !Array.isArray(authorizedPmids) ||
    [...authorizedPmids].map(String).sort().join('\n') !==
      [...GOLD_IMPORT_NOTE_PMIDS].sort().join('\n')
  ) {
    throw new Error('Amended authorization does not bind the exact two note PMIDs.')
  }
  const rationales = objectValue(authorization.physician_rationales, 'Physician rationales')
  if (mapping.rationale_exception !== NOTE_MAPPING_EXCEPTION) {
    throw new Error('Authorization mapping does not contain the exact rationale exception.')
  }
  const originalMapping = objectValue(
    mappingCorrection.original_mapping,
    'Authoritative mapping correction original_mapping',
  )
  if (
    mappingCorrection.authoritative !== true ||
    mappingCorrection.status !== 'authoritative_additive_path_correction' ||
    mappingCorrection.review_row_mappings_unchanged !== true ||
    originalMapping.sha256 !== expectations.authorizationMappingSha256
  ) {
    throw new Error(
      'Authoritative mapping correction does not preserve the exact review-row note mapping.',
    )
  }
  const mappings = mapping.mappings
  if (
    !Array.isArray(mappings) ||
    !mappings.some((entry) => {
      const record = objectValue(entry, 'Authorization mapping entry')
      return (
        record.authorization === 'exact physician rationale' &&
        record.database ===
          'literature_gold_set_reviews.notes and event amendment_authorization.physician_rationale'
      )
    })
  ) {
    throw new Error('Authorization mapping does not bind the supplied rationale to review notes.')
  }
  if (
    input.rows.length !== GOLD_IMPORT_NOTE_PMIDS.length ||
    [...input.rows]
      .map((row) => row.pmid)
      .sort()
      .join('\n') !== [...GOLD_IMPORT_NOTE_PMIDS].sort().join('\n')
  ) {
    throw new Error('Note disposition rows do not match the exact two-PMID cohort.')
  }
  const seenItems = new Set<string>()
  const seenMasterRows = new Set<string>()
  const rows = [...input.rows]
    .sort((left, right) => left.pmid.localeCompare(right.pmid, 'en'))
    .map((row) => {
      if (
        !row.itemId ||
        !row.masterRowId ||
        !row.currentReviewId ||
        !Number.isInteger(row.currentRevision) ||
        row.currentRevision < 1 ||
        seenItems.has(row.itemId) ||
        seenMasterRows.has(row.masterRowId)
      ) {
        throw new Error('Note disposition row identity or revision is invalid or duplicated.')
      }
      seenItems.add(row.itemId)
      seenMasterRows.add(row.masterRowId)
      const authorizedRationale = requireString(rationales, row.pmid, 'Physician rationales')
      if (row.currentNote !== authorizedRationale) {
        throw new Error(`Current note for PMID ${row.pmid} is not the authorized rationale.`)
      }
      if (row.finalizedV3Note === row.currentNote) {
        throw new Error(`PMID ${row.pmid} does not contain the audited note-source difference.`)
      }
      return {
        itemId: row.itemId,
        masterRowId: row.masterRowId,
        pmid: row.pmid,
        currentReviewId: row.currentReviewId,
        currentRevision: row.currentRevision,
        currentNote: row.currentNote,
        currentNoteSha256: sha256Bytes(row.currentNote),
        finalizedV3Note: row.finalizedV3Note,
        finalizedV3NoteSha256: sha256Bytes(row.finalizedV3Note),
        amendedAuthorizationRationaleSha256: sha256Bytes(authorizedRationale),
        disposition: GOLD_IMPORT_NOTE_DISPOSITION,
        exactAuthorizedRationalePreserved: true,
      }
    })
  return {
    schemaVersion: GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SCHEMA_VERSION,
    ruleVersion: GOLD_IMPORT_NOTE_DISPOSITION_RULE_VERSION,
    status: GOLD_IMPORT_NOTE_DISPOSITION_STATUS,
    disposition: GOLD_IMPORT_NOTE_DISPOSITION,
    authorizationTemplateRequired: false,
    sourceBindings: {
      amendedAuthorizationSha256: expectations.amendedAuthorizationSha256,
      authorizationMappingSha256: expectations.authorizationMappingSha256,
      authorizationManifestSha256: expectations.authorizationManifestSha256,
      authorizationMappingCorrectionSha256: expectations.authorizationMappingCorrectionSha256,
      authorizationMappingCorrectionManifestSha256:
        expectations.authorizationMappingCorrectionManifestSha256,
      finalizedV3ArtifactSha256: input.finalV3ArtifactSha256,
      developmentPlanningStateSha256: input.developmentPlanningStateSha256,
      currentEffectiveStateSha256: input.currentEffectiveStateSha256,
      currentPhysicalStateSha256: input.currentPhysicalStateSha256,
    },
    physicalHistoryEvidence: {
      revisionChainsLinear: input.revisionChainsLinear,
      currentPointersAreLatestHeads: input.currentPointersAreLatestHeads,
    },
    rows,
  } as const
}

export function buildGoldImportNoteDispositionAudit(
  input: BuildGoldImportNoteDispositionAuditInput,
) {
  const result = buildGoldImportNoteDispositionAuditWithExpectations(
    input,
    PINNED_NOTE_DISPOSITION_EVIDENCE,
  )
  const currentHeads = result.rows.map(
    ({ currentReviewId, currentRevision, itemId, masterRowId, pmid }) => ({
      currentReviewId,
      currentRevision,
      itemId,
      masterRowId,
      pmid,
    }),
  )
  if (canonicalJson(currentHeads) !== canonicalJson(GOLD_IMPORT_NOTE_CURRENT_HEADS)) {
    throw new Error('Current two-row note heads do not match the exact audited revision-2 state.')
  }
  return result
}

export function buildGoldImportNoteDispositionAuditForTest(
  input: BuildGoldImportNoteDispositionAuditInput,
  expectations: NoteDispositionEvidenceExpectations,
) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Note-disposition evidence overrides are restricted to tests.')
  }
  return buildGoldImportNoteDispositionAuditWithExpectations(input, expectations)
}

export function goldImportNoteDispositionAuditSha256(
  audit: ReturnType<typeof buildGoldImportNoteDispositionAudit>,
): string {
  return sha256Bytes(canonicalJson(audit))
}
