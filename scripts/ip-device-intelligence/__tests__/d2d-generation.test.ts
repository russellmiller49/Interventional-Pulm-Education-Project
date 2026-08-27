import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { profileOverlayArtifactSchema } from '@/features/device-intelligence/domain/profile-overlay-schema'
import { regulatoryOverlayArtifactSchema } from '@/features/device-intelligence/domain/regulatory-overlay-schema'

import { generateD2DOverlayFiles } from '../d2d/build-overlays'
import { generateD2DProposalFiles } from '../d2d/build-proposals'
import { generateReviewFiles } from '../d2d/build-review-artifacts'
import { D2D_PATHS } from '../d2d/paths'
import {
  acquisitionManifestSchema,
  descriptionReviewArtifactSchema,
  evidenceProposalArtifactSchema,
  evidenceSourceArtifactSchema,
  pilotCohortArtifactSchema,
  productProfileEvidenceArtifactSchema,
  profileDraftArtifactSchema,
  regulatoryReviewArtifactSchema,
} from '../d2d/schemas'

const REPO_ROOT = join(__dirname, '../../..')
const read = (relativePath: string): string => readFileSync(join(REPO_ROOT, relativePath), 'utf8')
const json = (relativePath: string): unknown => JSON.parse(read(relativePath))
const sha256 = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex')

describe('D2D-A deterministic generation', () => {
  it('regenerates proposal, review, and overlay files byte identically', () => {
    for (const generated of [
      generateD2DProposalFiles(REPO_ROOT),
      generateReviewFiles(REPO_ROOT),
      generateD2DOverlayFiles(REPO_ROOT),
    ]) {
      for (const [relativePath, contents] of Object.entries(generated)) {
        expect({ relativePath, matches: read(relativePath) === contents }).toEqual({
          relativePath,
          matches: true,
        })
      }
    }
    expect(generateD2DProposalFiles(REPO_ROOT)).toEqual(generateD2DProposalFiles(REPO_ROOT))
    expect(generateReviewFiles(REPO_ROOT)).toEqual(generateReviewFiles(REPO_ROOT))
    expect(generateD2DOverlayFiles(REPO_ROOT)).toEqual(generateD2DOverlayFiles(REPO_ROOT))
  })

  it('pins every path-backed generator input by its committed SHA-256', () => {
    const acquisition = acquisitionManifestSchema.parse(json(D2D_PATHS.acquisitionManifest))
    const evidenceSources = evidenceSourceArtifactSchema.parse(json(D2D_PATHS.evidenceSources))
    const profileEvidence = productProfileEvidenceArtifactSchema.parse(
      json(D2D_PATHS.profileEvidence),
    )
    const drafts = profileDraftArtifactSchema.parse(json(D2D_PATHS.profileDrafts))
    const proposals = evidenceProposalArtifactSchema.parse(json(D2D_PATHS.evidenceProposals))
    const descriptions = descriptionReviewArtifactSchema.parse(json(D2D_PATHS.descriptionReviews))
    const regulatoryReviews = regulatoryReviewArtifactSchema.parse(
      json(D2D_PATHS.regulatoryReviews),
    )
    const reviewSourceManifest = json(`${D2D_PATHS.reviewDirectory}/source-manifest.json`) as {
      source_artifact: { path: string; sha256: string }
    }
    const profile = profileOverlayArtifactSchema.parse(json(D2D_PATHS.profileOverlay))
    const regulatory = regulatoryOverlayArtifactSchema.parse(json(D2D_PATHS.regulatoryOverlay))
    for (const pinned of [
      acquisition.pilot_cohort,
      ...Object.values(evidenceSources.source_artifacts),
      ...Object.values(profileEvidence.source_artifacts),
      ...Object.values(drafts.source_artifacts),
      ...Object.values(proposals.source_artifacts),
      descriptions.source_proposals,
      regulatoryReviews.source_proposals,
      reviewSourceManifest.source_artifact,
      ...Object.values(profile.source_artifacts),
      ...Object.values(regulatory.source_artifacts),
    ]) {
      expect(pinned.sha256).toBe(sha256(readFileSync(join(REPO_ROOT, pinned.path))))
    }

    const sourceHashById = new Map(
      evidenceSources.sources.map((source) => [source.source_id, source.content_sha256]),
    )
    for (const row of profileEvidence.rows) {
      expect(row.canonical_identity_sha256).toBe(sha256(JSON.stringify(row.canonical_identity)))
    }
    for (const draft of drafts.drafts) {
      for (const source of draft.generation.ordered_sources) {
        expect(source.sha256).toBe(sourceHashById.get(source.source_id))
      }
      const content = {
        product_id: draft.product_id,
        proposed_description_scope: draft.proposed_description_scope,
        summary_claims: draft.summary_claims,
        physical_device_type: draft.physical_device_type,
        intended_function: draft.intended_function,
        exact_configuration_summary: draft.exact_configuration_summary,
        key_specifications: draft.key_specifications,
        confidence: draft.confidence,
      }
      expect(draft.generation.draft_sha256).toBe(sha256(JSON.stringify(content)))
    }
  })

  it('publishes only the 20 physician-owner dispositions into both compact overlays', () => {
    const descriptions = descriptionReviewArtifactSchema.parse(json(D2D_PATHS.descriptionReviews))
    const regulatoryReviews = regulatoryReviewArtifactSchema.parse(
      json(D2D_PATHS.regulatoryReviews),
    )
    const profile = profileOverlayArtifactSchema.parse(json(D2D_PATHS.profileOverlay))
    const regulatory = regulatoryOverlayArtifactSchema.parse(json(D2D_PATHS.regulatoryOverlay))

    expect(descriptions.rows).toHaveLength(10)
    expect(regulatoryReviews.rows).toHaveLength(10)
    expect(new Set(descriptions.rows.map((row) => row.decision))).toEqual(new Set(['approved']))
    expect(
      regulatoryReviews.rows.reduce<Record<string, number>>((counts, row) => {
        counts[row.decision] = (counts[row.decision] ?? 0) + 1
        return counts
      }, {}),
    ).toEqual({ approved: 7, unresolved: 3 })
    expect(
      new Set(
        [...descriptions.rows, ...regulatoryReviews.rows].map(
          (row) => `${row.reviewer_id}|${row.reviewer_role}|${row.reviewed_at}`,
        ),
      ),
    ).toEqual(new Set(['russell-miller|physician_owner|2026-08-24T00:00:00.000Z']))
    expect(profile).toMatchObject({
      counts: { pilot_products: 10, rows: 10, reviewed: 10, insufficient_evidence: 0 },
    })
    expect(regulatory).toMatchObject({
      counts: { pilot_products: 10, rows: 10, reviewed: 7, unresolved: 3 },
    })
    expect(profile.rows).toEqual(
      descriptions.rows
        .map((row) => row.final_profile)
        .sort((left, right) => left!.product_id.localeCompare(right!.product_id)),
    )
    expect(regulatory.rows).toEqual(
      regulatoryReviews.rows
        .map((row) => row.final_regulatory_record)
        .sort((left, right) => left!.product_id.localeCompare(right!.product_id)),
    )

    expect(
      regulatory.rows
        .filter((row) => row.research_state === 'unresolved')
        .map((row) => row.product_id),
    ).toEqual(['PRD-3E1556EBE5', 'PRD-B76AF3D731', 'PRD-F4AE2A74E6'])
    expect(
      regulatory.rows
        .filter((row) => row.udi_identities.length > 0)
        .every((row) => row.conclusion_codes.length === 0),
    ).toBe(true)
    expect(regulatory.rows.find((row) => row.product_id === 'PRD-1ED27ADA45')).toMatchObject({
      match_level: 'strong_exact_identity_match',
      conclusion_codes: [],
    })
    expect(regulatory.rows.find((row) => row.product_id === 'PRD-AED3720BF6')).toMatchObject({
      match_level: 'family_level_match',
      pathways: [
        {
          pathway: '510k',
          submission_number: 'K261068',
          decision: 'substantially_equivalent',
          evidence_scope: 'family',
        },
      ],
      conclusion_codes: [],
    })

    const erbe = profile.rows.find((row) => row.product_id === 'PRD-05670F1B5F')!
    expect(erbe.key_specifications.map((item) => item.key)).toEqual([
      'outer_diameter_mm',
      'working_length_cm',
    ])
    expect(profile.rows.find((row) => row.product_id === 'PRD-003C4641E6')).not.toEqual(
      expect.objectContaining({
        summary_claims: expect.arrayContaining([
          expect.objectContaining({ text: expect.stringMatching(/separate suction/i) }),
        ]),
      }),
    )

    const serialized = `${read(D2D_PATHS.profileOverlay)}\n${read(D2D_PATHS.regulatoryOverlay)}`
    expect(serialized).not.toMatch(/local-data\//)
    expect(serialized).not.toMatch(/codex_assisted|pending_owner_review|draft_sha256/i)
    expect(serialized).not.toMatch(/evidence-proposals|product-profile-drafts/i)
  })

  it('exercises assisted drafting on exactly the two approved products with ordered provenance', () => {
    const drafts = profileDraftArtifactSchema.parse(json(D2D_PATHS.profileDrafts))
    const aiDrafts = drafts.drafts.filter(
      (draft) => draft.generation.model_or_generation_method === 'codex_assisted_d2d_pilot',
    )
    expect(aiDrafts.map((draft) => draft.product_id).sort()).toEqual([
      'PRD-2632FFBF07',
      'PRD-F4AE2A74E6',
    ])
    for (const draft of drafts.drafts) {
      const orderedIds = draft.generation.ordered_sources.map((source) => source.source_id)
      expect(orderedIds).toEqual([...orderedIds].sort())
      expect(new Set(orderedIds).size).toBe(orderedIds.length)
      const citedIds = new Set(
        [
          ...draft.summary_claims,
          draft.physical_device_type,
          draft.intended_function,
          draft.exact_configuration_summary,
          ...draft.key_specifications,
        ]
          .filter((claim): claim is NonNullable<typeof claim> => Boolean(claim))
          .flatMap((claim) => claim.source_refs.map((reference) => reference.source_id)),
      )
      for (const sourceId of citedIds) expect(orderedIds).toContain(sourceId)
      expect(draft.generation.draft_sha256).toMatch(/^[0-9a-f]{64}$/)
      if (aiDrafts.some((candidate) => candidate.product_id === draft.product_id)) {
        expect(draft.generation.prompt_version).toBe('d2d-profile-draft-prompt-v1')
      }
    }
  })

  it('projects every acquired official response as a citeable source for owner review', () => {
    const sources = evidenceSourceArtifactSchema.parse(json(D2D_PATHS.evidenceSources))
    const proposals = evidenceProposalArtifactSchema.parse(json(D2D_PATHS.evidenceProposals))
    const acquired = sources.sources.filter(
      (source) => source.review_state === 'acquired_official_source',
    )
    expect(acquired).toHaveLength(12)
    expect(
      acquired.every((source) => source.official_url?.startsWith('https://api.fda.gov/')),
    ).toBe(true)
    const knownSourceIds = new Set(sources.sources.map((source) => source.source_id))
    for (const proposal of proposals.rows) {
      expect(
        proposal.source_refs.some((reference) => reference.source_id.startsWith('D2D-SRC-FDA-')),
      ).toBe(true)
      expect(proposal.regulatory_evidence_candidates).toHaveLength(
        proposal.regulatory_match.candidate_count,
      )
      for (const reference of proposal.source_refs) {
        expect(knownSourceIds).toContain(reference.source_id)
      }
      for (const candidate of proposal.regulatory_evidence_candidates) {
        expect(candidate.source_refs.length).toBeGreaterThan(0)
        for (const reference of candidate.source_refs) {
          expect(knownSourceIds).toContain(reference.source_id)
        }
      }
    }
  })

  it('fails profile-group fan-out outside the explicit bidirectional allowlist', () => {
    const cohort = pilotCohortArtifactSchema.parse(json(D2D_PATHS.pilotCohort))
    const outsidePilot = JSON.parse(JSON.stringify(cohort)) as typeof cohort
    outsidePilot.profile_groups[0].member_product_ids.push('PRD-AAAAAAAAAA')
    expect(pilotCohortArtifactSchema.safeParse(outsidePilot).success).toBe(false)

    const missingBackReference = JSON.parse(JSON.stringify(cohort)) as typeof cohort
    const memberId = missingBackReference.profile_groups[0].member_product_ids[0]
    const member = missingBackReference.products.find((product) => product.product_id === memberId)!
    member.description_profile_group_id = null
    expect(pilotCohortArtifactSchema.safeParse(missingBackReference).success).toBe(false)
  })
})
