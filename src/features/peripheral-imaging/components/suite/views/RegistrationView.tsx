'use client'
import { useEffect, useMemo, type RefObject } from 'react'
import { Html, Line, useGLTF } from '@react-three/drei'
import { Mesh, Vector3 } from 'three'
import { ANATOMY_MODEL } from '../../../lib/anatomy'
import { LESION_CENTER, LESION_RADIUS, projectToDetector, type Point3 } from '../../../lib/physics'
import { Anatomy } from '../Anatomy'
import { ProjectionOverlays } from '../ProjectionOverlays'
import { registration } from '../registrationModel'
import { add, detectorPoint, projectionMarkers, scale, suiteFrame } from '../suiteModel'
import type { SuiteInputs } from '../types'
import styles from '../suite-scene.module.css'

const REGISTERED_MAP = ['Airways'] as const
export function RegistrationView({
  inputs,
  augmented,
  portal,
  labels,
  onSensor,
}: {
  inputs: SuiteInputs
  augmented: boolean
  portal: RefObject<HTMLDivElement>
  labels: boolean
  onSensor: (point: Point3) => void
}) {
  const model = registration(inputs)
  const { scene } = useGLTF(ANATOMY_MODEL, '/fluoroview/draco/')
  // Select a real vertex of the existing registered airway surface; this is a schematic marker,
  // not a new route or a claimed tracking measurement. The map and sensor stay in their original frame.
  const sensor = useMemo(() => {
    let nearest: Point3 = LESION_CENTER
    let best = Infinity
    const point = new Vector3()
    const target = new Vector3(...LESION_CENTER)
    scene.updateMatrixWorld(true)
    scene.traverse((object) => {
      if (!(object instanceof Mesh) || object.name.replaceAll('_', ' ') !== 'Airways') return
      const positions = object.geometry.getAttribute('position')
      for (let i = 0; i < positions.count; i++) {
        point
          .fromBufferAttribute(positions, i)
          .applyMatrix4(object.matrixWorld)
          .multiplyScalar(1000)
        const distance = point.distanceToSquared(target)
        if (distance < best) {
          best = distance
          nearest = point.toArray() as Point3
        }
      }
    })
    return nearest
  }, [scene])
  useEffect(() => {
    if (!augmented) onSensor(sensor)
  }, [sensor, augmented, onSensor])
  const frame = suiteFrame(inputs.orbit, inputs.tilt, inputs.geometry)
  const marker = projectionMarkers(frame, inputs.toolDepth, model.storedOffset, false)
  const circle = Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2
    return add(
      detectorPoint(frame, [
        marker.targetRay.uv[0] + marker.radius * Math.cos(a),
        marker.targetRay.uv[1] + marker.radius * Math.sin(a),
      ]),
      scale(frame.normal, -1),
    )
  })
  return (
    <group>
      {!augmented && (
        <>
          <Anatomy layers={REGISTERED_MAP} map />
          <mesh position={sensor}>
            <sphereGeometry args={[3, 20, 16]} />
            <meshBasicMaterial color="#92e2d4" />
          </mesh>
          <Line points={[add(sensor, [-35, 0, 0]), sensor]} color="#e4eeee" lineWidth={2} />
          {inputs.showCurrent && (
            <mesh position={model.currentTarget}>
              <sphereGeometry args={[LESION_RADIUS, 32, 20]} />
              <meshStandardMaterial color="#e9bd7c" transparent opacity={0.65} />
            </mesh>
          )}
          {labels && (
            <>
              <Html portal={portal} position={add(sensor, [0, 35, 35])}>
                <span className={styles.objectLabel}>Sensor on registered map</span>
              </Html>
              {inputs.showCurrent && (
                <Html portal={portal} position={add(model.currentTarget, [25, -20, -15])}>
                  <span className={styles.objectLabel}>Current target</span>
                </Html>
              )}
            </>
          )}
        </>
      )}
      {inputs.showStored && (
        <>
          <mesh position={model.storedTarget}>
            <sphereGeometry args={[LESION_RADIUS, 24, 16]} />
            <meshBasicMaterial color="#83d9ca" wireframe />
          </mesh>
          {augmented && (
            <>
              <Line
                points={[frame.source, model.storedProjection.hit]}
                color="#83d9ca"
                transparent
                opacity={0.55}
              />
              <Line points={circle} color="#83d9ca" dashed dashSize={4} gapSize={3} />
            </>
          )}
        </>
      )}
    </group>
  )
}
export function RegistrationOverlay({
  inputs,
  sensor,
}: {
  inputs: SuiteInputs
  sensor?: Point3 | null
}) {
  const model = registration(inputs)
  const frame = suiteFrame(inputs.orbit, inputs.tilt, inputs.geometry)
  const markers = projectionMarkers(frame, inputs.toolDepth, model.storedOffset, false)
  const toScreen = ([u, v]: readonly number[]) => [
    256 + (u / inputs.geometry.field) * 512,
    256 - (v / inputs.geometry.field) * 512,
  ]
  const stored = toScreen(markers.targetRay.uv)
  const tip = sensor
    ? toScreen(projectToDetector(sensor, inputs.orbit, inputs.tilt, inputs.geometry))
    : null
  const start = sensor
    ? toScreen(
        projectToDetector(add(sensor, [-35, 0, 0]), inputs.orbit, inputs.tilt, inputs.geometry),
      )
    : null
  return (
    <>
      <ProjectionOverlays
        orbit={inputs.orbit}
        tilt={inputs.tilt}
        depth={inputs.toolDepth}
        geometry={inputs.geometry}
        offset={model.currentOffset}
        toolFollows={false}
        showCurrent={inputs.showCurrent}
        showTool={!sensor}
      />
      <svg
        viewBox="0 0 512 512"
        aria-hidden="true"
        data-registration-current={inputs.displacement}
        data-registration-stored={inputs.storedDisplacement}
      >
        {inputs.showStored && (
          <circle
            data-stored-overlay
            cx={stored[0]}
            cy={stored[1]}
            r={(markers.radius / inputs.geometry.field) * 512 + 5}
            fill="none"
            stroke="#84e2d2"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
        )}
        {tip && start && (
          <>
            <line
              x1={start[0]}
              y1={start[1]}
              x2={tip[0]}
              y2={tip[1]}
              stroke="#f5f7f1"
              strokeWidth="2.5"
            />
            <circle data-sensor-overlay cx={tip[0]} cy={tip[1]} r={3} fill="#91e1d3" />
          </>
        )}
      </svg>
    </>
  )
}
export function RegistrationPanels({ augmented }: { augmented: boolean }) {
  return (
    <section className={styles.signalProfile}>
      <p>
        Amber: current target · teal: stored target contour. The anatomical displacement moves the
        current CT and target together. Capturing a new teaching contour updates the stored target
        position.
      </p>
      {!augmented && (
        <p>
          Gray: original registered airway map. The schematic catheter sensor remains on that map as
          the coloured current anatomy moves; the field-generator board is drawn below the table.
        </p>
      )}
    </section>
  )
}
