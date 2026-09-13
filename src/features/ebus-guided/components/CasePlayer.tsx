'use client'
import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import { NowCard } from '@/features/learning-module/stage/NowCard'
import type { EbusCase } from '../content/types'
import { BASE, lessonHref, LESSONS } from '../content/curriculum'
import { firstAttempt, updateRecord, completeCase } from '../engine/progress'
import { useCourseRecord } from './useCourseRecord'
import { QuestionBody } from './QuestionBody'
import { SourceList } from './SourceList'
import { DecisionImage } from './DecisionImage'
import { StationFigure } from './StationFigure'
import styles from './course.module.css'
export function CasePlayer({
  item,
  mode,
  onExit,
}: {
  item: EbusCase
  mode: 'practice' | 'assess'
  onExit: () => void
}) {
  const record = useCourseRecord()
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [first, setFirst] = useState<Record<string, string>>({})
  const [debrief, setDebrief] = useState(false)
  const [storageFailed, setStorageFailed] = useState(false)
  const q = item.questions[index],
    committed = answers[q.id]
  const unsafe = !!q.choices.find((c) => c.id === committed)?.unsafe
  function advance() {
    if (!committed) {
      if (!q.choices.some((c) => c.id === selected)) return
      setAnswers((a) => ({ ...a, [q.id]: selected }))
      setFirst((a) => (Object.hasOwn(a, q.id) ? a : { ...a, [q.id]: selected }))
      setStorageFailed(!updateRecord((r) => firstAttempt(r, item.id + ':' + q.id, q, selected)))
      return
    }
    if (unsafe) {
      setAnswers((a) => {
        const copy = { ...a }
        delete copy[q.id]
        return copy
      })
      setSelected('')
      return
    }
    if (index === item.questions.length - 1) {
      setDebrief(true)
      return
    }
    setIndex((i) => i + 1)
    setSelected('')
  }
  function finish() {
    if (mode === 'assess' && !updateRecord((r) => completeCase(r, item.id, answers))) {
      setStorageFailed(true)
      return
    }
    onExit()
  }
  return (
    <div>
      <p className={styles.eyebrow}>
        {mode === 'assess' ? 'Formative assessment' : 'Optional practice'} · Authored clinical case
      </p>
      <h1 className={styles.caseTitle}>{item.title}</h1>
      {storageFailed && (
        <p className={styles.notice} role="status">
          This browser could not save the record. Keep this page open or enable browser storage
          before continuing.
        </p>
      )}
      {!debrief ? (
        <div className={styles.caseGrid}>
          <section className={styles.card}>
            <h2>Clinical situation</h2>
            <p>{item.context}</p>
            {q.imageStation && <DecisionImage key={q.id} station={q.imageStation} />}
            <p className={styles.muted}>
              Reasoning appears in the debrief. Unsafe choices receive immediate feedback and
              require revision. An unfinished case restarts from its first question.
            </p>
          </section>
          <NowCard
            model={{
              kicker: 'Question ' + (index + 1) + ' of ' + item.questions.length,
              heading: 'Your decision',
              body: 'Select the best response to the situation.',
              tone: unsafe ? 'safety' : 'neutral',
              primary: {
                label: unsafe
                  ? 'Revise this response'
                  : !committed
                    ? 'Submit response'
                    : index === item.questions.length - 1
                      ? 'Open debrief'
                      : 'Next question',
                onActivate: advance,
                disabled: !committed && !selected,
                disabledReason: 'Select a response first.',
              },
            }}
          >
            <QuestionBody
              question={q}
              selected={selected || committed || ''}
              committed={committed}
              onSelect={setSelected}
              timing="debrief-only"
            />
          </NowCard>
        </div>
      ) : (
        <section className={styles.debrief}>
          <h2>Case debrief</h2>
          <p>
            Review your original decisions and the alternatives. Revisions do not overwrite first
            responses. These results guide further study and are not a passing or competence
            standard.
          </p>
          {item.questions.map((question) => {
            const initial = first[question.id],
              earliest = record.firstAttempts[item.id + ':' + question.id]?.choiceId
            return (
              <section key={question.id} className={styles.card}>
                <QuestionBody
                  question={question}
                  selected={initial}
                  committed={initial}
                  onSelect={() => {}}
                  timing="debrief-only"
                  debrief
                />
                {answers[question.id] !== initial && (
                  <p className={styles.notice}>
                    You revised the unsafe response before continuing.
                  </p>
                )}
                {earliest && earliest !== initial && (
                  <p className={styles.muted}>
                    First recorded response from an earlier attempt:{' '}
                    {question.choices.find((c) => c.id === earliest)?.text}
                  </p>
                )}
                {question.imageStation && <StationFigure station={question.imageStation} />}
              </section>
            )
          })}
          <section className={styles.card}>
            <h2>Targeted review</h2>
            <p>Revisit these lessons, then try another case on a later day.</p>
            <ul>
              {item.lessonIds.map((id) => (
                <li key={id}>
                  <Link href={lessonHref(id)}>{LESSONS.find((l) => l.id === id)?.title}</Link>
                </li>
              ))}
            </ul>
          </section>
          <button className={styles.button} onClick={finish}>
            {mode === 'assess' ? 'Record case review and return' : 'Return to practice'}
          </button>
        </section>
      )}
      <SourceList ids={item.sources} />
      <div className={styles.actions}>
        <Link className={styles.secondary} href={BASE + '/' + mode}>
          Save and exit
        </Link>
      </div>
    </div>
  )
}
