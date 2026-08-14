import { displayIdentifier, splitAlternateIdentifiers } from '../openfda/normalize'
import { usableDeviceIdentifier } from '../openfda/query-plan'
import { hiddenProductCohortManifestSchema } from './schemas'
import {
  DEVICE_INTELLIGENCE_EXEMPLARS,
  type ArtifactFreshness,
  type BuildCohortManifestInput,
  type CohortCatalogProductInput,
  type CohortGudidConfirmationInput,
  type CohortGudidContext,
  type CohortMappedRole,
  type CohortOpenFdaContext,
  type CohortOpenFdaProposalInput,
  type CohortPartition,
  type GudidDistributionEvidence,
  type HiddenProductCohortManifest,
  type HiddenProductCohortRow,
  type IdentifierCompleteness,
} from './types'

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.map(displayIdentifier).filter((value): value is string => Boolean(value))),
  ].sort((left, right) => left.localeCompare(right))
}

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`)
    seen.add(value)
  }
}

function appendToIndex<T>(index: Map<string, T[]>, key: string, value: T): void {
  const rows = index.get(key)
  if (rows) rows.push(value)
  else index.set(key, [value])
}

function partitionFor(product: CohortCatalogProductInput): CohortPartition {
  switch (product.verification_grade) {
    case 'verified_source':
      return 'us_status_pending'
    case 'candidate':
      return 'identity_or_specification_pending_candidate'
    case 'unknown':
      return 'identity_or_specification_pending_unknown'
  }
}

interface ModelNumber {
  value: string | null
  source: HiddenProductCohortRow['model_number_source']
}

function explicitModelNumber(product: CohortCatalogProductInput): ModelNumber {
  const candidates: Array<{
    value: unknown
    source: Exclude<HiddenProductCohortRow['model_number_source'], null>
  }> = [
    {
      value: product.spec_json?.manufacturer_model_number,
      source: 'spec_json.manufacturer_model_number',
    },
  ]
  for (const candidate of candidates) {
    const value = usableDeviceIdentifier(candidate.value)
    if (value) return { value, source: candidate.source }
  }
  return { value: null, source: null }
}

function identifierCompleteness(
  product: CohortCatalogProductInput,
  modelNumber: string | null,
): IdentifierCompleteness {
  if (usableDeviceIdentifier(product.gtin)) return 'exact_di'
  if (usableDeviceIdentifier(product.catalog_number)) return 'catalog_number'
  if (
    modelNumber ||
    usableDeviceIdentifier(product.global_part_number) ||
    usableDeviceIdentifier(product.reference_part_number) ||
    splitAlternateIdentifiers(product.alternate_ids).some((value) => usableDeviceIdentifier(value))
  ) {
    return 'model_only'
  }
  return 'insufficient'
}

function normalizedDistribution(value: string): 'in_distribution' | 'not_in_distribution' | null {
  if (/^In Commercial Distribution$/i.test(value.trim())) return 'in_distribution'
  if (/^Not in Commercial Distribution$/i.test(value.trim())) return 'not_in_distribution'
  return null
}

function gudidDistributionEvidence(
  strongMatches: CohortGudidConfirmationInput[],
): GudidDistributionEvidence {
  const parsed = strongMatches.map((match) =>
    normalizedDistribution(match.gudid_distribution_status),
  )
  const recognized = new Set(
    parsed.filter((value): value is Exclude<typeof value, null> => Boolean(value)),
  )
  const hasUnrecognized = parsed.some((value) => value === null)
  if (recognized.size > 1 || (recognized.size > 0 && hasUnrecognized)) return 'conflicting'
  return recognized.values().next().value ?? 'unknown'
}

function gudidContext(
  confirmations: CohortGudidConfirmationInput[],
  freshness: ArtifactFreshness,
): CohortGudidContext {
  const strongMatches = confirmations.filter(
    (row) => row.match_strength === 'manufacturer_and_catalog_number',
  )
  const weakMatches = confirmations.filter((row) => row.match_strength === 'catalog_number_only')
  return {
    artifact_freshness: freshness,
    confirmation_count: confirmations.length,
    strong_match_count: strongMatches.length,
    weak_match_count: weakMatches.length,
    identity_evidence:
      strongMatches.length > 0
        ? 'strong_candidate'
        : weakMatches.length > 0
          ? 'weak_candidate_only'
          : 'unmatched',
    distribution_evidence: gudidDistributionEvidence(strongMatches),
    primary_dis: uniqueSorted(confirmations.map((row) => row.gudid_primary_di)),
    distribution_statuses: uniqueSorted(strongMatches.map((row) => row.gudid_distribution_status)),
  }
}

function openFdaContext(
  proposal: CohortOpenFdaProposalInput | null,
  freshness: ArtifactFreshness,
): CohortOpenFdaContext {
  return {
    artifact_freshness: freshness,
    proposal_present: proposal !== null,
    classification: proposal?.classification ?? null,
    reason_codes: uniqueSorted(proposal?.reason_codes ?? []),
    candidate_primary_di: proposal?.selected_candidate?.primary_di ?? null,
    candidate_catalog_number: proposal?.selected_candidate?.catalog_number ?? null,
    candidate_model_number: proposal?.selected_candidate?.version_or_model_number ?? null,
    commercial_distribution_status:
      proposal?.selected_candidate?.commercial_distribution_status ?? null,
    backlog_comparison: proposal?.backlog_comparison ?? null,
  }
}

function validateRelationships(input: BuildCohortManifestInput): void {
  assertUnique(
    input.catalogProducts.map((product) => product.product_id),
    'catalog product_id',
  )
  assertUnique(
    input.productRoles.map((row) => `${row.product_id}\u0000${row.role_code}`),
    'product-role pair',
  )
  assertUnique(
    input.procedureSlots.map((slot) => slot.slot_id),
    'procedure slot_id',
  )
  assertUnique(
    input.slotProductOptions.map((row) => `${row.slot_id}\u0000${row.product_id}`),
    'slot-product pair',
  )
  assertUnique(
    input.openFdaProposals.map((proposal) => proposal.product_id),
    'openFDA product proposal',
  )

  const productIds = new Set(input.catalogProducts.map((product) => product.product_id))
  const slotById = new Map(input.procedureSlots.map((slot) => [slot.slot_id, slot]))
  for (const row of input.productRoles) {
    if (!productIds.has(row.product_id)) {
      throw new Error(`Product role references unknown product ${row.product_id}.`)
    }
  }
  for (const row of input.slotProductOptions) {
    if (!productIds.has(row.product_id)) {
      throw new Error(`Slot option references unknown product ${row.product_id}.`)
    }
    const slot = slotById.get(row.slot_id)
    if (!slot) throw new Error(`Slot option references unknown slot ${row.slot_id}.`)
    if (slot.role_code !== row.role_code) {
      throw new Error(
        `Slot option ${row.slot_id} × ${row.product_id} has role ${row.role_code}; expected ${slot.role_code}.`,
      )
    }
  }
  for (const row of input.productSources) {
    if (!productIds.has(row.product_id)) {
      throw new Error(`Product source references unknown product ${row.product_id}.`)
    }
  }
  for (const row of input.gudidReport.confirmations) {
    if (!productIds.has(row.product_id)) {
      throw new Error(`GUDID confirmation references unknown product ${row.product_id}.`)
    }
  }
  for (const row of input.openFdaProposals) {
    if (!productIds.has(row.product_id)) {
      throw new Error(`openFDA proposal references unknown product ${row.product_id}.`)
    }
  }
}

export function buildHiddenProductCohortManifest(
  input: BuildCohortManifestInput,
): HiddenProductCohortManifest {
  validateRelationships(input)

  const catalogCount = input.catalogProducts.length
  const gudidFreshness: ArtifactFreshness =
    input.gudidReport.catalog_products === catalogCount ? 'unverifiable' : 'stale'
  const openFdaFreshness: ArtifactFreshness =
    input.openFdaRunSummary.catalog_product_count === catalogCount &&
    input.openFdaRunSummary.catalog_input_sha256 === input.inputHashes.catalog_products_sha256
      ? 'current'
      : 'stale'

  const rolesByProduct = new Map<string, CohortMappedRole[]>()
  for (const row of input.productRoles) {
    appendToIndex(rolesByProduct, row.product_id, {
      role_code: row.role_code,
      role_fit: row.role_fit,
    })
  }
  const slotById = new Map(input.procedureSlots.map((slot) => [slot.slot_id, slot]))
  const proceduresByRole = new Map<string, string[]>()
  for (const slot of input.procedureSlots) {
    appendToIndex(proceduresByRole, slot.role_code, slot.procedure_code)
  }
  const optionsByProduct = new Map<string, BuildCohortManifestInput['slotProductOptions']>()
  for (const row of input.slotProductOptions) appendToIndex(optionsByProduct, row.product_id, row)
  const sourcesByProduct = new Map<string, string[]>()
  for (const row of input.productSources) {
    appendToIndex(sourcesByProduct, row.product_id, row.source_id)
  }
  const gudidByProduct = new Map<string, CohortGudidConfirmationInput[]>()
  for (const row of input.gudidReport.confirmations) {
    appendToIndex(gudidByProduct, row.product_id, row)
  }
  const openFdaByProduct = new Map(
    input.openFdaProposals.map((proposal) => [proposal.product_id, proposal]),
  )

  const hiddenProducts = input.catalogProducts
    .filter((product) => product.visibility_state === 'hidden')
    .sort((left, right) => left.product_id.localeCompare(right.product_id))
  const products = hiddenProducts.map((product): HiddenProductCohortRow => {
    const alternateIds = uniqueSorted(splitAlternateIdentifiers(product.alternate_ids))
    const modelNumber = explicitModelNumber(product)
    const mappedRoles = [...(rolesByProduct.get(product.product_id) ?? [])].sort(
      (left, right) =>
        left.role_code.localeCompare(right.role_code) ||
        (left.role_fit ?? '').localeCompare(right.role_fit ?? ''),
    )
    const authoredOptions = [...(optionsByProduct.get(product.product_id) ?? [])].sort(
      (left, right) => left.slot_id.localeCompare(right.slot_id),
    )
    const selectableOptions = authoredOptions.filter((row) => row.selectable)
    if (selectableOptions.length > 0) {
      throw new Error(
        `Hidden product ${product.product_id} has ${selectableOptions.length} selectable authored slot option(s).`,
      )
    }
    const authoredProcedureCodes = uniqueSorted(
      authoredOptions.map((row) => slotById.get(row.slot_id)?.procedure_code),
    )
    const roleMappedProcedureCodes = uniqueSorted(
      mappedRoles.flatMap((role) => proceduresByRole.get(role.role_code) ?? []),
    )
    const roleMappedProcedureSet = new Set(roleMappedProcedureCodes)
    const sourceIds = uniqueSorted(sourcesByProduct.get(product.product_id) ?? [])
    return {
      product_id: product.product_id,
      manufacturer_id: product.manufacturer_id,
      manufacturer: product.manufacturer,
      product_name: product.product_name,
      catalog_number: displayIdentifier(product.catalog_number),
      model_number: modelNumber.value,
      model_number_source: modelNumber.source,
      gtin_di: displayIdentifier(product.gtin),
      global_part_number: displayIdentifier(product.global_part_number),
      reference_part_number: displayIdentifier(product.reference_part_number),
      alternate_ids: alternateIds,
      verification_grade: product.verification_grade,
      visibility_state: 'hidden',
      cohort_partition: partitionFor(product),
      identifier_completeness: identifierCompleteness(product, modelNumber.value),
      mapped_roles: mappedRoles,
      authored_slot_use_count: authoredOptions.length,
      selectable_slot_use_count: selectableOptions.length,
      authored_slot_ids: authoredOptions.map((row) => row.slot_id),
      authored_procedure_codes: authoredProcedureCodes,
      role_mapped_procedure_codes: roleMappedProcedureCodes,
      device_intelligence_exemplar_flags: {
        CHEST_TUBE: roleMappedProcedureSet.has('CHEST_TUBE'),
        EBUS_TBNA: roleMappedProcedureSet.has('EBUS_TBNA'),
        THERAPEUTIC_BRONCH: roleMappedProcedureSet.has('THERAPEUTIC_BRONCH'),
      },
      source_ids: sourceIds,
      source_count: sourceIds.length,
      existing_gudid: gudidContext(gudidByProduct.get(product.product_id) ?? [], gudidFreshness),
      existing_openfda: openFdaContext(
        openFdaByProduct.get(product.product_id) ?? null,
        openFdaFreshness,
      ),
      canonical_change_applied: false,
    }
  })

  const countIdentifier = (value: IdentifierCompleteness) =>
    products.filter((product) => product.identifier_completeness === value).length
  const hiddenProductIds = new Set(products.map((product) => product.product_id))
  const hiddenRoleRows = input.productRoles.filter((row) => hiddenProductIds.has(row.product_id))
  const hiddenOptionRows = input.slotProductOptions.filter((row) =>
    hiddenProductIds.has(row.product_id),
  )

  const manifest: HiddenProductCohortManifest = {
    format_version: 1,
    generated_by: 'scripts/ip-preference-cards/us-status/build-cohort-manifest.ts',
    git_sha: input.gitSha,
    canonical_change_applied: false,
    cohort_definition: {
      included_visibility_state: 'hidden',
      us_status_pending_predicate:
        'visibility_state === "hidden" && verification_grade === "verified_source"',
    },
    input_hashes: { ...input.inputHashes },
    evidence_artifacts: {
      gudid: {
        artifact_freshness: gudidFreshness,
        artifact_catalog_product_count: input.gudidReport.catalog_products,
        current_catalog_product_count: catalogCount,
      },
      openfda: {
        artifact_freshness: openFdaFreshness,
        artifact_catalog_product_count: input.openFdaRunSummary.catalog_product_count,
        artifact_catalog_input_sha256: input.openFdaRunSummary.catalog_input_sha256,
        current_catalog_product_count: catalogCount,
        current_catalog_input_sha256: input.inputHashes.catalog_products_sha256,
        products_processed: input.openFdaRunSummary.products_processed,
      },
    },
    counts: {
      catalog_products_total: catalogCount,
      prototype_visible_products: input.catalogProducts.filter(
        (product) => product.visibility_state === 'prototype_visible',
      ).length,
      hidden_products: products.length,
      hidden_verified_source: products.filter(
        (product) => product.verification_grade === 'verified_source',
      ).length,
      hidden_candidate: products.filter((product) => product.verification_grade === 'candidate')
        .length,
      hidden_unknown: products.filter((product) => product.verification_grade === 'unknown').length,
      identifier_completeness: {
        exact_di: countIdentifier('exact_di'),
        catalog_number: countIdentifier('catalog_number'),
        model_only: countIdentifier('model_only'),
        insufficient: countIdentifier('insufficient'),
      },
      mapped_role_rows: hiddenRoleRows.length,
      authored_slot_uses: hiddenOptionRows.length,
      selectable_slot_uses: hiddenOptionRows.filter((row) => row.selectable).length,
      products_with_authored_slot_use: products.filter(
        (product) => product.authored_slot_use_count > 0,
      ).length,
      products_with_selectable_slot_use: products.filter(
        (product) => product.selectable_slot_use_count > 0,
      ).length,
    },
    products,
  }

  const exemplarKeys = Object.keys(products[0]?.device_intelligence_exemplar_flags ?? {})
  if (products.length > 0 && exemplarKeys.join('|') !== DEVICE_INTELLIGENCE_EXEMPLARS.join('|')) {
    throw new Error('Device Intelligence exemplar flags drifted from the reviewed code list.')
  }
  return hiddenProductCohortManifestSchema.parse(manifest) as HiddenProductCohortManifest
}
