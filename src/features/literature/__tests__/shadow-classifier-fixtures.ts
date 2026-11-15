import {
  SHADOW_AUTONOMY_POLICY_VERSION,
  SHADOW_MODEL_RESPONSE_SCHEMA_VERSION,
  SHADOW_DEVELOPMENT_SCOPE_SCHEMA_VERSION,
  SYNTHETIC_DEVELOPMENT_MEMBERSHIP_SHA256,
  authorizeDevelopmentShadowScope,
  buildShadowModelPacket,
  createShadowComponentAttemptEnvelope,
  loadConfiguredShadowComponentRegistry,
  resolveShadowAutonomyPolicy,
  type RawShadowComponentResult,
  type RawShadowModelResponse,
} from '../shadow-classifier'

export const SHADOW_TEST_TIME = '2026-08-11T12:00:00.000Z'
export const SHADOW_TEST_COMPLETED_TIME = '2026-08-11T12:00:01.000Z'

export function syntheticDevelopmentMembership() {
  return {
    projectionVersion: 'literature-gold-development-membership-v1' as const,
    datasetSplit: 'development' as const,
    items: Array.from({ length: 630 }, (_, index) => ({
      itemId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      pmid: String(10_000_000 + index),
    })),
  }
}

export function syntheticDevelopmentScope() {
  return authorizeDevelopmentShadowScope({
    schemaVersion: SHADOW_DEVELOPMENT_SCOPE_SCHEMA_VERSION,
    purpose: 'development_only_shadow_r_and_d',
    datasetSplit: 'development',
    queue: 'development',
    membershipSelection: 'exact_checksum_bound_projection',
    complementDerived: false,
    heldOutIdentityInputCount: 0,
    testQueueInspected: false,
    allQueueInspected: false,
    authority: {
      authorityId: 'shadow-core-synthetic-test-membership-v1',
      membershipSha256: SYNTHETIC_DEVELOPMENT_MEMBERSHIP_SHA256,
    },
    membership: syntheticDevelopmentMembership(),
  })
}

export function shadowTestArticle() {
  return {
    pmid: '10000000',
    doi: '10.1000/development-shadow-fixture',
    title: 'Bronchoscopic navigation for a peripheral pulmonary lesion',
    abstract: 'We evaluated bronchoscopic navigation and biopsy yield in a prospective cohort.',
    meshTerms: ['Bronchoscopy'],
    authorKeywords: ['navigation bronchoscopy'],
    publicationTypes: ['Journal Article'],
    journalTitle: 'Development Fixture Journal',
    journalAbbreviation: 'Dev Fix J',
    publicationYear: 2026,
    languages: ['English'],
    authors: [{ fullName: 'Development Fixture', abbreviatedName: 'Fixture D' }],
    fullText: {
      availability: 'not_requested' as const,
      source: null,
      text: null,
      sha256: null,
    },
  }
}

export function shadowPacket(componentId = 'ip_relevance') {
  const registry = loadConfiguredShadowComponentRegistry()
  const envelope = buildShadowModelPacket({
    scope: syntheticDevelopmentScope(),
    registry,
    componentId,
    assignmentId: `assignment:${componentId}:fixture`,
    createdAt: SHADOW_TEST_TIME,
    executionModel: {
      adapterId: 'development_model_adapter',
      adapterVersion: '1.0.0',
      modelId: 'fixture_frontier_model',
      reasoningLevel: 'high',
    },
    article: shadowTestArticle(),
  })
  return { registry, envelope }
}

export function rawShadowPrediction(
  overrides: Partial<RawShadowModelResponse> = {},
): RawShadowComponentResult {
  const { envelope } = shadowPacket()
  return createShadowComponentAttemptEnvelope({
    packetEnvelope: envelope,
    startedAt: SHADOW_TEST_TIME,
    completedAt: SHADOW_TEST_COMPLETED_TIME,
    modelResponse: {
      schemaVersion: SHADOW_MODEL_RESPONSE_SCHEMA_VERSION,
      state: 'prediction',
      outputValues: ['include_core'],
      evidenceUsed: [
        {
          field: 'title',
          text: 'Bronchoscopic navigation',
        },
      ],
      rationale: 'The title directly describes an interventional bronchoscopic procedure.',
      selfReportedConfidence: 0.84,
      probabilities: null,
      abstentionReasons: [],
      refusalCode: null,
      ...overrides,
    },
  })
}

export function shadowLevelOnePolicy() {
  return resolveShadowAutonomyPolicy({
    schemaVersion: SHADOW_AUTONOMY_POLICY_VERSION,
    requestedLevel: 1,
    developmentOnly: true,
    productionEnabled: false,
    automaticEffects: {
      publish: false,
      hide: false,
      exclude: false,
      changeRelevance: false,
      changeVisibility: false,
      changeGoldLabel: false,
      moveCurrentReviewPointer: false,
      revealSupplementalMetadata: false,
      revealAutomatedSignals: false,
      unlockTestData: false,
      writeDatabase: false,
    },
  })
}
