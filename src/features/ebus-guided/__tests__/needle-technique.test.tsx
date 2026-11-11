import { CONTENT_LESSONS, MERGED_INTO, lessonById } from '../content/curriculum'
import { SOURCES } from '../content/sources'
import { activitiesForLesson } from '../content/stage'

/*
 * Needle technique within the node (2026-11-11), folded into the needle lesson by the owner's
 * decision. These tests pin what the unit may claim: trial findings as trial findings, the two
 * things the owner teaches from practice labelled as practice points, and no numbers of its own.
 */
const unit = CONTENT_LESSONS.find((entry) => entry.id === 'needle-technique')!
const text = unit.paragraphs.join(' ')

it('is part of the needle lesson, asked as a decision before its teaching', () => {
  expect(MERGED_INTO['needle-technique']).toBe('needle-safety')
  expect(lessonById('needle-technique')!.id).toBe('needle-safety')
  const steps = activitiesForLesson(lessonById('needle-safety')!).filter(
    (step) => step.lessonId === 'needle-technique',
  )
  expect(steps.map((step) => [step.id.split(':')[1], step.kind, step.interaction])).toEqual([
    ['next-pass', 'interpretation', 'questions'],
    ['technique-choices', 'briefing', 'read'],
    ['technique-match', 'application', 'matching'],
  ])
  // The decision comes before the paragraph that answers it.
  expect(steps[0].questions).toEqual(['question'])
  expect(steps[0].teaching).toEqual([])
})

it('states the stylet and suction findings as the trials reported them', () => {
  expect(text).toContain(
    'found no difference in specimen adequacy or diagnostic yield (Scholten 2017; Lin 2018)',
  )
  expect(text).toContain('passes with suction more often returned a tissue core')
  expect(text).toContain('Suction is a choice, not a requirement.')
  // Slow pull is offered with its evidence described as mixed, not as better.
  expect(text).toContain('so the evidence is mixed (Kassirian 2022; He 2020)')
  // Nothing claims that a technique raises diagnostic yield.
  expect(text).not.toMatch(/(improves?|increases?|raises?|higher) (the )?(diagnostic )?yield/i)
})

it('labels what is taught from practice as a practice point', () => {
  const bloody = unit.paragraphs.find((paragraph) => paragraph.startsWith('A bloody pass.'))!
  const fanning = unit.paragraphs.find((paragraph) => paragraph.startsWith('Fanning.'))!
  expect(bloody).toContain('Practice point:')
  expect(fanning).toContain('Practice point:')
  // Fanning's only EBUS study is named for what it is.
  expect(fanning).toContain('a bench study on a model (Mizumori 2023)')
  const keyed = unit.question.choices.find((choice) => choice.correct)!
  expect(keyed.text).toBe('Take the suction off')
  expect(keyed.rationale).toMatch(/^Practice point:/)
})

it('cites AABIP 2025 only for the fresh needle, which is all that guideline says on the needle', () => {
  const mentions = unit.paragraphs.filter((paragraph) => paragraph.includes('AABIP 2025'))
  expect(mentions).toHaveLength(1)
  expect(mentions[0]).toBe(
    'Between stations. Once a malignant node has been identified, a fresh needle may be used for the next station to reduce cross-contamination (AABIP 2025).',
  )
})

it('adds no number of its own, and every source it names is in the course list', () => {
  const ids = SOURCES.map((source) => source.id as string)
  for (const id of unit.sources) expect(ids).toContain(id)
  for (const id of ['scholten2017', 'lin2018', 'kassirian2022', 'he2020', 'mizumori2023'])
    expect(unit.sources).toContain(id)
  // Years inside citations are the only digits in the teaching text.
  expect(text.replace(/\b(19|20)\d\d\b/g, '')).not.toMatch(/\d/)
  expect(unit.matching!.pairs.map((pair) => pair.response)).toEqual([
    'Take the suction off',
    'Make the passes with suction',
    'Change the needle angle between movements',
    'Consider a fresh needle',
  ])
  for (const item of [unit.question, unit.observation, unit.transfer])
    expect(item.choices.filter((choice) => choice.correct)).toHaveLength(1)
})
