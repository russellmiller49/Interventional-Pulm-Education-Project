'use client'

import { useId, useRef, type KeyboardEvent } from 'react'

import styles from './crrt-pilot-circuit.module.css'

export interface CrrtPilotPressureSignals {
  access: number | null
  filter: number | null
  return: number | null
  effluent: number | null
  TMP: number | null
  filterDrop: number | null
}

export interface CrrtPilotCircuitProps {
  running: boolean
  setReady: boolean
  fluidsReady: boolean
  bloodFlowMlMin: number | null
  dialysateFlowMlHour: number | null
  patientFluidRemovalMlHour: number | null
  pressure: CrrtPilotPressureSignals
}

const pressureNodes: readonly {
  key: keyof CrrtPilotPressureSignals
  label: string
}[] = [
  { key: 'access', label: 'Access pressure' },
  { key: 'filter', label: 'Filter pressure' },
  { key: 'return', label: 'Return pressure' },
  { key: 'effluent', label: 'Effluent pressure' },
  { key: 'TMP', label: 'TMP' },
  { key: 'filterDrop', label: 'Filter pressure drop' },
]

const scales = [
  {
    id: 'effluent',
    label: 'Effluent',
    marker: 'Yellow circle',
    status: 'Active in CVVHD pilot',
    active: true,
  },
  {
    id: 'pbp',
    label: 'PBP',
    marker: 'White triangle',
    status: 'Inactive in CVVHD pilot',
    active: false,
  },
  {
    id: 'dialysate',
    label: 'Dialysate',
    marker: 'Green square',
    status: 'Active in CVVHD pilot',
    active: true,
  },
  {
    id: 'replacement',
    label: 'Replacement',
    marker: 'Purple octagon',
    status: 'Inactive in CVVHD pilot',
    active: false,
  },
] as const

function SignalValue({ value, unit }: { value: number | null; unit: string }) {
  if (value === null) {
    return (
      <>
        <strong aria-label="No case signal">—</strong>
        <small>No case signal</small>
      </>
    )
  }

  return (
    <>
      <strong>
        {value.toLocaleString('en-US')} {unit}
      </strong>
      <small>Signal supplied</small>
    </>
  )
}

export function CrrtPilotCircuit({
  running,
  setReady,
  fluidsReady,
  bloodFlowMlMin,
  dialysateFlowMlHour,
  patientFluidRemovalMlHour,
  pressure,
}: CrrtPilotCircuitProps) {
  const idPrefix = `crrt-pilot-${useId().replaceAll(':', '')}`
  const titleId = `${idPrefix}-title`
  const descriptionId = `${idPrefix}-description`
  const summaryId = `${idPrefix}-summary`
  const bloodArrowId = `${idPrefix}-blood-arrow`
  const fluidArrowId = `${idPrefix}-fluid-arrow`
  const effluentArrowId = `${idPrefix}-effluent-arrow`
  const viewportRef = useRef<HTMLDivElement>(null)

  function panDiagram(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const viewport = viewportRef.current
    if (!viewport) return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const left = event.key === 'ArrowRight' ? 140 : -140
    if (typeof viewport.scrollBy === 'function') {
      viewport.scrollBy({ left, behavior: reduceMotion ? 'auto' : 'smooth' })
    } else {
      viewport.scrollLeft += left
    }
  }

  return (
    <section className={styles.panel} aria-labelledby={`${idPrefix}-heading`}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Functional pilot surface</span>
          <h2 id={`${idPrefix}-heading`}>CVVHD circuit, bags, scales, and pressures</h2>
        </div>
        <div className={styles.runStatus} data-running={running} role="status" aria-live="polite">
          <span aria-hidden="true" />
          <strong>{running ? 'Circuit running' : 'Circuit stopped'}</strong>
        </div>
      </header>

      <div className={styles.readinessGrid} aria-label="Circuit readiness status">
        <div data-ready={setReady}>
          <span>Set</span>
          <strong>{setReady ? 'Ready' : 'Not ready'}</strong>
        </div>
        <div data-ready={fluidsReady}>
          <span>Fluids</span>
          <strong>{fluidsReady ? 'Ready' : 'Not ready'}</strong>
        </div>
        <div>
          <span>Blood flow</span>
          <SignalValue value={bloodFlowMlMin} unit="mL/min" />
        </div>
        <div>
          <span>Dialysate flow</span>
          <SignalValue value={dialysateFlowMlHour} unit="mL/h" />
        </div>
        <div>
          <span>Patient fluid removal</span>
          <SignalValue value={patientFluidRemovalMlHour} unit="mL/h" />
        </div>
      </div>

      <p className={styles.textSummary} id={summaryId}>
        Blood path: patient access → blood pump → filter-pressure site → filter → deaeration and
        return path → air detector and return clamp → patient. Dialysate enters the filter fluid
        side. Effluent leaves through the effluent-pressure site and blood-leak detector to the
        effluent scale.
      </p>

      <div
        ref={viewportRef}
        className={styles.diagramViewport}
        role="group"
        aria-label="CRRT circuit schematic; horizontally scrollable on narrow screens"
        aria-describedby={summaryId}
        tabIndex={0}
        onKeyDown={panDiagram}
      >
        <svg
          className={styles.circuitSvg}
          viewBox="0 0 1180 620"
          role="img"
          aria-labelledby={`${titleId} ${descriptionId}`}
          data-running={running}
          preserveAspectRatio="xMidYMid meet"
        >
          <title id={titleId}>CVVHD pilot circuit topology</title>
          <desc id={descriptionId}>
            An original educational schematic. The blood path runs from patient access to a blood
            pump, filter-pressure site, filter, deaeration and return path, air detector and return
            clamp, then back to the patient. Dialysate enters the filter fluid side. Effluent exits
            through its pressure site and a blood-leak detector to the effluent scale.
          </desc>
          <defs>
            <marker
              id={bloodArrowId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className={styles.bloodArrow} />
            </marker>
            <marker
              id={fluidArrowId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className={styles.fluidArrow} />
            </marker>
            <marker
              id={effluentArrowId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className={styles.effluentArrow} />
            </marker>
          </defs>

          <rect x="18" y="24" width="1144" height="572" rx="34" className={styles.backdrop} />
          <text x="50" y="66" className={styles.sectionLabel}>
            CONFIRMED PILOT TOPOLOGY · ORIGINAL EDUCATIONAL SCHEMATIC
          </text>

          <g transform="translate(98 273)">
            <circle r="57" className={styles.patientNode} />
            <path
              d="M-24 -3 Q0 -30 24 -3 Q8 23 0 31 Q-8 23 -24 -3 Z"
              className={styles.patientGlyph}
            />
            <text y="84" textAnchor="middle" className={styles.componentLabel}>
              PATIENT
            </text>
            <text y="103" textAnchor="middle" className={styles.componentSubLabel}>
              ACCESS + RETURN
            </text>
          </g>

          <path d="M150 252 H258" className={`${styles.tube} ${styles.accessTube}`} />
          <path
            d="M150 252 H258"
            className={`${styles.flowTrace} ${styles.accessFlow}`}
            markerEnd={`url(#${bloodArrowId})`}
          />
          <text x="202" y="226" textAnchor="middle" className={styles.pathLabel}>
            ACCESS
          </text>
          <g transform="translate(194 272)" className={styles.pressureSite}>
            <circle r="14" />
            <text y="38" textAnchor="middle">
              ACCESS PRESSURE
            </text>
          </g>

          <g transform="translate(330 252)">
            <circle r="66" className={styles.pumpBody} />
            <circle r="47" className={styles.pumpRing} />
            <path
              d="M-27 -12 C-7 -43 35 -22 32 12 C15 42 -30 28 -35 0 C-17 5 -3 4 -27 -12 Z"
              className={styles.pumpRotor}
            />
            <circle r="8" className={styles.pumpHub} />
            <text y="94" textAnchor="middle" className={styles.componentLabel}>
              BLOOD PUMP
            </text>
          </g>

          <path d="M396 252 H495" className={`${styles.tube} ${styles.preFilterTube}`} />
          <path
            d="M396 252 H495"
            className={`${styles.flowTrace} ${styles.preFilterFlow}`}
            markerEnd={`url(#${bloodArrowId})`}
          />
          <g transform="translate(448 230)" className={styles.pressureSite}>
            <circle r="14" />
            <text y="-25" textAnchor="middle">
              FILTER PRESSURE
            </text>
          </g>

          <g transform="translate(585 252)">
            <rect x="-90" y="-116" width="180" height="232" rx="30" className={styles.filterBody} />
            {Array.from({ length: 7 }, (_, index) => (
              <line
                key={index}
                x1={-54 + index * 18}
                x2={-54 + index * 18}
                y1="-82"
                y2="82"
                className={styles.filterFiber}
              />
            ))}
            <path d="M-90 0 H90" className={styles.filterBloodPath} />
            <path d="M0 105 V-105" className={styles.filterFluidPath} />
            <text y="-139" textAnchor="middle" className={styles.componentLabel}>
              FILTER
            </text>
            <text y="144" textAnchor="middle" className={styles.componentSubLabel}>
              BLOOD SIDE + FLUID SIDE
            </text>
          </g>

          <path d="M675 252 H758" className={`${styles.tube} ${styles.returnTube}`} />
          <path
            d="M675 252 H758"
            className={`${styles.flowTrace} ${styles.returnFlow}`}
            markerEnd={`url(#${bloodArrowId})`}
          />

          <g transform="translate(818 252)">
            <rect
              x="-60"
              y="-66"
              width="120"
              height="132"
              rx="34"
              className={styles.deaerationBody}
            />
            <path d="M-35 -18 Q0 30 35 -18" className={styles.deaerationPath} />
            <circle cx="0" cy="-28" r="8" className={styles.airBubble} />
            <text y="94" textAnchor="middle" className={styles.componentLabel}>
              DEAERATION / RETURN
            </text>
          </g>

          <path
            d="M878 252 H1080 Q1114 252 1114 286 V388 Q1114 420 1080 420 H155"
            className={`${styles.tube} ${styles.returnTube}`}
          />
          <path
            d="M878 252 H1080 Q1114 252 1114 286 V388 Q1114 420 1080 420 H155"
            className={`${styles.flowTrace} ${styles.returnFlow}`}
            markerEnd={`url(#${bloodArrowId})`}
          />

          <g transform="translate(936 252)">
            <circle r="27" className={styles.detectorBody} />
            <circle r="9" className={styles.detectorLens} />
            <text y="-46" textAnchor="middle" className={styles.componentLabel}>
              AIR DETECTOR
            </text>
          </g>
          <g transform="translate(1024 252)">
            <path d="M-24 -31 H24 V31 H-24 Z M-9 -31 V31 M9 -31 V31" className={styles.clampBody} />
            <text y="-46" textAnchor="middle" className={styles.componentLabel}>
              RETURN CLAMP
            </text>
          </g>
          <g transform="translate(1048 420)" className={styles.pressureSite}>
            <circle r="14" />
            <text y="38" textAnchor="middle">
              RETURN PRESSURE
            </text>
          </g>

          <path d="M585 548 V372" className={`${styles.fluidLine} ${styles.dialysateLine}`} />
          <path
            d="M585 548 V372"
            className={`${styles.flowTrace} ${styles.dialysateFlow}`}
            markerEnd={`url(#${fluidArrowId})`}
          />
          <g transform="translate(585 555)">
            <rect x="-68" y="-34" width="136" height="68" rx="12" className={styles.dialysateBag} />
            <rect x="-11" y="-50" width="22" height="16" rx="3" className={styles.bagPort} />
            <text y="8" textAnchor="middle" className={styles.bagLabel}>
              DIALYSATE
            </text>
          </g>

          <path d="M675 332 H746 V496" className={`${styles.fluidLine} ${styles.effluentLine}`} />
          <path
            d="M675 332 H746 V496"
            className={`${styles.flowTrace} ${styles.effluentFlow}`}
            markerEnd={`url(#${effluentArrowId})`}
          />
          <g transform="translate(746 380)" className={styles.pressureSite}>
            <circle r="14" />
            <text x="22" y="5">
              EFFLUENT PRESSURE
            </text>
          </g>
          <g transform="translate(746 450)">
            <rect x="-31" y="-24" width="62" height="48" rx="12" className={styles.detectorBody} />
            <circle r="9" className={styles.bloodLeakLens} />
            <text x="48" y="5" className={styles.componentLabel}>
              BLOOD-LEAK DETECTOR
            </text>
          </g>
          <g transform="translate(746 555)">
            <path d="M-60 -34 H60 L48 34 H-48 Z" className={styles.effluentBag} />
            <rect x="-10" y="-50" width="20" height="16" rx="3" className={styles.bagPort} />
            <text y="7" textAnchor="middle" className={styles.bagLabel}>
              EFFLUENT
            </text>
          </g>

          <text x="50" y="566" className={styles.motionStatus}>
            {running ? 'FLOW MOTION: ACTIVE' : 'FLOW MOTION: STOPPED'}
          </text>
        </svg>
      </div>
      <p className={styles.panHint}>
        On a narrow screen, swipe the schematic or focus it and use the left and right arrow keys.
      </p>

      <div className={styles.dataGrid}>
        <section className={styles.pressurePanel} aria-labelledby={`${idPrefix}-pressures-heading`}>
          <div className={styles.subheading}>
            <span>Device signals</span>
            <h3 id={`${idPrefix}-pressures-heading`}>Pressure nodes</h3>
          </div>
          <div className={styles.pressureGrid} role="list" aria-label="Circuit pressure signals">
            {pressureNodes.map((node) => (
              <div key={node.key} role="listitem">
                <span>{node.label}</span>
                <SignalValue value={pressure[node.key]} unit="mmHg" />
              </div>
            ))}
          </div>
        </section>

        <section className={styles.scalePanel} aria-labelledby={`${idPrefix}-scales-heading`}>
          <div className={styles.subheading}>
            <span>Device scales</span>
            <h3 id={`${idPrefix}-scales-heading`}>Four source-mapped positions</h3>
          </div>
          <div className={styles.scaleGrid} role="list" aria-label="CRRT scale positions">
            {scales.map((scale) => (
              <div key={scale.id} role="listitem" data-active={scale.active}>
                <i className={styles.scaleMarker} data-scale={scale.id} aria-hidden="true" />
                <span>
                  <strong>{scale.label}</strong>
                  <small>{scale.marker}</small>
                </span>
                <em>{scale.status}</em>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}
