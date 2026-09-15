'use client'

import { mcsCapstoneScenarios, mcsLessons, mcsPracticeScenarios } from '../content'
import styles from './mechanical-circulatory-support.module.css'

/**
 * What Learn, Practice and Challenge actually are, and how many of each thing exists.
 *
 * The module said "LEARN → PRACTICE → CHALLENGE" without ever saying what changes between them, and
 * used "case" for three different things: a patient case with its own state, a guided section, and
 * an open studio with no patient at all. A learner could not tell where they were or what was
 * expected of them.
 *
 * Every count here is derived from the arrays that produce the activities, so the page cannot
 * advertise a case the runtime does not have.
 */
export function McsRouteOrientation() {
  const routes = [
    {
      id: 'learn',
      label: 'Learn',
      countLabel: `${mcsLessons.length} guided sections`,
      whatItIs:
        'Guided sections, each with one patient problem, one support pathway, and one thing to notice.',
      howItRuns: [
        'Every section names the clinical question before it asks for anything.',
        'Predictions are optional. Show the explanation, try an answer, retry, or continue at any time.',
        'Try the suggested control, explore other supported controls, or continue without performing an action.',
        'What changed is shown as a before-and-after comparison, explained, and carried to a patient whose loading has changed.',
      ],
      guidance: 'Fully coached',
    },
    {
      id: 'practice',
      label: 'Practice',
      countLabel: `${mcsPracticeScenarios.length} patient cases, plus an open studio`,
      whatItIs:
        'Patient cases with a presentation, supported controls, and a worked explanation — and a Mechanism Studio, which is a free workspace rather than a case.',
      howItRuns: [
        'The case states the presentation and lets you inspect before you decide.',
        'Coaching is shorter here: you act, watch the modeled response, and read the reasoning in the debrief.',
        'The Mechanism Studio has no patient and no debrief. It is there to change one variable and watch the whole system answer.',
      ],
      guidance: 'Lightly coached',
    },
    {
      id: 'assess',
      label: 'Integrated cases',
      countLabel: `${mcsCapstoneScenarios.length} optional integrated cases, one per device track`,
      whatItIs:
        'Cases that combine previously introduced concepts, with teaching and supported controls available throughout.',
      howItRuns: [
        'Every integrated case is open from the start.',
        'Open the worked explanation without answering or following a checklist.',
        'Safety interruptions still appear immediately, whatever you have chosen.',
      ],
      guidance: 'Optional walkthrough',
    },
  ] as const

  return (
    <section className={styles.routeOrientation} aria-labelledby="mcs-route-orientation-heading">
      <div className={styles.sectionHeading}>
        <span className={styles.kicker}>WHERE YOU ARE</span>
        <h2 id="mcs-route-orientation-heading">Three routes, and what changes between them</h2>
        <p>
          The same circulation, the same monitor, and the same anatomy run underneath all three.
          Choose the format that helps you explore the topic.
        </p>
      </div>
      <div className={styles.routeGrid}>
        {routes.map((route) => (
          <article key={route.id} data-route={route.id}>
            <span>{route.label}</span>
            <strong>{route.countLabel}</strong>
            <p>{route.whatItIs}</p>
            <ul>
              {route.howItRuns.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <small>{route.guidance}</small>
          </article>
        ))}
      </div>
    </section>
  )
}
