import { createHash } from 'node:crypto'

import { z } from 'zod'

import {
  canonicalJson,
  sha256Canonical,
} from '../../src/features/literature/gold-set/import-compensation'
import {
  buildGoldImportNoteDispositionAudit,
  GOLD_IMPORT_AMENDED_AUTHORIZATION_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MANIFEST_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_MANIFEST_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MAPPING_SHA256,
  GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256,
  GOLD_IMPORT_NOTE_CURRENT_HEADS,
  GOLD_IMPORT_NOTE_DISPOSITION,
  GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SCHEMA_VERSION,
  GOLD_IMPORT_NOTE_DISPOSITION_RULE_VERSION,
  GOLD_IMPORT_NOTE_DISPOSITION_STATUS,
} from './gold-import-note-disposition'

export const GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2 =
  '89477e3f9f673e4a9d7cad20395ad7f2b6b00c05a993c50969527f985061a915' as const
export const GOLD_IMPORT_AMENDED_AUTHORIZATION_EXACT_TEXT_SHA256_V2 =
  '76be83337df191cbf973934500648b947f3cfc5fa7ce58701d61b90d7919d53a' as const

export const GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2 = Object.freeze({
  developmentMembershipSha256: '73367b254e7116db166dcd88372457d9ae1a9061aa58038c9900fbe21a17b46c',
  developmentPlanningStateSha256:
    '84743faccffca532d3fe6e03bd2d29a44f96790f0004c40ff0c9ed6bba881be5',
  effectiveStateSha256: '8b4f46720b980ec5337edfa448f7d998ddfa6498ec32a8fce5a941589a746a23',
  physicalStateSha256: '3986852c329bb66abf293d499655f2f278ae881801291756c9c1f75cc0351c70',
} as const)

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u)
const uuidSchema = z.string().uuid()

const noteDispositionRowSchema = z
  .object({
    amendedAuthorizationRationaleSha256: sha256Schema,
    currentNote: z.string().max(4000),
    currentNoteSha256: sha256Schema,
    currentReviewId: uuidSchema,
    currentRevision: z.number().int().positive(),
    disposition: z.literal(GOLD_IMPORT_NOTE_DISPOSITION),
    exactAuthorizedRationalePreserved: z.literal(true),
    finalizedV3Note: z.string().max(4000),
    finalizedV3NoteSha256: sha256Schema,
    itemId: uuidSchema,
    masterRowId: z.string().regex(/^[1-9][0-9]*$/u),
    pmid: z.enum(['36879724', '39281191']),
  })
  .strict()

export const goldImportNoteDispositionAuditGateV2Schema = z
  .object({
    authorizationTemplateRequired: z.literal(false),
    disposition: z.literal(GOLD_IMPORT_NOTE_DISPOSITION),
    physicalHistoryEvidence: z
      .object({
        currentPointersAreLatestHeads: z.literal(true),
        revisionChainsLinear: z.literal(true),
      })
      .strict(),
    rows: z.array(noteDispositionRowSchema).length(2),
    ruleVersion: z.literal(GOLD_IMPORT_NOTE_DISPOSITION_RULE_VERSION),
    schemaVersion: z.literal(GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SCHEMA_VERSION),
    sourceBindings: z
      .object({
        amendedAuthorizationSha256: z.literal(GOLD_IMPORT_AMENDED_AUTHORIZATION_SHA256),
        authorizationManifestSha256: z.literal(GOLD_IMPORT_AUTHORIZATION_MANIFEST_SHA256),
        authorizationMappingCorrectionManifestSha256: z.literal(
          GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_MANIFEST_SHA256,
        ),
        authorizationMappingCorrectionSha256: z.literal(
          GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_SHA256,
        ),
        authorizationMappingSha256: z.literal(GOLD_IMPORT_AUTHORIZATION_MAPPING_SHA256),
        currentEffectiveStateSha256: z.literal(
          GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.effectiveStateSha256,
        ),
        currentPhysicalStateSha256: z.literal(
          GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.physicalStateSha256,
        ),
        developmentPlanningStateSha256: z.literal(
          GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentPlanningStateSha256,
        ),
        finalizedV3ArtifactSha256: z.literal(GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256),
      })
      .strict(),
    status: z.literal(GOLD_IMPORT_NOTE_DISPOSITION_STATUS),
  })
  .strict()

export type GoldImportNoteDispositionAuditGateV2 = z.infer<
  typeof goldImportNoteDispositionAuditGateV2Schema
>

export interface NoteDispositionCurrentStateV2 {
  currentEffectiveStateSha256: string
  currentPhysicalStateSha256: string
  currentPointersAreLatestHeads: boolean
  developmentPlanningStateSha256: string
  revisionChainsLinear: boolean
  rows: ReadonlyArray<{
    currentNote: string
    currentReviewId: string
    currentRevision: number
    itemId: string
    masterRowId: string
    pmid: string
  }>
}

export interface NoteDispositionEvidenceBytesV2 {
  amendedAuthorizationBytes: Uint8Array
  amendedAuthorizationExactTextBytes: Uint8Array
  authorizationManifestBytes: Uint8Array
  authorizationMappingBytes: Uint8Array
  authorizationMappingCorrectionBytes: Uint8Array
  authorizationMappingCorrectionManifestBytes: Uint8Array
}

export interface NoteDispositionEvidenceIdentitiesV2 {
  amendedAuthorizationSha256: string
  amendedAuthorizationExactTextSha256: string
  authorizationManifestSha256: string
  authorizationMappingSha256: string
  authorizationMappingCorrectionSha256: string
  authorizationMappingCorrectionManifestSha256: string
}

const NOTE_DISPOSITION_EVIDENCE_IDENTITIES_V2: NoteDispositionEvidenceIdentitiesV2 = {
  amendedAuthorizationSha256: GOLD_IMPORT_AMENDED_AUTHORIZATION_SHA256,
  amendedAuthorizationExactTextSha256: GOLD_IMPORT_AMENDED_AUTHORIZATION_EXACT_TEXT_SHA256_V2,
  authorizationManifestSha256: GOLD_IMPORT_AUTHORIZATION_MANIFEST_SHA256,
  authorizationMappingSha256: GOLD_IMPORT_AUTHORIZATION_MAPPING_SHA256,
  authorizationMappingCorrectionSha256: GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_SHA256,
  authorizationMappingCorrectionManifestSha256:
    GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_MANIFEST_SHA256,
}

function validateNoteDispositionEvidenceChecksumsV2(
  evidence: NoteDispositionEvidenceBytesV2,
  expected: NoteDispositionEvidenceIdentitiesV2,
): void {
  const identities: NoteDispositionEvidenceIdentitiesV2 = {
    amendedAuthorizationSha256: createHash('sha256')
      .update(evidence.amendedAuthorizationBytes)
      .digest('hex'),
    amendedAuthorizationExactTextSha256: createHash('sha256')
      .update(evidence.amendedAuthorizationExactTextBytes)
      .digest('hex'),
    authorizationManifestSha256: createHash('sha256')
      .update(evidence.authorizationManifestBytes)
      .digest('hex'),
    authorizationMappingSha256: createHash('sha256')
      .update(evidence.authorizationMappingBytes)
      .digest('hex'),
    authorizationMappingCorrectionSha256: createHash('sha256')
      .update(evidence.authorizationMappingCorrectionBytes)
      .digest('hex'),
    authorizationMappingCorrectionManifestSha256: createHash('sha256')
      .update(evidence.authorizationMappingCorrectionManifestBytes)
      .digest('hex'),
  }
  for (const [name, sha256] of Object.entries(expected)) {
    if (identities[name as keyof NoteDispositionEvidenceIdentitiesV2] !== sha256) {
      throw new Error(`V2 note-disposition evidence checksum drifted: ${name}.`)
    }
  }
}

export function validateNoteDispositionEvidenceChecksumsV2ForTest(
  evidence: NoteDispositionEvidenceBytesV2,
  expected: NoteDispositionEvidenceIdentitiesV2,
): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('V2 note-disposition checksum overrides are restricted to tests.')
  }
  validateNoteDispositionEvidenceChecksumsV2(evidence, expected)
}

function sha256Text(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function noteHeadProjection(
  rows: ReadonlyArray<{
    currentReviewId: string
    currentRevision: number
    itemId: string
    masterRowId: string
    pmid: string
  }>,
) {
  return rows
    .map(({ currentReviewId, currentRevision, itemId, masterRowId, pmid }) => ({
      currentReviewId,
      currentRevision,
      itemId,
      masterRowId,
      pmid,
    }))
    .sort((left, right) => left.pmid.localeCompare(right.pmid, 'en'))
}

/**
 * Authenticate the accepted audit and rebind it to the fresh current state. The returned notes
 * are executable only after this function succeeds; recognizing the two PMIDs is insufficient.
 */
export function validateGoldImportNoteDispositionGateV2(input: {
  audit: unknown
  currentState: NoteDispositionCurrentStateV2
  evidence: NoteDispositionEvidenceBytesV2
}): GoldImportNoteDispositionAuditGateV2 {
  const audit = goldImportNoteDispositionAuditGateV2Schema.parse(input.audit)
  if (sha256Canonical(audit) !== GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2) {
    throw new Error('V2 note disposition audit does not match identity 89477e3f…a915.')
  }
  validateNoteDispositionEvidenceChecksumsV2(
    input.evidence,
    NOTE_DISPOSITION_EVIDENCE_IDENTITIES_V2,
  )
  const currentState = input.currentState
  if (
    !currentState.currentPointersAreLatestHeads ||
    !currentState.revisionChainsLinear ||
    currentState.currentEffectiveStateSha256 !== audit.sourceBindings.currentEffectiveStateSha256 ||
    currentState.currentPhysicalStateSha256 !== audit.sourceBindings.currentPhysicalStateSha256 ||
    currentState.developmentPlanningStateSha256 !==
      audit.sourceBindings.developmentPlanningStateSha256
  ) {
    throw new Error('V2 note disposition audit is stale relative to current review state.')
  }
  const expectedHeads = noteHeadProjection(GOLD_IMPORT_NOTE_CURRENT_HEADS)
  const auditedHeads = noteHeadProjection(audit.rows)
  const currentHeads = noteHeadProjection(currentState.rows)
  if (
    canonicalJson(auditedHeads) !== canonicalJson(expectedHeads) ||
    canonicalJson(currentHeads) !== canonicalJson(expectedHeads)
  ) {
    throw new Error('V2 note disposition review IDs, revisions, or source identities are stale.')
  }
  const currentRows = new Map(currentState.rows.map((row) => [row.pmid, row]))
  for (const row of audit.rows) {
    const current = currentRows.get(row.pmid)
    if (
      !current ||
      current.currentNote !== row.currentNote ||
      sha256Text(row.currentNote) !== row.currentNoteSha256 ||
      row.currentNoteSha256 !== row.amendedAuthorizationRationaleSha256 ||
      sha256Text(row.finalizedV3Note) !== row.finalizedV3NoteSha256 ||
      row.finalizedV3NoteSha256 === row.currentNoteSha256
    ) {
      throw new Error(`V2 note disposition text or rationale hash drifted for PMID ${row.pmid}.`)
    }
  }
  const independentlyReproduced = buildGoldImportNoteDispositionAudit({
    amendedAuthorizationBytes: Buffer.from(input.evidence.amendedAuthorizationBytes),
    authorizationManifestBytes: Buffer.from(input.evidence.authorizationManifestBytes),
    authorizationMappingBytes: Buffer.from(input.evidence.authorizationMappingBytes),
    authorizationMappingCorrectionBytes: Buffer.from(
      input.evidence.authorizationMappingCorrectionBytes,
    ),
    authorizationMappingCorrectionManifestBytes: Buffer.from(
      input.evidence.authorizationMappingCorrectionManifestBytes,
    ),
    currentEffectiveStateSha256: currentState.currentEffectiveStateSha256,
    currentPhysicalStateSha256: currentState.currentPhysicalStateSha256,
    currentPointersAreLatestHeads: currentState.currentPointersAreLatestHeads,
    developmentPlanningStateSha256: currentState.developmentPlanningStateSha256,
    finalV3ArtifactSha256: audit.sourceBindings.finalizedV3ArtifactSha256,
    revisionChainsLinear: currentState.revisionChainsLinear,
    rows: audit.rows.map((row) => ({
      currentNote: row.currentNote,
      currentReviewId: row.currentReviewId,
      currentRevision: row.currentRevision,
      finalizedV3Note: row.finalizedV3Note,
      itemId: row.itemId,
      masterRowId: row.masterRowId,
      pmid: row.pmid,
    })),
  })
  if (canonicalJson(independentlyReproduced) !== canonicalJson(audit)) {
    throw new Error('V2 note disposition evidence does not independently reproduce the audit.')
  }
  return audit
}

export function resolveV2ImportedNote(input: {
  audit: GoldImportNoteDispositionAuditGateV2
  finalizedV3Note: string
  itemId: string
  masterRowId: string
  pmid: string
}): string {
  const audited = input.audit.rows.find((row) => row.pmid === input.pmid)
  if (!audited) return input.finalizedV3Note
  if (
    audited.itemId !== input.itemId ||
    audited.masterRowId !== input.masterRowId ||
    audited.finalizedV3Note !== input.finalizedV3Note ||
    sha256Text(input.finalizedV3Note) !== audited.finalizedV3NoteSha256
  ) {
    throw new Error(`V2 finalized/source note binding drifted for PMID ${input.pmid}.`)
  }
  return audited.currentNote
}
