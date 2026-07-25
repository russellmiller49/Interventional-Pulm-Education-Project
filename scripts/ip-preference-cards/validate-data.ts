import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

const DEFAULT_DIRECTORY = 'data/ip-preference-cards/generated'

const nullableText = z.string().nullable()

const productSchema = z
  .object({
    product_id: z.string().min(1),
    manufacturer_id: z.string().min(1),
    product_name: z.string().min(1),
    catalog_number: nullableText,
    gtin: nullableText.refine(
      (value) => value === null || /^\d{14}$/.test(value) || /^\d{16}$/.test(value),
      'GTIN must be a reviewable 14- or 16-digit string',
    ),
    visibility_state: z.enum(['prototype_visible', 'hidden']),
    verification_grade: z.enum(['verified_source', 'candidate', 'unknown']),
  })
  .passthrough()

const roleSchema = z
  .object({
    role_code: z.string().min(1),
    role_name: z.string().min(1),
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
    role_code: z.string().min(1),
    requiredness: z.enum(['required', 'conditional', 'optional']),
    selection_mode: z.enum(['single', 'multiple']),
  })
  .passthrough()

const importReportSchema = z
  .object({
    workbook_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    counts: z.record(z.string(), z.number().int().nonnegative()),
    foreign_key_errors: z.array(z.unknown()).length(0),
    duplicate_ids: z.record(z.string(), z.array(z.unknown())),
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

export async function validateGeneratedCatalog(options?: { generatedDirectory?: string }) {
  const generatedDirectory = path.resolve(
    process.cwd(),
    options?.generatedDirectory ?? process.env.IP_CARDS_OUTPUT_DIR ?? DEFAULT_DIRECTORY,
  )

  const [products, roles, procedures, slots, importReport] = await Promise.all([
    loadJson(generatedDirectory, 'catalog-products.json', z.array(productSchema)),
    loadJson(generatedDirectory, 'roles.json', z.array(roleSchema)),
    loadJson(generatedDirectory, 'procedures.json', z.array(procedureSchema)),
    loadJson(generatedDirectory, 'procedure-slots.json', z.array(slotSchema)),
    loadJson(generatedDirectory, 'import-report.json', importReportSchema),
  ])

  const duplicateGroups = Object.values(importReport.duplicate_ids).reduce(
    (total, duplicates) => total + duplicates.length,
    0,
  )
  if (duplicateGroups > 0) {
    throw new Error(`Generated data contains ${duplicateGroups} duplicate identifier groups.`)
  }

  return {
    products: products.length,
    roles: roles.length,
    procedures: procedures.length,
    procedureSlots: slots.length,
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
