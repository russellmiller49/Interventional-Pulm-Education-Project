import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { AcousticVolume } from '@bronchoscopy-core/acoustic'
import { simulatorCaseAssetUrl } from '../features/simulator/paths'
import {
  cephalicImageAxis,
  resolveScopeFrame,
  resolveCalibratedOpticalAxis,
  type SimulatorProbePose,
} from '../features/simulator/pose'
import type { SimulatorEndoscopeCamera } from '../features/simulator/types'

export interface TeachingAssetManifest {
  version: string
  sourceGeometrySha256: string
  acousticDataSha256: string
  centerlineSha256: string
  presetManifestSha256: string
  assets: { path: string; sha256: string; bytes: number }[]
}
export interface LinkedModels {
  manifest: TeachingAssetManifest
  anatomy: THREE.Group
  nodes: THREE.Group
  scope: THREE.Group
  regions: THREE.Group
}
const root = 'models/guided-v1/'
const hash = async (data: ArrayBuffer) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
const pending = new Map<string, Promise<LinkedModels>>()
async function bytes(path: string) {
  const response = await fetch(simulatorCaseAssetUrl(path))
  if (!response.ok)
    throw new Error('A linked teaching asset could not be loaded. Retry the workbench.')
  return response.arrayBuffer()
}
export function loadLinkedModels(volume: AcousticVolume): Promise<LinkedModels> {
  const key = volume.metadata.sourceGeometrySha256
  if (!pending.has(key))
    pending.set(
      key,
      (async () => {
        const manifest = JSON.parse(
          new TextDecoder().decode(await bytes(root + 'asset-manifest.json')),
        ) as TeachingAssetManifest
        if (
          manifest.sourceGeometrySha256 !== key ||
          manifest.acousticDataSha256 !== volume.metadata.dataSha256
        )
          throw new Error('The teaching models and ultrasound anatomy have different revisions.')
        const dependencies = await Promise.all(
          ['geometry/centerlines.json', 'case_manifest.simplified.web.json'].map(bytes),
        )
        if (
          (await hash(dependencies[0])) !== manifest.centerlineSha256 ||
          (await hash(dependencies[1])) !== manifest.presetManifestSha256
        )
          throw new Error('The model calibration has changed. Rebuild the linked teaching assets.')
        const loader = new GLTFLoader()
        const names = [
          'mediastinum-teaching.glb',
          'node-examples.glb',
          'ebus-scope-teaching.glb',
          'station-regions.review.glb',
        ]
        const groups = await Promise.all(
          names.map(async (name) => {
            const record = manifest.assets.find((a) => a.path === name)
            const data = await bytes(root + name)
            if (!record || data.byteLength !== record.bytes || (await hash(data)) !== record.sha256)
              throw new Error('A teaching model failed its integrity check.')
            return (await loader.parseAsync(data, '')).scene
          }),
        )
        return {
          manifest,
          anatomy: groups[0],
          nodes: groups[1],
          scope: groups[2],
          regions: groups[3],
        }
      })().catch((error) => {
        pending.delete(key)
        throw error
      }),
    )
  return pending.get(key)!
}

/** The new GLB has the old anchor baked to zero; it receives the old basis exactly once. */
export function teachingScopeMatrix(pose: SimulatorProbePose, atOrigin = false) {
  const x = cephalicImageAxis(pose).normalize()
  const y = pose.depthAxis.clone().normalize()
  const z = new THREE.Vector3().crossVectors(x, y).normalize()
  return new THREE.Matrix4()
    .makeBasis(x, y, z)
    .setPosition(atOrigin ? new THREE.Vector3() : pose.position)
}
export function opticalRay(pose: SimulatorProbePose, camera: SimulatorEndoscopeCamera) {
  const frame = resolveScopeFrame(pose)
  return {
    origin: frame.position
      .clone()
      .addScaledVector(frame.shaftAxis, camera.eye_offset_mm.shaft)
      .addScaledVector(frame.depthAxis, camera.eye_offset_mm.depth)
      .addScaledVector(frame.lateralAxis, camera.eye_offset_mm.lateral),
    direction: resolveCalibratedOpticalAxis(frame, camera),
  }
}
