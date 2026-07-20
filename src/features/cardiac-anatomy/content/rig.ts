import rawRig from './cardiac-rig.json'

export type CardiacPoint3 = readonly [number, number, number]
export type CardiacSceneId = 'heart' | 'iabp' | 'preview'
export type CardiacAssetId = keyof typeof rawRig.assets

export interface CardiacCameraPreset {
  position: CardiacPoint3
  target: CardiacPoint3
  fov: number
  minDistance: number
  maxDistance: number
}

function toPoint(value: readonly number[], label: string): CardiacPoint3 {
  if (value.length !== 3 || value.some((coordinate) => !Number.isFinite(coordinate))) {
    throw new Error(`Invalid cardiac rig point: ${label}`)
  }
  return [value[0], value[1], value[2]]
}

function toPoints(values: readonly (readonly number[])[], label: string): readonly CardiacPoint3[] {
  return values.map((value, index) => toPoint(value, `${label}[${index}]`))
}

function toPaths(
  values: readonly (readonly (readonly number[])[])[],
  label: string,
): readonly (readonly CardiacPoint3[])[] {
  return values.map((value, index) => toPoints(value, `${label}[${index}]`))
}

function toCamera(scene: CardiacSceneId): CardiacCameraPreset {
  const camera = rawRig.cameras[scene]
  return {
    position: toPoint(camera.position, `${scene}.camera.position`),
    target: toPoint(camera.target, `${scene}.camera.target`),
    fov: camera.fov,
    minDistance: camera.minDistance,
    maxDistance: camera.maxDistance,
  }
}

export const CARDIAC_RIG = {
  version: rawRig.version,
  assets: rawRig.assets,
  cameras: {
    heart: toCamera('heart'),
    iabp: toCamera('iabp'),
    preview: toCamera('preview'),
  },
  heartVessels: {
    aorta: toPoints(rawRig.heartVessels.aorta, 'heartVessels.aorta'),
    aorticBranches: toPaths(rawRig.heartVessels.aorticBranches, 'heartVessels.aorticBranches'),
    pulmonaryArteries: toPaths(
      rawRig.heartVessels.pulmonaryArteries,
      'heartVessels.pulmonaryArteries',
    ),
  },
  pac: {
    route: toPoints(rawRig.pac.route, 'pac.route'),
    endpointIndex: rawRig.pac.endpointIndex,
    radius: rawRig.pac.radius,
    balloonRadius: rawRig.pac.balloonRadius,
  },
  iabp: {
    catheterRoute: toPoints(rawRig.iabp.catheterRoute, 'iabp.catheterRoute'),
    balloonCenter: toPoint(rawRig.iabp.balloonCenter, 'iabp.balloonCenter'),
    balloonRotation: toPoint(rawRig.iabp.balloonRotation, 'iabp.balloonRotation'),
    balloonScale: rawRig.iabp.balloonScale,
    markerPositions: toPoints(rawRig.iabp.markerPositions, 'iabp.markerPositions'),
  },
  iabpAorta: {
    aorta: toPoints(rawRig.iabpAorta.aorta, 'iabpAorta.aorta'),
    archBranches: toPaths(rawRig.iabpAorta.archBranches, 'iabpAorta.archBranches'),
    renalBranches: toPaths(rawRig.iabpAorta.renalBranches, 'iabpAorta.renalBranches'),
    iliacBranches: toPaths(rawRig.iabpAorta.iliacBranches, 'iabpAorta.iliacBranches'),
  },
  impella: {
    modelTransform: {
      position: toPoint(rawRig.impella.modelTransform.position, 'impella.modelTransform.position'),
      rotation: toPoint(rawRig.impella.modelTransform.rotation, 'impella.modelTransform.rotation'),
      scale: rawRig.impella.modelTransform.scale,
    },
    positionOffsets: {
      correct: toPoint(rawRig.impella.positionOffsets.correct, 'impella.positionOffsets.correct'),
      'too-deep': toPoint(
        rawRig.impella.positionOffsets['too-deep'],
        'impella.positionOffsets.too-deep',
      ),
      'too-shallow': toPoint(
        rawRig.impella.positionOffsets['too-shallow'],
        'impella.positionOffsets.too-shallow',
      ),
    },
    shaftRoute: toPoints(rawRig.impella.shaftRoute, 'impella.shaftRoute'),
    flowRoute: toPoints(rawRig.impella.flowRoute, 'impella.flowRoute'),
  },
  lvad: {
    modelTransform: {
      position: toPoint(rawRig.lvad.modelTransform.position, 'lvad.modelTransform.position'),
      rotation: toPoint(rawRig.lvad.modelTransform.rotation, 'lvad.modelTransform.rotation'),
      scale: rawRig.lvad.modelTransform.scale,
    },
    inflowRoute: toPoints(rawRig.lvad.inflowRoute, 'lvad.inflowRoute'),
    outflowRoute: toPoints(rawRig.lvad.outflowRoute, 'lvad.outflowRoute'),
  },
  transducer: rawRig.transducer,
} as const

export function cardiacAssetUrl(asset: CardiacAssetId): string {
  return CARDIAC_RIG.assets[asset]
}
