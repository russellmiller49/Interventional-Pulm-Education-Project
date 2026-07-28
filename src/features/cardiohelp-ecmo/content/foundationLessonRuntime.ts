import type { CriticalCareActivityPhase } from '@/features/learning-module/activity/types'

import type { EcmoLearnStateSource } from './referenceProfiles'
import type { EcmoSimulationState, SimulationAction, SupportMode } from '../engine/types'

/**
 * The four Learn sections shared by both tracks.
 *
 * They teach the circuit before either track's physiology, so they render against whichever
 * reference profile the learner has selected rather than owning a track of their own. The other
 * six foundation sections are track-specific and stay on the prose route until E4/E5.
 */
export const ecmoSharedFoundationSectionIds = [
  'why-extracorporeal-support',
  'circuit-flow-path',
  'pump-and-pressure-zones',
  'blood-flow-versus-sweep',
] as const

export type EcmoSharedFoundationSectionId = (typeof ecmoSharedFoundationSectionIds)[number]

export function isEcmoSharedFoundationSectionId(
  value: unknown,
): value is EcmoSharedFoundationSectionId {
  return (
    typeof value === 'string' &&
    (ecmoSharedFoundationSectionIds as readonly string[]).includes(value)
  )
}

/**
 * A bounded action the learner can take from the tertiary pane.
 *
 * Every one resolves to an existing reducer action over the existing physics. None of them
 * introduces a new equation, and none is allowed to compound with another — the comparison actions
 * restore the reference state first, so a learner is never reading the sum of two interventions.
 */
export interface EcmoFoundationGuidedAction {
  readonly id: string
  readonly label: string
  readonly description: string
  /** `null` means "restore the reference profile", handled by the activity. */
  readonly resolve: (state: EcmoSimulationState) => SimulationAction | null
  /** Restore the reference profile before applying, so comparisons stay independent. */
  readonly restoreFirst?: boolean
  /** Seconds of simulated time to advance afterwards so the response is visible. */
  readonly settleSeconds: number
}

export interface EcmoFoundationPhaseCopy {
  readonly objective: string
  readonly requiredAction: string
  readonly teachingPoint: string
}

export interface EcmoFoundationLessonRuntime {
  readonly sectionId: EcmoSharedFoundationSectionId
  /** How the live state is obtained. Always a reference profile for these four. */
  readonly stateSource: (supportMode: SupportMode) => EcmoLearnStateSource
  readonly phases: Readonly<Record<CriticalCareActivityPhase, EcmoFoundationPhaseCopy>>
  readonly guidedActions: readonly EcmoFoundationGuidedAction[]
  readonly evidenceIds: readonly string[]
}

const referenceState = (supportMode: SupportMode): EcmoLearnStateSource => ({
  kind: 'reference-profile',
  profileId: supportMode === 'va' ? 'va-reference' : 'vv-reference',
})

const RESTORE: EcmoFoundationGuidedAction = {
  id: 'restore-reference',
  label: 'Restore reference state',
  description:
    'Reload the selected reference circuit. Completion already recorded is kept; only the current interaction is cleared.',
  resolve: () => null,
  settleSeconds: 4,
}

const coreSources = ['ecmo-book-ch9', 'elso-circuit-2022', 'bounded-educational-model'] as const

export const ecmoFoundationLessonRuntimes: Readonly<
  Record<EcmoSharedFoundationSectionId, EcmoFoundationLessonRuntime>
> = Object.freeze({
  'why-extracorporeal-support': {
    sectionId: 'why-extracorporeal-support',
    stateSource: referenceState,
    phases: {
      recognize: {
        objective: 'Separate the terms that make up oxygen delivery.',
        requiredAction:
          'Read the ledger and note which term each displayed value belongs to: content, flow, or consumption.',
        teachingPoint:
          'Delivery is a flow multiplied by a content. A saturation on its own is one part of one term.',
      },
      predict: {
        objective: 'Decide whether a reassuring saturation settles the question.',
        requiredAction: 'Commit a prediction, then read why the other answers do not fit.',
        teachingPoint:
          'A patient can arrive at inadequate delivery through flow, through content, or through demand, and those are not interchangeable.',
      },
      act: {
        objective: 'Attribute a proposed change to the term it acts on.',
        requiredAction: 'Select the ledger term each candidate change would move first.',
        teachingPoint:
          'Naming the term a change acts on is what makes the next observation interpretable.',
      },
      observe: {
        objective: 'Read the selected track’s ledger as it stands.',
        requiredAction: 'Compare what the circuit contributes with what it does not.',
        teachingPoint:
          'In VV the circuit changes the content of blood returning to the right heart; in VA it also adds flow.',
      },
      explain: {
        objective: 'State what extracorporeal support does and does not do.',
        requiredAction: 'Review the lesson narrative.',
        teachingPoint:
          'Support holds a physiologic variable while something treatable is treated. It is not a treatment for the cause.',
      },
      transfer: {
        objective: 'Apply the ledger to a different failing term.',
        requiredAction: 'Answer the transfer item and review the comparison.',
        teachingPoint:
          'The same reasoning identifies a content problem as readily as a flow problem.',
      },
    },
    guidedActions: [RESTORE],
    evidenceIds: [...coreSources, 'elso-adult-vv-2021', 'elso-adult-va-2021'],
  },

  'circuit-flow-path': {
    sectionId: 'circuit-flow-path',
    stateSource: referenceState,
    phases: {
      recognize: {
        objective: 'Trace the blood path from drainage to return.',
        requiredAction: 'Step through the circuit segments in order.',
        teachingPoint:
          'Every signal on the console belongs to a place. The place comes before the value.',
      },
      predict: {
        objective: 'Place a named signal before seeing the answer.',
        requiredAction: 'Commit a prediction, then read the verdict.',
        teachingPoint:
          'Drainage, pump, membrane, and return are four different questions, and each pressure answers only one.',
      },
      act: {
        objective: 'Inspect each pressure at its own location.',
        requiredAction: 'Select pVen, pInt, pArt, or ΔP to highlight its measurement zone.',
        teachingPoint:
          'Reading a pressure without its location is how a drainage problem gets treated as a membrane problem.',
      },
      observe: {
        objective: 'Read the live values at each location.',
        requiredAction:
          'Note which channels report a number and which report the unavailable indication.',
        teachingPoint:
          'A channel that is not reporting is information too, and the reason it is not reporting matters.',
      },
      explain: {
        objective: 'Connect each zone to what limits it.',
        requiredAction: 'Review the lesson narrative.',
        teachingPoint:
          'Drainage availability, pump function, membrane resistance, and return resistance are separate limits on the same flow.',
      },
      transfer: {
        objective: 'Localize a pressure pattern without a numeric cutoff.',
        requiredAction: 'Answer the transfer item and review the comparison.',
        teachingPoint:
          'Direction and which zones move together localize the problem; a single number does not.',
      },
    },
    guidedActions: [RESTORE],
    evidenceIds: [...coreSources, 'ecmo-book-ch16'],
  },

  'pump-and-pressure-zones': {
    sectionId: 'pump-and-pressure-zones',
    stateSource: referenceState,
    phases: {
      recognize: {
        objective: 'Record the reference speed, flow, and pressure pattern.',
        requiredAction: 'Note the reference values before changing anything.',
        teachingPoint: 'A comparison needs a baseline that the learner has actually seen.',
      },
      predict: {
        objective: 'Predict the response to a bounded speed increase.',
        requiredAction: 'Commit a prediction, then read the verdict.',
        teachingPoint:
          'Speed is selected. Flow is what the circuit returns under the loading it currently has.',
      },
      act: {
        objective: 'Change the speed and let the circuit respond.',
        requiredAction: 'Adjust the pump speed, then restore the reference state.',
        teachingPoint:
          'The same speed produces different flows under different loading conditions.',
      },
      observe: {
        objective: 'Read the change against the reference baseline.',
        requiredAction: 'Compare each zone with its own reference value.',
        teachingPoint:
          'Pressures are read as a set. One zone moving alone means something different from two moving together.',
      },
      explain: {
        objective: 'Attach each pressure pattern to a mechanism.',
        requiredAction: 'Review the mechanism previews and the lesson narrative.',
        teachingPoint:
          'Preload limitation, return resistance, and membrane resistance each leave a different signature.',
      },
      transfer: {
        objective: 'Localize a new pattern, or decide there is not enough information.',
        requiredAction: 'Answer the transfer item and review the comparison.',
        teachingPoint:
          '"Not enough information" is a legitimate answer when the set does not discriminate.',
      },
    },
    guidedActions: [
      {
        id: 'increase-rpm',
        label: 'Increase pump speed by 200 rpm',
        description: 'A bounded increase from the reference speed, using the existing pump model.',
        resolve: (state) => ({ type: 'SET_RPM', rpm: state.device.rpmSetpoint + 200 }),
        restoreFirst: true,
        settleSeconds: 6,
      },
      {
        id: 'decrease-rpm',
        label: 'Decrease pump speed by 200 rpm',
        description: 'A bounded decrease from the reference speed.',
        resolve: (state) => ({ type: 'SET_RPM', rpm: state.device.rpmSetpoint - 200 }),
        restoreFirst: true,
        settleSeconds: 6,
      },
      RESTORE,
    ],
    evidenceIds: [...coreSources, 'ecmo-book-ch16', 'ecmo-book-ch17'],
  },

  'blood-flow-versus-sweep': {
    sectionId: 'blood-flow-versus-sweep',
    stateSource: referenceState,
    phases: {
      recognize: {
        objective: 'Identify the blood control and the gas control.',
        requiredAction: 'Locate pump speed and sweep, and the paths each one acts on.',
        teachingPoint: 'Two controls, two paths, two principal effects.',
      },
      predict: {
        objective: 'Choose the control that principally moves CO₂ in this model.',
        requiredAction: 'Commit a prediction, then read the verdict.',
        teachingPoint:
          'Carbon dioxide removal is governed mostly by the gradient maintained on the gas side.',
      },
      act: {
        objective: 'Run each comparison separately from the same baseline.',
        requiredAction:
          'Change sweep and observe; restore the reference; then change speed and observe.',
        teachingPoint:
          'Each comparison restores the reference first, so the second result is not the sum of two changes.',
      },
      observe: {
        objective: 'Compare the direction of response on each path.',
        requiredAction: 'Read the change in PaCO₂, pH, SpO₂, and circuit flow after each action.',
        teachingPoint: 'The magnitudes here are this model’s, not a bedside dose-response.',
      },
      explain: {
        objective: 'State why the two controls are not interchangeable.',
        requiredAction: 'Review the lesson narrative.',
        teachingPoint:
          'CO₂ is far more diffusible than oxygen, which is why the gas side dominates its clearance.',
      },
      transfer: {
        objective: 'Recognize that a flow display does not prove gas delivery.',
        requiredAction: 'Answer the transfer item and review the comparison.',
        teachingPoint: 'The blood path can look entirely normal while the gas path is interrupted.',
      },
    },
    guidedActions: [
      {
        id: 'increase-sweep',
        label: 'Increase sweep by 1 L/min',
        description: 'A bounded gas-side change from the reference state.',
        resolve: (state) => ({ type: 'SET_SWEEP', sweep: state.gas.sweepLpm + 1 }),
        restoreFirst: true,
        settleSeconds: 12,
      },
      {
        id: 'increase-rpm-for-gas-comparison',
        label: 'Increase pump speed by 200 rpm',
        description: 'The matching blood-side change, run from the same reference baseline.',
        resolve: (state) => ({ type: 'SET_RPM', rpm: state.device.rpmSetpoint + 200 }),
        restoreFirst: true,
        settleSeconds: 12,
      },
      RESTORE,
    ],
    evidenceIds: [...coreSources, 'ecmo-book-ch16', 'elso-adult-vv-2021'],
  },
})

export function ecmoFoundationLessonRuntime(
  sectionId: EcmoSharedFoundationSectionId,
): EcmoFoundationLessonRuntime {
  return ecmoFoundationLessonRuntimes[sectionId]
}
