import type { ScopeViewSpec } from '../../components/scope/types'
import { num } from '../numbers'
import type { AuthoredChoice, BronchSectionDefinition } from '../types'

/**
 * Larynx, trachea and carina (rewrite, brief 5). The fellow names the laryngeal structures on
 * stills of a normal larynx, crosses the true cords as they open, finds the membranous wall in the
 * trachea, and uses the carina as home base: into each main bronchus and back. The airway tasks of
 * the retired `branch-entry` section (enter each main bronchus, hold a view) are here.
 *
 * Sources: the course textbook (S1), the training manual (S2), the faculty manual (S3) and the
 * lectures on inspection and handling (T10, T11).
 */
const LARYNX = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 51, to: 65 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
] as const
const CROSSING = [
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
  { sourceId: 'S3', location: { kind: 'pdf-pages', from: 81 } },
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 51, to: 65 } },
] as const
const ROUTE = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 65 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
] as const
const CARINA = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 93 } },
] as const
const HOLDING = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 93 } },
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 99 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 106, to: 107 } },
  { sourceId: 'T10', location: { kind: 'time-span', start: '00:06:57', end: '00:09:28' } },
] as const

const CARINA_VIEW: ScopeViewSpec = {
  sectionId: 'larynx-and-entry',
  mode: 'guided-walk',
  profile: 'adult-teaching-combined-left-basal-v1',
  start: { kind: 'airway', label: 'TR', at: 'distal' },
  controls: ['advance', 'withdraw', 'rotate', 'deflect', 'branchLabels'],
  assists: { 'centerline-lock': true, 'aim-guard': true, 'branch-labels': true },
  defaults: { branchLabels: true },
  readouts: ['currentAirway', 'contactCount'],
  litAirways: ['TR', 'RMSB', 'LMSB'],
  boundary: 'Guided travel: the scope follows the lumen. Opening names are on.',
}

const choices = (
  labels: readonly [string, string, string, string],
  rationales: readonly [string, string, string, string],
  unsafe?: 'b' | 'c' | 'd',
): AuthoredChoice[] =>
  (['a', 'b', 'c', 'd'] as const).map((id, index) => ({
    id,
    label: labels[index],
    rationale: rationales[index],
    plausibility: index === 0 ? 'best' : id === unsafe ? 'unsafe' : 'incorrect-mechanism',
  }))

export const section: BronchSectionDefinition = {
  id: 'larynx-and-entry',
  authoringContract: 2,
  title: 'Larynx, trachea and carina',
  shortTitle: 'Larynx to carina',
  minutes: 11,
  activityMinutes: 6,
  moduleIds: ['M07', 'M05'],
  objectives: [
    {
      objectiveId: 'M07-O1',
      subtask:
        'Names the laryngeal structures on stills, and tells the arytenoids from the glottis.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M07-O2',
      subtask: 'Chooses the moment to cross from the movement of the true cords.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M07-O3',
      subtask: 'Changes to the mouth when a nasal entry meets resistance, pain or bleeding.',
      evidence: 'observed-physical-skill-required',
    },
    {
      objectiveId: 'M07-O4',
      subtask:
        'Crosses while the cords are apart, and names the trachea by its rings and membranous wall.',
      evidence: 'observed-physical-skill-required',
    },
    {
      objectiveId: 'M07-O5',
      subtask: 'Looks again at the subglottis and the larynx on the way out.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M05-O3',
      subtask: 'Enters each main bronchus from the carina and comes back to it.',
      evidence: 'observed-physical-skill-required',
    },
    {
      objectiveId: 'M05-O4',
      subtask: 'Returns to the carina under vision when the position is in doubt.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M05-O5',
      subtask: 'Holds the view without drifting when the assistant speaks or passes an instrument.',
      evidence: 'observed-physical-skill-required',
    },
  ],
  drillIds: ['D03', 'D04', 'D10'],
  prerequisites: ['sedation-and-monitoring', 'five-controls'],

  clinicalQuestion:
    'The cords are in view. When do you cross, and where is home once you are through?',
  objective:
    'Name the laryngeal structures, cross the true cords as they open, and work from the carina.',
  harmfulReflex: 'Pushing against cords that are not open. Wait for them to part.',
  harmfulReflexPatterns: [/\bpush/i],
  anchor: {
    analogy:
      'The glottis is a door that opens on its own rhythm. You do not push it. You stand ready, lined up, and step through as it opens.',
    precise:
      'Identify the true cords, cross them as they part, and settle above the carina with the membranous wall at 6 o’clock.',
    checklistLabel: 'From the larynx to the carina',
    checklist: [
      'True cords identified',
      'Cross as they part',
      'Membranous wall at 6 o’clock',
      'Back to the carina when lost',
    ],
  },
  outcomes: [
    {
      id: 'cross-the-cords',
      text: 'Name the laryngeal structures, and cross the true cords as they open.',
    },
    {
      id: 'carina-home',
      text: 'Work from the carina: into each main bronchus and back, without drifting.',
    },
  ],

  spineStops: ['larynx', 'trachea', 'carina', 'main-bronchi'],
  grammarRowIds: ['red-out', 'dark-field', 'handle-turns-view-static'],
  precommitDenyPatterns: [/\barytenoid/i, /\blower pair\b/i],
  localPolicyIds: ['topical_anesthetic_policy'],
  reviewItemIds: ['R03', 'R04', 'R13'],

  tour: [
    { airway: 'TR', note: 'Rings in front and at the sides. The flat membranous wall is behind.' },
    { airway: 'RMSB', note: 'Short and nearly in line with the trachea.' },
    { airway: 'LMSB', note: 'Longer, and it leaves at a sharper angle.' },
  ],

  blocks: [
    {
      id: 'larynx',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'The larynx from above',
      body: 'Find the epiglottis first. It is the landmark on the way in, not the opening. Then name each structure before you aim.',
      pointsLabel: 'From the front of the inlet to the back',
      points: [
        'Epiglottis: at the front of the inlet.',
        'Aryepiglottic folds: the sides of the inlet, running back from the epiglottis.',
        'Arytenoids: the mounds at the back. The corniculate and cuneiform tubercles sit on them.',
        'False cords: the upper pair of folds.',
        'True cords: the lower pair, with the ventricle between them and the false cords.',
        'Glottis: the opening between the true cords. Aim here.',
      ],
      media: { kind: 'endoscopic-still', structureId: 'larynx', outline: true },
      claimClass: 'source',
      sourceRefs: LARYNX,
      reviewItemIds: ['R04'],
    },
    {
      id: 'route',
      kind: 'pattern',
      role: 'signals',
      heading: 'Nose or mouth',
      body: 'Through the nose, advance gently under vision. Resistance, pain or bleeding means stop and go by the mouth.\n\nThrough the mouth, always use a bite block. Find the base of the tongue, then the epiglottis.',
      claimClass: 'source',
      sourceRefs: ROUTE,
    },
    {
      id: 'crossing',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Cross as the cords part',
      body: `Spray ${num('lidocaine-spray-concentration')} lidocaine onto the cords and wait for it to work. Then watch the cords through a few breaths.\n\nThey part on each breath in. They close with speech, a cough or a touch. Line the tip up with the glottis and go through as they part.\n\nNever push against closed cords. If they clamp shut, stop touching them, say so, and check the oxygen and the breathing.`,
      claimClass: 'source',
      sourceRefs: CROSSING,
      localPolicyIds: ['topical_anesthetic_policy'],
      reviewItemIds: ['R13'],
    },
    {
      id: 'trachea-and-carina',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'The trachea, and home base',
      body: 'Below the cords, the trachea has cartilage rings in front and at the sides, and a flat membranous wall behind. Turn the scope until the membranous wall is at 6 o’clock. The right main bronchus is then on your right.\n\nThe carina is home base. From just above it you see both main bronchi. When you are unsure where you are, withdraw under vision until you see it again.',
      claimClass: 'source',
      sourceRefs: CARINA,
    },
    {
      id: 'holding-the-view',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Hold the view',
      body: 'When the assistant speaks or passes an instrument, the scope must not creep forward. Hold the tube at the nose or the bite block, without leaning on the patient’s face.\n\nA view held by pressing the tip on the wall is not a safe position. On the way out, look again at the subglottis and the larynx.',
      media: { kind: 'endoscopic-still', structureId: 'trachea', outline: false },
      claimClass: 'source',
      sourceRefs: HOLDING,
      reviewItemIds: ['R03'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Six errors to expect',
      body: 'Each one mistakes what is in view, or moves before the view allows it.',
      pointsLabel: 'The error, then the fix',
      points: [
        'Taking the arytenoids for the opening. The glottis is in front of them.',
        'Aiming between the false cords. The true cords are the lower pair.',
        'Pushing against closed cords. Wait for the breath in.',
        'Crossing during a cough. A cough is a closure, not an opening.',
        'Forcing a tight nostril. Go by the mouth.',
        'Creeping forward when someone speaks. Hold the tube still where it enters.',
      ],
      claimClass: 'source',
      sourceRefs: [...CROSSING, ...HOLDING],
      reviewItemIds: ['R04'],
    },
  ],

  workspace: {
    kind: 'media',
    media: [{ kind: 'endoscopic-still', structureId: 'larynx', outline: false }],
    caption: 'A normal larynx from above, with nothing marked',
  },

  act: {
    kind: 'scope-lab',
    outcomeId: 'cross-the-cords',
    view: {
      sectionId: 'larynx-and-entry',
      mode: 'larynx-entry',
      profile: 'adult-teaching-combined-left-basal-v1',
      start: { kind: 'larynx' },
      controls: ['advance', 'withdraw', 'rotate', 'deflect', 'declare', 'recenter', 'reset'],
      assists: { recenter: true },
      readouts: ['cordsState', 'deflectionDeg'],
      ledger: { expected: ['TR'] },
      script: 'breathing-cords',
      litAirways: ['TR'],
      boundary: 'The cords part on each breath in and close with a cough.',
    },
    goals: [
      {
        id: 'cross-glottis-open',
        label: 'Cross the glottis while the true folds are apart',
        test: { type: 'event', event: 'glottis-crossed-open' },
      },
      {
        id: 'name-the-trachea',
        label: 'Below the folds, name the trachea by its rings and membranous wall',
        test: { type: 'event-sequence', events: ['entered:TR', 'declared:TR:identified'] },
      },
      {
        id: 'no-advance-against-closure',
        label: 'Reach the trachea without advancing against closed folds',
        test: {
          type: 'all',
          tests: [
            { type: 'event', event: 'entered:TR' },
            { type: 'without', event: 'advanced-against-closure' },
          ],
        },
      },
    ],
  },

  moreActs: {
    images: {
      kind: 'find',
      outcomeId: 'cross-the-cords',
      find: {
        id: 'larynx-views',
        prompt:
          'Three views of a normal larynx and one of the carina, as the scope saw them. Click what each one asks for.',
        rows: [
          {
            id: 'true-cord',
            frameId: 'larynx-cords',
            marks: 'structures',
            context:
              'You are just above the glottis. The front of the larynx is at the top of this view.',
            prompt: 'Click the true vocal cord on the left of the image.',
            targetId: 'vocal-cord-image-left',
            rationale:
              'The true cords are the pale pair that meet at the front and bound the dark opening. The mound behind them is not a cord.',
          },
          {
            id: 'aryepiglottic-fold',
            frameId: 'larynx-folds',
            marks: 'structures',
            context: 'You are above the laryngeal inlet. The front of the larynx is at the top.',
            prompt: 'Click the aryepiglottic fold on the right of the image.',
            targetId: 'aryepiglottic-fold-image-right',
            rationale:
              'The aryepiglottic folds form the sides of the inlet. They run back from the epiglottis to the mounds at the back.',
          },
          {
            id: 'corniculate-tubercle',
            frameId: 'larynx-inlet',
            marks: 'structures',
            context: 'You are above the laryngeal inlet. The front of the larynx is at the top.',
            prompt: 'Click the corniculate tubercle on the left of the image.',
            targetId: 'corniculate-tubercle-image-left',
            rationale:
              'The corniculate tubercles cap the arytenoids, at the back of the inlet near the midline. The cuneiform tubercles sit further out, in the folds.',
          },
          {
            id: 'carina',
            frameId: 'carina',
            context:
              'You are above the carina. The view is rolled: the membranous wall is at 7 o’clock.',
            prompt: 'Click the left main bronchus.',
            targetId: 'lmb',
            rationale:
              'Put the membranous wall back at 6 o’clock in your head. The patient’s left is then on your left, and that opening is the left main bronchus.',
          },
        ],
        sourceRefs: LARYNX,
      },
    },
    carina: {
      kind: 'scope-lab',
      outcomeId: 'carina-home',
      view: {
        ...CARINA_VIEW,
        start: { kind: 'airway', label: 'TR', at: 'proximal' },
        controls: ['advance', 'withdraw', 'rotate', 'deflect', 'branchLabels', 'reset'],
      },
      goals: [
        {
          id: 'reach-carina',
          label: 'Advance down the trachea to the main carina',
          test: { type: 'event', event: 'reached-carina' },
        },
        {
          id: 'enter-right',
          label: 'Aim at the right main bronchus and enter it',
          test: { type: 'event-sequence', events: ['reached-carina', 'entered:RMSB'] },
        },
        {
          id: 'back-to-trachea',
          label: 'Withdraw from the right main bronchus into the trachea',
          test: { type: 'event-sequence', events: ['entered:RMSB', 'returned-to-trachea'] },
        },
        {
          id: 'enter-left',
          label: 'Aim at the left main bronchus and enter it',
          test: {
            type: 'event-sequence',
            events: ['entered:RMSB', 'returned-to-trachea', 'entered:LMSB'],
          },
        },
        {
          id: 'no-force',
          label:
            'Reach the left main bronchus with no advance refused for want of aim, none made while the model recorded a lost view, and no wall contact recorded',
          test: {
            type: 'all',
            tests: [
              { type: 'event', event: 'entered:LMSB' },
              { type: 'without', event: 'wall-contact' },
              { type: 'without', event: 'aim-refused' },
              { type: 'without', event: 'advanced-blind' },
            ],
          },
        },
      ],
    },
    hold: {
      kind: 'scope-lab',
      outcomeId: 'carina-home',
      view: {
        ...CARINA_VIEW,
        controls: ['advance', 'withdraw', 'rotate', 'deflect', 'capture', 'acknowledge'],
        readouts: ['depthMm', 'contactCount', 'holdRemaining'],
        litAirways: ['TR'],
        script: 'assistant-interrupt',
        boundary: 'The assistant speaks during this task. Drift is a change in depth.',
      },
      goals: [
        {
          id: 'acknowledge',
          label: 'Acknowledge the assistant',
          test: { type: 'event', event: 'acknowledged' },
        },
        {
          id: 'capture',
          label: 'Capture an image from above the main carina',
          test: {
            type: 'all',
            tests: [
              { type: 'event', event: 'captured' },
              { type: 'location', airway: 'TR' },
            ],
          },
        },
        {
          id: 'hold',
          label: 'Stay above the carina until the hold ends',
          test: {
            type: 'all',
            tests: [
              { type: 'event', event: 'hold-completed' },
              { type: 'location', airway: 'TR' },
            ],
          },
        },
        {
          id: 'no-drift',
          label: 'Finish the hold with no drift in depth recorded and no wall contact recorded',
          test: {
            type: 'all',
            tests: [
              { type: 'event', event: 'hold-completed' },
              { type: 'without', event: 'drift-detected' },
              { type: 'without', event: 'wall-contact' },
            ],
          },
        },
      ],
    },
  },

  prediction: {
    id: 'N04',
    itemType: 'management-decision',
    situation:
      'You pass the epiglottis and aim at two mounds of mucosa at the back of the inlet. The view turns pink. Further forward you can see two pairs of folds, one above the other.',
    stem: 'What is your next move?',
    choices: choices(
      [
        'Ease back, find the true cords and aim between them',
        'Push on toward the dark space behind the mounds',
        'Aim between the upper pair of folds',
        'Pause, and wait for the mounds to part',
      ],
      [
        'The opening is further forward, between the true cords. Easing back brings them into view.',
        'The dark space behind the mounds is not the airway. Darkness alone is not a lumen.',
        'The upper pair are the false cords. The opening lies between the pair below them.',
        'The mounds do not open. They sit behind the opening and move with the cords.',
      ],
      'b',
    ),
    explanation:
      'The mounds are the arytenoids, at the back of the inlet. The glottis lies in front of them, between the lower pair of folds. A pink view means the tip is on mucosa.',
    objectiveIds: ['M07-O1'],
    outcomeIds: ['cross-the-cords'],
    claimClass: 'source',
    sourceRefs: LARYNX,
    reviewItemIds: ['R04'],
  },

  transfer: {
    id: 'larynx-and-entry-transfer',
    itemType: 'management-decision',
    situation:
      'You have entered a main bronchus after a bout of coughing. The image has rolled, and you are no longer sure which side you are in.',
    stem: 'What do you do?',
    choices: choices(
      [
        'Withdraw under vision to the carina and find the membranous wall',
        'Go on to the next branch point and look for a landmark there',
        'Rotate until the airway looks like the side you expected',
        'Pause, and ask the assistant which side you entered',
      ],
      [
        'The carina is home base. With the membranous wall at 6 o’clock again, right and left are settled.',
        'Going deeper while lost takes you further from the one landmark that settles it.',
        'Rotating changes the image, not where you are. Either side can be made to look like the other.',
        'The assistant sees the same screen. The anatomy tells you, and the carina is a short way back.',
      ],
    ),
    explanation:
      'When you are unsure where you are, go back to the last place you were sure of. Above the carina you see both main bronchi, and the membranous wall tells you which is which.',
    objectiveIds: ['M05-O4'],
    outcomeIds: ['carina-home'],
    claimClass: 'source',
    sourceRefs: CARINA,
    transferVariant: 'Deeper in the airway, after the view has rolled.',
  },

  practice: [
    {
      id: 'mc-when-to-cross',
      presentationTitle: 'Lined up above the cords',
      situation:
        'You are coming through the mouth with a bite block in. The cords have had lidocaine, and the tip is lined up above the glottis. The cords move evenly with each breath.',
      item: {
        id: 'mc-when-to-cross',
        itemType: 'management-decision',
        stem: 'When do you go through?',
        choices: choices(
          [
            'On the next breath in, gently, with the opening in view',
            'Now, with a steady push: the tip is lined up',
            'While the patient holds a long “eee”',
            'During the next cough, when the airway bursts open',
          ],
          [
            'The cords part on inspiration. That is when the opening is widest.',
            'Lined up is not open. A push meets the cords if they are closing.',
            'Speech brings the cords together. That is the moment they are closed.',
            'A cough closes the cords first. It is a protective reflex, not an opening.',
          ],
          'b',
        ),
        explanation:
          'Watch the cords for a few breaths, then go through as they part. If they close on the scope, stop and wait.',
        objectiveIds: ['M07-O2', 'M07-O4'],
        outcomeIds: ['cross-the-cords'],
        claimClass: 'source',
        sourceRefs: CROSSING,
      },
    },
    {
      id: 'mc-nasal-resistance',
      presentationTitle: 'Resistance during a nasal entry',
      situation:
        'You are advancing through the right nostril. The passage narrows, the scope meets resistance and the patient winces. A streak of blood appears on the mucosa.',
      item: {
        id: 'mc-nasal-resistance',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: choices(
          [
            'Ease back, and go by the mouth with a bite block',
            'Keep going with firmer, steady pressure',
            'Angle the tip upward and keep advancing',
            'Pause, spray more lidocaine and try the same nostril',
          ],
          [
            'Resistance, pain and blood say this passage is too tight. The mouth is the other way in.',
            'Force tears the mucosa and turns a streak of blood into a bleed.',
            'Steering upward is a blind search. The roof of the nose is not the way through.',
            'More lidocaine treats the pain, not the narrow passage.',
          ],
        ),
        explanation:
          'A nasal entry is gentle or it is abandoned. Resistance, pain or bleeding is the signal to change route.',
        objectiveIds: ['M07-O3'],
        outcomeIds: ['cross-the-cords'],
        claimClass: 'source',
        sourceRefs: ROUTE,
        reviewItemIds: ['R13'],
      },
    },
    {
      id: 'mc-handle-turns-view-static',
      presentationTitle: 'The handle turns and the image does not',
      situation:
        'You are above the carina and want the left main bronchus. You turn the control section, but the image barely moves. Your grip on the insertion tube is relaxed, and the tube hangs in a wide loop.',
      item: {
        id: 'mc-handle-turns-view-static',
        itemType: 'management-decision',
        stem: 'What do you fix first?',
        choices: choices(
          [
            'Take the loop out of the tube, then try a small turn',
            'Loosen your grip on the insertion tube further',
            'Advance to take up the slack',
            'Keep turning until the image follows',
          ],
          [
            'The loop is soaking up the turn. Straighten the tube and the tip answers the handle again.',
            'Your grip is already relaxed. The loop is what is absorbing the rotation.',
            'Going forward moves the tip deeper without aiming it. The loop is outside the patient.',
            'More turning winds up the tube. When it lets go, the tip swings further than you meant.',
          ],
        ),
        explanation:
          'Rotation travels from the handle down the tube to the tip. A clamped grip or a loop takes it up on the way. Find where it is lost before you turn harder.',
        objectiveIds: ['M05-O5'],
        outcomeIds: ['carina-home'],
        claimClass: 'transcript-source',
        sourceRefs: HOLDING,
        reviewItemIds: ['R03'],
      },
    },
  ],
}
