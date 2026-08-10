export const setupZones = [
  'room_capital_equipment',
  'equipment_tower',
  'back_table',
  'mayo_stand',
  'sterile_field',
  'specimen_station',
  'emergency_cart',
  'other',
  'unassigned',
] as const

export type SetupZone = (typeof setupZones)[number]

export const proceduralPhases = [
  'pre_room',
  'pre_induction_or_sedation',
  'airway_access',
  'diagnostic',
  'therapeutic',
  'specimen_handling',
  'rescue_or_contingency',
  'post_procedure',
  'unassigned',
] as const

export type ProceduralPhase = (typeof proceduralPhases)[number]

export const requirednessValues = [
  'required',
  'conditional',
  'optional',
  'backup',
  'emergency_only',
] as const

export type Requiredness = (typeof requirednessValues)[number]

export const openHoldStatuses = [
  'open_or_set_up_now',
  'have_in_room',
  'hold_unopened',
  'emergency_pull',
  'do_not_substitute',
] as const

export type OpenHoldStatus = (typeof openHoldStatuses)[number]

export type GovernanceState = 'draft' | 'in_review' | 'approved' | 'retired'
export type ReadinessState = 'blocked' | 'complete_with_warnings' | 'complete'
export type ConditionalState = 'include' | 'exclude' | 'undecided'
export type CompatibilityState = 'pass' | 'fail' | 'unknown' | 'not_evaluated'

export type ResolutionState =
  | 'resolved'
  | 'generic_local'
  | 'warning'
  | 'blocking'
  | 'waived'
  | 'unresolved'
  | 'suppressed_by_kit'

export type VerificationState =
  | 'locally_approved'
  | 'prototype_visible'
  | 'demo_only'
  | 'unverified'
  | 'hidden'

export type ModifierGroup =
  | 'location'
  | 'anesthesia_airway'
  | 'imaging_navigation'
  | 'sampling'
  | 'therapeutic'
  | 'risk_rescue'
  | 'pleural'

export type HospitalItemType =
  | 'commercial_product'
  | 'hospital_local_disposable'
  | 'capital_asset'
  | 'reusable_instrument'
  | 'instrument_tray'
  | 'procedure_kit'
  | 'medication_or_solution_prompt'
  | 'room_resource'
  | 'personnel_or_service'
  | 'protocol_or_readiness_check'
  | 'specimen_or_laboratory_requirement'

export interface QuantityLiteral {
  op: 'literal'
  value: number
}

export type QuantityExpression = QuantityLiteral

export interface RecipeSlot {
  id: string
  sourceSlotId: string | null
  /**
   * Stable semantic identity for the requirement this slot expresses.
   *
   * Two module-authored slots are the *same requirement* only when a reviewed mapping file
   * gives them the same key. Role-code equality is never sufficient — the same role
   * legitimately appears more than once on a card, and two procedures can ask for the same
   * role in materially different ways.
   */
  requirementKey: string
  /**
   * Imported slot ids that this requirement absorbed when it moved into a shared module.
   * Modifier targeting and audit trails keep working against the original ids.
   */
  sourceSlotAliases?: string[]
  /** Set when the slot came from one or more recipe modules; absent for direct slots. */
  sourceModuleVersionIds?: string[]
  roleCode: string
  label: string
  genericRequirement: string
  requiredness: Requiredness
  dependencyRule: string | null
  quantityExpression: QuantityExpression
  selectionMode: 'single' | 'multiple'
  setupZone: SetupZone
  proceduralPhase: ProceduralPhase
  setupSequence: number
  openHoldStatus: OpenHoldStatus
  responsibleRole: string | null
  sterileStatus: string | null
  allowCustom: boolean
  notes: string | null
  includedBy: string
}

/**
 * Recipe modules are composed, never inherited. A procedure names the exact module
 * *versions* it is built from; the modules themselves know nothing about the procedures
 * that use them.
 */
export type RecipeModuleKind = 'core' | 'procedure_specific' | 'optional'

export type ModuleSelectionBehavior = 'required' | 'default_on' | 'optional'

export type ModuleSelectionSource = 'required' | 'default' | 'user_selected'

export interface RecipeModuleVersion {
  id: string
  code: string
  name: string
  description: string
  version: string
  kind: RecipeModuleKind
  governanceState: GovernanceState
  clinicalOwner: string | null
  operationalOwner: string | null
  catalogImportId: string
  slots: RecipeSlot[]
}

export interface RecipeModuleReference {
  moduleVersionId: string
  selectionBehavior: ModuleSelectionBehavior
  sequence: number
}

export const procedureCompositionActionTypes = [
  'remove_slot',
  'set_requiredness',
  'set_quantity',
  'set_setup_zone',
  'set_procedural_phase',
  'set_open_hold_status',
  'append_note',
] as const

export type ProcedureCompositionActionType = (typeof procedureCompositionActionTypes)[number]

/**
 * A reviewed, explicit adjustment a procedure makes to a requirement it inherits from a
 * module. There is no implicit override channel: what a composition changes, it says.
 */
export interface ProcedureCompositionAction {
  id: string
  sequence: number
  actionType: ProcedureCompositionActionType
  targetRequirementKey?: string
  targetSlotId?: string
  targetRoleCode?: string
  /**
   * The action applies only when its target requirement is present in the composed
   * selection; matching nothing is expected rather than an authoring error.
   *
   * Absent (the default), an unmatched action raises `recipe_composition_action_unmatched`,
   * which is right for a procedure whose modules are fixed: the target is always composed, so
   * a miss means the authoring is wrong. It is wrong for a composition whose modules are
   * *chosen per card* — the custom module composition — where a selection that omits the
   * target's module is an ordinary card, not a defect, and warning on every such card would
   * teach readers to ignore the warning that matters.
   *
   * An optional-target action is authored as a statement about exactly one requirement, so
   * matching *more than one* is treated as the identity assumption breaking and blocks
   * (`recipe_composition_action_ambiguous`) instead of silently modifying both.
   */
  optionalTarget?: boolean
  payload: Record<string, unknown>
}

export interface IncludedRecipeModule {
  moduleVersionId: string
  moduleCode: string
  moduleName: string
  moduleVersion: string
  kind: RecipeModuleKind
  selectionBehavior: ModuleSelectionBehavior
  selectionSource: ModuleSelectionSource
  governanceState: GovernanceState
  requirementCount: number
}

export interface RecipeVersion {
  id: string
  sourceProcedureCode: string
  sourceTemplateVersion: string
  name: string
  version: string
  governanceState: GovernanceState
  clinicalOwner: string | null
  operationalOwner: string | null
  catalogImportId: string
  /**
   * Slots authored directly on the procedure rather than through a module. Composed
   * procedures leave this empty; it stays available for migration and for the unusual
   * requirement that genuinely belongs to one procedure and nothing else.
   */
  slots: RecipeSlot[]
  moduleReferences: RecipeModuleReference[]
  compositionActions: ProcedureCompositionAction[]
  /**
   * The modifier codes this procedure offers, as reviewed clinical governance rather than a
   * UI hint.
   *
   * It used to live only on `ScenarioDefinition`, where it gated the picker and nothing else:
   * `resolveCard` looked a submitted code up in the *whole* merged modifier set, so a crafted
   * request naming a real modifier the procedure never offered was applied and stored. Hiding
   * a control is not authorization. Living here makes it part of `recipeDefinitionHash`, so a
   * release pins which modifiers were offered and a card cannot be resolved against a
   * permission the release never granted.
   */
  allowedModifierCodes: string[]
  /**
   * Where this procedure wants each requirement in its own setup order, keyed by
   * `requirementKey`.
   *
   * A module authors the order of its requirements *within itself*, which is the only
   * order it can know; a shared core has no idea where a therapeutic bronchoscopy wants
   * suction relative to a cryoprobe it has never heard of. The procedure does, and this is
   * where it says so. Generated from the reviewed template's own `display_order`, so the
   * clinical sequence a reviewer signed off on survives being assembled from modules.
   *
   * A requirement with no entry here — an optional module on a procedure whose template
   * never listed it — falls back to the module band and lands after everything authored.
   */
  requirementSequences?: Record<string, number>
}

export interface CatalogProductSummary {
  productId: string
  manufacturer: string | null
  productName: string
  catalogNumber: string | null
  gtin: string | null
  verificationStatus: string | null
  visibilityState: 'prototype_visible' | 'hidden'
  minWorkingChannelMm: number | null
  deliverySystemOdMm: number | null
  sourceId: string | null
  sourceLocation: string | null
}

export interface KitComponent {
  roleCode: string
  inclusion: 'included' | 'optional' | 'excluded'
  quantity: number
}

export interface HospitalItem {
  id: string
  organizationId: string
  siteId: string | null
  locationId: string | null
  itemType: HospitalItemType
  roleCode: string | null
  catalogProduct: CatalogProductSummary | null
  localItemNumber: string | null
  localDescription: string
  localUom: string | null
  storageLocation: string | null
  verificationState: VerificationState
  active: boolean
  notes: string | null
  attributes: Record<string, string | number | boolean | null>
  kitComponents: KitComponent[]
}

export interface HospitalRoleOption {
  id: string
  roleCode: string
  hospitalItemId: string
  preferenceRank: number
  substitutionClass:
    | 'preferred'
    | 'acceptable'
    | 'shortage_substitute'
    | 'backup'
    | 'emergency_only'
    | 'no_substitute'
  noSubstitute: boolean
  active: boolean
  rationale: string | null
}

export const modifierActionTypes = [
  'add_slot',
  'remove_slot',
  'replace_role',
  'set_requiredness',
  'set_quantity',
  'set_setup_zone',
  'set_procedural_phase',
  'set_open_hold_status',
  'append_note',
  'require_room_capability',
  'add_rescue_module',
  'validate_compatibility',
  'raise_warning',
  'raise_blocking_error',
] as const

export type ModifierActionType = (typeof modifierActionTypes)[number]

export interface ModifierAction {
  id: string
  modifierCode: string
  sequence: number
  actionType: ModifierActionType
  /**
   * Matches the expanded slot id, the imported `sourceSlotId`, or any value in
   * `sourceSlotAliases` — so a modifier authored against a pre-composition slot id keeps
   * hitting the requirement after it moves into a shared module.
   */
  targetSlotId?: string
  targetRequirementKey?: string
  targetRoleCode?: string
  payload: Record<string, unknown>
}

export interface ModifierDefinition {
  code: string
  name: string
  groupCode: ModifierGroup
  description: string
  releaseState: 'mvp' | 'phase_1_1' | 'phase_2'
  active: boolean
  appliesTo: string
  preview: string[]
  conflictsWith: string[]
  actions: ModifierAction[]
}

export interface RescueModule {
  code: string
  name: string
  description: string
  slots: RecipeSlot[]
}

export type CompatibilityOperator =
  | 'eq'
  | 'neq'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'requires'

export interface TypedCompatibilityRule {
  id: string
  sourceRoleCode: string
  targetRoleCode: string | null
  sourceAttribute: string
  targetAttribute: string | null
  operator: CompatibilityOperator
  expectedValue: unknown
  unit: string | null
  severity: 'info' | 'warning' | 'blocking'
  message: string
  missingValueMessage: string
  active: boolean
  modifierCodes: string[]
  evidenceSourceId: string | null
}

export interface PreferenceOverlay {
  id: string
  slotId: string | null
  roleCode: string | null
  override: Partial<
    Pick<
      RecipeSlot,
      | 'requiredness'
      | 'quantityExpression'
      | 'setupZone'
      | 'proceduralPhase'
      | 'openHoldStatus'
      | 'notes'
    >
  > & {
    hospitalItemId?: string
  }
}

export interface BuildCardInput {
  organizationId: string
  siteId: string
  locationId: string
  recipeVersionId: string
  userId?: string
  /**
   * The exact module versions this card was built from. Stored verbatim rather than
   * recomputed from selection behaviour, so a later change to what is default-on cannot
   * silently reinterpret a saved card.
   */
  selectedModuleVersionIds: string[]
  modifierCodes: string[]
  variables: Record<string, string | number | boolean | null>
  conditionalStates?: Record<string, ConditionalState>
  /**
   * Which hospital item each requirement resolves to, keyed by composed slot id.
   *
   * `null` means "deliberately nothing", which is a decision and not a gap. A key that is
   * absent entirely means the card has never expressed an opinion about that requirement.
   */
  selectedHospitalItemIds?: Record<string, string | null>
  /**
   * Whether `selectedHospitalItemIds` is the complete record of this card's choices.
   *
   * Set once the builder has materialized a default for every requirement. From then on an
   * absent key means "not chosen" rather than "fall back to whatever the formulary ranks
   * first" — so a re-ranked formulary can no longer change what a saved card asks for. Cards
   * written before densification leave it unset and keep the old fallback, because inventing
   * an explicit selection for them would be choosing on the physician's behalf.
   */
  selectionsAreExplicit?: boolean
  waivers?: Record<string, string>
}

/**
 * Which release, catalog, and resolver contract a card was resolved through.
 *
 * Carried onto the resolved card because the semantic content projection needs stable release and
 * catalog identity, and the card previously had neither: `catalogImportId` on a card is the source
 * *workbook* digest — provenance printed on the page — while the catalog *release* digest a
 * release bundle pins lives only on the bundle. Two different questions that happened to share a
 * field name.
 *
 * Every field is nullable except the contract version, because the resolver is also driven from
 * places where no release exists: administrative previews of a composition, the generated scenario
 * fixtures, and the demo context. Those resolve honestly with nulls rather than being handed a
 * release nobody selected.
 */
export interface CardResolutionProvenance {
  releaseBundleId: string | null
  releaseDefinitionHash: string | null
  /** The catalog release the card's product identity is reconstructable from. */
  catalogReleaseId: string | null
  resolverContractVersion: string
}

/** Stable organization/site/location identifiers, as distinct from the display names. */
export interface CardScope {
  organizationId: string
  siteId: string
  locationId: string
}

export interface BuildContext {
  organizationName: string
  siteName: string
  locationName: string
  locationCapabilities: string[]
  /**
   * The release identity this context was built from, when it was built from one.
   *
   * Release-pinned rather than hospital-local: it names the immutable definition set the rest of
   * the pinned half came from. Null when the context was assembled without a release.
   */
  releaseIdentity: {
    releaseBundleId: string
    releaseDefinitionHash: string
    catalogReleaseId: string
  } | null
  recipe: RecipeVersion
  /** Every module version the recipe's composition can reach. Nothing else is selectable. */
  recipeModules: RecipeModuleVersion[]
  modifiers: ModifierDefinition[]
  rescueModules: RescueModule[]
  hospitalItems: HospitalItem[]
  hospitalRoleOptions: HospitalRoleOption[]
  compatibilityRules: TypedCompatibilityRule[]
  preferenceOverlays: PreferenceOverlay[]
}

export interface RuleTraceEvent {
  id: string
  sequence: number
  kind:
    | 'base_recipe'
    | 'composition'
    | 'modifier'
    | 'conflict'
    | 'rescue_module'
    | 'overlay'
    | 'resolution'
    | 'kit_suppression'
    | 'quantity'
    | 'capability'
    | 'compatibility'
    | 'waiver'
    | 'readiness'
  message: string
  sourceId: string | null
  slotId: string | null
}

export interface RuleMessage {
  id: string
  severity: 'info' | 'warning' | 'blocking'
  code: string
  message: string
  sourceType:
    | 'recipe'
    | 'recipe_module'
    | 'modifier'
    | 'slot'
    | 'hospital_item'
    | 'compatibility_rule'
    | 'room_capability'
    | 'governance'
  sourceId: string | null
  acknowledged: boolean
  waiverReason: string | null
}

export interface ResolvedCardItem {
  id: string
  sourceSlotId: string | null
  /** Absent on snapshots written before composition; present on every composed line. */
  requirementKey?: string
  sourceModuleVersionIds?: string[]
  roleCode: string
  label: string
  genericRequirement: string
  requiredness: Requiredness
  effectiveRequiredness: Requiredness
  dependencyRule: string | null
  conditionalState: ConditionalState | null
  quantityDisplay: string
  setupZone: SetupZone
  proceduralPhase: ProceduralPhase
  setupSequence: number
  openHoldStatus: OpenHoldStatus
  selectedHospitalItemId: string | null
  selectedCatalogProductId: string | null
  selectedItemSnapshot: HospitalItem | null
  resolutionState: ResolutionState
  verificationState: VerificationState
  compatibilityState: CompatibilityState
  rationale: string | null
  whyIncluded: string[]
  notes: string | null
}

export interface ResolvedCard {
  recipeVersionId: string
  recipeName: string
  recipeVersion: string
  sourceProcedureCode: string
  organizationName: string
  siteName: string
  locationName: string
  /** Stable identifiers behind the three display names above. */
  scope: CardScope
  /** Which release, catalog release, and resolver contract produced this card. */
  resolutionProvenance: CardResolutionProvenance
  selectedModifiers: string[]
  /**
   * The composition manifest. Part of the snapshot hash: a card built from different
   * modules, or from a different version of the same module, is a different card.
   *
   * Optional because snapshots written before composition do not have one. `resolveCard`
   * always sets it; the field is optional so every reader of a *stored* card is made to
   * handle the older shape instead of trusting the type.
   */
  includedModules?: IncludedRecipeModule[]
  items: ResolvedCardItem[]
  suppressedItems: ResolvedCardItem[]
  warnings: RuleMessage[]
  readinessState: ReadinessState
  governanceState: GovernanceState
  ruleTrace: RuleTraceEvent[]
  engineVersion: string
  catalogImportId: string
  /**
   * Storage identity: stable across re-saves of unchanged content, and what the `snapshot_hash`
   * column holds. Not proof of what was printed and not a semantic comparison — see
   * `card-hashes.ts`, which explains why one hash could not be all three.
   */
  snapshotHash: string
  /** Tamper detection over the complete stored snapshot, including `generatedAt`. */
  snapshotIntegrityHash: string
  /** The documented semantic projection: what the resolver decided, without implementation prose. */
  resolvedContentHash: string
  generatedAt: string
  prototype: boolean
}

export interface ScenarioDefinition {
  id: string
  title: string
  /** Recipe label from the source procedure; may differ from the scenario title. */
  recipeName: string
  shortDescription: string
  recipeVersionId: string
  sourceProcedureCode: string
  templateVersion: string
  defaultModifierCodes: string[]
  availableModifierCodes: string[]
  /** Required lines whose broad role has at least one existing Product_Roles product. */
  requiredCatalogCoverageCount: number
  requiredCatalogCoveragePercentage: number
  requiredSlotsWithoutCatalogProducts: string[]
  roleCodesWithoutCatalogProducts: string[]
  /** Required lines with at least one selectable canonical Slot_Product_Options row. */
  requiredDefaultOptionCoverageCount: number
  requiredDefaultOptionCoveragePercentage: number
  requiredSlotsWithoutDefaultOptions: string[]
  /** Descriptive only; custom entry is not a readiness or approval state. */
  requiredCustomAllowedCount: number
  slotCount: number
  requiredSlotCount: number
  governanceState: GovernanceState
  owner: string | null
}
