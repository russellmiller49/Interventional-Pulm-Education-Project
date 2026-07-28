import {
  literatureGoldCompleteReviewSchema,
  literatureGoldReviewPayloadSchema,
} from '@/features/literature/schemas/gold-set'

const base = {
  relevanceLabel: 'include_core',
  metadataSufficiency: 'adequate_abstract',
  reviewerConfidence: 'high',
  topicIds: ['ebus-mediastinal-staging'],
  technologyTags: ['convex-ebus'],
  clinicalPurposes: ['diagnosis'],
  diseaseTags: ['lung-cancer'],
  studyDesign: 'diagnostic-accuracy',
  publicationStatus: 'full-article',
  categorizationFromFullText: false,
  notes: '',
  usedSupplementalMetadata: false,
  reviewSeconds: 30,
}

describe('gold-set review labels', () => {
  it('allows an empty autosave draft', () => {
    expect(
      literatureGoldReviewPayloadSchema.parse({
        relevanceLabel: null,
        metadataSufficiency: null,
        reviewerConfidence: null,
      }),
    ).toMatchObject({
      relevanceLabel: null,
      topicIds: [],
      reviewSeconds: 0,
    })
  })

  it('requires all three independent judgments at completion', () => {
    expect(() =>
      literatureGoldCompleteReviewSchema.parse({
        ...base,
        metadataSufficiency: null,
      }),
    ).toThrow('Metadata sufficiency is required')
  })

  it('requires categorization for included articles', () => {
    expect(() =>
      literatureGoldCompleteReviewSchema.parse({
        ...base,
        topicIds: [],
      }),
    ).toThrow('At least one broad topic')
  })

  it('rejects categorization on excluded articles', () => {
    expect(() =>
      literatureGoldCompleteReviewSchema.parse({
        ...base,
        relevanceLabel: 'exclude',
      }),
    ).toThrow('only for included articles')
  })

  it('accepts a clean exclusion', () => {
    expect(
      literatureGoldCompleteReviewSchema.parse({
        ...base,
        relevanceLabel: 'exclude',
        topicIds: [],
        technologyTags: [],
        clinicalPurposes: [],
        diseaseTags: [],
        studyDesign: null,
        publicationStatus: null,
      }),
    ).toMatchObject({ relevanceLabel: 'exclude' })
  })

  it('accepts the metadata fallback and review-article categories', () => {
    expect(
      literatureGoldCompleteReviewSchema.parse({
        ...base,
        clinicalPurposes: ['multiple-general-overview', 'not-assessable-from-available-metadata'],
        studyDesign: 'review-article',
        publicationStatus: 'not-assessable-from-available-metadata',
      }),
    ).toMatchObject({
      clinicalPurposes: ['multiple-general-overview', 'not-assessable-from-available-metadata'],
      studyDesign: 'review-article',
      publicationStatus: 'not-assessable-from-available-metadata',
    })
  })

  it('accepts not assessable as a study design', () => {
    expect(
      literatureGoldCompleteReviewSchema.parse({
        ...base,
        studyDesign: 'not-assessable-from-available-metadata',
      }),
    ).toMatchObject({
      studyDesign: 'not-assessable-from-available-metadata',
    })
  })

  it('accepts an interactive clinical case publication status', () => {
    expect(
      literatureGoldCompleteReviewSchema.parse({
        ...base,
        publicationStatus: 'interactive-clinical-case',
      }),
    ).toMatchObject({
      publicationStatus: 'interactive-clinical-case',
    })
  })

  it('accepts immune/inflammatory disease as a disease tag', () => {
    expect(
      literatureGoldCompleteReviewSchema.parse({
        ...base,
        diseaseTags: ['immune-inflammatory-disease'],
      }),
    ).toMatchObject({
      diseaseTags: ['immune-inflammatory-disease'],
    })
  })

  it('accepts safety/complication prevention as a clinical purpose', () => {
    expect(
      literatureGoldCompleteReviewSchema.parse({
        ...base,
        clinicalPurposes: ['safety-complication-prevention'],
      }),
    ).toMatchObject({
      clinicalPurposes: ['safety-complication-prevention'],
    })
  })

  it('accepts a full-text categorization flag for included articles', () => {
    expect(
      literatureGoldCompleteReviewSchema.parse({
        ...base,
        categorizationFromFullText: true,
      }),
    ).toMatchObject({
      categorizationFromFullText: true,
    })
  })

  it('accepts the basic bronchoscopy and pleural procedure topics', () => {
    expect(
      literatureGoldCompleteReviewSchema.parse({
        ...base,
        topicIds: ['basic-bronchoscopy', 'pleural-interventions'],
      }),
    ).toMatchObject({
      topicIds: ['basic-bronchoscopy', 'pleural-interventions'],
    })
  })

  it('rejects a full-text categorization flag on excluded articles', () => {
    expect(() =>
      literatureGoldCompleteReviewSchema.parse({
        ...base,
        relevanceLabel: 'exclude',
        topicIds: [],
        technologyTags: [],
        clinicalPurposes: [],
        diseaseTags: [],
        studyDesign: null,
        publicationStatus: null,
        categorizationFromFullText: true,
      }),
    ).toThrow('only for included articles')
  })

  it('rejects uncontrolled or child topic labels', () => {
    expect(() =>
      literatureGoldCompleteReviewSchema.parse({
        ...base,
        topicIds: ['not-a-topic'],
      }),
    ).toThrow('Unknown controlled label')
    expect(() =>
      literatureGoldCompleteReviewSchema.parse({
        ...base,
        topicIds: ['ebus-mediastinal-staging.convex-ebus-tbna'],
      }),
    ).toThrow('Unknown controlled label')
  })
})
