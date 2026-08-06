import * as THREE from 'three'

import type { SupportMode } from '../../engine/types'
import {
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
const GROIN_VEIN_LEFT = patientWorldPoint(-0.135, 0.265, 0.09)
const GROIN_VEIN_RIGHT = patientWorldPoint(0.135, 0.265, 0.09)
const GROIN_ARTERY_RIGHT = patientWorldPoint(0.175, 0.262, 0.055)
const DPC_ENTRY = patientWorldPoint(0.185, 0.258, 0.115)

// Line hubs where cannulas meet circuit tubing, on the near bed edge.
const DRAINAGE_HUB = vec(-0.73, -0.08, 0.08)
const RETURN_HUB = vec(-0.71, -0.1, -0.13)

// Integrated HLS module (pump head under oxygenator) on the console holder.
const HLS_MODULE = vec(0.9, -0.05, 0.3)
const PUMP_INLET = vec(0.9, -0.3, 0.32)
const OXYGENATOR_OUTLET = vec(0.76, 0.1, 0.2)
/*
 * Where the sweep-gas line enters the scene, on the floor in front of the console.
 *
 * No external blender or wall outlet is modelled, so this is a tubing origin and nothing more — it
 * was previously placed *inside* the console's own volume, which made the console read as the gas
 * source and put the "Sweep gas" pill on top of it. The label names the connection, not a device.
 */
const SWEEP_SOURCE = vec(1.46, -0.66, 1.17)
const SWEEP_CAP = vec(0.94, 0.24, 0.4)

function curve(points: THREE.Vector3[]): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5)
}

export function buildCircuitLayout(supportMode: SupportMode): CircuitLayout {
  const drainageInsertion = GROIN_VEIN_LEFT
  const returnInsertion = supportMode === 'va' ? GROIN_ARTERY_RIGHT : GROIN_VEIN_RIGHT

  const drainageCannula = curve([
    drainageInsertion,
    vec(-1.34, -0.09, -0.11),
    vec(-1.05, -0.04, 0.03),
    DRAINAGE_HUB,
  ])
  const returnCannula = curve([
    RETURN_HUB,
    vec(-0.92, -0.08, -0.08),
    vec(-1.08, -0.1, -0.15),
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
  // Routed round the console's near-left corner rather than through it: the console now stands on
  // its base and occupies the volume this line used to cut across.
  const sweepLine = curve([
    SWEEP_SOURCE,
    vec(1.12, -0.55, 1.12),
    vec(0.84, -0.3, 0.84),
    vec(0.8, -0.06, 0.56),
    SWEEP_CAP,
  ])

  const dpc =
    supportMode === 'va'
      ? curve([
          DPC_ENTRY,
          patientWorldPoint(0.2, 0.25, 0.24),
          patientWorldPoint(0.185, 0.235, 0.36),
          patientWorldPoint(0.16, 0.245, 0.44),
          patientWorldPoint(0.185, 0.255, 0.47),
          patientWorldPoint(0.205, 0.24, 0.44),
        ])
      : null

  const sensorU = 0.12
  const sensorPosition = returnLine.getPointAt(sensorU)
  const sensorTangent = returnLine.getTangentAt(sensorU).normalize()

  const labels: CircuitLabel[] = [
    {
      id: 'drainage-site',
      text: 'Femoral vein — drainage',
      position: drainageInsertion.clone().add(vec(-0.08, 0.2, 0.16)),
    },
    {
      id: 'return-site',
      text:
        supportMode === 'va'
          ? 'Femoral artery — return'
          : 'Femoral vein — return · tip toward right atrium',
      position: returnInsertion.clone().add(vec(0.14, 0.2, 0.12)),
    },
    ...(supportMode === 'va'
      ? [
          {
            id: 'dpc',
            text: 'Distal perfusion catheter',
            position: DPC_ENTRY.clone().add(vec(0.2, 0.12, 0.3)),
          },
        ]
      : []),
    {
      id: 'drainage-clamp',
      text: 'Drainage clamp',
      position: drainageLine
        .getPointAt(DRAINAGE_CLAMP_U)
        .clone()
        .add(vec(0, 0.22, 0)),
    },
    {
      id: 'return-clamp',
      text: 'Return clamp',
      position: returnLine
        .getPointAt(RETURN_CLAMP_U)
        .clone()
        .add(vec(0, 0.22, 0)),
    },
    {
      id: 'hls-module',
      text: 'HLS module — pump + oxygenator',
      position: HLS_MODULE.clone().add(vec(0.05, 0.55, 0.05)),
    },
    {
      id: 'sensor',
      text: 'Flow / bubble sensor',
      position: sensorPosition.clone().add(vec(0.05, 0.2, -0.05)),
    },
    {
      /*
       * Anchored to the start of the sweep curve, and named for what is actually there.
       *
       * Nothing in this scene models a gas blender or a wall outlet, so "Sweep gas" beside a point
       * that happened to sit inside the console labelled the console as the gas source. This names
       * the tubing and its connection instead — the thing the learner can see.
       */
      id: 'sweep',
      text: 'Sweep-gas line / source connection',
      position: SWEEP_SOURCE.clone().add(vec(0.06, 0.34, 0.06)),
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
    consoleOrigin: consolePlacement.origin,
    consoleBounds: consolePlacement.worldBounds,
    consoleHolderAnchor: new THREE.Vector3(
      consolePlacement.origin.x - 0.18,
      consolePlacement.worldBounds.max.y - 0.06,
      consolePlacement.origin.z - 0.05,
    ),
    labels,
  }
}
