// Fork explanations: what the CT shows at twenty-three forks, slice by slice. The bench shows these
// beside the fork's computed levels (engine/fork-facts.ts), which every fork has.
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
   * Shown before the openings are identified: what the learner will see on the identifying
   * slices when the two lumens are not yet separate there, and what to do about it.
   */
  entryLimitation?: string
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
  date: '2026-10-08 (thirteen forks) and 2026-10-09 (ten more)',
  status: 'Pending faculty review; tracked in the packet documents',
} as const

const PACKETS: JunctionFeedbackPacket[] = [
  {
    checkpointId: 'junction-1',
    parent: 'Trachea',
    daughters: ['RMSB', 'LMSB'],
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
      'Both main bronchi are identified on slice 372 by an override (engine/response-planes.ts); the export keeps slice 387.',
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
      'The two daughters’ centres are 0.3 mm apart on the screen and 6 mm apart in height (slices 396 and 384).',
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
        'At this depth the name matters less than the count: note how many divisions you went through after entering LB6, and which way you turned at each.',
      ],
    },
  },
  // ── Ten lobar and basal forks, read October 9, 2026 ─────────────────────────────────────────
  //
  // Same sources as above. Levels and distances are from the airway model; "one air column" and
  // "separate from slice N" are from the shipped PNGs at the verdict's air threshold, with the
  // 12 mm fill cap; shapes ("a channel", "a round lumen", "a limb") are read from the PNGs.
  // Sides are given as patient directions only, because the learner has usually flipped or
  // turned the CT by the time these are read.
  {
    checkpointId: 'junction-2',
    parent: 'RMSB',
    daughters: ['RUL', 'BI'],
    entryLimitation:
      'On slice 374, where you mark the upper-lobe bronchus, it is not a separate ring. The right main bronchus and the upper-lobe bronchus are one dark channel running across the image; the upper-lobe bronchus is its outer end, toward the patient’s right. Mark the outer end. The bronchus intermedius is marked lower, on slice 356, where it is one oval lumen on its own.',
    divergence:
      'The right main bronchus divides at about slice 365. The two daughters leave in opposite slice directions: the upper-lobe bronchus runs outward and up, so it is marked above the division on slice 374; the bronchus intermedius carries on straight down and is marked on slice 356.',
    continuity:
      'Above the division, on slices 384 to 370, the main bronchus and the upper-lobe bronchus are one transverse channel with no wall between them, because the upper-lobe bronchus leaves the outer wall almost at a right angle. Position along the channel decides it: the end toward the patient’s right is the upper-lobe bronchus, and on slices 384 to 380 that end is already dividing into its own branches. The channel shortens from its outer end as you scroll down. By slice 368 one oval lumen is left, the bronchus intermedius, and it keeps nearly the same place down to slice 356.',
    revisit: [
      {
        from: 366,
        to: 376,
        look: 'the oval lumen stretching outward into a channel: the part that grows toward the patient’s right is the upper-lobe bronchus',
      },
      {
        from: 366,
        to: 356,
        look: 'the single oval bronchus intermedius, staying in nearly the same place on every slice',
      },
    ],
    whenNearer: [
      {
        appliesTo: ['parent'],
        text: 'Your upper-lobe mark is in the inner part of the channel, which is the right main bronchus. On slice 374 the upper-lobe bronchus is the outer end of the same channel, about 10 mm toward the patient’s right. Step from 366 up to 376 and watch the lumen stretch outward: the part that grows is the upper-lobe bronchus.',
      },
      {
        appliesTo: 'any',
        text: 'Your bronchus intermedius mark is in another lumen. On slice 356 the bronchus intermedius is the one oval lumen at the hilum, directly below the division. Step from 366 down to 356 and stay in it; it barely moves on the screen.',
      },
    ],
    moreEvidence:
      'Go to slice 366, where there is one oval lumen. Step up: its outer end stretches toward the patient’s right into a channel, longest at about 376 to 380. That outer end is the upper-lobe bronchus; mark it on 374. Then go back to 366, step down to 356 and mark the single oval lumen, the bronchus intermedius.',
    known: [
      'The right main bronchus divides at about slice 365; the upper-lobe bronchus runs 13 mm outward while rising 11 mm, and the bronchus intermedius drops 25 mm almost vertically.',
      'On slice 374 the upper-lobe centre is 9.6 mm toward the patient’s right of the main-bronchus centre.',
      'The main bronchus and the upper-lobe bronchus are one air column on slices 366 to 376.',
    ],
    uncertain: [
      'Above slice 376 the two centres are more than 12 mm apart, beyond the fill cap, so "one channel" on 377 to 384 is read from the image, not from the mask.',
    ],
    naming: {
      demonstration: [
        'The right main bronchus is short. It gives off the right upper-lobe bronchus from its outer wall and carries on down as the bronchus intermedius, which goes on to supply the middle and lower lobes.',
        'Here the upper-lobe bronchus leaves outward and upward, and the bronchus intermedius continues straight down.',
      ],
      try: {
        prompt: 'Which daughter carries on straight down?',
        choices: [
          { code: 'RUL', text: 'RUL · right upper-lobe bronchus' },
          { code: 'BI', text: 'BI · bronchus intermedius' },
        ],
        describes: 'BI',
        explanation: {
          BI: 'The bronchus intermedius is the downward continuation of the right main bronchus, between the upper-lobe take-off and the middle-lobe bronchus.',
          RUL: 'The upper-lobe bronchus leaves the outer wall and runs outward and up. The daughter that carries on straight down is the bronchus intermedius.',
        },
      },
    },
  },
  {
    checkpointId: 'junction-4',
    parent: 'RUL',
    daughters: ['RB1/B2', 'RB3'],
    entryLimitation:
      'Neither daughter is a separate ring on its own slice. On slice 384, where you mark RB3, it is the limb that leaves the outer end of the upper-lobe channel and runs forward, toward the A marker. On slice 390, where you mark the common trunk of RB1 and RB2, it is the air at the outer end of that channel, toward the back.',
    divergence:
      'The right upper-lobe bronchus divides at about slice 387, at the outer end of the transverse channel it forms with the main bronchus. The two daughters leave in opposite slice directions. RB3 runs forward and outward almost in the plane and is marked just below the division, on slice 384. The common trunk of RB1 and RB2 climbs up and back and is marked above it, on slice 390; it is only about 5 mm long and divides again at slice 393.',
    continuity:
      'On slices 386 to 384 RB3 is a limb of the same dark area as the upper-lobe bronchus, with no wall between them. Position decides it: the limb pointing forward and outward from the end of the channel is RB3; the transverse channel coming from the midline is the upper-lobe bronchus. Above the division the same air space is still seen for a few slices, because these lumens are several slices thick. What changes as you scroll up from 387 is that the channel from the midline thins and is gone by slice 394, and the air left at its outer end, toward the back, draws in to a smaller lumen: the trunk of RB1 and RB2, climbing.',
    revisit: [
      {
        from: 387,
        to: 383,
        look: 'the limb running forward from the outer end of the channel, toward the A marker: RB3',
      },
      {
        from: 387,
        to: 393,
        look: 'the channel from the midline thinning, and the air at its outer end drawing in to a compact lumen: the trunk of RB1 and RB2',
      },
    ],
    whenNearer: [
      {
        appliesTo: 'any',
        text: 'Your mark for the trunk of RB1 and RB2 is in another lumen. On slice 390 the trunk is the air at the outer end of the upper-lobe channel, toward the back of that space. Step from 387 up to 393 and keep to the lumen that stays at the end of the channel as the channel thins.',
      },
      {
        appliesTo: ['parent'],
        text: 'Your RB3 mark is in the transverse channel, which is the upper-lobe bronchus. On slice 384 RB3 is the limb that leaves the outer end of that channel and runs forward, about 7 mm farther toward the patient’s right and front. Follow the channel outward to its end, then forward, and mark there.',
      },
    ],
    moreEvidence:
      'Go to slice 387 and find the outer end of the transverse channel. Step down to 384: a limb runs forward from that end, toward the A marker; mark it as RB3. Go back to 387 and step up to 390: the channel from the midline thins, and the air left at its outer end is the trunk of RB1 and RB2; mark it there.',
    known: [
      'The upper-lobe bronchus divides at about slice 387; RB3 runs 11 mm forward and outward, dropping 1 mm; the trunk of RB1 and RB2 runs 5 mm up and back before it divides at slice 393.',
      'On slice 384 the RB3 centre is 7.1 mm from the upper-lobe centre, toward the patient’s right and front.',
      'RB3 and the upper-lobe bronchus are one air column on slices 386 to 384.',
    ],
    uncertain: [
      'The forward limb is seen on slices 383 to 392 because the RB3 lumen is several slices thick and its forward branch (edge 14) rises 2.5 mm; the model has RB3 itself on 385 to 387.',
      'RB3 does not cross slice 390, so a mark in the forward limb there is read as the trunk: the two are one air space on that slice.',
    ],
    naming: {
      demonstration: [
        'The right upper lobe has three segmental bronchi: RB1 apical, RB2 posterior and RB3 anterior.',
        'In this patient RB1 and RB2 share a short common trunk, so the upper-lobe bronchus divides in two here: RB3 forward, and the trunk of RB1 and RB2 up and back.',
      ],
      try: {
        prompt: 'Which daughter runs forward, to the anterior segment?',
        choices: [
          { code: 'RB1/B2', text: 'RB1/B2 · common trunk of the apical and posterior bronchi' },
          { code: 'RB3', text: 'RB3 · anterior segmental bronchus' },
        ],
        describes: 'RB3',
        explanation: {
          RB3: 'RB3 is the anterior segmental bronchus: the limb that runs forward from the end of the upper-lobe bronchus.',
          'RB1/B2':
            'The common trunk climbs up and back and then divides into RB1 and RB2. The daughter that runs forward is RB3.',
        },
      },
    },
  },
  {
    checkpointId: 'junction-5',
    parent: 'BI',
    daughters: ['RLL', 'RML'],
    entryLimitation:
      'On slice 313, where you mark the middle-lobe bronchus, the two daughters are still one dark area stretched front to back, with no wall between them. The middle-lobe bronchus is the front part, toward the A marker. Mark the front part. The lower-lobe bronchus is marked on slice 310, where a wall has come between them.',
    divergence:
      'The bronchus intermedius divides at about slice 315. Both daughters leave downward, so both are found below the division: the middle-lobe bronchus runs forward and outward and is marked on slice 313; the lower-lobe bronchus runs down and back and is marked on slice 310.',
    continuity:
      'On slice 316 and above there is one round lumen. On 315 to 313 it stretches front to back but stays one dark area. On slice 312 a thin wall crosses it, and from there down there are two lumens. The front one lengthens into a channel running forward and toward the patient’s right: the middle-lobe bronchus. The back one stays round and carries on down: the lower-lobe bronchus. On slice 310 their centres are about 10 mm apart.',
    revisit: [
      {
        from: 318,
        to: 312,
        look: 'one round lumen stretching front to back, then a thin wall crossing it on slice 312',
      },
      {
        from: 312,
        to: 307,
        look: 'the front lumen lengthening into a channel toward the patient’s right and front, while the back lumen stays round',
      },
    ],
    whenNearer: [
      {
        appliesTo: ['daughter'],
        text: 'Your lower-lobe mark is in the front lumen, which is the middle-lobe bronchus. On slice 310 a wall separates two lumens about 10 mm apart: the lower-lobe bronchus is the round one behind, toward the P marker. Step from 315 down to 310 and watch the wall appear on 312.',
      },
      {
        appliesTo: ['daughter'],
        text: 'Your middle-lobe mark is in the back part of the dark area, which is the lower-lobe bronchus. On slice 313 the two are still one air column, their centres about 6 mm apart: the middle-lobe bronchus is the front part, toward the A marker. Step down to 312 and 311 to see the wall form and the front lumen stretch forward.',
      },
    ],
    moreEvidence:
      'Go to slice 316, where there is one round lumen. Step down: it stretches front to back, and on 312 a wall divides it. The front lumen, which then runs forward as a channel, is the middle-lobe bronchus; mark it on 313, in the front part. The back lumen, which stays round, is the lower-lobe bronchus; mark it on 310.',
    known: [
      'The bronchus intermedius divides at about slice 315; the middle-lobe bronchus runs 23 mm forward and outward, dropping 4 mm; the lower-lobe bronchus runs 8 mm back and outward, dropping 6 mm, to its own division at slice 303.',
      'One air column on slices 315 to 313; two separate lumens from slice 312 down.',
      'The centres are 6.4 mm apart on slice 313 and 10.6 mm apart on slice 310.',
    ],
    uncertain: [
      'The limbs reaching backward from the lower-lobe lumen on slices 310 to 307 are RB6 (edge 17), described at junction-9.',
    ],
    naming: {
      demonstration: [
        'The bronchus intermedius ends by dividing in two. The middle-lobe bronchus leaves its front wall and runs forward and outward. The lower-lobe bronchus is the continuation, down and back.',
        'On the CT that is a front lumen and a back lumen: front is the middle lobe, back is the lower lobe.',
      ],
      try: {
        prompt: 'Which daughter leaves the front wall?',
        choices: [
          { code: 'RLL', text: 'RLL · right lower-lobe bronchus' },
          { code: 'RML', text: 'RML · right middle-lobe bronchus' },
        ],
        describes: 'RML',
        explanation: {
          RML: 'The middle-lobe bronchus leaves the front wall of the bronchus intermedius and runs forward and outward.',
          RLL: 'The lower-lobe bronchus is the continuation down and back. The daughter that leaves the front wall is the middle-lobe bronchus.',
        },
      },
    },
  },
  {
    checkpointId: 'junction-7',
    parent: 'RB1/B2',
    daughters: ['RB2', 'RB1'],
    entryLimitation:
      'On slice 392, where you mark RB2, it is not yet a separate lumen: it is the limb that reaches backward from the air space at the end of the upper-lobe bronchus. Mark that back limb. RB1 is marked higher, on slice 401, where it is a small round ring on its own.',
    divergence:
      'The common trunk of RB1 and RB2 is short, about 5 mm, and divides at about slice 393. RB2 leaves backward almost in the plane, dipping a slice or two before it climbs, so it is marked on slice 392, just below the division. RB1 climbs nearly straight up and is marked on slice 401.',
    continuity:
      'On slices 390 to 393 the trunk and RB2 are one dark area: RB2 is its back limb, pointing toward the P marker. From slice 394 up a wall separates two lumens. The front one is small, round and stays in the same place from slice to slice: RB1, climbing toward the apex. The back one is longer and slides backward and outward as you scroll up, about 14 mm behind RB1 by slice 399: RB2.',
    revisit: [
      {
        from: 390,
        to: 393,
        look: 'the limb reaching backward from the air space at the end of the upper-lobe bronchus: RB2 leaving',
      },
      {
        from: 394,
        to: 401,
        look: 'two separate lumens: the front one small, round and still (RB1); the back one sliding backward and outward (RB2)',
      },
    ],
    whenNearer: [
      {
        appliesTo: ['parent'],
        text: 'Your RB2 mark is in the front part of the air space, which is the trunk. RB2 is the limb reaching backward from it, about 5 mm posterior on slice 392. Step from 392 up to 396 and watch that limb separate and slide backward.',
      },
      {
        appliesTo: 'any',
        text: 'Your RB1 mark is in another lumen. On slice 401 RB1 is the small round ring at the front, against the mediastinum, about 4 mm across; the longer lumens behind it are RB2 and its branches. Step from 394 up to 401 and keep to the ring that does not move.',
      },
    ],
    moreEvidence:
      'Go to slice 393, where the two are one air space. Step up: from 394 there are two lumens. Keep both in view to 401. The one that does not move is RB1; mark it on 401. Then go to 392 and mark the limb that reaches backward from the air space: RB2.',
    known: [
      'The trunk divides at about slice 393; RB2 runs 12 mm backward in the plane, rising 3 mm; RB1 rises 11 mm with 4 mm of forward travel.',
      'One air space on slice 393; two separate lumens from slice 394 up.',
      'On slice 401 the RB1 lumen is about 4 mm across.',
    ],
    uncertain: [
      'RB2 (edge 12) dips to about slice 390 before it climbs, so it crosses slice 392 twice; the answer point is the posterior crossing.',
      'Above slice 399 RB2 has divided into unnamed branches (edges 26 and 27), so a mark in one of them on slice 401 is read as air that joins no named airway.',
    ],
    naming: {
      demonstration: [
        'RB1 is the apical segmental bronchus and RB2 the posterior segmental bronchus of the right upper lobe. In this patient they share a short common trunk.',
        'The names say where each goes: RB1 up to the apex, RB2 backward.',
      ],
      try: {
        prompt: 'Which daughter climbs toward the apex?',
        choices: [
          { code: 'RB2', text: 'RB2 · posterior segmental bronchus' },
          { code: 'RB1', text: 'RB1 · apical segmental bronchus' },
        ],
        describes: 'RB1',
        explanation: {
          RB1: 'RB1 is the apical segmental bronchus: the small round lumen that climbs nearly straight up and keeps its place on the screen.',
          RB2: 'RB2 is the posterior segmental bronchus: it leaves backward. The daughter that climbs toward the apex is RB1.',
        },
      },
    },
  },
  {
    checkpointId: 'junction-8',
    parent: 'RB3',
    daughters: ['RB3', 'RB3a'],
    entryLimitation:
      'On slice 386 the two daughters are still joined at the fork: one dark Y. Mark each limb beyond the place where they part: the limb that runs forward for one, the limb that runs outward for the other.',
    divergence:
      'RB3 divides at about slice 385, and both daughters are marked on slice 386: this division lies almost entirely in one axial plane. RB3 runs forward and outward as a channel from the end of the upper-lobe bronchus, then forks in the plane.',
    continuity:
      'Because the course is in the plane, the lumens look like dark channels, not round rings. The fork decides it. One limb carries on forward, toward the A marker, along the edge of the mediastinum; it keeps the label RB3 here. The other turns outward, toward the patient’s right chest wall: RB3a. The wedge of lung between the two limbs is what separates them. On slice 386 their centres are 7 mm apart.',
    revisit: [
      {
        from: 388,
        to: 384,
        look: 'the Y at the fork: one limb forward along the edge of the mediastinum, one limb outward toward the chest wall',
      },
    ],
    whenNearer: [
      {
        appliesTo: ['daughter'],
        text: 'Your mark is in the limb that turns outward, which is RB3a. Both are on slice 386, 7 mm apart: the daughter that keeps the RB3 label carries on forward, toward the A marker, along the edge of the mediastinum. Find the wedge of lung between the two limbs and mark in front of it.',
      },
      {
        appliesTo: ['daughter'],
        text: 'Your RB3a mark is in the limb that carries on forward, which keeps the RB3 label. Both are on slice 386, 7 mm apart: RB3a is the limb that turns outward, toward the patient’s right chest wall. Find the wedge of lung between the two limbs and mark on its outer side.',
      },
    ],
    moreEvidence:
      'Stay on slice 386. Find where the channel from the upper-lobe bronchus forks, then follow each limb away from the fork: one runs forward, toward the A marker; one runs outward, toward the patient’s right. Mark each a few millimetres beyond the wedge of lung between them. A limb that vanishes on the next slice has left the plane; it has not ended.',
    known: [
      'RB3 divides at about slice 385; one daughter runs 14 mm forward and the other 14 mm outward, each rising about 2 mm.',
      'On slice 386 the two centres are 7.0 mm apart.',
      'The two daughters are one air region with the fork on slices 384 to 387.',
    ],
    uncertain: [
      'Above slice 387 the two limbs are more than 12 mm apart, beyond the fill cap; whether they still meet there is not read from the mask.',
    ],
    naming: {
      demonstration: [
        'RB3 is the anterior segmental bronchus of the right upper lobe. Its outer branch is RB3a.',
        'The branch that carries on forward keeps the label RB3 in this module, so the two are told apart by where they run: forward for RB3, outward for RB3a.',
      ],
    },
  },
  {
    checkpointId: 'junction-21',
    parent: 'LUL',
    daughters: ['LB4+5', 'LUL division'],
    entryLimitation:
      'On slice 339, where you mark the lingular bronchus LB4+5, it is not a separate ring. The left main and upper-lobe bronchi form one long oblique channel, and the lingular bronchus is its far end, where the channel reaches forward and toward the patient’s left and starts to branch. Mark that far end. The upper division is marked higher, on slice 357, where it is a round lumen on its own.',
    divergence:
      'The left upper-lobe bronchus divides at about slice 348. The two daughters leave in opposite slice directions. The upper division climbs straight up and is marked on slice 357. The lingular bronchus, LB4+5, carries on outward, forward and down, and is marked on slice 339.',
    continuity:
      'Below the division, on slices 347 to 339, the upper-lobe bronchus and the lingular bronchus are one oblique channel with no wall between them. The lingular bronchus is its outer, forward end, and by slice 339 that end is giving off branches. Above the division the channel draws back toward the midline. On slice 349 its tip is a rounded bulge; by slice 351 the bulge has pinched off as a round lumen about 6 mm across; and that lumen keeps the same place on every slice up to 360. That is the upper division.',
    revisit: [
      {
        from: 347,
        to: 339,
        look: 'the oblique channel reaching farther forward and toward the patient’s left on each slice down: its far end is the lingular bronchus',
      },
      {
        from: 348,
        to: 357,
        look: 'the tip of the channel rounding off and separating into one round lumen that stays put: the upper division',
      },
    ],
    whenNearer: [
      {
        appliesTo: 'any',
        text: 'Your lingular mark is in another part of the airway. On slice 339 LB4+5 is the far end of the long oblique channel, toward the patient’s left and front, where it begins to branch; the inner part of the channel, toward the midline, is still the main and upper-lobe bronchi. Follow the channel outward to its end and mark there.',
      },
      {
        appliesTo: 'any',
        text: 'Your upper-division mark is in another lumen. On slice 357 the upper division is the single round lumen at the edge of the hilum, about 6 mm across. Step from 351 up to 357 and stay in it; it does not move.',
      },
    ],
    moreEvidence:
      'Go to slice 348, where the channel ends in a rounded tip. Step up: the tip separates into a round lumen that stays in place; mark it on 357 as the upper division. Go back to 348 and step down: the channel reaches farther forward and toward the patient’s left; mark its far end on 339 as the lingular bronchus.',
    known: [
      'The left upper-lobe bronchus divides at about slice 348; the upper division rises 11.5 mm almost vertically; LB4+5 runs 11 mm outward and forward while dropping 7 mm.',
      'The two marked centres are 4 mm apart on the screen and 9 mm apart in height (slices 339 and 357).',
      'The upper-lobe bronchus and LB4+5 are one air column on slices 347 to 342; the upper division is a separate lumen from slice 350 up.',
    ],
    uncertain: [
      'On slices 341 to 339 the upper-lobe centre and the LB4+5 centre are 15 to 21 mm apart, beyond the fill cap, so "one channel" there is read from the image, not from the mask.',
      'At the threshold the upper division already reads as its own region on slice 349 (46 mm²), while the image still shows it touching the channel.',
    ],
    naming: {
      demonstration: [
        'The left upper-lobe bronchus divides into the upper division, which supplies the apicoposterior and anterior segments (LB1+2 and LB3), and the lingular bronchus, LB4+5, which supplies the superior and inferior lingular segments (LB4 and LB5).',
        'Here the upper division climbs straight up and the lingular bronchus runs forward, outward and down.',
      ],
      try: {
        prompt: 'Which daughter climbs straight up?',
        choices: [
          { code: 'LB4+5', text: 'LB4+5 · lingular bronchus' },
          { code: 'LUL division', text: 'Upper division · to LB1+2 and LB3' },
        ],
        describes: 'LUL division',
        explanation: {
          'LUL division':
            'The upper division is the daughter that climbs: a round lumen that keeps its place as you scroll up.',
          'LB4+5':
            'The lingular bronchus runs forward, outward and down. The daughter that climbs straight up is the upper division.',
        },
      },
    },
  },
  {
    checkpointId: 'junction-22',
    parent: 'LB4+5',
    daughters: ['LB4', 'LB5'],
    entryLimitation:
      'On slice 337, where you mark LB4, it is not a separate ring. The lingular bronchus runs forward and toward the patient’s left as a channel, and LB4 is the outer end of that channel, where thin branches begin to fan into the lung. Mark the outer end. LB5 is marked lower, on slice 325, where it is a small round lumen on its own.',
    divergence:
      'The lingular bronchus, LB4+5, divides at about slice 333. LB4 carries on outward and forward almost in the plane, rising about 2 mm, and is marked on slice 337. LB5 turns down and is marked on slice 325.',
    continuity:
      'On slices 337 to 334 the lingular bronchus and LB4 are one channel with no wall between them: LB4 is its outer end. Below the division the channel is gone. In its place, from slice 332 down, there is one small round lumen, 4 to 6 mm across, with a vessel running beside it: LB5. It drifts a few millimetres outward as you scroll down. On the screen the two marks fall almost on the same spot, 1 mm apart; the slice tells them apart.',
    revisit: [
      {
        from: 334,
        to: 338,
        look: 'the lingular channel and its outer end, where thin branches fan into the lung: LB4',
      },
      {
        from: 333,
        to: 325,
        look: 'the channel gone and one small round lumen in its place, drifting slowly outward: LB5',
      },
    ],
    whenNearer: [
      {
        appliesTo: ['parent'],
        text: 'Your LB4 mark is in the inner part of the channel, which is still the lingular bronchus. On slice 337 LB4 is the outer end, about 9 mm farther toward the patient’s left and front. Follow the channel outward to where the thin branches start and mark there.',
      },
      {
        appliesTo: 'any',
        text: 'Your LB5 mark is in another structure. On slice 325 LB5 is the one small round dark lumen, about 4 mm across, directly below the end of the lingular channel; the grey band beside it is a vessel. Step from 333 down to 325 and keep it in view.',
      },
    ],
    moreEvidence:
      'Go to slice 334 and find the outer end of the lingular channel. Step up to 337 and mark that outer end: LB4. Go back to 333 and step down: the channel disappears and one small round lumen is left beneath its end. Follow it to 325 and mark it: LB5.',
    known: [
      'LB4+5 divides at about slice 333; LB4 runs 6 mm outward and forward, rising 2 mm; LB5 drops 9 mm with 6 mm of outward travel.',
      'The two marked centres are 1 mm apart on the screen and 6 mm apart in height (slices 337 and 325).',
      'LB4+5 and LB4 are one air column on slices 337 to 334; LB5 is a lumen of its own from slice 332 down.',
    ],
    uncertain: [
      'LB4 (edge 42) is 6.7 mm long and ends at slice 337, its own answer slice; beyond it the model has unnamed branches (edges 87 and 88).',
    ],
    naming: {
      demonstration: [
        'The lingular bronchus divides into LB4, the superior lingular bronchus, and LB5, the inferior lingular bronchus.',
        'Here LB4 carries on at about the level of the division and LB5 turns down, as the names suggest.',
      ],
      try: {
        prompt: 'Which daughter turns down?',
        choices: [
          { code: 'LB4', text: 'LB4 · superior lingular bronchus' },
          { code: 'LB5', text: 'LB5 · inferior lingular bronchus' },
        ],
        describes: 'LB5',
        explanation: {
          LB5: 'LB5 is the inferior lingular bronchus: the small round lumen that appears beneath the end of the channel and keeps going down.',
          LB4: 'LB4 is the superior lingular bronchus: it carries on outward at about the level of the division. The daughter that turns down is LB5.',
        },
      },
    },
  },
  {
    checkpointId: 'junction-12',
    parent: 'L basal',
    daughters: ['LB7+8/B9', 'LB10'],
    entryLimitation:
      'On slice 282, where you mark the common trunk of LB7+8 and LB9, the two daughters are still one lobed dark area with no complete wall between them. The trunk is the front lobe, toward the patient’s left; LB10 is the back lobe, nearer the midline. Mark the front, outer lobe. LB10 is marked on slice 279, where it is a lumen of its own.',
    divergence:
      'The left basal trunk divides at about slice 285. Both daughters leave downward. A short common trunk for LB7+8 and LB9, only about 5 mm long, heads toward the patient’s left and is marked on slice 282. LB10 runs back and down and is marked on slice 279.',
    continuity:
      'Down to slice 287 the basal trunk is one round lumen. On 286 to 284 it widens and a notch forms in its back wall. On 283 to 280 it is a lobed dark area: the front, outer lobe is the common trunk and the back, inner lobe is LB10, 3 to 7 mm apart centre to centre, with no complete wall yet. From slice 279 down LB10 is a separate round lumen about 5 mm across, and by slice 276 the common trunk has itself divided, so three lumens stand side by side.',
    revisit: [
      {
        from: 288,
        to: 283,
        look: 'the round basal trunk widening, then a notch in its back wall deepening into two lobes',
      },
      {
        from: 283,
        to: 276,
        look: 'the back, inner lobe separating as LB10, then the front lobe dividing again, leaving three lumens',
      },
    ],
    whenNearer: [
      {
        appliesTo: ['daughter'],
        text: 'Your mark is in the back, inner lobe of the dark area, which is LB10. On slice 282 the two are still one air column, their centres about 4 mm apart: the common trunk of LB7+8 and LB9 is the front lobe, toward the patient’s left. Step from 285 down to 279 and watch the back lobe separate.',
      },
      {
        appliesTo: ['daughter', 'other'],
        text: 'Your LB10 mark is in one of the front lumens, which belong to the trunk of LB7+8 and LB9. On slice 279 LB10 is the round lumen behind them, toward the P marker and nearer the midline, about 7 mm from the trunk. Step from 283 down to 279 and keep to the back lobe as it separates.',
      },
    ],
    moreEvidence:
      'Go to slice 287, where there is one round lumen. Step down: a notch forms in its back wall and deepens into two lobes. Mark the front, outer lobe on 282: the common trunk. Keep stepping down to 279, where the back lobe has become a round lumen of its own, and mark it: LB10.',
    known: [
      'The left basal trunk divides at about slice 285; the common trunk of LB7+8 and LB9 runs 4 mm toward the patient’s left, dropping 3 mm, before it divides at slice 279; LB10 runs 7 mm backward, dropping 8 mm.',
      'One air column on slices 285 to 280; separate lumens from slice 279 down.',
      'The centres are 4.4 mm apart on slice 282 and 7.4 mm apart on slice 279.',
    ],
    uncertain: [
      'On slices 281 and 280 the region area halves (82 to 46 mm²) while the two centres still read as joined: the wall is forming and the join is a pixel or two wide.',
    ],
    naming: {
      demonstration: [
        'The left lower lobe has three basal bronchi in the usual count, because LB7 and LB8 share one stem: LB7+8 anteromedial, LB9 lateral and LB10 posterior.',
        'In this patient LB10 leaves the basal trunk first, backward, and what remains is a short common trunk that then divides into LB7+8 and LB9.',
      ],
      try: {
        prompt: 'Which daughter leaves backward?',
        choices: [
          {
            code: 'LB7+8/B9',
            text: 'LB7+8/B9 · common trunk of the anteromedial and lateral basal bronchi',
          },
          { code: 'LB10', text: 'LB10 · posterior basal segmental bronchus' },
        ],
        describes: 'LB10',
        explanation: {
          LB10: 'LB10 is the posterior basal segmental bronchus: the back lobe of the dark area, which separates and runs back and down.',
          'LB7+8/B9':
            'The common trunk is the front lobe, toward the patient’s left. The daughter that leaves backward is LB10.',
        },
      },
    },
  },
  {
    checkpointId: 'junction-17',
    parent: 'R basal',
    daughters: ['R basal', 'RB7'],
    divergence:
      'The right basal trunk divides at about slice 285. Both daughters leave downward, side by side. RB7, the smaller one, leaves toward the midline and is marked on slice 282. The basal trunk carries on down and outward and is marked on slice 280.',
    continuity:
      'Down to slice 288 the basal trunk is one round lumen. On 287 to 285 thin ridges appear inside it. From slice 284 down a complete wall separates two lumens lying side by side. The larger one, toward the patient’s right, is the continuing basal trunk, about 7 mm across. The smaller one, toward the patient’s left and so nearer the midline, is RB7, about 4 mm across with a thin bright wall. They move apart as you scroll down, from 4 mm centre to centre on slice 284 to 8 mm on slice 280.',
    revisit: [
      {
        from: 289,
        to: 284,
        look: 'the round basal trunk, ridges forming inside it, then a small lumen splitting off on the side nearer the midline',
      },
      {
        from: 284,
        to: 278,
        look: 'two lumens side by side moving apart: the larger basal trunk and the smaller RB7',
      },
    ],
    whenNearer: [
      {
        appliesTo: ['daughter'],
        text: 'Your basal-trunk mark is in the smaller lumen, which is RB7. On slice 280 two lumens lie side by side, about 8 mm apart: the basal trunk is the larger one, toward the patient’s right. Check the R marker, then mark the larger lumen.',
      },
      {
        appliesTo: ['daughter'],
        text: 'Your RB7 mark is in the larger lumen, which is the continuing basal trunk. On slice 282 RB7 is the smaller lumen beside it, about 7 mm toward the patient’s left, nearer the midline. Check the L marker, then mark the smaller lumen.',
      },
    ],
    moreEvidence:
      'Go to slice 288, where there is one round lumen. Step down to 284: a small lumen splits off on the side nearer the midline. Follow both down. Mark the smaller one on 282: RB7. Mark the larger one on 280: the basal trunk.',
    known: [
      'The right basal trunk divides at about slice 285; RB7 runs 7 mm toward the midline and back, dropping 9 mm; the continuing trunk runs 7 mm outward, dropping 6 mm.',
      'Separate lumens from slice 284 down; the centres are 7.3 mm apart on slice 282 and 8.4 mm apart on slice 280.',
      'On slice 282 the RB7 lumen is about 4 mm across and the basal trunk about 7 mm.',
    ],
    uncertain: [
      'Both daughters carry labels from the source graph: the continuing trunk keeps "R basal"; RB7 is edge 35, off every route.',
    ],
    naming: {
      demonstration: [
        'RB7 is the medial basal segmental bronchus of the right lower lobe. It is usually the first basal branch and leaves the side of the basal trunk nearer the heart.',
        'The trunk that remains goes on to give RB8, RB9 and RB10. It keeps the basal-trunk label here, so the two are told apart by size and side: the smaller lumen nearer the midline is RB7.',
      ],
    },
  },
  {
    checkpointId: 'junction-26',
    parent: 'LB7+8/B9',
    daughters: ['LB9', 'LB7+8'],
    divergence:
      'The common trunk of LB7+8 and LB9 is short, about 5 mm, and divides at about slice 279. LB7+8 leaves toward the patient’s left, almost in the plane, and is marked on slice 278. LB9 carries on down and slightly back and is marked on slice 270.',
    continuity:
      'On slices 282 and 281 the trunk is the front, outer lobe of the dark area it shares with LB10. From slice 279 down it is two lumens. One stretches into a channel running toward the patient’s left and lengthens on each slice down to about 274: LB7+8, leaving in the plane. The other is a small round lumen, about 5 mm across, that keeps its place from slice 278 down to 267: LB9. A third lumen on these slices, about 8 mm behind LB9 and nearer the midline, is LB10 from the fork before.',
    revisit: [
      {
        from: 281,
        to: 274,
        look: 'the front lobe dividing: one part stretching toward the patient’s left into a channel (LB7+8), one part staying small and round (LB9)',
      },
      {
        from: 278,
        to: 270,
        look: 'the small round LB9 keeping its place, with the larger LB10 behind it and nearer the midline',
      },
    ],
    whenNearer: [
      {
        appliesTo: 'any',
        text: 'Your LB9 mark is in another lumen. On slice 270 two round lumens lie close together: LB9 is the front, outer one, about 5 mm across; the larger one about 8 mm behind it, nearer the midline, is LB10 from the fork before. Step from 279 down to 270 and stay in the small round lumen that does not move.',
      },
      {
        appliesTo: ['daughter'],
        text: 'Your LB7+8 mark is in the small round lumen, which is LB9. On slice 278 LB7+8 is the lumen beside it, about 5 mm toward the patient’s left and slightly forward, already stretching outward into a channel.',
      },
    ],
    moreEvidence:
      'Go to slice 281 and find the front, outer lobe of the dark area. Step down to 278: it has divided. Mark the part that stretches toward the patient’s left: LB7+8. Then follow the small round lumen that stays in place down to 270 and mark it: LB9. The larger lumen behind it is LB10.',
    known: [
      'The trunk divides at about slice 279; LB7+8 runs 9 mm toward the patient’s left, dropping 3 mm; LB9 drops 9 mm with 5 mm of backward travel.',
      'Two separate lumens from slice 279 down; the centres are 4.7 mm apart on slice 278.',
      'On slice 270 the LB9 lumen is about 5 mm across, and the LB10 centre is 7.8 mm behind it and nearer the midline.',
    ],
    uncertain: [
      'LB7+8 (edge 52) ends at slice 272; below that the model has unnamed branches (edges 105 and 106).',
    ],
    naming: {
      demonstration: [
        'LB7+8 is the anteromedial basal segmental bronchus and LB9 the lateral basal segmental bronchus of the left lower lobe. In this patient they share a short trunk after LB10 has left.',
        'Here LB7+8 leaves toward the patient’s left and slightly forward, almost at the level of the division, and LB9 carries on down and back.',
      ],
      try: {
        prompt: 'Which daughter carries on down?',
        choices: [
          { code: 'LB9', text: 'LB9 · lateral basal segmental bronchus' },
          { code: 'LB7+8', text: 'LB7+8 · anteromedial basal segmental bronchus' },
        ],
        describes: 'LB9',
        explanation: {
          LB9: 'LB9 is the small round lumen that carries on down and keeps its place on the screen.',
          'LB7+8':
            'LB7+8 leaves in the plane, toward the patient’s left. The daughter that carries on down is LB9.',
        },
      },
    },
  },
]

/** Divisions with a written explanation, in the order they are written above. */
export const JUNCTION_FEEDBACK_SCOPE = PACKETS.map((p) => p.checkpointId)

export function junctionFeedbackPacket(checkpointId: string): JunctionFeedbackPacket | undefined {
  return PACKETS.find((p) => p.checkpointId === checkpointId)
}
