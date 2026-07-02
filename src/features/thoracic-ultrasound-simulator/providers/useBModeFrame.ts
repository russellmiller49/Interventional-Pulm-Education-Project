'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import type {
  ThoracicCaseManifest,
  ThoracicFrameMetrics,
  ThoracicProbeState,
  ThoracicVolume,
  TissueModel,
} from '../types'

import { simulateBMode } from '../engine/simulateBMode'
import { createBrowserRaymarchProvider } from './browserRaymarchProvider'
import { createPlaceholderProvider } from './placeholderProvider'
import { createPlusAtlasProvider } from './plusAtlasProvider'
import { createReviewedAtlasProvider } from './reviewedAtlasProvider'
import type { BModeFrameRequest, ResolvedBModeFrame, ThoracicFrameProvider } from './types'

/** Ground truth the case hides until the learner predicts and reveals. */
export function caseGroundTruthKey(manifest: ThoracicCaseManifest | null): string | null {
  if (!manifest) {
    return null
  }
  const classifyTask = manifest.learningTasks.find(
    (task) => task.kind === 'classify-pattern' && task.hiddenGroundTruth,
  )
  return classifyTask?.hiddenGroundTruth ?? null
}

/**
 * Build the provider stack from the manifest's declared frame sources, in
 * strict priority order: reviewed cached frames, then the pose-indexed offline
 * set, then the (quality-gated) browser render, then the neutral placeholder.
 * A placeholder is appended even when the manifest omits one so the stack
 * always terminates.
 */
export function buildFrameProviders(manifest: ThoracicCaseManifest): ThoracicFrameProvider[] {
  const providers = [...manifest.frameSources]
    .sort((a, b) => a.priority - b.priority)
    .map((source): ThoracicFrameProvider | null => {
      switch (source.kind) {
        case 'reviewed-atlas':
          return createReviewedAtlasProvider()
        case 'plus-atlas':
          return source.indexUrl ? createPlusAtlasProvider(source.indexUrl) : null
        case 'browser-raymarch':
          return createBrowserRaymarchProvider()
        case 'placeholder':
          return createPlaceholderProvider()
        default:
          return null
      }
    })
    .filter((provider): provider is ThoracicFrameProvider => provider !== null)

  if (!providers.some((provider) => provider.kind === 'placeholder')) {
    providers.push(createPlaceholderProvider())
  }

  return providers
}

export async function resolveFrameFromProviders(
  providers: ThoracicFrameProvider[],
  request: BModeFrameRequest,
): Promise<ResolvedBModeFrame | null> {
  for (const provider of providers) {
    const frame = await provider.resolve(request)
    if (frame) {
      return frame
    }
  }
  return null
}

/**
 * Synchronous best-effort pass so poses covered by the embedded reviewed atlas
 * display without an async flicker. Stops at the first provider without a
 * side-effect-free sync path (it may produce a frame asynchronously, so lower
 * priority providers must not preempt it); async resolution finishes the job.
 */
function trySyncResolve(
  providers: ThoracicFrameProvider[],
  request: BModeFrameRequest,
): ResolvedBModeFrame | null {
  for (const provider of providers) {
    if (!provider.resolveSync) {
      return null
    }
    const result = provider.resolveSync(request)
    if (result) {
      return result
    }
  }
  return null
}

export interface UseBModeFrameInput {
  manifest: ThoracicCaseManifest | null
  volume: ThoracicVolume | null
  probe: ThoracicProbeState | null
  width?: number
  height?: number
  model?: TissueModel
}

export interface UseBModeFrameResult {
  /** Frame to display (reviewed image, gated render, or placeholder). */
  frame: ResolvedBModeFrame | null
  /** Metrics for scoring: the frame's own, or a metrics-only geometry pass. */
  metrics: ThoracicFrameMetrics | null
  /** Hidden ground truth for the current frame/case; not for direct display. */
  groundTruthKey: string | null
  pending: boolean
}

export function useBModeFrame({
  manifest,
  volume,
  probe,
  width = 520,
  height = 620,
  model,
}: UseBModeFrameInput): UseBModeFrameResult {
  const providers = useMemo(() => (manifest ? buildFrameProviders(manifest) : []), [manifest])

  useEffect(() => {
    return () => {
      for (const provider of providers) {
        const dispose = (provider as { dispose?: () => void }).dispose
        dispose?.()
      }
    }
  }, [providers])

  const request = useMemo<BModeFrameRequest | null>(() => {
    if (!manifest || !probe) {
      return null
    }
    return { manifest, volume, probe, width, height, model }
  }, [manifest, volume, probe, width, height, model])

  const syncFrame = useMemo(
    () => (request ? trySyncResolve(providers, request) : null),
    [providers, request],
  )

  const [asyncResult, setAsyncResult] = useState<{
    request: BModeFrameRequest
    frame: ResolvedBModeFrame | null
  } | null>(null)

  // Streaming resolution with latest-wins coalescing: at most one resolve is in
  // flight; while it runs, newer poses just overwrite latestRequestRef, and the
  // pump loop picks up the newest one when the current render finishes. The
  // last resolved frame stays on screen meanwhile, so dragging the probe plays
  // as a continuous cine sweep instead of flashing the placeholder.
  const latestRequestRef = useRef<BModeFrameRequest | null>(null)
  const pumpingRef = useRef(false)
  const generationRef = useRef(0)

  useEffect(() => {
    // Invalidate running pumps and cached frames when the case changes.
    generationRef.current += 1
    setAsyncResult(null)
    return () => {
      generationRef.current += 1
    }
  }, [providers])

  useEffect(() => {
    latestRequestRef.current = request
    if (!request || syncFrame || pumpingRef.current) {
      return
    }

    const generation = generationRef.current
    pumpingRef.current = true
    void (async () => {
      try {
        let current: BModeFrameRequest | null = request
        while (current && generationRef.current === generation) {
          const frame = await resolveFrameFromProviders(providers, current)
          if (generationRef.current !== generation) {
            return
          }
          setAsyncResult({ request: current, frame })
          current = latestRequestRef.current !== current ? latestRequestRef.current : null
        }
      } finally {
        pumpingRef.current = false
      }
    })()
  }, [providers, request, syncFrame])

  const frame = syncFrame ?? asyncResult?.frame ?? null

  const metrics = useMemo(() => {
    if (frame?.metrics) {
      return frame.metrics
    }
    if (!volume || !probe) {
      return null
    }
    // Metrics-only geometry pass: cheap, synchronous, never rasterizes pixels.
    return simulateBMode({ volume, probe, width, height, model, renderImage: false }).metrics
  }, [frame?.metrics, volume, probe, width, height, model])

  return {
    frame,
    metrics,
    groundTruthKey: frame?.entry?.groundTruthKey ?? caseGroundTruthKey(manifest),
    pending: request !== null && syncFrame === null && asyncResult?.request !== request,
  }
}
