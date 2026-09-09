'use client'
import { Html, Line } from '@react-three/drei'
import type { RefObject } from 'react'
import { LESION_CENTER, LESION_RADIUS } from '../../../lib/physics'
import { add, rayThrough, scale, type temporal, type SuiteFrame } from '../suiteModel'
import styles from '../suite-scene.module.css'

type TemporalModel = ReturnType<typeof temporal>
export function TimeView({
  frame,
  model,
  portal,
  labels,
}: {
  frame: SuiteFrame
  model: TemporalModel
  portal: RefObject<HTMLDivElement>
  labels: boolean
}) {
  const detectorTip = rayThrough(frame, model.sampledTip).hit
  const detectorStart = rayThrough(frame, add(model.sampledTip, [-65, 0, 0])).hit
  return (
    <group>
      <mesh position={LESION_CENTER}>
        <sphereGeometry args={[LESION_RADIUS, 24, 16]} />
        <meshStandardMaterial color="#e2b46f" transparent opacity={0.8} />
      </mesh>
      <Line
        points={[add(model.currentTip, [-65, 0, 0]), model.currentTip]}
        color="#ffffff"
        lineWidth={3}
      />
      {model.sampleIndex >= 0 && (
        <Line
          points={[
            add(detectorStart, scale(frame.normal, -1)),
            add(detectorTip, scale(frame.normal, -1)),
          ]}
          color="#ffffff"
          lineWidth={3}
        />
      )}
      {labels && (
        <>
          <Html portal={portal} position={add(LESION_CENTER, [18, 0, 0])}>
            <span className={styles.objectLabel}>Authored target</span>
          </Html>
          <Html portal={portal} position={add(model.currentTip, [0, 18, 0])}>
            <span className={styles.objectLabel}>Moving tool</span>
          </Html>
        </>
      )}
    </group>
  )
}

export function TimeOverlay({ frame, model }: { frame: SuiteFrame; model: TemporalModel }) {
  const screen = (point: typeof LESION_CENTER) => {
    const [u, v] = rayThrough(frame, point).uv
    return [256 + (u / frame.geometry.field) * 512, 256 - (v / frame.geometry.field) * 512]
  }
  if (model.sampleIndex < 0)
    return <svg viewBox="0 0 512 512" aria-hidden="true" data-temporal-frame="-1" />
  const tip = screen(model.sampledTip),
    start = screen(add(model.sampledTip, [-65, 0, 0]))
  const blur = model.blurSegment.map(screen)
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" data-temporal-frame={model.sampleIndex}>
      <line
        x1={start[0]}
        y1={start[1]}
        x2={tip[0]}
        y2={tip[1]}
        stroke="#eef7f5"
        strokeWidth="2.5"
      />
      <line
        x1={blur[0][0]}
        y1={blur[0][1]}
        x2={blur[1][0]}
        y2={blur[1][1]}
        stroke="#edc280"
        strokeWidth="5"
      />
    </svg>
  )
}

export function TimeSamples({ model, phase }: { model: TemporalModel; phase: number }) {
  return (
    <section
      className={styles.signalProfile}
      data-temporal-phase={phase}
      data-pulse-on={model.pulseIsOn}
      aria-label="Temporal sampling"
    >
      <p>
        Slowed authored time · the DRR stays fixed. Pause holds the moving tool and the sampled
        image.
      </p>
      <svg
        viewBox="0 0 440 115"
        role="img"
        aria-label="Six successive tool-tip samples. Amber bars show motion during each pulse; the gaps show travel between frames."
        className={styles.sampleDiagram}
      >
        <text x="16" y="20" fill="#183542" fontSize="12">
          Six pulses · tool-tip positions (enlarged)
        </text>
        {Array.from({ length: 6 }, (_, i) => {
          const x = 20 + i * model.interFrameTravel * 7
          return (
            <g key={i} data-time-sample>
              <line x1={x} y1="40" x2={x} y2="90" stroke="#3b7c7b" strokeDasharray="2 3" />
              <rect
                x={x}
                y="52"
                width={Math.max(0.4, model.inFrameBlur * 7)}
                height="22"
                fill="#98652b"
              />
            </g>
          )
        })}
        <text x="16" y="110" fill="#183542" fontSize="12">
          Amber: within-frame blur · spacing: inter-frame travel
        </text>
      </svg>
    </section>
  )
}
