'use client'
import { Html, Line } from '@react-three/drei'
import { useMemo, type RefObject } from 'react'
import { LESION_RADIUS, SHAFT_RADIUS, type Point3 } from '../../../lib/physics'
import { add, detectorPoint, projectionMarkers, scale, type SuiteFrame } from '../suiteModel'
import type { SuiteInputs } from '../types'
import styles from '../suite-scene.module.css'

export function ProjectionView3D({
  frame,
  inputs,
  ray,
  labels,
  portal,
}: {
  frame: SuiteFrame
  inputs: SuiteInputs
  ray: boolean
  labels: boolean
  portal: RefObject<HTMLDivElement>
}) {
  const markers = useMemo(
    () => projectionMarkers(frame, inputs.toolDepth),
    [frame, inputs.toolDepth],
  )
  const circle = useMemo(
    () =>
      Array.from({ length: 65 }, (_, i) => {
        const angle = (i / 64) * Math.PI * 2
        return add(
          detectorPoint(frame, [
            markers.targetRay.uv[0] + markers.radius * Math.cos(angle),
            markers.targetRay.uv[1] + markers.radius * Math.sin(angle),
          ]),
          scale(frame.normal, -0.6),
        )
      }),
    [frame, markers],
  )
  const lift = (p: Point3) => add(p, scale(frame.normal, -0.7))
  return (
    <group>
      {inputs.showCurrent && (
        <mesh position={markers.target}>
          <sphereGeometry args={[LESION_RADIUS, 32, 20]} />
          <meshStandardMaterial color="#e2b46f" transparent opacity={0.9} />
        </mesh>
      )}
      <Line points={[markers.start, markers.tip]} color="#e6eff3" lineWidth={3} />
      <mesh position={markers.tip}>
        <sphereGeometry args={[SHAFT_RADIUS * 3, 12, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {ray && (
        <>
          <Line
            points={[frame.source, markers.targetRay.hit]}
            color="#eac07a"
            transparent
            opacity={0.78}
            lineWidth={1}
          />
          <Line
            points={[frame.source, markers.tipRay.hit]}
            color="#85d2d2"
            transparent
            opacity={0.7}
            lineWidth={1}
          />
        </>
      )}
      <Line points={circle} color="#eec482" lineWidth={1} />
      <Line
        points={[lift(markers.startRay.hit), lift(markers.tipRay.hit)]}
        color="#ffffff"
        lineWidth={2.5}
      />
      {labels && (
        <>
          <Html
            portal={portal}
            position={add(markers.target, [LESION_RADIUS * 2, 0, 0])}
            zIndexRange={[5, 1]}
          >
            <span className={styles.objectLabel}>Authored target</span>
          </Html>
          <Html
            portal={portal}
            position={add(markers.tip, [0, LESION_RADIUS * 2, 0])}
            zIndexRange={[5, 1]}
          >
            <span className={styles.objectLabel}>Tool tip</span>
          </Html>
        </>
      )}
    </group>
  )
}
