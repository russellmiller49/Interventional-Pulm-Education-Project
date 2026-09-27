'use client'

import { useId, type ReactNode } from 'react'

import {
  CircuitSchematic,
  GasBlenderPanel,
  PatientMonitor,
  TrendPanel,
  type SimulationPanelProps,
} from '../CircuitAndMonitors'
import { STAGE_SURFACES, STAGE_SURFACE_LABELS, type StageSurfaceId } from '../stage/stageModel'
import styles from './EcmoActivityShell.module.css'

export interface EcmoSimulatorSurfacesProps extends SimulationPanelProps {
  /** The single console node, built once by the host. */
  readonly console: ReactNode
  readonly openSurfaces: ReadonlySet<StageSurfaceId>
  readonly onToggleSurface: (surface: StageSurfaceId, open: boolean) => void
  /** Rendered between the console and the surfaces: the safety indicators that never hide. */
  readonly safety?: ReactNode
  /** Focused lessons mount only the selected views, with no hidden answer-bearing panels. */
  readonly surfaceIds?: readonly StageSurfaceId[]
  /**
   * Disclosure surfaces rendered before the console rather than after it, when the reading the step
   * acts on lives there (the patient monitor, in an oxygenation case). Order only; each stays a
   * disclosure the learner can open or close.
   */
  readonly leadingSurfaces?: readonly StageSurfaceId[]
}

/**
 * The host's console and selected monitor surfaces.
 *
 * Focused lessons mount only `surfaceIds` in document flow. Without that selection, the original
 * disclosures remain: each surface stays mounted whether open or closed so every
 * `cardiohelp-*` control id remains unique and present in the document, a step's focus jump can
 * open the surface and then find the control, and a closed trend panel keeps its selected channel.
 * Which surfaces open is the caller's decision, declared per step or stage and applied on entry.
 */
export function EcmoSimulatorSurfaces({
  console: consoleNode,
  openSurfaces,
  onToggleSurface,
  safety,
  surfaceIds,
  leadingSurfaces,
  ...panelProps
}: EcmoSimulatorSurfacesProps) {
  const baseId = useId()
  const panels: Readonly<Record<StageSurfaceId, ReactNode>> = {
    circuit: <CircuitSchematic {...panelProps} />,
    gas: <GasBlenderPanel {...panelProps} />,
    monitor: (
      <PatientMonitor
        state={panelProps.state}
        guidedTarget={panelProps.guidedTarget}
        guidedControlId={panelProps.guidedControlId}
      />
    ),
    trends: (
      <TrendPanel
        state={panelProps.state}
        guidedTarget={panelProps.guidedTarget}
        guidedControlId={panelProps.guidedControlId}
      />
    ),
  }

  function disclosure(surface: StageSurfaceId) {
    const open = openSurfaces.has(surface)
    const panelId = `${baseId}-${surface}`
    return (
      <section key={surface} className={styles.surface} data-surface={surface} data-open={open}>
        <h2 className={styles.surfaceHeading}>
          <button
            type="button"
            className={styles.surfaceToggle}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => onToggleSurface(surface, !open)}
          >
            <span>{STAGE_SURFACE_LABELS[surface]}</span>
            <span className={styles.surfaceToggleHint} aria-hidden="true">
              {open ? 'Hide' : 'Show'}
            </span>
          </button>
        </h2>
        <div id={panelId} className={styles.surfaceBody} hidden={!open}>
          {panels[surface]}
        </div>
      </section>
    )
  }

  const leading = surfaceIds ? [] : (leadingSurfaces ?? [])
  return (
    <div className={styles.surfaces} data-simulator-surfaces>
      {leading.map((surface) => disclosure(surface))}
      {consoleNode}
      {safety}
      {(surfaceIds ?? STAGE_SURFACES).map((surface) => {
        if (surfaceIds)
          return (
            <div key={surface} data-surface={surface} data-open="true">
              {panels[surface]}
            </div>
          )
        if (leading.includes(surface)) return null
        return disclosure(surface)
      })}
    </div>
  )
}
