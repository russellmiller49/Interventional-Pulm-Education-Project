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
  min: [-0.3179, -0.4745, -0.3658],
  max: [0.3179, 0.4752, 0.3656],
} as const

/**
 * Where the console stands, and which way up.
 *
 * The asset is authored with its base on local +Y, so the flip about X is what puts it on its feet:
 * the tubular frame's lower loop becomes the foot rail, the body stands upright and the carry
 * handle is on top. Without it the unit rests on local −Y — which is its *top* — with the pump
 * drive and connectors facing the sky.
 *
 * The preparation script's `stand_longest_axis` heuristic left the asset alone because the longest
 * dimension (0.950 m) already lay along Y; the heuristic has no way to tell a height from a height
 * that is upside down.
 *
 * Read the render, not the numbers, if you change this. Flat-contact-area and mass-distribution
 * metrics do **not** discriminate the candidates for this asset — it stands on a curved tube rail,
 * so its true base has less flat contact than three of the wrong answers. Six candidate
 * orientations rendered side by side are what settle it. `scripts/cardiohelp-ecmo/` has the
 * harness.
 *
 * Order is three.js 'XYZ', so the flip composes after the yaw. Single source of truth: the runtime
 * scene, the label layout and the offline Blender harness all read this.
 */
export const CONSOLE_PLACEMENT = {
  x: 1.52,
  z: 0.56,
  rotation: [Math.PI, -0.35, 0] as [number, number, number],
  scale: 1,
} as const

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
