'use client'

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { teachingDemonstration } from '../../content/teachingExamples'
import { suiteViewForStep } from '../../content/suiteViews'
import {
  imagingLearningActivities,
  type ImagingLearningActivity,
} from '../../content/learningActivities'
import type { ImagingSectionId } from '../../content/pathway'
import { emptyLabState, labStateAfterChange } from '../../engine/labGoalEvaluation'
import type { LabValues } from '../../engine/labMetrics'
import { ImagingSuitePane } from '../suite/ImagingSuitePane'
import type { SuiteViewMemory } from '../suite/types'
import { TeachingPanels } from './TeachingPanels'
import { ReconstructionComparison } from './ReconstructionComparison'
import styles from './imaging-stage.module.css'

/** A demonstration owns all its state, including image captures. No learner reducer is called. */
export function LessonDemonstration({
  sectionId,
  activity = imagingLearningActivities(sectionId)[0],
  onRepresentationReady,
  savedViewMemory,
}: {
  sectionId: ImagingSectionId
  activity?: ImagingLearningActivity
  savedViewMemory?: MutableRefObject<SuiteViewMemory>
  onRepresentationReady?: (ready: boolean) => void
}) {
  const demo = teachingDemonstration(sectionId)
  const examples =
    demo?.examples.filter(
      (example) => !activity.examples || activity.examples.includes(example.title),
    ) ?? []
  const [index, setIndex] = useState(0)
  const [changes, setChanges] = useState<LabValues>({})
  const [replay, setReplay] = useState(0)
  const localViewMemory = useRef<SuiteViewMemory>({})
  const viewMemory = savedViewMemory ?? localViewMemory
  const example = examples[index] ?? examples[0]
  const base = suiteViewForStep(sectionId)
  const view = {
    ...(sectionId === 'dts-interpretation'
      ? { ...base, lab: demo?.lab, bindings: suiteViewForStep('dts-acquisition').bindings }
      : base),
    controls: activity.controls ?? base.controls,
  }
  const lab = demo?.lab
    ? {
        ...emptyLabState(demo.lab, sectionId),
        values: { ...emptyLabState(demo.lab, sectionId).values, ...example?.values, ...changes },
      }
    : { values: {}, events: [] }
  const usesSuite = activity.visual === 'suite'
  useEffect(() => {
    if (!usesSuite) onRepresentationReady?.(true)
  }, [usesSuite, onRepresentationReady])
  return (
    <div data-lesson-demonstration className={styles.demonstration}>
      <p className={styles.kicker}>Worked demonstration · authored teaching example</p>
      {!usesSuite ? (
        activity.visual === 'reconstruction' ? (
          <ReconstructionComparison dense />
        ) : (
          <TeachingPanels
            sectionId={activity.visual === 'provenance' ? 'dts-interpretation' : sectionId}
          />
        )
      ) : (
        <>
          {demo && example && (
            <>
              <div className={styles.demoButtons} aria-label="Demonstration examples">
                {examples.length > 1 &&
                  examples.map((entry, i) => (
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
            </>
          )}
          <ImagingSuitePane
            key={replay}
            viewMemory={viewMemory}
            presentation={activity.presentation}
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
              viewMemory.current = {}
              setChanges({})
              setIndex(0)
              setReplay((n) => n + 1)
            }}
          />
          {example && (
            <p className={styles.lookFor} data-look-for>
              <strong>Look for…</strong> {example.look}
            </p>
          )}
        </>
      )}
    </div>
  )
}
