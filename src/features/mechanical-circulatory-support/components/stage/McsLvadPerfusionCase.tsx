'use client'

import { useState, type ReactNode } from 'react'

import type { ClinicalLearningItem } from '@/features/learning-module/activity/clinicalLearningItem'
import { ChoiceReasoningFeedback } from '@/features/learning-module/components/ChoiceReasoningFeedback'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'

import {
  MCS_LVAD_ADEQUATE_CIRCULATION_NUMBER_IDS,
  MCS_LVAD_CPR_DEFERRAL_NUMBER_ID,
  MCS_LVAD_PERFUSION,
  MCS_LVAD_PERFUSION_DECISIONS,
} from '../../content/lvadPerfusionCase'
import { ReferenceValues } from '../teaching/shared'
import { mcsVerdictFrames } from './McsStageHost'
import styles from './mcs-stage.module.css'

/**
 * Section 8's closing case: two HeartMate 3 patients with no palpable pulse, one perfused and one
 * in arrest, each keyed on the first move.
 *
 * Built from the module's existing pieces, as the Section 5 echo example is: the thresholds print
 * through `ReferenceValues`, so each carries its register row and every source with its own grade,
 * and each patient uses the story problems' choice list and verdict card. The sequence for an
 * inadequate circulation and the timing row open only after the arrest move is chosen, so they do
 * not answer it. Choosing a move is view-state for the mount only; nothing is recorded.
 */
export function McsLvadPerfusionCase() {
  const [perfused, arrest] = MCS_LVAD_PERFUSION_DECISIONS
  return (
    <section
      className={styles.block}
      aria-labelledby="mcs-lvad-perfusion-heading"
      data-lvad-perfusion-case
    >
      <h3 id="mcs-lvad-perfusion-heading">{MCS_LVAD_PERFUSION.title}</h3>
      <p data-lvad-perfusion-intro>{MCS_LVAD_PERFUSION.intro}</p>
      <dl className={styles.definitionList} data-lvad-perfusion-signs>
        {MCS_LVAD_PERFUSION.signs.map((sign) => (
          <div key={sign.id} data-lvad-sign={sign.id}>
            <dt>{sign.term}</dt>
            <dd>{sign.finding}</dd>
          </div>
        ))}
      </dl>
      <ReferenceValues
        title={MCS_LVAD_PERFUSION.numbersTitle}
        ids={MCS_LVAD_ADEQUATE_CIRCULATION_NUMBER_IDS}
        grades
      >
        <p className="mt-1 text-xs leading-5" data-lvad-perfusion-combining>
          {MCS_LVAD_PERFUSION.combining}
        </p>
      </ReferenceValues>

      <McsLvadDecision kind={perfused.kind} title={perfused.title} item={perfused.item} />
      <McsLvadDecision kind={arrest.kind} title={arrest.title} item={arrest.item}>
        <ReferenceValues
          title={MCS_LVAD_PERFUSION.deferralTitle}
          ids={[MCS_LVAD_CPR_DEFERRAL_NUMBER_ID]}
          grades
        />
        <section data-lvad-inadequate-sequence>
          <h5 className="font-semibold">{MCS_LVAD_PERFUSION.sequenceTitle}</h5>
          <ol>
            {MCS_LVAD_PERFUSION.sequence.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </section>
      </McsLvadDecision>
    </section>
  )
}

function McsLvadDecision({
  kind,
  title,
  item,
  children,
}: {
  readonly kind: string
  readonly title: string
  readonly item: ClinicalLearningItem
  /** What opens with the verdict, below the reasoning. */
  readonly children?: ReactNode
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [committedId, setCommittedId] = useState<string | null>(null)
  const committedChoice = item.choices.find((choice) => choice.id === committedId)
  const legendId = `${item.id}-stem`

  return (
    <article className={styles.story} data-lvad-decision={kind}>
      <h4 className="font-semibold">{title}</h4>
      <fieldset
        className={stageStyles.choiceList}
        disabled={Boolean(committedId)}
        aria-labelledby={legendId}
        data-lvad-choices
      >
        <legend id={legendId}>{item.stem}</legend>
        {orderChoices(item.id, item.choices).map((choice) => (
          <label
            key={choice.id}
            className={stageStyles.choice}
            data-selected={selectedId === choice.id}
          >
            <input
              type="radio"
              name={item.id}
              value={choice.id}
              checked={selectedId === choice.id}
              onChange={() => setSelectedId(choice.id)}
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </fieldset>
      {committedChoice ? (
        <div className="grid gap-3" data-lvad-verdict>
          <ChoiceReasoningFeedback
            choice={committedChoice}
            outcome="stated"
            frames={mcsVerdictFrames(item)}
            alternatives={item.choices}
            explanation={item.explanation}
            evidenceIds={item.evidenceIds}
          />
          {children}
          <div className={styles.optionalActions}>
            <button
              type="button"
              data-lvad-try-again
              onClick={() => {
                setSelectedId(null)
                setCommittedId(null)
              }}
            >
              Try again
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={shellStyles.nowPrimary}
          disabled={!selectedId}
          onClick={() => setCommittedId(selectedId)}
          data-lvad-commit
        >
          Compare your move
        </button>
      )}
    </article>
  )
}
