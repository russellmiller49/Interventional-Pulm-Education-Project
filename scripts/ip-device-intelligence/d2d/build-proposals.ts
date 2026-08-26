import type {
  ProfileClaim,
  ProfileSpecification,
} from '../../../src/features/device-intelligence/domain/product-profile'
import { proposeRegulatoryMatch } from './matching'
import {
  canonicalJson,
  extractOfficialUrl,
  readJsonWithBytes,
  sha256,
  writeOrCheckFile,
} from './io'
import { D2D_PATHS, D2D_REPO_ROOT, d2dAbsolutePath } from './paths'
import {
  acquisitionManifestSchema,
  evidenceProposalArtifactSchema,
  evidenceSourceArtifactSchema,
  pilotCohortArtifactSchema,
  productProfileEvidenceArtifactSchema,
  profileDraftArtifactSchema,
  type AcquisitionManifest,
  type EvidenceProposalArtifact,
  type EvidenceSourceArtifact,
  type PilotCohortArtifact,
  type ProductProfileEvidenceArtifact,
  type ProfileDraftArtifact,
} from './schemas'

interface CatalogProduct {
  product_id: string
  manufacturer_id: string
  manufacturer: string
  product_name: string
  catalog_number: string | null
  brand_family: string | null
  gtin: string | null
  product_kind: string | null
  description: string | null
  size_display?: string | null
  diameter_mm?: number | null
  length_mm?: number | null
  working_length_cm?: number | null
  min_working_channel_mm?: number | null
  gauge?: string | number | null
  material?: string | null
  reuse_status?: string | null
  sterile_status?: string | null
  reference_part_number?: string | null
  spec_json?: Record<string, unknown> | null
}

interface GovernedSource {
  source_id: string
  title: string
  publisher: string | null
  as_of_date: string | null
  use_policy: string
  notes: string | null
}

interface SourceManifestRow {
  governed_source_ids?: string[]
  evidence_id?: string
  sha256: string
  page_count: number | null
  publisher: string | null
  manufacturer: string | null
  official_url: string | null
  retrieved_on?: string
}

interface SourceCompletenessManifest {
  reviewed_on: string
  sources: SourceManifestRow[]
}

interface GeneratorInputs {
  cohort: PilotCohortArtifact
  cohortBytes: Buffer
  catalog: CatalogProduct[]
  catalogBytes: Buffer
  governedSources: GovernedSource[]
  governedSourcesBytes: Buffer
  sourceManifest: SourceCompletenessManifest
  sourceManifestBytes: Buffer
  acquisition: AcquisitionManifest
  acquisitionBytes: Buffer
}

interface GeneratedD2DProposals {
  evidenceSources: EvidenceSourceArtifact
  profileEvidence: ProductProfileEvidenceArtifact
  profileDrafts: ProfileDraftArtifact
  evidenceProposals: EvidenceProposalArtifact
}

function sourceId(governedSourceId: string, manifestEvidenceId: string | null): string {
  return `D2D-SRC-${governedSourceId.replace('SRC', '')}-${manifestEvidenceId?.replace('EVID-SC-', '') ?? 'BASE'}`
}

function acquiredSourceId(
  result: AcquisitionManifest['results'][number],
  page: AcquisitionManifest['results'][number]['pages'][number],
): string {
  return `D2D-SRC-FDA-${result.dataset.toUpperCase()}-${sha256(`${result.query_id}|${page.request_skip}`).slice(0, 12).toUpperCase()}`
}

function acquisitionSourceKind(dataset: AcquisitionManifest['results'][number]['dataset']) {
  if (dataset === 'udi') return 'gudid' as const
  if (dataset === 'classification') return 'fda_classification' as const
  if (dataset === 'registrationlisting') return 'fda_registration_listing' as const
  return 'fda_premarket' as const
}

function acquisitionUsePolicy(dataset: AcquisitionManifest['results'][number]['dataset']): string {
  if (dataset === 'udi') {
    return 'Use for DI, labeler, model, and distribution-field identity only; GUDID is not authorization or present orderability evidence.'
  }
  if (dataset === 'registrationlisting') {
    return 'Use as registration/listing evidence only; registration or listing is not clearance or approval.'
  }
  if (dataset === 'classification') {
    return 'Use for classification-level evidence only; a product code does not establish an exact-product conclusion.'
  }
  return 'Use as a premarket candidate pending exact-product identity and pathway-result owner review.'
}

function acquisitionSourceReference(
  result: AcquisitionManifest['results'][number],
  page: AcquisitionManifest['results'][number]['pages'][number],
) {
  const recordKeys = result.candidates
    .map(
      (candidate) =>
        candidate.record_key ?? candidate.primary_di ?? candidate.k_number ?? candidate.pma_number,
    )
    .filter((value): value is string => Boolean(value))
    .sort()
  return {
    source_id: acquiredSourceId(result, page),
    locator: `${result.query_id}; request skip ${page.request_skip}; ${recordKeys.length > 0 ? `record keys ${recordKeys.join(', ')}` : 'no result record returned'}`,
  }
}

function primitiveConfigurationValues(
  product: CatalogProduct,
): Record<string, string | number | boolean | null> {
  const values: Record<string, string | number | boolean | null> = {}
  const candidates: Record<string, unknown> = {
    catalog_number: product.catalog_number,
    gtin: product.gtin,
    product_kind: product.product_kind,
    brand_family: product.brand_family,
    size_display: product.size_display,
    diameter_mm: product.diameter_mm,
    length_mm: product.length_mm,
    working_length_cm: product.working_length_cm,
    min_working_channel_mm: product.min_working_channel_mm,
    gauge: product.gauge,
    material: product.material,
    reuse_status: product.reuse_status,
    sterile_status: product.sterile_status,
    reference_part_number: product.reference_part_number,
    ...(product.spec_json ?? {}),
  }
  for (const [key, value] of Object.entries(candidates).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      values[key] = value
    }
  }
  return values
}

function chooseManifestRow(options: {
  manifest: SourceCompletenessManifest
  governedSourceId: string
  manifestEvidenceId: string | null
}): SourceManifestRow {
  const matchingSource = options.manifest.sources.filter((row) =>
    row.governed_source_ids?.includes(options.governedSourceId),
  )
  const matchingEvidence = options.manifestEvidenceId
    ? matchingSource.filter((row) => row.evidence_id === options.manifestEvidenceId)
    : matchingSource
  if (matchingEvidence.length !== 1) {
    throw new Error(
      `Expected exactly one source-manifest row for ${options.governedSourceId}/${options.manifestEvidenceId ?? 'BASE'}, found ${matchingEvidence.length}.`,
    )
  }
  return matchingEvidence[0]
}

function buildEvidenceSources(inputs: GeneratorInputs): EvidenceSourceArtifact {
  const governedById = new Map(inputs.governedSources.map((source) => [source.source_id, source]))
  const bindings = inputs.cohort.products.flatMap((product) => product.source_bindings)
  const bindingByKey = new Map<string, (typeof bindings)[number]>()
  for (const binding of bindings) {
    const key = `${binding.governed_source_id}|${binding.manifest_evidence_id ?? 'BASE'}`
    const existing = bindingByKey.get(key)
    if (existing && existing.source_kind !== binding.source_kind) {
      throw new Error(`Source ${key} is assigned conflicting source kinds.`)
    }
    bindingByKey.set(key, binding)
  }

  const governedSources = [...bindingByKey.values()].map((binding) => {
    const governed = governedById.get(binding.governed_source_id)
    if (!governed) throw new Error(`Unknown governed source ${binding.governed_source_id}.`)
    const manifest = chooseManifestRow({
      manifest: inputs.sourceManifest,
      governedSourceId: binding.governed_source_id,
      manifestEvidenceId: binding.manifest_evidence_id,
    })
    return {
      source_id: sourceId(binding.governed_source_id, binding.manifest_evidence_id),
      governed_source_id: binding.governed_source_id,
      source_kind: binding.source_kind,
      title: governed.title,
      organization: manifest.publisher ?? manifest.manufacturer ?? governed.publisher ?? 'Unknown',
      official_url: manifest.official_url ?? extractOfficialUrl(governed.notes),
      snapshot_date:
        manifest.retrieved_on ?? governed.as_of_date ?? inputs.sourceManifest.reviewed_on,
      content_sha256: manifest.sha256,
      manifest_evidence_id: binding.manifest_evidence_id,
      page_count: manifest.page_count,
      use_policy: governed.use_policy,
      review_state: 'governed_existing_source' as const,
    }
  })
  const acquiredSources = inputs.acquisition.results.flatMap((result) =>
    result.pages.map((page) => ({
      source_id: acquiredSourceId(result, page),
      governed_source_id: null,
      source_kind: acquisitionSourceKind(result.dataset),
      title: `openFDA device ${result.dataset} query ${result.query_id}`,
      organization: 'U.S. Food and Drug Administration / NLM',
      official_url: page.request_url,
      snapshot_date: inputs.acquisition.snapshot_date,
      content_sha256: page.response_sha256,
      manifest_evidence_id: null,
      page_count: null,
      use_policy: acquisitionUsePolicy(result.dataset),
      review_state: 'acquired_official_source' as const,
    })),
  )
  const sources = [...governedSources, ...acquiredSources].sort((left, right) =>
    left.source_id.localeCompare(right.source_id),
  )

  return evidenceSourceArtifactSchema.parse({
    format_version: 1,
    artifact_kind: 'd2d_reviewed_evidence_sources',
    method_version: 'd2d-evidence-sources-v1',
    source_artifacts: {
      governed_sources: {
        path: D2D_PATHS.governedSources,
        sha256: sha256(inputs.governedSourcesBytes),
      },
      source_completeness_manifest: {
        path: D2D_PATHS.sourceCompletenessManifest,
        sha256: sha256(inputs.sourceManifestBytes),
      },
      pilot_cohort: { path: D2D_PATHS.pilotCohort, sha256: sha256(inputs.cohortBytes) },
      acquisition_manifest: {
        path: D2D_PATHS.acquisitionManifest,
        sha256: sha256(inputs.acquisitionBytes),
      },
    },
    sources,
  })
}

function sourceReference(
  binding: PilotCohortArtifact['products'][number]['source_bindings'][number],
) {
  return {
    source_id: sourceId(binding.governed_source_id, binding.manifest_evidence_id),
    locator: binding.locator,
  }
}

function buildProfileEvidence(
  inputs: GeneratorInputs,
  evidenceSources: EvidenceSourceArtifact,
): ProductProfileEvidenceArtifact {
  const catalogById = new Map(inputs.catalog.map((product) => [product.product_id, product]))
  const evidenceSourceBytes = Buffer.from(canonicalJson(evidenceSources))
  const rows = inputs.cohort.products.map((pilotProduct) => {
    const product = catalogById.get(pilotProduct.product_id)
    if (!product)
      throw new Error(`Pilot product ${pilotProduct.product_id} is absent from catalog.`)
    const canonicalIdentity = {
      product_id: product.product_id,
      manufacturer_id: product.manufacturer_id,
      manufacturer: product.manufacturer,
      product_name: product.product_name,
      catalog_number: product.catalog_number,
      brand_family: product.brand_family,
      gtin: product.gtin,
      product_kind: product.product_kind,
      catalog_description: product.description,
    }
    return {
      product_id: product.product_id,
      canonical_identity: canonicalIdentity,
      canonical_identity_sha256: sha256(JSON.stringify(canonicalIdentity)),
      description_profile_group_id: pilotProduct.description_profile_group_id,
      proposed_description_scope: pilotProduct.proposed_description_scope,
      source_bindings: pilotProduct.source_bindings.map((binding) => ({
        ...sourceReference(binding),
        evidence_scope: binding.evidence_scope,
        supports: [...binding.supports].sort(),
      })),
      configuration_values: primitiveConfigurationValues(product),
      evidence_snapshot_date: inputs.cohort.snapshot_date,
      evidence_review_state: 'pending_owner_review' as const,
    }
  })

  return productProfileEvidenceArtifactSchema.parse({
    format_version: 1,
    artifact_kind: 'd2d_product_profile_evidence',
    method_version: 'd2d-product-profile-evidence-v1',
    source_artifacts: {
      pilot_cohort: { path: D2D_PATHS.pilotCohort, sha256: sha256(inputs.cohortBytes) },
      catalog: { path: D2D_PATHS.catalog, sha256: sha256(inputs.catalogBytes) },
      evidence_sources: { path: D2D_PATHS.evidenceSources, sha256: sha256(evidenceSourceBytes) },
    },
    profile_groups: inputs.cohort.profile_groups,
    rows,
  })
}

function firstBinding(
  evidence: ProductProfileEvidenceArtifact['rows'][number],
  support?: 'identity' | 'configuration' | 'function' | 'specification' | 'regulatory',
) {
  return (
    evidence.source_bindings.find((binding) => !support || binding.supports.includes(support)) ??
    evidence.source_bindings[0]
  )
}

function claim(
  text: string,
  binding: ProductProfileEvidenceArtifact['rows'][number]['source_bindings'][number],
): ProfileClaim {
  return {
    text,
    evidence_scope: binding.evidence_scope,
    source_refs: [{ source_id: binding.source_id, locator: binding.locator }],
  }
}

function specificationsFromEvidence(
  evidence: ProductProfileEvidenceArtifact['rows'][number],
): ProfileSpecification[] {
  const source = firstBinding(evidence, 'specification')
  const preferredKeys = [
    'size_display',
    'diameter_mm',
    'length_mm',
    'working_length_cm',
    'working_channel_mm',
    'min_working_channel_mm',
    'gauge',
    'probe_od_mm',
    'probe_length_mm',
    'tip_geometry',
    'configuration',
  ]
  const labels: Record<string, string> = {
    size_display: 'Catalog matrix size',
    diameter_mm: 'Diameter',
    length_mm: 'Length',
    working_length_cm: 'Working length',
    working_channel_mm: 'Working channel',
    min_working_channel_mm: 'Minimum working channel',
    gauge: 'Gauge',
    probe_od_mm: 'Probe outer diameter',
    probe_length_mm: 'Probe length',
    tip_geometry: 'Tip geometry',
    configuration: 'Configuration',
  }
  const units: Record<string, string | null> = {
    diameter_mm: 'mm',
    length_mm: 'mm',
    working_length_cm: 'cm',
    working_channel_mm: 'mm',
    min_working_channel_mm: 'mm',
    probe_od_mm: 'mm',
    probe_length_mm: 'mm',
  }
  return preferredKeys
    .filter(
      (key) =>
        evidence.configuration_values[key] !== null &&
        evidence.configuration_values[key] !== undefined,
    )
    .map((key) => ({
      key,
      label: labels[key],
      value: evidence.configuration_values[key] as string | number | boolean,
      unit: units[key] ?? null,
      evidence_scope: source.evidence_scope,
      source_refs: [{ source_id: source.source_id, locator: source.locator }],
    }))
}

const PROMOTIONAL_WORDING =
  /\b(?:best|superior|revolutionary|cutting[- ]edge|state[- ]of[- ]the[- ]art|optimal|unmatched)\b/i

function assertNeutralDraft(texts: string[], productId: string): void {
  const offender = texts.find((text) => PROMOTIONAL_WORDING.test(text))
  if (offender) throw new Error(`Draft ${productId} contains promotional wording: ${offender}`)
}

function buildDraftContent(
  evidence: ProductProfileEvidenceArtifact['rows'][number],
  aiDraft: boolean,
): Omit<ProfileDraftArtifact['drafts'][number], 'generation' | 'draft_id' | 'review_state'> {
  const identitySource = firstBinding(evidence, 'identity')
  const configurationSource = firstBinding(evidence, 'configuration')
  const specificationSource = firstBinding(evidence, 'specification')
  const description = evidence.canonical_identity.catalog_description
  const summaryClaims = description ? [claim(description, identitySource)] : []
  let exactConfigurationSummary = evidence.canonical_identity.catalog_number
    ? claim(
        `The governed source identifies this configuration as catalog ${evidence.canonical_identity.catalog_number}.`,
        configurationSource,
      )
    : null
  let specifications = specificationsFromEvidence(evidence)

  if (evidence.product_id === 'PRD-2632FFBF07' && aiDraft) {
    summaryClaims.splice(
      0,
      summaryClaims.length,
      claim('The Broncoflex XFlo 5.6/3.0 is a single-use video bronchoscope.', specificationSource),
    )
    const udiSource = evidence.source_bindings.find((binding) =>
      binding.supports.includes('regulatory'),
    )!
    exactConfigurationSummary = {
      text: 'Catalog 10040001 identifies the XFlo configuration with a 3.0 mm working channel and primary DI 03664977000103.',
      evidence_scope: 'exact',
      source_refs: [
        { source_id: specificationSource.source_id, locator: specificationSource.locator },
        { source_id: udiSource.source_id, locator: udiSource.locator },
      ],
    }
    specifications = [
      {
        key: 'working_channel_mm',
        label: 'Working channel',
        value: 3,
        unit: 'mm',
        evidence_scope: 'exact',
        source_refs: [
          { source_id: specificationSource.source_id, locator: specificationSource.locator },
        ],
      },
    ]
  }

  if (evidence.product_id === 'PRD-F4AE2A74E6' && aiDraft) {
    summaryClaims.splice(
      0,
      summaryClaims.length,
      claim(
        'This product is a GSS TD straight tracheal silicone stent configuration.',
        configurationSource,
      ),
    )
    exactConfigurationSummary = claim(
      'Catalog 01TD1120 identifies the 11 OD by 20 L entry in the manufacturer ordering matrix.',
      configurationSource,
    )
    specifications = [
      {
        key: 'size_display',
        label: 'Catalog matrix size',
        value: '11 OD x 20 L',
        unit: null,
        evidence_scope: 'configuration',
        source_refs: [
          { source_id: configurationSource.source_id, locator: configurationSource.locator },
        ],
      },
    ]
  }

  const content = {
    product_id: evidence.product_id,
    proposed_description_scope: evidence.proposed_description_scope,
    summary_claims: summaryClaims,
    physical_device_type: evidence.canonical_identity.product_kind
      ? claim(`${evidence.canonical_identity.product_kind}.`, identitySource)
      : null,
    intended_function: null,
    exact_configuration_summary: exactConfigurationSummary,
    key_specifications: specifications,
    confidence: aiDraft ? ('moderate' as const) : ('low' as const),
  }
  assertNeutralDraft(
    [
      ...content.summary_claims.map((entry) => entry.text),
      content.physical_device_type?.text ?? '',
      content.exact_configuration_summary?.text ?? '',
    ],
    evidence.product_id,
  )
  return content
}

function buildProfileDrafts(
  inputs: GeneratorInputs,
  evidenceSources: EvidenceSourceArtifact,
  profileEvidence: ProductProfileEvidenceArtifact,
): ProfileDraftArtifact {
  const pilotById = new Map(inputs.cohort.products.map((product) => [product.product_id, product]))
  const sourceHashById = new Map(
    evidenceSources.sources.map((source) => [source.source_id, source.content_sha256]),
  )
  const profileEvidenceBytes = Buffer.from(canonicalJson(profileEvidence))
  const evidenceSourceBytes = Buffer.from(canonicalJson(evidenceSources))
  const drafts = profileEvidence.rows.map((evidence) => {
    const aiDraft = pilotById.get(evidence.product_id)?.ai_draft ?? false
    const content = buildDraftContent(evidence, aiDraft)
    const orderedSources = [
      ...new Set(evidence.source_bindings.map((binding) => binding.source_id)),
    ]
      .sort()
      .map((sourceId) => ({ source_id: sourceId, sha256: sourceHashById.get(sourceId)! }))
    const draftHash = sha256(JSON.stringify(content))
    return {
      draft_id: `D2D-PROFILE-DRAFT-${evidence.product_id.replace('PRD-', '')}`,
      ...content,
      generation: {
        model_or_generation_method: aiDraft
          ? 'codex_assisted_d2d_pilot'
          : 'deterministic_catalog_projection_v1',
        prompt_version: aiDraft ? 'd2d-profile-draft-prompt-v1' : null,
        generated_at: aiDraft ? `${inputs.cohort.snapshot_date}T00:00:00.000Z` : null,
        snapshot_date: inputs.cohort.snapshot_date,
        ordered_sources: orderedSources,
        draft_sha256: draftHash,
      },
      review_state: 'pending_owner_review' as const,
    }
  })
  return profileDraftArtifactSchema.parse({
    format_version: 1,
    artifact_kind: 'd2d_product_profile_drafts',
    method_version: 'd2d-profile-draft-v1',
    source_artifacts: {
      profile_evidence: { path: D2D_PATHS.profileEvidence, sha256: sha256(profileEvidenceBytes) },
      evidence_sources: { path: D2D_PATHS.evidenceSources, sha256: sha256(evidenceSourceBytes) },
    },
    drafts,
  })
}

function buildEvidenceProposals(
  inputs: GeneratorInputs,
  profileEvidence: ProductProfileEvidenceArtifact,
  profileDrafts: ProfileDraftArtifact,
): EvidenceProposalArtifact {
  const evidenceById = new Map(profileEvidence.rows.map((row) => [row.product_id, row]))
  const draftById = new Map(profileDrafts.drafts.map((draft) => [draft.product_id, draft]))
  const rows = inputs.cohort.products.map((pilotProduct) => {
    const evidence = evidenceById.get(pilotProduct.product_id)!
    const productResults = inputs.acquisition.results.filter(
      (result) => result.product_id === pilotProduct.product_id,
    )
    const match = proposeRegulatoryMatch({
      identity: evidence.canonical_identity,
      results: productResults,
      aliases: inputs.cohort.manufacturer_aliases,
    })
    const acquisitionReferences = productResults.flatMap((result) =>
      result.pages.map((page) => acquisitionSourceReference(result, page)),
    )
    const regulatoryEvidenceCandidates = productResults.flatMap((result) => {
      const sourceRefs = result.pages.map((page) => acquisitionSourceReference(result, page))
      return result.candidates.map((candidate) => ({
        ...candidate,
        query_id: result.query_id,
        dataset: result.dataset,
        source_refs: sourceRefs,
      }))
    })
    return {
      product_id: pilotProduct.product_id,
      profile_draft_id: draftById.get(pilotProduct.product_id)!.draft_id,
      regulatory_proposal_id: `D2D-REG-PROPOSAL-${pilotProduct.product_id.replace('PRD-', '')}`,
      regulatory_match: {
        match_level: match.match_level,
        confidence: match.confidence,
        conflict_state: match.conflict_state,
        reason_codes: match.reason_codes.slice().sort(),
        query_ids: productResults.map((result) => result.query_id).sort(),
        candidate_count: match.candidate_count,
      },
      regulatory_evidence_candidates: regulatoryEvidenceCandidates,
      source_refs: [
        ...evidence.source_bindings.map((binding) => ({
          source_id: binding.source_id,
          locator: binding.locator,
        })),
        ...acquisitionReferences,
      ].sort(
        (left, right) =>
          left.source_id.localeCompare(right.source_id) ||
          left.locator.localeCompare(right.locator),
      ),
      proposal_state: 'pending_owner_review' as const,
    }
  })
  return evidenceProposalArtifactSchema.parse({
    format_version: 1,
    artifact_kind: 'd2d_evidence_proposals',
    method_version: 'd2d-evidence-proposal-v1',
    source_artifacts: {
      pilot_cohort: { path: D2D_PATHS.pilotCohort, sha256: sha256(inputs.cohortBytes) },
      profile_evidence: {
        path: D2D_PATHS.profileEvidence,
        sha256: sha256(Buffer.from(canonicalJson(profileEvidence))),
      },
      acquisition_manifest: {
        path: D2D_PATHS.acquisitionManifest,
        sha256: sha256(inputs.acquisitionBytes),
      },
    },
    rows,
  })
}

export function buildD2DProposals(inputs: GeneratorInputs): GeneratedD2DProposals {
  if (inputs.acquisition.snapshot_date !== inputs.cohort.snapshot_date) {
    throw new Error('Acquisition and cohort snapshot dates differ.')
  }
  const evidenceSources = buildEvidenceSources(inputs)
  const profileEvidence = buildProfileEvidence(inputs, evidenceSources)
  const profileDrafts = buildProfileDrafts(inputs, evidenceSources, profileEvidence)
  const evidenceProposals = buildEvidenceProposals(inputs, profileEvidence, profileDrafts)
  return { evidenceSources, profileEvidence, profileDrafts, evidenceProposals }
}

export function loadD2DProposalInputs(repoRoot = D2D_REPO_ROOT): GeneratorInputs {
  const cohortInput = readJsonWithBytes<unknown>(d2dAbsolutePath(D2D_PATHS.pilotCohort, repoRoot))
  const catalogInput = readJsonWithBytes<CatalogProduct[]>(
    d2dAbsolutePath(D2D_PATHS.catalog, repoRoot),
  )
  const sourceInput = readJsonWithBytes<GovernedSource[]>(
    d2dAbsolutePath(D2D_PATHS.governedSources, repoRoot),
  )
  const manifestInput = readJsonWithBytes<SourceCompletenessManifest>(
    d2dAbsolutePath(D2D_PATHS.sourceCompletenessManifest, repoRoot),
  )
  const acquisitionInput = readJsonWithBytes<unknown>(
    d2dAbsolutePath(D2D_PATHS.acquisitionManifest, repoRoot),
  )
  return {
    cohort: pilotCohortArtifactSchema.parse(cohortInput.value),
    cohortBytes: cohortInput.bytes,
    catalog: catalogInput.value,
    catalogBytes: catalogInput.bytes,
    governedSources: sourceInput.value,
    governedSourcesBytes: sourceInput.bytes,
    sourceManifest: manifestInput.value,
    sourceManifestBytes: manifestInput.bytes,
    acquisition: acquisitionManifestSchema.parse(acquisitionInput.value),
    acquisitionBytes: acquisitionInput.bytes,
  }
}

export function generateD2DProposalFiles(repoRoot = D2D_REPO_ROOT): Record<string, string> {
  const generated = buildD2DProposals(loadD2DProposalInputs(repoRoot))
  return {
    [D2D_PATHS.evidenceSources]: canonicalJson(generated.evidenceSources),
    [D2D_PATHS.profileEvidence]: canonicalJson(generated.profileEvidence),
    [D2D_PATHS.profileDrafts]: canonicalJson(generated.profileDrafts),
    [D2D_PATHS.evidenceProposals]: canonicalJson(generated.evidenceProposals),
  }
}

function main(argv: string[]): void {
  const check = argv.includes('--check')
  const files = generateD2DProposalFiles()
  for (const [relativePath, contents] of Object.entries(files)) {
    writeOrCheckFile({
      absolutePath: d2dAbsolutePath(relativePath),
      relativePath,
      contents,
      check,
    })
  }
  process.stdout.write(
    `${check ? 'Checked' : 'Wrote'} ${Object.keys(files).length} D2D proposal/evidence artifacts.\n`,
  )
}

if (require.main === module) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`)
    process.exitCode = 1
  }
}
