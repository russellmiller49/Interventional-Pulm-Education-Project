'use client'

import { useEffect, useMemo, useReducer, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import {
  ventilationDecisionTable,
  ventilationLearningUnits,
  type VentilationLearningUnit,
} from '../content/learningCurriculum'
import { ventilationEvidenceById } from '../content/evidence'
import { ventilationLessonAttempt, ventilationLessonRuntimeById } from '../content/lessonRuntime'
import { createInitialSimulationState } from '../engine/simulation'
import { ventilationSimulationReducer } from '../engine/reducer'
import { normalBreath } from './MechanicalVentilationNoviceRunway'
import { MechanicalVentilationTeachingPanel } from './MechanicalVentilationTeachingPanel'
import { MechanicalVentilatorConsole } from './MechanicalVentilatorConsole'
import { tracePath } from './teaching/shared'
import styles from './ventilation-course.module.css'

const breathPhases = [
  {
    id: 'trigger',
    title: 'Start',
    term: 'Trigger',
    at: 0.02,
    text: 'A patient signal or the machine’s clock starts inspiration. Find where inward flow begins.',
  },
  {
    id: 'delivery',
    title: 'Deliver',
    term: 'Inspiration',
    at: 0.16,
    text: 'Gas moves inward. Flow describes its speed; volume adds up as it enters. Pressure supplies the push.',
  },
  {
    id: 'cycle',
    title: 'End',
    term: 'Cycle',
    at: 0.286,
    text: 'Machine inspiration ends. The flow changes direction as the breath moves into expiration.',
  },
  {
    id: 'expiration',
    title: 'Empty',
    term: 'Expiration',
    at: 0.66,
    text: 'Gas moves outward as the respiratory system recoils. Follow outward flow back toward zero.',
  },
] as const

export function VentilationBreathExplorer({ compact = false }: { readonly compact?: boolean }) {
  const [active, setActive] = useState(0)
  const breath = useMemo(() => normalBreath(), [])
  const phase = breathPhases[active]
  const traces = [
    { key: 'pawCmH2O' as const, label: 'Pressure', min: 0, max: 30, color: '#087275' },
    { key: 'flowLMin' as const, label: 'Flow', min: -65, max: 40, color: '#975715' },
    { key: 'volumeMl' as const, label: 'Volume', min: 0, max: 520, color: '#596bab' },
  ]
  return (
    <figure className={styles.breath}>
      <div className={styles.breathHeader}>
        <strong>One supported breath</strong>
        <span className={styles.badge}>Illustrated · passive</span>
      </div>
      <svg
        viewBox="0 0 400 238"
        role="img"
        aria-label="Three traces share a time axis. During inspiration pressure rises, flow is inward, and volume increases. During expiration flow is outward, slowing as volume falls. This is an illustrative normal breath, not patient data."
      >
        {traces.map((trace, index) => (
          <g key={trace.key} transform={`translate(64 ${index * 70 + 12})`}>
            <text x="-61" y="14" fill={trace.color} fontSize="10" fontWeight="700">
              {trace.label}
            </text>
            {[0, 0.25, 0.5, 0.75, 1].map((x) => (
              <path key={x} d={`M${x * 324} 4 V57`} stroke="#d3e1d7" strokeWidth=".7" />
            ))}
            <path
              d={`M0 ${4 + (trace.max / (trace.max - trace.min)) * 49} H324`}
              stroke="#aebeb6"
              strokeWidth=".7"
              strokeDasharray={index === 1 ? '3 3' : undefined}
            />
            <path
              d={tracePath(breath, trace.key, trace.min, trace.max, 324, 58)}
              fill="none"
              stroke={trace.color}
              strokeWidth="2.5"
            />
            <path
              d={`M${phase.at * 324} 0 V60`}
              stroke="#294f46"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          </g>
        ))}
        <text x="66" y="232" fontSize="9" fill="#456556">
          Inspiration
        </text>
        <text x="216" y="232" fontSize="9" fill="#456556">
          Expiration →
        </text>
      </svg>
      {!compact && (
        <>
          <div className={styles.breathPhases} aria-label="Explore the breath cycle">
            {breathPhases.map((item, index) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={index === active}
                onClick={() => setActive(index)}
              >
                {item.title}
              </button>
            ))}
          </div>
          <figcaption className={styles.breathCaption} aria-live="polite">
            <strong>{phase.term}. </strong>
            {phase.text}
          </figcaption>
        </>
      )}
      {compact && (
        <figcaption className={styles.muted}>
          Start → deliver → end inspiration → empty.
          <br />
          The same breath connects every lesson.
        </figcaption>
      )}
    </figure>
  )
}

export function VentilationBreathSpine({ at }: { readonly at: VentilationLearningUnit['spine'] }) {
  return (
    <div
      className={styles.spine}
      aria-label={`Breath cycle focus: ${at === 'whole' ? 'the whole breath' : at}`}
    >
      {breathPhases.map((phase, index) => (
        <span key={phase.id} data-active={at === 'whole' || phase.id === at}>
          {index + 1}. {phase.title}
        </span>
      ))}
    </div>
  )
}

const controls = [
  ['Oxygen concentration · FiO₂', 'Check oxygenation in the patient.'],
  ['Pressure between breaths · PEEP', 'Check oxygenation, mechanics, and circulation.'],
  ['Breath size or pressure support', 'Check delivered volume, pressure, and effort.'],
  ['Breath frequency', 'Check total rate, emptying, and CO₂ response.'],
  ['Timing and interaction', 'Check initiation, delivery, and the end of inspiration.'],
] as const

export function VentilationControlMap() {
  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>Five control families</p>
      <h2>Choose a goal. Check a result.</h2>
      <div className={styles.controlGrid}>
        {controls.map(([title, check]) => (
          <div key={title} className={styles.controlRow}>
            <strong>{title}</strong>
            <p>{check}</p>
          </div>
        ))}
      </div>
      <p className={styles.muted} style={{ marginTop: 15 }}>
        A teaching map. The available controls depend on the mode and device.
      </p>
    </div>
  )
}

export function VentilationProtectionReference() {
  return (
    <aside className={styles.breath} aria-label="Adult ARDS guideline reference">
      <span className={styles.badge}>Guideline · ATS 2024 · adult ARDS</span>
      <h2 style={{ marginTop: 18 }}>Two measurements, together</h2>
      <p className={styles.number}>
        4–8 <small>mL/kg PBW</small>
      </p>
      <p className={styles.muted}>Tidal volume, using predicted body weight</p>
      <p className={styles.number} style={{ marginTop: 20 }}>
        &lt;30 <small>cmH₂O</small>
      </p>
      <p className={styles.muted}>Plateau pressure, with a valid measurement</p>
      <p className={styles.muted} style={{ marginTop: 20 }}>
        These limits guide adult ARDS ventilation. They do not replace individualized clinical
        evaluation.
      </p>
      <a
        className={styles.textLink}
        href="https://pmc.ncbi.nlm.nih.gov/articles/PMC10870893/"
        target="_blank"
        rel="noreferrer"
      >
        Read the ATS recommendation
      </a>
    </aside>
  )
}

export function VentilationExpirationExplorer() {
  const [early, setEarly] = useState(false)
  return (
    <figure className={styles.breath}>
      <div className={styles.breathHeader}>
        <strong>Time available to empty</strong>
        <span className={styles.badge}>Illustrated relationship</span>
      </div>
      <svg
        viewBox="0 0 390 180"
        role="img"
        aria-label={
          early
            ? 'The next breath starts while outward flow is still present.'
            : 'Outward flow approaches zero before the next breath.'
        }
      >
        <path d="M35 40 H370" stroke="#a8bbae" strokeDasharray="4 4" />
        <text x="5" y="44" fontSize="12" fill="#456556">
          0
        </text>
        <path
          d="M35 40 L38 148 C80 95 145 55 215 45 S325 40 370 40"
          fill="none"
          stroke="#b67128"
          strokeWidth="3"
        />
        <path d={early ? 'M130 20 V157' : 'M346 20 V157'} stroke="#176960" strokeWidth="2" />
        <text x={early ? 135 : 235} y="17" fill="#176960" fontSize="11">
          Next inspiration
        </text>
        <text x="36" y="174" fill="#456556" fontSize="11">
          Outward flow during expiration →
        </text>
      </svg>
      <div className={styles.breathPhases} style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button type="button" aria-pressed={!early} onClick={() => setEarly(false)}>
          More time
        </button>
        <button type="button" aria-pressed={early} onClick={() => setEarly(true)}>
          Less time
        </button>
      </div>
      <figcaption className={styles.breathCaption} aria-live="polite">
        {early
          ? 'The next breath interrupts emptying. Less time can leave more gas behind when exhalation is slow.'
          : 'The same slow emptying has more time to finish. Look at flow immediately before the next breath.'}{' '}
        This sketch illustrates timing, not a measured amount of trapped gas.
      </figcaption>
    </figure>
  )
}

export function VentilationDecisionTable({ unitId }: { readonly unitId: string }) {
  const position = ventilationLearningUnits.findIndex((unit) => unit.id === unitId)
  const rows = ventilationDecisionTable.filter(
    (row) => ventilationLearningUnits.findIndex((unit) => unit.id === row.unitId) <= position,
  )
  if (!rows.length) return null
  return (
    <details className={styles.details}>
      <summary>Your growing bedside reasoning table</summary>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className={styles.muted}>
            Compare with the patient’s baseline and validate measurements.
          </caption>
          <thead>
            <tr>
              <th>Signal pattern</th>
              <th>Where to reason</th>
              <th>What to check</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-highlight={row.unitId === unitId}>
                <td>{row.signal}</td>
                <td>{row.location}</td>
                <td>{row.check}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export function VentilationLearningSources({
  evidenceIds,
}: {
  readonly evidenceIds: readonly string[]
}) {
  return (
    <details className={styles.details}>
      <summary>Sources and model boundaries</summary>
      <ul className={styles.sources}>
        {evidenceIds.map((id) => {
          const source = ventilationEvidenceById.get(id)
          return source ? (
            <li key={id}>
              <strong>
                {source.sourceClass === 'guideline' ? 'Guideline' : 'Clinical reference'} ·{' '}
              </strong>
              {source.sourceUrl ? (
                <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
              ) : (
                source.title
              )}
              <p>{source.citation}</p>
              <p>{source.limitations}</p>
              {source.reviewedAt && (
                <p>Source checked {source.reviewedAt}; independent clinical sign-off pending.</p>
              )}
            </li>
          ) : null
        })}
      </ul>
      <p className={styles.muted}>
        Examples and questions were authored for this course on September 5, 2026. Their distractors
        adapt the supplied casebook and existing lesson rationales. They are not patient data or
        prevalence estimates.
      </p>
    </details>
  )
}

function LiveExperiment({ unit }: { readonly unit: VentilationLearningUnit }) {
  const runtime = ventilationLessonRuntimeById.get(unit.id)
  const [simulation, dispatch] = useReducer(ventilationSimulationReducer, undefined, () =>
    createInitialSimulationState(
      runtime?.primary.caseId ?? unit.caseIds[0],
      'learn',
      runtime ? ventilationLessonAttempt(runtime.primary, 1) : 1,
      'hamilton-c6',
    ),
  )
  useEffect(() => {
    if (simulation.paused) return
    const timer = window.setInterval(() => dispatch({ type: 'TICK', seconds: 0.2 }), 200)
    return () => window.clearInterval(timer)
  }, [simulation.paused])
  return (
    <div>
      <p className={styles.notice}>
        Worked simulator example · synthetic values. This is a separate exploratory patient. Use its
        live findings, rather than the written example’s observations. Exploration earns no check
        credit.
      </p>
      <div className={styles.experimentControls}>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => dispatch({ type: 'SET_PAUSED', paused: !simulation.paused })}
        >
          {simulation.paused ? <Play size={16} /> : <Pause size={16} />}
          {simulation.paused ? 'Run example' : 'Pause example'}
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => dispatch({ type: 'STEP_BREATH' })}
        >
          Advance one breath
        </button>
        <span className={styles.muted}>{Math.floor(simulation.simulationTime)} s simulated</span>
        <button
          type="button"
          className={styles.secondary}
          onClick={() =>
            dispatch({
              type: 'LOAD_CASE',
              caseId: runtime?.primary.caseId ?? unit.caseIds[0],
              experience: 'learn',
              attempt: runtime ? ventilationLessonAttempt(runtime.primary, 1) : 1,
              deviceId: 'hamilton-c6',
            })
          }
        >
          <RotateCcw size={15} />
          Reset
        </button>
      </div>
      <div className={styles.experimentGrid}>
        <div className={styles.experimentPanel}>
          <MechanicalVentilationTeachingPanel
            lessonId={unit.id}
            state={simulation}
            dispatch={dispatch}
          />
        </div>
        <div className={styles.experimentPanel}>
          <MechanicalVentilatorConsole state={simulation} dispatch={dispatch} controlsEnabled />
        </div>
      </div>
      <p className={styles.muted}>
        The model approximates patient responses. Pause to inspect. Bedside procedures and device
        operation still require supervised training.
      </p>
    </div>
  )
}

export function VentilationLearningExperiment({
  unit,
}: {
  readonly unit: VentilationLearningUnit
}) {
  const [open, setOpen] = useState(false)
  if (unit.visual !== 'existing') return null
  return (
    <details className={styles.experiment} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Explore the existing diagram and ventilator</summary>
      {open && <LiveExperiment unit={unit} />}
    </details>
  )
}
