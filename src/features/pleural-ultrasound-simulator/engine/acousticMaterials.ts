/**
 * Acoustic lookup tables now live in the shared thoracic engine. The thoracic
 * table is a superset of the pleural one with identical values for every
 * pleural label, so re-exporting preserves the historical behaviour.
 */
export type { AcousticMaterial } from '@/features/thoracic-ultrasound-simulator/types'
export {
  acousticMaterials,
  estimateBoundaryReflection,
} from '@/features/thoracic-ultrasound-simulator/engine/acousticMaterials'
