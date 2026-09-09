'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'

import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import { Link } from '@/i18n/navigation'

import {
  imagingMicroCaseById,
  imagingMicroCasesInPathwayOrder,
  practiceItemId,
} from '../content/microCases'
import { imagingLesson } from '../content/pathway'
import { imagingSectionLinkTarget } from '../content/pathwayResolver'
import { imagingCaseLinkTarget, PERIPHERAL_IMAGING_PRACTICE_HREF } from '../content/routes'
import { readImagingRecord, withFirstAttempt, writeImagingRecord } from '../engine/learnProgress'
import { usePeripheralImagingRecord } from './usePeripheralImagingRecord'
import styles from './stage/imaging-stage.module.css'

/**
 * One practice case: the situation, one decision, the reasoning.
 *
 * The learner may answer as often as they like — this is the layer where trying a reading and
 * finding out is the point. Only the first decision is written to the record, and it is never
 * rewritten, so a later reading cannot quietly replace what they thought at first sight.
 */
export function ImagingCaseActivity({ caseId }: { readonly caseId: string }) {
  const microCase = imagingMicroCaseById.get(caseId)
  const { record, hydrated } = usePeripheralImagingRecord()
  const [selected, setSelected] = useState<string | null>(null)
  const [committed, setCommitted] = useState<string | null>(null)

  if (!microCase) {
    return (
      <p role="status" data-unknown-case={caseId}>
        That case is not in this module. Every case is listed on the Practice page.
      </p>
    )
  }

  const order = imagingMicroCasesInPathwayOrder()
  const position = order.findIndex((entry) => entry.id === microCase.id)
  const previous = position > 0 ? order[position - 1] : null
  const next = position >= 0 && position < order.length - 1 ? order[position + 1] : null
  const firstAttempt = record.firstAttempts[practiceItemId(microCase.id)]
  const lesson = imagingLesson(microCase.sectionId)

  const firstChoiceLabel = firstAttempt
    ? (microCase.item.choices.find((choice) => choice.id === firstAttempt.choiceId)?.label ?? null)
    : null

  function commit() {
    if (!selected || !microCase) return
    setCommitted(selected)
    writeImagingRecord(
      withFirstAttempt(readImagingRecord(), practiceItemId(microCase.id), selected),
    )
  }

  return (
    <article className="grid gap-5" data-practice-case={microCase.id}>
      <div className="grid gap-1">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Practice · case {position + 1} of {order.length}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{microCase.presentationTitle}</h1>
      </div>

      <section className={styles.teachingCard} data-case-situation>
        <p className={styles.kicker}>What you have</p>
        <p>{microCase.situation}</p>
      </section>

      {hydrated && firstAttempt && !committed ? (
        <p className="text-sm text-muted-foreground" data-first-decision>
          Your first decision here was <strong>{firstChoiceLabel}</strong>. It stays on your record
          as you made it; answering again changes nothing but your own reading.
        </p>
      ) : null}

      {committed ? (
        <div className="grid gap-4" data-case-verdict>
          <AnswerVerdict
            item={microCase.item}
            choiceId={committed}
            outcome="stated"
            timing="immediate-after-commit"
            theme="dark"
            explanationHeading="The takeaway"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={shellStyles.nowSecondary}
              data-answer-again
              onClick={() => {
                setCommitted(null)
                setSelected(null)
              }}
            >
              <RotateCcw aria-hidden="true" /> Answer it again
            </button>
            {next ? (
              <Link
                className={shellStyles.nowPrimary}
                href={imagingCaseLinkTarget(next.id)}
                data-next-case={next.id}
              >
                Next case <ArrowRight aria-hidden="true" />
              </Link>
            ) : (
              <Link className={shellStyles.nowPrimary} href={PERIPHERAL_IMAGING_PRACTICE_HREF}>
                Back to the case list <ArrowRight aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <fieldset className={stageStyles.choiceList} data-prediction-choices>
            <legend>{microCase.item.stem}</legend>
            {orderChoices(microCase.item.id, microCase.item.choices).map((choice) => (
              <label
                key={choice.id}
                className={stageStyles.choice}
                data-selected={selected === choice.id}
              >
                <input
                  type="radio"
                  name={`practice-${microCase.id}`}
                  value={choice.id}
                  checked={selected === choice.id}
                  onChange={() => setSelected(choice.id)}
                />
                <span>{choice.label}</span>
              </label>
            ))}
          </fieldset>
          <div>
            <button
              type="button"
              className={shellStyles.nowPrimary}
              data-now-primary
              disabled={!selected}
              onClick={commit}
            >
              Commit this answer <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {committed ? (
        <p className="text-sm text-muted-foreground" data-case-pairing>
          This case uses the mechanism from{' '}
          <Link
            className="font-semibold text-primary"
            href={imagingSectionLinkTarget(microCase.sectionId)}
          >
            {lesson.title}
          </Link>
          .
        </p>
      ) : null}

      <nav className="flex flex-wrap items-center gap-4 text-sm" aria-label="Practice cases">
        {previous ? (
          <Link
            className="inline-flex items-center gap-1 font-semibold text-primary"
            href={imagingCaseLinkTarget(previous.id)}
          >
            <ArrowLeft aria-hidden="true" /> {previous.presentationTitle}
          </Link>
        ) : null}
        <Link className="font-semibold text-primary" href={PERIPHERAL_IMAGING_PRACTICE_HREF}>
          All cases
        </Link>
      </nav>
    </article>
  )
}
