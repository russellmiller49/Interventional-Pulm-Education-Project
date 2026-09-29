'use client'

import { useState } from 'react'

import { assertThoracoscopyCopy } from '../../content/learnerCopy'
import { outcomeStanding } from '../../engine/space/outcomes'
import styles from '../space/space-pane.module.css'
import { SpacePane } from '../space/SpacePane'
import { useSpaceEngine, type SpaceEngineStart } from '../space/useSpaceEngine'
import { useReducedMotion } from '../space/useSpaceSupport'

/**
 * An engineering prototype of the pleural space (slice 11): the engine, the 3D scene and the cut,
 * with no lesson around them. It is outside the curriculum and the progress record, and records
 * nothing. The lung starts part-way fallen, since the telescope has no room at the port before air is
 * in. Until the lung-change claim (MT-C-0002) is clinically reviewed, the lung's fallen-away state is
 * an explicitly labelled, authored teaching state the page plays, never a physiological consequence
 * of anything the learner does (owner decision OD-11, which supersedes T2's default). The amount of
 * collapse is the model's, unchanged. It never comes back: re-expansion is not modelled.
 */
const START: SpaceEngineStart = {
  scenario: 'space-prototype',
  lungStep: 4,
  pose: { tiltAcrossRibsDeg: 0, tiltAlongRibsDeg: 0, depthMm: 12, rollDeg: 0 },
}
const LAST_LUNG_STEP = 8

export const PROTOTYPE_WORDS = {
  heading: 'The pleural space: engineering prototype',
  purpose:
    'This page shows the model of the pleural space and the scene the survey lesson will use, with no lesson around them. It is not a lesson, it records nothing, and nothing on it has been clinically reviewed.',
  authoredHeading: 'Authored teaching state',
  letAirIn: 'Play the authored lung change',
  airIn:
    'The authored teaching state is shown: the lung has fallen away as far as this model takes it.',
  startAgain: 'Start again',
  drawAsCut: 'Show the Chest view as a cut',
  drawIn3d: 'Draw the Chest view in three dimensions',
  lungLabel:
    'The page plays this as an authored teaching sequence. It is not a response to anything you do and not a simulation of how a lung behaves, and it has not been clinically reviewed.',
} as const

assertThoracoscopyCopy(
  Object.entries(PROTOTYPE_WORDS).map(([key, text]) => ({
    where: `prototype ${key}`,
    text,
    options: { allowDigits: false },
  })),
)

export function SpacePrototype() {
  const reducedMotion = useReducedMotion()
  const [run, setRun] = useState(0)
  const [drawIn3d, setDrawIn3d] = useState(true)
  return (
    <section className={styles.prototype} aria-labelledby="space-prototype-heading">
      <h1 id="space-prototype-heading">{PROTOTYPE_WORDS.heading}</h1>
      <p>{PROTOTYPE_WORDS.purpose}</p>
      <div className={styles.prototypeControls}>
        <button type="button" className={styles.actionButton} onClick={() => setRun((n) => n + 1)}>
          {PROTOTYPE_WORDS.startAgain}
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => setDrawIn3d((value) => !value)}
          aria-pressed={!drawIn3d}
        >
          {drawIn3d ? PROTOTYPE_WORDS.drawAsCut : PROTOTYPE_WORDS.drawIn3d}
        </button>
      </div>
      <SpaceRun key={run} reducedMotion={reducedMotion} drawIn3d={drawIn3d} />
    </section>
  )
}

function SpaceRun({
  reducedMotion,
  drawIn3d,
}: {
  readonly reducedMotion: boolean
  readonly drawIn3d: boolean
}) {
  const session = useSpaceEngine(START, { reducedMotion })
  const { paneState } = session
  const ready = paneState.readiness.kind === 'ready'
  const fallen = paneState.lungStep === LAST_LUNG_STEP
  const standing = outcomeStanding('lung-falls-away')
  return (
    <>
      <div
        className={styles.prototypeControls}
        role="group"
        aria-label={PROTOTYPE_WORDS.authoredHeading}
        data-authored-teaching-state
      >
        <p className={styles.viewNote}>
          <strong>{PROTOTYPE_WORDS.authoredHeading}</strong>
        </p>
        <button
          type="button"
          className={styles.actionButton}
          disabled={!ready || fallen}
          onClick={() => session.setLungTarget(LAST_LUNG_STEP)}
        >
          {PROTOTYPE_WORDS.letAirIn}
        </button>
        <p className={styles.viewNote} data-lung-step={paneState.lungStep}>
          {fallen ? `${PROTOTYPE_WORDS.airIn} ` : ''}
          {/* said whenever the change is on offer or shown, until its claim is reviewed */}
          {standing.kind === 'authored-awaiting-review' ? PROTOTYPE_WORDS.lungLabel : ''}
        </p>
      </div>
      <SpacePane
        state={paneState}
        space={session.space}
        shown={['scope']}
        operable={['scope']}
        reducedMotion={reducedMotion}
        onCommand={session.onCommand}
        drawIn3d={drawIn3d}
      />
    </>
  )
}
