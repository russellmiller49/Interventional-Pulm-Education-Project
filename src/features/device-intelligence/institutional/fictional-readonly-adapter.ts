import {
  DIAGNOSTIC_MESSAGE_TEMPLATE_KEY_BY_CODE,
  INSTITUTIONAL_CONTRACT_FOUNDATION_LABELS,
  accessAllows,
  collectSealedBundleIdentifierEntries,
  demoContextScopeKey,
  demoOverlayProjectionSchema,
  fictionalInstitutionalOverlayBundleSchema,
  institutionScopeKey,
  institutionalOverlayProjectionSchema,
  parseOverlayProjectionRequestJson,
  sameInstitutionScope,
  type DemoOverlayDataset,
  type FictionalInstitutionalOverlayBundle,
  type InstitutionalAccessClassification,
  type InstitutionalOverlayDataset,
  type OverlayProjection,
  type ProjectedDemoCapabilityRecord,
  type ProjectedDemoInventoryRecord,
  type ProjectedInstitutionalCapabilityRecord,
  type ProjectedInstitutionalInventoryRecord,
  type SourceStateReason,
  type UnknownReason,
} from './contracts'
import { FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE } from './fictional-fixtures'

/**
 * INSTITUTIONAL CONTRACT FOUNDATION
 * FICTIONAL DATA ONLY
 * NOT A DEPLOYED INSTITUTION MODEL
 *
 * This adapter intentionally has one operation: a read-only projection over the sealed
 * in-repository fictional corpus. It has no storage, ingestion, mutation, authentication,
 * user-metadata, or institutional-inference path, and — since the D2A Codex correction —
 * no runtime dataset input of any kind: the canonical fixture is imported directly, so no
 * caller can present a real-shaped bundle as fictional by labeling it.
 *
 * The single operation is `projectJson`, which admits a serialized JSON **string** request
 * and nothing else. It does not accept a caller-supplied request object: object admission was
 * replaced by the serialized boundary in {@link parseOverlayProjectionRequestJson} because an
 * object-inspection gate cannot make hostile same-realm code inert. A future route must hand
 * this method the raw request text — never `await request.json()` and then some object parser.
 */

export interface FictionalInstitutionalOverlayReadAdapter {
  readonly projectJson: (requestJson: unknown) => OverlayProjection
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

/**
 * Projection builders. Every builder is an explicit field allowlist: a value reaches the
 * returned projection only by being named here, so internal authoring text (source label,
 * locator, jurisdiction, diagnostic message) cannot travel into the DTO, and an authoring
 * diagnostic message is replaced by its controlled template key.
 */
interface AuthoringSourceShape {
  sourceId: string
  sourceKind: string
  sourceRevision: string
  lastVerifiedAt: string
  provenance: { provenanceId: string; provenanceClass: string }
  context: unknown
  accessClassification: string
}

function projectSource<Source extends AuthoringSourceShape>(source: Source) {
  return {
    sourceId: source.sourceId,
    sourceKind: source.sourceKind,
    sourceRevision: source.sourceRevision,
    lastVerifiedAt: source.lastVerifiedAt,
    provenance: {
      provenanceId: source.provenance.provenanceId,
      provenanceClass: source.provenance.provenanceClass,
    },
    context: source.context,
    accessClassification: source.accessClassification,
  }
}

type SourceState = DemoOverlayDataset['capabilities']['sourceState']

function projectSourceState(sourceState: SourceState): SourceState {
  if (sourceState.state === 'available') return { state: 'available' }
  return { state: sourceState.state, reason: sourceState.reason }
}

type CapabilityState =
  InstitutionalOverlayDataset['capabilities']['records'][number]['capabilityState']

function projectCapabilityState(state: CapabilityState): CapabilityState {
  if (state.state === 'available') return { state: 'available' }
  if (state.state === 'unavailable') return { state: 'unavailable', reason: state.reason }
  return { state: 'unknown', reason: state.reason }
}

type InventoryState =
  InstitutionalOverlayDataset['inventories']['records'][number]['inventoryState']

function projectInventoryState(state: InventoryState): InventoryState {
  if (state.state === 'present') {
    return {
      state: 'present',
      quantity:
        state.quantity.state === 'known'
          ? { state: 'known', value: state.quantity.value, unit: state.quantity.unit }
          : { state: 'unknown', reason: state.quantity.reason },
    }
  }
  if (state.state === 'absent') return { state: 'absent', reason: state.reason }
  return { state: 'unknown', reason: state.reason }
}

type FormularyEvidence =
  InstitutionalOverlayDataset['formularies']['records'][number]['formularyEvidence']

function projectFormularyEvidence(evidence: FormularyEvidence): FormularyEvidence {
  if (evidence.state === 'listed') {
    return { state: 'listed', formularyEntryId: evidence.formularyEntryId }
  }
  if (evidence.state === 'not_listed') return { state: 'not_listed', reason: evidence.reason }
  return { state: 'unknown', reason: evidence.reason }
}

type InstitutionalApprovalState =
  InstitutionalOverlayDataset['formularies']['records'][number]['approvalState']

function projectInstitutionalApprovalState(approval: InstitutionalApprovalState) {
  if (approval.state === 'approved' || approval.state === 'not_approved') {
    return {
      state: approval.state,
      decisionId: approval.decisionId,
      decisionSource: projectSource(approval.decisionSource),
    }
  }
  if (approval.state === 'pending_review') {
    return { state: 'pending_review' as const, reviewReference: approval.reviewReference }
  }
  return { state: 'unknown' as const, reason: approval.reason }
}

type AuthoringDiagnostic =
  | DemoOverlayDataset['diagnostics'][number]
  | InstitutionalOverlayDataset['diagnostics'][number]

function projectDiagnostic<Diagnostic extends AuthoringDiagnostic>(diagnostic: Diagnostic) {
  return {
    diagnosticId: diagnostic.diagnosticId,
    code: diagnostic.code,
    severity: diagnostic.severity,
    messageTemplateKey: DIAGNOSTIC_MESSAGE_TEMPLATE_KEY_BY_CODE[diagnostic.code],
    observedAt: diagnostic.observedAt,
    relatedRecordId: diagnostic.relatedRecordId,
    context: diagnostic.context,
    accessClassification: diagnostic.accessClassification,
  }
}

function buildProjectedDemoDataset(dataset: DemoOverlayDataset) {
  return {
    context: dataset.context,
    capabilities: {
      sourceState: projectSourceState(dataset.capabilities.sourceState),
      records: dataset.capabilities.records.map((record) => ({
        recordId: record.recordId,
        context: record.context,
        accessClassification: record.accessClassification,
        capabilityCode: record.capabilityCode,
        capabilityState: projectCapabilityState(record.capabilityState),
        source: projectSource(record.source),
      })),
    },
    formularies: {
      sourceState: projectSourceState(dataset.formularies.sourceState),
      records: dataset.formularies.records.map((record) => ({
        recordId: record.recordId,
        context: record.context,
        accessClassification: record.accessClassification,
        subjectId: record.subjectId,
        formularyEvidence: projectFormularyEvidence(record.formularyEvidence),
        approvalState: { state: 'not_applicable_demo' as const, reason: 'demo_context' as const },
        source: projectSource(record.source),
      })),
    },
    inventories: {
      sourceState: projectSourceState(dataset.inventories.sourceState),
      records: dataset.inventories.records.map((record) => ({
        recordId: record.recordId,
        context: record.context,
        accessClassification: record.accessClassification,
        subjectId: record.subjectId,
        inventoryState: projectInventoryState(record.inventoryState),
        source: projectSource(record.source),
      })),
    },
    diagnostics: dataset.diagnostics.map((diagnostic) => projectDiagnostic(diagnostic)),
  }
}

function buildProjectedInstitutionalDataset(
  dataset: InstitutionalOverlayDataset,
  projectionAccess: InstitutionalAccessClassification,
) {
  const visibleCapabilities = dataset.capabilities.records.filter((record) =>
    accessAllows(projectionAccess, record.accessClassification),
  )
  const visibleFormularies = dataset.formularies.records.filter((record) =>
    accessAllows(projectionAccess, record.accessClassification),
  )
  const visibleInventories = dataset.inventories.records.filter((record) =>
    accessAllows(projectionAccess, record.accessClassification),
  )
  const includedRecordIds = new Set(
    [...visibleCapabilities, ...visibleFormularies, ...visibleInventories].map(
      (record) => record.recordId,
    ),
  )
  return {
    context: dataset.context,
    capabilities: {
      sourceState: projectSourceState(dataset.capabilities.sourceState),
      records: visibleCapabilities.map((record) => ({
        recordId: record.recordId,
        context: record.context,
        accessClassification: record.accessClassification,
        capabilityCode: record.capabilityCode,
        capabilityState: projectCapabilityState(record.capabilityState),
        source: projectSource(record.source),
      })),
    },
    formularies: {
      sourceState: projectSourceState(dataset.formularies.sourceState),
      records: visibleFormularies.map((record) => ({
        recordId: record.recordId,
        context: record.context,
        accessClassification: record.accessClassification,
        subjectId: record.subjectId,
        formularyEvidence: projectFormularyEvidence(record.formularyEvidence),
        approvalState: projectInstitutionalApprovalState(record.approvalState),
        source: projectSource(record.source),
      })),
    },
    inventories: {
      sourceState: projectSourceState(dataset.inventories.sourceState),
      records: visibleInventories.map((record) => ({
        recordId: record.recordId,
        context: record.context,
        accessClassification: record.accessClassification,
        subjectId: record.subjectId,
        inventoryState: projectInventoryState(record.inventoryState),
        source: projectSource(record.source),
      })),
    },
    diagnostics: dataset.diagnostics
      .filter((diagnostic) =>
        diagnosticVisibleInProjection(diagnostic, projectionAccess, includedRecordIds),
      )
      .map((diagnostic) => projectDiagnostic(diagnostic)),
  }
}

const INSTITUTIONAL_PROJECTION_TIERS = [
  'institution_restricted',
  'institution_confidential',
] as const

/**
 * Defense-in-depth corpus validation. The sealed corpus is finite, so adapter
 * construction enumerates every projection any caller could receive — each demo context
 * at public tier and each institutional scope at both institutional tiers — serializes
 * it, and refuses to construct if any identifier forbidden for that scope and tier
 * appears anywhere in the serialized output. This backs up the controlled projection DTO
 * and the bundle registry; it is not a substitute for either.
 */
export function assertFictionalCorpusProjectionSafe(
  bundle: FictionalInstitutionalOverlayBundle,
): void {
  const { components, identifiers } = collectSealedBundleIdentifierEntries(bundle)
  const tierRank = { public_unlisted: 0, institution_restricted: 1, institution_confidential: 2 }
  const ownComponentValuesByScope = new Map<string, Set<string>>()
  components.forEach((component) => {
    const own = ownComponentValuesByScope.get(component.scopeKey) ?? new Set<string>()
    own.add(component.value)
    ownComponentValuesByScope.set(component.scopeKey, own)
  })

  const targets = [
    ...bundle.demoDatasets.map((dataset) => ({
      scopeKey: demoContextScopeKey(dataset.context.demoContextId),
      tier: 'public_unlisted' as const,
      serialized: JSON.stringify(buildProjectedDemoDataset(dataset)),
    })),
    ...bundle.institutionalDatasets.flatMap((dataset) =>
      INSTITUTIONAL_PROJECTION_TIERS.map((tier) => ({
        scopeKey: institutionScopeKey(dataset.context.scope),
        tier,
        serialized: JSON.stringify(buildProjectedInstitutionalDataset(dataset, tier)),
      })),
    ),
  ]

  targets.forEach((target) => {
    const ownComponents = ownComponentValuesByScope.get(target.scopeKey) ?? new Set<string>()
    const forbiddenComponents = components.filter(
      (component) => component.scopeKey !== target.scopeKey && !ownComponents.has(component.value),
    )
    const forbiddenIdentifiers = identifiers.filter(
      (identifier) =>
        identifier.scopeKey !== target.scopeKey ||
        tierRank[identifier.tier] > tierRank[target.tier],
    )
    forbiddenComponents.forEach((component) => {
      if (target.serialized.includes(component.value)) {
        throw new Error(
          `Sealed fictional corpus refused: the ${target.tier} projection of scope ${target.scopeKey} ` +
            `serializes a foreign scope component from ${component.path.join('.')}.`,
        )
      }
    })
    forbiddenIdentifiers.forEach((identifier) => {
      if (target.serialized.includes(identifier.value)) {
        throw new Error(
          `Sealed fictional corpus refused: the ${target.tier} projection of scope ${target.scopeKey} ` +
            `serializes a forbidden ${identifier.kind} from ${identifier.path.join('.')}.`,
        )
      }
    })
  })
}

function buildSealedAdapter(): FictionalInstitutionalOverlayReadAdapter {
  const bundle: FictionalInstitutionalOverlayBundle =
    fictionalInstitutionalOverlayBundleSchema.parse(FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE)
  deepFreeze(bundle)
  assertFictionalCorpusProjectionSafe(bundle)

  const adapter: FictionalInstitutionalOverlayReadAdapter = {
    projectJson(requestJson: unknown): OverlayProjection {
      const request = parseOverlayProjectionRequestJson(requestJson)

      if (request.contextKind === 'demo') {
        const configured = bundle.demoDatasets.find(
          (dataset) => dataset.context.demoContextId === request.demoContextId,
        )
        const context = { contextKind: 'demo' as const, demoContextId: request.demoContextId }
        const dataset = configured
          ? buildProjectedDemoDataset(configured)
          : {
              context,
              capabilities: {
                sourceState: {
                  state: 'unknown' as const,
                  reason: 'scope_not_configured' as const,
                },
                records: [],
              },
              formularies: {
                sourceState: {
                  state: 'unknown' as const,
                  reason: 'scope_not_configured' as const,
                },
                records: [],
              },
              inventories: {
                sourceState: {
                  state: 'unknown' as const,
                  reason: 'scope_not_configured' as const,
                },
                records: [],
              },
              diagnostics: [
                {
                  diagnosticId: 'fictional-demo-scope-not-configured',
                  code: 'scope_not_configured' as const,
                  severity: 'blocking' as const,
                  messageTemplateKey: DIAGNOSTIC_MESSAGE_TEMPLATE_KEY_BY_CODE.scope_not_configured,
                  observedAt: request.projectionTimestamp,
                  relatedRecordId: null,
                  context,
                  accessClassification: 'public_unlisted' as const,
                },
              ],
            }

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
      const dataset = configured
        ? buildProjectedInstitutionalDataset(configured, request.accessClassification)
        : {
            context,
            capabilities: {
              sourceState: {
                state: 'unknown' as const,
                reason: 'scope_not_configured' as const,
              },
              records: [],
            },
            formularies: {
              sourceState: {
                state: 'unknown' as const,
                reason: 'scope_not_configured' as const,
              },
              records: [],
            },
            inventories: {
              sourceState: {
                state: 'unknown' as const,
                reason: 'scope_not_configured' as const,
              },
              records: [],
            },
            diagnostics: [
              {
                diagnosticId: 'fictional-institution-scope-not-configured',
                code: 'scope_not_configured' as const,
                severity: 'blocking' as const,
                messageTemplateKey: DIAGNOSTIC_MESSAGE_TEMPLATE_KEY_BY_CODE.scope_not_configured,
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

let sealedAdapter: FictionalInstitutionalOverlayReadAdapter | null = null

/**
 * The one public constructor. It takes no dataset, no fixture policy, no foundation
 * labels, and no provenance assertions: the canonical in-repository fictional corpus is
 * the only data this adapter can ever serve. Unexpected runtime arguments are rejected
 * loudly rather than ignored so a caller migrating from the pre-correction signature
 * cannot silently believe it supplied its own bundle.
 */
export function createFictionalInstitutionalOverlayReadAdapter(): FictionalInstitutionalOverlayReadAdapter {
  if (arguments.length > 0) {
    throw new Error(
      'The fictional institutional overlay adapter is sealed and accepts no runtime dataset input.',
    )
  }
  if (!sealedAdapter) {
    sealedAdapter = buildSealedAdapter()
  }
  return sealedAdapter
}

type ProjectedCapabilityRecord =
  | ProjectedDemoCapabilityRecord
  | ProjectedInstitutionalCapabilityRecord
type ProjectedInventoryRecord = ProjectedDemoInventoryRecord | ProjectedInstitutionalInventoryRecord

export type LookupReason = SourceStateReason | UnknownReason

export type CapabilityLookupResult =
  | { lookupState: 'observed'; record: ProjectedCapabilityRecord }
  | { lookupState: 'unknown'; reason: LookupReason }
  | { lookupState: 'unavailable'; reason: SourceStateReason }

export type InventoryLookupResult =
  | { lookupState: 'observed'; record: ProjectedInventoryRecord }
  | { lookupState: 'unknown'; reason: LookupReason }
  | { lookupState: 'unavailable'; reason: SourceStateReason }

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
    : { lookupState: 'unknown', reason: 'no_matching_record' }
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
    : { lookupState: 'unknown', reason: 'no_matching_record' }
}
