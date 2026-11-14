'use client'
import { useEffect, useMemo } from 'react'
import { CatmullRomCurve3, TubeGeometry, Vector3 } from 'three'
import type { Point3 } from '../../lib/physics'

/** The catheter in the 3D view: a white tube along the airway it lies in, with its tip marked. */
export function Catheter3D({
  path,
  offset = [0, 0, 0],
}: {
  path: readonly Point3[]
  offset?: Point3
}) {
  const geometry = useMemo(() => {
    if (path.length < 2) return null
    const curve = new CatmullRomCurve3(
      path.map((point) => new Vector3(...point)),
      false,
      'centripetal',
    )
    return new TubeGeometry(curve, Math.max(8, path.length * 3), 1.7, 8, false)
  }, [path])
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null
  const tip = path[path.length - 1]
  return (
    // The catheter lies inside the pale airway surface, so it is drawn through it: without that it
    // is the one thing in the view the learner has just been asked about and cannot see.
    <group name="catheter" position={offset}>
      <mesh geometry={geometry} renderOrder={5}>
        <meshBasicMaterial color="#ffffff" depthTest={false} transparent opacity={0.95} />
      </mesh>
      <mesh position={tip} renderOrder={6}>
        <sphereGeometry args={[3.2, 16, 12]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} transparent />
      </mesh>
    </group>
  )
}
