'use client'

import { useState } from 'react'
import { ControlHeadSchematic } from './ControlHeadSchematic'
import styles from './bronch-stage.module.css'

/** A labeled prerequisite reference, never an identification test or completion event. */
export function InstrumentOrientation() {
  const [detail, setDetail] = useState(false)
  return (
    <section
      className={styles.teachingCard}
      aria-label="Instrument orientation"
      data-instrument-orientation
    >
      <h2>Instrument orientation</h2>
      <div className={styles.pilotButtons} role="group" aria-label="Instrument views">
        <button type="button" aria-pressed={!detail} onClick={() => setDetail(false)}>
          Full instrument
        </button>
        <button type="button" aria-pressed={detail} onClick={() => setDetail(true)}>
          Steering and suction
        </button>
      </div>
      {detail ? (
        <>
          <ControlHeadSchematic />
          <p>
            The thumb moves the angulation lever on the back of the scope. On the front, the index
            finger presses the suction valve. Instruments enter through the separate working-channel
            port below it.
          </p>
        </>
      ) : (
        <>
          <svg
            viewBox="0 0 2100 1500"
            role="img"
            aria-labelledby="bronch-full-title bronch-full-desc"
            className={styles.instrumentFigure}
          >
            <title id="bronch-full-title">
              Flexible bronchoscope: handle, insertion tube and distal section
            </title>
            <desc id="bronch-full-desc">
              Existing instrument photograph. The handle is at lower left; the insertion tube curves
              from it to the narrow distal tip at upper right. The larger connector and cord connect
              to the imaging system.
            </desc>
            <image
              href="/intro-bronchoscopy/scope-anatomy/full-scope.png"
              width="2100"
              height="1500"
            />
            <g fill="none" stroke="#056978" strokeWidth="10">
              <path d="M450 1070 H795" />
              <path d="M1610 1110 H1460" />
              <path d="M1600 250 H1275" />
            </g>
            <g fill="#064b59" fontSize="58" fontFamily="sans-serif" fontWeight="600">
              <text x="35" y="1025">
                Control section
              </text>
              <text x="35" y="1090">
                (handle)
              </text>
              <text x="1490" y="1190">
                Insertion tube
              </text>
              <text x="1470" y="135">
                Distal bending
              </text>
              <text x="1470" y="200">
                section and tip
              </text>
            </g>
          </svg>
          <p>
            The handle controls the instrument. The insertion tube runs to the distal bending
            section and tip. Select <strong>Steering and suction</strong> to locate the two hand
            controls.
          </p>
        </>
      )}
    </section>
  )
}
