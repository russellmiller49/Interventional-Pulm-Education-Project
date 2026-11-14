import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

import {
  DEFAULT_EUS_CONTROLS,
  renderEusFrame,
} from '@/features/eus-b-simulator/eusAcoustic';
import { computeEusPose } from '@/features/eus-b-simulator/eusPose';
import type {
  EusAcousticVolume,
  EusCaseManifest,
  EusScopePath,
  EusScopeState,
} from '@/features/eus-b-simulator/types';

/** The shipped case, read from disk for the lab's tests. Not used by the lab itself. */
const root = resolve(process.cwd(), 'public/simulator/eus-b-case-001');
const json = <T,>(name: string): T => JSON.parse(readFileSync(resolve(root, name), 'utf8'));

export const manifest = json<EusCaseManifest>('case_manifest.json');
export const path = json<EusScopePath>(manifest.assets.path);
export const volume: EusAcousticVolume = {
  metadata: json(manifest.assets.acoustic.metadata),
  data: new Uint8Array(gunzipSync(readFileSync(resolve(root, manifest.assets.acoustic.data)))),
};

export const labelId = (key: string) =>
  volume.metadata.labels.find((label) => label.key === key)!.id;

/** The image at a scope position, drawn the way the simulator draws its reference views. */
export function frameAt(scope: EusScopeState, size = 192) {
  const pose = computeEusPose(path, scope);
  return renderEusFrame(
    volume,
    {
      originLps: pose.originLps,
      depthAxisLps: pose.depthAxisLps,
      lateralAxisLps: pose.lateralAxisLps,
    },
    {
      ...DEFAULT_EUS_CONTROLS,
      depthMm: manifest.probe.defaultDepthMm,
      sectorAngleDeg: manifest.probe.sectorAngleDeg,
    },
    size,
    size,
    96,
    160,
  );
}
