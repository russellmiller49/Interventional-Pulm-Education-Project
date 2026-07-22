'use client'

import { useCallback, useEffect, useMemo, useState, type Dispatch } from 'react'
import dynamic from 'next/dynamic'
import type { Route } from 'next'
import type {
  Activity} from 'lucide-react';
import {
  ArrowLeft,
  BookOpenCheck,
  Boxes,
  ChevronRight,
  ClipboardCheck,
  FlaskConical,
  Gauge,
  MonitorDot,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Stethoscope,
} from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { ICU_SIMULATION_RELEASE, getIcuScenario, icuScenarios } from '../content'
import {
  applyIcuCommand,
  createIcuSimulation,
  type IcuCommand,
  type IcuScenarioDefinition,
  type IcuScenarioId,
  type IcuSimulationMode,
  type IcuSimulationState,
} from '../engine'
import {
  IcuAlarmCenter,
  IcuCarePanel,
  IcuCaseGuide,
  IcuDiagnosticsPanel,
  IcuSourceNotes,
  IcuTimelinePanel,
} from './IcuClinicalPanels'
import { IcuDevicePanels } from './IcuDevicePanels'
import { IcuPatientMonitor } from './IcuPatientMonitor'
import styles from './icu-simulation.module.css'

const IcuBedsideScene = dynamic(
  () => import('./IcuBedsideScene').then((module) => module.IcuBedsideScene),
  {
    ssr: false,
    loading: () => (
      <div className={styles.sceneLoading} role="status">
        Loading optional 3D bedside…
      </div>
    ),
  },
)

export interface IcuSimulatorLabProps {
  mode: IcuSimulationMode
  locale?: string
  initialScenarioId?: IcuScenarioId
}

type MobileSurface = 'monitor' | 'clinical' | 'devices' | 'course'
type SimulationSpeed = 1 | 5 | 30

const modeCopy: Readonly<
  Record<
    IcuSimulationMode,
    {
      eyebrow: string
      title: string
      description: string
      status: string
      Icon: typeof BookOpenCheck
    }
  >
> = {
  learn: {
    eyebrow: 'Guided integrated learning',
    title: 'See how the systems connect',
    description:
      'Causal coaching stays visible while you assess the patient, start support, advance time, and close the reassessment loop.',
    status: 'Guidance visible · unscored orientation',
    Icon: BookOpenCheck,
  },
  practice: {
    eyebrow: 'Coached longitudinal cases',
    title: 'Run the full ICU course',
    description:
      'Work through evolving shock, organ support, and device problems. Checkpoints reward mechanism, prioritization, and reassessment.',
    status: 'Hints available · scored practice',
    Icon: Stethoscope,
  },
  assess: {
    eyebrow: 'Seeded assessment variants',
    title: 'Demonstrate safe clinical reasoning',
    description:
      'Coaching is withheld until the causal debrief. Mastery requires at least 80% and no critical safety error.',
    status: 'Coaching withheld · scored assessment',
    Icon: ClipboardCheck,
  },
  sandbox: {
    eyebrow: 'Bounded physiology exploration',
    title: 'Explore support interactions',
    description:
      'Begin from a reviewed synthetic preset and explore available interventions without a mastery score or exact action sequence.',
    status: 'No score · reviewed device combinations',
    Icon: FlaskConical,
  },
}

const surfaceCopy: Readonly<
  Record<MobileSurface, { label: string; detail: string; Icon: typeof Activity }>
> = {
  monitor: { label: 'Patient', detail: 'Monitor & bedside', Icon: MonitorDot },
  clinical: { label: 'Clinical', detail: 'Orders & actions', Icon: Stethoscope },
  devices: { label: 'Devices', detail: 'Support controls', Icon: Gauge },
  course: { label: 'Course', detail: 'Guide & trends', Icon: Boxes },
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3_600)
  const minutes = Math.floor((safe % 3_600) / 60)
  const remainingSeconds = safe % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function chooseInitialScenario(
  mode: IcuSimulationMode,
  initialScenarioId?: IcuScenarioId,
): IcuScenarioDefinition {
  const requested = initialScenarioId ? getIcuScenario(initialScenarioId) : undefined
  if (requested?.allowedModes.includes(mode)) return requested
  return icuScenarios.find((scenario) => scenario.allowedModes.includes(mode)) ?? icuScenarios[0]
}

function createSession(scenario: IcuScenarioDefinition, mode: IcuSimulationMode, seed = 41_701) {
  return createIcuSimulation(scenario, { mode, seed })
}

function modeHref(mode: IcuSimulationMode): Route {
  return `/icu-simulation/${mode}` as Route
}

export function IcuSimulatorLab({ mode, locale = 'en', initialScenarioId }: IcuSimulatorLabProps) {
  const availableScenarios = useMemo(
    () => icuScenarios.filter((scenario) => scenario.allowedModes.includes(mode)),
    [mode],
  )
  const initialScenario = useMemo(
    () => chooseInitialScenario(mode, initialScenarioId),
    [initialScenarioId, mode],
  )
  const [state, setState] = useState<IcuSimulationState>(() => createSession(initialScenario, mode))
  const [mobileSurface, setMobileSurface] = useState<MobileSurface>('monitor')
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState<SimulationSpeed>(1)
  const scenario = getIcuScenario(state.scenarioId) ?? initialScenario
  const copy = modeCopy[mode]
  const ModeIcon = copy.Icon
  const dispatch = useCallback<Dispatch<IcuCommand>>((command) => {
    setState((current) => {
      const currentScenario = getIcuScenario(current.scenarioId)
      if (!currentScenario) return current
      return applyIcuCommand(current, currentScenario, command)
    })
  }, [])

  useEffect(() => {
    if (state.mode === mode && getIcuScenario(state.scenarioId)?.allowedModes.includes(mode)) return
    const next = chooseInitialScenario(mode, initialScenarioId)
    setRunning(false)
    setState(createSession(next, mode, state.seed + 1))
  }, [initialScenarioId, mode, state.mode, state.scenarioId, state.seed])

  useEffect(() => {
    if (!running || state.phase === 'debrief') return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const intervalMs = reducedMotion ? 1_500 : 1_000
    const timer = window.setInterval(
      () => dispatch({ type: 'time.advance', seconds: speed }),
      intervalMs,
    )
    return () => window.clearInterval(timer)
  }, [dispatch, running, speed, state.phase])

  const selectScenario = useCallback(
    (nextScenario: IcuScenarioDefinition) => {
      setRunning(false)
      setState(createSession(nextScenario, mode, state.seed + 1))
      setMobileSurface('monitor')
    },
    [mode, state.seed],
  )

  const resetSession = useCallback(() => {
    setRunning(false)
    setState(createSession(scenario, mode, state.seed + 1))
  }, [mode, scenario, state.seed])

  const lastEvent = state.history.at(-1)
  const activeAlarmCount = state.alarms.filter((alarm) => alarm.active).length

  return (
    <main className={styles.labShell} data-mode={mode}>
      <header className={styles.labHero}>
        <div className={styles.labHeroCopy}>
          <Link href={'/icu-simulation' as Route} className={styles.backLink}>
            <ArrowLeft aria-hidden="true" /> ICU Simulator home
          </Link>
          <div className={styles.heroBadges}>
            <span>
              <ModeIcon aria-hidden="true" /> {mode}
            </span>
            <span data-preview="true">{ICU_SIMULATION_RELEASE.replaceAll('-', ' ')}</span>
            <span>Adult synthetic patients</span>
          </div>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <aside className={styles.sessionSummary} aria-labelledby="session-summary-title">
          <span className={styles.panelKicker}>Current session</span>
          <h2 id="session-summary-title">{scenario.shortTitle}</h2>
          <p>{scenario.summary}</p>
          <dl>
            <div>
              <dt>Course window</dt>
              <dd>{scenario.durationHours} h</dd>
            </div>
            <div>
              <dt>Active alarms</dt>
              <dd>{activeAlarmCount}</dd>
            </div>
            <div>
              <dt>Checkpoints</dt>
              <dd>
                {state.outcome.checkpointIdsCompleted.length}/{scenario.checkpoints.length}
              </dd>
            </div>
          </dl>
          <span className={styles.sessionModeNote}>{copy.status}</span>
        </aside>
      </header>

      <section className={styles.safetyBanner} role="note" aria-label="Educational safety boundary">
        <ShieldAlert aria-hidden="true" />
        <p>
          <strong>Educational simulation—not a clinical device, dosing guide, or protocol.</strong>{' '}
          All patients are synthetic and interventions are simplified. Real care requires current
          evidence, patient-specific assessment, institutional protocols, manufacturer instructions,
          multidisciplinary expertise, and clinical judgment.
        </p>
      </section>

      {locale !== 'en' ? (
        <p className={styles.languageFallback} role="status">
          Reviewed-English fallback: this private preview remains English-first while localized
          clinical review is pending.
        </p>
      ) : null}

      <nav className={styles.modeNav} aria-label="ICU Simulator learning mode">
        <div>
          {(Object.keys(modeCopy) as IcuSimulationMode[]).map((candidate) => (
            <Link
              href={modeHref(candidate)}
              key={candidate}
              aria-current={candidate === mode ? 'page' : undefined}
            >
              {candidate}
            </Link>
          ))}
        </div>
        <span>{copy.status}</span>
      </nav>

      <section className={styles.caseSelector} aria-labelledby="case-selector-title">
        <header>
          <div>
            <span className={styles.panelKicker}>Patient census</span>
            <h2 id="case-selector-title">Choose a shock course</h2>
          </div>
          <span>{availableScenarios.length} scenario families</span>
        </header>
        <div className={styles.caseRail} role="list">
          {availableScenarios.map((candidate, index) => {
            const selected = candidate.id === state.scenarioId
            return (
              <button
                type="button"
                role="listitem"
                key={candidate.id}
                aria-current={selected ? 'true' : undefined}
                onClick={() => selectScenario(candidate)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{candidate.shortTitle}</strong>
                <small>
                  {candidate.durationHours} h · {candidate.family.replaceAll('-', ' ')}
                </small>
                <ChevronRight aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </section>

      <section className={styles.timeDock} aria-label="Shared simulation clock">
        <div className={styles.clockReadout}>
          <span>SIMULATION TIME</span>
          <time>{formatClock(state.clock.elapsedSeconds)}</time>
        </div>
        <div className={styles.transportControls}>
          <button
            type="button"
            aria-pressed={running}
            disabled={state.phase === 'debrief'}
            onClick={() => setRunning((value) => !value)}
          >
            {running ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {running ? 'Pause' : 'Run'}
          </button>
          <label>
            <span>Speed</span>
            <select
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value) as SimulationSpeed)}
            >
              <option value={1}>1×</option>
              <option value={5}>5×</option>
              <option value={30}>30×</option>
            </select>
          </label>
          <button
            type="button"
            disabled={state.phase === 'debrief'}
            onClick={() => dispatch({ type: 'time.advance', seconds: 60 })}
          >
            +1 min
          </button>
          <button
            type="button"
            disabled={state.phase === 'debrief'}
            onClick={() => dispatch({ type: 'time.advance', seconds: 900 })}
          >
            +15 min
          </button>
          <button type="button" onClick={resetSession}>
            <RotateCcw aria-hidden="true" /> Reset
          </button>
        </div>
        <p className={styles.srOnly} aria-live="polite">
          {lastEvent
            ? `${formatClock(lastEvent.elapsedSeconds)}: ${lastEvent.label}`
            : 'Session ready'}
        </p>
      </section>

      <IcuAlarmCenter state={state} dispatch={dispatch} />

      <nav className={styles.mobileSurfaceNav} aria-label="Choose bedside workspace">
        {(Object.keys(surfaceCopy) as MobileSurface[]).map((surface) => {
          const item = surfaceCopy[surface]
          const Icon = item.Icon
          return (
            <button
              type="button"
              key={surface}
              aria-pressed={mobileSurface === surface}
              onClick={() => setMobileSurface(surface)}
            >
              <Icon aria-hidden="true" />
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
            </button>
          )
        })}
      </nav>

      <div className={styles.workspace}>
        <section
          className={styles.workspaceSurface}
          data-surface="monitor"
          data-mobile-visible={mobileSurface === 'monitor'}
          aria-label="Patient monitor and bedside overview"
        >
          <IcuPatientMonitor state={state} />
          <IcuBedsideScene state={state} />
        </section>

        <section
          className={styles.workspaceSurface}
          data-surface="clinical"
          data-mobile-visible={mobileSurface === 'clinical'}
          aria-label="Diagnostic and care actions"
        >
          <IcuDiagnosticsPanel state={state} scenario={scenario} dispatch={dispatch} />
          <IcuCarePanel state={state} scenario={scenario} dispatch={dispatch} />
        </section>

        <section
          className={styles.workspaceSurface}
          data-surface="devices"
          data-mobile-visible={mobileSurface === 'devices'}
          aria-label="Device controls"
        >
          <IcuDevicePanels state={state} scenario={scenario} dispatch={dispatch} />
        </section>

        <section
          className={styles.workspaceSurface}
          data-surface="course"
          data-mobile-visible={mobileSurface === 'course'}
          aria-label="Course guide and trends"
        >
          <IcuCaseGuide state={state} scenario={scenario} mode={mode} dispatch={dispatch} />
          <IcuTimelinePanel state={state} />
        </section>
      </div>

      <IcuSourceNotes scenario={scenario} />
    </main>
  )
}
