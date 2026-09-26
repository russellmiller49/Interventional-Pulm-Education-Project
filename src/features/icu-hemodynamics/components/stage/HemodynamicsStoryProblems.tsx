'use client'

import { useMemo, useState } from 'react'

import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'

import type { HemodynamicsSectionId } from '../../content/sectionSpecs'
import {
  hemodynamicsStoryProblemsFor,
  runHemodynamicsStory,
  storyReadingLabels,
  type HemodynamicsStoryProblem,
} from '../../content/storyProblems'
import { HemodynamicsExplanation } from './HemodynamicsQuestion'
import styles from './hemodynamics-stage.module.css'

/**
 * The story problems, on a section's Explain step.
 *
 * Each is a sixty-second scenario in which a colleague reaches for the tempting control. The
 * learner can decide first and check, or open what happens straight away (HD-01: optional, with the
 * explanation available before an answer). Either way the readings an engine run of that very story
 * produced — before and after the move — follow, so the axis lesson is shown, not asserted. The run
 * opens on the teaching patient as authored; the learner's own patient is untouched, and the run is
 * the simulation's move, never the learner's.
 */
export function HemodynamicsStoryProblems({
  sectionId,
}: {
  readonly sectionId: HemodynamicsSectionId
}) {
  const stories = hemodynamicsStoryProblemsFor(sectionId)
  if (stories.length === 0) return null
  return (
    <section className={styles.stories} data-story-problems aria-label="Story problems">
      <p className={styles.kicker}>
        {stories.length === 1
          ? 'One story problem'
          : `${stories.length === 2 ? 'Two' : stories.length} story problems`}
      </p>
      <h3>A colleague reaches for the tempting control</h3>
      <p>Decide what happens and check it, or open what happens directly.</p>
      {stories.map((story) => (
        <StoryProblem key={story.id} story={story} />
      ))}
    </section>
  )
}

function StoryProblem({ story }: { readonly story: HemodynamicsStoryProblem }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [committed, setCommitted] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const revealed = committed !== null || shown
  const run = useMemo(() => (revealed ? runHemodynamicsStory(story) : null), [revealed, story])

  return (
    <article
      className={styles.story}
      data-story={story.id}
      data-story-committed={committed !== null}
      data-story-shown={shown && committed === null}
    >
      <h4>{story.title}</h4>
      {committed ? (
        <AnswerVerdict
          item={story.item}
          choiceId={committed}
          outcome="stated"
          timing="immediate-after-commit"
          theme="dark"
        />
      ) : (
        <fieldset className={stageStyles.choiceList} data-story-choices>
          <legend>{story.item.stem}</legend>
          {orderChoices(story.item.id, story.item.choices).map((choice) => (
            <label
              key={choice.id}
              className={stageStyles.choice}
              data-selected={selected === choice.id}
            >
              <input
                type="radio"
                name={`story-${story.id}`}
                value={choice.id}
                checked={selected === choice.id}
                onChange={() => setSelected(choice.id)}
              />
              <span>{choice.label}</span>
            </label>
          ))}
        </fieldset>
      )}
      <div className={stageStyles.completionActions}>
        {committed ? (
          <button
            type="button"
            className={shellStyles.nowSecondary}
            onClick={() => {
              setCommitted(null)
              setSelected(null)
            }}
          >
            Try again
          </button>
        ) : (
          <>
            <button
              type="button"
              className={shellStyles.nowSecondary}
              disabled={!selected}
              onClick={() => selected && setCommitted(selected)}
            >
              Check, then watch the move
            </button>
            <button
              type="button"
              className={shellStyles.nowSecondary}
              aria-expanded={shown}
              onClick={() => setShown((current) => !current)}
            >
              {shown ? 'Hide what happens' : 'Show what happens'}
            </button>
          </>
        )}
      </div>
      {shown && !committed ? (
        <HemodynamicsExplanation
          item={story.item}
          heading="What happens"
          note="Opened without an answer. The run below is the simulation's own move on the teaching patient."
        />
      ) : null}
      {run ? (
        <>
          <table className={stageStyles.compareTable} data-story-run>
            <caption className={shellStyles.kicker}>What the simulation did with the move</caption>
            <thead>
              <tr>
                <th scope="col">Reading</th>
                <th scope="col">Before</th>
                <th scope="col">After</th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              {story.readings.map((reading) => {
                const before = run.before[reading]
                const after = run.after[reading]
                const numeric = typeof before === 'number' && typeof after === 'number'
                // Unrounded model estimates of the same quantity either side of the move, shown to
                // a tenth of a mmHg: a pure offset reads as the same change on every row and none
                // on the pulse pressure (HD-PRE-REVIEW-02, report L2-14).
                const change = numeric ? after - before : null
                const direction = numeric
                  ? Math.abs(after - before) < 0.05
                    ? 'same'
                    : after > before
                      ? 'up'
                      : 'down'
                  : before === after
                    ? 'same'
                    : 'changed'
                const format = (value: number | string | null) =>
                  value === null ? '—' : typeof value === 'number' ? value.toFixed(1) : value
                return (
                  <tr key={reading}>
                    <th scope="row">{storyReadingLabels[reading]}</th>
                    <td>{format(before)}</td>
                    <td data-direction={direction}>{format(after)}</td>
                    <td data-change>
                      {change === null
                        ? '—'
                        : direction === 'same'
                          ? 'none'
                          : `${change > 0 ? '+' : '−'}${Math.abs(change).toFixed(1)}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className={styles.dockNote} data-story-provenance>
            The model’s own estimates of the pressures, read from the same model state just before
            and just after the move — not two different beats of the moving trace — and shown to a
            tenth of a mmHg.
          </p>
          <p className={styles.axisVerdict} data-story-axis>
            {story.axisVerdict}
          </p>
        </>
      ) : null}
    </article>
  )
}
