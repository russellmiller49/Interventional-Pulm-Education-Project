import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { teachingNumberErrors } from '../../learning-module/numbers/teachingNumbers'
import { hemodynamicCases } from '../content/cases'
import { pawpCaptureSteps, pawpRecoveryCommitment } from '../content/pawpCaptureSequence'
import { hemodynamicsSources } from '../content/sources'
import {
  HEMODYNAMICS_NUMBERS,
  HEMODYNAMICS_NUMBER_ONLY_SOURCES,
  HEMODYNAMICS_SHOCK_PROFILES,
  HEMODYNAMICS_SHOCK_PROFILE_SOURCE,
} from '../content/teachingNumbers'

/**
 * The module's numbers register, and the copy that reads from it.
 *
 * This replaces the tests that required hedge wording. A number may be taught when it carries a
 * class, a source that resolves, a locator and a check date; and the copy that teaches it reads the
 * value from the register rather than typing it.
 */

const FEATURE_ROOT = join(process.cwd(), 'src/features/icu-hemodynamics')
const registerIds = new Set<string>(HEMODYNAMICS_NUMBERS.rows.map((row) => row.id))
const sourceIds = new Set<string>([
  ...hemodynamicsSources.map((source) => source.id),
  ...HEMODYNAMICS_NUMBER_ONLY_SOURCES.map((source) => source.id),
])

function sourceFiles(directory: string): string[] {
  return readdirSync(join(FEATURE_ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(relative)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [relative] : []
  })
}

describe('the ICU Hemodynamics numbers register', () => {
  it('traces every row to a registered source, a locator and a check date', () => {
    expect(teachingNumberErrors(HEMODYNAMICS_NUMBERS, sourceIds)).toEqual([])
    expect(HEMODYNAMICS_NUMBERS.rows.length).toBeGreaterThan(0)
  })

  it('gives every row a class, at least one source and an ISO check date', () => {
    for (const row of HEMODYNAMICS_NUMBERS.rows) {
      expect({
        id: row.id,
        hasClass: typeof row.class === 'string' && row.class.length > 0,
        sourced: row.sources.length > 0,
        checkedOn: /^\d{4}-\d{2}-\d{2}$/.test(row.checkedOn),
        realDate: !Number.isNaN(Date.parse(row.checkedOn)),
      }).toEqual({ id: row.id, hasClass: true, sourced: true, checkedOn: true, realDate: true })
    }
  })

  it('keeps the number-only sources out of the main registry, so neither list shadows the other', () => {
    const registered = new Set(hemodynamicsSources.map((source) => source.id))
    for (const source of HEMODYNAMICS_NUMBER_ONLY_SOURCES) {
      expect({ id: source.id, alsoRegistered: registered.has(source.id) }).toEqual({
        id: source.id,
        alsoRegistered: false,
      })
      expect(source.title.trim().length).toBeGreaterThan(0)
    }
  })

  it('resolves every reference-values id and every register lookup used in the module', () => {
    const used: { file: string; id: string }[] = []
    for (const file of [...sourceFiles('components'), ...sourceFiles('content')]) {
      const source = readFileSync(join(FEATURE_ROOT, file), 'utf8')
      for (const block of source.matchAll(
        /<HemodynamicsReferenceValues\b[^>]*?\bids=\{\[([^\]]*)\]\}/g,
      )) {
        for (const id of block[1].matchAll(/'([^']+)'/g)) used.push({ file, id: id[1] })
      }
      for (const call of source.matchAll(/HEMODYNAMICS_NUMBERS\.(?:value|get)\(\s*'([^']+)'/g)) {
        used.push({ file, id: call[1] })
      }
    }
    // Not vacuous: the content does read from the register.
    expect(used.filter((entry) => entry.file.startsWith('content/')).length).toBeGreaterThan(10)
    expect(used.filter((entry) => !registerIds.has(entry.id))).toEqual([])
  })
})

describe('the shock profiles', () => {
  it('gives each of the four profiles all four columns and a first move', () => {
    expect(HEMODYNAMICS_SHOCK_PROFILES.map((profile) => profile.id)).toEqual([
      'hypovolemic',
      'cardiogenic',
      'obstructive',
      'distributive',
    ])
    for (const profile of HEMODYNAMICS_SHOCK_PROFILES) {
      expect({
        id: profile.id,
        label: profile.label.trim().length > 0,
        cardiacOutput: profile.cardiacOutput.trim().length > 0,
        fillingPressures: profile.fillingPressures.trim().length > 0,
        systemicVascularResistance: profile.systemicVascularResistance.trim().length > 0,
        mixedVenousSaturation: profile.mixedVenousSaturation.trim().length > 0,
        firstMove: profile.firstMove.trim().length > 0,
      }).toEqual({
        id: profile.id,
        label: true,
        cardiacOutput: true,
        fillingPressures: true,
        systemicVascularResistance: true,
        mixedVenousSaturation: true,
        firstMove: true,
      })
    }
  })

  it('cites a source that resolves, with a year and a locator', () => {
    expect(sourceIds.has(HEMODYNAMICS_SHOCK_PROFILE_SOURCE.sourceId)).toBe(true)
    expect(Number.isInteger(HEMODYNAMICS_SHOCK_PROFILE_SOURCE.year)).toBe(true)
    expect(HEMODYNAMICS_SHOCK_PROFILE_SOURCE.locator.trim().length).toBeGreaterThan(0)
  })
})

describe('taught numbers render from the register', () => {
  it('puts the balloon volume in the PAWP sequence’s inflation step', () => {
    const volume = HEMODYNAMICS_NUMBERS.value('balloon-volume')
    expect(volume).toMatch(/\d(\.\d+)?\s*mL/)
    const commit = pawpCaptureSteps.find((step) => step.id === 'commit')
    expect(commit?.whatYouDo).toContain(`Inflate slowly with ${volume}`)
  })

  it('puts the retract distance in the recovery item: its keyed choice and its explanation', () => {
    const distance = HEMODYNAMICS_NUMBERS.value('retract-distance')
    expect(distance).toMatch(/\d\s*cm/)
    const keyed = pawpRecoveryCommitment.choices.find((choice) =>
      pawpRecoveryCommitment.correctChoiceIds.includes(choice.id),
    )
    expect(keyed?.label).toContain(distance)
    expect(pawpRecoveryCommitment.explanation).toContain(distance)
  })

  it('puts the norepinephrine range in the case action label', () => {
    const range = HEMODYNAMICS_NUMBERS.value('norepinephrine-dose')
    expect(range).toMatch(/\d.*μg\/kg\/min/)
    const labels = hemodynamicCases.flatMap((definition) =>
      definition.interventions
        .filter((intervention) => intervention.id === 'norepinephrine-up')
        .map((intervention) => intervention.label),
    )
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) expect(label).toContain(range)
  })
})

describe('copy removed as unsourced stays removed', () => {
  it('has no “two or three breaths” in any learner copy file', () => {
    const files = [
      ...sourceFiles('content'),
      ...sourceFiles('components'),
      ...sourceFiles('engine'),
    ]
    expect(files.length).toBeGreaterThan(50)
    const offenders = files.filter((file) =>
      /two or three breaths/i.test(readFileSync(join(FEATURE_ROOT, file), 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})
