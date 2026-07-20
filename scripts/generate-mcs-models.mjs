import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

class NodeFileReader {
  result = null
  onloadend = null
  onerror = null

  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result
      this.onloadend?.({ target: this })
    }).catch((error) => this.onerror?.(error))
  }

  readAsDataURL(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`
      this.onloadend?.({ target: this })
    }).catch((error) => this.onerror?.(error))
  }
}

globalThis.FileReader = NodeFileReader

const root = resolve('public/models/mechanical-circulatory-support')
const exporter = new GLTFExporter()

const material = (name, color, options = {}) => new THREE.MeshStandardMaterial({
  name,
  color,
  roughness: 0.52,
  metalness: 0.08,
  ...options,
})

const tissue = material('Cutaway tissue', 0xa84654, { transparent: true, opacity: 0.3, side: THREE.DoubleSide })
const arterial = material('Arterial path', 0xd65b68)
const venous = material('Venous path', 0x4d83ac)
const polymer = material('Neutral device polymer', 0xc4cbd0, { metalness: 0.3, roughness: 0.32 })
const darkPolymer = material('Neutral dark polymer', 0x35434a, { metalness: 0.4, roughness: 0.28 })
const balloonMaterial = material('Balloon membrane', 0xe9b962, { transparent: true, opacity: 0.72, roughness: 0.3 })

function mesh(geometry, meshMaterial, name, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, meshMaterial)
  object.name = name
  object.position.set(...position)
  object.scale.set(...scale)
  object.rotation.set(...rotation)
  object.castShadow = true
  object.receiveShadow = true
  return object
}

function tube(name, points, radius, meshMaterial) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)))
  return mesh(new THREE.TubeGeometry(curve, 44, radius, 10, false), meshMaterial, name, [0, 0, 0])
}

function anatomyScene() {
  const scene = new THREE.Scene()
  scene.name = 'MCS_Cutaway_Anatomy'
  scene.add(mesh(new THREE.SphereGeometry(1, 28, 20), tissue, 'HeartCutaway', [0, 0, 0], [1.12, 1.32, 0.84], [0, 0, -0.18]))
  scene.add(mesh(new THREE.SphereGeometry(0.58, 24, 18), arterial, 'LeftVentricle', [0.25, -0.12, 0.08], [0.72, 1.18, 0.62], [0, 0, -0.1]))
  scene.add(mesh(new THREE.SphereGeometry(0.48, 24, 18), venous, 'RightVentricle', [-0.46, -0.18, 0.16], [0.7, 1.05, 0.5], [0, 0, 0.14]))
  scene.add(tube('Aorta', [[0.25, 0.55, 0], [0.34, 1.05, 0], [0.18, 1.55, 0], [-0.35, 1.78, 0], [-0.78, 1.52, 0], [-0.83, 0.55, 0]], 0.18, arterial))
  scene.add(tube('PulmonaryArtery', [[-0.32, 0.42, 0.1], [-0.38, 0.92, 0.12], [-0.9, 1.08, 0.08]], 0.13, venous))
  scene.add(mesh(new THREE.TorusGeometry(0.19, 0.035, 12, 32), polymer, 'AorticValve', [0.25, 0.56, 0], [1, 1, 1], [Math.PI / 2, 0, 0]))
  return scene
}

function iabpScene() {
  const scene = new THREE.Scene()
  scene.name = 'Neutral_IABP_Path'
  scene.add(tube('IABPCatheter', [[-1.02, -1.8, 0.02], [-0.87, -0.5, 0.02], [-0.83, 0.72, 0.01], [-0.62, 1.45, 0]], 0.025, darkPolymer))
  scene.add(mesh(new THREE.CapsuleGeometry(0.105, 0.86, 8, 16), balloonMaterial, 'IABPBalloon', [-0.72, 0.83, 0], [1, 1, 1], [0, 0, -0.04]))
  return scene
}

function impellaScene() {
  const scene = new THREE.Scene()
  scene.name = 'Neutral_Transvalvular_Path'
  scene.add(tube('ImpellaCatheter', [[-1.2, -1.8, 0.02], [-0.78, -0.82, 0.04], [-0.2, -0.12, 0.05], [0.25, 0.55, 0], [0.34, 1.02, 0]], 0.027, darkPolymer))
  scene.add(mesh(new THREE.CapsuleGeometry(0.075, 0.42, 8, 16), polymer, 'ImpellaMotor', [0.25, 0.39, 0], [1, 1, 1], [0, 0, 0.02]))
  scene.add(mesh(new THREE.ConeGeometry(0.11, 0.2, 18), arterial, 'ImpellaOutlet', [0.34, 0.83, 0], [1, 1, 1], [0, 0, Math.PI]))
  return scene
}

function lvadScene() {
  const scene = new THREE.Scene()
  scene.name = 'Neutral_Durable_LVAD_Path'
  scene.add(mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.34, 28), darkPolymer, 'LVADPump', [0.15, -1.23, 0.08], [1, 1, 1], [Math.PI / 2, 0, 0]))
  scene.add(tube('LVADInflow', [[0.22, -0.72, 0.05], [0.18, -0.98, 0.06], [0.15, -1.2, 0.08]], 0.09, polymer))
  scene.add(tube('LVADOutflow', [[0.22, -1.2, 0.08], [0.78, -0.72, 0.02], [0.8, 0.12, 0], [0.45, 1.22, 0]], 0.075, polymer))
  scene.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 24), arterial, 'LVADRotor', [0.15, -1.23, 0.08], [1, 1, 1], [Math.PI / 2, 0, 0]))
  return scene
}

async function exportBinary(scene, filename) {
  const output = await exporter.parseAsync(scene, { binary: true, onlyVisible: true })
  const path = resolve(root, filename)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, Buffer.from(output))
}

await Promise.all([
  exportBinary(anatomyScene(), 'cutaway-heart-aorta.glb'),
  exportBinary(iabpScene(), 'iabp-path.glb'),
  exportBinary(impellaScene(), 'impella-path.glb'),
  exportBinary(lvadScene(), 'lvad-path.glb'),
])
