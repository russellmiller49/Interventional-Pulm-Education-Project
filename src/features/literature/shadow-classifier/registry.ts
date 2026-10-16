import { z } from 'zod'

import { immutableShadowValue, sha256ShadowText, sha256ShadowValue } from './canonical'

export const SHADOW_COMPONENT_REGISTRY_SCHEMA_VERSION =
  'literature-shadow-component-registry/1.0.0' as const
export const SHADOW_COMPONENT_INPUT_SCHEMA_VERSION =
  'literature-shadow-model-article/1.0.0' as const
export const SHADOW_COMPONENT_OUTPUT_SCHEMA_VERSION =
  'literature-shadow-component-result/1.0.0' as const

export const SHADOW_EVIDENCE_FIELDS = [
  'title',
  'abstract',
  'mesh_term',
  'author_keyword',
  'publication_type',
  'journal',
  'year',
  'language',
  'full_text',
] as const

export const SHADOW_ABSTENTION_REASONS = [
  'insufficient_abstract',
  'missing_full_text_when_required',
  'conflicting_evidence',
  'ambiguous_procedural_scope',
  'surgical_bronchoscopic_boundary',
  'unfamiliar_technology',
  'taxonomy_mismatch',
  'unsupported_output_vocabulary',
  'classifier_disagreement',
  'confidence_below_unselected_candidate_threshold',
  'metadata_insufficient',
] as const

const safeIdentifierSchema = z.string().regex(/^[a-z][a-z0-9_.-]{1,127}$/u)
const versionSchema = z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/u)

export const shadowComponentConfigSchema = z
  .object({
    componentId: safeIdentifierSchema,
    componentVersion: versionSchema,
    role: z.enum(['classifier', 'support', 'adjudicator']),
    purpose: z.string().trim().min(1).max(500),
    inputSchemaVersion: z.literal(SHADOW_COMPONENT_INPUT_SCHEMA_VERSION),
    outputSchemaVersion: z.literal(SHADOW_COMPONENT_OUTPUT_SCHEMA_VERSION),
    outputCardinality: z.enum(['single', 'multiple']),
    outputVocabulary: z
      .array(safeIdentifierSchema)
      .min(2)
      .max(100)
      .refine(
        (values) => new Set(values).size === values.length,
        'Output vocabulary must be unique.',
      ),
    allowedEvidenceFields: z
      .array(z.enum(SHADOW_EVIDENCE_FIELDS))
      .min(1)
      .refine(
        (values) => new Set(values).size === values.length,
        'Evidence fields must be unique.',
      ),
    prompt: z
      .object({
        promptId: safeIdentifierSchema,
        promptVersion: versionSchema,
        instruction: z.string().trim().min(1).max(50_000),
      })
      .strict(),
    model: z
      .object({
        adapterId: safeIdentifierSchema,
        adapterVersion: versionSchema,
        modelId: safeIdentifierSchema,
      })
      .strict(),
    confidenceSemantics: z
      .object({
        selfReportScale: z.literal('continuous_zero_to_one_uncalibrated'),
        calibrated: z.literal(false),
        operationalThresholdSelected: z.literal(false),
      })
      .strict(),
    abstentionReasons: z
      .array(z.enum(SHADOW_ABSTENTION_REASONS))
      .min(1)
      .refine(
        (values) => new Set(values).size === values.length,
        'Abstention reasons must be unique.',
      ),
    invalidOutputPolicy: z.literal('reject_without_prediction_and_route_to_human'),
    databaseWriteCapability: z.literal(false),
    workflowDecisionAuthority: z.literal(false),
  })
  .strict()

export const shadowComponentRegistryConfigSchema = z
  .object({
    schemaVersion: z.literal(SHADOW_COMPONENT_REGISTRY_SCHEMA_VERSION),
    registryId: safeIdentifierSchema,
    registryVersion: versionSchema,
    developmentOnly: z.literal(true),
    maximumAutonomyLevel: z.literal(1),
    components: z.array(shadowComponentConfigSchema).min(1).max(50),
  })
  .strict()

type ParsedComponentConfig = z.infer<typeof shadowComponentConfigSchema>

export interface ShadowClassifierComponent extends ParsedComponentConfig {
  prompt: ParsedComponentConfig['prompt'] & { promptSha256: string }
}

export interface ShadowComponentRegistry {
  schemaVersion: typeof SHADOW_COMPONENT_REGISTRY_SCHEMA_VERSION
  registryId: string
  registryVersion: string
  registrySha256: string
  developmentOnly: true
  maximumAutonomyLevel: 1
  componentIds: readonly string[]
  components: Readonly<Record<string, Readonly<ShadowClassifierComponent>>>
}

function registryFromParsed(
  parsed: z.infer<typeof shadowComponentRegistryConfigSchema>,
): Readonly<ShadowComponentRegistry> {
  const componentIds = parsed.components.map((component) => component.componentId)
  if (new Set(componentIds).size !== componentIds.length) {
    throw new Error('Shadow classifier registry contains duplicate component IDs.')
  }
  const promptIds = parsed.components.map(
    (component) => `${component.prompt.promptId}@${component.prompt.promptVersion}`,
  )
  if (new Set(promptIds).size !== promptIds.length) {
    throw new Error('Shadow classifier registry contains duplicate prompt identities.')
  }

  const components = Object.fromEntries(
    parsed.components.map((component) => [
      component.componentId,
      {
        ...component,
        prompt: {
          ...component.prompt,
          promptSha256: sha256ShadowText(component.prompt.instruction),
        },
      },
    ]),
  ) as Record<string, ShadowClassifierComponent>

  const registryIdentity = {
    ...parsed,
    components: componentIds.map((componentId) => components[componentId]),
  }

  return immutableShadowValue({
    schemaVersion: parsed.schemaVersion,
    registryId: parsed.registryId,
    registryVersion: parsed.registryVersion,
    registrySha256: sha256ShadowValue(registryIdentity),
    developmentOnly: true,
    maximumAutonomyLevel: 1,
    componentIds,
    components,
  })
}

export function loadShadowComponentRegistry(rawConfig: unknown): Readonly<ShadowComponentRegistry> {
  return registryFromParsed(shadowComponentRegistryConfigSchema.parse(rawConfig))
}

export function getShadowClassifierComponent(
  registry: ShadowComponentRegistry,
  componentId: string,
): Readonly<ShadowClassifierComponent> {
  const component = registry.components[componentId]
  if (!component) throw new Error(`Unknown shadow classifier component ID: ${componentId}`)
  return component
}

function rawRegistryConfig(registry: ShadowComponentRegistry) {
  return {
    schemaVersion: registry.schemaVersion,
    registryId: registry.registryId,
    registryVersion: registry.registryVersion,
    developmentOnly: registry.developmentOnly,
    maximumAutonomyLevel: registry.maximumAutonomyLevel,
    components: registry.componentIds.map((componentId) => {
      const component = registry.components[componentId]
      if (!component) throw new Error(`Registry component index is incomplete for ${componentId}.`)
      const { promptSha256, ...prompt } = component.prompt
      if (promptSha256 !== sha256ShadowText(prompt.instruction)) {
        throw new Error(`Registry prompt checksum mismatch for ${componentId}.`)
      }
      return { ...component, prompt }
    }),
  }
}

export function verifyShadowComponentRegistry(registry: ShadowComponentRegistry): void {
  const reconstructed = loadShadowComponentRegistry(rawRegistryConfig(registry))
  if (sha256ShadowValue(reconstructed) !== sha256ShadowValue(registry)) {
    throw new Error('Shadow component registry content or identity is not exact.')
  }
}

export function replaceShadowClassifierComponent(
  registry: ShadowComponentRegistry,
  rawReplacement: unknown,
): Readonly<ShadowComponentRegistry> {
  const replacement = shadowComponentConfigSchema.parse(rawReplacement)
  const previous = getShadowClassifierComponent(registry, replacement.componentId)
  if (replacement.componentVersion === previous.componentVersion) {
    throw new Error('A replacement component must advance its component version.')
  }

  const components = registry.componentIds.map((componentId) => {
    const component =
      componentId === replacement.componentId ? replacement : registry.components[componentId]
    const { prompt: promptWithHash, ...componentWithoutPrompt } = component
    const prompt = { ...promptWithHash } as typeof promptWithHash & {
      promptSha256?: string
    }
    delete prompt.promptSha256
    return { ...componentWithoutPrompt, prompt }
  })

  return registryFromParsed(
    shadowComponentRegistryConfigSchema.parse({
      schemaVersion: registry.schemaVersion,
      registryId: registry.registryId,
      registryVersion: replacement.componentVersion,
      developmentOnly: true,
      maximumAutonomyLevel: 1,
      components,
    }),
  )
}
