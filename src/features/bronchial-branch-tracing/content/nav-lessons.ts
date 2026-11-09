import type { CtNoduleTarget, CtTrace } from './ct-types'
import { optionLumenAreaMm2 } from '../engine/junction-feedback'
import type { NavPlan, NavStation, NavStep } from '../engine/nav-session'
import type { PlanPart } from '../engine/plan-session'
import type { TripPlan } from '../engine/trip-session'
import { mappedForks } from '../engine/arc-map'
import { CT_TARGETS, traceById } from '../geometry/native-ct'

/**
 * The lessons, built on the simplified bronchial branch tracing of Mortimer and Saghaie
 * (J Clin Med 2025;14:8009): plan from the lesion back to its segment, draw the segment's
 * ostium as a circle with four directions, draw each division to the lesion as arcs nested in
 * the arc before, then drive the scope with that map.
 *
 * A lesson is one or more *trips*. A trip can plan (some or all of the planning parts), drive
 * (a stretch of one route, from `from` to `through` or on to the lesion), or both, planning first.
 *
 * Levels, slice numbers and directions shown beside a fork are read from the route geometry at
 * run time, never typed here. The prose below says what to look for and why, and never says which
 * way a branch goes before the learner has drawn it.
 *
 * The scope's roll at each fork follows Kurimoto and Morita, Bronchial Branch Tracing (Springer
 * 2020), chapters 1 and 2.
 */
export interface NavStationSpec {
  /** Which steps to ask for here. */
  steps?: readonly NavStep[]
  /** The bench demonstrates this fork. */
  worked?: boolean
  /** Said once on arriving at this fork: what is different here and what to look for. */
  teach?: string
}
export interface PlanTripSpec {
  parts: readonly PlanPart[]
  /** The bench demonstrates: "Show me" leads at every check. */
  worked?: boolean
  /** Number the branches of each division on the CT while the map is drawn. */
  locators?: boolean
  /** Said at the start of each part. */
  teach?: Partial<Record<PlanPart, string>>
  /** Said at a mapped division, by checkpoint id. */
  divisions?: Readonly<Record<string, string>>
}
export interface NavTripSpec {
  traceId: string
  /** Short name on the trip list: "The carina". */
  title: string
  /** Said at the start of the trip. */
  intro: string
  /** Planning on the CT before the scope moves. */
  plan?: PlanTripSpec
  /** First fork of the drive, by checkpoint id. A trip without one plans and does not drive. */
  from?: string
  /** Last fork; defaults to the last fork of the route. */
  through?: string
  /** Drive on from the last fork to the end of the route, beside the lesion. */
  arrive?: boolean
  /** Ask for the openings to be marked on the CT at forks where they can be. */
  identify?: boolean
  /** Per fork, by checkpoint id. */
  stations?: Readonly<Record<string, NavStationSpec>>
  /** Opening names stay hidden until the learner has chosen. */
  independent?: boolean
  /** Every fork is demonstrated. */
  worked?: boolean
}
export interface NavLesson {
  id: string
  title: string
  minutes: number
  /** What the learner can do afterwards, in one sentence. */
  objective: string
  /** The one idea, in a sentence or two. */
  concept: string
  trips: readonly NavTripSpec[]
  /** Said on the closing screen. */
  closing: string
}

/** The trachea and a main bronchus: the first two forks of every route. */
export const CENTRAL_STATIONS = 2

/** A lumen smaller than this on its plane is not asked for: it cannot be clicked reliably. */
export const MIN_IDENTIFY_AREA_MM2 = 5

/**
 * Forks where an opening is a lumen about 2 mm wide that shows on the CT as a thin dark line, not
 * a ring: both branches of the last RB5a fork, and one branch at each of the two RB5a forks
 * before it, the three-way RB8 fork and the LB9 fork. Read off the images on October 10, 2026;
 * the owner decided the same day that these are chosen at, not marked.
 *
 * The area rule does not catch them. Lung beside these airways has pixels under the air
 * threshold, so the air region measured round the opening comes out larger than its lumen.
 */
export const THIN_LUMEN_FORKS: readonly string[] = [
  'junction-42',
  'junction-86',
  'junction-161',
  'junction-138',
  'junction-53',
]

/**
 * True when every opening of a fork can be clicked on its plane: each lumen is large enough,
 * and none is a thin line.
 */
export function identifiable(trace: CtTrace, checkpointIndex: number) {
  const checkpoint = trace.checkpoints[checkpointIndex]
  const options = checkpoint.decision?.options ?? []
  return (
    options.length > 0 &&
    !THIN_LUMEN_FORKS.includes(checkpoint.id) &&
    options.every((_, i) => optionLumenAreaMm2(trace, checkpointIndex, i) >= MIN_IDENTIFY_AREA_MM2)
  )
}

/**
 * The steps a fork is asked for when a trip that marks openings does not say. A fork whose lumens
 * are too small to click is only chosen at: the bench turns the CT there and numbers the openings.
 */
export function defaultSteps(trace: CtTrace, checkpointIndex: number): NavStep[] {
  return identifiable(trace, checkpointIndex) ? ['match', 'identify', 'choose'] : ['choose']
}
/** The steps at a fork on a drive that follows a map: the openings were read off the CT in planning. */
export const MAP_STEPS: readonly NavStep[] = ['match', 'choose']

export interface DriveOptions {
  /** The learner has shown they can turn the CT: no fork waits for it. */
  matchOptional: boolean
}

/** The route Practice and the closing set drive, after planning: every fork chosen at. */
export function routePlan(trace: CtTrace, options: DriveOptions): NavPlan {
  const stations: NavStation[] = []
  trace.checkpoints.forEach((checkpoint, checkpointIndex) => {
    if (checkpoint.decision) stations.push({ checkpointIndex, steps: MAP_STEPS })
  })
  return { traceId: trace.id, stations, arrive: true, matchOptional: options.matchOptional }
}

/** The lesion each route is planned to: the route a lesion opens (`content/targets.ts`). */
export const TARGET_FOR_TRACE: Readonly<Record<string, string>> = {
  'right-upper-apical': 'r-apical-anterior',
  'right-upper-distal': 'r-apical-posterior',
  'upper-oblique-lateral': 'r-anterior-upper',
  'upper-oblique-medial': 'r-anterior-lower',
  'middle-lobe-lateral': 'r-middle-lateral',
  'middle-lobe-cranial': 'r-middle-medial-a',
  'middle-lobe-caudal': 'r-middle-medial-b',
  'right-lower-basal': 'r-anterior-basal',
  'left-upper-division': 'l-apicoposterior',
  'left-upper-anterior': 'l-anterior',
  'left-lingula': 'l-inferior-lingula',
  'left-lower-returning': 'l-superior',
  'left-lower-basal': 'l-lateral-basal',
}
export function plannedTarget(trace: CtTrace): CtNoduleTarget {
  const target = CT_TARGETS.find((t) => t.id === TARGET_FOR_TRACE[trace.id])
  if (!target) throw new Error(`Route ${trace.id} has no lesion to plan to`)
  return target
}

export interface BuiltTrip {
  spec: NavTripSpec
  trace: CtTrace
  /** The lesion the route ends at; null only for a route that ends at none (central-right). */
  target: CtNoduleTarget | null
  trip: TripPlan
  /** Arrival text by station index. */
  teach: (string | undefined)[]
  /** Text at each mapped division, by division index. */
  divisionTeach: (string | undefined)[]
}
export function buildTrip(spec: NavTripSpec, options: DriveOptions): BuiltTrip {
  const trace = traceById(spec.traceId)
  const target = TARGET_FOR_TRACE[trace.id] ? plannedTarget(trace) : null
  if (spec.plan && !target)
    throw new Error(`Trip ${spec.traceId} plans, but its route has no lesion`)
  const divisions = spec.plan && target ? mappedForks(trace, target) : []
  for (const id of Object.keys(spec.plan?.divisions ?? {}))
    if (!divisions.some((ci) => trace.checkpoints[ci].id === id))
      throw new Error(`Trip ${spec.traceId} teaches ${id}, which its map does not draw`)
  const planSpec = spec.plan
    ? {
        traceId: trace.id,
        targetId: target!.id,
        parts: spec.plan.parts,
        worked: spec.plan.worked,
      }
    : null
  if (!spec.from) {
    if (!planSpec) throw new Error(`Trip ${spec.traceId} neither plans nor drives`)
    if (spec.stations || spec.arrive || spec.through)
      throw new Error(`Trip ${spec.traceId} plans only, but names forks to drive`)
    return {
      spec,
      trace,
      target,
      trip: { plan: planSpec, nav: null },
      teach: [],
      divisionTeach: divisions.map((ci) => spec.plan?.divisions?.[trace.checkpoints[ci].id]),
    }
  }
  const forks = trace.checkpoints
    .map((checkpoint, index) => ({ checkpoint, index }))
    .filter(({ checkpoint }) => checkpoint.decision)
  const first = forks.findIndex(({ checkpoint }) => checkpoint.id === spec.from)
  const last = spec.through
    ? forks.findIndex(({ checkpoint }) => checkpoint.id === spec.through)
    : forks.length - 1
  if (first < 0 || last < first)
    throw new Error(
      `Trip ${spec.traceId} ${spec.from}→${spec.through ?? 'end'} is not on its route`,
    )
  if (spec.arrive && last !== forks.length - 1)
    throw new Error(`Trip ${spec.traceId} arrives without driving through its last fork`)
  const chosen = forks.slice(first, last + 1)
  for (const id of Object.keys(spec.stations ?? {}))
    if (!chosen.some(({ checkpoint }) => checkpoint.id === id))
      throw new Error(`Trip ${spec.traceId} names ${id}, which it does not visit`)
  const nav: NavPlan = {
    traceId: trace.id,
    arrive: Boolean(spec.arrive),
    matchOptional: options.matchOptional,
    stations: chosen.map(({ checkpoint, index }) => {
      const station = spec.stations?.[checkpoint.id]
      return {
        checkpointIndex: index,
        steps: station?.steps ?? (spec.identify ? defaultSteps(trace, index) : MAP_STEPS),
        worked: station?.worked ?? spec.worked,
      }
    }),
  }
  return {
    spec,
    trace,
    target,
    trip: { plan: planSpec, nav },
    teach: chosen.map(({ checkpoint }) => spec.stations?.[checkpoint.id]?.teach),
    divisionTeach: divisions.map((ci) => spec.plan?.divisions?.[trace.checkpoints[ci].id]),
  }
}

/** The ostium circle, said the same way wherever it is taught. */
const OSTIUM_CHECKLIST =
  'Work out the circle in three steps. First, which way does the segment run from its ostium? That direction and its opposite are along your line of sight, so they are not on the circle. Second, read the other four off the CT: looking toward the head, the axial CT as drawn is the view; looking toward the feet, it is that CT mirrored; looking along the slice, stand facing that way with your head up, and your right-hand side is the circle’s right. Third, turn the circle to however you hold the scope, but never mirror it.'

export const NAV_LESSONS: readonly NavLesson[] = [
  {
    id: 'carina-orientation',
    title: 'Why the CT looks backwards',
    minutes: 7,
    objective:
      'Turn an axial CT so that it faces the way the bronchoscope does, looking down the trachea and looking up into the right upper lobe.',
    concept:
      'An axial CT is drawn as if you stood at the patient’s feet looking toward the head. A scope in the trachea looks the other way, so it sees the CT mirrored. A scope that has turned to look toward the head sees the CT the right way round.',
    trips: [
      {
        traceId: 'central-right',
        title: 'The carina',
        from: 'junction-1',
        through: 'junction-1',
        identify: true,
        intro:
          'The scope is in the lower trachea, looking down at the carina, held the ordinary way with anterior at the top. Beside it is the axial CT at the same level, as the radiologist displays it.',
        stations: {
          'junction-1': {
            steps: ['match', 'identify'],
            teach:
              'Look at the letters on both pictures. The scope shows the patient’s right on the right. The CT shows it on the left, because the CT is drawn from the feet. The two are mirror images, so one flip matches them. Once they match, an opening on the right of the scope is the lumen on the right of the CT.',
          },
        },
      },
      {
        traceId: 'right-upper-apical',
        title: 'Looking up into the right upper lobe',
        from: 'junction-14',
        through: 'junction-14',
        intro:
          'The scope has climbed into RB1, the apical bronchus of the right upper lobe. Two things changed: it now looks straight up toward the head, and it has rolled so the right chest wall is at the bottom of the view. Kurimoto and Morita display the right upper lobe this way.',
        stations: {
          'junction-14': {
            steps: ['match'],
            teach:
              'Looking toward the head is the direction the CT is drawn from, so this time there is nothing to mirror. The scope has only rolled: a quarter turn of the CT puts R at the bottom, where the scope has it.',
          },
        },
      },
    ],
    closing:
      'Looking down an airway, the CT is mirrored. Looking up an airway, it is not; it only needs turning. From the next lesson on, turning the CT is your choice: keep it as the radiologist shows it and turn it in your head, or turn it on the screen.',
  },
  {
    id: 'two-levels',
    title: 'Two openings, two slices',
    minutes: 8,
    objective:
      'Find both daughters of a fork on the CT when they lie on different slices, and drive into the one that leads toward the lesion.',
    concept:
      'The scope shows both openings of a fork in one view. The CT shows one level at a time, and the two daughters usually leave the fork at different levels. You find each by scrolling from the parent until its lumen separates.',
    trips: [
      {
        traceId: 'central-right',
        title: 'Right main bronchus to the middle lobe bronchus',
        from: 'junction-2',
        through: 'junction-10',
        identify: true,
        intro:
          'The lesion is in the medial segment of the middle lobe. The scope is in the right main bronchus. You will work two forks and drive through each.',
        stations: {
          'junction-2': {
            teach:
              'The right main bronchus divides into the right upper lobe bronchus and the bronchus intermedius. The upper lobe bronchus leaves sideways, above the fork; the bronchus intermedius carries on down, below it. No single slice shows both as separate lumens, so each is identified on its own slice.',
          },
          'junction-5': {
            teach:
              'The bronchus intermedius divides into the middle lobe bronchus in front and the lower lobe bronchus behind. Both lie just below the fork, a few slices apart. In the scope the middle lobe opening is the upper one, because anterior is at the top.',
          },
          'junction-10': { steps: [] },
        },
      },
    ],
    closing:
      'A fork on the CT is a few slices deep, not one picture. Scroll from the parent until a wall appears between two lumens; each daughter is named on the slice where it stands alone. Every map you draw from here on is built from that scrolling.',
  },
  {
    id: 'start-at-the-lesion',
    title: 'Start at the lesion',
    minutes: 8,
    objective:
      'Find the airway that runs into a peripheral lesion on the CT, follow it back to its segmental bronchus, and name that bronchus.',
    concept:
      'A route is planned backwards. The lesion is the fixed point; the airway that enters it is the first thing to find. Following that airway toward the hilum, slice by slice, tells you which segment the route lies in, and the map starts at that segment’s ostium.',
    trips: [
      {
        traceId: 'right-upper-apical',
        title: 'A lesion in the right upper lobe',
        intro:
          'The lesion is drawn on the CT in the right upper lobe. The scope plays no part yet: this is the work done on the CT before the procedure.',
        plan: {
          parts: ['lesion', 'segment'],
          teach: {
            lesion:
              'Scroll through the lesion and look for an airway that runs into it: a bronchus sign. The airways out here are a millimeter or two across, which is why planning uses thin slices. Where the wall of a larger airway shows a break, a small branch leaves through it. A small pulmonary artery runs beside each airway; where the airway is hard to see, follow the artery. Click the airway where it runs into the lesion.',
            segment:
              'Now follow that airway back toward the hilum, a slice at a time, keeping it in view as it joins larger airways. Stop at the segmental bronchus: the largest airway on the way back that still supplies this segment alone. Beyond it the airway joins the lobar bronchus, or a trunk it shares with other segments. Its ostium is where the map will start. Name it.',
          },
        },
      },
      {
        traceId: 'middle-lobe-caudal',
        title: 'A lesion in the middle lobe',
        intro:
          'The same two steps, on a lesion in another lobe. Help is there if you want it, but try it on your own first.',
        plan: { parts: ['lesion', 'segment'] },
      },
    ],
    closing:
      'Every plan starts here: the airway into the lesion, traced back to its segment. If there is no bronchus sign, choose the airway that gives the best approach to the lesion and trace that one.',
  },
  {
    id: 'stand-at-the-ostium',
    title: 'Stand at the ostium',
    minutes: 8,
    objective:
      'Picture the bronchoscopic view at a segmental ostium and label the four directions around it, without mirroring them.',
    concept:
      'Imagine the scope at the ostium of the segment, looking in. The map starts as a circle: the view into that ostium, with the four directions that lie across it written round the edge. How you hold the scope decides where the circle starts; it never decides which way round it goes.',
    trips: [
      {
        traceId: 'right-upper-apical',
        title: 'RB1: looking up',
        intro:
          'The lesion you traced in the last lesson lies in RB1, the apical segment of the right upper lobe. Stand at the RB1 ostium and look in.',
        plan: {
          parts: ['frame'],
          teach: {
            frame: `${OSTIUM_CHECKLIST} Label the four places round the circle, then check.`,
          },
        },
      },
      {
        traceId: 'left-upper-division',
        title: 'LB1+2: looking up on the left',
        intro:
          'Now the left side: LB1+2, the apicoposterior segment of the left upper lobe. It also runs up toward the head.',
        plan: {
          parts: ['frame'],
          teach: {
            frame:
              'The same three steps. Compare your answer with RB1’s when you have checked it: what stayed in place, and what changed sides?',
          },
        },
      },
      {
        traceId: 'middle-lobe-caudal',
        title: 'RB5: looking along the slice',
        intro:
          'RB5, the medial segment of the middle lobe, runs forward almost in the plane of the CT. Stand at its ostium and look in.',
        plan: { parts: ['frame'] },
      },
    ],
    closing:
      'The circle is the view into the ostium. Up or down the airway, the axial CT gives it to you directly or mirrored; along the slice, face the way the segment runs with your head up. Any roll is yours to choose. From here on, turning the CT on screen is optional: the circle is where orientation now lives.',
  },
  {
    id: 'nested-arcs',
    title: 'Draw the map',
    minutes: 10,
    objective:
      'Draw each division from a segmental ostium to a lesion as arcs nested inside the arc before it, and mark the branch that reaches the lesion.',
    concept:
      'At each division the airway splits in two, sometimes three. Draw each branch as an arc on the side of the circle it leaves toward, relative to its sibling, and draw the next division inside the arc of the branch that goes on. The map does not need to be exact: it needs each branch on the right side of its sibling.',
    trips: [
      {
        traceId: 'right-upper-apical',
        title: 'RB1 to the lesion',
        intro:
          'Back to the RB1 lesion. Set up the circle again, then draw the divisions from the RB1 ostium to the lesion.',
        plan: {
          parts: ['frame', 'arcs'],
          locators: true,
          teach: {
            frame: 'The same circle as before, in whatever roll you chose.',
            arcs: 'At each division, scroll the CT from the fork until the branches separate; the numbers on the CT mark them. For each branch, ask which way it moves compared with the other, and click that side of the current arc on the map. Then mark the branch that goes on toward the lesion: it is the airway you followed back from the lesion.',
          },
          divisions: {
            'junction-14':
              'The first division of RB1, seen end-on: scrolling toward the head, one ring becomes two. Watch which way each ring moves as you scroll.',
            'junction-61':
              'The last division before the lesion. When you mark the branch that reaches it, the map puts the star there.',
          },
        },
      },
      {
        traceId: 'right-upper-distal',
        title: 'The same ostium, another lesion',
        intro:
          'A second lesion in the same segment. The circle is the same; the branches you follow are not. The CT numbers are off: find the branches yourself.',
        plan: { parts: ['frame', 'arcs'] },
      },
    ],
    closing:
      'A map is a circle, an arc for every branch at every division, and a star. Number the divisions in the order you will meet them; that is the order the scope will show them.',
  },
  {
    id: 'drive-with-the-map',
    title: 'Drive with the map',
    minutes: 9,
    objective:
      'Drive the scope from the trachea to a lesion using your map past the segmental ostium, and recognize and back out of a branch that leads away.',
    concept:
      'Above the segment you navigate by naming airways you know. From the segmental ostium the map takes over: at each division, find the arc that holds the star and take the opening on that side. A branch that leads away shows a division that is not on your map; that is the signal to back out.',
    trips: [
      {
        traceId: 'right-upper-apical',
        title: 'Trachea to the RB1 lesion',
        intro:
          'The RB1 lesion again. Draw its map, then drive from the trachea. At the second division past the ostium, take the branch that leads away on purpose this once, to see what it looks like.',
        plan: { parts: ['frame', 'arcs'] },
        from: 'junction-1',
        arrive: true,
        stations: {
          'junction-14': {
            teach:
              'You are at the RB1 ostium: the view your circle drew. From here, match each division to the map.',
          },
          'junction-30': {
            teach:
              'Take the opening that does not hold the star. Look at the division that comes into view and compare it with your map: nothing on the map is drawn there. Back out to this fork.',
          },
          'junction-61': {
            teach:
              'The scope has turned as it went deeper, so the map may sit rotated against the view. Turn the map to the scope, or turn it in your head; either works, as long as you do it before you choose.',
          },
        },
      },
    ],
    closing:
      'Past the segment, the map chooses for you. When the view stops matching it, back out to the last division you are sure of and look again.',
  },
  {
    id: 'views-that-help',
    title: 'Views that help',
    minutes: 10,
    objective:
      'Use a coronal or sagittal reconstruction beside the axial CT to see a segment that runs forward, backward or out toward the chest wall, and map it.',
    concept:
      'An axial slice cuts across the airways that run up and down, so scrolling it shows each division as one ring becoming two. A segment that runs forward or back is cut across by a coronal reconstruction instead, and one that runs out toward the chest wall by a sagittal. Mortimer and Saghaie suggest a pairing for each segment; take it as a starting point and use whatever shows the airway.',
    trips: [
      {
        traceId: 'upper-oblique-medial',
        title: 'A lesion in the right upper lobe',
        intro:
          'Another lesion in the right upper lobe. Plan it from the lesion; once you have named its segment, open a reconstruction before you draw the map.',
        plan: {
          parts: ['lesion', 'segment', 'views', 'frame', 'arcs'],
          teach: {
            views:
              'Open the coronal view beside the axial CT and scroll it to the segment. A click on it moves the axial CT to the same place. Turn the axial CT too if that helps you; none of this is checked.',
          },
        },
      },
      {
        traceId: 'middle-lobe-lateral',
        title: 'A lesion in the middle lobe',
        intro:
          'A lesion in the middle lobe. Plan it the same way, and choose your own views this time.',
        plan: { parts: ['lesion', 'segment', 'views', 'frame', 'arcs'] },
      },
    ],
    closing:
      'Use the views that show the airway. The suggested pairing is a start, not a rule: anatomy varies and so do the bronchoscopists reading it.',
  },
  {
    id: 'turn-back',
    title: 'A route that comes back up',
    minutes: 9,
    objective:
      'Plan, map and drive to a lower-lobe lesion whose route runs down and then turns back toward the head.',
    concept:
      'A route can run down and then turn back toward the head. The slice numbers reverse; the airway connection does not. Tracing back from the lesion follows the connection, so the reversal does not mislead you.',
    trips: [
      {
        traceId: 'left-lower-returning',
        title: 'A lesion in the left lower lobe',
        intro:
          'The lesion is in the left lower lobe, yet it lies above the fork where the left main bronchus divides into its lobes. Plan it from the lesion, then drive.',
        plan: { parts: ['lesion', 'segment', 'frame', 'arcs'] },
        from: 'junction-1',
        arrive: true,
        stations: {
          'junction-3': {
            teach:
              'The lesion is in the lower lobe, but look at its slice: it is above this fork. Do not let the level decide for you. Decide by which lobe it is in.',
          },
          'junction-6': {
            teach:
              'The lower lobe bronchus gives off LB6 from its back wall, while the basal trunk carries on down. The lesion’s segment is the one you named in planning.',
          },
        },
      },
    ],
    closing:
      'Follow the connection, whichever way the slice numbers run. A plan made from the lesion back already has the connection in it.',
  },
  {
    id: 'navigate',
    title: 'Plan and navigate',
    minutes: 10,
    objective: 'Plan, map and drive a whole route from the trachea to a peripheral lesion.',
    concept:
      'The whole method, start to finish: the airway into the lesion, back to its segment, the circle at the ostium, the arcs to the lesion, then the drive.',
    trips: [
      {
        traceId: 'middle-lobe-cranial',
        title: 'Worked: a lesion in the middle lobe',
        intro:
          'The bench works this one from the lesion to the scope’s arrival. Step through it and watch what it reads at each step.',
        plan: { parts: ['lesion', 'segment', 'frame', 'arcs'], worked: true },
        from: 'junction-1',
        arrive: true,
        worked: true,
      },
      {
        traceId: 'left-lower-basal',
        title: 'Yours: a lesion in the left lower lobe',
        intro: 'Your turn. The openings are numbered but not named until you have chosen.',
        plan: { parts: ['lesion', 'segment', 'frame', 'arcs'] },
        from: 'junction-1',
        arrive: true,
        independent: true,
      },
    ],
    closing:
      'That is the method: from the lesion back to the segment, a circle at the ostium, an arc for every branch, then the drive. Practice has thirteen lesions to plan and reach the same way.',
  },
]

export const lessonById = (id: string | undefined) => NAV_LESSONS.find((l) => l.id === id)
export const lessonNumber = (id: string) => NAV_LESSONS.findIndex((l) => l.id === id) + 1
export const lessonAfter = (id: string) =>
  NAV_LESSONS[NAV_LESSONS.findIndex((l) => l.id === id) + 1]
export const totalMinutes = () => NAV_LESSONS.reduce((sum, lesson) => sum + lesson.minutes, 0)

/** Lesson groups for the hub, by lesson id. */
export const LESSON_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Reading the CT against the scope', ids: ['carina-orientation', 'two-levels'] },
  {
    label: 'Planning from the lesion',
    ids: ['start-at-the-lesion', 'stand-at-the-ostium', 'nested-arcs'],
  },
  { label: 'Driving with the map', ids: ['drive-with-the-map', 'views-that-help'] },
  { label: 'The whole method', ids: ['turn-back', 'navigate'] },
]
/** Turning the CT is required in this lesson, whatever the learner has shown before. */
export const ORIENTATION_LESSON = 'carina-orientation'
