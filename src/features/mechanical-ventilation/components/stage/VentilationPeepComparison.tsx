'use client'

import { useMemo, useState } from 'react'
import { peepComparisonTeaching } from '../../content/peepComparison'
import {
  createPeepComparisonBaseline,
  peepComparisonIntervals,
  peepComparisonSettings,
  peepComparisonSnapshot,
  runPeepComparison,
  type ComparisonInterval,
  type ComparisonPeep,
  type PeepComparison,
} from '../../engine/peepComparison'
import { waveformAxes } from '../../engine/teachingBreath'
import { CapturedBreath } from './CapturedBreath'
import styles from './task-flow.module.css'

type Snapshot = ReturnType<typeof peepComparisonSnapshot>
function readingValue(record: Snapshot, key: keyof Snapshot, digits: number) {
  return typeof record[key] === 'number' ? (record[key] as number).toFixed(digits) : 'Unavailable'
}
const readings: readonly { key: keyof Snapshot; label: string; digits: number }[] = [
  { key: 'spo2', label: 'SpO₂ (%)', digits: 1 },
  { key: 'map', label: 'MAP (mm Hg)', digits: 1 },
  { key: 'peak', label: 'Peak airway pressure (cm H₂O)', digits: 1 },
  { key: 'plateau', label: 'Plateau estimate (cm H₂O) · effort present', digits: 1 },
  { key: 'modelCompliance', label: 'Model-assigned compliance (mL/cm H₂O)', digits: 0 },
  { key: 'deliveredVt', label: 'Delivered VT from waveform (mL)', digits: 1 },
  { key: 'intrinsicPeep', label: 'Intrinsic PEEP estimate (cm H₂O)', digits: 1 },
]

/** Separate engine replays. This component cannot dispatch to or capture the learner's patient. */
export function VentilationPeepComparison({ explanationOpen }: { explanationOpen: boolean }) {
  const baseline = useMemo(() => createPeepComparisonBaseline(), [])
  const [peep, setPeep] = useState<ComparisonPeep>(10)
  const [seconds, setSeconds] = useState<ComparisonInterval>(45)
  const [result, setResult] = useState<PeepComparison | null>(null)
  const [revealed, setRevealed] = useState(false)
  const records = [baseline, ...(result ? [result.unchanged, result.changed] : [])].map(
    peepComparisonSnapshot,
  )
  const settings = baseline.ventilator.settings
  const axes = result
    ? waveformAxes([...result.unchanged.waveforms, ...result.changed.waveforms])
    : undefined
  function reset() {
    setResult(null)
    setPeep(10)
    setSeconds(45)
    setRevealed(false)
  }
  return (
    <section className={styles.block} aria-labelledby="mv-peep-comparison" data-peep-comparison>
      <p className={styles.note}>Worked simulation · separate from your patient</p>
      <h2 id="mv-peep-comparison">One PEEP change, the same elapsed time</h2>
      <p>{peepComparisonTeaching.purpose} Run first, read the explanation, or continue.</p>
      <p>
        MV-01 · standard branch · Hamilton C6 · VC-A/C · starting at{' '}
        {baseline.simulationTime.toFixed(0)} s. VT{' '}
        {settings.mode === 'volume-ac' ? settings.vtMl : '—'} mL, rate{' '}
        {settings.mode !== 'pressure-support' ? settings.ratePerMin : '—'}/min, flow{' '}
        {settings.mode === 'volume-ac' ? settings.peakFlowLMin : '—'} L/min, FiO₂{' '}
        {settings.oxygenPercent}%, and patient effort are held constant. Only PEEP differs between
        arms.
      </p>
      <div className={styles.tools}>
        <label>
          Example PEEP (cm H₂O){' '}
          <select
            value={peep}
            onChange={(event) => {
              setPeep(Number(event.target.value) as ComparisonPeep)
              setResult(null)
            }}
          >
            {peepComparisonSettings.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Matched interval (seconds){' '}
          <select
            value={seconds}
            onChange={(event) => {
              setSeconds(Number(event.target.value) as ComparisonInterval)
              setResult(null)
            }}
          >
            {peepComparisonIntervals.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setResult(runPeepComparison(peep, seconds))}>
          {result ? 'Replay comparison' : 'Run comparison'}
        </button>
        <button type="button" onClick={() => setRevealed(true)}>
          Explain this comparison
        </button>
        <button type="button" onClick={reset}>
          Reset comparison
        </button>
      </div>
      <p role="status">
        {result
          ? `Example results: both arms ran ${result.seconds} seconds, from 30 to ${30 + result.seconds} s. Every replay starts from the same baseline.`
          : 'Baseline example only. No comparison has run; your separate patient is unchanged.'}
      </p>
      <div
        className={styles.peepTable}
        role="region"
        aria-label="Matched PEEP readings"
        tabIndex={0}
      >
        <table>
          <caption>Engine-generated example values · no hold acquired</caption>
          <thead>
            <tr>
              <th scope="col">Reading</th>
              <th scope="col">
                Baseline
                <br />
                PEEP 5 · 30 s
              </th>
              {result ? (
                <>
                  <th scope="col">
                    Wait only
                    <br />
                    PEEP 5 · {30 + result.seconds} s
                  </th>
                  <th scope="col">
                    PEEP changed
                    <br />
                    PEEP {result.peep} · {30 + result.seconds} s
                  </th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {readings.map(({ key, label, digits }) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                {records.map((record, index) => (
                  <td key={index}>{readingValue(record, key, digits)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.peepCompactReadings} data-peep-readings-compact>
        <p>Engine-generated example values · no hold acquired</p>
        <p>
          Baseline: PEEP 5 at 30 s.
          {result
            ? ` Results: wait at PEEP 5 / change to PEEP ${result.peep}, both at ${30 + result.seconds} s.`
            : ''}
        </p>
        <dl>
          {readings.map(({ key, label, digits }) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd className={styles.peepValues}>
                {records.map((record, index) => (
                  <div key={index}>
                    <span>{['Baseline', 'Wait', 'Changed'][index]}</span>
                    <strong>{readingValue(record, key, digits)}</strong>
                  </div>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <p className={styles.note}>
        Plateau estimates are unsuitable for passive mechanics interpretation: recent effort reaches{' '}
        {records[0].recentEffort.toFixed(1)} cm H₂O. Model-assigned compliance is not measured
        static compliance.
      </p>
      {explanationOpen || revealed ? (
        <div data-peep-explanation>
          <h3>How to read the comparison</h3>
          {peepComparisonTeaching.explanation.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      ) : null}
      {result ? (
        <details>
          <summary>Compare the example waveforms and timing</summary>
          <p>
            Both traces use the same axes and include the model’s patient-effort signal. Total rate:{' '}
            {records[1].totalRate} / {records[2].totalRate} per minute; machine Ti:{' '}
            {records[1].machineTi.toFixed(2)} / {records[2].machineTi.toFixed(2)} s; observed Te:{' '}
            {records[1].observedTe?.toFixed(2) ?? 'unavailable'} /{' '}
            {records[2].observedTe?.toFixed(2) ?? 'unavailable'} s (wait / changed PEEP).
          </p>
          <div className={styles.comparison}>
            <CapturedBreath
              label="Example: PEEP unchanged"
              samples={result.unchanged.waveforms}
              axes={axes}
              effort
            />
            <CapturedBreath
              label="Example: PEEP changed"
              samples={result.changed.waveforms}
              axes={axes}
              effort
            />
          </div>
        </details>
      ) : null}
      <p className={styles.note}>{peepComparisonTeaching.boundary}</p>
    </section>
  )
}
