'use client'

import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import {
  calculateCrrtMachineFluidLedger,
  checkCrrtFluidConservation,
  crrtWorkedLedgerExample,
} from '../circuitFluidLedger'
import {
  CRRT_CIRCUIT_VIEWBOX,
  crrtCircuitNode,
  crrtCircuitOverlay,
  crrtCircuitOverlays,
  crrtCircuitPath,
  crrtCircuitPathKindStyleByKind,
  crrtCircuitPaths,
  crrtCircuitTextEquivalent,
  crrtCitrateCalciumTerms,
  crrtOverlayFluidDestinations,
  crrtPressureSignalDetails,
  type CrrtCircuitNodeId,
  type CrrtCircuitOverlayId,
  type CrrtCircuitPathId,
  type CrrtCircuitPathKind,
} from '../content/circuitModel'
import type { CrrtFlowRates } from '../engine/types'
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
  /**
   * Full prescription flows. When supplied the fluid ledger is computed from
   * them; otherwise the authored worked example is shown and labelled as one.
   */
  flows?: CrrtFlowRates | null
  /** Overlay shown first. Defaults to the blood path. */
  initialOverlayId?: CrrtCircuitOverlayId
}

/** Maps a pressure signal onto the prop that carries its value. */
const pressureValueKeyBySignalId = {
  access: 'access',
  filter: 'filter',
  return: 'return',
  effluent: 'effluent',
  tmp: 'TMP',
  'filter-drop': 'filterDrop',
} as const satisfies Record<string, keyof CrrtPilotPressureSignals>

/** The four device scale positions, each tied to the path it weighs. */
const scalePositions = [
  {
    id: 'effluent',
    label: 'Effluent',
    marker: 'Yellow circle',
    pathIds: ['effluent-line'] as const,
  },
  {
    id: 'pbp',
    label: 'PBP',
    marker: 'White triangle',
    pathIds: ['pbp-citrate-infusion'] as const,
  },
  {
    id: 'dialysate',
    label: 'Dialysate',
    marker: 'Green square',
    pathIds: ['dialysate-supply'] as const,
  },
  {
    id: 'replacement',
    label: 'Replacement',
    marker: 'Purple octagon',
    pathIds: ['pre-filter-replacement', 'post-filter-replacement'] as const,
  },
] as const

/**
 * Drawing order. Sources sit behind the components they feed, and the two
 * sampling domains sit behind everything so their dashed rings never cut across
 * a label.
 */
const nodeDrawOrder: readonly CrrtCircuitNodeId[] = [
  'systemic-sampling-domain',
  'circuit-sampling-domain',
  'patient',
  'access-lumen',
  'return-lumen',
  'access-pressure',
  'pbp-citrate-source',
  'pbp-citrate-entry',
  'blood-pump',
  'pre-filter-replacement-source',
  'pre-filter-replacement-entry',
  'filter-pressure',
  'filter',
  'post-filter-replacement-source',
  'post-filter-replacement-entry',
  'deaeration-chamber',
  'return-pressure',
  'air-detector',
  'return-clamp',
  'dialysate-source',
  'dialysate-pump',
  'effluent-pressure',
  'blood-leak-detector',
  'effluent-pump',
  'effluent-scale',
  'calcium-source',
]

/** Nodes drawn only when their overlay asks for them. */
const samplingDomainNodeIds: readonly CrrtCircuitNodeId[] = [
  'circuit-sampling-domain',
  'systemic-sampling-domain',
]

/** Which path owns which hardware, so an inactive fluid dims its bags and pumps too. */
const nodeOwnerPathId: Readonly<Partial<Record<CrrtCircuitNodeId, CrrtCircuitPathId>>> = {
  'pbp-citrate-entry': 'pbp-citrate-infusion',
  'pbp-citrate-source': 'pbp-citrate-infusion',
  'pre-filter-replacement-entry': 'pre-filter-replacement',
  'pre-filter-replacement-source': 'pre-filter-replacement',
  'post-filter-replacement-entry': 'post-filter-replacement',
  'post-filter-replacement-source': 'post-filter-replacement',
  'dialysate-source': 'dialysate-supply',
  'dialysate-pump': 'dialysate-supply',
  'effluent-pressure': 'effluent-line',
  'blood-leak-detector': 'effluent-line',
  'effluent-pump': 'effluent-line',
  'effluent-scale': 'effluent-line',
  'calcium-source': 'calcium-infusion',
}

function formatMlHour(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} mL/h`
}

/**
 * A suppressed quantity renders as an explicit withholding, never as a dash that
 * could read as zero and never as a number the sources do not support.
 */
function LedgerValue({ value, caption }: { value: number | null; caption: string }) {
  if (value === null) {
    return (
      <dd data-withheld="true">
        Withheld
        <small>Not stated while the makeup attribution is unresolved.</small>
      </dd>
    )
  }
  return (
    <dd>
      {formatMlHour(value)}
      <small>{caption}</small>
    </dd>
  )
}

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

function accessibleSignal(value: number | null, unit: string): string {
  return value === null ? 'no case signal' : `${value.toLocaleString('en-US')} ${unit}`
}

/* ------------------------------------------------------------------ *
 * Schematic
 * ------------------------------------------------------------------ */

function NodeGlyph({ id, active }: { id: CrrtCircuitNodeId; active: boolean }) {
  const node = crrtCircuitNode(id)
  const { x, y } = node.at
  const { dx, dy, anchor } = node.labelOffset

  function body() {
    switch (id) {
      case 'patient':
        return (
          <>
            <circle r="62" className={styles.patientNode} />
            <path
              d="M-26 -4 Q0 -33 26 -4 Q9 25 0 34 Q-9 25 -26 -4 Z"
              className={styles.patientGlyph}
            />
          </>
        )
      case 'access-lumen':
      case 'return-lumen':
        return (
          <>
            <rect x="-26" y="-13" width="52" height="26" rx="9" className={styles.lumenPort} />
            <text y="5" textAnchor="middle" className={styles.lumenMark}>
              {id === 'access-lumen' ? 'A' : 'V'}
            </text>
          </>
        )
      case 'blood-pump':
        return (
          <>
            <circle r="52" className={styles.pumpBody} />
            <circle r="37" className={styles.pumpRing} />
            <path
              d="M-21 -9 C-6 -34 27 -17 25 9 C12 33 -23 22 -27 0 C-13 4 -2 3 -21 -9 Z"
              className={styles.pumpRotor}
            />
            <circle r="6" className={styles.pumpHub} />
          </>
        )
      case 'dialysate-pump':
      case 'effluent-pump':
        return (
          <>
            <circle r="30" className={styles.pumpBody} />
            <circle r="20" className={styles.pumpRing} />
            <path
              d="M-12 -5 C-3 -20 16 -10 14 5 C7 19 -13 13 -15 0 C-8 2 -1 2 -12 -5 Z"
              className={styles.fluidRotor}
            />
          </>
        )
      case 'filter':
        // Blood runs down the left channel, dialysate and ultrafiltrate up the
        // right one, with the membrane drawn between them. The compartment
        // captions sit clear of both channels and of the blood row above.
        return (
          <>
            <rect x="-90" y="-101" width="180" height="202" rx="26" className={styles.filterBody} />
            {Array.from({ length: 5 }, (_, index) => (
              <line
                key={index}
                x1={-62 + index * 16}
                x2={-62 + index * 16}
                y1="-78"
                y2="78"
                className={styles.filterFiber}
              />
            ))}
            <line x1="15" x2="15" y1="-101" y2="101" className={styles.filterMembrane} />
            <text x="-85" y="118" textAnchor="middle" className={styles.compartmentLabel}>
              BLOOD SIDE
            </text>
            <text x="75" y="128" textAnchor="middle" className={styles.compartmentLabel}>
              FLUID SIDE
            </text>
          </>
        )
      case 'deaeration-chamber':
        return (
          <>
            <rect
              x="-40"
              y="-42"
              width="80"
              height="84"
              rx="16"
              className={styles.deaerationBody}
            />
            <path d="M-24 -10 Q0 22 24 -10" className={styles.deaerationPath} />
            <circle cx="0" cy="-20" r="7" className={styles.airBubble} />
          </>
        )
      case 'air-detector':
        return (
          <>
            <circle r="24" className={styles.detectorBody} />
            <circle r="8" className={styles.detectorLens} />
          </>
        )
      case 'blood-leak-detector':
        return (
          <>
            <rect x="-28" y="-22" width="56" height="44" rx="11" className={styles.detectorBody} />
            <circle r="8" className={styles.bloodLeakLens} />
          </>
        )
      case 'return-clamp':
        return (
          <path d="M-22 -28 H22 V28 H-22 Z M-8 -28 V28 M8 -28 V28" className={styles.clampBody} />
        )
      case 'access-pressure':
      case 'filter-pressure':
      case 'return-pressure':
      case 'effluent-pressure':
        return (
          <>
            <circle r="15" className={styles.pressureSiteRing} />
            <circle r="5" className={styles.pressureSiteCore} />
          </>
        )
      case 'pbp-citrate-entry':
      case 'pre-filter-replacement-entry':
      case 'post-filter-replacement-entry':
        return <path d="M-11 -11 H11 L0 12 Z" className={styles.portGlyph} />
      case 'pbp-citrate-source':
      case 'pre-filter-replacement-source':
      case 'post-filter-replacement-source':
        return (
          <>
            <rect x="-56" y="-28" width="112" height="56" rx="11" className={styles.sourceBag} />
            <rect x="-9" y="-40" width="18" height="14" rx="3" className={styles.bagPort} />
          </>
        )
      case 'dialysate-source':
        return (
          <>
            <rect x="-62" y="-30" width="124" height="60" rx="11" className={styles.dialysateBag} />
            <rect x="-9" y="-44" width="18" height="14" rx="3" className={styles.bagPort} />
            <path d="M-62 34 H62" className={styles.scaleBar} />
          </>
        )
      case 'effluent-scale':
        return (
          <>
            <path d="M-58 -30 H58 L47 30 H-47 Z" className={styles.effluentBag} />
            <rect x="-9" y="-44" width="18" height="14" rx="3" className={styles.bagPort} />
            <path d="M-58 34 H58" className={styles.scaleBar} />
          </>
        )
      case 'calcium-source':
        return (
          <>
            <rect x="-50" y="-26" width="100" height="52" rx="11" className={styles.calciumBag} />
            <rect x="-9" y="-38" width="18" height="14" rx="3" className={styles.bagPort} />
          </>
        )
      case 'circuit-sampling-domain':
        // Drawn around the return limb just after the filter: this sample
        // describes the circuit, not the patient.
        return <ellipse rx="90" ry="40" className={styles.samplingDomain} />
      case 'systemic-sampling-domain':
        // Drawn around the patient: this sample describes the patient, not the
        // circuit.
        return <ellipse rx="95" ry="80" className={styles.samplingDomain} />
      default:
        return null
    }
  }

  return (
    <g
      transform={`translate(${x} ${y})`}
      data-node={id}
      data-active={active}
      className={styles.node}
    >
      {body()}
      <text x={dx} y={dy} textAnchor={anchor} className={styles.componentLabel}>
        {node.label}
      </text>
      {node.subLabel ? (
        <text x={dx} y={dy + 16} textAnchor={anchor} className={styles.componentSubLabel}>
          {node.subLabel}
        </text>
      ) : null}
    </g>
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
  flows = null,
  initialOverlayId = 'blood-path',
}: CrrtPilotCircuitProps) {
  const idPrefix = `crrt-pilot-${useId().replaceAll(':', '')}`
  const titleId = `${idPrefix}-title`
  const descriptionId = `${idPrefix}-description`
  const summaryId = `${idPrefix}-summary`
  const stateSummaryId = `${idPrefix}-state-summary`
  const viewportRef = useRef<HTMLDivElement>(null)
  const [overlayId, setOverlayId] = useState<CrrtCircuitOverlayId>(initialOverlayId)

  const overlay = crrtCircuitOverlay(overlayId)
  const activePathIds = useMemo(() => new Set(overlay.activePathIds), [overlay])
  const destinations = useMemo(() => crrtOverlayFluidDestinations(overlay), [overlay])
  const textEquivalent = useMemo(() => crrtCircuitTextEquivalent(overlayId), [overlayId])

  const ledgerFlows = flows ?? crrtWorkedLedgerExample.flows
  const ledgerIsLive = flows !== null
  const ledger = useMemo(() => calculateCrrtMachineFluidLedger(ledgerFlows), [ledgerFlows])
  const conservation = useMemo(() => checkCrrtFluidConservation(ledger), [ledger])

  const circuitStateSummary = [
    `Circuit state: ${running ? 'running' : 'stopped'}.`,
    `Training set ${setReady ? 'ready' : 'not ready'}; fluids ${fluidsReady ? 'ready' : 'not ready'}.`,
    `Blood flow ${accessibleSignal(bloodFlowMlMin, 'milliliters per minute')}; dialysate flow ${accessibleSignal(dialysateFlowMlHour, 'milliliters per hour')}; patient fluid removal ${accessibleSignal(patientFluidRemovalMlHour, 'milliliters per hour')}.`,
    `Pressure state: access ${accessibleSignal(pressure.access, 'millimeters of mercury')}; filter ${accessibleSignal(pressure.filter, 'millimeters of mercury')}; return ${accessibleSignal(pressure.return, 'millimeters of mercury')}; effluent ${accessibleSignal(pressure.effluent, 'millimeters of mercury')}; transmembrane pressure ${accessibleSignal(pressure.TMP, 'millimeters of mercury')}; filter pressure drop ${accessibleSignal(pressure.filterDrop, 'millimeters of mercury')}.`,
  ].join(' ')

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

  function nodeIsActive(id: CrrtCircuitNodeId): boolean {
    if (samplingDomainNodeIds.includes(id)) return overlay.showsSamplingDomains
    const owner = nodeOwnerPathId[id]
    if (owner) return activePathIds.has(owner)
    return true
  }

  const arrowMarkerId = (kind: CrrtCircuitPathKind) => `${idPrefix}-arrow-${kind}`

  return (
    <section className={styles.panel} aria-labelledby={`${idPrefix}-heading`}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Functional educational surface</span>
          <h2 id={`${idPrefix}-heading`}>One CRRT circuit, every therapy</h2>
        </div>
        <div className={styles.runStatus} data-running={running} role="status" aria-live="polite">
          <span aria-hidden="true" />
          <strong>{running ? 'Circuit running' : 'Circuit stopped'}</strong>
        </div>
      </header>

      <div className={styles.overlayBar}>
        <div className={styles.subheading}>
          <span>Views</span>
          <h3 id={`${idPrefix}-overlay-heading`}>Same circuit, different fluids</h3>
        </div>
        {/* Deliberately a plain group of toggle buttons, not a radiogroup: the
            pressure-localization lab renders radios inside groups named after
            the same six pressure signals, and a second radio population in the
            same lesson tree makes those queries ambiguous. */}
        <div className={styles.overlayButtons} role="group" aria-label="Circuit overlay layers">
          {crrtCircuitOverlays.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              aria-pressed={candidate.id === overlayId}
              data-selected={candidate.id === overlayId}
              onClick={() => setOverlayId(candidate.id)}
            >
              {candidate.label}
            </button>
          ))}
        </div>
        <p className={styles.overlaySummary}>{overlay.summary}</p>
        <p className={styles.overlayNote}>
          Nothing moves between views. Only the fluids change, so the picture you learned once keeps
          working.
        </p>
      </div>

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
        {textEquivalent}
      </p>
      <p id={stateSummaryId} className={styles.visuallyHidden}>
        {circuitStateSummary}
      </p>

      <div
        ref={viewportRef}
        className={styles.diagramViewport}
        role="group"
        aria-label="CRRT circuit schematic; horizontally scrollable on narrow screens"
        aria-describedby={`${summaryId} ${stateSummaryId}`}
        tabIndex={0}
        onKeyDown={panDiagram}
      >
        <svg
          className={styles.circuitSvg}
          viewBox={CRRT_CIRCUIT_VIEWBOX}
          role="img"
          aria-labelledby={`${titleId} ${descriptionId}`}
          data-running={running}
          data-overlay={overlayId}
          preserveAspectRatio="xMidYMid meet"
        >
          <title id={titleId}>Universal CRRT circuit topology</title>
          <desc id={descriptionId}>{textEquivalent}</desc>
          <defs>
            {[...crrtCircuitPathKindStyleByKind.keys()].map((kind) => (
              <marker
                key={kind}
                id={arrowMarkerId(kind)}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className={styles.flowArrow} data-kind={kind} />
              </marker>
            ))}
          </defs>

          <rect x="16" y="16" width="1298" height="748" rx="30" className={styles.backdrop} />
          <text x="44" y="52" className={styles.sectionLabel}>
            ORIGINAL EDUCATIONAL SCHEMATIC · FIXED ORIENTATION · {overlay.label.toUpperCase()}
          </text>
          <text x="1288" y="52" textAnchor="end" className={styles.motionStatus}>
            {running ? 'FLOW MOTION: ACTIVE' : 'FLOW MOTION: STOPPED'}
          </text>

          {/* Every path is drawn in every view. Only its active state changes. */}
          <g className={styles.pathLayer}>
            {crrtCircuitPaths.map((path) => {
              const active = activePathIds.has(path.id)
              const style = crrtCircuitPathKindStyleByKind.get(path.kind)
              return (
                <g key={path.id} data-path={path.id} data-active={active} data-kind={path.kind}>
                  <path d={path.d} className={styles.tube} data-kind={path.kind} />
                  <path
                    d={path.d}
                    className={styles.flowTrace}
                    data-kind={path.kind}
                    style={
                      style && style.dashPattern !== 'none'
                        ? { strokeDasharray: style.dashPattern }
                        : undefined
                    }
                    markerEnd={active ? `url(#${arrowMarkerId(path.kind)})` : undefined}
                  />
                </g>
              )
            })}
          </g>

          <g className={styles.nodeLayer}>
            {nodeDrawOrder.map((nodeId) => {
              if (samplingDomainNodeIds.includes(nodeId) && !overlay.showsSamplingDomains) {
                return null
              }
              return <NodeGlyph key={nodeId} id={nodeId} active={nodeIsActive(nodeId)} />
            })}
          </g>

          {overlay.showsPressureProfile ? (
            <g className={styles.pressureLayer}>
              {/* Calculated values get a stated relationship, not a site marker:
                  there is no transducer on the circuit to point at. */}
              <text x="495" y="336" textAnchor="middle" className={styles.derivationCaption}>
                NO TRANSDUCER — NOTHING TO INSPECT
              </text>
              <rect
                x="350"
                y="352"
                width="290"
                height="30"
                rx="8"
                className={styles.derivationChip}
              />
              <text x="495" y="372" textAnchor="middle" className={styles.derivationLabel}>
                TMP = (FILTER + RETURN)/2 − EFFLUENT · CALCULATED
              </text>
              <rect
                x="350"
                y="396"
                width="290"
                height="30"
                rx="8"
                className={styles.derivationChip}
              />
              <text x="495" y="416" textAnchor="middle" className={styles.derivationLabel}>
                FILTER DROP = FILTER − RETURN · CALCULATED
              </text>
              <path d="M 628 352 V 268" className={styles.derivationBracket} />
              <path d="M 440 426 V 516" className={styles.derivationBracket} />
            </g>
          ) : null}
        </svg>
      </div>
      <p className={styles.panHint}>
        On a narrow screen, swipe the schematic or focus it and use the left and right arrow keys.
      </p>

      <div className={styles.legend} aria-label="Line pattern legend">
        {[...crrtCircuitPathKindStyleByKind.values()].map((style) => (
          <span key={style.kind} data-kind={style.kind}>
            <i aria-hidden="true" data-kind={style.kind} />
            <strong>{style.label}</strong>
            <small>{style.patternDescription}</small>
          </span>
        ))}
      </div>

      <div className={styles.dataGrid}>
        <section className={styles.pressurePanel} aria-labelledby={`${idPrefix}-pressures-heading`}>
          <div className={styles.subheading}>
            <span>Device signals</span>
            <h3 id={`${idPrefix}-pressures-heading`}>Pressure nodes</h3>
          </div>
          <p className={styles.panelNote}>
            Four of these have a place you can walk to. Two are arithmetic over the other four and
            have no location of their own.
          </p>
          <div className={styles.pressureGrid} role="list" aria-label="Circuit pressure signals">
            {crrtPressureSignalDetails.map((detail) => (
              <div key={detail.id} role="listitem" data-kind={detail.kind}>
                <span>{detail.label}</span>
                <SignalValue value={pressure[pressureValueKeyBySignalId[detail.id]]} unit="mmHg" />
                <em data-kind={detail.kind}>
                  {detail.kind === 'directly-modelled-site'
                    ? 'Directly modelled site'
                    : 'Calculated relationship'}
                </em>
              </div>
            ))}
          </div>

          <div className={styles.pressureDetails}>
            {crrtPressureSignalDetails.map((detail) => (
              <details key={detail.id} data-signal={detail.id}>
                <summary>
                  {detail.label}
                  <i data-kind={detail.kind}>
                    {detail.kind === 'directly-modelled-site' ? 'Modelled site' : 'Calculated'}
                  </i>
                </summary>
                <dl>
                  <div>
                    <dt>Where it is</dt>
                    <dd>{detail.physicalLocation}</dd>
                  </div>
                  <div>
                    <dt>What produces the value</dt>
                    <dd>{detail.whatProducesTheValue}</dd>
                  </div>
                  <div>
                    <dt>What blood flow alone does to it</dt>
                    <dd>{detail.bloodFlowEffect}</dd>
                  </div>
                  <div>
                    <dt>Patient and access causes</dt>
                    <dd>
                      <ul>
                        {detail.patientOrAccessCauses.map((cause) => (
                          <li key={cause}>{cause}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                  <div>
                    <dt>Circuit causes</dt>
                    <dd>
                      <ul>
                        {detail.circuitCauses.map((cause) => (
                          <li key={cause}>{cause}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                  <div>
                    <dt>When the signal may be unreliable</dt>
                    <dd>{detail.whenUnreliable}</dd>
                  </div>
                  <div>
                    <dt>How far to go on your own</dt>
                    <dd>{detail.firstInspectionBoundary}</dd>
                  </div>
                </dl>
              </details>
            ))}
          </div>
        </section>

        <div className={styles.sideColumn}>
          <section className={styles.scalePanel} aria-labelledby={`${idPrefix}-scales-heading`}>
            <div className={styles.subheading}>
              <span>Device scales</span>
              <h3 id={`${idPrefix}-scales-heading`}>Four fluid-scale positions</h3>
            </div>
            <div className={styles.scaleGrid} role="list" aria-label="CRRT scale positions">
              {scalePositions.map((scale) => {
                const active = scale.pathIds.some((pathId) => activePathIds.has(pathId))
                return (
                  <div key={scale.id} role="listitem" data-active={active}>
                    <i className={styles.scaleMarker} data-scale={scale.id} aria-hidden="true" />
                    <span>
                      <strong>{scale.label}</strong>
                      <small>{scale.marker}</small>
                    </span>
                    <em>
                      {active ? `Active in ${overlay.label}` : `Inactive in ${overlay.label}`}
                    </em>
                  </div>
                )
              })}
            </div>
          </section>

          <section className={styles.ledgerPanel} aria-labelledby={`${idPrefix}-ledger-heading`}>
            <div className={styles.subheading}>
              <span>Fluid conservation</span>
              <h3 id={`${idPrefix}-ledger-heading`}>Where every millilitre goes</h3>
            </div>
            <p className={styles.panelNote}>
              {ledgerIsLive
                ? 'Computed from the flows currently set on this circuit.'
                : `Authored worked example: ${crrtWorkedLedgerExample.title}`}
            </p>
            <dl className={styles.ledgerGrid}>
              <div>
                <dt>Enters the blood path</dt>
                <dd>
                  {formatMlHour(ledger.enteringBloodPathMlHour)}
                  <small>
                    Pre-blood-pump, replacement, and syringe fluid. This reaches the patient.
                  </small>
                </dd>
              </div>
              <div>
                <dt>Never enters the patient</dt>
                <dd>
                  {formatMlHour(ledger.neverEnteringPatientMlHour)}
                  <small>
                    Dialysate, which runs along the far side of the membrane and leaves in the
                    effluent.
                  </small>
                </dd>
              </div>
              <div>
                <dt>Crosses the membrane</dt>
                <LedgerValue
                  value={ledger.crossingMembraneMlHour}
                  caption="Pulled from the blood side to the fluid side."
                />
              </div>
              <div>
                <dt>Net fluid returned to the patient</dt>
                <LedgerValue
                  value={ledger.netFluidToPatientMlHour}
                  caption="Negative means the patient is losing fluid to the machine."
                />
              </div>
              <div data-emphasis="true">
                <dt>Total effluent</dt>
                <dd>
                  {formatMlHour(ledger.totalEffluentMlHour)}
                  <small>Everything the effluent pump carries to the bag.</small>
                </dd>
              </div>
              <div data-emphasis="true">
                <dt>Machine patient-fluid-removal term</dt>
                <LedgerValue
                  value={ledger.machinePatientFluidRemovalMlHour}
                  caption="What the patient actually lost to the machine."
                />
              </div>
            </dl>
            {ledger.resolution === 'unresolved-makeup-attribution' ? (
              <p className={styles.ledgerUnresolved} role="note">
                <strong>This ledger cannot be closed.</strong> {ledger.unresolvedReason}
              </p>
            ) : ledger.effluentPerMillilitreRemoved !== null ? (
              <p className={styles.ledgerHeadline}>
                The effluent bag fills{' '}
                <strong>
                  {Math.round(ledger.effluentPerMillilitreRemoved).toLocaleString('en-US')} times
                </strong>{' '}
                faster than the patient loses fluid. Effluent volume is not patient loss.
              </p>
            ) : (
              <p className={styles.ledgerHeadline}>
                No net fluid is being removed, so every millilitre in the effluent bag came from
                somewhere other than the patient’s own volume.
              </p>
            )}
            <ul className={styles.conservationList} aria-label="Fluid conservation checks">
              {conservation.map((check) => (
                <li key={check.id} data-status={check.status}>
                  <strong>
                    {check.status === 'balanced'
                      ? 'Balances'
                      : check.status === 'unbalanced'
                        ? 'Does not balance'
                        : 'Cannot be checked'}
                  </strong>
                  <span>{check.label}</span>
                  {check.status === 'balanced' ? null : (
                    <em>
                      {check.residualMlHour === null
                        ? ''
                        : `Residual ${formatMlHour(check.residualMlHour)}. `}
                      {check.explanation}
                    </em>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.destinationPanel} aria-labelledby={`${idPrefix}-dest-heading`}>
            <div className={styles.subheading}>
              <span>Trace it yourself</span>
              <h3 id={`${idPrefix}-dest-heading`}>Which fluids reach the patient?</h3>
            </div>
            <div className={styles.destinationLists}>
              <div>
                <h4>Enters the patient</h4>
                {destinations.entersPatient.length > 0 ? (
                  <ul>
                    {destinations.entersPatient.map((id) => (
                      <li key={id}>{crrtCircuitPath(id).label}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No added fluid enters the patient in this view.</p>
                )}
              </div>
              <div>
                <h4>Never enters the patient</h4>
                {destinations.neverEntersPatient.length > 0 ? (
                  <ul>
                    {destinations.neverEntersPatient.map((id) => (
                      <li key={id}>{crrtCircuitPath(id).label}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No fluid side is running in this view.</p>
                )}
              </div>
            </div>
            <p className={styles.teachingPoint}>{overlay.teachingPoint}</p>
          </section>

          {overlay.showsSamplingDomains ? (
            <section className={styles.termPanel} aria-labelledby={`${idPrefix}-terms-heading`}>
              <div className={styles.subheading}>
                <span>First use</span>
                <h3 id={`${idPrefix}-terms-heading`}>Words this view introduces</h3>
              </div>
              <p className={styles.panelNote}>
                Where citrate acts and which sample answers which question. This view carries no
                dose, ratio, target, or timing — those belong to the citrate lesson, not to the
                circuit.
              </p>
              <dl className={styles.termList}>
                {crrtCitrateCalciumTerms.map((term) => (
                  <div key={term.id} data-term={term.id}>
                    <dt>{term.term}</dt>
                    <dd>
                      {term.definition}
                      <em>{term.whyItMatters}</em>
                      <small data-evidence-ids={term.sourceIds.join(' ')}>
                        Sources: {term.sourceIds.join(', ')}
                      </small>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  )
}
