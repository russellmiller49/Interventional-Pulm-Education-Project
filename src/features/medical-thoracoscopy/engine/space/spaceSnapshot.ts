import type { SpaceSnapshotId } from '../../components/space/types'
import { anatomyManifest } from '../../content/data/generated/anatomy'
import { deviceKitManifest } from '../../content/data/generated/deviceKit'
import { digest, numbersText } from './digest'
import { AUTHORED_INSTRUMENT_VALUES } from './instrument'
import { portFrame, type PortFrame } from './portDefinition'
import { LUNG_ROOM_MM } from './spaceReducer'
import { CLEARANCE_SKIN_MM, NUMERIC_MM, PORT_EXCLUSION_MM } from './spatial/spatialWorld'
import { SKIN_PIECE_SHARE, STEP } from './spatial/sweep'
import { OCCLUSION_TOLERANCE_MM } from './spatial/visibility'

/**
 * What a state was computed for (fidelity contract, "Snapshot identity"): the anatomy, the device
 * definitions, the optics the engine authors, the port, the scenario, the lung's step, the geometry
 * the proxies are, and the engine's own rules. A result for another snapshot changes nothing.
 *
 * Each part names every input that can make a spatial answer stale (independent review, R4):
 * - anatomy, device, geometry: the hashes of the files they come from; the lung's shape at every
 *   step is in the lung proxy's file, so a changed collapse changes the geometry;
 * - optics: the values the engine authors (sleeve past the pleura, view range, along-rib limit);
 *   the field of view and the optic's offset are device definitions, in the device's hash;
 * - port: the port record's hash, and a digest of the port's frame as the engine uses it, which the
 *   port candidates' rib points help make (they set the direction across the ribs);
 * - lung and fluid: the lung's step. The fluid is drained in every scenario, and no spatial answer
 *   reads the fluid table, so the fluid is not a spatial input yet;
 * - rules: the step sizes, the skins, the port's excluded patch, the lung's room and the view's
 *   occlusion tolerance, which decide where a move stops and what counts as seen.
 * The scenario is named; a scenario's start is applied by starting the engine afresh, which drops
 * everything computed before, so nothing spatial outlives a change of start. Nothing the renderer
 * alone holds (the presentation turn, the canvas) is part of it.
 */
const short = (hash: string) => hash.slice(0, 12)

function fileHash(id: string): string {
  const file = anatomyManifest.files.find((entry) => entry.id === id)
  if (!file) throw new Error(`The anatomy manifest has no ${id}`)
  return short(file.sha256)
}

/** The port's frame as the engine uses it, by value. */
export function portIdentity(frame: PortFrame = portFrame()): string {
  return digest(
    numbersText([
      ...frame.pivot,
      ...frame.inward,
      ...frame.acrossRibs,
      ...frame.alongRibs,
      ...frame.pleura,
      frame.pleuraDepthMm,
      frame.patchRadiusMm,
      frame.ribGapMm,
      frame.ribDepthMm,
    ]),
  )
}

/** The engine's authored rules, as a readable text. */
export function rulesIdentity(): string {
  return [
    `step tilt ${STEP.tiltDeg} depth ${STEP.depthMm} roll ${STEP.rollDeg}`,
    `skin ${CLEARANCE_SKIN_MM} piece ${SKIN_PIECE_SHARE} numeric ${NUMERIC_MM}`,
    `port patch ${PORT_EXCLUSION_MM}`,
    `lung room ${LUNG_ROOM_MM}`,
    `occlusion ${OCCLUSION_TOLERANCE_MM}`,
  ].join(';')
}

export function spaceSnapshot(scenario: string, lungStep: number): SpaceSnapshotId {
  const optics = Object.entries(AUTHORED_INSTRUMENT_VALUES)
    .map(([key, value]) => `${key}=${value}`)
    .join(';')
  return {
    anatomy: short(anatomyManifest.records['surfaces.json']),
    device: short(deviceKitManifest.definitionsSha256),
    optics,
    port: `${short(anatomyManifest.records['port-record.json'])}+${portIdentity()}`,
    scenario,
    lungAndFluid: `lung step ${lungStep}`,
    geometry: `${fileHash('proxy-pleural-space')}+${fileHash('proxy-lung')}`,
    rules: rulesIdentity(),
  }
}
