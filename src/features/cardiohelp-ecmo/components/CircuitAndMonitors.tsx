'use client'

import { useRef, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  Fan,
  HeartPulse,
  Inspect,
  PlugZap,
  RotateCcw,
  Wind,
} from 'lucide-react'

import type {
  ClinicalInitiationTargets,
  EcmoSimulationState,
  GuidedControlId,
  GuidedTarget,
  SimulationAction,
  TrendParameter,
} from '../engine'
import { TIP_TO_TIP_CHECK_ID } from '../content/scenarios'
import styles from './cardiohelp-ecmo.module.css'

interface SimulationPanelProps {
  state: EcmoSimulationState
  dispatch: (action: SimulationAction) => void
  controlsEnabled: boolean
  guidedTarget?: GuidedTarget | null
  guidedControlId?: GuidedControlId | null
  initiationTargets?: ClinicalInitiationTargets | null
}

function CircuitSchematic({
  state,
  dispatch,
  controlsEnabled,
  guidedTarget,
  guidedControlId,
}: SimulationPanelProps) {
  const diagramScrollRef = useRef<HTMLDivElement>(null)
  const lowFlow = state.circuit.bloodFlow < state.device.limits.flowLow
  const diagnosisRevealed = state.scenario.phase === 'complete'
  const isVa = state.supportMode === 'va'
  const supportModeLabel = isVa ? 'VA' : 'VV'
  const returnVesselLabel = isVa ? 'femoral artery' : 'femoral vein'
  const returnDestinationLabel = isVa ? 'arterial circulation / aorta' : 'right atrium'
  const returnPortX = isVa ? 244 : 214
  const bloodMoving = state.device.pumpRunning && Math.abs(state.circuit.bloodFlow) > 0.05
  const gasMoving = state.gas.sourceConnected && state.gas.sweepLpm > 0
  const startupInspectionCompleted = state.scenario.correctedFaults.includes('startup-inspection')
  const postPumpPath = 'M486 346 Q512 346 526 364 Q536 377 552 385 H700'
  const returnLimbPath = `M825 385 H1000 Q1042 385 1042 427 V512 Q1042 540 1014 540 H${
    returnPortX + 28
  } Q${returnPortX} 540 ${returnPortX} 512 V455`
  const circuitDescription = `${supportModeLabel} ECMO blood drains through a femoral venous cannula and the pVen pressure zone into a centrifugal pump. Pump outflow passes pInt, a pre-oxygenator access point, and the membrane oxygenator. Oxygenated blood then passes pArt and the flow and bubble sensor before returning through the ${returnVesselLabel} toward the ${returnDestinationLabel}.${
    isVa
      ? ' Native cardiac ejection, the approximate mixing region, right-arm monitoring, and the need for separate distal-limb assessment are also shown.'
      : ' Both cannulas remain in the venous circulation and systemic flow still depends on the native heart.'
  } The pump uses a center-inlet to tangential-outflow schematic. In the oxygenator, blood is shown moving around simplified hollow fibers while sweep gas moves through them. Static arrows show direction. Moving dashes show simulated blood motion when circuit flow is present. Component geometry is conceptual rather than device-exact.`
  const resistancePattern = !diagnosisRevealed
    ? 'Pattern label withheld until reassessment and reveal'
    : state.scenario.activeFaults.includes('oxygenator-resistance') ||
        state.scenario.correctedFaults.includes('oxygenator-resistance')
      ? 'Oxygenator resistance pattern'
      : state.scenario.activeFaults.includes('return-obstruction') ||
          state.scenario.correctedFaults.includes('return-obstruction')
        ? 'Return-side resistance pattern'
        : state.scenario.activeFaults.includes('preload-limited') ||
            state.scenario.correctedFaults.includes('preload-limited')
          ? 'Preload-limited drainage pattern'
          : 'No injected resistance pattern'

  return (
    <section
      id="cardiohelp-circuit-panel"
      className={styles.circuitPanel}
      aria-labelledby="circuit-heading"
      data-guided-focus={guidedTarget === 'circuit'}
      data-guided-help={guidedControlId === 'cardiohelp-circuit-panel'}
      tabIndex={-1}
    >
      {guidedTarget === 'circuit' ? (
        <div className={styles.guidedFocusFlag} role="status">
          <span aria-hidden="true">●</span> Learn focus: circuit and sensors
        </div>
      ) : null}
      <div className={styles.panelHeading}>
        <div>
          <span className={styles.kicker}>Circuit model</span>
          <h2 id="circuit-heading">Pressure zones and sensor orientation</h2>
        </div>
        <span className={styles.simulatedBadge}>BOUNDED MODEL</span>
      </div>

      <div
        className={styles.circuitModeSummary}
        role="group"
        aria-label={`${supportModeLabel} femoral-femoral circuit configuration`}
      >
        <div>
          <strong>{supportModeLabel} femoral-femoral configuration</strong>
          <span>
            Drainage: femoral vein → centrifugal pump → membrane oxygenator. Return:{' '}
            {returnVesselLabel} → {returnDestinationLabel}.
          </span>
        </div>
        <span className={styles.modePill}>{supportModeLabel}</span>
      </div>

      <div
        ref={diagramScrollRef}
        className={styles.circuitDiagramScroll}
        role="group"
        aria-label={`${supportModeLabel} ECMO circuit diagram; horizontally scrollable on narrow screens`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          const diagram = diagramScrollRef.current
          if (!diagram) return
          const delta = event.key === 'ArrowRight' ? 120 : -120
          if (typeof diagram.scrollBy === 'function') {
            const reduceMotion =
              window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
            diagram.scrollBy({ left: delta, behavior: reduceMotion ? 'auto' : 'smooth' })
          } else {
            diagram.scrollLeft += delta
          }
        }}
      >
        <svg
          className={styles.circuitSvg}
          viewBox="0 0 1120 590"
          role="img"
          aria-labelledby="circuit-svg-title circuit-svg-desc"
          preserveAspectRatio="xMidYMid meet"
        >
          <title id="circuit-svg-title">{`${supportModeLabel} ECMO femoral-femoral circuit schematic`}</title>
          <desc id="circuit-svg-desc">{circuitDescription}</desc>
          <defs>
            <linearGradient id="cardiohelp-post-pump-gradient" x1="0" x2="1">
              <stop offset="0" stopColor="#467f9b" />
              <stop offset="0.62" stopColor="#a64359" />
              <stop offset="1" stopColor="#e15d69" />
            </linearGradient>
            <marker
              id="cardiohelp-flow-arrow"
              markerWidth="9"
              markerHeight="9"
              refX="7"
              refY="4.5"
              orient="auto"
            >
              <path d="M0 0 L0 9 L8 4.5 Z" className={styles.flowArrowMarker} />
            </marker>
            <marker
              id="cardiohelp-venous-arrow"
              markerWidth="9"
              markerHeight="9"
              refX="7"
              refY="4.5"
              orient="auto"
            >
              <path d="M0 0 L0 9 L8 4.5 Z" className={styles.venousArrowMarker} />
            </marker>
            <marker
              id="cardiohelp-return-arrow"
              markerWidth="9"
              markerHeight="9"
              refX="7"
              refY="4.5"
              orient="auto"
            >
              <path d="M0 0 L0 9 L8 4.5 Z" className={styles.returnArrowMarker} />
            </marker>
            <marker
              id="cardiohelp-gas-arrow"
              markerWidth="9"
              markerHeight="9"
              refX="7"
              refY="4.5"
              orient="auto"
            >
              <path d="M0 0 L0 9 L8 4.5 Z" className={styles.gasArrowMarker} />
            </marker>
          </defs>

          <rect x="18" y="22" width="294" height="500" rx="30" className={styles.anatomyBackdrop} />
          <text x="42" y="55" className={styles.svgSectionLabel}>
            PATIENT / CANNULATION
          </text>
          <text x="42" y="76" className={styles.svgSectionSubLabel}>
            Simplified anterior anatomy
          </text>

          <circle cx="164" cy="103" r="35" className={styles.anatomyOutline} />
          <path
            d="M124 145 Q164 123 204 145 L224 247 Q234 320 218 405 L244 484 H199 L169 410 L138 484 H93 L111 405 Q95 319 105 247 Z"
            className={styles.anatomyOutline}
          />
          <path d="M113 167 Q76 226 68 294" className={styles.anatomyArm} />
          <path d="M214 167 Q252 226 260 294" className={styles.anatomyArm} />

          <path
            d="M149 181 C144 230 144 324 145 388 M145 358 C126 389 109 418 96 447 M145 358 C164 390 190 420 214 447"
            className={styles.venousAnatomy}
          />
          <path
            d="M191 181 C200 232 197 326 195 388 M195 358 C178 392 161 420 147 451 M195 358 C213 391 230 420 244 447"
            className={styles.arterialAnatomy}
          />
          <path
            d="M157 166 C145 150 149 137 163 141 C176 125 194 138 190 155 C187 169 170 181 164 185 C160 181 158 174 157 166 Z"
            className={styles.heartShape}
          />

          <path
            d="M146 245 C132 295 110 366 96 447"
            className={`${styles.drainageCannula} ${bloodMoving ? styles.cannulaFlowMoving : ''}`}
            markerEnd="url(#cardiohelp-venous-arrow)"
          />
          {isVa ? (
            <path
              d="M244 447 C226 411 207 379 197 335 C195 299 194 247 193 213"
              className={`${styles.returnCannula} ${bloodMoving ? styles.cannulaReturnFlowMoving : ''}`}
              markerEnd="url(#cardiohelp-return-arrow)"
            />
          ) : (
            <path
              d="M214 447 C199 384 181 291 170 185"
              className={`${styles.returnCannula} ${bloodMoving ? styles.cannulaReturnFlowMoving : ''}`}
              markerEnd="url(#cardiohelp-return-arrow)"
            />
          )}
          {isVa ? (
            <g aria-label="VA native ejection, mixing, and monitoring cues">
              <path
                d="M165 151 C189 140 214 136 238 151 C250 166 253 193 252 220"
                className={styles.nativeEjectionPath}
                markerEnd="url(#cardiohelp-return-arrow)"
              />
              <circle cx="196" cy="218" r="11" className={styles.mixingPoint} />
              <path d="M196 207 V188 H278" className={styles.mixingLeader} />
              <text x="278" y="184" textAnchor="end" className={styles.vaCueLabel}>
                MIXING REGION VARIES
              </text>
              <circle cx="258" cy="223" r="23" className={styles.rightArmMonitor} />
              <text x="258" y="219" textAnchor="middle" className={styles.rightArmMonitorLabel}>
                R ARM
              </text>
              <text x="258" y="231" textAnchor="middle" className={styles.rightArmMonitorValue}>
                {state.patient.rightRadialSpo2.toFixed(0)}%
              </text>
              <path d="M244 447 C255 462 263 476 266 493" className={styles.distalPerfusionCue} />
              <text x="288" y="493" textAnchor="end" className={styles.distalPerfusionLabel}>
                DISTAL LIMB CHECK
              </text>
              <text x="42" y="109" className={styles.vaCueLabel}>
                NATIVE EJECTION → UPPER BODY
              </text>
            </g>
          ) : null}
          <circle cx="96" cy="447" r="8" className={styles.drainageInsertionSite} />
          <circle cx={returnPortX} cy="447" r="8" className={styles.returnInsertionSite} />
          <text x="34" y="500" className={styles.cannulaLabel}>
            Femoral vein drainage
          </text>
          <text x="158" y="519" className={styles.cannulaLabel}>
            {isVa ? 'Femoral artery return' : 'Femoral vein return'}
          </text>
          <text x="38" y="329" className={styles.anatomyVesselLabel}>
            VENOUS
          </text>
          <text x="210" y="329" className={styles.anatomyVesselLabel}>
            ARTERIAL
          </text>

          <rect
            x="330"
            y="22"
            width="772"
            height="500"
            rx="30"
            className={styles.circuitBackdrop}
          />
          <text x="354" y="55" className={styles.svgSectionLabel}>
            EXTRACORPOREAL CIRCUIT
          </text>
          <text x="354" y="76" className={styles.svgSectionSubLabel}>
            Follow the arrows from drainage to return
          </text>

          <g className={state.circuit.drainageChatter ? styles.chatteringTube : undefined}>
            <path
              d="M96 447 C215 467 293 385 405 385"
              className={`${styles.circuitLimb} ${styles.drainageLimb}`}
            />
            <path
              d="M96 447 C215 467 293 385 405 385"
              className={`${styles.circuitFlowTrace} ${bloodMoving ? styles.circuitFlowMoving : ''}`}
              markerEnd="url(#cardiohelp-flow-arrow)"
            />
          </g>
          <text x="286" y="361" textAnchor="middle" className={styles.limbLabel}>
            DRAINAGE LIMB · NEGATIVE PRESSURE
          </text>

          <path d={postPumpPath} className={`${styles.circuitLimb} ${styles.postPumpLimb}`} />
          <path
            d={postPumpPath}
            className={`${styles.circuitFlowTrace} ${bloodMoving ? styles.circuitFlowMoving : ''}`}
            markerEnd="url(#cardiohelp-flow-arrow)"
          />
          <text x="601" y="361" textAnchor="middle" className={styles.limbLabel}>
            PUMP OUTFLOW
          </text>

          <path d={returnLimbPath} className={`${styles.circuitLimb} ${styles.returnLimb}`} />
          <path
            d={returnLimbPath}
            className={`${styles.circuitFlowTrace} ${bloodMoving ? styles.circuitFlowMoving : ''}`}
            markerEnd="url(#cardiohelp-flow-arrow)"
          />
          <text x="692" y="568" textAnchor="middle" className={styles.returnLimbLabel}>
            RETURN LIMB · POSITIVE PRESSURE · TO {returnVesselLabel.toUpperCase()}
          </text>

          <g transform="translate(455 385)">
            <circle r="53" className={styles.pumpBody} />
            <circle r="40" className={styles.pumpInnerRing} />
            <path
              d="M-25 -6 C-10 -34 31 -25 35 5 C24 34 -17 35 -35 7 C-25 2 -16 -2 -25 -6 Z"
              className={`${styles.pumpRotor} ${state.device.pumpRunning ? styles.pumpRotorRunning : ''}`}
            />
            <path
              d="M-48 0 H-8 C10 0 24 -11 31 -29"
              className={styles.pumpMechanismPath}
              markerEnd="url(#cardiohelp-flow-arrow)"
            />
            <circle r="8" className={styles.pumpHub} />
            <text y="78" textAnchor="middle" className={styles.componentLabel}>
              CENTRIFUGAL PUMP
            </text>
            <text y="93" textAnchor="middle" className={styles.componentSubLabel}>
              CENTER INLET → TANGENTIAL OUTFLOW
            </text>
          </g>

          <rect
            x="700"
            y="292"
            width="125"
            height="186"
            rx="22"
            className={styles.oxygenatorBody}
          />
          {Array.from({ length: 7 }, (_, index) => (
            <line
              key={index}
              x1={720 + index * 14}
              x2={720 + index * 14}
              y1="315"
              y2="454"
              className={styles.oxygenatorFiber}
            />
          ))}
          <path d="M700 385 H825" className={styles.oxygenatorBloodPath} />
          <path
            d="M700 385 H825"
            className={`${styles.circuitFlowTrace} ${bloodMoving ? styles.circuitFlowMoving : ''}`}
            markerEnd="url(#cardiohelp-flow-arrow)"
          />
          <path
            d="M762 462 V310"
            className={`${styles.oxygenatorGasPath} ${gasMoving ? styles.oxygenatorGasMoving : ''}`}
            markerEnd="url(#cardiohelp-gas-arrow)"
          />
          <text x="762" y="272" textAnchor="middle" className={styles.componentLabel}>
            MEMBRANE OXYGENATOR
          </text>
          <text x="762" y="500" textAnchor="middle" className={styles.componentSubLabel}>
            BLOOD AROUND FIBERS · GAS THROUGH FIBERS
          </text>
          <text x="832" y="319" className={styles.oxygenatorGasLabel}>
            GAS EXHAUST
          </text>
          <text x="832" y="459" className={styles.oxygenatorGasLabel}>
            SWEEP GAS IN
          </text>

          <path d="M584 259 V240 H884 V259" className={styles.deltaBracket} />
          <text x="734" y="226" textAnchor="middle" className={styles.deltaLabel}>
            Δp TREND = pInt − pArt · {state.circuit.deltaP} mmHg
          </text>

          <g transform="translate(340 321)" className={styles.sensorFlag}>
            <rect x="-34" y="-20" width="68" height="40" rx="10" />
            <text y="5" textAnchor="middle">
              pVen
            </text>
            <path d="M0 20 V57" className={styles.sensorLeader} />
          </g>
          <g transform="translate(584 295)" className={styles.sensorFlag}>
            <rect x="-34" y="-20" width="68" height="40" rx="10" />
            <text y="5" textAnchor="middle">
              pInt
            </text>
            <path d="M0 20 V83" className={styles.sensorLeader} />
          </g>
          <g transform="translate(884 295)" className={styles.sensorFlag}>
            <rect x="-34" y="-20" width="68" height="40" rx="10" />
            <text y="5" textAnchor="middle">
              pArt
            </text>
            <path d="M0 20 V83" className={styles.sensorLeader} />
          </g>
          <g transform="translate(963 314)" className={styles.sensorFlag}>
            <rect x="-52" y="-24" width="104" height="48" rx="11" />
            <text y="-2" textAnchor="middle">
              FLOW +
            </text>
            <text y="13" textAnchor="middle">
              BUBBLE SENSOR
            </text>
            <path d="M0 24 V64" className={styles.sensorLeader} />
          </g>
          <circle cx="650" cy="385" r="10" className={styles.accessPoint} />
          <path d="M650 375 V333" className={styles.accessLeader} />
          <text x="650" y="320" textAnchor="middle" className={styles.accessLabel}>
            PRE-OXYGENATOR ACCESS
          </text>

          <path
            d="M236 428 H298"
            className={styles.staticDirectionArrow}
            markerEnd="url(#cardiohelp-venous-arrow)"
          />
          <path
            d="M526 414 H614"
            className={styles.staticDirectionArrow}
            markerEnd="url(#cardiohelp-flow-arrow)"
          />
          <path
            d="M987 420 V478"
            className={styles.staticDirectionArrow}
            markerEnd="url(#cardiohelp-return-arrow)"
          />
          <path
            d="M688 540 H594"
            className={styles.staticDirectionArrow}
            markerEnd="url(#cardiohelp-return-arrow)"
          />
          <path
            d={`M${returnPortX} 505 V470`}
            className={styles.staticDirectionArrow}
            markerEnd="url(#cardiohelp-return-arrow)"
          />
        </svg>
      </div>
      <p className={styles.circuitPanHint}>
        On a narrow screen, swipe the diagram or focus it and use horizontal arrow keys to inspect
        the full circuit.
      </p>

      <ul className={styles.circuitLegend} aria-label="Circuit schematic legend">
        <li>
          <i data-kind="drainage" aria-hidden="true" />
          <span>Venous drainage limb</span>
        </li>
        <li>
          <i data-kind="post-pump" aria-hidden="true" />
          <span>Post-pump / membrane path</span>
        </li>
        <li>
          <i data-kind="return" aria-hidden="true" />
          <span>{supportModeLabel} return limb</span>
        </li>
        <li>
          <i data-kind="gas" aria-hidden="true" />
          <span>Sweep-gas path through simplified hollow fibers</span>
        </li>
        <li>
          <i data-kind="sensor" aria-hidden="true" />
          <span>Pressure or flow sensor</span>
        </li>
      </ul>

      <div className={styles.circuitReadoutGrid}>
        <div>
          <span>Flow</span>
          <strong>{state.circuit.bloodFlow.toFixed(2)} L/min</strong>
        </div>
        <div>
          <span>pVen</span>
          <strong>{state.circuit.pVen} mmHg</strong>
        </div>
        <div>
          <span>pInt</span>
          <strong>{state.circuit.pInt} mmHg</strong>
        </div>
        <div>
          <span>pArt</span>
          <strong>{state.circuit.pArt} mmHg</strong>
        </div>
        <div>
          <span>Δp trend</span>
          <strong>{state.circuit.deltaP} mmHg</strong>
        </div>
        <div>
          <span>Pre-oxygenator saturation</span>
          <strong>{state.circuit.preOxygenatorSaturation.toFixed(1)}%</strong>
        </div>
      </div>

      <div className={styles.patternCallout} data-alert={lowFlow || state.circuit.drainageChatter}>
        <Activity aria-hidden="true" />
        <div>
          <strong>{resistancePattern}</strong>
          <span>
            {state.circuit.drainageChatter
              ? 'Visible + text cue: drainage line chattering with increasingly negative pVen.'
              : 'Compare flow and all three pressure locations; do not interpret one value in isolation.'}
          </span>
        </div>
      </div>

      <button
        id="cardiohelp-circuit-check"
        type="button"
        className={styles.primaryAction}
        disabled={!controlsEnabled || state.circuit.circuitInspected}
        data-guided-help={guidedControlId === 'cardiohelp-circuit-check'}
        onClick={() => dispatch({ type: 'PERFORM_CHECK', checkId: TIP_TO_TIP_CHECK_ID })}
      >
        {state.circuit.circuitInspected ? (
          <>
            <CheckCircle2 aria-hidden="true" /> Tip-to-tip check documented
          </>
        ) : (
          <>
            <Inspect aria-hidden="true" /> Perform tip-to-tip circuit and sensor check
          </>
        )}
      </button>
      {state.circuit.circuitInspected ? (
        <div className={styles.inspectionFeedback} role="status" aria-live="polite">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>
              {startupInspectionCompleted
                ? 'Startup and tip-to-tip inspection complete'
                : 'Circuit and sensor check documented'}
            </strong>
            <span>
              {startupInspectionCompleted
                ? 'Self-test passed and the circuit inspection is recorded. Advance simulation time, then reassess device, circuit/gas, and patient response.'
                : state.scenario.activeFaults.length > 0
                  ? 'The inspection is recorded, but it does not automatically correct the separate active scenario cause. Continue targeted troubleshooting.'
                  : 'The inspection is recorded. Continue with device, circuit/gas, and patient reassessment.'}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function GasBlenderPanel({
  state,
  dispatch,
  controlsEnabled,
  guidedTarget,
  guidedControlId,
  initiationTargets = null,
}: SimulationPanelProps) {
  const sweepTargetMatched = initiationTargets
    ? Math.abs(state.gas.sweepLpm - initiationTargets.sweepLpm) <=
      (initiationTargets.sweepTolerance ?? 0.1)
    : false
  const fio2TargetMatched = initiationTargets
    ? Math.abs(state.gas.fio2 - initiationTargets.fio2) <= (initiationTargets.fio2Tolerance ?? 0.01)
    : false

  return (
    <section
      id="cardiohelp-gas-panel"
      className={styles.gasPanel}
      aria-labelledby="gas-panel-heading"
      data-guided-focus={guidedTarget === 'gas-panel'}
      data-guided-help={guidedControlId === 'cardiohelp-gas-panel'}
      tabIndex={-1}
    >
      {guidedTarget === 'gas-panel' ? (
        <div className={styles.guidedFocusFlag} role="status">
          <span aria-hidden="true">●</span> Learn focus: separate gas panel
        </div>
      ) : null}
      <div className={styles.externalPanelHeader}>
        <Wind aria-hidden="true" />
        <div>
          <span>Separate external control</span>
          <h2 id="gas-panel-heading">Gas blender</h2>
        </div>
      </div>
      <p className={styles.externalBoundary}>
        Sweep and sweep-gas FiO₂ are not CARDIOHELP-i touchscreen controls.
      </p>

      <label className={styles.rangeControl} data-initiation-target={Boolean(initiationTargets)}>
        <span>
          <strong>Sweep flow</strong>
          <output>{state.gas.sweepLpm.toFixed(1)} L/min</output>
        </span>
        {initiationTargets ? (
          <span
            id="cardiohelp-sweep-order-cue"
            className={styles.simulatorOrderCue}
            data-matched={sweepTargetMatched}
            role="note"
            aria-label="Sweep initiation order"
          >
            <span>Simulated case order</span>
            <strong>{initiationTargets.sweepLpm.toFixed(1)} L/min</strong>
            <small>Current: {state.gas.sweepLpm.toFixed(1)} L/min</small>
          </span>
        ) : null}
        <input
          id="cardiohelp-sweep-control"
          className={initiationTargets ? styles.simulatorTargetControl : undefined}
          type="range"
          min="0"
          max="15"
          step="0.5"
          value={state.gas.sweepLpm}
          disabled={!controlsEnabled}
          aria-label="Sweep flow control"
          aria-describedby={
            initiationTargets
              ? 'cardiohelp-sweep-order-cue cardiohelp-sweep-help'
              : 'cardiohelp-sweep-help'
          }
          data-initiation-target={Boolean(initiationTargets)}
          data-target-matched={sweepTargetMatched}
          data-guided-help={guidedControlId === 'cardiohelp-sweep-control'}
          onKeyDown={(event) => {
            const keyTargets: Partial<Record<string, number>> = {
              ArrowDown: state.gas.sweepLpm - 0.5,
              ArrowLeft: state.gas.sweepLpm - 0.5,
              ArrowUp: state.gas.sweepLpm + 0.5,
              ArrowRight: state.gas.sweepLpm + 0.5,
              PageDown: state.gas.sweepLpm - 1,
              PageUp: state.gas.sweepLpm + 1,
              Home: 0,
              End: 15,
            }
            const nextSweep = keyTargets[event.key]
            if (nextSweep === undefined) return
            event.preventDefault()
            dispatch({ type: 'SET_SWEEP', sweep: nextSweep })
          }}
          onChange={(event) => dispatch({ type: 'SET_SWEEP', sweep: Number(event.target.value) })}
        />
        <small id="cardiohelp-sweep-help">
          Primarily changes membrane CO₂ clearance in this educational model. Use the slider or
          arrow keys.
        </small>
      </label>

      <label className={styles.rangeControl} data-initiation-target={Boolean(initiationTargets)}>
        <span>
          <strong>Sweep-gas FiO₂</strong>
          <output>{Math.round(state.gas.fio2 * 100)}%</output>
        </span>
        {initiationTargets ? (
          <span
            id="cardiohelp-fio2-order-cue"
            className={styles.simulatorOrderCue}
            data-matched={fio2TargetMatched}
            role="note"
            aria-label="Sweep-gas FiO2 initiation order"
          >
            <span>Simulated case order</span>
            <strong>{Math.round(initiationTargets.fio2 * 100)}%</strong>
            <small>Current: {Math.round(state.gas.fio2 * 100)}%</small>
          </span>
        ) : null}
        <input
          id="cardiohelp-fio2-control"
          className={initiationTargets ? styles.simulatorTargetControl : undefined}
          type="range"
          min="0.21"
          max="1"
          step="0.01"
          value={state.gas.fio2}
          disabled={!controlsEnabled}
          aria-label="Sweep-gas FiO₂ control"
          aria-describedby={
            initiationTargets
              ? 'cardiohelp-fio2-order-cue cardiohelp-fio2-help'
              : 'cardiohelp-fio2-help'
          }
          data-initiation-target={Boolean(initiationTargets)}
          data-target-matched={fio2TargetMatched}
          data-guided-help={guidedControlId === 'cardiohelp-fio2-control'}
          onKeyDown={(event) => {
            const keyTargets: Partial<Record<string, number>> = {
              ArrowDown: state.gas.fio2 - 0.01,
              ArrowLeft: state.gas.fio2 - 0.01,
              ArrowUp: state.gas.fio2 + 0.01,
              ArrowRight: state.gas.fio2 + 0.01,
              PageDown: state.gas.fio2 - 0.1,
              PageUp: state.gas.fio2 + 0.1,
              Home: 0.21,
              End: 1,
            }
            const nextFio2 = keyTargets[event.key]
            if (nextFio2 === undefined) return
            event.preventDefault()
            dispatch({ type: 'SET_GAS_FIO2', fio2: nextFio2 })
          }}
          onChange={(event) => dispatch({ type: 'SET_GAS_FIO2', fio2: Number(event.target.value) })}
        />
        <small id="cardiohelp-fio2-help">
          Primarily changes oxygenator outlet oxygen tension, not CO₂ clearance. Use the slider or
          arrow keys.
        </small>
      </label>

      <div className={styles.sourceState} data-connected={state.gas.sourceConnected} role="status">
        {state.gas.sourceConnected ? <PlugZap aria-hidden="true" /> : <Fan aria-hidden="true" />}
        <span>
          <strong>Gas source {state.gas.sourceConnected ? 'connected' : 'interrupted'}</strong>
          <small>
            {state.gas.sourceConnected ? 'Flow available to oxygenator' : 'No sweep-gas delivery'}
          </small>
        </span>
      </div>
      {!state.gas.sourceConnected ? (
        <button
          id="cardiohelp-restore-gas-source"
          type="button"
          className={styles.primaryAction}
          disabled={!controlsEnabled}
          data-guided-help={guidedControlId === 'cardiohelp-restore-gas-source'}
          onClick={() => dispatch({ type: 'RESTORE_GAS_SOURCE' })}
        >
          <RotateCcw aria-hidden="true" /> Restore verified gas source
        </button>
      ) : null}
    </section>
  )
}

function PatientMonitor({
  state,
  guidedTarget,
  guidedControlId,
}: Pick<SimulationPanelProps, 'state' | 'guidedTarget' | 'guidedControlId'>) {
  return (
    <section
      id="cardiohelp-patient-monitor"
      className={styles.patientMonitor}
      aria-labelledby="patient-monitor-heading"
      data-guided-focus={guidedTarget === 'patient-monitor'}
      data-guided-help={guidedControlId === 'cardiohelp-patient-monitor'}
      tabIndex={-1}
    >
      {guidedTarget === 'patient-monitor' ? (
        <div className={styles.guidedFocusFlag} role="status">
          <span aria-hidden="true">●</span> Learn focus: independent patient monitor
        </div>
      ) : null}
      <div className={styles.externalPanelHeader}>
        <HeartPulse aria-hidden="true" />
        <div>
          <span>Independent patient data</span>
          <h2 id="patient-monitor-heading">Bedside monitor & blood gas</h2>
        </div>
      </div>
      <div className={styles.patientGrid}>
        {state.supportMode === 'va' ? (
          <>
            <div data-alert={state.patient.rightRadialSpo2 < 88}>
              <span>Right-arm SpO₂</span>
              <strong>{state.patient.rightRadialSpo2.toFixed(1)}%</strong>
              {state.patient.rightRadialSpo2 < 88 ? (
                <small className={styles.patientAlertText}>
                  Attention: low simulated upper-body oxygenation
                </small>
              ) : null}
            </div>
            <div>
              <span>Femoral arterial SpO₂</span>
              <strong>{state.patient.femoralArterialSpo2.toFixed(1)}%</strong>
            </div>
          </>
        ) : (
          <div data-alert={state.patient.spo2 < 88}>
            <span>SpO₂</span>
            <strong>{state.patient.spo2.toFixed(1)}%</strong>
            {state.patient.spo2 < 88 ? (
              <small className={styles.patientAlertText}>Attention: low simulated SpO₂</small>
            ) : null}
          </div>
        )}
        <div>
          <span>PaCO₂</span>
          <strong>{state.patient.paCO2.toFixed(1)} mmHg</strong>
        </div>
        <div data-alert={state.patient.pH < 7.2}>
          <span>pH</span>
          <strong>{state.patient.pH.toFixed(2)}</strong>
          {state.patient.pH < 7.2 ? (
            <small className={styles.patientAlertText}>Attention: simulated acidemia</small>
          ) : null}
        </div>
        <div>
          <span>HCO₃⁻</span>
          <strong>{state.patient.bicarbonate.toFixed(0)} mmol/L</strong>
        </div>
        <div>
          <span>Respiratory rate</span>
          <strong>{state.patient.respiratoryRate}/min</strong>
        </div>
        <div>
          <span>Work of breathing</span>
          <strong>{state.patient.workOfBreathing}</strong>
        </div>
        <div>
          <span>MAP</span>
          <strong>{state.patient.meanArterialPressure} mmHg</strong>
        </div>
        <div>
          <span>Heart rate</span>
          <strong>{state.patient.heartRate}/min</strong>
        </div>
        {state.scenario.clinical ? (
          <>
            <div
              data-alert={
                state.patient.centralVenousPressure < 4 || state.patient.centralVenousPressure > 16
              }
            >
              <span>CVP</span>
              <strong>{state.patient.centralVenousPressure} mmHg</strong>
            </div>
            <div data-alert={state.patient.lactate >= 4}>
              <span>Lactate</span>
              <strong>{state.patient.lactate.toFixed(1)} mmol/L</strong>
            </div>
            <div data-alert={state.patient.urineOutputMlHr < 20}>
              <span>Urine output</span>
              <strong>{state.patient.urineOutputMlHr} mL/h</strong>
            </div>
            <div data-alert={state.circuit.hemoglobin < 7}>
              <span>Hemoglobin</span>
              <strong>{state.circuit.hemoglobin.toFixed(1)} g/dL</strong>
            </div>
            <div data-alert={state.patient.airwayPressure > 35}>
              <span>Airway pressure</span>
              <strong>{state.patient.airwayPressure} cmH₂O</strong>
            </div>
            <div data-alert={state.patient.lungSliding !== 'bilateral'}>
              <span>Lung sliding</span>
              <strong>{state.patient.lungSliding.replace('-', ' ')}</strong>
            </div>
          </>
        ) : null}
        {state.supportMode === 'va' ? (
          <>
            <div data-alert={state.patient.pulsePressure < 10}>
              <span>Pulse pressure</span>
              <strong>{state.patient.pulsePressure} mmHg</strong>
              {state.patient.pulsePressure < 10 ? (
                <small className={styles.patientAlertText}>
                  Attention: low simulated pulsatility
                </small>
              ) : null}
            </div>
            <div>
              <span>Aortic-valve opening</span>
              <strong>{state.patient.aorticValveOpening ? 'Present' : 'Not observed'}</strong>
            </div>
            <div>
              <span>Native cardiac output</span>
              <strong>{state.patient.nativeCardiacOutputLpm.toFixed(1)} L/min</strong>
            </div>
            <div data-alert={state.patient.pulmonaryCongestion === 'marked'}>
              <span>Pulmonary congestion</span>
              <strong>{state.patient.pulmonaryCongestion}</strong>
            </div>
            {state.scenario.clinical ? (
              <div data-alert={state.patient.distalLimbPerfusion !== 'normal'}>
                <span>Cannulated-limb perfusion</span>
                <strong>
                  {state.patient.distalLimbPerfusion} · NIRS {state.patient.distalLimbNirs}%
                </strong>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      <p className={styles.monitorReminder}>
        {state.supportMode === 'va'
          ? 'Circuit pArt is post-oxygenator circuit pressure—not patient arterial pressure. Reassess right-arm oxygenation, pulsatility, native heart and lung function, systemic and cannulated-limb perfusion, circuit, and laboratory data together.'
          : 'Console values are not a complete clinical assessment. Reassess the patient, circuit, independent monitor, and laboratory data together.'}
      </p>
    </section>
  )
}

const trendMeta: Record<TrendParameter, { label: string; unit: string; color: string }> = {
  flow: { label: 'Blood flow', unit: 'L/min', color: '#3ad2d8' },
  pVen: { label: 'pVen', unit: 'mmHg', color: '#5fb1d6' },
  pInt: { label: 'pInt', unit: 'mmHg', color: '#ffbd59' },
  pArt: { label: 'pArt', unit: 'mmHg', color: '#f17575' },
  deltaP: { label: 'Δp trend', unit: 'mmHg', color: '#c89cff' },
  paCO2: { label: 'PaCO₂', unit: 'mmHg', color: '#f7a8c3' },
  spo2: { label: 'SpO₂', unit: '%', color: '#91e6a8' },
  map: { label: 'MAP', unit: 'mmHg', color: '#f4cf75' },
  lactate: { label: 'Lactate', unit: 'mmol/L', color: '#ff9b7a' },
}

function TrendPanel({
  state,
  guidedTarget,
  guidedControlId,
}: Pick<SimulationPanelProps, 'state' | 'guidedTarget' | 'guidedControlId'>) {
  const [parameter, setParameter] = useState<TrendParameter>('flow')
  const samples = state.trends.slice(-60)
  const values = samples.map((sample) => sample[parameter])
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const range = Math.max(1, maximum - minimum)
  const points = samples
    .map((sample, index) => {
      const x = samples.length <= 1 ? 0 : (index / (samples.length - 1)) * 560
      const y = 150 - ((sample[parameter] - minimum) / range) * 120
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const latest = values.at(-1) ?? 0
  const parameterLabel =
    state.supportMode === 'va' && parameter === 'spo2'
      ? 'Right-arm SpO₂'
      : trendMeta[parameter].label

  return (
    <section
      id="cardiohelp-trend-panel"
      className={styles.trendPanel}
      aria-labelledby="trend-heading"
      data-guided-focus={guidedTarget === 'trend-panel'}
      data-guided-help={guidedControlId === 'cardiohelp-trend-panel'}
      tabIndex={-1}
    >
      {guidedTarget === 'trend-panel' ? (
        <div className={styles.guidedFocusFlag} role="status">
          <span aria-hidden="true">●</span> Learn focus: device and patient trends
        </div>
      ) : null}
      <div className={styles.panelHeading}>
        <div>
          <span className={styles.kicker}>Reassessment</span>
          <h2 id="trend-heading">Device + patient trends</h2>
        </div>
        <span>
          <strong>{latest.toFixed(parameter === 'flow' ? 2 : 1)}</strong>{' '}
          {trendMeta[parameter].unit}
        </span>
      </div>
      <div className={styles.trendTabs} role="tablist" aria-label="Trend parameter">
        {(Object.keys(trendMeta) as TrendParameter[]).map((key) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={parameter === key}
            data-active={parameter === key}
            onClick={() => setParameter(key)}
          >
            {state.supportMode === 'va' && key === 'spo2' ? 'Right-arm SpO₂' : trendMeta[key].label}
          </button>
        ))}
      </div>
      <svg
        viewBox="0 0 600 180"
        role="img"
        aria-label={`${parameterLabel} over the last ${samples.length} seconds`}
      >
        <line x1="20" x2="580" y1="30" y2="30" className={styles.chartGrid} />
        <line x1="20" x2="580" y1="90" y2="90" className={styles.chartGrid} />
        <line x1="20" x2="580" y1="150" y2="150" className={styles.chartGrid} />
        <polyline
          transform="translate(20 0)"
          points={points}
          fill="none"
          stroke={trendMeta[parameter].color}
          strokeWidth="4"
          vectorEffect="non-scaling-stroke"
        />
        <text x="18" y="22">
          {maximum.toFixed(1)}
        </text>
        <text x="18" y="170">
          {minimum.toFixed(1)}
        </text>
      </svg>
      {parameter === 'deltaP' ? (
        <p className={styles.deltaBoundary}>
          Δp is presented as a trend only. No fixed alarm priority is encoded pending target-device
          review.
        </p>
      ) : null}
    </section>
  )
}

export function CircuitAndMonitors(props: SimulationPanelProps) {
  return (
    <div className={styles.monitoringWorkspace}>
      <CircuitSchematic {...props} />
      <div className={styles.externalPanelGrid}>
        <GasBlenderPanel {...props} />
        <PatientMonitor
          state={props.state}
          guidedTarget={props.guidedTarget}
          guidedControlId={props.guidedControlId}
        />
      </div>
      <TrendPanel
        state={props.state}
        guidedTarget={props.guidedTarget}
        guidedControlId={props.guidedControlId}
      />
    </div>
  )
}
