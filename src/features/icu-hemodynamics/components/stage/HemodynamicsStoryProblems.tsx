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
import styles from './hemodynamics-stage.module.css'

/**
 * The story problems, on a section's Explain step.
 *
 * Each is a sixty-second scenario in which a colleague reaches for the tempting control: the
 * learner commits an answer, and the verdict is followed by the readings an engine run of that
 * very story produced — before and after the move — so the axis lesson is shown, not asserted.
 * The run opens on the teaching patient as authored; the learner's own patient is untouched.
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
      <p>Decide what happens before the simulation shows you.</p>
      {stories.map((story) => (
        <StoryProblem key={story.id} story={story} />
      ))}
    </section>
  )
}

function StoryProblem({ story }: { readonly story: HemodynamicsStoryProblem }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [committed, setCommitted] = useState<string | null>(null)
  const run = useMemo(() => (committed ? runHemodynamicsStory(story) : null), [committed, story])

  return (
    <article
      className={styles.story}
      data-story={story.id}
      data-story-committed={committed !== null}
    >
      <h4>{story.title}</h4>
      {committed ? (
        <>
          <AnswerVerdict
            item={story.item}
            choiceId={committed}
            outcome="stated"
            timing="immediate-after-commit"
            theme="dark"
          />
          {run ? (
            <table className={stageStyles.compareTable} data-story-run>
              <caption className={shellStyles.kicker}>
                What the simulation did with the move
              </caption>
              <thead>
                <tr>
                  <th scope="col">Reading</th>
                  <th scope="col">Before</th>
                  <th scope="col">After</th>
                </tr>
              </thead>
              <tbody>
                {story.readings.map((reading) => {
                  const before = run.before[reading]
                  const after = run.after[reading]
                  const numeric = typeof before === 'number' && typeof after === 'number'
                  const direction = numeric
                    ? Math.abs(after - before) < 0.5
                      ? 'same'
                      : after > before
                        ? 'up'
                        : 'down'
                    : before === after
                      ? 'same'
                      : 'changed'
                  const format = (value: number | string | null) =>
                    value === null ? '—' : typeof value === 'number' ? value.toFixed(0) : value
                  return (
                    <tr key={reading}>
                      <th scope="row">{storyReadingLabels[reading]}</th>
                      <td>{format(before)}</td>
                      <td data-direction={direction}>{format(after)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : null}
          <p className={styles.axisVerdict} data-story-axis>
            {story.axisVerdict}
          </p>
        </>
      ) : (
        <>
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
          <button
            type="button"
            className={shellStyles.nowSecondary}
            disabled={!selected}
            onClick={() => selected && setCommitted(selected)}
          >
            Commit, then watch the move
          </button>
        </>
      )}
    </article>
  )
}
