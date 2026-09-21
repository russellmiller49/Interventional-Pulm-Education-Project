'use client'
import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import { LESION_RADIUS, SHAFT_RADIUS, type Point3 } from '../../../lib/physics'
import { add, detectorPoint, projectionMarkers, scale, type SuiteFrame } from '../suiteModel'
import type { SceneLabel } from '../SceneLabels'
import type { SuiteInputs } from '../types'
import styles from '../suite-scene.module.css'

/**
 * The two object labels of a projection scene, anchored on the objects themselves.
 *
 * Report 2.4: they were offset in world space — the target's label along x, the tip's along y —
 * so from most angles, and always in the frontal view where the two objects are superimposed, one
 * label printed over the other and neither could be read. They now leave their anchors in opposite
 * directions on screen and go through the scene's one layout pass with every other label.
 */
export function projectionObjectLabels(
  frame: SuiteFrame,
  inputs: SuiteInputs,
  offset?: Point3,
): readonly SceneLabel[] {
  const markers = projectionMarkers(frame, inputs.toolDepth, offset, inputs.toolFollowsAnatomy)
  const tip: SceneLabel = {
    id: 'object-tool-tip',
    anchor: markers.tip,
    placement: 'above-left',
    gap: 8,
    estimate: [46, 18],
    node: (
      <span className={styles.objectLabel} data-object-label="tool-tip">
        Tool tip
      </span>
    ),
  }
  if (!inputs.showCurrent) return [tip]
  return [
    tip,
    {
      id: 'object-target',
      anchor: markers.target,
      placement: 'below-right',
      gap: 8,
      estimate: [86, 18],
      node: (
        <span className={styles.objectLabel} data-object-label="target">
          Authored target
        </span>
      ),
    },
  ]
}

export function ProjectionView3D({
  frame,
  inputs,
  ray,
  offset,
}: {
  frame: SuiteFrame
  inputs: SuiteInputs
  ray: boolean
  offset?: Point3
}) {
  const markers = useMemo(
    () => projectionMarkers(frame, inputs.toolDepth, offset, inputs.toolFollowsAnatomy),
    [frame, inputs.toolDepth, offset, inputs.toolFollowsAnatomy],
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
          {inputs.showCurrent && (
            <Line
              points={[frame.source, markers.targetRay.hit]}
              color="#eac07a"
              transparent
              opacity={0.78}
              lineWidth={1}
            />
          )}
          <Line
            points={[frame.source, markers.tipRay.hit]}
            color="#85d2d2"
            transparent
            opacity={0.7}
            lineWidth={1}
          />
        </>
      )}
      {inputs.showCurrent && <Line points={circle} color="#eec482" lineWidth={1} />}
      <Line
        points={[lift(markers.startRay.hit), lift(markers.tipRay.hit)]}
        color="#ffffff"
        lineWidth={2.5}
      />
    </group>
  )
}
