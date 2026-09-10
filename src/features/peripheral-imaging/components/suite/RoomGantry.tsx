'use client'
import { useEffect, useMemo } from 'react'
import { ExtrudeGeometry, Quaternion, Shape, Vector3 } from 'three'
import { type ImagingGeometry, type Point3 } from '../../lib/physics'
import { add, scale, type SuiteFrame } from './suiteModel'

/** Broad, bevelled teaching C-channel; the source and detector stay on the shared frame. */
export function RoomGantryArm({ geometry: { sid, field } }: { geometry: ImagingGeometry }) {
  const geometry = useMemo(() => {
    const radius = sid / 2 + field * 0.12,
      halfWidth = field * 0.065
    const shape = new Shape()
    shape.absarc(0, 0, radius + halfWidth, Math.PI / 2, Math.PI * 1.5, false)
    shape.lineTo(0, -radius + halfWidth)
    shape.absarc(0, 0, radius - halfWidth, Math.PI * 1.5, Math.PI / 2, true)
    shape.closePath()
    const result = new ExtrudeGeometry(shape, {
      depth: field * 0.18,
      steps: 1,
      curveSegments: 64,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: field * 0.008,
      bevelThickness: field * 0.008,
    })
    result.translate(0, 0, -field * 0.09)
    return result
  }, [sid, field])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} name="room-c-channel">
      <meshStandardMaterial color="#b8cbd0" metalness={0.28} roughness={0.38} />
    </mesh>
  )
}

/** Solid link between two physical attachment points, without moving the imaging geometry. */
function Link({ start, end, width }: { start: Point3; end: Point3; width: number }) {
  const a = new Vector3(...start),
    b = new Vector3(...end)
  const direction = b.clone().sub(a)
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    direction.clone().normalize(),
  )
  return (
    <mesh position={a.add(b).multiplyScalar(0.5)} quaternion={quaternion}>
      <boxGeometry args={[width, direction.length(), width]} />
      <meshStandardMaterial color="#839eaa" metalness={0.3} roughness={0.45} />
    </mesh>
  )
}

export function RoomGantryMount({ frame }: { frame: SuiteFrame }) {
  const { sid, sod, field } = frame.geometry
  const back = add(scale(frame.u, -sid / 2 - field * 0.12), scale(frame.normal, sid / 2 - sod))
  return (
    <group name="room-gantry-mount">
      <Link start={[-sid * 0.52, back[1], 0]} end={back} width={field * 0.17} />
      <mesh position={back} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[field * 0.12, field * 0.12, field * 0.24, 32]} />
        <meshStandardMaterial color="#526f7d" metalness={0.35} roughness={0.4} />
      </mesh>
    </group>
  )
}
