import { z } from 'zod'

import { STAGE_A_RECORD_ID_PATTERN } from './stage-a-contract'

/**
 * The universal evidence-adaptive packet: the only record shape the Stage-A model ever sees.
 *
 * Browser-safe and pure. The packet deliberately carries no direct record identity — no PMID,
 * no DOI — only an opaque, operation-salted, content-bound `record_id` minted by the
 * coordinator. Everything else is bibliography. The firewall below is a structural allowlist
 * first (exactly these ten fields, exactly these types) and a normalized forbidden-key scan
 * second (defense in depth against renamed or nested leakage if the packet shape ever grows).
 */

export const UNIVERSAL_PACKET_SCHEMA_VERSION = 'literature-luna-universal-packet/1.0.0'

export const EVIDENCE_PROFILES = ['metadata_with_abstract', 'metadata_without_abstract'] as const

export type EvidenceProfile = (typeof EVIDENCE_PROFILES)[number]

export const UNIVERSAL_PACKET_FIELDS = [
  'record_id',
  'title',
  'abstract',
  'journal',
  'publication_year',
  'publication_types',
  'mesh_terms',
  'keywords',
  'language',
  'evidence_profile',
] as const

export type UniversalPacketField = (typeof UNIVERSAL_PACKET_FIELDS)[number]

const boundedText = (maximum: number) => z.string().min(1).max(maximum)

const boundedTextArray = z.array(boundedText(50_000)).max(500)

export const universalPacketSchema = z
  .object({
    record_id: z.string().regex(STAGE_A_RECORD_ID_PATTERN),
    title: boundedText(50_000),
    abstract: z.string().max(2_000_000).nullable(),
    journal: boundedText(50_000).nullable(),
    publication_year: z.number().int().min(1800).max(3000).nullable(),
    publication_types: boundedTextArray,
    mesh_terms: boundedTextArray,
    keywords: boundedTextArray,
    language: boundedText(100).nullable(),
    evidence_profile: z.enum(EVIDENCE_PROFILES),
  })
  .strict()
  .superRefine((packet, context) => {
    const derived = deriveEvidenceProfile(packet.abstract)
    if (derived !== packet.evidence_profile) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['evidence_profile'],
        message:
          'The evidence profile must be derived from abstract presence: a non-blank abstract ' +
          'is metadata_with_abstract, and an absent abstract must be an explicit null with ' +
          'metadata_without_abstract.',
      })
    }
    if (packet.abstract !== null && packet.abstract.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['abstract'],
        message: 'A blank abstract must be represented as an explicit null, never a string.',
      })
    }
  })

export type UniversalPacket = z.infer<typeof universalPacketSchema>

/** Abstract presence follows the corpus convention: blank-after-trim is absent. */
export function deriveEvidenceProfile(abstract: string | null | undefined): EvidenceProfile {
  return typeof abstract === 'string' && abstract.trim().length > 0
    ? 'metadata_with_abstract'
    : 'metadata_without_abstract'
}

/**
 * Normalized forbidden keys. Normalization strips every non-alphanumeric character and
 * lowercases, so `physician_label`, `physicianLabel`, and `Physician-Label` all resolve to the
 * same entry. The list names direct identities, physician truth, provenance and lineage,
 * membership, counts, credentials, and transport details — none of which may ever ride in a
 * model-facing payload.
 */
export const PACKET_FORBIDDEN_NORMALIZED_KEYS: readonly string[] = [
  // Direct record identity.
  'pmid',
  'doi',
  'pmcid',
  'nlmid',
  'articleid',
  'articleids',
  'identifier',
  'identifiers',
  'masterrowid',
  'itemid',
  // Physician truth and review state.
  'relevance',
  'relevancelabel',
  'relevancestate',
  'reviewedrelevance',
  'label',
  'finallabel',
  'notes',
  'reviewnotes',
  'reviewhistory',
  'reviewstatus',
  'correction',
  'correctionlineage',
  'noterevision',
  // Operation, membership, and evaluation structure.
  'operationid',
  'datasetsplit',
  'split',
  'splitmembership',
  'cohort',
  'cohortmembership',
  'membership',
  'promptdevelopment',
  'developmentmembership',
  'sanitymembership',
  'lockedsanity',
  'heldout',
  'heldoutmembership',
  'truthcount',
  'truthcounts',
  'stratum',
  'strata',
  'samplingreason',
  'selectionreason',
  // Credentials and transport.
  'supabaseurl',
  'supabaseref',
  'supabasekey',
  'apikey',
  'openaiapikey',
  'secret',
  'token',
  'authorization',
  'password',
  'sql',
  'query',
  'connectionstring',
  'filepath',
  'localpath',
  'absolutepath',
  'statedir',
]

/**
 * Normalized key prefixes rejected wherever they appear. These cover whole families the exact
 * list above cannot enumerate.
 */
export const PACKET_FORBIDDEN_KEY_PREFIXES: readonly string[] = [
  'physician',
  'gold',
  'coordinator',
  'heldout',
  'review',
  'enrichment',
  'provenance',
  'supabase',
  'truth',
  'sanity',
]

const FORBIDDEN_KEY_SET: ReadonlySet<string> = new Set(PACKET_FORBIDDEN_NORMALIZED_KEYS)

export function normalizePacketKey(value: string): string {
  return value.replace(/[^a-z0-9]/giu, '').toLowerCase()
}

export class PacketLeakageError extends Error {
  constructor(path: string, key: string) {
    // The offending value is never echoed; echoing it would be the disclosure this guards.
    super(
      `A forbidden field entered a model-facing payload at ${path}.${key}. The value is ` +
        'deliberately not echoed.',
    )
    this.name = 'PacketLeakageError'
  }
}

/**
 * Recursive normalized forbidden-key scan over any candidate model-facing value. Throws on the
 * first violation with the dotted path (never the value).
 */
export function assertNoForbiddenPacketKeys(value: unknown, path = 'packet'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenPacketKeys(item, `${path}[${index}]`))
    return
  }
  if (value === null || typeof value !== 'object') {
    return
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizePacketKey(key)
    if (
      FORBIDDEN_KEY_SET.has(normalized) ||
      PACKET_FORBIDDEN_KEY_PREFIXES.some((prefix) => normalized.startsWith(prefix))
    ) {
      throw new PacketLeakageError(path, key)
    }
    assertNoForbiddenPacketKeys(child, `${path}.${key}`)
  }
}

export type UniversalPacketValidation =
  | { readonly ok: true; readonly packet: UniversalPacket }
  | { readonly ok: false; readonly issues: readonly string[] }

/**
 * Full packet admission: the forbidden-key scan runs first (leakage-specific error naming the
 * path), then the strict structural allowlist. Only a value passing both is a packet.
 */
export function validateUniversalPacket(value: unknown): UniversalPacketValidation {
  assertNoForbiddenPacketKeys(value)
  const parsed = universalPacketSchema.safeParse(value)
  if (parsed.success) {
    return { ok: true, packet: parsed.data }
  }
  const issues = parsed.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
    return `${path}: ${issue.message}`
  })
  return { ok: false, issues }
}
