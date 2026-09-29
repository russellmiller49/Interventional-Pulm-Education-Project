import type { BufferGeometry, Matrix4, Mesh, Object3D } from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { resolveModuleAssetUrl } from '@/lib/module-assets'

import { anatomyManifest } from '../../../content/data/generated/anatomy'
import { PLEURAL_ZONE_IDS, type PleuralZoneId } from '../../../content/pleuralZones'
import { lungGeometries } from './lungGeometry'

/**
 * The drawn anatomy the scene shows, from the generated anatomy manifest: the pleural space by
 * region, the ribs, the chest's context and the lung at each of its steps. Drawn meshes are for the
 * eye only; every spatial answer comes from the engine's proxies (plan, section 4.5). Each mesh keeps
 * its world matrix, since the lung's positions are quantised under a node transform, and every
 * surface is in the scan's millimetres (LPS).
 */
export const DRACO_DECODER_PATH = '/draco/'

export interface DrawnMesh {
  readonly name: string
  readonly geometry: BufferGeometry
  readonly matrix: Matrix4
}

export interface AnatomyAssets {
  readonly zones: readonly (DrawnMesh & { readonly zone: PleuralZoneId })[]
  readonly ribs: readonly DrawnMesh[]
  readonly context: readonly DrawnMesh[]
  /** For each lobe, its geometry at every step, index = step. */
  readonly lung: readonly {
    readonly name: string
    readonly steps: readonly BufferGeometry[]
    readonly matrix: Matrix4
  }[]
}

const cache = new Map<string, Promise<GLTF>>()

function loadModel(url: string): Promise<GLTF> {
  const cached = cache.get(url)
  if (cached) return cached
  const decoder = new DRACOLoader()
    .setDecoderPath(resolveModuleAssetUrl(DRACO_DECODER_PATH))
    .setWorkerLimit(1)
  const loader = new GLTFLoader().setDRACOLoader(decoder)
  const promise = loader
    .loadAsync(resolveModuleAssetUrl(url))
    .finally(() => decoder.dispose())
    .catch((error: unknown) => {
      cache.delete(url)
      throw error
    })
  cache.set(url, promise)
  return promise
}

function urlOf(id: string): string {
  const file = anatomyManifest.files.find((entry) => entry.id === id)
  if (!file) throw new Error(`The anatomy manifest has no ${id}`)
  return file.url
}

function meshes(root: Object3D): Mesh[] {
  root.updateMatrixWorld(true)
  const found: Mesh[] = []
  root.traverse((object) => {
    if ((object as Mesh).isMesh) found.push(object as Mesh)
  })
  return found
}

/**
 * The name the file gives the node that carries a mesh. GLTFLoader strips characters such as the
 * colon from object names and keeps the original in `userData.name`; a node with several primitives
 * becomes a group, whose meshes carry no name of their own.
 */
function nodeName(mesh: Mesh): string {
  const own = mesh.userData.name as string | undefined
  const parent = mesh.parent?.userData.name as string | undefined
  return own ?? parent ?? mesh.name
}

export async function loadAnatomyAssets(): Promise<AnatomyAssets> {
  const [space, ribs, context, lung] = await Promise.all(
    ['pleural-space', 'ribs', 'context', 'lung-states'].map((id) => loadModel(urlOf(id))),
  )
  const drawn = (mesh: Mesh): DrawnMesh => ({
    name: nodeName(mesh),
    geometry: mesh.geometry,
    matrix: mesh.matrixWorld.clone(),
  })
  const zones = meshes(space.scene).map((mesh) => {
    const zone = nodeName(mesh).replace(/^zone:/, '')
    if (!PLEURAL_ZONE_IDS.includes(zone as PleuralZoneId))
      throw new Error(`Unknown region in the pleural space: ${zone}`)
    return { ...drawn(mesh), zone: zone as PleuralZoneId }
  })
  const lungMeshes = meshes(lung.scene)
  if (lungMeshes.length === 0) throw new Error('The lung-states file holds no lung')
  const steps =
    anatomyManifest.files.find((entry) => entry.id === 'lung-states')?.morphTargets.length ?? 0
  return {
    zones,
    ribs: meshes(ribs.scene).map(drawn),
    context: meshes(context.scene).map(drawn),
    lung: lungMeshes.map((mesh) => {
      const names = Object.entries(mesh.morphTargetDictionary ?? {})
        .sort(([, a], [, b]) => a - b)
        .map(([name]) => name)
      return {
        name: mesh.name,
        steps: lungGeometries(mesh.geometry, names, steps + 1),
        matrix: mesh.matrixWorld.clone(),
      }
    }),
  }
}
