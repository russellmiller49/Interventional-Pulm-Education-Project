import { useMemo } from 'react';

import type { RuntimeCaseManifest } from '../../../../../features/case3d/types';

interface OverlayGroupsState {
  allAnatomy: boolean;
  airway: boolean;
  vessels: boolean;
  nodes: boolean;
}

export function resolveCaseOverlay(
  manifest: RuntimeCaseManifest,
  overlayGroups: OverlayGroupsState,
  selectedTargetId: string,
  hiddenSegmentIds: string[],
) {
  const hiddenSet = new Set(hiddenSegmentIds);
  const selectedTarget = manifest.targets.find((target) => target.id === selectedTargetId) ?? null;
  const selectedSegmentIds = new Set(
    (selectedTarget?.matchedSegmentIds ?? []).filter((segmentId) => !hiddenSet.has(segmentId)),
  );
  const visibleSegments = manifest.segmentation.segments.filter((segment) => {
    if (hiddenSet.has(segment.id)) {
      return false;
    }

    if (overlayGroups.allAnatomy) {
      return true;
    }

    if (segment.groupId === 'airway') {
      return overlayGroups.airway;
    }

    if (
      segment.groupId === 'vessels' ||
      segment.groupId === 'cardiac' ||
      segment.groupId === 'gi' ||
      segment.groupId === 'other'
    ) {
      return overlayGroups.vessels;
    }

    if (segment.groupId === 'nodes') {
      return overlayGroups.nodes;
    }

    return false;
  });

  return {
    selectedTarget,
    selectedSegmentIds,
    visibleSegments,
  };
}

export function useCaseOverlay(
  manifest: RuntimeCaseManifest,
  overlayGroups: OverlayGroupsState,
  selectedTargetId: string,
  hiddenSegmentIds: string[],
) {
  return useMemo(() => {
    return resolveCaseOverlay(manifest, overlayGroups, selectedTargetId, hiddenSegmentIds);
  }, [hiddenSegmentIds, manifest, overlayGroups, selectedTargetId]);
}
