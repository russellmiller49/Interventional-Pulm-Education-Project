import { useEffect, useState } from 'react';

import { simulatorCaseAssetUrl, simulatorManifestUrl } from './paths';
import type {
  SimulatorCaseManifest,
  SimulatorCenterlineAsset,
  SimulatorLoadedAssets,
  SimulatorMeshAsset,
  SimulatorPointCloudAsset,
  SimulatorSectorSnapshot,
} from './types';

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });

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
        const manifest = await fetchJson<SimulatorCaseManifest>(simulatorManifestUrl(), controller.signal);
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
