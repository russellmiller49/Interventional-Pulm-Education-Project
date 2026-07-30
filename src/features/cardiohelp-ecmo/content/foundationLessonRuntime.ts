import type { CriticalCareActivityPhase } from '@/features/learning-module/activity/types'

import type { EcmoLearnStateSource } from './referenceProfiles'
import type { EcmoSimulationState, SimulationAction, SupportMode } from '../engine/types'

/**
 * The Learn sections that open the live three-pane workspace.
 *
 * Three groups, one record. The first four are shared by both tracks — they teach the circuit before
 * either track's physiology, so they render against whichever reference profile the learner has
 * selected. The three that follow are VV-only: their teaching is about series physiology, so a VA
 * reference circuit behind them would contradict the text on the page. The last three are VA-only
 * for the mirror-image reason: they teach what follows from the circuit running in parallel with the
 * heart, which a VV reference circuit cannot show. The runtime support mode for both track-fixed
 * groups is therefore fixed rather than taken from the query.
 *
 * The section records themselves live in `foundationLessons.ts`; nothing here re-declares them.
 */
export const ecmoSharedFoundationSectionIds = [
  'why-extracorporeal-support',
  'circuit-flow-path',
  'pump-and-pressure-zones',
  'blood-flow-versus-sweep',
] as const

export type EcmoSharedFoundationSectionId = (typeof ecmoSharedFoundationSectionIds)[number]

/** Sections whose teaching is VV series physiology. The support mode is fixed to VV for these. */
export const ecmoVvOnlyFoundationSectionIds = [
  'vv-series-physiology',
  'vv-normal-state',
  'vv-integration-capstone',
] as const

export type EcmoVvOnlyFoundationSectionId = (typeof ecmoVvOnlyFoundationSectionIds)[number]

/**
 * Sections whose teaching is VA parallel physiology. The support mode is fixed to VA for these.
 *
 * The mirror image of the VV-only set, and fixed for the same reason: these sections teach what
 * follows from the circuit running in parallel with the heart — loading, the mixing watershed,
 * differential oxygenation — none of which a VV reference circuit behind them would show.
 */
export const ecmoVaOnlyFoundationSectionIds = [
  'va-parallel-physiology',
  'va-normal-state',
  'va-integration-capstone',
] as const

export type EcmoVaOnlyFoundationSectionId = (typeof ecmoVaOnlyFoundationSectionIds)[number]

/** Every section routed to `EcmoFoundationLessonActivity`: four shared, three VV, three VA. */
export const ecmoInteractiveFoundationSectionIds = [
  ...ecmoSharedFoundationSectionIds,
  ...ecmoVvOnlyFoundationSectionIds,
  ...ecmoVaOnlyFoundationSectionIds,
] as const

export type EcmoInteractiveFoundationSectionId =
  (typeof ecmoInteractiveFoundationSectionIds)[number]

export function isEcmoSharedFoundationSectionId(
  value: unknown,
): value is EcmoSharedFoundationSectionId {
  return (
    typeof value === 'string' &&
    (ecmoSharedFoundationSectionIds as readonly string[]).includes(value)
  )
}

export function isEcmoVvOnlyFoundationSectionId(
  value: unknown,
): value is EcmoVvOnlyFoundationSectionId {
  return (
    typeof value === 'string' &&
    (ecmoVvOnlyFoundationSectionIds as readonly string[]).includes(value)
  )
}

export function isEcmoVaOnlyFoundationSectionId(
  value: unknown,
): value is EcmoVaOnlyFoundationSectionId {
  return (
    typeof value === 'string' &&
    (ecmoVaOnlyFoundationSectionIds as readonly string[]).includes(value)
  )
}

export function isEcmoInteractiveFoundationSectionId(
  value: unknown,
): value is EcmoInteractiveFoundationSectionId {
  return (
    typeof value === 'string' &&
    (ecmoInteractiveFoundationSectionIds as readonly string[]).includes(value)
  )
}

/**
 * The support mode a section actually runs in.
 *
 * A track-fixed section ignores the requested track entirely. `?track=va` on a VV-only section must
 * never load `va-reference` behind VV teaching copy, and `?track=vv` on a VA-only section must
 * never load `vv-reference` behind copy about parallel circulation. The route canonicalizes the URL
 * to match in both directions.
 */
export function ecmoFoundationSupportMode(
  sectionId: EcmoInteractiveFoundationSectionId,
  requested: SupportMode,
): SupportMode {
  if (isEcmoVvOnlyFoundationSectionId(sectionId)) return 'vv'
  if (isEcmoVaOnlyFoundationSectionId(sectionId)) return 'va'
  return requested
}

/**
 * A named live state a lesson phase can select.
 *
 * Two categories only: an authored reference profile, or an existing scenario used as a
 * **non-scored teaching preview**. A preview reuses the scenario definition and the same engine the
 * Practice drills use — it never copies the scenario's numbers into content, never records a
 * scenario result, and never becomes the lesson's completion rule.
 */
export interface EcmoFoundationStateVariant {
  readonly id: string
  readonly source: EcmoLearnStateSource
  /**
   * Deterministic actions applied immediately after the source state is created, in authored
   * order, inside the same reducer transition. This is how a timed fault is advanced past.
   */
  readonly setupActions?: readonly SimulationAction[]
  readonly label: string
  /** What this state does and does not model, shown wherever the variant is offered. */
  readonly modelBoundary?: string
  /**
   * Stop the lesson clock when this state loads.
   *
   * A preview that sits deliberately short of an authored timed fault is a state to be read before
   * it changes. Leaving the clock running would inject that fault a second later, so the learner
   * would never see the state the lesson says is in front of them and the phase that asks for a
   * prediction before the change would be asking about something already past. The learner can
   * still start the clock, which is how the change is watched happening rather than revealed.
   */
  readonly holdsClock?: boolean
}

/** N seconds of modeled time, expressed as engine actions so the fold stays order-explicit. */
export function advanceSeconds(seconds: number): readonly SimulationAction[] {
  return Array.from({ length: Math.max(0, Math.floor(seconds)) }, () => ({ type: 'STEP' }) as const)
}

/**
 * A bounded action the learner can take from the tertiary pane.
 *
 * `restore-and-apply` rebuilds a named variant from scratch and applies its own setup plus anything
 * the action resolves, all in one transition — so a comparison is never the sum of two
 * interventions and no intermediate restored frame is ever rendered. `advance` runs the clock on
 * the state already loaded. `evidence` records that the learner looked at something and changes no
 * simulated state at all.
 */
export type EcmoFoundationGuidedActionKind = 'restore-and-apply' | 'advance' | 'evidence'

export interface EcmoFoundationGuidedAction {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly kind: EcmoFoundationGuidedActionKind
  /** Required for `restore-and-apply`: which authored variant this action starts from. */
  readonly variantId?: string
  /**
   * Extra engine actions, resolved against the freshly restored state rather than against whatever
   * was on screen before. Only meaningful for `restore-and-apply`.
   */
  readonly resolve?: (restored: EcmoSimulationState) => readonly SimulationAction[]
  /** Seconds of modeled time to advance afterwards so the response is visible. */
  readonly settleSeconds: number
  /** Set when the action captures the current signals for a later comparison. */
  readonly capturesSnapshot?: boolean
}

export interface EcmoFoundationPhaseCopy {
  readonly objective: string
  readonly requiredAction: string
  readonly teachingPoint: string
}

export interface EcmoFoundationLessonRuntime {
  readonly sectionId: EcmoInteractiveFoundationSectionId
  /** Present when the section runs in one support mode regardless of the requested track. */
  readonly supportMode?: SupportMode
  /** Every state this lesson can show, in the order it offers them. */
  readonly variants: (supportMode: SupportMode) => readonly EcmoFoundationStateVariant[]
  /** The variant loaded when the lesson opens and when the learner restores. */
  readonly primaryVariantId: string
  readonly phases: Readonly<Record<CriticalCareActivityPhase, EcmoFoundationPhaseCopy>>
  readonly guidedActions: readonly EcmoFoundationGuidedAction[]
  readonly evidenceIds: readonly string[]
}

const REFERENCE_VARIANT_ID = 'reference-circuit'

/**
 * Modeled seconds a reference circuit is advanced before the lesson opens on it.
 *
 * The circuit side of a reference profile is flat from the first frame, but the patient and gas
 * side ramp toward their targets for about six seconds. Opening at frame zero would therefore make
 * the baseline review report a drift that is only the profile settling, and would show saturations
 * several points away from the reference values this module documents. Eight seconds is past the
 * ramp with a margin.
 */
const REFERENCE_SETTLE_SECONDS = 8

const referenceVariants = (supportMode: SupportMode): readonly EcmoFoundationStateVariant[] => [
  {
    id: REFERENCE_VARIANT_ID,
    source: {
      kind: 'reference-profile',
      profileId: supportMode === 'va' ? 'va-reference' : 'vv-reference',
    },
    setupActions: advanceSeconds(REFERENCE_SETTLE_SECONDS),
    label: supportMode === 'va' ? 'VA reference circuit' : 'VV reference circuit',
    modelBoundary:
      'An authored teaching anchor for this simulation: a running circuit with no injected problem, settled before the lesson opens on it. It is not a set of bedside target values.',
  },
]

const vvReferenceVariant: EcmoFoundationStateVariant = {
  id: REFERENCE_VARIANT_ID,
  source: { kind: 'reference-profile', profileId: 'vv-reference' },
  setupActions: advanceSeconds(REFERENCE_SETTLE_SECONDS),
  label: 'VV reference circuit',
  modelBoundary:
    'An authored teaching anchor for this simulation: a running VV circuit with no injected problem, settled before the lesson opens on it. It is not a set of bedside target values.',
}

const RESTORE: EcmoFoundationGuidedAction = {
  id: 'restore-reference',
  label: 'Restore reference state',
  description:
    'Reload the selected reference circuit. Completion already recorded is kept; only the current interaction is cleared.',
  kind: 'restore-and-apply',
  variantId: REFERENCE_VARIANT_ID,
  settleSeconds: 4,
}

const coreSources = ['ecmo-book-ch9', 'elso-circuit-2022', 'bounded-educational-model'] as const

/**
 * Seconds of modeled time each teaching preview is advanced by.
 *
 * Read off the engine rather than guessed: `vv-recirculation` reaches its settled saturations
 * within two modeled seconds, and `gas-source-interruption` injects its authored fault at second
 * five and stops moving by about second twenty-six. The pre-change state stops short of the fault
 * on purpose, so the learner sees the case before it changes.
 */
const PREVIEW_SECONDS = Object.freeze({
  recirculationSettled: 8,
  gasSourceBeforeChange: 4,
  gasSourceAfterChange: 28,
  oxygenatorResistanceSettled: 12,
})

const recirculationPreviewVariant: EcmoFoundationStateVariant = {
  id: 'recirculation-preview',
  source: { kind: 'scenario', scenarioId: 'vv-recirculation' },
  setupActions: advanceSeconds(PREVIEW_SECONDS.recirculationSettled),
  label: 'Established recirculation — teaching preview',
  modelBoundary:
    'The existing recirculation drill loaded as a preview to read, with nothing recorded and nothing scored. Its recirculation fraction is authored by that scenario; this simulation does not derive it from pump speed.',
}

const gasSourceBeforeVariant: EcmoFoundationStateVariant = {
  id: 'gas-source-before-change',
  source: { kind: 'scenario', scenarioId: 'gas-source-interruption' },
  setupActions: advanceSeconds(PREVIEW_SECONDS.gasSourceBeforeChange),
  // Held on purpose: this state sits one modeled second short of the case's authored change, so a
  // running clock would take it past the change before the learner had read it.
  holdsClock: true,
  label: 'The case before the change — teaching preview',
  modelBoundary:
    'The existing gas-source drill loaded as a preview to read, stopped one modeled second before its authored change occurs and held there. Nothing here is recorded or scored. Start the clock to watch the change happen, or reveal the evolved state to jump past it.',
}

const gasSourceAfterVariant: EcmoFoundationStateVariant = {
  id: 'gas-source-after-change',
  source: { kind: 'scenario', scenarioId: 'gas-source-interruption' },
  setupActions: advanceSeconds(PREVIEW_SECONDS.gasSourceAfterChange),
  label: 'The same case, evolved — teaching preview',
  modelBoundary:
    'The same drill advanced deterministically past its authored change. The rate at which the modeled values move is this simulation’s, not a bedside time course.',
}

const oxygenatorResistancePreviewVariant: EcmoFoundationStateVariant = {
  id: 'oxygenator-resistance-preview',
  source: { kind: 'scenario', scenarioId: 'afterload-oxygenator-resistance' },
  setupActions: advanceSeconds(PREVIEW_SECONDS.oxygenatorResistanceSettled),
  label: 'Membrane resistance — mechanism preview',
  modelBoundary:
    'A mechanism preview from the existing membrane-resistance drill. In this simulation the membrane resistance also constrains circuit flow, so displayed flow does fall here — read the gradient, not the flow, as the discriminating signal.',
}

// ---- VA track variants. ----

const vaReferenceVariant: EcmoFoundationStateVariant = {
  id: REFERENCE_VARIANT_ID,
  source: { kind: 'reference-profile', profileId: 'va-reference' },
  setupActions: advanceSeconds(REFERENCE_SETTLE_SECONDS),
  label: 'VA reference circuit',
  modelBoundary:
    'An authored teaching anchor for this simulation: a running VA circuit with no injected problem, settled before the lesson opens on it. It is not a set of bedside target values.',
}

/**
 * Seconds of modeled time each VA teaching preview is advanced by.
 *
 * Read off the engine, not guessed. The differential-oxygenation, loading and mixed-circulation
 * presets are all flat by the eighth modeled second. The VA membrane preset takes longer: its
 * discriminating signals — flow, the gradient, and the post-oxygenator saturation — are fixed from
 * the first frame, but the drainage saturation is still falling at twelve seconds and only settles
 * by about twenty. The gas case is the one with an authored timed change, at second five, so its
 * pre-change state stops short of it exactly as the VV case does.
 *
 * The evolved gas state is **forty** seconds, not the twenty-eight its VV counterpart uses. The VV
 * case has stopped moving by about second twenty-six; this one has not — at twenty-eight the
 * carbon dioxide value is still climbing (79.6 on its way to 90.0) and the femoral saturation is
 * still falling. Opening there would show the learner a state mid-slide and invite them to read a
 * still-moving number as the case's endpoint. It is flat from second forty onward.
 */
const VA_PREVIEW_SECONDS = Object.freeze({
  differentialSettled: 8,
  lvLoadingSettled: 8,
  mixedCirculationSettled: 8,
  oxygenatorResistanceSettled: 20,
  gasSourceBeforeChange: 4,
  gasSourceAfterChange: 40,
})

const differentialHypoxemiaPreviewVariant: EcmoFoundationStateVariant = {
  id: 'differential-hypoxemia-preview',
  source: { kind: 'scenario', scenarioId: 'va-differential-hypoxemia' },
  setupActions: advanceSeconds(VA_PREVIEW_SECONDS.differentialSettled),
  label: 'Differential oxygenation — teaching preview',
  modelBoundary:
    'The existing differential-oxygenation drill loaded as a preview to read, with nothing recorded and nothing scored. The upper-body and lower-body saturations are authored by that scenario; this simulation does not compute a watershed position from native ejection.',
}

const lvLoadingPreviewVariant: EcmoFoundationStateVariant = {
  id: 'lv-loading-preview',
  source: { kind: 'scenario', scenarioId: 'va-lv-loading' },
  setupActions: advanceSeconds(VA_PREVIEW_SECONDS.lvLoadingSettled),
  label: 'Left ventricular loading — teaching preview',
  modelBoundary:
    'The existing loading drill loaded as a preview to read. Pulsatility, aortic-valve opening and pulmonary congestion are authored states in this simulation rather than quantities derived from a ventricular model.',
}

const vaMixedCirculationVariant: EcmoFoundationStateVariant = {
  id: 'mixed-circulation-case',
  source: { kind: 'scenario', scenarioId: 'va-mixed-circulation-capstone' },
  setupActions: advanceSeconds(VA_PREVIEW_SECONDS.mixedCirculationSettled),
  label: 'The case as it stands — teaching preview',
  modelBoundary:
    'The existing mixed-circulation case loaded as a preview to read, settled before the lesson opens on it. Nothing here is recorded or scored. Unlike the VV capstone this case carries its finding from the first frame, so there is no earlier state to watch it arrive from.',
}

const vaOxygenatorResistancePreviewVariant: EcmoFoundationStateVariant = {
  id: 'va-oxygenator-resistance-preview',
  source: { kind: 'scenario', scenarioId: 'va-afterload-oxygenator-resistance' },
  setupActions: advanceSeconds(VA_PREVIEW_SECONDS.oxygenatorResistanceSettled),
  label: 'Membrane resistance — mechanism preview',
  modelBoundary:
    'A mechanism preview from the existing VA membrane-resistance drill. In this simulation the membrane resistance also constrains circuit flow, so displayed flow does fall here — read the gradient, not the flow, as the discriminating signal.',
}

const vaGasSourceBeforeVariant: EcmoFoundationStateVariant = {
  id: 'va-gas-source-before-change',
  source: { kind: 'scenario', scenarioId: 'va-gas-source-interruption' },
  setupActions: advanceSeconds(VA_PREVIEW_SECONDS.gasSourceBeforeChange),
  // Held for the same reason as its VV counterpart: this state sits one modeled second short of the
  // case's authored change, so a running clock would take it past the change before it was read.
  holdsClock: true,
  label: 'The gas case before the change — mechanism preview',
  modelBoundary:
    'The existing VA gas-source drill loaded as a preview to read, stopped one modeled second before its authored change occurs and held there. Nothing here is recorded or scored. Start the clock to watch the change happen, or load the evolved state to jump past it.',
}

const vaGasSourceAfterVariant: EcmoFoundationStateVariant = {
  id: 'va-gas-source-after-change',
  source: { kind: 'scenario', scenarioId: 'va-gas-source-interruption' },
  setupActions: advanceSeconds(VA_PREVIEW_SECONDS.gasSourceAfterChange),
  label: 'The gas case, evolved — mechanism preview',
  modelBoundary:
    'The same drill advanced deterministically past its authored change. The rate at which the modeled values move is this simulation’s, not a bedside time course.',
}

export const ecmoFoundationLessonRuntimes: Readonly<
  Record<EcmoInteractiveFoundationSectionId, EcmoFoundationLessonRuntime>
> = Object.freeze({
  'why-extracorporeal-support': {
    sectionId: 'why-extracorporeal-support',
    variants: referenceVariants,
    primaryVariantId: REFERENCE_VARIANT_ID,
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
    variants: referenceVariants,
    primaryVariantId: REFERENCE_VARIANT_ID,
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
    variants: referenceVariants,
    primaryVariantId: REFERENCE_VARIANT_ID,
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
        kind: 'restore-and-apply',
        variantId: REFERENCE_VARIANT_ID,
        resolve: (restored) => [
          { type: 'SET_RPM', rpm: restored.device.rpmSetpoint + 200 } as const,
        ],
        settleSeconds: 6,
      },
      {
        id: 'decrease-rpm',
        label: 'Decrease pump speed by 200 rpm',
        description: 'A bounded decrease from the reference speed.',
        kind: 'restore-and-apply',
        variantId: REFERENCE_VARIANT_ID,
        resolve: (restored) => [
          { type: 'SET_RPM', rpm: restored.device.rpmSetpoint - 200 } as const,
        ],
        settleSeconds: 6,
      },
      RESTORE,
    ],
    evidenceIds: [...coreSources, 'ecmo-book-ch16', 'ecmo-book-ch17'],
  },

  'blood-flow-versus-sweep': {
    sectionId: 'blood-flow-versus-sweep',
    variants: referenceVariants,
    primaryVariantId: REFERENCE_VARIANT_ID,
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
        kind: 'restore-and-apply',
        variantId: REFERENCE_VARIANT_ID,
        resolve: (restored) => [{ type: 'SET_SWEEP', sweep: restored.gas.sweepLpm + 1 } as const],
        settleSeconds: 12,
      },
      {
        id: 'increase-rpm-for-gas-comparison',
        label: 'Increase pump speed by 200 rpm',
        description: 'The matching blood-side change, run from the same reference baseline.',
        kind: 'restore-and-apply',
        variantId: REFERENCE_VARIANT_ID,
        resolve: (restored) => [
          { type: 'SET_RPM', rpm: restored.device.rpmSetpoint + 200 } as const,
        ],
        settleSeconds: 12,
      },
      RESTORE,
    ],
    evidenceIds: [...coreSources, 'ecmo-book-ch16', 'elso-adult-vv-2021'],
  },

  // ---- VV track. Support mode fixed; a VA reference circuit is never loaded behind these. ----
  'vv-series-physiology': {
    sectionId: 'vv-series-physiology',
    supportMode: 'vv',
    variants: () => [vvReferenceVariant, recirculationPreviewVariant],
    primaryVariantId: REFERENCE_VARIANT_ID,
    phases: {
      recognize: {
        objective: 'Trace the series circuit and name which flow the pump displays.',
        requiredAction:
          'Follow systemic venous return into drainage, out of the oxygenator back into the venous system, through the right heart and the native lung, and onward from the left heart.',
        teachingPoint:
          'The pump displays the blood it moves. It cannot tell blood that reached the tissues from blood it just returned and drained again.',
      },
      predict: {
        objective: 'Decide what a higher displayed flow with a worsening patient means.',
        requiredAction: 'Commit a prediction, then read why the other answers do not fit.',
        teachingPoint:
          'A rising venous-line saturation alongside worsening systemic oxygenation points at where the returned blood is going.',
      },
      act: {
        objective: 'Load the recirculation preview and read it beside the reference.',
        requiredAction:
          'Open the preview, then restore the VV reference when you want the comparison again. Nothing here is recorded against the drill.',
        teachingPoint:
          'The preview is the existing recirculation case loaded to be read, not a drill to be worked.',
      },
      observe: {
        objective: 'Compare the two states signal by signal.',
        requiredAction:
          'Read displayed circuit flow, recirculation fraction, recirculation-adjusted circuit flow, the venous-line saturation, the systemic estimate, and patient SpO₂ in both states.',
        teachingPoint:
          'The displayed flow rises while the adjusted flow falls. Those are two different quantities, and only one of them is on the console.',
      },
      explain: {
        objective: 'State what VV support does and does not do for the circulation.',
        requiredAction: 'Review the lesson narrative and the mixture relationship.',
        teachingPoint:
          'Native cardiac output is the systemic pump in VV. The circuit changes the content of blood entering the right heart and adds no circulatory support.',
      },
      transfer: {
        objective: 'Separate a real increase in useful support from an increase in recirculation.',
        requiredAction: 'Answer the transfer item and review the comparison.',
        teachingPoint:
          'The same displayed number can mean opposite things. What separates them is what happened to the patient and to the drainage saturation.',
      },
    },
    guidedActions: [
      {
        id: 'load-recirculation-preview',
        label: 'Load the recirculation preview',
        description:
          'Opens the existing recirculation case, already settled, as a state to read. No result is recorded.',
        kind: 'restore-and-apply',
        variantId: recirculationPreviewVariant.id,
        settleSeconds: 0,
      },
      {
        id: 'restore-vv-reference',
        label: 'Restore VV reference',
        description:
          'Reload the VV reference circuit. Completion already recorded is kept; only the current interaction is cleared.',
        kind: 'restore-and-apply',
        variantId: REFERENCE_VARIANT_ID,
        settleSeconds: 4,
      },
    ],
    evidenceIds: [...coreSources, 'elso-adult-vv-2021', 'ecmo-book-ch16', 'ecmo-book-ch17'],
  },

  'vv-normal-state': {
    sectionId: 'vv-normal-state',
    supportMode: 'vv',
    variants: () => [vvReferenceVariant],
    primaryVariantId: REFERENCE_VARIANT_ID,
    phases: {
      recognize: {
        objective: 'Decide which signals belong in a baseline review.',
        requiredAction:
          'Walk the drainage and load group, the membrane and return group, the gas side, and the patient, and note what each one reports.',
        teachingPoint:
          'A baseline review is a list of relationships, not a list of numbers to approve.',
      },
      predict: {
        objective: 'Decide what a single unfamiliar absolute value establishes.',
        requiredAction: 'Commit a prediction, then read why the other answers do not fit.',
        teachingPoint:
          'Cannula size and position, patient size, temperature, hemoglobin, and the device configuration all move these numbers without anything having gone wrong.',
      },
      act: {
        objective: 'Capture this circuit’s own starting values and watch them over a window.',
        requiredAction:
          'Capture the reference snapshot, run twenty modeled seconds, then compare with the snapshot. Restore the VV reference whenever you want to start again.',
        teachingPoint:
          'The comparison that transfers is this circuit against itself, not this circuit against a published number.',
      },
      observe: {
        objective: 'Read the raw change in each signal over the observed window.',
        requiredAction:
          'Compare the current value, the snapshot value, and the direction of change in each group.',
        teachingPoint:
          'What matters is that the relationship among the signals is holding, and by how much each one has moved.',
      },
      explain: {
        objective: 'State what belongs to a stable run beyond the circuit display.',
        requiredAction: 'Review the lesson narrative.',
        teachingPoint:
          'The native lungs still contribute, native cardiac output still does the systemic work, and sedation, volume state, temperature and hemoglobin all sit inside the picture.',
      },
      transfer: {
        objective: 'Recognize a stable baseline whose absolute values are unfamiliar.',
        requiredAction: 'Answer the transfer item and review the comparison.',
        teachingPoint:
          'A steady relationship over time is stronger evidence than any single value being familiar.',
      },
    },
    guidedActions: [
      {
        id: 'capture-reference-snapshot',
        label: 'Capture reference snapshot',
        description:
          'Record this circuit’s current values so the next reading can be compared with them.',
        kind: 'evidence',
        settleSeconds: 0,
        capturesSnapshot: true,
      },
      {
        id: 'run-twenty-modeled-seconds',
        label: 'Run 20 modeled seconds',
        description: 'Advance the clock on the circuit already loaded. Nothing else is changed.',
        kind: 'advance',
        settleSeconds: 20,
      },
      {
        id: 'compare-with-snapshot',
        label: 'Compare with snapshot',
        description: 'Read each signal against the value captured earlier in this session.',
        kind: 'evidence',
        settleSeconds: 0,
      },
      {
        id: 'restore-vv-reference',
        label: 'Restore VV reference',
        description:
          'Reload the VV reference circuit. Completion already recorded is kept; only the current interaction is cleared.',
        kind: 'restore-and-apply',
        variantId: REFERENCE_VARIANT_ID,
        settleSeconds: 4,
      },
    ],
    evidenceIds: [...coreSources, 'elso-adult-vv-2021', 'ecmo-book-ch18'],
  },

  'vv-integration-capstone': {
    sectionId: 'vv-integration-capstone',
    supportMode: 'vv',
    variants: () => [
      gasSourceBeforeVariant,
      gasSourceAfterVariant,
      recirculationPreviewVariant,
      oxygenatorResistancePreviewVariant,
      vvReferenceVariant,
    ],
    primaryVariantId: gasSourceBeforeVariant.id,
    phases: {
      recognize: {
        objective: 'Establish that circuit flow alone cannot discriminate here.',
        // Deliberately does not ask the learner to enter anything: this phase renders no control,
        // and the commitment this section is built around is the one made in `predict`. Copy that
        // asked for a record here would be promising a control the phase does not have.
        requiredAction:
          'Read the case as it stands and settle whether what is in front of you is a problem of oxygenation, of ventilation, or of both. Nothing is entered at this step; the commitment comes in the next one.',
        teachingPoint:
          'The flow display is the one signal every explanation on the list is compatible with.',
      },
      predict: {
        objective: 'Commit to one of the four explanations before looking further.',
        requiredAction:
          'Commit a prediction and name the finding that would support it, then read the comparison. The state does not advance when you commit.',
        teachingPoint:
          'Committing first is what lets the next measurement contradict you instead of confirming you.',
      },
      act: {
        objective: 'Gather the findings that separate the four explanations.',
        requiredAction:
          'Inspect the gas-source connection, compare the venous-line and post-oxygenator saturations, review pInt, pArt and the gradient, and review the bedside and ventilator findings.',
        teachingPoint:
          'Correcting the problem is not required here. The section is about what you look at and in what order.',
      },
      observe: {
        objective: 'Reveal how the case has evolved and read it against your prediction.',
        requiredAction: 'Load the evolved state and compare each signal with the earlier reading.',
        teachingPoint:
          'A change that moves carbon dioxide quickly while every circuit pressure stays put has already told you which path it is on.',
      },
      explain: {
        objective: 'Work the whole differential against the hypothesis matrix.',
        requiredAction:
          'Read the matrix, then open each mechanism preview one at a time. Each preview reloads cleanly, so two of them are never read compounded.',
        teachingPoint:
          'Each explanation predicts something different somewhere other than the flow display. That is what makes them separable.',
      },
      transfer: {
        objective: 'Apply the same discipline to a case with a different mechanism.',
        requiredAction: 'Load the recirculation preview and answer the transfer item.',
        teachingPoint:
          'Here the displayed flow is not merely unchanged — it is higher, and higher for the reason that makes the patient worse.',
      },
    },
    guidedActions: [
      {
        id: 'inspect-gas-source-connection',
        label: 'Inspect the gas-source connection',
        description:
          'Look at the separate gas path: source, sweep setting, and whether gas is reaching the membrane.',
        kind: 'evidence',
        settleSeconds: 0,
      },
      {
        id: 'compare-venous-and-post-oxygenator',
        label: 'Compare venous-line and post-oxygenator saturations',
        description:
          'Read the drainage-limb value and the post-membrane value together rather than one at a time.',
        kind: 'evidence',
        settleSeconds: 0,
      },
      {
        id: 'review-pressure-zones',
        label: 'Review pInt, pArt, and the gradient',
        description: 'Read the three membrane-side pressures as a set.',
        kind: 'evidence',
        settleSeconds: 0,
      },
      {
        id: 'review-bedside-findings',
        label: 'Review the bedside and ventilator findings',
        description:
          'Read what the patient side reports, which is where a patient-side explanation would show itself.',
        kind: 'evidence',
        settleSeconds: 0,
      },
      {
        id: 'reveal-evolved-state',
        label: 'Reveal the evolved state',
        description:
          'Advance the same case deterministically past its authored change and read it again.',
        kind: 'restore-and-apply',
        variantId: gasSourceAfterVariant.id,
        settleSeconds: 0,
      },
      {
        id: 'preview-recirculation-mechanism',
        label: 'Mechanism preview: recirculation',
        description:
          'Load the existing recirculation case as a state to read. Nothing is recorded against that drill.',
        kind: 'restore-and-apply',
        variantId: recirculationPreviewVariant.id,
        settleSeconds: 0,
      },
      {
        id: 'preview-oxygenator-resistance-mechanism',
        label: 'Mechanism preview: membrane resistance',
        description:
          'Load the existing membrane-resistance case as a state to read. In this simulation its displayed flow falls as well, which the preview says explicitly.',
        kind: 'restore-and-apply',
        variantId: oxygenatorResistancePreviewVariant.id,
        settleSeconds: 0,
      },
      {
        id: 'restore-case-before-change',
        label: 'Restore the case before the change',
        description:
          'Reload the opening state of this case. Completion already recorded is kept; only the current interaction is cleared.',
        kind: 'restore-and-apply',
        variantId: gasSourceBeforeVariant.id,
        settleSeconds: 0,
      },
    ],
    evidenceIds: [
      ...coreSources,
      'elso-adult-vv-2021',
      'ecmo-book-ch16',
      'ecmo-book-ch17',
      'ecmo-book-ch18',
    ],
  },

  // ---- VA track. Support mode fixed; a VV reference circuit is never loaded behind these. ----
  'va-parallel-physiology': {
    sectionId: 'va-parallel-physiology',
    supportMode: 'va',
    variants: () => [
      vaReferenceVariant,
      differentialHypoxemiaPreviewVariant,
      lvLoadingPreviewVariant,
    ],
    primaryVariantId: REFERENCE_VARIANT_ID,
    phases: {
      recognize: {
        objective: 'Trace the two circulations and find where they meet.',
        requiredAction:
          'Follow circuit blood from drainage, through the membrane, into the arterial system, and then follow blood the native heart ejects. Note where the two streams meet and which body regions each one supplies.',
        teachingPoint:
          'In parallel the circuit and the heart both fill the same aorta. Where their streams meet is a place, and that place moves.',
      },
      predict: {
        objective:
          'Decide what an unchanged circuit display with a falling upper-body saturation means.',
        requiredAction: 'Commit a prediction, then read why the other answers do not fit.',
        teachingPoint:
          'Recovering native function and worsening native lungs can produce the same upper-body reading, and neither of them disturbs the circuit.',
      },
      act: {
        objective: 'Load the two consequences of parallelism and read each beside the reference.',
        requiredAction:
          'Open the differential-oxygenation preview, then the loading preview, restoring the VA reference between them. Nothing here is recorded against either drill.',
        teachingPoint:
          'Each preview reloads cleanly from its own source, so two mechanisms are never read compounded.',
      },
      observe: {
        objective:
          'Compare the upper-body and lower-body saturations, and the pulsatility, in each state.',
        requiredAction:
          'Read the right radial saturation, the femoral arterial saturation, the pulse pressure, aortic-valve opening, and pulmonary congestion in all three states.',
        teachingPoint:
          'Two saturations from one patient are not a duplicate measurement. The gap between them is the finding.',
      },
      explain: {
        objective: 'State what parallel circulation adds and what it costs.',
        requiredAction: 'Review the lesson narrative and the two mechanism panels.',
        teachingPoint:
          'VA adds circulatory support. The price is a ventricle ejecting against arterial return, and a circulation with two sources of blood at different saturations.',
      },
      transfer: {
        objective: 'Separate a loading problem from an oxygenation one.',
        requiredAction: 'Answer the transfer item and review the comparison.',
        teachingPoint:
          'Both leave the circuit display alone. What separates them is pulsatility and the lungs on one side, and the difference between two sampling sites on the other.',
      },
    },
    guidedActions: [
      {
        id: 'load-differential-hypoxemia-preview',
        label: 'Load the differential-oxygenation preview',
        description:
          'Opens the existing differential-oxygenation case, already settled, as a state to read. No result is recorded.',
        kind: 'restore-and-apply',
        variantId: differentialHypoxemiaPreviewVariant.id,
        settleSeconds: 0,
      },
      {
        id: 'load-lv-loading-preview',
        label: 'Load the loading preview',
        description:
          'Opens the existing loading case, already settled, as a state to read. No result is recorded.',
        kind: 'restore-and-apply',
        variantId: lvLoadingPreviewVariant.id,
        settleSeconds: 0,
      },
      {
        id: 'restore-va-reference',
        label: 'Restore VA reference',
        description:
          'Reload the VA reference circuit. Completion already recorded is kept; only the current interaction is cleared.',
        kind: 'restore-and-apply',
        variantId: REFERENCE_VARIANT_ID,
        settleSeconds: 4,
      },
    ],
    // The two ELSO configuration sources are cited here because this is where the configuration
    // strategy card is taught in full.
    evidenceIds: [
      ...coreSources,
      'elso-adult-va-2021',
      'ecmo-book-ch17',
      'elso-dual-circulation-2024',
      'elso-maastricht-nomenclature-2019',
      'elso-neuro-monitoring-2024',
    ],
  },

  'va-normal-state': {
    sectionId: 'va-normal-state',
    supportMode: 'va',
    variants: () => [vaReferenceVariant],
    primaryVariantId: REFERENCE_VARIANT_ID,
    phases: {
      recognize: {
        objective: 'Decide which signals belong in a VA baseline review.',
        requiredAction:
          'Walk the drainage and load group, the membrane and return group, the gas side, and then the group that exists only because the circulations are in parallel.',
        teachingPoint:
          'A VA baseline review is the VV one plus everything parallel circulation adds, and the added part is not on the console.',
      },
      predict: {
        objective: 'Decide what an unremarkable circuit display establishes about a VA run.',
        requiredAction: 'Commit a prediction, then read why the other answers do not fit.',
        teachingPoint:
          'Pulsatility, valve opening, the difference between two sampling sites, and the cannulated limb are all outside the circuit display.',
      },
      act: {
        objective: 'Capture this circuit’s own starting values and watch them over a window.',
        requiredAction:
          'Capture the reference snapshot, run twenty modeled seconds, then compare with the snapshot. Restore the VA reference whenever you want to start again.',
        teachingPoint:
          'The comparison that transfers is this circuit against itself, not this circuit against a published number.',
      },
      observe: {
        objective: 'Read the raw change in each signal over the observed window.',
        requiredAction:
          'Compare the current value, the snapshot value, and the direction of change in each group, including the parallel-circulation group.',
        teachingPoint:
          'A steady circuit beside a falling pulse pressure is not a steady state; it is a circuit that has not noticed yet.',
      },
      explain: {
        objective: 'State what belongs to a stable VA run beyond the circuit display.',
        requiredAction: 'Review the lesson narrative.',
        teachingPoint:
          'Native pulsatility, an opening aortic valve, a deliberately chosen upper-body sampling site, and a limb that is being looked at all belong to the normal state.',
      },
      transfer: {
        objective: 'Recognize a stable VA baseline whose absolute values are unfamiliar.',
        requiredAction: 'Answer the transfer item and review the comparison.',
        teachingPoint:
          'A steady relationship over time is stronger evidence than any single value being familiar, and in VA the relationships include two that VV does not have.',
      },
    },
    guidedActions: [
      {
        id: 'capture-reference-snapshot',
        label: 'Capture reference snapshot',
        description:
          'Record this circuit’s current values so the next reading can be compared with them.',
        kind: 'evidence',
        settleSeconds: 0,
        capturesSnapshot: true,
      },
      {
        id: 'run-twenty-modeled-seconds',
        label: 'Run 20 modeled seconds',
        description: 'Advance the clock on the circuit already loaded. Nothing else is changed.',
        kind: 'advance',
        settleSeconds: 20,
      },
      {
        id: 'compare-with-snapshot',
        label: 'Compare with snapshot',
        description: 'Read each signal against the value captured earlier in this session.',
        kind: 'evidence',
        settleSeconds: 0,
      },
      {
        id: 'restore-va-reference',
        label: 'Restore VA reference',
        description:
          'Reload the VA reference circuit. Completion already recorded is kept; only the current interaction is cleared.',
        kind: 'restore-and-apply',
        variantId: REFERENCE_VARIANT_ID,
        settleSeconds: 4,
      },
    ],
    evidenceIds: [...coreSources, 'elso-adult-va-2021', 'elso-neuro-monitoring-2024'],
  },

  'va-integration-capstone': {
    sectionId: 'va-integration-capstone',
    supportMode: 'va',
    variants: () => [
      vaMixedCirculationVariant,
      lvLoadingPreviewVariant,
      vaOxygenatorResistancePreviewVariant,
      vaGasSourceBeforeVariant,
      vaGasSourceAfterVariant,
      vaReferenceVariant,
    ],
    primaryVariantId: vaMixedCirculationVariant.id,
    phases: {
      recognize: {
        objective: 'Establish that circuit flow alone cannot discriminate here either.',
        requiredAction:
          'Read the case as it stands and settle whether what is in front of you is a problem of oxygenation, of the circulation, or of both. Nothing is entered at this step; the commitment comes in the next one.',
        teachingPoint:
          'In VA the flow display is joined by a second reassuring number: an arterial pressure the circuit is generating on the patient’s behalf.',
      },
      predict: {
        objective: 'Commit to one of the explanations before looking further.',
        requiredAction:
          'Commit a prediction and name the finding that would support it, then read the comparison. The state does not advance when you commit.',
        teachingPoint:
          'Committing first is what lets the next measurement contradict you instead of confirming you.',
      },
      act: {
        objective: 'Gather the findings that separate the explanations.',
        requiredAction:
          'Compare the right radial and femoral saturations, read the pulse pressure and whether the aortic valve is opening, review pInt, pArt and the gradient, inspect the gas-source connection, and review the bedside findings including the cannulated limb.',
        teachingPoint:
          'Every explanation on this list predicts something outside the circuit display. That is what makes them separable.',
      },
      observe: {
        objective: 'Read each mechanism preview against the case in front of you.',
        requiredAction:
          'Load each mechanism preview one at a time and compare it with the presenting case. Each preview reloads cleanly, so two of them are never read compounded.',
        teachingPoint:
          'A mechanism you can load and look at is a hypothesis you can refute rather than one you can only assert.',
      },
      explain: {
        objective: 'Work the whole differential against the hypothesis matrix.',
        requiredAction:
          'Read the matrix row by row, and read the limitations beside the rows this simulation cannot demonstrate.',
        teachingPoint:
          'Two explanations on this list have no preview at all. Knowing which they are is part of knowing what the simulation is for.',
      },
      transfer: {
        objective: 'Apply the same discipline to a mechanism the circuit does report.',
        requiredAction: 'Load the gas-source preview and answer the transfer item.',
        teachingPoint:
          'The gas path is the one explanation here whose consequence arrives quickly and is unmistakable once it is looked for.',
      },
    },
    guidedActions: [
      {
        id: 'compare-upper-and-lower-body-saturations',
        label: 'Compare the right radial and femoral saturations',
        description:
          'Read the upper-body and lower-body values together rather than one at a time. The gap between them is the measurement.',
        kind: 'evidence',
        settleSeconds: 0,
      },
      {
        id: 'review-pulsatility-and-valve',
        label: 'Review pulsatility, valve opening, and the lungs',
        description:
          'Read the pulse pressure, whether the aortic valve is opening, and the pulmonary congestion together.',
        kind: 'evidence',
        settleSeconds: 0,
      },
      {
        id: 'review-va-pressure-zones',
        label: 'Review pInt, pArt, and the gradient',
        description: 'Read the three membrane-side pressures as a set.',
        kind: 'evidence',
        settleSeconds: 0,
      },
      {
        id: 'inspect-va-gas-source-connection',
        label: 'Inspect the gas-source connection',
        description:
          'Look at the separate gas path: source, sweep setting, and whether gas is reaching the membrane.',
        kind: 'evidence',
        settleSeconds: 0,
      },
      {
        id: 'review-limb-and-bedside-findings',
        label: 'Review the cannulated limb and bedside findings',
        description:
          'Read what the patient side reports, including the limb distal to the arterial cannula.',
        kind: 'evidence',
        settleSeconds: 0,
      },
      {
        id: 'preview-lv-loading-mechanism',
        label: 'Mechanism preview: ventricular loading',
        description:
          'Load the existing loading case as a state to read. Nothing is recorded against that drill.',
        kind: 'restore-and-apply',
        variantId: lvLoadingPreviewVariant.id,
        settleSeconds: 0,
      },
      {
        id: 'preview-va-oxygenator-resistance-mechanism',
        label: 'Mechanism preview: membrane resistance',
        description:
          'Load the existing VA membrane-resistance case as a state to read. In this simulation its displayed flow falls as well, which the preview says explicitly.',
        kind: 'restore-and-apply',
        variantId: vaOxygenatorResistancePreviewVariant.id,
        settleSeconds: 0,
      },
      {
        id: 'preview-va-gas-source-before-change',
        label: 'Mechanism preview: the gas case before its change',
        description:
          'Load the existing VA gas-source case one modeled second before its authored change, held there so it can be read first.',
        kind: 'restore-and-apply',
        variantId: vaGasSourceBeforeVariant.id,
        settleSeconds: 0,
      },
      {
        id: 'reveal-va-gas-source-evolved',
        label: 'Reveal the gas case evolved',
        description:
          'Advance the same gas case deterministically past its authored change and read it again.',
        kind: 'restore-and-apply',
        variantId: vaGasSourceAfterVariant.id,
        settleSeconds: 0,
      },
      {
        id: 'restore-mixed-circulation-case',
        label: 'Restore the case as it stands',
        description:
          'Reload the presenting state of this case. Completion already recorded is kept; only the current interaction is cleared.',
        kind: 'restore-and-apply',
        variantId: vaMixedCirculationVariant.id,
        settleSeconds: 0,
      },
    ],
    evidenceIds: [
      ...coreSources,
      'elso-adult-va-2021',
      'elso-neuro-monitoring-2024',
      'ecmo-book-ch17',
      'elso-dual-circulation-2024',
      'elso-maastricht-nomenclature-2019',
    ],
  },
})

export function ecmoFoundationLessonRuntime(
  sectionId: EcmoInteractiveFoundationSectionId,
): EcmoFoundationLessonRuntime {
  return ecmoFoundationLessonRuntimes[sectionId]
}

/** The variants a lesson offers, with the fixed support mode applied where one is declared. */
export function ecmoFoundationVariants(
  runtime: EcmoFoundationLessonRuntime,
  supportMode: SupportMode,
): readonly EcmoFoundationStateVariant[] {
  return runtime.variants(runtime.supportMode ?? supportMode)
}

export function ecmoFoundationVariant(
  runtime: EcmoFoundationLessonRuntime,
  supportMode: SupportMode,
  variantId: string,
): EcmoFoundationStateVariant | undefined {
  return ecmoFoundationVariants(runtime, supportMode).find((variant) => variant.id === variantId)
}

export function ecmoFoundationPrimaryVariant(
  runtime: EcmoFoundationLessonRuntime,
  supportMode: SupportMode,
): EcmoFoundationStateVariant {
  const variants = ecmoFoundationVariants(runtime, supportMode)
  return variants.find((variant) => variant.id === runtime.primaryVariantId) ?? variants[0]
}

/**
 * Structural check, run at import so an authoring mistake fails loudly rather than rendering a
 * lesson with a dead action.
 */
export function validateEcmoFoundationRuntimes(): readonly string[] {
  const errors: string[] = []
  for (const sectionId of ecmoInteractiveFoundationSectionIds) {
    const runtime = ecmoFoundationLessonRuntimes[sectionId]
    if (!runtime) {
      errors.push(`interactive foundation section has no runtime: ${sectionId}`)
      continue
    }
    if (runtime.sectionId !== sectionId) {
      errors.push(`runtime ${runtime.sectionId} registered under ${sectionId}`)
    }
    if (isEcmoVvOnlyFoundationSectionId(sectionId) && runtime.supportMode !== 'vv') {
      errors.push(`VV-only section does not fix its support mode: ${sectionId}`)
    }
    if (isEcmoVaOnlyFoundationSectionId(sectionId) && runtime.supportMode !== 'va') {
      errors.push(`VA-only section does not fix its support mode: ${sectionId}`)
    }
    // A section claimed by both track-fixed lists would resolve to whichever guard ran first.
    if (isEcmoVvOnlyFoundationSectionId(sectionId) && isEcmoVaOnlyFoundationSectionId(sectionId)) {
      errors.push(`section is declared both VV-only and VA-only: ${sectionId}`)
    }
    for (const supportMode of ['vv', 'va'] as const) {
      const variants = ecmoFoundationVariants(runtime, supportMode)
      if (variants.length === 0) errors.push(`${sectionId}: no state variant authored`)
      const ids = new Set(variants.map((variant) => variant.id))
      if (ids.size !== variants.length) errors.push(`${sectionId}: duplicate variant id`)
      if (!ids.has(runtime.primaryVariantId)) {
        errors.push(`${sectionId}: primary variant ${runtime.primaryVariantId} is not authored`)
      }
      if (runtime.supportMode) {
        for (const variant of variants) {
          if (
            variant.source.kind === 'reference-profile' &&
            variant.source.profileId !== `${runtime.supportMode}-reference`
          ) {
            errors.push(
              `${sectionId}: ${runtime.supportMode} section offers ${variant.source.profileId}`,
            )
          }
        }
      }
      for (const guided of runtime.guidedActions) {
        if (guided.kind === 'restore-and-apply') {
          if (!guided.variantId) {
            errors.push(`${sectionId}/${guided.id}: restore action has no variant`)
          } else if (!ids.has(guided.variantId)) {
            errors.push(`${sectionId}/${guided.id}: unknown variant ${guided.variantId}`)
          }
        } else if (guided.variantId || guided.resolve) {
          errors.push(`${sectionId}/${guided.id}: only a restore action may name a variant`)
        }
      }
    }
  }
  return errors
}

const runtimeErrors = validateEcmoFoundationRuntimes()
if (runtimeErrors.length > 0) {
  throw new Error(`Invalid ECMO foundation lesson runtimes:\n- ${runtimeErrors.join('\n- ')}`)
}
