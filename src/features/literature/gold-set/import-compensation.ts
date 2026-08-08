import { createHash } from 'node:crypto'

import { z } from 'zod'

export const GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION =
  'gold-review-import-compensation/1.0.0' as const
export const LEGACY_POINTER_REWIND_ERROR =
  'Legacy pointer-rewind rollback is unsupported; compensation must append a new chain head.'

const uuidSchema = z
  .string()
  .uuid()
  .refine((value) => value === value.toLowerCase(), 'UUIDs must use canonical lowercase text.')
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u)
const pmidSchema = z.string().regex(/^[0-9]{1,12}$/u)
const positiveIntegerSchema = z.number().int().positive()
const timestampSchema = z.string().datetime({ offset: true })

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new Error('Canonical JSON does not support non-finite numbers.')
    return value
  }
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (typeof value !== 'object') {
    throw new Error(`Canonical JSON does not support ${typeof value} values.`)
  }
  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => {
        if (record[key] === undefined) {
          throw new Error(`Canonical JSON does not support undefined at ${key}.`)
        }
        return [key, canonicalValue(record[key])]
      }),
  )
}

/** Recursive sorted-key JSON. Arrays retain order; output contains no insignificant whitespace. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value))
}

export function sha256Canonical(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

const canonicalStringArraySchema = (maximum: number) =>
  z
    .array(z.string().trim().min(1).max(160))
    .max(maximum)
    .refine((values) => new Set(values).size === values.length, 'Values must be unique.')

const GOLD_IMPORT_TOPIC_IDS = [
  'basic-bronchoscopy',
  'ebus-mediastinal-staging',
  'peripheral-navigation',
  'peripheral-biopsy-localization',
  'central-airway-obstruction',
  'airway-stents-stenosis',
  'pleural-interventions',
  'bronchoscopic-lung-volume-reduction',
  'persistent-air-leak-fistula',
  'transbronchial-cryobiopsy',
  'hemoptysis-airway-bleeding',
  'tracheostomy-airway-access',
  'bronchoscopic-tumor-ablation',
  'other-advanced-bronchoscopy',
  'safety-anesthesia-complications',
  'education-simulation-quality',
  'ai-imaging-technology',
  'adjacent-surgical-procedural-analogue',
  'specimen-adequacy-molecular-pathology',
  'health-services-economics',
] as const
const GOLD_IMPORT_TECHNOLOGY_TAGS = [
  'convex-ebus',
  'eus-b',
  'radial-ebus',
  'robotic-bronchoscopy',
  'electromagnetic-navigation',
  'cone-beam-ct',
  'augmented-fluoroscopy',
  'virtual-bronchoscopy',
  'transbronchial-cryobiopsy',
  'endobronchial-valve',
  'airway-stent',
  'rigid-bronchoscopy',
  'electrocautery',
  'argon-plasma-coagulation',
  'laser',
  'cryotherapy',
  'photodynamic-therapy',
  'brachytherapy',
  'indwelling-pleural-catheter',
  'medical-thoracoscopy',
  'bronchial-thermoplasty',
  'whole-lung-lavage',
  'percutaneous-tracheostomy',
  'thoracentesis',
  'chest-tube',
  'pleurodesis',
  'bronchoalveolar-lavage',
  'conventional-tbna',
  'rapid-on-site-evaluation',
  'endobronchial-coils',
  'balloon-bronchoplasty',
  'mediastinal-cryobiopsy',
  'foreign-body-removal',
  'bronchial-artery-embolization',
  'narrow-band-imaging',
  'autofluorescence-bronchoscopy',
  'confocal-laser-endomicroscopy',
  'topical-hemostatic-agent',
  'transbronchial-thermal-ablation',
  'surgical-vats',
] as const
const GOLD_IMPORT_CLINICAL_PURPOSES = [
  'diagnosis',
  'staging',
  'treatment',
  'palliation',
  'surveillance',
  'localization',
  'training',
  'safety-complication-prevention',
  'multiple-general-overview',
  'not-assessable-from-available-metadata',
  'cost-effectiveness-health-services',
  'specimen-adequacy',
  'workflow-operations-quality',
] as const
const GOLD_IMPORT_DISEASE_TAGS = [
  'lung-cancer',
  'mesothelioma',
  'emphysema',
  'interstitial-lung-disease',
  'immune-inflammatory-disease',
  'infection',
  'transplant',
  'benign-airway-stenosis',
  'pleural-disease',
  'lymphoma-hematologic-malignancy',
  'metastatic-extrathoracic-malignancy',
  'tracheobronchomalacia-edac',
  'asthma',
  'foreign-body-aspiration',
  'hemoptysis',
  'bronchiectasis',
  'pulmonary-alveolar-proteinosis',
  'airway-amyloidosis',
  'congenital-airway-disorder',
] as const
const GOLD_IMPORT_STUDY_DESIGNS = [
  'randomized-trial',
  'prospective-cohort',
  'retrospective-cohort',
  'diagnostic-accuracy',
  'systematic-review',
  'meta-analysis',
  'guideline',
  'consensus',
  'case-series',
  'case-report',
  'technical-note',
  'editorial',
  'review-article',
  'not-assessable-from-available-metadata',
  'cross-sectional-survey',
  'economic-evaluation',
  'animal-preclinical',
  'bench-in-vitro',
  'qualitative-study',
  'case-control',
] as const
const GOLD_IMPORT_PUBLICATION_STATUSES = [
  'full-article',
  'conference-abstract',
  'letter',
  'editorial',
  'correction',
  'retraction',
  'protocol',
  'interactive-clinical-case',
  'not-assessable-from-available-metadata',
] as const

const controlledStringArraySchema = (maximum: number, allowed: readonly string[]) =>
  canonicalStringArraySchema(maximum).refine(
    (values) => values.every((value) => allowed.includes(value)),
    'Value is not in the taxonomy 2.0 controlled vocabulary.',
  )

export const goldReviewPayloadSchema = z
  .object({
    relevanceLabel: z.enum(['include_core', 'include_adjacent', 'exclude', 'uncertain']),
    metadataSufficiency: z.enum([
      'adequate_abstract',
      'limited_abstract',
      'no_abstract',
      'conflicting_metadata',
    ]),
    reviewerConfidence: z.enum(['high', 'moderate', 'low']),
    topicIds: controlledStringArraySchema(100, GOLD_IMPORT_TOPIC_IDS),
    technologyTags: controlledStringArraySchema(100, GOLD_IMPORT_TECHNOLOGY_TAGS),
    technologyTagStatus: z.enum(['tagged', 'not_applicable', 'not_assessable']),
    clinicalPurposes: controlledStringArraySchema(30, GOLD_IMPORT_CLINICAL_PURPOSES),
    diseaseTags: controlledStringArraySchema(30, GOLD_IMPORT_DISEASE_TAGS),
    diseaseTagStatus: z.enum(['tagged', 'not_applicable', 'not_assessable']),
    studyDesign: z.enum(GOLD_IMPORT_STUDY_DESIGNS).nullable(),
    publicationStatus: z.enum(GOLD_IMPORT_PUBLICATION_STATUSES).nullable(),
    categorizationFromFullText: z.boolean(),
    notes: z.string().max(4000),
    usedSupplementalMetadata: z.boolean(),
    reviewSeconds: z.number().int().min(0).max(86400),
    taxonomyVersion: z.string().trim().min(1),
    labelSchemaVersion: z.string().trim().min(1),
    enrichmentSchemaVersion: z.string().trim().min(1),
    enrichmentProvenance: z.string().trim().min(1),
    reviewerUserId: uuidSchema.nullable(),
    reviewerEmail: z.string().trim().min(1).max(320).nullable(),
    isBlinded: z.boolean(),
    startedAt: timestampSchema,
    completedAt: timestampSchema,
    createdAt: timestampSchema,
  })
  .strict()
  .superRefine((review, context) => {
    const included = ['include_core', 'include_adjacent'].includes(review.relevanceLabel)
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
        review.publicationStatus === null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Included reviews need topic, purpose, study design, and publication status.',
      })
    }
    if (!included && (categorized || review.categorizationFromFullText)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Excluded/uncertain reviews cannot carry categorization.',
      })
    }
    for (const [values, status, field] of [
      [review.technologyTags, review.technologyTagStatus, 'technologyTagStatus'],
      [review.diseaseTags, review.diseaseTagStatus, 'diseaseTagStatus'],
    ] as const) {
      if (values.length > 0 !== (status === 'tagged')) {
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
export type GoldReviewPayload = z.infer<typeof goldReviewPayloadSchema>

const canonicalClinicalArraySchema = (maximum: number, allowed: readonly string[]) =>
  controlledStringArraySchema(maximum, allowed).refine(
    (values) => values.every((value, index) => index === 0 || values[index - 1] <= value),
    'Clinical projection arrays must use ascending canonical order.',
  )

export const goldReviewClinicalProjectionSchema = z
  .object({
    relevanceLabel: z.enum(['include_core', 'include_adjacent', 'exclude', 'uncertain']),
    metadataSufficiency: z.enum([
      'adequate_abstract',
      'limited_abstract',
      'no_abstract',
      'conflicting_metadata',
    ]),
    reviewerConfidence: z.enum(['high', 'moderate', 'low']),
    topicIds: canonicalClinicalArraySchema(100, GOLD_IMPORT_TOPIC_IDS),
    technologyTags: canonicalClinicalArraySchema(100, GOLD_IMPORT_TECHNOLOGY_TAGS),
    technologyTagStatus: z.enum(['tagged', 'not_applicable', 'not_assessable']),
    clinicalPurposes: canonicalClinicalArraySchema(30, GOLD_IMPORT_CLINICAL_PURPOSES),
    diseaseTags: canonicalClinicalArraySchema(30, GOLD_IMPORT_DISEASE_TAGS),
    diseaseTagStatus: z.enum(['tagged', 'not_applicable', 'not_assessable']),
    studyDesign: z.enum(GOLD_IMPORT_STUDY_DESIGNS).nullable(),
    publicationStatus: z.enum(GOLD_IMPORT_PUBLICATION_STATUSES).nullable(),
    categorizationFromFullText: z.boolean(),
    notes: z.string().max(4000),
    usedSupplementalMetadata: z.boolean(),
    reviewSeconds: z.number().int().min(0).max(86400),
    taxonomyVersion: z.string().trim().min(1),
    labelSchemaVersion: z.string().trim().min(1),
    enrichmentSchemaVersion: z.string().trim().min(1),
    enrichmentProvenance: z.string().trim().min(1),
    isBlinded: z.boolean(),
  })
  .strict()
export type GoldReviewClinicalProjection = z.infer<typeof goldReviewClinicalProjectionSchema>

export function goldReviewClinicalProjection(
  review: GoldReviewPayload,
): GoldReviewClinicalProjection {
  return goldReviewClinicalProjectionSchema.parse({
    relevanceLabel: review.relevanceLabel,
    metadataSufficiency: review.metadataSufficiency,
    reviewerConfidence: review.reviewerConfidence,
    topicIds: [...review.topicIds].sort(),
    technologyTags: [...review.technologyTags].sort(),
    technologyTagStatus: review.technologyTagStatus,
    clinicalPurposes: [...review.clinicalPurposes].sort(),
    diseaseTags: [...review.diseaseTags].sort(),
    diseaseTagStatus: review.diseaseTagStatus,
    studyDesign: review.studyDesign,
    publicationStatus: review.publicationStatus,
    categorizationFromFullText: review.categorizationFromFullText,
    notes: review.notes,
    usedSupplementalMetadata: review.usedSupplementalMetadata,
    reviewSeconds: review.reviewSeconds,
    taxonomyVersion: review.taxonomyVersion,
    labelSchemaVersion: review.labelSchemaVersion,
    enrichmentSchemaVersion: review.enrichmentSchemaVersion,
    enrichmentProvenance: review.enrichmentProvenance,
    isBlinded: review.isBlinded,
  })
}

export const goldReviewOperationEventTypeSchema = z.enum([
  'import_started',
  'review_imported',
  'import_completed',
  'import_failed',
  'import_compensation_started',
  'review_compensated',
  'review_voided',
  'import_compensation_completed',
  'import_compensation_failed',
])
export type GoldReviewOperationEventType = z.infer<typeof goldReviewOperationEventTypeSchema>
export type GoldReviewRehearsalEventType =
  | GoldReviewOperationEventType
  | 'ordinary_review_completed'

const importActionCommon = {
  actionId: uuidSchema,
  sequence: positiveIntegerSchema,
  itemId: uuidSchema,
  pmid: pmidSchema,
  datasetSplit: z.literal('development'),
  expectedCurrentReviewId: uuidSchema.nullable(),
  expectedEffectiveReviewId: uuidSchema.nullable(),
  preImportItemState: z
    .object({
      reviewStatus: z.enum(['pending', 'in_progress', 'return_later', 'completed']),
      startedAt: timestampSchema.nullable(),
      completedAt: timestampSchema.nullable(),
      supplementalMetadataRevealedAt: timestampSchema.nullable(),
      automatedSignalsRevealedAt: timestampSchema.nullable(),
    })
    .strict(),
}

const importInitialActionSchema = z
  .object({
    ...importActionCommon,
    action: z.literal('import_initial'),
    expectedCurrentReviewId: z.null(),
    expectedEffectiveReviewId: z.null(),
    expectedRevision: z.literal(1),
    expectedSupersedesReviewId: z.null(),
    importedReviewId: uuidSchema,
    expectedHeadReviewIdAfter: uuidSchema,
    expectedEffectiveReviewIdAfter: uuidSchema,
    review: goldReviewPayloadSchema,
    reviewSha256: sha256Schema,
    compensationAction: z.literal('compensate_void'),
    expectedEventSequence: z.tuple([z.literal('review_imported')]),
  })
  .strict()

const importRevisionActionSchema = z
  .object({
    ...importActionCommon,
    action: z.literal('import_revision'),
    expectedCurrentReviewId: uuidSchema,
    expectedRevision: positiveIntegerSchema.refine((value) => value >= 2),
    expectedSupersedesReviewId: uuidSchema,
    importedReviewId: uuidSchema,
    expectedHeadReviewIdAfter: uuidSchema,
    expectedEffectiveReviewIdAfter: uuidSchema,
    review: goldReviewPayloadSchema,
    reviewSha256: sha256Schema,
    compensationAction: z.enum(['compensate_restore', 'compensate_void']),
    expectedEventSequence: z.tuple([z.literal('review_imported')]),
  })
  .strict()

const importNoopActionSchema = z
  .object({
    ...importActionCommon,
    action: z.literal('import_noop'),
    expectedRevision: z.null(),
    expectedSupersedesReviewId: z.null(),
    importedReviewId: z.null(),
    expectedHeadReviewIdAfter: uuidSchema.nullable(),
    expectedEffectiveReviewIdAfter: uuidSchema.nullable(),
    candidateReview: goldReviewClinicalProjectionSchema.nullable(),
    candidateReviewSha256: sha256Schema,
    compensationAction: z.literal('compensate_noop'),
    expectedEventSequence: z.tuple([]),
  })
  .strict()

export const importActionSchema = z.discriminatedUnion('action', [
  importInitialActionSchema,
  importRevisionActionSchema,
  importNoopActionSchema,
])
export type ImportAction = z.infer<typeof importActionSchema>

const planBindingSchema = z
  .object({ contentSha256: sha256Schema, idempotencyKey: sha256Schema })
  .strict()

const developmentScopeSchema = z
  .object({
    datasetSplit: z.literal('development'),
    heldOutIdentitiesAccessed: z.literal(false),
    developmentMembershipSha256: sha256Schema,
  })
  .strict()

const importCountsSchema = z
  .object({
    total: z.number().int().nonnegative(),
    initial: z.number().int().nonnegative(),
    revisions: z.number().int().nonnegative(),
    noops: z.number().int().nonnegative(),
    inserts: z.number().int().nonnegative(),
  })
  .strict()

const compensationCountsSchema = z
  .object({
    total: z.number().int().nonnegative(),
    restored: z.number().int().nonnegative(),
    voided: z.number().int().nonnegative(),
    noops: z.number().int().nonnegative(),
  })
  .strict()

const executionContextSchema = z
  .object({
    targetDatabase: z.literal('local'),
    remoteWritesAllowed: z.literal(false),
    repositoryCommitSha: z.string().regex(/^[a-f0-9]{40}$/u),
    migrationId: z.literal('20260808035633_add_literature_gold_import_compensation_contract'),
    importRpc: z.literal('apply_literature_gold_import_v1'),
    compensationRpc: z.literal('compensate_literature_gold_import_v1'),
    reconciliationRpc: z.literal('reconcile_literature_gold_review_operation_v1'),
    developmentMembershipHash: z.literal('literature_gold_development_membership_hash_v1'),
    physicalStateHash: z.literal('literature_gold_physical_state_hash_v1'),
    effectiveStateHash: z.literal('literature_gold_effective_state_hash_v1'),
  })
  .strict()

export const importPlanContentSchema = z
  .object({
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION),
    kind: z.literal('import'),
    operationId: uuidSchema,
    batchId: uuidSchema,
    sourceArtifactSha256: sha256Schema,
    sourceAuthorizationSetSha256: sha256Schema,
    expectedPhysicalStateSha256: sha256Schema,
    expectedEffectiveStateSha256: sha256Schema,
    expectedPostEffectiveStateSha256: sha256Schema,
    executionContext: executionContextSchema,
    scope: developmentScopeSchema,
    counts: importCountsSchema,
    actions: z.array(importActionSchema).min(1).max(5000),
    faultAfterAction: positiveIntegerSchema.optional(),
  })
  .strict()
  .superRefine((plan, context) => {
    const initial = plan.actions.filter((action) => action.action === 'import_initial').length
    const revisions = plan.actions.filter((action) => action.action === 'import_revision').length
    const noops = plan.actions.filter((action) => action.action === 'import_noop').length
    const expected = {
      total: plan.actions.length,
      initial,
      revisions,
      noops,
      inserts: initial + revisions,
    }
    if (canonicalJson(plan.counts) !== canonicalJson(expected)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Import action counts do not match the plan.',
      })
    }
    const itemIds = plan.actions.map((action) => action.itemId)
    if (new Set(itemIds).size !== itemIds.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Import item IDs must be unique.' })
    }
    const actionIds = plan.actions.map((action) => action.actionId)
    if (new Set(actionIds).size !== actionIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Import action IDs must be unique.',
      })
    }
    const importedReviewIds = plan.actions.flatMap((action) =>
      action.action === 'import_noop' ? [] : [action.importedReviewId],
    )
    if (new Set(importedReviewIds).size !== importedReviewIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Imported review IDs must be unique.',
      })
    }
    if (plan.faultAfterAction !== undefined && plan.faultAfterAction > plan.actions.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'faultAfterAction must identify an action in the plan.',
      })
    }
    plan.actions.forEach((action, index) => {
      if (action.sequence !== index + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Import action sequence must be contiguous.',
        })
      }
      if (action.action !== 'import_noop') {
        if (
          action.importedReviewId !== action.expectedHeadReviewIdAfter ||
          action.importedReviewId !== action.expectedEffectiveReviewIdAfter
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Imported review must become head and effective review.',
          })
        }
        if (action.reviewSha256 !== sha256Canonical(action.review)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Import review checksum mismatch.',
          })
        }
        if (
          action.review.usedSupplementalMetadata !==
            (action.preImportItemState.supplementalMetadataRevealedAt !== null) ||
          action.review.isBlinded !==
            (action.preImportItemState.automatedSignalsRevealedAt === null) ||
          (action.action === 'import_initial' && !action.review.isBlinded)
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Import review reveal/blinding state does not match the item pre-state.',
          })
        }
      } else if (
        action.expectedHeadReviewIdAfter !== action.expectedCurrentReviewId ||
        action.expectedEffectiveReviewIdAfter !== action.expectedEffectiveReviewId
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'No-op cannot change head or effective review.',
        })
      }
      if (
        action.action === 'import_noop' &&
        action.candidateReviewSha256 !== sha256Canonical(action.candidateReview)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'No-op clinical candidate checksum mismatch.',
        })
      }
      if (action.action === 'import_revision') {
        if (action.expectedSupersedesReviewId !== action.expectedCurrentReviewId) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Revision must supersede the current head.',
          })
        }
        const expectedCompensation = action.expectedEffectiveReviewId
          ? 'compensate_restore'
          : 'compensate_void'
        if (action.compensationAction !== expectedCompensation) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Revision compensation does not match prior effective state.',
          })
        }
      }
    })
  })
export type ImportPlanContent = z.infer<typeof importPlanContentSchema>

export const importPlanSchema = z
  .object({
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION),
    kind: z.literal('import'),
    operationId: uuidSchema,
    batchId: uuidSchema,
    sourceArtifactSha256: sha256Schema,
    sourceAuthorizationSetSha256: sha256Schema,
    expectedPhysicalStateSha256: sha256Schema,
    expectedEffectiveStateSha256: sha256Schema,
    expectedPostEffectiveStateSha256: sha256Schema,
    executionContext: executionContextSchema,
    scope: developmentScopeSchema,
    counts: importCountsSchema,
    actions: z.array(importActionSchema).min(1).max(5000),
    faultAfterAction: positiveIntegerSchema.optional(),
    binding: planBindingSchema,
  })
  .strict()
export type ImportPlan = z.infer<typeof importPlanSchema>

function planIdempotencyKey(
  kind: 'import' | 'compensation',
  operationId: string,
  contentSha256: string,
) {
  return sha256Canonical({
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    kind,
    operationId,
    contentSha256,
  })
}

export function bindImportPlan(input: ImportPlanContent): ImportPlan {
  const content = importPlanContentSchema.parse(input)
  const contentSha256 = sha256Canonical(content)
  return importPlanSchema.parse({
    ...content,
    binding: {
      contentSha256,
      idempotencyKey: planIdempotencyKey('import', content.operationId, contentSha256),
    },
  })
}

export function parseImportPlan(input: unknown): ImportPlan {
  rejectLegacyPointerRewindRollback(input)
  const plan = importPlanSchema.parse(input)
  const { binding, ...content } = plan
  const parsedContent = importPlanContentSchema.parse(content)
  const contentSha256 = sha256Canonical(parsedContent)
  if (
    binding.contentSha256 !== contentSha256 ||
    binding.idempotencyKey !== planIdempotencyKey('import', plan.operationId, contentSha256)
  ) {
    throw new Error('Import plan checksum or idempotency binding mismatch.')
  }
  return plan
}

const compensationActionCommon = {
  actionId: uuidSchema,
  sourceActionId: uuidSchema,
  sequence: positiveIntegerSchema,
  itemId: uuidSchema,
  pmid: pmidSchema,
  datasetSplit: z.literal('development'),
  importedReviewId: uuidSchema.nullable(),
  expectedCurrentReviewId: uuidSchema.nullable(),
  expectedEffectiveReviewId: uuidSchema.nullable(),
}

const compensateRestoreActionSchema = z
  .object({
    ...compensationActionCommon,
    action: z.literal('compensate_restore'),
    importedReviewId: uuidSchema,
    expectedCurrentReviewId: uuidSchema,
    expectedEffectiveReviewId: uuidSchema,
    expectedRevision: positiveIntegerSchema.refine((value) => value >= 2),
    expectedSupersedesReviewId: uuidSchema,
    compensationReviewId: uuidSchema,
    effectiveSourceReviewId: uuidSchema,
    expectedHeadReviewIdAfter: uuidSchema,
    expectedEffectiveReviewIdAfter: uuidSchema,
    expectedEventSequence: z.tuple([z.literal('review_compensated')]),
  })
  .strict()

const compensateVoidActionSchema = z
  .object({
    ...compensationActionCommon,
    action: z.literal('compensate_void'),
    importedReviewId: uuidSchema,
    expectedCurrentReviewId: uuidSchema,
    expectedEffectiveReviewId: uuidSchema,
    expectedRevision: positiveIntegerSchema.refine((value) => value >= 2),
    expectedSupersedesReviewId: uuidSchema,
    compensationReviewId: uuidSchema,
    effectiveSourceReviewId: z.null(),
    expectedHeadReviewIdAfter: uuidSchema,
    expectedEffectiveReviewIdAfter: z.null(),
    expectedEventSequence: z.tuple([z.literal('review_voided')]),
  })
  .strict()

const compensateNoopActionSchema = z
  .object({
    ...compensationActionCommon,
    action: z.literal('compensate_noop'),
    importedReviewId: z.null(),
    expectedRevision: z.null(),
    expectedSupersedesReviewId: z.null(),
    compensationReviewId: z.null(),
    effectiveSourceReviewId: uuidSchema.nullable(),
    expectedHeadReviewIdAfter: uuidSchema.nullable(),
    expectedEffectiveReviewIdAfter: uuidSchema.nullable(),
    expectedEventSequence: z.tuple([]),
  })
  .strict()

export const compensationActionSchema = z.discriminatedUnion('action', [
  compensateRestoreActionSchema,
  compensateVoidActionSchema,
  compensateNoopActionSchema,
])
export type CompensationAction = z.infer<typeof compensationActionSchema>

export const compensationPlanContentSchema = z
  .object({
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION),
    kind: z.literal('compensation'),
    operationId: uuidSchema,
    targetImportOperationId: uuidSchema,
    batchId: uuidSchema,
    importPlanSha256: sha256Schema,
    importReceiptSha256: sha256Schema,
    sourceArtifactSha256: sha256Schema,
    expectedPhysicalStateSha256: sha256Schema,
    expectedEffectiveStateSha256: sha256Schema,
    expectedPostEffectiveStateSha256: sha256Schema,
    executionContext: executionContextSchema,
    scope: developmentScopeSchema,
    counts: compensationCountsSchema,
    actions: z.array(compensationActionSchema).min(1).max(5000),
    faultAfterAction: positiveIntegerSchema.optional(),
  })
  .strict()
  .superRefine((plan, context) => {
    const restored = plan.actions.filter((action) => action.action === 'compensate_restore').length
    const voided = plan.actions.filter((action) => action.action === 'compensate_void').length
    const noops = plan.actions.filter((action) => action.action === 'compensate_noop').length
    if (
      canonicalJson(plan.counts) !==
      canonicalJson({ total: plan.actions.length, restored, voided, noops })
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Compensation counts do not match the plan.',
      })
    }
    for (const [values, message] of [
      [plan.actions.map((action) => action.actionId), 'Compensation action IDs must be unique.'],
      [
        plan.actions.map((action) => action.sourceActionId),
        'Compensation source action IDs must be unique.',
      ],
      [plan.actions.map((action) => action.itemId), 'Compensation item IDs must be unique.'],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message })
      }
    }
    if (
      plan.actions.some((action) =>
        plan.actions.some((candidate) => candidate.actionId === action.sourceActionId),
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Compensation action IDs cannot reuse target import action IDs.',
      })
    }
    const compensationReviewIds = plan.actions.flatMap((action) =>
      action.action === 'compensate_noop' ? [] : [action.compensationReviewId],
    )
    if (new Set(compensationReviewIds).size !== compensationReviewIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Compensation review IDs must be unique.',
      })
    }
    if (plan.faultAfterAction !== undefined && plan.faultAfterAction > plan.actions.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'faultAfterAction must identify an action in the compensation plan.',
      })
    }
    plan.actions.forEach((action, index) => {
      if (action.sequence !== index + 1)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Compensation action sequence must be contiguous.',
        })
      if (action.action !== 'compensate_noop') {
        if (
          action.expectedCurrentReviewId !== action.importedReviewId ||
          action.expectedEffectiveReviewId !== action.importedReviewId ||
          action.expectedSupersedesReviewId !== action.importedReviewId
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Compensation must supersede the imported current head.',
          })
        }
        if (action.expectedHeadReviewIdAfter !== action.compensationReviewId) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Compensation review must become the latest head.',
          })
        }
        if (
          action.action === 'compensate_restore' &&
          action.expectedEffectiveReviewIdAfter !== action.effectiveSourceReviewId
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Restoring compensation must resolve to the prior effective source.',
          })
        }
        if (
          action.compensationReviewId === action.importedReviewId ||
          action.compensationReviewId === action.effectiveSourceReviewId
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Compensation review identity must be a new immutable node.',
          })
        }
      } else if (
        action.expectedHeadReviewIdAfter !== action.expectedCurrentReviewId ||
        action.expectedEffectiveReviewIdAfter !== action.expectedEffectiveReviewId ||
        action.effectiveSourceReviewId !== action.expectedEffectiveReviewId
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Compensation no-op cannot change the head or effective source.',
        })
      }
    })
  })
export type CompensationPlanContent = z.infer<typeof compensationPlanContentSchema>

export const compensationPlanSchema = z
  .object({
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION),
    kind: z.literal('compensation'),
    operationId: uuidSchema,
    targetImportOperationId: uuidSchema,
    batchId: uuidSchema,
    importPlanSha256: sha256Schema,
    importReceiptSha256: sha256Schema,
    sourceArtifactSha256: sha256Schema,
    expectedPhysicalStateSha256: sha256Schema,
    expectedEffectiveStateSha256: sha256Schema,
    expectedPostEffectiveStateSha256: sha256Schema,
    executionContext: executionContextSchema,
    scope: developmentScopeSchema,
    counts: compensationCountsSchema,
    actions: z.array(compensationActionSchema).min(1).max(5000),
    faultAfterAction: positiveIntegerSchema.optional(),
    binding: planBindingSchema,
  })
  .strict()
export type CompensationPlan = z.infer<typeof compensationPlanSchema>

export function bindCompensationPlan(input: CompensationPlanContent): CompensationPlan {
  const content = compensationPlanContentSchema.parse(input)
  const contentSha256 = sha256Canonical(content)
  return compensationPlanSchema.parse({
    ...content,
    binding: {
      contentSha256,
      idempotencyKey: planIdempotencyKey('compensation', content.operationId, contentSha256),
    },
  })
}

export function parseCompensationPlan(input: unknown): CompensationPlan {
  rejectLegacyPointerRewindRollback(input)
  const plan = compensationPlanSchema.parse(input)
  const { binding, ...content } = plan
  const parsedContent = compensationPlanContentSchema.parse(content)
  const contentSha256 = sha256Canonical(parsedContent)
  if (
    binding.contentSha256 !== contentSha256 ||
    binding.idempotencyKey !== planIdempotencyKey('compensation', plan.operationId, contentSha256)
  ) {
    throw new Error('Compensation plan checksum or idempotency binding mismatch.')
  }
  return plan
}

const authorizationActorFields = {
  authorizationId: uuidSchema,
  authorized: z.literal(true),
  authorizedBy: z.string().trim().min(1).max(320),
  authorizedAt: timestampSchema,
  authorizationNote: z.string().trim().min(5).max(2000),
}
const authorizationBindingSchema = z.object({ contentSha256: sha256Schema }).strict()
const authorizationExecutionFields = {
  targetDatabase: z.literal('local'),
  remoteWritesAllowed: z.literal(false),
  repositoryCommitSha: z.string().regex(/^[a-f0-9]{40}$/u),
  migrationId: z.literal('20260808035633_add_literature_gold_import_compensation_contract'),
}

export const importAuthorizationContentSchema = z
  .object({
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION),
    kind: z.literal('import_authorization'),
    ...authorizationActorFields,
    ...authorizationExecutionFields,
    operationId: uuidSchema,
    batchId: uuidSchema,
    planSha256: sha256Schema,
    idempotencyKey: sha256Schema,
    sourceArtifactSha256: sha256Schema,
    expectedPhysicalStateSha256: sha256Schema,
    expectedEffectiveStateSha256: sha256Schema,
    expectedPostEffectiveStateSha256: sha256Schema,
  })
  .strict()
export type ImportAuthorizationContent = z.infer<typeof importAuthorizationContentSchema>
export const importAuthorizationSchema = z
  .object({
    ...importAuthorizationContentSchema.shape,
    binding: authorizationBindingSchema,
  })
  .strict()
export type ImportAuthorization = z.infer<typeof importAuthorizationSchema>

export const compensationAuthorizationContentSchema = z
  .object({
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION),
    kind: z.literal('compensation_authorization'),
    ...authorizationActorFields,
    ...authorizationExecutionFields,
    operationId: uuidSchema,
    targetImportOperationId: uuidSchema,
    batchId: uuidSchema,
    planSha256: sha256Schema,
    idempotencyKey: sha256Schema,
    importReceiptSha256: sha256Schema,
    sourceArtifactSha256: sha256Schema,
    expectedPhysicalStateSha256: sha256Schema,
    expectedEffectiveStateSha256: sha256Schema,
    expectedPostEffectiveStateSha256: sha256Schema,
  })
  .strict()
export type CompensationAuthorizationContent = z.infer<
  typeof compensationAuthorizationContentSchema
>
export const compensationAuthorizationSchema = z
  .object({
    ...compensationAuthorizationContentSchema.shape,
    binding: authorizationBindingSchema,
  })
  .strict()
export type CompensationAuthorization = z.infer<typeof compensationAuthorizationSchema>

export const recoveryAuthorizationContentSchema = z
  .object({
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION),
    kind: z.literal('recovery_authorization'),
    ...authorizationActorFields,
    ...authorizationExecutionFields,
    recoveryAction: z.enum(['resolve_ambiguous_import', 'resolve_ambiguous_compensation']),
    batchId: uuidSchema,
    targetOperationId: uuidSchema,
    targetPlanSha256: sha256Schema,
    targetIdempotencyKey: sha256Schema,
    observedPhysicalStateSha256: sha256Schema,
    observedEffectiveStateSha256: sha256Schema,
    permitsMutation: z.literal(false),
  })
  .strict()
export type RecoveryAuthorizationContent = z.infer<typeof recoveryAuthorizationContentSchema>
export const recoveryAuthorizationSchema = z
  .object({
    ...recoveryAuthorizationContentSchema.shape,
    binding: authorizationBindingSchema,
  })
  .strict()
export type RecoveryAuthorization = z.infer<typeof recoveryAuthorizationSchema>

function bindAuthorization<T extends object>(content: T) {
  return { ...content, binding: { contentSha256: sha256Canonical(content) } }
}

function parseBoundAuthorization<T extends { binding: { contentSha256: string } }>(
  input: unknown,
  schema: z.ZodType<T>,
  contentSchema: z.ZodType<object>,
): T {
  const authorization = schema.parse(input)
  const { binding, ...content } = authorization
  const parsedContent = contentSchema.parse(content)
  if (binding.contentSha256 !== sha256Canonical(parsedContent)) {
    throw new Error('Authorization checksum mismatch.')
  }
  return authorization
}

export function bindImportAuthorization(input: ImportAuthorizationContent): ImportAuthorization {
  const content = importAuthorizationContentSchema.parse(input)
  return importAuthorizationSchema.parse(bindAuthorization(content))
}

export function parseImportAuthorization(input: unknown): ImportAuthorization {
  return parseBoundAuthorization(input, importAuthorizationSchema, importAuthorizationContentSchema)
}

export function bindCompensationAuthorization(
  input: CompensationAuthorizationContent,
): CompensationAuthorization {
  const content = compensationAuthorizationContentSchema.parse(input)
  return compensationAuthorizationSchema.parse(bindAuthorization(content))
}

export function parseCompensationAuthorization(input: unknown): CompensationAuthorization {
  return parseBoundAuthorization(
    input,
    compensationAuthorizationSchema,
    compensationAuthorizationContentSchema,
  )
}

export function bindRecoveryAuthorization(
  input: RecoveryAuthorizationContent,
): RecoveryAuthorization {
  const content = recoveryAuthorizationContentSchema.parse(input)
  return recoveryAuthorizationSchema.parse(bindAuthorization(content))
}

export function parseRecoveryAuthorization(input: unknown): RecoveryAuthorization {
  return parseBoundAuthorization(
    input,
    recoveryAuthorizationSchema,
    recoveryAuthorizationContentSchema,
  )
}

export function assertImportAuthorizationMatchesPlan(
  planInput: unknown,
  authorizationInput: unknown,
) {
  const plan = parseImportPlan(planInput)
  const authorization = parseImportAuthorization(authorizationInput)
  const expected = {
    operationId: plan.operationId,
    batchId: plan.batchId,
    planSha256: plan.binding.contentSha256,
    idempotencyKey: plan.binding.idempotencyKey,
    sourceArtifactSha256: plan.sourceArtifactSha256,
    expectedPhysicalStateSha256: plan.expectedPhysicalStateSha256,
    expectedEffectiveStateSha256: plan.expectedEffectiveStateSha256,
    expectedPostEffectiveStateSha256: plan.expectedPostEffectiveStateSha256,
    targetDatabase: plan.executionContext.targetDatabase,
    remoteWritesAllowed: plan.executionContext.remoteWritesAllowed,
    repositoryCommitSha: plan.executionContext.repositoryCommitSha,
    migrationId: plan.executionContext.migrationId,
  }
  for (const [key, value] of Object.entries(expected)) {
    if (authorization[key as keyof typeof authorization] !== value) {
      throw new Error(`Import authorization does not match plan field ${key}.`)
    }
  }
  return { plan, authorization }
}

export function assertCompensationAuthorizationMatchesPlan(
  planInput: unknown,
  authorizationInput: unknown,
) {
  const plan = parseCompensationPlan(planInput)
  const authorization = parseCompensationAuthorization(authorizationInput)
  const expected = {
    operationId: plan.operationId,
    targetImportOperationId: plan.targetImportOperationId,
    batchId: plan.batchId,
    planSha256: plan.binding.contentSha256,
    idempotencyKey: plan.binding.idempotencyKey,
    importReceiptSha256: plan.importReceiptSha256,
    sourceArtifactSha256: plan.sourceArtifactSha256,
    expectedPhysicalStateSha256: plan.expectedPhysicalStateSha256,
    expectedEffectiveStateSha256: plan.expectedEffectiveStateSha256,
    expectedPostEffectiveStateSha256: plan.expectedPostEffectiveStateSha256,
    targetDatabase: plan.executionContext.targetDatabase,
    remoteWritesAllowed: plan.executionContext.remoteWritesAllowed,
    repositoryCommitSha: plan.executionContext.repositoryCommitSha,
    migrationId: plan.executionContext.migrationId,
  }
  for (const [key, value] of Object.entries(expected)) {
    if (authorization[key as keyof typeof authorization] !== value) {
      throw new Error(`Compensation authorization does not match plan field ${key}.`)
    }
  }
  return { plan, authorization }
}

export const importReadinessGatesSchema = z
  .object({
    migrationApplied: z.boolean(),
    testSplitLocked: z.boolean(),
    contractVersionSupported: z.boolean(),
    planChecksumValid: z.boolean(),
    authorizationChecksumValid: z.boolean(),
    authorizationMatchesPlan: z.boolean(),
    sourceArtifactChecksumValid: z.boolean(),
    physicalStateMatches: z.boolean(),
    effectiveStateMatches: z.boolean(),
    developmentScopeOnly: z.boolean(),
    revisionChainsLinear: z.boolean(),
    currentPointersAreLatestHeads: z.boolean(),
    legacyPointerRewindAbsent: z.boolean(),
  })
  .strict()
export type ImportReadinessGates = z.infer<typeof importReadinessGatesSchema>

export function evaluateImportReadiness(input: ImportReadinessGates) {
  const gates = importReadinessGatesSchema.parse(input)
  const failures = (Object.entries(gates) as Array<[keyof ImportReadinessGates, boolean]>)
    .filter(([, passed]) => !passed)
    .map(([gate]) => gate)
  return { ready: failures.length === 0, failures, gates }
}

const receiptCountsSchema = z
  .object({
    planned: z.number().int().nonnegative(),
    applied: z.number().int().nonnegative(),
    noops: z.number().int().nonnegative(),
  })
  .strict()
const receiptBindingSchema = z.object({ contentSha256: sha256Schema }).strict()

const receiptCommonShape = {
  contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION),
  operationId: uuidSchema,
  batchId: uuidSchema,
  planSha256: sha256Schema,
  idempotencyKey: sha256Schema,
  outcome: z.enum(['committed', 'failed']),
  response: z.enum(['applied', 'idempotent_replay', 'ambiguous_after_commit']),
  beforePhysicalStateSha256: sha256Schema,
  afterPhysicalStateSha256: sha256Schema,
  beforeEffectiveStateSha256: sha256Schema,
  afterEffectiveStateSha256: sha256Schema,
  counts: receiptCountsSchema,
  eventSequence: z.array(goldReviewOperationEventTypeSchema).max(5002),
  error: z.string().nullable(),
}

type TerminalReceiptCandidate = {
  outcome: 'committed' | 'failed'
  beforePhysicalStateSha256: string
  afterPhysicalStateSha256: string
  beforeEffectiveStateSha256: string
  afterEffectiveStateSha256: string
  counts: { planned: number; applied: number; noops: number }
  eventSequence: GoldReviewOperationEventType[]
  error: string | null
}

function validateTerminalReceipt(
  receipt: TerminalReceiptCandidate,
  operationKind: 'import' | 'compensation',
  context: z.RefinementCtx,
) {
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
    invalid('A terminal operation must append physical audit state.')
  }
  if (receipt.outcome === 'failed') {
    if (
      receipt.counts.applied !== 0 ||
      receipt.counts.noops !== 0 ||
      receipt.error === null ||
      receipt.beforeEffectiveStateSha256 !== receipt.afterEffectiveStateSha256 ||
      canonicalJson(receipt.eventSequence) !== canonicalJson([started, failed])
    ) {
      invalid(
        'Failed receipt does not prove atomic effective-state rollback and exact failure events.',
      )
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
    invalid('Committed receipt counts, error state, or event sequence is inconsistent.')
  }
}

const importReceiptContentShape = {
  ...receiptCommonShape,
  kind: z.literal('import_receipt'),
}
const importReceiptContentSchema = z
  .object(importReceiptContentShape)
  .strict()
  .superRefine((receipt, context) => validateTerminalReceipt(receipt, 'import', context))
export const importReceiptSchema = z
  .object({ ...importReceiptContentShape, binding: receiptBindingSchema })
  .strict()
  .superRefine((receipt, context) => validateTerminalReceipt(receipt, 'import', context))
export type ImportReceipt = z.infer<typeof importReceiptSchema>

const compensationReceiptContentShape = {
  ...receiptCommonShape,
  kind: z.literal('compensation_receipt'),
  targetImportOperationId: uuidSchema,
}
const compensationReceiptContentSchema = z
  .object(compensationReceiptContentShape)
  .strict()
  .superRefine((receipt, context) => validateTerminalReceipt(receipt, 'compensation', context))
export const compensationReceiptSchema = z
  .object({ ...compensationReceiptContentShape, binding: receiptBindingSchema })
  .strict()
  .superRefine((receipt, context) => validateTerminalReceipt(receipt, 'compensation', context))
export type CompensationReceipt = z.infer<typeof compensationReceiptSchema>

function receiptIdentity<T extends { response: string }>(content: T) {
  return Object.fromEntries(Object.entries(content).filter(([key]) => key !== 'response'))
}

function bindReceipt<T extends { response: string }>(content: T) {
  return {
    ...content,
    binding: { contentSha256: sha256Canonical(receiptIdentity(content)) },
  }
}

export function parseImportReceipt(input: unknown): ImportReceipt {
  const receipt = importReceiptSchema.parse(input)
  const { binding, ...content } = receipt
  const parsedContent = importReceiptContentSchema.parse(content)
  if (binding.contentSha256 !== sha256Canonical(receiptIdentity(parsedContent))) {
    throw new Error('Import receipt checksum mismatch.')
  }
  return receipt
}

export function parseCompensationReceipt(input: unknown): CompensationReceipt {
  const receipt = compensationReceiptSchema.parse(input)
  const { binding, ...content } = receipt
  const parsedContent = compensationReceiptContentSchema.parse(content)
  if (binding.contentSha256 !== sha256Canonical(receiptIdentity(parsedContent))) {
    throw new Error('Compensation receipt checksum mismatch.')
  }
  return receipt
}

const forbiddenLegacyKeys = new Set([
  'pointerRewind',
  'rewindPointer',
  'restoreCurrentReviewId',
  'targetCurrentReviewId',
  'rollbackSql',
  'rollbackPlan',
])
const forbiddenLegacyValues = new Set([
  'pointer_rewind',
  'rewind_pointer',
  'restore_current_review_id',
  'set_current_review_id',
])

export function rejectLegacyPointerRewindRollback(input: unknown): void {
  const visit = (value: unknown): boolean => {
    if (typeof value === 'string') return forbiddenLegacyValues.has(value.toLowerCase())
    if (Array.isArray(value)) return value.some(visit)
    if (!value || typeof value !== 'object') return false
    return Object.entries(value as Record<string, unknown>).some(
      ([key, nested]) => forbiddenLegacyKeys.has(key) || visit(nested),
    )
  }
  if (visit(input)) throw new Error(LEGACY_POINTER_REWIND_ERROR)
}

export interface RehearsalReviewNode {
  id: string
  itemId: string
  revision: number
  supersedesReviewId: string | null
  payload: GoldReviewPayload
  revisionKind: 'standard' | 'import' | 'compensation'
  lifecycleState: 'effective' | 'withdrawn'
  operationActionId: string | null
  compensatesReviewId: string | null
  effectiveSourceReviewId: string | null
  preImportItemState: ImportAction['preImportItemState'] | null
}

export interface RehearsalItem {
  itemId: string
  pmid: string
  datasetSplit: 'development' | 'test'
  reviewStatus: 'pending' | 'in_progress' | 'return_later' | 'completed'
  currentReviewId: string | null
  startedAt: string | null
  completedAt: string | null
  supplementalMetadataRevealedAt: string | null
  automatedSignalsRevealedAt: string | null
  reviews: RehearsalReviewNode[]
}

export interface RehearsalEvent {
  sequence: number
  operationId: string
  actionId: string | null
  itemId: string | null
  eventType: GoldReviewRehearsalEventType
}

export interface RehearsalOperation {
  operationId: string
  kind: 'import' | 'compensation'
  planSha256: string
  idempotencyKey: string
  status: 'started' | 'completed' | 'failed'
  targetImportOperationId: string | null
  compensatedByOperationId: string | null
  receipt: ImportReceipt | CompensationReceipt | null
}

export interface ImportCompensationRehearsal {
  batchId: string
  items: Record<string, RehearsalItem>
  events: RehearsalEvent[]
  operations: Record<string, RehearsalOperation>
}

export interface RehearsalItemSeed {
  itemId: string
  pmid: string
  datasetSplit: 'development' | 'test'
}

export function createImportCompensationRehearsal(
  batchId: string,
  seeds: readonly RehearsalItemSeed[],
): ImportCompensationRehearsal {
  uuidSchema.parse(batchId)
  const items: Record<string, RehearsalItem> = {}
  for (const seed of seeds) {
    uuidSchema.parse(seed.itemId)
    pmidSchema.parse(seed.pmid)
    if (items[seed.itemId]) throw new Error(`Duplicate rehearsal item ${seed.itemId}.`)
    items[seed.itemId] = {
      ...seed,
      reviewStatus: 'pending',
      currentReviewId: null,
      startedAt: null,
      completedAt: null,
      supplementalMetadataRevealedAt: null,
      automatedSignalsRevealedAt: null,
      reviews: [],
    }
  }
  return { batchId, items, events: [], operations: {} }
}

export function developmentMembershipProjection(state: ImportCompensationRehearsal) {
  return {
    projectionVersion: 'literature-gold-development-membership-v1',
    datasetSplit: 'development',
    items: Object.values(state.items)
      .filter((item) => item.datasetSplit === 'development')
      .sort((left, right) => left.itemId.localeCompare(right.itemId, 'en'))
      .map((item) => ({ itemId: item.itemId, pmid: item.pmid })),
  }
}

export function developmentMembershipHash(state: ImportCompensationRehearsal) {
  return sha256Canonical(developmentMembershipProjection(state))
}

function cloneRehearsal(state: ImportCompensationRehearsal): ImportCompensationRehearsal {
  return JSON.parse(JSON.stringify(state)) as ImportCompensationRehearsal
}

function headReview(item: RehearsalItem) {
  if (!item.currentReviewId) return null
  return item.reviews.find((review) => review.id === item.currentReviewId) ?? null
}

function effectiveReview(item: RehearsalItem) {
  const head = headReview(item)
  return head?.lifecycleState === 'effective' ? head : null
}

function effectiveReviewId(item: RehearsalItem) {
  const effective = effectiveReview(item)
  return effective ? (effective.effectiveSourceReviewId ?? effective.id) : null
}

/**
 * In-memory rehearsal identity only. Production plans must use the database's
 * literature_gold_physical_state_hash_v1 result because that projection also
 * contains database rows, drafts, operation journals, and audit events.
 */
export function rehearsalPhysicalStateProjection(state: ImportCompensationRehearsal) {
  return {
    batchId: state.batchId,
    items: Object.values(state.items)
      .filter((item) => item.datasetSplit === 'development')
      .sort((left, right) => left.itemId.localeCompare(right.itemId, 'en'))
      .map((item) => ({
        itemId: item.itemId,
        pmid: item.pmid,
        datasetSplit: item.datasetSplit,
        reviewStatus: item.reviewStatus,
        currentReviewId: item.currentReviewId,
        startedAt: item.startedAt,
        completedAt: item.completedAt,
        supplementalMetadataRevealedAt: item.supplementalMetadataRevealedAt,
        automatedSignalsRevealedAt: item.automatedSignalsRevealedAt,
        reviews: [...item.reviews]
          .sort((left, right) => left.revision - right.revision)
          .map((review) => ({ ...review })),
      })),
    events: [...state.events].sort((left, right) => left.sequence - right.sequence),
    operations: Object.values(state.operations)
      .sort((left, right) => left.operationId.localeCompare(right.operationId, 'en'))
      .map((operation) =>
        Object.fromEntries(Object.entries(operation).filter(([key]) => key !== 'receipt')),
      ),
  }
}

export function rehearsalPhysicalStateHash(state: ImportCompensationRehearsal): string {
  return sha256Canonical(rehearsalPhysicalStateProjection(state))
}

export function effectiveStateProjection(state: ImportCompensationRehearsal) {
  return {
    projectionVersion: 'literature-gold-effective-state-v1',
    datasetSplit: 'development',
    items: Object.values(state.items)
      .filter((item) => item.datasetSplit === 'development')
      .sort(
        (left, right) =>
          Number(left.pmid) - Number(right.pmid) || left.itemId.localeCompare(right.itemId, 'en'),
      )
      .map((item) => {
        const effective = effectiveReview(item)
        return {
          pmid: item.pmid,
          reviewStatus: item.reviewStatus,
          review: effective ? goldReviewClinicalProjection(effective.payload) : null,
        }
      }),
  }
}

export function effectiveStateHash(state: ImportCompensationRehearsal): string {
  return sha256Canonical(effectiveStateProjection(state))
}

export function assertLinearRevisionChains(state: ImportCompensationRehearsal): true {
  const reviewIds = new Set<string>()
  for (const item of Object.values(state.items)) {
    const reviews = [...item.reviews].sort((left, right) => left.revision - right.revision)
    for (const [index, review] of reviews.entries()) {
      if (review.itemId !== item.itemId || review.revision !== index + 1) {
        throw new Error(`Non-contiguous revision chain for item ${item.itemId}.`)
      }
      const expectedParent = index === 0 ? null : reviews[index - 1].id
      if (review.supersedesReviewId !== expectedParent) {
        throw new Error(`Forked revision chain for item ${item.itemId}.`)
      }
      if (reviewIds.has(review.id)) throw new Error(`Duplicate review ID ${review.id}.`)
      reviewIds.add(review.id)
    }
    const expectedHead = reviews.at(-1)?.id ?? null
    if (item.currentReviewId !== expectedHead) {
      throw new Error(`currentReviewId is not the latest chain head for item ${item.itemId}.`)
    }
  }
  return true
}

function appendEvent(
  state: ImportCompensationRehearsal,
  operationId: string,
  eventType: GoldReviewRehearsalEventType,
  actionId: string | null = null,
  itemId: string | null = null,
) {
  state.events.push({
    sequence: state.events.length + 1,
    operationId,
    actionId,
    itemId,
    eventType,
  })
}

function findOperationByIdentity(
  state: ImportCompensationRehearsal,
  operationId: string,
  operationKind: RehearsalOperation['kind'],
  idempotencyKey: string,
) {
  return Object.values(state.operations).find(
    (operation) =>
      operation.operationId === operationId ||
      (operation.kind === operationKind && operation.idempotencyKey === idempotencyKey),
  )
}

function replayImportReceipt(receipt: ImportReceipt): ImportReceipt {
  const content = Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'binding'))
  return importReceiptSchema.parse(bindReceipt({ ...content, response: 'idempotent_replay' }))
}

function replayCompensationReceipt(receipt: CompensationReceipt): CompensationReceipt {
  const content = Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'binding'))
  return compensationReceiptSchema.parse(bindReceipt({ ...content, response: 'idempotent_replay' }))
}

function assertItemPrecondition(
  state: ImportCompensationRehearsal,
  action: Pick<
    ImportAction | CompensationAction,
    'itemId' | 'pmid' | 'datasetSplit' | 'expectedCurrentReviewId' | 'expectedEffectiveReviewId'
  >,
) {
  const item = state.items[action.itemId]
  if (!item) throw new Error(`Import item not found: ${action.itemId}.`)
  if (item.datasetSplit !== 'development' || action.datasetSplit !== 'development') {
    throw new Error('Held-out test identities are outside the import contract.')
  }
  if (item.pmid !== action.pmid) throw new Error(`Item/PMID mismatch for ${action.itemId}.`)
  if (item.currentReviewId !== action.expectedCurrentReviewId) {
    throw new Error(`Stale current review for ${action.itemId}.`)
  }
  if (effectiveReviewId(item) !== action.expectedEffectiveReviewId) {
    throw new Error(`Stale effective review for ${action.itemId}.`)
  }
  if ('preImportItemState' in action) {
    const actual = {
      reviewStatus: item.reviewStatus,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      supplementalMetadataRevealedAt: item.supplementalMetadataRevealedAt,
      automatedSignalsRevealedAt: item.automatedSignalsRevealedAt,
    }
    if (canonicalJson(actual) !== canonicalJson(action.preImportItemState)) {
      throw new Error(`Stale item state for ${action.itemId}.`)
    }
  }
  return item
}

export interface RehearsalExecutionOptions {
  ambiguousResponseAfterCommit?: boolean
}

export interface ImportRehearsalResult {
  state: ImportCompensationRehearsal
  receipt: ImportReceipt | null
  response: 'received' | 'ambiguous_after_commit' | 'idempotent_replay'
}

export function executeImportRehearsal(
  stateInput: ImportCompensationRehearsal,
  planInput: unknown,
  authorizationInput: unknown,
  options: RehearsalExecutionOptions = {},
): ImportRehearsalResult {
  assertLinearRevisionChains(stateInput)
  const plan = assertImportAuthorizationMatchesPlan(planInput, authorizationInput).plan
  if (plan.batchId !== stateInput.batchId) throw new Error('Import batch does not match state.')
  if (plan.scope.developmentMembershipSha256 !== developmentMembershipHash(stateInput)) {
    throw new Error('Import scope does not match the exact development membership.')
  }

  const existing = findOperationByIdentity(
    stateInput,
    plan.operationId,
    'import',
    plan.binding.idempotencyKey,
  )
  if (existing) {
    if (
      existing.operationId !== plan.operationId ||
      existing.kind !== 'import' ||
      existing.idempotencyKey !== plan.binding.idempotencyKey ||
      existing.planSha256 !== plan.binding.contentSha256
    ) {
      throw new Error('Operation or idempotency identity is already bound to different inputs.')
    }
    if (
      (existing.status === 'completed' || existing.status === 'failed') &&
      existing.receipt?.kind === 'import_receipt'
    ) {
      return {
        state: stateInput,
        receipt: replayImportReceipt(existing.receipt),
        response: 'idempotent_replay',
      }
    }
    throw new Error('A started import requires recovery reconciliation.')
  }
  if (rehearsalPhysicalStateHash(stateInput) !== plan.expectedPhysicalStateSha256) {
    throw new Error('Stale physical/audit state for import.')
  }
  if (effectiveStateHash(stateInput) !== plan.expectedEffectiveStateSha256) {
    throw new Error('Stale effective review state for import.')
  }

  const beforePhysical = rehearsalPhysicalStateHash(stateInput)
  const beforeEffective = effectiveStateHash(stateInput)
  const draft = cloneRehearsal(stateInput)
  draft.operations[plan.operationId] = {
    operationId: plan.operationId,
    kind: 'import',
    planSha256: plan.binding.contentSha256,
    idempotencyKey: plan.binding.idempotencyKey,
    status: 'started',
    targetImportOperationId: null,
    compensatedByOperationId: null,
    receipt: null,
  }
  appendEvent(draft, plan.operationId, 'import_started')
  let applied = 0
  let noops = 0

  try {
    for (const action of plan.actions) {
      const item = assertItemPrecondition(draft, action)
      if (action.action === 'import_noop') {
        const effectivePayload = effectiveReview(item)?.payload
        const effectiveCandidate = effectivePayload
          ? goldReviewClinicalProjection(effectivePayload)
          : null
        if (
          canonicalJson(effectiveCandidate) !== canonicalJson(action.candidateReview) ||
          sha256Canonical(effectiveCandidate) !== action.candidateReviewSha256
        ) {
          throw new Error(`No-op payload mismatch for ${action.itemId}.`)
        }
        noops += 1
      } else {
        const parent = headReview(item)
        const expectedRevision = (parent?.revision ?? 0) + 1
        if (
          action.expectedRevision !== expectedRevision ||
          action.expectedSupersedesReviewId !== (parent?.id ?? null)
        ) {
          throw new Error(`Revision precondition mismatch for ${action.itemId}.`)
        }
        item.reviews.push({
          id: action.importedReviewId,
          itemId: action.itemId,
          revision: action.expectedRevision,
          supersedesReviewId: action.expectedSupersedesReviewId,
          payload: action.review,
          revisionKind: 'import',
          lifecycleState: 'effective',
          operationActionId: action.actionId,
          compensatesReviewId: null,
          effectiveSourceReviewId: null,
          preImportItemState: action.preImportItemState,
        })
        item.currentReviewId = action.importedReviewId
        item.reviewStatus = 'completed'
        item.startedAt ??= action.review.startedAt
        item.completedAt = action.review.completedAt
        appendEvent(draft, plan.operationId, 'review_imported', action.actionId, action.itemId)
        applied += 1
      }
      if (plan.faultAfterAction === action.sequence) {
        throw new Error(`Injected failure after action ${action.sequence}.`)
      }
    }
    if (effectiveStateHash(draft) !== plan.expectedPostEffectiveStateSha256) {
      throw new Error('Import effective post-state checksum mismatch.')
    }
  } catch (error) {
    const failed = cloneRehearsal(stateInput)
    failed.operations[plan.operationId] = {
      ...draft.operations[plan.operationId],
      status: 'failed',
      receipt: null,
    }
    appendEvent(failed, plan.operationId, 'import_started')
    appendEvent(failed, plan.operationId, 'import_failed')
    const content = importReceiptContentSchema.parse({
      contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
      kind: 'import_receipt',
      operationId: plan.operationId,
      batchId: plan.batchId,
      planSha256: plan.binding.contentSha256,
      idempotencyKey: plan.binding.idempotencyKey,
      outcome: 'failed',
      response: 'applied',
      beforePhysicalStateSha256: beforePhysical,
      afterPhysicalStateSha256: rehearsalPhysicalStateHash(failed),
      beforeEffectiveStateSha256: beforeEffective,
      afterEffectiveStateSha256: effectiveStateHash(failed),
      counts: { planned: plan.counts.inserts, applied: 0, noops: 0 },
      eventSequence: ['import_started', 'import_failed'],
      error: error instanceof Error ? error.message : String(error),
    })
    const receipt = importReceiptSchema.parse(bindReceipt(content))
    failed.operations[plan.operationId].receipt = receipt
    assertLinearRevisionChains(failed)
    return { state: failed, receipt, response: 'received' }
  }

  draft.operations[plan.operationId].status = 'completed'
  appendEvent(draft, plan.operationId, 'import_completed')
  assertLinearRevisionChains(draft)
  const response = options.ambiguousResponseAfterCommit ? 'ambiguous_after_commit' : 'applied'
  const content = importReceiptContentSchema.parse({
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    kind: 'import_receipt',
    operationId: plan.operationId,
    batchId: plan.batchId,
    planSha256: plan.binding.contentSha256,
    idempotencyKey: plan.binding.idempotencyKey,
    outcome: 'committed',
    response,
    beforePhysicalStateSha256: beforePhysical,
    afterPhysicalStateSha256: rehearsalPhysicalStateHash(draft),
    beforeEffectiveStateSha256: beforeEffective,
    afterEffectiveStateSha256: effectiveStateHash(draft),
    counts: { planned: plan.counts.inserts, applied, noops },
    eventSequence: draft.events
      .filter((event) => event.operationId === plan.operationId)
      .map((event) => event.eventType),
    error: null,
  })
  const receipt = importReceiptSchema.parse(bindReceipt(content))
  draft.operations[plan.operationId].receipt = receipt
  return {
    state: draft,
    receipt: options.ambiguousResponseAfterCommit ? null : receipt,
    response: options.ambiguousResponseAfterCommit ? 'ambiguous_after_commit' : 'received',
  }
}

export interface CompensationRehearsalResult {
  state: ImportCompensationRehearsal
  receipt: CompensationReceipt | null
  response: 'received' | 'ambiguous_after_commit' | 'idempotent_replay'
}

export function executeCompensationRehearsal(
  stateInput: ImportCompensationRehearsal,
  planInput: unknown,
  authorizationInput: unknown,
  options: RehearsalExecutionOptions = {},
): CompensationRehearsalResult {
  assertLinearRevisionChains(stateInput)
  const { plan } = assertCompensationAuthorizationMatchesPlan(planInput, authorizationInput)
  if (plan.batchId !== stateInput.batchId)
    throw new Error('Compensation batch does not match state.')
  if (plan.scope.developmentMembershipSha256 !== developmentMembershipHash(stateInput)) {
    throw new Error('Compensation scope does not match the exact development membership.')
  }
  const existing = findOperationByIdentity(
    stateInput,
    plan.operationId,
    'compensation',
    plan.binding.idempotencyKey,
  )
  if (existing) {
    if (
      existing.operationId !== plan.operationId ||
      existing.kind !== 'compensation' ||
      existing.idempotencyKey !== plan.binding.idempotencyKey ||
      existing.planSha256 !== plan.binding.contentSha256 ||
      existing.targetImportOperationId !== plan.targetImportOperationId
    ) {
      throw new Error('Operation or idempotency identity is already bound to different inputs.')
    }
    if (
      (existing.status === 'completed' || existing.status === 'failed') &&
      existing.receipt?.kind === 'compensation_receipt'
    ) {
      return {
        state: stateInput,
        receipt: replayCompensationReceipt(existing.receipt),
        response: 'idempotent_replay',
      }
    }
    throw new Error('A started compensation requires recovery reconciliation.')
  }
  const target = stateInput.operations[plan.targetImportOperationId]
  if (!target || target.kind !== 'import' || target.status !== 'completed')
    throw new Error('Target import is not committed.')
  if (target.compensatedByOperationId) throw new Error('Target import is already compensated.')
  if (target.planSha256 !== plan.importPlanSha256) throw new Error('Target import plan mismatch.')
  if (target.receipt?.binding.contentSha256 !== plan.importReceiptSha256)
    throw new Error('Target import receipt mismatch.')
  if (rehearsalPhysicalStateHash(stateInput) !== plan.expectedPhysicalStateSha256)
    throw new Error('Stale physical/audit state for compensation.')
  if (effectiveStateHash(stateInput) !== plan.expectedEffectiveStateSha256)
    throw new Error('Stale effective review state for compensation.')

  const beforePhysical = rehearsalPhysicalStateHash(stateInput)
  const beforeEffective = effectiveStateHash(stateInput)
  const draft = cloneRehearsal(stateInput)
  draft.operations[plan.operationId] = {
    operationId: plan.operationId,
    kind: 'compensation',
    planSha256: plan.binding.contentSha256,
    idempotencyKey: plan.binding.idempotencyKey,
    status: 'started',
    targetImportOperationId: plan.targetImportOperationId,
    compensatedByOperationId: null,
    receipt: null,
  }
  appendEvent(draft, plan.operationId, 'import_compensation_started')
  let applied = 0
  let noops = 0
  try {
    for (const action of plan.actions) {
      const item = assertItemPrecondition(draft, action)
      if (action.action === 'compensate_noop') {
        if (
          action.expectedHeadReviewIdAfter !== item.currentReviewId ||
          action.expectedEffectiveReviewIdAfter !== effectiveReviewId(item)
        ) {
          throw new Error(`Compensation no-op mismatch for ${action.itemId}.`)
        }
        noops += 1
      } else {
        const imported = headReview(item)
        if (
          !imported ||
          imported.id !== action.importedReviewId ||
          imported.revisionKind !== 'import'
        )
          throw new Error(`Imported head missing for ${action.itemId}.`)
        if (action.expectedRevision !== imported.revision + 1)
          throw new Error(`Compensation revision mismatch for ${action.itemId}.`)
        let payload = imported.payload
        let lifecycleState: RehearsalReviewNode['lifecycleState'] = 'withdrawn'
        if (action.action === 'compensate_restore') {
          const prior = item.reviews.find((review) => review.id === action.effectiveSourceReviewId)
          if (!prior || prior.lifecycleState !== 'effective')
            throw new Error(`Prior effective review missing for ${action.itemId}.`)
          payload = prior.payload
          lifecycleState = 'effective'
          if (action.expectedEffectiveReviewIdAfter !== action.effectiveSourceReviewId) {
            throw new Error(
              `Restored review must resolve to its prior effective source for ${action.itemId}.`,
            )
          }
        }
        item.reviews.push({
          id: action.compensationReviewId,
          itemId: action.itemId,
          revision: action.expectedRevision,
          supersedesReviewId: action.importedReviewId,
          payload,
          revisionKind: 'compensation',
          lifecycleState,
          operationActionId: action.actionId,
          compensatesReviewId: action.importedReviewId,
          effectiveSourceReviewId: action.effectiveSourceReviewId,
          preImportItemState: imported.preImportItemState,
        })
        item.currentReviewId = action.compensationReviewId
        if (imported.preImportItemState) Object.assign(item, imported.preImportItemState)
        appendEvent(
          draft,
          plan.operationId,
          action.action === 'compensate_restore' ? 'review_compensated' : 'review_voided',
          action.actionId,
          action.itemId,
        )
        applied += 1
      }
      if (plan.faultAfterAction === action.sequence)
        throw new Error(`Injected compensation failure after action ${action.sequence}.`)
    }
    if (effectiveStateHash(draft) !== plan.expectedPostEffectiveStateSha256) {
      throw new Error('Compensation effective post-state checksum mismatch.')
    }
  } catch (error) {
    const failed = cloneRehearsal(stateInput)
    failed.operations[plan.operationId] = {
      ...draft.operations[plan.operationId],
      status: 'failed',
      receipt: null,
    }
    appendEvent(failed, plan.operationId, 'import_compensation_started')
    appendEvent(failed, plan.operationId, 'import_compensation_failed')
    const content = compensationReceiptContentSchema.parse({
      contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
      kind: 'compensation_receipt',
      operationId: plan.operationId,
      targetImportOperationId: plan.targetImportOperationId,
      batchId: plan.batchId,
      planSha256: plan.binding.contentSha256,
      idempotencyKey: plan.binding.idempotencyKey,
      outcome: 'failed',
      response: 'applied',
      beforePhysicalStateSha256: beforePhysical,
      afterPhysicalStateSha256: rehearsalPhysicalStateHash(failed),
      beforeEffectiveStateSha256: beforeEffective,
      afterEffectiveStateSha256: effectiveStateHash(failed),
      counts: { planned: plan.counts.restored + plan.counts.voided, applied: 0, noops: 0 },
      eventSequence: ['import_compensation_started', 'import_compensation_failed'],
      error: error instanceof Error ? error.message : String(error),
    })
    const receipt = compensationReceiptSchema.parse(bindReceipt(content))
    failed.operations[plan.operationId].receipt = receipt
    return { state: failed, receipt, response: 'received' }
  }

  draft.operations[plan.targetImportOperationId].compensatedByOperationId = plan.operationId
  draft.operations[plan.operationId].status = 'completed'
  appendEvent(draft, plan.operationId, 'import_compensation_completed')
  assertLinearRevisionChains(draft)
  const response = options.ambiguousResponseAfterCommit ? 'ambiguous_after_commit' : 'applied'
  const content = compensationReceiptContentSchema.parse({
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    kind: 'compensation_receipt',
    operationId: plan.operationId,
    targetImportOperationId: plan.targetImportOperationId,
    batchId: plan.batchId,
    planSha256: plan.binding.contentSha256,
    idempotencyKey: plan.binding.idempotencyKey,
    outcome: 'committed',
    response,
    beforePhysicalStateSha256: beforePhysical,
    afterPhysicalStateSha256: rehearsalPhysicalStateHash(draft),
    beforeEffectiveStateSha256: beforeEffective,
    afterEffectiveStateSha256: effectiveStateHash(draft),
    counts: { planned: plan.counts.restored + plan.counts.voided, applied, noops },
    eventSequence: draft.events
      .filter((event) => event.operationId === plan.operationId)
      .map((event) => event.eventType),
    error: null,
  })
  const receipt = compensationReceiptSchema.parse(bindReceipt(content))
  draft.operations[plan.operationId].receipt = receipt
  return {
    state: draft,
    receipt: options.ambiguousResponseAfterCommit ? null : receipt,
    response: options.ambiguousResponseAfterCommit ? 'ambiguous_after_commit' : 'received',
  }
}

export function appendOrdinaryReviewRehearsal(
  stateInput: ImportCompensationRehearsal,
  input: { itemId: string; reviewId: string; payload: GoldReviewPayload },
): ImportCompensationRehearsal {
  const state = cloneRehearsal(stateInput)
  const item = state.items[uuidSchema.parse(input.itemId)]
  if (!item) throw new Error(`Review item not found: ${input.itemId}.`)
  const parent = headReview(item)
  const payload = goldReviewPayloadSchema.parse(input.payload)
  item.reviews.push({
    id: uuidSchema.parse(input.reviewId),
    itemId: item.itemId,
    revision: (parent?.revision ?? 0) + 1,
    supersedesReviewId: parent?.id ?? null,
    payload,
    revisionKind: 'standard',
    lifecycleState: 'effective',
    operationActionId: null,
    compensatesReviewId: null,
    effectiveSourceReviewId: null,
    preImportItemState: null,
  })
  item.currentReviewId = input.reviewId
  item.reviewStatus = 'completed'
  item.startedAt ??= payload.startedAt
  item.completedAt = payload.completedAt
  appendEvent(state, input.reviewId, 'ordinary_review_completed', null, item.itemId)
  assertLinearRevisionChains(state)
  return state
}

export function validateImportBundle(input: {
  plan: unknown
  authorization: unknown
  sourceArtifactSha256: string
  currentPhysicalStateSha256: string
  currentEffectiveStateSha256: string
  migrationApplied: boolean
  testSplitLocked: boolean
  revisionChainsLinear: boolean
  currentPointersAreLatestHeads: boolean
}) {
  let plan: ImportPlan | null = null
  let planChecksumValid = true
  let authorizationChecksumValid = true
  let authorizationMatchesPlan = true
  try {
    plan = parseImportPlan(input.plan)
  } catch {
    planChecksumValid = false
  }
  try {
    parseImportAuthorization(input.authorization)
  } catch {
    authorizationChecksumValid = false
  }
  if (planChecksumValid && authorizationChecksumValid) {
    try {
      assertImportAuthorizationMatchesPlan(input.plan, input.authorization)
    } catch {
      authorizationMatchesPlan = false
    }
  } else authorizationMatchesPlan = false
  return evaluateImportReadiness({
    migrationApplied: input.migrationApplied,
    testSplitLocked: input.testSplitLocked,
    contractVersionSupported:
      plan?.contractVersion === GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    planChecksumValid,
    authorizationChecksumValid,
    authorizationMatchesPlan,
    sourceArtifactChecksumValid: plan?.sourceArtifactSha256 === input.sourceArtifactSha256,
    physicalStateMatches: plan?.expectedPhysicalStateSha256 === input.currentPhysicalStateSha256,
    effectiveStateMatches: plan?.expectedEffectiveStateSha256 === input.currentEffectiveStateSha256,
    developmentScopeOnly:
      plan?.scope.datasetSplit === 'development' && !plan.scope.heldOutIdentitiesAccessed,
    revisionChainsLinear: input.revisionChainsLinear,
    currentPointersAreLatestHeads: input.currentPointersAreLatestHeads,
    legacyPointerRewindAbsent: plan !== null,
  })
}
