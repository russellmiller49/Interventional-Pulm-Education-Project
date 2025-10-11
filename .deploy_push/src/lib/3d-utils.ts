import { useEffect, useState } from 'react'
import { Box3, Color, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'

import type { AnatomyModel } from '@/lib/types'

interface LoadingState {
  status: 'loading'
}

interface ErrorState {
  status: 'error'
  error: string
}

export interface AnatomyAssetSuccess {
  status: 'success'
  group: Group
  boundingBox: Box3
}

export type AnatomyAssetState = LoadingState | ErrorState | AnatomyAssetSuccess

export function useAnatomyAsset(model: AnatomyModel): AnatomyAssetState {
  const [state, setState] = useState<AnatomyAssetState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState({ status: 'loading' })
      try {
        const asset = await loadModel(model)
        if (!cancelled) {
          setState(asset)
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: 'error', error: (error as Error).message })
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [model])

  return state
}

async function loadModel(model: AnatomyModel): Promise<AnatomyAssetSuccess> {
  const glbDownload = model.downloads.find((download) => download.format === 'glb')
  const stlDownload = model.downloads.find((download) => download.format === 'stl')

  if (glbDownload) {
    const loader = new GLTFLoader()
    const gltf = await loader.loadAsync(glbDownload.url)
    const group = gltf.scene
    group.updateMatrixWorld(true)
    const boundingBox = normalizeGroup(group, model)
    return { status: 'success', group, boundingBox }
  }

  if (stlDownload) {
    const loader = new STLLoader()
    const geometry = await loader.loadAsync(stlDownload.url)
    const group = new Group()
    const segments = model.segments.length
      ? model.segments
      : [{ id: 'default', name: 'Model', description: '', color: '#0ea5e9' }]
    const offset = (segments.length - 1) * 0.6 * 0.5
    segments.forEach((segment, index) => {
      const mesh = new Mesh(
        geometry.clone(),
        new MeshStandardMaterial({
          color: new Color(segment.color),
          transparent: true,
          opacity: 0.85,
          roughness: 0.4,
        }),
      )
      mesh.position.set(index * 0.6 - offset, 0, 0)
      mesh.userData.segmentId = segment.id
      group.add(mesh)
    })
    const boundingBox = normalizeGroup(group, model)
    return { status: 'success', group, boundingBox }
  }

  const segmentAssets = model.segments.filter((segment) => segment.assetUrl)
  if (segmentAssets.length) {
    const group = new Group()
    await Promise.all(
      segmentAssets.map(async (segment) => {
        try {
          const objLoader = new OBJLoader()
          const mtlLoader = new MTLLoader()
          let materials
          if (segment.materialUrl) {
            materials = await mtlLoader.loadAsync(segment.materialUrl)
            materials.preload()
          }

          if (materials) {
            objLoader.setMaterials(materials)
          }

          const segmentObject = await objLoader.loadAsync(segment.assetUrl!)

          segmentObject.traverse((child) => {
            if ((child as Mesh).isMesh) {
              const mesh = child as Mesh
              mesh.castShadow = true
              mesh.receiveShadow = true
              mesh.userData.segmentId = segment.id
              const material = mesh.material as MeshStandardMaterial
              if (material && segment.color) {
                material.color = new Color(segment.color)
                material.transparent = true
                material.opacity = segment.visibleByDefault === false ? 0.55 : 0.9
                material.roughness = 0.35
                material.metalness = 0.05
              }
            }
          })

          group.add(segmentObject)
        } catch (error) {
          console.warn(`Failed to load segment ${segment.id}`, error)
        }
      }),
    )

    const boundingBox = normalizeGroup(group, model)
    return { status: 'success', group, boundingBox }
  }

  // Fallback placeholder: generate simple spheres to visualize segments
  const fallbackGroup = new Group()
  const segments = model.segments.length
    ? model.segments
    : [{ id: 'placeholder', name: 'Segment', description: '', color: '#22d3ee' }]
  const offset = (segments.length - 1) * 0.8 * 0.5
  segments.forEach((segment, index) => {
    const geometry = new SphereGeometry(0.4, 32, 32)
    const material = new MeshStandardMaterial({
      color: new Color(segment.color),
      transparent: true,
      opacity: 0.85,
      roughness: 0.4,
    })
    const mesh = new Mesh(geometry, material)
    mesh.position.set(index * 0.8 - offset, 0, index % 2 === 0 ? 0.4 : -0.4)
    mesh.userData.segmentId = segment.id
    fallbackGroup.add(mesh)
  })
  const boundingBox = normalizeGroup(fallbackGroup, model)
  return { status: 'success', group: fallbackGroup, boundingBox }
}

export function applySegmentColors(group: Group, model: AnatomyModel) {
  const segments = model.segments.length
    ? model.segments
    : [{ id: 'placeholder', name: 'Segment', description: '', color: '#22d3ee' }]
  const byId = new Map(segments.map((segment) => [segment.id, segment]))
  const segmentMeshes: Record<string, Mesh[]> = {}

  group.traverse((child) => {
    if ((child as Mesh).isMesh) {
      const mesh = child as Mesh
      const segmentId =
        typeof mesh.userData.segmentId === 'string' ? mesh.userData.segmentId : segments[0].id
      const segment = byId.get(segmentId) ?? segments[0]
      mesh.userData.segmentId = segment.id
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.material = new MeshStandardMaterial({
        color: new Color(segment.color),
        transparent: true,
        opacity: segment.visibleByDefault === false ? 0.55 : 0.85,
        roughness: 0.35,
        metalness: 0.05,
      })
      segmentMeshes[segment.id] = segmentMeshes[segment.id]
        ? [...segmentMeshes[segment.id], mesh]
        : [mesh]
    }
  })

  return segmentMeshes
}

export function computePlaneConstant(boundingBox: Box3, percentage: number) {
  const clamped = Math.min(Math.max(percentage, 0), 100)
  const height = boundingBox.max.y - boundingBox.min.y
  const offset = height * (clamped / 100)
  return boundingBox.max.y - offset
}

function normalizeGroup(group: Group, model: AnatomyModel): Box3 {
  const originalBox = new Box3().setFromObject(group)
  const center = originalBox.getCenter(new Vector3())
  group.position.x -= center.x
  group.position.y -= center.y
  group.position.z -= center.z

  if (model.orientation?.rotation) {
    const [rx = 0, ry = 0, rz = 0] = model.orientation.rotation
    group.rotateX(rx)
    group.rotateY(ry)
    group.rotateZ(rz)
  } else {
    group.rotateY(Math.PI)
  }

  const rotatedBox = new Box3().setFromObject(group)
  const rotatedCenter = rotatedBox.getCenter(new Vector3())
  group.position.x -= rotatedCenter.x
  group.position.y -= rotatedCenter.y
  group.position.z -= rotatedCenter.z

  const normalizedBox = new Box3().setFromObject(group)
  return normalizedBox
}
