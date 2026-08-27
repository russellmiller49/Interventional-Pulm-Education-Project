import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  profileOverlayArtifactSchema,
  profileOverlayRowSchema,
} from '@/features/device-intelligence/domain/profile-overlay-schema'
import {
  regulatoryOverlayArtifactSchema,
  regulatoryOverlayRowSchema,
  regulatoryPathwaySchema,
} from '@/features/device-intelligence/domain/regulatory-overlay-schema'
import { deriveRegulatoryConclusionCodes } from '@/features/device-intelligence/domain/product-regulatory'

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
const readJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(REPO_ROOT, relativePath), 'utf8'))

const sourceRef = { source_id: 'D2D-SRC-TEST', locator: 'record field test' }
const validInsufficientProfile = {
  product_id: 'PRD-003C4641E6',
  content_locale: 'en' as const,
  runtime_state: 'insufficient_evidence' as const,
  description_scope: 'insufficient_evidence' as const,
  summary_claims: [],
  physical_device_type: null,
  intended_function: null,
  exact_configuration_summary: null,
  key_specifications: [],
  confidence: 'unresolved' as const,
  as_of_date: '2026-08-24',
  review_id: 'D2D-PROFILE-REVIEW-003C4641E6',
}

describe('D2D-A closed artifact contracts', () => {
  it('parses every committed source, proposal, review, and compact artifact', () => {
    const cases: Array<[string, { parse: (value: unknown) => unknown }]> = [
      ['data/ip-device-intelligence/reviewed/d2d-pilot-cohort.json', pilotCohortArtifactSchema],
      [
        'data/ip-device-intelligence/research/d2d/2026-08-24/acquisition-manifest.json',
        acquisitionManifestSchema,
      ],
      [
        'data/ip-device-intelligence/reviewed/d2d-evidence-sources.json',
        evidenceSourceArtifactSchema,
      ],
      [
        'data/ip-device-intelligence/reviewed/product-profile-evidence.json',
        productProfileEvidenceArtifactSchema,
      ],
      [
        'data/ip-device-intelligence/research/d2d/2026-08-24/product-profile-drafts.json',
        profileDraftArtifactSchema,
      ],
      [
        'data/ip-device-intelligence/research/d2d/2026-08-24/evidence-proposals.json',
        evidenceProposalArtifactSchema,
      ],
      [
        'data/ip-device-intelligence/reviewed/product-description-reviews.json',
        descriptionReviewArtifactSchema,
      ],
      [
        'data/ip-device-intelligence/reviewed/product-regulatory-matches.json',
        regulatoryReviewArtifactSchema,
      ],
      [
        'data/ip-device-intelligence/generated/product-profile-overlay.json',
        profileOverlayArtifactSchema,
      ],
      [
        'data/ip-device-intelligence/generated/product-regulatory-overlay.json',
        regulatoryOverlayArtifactSchema,
      ],
    ]
    for (const [path, schema] of cases) {
      expect(() => schema.parse(readJson(path))).not.toThrow()
    }
  })

  it('rejects unknown fields and non-final rows carrying runtime content', () => {
    const cohort = readJson('data/ip-device-intelligence/reviewed/d2d-pilot-cohort.json') as Record<
      string,
      unknown
    >
    expect(pilotCohortArtifactSchema.safeParse({ ...cohort, fda_status: 'approved' }).success).toBe(
      false,
    )

    const reviews = readJson(
      'data/ip-device-intelligence/reviewed/product-description-reviews.json',
    ) as { rows: Array<Record<string, unknown>> }
    const invalidReview = {
      ...reviews,
      rows: [
        {
          ...reviews.rows[0],
          decision: 'pending_owner_review',
          reviewer_id: null,
          reviewer_role: null,
          reviewed_at: null,
          rationale: null,
          final_profile: validInsufficientProfile,
        },
        ...reviews.rows.slice(1),
      ],
    }
    expect(descriptionReviewArtifactSchema.safeParse(invalidReview).success).toBe(false)

    const missingAuthority = {
      ...reviews,
      rows: [
        {
          ...reviews.rows[0],
          decision: 'insufficient_evidence',
          reviewer_id: null,
          reviewer_role: null,
          reviewed_at: null,
          rationale: null,
          final_profile: validInsufficientProfile,
        },
        ...reviews.rows.slice(1),
      ],
    }
    expect(descriptionReviewArtifactSchema.safeParse(missingAuthority).success).toBe(false)
  })

  it('prevents exact-product prose from citing family-only evidence', () => {
    const exactWithFamilyClaim = {
      ...validInsufficientProfile,
      runtime_state: 'reviewed',
      description_scope: 'exact_product',
      confidence: 'moderate',
      summary_claims: [
        { text: 'A family-derived sentence.', evidence_scope: 'family', source_refs: [sourceRef] },
      ],
    }
    expect(profileOverlayRowSchema.safeParse(exactWithFamilyClaim).success).toBe(false)

    const disclosedFamilyInheritance = {
      ...exactWithFamilyClaim,
      description_scope: 'family_inherited',
    }
    expect(profileOverlayRowSchema.safeParse(disclosedFamilyInheritance).success).toBe(true)

    const insufficientWithClaim = {
      ...validInsufficientProfile,
      summary_claims: [
        { text: 'This must not render.', evidence_scope: 'exact', source_refs: [sourceRef] },
      ],
    }
    expect(profileOverlayRowSchema.safeParse(insufficientWithClaim).success).toBe(false)
  })
})

describe('D2D-A regulatory axes and controlled conclusions', () => {
  it('does not turn GUDID, listing, family, or product-code evidence into authorization', () => {
    expect(
      deriveRegulatoryConclusionCodes({
        researchState: 'reviewed',
        matchLevel: 'exact_udi_catalog_match',
        pathways: [],
        exactListingFound: false,
      }),
    ).toEqual([])
    expect(
      deriveRegulatoryConclusionCodes({
        researchState: 'reviewed',
        matchLevel: 'exact_udi_catalog_match',
        pathways: [],
        exactListingFound: true,
      }),
    ).toEqual(['fda_listed_device'])
    expect(
      deriveRegulatoryConclusionCodes({
        researchState: 'reviewed',
        matchLevel: 'family_level_match',
        pathways: [
          {
            pathway: '510k',
            submission_number: 'K261068',
            decision: 'substantially_equivalent',
            decision_date: '2026-06-30',
            evidence_scope: 'family',
          },
        ],
        exactListingFound: true,
      }),
    ).toEqual([])
    expect(
      deriveRegulatoryConclusionCodes({
        researchState: 'reviewed',
        matchLevel: 'product_code_only',
        pathways: [],
        exactListingFound: true,
      }),
    ).toEqual([])
  })

  it('emits pathway codes only for exact reviewed pathway/result pairs', () => {
    expect(
      deriveRegulatoryConclusionCodes({
        researchState: 'reviewed',
        matchLevel: 'exact_premarket_submission_match',
        pathways: [
          {
            pathway: '510k',
            submission_number: 'K261068',
            decision: 'substantially_equivalent',
            decision_date: '2026-06-30',
            evidence_scope: 'exact',
          },
          {
            pathway: 'pma',
            submission_number: 'P123456',
            decision: 'denied',
            decision_date: null,
            evidence_scope: 'exact',
          },
        ],
        exactListingFound: false,
      }),
    ).toEqual(['cleared_510k'])
    expect(
      regulatoryPathwaySchema.safeParse({
        pathway: '510k',
        submission_number: 'K261068',
        decision: 'approved',
        decision_date: '2026-06-30',
        evidence_scope: 'exact',
        source_refs: [sourceRef],
      }).success,
    ).toBe(false)
  })

  it('fails closed when a row supplies a stronger conclusion than its independent axes', () => {
    const unresolved = {
      product_id: 'PRD-AED3720BF6',
      research_state: 'unresolved' as const,
      research_as_of_date: '2026-08-24',
      match_level: 'ambiguous' as const,
      confidence: 'unresolved' as const,
      canonical_manufacturer: 'Serpex Medical',
      evidence_legal_manufacturer: null,
      canonical_catalog_number: 'MCB-1000-4',
      evidence_model_catalog_number: null,
      conflict_state: 'insufficient_identifiers' as const,
      udi_identities: [],
      classifications: [],
      pathways: [],
      registration_listing_evidence: [],
      commercial_distribution_evidence: [],
      conclusion_codes: ['exact_identity_unresolved'] as const,
      review_id: 'D2D-REG-REVIEW-AED3720BF6',
    }
    expect(regulatoryOverlayRowSchema.safeParse(unresolved).success).toBe(true)
    expect(
      regulatoryOverlayRowSchema.safeParse({
        ...unresolved,
        research_state: 'reviewed',
        match_level: 'exact_udi_catalog_match',
        conflict_state: 'none',
        conclusion_codes: ['cleared_510k'],
      }).success,
    ).toBe(false)
    expect(
      regulatoryOverlayRowSchema.safeParse({
        ...unresolved,
        conflict_state: 'manufacturer_mismatch',
        match_level: 'exact_model_manufacturer_match',
      }).success,
    ).toBe(false)
  })
})
