import type { CtNoduleTarget } from './ct-types'
import { displayName } from '../engine/display-text'
import {
  levelPhrase,
  type ForkFacts,
  type LesionFacts,
  type OpeningFacts,
} from '../engine/fork-facts'
import type { PlaneMove, VerdictResult } from '../engine/junction-feedback'
import {
  operationsSentence,
  type MatchReading,
  type OrientationMatch,
  type ScreenSide,
} from '../engine/orientation-match'
import type { NavSummary } from '../engine/nav-session'
import { orientationName, type CtOrientation } from '../geometry/orientation'
import type { LookKind } from '../geometry/route-stations'

/**
 * Every sentence the bench says about a fork, built from the route geometry.
 *
 * The lessons' own prose (content/nav-lessons.ts) says what to look for and why. This file says
 * what is so at this fork: which side an opening is on, which slice it is identified on, what a
 * mark landed in. Nothing here is typed per fork, so a sentence cannot disagree with the picture.
 *
 * Openings are numbered, not lettered: A and P already mean anterior and posterior on both
 * pictures.
 */
export const openingNumber = (index: number) => String(index + 1)

/** One boundary statement for the module: on the hub and on each closing screen. */
export const TEACHING_SIMULATOR_STATEMENT =
  'This is a teaching simulator built on one CT scan. It trains you to read an airway route off axial slices and relate it to the bronchoscopic view; it does not show what a bronchoscope or tool can reach, and it does not replace supervised practice on patients.'

export const PRIMER_TITLE = 'What we are doing, and why'
export const PRIMER: readonly string[] = [
  'A peripheral lesion is reached by taking the right opening at every fork. The bronchoscope shows you the fork. The CT, read beforehand, tells you which opening to take.',
  'The catch is that the two pictures do not face the same way. An axial CT is drawn as if you stood at the patient’s feet looking toward the head. A scope looking down the trachea sees it mirrored; a scope that has turned into a lobe sees it rotated.',
  'So at each fork you do four things. Match: turn or flip the CT until the letters R, L, A and P sit on the same sides as they do in the scope. Identify: find each opening’s lumen on the CT, scrolling to the slice where it leaves the parent. Choose: decide which opening leads toward the lesion. Drive: advance to the next fork, and the CT follows the tip.',
  'Repeat until the airway ends beside the lesion. Kurimoto and Morita call this bronchial branch tracing. Their four fork patterns (vertical, horizontal–horizontal, horizontal–vertical and horizontal–oblique) describe how the two daughters of a fork part on the CT, and you will meet each one.',
]

const SIDE_WORDS: Record<ScreenSide, string> = {
  top: 'at the top',
  bottom: 'at the bottom',
  left: 'on the left',
  right: 'on the right',
}
const LETTER_NAMES: Record<'L' | 'R' | 'A' | 'P', string> = {
  L: 'L (patient’s left)',
  R: 'R (patient’s right)',
  A: 'A (anterior)',
  P: 'P (posterior)',
}

/** "the upper opening in the scope" */
export const openingInScope = (opening: OpeningFacts) => `the ${opening.side} opening in the scope`

/** "RUL · Right upper lobe bronchus", or "Opening 1" while its name is withheld. */
export function openingName(opening: OpeningFacts, named: boolean) {
  const number = openingNumber(opening.index)
  if (!named) return `Opening ${number}`
  const detail = opening.repeatedName
    ? `${opening.airway.code}, the ${opening.side} branch`
    : `${opening.airway.code} · ${displayName(opening.airway.name)}`
  return `${number} · ${detail}`
}
/** Short form for a sentence: "RUL", or "opening 1" while its name is withheld. */
export function openingShort(opening: OpeningFacts, named: boolean) {
  if (!named) return `opening ${openingNumber(opening.index)}`
  return opening.repeatedName
    ? `the ${opening.side} branch of ${opening.airway.code}`
    : opening.airway.code
}

// ── Match ────────────────────────────────────────────────────────────────────────────────────

/** How the scope is looking, for the caption under its view. */
export function lookCaption(
  parentCode: string,
  look: LookKind,
  lookWords: string,
  topName: string,
) {
  const along = look === 'level' ? ' It is looking along the CT slice, not through it.' : ''
  return `In ${parentCode}, looking ${lookWords}, with ${topName} at the top of the view.${along}`
}

export function matchVerdict(
  reading: MatchReading,
  orientation: CtOrientation,
  help: boolean,
): { tone: 'in' | 'miss'; headline: string; detail: string } {
  if (reading.kind === 'matches')
    return {
      tone: 'in',
      headline: 'The CT matches the scope.',
      detail: `Display: ${orientationName(orientation).toLowerCase()}. Each letter the scope shows is on the same side of the CT.`,
    }
  const headline =
    reading.kind === 'mirrored'
      ? 'Mirrored.'
      : reading.kind === 'rotated'
        ? 'Rotated.'
        : 'Rotated and mirrored.'
  const example = reading.example
    ? `The scope has ${LETTER_NAMES[reading.example.letter]} ${SIDE_WORDS[reading.example.scope]}; your CT has it ${SIDE_WORDS[reading.example.ct]}.`
    : 'A letter sits on a different side of the two pictures.'
  return {
    tone: 'miss',
    headline,
    detail: help ? `${example} ${operationsSentence(reading.operations)}` : example,
  }
}

/** Said once the CT faces the scope without the learner having turned it. */
export function matchNoteSentence(
  note: 'kept' | 'set',
  orientation: CtOrientation,
  firstFork: boolean,
  oblique = false,
) {
  const display = orientationName(orientation).toLowerCase()
  // An oblique look has no exact match: say so, and say what the display does agree on.
  if (oblique)
    return `The scope is looking at an angle to both of the CT’s axes here, so no turn of the CT puts every letter where the scope has it. The CT is shown in the closest display: ${display}.`
  if (firstFork)
    return note === 'kept'
      ? `The CT already matches the scope here: ${display}.`
      : `The CT has been turned to match the scope: ${display}.`
  return note === 'kept'
    ? 'The CT still matches the scope from the last fork.'
    : `The scope’s view has turned, so the CT has been turned to match it: ${display}.`
}

/** What a sideways look means for reading the CT, in the scope's own terms. */
export function alongSliceSentence(match: OrientationMatch) {
  const along =
    match.weakAxis === 'left-right'
      ? ' Left and right of the patient run into the picture, so R and L are not on the scope’s rim.'
      : match.weakAxis === 'anterior-posterior'
        ? ' Front and back of the patient run into the picture, so A and P are not on the scope’s rim.'
        : ''
  return `The scope is looking along the slice here, with the head at the top of its view. The CT shows head and feet as slice level, not as a side: an opening higher in the scope is found by scrolling toward the head.${along}`
}

// ── Identify ─────────────────────────────────────────────────────────────────────────────────

export function identifyInstruction(opening: OpeningFacts, currentSlice: number) {
  const number = openingNumber(opening.index)
  const where = `Opening ${number} is ${openingInScope(opening)}.`
  if (currentSlice === opening.slice)
    return `${where} You are on its slice, ${opening.slice}. Click inside its lumen.`
  const way = opening.slice > currentSlice ? 'toward the head' : 'toward the feet'
  return `${where} Its lumen is identified on slice ${opening.slice}: scroll ${way} to the mark ${number} on the slider, then click inside the lumen.`
}

/** "about 6 mm posterior and toward the patient's right" */
export function moveSentence(move: PlaneMove) {
  const parts: string[] = []
  if (Math.abs(move.posteriorMm) >= 0.4 * move.mm)
    parts.push(move.posteriorMm > 0 ? 'posterior' : 'anterior')
  if (Math.abs(move.leftMm) >= 0.4 * move.mm)
    parts.push(move.leftMm > 0 ? 'toward the patient’s left' : 'toward the patient’s right')
  const distance = move.mm < 1.5 ? '1 to 2 mm' : `about ${Math.round(move.mm)} mm`
  return `${distance} ${parts.join(' and ')}`.trim()
}

export interface VerdictBandCopy {
  tone: 'in' | 'near' | 'miss'
  headline: string
  detail: string
}
/**
 * The band for one mark: what it landed in and, when help is on, which way to move.
 * `nearestName` is the airway the mark is in or nearer, already in the form the bench may show.
 */
export function identifyVerdict(
  opening: OpeningFacts,
  result: VerdictResult,
  named: boolean,
  nearestName: string | null,
  help: boolean,
): VerdictBandCopy {
  const number = openingNumber(opening.index)
  const move = help
    ? ` Opening ${number} is ${moveSentence(result.toIntended)} from your mark.`
    : ''
  if (result.verdict === 'intended-lumen')
    return {
      tone: 'in',
      headline: 'In the lumen.',
      detail: named
        ? `Opening ${number} is ${opening.airway.code}, ${displayName(opening.airway.name).toLowerCase()}. It runs ${opening.course} from the fork.`
        : `That is opening ${number}. It runs ${opening.course} from the fork.`,
    }
  if (result.verdict === 'near-fork')
    return {
      tone: 'near',
      headline: 'Near the fork.',
      detail: `On this slice the two lumens are still one air column, and your mark is on the side of ${nearestName ?? 'the other airway'}.${move}`,
    }
  if (result.verdict === 'other-airway')
    return {
      tone: 'miss',
      headline: nearestName ? `That lumen is ${nearestName}.` : 'That is another airway.',
      detail: `Your mark is inside an airway, but not opening ${number}.${move}`,
    }
  return {
    tone: 'miss',
    headline: 'Not in an airway.',
    detail: `An airway is a dark lumen with a thin bright wall. Your mark is on wall, vessel or lung.${move}`,
  }
}

// ── Choose ───────────────────────────────────────────────────────────────────────────────────

export function lesionSentence(target: CtNoduleTarget, lesion: LesionFacts) {
  const level =
    lesion.slicesFromFork === 0
      ? 'on this fork’s own slice'
      : `${levelPhrase(lesion.slicesFromFork)} of this fork`
  return `The lesion is in ${target.segment.code}, the ${target.segment.name.toLowerCase()}. It lies ${level} (slice ${lesion.slice}), about ${Math.round(lesion.mm)} mm away, ${lesion.bearing}.`
}

/** "37 mm toward the feet of this fork" / "at about this fork's level" */
function lesionLevel(lesion: LesionFacts) {
  return Math.abs(lesion.slicesFromFork) <= 2
    ? 'at about this fork’s level'
    : `${levelPhrase(lesion.slicesFromFork)} of this fork`
}
export function chooseDeclined(opening: OpeningFacts, named: boolean, lesion: LesionFacts) {
  const subject = openingShort(opening, named)
  return {
    headline: `${subject[0].toUpperCase()}${subject.slice(1)} leads away from the lesion.`,
    detail: `It runs ${opening.course} from the fork. The lesion lies ${lesion.bearing}, ${lesionLevel(lesion)}. First move: back to the fork, and follow the other lumen on the CT toward the lesion’s slice.`,
  }
}
export function chooseTaken(opening: OpeningFacts, lesion: LesionFacts) {
  return {
    headline: `${opening.airway.code} leads toward the lesion.`,
    detail: `${displayName(opening.airway.name)} runs ${opening.course} from the fork. The lesion lies ${lesion.bearing}, ${lesionLevel(lesion)}.`,
  }
}

// ── Fork facts, arrival, summary ─────────────────────────────────────────────────────────────

export function openingLevelSentence(opening: OpeningFacts) {
  return `slice ${opening.slice}, ${levelPhrase(opening.slicesFromFork)}`
}
/** How the daughters of a fork part on the CT, from the slices each is identified on. */
export function forkPatternSentence(facts: ForkFacts) {
  if (facts.inPlane)
    return 'The daughters are identified on the same slice: they part side to side, within the plane.'
  // Within a slice of the fork counts as the fork's own level.
  const up = facts.openings.filter((o) => o.slicesFromFork > 1).length
  const down = facts.openings.filter((o) => o.slicesFromFork < -1).length
  const level = facts.openings.length - up - down
  if (facts.openings.length > 2) {
    const count = (n: number) => ['none', 'one', 'two', 'three'][n] ?? String(n)
    const parts = [
      level ? `${count(level)} at the fork’s own level` : '',
      up ? `${count(up)} toward the head` : '',
      down ? `${count(down)} toward the feet` : '',
    ].filter(Boolean)
    const total = count(facts.openings.length)
    return `${total[0].toUpperCase()}${total.slice(1)} daughters here: ${parts.join(', ')}.`
  }
  if (up && down)
    return 'One daughter is found by scrolling toward the head and the other toward the feet.'
  const way = up ? 'head' : 'feet'
  return level
    ? `One daughter is at the fork’s own level; the other is found by scrolling toward the ${way}.`
    : `Both daughters are found by scrolling toward the ${way}, at different levels.`
}

export function arrivalSentence(target: CtNoduleTarget, gapMm: number) {
  return `The scope is at the end of ${target.approachCode} in this airway model. The lesion sits about ${Math.round(gapMm)} mm beyond it, in ${target.segment.code}. On the CT the lesion is ringed on slice ${target.slice}.`
}

export function summaryLines(summary: NavSummary, forkNames: string[]) {
  const lines: string[] = []
  const tally = (label: string, part: { asked: number; firstTry: number }) => {
    if (part.asked) lines.push(`${label} first try: ${part.firstTry} of ${part.asked}.`)
  }
  tally('CT matched to the scope', summary.match)
  tally('Openings identified', summary.identify)
  tally('Opening toward the lesion chosen', summary.choose)
  if (summary.slowest)
    lines.push(
      `The fork that took longest: ${forkNames[summary.slowest.station] ?? 'one fork'}, ${summary.slowest.tries} tries.`,
    )
  return lines
}
