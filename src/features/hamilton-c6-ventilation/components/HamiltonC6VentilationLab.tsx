'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  Activity,
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  GraduationCap,
  Languages,
  LockKeyhole,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Stethoscope,
  Wind,
} from 'lucide-react'

import { recordSiteModuleEvent } from '@/lib/analytics'

import {
  hamiltonC6PublicationStatus,
  mechanicalVentilationCaseById,
  mechanicalVentilationCases,
  mechanicalVentilationCasesByStation,
  pilotCaseIds,
  ventilationStations,
} from '../content'
import {
  createDefaultProgress,
  createInitialSimulationState,
  hasCaseMastery,
  readProgress,
  recordCaseResult,
  setLastStation,
  ventilationSimulationReducer,
  writeProgress,
  type CaseOutcome,
  type HamiltonC6ProgressV1,
  type LearningExperience,
  type VentilationCaseDefinition,
} from '../engine'
import { BedsidePanel } from './BedsidePanel'
import { CaseWorkflow } from './CaseWorkflow'
import { HamiltonC6Console } from './HamiltonC6Console'
import { SourcesPanel } from './SourcesPanel'
import styles from './hamilton-c6-ventilation.module.css'

const MODULE_ID = 'hamilton-c6-ventilation'

function caseAttempt(progress: HamiltonC6ProgressV1, caseId: string): number {
  return (progress.attempts[caseId] ?? 0) + 1
}

function CalibrationPanel({
  definition,
  state,
}: {
  definition: VentilationCaseDefinition
  state: ReturnType<typeof createInitialSimulationState>
}) {
  if (process.env.NODE_ENV !== 'development') return null
  return (
    <details className={styles.calibrationPanel}>
      <summary>Development calibration · {definition.id}</summary>
      <dl>
        <div>
          <dt>Phenotype</dt>
          <dd>{definition.phenotype}</dd>
        </div>
        <div>
          <dt>Seed</dt>
          <dd>{state.seed}</dd>
        </div>
        <div>
          <dt>Branch</dt>
          <dd>{state.branch}</dd>
        </div>
        <div>
          <dt>Engine time</dt>
          <dd>{state.simulationTime.toFixed(2)} s</dd>
        </div>
        <div>
          <dt>Waveform buffer</dt>
          <dd>{state.waveforms.length} / 600</dd>
        </div>
        <div>
          <dt>Trend buffer</dt>
          <dd>{state.trends.length} / 180</dd>
        </div>
        <div>
          <dt>Neural / mechanical Ti</dt>
          <dd>
            {state.patient.drive.neuralInspiratoryTimeSeconds.toFixed(2)} /{' '}
            {state.measurements.mechanicalInspiratoryTimeSeconds.toFixed(2)} s
          </dd>
        </div>
        <div>
          <dt>R × C</dt>
          <dd>
            {(
              state.patient.mechanics.resistanceCmH2OPerLps *
              state.patient.mechanics.complianceLPerCmH2O
            ).toFixed(2)}{' '}
            s
          </dd>
        </div>
        <div>
          <dt>Stacked volume</dt>
          <dd>{state.measurements.stackedVolumeMl.toFixed(0)} mL</dd>
        </div>
        <div>
          <dt>Ineffective / auto</dt>
          <dd>
            {(state.measurements.ineffectiveEffortFraction * 100).toFixed(0)}% /{' '}
            {(state.measurements.autotriggerFraction * 100).toFixed(0)}%
          </dd>
        </div>
      </dl>
    </details>
  )
}

export default function HamiltonC6VentilationLab({ locale = 'en' }: { locale?: string }) {
  const [state, dispatch] = useReducer(ventilationSimulationReducer, undefined, () =>
    createInitialSimulationState(),
  )
  const [progress, setProgress] = useState<HamiltonC6ProgressV1>(createDefaultProgress)
  const [experience, setExperience] = useState<LearningExperience>('learn')
  const [hydrated, setHydrated] = useState(false)
  const lastAudibleAlarm = useRef<string | null>(null)
  const definition =
    mechanicalVentilationCaseById.get(state.caseId) ?? mechanicalVentilationCases[0]
  const station =
    ventilationStations.find((item) => item.id === definition.stationId) ?? ventilationStations[0]
  const controlsEnabled = experience === 'learn' || state.prediction.committed

  const completedCount = progress.completedCases.length
  const masteryCount = useMemo(
    () => mechanicalVentilationCases.filter((item) => hasCaseMastery(progress, item.id)).length,
    [progress],
  )

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = readProgress()
      setProgress(stored)
      setHydrated(true)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => dispatch({ type: 'TICK', seconds: 0.1 }), 100)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!state.ventilator.alarmAudioEnabled) return
    const alarm = state.alarms.find((item) => item.acknowledgedAt === undefined)
    const audioPaused =
      state.ventilator.audioPausedUntil !== null &&
      state.ventilator.audioPausedUntil > state.simulationTime
    if (!alarm || audioPaused || lastAudibleAlarm.current === alarm.id) return
    lastAudibleAlarm.current = alarm.id
    try {
      const AudioContextClass = window.AudioContext
      const context = new AudioContextClass()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.value = alarm.priority === 'high' ? 880 : 620
      gain.gain.setValueAtTime(0.035, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.16)
      oscillator.addEventListener('ended', () => void context.close())
    } catch {
      // Browser audio permission must never interrupt visual alarm handling.
    }
  }, [
    state.alarms,
    state.simulationTime,
    state.ventilator.alarmAudioEnabled,
    state.ventilator.audioPausedUntil,
  ])

  const loadCase = useCallback(
    (caseId: string, nextExperience = experience) => {
      const nextDefinition = mechanicalVentilationCaseById.get(caseId)
      if (!nextDefinition) return
      const nextProgress = setLastStation(progress, nextDefinition.stationId)
      setProgress(nextProgress)
      if (hydrated) writeProgress(nextProgress)
      dispatch({
        type: 'LOAD_CASE',
        caseId,
        experience: nextExperience,
        attempt: nextExperience === 'practice' ? caseAttempt(progress, caseId) : 1,
      })
    },
    [experience, hydrated, progress],
  )

  const switchExperience = (nextExperience: LearningExperience) => {
    setExperience(nextExperience)
    loadCase(state.caseId, nextExperience)
    recordSiteModuleEvent({
      eventType: 'module_interaction',
      moduleId: MODULE_ID,
      section: nextExperience,
      eventPayload: {
        caseId: state.caseId,
        station: definition.stationId,
        pathway: nextExperience,
        completion: false,
        score: null,
        errorCount: 0,
      },
    })
  }

  const handleResult = useCallback(
    (outcome: CaseOutcome) => {
      setProgress((current) => {
        const next = recordCaseResult(current, { caseId: definition.id, outcome })
        writeProgress(next)
        return next
      })
      recordSiteModuleEvent({
        eventType: 'module_completed',
        moduleId: MODULE_ID,
        percentComplete: Math.round(
          ((completedCount + 1) / mechanicalVentilationCases.length) * 100,
        ),
        section: definition.stationId,
        eventPayload: {
          caseId: definition.id,
          station: definition.stationId,
          pathway: 'practice',
          completion: true,
          score: outcome.score,
          errorCount: outcome.criticalErrors.length,
        },
      })
    },
    [completedCount, definition.id, definition.stationId],
  )

  return (
    <main className={styles.moduleRoot} data-publication={hamiltonC6PublicationStatus}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.heroBadges}>
            <span>
              <LockKeyhole aria-hidden="true" /> Authenticated draft
            </span>
            <span>
              <FlaskConical aria-hidden="true" /> Educational simulation
            </span>
            <span>15 cases · 5 stations</span>
          </div>
          <p className={styles.eyebrow}>Mechanical ventilation · Learn → Practice → reassess</p>
          <h1>HAMILTON-C6 ventilation Learn & Practice simulator</h1>
          <p>
            Read the patient, commit to a mechanism, adjust a functional C6 training facsimile, and
            prove the response with waveforms, mechanics, gas exchange, examination, and comfort.
          </p>
          <div className={styles.heroStats}>
            <div>
              <strong>{completedCount}</strong>
              <span>cases completed</span>
            </div>
            <div>
              <strong>{masteryCount}</strong>
              <span>cases mastered</span>
            </div>
            <div>
              <strong>80%</strong>
              <span>mastery threshold, no critical error</span>
            </div>
          </div>
        </div>
        <div className={styles.orientationCard}>
          <span>
            <BookOpenCheck aria-hidden="true" /> C6 orientation
          </span>
          <ol>
            <li>
              <strong>1.</strong> Navigate mode, control, alarm, graphics, and tools screens.
            </li>
            <li>
              <strong>2.</strong> Select a setting, then press-and-turn with the physical knob
              controls.
            </li>
            <li>
              <strong>3.</strong> Separate trigger, target/flow, cycle, and expiration on all three
              waveforms.
            </li>
            <li>
              <strong>4.</strong> Use bedside data to decide whether the ventilator is the cause,
              the response, or neither.
            </li>
          </ol>
        </div>
      </header>

      <div className={styles.disclaimerBanner} role="note">
        <ShieldAlert aria-hidden="true" />
        <p>
          <strong>Training only.</strong> Not a clinical device, validated digital twin, treatment
          recommendation, or substitute for the operator’s manual and local supervised practice. Not
          manufactured, sponsored, or endorsed by Hamilton Medical.
        </p>
      </div>

      {locale !== 'en' ? (
        <div className={styles.languageFallback} role="status">
          <Languages aria-hidden="true" />
          <p>
            <strong>Reviewed-English fallback:</strong> Clinical simulation copy remains in English
            on this route until an independent translation review is complete.
          </p>
        </div>
      ) : null}

      <section className={styles.experienceBar} aria-label="Learning pathway">
        <div className={styles.experienceTabs} role="tablist" aria-label="Learn or Practice">
          <button
            type="button"
            role="tab"
            aria-selected={experience === 'learn'}
            onClick={() => switchExperience('learn')}
          >
            <GraduationCap aria-hidden="true" />
            <span>
              <strong>Learn</strong>
              <small>Labels, Pmus, guided targets, free hints</small>
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={experience === 'practice'}
            onClick={() => switchExperience('practice')}
          >
            <ClipboardCheck aria-hidden="true" />
            <span>
              <strong>Practice</strong>
              <small>Clean case, commit first, scored debrief</small>
            </span>
          </button>
        </div>
        {experience === 'practice' ? (
          <div className={styles.challengeToggle} aria-label="Practice challenge mode">
            <button
              type="button"
              aria-pressed={state.challengeMode === 'untimed'}
              onClick={() => dispatch({ type: 'SET_CHALLENGE_MODE', challengeMode: 'untimed' })}
            >
              Untimed
            </button>
            <button
              type="button"
              aria-pressed={state.challengeMode === 'timed'}
              onClick={() => dispatch({ type: 'SET_CHALLENGE_MODE', challengeMode: 'timed' })}
            >
              Timed challenge
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={styles.overlayToggle}
            aria-pressed={state.showEducatorOverlay}
            onClick={() => dispatch({ type: 'TOGGLE_EDUCATOR_OVERLAY' })}
          >
            <Activity aria-hidden="true" /> Pmus overlay {state.showEducatorOverlay ? 'on' : 'off'}
          </button>
        )}
      </section>

      <section className={styles.simulatorWorkspace} aria-label="Ventilation simulator workspace">
        <aside className={styles.curriculumRail} aria-label="Case stations">
          <div className={styles.curriculumHeading}>
            <div>
              <span>Curriculum</span>
              <h2>Five stations</h2>
            </div>
            <span>{completedCount}/15</span>
          </div>
          {ventilationStations.map((stationItem, stationIndex) => {
            const stationCases = mechanicalVentilationCasesByStation[stationItem.id]
            const active = stationItem.id === station.id
            return (
              <section key={stationItem.id} data-active={active}>
                <button
                  type="button"
                  className={styles.stationButton}
                  aria-expanded={active}
                  onClick={() => loadCase(stationCases[0].id)}
                >
                  <span>{stationIndex + 1}</span>
                  <span>
                    <strong>{stationItem.label}</strong>
                    <small>{stationItem.description}</small>
                  </span>
                </button>
                {active ? (
                  <div className={styles.caseButtons}>
                    {stationCases.map((caseDefinition) => {
                      const mastered = hasCaseMastery(progress, caseDefinition.id)
                      return (
                        <button
                          type="button"
                          key={caseDefinition.id}
                          aria-current={state.caseId === caseDefinition.id ? 'true' : undefined}
                          onClick={() => loadCase(caseDefinition.id)}
                        >
                          <span>
                            {mastered ? (
                              <BadgeCheck aria-label="Mastered" />
                            ) : progress.completedCases.includes(caseDefinition.id) ? (
                              <CheckCircle2 aria-label="Completed" />
                            ) : null}
                            <strong>{caseDefinition.id}</strong>
                          </span>
                          <span>{caseDefinition.title}</span>
                          <small>
                            {pilotCaseIds.includes(
                              caseDefinition.id as (typeof pilotCaseIds)[number],
                            )
                              ? 'Engine-validation case · '
                              : ''}
                            best {progress.bestScores[caseDefinition.id] ?? '—'}
                          </small>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </section>
            )
          })}
        </aside>

        <div className={styles.simulationColumn}>
          <div className={styles.caseToolbar}>
            <div>
              <span>{station.label}</span>
              <strong>
                {definition.id} · {definition.title}
              </strong>
            </div>
            <button type="button" onClick={() => loadCase(definition.id)}>
              <RotateCcw aria-hidden="true" /> Reload clean case
            </button>
          </div>
          <HamiltonC6Console state={state} dispatch={dispatch} controlsEnabled={controlsEnabled} />
          <CalibrationPanel definition={definition} state={state} />
        </div>

        <BedsidePanel state={state} definition={definition} />
      </section>

      <div className={styles.workflowLayout}>
        <CaseWorkflow
          state={state}
          definition={definition}
          dispatch={dispatch}
          onResult={handleResult}
        />
        <aside className={styles.workflowNotes}>
          <section>
            <SlidersHorizontal aria-hidden="true" />
            <div>
              <strong>Immediate versus delayed response</strong>
              <p>
                Waveforms and mechanics respond first. SpO₂, ABGs, medication effects, and disease
                physiology move on slower simulated time constants.
              </p>
            </div>
          </section>
          <section>
            <Stethoscope aria-hidden="true" />
            <div>
              <strong>Physiologic endpoints score better than exact settings</strong>
              <p>
                Accepted paths can differ if the safety priority, mechanism, response direction, and
                reassessment are sound.
              </p>
            </div>
          </section>
          <section>
            <Wind aria-hidden="true" />
            <div>
              <strong>C6 vocabulary is deliberate</strong>
              <p>
                (S)CMV replaces generic VC-A/C, PCV+ replaces PC-A/C, and SPONT supplies pressure
                support with optional apnea backup.
              </p>
            </div>
          </section>
        </aside>
      </div>

      <SourcesPanel />
    </main>
  )
}
