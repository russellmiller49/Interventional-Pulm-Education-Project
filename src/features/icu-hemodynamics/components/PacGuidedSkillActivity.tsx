'use client'

import type { Route } from 'next'
import { useEffect, useMemo, useRef, useState } from 'react'

import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { criticalCareReferences } from '@/features/critical-care/content/references'
import { ActivityShell } from '@/features/learning-module/components/ActivityShell'
import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { DebriefPanel } from '@/features/learning-module/components/DebriefPanel'
import { EvidenceDrawer } from '@/features/learning-module/components/EvidenceDrawer'
import { PatientContextBar } from '@/features/learning-module/components/PatientContextBar'
import { ReferenceDrawer } from '@/features/learning-module/components/ReferenceDrawer'
import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'
import { TaskPanel } from '@/features/learning-module/components/TaskPanel'
import {
  authoritativeCriticalCareCompetencyEvidence,
  authoritativeCriticalCareStatus,
  criticalCareActivityPhases,
  readCriticalCareProgress,
  upsertCriticalCareActivityProgress,
  useCriticalCareActivityAnalytics,
  withoutCriticalCareResumePointer,
  writeCriticalCareProgress,
  type ClinicalLearningItem,
  type CriticalCareActivityPhase,
} from '@/features/learning-module/activity'
import { Link, useRouter } from '@/i18n/navigation'

import {
  hemodynamicCaseById,
  hemodynamicsSourceById,
  pacAdvancementOrientationSteps,
  pacGuidedLearningItems,
  pacLearningPathwaySections,
  type PacLearningPathwaySectionId,
  type PacGuidedSkillId,
} from '../content'
import {
  createInitialHemodynamicState,
  icuHemodynamicsReducer,
  thermodilutionAcceptedAverage,
  thermodilutionSectionCompletion,
  type HemodynamicAction,
  type HemodynamicSimulationState,
} from '../engine'
import { BedsideMonitor } from './BedsideMonitor'
import { CardiacOutputDisagreementLab } from './CardiacOutputDisagreementLab'
import { CardiacOutputMethodModel } from './CardiacOutputMethodModel'
import { FickMethodWorkbench } from './FickMethodWorkbench'
import { FormulaDrawer } from './FormulaDrawer'
import { NormalWaveformReference } from './NormalWaveformReference'
import { NormalWaveformValidityChallenges } from './NormalWaveformValidityChallenges'
import { PacActionDock } from './PacActionDock'
import { PacAdvancementReasoningPanel } from './PacAdvancementReasoningPanel'
import { PawpSafetySequencePanel, PA_RETURN_CHECK } from './PawpSafetySequencePanel'
import { PacAdvancementOrientation } from './PacAdvancementOrientation'
import { PacAdvancementPrebrief } from './PacAdvancementPrebrief'
import { PacLearningPathwayViewport } from './PacLearningPathwayNav'
import { PacSectionCompletionActions } from './PacSectionCompletionActions'
import { PacSectionReadinessCard } from './PacSectionReadiness'
import { PressureSystemValidityPanel } from './PressureSystemValidityPanel'
import { DerivedHemodynamicsTeachingPanel } from './PacMeasurementTeaching'
import { PacSkillsLab } from './PacSkillsLab'
import { PhysiologyPanel } from './PhysiologyPanel'
import { ResizablePacWorkspace } from './ResizablePacWorkspace'
import styles from './icu-hemodynamics.module.css'
import { WaveformAtlasPanel } from './WaveformAtlasPanel'
import { WaveformRecognitionDrill } from './WaveformRecognitionDrill'

interface PacGuidedSkillSpec {
  readonly title: string
  readonly objective: string
  readonly requiredAction: string
  readonly explanation: readonly string[]
  readonly transfer: string
}

type ClinicalLearningChoice = ClinicalLearningItem['choices'][number]

const plausibilityLabels: Readonly<Record<ClinicalLearningChoice['plausibility'], string>> = {
  best: 'Best-supported interpretation',
  'reasonable-but-incomplete': 'Reasonable but incomplete',
  'incorrect-mechanism': 'Mechanism mismatch',
  unsafe: 'Unsafe interpretation',
}

const likelyFrameByPlausibility: Readonly<Record<ClinicalLearningChoice['plausibility'], string>> =
  {
    best: 'Your frame uses the most discriminating cue in the displayed signal.',
    'reasonable-but-incomplete':
      'Your choice notices a real part of the pattern, but it leaves another required signal unexplained.',
    'incorrect-mechanism':
      'The selected cue can occur clinically, but it does not produce the morphology or measurement-system behavior shown here.',
    unsafe:
      'The selected interpretation could lead to action before the signal or catheter state is safe to use.',
  }

/**
 * The shared verdict, wearing this activity's two extra sentences.
 *
 * What lived here before was a third implementation of the same idea: it named the plausibility,
 * gave the choice's reasoning and the item's distinguishing cue, and added a frame and a next move.
 * The first three are what the shared `AnswerVerdict` already does — and does with an announcement
 * and a comparison against the answers not taken, neither of which a plain `aside` could offer. The
 * last two are this activity's own and are passed through as the branch explanation.
 *
 * Timing is unchanged: this renders in Act, where committing already put the learner, and it
 * advances nothing.
 */
function ChoiceReasoningFeedback({
  item,
  choiceId,
}: {
  readonly item: ClinicalLearningItem
  readonly choiceId: string
}) {
  const choice = item.choices.find((candidate) => candidate.id === choiceId)
  if (!choice) return null
  return (
    <AnswerVerdict
      item={item}
      choiceId={choiceId}
      timing="immediate-after-commit"
      theme="dark"
      branchExplanation={
        <dl className="grid gap-2">
          <div>
            <dt className="font-semibold">A reasonable frame</dt>
            <dd>{likelyFrameByPlausibility[choice.plausibility]}</dd>
          </div>
          <div>
            <dt className="font-semibold">Next move</dt>
            <dd>Use the visual workspace to test that interpretation against the live signal.</dd>
          </div>
        </dl>
      }
    />
  )
}

const skillSpecs: Readonly<Record<PacGuidedSkillId, PacGuidedSkillSpec>> = {
  'pressure-system': {
    title: 'Level, zero, and dynamic response',
    objective: 'Establish a valid pressure-measurement system.',
    requiredAction:
      'Open to air and zero, then characterize the dynamic response with a fast flush.',
    explanation: [
      'Hydrostatic offset changes every displayed invasive pressure.',
      'The fast-flush response characterizes the measurement system before a waveform is interpreted.',
    ],
    transfer:
      'Repeat level, zero, and dynamic-response validation after any setup or position change.',
  },
  'catheter-advancement': {
    title: 'Advance the PAC by waveform',
    objective: 'Advance from the introducer to a confirmed pulmonary-artery waveform.',
    requiredAction: 'Advance one position at a time and confirm each pressure waveform.',
    explanation: [
      'The authored route progresses from introducer to RA, RV, and PA.',
      'Anatomic route cues support orientation, but the pressure waveform confirms each transition.',
      'In the RA, CVP and PAC · RA are the same pressure signal. With controlled positive-pressure ventilation, read the base of the c wave at the trough of the slow respiratory swing.',
    ],
    transfer:
      'When a position is uncertain, stop advancement and re-establish a confirmed waveform.',
  },
  'waveform-interpretation': {
    title: 'Interpret normal and abnormal waveforms',
    objective: 'Identify normal and abnormal tracings from morphology alone.',
    requiredAction:
      'Work through the recognition drill until five tracings are correctly identified.',
    explanation: [
      'Right ventricular and pulmonary artery systolic pressures are normally identical, so the systolic number cannot distinguish them. The diastolic contour can: right ventricular diastole slopes up as the ventricle fills, and pulmonary artery diastole slopes down through runoff.',
      'Wave components carry diagnoses. A blunted y descent suggests pericardial constraint, a tall systolic c-v wave that erases the x descent suggests tricuspid regurgitation, and a giant wedge v wave suggests mitral regurgitation.',
    ],
    transfer:
      'Before acting on any invasive number, confirm which chamber the waveform says the tip is in.',
  },
  'pawp-capture': {
    title: 'Brief end-expiratory PAWP capture',
    objective: 'Capture a brief, end-expiratory PAWP and restore the PA waveform.',
    requiredAction:
      'Inflate only from confirmed PA, sample one respiratory cycle, place the cursor, store, and deflate.',
    explanation: [
      'PAWP capture uses transient balloon occlusion from a confirmed PA position.',
      'Prompt deflation and return of the PA waveform close the safety sequence.',
    ],
    transfer:
      'If the PA waveform does not return, treat the signal and catheter position as unsafe.',
  },
  'thermodilution-series': {
    title: 'Cardiac output: thermodilution and Fick',
    objective:
      'Trace a cardiac-output number back through its acquisition, its inputs, and its assumptions before using it.',
    requiredAction:
      'Read each raw curve before its value, decide acceptance on the acquisition, and separate a measured oxygen uptake from a substituted one.',
    explanation: [
      'Thermodilution derives flow from a temperature-time curve; a Fick calculation derives it from an oxygen balance. Neither measures flow directly.',
      'Direct Fick means the oxygen uptake was measured on this patient. A substituted figure makes the result an estimate that moves in proportion to the assumption, and it must not be called direct Fick.',
      'A curve is judged on its own acquisition, not on whether its value agrees with the others. A trial can only be excluded for a technical reason the curve actually shows.',
      'Repeatability describes the spread of a series. It does not describe where the series sits: the same slightly imperfect technique every time agrees with itself and is shifted together.',
    ],
    transfer:
      'When the two methods disagree, read both acquisitions and say which result can be defended — which may be neither. Do not average two measurement systems into one number.',
  },
  'derived-hemodynamics': {
    title: 'Derived hemodynamics and validity',
    objective:
      'Trace calculated values back to their source measurements and validity requirements.',
    requiredAction:
      'Review the dependency teaching, then open the formula panel and inspect the explicit not-interpretable states.',
    explanation: [
      'Derived values are equations, not independent measurements; they inherit the timing, calibration, artifact, and sampling limitations of every input.',
      'Resistance is a pressure gradient divided by flow, so error in either pressure or cardiac output can move the result substantially.',
      'PPV remains unavailable outside the modeled rhythm, ventilation, effort, chest, waveform, and RV conditions.',
    ],
    transfer:
      'Withhold precise derived interpretation whenever a source measurement is stale or invalid.',
  },
}

function requireCase(): NonNullable<ReturnType<typeof hemodynamicCaseById.get>> {
  const definition = hemodynamicCaseById.get('HD-01')
  if (!definition) throw new Error('PAC skills require hemodynamic case HD-01.')
  return definition
}

const baseCase = requireCase()

function requireActivity(activityId: string) {
  const activity = criticalCareActivityById.get(activityId)
  if (!activity) throw new Error(`Missing critical-care activity: ${activityId}`)
  return activity
}

function actionSkillState(skillId: PacGuidedSkillId): HemodynamicSimulationState {
  let state = createInitialHemodynamicState(baseCase, 'learn', 510)
  if (skillId === 'pressure-system') {
    state = icuHemodynamicsReducer(state, { type: 'SET_TRANSDUCER_LEVEL', levelCm: 10 })
    state = icuHemodynamicsReducer(state, { type: 'SET_DAMPING', dampingRatio: 0.28 })
    state = icuHemodynamicsReducer(state, { type: 'SET_ARTIFACT', artifact: 'underdamped' })
  }
  if (skillId === 'catheter-advancement') {
    state = icuHemodynamicsReducer(state, {
      type: 'SET_CATHETER_POSITION',
      position: 'introducer',
    })
  }
  if (skillId === 'pawp-capture' || skillId === 'thermodilution-series') {
    state = icuHemodynamicsReducer(state, { type: 'SET_CATHETER_POSITION', position: 'pa' })
  }
  if (skillId === 'derived-hemodynamics') {
    state = icuHemodynamicsReducer(state, { type: 'SET_TRANSDUCER_LEVEL', levelCm: 8 })
    state = icuHemodynamicsReducer(state, { type: 'SET_ARTIFACT', artifact: 'none' })
  }
  return state
}

function addThermodilutionTrial(
  state: HemodynamicSimulationState,
  technique: HemodynamicAction & { type: 'GENERATE_THERMODILUTION_TRIAL' },
): HemodynamicSimulationState {
  return icuHemodynamicsReducer(state, technique)
}

function predictionSkillState(skillId: PacGuidedSkillId): HemodynamicSimulationState {
  let state = actionSkillState(skillId)
  if (skillId === 'thermodilution-series') {
    const validTechnique = {
      injectateVolumeMl: baseCase.thermodilution.injectateVolumeMl,
      injectateTemperatureC: baseCase.thermodilution.injectateTemperatureC,
      injectionDurationSeconds: 2.5,
      respiratoryPhase: 'end-expiration' as const,
      smoothness: 0.95,
    }
    state = addThermodilutionTrial(state, {
      type: 'GENERATE_THERMODILUTION_TRIAL',
      technique: validTechnique,
    })
    state = addThermodilutionTrial(state, {
      type: 'GENERATE_THERMODILUTION_TRIAL',
      technique: {
        ...validTechnique,
        injectionDurationSeconds: 7,
        respiratoryPhase: 'variable',
        smoothness: 0.3,
      },
    })
    state = addThermodilutionTrial(state, {
      type: 'GENERATE_THERMODILUTION_TRIAL',
      technique: validTechnique,
    })
  }
  return state
}

function transferSkillState(
  skillId: PacGuidedSkillId,
  current: HemodynamicSimulationState,
): HemodynamicSimulationState {
  /**
   * H4 §9/§10. Every other station's transfer is a new authored patient state that the learner
   * works through again. This one is not: its transfer is a paired-method comparison over authored
   * episodes that carry their own acquisitions, and the thing the learner brings to it is the
   * series they just built. Resetting here would delete that series and leave the transfer asking
   * about a measurement that no longer exists.
   */
  if (skillId === 'thermodilution-series') return current
  if (skillId === 'pressure-system') {
    let state = createInitialHemodynamicState(baseCase, 'learn', 611)
    state = icuHemodynamicsReducer(state, { type: 'SET_TRANSDUCER_LEVEL', levelCm: -6 })
    state = icuHemodynamicsReducer(state, { type: 'ZERO_TRANSDUCER' })
    state = icuHemodynamicsReducer(state, { type: 'SET_DAMPING', dampingRatio: 1.15 })
    return icuHemodynamicsReducer(state, { type: 'SET_ARTIFACT', artifact: 'overdamped' })
  }
  if (skillId === 'catheter-advancement') {
    return icuHemodynamicsReducer(createInitialHemodynamicState(baseCase, 'learn', 612), {
      type: 'SET_CATHETER_POSITION',
      position: 'ra',
    })
  }
  if (skillId === 'pawp-capture') {
    const ventilatedVariant = {
      ...baseCase,
      initialParameters: {
        ...baseCase.initialParameters,
        peepCmH2O: 12,
        respiratoryRateBpm: 22,
      },
    }
    return icuHemodynamicsReducer(createInitialHemodynamicState(ventilatedVariant, 'learn', 613), {
      type: 'SET_CATHETER_POSITION',
      position: 'pa',
    })
  }
  if (skillId === 'derived-hemodynamics') {
    const invalidPpvVariant = {
      ...baseCase,
      initialParameters: {
        ...baseCase.initialParameters,
        rhythmRegularity: 0.72,
        spontaneousBreathingFraction: 0.25,
      },
    }
    let state = createInitialHemodynamicState(invalidPpvVariant, 'learn', 615)
    state = icuHemodynamicsReducer(state, { type: 'ZERO_TRANSDUCER' })
    return icuHemodynamicsReducer(state, { type: 'SET_ARTIFACT', artifact: 'none' })
  }
  return createInitialHemodynamicState(baseCase, 'learn', 616)
}

/**
 * Whether the station's hands-on objective has been met.
 *
 * Exported so a suite can exercise the predicate against a constructed state. Rendering a whole
 * guided workspace and driving a simulated catheter through jsdom to reach one of these states is
 * possible and tells you almost nothing about which condition failed.
 */
export function pacGuidedObjectiveComplete(
  skillId: PacGuidedSkillId,
  state: HemodynamicSimulationState,
): boolean {
  return objectiveComplete(skillId, state)
}

function objectiveComplete(skillId: PacGuidedSkillId, state: HemodynamicSimulationState): boolean {
  if (skillId === 'pressure-system') {
    return (
      Math.abs(state.measurementSystem.transducerLevelCm) <= 1 &&
      state.measurementSystem.zeroed &&
      state.signalValidationChecks.includes('fast-flush') &&
      state.signalValidationChecks.includes('dynamic-response-classified') &&
      (state.measurementSystem.artifact === 'none' ||
        state.signalValidationChecks.includes('dynamic-response-corrected'))
    )
  }
  if (skillId === 'catheter-advancement') {
    return (
      state.catheter.position === 'pa' &&
      state.signalValidationChecks.includes('waveform-confirmed-ra') &&
      state.signalValidationChecks.includes('waveform-confirmed-rv') &&
      state.signalValidationChecks.includes('waveform-confirmed-pa')
    )
  }
  if (skillId === 'waveform-interpretation') {
    return state.signalValidationChecks.includes('waveform-recognition')
  }
  if (skillId === 'pawp-capture') {
    /**
     * H3 §7. The first three conditions used to be the whole objective, and all three are set by the
     * simulator's own prolonged-inflation recovery — so the one failure this station exists to catch
     * completed it. Two conditions close that: the recovery path is excluded explicitly, and the
     * return of the pulmonary-artery waveform has to have been assessed by the learner rather than
     * announced by the simulation.
     */
    return (
      state.catheter.storedWedgeMmHg !== null &&
      !state.catheter.balloonInflated &&
      state.catheter.position === 'pa' &&
      !state.catheter.forcedSafetyRecovery &&
      state.signalValidationChecks.includes(PA_RETURN_CHECK)
    )
  }
  if (skillId === 'thermodilution-series') {
    /**
     * The hands-on half of the station: a series built from reviewed, technically usable trials.
     * `thermodilutionAcceptedAverage` refuses an unreviewed or invalid trial, so this cannot be
     * satisfied by generating three curves and pressing accept without reading any of them.
     *
     * The station's *completion* is a wider contract — see `thermodilutionSectionCompletion` — which
     * also requires the two Fick methods to have been separated and a method disagreement to have
     * been resolved without averaging. This predicate stays the gate for moving on from the
     * acquisition work.
     */
    return thermodilutionAcceptedAverage(state.thermodilutionTrials) !== null
  }
  return state.signalValidationChecks.includes('derived-reviewed')
}

function SkillSurface({
  skillId,
  phase,
  state,
  dispatch,
  advancementUnlocked,
  onDisagreementResolved,
}: {
  readonly skillId: PacGuidedSkillId
  readonly phase: CriticalCareActivityPhase
  readonly state: HemodynamicSimulationState
  readonly dispatch: (action: HemodynamicAction) => void
  readonly advancementUnlocked: boolean
  readonly onDisagreementResolved?: () => void
}) {
  if (skillId === 'pressure-system') {
    return (
      <PacSkillsLab
        state={state}
        dispatch={dispatch}
        focus="pressure-system"
        pressureChallengeMode="current-state"
      />
    )
  }
  if (skillId === 'catheter-advancement') {
    // The manipulation controls stay out of reach until the prebrief is acknowledged, from
    // wherever the learner arrives — including a direct jump to a later phase from the phase
    // navigation. The prebrief itself lives in the task panel; duplicating it here would give the
    // learner two copies of the same acknowledgement.
    if (!advancementUnlocked) {
      return (
        <div className="grid h-full place-items-center overflow-auto p-4">
          <p className="max-w-sm rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-center text-sm leading-6">
            The simulated advancement controls open once you have read the safety prebrief in the
            current-task panel.
          </p>
        </div>
      )
    }
    // H3 §6. From the hands-on phase onward the reasoning chain sits above the live controls, so the
    // decision is made in the same pane the movement happens in. It stays out of the earlier phases
    // because the ordered orientation there is already asking the learner for a commitment, and two
    // sets of choices on screen at once is two questions competing for one answer.
    if (phase === 'recognize' || phase === 'predict') {
      return <PacActionDock state={state} dispatch={dispatch} focus="advancement" />
    }
    return (
      <div className={styles.paneStack}>
        <PacAdvancementReasoningPanel />
        <PacActionDock state={state} dispatch={dispatch} focus="advancement" />
      </div>
    )
  }
  if (skillId === 'waveform-interpretation') {
    // H2 §5: while the canonical reference is on screen in the middle pane, this pane carries the
    // interaction that keeps the reference honest — the same four normal tracings shown through a
    // display fault, each requiring a commitment before its reasoning appears. The full atlas
    // returns for the later phases.
    //
    // H0/H1 §4: the atlas still opens on the normal right atrium rather than on an abnormality. A
    // novice needs the reference before the deviation from it.
    if (phase === 'recognize') return <NormalWaveformValidityChallenges />
    return <WaveformAtlasPanel initialEntryId="ra-normal" heading="Full waveform atlas" />
  }
  if (skillId === 'pawp-capture') {
    return <PacActionDock state={state} dispatch={dispatch} focus="wedge" />
  }
  if (skillId === 'thermodilution-series') {
    /**
     * H4 §10. Recognize opens on the Fick episodes, because the distinction a learner has to be
     * able to make before touching a syringe is between a measured input and a substituted one.
     * The hands-on acquisition loop then runs through Predict, Act, and Observe, and Transfer
     * becomes the paired-method comparison.
     */
    if (phase === 'recognize') return <FickMethodWorkbench />
    if (phase === 'transfer') {
      return <CardiacOutputDisagreementLab onDisagreementResolved={onDisagreementResolved} />
    }
    return <PacSkillsLab state={state} dispatch={dispatch} focus="thermodilution" />
  }
  return <FormulaDrawer state={state} dispatch={dispatch} />
}

export function PacGuidedSkillActivity({
  skillId,
  locale = 'en',
  onPathwaySectionChange,
}: {
  readonly skillId: PacGuidedSkillId
  readonly locale?: string
  readonly onPathwaySectionChange?: (sectionId: PacLearningPathwaySectionId) => void
}) {
  const spec = skillSpecs[skillId]
  const learningItems = pacGuidedLearningItems[skillId]
  const activityId = `hemodynamics:learn:${skillId}`
  const activity = requireActivity(activityId)
  const sectionIndex = pacLearningPathwaySections.findIndex((section) => section.id === skillId)
  const nextSection = pacLearningPathwaySections[sectionIndex + 1]

  const router = useRouter()
  const [state, setState] = useState(() => actionSkillState(skillId))
  const [phase, setPhase] = useState<CriticalCareActivityPhase>('recognize')
  const [predictionChoiceId, setPredictionChoiceId] = useState<string | null>(null)
  const [transferChoiceId, setTransferChoiceId] = useState<string | null>(null)
  const [hintVisible, setHintVisible] = useState(false)
  const [completed, setCompleted] = useState(false)
  /**
   * H0/H1 §5. Advancement is the one section where the learner manipulates a simulated catheter, so
   * the safety prebrief precedes its controls. This sequences the section; it does not gate it —
   * every pathway station stays reachable by URL and every phase button stays enabled.
   */
  const [prebriefAcknowledged, setPrebriefAcknowledged] = useState(false)
  /**
   * H4 §11. The two commitments that make this a cardiac-output section rather than a
   * thermodilution-only one. They are held here rather than on the simulation state because the
   * simulation is swapped out between phases on most stations, and a learner who separated the two
   * Fick methods in Recognize has not un-separated them by walking into Act.
   */
  const [methodProvenanceResolved, setMethodProvenanceResolved] = useState(false)
  const [disagreementResolved, setDisagreementResolved] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const attempt = useRef(1)
  const recordedSafetyEvents = useRef(new Set<string>())
  const lifecycleAnalytics = useCriticalCareActivityAnalytics({
    moduleId: 'icu-hemodynamics',
    activityId,
    mode: 'guided',
    phase,
  })

  const dispatch = (action: HemodynamicAction) => {
    setState((current) => icuHemodynamicsReducer(current, action))
  }

  useEffect(() => {
    const envelope = readCriticalCareProgress(window.localStorage)
    const existing = envelope.activities.find((item) => item.activityId === activityId)
    attempt.current = (existing?.attempts ?? 0) + 1
  }, [activityId])

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const intervalMs = reducedMotion ? 250 : 100
    const timer = window.setInterval(
      () =>
        setState((current) =>
          icuHemodynamicsReducer(current, { type: 'TICK', seconds: intervalMs / 1000 }),
        ),
      intervalMs,
    )
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (state.criticalErrors.length === 0) {
      recordedSafetyEvents.current.clear()
      return
    }
    for (const error of state.criticalErrors) {
      if (recordedSafetyEvents.current.has(error)) continue
      recordedSafetyEvents.current.add(error)
      lifecycleAnalytics.recordSafetyEvent()
    }
  }, [lifecycleAnalytics, state.criticalErrors])

  const referenceEntries = useMemo(
    () =>
      criticalCareReferences
        .filter((reference) =>
          (reference.relatedActivityIds as readonly string[]).includes(activityId),
        )
        .map((reference) => ({
          id: reference.id,
          title: reference.title,
          summary: reference.summary,
          meta: reference.category.replaceAll('-', ' '),
        })),
    [activityId],
  )

  const evidenceEntries = useMemo(
    () =>
      activity.evidenceIds.flatMap((sourceId) => {
        const source = hemodynamicsSourceById.get(sourceId)
        return source
          ? [
              {
                id: source.id,
                title: source.title,
                sourceLabel: `${source.citation} · version ${source.version}. Intended use: ${source.intendedUse}`,
                limitation: source.limitation ?? 'Educational use only; not patient-specific.',
              },
            ]
          : []
      }),
    [activity.evidenceIds],
  )

  function persist(
    requestedDone = false,
    addHint = false,
    phaseForProgress: CriticalCareActivityPhase = phase,
  ) {
    const now = new Date().toISOString()
    const envelope = readCriticalCareProgress(window.localStorage)
    const existing = envelope.activities.find((item) => item.activityId === activityId)
    const authoritativeStatus = authoritativeCriticalCareStatus(
      activity,
      requestedDone ? 'completed' : 'in-progress',
    )
    const done = authoritativeStatus === 'completed' || authoritativeStatus === 'mastered'
    let updated = upsertCriticalCareActivityProgress(
      envelope,
      {
        activityId,
        status: authoritativeStatus,
        currentPhase: phaseForProgress,
        mode: 'guided',
        attempts: Math.max(attempt.current, existing?.attempts ?? 0),
        hintCount: (existing?.hintCount ?? 0) + (addHint ? 1 : 0),
        competencyEvidenceIds: authoritativeCriticalCareCompetencyEvidence(
          activity,
          done ? activity.competencyIds : [],
        ),
        updatedAt: now,
      },
      done
        ? undefined
        : {
            activityId,
            pathname: '/icu-hemodynamics/learn',
            query: { activity: skillId },
            mode: 'guided',
            phase: 'recognize',
            scenarioId: baseCase.id,
            checkpointId: 'authored-start',
            payloadVersion: `pac-${skillId}-v1`,
            updatedAt: now,
          },
    )
    if (done) updated = withoutCriticalCareResumePointer(updated, activityId)
    const saved = writeCriticalCareProgress(window.localStorage, updated)
    setMessage(
      saved
        ? done
          ? 'Activity completion saved on this device.'
          : requestedDone
            ? 'Draft review saved as in progress; it does not make a claim about clinical readiness.'
            : 'Progress saved; this activity safely resumes from its authored setup.'
        : 'Progress could not be stored on this device.',
    )
  }

  function advance(next: CriticalCareActivityPhase) {
    setPhase(next)
    setHintVisible(false)
    persist(false, false, next)
  }

  function selectPhase(next: CriticalCareActivityPhase) {
    const movingForward =
      criticalCareActivityPhases.indexOf(next) > criticalCareActivityPhases.indexOf(phase)
    if (movingForward && next === 'predict') {
      setState(predictionSkillState(skillId))
      setPredictionChoiceId(null)
    } else if (movingForward && next === 'act') {
      setState(actionSkillState(skillId))
    } else if (movingForward && next === 'transfer') {
      setState((current) => transferSkillState(skillId, current))
      setTransferChoiceId(null)
    }
    setPhase(next)
    setHintVisible(false)
    persist(false, false, next)
    setMessage(
      `Opened the ${next} section directly. Earlier checkpoints remain available from the phase navigation.`,
    )
  }

  function reset() {
    setState(actionSkillState(skillId))
    setPhase('recognize')
    setPredictionChoiceId(null)
    setTransferChoiceId(null)
    setMethodProvenanceResolved(false)
    setDisagreementResolved(false)
    setCompleted(false)
    setMessage('Activity reset to its authored setup.')
  }

  function continueToNextSection() {
    if (!nextSection) {
      router.push('/icu-hemodynamics/practice' as Route)
      return
    }
    if (onPathwaySectionChange) {
      onPathwaySectionChange(nextSection.id as PacLearningPathwaySectionId)
      return
    }
    router.push(`/icu-hemodynamics/learn?activity=${nextSection.id}` as Route)
  }

  function showHint() {
    if (!hintVisible) {
      persist(false, true)
      lifecycleAnalytics.recordHintUsed()
    }
    setHintVisible(true)
  }

  function commitPrediction() {
    if (skillId === 'catheter-advancement' && state.catheter.position !== 'wedge') {
      setMessage(
        'Continue the orientation through RA, RV, PA, and the brief normal wedge example before committing the pattern comparison.',
      )
      return
    }
    const choice = learningItems.prediction.choices.find(
      (candidate) => candidate.id === predictionChoiceId,
    )
    if (!choice) return
    setMessage(`${plausibilityLabels[choice.plausibility]}. ${choice.rationale}`)
    setState(actionSkillState(skillId))
    lifecycleAnalytics.recordPredictionSubmitted()
    advance('act')
  }

  function completeObjective() {
    lifecycleAnalytics.recordGoalMet()
    advance('observe')
  }

  function enterTransfer() {
    setState((current) => transferSkillState(skillId, current))
    setTransferChoiceId(null)
    setMessage(null)
    advance('transfer')
  }

  function completeTransfer() {
    if (transferChoiceId === null || !objectiveComplete(skillId, state)) {
      setMessage(
        'Complete the authored transfer interaction and choose an interpretation before finishing.',
      )
      return
    }
    /**
     * H4 §11. Cardiac output is the one station where finishing the hands-on objective is not
     * enough. A learner who built a series but never separated a measured oxygen uptake from a
     * substituted one, or never resolved a disagreement without averaging it away, has done part of
     * this section.
     */
    if (skillId === 'thermodilution-series' && !sectionCompletion.complete) {
      setMessage(sectionCompletion.outstanding.join(' '))
      return
    }
    setCompleted(true)
    persist(true, false, 'transfer')
    lifecycleAnalytics.recordTransferCompleted()
    setMessage(
      nextSection
        ? `Section worked through. Repeat it or continue to ${nextSection.title}.`
        : 'Section worked through. Repeat it or continue to hemodynamics practice.',
    )
  }

  const isObjectiveComplete = objectiveComplete(skillId, state)
  const sectionCompletion = thermodilutionSectionCompletion({
    trials: state.thermodilutionTrials,
    methodProvenanceResolved,
    disagreementResolvedWithoutAveraging: disagreementResolved,
  })
  const predictionCorrect =
    predictionChoiceId !== null &&
    learningItems.prediction.correctChoiceIds.includes(predictionChoiceId)
  const predictionFeedbackChoice = learningItems.prediction.choices.find(
    (choice) => choice.id === predictionChoiceId,
  )
  const transferFeedbackChoice = learningItems.transfer.choices.find(
    (choice) => choice.id === transferChoiceId,
  )
  const advancementOrientationPosition =
    pacAdvancementOrientationSteps.find((step) => step.position === state.catheter.position)
      ?.position ?? 'introducer'
  const advancementUnlocked = skillId !== 'catheter-advancement' || prebriefAcknowledged
  const taskControls = completed ? (
    <PacSectionCompletionActions
      sectionTitle={spec.title}
      nextTitle={nextSection?.title}
      continueLabel={nextSection ? undefined : 'Continue to hemodynamics practice'}
      onRepeat={reset}
      onContinue={continueToNextSection}
    />
  ) : phase === 'recognize' ? (
    <div className="grid gap-3">
      <PacSectionReadinessCard sectionId={skillId} />
      {skillId === 'catheter-advancement' ? (
        <PacAdvancementPrebrief
          acknowledged={prebriefAcknowledged}
          onAcknowledge={() => setPrebriefAcknowledged(true)}
        />
      ) : null}
      <button
        type="button"
        disabled={skillId === 'catheter-advancement' && !prebriefAcknowledged}
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        onClick={() => {
          setState(predictionSkillState(skillId))
          advance('predict')
        }}
      >
        Orient to this skill station
      </button>
    </div>
  ) : phase === 'predict' && skillId === 'catheter-advancement' && !advancementUnlocked ? (
    <PacAdvancementPrebrief
      acknowledged={false}
      onAcknowledge={() => setPrebriefAcknowledged(true)}
    />
  ) : phase === 'predict' && skillId === 'catheter-advancement' ? (
    <PacAdvancementOrientation
      currentPosition={advancementOrientationPosition}
      moving={state.catheter.targetPosition !== null}
      prediction={learningItems.prediction}
      selectedChoiceId={predictionChoiceId}
      onAdvance={(position) =>
        dispatch(
          position === 'wedge'
            ? { type: 'SET_CATHETER_POSITION', position }
            : { type: 'ADVANCE_CATHETER', instant: true },
        )
      }
      onChoiceChange={setPredictionChoiceId}
      onCommit={commitPrediction}
    />
  ) : phase === 'predict' ? (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold">{learningItems.prediction.stem}</legend>
      {learningItems.prediction.choices.map((choice) => (
        <label
          key={choice.id}
          className="flex min-h-11 items-start gap-3 rounded-xl border p-3 text-sm"
        >
          <input
            type="radio"
            name="skill-prediction"
            checked={predictionChoiceId === choice.id}
            onChange={() => setPredictionChoiceId(choice.id)}
          />
          {choice.label}
        </label>
      ))}
      <button
        type="button"
        disabled={predictionChoiceId === null}
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        onClick={commitPrediction}
      >
        Commit prediction
      </button>
    </fieldset>
  ) : phase === 'act' ? (
    <div className="grid gap-3">
      {predictionFeedbackChoice ? (
        <ChoiceReasoningFeedback
          item={learningItems.prediction}
          choiceId={predictionFeedbackChoice.id}
        />
      ) : null}
      <button
        type="button"
        disabled={!isObjectiveComplete}
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        onClick={completeObjective}
      >
        Continue after completing the objective
      </button>
    </div>
  ) : phase === 'observe' ? (
    <button
      type="button"
      className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      onClick={() => {
        dispatch({ type: 'TICK', seconds: 5 })
        lifecycleAnalytics.recordDebriefViewed()
        advance('explain')
      }}
    >
      Observe and explain the result
    </button>
  ) : phase === 'explain' ? (
    <button
      type="button"
      className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      onClick={enterTransfer}
    >
      Open transfer check
    </button>
  ) : (
    <div className="grid gap-2">
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">{learningItems.transfer.stem}</legend>
        {learningItems.transfer.choices.map((choice) => (
          <label
            key={choice.id}
            className="flex min-h-11 items-start gap-3 rounded-xl border p-3 text-sm"
          >
            <input
              type="radio"
              name="skill-transfer"
              checked={transferChoiceId === choice.id}
              onChange={() => {
                setTransferChoiceId(choice.id)
                setMessage(`${plausibilityLabels[choice.plausibility]}. ${choice.rationale}`)
              }}
            />
            {choice.label}
          </label>
        ))}
      </fieldset>
      {transferFeedbackChoice ? (
        <ChoiceReasoningFeedback
          item={learningItems.transfer}
          choiceId={transferFeedbackChoice.id}
        />
      ) : null}
      <p className="rounded-xl bg-muted p-3 text-xs leading-5">
        Complete the new interaction in the visual workspace; selecting an answer alone does not
        complete the activity.
      </p>
      {skillId === 'thermodilution-series' && sectionCompletion.outstanding.length > 0 ? (
        <ul className="grid gap-1 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-5">
          {sectionCompletion.outstanding.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        disabled={
          completed ||
          transferChoiceId === null ||
          !isObjectiveComplete ||
          (skillId === 'thermodilution-series' && !sectionCompletion.complete)
        }
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        onClick={completeTransfer}
      >
        Complete transfer and keep the reasoning feedback
      </button>
    </div>
  )

  const learningPane =
    skillId === 'pressure-system' ? (
      <PressureSystemValidityPanel state={state} commitment={learningItems.validityCommitment} />
    ) : skillId === 'waveform-interpretation' ? (
      // The normal reference is established first; the recognition drill follows it.
      phase === 'recognize' ? (
        <NormalWaveformReference />
      ) : (
        <WaveformRecognitionDrill dispatch={dispatch} />
      )
    ) : skillId === 'pawp-capture' ? (
      // H3 §7. The live inflate/cursor/store/deflate controls stay in the controls pane; the
      // judgements — plausibility, and whether the PA waveform actually came back — live here.
      <PawpSafetySequencePanel
        state={state}
        onRecoveryConfirmed={() => {
          if (!state.signalValidationChecks.includes(PA_RETURN_CHECK)) {
            dispatch({ type: 'VALIDATE_SIGNAL', check: PA_RETURN_CHECK })
          }
        }}
      />
    ) : skillId === 'thermodilution-series' ? (
      // H4 §6. The canonical method records stay on screen through every phase: the acquisition
      // work in the controls pane is meant to be done next to the description of what the method
      // is estimating, not after reading it once and moving on.
      <CardiacOutputMethodModel
        provenanceResolved={methodProvenanceResolved}
        onProvenanceResolved={() => setMethodProvenanceResolved(true)}
      />
    ) : skillId === 'derived-hemodynamics' ? (
      <DerivedHemodynamicsTeachingPanel />
    ) : (
      <PhysiologyPanel state={state} dispatch={dispatch} />
    )

  const stationViewport =
    phase === 'explain' ? (
      <div className="h-full overflow-auto p-4">
        <DebriefPanel
          clinicalModel={
            predictionCorrect
              ? learningItems.prediction.explanation
              : 'The initial interpretation needs review against the displayed signal and technique.'
          }
          actions={[spec.requiredAction]}
          consequences={spec.explanation}
          performanceDomains={[
            { label: 'Objective', result: isObjectiveComplete ? 'Completed' : 'Needs review' },
            { label: 'Safety sequence', result: 'Validation precedes interpretation' },
          ]}
          transfer={<p>{spec.transfer}</p>}
        />
      </div>
    ) : (
      <ResizablePacWorkspace
        key={`${skillId}-${phase}`}
        monitor={
          <BedsideMonitor state={state} dispatch={dispatch} onOpenCardiacOutput={showHint} />
        }
        physiology={learningPane}
        controls={
          <SkillSurface
            key={`${skillId}-${phase}`}
            skillId={skillId}
            phase={phase}
            state={state}
            dispatch={dispatch}
            advancementUnlocked={advancementUnlocked}
            onDisagreementResolved={() => setDisagreementResolved(true)}
          />
        }
      />
    )

  const viewport = onPathwaySectionChange ? (
    <PacLearningPathwayViewport
      activeSectionId={skillId}
      onSelect={(sectionId) => {
        persist(completed, false, phase)
        onPathwaySectionChange(sectionId)
      }}
    >
      {stationViewport}
    </PacLearningPathwayViewport>
  ) : (
    stationViewport
  )

  return (
    <SimulationLaunchGate
      activityTitle={spec.title}
      minimumViewport="tablet"
      bandwidthClass="standard"
      estimatedSizeLabel="Under 2 MB after shared application assets"
      lightweightAlternativeHref="/icu-hemodynamics/learn"
      onSaveForLater={() => {
        persist(false)
        router.push('/icu-hemodynamics/learn' as Route)
      }}
      theme="dark"
    >
      {locale !== 'en' ? (
        <p className="sr-only">Reviewed English fallback; localized clinical review is pending.</p>
      ) : null}
      <ActivityShell
        layout="guided-lab"
        activityId={activityId}
        assumedConceptIds={activity.assumedConceptIds}
        breadcrumb={
          <span>
            <Link href={'/icu-hemodynamics' as Route}>ICU Hemodynamics</Link> /{' '}
            <Link href={'/icu-hemodynamics/learn' as Route}>Learn</Link> / {spec.title}
          </span>
        }
        activityTitle={spec.title}
        phase={phase}
        onPhaseSelect={selectPhase}
        mode="guided"
        progressLabel={
          completed
            ? activity.completionEvidenceAuthority === 'none'
              ? 'Draft reviewed · non-credit'
              : 'Worked through'
            : `Current phase: ${phase}`
        }
        patientContext={
          <PatientContextBar
            items={[
              { label: 'Setting', value: 'Adult ICU · simulated' },
              { label: 'PAC position', value: state.catheter.position.toUpperCase() },
              {
                label: 'Pressure zero',
                value: state.measurementSystem.zeroed ? 'Complete' : 'Required',
              },
              {
                label: 'Transducer level',
                value: `${state.measurementSystem.transducerLevelCm > 0 ? '+' : ''}${state.measurementSystem.transducerLevelCm.toFixed(0)} cm`,
              },
              {
                label: 'Signal artifact',
                value: state.measurementSystem.artifact.replaceAll('-', ' '),
              },
              {
                label: 'Accepted CO',
                value:
                  thermodilutionAcceptedAverage(state.thermodilutionTrials) === null
                    ? 'Not established'
                    : `${thermodilutionAcceptedAverage(state.thermodilutionTrials)?.toFixed(1)} L/min by thermodilution`,
              },
              {
                label: 'Variant',
                value:
                  phase !== 'transfer'
                    ? 'Primary skill state'
                    : skillId === 'thermodilution-series'
                      ? 'Paired-method comparison episodes'
                      : 'New authored waveform or patient state',
              },
              { label: 'Model time', value: `${state.timeSeconds.toFixed(1)} s` },
            ]}
            immediateGoal={`${spec.objective} The resulting clinical interpretation depends on completing this validation first.`}
            safetyConstraints={[
              'Educational simulation only.',
              'Validate signals and technique before interpretation.',
              'At the bedside, prepare, level, and zero the pressure system before catheter advancement.',
            ]}
          />
        }
        viewport={viewport}
        currentTask={
          <TaskPanel
            objective={spec.objective}
            requiredAction={
              completed
                ? 'Choose whether to repeat this section or continue to the next section.'
                : phase === 'transfer'
                  ? spec.transfer
                  : spec.requiredAction
            }
            targets={completed && nextSection ? [nextSection.title] : [spec.title]}
            hint={spec.explanation[0]}
            hintVisible={hintVisible}
            onHintRequested={showHint}
            mode="guided"
          >
            {taskControls}
          </TaskPanel>
        }
        bottomContent={
          message ??
          (skillId === 'pressure-system' &&
          phase === 'act' &&
          state.signalValidationChecks.includes('fast-flush') &&
          !state.signalValidationChecks.includes('dynamic-response-classified')
            ? 'Fast-flush trace captured; classify the release response before advancing.'
            : state.responseMessage) ??
          `Safe checkpoint · ${phase}`
        }
        secondaryActions={
          <>
            <ReferenceDrawer
              entries={referenceEntries}
              trigger={
                <button
                  type="button"
                  className="min-h-10 rounded-lg border px-3 text-xs font-semibold"
                >
                  Reference
                </button>
              }
            />
            <EvidenceDrawer
              entries={evidenceEntries}
              trigger={
                <button
                  type="button"
                  className="min-h-10 rounded-lg border px-3 text-xs font-semibold"
                >
                  Evidence
                </button>
              }
            />
          </>
        }
        onHelp={showHint}
        onReset={reset}
        onSaveAndExit={() => {
          persist(false)
          router.push('/icu-hemodynamics/learn' as Route)
        }}
        theme="dark"
      />
    </SimulationLaunchGate>
  )
}
