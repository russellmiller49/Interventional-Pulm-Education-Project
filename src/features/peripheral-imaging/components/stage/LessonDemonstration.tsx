'use client'

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { Link } from '@/i18n/navigation'
import { demonstrationOrigin } from '../../content/demonstrationOrigins'
import { imagingSectionLinkTarget } from '../../content/pathwayResolver'
import { RECONSTRUCTION_ACCOUNTS } from '../../content/reconstruction'
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
  // Reports 2.8 and 3.4: a demonstration first shown in an earlier section says so, links it, and
  // names what this section adds. The full demonstration stays.
  const reminder = demonstrationOrigin(sectionId, activity)
  useEffect(() => {
    if (!usesSuite) onRepresentationReady?.(true)
  }, [usesSuite, onRepresentationReady])
  return (
    <div data-lesson-demonstration className={styles.demonstration}>
      {/* Report CW2: the scene header already says "Authored teaching model"; the kicker no longer
          repeats it. */}
      <p className={styles.kicker} data-demonstration-kicker>
        Worked demonstration{reminder ? ' · reminder' : ''}
      </p>
      {reminder ? (
        <p className={styles.reminder} data-demonstration-reminder={reminder.sectionId}>
          First shown in{' '}
          <Link href={imagingSectionLinkTarget(reminder.sectionId)} data-demonstration-origin-link>
            Section {reminder.number}, {reminder.title}
          </Link>
          . <strong>New here:</strong> {reminder.newHere}
        </p>
      ) : null}
      {!usesSuite ? (
        activity.visual === 'reconstruction' ? (
          // Reports 4.1 and 5.1: the analogy and the figures lead, the details fold, and the section
          // that builds one of the two reconstructions leads with that one.
          <ReconstructionComparison
            lead={
              RECONSTRUCTION_ACCOUNTS.find((account) => account.shownIn === sectionId)?.id ?? 'both'
            }
          />
        ) : (
          <TeachingPanels sectionId={sectionId} visual={activity.visual} />
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
          {/* Report 2.9 (fellow walkthrough, PDF p.19): the cue sat under the figure and its controls,
              below the fold, so it was found after the image had already been explored. */}
          {example && (
            <p className={styles.lookFor} data-look-for>
              <strong>Look for…</strong> {example.look}
            </p>
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
        </>
      )}
    </div>
  )
}
