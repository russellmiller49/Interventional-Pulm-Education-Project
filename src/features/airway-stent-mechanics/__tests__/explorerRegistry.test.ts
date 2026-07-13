import { findMissingEvidenceRefs } from '../content/evidenceRegistry'
import { stentExplorerArchitectureProfiles } from '../explorer/architectures'
import { stentExplorerCasePresets } from '../explorer/cases'
import {
  stentExplorerManualReviewGates,
  stentExplorerPublicationStatus,
  stentExplorerReleaseBadge,
  stentExplorerReleaseStatus,
} from '../explorer/release'
import { getStentExplorerStation, stentExplorerStations } from '../explorer/stations'
import { STENT_EXPLORER_STATION_IDS } from '../explorer/types'

describe('stent explorer registry', () => {
  it('defines the eleven approved freely navigable stations in order', () => {
    expect(stentExplorerStations).toHaveLength(11)
    expect(stentExplorerStations.map((station) => station.id)).toEqual(STENT_EXPLORER_STATION_IDS)
    expect(stentExplorerStations.map((station) => station.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ])
  })

  it('resolves distinct generic metallic topologies without product assets', () => {
    const metallicIds = stentExplorerArchitectureProfiles
      .filter((profile) => profile.geometryBuilder)
      .map((profile) => profile.id)

    expect(metallicIds).toEqual([
      'free-crossing-braid',
      'hook-cross-covered',
      'laser-cut-covered',
      'single-wire-knit-partial-cover',
      'balloon-expanded-metal',
    ])
    expect(
      new Set(
        stentExplorerArchitectureProfiles
          .filter((profile) => profile.geometryBuilder)
          .map((profile) => profile.topology),
      ).size,
    ).toBe(5)
  })

  it('keeps every station decision-complete, cited, inspectable, and draft-gated', () => {
    for (const station of stentExplorerStations) {
      expect(station.clinicalHook.length).toBeGreaterThan(80)
      expect(station.architectureOptions.length).toBeGreaterThanOrEqual(2)
      expect(station.architectureOptions.map((option) => option.id)).toContain(
        station.defaultArchitectureId,
      )
      expect(new Set(station.architectureOptions.map((option) => option.id)).size).toBe(
        station.architectureOptions.length,
      )

      expect(station.phases.length).toBeGreaterThanOrEqual(3)
      expect(new Set(station.phases.map((phase) => phase.id)).size).toBe(station.phases.length)
      for (const phase of station.phases) {
        expect(phase.instruction.length).toBeGreaterThan(20)
        expect(phase.textEquivalent.length).toBeGreaterThan(40)
      }

      expect(station.hotspots.length).toBeGreaterThanOrEqual(2)
      expect(station.hotspots.length).toBeLessThanOrEqual(4)
      expect(new Set(station.hotspots.map((hotspot) => hotspot.id)).size).toBe(
        station.hotspots.length,
      )

      expect(station.prediction.choices.length).toBeGreaterThanOrEqual(2)
      expect(station.prediction.choices.map((choice) => choice.id)).toContain(
        station.prediction.bestChoiceId,
      )
      expect(station.whatChanged.length).toBeGreaterThan(0)
      expect(station.whyItMatters.length).toBeGreaterThan(0)
      expect(station.inspect.length).toBeGreaterThan(0)
      expect(station.conceptualResponse.length).toBeGreaterThan(0)

      expect(station.evidenceRefs.length).toBeGreaterThan(0)
      expect(findMissingEvidenceRefs(station.evidenceRefs)).toEqual([])
      expect(station.evidenceNote.length).toBeGreaterThan(60)
      expect(station.evidenceBoundary.length).toBeGreaterThan(60)
      expect(station.reducedMotionSummary.length).toBeGreaterThan(80)
      expect(station.clinicalReviewStatus).toBe('draft')
      expect(getStentExplorerStation(station.id)).toBe(station)
    }

    expect(getStentExplorerStation('retired-assessment')).toBeUndefined()
  })

  it('defines the five reusable clinical case presets without imposing order', () => {
    expect(stentExplorerCasePresets).toHaveLength(5)
    expect(stentExplorerCasePresets.map((preset) => preset.id)).toEqual([
      'curved-left-mainstem-silicone-failure',
      'post-treatment-migration',
      'uncovered-sems-restenosis',
      'tortuous-airway-fracture',
      'whole-y-carinal-mismatch',
    ])
    expect(new Set(stentExplorerCasePresets.map((preset) => preset.id)).size).toBe(5)

    for (const preset of stentExplorerCasePresets) {
      expect(preset.stationIds).toContain(preset.initialStationId)
      expect(preset.stationIds.length).toBeGreaterThanOrEqual(3)
      for (const stationId of preset.stationIds) {
        expect(STENT_EXPLORER_STATION_IDS).toContain(stationId)
      }
    }
  })

  it('keeps clinical review status distinct from the approved public publication state', () => {
    expect(stentExplorerReleaseStatus).toBe('draft')
    expect(stentExplorerPublicationStatus).toBe('published')
    expect(stentExplorerReleaseBadge).toMatch(/live educational module/i)
    expect(stentExplorerManualReviewGates).toMatchObject({
      assetRightsApproved: true,
      clinicalClaimsApproved: false,
      sourceMappingApproved: false,
      visualReviewApproved: false,
    })
  })
})
