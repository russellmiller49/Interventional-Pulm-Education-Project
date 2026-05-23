import { airwayGenerations } from '@/data/bronchoscope-size-explorer/airway-generations'
import { bronchoscopes } from '@/data/bronchoscope-size-explorer/bronchoscopes'
import {
  circleAreaMm2,
  classifyInstrumentFit,
  estimateReachGeneration,
  getEstimatedReachLabel,
  getMaxReachableGeneration,
  getRemainingChannelAreaMm2,
} from './calculations'
import type { BronchoscopyInstrument } from './types'

describe('bronchoscope size explorer calculations', () => {
  describe('circleAreaMm2', () => {
    it('calculates circular cross-sectional area', () => {
      expect(circleAreaMm2(2.0)).toBeCloseTo(3.14, 2)
      expect(circleAreaMm2(2.8)).toBeCloseTo(6.16, 2)
    })
  })

  describe('getRemainingChannelAreaMm2', () => {
    it('returns positive remaining channel area when the instrument is smaller than the channel', () => {
      expect(getRemainingChannelAreaMm2(2.8, 1.1)).toBeGreaterThan(0)
    })

    it('returns null when instrument diameter is missing', () => {
      expect(getRemainingChannelAreaMm2(2.8)).toBeNull()
    })

    it('does not return negative area when the instrument is larger than the channel', () => {
      expect(getRemainingChannelAreaMm2(1.7, 2.4)).toBe(0)
    })
  })

  describe('classifyInstrumentFit', () => {
    it('fits instruments meeting minimum working channel requirements', () => {
      const instrument: BronchoscopyInstrument = {
        id: 'test-minimum',
        displayName: 'Test minimum',
        category: 'custom',
        minimumWorkingChannelMm: 2.8,
        notes: [],
        sourceLabel: 'Test',
        sourceType: 'educational model',
      }

      expect(classifyInstrumentFit(2.8, instrument)).toBe('fits')
    })

    it('rejects instruments with larger minimum working channel requirements', () => {
      const instrument: BronchoscopyInstrument = {
        id: 'test-guide-sheath',
        displayName: 'Test guide sheath',
        category: 'guide-sheath',
        minimumWorkingChannelMm: 2.6,
        notes: [],
        sourceLabel: 'Test',
        sourceType: 'educational model',
      }

      expect(classifyInstrumentFit(2.0, instrument)).toBe('does-not-fit')
    })

    it('fits instruments at a 1.7 mm minimum working channel threshold', () => {
      const instrument: BronchoscopyInstrument = {
        id: 'test-radial-ebus',
        displayName: 'Test radial EBUS',
        category: 'radial-ebus',
        minimumWorkingChannelMm: 1.7,
        notes: [],
        sourceLabel: 'Test',
        sourceType: 'educational model',
      }

      expect(classifyInstrumentFit(1.7, instrument)).toBe('fits')
    })

    it('returns unknown when no diameter or channel threshold is available', () => {
      const instrument: BronchoscopyInstrument = {
        id: 'test-unknown',
        displayName: 'Test unknown',
        category: 'custom',
        notes: [],
        sourceLabel: 'Test',
        sourceType: 'educational model',
      }

      expect(classifyInstrumentFit(2.8, instrument)).toBe('unknown')
    })
  })

  describe('estimateReachGeneration', () => {
    it('estimates fewer reachable generations for a larger therapeutic scope', () => {
      const therapeutic = bronchoscopes.find((scope) => scope.id === 'therapeutic-6-2-2-8')
      const ultrathin = bronchoscopes.find((scope) => scope.id === 'ultrathin-3-0-1-7')

      expect(therapeutic).toBeDefined()
      expect(ultrathin).toBeDefined()

      const therapeuticReach = getMaxReachableGeneration(
        estimateReachGeneration(therapeutic!.outerDiameterMm, airwayGenerations),
      )
      const ultrathinReach = getMaxReachableGeneration(
        estimateReachGeneration(ultrathin!.outerDiameterMm, airwayGenerations),
      )

      expect(therapeuticReach).toBeLessThan(ultrathinReach)
    })

    it('reduces estimated reach when clearance increases', () => {
      const scopeDiameterMm = 4.2
      const defaultReach = getMaxReachableGeneration(
        estimateReachGeneration(scopeDiameterMm, airwayGenerations, 0.3),
      )
      const largerClearanceReach = getMaxReachableGeneration(
        estimateReachGeneration(scopeDiameterMm, airwayGenerations, 0.5),
      )

      expect(largerClearanceReach).toBeLessThanOrEqual(defaultReach)
    })
  })

  describe('getEstimatedReachLabel', () => {
    it('maps central and lobar generations', () => {
      expect(getEstimatedReachLabel(2)).toBe('Central/lobar')
    })

    it('maps segmental and proximal subsegmental generations', () => {
      expect(getEstimatedReachLabel(4)).toBe('Segmental/proximal subsegmental')
    })

    it('maps subsegmental and distal subsegmental generations', () => {
      expect(getEstimatedReachLabel(6)).toBe('Subsegmental/distal subsegmental')
    })

    it('maps very distal generations', () => {
      expect(getEstimatedReachLabel(7)).toBe('Very distal/small-airway territory')
    })
  })
})
