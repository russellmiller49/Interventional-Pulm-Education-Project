'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import {
  DOLPHIN_MODEL_URL,
  DOLPHIN_STRUCTURES,
  ENVELOPE_OPACITY,
  type DolphinStructure,
} from '../content/structures'

const DRACO_DECODER_PATH = '/draco/'

/**
 * The model is in patient LPS millimetres. On screen: x = rostral (superior), y = dorsal
 * (posterior), z = the animal's right (-left), so the default camera on +z sees the right side
 * with the head to the right and the back up.
 */
const LPS_TO_VIEW = new THREE.Matrix4().set(0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1)

export type DolphinViewName = 'right' | 'left' | 'dorsal' | 'ventral' | 'rostral'

/**
 * Camera directions from the model's centre. The orbit keeps +y up, so the views from above and
 * below lean a little caudal or rostral to put the head at the top of the screen.
 */
export const DOLPHIN_VIEWS: Readonly<
  Record<DolphinViewName, { label: string; direction: [number, number, number]; caption: string }>
> = {
  right: {
    label: 'Right side',
    direction: [0, 0, 1],
    caption: 'Right side · head to the right · dorsal up',
  },
  left: {
    label: 'Left side',
    direction: [0, 0, -1],
    caption: 'Left side · head to the left · dorsal up',
  },
  dorsal: {
    label: 'Dorsal',
    direction: [-0.02, 1, 0],
    caption: 'From above · head up · right on the right',
  },
  ventral: {
    label: 'Ventral',
    direction: [0.02, -1, 0],
    caption: 'From below · head up · right on the left',
  },
  rostral: {
    label: 'Rostral',
    direction: [1, 0.25, 0.35],
    caption: 'From the head, above and to the right',
  },
}

const STRUCTURE_BY_ID = new Map<string, DolphinStructure>(DOLPHIN_STRUCTURES.map((s) => [s.id, s]))

interface Bounds {
  box: THREE.Box3
  center: THREE.Vector3
  radius: number
}

export interface DolphinSceneProps {
  visible: Readonly<Record<string, boolean>>
  surfaceOpacity: number
  selectedId: string | null
  view: { name: DolphinViewName; serial: number }
  onPick: (id: string) => void
}

export function DolphinScene(props: DolphinSceneProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 32, near: 5, far: 20000, position: [0, 0, 3000] }}
      gl={{ antialias: true }}
      aria-label="3D model of the dolphin; drag to rotate, scroll to zoom"
    >
      <hemisphereLight args={['#ffffff', '#7d8f96', 1.1]} />
      <directionalLight position={[800, 1200, 1500]} intensity={1.6} />
      <directionalLight position={[-1000, -400, -900]} intensity={0.6} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} />
      <DolphinModel {...props} />
    </Canvas>
  )
}

function DolphinModel({ visible, surfaceOpacity, selectedId, view, onPick }: DolphinSceneProps) {
  const { scene } = useGLTF(DOLPHIN_MODEL_URL, DRACO_DECODER_PATH)
  const invalidate = useThree((three) => three.invalidate)
  const root = useRef<THREE.Group>(null)
  const [bounds, setBounds] = useState<Bounds | null>(null)

  const meshes = useMemo(() => {
    const byId = new Map<string, THREE.Mesh>()
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const id = STRUCTURE_BY_ID.has(object.name) ? object.name : object.parent?.name
      const structure = id ? STRUCTURE_BY_ID.get(id) : undefined
      if (!structure) return
      const envelope = ENVELOPE_OPACITY[structure.id]
      object.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(...structure.color),
        roughness: 0.62,
        metalness: 0,
        side: THREE.DoubleSide,
        transparent: envelope !== undefined,
        opacity: envelope ?? 1,
        depthWrite: envelope === undefined,
      })
      // See-through envelopes draw last, over what they contain.
      object.renderOrder = envelope !== undefined ? 10 : 0
      object.userData.structureId = structure.id
      byId.set(structure.id, object)
    })
    return byId
  }, [scene])

  useLayoutEffect(() => {
    const group = root.current
    if (!group) return
    group.matrixAutoUpdate = false
    group.matrix.copy(LPS_TO_VIEW)
    group.updateMatrixWorld(true)
    const body = meshes.get('body-surface')
    const box = new THREE.Box3().setFromObject(body ?? group)
    setBounds({
      box,
      center: box.getCenter(new THREE.Vector3()),
      radius: box.getSize(new THREE.Vector3()).length() / 2,
    })
  }, [meshes])

  useEffect(() => {
    for (const [id, mesh] of meshes) {
      const material = mesh.material as THREE.MeshStandardMaterial
      mesh.visible = visible[id] ?? false
      if (id === 'body-surface') {
        material.opacity = surfaceOpacity
        mesh.visible &&= surfaceOpacity > 0
      }
      material.emissive.setHex(id === selectedId ? 0x2f6670 : 0x000000)
    }
    invalidate()
  }, [meshes, visible, surfaceOpacity, selectedId, invalidate])

  useEffect(
    () => () => {
      for (const mesh of meshes.values()) (mesh.material as THREE.Material).dispose()
    },
    [meshes],
  )

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    // A drag that rotated the model is not a pick.
    if (event.delta > 4) return
    const hit = event.intersections.find(({ object }) => {
      const id = object.userData.structureId as string | undefined
      return object.visible && id !== undefined && ENVELOPE_OPACITY[id] === undefined
    })
    if (!hit) return
    event.stopPropagation()
    onPick(hit.object.userData.structureId as string)
  }

  return (
    <>
      <group ref={root} onClick={handleClick}>
        <primitive object={scene} />
      </group>
      <CameraRig bounds={bounds} view={view} />
    </>
  )
}

/** Puts the camera at a named view, framing the whole animal; between requests the orbit is free. */
function CameraRig({ bounds, view }: { bounds: Bounds | null; view: DolphinSceneProps['view'] }) {
  const camera = useThree((three) => three.camera) as THREE.PerspectiveCamera
  const controls = useThree((three) => three.controls) as OrbitControlsImpl | null
  const invalidate = useThree((three) => three.invalidate)
  const get = useThree((three) => three.get)

  useEffect(() => {
    if (!bounds || !controls) return
    const { width, height } = get().size
    placeCamera(
      camera,
      controls,
      bounds,
      DOLPHIN_VIEWS[view.name].direction,
      width / Math.max(height, 1),
    )
    invalidate()
    // Only a view request (or the model arriving) moves the camera; a resize does not.
  }, [bounds, view.name, view.serial, controls, camera, get, invalidate])

  return null
}

/** Frames the whole animal from a direction: the box's outline as seen from there fills the frame. */
function placeCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControlsImpl,
  bounds: Bounds,
  from: readonly [number, number, number],
  aspect: number,
) {
  const direction = new THREE.Vector3(...from).normalize()
  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  // The box corners in a camera frame looking along -direction with +y up.
  const look = new THREE.Matrix4().lookAt(
    direction,
    new THREE.Vector3(),
    new THREE.Vector3(0, 1, 0),
  )
  const toCamera = look.clone().invert()
  let distance = 0
  for (const x of [bounds.box.min.x, bounds.box.max.x])
    for (const y of [bounds.box.min.y, bounds.box.max.y])
      for (const z of [bounds.box.min.z, bounds.box.max.z]) {
        const corner = new THREE.Vector3(x, y, z).sub(bounds.center).applyMatrix4(toCamera)
        // Far enough that this corner is inside both the vertical and horizontal field of view.
        const needed =
          Math.max(Math.abs(corner.y) / tanHalfFov, Math.abs(corner.x) / (tanHalfFov * aspect)) +
          corner.z
        distance = Math.max(distance, needed)
      }
  distance *= 1.08
  controls.target.copy(bounds.center)
  camera.position.copy(bounds.center).addScaledVector(direction, distance)
  camera.near = distance / 50
  camera.far = distance * 10
  camera.updateProjectionMatrix()
  camera.lookAt(bounds.center)
  controls.minDistance = bounds.radius * 0.25
  controls.maxDistance = distance * 3
  controls.update()
}
