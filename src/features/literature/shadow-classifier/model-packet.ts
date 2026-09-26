import { z } from 'zod'

import { immutableShadowValue, sha256ShadowText, sha256ShadowValue } from './canonical'
import {
  assertDevelopmentArticleAuthorized,
  type AuthorizedDevelopmentShadowScope,
} from './held-out-guard'
import {
  SHADOW_ABSTENTION_REASONS,
  SHADOW_COMPONENT_INPUT_SCHEMA_VERSION,
  SHADOW_COMPONENT_OUTPUT_SCHEMA_VERSION,
  SHADOW_EVIDENCE_FIELDS,
  getShadowClassifierComponent,
  verifyShadowComponentRegistry,
  type ShadowComponentRegistry,
} from './registry'

export const SHADOW_MODEL_PACKET_SCHEMA_VERSION = 'literature-shadow-model-packet/1.0.0' as const
export const SHADOW_MODEL_INPUT_SCHEMA_VERSION = 'literature-shadow-model-input/1.0.0' as const

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u)
const safeIdentifierSchema = z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,159}$/u)
const boundedStringArray = z
  .array(z.string().trim().min(1).max(50_000))
  .max(1_000)
  .refine((values) => new Set(values).size === values.length, 'Array values must be unique.')

const fullTextSchema = z
  .object({
    availability: z.enum(['not_requested', 'unavailable', 'available']),
    source: z.enum(['pmc', 'publisher_authorized', 'local_permitted']).nullable(),
    text: z.string().min(1).max(20_000_000).nullable(),
    sha256: sha256Schema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.availability === 'available') {
      if (value.source === null || value.text === null || value.sha256 === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Available full text requires source, text, and sha256.',
        })
      } else if (sha256ShadowText(value.text) !== value.sha256) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Full-text sha256 does not match supplied text.',
          path: ['sha256'],
        })
      }
    } else if (value.source !== null || value.text !== null || value.sha256 !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Unavailable or unrequested full text cannot claim a source, text, or checksum.',
      })
    }
  })

export const shadowModelArticleSchema = z
  .object({
    pmid: z.string().regex(/^[0-9]{1,12}$/u),
    doi: z.string().trim().min(1).max(500).nullable(),
    title: z.string().trim().min(1).max(100_000),
    abstract: z.string().max(2_000_000).nullable(),
    meshTerms: boundedStringArray,
    authorKeywords: boundedStringArray,
    publicationTypes: boundedStringArray,
    journalTitle: z.string().trim().min(1).max(50_000).nullable(),
    journalAbbreviation: z.string().trim().min(1).max(10_000).nullable(),
    publicationYear: z.number().int().min(1800).max(3000).nullable(),
    languages: boundedStringArray,
    authors: z
      .array(
        z
          .object({
            fullName: z.string().trim().min(1).max(10_000),
            abbreviatedName: z.string().trim().min(1).max(10_000).nullable(),
          })
          .strict(),
      )
      .max(5_000),
    fullText: fullTextSchema,
  })
  .strict()

export const shadowModelInputSchema = z
  .object({
    schemaVersion: z.literal(SHADOW_MODEL_INPUT_SCHEMA_VERSION),
    instruction: z.string().trim().min(1).max(50_000),
    outputContract: z
      .object({
        schemaVersion: z.literal(SHADOW_COMPONENT_OUTPUT_SCHEMA_VERSION),
        outputCardinality: z.enum(['single', 'multiple']),
        outputVocabulary: z.array(safeIdentifierSchema).min(2).max(100),
        allowedEvidenceFields: z.array(z.enum(SHADOW_EVIDENCE_FIELDS)).min(1),
        abstentionReasons: z.array(z.enum(SHADOW_ABSTENTION_REASONS)).min(1),
        confidenceSemantics: z
          .object({
            selfReportScale: z.literal('continuous_zero_to_one_uncalibrated'),
            calibrated: z.literal(false),
            operationalThresholdSelected: z.literal(false),
          })
          .strict(),
        invalidOutputPolicy: z.literal('reject_without_prediction_and_route_to_human'),
      })
      .strict(),
    article: shadowModelArticleSchema,
  })
  .strict()

export const shadowModelPacketSchema = z
  .object({
    schemaVersion: z.literal(SHADOW_MODEL_PACKET_SCHEMA_VERSION),
    developmentOnly: z.literal(true),
    evidenceOnly: z.literal(true),
    decisionUse: z.literal('shadow_only'),
    assignmentId: safeIdentifierSchema,
    createdAt: z.string().datetime({ offset: true }),
    registry: z
      .object({
        registryId: safeIdentifierSchema,
        registryVersion: z.string().min(1).max(100),
        registrySha256: sha256Schema,
      })
      .strict(),
    componentProvenance: z
      .object({
        componentId: safeIdentifierSchema,
        componentVersion: z.string().min(1).max(100),
        role: z.enum(['classifier', 'support', 'adjudicator']),
        purpose: z.string().trim().min(1).max(500),
        inputSchemaVersion: z.literal(SHADOW_COMPONENT_INPUT_SCHEMA_VERSION),
        outputSchemaVersion: z.literal(SHADOW_COMPONENT_OUTPUT_SCHEMA_VERSION),
        prompt: z
          .object({
            promptId: safeIdentifierSchema,
            promptVersion: z.string().min(1).max(100),
            promptSha256: sha256Schema,
          })
          .strict(),
        model: z
          .object({
            adapterId: safeIdentifierSchema,
            adapterVersion: z.string().min(1).max(100),
            modelId: safeIdentifierSchema,
            reasoningLevel: z.string().trim().min(1).max(100),
          })
          .strict(),
        invalidOutputPolicy: z.literal('reject_without_prediction_and_route_to_human'),
      })
      .strict(),
    modelInput: shadowModelInputSchema,
    modelInputSha256: sha256Schema,
    articleInputSha256: sha256Schema,
    productionEffectsAuthorized: z.literal(false),
  })
  .strict()

export type ShadowModelArticle = z.infer<typeof shadowModelArticleSchema>
export type ShadowModelInput = z.infer<typeof shadowModelInputSchema>
export type ShadowModelPacket = z.infer<typeof shadowModelPacketSchema>

export interface ShadowModelPacketEnvelope {
  packet: ShadowModelPacket
  packetSha256: string
}

const FORBIDDEN_MODEL_INPUT_KEYS = new Set([
  'automatedsignals',
  'automatedsignalsrevealed',
  'batchid',
  'batchname',
  'chainheadreviewid',
  'coordinatorlogic',
  'coordinatorrules',
  'currentsreview',
  'currentreview',
  'currentreviewid',
  'datasetsplit',
  'decisionconfidence',
  'displayorder',
  'draft',
  'effectivegoldlabel',
  'effectivephysiciandecision',
  'enrichmentstatus',
  'databaseimportready',
  'diseasetags',
  'clinicalpurposes',
  'firstpass',
  'firstpassresult',
  'metadatasufficiency',
  'publicationstatus',
  'provisionallabel',
  'protectedproceduralcue',
  'secondpass',
  'secondpassresult',
  'studydesign',
  'technologytags',
  'topicids',
  'triage',
  'triagebucket',
  'goldanswer',
  'goldlabel',
  'goldtarget',
  'heldout',
  'heldoutmembership',
  'inclusiondecision',
  'isblinded',
  'notes',
  'physicianconfidence',
  'physicianlabel',
  'physicianreview',
  'queue',
  'relevancelabel',
  'relevancestate',
  'reviewerconfidence',
  'revieweremail',
  'reviewhistory',
  'reviewseconds',
  'reviewstatus',
  'samplestratum',
  'samplingmetadata',
  'samplingreason',
  'targetlabel',
  'testmembership',
  'testunlockedat',
  'visibilitystate',
])

function normalizedKey(value: string): string {
  return value.replace(/[^a-z0-9]/giu, '').toLowerCase()
}

function assertNoForbiddenModelInputFields(value: unknown, path = 'article'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenModelInputFields(item, `${path}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizedKey(key)
    if (
      FORBIDDEN_MODEL_INPUT_KEYS.has(normalized) ||
      normalized.startsWith('physician') ||
      normalized.startsWith('gold') ||
      normalized.startsWith('coordinator') ||
      normalized.startsWith('heldout')
    ) {
      throw new Error(
        `Forbidden target or coordinator-only field entered model input at ${path}.${key}.`,
      )
    }
    assertNoForbiddenModelInputFields(child, `${path}.${key}`)
  }
}

export function buildShadowModelPacket(input: {
  scope: AuthorizedDevelopmentShadowScope
  registry: ShadowComponentRegistry
  componentId: string
  assignmentId: string
  createdAt: string
  executionModel: {
    adapterId: string
    adapterVersion: string
    modelId: string
    reasoningLevel: string
  }
  article: unknown
}): Readonly<ShadowModelPacketEnvelope> {
  verifyShadowComponentRegistry(input.registry)
  assertNoForbiddenModelInputFields(input.article)
  const article = shadowModelArticleSchema.parse(input.article)
  assertDevelopmentArticleAuthorized(input.scope, article.pmid)
  const component = getShadowClassifierComponent(input.registry, input.componentId)
  const executionModel = z
    .object({
      adapterId: safeIdentifierSchema,
      adapterVersion: z.string().min(1).max(100),
      modelId: safeIdentifierSchema,
      reasoningLevel: z.string().trim().min(1).max(100),
    })
    .strict()
    .parse(input.executionModel)
  if (executionModel.modelId === 'operator_selected_frontier_model') {
    throw new Error('A concrete execution model identity is required for every attempted result.')
  }
  if (
    executionModel.adapterId !== component.model.adapterId ||
    executionModel.adapterVersion !== component.model.adapterVersion
  ) {
    throw new Error(
      'Execution adapter identity must match the selected registry component adapter.',
    )
  }
  const modelInput: ShadowModelInput = {
    schemaVersion: SHADOW_MODEL_INPUT_SCHEMA_VERSION,
    instruction: component.prompt.instruction,
    outputContract: {
      schemaVersion: component.outputSchemaVersion,
      outputCardinality: component.outputCardinality,
      outputVocabulary: [...component.outputVocabulary],
      allowedEvidenceFields: [...component.allowedEvidenceFields],
      abstentionReasons: [...component.abstentionReasons],
      confidenceSemantics: { ...component.confidenceSemantics },
      invalidOutputPolicy: component.invalidOutputPolicy,
    },
    article,
  }
  const packet: ShadowModelPacket = {
    schemaVersion: SHADOW_MODEL_PACKET_SCHEMA_VERSION,
    developmentOnly: true,
    evidenceOnly: true,
    decisionUse: 'shadow_only',
    assignmentId: safeIdentifierSchema.parse(input.assignmentId),
    createdAt: z.string().datetime({ offset: true }).parse(input.createdAt),
    registry: {
      registryId: input.registry.registryId,
      registryVersion: input.registry.registryVersion,
      registrySha256: input.registry.registrySha256,
    },
    componentProvenance: {
      componentId: component.componentId,
      componentVersion: component.componentVersion,
      role: component.role,
      purpose: component.purpose,
      inputSchemaVersion: component.inputSchemaVersion,
      outputSchemaVersion: component.outputSchemaVersion,
      prompt: {
        promptId: component.prompt.promptId,
        promptVersion: component.prompt.promptVersion,
        promptSha256: component.prompt.promptSha256,
      },
      model: executionModel,
      invalidOutputPolicy: component.invalidOutputPolicy,
    },
    modelInput,
    modelInputSha256: sha256ShadowValue(modelInput),
    articleInputSha256: sha256ShadowValue(article),
    productionEffectsAuthorized: false,
  }
  const parsedPacket = shadowModelPacketSchema.parse(packet)
  return immutableShadowValue({
    packet: parsedPacket,
    packetSha256: sha256ShadowValue(parsedPacket),
  })
}

export function assertShadowModelPacketEnvelope(
  envelope: ShadowModelPacketEnvelope,
): ShadowModelPacket {
  const packet = shadowModelPacketSchema.parse(envelope.packet)
  if (sha256ShadowValue(packet) !== sha256Schema.parse(envelope.packetSha256)) {
    throw new Error('Shadow model packet checksum mismatch.')
  }
  if (packet.modelInputSha256 !== sha256ShadowValue(packet.modelInput)) {
    throw new Error('Shadow model input checksum mismatch.')
  }
  if (packet.articleInputSha256 !== sha256ShadowValue(packet.modelInput.article)) {
    throw new Error('Shadow model packet article checksum mismatch.')
  }
  return packet
}

/** The only payload an adapter may dispatch to a model. Coordinator provenance stays outside it. */
export function shadowModelInputForAdapter(
  envelope: ShadowModelPacketEnvelope,
  registry: ShadowComponentRegistry,
): Readonly<ShadowModelInput> {
  return immutableShadowValue(assertShadowPacketRegistryBinding(envelope, registry).modelInput)
}

export function assertShadowPacketRegistryBinding(
  envelope: ShadowModelPacketEnvelope,
  registry: ShadowComponentRegistry,
): ShadowModelPacket {
  verifyShadowComponentRegistry(registry)
  const packet = assertShadowModelPacketEnvelope(envelope)
  if (
    packet.registry.registryId !== registry.registryId ||
    packet.registry.registryVersion !== registry.registryVersion ||
    packet.registry.registrySha256 !== registry.registrySha256
  ) {
    throw new Error('Shadow packet registry checksum does not match the authenticated registry.')
  }
  const component = getShadowClassifierComponent(registry, packet.componentProvenance.componentId)
  const expectedProvenance = {
    componentId: component.componentId,
    componentVersion: component.componentVersion,
    role: component.role,
    purpose: component.purpose,
    inputSchemaVersion: component.inputSchemaVersion,
    outputSchemaVersion: component.outputSchemaVersion,
    prompt: {
      promptId: component.prompt.promptId,
      promptVersion: component.prompt.promptVersion,
      promptSha256: component.prompt.promptSha256,
    },
    model: packet.componentProvenance.model,
    invalidOutputPolicy: component.invalidOutputPolicy,
  }
  const expectedModelInput = {
    schemaVersion: SHADOW_MODEL_INPUT_SCHEMA_VERSION,
    instruction: component.prompt.instruction,
    outputContract: {
      schemaVersion: component.outputSchemaVersion,
      outputCardinality: component.outputCardinality,
      outputVocabulary: component.outputVocabulary,
      allowedEvidenceFields: component.allowedEvidenceFields,
      abstentionReasons: component.abstentionReasons,
      confidenceSemantics: component.confidenceSemantics,
      invalidOutputPolicy: component.invalidOutputPolicy,
    },
    article: packet.modelInput.article,
  }
  if (
    sha256ShadowValue(expectedProvenance) !== sha256ShadowValue(packet.componentProvenance) ||
    sha256ShadowValue(expectedModelInput) !== sha256ShadowValue(packet.modelInput) ||
    packet.componentProvenance.model.adapterId !== component.model.adapterId ||
    packet.componentProvenance.model.adapterVersion !== component.model.adapterVersion ||
    packet.componentProvenance.model.modelId === component.model.modelId
  ) {
    throw new Error(
      'Shadow packet does not exactly bind registry component and concrete execution provenance.',
    )
  }
  return packet
}
