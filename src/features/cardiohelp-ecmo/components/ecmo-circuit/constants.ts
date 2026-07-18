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

export const CAMERA_POSITION: [number, number, number] = [4.4, 2.75, 5.25]
export const CAMERA_TARGET: [number, number, number] = [0, -0.05, 0.05]
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
