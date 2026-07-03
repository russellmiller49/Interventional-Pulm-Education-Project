/**
 * Shared type layer for the thoracic ultrasound simulator engine.
 *
 * This is the generic vocabulary that every case family (pleural effusion,
 * pneumothorax, consolidation, diaphragm, chest-wall, and later cardiac /
 * mediastinal / EBUS windows) shares. Case-specific scoring and labelling live
 * in feature modules that consume these types; the pleural feature is the first
 * consumer and re-exports the pleural-typed subset for backwards compatibility.
 */

export type Vec3 = [number, number, number]

/**
 * Canonical thoracic structure vocabulary. A given case only needs to use the
 * subset it segments; unknown labels fall back to `background` acoustically.
 * The pleural label union is a subset of this list.
 */
export type ThoracicStructureLabel =
  // chest wall
  | 'background'
  | 'skin'
  | 'subcutaneousTissue'
  | 'intercostalMuscle'
  | 'muscle'
  | 'rib'
  // lung / pleura
  | 'lung'
  | 'atelectaticLung'
  | 'consolidation'
  | 'pleuralFluid'
  | 'pleuralThickening'
  | 'pleuralNodule'
  | 'septation'
  | 'debris'
  // diaphragm and sub-diaphragmatic organs
  | 'diaphragm'
  | 'liver'
  | 'spleen'
  | 'kidney'
  // mediastinum / cardiac / vessels / airway
  | 'heart'
  | 'pericardium'
  | 'greatVessel'
  | 'esophagus'
  | 'airway'
  | 'thoracicCavity'
  | 'lymphNode'

export interface LabelBounds {
  min: [number, number, number]
  max: [number, number, number]
  voxels: number
}

/**
 * Geometry of a single-label voxel volume expressed in the LPS millimetre frame
 * used by 3D Slicer exports. The simulator renders 3D meshes and samples the
 * labelmap in this same frame, so the probe transform, beam, needle line, and
 * surface meshes all live in one coordinate space with no conversion.
 */
export interface VolumeGeometry {
  sizeXyz: [number, number, number]
  sourceSizeXyz: [number, number, number]
  strideXyz: [number, number, number]
  spacingXyzMm: [number, number, number]
  originLpsMm: [number, number, number]
  coordinateSystem: 'LPS'
}

/**
 * Shared probe transform. `posteriorMm` is the skin-contact coordinate on the
 * chest wall (the transform Y axis), `lateralMm`/`craniocaudalMm` slide along it.
 * Beam-forming settings (depth, gain, dynamic range, sector fan) and the
 * needle-guide angle round out the state the scene and B-mode panel both read.
 */
export interface ThoracicProbeState {
  lateralMm: number
  posteriorMm: number
  craniocaudalMm: number
  tiltDeg: number
  rotationDeg: number
  depthCm: number
  gain: number
  dynamicRangeDb: number
  sectorAngleDeg: number
  needleAngleDeg: number
}

export type ProbeStateKey = keyof ThoracicProbeState

export interface ProbeControlRange {
  min: number
  max: number
  step: number
}

export type ProbeType = 'curvilinear' | 'linear' | 'phased' | 'radial-ebus' | 'convex-ebus'

/**
 * A named probe configuration (transducer type + starting transform + control
 * ranges). Linear and curvilinear ship first; phased / radial / convex-EBUS are
 * reserved presets that reuse the same interface and frame-provider stack.
 */
export interface ProbePreset {
  id: string
  label: string
  probeType: ProbeType
  description?: string
  defaults: ThoracicProbeState
  ranges: Partial<Record<ProbeStateKey, ProbeControlRange>>
}

export type StructureCategory =
  | 'chest-wall'
  | 'lung'
  | 'pleura'
  | 'fluid'
  | 'diaphragm'
  | 'solid-organ'
  | 'vessel'
  | 'airway'
  | 'cardiac'
  | 'other'

/**
 * A structure the case exposes for rendering, labelling, and hazard reasoning.
 * `meshNames` link to GLB nodes; `code` links to a labelmap value; either or
 * both may be present.
 */
export interface ThoracicStructureLabelDef {
  label: ThoracicStructureLabel
  displayName: string
  category: StructureCategory
  code?: number
  meshNames?: string[]
  boundsLpsMm?: LabelBounds
  color?: string
  defaultVisible?: boolean
  /** True when the structure should be avoided by a needle trajectory. */
  hazard?: boolean
}

export type AnatomicRegion =
  | 'pleural'
  | 'thoracic'
  | 'lung'
  | 'diaphragm'
  | 'chest-wall'
  | 'cardiac'
  | 'mediastinal'
  | 'airway'

export type UltrasoundApplication =
  | 'pleural-effusion'
  | 'pneumothorax'
  | 'consolidation'
  | 'diaphragm-motion'
  | 'chest-wall'
  | 'cardiac'
  | 'mediastinal'
  | 'ebus'

/**
 * Where a B-mode frame can come from, in preference order. The runtime prefers
 * reviewed cached frames, then pose-indexed PLUS frames, then a browser render
 * (only when reviewed/acceptable), then a neutral placeholder.
 */
export type FrameSourceKind = 'reviewed-atlas' | 'plus-atlas' | 'browser-raymarch' | 'placeholder'

export type FrameQuality = 'reviewed' | 'acceptable' | 'prototype' | 'placeholder'

export interface FrameSource {
  id: string
  kind: FrameSourceKind
  status: FrameQuality
  /** Lower number = more preferred. */
  priority: number
  /** frames.json index for the `plus-atlas` kind. */
  indexUrl?: string
  notes?: string
}

export type FrameGeneratorSource =
  | 'browser-raymarcher'
  | 'plus-offline'
  | 'must-inspired-offline'
  | 'manual-curated'

export type FrameReviewStatus = 'reviewed' | 'needs-review'

export interface FrameAtlasTolerance {
  lateralMm: number
  craniocaudalMm: number
  tiltDeg: number
  rotationDeg: number
  depthCm: number
  sectorAngleDeg: number
}

export interface ThoracicFrameMetrics {
  maxFluidPocketMm: number
  meanFluidPocketMm: number
  fluidBeamFraction: number
  ribShadowBeamFraction: number
  diaphragmSeen: boolean
  lungSeen: boolean
  solidOrganSeen: boolean
  centralNeedle: NeedlePathAssessment
}

export interface NeedlePathAssessment {
  ribHit: boolean
  diaphragmHit: boolean
  solidOrganHit: boolean
  lungHit: boolean
  fluidRunMm: number
  firstFluidDepthMm: number | null
  safeWindow: boolean
}

export interface FrameAtlasEntry {
  id: string
  label: string
  description: string
  imageUrl: string
  maskUrl?: string
  probe: ThoracicProbeState
  metrics: ThoracicFrameMetrics
  /** Case-defined ground-truth key (e.g. an effusion pattern id). */
  groundTruthKey: string
  generator: {
    source: FrameGeneratorSource
    name: string
    version?: string
    createdAt?: string
    sourceUrls?: string[]
    notes?: string[]
  }
  reviewStatus: FrameReviewStatus
  reviewer?: string
  reviewedAt?: string
  educationalUse: string
  tags: string[]
}

export interface FrameAtlas {
  selectionTolerance: Partial<FrameAtlasTolerance>
  entries: FrameAtlasEntry[]
  notes?: string[]
}

export interface QualityStatus {
  overall: 'prototype' | 'reviewed' | 'mixed'
  /** Whether browser-generated frames are good enough to *show* a learner. */
  browserRaymarch: 'prototype' | 'acceptable' | 'reviewed'
  atlas: 'reviewed' | 'needs-review' | 'none'
  notes?: string[]
}

export type SimulationTaskKind =
  | 'find-window'
  | 'classify-pattern'
  | 'avoid-hazard'
  | 'identify-structure'
  | 'measure'
  | 'free-explore'

/**
 * A teaching task layered on top of the generic engine. Prompts stay neutral;
 * `hiddenGroundTruth` is not shown to the learner until they predict and reveal.
 */
export interface SimulationTask {
  id: string
  kind: SimulationTaskKind
  prompt: string
  application?: UltrasoundApplication
  options?: { id: string; label: string }[]
  hiddenGroundTruth?: string
  successHint?: string
}

export interface ThoracicLabelVolumeSpec {
  id: string
  url: string
  format: 'uint8-single-label'
  geometry: VolumeGeometry
  /** Labelmap code -> canonical structure label, e.g. `{ "7": "pleuralFluid" }`. */
  labelCodes: Record<string, ThoracicStructureLabel>
}

export interface SurfaceModelRef {
  name: string
  url: string
}

export interface ThoracicCaseSource {
  segmentationFileName?: string
  meshFileName?: string
  originalSegmentationFormat?: string
  sourceSizeXyz?: [number, number, number]
  sourceLayerCount?: number
  sourceSpace?: string
  sourcePolicy?: string
}

/**
 * Manifest v2. Version-gated: the loader detects the absence of `schemaVersion`
 * and adapts a legacy pleural v1 `case.json` into this shape without changing
 * the on-disk file.
 */
export interface ThoracicCaseManifest {
  schemaVersion: 2
  id: string
  name: string
  description: string
  safetyLabel: string
  anatomicRegion: AnatomicRegion
  supportedApplications: UltrasoundApplication[]
  meshUrl: string
  probeModelUrl?: string
  surfaceModels?: SurfaceModelRef[]
  primaryLabelVolume: ThoracicLabelVolumeSpec
  /** Optional future QA / reslice inputs; unused by the current runtime. */
  labelVolumeUrl?: string
  intensityVolumeUrl?: string
  structures: ThoracicStructureLabelDef[]
  probePresets: ProbePreset[]
  defaultProbePresetId: string
  frameSources: FrameSource[]
  frameAtlas?: FrameAtlas
  qualityStatus: QualityStatus
  learningTasks: SimulationTask[]
  source?: ThoracicCaseSource
}

/** Runtime labelmap wrapper. `resolveLabel` maps a raw code to a label. */
export interface ThoracicVolume {
  data: Uint8Array
  geometry: VolumeGeometry
  resolveLabel: (code: number) => ThoracicStructureLabel
}

/**
 * The case-specific acoustic + display behaviour the generic B-mode loops need.
 * The default thoracic model implements physically-generic ultrasound behaviour
 * (anechoic fluid, rib shadowing, posterior enhancement); cases may override it.
 */
export interface TissueModel {
  /** Primary fluid label the metrics track (e.g. `pleuralFluid`). */
  fluidLabel: ThoracicStructureLabel
  /** Label used to fill near-field background inside the patient body. */
  fillLabel: ThoracicStructureLabel
  materials: Record<string, AcousticMaterial>
  isSolidOrgan: (label: ThoracicStructureLabel) => boolean
  backscatter: (label: ThoracicStructureLabel) => number
  interfaceEcho: (previous: ThoracicStructureLabel, next: ThoracicStructureLabel) => number
  texture: (worldPoint: Vec3, label: ThoracicStructureLabel, depthMm: number) => number
  displayGray: (ctx: DisplayGrayContext) => number
}

export interface AcousticMaterial {
  scatter: number
  attenuation: number
  reflectivity: number
  castsShadow?: boolean
  posteriorEnhancement?: number
  airInterface?: boolean
}

export interface DisplayGrayContext {
  label: ThoracicStructureLabel
  renderLabel: ThoracicStructureLabel
  gray: number
  boundaryEcho: number
  fluidBoundary: boolean
  ribCortex: boolean
}
