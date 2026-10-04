import type { AcousticLabel, AcousticVolumeMetadata } from '@bronchoscopy-core/acoustic';
import type { Point3 } from '@bronchoscopy-core/frame';

/** Tissue classes the EUS-B renderer distinguishes. Written per label by build-eus-b-case.py. */
export type EusMedium =
  | 'air'
  | 'soft'
  | 'fat'
  | 'bone'
  | 'blood'
  | 'fluid'
  | 'node'
  | 'gi_wall'
  | 'liver'
  | 'kidney'
  | 'adrenal'
  | 'pancreas'
  | 'spleen'
  | 'renal_sinus'
  | 'bowel_contents';

export type EusStructureGroup =
  | 'node'
  | 'vessel'
  | 'heart'
  | 'airway'
  | 'gi'
  | 'bowel'
  | 'organ'
  | 'bone'
  | 'background';

export interface EusAcousticLabel extends AcousticLabel {
  medium: EusMedium;
  group: EusStructureGroup;
  /** False for background classes and lumen contents, which are named on hover but never listed. */
  reportable: boolean;
}

export interface EusAcousticMetadata extends Omit<AcousticVolumeMetadata, 'labels'> {
  labels: EusAcousticLabel[];
  assumptions?: string[];
}

export interface EusAcousticVolume {
  metadata: EusAcousticMetadata;
  data: Uint8Array;
}

export interface EusStructure {
  key: string;
  label: string;
  group: EusStructureGroup;
  color: string;
  medium?: EusMedium;
  labelId?: number;
  volumeMl?: number;
  triangles?: number;
  centroidLps?: Point3;
  /** Learner-facing caveat written by the case build, e.g. a contour that marks a location. */
  note?: string;
}

export interface EusLandmarkPose {
  key: string;
  sMm: number;
  rollDeg: number;
  flexDeg: number;
  score: number;
  /** Structure keys the calibration found in the sector at this pose, largest first. */
  inView: string[];
  expectedPose: {
    originLps: Point3;
    depthAxisLps: Point3;
    lateralAxisLps: Point3;
  };
}

export interface EusPathLevel {
  key: string;
  label: string;
  fromSMm: number;
  toSMm: number;
}

export interface EusCtAsset {
  data: string;
  sizeXyz: Point3;
  spacingXyzMm: Point3;
  originLps: Point3;
  windowHu: [number, number];
  dataSha256: string;
  /**
   * Structures whose appearance was painted into this CT by the case build. The patient's scan
   * does not show them, so every view of the CT that includes one must say so.
   */
  paintedStructures?: string[];
}

export interface EusCaseManifest {
  schema: 'eus-b-case/v1';
  caseId: string;
  assetVersion: string;
  sourceGeometrySha256: string;
  probe: {
    sectorAngleDeg: number;
    defaultDepthMm: number;
    frequencyMHz: number;
    rollConvention: string;
    imageConvention: string;
  };
  path: {
    totalLengthMm: number;
    gejSMm: number;
    /** Named stretches of the path, bounded by this patient's own anatomy. */
    levels: EusPathLevel[];
    incisorOffsetMm: number;
    incisorOffsetBasis: string;
  };
  assets: {
    acoustic: { metadata: string; data: string };
    path: string;
    ct: EusCtAsset;
    model: { asset: string; frame: 'web_mm'; sha256: string };
    /** Open esophagus-and-stomach lumen for the endoscopic view. */
    lumen: { asset: string; frame: 'web_mm'; sha256: string };
  };
  bounds: { min: Point3; max: Point3 };
  structures: EusStructure[];
  landmarks: EusLandmarkPose[];
  notes: Record<string, string>;
}

export interface EusScopePath {
  schema: 'eus-b-scope-path/v1';
  stepMm: number;
  totalLengthMm: number;
  gejSMm: number;
  wallStepDeg: number;
  wallInsetMm: number;
  pointsLps: Point3[];
  tangentsLps: Point3[];
  /** Parallel-transported zero-roll direction; faces anterior at the top of the path. */
  refAxesLps: Point3[];
  /** Path-to-contact distance, indexed [path sample][roll step]. */
  wallMm: number[][];
}

export interface EusCtVolume {
  asset: EusCtAsset;
  data: Uint8Array;
}

export interface EusScopeState {
  /** Distance advanced along the scope path. */
  sMm: number;
  /** Shaft rotation. Positive is clockwise as the operator sees it. */
  rollDeg: number;
  /** Tip angulation. Positive is up, toward the transducer side. */
  flexDeg: number;
}

export interface EusLayerState {
  node: boolean;
  vessel: boolean;
  heart: boolean;
  airway: boolean;
  gi: boolean;
  bowel: boolean;
  organ: boolean;
  bone: boolean;
}
