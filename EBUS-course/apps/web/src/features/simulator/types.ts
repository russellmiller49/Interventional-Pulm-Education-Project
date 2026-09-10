export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export interface SimulatorMeshAsset {
  vertices: Vec3[];
  triangles: Vec3[];
}

export interface SimulatorPointCloudAsset {
  key: string;
  label: string;
  points: Vec3[];
}

export interface SimulatorCenterlinePolyline {
  line_index: number;
  points: Vec3[];
  cumulative_lengths_mm: number[];
  total_length_mm: number;
}

export interface SimulatorCenterlineAsset {
  primary_line_index: number;
  primary_total_length_mm: number;
  polylines: SimulatorCenterlinePolyline[];
}

export interface SimulatorListedAsset {
  key: string;
  label: string;
  asset: string;
  color: string;
  point_count: number;
}

export interface SimulatorCleanModelAsset {
  key: string;
  label: string;
  asset: string;
  coordinate_frame: string;
  web_transform: string;
  primary?: boolean;
}

export interface SimulatorScopeModelAsset {
  key: string;
  label: string;
  asset: string;
  coordinate_frame: string;
  shaft_axis: string;
  depth_axis: string;
  lateral_axis: string;
  origin: string;
  fan_apex_anchor?: {
    x?: 'min' | 'center' | 'max';
    y?: 'min' | 'center' | 'max';
    z?: 'min' | 'center' | 'max';
  };
  fan_apex_anchor_point?: Vec3 | null;
  scale_mm_per_unit: number;
  lock_to_fan?: boolean;
  show_auxiliary_shaft?: boolean;
}

export interface SimulatorPreset {
  preset_key: string;
  preset_id: string;
  station: string;
  node: string;
  approach: string;
  label: string;
  line_index: number;
  centerline_s_mm: number;
  contact: Vec3;
  contact_lps?: Vec3;
  target: Vec3;
  target_lps: Vec3;
  station_asset?: string;
  station_key: string;
  vessel_overlays: string[];
  contact_to_target_distance_mm: number;
  shaft_axis?: Vec3 | null;
  shaft_axis_lps?: Vec3 | null;
  depth_axis?: Vec3 | null;
  depth_axis_lps?: Vec3 | null;
  lateral_axis?: Vec3 | null;
  lateral_axis_lps?: Vec3 | null;
}

export interface SimulatorNodeMarker {
  key: string;
  preset_key: string;
  station_key: string;
  label: string;
  position: Vec3;
  position_lps?: Vec3;
  radius_mm: number;
  color: string;
}

/**
 * Which scope-frame axis the optical axis tilts toward: the forward-oblique view direction is the
 * shaft axis rotated `optical_axis_offset_deg` toward this axis. Kept as a named axis (not a raw
 * sign) so the calibration record stays readable and the scan side can be flipped without touching
 * code.
 */
export type SimulatorObliquityAxis =
  | 'depth_axis'
  | 'negative_depth_axis'
  | 'lateral_axis'
  | 'negative_lateral_axis';

/**
 * Device-calibration record for the endoscopic optical camera. Optional and additive: manifests
 * without it fall back to the built-in default profile, so existing cases keep loading.
 */
export interface SimulatorEndoscopeCamera {
  model: string;
  optical_axis_offset_deg: number;
  obliquity_axis: SimulatorObliquityAxis;
  fov_deg: number;
  near_mm: number;
  far_mm: number;
  eye_offset_mm: {
    shaft: number;
    depth: number;
    lateral: number;
  };
  circular_aperture?: boolean;
  lens_distortion?: boolean;
  scope_tip_occlusion?: boolean;
  contact_cap?: boolean;
  headlight_falloff?: boolean;
  /** Minimum camera-to-wall clearance along the optical axis; omitted or 0 disables the clamp. */
  contact_min_distance_mm?: number;
}

/** Device-calibration record for the sector-image probe. Optional and additive. */
export interface SimulatorUltrasoundProbe {
  sector_angle_deg: number;
  displayed_range_mm: number;
  optical_axis_offset_deg?: number;
}

export interface SimulatorCaseManifest {
  case_id: string;
  render_defaults: {
    sector_angle_deg: number;
    max_depth_mm: number;
    roll_deg: number;
    sector_realism?: 'classic' | 'realistic' | 'physics';
  };
  bounds: {
    min: Vec3;
    max: Vec3;
    center: Vec3;
    size: Vec3;
  };
  assets: {
    airway_mesh: string;
    centerlines: string;
    vessels: SimulatorListedAsset[];
    stations: SimulatorListedAsset[];
    clean_models?: SimulatorCleanModelAsset[];
    scope_model?: SimulatorScopeModelAsset | null;
  };
  navigation: {
    primary_line_index: number;
    primary_total_length_mm: number;
  };
  presets: SimulatorPreset[];
  anatomy: {
    nodes: SimulatorNodeMarker[];
  };
  color_map: Record<string, string>;
  endoscope_camera?: SimulatorEndoscopeCamera;
  ultrasound_probe?: SimulatorUltrasoundProbe;
  sector_snapshots?: Record<string, string>;
  physics_snapshots?: Record<string, string>;
  notes?: Record<string, string>;
}

export interface SimulatorLoadedAssets {
  airway: SimulatorMeshAsset;
  centerlines: SimulatorCenterlineAsset;
  vessels: Record<string, SimulatorPointCloudAsset>;
  stations: Record<string, SimulatorPointCloudAsset>;
}

export interface SimulatorSectorRasterMask {
  width: number;
  height: number;
  /** Row-major alpha samples (0-255). Manifest masks arrive as plain JSON arrays; live browser
   * masks stay as Uint8Array to avoid copying ~100k elements per structure per pose update. */
  alpha: number[] | Uint8Array;
  source?: string;
  depth_samples?: number;
  lateral_samples?: number;
  debug?: {
    rawPointsMm?: Vec2[];
    crossingPointsMm?: Vec2[];
    hullsMm?: Vec2[][];
    finalContoursMm?: Vec2[][];
  };
}

export interface SimulatorVolumeSectorLabel {
  id: string;
  key: string;
  label: string;
  kind: 'node' | 'vessel';
  color: string;
  depth_mm: number;
  lateral_mm: number;
  visible: boolean;
  depth_extent_mm?: [number, number];
  lateral_extent_mm?: [number, number];
  major_axis_mm?: number;
  minor_axis_mm?: number;
  major_axis_vector_mm?: [number, number];
  aspect_ratio?: number;
  contours_mm?: Vec2[][];
  contour_count?: number;
  contour_source?: string;
  contour_closed?: boolean[];
  has_closed_contour?: boolean;
  raster_mask?: SimulatorSectorRasterMask | null;
}

export interface SimulatorVolumeSectorResponse {
  source: 'volume_masks';
  sector: {
    labels: SimulatorVolumeSectorLabel[];
  };
}

/**
 * Sidecar JSON written next to each station-anchored physics sector PNG by
 * tools/ebus-simulator/src/ebus_simulator/physics_snapshot_export.py. `image` is a
 * case-relative path to the grayscale PNG; points/axes are in the web frame.
 */
export interface SimulatorPhysicsSnapshotMetadata {
  engine: 'physics';
  engine_version: string;
  model: string;
  video_axis_offset_deg: number;
  sector_angle_deg: number;
  max_depth_mm: number;
  roll_deg: number;
  contact: Vec3;
  contact_lps?: Vec3;
  shaft_axis: Vec3;
  shaft_axis_lps?: Vec3;
  depth_axis: Vec3;
  depth_axis_lps?: Vec3;
  lateral_axis: Vec3 | null;
  lateral_axis_lps?: Vec3 | null;
}

export interface SimulatorPhysicsSnapshot {
  schema_version: 1;
  preset_key: string;
  image: string;
  metadata: SimulatorPhysicsSnapshotMetadata;
  labels: SimulatorVolumeSectorLabel[];
  masks?: Record<string, unknown>;
}

export interface SimulatorSectorSnapshot {
  schema_version: 1;
  preset_key: string;
  query: {
    line_index: number;
    s_mm: number;
    roll_deg: number;
    max_depth_mm: number;
    sector_angle_deg: number;
  };
  response: SimulatorVolumeSectorResponse;
}

export interface SimulatorSectorItem {
  id: string;
  label: string;
  kind: 'airway' | 'node' | 'vessel' | 'contact';
  color: string;
  depthMm: number;
  lateralMm: number;
  visible: boolean;
  depthExtentMm?: [number, number];
  lateralExtentMm?: [number, number];
  majorAxisMm?: number;
  minorAxisMm?: number;
  majorAxisVectorMm?: [number, number];
  aspectRatio?: number;
  contoursMm?: Vec2[][];
  contourCount?: number;
  contourSource?: string;
  contourClosed?: boolean[];
  hasClosedContour?: boolean;
  rasterMask?: SimulatorSectorRasterMask | null;
}

export interface SimulatorLayerState {
  airway: boolean;
  vessels: boolean;
  heart: boolean;
  nodes: boolean;
  stations: boolean;
  context: boolean;
  centerline: boolean;
  fan: boolean;
  cutPlane: boolean;
}
