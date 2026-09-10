export type CasePlane = 'axial' | 'coronal' | 'sagittal';
export type CaseSelectionMode = 'station' | 'target';
export type ToggleSetId = 'lymph_nodes' | 'airway' | 'vessels' | 'cardiac' | 'gi';
export type SegmentationGroupId = 'airway' | 'vessels' | 'nodes' | 'cardiac' | 'gi' | 'other';
export type AxisName = 'i' | 'j' | 'k';
export type SceneLayerId = 'anatomy' | CasePlane;
export type Vector3Tuple = [number, number, number];
export type Matrix3 = [Vector3Tuple, Vector3Tuple, Vector3Tuple];
export type Matrix4Tuple = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export const CASE3D_PLANES: CasePlane[] = ['axial', 'coronal', 'sagittal'];
export const CASE3D_TOGGLE_SET_IDS: ToggleSetId[] = ['lymph_nodes', 'airway', 'vessels', 'cardiac', 'gi'];
export const DEFAULT_CASE3D_VISIBLE_TOGGLE_SET_IDS: ToggleSetId[] = ['lymph_nodes', 'airway', 'vessels'];
export const DEFAULT_CASE3D_PLANE: CasePlane = 'axial';
export const DEFAULT_CASE3D_VIEWER_VISIBILITY: ViewerVisibility = {
  anatomy: true,
  axial: true,
  coronal: true,
  sagittal: true,
};
export const DEFAULT_CASE3D_VIEWER_OPACITY: ViewerOpacity = {
  anatomy: 0.52,
  axial: 0.88,
  coronal: 0.78,
  sagittal: 0.78,
};

export interface SliceIndex {
  axial: number;
  coronal: number;
  sagittal: number;
}

export type ToggleSet = Record<ToggleSetId, boolean>;

export interface SliceCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SliceSeriesEntry {
  folder: string;
  count: number;
  framePattern: string | null;
  displayOrientation: CasePlane;
  coverageAssumption: [number, number];
  indexDerivation: string;
  sourceFolderSpelling?: string;
  crop?: SliceCrop;
}

export interface SliceSeries {
  axial: SliceSeriesEntry;
  coronal: SliceSeriesEntry;
  sagittal: SliceSeriesEntry;
}

export interface CaseAssets {
  glbFile: string;
  glbHighlightFile?: string;
  ctVolumeFile: string;
  segmentationFile?: string;
}

export interface CaseTarget {
  id: string;
  label: string;
  displayLabel: string;
  kind: 'lymph_node' | 'landmark';
  stationId?: string;
  stationGroupId?: string;
  markupFile: string;
  meshNameExpected?: string;
  meshNameVerified?: boolean;
  deriveSliceIndexFromMarkup?: boolean;
  sliceIndex: {
    axial: number | null;
    coronal: number | null;
    sagittal: number | null;
  };
  notes?: string;
  meshName?: string;
}

export interface CaseStation {
  id: string;
  label: string;
  groupLabel: string;
  targetIds: string[];
  primaryTargetId: string;
  kind: 'nodal_station';
}

export interface CaseManifest {
  schemaVersion: number;
  caseId: string;
  title: string;
  description: string;
  assets: CaseAssets;
  coordinateAssumptions: {
    worldCoordinateSystem: string;
    sliceIndicesMustBeDerivedFrom: string[];
    note: string;
  };
  sliceSeries: SliceSeries;
  stations: CaseStation[];
  targets: CaseTarget[];
}

export interface AxisMap {
  sagittal: AxisName;
  coronal: AxisName;
  axial: AxisName;
}

export interface VolumeGeometry {
  coordinateSystem: 'LPS';
  sizes: Vector3Tuple;
  spaceDirections: Matrix3;
  spaceOrigin: Vector3Tuple;
  axisMap: AxisMap;
  ijkToWorldMatrix: Matrix4Tuple;
  worldToIjkMatrix: Matrix4Tuple;
}

export interface PatientSpaceTransform {
  name: 'patientToScene';
  from: 'LPS-mm';
  to: 'three-scene-meters';
  matrix: Matrix4Tuple;
  inverseMatrix: Matrix4Tuple;
  note: string;
}

export interface SliceTextureMetadata {
  pixelWidth: number;
  pixelHeight: number;
  crop: SliceCrop;
  sourceLooksCropped: boolean;
  warning: string | null;
}

export interface ViewerVisibility {
  anatomy: boolean;
  axial: boolean;
  coronal: boolean;
  sagittal: boolean;
}

export interface ViewerOpacity {
  anatomy: number;
  axial: number;
  coronal: number;
  sagittal: number;
}

export interface EnrichedCaseTarget extends Omit<CaseTarget, 'sliceIndex'> {
  sliceIndex: SliceIndex;
  voxelIndex: SliceIndex;
  structureGroupId: ToggleSetId;
  markup: {
    coordinateSystem: 'LPS';
    sourceCoordinateSystem: string;
    position: Vector3Tuple;
  };
  world: {
    coordinateSystem: 'LPS';
    position: Vector3Tuple;
  };
  derived: {
    continuousVoxel: Vector3Tuple;
    roundedVoxel: Vector3Tuple;
    normalized: Record<CasePlane, number>;
    axisMap: AxisMap;
    scenePosition: Vector3Tuple;
  };
  meshExists: boolean;
  meshNameResolved: string | null;
}

export interface EnrichedCaseManifest extends Omit<CaseManifest, 'targets'> {
  generatedAt: string;
  volumeGeometry: VolumeGeometry;
  patientToScene: PatientSpaceTransform;
  meshNames: string[];
  sliceAssetCounts: Record<CasePlane, number>;
  sliceTextureMetadata: Record<CasePlane, SliceTextureMetadata>;
  warnings: string[];
  targets: EnrichedCaseTarget[];
}

export interface WorldBounds {
  coordinateSystem: 'LPS';
  min: Vector3Tuple;
  max: Vector3Tuple;
}

export interface SegmentationSegment {
  index: number;
  id: string;
  name: string;
  labelValue: number;
  layer: number;
  color: Vector3Tuple;
  extent: [number, number, number, number, number, number];
  groupId: SegmentationGroupId;
  targetIds: string[];
  stationIds: string[];
  meshNameResolved: string | null;
}

export interface SegmentationVolumeGeometry {
  coordinateSystem: 'LPS';
  sizes: Vector3Tuple;
  componentCount: number;
  spaceDirections: Matrix3;
  spaceOrigin: Vector3Tuple;
  ijkToWorldMatrix: Matrix4Tuple;
  worldToIjkMatrix: Matrix4Tuple;
  worldBounds: WorldBounds;
  referenceImageGeometry?: string;
}

export interface RuntimeCaseBounds {
  ct: WorldBounds;
  segmentation: WorldBounds;
  union: WorldBounds;
}

export interface RuntimeCaseTarget extends EnrichedCaseTarget {
  recommendedSliceIndex: SliceIndex;
  matchedSegmentIds: string[];
  insideCtBounds: boolean;
  insideSegmentationBounds: boolean;
}

export interface RuntimeCaseManifest extends Omit<EnrichedCaseManifest, 'targets'> {
  runtimeSchemaVersion: number;
  bounds: RuntimeCaseBounds;
  segmentation: SegmentationVolumeGeometry & {
    segments: SegmentationSegment[];
  };
  targets: RuntimeCaseTarget[];
}

export interface CaseReviewPrompt {
  id: string;
  prompt: string;
  answerKind: 'station' | 'target';
  correctId: string;
  optionIds: string[];
  explanation: string;
}

export interface Case3DModuleContent {
  introSections: Array<{
    id: string;
    title: string;
    summary: string;
    takeaway: string;
  }>;
  reviewPrompts: CaseReviewPrompt[];
}

export interface Case3DExplorerProgress {
  selectedStationId: string | null;
  selectedTargetId: string | null;
  selectedPlane: CasePlane;
  visibleToggleSetIds: ToggleSetId[];
  viewerVisibility: ViewerVisibility;
  viewerOpacity: ViewerOpacity;
  visitedTargetIds: string[];
  reviewScore: number | null;
}
