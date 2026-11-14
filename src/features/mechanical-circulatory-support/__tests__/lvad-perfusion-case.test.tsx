import { cleanup, fireEvent, render, within } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)

import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import { McsLvadPerfusionCase } from '../components/stage/McsLvadPerfusionCase'
import {
  MCS_LVAD_ADEQUATE_CIRCULATION_NUMBER_IDS,
  MCS_LVAD_CASE_READINGS,
  MCS_LVAD_CPR_DEFERRAL_NUMBER_ID,
  MCS_LVAD_PERFUSION,
  MCS_LVAD_PERFUSION_DECISIONS,
  MCS_LVAD_PERFUSION_SECTION_ID,
} from '../content/lvadPerfusionCase'
import { mcsSectionSpec } from '../content/sectionSpecs'
import { buildMcsStageLesson } from '../content/stageLessons'
import { mcsStageSources } from '../content/stageSources'
import { MCS_NUMBERS, type McsNumberId } from '../content/teachingNumbers'
import { mountSection, setupMcsStage, teardownMcsStage } from '../test-support/mcsStage'

/**
 * Section 8's closing case: a HeartMate 3 patient with no pulse who is perfused, and one in arrest,
 * each keyed on the first move.
 *
 * Four sources disagree on the adequacy thresholds and on how long CPR may wait for the pump, so
 * the rows hold every source's value with its own year, grade and locator. Every figure in the copy
 * has to be one of those values or a reading the case declares, and every reading has to sit on the
 * same side of each source's line.
 */

const BSG = 'bsg-lvad-emergencies-2024'
const ERC = 'erc-2025-special-circumstances'
const AHA_2025 = 'aha-2025-special-circumstances'
const AHA_2017 = 'aha-cpr-mcs-statement-2017'
const HFSA = 'hfsa-saem-ishlt-vad-emergency-2019'

const YEARS: Readonly<Record<string, number>> = {
  [BSG]: 2024,
  [ERC]: 2025,
  [AHA_2025]: 2025,
  [AHA_2017]: 2017,
}
/** Each source's grade as printed; ERC 2025 and AHA 2017 print none for these statements. */
const PRINTED_GRADES: Readonly<Record<string, RegExp | null>> = {
  [BSG]: /^Class I(Ia)?, Level C$/,
  [AHA_2025]: /^COR 2b, LOE C-EO$/,
  [ERC]: null,
  [AHA_2017]: null,
}
/** Which sources each row rests on: every source that gives the value, whichever value it gives. */
const ROW_SOURCES: Readonly<Record<string, readonly string[]>> = {
  'lvad-adequate-capillary-refill': [BSG, ERC],
  'lvad-adequate-map': [BSG, ERC, AHA_2017, AHA_2025],
  'lvad-adequate-etco2': [BSG, ERC, AHA_2017, AHA_2025],
  'lvad-adequate-controller-flow': [BSG, ERC],
  'lvad-cpr-deferral-limit': [BSG, ERC, AHA_2025],
}

const [perfused, arrest] = MCS_LVAD_PERFUSION_DECISIONS
const CASE_ROW_IDS: readonly McsNumberId[] = [
  ...MCS_LVAD_ADEQUATE_CIRCULATION_NUMBER_IDS,
  MCS_LVAD_CPR_DEFERRAL_NUMBER_ID,
]

const itemCopy = MCS_LVAD_PERFUSION_DECISIONS.flatMap(({ title, item }) => [
  title,
  item.stem,
  ...item.choices.flatMap((choice) => [choice.label, choice.rationale]),
  item.explanation,
])

/** Every sentence the block can put in front of a learner, before and after a move is chosen. */
const learnerCopy: readonly string[] = [
  MCS_LVAD_PERFUSION.title,
  MCS_LVAD_PERFUSION.intro,
  ...MCS_LVAD_PERFUSION.signs.flatMap((sign) => [sign.term, sign.finding]),
  MCS_LVAD_PERFUSION.numbersTitle,
  MCS_LVAD_PERFUSION.combining,
  MCS_LVAD_PERFUSION.deferralTitle,
  MCS_LVAD_PERFUSION.sequenceTitle,
  ...MCS_LVAD_PERFUSION.sequence,
  ...CASE_ROW_IDS.flatMap((id) => [MCS_NUMBERS.get(id).label, MCS_NUMBERS.value(id)]),
  ...itemCopy,
]

/**
 * Every figure in a run of copy. "HeartMate 3" is the device's name and "AHA 2025" names a source;
 * neither is a number taught.
 */
const figures = (text: string) =>
  [
    ...text
      .replace(/HeartMate 3/g, '')
      .replace(/\b(AHA|ERC) (2017|2025)\b/g, '')
      .matchAll(/\d+(?:\.\d+)?/g),
  ].map((match) => Number(match[0]))
const lines = (id: McsNumberId) => figures(MCS_NUMBERS.value(id))

beforeEach(() => setupMcsStage())
afterEach(() => {
  cleanup()
  teardownMcsStage()
})

describe('the LVAD perfusion case, in Section 8', () => {
  it('opens with the section’s closing question, the task before its patient case', () => {
    mountSection(MCS_LVAD_PERFUSION_SECTION_ID, 'transfer')
    const block = document.querySelector<HTMLElement>('[data-lvad-perfusion-case]')!
    expect(block).not.toBeNull()
    const lesson = buildMcsStageLesson(MCS_LVAD_PERFUSION_SECTION_ID)
    expect(lesson.steps.at(-2)?.interaction.kind).toBe('transfer')
    expect(lesson.steps.at(-1)?.interaction.kind).toBe('case')
    for (const { item } of MCS_LVAD_PERFUSION_DECISIONS) {
      expect(within(block).getByRole('group', { name: item.stem })).toBeInTheDocument()
    }
    for (const id of MCS_LVAD_ADEQUATE_CIRCULATION_NUMBER_IDS) {
      expect(block).toHaveTextContent(MCS_NUMBERS.value(id))
    }
  })

  it('is not on the section’s first task, nor at the end of another section', () => {
    mountSection(MCS_LVAD_PERFUSION_SECTION_ID)
    expect(document.querySelector('[data-lvad-perfusion-case]')).toBeNull()
    cleanup()
    mountSection('lvad-parameters-assessment', 'transfer')
    expect(document.querySelector('[data-now-card]')).not.toBeNull()
    expect(document.querySelector('[data-lvad-perfusion-case]')).toBeNull()
  })

  it('names the signs of an adequate circulation, pulse not among them', () => {
    render(<McsLvadPerfusionCase />)
    const signs = [...document.querySelectorAll('[data-lvad-sign]')].map((row) =>
      row.getAttribute('data-lvad-sign'),
    )
    expect(signs).toEqual(['mentation', 'skin', 'pressure', 'etco2', 'controller', 'hum'])
    expect(document.querySelector('[data-lvad-perfusion-intro]')).toHaveTextContent(
      /never from the pulse alone/,
    )
    expect(document.querySelector('[data-lvad-sign="pressure"]')).toHaveTextContent(
      /Doppler with a manual cuff.*Doppler opening pressure/,
    )
    expect(document.querySelector('[data-lvad-sign="etco2"]')).toHaveTextContent(
      /endotracheal tube or tracheostomy.*laryngeal mask airway/,
    )
    expect(document.querySelector('[data-lvad-sign="hum"]')).toHaveTextContent(
      /left chest and left upper abdomen/,
    )
  })

  it('prints both sets of thresholds, each source with its year and printed grade', () => {
    render(<McsLvadPerfusionCase />)
    const map = document.querySelector('[data-teaching-number="lvad-adequate-map"]')!
    expect(map).toHaveTextContent('above 60 mm Hg (British, ERC) · above 50 mm Hg (AHA)')
    expect(map).toHaveTextContent(
      'British societies LVAD emergency guideline 2024, Class I, Level C',
    )
    expect(map).toHaveTextContent('ERC guidelines 2025')
    expect(map).toHaveTextContent('AHA scientific statement 2017')
    expect(map).toHaveTextContent('AHA guidelines 2025, COR 2b, LOE C-EO')
    expect(
      document.querySelector('[data-teaching-number="lvad-adequate-etco2"]'),
    ).toHaveTextContent('above 2 kPa (15 mm Hg), intubated (British, ERC) · above 20 mm Hg (AHA)')
    // How the signs combine differs too, and is said beside the numbers.
    expect(document.querySelector('[data-lvad-perfusion-combining]')).toHaveTextContent(
      /AHA 2025 counts the circulation as adequate when any one is present.*British guideline reads several together/,
    )
  })
})

describe('each choice shows its reasoning', () => {
  it.each(
    MCS_LVAD_PERFUSION_DECISIONS.flatMap(({ kind, item }) =>
      item.choices.map((choice) => [kind, choice.id] as const),
    ),
  )('%s: %s', (kind, choiceId) => {
    const stored = window.localStorage.length
    render(<McsLvadPerfusionCase />)
    const { item } = MCS_LVAD_PERFUSION_DECISIONS.find((decision) => decision.kind === kind)!
    const choice = item.choices.find((candidate) => candidate.id === choiceId)!
    const article = document.querySelector<HTMLElement>(`[data-lvad-decision="${kind}"]`)!
    const compare = within(article).getByRole('button', { name: 'Compare your move' })
    expect(compare).toBeDisabled()

    fireEvent.click(within(article).getByRole('radio', { name: choice.label }))
    fireEvent.click(compare)

    const verdict = article.querySelector<HTMLElement>('[data-lvad-verdict]')!
    expect(verdict.querySelector('[data-plausibility]')).toHaveAttribute(
      'data-plausibility',
      choice.plausibility,
    )
    expect(verdict).toHaveTextContent(choice.rationale)
    expect(verdict).toHaveTextContent(item.explanation)
    // The other three answers are there to read, each with its own reasoning.
    for (const other of item.choices.filter((candidate) => candidate.id !== choice.id)) {
      expect(verdict.querySelector(`[data-other-answer="${other.id}"]`)).toHaveTextContent(
        other.rationale,
      )
    }
    expect(
      within(article)
        .getAllByRole('radio')
        .every((input) => input.closest('fieldset')!.disabled),
    ).toBe(true)
    expect(window.localStorage.length).toBe(stored)

    fireEvent.click(within(article).getByRole('button', { name: 'Try again' }))
    expect(article.querySelector('[data-lvad-verdict]')).toBeNull()
    expect(article.querySelectorAll('input:checked')).toHaveLength(0)
  })

  it('opens the timing row and the inadequate-circulation sequence only after the arrest move', () => {
    render(<McsLvadPerfusionCase />)
    const article = document.querySelector<HTMLElement>('[data-lvad-decision="arrest"]')!
    expect(
      document.querySelector(`[data-teaching-number="${MCS_LVAD_CPR_DEFERRAL_NUMBER_ID}"]`),
    ).toBeNull()
    expect(document.querySelector('[data-lvad-inadequate-sequence]')).toBeNull()

    const best = arrest.item.choices.find((choice) => choice.plausibility === 'best')!
    fireEvent.click(within(article).getByRole('radio', { name: best.label }))
    fireEvent.click(within(article).getByRole('button', { name: 'Compare your move' }))

    const timing = article.querySelector(
      `[data-teaching-number="${MCS_LVAD_CPR_DEFERRAL_NUMBER_ID}"]`,
    )!
    expect(timing).toHaveTextContent(MCS_NUMBERS.value(MCS_LVAD_CPR_DEFERRAL_NUMBER_ID))
    expect(timing).toHaveTextContent(
      'British societies LVAD emergency guideline 2024, Class IIa, Level C',
    )
    expect(timing).toHaveTextContent('AHA guidelines 2025, COR 2b, LOE C-EO')
    const sequence = article.querySelector<HTMLElement>('[data-lvad-inadequate-sequence]')!
    expect(sequence).toHaveTextContent(/arrest team and the VAD team/)
    expect(sequence).toHaveTextContent(
      /British guideline allows CPR to wait at most 2 minutes.*AHA 2025 starts compressions at once/,
    )
    expect(sequence).toHaveTextContent(/blank HeartMate 3 screen can be normal/)
    expect(sequence).toHaveTextContent(/two sources, two batteries or a battery and mains/)
    expect(sequence).toHaveTextContent(/under the binder and the dressing/)
    expect(sequence).toHaveTextContent(/modular connector/)
    // The perfused patient's verdict does not carry the arrest sequence.
    const other = document.querySelector<HTMLElement>('[data-lvad-decision="perfused"]')!
    expect(other.querySelector('[data-lvad-inadequate-sequence]')).toBeNull()
  })
})

describe('the two first moves', () => {
  it('keys each on the first move, with no answer words anywhere in the copy', () => {
    for (const { item } of MCS_LVAD_PERFUSION_DECISIONS) {
      expect(item.stem).toMatch(/What is your first move\?$/)
      const [best] = item.choices.filter((choice) => choice.plausibility === 'best')
      expect(item.correctChoiceIds).toEqual([best.id])
      expect(item.choices.map((choice) => choice.plausibility).sort()).toEqual(
        ['best', 'incorrect-mechanism', 'reasonable-but-incomplete', 'unsafe'].sort(),
      )
    }
    for (const text of learnerCopy) {
      expect({ text, flagged: flaggedLearnerCopyTerms(text) }).toEqual({ text, flagged: [] })
      expect(text).not.toMatch(/\b(correct|incorrect|wrong)\b/i)
    }
  })

  it('keeps the perfused patient off compressions', () => {
    const best = perfused.item.choices.find((choice) => choice.plausibility === 'best')!
    expect(best.label).toMatch(/no arrest call and no compressions/)
    const compressNow = perfused.item.choices.find(
      (choice) => choice.id === 'call-arrest-compress',
    )!
    expect(compressNow.plausibility).toBe('unsafe')
  })

  it('sets the arrest at discovery with two responders, so the keyed move holds under every source', () => {
    // No device work has been done yet: the stem does not spend the British deferral.
    expect(arrest.item.stem).toMatch(/^You and the bedside nurse find Patient B/)
    expect(arrest.item.stem).not.toMatch(/minutes/)
    const best = arrest.item.choices.find((choice) => choice.plausibility === 'best')!
    expect(best.label).toMatch(
      /^Start chest compressions now while the nurse works the device at the same time/,
    )
    expect(best.label).toMatch(/whole driveline, including its modular connector/)
    // The British sequence is defensible, not keyed, and its rationale names both timings.
    const deviceFirst = arrest.item.choices.find(
      (choice) => choice.id === 'device-first-two-minutes',
    )!
    expect(deviceFirst.plausibility).toBe('reasonable-but-incomplete')
    expect(deviceFirst.label).toMatch(/within 2 minutes/)
    expect(deviceFirst.rationale).toMatch(/British guideline.*ERC 2025.*AHA 2025/)
    const hold = arrest.item.choices.find((choice) => choice.id === 'hold-for-the-graft')!
    expect(hold.plausibility).toBe('unsafe')
  })

  it('cites the sources each item rests on, and lists all five in Section 8’s sources', () => {
    expect(perfused.item.evidenceIds).toEqual([BSG, AHA_2025, AHA_2017, HFSA])
    expect(arrest.item.evidenceIds).toEqual([AHA_2025, ERC, BSG, HFSA])
    const section8 = mcsStageSources(MCS_LVAD_PERFUSION_SECTION_ID).sourceIds
    for (const id of [BSG, ERC, AHA_2025, AHA_2017, HFSA]) expect(section8).toContain(id)
    const section7 = mcsStageSources('lvad-parameters-assessment').sourceIds
    for (const id of [BSG, ERC, AHA_2025, AHA_2017, HFSA]) expect(section7).not.toContain(id)
  })
})

describe('every number the case uses is a register row', () => {
  it('rests each row on every source that gives it, with year, printed grade, locator and check date', () => {
    for (const id of CASE_ROW_IDS) {
      const row = MCS_NUMBERS.get(id)
      expect({ id, class: row.class, checkedOn: row.checkedOn }).toEqual({
        id,
        class: 'guideline',
        checkedOn: '2026-11-03',
      })
      expect(row.sources.map((source) => source.sourceId)).toEqual(ROW_SOURCES[id])
      for (const source of row.sources) {
        expect({ id, source: source.sourceId, year: source.year }).toEqual({
          id,
          source: source.sourceId,
          year: YEARS[source.sourceId],
        })
        const printed = PRINTED_GRADES[source.sourceId]
        if (printed) expect(source.grade).toMatch(printed)
        else expect(source.grade).toBeNull()
        expect(source.locator).toMatch(/\bp(p)?\. [eS]?\d+|“(Determination|Initial)/)
      }
    }
    expect(MCS_NUMBERS.get(MCS_LVAD_CPR_DEFERRAL_NUMBER_ID).sources[0].grade).toBe(
      'Class IIa, Level C',
    )
  })

  it('shows both values where the sources differ', () => {
    expect(lines('lvad-adequate-map')).toEqual([60, 50])
    expect(lines('lvad-adequate-etco2')).toEqual([2, 15, 20])
    const timing = MCS_NUMBERS.value(MCS_LVAD_CPR_DEFERRAL_NUMBER_ID)
    expect(timing).toMatch(/^at most 2 minutes \(British; ERC, a lone rescuer\) · none/)
    expect(timing).toMatch(/\(AHA 2025; ERC, two or more rescuers\)$/)
  })

  it('uses no figure that is not a register row or a reading the case declares', () => {
    const registered = CASE_ROW_IDS.flatMap(lines)
    const readings = Object.values(MCS_LVAD_CASE_READINGS).flatMap((patient) =>
      Object.values(patient),
    )
    const allowed = new Set<number>([...registered, ...readings])
    const used = learnerCopy.flatMap(figures)
    expect(used.length).toBeGreaterThan(10)
    expect(used.filter((figure) => !allowed.has(figure))).toEqual([])
  })

  it('puts each reading on the same side of every source’s line', () => {
    const { perfused: a, arrest: b } = MCS_LVAD_CASE_READINGS
    for (const line of lines('lvad-adequate-map')) expect(a.dopplerMapMmHg).toBeGreaterThan(line)
    const [refill] = lines('lvad-adequate-capillary-refill')
    expect(a.capillaryRefillSeconds).toBeLessThan(refill)
    expect(b.capillaryRefillSeconds).toBeGreaterThan(refill)
    const [flow] = lines('lvad-adequate-controller-flow')
    expect(a.controllerFlowLMin).toBeGreaterThan(flow)
    expect(perfused.item.stem).toContain(`Doppler MAP is ${a.dopplerMapMmHg} mm Hg`)
    // Patient B gives no pressure and no end-tidal CO₂ to read: no Doppler signal, not intubated.
    expect(arrest.item.stem).toMatch(/no Doppler signal and no hum/)
    expect(arrest.item.stem).not.toMatch(/mm Hg|kPa|intubated/)
  })

  it('prints end-tidal CO₂ in both units, the conversion holding', () => {
    const [kPa, mmHg] = lines('lvad-adequate-etco2')
    expect(Math.round(kPa * 7.50062)).toBe(mmHg)
  })
})

describe('learner copy', () => {
  it('carries no review status, packet ids or builder words', () => {
    const metadata =
      /\bOD-0\d\b|MCS-0\d-|NOT REVIEWED|\bauthored\b|\bsynthetic\b|\bdraft\b|pending (clinical|faculty) review|\bsimulator\b|\bmodule\b/i
    expect(learnerCopy.filter((text) => metadata.test(text))).toEqual([])
    render(<McsLvadPerfusionCase />)
    expect(document.querySelector('[data-lvad-perfusion-case]')!.textContent).not.toMatch(metadata)
  })

  it('says nothing that answers Section 8’s own pump-thrombosis question', () => {
    const { precommitDenyPatterns } = mcsSectionSpec(MCS_LVAD_PERFUSION_SECTION_ID)
    for (const pattern of precommitDenyPatterns) {
      expect({
        pattern: String(pattern),
        hits: learnerCopy.filter((text) => pattern.test(text)),
      }).toEqual({
        pattern: String(pattern),
        hits: [],
      })
    }
  })
})
