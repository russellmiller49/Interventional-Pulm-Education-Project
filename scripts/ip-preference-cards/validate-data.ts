import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import {
  generateSlotOptionProposals,
  serializeSlotOptionProposalArtifact,
  SLOT_OPTION_PROPOSAL_FILENAME,
  slotOptionProposalArtifactSchema,
} from './derive-slot-option-proposals'

const DEFAULT_DIRECTORY = 'data/ip-preference-cards/generated'

const nullableText = z.string().nullable()

const productSchema = z
  .object({
    product_id: z.string().min(1),
    manufacturer_id: z.string().min(1),
    manufacturer: nullableText,
    product_name: z.string().min(1),
    catalog_number: nullableText,
    gtin: nullableText.refine(
      (value) => value === null || /^\d{14}$/.test(value) || /^\d{16}$/.test(value),
      'GTIN must be a reviewable 14- or 16-digit string',
    ),
    visibility_state: z.enum(['prototype_visible', 'hidden']),
    verification_grade: z.enum(['verified_source', 'candidate', 'unknown']),
    primary_source_id: nullableText,
    primary_source_location: nullableText,
  })
  .passthrough()

const roleSchema = z
  .object({
    role_code: z.string().min(1),
    role_name: z.string().min(1),
  })
  .passthrough()

const productRoleSchema = z
  .object({
    product_id: z.string().min(1),
    role_code: z.string().min(1),
    role_fit: nullableText,
    notes: nullableText.optional(),
  })
  .passthrough()

const procedureSchema = z
  .object({
    procedure_code: z.string().min(1),
    procedure_name: z.string().min(1),
  })
  .passthrough()

const slotSchema = z
  .object({
    slot_id: z.string().min(1),
    procedure_code: z.string().min(1),
    display_order: z.number().int(),
    slot_label: z.string().min(1),
    role_code: z.string().min(1),
    requiredness: z.enum(['required', 'conditional', 'optional']),
    selection_mode: z.enum(['single', 'multiple']),
    allow_custom: z.boolean(),
  })
  .passthrough()

const slotOptionSchema = z
  .object({
    slot_id: z.string().min(1),
    product_id: z.string().min(1),
    role_code: z.string().min(1),
    visible_by_default: z.boolean(),
    product_visibility: z.enum(['prototype_visible', 'hidden']),
    selectable: z.boolean(),
  })
  .passthrough()

const proposalSummarySchema = z.object({
  authored_canonical_options: z.number().int().nonnegative(),
  generated_unreviewed_proposals: z.number().int().nonnegative(),
  excluded_proposal_pairs: z.number().int().nonnegative(),
  required_slots_with_catalog_coverage: z.number().int().nonnegative(),
  required_slots_with_curated_defaults: z.number().int().nonnegative(),
  authored_row_errors: z.literal(0),
  stale_exceptions: z.literal(0),
  proposal_generation_errors: z.literal(0),
})

const importReportSchema = z
  .object({
    workbook_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    counts: z.record(z.string(), z.number().int().nonnegative()),
    foreign_key_errors: z.array(z.unknown()).length(0),
    duplicate_ids: z.record(z.string(), z.array(z.unknown())),
    slot_option_proposals: proposalSummarySchema,
  })
  .passthrough()

async function loadJson<T>(
  generatedDirectory: string,
  filename: string,
  schema: z.ZodType<T>,
): Promise<T> {
  return schema.parse(
    JSON.parse(await readFile(path.join(generatedDirectory, filename), 'utf8')) as unknown,
  )
}

export async function validateGeneratedCatalog(options?: {
  generatedDirectory?: string
  exceptionFile?: string
}) {
  const generatedDirectory = path.resolve(
    process.cwd(),
    options?.generatedDirectory ?? process.env.IP_CARDS_OUTPUT_DIR ?? DEFAULT_DIRECTORY,
  )

  const [
    products,
    roles,
    productRoles,
    procedures,
    slots,
    authoredOptions,
    importReport,
    proposalArtifact,
    proposalArtifactText,
  ] = await Promise.all([
    loadJson(generatedDirectory, 'catalog-products.json', z.array(productSchema)),
    loadJson(generatedDirectory, 'roles.json', z.array(roleSchema)),
    loadJson(generatedDirectory, 'product-roles.json', z.array(productRoleSchema)),
    loadJson(generatedDirectory, 'procedures.json', z.array(procedureSchema)),
    loadJson(generatedDirectory, 'procedure-slots.json', z.array(slotSchema)),
    loadJson(generatedDirectory, 'slot-product-options.json', z.array(slotOptionSchema)),
    loadJson(generatedDirectory, 'import-report.json', importReportSchema),
    loadJson(generatedDirectory, SLOT_OPTION_PROPOSAL_FILENAME, slotOptionProposalArtifactSchema),
    readFile(path.join(generatedDirectory, SLOT_OPTION_PROPOSAL_FILENAME), 'utf8'),
  ])

  const duplicateGroups = Object.values(importReport.duplicate_ids).reduce(
    (total, duplicates) => total + duplicates.length,
    0,
  )
  if (duplicateGroups > 0) {
    throw new Error(`Generated data contains ${duplicateGroups} duplicate identifier groups.`)
  }
  if (importReport.counts.Slot_Product_Options !== authoredOptions.length) {
    throw new Error(
      `Import report records ${String(importReport.counts.Slot_Product_Options)} authored slot options, but the canonical file contains ${authoredOptions.length}.`,
    )
  }

  const expectedArtifact = await generateSlotOptionProposals({
    generatedDirectory,
    exceptionFile: options?.exceptionFile,
    write: false,
  })
  const expectedArtifactText = serializeSlotOptionProposalArtifact(expectedArtifact)
  if (proposalArtifactText !== expectedArtifactText) {
    throw new Error(
      `${SLOT_OPTION_PROPOSAL_FILENAME} differs from a fresh deterministic regeneration.`,
    )
  }
  if (
    JSON.stringify(importReport.slot_option_proposals) !== JSON.stringify(expectedArtifact.summary)
  ) {
    throw new Error('Import report slot-option proposal counts do not match regenerated output.')
  }
  if (
    proposalArtifact.proposals.length !== proposalArtifact.summary.generated_unreviewed_proposals
  ) {
    throw new Error('Proposal artifact summary does not match its proposal row count.')
  }

  return {
    products: products.length,
    roles: roles.length,
    productRoles: productRoles.length,
    procedures: procedures.length,
    procedureSlots: slots.length,
    authoredSlotOptions: authoredOptions.length,
    unreviewedSlotOptionProposals: proposalArtifact.proposals.length,
    excludedSlotOptionProposals: proposalArtifact.summary.excluded_proposal_pairs,
    staleSlotOptionExceptions: proposalArtifact.summary.stale_exceptions,
    workbookSha256: importReport.workbook_sha256,
  }
}

if (process.argv[1] && /validate-data\.(?:ts|js)$/.test(process.argv[1])) {
  validateGeneratedCatalog()
    .then((summary) => {
      console.log('IP preference-card generated data is valid.')
      console.log(JSON.stringify(summary, null, 2))
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
}
