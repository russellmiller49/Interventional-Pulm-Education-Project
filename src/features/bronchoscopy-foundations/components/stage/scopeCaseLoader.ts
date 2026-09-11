import type { AnatomyProfileId } from '../../components/scope/types'
import { loadScopeCase, type ScopeCase } from '../../engine/scope/scopeCase'

/** The decoder the FluoroView GLB already uses; the teaching lumen is Draco-compressed too. */
export const DRACO_DECODER_PATH = '/fluoroview/draco/'

/**
 * The stage's case loader: the teaching graph, and the reviewed lumen as a collider once its
 * decoder and the BVH builder have been fetched. The three.js side is imported lazily so the host
 * itself carries no WebGL dependency; the flow tests replace this module with the graph-only
 * teaching case.
 */
export function loadStageScopeCase(profile: AnatomyProfileId): Promise<ScopeCase> {
  return loadScopeCase(profile, {
    loadCollider: async (url) => {
      const [{ loadAirwayStlGeometry }, { createLumenCollider }] = await Promise.all([
        import('@/lib/airway-anatomy/airway-render'),
        import('@/lib/airway-anatomy/lumen-collider'),
      ])
      const geometry = await loadAirwayStlGeometry(url, { dracoDecoderPath: DRACO_DECODER_PATH })
      return createLumenCollider(geometry)
    },
  })
}
