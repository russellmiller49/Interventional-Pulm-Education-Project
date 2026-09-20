'use client'
import { useEffect, useMemo, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { NowCard } from '@/features/learning-module/stage/NowCard'
import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import type { EbusCase, Question } from '../content/types'
import { lessonHref, LESSONS } from '../content/curriculum'
import { recordLocation } from '../engine/selfPacedProgress'
import { QuestionBody } from './QuestionBody'
import { QuestionExplanation } from './QuestionExplanation'
import { SourceList } from './SourceList'
import { DecisionImage } from './DecisionImage'
import { StationFigure } from './StationFigure'
import styles from './course.module.css'

function learningItem(question: Question): ClinicalLearningItem {
  return {
    id: question.id,
    activityId: 'ebus-guided',
    phase: 'predict',
    itemType: 'management-decision',
    contextRequirement: 'technical',
    stem: question.prompt,
    choices: question.choices.map((c) => ({
      id: c.id,
      label: c.text,
      rationale: c.rationale,
      plausibility: c.unsafe ? 'unsafe' : c.correct ? 'best' : 'incorrect-mechanism',
    })),
    correctChoiceIds: question.choices.filter((c) => c.correct).map((c) => c.id),
    explanation: question.explanation,
    evidenceIds: ['ebus-guided-sources'],
    reviewStatus: 'draft',
  }
}

/**
 * An authored clinical case, self-paced (EBUS-01). Each check can be answered, explained first,
 * retried or passed over; the debrief lists what was chosen in this session and every explanation.
 * Nothing is stored except that the case was opened.
 */
export function CasePlayer({
  item,
  kind,
  onExit,
}: {
  item: EbusCase
  kind: 'practice' | 'integrated'
  onExit: () => void
}) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [debrief, setDebrief] = useState(false)
  useEffect(() => {
    recordLocation({ kind: kind === 'practice' ? 'practice-case' : 'integrated-case', id: item.id })
  }, [item.id, kind])
  const q = item.questions[index],
    committed = answers[q.id]
  const unsafe = !!q.choices.find((c) => c.id === committed)?.unsafe
  const last = index === item.questions.length - 1
  const lessons = useMemo(
    () => item.lessonIds.map((id) => LESSONS.find((l) => l.id === id)).filter(Boolean),
    [item.lessonIds],
  )
  /*
   * The reference image belongs to the case, not to the one check that happens to declare it
   * (EBUS-PRE-REVIEW-01, PR-2). It used to be rendered per question, so the CT the clinical
   * situation describes and every later stem refers back to ("the same target", "this node")
   * disappeared after check 1. No case in this module declares two stations, so a single case
   * reference is the whole of it; a case that later declares a second one shows the station its
   * own check names. It is supplied case evidence throughout, never a learner acquisition, and
   * `DecisionImage` says so on the figure.
   */
  const caseStation =
    q.imageStation ?? item.questions.find((entry) => entry.imageStation)?.imageStation
  function advance() {
    if (last) {
      setDebrief(true)
      return
    }
    setIndex((i) => i + 1)
  }
  const hint = (
    <>
      <p>Use the clinical situation and the described landmarks. The lessons behind this case:</p>
      <ul>
        {lessons.map((lesson) => (
          <li key={lesson!.id}>
            <Link href={lessonHref(lesson!.id)}>{lesson!.title}</Link> — {lesson!.concept}
          </li>
        ))}
      </ul>
    </>
  )
  return (
    <div data-ebus-case={item.id}>
      <p className={styles.eyebrow}>
        {kind === 'integrated' ? 'Integrated case' : 'Practice case'} · Authored clinical case
      </p>
      <h1 className={styles.caseTitle}>{item.title}</h1>
      {!debrief ? (
        <div className={styles.caseGrid}>
          <section className={styles.card}>
            <h2>Clinical situation</h2>
            <p>{item.context}</p>
            {caseStation && <DecisionImage key={caseStation} station={caseStation} />}
            <p className={styles.muted}>
              Feedback appears when you check a response. You can open the hint or the explanation
              first, try again after any response, or continue without answering. An unsafe choice
              is explained immediately. Nothing you choose here is stored.
            </p>
          </section>
          <NowCard
            model={{
              kicker: 'Check ' + (index + 1) + ' of ' + item.questions.length,
              heading: 'Your decision',
              body: 'Select a response and check it, open the explanation first, or continue.',
              tone: unsafe ? 'safety' : 'neutral',
              primary: {
                label: committed
                  ? last
                    ? 'Open debrief'
                    : 'Next check'
                  : last
                    ? 'Open debrief without answering'
                    : 'Continue without answering',
                onActivate: advance,
              },
            }}
          >
            <QuestionBody
              key={q.id}
              question={q}
              selected={selected[q.id] ?? committed ?? ''}
              committed={committed}
              hint={hint}
              onSelect={(id) => setSelected((value) => ({ ...value, [q.id]: id }))}
              onCheck={() => {
                const id = selected[q.id]
                if (q.choices.some((c) => c.id === id))
                  setAnswers((value) => ({ ...value, [q.id]: id }))
              }}
              onRetry={() => {
                setAnswers((value) => {
                  const next = { ...value }
                  delete next[q.id]
                  return next
                })
                setSelected((value) => ({ ...value, [q.id]: '' }))
              }}
            />
          </NowCard>
        </div>
      ) : (
        <section className={styles.debrief} data-case-debrief>
          <h2>Case debrief</h2>
          <p>
            Each decision with its explanation. This is a reading of the case, not a result: what
            you chose here is not stored, and you can open the case again at any time.
          </p>
          {item.questions.map((question) => {
            const chosen = question.choices.find((c) => c.id === answers[question.id])
            return (
              <section key={question.id} className={styles.card}>
                <h3>{question.prompt}</h3>
                <p>
                  {chosen ? (
                    <>
                      <strong>Your response in this session:</strong> {chosen.text}
                      {chosen.unsafe ? <strong> Unsafe.</strong> : null}
                      {!chosen.correct ? ' — ' + chosen.rationale : ''}
                    </>
                  ) : (
                    <em>Not answered in this session.</em>
                  )}
                </p>
                <QuestionExplanation item={learningItem(question)} />
                {question.imageStation && <StationFigure station={question.imageStation} />}
              </section>
            )
          })}
          <section className={styles.card}>
            <h2>Lessons behind this case</h2>
            <p>Revisit any of these, then try another case on a later day.</p>
            <ul>
              {lessons.map((lesson) => (
                <li key={lesson!.id}>
                  <Link href={lessonHref(lesson!.id)}>{lesson!.title}</Link>
                </li>
              ))}
            </ul>
          </section>
          <button className={styles.button} onClick={onExit}>
            {kind === 'integrated' ? 'Return to the cases' : 'Return to practice'}
          </button>
        </section>
      )}
      <SourceList ids={item.sources} />
      <div className={styles.actions}>
        {/*
         * The parent owns which case is open, so leaving is the parent's callback — the same one
         * the debrief's Return uses. This was a link to the list address, which is the address
         * already open, so it navigated nowhere and the case stayed up (EBUS-PRE-REVIEW-01, PR-7).
         */}
        <button type="button" className={styles.secondary} data-case-exit onClick={onExit}>
          Leave this case
        </button>
      </div>
    </div>
  )
}
