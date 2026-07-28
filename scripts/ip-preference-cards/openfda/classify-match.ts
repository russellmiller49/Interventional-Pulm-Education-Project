import { manufacturerMatchesAlias } from './manufacturer-aliases'
import {
  displayIdentifier,
  exactIdentifierComparison,
  normalizeManufacturerName,
  splitAlternateIdentifiers,
  stableUnique,
} from './normalize'
import type {
  BacklogComparison,
  CatalogProductInput,
  ManufacturerAliasGroup,
  OpenFdaCandidateSummary,
  OpenFdaClassification,
  OpenFdaMatchedCandidate,
  OpenFdaQuery,
  OpenFdaRecord,
  VerificationBacklogInput,
} from './types'
import { OPENFDA_QUERY_KINDS } from './types'

export interface CandidateSignals {
  exactCanonicalDi: boolean
  exactSuggestedDi: boolean
  exactCatalog: boolean
  manufacturerAlias: boolean
  exactModel: boolean
  exactAlternate: boolean
  brandFallbackOnly: boolean
  modelConflict: boolean
  distributionUnclear: boolean
  distributionConflict: boolean
}

export interface OpenFdaClassificationResult {
  classification: OpenFdaClassification
  reasonCodes: string[]
  selectedCandidate: OpenFdaMatchedCandidate | null
  selectedCandidateSummary: OpenFdaCandidateSummary | null
  backlogComparison: BacklogComparison
}

function stringOrNull(value: string | null | undefined): string | null {
  return displayIdentifier(value)
}

export function primaryIdentifier(record: OpenFdaRecord): string | null {
  const identifiers = [...(record.identifiers ?? [])].sort(
    (left, right) =>
      (left.type?.toLocaleLowerCase('en-US') === 'primary' ? 0 : 1) -
        (right.type?.toLocaleLowerCase('en-US') === 'primary' ? 0 : 1) ||
      left.id.localeCompare(right.id),
  )
  return (
    identifiers.find((identifier) => identifier.type?.toLocaleLowerCase('en-US') === 'primary')
      ?.id ?? null
  )
}

export function openFdaRecordIdentity(record: OpenFdaRecord): string {
  const explicitKey =
    stringOrNull(record.record_key) ?? stringOrNull(record.public_device_record_key)
  if (explicitKey) return `key:${explicitKey}`
  const identifiers = [...(record.identifiers ?? [])]
    .map((identifier) => exactIdentifierComparison(identifier.id) ?? identifier.id)
    .sort()
  return [
    'fields',
    identifiers.join('|'),
    exactIdentifierComparison(record.catalog_number) ?? '',
    normalizeManufacturerName(record.company_name) ?? '',
    exactIdentifierComparison(record.version_or_model_number) ?? '',
  ].join(':')
}

function sortQueryKinds(kinds: OpenFdaQuery['kind'][]): OpenFdaQuery['kind'][] {
  const order = new Map(OPENFDA_QUERY_KINDS.map((kind, index) => [kind, index]))
  return stableUnique(kinds, (kind) => kind).sort(
    (left, right) => (order.get(left) ?? 99) - (order.get(right) ?? 99),
  )
}

export function mergeOpenFdaCandidates(
  existing: OpenFdaMatchedCandidate[],
  records: OpenFdaRecord[],
  query: OpenFdaQuery,
  retrievedAt: string,
  rawCacheReference: string,
): OpenFdaMatchedCandidate[] {
  const byIdentity = new Map(
    existing.map((candidate) => [openFdaRecordIdentity(candidate.record), candidate]),
  )
  for (const record of records) {
    const identity = openFdaRecordIdentity(record)
    const current = byIdentity.get(identity)
    if (current) {
      current.queryKinds = sortQueryKinds([...current.queryKinds, query.kind])
      current.querySearches = stableUnique(
        [...current.querySearches, query.search],
        (search) => search,
      ).sort()
      current.retrievedAt = stableUnique(
        [...current.retrievedAt, retrievedAt],
        (value) => value,
      ).sort()
      current.rawCacheReferences = stableUnique(
        [...current.rawCacheReferences, rawCacheReference],
        (value) => value,
      ).sort()
    } else {
      byIdentity.set(identity, {
        record,
        queryKinds: [query.kind],
        querySearches: [query.search],
        retrievedAt: [retrievedAt],
        rawCacheReferences: [rawCacheReference],
      })
    }
  }
  return [...byIdentity.values()].sort((left, right) =>
    openFdaRecordIdentity(left.record).localeCompare(openFdaRecordIdentity(right.record)),
  )
}

function normalizedSet(values: Array<string | null | undefined>): Set<string> {
  return new Set(
    values
      .map((value) => exactIdentifierComparison(value))
      .filter((value): value is string => Boolean(value)),
  )
}

function hasIdentifier(record: OpenFdaRecord, identifiers: Set<string>): boolean {
  return (record.identifiers ?? []).some((identifier) => {
    const normalized = exactIdentifierComparison(identifier.id)
    return normalized ? identifiers.has(normalized) : false
  })
}

function distributionsConflict(
  candidate: string | null | undefined,
  backlog: string | null | undefined,
): boolean {
  const normalizedCandidate = candidate?.trim().toLocaleLowerCase('en-US')
  const normalizedBacklog = backlog?.trim().toLocaleLowerCase('en-US')
  return Boolean(
    normalizedCandidate && normalizedBacklog && normalizedCandidate !== normalizedBacklog,
  )
}

export function signalsFor(
  candidate: OpenFdaMatchedCandidate,
  product: CatalogProductInput,
  aliasGroup: ManufacturerAliasGroup,
  backlog: VerificationBacklogInput | null,
): CandidateSignals {
  const canonicalDis = normalizedSet([product.gtin, backlog?.existing_gtin])
  const suggestedDis = normalizedSet([backlog?.suggested_primary_di])
  const directModels = normalizedSet([
    product.catalog_number,
    product.global_part_number,
    product.reference_part_number,
  ])
  const alternates = normalizedSet(splitAlternateIdentifiers(product.alternate_ids))
  const recordModel = exactIdentifierComparison(candidate.record.version_or_model_number)
  const recordCatalog = exactIdentifierComparison(candidate.record.catalog_number)
  const productCatalog = exactIdentifierComparison(product.catalog_number)
  const exactModel = recordModel ? directModels.has(recordModel) : false
  const exactAlternate = recordModel ? alternates.has(recordModel) : false
  const hasKnownConfiguration = directModels.size > 0 || alternates.size > 0
  return {
    exactCanonicalDi: canonicalDis.size > 0 && hasIdentifier(candidate.record, canonicalDis),
    exactSuggestedDi: suggestedDis.size > 0 && hasIdentifier(candidate.record, suggestedDis),
    exactCatalog: Boolean(recordCatalog && productCatalog && recordCatalog === productCatalog),
    manufacturerAlias: manufacturerMatchesAlias(candidate.record.company_name, aliasGroup),
    exactModel,
    exactAlternate,
    brandFallbackOnly: candidate.queryKinds.every((kind) => kind === 'brand_fallback'),
    modelConflict: Boolean(recordModel && hasKnownConfiguration && !exactModel && !exactAlternate),
    distributionUnclear: !displayIdentifier(candidate.record.commercial_distribution_status),
    distributionConflict: distributionsConflict(
      candidate.record.commercial_distribution_status,
      backlog?.distribution_status,
    ),
  }
}

function normalizedDifferenceCount(left: string, right: string): number {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY
  let differences = 0
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) differences += 1
  }
  return differences
}

function looksLikeAdjacentSku(
  canonicalCatalog: string | null,
  candidateCatalog: string | null,
): boolean {
  if (!canonicalCatalog || !candidateCatalog || canonicalCatalog === candidateCatalog) {
    return false
  }
  return (
    canonicalCatalog.startsWith(candidateCatalog) ||
    candidateCatalog.startsWith(canonicalCatalog) ||
    normalizedDifferenceCount(canonicalCatalog, candidateCatalog) === 1
  )
}

function packageConfigurationIdentity(candidate: OpenFdaMatchedCandidate): string {
  const record = candidate.record
  const packageIdentifiers = (record.identifiers ?? [])
    .filter((identifier) => identifier.type?.toLocaleLowerCase('en-US') === 'package')
    .map((identifier) => exactIdentifierComparison(identifier.id) ?? identifier.id)
    .sort()
  return [
    exactIdentifierComparison(primaryIdentifier(record)) ?? '',
    exactIdentifierComparison(record.version_or_model_number) ?? '',
    String(record.device_count_in_base_package ?? ''),
    packageIdentifiers.join('|'),
  ].join(':')
}

export function highConfidenceInvariantViolations({
  product,
  aliasGroup,
  backlog = null,
  candidates,
  selectedCandidate,
}: {
  product: CatalogProductInput
  aliasGroup: ManufacturerAliasGroup
  backlog?: VerificationBacklogInput | null
  candidates: OpenFdaMatchedCandidate[]
  selectedCandidate: OpenFdaMatchedCandidate
}): string[] {
  const selectedSignals = signalsFor(selectedCandidate, product, aliasGroup, backlog)
  const canonicalCatalog = exactIdentifierComparison(product.catalog_number)
  const candidateCatalog = exactIdentifierComparison(selectedCandidate.record.catalog_number)
  const proposedPrimaryDi = exactIdentifierComparison(primaryIdentifier(selectedCandidate.record))
  const existingDis = normalizedSet([
    product.gtin,
    backlog?.existing_gtin,
    backlog?.suggested_primary_di,
  ])
  const sameCatalogAndCompany = candidates.filter((candidate) => {
    const signals = signalsFor(candidate, product, aliasGroup, backlog)
    return signals.exactCatalog && signals.manufacturerAlias
  })
  const eligibleCandidates = sameCatalogAndCompany.filter((candidate) => {
    const signals = signalsFor(candidate, product, aliasGroup, backlog)
    return (
      !signals.modelConflict &&
      !signals.distributionUnclear &&
      !signals.distributionConflict &&
      Boolean(primaryIdentifier(candidate.record))
    )
  })
  const packageConfigurations = new Set(sameCatalogAndCompany.map(packageConfigurationIdentity))
  const violations = new Set<string>()

  if (!canonicalCatalog || candidateCatalog !== canonicalCatalog) {
    violations.add('high_confidence_invariant_catalog_mismatch')
  }
  if (!selectedSignals.manufacturerAlias) {
    violations.add('high_confidence_invariant_manufacturer_alias_mismatch')
  }
  if (eligibleCandidates.length !== 1) {
    violations.add('high_confidence_invariant_non_unique_eligible_candidate')
  }
  if (selectedSignals.modelConflict) {
    violations.add('high_confidence_invariant_model_or_configuration_conflict')
  }
  if (sameCatalogAndCompany.length > 1 && packageConfigurations.size > 1) {
    violations.add('high_confidence_invariant_package_level_ambiguity')
  }
  if (selectedCandidate.queryKinds.every((kind) => kind === 'brand_fallback')) {
    violations.add('high_confidence_invariant_product_name_only_evidence')
  }
  if (looksLikeAdjacentSku(canonicalCatalog, candidateCatalog)) {
    violations.add('high_confidence_invariant_adjacent_sku')
  }
  if (!proposedPrimaryDi) {
    violations.add('high_confidence_invariant_missing_primary_di')
  }
  if (existingDis.size > 0 && (!proposedPrimaryDi || !existingDis.has(proposedPrimaryDi))) {
    violations.add('high_confidence_invariant_existing_di_mismatch')
  }

  return [...violations].sort()
}

function candidateRank(signals: CandidateSignals): number {
  if (signals.exactCanonicalDi) return 700
  if (signals.exactSuggestedDi && signals.exactCatalog && signals.manufacturerAlias) return 600
  if (signals.exactCatalog && signals.manufacturerAlias && !signals.modelConflict) return 500
  if (signals.exactSuggestedDi) return 450
  if (signals.exactCatalog) return 400
  if (signals.exactModel) return 300
  if (signals.exactAlternate) return 250
  if (signals.brandFallbackOnly) return 100
  return 0
}

export function summarizeOpenFdaCandidate(
  candidate: OpenFdaMatchedCandidate,
): OpenFdaCandidateSummary {
  const record = candidate.record
  return {
    record_key: stringOrNull(record.record_key),
    public_device_record_key: stringOrNull(record.public_device_record_key),
    primary_di: primaryIdentifier(record),
    brand_name: stringOrNull(record.brand_name),
    company_name: stringOrNull(record.company_name),
    catalog_number: stringOrNull(record.catalog_number),
    version_or_model_number: stringOrNull(record.version_or_model_number),
    commercial_distribution_status: stringOrNull(record.commercial_distribution_status),
    public_version_date: stringOrNull(record.public_version_date),
    record_status: stringOrNull(record.record_status),
    query_kinds: sortQueryKinds(candidate.queryKinds),
  }
}

export function compareWithVerificationBacklog(
  selectedCandidate: OpenFdaMatchedCandidate | null,
  backlog: VerificationBacklogInput | null,
): BacklogComparison {
  if (!backlog) return 'not_previously_evaluated'
  const proposedDi = selectedCandidate ? primaryIdentifier(selectedCandidate.record) : null
  const backlogDi = displayIdentifier(backlog.suggested_primary_di)
  if (
    proposedDi &&
    backlogDi &&
    exactIdentifierComparison(proposedDi) !== exactIdentifierComparison(backlogDi)
  ) {
    return 'conflicts_with_existing_di'
  }
  if (
    selectedCandidate &&
    distributionsConflict(
      selectedCandidate.record.commercial_distribution_status,
      backlog.distribution_status,
    )
  ) {
    return 'conflicts_with_distribution_status'
  }
  if (!proposedDi && backlogDi) return 'existing_backlog_has_more_specific_match'
  if (proposedDi && !backlogDi) return 'adds_missing_candidate'
  if (
    proposedDi &&
    backlogDi &&
    exactIdentifierComparison(proposedDi) === exactIdentifierComparison(backlogDi)
  ) {
    return 'agrees_with_existing_backlog'
  }
  return 'not_previously_evaluated'
}

export function classifyOpenFdaMatch({
  product,
  aliasGroup,
  backlog = null,
  candidates,
}: {
  product: CatalogProductInput
  aliasGroup: ManufacturerAliasGroup
  backlog?: VerificationBacklogInput | null
  candidates: OpenFdaMatchedCandidate[]
}): OpenFdaClassificationResult {
  if (candidates.length === 0) {
    return {
      classification: 'unmatched',
      reasonCodes: ['no_candidate_found'],
      selectedCandidate: null,
      selectedCandidateSummary: null,
      backlogComparison: compareWithVerificationBacklog(null, backlog),
    }
  }

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      signals: signalsFor(candidate, product, aliasGroup, backlog),
    }))
    .sort(
      (left, right) =>
        candidateRank(right.signals) - candidateRank(left.signals) ||
        openFdaRecordIdentity(left.candidate.record).localeCompare(
          openFdaRecordIdentity(right.candidate.record),
        ),
    )
  const selected = ranked[0]
  const exactDiMatches = ranked.filter(({ signals }) => signals.exactCanonicalDi)
  const reasons = new Set<string>()
  let classification: OpenFdaClassification = 'review_required'

  if (
    exactDiMatches.length === 1 &&
    !selected.signals.modelConflict &&
    !selected.signals.distributionUnclear &&
    !selected.signals.distributionConflict
  ) {
    classification = 'high_confidence_candidate'
    reasons.add('exact_existing_di_match')
  } else if (
    ranked.length === 1 &&
    selected.signals.exactCatalog &&
    selected.signals.manufacturerAlias &&
    !selected.signals.modelConflict &&
    !selected.signals.distributionUnclear &&
    !selected.signals.distributionConflict
  ) {
    classification = 'high_confidence_candidate'
    reasons.add('exact_catalog_and_approved_manufacturer_alias')
  } else {
    if (ranked.length > 1) reasons.add('multiple_candidate_records')
    if (exactDiMatches.length > 1) reasons.add('duplicate_exact_di_records')
    if (selected.signals.exactCatalog && !selected.signals.manufacturerAlias) {
      reasons.add('catalog_match_manufacturer_conflict')
    }
    if (selected.signals.exactModel && !selected.signals.exactCatalog) {
      reasons.add('model_only_match')
    }
    if (selected.signals.exactAlternate && !selected.signals.exactCatalog) {
      reasons.add('alternate_identifier_only_match')
    }
    if (selected.signals.exactSuggestedDi && !selected.signals.exactCanonicalDi) {
      reasons.add('matches_existing_backlog_suggestion_only')
    }
    if (selected.signals.brandFallbackOnly) reasons.add('product_family_fallback_only')
    if (selected.signals.modelConflict) reasons.add('model_or_configuration_conflict')
    if (selected.signals.distributionUnclear) reasons.add('distribution_status_unclear')
    if (selected.signals.distributionConflict) {
      reasons.add('distribution_status_conflicts_with_backlog')
    }
    if (reasons.size === 0) reasons.add('candidate_requires_human_review')
  }

  const backlogComparison = compareWithVerificationBacklog(selected.candidate, backlog)
  if (backlogComparison === 'conflicts_with_existing_di') {
    classification = 'review_required'
    reasons.add('existing_backlog_di_conflict')
  }
  if (backlogComparison === 'conflicts_with_distribution_status') {
    classification = 'review_required'
    reasons.add('existing_backlog_distribution_conflict')
  }

  if (classification === 'high_confidence_candidate') {
    const invariantViolations = highConfidenceInvariantViolations({
      product,
      aliasGroup,
      backlog,
      candidates,
      selectedCandidate: selected.candidate,
    })
    if (invariantViolations.length > 0) {
      classification = 'review_required'
      reasons.add('high_confidence_invariant_failed')
      invariantViolations.forEach((reason) => reasons.add(reason))
    }
  }

  return {
    classification,
    reasonCodes: [...reasons].sort(),
    selectedCandidate: selected.candidate,
    selectedCandidateSummary: summarizeOpenFdaCandidate(selected.candidate),
    backlogComparison,
  }
}
