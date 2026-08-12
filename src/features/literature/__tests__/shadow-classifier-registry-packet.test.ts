import {
  buildShadowModelPacket,
  getShadowClassifierComponent,
  loadConfiguredShadowComponentRegistry,
  loadShadowComponentRegistry,
  replaceShadowClassifierComponent,
  shadowModelInputForAdapter,
} from '../shadow-classifier'

import {
  SHADOW_TEST_TIME,
  shadowPacket,
  shadowTestArticle,
  syntheticDevelopmentScope,
} from './shadow-classifier-fixtures'

function keysRecursively(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysRecursively)
  if (!value || typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [
    key,
    ...keysRecursively(child),
  ])
}

describe('shadow classifier registry and model packet', () => {
  it('loads four independently versioned, capability-free components', () => {
    const registry = loadConfiguredShadowComponentRegistry()
    expect(registry.componentIds).toEqual([
      'ip_relevance',
      'metadata_sufficiency',
      'full_text_need',
      'study_design',
    ])
    for (const componentId of registry.componentIds) {
      expect(getShadowClassifierComponent(registry, componentId)).toMatchObject({
        databaseWriteCapability: false,
        workflowDecisionAuthority: false,
        invalidOutputPolicy: 'reject_without_prediction_and_route_to_human',
        confidenceSemantics: {
          calibrated: false,
          operationalThresholdSelected: false,
        },
      })
    }
    expect(registry.registrySha256).toMatch(/^[a-f0-9]{64}$/u)
    expect(Object.isFrozen(registry)).toBe(true)
    expect(Object.isFrozen(registry.components.ip_relevance)).toBe(true)
  })

  it('replaces one component without changing sibling component identities', () => {
    const registry = loadConfiguredShadowComponentRegistry()
    const current = getShadowClassifierComponent(registry, 'metadata_sufficiency')
    const replacement = {
      ...current,
      componentVersion: '1.1.0',
      prompt: {
        promptId: current.prompt.promptId,
        promptVersion: '1.1.0',
        instruction: `${current.prompt.instruction} Treat missing abstracts explicitly.`,
      },
    }
    const replaced = replaceShadowClassifierComponent(registry, replacement)

    expect(replaced.components.metadata_sufficiency.componentVersion).toBe('1.1.0')
    expect(replaced.components.ip_relevance).toEqual(registry.components.ip_relevance)
    expect(replaced.components.full_text_need).toEqual(registry.components.full_text_need)
    expect(replaced.registrySha256).not.toBe(registry.registrySha256)
  })

  it('rejects unknown components and duplicate component IDs', () => {
    const registry = loadConfiguredShadowComponentRegistry()
    expect(() => getShadowClassifierComponent(registry, 'not_registered')).toThrow(/Unknown/u)
    const duplicate = {
      schemaVersion: registry.schemaVersion,
      registryId: registry.registryId,
      registryVersion: registry.registryVersion,
      developmentOnly: true,
      maximumAutonomyLevel: 1,
      components: [registry.components.ip_relevance, registry.components.ip_relevance].map(
        ({ prompt, ...component }) => {
          const rawPrompt = { ...prompt } as Partial<typeof prompt>
          delete rawPrompt.promptSha256
          return { ...component, prompt: rawPrompt }
        },
      ),
    }
    expect(() => loadShadowComponentRegistry(duplicate)).toThrow(/duplicate component IDs/u)
  })

  it('builds a strict allowlisted packet with no split, gold, physician, or coordinator fields', () => {
    const { envelope, registry } = shadowPacket()
    const modelInput = shadowModelInputForAdapter(envelope, registry)
    const packetKeys = keysRecursively(modelInput).map((key) =>
      key.replace(/[^a-z0-9]/giu, '').toLowerCase(),
    )
    for (const forbidden of [
      'scope',
      'developmentonly',
      'decisionuse',
      'assignmentid',
      'registry',
      'componentid',
      'modelid',
      'promptid',
      'datasetsplit',
      'queue',
      'membership',
      'membershipsha256',
      'physicianlabel',
      'goldlabel',
      'currentreview',
      'reviewhistory',
      'coordinatorrules',
      'metadatasufficiency',
      'studydesign',
      'topicids',
      'technologytags',
    ]) {
      expect(packetKeys).not.toContain(forbidden)
    }
    expect(envelope.packet).toMatchObject({
      developmentOnly: true,
      evidenceOnly: true,
      decisionUse: 'shadow_only',
      productionEffectsAuthorized: false,
      componentProvenance: {
        model: {
          modelId: 'fixture_frontier_model',
          reasoningLevel: 'high',
        },
      },
    })
    expect(modelInput).toEqual({
      schemaVersion: 'literature-shadow-model-input/1.0.0',
      instruction: expect.any(String),
      outputContract: expect.objectContaining({
        outputVocabulary: ['include_core', 'include_adjacent', 'exclude', 'uncertain'],
      }),
      article: shadowTestArticle(),
    })
  })

  it.each([
    ['physician label', { physicianLabel: 'include_core' }],
    ['gold target', { goldTarget: { relevanceLabel: 'include_core' } }],
    ['coordinator rules', { nested: { coordinatorRules: ['never exclude this record'] } }],
    ['study design target', { studyDesign: 'randomized_controlled_trial' }],
    ['topic targets', { topicIds: ['peripheral-navigation'] }],
  ])('rejects recursively nested %s before packet construction', (_name, leak) => {
    const registry = loadConfiguredShadowComponentRegistry()
    expect(() =>
      buildShadowModelPacket({
        scope: syntheticDevelopmentScope(),
        registry,
        componentId: 'ip_relevance',
        assignmentId: 'assignment:leak:test',
        createdAt: SHADOW_TEST_TIME,
        executionModel: {
          adapterId: 'development_model_adapter',
          adapterVersion: '1.0.0',
          modelId: 'fixture_frontier_model',
          reasoningLevel: 'high',
        },
        article: { ...shadowTestArticle(), ...leak },
      }),
    ).toThrow(/Forbidden target or coordinator-only field/u)
  })

  it('requires exact development membership and a concrete execution model identity', () => {
    const registry = loadConfiguredShadowComponentRegistry()
    expect(() =>
      buildShadowModelPacket({
        scope: syntheticDevelopmentScope(),
        registry,
        componentId: 'ip_relevance',
        assignmentId: 'assignment:not-member',
        createdAt: SHADOW_TEST_TIME,
        executionModel: {
          adapterId: 'development_model_adapter',
          adapterVersion: '1.0.0',
          modelId: 'fixture_frontier_model',
          reasoningLevel: 'high',
        },
        article: { ...shadowTestArticle(), pmid: '99999999' },
      }),
    ).toThrow(/not an exact member/u)
    expect(() =>
      buildShadowModelPacket({
        scope: syntheticDevelopmentScope(),
        registry,
        componentId: 'ip_relevance',
        assignmentId: 'assignment:placeholder',
        createdAt: SHADOW_TEST_TIME,
        executionModel: {
          adapterId: 'development_model_adapter',
          adapterVersion: '1.0.0',
          modelId: 'operator_selected_frontier_model',
          reasoningLevel: 'high',
        },
        article: shadowTestArticle(),
      }),
    ).toThrow(/concrete execution model/u)
  })
})
