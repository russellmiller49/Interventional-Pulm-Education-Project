import { isRecordedFrameSource, type RecordedFrameSource } from './ebus-recorded-contract'
import {
  CONTACT_MODES,
  MODEL_PACKAGES,
  MODEL_REVISION,
  MODEL_STEPS,
  type ContactMode,
  type ModelPackage,
} from './ebus-model-contract'
import {
  LINKED_TASK_VERSION,
  LINKED_VARIANTS,
  isLinkedFrameSource,
  type LinkedFrameSource,
  type LinkedVariant,
  type LinkedSweep,
} from './ebus-linked-contract'
/** Shared by the Next lesson host and the dedicated Vite workbench; no React or storage. */
export const EBUS_BRIDGE_VERSION = 1 as const
export const EBUS_LINKED_LESSONS = [
  'scope-orientation',
  'acoustic-contact',
  'ct-map',
  'station-seven',
  'right-paratracheal',
] as const
export type EbusLinkedLesson = (typeof EBUS_LINKED_LESSONS)[number]
export interface EbusLinkedEvidence {
  assetsReady: boolean
  selectedStructure: string
  modelSectionViewed: boolean
  approach: 'rms' | 'lms' | 'default'
  scannedApproaches: ('rms' | 'lms' | 'default')[]
  frameId: string
  modelRevision?: string
  identifiedStructures?: string[]
  sweeps?: Partial<Record<'rms' | 'lms' | 'default', LinkedSweep>>
  source?: LinkedFrameSource
  baselineFrameId?: string
}
export type EbusControl =
  | 'roll'
  | 'flexion'
  | 'advance'
  | 'depth'
  | 'gain'
  | 'contrast'
  | 'doppler'
  | 'freeze'
  | 'measure'
  | 'save'
export interface EbusWorkbenchConfig {
  sessionId: string
  kind: 'simulator' | 'knobology' | 'model'
  modelPackage?: ModelPackage
  presetKey: string
  controls: EbusControl[]
  locked: boolean
  reveal: boolean
  view: 'sector' | 'bronch' | 'anatomy'
  freeDrive?: boolean
  linkedLesson?: EbusLinkedLesson
  linkedVariant?: LinkedVariant
  linkedTaskVersion?: typeof LINKED_TASK_VERSION
  demonstration?: boolean
  recordedTask?: string
  observationRequest?: number
  initialRoll: number
  initialDepth: number
  initialGain: number
}
export interface EbusObservation {
  acquisitionSession?: string
  recorded?: RecordedFrameSource
  usedControls: EbusControl[]
  actionCount: number
  lastAction: string
  ready: boolean
  frameReady: boolean
  contactQuality: number
  targetVisible: boolean
  roll: number
  flexion: number
  depth: number
  gain: number
  contrast: number
  doppler: boolean
  frozen: boolean
  measured: boolean
  saved: boolean
  model?: {
    package: ModelPackage
    revision: string
    frameId: string
    steps: string[]
    complete: boolean
    annotations: boolean
    /**
     * Which acoustic-contact condition the rendered frame is actually in
     * (EBUS-PRE-REVIEW-02, carry-forward of L5-1).
     *
     * The contact package's whole activity is switching between five modelled conditions, and the
     * frame the learner holds is whichever one was selected when they held it. Before this the
     * observation carried no trace of it, so the host could label a held frame "the image you
     * acquired" without being able to say which of the five it was, while an authored check named
     * a state. This is reported from the live model state at the moment of the observation — it is
     * never inferred from the rendered image and never reconstructed afterwards. Only the contact
     * package sets it.
     */
    contactMode?: ContactMode
  }
  linked?: EbusLinkedEvidence
}
export const EMPTY_EBUS_OBSERVATION: EbusObservation = {
  usedControls: [],
  actionCount: 0,
  lastAction: '',
  ready: false,
  frameReady: false,
  contactQuality: 0,
  targetVisible: false,
  roll: 0,
  flexion: 0,
  depth: 40,
  gain: 0,
  contrast: 50,
  doppler: false,
  frozen: false,
  measured: false,
  saved: false,
}
export type EbusBridgeMessage =
  | { version: 1; type: 'ready' }
  | { version: 1; type: 'configure'; config: EbusWorkbenchConfig }
  | {
      version: 1
      type: 'observation'
      sessionId: string
      observationRequest?: number
      observation: EbusObservation
    }
  | { version: 1; type: 'resize'; sessionId: string; height: number }
  | { version: 1; type: 'error'; sessionId: string; message: string }
const controls: EbusControl[] = [
  'roll',
  'flexion',
  'advance',
  'depth',
  'gain',
  'contrast',
  'doppler',
  'freeze',
  'measure',
  'save',
]
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
export function isEbusConfig(v: unknown): v is EbusWorkbenchConfig {
  if (!object(v)) return false
  return (
    (v.observationRequest === undefined ||
      (Number.isInteger(v.observationRequest) &&
        Number(v.observationRequest) >= 0 &&
        Number(v.observationRequest) <= 100000)) &&
    (v.recordedTask === undefined ||
      (typeof v.recordedTask === 'string' &&
        /^[a-z0-9-]+$/.test(v.recordedTask) &&
        v.recordedTask.length < 100)) &&
    typeof v.sessionId === 'string' &&
    v.sessionId.length > 0 &&
    v.sessionId.length < 180 &&
    (v.kind === 'simulator' || v.kind === 'knobology' || v.kind === 'model') &&
    (v.kind !== 'model' || MODEL_PACKAGES.includes(v.modelPackage as ModelPackage)) &&
    (v.modelPackage === undefined || MODEL_PACKAGES.includes(v.modelPackage as ModelPackage)) &&
    typeof v.presetKey === 'string' &&
    v.presetKey.length < 120 &&
    Array.isArray(v.controls) &&
    v.controls.every((c) => controls.includes(c as EbusControl)) &&
    typeof v.locked === 'boolean' &&
    typeof v.reveal === 'boolean' &&
    ['sector', 'bronch', 'anatomy'].includes(String(v.view)) &&
    (v.freeDrive === undefined || typeof v.freeDrive === 'boolean') &&
    (v.linkedLesson === undefined ||
      EBUS_LINKED_LESSONS.includes(v.linkedLesson as EbusLinkedLesson)) &&
    (v.demonstration === undefined || typeof v.demonstration === 'boolean') &&
    (v.linkedVariant === undefined || LINKED_VARIANTS.includes(v.linkedVariant as LinkedVariant)) &&
    (v.linkedTaskVersion === undefined || v.linkedTaskVersion === LINKED_TASK_VERSION) &&
    finite(v.initialRoll) &&
    Math.abs(Number(v.initialRoll)) <= 180 &&
    finite(v.initialDepth) &&
    Number(v.initialDepth) >= 15 &&
    Number(v.initialDepth) <= 80 &&
    finite(v.initialGain) &&
    Number(v.initialGain) >= -18 &&
    Number(v.initialGain) <= 100
  )
}
export function isEbusObservation(v: unknown): v is EbusObservation {
  if (!object(v)) return false
  return (
    ['actionCount', 'contactQuality', 'roll', 'flexion', 'depth', 'gain', 'contrast'].every((k) =>
      finite(v[k]),
    ) &&
    Array.isArray(v.usedControls) &&
    v.usedControls.every((c) => controls.includes(c as EbusControl)) &&
    Number.isInteger(v.actionCount) &&
    Number(v.actionCount) >= 0 &&
    Number(v.contactQuality) >= 0 &&
    Number(v.contactQuality) <= 1 &&
    ['ready', 'frameReady', 'targetVisible', 'doppler', 'frozen', 'measured', 'saved'].every(
      (k) => typeof v[k] === 'boolean',
    ) &&
    typeof v.lastAction === 'string' &&
    v.lastAction.length < 120 &&
    (v.acquisitionSession === undefined ||
      (typeof v.acquisitionSession === 'string' && v.acquisitionSession.length < 180)) &&
    (v.recorded === undefined || isRecordedFrameSource(v.recorded)) &&
    (v.model === undefined ||
      (object(v.model) &&
        MODEL_PACKAGES.includes(v.model.package as ModelPackage) &&
        v.model.revision === MODEL_REVISION &&
        typeof v.model.frameId === 'string' &&
        (v.frameReady === false || v.model.frameId.length > 0) &&
        v.model.frameId.length < 160 &&
        typeof v.model.complete === 'boolean' &&
        typeof v.model.annotations === 'boolean' &&
        (v.model.contactMode === undefined ||
          (v.model.package === 'contact' &&
            CONTACT_MODES.includes(v.model.contactMode as ContactMode))) &&
        Array.isArray(v.model.steps) &&
        v.model.steps.length <= 6 &&
        v.model.steps.every((step) =>
          (
            MODEL_STEPS[
              (v.model as Record<string, unknown>).package as ModelPackage
            ] as readonly unknown[]
          ).includes(step),
        ))) &&
    (v.linked === undefined ||
      (object(v.linked) &&
        typeof v.linked.assetsReady === 'boolean' &&
        typeof v.linked.modelSectionViewed === 'boolean' &&
        typeof v.linked.selectedStructure === 'string' &&
        v.linked.selectedStructure.length < 100 &&
        ['rms', 'lms', 'default'].includes(String(v.linked.approach)) &&
        Array.isArray(v.linked.scannedApproaches) &&
        v.linked.scannedApproaches.length <= 3 &&
        v.linked.scannedApproaches.every((a) => ['rms', 'lms', 'default'].includes(String(a))) &&
        typeof v.linked.frameId === 'string' &&
        v.linked.frameId.length < 160 &&
        (v.linked.modelRevision === undefined ||
          (typeof v.linked.modelRevision === 'string' && v.linked.modelRevision.length < 100)) &&
        (v.linked.baselineFrameId === undefined ||
          (typeof v.linked.baselineFrameId === 'string' &&
            v.linked.baselineFrameId.length < 160)) &&
        (v.linked.source === undefined || isLinkedFrameSource(v.linked.source)) &&
        (v.linked.identifiedStructures === undefined ||
          (Array.isArray(v.linked.identifiedStructures) &&
            v.linked.identifiedStructures.length <= 8 &&
            v.linked.identifiedStructures.every((s) => typeof s === 'string' && s.length < 100))) &&
        (v.linked.sweeps === undefined ||
          (object(v.linked.sweeps) &&
            Object.entries(v.linked.sweeps).every(
              ([key, s]) =>
                ['rms', 'lms', 'default'].includes(key) &&
                object(s) &&
                ['find-edge', 'crossing', 'complete'].includes(String(s.phase)) &&
                (s.lastRoll === null || finite(s.lastRoll)) &&
                typeof s.lastFrameId === 'string' &&
                s.lastFrameId.length < 160 &&
                [-1, 0, 1].includes(Number(s.direction)) &&
                typeof s.outside === 'boolean' &&
                Number.isInteger(s.samples) &&
                Number(s.samples) >= 0 &&
                Number(s.samples) <= 200 &&
                finite(s.span) &&
                Number(s.span) >= 0 &&
                Number(s.span) <= 360 &&
                finite(s.startRoll),
            )))))
  )
}
export function isEbusMessage(v: unknown): v is EbusBridgeMessage {
  if (!object(v) || v.version !== 1) return false
  if (v.type === 'ready') return true
  if (v.type === 'configure') return isEbusConfig(v.config)
  if (typeof v.sessionId !== 'string') return false
  if (v.type === 'resize')
    return Number.isInteger(v.height) && Number(v.height) >= 200 && Number(v.height) <= 10000
  if (v.type === 'observation')
    return (
      (v.observationRequest === undefined ||
        (Number.isInteger(v.observationRequest) &&
          Number(v.observationRequest) >= 0 &&
          Number(v.observationRequest) <= 100000)) &&
      isEbusObservation(v.observation)
    )
  return v.type === 'error' && typeof v.message === 'string' && v.message.length <= 500
}
