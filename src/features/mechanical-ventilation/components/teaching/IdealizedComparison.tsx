'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  idealBreaths,
  idealComparisonAxes,
  idealSeriesPath,
  type IdealInputs,
} from '../../engine/idealComparison'
import styles from '../stage/ventilation-stage.module.css'

// Authored mathematical inputs, not clinical targets. The pressure matches the finite-time
// delivered reference volume at Ti=1 s; it is not the equilibrium VT/C shortcut.
export const IDEAL_REFERENCE: IdealInputs = {
  compliance: 0.05,
  resistance: 10,
  peep: 5,
  volume: 0.4,
  pressure: 0.4 / (0.05 * -Math.expm1(-1 / (10 * 0.05))),
  ti: 1,
  duration: 4,
}
export function IdealizedComparison() {
  const figure = useRef<HTMLElement>(null)
  const [width, setWidth] = useState(330)
  useEffect(() => {
    if (!figure.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(180, entry.contentRect.width)),
    )
    observer.observe(figure.current)
    return () => observer.disconnect()
  }, [])
  const plotWidth = width - 70
  const [complianceScale, setCompliance] = useState(1)
  const [resistanceScale, setResistance] = useState(1)
  const input = {
    ...IDEAL_REFERENCE,
    compliance: IDEAL_REFERENCE.compliance * complianceScale,
    resistance: IDEAL_REFERENCE.resistance * resistanceScale,
  }
  const comparison = idealBreaths(input)
  const axes = useMemo(() => idealComparisonAxes(IDEAL_REFERENCE), [])
  const units = { pressure: 'cmH₂O', flow: 'L/min', volume: 'mL' }
  return (
    <section className={styles.idealReference} data-idealized-comparison>
      <h3>Idealized passive comparison</h3>
      <p>Reference illustration only; no live-patient change or learning credit.</p>
      <p data-fixed-inputs>
        <strong>Fixed inputs:</strong> VC 400 mL at 24 L/min. PC{' '}
        {IDEAL_REFERENCE.pressure.toFixed(2)} cmH₂O above PEEP. Both: PEEP 5 cmH₂O, inspiration 1.00
        s, expiration 3.00 s, total 4.00 s.
      </p>
      <figure className={styles.capturedBreath} ref={figure}>
        <figcaption>
          <strong>VC: solid cyan · PC: dashed amber</strong>
        </figcaption>
        <svg
          viewBox={`0 0 ${width} 318`}
          role="img"
          aria-label={`Idealized VC and PC on common axes. VC end-inspiratory volume ${comparison.volumeTargeted.deliveredVolume.toFixed(1)} mL; PC ${comparison.pressureTargeted.deliveredVolume.toFixed(1)} mL. Same 4.00 s clock.`}
        >
          {(['pressure', 'flow', 'volume'] as const).map((variable, i) => (
            <g key={variable} transform={`translate(0 ${i * 100})`}>
              <text x="0" y="12">
                {variable} ({units[variable]})
              </text>
              <text x="0" y="35">
                {axes[variable][1]}
              </text>
              <text x="0" y="92">
                {axes[variable][0]}
              </text>
              <g transform="translate(55 24)">
                <line
                  x1="0"
                  x2={plotWidth}
                  y1={variable === 'flow' ? 35 : 70}
                  y2={variable === 'flow' ? 35 : 70}
                  className={styles.zeroLine}
                />
                <line
                  x1={plotWidth / 4}
                  x2={plotWidth / 4}
                  y1="0"
                  y2="70"
                  className={styles.zeroLine}
                />
                {(['volumeTargeted', 'pressureTargeted'] as const).map((key) => (
                  <path
                    key={key}
                    data-ideal-trace={variable}
                    data-ideal-mode={key}
                    d={idealSeriesPath(comparison[key], variable, axes)}
                    transform={`scale(${plotWidth / 260} 1)`}
                    vectorEffect="non-scaling-stroke"
                    className={key === 'volumeTargeted' ? styles.breathTrace : styles.pressureTrace}
                  />
                ))}
              </g>
            </g>
          ))}
          <text x="55" y="316">
            0
          </text>
          <text x={55 + plotWidth / 4} y="316" textAnchor="middle">
            1 s
          </text>
          <text x={width - 15} y="316" textAnchor="end">
            4 s
          </text>
        </svg>
      </figure>
      <div className={styles.idealReadouts}>
        {(['volumeTargeted', 'pressureTargeted'] as const).map((key) => (
          <p key={key} data-ideal-column={key} data-ideal-values>
            <strong>{key === 'volumeTargeted' ? 'Conventional VC' : 'Conventional PC'}</strong>
            <br />
            End-inspiratory volume <strong>{comparison[key].deliveredVolume.toFixed(1)} mL</strong>;
            peak pressure <strong>{Math.max(...comparison[key].pressure).toFixed(1)} cmH₂O</strong>.
          </p>
        ))}
      </div>
      <div className={styles.quickButtons}>
        <label>
          Illustration compliance
          <select
            aria-label="Illustration compliance"
            value={complianceScale}
            onChange={(e) => setCompliance(Number(e.target.value))}
          >
            <option value={0.5}>Half reference compliance</option>
            <option value={1}>Reference compliance</option>
            <option value={2}>Twice reference compliance</option>
          </select>
        </label>
        <label>
          Illustration resistance
          <select
            aria-label="Illustration resistance"
            value={resistanceScale}
            onChange={(e) => setResistance(Number(e.target.value))}
          >
            <option value={0.25}>Quarter reference resistance</option>
            <option value={1}>Reference resistance</option>
            <option value={4}>Four times reference resistance</option>
          </select>
        </label>
        <button
          type="button"
          className={styles.toolButton}
          onClick={() => {
            setCompliance(1)
            setResistance(1)
          }}
        >
          Restore illustration reference
        </button>
      </div>
      <p>
        Both columns: compliance {(input.compliance * 1000).toFixed(0)} mL/cmH₂O; resistance{' '}
        {input.resistance.toFixed(1)} cmH₂O/(L/s), including the tube. Reference targets stay fixed
        when live mode or mechanics change.
      </p>
      <p>
        Each variable uses one common scale across columns and all offered changes. The scales
        include the full exploration range; smaller volumes stay visibly smaller. The dashed
        vertical marker is end-inspiration at 1 s.
      </p>
      <p>
        PC volume is the volume reached within the selected inspiratory time, not its equilibrium
        limit. Expiration starts at that attained volume. Both modes expire passively here, but
        different end-inspiratory volumes produce different expiratory flows.
      </p>
      <details>
        <summary>Model assumptions and clinical limits</summary>
        <p>
          These closed-form single-compartment breaths omit effort, leaks, pressure limits, circuit
          compliance and adaptive targeting. They are mathematical teaching examples, not two runs
          of the simulated patient. Passive expiration also depends on time available, PEEP and
          prior delivery; an identical expiratory limb is not guaranteed.
        </p>
      </details>
    </section>
  )
}
