'use client'

import { useMemo, useState } from 'react'

import { ChoiceReasoningFeedback } from '@/features/learning-module/components/ChoiceReasoningFeedback'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'

import { mcsConfigurationLabel } from '../../engine/learningSession'
import {
  MCS_STORY_READING_LABELS,
  MCS_STORY_READING_UNITS,
  mcsStoryBaseline,
  runMcsStory,
  type McsStoryProblem,
} from '../../content/storyProblems'
import { mcsVerdictFrames } from './McsStageHost'
import styles from './mcs-stage.module.css'

/**
 * Optional predictions and worked examples run on an independent model.
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
        that sounds sensible. Try an optional prediction or view the worked example directly. Run
        the provided change on a separate copy of the circulation and compare the values.
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
          onRetry={() => {
            setSelected((current) => ({ ...current, [story.id]: '' }))
            setCommitted((current) => ({ ...current, [story.id]: '' }))
            setRan((current) => ({ ...current, [story.id]: false }))
          }}
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
  onRetry,
}: {
  readonly story: McsStoryProblem
  readonly selectedId: string | null
  readonly committedId: string | null
  readonly ran: boolean
  readonly onSelect: (choiceId: string) => void
  readonly onCommit: () => void
  readonly onRun: () => void
  readonly onRetry: () => void
}) {
  const [hintVisible, setHintVisible] = useState(false)
  const run = useMemo(() => (ran ? runMcsStory(story) : null), [ran, story])
  /*
   * The starting point, read off the model, before the question.
   *
   * Both stories in a pair share one `setup`, so both baselines are the same values at the same
   * elapsed time — and until now nothing said which patient that was. The second stem's "from the
   * same starting point" was read as the patient on the monitor, whose right ventricle is failing
   * at a normal filling volume, rather than the pair's own low-preload illustration (F26). This
   * runs the setup and nothing else, so opening the block performs no action, records nothing and
   * does not touch the live session.
   */
  const baseline = useMemo(() => mcsStoryBaseline(story), [story])
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
      <section className={styles.storyBaseline} data-story-baseline={story.baselineId}>
        <h5>Where this illustration starts</h5>
        <p>{story.baselineNote}</p>
        <dl className={styles.storyReadings}>
          <div>
            <dt>Baseline</dt>
            <dd data-story-baseline-id>{story.baselineId}</dd>
          </div>
          <div>
            <dt>Support setting</dt>
            <dd data-story-baseline-setting>{mcsConfigurationLabel(baseline)}</dd>
          </div>
          <div>
            <dt>Right atrial pressure</dt>
            <dd data-story-baseline-metric="rapMmHg">
              {baseline.metrics.rapMmHg.toFixed(0)} <small>mm Hg</small>
            </dd>
          </div>
          <div>
            <dt>Wedge pressure</dt>
            <dd data-story-baseline-metric="pcwpMmHg">
              {baseline.metrics.pcwpMmHg.toFixed(0)} <small>mm Hg</small>
            </dd>
          </div>
          {story.readings
            .filter((reading) => reading !== 'rapMmHg' && reading !== 'pcwpMmHg')
            .map((reading) => (
              <div key={reading}>
                <dt>{MCS_STORY_READING_LABELS[reading]}</dt>
                <dd data-story-baseline-metric={reading}>
                  {(baseline.metrics[reading] as number).toFixed(1)}{' '}
                  <small>{MCS_STORY_READING_UNITS[reading]}</small>
                </dd>
              </div>
            ))}
          {story.alarmId ? (
            <div>
              <dt>The alarm</dt>
              <dd data-story-baseline-alarm>{alarmState(baseline)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Read at</dt>
            <dd data-story-baseline-time>{baseline.timeSeconds.toFixed(2)} simulated seconds</dd>
          </div>
        </dl>
        <p data-story-change-scope>{story.changeScope}</p>
      </section>
      <fieldset
        className={stageStyles.choiceList}
        disabled={Boolean(committedId)}
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
            frames={mcsVerdictFrames(story.item)}
            alternatives={story.item.choices}
            explanation={story.item.explanation}
            evidenceIds={story.item.evidenceIds}
          />
        </div>
      ) : (
        <button
          type="button"
          className={shellStyles.nowPrimary}
          disabled={!selectedId}
          onClick={onCommit}
          data-story-commit
        >
          Compare prediction
        </button>
      )}{' '}
      <div className={styles.optionalActions}>
        <button type="button" onClick={() => setHintVisible(true)}>
          Hint
        </button>
        {hintVisible ? <p>{story.axisVerdict}</p> : null}
        <button type="button" onClick={onRun}>
          Show explanation and worked example
        </button>
        <button
          type="button"
          onClick={() => {
            setHintVisible(false)
            onRetry()
          }}
        >
          Try again
        </button>
      </div>
      {ran ? <p>{story.item.explanation}</p> : null}
      <p>Provided example on a separate model; no action is applied to your current patient.</p>
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
    </article>
  )
}
