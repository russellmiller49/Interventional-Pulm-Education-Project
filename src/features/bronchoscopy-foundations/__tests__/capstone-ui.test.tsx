import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { BronchCapstone } from '../components/BronchCapstone'
import { CAPSTONE_CASES } from '../content/capstone'
import { BRONCH_SECTION_IDS } from '../content/pathway'
import { capstoneStageItem } from '../engine/caseStandard'
import { BRONCH_STORAGE_KEY, createEmptyBronchRecord } from '../engine/learnProgress'

jest.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))
beforeEach(() => localStorage.clear())
const begin = () => {
  localStorage.setItem(
    BRONCH_STORAGE_KEY,
    JSON.stringify({ ...createEmptyBronchRecord(), completedSectionIds: BRONCH_SECTION_IDS }),
  )
  return render(<BronchCapstone />)
}
const commit = (id: string, choice: string) => {
  fireEvent.click(document.querySelector(`[data-capstone-case="${id}"] input[value="${choice}"]`)!)
  fireEvent.click(screen.getByRole('button', { name: 'Submit this decision' }))
}
test('capstone withholds rationales, pairing and future cases until the appropriate boundary', () => {
  begin()
  expect(document.querySelectorAll('[data-prediction-choices]')).toHaveLength(1)
  expect(document.querySelector('[data-case-pairing]')).toBeNull()
  const first = CAPSTONE_CASES[0],
    item = capstoneStageItem(first.id).item
  commit(first.id, item.correctChoiceIds[0])
  expect(document.querySelector('[data-answer-verdict]')).toHaveAttribute('data-revealed', 'false')
  expect(document.body.textContent).not.toContain(item.explanation)
  expect(document.querySelector('[data-case-pairing]')).toBeNull()
  for (const entry of CAPSTONE_CASES.slice(1))
    commit(entry.id, capstoneStageItem(entry.id).item.correctChoiceIds[0])
  expect(document.querySelector('[data-capstone-debrief]')).toHaveAttribute('data-standard', 'met')
  expect(document.querySelectorAll('[data-case-pairing]')).toHaveLength(8)
  expect(document.body.textContent).toContain(item.explanation)
})
test('unsafe feedback is immediate and one critical miss prevents meeting the standard', () => {
  begin()
  const first = CAPSTONE_CASES[0],
    item = capstoneStageItem(first.id).item
  const unsafe = item.choices.find((choice) => choice.plausibility === 'unsafe')!
  expect(unsafe).toBeDefined()
  commit(first.id, unsafe.id)
  expect(screen.getByRole('alert')).toHaveAttribute('data-revealed', 'true')
  for (const entry of CAPSTONE_CASES.slice(1))
    commit(entry.id, capstoneStageItem(entry.id).item.correctChoiceIds[0])
  expect(document.querySelector('[data-capstone-debrief]')).toHaveAttribute(
    'data-standard',
    'not-yet-met',
  )
  expect(document.querySelector('[data-capstone-standard]')?.textContent).toContain(
    'Seven of eight',
  )
})
