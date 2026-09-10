import { axisNameToIndex, worldToContinuousVoxel } from '../../../../../features/case3d/patient-space';

import type { CasePlane, RuntimeCaseManifest, Vector3Tuple } from '../../../../../features/case3d/types';

export type OrthogonalClipMode = 'none' | 'hide-above' | 'hide-below';

export interface CaseViewerState {
  selectedStationId: string;
  selectedTargetId: string;
  crosshairVoxel: Vector3Tuple;
  planeVisibility: Record<CasePlane, boolean>;
  threeDOrthogonalPlanesVisible: boolean;
  orthogonalPlaneOpacity: number;
  orthogonalClip: {
    mode: OrthogonalClipMode;
    plane: CasePlane;
  };
  sliceSegmentationVisible: boolean;
  overlayOpacity: number;
  hiddenSegmentIds: string[];
  overlayGroups: {
    allAnatomy: boolean;
    airway: boolean;
    vessels: boolean;
    nodes: boolean;
  };
  cutPlane: {
    opacity: number;
    visible: boolean;
    origin: Vector3Tuple;
    normal: Vector3Tuple;
    initialOrigin: Vector3Tuple;
    initialNormal: Vector3Tuple;
  };
}

export type CaseViewerAction =
  | { type: 'select-station'; stationId: string; targetId: string; world: Vector3Tuple; manifest: RuntimeCaseManifest }
  | { type: 'select-target'; stationId: string; targetId: string; world: Vector3Tuple; manifest: RuntimeCaseManifest }
  | { type: 'set-crosshair-world'; world: Vector3Tuple; manifest: RuntimeCaseManifest }
  | { type: 'set-plane-axis-index'; plane: CasePlane; axisIndex: number; manifest: RuntimeCaseManifest }
  | { type: 'set-plane-visibility'; plane: CasePlane; visible: boolean }
  | { type: 'set-three-d-plane-visibility'; visible: boolean }
  | { type: 'set-three-d-plane-opacity'; value: number }
  | { type: 'set-orthogonal-clip-mode'; mode: OrthogonalClipMode }
  | { type: 'set-orthogonal-clip-plane'; plane: CasePlane }
  | { type: 'set-slice-segmentation-visibility'; visible: boolean }
  | { type: 'set-overlay-opacity'; value: number }
  | { type: 'set-overlay-group'; key: keyof CaseViewerState['overlayGroups']; value: boolean }
  | { type: 'set-segment-visibility'; segmentId: string; visible: boolean }
  | { type: 'set-segments-visibility'; segmentIds: string[]; visible: boolean }
  | { type: 'set-cut-plane-visibility'; visible: boolean }
  | { type: 'set-cut-plane-opacity'; value: number }
  | { type: 'set-cut-plane'; origin: Vector3Tuple; normal: Vector3Tuple }
  | { type: 'reset-cut-plane' };

const DEFAULT_CUT_NORMAL: Vector3Tuple = [0.82, -0.18, 0.54];

function clampOverlay(value: number) {
  return Math.max(0.05, Math.min(1, value));
}

function clampPlaneOpacity(value: number) {
  return Math.max(0, Math.min(1, value));
}

function worldToCaseVoxel(manifest: RuntimeCaseManifest, world: Vector3Tuple): Vector3Tuple {
  return worldToContinuousVoxel(world, manifest.volumeGeometry);
}

function selectWorld(manifest: RuntimeCaseManifest, world: Vector3Tuple) {
  const voxel = worldToCaseVoxel(manifest, world);

  return [
    Math.max(0, Math.min(manifest.volumeGeometry.sizes[0] - 1, voxel[0])),
    Math.max(0, Math.min(manifest.volumeGeometry.sizes[1] - 1, voxel[1])),
    Math.max(0, Math.min(manifest.volumeGeometry.sizes[2] - 1, voxel[2])),
  ] as Vector3Tuple;
}

export function createInitialViewerState(manifest: RuntimeCaseManifest): CaseViewerState {
  const initialStation = manifest.stations[0];
  const initialTarget =
    manifest.targets.find((target) => target.id === initialStation.primaryTargetId) ?? manifest.targets[0];
  const cutOrigin = initialTarget.world.position;

  return {
    selectedStationId: initialStation.id,
    selectedTargetId: initialTarget.id,
    crosshairVoxel: selectWorld(manifest, initialTarget.world.position),
    planeVisibility: {
      axial: true,
      coronal: true,
      sagittal: true,
    },
    threeDOrthogonalPlanesVisible: true,
    orthogonalPlaneOpacity: 0.28,
    orthogonalClip: {
      mode: 'none',
      plane: 'axial',
    },
    sliceSegmentationVisible: false,
    overlayOpacity: 0.68,
    hiddenSegmentIds: [],
    overlayGroups: {
      allAnatomy: false,
      airway: true,
      vessels: true,
      nodes: true,
    },
    cutPlane: {
      opacity: 0.48,
      visible: false,
      origin: cutOrigin,
      normal: DEFAULT_CUT_NORMAL,
      initialOrigin: cutOrigin,
      initialNormal: DEFAULT_CUT_NORMAL,
    },
  };
}

export function caseViewerReducer(state: CaseViewerState, action: CaseViewerAction): CaseViewerState {
  switch (action.type) {
    case 'select-station':
    case 'select-target':
      return {
        ...state,
        selectedStationId: action.stationId,
        selectedTargetId: action.targetId,
        crosshairVoxel: selectWorld(action.manifest, action.world),
        cutPlane: {
          ...state.cutPlane,
          origin: action.world,
          initialOrigin: action.world,
        },
      };
    case 'set-crosshair-world':
      return {
        ...state,
        crosshairVoxel: selectWorld(action.manifest, action.world),
        cutPlane: {
          ...state.cutPlane,
          origin: action.world,
        },
      };
    case 'set-plane-axis-index': {
      const axisMap = action.manifest.volumeGeometry.axisMap;
      const nextVoxel = [...state.crosshairVoxel] as Vector3Tuple;
      const axisName = axisMap[action.plane];
      nextVoxel[axisNameToIndex(axisName)] = Math.max(
        0,
        Math.min(action.manifest.volumeGeometry.sizes[axisNameToIndex(axisName)] - 1, action.axisIndex),
      );

      return {
        ...state,
        crosshairVoxel: nextVoxel,
      };
    }
    case 'set-plane-visibility':
      return {
        ...state,
        planeVisibility: {
          ...state.planeVisibility,
          [action.plane]: action.visible,
        },
      };
    case 'set-three-d-plane-visibility':
      return {
        ...state,
        threeDOrthogonalPlanesVisible: action.visible,
      };
    case 'set-three-d-plane-opacity':
      return {
        ...state,
        orthogonalPlaneOpacity: clampPlaneOpacity(action.value),
      };
    case 'set-orthogonal-clip-mode':
      return {
        ...state,
        orthogonalClip: {
          ...state.orthogonalClip,
          mode: action.mode,
        },
      };
    case 'set-orthogonal-clip-plane':
      return {
        ...state,
        orthogonalClip: {
          ...state.orthogonalClip,
          plane: action.plane,
        },
      };
    case 'set-slice-segmentation-visibility':
      return {
        ...state,
        sliceSegmentationVisible: action.visible,
      };
    case 'set-overlay-opacity':
      return {
        ...state,
        overlayOpacity: clampOverlay(action.value),
      };
    case 'set-overlay-group':
      return {
        ...state,
        overlayGroups: {
          ...state.overlayGroups,
          [action.key]: action.value,
        },
      };
    case 'set-segment-visibility': {
      const hiddenSet = new Set(state.hiddenSegmentIds);

      if (action.visible) {
        hiddenSet.delete(action.segmentId);
      } else {
        hiddenSet.add(action.segmentId);
      }

      return {
        ...state,
        hiddenSegmentIds: [...hiddenSet],
      };
    }
    case 'set-segments-visibility': {
      const hiddenSet = new Set(state.hiddenSegmentIds);

      action.segmentIds.forEach((segmentId) => {
        if (action.visible) {
          hiddenSet.delete(segmentId);
        } else {
          hiddenSet.add(segmentId);
        }
      });

      return {
        ...state,
        hiddenSegmentIds: [...hiddenSet],
      };
    }
    case 'set-cut-plane-visibility':
      return {
        ...state,
        cutPlane: {
          ...state.cutPlane,
          visible: action.visible,
        },
      };
    case 'set-cut-plane-opacity':
      return {
        ...state,
        cutPlane: {
          ...state.cutPlane,
          opacity: clampOverlay(action.value),
        },
      };
    case 'set-cut-plane':
      return {
        ...state,
        cutPlane: {
          ...state.cutPlane,
          origin: action.origin,
          normal: action.normal,
        },
      };
    case 'reset-cut-plane':
      return {
        ...state,
        cutPlane: {
          ...state.cutPlane,
          origin: state.cutPlane.initialOrigin,
          normal: state.cutPlane.initialNormal,
        },
      };
    default:
      return state;
  }
}
