'use client'
import { useMemo } from 'react'
import { Line } from '../SceneLine'
import { staff } from '../staffModel'
import { Quad } from '../SceneGeometry'
import { StaffFigure } from '../StaffFigure'
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
        <>
          <StaffFigure position={model.position} facing={[0, model.floorY, 0]} />
          <Line
            points={[
              [model.position[0], model.floorY + 5, model.position[2]],
              [0, model.floorY + 5, 0],
            ]}
            color="#9fbcbf"
            dashed
            dashSize={75}
            gapSize={35}
          />
        </>
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
      {/* Report 7.3: the practical point first, in the section's own words, with its qualifier. */}
      <p className={styles.leadRule} data-staff-practical>
        <strong>Where to stand.</strong> In lateral projections, positions on the detector side
        often receive less than the beam-entrance (tube) side, but a CBCT spin changes directions
        throughout. Rotate the C-arm and watch the contours lean toward the tube side.
      </p>
      <p>
        Floor contours show the 1/r² fall-off around the irradiated volume. They lean toward the
        tube side, where scatter is often higher, and follow the C-arm as it rotates.
      </p>
      <p>
        The ratio in the readout reflects distance alone; it does not change with the C-arm angle or
        the barrier.
      </p>
      <p>
        Contour radii: 1, 1.5, 2 and 3 m.
        {inputs.barrier ? ' Gray dashed portions lie in the shadow of the barrier.' : ''}
      </p>
    </section>
  )
}
