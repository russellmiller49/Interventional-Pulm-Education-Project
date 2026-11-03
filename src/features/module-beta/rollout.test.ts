/** @jest-environment node */
import { betaModules } from './catalog'
import { betaRollout, type BetaTesterNote } from './rollout'

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
      'eus-b-simulator': 'preview',
      'synchronized-anatomy': 'preview',
      'branch-tracing': 'preview',
      'live-anatomy': 'preview',
      'peripheral-imaging': 'preview',
      'bronchoscopy-foundations': 'preview',
      devices: 'preview',
      'literature-atlas': 'preview',
      'cardiohelp-ecmo': 'preview',
      'baxter-crrt': 'preview',
      'icu-hemodynamics': 'preview',
      'mechanical-ventilation': 'preview',
      'mechanical-circulatory-support': 'preview',
    })
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
})
