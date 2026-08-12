import {
  INSTITUTIONAL_CONTRACT_FOUNDATION_LABELS,
  accessAllows,
  demoOverlayProjectionSchema,
  fictionalInstitutionalOverlayBundleSchema,
  institutionalOverlayProjectionSchema,
  overlayProjectionRequestSchema,
  sameInstitutionScope,
  type DemoCapabilityRecord,
  type DemoInventoryRecord,
  type FictionalInstitutionalOverlayBundle,
  type InstitutionalCapabilityRecord,
  type InstitutionalAccessClassification,
  type InstitutionalInventoryRecord,
  type OverlayProjection,
} from './contracts'

/**
 * INSTITUTIONAL CONTRACT FOUNDATION
 * FICTIONAL DATA ONLY
 * NOT A DEPLOYED INSTITUTION MODEL
 *
 * This adapter intentionally has one operation: a read-only projection. It has no storage,
 * ingestion, mutation, authentication, user-metadata, or institutional-inference path.
 */

export interface FictionalInstitutionalOverlayReadAdapter {
  readonly project: (request: unknown) => OverlayProjection
}

export function diagnosticVisibleInProjection(
  diagnostic: {
    accessClassification: InstitutionalAccessClassification
    relatedRecordId: string | null
  },
  projectionAccess: InstitutionalAccessClassification,
  includedRecordIds: ReadonlySet<string>,
): boolean {
  return (
    accessAllows(projectionAccess, diagnostic.accessClassification) &&
    (diagnostic.relatedRecordId === null || includedRecordIds.has(diagnostic.relatedRecordId))
  )
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child))
    Object.freeze(value)
  }
  return value
}

function unavailableCollections(reason: string) {
  return {
    capabilities: {
      sourceState: { state: 'unknown' as const, reason },
      records: [],
    },
    formularies: {
      sourceState: { state: 'unknown' as const, reason },
      records: [],
    },
    inventories: {
      sourceState: { state: 'unknown' as const, reason },
      records: [],
    },
  }
}

export function createFictionalInstitutionalOverlayReadAdapter(
  input: unknown,
): FictionalInstitutionalOverlayReadAdapter {
  const bundle: FictionalInstitutionalOverlayBundle =
    fictionalInstitutionalOverlayBundleSchema.parse(input)
  deepFreeze(bundle)

  const adapter: FictionalInstitutionalOverlayReadAdapter = {
    project(requestInput: unknown): OverlayProjection {
      const request = overlayProjectionRequestSchema.parse(requestInput)

      if (request.contextKind === 'demo') {
        const configured = bundle.demoDatasets.find(
          (dataset) => dataset.context.demoContextId === request.demoContextId,
        )
        const dataset =
          configured ??
          ({
            context: {
              contextKind: 'demo',
              demoContextId: request.demoContextId,
            },
            ...unavailableCollections('The requested fictional demo context is not configured.'),
            diagnostics: [
              {
                diagnosticId: 'fictional-demo-scope-not-configured',
                code: 'scope_not_configured',
                severity: 'blocking',
                message: 'No fictional dataset exists for this exact demo context.',
                observedAt: request.projectionTimestamp,
                relatedRecordId: null,
                context: {
                  contextKind: 'demo',
                  demoContextId: request.demoContextId,
                },
                accessClassification: 'public_unlisted',
              },
            ],
          } as const)

        return deepFreeze(
          demoOverlayProjectionSchema.parse({
            foundationLabels: [...INSTITUTIONAL_CONTRACT_FOUNDATION_LABELS],
            fixturePolicy: 'fictional_only',
            projectionTimestamp: request.projectionTimestamp,
            accessClassification: 'public_unlisted',
            dataset,
          }),
        )
      }

      const configured = bundle.institutionalDatasets.find((dataset) =>
        sameInstitutionScope(dataset.context.scope, request.scope),
      )
      const context = {
        contextKind: 'institutional' as const,
        scope: request.scope,
      }
      const includedRecordIds = configured
        ? new Set(
            [
              ...configured.capabilities.records,
              ...configured.formularies.records,
              ...configured.inventories.records,
            ]
              .filter((record) =>
                accessAllows(request.accessClassification, record.accessClassification),
              )
              .map((record) => record.recordId),
          )
        : new Set<string>()
      const dataset = configured
        ? {
            context: configured.context,
            capabilities: {
              sourceState: configured.capabilities.sourceState,
              records: configured.capabilities.records.filter((record) =>
                accessAllows(request.accessClassification, record.accessClassification),
              ),
            },
            formularies: {
              sourceState: configured.formularies.sourceState,
              records: configured.formularies.records.filter((record) =>
                accessAllows(request.accessClassification, record.accessClassification),
              ),
            },
            inventories: {
              sourceState: configured.inventories.sourceState,
              records: configured.inventories.records.filter((record) =>
                accessAllows(request.accessClassification, record.accessClassification),
              ),
            },
            diagnostics: configured.diagnostics.filter((diagnostic) =>
              diagnosticVisibleInProjection(
                diagnostic,
                request.accessClassification,
                includedRecordIds,
              ),
            ),
          }
        : {
            context,
            ...unavailableCollections(
              'The requested full fictional institution scope is not configured.',
            ),
            diagnostics: [
              {
                diagnosticId: 'fictional-institution-scope-not-configured',
                code: 'scope_not_configured' as const,
                severity: 'blocking' as const,
                message:
                  'No fictional dataset exists for this exact tenant/institution/site tuple.',
                observedAt: request.projectionTimestamp,
                relatedRecordId: null,
                context,
                accessClassification: request.accessClassification,
              },
            ],
          }

      return deepFreeze(
        institutionalOverlayProjectionSchema.parse({
          foundationLabels: [...INSTITUTIONAL_CONTRACT_FOUNDATION_LABELS],
          fixturePolicy: 'fictional_only',
          projectionTimestamp: request.projectionTimestamp,
          accessClassification: request.accessClassification,
          dataset,
        }),
      )
    },
  }

  return Object.freeze(adapter)
}

type CapabilityRecord = DemoCapabilityRecord | InstitutionalCapabilityRecord
type InventoryRecord = DemoInventoryRecord | InstitutionalInventoryRecord

export type CapabilityLookupResult =
  | { lookupState: 'observed'; record: CapabilityRecord }
  | { lookupState: 'unknown'; reason: string }
  | { lookupState: 'unavailable'; reason: string }

export type InventoryLookupResult =
  | { lookupState: 'observed'; record: InventoryRecord }
  | { lookupState: 'unknown'; reason: string }
  | { lookupState: 'unavailable'; reason: string }

/**
 * Missing rows remain unknown. Only an explicit capability record may say unavailable.
 */
export function lookupCapability(
  projection: OverlayProjection,
  capabilityCode: string,
): CapabilityLookupResult {
  const sourceState = projection.dataset.capabilities.sourceState
  if (sourceState.state === 'unavailable') {
    return { lookupState: 'unavailable', reason: sourceState.reason }
  }
  if (sourceState.state === 'unknown') {
    return { lookupState: 'unknown', reason: sourceState.reason }
  }
  const record = projection.dataset.capabilities.records.find(
    (candidate) => candidate.capabilityCode === capabilityCode,
  )
  return record
    ? { lookupState: 'observed', record }
    : {
        lookupState: 'unknown',
        reason: 'No matching capability record exists in the exact projected context.',
      }
}

/**
 * Missing rows remain unknown. Only an explicit inventory record may say absent.
 */
export function lookupInventory(
  projection: OverlayProjection,
  subjectId: string,
): InventoryLookupResult {
  const sourceState = projection.dataset.inventories.sourceState
  if (sourceState.state === 'unavailable') {
    return { lookupState: 'unavailable', reason: sourceState.reason }
  }
  if (sourceState.state === 'unknown') {
    return { lookupState: 'unknown', reason: sourceState.reason }
  }
  const record = projection.dataset.inventories.records.find(
    (candidate) => candidate.subjectId === subjectId,
  )
  return record
    ? { lookupState: 'observed', record }
    : {
        lookupState: 'unknown',
        reason: 'No matching inventory record exists in the exact projected context.',
      }
}
