import { EXPLORER_DEVICES, explorerDevice } from '../../content/deviceExplorerCatalogue'

/**
 * What the viewer has chosen. Everything that moves continuously (the playhead, the jaws in
 * motion, the camera in flight) lives in the scene; this is the part the DOM controls own.
 */
export const ASSEMBLY = 'assembly'

export interface ExplorerState {
  /** `assembly`, or a showcase model's id. */
  readonly selection: string
  /** The assembly's telescope drawn as the illustrative cutaway. */
  readonly cutaway: boolean
  readonly labels: boolean
  readonly exploded: boolean
  /** The chosen hotspot: `<part>:<id>` in the assembly, `<id>` on a single model. */
  readonly hotspot: string | null
  /** The jaws the viewer asked for, 0 closed to 1 fully open. */
  readonly jaw: number
  /** Whether the assembly camera follows the sequence. */
  readonly follow: boolean
  /** Bumped whenever the camera should go somewhere: a new model, a hotspot, a reset. */
  readonly cameraSerial: number
}

export type ExplorerAction =
  | { readonly type: 'select'; readonly id: string }
  | { readonly type: 'cutaway'; readonly on: boolean }
  | { readonly type: 'labels'; readonly on: boolean }
  | { readonly type: 'explode'; readonly on: boolean }
  | { readonly type: 'hotspot'; readonly key: string | null }
  | { readonly type: 'jaw'; readonly value: number }
  | { readonly type: 'follow'; readonly on: boolean }
  | { readonly type: 'resetCamera' }

export const initialExplorerState: ExplorerState = {
  selection: ASSEMBLY,
  cutaway: false,
  labels: true,
  exploded: false,
  hotspot: null,
  jaw: 0,
  follow: true,
  cameraSerial: 0,
}

export function explorerReducer(state: ExplorerState, action: ExplorerAction): ExplorerState {
  switch (action.type) {
    case 'select': {
      if (action.id !== ASSEMBLY && !EXPLORER_DEVICES.some((device) => device.id === action.id)) {
        return state
      }
      if (action.id === state.selection) return { ...state, cameraSerial: state.cameraSerial + 1 }
      return {
        ...state,
        selection: action.id,
        hotspot: null,
        jaw: 0,
        exploded: false,
        follow: true,
        cameraSerial: state.cameraSerial + 1,
      }
    }
    case 'cutaway': {
      if (state.selection === ASSEMBLY) return { ...state, cutaway: action.on }
      const device = explorerDevice(state.selection)
      if (!device.pair) return state
      const wanted = action.on ? 'cutaway' : 'normal'
      if (device.pair.view !== wanted) return state
      // Same telescope, other drawing: keep the camera where it is.
      return { ...state, selection: device.pair.id, hotspot: null, cutaway: action.on }
    }
    case 'labels':
      return { ...state, labels: action.on }
    case 'explode':
      return { ...state, exploded: action.on, follow: true, hotspot: null }
    case 'hotspot':
      return {
        ...state,
        hotspot: action.key,
        follow: action.key === null ? state.follow : false,
        cameraSerial: action.key === null ? state.cameraSerial : state.cameraSerial + 1,
      }
    case 'jaw':
      return { ...state, jaw: Math.min(1, Math.max(0, action.value)) }
    case 'follow':
      return {
        ...state,
        follow: action.on,
        cameraSerial: action.on ? state.cameraSerial + 1 : state.cameraSerial,
      }
    case 'resetCamera':
      return { ...state, hotspot: null, follow: true, cameraSerial: state.cameraSerial + 1 }
  }
}

/** Whether the model on screen is drawn as the cutaway. */
export function showsCutaway(state: ExplorerState): boolean {
  if (state.selection === ASSEMBLY) return state.cutaway
  return explorerDevice(state.selection).pair?.view === 'normal'
}
