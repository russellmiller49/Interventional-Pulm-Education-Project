import type { ThoracicStructureLabel, ThoracicVolume } from '../types'

import { simulateBMode } from '../engine/simulateBMode'
import type { RaymarchFrameMessage, RaymarchRenderMessage } from './raymarch.worker'
import type { BModeFrameRequest, ResolvedBModeFrame, ThoracicFrameProvider } from './types'

export interface BrowserRaymarchProviderOptions {
  /** Skip the worker and render synchronously (jsdom, SSR, tests). */
  forceSync?: boolean
}

export interface BrowserRaymarchProvider extends ThoracicFrameProvider {
  dispose: () => void
}

/**
 * Browser-generated render. SAFETY GATE: this provider only returns a
 * displayable frame when the manifest's qualityStatus.browserRaymarch is
 * 'acceptable' or 'reviewed'. While it is 'prototype' (the current state for
 * every shipped case) resolve() returns null, so learners fall through to the
 * neutral placeholder and never see an unreviewed synthetic image. Geometry
 * metrics are computed separately (simulateBMode with renderImage: false) and
 * do not pass through this gate.
 */
export function createBrowserRaymarchProvider(
  options: BrowserRaymarchProviderOptions = {},
): BrowserRaymarchProvider {
  let worker: Worker | null = null
  let workerFailed = false
  let initializedVolume: ThoracicVolume | null = null
  let nextRequestId = 1
  const pending = new Map<number, (message: RaymarchFrameMessage | null) => void>()

  /** Settle every in-flight render so the frame pump never hangs on a dead worker. */
  function flushPending() {
    const waiters = [...pending.values()]
    pending.clear()
    for (const resolveWaiter of waiters) {
      resolveWaiter(null)
    }
  }

  async function ensureWorker(
    volume: ThoracicVolume,
    labelCodes: Record<string, ThoracicStructureLabel>,
  ): Promise<Worker | null> {
    if (options.forceSync || workerFailed || typeof Worker === 'undefined') {
      return null
    }

    if (!worker) {
      try {
        const { createRaymarchWorker } = await import('./createRaymarchWorker')
        worker = createRaymarchWorker()
        worker.onmessage = (event: MessageEvent<RaymarchFrameMessage>) => {
          const resolvePending = pending.get(event.data.id)
          if (resolvePending) {
            pending.delete(event.data.id)
            resolvePending(event.data)
          }
        }
        worker.onerror = () => {
          workerFailed = true
          flushPending()
        }
        worker.onmessageerror = () => {
          workerFailed = true
          flushPending()
        }
      } catch {
        workerFailed = true
        return null
      }
    }

    if (initializedVolume !== volume) {
      // Clone the buffer so the main-thread copy stays usable for scoring.
      const copy = volume.data.slice().buffer
      worker.postMessage(
        {
          type: 'init',
          data: copy,
          geometry: volume.geometry,
          labelCodes,
        },
        [copy],
      )
      initializedVolume = volume
    }

    return worker
  }

  function renderSync(request: BModeFrameRequest, volume: ThoracicVolume): ResolvedBModeFrame {
    const { imageData, metrics } = simulateBMode({
      volume,
      probe: request.probe,
      width: request.width,
      height: request.height,
      model: request.model,
      renderImage: true,
    })

    return {
      kind: 'browser-raymarch',
      quality: request.manifest.qualityStatus.browserRaymarch,
      sourceLabel: 'Live synthetic render',
      imageData: imageData ?? undefined,
      metrics,
      educationalUse:
        'Synthetic browser-generated frame for educational simulation only; not for diagnosis or clinical use.',
    }
  }

  async function renderViaWorker(
    request: BModeFrameRequest,
    volume: ThoracicVolume,
  ): Promise<ResolvedBModeFrame | null> {
    const activeWorker = await ensureWorker(volume, request.manifest.primaryLabelVolume.labelCodes)
    if (!activeWorker) {
      return renderSync(request, volume)
    }

    const id = nextRequestId
    nextRequestId += 1

    const response = await new Promise<RaymarchFrameMessage | null>((resolvePromise) => {
      pending.set(id, resolvePromise)
      const message: RaymarchRenderMessage = {
        type: 'render',
        id,
        probe: request.probe,
        width: request.width,
        height: request.height,
        renderImage: true,
      }
      activeWorker.postMessage(message)
    })

    if (!response) {
      // Worker died mid-render: produce the frame on the main thread instead.
      // A null from dispose() (unmount) just ends the stream quietly.
      return workerFailed ? renderSync(request, volume) : null
    }

    return {
      kind: 'browser-raymarch',
      quality: request.manifest.qualityStatus.browserRaymarch,
      sourceLabel: 'Live synthetic render',
      imageData: response.image
        ? new ImageData(
            new Uint8ClampedArray(response.image.buffer),
            response.image.width,
            response.image.height,
          )
        : undefined,
      metrics: response.metrics,
      educationalUse:
        'Synthetic browser-generated frame for educational simulation only; not for diagnosis or clinical use.',
    }
  }

  return {
    id: 'browser-raymarch',
    kind: 'browser-raymarch',
    resolve: async (request) => {
      const displayQuality = request.manifest.qualityStatus.browserRaymarch
      if (displayQuality !== 'acceptable' && displayQuality !== 'reviewed') {
        return null
      }
      if (!request.volume) {
        return null
      }

      try {
        return await renderViaWorker(request, request.volume)
      } catch {
        return null
      }
    },
    dispose: () => {
      worker?.terminate()
      worker = null
      initializedVolume = null
      flushPending()
    },
  }
}
