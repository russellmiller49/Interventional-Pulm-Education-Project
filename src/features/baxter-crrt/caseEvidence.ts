import {
  getCrrtCaseEvidenceScope,
  type CrrtAbsentEvidence,
  type CrrtCaseEvidenceScope,
  type CrrtScopeTeachingPointer,
  type CrrtSuppliedEvidenceFieldId,
} from './content/caseEvidenceScope'
import type { RuntimeCrrtCase } from './content/schema'

/**
 * Resolves a case's evidence scope against the case's own supplied values.
 *
 * Each supplied entry carries what a reader needs to know it for what it is: the
 * sample identity the fixture field names, the one time point it belongs to, its
 * unit, and the source record it came from. `Not supplied` stays `Not supplied` —
 * a null field is never rendered as zero or as a normal value.
 */
export interface CrrtSuppliedCaseEvidence {
  readonly id: CrrtSuppliedEvidenceFieldId
  readonly label: string
  /** Which sample or measurement this is, as the fixture field defines it. */
  readonly sampleIdentity: string
  readonly timePoint: 'At case start'
  readonly valueText: string
  readonly supplied: boolean
}

export interface CrrtCaseEvidence {
  readonly caseId: string
  readonly headline: string
  readonly supplied: readonly CrrtSuppliedCaseEvidence[]
  readonly absent: readonly CrrtAbsentEvidence[]
  readonly modelCalculates: readonly string[]
  readonly modelDoesNotModel: readonly string[]
  readonly furtherTeaching: readonly CrrtScopeTeachingPointer[]
  /** The case's own source records for its supplied patient values. */
  readonly suppliedSourceIds: readonly string[]
}

export const CRRT_CASE_EVIDENCE_HEADING = 'What this case can show you' as const

export const CRRT_SUPPLIED_EVIDENCE_CAPTION =
  'Supplied case values, at one time point, from this case’s own synthetic teaching record. They are not measurements from your run and this exercise does not model how they change.' as const

export const CRRT_ABSENT_EVIDENCE_CAPTION =
  'Evidence this case describes or would need, and does not have. Not supplied is not zero and not normal.' as const

interface FieldDescriptor {
  readonly label: string
  readonly sampleIdentity: string
  readonly unit: string
  readonly decimals: number
  readonly read: (patient: RuntimeCrrtCase['initialPatient']) => number | null
}

const fieldDescriptors: Readonly<Record<CrrtSuppliedEvidenceFieldId, FieldDescriptor>> =
  Object.freeze({
    'systemic-ionized-calcium': {
      label: 'Ionized calcium',
      sampleIdentity: 'Systemic sample — patient blood, not the circuit',
      unit: 'mmol/L',
      decimals: 2,
      read: (patient) => patient.solutes.systemicIonizedCalciumMmolPerL,
    },
    'total-calcium': {
      label: 'Total calcium',
      sampleIdentity: 'Systemic sample — patient blood, not the circuit',
      unit: 'mg/dL',
      decimals: 1,
      read: (patient) => patient.solutes.totalCalciumMgPerDl,
    },
    'creatinine-marker': {
      label: 'Creatinine marker',
      sampleIdentity: 'Systemic sample — a model marker, not a reported laboratory creatinine',
      unit: 'mg/dL',
      decimals: 1,
      read: (patient) => patient.solutes.creatinineMgPerDl,
    },
    'urine-output': {
      label: 'Urine output',
      sampleIdentity: 'Supplied external output rate in the fluid ledger, constant for the run',
      unit: 'mL/h',
      decimals: 0,
      read: (patient) => patient.urineOutputMlPerHour,
    },
    'residual-kidney-clearance': {
      label: 'Residual kidney clearance',
      sampleIdentity: 'Supplied fixture input to the solute model, constant for the run',
      unit: 'mL/min',
      decimals: 0,
      read: (patient) => patient.residualRenalClearanceMlPerMin,
    },
    potassium: {
      label: 'Potassium',
      sampleIdentity: 'Systemic sample',
      unit: 'mmol/L',
      decimals: 1,
      read: (patient) => patient.solutes.potassiumMmolPerL,
    },
    bicarbonate: {
      label: 'Bicarbonate',
      sampleIdentity: 'Systemic sample',
      unit: 'mmol/L',
      decimals: 1,
      read: (patient) => patient.solutes.bicarbonateMmolPerL,
    },
    ph: {
      label: 'pH',
      sampleIdentity: 'Systemic sample',
      unit: '',
      decimals: 2,
      read: (patient) => patient.solutes.pH,
    },
  })

function suppliedEntry(
  id: CrrtSuppliedEvidenceFieldId,
  definition: RuntimeCrrtCase,
): CrrtSuppliedCaseEvidence {
  const descriptor = fieldDescriptors[id]
  const value = descriptor.read(definition.initialPatient)
  const supplied = typeof value === 'number' && Number.isFinite(value)
  return {
    id,
    label: descriptor.label,
    sampleIdentity: descriptor.sampleIdentity,
    timePoint: 'At case start',
    valueText: supplied
      ? descriptor.unit
        ? `${value.toFixed(descriptor.decimals)} ${descriptor.unit}`
        : value.toFixed(descriptor.decimals)
      : 'Not supplied',
    supplied,
  }
}

export function selectCrrtCaseEvidence(definition: RuntimeCrrtCase): CrrtCaseEvidence | null {
  const scope: CrrtCaseEvidenceScope | undefined = getCrrtCaseEvidenceScope(definition.id)
  if (!scope) return null
  return {
    caseId: definition.id,
    headline: scope.headline,
    supplied: scope.suppliedEvidenceFieldIds.map((id) => suppliedEntry(id, definition)),
    absent: scope.absentEvidence,
    modelCalculates: scope.modelCalculates,
    modelDoesNotModel: scope.modelDoesNotModel,
    furtherTeaching: scope.furtherTeaching,
    suppliedSourceIds: [...definition.initialPatient.sourceIds],
  }
}
