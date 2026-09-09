'use client'
import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { staff } from '../staffModel'
import { Quad } from '../SceneGeometry'
import { add } from '../suiteModel'
import type { SuiteInputs, SuiteLayer } from '../types'
import styles from '../suite-scene.module.css'

export function StaffView({
  inputs,
  layers,
}: {
  inputs: SuiteInputs
  layers: readonly SuiteLayer[]
}) {
  const model = useMemo(() => staff(inputs), [inputs])
  return (
    <group>
      {layers.includes('isodose') &&
        model.rings.map((ring, i) => (
          <group key={ring.radiusM}>
            {[false, true].map((shadow) => {
              const points = ring.segments
                .filter((segment) => segment.shadow === shadow)
                .flatMap((segment) => segment.points)
              return points.length ? (
                <Line
                  key={String(shadow)}
                  points={points}
                  segments
                  color={shadow ? '#8795a0' : ['#e2b374', '#c4b28a', '#9eada4', '#81a8ad'][i]}
                  lineWidth={1.4}
                  dashed={shadow}
                  dashSize={55}
                  gapSize={35}
                />
              ) : null
            })}
          </group>
        ))}
      {layers.includes('isodose') && inputs.barrier && (
        <Quad points={model.shadow} color="#68767e" opacity={0.16} />
      )}
      {layers.includes('barrier') && inputs.barrier && (
        <group position={model.barrierCenter} rotation={[0, Math.PI / 2 - model.bearing, 0]}>
          <mesh>
            <boxGeometry args={[model.barrierWidth, 1300, 35]} />
            <meshStandardMaterial color="#89b3bb" transparent opacity={0.45} />
          </mesh>
          <mesh position={[0, -675, 0]}>
            <boxGeometry args={[model.barrierWidth + 80, 40, 280]} />
            <meshStandardMaterial color="#80969e" />
          </mesh>
        </group>
      )}
      {layers.includes('staff') && (
        <group position={model.position}>
          <mesh position={[0, 1390, 0]}>
            <sphereGeometry args={[95, 20, 16]} />
            <meshStandardMaterial color="#d9bfa0" />
          </mesh>
          <mesh position={[0, 1040, 0]}>
            <cylinderGeometry args={[135, 170, 500, 20]} />
            <meshStandardMaterial color="#6ca0ac" />
          </mesh>
          {[-80, 80].map((x) => (
            <mesh key={x} position={[x, 400, 0]}>
              <cylinderGeometry args={[45, 40, 800, 12]} />
              <meshStandardMaterial color="#617582" />
            </mesh>
          ))}
          <Line
            points={[
              [0, 5, 0],
              [-model.position[0], 5, -model.position[2]],
            ]}
            color="#9fbcbf"
            dashed
            dashSize={75}
            gapSize={35}
          />
        </group>
      )}
      <mesh position={add([0, model.floorY, 0], [0, 3, 0])} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[40, 24]} />
        <meshBasicMaterial color="#dbb87a" />
      </mesh>
    </group>
  )
}
export function StaffPanels({ inputs }: { inputs: SuiteInputs }) {
  return (
    <section
      className={styles.signalProfile}
      data-staff-distance={inputs.staffDistanceM}
      data-staff-orbit={inputs.orbit}
      data-staff-barrier={String(inputs.barrier)}
    >
      <p>
        Floor contours show a relative 1/r² trend around the irradiated volume. Their shape has an
        authored tube-side weighting; orientation moves the same gantry shown in the suite.
      </p>
      <p>
        The numerical ratio compares horizontal distance in the schematic floor plan. Angular
        weighting and the barrier are separate visual illustrations.
      </p>
      <p>
        Nominal contour radii: 1, 1.5, 2 and 3 m.{' '}
        {inputs.barrier
          ? 'Gray dashed portions mark a geometric shadow; no attenuation value is assigned.'
          : 'The unshielded contours provide the geometric comparison.'}
      </p>
    </section>
  )
}
