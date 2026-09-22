import {
  canStartPrismaxTreatment,
  prismaxSetupSteps,
  type PrismaxPilotInterfaceAction,
} from '../deviceAdapters/prismax'
import { crrtLearningSessionReducer, type CrrtLearningSessionState } from '../learningSession'

export interface CrrtMachineSetupValues {
  readonly bloodFlowMlMin: number
  readonly dialysateFlowMlHour: number
  readonly patientFluidRemovalMlHour: number
}

/**
 * Walks the PrisMax facsimile's real setup sequence through the real reducers.
 *
 * A case card cannot prime, review or connect the circuit, so a run that needs a
 * started treatment has to start it on the machine. Tests use this rather than
 * reaching past the interlock, which is the behaviour `engine/setupWorkflow.ts`
 * now protects.
 *
 * A case that already begins on Operations is returned unchanged: its authored
 * `initialDeviceOverrides` already recorded the completed steps.
 */
export function completeCrrtMachineSetup(
  session: CrrtLearningSessionState,
  values: CrrtMachineSetupValues,
  { startTreatment = true }: { readonly startTreatment?: boolean } = {},
): CrrtLearningSessionState {
  if (session.interfaceState.completedStepIds.length === prismaxSetupSteps.length) return session

  const actions: PrismaxPilotInterfaceAction[] = [
    { type: 'SELECT_NEW_PATIENT' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'patient' },
    { type: 'SELECT_CVVHD' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'therapy' },
    { type: 'SET_PRESCRIPTION_VALUE', field: 'bloodFlowMlMin', value: values.bloodFlowMlMin },
    {
      type: 'SET_PRESCRIPTION_VALUE',
      field: 'dialysateFlowMlHour',
      value: values.dialysateFlowMlHour,
    },
    {
      type: 'SET_PRESCRIPTION_VALUE',
      field: 'patientFluidRemovalMlHour',
      value: values.patientFluidRemovalMlHour,
    },
    { type: 'COMMIT_PRESCRIPTION' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'prescription' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'sets' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'fluids' },
    { type: 'START_PRIME' },
    { type: 'COMPLETE_PRIME' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'prime' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'review' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'connect-patient' },
  ]

  let next = session
  for (const action of actions) {
    next = crrtLearningSessionReducer(next, { type: 'DEVICE_ACTION', action })
  }
  if (!canStartPrismaxTreatment(next.interfaceState)) {
    throw new Error('CRRT machine setup did not reach a startable state.')
  }
  if (!startTreatment) return next
  return crrtLearningSessionReducer(next, {
    type: 'DEVICE_ACTION',
    action: { type: 'START_TREATMENT' },
  })
}
