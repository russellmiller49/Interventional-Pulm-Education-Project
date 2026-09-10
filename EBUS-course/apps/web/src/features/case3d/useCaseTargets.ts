import { useMemo } from 'react';

import type { RuntimeCaseManifest, RuntimeCaseTarget } from '../../../../../features/case3d/types';

export function useCaseTargets(manifest: RuntimeCaseManifest, selectedStationId: string, selectedTargetId: string) {
  return useMemo(() => {
    const stationMap = new Map(manifest.stations.map((station) => [station.id, station]));
    const selectedStation = stationMap.get(selectedStationId) ?? manifest.stations[0];
    const stationTargets = manifest.targets.filter((target) => target.stationId === selectedStation.id);
    const landmarkTargets = manifest.targets.filter((target) => target.kind === 'landmark');
    const selectedTarget =
      manifest.targets.find((target) => target.id === selectedTargetId) ??
      stationTargets[0] ??
      manifest.targets[0];

    return {
      selectedStation,
      selectedTarget,
      stationTargets,
      landmarkTargets,
      stationMap,
    };
  }, [manifest, selectedStationId, selectedTargetId]);
}

export function getTargetLabel(target: Pick<RuntimeCaseTarget, 'displayLabel' | 'stationGroupId' | 'kind'>) {
  if (target.kind === 'lymph_node') {
    return target.stationGroupId ? `${target.displayLabel} · node` : target.displayLabel;
  }

  return target.displayLabel;
}
