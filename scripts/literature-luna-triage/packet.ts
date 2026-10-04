import { randomBytes } from 'node:crypto'

import {
  assertNoForbiddenPacketKeys,
  deriveEvidenceProfile,
  validateUniversalPacket,
  type UniversalPacket,
} from '../../src/features/literature/classifier/packet-contract'
import {
  evaluateCoordinatorRiskFlags,
  type CoordinatorRiskFlag,
} from '../../src/features/literature/classifier/risk-lexicon'
import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import { LUNA_RECORD_ID_VERSION } from './constants'
import type { CorpusRecord } from './corpus'

/**
 * Universal evidence-adaptive packet builder.
 *
 * Every packet identity is an opaque, operation-salted, content-bound id: SHA-256 over the
 * lane's record-id version, the operation salt, the PMID, and the content digest of the
 * packet body. The PMID → record-id mapping is coordinator-owned, written mode-0600 into the
 * operation directory, and never enters any model-facing artifact. Because the id commits to
 * the content digest, a record whose bibliography changes mints a different id, so a stale
 * mapping can never silently bind an output to different evidence.
 */

export class PacketBuildError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PacketBuildError'
  }
}

export interface OperationSalt {
  readonly version: string
  readonly saltHex: string
}

export function mintOperationSalt(): OperationSalt {
  return { version: LUNA_RECORD_ID_VERSION, saltHex: randomBytes(32).toString('hex') }
}

export function assertOperationSalt(value: unknown): asserts value is OperationSalt {
  if (
    !value ||
    typeof value !== 'object' ||
    (value as OperationSalt).version !== LUNA_RECORD_ID_VERSION ||
    typeof (value as OperationSalt).saltHex !== 'string' ||
    !/^[0-9a-f]{64}$/u.test((value as OperationSalt).saltHex)
  ) {
    throw new PacketBuildError('The operation salt is malformed or from another lane version.')
  }
}

/** Coordinator-owned mapping row. Never model-facing. */
export interface RecordIdMappingRow {
  readonly recordId: string
  readonly pmid: string
  readonly contentSha256: string
}

export interface BuiltPacket {
  readonly packet: UniversalPacket
  readonly mapping: RecordIdMappingRow
  readonly riskFlags: readonly CoordinatorRiskFlag[]
}

/** The model-facing packet body for one corpus record, before an id exists. */
function packetBody(record: CorpusRecord): Omit<UniversalPacket, 'record_id'> {
  const abstractPresent = typeof record.abstract === 'string' && record.abstract.trim().length > 0
  return {
    title: record.title,
    abstract: abstractPresent ? (record.abstract as string) : null,
    journal: record.journalTitle ?? record.journalAbbreviation ?? null,
    publication_year: record.publicationYear,
    publication_types: [...record.publicationTypes],
    mesh_terms: [...record.meshTerms],
    keywords: [...record.keywords],
    language: record.languages[0] ?? null,
    evidence_profile: deriveEvidenceProfile(record.abstract),
  }
}

export function deriveRecordId(salt: OperationSalt, pmid: string, contentSha256: string): string {
  return sha256(`${LUNA_RECORD_ID_VERSION}\n${salt.saltHex}\n${pmid}\n${contentSha256}`)
}

/**
 * Build one packet. The structural firewall runs twice by design: the normalized forbidden-key
 * scan over the assembled value, then the strict allowlist schema; both must pass before the
 * packet exists.
 */
export function buildPacket(salt: OperationSalt, record: CorpusRecord): BuiltPacket {
  assertOperationSalt(salt)
  const body = packetBody(record)
  assertNoForbiddenPacketKeys(body)
  const contentSha256 = sha256(canonicalJson(body))
  const recordId = deriveRecordId(salt, record.pmid, contentSha256)
  const candidate = { record_id: recordId, ...body }
  const validation = validateUniversalPacket(candidate)
  if (!validation.ok) {
    // Issues name schema paths only; no record content is echoed.
    throw new PacketBuildError(
      `A packet failed the structural allowlist: ${validation.issues.join('; ')}`,
    )
  }
  const riskFlags = evaluateCoordinatorRiskFlags({
    title: record.title,
    abstract: body.abstract,
    journal: body.journal,
    meshTerms: record.meshTerms,
    keywords: record.keywords,
    publicationTypes: record.publicationTypes,
  })
  return {
    packet: validation.packet,
    mapping: { recordId, pmid: record.pmid, contentSha256 },
    riskFlags,
  }
}

/** Serialize one model-facing packet line. Key order is canonical so hashes are stable. */
export function serializePacketLine(packet: UniversalPacket): string {
  return canonicalJson(packet)
}

export function packetSha256(packet: UniversalPacket): string {
  return sha256(canonicalJson(packet))
}
