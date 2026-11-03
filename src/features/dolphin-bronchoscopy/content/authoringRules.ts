import { DOLPHIN_NUMBERS } from './teachingNumbers'
import type {
  AuthoredChoice,
  AuthoredItem,
  DolphinAct,
  DolphinMicroCase,
  DolphinSectionDefinition,
  DolphinTeachingBlock,
} from './types'

/**
 * The writing rules, as checks (a subset of Bronchoscopy Foundations' rewrite caps).
 *
 * The module is written for a busy clinician on a tablet: short sentences, short screens, the
 * number stated with its source, the first move instead of a hand-off, and one memory hook that
 * opens the section.
 *
 * Digits in learner copy come from three places only: a register row the surface cites, an airway
 * label (RB4, LB10, RT1, T1), or a value the case itself states (a weight, a time in the case).
 */
export const DOLPHIN_CAPS = {
  screenWords: 120,
  /** A stem with the situation it is asked about. */
  stemWords: 60,
  optionWords: 20,
  rationaleWords: 35,
  explanationWords: 60,
  sentenceAverage: 20,
  sentenceMax: 30,
  analogyWords: 35,
  checklistItems: 4,
  blockPoints: 6,
} as const

export type CopyKind = 'teaching' | 'case' | 'stem' | 'option' | 'rationale' | 'explanation'

export interface CopySurface {
  readonly where: string
  readonly kind: CopyKind
  readonly text: string
  /** Register rows whose values this surface may state. */
  readonly numberIds: readonly string[]
}

export function wordCount(text: string): number {
  const trimmed = text.trim()
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length
}

export function sentencesOf(text: string): readonly string[] {
  return text
    .split(/\n\s*\n/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+(?=[“"'(A-Z0-9])/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
}

/** Airway, vertebra and dimension labels: their digits are names, not numbers. */
const LABEL_TOKEN =
  /\b(?:[RL]B\d{1,2}|RT[1-3]|T\d{1,2}|LB|RB|[0-9]D)\b|\b(?:LNP|RNP|NPX|NPF|LS|LX|TRA|RTB|RMB|LMB)\b/g

function numericTokens(text: string): readonly string[] {
  return (text.replace(LABEL_TOKEN, ' ').match(/\d+(?:\.\d+)?/g) ?? []).map((token) =>
    token.replace(/^0+(?=\d)/, ''),
  )
}

function allowedTokens(numberIds: readonly string[]): ReadonlySet<string> {
  const allowed = new Set<string>()
  for (const id of numberIds) {
    const row = DOLPHIN_NUMBERS.rows.find((candidate) => candidate.id === id)
    if (!row) continue
    for (const text of [row.value, row.note ?? '', row.appliesTo ?? '']) {
      for (const token of numericTokens(text)) allowed.add(token)
    }
  }
  return allowed
}

export function digitErrors(surface: CopySurface): readonly string[] {
  if (surface.kind === 'case') return []
  const allowed = allowedTokens(surface.numberIds)
  const stray = numericTokens(surface.text).filter((token) => !allowed.has(token))
  return stray.length > 0
    ? [
        `${surface.where} states ${[...new Set(stray)].join(', ')} without a register row that gives it.`,
      ]
    : []
}

export function lengthErrors(surface: CopySurface): readonly string[] {
  const errors: string[] = []
  const words = wordCount(surface.text)
  const cap =
    surface.kind === 'option'
      ? DOLPHIN_CAPS.optionWords
      : surface.kind === 'rationale'
        ? DOLPHIN_CAPS.rationaleWords
        : surface.kind === 'explanation'
          ? DOLPHIN_CAPS.explanationWords
          : surface.kind === 'teaching'
            ? DOLPHIN_CAPS.screenWords
            : null
  if (cap !== null && words > cap) {
    errors.push(`${surface.where} runs ${words} words; the cap is ${cap}.`)
  }
  const sentences = sentencesOf(surface.text)
  for (const sentence of sentences) {
    const count = wordCount(sentence)
    if (count > DOLPHIN_CAPS.sentenceMax) {
      errors.push(`${surface.where} has a ${count}-word sentence: "${sentence.slice(0, 60)}…"`)
    }
  }
  if (sentences.length > 2) {
    const average = sentences.reduce((sum, s) => sum + wordCount(s), 0) / sentences.length
    if (average > DOLPHIN_CAPS.sentenceAverage) {
      errors.push(`${surface.where} averages ${average.toFixed(1)} words a sentence.`)
    }
  }
  return errors
}

function choiceSurfaces(
  where: string,
  choices: readonly AuthoredChoice[],
  numberIds: readonly string[],
): CopySurface[] {
  return choices.flatMap((choice) => [
    {
      where: `${where} choice ${choice.id}`,
      kind: 'option' as const,
      text: choice.label,
      numberIds,
    },
    {
      where: `${where} choice ${choice.id} rationale`,
      kind: 'rationale' as const,
      text: choice.rationale,
      numberIds,
    },
  ])
}

export function itemSurfaces(where: string, item: AuthoredItem, situation?: string): CopySurface[] {
  const numberIds = item.numberIds ?? []
  const context = situation ?? item.situation
  return [
    ...(context
      ? [{ where: `${where} situation`, kind: 'case' as const, text: context, numberIds }]
      : []),
    { where: `${where} stem`, kind: 'stem', text: item.stem, numberIds },
    ...choiceSurfaces(where, item.choices, numberIds),
    { where: `${where} explanation`, kind: 'explanation', text: item.explanation, numberIds },
  ]
}

export function blockSurfaces(where: string, block: DolphinTeachingBlock): CopySurface[] {
  const numberIds = block.numberIds ?? []
  return [
    { where: `${where} heading`, kind: 'teaching', text: block.heading, numberIds: [] },
    { where: `${where} body`, kind: 'teaching', text: block.body, numberIds },
    ...(block.points ?? []).map((point, index) => ({
      where: `${where} point ${index + 1}`,
      kind: 'teaching' as const,
      text: point,
      numberIds,
    })),
  ]
}

export function actSurfaces(where: string, act: DolphinAct): CopySurface[] {
  switch (act.kind) {
    case 'sort':
      return [
        { where: `${where} prompt`, kind: 'teaching', text: act.sort.prompt, numberIds: [] },
        ...act.sort.rows.flatMap((row) => [
          {
            where: `${where} row ${row.id}`,
            kind: 'option' as const,
            text: row.statement,
            numberIds: act.sort.numberIds ?? [],
          },
          {
            where: `${where} row ${row.id} rationale`,
            kind: 'rationale' as const,
            text: row.rationale,
            numberIds: act.sort.numberIds ?? [],
          },
        ]),
      ]
    case 'sequence':
      return [
        { where: `${where} prompt`, kind: 'teaching', text: act.sequence.prompt, numberIds: [] },
        ...act.sequence.steps.flatMap((step) => [
          {
            where: `${where} step ${step.id}`,
            kind: 'option' as const,
            text: step.label,
            numberIds: act.sequence.numberIds ?? [],
          },
          {
            where: `${where} step ${step.id} detail`,
            kind: 'rationale' as const,
            text: step.detail,
            numberIds: act.sequence.numberIds ?? [],
          },
        ]),
        {
          where: `${where} rationale`,
          kind: 'explanation',
          text: act.sequence.rationale,
          numberIds: act.sequence.numberIds ?? [],
        },
      ]
    case 'scenario':
      return act.scenario.frames.flatMap((frame) => [
        {
          where: `${where} ${frame.id} situation`,
          kind: 'case' as const,
          text: frame.situation,
          numberIds: [],
        },
        {
          where: `${where} ${frame.id} prompt`,
          kind: 'stem' as const,
          text: frame.prompt,
          numberIds: [],
        },
        ...choiceSurfaces(`${where} ${frame.id}`, frame.choices, []),
      ])
    case 'identify':
      return act.identify.rows.flatMap((row) => [
        {
          where: `${where} ${row.id} prompt`,
          kind: 'stem' as const,
          text: row.prompt,
          numberIds: [],
        },
        {
          where: `${where} ${row.id} rationale`,
          kind: 'rationale' as const,
          text: row.rationale,
          numberIds: [],
        },
      ])
    case 'anatomy-pick':
      return [
        { where: `${where} prompt`, kind: 'teaching', text: act.prompt, numberIds: [] },
        ...act.prompts.flatMap((prompt) => [
          {
            where: `${where} ${prompt.id}`,
            kind: 'stem' as const,
            text: prompt.prompt,
            numberIds: [],
          },
          {
            where: `${where} ${prompt.id} rationale`,
            kind: 'rationale' as const,
            text: prompt.rationale,
            numberIds: [],
          },
        ]),
      ]
    default:
      return 'prompt' in act
        ? [{ where: `${where} prompt`, kind: 'teaching', text: act.prompt, numberIds: [] }]
        : []
  }
}

export function microCaseSurfaces(where: string, microCase: DolphinMicroCase): CopySurface[] {
  return [
    { where: `${where} title`, kind: 'teaching', text: microCase.presentationTitle, numberIds: [] },
    ...itemSurfaces(where, microCase.item, microCase.situation),
  ]
}

/** Every learner-facing surface a section authors, for the copy checks. */
export function sectionSurfaces(section: DolphinSectionDefinition): CopySurface[] {
  const where = section.id
  return [
    {
      where: `${where} clinical question`,
      kind: 'teaching',
      text: section.clinicalQuestion,
      numberIds: [],
    },
    {
      where: `${where} recognize`,
      kind: 'teaching',
      text: section.recognizeInstruction,
      numberIds: [],
    },
    {
      where: `${where} anchor analogy`,
      kind: 'teaching',
      text: section.anchor.analogy,
      numberIds: [],
    },
    { where: `${where} anchor`, kind: 'teaching', text: section.anchor.precise, numberIds: [] },
    ...section.anchor.checklist.map((line, index) => ({
      where: `${where} checklist ${index + 1}`,
      kind: 'teaching' as const,
      text: line,
      numberIds: [],
    })),
    {
      where: `${where} workspace caption`,
      kind: 'teaching',
      text: section.workspace.caption,
      numberIds: [],
    },
    ...section.blocks.flatMap((block) => blockSurfaces(`${where} block ${block.id}`, block)),
    ...actSurfaces(`${where} act`, section.act),
    ...itemSurfaces(`${where} prediction`, section.prediction),
    ...itemSurfaces(`${where} transfer`, section.transfer),
    ...section.practice.flatMap((c) => microCaseSurfaces(`${where} practice ${c.id}`, c)),
    ...(section.firstMoves ?? []).flatMap((card) => [
      {
        where: `${where} first moves ${card.id}`,
        kind: 'teaching' as const,
        text: card.heading,
        numberIds: [],
      },
      ...card.steps.map((step, index) => ({
        where: `${where} first moves ${card.id} step ${index + 1}`,
        kind: 'teaching' as const,
        text: step,
        numberIds: [],
      })),
      {
        where: `${where} first moves ${card.id} help`,
        kind: 'teaching' as const,
        text: card.callForHelp,
        numberIds: [],
      },
    ]),
  ]
}

/** The rules for one section, beyond what the copy gate refuses. */
export function authoringRuleErrors(section: DolphinSectionDefinition): readonly string[] {
  const errors: string[] = []
  if (wordCount(section.anchor.analogy) > DOLPHIN_CAPS.analogyWords) {
    errors.push(`${section.id} anchor analogy runs past ${DOLPHIN_CAPS.analogyWords} words.`)
  }
  if (section.anchor.checklist.length > DOLPHIN_CAPS.checklistItems) {
    errors.push(`${section.id} checklist has more than ${DOLPHIN_CAPS.checklistItems} items.`)
  }
  for (const block of section.blocks) {
    if ((block.points?.length ?? 0) > DOLPHIN_CAPS.blockPoints) {
      errors.push(
        `${section.id} block ${block.id} lists more than ${DOLPHIN_CAPS.blockPoints} points.`,
      )
    }
    if (/\d/.test(block.heading))
      errors.push(`${section.id} block ${block.id} heading carries a digit.`)
  }
  for (const item of [
    section.prediction,
    section.transfer,
    ...section.practice.map((c) => c.item),
  ]) {
    const stemWords = wordCount(`${item.situation ?? ''} ${item.stem}`)
    if (stemWords > DOLPHIN_CAPS.stemWords) {
      errors.push(`${section.id} item ${item.id} stem and situation run ${stemWords} words.`)
    }
  }
  for (const surface of sectionSurfaces(section)) {
    errors.push(...digitErrors(surface), ...lengthErrors(surface))
  }
  return errors
}
