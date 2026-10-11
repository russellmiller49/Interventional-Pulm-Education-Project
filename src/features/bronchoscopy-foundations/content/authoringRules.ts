import type { CourseChunk } from './courseFlow'
import {
  handTypedDigitErrors,
  isNumberId,
  numberText,
  numberTokenErrors,
  numberTokensIn,
} from './numbers'
import { phaseOfSection } from './sectionIds'
import type {
  AuthoredChoice,
  AuthoredItem,
  BronchAct,
  BronchSectionDefinition,
  BronchTeachingBlock,
} from './types'

/**
 * The rewrite rules, as checks.
 *
 * The course is written for a tired fellow on a phone: short sentences, short screens, the number
 * stated with its source, the first move instead of "ask your attending", and one memory hook that
 * opens the section. Each rule of the rewrite plan (2026-10-08) is a function here, so a section
 * cannot drift back to the earlier voice without a validator saying so.
 *
 * `rewriteRuleErrors` is strict for a section marked `authoringContract: 2`. Every other section is
 * measured by the same functions and reported (`check-section.ts --all --report`), never failed, until
 * it is rewritten.
 */
export const REWRITE_CAPS = {
  /** Teaching words in one section: the hook, the teaching cards and the activity prompts. */
  sectionWords: 1000,
  /** Teaching words on one screen. */
  screenWords: 120,
  /** A question's stem, with the case it is asked about. */
  stemWords: 60,
  optionWords: 20,
  rationaleWords: 35,
  explanationWords: 60,
  sentenceAverage: 20,
  sentenceMax: 30,
  paragraphSentences: 3,
  /** Reading rate used for the stated time, in words a minute. */
  wordsPerMinute: 200,
  analogyWords: 35,
  checklistItems: 4,
  /** Times a section may name the attending, supervisor or faculty. One step, never the answer. */
  deferralMentions: 3,
  /** Share of a rewritten set's questions that must show an image. */
  imageItemShare: 1 / 3,
  /** The most a test-wise reader may get right without knowing the medicine. */
  testWiseScore: 0.3,
} as const

/** Words about the course itself. They go in the sources panel or nowhere, never in a lesson. */
export const BANNED_LEARNER_TERMS: readonly { readonly name: string; readonly pattern: RegExp }[] =
  [
    { name: 'model boundary', pattern: /\bmodel boundar(y|ies)\b/i },
    { name: 'authored', pattern: /\bauthored\b/i },
    { name: 'declared', pattern: /\bdeclar(e|es|ed|ing|ation|ations)\b/i },
    { name: 'teaching profile', pattern: /\bteaching profile\b/i },
    {
      name: 'this course does not',
      pattern:
        /\bth(is|e) (course|module|section|lesson|app) (does not|doesn[’']t|cannot|can[’']t|gives no|will not|never)\b/i,
    },
    { name: 'the lecture', pattern: /\b(the|a|one|in) (narrated )?lectures?\b/i },
  ]

const DEFERRAL = /\b(attending|supervisor|supervising|faculty)\b/gi
/** A keyed answer that is only a hand-off: "Ask the attending what to do." */
const DEFERRAL_ONLY =
  /^(ask|call|tell|notify|page|wait for|defer to|follow|hand (over|off) to)\b[^,;]*\b(attending|supervisor|faculty|senior|team)\b[^,;]*$/i
const DOCUMENTATION_STEM = /\b(record|report|document|chart|write|word(ed|ing)?)\b/i

// ── Reading the copy ─────────────────────────────────────────────────────────────────────────────

export type CopyKind = 'teaching' | 'case' | 'stem' | 'option' | 'rationale' | 'explanation'

export interface CopySurface {
  readonly where: string
  readonly kind: CopyKind
  /** As authored: register tokens are still in it. */
  readonly text: string
  /** The surface states a case’s own arithmetic (a dose ledger), so its digits are the case’s. */
  readonly caseValues?: true
}

/** The copy as the learner reads it; a token with no value yet reads as one word. */
export function readable(text: string): string {
  return numberTokensIn(text).reduce((current, id) => {
    const value = isNumberId(id) ? numberText(id) : null
    return current.split(`{{num:${id}}}`).join(value ?? 'value')
  }, text)
}

export function wordCount(text: string): number {
  const trimmed = readable(text).trim()
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length
}

export function sentencesOf(text: string): readonly string[] {
  return readable(text)
    .split(/\n\s*\n/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+(?=[“"'(A-Z0-9])/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
}

function choiceSurfaces(where: string, choices: readonly AuthoredChoice[]): CopySurface[] {
  return choices.flatMap((choice) => [
    { where: `${where} choice ${choice.id}`, kind: 'option' as const, text: choice.label },
    {
      where: `${where} choice ${choice.id} rationale`,
      kind: 'rationale' as const,
      text: choice.rationale,
    },
  ])
}

function itemSurfaces(where: string, item: AuthoredItem, situation?: string): CopySurface[] {
  const context = situation ?? item.situation
  return [
    ...(context ? [{ where: `${where} situation`, kind: 'case' as const, text: context }] : []),
    { where: `${where} stem`, kind: 'stem', text: item.stem },
    ...choiceSurfaces(where, item.choices),
    { where: `${where} explanation`, kind: 'explanation', text: item.explanation },
  ]
}

function blockSurfaces(sectionId: string, block: BronchTeachingBlock): CopySurface[] {
  const where = `${sectionId} block "${block.id}"`
  const teaching = (label: string, text: string | undefined): CopySurface[] =>
    text ? [{ where: `${where} ${label}`, kind: 'teaching', text }] : []
  return [
    ...teaching('heading', block.heading),
    ...teaching('body', block.body),
    ...teaching('points label', block.pointsLabel),
    ...(block.points ?? []).flatMap((point, index) => teaching(`point ${index + 1}`, point)),
    ...(block.steps ?? []).flatMap((step, index) => teaching(`step ${index + 1}`, step)),
    ...teaching('call for help', block.callForHelp),
  ]
}

function actSurfaces(where: string, act: BronchAct): CopySurface[] {
  const teaching = (label: string, text: string | undefined): CopySurface[] =>
    text ? [{ where: `${where} ${label}`, kind: 'teaching', text }] : []
  switch (act.kind) {
    case 'scope-lab':
      return [
        ...teaching('view line', act.view.boundary),
        ...act.goals.flatMap((goal) => teaching(`goal ${goal.id}`, goal.label)),
        ...teaching('observe view line', act.observe?.view?.boundary),
        ...(act.observe?.goals ?? []).flatMap((goal) =>
          teaching(`observe goal ${goal.id}`, goal.label),
        ),
      ]
    case 'sort':
      return [
        ...teaching('prompt', act.sort.prompt),
        ...act.sort.origins.flatMap((origin) => [
          ...teaching(`origin ${origin.id}`, origin.label),
          ...teaching(`origin ${origin.id} definition`, origin.definition),
        ]),
        ...act.sort.rows.flatMap((row): CopySurface[] => [
          { where: `${where} row ${row.id}`, kind: 'stem', text: row.statement },
          { where: `${where} row ${row.id} rationale`, kind: 'rationale', text: row.rationale },
        ]),
      ]
    case 'identify':
      return [
        ...teaching('prompt', act.identify.prompt),
        ...act.identify.rows.flatMap((row): CopySurface[] => [
          { where: `${where} view ${row.id} prompt`, kind: 'stem', text: row.prompt },
          ...row.choices.map(
            (choice): CopySurface => ({
              where: `${where} view ${row.id} choice ${choice.id}`,
              kind: 'option',
              text: choice.label,
            }),
          ),
          { where: `${where} view ${row.id} rationale`, kind: 'rationale', text: row.rationale },
        ]),
      ]
    case 'find':
      return [
        ...teaching('prompt', act.find.prompt),
        ...act.find.rows.flatMap((row): CopySurface[] => [
          { where: `${where} image ${row.id} context`, kind: 'case', text: row.context },
          { where: `${where} image ${row.id} prompt`, kind: 'stem', text: row.prompt },
          { where: `${where} image ${row.id} rationale`, kind: 'rationale', text: row.rationale },
        ]),
      ]
    case 'sequence':
      return [
        ...teaching('prompt', act.sequence.prompt),
        ...act.sequence.steps.flatMap((step) => [
          ...teaching(`step ${step.id}`, step.label),
          ...teaching(`step ${step.id} detail`, step.detail),
        ]),
        { where: `${where} rationale`, kind: 'explanation', text: act.sequence.rationale },
      ]
    case 'ledger':
      // A ledger is one patient's doses: strengths, volumes, the weight and the sums are the
      // case's own values, like the vital signs of a scenario frame.
      return (
        [
          ...teaching('prompt', act.ledger.prompt),
          ...teaching('note', act.ledger.boundary),
          ...act.ledger.rows.flatMap((row) => [
            ...teaching(`row ${row.id}`, row.label),
            ...teaching(`row ${row.id} detail`, row.detail),
          ]),
          { where: `${where} total`, kind: 'stem', text: act.ledger.totalPrompt },
          ...choiceSurfaces(`${where} total`, act.ledger.totalChoices),
        ] satisfies CopySurface[]
      ).map((surface) => ({ ...surface, caseValues: true as const }))
    case 'report':
      return [
        ...teaching('prompt', act.report.prompt),
        ...act.report.fields.flatMap((field): CopySurface[] => [
          { where: `${where} field ${field.id}`, kind: 'stem', text: field.label },
          { where: `${where} field ${field.id} evidence`, kind: 'case', text: field.evidence },
          ...field.options.flatMap((option): CopySurface[] => [
            {
              where: `${where} field ${field.id} option ${option.id}`,
              kind: 'option',
              text: option.label,
            },
            {
              where: `${where} field ${field.id} option ${option.id} rationale`,
              kind: 'rationale',
              text: option.rationale,
            },
          ]),
        ]),
      ]
    case 'scenario':
      return [
        ...teaching('title', act.scenario.title),
        ...teaching('note', act.scenario.boundary),
        ...act.scenario.frames.flatMap((frame): CopySurface[] => [
          { where: `${where} frame ${frame.id} situation`, kind: 'case', text: frame.situation },
          { where: `${where} frame ${frame.id} prompt`, kind: 'stem', text: frame.prompt },
          ...frame.readings.map(
            (reading): CopySurface => ({
              where: `${where} frame ${frame.id} ${reading.channel}`,
              kind: 'case',
              text: reading.words,
            }),
          ),
          ...choiceSurfaces(`${where} frame ${frame.id}`, frame.choices),
          ...frame.choices.flatMap((choice): CopySurface[] =>
            choice.consequence
              ? [
                  {
                    where: `${where} frame ${frame.id} choice ${choice.id} consequence`,
                    kind: 'case',
                    text: choice.consequence.situation,
                  },
                ]
              : [],
          ),
        ]),
      ]
  }
}

/** A section's activities: its own, then any further ones, each with the key a screen names. */
export function sectionActs(
  section: BronchSectionDefinition,
): readonly { readonly key: string; readonly act: BronchAct }[] {
  return [
    { key: 'act', act: section.act },
    ...Object.entries(section.moreActs ?? {}).map(([key, act]) => ({ key: `act "${key}"`, act })),
  ]
}

function hookSurfaces(section: BronchSectionDefinition): CopySurface[] {
  const teaching = (label: string, text: string): CopySurface => ({
    where: `${section.id} ${label}`,
    kind: 'teaching',
    text,
  })
  return [
    teaching('clinical question', section.clinicalQuestion),
    teaching('hook analogy', section.anchor.analogy),
    teaching('hook sentence', section.anchor.precise),
    teaching('hook checklist label', section.anchor.checklistLabel),
    ...section.anchor.checklist.map((item, index) => teaching(`hook checklist ${index + 1}`, item)),
  ]
}

/** Every string of a section's Learn flow that a learner reads. Practice cases are listed apart. */
export function sectionCopySurfaces(section: BronchSectionDefinition): readonly CopySurface[] {
  return [
    ...hookSurfaces(section),
    ...section.blocks.flatMap((block) => blockSurfaces(section.id, block)),
    ...(section.tour ?? []).map(
      (stop): CopySurface => ({
        where: `${section.id} tour ${stop.airway}`,
        kind: 'teaching',
        text: stop.note,
      }),
    ),
    ...sectionActs(section).flatMap(({ key, act }) => actSurfaces(`${section.id} ${key}`, act)),
    ...itemSurfaces(`${section.id} prediction`, section.prediction),
    ...itemSurfaces(`${section.id} check`, section.transfer),
  ]
}

export function practiceCopySurfaces(section: BronchSectionDefinition): readonly CopySurface[] {
  return section.practice.flatMap((entry) =>
    itemSurfaces(`${section.id} practice ${entry.id}`, entry.item, entry.situation),
  )
}

// ── Measuring ────────────────────────────────────────────────────────────────────────────────────

export interface SectionMeasure {
  readonly sectionId: string
  readonly teachingWords: number
  readonly learnWords: number
  readonly practiceWords: number
  readonly screens: readonly { readonly id: string; readonly words: number }[]
  readonly sentenceAverage: number
  readonly longestSentence: number
  readonly statedMinutes: number
  readonly computedMinutes: number
  readonly deferralMentions: number
  readonly bannedTerms: readonly string[]
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0)

function wordsOf(surfaces: readonly CopySurface[], kinds?: readonly CopyKind[]): number {
  return sum(
    surfaces
      .filter((surface) => !kinds || kinds.includes(surface.kind))
      .map((surface) => wordCount(surface.text)),
  )
}

/** Teaching words each screen shows: its cards, and the hook on the screen that carries it. */
export function screenWords(
  section: BronchSectionDefinition,
  flow: readonly CourseChunk[],
): readonly { readonly id: string; readonly words: number }[] {
  const opening = flow.findIndex((chunk) => chunk.anchor)
  return flow
    .filter((chunk) => chunk.kind === 'teach' || chunk.kind === 'debrief')
    .map((chunk) => {
      const blocks = section.blocks.filter((block) => chunk.blocks.includes(block.id))
      const hook = chunk.anchor
        ? flow.indexOf(chunk) === opening
          ? hookSurfaces(section)
          : hookSurfaces(section).filter((surface) => surface.where.includes('checklist'))
        : []
      return {
        id: chunk.id,
        words:
          wordsOf(hook) + sum(blocks.map((block) => wordsOf(blockSurfaces(section.id, block)))),
      }
    })
}

export function measureSection(
  section: BronchSectionDefinition,
  flow: readonly CourseChunk[],
): SectionMeasure {
  const learn = sectionCopySurfaces(section)
  const practice = practiceCopySurfaces(section)
  const teachingWords = wordsOf(learn, ['teaching'])
  // What is read before answering: the case, the stem and the options. Feedback is read after.
  const questionWords = wordsOf(learn, ['case', 'stem', 'option'])
  const lengths = learn
    .filter((surface) => surface.kind !== 'option' && surface.kind !== 'stem')
    .flatMap((surface) => sentencesOf(surface.text))
    .map((sentence) => wordCount(sentence))
  const all = [...learn, ...practice]
  const text = all.map((surface) => readable(surface.text)).join('\n')
  return {
    sectionId: section.id,
    teachingWords,
    learnWords: wordsOf(learn),
    practiceWords: wordsOf(practice),
    screens: screenWords(section, flow),
    sentenceAverage: lengths.length === 0 ? 0 : sum(lengths) / lengths.length,
    longestSentence: Math.max(0, ...lengths),
    statedMinutes: section.minutes,
    computedMinutes:
      (teachingWords + questionWords) / REWRITE_CAPS.wordsPerMinute +
      (section.activityMinutes ?? 0),
    deferralMentions: text.match(DEFERRAL)?.length ?? 0,
    bannedTerms: BANNED_LEARNER_TERMS.filter((term) => term.pattern.test(text)).map(
      (term) => term.name,
    ),
  }
}

// ── The rules ────────────────────────────────────────────────────────────────────────────────────

function capErrors(surface: CopySurface): string[] {
  const count = wordCount(surface.text)
  const cap =
    surface.kind === 'option'
      ? REWRITE_CAPS.optionWords
      : surface.kind === 'rationale'
        ? REWRITE_CAPS.rationaleWords
        : surface.kind === 'explanation'
          ? REWRITE_CAPS.explanationWords
          : null
  return cap !== null && count > cap
    ? [`${surface.where} runs to ${count} words; at most ${cap}.`]
    : []
}

function sentenceErrors(surface: CopySurface): string[] {
  if (surface.kind === 'option' || surface.kind === 'stem') return []
  return sentencesOf(surface.text)
    .filter((sentence) => wordCount(sentence) > REWRITE_CAPS.sentenceMax)
    .map(
      (sentence) =>
        `${surface.where} has a sentence of ${wordCount(sentence)} words; at most ${REWRITE_CAPS.sentenceMax}: "${sentence.slice(0, 70)}…"`,
    )
}

function paragraphErrors(surface: CopySurface): string[] {
  if (surface.kind !== 'teaching') return []
  return readable(surface.text)
    .split(/\n\s*\n/)
    .filter((paragraph) => sentencesOf(paragraph).length > REWRITE_CAPS.paragraphSentences)
    .map(
      (paragraph) =>
        `${surface.where} has a paragraph of ${sentencesOf(paragraph).length} sentences; at most ${REWRITE_CAPS.paragraphSentences}.`,
    )
}

function bannedTermErrors(surface: CopySurface): string[] {
  const text = readable(surface.text)
  return BANNED_LEARNER_TERMS.filter((term) => term.pattern.test(text)).map(
    (term) =>
      `${surface.where} says "${term.name}"; talk about the patient and the scope, not the course.`,
  )
}

/** Digits are free in a case (the patient's own values); teaching and feedback use the register. */
function digitErrors(surface: CopySurface): string[] {
  return surface.kind === 'case' || surface.caseValues
    ? []
    : [...handTypedDigitErrors(surface.where, surface.text)]
}

function unsafeErrors(
  where: string,
  choices: readonly AuthoredChoice[],
  section: BronchSectionDefinition,
): string[] {
  const patterns = section.harmfulReflexPatterns ?? []
  return choices
    .filter(
      (choice) =>
        choice.plausibility === 'unsafe' && !patterns.some((pattern) => pattern.test(choice.label)),
    )
    .map(
      (choice) =>
        `${where} choice ${choice.id} is flagged unsafe but is not the section's harmful reflex; flag only the named reflex.`,
    )
}

function keyErrors(where: string, choices: readonly AuthoredChoice[]): string[] {
  const best = choices.find((choice) => choice.plausibility === 'best')
  return best && DEFERRAL_ONLY.test(best.label.trim())
    ? [
        `${where} keys a hand-off ("${best.label}"); the key is the first move, and calling for help is one step of it.`,
      ]
    : []
}

function choiceSets(
  section: BronchSectionDefinition,
): readonly { readonly where: string; readonly choices: readonly AuthoredChoice[] }[] {
  const sets = [
    { where: `${section.id} prediction`, choices: section.prediction.choices },
    { where: `${section.id} check`, choices: section.transfer.choices },
    ...section.practice.map((entry) => ({
      where: `${section.id} practice ${entry.id}`,
      choices: entry.item.choices,
    })),
  ]
  for (const { key, act } of sectionActs(section)) {
    if (act.kind === 'scenario')
      sets.push(
        ...act.scenario.frames.map((frame) => ({
          where: `${section.id} ${key} frame ${frame.id}`,
          choices: frame.choices,
        })),
      )
    if (act.kind === 'ledger')
      sets.push({ where: `${section.id} ${key} total`, choices: act.ledger.totalChoices })
  }
  return sets
}

/** How many times an activity asks the learner to show the outcome it assesses. */
function actAssessments(act: BronchAct): number {
  switch (act.kind) {
    case 'scenario':
      return act.scenario.frames.length
    case 'identify':
      return act.identify.rows.length
    case 'find':
      return act.find.rows.length
    case 'scope-lab':
      return act.goals.length + (act.observe?.goals.length ?? 0)
    default:
      return 1
  }
}

const PICTURED_ACTS: ReadonlySet<BronchAct['kind']> = new Set(['scope-lab', 'identify', 'find'])

function hookErrors(section: BronchSectionDefinition): string[] {
  const errors: string[] = []
  const { anchor, id } = section
  if (wordCount(anchor.analogy) > REWRITE_CAPS.analogyWords)
    errors.push(
      `${id} hook analogy runs to ${wordCount(anchor.analogy)} words; at most ${REWRITE_CAPS.analogyWords}.`,
    )
  if (sentencesOf(anchor.precise).length !== 1)
    errors.push(`${id} hook sentence must be one sentence.`)
  if (anchor.checklist.length !== REWRITE_CAPS.checklistItems)
    errors.push(
      `${id} hook checklist has ${anchor.checklist.length} items; ${REWRITE_CAPS.checklistItems}.`,
    )
  return errors
}

function flowErrors(section: BronchSectionDefinition, flow: readonly CourseChunk[]): string[] {
  const errors: string[] = []
  const { id } = section
  const first = flow[0]
  if (!first || first.kind !== 'teach' || !first.anchor || first.blocks.length > 0)
    errors.push(
      `${id} must open with the clinical question and the hook, on a screen of their own.`,
    )
  const teaches = flow
    .map((chunk, index) => ({ chunk, index }))
    .filter(({ chunk }) => chunk.kind === 'teach' && chunk.blocks.length > 0)
  const prediction = flow.findIndex((chunk) => chunk.kind === 'check')
  const check = flow.findIndex((chunk) => chunk.kind === 'transfer')
  if (prediction < 0 || (teaches[0] && prediction > teaches[0].index))
    errors.push(`${id} must ask its prediction before the teaching that answers it.`)
  if (check < 0 || (teaches.length > 0 && check < teaches[teaches.length - 1].index))
    errors.push(`${id} must put its check after the teaching.`)
  const last = flow[flow.length - 1]
  if (!last || last.kind !== 'debrief' || !last.anchor)
    errors.push(`${id} must close by repeating the hook's checklist.`)
  for (const chunk of flow)
    if (chunk.act && !section.moreActs?.[chunk.act])
      errors.push(`${id} screen "${chunk.id}" names an activity "${chunk.act}" the section lacks.`)
  for (const key of Object.keys(section.moreActs ?? {}))
    if (!flow.some((chunk) => chunk.act === key))
      errors.push(`${id} has an activity "${key}" that no screen runs.`)
  const pictured = sectionActs(section).some(({ act }) => PICTURED_ACTS.has(act.kind))
  if (pictured)
    for (const { chunk } of teaches) {
      const hasPicture =
        chunk.visual !== 'none' ||
        section.blocks.some((block) => chunk.blocks.includes(block.id) && block.media)
      if (!hasPicture)
        errors.push(`${id} screen "${chunk.id}" teaches something visible with no picture.`)
    }
  return errors
}

function outcomeErrors(section: BronchSectionDefinition): string[] {
  const errors: string[] = []
  const outcomes = section.outcomes ?? []
  if (outcomes.length < 1 || outcomes.length > 2)
    errors.push(`${section.id} states ${outcomes.length} outcomes; one or two.`)
  const items = [section.prediction, section.transfer, ...section.practice.map((e) => e.item)]
  const known = new Set(outcomes.map((outcome) => outcome.id))
  const acts = sectionActs(section)
  for (const { key, act } of acts)
    if (act.outcomeId && !known.has(act.outcomeId))
      errors.push(`${section.id} ${key} names an unknown outcome ${act.outcomeId}.`)
  for (const item of items)
    for (const outcomeId of item.outcomeIds ?? [])
      if (!known.has(outcomeId))
        errors.push(`${section.id} item ${item.id} names an unknown outcome ${outcomeId}.`)
  outcomes.forEach((outcome, index) => {
    // An activity assesses the outcome it names, or the first; items say which they assess.
    const byActs = acts
      .filter(({ act }) => (act.outcomeId ? act.outcomeId === outcome.id : index === 0))
      .reduce((total, { act }) => total + actAssessments(act), 0)
    const assessed = items.filter((item) => item.outcomeIds?.includes(outcome.id)).length + byActs
    if (assessed < 3)
      errors.push(
        `${section.id} outcome ${outcome.id} is assessed ${assessed} times; at least three.`,
      )
  })
  return errors
}

/** In a rewritten case every wrong move plays out, with the monitor, before the learner recovers. */
function consequenceErrors(section: BronchSectionDefinition): string[] {
  return sectionActs(section).flatMap(({ key, act }) =>
    act.kind !== 'scenario'
      ? []
      : act.scenario.frames.flatMap((frame) =>
          frame.choices
            .filter((choice) => choice.plausibility !== 'best' && !choice.consequence)
            .map(
              (choice) =>
                `${section.id} ${key} frame ${frame.id} choice ${choice.id} is a wrong move with no consequence; show what happens next.`,
            ),
        ),
  )
}

function firstMoveErrors(section: BronchSectionDefinition): string[] {
  const errors: string[] = []
  const cards = section.blocks.filter((block) => block.role === 'first-moves')
  if (phaseOfSection(section.id).id === 'respond' && cards.length === 0)
    errors.push(`${section.id} is about a complication and has no first-move card.`)
  for (const card of cards) {
    const where = `${section.id} block "${card.id}"`
    if ((card.steps?.length ?? 0) < 3)
      errors.push(`${where} is a first-move card with fewer than three moves.`)
    if (!card.callForHelp) errors.push(`${where} does not say when to call for help.`)
    const last = card.steps?.[card.steps.length - 1] ?? ''
    if (DEFERRAL_ONLY.test(last.trim()) && /\bfollow\b/i.test(last))
      errors.push(`${where} ends by following someone else's plan; end with a move.`)
  }
  return errors
}

/** Everything a rewritten section gets wrong. Empty for a section that follows the rules. */
export function rewriteRuleErrors(
  section: BronchSectionDefinition,
  flow: readonly CourseChunk[],
): readonly string[] {
  const { id } = section
  const errors: string[] = []
  const learn = sectionCopySurfaces(section)
  const practice = practiceCopySurfaces(section)
  const measure = measureSection(section, flow)

  if (measure.teachingWords > REWRITE_CAPS.sectionWords)
    errors.push(
      `${id} has ${measure.teachingWords} teaching words; at most ${REWRITE_CAPS.sectionWords}.`,
    )
  for (const screen of measure.screens)
    if (screen.words > REWRITE_CAPS.screenWords)
      errors.push(
        `${id} screen "${screen.id}" has ${screen.words} teaching words; at most ${REWRITE_CAPS.screenWords}.`,
      )
  if (measure.sentenceAverage > REWRITE_CAPS.sentenceAverage)
    errors.push(
      `${id} averages ${measure.sentenceAverage.toFixed(1)} words a sentence; at most ${REWRITE_CAPS.sentenceAverage}.`,
    )
  if (section.activityMinutes === undefined)
    errors.push(`${id} does not give the measured time of its activities.`)
  if (measure.statedMinutes < Math.ceil(measure.computedMinutes - 0.25))
    errors.push(
      `${id} states ${measure.statedMinutes} minutes; its reading and activities take ${measure.computedMinutes.toFixed(1)}.`,
    )
  if (measure.deferralMentions > REWRITE_CAPS.deferralMentions)
    errors.push(
      `${id} names the attending, supervisor or faculty ${measure.deferralMentions} times; teach the first move instead.`,
    )
  if (!section.harmfulReflexPatterns?.length)
    errors.push(`${id} lists no phrase that names its harmful reflex.`)

  for (const surface of [...learn, ...practice]) {
    errors.push(
      ...numberTokenErrors(surface.where, surface.text),
      ...digitErrors(surface),
      ...bannedTermErrors(surface),
      ...capErrors(surface),
      ...sentenceErrors(surface),
      ...paragraphErrors(surface),
    )
  }

  const stems = (where: string, item: AuthoredItem, situation?: string) => {
    const count = wordCount(`${situation ?? item.situation ?? ''} ${item.stem}`)
    if (count > REWRITE_CAPS.stemWords)
      errors.push(
        `${where} stem runs to ${count} words with its case; at most ${REWRITE_CAPS.stemWords}.`,
      )
  }
  stems(`${id} prediction`, section.prediction)
  stems(`${id} check`, section.transfer)
  for (const entry of section.practice)
    stems(`${id} practice ${entry.id}`, entry.item, entry.situation)

  for (const set of choiceSets(section))
    errors.push(
      ...unsafeErrors(set.where, set.choices, section),
      ...keyErrors(set.where, set.choices),
    )

  const documentation = [section.prediction, section.transfer].filter((item) =>
    DOCUMENTATION_STEM.test(item.stem),
  )
  if (documentation.length > 1)
    errors.push(
      `${id} asks about documentation wording ${documentation.length} times; at most once.`,
    )

  errors.push(
    ...hookErrors(section),
    ...flowErrors(section, flow),
    ...outcomeErrors(section),
    ...firstMoveErrors(section),
    ...consequenceErrors(section),
  )
  return errors
}

// ── The item bank ────────────────────────────────────────────────────────────────────────────────

interface BankItem {
  readonly choices: readonly { readonly label: string; readonly plausibility: string }[]
}

const ARGUES_FOR_ITSELF = /\b(since|because|so that|as it|given that)\b/i
const CAUTIOUS = /\b(pause|stop|hold|withdraw|wait|ask|call|confirm|reassess|review)\b/i

/**
 * How often a reader who knows no medicine picks the key: drop the options that argue for
 * themselves, then prefer one that pauses. Chance is one in the number of options.
 */
export function testWiseScore(items: readonly BankItem[]): number {
  if (items.length === 0) return 0
  const chances = items.map((item) => {
    const plain = item.choices.filter((choice) => !ARGUES_FOR_ITSELF.test(choice.label))
    const pool = plain.length > 0 ? plain : item.choices
    const cautious = pool.filter((choice) => CAUTIOUS.test(choice.label))
    const picks = cautious.length > 0 ? cautious : pool
    return picks.some((choice) => choice.plausibility === 'best') ? 1 / picks.length : 0
  })
  return sum(chances) / chances.length
}

/** Whether a question shows the learner an image to answer on. */
export function showsImage(item: AuthoredItem): boolean {
  return item.media !== undefined || item.choiceAirways !== undefined
}

/** The share of a section's questions answered on an image: its items and its image activity. */
export function imageItemCounts(section: BronchSectionDefinition): {
  readonly image: number
  readonly total: number
} {
  const items = [section.prediction, section.transfer, ...section.practice.map((e) => e.item)]
  const rows = sectionActs(section).reduce(
    (total, { act }) =>
      total +
      (act.kind === 'identify' ? act.identify.rows.length : 0) +
      (act.kind === 'find' ? act.find.rows.length : 0),
    0,
  )
  return { image: items.filter(showsImage).length + rows, total: items.length + rows }
}
