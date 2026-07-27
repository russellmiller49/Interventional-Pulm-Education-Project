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
