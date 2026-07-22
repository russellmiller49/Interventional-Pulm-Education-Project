import { getIcuScenario } from '../content'
import {
  createIcuWorkerRunner,
  type IcuWorkerRequest,
  type IcuWorkerResponse,
} from './workerProtocol'

interface WorkerPort {
  onmessage: ((event: { data: IcuWorkerRequest }) => void) | null
  postMessage(message: IcuWorkerResponse): void
}

const port = globalThis as unknown as WorkerPort
const runner = createIcuWorkerRunner(getIcuScenario)

port.onmessage = (event) => {
  port.postMessage(runner.handle(event.data))
}
