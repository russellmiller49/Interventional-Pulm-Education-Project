// Junction explanations for the local lessons: one per division the lessons mark.
//
// Where each statement comes from:
//  - levels, directions and distances: the airway model (geometry/branch-decisions.json and the
//    source graph), computed, not estimated;
//  - "one air column" / "separate from slice N": the shipped axial PNGs at the result band's air
//    threshold (geometry/answer-plane-air.json; scripts/branch-tracing/build-answer-plane-air.mjs);
//  - names and subsegment letters: Kurimoto & Morita, Bronchial Branch Tracing (Springer 2020),
//    pp. 27 (B1a dorsal, B1b ventral), 39 (B3a into B3ai cranial and B3aii caudal), 46–47 (B4a,
//    B4b, B5a horizontal, B5b caudal), 53 and 97 (B6a cranial, B6b caudal-lateral, B6c
//    caudal-medial), 68 (left upper division into B1+2 dorsal and B3 ventral), 109 (lower-lobe
//    bronchus gives B6 dorsally).
//
// Review status and authoring notes are project records. They live in `uncertain` and
// JUNCTION_FEEDBACK_OBSERVATION below and in the packet documents; nothing in those two is shown
// to a learner.

export interface JunctionRevisit {
  from: number
  to: number
  /** What to look for while stepping through this interval. */
  look: string
}
export interface JunctionNamingTry {
  prompt: string
  choices: { code: string; text: string }[]
  /** The daughter the prompt describes, from the source geometry. */
  describes: string
  /** Shown after a choice or on Show the names; no choice is recorded. */
  explanation: Record<string, string>
}
export interface JunctionNaming {
  demonstration: string[]
  try?: JunctionNamingTry
  /** Project record only; not shown. */
  uncertainty?: string
}
export interface JunctionWhenNearer {
  /**
   * Which model locator this text is about: the other daughter, the parent, or whichever locator
   * the mark turned out to be nearer ('any'). Roles, not airway codes: several divisions have a
   * parent and daughters that share one code.
   */
  appliesTo: ('daughter' | 'parent' | 'other')[] | 'any'
  text: string
}
export interface JunctionFeedbackPacket {
  checkpointId: string
  parent: string
  daughters: [string, string]
  /**
   * Shown before the task in the local lesson and on the routes: what the learner will see on
   * the answer slices when the two lumens are not yet separate there, and what to do about it.
   */
  entryLimitation?: string
  /** Shown before the task on the routes only, where the response plane differs from the lesson's. */
  routeEntryNote?: string
  /** Model node level and the slices on which the two paths separate. */
  divergence: string
  /** The wall or lumen relationship that decides identity on the answer slices. */
  continuity: string
  revisit: JunctionRevisit[]
  /** By answer slot: read when that slot's mark is in, or nearer, another airway. */
  whenNearer: [JunctionWhenNearer | null, JunctionWhenNearer | null]
  /** What to do when the two lumens could not be told apart. */
  moreEvidence: string
  /** Levels and distances from the airway model, in learner's words. */
  known: string[]
  /** Project record only: authoring notes for the packet. Never rendered. */
  uncertain: string[]
  naming: JunctionNaming
}

/** Project record only. Never rendered. */
export const JUNCTION_FEEDBACK_OBSERVATION = {
  by: 'Authoring sessions (Claude), reading the native-v1 axial PNGs at the packet slices',
  date: '2026-10-08',
  status: 'Pending faculty review; tracked in the packet documents',
} as const

const PACKETS: JunctionFeedbackPacket[] = [
  {
    checkpointId: 'junction-1',
    parent: 'Trachea',
    daughters: ['RMSB', 'LMSB'],
    routeEntryNote:
      "On this route the two main bronchi are marked on slice 387, 5 mm below the tracheal bifurcation, where they still share one wide air column. Mark RMSB in the half on the patient's right and LMSB in the half on the patient's left. Scroll down to slice 375 to see the carina come between them; by slice 372 they are two separate ovals.",
    divergence:
      'The tracheal centreline divides at about slice 392. From there the lumen widens side to side but stays one air column down to slice 376. On slice 375 a thin wall, the carina, first crosses it; on 374 to 372 that wall is plain. You mark both main bronchi on slice 372, where they are two separate ovals 30 mm apart, centre to centre.',
    continuity:
      "The carina decides it. Above slice 375 there is no wall, only a wide lumen with a waist. From 375 down, the soft tissue of the carina stands between two lumens: the one on the patient's right (screen-left in standard axial) is the right main bronchus, the one on the patient's left is the left main bronchus. Check the R and L markers before you mark.",
    revisit: [
      {
        from: 392,
        to: 376,
        look: 'the round tracheal lumen widening into one transverse column with a waist in the middle',
      },
      {
        from: 376,
        to: 372,
        look: 'the waist closing: a thin wall on 375, then a thick carina between two ovals',
      },
    ],
    whenNearer: [
      {
        appliesTo: ['daughter'],
        text: "Your RMSB mark is on the left main bronchus side. On slice 372 the carina separates two ovals: RMSB is the one on the patient's right, screen-left in standard axial. Check the R marker, then step from 376 to 372 and watch the right-hand oval form.",
      },
      {
        appliesTo: ['daughter'],
        text: "Your LMSB mark is on the right main bronchus side. On slice 372 the carina separates two ovals: LMSB is the one on the patient's left, screen-right in standard axial. Check the L marker, then step from 376 to 372 and watch the left-hand oval form.",
      },
    ],
    moreEvidence:
      'If you still see one lumen, you are above the carina. Scroll down one slice at a time from 376: the wall appears on 375 and is thick by 372. Mark each oval on 372.',
    known: [
      'The trachea divides at about slice 392; the right main bronchus runs to the right and down, the left main bronchus to the left and down.',
      'The two centrelines are 8.6 mm apart on slice 387, 26 mm apart on slice 375 and 30.5 mm apart on slice 372.',
      'One air column on slices 392 to 376; two separate lumens from slice 375 down.',
    ],
    uncertain: [
      'Separation at 375 is threshold arithmetic on the shipped PNGs (same at −950, −900 and −850 HU), not a reviewed annotation.',
      'The lesson marks on slice 372 by a local override; the routes keep the exported plane, slice 387 (OD-01).',
    ],
    naming: {
      demonstration: [
        'The names follow the side of the patient: RMSB, the right main bronchus, enters the right lung; LMSB, the left main bronchus, enters the left lung.',
        "In standard axial display the patient's right is on screen-left, so RMSB is the screen-left lumen here. The R and L markers on the CT show the sides for whichever display you use.",
      ],
      try: {
        prompt: "Which daughter lies on the patient's right?",
        choices: [
          { code: 'RMSB', text: 'RMSB · right main bronchus' },
          { code: 'LMSB', text: 'LMSB · left main bronchus' },
        ],
        describes: 'RMSB',
        explanation: {
          RMSB: "RMSB lies on the patient's right, screen-left in standard axial display. It is the shorter, wider and more vertical of the two.",
          LMSB: "LMSB is the daughter on the patient's left, screen-right in standard axial display. The daughter on the patient's right is RMSB. Check the R marker on the CT before deciding a side.",
        },
      },
    },
  },
  {
    checkpointId: 'junction-3',
    parent: 'LMSB',
    daughters: ['LLL', 'LUL'],
    divergence:
      'The left main bronchus ends at about slice 339. Its two daughters leave in opposite slice directions: the upper-lobe bronchus runs forward, outward and slightly up, and is marked on slice 341; the lower-lobe bronchus drops backward and down, and is marked on slice 332.',
    continuity:
      'On slices 347 to 340 the left main bronchus lies almost in the plane: a long oblique channel running from the midline toward the left hilum. The upper-lobe bronchus is the far, anterior end of that same channel, so on slice 341 there is no wall between them; position along the channel decides it. Below slice 339 the channel is gone and one separate lumen remains behind it: the lower-lobe bronchus.',
    revisit: [
      {
        from: 347,
        to: 340,
        look: 'the left main bronchus as one long oblique channel, with the upper-lobe bronchus continuing from its lateral, anterior end',
      },
      {
        from: 339,
        to: 332,
        look: 'the channel closing and the lower-lobe bronchus continuing as its own lumen, moving posteriorly as you descend',
      },
    ],
    whenNearer: [
      {
        appliesTo: 'any',
        text: 'Your lower-lobe mark is in another lumen. On slice 332 the left main bronchus has ended; the lower-lobe bronchus is the single lumen posterior and lateral to where the main bronchus was. Step from 339 down to 332 and keep that lumen in view.',
      },
      {
        appliesTo: ['parent'],
        text: 'Your upper-lobe mark is in the left main bronchus part of the channel. On slice 341 the two are one channel: the upper-lobe bronchus is its lateral, anterior end, about 7 mm beyond the main-bronchus centre. Follow the channel outward and mark near its far end.',
      },
    ],
    moreEvidence:
      'Start on slice 347 in the left main bronchus. Step down: through 340 the channel lengthens toward the hilum and the upper-lobe bronchus leaves its far end. Keep going below 339 and the only lumen left is the lower-lobe bronchus, behind. Mark the upper-lobe bronchus on 341 and the lower-lobe bronchus on 332.',
    known: [
      'The left main bronchus divides at about slice 339.',
      'The lower-lobe bronchus runs 13.5 mm posteriorly, laterally and caudally to slice 321.',
      'The upper-lobe bronchus runs 18 mm anteriorly and laterally, rising only about 4 mm.',
    ],
    uncertain: [
      'No local lesson marks this division (Lesson 1 uses only the left main bronchus above it), so this text has no lesson surface yet.',
    ],
    naming: {
      demonstration: [
        'The left main bronchus divides into the left upper-lobe bronchus, which runs anteriorly and laterally, and the left lower-lobe bronchus, which continues posteriorly and caudally.',
        'The upper-lobe bronchus then divides into the upper division and the lingular bronchus; the lower-lobe bronchus gives LB6 first, then the basal trunk.',
      ],
      try: {
        prompt: 'Which daughter continues posteriorly and caudally?',
        choices: [
          { code: 'LLL', text: 'LLL · left lower-lobe bronchus' },
          { code: 'LUL', text: 'LUL · left upper-lobe bronchus' },
        ],
        describes: 'LLL',
        explanation: {
          LLL: 'The lower-lobe bronchus continues posteriorly and caudally. Here it is marked on slice 332, below the division.',
          LUL: 'The upper-lobe bronchus runs anteriorly and laterally, nearly in the axial plane. The daughter that continues posteriorly and caudally is the lower-lobe bronchus.',
        },
      },
    },
  },
  {
    checkpointId: 'junction-6',
    parent: 'LLL',
    daughters: ['LB6', 'L basal'],
    entryLimitation:
      'On slice 326, where you mark LB6, LB6 and the lower-lobe bronchus are still one dark area with no wall between them. LB6 is the posterior part; the lower-lobe bronchus is the anterior part. Mark the posterior part. Scroll from 321 up to 327 first and watch that posterior part grow backward out of the parent.',
    divergence:
      'The lower-lobe bronchus divides at about slice 321. The two daughters leave in opposite slice directions: LB6 runs posteriorly and up, so it is marked above the division on slice 326; the basal trunk continues down and is marked on slice 313.',
    continuity:
      'On slices 327 to 322 LB6 is a posterior extension of the same dark area as the lower-lobe bronchus: no wall stands between them on these planes, because LB6 leaves the posterior wall obliquely. Position decides it. The anterior part is the lower-lobe bronchus on its way down to the basal trunk; the posterior part is LB6 heading back and up. Below slice 321 only one round lumen remains, the basal trunk, beside its artery.',
    revisit: [
      {
        from: 332,
        to: 321,
        look: 'the lower-lobe lumen stretching posteriorly as LB6 joins it, then becoming one round lumen again at the division',
      },
      {
        from: 328,
        to: 322,
        look: 'the posterior part of the dark area (LB6) against the anterior part (the lower-lobe bronchus)',
      },
      {
        from: 321,
        to: 313,
        look: 'the single basal trunk continuing down beside its artery',
      },
    ],
    whenNearer: [
      {
        appliesTo: ['parent'],
        text: 'Your LB6 mark is in the anterior part of the dark area, which is the lower-lobe bronchus on its way to the basal trunk. LB6 is the posterior part, about 6 mm behind it on slice 326. Step from 322 up to 327 and watch the posterior part reach backward.',
      },
      {
        appliesTo: 'any',
        text: 'Your basal-trunk mark is in another lumen. Below the division at 321 the lower-lobe bronchus continues as one round lumen. Step from 321 down to 313 and stay in the lumen that is continuous with it; the dark spots beside it are other branches or lung.',
      },
    ],
    moreEvidence:
      'Go to slice 321, where there is one lumen. Step up one slice at a time: the dark area grows backward, and the part that grows is LB6. On 326 mark that posterior part, about 6 mm behind the centre of the round anterior part. For the basal trunk, step down from 321 to 313 and mark the single lumen.',
    known: [
      'The lower-lobe bronchus divides at about slice 321; LB6 runs posteriorly and up to slice 328, the basal trunk down to slice 285.',
      'On slice 326 the LB6 centre is 6.6 mm behind the lower-lobe bronchus centre.',
      "LB6 is the left superior segmental bronchus. 'L basal' is the basal trunk before its own divisions, not a segment name.",
    ],
    uncertain: [
      'LB6 and the parent are one air region on 322 to 327 at −950 HU; the band reads the nearer centre there.',
    ],
    naming: {
      demonstration: [
        'LB6 is the superior segmental bronchus of the left lower lobe. It is the first branch of the lower-lobe bronchus and leaves its posterior wall, heading backward and slightly up.',
        'The basal trunk is what remains of the lower-lobe bronchus after LB6 leaves; it continues down to the basal segments and has no segment number of its own.',
      ],
      try: {
        prompt: 'Which daughter leaves the posterior wall and runs upward?',
        choices: [
          { code: 'LB6', text: 'LB6 · left superior segmental bronchus' },
          { code: 'L basal', text: 'Basal trunk · continues caudally' },
        ],
        describes: 'LB6',
        explanation: {
          LB6: 'LB6, the superior segmental bronchus, is the posterior daughter that runs upward from the division.',
          'L basal':
            'The basal trunk is the downward continuation of the lower-lobe bronchus. The posterior daughter that runs upward is LB6, the superior segmental bronchus.',
        },
      },
    },
  },
  {
    checkpointId: 'junction-14',
    parent: 'RB1',
    daughters: ['RB1b', 'RB1a'],
    divergence:
      'RB1 divides at about slice 416. Both daughters keep climbing: RB1b is marked on slice 422 and RB1a on slice 424. On those slices they are 5 to 6 mm apart, one in front of the other.',
    continuity:
      'This is a vertical division seen end-on. The single RB1 ring on slice 415 stretches front to back on 416 to 418; from slice 419 a thin wall separates an anterior lumen from a posterior one, and by 424 they are two separate rings. The anterior lumen is RB1b, the posterior lumen RB1a. The bright round structures beside them are pulmonary vessels: an airway here is a dark lumen with a thin bright ring, not a bright dot.',
    revisit: [
      {
        from: 401,
        to: 415,
        look: 'the single RB1 ring staying in almost the same place from slice to slice',
      },
      {
        from: 416,
        to: 424,
        look: 'the ring stretching front to back, a wall appearing at 419, then two rings, one anterior and one posterior',
      },
    ],
    whenNearer: [
      {
        appliesTo: ['daughter'],
        text: 'Your RB1b mark is in the posterior lumen, RB1a. The two are separated front to back, not side to side: RB1b is the anterior one, toward the A marker. Step from 416 to 424 and watch which lumen yours becomes once the wall appears at 419.',
      },
      {
        appliesTo: ['daughter'],
        text: 'Your RB1a mark is in the anterior lumen, RB1b. The two are separated front to back, not side to side: RB1a is the posterior one, toward the P marker. Step from 416 to 424 and watch which lumen yours becomes once the wall appears at 419.',
      },
    ],
    moreEvidence:
      'Go back to slice 415, where there is one ring, and step up one slice at a time. On 419 a wall crosses the ring; from there up you have an anterior and a posterior lumen. These lumens are 2 to 3 mm, only a few pixels wide: turn on the airway-detail zoom before you mark.',
    known: [
      'RB1 divides at about slice 416; RB1b continues anteriorly and RB1a posteriorly, both upward.',
      'One air column on slices 416 to 418; two separate lumens from slice 419.',
      'On slice 422 the two centres are 5.3 mm apart, front to back.',
    ],
    uncertain: [
      'RB1a lumen is 5.7 mm² at −950 HU on slice 424; locator −984 HU.',
      'a/b letters follow Kurimoto & Morita p. 27 (B1a dorsal, B1b ventral); owner sign-off of OD-03 recorded in the 2026-10-08 audit.',
    ],
    naming: {
      demonstration: [
        'RB1 is the apical segmental bronchus of the right upper lobe. Heading for the apex it divides into RB1a, which goes posteriorly (dorsal), and RB1b, which goes anteriorly (ventral).',
        'So on an axial slice above the division, the lumen nearer the A marker is RB1b and the one nearer the P marker is RB1a.',
      ],
      try: {
        prompt: 'Which daughter is the posterior (dorsal) one?',
        choices: [
          { code: 'RB1a', text: 'RB1a' },
          { code: 'RB1b', text: 'RB1b' },
        ],
        describes: 'RB1a',
        explanation: {
          RB1a: 'RB1a is the dorsal branch of the apical bronchus: the posterior lumen here, marked on slice 424.',
          RB1b: 'RB1b is the ventral branch: the anterior lumen here, marked on slice 422. The posterior one is RB1a.',
        },
      },
    },
  },
  {
    checkpointId: 'junction-9',
    parent: 'RLL',
    daughters: ['R basal', 'RB6'],
    divergence:
      'The right lower-lobe bronchus divides at about slice 303. The two daughters leave in opposite slice directions: the basal trunk continues straight down and is marked on slice 294; RB6 runs backward and up, so it is marked above the division on slice 309.',
    continuity:
      'On slices 308 to 303 RB6 is a posterior extension of the same dark area as the lower-lobe bronchus, with no wall between them, because RB6 leaves the posterior wall obliquely. Position decides it: the round anterior part is the lower-lobe bronchus on its way down; the posterior limb, about 7 mm behind it on slice 309, is RB6. Below slice 302 one round lumen remains, the basal trunk.',
    revisit: [
      {
        from: 311,
        to: 303,
        look: 'the lower-lobe lumen with RB6 reaching backward from its posterior wall, shortening as you approach the division',
      },
      {
        from: 302,
        to: 294,
        look: 'the single round basal trunk, staying in nearly the same place on every slice',
      },
    ],
    whenNearer: [
      {
        appliesTo: 'any',
        text: 'Your basal-trunk mark is in another lumen. On slice 294 the basal trunk is the one round lumen directly below the division. Step from 302 down to 294 and stay in it; it barely moves on the screen.',
      },
      {
        appliesTo: ['parent'],
        text: 'Your RB6 mark is in the round anterior part of the dark area, which is the lower-lobe bronchus. RB6 is the limb that reaches backward from it, about 7 mm posterior on slice 309. Step from 303 up to 309 and watch that limb lengthen.',
      },
    ],
    moreEvidence:
      'Go to slice 302, where there is one lumen. Step up: a limb grows backward from the posterior wall and is longest at 308 to 309. That limb is RB6; mark it on 309. Then step down from 302 to 294 and mark the single round basal trunk.',
    known: [
      'The right lower-lobe bronchus divides at about slice 303; the basal trunk runs 9 slices down to its answer slice, RB6 backward and up to slice 309.',
      'The RB6 answer point is 5.3 mm posterior and 7.5 mm cranial of the basal-trunk answer point.',
      'RB6 and the lower-lobe bronchus are one air column on slices 303 to 308.',
    ],
    uncertain: [
      'RB6 (edge 17) is off every route, so it has no centreline crossings in paired-routes.json; only its answer point is known at run time.',
      'Slice 305 reads as separated at −950 HU and joined at 304 and 306: noise at the threshold, not a wall.',
    ],
    naming: {
      demonstration: [
        'RB6 is the superior segmental bronchus of the right lower lobe. It is the first branch of the lower-lobe bronchus and leaves its posterior wall, heading backward and slightly up.',
        'The basal trunk is what remains after RB6 leaves; it continues down to the basal segments, RB7 to RB10.',
      ],
      try: {
        prompt: 'Which daughter leaves the posterior wall and runs upward?',
        choices: [
          { code: 'RB6', text: 'RB6 · right superior segmental bronchus' },
          { code: 'R basal', text: 'Basal trunk · continues caudally' },
        ],
        describes: 'RB6',
        explanation: {
          RB6: 'RB6, the superior segmental bronchus, is the posterior daughter that runs upward from the division.',
          'R basal':
            'The basal trunk is the downward continuation of the lower-lobe bronchus. The posterior daughter that runs upward is RB6.',
        },
      },
    },
  },
  {
    checkpointId: 'junction-10',
    parent: 'RML',
    daughters: ['RB4', 'RB5'],
    divergence:
      'The middle-lobe bronchus divides at about slice 307, and both daughters are marked on slice 307 as well: this division lies almost entirely in one axial plane. The middle-lobe bronchus runs forward and outward as a long channel on slices 311 to 307, then forks in the plane.',
    continuity:
      'Because the course is in the plane, the lumens look like dark channels, not round rings. The fork decides it: the lateral channel (RB4) carries on outward and slightly backward; the other channel (RB5) turns forward and medially. The wedge of soft tissue between the two channels at the fork is the wall that matters. One slice up or down changes the picture more than usual, because each channel is only about a millimetre thick in the slice direction.',
    revisit: [
      {
        from: 311,
        to: 307,
        look: 'the middle-lobe bronchus as one oblique channel running forward and outward toward the fork',
      },
      {
        from: 308,
        to: 305,
        look: 'the fork itself: the lateral channel (RB4) and the anterior-medial channel (RB5) leaving the same parent within about two slices',
      },
    ],
    whenNearer: [
      {
        appliesTo: ['daughter'],
        text: "Your RB4 mark is in the RB5 channel. Both are on slice 307, 8 mm apart: RB4 is the channel that carries on laterally, toward the patient's right chest wall, and slightly backward; RB5 turns forward and medially. Find the wedge of soft tissue between them on slices 308 to 306 and mark lateral to it.",
      },
      {
        appliesTo: ['daughter'],
        text: 'Your RB5 mark is in the RB4 channel. Both are on slice 307, 8 mm apart: RB5 is the channel that turns forward and medially, toward the A marker and the heart; RB4 carries on laterally. Find the wedge of soft tissue between them on slices 308 to 306 and mark anterior to it.',
      },
    ],
    moreEvidence:
      'Follow the parent channel from 311 to 307 and find where it widens at the fork. Then, without changing slice, follow each channel away from the fork: one heads laterally (RB4), one forward and medially (RB5). Mark each a few millimetres beyond the wedge. A channel that vanishes on the next slice has left the plane; it has not ended.',
    known: [
      'The middle-lobe bronchus divides at about slice 307; RB4 runs laterally and RB5 anteriorly, both within about one slice of the division.',
      'On slice 307 the two centres are 8.0 mm apart.',
    ],
    uncertain: [
      'RML, RB4 and RB5 are one air region on slice 307; the band reads the nearest centre.',
    ],
    naming: {
      demonstration: [
        'The middle lobe has two segments: RB4, the lateral segmental bronchus, and RB5, the medial segmental bronchus. The names say where each goes: lateral toward the chest wall, medial toward the heart.',
        "Here RB4 carries on toward the patient's right and slightly backward, and RB5 turns forward and medially.",
      ],
      try: {
        prompt: 'Which daughter is the lateral segmental bronchus?',
        choices: [
          { code: 'RB4', text: 'RB4 · lateral segmental bronchus' },
          { code: 'RB5', text: 'RB5 · medial segmental bronchus' },
        ],
        describes: 'RB4',
        explanation: {
          RB4: 'RB4 is the lateral segmental bronchus: the channel that carries on outward and slightly backward.',
          RB5: 'RB5 is the medial segmental bronchus, the channel that turns forward and medially. The lateral segmental bronchus is RB4.',
        },
      },
    },
  },
  {
    checkpointId: 'junction-19',
    parent: 'RB4',
    daughters: ['RB4', 'RB4a'],
    divergence:
      'RB4 divides at about slice 306, and both daughters are marked on slice 307: like the middle-lobe fork before it, this division lies in the axial plane. RB4 runs outward for 18 mm almost within one slice, then forks.',
    continuity:
      'On slice 307 the parent and both daughters are one forked dark channel. The fork decides it: one daughter turns forward and outward, toward the A marker; the other, RB4a, carries on outward and slightly backward. On slice 307 their centres are 6 mm apart, front to back, with a thin wedge of lung and vessel between them. Each channel is about a millimetre thick in the slice direction, so the fork is clear on 307 and 308 and mostly gone by 309.',
    revisit: [
      {
        from: 307,
        to: 306,
        look: 'RB4 as one channel running outward from the middle-lobe fork toward its own fork',
      },
      {
        from: 307,
        to: 309,
        look: 'the two daughters leaving the fork, one forward and one backward, each rising about one slice',
      },
    ],
    whenNearer: [
      {
        appliesTo: ['daughter'],
        text: 'Your mark for the anterior daughter is in the posterior one, RB4a. They part front to back: the anterior daughter turns toward the A marker, about 6 mm in front of RB4a on slice 307. Find the wedge between the two limbs and mark anterior to it.',
      },
      {
        appliesTo: ['daughter'],
        text: 'Your RB4a mark is in the anterior daughter. They part front to back: RB4a is the limb that carries on outward and slightly backward, about 6 mm behind the anterior daughter on slice 307. Find the wedge between the two limbs and mark posterior to it.',
      },
    ],
    moreEvidence:
      'Stay on slice 307. Start in RB4 near the middle-lobe fork and follow the channel outward, 12 to 15 mm, until it splits. Mark each limb a few millimetres past the split: one in front of the wedge, one behind it. If a limb is faint on 307, check 308, where both are still in the plane.',
    known: [
      'RB4 runs 18 mm laterally within about one slice and divides at about slice 306.',
      'The anterior daughter runs 15 mm forward and outward; RB4a runs 7 mm outward and slightly backward. Both rise two to three slices.',
      'On slice 307 the two daughter centres are 6.1 mm apart.',
    ],
    uncertain: [
      'The anterior daughter (edge 38) carries no authored subsegment name and inherits RB4; by the textbook scheme it would be B4b (p. 46). No name was added.',
      'Parent and both daughters are one air region on slice 307; the band reads the nearest centre.',
    ],
    naming: {
      demonstration: [
        'RB4, the lateral segmental bronchus of the middle lobe, usually divides into RB4a, which runs laterally and dorsally, and RB4b, which runs laterally, ventrally and caudally (Kurimoto and Morita, p. 46).',
        'In this module the posterior daughter is labelled RB4a. The anterior daughter keeps the label RB4, so the two are told apart on screen as Daughter A, more anterior, and Daughter B, RB4a, more posterior.',
      ],
    },
  },
  {
    checkpointId: 'junction-20',
    parent: 'RB5',
    daughters: ['RB5a', 'RB5b'],
    divergence:
      'RB5 runs forward for 13 mm almost within one slice and divides at about slice 306. RB5a is marked on slice 309, above the division, and RB5b on slice 301, below it: the two daughters leave in opposite slice directions.',
    continuity:
      'The direction each small lumen takes from the end of the RB5 channel decides it. RB5a rises for three or four slices and then runs near-horizontally; RB5b drops away caudally beside a vessel. Both are 2 to 3 mm lumens lying against bright vessels, so each wall is only a pixel or two wide, and the RB5b lumen fades for a slice or two around 305 to 304 before it reappears. Use the airway-detail zoom.',
    revisit: [
      {
        from: 309,
        to: 305,
        look: 'the RB5 channel and the small anterior lumen (RB5a) that rises from its end on slices 306 to 309',
      },
      {
        from: 306,
        to: 301,
        look: 'the RB5b lumen dropping away as a thin channel beside its vessel',
      },
    ],
    whenNearer: [
      {
        appliesTo: 'any',
        text: 'Your RB5a mark is in another lumen. RB5a is the small lumen that rises from the front end of the RB5 channel; on 309 it is a thin dark slit next to a bright vessel. Step from 306 up to 309 and stay in the lumen that is continuous with RB5.',
      },
      {
        appliesTo: 'any',
        text: 'Your RB5b mark is in another lumen. RB5b drops from the front end of the RB5 channel beside its vessel. Step from 306 down to 301 and keep the same thin slit in view; if it fades on 305 or 304, hold your position and pick it up again on 303.',
      },
    ],
    moreEvidence:
      'Go to slice 307, find the RB5 channel running forward from the middle-lobe fork, and follow it to its front end. From there step up one slice at a time: the lumen you can follow to 309 is RB5a. Go back to the same spot and step down: the one you can follow to 301 is RB5b. If a lumen is hard to tell from the vessel beside it, zoom in before you decide.',
    known: [
      'RB5 is 13 mm long and stays within one slice, from the middle-lobe fork near slice 307 to its own division near slice 306.',
      'RB5a rises to slice 310; RB5b descends to slice 299.',
      'Answer slices: RB5a on 309, RB5b on 301.',
    ],
    uncertain: [
      'RB5b has no air at −950 HU on slices 305 and 304 (partial volume); RB5a locator reads −896 HU on 309 with air within 1.5 mm.',
      'a/b letters follow Kurimoto & Morita pp. 46–47 (B5a horizontal, B5b caudal); owner sign-off of OD-03 recorded in the 2026-10-08 audit.',
    ],
    naming: {
      demonstration: [
        'RB5 is the medial segmental bronchus of the middle lobe. It divides into RB5a, which runs forward near-horizontally, and RB5b, which runs forward and down.',
        'Here RB5a rises a few slices before it levels out, so it is marked above the division; RB5b is marked below it.',
      ],
      try: {
        prompt: 'Which daughter descends from the division?',
        choices: [
          { code: 'RB5a', text: 'RB5a' },
          { code: 'RB5b', text: 'RB5b' },
        ],
        describes: 'RB5b',
        explanation: {
          RB5a: 'RB5a is the horizontal branch: it rises a little and levels out, marked here on slice 309. The one that descends is RB5b.',
          RB5b: 'RB5b is the caudal branch: it drops away from the division and is marked here on slice 301.',
        },
      },
    },
  },
  {
    checkpointId: 'junction-16',
    parent: 'RB3a',
    daughters: ['RB3a', 'RB3a'],
    divergence:
      'RB3a runs outward almost in the plane and divides at about slice 389. One daughter climbs and is marked on slice 396; the other descends and is marked on slice 384. They leave in opposite slice directions, and both keep heading laterally.',
    continuity:
      'Slice direction decides it, not position on the screen. Both daughters head toward the chest wall, so on their own answer slices the two marks fall on almost the same spot on the screen, 6 mm apart in height. Scroll up from the division and the lumen you can follow is the cranial daughter; scroll down from it and you are in the caudal one. On slices 388 to 385 the caudal daughter is still joined to the parent channel. Both lumens are about 3 mm across: a dark dot with a thin bright ring.',
    revisit: [
      {
        from: 386,
        to: 389,
        look: 'RB3a as a short channel running outward to the division',
      },
      {
        from: 389,
        to: 396,
        look: 'the cranial daughter: a small round lumen drifting slowly outward as you scroll up',
      },
      {
        from: 389,
        to: 384,
        look: 'the caudal daughter: the lateral end of the parent channel, becoming a short oblique lumen',
      },
    ],
    whenNearer: [
      {
        appliesTo: 'any',
        text: 'Your mark for the cranial daughter is in another lumen. On slice 396 it is a small round lumen about 3 mm lateral to where the division was. Step from 389 up to 396 and stay in the one lumen that is continuous from slice to slice.',
      },
      {
        appliesTo: 'any',
        text: 'Your mark for the caudal daughter is in another lumen. On slice 384 it is a short oblique lumen about 3 mm lateral to where the division was. Step from 389 down to 384 and follow the lateral end of the parent channel.',
      },
    ],
    moreEvidence:
      'Go to slice 389 and find the lateral end of the RB3a channel. Step up one slice at a time to 396, keeping the small round lumen in view, and mark it. Go back to 389, step down to 384, and mark the lumen you followed that way. If you lose it, you have probably stepped onto a vessel: an airway stays dark in the middle.',
    known: [
      'RB3a divides at about slice 389. The cranial daughter runs 23 mm outward, rising 13 mm; the caudal daughter runs 7 mm outward, dropping 3.6 mm.',
      'The two answer points are 0.3 mm apart on the screen and 6 mm apart in height (slices 396 and 384).',
    ],
    uncertain: [
      'Both daughters carry the code RB3a. Kurimoto & Morita p. 39 describe B3a dividing into B3ai (cranial) and B3aii (caudal); the directions match, the names are not in the source labels.',
      'Lumens are 7.6 and 11.4 mm² at −950 HU; first leak into lung at −846 HU on slice 384.',
    ],
    naming: {
      demonstration: [
        'RB3 is the anterior segmental bronchus of the right upper lobe; RB3a is its lateral branch. Kurimoto and Morita (p. 39) describe RB3a dividing into a cranial branch, B3ai, and a caudal branch, B3aii.',
        'This module labels both daughters RB3a, so they are told apart on screen by direction: Daughter A, more cranial, and Daughter B, more caudal.',
      ],
    },
  },
  {
    checkpointId: 'junction-23',
    parent: 'LUL division',
    daughters: ['LB3', 'LB1+2'],
    divergence:
      'The upper division climbs straight up as a single ring from slice 353 and divides at about slice 371. Both daughters keep climbing. LB3 leans forward and is marked on slice 373; LB1+2 leans backward and is marked on slice 379.',
    continuity:
      'This is a vertical division seen end-on. The ring stretches front to back on slices 371 to 373, still one lumen with a waist; from slice 374 a wall separates an anterior lumen from a posterior one, 6 mm apart. The anterior lumen is LB3, the posterior lumen LB1+2. On slice 373, where you mark LB3, the two are still joined: mark the anterior end. By slice 379 LB1+2 is a separate ring.',
    revisit: [
      {
        from: 356,
        to: 370,
        look: 'the single ring of the upper division staying in almost the same place from slice to slice',
      },
      {
        from: 371,
        to: 379,
        look: 'the ring stretching front to back, a wall appearing at 374, then two rings: LB3 in front, LB1+2 behind',
      },
    ],
    whenNearer: [
      {
        appliesTo: ['daughter'],
        text: 'Your LB3 mark is at the posterior end of the lumen, the LB1+2 side. On slice 373 the two are still one stretched lumen: LB3 is its anterior end, toward the A marker, about 5 mm in front of LB1+2. Step up to 374 to see the wall, then come back and mark the anterior end.',
      },
      {
        appliesTo: 'any',
        text: 'Your LB1+2 mark is in another lumen. On slice 379 LB1+2 is the posterior of the two rings; LB3 lies about 10 mm in front of it. Step from 374 up to 379 and stay in the posterior ring.',
      },
    ],
    moreEvidence:
      'Go to slice 370, where there is one ring. Step up one slice at a time: the ring stretches, and on 374 a wall crosses it. From 374 up, the front lumen is LB3 and the back lumen is LB1+2. If the CT is rotated on your screen, go by the A and P markers, not the top of the screen.',
    known: [
      'The upper division divides at about slice 371; LB3 runs forward, outward and up, LB1+2 backward and up.',
      'One air column on slices 371 to 373; two separate lumens from slice 374.',
      'On slice 373 the two centres are 4.9 mm apart; on 377, 8.6 mm.',
    ],
    uncertain: [
      'LB3 is marked on 373, one slice above the last joined plane; the band reads the nearer centre there.',
    ],
    naming: {
      demonstration: [
        'The left upper division divides into LB1+2, the apicoposterior segmental bronchus, which goes dorsally, and LB3, the anterior segmental bronchus, which goes ventrally (Kurimoto and Morita, p. 68).',
        'So above the division the lumen nearer the A marker is LB3 and the one nearer the P marker is LB1+2.',
      ],
      try: {
        prompt: 'Which daughter is the anterior (ventral) one?',
        choices: [
          { code: 'LB3', text: 'LB3 · anterior segmental bronchus' },
          { code: 'LB1+2', text: 'LB1+2 · apicoposterior segmental bronchus' },
        ],
        describes: 'LB3',
        explanation: {
          LB3: 'LB3, the anterior segmental bronchus, is the ventral daughter: the front lumen, marked here on slice 373.',
          'LB1+2':
            'LB1+2, the apicoposterior segmental bronchus, is the dorsal daughter, marked here on slice 379. The anterior one is LB3.',
        },
      },
    },
  },
  {
    checkpointId: 'junction-11',
    parent: 'LB6',
    daughters: ['LB6', 'LB6'],
    divergence:
      'LB6 runs backward and up from the lower-lobe bronchus and divides at about slice 328. One daughter turns back down and is marked on slice 324; the other keeps climbing and is marked on slice 334. They leave in opposite slice directions.',
    continuity:
      'The caudal daughter runs backward, medially and down. On slice 324 it lies 9 mm behind the LB6 parent, at the posterior tip of the same dark limb: no wall separates them on slices 322 to 327, so position along the limb decides it. The cranial daughter runs backward, laterally and up; above slice 328 it is the only lumen there, a short oblique slit on slice 334.',
    revisit: [
      {
        from: 325,
        to: 328,
        look: 'LB6 as a limb reaching backward, lengthening as you approach the division',
      },
      {
        from: 328,
        to: 324,
        look: 'the caudal daughter: the posterior tip of that limb, moving farther back as you scroll down',
      },
      {
        from: 328,
        to: 334,
        look: 'the cranial daughter: one small lumen drifting backward and laterally as you scroll up',
      },
    ],
    whenNearer: [
      {
        appliesTo: ['parent'],
        text: 'Your mark for the caudal daughter is in the front part of the limb, which is the LB6 parent. On slice 324 the daughter is the posterior tip, about 9 mm behind the parent centre. Follow the limb backward to its end and mark there.',
      },
      {
        appliesTo: 'any',
        text: 'Your mark for the cranial daughter is in another lumen. On slice 334 it is a small oblique lumen behind and lateral to where LB6 divided. Step from 328 up to 334 and stay in the one lumen that is continuous from slice to slice.',
      },
    ],
    moreEvidence:
      'Go to slice 328, the division. Step down to 324 and watch the posterior tip of the LB6 limb slide backward: mark that tip. Go back to 328 and step up to 334: one small lumen moves backward and outward; mark it. If the limb looks like one piece on 324, that is expected: mark its posterior end.',
    known: [
      'LB6 divides at about slice 328. The caudal daughter runs 8 mm backward, medially and down; the cranial daughter runs 8 mm backward, laterally and up.',
      'On slice 324 the caudal daughter centre is 9.4 mm behind the LB6 parent centre.',
      'Answer slices: caudal daughter on 324, cranial daughter on 334.',
    ],
    uncertain: [
      'Daughters carry no subsegment names. By direction the caudal-medial one fits B6c and the cranial one a B6a(+b) trunk (Kurimoto & Morita p. 97); not asserted in learner copy.',
      'Cranial daughter locator reads −945 HU on 334 with air within 1.5 mm.',
    ],
    naming: {
      demonstration: [
        'LB6, the superior segmental bronchus, usually gives three branches: B6a upward, B6b outward and down, B6c medially and down (Kurimoto and Morita, p. 97). Which two share a trunk varies from patient to patient.',
        'This module labels every branch of LB6 simply LB6, so they are told apart on screen by direction: Daughter A, more caudal, and Daughter B, more cranial.',
      ],
    },
  },
  {
    checkpointId: 'junction-25',
    parent: 'LB6',
    daughters: ['LB6', 'LB6'],
    divergence:
      'This branch of LB6 climbs from slice 328 and divides at about slice 337. One daughter turns into the plane and runs outward and backward, so it is marked on slice 337 itself; the other keeps climbing and is marked on slice 345.',
    continuity:
      'On slice 337 the parent and the lateral daughter are one oblique dark channel: the daughter is its far end, about 5 mm lateral and posterior to the parent centre. One slice up, on 338, the two daughters are separate, 7 mm apart. The medial daughter keeps climbing as a small round lumen, about 2 mm across by slice 345, lying medial to where the lateral one was.',
    revisit: [
      {
        from: 332,
        to: 337,
        look: 'the parent as one small lumen climbing to the division',
      },
      {
        from: 337,
        to: 338,
        look: 'the lateral daughter running outward and backward in the plane as a short channel',
      },
      {
        from: 338,
        to: 345,
        look: 'the medial daughter: a small round lumen, moving slightly backward as you scroll up',
      },
    ],
    whenNearer: [
      {
        appliesTo: ['parent'],
        text: 'Your mark for the lateral daughter is at the near end of the channel, which is the parent. On slice 337 the daughter is the far end, about 5 mm lateral and posterior. Follow the channel outward and mark near its end.',
      },
      {
        appliesTo: 'any',
        text: 'Your mark for the medial daughter is in another lumen. On slice 345 it is a round lumen about 2 mm across. Step from 338 up to 345 and stay in the one that is continuous; zoom in, it is only a few pixels wide.',
      },
    ],
    moreEvidence:
      'Go to slice 337 and find the oblique channel: mark its lateral, posterior end. Then step up from 338: the small round lumen on the medial side is the other daughter. Keep it in view to 345 and mark it. Turn on the airway-detail zoom first.',
    known: [
      'This branch divides at about slice 337. The lateral daughter runs 11 mm outward and backward within about one slice; the medial daughter runs 10 mm up, backward and slightly medially.',
      'On slice 338 the two daughter centres are 7.0 mm apart.',
      'Answer slices: lateral daughter on 337, medial daughter on 345.',
    ],
    uncertain: [
      'Medial daughter lumen is 3.3 mm² at −950 HU on slice 345: a mark must land within about 1 mm of it for the band to read it.',
      'Lateral daughter locator reads −918 HU on 337 with air within 1.5 mm.',
    ],
    naming: {
      demonstration: [
        'Both daughters are branches of LB6 and both are labelled LB6 here. They are told apart on screen by direction: Daughter A, more left (lateral), and Daughter B, more right (medial).',
        'In the left lung, toward the patient’s left is lateral, toward the chest wall; toward the patient’s right is medial, toward the spine and mediastinum.',
      ],
    },
  },
  {
    checkpointId: 'junction-52',
    parent: 'LB6',
    daughters: ['LB6', 'LB6'],
    divergence:
      'This branch of LB6 climbs from slice 337 and divides at about slice 352. Both daughters keep climbing: the lateral one is marked on slice 358 and the medial one on slice 354. You came down the lower-lobe bronchus to reach LB6; every division since has been followed upward.',
    continuity:
      'From slice 353 the two daughters are separate lumens side by side, 2 mm apart on 353 and 4 mm apart on 355. The lateral one runs a long way backward and up and stays visible; the medial one is short, about 5 mm, and only 1 to 2 mm across, so it fades above slice 355. On slice 354 the medial daughter is the smaller lumen on the patient’s right of the pair.',
    revisit: [
      {
        from: 343,
        to: 352,
        look: 'the parent as one small lumen climbing to the division',
      },
      {
        from: 352,
        to: 355,
        look: 'one lumen becoming two, side by side: the medial one small and short',
      },
      {
        from: 355,
        to: 358,
        look: 'the lateral daughter continuing alone, moving backward as you scroll up',
      },
    ],
    whenNearer: [
      {
        appliesTo: 'any',
        text: 'Your mark for the lateral daughter is in another lumen. On slice 358 it is the one small lumen that continues backward from the division; the medial daughter has already ended. Step from 353 up to 358 and stay in it.',
      },
      {
        appliesTo: ['daughter'],
        text: 'Your mark for the medial daughter is in the lateral one. On slice 354 they lie side by side, about 4 mm apart: the medial daughter is the smaller lumen toward the patient’s right. Zoom in and mark that one.',
      },
    ],
    moreEvidence:
      'Go to slice 352, where there is one lumen. Step up: on 353 it becomes two. Mark the smaller, medial one on 354 before it fades, then follow the other to 358 and mark it. These are the smallest lumens in the course, 1 to 3 mm: turn on the airway-detail zoom, and if you cannot find the medial one on 354, look on 353 and step up again.',
    known: [
      'This branch divides at about slice 352. The lateral daughter runs 19 mm, mostly backward and up; the medial daughter runs 5 mm medially, backward and up.',
      'On slice 354 the two centres are 3.8 mm apart.',
      'Answer slices: lateral daughter on 358, medial daughter on 354.',
    ],
    uncertain: [
      'Medial daughter lumen is 1.4 mm² (3 pixels) at −950 HU on slice 354 and has no air at that threshold on 356 to 357: the band is at its limit here.',
      'First leak into lung at −868 HU (354) and −852 HU (358): margin 83 and 99 HU.',
    ],
    naming: {
      demonstration: [
        'Both daughters are distal branches of LB6 and both are labelled LB6 here. They are told apart on screen by direction: Daughter A, more left (lateral), and Daughter B, more right (medial).',
        'At this depth the name matters less than the count: note how many divisions you passed after entering LB6, and which way you turned at each.',
      ],
    },
  },
]

/** Divisions with a written explanation, in the order they are written above. */
export const JUNCTION_FEEDBACK_SCOPE = PACKETS.map((p) => p.checkpointId)

export function junctionFeedbackPacket(checkpointId: string): JunctionFeedbackPacket | undefined {
  return PACKETS.find((p) => p.checkpointId === checkpointId)
}
