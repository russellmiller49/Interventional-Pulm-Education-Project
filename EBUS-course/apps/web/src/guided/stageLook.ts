import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * The shared look of the guided course's 3D views: studio light, tone mapping, one palette, and a
 * shell material for context structures.
 *
 * The same setup as the EUS-B simulator (`EusAnatomyScene`), so the guided labs and the simulator
 * read as one instrument. Presentation only: nothing here touches a pose, a plane or evidence.
 */
export const STAGE_PALETTE = {
  airway: '#e6beb0',
  esophagus: '#c9a27e',
  artery: '#d8625c',
  vein: '#6d93d6',
  /** Every lymph node, in every lab. The target is marked by an outline, not a different hue. */
  node: '#c9d36a',
  scanPlane: '#5fe0e6',
  selection: '#5a2d86',
  hover: '#1e6360',
} as const

/** Tone mapping, pixel ratio and image-based light. Returns what to dispose with the scene. */
export function applyStageLighting(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): () => void {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  const pmrem = new THREE.PMREMGenerator(renderer)
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
  scene.environment = environment
  scene.environmentIntensity = 0.5
  const hemisphere = new THREE.HemisphereLight(0xeaf2f8, 0x1c252b, 0.55)
  scene.add(hemisphere)
  // The key and fill travel with the camera, so the side being looked at is always lit.
  const key = new THREE.DirectionalLight(0xfff4e6, 1.7)
  key.position.set(-0.45, 0.7, 1)
  const fill = new THREE.DirectionalLight(0x9fc7ff, 0.45)
  fill.position.set(0.9, -0.5, 0.4)
  camera.add(key, fill)
  scene.add(camera)
  return () => {
    environment.dispose()
    camera.remove(key, fill)
    scene.remove(hemisphere, camera)
  }
}

interface ShellUniforms {
  uFace: { value: number }
  uRim: { value: number }
}

/**
 * Lets a standard material be drawn as a shell: thin where it faces the viewer, firmer at its
 * silhouette. A structure in front of the target then reads as an outline instead of a haze, and
 * the same material goes back to an opaque surface by setting both values to 1.
 */
export function installShell(material: THREE.MeshStandardMaterial): void {
  if (material.userData.shell) return
  const uniforms: ShellUniforms = { uFace: { value: 1 }, uRim: { value: 1 } }
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFace;\nuniform float uRim;')
      .replace(
        '#include <opaque_fragment>',
        `float stageFacing = abs(dot(normalize(normal), normalize(vViewPosition)));
        diffuseColor.a *= mix(uRim, uFace, pow(stageFacing, 0.7));
        #include <opaque_fragment>`,
      )
  }
  material.userData.shell = uniforms
}

/** Opaque surface (`face` 1) or shell. Safe to call every frame; it only writes what changed. */
export function setShell(material: THREE.MeshStandardMaterial, face: number, rim = 1): void {
  const uniforms = material.userData.shell as ShellUniforms | undefined
  if (!uniforms) return
  const opaque = face >= 1 && rim >= 1
  uniforms.uFace.value = face
  uniforms.uRim.value = rim
  if (material.transparent === opaque) {
    material.transparent = !opaque
    material.needsUpdate = true
  }
  material.depthWrite = opaque
  material.opacity = 1
  // Front faces only: a shell's far wall would double the tint over whatever is behind it.
  material.side = THREE.FrontSide
}
