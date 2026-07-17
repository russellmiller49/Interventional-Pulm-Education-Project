'use client'

import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from 'react'
import {
  BookOpen,
  BrainCircuit,
  ClipboardCheck,
  Compass,
  EyeOff,
  FileClock,
  Languages,
  Layers3,
  LockKeyhole,
  MonitorCog,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'

import { HandoffContent } from '@/i18n/handoff'
import { recordSiteModuleEvent } from '@/lib/analytics'
import type { BaxterCrrtAnalyticsEventPayload } from '@/lib/baxter-crrt-analytics'

import { buildBaxterCrrtAnalyticsEvent } from '../analytics'
import {
  baxterCrrtPathways,
  baxterCrrtPublicationStatus,
  getBaxterCrrtPathway,
  prismaxDraftDeviceProfile,
  type BaxterCrrtPathwayId,
  type RuntimeCrrtCase,
} from '../content'
import {
  baxterCrrtPilotCases,
  getBaxterCrrtPilotCase,
  isBaxterCrrtPilotCaseId,
} from '../content/pilotCases'
import {
  createCrrtLearningSession,
  createDefaultProgress,
  crrtLearningSessionReducer,
  progressAttemptKey,
  readProgress,
  recordCaseResult,
  recordLessonCompletion,
  selectCrrtLearningOutcome,
  setProgressContext,
  writeProgress,
  type BaxterCrrtProgressV1,
  type CrrtLearningExperience,
  type CrrtLearningOutcome,
  type CrrtRoleLens,
} from '../engine'
import {
  createInitialPrismaxPilotInterfaceState,
  prismaxPilotInterfaceReducer,
  selectPrismaxPilotCaseOperationsDisplay,
  selectPrismaxPilotOperationsDisplay,
  type PrismaxPilotInterfaceAction,
} from '../engine/deviceAdapters/prismax'
import { CrrtCalibrationPanel } from './CrrtCalibrationPanel'
import {
  CrrtLearningWorkflow,
  CrrtReasoningRibbon,
  type CrrtMobileSurface,
} from './CrrtLearningWorkflow'
import { CrrtPilotCircuit } from './CrrtPilotCircuit'
import { CrrtResponsePanel } from './CrrtResponsePanel'
import { PrismaxPilotInterface } from './PrismaxPilotInterface'
import { SourcesPanel } from './SourcesPanel'
import styles from './baxter-crrt.module.css'

const selectablePathwayIds = baxterCrrtPathways
  .filter((pathway) => pathway.status === 'scaffold')
  .map((pathway) => pathway.id)

const pathwayIcons = {
  orientation: Compass,
  learn: BookOpen,
  practice: ClipboardCheck,
  mastery: LockKeyhole,
} as const

const mobileSurfaces: readonly { readonly id: CrrtMobileSurface; readonly label: string }[] = [
  { id: 'case', label: 'Case' },
  { id: 'machine', label: 'Machine' },
  { id: 'circuit', label: 'Circuit' },
  { id: 'patient', label: 'Patient / trends' },
  { id: 'debrief', label: 'Debrief' },
]

const initialPilotCase = baxterCrrtPilotCases[0]

interface BaxterCrrtLabProps {
  locale?: string
}

type AttemptMetricFields = Partial<
  Pick<
    BaxterCrrtAnalyticsEventPayload,
    | 'score'
    | 'criticalErrorCount'
    | 'hintCount'
    | 'elapsedSeconds'
    | 'timeToFirstSafeActionSeconds'
    | 'completed'
    | 'reassessmentCompleted'
  >
>

function analyticsLessonId(caseId: string): string {
  return `${caseId.toLowerCase()}.learn`
}

function progressCaseId(caseId: string): string {
  return caseId.toLowerCase()
}

export default function BaxterCrrtLab({ locale = 'en' }: BaxterCrrtLabProps) {
  const [activePathwayId, setActivePathwayId] = useState<BaxterCrrtPathwayId>('orientation')
  const [mobileSurface, setMobileSurface] = useState<CrrtMobileSurface>('case')
  const [progress, setProgress] = useState<BaxterCrrtProgressV1>(() => createDefaultProgress())
  const [pilotState, pilotDispatch] = useReducer(
    prismaxPilotInterfaceReducer,
    undefined,
    createInitialPrismaxPilotInterfaceState,
  )
  const [learningSession, learningDispatch] = useReducer(
    crrtLearningSessionReducer,
    undefined,
    () =>
      createCrrtLearningSession({
        caseDefinition: initialPilotCase,
        experience: 'learn',
        roleLens: 'integrated',
        attempt: 1,
      }),
  )
  const tabRefs = useRef<Partial<Record<BaxterCrrtPathwayId, HTMLButtonElement | null>>>({})
  const activePathway = getBaxterCrrtPathway(activePathwayId)
  const orientationOperations = selectPrismaxPilotOperationsDisplay(pilotState)
  const caseOperations = selectPrismaxPilotCaseOperationsDisplay(
    learningSession.interfaceState,
    learningSession.simulation,
  )
  const learningOutcome = selectCrrtLearningOutcome(learningSession)
  const isLearningPathway = activePathwayId === 'learn' || activePathwayId === 'practice'
  const activeAlarms = learningSession.simulation.alarms.filter((alarm) => alarm.active)

  useEffect(() => {
    setProgress(readProgress())
  }, [])

  function emitAnalytics(eventPayload: BaxterCrrtAnalyticsEventPayload) {
    const event = buildBaxterCrrtAnalyticsEvent({ eventPayload })
    recordSiteModuleEvent({
      eventType: event.eventType,
      moduleId: event.moduleId,
      eventPayload: { ...event.eventPayload },
      ...(event.percentComplete === undefined ? {} : { percentComplete: event.percentComplete }),
      ...(event.section === undefined ? {} : { section: event.section }),
    })
  }

  function emitLearningEvent(
    interaction: BaxterCrrtAnalyticsEventPayload['interaction'],
    metrics: AttemptMetricFields = {},
    context: {
      readonly experience?: CrrtLearningExperience
      readonly caseDefinition?: RuntimeCrrtCase
      readonly roleLens?: CrrtRoleLens
    } = {},
  ) {
    const experience = context.experience ?? learningSession.experience
    const caseDefinition = context.caseDefinition ?? learningSession.caseDefinition
    const roleLens = context.roleLens ?? learningSession.roleLens
    const identity =
      experience === 'learn'
        ? { lessonId: analyticsLessonId(caseDefinition.id) }
        : { caseId: caseDefinition.id }
    emitAnalytics({
      interaction,
      pathway: experience,
      device: learningSession.simulation.deviceId,
      role: roleLens,
      ...identity,
      ...metrics,
    } as BaxterCrrtAnalyticsEventPayload)
  }

  function emitOpenEvent(
    experience: CrrtLearningExperience,
    caseDefinition: RuntimeCrrtCase,
    roleLens = learningSession.roleLens,
  ) {
    emitLearningEvent(
      experience === 'learn' ? 'lesson_opened' : 'case_opened',
      {},
      {
        experience,
        caseDefinition,
        roleLens,
      },
    )
  }

  function attemptFor(caseDefinition: RuntimeCrrtCase, roleLens: CrrtRoleLens): number {
    const key = progressAttemptKey(
      'prismax-aw8035-2xx',
      roleLens,
      progressCaseId(caseDefinition.id),
    )
    return (progress.attempts[key] ?? 0) + 1
  }

  function loadLearningCase(
    caseDefinition: RuntimeCrrtCase,
    experience: CrrtLearningExperience,
    roleLens: CrrtRoleLens,
    attempt = attemptFor(caseDefinition, roleLens),
  ) {
    learningDispatch({
      type: 'LOAD_CASE',
      caseDefinition,
      experience,
      roleLens,
      attempt,
    })
    setMobileSurface('case')
  }

  function selectPathway(pathwayId: BaxterCrrtPathwayId) {
    if (pathwayId === 'mastery') return
    if (pathwayId === activePathwayId) return
    setActivePathwayId(pathwayId)
    emitAnalytics({
      interaction: 'pathway_selected',
      pathway: pathwayId,
      device: learningSession.simulation.deviceId,
      role: learningSession.roleLens,
    })
    if (pathwayId === 'learn' || pathwayId === 'practice') {
      loadLearningCase(
        learningSession.caseDefinition,
        pathwayId,
        learningSession.roleLens,
        learningSession.attempt,
      )
      emitOpenEvent(pathwayId, learningSession.caseDefinition)
    }
  }

  function selectAndFocus(pathwayId: BaxterCrrtPathwayId) {
    selectPathway(pathwayId)
    tabRefs.current[pathwayId]?.focus()
  }

  function handlePathwayKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    pathwayId: BaxterCrrtPathwayId,
  ) {
    const currentIndex = selectablePathwayIds.indexOf(pathwayId)
    if (currentIndex < 0) return

    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % selectablePathwayIds.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + selectablePathwayIds.length) % selectablePathwayIds.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = selectablePathwayIds.length - 1
    }

    if (nextIndex === null) return
    event.preventDefault()
    selectAndFocus(selectablePathwayIds[nextIndex])
  }

  function handleCaseChange(caseId: string) {
    if (!isBaxterCrrtPilotCaseId(caseId)) return
    const caseDefinition = getBaxterCrrtPilotCase(caseId)
    loadLearningCase(caseDefinition, learningSession.experience, learningSession.roleLens)
    emitOpenEvent(learningSession.experience, caseDefinition)
  }

  function handleRoleChange(roleLens: CrrtRoleLens) {
    loadLearningCase(learningSession.caseDefinition, learningSession.experience, roleLens)
    const nextProgress = setProgressContext(progress, {
      device: 'prismax-aw8035-2xx',
      roleLens,
      station: learningSession.caseDefinition.stationId,
    })
    setProgress(nextProgress)
    writeProgress(nextProgress)
    emitAnalytics({
      interaction: 'role_selected',
      pathway: learningSession.experience,
      device: learningSession.simulation.deviceId,
      role: roleLens,
    })
    emitOpenEvent(learningSession.experience, learningSession.caseDefinition, roleLens)
  }

  function handleCleanAttempt() {
    learningDispatch({ type: 'RESET', attempt: learningSession.attempt + 1 })
    setMobileSurface('case')
    emitOpenEvent(learningSession.experience, learningSession.caseDefinition)
  }

  function handleCaseDeviceAction(action: PrismaxPilotInterfaceAction) {
    if (action.type === 'RESET_INTERFACE') {
      handleCleanAttempt()
      return
    }
    learningDispatch({ type: 'DEVICE_ACTION', action })
  }

  function handleDebriefRevealed(outcome: CrrtLearningOutcome) {
    const elapsedSeconds = Math.min(
      86_400,
      Math.max(0, Math.round(learningSession.simulation.simulationTimeSeconds)),
    )
    const contextProgress = setProgressContext(progress, {
      device: 'prismax-aw8035-2xx',
      roleLens: learningSession.roleLens,
      station: learningSession.caseDefinition.stationId,
    })

    if (learningSession.experience === 'learn') {
      const nextProgress = recordLessonCompletion(
        contextProgress,
        analyticsLessonId(learningSession.caseDefinition.id),
      )
      setProgress(nextProgress)
      writeProgress(nextProgress)
      emitLearningEvent('lesson_completed', { completed: true, elapsedSeconds })
      return
    }

    const score = outcome.score ?? 0
    const nextProgress = recordCaseResult(contextProgress, {
      caseId: progressCaseId(learningSession.caseDefinition.id),
      device: 'prismax-aw8035-2xx',
      roleLens: learningSession.roleLens,
      score,
      criticalError: outcome.criticalErrorIds.length > 0,
      hintCount: learningSession.usedHintIds.length,
    })
    setProgress(nextProgress)
    writeProgress(nextProgress)
    emitLearningEvent('case_completed', {
      score,
      criticalErrorCount: outcome.criticalErrorIds.length,
      hintCount: learningSession.usedHintIds.length,
      elapsedSeconds,
      completed: true,
      reassessmentCompleted: outcome.reassessmentComplete,
    })
  }

  return (
    <HandoffContent>
      <main
        className={styles.moduleShell}
        data-no-handoff-translate={locale !== 'en'}
        data-publication-status={baxterCrrtPublicationStatus}
      >
        <header className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroCopy}>
            <div className={styles.heroBadges}>
              <span>
                <EyeOff aria-hidden="true" /> Authenticated draft
              </span>
              <span>
                <FileClock aria-hidden="true" /> PrisMax AW8035 Rev B
              </span>
              <span>
                <ShieldAlert aria-hidden="true" /> Review pending
              </span>
            </div>
            <p className={styles.eyebrow}>Adult ICU CRRT · independent educational pilot</p>
            <h1>CRRT Learn &amp; Practice workspace</h1>
            <p className={styles.heroLead}>
              Phases 4 and 5 connect prediction-gated Learn and Practice workflows to three
              source-mapped synthetic cases, one deterministic engine, the PrisMax pilot interface,
              and an original circuit and response surface.
            </p>
          </div>

          <aside className={styles.phaseGate} aria-label="Current implementation phase">
            <span>Phase 4-5 vertical slice</span>
            <strong>Three pilot cases active in draft</strong>
            <ul>
              <li>
                <span aria-hidden="true">✓</span> Prediction-gated Learn and Practice
              </li>
              <li>
                <span aria-hidden="true">✓</span> CRRT-04, CRRT-10, and CRRT-13
              </li>
              <li>
                <span aria-hidden="true">✓</span> Scoring, hints, debrief, progress &amp; aggregate
                analytics
              </li>
              <li>
                <span aria-hidden="true">○</span> Phase 6 independent review and release QA pending
              </li>
            </ul>
          </aside>
        </header>

        <section className={styles.safetyBanner} aria-label="Educational safety boundary">
          <ShieldAlert aria-hidden="true" />
          <div>
            <strong>Professional education only.</strong>
            <p>
              This is not a clinical device, validated digital twin, certification program,
              patient-specific treatment guide, or substitute for the current operator&apos;s
              manual, local protocol, supervised hands-on training, or multidisciplinary clinical
              judgment. This independent educational module is not manufactured, sponsored,
              validated, or endorsed by Baxter.
            </p>
            <small>
              All case values, model coefficients, thresholds, accepted paths, scores, and
              critical-error candidates are synthetic and review-pending. They are not clinical
              defaults, targets, recommendations, or validated device behavior.
            </small>
          </div>
        </section>

        {locale !== 'en' ? (
          <div className={styles.languageFallback} data-no-handoff-translate={true} role="note">
            <Languages aria-hidden="true" />
            <p>
              <strong>Reviewed-English fallback:</strong> CRRT clinical and device copy remains in
              English until independent translation review is complete.
            </p>
          </div>
        ) : null}

        <dl className={styles.profileStrip} aria-label="Locked draft device profile">
          <div>
            <dt>Profile</dt>
            <dd>{prismaxDraftDeviceProfile.displayName}</dd>
          </div>
          <div>
            <dt>Source revision</dt>
            <dd>
              {prismaxDraftDeviceProfile.manualNumber} · {prismaxDraftDeviceProfile.manualRevision}
            </dd>
          </div>
          <div>
            <dt>Source software</dt>
            <dd>{prismaxDraftDeviceProfile.sourceProgramFamily}</dd>
          </div>
          <div>
            <dt>Market/configuration</dt>
            <dd>{prismaxDraftDeviceProfile.marketConfiguration}</dd>
          </div>
          <div>
            <dt>Availability</dt>
            <dd>Orientation + three-case CVVHD pilot</dd>
          </div>
          <div>
            <dt>Review</dt>
            <dd>Device, clinical, accessibility &amp; localization pending</dd>
          </div>
        </dl>

        <section className={styles.pathwaySection} aria-labelledby="crrt-pathway-heading">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.kicker}>Learning pathway</span>
              <h2 id="crrt-pathway-heading">
                Orient, learn with guidance, then practice independently
              </h2>
            </div>
            <span className={styles.scaffoldLabel}>
              <Sparkles aria-hidden="true" /> Three-case draft pilot
            </span>
          </div>

          <div className={styles.pathwayTabs} role="tablist" aria-label="CRRT learning pathway">
            {baxterCrrtPathways.map((pathway) => {
              const Icon = pathwayIcons[pathway.id]
              const locked = pathway.status === 'locked'
              const selected = pathway.id === activePathwayId
              return (
                <button
                  key={pathway.id}
                  id={`baxter-crrt-pathway-tab-${pathway.id}`}
                  ref={(node) => {
                    tabRefs.current[pathway.id] = node
                  }}
                  type="button"
                  role="tab"
                  aria-controls="baxter-crrt-pathway-panel"
                  aria-selected={selected}
                  aria-disabled={locked}
                  disabled={locked}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectPathway(pathway.id)}
                  onKeyDown={(event) => handlePathwayKeyDown(event, pathway.id)}
                >
                  <Icon aria-hidden="true" />
                  <span>
                    <strong>{pathway.label}</strong>
                    <small>{pathway.eyebrow}</small>
                  </span>
                  <em>{pathway.statusLabel}</em>
                </button>
              )
            })}
          </div>

          <div
            id="baxter-crrt-pathway-panel"
            className={styles.pathwayPanel}
            role="tabpanel"
            aria-labelledby={`baxter-crrt-pathway-tab-${activePathwayId}`}
            aria-live="polite"
          >
            <div>
              <span>{activePathway.label}</span>
              <strong>{activePathway.statusLabel}</strong>
            </div>
            <p>{activePathway.summary}</p>
          </div>
        </section>

        <section className={styles.workbenchSection} aria-labelledby="crrt-workbench-heading">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.kicker}>Three-domain workbench</span>
              <h2 id="crrt-workbench-heading">
                {isLearningPathway
                  ? 'Predict, act, reassess, and explain the causal chain'
                  : 'Run the device checkout and inspect the live surface'}
              </h2>
            </div>
            <span className={styles.scaffoldLabel}>
              <Layers3 aria-hidden="true" />
              {isLearningPathway ? 'Functional Phase 4-5 pilot' : 'Functional Orientation'}
            </span>
          </div>

          {isLearningPathway ? (
            <>
              <CrrtReasoningRibbon session={learningSession} />

              <div className={styles.mobileSurfaceTabs}>
                <div role="tablist" aria-label="CRRT mobile workspace surface">
                  {mobileSurfaces.map((surface) => (
                    <button
                      key={surface.id}
                      type="button"
                      role="tab"
                      aria-selected={mobileSurface === surface.id}
                      onClick={() => setMobileSurface(surface.id)}
                    >
                      {surface.label}
                    </button>
                  ))}
                </div>
                <p role={activeAlarms.length > 0 ? 'alert' : 'status'}>
                  <ShieldAlert aria-hidden="true" />
                  {activeAlarms.length > 0
                    ? `${activeAlarms.length} active generic engine alarm${activeAlarms.length === 1 ? '' : 's'}: ${activeAlarms.map((alarm) => alarm.code).join(', ')}`
                    : 'No active generic engine alarms'}
                </p>
              </div>

              <div className={styles.workbench} data-learning-workbench="true">
                <article
                  className={styles.workbenchPanel}
                  aria-labelledby="reasoning-panel-heading"
                  data-mobile-active={mobileSurface === 'case' || mobileSurface === 'debrief'}
                >
                  <div className={styles.panelHeading}>
                    <BrainCircuit aria-hidden="true" />
                    <div>
                      <span>Patient &amp; reasoning</span>
                      <h3 id="reasoning-panel-heading">
                        {learningSession.caseDefinition.id} ·{' '}
                        {learningSession.experience === 'learn'
                          ? 'Guided Learn'
                          : 'Scored Practice'}
                      </h3>
                    </div>
                  </div>
                  <CrrtLearningWorkflow
                    key={`${learningSession.caseDefinition.id}-${learningSession.experience}-${learningSession.roleLens}-${learningSession.attempt}`}
                    session={learningSession}
                    dispatch={learningDispatch}
                    availableCases={baxterCrrtPilotCases}
                    mobileSurface={mobileSurface}
                    onCaseChange={handleCaseChange}
                    onRoleChange={handleRoleChange}
                    onReset={handleCleanAttempt}
                    onPredictionCommitted={() => emitLearningEvent('prediction_committed')}
                    onHintUsed={() => emitLearningEvent('hint_requested')}
                    onFirstSafeAction={() => {
                      if (learningSession.experience === 'practice') {
                        const seconds = Math.min(
                          86_400,
                          Math.max(0, Math.round(learningSession.simulation.simulationTimeSeconds)),
                        )
                        emitLearningEvent('first_safe_action', {
                          elapsedSeconds: seconds,
                          timeToFirstSafeActionSeconds: seconds,
                        })
                      }
                    }}
                    onReassessmentCommitted={() =>
                      emitLearningEvent('reassessment_completed', {
                        reassessmentCompleted: true,
                      })
                    }
                    onDebriefRevealed={handleDebriefRevealed}
                  />
                </article>

                <article
                  className={[styles.workbenchPanel, styles.devicePanel].join(' ')}
                  aria-labelledby="device-panel-heading"
                  data-mobile-active={mobileSurface === 'machine'}
                >
                  <div className={styles.panelHeading}>
                    <MonitorCog aria-hidden="true" />
                    <div>
                      <span>Educational device surface</span>
                      <h3 id="device-panel-heading">Functional PrisMax pilot</h3>
                    </div>
                  </div>
                  <PrismaxPilotInterface
                    state={learningSession.interfaceState}
                    dispatch={handleCaseDeviceAction}
                    controlsEnabled={
                      Boolean(learningSession.prediction) && !learningSession.debriefRevealed
                    }
                    operationsDisplay={caseOperations}
                    caseContext={{
                      caseId: learningSession.caseDefinition.id,
                      title: learningSession.caseDefinition.title,
                      pathway: learningSession.experience,
                    }}
                  />
                </article>

                <div
                  className={styles.responseColumn}
                  data-mobile-active={mobileSurface === 'circuit' || mobileSurface === 'patient'}
                >
                  <div data-mobile-active={mobileSurface === 'circuit'}>
                    <CrrtPilotCircuit
                      running={learningSession.simulation.device.deliveryState === 'running'}
                      setReady={learningSession.interfaceState.completedStepIds.includes('sets')}
                      fluidsReady={learningSession.interfaceState.completedStepIds.includes(
                        'fluids',
                      )}
                      bloodFlowMlMin={caseOperations.flows?.bloodFlowMlMin ?? null}
                      dialysateFlowMlHour={caseOperations.flows?.dialysateFlowMlHour ?? null}
                      patientFluidRemovalMlHour={
                        caseOperations.flows?.patientFluidRemovalMlHour ?? null
                      }
                      pressure={{
                        access: caseOperations.pressures.accessPressureMmHg,
                        filter: caseOperations.pressures.filterPressureMmHg,
                        return: caseOperations.pressures.returnPressureMmHg,
                        effluent: caseOperations.pressures.effluentPressureMmHg,
                        TMP: caseOperations.pressures.transmembranePressureMmHg,
                        filterDrop: caseOperations.pressures.filterPressureDropMmHg,
                      }}
                    />
                  </div>
                  <div data-mobile-active={mobileSurface === 'patient'}>
                    <CrrtResponsePanel state={learningSession.simulation} />
                  </div>
                </div>
              </div>

              <CrrtCalibrationPanel
                state={learningSession.simulation}
                attempt={learningSession.attempt}
                matchedPathId={
                  learningOutcome.matchedRequiredPath
                    ? 'required-path'
                    : (learningOutcome.matchedAcceptedPathIds[0] ?? null)
                }
                criticalErrorIds={learningOutcome.criticalErrorIds}
              />
            </>
          ) : (
            <div className={styles.workbench}>
              <article className={styles.workbenchPanel} aria-labelledby="reasoning-panel-heading">
                <div className={styles.panelHeading}>
                  <BrainCircuit aria-hidden="true" />
                  <div>
                    <span>Patient &amp; reasoning</span>
                    <h3 id="reasoning-panel-heading">No case loaded</h3>
                  </div>
                </div>
                <p>
                  Orientation remains case-free so learners can inspect the interface sequence,
                  original circuit topology, blank controls, and clean reload without physiology or
                  scoring.
                </p>
                <ul className={styles.caseBoundaryList} aria-label="Orientation case boundary">
                  <li>
                    <span aria-hidden="true">—</span> No patient identifiers or physiology
                  </li>
                  <li>
                    <span aria-hidden="true">—</span> No case values, targets, or thresholds
                  </li>
                  <li>
                    <span aria-hidden="true">—</span> No prediction, hints, scoring, or debrief
                  </li>
                  <li>
                    <span aria-hidden="true">✓</span> Blank, learner-entered interface values only
                  </li>
                </ul>
              </article>

              <article
                className={[styles.workbenchPanel, styles.devicePanel].join(' ')}
                aria-labelledby="device-panel-heading"
              >
                <div className={styles.panelHeading}>
                  <MonitorCog aria-hidden="true" />
                  <div>
                    <span>Educational device surface</span>
                    <h3 id="device-panel-heading">Functional PrisMax pilot</h3>
                  </div>
                </div>
                <PrismaxPilotInterface state={pilotState} dispatch={pilotDispatch} />
              </article>

              <CrrtPilotCircuit
                running={pilotState.treatmentState === 'running'}
                setReady={pilotState.completedStepIds.includes('sets')}
                fluidsReady={pilotState.completedStepIds.includes('fluids')}
                bloodFlowMlMin={orientationOperations.flows?.bloodFlowMlMin ?? null}
                dialysateFlowMlHour={orientationOperations.flows?.dialysateFlowMlHour ?? null}
                patientFluidRemovalMlHour={
                  orientationOperations.flows?.patientFluidRemovalMlHour ?? null
                }
                pressure={{
                  access: orientationOperations.pressures.accessPressureMmHg,
                  filter: orientationOperations.pressures.filterPressureMmHg,
                  return: orientationOperations.pressures.returnPressureMmHg,
                  effluent: orientationOperations.pressures.effluentPressureMmHg,
                  TMP: orientationOperations.pressures.transmembranePressureMmHg,
                  filterDrop: orientationOperations.pressures.filterPressureDropMmHg,
                }}
              />
            </div>
          )}
        </section>

        <SourcesPanel />
      </main>
    </HandoffContent>
  )
}
