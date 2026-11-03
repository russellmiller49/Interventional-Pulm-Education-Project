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
import { mcsStageSources } from '../content/stageSources'
import { MCS_NUMBERS, type McsNumberId } from '../content/teachingNumbers'
import { mountSection, setupMcsStage, teardownMcsStage } from '../test-support/mcsStage'

/**
 * Section 8's closing case: a HeartMate 3 patient with no pulse who is perfused, and one in arrest,
 * each keyed on the first move.
 *
 * Every figure in the copy has to be a register row or a reading the case declares, each reading
 * has to sit on the side of its threshold the case says it does, and the rows have to point at the
 * guideline paragraph and recommendation they were read from.
 */

const [perfused, arrest] = MCS_LVAD_PERFUSION_DECISIONS
const CASE_ROW_IDS: readonly McsNumberId[] = [
  ...MCS_LVAD_ADEQUATE_CIRCULATION_NUMBER_IDS,
  MCS_LVAD_CPR_DEFERRAL_NUMBER_ID,
]
const GUIDELINE_ID = 'bsg-lvad-emergencies-2024'

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
  MCS_LVAD_PERFUSION.deferralTitle,
  MCS_LVAD_PERFUSION.sequenceTitle,
  ...MCS_LVAD_PERFUSION.sequence,
  ...CASE_ROW_IDS.flatMap((id) => [MCS_NUMBERS.get(id).label, MCS_NUMBERS.value(id)]),
  ...itemCopy,
]

/** Every figure in a run of copy. "HeartMate 3" is the device's name, not a number taught. */
const figures = (text: string) =>
  [...text.replace(/HeartMate 3/g, '').matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]))
const firstFigure = (id: McsNumberId) => figures(MCS_NUMBERS.value(id))[0]

beforeEach(() => setupMcsStage())
afterEach(() => {
  cleanup()
  teardownMcsStage()
})

describe('the LVAD perfusion case, in Section 8', () => {
  it('opens on the section’s last task, after the recap and before the paired case', () => {
    mountSection(MCS_LVAD_PERFUSION_SECTION_ID, 'transfer')
    const block = document.querySelector<HTMLElement>('[data-lvad-perfusion-case]')!
    expect(block).not.toBeNull()
    const recap = document.querySelector('[data-section-recap]')!
    const pairing = document.querySelector('[data-stage-completion]')!
    expect(recap.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(block.compareDocumentPosition(pairing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
    expect(document.querySelector('[data-section-recap]')).not.toBeNull()
    expect(document.querySelector('[data-lvad-perfusion-case]')).toBeNull()
  })

  it('names the signs of an adequate circulation, pulse not among them, each number with its source', () => {
    render(<McsLvadPerfusionCase />)
    const signs = [...document.querySelectorAll('[data-lvad-sign]')].map((row) =>
      row.getAttribute('data-lvad-sign'),
    )
    expect(signs).toEqual(['mentation', 'skin', 'pressure', 'etco2', 'controller', 'hum'])
    expect(document.querySelector('[data-lvad-perfusion-intro]')).toHaveTextContent(
      /never on the pulse alone/,
    )
    expect(document.querySelector('[data-lvad-sign="pressure"]')).toHaveTextContent(/Doppler/)
    expect(document.querySelector('[data-lvad-sign="hum"]')).toHaveTextContent(/auscultation/)
    for (const id of MCS_LVAD_ADEQUATE_CIRCULATION_NUMBER_IDS) {
      const row = document.querySelector(`[data-teaching-number="${id}"]`)
      expect(row).toHaveTextContent(MCS_NUMBERS.value(id))
      expect(row).toHaveTextContent('British societies LVAD emergency guideline 2024')
    }
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

  it('opens the CPR deferral row and the inadequate-circulation sequence only after the arrest move', () => {
    render(<McsLvadPerfusionCase />)
    const article = document.querySelector<HTMLElement>('[data-lvad-decision="arrest"]')!
    expect(
      document.querySelector(`[data-teaching-number="${MCS_LVAD_CPR_DEFERRAL_NUMBER_ID}"]`),
    ).toBeNull()
    expect(document.querySelector('[data-lvad-inadequate-sequence]')).toBeNull()

    const best = arrest.item.choices.find((choice) => choice.plausibility === 'best')!
    fireEvent.click(within(article).getByRole('radio', { name: best.label }))
    fireEvent.click(within(article).getByRole('button', { name: 'Compare your move' }))

    expect(
      article.querySelector(`[data-teaching-number="${MCS_LVAD_CPR_DEFERRAL_NUMBER_ID}"]`),
    ).toHaveTextContent(MCS_NUMBERS.value(MCS_LVAD_CPR_DEFERRAL_NUMBER_ID))
    const sequence = article.querySelector<HTMLElement>('[data-lvad-inadequate-sequence]')!
    expect(sequence).toHaveTextContent(/arrest team and the VAD team/)
    expect(sequence).toHaveTextContent(/blank HeartMate 3 screen can be normal/)
    expect(sequence).toHaveTextContent(/charged one, or put the controller on mains power/)
    expect(sequence).toHaveTextContent(/modular connector/)
    expect(sequence).toHaveTextContent(/keep the device work going beside them/)
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

  it('keeps the perfused patient off compressions and starts them for the patient in arrest', () => {
    const perfusedBest = perfused.item.choices.find((choice) => choice.plausibility === 'best')!
    expect(perfusedBest.label).toMatch(/no arrest call and no compressions/)
    const compressNow = perfused.item.choices.find(
      (choice) => choice.id === 'call-arrest-compress',
    )!
    expect(compressNow.plausibility).toBe('unsafe')

    const arrestBest = arrest.item.choices.find((choice) => choice.plausibility === 'best')!
    expect(arrestBest.label).toMatch(/^Start chest compressions now/)
    expect(arrestBest.label).toMatch(/modular connector/)
    const hold = arrest.item.choices.find((choice) => choice.id === 'hold-for-the-graft')!
    expect(hold.plausibility).toBe('unsafe')
  })

  it('cites the guideline on both items, and puts it in Section 8’s sources', () => {
    for (const { item } of MCS_LVAD_PERFUSION_DECISIONS) {
      expect(item.evidenceIds).toEqual([GUIDELINE_ID])
    }
    expect(mcsStageSources(MCS_LVAD_PERFUSION_SECTION_ID).sourceIds).toContain(GUIDELINE_ID)
    expect(mcsStageSources('lvad-parameters-assessment').sourceIds).not.toContain(GUIDELINE_ID)
  })
})

describe('every number the case uses is a register row', () => {
  it('rests each row on the 2024 guideline, with its class, level, locator and check date', () => {
    for (const id of CASE_ROW_IDS) {
      const row = MCS_NUMBERS.get(id)
      expect({ id, class: row.class, checkedOn: row.checkedOn }).toEqual({
        id,
        class: 'guideline',
        checkedOn: '2026-11-03',
      })
      expect(row.sources).toHaveLength(1)
      const [source] = row.sources
      expect(source.sourceId).toBe(GUIDELINE_ID)
      expect(source.year).toBe(2024)
      expect(source.grade).toMatch(/^Class I(Ia)?, Level C$/)
      expect(source.locator).toMatch(
        /^“(Determination of adequacy of circulation|Initial response)”/,
      )
    }
    expect(MCS_NUMBERS.get(MCS_LVAD_CPR_DEFERRAL_NUMBER_ID).sources[0].grade).toBe(
      'Class IIa, Level C',
    )
  })

  it('uses no figure that is not a register row or a reading the case declares', () => {
    const registered = CASE_ROW_IDS.flatMap((id) => figures(MCS_NUMBERS.value(id)))
    const readings = Object.values(MCS_LVAD_CASE_READINGS).flatMap((patient) =>
      Object.values(patient),
    )
    const allowed = new Set<number>([...registered, ...readings])
    const used = learnerCopy.flatMap(figures)
    expect(used.length).toBeGreaterThan(10)
    expect(used.filter((figure) => !allowed.has(figure))).toEqual([])
  })

  it('puts each reading on the side of its threshold the case says it is on', () => {
    const { perfused: a, arrest: b } = MCS_LVAD_CASE_READINGS
    expect(a.dopplerMapMmHg).toBeGreaterThan(firstFigure('lvad-adequate-map'))
    expect(a.capillaryRefillSeconds).toBeLessThan(firstFigure('lvad-adequate-capillary-refill'))
    expect(a.controllerFlowLMin).toBeGreaterThan(firstFigure('lvad-adequate-controller-flow'))
    expect(b.capillaryRefillSeconds).toBeGreaterThan(firstFigure('lvad-adequate-capillary-refill'))
    // The arrest stem is set at the end of the deferral the guideline allows, not before it.
    expect(b.minutesOnTheDevice).toBe(firstFigure(MCS_LVAD_CPR_DEFERRAL_NUMBER_ID))
    expect(perfused.item.stem).toContain(`Doppler MAP is ${a.dopplerMapMmHg} mm Hg`)
    expect(arrest.item.stem).toContain(`For ${b.minutesOnTheDevice} minutes`)
  })

  it('prints end-tidal CO₂ in both units, the conversion holding', () => {
    const [kPa, mmHg] = figures(MCS_NUMBERS.value('lvad-adequate-etco2'))
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
