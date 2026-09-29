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
 * in; letting air in takes it the rest of the way, an authored relationship awaiting clinical review
 * (owner decisions, T2). It never comes back: re-expansion is not modelled.
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
  letAirIn: 'Let air in',
  airIn: 'Air is in: the lung has fallen away as far as this model takes it.',
  startAgain: 'Start again',
  drawAsCut: 'Show the Chest view as a cut',
  drawIn3d: 'Draw the Chest view in three dimensions',
  lungLabel:
    'The lung falling away as air comes in is an authored relationship. It has not been clinically reviewed.',
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
      <div className={styles.prototypeControls}>
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
