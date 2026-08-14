import { z } from 'zod'

/**
 * Phase D2A is a contract exercise only. These labels travel with every fictional bundle
 * and projection so a caller cannot accidentally present the fixtures as deployed data.
 */
export const INSTITUTIONAL_CONTRACT_FOUNDATION_LABELS = [
  'INSTITUTIONAL CONTRACT FOUNDATION',
  'FICTIONAL DATA ONLY',
  'NOT A DEPLOYED INSTITUTION MODEL',
] as const

export const institutionalContractFoundationLabelsSchema = z.tuple([
  z.literal('INSTITUTIONAL CONTRACT FOUNDATION'),
  z.literal('FICTIONAL DATA ONLY'),
  z.literal('NOT A DEPLOYED INSTITUTION MODEL'),
])

/**
 * Closed identifier grammar. Domain identifiers are data that later phases will use as
 * lookup keys, so they must never collide with JavaScript property-lookup behavior:
 * lowercase ASCII letters/digits with single hyphen/underscore separators, bounded length,
 * and an explicit refusal of every `Object.prototype` name. `constructor` and `prototype`
 * satisfy the lowercase pattern, so the reserved-name check is not redundant with it.
 */
const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/

export const RESERVED_IDENTIFIER_NAMES: ReadonlySet<string> = new Set([
  '__proto__',
  'prototype',
  'constructor',
  ...Object.getOwnPropertyNames(Object.prototype),
])

function closedIdentifierSchema(label: string) {
  return z
    .string()
    .max(72, { message: `${label} must stay within the bounded identifier length.` })
    .regex(IDENTIFIER_PATTERN, {
      message: `${label} must match the closed lowercase identifier grammar.`,
    })
    .refine((value) => !RESERVED_IDENTIFIER_NAMES.has(value), {
      message: `${label} must not be a reserved JavaScript property name.`,
    })
}

/** Identifies a tenant, institution, site, or demo context. */
export const scopeComponentIdentifierSchema = closedIdentifierSchema('A scope component')
/** Names one record, source, provenance row, decision, entry, review, or diagnostic. */
export const scopeLocalIdentifierSchema = closedIdentifierSchema('A scope-local identifier')
/** Names a bundle-wide governed vocabulary value (capability code, subject, revision). */
export const globalGovernedCodeSchema = closedIdentifierSchema('A governed code')

/**
 * Free authoring text. It exists only inside the sealed fixture bundle and is never part
 * of a returned projection, so it tolerates prose while still refusing control characters.
 */
export const internalAuthoringTextSchema = z
  .string()
  .min(1)
  .max(1_000)
  .refine((value) => value === value.trim(), {
    message: 'Internal authoring text must not carry leading or trailing whitespace.',
  })
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), {
    message: 'Internal authoring text must not contain control characters.',
  })

/**
 * `z.string().datetime({ offset: true })` accepts an offset zod's own pattern allows but
 * `Date.parse` cannot resolve — `2026-08-12T12:00:00+99:99` validates yet parses to NaN.
 * Every projection-time comparison below is a `>` against a parsed instant, and NaN makes
 * that comparison false, so a single unreadable timestamp would silently switch the
 * evidence-time guard off rather than fail closed. Require a real resolvable instant.
 */
const isoInstantSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => Number.isFinite(Date.parse(value)), {
    message: 'A timestamp must resolve to a real instant.',
  })

export const institutionScopeIdentitySchema = z
  .object({
    tenantId: scopeComponentIdentifierSchema,
    institutionId: scopeComponentIdentifierSchema,
    siteId: scopeComponentIdentifierSchema,
  })
  .strict()

export const demoContextIdentitySchema = z
  .object({
    contextKind: z.literal('demo'),
    demoContextId: scopeComponentIdentifierSchema,
  })
  .strict()

export const institutionalContextIdentitySchema = z
  .object({
    contextKind: z.literal('institutional'),
    scope: institutionScopeIdentitySchema,
  })
  .strict()

export const overlayContextIdentitySchema = z.discriminatedUnion('contextKind', [
  demoContextIdentitySchema,
  institutionalContextIdentitySchema,
])

export const accessClassificationSchema = z.enum([
  'public_unlisted',
  'institution_restricted',
  'institution_confidential',
])

export const institutionalAccessClassificationSchema = z.enum([
  'institution_restricted',
  'institution_confidential',
])

export const sourceKindSchema = z.enum([
  'capability',
  'formulary',
  'inventory',
  'institutional_approval',
])

/**
 * Controlled vocabularies. Every projection-visible explanatory value is a member of one
 * of these closed enums; the projection carries no arbitrary source-authored prose.
 */
export const unknownReasonSchema = z.enum([
  'not_reported',
  'not_verified',
  'stale_source',
  'source_unavailable',
  'no_matching_record',
])

export const sourceStateReasonSchema = z.enum([
  'scope_not_configured',
  'source_not_configured',
  'source_offline',
  'not_reported',
  'not_verified',
  'stale_source',
])

export const capabilityUnavailableReasonSchema = z.enum([
  'not_offered',
  'decommissioned',
  'service_suspended',
])

export const inventoryAbsentReasonSchema = z.enum(['stock_zero_confirmed', 'not_stocked'])

export const formularyNotListedReasonSchema = z.enum([
  'confirmed_not_listed',
  'removed_from_formulary',
])

export const inventoryUnitSchema = z.enum(['each', 'box', 'kit', 'case'])

export const dataQualityDiagnosticCodeSchema = z.enum([
  'scope_not_configured',
  'missing_capability_record',
  'missing_inventory_record',
  'source_unavailable',
  'stale_source',
  'approval_unverified',
])

/**
 * Controlled diagnostic templates. A projected diagnostic carries a template key drawn
 * from this frozen map instead of its authoring message, so display copy is resolved from
 * repository-controlled templates rather than from data.
 */
export const DIAGNOSTIC_MESSAGE_TEMPLATE_KEY_BY_CODE = Object.freeze({
  scope_not_configured: 'device-intelligence.institutional.diagnostic.scope-not-configured',
  missing_capability_record:
    'device-intelligence.institutional.diagnostic.missing-capability-record',
  missing_inventory_record: 'device-intelligence.institutional.diagnostic.missing-inventory-record',
  source_unavailable: 'device-intelligence.institutional.diagnostic.source-unavailable',
  stale_source: 'device-intelligence.institutional.diagnostic.stale-source',
  approval_unverified: 'device-intelligence.institutional.diagnostic.approval-unverified',
} as const) satisfies Record<z.infer<typeof dataQualityDiagnosticCodeSchema>, string>

export const diagnosticMessageTemplateKeySchema = z.enum([
  DIAGNOSTIC_MESSAGE_TEMPLATE_KEY_BY_CODE.scope_not_configured,
  DIAGNOSTIC_MESSAGE_TEMPLATE_KEY_BY_CODE.missing_capability_record,
  DIAGNOSTIC_MESSAGE_TEMPLATE_KEY_BY_CODE.missing_inventory_record,
  DIAGNOSTIC_MESSAGE_TEMPLATE_KEY_BY_CODE.source_unavailable,
  DIAGNOSTIC_MESSAGE_TEMPLATE_KEY_BY_CODE.stale_source,
  DIAGNOSTIC_MESSAGE_TEMPLATE_KEY_BY_CODE.approval_unverified,
])

export const provenanceClassSchema = z.enum([
  'fictional_fixture',
  'institution_record',
  'system_export',
  'official_document',
])

/**
 * Authoring provenance. The raw label, locator, and jurisdiction prose live inside an
 * explicit internal-only block that no projected schema admits; the projection carries the
 * provenance identifier and class only.
 */
export const sourceProvenanceSchema = z
  .object({
    provenanceId: scopeLocalIdentifierSchema,
    provenanceClass: provenanceClassSchema,
    internalAuthoring: z
      .object({
        sourceLabel: internalAuthoringTextSchema,
        sourceLocator: internalAuthoringTextSchema,
        jurisdiction: internalAuthoringTextSchema,
      })
      .strict(),
  })
  .strict()

export const projectedSourceProvenanceSchema = z
  .object({
    provenanceId: scopeLocalIdentifierSchema,
    provenanceClass: provenanceClassSchema,
  })
  .strict()

const sourceReferenceFields = {
  sourceId: scopeLocalIdentifierSchema,
  sourceKind: sourceKindSchema,
  sourceRevision: globalGovernedCodeSchema,
  lastVerifiedAt: isoInstantSchema,
}

export const demoSourceReferenceSchema = z
  .object({
    ...sourceReferenceFields,
    provenance: sourceProvenanceSchema,
    context: demoContextIdentitySchema,
    accessClassification: z.literal('public_unlisted'),
  })
  .strict()

export const institutionalSourceReferenceSchema = z
  .object({
    ...sourceReferenceFields,
    provenance: sourceProvenanceSchema,
    context: institutionalContextIdentitySchema,
    accessClassification: institutionalAccessClassificationSchema,
  })
  .strict()

export const projectedDemoSourceReferenceSchema = z
  .object({
    ...sourceReferenceFields,
    provenance: projectedSourceProvenanceSchema,
    context: demoContextIdentitySchema,
    accessClassification: z.literal('public_unlisted'),
  })
  .strict()

export const projectedInstitutionalSourceReferenceSchema = z
  .object({
    ...sourceReferenceFields,
    provenance: projectedSourceProvenanceSchema,
    context: institutionalContextIdentitySchema,
    accessClassification: institutionalAccessClassificationSchema,
  })
  .strict()

export const dataSourceStateSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('available') }).strict(),
  z
    .object({
      state: z.literal('unknown'),
      reason: sourceStateReasonSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal('unavailable'),
      reason: sourceStateReasonSchema,
    })
    .strict(),
])

export const capabilityStateSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('available') }).strict(),
  z
    .object({
      state: z.literal('unavailable'),
      reason: capabilityUnavailableReasonSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal('unknown'),
      reason: unknownReasonSchema,
    })
    .strict(),
])

export const inventoryQuantitySchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('known'),
      value: z.number().int().min(0),
      unit: inventoryUnitSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal('unknown'),
      reason: unknownReasonSchema,
    })
    .strict(),
])

export const inventoryStateSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('present'),
      quantity: inventoryQuantitySchema,
    })
    .strict(),
  z
    .object({
      state: z.literal('absent'),
      reason: inventoryAbsentReasonSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal('unknown'),
      reason: unknownReasonSchema,
    })
    .strict(),
])

export const formularyEvidenceStateSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('listed'),
      formularyEntryId: scopeLocalIdentifierSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal('not_listed'),
      reason: formularyNotListedReasonSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal('unknown'),
      reason: unknownReasonSchema,
    })
    .strict(),
])

const institutionalApprovalSourceSchema = institutionalSourceReferenceSchema
  .extend({ sourceKind: z.literal('institutional_approval') })
  .strict()

const projectedInstitutionalApprovalSourceSchema = projectedInstitutionalSourceReferenceSchema
  .extend({ sourceKind: z.literal('institutional_approval') })
  .strict()

export const demoInstitutionApprovalStateSchema = z
  .object({
    state: z.literal('not_applicable_demo'),
    reason: z.literal('demo_context'),
  })
  .strict()

function institutionalApprovalStateSchemaWith<SourceSchema extends z.ZodTypeAny>(
  decisionSourceSchema: SourceSchema,
) {
  return z.discriminatedUnion('state', [
    z
      .object({
        state: z.literal('approved'),
        decisionId: scopeLocalIdentifierSchema,
        decisionSource: decisionSourceSchema,
      })
      .strict(),
    z
      .object({
        state: z.literal('not_approved'),
        decisionId: scopeLocalIdentifierSchema,
        decisionSource: decisionSourceSchema,
      })
      .strict(),
    z
      .object({
        state: z.literal('pending_review'),
        reviewReference: scopeLocalIdentifierSchema,
      })
      .strict(),
    z
      .object({
        state: z.literal('unknown'),
        reason: unknownReasonSchema,
      })
      .strict(),
  ])
}

export const institutionalApprovalStateSchema = institutionalApprovalStateSchemaWith(
  institutionalApprovalSourceSchema,
)
export const projectedInstitutionalApprovalStateSchema = institutionalApprovalStateSchemaWith(
  projectedInstitutionalApprovalSourceSchema,
)

function bySourceKind<
  Shape extends z.ZodRawShape,
  Kind extends 'capability' | 'formulary' | 'inventory',
>(schema: z.ZodObject<Shape, 'strict'>, sourceKind: Kind) {
  return schema.extend({ sourceKind: z.literal(sourceKind) }).strict()
}

const demoRecordIdentityFields = {
  recordId: scopeLocalIdentifierSchema,
  context: demoContextIdentitySchema,
  accessClassification: z.literal('public_unlisted'),
}
const institutionalRecordIdentityFields = {
  recordId: scopeLocalIdentifierSchema,
  context: institutionalContextIdentitySchema,
  accessClassification: institutionalAccessClassificationSchema,
}

function capabilityRecordSchemaWith<
  IdentityFields extends z.ZodRawShape,
  SourceSchema extends z.ZodTypeAny,
>(identityFields: IdentityFields, sourceSchema: SourceSchema) {
  return z
    .object({
      ...identityFields,
      capabilityCode: globalGovernedCodeSchema,
      capabilityState: capabilityStateSchema,
      source: sourceSchema,
    })
    .strict()
}

function inventoryRecordSchemaWith<
  IdentityFields extends z.ZodRawShape,
  SourceSchema extends z.ZodTypeAny,
>(identityFields: IdentityFields, sourceSchema: SourceSchema) {
  return z
    .object({
      ...identityFields,
      subjectId: globalGovernedCodeSchema,
      inventoryState: inventoryStateSchema,
      source: sourceSchema,
    })
    .strict()
}

export const demoCapabilityRecordSchema = capabilityRecordSchemaWith(
  demoRecordIdentityFields,
  bySourceKind(demoSourceReferenceSchema, 'capability'),
)
export const institutionalCapabilityRecordSchema = capabilityRecordSchemaWith(
  institutionalRecordIdentityFields,
  bySourceKind(institutionalSourceReferenceSchema, 'capability'),
)
export const projectedDemoCapabilityRecordSchema = capabilityRecordSchemaWith(
  demoRecordIdentityFields,
  bySourceKind(projectedDemoSourceReferenceSchema, 'capability'),
)
export const projectedInstitutionalCapabilityRecordSchema = capabilityRecordSchemaWith(
  institutionalRecordIdentityFields,
  bySourceKind(projectedInstitutionalSourceReferenceSchema, 'capability'),
)

export const demoFormularyRecordSchema = z
  .object({
    ...demoRecordIdentityFields,
    subjectId: globalGovernedCodeSchema,
    formularyEvidence: formularyEvidenceStateSchema,
    approvalState: demoInstitutionApprovalStateSchema,
    source: bySourceKind(demoSourceReferenceSchema, 'formulary'),
  })
  .strict()

export const institutionalFormularyRecordSchema = z
  .object({
    ...institutionalRecordIdentityFields,
    subjectId: globalGovernedCodeSchema,
    formularyEvidence: formularyEvidenceStateSchema,
    approvalState: institutionalApprovalStateSchema,
    source: bySourceKind(institutionalSourceReferenceSchema, 'formulary'),
  })
  .strict()

export const projectedDemoFormularyRecordSchema = z
  .object({
    ...demoRecordIdentityFields,
    subjectId: globalGovernedCodeSchema,
    formularyEvidence: formularyEvidenceStateSchema,
    approvalState: demoInstitutionApprovalStateSchema,
    source: bySourceKind(projectedDemoSourceReferenceSchema, 'formulary'),
  })
  .strict()

export const projectedInstitutionalFormularyRecordSchema = z
  .object({
    ...institutionalRecordIdentityFields,
    subjectId: globalGovernedCodeSchema,
    formularyEvidence: formularyEvidenceStateSchema,
    approvalState: projectedInstitutionalApprovalStateSchema,
    source: bySourceKind(projectedInstitutionalSourceReferenceSchema, 'formulary'),
  })
  .strict()

export const demoInventoryRecordSchema = inventoryRecordSchemaWith(
  demoRecordIdentityFields,
  bySourceKind(demoSourceReferenceSchema, 'inventory'),
)
export const institutionalInventoryRecordSchema = inventoryRecordSchemaWith(
  institutionalRecordIdentityFields,
  bySourceKind(institutionalSourceReferenceSchema, 'inventory'),
)
export const projectedDemoInventoryRecordSchema = inventoryRecordSchemaWith(
  demoRecordIdentityFields,
  bySourceKind(projectedDemoSourceReferenceSchema, 'inventory'),
)
export const projectedInstitutionalInventoryRecordSchema = inventoryRecordSchemaWith(
  institutionalRecordIdentityFields,
  bySourceKind(projectedInstitutionalSourceReferenceSchema, 'inventory'),
)

const diagnosticIdentityFields = {
  diagnosticId: scopeLocalIdentifierSchema,
  code: dataQualityDiagnosticCodeSchema,
  severity: z.enum(['info', 'warning', 'blocking']),
  observedAt: isoInstantSchema,
  relatedRecordId: scopeLocalIdentifierSchema.nullable(),
}

export const demoDataQualityDiagnosticSchema = z
  .object({
    ...diagnosticIdentityFields,
    message: internalAuthoringTextSchema,
    context: demoContextIdentitySchema,
    accessClassification: z.literal('public_unlisted'),
  })
  .strict()

export const institutionalDataQualityDiagnosticSchema = z
  .object({
    ...diagnosticIdentityFields,
    message: internalAuthoringTextSchema,
    context: institutionalContextIdentitySchema,
    accessClassification: institutionalAccessClassificationSchema,
  })
  .strict()

function projectedDiagnosticSchemaWith<
  ContextSchema extends z.ZodTypeAny,
  AccessSchema extends z.ZodTypeAny,
>(contextSchema: ContextSchema, accessSchema: AccessSchema) {
  return z
    .object({
      ...diagnosticIdentityFields,
      messageTemplateKey: diagnosticMessageTemplateKeySchema,
      context: contextSchema,
      accessClassification: accessSchema,
    })
    .strict()
    .refine(
      (diagnostic) =>
        diagnostic.messageTemplateKey === DIAGNOSTIC_MESSAGE_TEMPLATE_KEY_BY_CODE[diagnostic.code],
      { message: 'A projected diagnostic template key must be derived from its code.' },
    )
}

export const projectedDemoDataQualityDiagnosticSchema = projectedDiagnosticSchemaWith(
  demoContextIdentitySchema,
  z.literal('public_unlisted'),
)
export const projectedInstitutionalDataQualityDiagnosticSchema = projectedDiagnosticSchemaWith(
  institutionalContextIdentitySchema,
  institutionalAccessClassificationSchema,
)

function collectionSchema<RecordSchema extends z.ZodTypeAny>(recordSchema: RecordSchema) {
  return z
    .object({
      sourceState: dataSourceStateSchema,
      records: z.array(recordSchema),
    })
    .strict()
    .superRefine((collection, context) => {
      if (collection.sourceState.state !== 'available' && collection.records.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['records'],
          message: 'An unknown or unavailable source cannot carry asserted records.',
        })
      }
    })
}

export const demoCapabilityCollectionSchema = collectionSchema(demoCapabilityRecordSchema)
export const institutionalCapabilityCollectionSchema = collectionSchema(
  institutionalCapabilityRecordSchema,
)
export const demoFormularyCollectionSchema = collectionSchema(demoFormularyRecordSchema)
export const institutionalFormularyCollectionSchema = collectionSchema(
  institutionalFormularyRecordSchema,
)
export const demoInventoryCollectionSchema = collectionSchema(demoInventoryRecordSchema)
export const institutionalInventoryCollectionSchema = collectionSchema(
  institutionalInventoryRecordSchema,
)

export type InstitutionScopeIdentity = z.infer<typeof institutionScopeIdentitySchema>
export type DemoContextIdentity = z.infer<typeof demoContextIdentitySchema>
export type InstitutionalContextIdentity = z.infer<typeof institutionalContextIdentitySchema>
export type OverlayContextIdentity = z.infer<typeof overlayContextIdentitySchema>
export type AccessClassification = z.infer<typeof accessClassificationSchema>
export type InstitutionalAccessClassification = z.infer<
  typeof institutionalAccessClassificationSchema
>

export function sameInstitutionScope(
  left: InstitutionScopeIdentity,
  right: InstitutionScopeIdentity,
): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.institutionId === right.institutionId &&
    left.siteId === right.siteId
  )
}

export function sameOverlayContext(
  left: OverlayContextIdentity,
  right: OverlayContextIdentity,
): boolean {
  if (left.contextKind !== right.contextKind) return false
  if (left.contextKind === 'demo' && right.contextKind === 'demo') {
    return left.demoContextId === right.demoContextId
  }
  if (left.contextKind === 'institutional' && right.contextKind === 'institutional') {
    return sameInstitutionScope(left.scope, right.scope)
  }
  return false
}

/**
 * Registry scope keys. These two functions define the only scope-key formats the
 * identifier registry and the corpus projection-safety validator compare against.
 */
export function institutionScopeKey(scope: InstitutionScopeIdentity): string {
  return JSON.stringify([scope.tenantId, scope.institutionId, scope.siteId])
}

export function demoContextScopeKey(demoContextId: string): string {
  return `demo:${demoContextId}`
}

const scopeKey = institutionScopeKey

const accessRank: Record<AccessClassification, number> = {
  public_unlisted: 0,
  institution_restricted: 1,
  institution_confidential: 2,
}

/**
 * This is the exported access gate, so it fails closed on its own rather than trusting
 * every caller to have parsed its arguments first. Both arguments are re-parsed through
 * the classification schema before any comparison: a coercible object (array, boxed
 * string, `toString`/`Symbol.toPrimitive` carrier, proxy) is denied outright rather than
 * being used as a property key, where key coercion would invoke its conversion methods
 * and an `Object.prototype` name would compare two inherited functions as "allowed".
 */
export function accessAllows(projectionAccess: unknown, recordAccess: unknown): boolean {
  const projection = accessClassificationSchema.safeParse(projectionAccess)
  const record = accessClassificationSchema.safeParse(recordAccess)
  if (!projection.success || !record.success) return false
  if (projection.data === 'public_unlisted') return record.data === 'public_unlisted'
  if (record.data === 'public_unlisted') return false
  return accessRank[record.data] <= accessRank[projection.data]
}

function addDatasetIntegrityIssues(
  datasetContext: OverlayContextIdentity,
  records: Array<{
    recordId: string
    context: OverlayContextIdentity
    accessClassification: AccessClassification
    source: {
      context: OverlayContextIdentity
      accessClassification: AccessClassification
    }
  }>,
  diagnostics: Array<{
    diagnosticId: string
    context: OverlayContextIdentity
    relatedRecordId: string | null
    accessClassification: AccessClassification
  }>,
  context: z.RefinementCtx,
): void {
  const recordsById = new Map<string, (typeof records)[number]>()
  records.forEach((record, index) => {
    if (recordsById.has(record.recordId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['records', index, 'recordId'],
        message: 'Record IDs must be unique within one context dataset.',
      })
    }
    recordsById.set(record.recordId, record)
    if (!sameOverlayContext(datasetContext, record.context)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['records', index, 'context'],
        message: 'Every record must repeat the dataset exact context explicitly.',
      })
    }
    if (!sameOverlayContext(record.context, record.source.context)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['records', index, 'source', 'context'],
        message: 'Every source must repeat its record exact context explicitly.',
      })
    }
    if (record.accessClassification !== record.source.accessClassification) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['records', index, 'source', 'accessClassification'],
        message: 'A source and its record must use the same access classification.',
      })
    }
  })
  const diagnosticIds = new Set<string>()
  diagnostics.forEach((diagnostic, index) => {
    if (diagnosticIds.has(diagnostic.diagnosticId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['diagnostics', index, 'diagnosticId'],
        message: 'Diagnostic IDs must be unique within one context dataset.',
      })
    }
    diagnosticIds.add(diagnostic.diagnosticId)
    if (!sameOverlayContext(datasetContext, diagnostic.context)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['diagnostics', index, 'context'],
        message: 'Every diagnostic must repeat the dataset exact context explicitly.',
      })
    }
    if (diagnostic.relatedRecordId === null) return
    const referencedRecord = recordsById.get(diagnostic.relatedRecordId)
    if (!referencedRecord) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['diagnostics', index, 'relatedRecordId'],
        message: 'A related record ID must resolve within the same exact dataset and context.',
      })
      return
    }
    if (
      accessRank[diagnostic.accessClassification] <
      accessRank[referencedRecord.accessClassification]
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['diagnostics', index, 'accessClassification'],
        message: 'A diagnostic must be at least as access-restrictive as its referenced record.',
      })
    }
  })
}

function addApprovalSourceIssues(
  records: Array<{
    context: OverlayContextIdentity
    accessClassification: AccessClassification
    approvalState:
      | {
          state: 'approved' | 'not_approved'
          decisionSource: {
            context: OverlayContextIdentity
            accessClassification: AccessClassification
          }
        }
      | { state: 'pending_review' }
      | { state: 'unknown' }
  }>,
  context: z.RefinementCtx,
): void {
  records.forEach((record, index) => {
    if (
      record.approvalState.state !== 'approved' &&
      record.approvalState.state !== 'not_approved'
    ) {
      return
    }
    if (!sameOverlayContext(record.context, record.approvalState.decisionSource.context)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['formularies', 'records', index, 'approvalState', 'decisionSource', 'context'],
        message: 'An approval source must repeat its record exact context explicitly.',
      })
    }
    if (record.accessClassification !== record.approvalState.decisionSource.accessClassification) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [
          'formularies',
          'records',
          index,
          'approvalState',
          'decisionSource',
          'accessClassification',
        ],
        message: 'An approval source and its record must use the same access classification.',
      })
    }
  })
}

export const demoOverlayDatasetSchema = z
  .object({
    context: demoContextIdentitySchema,
    capabilities: demoCapabilityCollectionSchema,
    formularies: demoFormularyCollectionSchema,
    inventories: demoInventoryCollectionSchema,
    diagnostics: z.array(demoDataQualityDiagnosticSchema),
  })
  .strict()
  .superRefine((dataset, context) => {
    addDatasetIntegrityIssues(
      dataset.context,
      [
        ...dataset.capabilities.records,
        ...dataset.formularies.records,
        ...dataset.inventories.records,
      ],
      dataset.diagnostics,
      context,
    )
  })

export const institutionalOverlayDatasetSchema = z
  .object({
    context: institutionalContextIdentitySchema,
    capabilities: institutionalCapabilityCollectionSchema,
    formularies: institutionalFormularyCollectionSchema,
    inventories: institutionalInventoryCollectionSchema,
    diagnostics: z.array(institutionalDataQualityDiagnosticSchema),
  })
  .strict()
  .superRefine((dataset, context) => {
    addDatasetIntegrityIssues(
      dataset.context,
      [
        ...dataset.capabilities.records,
        ...dataset.formularies.records,
        ...dataset.inventories.records,
      ],
      dataset.diagnostics,
      context,
    )
    addApprovalSourceIssues(dataset.formularies.records, context)
  })

export const projectedDemoOverlayDatasetSchema = z
  .object({
    context: demoContextIdentitySchema,
    capabilities: collectionSchema(projectedDemoCapabilityRecordSchema),
    formularies: collectionSchema(projectedDemoFormularyRecordSchema),
    inventories: collectionSchema(projectedDemoInventoryRecordSchema),
    diagnostics: z.array(projectedDemoDataQualityDiagnosticSchema),
  })
  .strict()
  .superRefine((dataset, context) => {
    addDatasetIntegrityIssues(
      dataset.context,
      [
        ...dataset.capabilities.records,
        ...dataset.formularies.records,
        ...dataset.inventories.records,
      ],
      dataset.diagnostics,
      context,
    )
  })

export const projectedInstitutionalOverlayDatasetSchema = z
  .object({
    context: institutionalContextIdentitySchema,
    capabilities: collectionSchema(projectedInstitutionalCapabilityRecordSchema),
    formularies: collectionSchema(projectedInstitutionalFormularyRecordSchema),
    inventories: collectionSchema(projectedInstitutionalInventoryRecordSchema),
    diagnostics: z.array(projectedInstitutionalDataQualityDiagnosticSchema),
  })
  .strict()
  .superRefine((dataset, context) => {
    addDatasetIntegrityIssues(
      dataset.context,
      [
        ...dataset.capabilities.records,
        ...dataset.formularies.records,
        ...dataset.inventories.records,
      ],
      dataset.diagnostics,
      context,
    )
    addApprovalSourceIssues(dataset.formularies.records, context)
  })

/**
 * Bundle-wide identifier registry. Every scope-local identifier is registered to exactly
 * one scope, tier, and identifier kind, and the sealed corpus refuses:
 *
 * - the same identifier value registered under two scopes, tiers, or kinds;
 * - an identifier equal to any scope component anywhere in the bundle;
 * - an identifier containing another scope's distinctive component;
 * - an identifier containing another scope's identifier, or a same-scope identifier of a
 *   higher access tier;
 * - a governed code (capability code, subject, revision) containing any scope component
 *   or any scope-local identifier;
 * - internal authoring text containing another scope's component or identifier, or a
 *   same-scope identifier of a higher access tier;
 * - a scope-component value reused in a different structural position (a site named like
 *   a tenant, a demo context named like an institution).
 */
export type SealedBundleIdentifierKind =
  | 'recordId'
  | 'sourceId'
  | 'provenanceId'
  | 'formularyEntryId'
  | 'decisionId'
  | 'reviewReference'
  | 'diagnosticId'

export interface SealedBundleIdentifierEntry {
  value: string
  scopeKey: string
  tier: AccessClassification
  kind: SealedBundleIdentifierKind
  path: Array<string | number>
}

export interface SealedBundleScopeComponentEntry {
  value: string
  position: 'tenantId' | 'institutionId' | 'siteId' | 'demoContextId'
  scopeKey: string
  path: Array<string | number>
}

export interface SealedBundleGovernedCodeEntry {
  value: string
  kind: 'capabilityCode' | 'subjectId' | 'sourceRevision'
  scopeKey: string
  path: Array<string | number>
}

export interface SealedBundleInternalTextEntry {
  value: string
  scopeKey: string
  tier: AccessClassification
  path: Array<string | number>
}

export interface SealedBundleIdentifierEntries {
  components: SealedBundleScopeComponentEntry[]
  identifiers: SealedBundleIdentifierEntry[]
  governedCodes: SealedBundleGovernedCodeEntry[]
  internalTexts: SealedBundleInternalTextEntry[]
}

type BundleSourceForCollection =
  | z.infer<typeof institutionalSourceReferenceSchema>
  | z.infer<typeof demoSourceReferenceSchema>

export function collectSealedBundleIdentifierEntries(
  bundle: FictionalInstitutionalOverlayBundle,
): SealedBundleIdentifierEntries {
  const components: SealedBundleScopeComponentEntry[] = []
  const identifiers: SealedBundleIdentifierEntry[] = []
  const governedCodes: SealedBundleGovernedCodeEntry[] = []
  const internalTexts: SealedBundleInternalTextEntry[] = []

  function collectSource(
    source: BundleSourceForCollection,
    scope: string,
    tier: AccessClassification,
    path: Array<string | number>,
  ): void {
    identifiers.push({
      value: source.sourceId,
      scopeKey: scope,
      tier,
      kind: 'sourceId',
      path: [...path, 'sourceId'],
    })
    identifiers.push({
      value: source.provenance.provenanceId,
      scopeKey: scope,
      tier,
      kind: 'provenanceId',
      path: [...path, 'provenance', 'provenanceId'],
    })
    governedCodes.push({
      value: source.sourceRevision,
      kind: 'sourceRevision',
      scopeKey: scope,
      path: [...path, 'sourceRevision'],
    })
    const authoring = source.provenance.internalAuthoring
    internalTexts.push({
      value: authoring.sourceLabel,
      scopeKey: scope,
      tier,
      path: [...path, 'provenance', 'internalAuthoring', 'sourceLabel'],
    })
    internalTexts.push({
      value: authoring.sourceLocator,
      scopeKey: scope,
      tier,
      path: [...path, 'provenance', 'internalAuthoring', 'sourceLocator'],
    })
    internalTexts.push({
      value: authoring.jurisdiction,
      scopeKey: scope,
      tier,
      path: [...path, 'provenance', 'internalAuthoring', 'jurisdiction'],
    })
  }

  function collectDataset(
    dataset: DemoOverlayDataset | InstitutionalOverlayDataset,
    scope: string,
    basePath: Array<string | number>,
  ): void {
    const collections = [
      ['capabilities', dataset.capabilities] as const,
      ['formularies', dataset.formularies] as const,
      ['inventories', dataset.inventories] as const,
    ]
    collections.forEach(([collectionName, collection]) => {
      collection.records.forEach((record, recordIndex) => {
        const recordPath = [...basePath, collectionName, 'records', recordIndex]
        const tier = record.accessClassification
        identifiers.push({
          value: record.recordId,
          scopeKey: scope,
          tier,
          kind: 'recordId',
          path: [...recordPath, 'recordId'],
        })
        collectSource(record.source, scope, tier, [...recordPath, 'source'])
        if ('capabilityCode' in record) {
          governedCodes.push({
            value: record.capabilityCode,
            kind: 'capabilityCode',
            scopeKey: scope,
            path: [...recordPath, 'capabilityCode'],
          })
        }
        if ('subjectId' in record) {
          governedCodes.push({
            value: record.subjectId,
            kind: 'subjectId',
            scopeKey: scope,
            path: [...recordPath, 'subjectId'],
          })
        }
        if ('formularyEvidence' in record && record.formularyEvidence.state === 'listed') {
          identifiers.push({
            value: record.formularyEvidence.formularyEntryId,
            scopeKey: scope,
            tier,
            kind: 'formularyEntryId',
            path: [...recordPath, 'formularyEvidence', 'formularyEntryId'],
          })
        }
        if ('approvalState' in record) {
          const approval = record.approvalState
          if (approval.state === 'approved' || approval.state === 'not_approved') {
            identifiers.push({
              value: approval.decisionId,
              scopeKey: scope,
              tier,
              kind: 'decisionId',
              path: [...recordPath, 'approvalState', 'decisionId'],
            })
            collectSource(approval.decisionSource, scope, tier, [
              ...recordPath,
              'approvalState',
              'decisionSource',
            ])
          }
          if (approval.state === 'pending_review') {
            identifiers.push({
              value: approval.reviewReference,
              scopeKey: scope,
              tier,
              kind: 'reviewReference',
              path: [...recordPath, 'approvalState', 'reviewReference'],
            })
          }
        }
      })
    })
    dataset.diagnostics.forEach((diagnostic, diagnosticIndex) => {
      const diagnosticPath = [...basePath, 'diagnostics', diagnosticIndex]
      identifiers.push({
        value: diagnostic.diagnosticId,
        scopeKey: scope,
        tier: diagnostic.accessClassification,
        kind: 'diagnosticId',
        path: [...diagnosticPath, 'diagnosticId'],
      })
      internalTexts.push({
        value: diagnostic.message,
        scopeKey: scope,
        tier: diagnostic.accessClassification,
        path: [...diagnosticPath, 'message'],
      })
    })
  }

  bundle.demoDatasets.forEach((dataset, index) => {
    const scope = demoContextScopeKey(dataset.context.demoContextId)
    components.push({
      value: dataset.context.demoContextId,
      position: 'demoContextId',
      scopeKey: scope,
      path: ['demoDatasets', index, 'context', 'demoContextId'],
    })
    collectDataset(dataset, scope, ['demoDatasets', index])
  })
  bundle.institutionalDatasets.forEach((dataset, index) => {
    const scope = scopeKey(dataset.context.scope)
    ;(['tenantId', 'institutionId', 'siteId'] as const).forEach((position) => {
      components.push({
        value: dataset.context.scope[position],
        position,
        scopeKey: scope,
        path: ['institutionalDatasets', index, 'context', 'scope', position],
      })
    })
    collectDataset(dataset, scope, ['institutionalDatasets', index])
  })

  return { components, identifiers, governedCodes, internalTexts }
}

function addSealedBundleRegistryIssues(
  bundle: FictionalInstitutionalOverlayBundle,
  context: z.RefinementCtx,
): void {
  const { components, identifiers, governedCodes, internalTexts } =
    collectSealedBundleIdentifierEntries(bundle)

  const positionsByComponentValue = new Map<string, Set<string>>()
  components.forEach((component) => {
    const positions = positionsByComponentValue.get(component.value) ?? new Set<string>()
    positions.add(component.position)
    positionsByComponentValue.set(component.value, positions)
  })
  components.forEach((component) => {
    const positions = positionsByComponentValue.get(component.value)
    if (positions && positions.size > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: component.path,
        message: 'A scope component value cannot be reused in a different structural position.',
      })
    }
  })

  const componentValues = new Set(components.map((component) => component.value))
  const ownComponentValuesByScope = new Map<string, Set<string>>()
  components.forEach((component) => {
    const own = ownComponentValuesByScope.get(component.scopeKey) ?? new Set<string>()
    own.add(component.value)
    ownComponentValuesByScope.set(component.scopeKey, own)
  })
  const foreignComponentsFor = (scope: string): SealedBundleScopeComponentEntry[] => {
    const own = ownComponentValuesByScope.get(scope) ?? new Set<string>()
    return components.filter(
      (component) => component.scopeKey !== scope && !own.has(component.value),
    )
  }

  const registrations = new Map<string, SealedBundleIdentifierEntry>()
  identifiers.forEach((entry) => {
    const existing = registrations.get(entry.value)
    if (!existing) {
      registrations.set(entry.value, entry)
      return
    }
    if (
      existing.scopeKey !== entry.scopeKey ||
      existing.tier !== entry.tier ||
      existing.kind !== entry.kind
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: entry.path,
        message:
          'A scope-local identifier registers to exactly one scope, access tier, and identifier kind.',
      })
    }
  })
  const registered = Array.from(registrations.values())

  identifiers.forEach((entry) => {
    if (componentValues.has(entry.value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: entry.path,
        message: 'A scope-local identifier cannot equal a tenant, institution, site, or demo id.',
      })
    }
    foreignComponentsFor(entry.scopeKey).forEach((component) => {
      if (entry.value.includes(component.value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: entry.path,
          message: "A scope-local identifier cannot contain another scope's identity component.",
        })
      }
    })
    registered.forEach((other) => {
      if (other.value === entry.value || !entry.value.includes(other.value)) return
      if (other.scopeKey !== entry.scopeKey) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: entry.path,
          message: "A scope-local identifier cannot contain another scope's identifier.",
        })
      } else if (accessRank[other.tier] > accessRank[entry.tier]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: entry.path,
          message: 'An identifier cannot contain a same-scope identifier of a higher tier.',
        })
      }
    })
  })

  governedCodes.forEach((code) => {
    componentValues.forEach((componentValue) => {
      if (code.value.includes(componentValue)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: code.path,
          message: 'A governed code cannot contain any scope identity component.',
        })
      }
    })
    registered.forEach((entry) => {
      if (code.value.includes(entry.value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: code.path,
          message: 'A governed code cannot contain any scope-local identifier.',
        })
      }
    })
  })

  internalTexts.forEach((text) => {
    foreignComponentsFor(text.scopeKey).forEach((component) => {
      if (text.value.includes(component.value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: text.path,
          message: "Internal authoring text cannot contain another scope's identity component.",
        })
      }
    })
    registered.forEach((entry) => {
      if (!text.value.includes(entry.value)) return
      if (entry.scopeKey !== text.scopeKey) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: text.path,
          message: "Internal authoring text cannot contain another scope's identifier.",
        })
      } else if (accessRank[entry.tier] > accessRank[text.tier]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: text.path,
          message:
            'Internal authoring text cannot contain a same-scope identifier of a higher tier.',
        })
      }
    })
  })
}

export const fictionalInstitutionalOverlayBundleSchema = z
  .object({
    foundationLabels: institutionalContractFoundationLabelsSchema,
    fixturePolicy: z.literal('fictional_only'),
    demoDatasets: z.array(demoOverlayDatasetSchema),
    institutionalDatasets: z.array(institutionalOverlayDatasetSchema),
  })
  .strict()
  .superRefine((bundle, context) => {
    const demoIds = new Set<string>()
    bundle.demoDatasets.forEach((dataset, index) => {
      if (demoIds.has(dataset.context.demoContextId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['demoDatasets', index, 'context', 'demoContextId'],
          message: 'Demo context IDs must be unique.',
        })
      }
      demoIds.add(dataset.context.demoContextId)
    })

    const scopeKeys = new Set<string>()
    bundle.institutionalDatasets.forEach((dataset, index) => {
      const key = scopeKey(dataset.context.scope)
      if (scopeKeys.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['institutionalDatasets', index, 'context', 'scope'],
          message: 'Institutional datasets must have unique full scope tuples.',
        })
      }
      scopeKeys.add(key)
    })

    const sources = [
      ...bundle.demoDatasets.flatMap((dataset) => [
        ...dataset.capabilities.records.map((record) => record.source),
        ...dataset.inventories.records.map((record) => record.source),
        ...dataset.formularies.records.map((record) => record.source),
      ]),
      ...bundle.institutionalDatasets.flatMap((dataset) => [
        ...dataset.capabilities.records.map((record) => record.source),
        ...dataset.inventories.records.map((record) => record.source),
        ...dataset.formularies.records.flatMap((record) => [
          record.source,
          ...('decisionSource' in record.approvalState
            ? [record.approvalState.decisionSource]
            : []),
        ]),
      ]),
    ]
    sources.forEach((source, index) => {
      if (source.provenance.provenanceClass !== 'fictional_fixture') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sources', index, 'provenance', 'provenanceClass'],
          message: 'The fictional adapter accepts fictional_fixture provenance only.',
        })
      }
    })

    addSealedBundleRegistryIssues(bundle, context)
  })

export const demoProjectionRequestSchema = z
  .object({
    contextKind: z.literal('demo'),
    demoContextId: scopeComponentIdentifierSchema,
    accessClassification: z.literal('public_unlisted'),
    projectionTimestamp: isoInstantSchema,
  })
  .strict()

export const institutionalProjectionRequestSchema = z
  .object({
    contextKind: z.literal('institutional'),
    scope: institutionScopeIdentitySchema,
    accessClassification: institutionalAccessClassificationSchema,
    projectionTimestamp: isoInstantSchema,
  })
  .strict()

/**
 * Direct schema use reads properties the way zod does and therefore resolves inherited
 * values. Runtime callers must go through {@link parseOverlayProjectionRequest}, which
 * verifies the original value is a plain own-property data object first.
 */
export const overlayProjectionRequestSchema = z.discriminatedUnion('contextKind', [
  demoProjectionRequestSchema,
  institutionalProjectionRequestSchema,
])

/**
 * Pre-parse boundary for runtime request objects. Zod reads `data[key]`, which resolves
 * getters and prototype-inherited values, so a request built with
 * `Object.create(validRequest)` would otherwise satisfy every field without owning any of
 * them. This boundary accepts only a plain data object — prototype exactly
 * `Object.prototype` (or `null`, which cannot inherit anything), no symbol keys, no
 * accessor or non-enumerable properties — and then copies its own enumerable data
 * properties exactly once into a fresh object before zod sees it, so nothing the caller
 * controls is re-read after validation begins.
 *
 * The snapshot is built on a null prototype and every key is installed with
 * `Object.defineProperty`. Plain assignment into a `{}` destination would route the
 * attacker-controlled key `__proto__` through the setter inherited from
 * `Object.prototype`: a JSON payload whose single own key is `__proto__` would then
 * install its value as the snapshot's prototype instead of as data, leaving a snapshot
 * with no own keys whose inherited properties satisfy every required field. Defining the
 * property on a prototype-less destination keeps `__proto__` an ordinary own data key, so
 * the strict schema rejects it as unrecognized rather than reading through it.
 */
function plainOwnDataCopy(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object.`)
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must not carry a custom prototype.`)
  }
  const copy = Object.create(null) as Record<string, unknown>
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      throw new Error(`${label} must not carry symbol-keyed properties.`)
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !('value' in descriptor)) {
      throw new Error(`${label} must not carry accessor properties.`)
    }
    if (!descriptor.enumerable) {
      throw new Error(`${label} must not carry non-enumerable properties.`)
    }
    Object.defineProperty(copy, key, {
      value: descriptor.value,
      enumerable: true,
      writable: true,
      configurable: true,
    })
  }
  return copy
}

/**
 * Structural non-Proxy admission gate.
 *
 * {@link plainOwnDataCopy} interrogates the input only through reflection —
 * `Object.getPrototypeOf`, `Reflect.ownKeys`, `Object.getOwnPropertyDescriptor` — and every
 * one of those operations is itself controlled by a Proxy's traps. A Proxy over an empty
 * target can therefore report `Object.prototype`, report the four keys of a valid request,
 * and hand back enumerable data descriptors carrying the corresponding values, so it passes
 * the reflection-only snapshot and the strict schema while owning no data at all. A coherent
 * Proxy can satisfy any finite reflection-only interrogation, so no amount of re-reading or
 * cross-checking descriptors can distinguish it from a plain object; the boundary needs a
 * check the request cannot influence.
 *
 * The structured-clone algorithm is that check. It is a host primitive that walks the input
 * graph and refuses Proxy exotic objects with a `DataCloneError`, at the top level or nested
 * anywhere inside it, and it cannot be intercepted by a trap. It is not a substitute for the
 * descriptor snapshot: structured cloning silently resolves an ordinary getter into a data
 * value, so accessor, symbol, non-enumerable, unknown-key, and type failures must still be
 * caught by {@link plainOwnDataCopy} and the schema first. Only a candidate that has already
 * passed those structural checks reaches this gate, whose sole job is to establish that the
 * original input graph is composed of serializable ordinary data rather than Proxy exotic
 * objects. A clone failure becomes a generic refusal that names no field value, and the
 * clone result is discarded — the authoritative parsed request is still the snapshot.
 *
 * The clone operation is supplied by the caller as an already-captured reference rather than
 * resolved here. `structuredClone` is a writable, configurable property of the global object,
 * and every reflection operation in {@link plainOwnDataCopy} runs before this gate, so a
 * Proxy trap firing during the snapshot could otherwise overwrite the global and hand this
 * gate a permissive stand-in — one that can even restore the real intrinsic as it returns,
 * leaving no lasting global drift to detect afterwards. Resolving the intrinsic before any
 * attacker-controlled trap can execute is what makes the check unforgeable; see
 * {@link captureCloneIntrinsic}.
 *
 * If the host lacks `structuredClone` the gate fails closed: without it the boundary cannot
 * prove the input is not a Proxy, and admitting an unprovable input would reopen the bypass.
 * The repository's supported production runtimes provide it.
 */
function assertNonProxyStructuredData(
  value: unknown,
  cloneIntrinsic: (value: unknown) => unknown,
  label: string,
): void {
  try {
    cloneIntrinsic(value)
  } catch {
    throw new Error(`${label} could not be admitted as plain structured data.`)
  }
}

/**
 * Resolves the host structured-clone primitive once, bound to the global object, returning
 * `null` when the host does not provide it so the caller can fail closed.
 *
 * This must be called before the request is touched by reflection. Nothing the caller
 * controls runs between entering the boundary and this capture — receiving a reference to
 * the input executes no trap — so the reference obtained here is the genuine intrinsic even
 * when the request later replaces the global. Binding keeps the call independent of how the
 * host expects the primitive to be invoked.
 */
function captureCloneIntrinsic(): ((value: unknown) => unknown) | null {
  const candidate = globalThis.structuredClone
  return typeof candidate === 'function' ? candidate.bind(globalThis) : null
}

export function parseOverlayProjectionRequest(input: unknown): OverlayProjectionRequest {
  // Captured first, before any reflection below can run a Proxy trap that would replace the
  // mutable global the final gate depends on.
  const cloneIntrinsic = captureCloneIntrinsic()
  if (!cloneIntrinsic) {
    throw new Error('A projection request could not be admitted as plain structured data.')
  }
  const copy = plainOwnDataCopy(input, 'A projection request')
  // `in` would traverse a prototype chain; the snapshot has none, but an own-property
  // check states the intent and cannot be satisfied by anything the caller inherited.
  if (Object.hasOwn(copy, 'scope')) {
    copy.scope = plainOwnDataCopy(copy.scope, 'A projection request scope')
  }
  const parsed = overlayProjectionRequestSchema.parse(copy)
  // Final gate: the reflection-only snapshot above cannot tell a plain object from a Proxy
  // that synthesizes one through its traps, so refuse any input the structured-clone
  // algorithm rejects as a Proxy exotic object before returning the parsed request. This
  // runs only after the structural and schema checks have passed, and no projection is
  // built from the result until it does. The clone reference was captured on entry, so the
  // traps that just ran could not have substituted it.
  assertNonProxyStructuredData(input, cloneIntrinsic, 'A projection request')
  return parsed
}

const projectionFields = {
  foundationLabels: institutionalContractFoundationLabelsSchema,
  fixturePolicy: z.literal('fictional_only'),
  projectionTimestamp: isoInstantSchema,
}

function addProjectionTimeIssues(
  projectionTimestamp: string,
  sources: Array<{ lastVerifiedAt: string }>,
  diagnostics: Array<{ observedAt: string }>,
  context: z.RefinementCtx,
): void {
  const projectedAt = Date.parse(projectionTimestamp)
  // A NaN on either side would make every `>` below false and quietly disable the guard, so
  // an unreadable instant is treated as a failure rather than as "not after".
  const isAfter = (instant: string): boolean => {
    const at = Date.parse(instant)
    return !Number.isFinite(at) || !Number.isFinite(projectedAt) || at > projectedAt
  }
  sources.forEach((source, index) => {
    if (isAfter(source.lastVerifiedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataset', 'sources', index, 'lastVerifiedAt'],
        message: 'A projection cannot include evidence verified after its projection timestamp.',
      })
    }
  })
  diagnostics.forEach((diagnostic, index) => {
    if (isAfter(diagnostic.observedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataset', 'diagnostics', index, 'observedAt'],
        message: 'A projection cannot include a diagnostic observed after its timestamp.',
      })
    }
  })
}

export const demoOverlayProjectionSchema = z
  .object({
    ...projectionFields,
    accessClassification: z.literal('public_unlisted'),
    dataset: projectedDemoOverlayDatasetSchema,
  })
  .strict()
  .superRefine((projection, context) => {
    const sources = [
      ...projection.dataset.capabilities.records.map((record) => record.source),
      ...projection.dataset.formularies.records.map((record) => record.source),
      ...projection.dataset.inventories.records.map((record) => record.source),
    ]
    addProjectionTimeIssues(
      projection.projectionTimestamp,
      sources,
      projection.dataset.diagnostics,
      context,
    )
  })

export const institutionalOverlayProjectionSchema = z
  .object({
    ...projectionFields,
    accessClassification: institutionalAccessClassificationSchema,
    dataset: projectedInstitutionalOverlayDatasetSchema,
  })
  .strict()
  .superRefine((projection, context) => {
    const records = [
      ...projection.dataset.capabilities.records,
      ...projection.dataset.formularies.records,
      ...projection.dataset.inventories.records,
    ]
    records.forEach((record, index) => {
      if (!accessAllows(projection.accessClassification, record.accessClassification)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataset', 'records', index, 'accessClassification'],
          message: 'A projection cannot include data above its access classification.',
        })
      }
    })
    projection.dataset.diagnostics.forEach((diagnostic, index) => {
      if (!accessAllows(projection.accessClassification, diagnostic.accessClassification)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataset', 'diagnostics', index, 'accessClassification'],
          message: 'A projection cannot include a diagnostic above its access classification.',
        })
      }
    })
    const sources = records.flatMap((record) => [
      record.source,
      ...('approvalState' in record && 'decisionSource' in record.approvalState
        ? [record.approvalState.decisionSource]
        : []),
    ])
    addProjectionTimeIssues(
      projection.projectionTimestamp,
      sources,
      projection.dataset.diagnostics,
      context,
    )
  })

export const overlayProjectionSchema = z.union([
  demoOverlayProjectionSchema,
  institutionalOverlayProjectionSchema,
])

export type DataSourceState = z.infer<typeof dataSourceStateSchema>
export type SourceStateReason = z.infer<typeof sourceStateReasonSchema>
export type UnknownReason = z.infer<typeof unknownReasonSchema>
export type DemoCapabilityRecord = z.infer<typeof demoCapabilityRecordSchema>
export type InstitutionalCapabilityRecord = z.infer<typeof institutionalCapabilityRecordSchema>
export type DemoFormularyRecord = z.infer<typeof demoFormularyRecordSchema>
export type InstitutionalFormularyRecord = z.infer<typeof institutionalFormularyRecordSchema>
export type DemoInventoryRecord = z.infer<typeof demoInventoryRecordSchema>
export type InstitutionalInventoryRecord = z.infer<typeof institutionalInventoryRecordSchema>
export type DemoOverlayDataset = z.infer<typeof demoOverlayDatasetSchema>
export type InstitutionalOverlayDataset = z.infer<typeof institutionalOverlayDatasetSchema>
export type ProjectedDemoCapabilityRecord = z.infer<typeof projectedDemoCapabilityRecordSchema>
export type ProjectedInstitutionalCapabilityRecord = z.infer<
  typeof projectedInstitutionalCapabilityRecordSchema
>
export type ProjectedDemoInventoryRecord = z.infer<typeof projectedDemoInventoryRecordSchema>
export type ProjectedInstitutionalInventoryRecord = z.infer<
  typeof projectedInstitutionalInventoryRecordSchema
>
export type ProjectedDemoOverlayDataset = z.infer<typeof projectedDemoOverlayDatasetSchema>
export type ProjectedInstitutionalOverlayDataset = z.infer<
  typeof projectedInstitutionalOverlayDatasetSchema
>
export type FictionalInstitutionalOverlayBundle = z.infer<
  typeof fictionalInstitutionalOverlayBundleSchema
>
export type OverlayProjectionRequest = z.infer<typeof overlayProjectionRequestSchema>
export type DemoOverlayProjection = z.infer<typeof demoOverlayProjectionSchema>
export type InstitutionalOverlayProjection = z.infer<typeof institutionalOverlayProjectionSchema>
export type OverlayProjection = z.infer<typeof overlayProjectionSchema>
