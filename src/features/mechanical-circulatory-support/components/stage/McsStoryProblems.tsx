'use client'

import { useMemo, useState } from 'react'

import { ChoiceReasoningFeedback } from '@/features/learning-module/components/ChoiceReasoningFeedback'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'

import {
  MCS_STORY_READING_LABELS,
  MCS_STORY_READING_UNITS,
  runMcsStory,
  type McsStoryProblem,
} from '../../content/storyProblems'
import styles from './mcs-stage.module.css'

/**
 * The story problems: predict, commit, then run the colleague's change and read four values.
 *
 * Commitment is view-state for the mount only — nothing here is recorded. The run happens on a
 * separate copy of the circulation, built from the story's own starting point, so the section's
 * live patient is not disturbed and the readings are the same every time the story is run.
 */
export function McsStoryProblems({ stories }: { readonly stories: readonly McsStoryProblem[] }) {
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [committed, setCommitted] = useState<Record<string, string>>({})
  const [ran, setRan] = useState<Record<string, boolean>>({})

  return (
    <section
      className={styles.stories}
      aria-labelledby="story-problems-heading"
      data-story-problems
    >
      <h3 id="story-problems-heading">Story problems</h3>
      <p className={styles.storyIntro}>
        Two constructed illustrations, each sixty seconds. A colleague does one thing for a reason
        that sounds sensible. Predict what happens, commit, then run the same change on a separate
        copy of the circulation and read the values.
      </p>
      {stories.map((story) => (
        <StoryCard
          key={story.id}
          story={story}
          selectedId={selected[story.id] ?? null}
          committedId={committed[story.id] ?? null}
          ran={ran[story.id] ?? false}
          onSelect={(choiceId) => setSelected((current) => ({ ...current, [story.id]: choiceId }))}
          onCommit={() =>
            setCommitted((current) =>
              selected[story.id] ? { ...current, [story.id]: selected[story.id] } : current,
            )
          }
          onRun={() => setRan((current) => ({ ...current, [story.id]: true }))}
        />
      ))}
    </section>
  )
}

function StoryCard({
  story,
  selectedId,
  committedId,
  ran,
  onSelect,
  onCommit,
  onRun,
}: {
  readonly story: McsStoryProblem
  readonly selectedId: string | null
  readonly committedId: string | null
  readonly ran: boolean
  readonly onSelect: (choiceId: string) => void
  readonly onCommit: () => void
  readonly onRun: () => void
}) {
  const run = useMemo(() => (ran ? runMcsStory(story) : null), [ran, story])
  const committedChoice = story.item.choices.find((choice) => choice.id === committedId)
  const legendId = `${story.id}-stem`
  const alarmState = (state: { readonly alarms: readonly { id: string; active: boolean }[] }) =>
    story.alarmId
      ? state.alarms.some((alarm) => alarm.id === story.alarmId && alarm.active)
        ? 'active'
        : 'clear'
      : null

  return (
    <article className={styles.story} data-story={story.id}>
      <h4>{story.title}</h4>
      <fieldset
        className={stageStyles.choiceList}
        disabled={committedId !== null}
        aria-labelledby={legendId}
        data-story-choices
      >
        <legend id={legendId}>{story.item.stem}</legend>
        {orderChoices(story.item.id, story.item.choices).map((choice) => (
          <label
            key={choice.id}
            className={stageStyles.choice}
            data-selected={selectedId === choice.id}
          >
            <input
              type="radio"
              name={`story-${story.id}`}
              value={choice.id}
              checked={selectedId === choice.id}
              onChange={() => onSelect(choice.id)}
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </fieldset>
      {committedChoice ? (
        <div className="grid gap-3" data-story-verdict>
          <ChoiceReasoningFeedback
            choice={committedChoice}
            outcome="stated"
            explanation={story.item.explanation}
            evidenceIds={story.item.evidenceIds}
          />
          {ran && run ? (
            <div className={styles.storyRun} data-story-run>
              <dl className={styles.storyReadings}>
                {story.readings.map((reading) => (
                  <div key={reading}>
                    <dt>{MCS_STORY_READING_LABELS[reading]}</dt>
                    <dd>
                      {(run.before.metrics[reading] as number).toFixed(1)} →{' '}
                      {(run.after.metrics[reading] as number).toFixed(1)}{' '}
                      <small>{MCS_STORY_READING_UNITS[reading]}</small>
                    </dd>
                  </div>
                ))}
                {story.alarmId ? (
                  <div>
                    <dt>The alarm</dt>
                    <dd data-story-alarm>
                      {alarmState(run.before)} → {alarmState(run.after)}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className={styles.storyAxis} data-story-axis-verdict>
                {story.axisVerdict}
              </p>
            </div>
          ) : (
            <button
              type="button"
              className={shellStyles.nowSecondary}
              onClick={onRun}
              data-story-run-button
            >
              Run it on a copy of the circulation
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          className={shellStyles.nowPrimary}
          disabled={selectedId === null}
          onClick={onCommit}
          data-story-commit
        >
          Commit this prediction
        </button>
      )}
    </article>
  )
}
