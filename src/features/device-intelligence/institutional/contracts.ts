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

const identifierSchema = z.string().trim().min(1).max(160)
const explanatoryTextSchema = z.string().trim().min(1).max(1_000)
const isoInstantSchema = z.string().datetime({ offset: true })

export const institutionScopeIdentitySchema = z
  .object({
    tenantId: identifierSchema,
    institutionId: identifierSchema,
    siteId: identifierSchema,
  })
  .strict()

export const demoContextIdentitySchema = z
  .object({
    contextKind: z.literal('demo'),
    demoContextId: identifierSchema,
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

export const sourceProvenanceSchema = z
  .object({
    provenanceId: identifierSchema,
    sourceLabel: explanatoryTextSchema,
    sourceLocator: explanatoryTextSchema,
    jurisdiction: explanatoryTextSchema,
    provenanceClass: z.enum([
      'fictional_fixture',
      'institution_record',
      'system_export',
      'official_document',
    ]),
  })
  .strict()

const sourceReferenceFields = {
  sourceId: identifierSchema,
  sourceKind: sourceKindSchema,
  sourceRevision: identifierSchema,
  provenance: sourceProvenanceSchema,
  lastVerifiedAt: isoInstantSchema,
}

export const demoSourceReferenceSchema = z
  .object({
    ...sourceReferenceFields,
    context: demoContextIdentitySchema,
    accessClassification: z.literal('public_unlisted'),
  })
  .strict()

export const institutionalSourceReferenceSchema = z
  .object({
    ...sourceReferenceFields,
    context: institutionalContextIdentitySchema,
    accessClassification: institutionalAccessClassificationSchema,
  })
  .strict()

export const dataSourceStateSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('available') }).strict(),
  z
    .object({
      state: z.literal('unknown'),
      reason: explanatoryTextSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal('unavailable'),
      reason: explanatoryTextSchema,
    })
    .strict(),
])

export const unknownReasonSchema = z.enum([
  'not_reported',
  'not_verified',
  'stale_source',
  'source_unavailable',
  'no_matching_record',
])

export const capabilityStateSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('available'),
      statement: explanatoryTextSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal('unavailable'),
      statement: explanatoryTextSchema,
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
      unit: identifierSchema,
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
      statement: explanatoryTextSchema,
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
      formularyEntryId: identifierSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal('not_listed'),
      statement: explanatoryTextSchema,
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

export const demoInstitutionApprovalStateSchema = z
  .object({
    state: z.literal('not_applicable_demo'),
    reason: z.literal('demo_context'),
  })
  .strict()

export const institutionalApprovalStateSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('approved'),
      decisionId: identifierSchema,
      decisionSource: institutionalApprovalSourceSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal('not_approved'),
      decisionId: identifierSchema,
      decisionSource: institutionalApprovalSourceSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal('pending_review'),
      reviewReference: identifierSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal('unknown'),
      reason: unknownReasonSchema,
    })
    .strict(),
])

const demoCapabilitySourceSchema = demoSourceReferenceSchema
  .extend({ sourceKind: z.literal('capability') })
  .strict()
const institutionalCapabilitySourceSchema = institutionalSourceReferenceSchema
  .extend({ sourceKind: z.literal('capability') })
  .strict()
const demoFormularySourceSchema = demoSourceReferenceSchema
  .extend({ sourceKind: z.literal('formulary') })
  .strict()
const institutionalFormularySourceSchema = institutionalSourceReferenceSchema
  .extend({ sourceKind: z.literal('formulary') })
  .strict()
const demoInventorySourceSchema = demoSourceReferenceSchema
  .extend({ sourceKind: z.literal('inventory') })
  .strict()
const institutionalInventorySourceSchema = institutionalSourceReferenceSchema
  .extend({ sourceKind: z.literal('inventory') })
  .strict()

const demoRecordIdentityFields = {
  recordId: identifierSchema,
  context: demoContextIdentitySchema,
  accessClassification: z.literal('public_unlisted'),
}
const institutionalRecordIdentityFields = {
  recordId: identifierSchema,
  context: institutionalContextIdentitySchema,
  accessClassification: institutionalAccessClassificationSchema,
}

export const demoCapabilityRecordSchema = z
  .object({
    ...demoRecordIdentityFields,
    capabilityCode: identifierSchema,
    capabilityState: capabilityStateSchema,
    source: demoCapabilitySourceSchema,
  })
  .strict()

export const institutionalCapabilityRecordSchema = z
  .object({
    ...institutionalRecordIdentityFields,
    capabilityCode: identifierSchema,
    capabilityState: capabilityStateSchema,
    source: institutionalCapabilitySourceSchema,
  })
  .strict()

export const demoFormularyRecordSchema = z
  .object({
    ...demoRecordIdentityFields,
    subjectId: identifierSchema,
    formularyEvidence: formularyEvidenceStateSchema,
    approvalState: demoInstitutionApprovalStateSchema,
    source: demoFormularySourceSchema,
  })
  .strict()

export const institutionalFormularyRecordSchema = z
  .object({
    ...institutionalRecordIdentityFields,
    subjectId: identifierSchema,
    formularyEvidence: formularyEvidenceStateSchema,
    approvalState: institutionalApprovalStateSchema,
    source: institutionalFormularySourceSchema,
  })
  .strict()

export const demoInventoryRecordSchema = z
  .object({
    ...demoRecordIdentityFields,
    subjectId: identifierSchema,
    inventoryState: inventoryStateSchema,
    source: demoInventorySourceSchema,
  })
  .strict()

export const institutionalInventoryRecordSchema = z
  .object({
    ...institutionalRecordIdentityFields,
    subjectId: identifierSchema,
    inventoryState: inventoryStateSchema,
    source: institutionalInventorySourceSchema,
  })
  .strict()

export const dataQualityDiagnosticCodeSchema = z.enum([
  'scope_not_configured',
  'missing_capability_record',
  'missing_inventory_record',
  'source_unavailable',
  'stale_source',
  'approval_unverified',
])

const diagnosticFields = {
  diagnosticId: identifierSchema,
  code: dataQualityDiagnosticCodeSchema,
  severity: z.enum(['info', 'warning', 'blocking']),
  message: explanatoryTextSchema,
  observedAt: isoInstantSchema,
  relatedRecordId: identifierSchema.nullable(),
}

export const demoDataQualityDiagnosticSchema = z
  .object({
    ...diagnosticFields,
    context: demoContextIdentitySchema,
    accessClassification: z.literal('public_unlisted'),
  })
  .strict()

export const institutionalDataQualityDiagnosticSchema = z
  .object({
    ...diagnosticFields,
    context: institutionalContextIdentitySchema,
    accessClassification: institutionalAccessClassificationSchema,
  })
  .strict()

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

function scopeKey(scope: InstitutionScopeIdentity): string {
  return JSON.stringify([scope.tenantId, scope.institutionId, scope.siteId])
}

const accessRank: Record<z.infer<typeof accessClassificationSchema>, number> = {
  public_unlisted: 0,
  institution_restricted: 1,
  institution_confidential: 2,
}

function addDatasetIntegrityIssues(
  datasetContext: OverlayContextIdentity,
  records: Array<{
    recordId: string
    context: OverlayContextIdentity
    accessClassification: z.infer<typeof accessClassificationSchema>
    source: {
      context: OverlayContextIdentity
      accessClassification: z.infer<typeof accessClassificationSchema>
    }
  }>,
  diagnostics: Array<{
    diagnosticId: string
    context: OverlayContextIdentity
    relatedRecordId: string | null
    accessClassification: z.infer<typeof accessClassificationSchema>
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
  diagnostics.forEach((diagnostic, index) => {
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
    dataset.formularies.records.forEach((record, index) => {
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
      if (
        record.accessClassification !== record.approvalState.decisionSource.accessClassification
      ) {
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
  })

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
  })

export const demoProjectionRequestSchema = z
  .object({
    contextKind: z.literal('demo'),
    demoContextId: identifierSchema,
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

export const overlayProjectionRequestSchema = z.discriminatedUnion('contextKind', [
  demoProjectionRequestSchema,
  institutionalProjectionRequestSchema,
])

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
  sources.forEach((source, index) => {
    if (Date.parse(source.lastVerifiedAt) > projectedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataset', 'sources', index, 'lastVerifiedAt'],
        message: 'A projection cannot include evidence verified after its projection timestamp.',
      })
    }
  })
  diagnostics.forEach((diagnostic, index) => {
    if (Date.parse(diagnostic.observedAt) > projectedAt) {
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
    dataset: demoOverlayDatasetSchema,
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

export function accessAllows(
  projectionAccess: z.infer<typeof accessClassificationSchema>,
  recordAccess: z.infer<typeof accessClassificationSchema>,
): boolean {
  if (projectionAccess === 'public_unlisted') return recordAccess === 'public_unlisted'
  if (recordAccess === 'public_unlisted') return false
  return accessRank[recordAccess] <= accessRank[projectionAccess]
}

export const institutionalOverlayProjectionSchema = z
  .object({
    ...projectionFields,
    accessClassification: institutionalAccessClassificationSchema,
    dataset: institutionalOverlayDatasetSchema,
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
export type DemoCapabilityRecord = z.infer<typeof demoCapabilityRecordSchema>
export type InstitutionalCapabilityRecord = z.infer<typeof institutionalCapabilityRecordSchema>
export type DemoFormularyRecord = z.infer<typeof demoFormularyRecordSchema>
export type InstitutionalFormularyRecord = z.infer<typeof institutionalFormularyRecordSchema>
export type DemoInventoryRecord = z.infer<typeof demoInventoryRecordSchema>
export type InstitutionalInventoryRecord = z.infer<typeof institutionalInventoryRecordSchema>
export type DemoOverlayDataset = z.infer<typeof demoOverlayDatasetSchema>
export type InstitutionalOverlayDataset = z.infer<typeof institutionalOverlayDatasetSchema>
export type FictionalInstitutionalOverlayBundle = z.infer<
  typeof fictionalInstitutionalOverlayBundleSchema
>
export type OverlayProjectionRequest = z.infer<typeof overlayProjectionRequestSchema>
export type DemoOverlayProjection = z.infer<typeof demoOverlayProjectionSchema>
export type InstitutionalOverlayProjection = z.infer<typeof institutionalOverlayProjectionSchema>
export type OverlayProjection = z.infer<typeof overlayProjectionSchema>
