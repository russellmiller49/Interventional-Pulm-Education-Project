// BBT-02 five-junction feedback packet.
//
// Every statement below is either (a) a fact of the source model in
// geometry/branch-decisions.json and geometry/paired-routes.json, cited by edge
// and node, or (b) an authoring-session reading of the native-v1 axial PNGs,
// labelled as such and pending faculty review. Nothing here comes from the
// synthetic phantom misconception text in content/phantoms.ts, and nothing is
// an answer key: model locators stay provisional centreline samples.
//
// Naming is shown directly. A short naming try is offered only where the name
// follows established lobar or segmental anatomy; subsegmental a/b labels are
// source topology assignments and are shown with their uncertainty, not asked.

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
  uncertainty?: string
}
export interface JunctionWhenNearer {
  /**
   * The model airway codes this text actually names, or 'any' when it names none.
   * The comparison only shows the text when the nearest other locator is one of them,
   * so a sibling-specific sentence never appears because an unrelated locator is nearer.
   */
  appliesTo: string[] | 'any'
  text: string
}
export interface JunctionFeedbackPacket {
  checkpointId: string
  parent: string
  daughters: [string, string]
  /**
   * What the source model and the authoring image reading already establish about the
   * response planes, shown before the task when the division is not yet separated on them.
   * Drawn from `divergence` and `continuity`; it adds no new anatomical claim.
   */
  entryLimitation?: string
  /** Model node level and the slices on which the two paths separate. */
  divergence: string
  /** The wall or lumen relationship that decides identity on the answer slices. */
  continuity: string
  revisit: JunctionRevisit[]
  /** Keyed by the intended daughter code: read when its mark sits nearer the locator it names. */
  whenNearer: Record<string, JunctionWhenNearer>
  /** What additional evidence would help after an unresolved response. */
  moreEvidence: string
  /** Relationships established by the source model and its nomenclature record. */
  known: string[]
  /** Explicitly uncertain readings and open review items. */
  uncertain: string[]
  naming: JunctionNaming
}

export const JUNCTION_FEEDBACK_OBSERVATION = {
  by: 'Authoring session (Claude), reading the native-v1 axial PNGs at the packet slices',
  date: '2026-09-14',
  status: 'Pending faculty review; not a clinical annotation and not an answer key',
} as const

const PACKETS: JunctionFeedbackPacket[] = [
  {
    checkpointId: 'junction-1',
    parent: 'Trachea',
    daughters: ['RMSB', 'LMSB'],
    entryLimitation:
      'Before you start: on this scan the two main bronchi still share one transversely elongated air column throughout the slices you can browse here (the model node is at about slice 392 and this interval ends at slice 384). The separate lumens with the carina between them appear at about slice 378 to 375, below this interval — an authoring-session reading of these images, pending faculty review. So the response plane, slice 387, asks which half of one shared column each model locator sits in, not which of two visible lumens it is in. Recording the response as unresolved is a reasonable record here; the full-route practice reaches the slices where the two lumens are separate.',
    divergence:
      'The model node for this division sits at about slice 392, 2.5 mm above the answer slice 387. On slices 392 to 381 the two main bronchi still share one transversely elongated air column; on this scan that lucency does not split into two separate lumens until about slice 378 to 375 (authoring reading, pending faculty review). That separation lies below this local interval, which ends at slice 384; the full-route practice shows it.',
    continuity:
      "What decides identity on slice 387 is which half of the shared air column the mark sits in. The right main bronchus is on the patient's right, which is screen-left in standard axial display; the left main bronchus is on the patient's left. No wall between them exists yet on slice 387: the carinal ridge becomes a visible soft-tissue partition only on the more caudal slices.",
    revisit: [
      {
        from: 392,
        to: 387,
        look: 'the single tracheal lumen widening into the shared column, with each model locator staying on its own side of the midline',
      },
      {
        from: 387,
        to: 384,
        look: 'the column staying single and transversely elongated: within this interval the two lumens never separate, so identity here rests on the side of the midline',
      },
    ],
    whenNearer: {
      RMSB: {
        appliesTo: ['LMSB'],
        text: "Your RMSB mark sits nearer the LMSB model locator. The two paths separate at the carina, not on this slice: step from 392 down to 384 and watch each model locator keep to its own side; the right half becomes its own lumen on the patient's right (screen-left in standard axial) below this interval. If your mark was placed on the patient's left, it lies in the left-main-bronchus part of the same shared column. The geometry alone cannot say whether that came from the display side or from a deliberate choice.",
      },
      LMSB: {
        appliesTo: ['RMSB'],
        text: "Your LMSB mark sits nearer the RMSB model locator. The two paths separate at the carina, not on this slice: step from 392 down to 384 and watch each model locator keep to its own side; the left half becomes its own lumen on the patient's left (screen-right in standard axial) below this interval. If your mark was placed on the patient's right, it lies in the right-main-bronchus part of the same shared column. The geometry alone cannot say whether that came from the display side or from a deliberate choice.",
      },
    },
    moreEvidence:
      'Within this interval the evidence is the side of the midline: check the R and L markers on the display, then step from 392 to 384 and confirm that your candidate stays on one side of the shared column. The confirming view, two separate ovals with the carina between them at about slice 375, lies below this interval; the full-route practice reaches it. Until you have seen it, an unresolved response here is a reasonable record.',
    known: [
      'Source model: the trachea (edge 0) ends at node 1 near slice 392, where the right main bronchus (edge 1) continues more right and the left main bronchus (edge 2) more left.',
      'On slice 387 the two model locators are 8.6 mm apart in the axial plane.',
    ],
    uncertain: [
      'The slice at which the carina first separates the two lumens (about 378 to 375) is an authoring-session image reading, not a reviewed annotation.',
      'Model locators are centreline samples, not wall contours; a mark anywhere inside the intended half of the column is a valid mark.',
    ],
    naming: {
      demonstration: [
        'The names follow the side of the patient: RMSB, the right main bronchus, enters the right lung; LMSB, the left main bronchus, enters the left lung.',
        "In standard axial display the patient's right is on screen-left, so RMSB is the screen-left daughter here. The R and L markers on the CT show the sides for whichever display you use.",
      ],
      try: {
        prompt: "Which daughter lies on the patient's right?",
        choices: [
          { code: 'RMSB', text: 'RMSB · right main bronchus' },
          { code: 'LMSB', text: 'LMSB · left main bronchus' },
        ],
        describes: 'RMSB',
        explanation: {
          RMSB: "RMSB lies on the patient's right, screen-left in standard axial display. In the source model it is the daughter that continues more right from the node.",
          LMSB: "LMSB is the daughter on the patient's left, screen-right in standard axial display. The daughter on the patient's right is RMSB. Check the R marker on the CT display before deciding a side.",
        },
      },
    },
  },
  {
    checkpointId: 'junction-6',
    parent: 'LLL',
    daughters: ['LB6', 'L basal'],
    entryLimitation:
      'Before you start: on the LB6 response plane, slice 326, the LB6 origin appears as a posterior extension of the same lucency as the descending lower-lobe bronchus, with no wall resolved between them on slices 328 to 322 — an authoring-session reading of these images, pending faculty review. The LB6 response therefore asks which part of one lucency, anterior or posterior, the mark sits in. The basal-trunk response on slice 313 lies below the node, where the model has a single lower-lobe lumen. Recording either response as unresolved is a reasonable record.',
    divergence:
      'The model node sits at about slice 321. The two daughters leave it in opposite slice directions: LB6 runs posteriorly and cranially, so its answer slice, 326, lies above the node, while the basal trunk continues caudally to its answer slice, 313.',
    continuity:
      'On slices 328 to 322 the LB6 origin appears as a posterior extension of the same lucency as the descending lower-lobe bronchus, without a resolved wall between them on these axial planes (authoring reading). What separates the two is position and course: the anterior part of the lucency is the lower-lobe bronchus continuing caudally into the basal trunk; the posterior part is LB6 heading posteriorly and upward. Below slice 321 only one round lumen remains, the basal trunk, lying beside its artery.',
    revisit: [
      {
        from: 332,
        to: 321,
        look: 'the lower-lobe lumen elongating posteriorly as the LB6 origin joins it, then returning to a single lumen at the node',
      },
      {
        from: 328,
        to: 322,
        look: 'the posterior part of the lucency (LB6) against the anterior part (the descending lower-lobe bronchus)',
      },
      {
        from: 321,
        to: 313,
        look: 'the single basal trunk continuing caudally beside its artery',
      },
    ],
    whenNearer: {
      LB6: {
        appliesTo: ['LLL'],
        text: 'Your LB6 mark sits nearer the lower-lobe bronchus model locator than the LB6 locator. On this scan both lie in one lucency with no wall between them on slice 326, so the distinction is anterior against posterior: LB6 is the posterior part that heads posteriorly and cranially over slices 322 to 328, and a mark in the anterior part is in the parent lumen descending toward the basal trunk. The geometry cannot say whether you chose that part deliberately.',
      },
      'L basal': {
        appliesTo: 'any',
        text: 'Your basal-trunk mark sits nearer another model locator on slice 313. Below the node at 321 the model has a single lower-lobe lumen here; re-trace from 321 down to 313 and confirm that the lumen you marked is the one continuous with the lower-lobe bronchus rather than a neighbouring lucency.',
      },
    },
    moreEvidence:
      'Step from 328 to 321 one slice at a time and watch whether the posterior part of the lucency shrinks toward the node while the anterior part continues; then go below 321 and confirm that a single lumen remains. If the posterior extension cannot be separated from the parent on these planes, keeping the LB6 response unresolved is reasonable: the origin is oblique and partly in-plane here.',
    known: [
      'Source model: the lower-lobe bronchus (edge 5) ends at node 6 near slice 321; LB6 (edge 10) continues more cranial to slice 328 and the basal trunk (edge 11) more caudal to slice 285.',
      "LB6 is the left superior segmental bronchus. 'L basal' is the unnamed basal trunk before its own divisions, not a segment name.",
    ],
    uncertain: [
      'No wall between the LB6 origin and the lower-lobe bronchus is resolved on slices 322 to 328 in this window: an authoring-session reading pending faculty review.',
      'Distal LB6 subsegments are not named in this module (no B6a, b or c assignment).',
    ],
    naming: {
      demonstration: [
        'LB6 is the superior segmental bronchus of the left lower lobe. It is the first branch of the lower-lobe bronchus and arises from its posterior wall, heading posteriorly and slightly upward.',
        'The basal trunk is what remains of the lower-lobe bronchus after LB6 leaves; it continues caudally to the basal segments and has no segment name of its own.',
      ],
      try: {
        prompt: 'Which daughter arises from the posterior wall and runs cranially?',
        choices: [
          { code: 'LB6', text: 'LB6 · left superior segmental bronchus' },
          { code: 'L basal', text: 'Basal trunk · continues caudally' },
        ],
        describes: 'LB6',
        explanation: {
          LB6: 'LB6, the superior segmental bronchus, is the posterior, cranially directed daughter. In the source model it continues more cranial from the node.',
          'L basal':
            'The basal trunk is the caudal continuation of the lower-lobe bronchus. The posterior daughter that runs cranially is LB6, the superior segmental bronchus.',
        },
      },
    },
  },
  {
    checkpointId: 'junction-10',
    parent: 'RML',
    daughters: ['RB4', 'RB5'],
    divergence:
      'The model node sits at about slice 307, and both daughter answer slices are 307 as well: this division lies almost entirely within one axial plane. The parent middle-lobe bronchus runs forward and laterally as an elongated channel over slices 311 to 307, then splits in-plane.',
    continuity:
      'Because the course is in-plane, the lumens appear as dark channels rather than round rings. What decides identity is the in-plane fork: the lateral channel (RB4) continues laterally and slightly posteriorly, while the medial channel (RB5) turns anteriorly and medially. The soft-tissue wedge between the two channels at the fork is the wall that matters. Stepping one slice up or down changes the picture more than usual, because each channel is only about a millimetre thick in the slice direction.',
    revisit: [
      {
        from: 311,
        to: 307,
        look: 'the middle-lobe bronchus as a single oblique channel running forward and laterally toward the fork',
      },
      {
        from: 308,
        to: 305,
        look: 'the fork itself: the lateral channel (RB4) and the anterior-medial channel (RB5) leaving the same parent within about two slices',
      },
    ],
    whenNearer: {
      RB4: {
        appliesTo: ['RB5'],
        text: "Your RB4 mark sits nearer the RB5 model locator. Both daughters lie on slice 307 only 8 mm apart, so the fork decides: RB4 is the channel that continues laterally (screen-left in standard axial, toward the patient's right chest wall) and slightly posteriorly; RB5 is the channel that turns anteriorly and medially. Re-read the wedge of soft tissue between them on slices 308 to 306.",
      },
      RB5: {
        appliesTo: ['RB4'],
        text: "Your RB5 mark sits nearer the RB4 model locator. Both daughters lie on slice 307 only 8 mm apart, so the fork decides: RB5 is the channel that turns anteriorly and medially (toward the top of a standard axial display and toward the heart); RB4 is the channel that continues laterally toward the patient's right chest wall. Re-read the wedge of soft tissue between them on slices 308 to 306.",
      },
    },
    moreEvidence:
      'Follow the parent channel from 311 to 307 and note where it widens at the fork. Then, without changing slice, follow each channel away from the fork: one heads laterally (RB4), one anteriorly and medially (RB5). Comparing slices 308 and 306 shows how quickly each channel leaves the plane; a channel that vanishes on the next slice is not evidence against continuity here.',
    known: [
      'Source model: the middle-lobe bronchus (edge 9) ends at node 10 near slice 307; RB4 (edge 18) continues more posterior and lateral, RB5 (edge 19) more anterior and medial, both within about one slice of the node.',
      'On slice 307 the two model locators are 8.0 mm apart in the axial plane.',
    ],
    uncertain: [
      'The in-plane wedge between the two channels is read from the image by the authoring session, not a reviewed contour.',
      'RB4 and RB5 are named from the source labels and the textbook; the fork position is a centreline sample and may sit a pixel or two from the visible spur.',
    ],
    naming: {
      demonstration: [
        'The middle lobe has two segments: RB4, the lateral segmental bronchus, and RB5, the medial segmental bronchus. The names describe where each goes: lateral toward the chest wall, medial toward the heart.',
        "In this source model RB4 continues more toward the patient's right (lateral) and posterior, and RB5 more anterior and medial.",
      ],
      try: {
        prompt: 'Which daughter is the lateral segmental bronchus?',
        choices: [
          { code: 'RB4', text: 'RB4 · lateral segmental bronchus' },
          { code: 'RB5', text: 'RB5 · medial segmental bronchus' },
        ],
        describes: 'RB4',
        explanation: {
          RB4: 'RB4 is the lateral segmental bronchus. In the source model it is the daughter that continues more laterally and posteriorly.',
          RB5: 'RB5 is the medial segmental bronchus, the daughter that turns anteriorly and medially. The lateral segmental bronchus is RB4.',
        },
      },
    },
  },
  {
    checkpointId: 'junction-14',
    parent: 'RB1',
    daughters: ['RB1b', 'RB1a'],
    divergence:
      'The model node sits at about slice 416. Both daughters keep running cranially: RB1b is marked on slice 422 and RB1a on slice 424, and on those slices they sit only about 5 to 6 mm apart, one in front of the other.',
    continuity:
      'This is a vertical division seen end-on. The single RB1 ring on slice 415 elongates front-to-back over slices 416 to 420, develops a waist, and by slices 421 to 422 a thin wall separates an anterior lumen from a posterior one; on 424 there are two separate rings (authoring reading). The anterior lumen is RB1b and the posterior lumen RB1a in the source labelling. The bright structures beside them are pulmonary vessels: an airway here is a dark lumen with a thin bright ring, not a bright dot.',
    revisit: [
      {
        from: 401,
        to: 415,
        look: 'the single RB1 ring staying in almost the same place from slice to slice',
      },
      {
        from: 416,
        to: 424,
        look: 'the ring elongating, forming a waist, then splitting into an anterior and a posterior lumen',
      },
    ],
    whenNearer: {
      RB1b: {
        appliesTo: ['RB1a'],
        text: 'Your RB1b mark sits nearer the RB1a model locator. The two lumens are separated front-to-back, not side-to-side: RB1b is the anterior lumen (toward the top of a standard axial display) and RB1a the posterior one. Step from 416 to 424 and watch which lumen your candidate becomes as the waist closes into a wall.',
      },
      RB1a: {
        appliesTo: ['RB1b'],
        text: 'Your RB1a mark sits nearer the RB1b model locator. The two lumens are separated front-to-back, not side-to-side: RB1a is the posterior lumen (toward the bottom of a standard axial display) and RB1b the anterior one. Step from 416 to 424 and watch which lumen your candidate becomes as the waist closes into a wall.',
      },
    },
    moreEvidence:
      'Go back to slice 415, where there is one ring, then step up one slice at a time. The first slice on which you can see a complete wall between an anterior and a posterior lumen is where the two identities become separable; before that slice an unresolved response is reasonable. At 2 to 3 mm these lumens are only a few pixels wide, so use the airway-detail zoom.',
    known: [
      'Source model: RB1 (edge 13) ends at node 14 near slice 416; RB1b (edge 28) continues more anterior and RB1a (edge 29) more posterior, both toward more cranial slices.',
      'The RB1a/RB1b assignment follows the source labels: posterior and anterior daughters of the labelled right apical bronchus (nomenclature review).',
    ],
    uncertain: [
      'The slice at which the wall first separates the two lumens (about 421 to 422) is an authoring-session image reading pending faculty review.',
      'The source air sample for RB1a (−984 HU) is less air-dense than for RB1b (−1021 HU), which suggests partial-volume sampling of the smaller posterior lumen; the model locator may not sit in the centre of the visible lumen.',
      'Subsegmental naming (a/b) is a source topology assignment awaiting faculty review; it is shown, not asked.',
    ],
    naming: {
      demonstration: [
        "RB1 is the apical segmental bronchus of the right upper lobe. Its two subsegments are named a and b: in this module's source labelling RB1a is the posterior daughter and RB1b the anterior daughter.",
        'These labels are shown directly. Subsegmental letters vary between references and this assignment is pending faculty review, so no naming try is offered here.',
      ],
      uncertainty: 'Subsegmental a/b assignment pending faculty review.',
    },
  },
  {
    checkpointId: 'junction-20',
    parent: 'RB5',
    daughters: ['RB5a', 'RB5b'],
    divergence:
      'The model node sits at about slice 306, less than one millimetre after RB5 itself leaves the middle-lobe bronchus at about slice 307. RB5a is marked on slice 309, above the node, and RB5b on slice 301, below it: the two daughters leave in opposite slice directions.',
    continuity:
      'Two divisions happen within about 1 mm here: the middle-lobe bronchus into RB4 and RB5, then RB5 into a and b. What decides identity is the direction each small lumen takes from the anterior-medial channel: RB5a rises for a few slices (a short cranial excursion, then near-horizontal), RB5b descends caudally alongside a vessel. Both lumens are 2 to 3 mm and lie against bright vessels, so the wall of each is only a pixel or two wide.',
    revisit: [
      {
        from: 309,
        to: 305,
        look: 'the RB5 channel and the small anterior lumen (RB5a) that rises from it over slices 306 to 309',
      },
      {
        from: 306,
        to: 301,
        look: 'the RB5b lumen descending as a thin channel beside its vessel',
      },
    ],
    whenNearer: {
      RB5a: {
        appliesTo: 'any',
        text: 'Your RB5a mark sits nearer another model locator on slice 309. RB5a is the small lumen that rises above the node; on 309 it is a thin dark channel next to a bright vessel, and other lucencies nearby belong to neighbouring airways or to lung between vessels. Step from 306 up to 309 and check that your candidate stays continuous with the RB5 channel.',
      },
      RB5b: {
        appliesTo: 'any',
        text: 'Your RB5b mark sits nearer another model locator on slice 301. RB5b is the lumen that descends from the node beside its vessel; on 301 other dark channels nearby belong to neighbouring middle-lobe airways. Step from 306 down to 301 keeping the same thin channel in view.',
      },
    },
    moreEvidence:
      'Return to slice 307, find the anterior-medial channel (RB5) leaving the middle-lobe bronchus, then step one slice at a time in each direction. A rising lumen that stays continuous with that channel up to 309 is the RB5a candidate; a descending one down to 301 is the RB5b candidate. If either lumen cannot be separated from the adjacent vessel at this resolution, an unresolved response is the honest record: the export review flags these middle-lobe intervals for partial-volume sampling.',
    known: [
      'Source model: RB5 (edge 19) is only about 0.5 mm long, from node 10 near slice 307 to node 20 near slice 306; RB5a (edge 40) continues more cranial to slice 310 and RB5b (edge 41) more caudal to slice 299.',
      'Answer slices: RB5a on 309 (above the node), RB5b on 301 (below it).',
    ],
    uncertain: [
      'The source air samples for RB5a (−896 HU) and RB5b (−954 HU) are the least air-dense of the five packet junctions, consistent with partial-volume sampling; the export review already flags middle-lobe intervals for inspection before adopting source points as reference annotations.',
      'RB5a/RB5b naming is assigned from topology, patient-space course and textbook figures (nomenclature review) and is pending faculty review; it is shown, not asked.',
      'Whether each lumen is separable from its accompanying vessel on slices 301 to 309 in this window is an authoring-session reading.',
    ],
    naming: {
      demonstration: [
        "RB5 is the medial segmental bronchus of the middle lobe. In this module's source labelling its subsegments are RB5a, the daughter that first rises and then runs near-horizontally, and RB5b, the daughter that descends.",
        'Shown directly: the a/b assignment is a source topology decision pending faculty review, so no naming try is offered here.',
      ],
      uncertainty: 'Subsegmental a/b assignment pending faculty review.',
    },
  },
]

/** The five pilot junctions, in course order. Expansion needs a new packet and faculty review. */
export const JUNCTION_FEEDBACK_SCOPE = PACKETS.map((p) => p.checkpointId)

export function junctionFeedbackPacket(checkpointId: string): JunctionFeedbackPacket | undefined {
  return PACKETS.find((p) => p.checkpointId === checkpointId)
}
