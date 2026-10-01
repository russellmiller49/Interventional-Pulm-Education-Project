import type * as THREE from 'three'

import type { HotspotSpec } from '../../content/deviceExplorerCatalogue'
import type { WorldCameraKey } from './explorerCamera'
import type { ModelReport } from './explorerModels'

/**
 * Where the showcase models come from. The local development source serves the staged files from
 * the owner's local data; a later, cleared source would point at delivered files instead. The
 * explorer itself never assumes which.
 */
export interface ExplorerAssetSource {
  /** Shown to the presenter, e.g. "Showcase models (local)". */
  readonly name: string
  readonly urlOf: (modelId: string) => string
  /** Derived: the sleeve's distal end from the telescope's distal face, as seated in a reference image. */
  readonly sleeveSeatMm: number
  readonly sizes: ReadonlyMap<
    string,
    {
      readonly bytes: number
      readonly rawBytes: number
      readonly triangles: number
      readonly decodedBytes: number
    }
  >
}

/** A hotspot as the scene has it: the node it sits on and whether its part is showing. */
export interface HotspotTarget {
  /** Unique in the scene: the model and the hotspot. */
  readonly id: string
  /** The hotspot as the controls name it; two drawings of one part share it. */
  readonly key: string
  readonly spec: HotspotSpec
  readonly object: THREE.Object3D
  readonly visible: () => boolean
}

/** What a view tells the camera and the probe about itself. */
export interface SceneLink {
  readonly setTargets: (targets: readonly HotspotTarget[]) => void
  readonly targets: () => readonly HotspotTarget[]
  /** Where the camera goes for "frame this model" (single models) or null (the assembly follows). */
  readonly setFrame: (frame: (() => WorldCameraKey) | null) => void
  readonly frame: () => WorldCameraKey | null
  /** The assembly's sequence camera, refreshed every frame the assembly draws. */
  readonly setFollowKey: (key: WorldCameraKey | null) => void
  readonly followKey: () => WorldCameraKey | null
  readonly setReports: (reports: ReadonlyMap<string, ModelReport>) => void
  readonly reports: () => ReadonlyMap<string, ModelReport>
  /** What the scene is showing, for the development probe. */
  readonly setStatus: (status: Record<string, unknown>) => void
  readonly status: () => Record<string, unknown>
}

export function createSceneLink(): SceneLink {
  let targets: readonly HotspotTarget[] = []
  let frame: (() => WorldCameraKey) | null = null
  let followKey: WorldCameraKey | null = null
  let reports: ReadonlyMap<string, ModelReport> = new Map()
  let status: Record<string, unknown> = {}
  return {
    setTargets: (next) => {
      targets = next
    },
    targets: () => targets,
    setFrame: (next) => {
      frame = next
    },
    frame: () => (frame ? frame() : null),
    setFollowKey: (next) => {
      followKey = next
    },
    followKey: () => followKey,
    setReports: (next) => {
      reports = next
    },
    reports: () => reports,
    setStatus: (next) => {
      status = next
    },
    status: () => status,
  }
}
