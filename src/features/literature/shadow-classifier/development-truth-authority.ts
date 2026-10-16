import { createHash } from 'node:crypto'

import { z } from 'zod'

import { immutableShadowValue, sha256ShadowValue } from './canonical'
import {
  LITERATURE_DEVELOPMENT_COHORT_SIZE,
  PINNED_DEVELOPMENT_MEMBERSHIP_SHA256,
} from './held-out-guard'

export const PINNED_SHADOW_DEVELOPMENT_SOURCE_SHA256 =
  'd2942507531a4ba55a5a4195a6919c959eff77cd3473a83eeae16074861b1e64' as const
export const PINNED_SHADOW_DEVELOPMENT_TRUTH_SHA256 =
  '961c19f4ea1c6a82e061369fd33d927e804360f10781729f8049073a4b6d0f59' as const
export const SHADOW_DEVELOPMENT_TRUTH_SCHEMA_VERSION =
  'literature-shadow-development-coordinator-truth/1.0.0' as const

const TRUTH_BRAND: unique symbol = Symbol('authorized-shadow-development-truth')
const authorizedTruth = new WeakSet<object>()
const labelSchema = z.enum(['include_core', 'include_adjacent', 'exclude'])
const metadataSchema = z.enum([
  'adequate_abstract',
  'limited_abstract',
  'no_abstract',
  'conflicting_metadata',
])

export interface ShadowDevelopmentTruthRow {
  pmid: string
  relevanceLabel: z.infer<typeof labelSchema>
  metadataSufficiency: z.infer<typeof metadataSchema>
  topicIds: readonly string[]
  technologyTags: readonly string[]
  clinicalPurposes: readonly string[]
  diseaseTags: readonly string[]
  studyDesign: string
  publicationStatus: string
  categorizationFromFullText: boolean
  fullTextUsed: boolean
  journal: string
  publicationYear: number
}

export interface ShadowDevelopmentTruthArtifact {
  schemaVersion: typeof SHADOW_DEVELOPMENT_TRUTH_SCHEMA_VERSION
  coordinatorOnly: true
  modelFacing: false
  sourceSha256: typeof PINNED_SHADOW_DEVELOPMENT_SOURCE_SHA256
  truthSourceSha256: typeof PINNED_SHADOW_DEVELOPMENT_TRUTH_SHA256
  developmentMembershipSha256: typeof PINNED_DEVELOPMENT_MEMBERSHIP_SHA256
  rowCount: typeof LITERATURE_DEVELOPMENT_COHORT_SIZE
  rows: readonly ShadowDevelopmentTruthRow[]
  truthArtifactSha256: string
}

export interface AuthorizedShadowDevelopmentTruth extends ShadowDevelopmentTruthArtifact {
  readonly [TRUTH_BRAND]: typeof TRUTH_BRAND
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function csvRows(bytes: Uint8Array, expectedSha256: string, label: string): string[][] {
  if (sha256(bytes) !== expectedSha256) throw new Error(`${label} checksum is not exact.`)
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  if (text.startsWith('\uFEFF')) throw new Error(`${label} cannot contain a byte-order mark.`)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (character === '"') quoted = false
      else cell += character
    } else if (character === '"') quoted = true
    else if (character === ',') {
      row.push(cell)
      cell = ''
    } else if (character === '\n') {
      row.push(cell.replace(/\r$/u, ''))
      rows.push(row)
      row = []
      cell = ''
    } else cell += character
  }
  if (quoted) throw new Error(`${label} contains unterminated CSV quoting.`)
  if (cell || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  if (rows.length !== LITERATURE_DEVELOPMENT_COHORT_SIZE + 1) {
    throw new Error(`${label} must contain one header and exact 630 rows.`)
  }
  return rows
}

function records(rows: string[][], requiredColumns: readonly string[], label: string) {
  const header = rows[0] ?? []
  const indexes = Object.fromEntries(
    requiredColumns.map((column) => {
      const index = header.indexOf(column)
      if (index < 0) throw new Error(`${label} lacks required column ${column}.`)
      return [column, index]
    }),
  ) as Record<string, number>
  return rows.slice(1).map((cells, rowIndex) => {
    if (cells.length !== header.length)
      throw new Error(`${label} row ${rowIndex + 2} width is invalid.`)
    return Object.fromEntries(
      requiredColumns.map((column) => [column, cells[indexes[column]!]!]),
    ) as Record<string, string>
  })
}

function pipe(raw: string): string[] {
  return raw === '' ? [] : raw.split('|')
}

/** The only real-truth mint: both exact pinned byte streams are required. */
export function authorizeShadowDevelopmentTruthFromPinnedBytes(input: {
  sourceBytes: Uint8Array
  truthBytes: Uint8Array
}): AuthorizedShadowDevelopmentTruth {
  const source = records(
    csvRows(input.sourceBytes, PINNED_SHADOW_DEVELOPMENT_SOURCE_SHA256, 'source-v2'),
    [
      'dataset_split',
      'gold_set_item_id',
      'pmid',
      'title',
      'abstract',
      'journal',
      'publication_year',
      'physician_final_label',
    ],
    'source-v2',
  )
  const truth = records(
    csvRows(input.truthBytes, PINNED_SHADOW_DEVELOPMENT_TRUTH_SHA256, 'final truth'),
    [
      'source_sha256',
      'dataset_split',
      'gold_set_item_id',
      'pmid',
      'title',
      'abstract',
      'journal',
      'publication_year',
      'physician_final_label',
      'metadata_sufficiency',
      'topic_ids',
      'technology_tags',
      'clinical_purposes',
      'disease_tags',
      'study_design',
      'publication_status',
      'categorization_from_full_text',
      'full_text_used',
      'processing_status',
      'import_ready',
    ],
    'final truth',
  )
  const sourceByPmid = new Map<string, Record<string, string>>()
  for (const row of source) {
    if (row.dataset_split !== 'development' || !/^[0-9]{1,12}$/u.test(row.pmid!)) {
      throw new Error('Pinned source is not exact development membership.')
    }
    if (sourceByPmid.has(row.pmid!)) throw new Error('Pinned source PMIDs are not unique.')
    sourceByPmid.set(row.pmid!, row)
  }
  const seen = new Set<string>()
  const truthRows = truth.map((row): ShadowDevelopmentTruthRow => {
    const sourceRow = sourceByPmid.get(row.pmid!)
    if (
      !sourceRow ||
      seen.has(row.pmid!) ||
      row.source_sha256 !== PINNED_SHADOW_DEVELOPMENT_SOURCE_SHA256 ||
      row.dataset_split !== 'development' ||
      row.processing_status !== 'valid' ||
      row.import_ready !== 'true' ||
      [
        'gold_set_item_id',
        'title',
        'abstract',
        'journal',
        'publication_year',
        'physician_final_label',
      ].some((field) => sourceRow[field] !== row[field])
    ) {
      throw new Error('Final truth is not an exact one-to-one binding to source-v2.')
    }
    seen.add(row.pmid!)
    return {
      pmid: row.pmid!,
      relevanceLabel: labelSchema.parse(row.physician_final_label),
      metadataSufficiency: metadataSchema.parse(row.metadata_sufficiency),
      topicIds: pipe(row.topic_ids!),
      technologyTags: pipe(row.technology_tags!),
      clinicalPurposes: pipe(row.clinical_purposes!),
      diseaseTags: pipe(row.disease_tags!),
      studyDesign: row.study_design!,
      publicationStatus: row.publication_status!,
      categorizationFromFullText: row.categorization_from_full_text === 'true',
      fullTextUsed: row.full_text_used === 'true',
      journal: row.journal!,
      publicationYear: z.coerce.number().int().parse(row.publication_year),
    }
  })
  if (seen.size !== sourceByPmid.size)
    throw new Error('Final truth does not cover source-v2 exactly.')
  truthRows.sort(
    (left, right) => left.pmid.length - right.pmid.length || left.pmid.localeCompare(right.pmid),
  )
  const withoutHash = {
    schemaVersion: SHADOW_DEVELOPMENT_TRUTH_SCHEMA_VERSION,
    coordinatorOnly: true as const,
    modelFacing: false as const,
    sourceSha256: PINNED_SHADOW_DEVELOPMENT_SOURCE_SHA256,
    truthSourceSha256: PINNED_SHADOW_DEVELOPMENT_TRUTH_SHA256,
    developmentMembershipSha256: PINNED_DEVELOPMENT_MEMBERSHIP_SHA256,
    rowCount: LITERATURE_DEVELOPMENT_COHORT_SIZE,
    rows: truthRows,
  }
  const capability = {
    ...immutableShadowValue({
      ...withoutHash,
      truthArtifactSha256: sha256ShadowValue(withoutHash),
    }),
  } as unknown as AuthorizedShadowDevelopmentTruth
  Object.defineProperty(capability, TRUTH_BRAND, { value: TRUTH_BRAND })
  Object.freeze(capability)
  authorizedTruth.add(capability)
  return capability
}

export function assertAuthorizedShadowDevelopmentTruth(
  truth: AuthorizedShadowDevelopmentTruth,
): void {
  if (!authorizedTruth.has(truth) || truth[TRUTH_BRAND] !== TRUTH_BRAND) {
    throw new Error('Serialized, copied, or rehashed development truth is not authorized.')
  }
}
