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
            viewBox="0 0 520 340"
            role="img"
            aria-labelledby="bronch-controls-title bronch-controls-desc"
            className={styles.instrumentFigure}
          >
            <title id="bronch-controls-title">
              Angulation lever, suction control and distal bending section
            </title>
            <desc id="bronch-controls-desc">
              Authored component diagram. The angulation lever on the handle bends the distal
              section. The separate suction control operates suction through the working channel.
            </desc>
            <rect
              x="215"
              y="65"
              width="65"
              height="140"
              rx="24"
              fill="#283d4a"
              stroke="#bad8df"
              strokeWidth="3"
            />
            <path d="M232 76 L204 47 L210 39 L251 67" fill="#82cbd0" />
            <rect x="266" y="73" width="32" height="15" rx="6" fill="#b1d2da" />
            <path
              d="M248 205 C245 262 350 305 412 244 Q430 222 418 199"
              fill="none"
              stroke="#46616b"
              strokeWidth="12"
            />
            <path
              d="M412 244 Q430 222 418 199"
              fill="none"
              stroke="#55c5c6"
              strokeWidth="12"
              strokeDasharray="4 2"
            />
            <g stroke="#275b66" strokeWidth="2" fill="none">
              <path d="M190 43 H204" />
              <path d="M302 79 H337" />
              <path d="M310 275 L280 289 H198" />
            </g>
            <g fill="#123641" fontSize="16" fontFamily="sans-serif">
              <text x="15" y="40">
                Angulation lever
              </text>
              <text x="15" y="61">
                Thumb bends the tip
              </text>
              <text x="338" y="62">
                Suction control
              </text>
              <text x="338" y="84">
                Index finger
              </text>
              <text x="290" y="163">
                Control section / handle
              </text>
              <text x="20" y="285">
                Insertion tube
              </text>
              <text x="328" y="322">
                Distal bending section
              </text>
            </g>
            <path d="M402 304 L416 247" stroke="#275b66" strokeWidth="2" />
          </svg>
          <p>
            Authored component diagram, not an instruction sheet for a particular device. Lever
            layout, bending limits and suction controls vary by model.
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
      <p className={styles.figureCaption}>
        Existing teaching photograph and authored diagram · clinical/media review pending. Source:
        S1, PDF 89–97; hand-position qualifications: S3, PDF 80.
      </p>
    </section>
  )
}
