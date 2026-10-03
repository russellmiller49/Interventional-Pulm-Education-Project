import rawRegistryConfig from '../../../../config/literature/shadow-classifier-components.v1.json'

import { loadShadowComponentRegistry } from './registry'

export function loadConfiguredShadowComponentRegistry() {
  return loadShadowComponentRegistry(rawRegistryConfig)
}
