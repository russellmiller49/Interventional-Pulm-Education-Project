export type DeviceArchitectureId = 'aero' | 'bonastent' | 'ultraflex'

export type DeviceLoadMode = 'rest' | 'radial' | 'breathing' | 'cough' | 'foreshortening'

export interface DeviceArchitectureProfile {
  id: DeviceArchitectureId
  label: string
  shortLabel: string
  topology: 'laser-cut' | 'captured-braid' | 'single-wire-knit'
  topologyLabel: string
  cover: 'full-sleeve' | 'full-inner' | 'partial-midsection'
  scaffoldSummary: string
  coverSummary: string
  loadPathSummary: string
  couplingSummary: string
  visualCalibration: {
    axialCoupling: number
    twistGain: number
  }
  teachingPoints: string[]
  sourceRefs: number[]
}

export interface DeviceLoadFrame {
  bend: number
  compression: number
  eccentricity: number
  focalCenter: number
  focality: number
  focusWidth: number
  ovalization: number
}

export const deviceArchitectureProfiles: DeviceArchitectureProfile[] = [
  {
    id: 'aero',
    label: 'AERO® architecture',
    shortLabel: 'AERO',
    topology: 'laser-cut',
    topologyLabel: 'Laser-cut chevron lattice',
    cover: 'full-sleeve',
    scaffoldSummary:
      'A repeating cut-nitinol lattice is represented by circumferential chevron rows, staggered axial bridges, and end anchoring struts rather than by crossing wires.',
    coverSummary:
      'A translucent full-length membrane is shown beneath the scaffold so the cut-metal load path remains visible.',
    loadPathSummary:
      'Imposed radial displacement opens and closes crowns and bends connectors; there is no wire-on-wire sliding path.',
    couplingSummary:
      'The teaching schematic keeps diameter–length coupling small so learners can distinguish a cut lattice from wire-based architectures.',
    visualCalibration: {
      axialCoupling: 0.02,
      twistGain: 0,
    },
    teachingPoints: [
      'Follow deformation through crowns and bridges, not imaginary crossing wires.',
      'Crown and connector motion is the visual strain cue; it is not a stress calculation.',
      'Near-constant length is an architecture cue, not a measured deployment guarantee.',
    ],
    sourceRefs: [13],
  },
  {
    id: 'bonastent',
    label: 'BONASTENT® architecture',
    shortLabel: 'BONASTENT',
    topology: 'captured-braid',
    topologyLabel: 'Hook-and-cross captured braid',
    cover: 'full-inner',
    scaffoldSummary:
      'Counter-wound nitinol wire families alternate above and below one another at successive crossings instead of passing through the same coincident helical path.',
    coverSummary:
      'The full-length silicone membrane is shown beneath the external wire scaffold so crossing geometry remains inspectable.',
    loadPathSummary:
      'Imposed radial displacement changes braid angle, rotates the crossing wires, and changes contact at the over-under intersections.',
    couplingSummary:
      'The braid visibly lengthens in the constrained narrow state and shortens as it expands; the amount is intentionally qualitative.',
    visualCalibration: {
      axialCoupling: 0.16,
      twistGain: 0.14,
    },
    teachingPoints: [
      'Alternating radial offsets make the over-under crossing order visible.',
      'The crossing wire system and the internal cover are rendered as separate load-sharing structures.',
      'No force ranking is implied because product-specific radial-force data are not encoded.',
    ],
    sourceRefs: [20],
  },
  {
    id: 'ultraflex',
    label: 'Ultraflex™ architecture',
    shortLabel: 'Ultraflex',
    topology: 'single-wire-knit',
    topologyLabel: 'Single-wire open-loop knit',
    cover: 'partial-midsection',
    scaffoldSummary:
      'One uninterrupted nitinol path snakes through successive open loops; it is not rendered as two independent families of braided helices.',
    coverSummary:
      'The covered option is represented by a midsection membrane with uncovered looped ends.',
    loadPathSummary:
      'Imposed radial displacement opens, closes, and rotates the continuous loops, making local conformation easy to inspect.',
    couplingSummary:
      'The looped path visibly changes pitch and length as diameter changes; the coefficient is illustrative rather than bench calibrated.',
    visualCalibration: {
      axialCoupling: 0.18,
      twistGain: 0.12,
    },
    teachingPoints: [
      'The uninterrupted path lets learners trace one strand through successive loops.',
      'Open loops change shape locally during bending and focal ovalization.',
      'The midsection cover and uncovered ends move with the same scaffold but create different interfaces.',
    ],
    sourceRefs: [19],
  },
]

export const deviceLoadModes: Array<{
  id: DeviceLoadMode
  label: string
  description: string
}> = [
  {
    id: 'rest',
    label: 'Unloaded',
    description: 'Inspect the architecture before a load is applied.',
  },
  {
    id: 'radial',
    label: 'Radial compression',
    description: 'Cycle a symmetric imposed diameter reduction and watch the scaffold load path.',
  },
  {
    id: 'breathing',
    label: 'Breathing',
    description: 'Apply low-amplitude cyclic ovalization over the entire stented segment.',
  },
  {
    id: 'cough',
    label: 'Cough pulse',
    description: 'Apply a brief focal, eccentric compression with a small bend impulse.',
  },
  {
    id: 'foreshortening',
    label: 'Deployment coupling',
    description: 'Move between a constrained narrow state and a free expanded state.',
  },
]

export function getDeviceArchitectureProfile(id: DeviceArchitectureId) {
  const profile = deviceArchitectureProfiles.find((candidate) => candidate.id === id)
  if (!profile) throw new Error(`Unknown device architecture: ${id}`)
  return profile
}

function gaussianPulse(phase: number, center: number, width: number) {
  const normalized = (phase - center) / width
  return Math.exp(-(normalized * normalized))
}

export function getDeviceLoadFrame({
  elapsedSeconds,
  loadAmplitude,
  mode,
  playing,
}: {
  elapsedSeconds: number
  loadAmplitude: number
  mode: DeviceLoadMode
  playing: boolean
}): DeviceLoadFrame {
  const amplitude = Math.max(0, Math.min(1, loadAmplitude))
  const previewPhase = mode === 'cough' ? 0.34 : mode === 'foreshortening' ? 0.22 : 0.7
  const phase = playing ? elapsedSeconds : previewPhase

  if (mode === 'rest') {
    return {
      bend: 0,
      compression: 0,
      eccentricity: 0,
      focalCenter: 0.54,
      focality: 0,
      focusWidth: 0.28,
      ovalization: 0,
    }
  }

  if (mode === 'breathing') {
    const cycle = playing ? 0.5 + 0.5 * Math.sin(phase * Math.PI * 0.9) : 0.72
    return {
      bend: 0.012 * cycle,
      compression: 0.035 * cycle * amplitude,
      eccentricity: 0,
      focalCenter: 0.52,
      focality: 0.12,
      focusWidth: 0.44,
      ovalization: 0.028 * cycle * amplitude,
    }
  }

  if (mode === 'cough') {
    const loopPhase = playing ? (phase % 3.2) / 3.2 : previewPhase
    const pulse = Math.min(
      1,
      gaussianPulse(loopPhase, 0.3, 0.055) + 0.42 * gaussianPulse(loopPhase, 0.42, 0.085),
    )
    return {
      bend: 0.12 * pulse * amplitude,
      compression: 0.25 * pulse * amplitude,
      eccentricity: 0.12 * pulse * amplitude,
      focalCenter: 0.58,
      focality: 0.92,
      focusWidth: 0.19,
      ovalization: 0.2 * pulse * amplitude,
    }
  }

  if (mode === 'foreshortening') {
    const cycle = playing ? 0.5 + 0.5 * Math.cos(phase * Math.PI * 0.55) : 0.78
    return {
      bend: 0,
      compression: 0.42 * cycle * amplitude,
      eccentricity: 0,
      focalCenter: 0.5,
      focality: 0,
      focusWidth: 0.5,
      ovalization: 0,
    }
  }

  const cycle = playing ? 0.5 + 0.5 * Math.sin(phase * Math.PI * 0.65) : 0.72
  return {
    bend: 0,
    compression: 0.28 * cycle * amplitude,
    eccentricity: 0,
    focalCenter: 0.5,
    focality: 0,
    focusWidth: 0.5,
    ovalization: 0.035 * cycle * amplitude,
  }
}
