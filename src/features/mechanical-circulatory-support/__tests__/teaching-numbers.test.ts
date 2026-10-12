import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { teachingNumberErrors } from '../../learning-module/numbers/teachingNumbers'
import { MCS_EXPLAIN_REFLECTIONS } from '../content/explainReflections'
import { mcsLessonTransfers } from '../content/lessonTransfers'
import { allMcsScenarios } from '../content/scenarios'
import { mcsSectionLearningContracts } from '../content/sectionLearningContracts'
import { mcsSources } from '../content/sources'
import { MCS_NUMBERS, MCS_NUMBER_ONLY_SOURCES } from '../content/teachingNumbers'
import { IMPELLA_MEAN_FLOW_BY_P_LEVEL_LMIN, LVAD_HIGH_AFTERLOAD_MAP_MMHG } from '../engine/model'
import type { McsAction } from '../engine/types'
import { mcsReplay } from '../test-support/replayHarness'

/**
 * The module's numbers register, and the two things it has to agree with: the source registry it
 * cites and the engine that draws the same numbers.
 *
 * This replaces the tests that required hedge wording. A number may be taught when it carries a
 * class, a source that resolves, a locator and a check date; and where the simulator uses the same
 * number, the register and the engine may not drift apart.
 */

const FEATURE_ROOT = join(process.cwd(), 'src/features/mechanical-circulatory-support')
const registerIds = new Set<string>(MCS_NUMBERS.rows.map((row) => row.id))

function sourceFiles(directory: string): string[] {
  return readdirSync(join(FEATURE_ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(relative)
    return /\.tsx?$/.test(entry.name) ? [relative] : []
  })
}

/** "P-2 1.1–2.1 · P-4 2.0–2.5 … L/min" → [[2, 1.1, 2.1], [4, 2.0, 2.5], …]. */
function printedRanges(value: string): readonly (readonly [number, number, number])[] {
  return [...value.matchAll(/P-(\d) (\d+(?:\.\d+)?)–(\d+(?:\.\d+)?)/g)].map(
    (match) => [Number(match[1]), Number(match[2]), Number(match[3])] as const,
  )
}

describe('the MCS numbers register', () => {
  it('traces every row to a registered source, a locator and a check date', () => {
    const ids = new Set<string>([
      ...mcsSources.map((source) => source.id),
      ...MCS_NUMBER_ONLY_SOURCES.map((source) => source.id),
    ])
    expect(teachingNumberErrors(MCS_NUMBERS, ids)).toEqual([])
    expect(MCS_NUMBERS.rows.length).toBeGreaterThan(0)
  })

  it('keeps the number-only sources out of the main registry, so neither list shadows the other', () => {
    const registered = new Set(mcsSources.map((source) => source.id))
    for (const source of MCS_NUMBER_ONLY_SOURCES) {
      expect({ id: source.id, alsoRegistered: registered.has(source.id) }).toEqual({
        id: source.id,
        alsoRegistered: false,
      })
      expect(source.title.trim().length).toBeGreaterThan(0)
    }
  })

  it('resolves every ReferenceValues id and every MCS_NUMBERS lookup used in the module', () => {
    const used: { file: string; id: string }[] = []
    for (const file of [...sourceFiles('components'), ...sourceFiles('content')]) {
      const source = readFileSync(join(FEATURE_ROOT, file), 'utf8')
      for (const block of source.matchAll(/<ReferenceValues\b[^>]*?\bids=\{\[([^\]]*)\]\}/g)) {
        for (const id of block[1].matchAll(/'([^']+)'/g)) used.push({ file, id: id[1] })
      }
      for (const call of source.matchAll(/MCS_NUMBERS\.(?:value|get)\(\s*'([^']+)'/g)) {
        used.push({ file, id: call[1] })
      }
    }
    // Not vacuous: the panels do use the register.
    expect(
      used.filter((entry) => entry.file.includes('components/teaching/')).length,
    ).toBeGreaterThan(5)
    expect(used.filter((entry) => !registerIds.has(entry.id))).toEqual([])
  })
})

describe('the register and the engine teach the same numbers', () => {
  it.each([
    ['impella-cp-flow-by-level', 'cp'],
    ['impella-55-flow-by-level', '55'],
  ] as const)('prints %s exactly as the engine’s P-level table has it', (id, variant) => {
    const printed = printedRanges(MCS_NUMBERS.value(id))
    expect(printed.length).toBeGreaterThanOrEqual(4)
    for (const [level, low, high] of printed) {
      expect([level, low, high]).toEqual([
        level,
        ...IMPELLA_MEAN_FLOW_BY_P_LEVEL_LMIN[variant][level],
      ])
    }
  })

  it('never prints a peak flow as a mean: the CP peak figure is above the P-9 mean ceiling', () => {
    const peak = Number(MCS_NUMBERS.value('impella-cp-peak-flow').match(/(\d+\.\d+) L\/min/)![1])
    expect(peak).toBeGreaterThan(IMPELLA_MEAN_FLOW_BY_P_LEVEL_LMIN.cp[9][1])
  })

  it.each(['cp', '55'] as const)(
    'keeps the %s reference patient’s flow inside the printed range at every P-level',
    (variant) => {
      const table = IMPELLA_MEAN_FLOW_BY_P_LEVEL_LMIN[variant]
      let previous = -1
      for (let level = 0; level < table.length; level += 1) {
        const setup: McsAction[] = [
          { type: 'SET_IMPELLA_CONFIGURATION', control: 'leftVariant', value: variant },
          { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: level },
        ]
        const probe = mcsReplay({ id: `${variant}-p${level}`, device: 'impella', setup }, [
          { id: 'arm' },
        ]).arms.arm
        const flow = probe.metrics.leftDeviceFlowLMin
        const [floor, ceiling] = table[level]
        expect({ level, flow, inRange: flow >= floor && flow <= ceiling }).toEqual({
          level,
          flow,
          inRange: true,
        })
        // Flow never falls as the P-level rises.
        expect(flow).toBeGreaterThanOrEqual(previous)
        previous = flow
      }
    },
  )

  it('never exceeds a level’s printed ceiling, however favorable the loading', () => {
    for (const variant of ['cp', '55'] as const) {
      for (const level of [2, 6, 9]) {
        const setup: McsAction[] = [
          { type: 'SET_IMPELLA_CONFIGURATION', control: 'leftVariant', value: variant },
          { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: level },
          { type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 145 },
          {
            type: 'SET_PATIENT_CONTROL',
            control: 'systemicVascularResistanceDynSecCm5',
            value: 600,
          },
          { type: 'SET_PATIENT_CONTROL', control: 'rightVentricularContractility', value: 1.2 },
        ]
        const probe = mcsReplay(
          { id: `${variant}-favorable-p${level}`, device: 'impella', setup },
          [{ id: 'arm' }],
        ).arms.arm
        expect(probe.metrics.leftDeviceFlowLMin).toBeLessThanOrEqual(
          IMPELLA_MEAN_FLOW_BY_P_LEVEL_LMIN[variant][level][1],
        )
      }
    }
  })

  it('uses the lvad-map-ceiling number as the afterload alarm threshold', () => {
    const printed = MCS_NUMBERS.value('lvad-map-ceiling').match(/(\d+) mm Hg/)
    expect(printed).not.toBeNull()
    expect(Number(printed![1])).toBe(LVAD_HIGH_AFTERLOAD_MAP_MMHG)
  })

  it('starts the durable reference patient inside the lvad-map-goal range', () => {
    const [, low, high] = MCS_NUMBERS.value('lvad-map-goal').match(/(\d+)–(\d+) mm Hg/)!
    const reference = mcsReplay({ id: 'durable-reference', device: 'lvad' }, [{ id: 'arm' }]).arms
      .arm
    expect(reference.metrics.mapMmHg).toBeGreaterThanOrEqual(Number(low))
    expect(reference.metrics.mapMmHg).toBeLessThanOrEqual(Number(high))
  })
})

/**
 * Review status, packet identifiers and authoring notes are project metadata. They are tracked in
 * packets and never rendered to learners.
 */
const PROJECT_METADATA =
  /\bOD-0\d\b|MCS-03-\d+|NOT REVIEWED|\bauthored\b|draft teaching|pending (clinical|faculty) review/i

/** Keys that hold identifiers and bookkeeping, never a sentence a learner reads. */
const NON_LEARNER_KEYS = new Set([
  'id',
  'activityId',
  'sectionId',
  'lessonId',
  'clinicalContextId',
  'transferVariantId',
  'evidenceIds',
  'sourceIds',
  'visualAssetIds',
  'reviewStatus',
  'contentVersion',
  // A success criterion's classification enum (rendered only as a data attribute) and the packet
  // item a held condition is tracked under. Neither is printed; mcs-pre-review-01 asserts that the
  // worked explanation does not contain the item id.
  'kind',
  'openItemId',
])

function learnerStrings(value: unknown, path: string): { path: string; text: string }[] {
  if (typeof value === 'string') return [{ path, text: value }]
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => learnerStrings(entry, `${path}[${index}]`))
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, entry]) =>
      NON_LEARNER_KEYS.has(key) ? [] : learnerStrings(entry, `${path}.${key}`),
    )
  }
  return []
}

describe('no project metadata reaches learner copy', () => {
  const offenders = (strings: readonly { path: string; text: string }[]) =>
    strings.filter((entry) => PROJECT_METADATA.test(entry.text))

  it('covers all nine sections, their reflections and transfers, and every case', () => {
    expect(mcsSectionLearningContracts).toHaveLength(9)
    expect(MCS_EXPLAIN_REFLECTIONS.length).toBeGreaterThan(0)
    expect(mcsLessonTransfers.length).toBeGreaterThan(0)
    expect(allMcsScenarios).toHaveLength(12)
  })

  it('keeps packet ids, review status and authoring words out of the nine section contracts', () => {
    expect(
      offenders(
        mcsSectionLearningContracts.flatMap((contract) =>
          learnerStrings(contract, contract.sectionId),
        ),
      ),
    ).toEqual([])
  })

  it('keeps them out of the explain reflections', () => {
    expect(
      offenders(
        MCS_EXPLAIN_REFLECTIONS.flatMap((reflection) =>
          learnerStrings(reflection, `reflection:${reflection.sectionId}`),
        ),
      ),
    ).toEqual([])
  })

  it('keeps them out of the lesson transfers', () => {
    expect(
      offenders(
        mcsLessonTransfers.flatMap((transfer) =>
          learnerStrings(transfer, `transfer:${transfer.lessonId}`),
        ),
      ),
    ).toEqual([])
  })

  it('keeps them out of every case: stems, objectives, option labels, criteria and debrief', () => {
    expect(
      offenders(allMcsScenarios.flatMap((scenario) => learnerStrings(scenario, scenario.id))),
    ).toEqual([])
  })
})
