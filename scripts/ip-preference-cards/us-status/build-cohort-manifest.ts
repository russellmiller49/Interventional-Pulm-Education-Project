import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { formatJson } from '../format-json'
import { buildHiddenProductCohortManifest } from './cohort'
import {
  cohortCatalogProductSchema,
  cohortGudidReportSchema,
  cohortOpenFdaProposalSchema,
  cohortOpenFdaRunSummarySchema,
  cohortProcedureSlotSchema,
  cohortProductRoleSchema,
  cohortProductSourceSchema,
  cohortSlotProductOptionSchema,
} from './schemas'

const GENERATED_DIRECTORY = 'data/ip-preference-cards/generated'
const ALLOWED_OUTPUT_DIRECTORY = path.resolve('data/ip-preference-cards/research', 'us-status')

const INPUT_PATHS = {
  catalogProducts: path.join(GENERATED_DIRECTORY, 'catalog-products.json'),
  productRoles: path.join(GENERATED_DIRECTORY, 'product-roles.json'),
  procedureSlots: path.join(GENERATED_DIRECTORY, 'procedure-slots.json'),
  slotProductOptions: path.join(GENERATED_DIRECTORY, 'slot-product-options.json'),
  productSources: path.join(GENERATED_DIRECTORY, 'product-sources.json'),
  gudidReport: path.join(GENERATED_DIRECTORY, 'gudid-confirmations.json'),
  openFdaProposals: path.join(GENERATED_DIRECTORY, 'openfda', 'enrichment-proposals.json'),
  openFdaRunSummary: path.join(GENERATED_DIRECTORY, 'openfda', 'run-summary.json'),
} as const

export interface CohortManifestCliOptions {
  outputPath: string
}

function requiredArgumentValue(args: string[], index: number, option: string): string {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`)
  return value
}

export function parseCohortManifestArgs(args: string[]): CohortManifestCliOptions {
  let outputPath: string | null = null
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument !== '--output') throw new Error(`Unknown option: ${argument}`)
    if (outputPath !== null) throw new Error('--output may be specified only once.')
    outputPath = requiredArgumentValue(args, index, argument)
    index += 1
  }
  if (!outputPath) {
    throw new Error(
      '--output is required and must name a JSON file under data/ip-preference-cards/research/us-status/.',
    )
  }
  return { outputPath }
}

export function validatedCohortOutputPath(outputPath: string): string {
  const resolved = path.resolve(outputPath)
  if (
    !resolved.startsWith(`${ALLOWED_OUTPUT_DIRECTORY}${path.sep}`) ||
    path.extname(resolved).toLocaleLowerCase('en-US') !== '.json'
  ) {
    throw new Error(
      `Cohort output must be a JSON file under ${path.relative(process.cwd(), ALLOWED_OUTPUT_DIRECTORY)}/.`,
    )
  }
  return resolved
}

function sha256(contents: Buffer): string {
  return createHash('sha256').update(contents).digest('hex')
}

function parseJson(contents: Buffer): unknown {
  return JSON.parse(contents.toString('utf8')) as unknown
}

export async function buildCohortManifestFromRepository() {
  const [
    catalogProductsRaw,
    productRolesRaw,
    procedureSlotsRaw,
    slotProductOptionsRaw,
    productSourcesRaw,
    gudidReportRaw,
    openFdaProposalsRaw,
    openFdaRunSummaryRaw,
  ] = await Promise.all(Object.values(INPUT_PATHS).map((filename) => readFile(filename)))

  return buildHiddenProductCohortManifest({
    catalogProducts: cohortCatalogProductSchema.array().parse(parseJson(catalogProductsRaw)),
    productRoles: cohortProductRoleSchema.array().parse(parseJson(productRolesRaw)),
    procedureSlots: cohortProcedureSlotSchema.array().parse(parseJson(procedureSlotsRaw)),
    slotProductOptions: cohortSlotProductOptionSchema
      .array()
      .parse(parseJson(slotProductOptionsRaw)),
    productSources: cohortProductSourceSchema.array().parse(parseJson(productSourcesRaw)),
    gudidReport: cohortGudidReportSchema.parse(parseJson(gudidReportRaw)),
    openFdaProposals: cohortOpenFdaProposalSchema.array().parse(parseJson(openFdaProposalsRaw)),
    openFdaRunSummary: cohortOpenFdaRunSummarySchema.parse(parseJson(openFdaRunSummaryRaw)),
    inputHashes: {
      catalog_products_sha256: sha256(catalogProductsRaw),
      product_roles_sha256: sha256(productRolesRaw),
      procedure_slots_sha256: sha256(procedureSlotsRaw),
      slot_product_options_sha256: sha256(slotProductOptionsRaw),
      product_sources_sha256: sha256(productSourcesRaw),
      gudid_confirmations_sha256: sha256(gudidReportRaw),
      openfda_proposals_sha256: sha256(openFdaProposalsRaw),
      openfda_run_summary_sha256: sha256(openFdaRunSummaryRaw),
    },
    gitSha: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).trim(),
  })
}

export async function runBuildCohortManifest(options: CohortManifestCliOptions): Promise<string> {
  const outputPath = validatedCohortOutputPath(options.outputPath)
  const manifest = await buildCohortManifestFromRepository()
  const temporaryPath = `${outputPath}.tmp-${process.pid}`
  await mkdir(path.dirname(outputPath), { recursive: true })
  try {
    await writeFile(temporaryPath, await formatJson(manifest), 'utf8')
    await rename(temporaryPath, outputPath)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
  return outputPath
}

async function main() {
  const outputPath = await runBuildCohortManifest(parseCohortManifestArgs(process.argv.slice(2)))
  console.log(`Wrote deterministic hidden-product cohort manifest to ${outputPath}.`)
}

if (process.argv[1]?.endsWith('build-cohort-manifest.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
