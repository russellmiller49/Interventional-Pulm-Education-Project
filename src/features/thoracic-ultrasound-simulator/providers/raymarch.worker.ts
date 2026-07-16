/**
 * Dedicated worker that runs the shared B-mode loop off the main thread.
 *
 * The volume buffer arrives once in an init message; each render message then
 * only carries the probe pose and output size. TissueModel functions cannot
 * cross the worker boundary, so the worker always uses the default thoracic
 * model — cases needing a custom model must render on the main thread.
 */
import type {
  CardiacModelSpec,
  ProbeType,
  ThoracicProbeState,
  ThoracicStructureLabel,
  ThoracicVolume,
  VolumeGeometry,
} from '../types'

import { renderBModeImage, simulateBMode } from '../engine/simulateBMode'
import { createTissueModel } from '../engine/tissueModel'
import { buildLabelResolver } from '../loader/loadThoracicCase'

export interface RaymarchInitMessage {
  type: 'init'
  data: ArrayBuffer
  geometry: VolumeGeometry
  labelCodes: Record<string, ThoracicStructureLabel>
  cardiacModel?: CardiacModelSpec
}

export interface RaymarchRenderMessage {
  type: 'render'
  id: number
  probe: ThoracicProbeState
  width: number
  height: number
  renderImage: boolean
  simulationTimeSec?: number
  probeType?: ProbeType
  renderOnly?: boolean
}

export type RaymarchRequestMessage = RaymarchInitMessage | RaymarchRenderMessage

export interface RaymarchFrameMessage {
  type: 'frame'
  id: number
  metrics: ReturnType<typeof simulateBMode>['metrics'] | null
  image: { width: number; height: number; buffer: ArrayBuffer } | null
}

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<RaymarchRequestMessage>) => void) | null
  postMessage: (message: RaymarchFrameMessage, transfer?: Transferable[]) => void
}

let volume: ThoracicVolume | null = null
const model = createTissueModel()

workerScope.onmessage = (event) => {
  const message = event.data

  if (message.type === 'init') {
    volume = {
      data: new Uint8Array(message.data),
      geometry: message.geometry,
      resolveLabel: buildLabelResolver(message.labelCodes),
      cardiacModel: message.cardiacModel,
    }
    return
  }

  if (message.type === 'render' && volume) {
    if (message.renderOnly) {
      const imageData = renderBModeImage({
        volume,
        probe: message.probe,
        width: message.width,
        height: message.height,
        simulationTimeSec: message.simulationTimeSec,
        probeType: message.probeType,
      })
      const buffer = imageData.data.buffer as ArrayBuffer
      workerScope.postMessage(
        {
          type: 'frame',
          id: message.id,
          metrics: null,
          image: { width: imageData.width, height: imageData.height, buffer },
        },
        [buffer],
      )
      return
    }

    const { imageData, metrics } = simulateBMode({
      volume,
      probe: message.probe,
      width: message.width,
      height: message.height,
      model,
      renderImage: message.renderImage,
      simulationTimeSec: message.simulationTimeSec,
      probeType: message.probeType,
    })

    if (imageData) {
      const buffer = imageData.data.buffer as ArrayBuffer
      workerScope.postMessage(
        {
          type: 'frame',
          id: message.id,
          metrics,
          image: { width: imageData.width, height: imageData.height, buffer },
        },
        [buffer],
      )
    } else {
      workerScope.postMessage({ type: 'frame', id: message.id, metrics, image: null })
    }
  }
}
