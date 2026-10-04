'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { VentilationStageLesson } from '../../content/stageLessons'
import type { VentilatorDeviceId } from '../../engine/types'
import { createLabSimulation } from '../../engine/learningLab'
import { VentilationProtectionReference } from '../VentilationLearningVisuals'
import { CapturedBreath } from './CapturedBreath'
import styles from './task-flow.module.css'

export function NormalTimingReference() {
  const figure = useRef<HTMLElement>(null)
  const [width, setWidth] = useState(360)
  useEffect(() => {
    if (!figure.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(180, entry.contentRect.width)),
    )
    observer.observe(figure.current)
    return () => observer.disconnect()
  }, [])
  const scaleX = width / 360
  return (
    <figure ref={figure} className={styles.block} data-normal-timing>
      <figcaption>
        Worked normal timing · conceptual illustration, separate from the patient
      </figcaption>
      <svg
        viewBox={`0 0 ${width} 140`}
        role="img"
        aria-label="In this conceptual reference, patient inspiratory effort starts just before machine inspiration; their endings align. Start and end are separate events."
      >
        <text x="10" y="16" fill="currentColor" fontSize="12">
          Patient effort · model
        </text>
        <path
          d="M25 45 L72 45 L85 28 L183 28 L195 45 L335 45"
          transform={`scale(${scaleX} 1)`}
          vectorEffect="non-scaling-stroke"
          stroke="#ffcf85"
          strokeWidth="3"
          fill="none"
        />
        <text x="10" y="72" fill="currentColor" fontSize="12">
          Machine inspiration
        </text>
        <path
          d="M25 102 L85 102 L85 82 L195 82 L195 102 L335 102"
          transform={`scale(${scaleX} 1)`}
          vectorEffect="non-scaling-stroke"
          stroke="#71e1e5"
          strokeWidth="3"
          fill="none"
        />
        <path
          d="M85 23 L85 111 M195 23 L195 111"
          transform={`scale(${scaleX} 1)`}
          vectorEffect="non-scaling-stroke"
          stroke="#aec5c8"
          strokeDasharray="3 3"
        />
        <text x={85 * scaleX} y="132" textAnchor="middle" fill="currentColor" fontSize="12">
          Trigger
        </text>
        <text x={195 * scaleX} y="132" textAnchor="middle" fill="currentColor" fontSize="12">
          Cycling
        </text>
      </svg>
      <p>
        Compare the start of effort with the start of machine inspiration. Then compare their
        endings. Use the same start and end landmarks when inspecting the current patient.
      </p>
    </figure>
  )
}

/**
 * The reference a mechanism section's reading step points at: the normal timing illustration, a
 * separate normal passive breath, or the guideline reference. Separate from the patient on purpose,
 * and never that patient's keyed solution. Null when the section has none.
 */
export function MechanismReadingEvidence({
  lesson,
  device,
}: {
  lesson: VentilationStageLesson
  device: VentilatorDeviceId
}) {
  const { unit } = lesson
  const normal = useMemo(() => createLabSimulation('breathing-with-support', 0, device), [device])
  const systematic = unit.id === 'waveform-reading-sequence'
  const normalTiming = ['triggering-and-cycling', 'dyssynchrony-mechanisms'].includes(unit.id)
  const normalBreath = unit.id === 'expiration-and-air-trapping' || systematic
  if (!normalTiming && !normalBreath && unit.id !== 'lung-protection') return null
  return (
    <div data-prerequisite-teaching data-lesson-part="evidence">
      {normalTiming ? <NormalTimingReference /> : null}
      {normalBreath ? (
        <CapturedBreath
          label="Separate normal reference · complete passive breath"
          samples={normal.waveforms}
          guided
          stop={systematic ? undefined : 'expiration'}
        />
      ) : null}
      {unit.id === 'lung-protection' ? <VentilationProtectionReference /> : null}
    </div>
  )
}

/** The section's separate worked example; null for the integration section, which withholds one. */
export function MechanismWorkedExample({ lesson }: { lesson: VentilationStageLesson }) {
  const { unit } = lesson
  if (unit.id === 'high-peak-pressure-integration') return null
  if (unit.id === 'waveform-reading-sequence')
    return (
      <div data-worked-example>
        <p>
          In the passive reference above, a regular machine breath starts without patient effort.
          Pressure and inward flow accompany rising volume, then flow turns outward as volume falls.
        </p>
        <p>
          Read this normal breath in order before inspecting the new patient. An unusual rate alone
          will not establish a mechanism.
        </p>
      </div>
    )
  if (unit.id === 'triggering-and-cycling')
    return (
      <div data-worked-example>
        <p>
          Use the normal timing illustration above: effort begins, the machine follows, and
          inspiration ends in agreement. The starting relationship concerns triggering; the ending
          relationship concerns cycling.
        </p>
        <p>Next, apply these two separate checks to a different patient’s unlabelled tracing.</p>
      </div>
    )
  return (
    <div data-worked-example>
      <p>{unit.example.situation}</p>
      <ol>
        {unit.example.reasoning.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <p>{unit.example.conclusion}</p>
    </div>
  )
}
