import type { TissueModel } from '@/features/thoracic-ultrasound-simulator/types'
import { createTissueModel } from '@/features/thoracic-ultrasound-simulator/engine/tissueModel'

/**
 * The pleural case uses the default thoracic acoustic behaviour (it is what
 * the defaults were tuned against) with the prototype's narrower solid-organ
 * set, so the shared loops reproduce the original output exactly.
 */
export const pleuralTissueModel: TissueModel = createTissueModel({
  isSolidOrgan: (label) => label === 'liver' || label === 'spleen',
})
