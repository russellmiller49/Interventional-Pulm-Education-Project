/** @jest-environment node */
import { CRRT_NUMBERS } from '@/features/baxter-crrt/content/teachingNumbers'
import { NUMBER_REGISTER as BRONCH_NUMBER_REGISTER } from '@/features/bronchoscopy-foundations/content/numbers'
import { ECMO_NUMBERS } from '@/features/cardiohelp-ecmo/content/teachingNumbers'
import { EBUS_NUMBERS } from '@/features/ebus-guided/content/teachingNumbers'
import { HEMODYNAMICS_NUMBERS } from '@/features/icu-hemodynamics/content/teachingNumbers'
import { MCS_NUMBERS } from '@/features/mechanical-circulatory-support/content/teachingNumbers'
import { VENTILATION_NUMBERS } from '@/features/mechanical-ventilation/content/teachingNumbers'
import { PI_NUMBERS } from '@/features/peripheral-imaging/content/teachingNumbers'
import { betaModules, type BetaModule } from './catalog'
import { betaRollout, hubBetaModules, type BetaTesterNote } from './rollout'

const notes = betaModules.flatMap((entry) => {
  const { note } = betaRollout[entry.id]
  return note ? [{ id: entry.id, note }] : []
})

function noteText(note: BetaTesterNote) {
  return [
    note.audience,
    note.summary,
    note.estimate?.basis ?? '',
    ...note.lookFor,
    ...note.knownLimits,
  ].join('\n')
}

describe('hub readiness record', () => {
  it('has exactly one entry for every hub module', () => {
    expect(Object.keys(betaRollout).sort()).toEqual(betaModules.map((entry) => entry.id).sort())
  })

  it('keeps every module at its released stage', () => {
    // Moving a module to `ready` is the owner's call (beta-finish-line.md section 8). Change this
    // table in the same one-line PR that does it.
    expect(
      Object.fromEntries(betaModules.map((entry) => [entry.id, betaRollout[entry.id].stage])),
    ).toEqual({
      'ebus-guided': 'preview',
      'eus-b-guided': 'preview',
      'eus-b-simulator': 'preview',
      'synchronized-anatomy': 'preview',
      'branch-tracing': 'preview',
      'live-anatomy': 'withheld',
      'peripheral-imaging': 'preview',
      'bronchoscopy-foundations': 'preview',
      'dolphin-bronchoscopy': 'withheld',
      devices: 'withheld',
      'literature-atlas': 'withheld',
      'cardiohelp-ecmo': 'preview',
      'baxter-crrt': 'preview',
      'icu-hemodynamics': 'preview',
      'mechanical-ventilation': 'preview',
      'mechanical-circulatory-support': 'preview',
    })
  })

  it('leaves withheld modules off the hub and keeps the rest in catalog order', () => {
    // Owner decision 2026-11-04: these four open from Admin › Modules in development only.
    expect(hubBetaModules.map((entry) => entry.id)).toEqual(
      betaModules
        .map((entry) => entry.id)
        .filter(
          (id) =>
            !['live-anatomy', 'dolphin-bronchoscopy', 'devices', 'literature-atlas'].includes(id),
        ),
    )
  })

  it('gives every module on the hub a tester note', () => {
    for (const entry of hubBetaModules) expect(betaRollout[entry.id].note).toBeDefined()
  })

  it('gives every module marked ready a tester note', () => {
    for (const entry of betaModules) {
      const stage = betaRollout[entry.id]
      if (stage.stage === 'ready') expect(stage.note).toBeDefined()
    }
  })

  it('makes every tester note complete, whatever the stage', () => {
    for (const { note } of notes) {
      expect(note.audience.trim()).not.toBe('')
      expect(note.summary.trim()).not.toBe('')
      expect(note.lookFor.length).toBeGreaterThan(0)
      // A module with nothing known to be unchecked says so in words rather than leaving this empty.
      expect(note.knownLimits.length).toBeGreaterThan(0)
      if (note.estimate) {
        expect(note.estimate.minutes).toBeGreaterThan(0)
        expect(note.estimate.basis.trim()).not.toBe('')
      }
    }
  })

  it('keeps builder words and pull-request numbers out of tester notes', () => {
    const builderWords =
      /\b(stub|fixture|mock|jest|playwright|commit|merged?|repo|TODO|PR|draft)\b|#\d/i
    for (const { id, note } of notes) {
      expect({ id, found: builderWords.exec(noteText(note))?.[0] }).toEqual({
        id,
        found: undefined,
      })
    }
  })

  it('states the teaching-number counts that the registers hold', () => {
    // The hub cards quote these counts; read them from the registers so they cannot drift.
    type Rows = readonly { readonly signedBy: string | null }[]
    const limitMatching = (id: BetaModule['id'], pattern: RegExp) => {
      const limits = betaRollout[id].note?.knownLimits ?? []
      const matches = limits.flatMap((line) => {
        const match = pattern.exec(line)
        return match ? [match] : []
      })
      expect({ id, lines: matches.length }).toEqual({ id, lines: 1 })
      return { id, counts: matches[0].slice(1).map(Number) }
    }

    // Registers with no signed row: "Its N sourced teaching numbers are not yet signed off".
    const unsigned: readonly [BetaModule['id'], Rows][] = [
      ['ebus-guided', EBUS_NUMBERS.rows],
      ['peripheral-imaging', PI_NUMBERS.rows],
      ['cardiohelp-ecmo', ECMO_NUMBERS.rows],
      ['icu-hemodynamics', HEMODYNAMICS_NUMBERS.rows],
      ['mechanical-ventilation', VENTILATION_NUMBERS.rows],
    ]
    for (const [id, rows] of unsigned) {
      expect({ id, signed: rows.filter((row) => row.signedBy).length }).toEqual({ id, signed: 0 })
      expect(
        limitMatching(id, /^Its (\d+) sourced teaching numbers are not yet signed off/),
      ).toEqual({ id, counts: [rows.length] })
    }

    // Registers with some rows signed: "Of its N …, S are signed off by the author and U are not yet."
    const partlySigned: readonly [BetaModule['id'], Rows][] = [
      ['baxter-crrt', CRRT_NUMBERS.rows],
      ['mechanical-circulatory-support', MCS_NUMBERS.rows],
    ]
    for (const [id, rows] of partlySigned) {
      const signed = rows.filter((row) => row.signedBy).length
      expect(
        limitMatching(
          id,
          /^Of its (\d+) sourced teaching numbers, (\d+) are signed off by the author and (\d+) are not yet\.$/,
        ),
      ).toEqual({ id, counts: [rows.length, signed, rows.length - signed] })
    }

    // Bronchoscopy Foundations keeps its own register shape.
    const bronchRows: Rows = Object.values(BRONCH_NUMBER_REGISTER)
    expect(
      limitMatching(
        'bronchoscopy-foundations',
        /^(\d+) of its (\d+) teaching numbers, .* are not yet signed off by the author\.$/,
      ),
    ).toEqual({
      id: 'bronchoscopy-foundations',
      counts: [bronchRows.filter((row) => !row.signedBy).length, bronchRows.length],
    })
  })
})
