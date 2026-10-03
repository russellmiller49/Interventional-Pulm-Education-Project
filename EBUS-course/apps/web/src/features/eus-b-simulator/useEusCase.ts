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

async function fetchJson<T>(path: string, signal: AbortSignal, cache: RequestCache = 'default') {
  const response = await fetch(eusCaseAssetUrl(path), { cache, signal });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${path}`);
  return (await response.json()) as T;
}

async function fetchBytes(path: string, signal: AbortSignal) {
  const response = await fetch(eusCaseAssetUrl(path), { signal });
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
  ct: EusCtVolume | null;
  error: string | null;
}

/** Loads the case in two steps so the scope can be driven while the CT correlate still downloads. */
export function useEusCase(): EusCaseState {
  const [state, setState] = useState<EusCaseState>({
    manifest: null,
    path: null,
    volume: null,
    ct: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      try {
        // The manifest URL is stable while its contents change with each rebuild.
        const manifest = await fetchJson<EusCaseManifest>(EUS_CASE_MANIFEST, signal, 'no-cache');
        const [path, metadata, compressed] = await Promise.all([
          fetchJson<EusScopePath>(manifest.assets.path, signal),
          fetchJson<EusAcousticMetadata>(manifest.assets.acoustic.metadata, signal),
          fetchBytes(manifest.assets.acoustic.data, signal),
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

        const ctBytes = new Uint8Array(
          await decodeGzip(await fetchBytes(manifest.assets.ct.data, signal)),
        );
        if (ctBytes.length !== manifest.assets.ct.sizeXyz.reduce((a, b) => a * b, 1))
          throw new Error('CT correlate has unexpected dimensions.');
        if (!signal.aborted)
          setState((current) => ({ ...current, ct: { asset: manifest.assets.ct, data: ctBytes } }));
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
