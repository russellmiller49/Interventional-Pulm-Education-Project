import { z } from 'zod'

import { immutableShadowValue, sha256ShadowValue } from './canonical'
import {
  assertShadowModelPacketEnvelope,
  assertShadowPacketRegistryBinding,
  type ShadowModelPacket,
  type ShadowModelPacketEnvelope,
} from './model-packet'
import type { ShadowComponentRegistry } from './registry'

export const SHADOW_MODEL_RESPONSE_SCHEMA_VERSION =
  'literature-shadow-model-response/1.0.0' as const
export const SHADOW_COMPONENT_ATTEMPT_SCHEMA_VERSION =
  'literature-shadow-component-attempt/1.0.0' as const
export const SHADOW_COMPONENT_RESULT_SCHEMA_VERSION = SHADOW_MODEL_RESPONSE_SCHEMA_VERSION
export const SHADOW_RESULT_VALIDATION_SCHEMA_VERSION =
  'literature-shadow-result-validation/1.0.0' as const

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u)
const safeIdentifierSchema = z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,159}$/u)

const evidenceSchema = z
  .object({
    field: z.enum([
      'title',
      'abstract',
      'mesh_term',
      'author_keyword',
      'publication_type',
      'journal',
      'year',
      'language',
      'full_text',
    ]),
    text: z.string().trim().min(1).max(4_000),
  })
  .strict()

const probabilityPayloadSchema = z
  .object({
    vocabulary: z.array(safeIdentifierSchema).min(2).max(100),
    values: z.record(safeIdentifierSchema, z.number().finite().min(0).max(1)),
    source: z.literal('model_supplied'),
    calibrated: z.literal(false),
    calibrationArtifactSha256: z.null(),
  })
  .strict()

export const shadowModelResponseSchema = z
  .object({
    schemaVersion: z.literal(SHADOW_MODEL_RESPONSE_SCHEMA_VERSION),
    state: z.enum(['prediction', 'abstention', 'refusal']),
    outputValues: z.array(safeIdentifierSchema).max(100),
    evidenceUsed: z.array(evidenceSchema).max(25),
    rationale: z.string().trim().min(1).max(4_000),
    selfReportedConfidence: z.number().finite().min(0).max(1).nullable(),
    probabilities: probabilityPayloadSchema.nullable(),
    abstentionReasons: z
      .array(
        z.enum([
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
        ]),
      )
      .max(20),
    refusalCode: safeIdentifierSchema.nullable(),
  })
  .strict()

export const shadowComponentAttemptEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(SHADOW_COMPONENT_ATTEMPT_SCHEMA_VERSION),
    assignmentId: safeIdentifierSchema,
    packetSha256: sha256Schema,
    articlePmid: z.string().regex(/^[0-9]{1,12}$/u),
    componentId: safeIdentifierSchema,
    componentVersion: z.string().min(1).max(100),
    promptId: safeIdentifierSchema,
    promptVersion: z.string().min(1).max(100),
    promptSha256: sha256Schema,
    adapterId: safeIdentifierSchema,
    adapterVersion: z.string().min(1).max(100),
    modelId: safeIdentifierSchema,
    reasoningLevel: z.string().trim().min(1).max(100),
    startedAt: z.string().datetime({ offset: true }),
    completedAt: z.string().datetime({ offset: true }),
    response: shadowModelResponseSchema,
  })
  .strict()

export type RawShadowModelResponse = z.infer<typeof shadowModelResponseSchema>
export type RawShadowComponentResult = z.infer<typeof shadowComponentAttemptEnvelopeSchema>

export type ShadowComponentValidationIssueCode =
  | 'missing_output'
  | 'invalid_schema'
  | 'provenance_mismatch'
  | 'unknown_output_value'
  | 'invalid_state_payload'
  | 'invalid_evidence'
  | 'invalid_probability_payload'

export interface ShadowComponentValidationIssue {
  code: ShadowComponentValidationIssueCode
  message: string
  path?: string
}

export interface AcceptedShadowComponentResult extends RawShadowComponentResult {
  resultSha256: string
}

export type ShadowComponentValidationReport =
  | {
      schemaVersion: typeof SHADOW_RESULT_VALIDATION_SCHEMA_VERSION
      assignmentId: string
      packetSha256: string
      componentId: string
      status: 'accepted_prediction' | 'accepted_abstention' | 'accepted_refusal'
      valid: true
      issues: readonly []
      result: Readonly<AcceptedShadowComponentResult>
    }
  | {
      schemaVersion: typeof SHADOW_RESULT_VALIDATION_SCHEMA_VERSION
      assignmentId: string
      packetSha256: string
      componentId: string
      status: 'rejected_invalid' | 'rejected_missing'
      valid: false
      issues: readonly ShadowComponentValidationIssue[]
      result: null
    }

export function createShadowComponentAttemptEnvelope(input: {
  packetEnvelope: ShadowModelPacketEnvelope
  startedAt: string
  completedAt: string
  modelResponse: unknown
}): Readonly<RawShadowComponentResult> {
  const packet = assertShadowModelPacketEnvelope(input.packetEnvelope)
  const response = shadowModelResponseSchema.parse(input.modelResponse)
  return immutableShadowValue(
    shadowComponentAttemptEnvelopeSchema.parse({
      schemaVersion: SHADOW_COMPONENT_ATTEMPT_SCHEMA_VERSION,
      assignmentId: packet.assignmentId,
      packetSha256: input.packetEnvelope.packetSha256,
      articlePmid: packet.modelInput.article.pmid,
      componentId: packet.componentProvenance.componentId,
      componentVersion: packet.componentProvenance.componentVersion,
      promptId: packet.componentProvenance.prompt.promptId,
      promptVersion: packet.componentProvenance.prompt.promptVersion,
      promptSha256: packet.componentProvenance.prompt.promptSha256,
      adapterId: packet.componentProvenance.model.adapterId,
      adapterVersion: packet.componentProvenance.model.adapterVersion,
      modelId: packet.componentProvenance.model.modelId,
      reasoningLevel: packet.componentProvenance.model.reasoningLevel,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      response,
    }),
  )
}

function evidenceFieldValues(
  packet: ShadowModelPacket,
  field: z.infer<typeof evidenceSchema>['field'],
): readonly string[] {
  const { article } = packet.modelInput
  switch (field) {
    case 'title':
      return [article.title]
    case 'abstract':
      return article.abstract === null ? [] : [article.abstract]
    case 'mesh_term':
      return article.meshTerms
    case 'author_keyword':
      return article.authorKeywords
    case 'publication_type':
      return article.publicationTypes
    case 'journal':
      return [article.journalTitle, article.journalAbbreviation].filter(
        (value): value is string => value !== null,
      )
    case 'year':
      return article.publicationYear === null ? [] : [String(article.publicationYear)]
    case 'language':
      return article.languages
    case 'full_text':
      return article.fullText.text === null ? [] : [article.fullText.text]
  }
}

function validateProvenance(
  result: RawShadowComponentResult,
  packet: ShadowModelPacket,
  packetSha256: string,
): ShadowComponentValidationIssue[] {
  const provenance = packet.componentProvenance
  if (Date.parse(result.startedAt) < Date.parse(packet.createdAt)) {
    return [
      {
        code: 'provenance_mismatch',
        message: 'startedAt cannot precede the packet creation time.',
        path: 'startedAt',
      },
    ]
  }
  const expected: Array<[unknown, unknown, string]> = [
    [result.assignmentId, packet.assignmentId, 'assignmentId'],
    [result.packetSha256, packetSha256, 'packetSha256'],
    [result.articlePmid, packet.modelInput.article.pmid, 'articlePmid'],
    [result.componentId, provenance.componentId, 'componentId'],
    [result.componentVersion, provenance.componentVersion, 'componentVersion'],
    [result.promptId, provenance.prompt.promptId, 'promptId'],
    [result.promptVersion, provenance.prompt.promptVersion, 'promptVersion'],
    [result.promptSha256, provenance.prompt.promptSha256, 'promptSha256'],
    [result.adapterId, provenance.model.adapterId, 'adapterId'],
    [result.adapterVersion, provenance.model.adapterVersion, 'adapterVersion'],
    [result.modelId, provenance.model.modelId, 'modelId'],
    [result.reasoningLevel, provenance.model.reasoningLevel, 'reasoningLevel'],
  ]
  return expected.flatMap(([actual, value, path]) =>
    actual === value
      ? []
      : [{ code: 'provenance_mismatch' as const, message: `${path} does not match packet.`, path }],
  )
}

function validateStatePayload(result: RawShadowComponentResult): ShadowComponentValidationIssue[] {
  const response = result.response
  if (Date.parse(result.completedAt) < Date.parse(result.startedAt)) {
    return [
      {
        code: 'invalid_state_payload',
        message: 'completedAt cannot precede startedAt.',
        path: 'completedAt',
      },
    ]
  }
  if (response.state === 'prediction') {
    if (
      response.outputValues.length === 0 ||
      response.evidenceUsed.length === 0 ||
      response.selfReportedConfidence === null ||
      response.abstentionReasons.length > 0 ||
      response.refusalCode !== null
    ) {
      return [
        {
          code: 'invalid_state_payload',
          message:
            'Prediction requires output, evidence, and self-reported confidence, and forbids abstention/refusal fields.',
        },
      ]
    }
  } else if (response.state === 'abstention') {
    if (
      response.outputValues.length > 0 ||
      response.abstentionReasons.length === 0 ||
      response.refusalCode !== null ||
      response.probabilities !== null
    ) {
      return [
        {
          code: 'invalid_state_payload',
          message:
            'Abstention requires reasons and forbids predictions, refusal, and probabilities.',
        },
      ]
    }
  } else if (
    response.outputValues.length > 0 ||
    response.evidenceUsed.length > 0 ||
    response.selfReportedConfidence !== null ||
    response.probabilities !== null ||
    response.abstentionReasons.length > 0 ||
    response.refusalCode === null
  ) {
    return [
      {
        code: 'invalid_state_payload',
        message:
          'Refusal requires a refusal code and cannot claim output, evidence, or confidence.',
      },
    ]
  }
  return []
}

function validateProbabilities(
  response: RawShadowModelResponse,
  vocabulary: readonly string[],
): ShadowComponentValidationIssue[] {
  const probabilities = response.probabilities
  if (!probabilities) return []
  if (response.state !== 'prediction') {
    return [
      {
        code: 'invalid_probability_payload',
        message: 'Only accepted predictions may include probabilities.',
      },
    ]
  }
  if (
    probabilities.vocabulary.length !== vocabulary.length ||
    probabilities.vocabulary.some((value, index) => value !== vocabulary[index]) ||
    Object.keys(probabilities.values).sort().join('\0') !== [...vocabulary].sort().join('\0')
  ) {
    return [
      {
        code: 'invalid_probability_payload',
        message: 'Probability vocabulary and keys must exactly match registry order and values.',
      },
    ]
  }
  const sum = Object.values(probabilities.values).reduce((total, value) => total + value, 0)
  if (Math.abs(sum - 1) > 1e-9) {
    return [
      {
        code: 'invalid_probability_payload',
        message: 'Probabilities must sum to one within 1e-9.',
      },
    ]
  }
  const sorted = Object.entries(probabilities.values).sort(
    ([leftLabel, left], [rightLabel, right]) => right - left || leftLabel.localeCompare(rightLabel),
  )
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) {
    return [
      {
        code: 'invalid_probability_payload',
        message: 'Probability argmax must be unique.',
      },
    ]
  }
  if (response.outputValues.length !== 1 || sorted[0][0] !== response.outputValues[0]) {
    return [
      {
        code: 'invalid_probability_payload',
        message: 'Predicted output must equal the unique probability argmax.',
      },
    ]
  }
  return []
}

export function validateShadowComponentResult(input: {
  rawResult: unknown
  packetEnvelope: ShadowModelPacketEnvelope
  registry: ShadowComponentRegistry
}): Readonly<ShadowComponentValidationReport> {
  let packet: ShadowModelPacket
  try {
    packet = assertShadowPacketRegistryBinding(input.packetEnvelope, input.registry)
  } catch (error) {
    return immutableShadowValue({
      schemaVersion: SHADOW_RESULT_VALIDATION_SCHEMA_VERSION,
      assignmentId: input.packetEnvelope.packet?.assignmentId ?? 'invalid:packet',
      packetSha256: input.packetEnvelope.packetSha256,
      componentId:
        input.packetEnvelope.packet?.componentProvenance?.componentId ?? 'invalid_component',
      status: 'rejected_invalid',
      valid: false,
      issues: [
        {
          code: 'provenance_mismatch',
          message: error instanceof Error ? error.message : String(error),
        },
      ],
      result: null,
    })
  }

  if (input.rawResult === undefined || input.rawResult === null || input.rawResult === '') {
    return immutableShadowValue({
      schemaVersion: SHADOW_RESULT_VALIDATION_SCHEMA_VERSION,
      assignmentId: packet.assignmentId,
      packetSha256: input.packetEnvelope.packetSha256,
      componentId: packet.componentProvenance.componentId,
      status: 'rejected_missing',
      valid: false,
      issues: [{ code: 'missing_output', message: 'Assigned component produced no output.' }],
      result: null,
    })
  }

  const parsed = shadowComponentAttemptEnvelopeSchema.safeParse(input.rawResult)
  if (!parsed.success) {
    return immutableShadowValue({
      schemaVersion: SHADOW_RESULT_VALIDATION_SCHEMA_VERSION,
      assignmentId: packet.assignmentId,
      packetSha256: input.packetEnvelope.packetSha256,
      componentId: packet.componentProvenance.componentId,
      status: 'rejected_invalid',
      valid: false,
      issues: parsed.error.issues.map((issue) => ({
        code: 'invalid_schema' as const,
        message: issue.message,
        path: issue.path.join('.'),
      })),
      result: null,
    })
  }

  const result = parsed.data
  const response = result.response
  const outputContract = packet.modelInput.outputContract
  const issues: ShadowComponentValidationIssue[] = [
    ...validateProvenance(result, packet, input.packetEnvelope.packetSha256),
    ...validateStatePayload(result),
  ]
  const invalidOutputs = response.outputValues.filter(
    (value) => !outputContract.outputVocabulary.includes(value),
  )
  if (invalidOutputs.length > 0) {
    issues.push({
      code: 'unknown_output_value',
      message: `Unsupported output vocabulary: ${invalidOutputs.join(', ')}.`,
      path: 'response.outputValues',
    })
  }
  if (outputContract.outputCardinality === 'single' && response.outputValues.length > 1) {
    issues.push({
      code: 'invalid_state_payload',
      message: 'Single-cardinality component returned multiple output values.',
      path: 'response.outputValues',
    })
  }
  if (new Set(response.outputValues).size !== response.outputValues.length) {
    issues.push({
      code: 'invalid_state_payload',
      message: 'Output values must be unique.',
      path: 'response.outputValues',
    })
  }
  if (new Set(response.abstentionReasons).size !== response.abstentionReasons.length) {
    issues.push({
      code: 'invalid_state_payload',
      message: 'Abstention reasons must be unique.',
      path: 'response.abstentionReasons',
    })
  }
  const unsupportedReasons = response.abstentionReasons.filter(
    (reason) => !outputContract.abstentionReasons.includes(reason),
  )
  if (unsupportedReasons.length > 0) {
    issues.push({
      code: 'invalid_state_payload',
      message: `Component does not permit abstention reasons: ${unsupportedReasons.join(', ')}.`,
      path: 'response.abstentionReasons',
    })
  }

  const seenEvidence = new Set<string>()
  for (const evidence of response.evidenceUsed) {
    if (!outputContract.allowedEvidenceFields.includes(evidence.field)) {
      issues.push({
        code: 'invalid_evidence',
        message: `Component does not allow evidence field ${evidence.field}.`,
      })
      continue
    }
    const identity = `${evidence.field}\0${evidence.text}`
    if (seenEvidence.has(identity)) {
      issues.push({ code: 'invalid_evidence', message: 'Evidence entries must be unique.' })
      continue
    }
    seenEvidence.add(identity)
    if (
      !evidenceFieldValues(packet, evidence.field).some((value) => value.includes(evidence.text))
    ) {
      issues.push({
        code: 'invalid_evidence',
        message: `Evidence does not occur verbatim in supplied ${evidence.field}.`,
      })
    }
  }
  issues.push(...validateProbabilities(response, outputContract.outputVocabulary))

  if (issues.length > 0) {
    return immutableShadowValue({
      schemaVersion: SHADOW_RESULT_VALIDATION_SCHEMA_VERSION,
      assignmentId: packet.assignmentId,
      packetSha256: input.packetEnvelope.packetSha256,
      componentId: packet.componentProvenance.componentId,
      status: 'rejected_invalid',
      valid: false,
      issues,
      result: null,
    })
  }

  const accepted = { ...result, resultSha256: sha256ShadowValue(result) }
  const status =
    response.state === 'prediction'
      ? 'accepted_prediction'
      : response.state === 'abstention'
        ? 'accepted_abstention'
        : 'accepted_refusal'
  return immutableShadowValue({
    schemaVersion: SHADOW_RESULT_VALIDATION_SCHEMA_VERSION,
    assignmentId: packet.assignmentId,
    packetSha256: input.packetEnvelope.packetSha256,
    componentId: packet.componentProvenance.componentId,
    status,
    valid: true,
    issues: [],
    result: accepted,
  })
}
