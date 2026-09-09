'use client'
import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Mesh, MeshStandardMaterial } from 'three'
import { ANATOMY_MODEL } from '../../lib/anatomy'
import type { Point3 } from '../../lib/physics'
import type { SuiteLayer } from './types'

useGLTF.preload(ANATOMY_MODEL, '/fluoroview/draco/')
export function Anatomy({
  layers,
  offset = [0, 0, 0],
  map = false,
}: {
  layers: readonly SuiteLayer[]
  offset?: Point3
  map?: boolean
}) {
  const { scene: original } = useGLTF(ANATOMY_MODEL, '/fluoroview/draco/')
  const invalidate = useThree((state) => state.invalidate)
  const scene = useMemo(() => {
    const clone = original.clone(true)
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return
      // Geometry belongs to the cached GLTF. Materials belong to this mount.
      object.material = Array.isArray(object.material)
        ? object.material.map((m) => m.clone())
        : object.material.clone()
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof MeshStandardMaterial) {
          const name = object.name.replaceAll('_', ' ')
          material.color.set(
            map
              ? '#93a0a7'
              : name === 'Airways'
                ? '#deeee2'
                : name === 'Lungs'
                  ? '#72aaa9'
                  : '#cabd9f',
          )
          if (name === 'Lungs') material.opacity = map ? 0.06 : 0.12
          if (name === 'Ribs and spine') material.opacity = 0.23
          material.roughness = 0.8
          material.depthWrite = !material.transparent
        }
      }
    })
    return clone
  }, [original, map])
  useEffect(() => {
    scene.traverse((object) => {
      if (object instanceof Mesh)
        object.visible = layers.includes(object.name.replaceAll('_', ' ') as SuiteLayer)
    })
    invalidate()
  }, [scene, layers, invalidate])
  useEffect(
    () => () =>
      scene.traverse((object) => {
        if (object instanceof Mesh)
          for (const m of Array.isArray(object.material) ? object.material : [object.material])
            m.dispose()
      }),
    [scene],
  )
  return <primitive object={scene} position={offset} scale={1000} dispose={null} />
}
