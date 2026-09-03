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
}

/**
 * The console, always present, and the four monitor surfaces behind disclosures.
 *
 * Each surface stays mounted whether open or closed — closed is `hidden`, not gone — so every
 * `cardiohelp-*` control id remains unique and present in the document, a step's focus jump can
 * open the surface and then find the control, and a closed trend panel keeps its selected channel.
 * Which surfaces open is the caller's decision, declared per step or stage and applied on entry.
 */
export function EcmoSimulatorSurfaces({
  console: consoleNode,
  openSurfaces,
  onToggleSurface,
  safety,
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

  return (
    <div className={styles.surfaces} data-simulator-surfaces>
      {consoleNode}
      {safety}
      {STAGE_SURFACES.map((surface) => {
        const open = openSurfaces.has(surface)
        const panelId = `${baseId}-${surface}`
        return (
          <section key={surface} className={styles.surface} data-surface={surface} data-open={open}>
            <h3 className={styles.surfaceHeading}>
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
            </h3>
            <div id={panelId} className={styles.surfaceBody} hidden={!open}>
              {panels[surface]}
            </div>
          </section>
        )
      })}
    </div>
  )
}
