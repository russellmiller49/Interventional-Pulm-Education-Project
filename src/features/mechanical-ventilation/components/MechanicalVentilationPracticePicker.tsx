'use client'

import { useEffect, useId, useState } from 'react'
import type { Route } from 'next'
import { ArrowRight, BookOpenCheck } from 'lucide-react'

import { mechanicalVentilationNavBase } from '@/features/learning-module/moduleRoutes'
import { Link } from '@/i18n/navigation'

import { ventilationCasePresentationTitle } from '../content/casePresentation'
import { ventilatorDeviceProfiles } from '../content/deviceProfiles'
import {
  ventilationLearningUnits,
  ventilationPracticeOrder,
  ventilationUnitById,
} from '../content/learningCurriculum'
import { ventilationPathwayGroups } from '../content/pathwayResolver'
import { ventilationSectionSpecs } from '../content/sectionSpecs'
import { mechanicalVentilationCaseById } from '../content/runtimeCases'
import {
  createDefaultProgress,
  readProgress,
  setLastDevice,
  writeProgress,
} from '../engine/progress'
import type { VentilatorDeviceId } from '../engine/types'
import { MechanicalVentilationModuleFrame } from './MechanicalVentilationModuleFrame'
import styles from './mechanical-ventilation-hub.module.css'

/**
 * Practice: the fifteen clinical cases, named by what the bedside shows.
 *
 * One recommended case — the first not yet worked in the mechanism-alternating order, or the case
 * a section handed over — with the console and the amount of prompting chosen once, then every case
 * grouped under the stage of the pathway that teaches its mechanism, each with a link back to the
 * section it builds on. The diagnosis returns in the debrief, not here.
 */
export function MechanicalVentilationPracticePicker({
  locale = 'en',
  requestedCaseId,
  focusUnitId,
  compatibilityNotice,
}: {
  readonly locale?: string
  readonly requestedCaseId?: string
  readonly focusUnitId?: string
  readonly compatibilityNotice?: string
}) {
  const [history, setHistory] = useState(createDefaultProgress)
  const [device, setDevice] = useState<VentilatorDeviceId>('hamilton-c6')
  const [support, setSupport] = useState<'guided' | 'practice'>('guided')
  const [ready, setReady] = useState(false)
  const deviceSelectId = useId()
  const supportSelectId = useId()

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readProgress()
      setHistory(stored)
      setDevice(stored.lastDeviceId)
      setReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const focusUnit = focusUnitId ? ventilationUnitById.get(focusUnitId) : undefined
  const order: readonly string[] = focusUnit ? focusUnit.caseIds : ventilationPracticeOrder
  const requested =
    requestedCaseId && mechanicalVentilationCaseById.has(requestedCaseId)
      ? requestedCaseId
      : undefined
  const recommendedId =
    requested ?? order.find((id) => !history.completedCases.includes(id)) ?? order[0]
  const groups = ventilationPathwayGroups()
  const href = (id: string) =>
    `${mechanicalVentilationNavBase}/practice?case=${id}&device=${device}&mode=${support}` as Route
  function remember() {
    writeProgress(setLastDevice(readProgress(), device))
  }
  // The section whose mechanism this case applies: the one that pairs it, else the first that lists it.
  const teachingUnitFor = (caseId: string) =>
    ventilationLearningUnits.find(
      (unit) =>
        ventilationSectionSpecs.find((spec) => spec.unitId === unit.id)?.practicePairing?.caseId ===
          caseId &&
        ventilationSectionSpecs.find((spec) => spec.unitId === unit.id)?.practicePairing?.kind ===
          'mechanism-match',
    ) ??
    ventilationLearningUnits.find(
      (unit) =>
        unit.caseIds.includes(caseId) &&
        unit.stage !== 'orientation' &&
        unit.stage !== 'foundation',
    )
  return (
    <MechanicalVentilationModuleFrame
      locale={locale}
      activeHref={`${mechanicalVentilationNavBase}/practice`}
    >
      <div data-hydrated={ready}>
        {compatibilityNotice ? (
          <p className={styles.note} role="status">
            {compatibilityNotice}
          </p>
        ) : null}
        <header className={styles.hero}>
          <h1>Practice</h1>
          <p>
            One patient at a time, with the reasoning the sections built: commit a mechanism, act,
            reassess, and read the causal debrief. Guided practice coaches each step; practice mode
            leaves the prompting out.
          </p>
          <div className={styles.entryActions}>
            <Link
              className={styles.continue}
              href={href(recommendedId)}
              onClick={remember}
              data-practice-recommended={recommendedId}
            >
              <ArrowRight aria-hidden="true" />
              <span>
                <strong>
                  {requested ? 'Open' : 'Next case'} —{' '}
                  {ventilationCasePresentationTitle(recommendedId)}
                </strong>
                <small>
                  {teachingUnitFor(recommendedId)
                    ? `Builds on: ${teachingUnitFor(recommendedId)!.title}`
                    : 'Applies the pathway’s reasoning'}
                </small>
              </span>
            </Link>
          </div>
          <div className={styles.consoles} style={{ marginTop: '1rem' }}>
            <label htmlFor={deviceSelectId} className={styles.note} style={{ margin: 0 }}>
              Console
            </label>
            <select
              id={deviceSelectId}
              className={styles.consoleChoice}
              value={device}
              onChange={(event) => setDevice(event.target.value as VentilatorDeviceId)}
            >
              {ventilatorDeviceProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName}
                </option>
              ))}
            </select>
            <label htmlFor={supportSelectId} className={styles.note} style={{ margin: 0 }}>
              Prompting
            </label>
            <select
              id={supportSelectId}
              className={styles.consoleChoice}
              value={support}
              onChange={(event) => setSupport(event.target.value as 'guided' | 'practice')}
            >
              <option value="guided">Guided practice — coached at each step</option>
              <option value="practice">Practice — full controls, debrief at the end</option>
            </select>
          </div>
        </header>

        {groups
          .filter((group) => group.cases.length > 0)
          .map((group) => {
            const caseIds = [...new Set(group.cases.map((entry) => entry.caseId))]
            return (
              <section
                key={group.stage}
                className={styles.section}
                aria-labelledby={`mv-practice-${group.stage}`}
              >
                <div className={styles.sectionHeading}>
                  <h2 id={`mv-practice-${group.stage}`}>{group.title}</h2>
                  <span>
                    {caseIds.length} case{caseIds.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className={styles.chipRow}>
                  {caseIds.map((caseId) => {
                    const done = history.completedCases.includes(caseId)
                    const unit = teachingUnitFor(caseId)
                    return (
                      <Link
                        key={caseId}
                        className={styles.chip}
                        data-kind="case"
                        data-case={caseId}
                        data-complete={done}
                        data-recommended={caseId === recommendedId}
                        href={href(caseId)}
                        onClick={remember}
                      >
                        <BookOpenCheck aria-hidden="true" />
                        {ventilationCasePresentationTitle(caseId)}
                        {done ? ' ✓ worked through' : ''}
                        {caseId === recommendedId ? <em>Up next</em> : null}
                        {unit ? (
                          <small style={{ opacity: 0.8 }}> · builds on {unit.shortTitle}</small>
                        ) : null}
                      </Link>
                    )
                  })}
                </div>
              </section>
            )
          })}

        <section className={styles.section} aria-labelledby="mv-practice-all">
          <h2 id="mv-practice-all">Every case, in the mechanism-alternating order</h2>
          <div className={styles.chipRow}>
            {ventilationPracticeOrder.map((caseId) => {
              const done = history.completedCases.includes(caseId)
              const unit = teachingUnitFor(caseId)
              return (
                <Link
                  key={caseId}
                  className={styles.chip}
                  data-kind="case"
                  data-complete={done}
                  href={href(caseId)}
                  onClick={remember}
                >
                  <BookOpenCheck aria-hidden="true" />
                  {ventilationCasePresentationTitle(caseId)}
                  {done ? ' ✓ worked through' : ''}
                  {unit ? (
                    <small style={{ opacity: 0.8 }}> · builds on {unit.shortTitle}</small>
                  ) : null}
                </Link>
              )
            })}
          </div>
        </section>
      </div>
    </MechanicalVentilationModuleFrame>
  )
}
