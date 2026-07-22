import rawRig from './cardiac-rig.json'
import rawCtRig from './cardiac-ct-rig.json'

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

function toProgressMap<T extends Record<string, number>>(values: T, label: string): T {
  for (const [name, value] of Object.entries(values)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Invalid cardiac rig progress: ${label}.${name}`)
    }
  }
  return values
}

function toCtRoute<T extends Record<string, number>>(
  route: { points: readonly (readonly number[])[]; progress: T; lengthWebUnits: number },
  label: string,
) {
  return {
    points: toPoints(route.points, `${label}.points`),
    progress: toProgressMap(route.progress, `${label}.progress`),
    lengthWebUnits: route.lengthWebUnits,
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
    route: toPoints(rawCtRig.pac.points, 'pac.route'),
    endpointProgress: toProgressMap(rawCtRig.pac.progress, 'pac.endpointProgress'),
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
    advancement: toCtRoute(rawCtRig.impella, 'impella.advancement'),
    deviceRegistration: {
      modelUrl: rawCtRig.impella.deviceRegistration.modelUrl,
      localForwardAxis: rawCtRig.impella.deviceRegistration.localForwardAxis,
      inletLocal: toPoint(
        rawCtRig.impella.deviceRegistration.inletLocal,
        'impella.deviceRegistration.inletLocal',
      ),
      outletLocal: toPoint(
        rawCtRig.impella.deviceRegistration.outletLocal,
        'impella.deviceRegistration.outletLocal',
      ),
      modelScale: rawCtRig.impella.deviceRegistration.modelScale,
      correctInletDistanceBelowAnnulusMm:
        rawCtRig.impella.deviceRegistration.correctInletDistanceBelowAnnulusMm,
    },
  },
  impella55: {
    advancement: toCtRoute(rawCtRig.impella55, 'impella55.advancement'),
    deviceRegistration: {
      modelUrl: rawCtRig.impella55.deviceRegistration.modelUrl,
      localForwardAxis: rawCtRig.impella55.deviceRegistration.localForwardAxis,
      inletLocal: toPoint(
        rawCtRig.impella55.deviceRegistration.inletLocal,
        'impella55.deviceRegistration.inletLocal',
      ),
      outletLocal: toPoint(
        rawCtRig.impella55.deviceRegistration.outletLocal,
        'impella55.deviceRegistration.outletLocal',
      ),
      modelScale: rawCtRig.impella55.deviceRegistration.modelScale,
      correctInletDistanceBelowAnnulusMm:
        rawCtRig.impella55.deviceRegistration.correctInletDistanceBelowAnnulusMm,
    },
  },
  impellaRp: {
    advancement: toCtRoute(rawCtRig.impellaRp, 'impellaRp.advancement'),
    deviceRegistration: {
      modelUrl: rawCtRig.impellaRp.deviceRegistration.modelUrl,
      localForwardAxis: rawCtRig.impellaRp.deviceRegistration.localForwardAxis,
      inletLocal: toPoint(
        rawCtRig.impellaRp.deviceRegistration.inletLocal,
        'impellaRp.deviceRegistration.inletLocal',
      ),
      outletLocal: toPoint(
        rawCtRig.impellaRp.deviceRegistration.outletLocal,
        'impellaRp.deviceRegistration.outletLocal',
      ),
      modelScale: rawCtRig.impellaRp.deviceRegistration.modelScale,
    },
  },
  lvad: {
    modelRegistration: {
      apicalCuffWorld: toPoint(
        rawRig.lvad.modelRegistration.apicalCuffWorld,
        'lvad.modelRegistration.apicalCuffWorld',
      ),
      modelAnchorLocal: toPoint(
        rawRig.lvad.modelRegistration.modelAnchorLocal,
        'lvad.modelRegistration.modelAnchorLocal',
      ),
      modelOutwardAxisLocal: toPoint(
        rawRig.lvad.modelRegistration.modelOutwardAxisLocal,
        'lvad.modelRegistration.modelOutwardAxisLocal',
      ),
      outwardAxis: toPoint(
        rawRig.lvad.modelRegistration.outwardAxis,
        'lvad.modelRegistration.outwardAxis',
      ),
      scale: rawRig.lvad.modelRegistration.scale,
    },
    inflowRoute: toPoints(rawRig.lvad.inflowRoute, 'lvad.inflowRoute'),
    outflowRoute: toPoints(rawRig.lvad.outflowRoute, 'lvad.outflowRoute'),
    ctRegistration: {
      inflowTip: toPoint(rawRig.lvad.ctRegistration.inflowTip, 'lvad.ctRegistration.inflowTip'),
      endocardialApex: toPoint(
        rawRig.lvad.ctRegistration.endocardialApex,
        'lvad.ctRegistration.endocardialApex',
      ),
      epicardialApex: toPoint(
        rawRig.lvad.ctRegistration.epicardialApex,
        'lvad.ctRegistration.epicardialApex',
      ),
      pumpCenter: toPoint(rawRig.lvad.ctRegistration.pumpCenter, 'lvad.ctRegistration.pumpCenter'),
      aorticSurfaceAnastomosis: toPoint(
        rawRig.lvad.ctRegistration.aorticSurfaceAnastomosis,
        'lvad.ctRegistration.aorticSurfaceAnastomosis',
      ),
      aorticLumenEndpoint: toPoint(
        rawRig.lvad.ctRegistration.aorticLumenEndpoint,
        'lvad.ctRegistration.aorticLumenEndpoint',
      ),
      clearanceReview: rawRig.lvad.ctRegistration.clearanceReview,
      provenance: rawRig.lvad.ctRegistration.provenance,
    },
  },
  transducer: rawRig.transducer,
  ecmo: {
    vv: {
      femoralVenousDrainage: toCtRoute(
        rawCtRig.ecmo.vv.femoralVenousDrainage,
        'ecmo.vv.femoralVenousDrainage',
      ),
      jugularVenousReturn: toCtRoute(
        rawCtRig.ecmo.vv.jugularVenousReturn,
        'ecmo.vv.jugularVenousReturn',
      ),
    },
    va: {
      femoralVenousDrainage: toCtRoute(
        rawCtRig.ecmo.va.femoralVenousDrainage,
        'ecmo.va.femoralVenousDrainage',
      ),
      femoralArterialReturn: toCtRoute(
        rawCtRig.ecmo.va.femoralArterialReturn,
        'ecmo.va.femoralArterialReturn',
      ),
      retrogradeAorticFlow: toCtRoute(
        rawCtRig.ecmo.va.retrogradeAorticFlow,
        'ecmo.va.retrogradeAorticFlow',
      ),
    },
  },
  ctProvenance: rawCtRig.provenance,
} as const

export function cardiacAssetUrl(asset: CardiacAssetId): string {
  return CARDIAC_RIG.assets[asset]
}
