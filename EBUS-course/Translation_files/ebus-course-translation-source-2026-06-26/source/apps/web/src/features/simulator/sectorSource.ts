export type SimulatorSnapshotStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

export type SimulatorSectorSource =
  | 'precomputed_volume_snapshot'
  | 'loading_snapshot'
  | 'point_cloud_sector';

export function resolveSimulatorSectorSource({
  atSnapshotPose,
  hasCurrentSnapshot,
  snapshotStatus,
}: {
  atSnapshotPose: boolean;
  hasCurrentSnapshot: boolean;
  snapshotStatus: SimulatorSnapshotStatus;
}): SimulatorSectorSource {
  if (hasCurrentSnapshot && atSnapshotPose) {
    return 'precomputed_volume_snapshot';
  }

  if (snapshotStatus === 'loading') {
    return 'loading_snapshot';
  }

  return 'point_cloud_sector';
}

export function shouldUseSnapshotSectorItems(source: SimulatorSectorSource) {
  return source === 'precomputed_volume_snapshot';
}

export function simulatorSectorSourceLabel(source: SimulatorSectorSource) {
  switch (source) {
    case 'precomputed_volume_snapshot':
      return 'Snapshot sector';
    case 'loading_snapshot':
      return 'Loading snapshot';
    case 'point_cloud_sector':
      return 'Live sector';
  }
}
