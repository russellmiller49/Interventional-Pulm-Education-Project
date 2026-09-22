'use client'
import { Line } from '@react-three/drei'
import { dosePlanes } from '../doseModel'
import { Quad } from '../SceneGeometry'
import { add, scale } from '../suiteModel'
import type { SuiteInputs } from '../types'
import type { RayProfile } from '../../../lib/rayProfile'
import styles from '../suite-scene.module.css'

export function DoseView({ inputs, profile }: { inputs: SuiteInputs; profile: RayProfile | null }) {
  const model = dosePlanes(inputs, profile)
  return (
    <group>
      {model.apertureBlades.map((points, index) => (
        <Quad key={index} points={points} color="#b5bfc4" />
      ))}
      <Line
        points={[model.frame.source, model.frame.detectorCenter]}
        color="#b3c9cc"
        dashed
        dashSize={12}
        gapSize={8}
      />
      {model.planes.map((plane, i) => (
        <group key={plane.label}>
          <Quad points={plane.points} color={i ? '#80cabb' : '#e8bd7c'} opacity={0.3} />
          <Line
            points={[...plane.points, plane.points[0]]}
            color={i ? '#80cabb' : '#e8bd7c'}
            lineWidth={2}
          />
        </group>
      ))}
      <mesh position={model.reference}>
        <sphereGeometry args={[7, 16, 12]} />
        <meshBasicMaterial color="#c1a3e0" />
      </mesh>
      <Line
        points={[
          add(model.reference, scale(model.frame.u, -35)),
          add(model.reference, scale(model.frame.u, 35)),
        ]}
        color="#c1a3e0"
      />
      {model.skinEntry && (
        <mesh position={model.skinEntry}>
          <sphereGeometry args={[7, 16, 12]} />
          <meshBasicMaterial color="#eb939e" />
        </mesh>
      )}
    </group>
  )
}
export function DosePanels({
  inputs,
  profile,
  failed,
}: {
  inputs: SuiteInputs
  profile: RayProfile | null
  failed: boolean
}) {
  const model = dosePlanes(inputs, profile)
  // Report 7.1: the lesson first, then the two planes at a readable precision, and the full
  // precision and the marker legend one disclosure away. The values are the model's own; only the
  // number of digits shown changes, and the exact values remain printed.
  const kerma = (value: number) => (value >= 100 ? value.toFixed(0) : value.toFixed(1))
  const shared = model.planes[0].kapGyCm2
  return (
    <section
      className={styles.signalProfile}
      data-dose-state={failed ? 'failed' : profile ? 'ready' : 'loading'}
    >
      <p className={styles.leadRule} data-dose-rule>
        <strong>Same product on both planes.</strong> KAP is air kerma multiplied by beam area. As
        the beam spreads, the area grows and the air kerma falls by the same factor, so the product
        is the same at the two free-air planes in this model: {shared.toFixed(2)} Gy·cm² at both
        planes here. Reference air kerma is a point index at one reference position; neither
        quantity is peak skin dose or effective dose.
      </p>
      <div className={styles.mprGrid}>
        {model.planes.map((plane) => (
          <div key={plane.label} data-dose-plane={plane.label}>
            <strong>{plane.label}</strong>
            <p>
              {kerma(plane.kermaMgy)} mGy × {plane.areaCm2.toFixed(1)} cm²
            </p>
            <p>KAP: {plane.kapGyCm2.toFixed(2)} Gy·cm²</p>
          </div>
        ))}
      </div>
      <details className={styles.exactValues} data-dose-exact>
        <summary>Exact values, and where the planes and markers are</summary>
        <p>
          Two defined planes on the same beam. The sliders specify the teal plane at isocentre; the
          amber plane just after the blades shows the corresponding free-air quantities.
        </p>
        <ul>
          {model.planes.map((plane) => (
            <li key={plane.label} data-dose-plane-exact={plane.label}>
              {plane.label}: {plane.distance.toFixed(0)} mm from the focal spot ·{' '}
              {plane.kermaMgy.toFixed(2)} mGy × {plane.areaCm2.toFixed(3)} cm² ={' '}
              {plane.kapGyCm2.toFixed(4)} Gy·cm²
            </li>
          ))}
        </ul>
        <p>
          Violet: reference marker, authored 150 mm toward the source from isocentre. Equipment
          conventions determine the actual reference position. Pink: first non-air point on the
          central ray through the quantized CT envelope.
        </p>
        <p>
          {model.skinEntry
            ? 'The skin-entry marker locates a surface; it has no skin-dose value.'
            : failed
              ? 'CT envelope unavailable; the two free-air planes remain available.'
              : profile
                ? 'The central ray has no non-air intersection in this CT envelope.'
                : 'Preparing the CT envelope marker…'}
        </p>
      </details>
    </section>
  )
}
