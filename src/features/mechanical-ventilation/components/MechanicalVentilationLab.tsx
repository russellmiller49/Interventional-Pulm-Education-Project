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
  getVentilatorDeviceProfile,
  mechanicalVentilationCaseById,
  mechanicalVentilationCases,
  mechanicalVentilationCasesByStation,
  mechanicalVentilationPublicationStatus,
  pilotCaseIds,
  ventilatorDeviceProfiles,
  ventilationStations,
} from '../content'
import {
  createDefaultProgress,
  createInitialSimulationState,
  hasCaseMastery,
  nextCaseAttempt,
  readProgress,
  recordCaseResult,
  setLastDevice,
  setLastStation,
  ventilationSimulationReducer,
  writeProgress,
  type CaseOutcome,
  type LearningExperience,
  type MechanicalVentilationProgressV2,
  type VentilationCaseDefinition,
  type VentilatorDeviceId,
} from '../engine'
import { BedsidePanel } from './BedsidePanel'
import { CaseWorkflow } from './CaseWorkflow'
import { MechanicalVentilatorConsole } from './MechanicalVentilatorConsole'
import { SourcesPanel } from './SourcesPanel'
import styles from './mechanical-ventilation.module.css'

const MODULE_ID = 'mechanical-ventilation'

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

export default function MechanicalVentilationLab({ locale = 'en' }: { locale?: string }) {
  const [state, dispatch] = useReducer(ventilationSimulationReducer, undefined, () =>
    createInitialSimulationState(),
  )
  const [progress, setProgress] = useState<MechanicalVentilationProgressV2>(createDefaultProgress)
  const [experience, setExperience] = useState<LearningExperience>('learn')
  const [workspaceView, setWorkspaceView] = useState<'case' | 'vent'>('case')
  const [requestedDeviceId, setRequestedDeviceId] = useState<VentilatorDeviceId | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const lastAudibleAlarm = useRef<string | null>(null)
  const definition =
    mechanicalVentilationCaseById.get(state.caseId) ?? mechanicalVentilationCases[0]
  const station =
    ventilationStations.find((item) => item.id === definition.stationId) ?? ventilationStations[0]
  const controlsEnabled = experience === 'learn' || state.prediction.committed
  const deviceProfile = getVentilatorDeviceProfile(state.deviceId)

  const completedCount = progress.completedCases.length
  const masteryCount = useMemo(
    () => mechanicalVentilationCases.filter((item) => hasCaseMastery(progress, item.id)).length,
    [progress],
  )

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = readProgress()
      setProgress(stored)
      if (stored.lastDeviceId !== 'hamilton-c6') {
        dispatch({ type: 'CHANGE_DEVICE', deviceId: stored.lastDeviceId })
      }
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
      setWorkspaceView('case')
      const nextProgress = setLastStation(progress, nextDefinition.stationId)
      setProgress(nextProgress)
      if (hydrated) writeProgress(nextProgress)
      dispatch({
        type: 'LOAD_CASE',
        caseId,
        experience: nextExperience,
        attempt:
          nextExperience === 'practice' ? nextCaseAttempt(progress, caseId, state.deviceId) : 1,
        deviceId: state.deviceId,
      })
    },
    [experience, hydrated, progress, state.deviceId],
  )

  const confirmDeviceChange = () => {
    if (!requestedDeviceId || requestedDeviceId === state.deviceId) {
      setRequestedDeviceId(null)
      return
    }
    const previousDeviceId = state.deviceId
    const attempt =
      experience === 'practice' ? nextCaseAttempt(progress, state.caseId, requestedDeviceId) : 1
    const nextProgress = setLastDevice(progress, requestedDeviceId)
    setProgress(nextProgress)
    if (hydrated) writeProgress(nextProgress)
    dispatch({ type: 'CHANGE_DEVICE', deviceId: requestedDeviceId, attempt })
    setWorkspaceView('case')
    setRequestedDeviceId(null)
    recordSiteModuleEvent({
      eventType: 'module_interaction',
      moduleId: MODULE_ID,
      section: definition.stationId,
      eventPayload: {
        interaction: 'device_changed',
        fromDeviceId: previousDeviceId,
        deviceId: requestedDeviceId,
        caseId: state.caseId,
        pathway: experience,
      },
    })
  }

  const switchExperience = (nextExperience: LearningExperience) => {
    setExperience(nextExperience)
    loadCase(state.caseId, nextExperience)
    recordSiteModuleEvent({
      eventType: 'module_interaction',
      moduleId: MODULE_ID,
      section: nextExperience,
      eventPayload: {
        caseId: state.caseId,
        deviceId: state.deviceId,
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
        const next = recordCaseResult(current, {
          caseId: definition.id,
          deviceId: state.deviceId,
          outcome,
        })
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
          deviceId: state.deviceId,
          station: definition.stationId,
          pathway: 'practice',
          completion: true,
          score: outcome.score,
          errorCount: outcome.criticalErrors.length,
        },
      })
    },
    [completedCount, definition.id, definition.stationId, state.deviceId],
  )

  return (
    <main
      className={styles.moduleRoot}
      data-publication={mechanicalVentilationPublicationStatus}
      data-device={state.deviceId}
    >
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
          <h1>Mechanical ventilation Learn & Practice simulator</h1>
          <p>
            Read the patient, commit to a mechanism, then practice on a functional{' '}
            {deviceProfile.displayName} training facsimile and prove the response with waveforms,
            mechanics, gas exchange, examination, and comfort.
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
            <BookOpenCheck aria-hidden="true" /> {deviceProfile.shortName} orientation
          </span>
          <ol>
            {deviceProfile.orientationSteps.map((step, index) => (
              <li key={step}>
                <strong>{index + 1}.</strong> {step}
              </li>
            ))}
          </ol>
        </div>
      </header>

      <div className={styles.disclaimerBanner} role="note">
        <ShieldAlert aria-hidden="true" />
        <p>
          <strong>Training only.</strong> Not a clinical device, validated digital twin, treatment
          recommendation, or substitute for the operator’s manual and local supervised practice. Not
          manufactured, sponsored, or endorsed by {deviceProfile.manufacturer}.
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

      <section className={styles.deviceSelector} aria-labelledby="ventilator-selector-heading">
        <div>
          <span>Ventilator library</span>
          <h2 id="ventilator-selector-heading">Choose a training console</h2>
          <p>
            The patient model and clinical scoring stay shared. Changing consoles reloads this case
            from a clean baseline.
          </p>
        </div>
        <div className={styles.deviceChoices} role="radiogroup" aria-label="Ventilator profile">
          {ventilatorDeviceProfiles.map((profile) => (
            <button
              type="button"
              role="radio"
              aria-label={`${profile.displayName}, ${profile.softwareVersion} · ${profile.modeLabels[state.ventilator.settings.mode]}`}
              aria-checked={state.deviceId === profile.id}
              data-device-id={profile.id}
              data-selected={state.deviceId === profile.id}
              key={profile.id}
              onClick={() => {
                if (profile.id !== state.deviceId) setRequestedDeviceId(profile.id)
              }}
            >
              <span>{profile.manufacturer}</span>
              <strong>{profile.displayName}</strong>
              <small>
                {profile.softwareVersion} · {profile.modeLabels[state.ventilator.settings.mode]}
              </small>
            </button>
          ))}
        </div>
      </section>

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

      <section
        className={styles.caseWorkspace}
        data-compact-view={workspaceView}
        aria-label="Active clinical case workspace"
      >
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

        <div
          className={styles.workspaceViewToggle}
          role="group"
          aria-label="Choose case workspace surface"
        >
          <button
            type="button"
            aria-pressed={workspaceView === 'case'}
            onClick={() => setWorkspaceView('case')}
          >
            <ClipboardCheck aria-hidden="true" /> Case guidance
          </button>
          <button
            type="button"
            aria-pressed={workspaceView === 'vent'}
            onClick={() => setWorkspaceView('vent')}
          >
            <Activity aria-hidden="true" /> Vent + patient
          </button>
        </div>

        <section className={styles.workflowColumn} aria-label="Case guidance and interventions">
          <CaseWorkflow
            key={`${state.caseId}:${experience}:${state.deviceId}`}
            state={state}
            definition={definition}
            dispatch={dispatch}
            onResult={handleResult}
          />
          <aside className={styles.workflowNotes} aria-label="Simulation principles">
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
                  Accepted paths can differ if the safety priority, mechanism, response direction,
                  and reassessment are sound.
                </p>
              </div>
            </section>
            <section>
              <Wind aria-hidden="true" />
              <div>
                <strong>{deviceProfile.shortName} vocabulary is deliberate</strong>
                <p>
                  Volume A/C is labeled {deviceProfile.modeLabels['volume-ac']}; pressure A/C is{' '}
                  {deviceProfile.modeLabels['pressure-ac']}; CPAP/pressure support is{' '}
                  {deviceProfile.modeLabels['pressure-support']}.
                </p>
              </div>
            </section>
          </aside>
        </section>

        <section
          className={styles.liveWorkspace}
          aria-label="Persistent ventilator and patient physiology"
        >
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
          <BedsidePanel state={state} definition={definition} compact />
          <MechanicalVentilatorConsole
            key={`${state.deviceId}:${state.ventilator.settings.mode}`}
            state={state}
            dispatch={dispatch}
            controlsEnabled={controlsEnabled}
          />
          <CalibrationPanel definition={definition} state={state} />
        </section>
      </section>

      <SourcesPanel deviceId={state.deviceId} />

      {requestedDeviceId ? (
        <div
          className={styles.deviceDialogBackdrop}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setRequestedDeviceId(null)
          }}
        >
          <section
            className={styles.deviceDialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="device-change-heading"
            aria-describedby="device-change-description"
          >
            <span>Reset required</span>
            <h2 id="device-change-heading">
              Switch to {getVentilatorDeviceProfile(requestedDeviceId).displayName}?
            </h2>
            <p id="device-change-description">
              The current case will restart at time zero. Shared mastery and completed-case progress
              will be preserved.
            </p>
            <div>
              <button type="button" onClick={() => setRequestedDeviceId(null)}>
                Keep {deviceProfile.shortName}
              </button>
              <button type="button" autoFocus onClick={confirmDeviceChange}>
                Switch and reset case
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
