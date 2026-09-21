import type { RuntimeCrrtCase } from './content/schema'
import type { CrrtLearningSessionState } from './engine/learningSession'
import {
  crrtSoluteDisplayLabels,
  crrtSoluteMissingInputLabels,
  selectCrrtSoluteDynamicsValidityMap,
  type CrrtSoluteDynamicsValidityMap,
  type CrrtSoluteMissingInputId,
} from './engine/soluteValidity'
import { crrtSoluteIds, type CrrtSoluteId } from './engine/types'

/**
 * Laboratory evidence a CRRT case can honestly show.
 *
 * The authored starting values are supplied case evidence: one synthetic
 * calibration record per case, at case start, in the unit the case author
 * wrote. The engine then advances each pool by delivered clearance alone
 * (`engine/soluteModel.ts`). That advance is removal-only arithmetic, not a
 * measured or predicted patient response, because no case can declare what its
 * dialysate and replacement solutions contain — `collectCrrtCaseSemanticIssues`
 * rejects any case carrying `solutionProfileIds` until a reviewed solution
 * registry exists. So the evolving concentration is never presented here as a
 * laboratory trend, a correction, or a deterioration.
 */
export interface CrrtSuppliedLabValue {
  readonly id: CrrtSoluteId | 'pH' | 'ionized-calcium'
  readonly label: string
  readonly value: number
  readonly unit: string
  readonly decimals: number
}

export interface CrrtUnmodeledLabResponse {
  readonly soluteId: CrrtSoluteId
  readonly label: string
  readonly missingInputIds: readonly CrrtSoluteMissingInputId[]
  readonly missingInputText: string
}

/** Solutes that are missing exactly the same inputs, stated once. */
export interface CrrtUnmodeledLabGroup {
  readonly key: string
  readonly soluteLabels: readonly string[]
  readonly missingInputText: string
}

export interface CrrtLabEvidence {
  /** Authored case-start values, with the unit the case author supplied. */
  readonly suppliedBaseline: readonly CrrtSuppliedLabValue[]
  /** Solutes whose response over time this exercise does not model. */
  readonly unmodeledResponses: readonly CrrtUnmodeledLabResponse[]
  /** The same solutes grouped by the inputs they are missing, for readable copy. */
  readonly unmodeledGroups: readonly CrrtUnmodeledLabGroup[]
  readonly sourceIds: readonly string[]
  readonly validity: CrrtSoluteDynamicsValidityMap
}

export const CRRT_SUPPLIED_BASELINE_CAPTION =
  'Supplied case values at case start. They are authored synthetic teaching values, not measurements from this run.'

export const CRRT_UNMODELED_LAB_CAPTION =
  'This exercise does not model how these values change during treatment, so no laboratory trend, correction, or worsening is claimed for them.'

export const CRRT_LAB_TEACHING_SCOPE =
  'What the case still exercises is the prescription and delivery arithmetic, the fluid ledger, the circuit pressure pattern, and cause-first troubleshooting — all of which are calculated from the settings you enter.'

function joinWithOr(labels: readonly string[]): string {
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`
}

function formatMissingInputs(missing: readonly CrrtSoluteMissingInputId[]): string {
  return joinWithOr(missing.map((id) => crrtSoluteMissingInputLabels[id]))
}

function groupUnmodeledResponses(
  responses: readonly CrrtUnmodeledLabResponse[],
): readonly CrrtUnmodeledLabGroup[] {
  const groups = new Map<string, { labels: string[]; missingInputText: string }>()
  for (const response of responses) {
    const key = [...response.missingInputIds].join('|')
    const existing = groups.get(key)
    if (existing) existing.labels.push(response.label)
    else groups.set(key, { labels: [response.label], missingInputText: response.missingInputText })
  }
  return [...groups.entries()].map(([key, group]) => ({
    key,
    soluteLabels: group.labels,
    missingInputText: group.missingInputText,
  }))
}

function suppliedBaselineValues(definition: RuntimeCrrtCase): CrrtSuppliedLabValue[] {
  const authored = definition.initialPatient.solutes
  return [
    {
      id: 'sodium',
      label: crrtSoluteDisplayLabels.sodium,
      value: authored.sodiumMmolPerL,
      unit: 'mmol/L',
      decimals: 1,
    },
    {
      id: 'potassium',
      label: crrtSoluteDisplayLabels.potassium,
      value: authored.potassiumMmolPerL,
      unit: 'mmol/L',
      decimals: 1,
    },
    {
      id: 'bicarbonate',
      label: crrtSoluteDisplayLabels.bicarbonate,
      value: authored.bicarbonateMmolPerL,
      unit: 'mmol/L',
      decimals: 1,
    },
    { id: 'pH', label: 'pH', value: authored.pH, unit: '', decimals: 2 },
    {
      id: 'urea-marker',
      label: crrtSoluteDisplayLabels['urea-marker'],
      value: authored.smallSoluteMarkerMmolPerL,
      unit: 'mmol/L',
      decimals: 1,
    },
    {
      id: 'creatinine-marker',
      label: crrtSoluteDisplayLabels['creatinine-marker'],
      value: authored.creatinineMgPerDl,
      unit: 'mg/dL',
      decimals: 1,
    },
    {
      id: 'phosphate',
      label: crrtSoluteDisplayLabels.phosphate,
      value: authored.phosphateMgPerDl,
      unit: 'mg/dL',
      decimals: 1,
    },
    {
      id: 'magnesium',
      label: crrtSoluteDisplayLabels.magnesium,
      value: authored.magnesiumMgPerDl,
      unit: 'mg/dL',
      decimals: 1,
    },
    {
      id: 'ionized-calcium',
      label: 'Systemic ionized calcium',
      value: authored.systemicIonizedCalciumMmolPerL,
      unit: 'mmol/L',
      decimals: 2,
    },
  ]
}

export function formatCrrtSuppliedLabValue(entry: CrrtSuppliedLabValue): string {
  const rounded = entry.value.toFixed(entry.decimals)
  return entry.unit ? `${rounded} ${entry.unit}` : rounded
}

export function selectCrrtLabEvidence(session: CrrtLearningSessionState): CrrtLabEvidence {
  const validity = selectCrrtSoluteDynamicsValidityMap(
    session.simulation.patient,
    session.simulation.circuit.bags,
  )
  const unmodeledResponses = crrtSoluteIds.flatMap((soluteId) => {
    const record = validity[soluteId]
    if (!record || record.status !== 'removal-only') return []
    return [
      {
        soluteId,
        label: crrtSoluteDisplayLabels[soluteId],
        missingInputIds: record.missingInputIds,
        missingInputText: formatMissingInputs(record.missingInputIds),
      },
    ]
  })

  return {
    suppliedBaseline: suppliedBaselineValues(session.caseDefinition),
    unmodeledResponses,
    unmodeledGroups: groupUnmodeledResponses(unmodeledResponses),
    sourceIds: [...session.caseDefinition.initialPatient.sourceIds],
    validity,
  }
}
