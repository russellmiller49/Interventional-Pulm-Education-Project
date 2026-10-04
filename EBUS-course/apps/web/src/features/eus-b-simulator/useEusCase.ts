import { useEffect, useState } from 'react';
import { decodeGzip, isGzip } from '@bronchoscopy-core/compression';

import { EUS_CASE_MANIFEST, eusCaseAssetUrl } from './paths';
import type {
  EusAcousticMetadata,
  EusAcousticVolume,
  EusCaseManifest,
  EusCtVolume,
  EusScopePath,
} from './types';

async function fetchJson<T>(
  path: string,
  signal: AbortSignal,
  version?: string,
  cache: RequestCache = 'default',
) {
  const response = await fetch(eusCaseAssetUrl(path, version), { cache, signal });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${path}`);
  return (await response.json()) as T;
}

async function fetchBytes(path: string, signal: AbortSignal, version: string) {
  const response = await fetch(eusCaseAssetUrl(path, version), { signal });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${path}`);
  return response.arrayBuffer();
}

async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export function validateEusAcousticVolume(
  metadata: EusAcousticMetadata,
  data: Uint8Array,
  manifest: Pick<EusCaseManifest, 'assetVersion' | 'sourceGeometrySha256'>,
) {
  if (
    metadata.schema !== 'acoustic-volume/v1' ||
    metadata.coordinateSystem !== 'LPS' ||
    metadata.units !== 'mm'
  )
    throw new Error('Unsupported acoustic coordinates');
  if (
    metadata.assetVersion !== manifest.assetVersion ||
    metadata.sourceGeometrySha256 !== manifest.sourceGeometrySha256
  )
    throw new Error('Acoustic volume does not match this case');
  if (metadata.sizeXyz.reduce((a, b) => a * b, 1) !== data.length)
    throw new Error('Invalid acoustic volume dimensions');
  if (metadata.labels.some((label, index) => label.id !== index || !label.medium))
    throw new Error('Acoustic labels are incomplete');
}

export interface EusCaseState {
  manifest: EusCaseManifest | null;
  path: EusScopePath | null;
  volume: EusAcousticVolume | null;
  error: string | null;
}

/** Loads what the scope needs to be driven. The CT is fetched separately, when it is first shown. */
export function useEusCase(): EusCaseState {
  const [state, setState] = useState<EusCaseState>({
    manifest: null,
    path: null,
    volume: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      try {
        // The manifest URL is stable while its contents change with each rebuild.
        const manifest = await fetchJson<EusCaseManifest>(
          EUS_CASE_MANIFEST,
          signal,
          undefined,
          'no-cache',
        );
        // Every build of the case has its own source hash, which versions the files it wrote.
        const version = manifest.sourceGeometrySha256;
        const [path, metadata, compressed] = await Promise.all([
          fetchJson<EusScopePath>(manifest.assets.path, signal, version),
          fetchJson<EusAcousticMetadata>(manifest.assets.acoustic.metadata, signal, version),
          fetchBytes(manifest.assets.acoustic.data, signal, version),
        ]);
        // Static hosts differ: some send .gz as a file, others decode it in transit.
        const expected = isGzip(new Uint8Array(compressed))
          ? metadata.dataSha256
          : metadata.decodedSha256;
        if ((await sha256Hex(compressed)) !== expected)
          throw new Error('Acoustic volume checksum mismatch.');
        const data = new Uint8Array(await decodeGzip(compressed));
        validateEusAcousticVolume(metadata, data, manifest);
        if (signal.aborted) return;
        setState((current) => ({ ...current, manifest, path, volume: { metadata, data } }));
      } catch (reason) {
        if (!signal.aborted)
          setState((current) => ({
            ...current,
            error: reason instanceof Error ? reason.message : String(reason),
          }));
      }
    })();
    return () => controller.abort();
  }, []);

  return state;
}

/**
 * The CT correlate, fetched the first time it is wanted and kept afterwards. It is the largest
 * file of the case, so a learner who stays on the endoscopic view never downloads it. A failure
 * is reported to the CT pane alone; the rest of the simulator keeps working.
 */
export function useEusCt(manifest: EusCaseManifest | null, wanted: boolean) {
  const [state, setState] = useState<{ ct: EusCtVolume | null; error: string | null }>({
    ct: null,
    error: null,
  });
  const [requested, setRequested] = useState(false);
  useEffect(() => {
    if (wanted) setRequested(true);
  }, [wanted]);

  useEffect(() => {
    if (!manifest || !requested) return;
    const controller = new AbortController();
    const asset = manifest.assets.ct;
    void (async () => {
      try {
        const data = new Uint8Array(
          await decodeGzip(await fetchBytes(asset.data, controller.signal, asset.dataSha256)),
        );
        if (data.length !== asset.sizeXyz.reduce((a, b) => a * b, 1))
          throw new Error('CT correlate has unexpected dimensions.');
        if (!controller.signal.aborted) setState({ ct: { asset, data }, error: null });
      } catch (reason) {
        if (!controller.signal.aborted)
          setState({ ct: null, error: reason instanceof Error ? reason.message : String(reason) });
      }
    })();
    return () => controller.abort();
  }, [manifest, requested]);

  return state;
}
