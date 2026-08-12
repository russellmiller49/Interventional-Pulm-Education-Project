import type { ReadinessProjection } from './readiness'

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
export const OPERATIONAL_OUTPUT_SCHEMA_VERSION = 'device-intelligence-operational-output/1' as const

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
    sourceKind: 'release_pinned_card_and_slot_definitions',
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
  selectedDescription: string | null
  selectedIdentityState: 'visible' | 'withheld' | 'not_recorded'
  /** Authored clinician texts, quoted verbatim by the training projection. */
  genericRequirement: string
  selectionGuidance: string | null
  requiresCurrentIfu: boolean
  whyIncluded: string[]
  notes: string | null
}

export interface SuppressedOutputLine extends OutputLine {
  rationale: string | null
  /** The resolver's own kit-suppression trace sentence. */
  suppressionReason: string | null
}

export interface GroupedOutput<Key extends string = string> {
  key: Key
  lines: OutputLine[]
}

export interface NursingOutputGroup {
  responsibleRole: string
  phases: GroupedOutput[]
}

export interface OperationalFormularySummary {
  rowsIntersectingProcedureRoles: number
  carriedRows: number
  preferredRows: number
  rowsWithAnyLocalField: number
}

export interface GapOutputPayload {
  projection: ReadinessProjection
  proposalsOnlyRoles: string[]
  unmappedRoles: string[]
  nonSelectableOnlyRoles: string[]
  demoStandInRoles: string[]
  dimensionGapCount: number
  formularySummary: OperationalFormularySummary
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

export interface OutputDiagnostic {
  id: string
  severity: 'info' | 'warning' | 'blocking'
  code: string
  message: string
  sourceType: string
  sourceId: string | null
  acknowledged: boolean
  waiverReason: string | null
}

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
  evidence: {
    identityState: 'visible' | 'withheld' | 'not_recorded'
    catalogProductId: string | null
    sourceId: string | null
    sourceLocation: string | null
    verificationStatus: string | null
  }
}

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
    groups: GroupedOutput[]
    suppressedItems: SuppressedOutputLine[]
  }
  nursing: {
    groups: NursingOutputGroup[]
    responsibilityState: 'authored' | 'not_recorded'
    suppressedItems: SuppressedOutputLine[]
  }
  training: {
    groups: GroupedOutput[]
    ifuScope: 'all' | 'some' | 'none'
  }
  gaps: GapOutputPayload
  setupPacket: {
    roomSetup: GroupedOutput[]
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
  lines: OutputLine[]
  suppressedItems: SuppressedOutputLine[]
  canonicalPhaseOrder: readonly string[]
  /** Product ids admitted by the existing D1 verified-source + prototype-visible cohort wall. */
  identifiableCatalogProductIds: ReadonlySet<string>
  gaps: GapOutputPayload
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

function groupBy(values: OutputLine[], keyForLine: (line: OutputLine) => string): GroupedOutput[] {
  const groups = new Map<string, OutputLine[]>()
  for (const line of values) {
    const key = keyForLine(line)
    const existing = groups.get(key)
    if (existing) existing.push(line)
    else groups.set(key, [line])
  }
  return [...groups.entries()].map(([key, lines]) => ({ key, lines }))
}

function groupByPhase(
  values: OutputLine[],
  canonicalPhaseOrder: readonly string[],
): GroupedOutput[] {
  const rank = (phase: string) => {
    const index = canonicalPhaseOrder.indexOf(phase)
    return index === -1 ? canonicalPhaseOrder.length : index
  }
  return groupBy(values, (line) => line.proceduralPhase).sort(
    (left, right) => rank(left.key) - rank(right.key),
  )
}

function outputDiagnostic(card: ResolvedCard): OutputDiagnostic[] {
  return card.warnings.map((warning) => ({
    id: warning.id,
    severity: warning.severity,
    code: warning.code,
    message: warning.message,
    sourceType: warning.sourceType,
    sourceId: warning.sourceId,
    acknowledged: warning.acknowledged,
    waiverReason: warning.waiverReason,
  }))
}

function provenanceRequirement(
  item: ResolvedCardItem,
  presence: ProvenanceRequirementEntry['presence'],
  identifiableCatalogProductIds: ReadonlySet<string>,
): ProvenanceRequirementEntry {
  const product = item.selectedItemSnapshot?.catalogProduct ?? null
  // The D1 cohort wall remains authoritative: a hidden product's identity and evidence pointer
  // never ride into this public-unlisted projection merely because the resolved card retains it.
  const identityState: ProvenanceRequirementEntry['evidence']['identityState'] = product
    ? identifiableCatalogProductIds.has(product.productId)
      ? 'visible'
      : 'withheld'
    : 'not_recorded'
  const mayIdentifyProduct = identityState === 'visible'
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
    evidence: {
      identityState,
      catalogProductId: mayIdentifyProduct ? (product?.productId ?? null) : null,
      sourceId: mayIdentifyProduct ? (product?.sourceId ?? null) : null,
      sourceLocation: mayIdentifyProduct ? (product?.sourceLocation ?? null) : null,
      verificationStatus: mayIdentifyProduct ? (product?.verificationStatus ?? null) : null,
    },
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

  const roomGroups = groupBy(input.lines, (line) => line.setupZone)
  const nursingGroups = groupBy(input.lines, (line) => line.responsibleRole ?? 'unassigned').map(
    (group) => ({
      responsibleRole: group.key,
      phases: groupByPhase(group.lines, input.canonicalPhaseOrder),
    }),
  )
  const responsibilityState = input.lines.some((line) => line.responsibleRole !== null)
    ? 'authored'
    : 'not_recorded'
  const trainingGroups = groupByPhase(input.lines, input.canonicalPhaseOrder)
  const ifuCount = input.lines.filter((line) => line.requiresCurrentIfu).length
  const ifuScope = ifuCount === 0 ? 'none' : ifuCount === input.lines.length ? 'all' : 'some'
  const diagnostics = outputDiagnostic(card)
  const manifest = provenanceManifest(
    card,
    releaseIdentity,
    diagnostics,
    input.identifiableCatalogProductIds,
  )

  const roomPayload: OperationalOutputPayloadMap['roomSetup'] = {
    groups: roomGroups,
    suppressedItems: input.suppressedItems,
  }
  const nursingPayload: OperationalOutputPayloadMap['nursing'] = {
    groups: nursingGroups,
    responsibilityState,
    suppressedItems: input.suppressedItems,
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
      ifuScope,
    }),
    gaps: envelope('gaps', common, input.gaps),
    setupPacket: envelope('setupPacket', common, {
      roomSetup: roomGroups,
      responsibilityState,
      suppressedItems: input.suppressedItems,
      diagnostics,
      provenanceAppendix: manifest,
    }),
    provenanceManifest: envelope('provenanceManifest', common, manifest),
  }
}
