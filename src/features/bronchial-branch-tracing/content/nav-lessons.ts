import type { CtTrace } from './ct-types'
import { optionLumenAreaMm2 } from '../engine/junction-feedback'
import type { NavPlan, NavStation, NavStep } from '../engine/nav-session'
import { traceById } from '../geometry/native-ct'

/**
 * The lessons: eight short trips of the scope, each teaching one idea about reading a route off
 * the CT.
 *
 * A lesson is one or more *trips*. A trip is a stretch of one route: the forks from `from` to
 * `through` (or to the end of the route when it arrives at the lesion). At each fork the learner
 * matches the CT to the scope, identifies the openings on the CT, chooses the one toward the
 * lesion and drives on. A trip can ask for fewer steps at a fork; the bench does the rest.
 *
 * Levels, slice numbers and directions shown beside a fork are read from the route geometry at
 * run time, never typed here. The prose below says what to look for and why.
 *
 * Source for the method, the four fork patterns and the subsegment letters: Kurimoto & Morita,
 * Bronchial Branch Tracing (Springer 2020), chapters 1 and 2.
 */
export interface NavStationSpec {
  /** Which steps to ask for here; the default asks for every step the fork supports. */
  steps?: readonly NavStep[]
  /** The bench demonstrates this fork. */
  worked?: boolean
  /** Said once on arriving at this fork: what is different here and what to look for. */
  teach?: string
}
export interface NavTripSpec {
  traceId: string
  /** Short name on the trip list: "The carina". */
  title: string
  /** First fork of the trip, by checkpoint id. */
  from: string
  /** Last fork; defaults to the last fork of the route. */
  through?: string
  /** Drive on from the last fork to the end of the route, beside the lesion. */
  arrive?: boolean
  /** Said at the start of the trip. */
  intro: string
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
  /** The Kurimoto & Morita fork pattern this lesson carries, where it carries one. */
  pattern?: string
  trips: readonly NavTripSpec[]
  /** Said on the closing screen. */
  closing: string
}

/** The trachea and a main bronchus: the first two forks of every route. */
export const CENTRAL_STATIONS = 2

/** A lumen smaller than this on its plane is not asked for: it cannot be clicked reliably. */
export const MIN_IDENTIFY_AREA_MM2 = 5

/** True when every opening of a fork has a lumen large enough to be clicked on its plane. */
export function identifiable(trace: CtTrace, checkpointIndex: number) {
  const options = trace.checkpoints[checkpointIndex].decision?.options ?? []
  return (
    options.length > 0 &&
    options.every((_, i) => optionLumenAreaMm2(trace, checkpointIndex, i) >= MIN_IDENTIFY_AREA_MM2)
  )
}

/**
 * The steps a fork is asked for when a trip does not say. A fork whose lumens are too small to
 * click is only chosen at: the bench turns the CT there and letters the openings.
 */
export function defaultSteps(trace: CtTrace, checkpointIndex: number): NavStep[] {
  return identifiable(trace, checkpointIndex) ? ['match', 'identify', 'choose'] : ['choose']
}

/**
 * A whole route from the trachea to the lesion, as Practice and Assess run it. The trachea and
 * main bronchus are chosen, not marked: they are the same two forks on every route.
 */
export function routePlan(trace: CtTrace): NavPlan {
  const stations: NavStation[] = []
  trace.checkpoints.forEach((checkpoint, checkpointIndex) => {
    if (!checkpoint.decision) return
    stations.push({
      checkpointIndex,
      steps:
        checkpointIndex < CENTRAL_STATIONS
          ? ['match', 'choose']
          : defaultSteps(trace, checkpointIndex),
    })
  })
  return { traceId: trace.id, stations, arrive: true }
}

export interface BuiltTrip {
  spec: NavTripSpec
  trace: CtTrace
  plan: NavPlan
  /** Arrival text by station index. */
  teach: (string | undefined)[]
}
export function buildTrip(spec: NavTripSpec): BuiltTrip {
  const trace = traceById(spec.traceId)
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
  return {
    spec,
    trace,
    plan: {
      traceId: trace.id,
      arrive: Boolean(spec.arrive),
      stations: chosen.map(({ checkpoint, index }) => {
        const station = spec.stations?.[checkpoint.id]
        return {
          checkpointIndex: index,
          steps: station?.steps ?? defaultSteps(trace, index),
          worked: station?.worked ?? spec.worked,
        }
      }),
    },
    teach: chosen.map(({ checkpoint }) => spec.stations?.[checkpoint.id]?.teach),
  }
}

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
      'Looking down an airway, flip the CT. Looking up an airway, do not flip it; turn it until the letters agree. Every fork from here on starts with that check.',
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
        intro:
          'The lesion is in the medial segment of the middle lobe. The scope is in the right main bronchus. You will work two forks and drive through each.',
        stations: {
          'junction-2': {
            teach:
              'The right main bronchus divides into the right upper lobe bronchus and the bronchus intermedius. The upper lobe bronchus leaves sideways, above the fork; the bronchus intermedius carries on down, below it. No single slice shows both as separate lumens, so each is identified on its own slice.',
          },
          'junction-5': {
            teach:
              'The bronchus intermedius divides into the middle lobe bronchus in front and the lower lobe bronchus behind. Both lie just below the fork, a few slices apart. In the scope the middle lobe opening is the upper one, because anterior is at the top; on the matched CT it is the lumen nearer the top of the image.',
          },
          'junction-10': { steps: [] },
        },
      },
    ],
    closing:
      'A fork on the CT is a few slices deep, not one picture. Scroll from the parent until a wall appears between two lumens; each daughter is named on the slice where it stands alone.',
  },
  {
    id: 'middle-lobe-flat',
    title: 'A fork that lies in one slice',
    minutes: 8,
    objective:
      'Trace a horizontal bronchus and its horizontal daughters across a single CT slice, and reach a lesion in the lateral segment of the middle lobe.',
    concept:
      'A bronchus that runs in the plane of the CT is seen as a channel, not a ring. When its daughters are horizontal too, scrolling does not separate them: they separate side to side within the slice.',
    pattern: 'Horizontal–horizontal',
    trips: [
      {
        traceId: 'middle-lobe-lateral',
        title: 'Middle lobe bronchus to the lateral segment',
        from: 'junction-10',
        arrive: true,
        intro:
          'The lesion is in the lateral segment of the middle lobe, RS4. The scope is in the middle lobe bronchus, which runs forward and outward almost in the plane of the CT.',
        stations: {
          'junction-10': {
            teach:
              'Here the scope looks along the slice, not through it, with the head at the top of its view. The CT cannot show head and feet as sides; it shows them as slice level. Both daughters lie on the same slice and part side to side: RB4 runs outward toward the chest wall, RB5 runs on forward.',
          },
          'junction-19': {
            teach:
              'RB4 divides again in the same plane, and the scope has turned to look straight out toward the chest wall. Front and back are now its left and right, so the CT takes a quarter turn. Scrolling will not separate these two either: follow each channel across the image from the fork.',
          },
        },
      },
    ],
    closing:
      'For a horizontal–horizontal fork, stay on the slice and follow the channels sideways. The scope’s left and right are the CT’s left and right once the letters agree; its up and down are slice level.',
  },
  {
    id: 'rb5-up-or-down',
    title: 'One daughter climbs, one drops',
    minutes: 7,
    objective:
      'Tell the two daughters of a horizontal bronchus apart by slice level, and reach a lesion through each.',
    concept:
      'Seen along a horizontal parent, one daughter can sit above the other. The CT shows that as a difference in level: the upper opening is found by scrolling toward the head, the lower by scrolling toward the feet.',
    pattern: 'Horizontal–vertical',
    trips: [
      {
        traceId: 'middle-lobe-caudal',
        title: 'RB5 to the lower subsegment',
        from: 'junction-20',
        arrive: true,
        worked: true,
        intro:
          'The scope is in RB5, the medial segmental bronchus of the middle lobe. This lesion is reached through RB5b, the daughter that drops. Watch the bench work this trip; the next one is yours.',
        stations: {
          'junction-20': {
            teach:
              'RB5 runs forward and the scope looks along it, with the head at the top. It divides into RB5a, which carries on forward, and RB5b, which drops toward the feet. In the scope RB5a is the upper opening and RB5b the lower. On the CT that is a difference in level: RB5a is found a few slices toward the head, RB5b a few toward the feet.',
          },
        },
      },
      {
        traceId: 'middle-lobe-cranial',
        title: 'RB5 to the upper subsegment',
        from: 'junction-20',
        arrive: true,
        intro:
          'The same fork, a different lesion: this one is reached through RB5a, the daughter that carries on forward.',
        stations: {
          'junction-20': {
            teach:
              'The same two openings as before. This time the lesion lies a little above the fork’s level, not below it. Find each daughter on its own slice, then decide which one heads for the lesion’s level.',
          },
        },
      },
    ],
    closing:
      'When the scope shows one opening above another, the CT answer is in the slice numbers. The lesion’s own slice tells you which daughter to take.',
  },
  {
    id: 'look-up-rul',
    title: 'Looking up into the right upper lobe',
    minutes: 9,
    objective:
      'Re-match the CT when the scope turns up into the right upper lobe, and follow a vertical bronchus to a lesion in the apical segment.',
    concept:
      'A bronchus that runs straight up or down crosses slice after slice as a small round lumen. Its fork is seen end-on: one ring becomes two as you scroll.',
    pattern: 'Vertical',
    trips: [
      {
        traceId: 'right-upper-apical',
        title: 'Right main bronchus to the apical segment',
        from: 'junction-2',
        arrive: true,
        intro:
          'The lesion is in the apical segment of the right upper lobe, RS1. The scope starts in the right main bronchus, looking down, so the first job is to flip the CT.',
        stations: {
          'junction-2': {
            steps: ['match', 'choose'],
            teach:
              'You worked this fork in the last lesson. The lesion is high in the right lung: decide which opening goes up.',
          },
          'junction-4': {
            teach:
              'The scope has turned sideways into the upper lobe bronchus. It is looking out toward the right chest wall, along the slice, with the head at the top of its view. The mirrored CT no longer matches: turn it until front and back sit where the scope has them.',
          },
          'junction-7': {
            teach:
              'The scope is climbing now and has rolled so the right chest wall is at the bottom of its view: the display Kurimoto and Morita use for the right upper lobe. RB2 runs backward in the plane of this slice; RB1 climbs toward the apex. Scroll toward the head and RB1 is the lumen that keeps going.',
          },
          'junction-14': {
            teach:
              'A vertical fork, seen end-on. Scroll toward the head and one ring becomes two. Kurimoto and Morita name the posterior one RB1a and the anterior one RB1b.',
          },
        },
      },
    ],
    closing:
      'Entering an upper lobe the scope first looks sideways along the slice, then up toward the head. Each time its view turns, turn the CT until the letters agree. A vertical bronchus is traced as a ring that holds its place from slice to slice.',
  },
  {
    id: 'oblique',
    title: 'Daughters that move across and up',
    minutes: 9,
    objective:
      'Follow an oblique daughter that moves across the image and through the stack at once, on the right and on the left.',
    concept:
      'An oblique branch leaves a horizontal parent with both sideways and up-or-down motion. On the CT its lumen walks across the image as you scroll. The left upper division is displayed with the opposite quarter turn to the right upper lobe.',
    pattern: 'Horizontal–oblique',
    trips: [
      {
        traceId: 'upper-oblique-lateral',
        title: 'RB3 to the anterior segment',
        from: 'junction-8',
        arrive: true,
        intro:
          'The lesion is in the anterior segment of the right upper lobe, RS3. The scope is in RB3, which runs forward and outward almost in the plane of the CT.',
        stations: {
          'junction-8': {
            teach:
              'RB3 is horizontal, so the scope looks along the slice with the head at the top. Both openings are on the same slice here: one carries on forward, the other turns out toward the chest wall.',
          },
          'junction-16': {
            teach:
              'Now the daughters part by level: one climbs as it runs outward, the other drops. In the scope they are one above the other. Scroll a few slices each way from the fork and watch each lumen move across the image.',
          },
        },
      },
      {
        traceId: 'left-upper-division',
        title: 'Left main bronchus to the upper division',
        from: 'junction-3',
        through: 'junction-47',
        intro:
          'Now the left side. The lesion is in the apicoposterior segment, LS1+2. The scope starts in the left main bronchus.',
        stations: {
          'junction-3': {
            steps: ['match', 'choose'],
            teach:
              'The left main bronchus divides into the upper lobe bronchus, which runs outward and forward, and the lower lobe bronchus, which runs down and back. The lesion is high in the left lung.',
          },
          'junction-21': {
            teach:
              'The scope has turned into the left upper lobe bronchus and is looking outward and forward, along the slice, with the head at the top. It is at an angle to both of the CT’s axes, so the CT is set to the book’s display for the left upper division: a quarter turn clockwise, with front and back where the scope has them. Separate the two openings: the upper division climbs, the lingular bronchus LB4+5 drops.',
          },
          'junction-23': {
            teach:
              'The scope is now looking up the upper division with the left chest wall at the bottom of its view: the mirror image of the right upper lobe display. LB3 runs forward; LB1+2 climbs up and back. Each lumen moves across the image as you scroll toward the head.',
          },
          'junction-47': { steps: [] },
        },
      },
    ],
    closing:
      'An oblique daughter is traced by scrolling and following: its lumen moves a little each slice. Right upper lobe and left upper division take opposite quarter turns, each with its own chest wall at the bottom.',
  },
  {
    id: 'turn-back',
    title: 'A route that comes back up',
    minutes: 8,
    objective:
      'Follow a route whose slice direction reverses, and recognise from the scope when the CT is no longer mirrored.',
    concept:
      'A route can run down and then turn back toward the head. The slice numbers reverse; the airway connection does not. When the scope turns to look toward the head, the flip comes off the CT.',
    trips: [
      {
        traceId: 'left-lower-returning',
        title: 'Left main bronchus to the superior segment',
        from: 'junction-3',
        arrive: true,
        intro:
          'The lesion is in the superior segment of the left lower lobe, LS6. It lies above the fork that leads to it, so this route goes down and then comes back up.',
        stations: {
          'junction-3': {
            steps: ['match', 'choose'],
            teach:
              'The lesion is in the lower lobe, but look at its slice: it is above this fork. Do not let the level decide for you. Decide by which lobe it is in.',
          },
          'junction-6': {
            teach:
              'The scope is looking down the lower lobe bronchus with anterior at the top, so the CT is mirrored here: flip it. The lower lobe bronchus gives off LB6 from its back wall, while the basal trunk carries on down. In the scope LB6 is the lower opening, because posterior is at the bottom.',
          },
          'junction-11': {
            teach:
              'LB6 runs backward, and the scope with it: it is looking toward the back, along the slice, with the head at the top. Seen from in front like this, the patient’s left is on the scope’s right, the same as a standard CT. The flip comes off. From here the route climbs and the slice numbers rise as you advance.',
          },
        },
      },
    ],
    closing:
      'Follow the lumen from the last certain connection, whichever way the slice numbers run. Check the letters each time the scope turns: once it looks backward or toward the head, the CT is the right way round.',
  },
  {
    id: 'navigate',
    title: 'Navigate to a lesion',
    minutes: 10,
    objective:
      'Plan and drive a whole route from the trachea to a peripheral lesion, matching, identifying and choosing at every fork.',
    concept:
      'A peripheral lesion is reached by taking the right opening at every fork. Each fork is the same four moves: match the CT, identify the openings, choose toward the lesion, drive on.',
    trips: [
      {
        traceId: 'right-lower-basal',
        title: 'Worked route: trachea to the anterior basal segment',
        from: 'junction-1',
        arrive: true,
        worked: true,
        intro:
          'The lesion is in the anterior basal segment of the right lower lobe, RS8. The bench works this route from the trachea; step through it and watch what it reads at each fork.',
        stations: {
          'junction-1': { steps: ['match', 'choose'] },
          'junction-2': { steps: ['match', 'choose'] },
          'junction-9': {
            teach:
              'The lower lobe bronchus gives off RB6 from its back wall and carries on down as the basal trunk. The lesion is far below this fork, in a basal segment.',
          },
        },
      },
      {
        traceId: 'left-lower-basal',
        title: 'Your route: trachea to the lateral basal segment',
        from: 'junction-1',
        arrive: true,
        independent: true,
        intro:
          'Your turn. The lesion is in the lateral basal segment of the left lower lobe, LS9. The openings are lettered but not named until you have chosen.',
        stations: {
          'junction-1': { steps: ['match', 'choose'] },
          'junction-3': { steps: ['match', 'choose'] },
        },
      },
    ],
    closing:
      'That is the method: at every fork, match, identify, choose, drive. Practice has thirteen lesions to reach the same way.',
  },
]

export const lessonById = (id: string | undefined) => NAV_LESSONS.find((l) => l.id === id)
export const lessonNumber = (id: string) => NAV_LESSONS.findIndex((l) => l.id === id) + 1
export const lessonAfter = (id: string) =>
  NAV_LESSONS[NAV_LESSONS.findIndex((l) => l.id === id) + 1]
export const totalMinutes = () => NAV_LESSONS.reduce((sum, lesson) => sum + lesson.minutes, 0)

/** Lesson groups for the hub, by lesson id. */
export const LESSON_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Orientation', ids: ['carina-orientation'] },
  { label: 'The loop, on the right', ids: ['two-levels', 'middle-lobe-flat', 'rb5-up-or-down'] },
  { label: 'Looking up and across', ids: ['look-up-rul', 'oblique'] },
  { label: 'Coming back, and going all the way', ids: ['turn-back', 'navigate'] },
]
