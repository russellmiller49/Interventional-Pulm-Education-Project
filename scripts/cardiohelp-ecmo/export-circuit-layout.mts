/**
 * Export the bedside 3D circuit layout to JSON for the offline Blender
 * preview harness (render_scene_previews.py). The runtime scene and the
 * harness share src/features/cardiohelp-ecmo/components/ecmo-circuit/layout.ts
 * as the single source of truth.
 *
 * Run from the repo root (tsx is currently broken under Node 25, so bundle):
 *   npx esbuild scripts/cardiohelp-ecmo/export-circuit-layout.mts --bundle \
 *     --platform=node --format=esm --outfile="$TMPDIR/export-circuit-layout.mjs" \
 *   && node "$TMPDIR/export-circuit-layout.mjs"
 * Output: scripts/cardiohelp-ecmo/circuit-layout.{vv,va}.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type * as THREE from 'three'

import {
  buildCircuitLayout,
  type CircuitLayout,
} from '../../src/features/cardiohelp-ecmo/components/ecmo-circuit/layout.ts'
import {
  bloodColor,
  CAMERA_FOV,
  CAMERA_POSITION,
  CAMERA_TARGET,
  FLOOR_Y,
  PALETTE,
  PATIENT_POSITION,
  PATIENT_SCALE,
  TUBE_RADII,
} from '../../src/features/cardiohelp-ecmo/components/ecmo-circuit/constants.ts'

const SAMPLES = 64

// Resolved from the repo root so the bundled script writes to the same place.
const here = join(process.cwd(), 'scripts', 'cardiohelp-ecmo')

function sample(curve: THREE.CatmullRomCurve3): number[][] {
  return curve.getSpacedPoints(SAMPLES).map((point) => [point.x, point.y, point.z])
}

function station(curve: THREE.CatmullRomCurve3, u: number) {
  const point = curve.getPointAt(u)
  const tangent = curve.getTangentAt(u).normalize()
  return { position: [point.x, point.y, point.z], tangent: [tangent.x, tangent.y, tangent.z] }
}

function exportLayout(layout: CircuitLayout) {
  return {
    supportMode: layout.supportMode,
    floorY: FLOOR_Y,
    camera: { position: CAMERA_POSITION, target: CAMERA_TARGET, fov: CAMERA_FOV },
    palette: PALETTE,
    bloodTints: {
      venous: `#${bloodColor(0.68).getHexString()}`,
      arterial: `#${bloodColor(1).getHexString()}`,
      sweep: PALETTE.sweepGas,
    },
    patient: { position: PATIENT_POSITION, scale: PATIENT_SCALE },
    consolePlacement: { x: 1.52, z: 0.56, rotationY: -0.35 },
    hlsModule: [
      layout.hlsModulePosition.x,
      layout.hlsModulePosition.y,
      layout.hlsModulePosition.z,
    ],
    sensor: {
      position: [layout.sensorPosition.x, layout.sensorPosition.y, layout.sensorPosition.z],
      tangent: [layout.sensorTangent.x, layout.sensorTangent.y, layout.sensorTangent.z],
    },
    clamps: {
      drainage: station(layout.drainageLine, layout.drainageClampU),
      return: station(layout.returnLine, layout.returnClampU),
    },
    tubes: [
      {
        name: 'drainage-cannula',
        radius: TUBE_RADII.cannulaWall,
        role: 'cannula',
        points: sample(layout.drainageCannula),
      },
      {
        name: 'return-cannula',
        radius: TUBE_RADII.cannulaWall,
        role: 'cannula',
        points: sample(layout.returnCannula),
      },
      {
        name: 'drainage-line',
        radius: TUBE_RADII.circuitWall,
        role: 'venous',
        points: sample(layout.drainageLine),
      },
      {
        name: 'return-line',
        radius: TUBE_RADII.circuitWall,
        role: 'arterial',
        points: sample(layout.returnLine),
      },
      {
        name: 'sweep-line',
        radius: TUBE_RADII.sweepWall,
        role: 'sweep',
        points: sample(layout.sweepLine),
      },
      ...(layout.dpc
        ? [
            {
              name: 'distal-perfusion-catheter',
              radius: TUBE_RADII.dpc,
              role: 'dpc' as const,
              points: sample(layout.dpc),
            },
          ]
        : []),
    ],
    accessSites: [
      {
        name: 'drainage',
        position: [
          layout.drainageSite.position.x,
          layout.drainageSite.position.y,
          layout.drainageSite.position.z,
        ],
        ring: PALETTE[layout.drainageSite.ringColorKey],
      },
      {
        name: 'return',
        position: [
          layout.returnSite.position.x,
          layout.returnSite.position.y,
          layout.returnSite.position.z,
        ],
        ring: PALETTE[layout.returnSite.ringColorKey],
      },
    ],
    labels: layout.labels.map((label) => ({
      id: label.id,
      text: label.text,
      position: [label.position.x, label.position.y, label.position.z],
    })),
  }
}

mkdirSync(here, { recursive: true })
for (const mode of ['vv', 'va'] as const) {
  const outPath = join(here, `circuit-layout.${mode}.json`)
  writeFileSync(outPath, `${JSON.stringify(exportLayout(buildCircuitLayout(mode)), null, 2)}\n`)
  console.log(`wrote ${outPath}`)
}
