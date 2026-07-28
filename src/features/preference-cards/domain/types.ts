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

export type Requiredness = 'required' | 'conditional' | 'optional' | 'backup' | 'emergency_only'

export type OpenHoldStatus =
  | 'open_or_set_up_now'
  | 'have_in_room'
  | 'hold_unopened'
  | 'emergency_pull'
  | 'do_not_substitute'

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
  slots: RecipeSlot[]
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

export type ModifierActionType =
  | 'add_slot'
  | 'remove_slot'
  | 'replace_role'
  | 'set_requiredness'
  | 'set_quantity'
  | 'set_setup_zone'
  | 'set_procedural_phase'
  | 'set_open_hold_status'
  | 'append_note'
  | 'require_room_capability'
  | 'add_rescue_module'
  | 'validate_compatibility'
  | 'raise_warning'
  | 'raise_blocking_error'

export interface ModifierAction {
  id: string
  modifierCode: string
  sequence: number
  actionType: ModifierActionType
  targetSlotId?: string
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
  modifierCodes: string[]
  variables: Record<string, string | number | boolean | null>
  conditionalStates?: Record<string, ConditionalState>
  selectedHospitalItemIds?: Record<string, string | null>
  waivers?: Record<string, string>
}

export interface BuildContext {
  organizationName: string
  siteName: string
  locationName: string
  locationCapabilities: string[]
  recipe: RecipeVersion
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
  selectedModifiers: string[]
  items: ResolvedCardItem[]
  suppressedItems: ResolvedCardItem[]
  warnings: RuleMessage[]
  readinessState: ReadinessState
  governanceState: GovernanceState
  ruleTrace: RuleTraceEvent[]
  engineVersion: string
  catalogImportId: string
  snapshotHash: string
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
  requiredRoleMappingPercentage: number
  /** Roles this procedure requests that have no catalogued product; surfaced honestly in the UI. */
  emptyRoleCodes: string[]
  slotCount: number
  requiredSlotCount: number
  governanceState: GovernanceState
  owner: string | null
}
