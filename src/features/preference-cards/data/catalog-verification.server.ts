import { z } from 'zod'

import gudidConfirmationsJson from '../../../../data/ip-preference-cards/generated/gudid-confirmations.json'
import productSourcesJson from '../../../../data/ip-preference-cards/generated/product-sources.json'
import slotOptionProposalArtifactJson from '../../../../data/ip-preference-cards/generated/slot-product-option-proposals.json'
import sourcesJson from '../../../../data/ip-preference-cards/generated/sources.json'
import verificationBacklogJson from '../../../../data/ip-preference-cards/generated/verification-backlog.json'
import { slotOptionProposalArtifactSchema } from '../../../../scripts/ip-preference-cards/derive-slot-option-proposals'

import {
  getCatalogStore,
  getProductDetail,
  type ProductDetail,
} from '@/features/preference-cards/server/catalog'
import type { CatalogProduct } from '@/features/preference-cards/server/catalog-store'

const nullableText = z.string().nullable()

export const verificationBacklogRowSchema = z
  .object({
    priority: z.string(),
    workstream: z.string(),
    review_status: z.string(),
    product_id: z.string(),
    manufacturer: z.string(),
    product_name: z.string(),
    catalog_number: z.string(),
    existing_gtin: nullableText,
    existing_gtin_audit: z.string(),
    roles: z.string(),
    procedures: nullableText,
    required_slots: z.number().int().nonnegative(),
    conditional_slots: z.number().int().nonnegative(),
    optional_slots: z.number().int().nonnegative(),
    qa_severity: z.string(),
    qa_issue_type: z.string(),
    current_verification_status: z.string(),
    current_live_status: z.string(),
    gudid_result: z.string(),
    match_confidence: nullableText,
    match_basis: nullableText,
    accepted_candidates: z.string(),
    current_candidates: z.string(),
    suggested_primary_di: nullableText,
    di_match_type: nullableText,
    distribution_status: nullableText,
    public_version_date: nullableText,
    verification_remaining: z.string(),
    recommended_action: z.string(),
    reviewer: nullableText,
    last_reviewed: nullableText,
    decision: z.string(),
    evidence_url: nullableText,
    notes: nullableText,
  })
  .strict()

export const verificationBacklogSchema = z.array(verificationBacklogRowSchema)
export type VerificationBacklogRow = z.infer<typeof verificationBacklogRowSchema>

export const gudidConfirmationSchema = z
  .object({
    product_id: z.string(),
    manufacturer: nullableText,
    product_name: z.string(),
    catalog_number: nullableText,
    match_strength: z.enum(['manufacturer_and_catalog_number', 'catalog_number_only']),
    gudid_primary_di: z.string(),
    gudid_company: z.string(),
    gudid_brand: z.string(),
    gudid_description: z.string(),
    gudid_distribution_status: z.string(),
    gudid_gtin: nullableText,
    current_gtin: nullableText,
    proposals: z.array(z.string()),
  })
  .strict()

const gudidConfirmationReportSchema = z
  .object({
    format_version: z.literal('1.0'),
    generated_from: z.string(),
    catalog_products: z.number().int().nonnegative(),
    products_with_any_match: z.number().int().nonnegative(),
    strong_matches: z.number().int().nonnegative(),
    weak_matches: z.number().int().nonnegative(),
    gtin_backfill_candidates: z.number().int().nonnegative(),
    gtin_mismatches: z.number().int().nonnegative(),
    not_in_distribution: z.number().int().nonnegative(),
    release_candidates: z.number().int().nonnegative(),
    confirmations: z.array(gudidConfirmationSchema),
  })
  .strict()

export type GudidConfirmation = z.infer<typeof gudidConfirmationSchema>

const productSourceSchema = z
  .object({
    product_id: z.string(),
    source_id: z.string(),
    source_location: nullableText,
    claim_type: nullableText,
    verification_status: nullableText,
    notes: nullableText,
  })
  .strict()

const sourceSchema = z
  .object({
    source_id: z.string(),
    title: z.string(),
    filename: nullableText,
    source_type: nullableText,
    publisher: nullableText,
    revision_date: nullableText,
    as_of_date: nullableText,
    reliability_tier: nullableText,
    use_policy: nullableText,
    notes: nullableText,
  })
  .strict()

export type CatalogIdentityEvidence = 'strong_candidate' | 'weak_candidate_only' | 'unmatched'
export type CatalogDistributionEvidence =
  | 'in_distribution'
  | 'not_in_distribution'
  | 'conflicting'
  | 'unknown'
export type BacklogGudidAlignment =
  | 'not_applicable'
  | 'agrees'
  | 'different_current_strong'
  | 'no_current_strong'
export type BacklogDriftField =
  | 'manufacturer'
  | 'product_name'
  | 'catalog_number'
  | 'verification_status'
  | 'live_status'

export const catalogVerificationSignals = [
  'strong_match',
  'weak_only',
  'no_gudid_match',
  'distribution_alert',
  'gtin_backfill',
  'gtin_conflict',
  'release_candidate',
  'backlog_drift',
  'not_in_backlog',
  'manufacturer_source_missing',
] as const

export type CatalogVerificationSignal = (typeof catalogVerificationSignals)[number]

export interface CatalogVerificationProduct {
  product_id: string
  manufacturer: string | null
  product_name: string
  catalog_number: string | null
  gtin: string | null
  verification_status: string | null
  live_dropdown_status: string | null
  verification_grade: string | null
  visibility_state: string | null
  primary_source_id: string | null
  primary_source_location: string | null
}

export interface CatalogVerificationQueueRow {
  productId: string
  manufacturer: string | null
  productName: string
  catalogNumber: string | null
  gtin: string | null
  verificationStatus: string | null
  liveDropdownStatus: string | null
  verificationGrade: string | null
  visibilityState: string | null
  primarySourceId: string | null
  primarySourceLocation: string | null
  currentRoles: CatalogRoleContext[]
  authoredProcedures: CatalogProcedureContext[]
  proposedProcedures: CatalogProcedureContext[]
  backlog: VerificationBacklogRow | null
  backlogDriftFields: BacklogDriftField[]
  backlogGudidAlignment: BacklogGudidAlignment
  identityEvidence: CatalogIdentityEvidence
  distributionEvidence: CatalogDistributionEvidence
  candidatePrimaryDis: string[]
  strongMatchCount: number
  weakMatchCount: number
  uniqueStrongDiCount: number
  uniqueStrongGtinCount: number
  sourceCount: number
  manufacturerEvidenceCount: number
  hasCurrentIfuEvidence: boolean
  hasGtinBackfillProposal: boolean
  hasGtinMismatchProposal: boolean
  hasReleaseCandidateProposal: boolean
}

export interface CatalogRoleContext {
  productId: string
  roleCode: string
  roleName: string
  roleFit: string | null
}

export interface CatalogProcedureContext {
  productId: string
  procedureCode: string
  procedureName: string
  source: 'authored' | 'proposal'
}

export interface CatalogVerificationBuildInput {
  products: CatalogVerificationProduct[]
  backlogRows: VerificationBacklogRow[]
  confirmations: GudidConfirmation[]
  productSources: z.infer<typeof productSourceSchema>[]
  sources: z.infer<typeof sourceSchema>[]
  roleContexts: CatalogRoleContext[]
  procedureContexts: CatalogProcedureContext[]
}

export interface CatalogVerificationFilters {
  q?: string
  priority?: string
  manufacturer?: string
  workstream?: string
  reviewStatus?: string
  procedure?: string
  role?: string
  gudid?: string
  distribution?: string
  signal?: CatalogVerificationSignal | ''
}

export interface CatalogVerificationSummary {
  totalProducts: number
  workbookBacklogProducts: number
  additionsAfterWorkbook: number
  p0Products: number
  strongIdentityCandidates: number
  withoutStrongIdentityCandidate: number
  distributionAlerts: number
  gtinConflicts: number
}

export interface CatalogVerificationFacets {
  priorities: string[]
  workstreams: string[]
  reviewStatuses: string[]
}

export interface CatalogVerificationDetail {
  queueRow: CatalogVerificationQueueRow
  productDetail: ProductDetail
  confirmations: GudidConfirmation[]
}

function normalized(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? ''
}

function normalizedDistribution(value: string): 'in_distribution' | 'not_in_distribution' | null {
  if (/^In Commercial Distribution$/i.test(value)) return 'in_distribution'
  if (/^Not in Commercial Distribution$/i.test(value)) return 'not_in_distribution'
  return null
}

function isManufacturerEvidence(source: z.infer<typeof sourceSchema>): boolean {
  const sourceType = normalized(source.source_type)
  return sourceType.includes('manufacturer')
}

function hasIfuEvidence(source: z.infer<typeof sourceSchema>): boolean {
  return normalized(source.source_type).includes('ifu') || normalized(source.title).includes('ifu')
}

function differs(left: string | null | undefined, right: string | null | undefined): boolean {
  return normalized(left) !== normalized(right)
}

function backlogDrift(
  product: CatalogVerificationProduct,
  backlog: VerificationBacklogRow | null,
): BacklogDriftField[] {
  if (!backlog) return []
  const fields: BacklogDriftField[] = []
  if (differs(product.manufacturer, backlog.manufacturer)) fields.push('manufacturer')
  if (differs(product.product_name, backlog.product_name)) fields.push('product_name')
  if (differs(product.catalog_number, backlog.catalog_number)) fields.push('catalog_number')
  if (differs(product.verification_status, backlog.current_verification_status)) {
    fields.push('verification_status')
  }
  if (differs(product.live_dropdown_status, backlog.current_live_status)) fields.push('live_status')
  return fields
}

function backlogGudidAlignment(
  backlog: VerificationBacklogRow | null,
  strongMatches: GudidConfirmation[],
): BacklogGudidAlignment {
  const suggestedDi = backlog?.suggested_primary_di?.trim()
  if (!suggestedDi) return 'not_applicable'
  const currentStrongDis = new Set(
    strongMatches.map((match) => match.gudid_primary_di.trim()).filter(Boolean),
  )
  if (currentStrongDis.size === 0) return 'no_current_strong'
  return currentStrongDis.has(suggestedDi) ? 'agrees' : 'different_current_strong'
}

function uniqueNonEmpty(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function distributionEvidence(strongMatches: GudidConfirmation[]): CatalogDistributionEvidence {
  const parsedStatuses = strongMatches.map((match) =>
    normalizedDistribution(match.gudid_distribution_status),
  )
  const statuses = new Set(
    parsedStatuses.filter((value): value is 'in_distribution' | 'not_in_distribution' =>
      Boolean(value),
    ),
  )
  const hasUnrecognizedStatus = parsedStatuses.some((status) => status === null)
  if (statuses.size > 1 || (statuses.size > 0 && hasUnrecognizedStatus)) return 'conflicting'
  return statuses.values().next().value ?? 'unknown'
}

function proposalFlags(
  strongMatches: GudidConfirmation[],
  aggregateDistribution: CatalogDistributionEvidence,
) {
  const proposals = strongMatches.flatMap((match) => match.proposals)
  return {
    hasGtinBackfillProposal: proposals.some((proposal) => proposal.startsWith('Add GTIN')),
    hasGtinMismatchProposal: proposals.some((proposal) => proposal.startsWith('GTIN mismatch')),
    hasReleaseCandidateProposal:
      aggregateDistribution === 'in_distribution' &&
      proposals.some((proposal) => proposal.startsWith('GUDID reports in commercial')),
  }
}

function assertUniqueValues(values: string[], label: string): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`)
    seen.add(value)
  }
}

function validateCatalogVerificationRelationships(input: CatalogVerificationBuildInput): void {
  assertUniqueValues(
    input.products.map((product) => product.product_id),
    'catalog product_id',
  )
  assertUniqueValues(
    input.backlogRows.map((row) => row.product_id),
    'verification backlog product_id',
  )
  assertUniqueValues(
    input.sources.map((source) => source.source_id),
    'source_id',
  )

  const productIds = new Set(input.products.map((product) => product.product_id))
  const sourceIds = new Set(input.sources.map((source) => source.source_id))
  for (const row of input.backlogRows) {
    if (!productIds.has(row.product_id)) {
      throw new Error(`Verification backlog references unknown product_id: ${row.product_id}`)
    }
  }
  for (const confirmation of input.confirmations) {
    if (!productIds.has(confirmation.product_id)) {
      throw new Error(
        `GUDID confirmation references unknown product_id: ${confirmation.product_id}`,
      )
    }
  }
  for (const link of input.productSources) {
    if (!productIds.has(link.product_id)) {
      throw new Error(`Product source references unknown product_id: ${link.product_id}`)
    }
    if (!sourceIds.has(link.source_id)) {
      throw new Error(`Product source references unknown source_id: ${link.source_id}`)
    }
  }
  for (const context of [...input.roleContexts, ...input.procedureContexts]) {
    if (!productIds.has(context.productId)) {
      throw new Error(`Catalog context references unknown product_id: ${context.productId}`)
    }
  }
}

function compareQueueRows(
  left: CatalogVerificationQueueRow,
  right: CatalogVerificationQueueRow,
): number {
  const priorityRank = (value: string | null | undefined) => {
    const match = /^P(\d+)$/i.exec(value ?? '')
    return match ? Number(match[1]) : 99
  }
  return (
    priorityRank(left.backlog?.priority) - priorityRank(right.backlog?.priority) ||
    (left.manufacturer ?? '').localeCompare(right.manufacturer ?? '') ||
    left.productName.localeCompare(right.productName) ||
    left.productId.localeCompare(right.productId)
  )
}

export function buildCatalogVerificationRows(
  input: CatalogVerificationBuildInput,
): CatalogVerificationQueueRow[] {
  validateCatalogVerificationRelationships(input)
  const backlogByProduct = new Map(input.backlogRows.map((row) => [row.product_id, row]))
  const confirmationsByProduct = new Map<string, GudidConfirmation[]>()
  for (const confirmation of input.confirmations) {
    const rows = confirmationsByProduct.get(confirmation.product_id)
    if (rows) rows.push(confirmation)
    else confirmationsByProduct.set(confirmation.product_id, [confirmation])
  }

  const sourceById = new Map(input.sources.map((source) => [source.source_id, source]))
  const sourceIdsByProduct = new Map<string, Set<string>>()
  for (const link of input.productSources) {
    const sourceIds = sourceIdsByProduct.get(link.product_id) ?? new Set<string>()
    sourceIds.add(link.source_id)
    sourceIdsByProduct.set(link.product_id, sourceIds)
  }

  const rolesByProduct = new Map<string, Map<string, CatalogRoleContext>>()
  for (const context of input.roleContexts) {
    const contexts = rolesByProduct.get(context.productId) ?? new Map<string, CatalogRoleContext>()
    contexts.set(context.roleCode, context)
    rolesByProduct.set(context.productId, contexts)
  }
  const proceduresByProduct = new Map<string, Map<string, CatalogProcedureContext>>()
  for (const context of input.procedureContexts) {
    const contexts =
      proceduresByProduct.get(context.productId) ?? new Map<string, CatalogProcedureContext>()
    contexts.set(`${context.source}:${context.procedureCode}`, context)
    proceduresByProduct.set(context.productId, contexts)
  }

  return input.products
    .map((product): CatalogVerificationQueueRow => {
      const matches = confirmationsByProduct.get(product.product_id) ?? []
      const strongMatches = matches.filter(
        (match) => match.match_strength === 'manufacturer_and_catalog_number',
      )
      const weakMatches = matches.filter((match) => match.match_strength === 'catalog_number_only')
      const sourceIds = sourceIdsByProduct.get(product.product_id) ?? new Set<string>()
      const linkedSources = [...sourceIds]
        .map((sourceId) => sourceById.get(sourceId))
        .filter((source): source is z.infer<typeof sourceSchema> => Boolean(source))
      const aggregateDistribution = distributionEvidence(strongMatches)
      const flags = proposalFlags(strongMatches, aggregateDistribution)
      const backlog = backlogByProduct.get(product.product_id) ?? null
      const currentRoles = [...(rolesByProduct.get(product.product_id)?.values() ?? [])].sort(
        (left, right) =>
          left.roleName.localeCompare(right.roleName) ||
          left.roleCode.localeCompare(right.roleCode),
      )
      const procedureContexts = [...(proceduresByProduct.get(product.product_id)?.values() ?? [])]
      const authoredProcedures = procedureContexts
        .filter((context) => context.source === 'authored')
        .sort((left, right) => left.procedureName.localeCompare(right.procedureName))
      const proposedProcedures = procedureContexts
        .filter((context) => context.source === 'proposal')
        .sort((left, right) => left.procedureName.localeCompare(right.procedureName))
      return {
        productId: product.product_id,
        manufacturer: product.manufacturer,
        productName: product.product_name,
        catalogNumber: product.catalog_number,
        gtin: product.gtin,
        verificationStatus: product.verification_status,
        liveDropdownStatus: product.live_dropdown_status,
        verificationGrade: product.verification_grade,
        visibilityState: product.visibility_state,
        primarySourceId: product.primary_source_id,
        primarySourceLocation: product.primary_source_location,
        currentRoles,
        authoredProcedures,
        proposedProcedures,
        backlog,
        backlogDriftFields: backlogDrift(product, backlog),
        backlogGudidAlignment: backlogGudidAlignment(backlog, strongMatches),
        identityEvidence:
          strongMatches.length > 0
            ? 'strong_candidate'
            : weakMatches.length > 0
              ? 'weak_candidate_only'
              : 'unmatched',
        distributionEvidence: aggregateDistribution,
        candidatePrimaryDis: uniqueNonEmpty(matches.map((match) => match.gudid_primary_di)),
        strongMatchCount: strongMatches.length,
        weakMatchCount: weakMatches.length,
        uniqueStrongDiCount: uniqueNonEmpty(strongMatches.map((match) => match.gudid_primary_di))
          .length,
        uniqueStrongGtinCount: uniqueNonEmpty(strongMatches.map((match) => match.gudid_gtin))
          .length,
        sourceCount: linkedSources.length,
        manufacturerEvidenceCount: linkedSources.filter(isManufacturerEvidence).length,
        hasCurrentIfuEvidence: linkedSources.some(hasIfuEvidence),
        ...flags,
      }
    })
    .sort(compareQueueRows)
}

function contains(value: string | null | undefined, query: string): boolean {
  return normalized(value).includes(query)
}

function matchesSignal(
  row: CatalogVerificationQueueRow,
  signal: CatalogVerificationSignal | '',
): boolean {
  switch (signal) {
    case '':
      return true
    case 'strong_match':
      return row.identityEvidence === 'strong_candidate'
    case 'weak_only':
      return row.identityEvidence === 'weak_candidate_only'
    case 'no_gudid_match':
      return row.identityEvidence === 'unmatched'
    case 'distribution_alert':
      return ['not_in_distribution', 'conflicting'].includes(row.distributionEvidence)
    case 'gtin_backfill':
      return row.hasGtinBackfillProposal
    case 'gtin_conflict':
      return row.hasGtinMismatchProposal || row.uniqueStrongGtinCount > 1
    case 'release_candidate':
      return row.hasReleaseCandidateProposal
    case 'backlog_drift':
      return (
        row.backlogDriftFields.length > 0 ||
        ['different_current_strong', 'no_current_strong'].includes(row.backlogGudidAlignment)
      )
    case 'not_in_backlog':
      return row.backlog === null
    case 'manufacturer_source_missing':
      return row.manufacturerEvidenceCount === 0
  }
}

export function filterCatalogVerificationRows(
  rows: CatalogVerificationQueueRow[],
  filters: CatalogVerificationFilters,
): CatalogVerificationQueueRow[] {
  const q = normalized(filters.q)
  const priority = normalized(filters.priority)
  const manufacturer = normalized(filters.manufacturer)
  const workstream = normalized(filters.workstream)
  const reviewStatus = normalized(filters.reviewStatus)
  const procedure = normalized(filters.procedure)
  const role = normalized(filters.role)
  const gudid = normalized(filters.gudid)
  const distribution = normalized(filters.distribution)
  const signal = filters.signal ?? ''

  return rows.filter((row) => {
    const backlog = row.backlog
    if (
      q &&
      ![
        row.productId,
        row.manufacturer,
        row.productName,
        row.catalogNumber,
        row.gtin,
        backlog?.suggested_primary_di,
        ...row.candidatePrimaryDis,
      ].some((value) => contains(value, q))
    ) {
      return false
    }
    return (
      (!priority || contains(backlog?.priority, priority)) &&
      (!manufacturer || contains(row.manufacturer, manufacturer)) &&
      (!workstream || contains(backlog?.workstream, workstream)) &&
      (!reviewStatus || contains(backlog?.review_status, reviewStatus)) &&
      (!procedure ||
        contains(backlog?.procedures, procedure) ||
        [...row.authoredProcedures, ...row.proposedProcedures].some(
          (context) =>
            contains(context.procedureCode, procedure) ||
            contains(context.procedureName, procedure),
        )) &&
      (!role ||
        contains(backlog?.roles, role) ||
        row.currentRoles.some(
          (context) =>
            contains(context.roleCode, role) ||
            contains(context.roleName, role) ||
            contains(context.roleFit, role),
        )) &&
      (!gudid || contains(backlog?.gudid_result, gudid)) &&
      (!distribution || contains(row.distributionEvidence, distribution)) &&
      matchesSignal(row, signal)
    )
  })
}

export function summarizeCatalogVerificationRows(
  rows: CatalogVerificationQueueRow[],
): CatalogVerificationSummary {
  return {
    totalProducts: rows.length,
    workbookBacklogProducts: rows.filter((row) => row.backlog !== null).length,
    additionsAfterWorkbook: rows.filter((row) => row.backlog === null).length,
    p0Products: rows.filter((row) => row.backlog?.priority === 'P0').length,
    strongIdentityCandidates: rows.filter((row) => row.identityEvidence === 'strong_candidate')
      .length,
    withoutStrongIdentityCandidate: rows.filter(
      (row) => row.identityEvidence !== 'strong_candidate',
    ).length,
    distributionAlerts: rows.filter((row) =>
      ['not_in_distribution', 'conflicting'].includes(row.distributionEvidence),
    ).length,
    gtinConflicts: rows.filter(
      (row) => row.hasGtinMismatchProposal || row.uniqueStrongGtinCount > 1,
    ).length,
  }
}

export function catalogVerificationFacets(
  rows: CatalogVerificationQueueRow[],
): CatalogVerificationFacets {
  const collect = (read: (row: CatalogVerificationQueueRow) => string | null | undefined) =>
    [...new Set(rows.map(read).filter((value): value is string => Boolean(value)))].sort()
  return {
    priorities: collect((row) => row.backlog?.priority),
    workstreams: collect((row) => row.backlog?.workstream),
    reviewStatuses: collect((row) => row.backlog?.review_status),
  }
}

const parsedBacklog = verificationBacklogSchema.parse(verificationBacklogJson)
const parsedGudidReport = gudidConfirmationReportSchema.parse(gudidConfirmationsJson)
const parsedProductSources = z.array(productSourceSchema).parse(productSourcesJson)
const parsedSources = z.array(sourceSchema).parse(sourcesJson)
const parsedSlotOptionProposalArtifact = slotOptionProposalArtifactSchema.parse(
  slotOptionProposalArtifactJson,
)

const catalogStore = getCatalogStore()
const catalogProducts = catalogStore.products as CatalogProduct[]
const roleContexts: CatalogRoleContext[] = [...catalogStore.rolesByProduct].flatMap(
  ([productId, links]) =>
    links.map((link) => ({
      productId,
      roleCode: link.role_code,
      roleName: catalogStore.roleByCode.get(link.role_code)?.role_name ?? link.role_code,
      roleFit: link.role_fit,
    })),
)
const slotById = new Map(catalogStore.procedureSlots.map((slot) => [slot.slot_id, slot]))
const authoredProcedureContexts: CatalogProcedureContext[] = [
  ...catalogStore.slotOptionsByProduct,
].flatMap(([productId, options]) =>
  options.flatMap((option) => {
    const slot = slotById.get(option.slot_id)
    if (!slot) return []
    return [
      {
        productId,
        procedureCode: slot.procedure_code,
        procedureName:
          catalogStore.procedureByCode.get(slot.procedure_code)?.procedure_name ??
          slot.procedure_code,
        source: 'authored' as const,
      },
    ]
  }),
)
const proposedProcedureContexts: CatalogProcedureContext[] =
  parsedSlotOptionProposalArtifact.proposals.map((proposal) => ({
    productId: proposal.product_id,
    procedureCode: proposal.procedure_code,
    procedureName:
      catalogStore.procedureByCode.get(proposal.procedure_code)?.procedure_name ??
      proposal.procedure_code,
    source: 'proposal',
  }))
const catalogVerificationRows = buildCatalogVerificationRows({
  products: catalogProducts,
  backlogRows: parsedBacklog,
  confirmations: parsedGudidReport.confirmations,
  productSources: parsedProductSources,
  sources: parsedSources,
  roleContexts,
  procedureContexts: [...authoredProcedureContexts, ...proposedProcedureContexts],
})
const catalogVerificationRowById = new Map(
  catalogVerificationRows.map((row) => [row.productId, row]),
)
const confirmationsByProduct = new Map<string, GudidConfirmation[]>()
for (const confirmation of parsedGudidReport.confirmations) {
  const rows = confirmationsByProduct.get(confirmation.product_id)
  if (rows) rows.push(confirmation)
  else confirmationsByProduct.set(confirmation.product_id, [confirmation])
}

function copyQueueRow(row: CatalogVerificationQueueRow): CatalogVerificationQueueRow {
  return {
    ...row,
    backlog: row.backlog ? { ...row.backlog } : null,
    backlogDriftFields: [...row.backlogDriftFields],
    candidatePrimaryDis: [...row.candidatePrimaryDis],
    currentRoles: row.currentRoles.map((context) => ({ ...context })),
    authoredProcedures: row.authoredProcedures.map((context) => ({ ...context })),
    proposedProcedures: row.proposedProcedures.map((context) => ({ ...context })),
  }
}

export function getCatalogVerificationRows(): CatalogVerificationQueueRow[] {
  return catalogVerificationRows.map(copyQueueRow)
}

export function getCatalogVerificationDetail(productId: string): CatalogVerificationDetail | null {
  const queueRow = catalogVerificationRowById.get(productId)
  const productDetail = getProductDetail(productId)
  if (!queueRow || !productDetail) return null
  return {
    queueRow: copyQueueRow(queueRow),
    productDetail,
    confirmations: [...(confirmationsByProduct.get(productId) ?? [])]
      .sort(
        (left, right) =>
          Number(right.match_strength === 'manufacturer_and_catalog_number') -
            Number(left.match_strength === 'manufacturer_and_catalog_number') ||
          left.gudid_primary_di.localeCompare(right.gudid_primary_di),
      )
      .map((confirmation) => ({
        ...confirmation,
        proposals: [...confirmation.proposals],
      })),
  }
}
