'use client'

import { useMemo, useState } from 'react'

import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'

import { labMetricLabels } from '../../engine/learningLab'
import {
  runVentilationStory,
  ventilationStoryProblemsFor,
  type VentilationStoryProblem,
} from '../../content/storyProblems'
import styles from './ventilation-stage.module.css'

/**
 * The story problems, on a section's Explain step.
 *
 * Each is a sixty-second scenario in which the tempting control visibly fails: the learner commits
 * an answer, and the verdict is followed by the readings an engine run of that very story produced —
 * before and after — so the axis lesson is shown, not asserted.
 */
export function VentilationStoryProblems({ unitId }: { readonly unitId: string }) {
  const stories = ventilationStoryProblemsFor(unitId)
  if (stories.length === 0) return null
  return (
    <section className={styles.block} data-story-problems aria-label="Two story problems">
      <p className={styles.kicker}>Two story problems</p>
      <h3>Which control is this a job for?</h3>
      <p>
        Each is a scenario with one tempting control. Decide what happens before the run shows you.
      </p>
      {stories.map((story) => (
        <StoryProblem key={story.id} story={story} />
      ))}
    </section>
  )
}

function StoryProblem({ story }: { readonly story: VentilationStoryProblem }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [committed, setCommitted] = useState<string | null>(null)
  const run = useMemo(() => (committed ? runVentilationStory(story) : null), [committed, story])

  return (
    <article
      className={styles.walk}
      data-story={story.id}
      data-story-committed={committed !== null}
    >
      <h4 style={{ margin: 0 }}>{story.title}</h4>
      <p>{story.scenario}</p>
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
              <caption className={shellStyles.kicker}>What the run showed</caption>
              <thead>
                <tr>
                  <th scope="col">Reading</th>
                  <th scope="col">Before</th>
                  <th scope="col">After</th>
                </tr>
              </thead>
              <tbody>
                {story.triad.map((metric) => {
                  const digits = labMetricLabels[metric].digits
                  const before = run.before[metric]
                  const after = run.after[metric]
                  const direction =
                    Math.abs(after - before) < 0.5 * 10 ** -digits
                      ? 'same'
                      : after > before
                        ? 'up'
                        : 'down'
                  return (
                    <tr key={metric}>
                      <th scope="row">
                        {labMetricLabels[metric].label} ({labMetricLabels[metric].unit})
                      </th>
                      <td>{before.toFixed(digits)}</td>
                      <td data-direction={direction}>{after.toFixed(digits)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : null}
          <p data-story-axis>
            <strong>{story.axisVerdict}</strong>
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
                  name={`mv-story-${story.id}`}
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
            disabled={selected === null}
            onClick={() => setCommitted(selected)}
            data-story-commit
          >
            Commit and run it
          </button>
        </>
      )}
    </article>
  )
}
