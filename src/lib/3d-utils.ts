import { useEffect, useState } from 'react'
import { Box3, Color, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'

import type { AnatomyModel, AnatomySegment } from '@/lib/types'

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
  segments: AnatomySegment[]
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
  const buildDefaultSegments = () =>
    (model.segments.length
      ? model.segments
      : [
          {
            id: 'default',
            name: 'Model',
            description: '',
            color: '#0ea5e9',
            visibleByDefault: true,
          } satisfies AnatomySegment,
        ]
    ).map((segment) => ({ ...segment }))

  if (glbDownload) {
    console.log('Loading GLB model:', glbDownload.url)
    const loader = new GLTFLoader()
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('/draco/')
    loader.setDRACOLoader(dracoLoader)

    try {
      const gltf = await loader.loadAsync(glbDownload.url)
      console.log('GLB loaded successfully:', gltf)
      dracoLoader.dispose()
      const group = gltf.scene
      group.updateMatrixWorld(true)

      // Debug: log scene structure
      console.log('GLB scene structure:', group)
      let meshCount = 0
      if (process.env.NODE_ENV !== 'production') {
        group.traverse((child) => {
          if ((child as Mesh).isMesh) {
            meshCount++
            const mesh = child as Mesh
            console.log(`Mesh ${meshCount}:`, mesh.name, mesh.material)
          }
        })
        console.log(`Total meshes found: ${meshCount}`)
      }

      // Preserve original GLB materials and map to segments
      const segments = buildDefaultSegments()
      const segmentMap = new Map<string, AnatomySegment>()
      segments.forEach((segment) => {
        segmentMap.set(segment.id, segment)
      })

      group.traverse((child) => {
        if ((child as Mesh).isMesh) {
          const mesh = child as Mesh

          // Map mesh name to segment ID
          let segmentId = segments[0].id
          const nameParts = [mesh.name, mesh.parent?.name, mesh.parent?.parent?.name]
            .filter((value): value is string => Boolean(value))
            .join(' ')
            .toLowerCase()

          const meshName = nameParts || mesh.name.toLowerCase()

          if (meshName.includes('airway') || meshName.includes('trachea')) segmentId = 'airway'
          else if (meshName.includes('aorta')) segmentId = 'aorta'
          else if (meshName.includes('arteries')) segmentId = 'arteries'
          else if (meshName.includes('central_pulmonary_artery'))
            segmentId = 'central_pulmonary_artery'
          else if (meshName.includes('esophagus')) segmentId = 'esophagus'
          else if (meshName.includes('heart')) segmentId = 'heart'
          else if (meshName.includes('left upper lobe')) segmentId = 'left_upper_lobe'
          else if (meshName.includes('left lower lobe')) segmentId = 'left_lower_lobe'
          else if (meshName.includes('right upper lobe')) segmentId = 'right_upper_lobe'
          else if (meshName.includes('right middle lobe')) segmentId = 'right_middle_lobe'
          else if (meshName.includes('right lower lobe')) segmentId = 'right_lower_lobe'
          else if (meshName.includes('lungs') || meshName.includes('lung')) segmentId = 'lungs'
          else if (meshName.includes('lymphn_nodes') || meshName.includes('lymph nodes'))
            segmentId = 'lymphn_nodes'
          else if (meshName.includes('node_labels') || meshName.includes('node labels'))
            segmentId = 'node_labels'
          else if (
            meshName.includes('peripheral blood vessels') ||
            meshName.includes('peripheral_blood_vessels')
          )
            segmentId = 'peripheral_blood_vessels'
          else if (meshName.includes('pulmonary artery') || meshName.includes('pulmonary_artery'))
            segmentId = 'pulmonary_artery'
          else if (
            meshName.includes('pulmonary venous system') ||
            meshName.includes('pulmonary_venous_system')
          )
            segmentId = 'pulmonary_venous_system'
          else if (meshName.includes('thyroid')) segmentId = 'thyroid'
          else if (meshName.includes('veins')) segmentId = 'veins'
          else if (meshName.includes('stent')) segmentId = 'stent'
          else if (meshName.includes('stenosis')) segmentId = 'stenosis'
          else if (meshName.includes('fistula')) segmentId = 'fistula'
          else if (meshName.includes('airway_stent')) segmentId = 'airway_stent'
          else if (meshName.includes('airway_fistula')) segmentId = 'airway_fistula'

          if (segmentId === segments[0].id && !segmentMap.has(segmentId)) {
            const newSegmentId = meshName.replace(/[^a-z0-9]/g, '_')
            if (!segmentMap.has(newSegmentId)) {
              const colors = [
                '#ff6b6b',
                '#4ecdc4',
                '#45b7d1',
                '#96ceb4',
                '#feca57',
                '#ff9ff3',
                '#54a0ff',
                '#5f27cd',
                '#00d2d3',
                '#ff9f43',
                '#a55eea',
                '#26de81',
                '#fd79a8',
                '#fdcb6e',
                '#6c5ce7',
              ]
              const colorIndex = Array.from(segmentMap.keys()).length % colors.length
              const newSegment = {
                id: newSegmentId,
                name: mesh.name,
                description: `Mesh: ${mesh.name}`,
                color: colors[colorIndex],
                visibleByDefault: true,
              }
              segmentMap.set(newSegmentId, newSegment)
              segments.push(newSegment)
              console.log(`Created new segment for unmapped mesh: ${mesh.name} -> ${newSegmentId}`)
            }
            segmentId = newSegmentId
          }

          console.log(`Mapped mesh "${mesh.name}" to segment "${segmentId}"`)

          mesh.userData.segmentId = segmentId
          mesh.castShadow = true
          mesh.receiveShadow = true

          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          const segment = segmentMap.get(segmentId) || segments[0]

          let baseColorHex: string | undefined
          materials.forEach((mat) => {
            if (mat instanceof MeshStandardMaterial) {
              baseColorHex = `#${mat.color.getHexString()}`
            }
          })

          if (!baseColorHex) {
            baseColorHex = segment.color ?? '#22d3ee'
          }

          mesh.userData.baseColor = baseColorHex
          if (!segment.color || segment.color.length === 0) {
            segment.color = baseColorHex
          }
        }
      })

      const boundingBox = normalizeGroup(group, model)
      console.log('GLB bounding box:', boundingBox)

      // Auto-fit camera to bounding box
      const size = boundingBox.getSize(new Vector3())
      const center = boundingBox.getCenter(new Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const distance = Math.max(maxDim * 4.5, maxDim + 1.5)

      console.log('Model size:', size)
      console.log('Max dimension:', maxDim)
      console.log('Auto-calculated camera position:', [distance, distance, distance])
      console.log('Model center:', center)

      const resolvedSegments = segments.map((segment) => ({
        ...segment,
        color: meshCount > 0 && segment.color ? segment.color : (segment.color ?? '#22d3ee'),
      }))
      group.userData.segments = resolvedSegments
      return { status: 'success', group, boundingBox, segments: resolvedSegments }
    } catch (error) {
      console.error('GLB loading error:', error)
      throw error
    }
  }

  if (stlDownload) {
    const loader = new STLLoader()
    const geometry = await loader.loadAsync(stlDownload.url)
    const group = new Group()
    const segments = buildDefaultSegments()
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
    return { status: 'success', group, boundingBox, segments }
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
    return { status: 'success', group, boundingBox, segments: buildDefaultSegments() }
  }

  // Fallback placeholder: generate simple spheres to visualize segments
  const fallbackGroup = new Group()
  const segments = buildDefaultSegments()
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
  return { status: 'success', group: fallbackGroup, boundingBox, segments }
}

export function applySegmentColors(
  group: Group,
  model: AnatomyModel,
): { meshesBySegment: Record<string, Mesh[]>; segments: AnatomySegment[] } {
  const baseSegments = (
    model.segments.length
      ? model.segments
      : [
          {
            id: 'placeholder',
            name: 'Segment',
            description: '',
            color: '#22d3ee',
            visibleByDefault: true,
          } satisfies AnatomySegment,
        ]
  ).map((segment) => ({ ...segment }))
  const byId = new Map(baseSegments.map((segment) => [segment.id, segment]))
  const segmentMeshes: Record<string, Mesh[]> = {}
  const resolvedColors = new Map<string, string>()
  const ensureSegment = (segment: AnatomySegment) => {
    if (!byId.has(segment.id)) {
      byId.set(segment.id, segment)
      baseSegments.push(segment)
    }
  }

  group.traverse((child) => {
    if ((child as Mesh).isMesh) {
      const mesh = child as Mesh
      let segmentId =
        typeof mesh.userData.segmentId === 'string' ? mesh.userData.segmentId : baseSegments[0].id
      if (!byId.has(segmentId)) {
        segmentId = baseSegments[0].id
      }
      const segment = byId.get(segmentId) ?? baseSegments[0]
      mesh.userData.segmentId = segment.id
      mesh.castShadow = true
      mesh.receiveShadow = true

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const clonedMaterials = materials.map((material) => {
        if (material && typeof (material as MeshStandardMaterial).clone === 'function') {
          const cloned = (material as MeshStandardMaterial).clone()
          const baseColorHex =
            typeof mesh.userData.baseColor === 'string'
              ? mesh.userData.baseColor
              : `#${cloned.color.getHexString()}`
          const baseColor = new Color(baseColorHex)
          cloned.color.copy(baseColor)
          cloned.emissive.copy(new Color('#000000'))
          cloned.emissiveIntensity = 0.0
          cloned.transparent = true
          cloned.opacity =
            segment.visibleByDefault === false
              ? Math.min(cloned.opacity ?? 0.55, 0.55)
              : Math.max(cloned.opacity ?? 0.95, 0.9)
          cloned.roughness = cloned.roughness ?? 0.4
          cloned.metalness = cloned.metalness ?? 0.05
          cloned.needsUpdate = true
          resolvedColors.set(segment.id, `#${cloned.color.getHexString()}`)
          return cloned
        }

        const fallbackBase =
          typeof mesh.userData.baseColor === 'string'
            ? new Color(mesh.userData.baseColor)
            : new Color(segment.color ?? '#22d3ee')
        resolvedColors.set(segment.id, `#${fallbackBase.getHexString()}`)

        return new MeshStandardMaterial({
          color: fallbackBase,
          transparent: true,
          opacity: segment.visibleByDefault === false ? 0.55 : 0.9,
          roughness: 0.4,
          metalness: 0.05,
        })
      })

      mesh.material = Array.isArray(mesh.material) ? clonedMaterials : clonedMaterials[0]

      segmentMeshes[segment.id] = segmentMeshes[segment.id]
        ? [...segmentMeshes[segment.id], mesh]
        : [mesh]
    }
  })

  const hydratedSegments = baseSegments.map((segment) => {
    const resolved = resolvedColors.get(segment.id) ?? segment.color ?? '#22d3ee'
    const normalized = resolved.startsWith('#') ? resolved : `#${resolved}`
    return {
      ...segment,
      color: normalized,
    }
  })
  hydratedSegments.forEach((segment) => ensureSegment(segment))

  return { meshesBySegment: segmentMeshes, segments: hydratedSegments }
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
