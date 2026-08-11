import * as THREE from 'three'

import type { SupportMode } from '../../engine/types'
import {
  BLENDER_MODEL_BOUNDS,
  BLENDER_OUTLET_LOCAL,
  BLENDER_PLACEMENT,
  CONSOLE_MODEL_BOUNDS,
  CONSOLE_PLACEMENT,
  DRAINAGE_CLAMP_U,
  FLOOR_Y,
  PATIENT_POSITION,
  PATIENT_SCALE,
  RETURN_CLAMP_U,
} from './constants'
import { groundAsset } from './grounding'

// Pure scene geometry: every curve, anchor, and label position for the bedside
// scene, derived from patient-local anchors so the runtime scene and the
// offline Blender preview harness share one source of truth. No react and no
// @react-three imports — node scripts import this file directly.

export interface CircuitLabel {
  id: string
  text: string
  position: THREE.Vector3
}

export interface AccessSite {
  position: THREE.Vector3
  ringColorKey: 'drainageRing' | 'returnVeinRing' | 'returnArteryRing'
  site: 'drainage' | 'return'
}

export interface CircuitLayout {
  supportMode: SupportMode
  drainageInsertion: THREE.Vector3
  returnInsertion: THREE.Vector3
  drainageSite: AccessSite
  returnSite: AccessSite
  drainageCannula: THREE.CatmullRomCurve3
  returnCannula: THREE.CatmullRomCurve3
  drainageLine: THREE.CatmullRomCurve3
  returnLine: THREE.CatmullRomCurve3
  sweepLine: THREE.CatmullRomCurve3
  /** VA only: distal perfusion catheter teeing off the return limb, directed caudally. */
  dpc: THREE.CatmullRomCurve3 | null
  drainageClampU: number
  returnClampU: number
  hlsModulePosition: THREE.Vector3
  pumpInlet: THREE.Vector3
  oxygenatorOutlet: THREE.Vector3
  sensorPosition: THREE.Vector3
  sensorTangent: THREE.Vector3
  /** World box the grounded, rotated console occupies. Labels and the holder arm derive from it. */
  consoleOrigin: THREE.Vector3
  consoleBounds: THREE.Box3
  /** Where the HLS holder arm meets the console, on its upper body rather than in mid-air. */
  consoleHolderAnchor: THREE.Vector3
  labels: readonly CircuitLabel[]
}

/**
 * The console, stood up and grounded once for the whole scene.
 *
 * Derived rather than authored: the label anchors and the holder arm all hang off these numbers, so
 * changing the placement moves them together instead of leaving a label floating over empty floor.
 */
export const consolePlacement = groundAsset(CONSOLE_MODEL_BOUNDS, CONSOLE_PLACEMENT, FLOOR_Y)

/** The sweep-gas blender, grounded like the console. */
export const blenderPlacement = groundAsset(BLENDER_MODEL_BOUNDS, BLENDER_PLACEMENT, FLOOR_Y)

/** World position of the blender's mixed-gas outlet stub — the sweep line origin. */
export const blenderOutlet = new THREE.Vector3(...BLENDER_OUTLET_LOCAL)
  .applyEuler(new THREE.Euler(...BLENDER_PLACEMENT.rotation))
  .multiplyScalar(BLENDER_PLACEMENT.scale)
  .add(blenderPlacement.origin)

export function patientWorldPoint(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(
    PATIENT_POSITION[0] + x * PATIENT_SCALE,
    PATIENT_POSITION[1] + y * PATIENT_SCALE,
    PATIENT_POSITION[2] + z * PATIENT_SCALE,
  )
}

const vec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

// Patient-local access anchors. The right groin carries the return access:
// vein for VV, artery (lateral to the vein, per NAVL) for VA.
//
// The y values are raycast-measured skin-surface heights of the B7 mannequin
// (build_fidelity_assets.py prints them) plus ~4 mm so the runtime dressing
// film sits proud of the skin. The previous anchors (y 0.258–0.265) were
// authored to the old drape-window height, 0.16 m above even the old skin —
// which is why cannula tips, dressing rings and the DPC visibly floated.
const GROIN_VEIN_LEFT = patientWorldPoint(-0.135, 0.102, 0.09)
const GROIN_VEIN_RIGHT = patientWorldPoint(0.135, 0.103, 0.09)
const GROIN_ARTERY_RIGHT = patientWorldPoint(0.175, 0.068, 0.055)
const DPC_ENTRY = patientWorldPoint(0.165, 0.075, 0.125)

// Line hubs where cannulas meet circuit tubing, on the near bed edge.
const DRAINAGE_HUB = vec(-0.73, -0.08, 0.08)
const RETURN_HUB = vec(-0.71, -0.1, -0.13)

// Integrated HLS module (pump head under oxygenator) on the console holder.
// Positioned within holder-arm reach of the console's module-facing side
// (the B7 console's holder plate faces −X/−Z under its −0.35 yaw); the old
// (0.9, −0.05, 0.3) sat 0.65 m from the console body, so the disposable read
// as floating on a pedestal in mid-air rather than carried by the console.
const HLS_MODULE = vec(0.92, -0.05, 0.33)
const PUMP_INLET = vec(0.92, -0.3, 0.37)
const OXYGENATOR_OUTLET = vec(0.78, 0.1, 0.23)
// The sweep line now leaves a MODELED gas source: the pole-mounted air/O2
// blender's outlet stub (see BLENDER_PLACEMENT). Its floor-origin predecessor
// existed only because nothing represented the source.
const SWEEP_CAP = vec(0.95, 0.24, 0.44)

function curve(points: THREE.Vector3[]): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5)
}

export function buildCircuitLayout(supportMode: SupportMode): CircuitLayout {
  const drainageInsertion = GROIN_VEIN_LEFT
  const returnInsertion = supportMode === 'va' ? GROIN_ARTERY_RIGHT : GROIN_VEIN_RIGHT

  // Owner-approved re-route (B7 follow-up): both cannulae used to rise from
  // the groin and cross in an X over the abdomen on their way to the hubs.
  // The drainage limb now runs caudally over the drape and crosses low over
  // the legs; the return limb hugs the near bed edge at flank level. Heights
  // sit ~3-5 cm above the measured drape/leg surfaces.
  const drainageCannula = curve([
    drainageInsertion,
    vec(-1.44, -0.24, 0.05),
    vec(-1.28, -0.28, 0.35),
    vec(-1.0, -0.3, 0.45),
    vec(-0.8, -0.2, 0.3),
    DRAINAGE_HUB,
  ])
  const returnCannula = curve([
    RETURN_HUB,
    vec(-0.85, -0.22, -0.24),
    vec(-1.05, -0.3, -0.26),
    returnInsertion,
  ])

  const drainageLine = curve([
    DRAINAGE_HUB,
    vec(-0.5, 0.02, 0.28),
    vec(-0.16, 0.1, 0.46),
    vec(0.3, -0.02, 0.44),
    vec(0.68, -0.22, 0.4),
    PUMP_INLET,
  ])
  const returnLine = curve([
    OXYGENATOR_OUTLET,
    vec(0.98, 0.16, -0.02),
    vec(1.24, 0.02, -0.3),
    vec(0.6, -0.06, -0.52),
    vec(-0.14, 0.0, -0.4),
    vec(-0.5, -0.05, -0.26),
    RETURN_HUB,
  ])
  // From the blender outlet, drooping toward the floor and rounding the
  // console's near corner (never through its oriented box) up to the
  // oxygenator's sweep cap.
  const sweepLine = curve([
    blenderOutlet.clone(),
    vec(2.0, -0.3, 1.25),
    vec(1.4, -0.55, 1.25),
    vec(0.95, -0.3, 0.85),
    vec(0.8, -0.02, 0.55),
    SWEEP_CAP,
  ])

  // DPC path lies ON the drape over the thigh: each y is the measured skin
  // surface plus the drape's ~25 mm and the catheter's ~12 mm clearance.
  // Hugging bare skin would slide the line UNDER the drape sheet, which
  // renders as the catheter piercing the cloth at the window rim.
  const dpc =
    supportMode === 'va'
      ? curve([
          DPC_ENTRY,
          patientWorldPoint(0.155, 0.133, 0.22),
          patientWorldPoint(0.14, 0.119, 0.34),
          patientWorldPoint(0.132, 0.107, 0.43),
          patientWorldPoint(0.15, 0.099, 0.46),
          patientWorldPoint(0.165, 0.092, 0.43),
        ])
      : null

  const sensorU = 0.12
  const sensorPosition = returnLine.getPointAt(sensorU)
  const sensorTangent = returnLine.getTangentAt(sensorU).normalize()

  // Label anchors fan out around the objects they name. At the default camera
  // the old offsets stacked five pills over the groin and two over the HLS
  // module (owner screenshots, B7); each label now takes its own quadrant —
  // sites toward the feet-left / head-right, clamps split head/feet side,
  // module and sensor vertically separated — while staying adjacent to its
  // object after modest orbiting.
  const labels: CircuitLabel[] = [
    {
      id: 'drainage-site',
      text: 'Femoral vein — drainage',
      position: drainageInsertion.clone().add(vec(-0.42, -0.06, 0.52)),
    },
    {
      id: 'return-site',
      text:
        supportMode === 'va'
          ? 'Femoral artery — return'
          : 'Femoral vein — return · tip toward right atrium',
      position: returnInsertion.clone().add(vec(0.16, -0.26, -0.72)),
    },
    ...(supportMode === 'va'
      ? [
          {
            id: 'dpc',
            text: 'Distal perfusion catheter',
            position: DPC_ENTRY.clone().add(vec(0.24, 0.0, 0.42)),
          },
        ]
      : []),
    {
      id: 'drainage-clamp',
      text: 'Drainage clamp',
      position: drainageLine
        .getPointAt(DRAINAGE_CLAMP_U)
        .clone()
        .add(vec(0.05, 0.34, 0.3)),
    },
    {
      id: 'return-clamp',
      text: 'Return clamp',
      position: returnLine
        .getPointAt(RETURN_CLAMP_U)
        .clone()
        .add(vec(-0.1, 0.62, -0.35)),
    },
    {
      id: 'hls-module',
      text: 'HLS module — pump + oxygenator',
      position: HLS_MODULE.clone().add(vec(-0.1, 0.72, 0.05)),
    },
    {
      id: 'sensor',
      text: 'Flow / bubble sensor',
      position: sensorPosition.clone().add(vec(-0.85, -0.42, -0.7)),
    },
    {
      // The blender is modeled now, so the label names the device. Anchored
      // just above the outlet, which keeps it beside both the mixer box and
      // the start of the sweep line.
      id: 'sweep',
      text: 'Air\u2013O\u2082 blender \u2014 sweep-gas source',
      position: blenderOutlet.clone().add(vec(-0.12, 0.08, -0.04)),
    },
    {
      // Sits just above the transformed console box, so it stays on the console when the placement
      // changes. It was a fixed 0.62 m, which floated 0.70 m clear of the model it names.
      id: 'console',
      text: 'CARDIOHELP console',
      position: vec(
        // Offset outboard of the HLS module so the pill reads as the console's, not the pump's.
        consolePlacement.origin.x + 0.26,
        consolePlacement.worldBounds.max.y + 0.2,
        consolePlacement.origin.z + 0.1,
      ),
    },
  ]

  return {
    supportMode,
    drainageInsertion,
    returnInsertion,
    drainageSite: { position: drainageInsertion, ringColorKey: 'drainageRing', site: 'drainage' },
    returnSite: {
      position: returnInsertion,
      ringColorKey: supportMode === 'va' ? 'returnArteryRing' : 'returnVeinRing',
      site: 'return',
    },
    drainageCannula,
    returnCannula,
    drainageLine,
    returnLine,
    sweepLine,
    dpc,
    drainageClampU: DRAINAGE_CLAMP_U,
    returnClampU: RETURN_CLAMP_U,
    hlsModulePosition: HLS_MODULE,
    pumpInlet: PUMP_INLET,
    oxygenatorOutlet: OXYGENATOR_OUTLET,
    sensorPosition,
    sensorTangent,
    // Cloned per layout: `consolePlacement` is computed once at module load, and handing every
    // caller the same Box3 would let one consumer's `translate` move the console for all of them.
    consoleOrigin: consolePlacement.origin.clone(),
    consoleBounds: consolePlacement.worldBounds.clone(),
    consoleHolderAnchor: new THREE.Vector3(
      consolePlacement.origin.x - 0.18,
      consolePlacement.worldBounds.max.y - 0.06,
      consolePlacement.origin.z - 0.05,
    ),
    labels,
  }
}
