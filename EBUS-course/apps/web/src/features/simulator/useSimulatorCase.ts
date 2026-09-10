import { useEffect, useState } from 'react';

import { simulatorCaseAssetUrl, simulatorManifestUrl } from './paths';
import type {
  SimulatorCaseManifest,
  SimulatorCenterlineAsset,
  SimulatorLoadedAssets,
  SimulatorMeshAsset,
  SimulatorPhysicsSnapshot,
  SimulatorPointCloudAsset,
  SimulatorSectorSnapshot,
} from './types';

async function fetchJson<T>(
  path: string,
  signal?: AbortSignal,
  cache: RequestCache = 'default',
): Promise<T> {
  const response = await fetch(path, { cache, signal });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${path}`);
  }

  return (await response.json()) as T;
}

export function useSimulatorCase() {
  const [caseData, setCaseData] = useState<SimulatorCaseManifest | null>(null);
  const [assets, setAssets] = useState<SimulatorLoadedAssets | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        // The manifest has a stable URL but may be replaced when simulator
        // capabilities change. Revalidate it even if an older response was
        // previously cached with a long lifetime.
        const manifest = await fetchJson<SimulatorCaseManifest>(
          simulatorManifestUrl(),
          controller.signal,
          'no-cache',
        );
        const [airway, centerlines] = await Promise.all([
          fetchJson<SimulatorMeshAsset>(simulatorCaseAssetUrl(manifest.assets.airway_mesh), controller.signal),
          fetchJson<SimulatorCenterlineAsset>(simulatorCaseAssetUrl(manifest.assets.centerlines), controller.signal),
        ]);
        const vesselEntries = await Promise.all(
          manifest.assets.vessels.map(
            async (asset) =>
              [asset.key, await fetchJson<SimulatorPointCloudAsset>(simulatorCaseAssetUrl(asset.asset), controller.signal)] as const,
          ),
        );
        const stationEntries = await Promise.all(
          manifest.assets.stations.map(
            async (asset) =>
              [asset.key, await fetchJson<SimulatorPointCloudAsset>(simulatorCaseAssetUrl(asset.asset), controller.signal)] as const,
          ),
        );

        if (!controller.signal.aborted) {
          setCaseData(manifest);
          setAssets({
            airway,
            centerlines,
            vessels: Object.fromEntries(vesselEntries),
            stations: Object.fromEntries(stationEntries),
          });
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      }
    }

    load();

    return () => controller.abort();
  }, []);

  return { caseData, assets, error };
}

export function useSimulatorSectorSnapshot(caseData: SimulatorCaseManifest | null, presetKey: string | null) {
  const [snapshot, setSnapshot] = useState<SimulatorSectorSnapshot | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'missing' | 'error'>('idle');

  useEffect(() => {
    if (!caseData || !presetKey) {
      setSnapshot(null);
      setStatus('idle');
      return;
    }

    const snapshotRef = caseData.sector_snapshots?.[presetKey];
    if (!snapshotRef) {
      setSnapshot(null);
      setStatus('missing');
      return;
    }

    const controller = new AbortController();
    setStatus('loading');
    fetchJson<SimulatorSectorSnapshot>(simulatorCaseAssetUrl(snapshotRef), controller.signal)
      .then((payload) => {
        if (!controller.signal.aborted) {
          setSnapshot(payload);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSnapshot(null);
          setStatus('error');
        }
      });

    return () => controller.abort();
  }, [caseData, presetKey]);

  return { snapshot, status };
}

export function resolveSimulatorPhysicsSnapshotRef(
  caseData: SimulatorCaseManifest | null,
  presetKey: string | null,
): string | null {
  if (!caseData || !presetKey) {
    return null;
  }

  return caseData.physics_snapshots?.[presetKey] ?? null;
}

/**
 * Validate a fetched physics-snapshot sidecar. The payload must name its PNG and
 * carry the physics-engine metadata block; anything else is treated as missing so
 * the sector view falls back to the realistic render.
 */
export function parseSimulatorPhysicsSnapshot(payload: unknown): SimulatorPhysicsSnapshot | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const candidate = payload as Partial<SimulatorPhysicsSnapshot>;
  if (
    typeof candidate.preset_key !== 'string'
    || typeof candidate.image !== 'string'
    || candidate.image.length === 0
    || typeof candidate.metadata !== 'object'
    || candidate.metadata === null
    || candidate.metadata.engine !== 'physics'
    || !Number.isFinite(candidate.metadata.sector_angle_deg)
    || !Number.isFinite(candidate.metadata.max_depth_mm)
  ) {
    return null;
  }

  return candidate as SimulatorPhysicsSnapshot;
}

/**
 * Load the station-anchored physics sector snapshot (sidecar JSON + PNG URL) for a
 * preset, mirroring how sector_snapshots is read. Pass a null presetKey to skip
 * fetching (e.g. while the physics sector style is not active).
 */
export function useSimulatorPhysicsSnapshot(caseData: SimulatorCaseManifest | null, presetKey: string | null) {
  const [snapshot, setSnapshot] = useState<SimulatorPhysicsSnapshot | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'missing' | 'error'>('idle');

  useEffect(() => {
    if (!caseData || !presetKey) {
      setSnapshot(null);
      setStatus('idle');
      return;
    }

    const snapshotRef = resolveSimulatorPhysicsSnapshotRef(caseData, presetKey);
    if (!snapshotRef) {
      setSnapshot(null);
      setStatus('missing');
      return;
    }

    const controller = new AbortController();
    setStatus('loading');
    fetchJson<unknown>(simulatorCaseAssetUrl(snapshotRef), controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }

        const parsed = parseSimulatorPhysicsSnapshot(payload);
        setSnapshot(parsed);
        setStatus(parsed ? 'ready' : 'missing');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSnapshot(null);
          setStatus('error');
        }
      });

    return () => controller.abort();
  }, [caseData, presetKey]);

  const imageUrl = snapshot ? simulatorCaseAssetUrl(snapshot.image) : null;
  return { snapshot, imageUrl, status };
}
