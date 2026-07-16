import {
  assessBronchoscopyDecision,
  calculateEttOcclusion,
  classifyStenosis,
  planCentralAirwayObstruction,
  recommendForeignBodyTool,
  scoreBalQuality,
  scoreBleedingSequence,
} from '../engine/introCalculations'
import {
  INTRO_BRONCHOSCOPY_PROGRESS_KEY,
  countIntroCompletedSections,
  emptyIntroBronchoscopyProgress,
  isIntroModuleComplete,
  readIntroBronchoscopyProgress,
  withIntroSectionComplete,
} from '../engine/progress'

describe('intro bronchoscopy engines', () => {
  it('prioritizes meaningful benefit over low-value procedure requests', () => {
    expect(
      assessBronchoscopyDecision({
        alternativeYield: 2,
        expectedBenefit: 8,
        physiologicRisk: 3,
        resultChangesManagement: true,
        urgency: 5,
      }).decision,
    ).toBe('scope')

    expect(
      assessBronchoscopyDecision({
        alternativeYield: 1,
        expectedBenefit: 3,
        physiologicRisk: 4,
        resultChangesManagement: false,
        urgency: 2,
      }).decision,
    ).toBe('defer')
  })

  it('classifies ETT obstruction from scope-to-tube area', () => {
    const result = calculateEttOcclusion(7.5, 5.8)
    expect(result.percentOccluded).toBeGreaterThan(50)
    expect(result.severity).toMatch(/high|critical/)
  })

  it('scores BAL quality and reports missed technique elements', () => {
    const result = scoreBalQuality({
      avoidedProximalSuction: false,
      instilledMl: 80,
      returnedMl: 15,
      sentCorrectTests: true,
      targetSelected: true,
      wedged: false,
    })
    expect(result.quality).toMatch(/poor|borderline/)
    expect(result.misses.length).toBeGreaterThan(0)
  })

  it('classifies stenosis and foreign-body tool strategy', () => {
    expect(classifyStenosis(75).severity).toBe('severe')
    expect(
      recommendForeignBodyTool({ airwayControlNeeded: false, shape: 'round-smooth' }).primary,
    ).toBe('basket')
    expect(recommendForeignBodyTool({ airwayControlNeeded: true, shape: 'sharp' }).primary).toBe(
      'rigid',
    )
  })

  it('checks bleeding and CAO planning branches', () => {
    expect(
      scoreBleedingSequence([
        'announce',
        'suction',
        'protect-good-lung',
        'wedge',
        'topical',
        'escalate',
      ]).complete,
    ).toBe(true)
    expect(planCentralAirwayObstruction('extrinsic')).toContain(
      'Preserve spontaneous ventilation when feasible',
    )
  })

  it('tracks intro bronchoscopy progress by section', () => {
    const now = '2026-07-05T00:00:00.000Z'
    const map = withIntroSectionComplete({}, 'decision-risk-planning', 'learn', true, now)
    expect(countIntroCompletedSections(map['decision-risk-planning'])).toBe(1)
    const complete = withIntroSectionComplete(
      withIntroSectionComplete(map, 'decision-risk-planning', 'practice', true, now),
      'decision-risk-planning',
      'assessment',
      true,
      now,
    )
    expect(isIntroModuleComplete(complete['decision-risk-planning'])).toBe(true)
  })

  it('returns stable progress snapshots for React external-store reads', () => {
    expect(emptyIntroBronchoscopyProgress()).toBe(emptyIntroBronchoscopyProgress())

    if (typeof window === 'undefined') return

    window.localStorage.removeItem(INTRO_BRONCHOSCOPY_PROGRESS_KEY)
    expect(readIntroBronchoscopyProgress()).toBe(readIntroBronchoscopyProgress())

    window.localStorage.setItem(
      INTRO_BRONCHOSCOPY_PROGRESS_KEY,
      JSON.stringify({
        'decision-risk-planning': {
          learn: true,
          updatedAt: '2026-07-05T00:00:00.000Z',
        },
      }),
    )
    expect(readIntroBronchoscopyProgress()).toBe(readIntroBronchoscopyProgress())
  })
})
