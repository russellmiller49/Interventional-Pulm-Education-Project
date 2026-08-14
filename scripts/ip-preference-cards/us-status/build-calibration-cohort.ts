import { createHash } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { formatJson } from '../format-json'
import { exactIdentifierComparison, splitAlternateIdentifiers } from '../openfda/normalize'
import { hiddenProductCohortManifestSchema } from './schemas'

const DEFAULT_MANIFEST =
  'data/ip-preference-cards/research/us-status/2026-08-13/cohort-manifest.json'
const DEFAULT_OUTPUT =
  'data/ip-preference-cards/research/us-status/2026-08-13/calibration-cohort.json'
const CATALOG_PATH = 'data/ip-preference-cards/generated/catalog-products.json'
const BACKLOG_PATH = 'data/ip-preference-cards/generated/verification-backlog.json'
const ALLOWED_OUTPUT_ROOT = path.resolve('data/ip-preference-cards/research/us-status')

export const CALIBRATION_CHALLENGES = [
  'exact_di_candidate',
  'exact_manufacturer_catalog_candidate',
  'manufacturer_model_candidate',
  'reviewed_manufacturer_alias',
  'multiple_package_configurations',
  'conflicting_distribution_states',
  'legacy_product',
  'capital_equipment',
  'disposable_device',
  'premarket_exempt_candidate',
  'discontinued_candidate',
  'no_udi_candidate',
  'candidate_or_unknown_verification_grade',
  'adjacent_sku_trap',
  'broad_line_manufacturer',
  'device_intelligence_exemplar',
  'noncommercial_or_local_candidate',
] as const

type CalibrationChallenge = (typeof CALIBRATION_CHALLENGES)[number]

const MINIMUM_CHALLENGE_COUNTS: Record<CalibrationChallenge, number> = {
  exact_di_candidate: 5,
  exact_manufacturer_catalog_candidate: 5,
  manufacturer_model_candidate: 3,
  reviewed_manufacturer_alias: 4,
  multiple_package_configurations: 4,
  conflicting_distribution_states: 4,
  legacy_product: 4,
  capital_equipment: 4,
  disposable_device: 4,
  premarket_exempt_candidate: 4,
  discontinued_candidate: 4,
  no_udi_candidate: 4,
  candidate_or_unknown_verification_grade: 6,
  adjacent_sku_trap: 4,
  broad_line_manufacturer: 4,
  device_intelligence_exemplar: 8,
  noncommercial_or_local_candidate: 1,
}

const catalogRowSchema = z
  .object({
    product_id: z.string(),
    product_kind: z.string().nullable(),
    reuse_status: z.string().nullable(),
    primary_source_id: z.string().nullable(),
  })
  .passthrough()

const backlogRowSchema = z
  .object({
    product_id: z.string(),
    existing_gtin: z.string().nullable().optional(),
    suggested_primary_di: z.string().nullable().optional(),
    gudid_result: z.string().nullable().optional(),
    distribution_status: z.string().nullable().optional(),
    priority: z.string().nullable().optional(),
  })
  .passthrough()

export const calibrationCohortSchema = z
  .object({
    format_version: z.literal(1),
    generated_by: z.literal('scripts/ip-preference-cards/us-status/build-calibration-cohort.ts'),
    source_manifest_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    minimum_product_count: z.literal(50),
    product_count: z.number().int().min(50),
    challenge_counts: z.record(z.enum(CALIBRATION_CHALLENGES), z.number().int().nonnegative()),
    products: z.array(
      z
        .object({
          product_id: z.string(),
          manufacturer: z.string().nullable(),
          product_name: z.string(),
          catalog_number: z.string().nullable(),
          verification_grade: z.enum(['verified_source', 'candidate', 'unknown']),
          authored_slot_use_count: z.number().int().nonnegative(),
          challenge_categories: z.array(z.enum(CALIBRATION_CHALLENGES)).min(1),
          manual_review_status: z.literal('pending'),
          manual_review_notes: z.literal(''),
          canonical_change_applied: z.literal(false),
        })
        .strict(),
    ),
    canonical_change_applied: z.literal(false),
  })
  .strict()

type Manifest = z.infer<typeof hiddenProductCohortManifestSchema>
type Product = Manifest['products'][number]
type CatalogRow = z.infer<typeof catalogRowSchema>
type BacklogRow = z.infer<typeof backlogRowSchema>

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalized(value: string | null): string | null {
  return exactIdentifierComparison(value)
}

function tagsFor(
  product: Product,
  catalog: CatalogRow,
  backlog: BacklogRow | undefined,
): CalibrationChallenge[] {
  const tags = new Set<CalibrationChallenge>()
  const diCandidate = [product.gtin_di, backlog?.existing_gtin, backlog?.suggested_primary_di].find(
    nonblank,
  )
  if (diCandidate) tags.add('exact_di_candidate')
  if (product.catalog_number && product.existing_gudid.strong_match_count > 0) {
    tags.add('exact_manufacturer_catalog_candidate')
  }
  const modelCandidates = [
    product.model_number,
    product.global_part_number,
    product.reference_part_number,
    ...splitAlternateIdentifiers(product.alternate_ids.join('; ')),
  ].filter(nonblank)
  if (modelCandidates.some((value) => normalized(value) !== normalized(product.catalog_number))) {
    tags.add('manufacturer_model_candidate')
  }
  if (
    ['Richard Wolf', 'Karl Storz', 'ERBE', 'Olympus', 'Intuitive Surgical'].includes(
      product.manufacturer ?? '',
    )
  ) {
    tags.add('reviewed_manufacturer_alias')
  }
  if (product.existing_gudid.strong_match_count > 1) tags.add('multiple_package_configurations')
  if (product.existing_gudid.distribution_evidence === 'conflicting') {
    tags.add('conflicting_distribution_states')
  }
  if (catalog.primary_source_id === 'SRC030') tags.add('legacy_product')
  if (/capital equipment/i.test(catalog.product_kind ?? '')) tags.add('capital_equipment')
  if (
    /single[ -]?use|disposable/i.test(catalog.product_kind ?? '') ||
    /single[ -]?use/i.test(catalog.reuse_status ?? '')
  ) {
    tags.add('disposable_device')
  }
  if (
    /accessory|instrument/i.test(catalog.product_kind ?? '') &&
    product.verification_grade !== 'unknown'
  ) {
    tags.add('premarket_exempt_candidate')
  }
  if (
    product.existing_gudid.distribution_evidence === 'not_in_distribution' ||
    /not in commercial distribution/i.test(backlog?.distribution_status ?? '')
  ) {
    tags.add('discontinued_candidate')
  }
  if (
    product.existing_gudid.identity_evidence === 'unmatched' ||
    /no (?:match|result)/i.test(backlog?.gudid_result ?? '')
  ) {
    tags.add('no_udi_candidate')
  }
  if (product.verification_grade !== 'verified_source') {
    tags.add('candidate_or_unknown_verification_grade')
  }
  const catalogNumber = product.catalog_number?.trim() ?? ''
  if (catalogNumber && normalized(catalogNumber) && normalized(catalogNumber)!.length <= 6) {
    tags.add('adjacent_sku_trap')
  }
  if (
    ['Olympus', 'Cook Medical', 'Teleflex', 'Cardinal Health', 'Medtronic'].includes(
      product.manufacturer ?? '',
    )
  ) {
    tags.add('broad_line_manufacturer')
  }
  if (Object.values(product.device_intelligence_exemplar_flags).some(Boolean)) {
    tags.add('device_intelligence_exemplar')
  }
  if (catalog.product_kind === 'Service' || catalogNumber === 'CUSTOM-SERVICE') {
    tags.add('noncommercial_or_local_candidate')
  }
  return [...tags].sort()
}

function candidateRank(product: Product, backlog: BacklogRow | undefined): number {
  const priority = backlog?.priority?.trim().toLocaleUpperCase('en-US')
  const priorityScore =
    priority === 'P0' ? 300 : priority === 'P1' ? 200 : priority === 'P2' ? 100 : 0
  return (
    priorityScore +
    Math.min(100, product.authored_slot_use_count * 10) +
    (product.cohort_partition === 'us_status_pending' ? 50 : 0) +
    (Object.values(product.device_intelligence_exemplar_flags).some(Boolean) ? 25 : 0)
  )
}

function countChallenges(
  selected: Array<{ tags: CalibrationChallenge[] }>,
): Record<CalibrationChallenge, number> {
  return Object.fromEntries(
    CALIBRATION_CHALLENGES.map((challenge) => [
      challenge,
      selected.filter((row) => row.tags.includes(challenge)).length,
    ]),
  ) as Record<CalibrationChallenge, number>
}

export function selectCalibrationProducts(
  manifest: Manifest,
  catalogRows: CatalogRow[],
  backlogRows: BacklogRow[],
) {
  const catalogById = new Map(catalogRows.map((row) => [row.product_id, row]))
  const backlogById = new Map(backlogRows.map((row) => [row.product_id, row]))
  const candidates = manifest.products.map((product) => {
    const catalog = catalogById.get(product.product_id)
    if (!catalog)
      throw new Error(`Calibration product ${product.product_id} is missing from catalog.`)
    const backlog = backlogById.get(product.product_id)
    return {
      product,
      tags: tagsFor(product, catalog, backlog),
      rank: candidateRank(product, backlog),
    }
  })
  const selected: typeof candidates = []
  const selectedIds = new Set<string>()

  while (
    selected.length < 50 ||
    Object.entries(MINIMUM_CHALLENGE_COUNTS).some(
      ([challenge, minimum]) =>
        countChallenges(selected)[challenge as CalibrationChallenge] < minimum,
    )
  ) {
    const counts = countChallenges(selected)
    const next = candidates
      .filter(
        (candidate) => !selectedIds.has(candidate.product.product_id) && candidate.tags.length > 0,
      )
      .map((candidate) => ({
        ...candidate,
        uncoveredScore: candidate.tags.reduce(
          (score, challenge) =>
            score + (counts[challenge] < MINIMUM_CHALLENGE_COUNTS[challenge] ? 1 : 0),
          0,
        ),
      }))
      .sort(
        (left, right) =>
          right.uncoveredScore - left.uncoveredScore ||
          right.rank - left.rank ||
          left.product.product_id.localeCompare(right.product.product_id),
      )[0]
    if (!next || (selected.length >= 50 && next.uncoveredScore === 0)) break
    selected.push(next)
    selectedIds.add(next.product.product_id)
  }

  const challengeCounts = countChallenges(selected)
  for (const [challenge, minimum] of Object.entries(MINIMUM_CHALLENGE_COUNTS)) {
    if (challengeCounts[challenge as CalibrationChallenge] < minimum) {
      throw new Error(
        `Calibration challenge ${challenge} has ${challengeCounts[challenge as CalibrationChallenge]} products; expected at least ${minimum}.`,
      )
    }
  }
  if (selected.length < 50)
    throw new Error(`Calibration cohort has only ${selected.length} products.`)
  return selected.sort((left, right) =>
    left.product.product_id.localeCompare(right.product.product_id),
  )
}

export async function buildCalibrationCohort(
  manifestPath = DEFAULT_MANIFEST,
  outputPath = DEFAULT_OUTPUT,
): Promise<void> {
  const resolvedOutput = path.resolve(outputPath)
  if (
    !resolvedOutput.startsWith(`${ALLOWED_OUTPUT_ROOT}${path.sep}`) ||
    path.extname(resolvedOutput) !== '.json'
  ) {
    throw new Error(
      'Calibration output must be JSON under data/ip-preference-cards/research/us-status/.',
    )
  }
  const [manifestText, catalogText, backlogText] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(CATALOG_PATH, 'utf8'),
    readFile(BACKLOG_PATH, 'utf8'),
  ])
  const manifest = hiddenProductCohortManifestSchema.parse(JSON.parse(manifestText))
  const catalog = catalogRowSchema.array().parse(JSON.parse(catalogText))
  const backlog = backlogRowSchema.array().parse(JSON.parse(backlogText))
  const selected = selectCalibrationProducts(manifest, catalog, backlog)
  const artifact = calibrationCohortSchema.parse({
    format_version: 1,
    generated_by: 'scripts/ip-preference-cards/us-status/build-calibration-cohort.ts',
    source_manifest_sha256: sha256(manifestText),
    minimum_product_count: 50,
    product_count: selected.length,
    challenge_counts: countChallenges(selected),
    products: selected.map(({ product, tags }) => ({
      product_id: product.product_id,
      manufacturer: product.manufacturer,
      product_name: product.product_name,
      catalog_number: product.catalog_number,
      verification_grade: product.verification_grade,
      authored_slot_use_count: product.authored_slot_use_count,
      challenge_categories: tags,
      manual_review_status: 'pending',
      manual_review_notes: '',
      canonical_change_applied: false,
    })),
    canonical_change_applied: false,
  })
  const temporaryPath = `${resolvedOutput}.tmp-${process.pid}`
  await writeFile(temporaryPath, await formatJson(artifact), 'utf8')
  await rename(temporaryPath, resolvedOutput)
}

function valueAfter(args: string[], option: string, fallback: string): string {
  const index = args.indexOf(option)
  if (index < 0) return fallback
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`)
  return value
}

async function main() {
  const args = process.argv.slice(2)
  const known = new Set(['--manifest', '--output'])
  for (let index = 0; index < args.length; index += 2) {
    if (!known.has(args[index])) throw new Error(`Unknown option: ${args[index]}`)
  }
  if (!args.includes('--output')) {
    throw new Error('--output is required for a dated, noncanonical research artifact.')
  }
  const outputPath = valueAfter(args, '--output', DEFAULT_OUTPUT)
  await buildCalibrationCohort(valueAfter(args, '--manifest', DEFAULT_MANIFEST), outputPath)
  console.log(`Wrote stratified current-status calibration cohort to ${outputPath}.`)
}

if (process.argv[1]?.endsWith('build-calibration-cohort.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
