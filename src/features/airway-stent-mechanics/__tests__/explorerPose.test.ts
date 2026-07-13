import {
  createDefaultStentExplorerControlState,
  deriveStentMechanicsModifiers,
  setStentExplorerControlValue,
} from '../explorer/controlState'
import {
  applyStentMechanicsModifiers,
  getStentExplorerAirwayPose,
  getStentExplorerPose,
} from '../explorer/pose'
import { stentExplorerArchitectureProfiles } from '../explorer/architectures'
import { getStentExplorerStation } from '../explorer/stations'
import { STENT_EXPLORER_STATION_IDS, type StentExplorerArchitectureId } from '../explorer/types'

const architectureIds: readonly StentExplorerArchitectureId[] =
  stentExplorerArchitectureProfiles.map((profile) => profile.id)

describe('getStentExplorerPose', () => {
  it('is deterministic, finite, and normalized across every station and architecture', () => {
    for (const stationId of STENT_EXPLORER_STATION_IDS) {
      for (const architectureId of architectureIds) {
        for (const progress of [-2, 0, 0.125, 0.5, 0.875, 1, 3]) {
          const pose = getStentExplorerPose(stationId, architectureId, progress)
          expect(getStentExplorerPose(stationId, architectureId, progress)).toEqual(pose)
          for (const [key, value] of Object.entries(pose)) {
            expect(Number.isFinite(value)).toBe(true)
            if (key === 'axialScale') {
              expect(value).toBeGreaterThanOrEqual(0.7)
              expect(value).toBeLessThanOrEqual(1.3)
            } else {
              expect(value).toBeGreaterThanOrEqual(0)
              expect(value).toBeLessThanOrEqual(1)
            }
          }
        }
      }
    }
  })

  it('clamps finite progress and rejects non-finite or unknown runtime input', () => {
    expect(getStentExplorerPose('migration', 'solid-silicone', -20)).toEqual(
      getStentExplorerPose('migration', 'solid-silicone', 0),
    )
    expect(getStentExplorerPose('migration', 'solid-silicone', 20)).toEqual(
      getStentExplorerPose('migration', 'solid-silicone', 1),
    )
    expect(() => getStentExplorerPose('migration', 'solid-silicone', Number.NaN)).toThrow(/finite/i)
    expect(() =>
      getStentExplorerPose(
        'not-a-station' as (typeof STENT_EXPLORER_STATION_IDS)[number],
        'solid-silicone',
        0.5,
      ),
    ).toThrow(/unknown stent explorer station/i)
    expect(() =>
      getStentExplorerPose('migration', 'not-an-architecture' as StentExplorerArchitectureId, 0.5),
    ).toThrow(/unknown stent explorer architecture/i)
  })

  it('keeps a representative cough-motion result at final progress', () => {
    const braid = getStentExplorerPose('cough-motion', 'free-crossing-braid', 1)
    const silicone = getStentExplorerPose('cough-motion', 'solid-silicone', 1)

    expect(braid.axialExcursion).toBeGreaterThan(0)
    expect(braid.axialScale).toBeGreaterThan(1)
    expect(silicone.axialExcursion).toBeGreaterThan(0)
    expect(silicone.bend).toBeGreaterThan(braid.bend)
    expect(braid.axialScale).toBeGreaterThan(silicone.axialScale)
  })

  it('distinguishes architecture-specific curve and tumor pathways', () => {
    const siliconeCurve = getStentExplorerPose('curve-buckle', 'solid-silicone', 1)
    const braidedCurve = getStentExplorerPose('curve-buckle', 'free-crossing-braid', 1)
    expect(siliconeCurve.kink).toBeGreaterThan(braidedCurve.kink)
    expect(siliconeCurve.airwayCompression).toBeGreaterThan(braidedCurve.airwayCompression)

    const uncovered = getStentExplorerPose('tumor-ingrowth-overgrowth', 'free-crossing-braid', 1)
    const covered = getStentExplorerPose('tumor-ingrowth-overgrowth', 'hook-cross-covered', 1)
    expect(uncovered.tumorIngrowth).toBeGreaterThan(covered.tumorIngrowth)
    expect(covered.tumorOvergrowth).toBeGreaterThan(uncovered.tumorOvergrowth)
    expect(covered.tumorIngrowth).toBe(0)
  })

  it('stages structural failure late and keeps deployment semantics absolute', () => {
    const earlyFracture = getStentExplorerPose('fracture-cover-failure', 'laser-cut-covered', 0.2)
    const lateFracture = getStentExplorerPose('fracture-cover-failure', 'laser-cut-covered', 1)
    expect(earlyFracture.fracture).toBe(0)
    expect(earlyFracture.coverFailure).toBe(0)
    expect(lateFracture.fracture).toBeGreaterThan(0)
    expect(lateFracture.coverFailure).toBeGreaterThan(0)

    const constrained = getStentExplorerPose('deploy-rescue', 'free-crossing-braid', 0)
    const deployed = getStentExplorerPose('deploy-rescue', 'free-crossing-braid', 1)
    expect(constrained.deployment).toBe(0)
    expect(constrained.axialScale).toBeGreaterThan(1)
    expect(deployed.deployment).toBe(1)
    expect(deployed.axialScale).toBe(1)
    expect(deployed.radialCompression).toBe(0)
  })

  it('shows greater posterior accommodation for the dynamic Y schematic', () => {
    const silicone = getStentExplorerPose('y-stent', 'silicone-y', 0.5)
    const dynamic = getStentExplorerPose('y-stent', 'dynamic-y', 0.5)
    expect(dynamic.posteriorMotion).toBeGreaterThan(silicone.posteriorMotion)
  })

  it('keeps curved anatomy fixed and removes device failure fields from the airway wall', () => {
    const device = getStentExplorerPose('curve-buckle', 'solid-silicone', 1)
    const airway = getStentExplorerAirwayPose('curve-buckle', device)

    expect(airway.bend).toBeGreaterThan(0)
    expect(airway.kink).toBe(0)
    expect(airway.airwayCompression).toBe(0)
    expect(airway.radialCompression).toBe(0)

    const earlyFractureDevice = getStentExplorerPose(
      'fracture-cover-failure',
      'laser-cut-covered',
      0,
    )
    const tortuousAirway = getStentExplorerAirwayPose('fracture-cover-failure', earlyFractureDevice)
    expect(earlyFractureDevice.bend).toBeGreaterThan(0)
    expect(tortuousAirway.bend).toBeGreaterThan(0)
    expect(tortuousAirway.fracture).toBe(0)
    expect(tortuousAirway.coverFailure).toBe(0)

    const yDevice = getStentExplorerPose('y-stent', 'silicone-y', 1)
    const yAirway = getStentExplorerAirwayPose('y-stent', yDevice)
    expect(yDevice.branchCompromise).toBeGreaterThan(0)
    expect(yAirway.branchCompromise).toBe(0)
    expect(yAirway.kink).toBe(0)
  })

  it('applies station controls without permitting ingrowth through an intact cover', () => {
    const station = getStentExplorerStation('tumor-ingrowth-overgrowth')
    const defaults = createDefaultStentExplorerControlState(station, 'hook-cross-covered')
    const throughCells = setStentExplorerControlValue(
      station,
      defaults,
      'tissue-pathway',
      'through-cells',
      'hook-cross-covered',
    )
    const intactModifiers = deriveStentMechanicsModifiers(
      station,
      throughCells,
      'hook-cross-covered',
    )
    const coveredBase = getStentExplorerPose('tumor-ingrowth-overgrowth', 'hook-cross-covered', 1)

    expect(
      applyStentMechanicsModifiers('tumor-ingrowth-overgrowth', coveredBase, intactModifiers)
        .tumorIngrowth,
    ).toBe(0)

    const defectPathway = setStentExplorerControlValue(
      station,
      throughCells,
      'tissue-pathway',
      'through-cover-defect',
      'hook-cross-covered',
    )
    const withCoverDefect = setStentExplorerControlValue(
      station,
      defectPathway,
      'cover-discontinuity',
      true,
      'hook-cross-covered',
    )
    expect(
      applyStentMechanicsModifiers(
        'tumor-ingrowth-overgrowth',
        coveredBase,
        deriveStentMechanicsModifiers(station, withCoverDefect, 'hook-cross-covered'),
      ).tumorIngrowth,
    ).toBeGreaterThan(0)

    const partialArchitecture = 'single-wire-knit-partial-cover'
    const partialBase = getStentExplorerPose('tumor-ingrowth-overgrowth', partialArchitecture, 1)
    const partialDefaults = createDefaultStentExplorerControlState(station, partialArchitecture)
    expect(
      applyStentMechanicsModifiers(
        'tumor-ingrowth-overgrowth',
        partialBase,
        deriveStentMechanicsModifiers(station, partialDefaults, partialArchitecture),
      ).tumorIngrowth,
    ).toBeGreaterThan(0)

    const partialDefectPathway = setStentExplorerControlValue(
      station,
      partialDefaults,
      'tissue-pathway',
      'through-cover-defect',
      partialArchitecture,
    )
    expect(
      applyStentMechanicsModifiers(
        'tumor-ingrowth-overgrowth',
        partialBase,
        deriveStentMechanicsModifiers(station, partialDefectPathway, partialArchitecture),
      ).tumorIngrowth,
    ).toBe(0)

    const partialWithDefect = setStentExplorerControlValue(
      station,
      partialDefectPathway,
      'cover-discontinuity',
      true,
      partialArchitecture,
    )
    expect(
      applyStentMechanicsModifiers(
        'tumor-ingrowth-overgrowth',
        partialBase,
        deriveStentMechanicsModifiers(station, partialWithDefect, partialArchitecture),
      ).tumorIngrowth,
    ).toBeGreaterThan(0)
  })

  it('keeps topology-specific coupling and material recovery qualitative but distinct', () => {
    const freeBraid = getStentExplorerPose('metal-architecture', 'free-crossing-braid', 0.5)
    const captured = getStentExplorerPose('metal-architecture', 'hook-cross-covered', 0.5)
    const laserCut = getStentExplorerPose('metal-architecture', 'laser-cut-covered', 0.5)
    const knit = getStentExplorerPose('metal-architecture', 'single-wire-knit-partial-cover', 0.5)

    expect(freeBraid.axialScale).toBeGreaterThan(captured.axialScale)
    expect(captured.axialScale).toBeGreaterThan(laserCut.axialScale)
    expect(knit.bend).toBeGreaterThan(laserCut.bend)

    const recoveredNitinol = getStentExplorerPose('metal-architecture', 'laser-cut-covered', 1)
    const retainedBalloonSet = getStentExplorerPose(
      'metal-architecture',
      'balloon-expanded-metal',
      1,
    )
    expect(retainedBalloonSet.radialCompression).toBeGreaterThan(recoveredNitinol.radialCompression)
    expect(retainedBalloonSet.bend).toBeGreaterThan(recoveredNitinol.bend)
  })

  it('does not encode a family-level migration displacement ranking', () => {
    const migrationAmplitudes = [
      'solid-silicone',
      'free-crossing-braid',
      'hook-cross-covered',
      'laser-cut-covered',
      'single-wire-knit-partial-cover',
      'balloon-expanded-metal',
    ].map(
      (architectureId) =>
        getStentExplorerPose('migration', architectureId as StentExplorerArchitectureId, 0.75)
          .migration,
    )

    expect(new Set(migrationAmplitudes).size).toBe(1)
  })
})
