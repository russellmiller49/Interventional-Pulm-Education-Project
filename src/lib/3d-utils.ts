import { useEffect, useMemo, useState } from 'react'
import { Box3, Color, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { NRRDLoader } from 'three/examples/jsm/loaders/NRRDLoader.js'
import type Volume from 'three/examples/jsm/misc/Volume.js'

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

interface SegmentIndex {
  byOriginalId: Map<string, AnatomySegment>
  byNormalizedId: Map<string, AnatomySegment>
  byNormalizedName: Map<string, AnatomySegment>
}

function normalizeSegmentKey(input: string | undefined | null): string {
  if (!input) {
    return ''
  }
  return input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function createSegmentIndex(segments: AnatomySegment[]): SegmentIndex {
  const index: SegmentIndex = {
    byOriginalId: new Map(),
    byNormalizedId: new Map(),
    byNormalizedName: new Map(),
  }
  segments.forEach((segment) => registerSegment(index, segment))
  return index
}

function registerSegment(index: SegmentIndex, segment: AnatomySegment) {
  index.byOriginalId.set(segment.id, segment)
  index.byNormalizedId.set(normalizeSegmentKey(segment.id), segment)
  index.byNormalizedName.set(normalizeSegmentKey(segment.name), segment)
}

function resolveSegmentFromCandidates(
  index: SegmentIndex,
  candidates: string[],
): AnatomySegment | null {
  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }
    const normalized = normalizeSegmentKey(candidate)
    if (index.byOriginalId.has(candidate)) {
      return index.byOriginalId.get(candidate)!
    }
    if (normalized) {
      if (index.byNormalizedId.has(normalized)) {
        return index.byNormalizedId.get(normalized)!
      }
      if (index.byNormalizedName.has(normalized)) {
        return index.byNormalizedName.get(normalized)!
      }
    }
  }
  return null
}

function ensureUniqueSegmentId(index: SegmentIndex, base: string): string {
  const normalizedBase = normalizeSegmentKey(base) || 'segment'
  if (!index.byOriginalId.has(normalizedBase) && !index.byNormalizedId.has(normalizedBase)) {
    return normalizedBase
  }
  let counter = 1
  let candidate = `${normalizedBase}-${counter}`
  while (index.byOriginalId.has(candidate) || index.byNormalizedId.has(candidate)) {
    counter += 1
    candidate = `${normalizedBase}-${counter}`
  }
  return candidate
}

function encodeSupabasePath(path: string): string {
  return path
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function getSupabaseBaseUrl(projectRef?: string): string | null {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (envUrl && envUrl.length > 0) {
    return envUrl.replace(/\/$/, '')
  }
  const ref =
    projectRef ||
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF ||
    process.env.SUPABASE_PROJECT_REF ||
    ''
  if (!ref) {
    return null
  }
  return `https://${ref}.supabase.co`
}

async function resolveVolumeUrl(volume: AnatomyModel['volume']): Promise<string> {
  if (!volume) {
    throw new Error('Volume metadata not provided.')
  }

  if (volume.url && volume.url.length > 0) {
    return volume.url
  }

  if (volume.supabase) {
    const { bucket, path, public: isPublic = true, projectRef } = volume.supabase
    if (!bucket || !path) {
      throw new Error('Supabase storage configuration is incomplete.')
    }

    const baseUrl = getSupabaseBaseUrl(projectRef)
    if (!baseUrl) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PROJECT_REF must be configured to load Supabase volumes.',
      )
    }

    const normalizedPath = encodeSupabasePath(path)

    if (isPublic) {
      return `${baseUrl}/storage/v1/object/public/${bucket}/${normalizedPath}`
    }

    const search = new URLSearchParams({
      bucket,
      path,
    })
    if (projectRef) {
      search.set('projectRef', projectRef)
    }
    const response = await fetch(`/api/storage/signed-url?${search.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      let message = `Unable to establish signed Supabase URL (status ${response.status}).`
      try {
        const payload = await response.json()
        if (payload?.error) {
          message = payload.error
        }
      } catch {
        // ignore
      }
      throw new Error(message)
    }

    const payload = (await response.json()) as { url?: string }
    if (!payload?.url) {
      throw new Error('Signed Supabase URL response did not include a URL.')
    }
    return payload.url
  }

  throw new Error('Volume URL is not defined.')
}

export function useAnatomyAsset(model: AnatomyModel): AnatomyAssetState {
  const [state, setState] = useState<AnatomyAssetState>({ status: 'loading' })
  const assetKey = useMemo(() => {
    const downloadsKey = model.downloads
      .map((download) => `${download.format}:${download.url}`)
      .sort()
      .join('|')
    const orientationKey = model.orientation?.rotation?.join(',') ?? ''
    return `${model.id}|${downloadsKey}|${orientationKey}`
  }, [model.id, model.downloads, model.orientation])
  const assetModel = useMemo(() => model, [model])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState({ status: 'loading' })
      try {
        const asset = await loadModel(assetModel)
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
  }, [assetKey, assetModel])

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
      const segmentIndex = createSegmentIndex(segments)
      const palette = [
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
      let paletteIndex = segments.length % palette.length

      group.traverse((child) => {
        if (!(child as Mesh).isMesh) {
          return
        }
        const mesh = child as Mesh
        mesh.castShadow = true
        mesh.receiveShadow = true

        const candidates = new Set<string>()
        if (typeof mesh.userData.segmentId === 'string') {
          candidates.add(mesh.userData.segmentId)
        }
        if (typeof mesh.userData.segmentLabel === 'string') {
          candidates.add(mesh.userData.segmentLabel)
        }
        if (mesh.name) {
          candidates.add(mesh.name)
        }
        let parent = mesh.parent
        while (parent) {
          if (parent.name) {
            candidates.add(parent.name)
          }
          parent = parent.parent
        }

        let segment = resolveSegmentFromCandidates(segmentIndex, Array.from(candidates))

        if (!segment) {
          const preferredName =
            Array.from(candidates).find((candidate) => normalizeSegmentKey(candidate).length > 0) ??
            mesh.name ??
            `${model.name} segment`
          const newId = ensureUniqueSegmentId(segmentIndex, preferredName)
          const paletteColor = palette[paletteIndex % palette.length]
          paletteIndex += 1
          segment = {
            id: newId,
            name: preferredName,
            description: `Derived from mesh "${mesh.name || preferredName}"`,
            color: paletteColor,
            visibleByDefault: true,
          }
          segments.push(segment)
          registerSegment(segmentIndex, segment)
        }

        mesh.userData.segmentId = segment.id
        mesh.userData.segmentLabel = segment.name

        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        let baseColorHex: string | undefined

        materials.forEach((mat) => {
          if (mat instanceof MeshStandardMaterial) {
            baseColorHex = `#${mat.color.getHexString()}`
          }
        })

        if (!baseColorHex) {
          if (segment.color && segment.color.length > 0) {
            baseColorHex = segment.color
          } else {
            const paletteColor = palette[paletteIndex % palette.length]
            paletteIndex += 1
            baseColorHex = paletteColor
          }
        }

        mesh.userData.baseColor = baseColorHex
        if (!segment.color || segment.color.length === 0) {
          segment.color = baseColorHex
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
  const segmentIndex = createSegmentIndex(baseSegments)
  const segmentMeshes: Record<string, Mesh[]> = {}
  const resolvedColors = new Map<string, string>()
  const palette = [
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
  let paletteIndex = baseSegments.length % palette.length

  group.traverse((child) => {
    if ((child as Mesh).isMesh) {
      const mesh = child as Mesh
      const candidateIds: string[] = []
      if (typeof mesh.userData.segmentId === 'string') {
        candidateIds.push(mesh.userData.segmentId)
      }
      if (typeof mesh.userData.segmentLabel === 'string') {
        candidateIds.push(mesh.userData.segmentLabel)
      }
      const nameCandidates: string[] = []
      if (mesh.name) {
        nameCandidates.push(mesh.name)
      }
      let parent = mesh.parent
      while (parent) {
        if (parent.name) {
          nameCandidates.push(parent.name)
        }
        parent = parent.parent
      }

      let segment =
        resolveSegmentFromCandidates(segmentIndex, candidateIds) ??
        resolveSegmentFromCandidates(segmentIndex, nameCandidates)

      if (!segment) {
        const preferredName =
          candidateIds.find((candidate) => normalizeSegmentKey(candidate).length > 0) ??
          nameCandidates.find((candidate) => normalizeSegmentKey(candidate).length > 0) ??
          mesh.name ??
          `${model.name} segment`
        const newId = ensureUniqueSegmentId(segmentIndex, preferredName)
        const paletteColor = palette[paletteIndex % palette.length]
        paletteIndex += 1
        segment = {
          id: newId,
          name: preferredName,
          description: `Derived from mesh "${mesh.name || preferredName}"`,
          color: paletteColor,
          visibleByDefault: true,
        }
        baseSegments.push(segment)
        registerSegment(segmentIndex, segment)
      }

      mesh.userData.segmentId = segment.id
      mesh.userData.segmentLabel = segment.name
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

  return { meshesBySegment: segmentMeshes, segments: hydratedSegments }
}

export type VolumeAssetState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | {
      status: 'success'
      volume: Volume
      dimensions: [number, number, number]
      spacing: [number, number, number]
      axis: 'x' | 'y' | 'z'
    }

export function useVolumeAsset(model: AnatomyModel): VolumeAssetState {
  const [state, setState] = useState<VolumeAssetState>(() =>
    model.volume ? { status: 'loading' } : { status: 'idle' },
  )

  useEffect(() => {
    let cancelled = false

    if (!model.volume) {
      setState({ status: 'idle' })
      return () => {
        cancelled = true
      }
    }

    if (model.volume.format !== 'nrrd') {
      setState({
        status: 'error',
        error: `Unsupported volume format "${model.volume.format}".`,
      })
      return () => {
        cancelled = true
      }
    }

    const loader = new NRRDLoader()
    setState({ status: 'loading' })

    async function loadVolume() {
      try {
        const sourceUrl = await resolveVolumeUrl(model.volume!)
        if (cancelled) {
          return
        }

        const volume = await loader.loadAsync(sourceUrl)
        if (cancelled) {
          return
        }

        const dims = (volume.RASDimensions as [number, number, number]) ??
          (volume.dimensions as [number, number, number]) ?? [
            volume.xLength,
            volume.yLength,
            volume.zLength,
          ]
        const spacing = (volume.RASSpacing as [number, number, number]) ??
          (volume.spacing as [number, number, number]) ?? [1, 1, 1]

        // Validate dimensions
        if (!dims || dims.some((dim) => !dim || dim <= 0 || !Number.isFinite(dim))) {
          throw new Error(
            `Invalid volume dimensions: ${JSON.stringify(dims)}. Volume may be corrupted or incomplete.`,
          )
        }

        if (model.volume?.window) {
          volume.windowLow = model.volume.window.low
          volume.windowHigh = model.volume.window.high
        } else if (volume.data && 'length' in volume.data && volume.data.length > 0) {
          const data = volume.data as ArrayLike<number>
          let min = Number.POSITIVE_INFINITY
          let max = Number.NEGATIVE_INFINITY
          const sampleStep = Math.max(1, Math.floor(data.length / 75000))
          for (let index = 0; index < data.length; index += sampleStep) {
            const value = Number(data[index])
            if (value < min) {
              min = value
            }
            if (value > max) {
              max = value
            }
          }
          volume.windowLow = min
          volume.windowHigh = max
        }

        volume.lowerThreshold = Number.NEGATIVE_INFINITY
        volume.upperThreshold = Number.POSITIVE_INFINITY

        setState({
          status: 'success',
          volume,
          dimensions: dims,
          spacing,
          axis: model.volume?.axis ?? 'z',
        })
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            error:
              error instanceof Error
                ? error.message
                : 'Unable to load CT volume. Please verify the storage configuration.',
          })
        }
      }
    }

    loadVolume().catch((error) => {
      if (!cancelled) {
        setState({
          status: 'error',
          error:
            error instanceof Error
              ? error.message
              : 'Unable to load CT volume. Please verify the storage configuration.',
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [model])

  return state
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
