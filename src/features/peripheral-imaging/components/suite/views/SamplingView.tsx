'use client'
import { Html, Line } from '@react-three/drei'
import type { RefObject } from 'react'
import { LESION_CENTER, LESION_RADIUS, SHAFT_RADIUS, WINDOW_RADIUS } from '../../../lib/physics'
import { add } from '../suiteModel'
import { samplingPlanes } from '../samplingModel'
import { CtQuad } from '../CtSliceImages'
import { MPR } from '../../Diagrams'
import type { SuiteInputs } from '../types'
import styles from '../suite-scene.module.css'

export function SamplingView({
  inputs,
  volume,
  portal,
  labels,
  planes,
}: {
  inputs: SuiteInputs
  volume: Uint8Array | null
  portal: RefObject<HTMLDivElement>
  labels: boolean
  planes: boolean
}) {
  const model = samplingPlanes(inputs)
  return (
    <group>
      <mesh position={LESION_CENTER}>
        <sphereGeometry args={[LESION_RADIUS, 36, 24]} />
        <meshStandardMaterial color="#e9bd78" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh position={add(model.tip, [-22.5, 0, 0])} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[SHAFT_RADIUS, SHAFT_RADIUS, 45, 20]} />
        <meshStandardMaterial color="#eff8f8" />
      </mesh>
      <mesh position={add(model.tip, [-10, 0, 0])} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[WINDOW_RADIUS, WINDOW_RADIUS, 8, 20]} />
        <meshStandardMaterial color="#54d6bd" />
      </mesh>
      {planes &&
        volume &&
        model.planes.map((plane) => (
          <group key={plane.plane}>
            <CtQuad
              key={plane.plane}
              volume={volume}
              plane={plane.plane}
              depth={plane.position}
              points={plane.points}
              opacity={0.18}
              slab={inputs.slab}
            />
            <Line
              points={[...plane.points, plane.points[0]]}
              color={['#ebbb7c', '#81cfc0', '#9eb4e2'][model.planes.indexOf(plane)]}
              lineWidth={1}
            />
          </group>
        ))}
      {labels && (
        <>
          <Html portal={portal} position={add(LESION_CENTER, [27, 0, 24])}>
            <span className={styles.objectLabel}>Authored target</span>
          </Html>
          <Html portal={portal} position={add(model.tip, [-10, 18, -18])}>
            <span className={styles.objectLabel}>Sampling window</span>
          </Html>
        </>
      )}
    </group>
  )
}
export function SamplingPanels({ inputs, revealed }: { inputs: SuiteInputs; revealed: boolean }) {
  const model = samplingPlanes(inputs)
  return (
    <section
      className={styles.signalProfile}
      data-sampling-state={revealed ? 'revealed' : 'exploring'}
    >
      <p>
        Linked CT context and analytic sections · green: sampling window · white: shaft and tip.
      </p>
      <p>
        {inputs.slab
          ? 'The slab projects depths −60 to 42 mm into one image. Plane sliders apply to thin planes.'
          : 'Each coloured outline is one thin plane; its linked image is below.'}
      </p>
      <div className={styles.mprGrid}>
        {model.planes.map((plane) => (
          <MPR
            key={plane.plane}
            plane={plane.plane}
            position={plane.position}
            tip={model.localTip}
            slab={inputs.slab}
          />
        ))}
      </div>
      {revealed && (
        <p>
          {model.relationship.label}. Inspect the window across thin planes; the end of the tip is a
          different part of the tool.
        </p>
      )}
    </section>
  )
}
