'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  idealBreaths,
  idealComparisonAxes,
  idealPairAxes,
  idealSeriesPath,
  type IdealAxes,
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
  const [scale, setScale] = useState<'pair' | 'all-settings'>('pair')
  const allSettings = useMemo(() => idealComparisonAxes(IDEAL_REFERENCE), [])
  const axes: IdealAxes = scale === 'pair' ? idealPairAxes(comparison) : allSettings
  const units = { pressure: 'cmH₂O', flow: 'L/min', volume: 'mL' }
  const rowNames = { pressure: 'Pressure', flow: 'Flow', volume: 'Volume' }
  const ROW = 112
  const PLOT = 70
  const yOf = (variable: keyof IdealAxes, value: number) =>
    PLOT - ((value - axes[variable][0]) / (axes[variable][1] - axes[variable][0])) * PLOT
  return (
    <section className={styles.idealReference} data-idealized-comparison>
      <h3>Idealized passive comparison</h3>
      <p>A reference illustration. It does not change the live patient.</p>
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
          viewBox={`0 0 ${width} ${3 * ROW + 20}`}
          role="img"
          aria-label={`Idealized VC and PC on the same axes for both modes. Pressure 0 to ${axes.pressure[1]} cmH₂O; flow ${axes.flow[0]} to ${axes.flow[1]} L/min; volume 0 to ${axes.volume[1]} mL. VC peak flow ${Math.max(...comparison.volumeTargeted.flow).toFixed(0)} L/min, square; PC peak flow ${Math.max(...comparison.pressureTargeted.flow).toFixed(0)} L/min, decelerating. VC end-inspiratory volume ${comparison.volumeTargeted.deliveredVolume.toFixed(1)} mL; PC ${comparison.pressureTargeted.deliveredVolume.toFixed(1)} mL. Same 4.00 s clock.`}
          data-ideal-scale={scale}
        >
          {(['pressure', 'flow', 'volume'] as const).map((variable, i) => (
            <g key={variable} transform={`translate(0 ${i * ROW})`} data-ideal-row={variable}>
              <text x="0" y="12" fontWeight="700">
                {rowNames[variable]} ({units[variable]})
              </text>
              <g transform="translate(55 26)">
                <text x="-6" y="4" textAnchor="end" data-ideal-axis-max={variable}>
                  {axes[variable][1]}
                </text>
                <text x="-6" y={PLOT + 4} textAnchor="end" data-ideal-axis-min={variable}>
                  {axes[variable][0]}
                </text>
                {axes[variable][0] < 0 ? (
                  <text x="-6" y={yOf(variable, 0) + 4} textAnchor="end">
                    0
                  </text>
                ) : null}
                <line
                  x1="0"
                  x2={plotWidth}
                  y1={yOf(variable, 0)}
                  y2={yOf(variable, 0)}
                  className={styles.zeroLine}
                />
                <line
                  x1={plotWidth / 4}
                  x2={plotWidth / 4}
                  y1="0"
                  y2={PLOT}
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
          <text x="55" y={3 * ROW + 16}>
            0
          </text>
          <text x={55 + plotWidth / 4} y={3 * ROW + 16} textAnchor="middle">
            1 s
          </text>
          <text x={width - 15} y={3 * ROW + 16} textAnchor="end">
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
      <div className={styles.quickButtons} role="group" aria-label="Scale" data-ideal-scale-choice>
        <span>Scale</span>
        <button
          type="button"
          className={styles.toolButton}
          aria-pressed={scale === 'pair'}
          onClick={() => setScale('pair')}
        >
          Fitted to this pair
        </button>
        <button
          type="button"
          className={styles.toolButton}
          aria-pressed={scale === 'all-settings'}
          onClick={() => setScale('all-settings')}
        >
          Fixed across every offered setting
        </button>
      </div>
      <p data-ideal-scale-note>
        {scale === 'pair'
          ? `VC and PC share every scale, so their sizes compare directly: flow ${axes.flow[0]} to ${axes.flow[1]} L/min, pressure to ${axes.pressure[1]} cmH₂O, volume to ${axes.volume[1]} mL. The scale is fitted again when you change the illustration mechanics; choose the fixed scale to compare sizes across those changes.`
          : `One scale for both modes and every offered change: flow ${axes.flow[0]} to ${axes.flow[1]} L/min, set by the fastest offered case. Smaller volumes stay visibly smaller, but at the reference mechanics the flow shapes are compressed.`}{' '}
        The dashed vertical marker is end-inspiration at 1 s.
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
