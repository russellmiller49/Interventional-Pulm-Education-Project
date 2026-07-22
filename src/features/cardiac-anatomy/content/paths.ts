import { CARDIAC_RIG, type CardiacPoint3 } from './rig'

export { CARDIAC_RIG, type CardiacCameraPreset, type CardiacPoint3 } from './rig'

export type PacAnatomyPosition = 'introducer' | 'ra' | 'rv' | 'pa' | 'wedge'

export const REALISTIC_HEART_MODEL_URL = CARDIAC_RIG.assets.heart
export const HEART_GREAT_VESSELS_MODEL_URL = CARDIAC_RIG.assets.heartGreatVessels
export const IABP_AORTA_MODEL_URL = CARDIAC_RIG.assets.iabpAorta
export const IABP_BALLOON_MODEL_URL = CARDIAC_RIG.assets.iabpBalloon
export const IMPELLA_CP_MODEL_URL = CARDIAC_RIG.assets.impellaCp
export const IMPELLA_55_MODEL_URL = CARDIAC_RIG.assets.impella55
export const IMPELLA_RP_MODEL_URL = CARDIAC_RIG.assets.impellaRp
export const LVAD_MODEL_URL = CARDIAC_RIG.assets.lvad

/** CT LPS millimetres are baked into the normalized shared web frame during asset generation. */
export const REALISTIC_HEART_TRANSFORM = {
  position: [0, 0, 0] as CardiacPoint3,
  rotation: [0, 0, 0] as CardiacPoint3,
  scale: 1,
} as const

/**
 * Right-IJ/SVC PAC route on the transparent anterior CT heart:
 * SVC → RA → tricuspid-location gate → RV → RVOT → pulmonic-location gate → right PA.
 * Coordinates are educational landmarks, not insertion-depth or fluoroscopic guidance.
 */
export const PAC_ROUTE = CARDIAC_RIG.pac.route

export const PAC_ROUTE_PROGRESS: Record<PacAnatomyPosition, number> = {
  introducer: CARDIAC_RIG.pac.endpointProgress.introducer,
  ra: CARDIAC_RIG.pac.endpointProgress.ra,
  rv: CARDIAC_RIG.pac.endpointProgress.rv,
  pa: CARDIAC_RIG.pac.endpointProgress.pa,
  wedge: CARDIAC_RIG.pac.endpointProgress.wedge,
}

export const PAC_ROUTE_ENDPOINT_INDEX: Record<PacAnatomyPosition, number> = Object.fromEntries(
  Object.entries(PAC_ROUTE_PROGRESS).map(([position, progress]) => [
    position,
    Math.round(progress * (PAC_ROUTE.length - 1)),
  ]),
) as Record<PacAnatomyPosition, number>

export const PAC_POSITION_ANATOMY: Record<
  PacAnatomyPosition,
  { shortLabel: string; landmark: string; waveform: string }
> = {
  introducer: {
    shortLabel: 'Introducer / SVC',
    landmark: 'The catheter tip is at the venous introducer and superior vena cava entry.',
    waveform: 'No intracardiac pressure morphology should be assigned from depth alone.',
  },
  ra: {
    shortLabel: 'Right atrium',
    landmark: 'The tip is in the right atrium, proximal to the tricuspid valve.',
    waveform: 'Low-pressure atrial a, c, and v morphology is expected when the signal is valid.',
  },
  rv: {
    shortLabel: 'Right ventricle',
    landmark: 'The tip has crossed the tricuspid valve into the right ventricle.',
    waveform: 'A sharp systolic rise with a low diastolic pressure identifies the RV transition.',
  },
  pa: {
    shortLabel: 'Pulmonary artery',
    landmark: 'The tip has crossed the pulmonic valve and rests in a pulmonary artery branch.',
    waveform: 'A diastolic step-up and pulmonic closure notch distinguish PA from RV morphology.',
  },
  wedge: {
    shortLabel: 'Balloon-occluded PA branch',
    landmark:
      'At the same PA depth, the inflated balloon briefly occludes the pulmonary artery branch.',
    waveform:
      'Atrial morphology is sampled through the static distal blood column; deflate promptly.',
  },
}

export function pacRouteForPosition(position: PacAnatomyPosition): readonly CardiacPoint3[] {
  return PAC_ROUTE.slice(0, PAC_ROUTE_ENDPOINT_INDEX[position] + 1)
}

export const PHLEBOSTATIC_AXIS_Y = CARDIAC_RIG.transducer.phlebostaticAxisY
export const TRANSDUCER_X = CARDIAC_RIG.transducer.x
export const TRANSDUCER_LEVEL_WORLD_UNITS_PER_CM = CARDIAC_RIG.transducer.worldUnitsPerCm

export const IABP_CATHETER_ROUTE = CARDIAC_RIG.iabp.catheterRoute

export const IABP_BALLOON_CENTER = CARDIAC_RIG.iabp.balloonCenter

export const IMPELLA_ADVANCEMENT_ROUTE = CARDIAC_RIG.impella.advancement.points

export const IMPELLA_ADVANCEMENT_PROGRESS = CARDIAC_RIG.impella.advancement.progress

export const IMPELLA_DEVICE_REGISTRATION = CARDIAC_RIG.impella.deviceRegistration

/** Axillary/direct-aortic teaching route into the LV for the surgically placed 5.5 facsimile. */
export const IMPELLA_55_ADVANCEMENT_ROUTE = CARDIAC_RIG.impella55.advancement.points
export const IMPELLA_55_ADVANCEMENT_PROGRESS = CARDIAC_RIG.impella55.advancement.progress
export const IMPELLA_55_DEVICE_REGISTRATION = CARDIAC_RIG.impella55.deviceRegistration

/** Femoral venous IVC → RA → RV → PA route for the right-sided RP facsimile. */
export const IMPELLA_RP_ADVANCEMENT_ROUTE = CARDIAC_RIG.impellaRp.advancement.points
export const IMPELLA_RP_ADVANCEMENT_PROGRESS = CARDIAC_RIG.impellaRp.advancement.progress
export const IMPELLA_RP_DEVICE_REGISTRATION = CARDIAC_RIG.impellaRp.deviceRegistration

const IMPELLA_FLOW_OUTLET_INDEX = Math.round(
  IMPELLA_ADVANCEMENT_PROGRESS.aorticRoot * (IMPELLA_ADVANCEMENT_ROUTE.length - 1),
)

/** Physiologic pump flow is device inlet to ascending-aortic outlet, opposite insertion direction. */
export function impellaFlowRouteForProgress(inletProgress: number): readonly CardiacPoint3[] {
  const inletIndex = Math.max(
    IMPELLA_FLOW_OUTLET_INDEX + 1,
    Math.round(inletProgress * (IMPELLA_ADVANCEMENT_ROUTE.length - 1)),
  )
  return IMPELLA_ADVANCEMENT_ROUTE.slice(IMPELLA_FLOW_OUTLET_INDEX, inletIndex + 1).reverse()
}

const IMPELLA_55_FLOW_OUTLET_INDEX = Math.round(
  IMPELLA_55_ADVANCEMENT_PROGRESS.aorticRoot * (IMPELLA_55_ADVANCEMENT_ROUTE.length - 1),
)

export function impella55FlowRouteForProgress(inletProgress: number): readonly CardiacPoint3[] {
  const inletIndex = Math.max(
    IMPELLA_55_FLOW_OUTLET_INDEX + 1,
    Math.round(inletProgress * (IMPELLA_55_ADVANCEMENT_ROUTE.length - 1)),
  )
  return IMPELLA_55_ADVANCEMENT_ROUTE.slice(IMPELLA_55_FLOW_OUTLET_INDEX, inletIndex + 1).reverse()
}

const IMPELLA_RP_FLOW_INLET_INDEX = Math.round(
  IMPELLA_RP_ADVANCEMENT_PROGRESS.ivcInlet * (IMPELLA_RP_ADVANCEMENT_ROUTE.length - 1),
)

/** RP physiologic flow follows IVC inlet → PA outlet, the same direction as advancement. */
export function impellaRpFlowRouteForProgress(outletProgress: number): readonly CardiacPoint3[] {
  const outletIndex = Math.max(
    IMPELLA_RP_FLOW_INLET_INDEX + 1,
    Math.round(outletProgress * (IMPELLA_RP_ADVANCEMENT_ROUTE.length - 1)),
  )
  return IMPELLA_RP_ADVANCEMENT_ROUTE.slice(IMPELLA_RP_FLOW_INLET_INDEX, outletIndex + 1)
}

export const IMPELLA_FLOW_ROUTE = impellaFlowRouteForProgress(IMPELLA_ADVANCEMENT_PROGRESS.correct)

export const IMPELLA_55_FLOW_ROUTE = impella55FlowRouteForProgress(
  IMPELLA_55_ADVANCEMENT_PROGRESS.correct,
)
export const IMPELLA_RP_FLOW_ROUTE = impellaRpFlowRouteForProgress(
  IMPELLA_RP_ADVANCEMENT_PROGRESS.correct,
)

export const IMPELLA_SHAFT_ROUTE = IMPELLA_ADVANCEMENT_ROUTE

export const CT_CARDIAC_PROVENANCE = CARDIAC_RIG.ctProvenance

export const ECMO_CANNULATION_ROUTES = CARDIAC_RIG.ecmo

export const LVAD_INFLOW_ROUTE = CARDIAC_RIG.lvad.inflowRoute

export const LVAD_OUTFLOW_ROUTE = CARDIAC_RIG.lvad.outflowRoute

export const LVAD_FLOW_ROUTE = [
  ...LVAD_INFLOW_ROUTE,
  ...LVAD_OUTFLOW_ROUTE.slice(1),
] as const satisfies readonly CardiacPoint3[]

export const MCS_DEVICE_ANATOMY = {
  iabp: {
    title: 'Descending-aortic counterpulsation',
    location:
      'Balloon shown in the descending thoracic aorta, distal to the arch-vessel origins; the facsimile is not a placement or sizing guide.',
  },
  impella: {
    title: 'Transvalvular LV-to-aorta support',
    location:
      'Inlet shown in the left ventricle, pump across the aortic valve, and outlet in the ascending aorta.',
  },
  lvad: {
    title: 'Apical inflow and ascending-aortic return',
    location:
      'Inflow shown at the LV apex with an extracardiac pump and outflow graft returning to the ascending aorta.',
  },
} as const
