import type { CtNoduleTarget } from './ct-types'
import { referenceViewsFor } from './reference-views'
import { lobeOf } from './targets'
import {
  RIMS,
  rimSector,
  type Anatomical,
  type ArcGrade,
  type Bearing,
  type FrameGrade,
  type FrameLabels,
  type OstiumFrame,
  type Rim,
  type Sector,
} from '../engine/arc-map'
import type { LesionVerdict, PlanPart, PlanSummary, SegmentChoice } from '../engine/plan-session'

/**
 * Every sentence the bench says while planning and drawing the map, built from the route geometry
 * and the learner's own circle. Nothing is typed per lesion or per division.
 *
 * Directions on the map are always the circle's own words (medial, superior…), the ones the
 * learner wrote round it, never screen words alone: "the medial side", not "the top".
 */

export const PLAN_PART_TITLES: Record<PlanPart | 'review', string> = {
  lesion: 'The airway into the lesion',
  segment: 'Its segment',
  views: 'Your views',
  frame: 'The ostium circle',
  arcs: 'The divisions',
  review: 'Your map',
}
/** The three stages the bench names in its strip. */
export const STAGE_STEPS = [
  { id: 'plan', label: 'Plan', what: 'from the lesion back' },
  { id: 'map', label: 'Map', what: 'circle and arcs' },
  { id: 'navigate', label: 'Navigate', what: 'drive with the map' },
] as const

export const ANATOMICAL_LABEL: Record<Anatomical, string> = {
  superior: 'Superior',
  inferior: 'Inferior',
  medial: 'Medial',
  lateral: 'Lateral',
  anterior: 'Anterior',
  posterior: 'Posterior',
}
const RIM_PLACE: Record<Rim, string> = {
  top: 'the top',
  right: 'the right',
  bottom: 'the bottom',
  left: 'the left',
}
export const rimPlace = (rim: Rim) => RIM_PLACE[rim]
const lower = (s: string) => s.toLowerCase()

/** The words round a circle at each of the eight places: "medial", or "medial and posterior". */
export function sectorWords(sector: Sector, rim: Record<Rim, Anatomical | null>): string {
  const exact = RIMS.find((r) => rimSector[r] === sector)
  if (exact) return rim[exact] ?? RIM_PLACE[exact]
  const before = RIMS.find((r) => rimSector[r] === sector - 1)!
  const after = RIMS[(RIMS.indexOf(before) + 1) % 4]
  const a = rim[before] ?? RIM_PLACE[before]
  const b = rim[after] ?? RIM_PLACE[after]
  return `${a} and ${b}`
}
/** "toward medial", "between medial and posterior" */
export function sectorPhrase(sector: Sector, rim: Record<Rim, Anatomical | null>) {
  return sector % 2 === 0
    ? `on the ${sectorWords(sector, rim)} side`
    : `between ${sectorWords(sector, rim)}`
}

/** The model's rim words, as single words, for drawing a circle the learner has not labelled. */
export function frameWords(frame: OstiumFrame): Record<Rim, Anatomical> {
  return {
    top: frame.rim.top.word,
    right: frame.rim.right.word,
    bottom: frame.rim.bottom.word,
    left: frame.rim.left.word,
  }
}

// ── The airway into the lesion ────────────────────────────────────────────────────────────────

/** Before the segment is named, the lesion is placed by its lobe and slice only. */
export function lesionInstruction(target: CtNoduleTarget) {
  return `The lesion is in the ${lower(lobeOf(target))}, ringed on slice ${target.slice}. Scroll through it, find the airway that runs into it, and click that airway.`
}
export function lesionFound() {
  return {
    headline: 'That is the airway into the lesion.',
    detail: 'Now follow it back toward the hilum, slice by slice.',
  }
}
export function lesionMiss(verdict: LesionVerdict, help: boolean) {
  const near = verdict.nearest
  if (!help || !near)
    return {
      headline: 'Not the airway that runs into the lesion.',
      detail: 'Look for the airway whose lumen leads into the lesion on the slices that show it.',
    }
  const parts: string[] = []
  if (Math.abs(near.slices) >= 2)
    parts.push(`${Math.abs(near.slices)} slices toward the ${near.slices > 0 ? 'head' : 'feet'}`)
  const side = (mm: number, pos: string, neg: string) =>
    Math.abs(mm) >= 2 ? `${Math.round(Math.abs(mm))} mm ${mm > 0 ? pos : neg}` : ''
  const across = [
    side(near.leftMm, 'toward the patient’s left', 'toward the patient’s right'),
    side(near.posteriorMm, 'toward the back', 'toward the front'),
  ].filter(Boolean)
  parts.push(...across)
  return {
    headline: 'Not the airway that runs into the lesion.',
    detail: parts.length
      ? `The nearest part of it is ${parts.join(', ')}.`
      : 'It is very close: click inside its lumen.',
  }
}

// ── Its segment ───────────────────────────────────────────────────────────────────────────────

export function segmentInstruction() {
  return 'Follow the airway back toward the hilum, keeping it in view as it joins larger airways. Which segmental bronchus does it come from?'
}
export const segmentLabel = (choice: SegmentChoice) => `${choice.code} · ${choice.name}`
export function segmentFound(target: CtNoduleTarget) {
  return {
    headline: `${target.segment.bronchusCode}: the map starts at its ostium.`,
    detail: `The lesion is in ${target.segment.code}; the route reaches it through ${target.segment.bronchusCode} and its branches.`,
  }
}
export function segmentMiss(choice: SegmentChoice, help: boolean) {
  return {
    headline: `Not ${choice.code}.`,
    detail: help
      ? 'Follow the airway back again from the lesion, one slice at a time. The segmental bronchus is the largest airway on the way that still supplies this segment alone; beyond it the airway joins the lobar bronchus or a trunk it shares with other segments.'
      : 'Follow the airway back again from the lesion.',
  }
}

// ── Views ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Mortimer and Saghaie's suggestion for a segment (Figure 2) and their optional turn of the axial
 * image, said once the learner has named the segment. A starting point, not a rule.
 */
export function viewsInstruction(code: string) {
  const views = referenceViewsFor(code)
  if (!views)
    return 'Open a coronal or sagittal reconstruction beside the axial CT if it shows the segment better. Nothing here is checked.'
  const pairing = views.reconstruction
    ? `axial plus ${views.reconstruction}`
    : 'the axial slices alone'
  return `For ${code}, Mortimer and Saghaie suggest ${pairing}. ${views.reason} Turning the CT is optional: ${views.turnHint[0].toLowerCase()}${views.turnHint.slice(1)} Nothing here is checked.`
}

// ── The ostium circle ─────────────────────────────────────────────────────────────────────────

export function frameInstruction(code: string) {
  return `Imagine the scope at the ${code} ostium, looking in. Put one direction at each place round the circle: top, right, bottom and left.`
}
export function frameFound(turn: number) {
  return {
    headline: 'That is the view into the ostium.',
    detail:
      turn === 0
        ? 'Your circle is held the way the model scope holds it.'
        : 'Your circle is turned from the way the model scope holds it, which is fine: the scope can be held either way. The map is drawn on your circle.',
  }
}
export function frameMiss(
  grade: FrameGrade,
  frame: OstiumFrame,
  labels: FrameLabels,
  help: boolean,
) {
  const used = RIMS.map((r) => labels[r]).filter(Boolean) as Anatomical[]
  const repeated = used.find((word, i) => used.indexOf(word) !== i)
  if (repeated)
    return {
      headline: `${ANATOMICAL_LABEL[repeated]} is on the circle twice.`,
      detail: 'Each direction has one place; its opposite sits across the circle from it.',
    }
  const along = used.find((word) => word === frame.into || word === opposite(frame.into))
  if (along)
    return {
      headline: `${ANATOMICAL_LABEL[along]} is along your line of sight.`,
      detail: help
        ? `Looking into the ostium you look ${frame.into === 'superior' ? 'toward the head' : frame.into === 'inferior' ? 'toward the feet' : `${frame.into}ly`}, so ${frame.into} and ${opposite(frame.into)} are ahead and behind, not round the edge.`
        : 'The two directions ahead and behind are not on the circle.',
    }
  if (grade.mirrored)
    return {
      headline: 'This is the mirror image.',
      detail: help
        ? 'Top and bottom are right; left and right are swapped. Check which way you are looking: toward the head the axial CT is the view as drawn, toward the feet it is mirrored.'
        : 'Left and right are swapped.',
    }
  return {
    headline: `${grade.off.length === 4 ? 'None' : `${4 - grade.off.length} of 4`} in place.`,
    detail: help
      ? `${grade.off.map((r) => RIM_PLACE[r]).join(', ')} ${grade.off.length === 1 ? 'does' : 'do'} not fit. Opposites sit across the circle from each other.`
      : 'Not yet.',
  }
}
const opposite = (word: Anatomical): Anatomical =>
  (
    ({
      superior: 'inferior',
      inferior: 'superior',
      medial: 'lateral',
      lateral: 'medial',
      anterior: 'posterior',
      posterior: 'anterior',
    }) as const
  )[word]

// ── The divisions ─────────────────────────────────────────────────────────────────────────────

export function arcsInstruction(parentCode: string, count: number, first: boolean) {
  const n = count === 3 ? 'three' : 'two'
  return `${parentCode} divides into ${n} here. Click the side of the highlighted ${first ? 'circle' : 'arc'} where each leaves, then mark the one that goes on toward the lesion.`
}
export function arcsFound(last: boolean) {
  return last
    ? {
        headline: 'The last division is drawn.',
        detail: 'The star marks the branch that reaches the lesion.',
      }
    : { headline: 'Drawn.', detail: 'The next division goes inside the arc you marked.' }
}
export function arcsMiss(
  grade: ArcGrade,
  placed: readonly Sector[],
  bearings: readonly Bearing[],
  rim: Record<Rim, Anatomical | null>,
  help: boolean,
) {
  if (!grade.countOk)
    return {
      headline: `This division has ${bearings.length === 3 ? 'three' : 'two'} branches.`,
      detail: `You have drawn ${placed.length}.`,
    }
  if (grade.off.length) {
    const i = grade.off[0]
    const truth = bearings[grade.assignment[i]]
    return {
      headline:
        grade.off.length === 1
          ? `The branch drawn ${sectorPhrase(placed[i], rim)} is not where a branch leaves.`
          : grade.off.length === placed.length
            ? 'No branch is drawn where it leaves.'
            : `${grade.off.length} branches are not drawn where they leave.`,
      detail: help
        ? `Compare the branches with each other as you scroll: one leaves ${sectorPhrase(truth.sector, rim)} of the other.`
        : 'Scroll from the fork again and compare the branches with each other.',
    }
  }
  return {
    headline: 'The branches are in the right places.',
    detail: help
      ? 'But the lesion is reached through another of them: it is the airway you followed back from the lesion.'
      : 'But the lesion is reached through another of them.',
  }
}

// ── Review and summary ────────────────────────────────────────────────────────────────────────

export function reviewSentence(drawn: number, firstTry: number) {
  return `Your map beside the model’s: ${drawn} ${drawn === 1 ? 'division' : 'divisions'}, ${firstTry} drawn right at the first check. Where an arc of yours sits a place to one side of the model’s, both read the same at the scope: the map needs each branch on the right side of its sibling, not an exact angle.`
}
/** The review of a map the bench drew, in a lesson that starts at the drive. */
export function prefilledReview(code: string, divisions: number) {
  return {
    heading: 'The map, drawn for you',
    body: `The ${code} ostium circle and ${divisions === 1 ? 'its one division' : `its ${divisions} divisions`} to the lesion are drawn as the airway model has them, with the star on the branch that reaches the lesion. Drive with this map, or clear it and draw your own.`,
  }
}
export function planSummaryLines(summary: PlanSummary) {
  const lines: string[] = []
  const step = (label: string, part: PlanSummary['lesion']) => {
    if (part.asked)
      lines.push(
        `${label}: ${part.shown ? 'shown' : part.misses ? `${part.misses + 1} tries` : 'first try'}.`,
      )
  }
  step('Airway into the lesion', summary.lesion)
  step('Segment named', summary.segment)
  step('Ostium circle', summary.frame)
  if (summary.arcs.asked)
    lines.push(
      `Divisions drawn right at the first check: ${summary.arcs.firstTry} of ${summary.arcs.asked}.`,
    )
  return lines
}
