import type {
  FrameAtlasEntry,
  FrameQuality,
  FrameSourceKind,
  ThoracicCaseManifest,
  ThoracicFrameMetrics,
  ThoracicProbeState,
  ThoracicVolume,
  TissueModel,
  ProbeType,
} from '../types'

export interface BModeFrameRequest {
  probe: ThoracicProbeState
  manifest: ThoracicCaseManifest
  volume: ThoracicVolume | null
  model?: TissueModel
  width: number
  height: number
  simulationTimeSec?: number
  probeType?: ProbeType
  /** Cine frames rasterize pixels only; static metrics are cached by probe pose. */
  renderOnly?: boolean
}

/**
 * A frame the panel can display. Exactly one of `imageUrl` (cached/offline
 * frame) or `imageData` (browser render) is set; the placeholder sets neither.
 */
export interface ResolvedBModeFrame {
  kind: FrameSourceKind
  quality: FrameQuality
  sourceLabel: string
  imageUrl?: string
  imageData?: ImageData
  entry?: FrameAtlasEntry
  metrics?: ThoracicFrameMetrics
  educationalUse?: string
}

export interface ThoracicFrameProvider {
  id: string
  kind: FrameSourceKind
  /** Return a displayable frame for the pose, or null to fall through. */
  resolve: (
    request: BModeFrameRequest,
  ) => ResolvedBModeFrame | null | Promise<ResolvedBModeFrame | null>
  /**
   * Optional synchronous fast path with the same semantics as resolve. Only
   * providers that can answer without side effects (no fetches, no worker
   * renders) implement this; the sync pass stops at the first provider
   * without one so async providers are never invoked-and-discarded.
   */
  resolveSync?: (request: BModeFrameRequest) => ResolvedBModeFrame | null
}
