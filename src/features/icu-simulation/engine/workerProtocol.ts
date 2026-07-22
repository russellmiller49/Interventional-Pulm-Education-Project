import { resumeIcuSyntheticSession, type IcuSyntheticSessionV1 } from './persistence'
import { applyIcuCommand, createIcuSimulation } from './simulation'
import type {
  IcuCommand,
  IcuScenarioDefinition,
  IcuSimulationMode,
  IcuSimulationState,
} from './types'

export type IcuWorkerRequest =
  | {
      requestId: string
      type: 'init'
      scenarioId: string
      mode: IcuSimulationMode
      seed: number
    }
  | { requestId: string; type: 'restore'; session: IcuSyntheticSessionV1 }
  | { requestId: string; type: 'command'; command: IcuCommand }
  | { requestId: string; type: 'advance'; seconds: number }

export type IcuWorkerResponse =
  | { requestId: string; type: 'state'; state: IcuSimulationState }
  | { requestId: string; type: 'error'; code: string; message: string }

export interface IcuWorkerRunner {
  handle(request: IcuWorkerRequest): IcuWorkerResponse
  getState(): IcuSimulationState | null
}

export function createIcuWorkerRunner(
  resolveScenario: (id: string) => IcuScenarioDefinition,
): IcuWorkerRunner {
  let scenario: IcuScenarioDefinition | null = null
  let state: IcuSimulationState | null = null
  return {
    handle(request) {
      try {
        if (request.type === 'init') {
          scenario = resolveScenario(request.scenarioId)
          state = createIcuSimulation(scenario, { mode: request.mode, seed: request.seed })
          return { requestId: request.requestId, type: 'state', state }
        }
        if (request.type === 'restore') {
          scenario = resolveScenario(request.session.replay.scenarioId)
          state = resumeIcuSyntheticSession(request.session, scenario)
          return { requestId: request.requestId, type: 'state', state }
        }
        if (!scenario || !state) {
          return {
            requestId: request.requestId,
            type: 'error',
            code: 'NOT_INITIALIZED',
            message: 'Initialize the ICU simulation worker before sending commands.',
          }
        }
        state = applyIcuCommand(
          state,
          scenario,
          request.type === 'advance'
            ? { type: 'time.advance', seconds: request.seconds }
            : request.command,
        )
        return { requestId: request.requestId, type: 'state', state }
      } catch (error) {
        return {
          requestId: request.requestId,
          type: 'error',
          code: 'ENGINE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown ICU simulation error.',
        }
      }
    },
    getState() {
      return state
    },
  }
}

export interface IcuWorkerLike {
  postMessage(message: IcuWorkerRequest): void
  addEventListener(type: 'message', listener: (event: { data: IcuWorkerResponse }) => void): void
  removeEventListener?(
    type: 'message',
    listener: (event: { data: IcuWorkerResponse }) => void,
  ): void
}

export interface IcuWorkerClient {
  init(scenarioId: string, mode: IcuSimulationMode, seed: number): string
  restore(session: IcuSyntheticSessionV1): string
  command(command: IcuCommand): string
  advance(seconds: number): string
  dispose(): void
}

type IcuWorkerRequestWithoutId =
  | Omit<Extract<IcuWorkerRequest, { type: 'init' }>, 'requestId'>
  | Omit<Extract<IcuWorkerRequest, { type: 'restore' }>, 'requestId'>
  | Omit<Extract<IcuWorkerRequest, { type: 'command' }>, 'requestId'>
  | Omit<Extract<IcuWorkerRequest, { type: 'advance' }>, 'requestId'>

export function createIcuWorkerClient(
  worker: IcuWorkerLike,
  onResponse: (response: IcuWorkerResponse) => void,
): IcuWorkerClient {
  let nextRequestId = 0
  const listener = (event: { data: IcuWorkerResponse }) => onResponse(event.data)
  worker.addEventListener('message', listener)
  const send = (request: IcuWorkerRequestWithoutId): string => {
    const requestId = `icu-worker-${nextRequestId}`
    nextRequestId += 1
    worker.postMessage({ ...request, requestId } as IcuWorkerRequest)
    return requestId
  }
  return {
    init(scenarioId, mode, seed) {
      return send({ type: 'init', scenarioId, mode, seed })
    },
    restore(session) {
      return send({ type: 'restore', session })
    },
    command(command) {
      return send({ type: 'command', command })
    },
    advance(seconds) {
      return send({ type: 'advance', seconds })
    },
    dispose() {
      worker.removeEventListener?.('message', listener)
    },
  }
}
