'use client'

import { useEffect, useState } from 'react'
import type { Route } from 'next'
import { ArrowRight } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { mechanicalVentilationCaseById, mechanicalVentilationCases } from '../content/runtimeCases'
import { ventilatorDeviceProfiles } from '../content/deviceProfiles'
import {
  ventilationLearningUnits,
  ventilationPracticeOrder,
  ventilationUnitById,
  ventilationUnitHref,
} from '../content/learningCurriculum'
import {
  createDefaultProgress,
  readProgress,
  setLastDevice,
  writeProgress,
} from '../engine/progress'
import type { VentilatorDeviceId } from '../engine/types'
import styles from './ventilation-course.module.css'

export function MechanicalVentilationCoursePractice({
  focus,
  compatibilityNotice,
}: {
  readonly focus?: string
  readonly compatibilityNotice?: string
}) {
  const [history, setHistory] = useState(createDefaultProgress)
  const [device, setDevice] = useState<VentilatorDeviceId>('hamilton-c6')
  const [support, setSupport] = useState<'guided' | 'practice'>('guided')
  const [ready, setReady] = useState(false)
  const unit = focus ? ventilationUnitById.get(focus) : undefined
  const caseIds: readonly string[] = unit ? unit.caseIds : ventilationPracticeOrder
  const recommendedId = caseIds.find((id) => !history.completedCases.includes(id)) ?? caseIds[0]
  const recommended = mechanicalVentilationCaseById.get(recommendedId)!
  const href = (id: string) =>
    `/mechanical-ventilation/practice?case=${id}&device=${device}&mode=${support}` as Route
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readProgress()
      setHistory(stored)
      setDevice(stored.lastDeviceId)
      setReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])
  function remember() {
    writeProgress(setLastDevice(readProgress(), device))
  }
  return (
    <div className={styles.course}>
      <div className={styles.shell}>
        <header className={styles.lessonHeader}>
          <p className={styles.eyebrow}>Case practice · apply what you learned</p>
          <h1>One patient. Your reasoning in action.</h1>
          <p>
            {unit
              ? `Practice from this unit: ${unit.shortTitle}. Use the same mechanism in a fuller clinical setting.`
              : 'Mix familiar mechanisms in a full patient encounter: assess, predict, act, and reassess.'}
          </p>
        </header>
        {compatibilityNotice && (
          <p className={`${styles.notice} ${styles.warning}`} role="status">
            {compatibilityNotice}
          </p>
        )}
        <section className={styles.card}>
          <div className={styles.lessonGrid}>
            <div>
              <p className={styles.eyebrow}>{unit ? 'A matched case' : 'Recommended next case'}</p>
              <h2>{recommended.title}</h2>
              <p className={styles.muted}>
                Work from the patient and signals, commit to your initial explanation, and use the
                response to reassess. The debrief connects your actions to their consequences.
              </p>
              <p className={styles.muted}>
                {recommended.id} ·{' '}
                {history.completedCases.includes(recommended.id)
                  ? 'Previously worked through'
                  : 'New case'}
              </p>
            </div>
            <div>
              <div className={styles.settings}>
                <div>
                  <label htmlFor="ventilation-practice-device">Training console</label>
                  <select
                    id="ventilation-practice-device"
                    value={device}
                    onChange={(event) => setDevice(event.target.value as VentilatorDeviceId)}
                  >
                    {ventilatorDeviceProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ventilation-practice-support">Learning support</label>
                  <select
                    id="ventilation-practice-support"
                    value={support}
                    onChange={(event) => setSupport(event.target.value as 'guided' | 'practice')}
                  >
                    <option value="guided">Guided · coaching available</option>
                    <option value="practice">Practice · make your own plan</option>
                  </select>
                </div>
              </div>
              <p className={styles.muted}>
                The console stays fixed during the case. Each launch opens a clean simulated
                patient; completed case history is retained.
              </p>
              {ready ? (
                <div className={styles.actions}>
                  <Link className={styles.primary} href={href(recommended.id)} onClick={remember}>
                    Start {support === 'guided' ? 'guided case' : 'practice case'}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              ) : (
                <p role="status" className={styles.muted}>
                  Restoring case history…
                </p>
              )}
            </div>
          </div>
        </section>
        <p className={styles.notice}>
          Case practice includes visible clinical context and learning resources. Use the separate{' '}
          <Link href={'/mechanical-ventilation/assess' as Route} className={styles.textLink}>
            final check
          </Link>{' '}
          for questions without explanations until the end. The simulation is a teaching
          approximation. It does not establish readiness for independent bedside practice.
        </p>
        <details className={styles.details} open={!!unit}>
          <summary>
            {unit
              ? `Browse ${caseIds.length} matched cases`
              : `Browse all ${mechanicalVentilationCases.length} cases`}
          </summary>
          <p className={styles.muted}>
            {unit
              ? 'Each case below uses a mechanism from this unit.'
              : 'The suggested order alternates mechanisms so you practice deciding which explanation applies.'}
          </p>
          <div className={styles.caseGrid}>
            {caseIds.map((id) => {
              const definition = mechanicalVentilationCaseById.get(id)!
              const related = ventilationLearningUnits.find(
                (entry) =>
                  entry.caseIds.includes(id) &&
                  entry.stage !== 'orientation' &&
                  entry.stage !== 'foundation',
              )
              return (
                <article className={styles.card} key={id}>
                  <p className={styles.eyebrow}>
                    {id} · {history.completedCases.includes(id) ? 'Worked through' : 'Not started'}
                  </p>
                  <h3>{definition.title}</h3>
                  {related && (
                    <p>
                      Builds on:{' '}
                      <Link
                        className={styles.textLink}
                        href={ventilationUnitHref(related.id) as Route}
                      >
                        {related.shortTitle}
                      </Link>
                    </p>
                  )}
                  <Link className={styles.secondary} href={href(id)} onClick={remember}>
                    Open case <ArrowRight size={14} />
                  </Link>
                </article>
              )
            })}
          </div>
        </details>
        {unit && (
          <div className={styles.actions}>
            <Link className={styles.textLink} href={'/mechanical-ventilation/practice' as Route}>
              Show the full case library
            </Link>
          </div>
        )}
        <div className={styles.footer}>
          <Link className={styles.textLink} href={'/mechanical-ventilation/learn' as Route}>
            Back to the learning path
          </Link>
          <span className={styles.muted}>
            {
              mechanicalVentilationCases.filter((entry) =>
                history.completedCases.includes(entry.id),
              ).length
            }{' '}
            of {mechanicalVentilationCases.length} cases worked through
          </span>
        </div>
      </div>
    </div>
  )
}
