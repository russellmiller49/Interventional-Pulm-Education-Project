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

/**
 * The supplied GLB is authored at a small scene scale with its apex near y=0.
 * This transform centers the anterior cutaway around the shared device-overlay origin.
 */
export const REALISTIC_HEART_TRANSFORM = {
  position: [0, -1.42, -0.08] as CardiacPoint3,
  rotation: [0, 0, 0] as CardiacPoint3,
  scale: 1.05,
} as const

/**
 * Right-IJ/SVC PAC route on the visible anterior cutaway:
 * SVC → RA → tricuspid valve → RV → RVOT → pulmonic valve → right PA.
 * Coordinates are educational landmarks, not insertion-depth or fluoroscopic guidance.
 */
export const PAC_ROUTE = CARDIAC_RIG.pac.route

export const PAC_ROUTE_ENDPOINT_INDEX: Record<PacAnatomyPosition, number> =
  CARDIAC_RIG.pac.endpointIndex

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
    landmark: 'The inflated balloon briefly occludes a distal pulmonary artery branch.',
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

export const IMPELLA_FLOW_ROUTE = CARDIAC_RIG.impella.flowRoute

export const IMPELLA_SHAFT_ROUTE = CARDIAC_RIG.impella.shaftRoute

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
