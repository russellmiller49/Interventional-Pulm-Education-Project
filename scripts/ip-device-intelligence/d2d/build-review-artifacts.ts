import { existsSync, readFileSync } from 'node:fs'

import { canonicalJson, csv, readJsonWithBytes, sha256, writeOrCheckFile } from './io'
import { D2D_PATHS, D2D_REPO_ROOT, d2dAbsolutePath } from './paths'
import {
  descriptionReviewArtifactSchema,
  evidenceProposalArtifactSchema,
  evidenceSourceArtifactSchema,
  productProfileEvidenceArtifactSchema,
  profileDraftArtifactSchema,
  regulatoryReviewArtifactSchema,
  type DescriptionReviewArtifact,
  type RegulatoryReviewArtifact,
} from './schemas'

interface ReviewInputs {
  evidenceSources: ReturnType<typeof evidenceSourceArtifactSchema.parse>
  evidenceSourcesBytes: Buffer
  profileEvidence: ReturnType<typeof productProfileEvidenceArtifactSchema.parse>
  profileDrafts: ReturnType<typeof profileDraftArtifactSchema.parse>
  profileDraftsBytes: Buffer
  proposals: ReturnType<typeof evidenceProposalArtifactSchema.parse>
  proposalsBytes: Buffer
}

function loadInputs(repoRoot = D2D_REPO_ROOT): ReviewInputs {
  const evidenceSources = readJsonWithBytes<unknown>(
    d2dAbsolutePath(D2D_PATHS.evidenceSources, repoRoot),
  )
  const profileEvidence = readJsonWithBytes<unknown>(
    d2dAbsolutePath(D2D_PATHS.profileEvidence, repoRoot),
  )
  const profileDrafts = readJsonWithBytes<unknown>(
    d2dAbsolutePath(D2D_PATHS.profileDrafts, repoRoot),
  )
  const proposals = readJsonWithBytes<unknown>(
    d2dAbsolutePath(D2D_PATHS.evidenceProposals, repoRoot),
  )
  return {
    evidenceSources: evidenceSourceArtifactSchema.parse(evidenceSources.value),
    evidenceSourcesBytes: evidenceSources.bytes,
    profileEvidence: productProfileEvidenceArtifactSchema.parse(profileEvidence.value),
    profileDrafts: profileDraftArtifactSchema.parse(profileDrafts.value),
    profileDraftsBytes: profileDrafts.bytes,
    proposals: evidenceProposalArtifactSchema.parse(proposals.value),
    proposalsBytes: proposals.bytes,
  }
}

export function pendingDescriptionReviews(inputs: ReviewInputs): DescriptionReviewArtifact {
  return descriptionReviewArtifactSchema.parse({
    format_version: 1,
    artifact_kind: 'd2d_product_description_reviews',
    method_version: 'd2d-description-review-v1',
    source_proposals: { path: D2D_PATHS.profileDrafts, sha256: sha256(inputs.profileDraftsBytes) },
    review_policy: 'one_accountable_physician_owner',
    correction_pass_limit: 1,
    rows: inputs.profileDrafts.drafts.map((draft) => ({
      review_id: `D2D-PROFILE-REVIEW-${draft.product_id.replace('PRD-', '')}`,
      product_id: draft.product_id,
      draft_id: draft.draft_id,
      decision: 'pending_owner_review',
      reviewer_id: null,
      reviewer_role: null,
      reviewed_at: null,
      rationale: null,
      supersedes_review_id: null,
      final_profile: null,
    })),
  })
}

export function pendingRegulatoryReviews(inputs: ReviewInputs): RegulatoryReviewArtifact {
  return regulatoryReviewArtifactSchema.parse({
    format_version: 1,
    artifact_kind: 'd2d_product_regulatory_matches',
    method_version: 'd2d-regulatory-review-v1',
    source_proposals: { path: D2D_PATHS.evidenceProposals, sha256: sha256(inputs.proposalsBytes) },
    review_policy: 'one_accountable_physician_owner',
    correction_pass_limit: 1,
    rows: inputs.proposals.rows.map((proposal) => ({
      review_id: `D2D-REG-REVIEW-${proposal.product_id.replace('PRD-', '')}`,
      product_id: proposal.product_id,
      proposal_id: proposal.regulatory_proposal_id,
      decision: 'pending_owner_review',
      reviewer_id: null,
      reviewer_role: null,
      reviewed_at: null,
      rationale: null,
      supersedes_review_id: null,
      final_regulatory_record: null,
    })),
  })
}

function loadReviews(
  repoRoot: string,
  inputs: ReviewInputs,
): {
  descriptions: DescriptionReviewArtifact
  regulatory: RegulatoryReviewArtifact
} {
  const descriptionPath = d2dAbsolutePath(D2D_PATHS.descriptionReviews, repoRoot)
  const regulatoryPath = d2dAbsolutePath(D2D_PATHS.regulatoryReviews, repoRoot)
  if (!existsSync(descriptionPath) || !existsSync(regulatoryPath)) {
    throw new Error(
      'D2D review inputs are missing. Run npm run ip-intel:d2d-review -- --initialize.',
    )
  }
  const descriptions = descriptionReviewArtifactSchema.parse(
    JSON.parse(readFileSync(descriptionPath, 'utf8')),
  )
  const regulatory = regulatoryReviewArtifactSchema.parse(
    JSON.parse(readFileSync(regulatoryPath, 'utf8')),
  )
  if (descriptions.source_proposals.sha256 !== sha256(inputs.profileDraftsBytes)) {
    throw new Error('Description reviews are pinned to a stale profile-draft artifact.')
  }
  if (regulatory.source_proposals.sha256 !== sha256(inputs.proposalsBytes)) {
    throw new Error('Regulatory reviews are pinned to a stale evidence-proposal artifact.')
  }
  return { descriptions, regulatory }
}

function reviewCsvFiles(
  inputs: ReviewInputs,
  reviews: { descriptions: DescriptionReviewArtifact; regulatory: RegulatoryReviewArtifact },
): Record<string, string> {
  const evidenceById = new Map(inputs.profileEvidence.rows.map((row) => [row.product_id, row]))
  const descriptionReviewById = new Map(
    reviews.descriptions.rows.map((row) => [row.product_id, row]),
  )
  const regulatoryReviewById = new Map(reviews.regulatory.rows.map((row) => [row.product_id, row]))

  const pilotHeader = [
    'product_id',
    'manufacturer',
    'product_name',
    'catalog_number',
    'description_scope_proposal',
    'profile_group_id',
    'source_ids',
    'acquisition_query_ids',
  ]
  const pilotRows = inputs.proposals.rows.map((proposal) => {
    const evidence = evidenceById.get(proposal.product_id)!
    return [
      proposal.product_id,
      evidence.canonical_identity.manufacturer,
      evidence.canonical_identity.product_name,
      evidence.canonical_identity.catalog_number,
      evidence.proposed_description_scope,
      evidence.description_profile_group_id,
      proposal.source_refs.map((source) => source.source_id).join('|'),
      proposal.regulatory_match.query_ids.join('|'),
    ]
  })

  const descriptionHeader = [
    'product_id',
    'manufacturer',
    'product_name',
    'catalog_number',
    'draft_method',
    'draft_scope',
    'draft_summary',
    'draft_configuration',
    'draft_source_ids',
    'decision',
    'reviewer_id',
    'reviewed_at',
    'rationale',
  ]
  const descriptionRows = inputs.profileDrafts.drafts.map((draft) => {
    const evidence = evidenceById.get(draft.product_id)!
    const review = descriptionReviewById.get(draft.product_id)!
    return [
      draft.product_id,
      evidence.canonical_identity.manufacturer,
      evidence.canonical_identity.product_name,
      evidence.canonical_identity.catalog_number,
      draft.generation.model_or_generation_method,
      draft.proposed_description_scope,
      draft.summary_claims.map((claim) => claim.text).join(' '),
      draft.exact_configuration_summary?.text,
      [
        ...new Set(
          [
            ...draft.summary_claims.flatMap((claim) => claim.source_refs),
            ...(draft.exact_configuration_summary?.source_refs ?? []),
            ...draft.key_specifications.flatMap((specification) => specification.source_refs),
          ].map((reference) => reference.source_id),
        ),
      ]
        .sort()
        .join('|'),
      review.decision,
      review.reviewer_id,
      review.reviewed_at,
      review.rationale,
    ]
  })

  const regulatoryHeader = [
    'product_id',
    'manufacturer',
    'product_name',
    'catalog_number',
    'proposed_match_level',
    'proposed_confidence',
    'conflict_state',
    'candidate_count',
    'reason_codes',
    'query_ids',
    'candidate_primary_dis',
    'candidate_package_dis',
    'candidate_companies',
    'candidate_catalog_models',
    'candidate_submissions',
    'candidate_product_codes',
    'candidate_distribution_fields',
    'candidate_records_json',
    'regulatory_source_ids',
    'decision',
    'reviewer_id',
    'reviewed_at',
    'rationale',
  ]
  const regulatoryRows = inputs.proposals.rows.map((proposal) => {
    const evidence = evidenceById.get(proposal.product_id)!
    const review = regulatoryReviewById.get(proposal.product_id)!
    const candidates = proposal.regulatory_evidence_candidates
    const values = (items: Array<string | null | undefined>) =>
      [...new Set(items.filter((value): value is string => Boolean(value)))].sort().join('|')
    return [
      proposal.product_id,
      evidence.canonical_identity.manufacturer,
      evidence.canonical_identity.product_name,
      evidence.canonical_identity.catalog_number,
      proposal.regulatory_match.match_level,
      proposal.regulatory_match.confidence,
      proposal.regulatory_match.conflict_state,
      proposal.regulatory_match.candidate_count,
      proposal.regulatory_match.reason_codes.join('|'),
      proposal.regulatory_match.query_ids.join('|'),
      values(candidates.map((candidate) => candidate.primary_di)),
      values(candidates.flatMap((candidate) => candidate.package_dis)),
      values(candidates.map((candidate) => candidate.company_name)),
      values(candidates.flatMap((candidate) => [candidate.catalog_number, candidate.model_number])),
      values(candidates.flatMap((candidate) => [candidate.k_number, candidate.pma_number])),
      values(candidates.map((candidate) => candidate.product_code)),
      values(candidates.map((candidate) => candidate.commercial_distribution_status)),
      JSON.stringify(candidates),
      values(proposal.source_refs.map((reference) => reference.source_id)),
      review.decision,
      review.reviewer_id,
      review.reviewed_at,
      review.rationale,
    ]
  })

  const subset = (levels: string[]) => [
    regulatoryHeader,
    ...regulatoryRows.filter((_, index) =>
      levels.includes(inputs.proposals.rows[index].regulatory_match.match_level),
    ),
  ]

  const sourceReviewManifest = {
    format_version: 1,
    artifact_kind: 'd2d_owner_review_source_manifest',
    source_artifact: {
      path: D2D_PATHS.evidenceSources,
      sha256: sha256(inputs.evidenceSourcesBytes),
    },
    sources: inputs.evidenceSources.sources,
    product_source_refs: inputs.proposals.rows.map((row) => ({
      product_id: row.product_id,
      source_refs: row.source_refs,
    })),
  }

  const reviewDirectory = D2D_PATHS.reviewDirectory
  return {
    [`${reviewDirectory}/pilot-products.csv`]: csv([pilotHeader, ...pilotRows]),
    [`${reviewDirectory}/description-review.csv`]: csv([descriptionHeader, ...descriptionRows]),
    [`${reviewDirectory}/regulatory-review.csv`]: csv([regulatoryHeader, ...regulatoryRows]),
    [`${reviewDirectory}/exact-regulatory-matches.csv`]: csv(
      subset([
        'exact_udi_catalog_match',
        'exact_model_manufacturer_match',
        'exact_premarket_submission_match',
        'strong_exact_identity_match',
      ]),
    ),
    [`${reviewDirectory}/family-level-matches.csv`]: csv(
      subset(['family_level_match', 'product_code_only']),
    ),
    [`${reviewDirectory}/ambiguous-matches.csv`]: csv(subset(['ambiguous'])),
    [`${reviewDirectory}/no-match-products.csv`]: csv(
      subset(['no_exact_record_found', 'not_searched']),
    ),
    [`${reviewDirectory}/source-manifest.json`]: canonicalJson(sourceReviewManifest),
  }
}

function initializeReviews(repoRoot: string, inputs: ReviewInputs): void {
  const descriptionPath = d2dAbsolutePath(D2D_PATHS.descriptionReviews, repoRoot)
  const regulatoryPath = d2dAbsolutePath(D2D_PATHS.regulatoryReviews, repoRoot)
  const descriptions = pendingDescriptionReviews(inputs)
  const regulatory = pendingRegulatoryReviews(inputs)
  const mayRefreshDescriptions =
    !existsSync(descriptionPath) ||
    descriptionReviewArtifactSchema
      .parse(JSON.parse(readFileSync(descriptionPath, 'utf8')))
      .rows.every((row) => row.decision === 'pending_owner_review')
  const mayRefreshRegulatory =
    !existsSync(regulatoryPath) ||
    regulatoryReviewArtifactSchema
      .parse(JSON.parse(readFileSync(regulatoryPath, 'utf8')))
      .rows.every((row) => row.decision === 'pending_owner_review')
  if (mayRefreshDescriptions) {
    writeOrCheckFile({
      absolutePath: descriptionPath,
      relativePath: D2D_PATHS.descriptionReviews,
      contents: canonicalJson(descriptions),
      check: false,
    })
  }
  if (mayRefreshRegulatory) {
    writeOrCheckFile({
      absolutePath: regulatoryPath,
      relativePath: D2D_PATHS.regulatoryReviews,
      contents: canonicalJson(regulatory),
      check: false,
    })
  }
}

export function generateReviewFiles(repoRoot = D2D_REPO_ROOT): Record<string, string> {
  const inputs = loadInputs(repoRoot)
  const reviews = loadReviews(repoRoot, inputs)
  return reviewCsvFiles(inputs, reviews)
}

function main(argv: string[]): void {
  const check = argv.includes('--check')
  const initialize = argv.includes('--initialize')
  if (check && initialize) throw new Error('--check and --initialize are mutually exclusive.')
  const inputs = loadInputs()
  if (initialize) initializeReviews(D2D_REPO_ROOT, inputs)
  const reviews = loadReviews(D2D_REPO_ROOT, inputs)
  const files = reviewCsvFiles(inputs, reviews)
  for (const [relativePath, contents] of Object.entries(files)) {
    writeOrCheckFile({
      absolutePath: d2dAbsolutePath(relativePath),
      relativePath,
      contents,
      check,
    })
  }
  process.stdout.write(
    `${check ? 'Checked' : 'Wrote'} ${Object.keys(files).length} D2D owner-review artifacts.\n`,
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
