import type {
  ThoracicCaseManifest,
  ThoracicLabelVolumeSpec,
  ThoracicStructureLabel,
  ThoracicVolume,
} from '../types'

import { adaptPleuralV1, isLegacyPleuralCase } from './adaptPleuralV1'
import { assertThoracicManifest } from './validateManifest'

export interface NormalizeManifestOptions {
  manifestUrl?: string
}

/**
 * Accept either a v2 manifest or a legacy v1 pleural case (no schemaVersion)
 * and return a validated v2 manifest. The on-disk v1 file loads unchanged.
 */
export function normalizeThoracicManifest(
  raw: unknown,
  options: NormalizeManifestOptions = {},
): ThoracicCaseManifest {
  if ((raw as ThoracicCaseManifest)?.schemaVersion === 2) {
    return assertThoracicManifest(raw)
  }

  if (isLegacyPleuralCase(raw)) {
    return assertThoracicManifest(adaptPleuralV1(raw, { manifestUrl: options.manifestUrl }))
  }

  throw new Error('Unrecognized case manifest: expected schemaVersion 2 or a legacy pleural case.')
}

const knownLabels = new Set<ThoracicStructureLabel>([
  'background',
  'skin',
  'subcutaneousTissue',
  'intercostalMuscle',
  'muscle',
  'rib',
  'spine',
  'lung',
  'atelectaticLung',
  'consolidation',
  'pleuralFluid',
  'pleuralThickening',
  'pleuralNodule',
  'septation',
  'debris',
  'diaphragm',
  'liver',
  'spleen',
  'kidney',
  'pancreas',
  'gallbladder',
  'stomach',
  'heart',
  'pericardium',
  'greatVessel',
  'aorta',
  'venaCava',
  'pulmonaryVessel',
  'portalVein',
  'esophagus',
  'airway',
  'thyroid',
  'thoracicCavity',
  'lymphNode',
])

/**
 * Dense uint8 code -> label lookup table. Unknown or unmapped codes resolve to
 * `background` so a stray voxel value can never crash the render loop.
 */
export function buildLabelResolver(
  labelCodes: Record<string, ThoracicStructureLabel>,
): (code: number) => ThoracicStructureLabel {
  const table: ThoracicStructureLabel[] = new Array(256).fill('background')

  for (const [codeText, label] of Object.entries(labelCodes)) {
    const code = Number(codeText)
    if (Number.isInteger(code) && code >= 0 && code < 256 && knownLabels.has(label)) {
      table[code] = label
    }
  }

  return (code: number) => table[code] ?? 'background'
}

export function buildThoracicVolume(
  data: Uint8Array,
  spec: ThoracicLabelVolumeSpec,
): ThoracicVolume {
  const [sizeX, sizeY, sizeZ] = spec.geometry.sizeXyz
  const expectedLength = sizeX * sizeY * sizeZ

  if (data.length !== expectedLength) {
    throw new Error(
      `Labelmap byte length ${data.length} does not match geometry ${sizeX}x${sizeY}x${sizeZ} (${expectedLength}).`,
    )
  }

  return {
    data,
    geometry: spec.geometry,
    resolveLabel: buildLabelResolver(spec.labelCodes),
  }
}

export interface LoadedThoracicCase {
  manifest: ThoracicCaseManifest
  volume: ThoracicVolume
}

export interface LoadThoracicCaseOptions {
  fetchImpl?: typeof fetch
}

export async function loadThoracicCase(
  manifestUrl: string,
  options: LoadThoracicCaseOptions = {},
): Promise<LoadedThoracicCase> {
  const fetchImpl = options.fetchImpl ?? fetch

  const manifestResponse = await fetchImpl(manifestUrl)
  if (!manifestResponse.ok) {
    throw new Error(`Could not load case manifest (${manifestResponse.status}).`)
  }
  const manifest = normalizeThoracicManifest(await manifestResponse.json(), { manifestUrl })

  const labelmapResponse = await fetchImpl(manifest.primaryLabelVolume.url)
  if (!labelmapResponse.ok) {
    throw new Error(`Could not load labelmap (${labelmapResponse.status}).`)
  }
  const labelmap = new Uint8Array(await labelmapResponse.arrayBuffer())

  return {
    manifest,
    volume: buildThoracicVolume(labelmap, manifest.primaryLabelVolume),
  }
}
