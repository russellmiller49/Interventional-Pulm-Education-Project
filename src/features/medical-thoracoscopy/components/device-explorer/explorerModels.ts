'use client'

import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import { resolveModuleAssetUrl } from '@/lib/module-assets'

import { catalogue } from '../../content/deviceExplorerCatalogue'

/**
 * Loading and preparing an explorer model. The files are Draco-compressed GLBs in the device frame
 * (millimetres, −Z distal along the shaft), decoded by the site's own decoder copy so nothing is
 * fetched from a third party. Each view takes its own copy of a model, with its own materials, so
 * fading a part in the assembly never changes the same part in another view.
 *
 * On load every anchor the kit manifest lists for the model is checked against the file: its
 * recorded position and direction, and where the node actually sits. The explorer places parts by
 * the kit's anchors, so a file whose anchors had drifted would be reported, not silently shown.
 */
export const DRACO_DECODER_PATH = resolveModuleAssetUrl('/draco/')

/** The anchors must equal the kit's; the showcase validator found 0.0 mm. */
export const ANCHOR_TOLERANCE_MM = 0.01

export interface JawRig {
  readonly hinge: THREE.Vector3
  readonly axis: THREE.Vector3
  readonly jaws: readonly {
    readonly node: THREE.Object3D
    readonly restPosition: THREE.Vector3
    readonly restQuaternion: THREE.Quaternion
    /** +1 or −1: the sense that opens this jaw the way the file says it opens. */
    readonly sense: number
  }[]
  /** How far each jaw's origin is from the hinge anchor, in millimetres (0 when built on it). */
  readonly originOffsetMm: number
}

export interface ModelReport {
  readonly id: string
  readonly anchorsChecked: number
  readonly largestAnchorOffsetMm: number
  readonly triangles: number
  readonly meshes: number
  readonly problems: readonly string[]
  readonly jawSenses: readonly { readonly node: string; readonly sense: number }[]
}

export interface PreparedModel {
  readonly id: string
  readonly root: THREE.Object3D
  readonly anchors: ReadonlyMap<string, THREE.Object3D>
  readonly labels: ReadonlyMap<string, THREE.Object3D>
  readonly jaws: JawRig | null
  readonly materials: readonly THREE.Material[]
  /** Bounds in the model's own frame, taken before it is placed. */
  readonly localBox: THREE.Box3
  readonly report: ModelReport
}

/**
 * The name a node had in the file. GLTFLoader strips ':' and '.' from names and keeps the original
 * in `userData.name`, but then merges the node's extras into `userData`, and each device root's
 * extras carry a `name` of their own (the device's title), which replaces it. So the original is
 * trusted only when it sanitises to the node's name.
 */
export function fileName(object: THREE.Object3D): string {
  const original = object.userData.name
  return typeof original === 'string' &&
    THREE.PropertyBinding.sanitizeNodeName(original) === object.name
    ? original
    : object.name
}

/** Whether a node is the one the file named `name`, whatever the loader did to its name. */
export function isNamed(object: THREE.Object3D, name: string): boolean {
  return object.name === THREE.PropertyBinding.sanitizeNodeName(name)
}

function vector(value: unknown): THREE.Vector3 | null {
  return Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === 'number')
    ? new THREE.Vector3(value[0], value[1], value[2])
    : null
}

const baseMaterial = new WeakMap<
  THREE.Material,
  { opacity: number; transparent: boolean; depthWrite: boolean }
>()

function cloneWithOwnMaterials(source: THREE.Object3D): {
  root: THREE.Object3D
  materials: THREE.Material[]
} {
  const root = source.clone(true)
  root.position.set(0, 0, 0)
  root.quaternion.identity()
  root.scale.set(1, 1, 1)
  const copies = new Map<THREE.Material, THREE.Material>()
  const own = (material: THREE.Material) => {
    let copy = copies.get(material)
    if (!copy) {
      copy = material.clone()
      // The cutaway's illustrative paths end on surfaces the distal face also draws; a raster
      // renderer would flicker between the two, so the paths give way where they coincide.
      if (copy.name.startsWith('mt-illustrative')) {
        copy.polygonOffset = true
        copy.polygonOffsetFactor = 1
        copy.polygonOffsetUnits = 1
      }
      baseMaterial.set(copy, {
        opacity: copy.opacity,
        transparent: copy.transparent,
        depthWrite: copy.depthWrite,
      })
      copies.set(material, copy)
    }
    return copy
  }
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material)
  })
  return { root, materials: [...copies.values()] }
}

function checkAnchors(
  id: string,
  kitModelId: string | null,
  anchors: ReadonlyMap<string, THREE.Object3D>,
  problems: string[],
): { checked: number; largest: number } {
  if (kitModelId === null) return { checked: 0, largest: 0 }
  const kit = catalogue.kit[kitModelId]
  if (!kit) {
    problems.push(`${id}: the kit has no model ${kitModelId}`)
    return { checked: 0, largest: 0 }
  }
  let largest = 0
  const expected = Object.entries(kit.anchors) as [
    string,
    { position: readonly number[]; direction: readonly number[] },
  ][]
  for (const [name, anchor] of expected) {
    const node = anchors.get(name)
    if (!node) {
      problems.push(`${id}: anchor ${name} is missing`)
      continue
    }
    const kitPosition = new THREE.Vector3(...(anchor.position as [number, number, number]))
    const kitDirection = new THREE.Vector3(...(anchor.direction as [number, number, number]))
    const recorded = vector(node.userData.position)
    const recordedDirection = vector(node.userData.direction)
    // The node's +Z is the anchor's direction.
    const nodeDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(node.quaternion)
    const offsets = [
      recorded ? recorded.distanceTo(kitPosition) : Infinity,
      node.position.distanceTo(kitPosition),
      recordedDirection ? recordedDirection.distanceTo(kitDirection) : Infinity,
      nodeDirection.distanceTo(kitDirection),
    ]
    const worst = Math.max(...offsets)
    largest = Math.max(largest, worst)
    if (worst > ANCHOR_TOLERANCE_MM) problems.push(`${id}: anchor ${name} differs by ${worst}`)
  }
  return { checked: expected.length, largest }
}

/**
 * The jaws turn about the hinge anchor's axis through its position. Which way is "open" for each
 * jaw is read from the file's own statement on the jaw nodes ("the upper jaw opens toward +Y, the
 * lower toward −Y"), by turning each jaw's centre a little and seeing which way it goes.
 */
function jawRig(
  id: string,
  root: THREE.Object3D,
  anchors: ReadonlyMap<string, THREE.Object3D>,
  problems: string[],
): JawRig | null {
  const nodes = ['jaw.upper', 'jaw.lower'].map((name) => {
    let found: THREE.Object3D | null = null
    root.traverse((object) => {
      if (isNamed(object, name)) found = object
    })
    return found as THREE.Object3D | null
  })
  const hingeNode = anchors.get('jawHinge')
  if (!nodes[0] || !nodes[1] || !hingeNode) return null
  // Only a file that says which way each jaw opens gets a rig; the dissection forceps' draft jaws
  // carry no opening, so they stay closed.
  const says = (node: THREE.Object3D) =>
    /upper jaw opens toward \+Y, the lower toward -Y/.test(String(node.userData.pivot ?? ''))
  if (!says(nodes[0]) || !says(nodes[1])) return null
  const hinge = vector(hingeNode.userData.position) ?? hingeNode.position.clone()
  const axis = (vector(hingeNode.userData.direction) ?? new THREE.Vector3(1, 0, 0)).normalize()
  let originOffsetMm = 0
  const jaws = nodes.map((node, index) => {
    const jaw = node as THREE.Object3D
    if (jaw.parent !== hingeNode.parent) {
      problems.push(`${id}: ${fileName(jaw)} is not beside the hinge anchor`)
    }
    originOffsetMm = Math.max(originOffsetMm, jaw.position.distanceTo(hinge))
    const box = new THREE.Box3()
    jaw.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.geometry.computeBoundingBox()
      if (mesh.geometry.boundingBox) box.union(mesh.geometry.boundingBox)
    })
    const centre = box.getCenter(new THREE.Vector3())
    const rest = centre.clone().applyQuaternion(jaw.quaternion).add(jaw.position)
    const turned = rest
      .clone()
      .sub(hinge)
      .applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, 0.1))
      .add(hinge)
    const wantsUp = index === 0
    const goesUp = turned.y > rest.y
    return {
      node: jaw,
      restPosition: jaw.position.clone(),
      restQuaternion: jaw.quaternion.clone(),
      sense: goesUp === wantsUp ? 1 : -1,
    }
  })
  return { hinge, axis, jaws, originOffsetMm }
}

const turn = new THREE.Quaternion()
const offset = new THREE.Vector3()

/** Turn each jaw about the hinge by `eachDeg` (0 closed), in the sense that opens it. */
export function setJaws(rig: JawRig, eachDeg: number): void {
  for (const jaw of rig.jaws) {
    turn.setFromAxisAngle(rig.axis, THREE.MathUtils.degToRad(eachDeg * jaw.sense))
    offset.copy(jaw.restPosition).sub(rig.hinge).applyQuaternion(turn).add(rig.hinge)
    jaw.node.position.copy(offset)
    jaw.node.quaternion.copy(turn).multiply(jaw.restQuaternion)
  }
}

/** Fade a model; fully visible restores each material exactly as the file had it. */
export function setOpacity(model: PreparedModel, alpha: number): void {
  model.root.visible = alpha > 0.002
  for (const material of model.materials) {
    const base = baseMaterial.get(material)
    if (!base) continue
    const fading = alpha < 0.999
    const transparent = fading || base.transparent
    if (material.transparent !== transparent) {
      material.transparent = transparent
      material.needsUpdate = true
    }
    material.opacity = base.opacity * (fading ? alpha : 1)
    material.depthWrite = fading ? alpha > 0.6 && base.depthWrite : base.depthWrite
  }
}

export function prepareModel(
  scene: THREE.Object3D,
  id: string,
  kitModelId: string | null,
): PreparedModel {
  let source: THREE.Object3D | null = null
  scene.traverse((object) => {
    if (isNamed(object, `device:${id}`)) source = object
  })
  if (!source) throw new Error(`The file for ${id} has no device:${id} root`)
  const { root, materials } = cloneWithOwnMaterials(source)
  const anchors = new Map<string, THREE.Object3D>()
  const labels = new Map<string, THREE.Object3D>()
  let triangles = 0
  let meshes = 0
  root.traverse((object) => {
    const name = fileName(object)
    if (name.startsWith('anchor:')) anchors.set(name.slice('anchor:'.length), object)
    if (name.startsWith('label:')) labels.set(name, object)
    const mesh = object as THREE.Mesh
    if (mesh.isMesh) {
      meshes += 1
      const index = mesh.geometry.index
      triangles += (index ? index.count : mesh.geometry.attributes.position.count) / 3
    }
  })
  const problems: string[] = []
  const { checked, largest } = checkAnchors(id, kitModelId, anchors, problems)
  const jaws = jawRig(id, root, anchors, problems)
  root.updateMatrixWorld(true)
  const localBox = new THREE.Box3().setFromObject(root)
  return {
    id,
    root,
    anchors,
    labels,
    jaws,
    materials,
    localBox,
    report: {
      id,
      anchorsChecked: checked,
      largestAnchorOffsetMm: largest,
      triangles,
      meshes,
      problems,
      jawSenses: jaws
        ? jaws.jaws.map((jaw) => ({ node: fileName(jaw.node), sense: jaw.sense }))
        : [],
    },
  }
}

/** A prepared copy of a model for one view; its materials are released when the view goes. */
export function useExplorerModel(
  id: string,
  url: string,
  kitModelId: string | null,
): PreparedModel {
  const gltf = useGLTF(url, DRACO_DECODER_PATH)
  const model = useMemo(
    () => prepareModel(gltf.scene, id, kitModelId),
    [gltf.scene, id, kitModelId],
  )
  useEffect(
    () => () => {
      for (const material of model.materials) material.dispose()
    },
    [model],
  )
  return model
}

export function preloadExplorerModel(url: string): void {
  useGLTF.preload(url, DRACO_DECODER_PATH)
}

/**
 * Draw one of a model's materials see-through, as it stays whenever the model is shown in full:
 * the cutaway's illustrative channel, so an instrument inside it can be seen. The channel and the
 * instrument's sheath share a diameter; the offset lets the sheath win where the two coincide
 * instead of the two flickering.
 */
export function seeThrough(model: PreparedModel, materialName: string, opacity: number): void {
  for (const material of model.materials) {
    if (material.name !== materialName) continue
    material.transparent = true
    material.opacity = opacity
    material.depthWrite = false
    material.polygonOffset = true
    material.polygonOffsetFactor = 2
    material.polygonOffsetUnits = 2
    material.needsUpdate = true
    baseMaterial.set(material, { opacity, transparent: true, depthWrite: false })
  }
}
