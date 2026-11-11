'use client'

import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * The left hand on the control head, drawn over the close-up so the grip is seen and not only
 * described: the control section in the palm, three fingers round the grip, the index finger on
 * the suction valve and the thumb on the angulation lever.
 *
 * It is drawn here from simple jointed shapes, in the control head's own coordinates, and is not
 * part of the instrument's model file. The thumb follows the lever and the index finger follows
 * the suction valve, so the hand moves when the controls do. The thumb comes to the lever from the
 * left, clear of the U and D marks. A teaching drawing of a grip, not a model of anyone's hand.
 */

type Point = readonly [number, number, number]

/** Where the thumb's knuckle goes, for a thumb of two fixed lengths reaching from base to pad. */
export function thumbKnuckle(base: Point, pad: Point, firstMm: number, secondMm: number): Point {
  const dx = pad[0] - base[0]
  const dy = pad[1] - base[1]
  const reach = Math.hypot(dx, dy)
  // Keep the triangle closable: neither folded flat nor stretched past straight.
  const span = Math.min(
    firstMm + secondMm - 0.01,
    Math.max(Math.abs(firstMm - secondMm) + 0.01, reach),
  )
  const toward = Math.atan2(dy, dx)
  const open = Math.acos(
    Math.min(1, Math.max(-1, (firstMm ** 2 + span ** 2 - secondMm ** 2) / (2 * firstMm * span))),
  )
  // Two knuckle positions close the triangle; a thumb's knuckle is the one away from the fingers,
  // which on this left hand is the one further to the viewer's left.
  const candidates = [toward + open, toward - open].map(
    (angle): Point => [
      base[0] + firstMm * Math.cos(angle),
      base[1] + firstMm * Math.sin(angle),
      base[2] + (pad[2] - base[2]) * 0.55 + 2,
    ],
  )
  return candidates[0][0] <= candidates[1][0] ? candidates[0] : candidates[1]
}

/** The lever's thumb pad, in the head's coordinates, for a lever turned `bendRad` about its pivot. */
export function leverPadPoint(pivot: Point, bendRad: number): Point {
  // The pad sits 23 units out along the lever arm and a little proud of it (build-control-head.py).
  const x = -23
  const z = 6
  return [pivot[0] + x * Math.cos(bendRad), pivot[1] + x * Math.sin(bendRad), pivot[2] + z]
}

const UP = new THREE.Vector3(0, 1, 0)

/** One segment of a finger: a round-ended bone from one joint to the next, a little finer at its far end. */
function Bone({
  from,
  to,
  radius,
  endRadius = radius,
  material,
}: {
  from: Point
  to: Point
  radius: number
  endRadius?: number
  material: THREE.Material
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const direction = b.clone().sub(a)
    const span = direction.length() || 0.001
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize()),
      length: span,
    }
  }, [from, to])
  return (
    <>
      <mesh position={position} quaternion={quaternion} material={material}>
        <cylinderGeometry args={[endRadius, radius, length, 24, 1, true]} />
      </mesh>
      <mesh position={from} material={material}>
        <sphereGeometry args={[radius, 24, 16]} />
      </mesh>
      <mesh position={to} material={material}>
        <sphereGeometry args={[endRadius, 24, 16]} />
      </mesh>
    </>
  )
}

/** A finger: bones from joint to joint, tapering from `radius` at the knuckle to `tipRadius`. */
function Finger({
  joints,
  radius,
  tipRadius,
  material,
}: {
  joints: readonly Point[]
  radius: number
  tipRadius: number
  material: THREE.Material
}) {
  const bones = joints.length - 1
  const at = (index: number) => radius + ((tipRadius - radius) * index) / bones
  return (
    <>
      {joints.slice(1).map((joint, index) => (
        <Bone
          key={index}
          from={joints[index]}
          to={joint}
          radius={at(index)}
          endRadius={at(index + 1)}
          material={material}
        />
      ))}
    </>
  )
}

/** Three fingers round the grip: from the knuckles behind it to the ridges on its near side. */
const GRIP_FINGERS: readonly (readonly Point[])[] = [-20, -32, -44].map((y) => [
  [-15, y + 3, -9],
  [-2, y + 1, -17],
  [14, y, -11],
  [17, y - 1, 3],
])

export function LeftHandGrip({
  leverPivot,
  bendRad,
  suctionPivot,
  suctionAxis,
  suctionPressMm,
}: {
  leverPivot: Point
  bendRad: number
  suctionPivot: Point
  suctionAxis: Point
  /** How far the valve is pressed in, in the head's units. */
  suctionPressMm: number
}) {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#5d8fc4', roughness: 0.62, metalness: 0 }),
    [],
  )
  const thumbBase: Point = [-33, 5, 9]
  const pad = leverPadPoint(leverPivot, bendRad)
  const knuckle = thumbKnuckle(thumbBase, pad, 23, 21)
  // The fingertip rides on the valve's top and goes down with it.
  const valveTop: Point = [
    suctionPivot[0] + suctionAxis[0] * (5 - suctionPressMm),
    suctionPivot[1] + suctionAxis[1] * (5 - suctionPressMm),
    suctionPivot[2] + suctionAxis[2] * (5 - suctionPressMm),
  ]
  const index: readonly Point[] = [[-12, -6, -10], [6, 14, -15], [24, 36, -10], valveTop]
  return (
    <group data-left-hand>
      {/* The palm, to the left of the grip and round behind it, with the ball of the thumb. */}
      <mesh position={[-16, -29, 0]} scale={[10.5, 27, 13.5]} material={material}>
        <sphereGeometry args={[1, 32, 20]} />
      </mesh>
      <mesh position={[-26, -7, 6]} scale={[11, 17, 9.5]} material={material}>
        <sphereGeometry args={[1, 28, 18]} />
      </mesh>
      {/* The wrist and forearm, leaving the picture down and to the left. */}
      <Bone
        from={[-17, -52, -1]}
        to={[-36, -112, -8]}
        radius={11.5}
        endRadius={13}
        material={material}
      />
      {GRIP_FINGERS.map((joints, finger) => (
        <Finger key={finger} joints={joints} radius={5.6} tipRadius={4.5} material={material} />
      ))}
      <Finger joints={index} radius={5.4} tipRadius={4.3} material={material} />
      <Finger joints={[thumbBase, knuckle, pad]} radius={6.6} tipRadius={5.2} material={material} />
    </group>
  )
}
