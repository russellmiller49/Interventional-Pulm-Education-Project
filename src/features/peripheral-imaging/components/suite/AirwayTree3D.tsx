'use client'
import { useEffect, useMemo } from 'react'
import { CatmullRomCurve3, TubeGeometry, Vector3, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { AIRWAY_TREE, airwayColor, type AirwayShow } from '../../lib/airwayTree'
import type { Point3 } from '../../lib/physics'

/**
 * The named bronchi in the 3D view, in the colours the image and its legend use.
 *
 * Each branch is a tube along its centreline, a little wider than its lumen so that it reads over
 * the pale airway surface it runs inside. Only what the learner has asked to see is drawn.
 */
export function AirwayTree3D({ show, offset = [0, 0, 0] }: { show: AirwayShow; offset?: Point3 }) {
  const groups = useMemo(() => {
    const byColor = new Map<string, BufferGeometry[]>()
    for (const branch of AIRWAY_TREE) {
      const color = airwayColor(branch, show)
      if (!color || branch.points.length < 2) continue
      const curve = new CatmullRomCurve3(
        branch.points.map((point) => new Vector3(...point)),
        false,
        'centripetal',
      )
      const tube = new TubeGeometry(
        curve,
        Math.max(2, branch.points.length * 2),
        branch.radiusMm * 1.12 + 0.5,
        7,
        false,
      )
      const list = byColor.get(color) ?? []
      list.push(tube)
      byColor.set(color, list)
    }
    return [...byColor].map(([color, tubes]) => {
      const geometry = mergeGeometries(tubes)
      for (const tube of tubes) tube.dispose()
      return { color, geometry }
    })
  }, [show])
  useEffect(() => () => groups.forEach((group) => group.geometry.dispose()), [groups])
  if (show === 'off') return null
  return (
    <group name="airway-tree" position={offset}>
      {groups.map(({ color, geometry }) => (
        <mesh key={color} geometry={geometry} renderOrder={1}>
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.28}
            roughness={0.55}
            metalness={0}
          />
        </mesh>
      ))}
    </group>
  )
}
