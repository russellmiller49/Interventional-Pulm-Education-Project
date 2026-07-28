import { readFile } from 'node:fs/promises'
import path from 'node:path'

import productRolesJson from '../../../../data/ip-preference-cards/generated/product-roles.json'
import procedureSlotsJson from '../../../../data/ip-preference-cards/generated/procedure-slots.json'
import verificationBacklogJson from '../../../../data/ip-preference-cards/generated/verification-backlog.json'
import { openFdaEnrichmentProposalsSchema } from '../../../../scripts/ip-preference-cards/openfda/schemas'
import {
  OPENFDA_CLASSIFICATIONS,
  type OpenFdaClassification,
  type OpenFdaEnrichmentProposal,
} from '../../../../scripts/ip-preference-cards/openfda/types'

const DEFAULT_PROPOSALS_PATH =
  'data/ip-preference-cards/generated/openfda/enrichment-proposals.json'

interface ProductRoleRow {
  product_id: string
  role_code: string
}

interface BacklogReviewContext {
  product_id: string
  procedures?: string | null
  roles?: string | null
}

interface ProcedureSlotContext {
  procedure_code: string
  role_code: string
}

export interface OpenFdaReviewRow {
  productId: string
  manufacturer: string | null
  productName: string
  catalogNumber: string | null
  classification: OpenFdaClassification
  candidateDi: string | null
  candidateCatalogNumber: string | null
  candidateManufacturer: string | null
  candidateModel: string | null
  distributionStatus: string | null
  reasonCodes: string[]
  backlogComparison: string
  backlogConflict: boolean
  publicVersionDate: string | null
  procedures: string | null
  roles: string | null
}

export interface OpenFdaReviewData {
  status: 'available' | 'missing' | 'invalid'
  rows: OpenFdaReviewRow[]
  counts: Record<OpenFdaClassification, number>
}

function emptyCounts(): Record<OpenFdaClassification, number> {
  return Object.fromEntries(
    OPENFDA_CLASSIFICATIONS.map((classification) => [classification, 0]),
  ) as Record<OpenFdaClassification, number>
}

export function buildOpenFdaReviewData(
  proposals: OpenFdaEnrichmentProposal[],
  productRoles: ProductRoleRow[] = productRolesJson as ProductRoleRow[],
  backlogRows: BacklogReviewContext[] = verificationBacklogJson as BacklogReviewContext[],
  procedureSlots: ProcedureSlotContext[] = procedureSlotsJson as ProcedureSlotContext[],
): OpenFdaReviewData {
  const rolesByProduct = new Map<string, string[]>()
  for (const role of productRoles) {
    rolesByProduct.set(role.product_id, [
      ...(rolesByProduct.get(role.product_id) ?? []),
      role.role_code,
    ])
  }
  const proceduresByRole = new Map<string, string[]>()
  for (const slot of procedureSlots) {
    proceduresByRole.set(slot.role_code, [
      ...(proceduresByRole.get(slot.role_code) ?? []),
      slot.procedure_code,
    ])
  }
  const backlogByProduct = new Map(backlogRows.map((row) => [row.product_id, row]))
  const counts = emptyCounts()
  const rows = [...proposals]
    .sort((left, right) => left.product_id.localeCompare(right.product_id))
    .map((proposal) => {
      counts[proposal.classification] += 1
      const backlog = backlogByProduct.get(proposal.product_id)
      const mappedRoles = [...new Set(rolesByProduct.get(proposal.product_id) ?? [])].sort()
      const mappedProcedures = [
        ...new Set(mappedRoles.flatMap((role) => proceduresByRole.get(role) ?? [])),
      ].sort()
      return {
        productId: proposal.product_id,
        manufacturer: proposal.manufacturer,
        productName: proposal.product_name,
        catalogNumber: proposal.catalog_number,
        classification: proposal.classification,
        candidateDi: proposal.proposed_fields.primary_di,
        candidateCatalogNumber: proposal.selected_candidate?.catalog_number ?? null,
        candidateManufacturer: proposal.selected_candidate?.company_name ?? null,
        candidateModel: proposal.selected_candidate?.version_or_model_number ?? null,
        distributionStatus: proposal.proposed_fields.commercial_distribution_status,
        reasonCodes: [...proposal.reason_codes],
        backlogComparison: proposal.backlog_comparison,
        backlogConflict: proposal.backlog_comparison.startsWith('conflicts_'),
        publicVersionDate: proposal.proposed_fields.public_version_date,
        procedures:
          backlog?.procedures ?? (mappedProcedures.length > 0 ? mappedProcedures.join(', ') : null),
        roles: backlog?.roles ?? (mappedRoles.length > 0 ? mappedRoles.join(', ') : null),
      }
    })
  return { status: 'available', rows, counts }
}

export async function getOpenFdaReviewData(
  proposalsPath = path.join(process.cwd(), DEFAULT_PROPOSALS_PATH),
): Promise<OpenFdaReviewData> {
  try {
    const proposals = openFdaEnrichmentProposalsSchema.parse(
      JSON.parse(await readFile(proposalsPath, 'utf8')) as unknown,
    )
    return buildOpenFdaReviewData(proposals)
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: unknown }).code)
        : null
    return {
      status: code === 'ENOENT' ? 'missing' : 'invalid',
      rows: [],
      counts: emptyCounts(),
    }
  }
}
