import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)

import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import { McsImpellaEchoPosition } from '../components/stage/McsImpellaEchoPosition'
import {
  MCS_ECHO_DEPTH_NUMBER_IDS,
  MCS_ECHO_POSITION,
  MCS_ECHO_REPOSITION_NUMBER_ID,
  MCS_ECHO_WORKED_EXAMPLE,
  MCS_ECHO_WORKED_INLET_DEPTH_CM,
} from '../content/impellaEchoPosition'
import { MCS_NUMBERS, type McsNumberId } from '../content/teachingNumbers'
import { mountSection, setupMcsStage, teardownMcsStage } from '../test-support/mcsStage'

/**
 * Section 5's echo teaching: where the two ends of an Impella sit on a long-axis view, the depth
 * each pump is read against, and one malposition worked to its first move.
 *
 * Every depth and every P-level in the copy has to be a figure the numbers register holds, and the
 * register rows it rests on have to point at the manufacturer's pages they were read from.
 */

const { item } = MCS_ECHO_WORKED_EXAMPLE
const ECHO_ROW_IDS: readonly McsNumberId[] = [
  ...MCS_ECHO_DEPTH_NUMBER_IDS,
  MCS_ECHO_REPOSITION_NUMBER_ID,
]
const IFU_SOURCE_IDS = new Set(['impella-cp-ifu-rev-v-supplied', 'impella-55-ifu-rev-l-supplied'])

/** Every sentence the block can put in front of a learner, before and after a move is chosen. */
const learnerCopy: readonly string[] = [
  MCS_ECHO_POSITION.title,
  MCS_ECHO_POSITION.views,
  ...MCS_ECHO_POSITION.aligned,
  MCS_ECHO_POSITION.depthTitle,
  MCS_ECHO_POSITION.devices,
  ...MCS_ECHO_POSITION.malpositions.flatMap((malposition) => [
    malposition.term,
    malposition.finding,
  ]),
  MCS_ECHO_WORKED_EXAMPLE.title,
  item.stem,
  ...item.choices.flatMap((choice) => [choice.label, choice.rationale]),
  item.explanation,
]

const centimetres = (text: string) =>
  [...text.matchAll(/(\d+(?:\.\d+)?) cm\b/g)].map((match) => Number(match[1]))
const performanceLevels = (text: string) =>
  [...text.matchAll(/\bP-(\d)\b/g)].map((match) => Number(match[1]))

beforeEach(() => setupMcsStage())
afterEach(() => {
  cleanup()
  teardownMcsStage()
})

describe('the Impella position on echo, in Section 5', () => {
  it('opens on the section’s first guided task, beside the pump cutaway, through the real stage', () => {
    mountSection('impella-unloading-placement')
    const task = document.querySelector('[data-intro-teaching="inlet-outlet"]')!
    expect(task).not.toBeNull()
    expect(task.querySelector('[data-pump-cutaway]')).not.toBeNull()
    const block = task.querySelector<HTMLElement>('[data-echo-position]')!
    expect(block).not.toBeNull()
    expect(block).toHaveTextContent(/parasternal long axis/i)
    for (const id of MCS_ECHO_DEPTH_NUMBER_IDS) {
      expect(block).toHaveTextContent(MCS_NUMBERS.value(id))
    }
    expect(within(block).getByRole('group', { name: item.stem })).toBeInTheDocument()
  })

  it('names the long-axis views, the aligned picture and both malpositions', () => {
    render(<McsImpellaEchoPosition />)
    const block = document.querySelector<HTMLElement>('[data-echo-position]')!
    expect(block.querySelector('[data-echo-views]')).toHaveTextContent(
      /parasternal long axis on transthoracic echo, or a long-axis view on TEE/,
    )
    expect(block.querySelector('[data-echo-aligned]')).toHaveTextContent(/angled toward the apex/)
    expect(block.querySelector('[data-echo-aligned]')).toHaveTextContent(
      /mosaic .* above the valve/,
    )
    expect(
      [...block.querySelectorAll('[data-echo-malposition]')].map((row) =>
        row.getAttribute('data-echo-malposition'),
      ),
    ).toEqual(['too-deep', 'inlet-in-aorta'])
    // The difference between the two pumps is said, not left to the two numbers.
    expect(block.querySelector('[data-echo-devices]')).toHaveTextContent(
      /On the CP, measure from the annulus to the inlet\. On the 5\.5, find the cannula bend/,
    )
  })

  it('prints each depth from its register row, with the manual it came from', () => {
    render(<McsImpellaEchoPosition />)
    for (const id of MCS_ECHO_DEPTH_NUMBER_IDS) {
      const row = document.querySelector(`[data-teaching-number="${id}"]`)
      expect(row).toHaveTextContent(MCS_NUMBERS.value(id))
      expect(row).toHaveTextContent(/Impella (CP|5\.5) instructions for use 2026/)
    }
  })
})

describe('every number the echo teaching uses is a register row', () => {
  it('rests each row on the two 2026 instructions for use, page-located and dated', () => {
    for (const id of ECHO_ROW_IDS) {
      const row = MCS_NUMBERS.get(id)
      expect({ id, class: row.class, checkedOn: row.checkedOn }).toEqual({
        id,
        class: 'device',
        checkedOn: '2026-11-03',
      })
      expect(row.sources.length).toBeGreaterThan(0)
      for (const source of row.sources) {
        expect(IFU_SOURCE_IDS.has(source.sourceId)).toBe(true)
        expect(source.year).toBe(2026)
        expect(source.locator).toMatch(/\bp\. 7\.\d+/)
      }
    }
  })

  it('uses no centimetre figure the register does not hold', () => {
    const registered = new Set(ECHO_ROW_IDS.flatMap((id) => centimetres(MCS_NUMBERS.value(id))))
    const taught = learnerCopy.flatMap(centimetres)
    expect(taught.length).toBeGreaterThan(5)
    expect(taught.filter((value) => !registered.has(value))).toEqual([])
  })

  it('uses no P-level outside the repositioning row and the CP flow table', () => {
    const registered = new Set([
      ...performanceLevels(MCS_NUMBERS.value(MCS_ECHO_REPOSITION_NUMBER_ID)),
      ...performanceLevels(MCS_NUMBERS.value('impella-cp-flow-by-level')),
    ])
    const used = learnerCopy.flatMap(performanceLevels)
    expect(used).toContain(2)
    expect(used.filter((level) => !registered.has(level))).toEqual([])
  })

  it('sets the worked CP too deep by the register, at the depth the 5.5 is aligned', () => {
    const [tooDeep] = centimetres(MCS_NUMBERS.value('impella-cp-inlet-too-deep'))
    const [aligned55] = centimetres(MCS_NUMBERS.value('impella-55-inlet-depth'))
    expect(MCS_ECHO_WORKED_INLET_DEPTH_CM).toBeGreaterThan(tooDeep)
    expect(MCS_ECHO_WORKED_INLET_DEPTH_CM).toBe(aligned55)
    expect(item.stem).toContain(`${MCS_ECHO_WORKED_INLET_DEPTH_CM} cm below the aortic valve`)
  })
})

describe('the worked malposition', () => {
  it('is keyed on the first move, with no answer words in the stem, options or rationales', () => {
    expect(item.stem).toMatch(/What is your first move\?$/)
    const authored = [
      item.stem,
      item.explanation,
      ...item.choices.flatMap((choice) => [choice.label, choice.rationale]),
    ]
    for (const text of authored) {
      expect({ text, flagged: flaggedLearnerCopyTerms(text) }).toEqual({ text, flagged: [] })
      expect(text).not.toMatch(/\b(correct|incorrect|wrong)\b/i)
    }
    const [best] = item.choices.filter((choice) => choice.plausibility === 'best')
    expect(item.correctChoiceIds).toEqual([best.id])
    expect(best.label).toMatch(/^Bring the level down to P-2/)
    expect(best.label).toContain('3.5 cm below the annulus')
  })

  it('compares a chosen move, shows the P-2 row with its source, records nothing and resets', () => {
    const stored = window.localStorage.length
    render(<McsImpellaEchoPosition />)
    const compare = screen.getByRole('button', { name: 'Compare your move' })
    expect(compare).toBeDisabled()
    expect(document.querySelector('[data-echo-verdict]')).toBeNull()

    const best = item.choices.find((choice) => choice.plausibility === 'best')!
    fireEvent.click(screen.getByRole('radio', { name: best.label }))
    fireEvent.click(compare)

    const verdict = document.querySelector<HTMLElement>('[data-echo-verdict]')!
    expect(verdict).toHaveTextContent(best.rationale)
    expect(verdict).toHaveTextContent(item.explanation)
    expect(
      verdict.querySelector(`[data-teaching-number="${MCS_ECHO_REPOSITION_NUMBER_ID}"]`),
    ).toHaveTextContent('P-2')
    expect(screen.getAllByRole('radio').every((input) => input.closest('fieldset')!.disabled)).toBe(
      true,
    )
    expect(window.localStorage.length).toBe(stored)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(document.querySelector('[data-echo-verdict]')).toBeNull()
    expect(document.querySelectorAll('input:checked')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Compare your move' })).toBeDisabled()
  })
})

describe('learner copy', () => {
  it('carries no review status, packet ids or builder words', () => {
    const metadata =
      /\bOD-0\d\b|MCS-0\d-|NOT REVIEWED|\bauthored\b|\bsynthetic\b|\bdraft\b|pending (clinical|faculty) review|\bsimulator\b|\bmodule\b/i
    expect(learnerCopy.filter((text) => metadata.test(text))).toEqual([])
    render(<McsImpellaEchoPosition />)
    expect(document.querySelector('[data-echo-position]')!.textContent).not.toMatch(metadata)
  })
})
