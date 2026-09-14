'use client'

import { useId, useState } from 'react'
import { ArrowRight, RotateCcw } from 'lucide-react'

import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import { Link } from '@/i18n/navigation'

import { imagingLesson, type ImagingSectionId } from '../content/pathway'
import { imagingSectionLinkTarget } from '../content/pathwayResolver'
import { ImagingExplanation } from './ImagingExplanation'

/**
 * One case decision, self-paced: check an answer, show the explanation without answering, try
 * again, or leave — none of these waits on another, and none of them is saved.
 *
 * The checked answer lives in this component's state, for the feedback it drives, and nowhere else:
 * no first attempt, no correctness, no record that the explanation was opened (PI-01). The section
 * that teaches the mechanism is linked above the choices, because a chapter title is how a learner
 * finds the teaching, not an answer to protect.
 */
export function ImagingCaseDecision({
  item,
  choiceGroup,
  conceptSectionId,
}: {
  readonly item: ClinicalLearningItem
  readonly choiceGroup: string
  readonly conceptSectionId: ImagingSectionId
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [checked, setChecked] = useState<string | null>(null)
  const [explanationOpen, setExplanationOpen] = useState(false)
  const explanationId = useId()
  const lesson = imagingLesson(conceptSectionId)

  return (
    <div className="grid gap-4" data-case-decision>
      <p className="text-sm text-muted-foreground" data-case-pairing>
        Review the concept:{' '}
        <Link
          className="font-semibold text-primary"
          href={imagingSectionLinkTarget(conceptSectionId)}
        >
          {lesson.title}
        </Link>
      </p>

      {checked ? (
        <div className="grid gap-4" data-case-verdict>
          <AnswerVerdict
            item={item}
            choiceId={checked}
            outcome="stated"
            timing="immediate-after-commit"
            theme="dark"
            explanationHeading="The takeaway"
          />
          <div>
            <button
              type="button"
              className={shellStyles.nowSecondary}
              data-answer-again
              onClick={() => {
                setChecked(null)
                setSelected(null)
                setExplanationOpen(false)
              }}
            >
              <RotateCcw aria-hidden="true" /> Try again
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <fieldset className={stageStyles.choiceList} data-prediction-choices>
            <legend>{item.stem}</legend>
            {orderChoices(item.id, item.choices).map((choice) => (
              <label
                key={choice.id}
                className={stageStyles.choice}
                data-selected={selected === choice.id}
              >
                <input
                  type="radio"
                  name={choiceGroup}
                  value={choice.id}
                  checked={selected === choice.id}
                  onChange={() => setSelected(choice.id)}
                />
                <span>{choice.label}</span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={shellStyles.nowPrimary}
              data-now-primary
              disabled={!selected}
              onClick={() => {
                if (selected) setChecked(selected)
              }}
            >
              Check my answer <ArrowRight aria-hidden="true" />
            </button>
            <button
              type="button"
              className={shellStyles.nowSecondary}
              data-show-explanation
              aria-expanded={explanationOpen}
              aria-controls={explanationOpen ? explanationId : undefined}
              onClick={() => setExplanationOpen((open) => !open)}
            >
              {explanationOpen ? 'Hide the explanation' : 'Show the explanation'}
            </button>
          </div>
          {explanationOpen ? (
            <ImagingExplanation
              id={explanationId}
              item={item}
              note="Shown without an answer. You can still choose an option and check it."
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
