import {
  architectureRegistry,
  getArchitectureCapabilities,
  getArchitectureProfile,
  getArchitecturesForLoadMode,
  supportsLoadMode,
  validateArchitectureRegistry,
} from '../content/architectureRegistry'
import { STENT_ARCHITECTURE_IDS, STENT_LOAD_MODES } from '../engine/learningLabTypes'

describe('airway stent learning-lab architecture registry', () => {
  it('defines the seven canonical, distinct topology profiles', () => {
    expect(architectureRegistry.map((profile) => profile.id)).toEqual(STENT_ARCHITECTURE_IDS)
    expect(new Set(architectureRegistry.map((profile) => profile.geometryBuilder)).size).toBe(7)
    expect(new Set(architectureRegistry.map((profile) => profile.topologyLabel)).size).toBe(7)
    expect(validateArchitectureRegistry()).toEqual([])
  })

  it('keeps fixed coverage and expansion mechanisms internally coherent', () => {
    for (const profile of architectureRegistry) {
      expect(profile.supportedLoadModes).toContain('rest')
      expect(profile.teachingPoints.length).toBeGreaterThanOrEqual(3)
      expect(profile.strengths.length).toBeGreaterThanOrEqual(3)
      expect(profile.tradeoffs.length).toBeGreaterThanOrEqual(3)
      expect(profile.limitations.length).toBeGreaterThanOrEqual(2)
      expect(profile.evidenceRefs.length).toBeGreaterThan(0)

      if (profile.expansionMechanism === 'molded-passive') {
        expect(profile.coverage).toBe('integral-solid-wall')
      }
      if (profile.coverage === 'uncovered') {
        expect(profile.capabilities.supportsCoverInspection).toBe(false)
      }
      if (profile.capabilities.supportsCoverInspection) {
        expect(profile.coverage).not.toBe('uncovered')
        expect(profile.coverage).not.toBe('integral-solid-wall')
      }
    }
  })

  it('provides clinically legible, nonpromotional considerations for every family', () => {
    const requiredFields = [
      'commonRoles',
      'deploymentConsiderations',
      'removalConsiderations',
      'tissueInterfaceConsiderations',
      'secretionConsiderations',
      'fitConsiderations',
      'failureModesToAnticipate',
    ] as const

    for (const profile of architectureRegistry) {
      for (const field of requiredFields) {
        expect(profile.clinicalConsiderations[field].length).toBeGreaterThanOrEqual(2)
        expect(profile.clinicalConsiderations[field].every((item) => item.trim().length > 0)).toBe(
          true,
        )
      }

      const clinicalCopy = Object.values(profile.clinicalConsiderations)
        .flatMap((value) => (Array.isArray(value) ? value : []))
        .join(' ')

      expect(clinicalCopy).not.toMatch(/\b(best|safest|superior|always|never)\b/i)
      expect(clinicalCopy).not.toMatch(/\b(GINA|BONASTENT|AERO|Ultraflex|Dumon)\b/i)
    }

    expect(
      getArchitectureProfile('silicone-y').clinicalConsiderations.fitConsiderations.join(' '),
    ).toMatch(/whole-Y|limb|carinal/i)
    expect(
      getArchitectureProfile(
        'free-crossing-braid',
      ).clinicalConsiderations.removalConsiderations.join(' '),
    ).toMatch(/incorporation|removal/i)
    expect(
      getArchitectureProfile(
        'single-wire-knit-partial-cover',
      ).clinicalConsiderations.removalConsiderations.join(' '),
    ).toMatch(/exposed|incorporate/i)
  })

  it('exposes controls only when topology supports them', () => {
    const laser = getArchitectureProfile('laser-cut-covered')
    const y = getArchitectureProfile('silicone-y')
    const freeBraid = getArchitectureProfile('free-crossing-braid')
    const capturedBraid = getArchitectureProfile('hook-cross-covered')
    const knit = getArchitectureProfile('single-wire-knit-partial-cover')

    expect(laser.capabilities.supportsBraidAngleControl).toBe(false)
    expect(laser.geometryBuilder).toBe('laser-cut-rings')
    expect(y.capabilities).toMatchObject({
      isBifurcated: true,
      supportsTubularControls: false,
      supportsLengthChange: false,
    })
    expect(freeBraid.capabilities).toMatchObject({
      supportsBraidAngleControl: true,
      hasSlidingCrossings: true,
    })
    expect(capturedBraid.capabilities).toMatchObject({
      supportsBraidAngleControl: true,
      hasSlidingCrossings: false,
      supportsCoverInspection: true,
    })
    expect(knit.geometryBuilder).toBe('single-wire-knitted-loops')
    expect(knit.capabilities.supportsBraidAngleControl).toBe(false)
  })

  it('provides safe lookup and load-mode helpers', () => {
    expect(getArchitectureCapabilities('studded-silicone')).toEqual(
      getArchitectureProfile('studded-silicone').capabilities,
    )
    expect(() => getArchitectureProfile('not-real')).toThrow('Unknown airway-stent architecture')
    expect(supportsLoadMode('silicone-y', 'ovalization')).toBe(false)
    expect(supportsLoadMode('free-crossing-braid', 'ovalization')).toBe(true)

    for (const mode of STENT_LOAD_MODES) {
      const profiles = getArchitecturesForLoadMode(mode)
      expect(profiles.length).toBeGreaterThan(0)
      expect(profiles.every((profile) => supportsLoadMode(profile, mode))).toBe(true)
    }
  })

  it('labels branded examples as examples rather than rankings or exact CAD', () => {
    const branded = architectureRegistry.filter((profile) => profile.brandedExample)
    expect(branded.map((profile) => profile.brandedExample)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('GINA'),
        expect.stringContaining('BONASTENT'),
        expect.stringContaining('AERO'),
        expect.stringContaining('Ultraflex'),
      ]),
    )
    for (const profile of branded) {
      expect(profile.limitations.join(' ')).toMatch(
        /not exact|not universal|fixture|not comparative/i,
      )
    }
  })
})
