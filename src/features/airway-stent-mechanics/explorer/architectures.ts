import { getArchitectureProfile } from '../content/architectureRegistry'
import type { StentArchitectureId } from '../engine/learningLabTypes'
import type { StentExplorerArchitectureId, StentExplorerArchitectureOption } from './types'

type MetallicProfileId = Extract<
  StentArchitectureId,
  | 'free-crossing-braid'
  | 'hook-cross-covered'
  | 'laser-cut-covered'
  | 'single-wire-knit-partial-cover'
>

function adaptMetallicProfile(id: MetallicProfileId): StentExplorerArchitectureOption {
  const profile = getArchitectureProfile(id)
  const coverage =
    profile.coverage === 'fully-covered'
      ? 'fully-covered'
      : profile.coverage === 'partially-covered'
        ? 'partially-covered'
        : 'uncovered'

  return {
    id,
    label: profile.label,
    construction: profile.topologyDescription,
    material: profile.material,
    topology: profile.topologyLabel,
    loadPath: profile.loadPath,
    expansionMechanism: 'self-expanding-superelastic',
    materialBehavior: 'superelastic',
    coverage,
    geometryBuilder: profile.geometryBuilder,
    visualCalibration: profile.visualCalibration,
  }
}

export const solidSiliconeArchitecture = {
  id: 'solid-silicone',
  label: 'Solid silicone tube',
  construction: 'A continuous molded wall without a metallic scaffold or wire crossings.',
  material: 'Molded medical silicone elastomer',
  topology: 'Continuous cylindrical wall',
  loadPath:
    'Compression and bending travel through the continuous wall; curve mismatch can shift contact, gap the wall, or produce inward folding.',
  expansionMechanism: 'molded-passive',
  materialBehavior: 'elastomeric',
  coverage: 'solid-wall',
  visualCalibration: {
    axialCoupling: 0.08,
    twistGain: 0.42,
    bendGain: 0.72,
    ovalizationGain: 0.68,
  },
} as const satisfies StentExplorerArchitectureOption

export const freeCrossingBraidArchitecture = adaptMetallicProfile('free-crossing-braid')
export const hookCrossCoveredArchitecture = adaptMetallicProfile('hook-cross-covered')
export const laserCutCoveredArchitecture = adaptMetallicProfile('laser-cut-covered')
export const singleWireKnitArchitecture = adaptMetallicProfile('single-wire-knit-partial-cover')

export const balloonExpandedMetalArchitecture = {
  id: 'balloon-expanded-metal',
  label: 'Balloon-expanded metal reference',
  construction:
    'A generic ring-and-connector scaffold whose diameter is set by external balloon expansion rather than self-expanding recovery.',
  material: 'Historical stainless-steel reference; alloy, processing, and device geometry vary',
  topology: 'Balloon-expanded rings and connectors',
  loadPath:
    'In this historical stainless-steel teaching reference, modeled balloon expansion sets the diameter. Later external deformation may persist rather than automatically returning toward a programmed shape.',
  expansionMechanism: 'balloon-expanded',
  materialBehavior: 'balloon-set',
  coverage: 'uncovered',
  geometryBuilder: 'laser-cut-rings',
  visualCalibration: {
    axialCoupling: 0.06,
    twistGain: 0.28,
    bendGain: 0.46,
    ovalizationGain: 0.72,
  },
} as const satisfies StentExplorerArchitectureOption

export const siliconeYArchitecture = {
  id: 'silicone-y',
  label: 'Silicone Y',
  construction: 'A molded bifurcated solid wall with a carinal saddle and two limbs.',
  material: 'Molded medical silicone elastomer',
  topology: 'Continuous-wall three-limb bifurcation',
  loadPath:
    'Loads divide among the tracheal limb, bronchial limbs, and carinal saddle; branch mismatch adds bending and torsion.',
  expansionMechanism: 'bifurcated-schematic',
  materialBehavior: 'bifurcated',
  coverage: 'solid-wall',
  visualCalibration: {
    axialCoupling: 0,
    twistGain: 0.7,
    bendGain: 0.78,
    ovalizationGain: 0.54,
  },
} as const satisfies StentExplorerArchitectureOption

export const dynamicYArchitecture = {
  id: 'dynamic-y',
  label: 'Dynamic Y schematic',
  construction: 'A bifurcated schematic with a more compliant posterior membrane region.',
  material: 'Generic elastomeric bifurcated construction',
  topology: 'Directional three-limb bifurcation',
  loadPath:
    'The supported arc and posterior membrane share motion asymmetrically while the saddle couples both branch limbs.',
  expansionMechanism: 'bifurcated-schematic',
  materialBehavior: 'bifurcated',
  coverage: 'solid-wall',
  visualCalibration: {
    axialCoupling: 0,
    twistGain: 0.72,
    bendGain: 0.9,
    ovalizationGain: 0.82,
  },
} as const satisfies StentExplorerArchitectureOption

export const metallicYArchitecture = {
  id: 'metallic-y',
  label: 'Generic metallic Y scaffold',
  construction: 'A self-expanding bifurcated scaffold with a generic covering layer.',
  material: 'Generic superelastic metallic scaffold with polymer cover',
  topology: 'Covered self-expanding three-limb bifurcation',
  loadPath:
    'The scaffold distributes deformation across the saddle and limbs while the covering changes the tissue-facing surface.',
  expansionMechanism: 'bifurcated-schematic',
  materialBehavior: 'bifurcated',
  coverage: 'fully-covered',
  visualCalibration: {
    axialCoupling: 0.42,
    twistGain: 0.6,
    bendGain: 0.7,
    ovalizationGain: 0.62,
  },
} as const satisfies StentExplorerArchitectureOption

export const stentExplorerArchitectureProfiles: readonly StentExplorerArchitectureOption[] = [
  solidSiliconeArchitecture,
  freeCrossingBraidArchitecture,
  hookCrossCoveredArchitecture,
  laserCutCoveredArchitecture,
  singleWireKnitArchitecture,
  balloonExpandedMetalArchitecture,
  siliconeYArchitecture,
  dynamicYArchitecture,
  metallicYArchitecture,
]

const architectureById = new Map<StentExplorerArchitectureId, StentExplorerArchitectureOption>(
  stentExplorerArchitectureProfiles.map((profile) => [profile.id, profile]),
)

export function getStentExplorerArchitectureProfile(
  id: StentExplorerArchitectureId,
): StentExplorerArchitectureOption {
  const profile = architectureById.get(id)
  if (!profile) throw new Error(`Unknown explorer architecture: ${id}`)
  return profile
}

export function isMetallicExplorerArchitecture(id: StentExplorerArchitectureId): boolean {
  return !['solid-silicone', 'silicone-y', 'dynamic-y'].includes(id)
}

export function isYExplorerArchitecture(id: StentExplorerArchitectureId): boolean {
  return id === 'silicone-y' || id === 'dynamic-y' || id === 'metallic-y'
}

export function hasExplorerArchitectureCover(id: StentExplorerArchitectureId): boolean {
  const coverage = getStentExplorerArchitectureProfile(id).coverage
  return coverage === 'fully-covered' || coverage === 'partially-covered'
}

export function hasUncoveredBodyCells(id: StentExplorerArchitectureId): boolean {
  return getStentExplorerArchitectureProfile(id).coverage === 'uncovered'
}

export function hasUncoveredEndCells(id: StentExplorerArchitectureId): boolean {
  const coverage = getStentExplorerArchitectureProfile(id).coverage
  return coverage === 'uncovered' || coverage === 'partially-covered'
}
