'use client'

import { useCallback, useMemo, useRef, type ReactNode } from 'react'

import { DolphinAirwayEmbedDynamic } from '@/components/airway-anatomy/AirwayAnatomyModuleDynamic'
import type { AirwayAnatomyEmbedOptions } from '@/components/airway-anatomy/AirwayAnatomyModule'
import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'
import type { AirwayScopeLocation } from '@/lib/airway-anatomy/scope-location'

import { DOLPHIN_SCOPE_STARTS } from '../../content/scopeStarts'
import type { DolphinScopeWorkspace } from '../../content/types'
import type { BreathCuePhase } from '../../engine/scopeGoals'
import styles from '../stage/dolphin-stage.module.css'
import { BreathCue } from './BreathCue'

/**
 * The dolphin synchronized bronchoscopy inside a section: the same module as the standalone page,
 * through its `embed` options — the section's start, its label rule, no header or mode strip, and
 * the CT and 3D tree only where the section reads them. Every change of edge is reported with the
 * breathing cue's phase at that moment.
 */
export function DolphinScopePane({
  workspace,
  startKey,
  target,
  onLocation,
  overlay,
  lightweightAlternativeHref,
}: {
  readonly workspace: DolphinScopeWorkspace
  /** Changing it moves the scope back to the workspace's start. */
  readonly startKey: string
  readonly target?: { readonly abbr: string; readonly showBeacon: boolean } | null
  readonly onLocation: (location: AirwayScopeLocation, cuePhase: BreathCuePhase | null) => void
  /** Drawn over the top of the pane: a drill's target card. */
  readonly overlay?: ReactNode
  readonly lightweightAlternativeHref?: string
}) {
  const start = DOLPHIN_SCOPE_STARTS[workspace.start]
  const cuePhase = useRef<BreathCuePhase | null>(workspace.breathCue ? 'closed' : null)
  const onCuePhase = useCallback((phase: BreathCuePhase) => {
    cuePhase.current = phase
  }, [])
  const embed = useMemo<AirwayAnatomyEmbedOptions>(
    () => ({
      start: {
        edgeId: start.edgeId,
        distanceMm: start.distanceMm,
        yawDeg: start.yawDeg,
        pitchDeg: start.pitchDeg,
        key: startKey,
      },
      branchLabels: workspace.labels,
      showLocation: workspace.showLocation,
      chrome: {
        header: false,
        modeStrip: false,
        ct: workspace.ct ?? false,
        tree: workspace.tree ?? false,
      },
      onLocationChange: (location) => onLocation(location, cuePhase.current),
      target: target ?? null,
    }),
    [start, startKey, workspace, target, onLocation],
  )
  const sizeLabel = workspace.ct ? 'about 36 MB' : 'about 5 MB'
  return (
    <figure className={styles.simulatorFigure} data-dolphin-scope-pane={workspace.start}>
      <SimulationLaunchGate
        activityTitle="The dolphin airway simulator"
        minimumViewport="tablet"
        bandwidthClass="heavy"
        estimatedSizeLabel={sizeLabel}
        lightweightAlternativeHref={lightweightAlternativeHref}
        theme="dark"
      >
        <div className={styles.scopeStage} data-landmark="Bronchoscope view">
          {workspace.breathCue ? <BreathCue onPhase={onCuePhase} /> : null}
          {overlay}
          <DolphinAirwayEmbedDynamic embed={embed} />
        </div>
      </SimulationLaunchGate>
      <figcaption className={styles.paneCaption}>{workspace.caption}</figcaption>
    </figure>
  )
}
