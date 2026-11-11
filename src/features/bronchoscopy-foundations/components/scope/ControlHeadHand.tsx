'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

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

import { leverPadPoint, thumbKnuckle, type Point } from './controlHeadHandPose'

const UP = new THREE.Vector3(0, 1, 0)
const RADIAL = 16

/** Where a bone sits: its middle, its turn from upright, and its length. */
function bonePlacement(from: Point, to: Point) {
  const a = new THREE.Vector3(...from)
  const b = new THREE.Vector3(...to)
  const direction = b.clone().sub(a)
  const length = direction.length() || 0.001
  return {
    position: a.clone().add(b).multiplyScalar(0.5),
    quaternion: new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize()),
    length,
  }
}

/** The radius at each joint of a finger that tapers evenly from knuckle to tip. */
function taper(joints: number, radius: number, tipRadius: number): number[] {
  return Array.from(
    { length: joints },
    (_, index) => radius + ((tipRadius - radius) * index) / (joints - 1),
  )
}

/** The fixed geometry of one finger: a tapering bone between each pair of joints, round at each joint. */
function fingerGeometries(
  joints: readonly Point[],
  radius: number,
  tipRadius: number,
): THREE.BufferGeometry[] {
  const radii = taper(joints.length, radius, tipRadius)
  const parts: THREE.BufferGeometry[] = []
  joints.forEach((joint, index) => {
    parts.push(
      new THREE.SphereGeometry(radii[index], RADIAL, 10).translate(joint[0], joint[1], joint[2]),
    )
    const next = joints[index + 1]
    if (!next) return
    const { position, quaternion, length } = bonePlacement(joint, next)
    parts.push(
      new THREE.CylinderGeometry(radii[index + 1], radii[index], length, RADIAL, 1, true)
        .applyQuaternion(quaternion)
        .translate(position.x, position.y, position.z),
    )
  })
  return parts
}

function ellipsoidGeometry(center: Point, radii: Point): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, 24, 16)
    .scale(radii[0], radii[1], radii[2])
    .translate(center[0], center[1], center[2])
}

/** Three fingers round the grip: from the knuckles behind it to the ridges on its near side. */
const GRIP_FINGERS: readonly (readonly Point[])[] = [-20, -32, -44].map((y) => [
  [-15, y + 3, -9],
  [-2, y + 1, -17],
  [14, y, -11],
  [17, y - 1, 3],
])
/** The index finger as far as its last joint; the fingertip beyond it follows the valve. */
const INDEX_FIXED: readonly Point[] = [
  [-12, -6, -10],
  [6, 14, -15],
  [24, 36, -10],
]
const INDEX_RADII = taper(4, 5.4, 4.3)
const THUMB_BASE: Point = [-33, 5, 9]
const THUMB_RADII = taper(3, 6.6, 5.2)

/**
 * Everything of the hand that does not move against the control head, as one mesh: the palm, the
 * ball of the thumb, the wrist and forearm, the three fingers round the grip and the index finger
 * up to its last joint. Built once.
 */
function fixedHandGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    ellipsoidGeometry([-16, -29, 0], [10.5, 27, 13.5]),
    ellipsoidGeometry([-26, -7, 6], [11, 17, 9.5]),
    // The wrist and forearm, leaving the picture down and to the left.
    ...fingerGeometries(
      [
        [-17, -52, -1],
        [-36, -112, -8],
      ],
      11.5,
      13,
    ),
    ...GRIP_FINGERS.flatMap((joints) => fingerGeometries(joints, 5.6, 4.5)),
    ...fingerGeometries(INDEX_FIXED, INDEX_RADII[0], INDEX_RADII[2]),
  ].map((part) => {
    // Merging needs every part to carry the same attributes; none of these is textured.
    part.deleteAttribute('uv')
    return part.index ? part.toNonIndexed() : part
  })
  const merged = mergeGeometries(parts)
  parts.forEach((part) => part.dispose())
  return merged
}

/**
 * A bone that moves: one unit-long shape, stretched to the joint-to-joint length. The geometry is
 * made once for its two radii, so following the lever frame by frame allocates nothing.
 */
function MovingBone({
  from,
  to,
  radius,
  endRadius,
  material,
}: {
  from: Point
  to: Point
  radius: number
  endRadius: number
  material: THREE.Material
}) {
  const shaft = useMemo(
    () => new THREE.CylinderGeometry(endRadius, radius, 1, RADIAL, 1, true),
    [radius, endRadius],
  )
  const joint = useMemo(() => new THREE.SphereGeometry(1, RADIAL, 10), [])
  useEffect(
    () => () => {
      shaft.dispose()
      joint.dispose()
    },
    [shaft, joint],
  )
  const { position, quaternion, length } = bonePlacement(from, to)
  return (
    <>
      <mesh
        geometry={shaft}
        material={material}
        position={position}
        quaternion={quaternion}
        scale={[1, length, 1]}
      />
      <mesh geometry={joint} material={material} position={to} scale={endRadius} />
    </>
  )
}

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
  const fixed = useMemo(() => fixedHandGeometry(), [])
  useEffect(
    () => () => {
      fixed.dispose()
      material.dispose()
    },
    [fixed, material],
  )
  const pad = leverPadPoint(leverPivot, bendRad)
  const knuckle = thumbKnuckle(THUMB_BASE, pad, 23, 21)
  // The fingertip rides on the valve's top and goes down with it.
  const valveTop: Point = [
    suctionPivot[0] + suctionAxis[0] * (5 - suctionPressMm),
    suctionPivot[1] + suctionAxis[1] * (5 - suctionPressMm),
    suctionPivot[2] + suctionAxis[2] * (5 - suctionPressMm),
  ]
  return (
    <group>
      <mesh geometry={fixed} material={material} />
      <MovingBone
        from={INDEX_FIXED[2]}
        to={valveTop}
        radius={INDEX_RADII[2]}
        endRadius={INDEX_RADII[3]}
        material={material}
      />
      <MovingBone
        from={THUMB_BASE}
        to={knuckle}
        radius={THUMB_RADII[0]}
        endRadius={THUMB_RADII[1]}
        material={material}
      />
      <MovingBone
        from={knuckle}
        to={pad}
        radius={THUMB_RADII[1]}
        endRadius={THUMB_RADII[2]}
        material={material}
      />
    </group>
  )
}
