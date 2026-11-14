'use client'

import { mcsCapstoneScenarios, mcsLessons, mcsPracticeScenarios } from '../content'
import styles from './mechanical-circulatory-support.module.css'

/**
 * What Learn, Practice and Integrated cases actually are, and how many of each thing exists.
 *
 * The module said "LEARN → PRACTICE → CHALLENGE" without ever saying what changes between them, and
 * used "case" for three different things: a patient case with its own state, a guided section, and
 * an open studio with no assignment at all. A learner could not tell where they were or what was
 * expected of them.
 *
 * It sits in the hub's "About this module", under that disclosure's "How it is organised" heading,
 * so it carries no heading of its own. Lines that only told a learner what they may skip
 * ("Predictions are optional…", "continue without performing an action") went with the hub's
 * 2026-10-17 simplification.
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
        'What changed is shown as a before-and-after comparison, explained, and carried to a patient whose loading has changed.',
      ],
      guidance: 'Fully coached',
    },
    {
      id: 'practice',
      label: 'Practice',
      countLabel: `${mcsPracticeScenarios.length} patient cases, plus an open studio`,
      whatItIs:
        'Patient cases with a presentation, the device controls, and a worked explanation — and a Mechanism Studio, which is an open sandbox on the reference patient rather than a case.',
      howItRuns: [
        'The case states the presentation and lets you inspect before you decide.',
        'Coaching is shorter here: you act, watch the response, and read the reasoning in the debrief.',
        'The Mechanism Studio has no case, no question and no debrief. It is there to change one variable and watch the whole system answer.',
      ],
      guidance: 'Lightly coached',
    },
    {
      id: 'assess',
      label: 'Integrated cases',
      countLabel: `${mcsCapstoneScenarios.length} optional integrated cases, one per device track`,
      whatItIs:
        'Cases that combine previously introduced concepts, with teaching available throughout.',
      howItRuns: [],
      guidance: 'Optional walkthrough',
    },
  ] as const

  return (
    <div className={styles.routeOrientation} data-route-orientation>
      <p>
        The same circulation, the same monitor, and the same anatomy run underneath all three
        routes.
      </p>
      <div className={styles.routeGrid}>
        {routes.map((route) => (
          <article key={route.id} data-route={route.id}>
            <span>{route.label}</span>
            <strong>{route.countLabel}</strong>
            <p>{route.whatItIs}</p>
            {route.howItRuns.length > 0 ? (
              <ul>
                {route.howItRuns.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            <small>{route.guidance}</small>
          </article>
        ))}
      </div>
    </div>
  )
}
