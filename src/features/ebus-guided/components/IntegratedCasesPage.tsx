'use client'
import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import { LESSONS, lessonHref } from '../content/curriculum'
import { FINAL_CASES } from '../content/cases'
import { useCourseProgress } from './useCourseProgress'
import { EbusModuleFrame } from './ModuleFrame'
import { CasePlayer } from './CasePlayer'
import { StorageNotice } from './StorageNotice'
import styles from './course.module.css'

/**
 * The integrated cases, at the course's `/assess` address (EBUS-01). Formerly the final
 * assessment: it opened only after every lesson, recorded first responses and case completions,
 * and showed a correct/answered table by topic. Now every case is open to anyone at any time, an
 * explanation is available before a response, and the only thing kept is which cases were opened.
 */
export function IntegratedCasesPage({
  locale = 'en',
  caseId,
}: {
  locale?: string
  caseId?: string
}) {
  const { progress, status } = useCourseProgress()
  const known = FINAL_CASES.some((c) => c.id === caseId)
  const [active, setActive] = useState<string | null>(known ? caseId! : null)
  const item = FINAL_CASES.find((c) => c.id === active)
  return (
    <EbusModuleFrame locale={locale} active="Cases">
      <div className={styles.page}>
        {item ? (
          <CasePlayer key={item.id} item={item} kind="integrated" onExit={() => setActive(null)} />
        ) : (
          <>
            {caseId && !known && (
              <p className={styles.notice} role="status">
                That case link is no longer available. Choose a case below.
              </p>
            )}
            <p className={styles.eyebrow}>
              Integrated cases · {FINAL_CASES.length} cases · About 25 minutes
            </p>
            <h1 className={styles.caseTitle}>Apply the complete EBUS approach</h1>
            <p>
              Each case brings together acquisition, station anatomy, sampling and interpretation.
              Open any case in any order, before or after the lessons. Every explanation is
              available before you answer, a wrong or unsafe choice is explained and can be retried,
              and nothing you choose is stored. Opening a case does not demonstrate procedural
              competence.
            </p>
            <StorageNotice status={status} />
            <div className={styles.caseList}>
              {FINAL_CASES.map((c, i) => {
                const opened = progress.openedIntegratedCaseIds.includes(c.id)
                return (
                  <section className={styles.card} key={c.id} data-case-card={c.id}>
                    <h2>
                      {i + 1}. {c.title}
                    </h2>
                    <p>
                      {c.questions.length} decisions · {opened ? 'Opened' : 'Not opened yet'}
                    </p>
                    <p className={styles.muted}>
                      Lessons behind this case:{' '}
                      {c.lessonIds.map((id, index) => (
                        <span key={id}>
                          {index ? ', ' : ''}
                          <Link href={lessonHref(id)}>
                            {LESSONS.find((l) => l.id === id)?.title}
                          </Link>
                        </span>
                      ))}
                    </p>
                    <button className={styles.secondary} onClick={() => setActive(c.id)}>
                      {opened ? 'Open again' : 'Open case'}
                    </button>
                  </section>
                )
              })}
            </div>
            <p className={styles.notice}>
              Bring remaining questions to supervised simulation and clinical teaching. Return to
              the cases after a few days for retrieval and review.
            </p>
          </>
        )}
      </div>
    </EbusModuleFrame>
  )
}
