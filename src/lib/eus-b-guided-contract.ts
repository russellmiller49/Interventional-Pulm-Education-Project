/**
 * The labs of the EUS-B guided course, listed once.
 *
 * The Next lesson host and the Vite lab both read this file, so a lesson can name a lab by id and
 * the two sides cannot disagree about where it starts, which controls it offers or what it asks
 * for. Relative imports only, no React and no storage: the Vite app resolves `@/` differently.
 */

/** Raise when a lab's meaning changes, so a lab build from before the change says so. */
export const EUSB_CONTRACT_REVISION = 3 as const

export const EUSB_CONTROLS = ['advance', 'rotate', 'flex', 'depth', 'gain'] as const
export type EusbControl = (typeof EUSB_CONTROLS)[number]

export const EUSB_PANES = ['ultrasound', 'endoscope', 'ct', 'anatomy'] as const
export type EusbPane = (typeof EUSB_PANES)[number]

/**
 * Help a find-the-view task can offer a learner who is stuck.
 * anatomy: the 3D model with the scope in it and the target marked.
 * show: the lab drives the scope to the target's view. A view reached this way was shown, not found.
 */
export const EUSB_HELP = ['anatomy', 'show'] as const
export type EusbHelp = (typeof EUSB_HELP)[number]

export const EUSB_LAB_KINDS = ['explore', 'reach', 'rotate', 'identify', 'survey'] as const
export type EusbLabKind = (typeof EUSB_LAB_KINDS)[number]

/** Scope position: distance along the path, shaft rotation (clockwise positive), tip angulation. */
export interface EusbPose {
  sMm: number
  rollDeg: number
  flexDeg: number
}

export const EUSB_POSE_LIMITS = {
  sMm: [0, 400],
  rollDeg: [-180, 180],
  flexDeg: [-45, 45],
  depthMm: [20, 80],
  gainDb: [-15, 15],
} as const

/** A named view of the case, optionally moved from it, or a fixed position. */
export type EusbStart = { view: string; offset?: Partial<EusbPose> } | { pose: EusbPose }

export interface EusbLabSpec {
  /**
   * explore: look, with whatever controls are listed (none for a still image).
   * reach: bring the target into the image and hold it.
   * rotate: the same, with rotation as the only movement.
   * identify: click each landmark on a still image, one at a time, with nothing named.
   * survey: reach each stop in order.
   */
  kind: EusbLabKind
  start: EusbStart
  controls: readonly EusbControl[]
  /** View key of the structure to bring into the image (reach, rotate). */
  target?: string
  /**
   * The structures that identify this view, in teaching order. On a labeled image they are
   * numbered in this order; an identify lab asks for them in this order. Every one of them is in
   * the image of the lab's reference view (the target's view for a reach or a rotate, the start
   * for the rest), where the beam reaches it.
   */
  landmarks?: readonly string[]
  /** View keys in survey order (survey). */
  stops?: readonly string[]
  /** Help offered while the learner looks for the target (reach, rotate). None when left out. */
  help?: readonly EusbHelp[]
}

/*
 * The landmarks of each station view, landmarks first and the node last. The still, the
 * find-the-view task and the mark-the-landmarks task of a station share one list, so the numbers
 * on a labeled image always mean the same structures.
 */
const STATION_8_LANDMARKS = ['left_atrium', 'right_atrium', 'inferior_vena_cava', 'station_8']
const STATION_9_LANDMARKS = ['pulmonary_veins', 'station_9']
const STATION_7_LANDMARKS = ['left_atrium', 'pulmonary_artery', 'station_7']
const STATION_4L_LANDMARKS = ['aorta', 'pulmonary_artery', 'station_4l']
const STATION_2L_LANDMARKS = [
  'aorta',
  'left_subclavian_artery',
  'left_common_carotid_artery',
  'station_2l',
]

export const EUSB_LABS = {
  /** The first image below the diaphragm, as a still. */
  'liver-view': { kind: 'explore', start: { view: 'liver' }, controls: [] },
  /** From the left atrium: down through the junction and round to the liver. */
  'liver-reach': {
    kind: 'reach',
    start: { view: 'left_atrium' },
    controls: ['advance', 'rotate'],
    target: 'liver',
    help: EUSB_HELP,
  },

  /** Station 8: beside the lower esophagus, between the left atrium and the right atrium. */
  'station-8-view': {
    kind: 'explore',
    start: { view: 'station_8' },
    controls: [],
    landmarks: STATION_8_LANDMARKS,
  },
  /** Withdrawing from the stomach to the lower esophagus. */
  'station-8-reach': {
    kind: 'reach',
    start: { view: 'liver' },
    controls: ['advance', 'rotate'],
    target: 'station_8',
    landmarks: STATION_8_LANDMARKS,
    help: EUSB_HELP,
  },
  'station-8-landmarks': {
    kind: 'identify',
    start: { view: 'station_8' },
    controls: [],
    landmarks: STATION_8_LANDMARKS,
  },

  /** Station 9: in the pulmonary ligament, below the inferior pulmonary vein. */
  'station-9-view': {
    kind: 'explore',
    start: { view: 'station_9' },
    controls: [],
    landmarks: STATION_9_LANDMARKS,
  },
  'station-9-reach': {
    kind: 'reach',
    start: { view: 'station_8' },
    controls: ['advance', 'rotate'],
    target: 'station_9',
    landmarks: STATION_9_LANDMARKS,
    help: EUSB_HELP,
  },
  'station-9-landmarks': {
    kind: 'identify',
    start: { view: 'station_9' },
    controls: [],
    landmarks: STATION_9_LANDMARKS,
  },

  /** The subcarinal view from the esophagus, as a still. */
  'station-7-view': {
    kind: 'explore',
    start: { view: 'station_7' },
    controls: [],
    landmarks: STATION_7_LANDMARKS,
  },
  /** Withdrawing from the left atrium to the subcarinal space. */
  'station-7-reach': {
    kind: 'reach',
    start: { view: 'left_atrium' },
    controls: ['advance', 'rotate'],
    target: 'station_7',
    landmarks: STATION_7_LANDMARKS,
    help: EUSB_HELP,
  },
  'station-7-landmarks': {
    kind: 'identify',
    start: { view: 'station_7' },
    controls: [],
    landmarks: STATION_7_LANDMARKS,
  },

  /** Station 4L: between the aortic arch and the left pulmonary artery. */
  'station-4l-view': {
    kind: 'explore',
    start: { view: 'station_4l' },
    controls: [],
    landmarks: STATION_4L_LANDMARKS,
  },
  /** Withdrawing from the subcarinal view and turning toward the patient's left. */
  'station-4l-reach': {
    kind: 'reach',
    start: { view: 'station_7' },
    controls: ['advance', 'rotate'],
    target: 'station_4l',
    landmarks: STATION_4L_LANDMARKS,
    help: EUSB_HELP,
  },
  'station-4l-landmarks': {
    kind: 'identify',
    start: { view: 'station_4l' },
    controls: [],
    landmarks: STATION_4L_LANDMARKS,
  },
  /** Stations 5 and 6, seen beyond 4L and beyond the arch. Stills: they are not routine targets. */
  'station-5-view': {
    kind: 'explore',
    // A few millimetres above the case's own view, which sits on the border of the next level.
    start: { view: 'station_5', offset: { sMm: -4 } },
    controls: [],
    landmarks: ['station_4l', 'pulmonary_artery', 'aorta', 'station_5'],
  },
  'station-6-view': {
    kind: 'explore',
    start: { view: 'station_6' },
    controls: [],
    landmarks: ['aorta', 'station_6'],
  },

  /** Station 2L: above the arch, beside the left subclavian and left common carotid arteries. */
  'station-2l-view': {
    kind: 'explore',
    start: { view: 'station_2l' },
    controls: [],
    landmarks: STATION_2L_LANDMARKS,
  },
  'station-2l-reach': {
    kind: 'reach',
    start: { view: 'station_4l' },
    controls: ['advance', 'rotate'],
    target: 'station_2l',
    landmarks: STATION_2L_LANDMARKS,
    help: EUSB_HELP,
  },
  'station-2l-landmarks': {
    kind: 'identify',
    start: { view: 'station_2l' },
    controls: [],
    landmarks: STATION_2L_LANDMARKS,
  },
} as const satisfies Record<string, EusbLabSpec>

export type EusbLabId = keyof typeof EUSB_LABS

export const EUSB_LAB_IDS = Object.keys(EUSB_LABS) as EusbLabId[]

export function isEusbLabId(value: unknown): value is EusbLabId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EUSB_LABS, value)
}

export function eusbLab(id: EusbLabId): EusbLabSpec {
  return EUSB_LABS[id]
}

/** Share of the reference view's target area that counts as holding the target in the image. */
export const EUSB_HOLD_AREA_FRACTION = 0.4
/** How long the target must stay in the image. */
export const EUSB_HOLD_MS = 1000
