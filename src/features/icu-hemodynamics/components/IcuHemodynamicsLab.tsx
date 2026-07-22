'use client'

import { useEffect, useReducer, useRef, useState } from 'react'

import {
  hemodynamicCaseById,
  hemodynamicCases,
  ICU_HEMODYNAMICS_ANALYTICS_MODULE_ID,
  ICU_HEMODYNAMICS_CONTENT_VERSION,
  ICU_HEMODYNAMICS_RELEASE_STAGE,
} from '../content'
import {
  createDefaultIcuHemodynamicsProgress,
  createInitialHemodynamicState,
  icuHemodynamicsReducer,
  readIcuHemodynamicsProgress,
  recordIcuHemodynamicsResult,
  updateIcuHemodynamicsLocation,
  writeIcuHemodynamicsProgress,
  type HemodynamicLearningMode,
  type IcuHemodynamicsProgressV2,
} from '../engine'
import { recordSiteModuleEvent } from '@/lib/analytics'
import { BedsideMonitor } from './BedsideMonitor'
import { CaseWorkflow } from './CaseWorkflow'
import { FormulaDrawer } from './FormulaDrawer'
import { PacActionDock } from './PacActionDock'
import { PacSkillsLab } from './PacSkillsLab'
import { PhysiologyPanel } from './PhysiologyPanel'
import { SourcesPanel } from './SourcesPanel'
import styles from './icu-hemodynamics.module.css'

interface IcuHemodynamicsLabProps {
  locale?: string
}

type MobileSurface = 'monitor' | 'physiology' | 'tasks'

function percentMastered(progress: IcuHemodynamicsProgressV2): number {
  return Math.round((progress.masteredCaseIds.length / hemodynamicCases.length) * 100)
}

export default function IcuHemodynamicsLab({ locale = 'en' }: IcuHemodynamicsLabProps) {
  const [state, dispatch] = useReducer(icuHemodynamicsReducer, undefined, () => {
    const initial = createInitialHemodynamicState(hemodynamicCases[0], 'learn')
    return icuHemodynamicsReducer(initial, {
      type: 'SET_CATHETER_POSITION',
      position: 'introducer',
    })
  })
  const [progress, setProgress] = useState(createDefaultIcuHemodynamicsProgress)
  const [mobileSurface, setMobileSurface] = useState<MobileSurface>('monitor')
  const [progressLoaded, setProgressLoaded] = useState(false)
  const completionRecorded = useRef(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readIcuHemodynamicsProgress()
      setProgress(saved)
      setProgressLoaded(true)
      const savedCase = hemodynamicCaseById.get(saved.lastStation)
      if (savedCase) dispatch({ type: 'RESET_CASE', definition: savedCase, seed: 417 })
      dispatch({ type: 'SET_WORKSPACE', workspace: saved.lastWorkspace })
      if (saved.lastWorkspace === 'pac-skills') {
        dispatch({ type: 'SET_CATHETER_POSITION', position: 'introducer' })
      }
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
      eventType: 'module_interaction',
      moduleId: ICU_HEMODYNAMICS_ANALYTICS_MODULE_ID,
      section: state.workspace,
      percentComplete: percentMastered(progress),
      eventPayload: {
        caseId: state.caseId,
        pathway: state.mode,
        workspace: state.workspace,
        completion: state.completed,
        score: state.score?.total ?? null,
        criticalErrorCount: state.criticalErrors.length,
        contentVersion: ICU_HEMODYNAMICS_CONTENT_VERSION,
      },
    })
  }, [
    progress,
    state.caseId,
    state.completed,
    state.criticalErrors.length,
    state.mode,
    state.score?.total,
    state.workspace,
  ])

  useEffect(() => {
    if (!state.completed) {
      completionRecorded.current = false
      return
    }
    if (!state.score || completionRecorded.current || !progressLoaded) return
    completionRecorded.current = true
    const next = recordIcuHemodynamicsResult(progress, {
      caseId: state.caseId,
      score: state.score,
      criticalErrorCount: state.criticalErrors.length,
    })
    writeIcuHemodynamicsProgress(next)
    const timer = window.setTimeout(() => setProgress(next), 0)
    return () => window.clearTimeout(timer)
  }, [
    progress,
    progressLoaded,
    state.caseId,
    state.completed,
    state.criticalErrors.length,
    state.score,
  ])

  function selectCase(caseId: string) {
    const definition = hemodynamicCaseById.get(caseId)
    if (!definition) return
    dispatch({ type: 'RESET_CASE', definition, seed: state.seed + 1 })
    setProgress((current) => {
      const next = updateIcuHemodynamicsLocation(current, caseId, 'cases')
      writeIcuHemodynamicsProgress(next)
      return next
    })
    dispatch({ type: 'SET_WORKSPACE', workspace: 'cases' })
    setMobileSurface('tasks')
  }

  function setWorkspace(workspace: 'pac-skills' | 'cases') {
    dispatch({ type: 'SET_WORKSPACE', workspace })
    if (workspace === 'pac-skills') {
      dispatch({ type: 'SET_CATHETER_POSITION', position: 'introducer' })
    }
    setProgress((current) => {
      const next = updateIcuHemodynamicsLocation(current, state.caseId, workspace)
      writeIcuHemodynamicsProgress(next)
      return next
    })
  }

  function setMode(mode: HemodynamicLearningMode) {
    dispatch({ type: 'SET_MODE', mode })
  }

  function openCardiacOutput() {
    const embedded = document.getElementById('case-measurement-lab')
    if (embedded instanceof HTMLDetailsElement) embedded.open = true
    window.setTimeout(
      () =>
        document
          .getElementById('cardiac-output-lab')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0,
    )
  }

  return (
    <main className={styles.labShell}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.heroBadges}>
            <span>Adult · English-first</span>
            <span data-preview>{ICU_HEMODYNAMICS_RELEASE_STAGE.replace('-', ' ')}</span>
            <span>50 Hz deterministic engine</span>
          </div>
          <p className={styles.eyebrow}>ICU PHYSIOLOGY · PAC SKILLS · MANAGEMENT CASES</p>
          <h1>ICU Hemodynamics Lab</h1>
          <p>
            Read the signal, build the mechanism, test a management choice, and watch pressure,
            flow, and catheter waveforms respond together.
          </p>
          <div className={styles.heroStats}>
            <div>
              <strong>8</strong>
              <span>management cases</span>
            </div>
            <div>
              <strong>8</strong>
              <span>synchronized traces</span>
            </div>
            <div>
              <strong>80%</strong>
              <span>mastery + no critical error</span>
            </div>
          </div>
        </div>
        <aside className={styles.orientationCard}>
          <span>How to use the lab</span>
          <ol>
            <li>
              <strong>01</strong>
              <span>Validate level, zero, dynamic response, and catheter position.</span>
            </li>
            <li>
              <strong>02</strong>
              <span>
                Commit to a mechanism and immediate priority before treatment in Practice.
              </span>
            </li>
            <li>
              <strong>03</strong>
              <span>Intervene in bounded relative tiers and observe the delayed response.</span>
            </li>
            <li>
              <strong>04</strong>
              <span>Reassess perfusion, flow, congestion, and safety—not one number alone.</span>
            </li>
          </ol>
        </aside>
      </section>

      <section
        className={styles.disclaimerBanner}
        role="note"
        aria-label="Educational safety boundary"
      >
        <span aria-hidden="true">!</span>
        <p>
          <strong>Educational model—not a clinical device.</strong> This original, vendor-neutral
          simulator is not a validated digital twin, dosing guide, or source of patient-specific
          advice. It does not replace bedside examination, echocardiography, institutional
          protocols, manufacturer instructions, expert supervision, or definitive clinical judgment.
        </p>
      </section>
      {locale !== 'en' && (
        <section className={styles.languageFallback}>
          <strong>Reviewed-English fallback:</strong> This preview is English-first while localized
          clinical review is pending.
        </section>
      )}

      <nav className={styles.experienceBar} aria-label="Learning pathway">
        <div role="tablist" aria-label="Choose workspace">
          <button
            type="button"
            role="tab"
            aria-selected={state.workspace === 'pac-skills'}
            onClick={() => setWorkspace('pac-skills')}
          >
            PAC skills lab
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={state.workspace === 'cases'}
            onClick={() => setWorkspace('cases')}
          >
            Eight cases
          </button>
        </div>
        <div role="tablist" aria-label="Choose learning mode">
          <button
            type="button"
            role="tab"
            aria-selected={state.mode === 'learn'}
            onClick={() => setMode('learn')}
          >
            Learn
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={state.mode === 'practice'}
            onClick={() => setMode('practice')}
          >
            Practice
          </button>
        </div>
        <div className={styles.masterySummary}>
          <strong>
            {progress.masteredCaseIds.length}/{hemodynamicCases.length}
          </strong>
          <span>mastered</span>
        </div>
      </nav>

      {state.workspace === 'cases' && (
        <section className={styles.caseRail} aria-label="Hemodynamic cases">
          {hemodynamicCases.map((definition, index) => {
            const selected = definition.id === state.caseId
            const mastered = progress.masteredCaseIds.includes(definition.id)
            return (
              <button
                key={definition.id}
                type="button"
                aria-current={selected ? 'true' : undefined}
                onClick={() => selectCase(definition.id)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{definition.shortTitle}</strong>
                <small>
                  {mastered
                    ? `Mastered · ${progress.bestScores[definition.id]}%`
                    : progress.completedCaseIds.includes(definition.id)
                      ? `Best ${progress.bestScores[definition.id]}%`
                      : definition.station.replaceAll('-', ' ')}
                </small>
              </button>
            )
          })}
        </section>
      )}

      <div
        className={styles.mobileSurfaceTabs}
        role="group"
        aria-label="Choose mobile workspace surface"
      >
        {(['monitor', 'physiology', 'tasks'] as const).map((surface) => (
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

      <section
        className={styles.liveWorkspace}
        aria-label="Synchronized monitor, anatomy, and PAC controls"
      >
        <div className={styles.monitorPane} data-mobile-visible={mobileSurface === 'monitor'}>
          <BedsideMonitor
            state={state}
            dispatch={dispatch}
            onOpenCardiacOutput={openCardiacOutput}
          />
        </div>
        <div className={styles.physiologyPane} data-mobile-visible={mobileSurface === 'physiology'}>
          <PhysiologyPanel state={state} dispatch={dispatch} />
        </div>
        <PacActionDock state={state} dispatch={dispatch} />

        <div className={styles.taskPane} data-mobile-visible={mobileSurface === 'tasks'}>
          {state.workspace === 'pac-skills' ? (
            <PacSkillsLab state={state} dispatch={dispatch} />
          ) : (
            <>
              <CaseWorkflow state={state} dispatch={dispatch} />
              <details className={styles.embeddedMeasurementLab} id="case-measurement-lab">
                <summary>Open the reusable PAC measurement lab for this case</summary>
                <PacSkillsLab state={state} dispatch={dispatch} />
              </details>
            </>
          )}
          <FormulaDrawer state={state} dispatch={dispatch} />
        </div>
      </section>

      <section className={styles.reviewGate}>
        <span>Preview review gate</span>
        <p>
          The preview badge remains until an ICU/PAC subject-matter reviewer signs off on waveform
          morphology, ranges, intervention directions, thermodilution behavior, derived equations,
          case solutions, and safety-critical errors.
        </p>
      </section>
      <SourcesPanel />
    </main>
  )
}
