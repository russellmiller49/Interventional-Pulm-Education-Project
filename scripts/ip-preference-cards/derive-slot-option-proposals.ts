import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { calculateProcedureCoverage } from './coverage-metrics'

const DEFAULT_GENERATED_DIRECTORY = 'data/ip-preference-cards/generated'
const DEFAULT_EXCEPTION_FILE = 'data/ip-preference-cards/seed/slot-option-exceptions.json'

export const SLOT_OPTION_PROPOSAL_FILENAME = 'slot-product-option-proposals.json'

const identifierSchema = z.string().trim().min(1).max(160)
const rationaleSchema = z
  .string()
  .trim()
  .min(20, 'rationale must contain a substantive review reason')
  .refine(
    (value) => value.split(/\s+/).filter(Boolean).length >= 4,
    'rationale must contain at least four words',
  )

export const slotOptionExceptionSchema = z
  .object({
    product_id: identifierSchema,
    slot_id: identifierSchema.optional(),
    role_code: identifierSchema.optional(),
    procedure_code: identifierSchema.optional(),
    rationale_category: z.enum(['clinical', 'dimensional', 'kit', 'compatibility']),
    rationale: rationaleSchema,
  })
  .strict()
  .superRefine((exception, context) => {
    if (!exception.slot_id && !exception.role_code) {
      context.addIssue({
        code: 'custom',
        message: 'an exception must narrow by exact slot_id or role_code',
        path: ['slot_id'],
      })
    }
  })

export const slotOptionExceptionsSchema = z.array(slotOptionExceptionSchema)
export type SlotOptionException = z.infer<typeof slotOptionExceptionSchema>

export interface ProposalProductRow {
  product_id: string
  manufacturer_id: string
  manufacturer: string | null
  product_name: string
  catalog_number: string | null
  verification_grade: string | null
  visibility_state: string | null
  primary_source_id: string | null
  primary_source_location: string | null
  spec_json?: unknown
}

export interface ProposalProductRoleRow {
  product_id: string
  role_code: string
  role_fit: string | null
  notes?: string | null
}

export interface ProposalProcedureRow {
  procedure_code: string
}

export interface ProposalRoleRow {
  role_code: string
}

export interface ProposalSlotRow {
  slot_id: string
  procedure_code: string
  display_order: number
  slot_label: string
  requiredness: string
  role_code: string
  allow_custom?: boolean
}

export interface AuthoredSlotOptionRow {
  slot_id: string
  product_id: string
  role_code: string
  visible_by_default: boolean | null
  selectable: boolean | null
  [key: string]: unknown
}

export interface DistributionConfirmationRow {
  product_id: string
  match_strength: string
  gudid_distribution_status: string
}

export interface SlotOptionProposal {
  slot_id: string
  procedure_code: string
  slot_display_order: number
  slot_label: string
  requiredness: string
  role_code: string
  product_id: string
  manufacturer_id: string
  manufacturer: string | null
  product_name: string
  catalog_number: string | null
  role_fit: string | null
  product_verification_grade: string | null
  product_visibility_state: string | null
  current_distribution_status: 'in_distribution' | 'not_in_distribution' | null
  proposal_origin: 'product_role_join'
  proposal_status: 'unreviewed'
  selectable: false
  visible_by_default: false
  reason_code: 'missing_authored_slot_product_option'
  reason: string
  source_identifiers: {
    procedure_slot_id: string
    product_role_key: string
    primary_source_id: string | null
    primary_source_location: string | null
  }
}

export interface SlotOptionProposalSummary {
  authored_canonical_options: number
  generated_unreviewed_proposals: number
  excluded_proposal_pairs: number
  required_slots_with_catalog_coverage: number
  required_slots_with_curated_defaults: number
  authored_row_errors: number
  stale_exceptions: number
  proposal_generation_errors: number
}

export interface SlotOptionProposalArtifact {
  format_version: 1
  semantics: {
    product_roles: 'broad_catalog_discovery'
    slot_product_options: 'curated_exact_slot_defaults'
    proposal_rows: 'unreviewed_not_selectable'
  }
  summary: SlotOptionProposalSummary
  proposals: SlotOptionProposal[]
}

export function serializeSlotOptionProposalArtifact(artifact: SlotOptionProposalArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`
}

export const slotOptionProposalSchema = z
  .object({
    slot_id: identifierSchema,
    procedure_code: identifierSchema,
    slot_display_order: z.number().int(),
    slot_label: z.string().min(1),
    requiredness: z.string().min(1),
    role_code: identifierSchema,
    product_id: identifierSchema,
    manufacturer_id: identifierSchema,
    manufacturer: z.string().nullable(),
    product_name: z.string().min(1),
    catalog_number: z.string().nullable(),
    role_fit: z.string().nullable(),
    product_verification_grade: z.string().nullable(),
    product_visibility_state: z.string().nullable(),
    current_distribution_status: z.enum(['in_distribution', 'not_in_distribution']).nullable(),
    proposal_origin: z.literal('product_role_join'),
    proposal_status: z.literal('unreviewed'),
    selectable: z.literal(false),
    visible_by_default: z.literal(false),
    reason_code: z.literal('missing_authored_slot_product_option'),
    reason: z.string().min(1),
    source_identifiers: z
      .object({
        procedure_slot_id: identifierSchema,
        product_role_key: z.string().min(1),
        primary_source_id: z.string().nullable(),
        primary_source_location: z.string().nullable(),
      })
      .strict(),
  })
  .strict()

export const slotOptionProposalArtifactSchema = z
  .object({
    format_version: z.literal(1),
    semantics: z
      .object({
        product_roles: z.literal('broad_catalog_discovery'),
        slot_product_options: z.literal('curated_exact_slot_defaults'),
        proposal_rows: z.literal('unreviewed_not_selectable'),
      })
      .strict(),
    summary: z
      .object({
        authored_canonical_options: z.number().int().nonnegative(),
        generated_unreviewed_proposals: z.number().int().nonnegative(),
        excluded_proposal_pairs: z.number().int().nonnegative(),
        required_slots_with_catalog_coverage: z.number().int().nonnegative(),
        required_slots_with_curated_defaults: z.number().int().nonnegative(),
        authored_row_errors: z.literal(0),
        stale_exceptions: z.literal(0),
        proposal_generation_errors: z.literal(0),
      })
      .strict(),
    proposals: z.array(slotOptionProposalSchema),
  })
  .strict()

export class SlotOptionIntegrityError extends Error {
  readonly errors: string[]

  constructor(errors: string[]) {
    const sortedErrors = [...errors].sort(compareText)
    super(
      `Slot-option integrity validation failed with ${sortedErrors.length} error(s):\n${sortedErrors.join('\n')}`,
    )
    this.name = 'SlotOptionIntegrityError'
    this.errors = sortedErrors
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function pairKey(slotId: string, productId: string): string {
  return `${slotId}\u0000${productId}`
}

function productRoleKey(productId: string, roleCode: string): string {
  return `${productId}\u0000${roleCode}`
}

function exceptionKey(exception: SlotOptionException): string {
  return [
    exception.product_id,
    exception.slot_id ?? '',
    exception.role_code ?? '',
    exception.procedure_code ?? '',
  ].join('\u0000')
}

function distributionStatus(value: unknown): 'in_distribution' | 'not_in_distribution' | null {
  return typeof value === 'string' && /^In Commercial Distribution$/i.test(value)
    ? 'in_distribution'
    : typeof value === 'string' && /^Not in Commercial Distribution$/i.test(value)
      ? 'not_in_distribution'
      : null
}

function buildDistributionMap(
  products: ProposalProductRow[],
  confirmations: DistributionConfirmationRow[],
): Map<string, 'in_distribution' | 'not_in_distribution'> {
  const statuses = new Map<string, Set<'in_distribution' | 'not_in_distribution'>>()
  for (const product of products) {
    const specJson =
      product.spec_json && typeof product.spec_json === 'object'
        ? (product.spec_json as Record<string, unknown>)
        : null
    const status = distributionStatus(specJson?.gudid_distribution_status)
    if (!status) continue
    statuses.set(product.product_id, new Set([status]))
  }
  for (const row of confirmations) {
    if (row.match_strength !== 'manufacturer_and_catalog_number') continue
    const status = distributionStatus(row.gudid_distribution_status)
    if (!status) continue
    const existing = statuses.get(row.product_id) ?? new Set()
    existing.add(status)
    statuses.set(row.product_id, existing)
  }

  const unambiguousStatuses = new Map<string, 'in_distribution' | 'not_in_distribution'>()
  for (const [productId, values] of statuses) {
    if (values.size !== 1) continue
    const status = values.values().next().value
    if (status) unambiguousStatuses.set(productId, status)
  }
  return unambiguousStatuses
}

function validateBaseRelationships(input: {
  products: ProposalProductRow[]
  productRoles: ProposalProductRoleRow[]
  procedures: ProposalProcedureRow[]
  roles: ProposalRoleRow[]
  slots: ProposalSlotRow[]
  authoredOptions: AuthoredSlotOptionRow[]
}): string[] {
  const errors: string[] = []
  const productById = new Map(input.products.map((product) => [product.product_id, product]))
  const procedureCodes = new Set(input.procedures.map((procedure) => procedure.procedure_code))
  const slotById = new Map(input.slots.map((slot) => [slot.slot_id, slot]))
  const roleCodes = new Set(input.roles.map((role) => role.role_code))

  const seenProducts = new Set<string>()
  for (const product of input.products) {
    if (seenProducts.has(product.product_id)) {
      errors.push(`Products has duplicate product_id ${product.product_id}.`)
    }
    seenProducts.add(product.product_id)
  }

  const seenSlots = new Set<string>()
  for (const slot of input.slots) {
    if (seenSlots.has(slot.slot_id))
      errors.push(`Procedure_Slots has duplicate slot_id ${slot.slot_id}.`)
    seenSlots.add(slot.slot_id)
    if (!procedureCodes.has(slot.procedure_code)) {
      errors.push(
        `Procedure slot ${slot.slot_id} references unknown procedure ${slot.procedure_code}.`,
      )
    }
    if (!roleCodes.has(slot.role_code)) {
      errors.push(`Procedure slot ${slot.slot_id} references unknown role ${slot.role_code}.`)
    }
  }

  const productRolePairs = new Set<string>()
  for (const relationship of input.productRoles) {
    const key = productRoleKey(relationship.product_id, relationship.role_code)
    if (productRolePairs.has(key)) {
      errors.push(
        `Product_Roles has duplicate pair ${relationship.product_id} × ${relationship.role_code}.`,
      )
    }
    productRolePairs.add(key)
    if (!productById.has(relationship.product_id)) {
      errors.push(
        `Product_Roles references unknown product ${relationship.product_id} for role ${relationship.role_code}.`,
      )
    }
    if (!roleCodes.has(relationship.role_code)) {
      errors.push(`Product_Roles references unknown role ${relationship.role_code}.`)
    }
  }

  const authoredPairs = new Set<string>()
  for (const option of input.authoredOptions) {
    const key = pairKey(option.slot_id, option.product_id)
    if (authoredPairs.has(key)) {
      errors.push(
        `Slot_Product_Options has duplicate pair ${option.slot_id} × ${option.product_id}.`,
      )
    }
    authoredPairs.add(key)

    const slot = slotById.get(option.slot_id)
    const product = productById.get(option.product_id)
    if (!slot) {
      errors.push(
        `Slot_Product_Options references unknown slot ${option.slot_id} for product ${option.product_id}.`,
      )
    }
    if (!product) {
      errors.push(
        `Slot_Product_Options references unknown product ${option.product_id} for slot ${option.slot_id}.`,
      )
    }
    if (slot && option.role_code !== slot.role_code) {
      errors.push(
        `Authored option ${option.slot_id} × ${option.product_id} uses role ${option.role_code}; slot role is ${slot.role_code}.`,
      )
    }
    if (slot && !productRolePairs.has(productRoleKey(option.product_id, slot.role_code))) {
      errors.push(
        `Authored option ${option.slot_id} × ${option.product_id} has no Product_Roles pair for ${slot.role_code}.`,
      )
    }
    if (product) {
      const productIsVisible = product.visibility_state === 'prototype_visible'
      if (!productIsVisible && (option.visible_by_default === true || option.selectable === true)) {
        errors.push(
          `Authored option ${option.slot_id} × ${option.product_id} is attached to a hidden product and must be nondefault and nonselectable.`,
        )
      }
      if (option.visible_by_default === true && option.selectable !== true) {
        errors.push(
          `Authored option ${option.slot_id} × ${option.product_id} is visible by default but is not selectable.`,
        )
      }
    }
    if (option.proposal_status === 'unreviewed' || option.proposal_origin === 'product_role_join') {
      errors.push(
        `Canonical option ${option.slot_id} × ${option.product_id} contains unreviewed proposal metadata.`,
      )
    }
  }

  return errors
}

function exceptionMatchesProposal(
  exception: SlotOptionException,
  proposal: SlotOptionProposal,
): boolean {
  return (
    exception.product_id === proposal.product_id &&
    (!exception.slot_id || exception.slot_id === proposal.slot_id) &&
    (!exception.role_code || exception.role_code === proposal.role_code) &&
    (!exception.procedure_code || exception.procedure_code === proposal.procedure_code)
  )
}

function validateExceptions(input: {
  exceptions: SlotOptionException[]
  products: ProposalProductRow[]
  productRoles: ProposalProductRoleRow[]
  procedures: ProposalProcedureRow[]
  roles: ProposalRoleRow[]
  slots: ProposalSlotRow[]
  candidates: SlotOptionProposal[]
}): {
  errors: string[]
  excludedPairs: Set<string>
  staleExceptionCount: number
} {
  const errors: string[] = []
  const productIds = new Set(input.products.map((product) => product.product_id))
  const procedureCodes = new Set(input.procedures.map((procedure) => procedure.procedure_code))
  const roleCodes = new Set(input.roles.map((role) => role.role_code))
  const slotById = new Map(input.slots.map((slot) => [slot.slot_id, slot]))

  const seenExceptions = new Set<string>()
  for (const exception of input.exceptions) {
    const key = exceptionKey(exception)
    if (seenExceptions.has(key)) {
      errors.push(`Duplicate slot-option exception for ${key.replaceAll('\u0000', ' × ')}.`)
    }
    seenExceptions.add(key)
    if (!productIds.has(exception.product_id)) {
      errors.push(`Slot-option exception references unknown product ${exception.product_id}.`)
    }
    if (exception.slot_id && !slotById.has(exception.slot_id)) {
      errors.push(`Slot-option exception references unknown slot ${exception.slot_id}.`)
    }
    if (exception.procedure_code && !procedureCodes.has(exception.procedure_code)) {
      errors.push(`Slot-option exception references unknown procedure ${exception.procedure_code}.`)
    }
    if (exception.role_code && !roleCodes.has(exception.role_code)) {
      errors.push(`Slot-option exception references unknown role ${exception.role_code}.`)
    }

    const slot = exception.slot_id ? slotById.get(exception.slot_id) : undefined
    if (slot && exception.procedure_code && slot.procedure_code !== exception.procedure_code) {
      errors.push(
        `Slot-option exception for ${exception.product_id} contradicts slot ${slot.slot_id}: procedure is ${slot.procedure_code}, not ${exception.procedure_code}.`,
      )
    }
    if (slot && exception.role_code && slot.role_code !== exception.role_code) {
      errors.push(
        `Slot-option exception for ${exception.product_id} contradicts slot ${slot.slot_id}: role is ${slot.role_code}, not ${exception.role_code}.`,
      )
    }
    if (
      !slot &&
      exception.procedure_code &&
      exception.role_code &&
      !input.slots.some(
        (candidate) =>
          candidate.procedure_code === exception.procedure_code &&
          candidate.role_code === exception.role_code,
      )
    ) {
      errors.push(
        `Slot-option exception for ${exception.product_id} contradicts procedure ${exception.procedure_code}: it has no slot with role ${exception.role_code}.`,
      )
    }
  }

  const matchesByException = input.exceptions.map(() => 0)
  const excludedPairs = new Set<string>()
  for (const candidate of input.candidates) {
    const matchingIndexes = input.exceptions.flatMap((exception, index) =>
      exceptionMatchesProposal(exception, candidate) ? [index] : [],
    )
    for (const index of matchingIndexes) matchesByException[index] += 1
    if (matchingIndexes.length > 1) {
      errors.push(
        `Proposal ${candidate.slot_id} × ${candidate.product_id} is covered by ${matchingIndexes.length} overlapping exceptions.`,
      )
    }
    if (matchingIndexes.length === 1) {
      excludedPairs.add(pairKey(candidate.slot_id, candidate.product_id))
    }
  }

  let staleExceptionCount = 0
  matchesByException.forEach((count, index) => {
    if (count > 0) return
    staleExceptionCount += 1
    const exception = input.exceptions[index]
    errors.push(
      `Stale slot-option exception for ${exception.product_id} (${[
        exception.slot_id,
        exception.role_code,
        exception.procedure_code,
      ]
        .filter(Boolean)
        .join(', ')}): matches no generated proposal.`,
    )
  })

  return { errors, excludedPairs, staleExceptionCount }
}

export function buildSlotOptionProposalArtifact(input: {
  products: ProposalProductRow[]
  productRoles: ProposalProductRoleRow[]
  procedures: ProposalProcedureRow[]
  roles: ProposalRoleRow[]
  slots: ProposalSlotRow[]
  authoredOptions: AuthoredSlotOptionRow[]
  exceptions: unknown
  distributionConfirmations?: DistributionConfirmationRow[]
}): SlotOptionProposalArtifact {
  const parsedExceptions = slotOptionExceptionsSchema.safeParse(input.exceptions)
  if (!parsedExceptions.success) {
    throw new SlotOptionIntegrityError(
      parsedExceptions.error.issues.map(
        (issue) =>
          `Malformed slot-option exception at ${issue.path.join('.') || '<root>'}: ${issue.message}.`,
      ),
    )
  }

  const relationshipErrors = validateBaseRelationships(input)
  if (relationshipErrors.length > 0) throw new SlotOptionIntegrityError(relationshipErrors)

  const productById = new Map(input.products.map((product) => [product.product_id, product]))
  const authoredPairs = new Set(
    input.authoredOptions.map((option) => pairKey(option.slot_id, option.product_id)),
  )
  const distributionByProduct = buildDistributionMap(
    input.products,
    input.distributionConfirmations ?? [],
  )

  const candidates: SlotOptionProposal[] = []
  for (const slot of input.slots) {
    for (const relationship of input.productRoles) {
      if (relationship.role_code !== slot.role_code) continue
      if (authoredPairs.has(pairKey(slot.slot_id, relationship.product_id))) continue
      const product = productById.get(relationship.product_id)
      if (!product) continue
      candidates.push({
        slot_id: slot.slot_id,
        procedure_code: slot.procedure_code,
        slot_display_order: slot.display_order,
        slot_label: slot.slot_label,
        requiredness: slot.requiredness,
        role_code: slot.role_code,
        product_id: product.product_id,
        manufacturer_id: product.manufacturer_id,
        manufacturer: product.manufacturer,
        product_name: product.product_name,
        catalog_number: product.catalog_number,
        role_fit: relationship.role_fit,
        product_verification_grade: product.verification_grade,
        product_visibility_state: product.visibility_state,
        current_distribution_status: distributionByProduct.get(product.product_id) ?? null,
        proposal_origin: 'product_role_join',
        proposal_status: 'unreviewed',
        selectable: false,
        visible_by_default: false,
        reason_code: 'missing_authored_slot_product_option',
        reason:
          `Product_Roles maps this product to ${slot.role_code}, but no authored ` +
          `Slot_Product_Options row exists for "${slot.slot_label}". Review exact-slot ` +
          'eligibility; this proposal does not assert compatibility, local approval, or clinical suitability.',
        source_identifiers: {
          procedure_slot_id: slot.slot_id,
          product_role_key: `${product.product_id}:${slot.role_code}`,
          primary_source_id: product.primary_source_id,
          primary_source_location: product.primary_source_location,
        },
      })
    }
  }

  candidates.sort(
    (left, right) =>
      compareText(left.procedure_code, right.procedure_code) ||
      left.slot_display_order - right.slot_display_order ||
      compareText(left.role_code, right.role_code) ||
      compareText(left.manufacturer ?? '', right.manufacturer ?? '') ||
      compareText(left.product_name, right.product_name) ||
      compareText(left.product_id, right.product_id),
  )

  const exceptionResult = validateExceptions({
    exceptions: parsedExceptions.data,
    products: input.products,
    productRoles: input.productRoles,
    procedures: input.procedures,
    roles: input.roles,
    slots: input.slots,
    candidates,
  })
  if (exceptionResult.errors.length > 0) {
    throw new SlotOptionIntegrityError(exceptionResult.errors)
  }

  const proposals = candidates.filter(
    (candidate) =>
      !exceptionResult.excludedPairs.has(pairKey(candidate.slot_id, candidate.product_id)),
  )
  const coverage = calculateProcedureCoverage({
    products: input.products,
    productRoles: input.productRoles,
    procedures: input.procedures,
    slots: input.slots,
    slotProductOptions: input.authoredOptions,
  })

  return {
    format_version: 1,
    semantics: {
      product_roles: 'broad_catalog_discovery',
      slot_product_options: 'curated_exact_slot_defaults',
      proposal_rows: 'unreviewed_not_selectable',
    },
    summary: {
      authored_canonical_options: input.authoredOptions.length,
      generated_unreviewed_proposals: proposals.length,
      excluded_proposal_pairs: exceptionResult.excludedPairs.size,
      required_slots_with_catalog_coverage: coverage.reduce(
        (total, procedure) => total + procedure.requiredCatalogCoverageCount,
        0,
      ),
      required_slots_with_curated_defaults: coverage.reduce(
        (total, procedure) => total + procedure.requiredDefaultOptionCoverageCount,
        0,
      ),
      authored_row_errors: 0,
      stale_exceptions: exceptionResult.staleExceptionCount,
      proposal_generation_errors: 0,
    },
    proposals,
  }
}

async function readJson<T>(filename: string): Promise<T> {
  return JSON.parse(await readFile(filename, 'utf8')) as T
}

async function readOptionalConfirmations(filename: string): Promise<DistributionConfirmationRow[]> {
  try {
    const value = await readJson<{ confirmations?: DistributionConfirmationRow[] }>(filename)
    return value.confirmations ?? []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

export async function generateSlotOptionProposals(options?: {
  generatedDirectory?: string
  exceptionFile?: string
  write?: boolean
}): Promise<SlotOptionProposalArtifact> {
  const generatedDirectory = path.resolve(
    process.cwd(),
    options?.generatedDirectory ?? process.env.IP_CARDS_OUTPUT_DIR ?? DEFAULT_GENERATED_DIRECTORY,
  )
  const exceptionFile = path.resolve(
    process.cwd(),
    options?.exceptionFile ?? process.env.IP_CARDS_SLOT_OPTION_EXCEPTIONS ?? DEFAULT_EXCEPTION_FILE,
  )

  const [
    products,
    productRoles,
    procedures,
    roles,
    slots,
    authoredOptions,
    exceptions,
    distributionConfirmations,
  ] = await Promise.all([
    readJson<ProposalProductRow[]>(path.join(generatedDirectory, 'catalog-products.json')),
    readJson<ProposalProductRoleRow[]>(path.join(generatedDirectory, 'product-roles.json')),
    readJson<ProposalProcedureRow[]>(path.join(generatedDirectory, 'procedures.json')),
    readJson<ProposalRoleRow[]>(path.join(generatedDirectory, 'roles.json')),
    readJson<ProposalSlotRow[]>(path.join(generatedDirectory, 'procedure-slots.json')),
    readJson<AuthoredSlotOptionRow[]>(path.join(generatedDirectory, 'slot-product-options.json')),
    readJson<unknown>(exceptionFile),
    readOptionalConfirmations(path.join(generatedDirectory, 'gudid-confirmations.json')),
  ])

  const artifact = buildSlotOptionProposalArtifact({
    products,
    productRoles,
    procedures,
    roles,
    slots,
    authoredOptions,
    exceptions,
    distributionConfirmations,
  })
  if (options?.write !== false) {
    await writeFile(
      path.join(generatedDirectory, SLOT_OPTION_PROPOSAL_FILENAME),
      serializeSlotOptionProposalArtifact(artifact),
      'utf8',
    )
  }
  return artifact
}

if (process.argv[1] && /derive-slot-option-proposals\.(?:ts|js)$/.test(process.argv[1])) {
  generateSlotOptionProposals()
    .then((artifact) => {
      console.log(
        [
          `${artifact.summary.authored_canonical_options} authored canonical options`,
          `${artifact.summary.generated_unreviewed_proposals} unreviewed proposals`,
          `${artifact.summary.excluded_proposal_pairs} excluded proposal pairs`,
        ].join(' · '),
      )
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
}
