import type { SuiteViewSpec } from '../components/suite/types'
import type { LabValues } from '../engine/labMetrics'
import {
  AIRWAY_DRILL_CASES,
  DRILL_NODULE_BRONCHUS,
  DRILL_ORBIT_LIMIT,
  drillFrontalSide,
  drillShift,
  type AirwayDrillCase,
  type DrillAnswer,
} from '../lib/airwayDrill'
import { airwayRouteKeys, nearestAirway } from '../lib/airwayTree'
import { LESION_CENTER } from '../lib/physics'
import { AIRWAY_BRANCHES, type AirwayBranchKey } from './airwayNames'
import { imagingLearnerCopyErrors } from './learnerCopy'
import type { ImagingSectionId } from './pathway'
import { PERIPHERAL_IMAGING_PRACTICE_HREF } from './routes'
import { suiteViewForStep } from './suiteViews'

/**
 * The words and the screen of the drill "Where is the nodule from the catheter tip?".
 *
 * The positions and their geometry are `lib/airwayDrill.ts`. Nothing here is typed in about a
 * position: the feedback is composed from its computed distances and from which way the nodule
 * moves on the image, so it cannot disagree with what the learner was shown.
 */
export const AIRWAY_DRILL = {
  title: 'Where is the nodule from the catheter tip?',
  /** One line for the Practice list. */
  summary: `The catheter is in a neighbouring bronchus. Turn the C-arm up to ${DRILL_ORBIT_LIMIT}° either way and place the nodule in front of or behind the tip, medial or lateral to it.`,
  situation: `A catheter has been advanced beyond the view of the bronchoscope toward the nodule in the left lower lobe, and its tip has stopped in a bronchus that does not reach it. The room allows the C-arm ${DRILL_ORBIT_LIMIT}° of obliquity either way.`,
  question: 'Where does the nodule lie from the catheter tip?',
  method:
    'Read the side from the frontal image. Then turn the C-arm and watch which way the nodule moves against the tip.',
  /** The section whose step teaches the reading this drill asks for. */
  conceptSectionId: 'projection' as ImagingSectionId,
  imageLegend:
    'White line: the catheter, drawn to its tip. Amber contour: the nodule. No bronchus is drawn until you have answered.',
  revealLegend:
    'White line: the catheter. Amber contour: the nodule. The coloured bronchi are the ones that cross the nodule on the frontal image.',
} as const

export const DRILL_ANSWER_LABELS: Readonly<Record<DrillAnswer, string>> = {
  'anterior-medial': 'Anterior and medial to the tip',
  'anterior-lateral': 'Anterior and lateral to the tip',
  'posterior-medial': 'Posterior and medial to the tip',
  'posterior-lateral': 'Posterior and lateral to the tip',
}

const mm = (value: number) => Math.round(Math.abs(value))
const lower = (key: AirwayBranchKey) => {
  const { name, level, short } = AIRWAY_BRANCHES[key]
  return level === 'segment' ? short : name.toLowerCase()
}

/** The named bronchi from the trachea to the nodule. */
const NODULE_ROUTE = airwayRouteKeys(nearestAirway(LESION_CENTER).branch)

export interface DrillDebrief {
  /** Where the nodule lies from the tip, in millimetres. */
  readonly position: string
  /** How the frontal image gives the side. */
  readonly side: string
  /** How the rotation gives the depth. */
  readonly depth: string
  /** Which bronchus the catheter is in, and where to go from there. */
  readonly next: string
}

export function drillDebrief(entry: AirwayDrillCase): DrillDebrief {
  const [depth, side] = entry.answer.split('-') as ['anterior' | 'posterior', 'medial' | 'lateral']
  const height =
    Math.abs(entry.superiorMm) >= 5
      ? `, and ${mm(entry.superiorMm)} mm ${entry.superiorMm > 0 ? 'above' : 'below'} it`
      : ''
  const lao = drillShift(entry, -DRILL_ORBIT_LIMIT)
  const rao = drillShift(entry, DRILL_ORBIT_LIMIT)
  // In the left lung a move toward the patient's left on the image is a move toward the chest wall.
  const toward = (shift: number) => (shift > 0 ? 'toward the chest wall' : 'toward the midline')
  const landmark = depth === 'anterior' ? 'heart' : 'spine'
  const afterShared = NODULE_ROUTE.slice(NODULE_ROUTE.indexOf(entry.sharedBronchus) + 1)
  const next =
    entry.sharedBronchus === DRILL_NODULE_BRONCHUS
      ? `The catheter is in ${DRILL_NODULE_BRONCHUS}, the bronchus that leads to the nodule, in a neighbouring branch of it. Withdraw to the last division and take the branch that runs ${depth === 'anterior' ? 'anteriorly' : 'posteriorly'} and ${side === 'medial' ? 'medially' : 'laterally'}.`
      : `The catheter is in ${lower(entry.bronchus)}. The nodule is reached through ${DRILL_NODULE_BRONCHUS}: withdraw to the ${lower(entry.sharedBronchus)}, then take ${afterShared.map((key) => (AIRWAY_BRANCHES[key].level === 'segment' ? lower(key) : `the ${lower(key)}`)).join(' and ')}.`
  return {
    position: `The nodule lies ${mm(entry.anteriorMm)} mm ${depth} and ${mm(entry.lateralMm)} mm ${side} to the catheter tip${height}.`,
    side: `Side, from the frontal image: the nodule is drawn ${drillFrontalSide(entry) === 'lateral' ? 'further from' : 'nearer'} the midline than the tip.`,
    depth: `Depth, from the rotation: at LAO ${DRILL_ORBIT_LIMIT}° the nodule moved about ${mm(lao)} mm on the detector ${toward(lao)} against the tip, the way the ${landmark} moves, and at RAO ${DRILL_ORBIT_LIMIT}° about ${mm(rao)} mm ${toward(rao)}. What moves with the ${landmark} lies ${depth === 'anterior' ? 'in front' : 'behind'}.`,
    next,
  }
}

/** What the learner is told about their own answer, half by half. */
export function drillVerdict(entry: AirwayDrillCase, chosen: DrillAnswer): string {
  const [depth, side] = entry.answer.split('-')
  const [chosenDepth, chosenSide] = chosen.split('-')
  const label = DRILL_ANSWER_LABELS[entry.answer].toLowerCase()
  if (chosen === entry.answer) return `Yes: the nodule lies ${label}.`
  if (chosenSide === side)
    return `The side is as you read it, the depth is not: the nodule lies ${label}.`
  if (chosenDepth === depth)
    return `The depth is as you read it, the side is not: the nodule lies ${label}.`
  return `Neither the depth nor the side: the nodule lies ${label}.`
}

export function airwayDrillLinkTarget(id: string): {
  readonly pathname: string
  readonly query: Record<string, string>
} {
  return { pathname: PERIPHERAL_IMAGING_PRACTICE_HREF, query: { drill: id } }
}

/**
 * The suite for one position. Before an answer the image stands alone: no 3D view, no bronchi and
 * no readout, because each of them shows the depth the learner is being asked for. After it the
 * 3D view opens close on the nodule with the bronchi drawn.
 */
export function airwayDrillView(): SuiteViewSpec {
  const base = suiteViewForStep('projection')
  return {
    ...base,
    litStop: null,
    stopSentence: '',
    camera: 'target',
    bindings: [
      ...base.bindings.filter((binding) => binding.input !== 'orbit'),
      { input: 'orbit', control: 'drillOrbit' },
      { input: 'drillCase', control: 'drillCase' },
    ],
    defaults: { ...base.defaults, showTool: false },
    controls: ['drillOrbit'],
    readouts: [],
  }
}

export function airwayDrillValues(
  entry: AirwayDrillCase,
  orbit: number,
  revealed: boolean,
): LabValues {
  return {
    drillOrbit: orbit,
    drillCase: entry.id,
    airways: revealed ? 'lesion' : 'off',
    airwayNames: true,
    tilt: 0,
  }
}

const copyErrors = [
  ...Object.entries(AIRWAY_DRILL).flatMap(([key, value]) =>
    key === 'conceptSectionId' ? [] : imagingLearnerCopyErrors(`Airway drill ${key}`, value),
  ),
  ...Object.entries(DRILL_ANSWER_LABELS).flatMap(([key, value]) =>
    imagingLearnerCopyErrors(`Airway drill answer ${key}`, value),
  ),
  ...AIRWAY_DRILL_CASES.flatMap((entry) => [
    ...Object.entries(drillDebrief(entry)).flatMap(([key, value]) =>
      imagingLearnerCopyErrors(`Airway drill ${entry.id} ${key}`, value),
    ),
    ...(['anterior-medial', 'anterior-lateral', 'posterior-medial', 'posterior-lateral'] as const)
      .map((answer) => drillVerdict(entry, answer))
      .flatMap((value) => imagingLearnerCopyErrors(`Airway drill ${entry.id} verdict`, value)),
  ]),
]
if (copyErrors.length > 0)
  throw new Error(`The airway drill's copy is invalid:\n${copyErrors.join('\n')}`)
