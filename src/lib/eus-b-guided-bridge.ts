import {
  EUSB_CONTRACT_REVISION,
  EUSB_CONTROLS,
  EUSB_PANES,
  EUSB_POSE_LIMITS,
  isEusbLabId,
  type EusbControl,
  type EusbLabId,
  type EusbPane,
  type EusbPose,
} from './eus-b-guided-contract'

/**
 * Messages between the EUS-B lesson page and its lab frame.
 *
 * Shared by the Next lesson host and the Vite lab; no React, no storage, relative imports only.
 * No pixels cross: the lab draws a deterministic image from a scope position, so a held image is
 * carried as the position it was held at and drawn again.
 */
export const EUSB_BRIDGE_VERSION = 1 as const

/** An image the learner held, or the lab's own reference view. */
export interface EusbHeld {
  pose: EusbPose
  depthMm: number
  gainDb: number
  frameId: string
  source: 'learner' | 'reference'
}

export interface EusbWorkbenchConfig {
  sessionId: string
  labId: EusbLabId
  /** work: the learner drives. review: controls are off and the picture is `held`. */
  phase: 'work' | 'review'
  /** Whether structure names, colors and the level name may be shown. */
  names: 'hidden' | 'shown'
  /** Views to draw; the ultrasound image is always first. */
  panes: EusbPane[]
  /**
   * Review only. Without it the lab shows its own reference view: the target for a reach or a
   * rotate, the start for the rest.
   */
  held?: EusbHeld[]
  observationRequest: number
}

export interface EusbObservation {
  labId: string
  ready: boolean
  frameReady: boolean
  pose: EusbPose
  /** Key of the stretch of the path the transducer is in. */
  level: string
  region: 'esophagus' | 'stomach'
  /** Estimated distance from the incisors. */
  depthCm: number
  depthMm: number
  gainDb: number
  frameId: string
  usedControls: EusbControl[]
  actionCount: number
  lastAction: EusbControl | ''
  /** Named structures in the image, largest first; `fraction` is of the image area. */
  inView: { key: string; fraction: number }[]
  target?: {
    key: string
    /** Target area the beam reaches, over its area in the reference view. */
    areaRatio: number
    heldMs: number
    found: boolean
    foundAt?: EusbHeld
    /**
     * The lab drove the scope to the target's view because the learner asked to be shown it.
     * `shownAt` is then the lab's reference view. A shown view is never also a found one.
     */
    shown?: boolean
    shownAt?: EusbHeld
  }
  identified?: { keys: string[]; wrong: number }
  survey?: { found: (EusbHeld & { key: string })[] }
  /** Views actually drawn. */
  panes: EusbPane[]
}

export const EMPTY_EUSB_OBSERVATION: EusbObservation = {
  labId: '',
  ready: false,
  frameReady: false,
  pose: { sMm: 0, rollDeg: 0, flexDeg: 0 },
  level: '',
  region: 'esophagus',
  depthCm: 0,
  depthMm: 50,
  gainDb: 0,
  frameId: '',
  usedControls: [],
  actionCount: 0,
  lastAction: '',
  inView: [],
  panes: [],
}

export type EusbBridgeMessage =
  | { version: 1; type: 'ready'; contractRevision: number }
  | { version: 1; type: 'configure'; config: EusbWorkbenchConfig }
  | {
      version: 1
      type: 'observation'
      sessionId: string
      observationRequest: number
      observation: EusbObservation
    }
  | { version: 1; type: 'resize'; sessionId: string; height: number }
  | { version: 1; type: 'error'; sessionId: string; message: string }

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const within = (v: unknown, [low, high]: readonly [number, number]) =>
  finite(v) && v >= low && v <= high
const count = (v: unknown, max: number) => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= max
const key = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9_]{1,60}$/.test(v)
const id = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length < max
const control = (v: unknown) => EUSB_CONTROLS.includes(v as EusbControl)
const paneList = (v: unknown) =>
  Array.isArray(v) &&
  v.length <= EUSB_PANES.length &&
  v.every((pane) => EUSB_PANES.includes(pane as EusbPane))

export function isEusbPose(v: unknown): v is EusbPose {
  return (
    object(v) &&
    within(v.sMm, EUSB_POSE_LIMITS.sMm) &&
    within(v.rollDeg, EUSB_POSE_LIMITS.rollDeg) &&
    within(v.flexDeg, EUSB_POSE_LIMITS.flexDeg)
  )
}

export function isEusbHeld(v: unknown): v is EusbHeld {
  return (
    object(v) &&
    isEusbPose(v.pose) &&
    within(v.depthMm, EUSB_POSE_LIMITS.depthMm) &&
    within(v.gainDb, EUSB_POSE_LIMITS.gainDb) &&
    id(v.frameId, 160) &&
    (v.source === 'learner' || v.source === 'reference')
  )
}

export function isEusbConfig(v: unknown): v is EusbWorkbenchConfig {
  return (
    object(v) &&
    id(v.sessionId, 180) &&
    isEusbLabId(v.labId) &&
    (v.phase === 'work' || v.phase === 'review') &&
    (v.names === 'hidden' || v.names === 'shown') &&
    paneList(v.panes) &&
    (v.panes as unknown[])[0] === 'ultrasound' &&
    (v.held === undefined ||
      (Array.isArray(v.held) && v.held.length <= 6 && v.held.every(isEusbHeld))) &&
    count(v.observationRequest, 100000)
  )
}

export function isEusbObservation(v: unknown): v is EusbObservation {
  if (!object(v)) return false
  const target = v.target
  const identified = v.identified
  const survey = v.survey
  return (
    typeof v.labId === 'string' &&
    v.labId.length < 80 &&
    typeof v.ready === 'boolean' &&
    typeof v.frameReady === 'boolean' &&
    isEusbPose(v.pose) &&
    typeof v.level === 'string' &&
    v.level.length < 60 &&
    (v.region === 'esophagus' || v.region === 'stomach') &&
    within(v.depthCm, [0, 80]) &&
    within(v.depthMm, EUSB_POSE_LIMITS.depthMm) &&
    within(v.gainDb, EUSB_POSE_LIMITS.gainDb) &&
    typeof v.frameId === 'string' &&
    v.frameId.length < 160 &&
    (v.frameReady === false || v.frameId.length > 0) &&
    Array.isArray(v.usedControls) &&
    v.usedControls.length <= EUSB_CONTROLS.length &&
    v.usedControls.every(control) &&
    count(v.actionCount, 1000000) &&
    (v.lastAction === '' || control(v.lastAction)) &&
    Array.isArray(v.inView) &&
    v.inView.length <= 12 &&
    v.inView.every((entry) => object(entry) && key(entry.key) && within(entry.fraction, [0, 1])) &&
    (target === undefined ||
      (object(target) &&
        key(target.key) &&
        within(target.areaRatio, [0, 1000]) &&
        within(target.heldMs, [0, 600000]) &&
        typeof target.found === 'boolean' &&
        (target.foundAt === undefined || isEusbHeld(target.foundAt)) &&
        (target.found === false || target.foundAt !== undefined) &&
        (target.shown === undefined || typeof target.shown === 'boolean') &&
        (target.shownAt === undefined ||
          (isEusbHeld(target.shownAt) && target.shownAt.source === 'reference')) &&
        (!target.shown || (target.shownAt !== undefined && target.found === false)))) &&
    (identified === undefined ||
      (object(identified) &&
        Array.isArray(identified.keys) &&
        identified.keys.length <= 12 &&
        identified.keys.every(key) &&
        count(identified.wrong, 10000))) &&
    (survey === undefined ||
      (object(survey) &&
        Array.isArray(survey.found) &&
        survey.found.length <= 8 &&
        survey.found.every(
          (entry) => isEusbHeld(entry) && key((entry as { key?: unknown }).key),
        ))) &&
    paneList(v.panes)
  )
}

export function isEusbMessage(v: unknown): v is EusbBridgeMessage {
  if (!object(v) || v.version !== EUSB_BRIDGE_VERSION) return false
  if (v.type === 'ready') return count(v.contractRevision, 100000)
  if (v.type === 'configure') return isEusbConfig(v.config)
  if (!id(v.sessionId, 180)) return false
  if (v.type === 'resize')
    return Number.isInteger(v.height) && Number(v.height) >= 200 && Number(v.height) <= 10000
  if (v.type === 'observation')
    return count(v.observationRequest, 100000) && isEusbObservation(v.observation)
  return v.type === 'error' && typeof v.message === 'string' && v.message.length <= 500
}

/** True when the lab frame was built against the lab list this page was built against. */
export function sameEusbContract(revision: number) {
  return revision === EUSB_CONTRACT_REVISION
}

/**
 * Names one drawn image. The lab's image depends only on the case, the scope position and the two
 * image controls, so the same id always means the same picture.
 */
export function eusbFrameId(
  caseId: string,
  assetVersion: string,
  pose: EusbPose,
  depthMm: number,
  gainDb: number,
) {
  const n = (value: number) => (Math.round(value * 10) / 10).toString()
  return [
    caseId,
    assetVersion,
    n(pose.sMm),
    n(pose.rollDeg),
    n(pose.flexDeg),
    n(depthMm),
    n(gainDb),
  ].join(':')
}
