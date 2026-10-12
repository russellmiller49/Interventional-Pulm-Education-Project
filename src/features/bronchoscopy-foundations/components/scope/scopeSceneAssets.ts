import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { loadAirwayStlGeometry } from '@/lib/airway-anatomy/airway-render'
import { TEACHING_LUMEN_URL } from '../../engine/scope/scopeCase'
import { loadStageScopeCase, DRACO_DECODER_PATH } from '../stage/scopeCaseLoader'
import type { ScopeMode, AnatomyProfileId } from './types'

const base = '/bronchoscopy-foundations/anatomy'
const models = new Map<string, Promise<GLTF>>()
/** Requests still in flight. A loaded model is kept; a failed one is already forgotten. */
const pending = new Set<string>()
export function loadScopeModel(path: string): Promise<GLTF> {
  const cached = models.get(path)
  if (cached) return cached
  const decoder = new DRACOLoader().setDecoderPath(DRACO_DECODER_PATH).setWorkerLimit(1)
  const loader = new GLTFLoader().setDRACOLoader(decoder)
  const promise = loader
    .loadAsync(base + '/' + path)
    .finally(() => {
      decoder.dispose()
      pending.delete(path)
    })
    .catch((error: unknown) => {
      // Only this request's own entry: a retry may already have put a newer one in its place.
      if (models.get(path) === promise) models.delete(path)
      throw error
    })
  pending.add(path)
  models.set(path, promise)
  return promise
}

/**
 * Forgets the model requests that have not settled, so a new attempt asks again instead of
 * waiting on a request that hung (BF-01 finding 3). Loaded models stay cached.
 */
export function forgetPendingScopeModels(): void {
  for (const path of pending) models.delete(path)
  pending.clear()
}

export async function loadSceneAssets(
  mode: ScopeMode,
  profile: AnatomyProfileId,
  detailedControls = false,
) {
  // The surface and collider share loadAirwayStlGeometry's URL+decoder cache.
  const [scopeCase, lumen, extras] = await Promise.all([
    loadStageScopeCase(profile),
    loadAirwayStlGeometry(TEACHING_LUMEN_URL, { dracoDecoderPath: DRACO_DECODER_PATH }),
    Promise.all(
      (mode === 'controls-isolated'
        ? [
            'devices/bench.glb',
            detailedControls ? 'devices/control-head.glb' : 'devices/handle.glb',
            'devices/scope-tip.glb',
          ]
        : mode === 'larynx-entry'
          ? ['larynx/larynx-lumen.glb', 'devices/scope-tip.glb']
          : mode === 'accessory'
            ? ['devices/accessories.glb', 'devices/findings.glb', 'devices/scope-tip.glb']
            : mode === 'tube'
              ? ['devices/scope-tip.glb']
              : []
      ).map(async (path) => [path, await loadScopeModel(path)] as const),
    ),
  ])
  return { scopeCase, lumen, models: new Map(extras) }
}
export type ScopeSceneAssets = Awaited<ReturnType<typeof loadSceneAssets>>
