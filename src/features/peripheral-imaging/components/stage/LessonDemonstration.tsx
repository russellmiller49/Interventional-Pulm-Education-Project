'use client'

import { useState } from 'react'
import { teachingDemonstration } from '../../content/teachingExamples'
import { suiteViewForStep } from '../../content/suiteViews'
import type { ImagingSectionId } from '../../content/pathway'
import { emptyLabState, labStateAfterChange } from '../../engine/labGoalEvaluation'
import type { LabValues } from '../../engine/labMetrics'
import { ImagingSuitePane } from '../suite/ImagingSuitePane'
import { TeachingPanels } from './TeachingPanels'
import styles from './imaging-stage.module.css'

export function LessonDemonstration({
  sectionId,
  onRepresentationReady,
}: {
  sectionId: ImagingSectionId
  onRepresentationReady?: (ready: boolean) => void
}) {
  const demo = teachingDemonstration(sectionId)
  const [index, setIndex] = useState(0)
  const [changes, setChanges] = useState<LabValues>({})
  const [replay, setReplay] = useState(0)
  const example = demo?.examples[index]
  const base = suiteViewForStep(sectionId)
  const view =
    sectionId === 'dts-interpretation'
      ? {
          ...base,
          lab: demo?.lab,
          bindings: suiteViewForStep('dts-acquisition').bindings,
          controls: ['sweep', 'plane'],
        }
      : base
  const lab = demo?.lab
    ? {
        ...emptyLabState(demo.lab, sectionId),
        values: { ...emptyLabState(demo.lab, sectionId).values, ...example?.values, ...changes },
      }
    : { values: {}, events: [] }
  return (
    <div data-lesson-demonstration className={styles.demonstration}>
      <p className={styles.kicker}>Worked demonstration · no attempt or completion credit</p>
      <TeachingPanels sectionId={sectionId} />
      {demo && example && (
        <>
          <div className={styles.demoButtons} aria-label="Demonstration examples">
            {demo.examples.map((entry, i) => (
              <button
                key={entry.title}
                type="button"
                aria-pressed={index === i}
                onClick={() => {
                  setIndex(i)
                  setChanges({})
                }}
              >
                {entry.title}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setIndex(0)
                setChanges({})
                setReplay((n) => n + 1)
              }}
            >
              Replay demonstration
            </button>
          </div>
          <p className={styles.lookFor} data-look-for>
            <strong>Look for…</strong> {example.look}
          </p>
        </>
      )}
      <ImagingSuitePane
        key={replay}
        onRepresentationReady={onRepresentationReady}
        view={view}
        lab={lab}
        controlsEnabled={!!demo}
        goals={[]}
        chainCaption={view.stopSentence}
        onLabChange={(patch) => {
          if (demo?.lab) setChanges(labStateAfterChange(demo.lab, lab, patch, sectionId).values)
        }}
        onLabReset={() => {
          setChanges({})
          setIndex(0)
          setReplay((n) => n + 1)
        }}
      />
    </div>
  )
}
