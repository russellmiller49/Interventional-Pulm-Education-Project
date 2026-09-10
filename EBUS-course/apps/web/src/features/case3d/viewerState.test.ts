import { describe, expect, it } from 'vitest';

import runtimeData from '../../../../../content/cases/case_001.runtime.json';

import { caseViewerReducer, createInitialViewerState } from './viewerState';

import type { RuntimeCaseManifest } from '../../../../../features/case3d/types';

const manifest = runtimeData as unknown as RuntimeCaseManifest;

describe('caseViewerReducer', () => {
  it('starts with helper planes visible and cut plane hidden for the full-field 3D view', () => {
    const initialState = createInitialViewerState(manifest);

    expect(initialState.threeDOrthogonalPlanesVisible).toBe(true);
    expect(initialState.orthogonalPlaneOpacity).toBeCloseTo(0.28, 3);
    expect(initialState.orthogonalClip).toEqual({ mode: 'none', plane: 'axial' });
    expect(initialState.sliceSegmentationVisible).toBe(false);
    expect(initialState.cutPlane.visible).toBe(false);
    expect(initialState.cutPlane.opacity).toBeCloseTo(0.48, 3);
  });

  it('moves the crosshair and cut plane when selecting a target', () => {
    const initialState = createInitialViewerState(manifest);
    const target = manifest.targets.find((entry) => entry.id === 'landmark_carina') ?? manifest.targets[0];

    const nextState = caseViewerReducer(initialState, {
      type: 'select-target',
      manifest,
      stationId: target.stationId ?? initialState.selectedStationId,
      targetId: target.id,
      world: target.world.position,
    });

    expect(nextState.selectedTargetId).toBe(target.id);
    expect(nextState.cutPlane.origin).toEqual(target.world.position);
    expect(nextState.crosshairVoxel[2]).toBeCloseTo(target.derived.continuousVoxel[2], 3);
  });

  it('updates the requested orthogonal axis index without disturbing the others', () => {
    const initialState = createInitialViewerState(manifest);

    const nextState = caseViewerReducer(initialState, {
      type: 'set-plane-axis-index',
      plane: 'axial',
      axisIndex: 80,
      manifest,
    });

    expect(nextState.crosshairVoxel[2]).toBe(80);
    expect(nextState.crosshairVoxel[0]).toBe(initialState.crosshairVoxel[0]);
    expect(nextState.crosshairVoxel[1]).toBe(initialState.crosshairVoxel[1]);
  });

  it('moves CT slices to a picked world position without changing the selected target', () => {
    const initialState = createInitialViewerState(manifest);
    const target = manifest.targets.find((entry) => entry.id === 'landmark_carina') ?? manifest.targets[0];

    const nextState = caseViewerReducer(initialState, {
      type: 'set-crosshair-world',
      manifest,
      world: target.world.position,
    });

    expect(nextState.selectedTargetId).toBe(initialState.selectedTargetId);
    expect(nextState.crosshairVoxel[2]).toBeCloseTo(target.derived.continuousVoxel[2], 3);
    expect(nextState.cutPlane.origin).toEqual(target.world.position);
  });

  it('clamps the 3D orthogonal plane opacity into a valid range', () => {
    const initialState = createInitialViewerState(manifest);

    const hiddenState = caseViewerReducer(initialState, {
      type: 'set-three-d-plane-opacity',
      value: -1,
    });
    const visibleState = caseViewerReducer(initialState, {
      type: 'set-three-d-plane-opacity',
      value: 2,
    });

    expect(hiddenState.orthogonalPlaneOpacity).toBe(0);
    expect(visibleState.orthogonalPlaneOpacity).toBe(1);
  });

  it('tracks per-segment visibility overrides', () => {
    const initialState = createInitialViewerState(manifest);
    const segmentId = manifest.segmentation.segments[0]?.id;

    if (!segmentId) {
      throw new Error('Expected at least one segment in the runtime manifest.');
    }

    const hiddenState = caseViewerReducer(initialState, {
      type: 'set-segment-visibility',
      segmentId,
      visible: false,
    });
    const restoredState = caseViewerReducer(hiddenState, {
      type: 'set-segment-visibility',
      segmentId,
      visible: true,
    });

    expect(hiddenState.hiddenSegmentIds).toContain(segmentId);
    expect(restoredState.hiddenSegmentIds).not.toContain(segmentId);
  });

  it('can hide and restore node segments as a batch', () => {
    const initialState = createInitialViewerState(manifest);
    const nodeSegmentIds = manifest.segmentation.segments
      .filter((segment) => segment.groupId === 'nodes')
      .slice(0, 3)
      .map((segment) => segment.id);

    const hiddenState = caseViewerReducer(initialState, {
      type: 'set-segments-visibility',
      segmentIds: nodeSegmentIds,
      visible: false,
    });
    const restoredState = caseViewerReducer(hiddenState, {
      type: 'set-segments-visibility',
      segmentIds: [nodeSegmentIds[1]],
      visible: true,
    });

    expect(hiddenState.hiddenSegmentIds).toEqual(expect.arrayContaining(nodeSegmentIds));
    expect(restoredState.hiddenSegmentIds).not.toContain(nodeSegmentIds[1]);
    expect(restoredState.hiddenSegmentIds).toEqual(expect.arrayContaining([nodeSegmentIds[0], nodeSegmentIds[2]]));
  });

  it('tracks the orthogonal CT plane clipping choice', () => {
    const initialState = createInitialViewerState(manifest);
    const clippedState = caseViewerReducer(initialState, {
      type: 'set-orthogonal-clip-mode',
      mode: 'hide-above',
    });
    const sagittalState = caseViewerReducer(clippedState, {
      type: 'set-orthogonal-clip-plane',
      plane: 'sagittal',
    });

    expect(sagittalState.orthogonalClip).toEqual({ mode: 'hide-above', plane: 'sagittal' });
  });
});
