'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import type {
  ProbeType,
  ThoracicCaseManifest,
  ThoracicFrameMetrics,
  ThoracicProbeState,
  ThoracicVolume,
  TissueModel,
} from '../types'

import { simulateBMode } from '../engine/simulateBMode'
import { DEFAULT_CARDIAC_CINE_FPS, probeIntersectsCardiacModel } from '../engine/cardiacModel'
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
  cardiacMotionEnabled?: boolean
}

export interface UseBModeFrameResult {
  /** Frame to display (reviewed image, gated render, or placeholder). */
  frame: ResolvedBModeFrame | null
  /** Metrics for scoring: the frame's own, or a metrics-only geometry pass. */
  metrics: ThoracicFrameMetrics | null
  /** Hidden ground truth for the current frame/case; not for direct display. */
  groundTruthKey: string | null
  pending: boolean
  cardiacInPlane: boolean
  cardiacMotionActive: boolean
  heartRateBpm: number | null
  probeType: ProbeType
}

export function useBModeFrame({
  manifest,
  volume,
  probe,
  width = 520,
  height = 620,
  model,
  cardiacMotionEnabled = true,
}: UseBModeFrameInput): UseBModeFrameResult {
  const providers = useMemo(() => (manifest ? buildFrameProviders(manifest) : []), [manifest])

  const cardiacInPlane = useMemo(() => probeIntersectsCardiacModel(volume, probe), [volume, probe])
  const cardiacMotionActive = cardiacInPlane && cardiacMotionEnabled
  const [simulationTimeSec, setSimulationTimeSec] = useState(0)
  const cineTimeRef = useRef(0)

  useEffect(() => {
    if (!cardiacMotionActive || typeof requestAnimationFrame !== 'function') {
      return
    }

    const intervalMs = 1000 / DEFAULT_CARDIAC_CINE_FPS
    let animationFrame = 0
    let lastClockMs = performance.now()
    let lastRenderedMs = lastClockMs - intervalMs

    const tick = (nowMs: number) => {
      const elapsedSec = Math.min(0.2, Math.max(0, nowMs - lastClockMs) / 1000)
      lastClockMs = nowMs
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        cineTimeRef.current += elapsedSec
        if (nowMs - lastRenderedMs >= intervalMs) {
          lastRenderedMs = nowMs
          setSimulationTimeSec(cineTimeRef.current)
        }
      }
      animationFrame = requestAnimationFrame(tick)
    }

    animationFrame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationFrame)
  }, [cardiacMotionActive])

  const probeType = useMemo<ProbeType>(() => {
    if (cardiacInPlane) {
      return 'phased'
    }
    const preset = manifest?.probePresets.find(
      (candidate) => candidate.id === manifest.defaultProbePresetId,
    )
    return preset?.probeType ?? 'curvilinear'
  }, [cardiacInPlane, manifest])

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
    const renderWidth = cardiacMotionActive ? Math.min(width, 360) : width
    const renderHeight = cardiacMotionActive ? Math.round(renderWidth * 1.2) : height
    return {
      manifest,
      volume,
      probe,
      width: renderWidth,
      height: renderHeight,
      model,
      probeType,
      simulationTimeSec: cardiacInPlane ? simulationTimeSec : undefined,
      renderOnly: cardiacMotionActive,
    }
  }, [
    manifest,
    volume,
    probe,
    width,
    height,
    model,
    probeType,
    cardiacInPlane,
    cardiacMotionActive,
    simulationTimeSec,
  ])

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
    cardiacInPlane,
    cardiacMotionActive,
    heartRateBpm: cardiacInPlane ? (volume?.cardiacModel?.defaultHeartRateBpm ?? null) : null,
    probeType,
  }
}
