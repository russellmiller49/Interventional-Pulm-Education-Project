import { useId } from 'react'

import type { PatientState } from '../../engine/types'
import styles from '../cardiohelp-ecmo.module.css'
import {
  ARTERIAL_TRACE_GRID,
  ARTERIAL_TRACE_SECONDS,
  ARTERIAL_TRACE_VIEW,
  LOW_PULSATILITY_BELOW_MMHG,
  arterialTraceDescription,
  arterialTracePath,
  arterialTraceY,
} from './arterialTrace'

/**
 * The arterial line on the bedside monitor.
 *
 * Loss of pulsatility on VA support was taught in words beside a number ("Pulse pressure 5 mmHg").
 * This draws it: a strip whose mean is the monitor's mean arterial pressure and whose height is the
 * monitor's pulse pressure, at the monitor's heart rate, on a fixed pressure axis, so a ventricle
 * that stops ejecting flattens the trace and one that recovers opens it again. Every number comes
 * from the patient model (`arterialTrace.ts`); the notch is drawn only while the model reports the
 * aortic valve opening.
 */
export function ArterialPressureTrace({
  patient,
  compact = false,
}: {
  readonly patient: Pick<
    PatientState,
    'meanArterialPressure' | 'pulsePressure' | 'heartRate' | 'aorticValveOpening'
  >
  /** A shorter strip, for a teaching panel beside the text. */
  readonly compact?: boolean
}) {
  const titleId = useId()
  const { width, height } = ARTERIAL_TRACE_VIEW
  const meanY = arterialTraceY(patient.meanArterialPressure)
  const low = patient.pulsePressure < LOW_PULSATILITY_BELOW_MMHG
  return (
    <figure
      className={styles.arterialTrace}
      data-arterial-trace
      data-compact={compact || undefined}
      data-low-pulsatility={low || undefined}
      data-notch={patient.aorticValveOpening || undefined}
    >
      <figcaption>
        <span>Arterial line</span>
        <strong>
          MAP {patient.meanArterialPressure} mmHg · pulse pressure {patient.pulsePressure} mmHg
        </strong>
      </figcaption>
      {/*
        The drawing stretches to the strip's width, so its numbers are set in HTML over it: text
        inside a stretched drawing would stretch with it.
      */}
      <div className={styles.arterialTracePlot}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-labelledby={titleId}
        >
          <title id={titleId}>{arterialTraceDescription(patient)}</title>
          {ARTERIAL_TRACE_GRID.map((pressure) => (
            <line
              key={pressure}
              x1={0}
              x2={width}
              y1={arterialTraceY(pressure)}
              y2={arterialTraceY(pressure)}
              className={styles.arterialTraceGrid}
              data-trace-grid={pressure}
            />
          ))}
          <line
            x1={0}
            x2={width}
            y1={meanY}
            y2={meanY}
            className={styles.arterialTraceMean}
            data-trace-mean
          />
          <path
            d={arterialTracePath(patient)}
            className={styles.arterialTraceLine}
            data-trace-line
          />
        </svg>
        {ARTERIAL_TRACE_GRID.map((pressure) => (
          <span
            key={pressure}
            className={styles.arterialTraceScale}
            style={{ top: `${(arterialTraceY(pressure) / height) * 100}%` }}
            aria-hidden="true"
          >
            {pressure}
          </span>
        ))}
        <span className={styles.arterialTraceUnits} aria-hidden="true">
          mmHg · {ARTERIAL_TRACE_SECONDS} s
        </span>
      </div>
    </figure>
  )
}
