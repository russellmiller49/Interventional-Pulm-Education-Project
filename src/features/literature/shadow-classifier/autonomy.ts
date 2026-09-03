import { z } from 'zod'

import { immutableShadowValue } from './canonical'

export const SHADOW_AUTONOMY_POLICY_VERSION = 'literature-shadow-autonomy/1.0.0' as const
export const SHADOW_RUNTIME_MAX_AUTONOMY_LEVEL = 1 as const

export const SHADOW_AUTONOMY_LEVELS = [
  {
    level: 0,
    id: 'human_only',
    description: 'Models have no operational role; existing shadow evidence remains readable.',
  },
  {
    level: 1,
    id: 'shadow_autonomous',
    description: 'Models may produce evidence-only predictions that affect no workflow decision.',
  },
  {
    level: 2,
    id: 'autonomous_suggestions',
    description: 'Suggestions may be displayed, but may not be applied automatically.',
  },
  {
    level: 3,
    id: 'selective_high_confidence_automation',
    description: 'Separately approved low-risk tasks may apply with monitoring and rollback.',
  },
  {
    level: 4,
    id: 'broader_automation_with_abstention',
    description: 'Broader approved tasks may apply while exclusions and ambiguity remain gated.',
  },
  {
    level: 5,
    id: 'mature_autonomous_operation',
    description:
      'Requires held-out and prospective validation, calibration review, thresholds, and owner approval.',
  },
] as const

export const FORBIDDEN_SHADOW_PRODUCTION_EFFECTS = [
  'publish',
  'hide',
  'exclude',
  'change_relevance',
  'change_visibility',
  'change_gold_label',
  'move_current_review_pointer',
  'reveal_supplemental_metadata',
  'reveal_automated_signals',
  'unlock_test_data',
  'write_database',
] as const

export const shadowProductionEffectsSchema = z
  .object({
    publish: z.literal(false),
    hide: z.literal(false),
    exclude: z.literal(false),
    changeRelevance: z.literal(false),
    changeVisibility: z.literal(false),
    changeGoldLabel: z.literal(false),
    moveCurrentReviewPointer: z.literal(false),
    revealSupplementalMetadata: z.literal(false),
    revealAutomatedSignals: z.literal(false),
    unlockTestData: z.literal(false),
    writeDatabase: z.literal(false),
  })
  .strict()

export const NO_SHADOW_PRODUCTION_EFFECTS = Object.freeze({
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
} as const)

const runtimePolicyRequestSchema = z
  .object({
    schemaVersion: z.literal(SHADOW_AUTONOMY_POLICY_VERSION),
    requestedLevel: z.number().int().min(0).max(5),
    developmentOnly: z.literal(true),
    productionEnabled: z.literal(false),
    automaticEffects: shadowProductionEffectsSchema,
  })
  .strict()

const fullShadowAutonomyPolicySchema = z
  .object({
    schemaVersion: z.literal(SHADOW_AUTONOMY_POLICY_VERSION),
    configuredLevel: z.union([z.literal(0), z.literal(1)]),
    configuredLevelId: z.enum(['human_only', 'shadow_autonomous']),
    runtimeMaximumLevel: z.literal(SHADOW_RUNTIME_MAX_AUTONOMY_LEVEL),
    developmentOnly: z.literal(true),
    productionEnabled: z.literal(false),
    evidenceOnly: z.literal(true),
    automaticEffects: shadowProductionEffectsSchema,
  })
  .strict()

export interface ShadowAutonomyPolicy {
  schemaVersion: typeof SHADOW_AUTONOMY_POLICY_VERSION
  configuredLevel: 0 | 1
  configuredLevelId: 'human_only' | 'shadow_autonomous'
  runtimeMaximumLevel: typeof SHADOW_RUNTIME_MAX_AUTONOMY_LEVEL
  developmentOnly: true
  productionEnabled: false
  evidenceOnly: true
  automaticEffects: typeof NO_SHADOW_PRODUCTION_EFFECTS
}

export function resolveShadowAutonomyPolicy(rawRequest: unknown): Readonly<ShadowAutonomyPolicy> {
  const request = runtimePolicyRequestSchema.parse(rawRequest)
  if (request.requestedLevel > SHADOW_RUNTIME_MAX_AUTONOMY_LEVEL) {
    throw new Error(
      `Track B runtime is capped at autonomy level ${SHADOW_RUNTIME_MAX_AUTONOMY_LEVEL}; higher levels require a separately reviewed future implementation.`,
    )
  }

  const configuredLevel = request.requestedLevel as 0 | 1
  return immutableShadowValue({
    schemaVersion: SHADOW_AUTONOMY_POLICY_VERSION,
    configuredLevel,
    configuredLevelId: configuredLevel === 0 ? 'human_only' : 'shadow_autonomous',
    runtimeMaximumLevel: SHADOW_RUNTIME_MAX_AUTONOMY_LEVEL,
    developmentOnly: true,
    productionEnabled: false,
    evidenceOnly: true,
    automaticEffects: NO_SHADOW_PRODUCTION_EFFECTS,
  })
}

export function humanOnlyShadowPolicy(): Readonly<ShadowAutonomyPolicy> {
  return resolveShadowAutonomyPolicy({
    schemaVersion: SHADOW_AUTONOMY_POLICY_VERSION,
    requestedLevel: 0,
    developmentOnly: true,
    productionEnabled: false,
    automaticEffects: NO_SHADOW_PRODUCTION_EFFECTS,
  })
}

export function assertShadowPolicyHasNoProductionEffects(policy: ShadowAutonomyPolicy): void {
  const parsed = fullShadowAutonomyPolicySchema.safeParse(policy)
  if (
    !parsed.success ||
    parsed.data.configuredLevelId !==
      (parsed.data.configuredLevel === 0 ? 'human_only' : 'shadow_autonomous')
  ) {
    throw new Error('Shadow autonomy policy contains an unauthorized production effect or level.')
  }
}
