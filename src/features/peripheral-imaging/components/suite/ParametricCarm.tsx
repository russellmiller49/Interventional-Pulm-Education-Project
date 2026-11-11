'use client'
import { useEffect, useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import {
  BufferGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Quaternion,
  Shape,
  Vector3,
} from 'three'
import { clamp, radians, type Point3 } from '../../lib/physics'
import { coneFrustum, type SuiteFrame } from './suiteModel'
import type { SuiteVariant } from './types'

export function BeamCone({
  frame,
  fieldPercent,
  target,
  opacity = 0.065,
}: {
  frame: SuiteFrame
  fieldPercent: number
  target?: Point3
  opacity?: number
}) {
  const geometry = useMemo(() => {
    const cone = coneFrustum(frame, fieldPercent, target)
    const points = cone.corners.flatMap((corner, i) => [
      ...cone.source,
      ...corner,
      ...cone.corners[(i + 1) % 4],
    ])
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(points, 3))
    g.computeVertexNormals()
    return g
  }, [frame, fieldPercent, target])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color="#e3ba74"
        side={DoubleSide}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

const SHELL = '#d4dee1'
const SHELL_SHADE = '#9db0b7'
const DARK = '#2f434c'
const ACCENT = '#3fb6b0'

/**
 * The dimensions the C-arm is drawn from. Authored proportions around the shared imaging geometry:
 * the focal spot and the detector's image plane stay exactly on `SuiteFrame`, and everything here
 * is housing around them. Not a manufacturer's dimensions.
 */
export function carmDimensions({ sid, sod, field }: SuiteFrame['geometry']) {
  return {
    /** Radius of the C's centreline, and the height of its centre on the beam axis. */
    radius: sid / 2 + field * 0.12,
    centreY: sid / 2 - sod,
    channelHalfWidth: field * 0.065,
    channelDepth: field * 0.18,
    /** Where the stand's column stands, on the patient's right. */
    standX: -(sid / 2 + field * 0.12) - field * 0.56,
    floorY: -sod - field * 0.25,
  }
}

/**
 * Where on the C the stand holds it, as an angle on the C's own circle.
 *
 * Obliquity slides the C through its holder, so the holder keeps to the stand's side while the
 * tube and detector travel round the patient. Past the ends of the C (a long spin) it rides with
 * the arc, because there is no more C to slide.
 */
export function holderAngle(orbitDeg: number) {
  return radians(clamp(180 - orbitDeg, 104, 256))
}

/** A point of the C's own frame carried into the room: tilted about x, then rotated about z. */
export function carmToRoom([x, y, z]: Point3, orbitDeg: number, tiltDeg: number): Point3 {
  const t = radians(tiltDeg),
    o = radians(orbitDeg)
  const ty = y * Math.cos(t) - z * Math.sin(t),
    tz = y * Math.sin(t) + z * Math.cos(t)
  return [x * Math.cos(o) - ty * Math.sin(o), x * Math.sin(o) + ty * Math.cos(o), tz]
}

/** The outer face of the holder, where the stand's carriage meets it, measured from the isocentre. */
export function holderPoint(frame: SuiteFrame): Point3 {
  const d = carmDimensions(frame.geometry)
  const angle = holderAngle(frame.orbit)
  const reach = d.radius + frame.geometry.field * 0.15
  return carmToRoom(
    [reach * Math.cos(angle), d.centreY + reach * Math.sin(angle), 0],
    frame.orbit,
    frame.tilt,
  )
}

function useDisposable<T extends BufferGeometry>(build: () => T, deps: readonly unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(build, deps)
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

/** A half ring in the C's plane, extruded across it. */
function arcGeometry(
  radius: number,
  halfWidth: number,
  depth: number,
  bevel: number,
): ExtrudeGeometry {
  const shape = new Shape()
  shape.absarc(0, 0, radius + halfWidth, Math.PI / 2, Math.PI * 1.5, false)
  shape.lineTo(0, -radius + halfWidth)
  shape.absarc(0, 0, radius - halfWidth, Math.PI * 1.5, Math.PI / 2, true)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: 72,
    bevelEnabled: bevel > 0,
    bevelSegments: 3,
    bevelSize: bevel,
    bevelThickness: bevel,
  })
  geometry.translate(0, 0, -depth / 2)
  return geometry
}

/** A square frame open along the beam, so the collimator's blades and the beam show through it. */
function frameGeometry(outer: number, inner: number, height: number): ExtrudeGeometry {
  const shape = new Shape()
  shape.moveTo(-outer / 2, -outer / 2)
  shape.lineTo(outer / 2, -outer / 2)
  shape.lineTo(outer / 2, outer / 2)
  shape.lineTo(-outer / 2, outer / 2)
  shape.closePath()
  const hole = new Path()
  hole.moveTo(-inner / 2, -inner / 2)
  hole.lineTo(-inner / 2, inner / 2)
  hole.lineTo(inner / 2, inner / 2)
  hole.lineTo(inner / 2, -inner / 2)
  hole.closePath()
  shape.holes.push(hole)
  const geometry = new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
  // Extruded along z; stand it along the beam axis (y).
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

/** A solid bar between two points of the room. */
export function Strut({
  start,
  end,
  width,
  depth = width,
  color = SHELL_SHADE,
}: {
  start: Point3
  end: Point3
  width: number
  depth?: number
  color?: string
}) {
  const a = new Vector3(...start),
    b = new Vector3(...end)
  const direction = b.clone().sub(a)
  const length = direction.length()
  if (length < 1) return null
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    direction.clone().normalize(),
  )
  return (
    <RoundedBox
      args={[width, length + width * 0.5, depth]}
      radius={Math.min(width, depth) * 0.3}
      smoothness={3}
      position={a.clone().add(b).multiplyScalar(0.5)}
      quaternion={quaternion}
    >
      <meshStandardMaterial color={color} metalness={0.2} roughness={0.5} />
    </RoundedBox>
  )
}

/** The mobile C-arm's cart: chassis, wheels, column and the carriage out to the C. */
function MobileStand({ frame }: { frame: SuiteFrame }) {
  const f = frame.geometry.field
  const d = carmDimensions(frame.geometry)
  const hold = holderPoint(frame)
  const columnTop = clamp(hold[1], d.floorY + f * 0.95, d.floorY + f * 1.5)
  const chassisTop = d.floorY + f * 0.62
  return (
    <group name="mobile-c-arm-stand">
      <RoundedBox
        args={[f * 0.95, f * 0.46, f * 0.6]}
        radius={f * 0.07}
        smoothness={4}
        position={[d.standX - f * 0.2, chassisTop - f * 0.23, 0]}
      >
        <meshStandardMaterial color={SHELL} metalness={0.12} roughness={0.5} />
      </RoundedBox>
      {/* Low legs toward the table carry the front wheels under the tube's travel. */}
      {[-1, 1].map((side) => (
        <RoundedBox
          key={side}
          args={[f * 0.7, f * 0.07, f * 0.09]}
          radius={f * 0.03}
          smoothness={3}
          position={[d.standX + f * 0.42, d.floorY + f * 0.1, side * f * 0.3]}
        >
          <meshStandardMaterial color={DARK} metalness={0.25} roughness={0.5} />
        </RoundedBox>
      ))}
      {[
        [d.standX + f * 0.72, f * 0.3],
        [d.standX + f * 0.72, -f * 0.3],
        [d.standX - f * 0.52, f * 0.27],
        [d.standX - f * 0.52, -f * 0.27],
      ].map(([x, z]) => (
        <mesh
          key={`${x}:${z}`}
          position={[x, d.floorY + f * 0.055, z]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[f * 0.055, f * 0.055, f * 0.05, 24]} />
          <meshStandardMaterial color="#1c2a31" roughness={0.7} />
        </mesh>
      ))}
      {/* Push handle and the operator's panel at the back of the cart. */}
      <RoundedBox
        args={[f * 0.05, f * 0.05, f * 0.56]}
        radius={f * 0.02}
        smoothness={3}
        position={[d.standX - f * 0.66, chassisTop + f * 0.16, 0]}
      >
        <meshStandardMaterial color={DARK} metalness={0.3} roughness={0.45} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <Strut
          key={side}
          start={[d.standX - f * 0.58, chassisTop - f * 0.02, side * f * 0.25]}
          end={[d.standX - f * 0.66, chassisTop + f * 0.16, side * f * 0.25]}
          width={f * 0.035}
          color={DARK}
        />
      ))}
      <RoundedBox
        args={[f * 0.3, f * 0.03, f * 0.36]}
        radius={f * 0.012}
        smoothness={3}
        position={[d.standX - f * 0.36, chassisTop + f * 0.03, 0]}
        rotation={[0, 0, 0.32]}
      >
        <meshStandardMaterial color="#1f3038" emissive="#1f5f66" emissiveIntensity={0.35} />
      </RoundedBox>
      <RoundedBox
        args={[f * 0.24, columnTop - chassisTop + f * 0.2, f * 0.28]}
        radius={f * 0.05}
        smoothness={4}
        position={[d.standX, (columnTop + chassisTop) / 2, 0]}
      >
        <meshStandardMaterial color={SHELL_SHADE} metalness={0.2} roughness={0.5} />
      </RoundedBox>
      <Strut
        start={[d.standX, columnTop, 0]}
        end={hold}
        width={f * 0.17}
        depth={f * 0.2}
        color={SHELL}
      />
    </group>
  )
}

/** A fixed room's floor stand: a turntable, a pillar and a heavy shoulder out to the C. */
function FixedStand({ frame }: { frame: SuiteFrame }) {
  const f = frame.geometry.field
  const d = carmDimensions(frame.geometry)
  const hold = holderPoint(frame)
  const shoulderY = clamp(hold[1], d.floorY + f * 1.0, d.floorY + f * 1.45)
  const x = d.standX - f * 0.1
  return (
    <group name="fixed-c-arm-stand">
      <mesh position={[x, d.floorY + f * 0.035, 0]}>
        <cylinderGeometry args={[f * 0.52, f * 0.56, f * 0.07, 48]} />
        <meshStandardMaterial color={DARK} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[x, d.floorY + f * 0.1, 0]}>
        <cylinderGeometry args={[f * 0.4, f * 0.44, f * 0.07, 48]} />
        <meshStandardMaterial color={SHELL_SHADE} metalness={0.25} roughness={0.45} />
      </mesh>
      <RoundedBox
        args={[f * 0.42, shoulderY - d.floorY, f * 0.5]}
        radius={f * 0.1}
        smoothness={4}
        position={[x, (shoulderY + d.floorY) / 2 + f * 0.05, 0]}
      >
        <meshStandardMaterial color={SHELL} metalness={0.12} roughness={0.5} />
      </RoundedBox>
      <mesh position={[x, shoulderY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[f * 0.27, f * 0.27, f * 0.56, 40]} />
        <meshStandardMaterial color={SHELL_SHADE} metalness={0.25} roughness={0.45} />
      </mesh>
      <mesh position={[x, shoulderY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[f * 0.2, f * 0.2, f * 0.58, 40]} />
        <meshStandardMaterial color={ACCENT} metalness={0.2} roughness={0.5} />
      </mesh>
      <Strut start={[x, shoulderY, 0]} end={hold} width={f * 0.26} depth={f * 0.34} color={SHELL} />
    </group>
  )
}

/**
 * The stand that carries the C. It belongs to the room, not to the patient: a wedge rolls the
 * patient and the stand stays on the floor, so it is drawn from the C-arm's angle in the room.
 */
export function CarmStand({ frame, variant }: { frame: SuiteFrame; variant: SuiteVariant }) {
  return (
    <group position={frame.iso} name="c-arm-stand">
      {variant === 'fixed' ? <FixedStand frame={frame} /> : <MobileStand frame={frame} />}
    </group>
  )
}

export function ParametricCarm({
  frame,
  lit,
  shutters = true,
  housing = true,
  roomOrbit = frame.orbit,
}: {
  frame: SuiteFrame
  lit: boolean
  shutters?: boolean
  /** Off for the beam's-eye view, which looks out of the tube and would see only its casing. */
  housing?: boolean
  /** The C-arm's obliquity in the room, where it differs from `frame` because the patient is rolled. */
  roomOrbit?: number
}) {
  const { sod, sid, field: f } = frame.geometry
  const d = carmDimensions(frame.geometry)
  const channel = useDisposable(
    () => arcGeometry(d.radius, d.channelHalfWidth, d.channelDepth, f * 0.01),
    [d.radius, d.channelHalfWidth, d.channelDepth, f],
  )
  const rail = useDisposable(
    () =>
      arcGeometry(d.radius + d.channelHalfWidth + f * 0.006, f * 0.008, d.channelDepth * 0.42, 0),
    [d.radius, d.channelHalfWidth, d.channelDepth, f],
  )
  const collimator = useDisposable(() => frameGeometry(f * 0.24, f * 0.19, f * 0.1), [f])
  const collimatorRim = useDisposable(() => frameGeometry(f * 0.25, f * 0.19, f * 0.012), [f])
  const angle = holderAngle(roomOrbit)
  const detectorY = sid - sod
  return (
    <group position={frame.iso} name="c-arm">
      <group rotation={[0, 0, radians(frame.orbit)]}>
        <group rotation={[radians(frame.tilt), 0, 0]}>
          <group position={[0, d.centreY, 0]} visible={housing}>
            <mesh geometry={channel} name="c-arm-channel">
              <meshStandardMaterial color={SHELL} metalness={0.22} roughness={0.42} />
            </mesh>
            <mesh geometry={rail}>
              <meshStandardMaterial color={ACCENT} metalness={0.2} roughness={0.5} />
            </mesh>
            {/* The holder the C slides through; the stand carries this, not the C itself. */}
            <group rotation={[0, 0, angle]}>
              <RoundedBox
                args={[f * 0.3, f * 0.42, d.channelDepth + f * 0.12]}
                radius={f * 0.05}
                smoothness={4}
                position={[d.radius + f * 0.02, 0, 0]}
              >
                <meshStandardMaterial color={DARK} metalness={0.3} roughness={0.45} />
              </RoundedBox>
            </group>
          </group>

          {/* Flat-panel detector: the image plane is its lower face, toward the patient. */}
          <RoundedBox
            args={[f * 1.09, f * 0.1, f * 1.09]}
            radius={f * 0.03}
            smoothness={4}
            position={[0, detectorY + f * 0.052, 0]}
            name="flat-panel-detector"
          >
            <meshStandardMaterial color={SHELL} metalness={0.15} roughness={0.5} />
          </RoundedBox>
          <RoundedBox
            args={[f * 1.13, f * 0.035, f * 1.13]}
            radius={f * 0.015}
            smoothness={3}
            position={[0, detectorY + f * 0.03, 0]}
          >
            <meshStandardMaterial color={DARK} metalness={0.2} roughness={0.6} />
          </RoundedBox>
          <RoundedBox
            args={[f * 0.34, f * 0.2, f * 0.4]}
            radius={f * 0.05}
            smoothness={4}
            position={[-f * 0.03, detectorY + f * 0.16, 0]}
          >
            <meshStandardMaterial color={SHELL_SHADE} metalness={0.2} roughness={0.5} />
          </RoundedBox>

          {/* X-ray tube: the focal spot is at the source; the collimator stands between it and the patient. */}
          <mesh position={[0, -sod, 0]} visible={housing}>
            <sphereGeometry args={[f * 0.014, 16, 12]} />
            <meshStandardMaterial
              color="#ffe2a2"
              emissive="#efbc61"
              emissiveIntensity={lit ? 2.4 : 0.45}
            />
          </mesh>
          {housing && (
            <group name="x-ray-tube">
              <mesh position={[0, -sod - f * 0.105, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[f * 0.092, f * 0.092, f * 0.5, 36]} />
                <meshStandardMaterial color={SHELL} metalness={0.2} roughness={0.45} />
              </mesh>
              {[-1, 1].map((side) => (
                <mesh
                  key={side}
                  position={[0, -sod - f * 0.105, side * f * 0.245]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <cylinderGeometry args={[f * 0.097, f * 0.097, f * 0.03, 36]} />
                  <meshStandardMaterial color={DARK} metalness={0.3} roughness={0.5} />
                </mesh>
              ))}
              <mesh geometry={collimator} position={[0, -sod - f * 0.02, 0]}>
                <meshStandardMaterial color={SHELL_SHADE} metalness={0.25} roughness={0.5} />
              </mesh>
              {/* The rim lights with each exposure, so a pulse can be seen from across the room. */}
              <mesh geometry={collimatorRim} position={[0, -sod + f * 0.08, 0]}>
                <meshStandardMaterial
                  color={lit ? '#f5c97a' : DARK}
                  emissive="#efbc61"
                  emissiveIntensity={lit ? 1.6 : 0}
                  metalness={0.2}
                  roughness={0.5}
                />
              </mesh>
            </group>
          )}
          {shutters &&
            [-1, 1].map((sign) => (
              <group key={sign}>
                <mesh position={[sign * f * 0.065, -sod + f * 0.105, 0]}>
                  <boxGeometry args={[f * 0.045, f * 0.012, f * 0.17]} />
                  <meshStandardMaterial color="#6b7f85" metalness={0.5} roughness={0.4} />
                </mesh>
                <mesh position={[0, -sod + f * 0.12, sign * f * 0.065]}>
                  <boxGeometry args={[f * 0.17, f * 0.012, f * 0.045]} />
                  <meshStandardMaterial color="#6b7f85" metalness={0.5} roughness={0.4} />
                </mesh>
              </group>
            ))}
        </group>
      </group>
    </group>
  )
}
