'use client'
import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import { BASE, LESSONS, TOPICS, lessonHref, nextLesson } from '../content/curriculum'
import { FINAL_CASES } from '../content/cases'
import { assessmentReady } from '../engine/progress'
import { useCourseRecord } from './useCourseRecord'
import { EbusModuleFrame } from './ModuleFrame'
import { CasePlayer } from './CasePlayer'
import styles from './course.module.css'
export function AssessPage({ locale = 'en' }: { locale?: string }) {
  const record = useCourseRecord()
  const [active, setActive] = useState<string | null>(null)
  const item = FINAL_CASES.find((c) => c.id === active)
  const ready = assessmentReady(record),
    next = nextLesson(record.completed)
  const unanswered = FINAL_CASES.find((c) => !record.completedCases.includes(c.id))
  return (
    <EbusModuleFrame locale={locale} active="Assess">
      <div className={styles.page}>
        {!ready ? (
          <section className={styles.card}>
            <p className={styles.eyebrow}>Assess · Formative integration</p>
            <h1 className={styles.caseTitle}>Finish the guided course first.</h1>
            <p>
              The final assessment brings together acquisition, station anatomy, sampling, and
              interpretation. Complete the {LESSONS.length} lessons and their required activities to
              open it.
            </p>
            <p>
              {record.completed.length} of {LESSONS.length} lessons complete.
            </p>
            {next && (
              <Link className={styles.button} href={lessonHref(next.id)}>
                Continue with {next.title}
              </Link>
            )}
            <p>
              Optional cases remain available in <Link href={BASE + '/practice'}>Practice</Link>.
            </p>
          </section>
        ) : item ? (
          <CasePlayer key={item.id} item={item} mode="assess" onExit={() => setActive(null)} />
        ) : (
          <>
            <p className={styles.eyebrow}>Assess · Eight integrated cases · About 25 minutes</p>
            <h1 className={styles.caseTitle}>
              {record.assessmentComplete
                ? 'Your learning review'
                : 'Apply the complete EBUS approach'}
            </h1>
            <p>
              Complete each case and review its debrief. First responses are retained for targeted
              review. There is no passing threshold. Course completion does not demonstrate
              independent procedural competence.
            </p>
            <p>
              {record.completedCases.length} of {FINAL_CASES.length} case debriefs completed.
            </p>
            {unanswered && (
              <button className={styles.button} onClick={() => setActive(unanswered.id)}>
                {record.completedCases.length ? 'Continue assessment' : 'Start assessment'}
              </button>
            )}
            <div className={styles.caseList}>
              {FINAL_CASES.map((c, i) => (
                <section className={styles.card} key={c.id}>
                  <h2>
                    {i + 1}. {c.title}
                  </h2>
                  <p>
                    {c.questions.length} decisions ·{' '}
                    {record.completedCases.includes(c.id) ? 'Debrief completed' : 'Not completed'}
                  </p>
                  <button className={styles.secondary} onClick={() => setActive(c.id)}>
                    {record.completedCases.includes(c.id) ? 'Revisit case' : 'Open case'}
                  </button>
                </section>
              ))}
            </div>
            {record.completedCases.length > 0 && (
              <section className={styles.card}>
                <h2>Topic review from first recorded responses</h2>
                <p className={styles.muted}>
                  Counts describe this question set only. Safety revisions and later attempts do not
                  change first-response counts.
                </p>
                <div className={styles.tableScroll}>
                  <table>
                    <thead>
                      <tr>
                        <th>Topic</th>
                        <th>Correct / answered</th>
                        <th>Suggested review</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TOPICS.map((topic) => {
                        const cases = FINAL_CASES.filter(
                          (c) => c.topic === topic && record.completedCases.includes(c.id),
                        )
                        const items = cases.flatMap((c) =>
                          c.questions.map((q) => ({
                            q,
                            a: record.firstAttempts[c.id + ':' + q.id],
                          })),
                        )
                        const answered = items.filter((i) => i.a),
                          correct = answered.filter((i) =>
                            i.q.choices.some((c) => c.correct && c.id === i.a?.choiceId),
                          )
                        const ids = [...new Set(cases.flatMap((c) => c.lessonIds))]
                        return (
                          <tr key={topic}>
                            <th scope="row">{topic}</th>
                            <td>
                              {answered.length
                                ? correct.length + ' / ' + answered.length
                                : 'No completed case yet'}
                            </td>
                            <td>
                              {ids.map((id) => (
                                <Link key={id} href={lessonHref(id)}>
                                  {LESSONS.find((l) => l.id === id)?.title}
                                </Link>
                              ))}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {record.assessmentComplete && (
              <p className={styles.notice}>
                All required lessons and case reviews are complete. Bring remaining questions to
                supervised simulation and clinical teaching. Return to practice after a few days for
                retrieval and review.
              </p>
            )}
          </>
        )}
      </div>
    </EbusModuleFrame>
  )
}
