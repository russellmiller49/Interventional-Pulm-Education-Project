import slotOptionProposalArtifactJson from '../../../../data/ip-preference-cards/generated/slot-product-option-proposals.json'
import {
  slotOptionProposalArtifactSchema,
  type SlotOptionProposal,
  type SlotOptionProposalSummary,
} from '../../../../scripts/ip-preference-cards/derive-slot-option-proposals'

import {
  getCatalogVerificationRows,
  type CatalogDistributionEvidence,
} from '@/features/preference-cards/data/catalog-verification.server'
import { getCatalogStore } from '@/features/preference-cards/server/catalog'

export interface SlotOptionReviewRow extends SlotOptionProposal {
  procedureName: string
  roleName: string
  distributionEvidence: CatalogDistributionEvidence
}

export interface SlotOptionReviewFilters {
  q?: string
  procedure?: string
  role?: string
  requiredness?: string
  manufacturer?: string
  distribution?: string
  verification?: string
  visibility?: string
}

export interface SlotOptionReviewSummary {
  artifact: SlotOptionProposalSummary
  totalProposals: number
  affectedProducts: number
  affectedSlots: number
  requiredProposals: number
  notInDistribution: number
  conflictingDistribution: number
  unknownDistribution: number
}

export interface SlotOptionReviewFacets {
  procedures: Array<{ code: string; name: string }>
  roles: Array<{ code: string; name: string }>
  requiredness: string[]
  verificationGrades: string[]
  visibilityStates: string[]
}

function normalized(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? ''
}

function compareRequiredness(value: string): number {
  switch (normalized(value)) {
    case 'required':
      return 0
    case 'conditional':
      return 1
    case 'optional':
      return 2
    default:
      return 3
  }
}

export function buildSlotOptionReviewRows(
  proposals: SlotOptionProposal[],
  procedureNames: ReadonlyMap<string, string>,
  roleNames: ReadonlyMap<string, string>,
  distributionByProduct: ReadonlyMap<string, CatalogDistributionEvidence>,
): SlotOptionReviewRow[] {
  return proposals
    .map((proposal): SlotOptionReviewRow => {
      const distributionEvidence: CatalogDistributionEvidence =
        proposal.current_distribution_status ??
        (distributionByProduct.get(proposal.product_id) === 'conflicting'
          ? 'conflicting'
          : 'unknown')
      return {
        ...proposal,
        source_identifiers: { ...proposal.source_identifiers },
        procedureName: procedureNames.get(proposal.procedure_code) ?? proposal.procedure_code,
        roleName: roleNames.get(proposal.role_code) ?? proposal.role_code,
        distributionEvidence,
      }
    })
    .sort(
      (left, right) =>
        compareRequiredness(left.requiredness) - compareRequiredness(right.requiredness) ||
        left.procedureName.localeCompare(right.procedureName) ||
        left.slot_display_order - right.slot_display_order ||
        (left.manufacturer ?? '').localeCompare(right.manufacturer ?? '') ||
        left.product_name.localeCompare(right.product_name) ||
        left.product_id.localeCompare(right.product_id),
    )
}

function contains(value: string | null | undefined, query: string): boolean {
  return normalized(value).includes(query)
}

export function filterSlotOptionReviewRows(
  rows: SlotOptionReviewRow[],
  filters: SlotOptionReviewFilters,
): SlotOptionReviewRow[] {
  const q = normalized(filters.q)
  const procedure = normalized(filters.procedure)
  const role = normalized(filters.role)
  const requiredness = normalized(filters.requiredness)
  const manufacturer = normalized(filters.manufacturer)
  const distribution = normalized(filters.distribution)
  const verification = normalized(filters.verification)
  const visibility = normalized(filters.visibility)

  return rows.filter(
    (row) =>
      (!q ||
        [
          row.product_id,
          row.product_name,
          row.catalog_number,
          row.manufacturer,
          row.slot_id,
          row.slot_label,
          row.procedure_code,
          row.procedureName,
          row.role_code,
          row.roleName,
        ].some((value) => contains(value, q))) &&
      (!procedure ||
        contains(row.procedure_code, procedure) ||
        contains(row.procedureName, procedure)) &&
      (!role || contains(row.role_code, role) || contains(row.roleName, role)) &&
      (!requiredness || normalized(row.requiredness) === requiredness) &&
      (!manufacturer || contains(row.manufacturer, manufacturer)) &&
      (!distribution || normalized(row.distributionEvidence) === distribution) &&
      (!verification || normalized(row.product_verification_grade ?? 'unknown') === verification) &&
      (!visibility || normalized(row.product_visibility_state ?? 'unknown') === visibility),
  )
}

export function summarizeSlotOptionReviewRows(
  rows: SlotOptionReviewRow[],
  artifact: SlotOptionProposalSummary,
): SlotOptionReviewSummary {
  return {
    artifact: { ...artifact },
    totalProposals: rows.length,
    affectedProducts: new Set(rows.map((row) => row.product_id)).size,
    affectedSlots: new Set(rows.map((row) => row.slot_id)).size,
    requiredProposals: rows.filter((row) => normalized(row.requiredness) === 'required').length,
    notInDistribution: rows.filter((row) => row.distributionEvidence === 'not_in_distribution')
      .length,
    conflictingDistribution: rows.filter((row) => row.distributionEvidence === 'conflicting')
      .length,
    unknownDistribution: rows.filter((row) => row.distributionEvidence === 'unknown').length,
  }
}

export function slotOptionReviewFacets(rows: SlotOptionReviewRow[]): SlotOptionReviewFacets {
  const distinct = (read: (row: SlotOptionReviewRow) => string | null) =>
    [...new Set(rows.map(read).filter((value): value is string => Boolean(value)))].sort()
  const procedureNames = new Map(rows.map((row) => [row.procedure_code, row.procedureName]))
  const roleNames = new Map(rows.map((row) => [row.role_code, row.roleName]))
  return {
    procedures: [...procedureNames]
      .map(([code, name]) => ({ code, name }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    roles: [...roleNames]
      .map(([code, name]) => ({ code, name }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    requiredness: distinct((row) => row.requiredness),
    verificationGrades: distinct((row) => row.product_verification_grade),
    visibilityStates: distinct((row) => row.product_visibility_state),
  }
}

const parsedArtifact = slotOptionProposalArtifactSchema.parse(slotOptionProposalArtifactJson)
const catalogStore = getCatalogStore()
const procedureNames = new Map(
  catalogStore.procedures.map((procedure) => [procedure.procedure_code, procedure.procedure_name]),
)
const roleNames = new Map(catalogStore.roles.map((role) => [role.role_code, role.role_name]))
const distributionByProduct = new Map(
  getCatalogVerificationRows().map((row) => [row.productId, row.distributionEvidence]),
)
const reviewRows = buildSlotOptionReviewRows(
  parsedArtifact.proposals,
  procedureNames,
  roleNames,
  distributionByProduct,
)

function copyRow(row: SlotOptionReviewRow): SlotOptionReviewRow {
  return {
    ...row,
    source_identifiers: { ...row.source_identifiers },
  }
}

export function getSlotOptionReviewRows(): SlotOptionReviewRow[] {
  return reviewRows.map(copyRow)
}

export function getSlotOptionProposalsForProduct(productId: string): SlotOptionReviewRow[] {
  return reviewRows.filter((row) => row.product_id === productId).map(copyRow)
}

export function getSlotOptionReviewArtifactSummary(): SlotOptionProposalSummary {
  return { ...parsedArtifact.summary }
}
