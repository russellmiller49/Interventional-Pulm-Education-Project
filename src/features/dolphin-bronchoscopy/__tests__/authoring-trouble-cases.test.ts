import { DOLPHIN_SOURCE_IDS } from '../data/sources'
import { lengthErrors, wordCount, sentencesOf, type CopyKind } from '../content/authoringRules'
import { DOLPHIN_DECISIONS } from '../content/decisions'
import { dolphinFrameById } from '../content/frameBank'
import { DOLPHIN_INTEGRATED_CASES, dolphinIntegratedCaseById } from '../content/integratedCases'
import { dolphinLearnerCopyErrors } from '../content/learnerCopy'
import { dolphinObjectiveById } from '../content/objectives'
import { dolphinSectionIds } from '../content/sectionIds'
import { beyondTheSurvey } from '../content/sections/beyond-the-survey'
import { troubleDuringTheProcedure } from '../content/sections/trouble-during-the-procedure'
import { whatThisModuleCanSay } from '../content/sections/what-this-module-can-say'
import { toDolphinClinicalItem } from '../content/stageItems'
import { validateDolphinSection } from '../content/stageLessons'
import { DOLPHIN_NUMBER_IDS, DOLPHIN_NUMBERS } from '../content/teachingNumbers'
import { troubleRowById } from '../content/troubleGrammar'
import type { DolphinIntegratedCase } from '../content/types'

const SECTIONS = [troubleDuringTheProcedure, beyondTheSurvey, whatThisModuleCanSay]

describe('trouble, beyond the survey and the closing section', () => {
  it.each(SECTIONS)('$id validates', (section) => {
    expect(validateDolphinSection(section)).toEqual([])
    toDolphinClinicalItem(section.id, section.prediction, 'predict')
    toDolphinClinicalItem(section.id, section.transfer, 'transfer')
    for (const c of section.practice) toDolphinClinicalItem(section.id, c.item, 'predict')
  })

  it('uses item ids no other of these sections uses', () => {
    const ids = SECTIONS.flatMap((s) => [
      s.prediction.id,
      s.transfer.id,
      ...s.practice.map((c) => c.item.id),
    ])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('teaches the first moves for the four rows the trouble section owns, each with who to call', () => {
    const cards = troubleDuringTheProcedure.firstMoves ?? []
    const rows = cards.map((card) => card.troubleRowId)
    for (const required of ['spout-cough', 'breath-hold', 'bleeding', 'lost-orientation']) {
      expect(rows).toContain(required)
    }
    for (const card of cards) {
      expect(troubleRowById.has(card.troubleRowId)).toBe(true)
      expect(card.steps.length).toBeGreaterThanOrEqual(2)
      expect(card.callForHelp).toMatch(/attending veterinarian|NMMP protocol/)
      for (const id of card.sourceIds) expect(DOLPHIN_SOURCE_IDS.has(id)).toBe(true)
    }
  })

  it('turns every scenario frame and practice case on a known trouble row', () => {
    const { act, practice } = troubleDuringTheProcedure
    expect(act.kind).toBe('scenario')
    if (act.kind !== 'scenario') return
    expect(act.scenario.frames.length).toBeGreaterThanOrEqual(3)
    expect(act.scenario.frames.length).toBeLessThanOrEqual(5)
    for (const frame of act.scenario.frames) {
      expect(troubleRowById.has(frame.troubleRowId ?? '')).toBe(true)
      expect(frame.choices).toHaveLength(4)
      expect(frame.choices.filter((c) => c.plausibility === 'best')).toHaveLength(1)
      for (const choice of frame.choices.filter((c) => c.plausibility === 'unsafe')) {
        expect(
          troubleDuringTheProcedure.harmfulReflexPatterns!.some((p) => p.test(choice.label)),
        ).toBe(true)
      }
    }
    for (const microCase of practice)
      expect(troubleRowById.has(microCase.troubleRowId ?? '')).toBe(true)
  })

  it('retrieves the trouble transfer from sedation and the spout', () => {
    expect(troubleDuringTheProcedure.transfer.retrievesFrom).toEqual([
      'sedation-and-numbing',
      'entering-the-blowhole',
    ])
  })
})

// ── The integrated cases ────────────────────────────────────────────────────────────────────────

const LABEL_TOKEN =
  /\b(?:[RL]B\d{1,2}|RT[1-3]|T\d{1,2}|LB|RB|[0-9]D)\b|\b(?:LNP|RNP|NPX|NPF|LS|LX|TRA|RTB|RMB|LMB)\b/g

function numericTokens(text: string): readonly string[] {
  return (text.replace(LABEL_TOKEN, ' ').match(/\d+(?:\.\d+)?/g) ?? []).map((token) =>
    token.replace(/^0+(?=\d)/, ''),
  )
}

/** A case may state its own values in its situations; anything else comes from a register row it names. */
function allowedCaseTokens(integrated: DolphinIntegratedCase): ReadonlySet<string> {
  const allowed = new Set<string>()
  for (const text of [integrated.situation, ...integrated.frames.map((f) => f.situation)]) {
    for (const token of numericTokens(text)) allowed.add(token)
  }
  for (const id of integrated.numberIds ?? []) {
    const row = DOLPHIN_NUMBERS.rows.find((candidate) => candidate.id === id)
    for (const text of [row?.value ?? '', row?.note ?? '', row?.appliesTo ?? '']) {
      for (const token of numericTokens(text)) allowed.add(token)
    }
  }
  return allowed
}

function caseSurfaces(
  integrated: DolphinIntegratedCase,
): { where: string; kind: CopyKind; text: string }[] {
  return [
    { where: `${integrated.id} situation`, kind: 'case', text: integrated.situation },
    ...integrated.frames.flatMap((frame) => [
      {
        where: `${integrated.id} ${frame.id} situation`,
        kind: 'case' as const,
        text: frame.situation,
      },
      { where: `${integrated.id} ${frame.id} prompt`, kind: 'stem' as const, text: frame.prompt },
      ...frame.choices.flatMap((choice) => [
        {
          where: `${integrated.id} ${frame.id} ${choice.id}`,
          kind: 'option' as const,
          text: choice.label,
        },
        {
          where: `${integrated.id} ${frame.id} ${choice.id} rationale`,
          kind: 'rationale' as const,
          text: choice.rationale,
        },
      ]),
    ]),
    { where: `${integrated.id} debrief`, kind: 'explanation', text: integrated.debrief },
  ]
}

const EXPECTED_CASES: Readonly<Record<string, readonly string[]>> = {
  'second-pneumonia-this-year': [
    'why-scope-a-dolphin',
    'choosing-the-instrument',
    'before-the-day',
    'the-room-and-the-team',
    'sedation-and-numbing',
  ],
  'the-opening-above-the-carina': ['below-the-larynx', 'the-survey-and-the-record', 'lavage'],
  'nothing-but-pink-walls': [
    'from-blowhole-to-spout',
    'entering-the-blowhole',
    'trouble-during-the-procedure',
  ],
  'a-cough-at-the-spout': [
    'sedation-and-numbing',
    'entering-the-blowhole',
    'trouble-during-the-procedure',
  ],
  'far-less-came-back': ['lavage', 'trouble-during-the-procedure'],
  'blood-after-the-brush': [
    'brush-and-biopsy',
    'trouble-during-the-procedure',
    'recovery-and-return',
  ],
  'a-long-breath-hold-halfway': [
    'trouble-during-the-procedure',
    'recovery-and-return',
    'the-room-and-the-team',
  ],
  'the-ledger-for-a-large-animal': ['sedation-and-numbing'],
}

describe('the integrated cases', () => {
  it('are the eight planned cases, each on the sections it draws from', () => {
    expect(DOLPHIN_INTEGRATED_CASES.map((c) => c.id)).toEqual(Object.keys(EXPECTED_CASES))
    expect(dolphinIntegratedCaseById.size).toBe(8)
    for (const integrated of DOLPHIN_INTEGRATED_CASES) {
      expect(integrated.sectionIds).toEqual(EXPECTED_CASES[integrated.id])
      for (const id of integrated.sectionIds) expect(dolphinSectionIds).toContain(id)
    }
  })

  it.each(DOLPHIN_INTEGRATED_CASES.map((c) => [c.id, c] as const))(
    '%s holds to the authoring rules',
    (_, integrated) => {
      expect(integrated.frames.length).toBeGreaterThanOrEqual(3)
      expect(integrated.frames.length).toBeLessThanOrEqual(5)
      expect(new Set(integrated.frames.map((f) => f.id)).size).toBe(integrated.frames.length)
      expect(DOLPHIN_DECISIONS.some((d) => d.id === integrated.decisionId)).toBe(true)
      for (const id of integrated.objectiveIds) expect(dolphinObjectiveById.has(id)).toBe(true)
      for (const id of integrated.sourceIds) expect(DOLPHIN_SOURCE_IDS.has(id)).toBe(true)
      for (const id of integrated.numberIds ?? []) expect(DOLPHIN_NUMBER_IDS.has(id)).toBe(true)

      expect(
        dolphinLearnerCopyErrors(`${integrated.id} title`, integrated.title, {
          allowDigits: false,
        }),
      ).toEqual([])
      for (const frame of integrated.frames) {
        expect(frame.choices).toHaveLength(4)
        expect(frame.choices.filter((c) => c.plausibility === 'best')).toHaveLength(1)
        expect(wordCount(`${frame.situation} ${frame.prompt}`)).toBeLessThanOrEqual(60)
        expect(
          dolphinLearnerCopyErrors(`${integrated.id} ${frame.id} time`, frame.time, {
            allowDigits: false,
          }),
        ).toEqual([])
        if (frame.troubleRowId) expect(troubleRowById.has(frame.troubleRowId)).toBe(true)
        if (frame.media) expect(dolphinFrameById.has(frame.media.frameId)).toBe(true)
      }

      const debriefSentences = sentencesOf(integrated.debrief).length
      expect(debriefSentences).toBeGreaterThanOrEqual(2)
      expect(debriefSentences).toBeLessThanOrEqual(4)

      const allowed = allowedCaseTokens(integrated)
      const errors: string[] = []
      for (const surface of caseSurfaces(integrated)) {
        errors.push(...dolphinLearnerCopyErrors(surface.where, surface.text))
        errors.push(...lengthErrors({ ...surface, numberIds: [] }))
        if (/\b(correct|incorrect|wrong)\b/i.test(surface.text))
          errors.push(`${surface.where} names a verdict.`)
        if (surface.kind !== 'case') {
          const stray = numericTokens(surface.text).filter((token) => !allowed.has(token))
          if (stray.length > 0)
            errors.push(`${surface.where} states ${stray.join(', ')} with no row or case value.`)
        }
      }
      expect(errors).toEqual([])
    },
  )
})
