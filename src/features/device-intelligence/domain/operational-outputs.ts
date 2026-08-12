import type { ReadinessProjection, RequirementReadinessState } from './readiness'

import { stableSnapshotHash } from '@/features/preference-cards/domain/stable-hash'
import type {
  CompatibilityState,
  ConditionalState,
  OpenHoldStatus,
  ProceduralPhase,
  Requiredness,
  ResolvedCard,
  ResolvedCardItem,
  ResolutionState,
  SetupZone,
  VerificationState,
} from '@/features/preference-cards/domain/types'

/**
 * One versioned, typed catalog of the operational outputs available from a resolved card.
 *
 * Registry entries are projections only. They accept a card that has already been resolved and
 * have no access to a resolver, persistence, route, or institution service. The source kind on
 * every definition makes the one mixed-source preview (structural gaps) explicit instead of
 * implying that current audit counts were frozen into the card's release.
 */
export const OPERATIONAL_OUTPUT_SCHEMA_VERSION = 'device-intelligence-operational-output/2' as const

export const OPERATIONAL_OUTPUT_DEFINITIONS = {
  preferenceCard: {
    id: 'preference-card',
    tab: 'card',
    delivery: 'existing_engine',
    sourceKind: 'existing_engine_link',
  },
  roomSetup: {
    id: 'room-setup',
    tab: 'room',
    delivery: 'projection',
    sourceKind: 'release_pinned_card_and_slot_definitions',
  },
  nursing: {
    id: 'nursing-technician',
    tab: 'nursing',
    delivery: 'projection',
    sourceKind: 'release_pinned_card_and_slot_definitions',
  },
  training: {
    id: 'training',
    tab: 'training',
    delivery: 'projection',
    sourceKind: 'release_pinned_resolved_card',
  },
  gaps: {
    id: 'gap-preview',
    tab: 'gaps',
    delivery: 'projection',
    sourceKind: 'release_pinned_card_and_current_audit_data',
  },
  setupPacket: {
    id: 'setup-packet',
    tab: 'packet',
    delivery: 'printable_projection',
    sourceKind: 'release_pinned_card_slot_definitions_and_atlas_cohort_filter',
  },
  provenanceManifest: {
    id: 'provenance-manifest',
    tab: null,
    delivery: 'embedded_appendix',
    sourceKind: 'release_pinned_card_with_atlas_cohort_filter',
  },
} as const

export type OperationalOutputKey = keyof typeof OPERATIONAL_OUTPUT_DEFINITIONS
export type OutputTab = Exclude<
  (typeof OPERATIONAL_OUTPUT_DEFINITIONS)[OperationalOutputKey]['tab'],
  null
>

export const OPERATIONAL_OUTPUT_TABS: readonly OutputTab[] = [
  'card',
  'room',
  'nursing',
  'training',
  'gaps',
  'packet',
]

export function isOperationalOutputTab(value: unknown): value is OutputTab {
  return typeof value === 'string' && OPERATIONAL_OUTPUT_TABS.includes(value as OutputTab)
}

export interface OutputLine {
  itemId: string
  sourceSlotId: string | null
  sourceModuleVersionIds: string[]
  label: string
  roleCode: string
  quantityDisplay: string
  openHoldStatus: OpenHoldStatus
  sterileStatus: string | null
  responsibleRole: string | null
  setupZone: SetupZone
  proceduralPhase: ProceduralPhase
  requiredness: Requiredness
  effectiveRequiredness: Requiredness
  conditionalState: ConditionalState | null
  dependencyRule: string | null
  resolutionState: ResolutionState
  verificationState: VerificationState
  compatibilityState: CompatibilityState
  selection: OutputSelection
  /** Authored clinician texts, quoted verbatim by the training projection. */
  genericRequirement: string
}

/**
 * A discriminated identity boundary. The withheld branch has no optional identity field that a
 * future renderer could accidentally print.
 */
export type OutputSelection =
  | { identityState: 'visible'; description: string }
  | { identityState: 'withheld' }
  | { identityState: 'not_recorded' }

export type SuppressionDisclosure =
  | { state: 'verbatim'; reason: string }
  | { state: 'withheld' }
  | { state: 'not_recorded' }

export interface SuppressedOutputLine {
  itemId: string
  label: string
  roleCode: string
  requiredness: Requiredness
  effectiveRequiredness: Requiredness
  conditionalState: ConditionalState | null
  dependencyRule: string | null
  resolutionState: 'suppressed_by_kit'
  verificationState: VerificationState
  compatibilityState: CompatibilityState
  selectionIdentityState: OutputSelection['identityState']
  /** The resolver trace is present only when it carries no withheld identity. */
  suppression: SuppressionDisclosure
}

export interface RoomOutputLine {
  itemId: string
  label: string
  quantityDisplay: string
  openHoldStatus: OpenHoldStatus
  sterileStatus: string | null
  requiredness: Requiredness
  effectiveRequiredness: Requiredness
  conditionalState: ConditionalState | null
  dependencyRule: string | null
  resolutionState: ResolutionState
  verificationState: VerificationState
  compatibilityState: CompatibilityState
  selectionIdentityState: OutputSelection['identityState']
}

export interface NursingOutputLine {
  itemId: string
  label: string
  openHoldStatus: OpenHoldStatus
  requiredness: Requiredness
  effectiveRequiredness: Requiredness
  conditionalState: ConditionalState | null
  dependencyRule: string | null
  resolutionState: ResolutionState
  verificationState: VerificationState
  compatibilityState: CompatibilityState
  selection: OutputSelection
}

export interface TrainingOutputLine {
  itemId: string
  label: string
  genericRequirement: string
  dependencyRule: string | null
  requiredness: Requiredness
  effectiveRequiredness: Requiredness
  conditionalState: ConditionalState | null
  resolutionState: ResolutionState
  verificationState: VerificationState
  compatibilityState: CompatibilityState
  /** Not present on the pinned card; deliberately never enriched from the live role store. */
  selectionGuidance: null
  /** Not present on the pinned card; deliberately never enriched from the live role store. */
  requiresCurrentIfu: null
  selectionIdentityState: OutputSelection['identityState']
}

/** Checklist-specific DTO: no training prose, trace, notes, or source identity. */
export interface SetupPacketLine {
  itemId: string
  label: string
  roleCode: string
  quantityDisplay: string
  openHoldStatus: OpenHoldStatus
  sterileStatus: string | null
  responsibleRole: string | null
  requiredness: Requiredness
  effectiveRequiredness: Requiredness
  conditionalState: ConditionalState | null
  dependencyRule: string | null
  resolutionState: ResolutionState
  verificationState: VerificationState
  compatibilityState: CompatibilityState
  selection: OutputSelection
}

export interface GroupedOutput<Line = OutputLine, Key extends string = string> {
  key: Key
  lines: Line[]
}

export interface NursingOutputGroup {
  responsibleRole: string
  phases: GroupedOutput<NursingOutputLine>[]
}

export interface OperationalFormularySummary {
  rowsIntersectingProcedureRoles: number
  carriedRows: number
  preferredRows: number
  rowsWithAnyLocalField: number
}

export interface OperationalReadinessProjection {
  headline: RequirementReadinessState
  requirements: {
    itemId: string
    state: RequirementReadinessState
    diagnosticCodes: string[]
  }[]
  cardDiagnosticCodes: string[]
  blockingWarningCount: number
  otherWarningCount: number
}

export interface GapOutputPayload {
  projection: OperationalReadinessProjection
  proposalsOnlyRoles: string[]
  unmappedRoles: string[]
  nonSelectableOnlyRoles: string[]
  demoStandInRoles: string[]
  dimensionGapCount: number
  formularySummary: OperationalFormularySummary
}

export interface GapOutputInput extends Omit<GapOutputPayload, 'projection'> {
  projection: ReadinessProjection
}

export interface ExactReleaseIdentity {
  releaseBundleId: string
  releaseDefinitionHash: string
  catalogReleaseId: string
  resolverContractVersion: string
}

export interface OperationalOutputCommonEnvelope {
  schemaVersion: typeof OPERATIONAL_OUTPUT_SCHEMA_VERSION
  procedureCode: string
  scenarioId: string
  releaseIdentity: ExactReleaseIdentity
  provenance: {
    state: 'release_pinned'
    resolvedContentHash: string
    snapshotHash: string
    snapshotIntegrityHash: string
    engineVersion: string
    recipeVersionId: string
    generatedAt: string
  }
  labels: {
    context: 'demo'
    procedureStatus: string
    governanceState: string
    prototype: boolean
  }
}

interface OutputDiagnosticBase {
  id: string
  severity: 'info' | 'warning' | 'blocking'
  code: string
  sourceType: string
  acknowledged: boolean
}

export type OutputDiagnostic =
  | (OutputDiagnosticBase & {
      disclosureState: 'verbatim'
      message: string
      sourceId: string | null
      waiverReason: string | null
    })
  | (OutputDiagnosticBase & { disclosureState: 'withheld' })

export interface ProvenanceRequirementEntry {
  itemId: string
  presence: 'active' | 'suppressed_by_kit'
  sourceSlotId: string | null
  sourceModuleVersionIds: string[]
  roleCode: string
  requiredness: Requiredness
  effectiveRequiredness: Requiredness
  conditionalState: ConditionalState | null
  dependencyRule: string | null
  resolutionState: ResolutionState
  verificationState: VerificationState
  compatibilityState: CompatibilityState
  evidence: ProvenanceEvidence
}

export type ProvenanceEvidence =
  | {
      identityState: 'visible'
      catalogProductId: string
      sourceId: string | null
      sourceLocation: string | null
      verificationStatus: string | null
    }
  | { identityState: 'withheld' }
  | { identityState: 'not_recorded' }

export interface ProvenanceManifestPayload {
  releaseIdentity: ExactReleaseIdentity
  card: {
    recipeVersionId: string
    recipeName: string
    recipeVersion: string
    sourceProcedureCode: string
    organizationName: string
    siteName: string
    locationName: string
    selectedModifiers: string[]
    includedModules: NonNullable<ResolvedCard['includedModules']>
    readinessState: ResolvedCard['readinessState']
    governanceState: ResolvedCard['governanceState']
    prototype: boolean
    engineVersion: string
    catalogImportId: string
    generatedAt: string
    snapshotHash: string
    snapshotIntegrityHash: string
    resolvedContentHash: string
  }
  requirements: ProvenanceRequirementEntry[]
  diagnostics: OutputDiagnostic[]
}

export interface OperationalOutputPayloadMap {
  preferenceCard: {
    scenarioId: string
    behavior: 'existing_builder_link'
  }
  roomSetup: {
    groups: GroupedOutput<RoomOutputLine>[]
    suppressedItems: SuppressedOutputLine[]
  }
  nursing: {
    groups: NursingOutputGroup[]
    responsibilityState: 'authored' | 'not_recorded'
    suppressedItems: SuppressedOutputLine[]
  }
  training: {
    groups: GroupedOutput<TrainingOutputLine>[]
  }
  gaps: GapOutputPayload
  setupPacket: {
    roomSetup: GroupedOutput<SetupPacketLine>[]
    responsibilityState: 'authored' | 'not_recorded'
    suppressedItems: SuppressedOutputLine[]
    diagnostics: OutputDiagnostic[]
    provenanceAppendix: ProvenanceManifestPayload
  }
  provenanceManifest: ProvenanceManifestPayload
}

export interface OperationalOutputEnvelope<K extends OperationalOutputKey> {
  definition: (typeof OPERATIONAL_OUTPUT_DEFINITIONS)[K]
  common: OperationalOutputCommonEnvelope
  /** Stable over object key order and repeated projection of the same card and payload. */
  digest: string
  payload: OperationalOutputPayloadMap[K]
}

export type OperationalOutputRegistry = {
  [K in OperationalOutputKey]: OperationalOutputEnvelope<K>
}

export interface BuildOperationalOutputRegistryInput {
  scenarioId: string
  procedureStatus: string
  card: ResolvedCard
  slotAnnotations: {
    itemId: string
    sterileStatus: string | null
    responsibleRole: string | null
  }[]
  canonicalPhaseOrder: readonly string[]
  /** Product ids admitted by the existing D1 verified-source + prototype-visible cohort wall. */
  identifiableCatalogProductIds: ReadonlySet<string>
  gaps: GapOutputInput
}

function exactReleaseIdentity(card: ResolvedCard): ExactReleaseIdentity {
  const provenance = card.resolutionProvenance
  if (
    !provenance.releaseBundleId ||
    !provenance.releaseDefinitionHash ||
    !provenance.catalogReleaseId ||
    !provenance.resolverContractVersion
  ) {
    throw new Error('Operational outputs require one exact release-pinned resolved card.')
  }
  return {
    releaseBundleId: provenance.releaseBundleId,
    releaseDefinitionHash: provenance.releaseDefinitionHash,
    catalogReleaseId: provenance.catalogReleaseId,
    resolverContractVersion: provenance.resolverContractVersion,
  }
}

function groupBy<Line>(values: Line[], keyForLine: (line: Line) => string): GroupedOutput<Line>[] {
  const groups = new Map<string, Line[]>()
  for (const line of values) {
    const key = keyForLine(line)
    const existing = groups.get(key)
    if (existing) existing.push(line)
    else groups.set(key, [line])
  }
  return [...groups.entries()].map(([key, lines]) => ({ key, lines }))
}

function groupByPhase<Line extends { proceduralPhase: ProceduralPhase }>(
  values: Line[],
  canonicalPhaseOrder: readonly string[],
): GroupedOutput<Line>[] {
  const rank = (phase: string) => {
    const index = canonicalPhaseOrder.indexOf(phase)
    return index === -1 ? canonicalPhaseOrder.length : index
  }
  return groupBy(values, (line) => line.proceduralPhase).sort(
    (left, right) => rank(left.key) - rank(right.key),
  )
}

interface WithheldIdentityBoundary {
  catalogProductIds: ReadonlySet<string>
  hospitalItemIds: ReadonlySet<string>
  tokens: readonly string[]
}

function selectedProductIds(item: ResolvedCardItem): string[] {
  return [item.selectedCatalogProductId, item.selectedItemSnapshot?.catalogProduct?.productId]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .filter((value, index, values) => values.indexOf(value) === index)
}

function isItemIdentityWithheld(
  item: ResolvedCardItem,
  identifiableCatalogProductIds: ReadonlySet<string>,
): boolean {
  const snapshot = item.selectedItemSnapshot
  const product = snapshot?.catalogProduct ?? null
  if (item.verificationState === 'hidden' || snapshot?.verificationState === 'hidden') return true
  if (item.selectedHospitalItemId && !snapshot) return true
  if (product?.visibilityState === 'hidden') return true
  const productIds = selectedProductIds(item)
  if (product && productIds.length === 0) return true
  return productIds.some((productId) => !identifiableCatalogProductIds.has(productId))
}

function addIdentityToken(tokens: Set<string>, value: unknown): void {
  if (typeof value !== 'string') return
  const trimmed = value.trim()
  if (trimmed) tokens.add(trimmed)
}

function referencesWithheldIdentity(
  value: string | null | undefined,
  boundary: Pick<WithheldIdentityBoundary, 'tokens'>,
): boolean {
  if (!value) return false
  const normalized = value.toLocaleLowerCase('en-US')
  return boundary.tokens.some((token) => normalized.includes(token.toLocaleLowerCase('en-US')))
}

function withheldIdentityBoundary(
  card: ResolvedCard,
  identifiableCatalogProductIds: ReadonlySet<string>,
): WithheldIdentityBoundary {
  const catalogProductIds = new Set<string>()
  const hospitalItemIds = new Set<string>()
  const tokens = new Set<string>()
  const allItems = [...card.items, ...card.suppressedItems]

  for (const item of allItems) {
    if (!isItemIdentityWithheld(item, identifiableCatalogProductIds)) continue
    const snapshot = item.selectedItemSnapshot
    const product = snapshot?.catalogProduct ?? null
    for (const productId of selectedProductIds(item)) {
      catalogProductIds.add(productId)
      addIdentityToken(tokens, productId)
    }
    if (item.selectedHospitalItemId) {
      hospitalItemIds.add(item.selectedHospitalItemId)
      addIdentityToken(tokens, item.selectedHospitalItemId)
    }
    if (snapshot) {
      hospitalItemIds.add(snapshot.id)
      addIdentityToken(tokens, snapshot.id)
      addIdentityToken(tokens, snapshot.localDescription)
      addIdentityToken(tokens, snapshot.localItemNumber)
      addIdentityToken(tokens, snapshot.storageLocation)
      addIdentityToken(tokens, snapshot.notes)
      for (const attribute of Object.values(snapshot.attributes))
        addIdentityToken(tokens, attribute)
    }
    if (product) {
      addIdentityToken(tokens, product.productId)
      addIdentityToken(tokens, product.productName)
      addIdentityToken(tokens, product.manufacturer)
      addIdentityToken(tokens, product.catalogNumber)
      addIdentityToken(tokens, product.gtin)
      addIdentityToken(tokens, product.sourceId)
      addIdentityToken(tokens, product.sourceLocation)
    }
    addIdentityToken(tokens, item.rationale)
    addIdentityToken(tokens, item.notes)
    for (const reason of item.whyIncluded) addIdentityToken(tokens, reason)
  }

  const initialBoundary = { tokens: [...tokens] }
  for (const trace of card.ruleTrace) {
    if (
      (trace.sourceId !== null && hospitalItemIds.has(trace.sourceId)) ||
      referencesWithheldIdentity(trace.message, initialBoundary) ||
      referencesWithheldIdentity(trace.sourceId, initialBoundary)
    ) {
      addIdentityToken(tokens, trace.message)
      addIdentityToken(tokens, trace.sourceId)
    }
  }

  return {
    catalogProductIds,
    hospitalItemIds,
    tokens: [...tokens].sort(
      (left, right) => right.length - left.length || left.localeCompare(right),
    ),
  }
}

function outputSelection(
  item: ResolvedCardItem,
  identifiableCatalogProductIds: ReadonlySet<string>,
): OutputSelection {
  if (isItemIdentityWithheld(item, identifiableCatalogProductIds)) {
    return { identityState: 'withheld' }
  }
  const description = item.selectedItemSnapshot?.localDescription.trim()
  return description ? { identityState: 'visible', description } : { identityState: 'not_recorded' }
}

function outputDiagnostic(
  card: ResolvedCard,
  boundary: WithheldIdentityBoundary,
): OutputDiagnostic[] {
  return card.warnings.map((warning, index) => {
    const withheld =
      ((boundary.catalogProductIds.size > 0 || boundary.hospitalItemIds.size > 0) &&
        warning.sourceType === 'compatibility_rule') ||
      (warning.sourceId !== null &&
        (boundary.hospitalItemIds.has(warning.sourceId) ||
          boundary.catalogProductIds.has(warning.sourceId))) ||
      referencesWithheldIdentity(warning.id, boundary) ||
      referencesWithheldIdentity(warning.code, boundary) ||
      referencesWithheldIdentity(warning.message, boundary) ||
      referencesWithheldIdentity(warning.sourceId, boundary) ||
      referencesWithheldIdentity(warning.waiverReason, boundary)
    const common = {
      id: withheld ? `withheld-diagnostic-${index + 1}` : warning.id,
      severity: warning.severity,
      code: referencesWithheldIdentity(warning.code, boundary) ? 'identity_withheld' : warning.code,
      sourceType: warning.sourceType,
      acknowledged: warning.acknowledged,
    }
    return withheld
      ? {
          ...common,
          disclosureState: 'withheld' as const,
        }
      : {
          ...common,
          disclosureState: 'verbatim' as const,
          message: warning.message,
          sourceId: warning.sourceId,
          waiverReason: warning.waiverReason,
        }
  })
}

function provenanceRequirement(
  item: ResolvedCardItem,
  presence: ProvenanceRequirementEntry['presence'],
  identifiableCatalogProductIds: ReadonlySet<string>,
): ProvenanceRequirementEntry {
  const product = item.selectedItemSnapshot?.catalogProduct ?? null
  // The D1 cohort wall remains authoritative: a hidden product's identity and evidence pointer
  // never ride into this public-unlisted projection merely because the resolved card retains it.
  const evidence: ProvenanceEvidence = isItemIdentityWithheld(item, identifiableCatalogProductIds)
    ? { identityState: 'withheld' }
    : product
      ? {
          identityState: 'visible',
          catalogProductId: product.productId,
          sourceId: product.sourceId,
          sourceLocation: product.sourceLocation,
          verificationStatus: product.verificationStatus,
        }
      : { identityState: 'not_recorded' }
  return {
    itemId: item.id,
    presence,
    sourceSlotId: item.sourceSlotId,
    sourceModuleVersionIds: [...(item.sourceModuleVersionIds ?? [])],
    roleCode: item.roleCode,
    requiredness: item.requiredness,
    effectiveRequiredness: item.effectiveRequiredness,
    conditionalState: item.conditionalState,
    dependencyRule: item.dependencyRule,
    resolutionState: item.resolutionState,
    verificationState: item.verificationState,
    compatibilityState: item.compatibilityState,
    evidence,
  }
}

function publicReadinessProjection(
  projection: ReadinessProjection,
): OperationalReadinessProjection {
  return {
    headline: projection.headline,
    requirements: projection.requirements.map((requirement) => ({
      itemId: requirement.itemId,
      state: requirement.state,
      diagnosticCodes: [...new Set(requirement.diagnostics.map((diagnostic) => diagnostic.code))],
    })),
    cardDiagnosticCodes: [
      ...new Set(projection.cardDiagnostics.map((diagnostic) => diagnostic.code)),
    ],
    blockingWarningCount: projection.blockingWarnings.length,
    otherWarningCount: projection.otherWarnings.length,
  }
}

function outputLine(
  item: ResolvedCardItem,
  annotation: BuildOperationalOutputRegistryInput['slotAnnotations'][number] | undefined,
  identifiableCatalogProductIds: ReadonlySet<string>,
): OutputLine {
  return {
    itemId: item.id,
    sourceSlotId: item.sourceSlotId,
    sourceModuleVersionIds: [...(item.sourceModuleVersionIds ?? [])],
    label: item.label,
    roleCode: item.roleCode,
    quantityDisplay: item.quantityDisplay,
    openHoldStatus: item.openHoldStatus,
    sterileStatus: annotation?.sterileStatus ?? null,
    responsibleRole: annotation?.responsibleRole ?? null,
    setupZone: item.setupZone,
    proceduralPhase: item.proceduralPhase,
    requiredness: item.requiredness,
    effectiveRequiredness: item.effectiveRequiredness,
    conditionalState: item.conditionalState,
    dependencyRule: item.dependencyRule,
    resolutionState: item.resolutionState,
    verificationState: item.verificationState,
    compatibilityState: item.compatibilityState,
    selection: outputSelection(item, identifiableCatalogProductIds),
    genericRequirement: item.genericRequirement,
  }
}

function suppressedOutputLine(
  item: ResolvedCardItem,
  boundary: WithheldIdentityBoundary,
  identifiableCatalogProductIds: ReadonlySet<string>,
): SuppressedOutputLine {
  const reason = item.whyIncluded.find((entry) => entry.startsWith('Suppressed because')) ?? null
  const suppression: SuppressionDisclosure = !reason
    ? { state: 'not_recorded' }
    : referencesWithheldIdentity(reason, boundary)
      ? { state: 'withheld' }
      : { state: 'verbatim', reason }
  return {
    itemId: item.id,
    label: item.label,
    roleCode: item.roleCode,
    requiredness: item.requiredness,
    effectiveRequiredness: item.effectiveRequiredness,
    conditionalState: item.conditionalState,
    dependencyRule: item.dependencyRule,
    resolutionState: 'suppressed_by_kit',
    verificationState: item.verificationState,
    compatibilityState: item.compatibilityState,
    selectionIdentityState: outputSelection(item, identifiableCatalogProductIds).identityState,
    suppression,
  }
}

function provenanceManifest(
  card: ResolvedCard,
  releaseIdentity: ExactReleaseIdentity,
  diagnostics: OutputDiagnostic[],
  identifiableCatalogProductIds: ReadonlySet<string>,
): ProvenanceManifestPayload {
  return {
    releaseIdentity,
    card: {
      recipeVersionId: card.recipeVersionId,
      recipeName: card.recipeName,
      recipeVersion: card.recipeVersion,
      sourceProcedureCode: card.sourceProcedureCode,
      organizationName: card.organizationName,
      siteName: card.siteName,
      locationName: card.locationName,
      selectedModifiers: [...card.selectedModifiers],
      includedModules: (card.includedModules ?? []).map((module) => ({ ...module })),
      readinessState: card.readinessState,
      governanceState: card.governanceState,
      prototype: card.prototype,
      engineVersion: card.engineVersion,
      catalogImportId: card.catalogImportId,
      generatedAt: card.generatedAt,
      snapshotHash: card.snapshotHash,
      snapshotIntegrityHash: card.snapshotIntegrityHash,
      resolvedContentHash: card.resolvedContentHash,
    },
    requirements: [
      ...card.items.map((item) =>
        provenanceRequirement(item, 'active', identifiableCatalogProductIds),
      ),
      ...card.suppressedItems.map((item) =>
        provenanceRequirement(item, 'suppressed_by_kit', identifiableCatalogProductIds),
      ),
    ],
    diagnostics,
  }
}

function envelope<K extends OperationalOutputKey>(
  key: K,
  common: OperationalOutputCommonEnvelope,
  payload: OperationalOutputPayloadMap[K],
): OperationalOutputEnvelope<K> {
  const definition = OPERATIONAL_OUTPUT_DEFINITIONS[key]
  return {
    definition,
    common,
    digest: stableSnapshotHash({
      schemaVersion: OPERATIONAL_OUTPUT_SCHEMA_VERSION,
      outputId: definition.id,
      common,
      payload,
    }),
    payload,
  }
}

/** Build every registered output from the same already-resolved card, without resolving again. */
export function buildOperationalOutputRegistry(
  input: BuildOperationalOutputRegistryInput,
): OperationalOutputRegistry {
  const { card } = input
  const releaseIdentity = exactReleaseIdentity(card)
  const annotationByItemId = new Map(
    input.slotAnnotations.map((annotation) => [annotation.itemId, annotation]),
  )
  const boundary = withheldIdentityBoundary(card, input.identifiableCatalogProductIds)
  const lines = [...card.items]
    .sort(
      (left, right) => left.setupSequence - right.setupSequence || left.id.localeCompare(right.id),
    )
    .map((item) =>
      outputLine(item, annotationByItemId.get(item.id), input.identifiableCatalogProductIds),
    )
  const suppressedItems = card.suppressedItems.map((item) =>
    suppressedOutputLine(item, boundary, input.identifiableCatalogProductIds),
  )
  const common: OperationalOutputCommonEnvelope = {
    schemaVersion: OPERATIONAL_OUTPUT_SCHEMA_VERSION,
    procedureCode: card.sourceProcedureCode,
    scenarioId: input.scenarioId,
    releaseIdentity,
    provenance: {
      state: 'release_pinned',
      resolvedContentHash: card.resolvedContentHash,
      snapshotHash: card.snapshotHash,
      snapshotIntegrityHash: card.snapshotIntegrityHash,
      engineVersion: card.engineVersion,
      recipeVersionId: card.recipeVersionId,
      generatedAt: card.generatedAt,
    },
    labels: {
      context: 'demo',
      procedureStatus: input.procedureStatus,
      governanceState: card.governanceState,
      prototype: card.prototype,
    },
  }

  const roomGroups: GroupedOutput<RoomOutputLine>[] = groupBy(lines, (line) => line.setupZone).map(
    (group) => ({
      key: group.key,
      lines: group.lines.map((line) => ({
        itemId: line.itemId,
        label: line.label,
        quantityDisplay: line.quantityDisplay,
        openHoldStatus: line.openHoldStatus,
        sterileStatus: line.sterileStatus,
        requiredness: line.requiredness,
        effectiveRequiredness: line.effectiveRequiredness,
        conditionalState: line.conditionalState,
        dependencyRule: line.dependencyRule,
        resolutionState: line.resolutionState,
        verificationState: line.verificationState,
        compatibilityState: line.compatibilityState,
        selectionIdentityState: line.selection.identityState,
      })),
    }),
  )
  const nursingGroups: NursingOutputGroup[] = groupBy(
    lines,
    (line) => line.responsibleRole ?? 'unassigned',
  ).map((group) => ({
    responsibleRole: group.key,
    phases: groupByPhase(group.lines, input.canonicalPhaseOrder).map((phase) => ({
      key: phase.key,
      lines: phase.lines.map((line) => ({
        itemId: line.itemId,
        label: line.label,
        openHoldStatus: line.openHoldStatus,
        requiredness: line.requiredness,
        effectiveRequiredness: line.effectiveRequiredness,
        conditionalState: line.conditionalState,
        dependencyRule: line.dependencyRule,
        resolutionState: line.resolutionState,
        verificationState: line.verificationState,
        compatibilityState: line.compatibilityState,
        selection: line.selection,
      })),
    })),
  }))
  const responsibilityState = lines.some((line) => line.responsibleRole !== null)
    ? 'authored'
    : 'not_recorded'
  const trainingGroups: GroupedOutput<TrainingOutputLine>[] = groupByPhase(
    lines,
    input.canonicalPhaseOrder,
  ).map((group) => ({
    key: group.key,
    lines: group.lines.map((line) => ({
      itemId: line.itemId,
      label: line.label,
      genericRequirement: line.genericRequirement,
      dependencyRule: line.dependencyRule,
      requiredness: line.requiredness,
      effectiveRequiredness: line.effectiveRequiredness,
      conditionalState: line.conditionalState,
      resolutionState: line.resolutionState,
      verificationState: line.verificationState,
      compatibilityState: line.compatibilityState,
      selectionGuidance: null,
      requiresCurrentIfu: null,
      selectionIdentityState: line.selection.identityState,
    })),
  }))
  const setupPacketGroups: GroupedOutput<SetupPacketLine>[] = groupBy(
    lines,
    (line) => line.setupZone,
  ).map((group) => ({
    key: group.key,
    lines: group.lines.map((line) => ({
      itemId: line.itemId,
      label: line.label,
      roleCode: line.roleCode,
      quantityDisplay: line.quantityDisplay,
      openHoldStatus: line.openHoldStatus,
      sterileStatus: line.sterileStatus,
      responsibleRole: line.responsibleRole,
      requiredness: line.requiredness,
      effectiveRequiredness: line.effectiveRequiredness,
      conditionalState: line.conditionalState,
      dependencyRule: line.dependencyRule,
      resolutionState: line.resolutionState,
      verificationState: line.verificationState,
      compatibilityState: line.compatibilityState,
      selection: line.selection,
    })),
  }))
  const diagnostics = outputDiagnostic(card, boundary)
  const manifest = provenanceManifest(
    card,
    releaseIdentity,
    diagnostics,
    input.identifiableCatalogProductIds,
  )

  const roomPayload: OperationalOutputPayloadMap['roomSetup'] = {
    groups: roomGroups,
    suppressedItems,
  }
  const nursingPayload: OperationalOutputPayloadMap['nursing'] = {
    groups: nursingGroups,
    responsibilityState,
    suppressedItems,
  }
  const { projection, ...gapFacts } = input.gaps
  const gapPayload: GapOutputPayload = {
    ...gapFacts,
    projection: publicReadinessProjection(projection),
  }

  return {
    preferenceCard: envelope('preferenceCard', common, {
      scenarioId: input.scenarioId,
      behavior: 'existing_builder_link',
    }),
    roomSetup: envelope('roomSetup', common, roomPayload),
    nursing: envelope('nursing', common, nursingPayload),
    training: envelope('training', common, {
      groups: trainingGroups,
    }),
    gaps: envelope('gaps', common, gapPayload),
    setupPacket: envelope('setupPacket', common, {
      roomSetup: setupPacketGroups,
      responsibilityState,
      suppressedItems,
      diagnostics,
      provenanceAppendix: manifest,
    }),
    provenanceManifest: envelope('provenanceManifest', common, manifest),
  }
}
