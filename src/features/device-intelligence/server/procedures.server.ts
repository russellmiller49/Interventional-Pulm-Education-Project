import 'server-only'

import procedureSlotsJson from '../../../../data/ip-preference-cards/generated/procedure-slots.json'
import slotProductOptionsJson from '../../../../data/ip-preference-cards/generated/slot-product-options.json'
import slotOptionProposalsJson from '../../../../data/ip-preference-cards/generated/slot-product-option-proposals.json'
import demoStandInsJson from '../../../../data/ip-preference-cards/seed/demo-stand-ins.json'
import hospitalFormularyJson from '../../../../data/ip-preference-cards/generated/hospital-formulary-staging.json'

import {
  buildDemoContext,
  getComposedRecipeSlots,
  getScenarioDefinitions,
  resolveDemoScenario,
} from '@/features/preference-cards/data/demo-context.server'
import { getCurrentReleaseBundle } from '@/features/preference-cards/data/release-bundles.server'
import { expandEffectiveSlots } from '@/features/preference-cards/domain/effective-slots'
import { defaultSelectedModuleVersionIds } from '@/features/preference-cards/domain/expand-recipe-composition'
import { getCatalogStore } from '@/features/preference-cards/server/catalog'
import { proceduralPhases } from '@/features/preference-cards/domain/types'
import type {
  ModifierDefinition,
  RecipeSlot,
  ResolvedCard,
  ScenarioDefinition,
} from '@/features/preference-cards/domain/types'
import type {
  ProcedureSlotRecord,
  SlotProductOptionRecord,
} from '@/features/preference-cards/server/catalog-store'

import {
  D1_EXEMPLAR_PROCEDURE_CODES,
  isExemplarProcedureCode,
  type D1ExemplarProcedureCode,
} from '@/features/device-intelligence/domain/exemplars'
import {
  classifyAuthoredCoverage,
  computeCoverageLadder,
  type CoverageLadderResult,
  type RoleCoverageRow,
} from '@/features/device-intelligence/domain/coverage-ladder'
import {
  projectDemoReadiness,
  type FormularyAssertionInput,
  type ReadinessProjection,
} from '@/features/device-intelligence/domain/readiness'
import { requiresLaserPathwayDisclosure } from '@/features/device-intelligence/domain/laser-pathway'
import { getAtlasCatalogStore } from './atlas-store.server'
import {
  getRawStatementsForRoles,
  getTypedRuleConditionsForRoles,
  type AtlasCompatibilityStatement,
  type TypedRuleCondition,
} from './compatibility.server'

/**
 * Procedure-workspace view models for the three Phase D1 exemplar procedures
 * (decision D-05: EBUS_TBNA, THERAPEUTIC_BRONCH, CHEST_TUBE — and only these).
 *
 * Everything here is a projection of the existing governed graph: `procedures.json` rows,
 * the release-pinned compositions expanded by `expandEffectiveSlots`/`getComposedRecipeSlots`,
 * the pinned modifier/rescue/compatibility sets from the demo build context, and the
 * coverage ladder recomputed from the same generated rows the D0 audit reads. There is no
 * second expansion or resolution engine and nothing is persisted.
 */

/**
 * The canonical procedural-phase sequence (owner-review F-03). Grouping "by procedural
 * phase" must follow the declared clinical chronology, never the first-appearance order of
 * requirements in the authored template — which reflects catalog accretion, not sequence.
 * The chronology is the governed domain tuple itself (`unassigned` last), so a future
 * release that adds a phase cannot drift from this ordering.
 */
export const CANONICAL_PROCEDURAL_PHASE_ORDER: readonly string[] = proceduralPhases

/** Order distinct phase values canonically; any unknown value sorts after known ones. */
export function sortPhasesCanonically(phases: string[]): string[] {
  const rank = (phase: string) => {
    const index = CANONICAL_PROCEDURAL_PHASE_ORDER.indexOf(phase)
    return index === -1 ? CANONICAL_PROCEDURAL_PHASE_ORDER.length : index
  }
  return [...phases].sort((left, right) => rank(left) - rank(right))
}

interface ProposalRow {
  slot_id: string
  procedure_code: string
}

interface DemoStandInRow {
  role_code: string
}

interface FormularyRow {
  formulary_id: string
  product_id: string
  role_codes: string | null
  hospital_carries: boolean
  preferred: boolean
  local_item_number: string | null
  local_description: string | null
  local_uom: string | null
  storage_location: string | null
  par_level: string | number | null
  last_reviewed: string | null
  local_notes: string | null
}

const procedureSlots = procedureSlotsJson as unknown as ProcedureSlotRecord[]
const slotProductOptions = slotProductOptionsJson as unknown as SlotProductOptionRecord[]
const slotOptionProposals = (slotOptionProposalsJson as unknown as { proposals: ProposalRow[] })
  .proposals
const demoStandIns = demoStandInsJson as unknown as DemoStandInRow[]
const formularyRows = hospitalFormularyJson as unknown as FormularyRow[]

const demoStandInRoleCodes: ReadonlySet<string> = new Set(demoStandIns.map((row) => row.role_code))

const optionsBySlot = (() => {
  const index = new Map<string, SlotProductOptionRecord[]>()
  for (const option of slotProductOptions) {
    const rows = index.get(option.slot_id)
    if (rows) rows.push(option)
    else index.set(option.slot_id, [option])
  }
  return index
})()

const proposalCountBySlot = (() => {
  const index = new Map<string, number>()
  for (const proposal of slotOptionProposals) {
    index.set(proposal.slot_id, (index.get(proposal.slot_id) ?? 0) + 1)
  }
  return index
})()

export interface RoleSlotUsage {
  slotId: string
  procedureCode: string
  procedureName: string
  /** Verbatim `procedures.json` status string. */
  procedureStatus: string | null
  slotLabel: string
  requiredness: string
  /** Authored-option status of this slot: the same rungs the coverage ladder uses. */
  optionStatus:
    | 'selectable_authored'
    | 'non_selectable_authored_only'
    | 'proposals_only'
    | 'no_authored_option'
  proposalCount: number
}

/**
 * Every procedure slot that requests a role, with its authored-option status — for the role
 * page's "authored selectable vs non-selectable vs proposals-only" column. Proposals appear
 * only as counts; they are unreviewed and never selectable.
 */
export function getRoleSlotUsage(roleCode: string): RoleSlotUsage[] {
  const store = getCatalogStore()
  return procedureSlots
    .filter((slot) => slot.role_code === roleCode)
    .map((slot) => {
      const options = optionsBySlot.get(slot.slot_id) ?? []
      const proposalCount = proposalCountBySlot.get(slot.slot_id) ?? 0
      // The one shared rung classifier — the same definition the coverage ladder uses, so
      // this column can never disagree with the workspace about the same slot. The two
      // "no option, no proposal" rungs collapse into one display status here.
      const rung = classifyAuthoredCoverage({
        hasSelectableOption: options.some((option) => option.selectable === true),
        optionCount: options.length,
        proposalCount,
        roleMappedElsewhere: store.productIdsByRole.has(roleCode),
      })
      const optionStatus: RoleSlotUsage['optionStatus'] =
        rung === 'no_option_no_proposal_role_mapped' || rung === 'no_option_no_proposal_unmapped'
          ? 'no_authored_option'
          : rung
      const procedure = store.procedureByCode.get(slot.procedure_code)
      return {
        slotId: slot.slot_id,
        procedureCode: slot.procedure_code,
        procedureName: procedure?.procedure_name ?? slot.procedure_code,
        procedureStatus: procedure?.status ?? null,
        slotLabel: slot.slot_label,
        requiredness: slot.requiredness,
        optionStatus,
        proposalCount,
      }
    })
    .sort(
      (left, right) =>
        left.procedureName.localeCompare(right.procedureName) ||
        left.slotLabel.localeCompare(right.slotLabel),
    )
}

/** The one scenario a Phase D1 procedure publishes. Asserted unique at first use. */
function scenarioForProcedure(procedureCode: D1ExemplarProcedureCode): ScenarioDefinition {
  const matches = getScenarioDefinitions().filter(
    (scenario) => scenario.sourceProcedureCode === procedureCode,
  )
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one scenario for ${procedureCode}, found ${matches.length}. The D1 workspace addresses a procedure through its single published scenario.`,
    )
  }
  return matches[0]
}

export function getCoverageLadderForProcedure(
  procedureCode: D1ExemplarProcedureCode,
): CoverageLadderResult {
  const store = getCatalogStore()
  const mappedRoleCodes = new Set(store.productIdsByRole.keys())
  return computeCoverageLadder({
    slots: procedureSlots.filter((slot) => slot.procedure_code === procedureCode),
    slotProductOptions,
    slotOptionProposals,
    mappedRoleCodes,
    demoStandInRoleCodes,
  })
}

export interface ExemplarProcedureIndexEntry {
  procedureCode: D1ExemplarProcedureCode
  procedureName: string
  /** Verbatim `procedures.json` status string — never paraphrased. */
  status: string
  templateVersion: string | null
  scenarioId: string
  releaseBundleId: string | null
  releaseDefinitionHash: string | null
  slotCount: number
  requiredness: { required: number; contingency: number; optional: number }
  ladderSummary: CoverageLadderResult['summary']
  clinicalOwner: string | null
  governanceState: string
}

export function getExemplarProcedureIndex(): ExemplarProcedureIndexEntry[] {
  const store = getCatalogStore()
  return D1_EXEMPLAR_PROCEDURE_CODES.map((procedureCode) => {
    const procedure = store.procedureByCode.get(procedureCode)
    if (!procedure) {
      throw new Error(`Exemplar procedure ${procedureCode} is missing from procedures.json.`)
    }
    const scenario = scenarioForProcedure(procedureCode)
    const bundle = getCurrentReleaseBundle(procedureCode)
    const slots = procedureSlots.filter((slot) => slot.procedure_code === procedureCode)
    const countRequiredness = (value: string) =>
      slots.filter((slot) => slot.requiredness === value).length
    return {
      procedureCode,
      procedureName: procedure.procedure_name,
      status: procedure.status ?? 'unknown',
      templateVersion: procedure.template_version,
      scenarioId: scenario.id,
      releaseBundleId: bundle?.id ?? null,
      releaseDefinitionHash: bundle?.definitionHash ?? null,
      slotCount: slots.length,
      requiredness: {
        required: countRequiredness('required'),
        contingency: countRequiredness('conditional'),
        optional: countRequiredness('optional'),
      },
      ladderSummary: getCoverageLadderForProcedure(procedureCode).summary,
      clinicalOwner: scenario.owner,
      governanceState: scenario.governanceState,
    }
  })
}

/**
 * An authored option the PUBLIC workspace may identify. Only products inside the D1 atlas
 * cohort get one of these (Codex C-02): the cohort wall is applied here, at the server
 * view-model boundary, so a candidate-grade or hidden product's id, name, manufacturer, and
 * catalog number never enter the workspace view model, the RSC payload, or any rendered
 * attribute. Non-cohort authored options surface only as the aggregate withheld counts on
 * the requirement.
 */
export interface WorkspaceOptionLink {
  productId: string
  productName: string
  manufacturerDisplay: string | null
  catalogNumber: string | null
  selectable: boolean
  eligibilityStatus: string | null
}

export interface WorkspaceRequirement {
  /** Composed requirement id (equals the imported SLOT-… id for template slots). */
  id: string
  sourceSlotId: string | null
  requirementKey: string
  authoredOrder: number
  section: string | null
  roleCode: string
  roleName: string
  label: string
  /** Authored clinician text, quoted verbatim. */
  genericRequirement: string
  requiredness: string
  dependencyRule: string | null
  selectionMode: string
  allowCustom: boolean
  openHoldStatus: string
  setupZone: string
  proceduralPhase: string
  responsibleRole: string | null
  sterileStatus: string | null
  coverage: RoleCoverageRow | null
  /** Cohort-identifiable authored options only — see `WorkspaceOptionLink`. */
  authoredOptions: WorkspaceOptionLink[]
  /**
   * Authored options that exist for this slot but whose identities are withheld from this
   * public cohort view (C-02). The counts keep the structural truth honest — the slot is
   * never presented as having no authored options when identities are merely withheld.
   */
  withheldAuthoredOptionCount: number
  withheldSelectableOptionCount: number
  /** Unreviewed proposal count for this slot. Display-only; never selectable. */
  proposalCount: number
  requiresCurrentIfu: boolean
  selectionGuidance: string | null
}

export interface ModifierEffectSummary {
  code: string
  name: string
  groupCode: string
  description: string
  /** Verbatim release gate from the pinned modifier definition (mvp / phase_1_1 / phase_2). */
  releaseState: string
  /**
   * False when every effect list below is empty: selecting the modifier changes nothing
   * structurally in this release. Owner-review finding F-01 requires such modifiers to be
   * labeled informational, never presented as acting options.
   */
  hasStructuralEffect: boolean
  preview: string[]
  conflictsWith: string[]
  /** Derived through `expandEffectiveSlots` — the canonical expansion, not a re-implementation. */
  effects: {
    addedRequirements: {
      id: string
      label: string
      roleCode: string
      requiredness: string
      /** The authored dependency prose for a conditional requirement, null otherwise. */
      dependencyRule: string | null
    }[]
    removedRequirements: { id: string; label: string; roleCode: string }[]
    requirednessChanges: { id: string; label: string; from: string; to: string }[]
    roleReplacements: { id: string; label: string; fromRole: string; toRole: string }[]
    rescueModulesAdded: string[]
    requiredCapabilities: string[]
  }
}

export interface RescueModuleView {
  code: string
  name: string
  description: string
  reachableViaModifierCodes: string[]
  slots: {
    id: string
    label: string
    roleCode: string
    roleName: string
    genericRequirement: string
    requiredness: string
    openHoldStatus: string
  }[]
}

export interface ProcedureWorkspace {
  procedureCode: D1ExemplarProcedureCode
  procedureName: string
  status: string
  templateVersion: string | null
  scenarioId: string
  scenarioTitle: string
  releaseBundleId: string | null
  releaseDefinitionHash: string | null
  catalogReleaseId: string | null
  governanceState: string
  clinicalOwner: string | null
  requirements: WorkspaceRequirement[]
  setupZoneOrder: string[]
  proceduralPhaseOrder: string[]
  sectionOrder: string[]
  ladder: CoverageLadderResult
  modifiers: ModifierEffectSummary[]
  defaultModifierCodes: string[]
  rescueModules: RescueModuleView[]
  /** True only for CHEST_TUBE today: no allowed modifier reaches any rescue module. */
  noRescueModuleReachable: boolean
  rescueSectionSlotCount: number
  /**
   * Every rescue module the pinned release defines system-wide (owner-review F-11): when no
   * module is reachable, the page states what rescue authoring exists at all, so absence
   * reads as an authoring gap rather than a clinical judgment.
   */
  authoredRescueModuleNames: string[]
  typedRuleConditions: TypedRuleCondition[]
  rawCompatibilityStatements: AtlasCompatibilityStatement[]
  proposalTotal: number
  formularySummary: RealFormularySummary
  /**
   * Owner-review F-07 derived per Codex C-07: true when the composed workspace carries at
   * least one `LASER*` governed requirement and none of them has an authored SELECTABLE
   * option in the pinned release. The page renders the laser-pathway disclosure from this
   * fact — never from a hardcoded procedure code.
   */
  laserPathwayDisclosureRequired: boolean
}

export interface RealFormularySummary {
  rowsIntersectingProcedureRoles: number
  carriedRows: number
  preferredRows: number
  rowsWithAnyLocalField: number
}

/** The one parse of a formulary row's role codes — shared by row filtering and readiness. */
function parseFormularyRoleCodes(row: FormularyRow): string[] {
  return (row.role_codes ?? '')
    .split(/[;,]/)
    .map((code) => code.trim())
    .filter(Boolean)
}

function formularyRowsForRoles(roleCodes: ReadonlySet<string>): FormularyRow[] {
  return formularyRows.filter((row) =>
    parseFormularyRoleCodes(row).some((code) => roleCodes.has(code)),
  )
}

function realFormularySummary(roleCodes: ReadonlySet<string>): RealFormularySummary {
  const rows = formularyRowsForRoles(roleCodes)
  const hasLocalField = (row: FormularyRow) =>
    Boolean(
      row.local_item_number ??
      row.local_description ??
      row.local_uom ??
      row.storage_location ??
      row.par_level ??
      row.last_reviewed ??
      row.local_notes,
    )
  return {
    rowsIntersectingProcedureRoles: rows.length,
    carriedRows: rows.filter((row) => row.hospital_carries).length,
    preferredRows: rows.filter((row) => row.preferred).length,
    rowsWithAnyLocalField: rows.filter(hasLocalField).length,
  }
}

function modifierEffects(
  modifier: ModifierDefinition,
  context: ReturnType<typeof buildDemoContext>,
  // The modifier-free expansion is identical for every modifier of one workspace render, so
  // the caller computes it once and threads it through.
  baseline: ReturnType<typeof expandEffectiveSlots>,
): ModifierEffectSummary['effects'] {
  const selectedModuleVersionIds = defaultSelectedModuleVersionIds(context.recipe)
  const withModifier = expandEffectiveSlots(
    { selectedModuleVersionIds, modifierCodes: [modifier.code] },
    context,
  )

  const baselineById = new Map(baseline.slots.map((slot) => [slot.id, slot]))
  const withById = new Map(withModifier.slots.map((slot) => [slot.id, slot]))

  const addedRequirements = withModifier.slots
    .filter((slot) => !baselineById.has(slot.id))
    .map((slot) => ({
      id: slot.id,
      label: slot.label,
      roleCode: slot.roleCode,
      requiredness: slot.requiredness,
      dependencyRule: slot.dependencyRule,
    }))
  const removedRequirements = baseline.slots
    .filter((slot) => !withById.has(slot.id))
    .map((slot) => ({ id: slot.id, label: slot.label, roleCode: slot.roleCode }))
  const requirednessChanges: ModifierEffectSummary['effects']['requirednessChanges'] = []
  const roleReplacements: ModifierEffectSummary['effects']['roleReplacements'] = []
  for (const slot of withModifier.slots) {
    const before = baselineById.get(slot.id)
    if (!before) continue
    if (before.requiredness !== slot.requiredness) {
      requirednessChanges.push({
        id: slot.id,
        label: slot.label,
        from: before.requiredness,
        to: slot.requiredness,
      })
    }
    if (before.roleCode !== slot.roleCode) {
      roleReplacements.push({
        id: slot.id,
        label: slot.label,
        fromRole: before.roleCode,
        toRole: slot.roleCode,
      })
    }
  }

  const requiredCapabilities = modifier.actions
    .filter((action) => action.actionType === 'require_room_capability')
    .map((action) => String(action.payload.capability ?? ''))
    .filter(Boolean)

  return {
    addedRequirements,
    removedRequirements,
    requirednessChanges,
    roleReplacements,
    rescueModulesAdded: [...withModifier.rescueModuleCodes],
    requiredCapabilities,
  }
}

export function getProcedureWorkspace(procedureCode: string): ProcedureWorkspace | null {
  if (!isExemplarProcedureCode(procedureCode)) return null
  const store = getCatalogStore()
  const atlasStore = getAtlasCatalogStore()
  const procedure = store.procedureByCode.get(procedureCode)
  if (!procedure) return null
  const scenario = scenarioForProcedure(procedureCode)
  const bundle = getCurrentReleaseBundle(procedureCode)
  const context = buildDemoContext(scenario.id)
  const composedSlots = getComposedRecipeSlots(scenario.id)
  const ladder = getCoverageLadderForProcedure(procedureCode)
  const slotRecordById = new Map(
    procedureSlots
      .filter((slot) => slot.procedure_code === procedureCode)
      .map((slot) => [slot.slot_id, slot]),
  )

  // The C-02 cohort wall: identities come from the ATLAS store only. A non-cohort option
  // row never yields an option link — its product id is not read at all on this path — so
  // no hidden identity can ride into the view model inside a nominally redacted object.
  const toCohortOptionLink = (option: SlotProductOptionRecord): WorkspaceOptionLink | null => {
    const product = atlasStore.productById.get(option.product_id)
    if (!product) return null
    return {
      productId: product.product_id,
      productName: product.product_name,
      manufacturerDisplay: product.manufacturerDisplay,
      catalogNumber: product.catalog_number,
      selectable: option.selectable === true,
      eligibilityStatus: option.eligibility_status,
    }
  }

  const requirements: WorkspaceRequirement[] = composedSlots.map((slot: RecipeSlot) => {
    const record = slot.sourceSlotId ? slotRecordById.get(slot.sourceSlotId) : undefined
    const role = store.roleByCode.get(slot.roleCode)
    const options = slot.sourceSlotId ? (optionsBySlot.get(slot.sourceSlotId) ?? []) : []
    const cohortOptions = options
      .map(toCohortOptionLink)
      .filter((link): link is WorkspaceOptionLink => link !== null)
    const withheldOptions = options.filter(
      (option) => !atlasStore.productById.has(option.product_id),
    )
    return {
      id: slot.id,
      sourceSlotId: slot.sourceSlotId,
      requirementKey: slot.requirementKey,
      authoredOrder: slot.setupSequence,
      section: record?.section ?? null,
      roleCode: slot.roleCode,
      roleName: role?.role_name ?? slot.roleCode,
      label: slot.label,
      genericRequirement: slot.genericRequirement,
      requiredness: slot.requiredness,
      dependencyRule: slot.dependencyRule,
      selectionMode: slot.selectionMode,
      allowCustom: slot.allowCustom,
      openHoldStatus: slot.openHoldStatus,
      setupZone: slot.setupZone,
      proceduralPhase: slot.proceduralPhase,
      responsibleRole: slot.responsibleRole,
      sterileStatus: slot.sterileStatus,
      coverage: ladder.byRoleCode.get(slot.roleCode) ?? null,
      authoredOptions: cohortOptions.sort(
        (left, right) =>
          Number(right.selectable) - Number(left.selectable) ||
          left.productName.localeCompare(right.productName),
      ),
      withheldAuthoredOptionCount: withheldOptions.length,
      withheldSelectableOptionCount: withheldOptions.filter((option) => option.selectable === true)
        .length,
      proposalCount: slot.sourceSlotId ? (proposalCountBySlot.get(slot.sourceSlotId) ?? 0) : 0,
      requiresCurrentIfu: role?.requires_current_ifu === true,
      selectionGuidance: role?.selection_guidance ?? null,
    }
  })

  const baselineExpansion = expandEffectiveSlots(
    {
      selectedModuleVersionIds: defaultSelectedModuleVersionIds(context.recipe),
      modifierCodes: [],
    },
    context,
  )
  const modifiers: ModifierEffectSummary[] = context.modifiers.map((modifier) => {
    const effects = modifierEffects(modifier, context, baselineExpansion)
    return {
      code: modifier.code,
      name: modifier.name,
      groupCode: modifier.groupCode,
      description: modifier.description,
      releaseState: modifier.releaseState,
      hasStructuralEffect:
        effects.addedRequirements.length > 0 ||
        effects.removedRequirements.length > 0 ||
        effects.requirednessChanges.length > 0 ||
        effects.roleReplacements.length > 0 ||
        effects.rescueModulesAdded.length > 0 ||
        effects.requiredCapabilities.length > 0,
      preview: [...modifier.preview],
      conflictsWith: [...modifier.conflictsWith],
      effects,
    }
  })

  const rescueReachability = new Map<string, string[]>()
  for (const modifier of modifiers) {
    for (const code of modifier.effects.rescueModulesAdded) {
      const existing = rescueReachability.get(code)
      if (existing) existing.push(modifier.code)
      else rescueReachability.set(code, [modifier.code])
    }
  }

  const rescueModules: RescueModuleView[] = [...rescueReachability.entries()].map(
    ([code, viaModifiers]) => {
      const rescueModule = context.rescueModules.find((candidate) => candidate.code === code)
      return {
        code,
        name: rescueModule?.name ?? code,
        description: rescueModule?.description ?? '',
        reachableViaModifierCodes: viaModifiers.sort(),
        slots: (rescueModule?.slots ?? []).map((slot) => ({
          id: slot.id,
          label: slot.label,
          roleCode: slot.roleCode,
          roleName: store.roleByCode.get(slot.roleCode)?.role_name ?? slot.roleCode,
          genericRequirement: slot.genericRequirement,
          requiredness: slot.requiredness,
          openHoldStatus: slot.openHoldStatus,
        })),
      }
    },
  )

  const roleCodes = new Set(requirements.map((requirement) => requirement.roleCode))
  const rescueSectionSlotCount = [...slotRecordById.values()].filter(
    (slot) => slot.section === 'Rescue',
  ).length

  // C-07: derived from the RAW authored option rows (pre-cohort-withholding), because the
  // disclosure is a statement about what the release authors, not about what this public
  // view may identify.
  const laserPathwayDisclosureRequired = requiresLaserPathwayDisclosure(
    composedSlots.map((slot: RecipeSlot) => ({
      roleCode: slot.roleCode,
      hasAuthoredSelectableOption: (slot.sourceSlotId
        ? (optionsBySlot.get(slot.sourceSlotId) ?? [])
        : []
      ).some((option) => option.selectable === true),
    })),
  )

  return {
    procedureCode,
    procedureName: procedure.procedure_name,
    status: procedure.status ?? 'unknown',
    templateVersion: procedure.template_version,
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    releaseBundleId: bundle?.id ?? null,
    releaseDefinitionHash: bundle?.definitionHash ?? null,
    catalogReleaseId: bundle?.catalogImportId ?? null,
    governanceState: scenario.governanceState,
    clinicalOwner: scenario.owner,
    requirements,
    setupZoneOrder: orderedDistinct(requirements.map((requirement) => requirement.setupZone)),
    proceduralPhaseOrder: sortPhasesCanonically(
      orderedDistinct(requirements.map((requirement) => requirement.proceduralPhase)),
    ),
    sectionOrder: orderedDistinct(
      requirements
        .map((requirement) => requirement.section)
        .filter((section): section is string => section !== null),
    ),
    ladder,
    modifiers,
    defaultModifierCodes: [...scenario.defaultModifierCodes],
    rescueModules,
    noRescueModuleReachable: rescueModules.length === 0,
    rescueSectionSlotCount,
    authoredRescueModuleNames: context.rescueModules.map((rescueModule) => rescueModule.name),
    typedRuleConditions: getTypedRuleConditionsForRoles([...roleCodes]),
    rawCompatibilityStatements: getRawStatementsForRoles([...roleCodes]),
    proposalTotal: requirements.reduce(
      (total, requirement) => total + requirement.proposalCount,
      0,
    ),
    formularySummary: realFormularySummary(roleCodes),
    laserPathwayDisclosureRequired,
  }
}

function orderedDistinct(values: string[]): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const value of values) {
    if (seen.has(value)) continue
    seen.add(value)
    ordered.push(value)
  }
  return ordered
}

export interface ProcedureReadinessView {
  procedureCode: D1ExemplarProcedureCode
  procedureName: string
  status: string
  scenarioId: string
  scenarioTitle: string
  modifierCodes: string[]
  projection: ReadinessProjection
  formularySummary: RealFormularySummary
  demoContextName: { organization: string; site: string; location: string }
  demoLocationCapabilities: string[]
  /** Derived from the pinned modifier set, same as the workspace — never hardcoded per code. */
  noRescueModuleReachable: boolean
  /** Same F-11 statement the workspace carries: what rescue authoring exists at all. */
  authoredRescueModuleNames: string[]
}

/**
 * The demo-only readiness view: resolve the scenario through the EXISTING resolver with its
 * default modifiers over the EXISTING fictional demo context, then run the pure eight-state
 * projection over the result. Recomputed per request; nothing persisted.
 */
export function getProcedureReadinessView(procedureCode: string): ProcedureReadinessView | null {
  if (!isExemplarProcedureCode(procedureCode)) return null
  const store = getCatalogStore()
  const procedure = store.procedureByCode.get(procedureCode)
  if (!procedure) return null
  const scenario = scenarioForProcedure(procedureCode)
  const context = buildDemoContext(scenario.id)
  const resolved = resolveDemoScenario(scenario.id)
  const ladder = getCoverageLadderForProcedure(procedureCode)
  const roleCodes = new Set(
    procedureSlots
      .filter((slot) => slot.procedure_code === procedureCode)
      .map((slot) => slot.role_code),
  )

  const projection = buildReadinessProjection(procedureCode, resolved, ladder)

  return {
    procedureCode,
    procedureName: procedure.procedure_name,
    status: procedure.status ?? 'unknown',
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    modifierCodes: [...resolved.selectedModifiers],
    projection,
    formularySummary: realFormularySummary(roleCodes),
    demoContextName: {
      organization: resolved.organizationName,
      site: resolved.siteName,
      location: resolved.locationName,
    },
    demoLocationCapabilities: [...context.locationCapabilities],
    // Same derivation the workspace uses: does ANY pinned modifier append a rescue module?
    noRescueModuleReachable: !context.modifiers.some((modifier) =>
      modifier.actions.some((action) => action.actionType === 'add_rescue_module'),
    ),
    authoredRescueModuleNames: context.rescueModules.map((rescueModule) => rescueModule.name),
  }
}

/** Shared projection assembly, also used by the gap output and by tests. */
export function buildReadinessProjection(
  procedureCode: D1ExemplarProcedureCode,
  resolved: ResolvedCard,
  ladder: CoverageLadderResult = getCoverageLadderForProcedure(procedureCode),
): ReadinessProjection {
  const store = getCatalogStore()
  const productGradeById = new Map(
    store.products.map((product) => [product.product_id, product.verification_grade ?? 'unknown']),
  )
  const authoredSelectablePairs = new Set(
    slotProductOptions
      .filter((option) => option.selectable === true)
      .map((option) => `${option.slot_id}|${option.product_id}`),
  )
  const procedureOwnSlots = procedureSlots.filter((slot) => slot.procedure_code === procedureCode)
  const roleCodes = new Set(procedureOwnSlots.map((slot) => slot.role_code))
  // C-04: the role-scoped eligibility surface. For each requirement role of THIS procedure,
  // the product ids that are authored SELECTABLE options on that role's own slots — so a
  // formulary row is judged against the slots its role codes actually name, and a product
  // selectable for an unrelated slot can never satisfy a different role's row.
  const authoredSelectableProductIdsByRole = new Map<string, Set<string>>()
  for (const slot of procedureOwnSlots) {
    for (const option of slotProductOptions) {
      if (option.slot_id !== slot.slot_id || option.selectable !== true) continue
      const ids = authoredSelectableProductIdsByRole.get(slot.role_code)
      if (ids) ids.add(option.product_id)
      else authoredSelectableProductIdsByRole.set(slot.role_code, new Set([option.product_id]))
    }
  }
  const formularyAssertions: FormularyAssertionInput[] = formularyRowsForRoles(roleCodes).map(
    (row) => ({
      formularyId: row.formulary_id,
      productId: row.product_id,
      hospitalCarries: row.hospital_carries,
      preferred: row.preferred,
      productVisibilityState: store.productById.get(row.product_id)?.visibility_state ?? null,
      // C-04b: only the roles this row asserts THAT this procedure actually requires — the
      // parsed codes intersected with the procedure's own role set, deduplicated, sorted.
      // The projection then requires eligibility for every one of them; a role the row
      // names for some other procedure never widens (or falsely fails) this procedure's
      // check.
      roleCodes: [
        ...new Set(parseFormularyRoleCodes(row).filter((code) => roleCodes.has(code))),
      ].sort(),
    }),
  )

  return projectDemoReadiness({
    items: resolved.items.map((item) => ({
      id: item.id,
      sourceSlotId: item.sourceSlotId,
      roleCode: item.roleCode,
      label: item.label,
      effectiveRequiredness: item.effectiveRequiredness,
      includedBy: item.whyIncluded.join(' '),
      selectedHospitalItemId: item.selectedHospitalItemId,
      selectedCatalogProductId: item.selectedCatalogProductId,
      verificationState: item.verificationState,
      compatibilityState: item.compatibilityState,
    })),
    warnings: resolved.warnings.map((warning) => ({
      severity: warning.severity,
      code: warning.code,
      message: warning.message,
      sourceId: warning.sourceId,
    })),
    ladderByRole: ladder.byRoleCode,
    productGradeById,
    authoredSelectablePairs,
    demoStandInRoleCodes,
    authoredSelectableProductIdsByRole,
    formularyAssertions,
  })
}
