'use client'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, type Texture } from 'three'
import type { Point3 } from '../../lib/physics'

/** Shared four-corner surface. Explicitly dispose geometry when its plane moves. */
export function Quad({
  points,
  color,
  opacity = 1,
  texture,
}: {
  points: readonly Point3[]
  color: string
  opacity?: number
  texture?: Texture
}) {
  const geometry = useMemo(() => {
    const result = new BufferGeometry()
    result.setAttribute('position', new Float32BufferAttribute(points.flat(), 3))
    result.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
    result.setIndex([0, 1, 2, 0, 2, 3])
    result.computeVertexNormals()
    return result
  }, [points])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color={color}
        map={texture}
        side={DoubleSide}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity === 1}
        toneMapped={false}
      />
    </mesh>
  )
}
