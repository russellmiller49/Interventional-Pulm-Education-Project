import { z } from 'zod'

import { immutableShadowValue, sha256ShadowValue } from './canonical'
import {
  assertShadowModelPacketEnvelope,
  type ShadowModelPacket,
  type ShadowModelPacketEnvelope,
} from './model-packet'
import type { ShadowComponentValidationReport } from './result-validation'

export const SHADOW_ROUTING_POLICY_VERSION = 'literature-shadow-routing/1.0.0' as const
export const SHADOW_ROUTING_ASSESSMENT_SCHEMA_VERSION =
  'literature-shadow-routing-assessment/1.0.0' as const

export const SHADOW_REVIEW_ROUTE_REASONS = [
  'invalid_output',
  'missing_output',
  'model_refusal',
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
  'component_missing',
] as const
export type ShadowReviewRouteReason = (typeof SHADOW_REVIEW_ROUTE_REASONS)[number]

export const SHADOW_SCIENTIFIC_WARNINGS = [
  'shared_prompt_lineage_correlated_failure_risk',
  'shared_model_lineage_correlated_failure_risk',
  'uncalibrated_model_confidence',
] as const
export type ShadowScientificWarning = (typeof SHADOW_SCIENTIFIC_WARNINGS)[number]

export const shadowRoutingEvidenceAssessmentSchema = z
  .object({
    schemaVersion: z.literal(SHADOW_ROUTING_ASSESSMENT_SCHEMA_VERSION),
    assessedBy: z.literal('coordinator_policy'),
    fullTextRequired: z.boolean(),
    conflictingEvidence: z.boolean(),
    ambiguousProceduralScope: z.boolean(),
    surgicalBronchoscopicBoundary: z.boolean(),
    unfamiliarTechnology: z.boolean(),
    taxonomyMismatch: z.boolean(),
    classifierDisagreement: z.boolean(),
    confidenceBelowCandidateThreshold: z.boolean(),
    candidateThresholdSelected: z.literal(false),
  })
  .strict()

export type ShadowRoutingEvidenceAssessment = z.infer<typeof shadowRoutingEvidenceAssessmentSchema>

export const NO_ADDITIONAL_SHADOW_ROUTING_RISK: ShadowRoutingEvidenceAssessment = Object.freeze({
  schemaVersion: SHADOW_ROUTING_ASSESSMENT_SCHEMA_VERSION,
  assessedBy: 'coordinator_policy',
  fullTextRequired: false,
  conflictingEvidence: false,
  ambiguousProceduralScope: false,
  surgicalBronchoscopicBoundary: false,
  unfamiliarTechnology: false,
  taxonomyMismatch: false,
  classifierDisagreement: false,
  confidenceBelowCandidateThreshold: false,
  candidateThresholdSelected: false,
})

export interface ShadowRoutingObservation {
  packetEnvelope: ShadowModelPacketEnvelope
  validation: ShadowComponentValidationReport
  assessment: ShadowRoutingEvidenceAssessment
}

export interface ShadowComparisonGroup {
  leftAssignmentId: string
  rightAssignmentId: string
}

export interface ShadowRoutingDecision {
  policyVersion: typeof SHADOW_ROUTING_POLICY_VERSION
  route: 'human_review' | 'shadow_observation'
  reasons: readonly ShadowReviewRouteReason[]
  scientificWarnings: readonly ShadowScientificWarning[]
  assignmentIds: readonly string[]
  evidenceSha256: string
  productionStateChanged: false
  automaticAction: null
  confidenceThresholdSelected: false
}

function validateObservation(observation: ShadowRoutingObservation): ShadowModelPacket {
  const packet = assertShadowModelPacketEnvelope(observation.packetEnvelope)
  shadowRoutingEvidenceAssessmentSchema.parse(observation.assessment)
  if (
    observation.validation.assignmentId !== packet.assignmentId ||
    observation.validation.packetSha256 !== observation.packetEnvelope.packetSha256 ||
    observation.validation.componentId !== packet.componentProvenance.componentId
  ) {
    throw new Error('Routing observation validation is not bound to its exact packet.')
  }
  return packet
}

function mandatoryReasons(
  packet: ShadowModelPacket,
  report: ShadowComponentValidationReport,
  assessment: ShadowRoutingEvidenceAssessment,
): ShadowReviewRouteReason[] {
  const reasons = new Set<ShadowReviewRouteReason>()
  const article = packet.modelInput.article
  if (article.abstract === null || article.abstract.trim().length === 0) {
    reasons.add('insufficient_abstract')
  }
  if (assessment.fullTextRequired && article.fullText.availability !== 'available') {
    reasons.add('missing_full_text_when_required')
  }
  if (assessment.conflictingEvidence) reasons.add('conflicting_evidence')
  if (assessment.ambiguousProceduralScope) reasons.add('ambiguous_procedural_scope')
  if (assessment.surgicalBronchoscopicBoundary) {
    reasons.add('surgical_bronchoscopic_boundary')
  }
  if (assessment.unfamiliarTechnology) reasons.add('unfamiliar_technology')
  if (assessment.taxonomyMismatch) reasons.add('taxonomy_mismatch')
  if (assessment.classifierDisagreement) reasons.add('classifier_disagreement')
  if (assessment.confidenceBelowCandidateThreshold) {
    reasons.add('confidence_below_unselected_candidate_threshold')
  }

  if (!report.valid) {
    reasons.add(report.status === 'rejected_missing' ? 'missing_output' : 'invalid_output')
    return [...reasons]
  }
  const response = report.result.response
  if (response.state === 'refusal') reasons.add('model_refusal')
  if (response.state === 'abstention') {
    for (const reason of response.abstentionReasons) reasons.add(reason)
  }
  if (response.state === 'prediction' && response.outputValues.includes('uncertain')) {
    reasons.add('metadata_insufficient')
  }
  if (
    packet.componentProvenance.componentId === 'ip_relevance' &&
    response.state === 'prediction' &&
    response.outputValues.includes('uncertain')
  ) {
    reasons.add('metadata_insufficient')
  }
  if (
    packet.componentProvenance.componentId === 'metadata_sufficiency' &&
    response.state === 'prediction'
  ) {
    if (response.outputValues.includes('conflicting_metadata')) reasons.add('conflicting_evidence')
    if (
      response.outputValues.includes('limited_abstract') ||
      response.outputValues.includes('no_abstract')
    ) {
      reasons.add('metadata_insufficient')
    }
  }
  if (
    packet.componentProvenance.componentId === 'full_text_need' &&
    response.state === 'prediction' &&
    response.outputValues.includes('evidence_unavailable')
  ) {
    reasons.add('missing_full_text_when_required')
  }
  if (
    packet.componentProvenance.componentId === 'full_text_need' &&
    response.state === 'prediction' &&
    response.outputValues.includes('needed_for_classification') &&
    article.fullText.availability !== 'available'
  ) {
    reasons.add('missing_full_text_when_required')
  }
  return [...reasons]
}

function scientificWarnings(observations: readonly ShadowRoutingObservation[]) {
  const warnings = new Set<ShadowScientificWarning>(['uncalibrated_model_confidence'])
  const packets = observations.map(validateObservation)
  const promptLineage = new Set(
    packets.map((packet) => packet.componentProvenance.prompt.promptSha256),
  )
  const modelLineage = new Set(
    packets.map(
      (packet) =>
        `${packet.componentProvenance.model.adapterId}@${packet.componentProvenance.model.adapterVersion}:${packet.componentProvenance.model.modelId}`,
    ),
  )
  if (packets.length > 1 && promptLineage.size < packets.length) {
    warnings.add('shared_prompt_lineage_correlated_failure_risk')
  }
  if (packets.length > 1 && modelLineage.size < packets.length) {
    warnings.add('shared_model_lineage_correlated_failure_risk')
  }
  return [...warnings].sort()
}

function finalizedDecision(input: {
  observations: readonly ShadowRoutingObservation[]
  reasons: ReadonlySet<ShadowReviewRouteReason>
}): Readonly<ShadowRoutingDecision> {
  const assignmentIds = input.observations
    .map((observation) => observation.packetEnvelope.packet.assignmentId)
    .sort()
  const evidence = input.observations.map((observation) => ({
    assignmentId: observation.packetEnvelope.packet.assignmentId,
    packetSha256: observation.packetEnvelope.packetSha256,
    validationSha256: sha256ShadowValue(observation.validation),
    assessmentSha256: sha256ShadowValue(observation.assessment),
  }))
  return immutableShadowValue({
    policyVersion: SHADOW_ROUTING_POLICY_VERSION,
    route: input.reasons.size > 0 ? 'human_review' : 'shadow_observation',
    reasons: [...input.reasons].sort(),
    scientificWarnings: scientificWarnings(input.observations),
    assignmentIds,
    evidenceSha256: sha256ShadowValue(evidence),
    productionStateChanged: false,
    automaticAction: null,
    confidenceThresholdSelected: false,
  })
}

export function routeShadowComponentResult(
  observation: ShadowRoutingObservation,
): Readonly<ShadowRoutingDecision> {
  const packet = validateObservation(observation)
  return finalizedDecision({
    observations: [observation],
    reasons: new Set(mandatoryReasons(packet, observation.validation, observation.assessment)),
  })
}

export function routeShadowComponentSet(input: {
  observations: readonly ShadowRoutingObservation[]
  requiredComponentIds: readonly string[]
  comparisonGroups?: readonly ShadowComparisonGroup[]
}): Readonly<ShadowRoutingDecision> {
  const packetByAssignment = new Map<string, ShadowModelPacket>()
  const observationByAssignment = new Map<string, ShadowRoutingObservation>()
  const componentCounts = new Map<string, number>()
  const reasons = new Set<ShadowReviewRouteReason>()

  for (const observation of input.observations) {
    const packet = validateObservation(observation)
    if (packetByAssignment.has(packet.assignmentId)) {
      throw new Error(`Duplicate shadow routing assignment ${packet.assignmentId}.`)
    }
    packetByAssignment.set(packet.assignmentId, packet)
    observationByAssignment.set(packet.assignmentId, observation)
    const componentId = packet.componentProvenance.componentId
    componentCounts.set(componentId, (componentCounts.get(componentId) ?? 0) + 1)
    for (const reason of mandatoryReasons(packet, observation.validation, observation.assessment)) {
      reasons.add(reason)
    }
  }

  if (new Set(input.requiredComponentIds).size !== input.requiredComponentIds.length) {
    throw new Error('Required shadow component IDs must be unique.')
  }
  for (const componentId of input.requiredComponentIds) {
    const count = componentCounts.get(componentId) ?? 0
    if (count === 0) reasons.add('component_missing')
    if (count > 1) throw new Error(`Required component ${componentId} has duplicate coverage.`)
  }

  for (const group of input.comparisonGroups ?? []) {
    const left = observationByAssignment.get(group.leftAssignmentId)
    const right = observationByAssignment.get(group.rightAssignmentId)
    if (!left || !right) {
      throw new Error('Classifier comparison group references an unknown assignment.')
    }
    if (
      left.validation.valid &&
      right.validation.valid &&
      left.validation.result.response.state === 'prediction' &&
      right.validation.result.response.state === 'prediction' &&
      left.validation.result.response.outputValues.join('\0') !==
        right.validation.result.response.outputValues.join('\0')
    ) {
      reasons.add('classifier_disagreement')
    }
  }

  return finalizedDecision({ observations: input.observations, reasons })
}

export function abstentionRequiredForEvidence(input: {
  abstractAvailable: boolean
  fullTextRequired: boolean
  fullTextAvailable: boolean
  conflictingEvidence: boolean
  ambiguousProceduralScope: boolean
  surgicalBronchoscopicBoundary: boolean
  unfamiliarTechnology: boolean
  taxonomyMismatch: boolean
  classifierDisagreement: boolean
  confidenceBelowCandidateThreshold: boolean
}): readonly ShadowReviewRouteReason[] {
  const reasons: ShadowReviewRouteReason[] = []
  if (!input.abstractAvailable) reasons.push('insufficient_abstract')
  if (input.fullTextRequired && !input.fullTextAvailable) {
    reasons.push('missing_full_text_when_required')
  }
  if (input.conflictingEvidence) reasons.push('conflicting_evidence')
  if (input.ambiguousProceduralScope) reasons.push('ambiguous_procedural_scope')
  if (input.surgicalBronchoscopicBoundary) reasons.push('surgical_bronchoscopic_boundary')
  if (input.unfamiliarTechnology) reasons.push('unfamiliar_technology')
  if (input.taxonomyMismatch) reasons.push('taxonomy_mismatch')
  if (input.classifierDisagreement) reasons.push('classifier_disagreement')
  if (input.confidenceBelowCandidateThreshold) {
    reasons.push('confidence_below_unselected_candidate_threshold')
  }
  return immutableShadowValue([...new Set(reasons)].sort())
}
