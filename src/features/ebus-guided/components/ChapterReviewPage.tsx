'use client'
import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import { NowCard } from '@/features/learning-module/stage/NowCard'
import { BASE, CHAPTERS, lessonById, lessonHref, lessonLabel } from '../content/curriculum'
import { chapterReview } from '../content/chapter-reviews'
import { EbusModuleFrame } from './ModuleFrame'
import { QuestionBody } from './QuestionBody'
import { ReviewImageView } from './ReviewImageView'
import course from './course.module.css'
import styles from './chapter-review.module.css'

/**
 * A chapter review (2026-11-11): a few image questions at the end of a chapter, mixed across the
 * lessons finished so far. Each image is read before anything on it is named: its labels open
 * when the learner checks a response or opens the explanation. Like every check in the course it
 * can be answered, explained first, retried or passed over, and nothing here is stored.
 */
export function ChapterReviewPage({
  chapterId,
  locale = 'en',
}: {
  chapterId: string
  locale?: string
}) {
  const review = chapterReview(chapterId)!
  const chapterIndex = CHAPTERS.findIndex((entry) => entry.id === chapterId)
  const chapter = CHAPTERS[chapterIndex]
  const nextLesson = CHAPTERS[chapterIndex + 1]?.lessons[0]
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [explained, setExplained] = useState<Record<string, boolean>>({})
  const [debrief, setDebrief] = useState(false)
  const item = review.items[index]
  const q = item.question
  const committed = answers[q.id]
  const last = index === review.items.length - 1
  const revealed = !!committed || !!explained[q.id]
  const source = lessonById(item.lessonId)!
  return (
    <EbusModuleFrame locale={locale} active="Learn">
      <div className={course.page} data-chapter-review={chapterId}>
        <p className={course.eyebrow}>
          Chapter {chapterIndex + 1} review · {chapter.title}
        </p>
        <h1 className={course.caseTitle}>Images from the lessons so far</h1>
        {!debrief ? (
          <div className={styles.grid}>
            <section className={course.card}>
              <h2>
                Image {index + 1} of {review.items.length}
              </h2>
              <ReviewImageView key={q.id} image={item.image} revealed={revealed} />
              {!revealed && (
                <p className={styles.locked} data-review-locked>
                  The labels for this image open after you answer.
                </p>
              )}
            </section>
            <NowCard
              model={{
                kicker: 'Check ' + (index + 1) + ' of ' + review.items.length,
                heading: 'Read the image',
                body: 'Select a response and check it, open the explanation first, or continue.',
                tone: 'neutral',
                primary: {
                  label: committed
                    ? last
                      ? 'Open the summary'
                      : 'Next image'
                    : last
                      ? 'Open the summary without answering'
                      : 'Continue without answering',
                  onActivate: () => (last ? setDebrief(true) : setIndex((value) => value + 1)),
                },
              }}
            >
              <QuestionBody
                key={q.id}
                question={q}
                selected={selected[q.id] ?? committed ?? ''}
                committed={committed}
                hint={
                  <p>
                    This draws on <Link href={lessonHref(source.id)}>{lessonLabel(source.id)}</Link>
                    .
                  </p>
                }
                onSelect={(id) => setSelected((value) => ({ ...value, [q.id]: id }))}
                onCheck={() => {
                  const id = selected[q.id]
                  if (q.choices.some((choice) => choice.id === id))
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
                onExplanationChange={(open) =>
                  setExplained((value) => (open ? { ...value, [q.id]: true } : value))
                }
              />
            </NowCard>
          </div>
        ) : (
          <section className={course.debrief} data-review-summary>
            <h2>Review summary</h2>
            <p>
              Each image with its answer and the lesson it draws on. What you chose here is not
              stored, and you can open the review again at any time.
            </p>
            {review.items.map((entry) => {
              const chosen = entry.question.choices.find(
                (choice) => choice.id === answers[entry.question.id],
              )
              const right = entry.question.choices.find((choice) => choice.correct)!
              return (
                <section key={entry.question.id} className={course.card}>
                  <div className={styles.grid}>
                    <ReviewImageView image={entry.image} revealed />
                    <div>
                      <h3>{entry.question.prompt}</h3>
                      <p>
                        {chosen ? (
                          <>
                            <strong>Your response in this session:</strong> {chosen.text}
                            {chosen.correct ? '.' : ' — ' + chosen.rationale}
                          </>
                        ) : (
                          <em>Not answered in this session.</em>
                        )}
                      </p>
                      <p>
                        <strong>{right.text}.</strong> {right.rationale}
                      </p>
                      <p className={styles.from}>
                        From{' '}
                        <Link href={lessonHref(entry.lessonId)}>{lessonLabel(entry.lessonId)}</Link>
                      </p>
                    </div>
                  </div>
                </section>
              )
            })}
            <div className={course.actions}>
              {nextLesson && (
                <Link className={course.button} href={lessonHref(nextLesson.id)}>
                  Continue to {lessonLabel(nextLesson.id)}
                </Link>
              )}
              <Link className={course.secondary} href={BASE + '/learn'}>
                Back to the course
              </Link>
            </div>
          </section>
        )}
      </div>
    </EbusModuleFrame>
  )
}
