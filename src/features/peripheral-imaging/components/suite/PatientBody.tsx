'use client'
import { useEffect, useMemo } from 'react'
import { Color, FrontSide, type BufferGeometry } from 'three'
import type { Point3 } from '../../lib/physics'
import { limbGeometry, loftGeometry, resampleRows, sectionRing, type LimbPoint } from './loft'

/**
 * The patient the thorax belongs to: supine, head toward the bronchoscopist, draped from the
 * abdomen down.
 *
 * The CT stops at the lung apices and the diaphragm, so on its own it is a chest floating over a
 * table: nothing says which end is the head, which side is the left, or which surface the detector
 * is over, and every angle the course teaches is named against those. The figure is authored
 * around the CT (its back rests where the CT's does, and the chest is wide enough to hold the ribs)
 * and is drawn as a clear skin, so the lungs, the airways and the lesion stay visible through it.
 * It is an orientation figure, not a segmentation: its outline is not the source patient's.
 *
 * Millimetres, x toward the patient's left, y anterior, z superior.
 */

/** The top of the pad the patient lies on; the CT's posterior skin is here. */
export const PATIENT_BACK_Y = -150

/** z, half-width, posterior surface, anterior surface. Pelvis to vertex. */
export const PATIENT_TRUNK: readonly (readonly number[])[] = [
  [-600, 150, -148, 60],
  [-540, 176, -150, 104],
  [-430, 184, -150, 132],
  [-300, 180, -150, 158],
  [-170, 186, -151, 164],
  [-60, 190, -151, 156],
  [0, 192, -151, 146],
  [80, 194, -151, 138],
  [140, 198, -150, 130],
  [178, 192, -149, 116],
  [200, 160, -144, 98],
  [216, 104, -134, 76],
  [230, 62, -122, 52],
  [248, 50, -114, 40],
  [282, 49, -110, 40],
  [300, 54, -112, 52],
  [316, 64, -118, 74],
  [336, 74, -124, 86],
  [368, 81, -128, 92],
  [404, 83, -128, 92],
  [436, 79, -124, 86],
  [462, 67, -112, 72],
  [480, 49, -94, 50],
  [491, 27, -68, 22],
  [495, 7, -40, -8],
]

const arm = (side: 1 | -1): LimbPoint[] =>
  (
    [
      [206, -40, 172, 54, 52],
      [226, -74, 60, 50, 48],
      [236, -100, -70, 45, 43],
      [240, -108, -150, 41, 40],
      [236, -113, -260, 36, 34],
      [228, -120, -370, 29, 25],
      [222, -124, -440, 36, 20],
      [218, -126, -500, 26, 16],
    ] as const
  ).map(([x, y, z, radius, depth]) => ({ at: [side * x, y, z] as Point3, radius, depth }))

/** z, half-width, height of the drape over the pad, and how far it has split into two legs (0..1). */
const DRAPE: readonly (readonly number[])[] = [
  [-232, 262, 326, 0],
  [-250, 268, 332, 0],
  [-330, 270, 322, 0],
  [-450, 268, 296, 0],
  [-560, 262, 262, 0.15],
  [-680, 250, 214, 0.75],
  [-820, 232, 176, 1],
  [-980, 214, 150, 1],
  [-1120, 200, 124, 1],
  [-1270, 190, 108, 1],
  [-1335, 186, 150, 1],
  [-1385, 184, 232, 1],
  [-1420, 180, 190, 1],
  [-1440, 172, 60, 1],
]

function drapeRing([z, halfWidth, height, split]: readonly number[], segments = 56): Point3[] {
  const top = (u: number) => {
    const shoulder = Math.max(0, 1 - Math.abs(u) ** 3.2) ** 0.55
    const leg = (centre: number) => Math.exp(-(((u - centre) / 0.3) ** 2))
    const legs = Math.min(1, leg(0.42) + leg(-0.42) + 0.34) * Math.max(0, 1 - Math.abs(u) ** 6)
    return PATIENT_BACK_Y + 1 + height * (shoulder * (1 - split) + legs * split)
  }
  const half = segments / 2
  // Counter-clockwise seen from the head: along the pad toward the left, back over the top.
  const ring: Point3[] = []
  for (let i = 0; i < half; i++) {
    const u = -1 + (2 * i) / (half - 1)
    ring.push([halfWidth * u * 0.985, PATIENT_BACK_Y + 0.5, z])
  }
  for (let i = 0; i < half; i++) {
    const u = 1 - (2 * i) / (half - 1)
    ring.push([halfWidth * u, top(u), z])
  }
  return ring
}

const skinVertex = `varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 eye = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-eye.xyz);
  gl_Position = projectionMatrix * eye;
}`
const skinFragment = `varying vec3 vNormal;
varying vec3 vView;
uniform vec3 body;
uniform vec3 edge;
uniform float fill;
uniform float edgeGain;
void main() {
  vec3 normal = normalize(vNormal);
  float facing = abs(dot(normal, normalize(vView)));
  // The outline carries the figure; the surface facing the viewer stays clear over the anatomy.
  float rim = pow(1.0 - facing, 2.2);
  float lit = 0.62 + 0.38 * max(dot(normal, normalize(vec3(0.35, 0.8, 0.45))), 0.0);
  gl_FragColor = vec4(mix(body * lit, edge, rim), clamp(fill + rim * edgeGain, 0.0, 1.0));
  #include <colorspace_fragment>
}`

function useGeometry(build: () => BufferGeometry, deps: readonly unknown[]): BufferGeometry {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(build, deps)
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

/** The clear skin. `fuller` is for the small features, which would vanish at the trunk's opacity. */
function SkinMaterial({ solid, fuller = false }: { solid: boolean; fuller?: boolean }) {
  const uniforms = useMemo(
    () => ({
      body: { value: new Color('#9fb7bd') },
      edge: { value: new Color('#e4f1f2') },
      fill: { value: fuller ? (solid ? 0.34 : 0.16) : solid ? 0.3 : 0.1 },
      edgeGain: { value: fuller ? 0.6 : solid ? 0.6 : 0.62 },
    }),
    [solid, fuller],
  )
  return (
    <shaderMaterial
      vertexShader={skinVertex}
      fragmentShader={skinFragment}
      uniforms={uniforms}
      transparent
      depthWrite={false}
      side={FrontSide}
      toneMapped={false}
    />
  )
}

function Skin({ geometry, solid }: { geometry: BufferGeometry; solid: boolean }) {
  return (
    <mesh geometry={geometry} renderOrder={4}>
      <SkinMaterial solid={solid} />
    </mesh>
  )
}

export function PatientBody({
  offset = [0, 0, 0],
  solid = false,
}: {
  /** Moves the whole patient, as the table does when it centres the lesion. */
  offset?: Point3
  /** A fuller skin for the still of the room, where the figure is small. */
  solid?: boolean
}) {
  const trunk = useGeometry(
    () =>
      loftGeometry(
        resampleRows(PATIENT_TRUNK, 5).map(([z, halfWidth, back, front]) =>
          sectionRing((x, y) => [x, y, z], halfWidth, back, front, {
            segments: 44,
            squareness: z > 300 ? 2.15 : 2.6,
            flatBelow: z > 300 ? 2.4 : 4,
          }),
        ),
      ),
    [],
  )
  const leftArm = useGeometry(() => limbGeometry(arm(1)), [])
  const rightArm = useGeometry(() => limbGeometry(arm(-1)), [])
  const drape = useGeometry(
    () =>
      loftGeometry(
        [...resampleRows(DRAPE, 4)].reverse().map((row) => drapeRing(row)),
        // Open at the chest: the drape is a sheet over the patient, not a block beside them.
        { capEnd: false },
      ),
    [],
  )
  return (
    <group name="patient-figure" position={offset}>
      <Skin geometry={trunk} solid={solid} />
      <Skin geometry={leftArm} solid={solid} />
      <Skin geometry={rightArm} solid={solid} />
      {/* The nose and ears say which way the face points: anterior is up, toward the detector. */}
      <mesh position={[0, 96, 372]} scale={[13, 19, 26]} renderOrder={4}>
        <sphereGeometry args={[1, 20, 14]} />
        <SkinMaterial solid={solid} fuller />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 84, -22, 384]} scale={[9, 26, 30]} renderOrder={4}>
          <sphereGeometry args={[1, 16, 12]} />
          <SkinMaterial solid={solid} fuller />
        </mesh>
      ))}
      <mesh geometry={drape} name="patient-drape">
        <meshStandardMaterial color="#3d7f8a" roughness={0.92} metalness={0} />
      </mesh>
    </group>
  )
}
