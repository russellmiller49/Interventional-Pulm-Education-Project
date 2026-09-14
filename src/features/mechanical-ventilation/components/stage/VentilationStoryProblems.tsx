'use client'

import { useMemo, useState } from 'react'

import { VentilationReinforcement } from '../VentilationReinforcement'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'

import { labMetricLabels } from '../../engine/learningLab'
import {
  runVentilationStory,
  ventilationStoryProblemsFor,
  type VentilationStoryProblem,
} from '../../content/storyProblems'
import styles from './ventilation-stage.module.css'

/** Optional stories and explicitly separate worked runs; revealing does not act on the live patient. */
export function VentilationStoryProblems({ unitId }: { readonly unitId: string }) {
  const stories = ventilationStoryProblemsFor(unitId)
  if (stories.length === 0) return null
  return (
    <section className={styles.block} data-story-problems aria-label="Two story problems">
      <p className={styles.kicker}>Two story problems</p>
      <h3>Which control is this a job for?</h3>
      <p>
        Each scenario contrasts a tempting control with the problem it can actually address.
        Predict, reveal, or compare the separate worked run.
      </p>
      {stories.map((story) => (
        <StoryProblem key={story.id} story={story} />
      ))}
    </section>
  )
}

function StoryProblem({ story }: { readonly story: VentilationStoryProblem }) {
  const [revealed, setRevealed] = useState(false)
  const run = useMemo(() => (revealed ? runVentilationStory(story) : null), [revealed, story])

  return (
    <article className={styles.walk} data-story={story.id} data-story-revealed={revealed}>
      <h4 style={{ margin: 0 }}>{story.title}</h4>
      <p>{story.scenario}</p>
      <VentilationReinforcement
        id={story.id}
        purpose="Separate the effect of this control from the clinical problem in the scenario."
        prompt={story.item.stem}
        choices={story.item.choices}
        explanation={story.item.explanation}
        hint={story.scenario}
      />
      <button type="button" className={shellStyles.nowSecondary} onClick={() => setRevealed(true)}>
        Compare a worked run
      </button>
      {revealed ? (
        <>
          {run ? (
            <table className={stageStyles.compareTable} data-story-run>
              <caption className={shellStyles.kicker}>
                Worked example · separate simulated run
              </caption>
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
      ) : null}
    </article>
  )
}
