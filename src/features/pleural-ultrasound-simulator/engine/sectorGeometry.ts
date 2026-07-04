/**
 * Beam and guide-line geometry now lives in the shared thoracic engine; the
 * pleural probe state is structurally identical, so these re-exports keep the
 * historical API intact.
 */
export {
  beamDirection,
  needleDirection,
  needleEndpoint,
  probeOrigin,
  projectBeamToWorld,
} from '@/features/thoracic-ultrasound-simulator/engine/sectorGeometry'
