'use client'

import type { ReactNode } from 'react'

import type { VentilationReferenceMarker } from '../content/referenceEvidence'
import type { VentilatorDeviceId, WaveformSample } from '../engine/types'
import { CapturedBreath } from './stage/CapturedBreath'

/**
 * A breath held still on the console's own screen.
 *
 * The one-breath inspection used to live in a separate "Experiment" panel under the console, with
 * its own Run and Pause; a learner met the simulator three different ways and had to work out which
 * one a step meant. The frozen breath is now drawn where the live traces are, on the same console,
 * and the live traces come back as soon as the clock runs again.
 */
export interface ConsoleInspection {
  /** The record the breath is drawn from: the captured baseline, or the live window. */
  readonly samples: readonly WaveformSample[]
  /** "Baseline breath · interval A", "Your last breath". */
  readonly label: string
  /** The authored identification marker on this breath, when the step asks about one. */
  readonly marker?: VentilationReferenceMarker
  /**
   * Whether the marker's sentence ("gas moving out, volume falling") may be printed. False before a
   * prediction about the marked interval is committed: the letter is drawn, the evidence is not.
   */
  readonly revealMarkerEvidence: boolean
  /** Use this captured interval: records the learner's reading of the breath, where a task asks. */
  readonly onInspect?: (sample: WaveformSample, previous: WaveformSample) => void
  readonly effort: boolean
}

export function ConsoleWaveformArea({
  className,
  deviceId,
  inspection,
  children,
}: {
  readonly className: string
  readonly deviceId: VentilatorDeviceId
  readonly inspection: ConsoleInspection | null | undefined
  /** The live trace stack the console draws when nothing is frozen. */
  readonly children: ReactNode
}) {
  if (!inspection) return <div className={className}>{children}</div>
  return (
    <div className={className} data-frozen-breath>
      <CapturedBreath
        label={inspection.label}
        samples={inspection.samples}
        marker={inspection.marker}
        onInspect={inspection.onInspect}
        effort={inspection.effort}
        revealMarkerEvidence={inspection.revealMarkerEvidence}
        compact
        palette={deviceId === 'drager-evita-v800-v600' ? 'light' : 'dark'}
      />
    </div>
  )
}
