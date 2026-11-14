import { wordCount } from '../content/authoringRules'
import { brushAndBiopsy } from '../content/sections/brush-and-biopsy'
import { enteringTheBlowhole } from '../content/sections/entering-the-blowhole'
import { lavage } from '../content/sections/lavage'
import { recoveryAndReturn } from '../content/sections/recovery-and-return'
import { theSurveyAndTheRecord } from '../content/sections/the-survey-and-the-record'
import { validateDolphinSection } from '../content/stageLessons'
import { toDolphinClinicalItem } from '../content/stageItems'
import { troubleRowById } from '../content/troubleGrammar'

const SECTIONS = [
  enteringTheBlowhole,
  theSurveyAndTheRecord,
  lavage,
  brushAndBiopsy,
  recoveryAndReturn,
]

it.each(SECTIONS)('$id validates', (section) => {
  expect(validateDolphinSection(section)).toEqual([])
  toDolphinClinicalItem(section.id, section.prediction, 'predict')
  toDolphinClinicalItem(section.id, section.transfer, 'transfer')
  for (const c of section.practice) toDolphinClinicalItem(section.id, c.item, 'predict')
})

it.each(SECTIONS)(
  '$id practice cases stay within sixty words and name real trouble rows',
  (section) => {
    for (const c of section.practice) {
      expect(wordCount(`${c.situation} ${c.item.stem}`)).toBeLessThanOrEqual(60)
      if (c.troubleRowId) expect(troubleRowById.has(c.troubleRowId)).toBe(true)
    }
    for (const card of section.firstMoves ?? [])
      expect(troubleRowById.has(card.troubleRowId)).toBe(true)
  },
)

it('keeps item ids unique across the procedure sections', () => {
  const ids = SECTIONS.flatMap((s) => [
    s.prediction.id,
    s.transfer.id,
    ...s.practice.map((c) => c.item.id),
  ])
  expect(new Set(ids).size).toBe(ids.length)
})
