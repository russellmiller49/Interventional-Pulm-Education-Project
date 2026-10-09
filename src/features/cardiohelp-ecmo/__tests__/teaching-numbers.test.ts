import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { teachingNumberErrors } from '../../learning-module/numbers/teachingNumbers'
import { EcmoAnticoagulationReference } from '../components/teaching/EcmoReferenceValues'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { ecmoDerivedValueGuideList, ecmoDerivedValueGuides } from '../content/ecmoValueGuides'
import { cardiohelpEvidence } from '../content/evidence'
import { cardiohelpLearnLessonByScenarioId } from '../content/learnLessons'
import {
  ECMO_AIR_FIRST_MOVES,
  ECMO_AIR_RESUME,
  ECMO_AIR_RESUME_SENTENCE,
  ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES,
  ECMO_LV_DISTENSION_MOVES,
  ECMO_NUMBERS,
  ECMO_NUMBER_ONLY_SOURCES,
} from '../content/teachingNumbers'

/**
 * The module's numbers register, and the copy that reads from it.
 *
 * This replaces the tests that required hedge wording ("Your unit will have local reference values.
 * Ask for them.", "per current IFU and local protocol"). A number may be taught when it carries a
 * class, a source that resolves, a locator and a check date; and the copy that teaches it reads the
 * value from the register rather than typing it. See docs/teaching-first-rules.md.
 */

const FEATURE_ROOT = join(process.cwd(), 'src/features/cardiohelp-ecmo')
const registerIds = new Set<string>(ECMO_NUMBERS.rows.map((row) => row.id))
const sourceIds = new Set<string>([
  ...cardiohelpEvidence.map((source) => source.id),
  ...ECMO_NUMBER_ONLY_SOURCES.map((source) => source.id),
])

function sourceFiles(directory: string): string[] {
  return readdirSync(join(FEATURE_ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(relative)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [relative] : []
  })
}

const PRODUCTION_FILES = [
  ...sourceFiles('components'),
  ...sourceFiles('content'),
  ...sourceFiles('engine'),
]

describe('the Cardiohelp ECMO numbers register', () => {
  it('traces every row to a registered source, a locator and a check date', () => {
    expect(teachingNumberErrors(ECMO_NUMBERS, sourceIds)).toEqual([])
    expect(ECMO_NUMBERS.rows.length).toBeGreaterThan(0)
  })

  it('gives every row a class, at least one source and an ISO check date', () => {
    for (const row of ECMO_NUMBERS.rows) {
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
    const registered = new Set(cardiohelpEvidence.map((source) => source.id))
    expect(ECMO_NUMBER_ONLY_SOURCES.length).toBeGreaterThan(0)
    expect(new Set(ECMO_NUMBER_ONLY_SOURCES.map((source) => source.id)).size).toBe(
      ECMO_NUMBER_ONLY_SOURCES.length,
    )
    for (const source of ECMO_NUMBER_ONLY_SOURCES) {
      expect({ id: source.id, alsoRegistered: registered.has(source.id) }).toEqual({
        id: source.id,
        alsoRegistered: false,
      })
      expect(source.title.trim().length).toBeGreaterThan(0)
    }
  })

  it('cites every number-only source from at least one row or move list', () => {
    const cited = new Set<string>([
      ...ECMO_NUMBERS.rows.flatMap((row) => row.sources.map((source) => source.sourceId)),
      ECMO_AIR_FIRST_MOVES.source.sourceId,
      ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES.source.sourceId,
      ECMO_LV_DISTENSION_MOVES.source.sourceId,
    ])
    for (const source of ECMO_NUMBER_ONLY_SOURCES) {
      expect({ id: source.id, cited: cited.has(source.id) }).toEqual({ id: source.id, cited: true })
    }
  })

  it('resolves every reference-values id and every register lookup used in the module', () => {
    const used: { file: string; id: string }[] = []
    for (const file of PRODUCTION_FILES) {
      const source = readFileSync(join(FEATURE_ROOT, file), 'utf8')
      for (const block of source.matchAll(/<EcmoReferenceValues\b[^>]*?\bids=\{\[([^\]]*)\]\}/g)) {
        for (const id of block[1].matchAll(/'([^']+)'/g)) used.push({ file, id: id[1] })
      }
      for (const call of source.matchAll(/ECMO_NUMBERS\.(?:value|get)\(\s*'([^']+)'/g)) {
        used.push({ file, id: call[1] })
      }
    }
    // Not vacuous: the content does read from the register, and the reference boxes list ids.
    expect(used.filter((entry) => entry.file.startsWith('content/')).length).toBeGreaterThan(10)
    expect(
      used.filter((entry) => entry.file === 'components/teaching/EcmoReferenceValues.tsx').length,
    ).toBeGreaterThan(10)
    expect(used.filter((entry) => !registerIds.has(entry.id))).toEqual([])
  })

  it('leaves no row unused: each is rendered in a reference box or read into copy', () => {
    const everything = PRODUCTION_FILES.filter((file) => file !== 'content/teachingNumbers.ts')
      .map((file) => readFileSync(join(FEATURE_ROOT, file), 'utf8'))
      .join('\n')
    const register = readFileSync(join(FEATURE_ROOT, 'content/teachingNumbers.ts'), 'utf8')
    const unused = ECMO_NUMBERS.rows
      .map((row) => row.id)
      .filter(
        (id) =>
          !everything.includes(`'${id}'`) &&
          // Read inside the register file itself, by one of the move lists or sentences.
          !new RegExp(`ECMO_NUMBERS\\.value\\('${id}'\\)`).test(register),
      )
    expect(unused).toEqual([])
  })
})

describe('the first-move lists', () => {
  it('gives the air emergency a non-empty ordered list for each mode, with a registered source', () => {
    expect(ECMO_AIR_FIRST_MOVES.massiveVa.length).toBeGreaterThan(0)
    expect(ECMO_AIR_FIRST_MOVES.massiveVv.length).toBeGreaterThan(0)
    for (const move of [...ECMO_AIR_FIRST_MOVES.massiveVa, ...ECMO_AIR_FIRST_MOVES.massiveVv]) {
      expect(move.trim().length).toBeGreaterThan(0)
    }
    expect(sourceIds.has(ECMO_AIR_FIRST_MOVES.source.sourceId)).toBe(true)
    expect(Number.isInteger(ECMO_AIR_FIRST_MOVES.source.year)).toBe(true)
    expect(ECMO_AIR_FIRST_MOVES.source.locator.trim().length).toBeGreaterThan(0)
  })

  it('gives the resumption its conditions in order, with registered sources', () => {
    expect(ECMO_AIR_RESUME.label.trim().length).toBeGreaterThan(0)
    expect(ECMO_AIR_RESUME.conditions.length).toBeGreaterThan(0)
    expect(ECMO_AIR_RESUME.sources.length).toBeGreaterThan(0)
    for (const source of ECMO_AIR_RESUME.sources) {
      expect({ id: source.sourceId, registered: sourceIds.has(source.sourceId) }).toEqual({
        id: source.sourceId,
        registered: true,
      })
      expect(source.locator.trim().length).toBeGreaterThan(0)
    }
  })

  it('gives differential hypoxemia a recognition line and a non-empty ordered list, with a registered source', () => {
    expect(ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES.recognize.trim().length).toBeGreaterThan(0)
    expect(ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES.moves.length).toBeGreaterThan(0)
    expect(sourceIds.has(ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES.source.sourceId)).toBe(true)
    expect(Number.isInteger(ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES.source.year)).toBe(true)
    expect(ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES.source.locator.trim().length).toBeGreaterThan(0)
  })

  it('gives left-ventricular distension its moves, with the venting threshold from the register', () => {
    expect(ECMO_LV_DISTENSION_MOVES.moves.length).toBeGreaterThan(0)
    expect(sourceIds.has(ECMO_LV_DISTENSION_MOVES.source.sourceId)).toBe(true)
    expect(ECMO_LV_DISTENSION_MOVES.moves.join(' ')).toContain(
      ECMO_NUMBERS.value('lv-vent-pulsatility'),
    )
  })
})

describe('taught numbers render from the register', () => {
  const statements = (guide: (typeof ecmoDerivedValueGuideList)[number]) =>
    guide.references.map((reference) => reference.statement).join(' ')

  it('puts the pVen factory limits in the pVen value guide, as a device specification', () => {
    const limits = ECMO_NUMBERS.value('pven-factory-limits')
    expect(limits).toMatch(/−\d+ mmHg.*−\d+ mmHg/)
    const reference = ecmoDerivedValueGuides.pVen.references.find((entry) =>
      entry.statement.includes(limits),
    )
    expect(reference).toBeDefined()
    expect(reference?.kind).toBe('device-specification')
    // The caution and the textbook range that differ from it are shown beside it, not hidden.
    expect(reference?.statement).toContain(ECMO_NUMBERS.value('negative-pressure-caution'))
    expect(reference?.statement).toContain(ECMO_NUMBERS.value('pump-inlet-pressure-typical'))
    expect(reference?.statement).toMatch(/the two sources differ/i)
  })

  it('puts the pInt and pArt factory limits and the pressure-drop limit in their guides', () => {
    const limits = ECMO_NUMBERS.value('pint-part-factory-limits')
    expect(statements(ecmoDerivedValueGuides.pInt)).toContain(limits)
    expect(statements(ecmoDerivedValueGuides.pArt)).toContain(limits)
    const deltaP = ecmoDerivedValueGuides.transmembraneDeltaP
    expect(deltaP.interpretation).toContain(ECMO_NUMBERS.value('pressure-drop-typical'))
    expect(statements(deltaP)).toContain(ECMO_NUMBERS.value('pressure-drop-factory-limit'))
  })

  it('puts the ACT target in the anticoagulation box', () => {
    const act = ECMO_NUMBERS.get('act-target')
    expect(act.value).toMatch(/\d+–\d+ seconds/)
    expect(act.class).toBe('consensus')
    const html = renderToStaticMarkup(createElement(EcmoAnticoagulationReference))
    expect(html).toContain('data-teaching-number="act-target"')
    expect(html).toContain(act.value)
    expect(html).toContain(ECMO_NUMBERS.value('heparin-bolus'))
    expect(html).toContain(ECMO_NUMBERS.value('anti-xa-target'))
    // The box prints `row.value`; the figure is not typed into the component.
    const box = readFileSync(
      join(FEATURE_ROOT, 'components/teaching/EcmoReferenceValues.tsx'),
      'utf8',
    )
    expect(box).not.toContain(act.value)
  })

  it.each([
    ['clinical-vv-circuit-air-embolism', 'air-resume-support'],
    ['va-clinical-circuit-air-embolism', 'va-air-resume-support'],
  ] as const)('puts the resume label on %s / %s', (caseId, interventionId) => {
    const resume = clinicalPracticeScenarioById
      .get(caseId)
      ?.clinicalCase?.interventions.find((intervention) => intervention.id === interventionId)
    expect(resume?.label).toBe(ECMO_AIR_RESUME.label)
    expect(resume?.label).toBe('Reset the bubble stop; open the return clamp last')
    expect(resume?.description).toBe(ECMO_AIR_RESUME_SENTENCE)
    expect(resume?.description).toContain(ECMO_NUMBERS.value('clamp-release-pressure'))
  })

  it.each(['arterial-bubble-stop', 'va-arterial-bubble-stop'] as const)(
    'puts the same label on the resume step of %s',
    (scenarioId) => {
      const step = cardiohelpLearnLessonByScenarioId
        .get(scenarioId)
        ?.steps.find((candidate) =>
          candidate.actions.some((action) => action.type === 'RESUME_SUPPORT_AFTER_BUBBLE'),
        )
      expect(step?.actionLabel).toBe(ECMO_AIR_RESUME.label)
    },
  )
})

describe('the hedges the numbers replaced stay removed', () => {
  it('has no “Ask for them” in any value guide', () => {
    expect(ecmoDerivedValueGuideList.length).toBeGreaterThan(0)
    for (const guide of ecmoDerivedValueGuideList) {
      const copy = [
        guide.interpretation,
        guide.caveats,
        guide.doNotInfer,
        ...guide.references.flatMap((reference) => [reference.statement, reference.appliesWhen]),
      ].join(' ')
      expect({ id: guide.id, hedge: /ask for them|local reference values/i.test(copy) }).toEqual({
        id: guide.id,
        hedge: false,
      })
    }
  })

  it('has no “Ask for them” in any production file of the module', () => {
    expect(PRODUCTION_FILES.length).toBeGreaterThan(50)
    const offenders = PRODUCTION_FILES.filter((file) =>
      /Ask for them/i.test(readFileSync(join(FEATURE_ROOT, file), 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})
