'use client'

import { useState } from 'react'
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
          <svg
            viewBox="0 0 800 530"
            role="img"
            aria-labelledby="bronch-controls-title bronch-controls-desc"
            className={styles.instrumentFigure}
          >
            <title id="bronch-controls-title">
              Angulation lever, suction control and working-channel port
            </title>
            <desc id="bronch-controls-desc">
              Close-up of the course bronchoscope photograph. The thumb operates the angulation
              lever at the top of the control section. The index finger operates the suction valve.
              The working-channel port sits below them on the handle.
            </desc>
            <rect width="800" height="530" fill="#fff" />
            <svg x="215" y="32" width="555" height="450" viewBox="580 780 600 505">
              <image
                href="/intro-bronchoscopy/scope-anatomy/full-scope.png"
                width="2100"
                height="1500"
              />
            </svg>
            <g fill="none" stroke="#217888" strokeWidth="2">
              <path d="M34 152 H268 L315 107" />
              <path d="M34 244 H280 L324 163" />
              <path d="M34 358 H396 L535 342" />
            </g>
            <g fill="#217888">
              <circle cx="315" cy="107" r="5" />
              <circle cx="324" cy="163" r="5" />
              <circle cx="535" cy="342" r="5" />
            </g>
            <g fill="#193e49" fontSize="21" fontFamily="sans-serif" fontWeight="600">
              <text x="34" y="118">
                Angulation lever
              </text>
              <text x="34" y="210">
                Suction valve
              </text>
              <text x="34" y="324">
                Working-channel port
              </text>
            </g>
            <g fill="#526871" fontSize="17" fontFamily="sans-serif">
              <text x="34" y="141">
                Thumb controls tip bend
              </text>
              <text x="34" y="233">
                Index finger applies suction
              </text>
              <text x="34" y="347">
                Entry for instruments
              </text>
            </g>
          </svg>
          <p>
            Use the thumb to move the angulation lever and the index finger to press the suction
            valve. Instruments enter through the separate working-channel port below the controls.
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
