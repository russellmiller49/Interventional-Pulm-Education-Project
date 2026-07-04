import type {
  PleuralProbeState,
  PleuralTissueLabel,
  PleuralVolume,
  UltrasoundFrameMetrics,
  Vec3,
} from '../types'

import { simulateBMode } from '@/features/thoracic-ultrasound-simulator/engine/simulateBMode'
import { stableSpeckle as thoracicStableSpeckle } from '@/features/thoracic-ultrasound-simulator/engine/tissueModel'

import { toThoracicVolume } from './sampleVolume'
import { pleuralTissueModel } from './tissueModel'

export interface SimulatePleuralBModeInput {
  volume: PleuralVolume
  probe: PleuralProbeState
  width: number
  height: number
}

export interface SimulatedPleuralFrame {
  imageData: ImageData
  metrics: UltrasoundFrameMetrics
}

export function stableSpeckle(worldPoint: Vec3, label: PleuralTissueLabel) {
  return thoracicStableSpeckle(worldPoint, label)
}

/**
 * Thin wrapper over the shared beam loop with the pleural tissue model; output
 * is unchanged from the original prototype implementation.
 */
export function simulatePleuralBMode({
  volume,
  probe,
  width,
  height,
}: SimulatePleuralBModeInput): SimulatedPleuralFrame {
  const frame = simulateBMode({
    volume: toThoracicVolume(volume),
    probe,
    width,
    height,
    model: pleuralTissueModel,
    renderImage: true,
  })

  return {
    imageData: frame.imageData,
    metrics: frame.metrics,
  }
}
