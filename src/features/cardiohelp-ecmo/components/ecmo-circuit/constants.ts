import * as THREE from 'three'

// Pure constants shared by the R3F scene and the offline render harness.
// Keep this file free of react/@react-three imports so node scripts can load it.

export const ASSET_ROOT = '/models/cardiohelp-ecmo'
export const PATIENT_ASSET = `${ASSET_ROOT}/patient-femoral-access.glb`
export const CONSOLE_ASSET = `${ASSET_ROOT}/cardiohelp-console.glb`
export const OXYGENATOR_ASSET = `${ASSET_ROOT}/oxygenator.glb`
export const CLAMP_ASSET = `${ASSET_ROOT}/circuit-clamp.glb`
export const SENSOR_ASSET = `${ASSET_ROOT}/hls-sensor-connector.glb`

export const PATIENT_POSITION: [number, number, number] = [-1.35, -0.405, -0.3]
export const PATIENT_SCALE = 0.92
export const FLOOR_Y = -0.72

/**
 * The console GLB's model-local bounding box, measured from `cardiohelp-console.glb`.
 *
 * Held here rather than read at runtime so `layout.ts` stays free of asset loading and the label
 * anchors can be computed in node and in jest. `bedside-scene-geometry.test.ts` reads the GLB's own
 * POSITION accessor and fails if this drifts from the shipped asset.
 */
export const CONSOLE_MODEL_BOUNDS = {
  min: [-0.334, -0.4725, -0.3928],
  max: [0.334, 0.4725, 0.3928],
} as const

/**
 * Where the console stands, and which way up.
 *
 * The B7 console (scripts/cardiohelp-ecmo/build_fidelity_assets.py, owner-approved Gate 1
 * 2026-08-11) is authored upright: base at local −Y, carry hoop at +Y, operated face on +Z. The
 * legacy supplied-scan asset was authored base-up and needed a flip about X ([π, yaw, 0]) to stand;
 * that flip is retired with the asset.
 *
 * Read the render, not the numbers, if you change this. The B5.1 lesson stands: geometric metrics
 * (flat contact area, support span, mass distribution) do not discriminate orientations for a
 * cage-framed unit, and the owner-confirmed render is the arbiter. The offline harness in
 * `scripts/cardiohelp-ecmo/` renders the same placement this scene uses.
 *
 * Order is three.js 'XYZ'. Single source of truth: the runtime scene, the label layout and the
 * offline Blender harness all read this.
 */
export const CONSOLE_PLACEMENT = {
  x: 1.52,
  z: 0.56,
  rotation: [0, -0.35, 0] as [number, number, number],
  scale: 1,
} as const

// Target sits between bed and console but weighted toward the patient: at the
// old dead-center target the patient rendered ~40% smaller than the console
// and sat inside the fog band at the default distance.
export const CAMERA_POSITION: [number, number, number] = [4.15, 2.6, 5.0]
export const CAMERA_TARGET: [number, number, number] = [-0.25, -0.08, 0.05]
export const CAMERA_FOV = 36

/** Tube outer-wall and blood-core radii per limb role. */
export const TUBE_RADII = {
  circuitWall: 0.04,
  circuitCore: 0.026,
  cannulaWall: 0.032,
  cannulaCore: 0.02,
  sweepWall: 0.022,
  sweepCore: 0.013,
  dpc: 0.009,
} as const

/** Curve parameter of each clamp station along its circuit limb ("near patient"). */
export const DRAINAGE_CLAMP_U = 0.18
export const RETURN_CLAMP_U = 0.88

export const PALETTE = {
  background: '#061317',
  floor: '#081b20',
  bedFrame: '#17353b',
  mattress: '#afc9c7',
  tubeWall: '#dfeef0',
  cannulaShaft: '#f2f6f4',
  sweepGas: '#5ed8df',
  dressingFilm: '#dcece8',
  drainageRing: '#5c7897',
  returnVeinRing: '#d85b6b',
  returnArteryRing: '#c62839',
  dpcLine: '#e8ecef',
  pumpHousing: '#e9f1f2',
  rotorRunning: '#71e1e5',
  rotorStopped: '#5f7478',
  holderArm: '#3d5259',
} as const

const VENOUS_BLOOD = new THREE.Color('#4a0e14')
const ARTERIAL_BLOOD = new THREE.Color('#c62839')

/**
 * Blood tint as a function of oxygen saturation (0-1). Dark venous below ~60%,
 * bright arterial at 100%, smooth in between — so drainage blood lightens
 * automatically during recirculation and return blood darkens with a failing
 * oxygenator, straight from engine state.
 */
export function bloodColor(saturation: number): THREE.Color {
  const clamped = Math.min(1, Math.max(0, saturation))
  const t = Math.min(1, Math.max(0, (clamped - 0.6) / 0.4))
  const smooth = t * t * (3 - 2 * t)
  return VENOUS_BLOOD.clone().lerp(ARTERIAL_BLOOD, smooth)
}
