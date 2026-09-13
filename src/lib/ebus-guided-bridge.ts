/** Shared by the Next lesson host and the dedicated Vite workbench; no React or storage. */
export const EBUS_BRIDGE_VERSION = 1 as const
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
  kind: 'simulator' | 'knobology'
  presetKey: string
  controls: EbusControl[]
  locked: boolean
  reveal: boolean
  view: 'sector' | 'bronch' | 'anatomy'
  freeDrive?: boolean
  initialRoll: number
  initialDepth: number
  initialGain: number
}
export interface EbusObservation {
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
  | { version: 1; type: 'observation'; sessionId: string; observation: EbusObservation }
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
    typeof v.sessionId === 'string' &&
    v.sessionId.length > 0 &&
    v.sessionId.length < 180 &&
    (v.kind === 'simulator' || v.kind === 'knobology') &&
    typeof v.presetKey === 'string' &&
    v.presetKey.length < 120 &&
    Array.isArray(v.controls) &&
    v.controls.every((c) => controls.includes(c as EbusControl)) &&
    typeof v.locked === 'boolean' &&
    typeof v.reveal === 'boolean' &&
    ['sector', 'bronch', 'anatomy'].includes(String(v.view)) &&
    (v.freeDrive === undefined || typeof v.freeDrive === 'boolean') &&
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
    v.lastAction.length < 120
  )
}
export function isEbusMessage(v: unknown): v is EbusBridgeMessage {
  if (!object(v) || v.version !== 1) return false
  if (v.type === 'ready') return true
  if (v.type === 'configure') return isEbusConfig(v.config)
  if (typeof v.sessionId !== 'string') return false
  if (v.type === 'observation') return isEbusObservation(v.observation)
  return v.type === 'error' && typeof v.message === 'string' && v.message.length <= 500
}
