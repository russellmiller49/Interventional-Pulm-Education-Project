import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  ecmoCircuitSegmentById,
  ecmoPressureZoneById,
  ecmoSensorSiteById,
  resolveEcmoModeText,
} from '../content/circuitSegments'
import { evidenceById } from '../content/evidence'
import {
  ECMO_LOCALIZATION_FOOTER,
  ecmoLocalizationRow,
  ecmoLocalizationRowById,
  ecmoLocalizationRowIds,
  ecmoLocalizationRowTextEquivalent,
  ecmoLocalizationRows,
  ecmoLocalizationScaffoldTextEquivalent,
  ecmoLocalizationZoneSentence,
  validateEcmoLocalizationCardRegistry,
} from '../content/localizationCards'
import { ecmoDerivedValueGuides } from '../content/ecmoValueGuides'

/**
 * The diagnostic grammar, checked as authored content.
 *
 * The rows are the one place this module is allowed to say "this pattern means the problem lives
 * there". Everything asserted here is about that privilege: that each row resolves to real places
 * on the real circuit, that every claim it makes names a source that supports it, that it carries
 * no number a learner could carry to a bedside, and that its wording cannot leak into a
 * pre-commitment surface by accident.
 */

const MODES = ['vv', 'va'] as const

function learnerFacingStrings(): readonly string[] {
  return ecmoLocalizationRows.flatMap((row) => [
    row.label,
    ...MODES.map((mode) => resolveEcmoModeText(row.signature, mode)),
    row.problemLocation,
    ...row.causes,
    row.actionClass,
    row.harmfulReflex,
    row.modelBoundary,
    row.vaVariation,
    ...row.sourceSupport.map((support) => support.claim),
    ...MODES.map((mode) => ecmoLocalizationRowTextEquivalent(mode, row.id)),
  ])
}

describe('ECMO localization-card registry', () => {
  it('validates cleanly at import and by explicit call', () => {
    expect(validateEcmoLocalizationCardRegistry()).toEqual([])
  })

  it('authors exactly the four recurring patterns, once each', () => {
    expect([...ecmoLocalizationRowIds]).toEqual([
      'drainage-limitation',
      'return-path-resistance',
      'membrane-resistance',
      'gas-path-failure',
    ])
    expect(ecmoLocalizationRows.map((row) => row.id)).toEqual([...ecmoLocalizationRowIds])
    for (const id of ecmoLocalizationRowIds) expect(ecmoLocalizationRowById.get(id)?.id).toBe(id)
  })

  it('throws rather than returning undefined for an unknown row', () => {
    // @ts-expect-error the accessor is typed; the throw protects a cast at a boundary.
    expect(() => ecmoLocalizationRow('pump-failure')).toThrow(/pump-failure/)
  })

  it('maps one row to each held drill family, so a later migration selects rather than renames', () => {
    const families = ecmoLocalizationRows.map((row) => row.drillFamily)
    expect(new Set(families).size).toBe(families.length)
    expect([...families].sort()).toEqual([
      'gas-source-interruption',
      'oxygenator-resistance',
      'preload',
      'return-obstruction',
    ])
  })

  it('points every row at real places on the canonical circuit', () => {
    for (const row of ecmoLocalizationRows) {
      expect(row.zoneIds.length).toBeGreaterThan(0)
      for (const zoneId of row.zoneIds) expect(ecmoPressureZoneById.has(zoneId)).toBe(true)

      expect(row.sensorSiteIds.length).toBeGreaterThan(0)
      for (const siteId of row.sensorSiteIds) expect(ecmoSensorSiteById.has(siteId)).toBe(true)

      expect(row.implicatedSegmentIds.length).toBeGreaterThan(0)
      for (const segmentId of row.implicatedSegmentIds) {
        expect(ecmoCircuitSegmentById.has(segmentId)).toBe(true)
      }

      for (const key of row.valueGuideKeys ?? []) {
        expect(ecmoDerivedValueGuides[key]).toBeTruthy()
      }
    }
  })

  it('separates where the pattern shows from where the problem lives', () => {
    // The return row is the case that makes the distinction load-bearing: the pressures move
    // downstream of the pump, and the obstruction sits beyond the membrane.
    const returnRow = ecmoLocalizationRow('return-path-resistance')
    expect([...returnRow.zoneIds]).toContain('downstream-of-pump')
    expect([...returnRow.implicatedSegmentIds]).toEqual(['post-membrane', 'return'])

    expect([...ecmoLocalizationRow('drainage-limitation').implicatedSegmentIds]).toEqual([
      'drainage',
    ])
    expect([...ecmoLocalizationRow('membrane-resistance').implicatedSegmentIds]).toEqual([
      'membrane',
    ])
    expect([...ecmoLocalizationRow('gas-path-failure').implicatedSegmentIds]).toEqual([
      'gas-supply',
      'membrane-gas-side',
    ])
  })

  it('gives every row a shortlist a learner can hold, and a reflex to avoid', () => {
    for (const row of ecmoLocalizationRows) {
      expect(row.causes.length).toBeGreaterThan(0)
      expect(row.causes.length).toBeLessThanOrEqual(4)
      expect(row.actionClass.length).toBeGreaterThan(0)
      expect(row.harmfulReflex.length).toBeGreaterThan(0)
      expect(row.problemLocation.length).toBeGreaterThan(0)
      expect(row.vaVariation.length).toBeGreaterThan(0)
    }
  })

  it('states what the simulation does not represent, in words the boundary contract recognises', () => {
    for (const row of ecmoLocalizationRows) {
      expect(row.modelBoundary).toMatch(/simulation|model/i)
    }
  })

  it('supports every row with sources that resolve, each carrying its own claim', () => {
    for (const row of ecmoLocalizationRows) {
      expect(row.sourceSupport.length).toBeGreaterThan(0)
      for (const support of row.sourceSupport) {
        expect(evidenceById.has(support.evidenceId)).toBe(true)
        expect(support.claim.length).toBeGreaterThan(0)
      }
      // The bounded model answers for everything the simulation authored, on every row.
      expect(row.sourceSupport.map((support) => support.evidenceId)).toContain(
        'bounded-educational-model',
      )
    }
  })

  it('teaches the gradient against this circuit rather than against a number', () => {
    expect(ECMO_LOCALIZATION_FOOTER.valueGuideKey).toBe('transmembraneDeltaP')
    expect(ecmoDerivedValueGuides[ECMO_LOCALIZATION_FOOTER.valueGuideKey]).toBeTruthy()
    expect(ECMO_LOCALIZATION_FOOTER.text).toMatch(/similar blood flow/i)
    expect(ECMO_LOCALIZATION_FOOTER.text).toMatch(/own earlier value/i)
  })

  /*
   * The similar-flow qualification is a declared fact about the row, not a phrase in a sentence.
   *
   * The independent review's mutation deleted "read at similar blood flow" from the return-row
   * signature and the whole suite stayed green — the qualification was load-bearing (the pump
   * section now loads a resisted-return state whose gradient falls with the flow at an unchanged
   * speed) but nothing owned it. Now the row declares the basis, the import-time validator holds
   * the sentence and the declaration to each other both ways, and these cases prove the coupling
   * kills the mutation in each direction while leaving rewordings that keep the rule alone.
   */
  it('declares every flow-conditioned gradient claim, and only those', () => {
    // The return row's "changes little" and the membrane row's "widens" are the same clinical rule
    // read from opposite sides: neither claim means anything unless the flows compared are
    // similar. The drainage and gas rows make no gradient claim conditioned on flow.
    expect(ecmoLocalizationRow('return-path-resistance').gradientComparisonBasis).toBe(
      'at-similar-blood-flow',
    )
    expect(ecmoLocalizationRow('membrane-resistance').gradientComparisonBasis).toBe(
      'at-similar-blood-flow',
    )
    for (const row of ecmoLocalizationRows) {
      if (row.id !== 'return-path-resistance' && row.id !== 'membrane-resistance') {
        expect(`${row.id}: ${row.gradientComparisonBasis}`).toBe(`${row.id}: undefined`)
      }
    }
  })

  it('fails validation when the signature loses the qualification the row declares', () => {
    const mutated = ecmoLocalizationRows.map((row) =>
      row.id === 'return-path-resistance'
        ? {
            ...row,
            signature:
              'Both post-pump pressures rise together; the gradient across the membrane changes little.',
          }
        : row,
    )
    const errors = validateEcmoLocalizationCardRegistry(mutated).join('\n')
    expect(errors).toContain('return-path-resistance')
    expect(errors).toContain('does not say so')
  })

  it('fails validation when the qualification is orphaned from its declaration', () => {
    const mutated = ecmoLocalizationRows.map((row) =>
      row.id === 'return-path-resistance' ? { ...row, gradientComparisonBasis: undefined } : row,
    )
    const errors = validateEcmoLocalizationCardRegistry(mutated).join('\n')
    expect(errors).toContain('return-path-resistance')
    expect(errors).toContain('without declaring gradientComparisonBasis')
  })

  it('accepts a rewording that keeps the clinical rule', () => {
    const reworded = ecmoLocalizationRows.map((row) =>
      row.id === 'return-path-resistance'
        ? {
            ...row,
            signature:
              'Both post-pump pressures rise together; compared at a matched flow, the gradient across the membrane changes little.',
          }
        : row,
    )
    expect(validateEcmoLocalizationCardRegistry(reworded)).toEqual([])
  })

  it('carries no number anywhere a learner could read one as a target', () => {
    for (const value of [...learnerFacingStrings(), ECMO_LOCALIZATION_FOOTER.text]) {
      expect(value).not.toMatch(/\d/)
    }
  })

  it('never phrases a row the way a pre-commitment leak is phrased', () => {
    /*
     * Two sentence shapes the drill contract bans from any pre-commitment surface. A row that
     * carried one could never be shown in a scaffold, and the ban is cheaper to enforce here — at
     * the one place the sentences are written — than to rediscover per consumer.
     */
    for (const value of learnerFacingStrings()) {
      expect(value).not.toMatch(/\bis active on this circuit\b/i)
      expect(value).not.toMatch(/\bhas been corrected on this circuit\b/i)
    }
  })

  it('keeps the response teaching out of anything a scaffold may show', () => {
    // Pattern, location and provenance are safe to show before a learner commits anywhere.
    // Causes, the fitting response, and the reflex are the answer, and every row says so.
    for (const row of ecmoLocalizationRows) expect(row.precommitVisibility).toBe('never')
  })

  it('reads the same row in both tracks, and says what VA changes', () => {
    for (const row of ecmoLocalizationRows) {
      for (const mode of MODES) {
        expect(resolveEcmoModeText(row.signature, mode).length).toBeGreaterThan(0)
        const equivalent = ecmoLocalizationRowTextEquivalent(mode, row.id)
        expect(equivalent).toContain(row.problemLocation)
        for (const cause of row.causes) expect(equivalent).toContain(cause)
      }
      expect(ecmoLocalizationRowTextEquivalent('va', row.id)).toContain(row.vaVariation)
      expect(ecmoLocalizationRowTextEquivalent('vv', row.id)).not.toContain(row.vaVariation)
    }
  })

  it('describes the scaffolded table without giving away the response teaching', () => {
    /*
     * The scaffold is the foundation view: four patterns and where each one lives, shown while the
     * circuit in front of the learner has nothing wrong with it. Its text equivalent has to carry
     * the same disclosure as the table it describes — so the cause shortlists, the fitting response
     * and the reflex belong to the revealed row and appear in neither.
     */
    for (const mode of MODES) {
      const scaffold = ecmoLocalizationScaffoldTextEquivalent(mode)
      for (const row of ecmoLocalizationRows) {
        expect(scaffold).toContain(row.label)
        expect(scaffold).toContain(resolveEcmoModeText(row.signature, mode))
        expect(scaffold).toContain(row.problemLocation)
        for (const cause of row.causes) expect(scaffold).not.toContain(cause)
        expect(scaffold).not.toContain(row.actionClass)
        expect(scaffold).not.toContain(row.harmfulReflex)
      }
    }
  })

  it('sends a learner to read a change, except where the finding is that nothing changed', () => {
    /*
     * The gas row names the same three pressure groupings as the others and means the opposite by
     * them. The lead lives on the row so the card's block and the card's prose cannot disagree —
     * they did: the block said "quiet" while the paragraph beneath it said "read in", which sent
     * the learner hunting for a pressure change this simulation provably cannot produce.
     */
    expect(ecmoLocalizationZoneSentence('gas-path-failure')).toMatch(
      /^Quiet, and that is the finding:/,
    )
    expect(ecmoLocalizationZoneSentence('gas-path-failure')).not.toMatch(/Read in/)
    expect(ecmoLocalizationRowTextEquivalent('vv', 'gas-path-failure')).not.toMatch(/Read in/)

    for (const rowId of [
      'drainage-limitation',
      'return-path-resistance',
      'membrane-resistance',
    ] as const) {
      expect(ecmoLocalizationZoneSentence(rowId)).toMatch(/^Read in:/)
    }

    // Whatever the lead is, both surfaces use the same one.
    for (const row of ecmoLocalizationRows) {
      for (const mode of MODES) {
        expect(ecmoLocalizationRowTextEquivalent(mode, row.id)).toContain(
          ecmoLocalizationZoneSentence(row.id),
        )
      }
    }
  })

  it('passes the static-copy scan that covers the components this copy used to live in', () => {
    /*
     * These sentences used to sit inside `PumpPressureZonesPanel.tsx`, where the critical-care AST
     * scan reads every `.tsx` under seven feature `components/` roots. Moving them into `content/`
     * moved them out of that scan's reach, so the same rule is applied here instead — read out of
     * the scanning test's own source, so the two lists cannot drift apart.
     */
    const scannerSource = readFileSync(
      path.join(process.cwd(), 'src/features/critical-care/__tests__/learner-copy.test.ts'),
      'utf8',
    )
    const declaration = /const forbiddenStaticUiTerms = \[([^\]]*)\] as const/.exec(scannerSource)
    expect(declaration).not.toBeNull()
    const terms = [...(declaration?.[1] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1])
    expect(terms.length).toBeGreaterThan(10)

    for (const value of [...learnerFacingStrings(), ECMO_LOCALIZATION_FOOTER.text]) {
      for (const term of terms) {
        expect(value.toLowerCase()).not.toMatch(new RegExp(`\\b${term}\\b`))
      }
      expect(value).not.toMatch(/\b(?:lessons|cases|steps)\s+complete\b/i)
    }
  })
})
