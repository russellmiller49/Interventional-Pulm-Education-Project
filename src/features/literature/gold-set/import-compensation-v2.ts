import { z } from 'zod'

import {
  canonicalJson,
  goldReviewClinicalProjectionSchema,
  goldReviewOperationEventTypeSchema,
  goldReviewPayloadSchema,
  rejectLegacyPointerRewindRollback,
  sha256Canonical,
} from './import-compensation'
import {
  GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
  GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
  GOLD_REVIEW_IMPORT_V2_RPC_NAMES,
} from './import-compensation-v2-identities'

export { canonicalJson, sha256Canonical } from './import-compensation'
export {
  GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
  GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
  GOLD_REVIEW_IMPORT_COMPENSATION_V2_FUNCTION_IDENTITIES,
  GOLD_REVIEW_IMPORT_V2_RPC_NAMES,
} from './import-compensation-v2-identities'

const uuidSchema = z
  .string()
  .uuid()
  .refine((value) => value === value.toLowerCase(), 'UUIDs must use canonical lowercase text.')
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u)
const pmidSchema = z.string().regex(/^[0-9]{1,12}$/u)
const positiveIntegerSchema = z.number().int().positive()
const timestampSchema = z.string().datetime({ offset: true })
const optionalTagStatusSchema = z.enum(['tagged', 'not_applicable', 'not_assessable'])

const reviewPayloadV1ObjectSchema = goldReviewPayloadSchema.innerType()

/**
 * V2 keeps the V1 controlled vocabularies and operational fields, but persists source
 * full-text provenance independently and admits source-null tag statuses only for the exact
 * formal excluded/uncertain shape.
 */
export const goldReviewPayloadV2Schema = reviewPayloadV1ObjectSchema
  .extend({
    diseaseTagStatus: optionalTagStatusSchema.nullable(),
    fullTextUsed: z.boolean(),
    technologyTagStatus: optionalTagStatusSchema.nullable(),
  })
  .strict()
  .superRefine((review, context) => {
    const included =
      review.relevanceLabel === 'include_core' || review.relevanceLabel === 'include_adjacent'
    const excluded = review.relevanceLabel === 'exclude' || review.relevanceLabel === 'uncertain'
    const categorized =
      review.topicIds.length > 0 ||
      review.technologyTags.length > 0 ||
      review.clinicalPurposes.length > 0 ||
      review.diseaseTags.length > 0 ||
      review.studyDesign !== null ||
      review.publicationStatus !== null

    if (
      included &&
      (!review.topicIds.length ||
        !review.clinicalPurposes.length ||
        review.studyDesign === null ||
        review.publicationStatus === null ||
        review.technologyTagStatus === null ||
        review.diseaseTagStatus === null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Included V2 reviews require categorization and non-null technology/disease tag statuses.',
      })
    }
    if (
      excluded &&
      (categorized ||
        review.categorizationFromFullText ||
        review.technologyTagStatus !== null ||
        review.diseaseTagStatus !== null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Excluded/uncertain V2 reviews require the exact empty categorization shape and source-null tag statuses.',
      })
    }
    for (const [values, status, field] of [
      [review.technologyTags, review.technologyTagStatus, 'technologyTagStatus'],
      [review.diseaseTags, review.diseaseTagStatus, 'diseaseTagStatus'],
    ] as const) {
      if (
        included &&
        ((values.length > 0 && status !== 'tagged') || (values.length === 0 && status === 'tagged'))
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} does not match its tags.`,
        })
      }
    }
    if (Date.parse(review.completedAt) < Date.parse(review.startedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'completedAt cannot precede startedAt.',
      })
    }
  })
export type GoldReviewPayloadV2 = z.infer<typeof goldReviewPayloadV2Schema>

export const goldReviewClinicalProjectionV2Schema = goldReviewClinicalProjectionSchema
  .extend({
    diseaseTagStatus: optionalTagStatusSchema.nullable(),
    fullTextUsed: z.boolean(),
    operationContractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2),
    technologyTagStatus: optionalTagStatusSchema.nullable(),
  })
  .strict()
export type GoldReviewClinicalProjectionV2 = z.infer<typeof goldReviewClinicalProjectionV2Schema>

export function goldReviewClinicalProjectionV2(
  review: GoldReviewPayloadV2,
): GoldReviewClinicalProjectionV2 {
  return goldReviewClinicalProjectionV2Schema.parse({
    categorizationFromFullText: review.categorizationFromFullText,
    clinicalPurposes: [...review.clinicalPurposes].sort(),
    diseaseTagStatus: review.diseaseTagStatus,
    diseaseTags: [...review.diseaseTags].sort(),
    enrichmentProvenance: review.enrichmentProvenance,
    enrichmentSchemaVersion: review.enrichmentSchemaVersion,
    fullTextUsed: review.fullTextUsed,
    isBlinded: review.isBlinded,
    labelSchemaVersion: review.labelSchemaVersion,
    metadataSufficiency: review.metadataSufficiency,
    notes: review.notes,
    operationContractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    publicationStatus: review.publicationStatus,
    relevanceLabel: review.relevanceLabel,
    reviewerConfidence: review.reviewerConfidence,
    reviewSeconds: review.reviewSeconds,
    studyDesign: review.studyDesign,
    taxonomyVersion: review.taxonomyVersion,
    technologyTagStatus: review.technologyTagStatus,
    technologyTags: [...review.technologyTags].sort(),
    topicIds: [...review.topicIds].sort(),
    usedSupplementalMetadata: review.usedSupplementalMetadata,
  })
}

const preImportItemStateSchema = z
  .object({
    automatedSignalsRevealedAt: timestampSchema.nullable(),
    completedAt: timestampSchema.nullable(),
    reviewStatus: z.enum(['pending', 'in_progress', 'return_later', 'completed']),
    startedAt: timestampSchema.nullable(),
    supplementalMetadataRevealedAt: timestampSchema.nullable(),
  })
  .strict()

const importActionCommon = {
  actionId: uuidSchema,
  datasetSplit: z.literal('development'),
  expectedCurrentReviewId: uuidSchema.nullable(),
  expectedEffectiveReviewId: uuidSchema.nullable(),
  itemId: uuidSchema,
  pmid: pmidSchema,
  preImportItemState: preImportItemStateSchema,
  sequence: positiveIntegerSchema,
}

const importInitialActionV2Schema = z
  .object({
    ...importActionCommon,
    action: z.literal('import_initial'),
    compensationAction: z.literal('compensate_void'),
    expectedCurrentReviewId: z.null(),
    expectedEffectiveReviewId: z.null(),
    expectedEffectiveReviewIdAfter: uuidSchema,
    expectedEventSequence: z.tuple([z.literal('review_imported')]),
    expectedHeadReviewIdAfter: uuidSchema,
    expectedRevision: z.literal(1),
    expectedSupersedesReviewId: z.null(),
    importedReviewId: uuidSchema,
    review: goldReviewPayloadV2Schema,
    reviewSha256: sha256Schema,
  })
  .strict()

const importRevisionActionV2Schema = z
  .object({
    ...importActionCommon,
    action: z.literal('import_revision'),
    compensationAction: z.enum(['compensate_restore', 'compensate_void']),
    expectedCurrentReviewId: uuidSchema,
    expectedEffectiveReviewIdAfter: uuidSchema,
    expectedEventSequence: z.tuple([z.literal('review_imported')]),
    expectedHeadReviewIdAfter: uuidSchema,
    expectedRevision: positiveIntegerSchema.refine((value) => value >= 2),
    expectedSupersedesReviewId: uuidSchema,
    importedReviewId: uuidSchema,
    review: goldReviewPayloadV2Schema,
    reviewSha256: sha256Schema,
  })
  .strict()

const importNoopActionV2Schema = z
  .object({
    ...importActionCommon,
    action: z.literal('import_noop'),
    candidateReview: goldReviewClinicalProjectionV2Schema,
    candidateReviewSha256: sha256Schema,
    compensationAction: z.literal('compensate_noop'),
    expectedEffectiveReviewIdAfter: uuidSchema.nullable(),
    expectedEventSequence: z.tuple([]),
    expectedHeadReviewIdAfter: uuidSchema.nullable(),
    expectedRevision: z.null(),
    expectedSupersedesReviewId: z.null(),
    importedReviewId: z.null(),
  })
  .strict()

export const importActionV2Schema = z.discriminatedUnion('action', [
  importInitialActionV2Schema,
  importRevisionActionV2Schema,
  importNoopActionV2Schema,
])
export type ImportActionV2 = z.infer<typeof importActionV2Schema>

export const executionContextV2Schema = z
  .object({
    compensationRpc: z.literal(GOLD_REVIEW_IMPORT_V2_RPC_NAMES.compensation),
    developmentMembershipHash: z.literal('literature_gold_development_membership_hash_v1'),
    effectiveStateHash: z.literal(GOLD_REVIEW_IMPORT_V2_RPC_NAMES.effectiveStateHash),
    importRpc: z.literal(GOLD_REVIEW_IMPORT_V2_RPC_NAMES.import),
    migrationId: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2),
    physicalStateHash: z.literal(GOLD_REVIEW_IMPORT_V2_RPC_NAMES.physicalStateHash),
    reconciliationRpc: z.literal(GOLD_REVIEW_IMPORT_V2_RPC_NAMES.reconciliation),
    remoteWritesAllowed: z.literal(false),
    repositoryCommitSha: z.string().regex(/^[a-f0-9]{40}$/u),
    targetDatabase: z.literal('local'),
  })
  .strict()

const developmentScopeSchema = z
  .object({
    datasetSplit: z.literal('development'),
    developmentMembershipSha256: sha256Schema,
    heldOutIdentitiesAccessed: z.literal(false),
  })
  .strict()

const importCountsSchema = z
  .object({
    initial: z.number().int().nonnegative(),
    inserts: z.number().int().nonnegative(),
    noops: z.number().int().nonnegative(),
    revisions: z.number().int().nonnegative(),
    total: z.number().int().positive(),
  })
  .strict()

const sourceEvidenceFields = {
  booleanNormalizationLedgerSha256: sha256Schema,
  noteDispositionAuditSha256: sha256Schema,
  orderedSetNormalizationLedgerSha256: sha256Schema,
  sourceAuthorizationSetSha256: sha256Schema,
}

const planBindingSchema = z
  .object({ contentSha256: sha256Schema, idempotencyKey: sha256Schema })
  .strict()

export const importPlanContentV2Schema = z
  .object({
    actions: z.array(importActionV2Schema).min(1).max(5000),
    batchId: uuidSchema,
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2),
    counts: importCountsSchema,
    executionContext: executionContextV2Schema,
    expectedEffectiveStateSha256: sha256Schema,
    expectedPhysicalStateSha256: sha256Schema,
    expectedPostEffectiveStateSha256: sha256Schema,
    faultAfterAction: positiveIntegerSchema.optional(),
    kind: z.literal('import'),
    operationId: uuidSchema,
    scope: developmentScopeSchema,
    sourceArtifactSha256: sha256Schema,
    ...sourceEvidenceFields,
  })
  .strict()
  .superRefine((plan, context) => {
    const initial = plan.actions.filter((action) => action.action === 'import_initial').length
    const revisions = plan.actions.filter((action) => action.action === 'import_revision').length
    const noops = plan.actions.filter((action) => action.action === 'import_noop').length
    const counts = {
      initial,
      inserts: initial + revisions,
      noops,
      revisions,
      total: plan.actions.length,
    }
    if (canonicalJson(plan.counts) !== canonicalJson(counts)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'V2 import counts do not match actions.',
      })
    }
    const unique = (values: readonly string[], message: string) => {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message })
      }
    }
    unique(
      plan.actions.map((action) => action.actionId),
      'V2 import action IDs must be unique.',
    )
    unique(
      plan.actions.map((action) => action.itemId),
      'V2 import item IDs must be unique.',
    )
    unique(
      plan.actions.flatMap((action) =>
        action.action === 'import_noop' ? [] : [action.importedReviewId],
      ),
      'V2 imported review IDs must be unique.',
    )
    plan.actions.forEach((action, index) => {
      if (action.sequence !== index + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'V2 action sequence must be contiguous.',
        })
      }
      if (action.action === 'import_noop') {
        if (
          action.expectedHeadReviewIdAfter !== action.expectedCurrentReviewId ||
          action.expectedEffectiveReviewIdAfter !== action.expectedEffectiveReviewId ||
          action.candidateReviewSha256 !== sha256Canonical(action.candidateReview)
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'V2 no-op post-state binding is invalid.',
          })
        }
        return
      }
      if (
        action.importedReviewId !== action.expectedHeadReviewIdAfter ||
        action.importedReviewId !== action.expectedEffectiveReviewIdAfter ||
        action.reviewSha256 !== sha256Canonical(action.review) ||
        action.review.usedSupplementalMetadata !==
          (action.preImportItemState.supplementalMetadataRevealedAt !== null)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'V2 applied review identity, checksum, or local supplemental provenance is invalid.',
        })
      }
      if (
        action.action === 'import_initial' &&
        (action.expectedCurrentReviewId !== null || action.expectedEffectiveReviewId !== null)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'V2 initial import has prior review state.',
        })
      }
      if (
        action.action === 'import_revision' &&
        (action.expectedSupersedesReviewId !== action.expectedCurrentReviewId ||
          action.compensationAction !==
            (action.expectedEffectiveReviewId === null ? 'compensate_void' : 'compensate_restore'))
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'V2 revision/compensation linkage is invalid.',
        })
      }
    })
    if (plan.faultAfterAction !== undefined && plan.faultAfterAction > plan.actions.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'faultAfterAction is outside the V2 plan.',
      })
    }
  })
export type ImportPlanContentV2 = z.infer<typeof importPlanContentV2Schema>

export const importPlanV2Schema = z
  .object({ ...importPlanContentV2Schema.innerType().shape, binding: planBindingSchema })
  .strict()
export type ImportPlanV2 = z.infer<typeof importPlanV2Schema>

function planIdempotencyKeyV2(
  kind: 'import' | 'compensation',
  operationId: string,
  contentSha256: string,
) {
  return sha256Canonical({
    contentSha256,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    kind,
    operationId,
  })
}

export function bindImportPlanV2(input: ImportPlanContentV2): ImportPlanV2 {
  const content = importPlanContentV2Schema.parse(input)
  const contentSha256 = sha256Canonical(content)
  return importPlanV2Schema.parse({
    ...content,
    binding: {
      contentSha256,
      idempotencyKey: planIdempotencyKeyV2('import', content.operationId, contentSha256),
    },
  })
}

export function parseImportPlanV2(input: unknown): ImportPlanV2 {
  rejectLegacyPointerRewindRollback(input)
  const plan = importPlanV2Schema.parse(input)
  const { binding, ...content } = plan
  const parsedContent = importPlanContentV2Schema.parse(content)
  const contentSha256 = sha256Canonical(parsedContent)
  if (
    binding.contentSha256 !== contentSha256 ||
    binding.idempotencyKey !== planIdempotencyKeyV2('import', plan.operationId, contentSha256)
  ) {
    throw new Error('V2 import plan checksum or idempotency binding mismatch.')
  }
  return plan
}

const compensationActionCommon = {
  actionId: uuidSchema,
  datasetSplit: z.literal('development'),
  expectedCurrentReviewId: uuidSchema.nullable(),
  expectedEffectiveReviewId: uuidSchema.nullable(),
  importedReviewId: uuidSchema.nullable(),
  itemId: uuidSchema,
  pmid: pmidSchema,
  sequence: positiveIntegerSchema,
  sourceActionId: uuidSchema,
}

const compensateRestoreActionV2Schema = z
  .object({
    ...compensationActionCommon,
    action: z.literal('compensate_restore'),
    compensationReviewId: uuidSchema,
    effectiveSourceReviewId: uuidSchema,
    expectedCurrentReviewId: uuidSchema,
    expectedEffectiveReviewId: uuidSchema,
    expectedEffectiveReviewIdAfter: uuidSchema,
    expectedEventSequence: z.tuple([z.literal('review_compensated')]),
    expectedHeadReviewIdAfter: uuidSchema,
    expectedRevision: positiveIntegerSchema.refine((value) => value >= 2),
    expectedSupersedesReviewId: uuidSchema,
    importedReviewId: uuidSchema,
  })
  .strict()
const compensateVoidActionV2Schema = z
  .object({
    ...compensationActionCommon,
    action: z.literal('compensate_void'),
    compensationReviewId: uuidSchema,
    effectiveSourceReviewId: z.null(),
    expectedCurrentReviewId: uuidSchema,
    expectedEffectiveReviewId: uuidSchema,
    expectedEffectiveReviewIdAfter: z.null(),
    expectedEventSequence: z.tuple([z.literal('review_voided')]),
    expectedHeadReviewIdAfter: uuidSchema,
    expectedRevision: positiveIntegerSchema.refine((value) => value >= 2),
    expectedSupersedesReviewId: uuidSchema,
    importedReviewId: uuidSchema,
  })
  .strict()
const compensateNoopActionV2Schema = z
  .object({
    ...compensationActionCommon,
    action: z.literal('compensate_noop'),
    compensationReviewId: z.null(),
    effectiveSourceReviewId: uuidSchema.nullable(),
    expectedEffectiveReviewIdAfter: uuidSchema.nullable(),
    expectedEventSequence: z.tuple([]),
    expectedHeadReviewIdAfter: uuidSchema.nullable(),
    expectedRevision: z.null(),
    expectedSupersedesReviewId: z.null(),
    importedReviewId: z.null(),
  })
  .strict()

export const compensationActionV2Schema = z.discriminatedUnion('action', [
  compensateRestoreActionV2Schema,
  compensateVoidActionV2Schema,
  compensateNoopActionV2Schema,
])
export type CompensationActionV2 = z.infer<typeof compensationActionV2Schema>

const compensationCountsSchema = z
  .object({
    noops: z.number().int().nonnegative(),
    restored: z.number().int().nonnegative(),
    total: z.number().int().positive(),
    voided: z.number().int().nonnegative(),
  })
  .strict()

export const compensationPlanContentV2Schema = z
  .object({
    actions: z.array(compensationActionV2Schema).min(1).max(5000),
    batchId: uuidSchema,
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2),
    counts: compensationCountsSchema,
    executionContext: executionContextV2Schema,
    expectedEffectiveStateSha256: sha256Schema,
    expectedPhysicalStateSha256: sha256Schema,
    expectedPostEffectiveStateSha256: sha256Schema,
    faultAfterAction: positiveIntegerSchema.optional(),
    importPlanSha256: sha256Schema,
    importReceiptSha256: sha256Schema,
    kind: z.literal('compensation'),
    operationId: uuidSchema,
    scope: developmentScopeSchema,
    sourceArtifactSha256: sha256Schema,
    targetImportOperationId: uuidSchema,
    ...sourceEvidenceFields,
  })
  .strict()
  .superRefine((plan, context) => {
    const restored = plan.actions.filter((action) => action.action === 'compensate_restore').length
    const voided = plan.actions.filter((action) => action.action === 'compensate_void').length
    const noops = plan.actions.filter((action) => action.action === 'compensate_noop').length
    if (
      canonicalJson(plan.counts) !==
      canonicalJson({ noops, restored, total: plan.actions.length, voided })
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'V2 compensation counts do not match actions.',
      })
    }
    plan.actions.forEach((action, index) => {
      if (action.sequence !== index + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'V2 compensation sequence must be contiguous.',
        })
      }
      if (action.action === 'compensate_noop') {
        if (
          action.expectedHeadReviewIdAfter !== action.expectedCurrentReviewId ||
          action.expectedEffectiveReviewIdAfter !== action.expectedEffectiveReviewId ||
          action.effectiveSourceReviewId !== action.expectedEffectiveReviewId
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'V2 compensation no-op changes state.',
          })
        }
        return
      }
      if (
        action.expectedCurrentReviewId !== action.importedReviewId ||
        action.expectedEffectiveReviewId !== action.importedReviewId ||
        action.expectedSupersedesReviewId !== action.importedReviewId ||
        action.expectedHeadReviewIdAfter !== action.compensationReviewId ||
        (action.action === 'compensate_restore' &&
          action.expectedEffectiveReviewIdAfter !== action.effectiveSourceReviewId)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'V2 compensation linkage is invalid.',
        })
      }
    })
    for (const [values, message] of [
      [plan.actions.map((action) => action.actionId), 'V2 compensation action IDs must be unique.'],
      [
        plan.actions.map((action) => action.sourceActionId),
        'V2 compensation source IDs must be unique.',
      ],
      [plan.actions.map((action) => action.itemId), 'V2 compensation item IDs must be unique.'],
    ] as const) {
      if (new Set(values).size !== values.length)
        context.addIssue({ code: z.ZodIssueCode.custom, message })
    }
  })
export type CompensationPlanContentV2 = z.infer<typeof compensationPlanContentV2Schema>

export const compensationPlanV2Schema = z
  .object({ ...compensationPlanContentV2Schema.innerType().shape, binding: planBindingSchema })
  .strict()
export type CompensationPlanV2 = z.infer<typeof compensationPlanV2Schema>

export function bindCompensationPlanV2(input: CompensationPlanContentV2): CompensationPlanV2 {
  const content = compensationPlanContentV2Schema.parse(input)
  const contentSha256 = sha256Canonical(content)
  return compensationPlanV2Schema.parse({
    ...content,
    binding: {
      contentSha256,
      idempotencyKey: planIdempotencyKeyV2('compensation', content.operationId, contentSha256),
    },
  })
}

export function parseCompensationPlanV2(input: unknown): CompensationPlanV2 {
  rejectLegacyPointerRewindRollback(input)
  const plan = compensationPlanV2Schema.parse(input)
  const { binding, ...content } = plan
  const parsedContent = compensationPlanContentV2Schema.parse(content)
  const contentSha256 = sha256Canonical(parsedContent)
  if (
    binding.contentSha256 !== contentSha256 ||
    binding.idempotencyKey !== planIdempotencyKeyV2('compensation', plan.operationId, contentSha256)
  ) {
    throw new Error('V2 compensation plan checksum or idempotency binding mismatch.')
  }
  return plan
}

const authorizationActorFields = {
  authorizationId: uuidSchema,
  authorizationNote: z.string().trim().min(5).max(2000),
  authorized: z.literal(true),
  authorizedAt: timestampSchema,
  authorizedBy: z.string().trim().min(1).max(320),
}
const authorizationExecutionFields = {
  migrationId: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2),
  remoteWritesAllowed: z.literal(false),
  repositoryCommitSha: z.string().regex(/^[a-f0-9]{40}$/u),
  targetDatabase: z.literal('local'),
}
const authorizationBindingSchema = z.object({ contentSha256: sha256Schema }).strict()

export const importAuthorizationContentV2Schema = z
  .object({
    ...authorizationActorFields,
    ...authorizationExecutionFields,
    batchId: uuidSchema,
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2),
    expectedEffectiveStateSha256: sha256Schema,
    expectedPhysicalStateSha256: sha256Schema,
    expectedPostEffectiveStateSha256: sha256Schema,
    idempotencyKey: sha256Schema,
    kind: z.literal('import_authorization'),
    operationId: uuidSchema,
    planSha256: sha256Schema,
    sourceArtifactSha256: sha256Schema,
    ...sourceEvidenceFields,
  })
  .strict()
export type ImportAuthorizationContentV2 = z.infer<typeof importAuthorizationContentV2Schema>
export const importAuthorizationV2Schema = z
  .object({ ...importAuthorizationContentV2Schema.shape, binding: authorizationBindingSchema })
  .strict()
export type ImportAuthorizationV2 = z.infer<typeof importAuthorizationV2Schema>

export const compensationAuthorizationContentV2Schema = z
  .object({
    ...authorizationActorFields,
    ...authorizationExecutionFields,
    batchId: uuidSchema,
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2),
    expectedEffectiveStateSha256: sha256Schema,
    expectedPhysicalStateSha256: sha256Schema,
    expectedPostEffectiveStateSha256: sha256Schema,
    idempotencyKey: sha256Schema,
    importReceiptSha256: sha256Schema,
    kind: z.literal('compensation_authorization'),
    operationId: uuidSchema,
    planSha256: sha256Schema,
    sourceArtifactSha256: sha256Schema,
    targetImportOperationId: uuidSchema,
    ...sourceEvidenceFields,
  })
  .strict()
export type CompensationAuthorizationContentV2 = z.infer<
  typeof compensationAuthorizationContentV2Schema
>
export const compensationAuthorizationV2Schema = z
  .object({
    ...compensationAuthorizationContentV2Schema.shape,
    binding: authorizationBindingSchema,
  })
  .strict()
export type CompensationAuthorizationV2 = z.infer<typeof compensationAuthorizationV2Schema>

export const recoveryAuthorizationContentV2Schema = z
  .object({
    ...authorizationActorFields,
    ...authorizationExecutionFields,
    batchId: uuidSchema,
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2),
    kind: z.literal('recovery_authorization'),
    observedEffectiveStateSha256: sha256Schema,
    observedPhysicalStateSha256: sha256Schema,
    permitsMutation: z.literal(false),
    recoveryAction: z.enum(['resolve_ambiguous_import', 'resolve_ambiguous_compensation']),
    targetIdempotencyKey: sha256Schema,
    targetOperationId: uuidSchema,
    targetPlanSha256: sha256Schema,
  })
  .strict()
export type RecoveryAuthorizationContentV2 = z.infer<typeof recoveryAuthorizationContentV2Schema>
export const recoveryAuthorizationV2Schema = z
  .object({ ...recoveryAuthorizationContentV2Schema.shape, binding: authorizationBindingSchema })
  .strict()
export type RecoveryAuthorizationV2 = z.infer<typeof recoveryAuthorizationV2Schema>

function bindAuthorizationV2<T extends object>(content: T) {
  return { ...content, binding: { contentSha256: sha256Canonical(content) } }
}

function parseBoundAuthorizationV2<T extends { binding: { contentSha256: string } }>(
  input: unknown,
  schema: z.ZodType<T>,
  contentSchema: z.ZodType<object>,
): T {
  const authorization = schema.parse(input)
  const { binding, ...content } = authorization
  const parsedContent = contentSchema.parse(content)
  if (binding.contentSha256 !== sha256Canonical(parsedContent)) {
    throw new Error('V2 authorization checksum mismatch.')
  }
  return authorization
}

export function bindImportAuthorizationV2(
  input: ImportAuthorizationContentV2,
): ImportAuthorizationV2 {
  const content = importAuthorizationContentV2Schema.parse(input)
  return importAuthorizationV2Schema.parse(bindAuthorizationV2(content))
}
export function parseImportAuthorizationV2(input: unknown): ImportAuthorizationV2 {
  return parseBoundAuthorizationV2(
    input,
    importAuthorizationV2Schema,
    importAuthorizationContentV2Schema,
  )
}
export function bindCompensationAuthorizationV2(
  input: CompensationAuthorizationContentV2,
): CompensationAuthorizationV2 {
  const content = compensationAuthorizationContentV2Schema.parse(input)
  return compensationAuthorizationV2Schema.parse(bindAuthorizationV2(content))
}
export function parseCompensationAuthorizationV2(input: unknown): CompensationAuthorizationV2 {
  return parseBoundAuthorizationV2(
    input,
    compensationAuthorizationV2Schema,
    compensationAuthorizationContentV2Schema,
  )
}
export function bindRecoveryAuthorizationV2(
  input: RecoveryAuthorizationContentV2,
): RecoveryAuthorizationV2 {
  const content = recoveryAuthorizationContentV2Schema.parse(input)
  return recoveryAuthorizationV2Schema.parse(bindAuthorizationV2(content))
}
export function parseRecoveryAuthorizationV2(input: unknown): RecoveryAuthorizationV2 {
  return parseBoundAuthorizationV2(
    input,
    recoveryAuthorizationV2Schema,
    recoveryAuthorizationContentV2Schema,
  )
}

export function assertImportAuthorizationMatchesPlanV2(
  planInput: unknown,
  authorizationInput: unknown,
): { authorization: ImportAuthorizationV2; plan: ImportPlanV2 } {
  const plan = parseImportPlanV2(planInput)
  const authorization = parseImportAuthorizationV2(authorizationInput)
  const expected = {
    batchId: plan.batchId,
    booleanNormalizationLedgerSha256: plan.booleanNormalizationLedgerSha256,
    expectedEffectiveStateSha256: plan.expectedEffectiveStateSha256,
    expectedPhysicalStateSha256: plan.expectedPhysicalStateSha256,
    expectedPostEffectiveStateSha256: plan.expectedPostEffectiveStateSha256,
    idempotencyKey: plan.binding.idempotencyKey,
    migrationId: plan.executionContext.migrationId,
    noteDispositionAuditSha256: plan.noteDispositionAuditSha256,
    operationId: plan.operationId,
    orderedSetNormalizationLedgerSha256: plan.orderedSetNormalizationLedgerSha256,
    planSha256: plan.binding.contentSha256,
    remoteWritesAllowed: plan.executionContext.remoteWritesAllowed,
    repositoryCommitSha: plan.executionContext.repositoryCommitSha,
    sourceArtifactSha256: plan.sourceArtifactSha256,
    sourceAuthorizationSetSha256: plan.sourceAuthorizationSetSha256,
    targetDatabase: plan.executionContext.targetDatabase,
  }
  for (const [key, value] of Object.entries(expected)) {
    if (authorization[key as keyof ImportAuthorizationV2] !== value) {
      throw new Error(`V2 import authorization does not match plan field ${key}.`)
    }
  }
  return { authorization, plan }
}

export function assertCompensationAuthorizationMatchesPlanV2(
  planInput: unknown,
  authorizationInput: unknown,
): { authorization: CompensationAuthorizationV2; plan: CompensationPlanV2 } {
  const plan = parseCompensationPlanV2(planInput)
  const authorization = parseCompensationAuthorizationV2(authorizationInput)
  const expected = {
    batchId: plan.batchId,
    booleanNormalizationLedgerSha256: plan.booleanNormalizationLedgerSha256,
    expectedEffectiveStateSha256: plan.expectedEffectiveStateSha256,
    expectedPhysicalStateSha256: plan.expectedPhysicalStateSha256,
    expectedPostEffectiveStateSha256: plan.expectedPostEffectiveStateSha256,
    idempotencyKey: plan.binding.idempotencyKey,
    importReceiptSha256: plan.importReceiptSha256,
    migrationId: plan.executionContext.migrationId,
    noteDispositionAuditSha256: plan.noteDispositionAuditSha256,
    operationId: plan.operationId,
    orderedSetNormalizationLedgerSha256: plan.orderedSetNormalizationLedgerSha256,
    planSha256: plan.binding.contentSha256,
    remoteWritesAllowed: plan.executionContext.remoteWritesAllowed,
    repositoryCommitSha: plan.executionContext.repositoryCommitSha,
    sourceArtifactSha256: plan.sourceArtifactSha256,
    sourceAuthorizationSetSha256: plan.sourceAuthorizationSetSha256,
    targetDatabase: plan.executionContext.targetDatabase,
    targetImportOperationId: plan.targetImportOperationId,
  }
  for (const [key, value] of Object.entries(expected)) {
    if (authorization[key as keyof CompensationAuthorizationV2] !== value) {
      throw new Error(`V2 compensation authorization does not match plan field ${key}.`)
    }
  }
  return { authorization, plan }
}

const receiptCountsSchema = z
  .object({
    applied: z.number().int().nonnegative(),
    noops: z.number().int().nonnegative(),
    planned: z.number().int().nonnegative(),
  })
  .strict()
const importReceiptActionCountsSchema = importCountsSchema
const compensationReceiptActionCountsSchema = compensationCountsSchema
const receiptBindingSchema = z.object({ contentSha256: sha256Schema }).strict()
const receiptCommonShape = {
  afterEffectiveStateSha256: sha256Schema,
  afterPhysicalStateSha256: sha256Schema,
  batchId: uuidSchema,
  beforeEffectiveStateSha256: sha256Schema,
  beforePhysicalStateSha256: sha256Schema,
  ...sourceEvidenceFields,
  contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2),
  counts: receiptCountsSchema,
  error: z.string().nullable(),
  eventSequence: z.array(goldReviewOperationEventTypeSchema).max(5002),
  idempotencyKey: sha256Schema,
  migrationId: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2),
  operationId: uuidSchema,
  outcome: z.enum(['committed', 'failed']),
  planSha256: sha256Schema,
  response: z.enum(['applied', 'idempotent_replay', 'ambiguous_after_commit']),
}
type TerminalReceiptCandidateV2 = {
  afterEffectiveStateSha256: string
  afterPhysicalStateSha256: string
  beforeEffectiveStateSha256: string
  beforePhysicalStateSha256: string
  counts: { applied: number; noops: number; planned: number }
  error: string | null
  eventSequence: z.infer<typeof goldReviewOperationEventTypeSchema>[]
  outcome: 'committed' | 'failed'
}

function validateTerminalReceiptV2(
  receipt: TerminalReceiptCandidateV2,
  operationKind: 'import' | 'compensation',
  context: z.RefinementCtx,
): void {
  const started = operationKind === 'import' ? 'import_started' : 'import_compensation_started'
  const completed =
    operationKind === 'import' ? 'import_completed' : 'import_compensation_completed'
  const failed = operationKind === 'import' ? 'import_failed' : 'import_compensation_failed'
  const appliedEvents =
    operationKind === 'import'
      ? new Set(['review_imported'])
      : new Set(['review_compensated', 'review_voided'])
  const invalid = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message })
  if (receipt.afterPhysicalStateSha256 === receipt.beforePhysicalStateSha256) {
    invalid('A terminal V2 operation must append physical audit state.')
  }
  if (receipt.outcome === 'failed') {
    if (
      receipt.counts.applied !== 0 ||
      receipt.counts.noops !== 0 ||
      receipt.error === null ||
      receipt.beforeEffectiveStateSha256 !== receipt.afterEffectiveStateSha256 ||
      canonicalJson(receipt.eventSequence) !== canonicalJson([started, failed])
    ) {
      invalid('Failed V2 receipt does not prove atomic effective-state rollback.')
    }
    return
  }
  const middleEvents = receipt.eventSequence.slice(1, -1)
  if (
    receipt.error !== null ||
    receipt.counts.applied !== receipt.counts.planned ||
    receipt.eventSequence.length !== receipt.counts.applied + 2 ||
    receipt.eventSequence[0] !== started ||
    receipt.eventSequence.at(-1) !== completed ||
    middleEvents.some((event) => !appliedEvents.has(event))
  ) {
    invalid('Committed V2 receipt counts or event sequence is inconsistent.')
  }
}

type ImportReceiptCountCandidateV2 = TerminalReceiptCandidateV2 & {
  actionCounts: z.infer<typeof importReceiptActionCountsSchema>
}

function validateImportReceiptCountsV2(
  receipt: ImportReceiptCountCandidateV2,
  context: z.RefinementCtx,
): void {
  validateTerminalReceiptV2(receipt, 'import', context)
  if (
    receipt.actionCounts.initial + receipt.actionCounts.revisions !==
      receipt.actionCounts.inserts ||
    receipt.actionCounts.inserts + receipt.actionCounts.noops !== receipt.actionCounts.total ||
    receipt.counts.planned !== receipt.actionCounts.inserts ||
    (receipt.outcome === 'committed' && receipt.counts.noops !== receipt.actionCounts.noops)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'V2 import receipt does not carry the sealed dynamic action partition.',
    })
  }
}

type CompensationReceiptCountCandidateV2 = TerminalReceiptCandidateV2 & {
  actionCounts: z.infer<typeof compensationReceiptActionCountsSchema>
}

function validateCompensationReceiptCountsV2(
  receipt: CompensationReceiptCountCandidateV2,
  context: z.RefinementCtx,
): void {
  validateTerminalReceiptV2(receipt, 'compensation', context)
  if (
    receipt.actionCounts.restored + receipt.actionCounts.voided + receipt.actionCounts.noops !==
      receipt.actionCounts.total ||
    receipt.counts.planned !== receipt.actionCounts.restored + receipt.actionCounts.voided ||
    (receipt.outcome === 'committed' && receipt.counts.noops !== receipt.actionCounts.noops)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'V2 compensation receipt does not carry the sealed dynamic action partition.',
    })
  }
}

const importReceiptContentV2Shape = {
  ...receiptCommonShape,
  actionCounts: importReceiptActionCountsSchema,
  kind: z.literal('import_receipt'),
}
const importReceiptContentV2Schema = z
  .object(importReceiptContentV2Shape)
  .strict()
  .superRefine(validateImportReceiptCountsV2)
export const importReceiptV2Schema = z
  .object({ ...importReceiptContentV2Shape, binding: receiptBindingSchema })
  .strict()
  .superRefine(validateImportReceiptCountsV2)
export type ImportReceiptV2 = z.infer<typeof importReceiptV2Schema>
const compensationReceiptContentV2Shape = {
  ...receiptCommonShape,
  actionCounts: compensationReceiptActionCountsSchema,
  kind: z.literal('compensation_receipt'),
  targetImportOperationId: uuidSchema,
}
const compensationReceiptContentV2Schema = z
  .object(compensationReceiptContentV2Shape)
  .strict()
  .superRefine(validateCompensationReceiptCountsV2)
export const compensationReceiptV2Schema = z
  .object({ ...compensationReceiptContentV2Shape, binding: receiptBindingSchema })
  .strict()
  .superRefine(validateCompensationReceiptCountsV2)
export type CompensationReceiptV2 = z.infer<typeof compensationReceiptV2Schema>

function receiptIdentityV2<T extends { response: string }>(content: T) {
  return Object.fromEntries(Object.entries(content).filter(([key]) => key !== 'response'))
}

function parseReceiptV2<T extends { binding: { contentSha256: string }; response: string }>(
  input: unknown,
  schema: z.ZodType<T>,
  contentSchema: z.ZodType<object>,
  label: string,
): T {
  const receipt = schema.parse(input)
  const { binding, ...content } = receipt
  const parsedContent = contentSchema.parse(content) as { response: string }
  if (binding.contentSha256 !== sha256Canonical(receiptIdentityV2(parsedContent))) {
    throw new Error(`${label} receipt checksum mismatch.`)
  }
  return receipt
}

export function parseImportReceiptV2(input: unknown): ImportReceiptV2 {
  return parseReceiptV2(input, importReceiptV2Schema, importReceiptContentV2Schema, 'V2 import')
}
export function parseCompensationReceiptV2(input: unknown): CompensationReceiptV2 {
  return parseReceiptV2(
    input,
    compensationReceiptV2Schema,
    compensationReceiptContentV2Schema,
    'V2 compensation',
  )
}

// The longer names above are canonical; these aliases keep rehearsal call sites parallel to V1.
export const bindImportAuthorization = bindImportAuthorizationV2
export const bindCompensationAuthorization = bindCompensationAuthorizationV2
export const bindRecoveryAuthorization = bindRecoveryAuthorizationV2
