import { assertNoUniversalTargetLanguage } from '@/features/critical-care/test-support/teachingPanelContract'

import {
  crrtBloodPathIds,
  crrtCircuitNode,
  crrtCircuitNodeIds,
  crrtCircuitNodes,
  crrtCircuitOverlay,
  crrtCircuitOverlayIds,
  crrtCircuitOverlays,
  crrtCircuitPath,
  crrtCircuitPathIds,
  crrtCircuitPathKindStyles,
  crrtCircuitPaths,
  crrtCircuitTextEquivalent,
  crrtOverlayFluidDestinations,
  crrtPressureSignalDetails,
  crrtPressureSignalIds,
  unresolvedCrrtCircuitSourceIds,
  type CrrtCircuitOverlayId,
} from '../content/circuitModel'
import {
  PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG,
  PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG,
} from '../engine/pressureModel'
import { crrtModalities } from '../engine/types'

describe('CRRT universal circuit geometry', () => {
  it('gives every node exactly one coordinate', () => {
    expect(crrtCircuitNodes).toHaveLength(crrtCircuitNodeIds.length)
    const seen = new Set(crrtCircuitNodes.map((node) => node.id))
    expect(seen.size).toBe(crrtCircuitNodeIds.length)
    for (const node of crrtCircuitNodes) {
      expect(Number.isFinite(node.at.x)).toBe(true)
      expect(Number.isFinite(node.at.y)).toBe(true)
    }
  })

  it('keeps every component in the same place in every overlay', () => {
    // The keystone guarantee: an overlay changes which fluids run, never where
    // anything sits. Coordinates live in one frozen table with no per-overlay
    // override, so this reads the table once per overlay and demands equality.
    const baseline = crrtCircuitNodes.map((node) => [node.id, node.at.x, node.at.y] as const)

    for (const overlayId of crrtCircuitOverlayIds) {
      crrtCircuitOverlay(overlayId)
      const perOverlay = crrtCircuitNodes.map((node) => [node.id, node.at.x, node.at.y] as const)
      expect(perOverlay).toEqual(baseline)
    }
  })

  it('draws the access and return lumens as two distinct components', () => {
    const access = crrtCircuitNode('access-lumen')
    const returnLumen = crrtCircuitNode('return-lumen')

    expect(access.id).not.toBe(returnLumen.id)
    expect(access.at).not.toEqual(returnLumen.at)
    expect(access.label).toBe('ACCESS LUMEN')
    expect(returnLumen.label).toBe('RETURN LUMEN')
    expect(access.description).toMatch(/leaves the patient/i)
    expect(returnLumen.description).toMatch(/re-enters the patient/i)
  })

  it('names the access lumen without colliding with the localization lab', () => {
    // `practiceAssess.ui.test.tsx` queries a radio named exactly
    // "Access catheter" from the pressure-localization lab in the same lesson
    // tree. Nothing on the circuit may answer to that name.
    for (const node of crrtCircuitNodes) {
      expect(node.label).not.toBe('Access catheter')
      expect(node.subLabel ?? '').not.toBe('Access catheter')
    }
  })

  it('gives every path a resolvable kind and a non-colour encoding', () => {
    expect(crrtCircuitPaths).toHaveLength(crrtCircuitPathIds.length)
    for (const path of crrtCircuitPaths) {
      const style = crrtCircuitPathKindStyles.find((candidate) => candidate.kind === path.kind)
      expect(style).toBeDefined()
      expect(style?.patternDescription.length).toBeGreaterThan(0)
      expect(path.d).toMatch(/^M /)
      expect(path.textEquivalent.length).toBeGreaterThan(0)
    }
  })
})

describe('CRRT circuit overlays', () => {
  it('offers every view the package requires, in order', () => {
    expect(crrtCircuitOverlays.map((overlay) => overlay.id)).toEqual([
      'blood-path',
      'scuf',
      'cvvhd',
      'cvvh-pre',
      'cvvh-post',
      'cvvhdf',
      'fluid-conservation',
      'citrate-calcium',
      'pressure-profile',
    ])
  })

  it('binds every modality overlay to a real engine modality', () => {
    const overlayModalities = crrtCircuitOverlays
      .map((overlay) => overlay.modality)
      .filter((modality): modality is (typeof crrtModalities)[number] => modality !== null)

    for (const modality of overlayModalities) {
      expect(crrtModalities).toContain(modality)
    }
    // Every modality the engine knows about is drawable.
    expect(new Set(overlayModalities)).toEqual(new Set(crrtModalities))
  })

  it('activates only the fluid paths each modality actually runs', () => {
    const expectations: Readonly<
      Record<string, { on: readonly string[]; off: readonly string[] }>
    > = {
      'blood-path': {
        on: [],
        off: [
          'dialysate-supply',
          'pre-filter-replacement',
          'post-filter-replacement',
          'effluent-line',
        ],
      },
      scuf: {
        on: ['effluent-line'],
        off: ['dialysate-supply', 'pre-filter-replacement', 'post-filter-replacement'],
      },
      cvvhd: {
        on: ['dialysate-supply', 'effluent-line'],
        off: ['pre-filter-replacement', 'post-filter-replacement'],
      },
      'cvvh-pre': {
        on: ['pre-filter-replacement', 'effluent-line'],
        off: ['dialysate-supply', 'post-filter-replacement'],
      },
      'cvvh-post': {
        on: ['post-filter-replacement', 'effluent-line'],
        off: ['dialysate-supply', 'pre-filter-replacement'],
      },
      cvvhdf: {
        on: [
          'dialysate-supply',
          'pre-filter-replacement',
          'post-filter-replacement',
          'effluent-line',
        ],
        off: [],
      },
    }

    for (const [overlayId, expectation] of Object.entries(expectations)) {
      const overlay = crrtCircuitOverlay(overlayId as CrrtCircuitOverlayId)
      for (const pathId of expectation.on) {
        expect(overlay.activePathIds).toContain(pathId)
      }
      for (const pathId of expectation.off) {
        expect(overlay.activePathIds).not.toContain(pathId)
      }
      // The blood loop is present in every view, unchanged.
      for (const bloodPathId of crrtBloodPathIds) {
        expect(overlay.activePathIds).toContain(bloodPathId)
      }
    }
  })

  it('never lets dialysate be counted as fluid that enters the patient', () => {
    for (const overlay of crrtCircuitOverlays) {
      const destinations = crrtOverlayFluidDestinations(overlay)
      expect(destinations.entersPatient).not.toContain('dialysate-supply')
      if (overlay.activePathIds.includes('dialysate-supply')) {
        expect(destinations.neverEntersPatient).toContain('dialysate-supply')
      }
    }
  })

  it('puts replacement fluid on the patient side at whichever port is selected', () => {
    const pre = crrtOverlayFluidDestinations(crrtCircuitOverlay('cvvh-pre'))
    const post = crrtOverlayFluidDestinations(crrtCircuitOverlay('cvvh-post'))

    expect(pre.entersPatient).toContain('pre-filter-replacement')
    expect(pre.entersPatient).not.toContain('post-filter-replacement')
    expect(post.entersPatient).toContain('post-filter-replacement')
    expect(post.entersPatient).not.toContain('pre-filter-replacement')
    // The distinguishing claim: only post-filter fluid escapes filtration.
    expect(crrtCircuitPath('post-filter-replacement').textEquivalent).toMatch(
      /never crosses the membrane/i,
    )
    expect(crrtCircuitPath('pre-filter-replacement').textEquivalent).toMatch(/before the filter/i)
  })

  it('shows the citrate path and both sampling domains only in the citrate view', () => {
    const citrate = crrtCircuitOverlay('citrate-calcium')

    expect(citrate.activePathIds).toContain('pbp-citrate-infusion')
    expect(citrate.activePathIds).toContain('calcium-infusion')
    expect(citrate.showsSamplingDomains).toBe(true)
    expect(crrtCircuitPath('pbp-citrate-infusion').textEquivalent).toMatch(/before the filter/i)
    expect(crrtCircuitPath('calcium-infusion').textEquivalent).toMatch(
      /separate infusion line|does not pass through the circuit/i,
    )

    for (const overlay of crrtCircuitOverlays) {
      if (overlay.id === 'citrate-calcium') continue
      expect(overlay.showsSamplingDomains).toBe(false)
    }
  })

  it('carries no protocol-specific citrate dose, target, or ratio', () => {
    const citrate = crrtCircuitOverlay('citrate-calcium')
    const copy = [citrate.summary, citrate.teachingPoint].join(' ')

    expect(copy).not.toMatch(/\d/)
    expect(copy).not.toMatch(/mmol|ratio|dose|titrat/i)
  })

  it('gives all nine overlays a complete text equivalent', () => {
    expect(crrtCircuitOverlayIds).toHaveLength(9)

    for (const overlayId of crrtCircuitOverlayIds) {
      const overlay = crrtCircuitOverlay(overlayId)
      const text = crrtCircuitTextEquivalent(overlayId)

      // Names itself, every fluid it runs, where each fluid ends up, and what
      // the view is for — the four things a reader who cannot see it needs.
      expect(text).toContain(overlay.label)
      expect(text).toContain(overlay.summary)
      expect(text).toContain(overlay.teachingPoint)
      for (const pathId of overlay.activePathIds) {
        expect(text).toContain(crrtCircuitPath(pathId).textEquivalent)
      }
      expect(text).toMatch(/enters the patient/i)

      // A pressure view must name the measured/calculated split; a citrate view
      // must name both sampling domains.
      if (overlay.showsPressureProfile) {
        expect(text).toMatch(/directly modelled pressure sites/i)
        expect(text).toMatch(/calculated relationships with no location of their own/i)
      }
      if (overlay.showsSamplingDomains) {
        expect(text).toMatch(/circuit sampling domain/i)
        expect(text).toMatch(/systemic sampling domain/i)
      }

      expect(text.trim().length).toBeGreaterThan(200)
    }
  })

  it('resolves every citation against the pilot, supplemental, and device-math registries', () => {
    expect(unresolvedCrrtCircuitSourceIds()).toEqual([])
    for (const overlay of crrtCircuitOverlays) {
      expect(overlay.sourceIds.length).toBeGreaterThan(0)
    }
  })

  it('introduces no universal target language', () => {
    for (const overlay of crrtCircuitOverlays) {
      assertNoUniversalTargetLanguage(
        [overlay.label, overlay.summary, overlay.teachingPoint].join(' '),
      )
    }
    for (const path of crrtCircuitPaths) {
      assertNoUniversalTargetLanguage([path.label, path.textEquivalent].join(' '))
    }
    for (const node of crrtCircuitNodes) {
      assertNoUniversalTargetLanguage([node.label, node.subLabel ?? '', node.description].join(' '))
    }
  })
})

describe('CRRT pressure semantics', () => {
  it('marks exactly four sites as directly modelled and two as calculated', () => {
    expect(crrtPressureSignalDetails).toHaveLength(crrtPressureSignalIds.length)

    const modelled = crrtPressureSignalDetails.filter(
      (detail) => detail.kind === 'directly-modelled-site',
    )
    const calculated = crrtPressureSignalDetails.filter(
      (detail) => detail.kind === 'calculated-relationship',
    )

    expect(modelled.map((detail) => detail.id)).toEqual(['access', 'filter', 'return', 'effluent'])
    expect(calculated.map((detail) => detail.id)).toEqual(['tmp', 'filter-drop'])
  })

  it('gives modelled sites a location and calculated values none', () => {
    for (const detail of crrtPressureSignalDetails) {
      if (detail.kind === 'directly-modelled-site') {
        expect(detail.nodeId).not.toBeNull()
        expect(crrtCircuitNode(detail.nodeId!).id).toBe(detail.nodeId)
        expect(detail.derivedFromNodeIds).toHaveLength(0)
      } else {
        expect(detail.nodeId).toBeNull()
        expect(detail.derivedFromNodeIds.length).toBeGreaterThan(0)
        expect(detail.physicalLocation).toMatch(/^Nowhere\./)
      }
    }
  })

  it('states the calculated formulas using the engine constants, so copy cannot drift', () => {
    const tmp = crrtPressureSignalDetails.find((detail) => detail.id === 'tmp')
    const drop = crrtPressureSignalDetails.find((detail) => detail.id === 'filter-drop')

    expect(tmp?.whatProducesTheValue).toContain(String(PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG))
    expect(drop?.whatProducesTheValue).toContain(
      String(PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG),
    )
    expect(tmp?.derivedFromNodeIds).toEqual([
      'filter-pressure',
      'return-pressure',
      'effluent-pressure',
    ])
    expect(drop?.derivedFromNodeIds).toEqual(['filter-pressure', 'return-pressure'])
    expect(tmp?.sourceIds).toContain('MATH-PM-002')
    expect(drop?.sourceIds).toContain('DEV-PM-010')
  })

  it('answers all seven required questions for every pressure', () => {
    // The closeout list. Each field is required to be substantive prose rather
    // than a placeholder, so an empty-but-present field cannot pass.
    for (const detail of crrtPressureSignalDetails) {
      const scalar: Readonly<Record<string, string>> = {
        'physical location': detail.physicalLocation,
        'what produces the value': detail.whatProducesTheValue,
        'how blood flow changes it': detail.bloodFlowEffect,
        'unreliable-signal conditions': detail.whenUnreliable,
        'first safe inspection and escalation boundary': detail.firstInspectionBoundary,
      }
      for (const [requirement, text] of Object.entries(scalar)) {
        expect({ signal: detail.id, requirement, chars: text.trim().length }).toEqual({
          signal: detail.id,
          requirement,
          chars: expect.any(Number),
        })
        expect(text.trim().length).toBeGreaterThan(40)
      }

      const listed: Readonly<Record<string, readonly string[]>> = {
        'patient and access causes': detail.patientOrAccessCauses,
        'circuit causes': detail.circuitCauses,
      }
      for (const [requirement, entries] of Object.entries(listed)) {
        expect({ signal: detail.id, requirement, count: entries.length }).not.toEqual({
          signal: detail.id,
          requirement,
          count: 0,
        })
        for (const entry of entries) expect(entry.trim().length).toBeGreaterThan(20)
      }

      expect(detail.firstInspectionBoundary).toMatch(
        /responsible clinical team and the local protocol/i,
      )
    }
  })

  it('says that blood flow alone moves every flow-dependent pressure', () => {
    // The model makes access fall and filter/return/TMP/drop rise with blood
    // flow through unchanged resistance. Saying so is the difference between a
    // learner reading a trend and a learner reading arithmetic.
    for (const id of ['access', 'filter', 'return', 'tmp', 'filter-drop'] as const) {
      const detail = crrtPressureSignalDetails.find((candidate) => candidate.id === id)
      expect(detail?.bloodFlowEffect).toMatch(/blood flow/i)
    }
    const effluent = crrtPressureSignalDetails.find((detail) => detail.id === 'effluent')
    expect(effluent?.bloodFlowEffect).toMatch(/indirectly|only/i)
  })

  it('publishes no universal pressure target', () => {
    for (const detail of crrtPressureSignalDetails) {
      const copy = [
        detail.label,
        detail.physicalLocation,
        detail.whatProducesTheValue,
        detail.bloodFlowEffect,
        ...detail.patientOrAccessCauses,
        ...detail.circuitCauses,
        detail.whenUnreliable,
        detail.firstInspectionBoundary,
      ].join(' ')
      assertNoUniversalTargetLanguage(copy)
      expect(copy).not.toMatch(/\bnormal range\b|\bshould be (?:below|above)\b/i)
    }
  })
})
