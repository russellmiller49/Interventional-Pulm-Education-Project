/**
 * The labs of the EUS-B guided course, listed once.
 *
 * The Next lesson host and the Vite lab both read this file, so a lesson can name a lab by id and
 * the two sides cannot disagree about where it starts, which controls it offers or what it asks
 * for. Relative imports only, no React and no storage: the Vite app resolves `@/` differently.
 */

/** Raise when a lab's meaning changes, so a lab build from before the change says so. */
export const EUSB_CONTRACT_REVISION = 2 as const

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
   * identify: click each listed structure on the image.
   * survey: reach each stop in order.
   */
  kind: EusbLabKind
  start: EusbStart
  controls: readonly EusbControl[]
  /** View key of the structure to bring into the image (reach, rotate). */
  target?: string
  /** Structure keys to click, in the order they are asked for (identify). */
  structures?: readonly string[]
  /** View keys in survey order (survey). */
  stops?: readonly string[]
  /** Help offered while the learner looks for the target (reach, rotate). None when left out. */
  help?: readonly EusbHelp[]
}

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
  /** The subcarinal view from the esophagus, as a still. */
  'station-7-view': { kind: 'explore', start: { view: 'station_7' }, controls: [] },
  /** Withdrawing from the left atrium to the subcarinal space. */
  'station-7-reach': {
    kind: 'reach',
    start: { view: 'left_atrium' },
    controls: ['advance', 'rotate'],
    target: 'station_7',
    help: EUSB_HELP,
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
