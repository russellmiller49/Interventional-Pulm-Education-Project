import type { RuntimeCrrtCase } from '../content/schema'
import type { CrrtLearningSessionState } from './learningSession'

type CrrtIntervention = RuntimeCrrtCase['interventions'][number]
type CrrtInterventionEffect = CrrtIntervention['effects'][number]

const consoleTargetLabels: Readonly<Record<string, string>> = Object.freeze({
  'prescription.flows.bloodFlowMlMin': 'Blood flow',
  'prescription.flows.dialysateFlowMlHour': 'Dialysate flow',
  'prescription.flows.preBloodPumpFlowMlHour': 'Pre-blood-pump flow',
  'prescription.flows.preReplacementFlowMlHour': 'Pre-filter replacement flow',
  'prescription.flows.postReplacementFlowMlHour': 'Post-filter replacement flow',
  'prescription.flows.patientFluidRemovalMlHour': 'Patient fluid removal',
  'prescription.flows.syringeFlowMlHour': 'Syringe flow',
  'prescription.flows.makeupFlowMlHour': 'Makeup flow',
  'patient.bodyWeightKg': 'Entered patient weight',
  'patient.hematocritFraction': 'Entered hematocrit',
  'device.deliveryState': 'Treatment delivery',
})

export interface CrrtConsoleSettingChange {
  readonly target: string
  readonly label: string
  readonly instruction: string
}

export interface CrrtConsoleActionModel {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly response: string
  readonly category: CrrtIntervention['category']
  readonly changes: readonly CrrtConsoleSettingChange[]
  readonly unsafe: boolean
  readonly performed: boolean
  readonly repeatable: boolean
  readonly enabled: boolean
  readonly missingPrerequisiteLabels: readonly string[]
}

export interface CrrtConsolePrerequisiteModel {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly category: CrrtIntervention['category']
  readonly unsafe: boolean
  readonly performed: boolean
  readonly enabled: boolean
  readonly missingPrerequisiteLabels: readonly string[]
}

export interface CrrtConsoleControlsModel {
  readonly settingActions: readonly CrrtConsoleActionModel[]
  readonly prerequisiteActions: readonly CrrtConsolePrerequisiteModel[]
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function formatEffectValue(effect: Extract<CrrtInterventionEffect, { valueType: 'number' }>) {
  if (effect.target === 'patient.hematocritFraction') {
    return `${formatNumber(effect.value * 100)}%`
  }
  return `${formatNumber(Math.abs(effect.value))} ${effect.unit}`
}

function describeNumberEffect(
  effect: Extract<CrrtInterventionEffect, { valueType: 'number' }>,
): string {
  const value = formatEffectValue(effect)
  switch (effect.operation) {
    case 'set':
      return `Set to ${value}`
    case 'add':
      return effect.value >= 0 ? `Increase by ${value}` : `Decrease by ${value}`
    case 'multiply':
      return `Multiply by ${formatNumber(effect.value)}`
    case 'move-toward':
      return `Move toward ${value}`
  }
}

function describeEnumEffect(
  effect: Extract<CrrtInterventionEffect, { valueType: 'enum' }>,
): string {
  if (effect.target !== 'device.deliveryState') return `Set to ${effect.value}`
  const deliveryLabels: Readonly<Record<string, string>> = {
    running: 'Run treatment',
    paused: 'Pause treatment',
    ended: 'End treatment',
    stopped: 'Stop treatment',
    idle: 'Keep treatment idle',
  }
  return deliveryLabels[effect.value] ?? `Set to ${effect.value}`
}

function consoleSettingChange(effect: CrrtInterventionEffect): CrrtConsoleSettingChange | null {
  const label = consoleTargetLabels[effect.target]
  if (!label) return null
  if (effect.valueType === 'number') {
    return { target: effect.target, label, instruction: describeNumberEffect(effect) }
  }
  if (effect.valueType === 'enum') {
    return { target: effect.target, label, instruction: describeEnumEffect(effect) }
  }
  return null
}

function missingPrerequisites(
  intervention: CrrtIntervention,
  interventionById: ReadonlyMap<string, CrrtIntervention>,
  performedIds: ReadonlySet<string>,
): readonly { readonly id: string; readonly label: string }[] {
  return intervention.prerequisites
    .filter((id) => !performedIds.has(id))
    .map((id) => ({ id, label: interventionById.get(id)?.label ?? id }))
}

/**
 * Exposes only changes already authored into the active case. The console never
 * invents a target, range, increment, or unrestricted bedside setting.
 */
export function selectCrrtConsoleControls(
  session: CrrtLearningSessionState,
): CrrtConsoleControlsModel {
  const interventions = session.caseDefinition.interventions
  const interventionById = new Map(
    interventions.map((intervention) => [intervention.id, intervention]),
  )
  const performedIds = new Set(session.performedInterventionIds)
  const unsafeIds = new Set(session.caseDefinition.unsafeActions.map(({ actionId }) => actionId))
  const canAct = !session.debriefRevealed

  const settingActions = interventions.flatMap<CrrtConsoleActionModel>((intervention) => {
    const changes = intervention.effects.flatMap((effect) => {
      const change = consoleSettingChange(effect)
      return change ? [change] : []
    })
    if (changes.length === 0) return []

    const missing = missingPrerequisites(intervention, interventionById, performedIds)
    const performed = performedIds.has(intervention.id)
    return [
      {
        id: intervention.id,
        label: intervention.label,
        description: intervention.description,
        response: intervention.response,
        category: intervention.category,
        changes,
        unsafe: unsafeIds.has(intervention.id),
        performed,
        repeatable: intervention.repeatable,
        enabled: canAct && missing.length === 0 && (!performed || intervention.repeatable),
        missingPrerequisiteLabels: missing.map(({ label }) => label),
      },
    ]
  })

  const settingActionIds = new Set(settingActions.map(({ id }) => id))
  const prerequisiteIds = new Set(
    settingActions.flatMap((action) => {
      const intervention = interventionById.get(action.id)
      return intervention?.prerequisites ?? []
    }),
  )

  const prerequisiteActions = [...prerequisiteIds].flatMap<CrrtConsolePrerequisiteModel>((id) => {
    if (settingActionIds.has(id)) return []
    const intervention = interventionById.get(id)
    if (!intervention) return []
    const missing = missingPrerequisites(intervention, interventionById, performedIds)
    const performed = performedIds.has(id)
    return [
      {
        id,
        label: intervention.label,
        description: intervention.description,
        category: intervention.category,
        unsafe: unsafeIds.has(id),
        performed,
        enabled: canAct && missing.length === 0 && (!performed || intervention.repeatable),
        missingPrerequisiteLabels: missing.map(({ label }) => label),
      },
    ]
  })

  return Object.freeze({
    settingActions: Object.freeze(settingActions),
    prerequisiteActions: Object.freeze(prerequisiteActions),
  })
}
