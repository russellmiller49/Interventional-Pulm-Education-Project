'use client'

import { useEffect, useReducer, useRef, useState } from 'react'
import { Check, LockKeyhole } from 'lucide-react'

import { recordSiteModuleEvent } from '@/lib/analytics'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'

import {
  MCS_ANALYTICS_MODULE_ID,
  isMcsCapstoneUnlocked,
  mcsCapstoneScenarios,
  mcsLessons,
  mcsPracticeScenarios,
  remainingMcsCapstoneRequirements,
} from '../content'
import {
  createDefaultMcsProgress,
  createInitialMcsState,
  mcsProgressPercent,
  mcsReducer,
  readMcsProgress,
  recordMcsLessonComplete,
  recordMcsScenarioResult,
  writeMcsProgress,
  type McsDeviceKind,
  type McsModuleSection,
  type McsProgressV1,
} from '../engine'
import { McsAnatomy3D } from './McsAnatomy3D'
import { McsCaseWorkflow } from './McsCaseWorkflow'
import { McsControls } from './McsControls'
import { McsModuleFrame } from './McsModuleFrame'
import { McsMonitor } from './McsMonitor'
import { McsSourcesPanel } from './McsSourcesPanel'
import styles from './mechanical-circulatory-support.module.css'

const deviceLabels: Record<McsDeviceKind, { short: string; title: string; mechanism: string }> = {
  iabp: { short: 'IABP', title: 'Intra-aortic balloon pump', mechanism: 'Counterpulsation' },
  impella: { short: 'Impella', title: 'Impella CP family', mechanism: 'LV-to-aorta unloading' },
  lvad: {
    short: 'LVAD',
    title: 'Durable continuous-flow LVAD',
    mechanism: 'Apical continuous flow',
  },
}

type MobileSurface = 'anatomy' | 'monitor' | 'controls'

function scoreBand(score: number | null) {
  if (score === null) return 'not-scored'
  if (score >= 80) return '80-100'
  if (score >= 60) return '60-79'
  return 'below-60'
}

export function McsWorkbench({
  section,
  locale = 'en',
}: {
  section: McsModuleSection
  locale?: string
}) {
  const [state, dispatch] = useReducer(mcsReducer, undefined, () =>
    createInitialMcsState(section, 'iabp'),
  )
  const [progress, setProgress] = useState<McsProgressV1>(createDefaultMcsProgress)
  const [progressLoaded, setProgressLoaded] = useState(false)
  const [selectedLessonId, setSelectedLessonId] = useState(mcsLessons[0].id)
  const [selectedActivityId, setSelectedActivityId] = useState(
    section === 'practice' ? 'studio' : section === 'learn' ? mcsLessons[0].id : 'CAP-IABP-01',
  )
  const [mobileSurface, setMobileSurface] = useState<MobileSurface>('anatomy')
  const recordedCompletion = useRef<string | null>(null)
  const activeHref = `${mechanicalCirculatorySupportNavBase}/${section}`
  const lesson = mcsLessons.find((candidate) => candidate.id === selectedLessonId) ?? mcsLessons[0]
  const revealCausality = section !== 'assess' || state.completed

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProgress(readMcsProgress())
      setProgressLoaded(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const intervalMs = reducedMotion ? 250 : 100
    const timer = window.setInterval(
      () => dispatch({ type: 'TICK', seconds: intervalMs / 1000 }),
      intervalMs,
    )
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    recordSiteModuleEvent({
      eventType: state.completed ? 'section_completed' : 'module_interaction',
      moduleId: MCS_ANALYTICS_MODULE_ID,
      section,
      percentComplete: mcsProgressPercent(progress),
      eventPayload: {
        deviceTrack: state.deviceKind,
        station: selectedActivityId,
        completion: state.completed ? 'complete' : 'in-progress',
        scoreBand: scoreBand(state.score?.total ?? null),
      },
    })
  }, [progress, section, selectedActivityId, state.completed, state.deviceKind, state.score?.total])

  useEffect(() => {
    if (!progressLoaded || !state.completed || !state.scenario || !state.score) {
      if (!state.completed) recordedCompletion.current = null
      return
    }
    const key = `${state.scenario.id}:${state.score.total}:${state.criticalErrors.length}`
    if (recordedCompletion.current === key) return
    recordedCompletion.current = key
    const timer = window.setTimeout(() => {
      setProgress((current) => {
        const next = recordMcsScenarioResult(current, state)
        writeMcsProgress(next)
        return next
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [progressLoaded, state])

  function openStudio(device: McsDeviceKind) {
    setSelectedActivityId('studio')
    dispatch({ type: 'OPEN_STUDIO', device })
  }

  function selectDevice(device: McsDeviceKind) {
    if (section === 'practice') return openStudio(device)
    if (section === 'assess') {
      const capstone = mcsCapstoneScenarios.find((candidate) => candidate.device === device)
      if (!capstone) return
      setSelectedActivityId(capstone.id)
      if (isMcsCapstoneUnlocked(progress, device))
        dispatch({ type: 'LOAD_SCENARIO', scenario: capstone })
      else dispatch({ type: 'OPEN_STUDIO', device })
      return
    }
    const deviceLesson = mcsLessons.find((candidate) => candidate.device === device)
    if (deviceLesson) {
      setSelectedLessonId(deviceLesson.id)
      setSelectedActivityId(deviceLesson.id)
    }
    dispatch({ type: 'OPEN_STUDIO', device })
  }

  function chooseLesson(id: string) {
    const next = mcsLessons.find((candidate) => candidate.id === id)
    if (!next) return
    setSelectedLessonId(id)
    setSelectedActivityId(id)
    if (next.device !== 'shared') dispatch({ type: 'OPEN_STUDIO', device: next.device })
  }

  function completeLesson() {
    const device = lesson.device === 'shared' ? state.deviceKind : lesson.device
    setProgress((current) => {
      const next = recordMcsLessonComplete(current, lesson.id, device)
      writeMcsProgress(next)
      return next
    })
  }

  function choosePractice(id: string) {
    if (id === 'studio') return openStudio(state.deviceKind)
    const scenario = mcsPracticeScenarios.find((candidate) => candidate.id === id)
    if (!scenario) return
    setSelectedActivityId(id)
    dispatch({ type: 'LOAD_SCENARIO', scenario })
  }

  const devicePractice = mcsPracticeScenarios.filter(
    (scenario) => scenario.device === state.deviceKind,
  )
  const capstone = mcsCapstoneScenarios.find((scenario) => scenario.device === state.deviceKind)
  const capstoneUnlocked = isMcsCapstoneUnlocked(progress, state.deviceKind)
  const remaining = remainingMcsCapstoneRequirements(progress, state.deviceKind)

  return (
    <McsModuleFrame locale={locale} activeHref={activeHref}>
      <section className={styles.workbenchHero}>
        <div>
          <span className={styles.kicker}>{section.toUpperCase()} WORKSPACE</span>
          <h1>
            {section === 'learn'
              ? 'Build the mechanism'
              : section === 'practice'
                ? 'Explain, change, and reassess'
                : 'Demonstrate safe transfer'}
          </h1>
          <p>
            {section === 'learn'
              ? 'Guided, unscored lessons keep causal feedback visible.'
              : section === 'practice'
                ? 'Nine scored cases reveal causal coaching after you commit.'
                : 'One unseen capstone per device with hints withheld. Mastery requires ≥80% and no critical safety error.'}
          </p>
        </div>
        <aside>
          <strong>{mcsProgressPercent(progress)}%</strong>
          <span>saved module progress</span>
          <small>
            {progress.completedLessonIds.length}/8 lessons · {progress.masteredCaseIds.length}/9
            cases mastered
          </small>
        </aside>
      </section>

      <nav className={styles.deviceTabs} aria-label="Choose device track">
        {(Object.keys(deviceLabels) as McsDeviceKind[]).map((device) => (
          <button
            key={device}
            type="button"
            aria-pressed={state.deviceKind === device}
            onClick={() => selectDevice(device)}
          >
            <span>{deviceLabels[device].short}</span>
            <strong>{deviceLabels[device].title}</strong>
            <small>{deviceLabels[device].mechanism}</small>
          </button>
        ))}
      </nav>

      {section === 'learn' ? (
        <section className={styles.activityRail} aria-label="Eight guided lessons">
          {mcsLessons.map((candidate, index) => (
            <button
              type="button"
              key={candidate.id}
              aria-current={selectedLessonId === candidate.id ? 'true' : undefined}
              data-complete={progress.completedLessonIds.includes(candidate.id)}
              onClick={() => chooseLesson(candidate.id)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{candidate.title}</strong>
              <small>
                {candidate.device === 'shared'
                  ? 'Shared foundation'
                  : deviceLabels[candidate.device].short}
                {progress.completedLessonIds.includes(candidate.id) ? ' · complete' : ''}
              </small>
            </button>
          ))}
        </section>
      ) : section === 'practice' ? (
        <section className={styles.activityRail} aria-label="Mechanism Studio and device cases">
          <button
            type="button"
            aria-current={selectedActivityId === 'studio' ? 'true' : undefined}
            onClick={() => choosePractice('studio')}
          >
            <span>00</span>
            <strong>Mechanism Studio</strong>
            <small>Open · unscored</small>
          </button>
          {devicePractice.map((scenario, index) => (
            <button
              type="button"
              key={scenario.id}
              aria-current={selectedActivityId === scenario.id ? 'true' : undefined}
              data-complete={progress.masteredCaseIds.includes(scenario.id)}
              onClick={() => choosePractice(scenario.id)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{scenario.shortTitle}</strong>
              <small>
                {progress.masteredCaseIds.includes(scenario.id)
                  ? `Mastered · ${progress.bestScores[scenario.id]}%`
                  : progress.completedCaseIds.includes(scenario.id)
                    ? `Best ${progress.bestScores[scenario.id]}%`
                    : 'Practice case'}
              </small>
            </button>
          ))}
        </section>
      ) : (
        <section className={styles.capstoneGate} data-unlocked={capstoneUnlocked}>
          <div>
            {capstoneUnlocked ? <Check aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
          </div>
          <div>
            <span className={styles.kicker}>{capstone?.id}</span>
            <h2>{capstone?.title}</h2>
            <p>
              {capstoneUnlocked
                ? 'Capstone unlocked. Coaching remains hidden until your debrief.'
                : `Complete the two shared foundations, this device’s two lessons, and all three practice cases. ${remaining.length} requirement${remaining.length === 1 ? '' : 's'} remain.`}
            </p>
          </div>
          <button
            type="button"
            disabled={!capstoneUnlocked || !capstone}
            onClick={() => {
              if (capstone) {
                setSelectedActivityId(capstone.id)
                dispatch({ type: 'LOAD_SCENARIO', scenario: capstone })
              }
            }}
          >
            Start capstone
          </button>
        </section>
      )}

      {section === 'learn' ? (
        <section className={styles.lessonCard}>
          <div>
            <span className={styles.kicker}>
              {lesson.device === 'shared' ? 'SHARED FOUNDATION' : deviceLabels[lesson.device].title}
            </span>
            <h2>{lesson.title}</h2>
            <p>{lesson.summary}</p>
            <ul>
              {lesson.objectives.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ul>
          </div>
          <ol>
            {lesson.steps.map((step, index) => (
              <li key={step.id}>
                <span>{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.instruction}</p>
                  <small>
                    <strong>Why:</strong> {step.rationale}
                  </small>
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            data-complete={progress.completedLessonIds.includes(lesson.id)}
            onClick={completeLesson}
          >
            {progress.completedLessonIds.includes(lesson.id) ? (
              <>
                <Check aria-hidden="true" /> Lesson complete
              </>
            ) : (
              'Mark lesson complete'
            )}
          </button>
        </section>
      ) : null}

      <div
        className={styles.mobileSurfaceTabs}
        role="group"
        aria-label="Choose mobile workspace surface"
      >
        {(['anatomy', 'monitor', 'controls'] as const).map((surface) => (
          <button
            type="button"
            key={surface}
            aria-pressed={mobileSurface === surface}
            onClick={() => setMobileSurface(surface)}
          >
            {surface}
          </button>
        ))}
      </div>
      <section className={styles.simulationGrid} aria-label="Synchronized support simulation">
        <div data-mobile-visible={mobileSurface === 'anatomy'}>
          <McsAnatomy3D state={state} revealCausality={revealCausality} />
        </div>
        <div data-mobile-visible={mobileSurface === 'monitor'}>
          <McsMonitor state={state} revealCausality={revealCausality} />
        </div>
      </section>
      <section className={styles.taskGrid} data-mobile-visible={mobileSurface === 'controls'}>
        <McsCaseWorkflow state={state} dispatch={dispatch} />
        <McsControls state={state} dispatch={dispatch} />
      </section>

      <section className={styles.privacyNote}>
        <strong>Privacy boundary</strong>
        <span>
          This module sends only device track, station, completion state, and score band.
          Physiologic traces, pressures, detailed action histories, and free text remain in the
          browser.
        </span>
      </section>
      <McsSourcesPanel />
    </McsModuleFrame>
  )
}
