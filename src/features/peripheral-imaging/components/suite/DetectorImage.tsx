'use client'

import { useEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { type Point3 } from '../../lib/physics'
import type { DrrTextureSource } from './drrTextureSource'

export interface DetectorQuadFrame {
  center: Point3
  u: Point3
  v: Point3
  field: number
}

/** U is image-right, V is image-up. U × V faces the source; UV (0,0) is bottom-left. */
export function DetectorImage({
  frame,
  source,
}: {
  frame: DetectorQuadFrame
  source: DrrTextureSource | null
}) {
  const invalidate = useThree((state) => state.invalidate)
  const [ready, setReady] = useState(source?.state === 'ready')
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    const positions = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].flatMap(([x, y]) =>
      frame.center.map((n, i) => n + ((x * frame.u[i] + y * frame.v[i]) * frame.field) / 2),
    )
    g.setAttribute('position', new Float32BufferAttribute(positions, 3))
    g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.computeVertexNormals()
    return g
  }, [frame])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => {
    const update = () => {
      setReady(source?.state === 'ready')
      invalidate()
    }
    update()
    return source?.subscribe(update)
  }, [source, invalidate])
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        map={ready && source ? source.texture : null}
        color={ready ? '#ffffff' : '#263b4a'}
        toneMapped={false}
      />
    </mesh>
  )
}
